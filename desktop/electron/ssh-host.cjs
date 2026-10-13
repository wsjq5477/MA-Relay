const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const { Client, utils } = require('ssh2');
const { KnownHosts, problem } = require('./ssh-known-hosts.cjs');
const { CredentialStore } = require('./ssh-credentials.cjs');
const { SshInstaller, quote, remoteExec } = require('./ssh-install.cjs');
const { FramedStream } = require('./machine-protocol.cjs');

const SSH_METHODS = new Set(['machine.createSshDraft', 'credential.provide', 'machine.testSsh', 'machine.trustHost', 'machine.connectSsh', 'machine.reconnect', 'machine.disconnect']);
const fatal = new Set(['SSH_HOST_KEY_CHANGED', 'SSH_HOST_KEY_REVOKED', 'SSH_HOST_CA_UNSUPPORTED', 'SSH_KNOWN_HOSTS_INVALID', 'DAEMON_IDENTITY_CHANGED', 'MACHINE_IDENTITY_CHANGED', 'PROTOCOL_MISMATCH', 'DAEMON_OWNER_CONFLICT', 'DAEMON_PROTOCOL', 'REMOTE_DIRECTORY_UNSAFE', 'SSH_PACKAGE_CHECKSUM', 'SSH_PLATFORM_UNSUPPORTED', 'SSH_LIBC_UNSUPPORTED']);
function safeFailure(error) {
  if (error?.code && typeof error.message === 'string' && (error.code.startsWith('SSH_') || error.code.startsWith('DAEMON_') || error.code.startsWith('DESKTOP_') || error.code.startsWith('CREDENTIAL_') || ['INVALID_INPUT', 'MACHINE_IDENTITY_CHANGED', 'PROTOCOL_MISMATCH', 'REMOTE_DIRECTORY_UNSAFE', 'INSTALL_PREVIEW_CHANGED', 'REQUEST_CONFLICT'].includes(error.code))) return error;
  return problem('SSH_CONNECTION_FAILED', 'SSH 连接失败，请检查地址、端口、用户认证及服务器网络。');
}
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
        if (Number.isSafeInteger(value.cursor)) this.connection.lastCursor = Math.max(this.connection.lastCursor || 0, value.cursor);
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
    return this.request(method, params);
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
    this.connections = stored.connections; this.operations = stored.operations || {};
    for (const connection of this.connections) {
      connection.stage = connection.autoReconnect === false ? 'disconnected_manual' : 'disconnected'; connection.online = false;
      this.hosts.set(connection.connectionId, new SshHost(this, connection));
    }
  }
  save() {
    const fields = ['connectionId', 'revision', 'name', 'host', 'port', 'username', 'authKind', 'keyPath', 'credentialRef', 'autoReconnect', 'machineId', 'daemonId', 'trustedFingerprint', 'identity', 'stage', 'online', 'lastCursor', 'lastSeenAt', 'lastSyncedAt', 'error'];
    const connections = this.connections.map(connection => Object.fromEntries(fields.filter(key => connection[key] !== undefined).map(key => [key, connection[key]])));
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 }); const temp = this.file + '.' + randomUUID() + '.tmp';
    fs.writeFileSync(temp, JSON.stringify({ version: 1, connections, operations: this.operations }, null, 2), { mode: 0o600 }); fs.renameSync(temp, this.file);
  }
  state(connection, stage, error) {
    connection.stage = stage; connection.online = stage === 'online';
    if (error) connection.error = { code: error.code || 'SSH_CONNECTION_FAILED', message: error.message, retryable: !fatal.has(error.code) }; else delete connection.error;
    this.save(); this.options.onChange?.(this.publicState(connection));
  }
  touch(connection) { connection.lastSeenAt = new Date().toISOString(); }
  publicState(connection) {
    return { connectionId: connection.connectionId, ...(connection.machineId ? { machineId: connection.machineId } : {}), name: connection.name, host: connection.host, port: connection.port, username: connection.username, authKind: connection.authKind === 'privateKey' ? 'key' : connection.authKind, ...(connection.keyPath ? { keyPath: connection.keyPath } : {}), kind: 'ssh', platform: 'linux', stage: connection.stage, status: connection.stage, connectionState: connection.stage, online: connection.online, credentialAvailable: this.credentials.available(connection), credentialSaveSupported: this.credentials.saveSupported, ...(connection.lastSeenAt ? { lastSeenAt: connection.lastSeenAt } : {}), ...(connection.lastSyncedAt ? { lastSyncedAt: connection.lastSyncedAt } : {}), ...(connection.error ? { error: connection.error.message, connectionError: connection.error } : {}), ...(connection.probe ? { probe: connection.probe } : {}), ...(connection.progress ? { installProgress: connection.progress } : {}) };
  }
  states() { return this.connections.map(connection => this.publicState(connection)); }
  find(params) {
    const connection = this.connections.find(row => params.connectionId ? row.connectionId === params.connectionId : params.machineId && row.machineId === params.machineId);
    if (!connection) throw problem('SSH_CONNECTION_NOT_FOUND', '这条 SSH 连接不存在，请刷新机器列表。'); return connection;
  }
  host(machine) { const connection = this.find(machine); return this.hosts.get(connection.connectionId); }
  async start() {
    for (const connection of this.connections.filter(row => row.machineId && row.autoReconnect !== false)) this.scheduleReconnect(connection, true);
  }
  async call(method, params = {}) {
    if (!SSH_METHODS.has(method)) throw problem('METHOD', '不支持的 SSH 机器操作。');
    if (method === 'machine.createSshDraft') {
      const draft = validateDraft(params);
      const existing = this.connections.find(row => row.host === draft.host && row.port === draft.port && row.username === draft.username);
      if (existing) return { ...this.publicState(existing), existing: true };
      const connection = { connectionId: 'ssh-connection-' + randomUUID(), revision: 1, ...draft, autoReconnect: true, stage: 'draft', online: false };
      this.connections.push(connection); this.hosts.set(connection.connectionId, new SshHost(this, connection)); this.save(); this.options.onChange?.(this.publicState(connection)); return this.publicState(connection);
    }
    const connection = this.find(params);
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
      const install = await this.installer.install(client, probe, input.operationId, progress => { connection.progress = progress; this.options.onChange?.(this.publicState(connection)); });
      delete connection.progress; this.state(connection, 'starting');
      const common = ' --state-directory ' + quote(install.stateDirectory) + ' --owner ' + quote(this.options.coordinatorId) + ' --profile ' + quote(install.profileId);
      const raw = await remoteExec(client, quote(install.node) + ' ' + quote(path.posix.join(install.versionPath, 'desktop/electron/machine-daemon.cjs')) + common, '', { timeoutMs: 20000, errorCode: 'DAEMON_START_FAILED', errorMessage: 'Linux 后台启动失败，请检查目录拥有权和运行环境。' });
      let identity; try { identity = JSON.parse(raw); } catch { throw problem('SSH_BOOTSTRAP_OUTPUT', '后台启动输出不符合协议，请检查非交互登录脚本。'); }
      if (typeof identity.daemonId !== 'string' || !/^[a-f0-9-]{20,80}$/.test(identity.daemonId) || identity.uid !== probe.uid || identity.ownerCoordinatorId !== this.options.coordinatorId || identity.profileId !== install.profileId || identity.protocolVersion !== 2) throw problem('DAEMON_IDENTITY_CHANGED', '远端后台身份、用户或所属中央不符合预期，连接已停止。');
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
      connection.identity = { machineId, name: connection.name, kind: 'ssh', platform: 'linux', connectionId: connection.connectionId, daemonId: identity.daemonId, hostname: hello.hostname, username: connection.username, uid: probe.uid, arch: probe.arch, daemonVersion: hello.version, protocolVersion: 2, profileId: install.profileId, installDirectory: probe.installPath, stateDirectory: install.stateDirectory, host: connection.host, port: connection.port };
      // Resume observation only; this path never submits an Agent Prompt.
      let events = await host.request('daemon.eventRead', { afterCursor: connection.lastCursor || 0, limit: 128 }, 15000);
      if (events?.cursorExpired) { await host.request('snapshot', {}, 15000); events = await host.request('daemon.eventRead', { afterCursor: events.latestCursor || 0, limit: 128 }, 15000); }
      const restoredEvents = events?.items || events?.events || [];
      for (const event of restoredEvents) { if (Number.isSafeInteger(event.cursor)) connection.lastCursor = Math.max(connection.lastCursor || 0, event.cursor); this.options.onEvent?.(machineId, event); }
      operation.status = 'confirmed'; operation.machineId = machineId; operation.updatedAt = new Date().toISOString();
      connection.lastSyncedAt = new Date().toISOString(); this.state(connection, 'online');
      this.options.onMachine?.(connection.identity); host.startHeartbeat(); return this.publicState(connection);
    } catch (error) {
      const failure = safeFailure(error); const operation = this.operations[input.operationId]; if (operation?.status === 'pending') { operation.status = 'unknown'; operation.errorCode = failure.code; }
      this.dropTransport(connection);
      this.state(connection, fatal.has(failure.code) ? 'blocked' : ['SSH_AUTH_REQUIRED', 'SSH_AUTH_FAILED'].includes(failure.code) ? 'needs_credentials' : 'disconnected', failure); throw failure;
    }
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
    if (this.closed || connection.autoReconnect === false || this.reconnectTimers.has(connection.connectionId)) return;
    if (connection.authKind === 'password' && !connection.credentialRef) { this.state(connection, 'needs_credentials', problem('SSH_AUTH_REQUIRED', '请输入 SSH 密码以恢复原机器连接。')); return; }
    connection.reconnectCount = immediately ? 0 : (connection.reconnectCount || 0) + 1;
    const delay = immediately ? 0 : Math.min(8000, 1000 * 2 ** (connection.reconnectCount - 1)) * (0.8 + Math.random() * 0.2);
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(connection.connectionId); if (this.closed || connection.autoReconnect === false) return;
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
