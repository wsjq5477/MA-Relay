import { createServer, createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, rmSync, openSync, closeSync, existsSync, statSync, lstatSync, readFileSync, mkdirSync, type Stats } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { BridgeError, idSchema, terminal, type Task } from './core.js';
import { SettingsStore, stateDirectory, fingerprint, type Settings } from './settings.js';
import { type OpenCodeConfig } from './config.js';
import { Database } from './storage/database.js';
import { HubStore } from './storage/hub-store.js';
import { startHub, type HubHandle } from './hub.js';
import { startEdge, type EdgeHandle } from './edge.js';
import { startNativeServer, type NativeServerHandle } from './native-server.js';
import { OpenCodeClient } from './drivers/opencode-client.js';
import { request } from './client.js';
import { interactionSchema } from './protocol.js';
import { redactor } from './security.js';
import { readOpenCodeVersion } from './discovery.js';

const ipcSchema = z.object({ op: z.enum(['status', 'start', 'stop', 'agents', 'save', 'default', 'check', 'verify', 'submit', 'task', 'tasks', 'pending', 'reply', 'operation', 'request', 'conversations', 'conversation', 'continue', 'cancel', 'reconcile']),
  conversationId: idSchema.optional(), agentId: idSchema.optional(), taskId: idSchema.optional(), operationId: idSchema.optional(), requestId: idSchema.optional(), message: z.string().max(65536).optional(),
  expectedRevision: z.number().int().optional(), agent: z.record(z.string(), z.unknown()).optional(), reply: interactionSchema.optional(),
}).strict();
export type IpcRequest = z.infer<typeof ipcSchema>;
export function socketPath(directory: string): string {
  if (process.platform === 'win32') return '\\\\.\\pipe\\agentbridge-' + createHash('sha256').update(directory).digest('hex');
  const direct = resolve(directory, 'controller.sock');
  // Deep profile directories (for example a remote daemon's node contexts)
  // exceed the kernel's unix socket name limit; fall back to a short
  // user-private path so both server and client compute the same endpoint.
  if (Buffer.byteLength(direct) <= 100) return direct;
  return resolve(tmpdir(), 'agentbridge-' + (process.getuid?.() ?? 'shared'), 'controllers', createHash('sha256').update(directory).digest('hex').slice(0, 24) + '.sock');
}
function ensurePrivateDir(directory: string): void {
  const root = resolve(tmpdir()), parts = resolve(directory).slice(root.length).split('/').filter(Boolean), uid = process.getuid?.() ?? -1;
  if (!resolve(directory).startsWith(root)) throw new BridgeError('IPC_PATH', '回退 IPC 目录不受支持');
  let current = root;
  for (const part of parts) {
    current = resolve(current, part);
    let entry: Stats;
    try { entry = lstatSync(current); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; try { mkdirSync(current, { mode: 0o700 }); } catch (e2) { if ((e2 as NodeJS.ErrnoException).code !== 'EEXIST') throw e2; } entry = lstatSync(current); }
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.uid !== uid) throw new BridgeError('IPC_PATH', '回退 IPC 目录不可信');
  }
}
export async function ipc<T = unknown>(directory: string, input: IpcRequest): Promise<T> {
  directory = stateDirectory(directory);
  return new Promise((resolveReply, reject) => {
    const socket = createConnection(socketPath(directory)); let data = ''; let settled = false;
    const finish = (error?: Error, result?: unknown) => { if (settled) return; settled = true; clearTimeout(timer); socket.destroy(); if (error) reject(error); else resolveReply(result as T); };
    const timer = setTimeout(() => finish(new BridgeError('CONTROLLER_TIMEOUT', '控制器响应超时，写入结果可能未知，请查询原 ID', 503)), input.op === 'status' ? 2000 : 60000);
    socket.on('connect', () => socket.write(JSON.stringify(input) + '\n'));
    socket.on('error', () => finish(new BridgeError('CONTROLLER_OFFLINE', '后台控制器未运行', 503)));
    socket.on('end', () => { if (!settled) finish(new BridgeError('CONTROLLER_OFFLINE', '控制器连接中断，写入结果可能未知', 503)); });
    socket.on('data', chunk => {
      data += chunk.toString('utf8');
      if (Buffer.byteLength(data) > 16777216) return finish(new BridgeError('IPC_LIMIT', '控制器响应超过限制', 503));
      const end = data.indexOf('\n'); if (end < 0) return;
      try { const reply = JSON.parse(data.slice(0, end)) as { data?: unknown; error?: { code: string; message: string; status: number } };
        if (reply.error) finish(new BridgeError(reply.error.code, reply.error.message, reply.error.status));
        else if (input.op === 'status' && (!reply.data || (reply.data as { kind?: string }).kind !== 'agentbridge.controller'
          || (reply.data as { protocolVersion?: number }).protocolVersion !== 1
          || !Number.isSafeInteger((reply.data as { pid?: number }).pid)
          || (reply.data as { directory?: string }).directory !== directory)) finish(new BridgeError('IPC_IDENTITY', 'IPC 路径属于无法确认的服务，拒绝接管', 409));
        else finish(undefined, reply.data);
      } catch { finish(new BridgeError('IPC_INVALID', '控制器响应格式错误', 503)); }
    });
  });
}
export async function ensureController(directory: string): Promise<void> {
  directory = stateDirectory(directory);
  try { if (process.platform !== 'win32') { const entry = lstatSync(socketPath(directory)); if (!entry.isSocket()) throw new BridgeError('IPC_PATH_OCCUPIED', 'IPC 路径已被其他文件占用', 409); } }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  try { await ipc(directory, { op: 'status' }); return; } catch (e) {
    if (!(e instanceof BridgeError) || e.code !== 'CONTROLLER_OFFLINE') throw e;
    // Race-safe daemon lock decides startup when no endpoint is listening.
  }
  const logPath = resolve(directory, 'controller.log');
  const fd = openSync(logPath, 'a', 0o600); chmodSync(logPath, 0o600);
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const modulePath = existsSync(resolve(here, 'controller.js')) ? resolve(here, 'controller.js') : resolve(here, '../dist/controller.js');
    if (!existsSync(modulePath)) throw new BridgeError('BUILD_REQUIRED', '请先运行 npm run build');
    const child = spawn(process.execPath, [modulePath, directory], { detached: true, windowsHide: true, stdio: ['ignore', fd, fd], shell: false });
    child.on('error', () => {}); child.unref();
  } finally { closeSync(fd); }
  for (let i = 0; i < 120; i++) {
    try { await ipc(directory, { op: 'status' }); return; } catch (e) {
      if (!(e instanceof BridgeError) || e.code !== 'CONTROLLER_OFFLINE') throw e;
      await delay(250);
    }
  }
  throw new BridgeError('CONTROLLER_START', '控制器未能启动，请检查 controller.log（不包含原生密码）', 503);
}
export async function startController(directory: string): Promise<{ close(): Promise<void> }> {
  const store = new SettingsStore(directory);
  directory = store.directory;
  let settings = store.read();
  const lock = new Database(directory, 'controller.sqlite');
  let hub: HubHandle | undefined; let edge: EdgeHandle | undefined;
  let hubConfig: ReturnType<SettingsStore['hub']> | undefined;
  const natives = new Map<string, { config: OpenCodeConfig; handle: NativeServerHandle }>();
  const startupErrors = new Map<string, { code: string; message: string }>();
  let closing = false;
  let chain = Promise.resolve();
  const edgeToken = readFileSync(resolve(directory, String(settings.edge.tokenFile)), 'utf8').trim();
  if (edgeToken.length < 32 || edgeToken.length > 4096) { lock.close(); throw new BridgeError('CREDENTIAL_UNAVAILABLE', 'Connector 凭据文件不可用'); }
  const safe = redactor([store.client(settings, 'http://127.0.0.1:4317').token, edgeToken]);
  const save = (next: Settings) => { next.revision = settings.revision + 1; store.write(next, settings.revision); settings = next; };
  const client = () => { if (!hub) throw new BridgeError('NOT_CONNECTED', '尚未连接，请选择“连接后台”', 409); return store.client(settings, 'http://127.0.0.1:' + hub.port); };
  const withStore = <T>(work: (data: HubStore) => T): T => {
    if (hub) return work(hub.store);
    const config = store.storage(settings);
    const data = new HubStore(config.dataDir, config.maxEventBytes, config.maxEventsPerTask);
    try {
      data.recover();
      data.register(settings.agents.map(a => ({ agentId: a.agentId, name: a.name, adapter: 'opencode' as const, healthy: false,
        enabled: a.enabled, resourceKey: a.resourceKey, workspace: a.workspace, revision: a.revision,
        connectorId: String(settings.edge.connectorId), device: settings.deviceId, lastSeenAt: new Date().toISOString(),
        capabilities: { concurrency: 1 as const, progress: true as const, cancel: false as const, nativeSessions: true } })));
      return work(data);
    } finally { data.close(); }
  };
  const startNative = async (a: OpenCodeConfig) => {
    if (!a.enabled || !a.managed || natives.has(a.agentId)) return;
    try {
      const handle = await startNativeServer(a); natives.set(a.agentId, { config: a, handle }); startupErrors.delete(a.agentId);
      void handle.closed.then(() => {
        if (natives.get(a.agentId)?.handle === handle) {
          natives.delete(a.agentId);
          startupErrors.set(a.agentId, { code: 'NATIVE_UNAVAILABLE', message: 'OpenCode 服务已退出' });
        }
      });
      // A listening socket precedes native model-catalogue initialization. Warm only read-only metadata.
      await new OpenCodeClient(a).check(3000).catch(() => {});
    }
    catch (e) { const error = e instanceof BridgeError ? e : new BridgeError('NATIVE_START', '原生服务启动失败', 503);
      startupErrors.set(a.agentId, { code: error.code, message: error.message });
      console.error(error.code + ': agent=' + a.agentId); }
  };
  const connect = async () => {
    if (hub && edge) {
      for (const a of settings.agents) await startNative(a);
      await edge.apply(settings.agents);
      return;
    }
    if (!settings.agents.length) throw new BridgeError('NOT_CONFIGURED', '请先保存至少一个 OpenCode 连接', 409);
    if (hub) { await hub.close(); hub = undefined; }
    hubConfig = store.hub(settings);
    hub = await startHub(hubConfig);
    try {
      for (const a of settings.agents) await startNative(a);
      edge = await startEdge(store.edge(settings, 'http://127.0.0.1:' + hub.port));
      const current = edge;
      void current.closed.then(() => { if (edge === current) edge = undefined; });
    } catch (e) { await hub.close(); hub = undefined; throw e; }
  };
  const views = async () => {
    const registered = hub ? (await request<{ items: (Record<string, unknown> & { agentId: string })[] }>(client(), '/v1/agents')).items : [];
    const occupied = withStore(data => settings.agents.map(a => ({ agentId: a.agentId, task: data.occupied(a.agentId, a.resourceKey) })));
    return { revision: settings.revision, defaultAgent: settings.defaultAgent, connected: edge?.connection() === 'online', connectionState: edge?.connection() || 'stopped',
      items: settings.agents.map(a => {
        const check = settings.checks[a.agentId]; const verification = settings.verifications[a.agentId];
        const live = registered.find(item => item.agentId === a.agentId);
        const task = occupied.find(item => item.agentId === a.agentId)?.task;
        const currentModel = check?.selectedModel !== undefined && String(check.time) > String(live?.modelCheckedAt || '') ? check.selectedModel : live?.selectedModel;
        const actualModel = verification?.model as { id?: string; providerID?: string; variant?: string } | undefined;
        const selected = currentModel as { id?: string; providerID?: string; variant?: string } | null | undefined;
        const modelChanged = !a.model && currentModel !== undefined && !!actualModel &&
          (!selected || actualModel.id !== selected.id || actualModel.providerID !== selected.providerID || (actualModel.variant || 'default') !== (selected.variant || 'default'));
        return { agentId: a.agentId, name: a.name, workspace: a.workspace, serverUrl: a.serverUrl, executable: a.executable, managed: a.managed,
          nativeAgent: a.nativeAgent, model: a.model, permissions: a.permissions, enabled: a.enabled, desiredRevision: a.revision,
          appliedRevision: live?.revision, default: settings.defaultAgent === a.agentId, check,
          startupError: startupErrors.get(a.agentId),
          verification: verification ? { ...verification, stale: verification.fingerprint !== fingerprint(a) || modelChanged } : undefined,
          online: false, healthy: false, busy: !!task, available: false,
          ...(task ? { currentTask: task.owner === store.owner(settings) ? { taskId: task.taskId, status: task.status, summary: task.lastSummary }
            : { status: 'private', summary: 'Occupied by another user' } } : {}), ...live };
      }) };
  };
  const handle = async (input: IpcRequest): Promise<unknown> => {
    if (input.op === 'status') return { kind: 'agentbridge.controller', protocolVersion: 1, pid: process.pid, directory, connected: edge?.connection() === 'online', connectionState: edge?.connection() || 'stopped', hubUrl: hub ? 'http://127.0.0.1:' + hub.port : undefined, revision: settings.revision, agents: settings.agents.length,
      ownedNative: [...natives.entries()].map(([agentId, native]) => ({ agentId, pid: native.handle.pid })) };
    if (input.op === 'start') { if (!settings.connectOnStart) save({ ...settings, connectOnStart: true }); await connect(); return views(); }
    if (input.op === 'stop') { setTimeout(() => { void close(); }, 50); return { stopping: true }; }
    if (input.op === 'agents') return views();
    if (input.op === 'default' || input.op === 'save') {
      if (input.expectedRevision !== settings.revision) throw new BridgeError('REVISION_CONFLICT', '配置已变化，请重新读取', 409);
      if (input.op === 'default') {
        if (!settings.agents.some(a => a.agentId === input.agentId)) throw new BridgeError('AGENT_NOT_FOUND', '连接不存在', 404);
        save({ ...settings, defaultAgent: input.agentId }); return views();
      }
      if (!input.agent) throw new BridgeError('INVALID_INPUT', '缺少连接设置');
      const old = settings.agents.find(a => a.agentId === input.agent!.agentId);
      const merged = { ...old, ...input.agent };
      if (merged.model === null) delete merged.model;
      const parsed = store.normalize(merged, settings.deviceId);
      const executionChanged = !!old && fingerprint(old) !== fingerprint(parsed);
      const occupied = withStore(data => data.occupied(parsed.agentId, old?.resourceKey || parsed.resourceKey) || data.occupied(parsed.agentId, parsed.resourceKey));
      if (executionChanged && (occupied || edge?.journal.busy(parsed.agentId))) throw new BridgeError('AGENT_BUSY', '运行、等待或 unknown 任务占用连接，不能更改执行配置', 409);
      if (!old && occupied) throw new BridgeError('PROJECT_BUSY', '该项目已有运行或 unknown 任务', 409);
      parsed.revision = executionChanged || !old ? (old?.revision || 0) + 1 : old.revision;
      const agents = old ? settings.agents.map(a => a.agentId === old.agentId ? parsed : a) : [...settings.agents, parsed];
      save({ ...settings, agents, defaultAgent: settings.defaultAgent || parsed.agentId });
      if (hub && edge && hubConfig) {
        const ids = agents.map(a => a.agentId);
        const updated = store.hub(settings);
        for (const user of hubConfig.users) user.allowedAgents = updated.users.find(u => u.id === user.id)!.allowedAgents;
        hubConfig.connectors.find(c => c.id === settings.edge.connectorId)!.allowedAgents = ids;
        if (executionChanged) { const native = natives.get(parsed.agentId); if (native) { await native.handle.close(); natives.delete(parsed.agentId); } }
        await startNative(parsed);
        await edge.apply(agents);
      }
      return views();
    }
    if (input.op === 'check') {
      const a = settings.agents.find(a => a.agentId === input.agentId);
      if (!a) throw new BridgeError('AGENT_NOT_FOUND', '连接不存在', 404);
      const report: Record<string, unknown> = { time: new Date().toISOString(), fingerprint: fingerprint(a), configuration: 'valid',
        connection: 'not_checked', authentication: 'not_checked', nativeAgentConfiguration: 'not_checked', modelConfiguration: 'not_checked', modelResponse: 'not_checked' };
      try { report.version = await readOpenCodeVersion(a.executable);
        report.installation = 'available'; }
      catch { report.installation = 'unavailable'; }
      try { report.workspace = statSync(a.workspace).isDirectory() ? 'available' : 'unavailable'; } catch { report.workspace = 'unavailable'; }
      try {
        const native = new OpenCodeClient(a); const result = await native.check(3000); Object.assign(report, { connection: 'connected', authentication: 'accepted', modelConfiguration: result.healthy ? 'available' : 'unavailable', selectedModel: result.model, nativeVersion: result.version });
        const agents = await native.call<{ data: { id?: string; name?: string }[] }>('/api/agent?location%5Bdirectory%5D=' + encodeURIComponent(a.workspace));
        report.nativeAgentConfiguration = Array.isArray(agents.data) && agents.data.some(agent => agent.id === a.nativeAgent || agent.name === a.nativeAgent) ? 'available' : 'unavailable';
      }
      catch (e) { const error = e instanceof BridgeError ? e : new BridgeError('CHECK_FAILED', '连接检查失败');
        report.connection = ['OPENCODE_HTTP_401', 'OPENCODE_HTTP_403'].includes(error.code) ? 'reachable' : error.code === 'NATIVE_AUTH_UNAVAILABLE' ? 'not_checked' : 'failed';
        if (['OPENCODE_HTTP_401', 'OPENCODE_HTTP_403'].includes(error.code)) report.authentication = 'rejected';
        if (error.code === 'NATIVE_AUTH_UNAVAILABLE') report.authentication = 'credential_missing';
        report.code = error.code; report.message = error.message;
      }
      save({ ...settings, checks: { ...settings.checks, [a.agentId]: report } }); return report;
    }
    if (input.op === 'conversations') return request(client(), '/v1/conversations');
    if (input.op === 'conversation') return request(client(), '/v1/conversations/' + encodeURIComponent(input.conversationId || ''));
    if (input.op === 'submit' || input.op === 'verify' || input.op === 'continue') {
      const conversation = input.op === 'continue' ? await request<{ targetAgent: string }>(client(), '/v1/conversations/' + encodeURIComponent(input.conversationId || '')) : undefined;
      const a = settings.agents.find(a => a.agentId === (conversation?.targetAgent || input.agentId || settings.defaultAgent));
      if (!a) throw new BridgeError('AGENT_NOT_FOUND', '请选择有效的默认连接', 404);
      if (!input.requestId) throw new BridgeError('REQUEST_ID_REQUIRED', '提交前必须持久保存 requestId');
      const applied = hub?.store.agent(a.agentId);
      const existing = hub?.store.byRequest(store.owner(settings) || '', input.requestId);
      if (!existing && applied && (applied.configFingerprint !== fingerprint(a) || applied.revision !== a.revision)) throw new BridgeError('CONFIG_NOT_APPLIED', '期望配置尚未在 Edge 确认生效，请重新连接或检查配置', 409);
      if (input.op === 'verify') {
        const check = await new OpenCodeClient(a).check();
        if (check.version !== '2.0.24') throw new BridgeError('VERIFICATION_CONTRACT', '此版本工具禁止契约尚未核验', 409);
        if (!input.message || !/^只回复标记 AB_VERIFY_[a-f0-9]+，不要执行其他动作。$/.test(input.message)) throw new BridgeError('INVALID_VERIFY', '验证必须使用随机标记');
      }
      return request(client(), '/v1/tasks', { targetAgent: a.agentId, requestId: input.requestId, message: input.message, ...(input.op === 'continue' ? { conversationId: input.conversationId } : {}), ...(input.op === 'verify' ? { verification: true } : {}) });
    }
    if (input.op === 'tasks') return request(client(), '/v1/tasks?limit=100');
    if (input.op === 'request') return request(client(), '/v1/requests/' + encodeURIComponent(input.requestId || ''));
    if (!input.taskId) throw new BridgeError('INVALID_INPUT', 'Task ID required');
    const task = await request<Task>(client(), '/v1/tasks/' + encodeURIComponent(input.taskId));
    if (input.op === 'task') {
      if (task.verification && (terminal(task.status) || task.status === 'unknown') && settings.verifications[task.targetAgent]?.taskId !== task.taskId
        && (!settings.verifications[task.targetAgent]?.time || String(settings.verifications[task.targetAgent]?.time) <= (task.finishedAt || ''))) {
        const a = settings.agents.find(a => a.agentId === task.targetAgent)!;
        let session: Record<string, unknown> | undefined;
        try { if (task.native) session = await new OpenCodeClient(a).session(task.native.sessionId) as unknown as Record<string, unknown>; } catch { /* Unknown retains identity without claiming a verified native result. */ }
        const marker = task.message.match(/AB_VERIFY_[a-f0-9]+/)?.[0];
        save({ ...settings, verifications: { ...settings.verifications, [a.agentId]: { taskId: task.taskId, sessionId: task.native?.sessionId,
          time: task.finishedAt || task.updatedAt, fingerprint: task.configFingerprint, model: session?.model, nativeAgent: a.nativeAgent,
          status: task.status === 'unknown' ? 'unknown' : task.status === 'succeeded' && marker && task.result?.message.trim() === marker ? 'passed' : 'failed',
          tools: task.status === 'succeeded' ? 0 : 'not_confirmed' } } });
      }
      return task;
    }
    if (input.op === 'cancel' || input.op === 'reconcile') {
      if (input.op === 'cancel' && !input.operationId) throw new BridgeError('OPERATION_ID_REQUIRED', '取消前必须保存操作 ID');
      return request(client(), '/v1/tasks/' + task.taskId + '/' + input.op, { action: input.op, taskId: task.taskId, executionId: task.executionId, operationId: input.operationId || crypto.randomUUID() });
    }
    if (input.op === 'pending') return request(client(), '/v1/tasks/' + task.taskId + '/pending');
    if (input.op === 'operation') return request(client(), '/v1/tasks/' + task.taskId + '/operations/' + encodeURIComponent(input.operationId || ''));
    if (input.op === 'reply') return request(client(), '/v1/tasks/' + task.taskId + '/reply', input.reply);
    throw new BridgeError('INVALID_INPUT', 'Unsupported operation');
  };
  const path = socketPath(directory);
  if (process.platform !== 'win32' && Buffer.byteLength(path) > 100) { lock.close(); throw new BridgeError('IPC_PATH', '配置目录路径过长'); }
  if (process.platform !== 'win32' && dirname(path) !== resolve(directory)) { try { ensurePrivateDir(dirname(path)); } catch (e) { lock.close(); throw e; } }
  try {
    let existing: ReturnType<typeof lstatSync> | undefined;
    try { if(process.platform !== 'win32') existing = lstatSync(path); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    if (existing) {
      if (!existing.isSocket()) throw new BridgeError('IPC_PATH_OCCUPIED', 'IPC 路径已被其他文件占用', 409);
      const live = await new Promise<boolean>((done, reject) => {
        const socket = createConnection(path); const timer = setTimeout(() => { socket.destroy(); done(true); }, 1000);
        socket.once('connect', () => { clearTimeout(timer); socket.destroy(); done(true); });
        socket.once('error', (error: NodeJS.ErrnoException) => { clearTimeout(timer); socket.destroy(); if (error.code === 'ECONNREFUSED' || error.code === 'ENOENT') done(false); else reject(error); });
      });
      if (live) throw new BridgeError('IPC_IN_USE', 'IPC 路径有其他服务监听，拒绝接管或停止它', 409);
      rmSync(path);
    }
  } catch (e) { lock.close(); throw e; }
  const server = createServer(socket => {
    socket.setTimeout(65000, () => socket.destroy()); let data = ''; let processed = false;
    socket.on('error', () => {});
    socket.on('data', chunk => {
      if (processed) return; data += chunk.toString('utf8');
      if (Buffer.byteLength(data) > 524288) { processed = true; socket.end(JSON.stringify({ error: { code: 'IPC_LIMIT', message: 'IPC 请求过大', status: 413 } }) + '\n'); return; }
      const end = data.indexOf('\n'); if (end < 0) return; processed = true;
      const run = async () => {
        try { const input = ipcSchema.parse(JSON.parse(data.slice(0, end))); socket.end(safe(JSON.stringify({ data: await handle(input) })) + '\n'); }
        catch (e) { const error = e instanceof BridgeError ? e : new BridgeError('IPC_INVALID', '配置或请求格式错误'); socket.end(safe(JSON.stringify({ error: { code: error.code, message: error.message, status: error.httpStatus } })) + '\n'); }
      };
      // Reads never wait behind native mutation; configuration and admission serialize.
      let op: string | undefined; try { op = (JSON.parse(data.slice(0, end)) as { op?: string }).op; } catch { /* run classifies input */ }
      if (['save', 'default', 'start', 'check', 'submit', 'verify', 'continue'].includes(op || '')) { chain = chain.then(run, run); }
      else void run();
    });
  });
  const close = async () => {
    if (closing) return; closing = true;
    await new Promise<void>(done => server.close(() => done()));
    await chain; await edge?.close(); await hub?.close();
    for (const native of natives.values()) await native.handle.close();
    if(process.platform !== 'win32') rmSync(path, { force: true }); lock.close();
    process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop);
  };
  const stop = () => { void close(); };
  try { await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(path, () => done()); }); if(process.platform !== 'win32') chmodSync(path, 0o600); }
  catch (e) { lock.close(); throw e; }
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  if (settings.connectOnStart) { chain = chain.then(connect).catch(() => { console.error('CONNECT_FAILED: use status and check'); }); }
  return { close };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await startController(resolve(process.argv[2] || '.')); }
  catch (e) { console.error(e instanceof BridgeError ? e.code + ': ' + e.message : 'CONTROLLER_FAILED'); process.exitCode = 1; }
}
