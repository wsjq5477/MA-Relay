const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const { Client, utils } = require('ssh2');
const { KnownHosts, problem } = require('./ssh-known-hosts.cjs');
const { CredentialStore } = require('./ssh-credentials.cjs');
const { SshInstaller, quote, remoteExec, progressFailure } = require('./ssh-install.cjs');
const { FramedStream } = require('./machine-protocol.cjs');
const {rejectedError}=require('./daemon-rejection.cjs');
const {supportsRecovery,supportsMcpOpenAccess}=require('./runtime-capabilities.cjs');

const SSH_METHODS = new Set(['machine.createSshDraft', 'credential.provide', 'machine.testSsh', 'machine.trustHost', 'machine.connectSsh', 'machine.reconnect', 'machine.disconnect', 'machine.maintenanceBlockers', 'machine.queryBlockedOperation']);
const {digest,operationId,atomicWrite}=require('./graph-layout.cjs');
const lifecycleMethods=new Set(['machine.updateSsh','machine.remove','machine.restore','machine.maintainDaemon']);
const fatal = new Set(['SSH_HOST_KEY_CHANGED', 'SSH_HOST_KEY_REVOKED', 'SSH_HOST_CA_UNSUPPORTED', 'SSH_KNOWN_HOSTS_INVALID', 'DAEMON_IDENTITY_CHANGED', 'MACHINE_IDENTITY_CHANGED', 'PROTOCOL_MISMATCH', 'DAEMON_OWNER_CONFLICT', 'DAEMON_PROTOCOL', 'REMOTE_DIRECTORY_UNSAFE', 'SSH_PACKAGE_CHECKSUM', 'SSH_PLATFORM_UNSUPPORTED', 'SSH_LIBC_UNSUPPORTED']);
/** A terminal maintenance receipt proves the original daemon is still running,
 * or that a previous version was restored and started, unless it reports that
 * the daemon was stopped without a confirmed switch or rollback. Receipts written
 * before `stopped` existed cannot report it, so they resume too; that reconnect
 * only observes or starts the version `current.json` names and never resends a
 * task or control action. */
function daemonAvailable(result, action) {
  if (!result || ['stop', 'uninstall'].includes(action)) return false;
  const data = result.data || {};
  return !(data.stopped === true && data.rolledBack !== true && result.state !== 'confirmed');
}
function safeFailure(error) {
  if (error?.code && typeof error.message === 'string' && (error.code.startsWith('SSH_') || error.code.startsWith('DAEMON_') || error.code.startsWith('DESKTOP_') || error.code.startsWith('CREDENTIAL_') || ['INVALID_INPUT', 'MACHINE_IDENTITY_CHANGED', 'PROTOCOL_MISMATCH', 'REMOTE_DIRECTORY_UNSAFE', 'INSTALL_PREVIEW_CHANGED', 'REQUEST_CONFLICT'].includes(error.code))) return error;
  return problem('SSH_CONNECTION_FAILED', 'SSH 连接失败，请检查地址、端口、用户认证及服务器网络。');
}
// The read-only blocker projection uses the same rules as the remote maintenance
// worker: non-terminal tasks/Agent work always block, an unconfirmed task or
// control receipt blocks until the user explicitly overrides it.
const terminalTask = new Set(['succeeded', 'failed', 'cancelled']);
const blockerTask = task => ({ ...(typeof task.taskId === 'string' ? { taskId: task.taskId } : {}), ...(typeof task.requestId === 'string' ? { requestId: task.requestId } : {}), ...(typeof task.executionId === 'string' ? { executionId: task.executionId } : {}), ...(typeof task.conversationId === 'string' ? { conversationId: task.conversationId } : {}), status: task.status, ...(typeof task.adapter === 'string' ? { adapter: task.adapter } : {}) });
const blockerAgent = agent => ({ ...(typeof agent.agentId === 'string' ? { agentId: agent.agentId } : {}), ...(typeof agent.nodeId === 'string' ? { nodeId: agent.nodeId } : {}), ...(typeof agent.adapter === 'string' ? { adapter: agent.adapter } : {}), busy: !!agent.busy, ...(agent.currentTask ? { currentTask: blockerTask(agent.currentTask) } : {}) });
const receiptBlocks = record => !['confirmed', 'rejected'].includes(record.state) || ['reply', 'cancel'].includes(record.op) && record.result?.state === 'unknown';
// A control receipt whose own result is unknown still blocks, and the daemon's ledger
// normalizes exactly that to `unknown`; report the same effective state.
const receiptState = record => receiptBlocks(record) && ['confirmed', 'rejected'].includes(record.state) ? 'unknown' : record.state;
const blockerReceipt = record => ({ key: typeof record.key === 'string' ? record.key : '', op: typeof record.op === 'string' ? record.op : '', state: typeof record.state === 'string' ? receiptState(record) : 'unknown', ...(typeof record.updatedAt === 'string' ? { updatedAt: record.updatedAt } : {}) });
function validateDraft(input) {
  let host = typeof input.host === 'string' ? input.host.trim().toLowerCase() : '';
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (!host || host.length > 253 || (!net.isIP(host) && !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host))) throw problem('INVALID_INPUT', '请输入有效的服务器 IP 或域名，不包含协议和路径。');
  const port = input.port === undefined || input.port === '' ? 22 : Number(input.port);
  const username = typeof input.username === 'string' ? input.username.trim() : '';
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !username || username.length > 128 || /[\0\r\n]/.test(username)) throw problem('INVALID_INPUT', 'SSH 用户名或端口不正确。');
  const authKind = input.authKind === 'key' ? 'privateKey' : input.authKind;
  if (!['password', 'privateKey', 'agent'].includes(authKind)) throw problem('INVALID_INPUT', '请选择密码、私钥文件或本机 ssh-agent。');
  if (authKind === 'privateKey' && (typeof input.keyPath !== 'string' || !path.isAbsolute(input.keyPath) || /[\0\r\n]/.test(input.keyPath))) throw problem('INVALID_INPUT', '请选择本机私钥文件的完整路径。');
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : username + '@' + host;
  if (name.length > 200 || /[\0\r\n]/.test(name)) throw problem('INVALID_INPUT', '机器名称过长或含不支持的字符。');
  return { name, host, port, username, authKind, ...(authKind === 'privateKey' ? { keyPath: input.keyPath } : {}) };
}
class SshHost {
  constructor(manager, connection) { this.manager = manager; this.connection = connection; this.pending = new Map(); this.channel = null; this.generation = 0; this.collaboration = null; this.heartbeat = null; this.pinging = false; }
  bind(stream) {
    this.detach(problem('DESKTOP_TRANSPORT', 'SSH 连接正在重新建立，请查询原请求。'));
    const generation = ++this.generation;
    const channel = this.channel = new FramedStream(stream);
    this.lastResponse = Date.now();
    channel.on('frame', value => {
      if (this.channel !== channel || this.generation !== generation) return;
      if (value.bridgeTool) { void this.callback(value, channel, generation); return; }
      if (value.event || value.wireEvent || value.type === 'event') {
        this.lastResponse = Date.now(); this.manager.touch(this.connection);
        if (this.connection.stage==='online'&&Number.isSafeInteger(value.cursor)) this.connection.lastCursor = Math.max(this.connection.lastCursor || 0, value.cursor);
        this.manager.options.onEvent?.(this.connection.machineId, value); return;
      }
      const request = this.pending.get(value.id);
      if (!request || request.generation !== generation) return;
      this.pending.delete(value.id); clearTimeout(request.timer); this.lastResponse = Date.now(); this.manager.touch(this.connection);
      if (value.error) request.reject(problem(value.error.code || 'DAEMON_ERROR', value.error.message || '远端后台请求失败。'));
      else request.resolve(value.result);
    });
    channel.on('error', error => { if (this.channel === channel) this.manager.disconnected(this.connection, problem(error.code || 'DESKTOP_TRANSPORT', 'SSH 后台消息通道中断，请查询原请求。')); });
    channel.on('close', () => { if (this.channel === channel) this.manager.disconnected(this.connection, problem('DESKTOP_TRANSPORT', 'SSH 通道已断开，远端已接收任务继续执行，请查询原请求。')); });
    stream.stderr?.resume();
  }
  async callback(value, channel, generation) {
    try {
      if (!this.collaboration) throw problem('COLLABORATION_OFFLINE', '中央协调通道尚未接入。');
      const result = await this.collaboration(value.scope, value.name, value.args, value.callId);
      if (this.channel === channel && this.generation === generation) channel.send({ bridgeReply: value.id, result });
    } catch (error) {
      if (this.channel === channel && this.generation === generation) {
        try { channel.send({ bridgeReply: value.id, error: { code: error.code || 'COLLABORATION_ERROR', message: error.message || '协作请求失败。' } }); } catch { /* Remote task stays owned by the daemon. */ }
      }
    }
  }
  request(method, params = {}, timeoutMs = 65000) {
    if (!this.channel || this.channel.closed) return Promise.reject(problem('DESKTOP_TRANSPORT', '远端机器尚未连接，请连接机器后再操作。'));
    if (this.pending.size >= 64) return Promise.reject(problem('SSH_RPC_BUSY', '此机器的在途请求达到上限，请稍后再试。'));
    if (typeof params.message === 'string' && Buffer.byteLength(params.message, 'utf8') > 65536) return Promise.reject(problem('INVALID_INPUT', '单次需求超过 64 KiB，请缩短需求或引用远端文件。'));
    const id = randomUUID(), generation = this.generation;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(problem('DESKTOP_TIMEOUT', '远端后台响应超时，执行结果可能未知。请查询原请求，不要重复提交。')); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, generation });
      try { this.channel.send({ id, method, params }); } catch (error) { this.pending.delete(id); clearTimeout(timer); reject(error); }
    });
  }
  async call(method, params = {}) {
    if (this.connection.stage !== 'online') throw problem('MACHINE_OFFLINE', this.connection.stage === 'needs_credentials' ? '远端机器需要重新输入 SSH 凭据。' : '远端机器当前离线，已接收任务仍由远端后台保留。');
    // A daemon that never advertised the MCP capability cannot report the richer
    // MCP state or persist a revocation. Refuse before any frame is sent and ask
    // for a daemon upgrade instead of returning old/default facts.
    if(this.connection.mcpOpenAccess===false&&['mcp.status','mcp.revoke','mcp.probe'].includes(method))
      throw problem('MCP_BACKEND_UPGRADE_REQUIRED','来源机器后台缺少MCP开放接入能力，请在该机器的后台维护中升级后台，再查看或撤销MCP接入；原配置与授权未改动。');
    if(this.connection.objectRoutingSupported===false&&(method==='context'||method==='scope'||method==='ipc'&&['task','conversation','pending','reply','cancel','operation','continue','reconcile','submit','verify'].includes(params.op)))
      throw problem('DAEMON_UPGRADE_REQUIRED','来源机器后台缺少原对象安全读取能力；请在该机器的后台维护中升级后台，再查询原任务。已接受任务不会重发。');
    if(params.adapter==='opendesk-desktop'&&['mcp.install','mcp.remove'].includes(method)&&this.connection.openDeskMcpLifecycle!==true)throw problem('MCP_BACKEND_UPGRADE_REQUIRED','来源后台未提供 OpenDesk 安全退出写入检查，请升级该机器后台后再管理配置；原文件未改动。');
    const generation=this.generation;
    try{return await this.request(method, params);}
    catch(error){
      // A bare configuration error is not evidence about an earlier submission.
      // Read the daemon's existing ledger on the same authenticated generation.
      if(method==='ipc'&&params.op==='request'&&params.requestId&&error.code==='NOT_CONFIGURED'){
        try{
          const record=await this.request('daemon.receiptRead',{requestId:params.requestId});
          if(this.generation===generation){const rejection=rejectedError(this.connection,record,params);if(rejection)throw rejection;}
        }catch(readError){if(readError.code==='DAEMON_REQUEST_REJECTED')throw readError;}
      }
      throw error;
    }
  }
  startHeartbeat() {
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      if (Date.now() - this.lastResponse >= 15000) { this.manager.disconnected(this.connection, problem('SSH_HEARTBEAT_TIMEOUT', '远端机器超过 15 秒没有响应，等待重新连接。')); return; }
      if (this.pinging) return;
      this.pinging = true; const nonce = randomUUID();
      void this.request('ping', { nonce }, 12000).then(value => { if (value?.nonce !== nonce) throw problem('DAEMON_PROTOCOL', '远端心跳身份核对失败。'); }).catch(error => { if (error.code === 'DAEMON_PROTOCOL') this.manager.disconnected(this.connection, error); }).finally(() => { this.pinging = false; });
    }, 5000); this.heartbeat.unref?.();
  }
  detach(error) {
    clearInterval(this.heartbeat); this.heartbeat = null;
    const previous = this.channel; this.channel = null; previous?.close();
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); } this.pending.clear();
  }
  close() { this.manager.dropTransport(this.connection); }
  setCollaboration(handler) { this.collaboration = handler; }
}
class SshManager {
  constructor(options) {
    this.options = options; this.file = path.join(options.directory, 'ssh-connections.json'); this.clients = new Map(); this.hosts = new Map(); this.challenges = new Map(); this.jobs = new Map(); this.reconnectTimers = new Map(); this.closed = false;
    this.platform = options.platform || process.platform;
    this.known = options.knownHosts || new KnownHosts(options.directory, { openSshFiles: options.openSshFiles });
    this.credentials = options.credentials || new CredentialStore(options.directory, { platform: this.platform });
    this.installer = options.installer || new SshInstaller(options);
    this.clientFactory = options.clientFactory || (() => new Client());
    const stored = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : { version: 1, connections: [], operations: {} };
    if (stored.version !== 1 || !Array.isArray(stored.connections)) throw problem('SSH_CONFIG_INVALID', 'SSH 连接配置无法读取，已有任务历史没有修改。');
    this.connections = stored.connections; this.operations = stored.operations || {}; this.lifecycleOperations=stored.lifecycleOperations||[];
    for (const connection of this.connections) {
      connection.stage = connection.removed ? 'removed' : connection.autoReconnect === false ? 'disconnected_manual' : 'disconnected'; connection.online = false;
      this.hosts.set(connection.connectionId, new SshHost(this, connection));
    }
  }
  save() {
    const fields = ['connectionId', 'revision', 'name', 'host', 'port', 'username', 'authKind', 'keyPath', 'credentialRef', 'autoReconnect', 'machineId', 'daemonId', 'trustedFingerprint', 'identity', 'stage', 'online', 'lastCursor', 'lastSeenAt', 'lastSyncedAt', 'error', 'removed','maintenance','daemonVersion','progressWarning'];
    const connections = this.connections.map(connection => Object.fromEntries(fields.filter(key => connection[key] !== undefined).map(key => [key, connection[key]])));
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    atomicWrite(this.file,{version:1,connections,operations:this.operations,lifecycleOperations:this.lifecycleOperations});
  }
  progress(connection,progress){
    connection.progress=progress;
    const previous=connection.progressNotice,now=Date.now();
    if(previous&&previous.phase===progress.phase&&now-previous.time<500&&progress.completedBytes!==progress.totalBytes)return;
    connection.progressNotice={phase:progress.phase,time:now};
    try{this.options.onChange?.(this.publicState(connection),{progressOnly:true});}
    catch(error){connection.progressWarning=progressFailure(error,progress);}
  }
  persistenceFailure(error,connection,phase,extracted=false){
    const causeCode=['EPERM','EACCES','EBUSY','ENOSPC','EDQUOT'].includes(error?.code)?error.code:'LOCAL_SAVE_FAILED',progress=connection.progress||{};
    return Object.assign(problem('DAEMON_PERSIST_FAILED','本地机器/维护台账保存失败（'+causeCode+'）；已确认 '+(progress.completedBytes||0)+' / '+(progress.totalBytes||0)+' 字节。原维护输入未发送，未切换后台，原版本与历史保留。'),{details:{stage:phase,causeCode,completedBytes:progress.completedBytes||0,totalBytes:progress.totalBytes||0,extracted,remoteInputSent:false}});
  }
  state(connection, stage, error) {
    connection.stage = stage; connection.online = stage === 'online';
    if (error) connection.error = { code: error.code || 'SSH_CONNECTION_FAILED', message: error.message, retryable: !fatal.has(error.code) }; else delete connection.error;
    this.save(); this.options.onChange?.(this.publicState(connection));
  }
  touch(connection) { connection.lastSeenAt = new Date().toISOString(); }
  publicState(connection) {
    return { connectionId: connection.connectionId, ...(connection.machineId ? { machineId: connection.machineId } : {}), revision:connection.revision, removed:!!connection.removed, name: connection.name, host: connection.host, port: connection.port, username: connection.username, authKind: connection.authKind === 'privateKey' ? 'key' : connection.authKind, ...(connection.keyPath ? { keyPath: connection.keyPath } : {}), kind: 'ssh', platform: 'linux', stage: connection.stage, status: connection.stage, connectionState: connection.stage, online: connection.online, daemonVersion:connection.daemonVersion||connection.identity?.daemonVersion,objectRoutingSupported:connection.objectRoutingSupported,mcpOpenAccess:connection.mcpOpenAccess,daemonMaintenance:connection.maintenance?{operationId:connection.maintenance.operationId,state:connection.maintenance.state,action:connection.maintenance.action,...(connection.maintenance.error?{error:connection.maintenance.error}:{})}:undefined,credentialAvailable: this.credentials.available(connection), credentialSaveSupported: this.credentials.saveSupported, ...(connection.lastSeenAt ? { lastSeenAt: connection.lastSeenAt } : {}), ...(connection.lastSyncedAt ? { lastSyncedAt: connection.lastSyncedAt } : {}), ...(connection.error ? { error: connection.error.message, connectionError: connection.error } : {}), ...(connection.probe ? { probe: connection.probe } : {}), ...(connection.progress ? { installProgress: connection.progress } : {}),...(connection.progressWarning?{progressWarning:connection.progressWarning}:{}) };
  }
  states() { return this.connections.map(connection => this.publicState(connection)); }
  /** Read-only pre-maintenance gate. It observes the live daemon over the existing
   * relay channel and never writes local or remote state. An unavailable channel is
   * reported instead of thrown so the dialog can still show why nothing is listed. */
  async maintenanceBlockers(connection) {
    const host = this.hosts.get(connection.connectionId);
    if (connection.stage !== 'online' || !host) {
      const maintaining = connection.stage === 'maintaining' || connection.maintenance?.state === 'unknown';
      return { available: false, reason: maintaining ? '远端后台正在维护，消息通道已暂停，暂不能读取前置门禁。' : connection.stage === 'needs_credentials' ? '远端机器需要重新输入 SSH 凭据。' : '远端机器当前离线，无法读取维护前置门禁。' };
    }
    try {
      const snapshot = await host.call('snapshot', {});
      const tasks = (snapshot.tasks || []).filter(task => !terminalTask.has(task.status)).map(blockerTask);
      const agents = ((snapshot.agents || {}).items || []).filter(agent => agent.busy || agent.currentTask && !terminalTask.has(agent.currentTask.status)).map(blockerAgent);
      let receipts = [], receiptsSupported = true;
      try { receipts = await this.readReceiptBlockers(host); }
      catch (error) { if (error.code !== 'DESKTOP_METHOD') throw error; receiptsSupported = false; }
      return { available: true, tasks, agents, receipts, receiptsSupported };
    } catch (error) { return { available: false, reason: error.message || '无法读取维护前置门禁。', code: error.code }; }
  }
  async readReceiptBlockers(host) {
    let after = 0, pages = 0; const receipts = [];
    do {
      const page = await host.call('daemon.receiptRead', { afterCursor: after, limit: 128 });
      if (!page || !Array.isArray(page.items)) throw problem('DAEMON_PROTOCOL', '后台收据分页无法读取。');
      for (const record of page.items) if (receiptBlocks(record)) receipts.push(blockerReceipt(record));
      after = page.nextCursor;
      if (!page.hasMore) break;
      if (++pages > 32) throw problem('DAEMON_PROTOCOL', '后台收据页数异常。');
    } while (true);
    return receipts;
  }
  /** One read-only query for the recorded original ID. `submit`-style receipts are
   * read as the original request, control receipts as the original operation; the
   * call never re-sends the task and never mints a new ID, and a failure keeps its
   * original code instead of being reported as success. */
  async queryBlockedOperation(connection, params) {
    const key = typeof params.key === 'string' ? params.key : '';
    if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(key)) throw problem('INVALID_INPUT', '按原 ID 查询需要合法的原操作标识。');
    const op = params.op;
    if (!['submit', 'continue', 'verify', 'reply', 'cancel'].includes(op)) throw problem('INVALID_INPUT', '只能按原 ID 查询已记录的任务或控制操作。');
    const host = this.hosts.get(connection.connectionId);
    if (connection.stage !== 'online' || !host) throw problem('MACHINE_OFFLINE', '远端机器当前离线，无法按原 ID 查询原操作。');
    const control = ['reply', 'cancel'].includes(op);
    const result = control ? await host.call('ipc', { op: 'operation', operationId: key }) : await host.call('ipc', { op: 'request', requestId: key });
    const state = result && ['confirmed', 'rejected', 'unknown'].includes(result.state) ? result.state : !control && result && typeof result.taskId === 'string' ? 'confirmed' : 'unknown';
    const detail = control
      ? { operationId: key, state: result?.state || state, ...(typeof result?.taskId === 'string' ? { taskId: result.taskId } : {}) }
      : { requestId: key, ...(typeof result?.taskId === 'string' ? { taskId: result.taskId } : {}), ...(typeof result?.status === 'string' ? { status: result.status } : {}) };
    return { state, detail };
  }
  find(params) {
    const connection = this.connections.find(row => params.connectionId ? row.connectionId === params.connectionId : params.machineId && row.machineId === params.machineId);
    if (!connection) throw problem('SSH_CONNECTION_NOT_FOUND', '这条 SSH 连接不存在，请刷新机器列表。'); return connection;
  }
  host(machine) { const connection = this.find(machine); return this.hosts.get(connection.connectionId); }
  async start() {
    for (const connection of this.connections.filter(row => row.machineId && !row.removed && row.autoReconnect !== false)) this.scheduleReconnect(connection, true);
  }
  async call(method, params = {}) {
    if(method==='machine.operation'){const row=this.lifecycleOperations.find(o=>o.operationId===params.operationId);if(row?.remoteInput&&row.state==='unknown')return this.queryMaintenance(row);return structuredClone(row?this.publicOperation(row):{operationId:params.operationId,state:'not_found'});}
    if(method==='machine.daemonPreview'){const c=this.find(params);if(this.jobs.has(c.connectionId))throw problem('MACHINE_BUSY','连接操作正在进行。');return this.serial(c,'preview',()=>this.maintenanceEntry(c));}
    if(lifecycleMethods.has(method)||['machine.disconnect','machine.reconnect'].includes(method)&&params.operationId)return this.lifecycle(method,params);
    if (!SSH_METHODS.has(method)) throw problem('METHOD', '不支持的 SSH 机器操作。');
    if (method === 'machine.createSshDraft') {
      const draft = validateDraft(params);
      const existing = this.connections.find(row => row.host === draft.host && row.port === draft.port && row.username === draft.username);
      if (existing) return { ...this.publicState(existing), existing: true };
      const connection = { connectionId: 'ssh-connection-' + randomUUID(), revision: 1, ...draft, autoReconnect: true, stage: 'draft', online: false };
      this.connections.push(connection); this.hosts.set(connection.connectionId, new SshHost(this, connection)); this.save(); this.options.onChange?.(this.publicState(connection)); return this.publicState(connection);
    }
    const connection = this.find(params);
    if(method==='machine.maintenanceBlockers')return this.maintenanceBlockers(connection);
    if(method==='machine.queryBlockedOperation')return this.queryBlockedOperation(connection,params);
    if(method==='machine.connectSsh'&&connection.maintenance?.state==='unknown')throw problem('DAEMON_MAINTENANCE','原维护尚未确认，请查询原操作；凭据可重新输入。');
    if(connection.removed)throw problem('MACHINE_REMOVED','机器已移除，请先恢复原机器。');
    if (method === 'credential.provide') { const result = await this.credentials.provide(connection, params); this.save(); this.options.onChange?.(this.publicState(connection)); return result; }
    if (method === 'machine.trustHost') {
      const challenge = this.challenges.get(connection.connectionId);
      if (!challenge || challenge.challengeId !== params.challengeId || challenge.fingerprint !== params.fingerprint || challenge.expiresAt < Date.now()) throw problem('SSH_TRUST_CHALLENGE_EXPIRED', '主机指纹确认已过期或不是当前探测结果，请重新检测。');
      this.known.trust(challenge.record); this.challenges.delete(connection.connectionId); connection.trustedFingerprint = challenge.fingerprint; this.state(connection, 'draft'); return { trusted: true, fingerprint: challenge.fingerprint };
    }
    if (method === 'machine.disconnect') { this.manualDisconnect(connection); return this.publicState(connection); }
    if (method === 'machine.testSsh') return this.serial(connection, 'test', () => this.test(connection));
    if (method === 'machine.reconnect') {
      connection.autoReconnect = true;
      return this.serial(connection, 'connect', () => this.connect(connection, { operationId: 'reconnect-' + randomUUID(), installIfNeeded: false }, true));
    }
    return this.serial(connection, 'connect', () => this.connect(connection, params));
  }
  async lifecycle(method,params){
    operationId(params.operationId);
    if(method==='machine.maintainDaemon')return this.maintainDaemon(params).catch(error=>{
      if(this.lifecycleOperations.some(r=>r.operationId===params.operationId)||['MACHINE_BUSY','DAEMON_BUSY','REVISION_CONFLICT','OPERATION_CONFLICT','INSTALL_PREVIEW_CHANGED','INVALID_INPUT','SSH_UPLOAD_FAILED','DAEMON_PERSIST_FAILED','SSH_PACKAGE_CHECKSUM','SSH_PACKAGE_EXTRACT'].includes(error.code))throw error;
      const c=this.connections.find(row=>row.connectionId===params.connectionId);
      if(c&&['SSH_AUTH_REQUIRED','SSH_AUTH_FAILED','CREDENTIAL_STORE_UNAVAILABLE'].includes(error.code)){this.state(c,'needs_credentials',error);throw error;}
      throw problem('DAEMON_STAGE_REJECTED','原维护未发送；登录、暂存或校验失败，原后台与历史保留。');
    });
    const fingerprint=digest({method,...params}),prior=this.lifecycleOperations.find(o=>o.operationId===params.operationId);
    if(prior){if(prior.fingerprint!==fingerprint)throw problem('OPERATION_CONFLICT','原机器操作 ID 已用于其他内容。');return structuredClone(prior);}
    const connection=this.find(params);
    if(params.machineId&&connection.machineId!==params.machineId)throw problem('WRONG_MACHINE','连接不属于这台机器。');
    if(this.jobs.has(connection.connectionId))throw problem('MACHINE_BUSY','连接正在检测、安装或重连，请稍后操作。');
    if(connection.removed&&method!=='machine.restore')throw problem('MACHINE_REMOVED','请先恢复原机器。');
    if(params.expectedRevision!==connection.revision)throw problem('REVISION_CONFLICT','连接配置已变化，请刷新后操作。');
    if(this.lifecycleOperations.length>=4096)throw problem('OPERATION_LIMIT','机器操作收据达到上限，请保留记录。');
    const next={...connection,revision:connection.revision+1};let forget=false;
    if(method==='machine.updateSsh'){
      const config=validateDraft(params.config||{});
      if(connection.daemonId&&config.username!==connection.username)throw problem('SSH_USER_CHANGE','已接入机器绑定原 SSH 用户；另一用户请添加为独立机器。');
      if(this.connections.some(c=>c!==connection&&c.host===config.host&&c.port===config.port&&c.username===config.username))throw problem('SSH_ENDPOINT_CONFLICT','这个地址和用户已有连接，请使用或恢复原连接。');
      forget=['host','port','username','authKind','keyPath'].some(k=>config[k]!==connection[k]);
      Object.assign(next,config);if(config.authKind!=='privateKey')delete next.keyPath;
      if(forget){delete next.credentialRef;}
    }
    const action=method.slice('machine.'.length),keepOnline=action==='reconnect'&&connection.stage==='online';
    next.removed=action==='remove'?true:action==='restore'?false:!!connection.removed;
    next.autoReconnect=keepOnline;next.stage=keepOnline?'online':next.removed?'removed':'disconnected_manual';next.online=keepOnline;
    delete next.probe;delete next.progress;delete next.error;
    if(action==='remove'){forget=true;delete next.credentialRef;}
    const receipt={operationId:params.operationId,state:'confirmed',fingerprint,data:{action,machineId:connection.machineId,connectionId:connection.connectionId,revision:next.revision}};
    // Configuration and its original receipt are one atomic local commit.
    const oldConnections=this.connections,oldOperations=this.lifecycleOperations,oldRef=connection.credentialRef;
    this.connections=this.connections.map(c=>c===connection?next:c);this.lifecycleOperations=[...oldOperations,receipt];
    try{this.save();}catch(e){this.connections=oldConnections;this.lifecycleOperations=oldOperations;throw e;}
    // Preserve the SshHost's object reference after the commit.
    for(const k of Object.keys(connection))if(!(k in next))delete connection[k];Object.assign(connection,next);
    this.connections=this.connections.map(c=>c===next?connection:c);
    clearTimeout(this.reconnectTimers.get(connection.connectionId));this.reconnectTimers.delete(connection.connectionId);
    this.challenges.delete(connection.connectionId);if(!keepOnline){this.credentials.discard(connection.connectionId);this.dropTransport(connection);}
    if(forget&&oldRef)this.credentials.remove(oldRef);
    this.options.onChange?.(this.publicState(connection));
    return structuredClone(receipt);
  }
  publicOperation(row){const {remoteInput,controller,...result}=row;return structuredClone(result);}
  /** Read-only maintenance preview. A session-budget-limited sshd can reject
   * the channel open of an otherwise healthy connection. No maintenance
   * intent exists yet, so the preview retries once on the same connection and
   * once on a fresh connection; nothing is resent or re-executed. */
  async maintenanceEntry(connection){
    const online=connection.stage==='online';
    const preview=async()=>this.installer.maintenancePreview(await this.authenticate(connection));
    try{return await preview();}
    catch(error){
      if(error?.code!=='SSH_EXEC_FAILED')throw error;
      await new Promise(resolve=>setTimeout(resolve,750));
      try{return await preview();}
      catch(retry){
        if(retry?.code!=='SSH_EXEC_FAILED')throw retry;
        this.dropTransport(connection);
        const result=await preview();
        // The maintenance flow detaches the relay itself before staging and
        // disables auto-reconnect, which makes the scheduled reconnect a no-op;
        // a plain entry preview must restore observation for a live machine.
        if(online&&!connection.removed){connection.autoReconnect=true;this.state(connection,'disconnected',problem('DESKTOP_TRANSPORT','维护入口重建连接，原执行保持。'));this.scheduleReconnect(connection,true);}
        return result;
      }
    }
  }
  async maintainDaemon(params){
    const fingerprint=digest(params),prior=this.lifecycleOperations.find(r=>r.operationId===params.operationId);
    if(prior){if(prior.fingerprint!==fingerprint)throw problem('OPERATION_CONFLICT','原维护 ID 内容变化。');return this.publicOperation(prior);}
    const c=this.find(params);if(c.revision!==params.expectedRevision)throw problem('REVISION_CONFLICT','机器连接修订已变化。');
    if(this.jobs.has(c.connectionId)||c.maintenance?.state==='unknown')throw problem('MACHINE_BUSY','原机器维护/连接尚未完成。');
    const config=params.config;if(!config||!['upgrade','rollback','stop','uninstall'].includes(config.action)||Object.keys(config).some(k=>!['action','previewId','expectedVersion','targetVersion','allowUnresolved'].includes(k)))throw problem('INVALID_INPUT','后台维护动作不合法。');
    // Strict boolean only: the unresolved-receipt override can never be implied.
    const allowUnresolvedReceipts=config.allowUnresolved===true;
    return this.serial(c,'maintenance',async()=>{
      const probe=await this.maintenanceEntry(c);
      if(config.previewId!==probe.previewId||config.expectedVersion!==probe.daemonVersion)throw problem('INSTALL_PREVIEW_CHANGED','维护摘要已变化，请重新检查。');
      const targetVersion=config.action==='upgrade'?probe.targetVersion:config.action==='rollback'?probe.rollbackVersion:undefined;
      if(['upgrade','rollback'].includes(config.action)&&(!targetVersion||config.targetVersion!==targetVersion))throw problem('INSTALL_PREVIEW_CHANGED','目标版本不符合当前可信摘要。');
      c.autoReconnect=false;clearTimeout(this.reconnectTimers.get(c.connectionId));this.reconnectTimers.delete(c.connectionId);delete c.progressNotice;delete c.progressWarning;try{this.save();}catch(error){throw this.persistenceFailure(error,c,'preparing');}
      const client=await this.authenticate(c);
      const staged=await this.installer.stageMaintenance(client,probe,params.operationId,progress=>this.progress(c,progress));
      if(staged.progressWarning)c.progressWarning ||= staged.progressWarning;
      // Verify the current file tree once for this input; compatibility release()
      // still reads and authenticates each pinned manifest against that tree.
      const bundle=this.installer.bundle(),from=this.installer.release(probe.daemonVersion,bundle),target=targetVersion?this.installer.release(targetVersion,bundle):null;
      const input={action:config.action,operationId:params.operationId,home:probe.home,installPath:probe.installPath,stateDirectory:probe.stateDirectory,ownerCoordinatorId:this.options.coordinatorId,profileId:probe.profileId,daemonId:c.daemonId,uid:probe.uid,allowUnresolvedReceipts,from:{version:from.manifest.version,digest:from.digest,manifest:from.manifest},target:target?{version:target.manifest.version,digest:target.digest,manifest:target.manifest}:null,controller:staged.release,releases:[staged.release,...(bundle.manifest.compatibleDaemons||[]).map(pin=>{const r=this.installer.release(pin.version,bundle);return {version:r.manifest.version,digest:r.digest,manifest:r.manifest};})]};
      const row={operationId:params.operationId,state:'unknown',remoteLaunched:false,fingerprint,remoteInput:input,controller:staged.directory,data:{action:'maintainDaemon',remoteAction:config.action,machineId:c.machineId,connectionId:c.connectionId,revision:c.revision+1}};
      // Progress is optional, but both catalogs and the original intent must be
      // durable before any maintenance input can reach the remote controller.
      try{
        this.options.onChange?.(this.publicState(c));
        this.lifecycleOperations=[...this.lifecycleOperations,row];this.save();
        c.revision++;c.maintenance={operationId:row.operationId,state:'unknown',action:config.action};this.hosts.get(c.connectionId)?.detach(problem('DESKTOP_TRANSPORT','后台维护中，原执行保持。'));delete c.probe;this.state(c,'maintaining');
        row.remoteLaunched=true;this.save();
      }catch(error){
        const failure=this.persistenceFailure(error,c,'before-maintenance-input',true);
        row.remoteLaunched=false;row.state='rejected';row.error={code:failure.code,message:failure.message,details:failure.details};
        if(!this.lifecycleOperations.includes(row))this.lifecycleOperations.push(row);
        c.maintenance={operationId:row.operationId,state:'rejected',action:config.action,error:row.error};c.error=row.error;c.stage='disconnected_manual';c.online=false;
        try{this.save();}catch{/* The central original intent remains durable if this store is unavailable. */}
        throw failure;
      }
      delete c.progress;
      try{await this.installer.remoteMaintenance(client,input,row.controller);}
      catch(error){
        // A rejected channel open proves the original input never left this
        // machine, so one fresh-connection retry is not a second send. A second
        // pre-transmission rejection marks the receipt rejected, never unknown;
        // any other failure keeps the durable unknown row for original-ID query.
        if(error?.code==='SSH_EXEC_FAILED'&&error.details?.stage==='open'){
          // The first channel never accepted input. Persist this proof before
          // obtaining a fresh login; missing credentials cannot create an
          // unknown remote intent that will forever query as not_found.
          row.remoteLaunched=false;this.save();this.dropTransport(c);
          try{
            const retryClient=await this.authenticate(c);
            row.remoteLaunched=true;this.save();
            await this.installer.remoteMaintenance(retryClient,input,row.controller);
          }
          catch(retry){
            if(retry?.code==='SSH_EXEC_FAILED'&&retry.details?.stage==='open')row.remoteLaunched=false;
            if(row.remoteLaunched===false){
              row.state='rejected';row.error={code:'DAEMON_NOT_STARTED',message:'原维护输入未能发送到服务器，未切换后台；请重新检查后再操作。'};
              c.maintenance={...c.maintenance,state:'rejected',error:row.error};
              const failure=safeFailure(retry);
              this.state(c,['SSH_AUTH_REQUIRED','SSH_AUTH_FAILED','CREDENTIAL_STORE_UNAVAILABLE'].includes(failure.code)?'needs_credentials':fatal.has(failure.code)?'blocked':'disconnected_manual',failure);
            }
          }
        }
      }
      return this.publicOperation(row);
    });
  }
  /** The original-ID query is the only recovery path for an unknown intent, so
   * a pre-transmission channel-open rejection gets one fresh-connection retry. */
  async queryWithRecovery(connection,row){
    const query=async client=>this.installer.remoteMaintenance(client,{...row.remoteInput,action:'query'},row.controller);
    try{return await query(await this.authenticate(connection));}
    catch(error){
      if(error?.code!=='SSH_EXEC_FAILED'||error.details?.stage!=='open')throw error;
      this.dropTransport(connection);
      return query(await this.authenticate(connection));
    }
  }
  async queryMaintenance(row){
    const c=this.find({connectionId:row.data.connectionId});
    if(row.remoteLaunched===false){
      row.state='rejected';row.error={code:'DAEMON_NOT_STARTED',message:'原维护未到远端发送阶段，未切换后台。'};
      if(c.maintenance?.operationId===row.operationId){
        c.maintenance={...c.maintenance,state:'rejected',error:row.error};c.autoReconnect=false;
        const preserveFailure=['needs_credentials','blocked'].includes(c.stage);
        this.state(c,preserveFailure?c.stage:'disconnected_manual',preserveFailure?c.error:undefined);
      }else this.save();
      return this.publicOperation(row);
    }
    try{
      const result=await this.queryWithRecovery(c,row);
      if(result.operationId!==row.operationId||!['confirmed','rejected'].includes(result.state))return this.publicOperation(row);
      row.state=result.state;row.error=result.error;row.data={...row.data,...result.data,action:'maintainDaemon',remoteAction:row.remoteInput.action};
      c.maintenance={...c.maintenance,state:result.state,...(result.error?{error:{code:result.error.code,message:result.error.message,...(result.error.details?{details:result.error.details}:{})}}:{error:undefined})};c.daemonVersion=result.data?.version;this.save();
      const removed=result.state==='confirmed'&&row.remoteInput.action==='uninstall';c.removed=removed;
      // A rejected upgrade that never stopped the remote daemon used to leave the
      // machine permanently "已断开" (autoReconnect=false) even though the daemon
      // was still running. A terminal receipt that does not report a stopped,
      // unrestored daemon releases the maintenance hold and observation resumes;
      // this also covers a receipt resolved after a desktop restart.
      if(removed||!daemonAvailable(result,row.remoteInput.action)){c.autoReconnect=false;if(removed||['stop','uninstall'].includes(row.remoteInput.action))this.dropTransport(c);this.state(c,removed?'removed':'disconnected_manual');}
      else{c.autoReconnect=true;this.save();this.state(c,'reconnecting');this.scheduleReconnect(c,true);}
    }catch(error){const failure=safeFailure(error);this.state(c,['SSH_AUTH_REQUIRED','SSH_AUTH_FAILED','CREDENTIAL_STORE_UNAVAILABLE'].includes(failure.code)?'needs_credentials':fatal.has(failure.code)?'blocked':'maintaining',failure);}
    return this.publicOperation(row);
  }
  async resumeConnection(connectionId,expectedRevision){
    const connection=this.find({connectionId});if(connection.revision!==expectedRevision||connection.removed||connection.stage==='online')return;
    connection.autoReconnect=true;this.save();
    // Observation recovery may retry. It never resends a task or control action.
    this.scheduleReconnect(connection,true);
  }
  serial(connection, kind, operation) {
    const current = this.jobs.get(connection.connectionId);
    const run = current ? current.promise.catch(() => {}).then(operation) : Promise.resolve().then(operation);
    const promise = run.finally(() => { if (this.jobs.get(connection.connectionId)?.promise === promise) this.jobs.delete(connection.connectionId); });
    this.jobs.set(connection.connectionId, { kind, promise }); return promise;
  }
  async authenticate(connection) {
    const old = this.clients.get(connection.connectionId); if (old?.ready) return old.client;
    this.state(connection, 'validating_host');
    return new Promise((resolve, reject) => {
      const client = this.clientFactory(); let authorityError, authenticationError, ready = false, settled = false, attempted = false, authBuffers = [];
      const attempt = { client, ready: false }; this.clients.set(connection.connectionId, attempt);
      const clearInput = () => { for (const buffer of authBuffers) buffer.fill(0); authBuffers = []; if (attempted || authorityError?.code !== 'SSH_HOST_TRUST_REQUIRED') this.credentials.discard(connection.connectionId); };
      const fail = error => {
        if (settled) return; settled = true; clearTimeout(timer); clearInput();
        if (this.clients.get(connection.connectionId) === attempt) this.clients.delete(connection.connectionId);
        client.end(); reject(error);
      };
      const timer = setTimeout(() => fail(problem('SSH_LOGIN_TIMEOUT', 'SSH 登录超过 20 秒，请检查网络及 SSH 服务。')), 20000);
      client.on('ready', () => {
        if (settled) return; settled = true; ready = true; attempt.ready = true; clearTimeout(timer); clearInput();
        if (client.config) { client.config.password = undefined; client.config.passphrase = undefined; client.config.privateKey = undefined; }
        resolve(client);
      });
      client.on('error', error => {
        const failure = authorityError || authenticationError || (error.level === 'client-authentication' ? problem('SSH_AUTH_FAILED', 'SSH 用户认证失败，请检查密码、私钥或 ssh-agent。') : problem('SSH_CONNECTION_FAILED', 'SSH 连接失败，请检查服务器地址、端口及网络。'));
        if (!ready) fail(failure);
        else if (this.clients.get(connection.connectionId) === attempt) this.disconnected(connection, failure);
      });
      client.on('close', () => {
        if (this.clients.get(connection.connectionId) !== attempt) return;
        if (!ready) fail(authorityError || authenticationError || problem('SSH_CONNECTION_FAILED', 'SSH 登录通道已关闭。'));
        else this.disconnected(connection, problem('DESKTOP_TRANSPORT', 'SSH 连接已断开，远端任务保持原执行，请查询原请求。'));
      });
      try {
        client.connect({
          host: connection.host, port: connection.port, username: connection.username, readyTimeout: 20000, keepaliveInterval: 5000, keepaliveCountMax: 3, agentForward: false, tryKeyboard: false,
          hostVerifier: (key, verify) => {
            try {
              const record = this.known.check(connection.host, connection.port, key);
              if(connection.daemonId&&connection.trustedFingerprint&&record.fingerprint!==connection.trustedFingerprint)throw problem('SSH_HOST_KEY_CHANGED','原机器的 SSH 主机密钥不匹配，不能接管历史。');
              if (record.trusted) { connection.trustedFingerprint = record.fingerprint; verify(true); return; }
              const challenge = { challengeId: randomUUID(), fingerprint: record.fingerprint, host: connection.host, port: connection.port, keyType: record.keyType, expiresAt: Date.now() + 300000, record };
              this.challenges.set(connection.connectionId, challenge); authorityError = problem('SSH_HOST_TRUST_REQUIRED', '请先确认这台服务器的 SSH 主机指纹。'); verify(false);
            } catch (error) { authorityError = safeFailure(error); verify(false); }
          },
          authHandler: (_methods, _partial, next) => {
            if (attempted) { if (_methods?.includes('keyboard-interactive') && !_methods.includes(connection.authKind === 'privateKey' ? 'publickey' : connection.authKind)) authenticationError = problem('SSH_INTERACTIVE_REQUIRED', '服务器要求交互式认证或 MFA，请先使用原生 SSH 处理；当前后台接入不支持此认证流程。'); next(false); return; } attempted = true;
            this.state(connection, 'authenticating');
            void (async () => {
              let secret = await this.credentials.read(connection);
              if (connection.authKind === 'password') {
                if (secret === undefined) throw problem('SSH_AUTH_REQUIRED', '请输入此 SSH 用户的密码。');
                const buffer = Buffer.from(secret, 'utf8'); secret = undefined; authBuffers.push(buffer); next({ type: 'password', username: connection.username, password: buffer });
              } else if (connection.authKind === 'privateKey') {
                let key;
                try { const stat = fs.statSync(connection.keyPath); if (!stat.isFile() || stat.size > 1048576) throw new Error(); key = fs.readFileSync(connection.keyPath); } catch { throw problem('SSH_KEY_UNAVAILABLE', '本机私钥文件不存在、无法读取或格式不正确。'); }
                authBuffers.push(key); const parsed = utils.parseKey(key, secret);
                if (parsed instanceof Error) { if (secret === undefined) throw problem('SSH_AUTH_REQUIRED', '此私钥需要解密口令，请输入后重新连接。'); throw problem('SSH_KEY_UNAVAILABLE', '私钥格式或解密口令无效，请检查文件和口令。'); }
                if (!parsed.isPrivateKey()) throw problem('SSH_KEY_UNAVAILABLE', '所选文件不是 SSH 私钥。');
                next({ type: 'publickey', username: connection.username, key, passphrase: secret }); secret = undefined;
              } else {
                secret = undefined; const endpoint = this.options.agentEndpoint || (this.platform === 'win32' ? '\\\\.\\pipe\\openssh-ssh-agent' : process.env.SSH_AUTH_SOCK);
                if (!endpoint) throw problem('SSH_AGENT_UNAVAILABLE', '没有可用的本机 ssh-agent，请改用密码或私钥文件。');
                next({ type: 'agent', username: connection.username, agent: endpoint });
              }
            })().catch(error => { authenticationError = safeFailure(error); next(false); });
          },
        });
      } catch (error) { fail(safeFailure(error)); }
    });
  }
  async test(connection) {
    try {
      const client = await this.authenticate(connection); this.state(connection, 'inspecting');
      connection.probe = await this.installer.probe(client);
      this.state(connection, 'ready');
      const attempt = this.clients.get(connection.connectionId);
      clearTimeout(attempt?.idleTimer);
      if (attempt) { attempt.idleTimer = setTimeout(() => { if (connection.stage === 'ready') this.disconnected(connection, problem('SSH_PREVIEW_EXPIRED', '连接检测已过期，请重新输入凭据并检测。')); }, 300000); attempt.idleTimer.unref?.(); }
      return { ...this.publicState(connection), probe: connection.probe, saveSupported: this.credentials.saveSupported };
    } catch (error) {
      const failure = safeFailure(error);
      if (failure.code === 'SSH_HOST_TRUST_REQUIRED') {
        this.state(connection, 'awaiting_host_trust'); const { record, expiresAt, ...challenge } = this.challenges.get(connection.connectionId);
        return { ...this.publicState(connection), trustChallenge: challenge };
      }
      if (failure.code === 'SSH_AUTH_REQUIRED') { this.state(connection, 'needs_credentials', failure); return this.publicState(connection); }
      this.state(connection, fatal.has(failure.code) ? 'blocked' : failure.code === 'SSH_AUTH_FAILED' ? 'needs_credentials' : 'disconnected', failure); throw failure;
    }
  }
  async connect(connection, input, reconnect = false) {
    if (connection.stage === 'online') return this.publicState(connection);
    if (typeof input.operationId !== 'string' || !input.operationId || input.operationId.length > 200) throw problem('INVALID_INPUT', '连接安装操作需要稳定的操作 ID。');
    const prior = this.operations[input.operationId];
    if (prior && prior.connectionId !== connection.connectionId) throw problem('REQUEST_CONFLICT', '此操作 ID 已用于另一条机器连接。');
    try {
      if (!this.clients.get(connection.connectionId)?.ready || !connection.probe) {
        const tested = await this.test(connection); if (tested.status !== 'ready') return tested;
      }
      const client = this.clients.get(connection.connectionId).client, probe = connection.probe;
      if (prior?.previewId && prior.previewId !== probe.previewId && prior.status !== 'confirmed') throw problem('INSTALL_PREVIEW_CHANGED', '原安装摘要已变化，请重新检测后确认。');
      if (probe.installNeeded && (!input.installIfNeeded || reconnect)) throw problem('SSH_INSTALL_CONFIRMATION_REQUIRED', '远端需要安装后台，请先查看安装摘要并点击“安装并连接”。');
      const operation = this.operations[input.operationId] = { connectionId: connection.connectionId, previewId: probe.previewId, status: 'pending', updatedAt: new Date().toISOString() }; this.save();
      connection.autoReconnect = true; clearTimeout(this.clients.get(connection.connectionId).idleTimer);
      this.state(connection, probe.installNeeded ? 'installing' : 'starting');
      const install = await this.installer.install(client, probe, input.operationId, progress => this.progress(connection,progress));
      delete connection.progress; this.state(connection, 'starting');
      const common = ' --state-directory ' + quote(install.stateDirectory) + ' --owner ' + quote(this.options.coordinatorId) + ' --profile ' + quote(install.profileId);
      const raw = await remoteExec(client, quote(install.node) + ' ' + quote(path.posix.join(install.versionPath, 'desktop/electron/machine-daemon.cjs')) + common, '', { timeoutMs: 20000, errorCode: 'DAEMON_START_FAILED', errorMessage: 'Linux 后台启动失败，请检查目录拥有权和运行环境。' });
      let identity; try { identity = JSON.parse(raw); } catch { throw problem('SSH_BOOTSTRAP_OUTPUT', '后台启动输出不符合协议，请检查非交互登录脚本。'); }
      if (typeof identity.daemonId !== 'string' || !/^[a-f0-9-]{20,80}$/.test(identity.daemonId) || identity.uid !== probe.uid || identity.ownerCoordinatorId !== this.options.coordinatorId || identity.profileId !== install.profileId || identity.protocolVersion !== 2) throw problem('DAEMON_IDENTITY_CHANGED', '远端后台身份、用户或所属中央不符合预期，连接已停止。');
      if(connection.identity&&connection.identity.uid!==probe.uid)throw problem('MACHINE_IDENTITY_CHANGED','SSH 用户执行域已变化，不能接管原历史。');
      if (connection.daemonId && connection.daemonId !== identity.daemonId) throw problem('DAEMON_IDENTITY_CHANGED', '远端后台身份已变化，不能接管原机器的任务和历史。');
      const collision = this.connections.find(row => row !== connection && row.daemonId === identity.daemonId && row.trustedFingerprint !== connection.trustedFingerprint);
      if (collision) throw problem('DAEMON_IDENTITY_CHANGED', '这个后台 UUID 已由不同 SSH 主机公钥使用，请核实复制目录或服务器身份。');
      for (const duplicate of this.connections.filter(row => row !== connection && row.daemonId === identity.daemonId && row.trustedFingerprint === connection.trustedFingerprint)) {
        duplicate.autoReconnect = false; this.dropTransport(duplicate); this.state(duplicate, 'disconnected_manual');
      }
      const stream = await new Promise((resolve, reject) => client.exec(quote(install.node) + ' ' + quote(path.posix.join(install.versionPath, 'desktop/electron/machine-relay.cjs')) + common + ' --expected-daemon ' + quote(identity.daemonId), { pty: false }, (error, channel) => error ? reject(problem('SSH_EXEC_FAILED', '无法打开 SSH 后台消息通道。')) : resolve(channel)));
      const host = this.hosts.get(connection.connectionId); host.bind(stream); this.state(connection, 'handshaking');
      const nonce = randomUUID(), sessionId = randomUUID();
      const hello = await host.request('hello', { nonce, sessionId, coordinatorId: this.options.coordinatorId, profileId: install.profileId, expectedDaemonId: identity.daemonId, protocolVersion: 2 }, 10000);
      if (hello.kind !== 'agentbridge-machine' || hello.nonce !== nonce || hello.sessionId !== sessionId || hello.daemonId !== identity.daemonId || hello.uid !== probe.uid || hello.ownerCoordinatorId !== this.options.coordinatorId || hello.profileId !== install.profileId || hello.protocolVersion !== 2 || hello.version !== install.version) throw problem('DAEMON_IDENTITY_CHANGED', 'SSH 后台协议握手未通过身份或版本核对。');
      const machineId = 'ssh-' + identity.daemonId;
      connection.machineId = machineId; connection.daemonId = identity.daemonId;
      connection.daemonVersion=hello.version;
      connection.objectRoutingSupported=supportsRecovery(hello.capabilities);
      connection.mcpOpenAccess=supportsMcpOpenAccess(hello.capabilities);
      connection.openDeskMcpLifecycle=Array.isArray(hello.capabilities)&&hello.capabilities.includes('opendesk-mcp-lifecycle-v1');
      connection.identity = { machineId, name: connection.name, kind: 'ssh', platform: 'linux', connectionId: connection.connectionId, daemonId: identity.daemonId, hostname: hello.hostname, username: connection.username, uid: probe.uid, arch: probe.arch, daemonVersion: hello.version, objectRoutingSupported:connection.objectRoutingSupported, mcpOpenAccess:connection.mcpOpenAccess, protocolVersion: 2, profileId: install.profileId, installDirectory: probe.installPath, stateDirectory: install.stateDirectory, host: connection.host, port: connection.port };
      // Resume observation only; this path never submits an Agent Prompt.
      this.options.onMachine?.(connection.identity);
      await this.restoreObservation(host,connection,machineId);
      operation.status = 'confirmed'; operation.machineId = machineId; operation.updatedAt = new Date().toISOString();
      connection.lastSyncedAt = new Date().toISOString(); this.state(connection, 'online');
      this.options.onMachine?.(connection.identity); host.startHeartbeat(); return this.publicState(connection);
    } catch (error) {
      const failure = safeFailure(error); const operation = this.operations[input.operationId]; if (operation?.status === 'pending') { operation.status = failure.code === 'SSH_UPLOAD_FAILED' ? 'rejected' : 'unknown'; operation.errorCode = failure.code; }
      if (['SSH_UPLOAD_FAILED','SSH_INSTALL_CONFIRMATION_REQUIRED'].includes(failure.code)) {
        connection.autoReconnect = false;
        clearTimeout(this.reconnectTimers.get(connection.connectionId)); this.reconnectTimers.delete(connection.connectionId);
      }
      this.dropTransport(connection);
      this.state(connection, fatal.has(failure.code) ? 'blocked' : ['SSH_AUTH_REQUIRED', 'SSH_AUTH_FAILED'].includes(failure.code) ? 'needs_credentials' : 'disconnected', failure); throw failure;
    }
  }
  async restoreObservation(host,connection,machineId){
    let after=connection.lastCursor||0,pages=0;
    do{
      const events=await host.request('daemon.eventRead',{afterCursor:after,limit:128},15000);
      if(events.cursorGap||events.cursorExpired){
        const snapshot=await host.request('snapshot',{},15000);
        await this.options.onSnapshot?.(machineId,snapshot);
      }
      for(const event of events.items||events.events||[]){
        if(!Number.isSafeInteger(event.cursor)||event.cursor<=after)continue;
        await this.options.onEvent?.(machineId,event);after=event.cursor;
      }
      const next=events.nextCursor??after;
      if(!Number.isSafeInteger(next)||next!==after||events.hasMore&&next<=connection.lastCursor)throw problem('DAEMON_PROTOCOL','事件恢复游标无法推进，保留原执行。');
      connection.lastCursor=after=next;
      if(!events.hasMore)return;
      if(++pages>32)throw problem('DAEMON_PROTOCOL','事件恢复页数异常，保留原执行。');
    }while(true);
  }
  dropTransport(connection) {
    const attempt = this.clients.get(connection.connectionId); this.clients.delete(connection.connectionId); clearTimeout(attempt?.idleTimer);
    this.hosts.get(connection.connectionId)?.detach(problem('DESKTOP_TRANSPORT', 'SSH 连接已断开；远端任务状态请查询原请求。')); attempt?.client.end();
  }
  disconnected(connection, error) {
    if (this.closed || !this.clients.has(connection.connectionId)) return;
    this.dropTransport(connection);
    if (connection.autoReconnect === false) { this.state(connection, 'disconnected_manual'); return; }
    if (fatal.has(error.code)) { this.state(connection, 'blocked', error); return; }
    if (connection.authKind === 'password' && !connection.credentialRef && !this.credentials.memory.has(connection.connectionId)) { this.state(connection, 'needs_credentials', problem('SSH_AUTH_REQUIRED', 'SSH 连接已断开，需要重新输入密码。已接收任务保留在远端。')); return; }
    this.state(connection, 'disconnected', error); this.scheduleReconnect(connection);
  }
  scheduleReconnect(connection, immediately = false) {
    if (this.closed || connection.removed || connection.autoReconnect === false || this.reconnectTimers.has(connection.connectionId)) return;
    if (connection.authKind === 'password' && !connection.credentialRef&&!this.clients.get(connection.connectionId)?.ready) { this.state(connection, 'needs_credentials', problem('SSH_AUTH_REQUIRED', '请输入 SSH 密码以恢复原机器连接。')); return; }
    connection.reconnectCount = immediately ? 0 : (connection.reconnectCount || 0) + 1;
    const delay = immediately ? 0 : Math.min(8000, 1000 * 2 ** (connection.reconnectCount - 1)) * (0.8 + Math.random() * 0.2);
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(connection.connectionId); if (this.closed || connection.removed || connection.autoReconnect === false) return;
      this.state(connection, 'reconnecting');
      void this.serial(connection, 'connect', () => this.connect(connection, { operationId: 'reconnect-' + randomUUID(), installIfNeeded: false }, true)).then(result => { if (result.status === 'online') connection.reconnectCount = 0; }).catch(error => { if (!fatal.has(error.code) && !['SSH_AUTH_REQUIRED', 'SSH_AUTH_FAILED'].includes(error.code)) this.scheduleReconnect(connection); });
    }, delay); timer.unref?.(); this.reconnectTimers.set(connection.connectionId, timer);
  }
  manualDisconnect(connection) {
    connection.autoReconnect = false; clearTimeout(this.reconnectTimers.get(connection.connectionId)); this.reconnectTimers.delete(connection.connectionId); this.credentials.discard(connection.connectionId); this.dropTransport(connection); this.state(connection, 'disconnected_manual');
  }
  close() { this.closed = true; for (const timer of this.reconnectTimers.values()) clearTimeout(timer); this.reconnectTimers.clear(); for (const connection of this.connections) this.dropTransport(connection); this.credentials.close(); }
}
module.exports = { SshManager, SshHost, SSH_METHODS, validateDraft, safeFailure };
