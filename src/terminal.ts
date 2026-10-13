import { text, password, select, multiselect, isCancel, spinner, intro, type Option } from '@clack/prompts';
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { BridgeError, idSchema, terminal, type Task, type StoredEvent, type Conversation } from './core.js';
import { SettingsStore, stateDirectory } from './settings.js';
import { parseNativeModel } from './config.js';
import { ensureController, ipc, type IpcRequest } from './controller.js';
import type { NativePermission, NativeForm } from './drivers/opencode-client.js';
import { fieldsSchema, visible, validateAnswer, type Answer } from './drivers/forms.js';
import type { Operation } from './storage/operations.js';
import { canonicalJSON } from './security.js';
import { discoverOpenCode } from './discovery.js';

export function safeTerminal(text: string): string {
  return text.replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
}
interface AgentView {
  agentId: string; name: string; workspace: string; executable: string; managed: boolean; serverUrl: string;
  nativeAgent: string; model?: { providerID: string; id: string; variant?: string }; enabled: boolean;
  online: boolean; healthy: boolean; busy: boolean; available: boolean; default: boolean;
  desiredRevision: number; appliedRevision?: number; currentTask?: { taskId: string; status: string; summary: string };
  check?: Record<string, unknown>; verification?: Record<string, unknown>;
  startupError?: { code: string; message: string };
}
interface AgentList { connectionState?: string; revision: number; defaultAgent?: string; connected: boolean; items: AgentView[] }
const out = (text: string) => console.log(safeTerminal(text));
const states: Record<string, string> = { queued: '等待执行', accepted: '已接收', running: '执行中', succeeded: '已完成', failed: '失败', cancelled: '已取消', checking: '对账中', observing: '正在核对原轮次', reconnecting: '重连中', unknown: '执行结果待核对', private: '其他用户占用', confirmed: '已确认', rejected: '已拒绝', passed: '通过' };
const stateText = (value: string) => states[value] || value;
function connectionReason(a: AgentView): string | undefined {
  const code = a.startupError?.code || String(a.check?.code || '');
  const reasons: Record<string, string> = {
    NATIVE_OWNERSHIP: '原生服务归属无法确认；请核对旧服务，或在高级设置中连接已有服务。',
    NATIVE_EXECUTABLE: 'OpenCode 无法启动，请在高级设置中修正可执行文件路径。',
    NATIVE_EXITED: 'OpenCode 启动后退出，请检查项目配置或服务端口。',
    NATIVE_START_TIMEOUT: 'OpenCode 启动超时，可选择“重新连接”重试。',
    NATIVE_AUTH_STORAGE: '无法保存本机连接凭据，请检查配置目录权限。',
    NATIVE_AUTH_UNAVAILABLE: '连接凭据不可读，请检查高级设置中的密码文件路径。',
    OPENCODE_HTTP_401: 'OpenCode 拒绝连接认证，请检查已有服务的密码文件。',
    OPENCODE_HTTP_403: 'OpenCode 拒绝连接认证，请检查已有服务的密码文件。',
    NATIVE_UNAVAILABLE: 'OpenCode 服务暂时无法访问，可选择“重新连接”。',
    NATIVE_VERSION: '需要 OpenCode 2，请升级或在高级设置中选择正确路径。',
    WORKSPACE_UNAVAILABLE: '项目目录不可用，请在高级设置中修正目录。',
  };
  if (code) return reasons[code] || '连接检查未通过（' + code + '），请查看连接详情。';
  if (a.check?.nativeAgentConfiguration === 'unavailable') return '原生 Agent 不存在，请在高级设置中选择已安装的 Agent。';
  if (a.check?.modelConfiguration === 'unavailable') return 'OpenCode 尚未配置可用模型，请先在 OpenCode 中完成模型配置。';
  return undefined;
}
export function agentsText(list: AgentList): string {
  return ['\n连接概览 · ' + (list.connected ? '后台已启动' : list.connectionState === 'reconnecting' ? '连接中断，后台正在重连' : '后台未连接'),
    ...list.items.map(a => {
      const reason = connectionReason(a);
      const ready = a.online && a.healthy && !reason;
      const status = !a.enabled ? '已停用' : ready ? (a.busy ? a.currentTask?.status === 'unknown' ? '执行结果待核对' : '正在工作' : '已连接') : reason ? '连接失败' : '未连接';
      const model = a.model || a.check?.selectedModel as AgentView['model'];
      const verification = a.verification ? a.verification.stale ? '配置已变化，需要重新验证' : stateText(String(a.verification.status)) : '尚未进行真实回复验证';
      return `\n${ready ? '✓' : a.enabled ? '○' : '–'} ${a.name}${a.default ? '（默认）' : ''} · ${status}\n  项目：${a.workspace}\n  模型：${model ? model.providerID + '/' + model.id : '沿用 OpenCode 配置'}\n  回复验证：${verification}${reason ? '\n  原因：' + reason : ''}${a.currentTask ? '\n  当前任务：' + stateText(a.currentTask.status) : ''}`;
    }), list.items.length ? '' : '尚未添加连接。选择“发现并连接 Agent”开始。'].join('\n');
}
async function port(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => done()); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('port');
  await new Promise<void>(done => server.close(() => done())); return address.port;
}
class Prompts {
  closed = false;
  private readonly inputAbort = new AbortController();
  private readonly onEnd = () => this.close();
  private readonly onKey = (value: string | undefined, key: { ctrl?: boolean; name?: string }) => {
    if (value === '\x04' || key?.ctrl && key.name === 'd') this.close();
  };
  private readonly onInterrupt = () => { if (process.listenerCount('SIGINT') <= 1) this.close(); };
  constructor() {
    process.stdin.on('end', this.onEnd); process.stdin.on('keypress', this.onKey); process.on('SIGINT', this.onInterrupt);
  }
  private unwrap<T>(value: T | symbol): T {
    if (this.closed || isCancel(value)) { this.close(); throw new BridgeError('TERMINAL_CLOSED', '终端已退出，后台任务继续运行', 130); }
    return value as T;
  }
  async ask(label: string, fallback?: string, secret = false): Promise<string> {
    const options = { message: safeTerminal(label), signal: this.inputAbort.signal };
    const value = await (secret ? password(options) : text({ ...options, placeholder: fallback, defaultValue: fallback }));
    return this.unwrap<string>(value).trim() || fallback || '';
  }
  async choose(label: string, options: Option<string>[], initialValue?: string): Promise<string> {
    return this.unwrap<string>(await select({ message: safeTerminal(label) + '（↑↓ 选择，回车确认）', options: options.map(o => ({ ...o, label: safeTerminal(o.label || o.value), hint: o.hint ? safeTerminal(o.hint) : undefined })), initialValue, showInstructions: false, signal: this.inputAbort.signal }));
  }
  async detected(options: Option<string>[]): Promise<string[]> {
    return this.unwrap<string[]>(await multiselect({ message: '选择要连接的 Agent（空格勾选，回车连接）', options, required: true, showInstructions: false, signal: this.inputAbort.signal }));
  }
  async progress<T>(label: string, work: () => Promise<T>): Promise<T> {
    const s = spinner({ signal: this.inputAbort.signal, cancelMessage: '终端已退出，后台继续运行。' }); s.start(label);
    try { const value = await work(); s.stop(label + ' · 完成'); if (this.closed) this.unwrap(Symbol()); return value; }
    catch (e) { s.stop(label + ' · 未完成'); throw e; }
  }
  close() { this.closed = true; this.inputAbort.abort(); process.stdin.off('end', this.onEnd); process.stdin.off('keypress', this.onKey); process.off('SIGINT', this.onInterrupt); }
}
async function advancedWizard(directory: string, prompts: Prompts, old?: AgentView): Promise<void> {
  const list = await ipc<AgentList>(directory, { op: 'agents' });
  out(old ? '编辑连接；运行或 unknown 时只能改名称/启停。' : 'OpenCode 连接向导（当前支持 OpenCode 2）');
  const name = await prompts.ask('连接名称', old?.name || 'OpenCode');
  const agentId = old?.agentId || 'opencode-' + randomBytes(3).toString('hex');
  if (old?.busy) {
    const enabled = (await prompts.ask('启用? y/n', old.enabled ? 'y' : 'n')) === 'y';
    await ipc(directory, { op: 'save', expectedRevision: list.revision, agent: { agentId, name, enabled } }); return;
  }
  const installed = resolve(homedir(), '.opencode/bin/opencode');
  const executable = await prompts.ask('OpenCode 可执行文件', old?.executable || (existsSync(installed) ? installed : 'opencode'));
  try { const result = await promisify(execFile)(executable, ['--version'], { timeout: 10000, maxBuffer: 65536 }); out('发现 OpenCode 版本: ' + result.stdout.trim().slice(0, 100)); }
  catch { out('尚未发现可用可执行文件；可以保存草稿，修正路径后再连接。'); }
  const workspace = resolve(await prompts.ask('项目目录', old?.workspace || process.cwd()));
  const managed = (await prompts.ask('连接方式: 1 后台管理本机进程，2 已有本机服务', old && !old.managed ? '2' : '1')) !== '2';
  let serverUrl: string; let passwordFile: string | undefined;
  if (managed) serverUrl = old?.managed ? old.serverUrl : 'http://127.0.0.1:' + await port();
  else { serverUrl = await prompts.ask('已有服务地址（仅 loopback HTTP）', old?.serverUrl); passwordFile = await prompts.ask('原生密码文件路径（不输入密码明文）'); }
  const modelText = await prompts.ask('模型: inherit 继承原生；覆盖用 provider/model#variant', old?.model ? old.model.providerID + '/' + old.model.id + (old.model.variant ? '#' + old.model.variant : '') : 'inherit');
  const nativeAgent = await prompts.ask('原生 Agent', old?.nativeAgent || 'build');
  const askEdits = (await prompts.ask('文件修改需要逐次确认? y/n', 'y')) === 'y';
  const enabled = (await prompts.ask('启用? y/n', old?.enabled === false ? 'n' : 'y')) === 'y';
  const agent: Record<string, unknown> = { agentId, name, adapter: 'opencode', workspace, executable, managed, serverUrl, nativeAgent, enabled,
    model: modelText === 'inherit' ? undefined : parseNativeModel(modelText) };
  agent.permissions = askEdits ? [{ action: 'edit', resource: '*', effect: 'ask' }] : [];
  // Removing an override must be explicit in JSON transport.
  if (modelText === 'inherit') agent.model = null;
  if (!old || !managed) agent.passwordFile = passwordFile || resolve(directory, agentId + '.password');
  out(`连接: ${name} (${agentId})\n项目: ${workspace}\n服务: ${serverUrl}\n模型: ${modelText}`);
  const choice = await prompts.ask('1 保存草稿，2 保存并连接，0 放弃', '1');
  if (choice === '0') return;
  if (choice === '1') agent.enabled = false;
  await ipc(directory, { op: 'save', expectedRevision: list.revision, agent });
  out('已保存。保存本身不发送模型请求。');
  if (choice === '2') await connectAgents(directory, prompts);
}
async function connectAgents(directory: string, prompts: Prompts): Promise<void> {
  await prompts.progress('连接 OpenCode', async () => {
    const list = await ipc<AgentList>(directory, { op: 'start' });
    for (const a of list.items.filter(a => a.enabled)) await ipc(directory, { op: 'check', agentId: a.agentId });
  });
  const list = await ipc<AgentList>(directory, { op: 'agents' });
  out(agentsText(list));
  for (const a of list.items.filter(a => a.enabled)) {
    const reason = connectionReason(a);
    if (a.online && a.healthy && !reason) out('✓ 已连接 ' + a.name + (a.busy ? '，当前任务可在连续会话中查看。' : '，可以提交任务。'));
    else out('连接未完成：' + a.name + '。' + (reason || '请稍后选择“重新连接”重试。'));
  }
}
async function quickSetup(directory: string, prompts: Prompts): Promise<void> {
  const detected = await prompts.progress('自动发现已安装的 Agent', () => discoverOpenCode());
  if (!detected.length) {
    out('未发现可用的 OpenCode 2。已检查 PATH 和 ~/.opencode/bin。');
    const action = await prompts.choose('下一步', [{ value: 'manual', label: '手动指定 OpenCode 路径' }, { value: 'back', label: '返回' }]);
    if (action === 'manual') await advancedWizard(directory, prompts);
    return;
  }
  out('发现 OpenCode ' + detected[0]!.version + '\n项目：' + process.cwd() + '\n使用 OpenCode 已有模型配置；后台自动管理连接。');
  const selected = await prompts.detected(detected.map(a => ({ value: a.executable, label: a.name + ' ' + a.version, hint: safeTerminal(a.executable) })));
  for (const executable of selected) {
    const list = await ipc<AgentList>(directory, { op: 'agents' });
    const existing = list.items.find(a => a.workspace === process.cwd());
    if (existing) {
      if (!existing.enabled) await ipc(directory, { op: 'save', expectedRevision: list.revision, agent: { agentId: existing.agentId, enabled: true } });
    } else {
      const agentId = 'opencode-' + randomBytes(3).toString('hex');
      await ipc(directory, { op: 'save', expectedRevision: list.revision, agent: {
        agentId, name: 'OpenCode · ' + basename(process.cwd()), adapter: 'opencode', workspace: process.cwd(), executable,
        managed: true, enabled: true, serverUrl: 'http://127.0.0.1:' + await port(), passwordFile: resolve(directory, agentId + '.password'),
        nativeAgent: 'build', permissions: [{ action: 'edit', resource: '*', effect: 'ask' }],
      } });
    }
  }
  await connectAgents(directory, prompts);
}
function retain(directory: string, kind: 'requests' | 'operations', id: string, input: unknown): void {
  const target = resolve(directory, kind); mkdirSync(target, { recursive: true, mode: 0o700 });
  const path = resolve(target, id + '.json');
  try { writeFileSync(path, JSON.stringify(input, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    if (canonicalJSON(JSON.parse(readFileSync(path, 'utf8'))) !== canonicalJSON(input)) throw new BridgeError('REQUEST_CONFLICT', '持久请求已绑定不同内容', 409);
  }
}
async function replyWaiting(directory: string, prompts: Prompts, task: Task, seen: Set<string>): Promise<void> {
  const pending = await ipc<{ permissions: NativePermission[]; forms: NativeForm[] }>(directory, { op: 'pending', taskId: task.taskId });
  for (const permission of pending.permissions) {
    if (seen.has(permission.id)) continue; seen.add(permission.id);
    out('权限请求: ' + permission.action + '\n资源: ' + permission.resources.join(', '));
    const choice = await prompts.choose('如何处理这次权限请求？', [{ value: '0', label: '暂不回复' }, { value: '1', label: '仅允许本次' }, { value: '2', label: '拒绝' }], '0');
    if (!['1', '2'].includes(choice)) continue;
    const operationId = randomUUID();
    const reply = { taskId: task.taskId, executionId: task.executionId, operationId, action: 'permission' as const, requestId: permission.id, decision: choice === '1' ? 'once' as const : 'reject' as const };
    retain(directory, 'operations', operationId, reply); 
    const receipt = await ipc<Operation>(directory, { op: 'reply', taskId: task.taskId, reply });
    out('回复收据: ' + stateText(receipt.state) + '（任务完成情况继续观察）');
  }
  for (const form of pending.forms) {
    if (seen.has(form.id)) continue; seen.add(form.id);
    out('原生表单: ' + form.title);
    const fields = fieldsSchema.parse(form.fields); const answer: Answer = {};
    for (const f of fields) {
      if (!visible(f, answer)) continue;
      if (f.type === 'external') { out('此表单包含外部链接，当前 CLI 不代开页面。'); return; }
      if (f.options) out(f.options.map(o => o.value + ': ' + o.label).join('\n'));
      const sensitive = /password|secret|token|api.?key|密码|密钥/i.test(f.key + ' ' + (f.title || '')) || f.format === 'password';
      const value = await prompts.ask((f.title || f.key) + (f.required ? '（必填）' : '') + (f.type === 'boolean' ? ' true/false' : f.type === 'multiselect' ? '（逗号分隔）' : ''), undefined, sensitive);
      if (!value && !f.required) continue;
      if (f.type === 'boolean' && !['true', 'false'].includes(value)) throw new BridgeError('INVALID_ANSWER', '布尔字段需输入 true 或 false');
      answer[f.key] = f.type === 'boolean' ? value === 'true' : f.type === 'integer' || f.type === 'number' ? Number(value) : f.type === 'multiselect' ? value.split(',').map(v => v.trim()) : value;
    }
    validateAnswer(form.fields, answer);
    if (await prompts.ask('发送这份表单? y/n', 'n') !== 'y') continue;
    const operationId = randomUUID(); const reply = { taskId: task.taskId, executionId: task.executionId, operationId, action: 'form' as const, requestId: form.id, answer };
    retain(directory, 'operations', operationId, reply); 
    out('回复收据: ' + stateText((await ipc<Operation>(directory, { op: 'reply', taskId: task.taskId, reply })).state));
  }
}
async function watch(directory: string, taskId: string, prompts?: Prompts, json = false, timeout?: number): Promise<number> {
  let interrupted = false; const stop = () => { interrupted = true; };
  process.once('SIGINT', stop); const start = Date.now(); let seq = 0; let prior = ''; const seen = new Set<string>();
  let pendingReadError = ''; const displayedAnswers = new Set<string>();
  if (!json) out('正在观察任务；Ctrl+C 结束观察，后台任务继续运行。');
  try {
    while (!interrupted && !prompts?.closed) {
      const task = await ipc<Task & { events?: StoredEvent[] }>(directory, { op: 'task', taskId });
      if (json) { const text = JSON.stringify(task); if (text !== prior) console.log(text); prior = text; }
      else {
        if (prior !== task.status + ':' + JSON.stringify(task.waiting)) { out('任务：' + stateText(task.status) + (task.waiting ? task.waiting.kind === 'permission' ? ' · 等待授权' : ' · 等待输入' : '')); prior = task.status + ':' + JSON.stringify(task.waiting); }
        for (const event of task.events || []) if (event.seq > seq && ['output', 'progress'].includes(event.event.kind)) {
          const text = (event.event as { text: string }).text;
          if (event.event.kind === 'output') displayedAnswers.add(text);
          out(text === 'OpenCode accepted the prompt; waiting for actual execution' ? 'OpenCode 已接收任务，等待实际执行。'
            : text.replace(/^Tool ([^ ]+) \[([^\]]+)\]/, (_, name: string, status: string) => '工具 ' + name + ' · ' + ({ streaming: '执行中', running: '执行中', completed: '完成', error: '失败' }[status] || status)));
        }
        seq = task.lastSeq;
      }
      if (terminal(task.status) || task.status === 'unknown') {
        if (!json && (!task.result || !displayedAnswers.has(task.result.message))) out(task.result?.message || task.error?.message || task.uncertaintyReason || task.lastSummary);
        return task.status === 'succeeded' ? 0 : task.status === 'unknown' ? 3 : 1;
      }
      if (prompts && task.waiting) {
        try { await replyWaiting(directory, prompts, task, seen); pendingReadError = ''; }
        catch (e) {
          if (!(e instanceof BridgeError) || !['NATIVE_UNAVAILABLE', 'STALE_TASK', 'NATIVE_BINDING', 'OPERATION_UNKNOWN'].includes(e.code)) throw e;
          if (pendingReadError !== e.code) out(e.code + ': 等待项暂时无法读取，继续核验任务状态；不会补发回复。');
          pendingReadError = e.code;
        }
      }
      if (timeout && Date.now() - start >= timeout) { out('观察超时；后台任务继续运行。'); return 3; }
      await delay(200);
    }
    return 130;
  } finally { process.removeListener('SIGINT', stop); }
}
async function submit(directory: string, message: string, agentId?: string, verify = false, requestId: string = randomUUID(), conversationId?: string, quiet = false): Promise<Task> {
  if (!idSchema.safeParse(requestId).success) throw new BridgeError('INVALID_REQUEST_ID', '请求 ID 格式无效');
  const input: IpcRequest = { op: conversationId ? 'continue' : verify ? 'verify' : 'submit', message, agentId, requestId, ...(conversationId ? { conversationId } : {}) };
  const retained = resolve(directory, 'requests', requestId + '.json');
  if (existsSync(retained)) {
    const old = JSON.parse(readFileSync(retained, 'utf8')) as IpcRequest;
    if (canonicalJSON(old) !== canonicalJSON(input)) throw new BridgeError('REQUEST_CONFLICT', '原请求 ID 已绑定不同输入', 409);
  } else retain(directory, 'requests', requestId, input);
  if (!quiet) console.error('Request ID: ' + requestId + '（已保存；超时后查询这个 ID）');
  return ipc<Task>(directory, input);
}
async function cancelTask(directory: string, task: Task, operationId: string = randomUUID()): Promise<Operation> {
  if (!idSchema.safeParse(operationId).success) throw new BridgeError('INVALID_OPERATION_ID', '操作 ID 格式无效');
  const input: IpcRequest = { op: 'cancel', taskId: task.taskId, operationId };
  const path = resolve(directory, 'operations', operationId + '.json');
  if (existsSync(path)) {
    if (canonicalJSON(JSON.parse(readFileSync(path, 'utf8'))) !== canonicalJSON(input)) throw new BridgeError('OPERATION_CONFLICT', '原操作 ID 已绑定其他任务', 409);
  } else retain(directory, 'operations', operationId, input);
  return ipc<Operation>(directory, input);
}
async function conversationsMenu(directory: string, prompts: Prompts): Promise<void> {
  const { items } = await ipc<{ items: Conversation[] }>(directory, { op: 'conversations' });
  if (!items.length) { out('暂无会话。提交第一条任务会自动建立会话。'); return; }
  const id = await prompts.choose('选择会话', [...items.slice(0, 30).map(c => ({ value: c.conversationId, label: c.title.slice(0, 65), hint: c.turns + ' 轮 · ' + (c.native?.workspace || '') })), { value: 'back', label: '返回' }]);
  if (id === 'back') return;
  for (;;) {
    const conversation = await ipc<Conversation & { items: Task[] }>(directory, { op: 'conversation', conversationId: id });
    const task = conversation.items.at(-1)!;
    out('\n会话：' + conversation.title + '\n' + conversation.items.map(t => '第 ' + (t.turn || 1) + ' 轮 · ' + stateText(t.status) + ' · ' + t.message.slice(0, 80)).join('\n'));
    if (task.result) out('最近回答：\n' + task.result.message);
    if (task.uncertaintyReason) out('待核对原因：' + task.uncertaintyReason);
    if (task.reconciliation) out('对账：' + stateText(task.reconciliation.state) + ' · ' + task.reconciliation.reason);
    const action = await prompts.choose('会话操作', [
      ...(terminal(task.status) ? [{ value: 'continue', label: '继续追问' }] : [{ value: 'observe', label: '继续观察当前轮次' }, { value: 'cancel', label: '取消当前轮次', hint: '中断执行，已发生的修改不会自动撤销' }, { value: 'reconcile', label: '只读核对 / 恢复观察' }]),
      { value: 'history', label: '查看历史轮次' }, { value: 'back', label: '返回主菜单' },
    ]);
    if (action === 'back') return;
    try {
      if (action === 'continue') { const message = await prompts.ask('继续追问'); if (message) { const next = await submit(directory, message, undefined, false, undefined, id, true); await watch(directory, next.taskId, prompts); } }
      if (action === 'observe') await watch(directory, task.taskId, prompts);
      if (action === 'cancel') {
        const receipt = await prompts.progress('发送取消请求', () => cancelTask(directory, task));
        out('取消收据：' + stateText(receipt.state) + '。正在核对原生中断证据。');
        await watch(directory, task.taskId, prompts, false, 10000);
      }
      if (action === 'reconcile') {
        const result = await prompts.progress('只读对账', () => ipc<{ state: string; reason: string }>(directory, { op: 'reconcile', taskId: task.taskId }));
        out(result.reason); await watch(directory, task.taskId, prompts, false, 10000);
      }
      if (action === 'history') {
        const chosen = await prompts.choose('选择轮次', conversation.items.map(t => ({ value: t.taskId, label: '第 ' + (t.turn || 1) + ' 轮 · ' + stateText(t.status) + ' · ' + t.message.slice(0, 65) })));
        await watch(directory, chosen, prompts);
      }
    } catch (e) { if (prompts.closed) throw e; out(e instanceof BridgeError ? e.message : '操作未完成，请检查连接。'); }
  }
}
async function menu(directory: string, prompts: Prompts): Promise<number> {
  for (;;) {
    const list = await ipc<AgentList>(directory, { op: 'agents' }); out('\n' + agentsText(list));
    const choice = await prompts.choose('下一步', [
      { value: '7', label: '提交任务', hint: '输入需求，让 Agent 开始工作' },
      { value: '8', label: '查看最近任务' },
      { value: '1', label: '发现并连接 Agent' },
      { value: '5', label: '检查连接', hint: '只读检查，不调用模型' },
      { value: '6', label: '验证真实回复', hint: '产生一次模型调用' },
      { value: '4', label: '重新连接' },
      { value: '3', label: '选择默认 Agent' },
      { value: '2', label: '高级设置 / 启停连接' },
      { value: '9', label: '持续查看连接' },
      { value: '10', label: '连续会话 / 任务控制', hint: '续问、取消当前轮次、只读对账' },
      { value: '0', label: '退出', hint: '后台继续运行' },
    ], list.items.some(a => a.enabled) ? '7' : '1');
    try {
      if (choice === '0') { out('终端已退出，后台继续运行。停止后台用 agentbridge service stop。'); return 0; }
      if (choice === '1') { await quickSetup(directory, prompts); continue; }
      if (choice === '4') { await connectAgents(directory, prompts); continue; }
      if (choice === '9') { out('持续查看状态，Ctrl+C 返回菜单。'); await watchAgents(directory, false); continue; }
      if (choice === '10') { await conversationsMenu(directory, prompts); continue; }
      if (choice === '8') {
        const page = await ipc<{ items: Task[] }>(directory, { op: 'tasks' });
        const tasks = page.items.slice(-20).reverse();
        if (!tasks.length) { out('暂无任务。选择“提交任务”开始。'); continue; }
        const id = await prompts.choose('选择要查看的任务', [...tasks.map(t => ({ value: t.taskId, label: stateText(t.status) + ' · ' + t.message.slice(0, 65), hint: list.items.find(a => a.agentId === t.targetAgent)?.name })), { value: 'back', label: '返回' }]);
        if (id !== 'back') await watch(directory, id, prompts); continue;
      }
      if (!list.items.length) { out('尚无连接，请先选择“发现并连接 Agent”。'); continue; }
      const id = list.items.length === 1 ? list.items[0]!.agentId : await prompts.choose('选择 Agent', list.items.map(a => ({ value: a.agentId, label: a.name + (a.default ? '（默认）' : ''), hint: a.workspace })), list.defaultAgent);
      const a = list.items.find(a => a.agentId === id);
      if (!a) throw new BridgeError('AGENT_NOT_FOUND', '连接不存在', 404);
      if (choice === '2') {
        const action = await prompts.choose(a.name, [{ value: 'toggle', label: a.enabled ? '停用此连接' : '启用并连接' }, { value: 'edit', label: '修改高级配置' }, { value: 'add', label: '手动添加连接' }, { value: 'back', label: '返回' }]);
        if (action === 'edit') await advancedWizard(directory, prompts, a);
        if (action === 'add') await advancedWizard(directory, prompts);
        if (action === 'toggle') { await ipc(directory, { op: 'save', expectedRevision: list.revision, agent: { agentId: id, enabled: !a.enabled } }); if (!a.enabled) await connectAgents(directory, prompts); }
      }
      if (choice === '3') await ipc(directory, { op: 'default', agentId: id, expectedRevision: list.revision });
      if (choice === '5') {
        await prompts.progress('检查 ' + a.name, () => ipc(directory, { op: 'check', agentId: id }));
        out(agentsText(await ipc<AgentList>(directory, { op: 'agents' })));
        out('本次只读检查没有调用模型；需要确认实际回复时选择“验证真实回复”。');
      }
      if (choice === '6') {
        out('验证会产生一次真实模型调用，禁止工具。');
        if (await prompts.ask('执行验证? y/n', 'n') === 'y') {
          const task = await submit(directory, '只回复标记 AB_VERIFY_' + randomBytes(12).toString('hex') + '，不要执行其他动作。', id, true, undefined, undefined, true); await watch(directory, task.taskId, prompts);
        }
      }
      if (choice === '7') { const text = await prompts.ask('任务需求'); if (text) { const task = await submit(directory, text, id, false, undefined, undefined, true); await watch(directory, task.taskId, prompts); } }
    } catch (e) { if (prompts.closed) return 130; out(e instanceof BridgeError ? e.message : '操作未完成，请检查输入。'); }
  }
}
async function watchAgents(directory: string, json: boolean): Promise<number> {
  let done = false; const stop = () => { done = true; }; process.once('SIGINT', stop); let prior = '';
  try { while (!done) { const list = await ipc<AgentList>(directory, { op: 'agents' }); const text = json ? JSON.stringify(list) : agentsText(list); if (text !== prior) { out(text); prior = text; } await delay(250); } return 130; }
  finally { process.removeListener('SIGINT', stop); }
}
export async function terminalCommand(argv: string[]): Promise<number | undefined> {
  const { values: v, positionals: p } = parseArgs({ args: argv, allowPositionals: true, strict: false, options: { dir: { type: 'string' }, config: { type: 'string' }, import: { type: 'string' }, advanced: { type: 'boolean' }, json: { type: 'boolean' }, watch: { type: 'boolean' }, 'request-id': { type: 'string' }, 'operation-id': { type: 'string' }, 'timeout-ms': { type: 'string' }, help: { type: 'boolean', short: 'h' }, stdin: { type: 'boolean' }, file: { type: 'string' }, diagnostics: { type: 'boolean' } } });
  if (v.help) return undefined;
  const directory = stateDirectory(v.dir as string | undefined); const store = new SettingsStore(directory);
  if (!p.length && !process.stdin.isTTY) return undefined;
  if (p[0] === 'service') {
    if (!['status', 'stop'].includes(p[1] || '') || p.length !== 2) throw new BridgeError('INVALID_ARGUMENT', '使用 service status 或 service stop');
    try { const status = await ipc(directory, { op: 'status' }); const result = p[1] === 'stop' ? await ipc(directory, { op: 'stop' }) : status; out(v.json ? JSON.stringify(result) : p[1] === 'stop' ? '后台正在停止。' : '后台正在运行。\n' + ((result as { connected?: boolean }).connected ? '连接正常' : '连接未就绪') + '\n状态目录：' + directory); } catch (e) { if (e instanceof BridgeError && e.code === 'CONTROLLER_OFFLINE') { out('后台未运行。'); return 0; } throw e; } return 0;
  }
  const interactive = p.length === 0 || p[0] === 'setup';
  if (interactive) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new BridgeError('TTY_REQUIRED', 'setup 向导需要交互终端');
    if (p.length > 1) throw new BridgeError('INVALID_ARGUMENT', 'setup 不接受位置参数');
    const prompts = new Prompts();
    try {
      intro('AgentBridge');
      const fresh = !store.exists();
      if (v.import && fresh) {
        let preview: { agents?: { agentId: string; name: string; workspace: string; model?: unknown }[] };
        try { preview = JSON.parse(readFileSync(resolve(String(v.import), 'edge-a.json'), 'utf8')); }
        catch { throw new BridgeError('IMPORT_READ', '无法读取旧连接配置'); }
        out('原地导入预览（历史和凭据保持原位置）:\n' + (preview.agents || []).map(a => a.name + ' · ' + a.workspace + ' · ' + (a.model ? '已有模型配置' : '沿用 OpenCode 模型')).join('\n'));
        if (await prompts.ask('确认导入? y/n', 'n') !== 'y') return 0;
      }
      store.initialize(v.import as string | undefined); await ensureController(directory);
      if (v.import) await connectAgents(directory, prompts);
      else if (v.advanced) await advancedWizard(directory, prompts);
      else if (p[0] === 'setup' || !store.read().agents.length) await quickSetup(directory, prompts);
      else if (store.read().agents.some(a => a.enabled)) await connectAgents(directory, prompts);
      if (p[0] === 'setup') return 0; return await menu(directory, prompts);
    }
    finally { prompts.close(); }
  }
  if (v.config || !store.exists() || !['agents', 'run', 'task', 'tasks', 'request', 'operation', 'native', 'conversations', 'conversation', 'continue', 'cancel', 'reconcile'].includes(p[0] || '')) return undefined;
  const supported: Record<string, string[]> = { agents: ['dir', 'json', 'watch'], run: ['dir', 'json', 'watch', 'request-id', 'timeout-ms', 'stdin', 'file'], task: ['dir', 'json', 'watch', 'timeout-ms', 'diagnostics'], tasks: ['dir', 'json'], request: ['dir', 'json'], operation: ['dir', 'json'], native: ['dir', 'json'], conversations: ['dir', 'json'], conversation: ['dir', 'json'], continue: ['dir', 'json', 'watch', 'request-id', 'timeout-ms'], cancel: ['dir', 'json', 'operation-id'], reconcile: ['dir', 'json'] };
  for (const [key, value] of Object.entries(v)) if (value !== undefined && !supported[p[0]!]!.includes(key)) throw new BridgeError('INVALID_ARGUMENT', '此命令不支持 --' + key);
  if (v['timeout-ms'] && (!v.watch || !Number.isInteger(Number(v['timeout-ms'])) || Number(v['timeout-ms']) <= 0)) throw new BridgeError('INVALID_ARGUMENT', '--timeout-ms 需要 --watch 和正整数');
  await ensureController(directory);
  if (['continue', 'cancel', 'reconcile'].includes(p[0]!)) {
    const status = await ipc<{ connected: boolean }>(directory, { op: 'status' });
    if (!status.connected) await ipc(directory, { op: 'start' });
  }
  if (p[0] === 'conversations' || p[0] === 'conversation') {
    if (p.length !== (p[0] === 'conversations' ? 1 : 2)) throw new BridgeError('INVALID_ARGUMENT', '使用 conversations 或 conversation ID');
    const data = await ipc(directory, { op: p[0], conversationId: p[1] });
    if (v.json) out(JSON.stringify(data));
    else if (p[0] === 'conversations') out((data as { items: Conversation[] }).items.map(c => c.conversationId + ' · ' + c.turns + ' 轮 · ' + c.title).join('\n') || '暂无会话。');
    else { const c = data as Conversation & { items: Task[] }; out(c.title + '\n' + c.items.map(t => '第 ' + (t.turn || 1) + ' 轮 · ' + stateText(t.status) + '\n' + t.message + '\n' + (t.result?.message || t.uncertaintyReason || t.lastSummary)).join('\n\n')); }
    return 0;
  }
  if (p[0] === 'cancel' || p[0] === 'reconcile') {
    if (p.length !== 2) throw new BridgeError('INVALID_ARGUMENT', '使用 ' + p[0] + ' TASK_ID');
    const task = await ipc<Task>(directory, { op: 'task', taskId: p[1] });
    const data = p[0] === 'cancel' ? await cancelTask(directory, task, v['operation-id'] as string | undefined) : await ipc<{ state: string; reason: string }>(directory, { op: 'reconcile', taskId: task.taskId });
    out(v.json ? JSON.stringify(data) : p[0] === 'cancel' ? '取消收据：' + stateText((data as Operation).state) + '。任务终态请查看 task。' : (data as { reason: string }).reason);
    return 'state' in data && data.state === 'unknown' ? 3 : 0;
  }
  if (p[0] === 'agents') { if (v.watch) return watchAgents(directory, !!v.json); const list = await ipc<AgentList>(directory, { op: 'agents' }); out(v.json ? JSON.stringify(list) : agentsText(list)); return 0; }
  if (p[0] === 'tasks') { const data = await ipc<{ items: Task[] }>(directory, { op: 'tasks' }); out(v.json ? JSON.stringify(data) : data.items.map(t => stateText(t.status) + ' · ' + t.message.slice(0, 100) + '\n  任务 ID：' + t.taskId).join('\n') || '暂无任务。'); return 0; }
  if (p[0] === 'request') { if (p.length !== 2) throw new BridgeError('INVALID_ARGUMENT', '使用 request REQUEST_ID'); out(JSON.stringify(await ipc(directory, { op: 'request', requestId: p[1] }), null, 2)); return 0; }
  if (p[0] === 'operation') { if (p.length !== 3) throw new BridgeError('INVALID_ARGUMENT', '使用 operation TASK_ID OPERATION_ID'); out(JSON.stringify(await ipc(directory, { op: 'operation', taskId: p[1], operationId: p[2] }), null, 2)); return 0; }
  if (p[0] === 'native') { if (p.length !== 2) throw new BridgeError('INVALID_ARGUMENT', '使用 native TASK_ID --dir PATH 查看等待；交互回复用 task TASK_ID --watch'); out(JSON.stringify(await ipc(directory, { op: 'pending', taskId: p[1] }), null, 2)); return 0; }
  let task: Task;
  if (p[0] === 'continue') {
    if (p.length !== 3 || !p[2]?.trim() || Buffer.byteLength(p[2]) > 65536) throw new BridgeError('INVALID_ARGUMENT', '使用 continue CONVERSATION_ID MESSAGE');
    task = await submit(directory, p[2], undefined, false, v['request-id'] as string | undefined, p[1]);
  } else if (p[0] === 'run') {
    let message: string, agentId: string | undefined;
    if (v.stdin || v.file) {
      if (v.stdin && v.file || p.length > 2) throw new BridgeError('INVALID_ARGUMENT', '请选择 --stdin 或 --file，并可指定一个 Agent');
      let bytes: Buffer;
      if (v.file) { const path = resolve(String(v.file)); if (statSync(path).size > 65536) throw new BridgeError('INVALID_MESSAGE', '消息文件超过 64 KiB'); bytes = readFileSync(path); }
      else { const chunks: Buffer[] = []; let size = 0; for await (const raw of process.stdin) { const chunk = Buffer.from(raw); size += chunk.length; if (size > 65536) throw new BridgeError('INVALID_MESSAGE', 'stdin 超过 64 KiB'); chunks.push(chunk); } bytes = Buffer.concat(chunks); }
      try { message = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new BridgeError('INVALID_MESSAGE', '消息必须为 UTF-8'); }
      agentId = p[1];
    } else { if (p.length !== 2 && p.length !== 3) throw new BridgeError('INVALID_ARGUMENT', '使用 run [AGENT] MESSAGE'); message = p.length === 3 ? p[2]! : p[1]!; agentId = p.length === 3 ? p[1] : undefined; }
    if (!message.trim() || Buffer.byteLength(message) > 65536) throw new BridgeError('INVALID_MESSAGE', '消息不能为空或超过 64 KiB');
    task = await submit(directory, message, agentId, false, v['request-id'] as string | undefined);
  } else { if (p.length !== 2) throw new BridgeError('INVALID_ARGUMENT', '使用 task TASK_ID'); task = await ipc<Task>(directory, { op: 'task', taskId: p[1] }); }
  if (!v.watch) { out(v.json ? JSON.stringify(task) : '任务：' + stateText(task.status) + '\n需求：' + task.message + (task.result ? '\n回答：\n' + task.result.message : '') + (task.error ? '\n原因：' + task.error.message : '') + (task.uncertaintyReason ? '\n待核对：' + task.uncertaintyReason : '') + '\n任务 ID：' + task.taskId + '\n会话 ID：' + task.conversationId); return 0; }
  const prompts = !v.json && process.stdin.isTTY && process.stdout.isTTY ? new Prompts() : undefined;
  try { return await watch(directory, task.taskId, prompts, !!v.json, v['timeout-ms'] ? Number(v['timeout-ms']) : undefined); } finally { prompts?.close(); }
}
