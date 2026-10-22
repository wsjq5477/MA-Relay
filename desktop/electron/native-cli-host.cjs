const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const { profiles, names, validIdentity, argumentsFor, createParser, piSessionFile } = require('./native-cli-protocols.cjs');
const terminal = new Set(['succeeded', 'failed', 'cancelled']);
const now = () => new Date().toISOString();
const clone = value => JSON.parse(JSON.stringify(value));
const fail = (code, message) => Object.assign(new Error(message), { code });
// Older state only stored cancellation receipts, without a kind field.
const operationKind = operation => operation.kind ?? 'cancel';
const capabilities = Object.freeze({ resume: true, cancellation: true, permissions: false, forms: false, verification: false, teamCollaboration: false });
function safe(value) {
  let text = String(value ?? '').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  for (const [key, value] of Object.entries(process.env)) if (/TOKEN|SECRET|PASSWORD|API_KEY/.test(key) && value?.length > 6) text = text.split(value).join('[已隐藏]');
  return text.slice(0, 200000);
}
function read(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw fail('NATIVE_STATE', '原生执行记录无法读取，请保留原目录。'); }
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = file + '.' + randomUUID() + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, file);
}
class NativeCliHost {
  constructor(options) {
    if (!profiles[options.adapter]) throw fail('ADAPTER_UNSUPPORTED', '原生 Agent 适配器未注册。');
    this.directory = options.directory; this.adapter = options.adapter; this.executable = options.executable;
    this.home = options.home; this.environment = options.environment; this.name = names[this.adapter];
    this.file = path.join(this.directory, this.adapter + '-state.json');
    this.state = read(this.file, { revision: 1, agents: [], tasks: [], conversations: [], requests: [], operations: [] });
    this.chain = Promise.resolve();
    this.timer = setInterval(() => { this.chain = this.chain.then(() => this.sync()).catch(() => {}); }, 250); this.timer.unref();
  }
  save() { write(this.file, this.state); }
  event(task, kind, data = {}) { task.updatedAt = now(); task.events.push({ seq: ++task.lastSeq, timestamp: task.updatedAt, event: { kind, ...data } }); }
  publicTask(task) { const result = clone(task); delete result.offset; return result; }
  existingOperation(task, operationId, kind) {
    if (!validIdentity(operationId)) throw fail('INVALID_INPUT', '控制操作需要有效操作 ID。');
    const old = this.state.operations.find(item => item.operationId === operationId);
    if (old && (old.taskId !== task.taskId || operationKind(old) !== kind)) throw fail('REQUEST_CONFLICT', '操作 ID 已用于其他任务或控制操作。');
    return old;
  }
  confirmOperations(task, nativeExited) {
    const reason = nativeExited ? '已读取原生执行终态，未重新提交。' : '已确认原请求未派发，原任务已结束。';
    for (const operation of this.state.operations.filter(item => item.taskId === task.taskId && item.state === 'unknown')) {
      operation.state = 'confirmed';
      operation.data = { ...operation.data, status: task.status,
        ...(operationKind(operation) === 'reconcile' ? { message: reason } : { nativeExited }) };
      if (operationKind(operation) === 'reconcile') task.reconciliation = { time: now(), state: task.status, reason };
    }
  }
  finish(task, status, text, code, nativeExited = true) {
    task.status = status; task.lastSummary = text; task.finishedAt = now();
    if (status === 'succeeded') task.result = { message: text };
    if (status === 'failed') task.error = { code: code || 'NATIVE_FAILED', message: text };
    this.event(task, status === 'succeeded' ? 'completed' : status, { text, ...(task.error ? { error: task.error } : {}) });
    this.confirmOperations(task, nativeExited);
  }
  sync() {
    let changed = false;
    for (const task of this.state.tasks.filter(item => !terminal.has(item.status))) {
      const directory = path.join(this.directory, 'runs', task.taskId);
      let data = ''; try { data = fs.readFileSync(path.join(directory, 'events.jsonl'), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const lines = data.slice(0, data.lastIndexOf('\n') + 1).split('\n').filter(Boolean);
      for (const line of lines.slice(task.offset || 0)) {
        const event = JSON.parse(line); task.offset = (task.offset || 0) + 1; changed = true;
        if (terminal.has(task.status)) break;
        if (event.kind === 'started') { task.status = 'running'; task.lastSummary = this.name + ' 正在执行'; this.event(task, 'started'); }
        if (event.kind === 'native' && validIdentity(event.sessionId)) {
          const conversation = this.state.conversations.find(item => item.conversationId === task.conversationId);
          if (conversation.sessionId && conversation.sessionId !== event.sessionId) continue;
          task.native = { sessionId: event.sessionId, messageId: validIdentity(event.messageId) ? event.messageId : task.requestId }; conversation.sessionId = event.sessionId;
          if (event.instanceId) { if (conversation.instanceId && conversation.instanceId !== event.instanceId) { conversation.bindingError = '原生实例身份发生变化'; task.status = 'unknown'; } else conversation.instanceId = event.instanceId; }
          this.event(task, 'native');
        }
        if (event.kind === 'binding_error') { const conversation = this.state.conversations.find(item => item.conversationId === task.conversationId); conversation.bindingError = event.text; this.event(task, 'progress', { text: event.text }); }
        if (event.kind === 'output') { task.lastSummary = event.text; this.event(task, 'output', { text: event.text, ...(event.delta ? { delta: true } : {}) }); }
        if (event.kind === 'progress') this.event(task, 'progress', { text: event.text });
        if (event.kind === 'unknown') { task.status = 'unknown'; task.lastSummary = event.text; this.event(task, 'progress', {text: event.text}); }
        if (event.kind === 'terminal') this.finish(task, event.status, event.text, event.code, event.nativeExited !== false);
      }
      const heartbeat = read(path.join(directory, 'heartbeat.json'), null);
      if (!terminal.has(task.status) && task.status !== 'unknown' && Date.now() - Date.parse(heartbeat?.time || task.createdAt) > 15000) {
        task.status = 'unknown'; task.lastSummary = '原执行状态待核对，不会自动重新提交。'; changed = true;
      }
    }
    if (changed) this.save();
  }
  call(method, params = {}) { const result = this.chain.then(() => this.handle(method, params)); this.chain = result.catch(() => {}); return result; }
  failLaunch(task, error) { if (!terminal.has(task.status)) { this.finish(task, 'failed', safe(this.name + ' 原生任务未启动：' + error.message), error.code || 'NATIVE_START', false); this.save(); } return this.publicTask(task); }
  conversationView(conversation) {
    const result = clone(conversation); delete result.sessionId;
    const last = this.state.tasks.find(item => item.taskId === conversation.lastTaskId);
    let bound = validIdentity(conversation.sessionId) && (!this.adapter.startsWith('opendesk') || validIdentity(conversation.instanceId)) && conversation.profile === profiles[this.adapter] && !conversation.bindingError;
    if (bound && this.adapter.startsWith('opendesk')) {
      const owner = require('./opendesk-connection.cjs').controller(path.join(this.directory, 'opendesk-existing-v2'));
      bound = owner?.instanceId === conversation.instanceId && owner?.connected === true && owner?.executable === this.executable;
    }
    if (bound && this.adapter === 'pi') {
      try { piSessionFile(path.join(this.directory, 'native-sessions'), conversation.sessionId); }
      catch (error) { if (error.code !== 'CONVERSATION_CONFIG') throw error; bound = false; }
    }
    return { ...result, kind: 'task', canContinue: !!bound && !!last && terminal.has(last.status) && !this.state.tasks.some(item => !terminal.has(item.status)) };
  }
  async handle(method, params) {
    this.sync();
    if (method === 'connect') {
      if (params.model || params.providerID) throw fail('INVALID_INPUT', '节点沿用原生模型与供应商配置。');
      const workspace = fs.realpathSync(params.workspace); if (!fs.statSync(workspace).isDirectory()) throw fail('WORKSPACE_UNAVAILABLE', '执行目录不可用。');
      if (this.adapter === 'opendesk-desktop') {
        const config = require('./opendesk-connection.cjs').desktopConfig(this.executable, {home:this.home,environment:this.environment});
        if (fs.realpathSync(config.workspace) !== workspace) throw fail('OPENDESK_WORKSPACE', 'OpenDesk 桌面网关沿用原生工作目录，请选择该目录或在原生设置修改后重启网关。');
      }
      let agent = this.state.agents.find(item => item.workspace === workspace);
      if (!agent) { agent = { agentId: this.adapter + '-' + randomUUID(), adapter: this.adapter, executable: this.executable, name: this.name, workspace, enabled: true }; this.state.agents.push(agent); this.save(); }
      return { agentId: agent.agentId };
    }
    if (method === 'snapshot') return {
      agents: { items: this.state.agents.map(agent => { const active = this.state.tasks.find(task => task.targetAgent === agent.agentId && !terminal.has(task.status)); return { ...agent, online: true, healthy: true, busy: !!active, available: !active, default: false, nativeAgent: this.adapter, capabilities, ...(active ? { currentTask: { taskId: active.taskId, status: active.status, summary: active.lastSummary } } : {}) }; }), revision: this.state.revision, connected: true },
      tasks: this.state.tasks.map(task => this.publicTask(task)), conversations: this.state.conversations.map(item => this.conversationView(item)),
    };
    if (method !== 'ipc') throw fail('DESKTOP_METHOD', '不支持这个原生 Agent 操作。');
    const task = this.state.tasks.find(item => item.taskId === params.taskId);
    if (params.op === 'request') { const receipt = this.state.requests.find(item => item.requestId === params.requestId); if (!receipt) throw fail('NOT_FOUND', '原请求不存在。'); return this.publicTask(this.state.tasks.find(item => item.taskId === receipt.taskId)); }
    if (params.op === 'task') { if (!task) throw fail('TASK_NOT_FOUND', '任务不存在。'); return this.publicTask(task); }
    if (params.op === 'conversation') { const conversation = this.state.conversations.find(item => item.conversationId === params.conversationId); if (!conversation) throw fail('NOT_FOUND', '会话不存在。'); return { ...this.conversationView(conversation), items: this.state.tasks.filter(item => item.conversationId === conversation.conversationId).map(item => this.publicTask(item)) }; }
    if (params.op === 'pending') return { permissions: [], forms: [] };
    if (params.op === 'operation') { const operation = this.state.operations.find(item => item.operationId === params.operationId); if (!operation || (params.taskId && operation.taskId !== params.taskId)) throw fail('NOT_FOUND', '操作不存在。'); return clone(operation); }
    if (params.op === 'cancel') {
      if (!task) throw fail('TASK_NOT_FOUND', '任务不存在。'); if (!validIdentity(params.operationId)) throw fail('INVALID_INPUT', '取消需要操作 ID。');
      const old = this.existingOperation(task, params.operationId, 'cancel');
      if (old) return clone(old);
      if (!terminal.has(task.status) && this.state.operations.some(item => item.taskId === task.taskId && item.state === 'unknown' && operationKind(item) === 'cancel')) throw fail('REQUEST_CLAIMED', '原取消操作尚待核对，请查询原 operationId，不换 ID 重复取消。');
      const receipt = { operationId: params.operationId, taskId: task.taskId, kind: 'cancel', state: terminal.has(task.status) ? 'confirmed' : 'unknown' };
      this.state.operations.push(receipt); this.save(); if (receipt.state === 'unknown') write(path.join(this.directory, 'runs', task.taskId, 'cancel.json'), { operationId: params.operationId }); return clone(receipt);
    }
    if (params.op === 'reconcile') {
      if (!task) throw fail('TASK_NOT_FOUND', '任务不存在。');
      const operationId = params.operationId === undefined ? randomUUID() : params.operationId;
      const old = this.existingOperation(task, operationId, 'reconcile');
      if (old) return clone(old);
      if (['dsh-desktop', 'dsh-web', 'opendesk', 'opendesk-desktop'].includes(this.adapter) && task.status === 'unknown') {
        const directory = path.join(this.directory, 'runs', task.taskId);
        const heartbeat = read(path.join(directory, 'heartbeat.json'), null);
        let alive = false;
        if (heartbeat?.pid) try { process.kill(heartbeat.pid, 0); alive = true; } catch { /* No live observer. */ }
        if (!alive && fs.existsSync(path.join(directory, 'binding.json'))) this.startWorker(task, directory, this.state.agents.find(a => a.agentId === task.targetAgent).workspace, true);
      }
      const reason = terminal.has(task.status) ? '已读取原生执行终态，未重新提交。' : '原后台缺少可确认的终态事件，保留原请求与占用；请核对原生记录。';
      const receipt = { operationId, taskId: task.taskId, kind: 'reconcile', state: terminal.has(task.status) ? 'confirmed' : 'unknown', data: { status: task.status, message: reason } };
      task.reconciliation = { time: now(), state: task.status, reason }; this.state.operations.push(receipt); this.save(); return clone(receipt);
    }
    if (!['submit', 'continue'].includes(params.op)) throw fail('ADAPTER_UNSUPPORTED', '这个原生接入暂未适配 Bridge 权限、表单或连接验证。');
    if (params.model || params.providerID) throw fail('INVALID_INPUT', '节点沿用原生模型与供应商配置。');
    if (!validIdentity(params.requestId) || typeof params.message !== 'string' || !params.message.trim() || Buffer.byteLength(params.message) > 65536) throw fail('INVALID_INPUT', '请提供请求 ID 和有效需求。');
    if (params.mcp) throw fail('ADAPTER_UNSUPPORTED', '这个原生接入暂未适配 Bridge MCP 协作，需求未派发。');
    const conversation = params.op === 'continue' ? this.state.conversations.find(item => item.conversationId === params.conversationId) : null;
    const agent = this.state.agents.find(item => item.agentId === (conversation?.targetAgent || params.agentId)); if (!agent) throw fail('NODE_NOT_FOUND', '节点执行上下文不存在。');
    if (params.agentId && params.agentId !== agent.agentId) throw fail('CONVERSATION_CONFIG', '续聊必须使用原节点。');
    const fingerprint = createHash('sha256').update(JSON.stringify({ agentId: agent.agentId, conversationId: conversation?.conversationId, message: params.message })).digest('hex');
    const old = this.state.requests.find(item => item.requestId === params.requestId);
    if (old) { if (old.fingerprint !== fingerprint) throw fail('REQUEST_CONFLICT', '请求内容冲突。'); return this.publicTask(this.state.tasks.find(item => item.taskId === old.taskId)); }
    if (params.op === 'continue' && (!validIdentity(conversation?.sessionId) || conversation.profile !== profiles[this.adapter] || conversation.bindingError)) throw fail('CONVERSATION_CONFIG', '原生会话或执行协议尚未绑定，未重新提交。');
    if (params.op === 'continue' && this.adapter.startsWith('opendesk') && !this.conversationView(conversation).canContinue) throw fail('CONVERSATION_CONFIG', '原 OpenDesk 连接或会话不可用，请保留原历史；未重新提交。');
    if (this.state.tasks.some(item => !terminal.has(item.status))) throw fail('AGENT_BUSY', '此上下文仍有未结束任务。');
    const fresh = { taskId: this.adapter + '-task-' + randomUUID(), executionId: randomUUID(), conversationId: conversation?.conversationId || this.adapter + '-conversation-' + randomUUID(), targetAgent: agent.agentId, requestId: params.requestId, message: safe(params.message), status: 'accepted', createdAt: now(), updatedAt: now(), turn: (conversation?.turns || 0) + 1, lastSeq: 0, lastSummary: '已接收，正在启动 ' + this.name, events: [], offset: 0 };
    const directory = path.join(this.directory, 'runs', fresh.taskId), job = { adapter: this.adapter, profile: profiles[this.adapter], executable: this.executable, workspace: agent.workspace, message: params.message, requestId: params.requestId, conversationId: fresh.conversationId, sessionId: conversation?.sessionId, ...(conversation?.instanceId ? {instanceId:conversation.instanceId} : {}), sessionDirectory: path.join(this.directory, 'native-sessions'), ...(this.adapter.startsWith('opendesk') ? {controlRoot:path.join(this.directory,'opendesk-existing-v2')} : {}), ...(['dsh-desktop', 'dsh-web'].includes(this.adapter) ? {origin: require('./dsh-connection.cjs').read(this.executable).origin} : {}) };
    // Validate exact Pi persisted binding before any durable intent or spawn.
    argumentsFor(job);
    write(path.join(directory, 'job.json'), job);
    this.state.tasks.push(fresh); this.state.requests.push({ requestId: params.requestId, fingerprint, taskId: fresh.taskId });
    if (conversation) { conversation.turns++; conversation.lastTaskId = fresh.taskId; conversation.updatedAt = now(); }
    else this.state.conversations.push({ conversationId: fresh.conversationId, targetAgent: agent.agentId, profile: profiles[this.adapter], title: safe(params.message).slice(0, 100), turns: 1, lastTaskId: fresh.taskId, updatedAt: now() });
    this.event(fresh, 'accepted'); this.save();
    return this.startWorker(fresh, directory, agent.workspace);
  }
  startWorker(fresh, directory, workspace, observe = false) {
    let child, fd;
    const launchFailure = error => {
      if (!observe) return this.failLaunch(fresh, error);
      fresh.lastSummary = this.name + ' 原执行仍待核对；只读观察未能启动，原需求没有重发。';
      this.event(fresh, 'progress', {text: fresh.lastSummary}); this.save(); return this.publicTask(fresh);
    };
    try {
      const runtime = require('./worker-runtime.cjs').workerRuntime(this.directory), workerDirectory = path.join(this.directory, 'runtime', 'native-' + randomUUID());
      fs.mkdirSync(workerDirectory, { recursive: true, mode: 0o700 });
      for (const name of ['native-cli-host.cjs', 'native-cli-protocols.cjs', 'tool-discovery.cjs', 'builtin-adapters.cjs', 'agent-adapter-contract.cjs', 'dsh-connection.cjs', 'dsh-worker.cjs', 'opendesk-connection.cjs', 'opendesk-worker.cjs', 'graph-layout.cjs']) fs.copyFileSync(path.join(__dirname, name), path.join(workerDirectory, name));
      fd = fs.openSync(path.join(directory, 'worker.log'), 'a', 0o600);
      child = spawn(runtime, [path.join(workerDirectory, 'native-cli-host.cjs'), '--native-cli-worker', directory, ...(observe ? ['--observe'] : [])], { cwd: workspace, env: { ...(this.environment || process.env), ELECTRON_RUN_AS_NODE: '1' }, detached: true, windowsHide: true, stdio: ['ignore', fd, fd] });
      child.once('error', error => { this.chain = this.chain.then(() => launchFailure(error)).catch(() => {}); }); child.unref();
    } catch (error) { if (child) throw error; return launchFailure(error); }
    finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { /* Not native execution evidence. */ } }
    return this.publicTask(fresh);
  }
  close() { clearInterval(this.timer); }
}
async function runWorker(directory) {
  const original = read(path.join(directory, 'job.json'), null);
  if (['opendesk', 'opendesk-desktop'].includes(original?.adapter)) return require('./opendesk-worker.cjs').run(directory, {observe: process.argv.includes('--observe')});
  if (['dsh-desktop', 'dsh-web'].includes(original?.adapter)) return require('./dsh-worker.cjs').run(directory, {observe: process.argv.includes('--observe')});
  const job = read(path.join(directory, 'job.json'), null), emit = data => fs.appendFileSync(path.join(directory, 'events.jsonl'), JSON.stringify(data) + '\n', { mode: 0o600 });
  const beat = () => write(path.join(directory, 'heartbeat.json'), { time: now(), pid: process.pid }); beat(); const heartbeat = setInterval(beat, 1000);
  let child, cancelRequested = false, terminationSent = false, windowsKill, killDeadline = 0, ended = false, oversized = false, buffer = '', failure = '', diagnostics = '';
  const parser = createParser(job, event => emit({ ...event, ...(typeof event.text === 'string' ? { text: safe(event.text) } : {}) }));
  try {
    const launch = require('./tool-discovery.cjs').command(job.executable, argumentsFor(job));
    child = spawn(launch.executable, launch.args, { cwd: job.workspace, env: launch.env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) { clearInterval(heartbeat); emit({ kind: 'terminal', status: 'failed', code: 'NATIVE_START', text: safe(error.message) }); return; }
  child.once('spawn', () => emit({ kind: 'started' }));
  const terminate = (signal = 'SIGTERM') => {
    if (!child.pid || ended) return;
    if (process.platform === 'win32') { windowsKill = new Promise(resolve => execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, error => { if (!error) terminationSent = true; resolve(); })); }
    else try { process.kill(-child.pid, signal); terminationSent = true; } catch { /* Exit may already be queued; no cancellation evidence. */ }
  };
  function line(record) { if (!record.trim()) return; try { parser.accept(JSON.parse(record)); } catch (error) { failure = safe(error.message || '原生 JSONL 事件无效'); } }
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    if (oversized) return;
    buffer += chunk; let end;
    while ((end = buffer.indexOf('\n')) >= 0) { const record = buffer.slice(0, end); buffer = buffer.slice(end + 1); if (Buffer.byteLength(record) > 4 * 1024 * 1024) { oversized = true; break; } line(record); }
    if (oversized || Buffer.byteLength(buffer) > 4 * 1024 * 1024) { oversized = true; failure = '原生事件超过 4 MiB 长度限制，回答未确认为完整。'; killDeadline = Date.now() + 3000; terminate(); }
  });
  // Keep diagnostics only; raw native reasoning/tool arguments are not copied.
  child.stderr.on('data', chunk => { diagnostics = (diagnostics + safe(chunk)).slice(-12000); });
  const cancel = setInterval(() => {
    if (ended) return;
    if (!cancelRequested && fs.existsSync(path.join(directory, 'cancel.json'))) { cancelRequested = true; killDeadline = Date.now() + 3000; terminate(); }
    if (killDeadline && Date.now() >= killDeadline) { killDeadline = 0; terminate('SIGKILL'); }
  }, 100);
  child.stdin.on('error', () => {}); child.stdin.end(job.message);
  const { code, signal } = await new Promise(resolve => { child.once('error', error => { failure = safe(error.message); }); child.once('close', (code, signal) => resolve({ code, signal })); });
  ended = true; clearInterval(cancel); clearInterval(heartbeat);
  if (!oversized && buffer.trim()) line(buffer);
  if (windowsKill) await windowsKill;
  const result = parser.finish(code);
  if (result.answer.length > 200000) failure = '原生回答超过保留长度限制，未将裁剪内容确认为完整结果。';
  const succeeded = result.succeeded && !failure;
  // A cancellation receipt is not completion evidence. Natural successful exit
  // wins a cancel/exit race; otherwise require this worker's successful kill
  // plus the native process's termination exit/signal.
  const cancelled = !succeeded && cancelRequested && terminationSent && (process.platform === 'win32' ? code !== 0 : signal === 'SIGTERM' || signal === 'SIGKILL' || code === 143 || code === 137);
  const hint = job.adapter === 'dsh' ? '（headless 使用原生环境/.env 配置；GUI 保存的登录默认不用于该 profile。）' : '';
  const errorMessage = failure || result.error || diagnostics || names[job.adapter] + ' 退出但缺少可确认的本轮结果。';
  emit({ kind: 'terminal', status: cancelled ? 'cancelled' : succeeded ? 'succeeded' : 'failed', text: safe(cancelled ? '已确认原生执行进程结束' : succeeded ? result.answer : errorMessage + hint) });
}
module.exports = { NativeCliHost, capabilities };
if (require.main === module && process.argv[2] === '--native-cli-worker') runWorker(process.argv[3]).catch(error => { process.stderr.write(safe(error.stack)); process.exitCode = 1; });
