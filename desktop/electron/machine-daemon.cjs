const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { FramedStream, MAX_FRAME_BYTES } = require('./machine-protocol.cjs');

const PROTOCOL_VERSION = 2;
// Checkout uses desktop/package.json; the staged Linux bundle owns its root package.json.
const versionFile = fs.existsSync(path.join(__dirname,'../package.json')) ? path.join(__dirname,'../package.json') : path.join(__dirname,'../../package.json');
const {runtimeCapabilities}=require('./runtime-capabilities.cjs');
const VERSION = JSON.parse(fs.readFileSync(versionFile,'utf8')).version;
const MAX_INFLIGHT = 64;
const fail = (code, message) => Object.assign(new Error(message), { code });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const now = () => new Date().toISOString();
const own = value => value && Object.getPrototypeOf(value) === Object.prototype;
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value);
const methods = new Set(['mcp.status', 'mcp.install', 'mcp.remove', 'mcp.export', 'snapshot', 'discover', 'context', 'scope', 'ipc', 'environment', 'connect']);
const mutations = new Set(['submit', 'continue', 'verify', 'reply', 'cancel']);
const knownRejections = new Set(['INVALID_INPUT', 'REQUEST_CONFLICT', 'AGENT_BUSY', 'AGENT_UNHEALTHY', 'TASK_NOT_FOUND', 'CONVERSATION_NOT_FOUND', 'CONVERSATION_CONFIG', 'CONVERSATION_BUSY', 'EXECUTION_MISMATCH', 'REQUEST_NOT_FOUND', 'STALE_OPERATION', 'PERMISSION_NOT_FOUND', 'PERMISSION_REPLIED', 'NODE_NOT_FOUND', 'WORKSPACE_UNAVAILABLE', 'DISCOVERY_CHANGED', 'NOT_CONFIGURED', 'ADAPTER_UNSUPPORTED']);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (own(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function safeError(error) {
  const code = typeof error?.code === 'string' && /^[A-Z][A-Z_]{1,60}$/.test(error.code) ? error.code : 'DAEMON_REQUEST';
  const message = typeof error?.message === 'string' ? error.message.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, 2000) : '后台请求未完成；请查询原请求。';
  return { code, message };
}
function validateOptions(options) {
  if (process.platform !== 'linux') throw fail('DAEMON_PLATFORM', '远端 Daemon 仅支持 Linux。');
  if (!validId(options.ownerCoordinatorId || options.owner) || !validId(options.profileId || options.profile)) throw fail('DAEMON_IDENTITY', '中央后台或 profile 身份无效。');
  if (typeof options.stateDirectory !== 'string' || !path.isAbsolute(options.stateDirectory) || /[\0\r\n]/.test(options.stateDirectory)) throw fail('DAEMON_STATE', '后台状态目录必须是绝对 Linux 路径。');
  return { ...options, stateDirectory: path.resolve(options.stateDirectory), ownerCoordinatorId: options.ownerCoordinatorId || options.owner, profileId: options.profileId || options.profile };
}
function inspectFile(file, kind, privateMode = true) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || stat.uid !== process.getuid() || (kind === 'file' && !stat.isFile()) || (kind === 'directory' && !stat.isDirectory()) || (kind === 'socket' && !stat.isSocket()) || (privateMode && (stat.mode & 0o077))) throw fail('DAEMON_OWNERSHIP', '后台路径类型、拥有者或私有权限不正确。');
  return stat;
}
function privateDirectory(directory) {
  const parts = path.resolve(directory).split(path.sep).filter(Boolean);
  let current = path.parse(directory).root;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try { fs.mkdirSync(current, { mode: 0o700 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
      stat = fs.lstatSync(current);
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw fail('DAEMON_OWNERSHIP', '后台状态目录不能穿过符号链接或普通文件。');
    if (index === parts.length - 1 && (stat.uid !== process.getuid() || stat.mode & 0o077)) throw fail('DAEMON_OWNERSHIP', '后台状态目录必须由当前用户拥有且权限为 0700。');
  }
  return directory;
}
function atomicJson(file, value) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  const descriptor = fs.openSync(temporary, 'wx', 0o600);
  try { fs.writeFileSync(descriptor, JSON.stringify(value, null, 2)); fs.fsyncSync(descriptor); }
  finally { fs.closeSync(descriptor); }
  try { fs.renameSync(temporary, file); }
  finally { try { fs.unlinkSync(temporary); } catch {} }
}
function readJson(file) {
  inspectFile(file, 'file');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code) throw error; throw fail('DAEMON_STATE', '后台状态记录损坏，请保留数据排查。'); }
}
function socketPathFor(stateDirectory) {
  const candidate = path.join(stateDirectory, 'daemon.sock');
  if (Buffer.byteLength(candidate) <= 100) return candidate;
  return path.join(os.tmpdir(), 'agentbridge-' + process.getuid(), createHash('sha256').update(stateDirectory).digest('hex').slice(0, 24), 'daemon.sock');
}
function identity(options, create = true) {
  const opts = validateOptions(options);
  if (create) privateDirectory(opts.stateDirectory);
  else inspectFile(opts.stateDirectory, 'directory');
  const file = path.join(opts.stateDirectory, 'machine.json');
  if (!fs.existsSync(file) && create) {
    const unrelated = fs.readdirSync(opts.stateDirectory).filter(name => !name.startsWith('machine.json.') && name !== 'logs');
    if (unrelated.length) throw fail('DAEMON_OWNERSHIP', '状态目录包含非 AgentBridge 文件，不能接管。');
    const value = { kind: 'agentbridge-machine', stateVersion: 1, daemonId: randomUUID(), ownerCoordinatorId: opts.ownerCoordinatorId, profileId: opts.profileId, uid: process.getuid(), stateDirectory: opts.stateDirectory, generation: 0, createdAt: now() };
    const temporary = file + '.' + randomUUID() + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
    try { fs.linkSync(temporary, file); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    finally { fs.unlinkSync(temporary); }
  }
  const value = readJson(file);
  if (value.kind !== 'agentbridge-machine' || value.stateVersion !== 1 || !validId(value.daemonId) || value.uid !== process.getuid() || value.stateDirectory !== opts.stateDirectory || !Number.isSafeInteger(value.generation) || value.generation < 0) throw fail('DAEMON_IDENTITY', '远端后台身份记录不完整或路径不匹配。');
  if (value.ownerCoordinatorId !== opts.ownerCoordinatorId || value.profileId !== opts.profileId) throw fail('DAEMON_OWNER_CONFLICT', '此后台属于另一个中央 profile，不能自动接管。');
  const socketPath = socketPathFor(opts.stateDirectory);
  if (path.dirname(socketPath) !== opts.stateDirectory && create) privateDirectory(path.dirname(socketPath));
  return { ...value, socketPath, protocolVersion: PROTOCOL_VERSION, version: VERSION, hostname: os.hostname(), username: os.userInfo().username, platform: 'linux', arch: process.arch };
}
function processStart(pid) {
  try { return fs.readFileSync('/proc/' + pid + '/stat', 'utf8').replace(/^.*\) /, '').split(' ')[19]; }
  catch (error) { if (error.code === 'ENOENT') return null; throw fail('DAEMON_LOCK', '无法验证已有后台锁的进程身份。'); }
}
function acquireLock(info) {
  const file = path.join(info.stateDirectory, 'daemon.lock');
  const value = { kind: 'agentbridge-daemon-lock', lockId: randomUUID(), pid: process.pid, pidStart: processStart(process.pid), daemonId: info.daemonId, ownerCoordinatorId: info.ownerCoordinatorId, profileId: info.profileId };
  for (let attempt = 0; attempt < 3; attempt++) {
    try { fs.writeFileSync(file, JSON.stringify(value), { flag: 'wx', mode: 0o600 }); return { file, value }; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const existing = readJson(file);
      if (existing.kind !== value.kind || existing.daemonId !== info.daemonId || existing.ownerCoordinatorId !== info.ownerCoordinatorId || existing.profileId !== info.profileId || !Number.isInteger(existing.pid) || !existing.pidStart) throw fail('DAEMON_OWNERSHIP', '已有后台锁的归属无法验证。');
      const started = processStart(existing.pid);
      if (started && started === existing.pidStart) throw fail('DAEMON_ALREADY_RUNNING', '此 profile 的后台正在运行或启动，请查询已有 socket。');
      const old = file + '.stale.' + randomUUID();
      try { fs.renameSync(file, old); fs.unlinkSync(old); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
  }
  throw fail('DAEMON_LOCK', '后台锁竞争未完成，请重新连接。');
}

async function inspectDaemon(options, timeout = 1500) {
  const info = identity(options, false);
  if (!fs.existsSync(info.socketPath)) throw fail('DAEMON_OFFLINE', '后台尚未运行。');
  inspectFile(info.socketPath, 'socket');
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(info.socketPath), channel = new FramedStream(socket);
    let finished = false;
    const finish = (error, result) => { if (finished) return; finished = true; clearTimeout(timer); channel.close(); error ? reject(error) : resolve(result); };
    const timer = setTimeout(() => finish(fail('DAEMON_OFFLINE', '已有后台没有回应身份检查。')), timeout);
    channel.on('error', error => finish(error)); channel.on('close', () => finish(fail('DAEMON_OFFLINE', '已有后台已断开。')));
    channel.on('frame', frame => {
      if (frame.id !== 'inspect') return;
      if (frame.error) return finish(Object.assign(new Error(frame.error.message), { code: frame.error.code }));
      const value = frame.result;
      if (!value || value.kind !== 'agentbridge-machine' || value.daemonId !== info.daemonId || value.uid !== info.uid || value.stateDirectory !== info.stateDirectory || value.ownerCoordinatorId !== info.ownerCoordinatorId || value.profileId !== info.profileId || value.protocolVersion !== PROTOCOL_VERSION) return finish(fail('DAEMON_IDENTITY', '已有 socket 的服务身份与私有状态不一致。'));
      finish(null, value);
    });
    socket.once('connect', () => channel.send({ id: 'inspect', method: 'inspect', params: { coordinatorId: info.ownerCoordinatorId, profileId: info.profileId, expectedDaemonId: info.daemonId, protocolVersion: PROTOCOL_VERSION } }));
  });
}

async function productionHost(directory, collaboration) {
  const { DesktopHost } = await import(pathToFileURL(path.resolve(__dirname, '../../dist/desktop-host.js')).href);
  const { MachineHost } = require('./machine-host.cjs');
  const backend = context => {
    const leaf = new DesktopHost(context);
    return { directory: leaf.directory, call: (method, params = {}) => leaf.handle({ id: 'machine-daemon', method, params }) };
  };
  return new MachineHost({ directory, legacy: backend(directory), collaboration, openCode: backend });
}

/** Detached daemon: a relay disappearing never closes its native hosts. */
async function startDaemon(options) {
  const opts = validateOptions(options), info = identity(opts), lock = acquireLock(info);
  const clients = new Set(), jobs = new Map(), callbacks = new Map();
  let active = null, stopped = false, host, monitor, polling = false, admissions=0;
  const maintenanceFile=path.join(info.stateDirectory,'maintenance.json');
  let maintenance=fs.existsSync(maintenanceFile)?readJson(maintenanceFile):null;
  const receiptsFile = path.join(info.stateDirectory, 'daemon-receipts.json');
  const eventsFile = path.join(info.stateDirectory, 'daemon-events.jsonl');
  let records;
  let cursor = 0;
  const events = [];
  try {
    records = fs.existsSync(receiptsFile) ? readJson(receiptsFile) : [];
    if(Array.isArray(records))for(const r of records)if(['reply','cancel'].includes(r.op)&&r.state==='confirmed'&&r.result?.state==='unknown')r.state='unknown';
    if (!Array.isArray(records)) throw fail('DAEMON_STATE', '后台操作收据记录无法读取。');
    if (fs.existsSync(eventsFile)) {
      inspectFile(eventsFile, 'file');
      const lines = fs.readFileSync(eventsFile, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        let event; try { event = JSON.parse(line); } catch { throw fail('DAEMON_STATE', '后台事件记录损坏，请保留记录排查。'); }
        if (!Number.isSafeInteger(event.cursor) || event.cursor <= cursor) throw fail('DAEMON_STATE', '后台事件游标无效。');
        cursor = event.cursor; events.push(event); if (events.length > 2000) events.shift();
      }
    }
  } catch (error) { if (readJson(lock.file).lockId === lock.value.lockId) fs.unlinkSync(lock.file); throw error; }
  const saveReceipts = () => atomicJson(receiptsFile, records);
  const emitEvent = (name, payload) => {
    const event = { type: 'event', cursor: ++cursor, name, payload, timestamp: now(), daemonId: info.daemonId };
    const serialized = JSON.stringify(event);
    if (Buffer.byteLength(serialized) > MAX_FRAME_BYTES) throw fail('PROTOCOL_LIMIT', '后台事件过大，不能写入或发送。');
    fs.appendFileSync(eventsFile, serialized + '\n', { mode: 0o600 });
    events.push(event); if (events.length > 2000) events.shift();
    if (active) { try { active.channel.send(event); } catch { active.channel.close(); } }
    return event;
  };
  const collaboration = (scope, name, args, callId) => new Promise((resolve, reject) => {
    if (!active) return reject(fail('COLLABORATION_OFFLINE', 'SSH 协作通道未连接；请查询已有任务。'));
    if (callbacks.size >= MAX_INFLIGHT) return reject(fail('DAEMON_BUSY', '协作回调达到并发上限。'));
    const id = 'mcp-' + randomUUID(), client = active;
    const timer = setTimeout(() => { callbacks.delete(id); reject(fail('COLLABORATION_TIMEOUT', '协作回应未知，请查询原请求。')); }, opts.callbackTimeoutMs || 60000);
    callbacks.set(id, { resolve, reject, timer, client });
    try { client.channel.send({ bridgeTool: true, id, scope, name, args, callId, generation: client.generation }); }
    catch (error) { clearTimeout(timer); callbacks.delete(id); reject(error); }
  });
  const removeCallbacks = client => {
    for (const [id, pending] of callbacks) if (pending.client === client) { clearTimeout(pending.timer); callbacks.delete(id); pending.reject(fail('COLLABORATION_OFFLINE', '原 SSH 协作通道已断开；请查询原任务。')); }
  };
  const resultPage = (array, params, firstCursor = 0) => {
    const after = params.afterCursor ?? firstCursor, limit = params.limit ?? 50;
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200) throw fail('INVALID_INPUT', '分页游标或数量无效。');
    const items = [], source = array.filter(row => row.cursor > after);
    let bytes = 1000;
    for (const row of source.slice(0, limit)) { const size = Buffer.byteLength(JSON.stringify(row)); if (bytes + size > MAX_FRAME_BYTES - 4096) break; items.push(row); bytes += size; }
    return { items, nextCursor: items.at(-1)?.cursor ?? after, hasMore: source.length > items.length, ...(array.length && after < array[0].cursor - 1 ? { cursorGap: true, earliestCursor: array[0].cursor } : {}) };
  };
  const receiptKey = params => String(params.operationId || params.reply?.operationId || params.requestId || '');
  const queryRecord = async record => {
    // Older releases incorrectly classified this authenticated Hub rejection
    // as unknown. Hub rejects it before task creation. Reconcile that durable
    // evidence only; absence of a native receipt never proves non-execution.
    if (record.state === 'unknown' && record.error?.code === 'AGENT_UNHEALTHY' && ['submit', 'continue', 'verify'].includes(record.op)) {
      record.state = 'rejected'; record.updatedAt = now(); saveReceipts();
    }
    if (record.state === 'confirmed') return record.result;
    if(record.state==='rejected'&&['reply','cancel'].includes(record.op)&&record.result?.operationId===record.key)return record.result;
    if (record.state === 'rejected') throw Object.assign(new Error(record.error.message), { code: record.error.code });
    if (jobs.has(record.key)) return jobs.get(record.key);
    try {
      const query = ['reply', 'cancel'].includes(record.op) ? { ...record.target, op: 'operation', operationId: record.key } : { ...record.target, op: 'request', requestId: record.key };
      const result = await host.call('ipc', query);
      if(['reply','cancel'].includes(record.op)){
        if(result?.operationId!==record.key||!['confirmed','rejected','unknown'].includes(result.state))throw fail('DESKTOP_UNCONFIRMED','原控制收据尚未确认。');
        record.state=result.state;
      }else{
        if(!result?.taskId||result.requestId!==record.key)throw fail('DESKTOP_UNCONFIRMED','原任务收据尚未确认。');
        record.state='confirmed';
      }
      record.result=result;record.updatedAt=now();saveReceipts();return result;
    } catch (error) {
      if (error.code === 'REQUEST_CONFLICT') throw error;
      record.state = 'unknown'; record.updatedAt = now(); saveReceipts();
      throw fail('DESKTOP_UNCONFIRMED', '原请求已发往原生后台但尚无可核对收据，请查询原请求，不重复执行。');
    }
  };
  const dispatch = async (method, params) => {
    if(method==='daemon.quiesce'){
      if(!validId(params.operationId))throw fail('INVALID_INPUT','维护需要稳定操作 ID。');
      if(maintenance&&maintenance.operationId!==params.operationId)throw fail('DAEMON_MAINTENANCE','原维护尚未完成，请查询原操作。');
      if(admissions||jobs.size)throw fail('DAEMON_BUSY','后台仍有在途操作。');
      maintenance={operationId:params.operationId};
      try{
        const snapshot=await host.call('snapshot',{});
        if((snapshot.tasks||[]).some(t=>!['succeeded','failed','cancelled'].includes(t.status))||(snapshot.agents?.items||[]).some(a=>a.busy||a.currentTask&&!['succeeded','failed','cancelled'].includes(a.currentTask.status))||records.some(r=>!['confirmed','rejected'].includes(r.state)||['reply','cancel'].includes(r.op)&&r.result?.state==='unknown'))throw fail('DAEMON_BUSY','后台有运行、等待或未知任务，禁止切换。');
        atomicJson(maintenanceFile,maintenance);return {quiescent:true,operationId:params.operationId};
      }catch(e){if(!fs.existsSync(maintenanceFile))maintenance=null;throw e;}
    }
    if(method==='daemon.releaseMaintenance'){
      if(maintenance?.operationId!==params.operationId)throw fail('DAEMON_MAINTENANCE','维护归属不匹配。');
      fs.unlinkSync(maintenanceFile);maintenance=null;return {released:true};
    }
    if(method==='daemon.shutdown'){
      if(maintenance?.operationId!==params.operationId||admissions||jobs.size)throw fail('DAEMON_BUSY','请先验证维护归属和空闲状态。');
      setTimeout(()=>{void close().then(()=>opts.onStopped?.());},50);return {stopping:true};
    }
    if (method === 'daemon.status') return { ...info, pid: process.pid, lastEventCursor: cursor, activeSessionId: active?.sessionId || null };
    if (method === 'daemon.eventRead') return resultPage(events, params);
    if (method === 'daemon.receiptRead') {
      if (params.requestId || params.operationId) { const key = receiptKey(params), row = records.find(r => r.key === key); if (!row) throw fail('NOT_FOUND', '后台尚无此操作记录。'); return { ...row }; }
      return resultPage(records.map((r, i) => ({ ...r, cursor: i + 1 })), params);
    }
    if (!methods.has(method)) throw fail('DESKTOP_METHOD', '此操作不在远端后台方法范围内。');
    if (method === 'ipc' && ['request', 'operation'].includes(params.op)) {
      const row = records.find(r => r.key === receiptKey(params));
      if(row)for(const key of ['taskId','executionId','agentId','conversationId'])if(params[key]&&row.target?.[key]&&params[key]!==row.target[key])throw fail('EXECUTION_MISMATCH','原操作不属于这个执行目标。');
      if (row && row.state !== 'confirmed') return queryRecord(row);
    }
    if (method !== 'ipc' || !mutations.has(params.op)){
      if(['context','connect','mcp.install','mcp.remove','mcp.export'].includes(method)){if(maintenance)throw fail('DAEMON_MAINTENANCE','后台正在维护，不接受配置变更或新执行上下文。');admissions++;try{return await host.call(method,params);}finally{admissions--;}}
      return host.call(method,params);
    }
    const key = receiptKey(params);
    if (!validId(key)) throw fail('INVALID_INPUT', '执行或控制操作需要稳定的 requestId / operationId。');
    if (typeof params.message === 'string' && Buffer.byteLength(params.message) > 65536) throw fail('INVALID_INPUT', '执行需求超过 64 KiB UTF-8 限制。');
    const fingerprint = createHash('sha256').update(JSON.stringify(canonical({ method, params }))).digest('hex');
    const previous = records.find(r => r.key === key);
    if (previous) { if (previous.fingerprint !== fingerprint) throw fail('REQUEST_CONFLICT', '同一操作 ID 对应的内容已改变。'); return queryRecord(previous); }
    if(maintenance)throw fail('DAEMON_MAINTENANCE','后台正在维护，不接受新的任务或控制操作。');
    const target = Object.fromEntries(['taskId', 'agentId', 'conversationId', 'executionId'].filter(name => typeof params[name] === 'string').map(name => [name, params[name]]));
    const record = { key, method, op: params.op, target, fingerprint, state: 'intent', createdAt: now(), updatedAt: now() };
    records.push(record); saveReceipts();
    const job = (async () => {
      record.state = 'dispatched'; record.updatedAt = now(); saveReceipts(); emitEvent('operation.accepted', { requestId: key, op: params.op });
      try {
        const result = await host.call(method, params);
        const control=['reply','cancel'].includes(params.op);
        record.state=control?(result?.operationId===key&&['confirmed','rejected','unknown'].includes(result.state)?result.state:'unknown'):'confirmed';
        if(control&&record.state==='unknown'&&(result?.operationId!==key||!result.state)){record.result={operationId:key,taskId:params.taskId||params.reply?.taskId,state:'unknown'};}else record.result=result; record.updatedAt = now(); saveReceipts(); emitEvent('operation.confirmed', { requestId: key, taskId: result?.taskId, op: params.op }); return record.result;
      } catch (error) {
        record.state = knownRejections.has(error.code) ? 'rejected' : 'unknown'; record.error = safeError(error); record.updatedAt = now(); saveReceipts(); emitEvent('operation.' + record.state, { requestId: key, op: params.op }); throw error;
      }
    })().finally(() => jobs.delete(key));
    jobs.set(key, job); return job;
  };
  let server;
  const close = async () => {
    if (stopped) return; stopped = true; clearInterval(monitor);
    for (const client of clients) client.channel.close();
    for (const pending of callbacks.values()) { clearTimeout(pending.timer); pending.reject(fail('DAEMON_OFFLINE', '后台已停止。')); } callbacks.clear();
    await new Promise(resolve => server?.listening ? server.close(resolve) : resolve());
    // MachineHost.close only stops observers and its local broker. It does not
    // issue controller.stop or cancel a native worker. No transport close uses it.
    host?.close?.();
    const cleanupErrors = [];
    try { if (fs.existsSync(info.socketPath)) inspectFile(info.socketPath, 'socket'); fs.unlinkSync(info.socketPath); } catch (error) { if (error.code !== 'ENOENT') cleanupErrors.push(error); }
    try { const current = readJson(lock.file); if (current.lockId === lock.value.lockId) fs.unlinkSync(lock.file); } catch (error) { if (error.code !== 'ENOENT') cleanupErrors.push(error); }
    try { const file = path.join(info.stateDirectory, 'daemon.pid'); if (fs.existsSync(file)) inspectFile(file, 'file'); fs.unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') cleanupErrors.push(error); }
    if (cleanupErrors.length) throw cleanupErrors[0];
  };
  try {
    if (fs.existsSync(info.socketPath)) {
      inspectFile(info.socketPath, 'socket');
      try { await inspectDaemon(opts, 500); throw fail('DAEMON_ALREADY_RUNNING', '私有 socket 上已有有效后台，不替换。'); }
      catch (error) { if (!['DAEMON_OFFLINE', 'ECONNREFUSED', 'ENOENT'].includes(error.code)) throw error; }
      fs.unlinkSync(info.socketPath);
    }
    host = await (opts.hostFactory || productionHost)(info.stateDirectory, collaboration);
    if (!host?.call) throw fail('DAEMON_HOST', '机器后台没有提供调用接口。');
    host.setCollaboration?.(collaboration);
    server = net.createServer(socket => {
      const channel = new FramedStream(socket), client = { channel, ready: false, inflight: 0, generation: null, sessionId: null };
      clients.add(client);
      const helloTimer = setTimeout(() => { if (!client.ready) channel.close(); }, opts.helloTimeoutMs || 10000);
      channel.on('error', () => {});
      channel.on('close', () => { clearTimeout(helloTimer); clients.delete(client); if (active === client) active = null; removeCallbacks(client); });
      const respond = (id, value, error) => { try { channel.send(error ? { id, error: safeError(error) } : { id, result: value }); } catch (e) { if (e.code === 'PROTOCOL_LIMIT') { try { channel.send({ id, error: safeError(e) }); } catch {} } else channel.close(); } };
      channel.on('frame', frame => {
        void (async () => {
          let counted = false;
          try {
            if (frame.bridgeReply) {
              const pending = callbacks.get(frame.bridgeReply);
              if (!client.ready || active !== client || !pending || pending.client !== client) throw fail('COLLABORATION_SCOPE', '协作回应不属于当前通道。');
              callbacks.delete(frame.bridgeReply); clearTimeout(pending.timer);
              if (frame.error) pending.reject(Object.assign(new Error(frame.error.message || '协作调用失败。'), { code: frame.error.code || 'COLLABORATION_ERROR' })); else pending.resolve(frame.result);
              return;
            }
            if (!validId(frame.id) || typeof frame.method !== 'string' || !own(frame.params || {})) throw fail('INVALID_INPUT', '远端请求 ID、方法或参数格式无效。');
            const params = frame.params || {};
            if (frame.method === 'inspect' || frame.method === 'hello') {
              if (client.ready) throw fail('PROTOCOL_HELLO', '此通道已完成握手。');
              if (params.protocolVersion !== PROTOCOL_VERSION) throw fail('PROTOCOL_MISMATCH', '客户端和远端后台协议版本不兼容。');
              if (params.coordinatorId !== info.ownerCoordinatorId || params.profileId !== info.profileId) throw fail('DAEMON_OWNER_CONFLICT', '此后台的中央 profile 归属不匹配。');
              if (params.expectedDaemonId && params.expectedDaemonId !== info.daemonId) throw fail('MACHINE_IDENTITY_CHANGED', '此地址返回了不同机器身份，停止接管。');
              if (frame.method === 'inspect') { respond(frame.id, { ...info, pid: process.pid }); channel.end(); return; }
              if (!validId(params.nonce) || (params.sessionId && !validId(params.sessionId))) throw fail('INVALID_INPUT', '握手 nonce 或 sessionId 无效。');
              info.generation++; atomicJson(path.join(info.stateDirectory, 'machine.json'), info);
              client.ready = true; client.generation = info.generation; client.sessionId = params.sessionId || params.nonce; clearTimeout(helloTimer);
              const previous = active; active = client;
              if (previous) { removeCallbacks(previous); previous.channel.close(); }
              respond(frame.id, { ...info, pid: process.pid, nonce: params.nonce, sessionId: client.sessionId, generation: client.generation, lastEventCursor: cursor, capabilities: ['discover', 'contexts', 'native-sessions', 'durable-receipts', 'events', 'collaboration-callbacks',...runtimeCapabilities] }); return;
            }
            if (!client.ready || active !== client) throw fail('PROTOCOL_HELLO', '此通道尚未绑定中央后台，不能执行操作。');
            if (frame.method === 'ping') { respond(frame.id, { nonce: params.nonce, generation: client.generation, timestamp: now() }); return; }
            if (client.inflight >= MAX_INFLIGHT) throw fail('DAEMON_BUSY', '当前通道的在途请求已达到 64 项。');
            client.inflight++; counted = true;
            const result = await dispatch(frame.method, params); respond(frame.id, result);
          } catch (error) { respond(frame.id || 'invalid', null, error); if (!client.ready) channel.end(); }
          finally { if (counted) client.inflight--; }
        })();
      });
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      // Unix bind creates the socket synchronously. Protect it before another
      // process can inspect it; restore the process mask before yielding.
      const previousMask = process.umask(0o177);
      try { server.listen(info.socketPath, resolve); }
      finally { process.umask(previousMask); }
    });
    fs.chmodSync(info.socketPath, 0o600); atomicJson(path.join(info.stateDirectory, 'daemon.pid'), { pid: process.pid, pidStart: lock.value.pidStart, daemonId: info.daemonId, lockId: lock.value.lockId });
    let lastTasks = new Map();
    if (opts.monitorIntervalMs !== 0) {
      monitor = setInterval(() => {
        if (polling || stopped) return; polling = true;
        void host.call('snapshot', {}).then(snapshot => {
          for (const task of snapshot.tasks || []) {
            const signature = JSON.stringify([task.status, task.updatedAt, task.lastSeq, task.lastSummary]);
            if (lastTasks.get(task.taskId) !== signature) { lastTasks.set(task.taskId, signature); emitEvent('task.changed', { taskId: task.taskId, requestId: task.requestId, status: task.status, updatedAt: task.updatedAt, lastSeq: task.lastSeq }); }
          }
          const ids = new Set((snapshot.tasks || []).map(t => t.taskId)); lastTasks = new Map([...lastTasks].filter(([id]) => ids.has(id)));
        }).catch(() => {}).finally(() => { polling = false; });
      }, opts.monitorIntervalMs || 1000); monitor.unref();
    }
    return { info, server, host, close, dispatch, emitEvent };
  } catch (error) { await close().catch(() => {}); throw error; }
}

async function ensureDaemon(options) {
  const opts = validateOptions(options), info = identity(opts);
  try { return { ...await inspectDaemon(opts), started: false }; }
  catch (error) { if (!['DAEMON_OFFLINE', 'ECONNREFUSED', 'ENOENT'].includes(error.code)) throw error; }
  const logs = privateDirectory(path.join(info.stateDirectory, 'logs'));
  const log = path.join(logs, 'daemon.log');
  if (fs.existsSync(log)) inspectFile(log, 'file');
  const output = fs.openSync(log, 'a', 0o600);
  let child;
  try {
    child = spawn(process.execPath, [__filename, '--serve', '--state-directory', opts.stateDirectory, '--owner', opts.ownerCoordinatorId, '--profile', opts.profileId], { detached: true, stdio: ['ignore', output, output], shell: false, env: { ...process.env, PATH: path.dirname(process.execPath) + path.delimiter + (process.env.PATH || '') } });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); }); child.unref();
  } finally { fs.closeSync(output); }
  const deadline = Date.now() + (opts.startTimeoutMs || 10000);
  while (Date.now() < deadline) {
    try { return { ...await inspectDaemon(opts, 500), started: true }; }
    catch (error) { if (!['DAEMON_OFFLINE', 'ECONNREFUSED', 'ENOENT'].includes(error.code)) throw error; }
    await pause(75);
  }
  throw fail('DAEMON_START_TIMEOUT', '后台没有完成启动；请查看私有 daemon 日志。');
}

function parseArguments(args) {
  const result = {};
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (name === '--serve') result.serve = true;
    else if (['--state-directory', '--owner', '--profile', '--expected-daemon'].includes(name)) {
      const value = args[++index]; if (!value || value.startsWith('--')) throw fail('INVALID_INPUT', '后台参数缺少值。');
      result[{ '--state-directory': 'stateDirectory', '--owner': 'ownerCoordinatorId', '--profile': 'profileId', '--expected-daemon': 'expectedDaemonId' }[name]] = value;
    } else throw fail('INVALID_INPUT', '不支持的后台命令参数。');
  }
  return result;
}

if (require.main === module) {
  void (async () => {
    const options = parseArguments(process.argv.slice(2));
    if (options.serve) {
      const daemon = await startDaemon({...options,onStopped:()=>process.exit(0)});
      const shutdown = () => { void daemon.close().then(() => process.exit(0), () => process.exit(1)); };
      process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
    } else process.stdout.write(JSON.stringify(await ensureDaemon(options)) + '\n');
  })().catch(error => { process.stderr.write(JSON.stringify({ error: safeError(error) }) + '\n'); process.exitCode = 1; });
}

module.exports = { PROTOCOL_VERSION, VERSION, MAX_INFLIGHT, startDaemon, ensureDaemon, inspectDaemon, identity, socketPathFor, parseArguments, inspectFile, privateDirectory, safeError };
