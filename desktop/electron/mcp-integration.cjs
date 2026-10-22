const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomUUID, createHash } = require("node:crypto");
const { spawn, execFile } = require("node:child_process");
const { atomicWrite } = require("./graph-layout.cjs");
const { McpConfig, nativeEntry, equal } = require("./mcp-config.cjs");
const { scanTools, openCodeCompatibility, openCodeVersionError } = require('./tool-discovery.cjs');
const toml = require("smol-toml");
const fail = (code, message) => Object.assign(new Error(message), { code });
// Bridge can only manage a native entry where it has a reviewed conversion. The
// remaining products keep their independent MCP ability; they are not "unsupported
// MCP", they simply have no Bridge-managed native config path yet.
// Adapters with a reviewed, directly writable native MCP entry. `opendesk` (CLI)
// is deliberately absent: its 0.3.8 surface has no MCP manager, so nativeSupport()
// reports it unsupported and only export is offered. DSH CLI is handled by
// nativeSupport() because it also requires the user-named launch profile.
const configurable = new Set(['claude', 'codex', 'opencode', 'opendesk-desktop', 'dsh-web']);
// Read-only native MCP list commands. Health-checking list is evidence for both
// the native load and the connection; a plain list proves only configuration.
const nativeLists = {
  claude: {args: ['mcp', 'list'], health: true},
  codex: {args: ['mcp', 'list'], health: false},
  opencode: {args: ['mcp', 'list'], health: false},
};
function probeTimeout() { return 20000; }
function run(command, args, options = {}) {
  return new Promise(resolve => {
    const child = execFile(command, args, {timeout: options.timeout || probeTimeout(), windowsHide: true, env: options.env || process.env, maxBuffer: 1024 * 1024},
      (error, stdout, stderr) => resolve({error, stdout: String(stdout || ''), stderr: String(stderr || '')}));
    child.on('error', error => resolve({error, stdout: '', stderr: ''}));
  });
}
class McpIntegration {
  constructor(options, broker) {
    this.options = options;
    this.broker = broker;
    this.directory = path.join(options.directory, "mcp-connections");
    this.file = path.join(this.directory, "connections.json");
    this.rows = fs.existsSync(this.file)
      ? JSON.parse(fs.readFileSync(this.file, "utf8"))
      : [];
    if (!Array.isArray(this.rows))
      throw fail("MCP_STATE", "MCP 登记无法读取，请保留原记录。");
  }
  save() {
    fs.mkdirSync(this.directory, { recursive: true });
    atomicWrite(this.file, this.rows);
  }
  config(adapter, protocol = 'v2', profile) {
    return new McpConfig(
      adapter,
      this.options.home || os.homedir(),
      this.options.environment || process.env,
      protocol,
      profile,
    );
  }
  authorize(scope) {
    if (
      !this.rows.some(
        (r) =>
          r.enabled &&
          r.connectionId === scope.externalConnectionId &&
          r.nodeId === scope.nodeId,
      )
    )
      throw fail("MCP_REVOKED", "此 MCP 接入已移除，请从 Bridge 重新添加。");
  }
  async configure(row, {selectLauncher = false} = {}) {
    let config = await this.broker.configure("external-" + row.connectionId, {
      nodeId: row.nodeId,
      parentRequestId: row.connectionId,
      externalConnectionId: row.connectionId,
    });
    // Select once, before rendering ANY format. Recovery preserves the command
    // the user exported/installed; it must not silently change native ownership.
    if (row.adapter.startsWith('opendesk')) {
      const prior = row.launcherPath || row.configuration?.command;
      const node = selectLauncher || !prior ? this.nodeLauncher() : null;
      const command = node || (!selectLauncher && typeof prior === 'string' ? prior : config.command);
      config = {...config, command};
      row.launcher = node ? 'node' : !selectLauncher && prior ? row.launcher || (/^node(?:\.exe)?$/i.test(path.basename(command)) ? 'node' : 'electron') : 'electron';
      row.launcherPath = command;
    }
    const directory = path.join(this.directory, row.connectionId);
    fs.mkdirSync(directory, { recursive: true });
    const files = {
      json: path.join(directory, "agentbridge.mcp.json"),
      codex: path.join(directory, "agentbridge.codex.toml"),
      opencode: path.join(directory, "agentbridge.opencode.jsonc"),
      opendesk: path.join(directory, "agentbridge.opendesk.json"),
      dsh: path.join(directory, "agentbridge.dsh.patch.yml"),
    };
    fs.writeFileSync(
      files.json,
      JSON.stringify(
        { mcpServers: { agentbridge: nativeEntry("claude", config) } },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
    fs.writeFileSync(
      files.codex,
      toml.stringify({
        mcp_servers: { agentbridge: nativeEntry("codex", config) },
      }),
      { mode: 0o600 },
    );
    fs.writeFileSync(
      files.opencode,
      JSON.stringify(
        { mcp: row.nativeProtocol === 'v1'
          ? { agentbridge: nativeEntry('opencode', config, 'v1') }
          : { servers: { agentbridge: nativeEntry("opencode", config) } } },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
    fs.writeFileSync(files.opendesk, JSON.stringify({applications:{mcpmgr:{servers:[nativeEntry("opendesk", config)]}}}, null, 2) + "\n", {mode:0o600});
    // A DSH patch fragment: the user can paste it into any DSH profile patch file,
    // and Bridge uses the same shape when it writes the DSH Web profile itself.
    fs.writeFileSync(files.dsh, require('yaml').stringify([{insert: [nativeEntry('dsh-web', config)]}]), {mode:0o600});
    return { config, files };
  }
  // Restart recovery re-creates the private endpoint descriptor so an already
  // installed native entry keeps working. It must never write native config:
  // a user who deleted the entry in the native product keeps it deleted.
  async restore() {
    for (const row of this.rows.filter((r) => r.enabled)) await this.configure(row);
  }
  nativeSupport(adapter, profile) {
    if (adapter === 'opendesk')
      return {supported: false, code: 'MCP_NATIVE_CONFIG_UNSUPPORTED', reason: 'OpenDesk CLI 0.3.8 的原生插件清单（opendesk plugins list/tools）没有 MCP 管理入口，且启动会重写 setting.json 丢弃未识别的 applications 段，Bridge 写入的条目没有原生读取证据。请先生成独立配置在 OpenDesk Desktop 中手动添加，或等待该 CLI 提供 MCP 管理入口后复核。'};
    if (adapter === 'dsh') return profile
      // The DSH CLI profile is a launch argument, so the user names the target
      // explicitly and Bridge edits exactly that profile's patch layer.
      ? {supported: true}
      : {supported: false, code: 'MCP_DSH_PROFILE_REQUIRED', reason: 'DSH CLI 的原生 MCP 配置属于启动时选择的 profile。请先指定目标 profile（与启动 dsh 时使用的名称一致），Bridge 只会写入该 profile 的原生补丁层。'};
    if (configurable.has(adapter)) return {supported: true};
    if (adapter === 'dsh-desktop') return {supported: false, code: 'MCP_NATIVE_CONFIG_UNSUPPORTED', reason: 'DSH Desktop 使用应用保留 profile，尚未核对到可管理的原生配置路径；请在 DSH Desktop 原生设置中添加 AgentBridge MCP。'};
    if (['hermes', 'pi'].includes(adapter)) return {supported: false, code: 'MCP_NATIVE_CONFIG_UNSUPPORTED', reason: '尚未核对到该产品的原生 MCP 配置文件或接口，Bridge 不猜测路径；请按其原生文档添加 AgentBridge MCP。'};
    return {supported: false, code: 'MCP_UNSUPPORTED', reason: '这个 Agent 尚未提供可验证的 MCP 配置格式。'};
  }
  probeBinding(params, row) {
    try {
      const target = this.config(params.adapter, row?.nativeProtocol, params.profile === undefined ? row?.profile : params.profile);
      const inspected = target.inspect();
      return createHash('sha256').update(JSON.stringify([target.file, inspected.text, row?.connectionId, row?.configuration])).digest('hex');
    } catch { return null; }
  }
  status(params) {
    const row = this.rows.find((r) => r.nodeId === params.nodeId);
    const profile = params.profile === undefined ? row?.profile : params.profile;
    const support = this.nativeSupport(params.adapter, profile);
    const base = {
      nodeId: params.nodeId,
      adapter: params.adapter,
      enabled: !!row?.enabled,
      installed: false,
      conflict: false,
      ...(row ? {connectionId: row.connectionId} : {}),
      ...(params.adapter === 'dsh' ? {profile: profile ?? null} : {}),
      ...(['opendesk', 'opendesk-desktop'].includes(params.adapter) ? {launcher: row?.launcher || null} : {}),
      nativeSupport: support.supported,
      ...(support.supported ? {} : {nativeSupportCode: support.code, nativeSupportReason: support.reason}),
    };
    if (!support.supported) {
      return {...base, configPath: '', state: 'unsupported', facts: {
        config: 'unsupported', nativeLoad: 'unsupported', connection: row?.enabled ? 'unknown' : 'revoked',
        tools: 'unknown', authorization: row?.enabled ? 'valid' : row ? 'revoked' : 'unknown', ownership: 'unconfirmed',
      }, evidence: {configPath: '', nativeProbe: {kind: 'none'}}, ...(row?.enabled ? {files: this.files(row)} : {})};
    }
    const target = this.config(params.adapter, row?.nativeProtocol, profile);
    let entry, inspectError;
    try { entry = target.inspect().entry; } catch (error) { inspectError = error; }
    const owned = row?.configuration;
    // Ownership is about the entry's provenance, not current authorization: a
    // revoked connection whose native entry is still the Bridge-written one must
    // read as "configuration present, authorization revoked", never as a conflict.
    const ownedEntry = !inspectError && entry !== undefined && equal(entry, owned);
    const matching = !!row?.enabled && ownedEntry;
    const foreign = !inspectError && entry !== undefined && !equal(entry, owned);
    const authorization = row ? (row.enabled ? 'valid' : 'revoked') : 'unknown';
    const savedProbe = row?.probe || {};
    const binding = this.probeBinding(params, row);
    const bound = !!binding && savedProbe.binding === binding;
    const age = Date.now() - Date.parse(savedProbe.at);
    const fresh = bound && Number.isFinite(age) && age >= 0 && (savedProbe.kind === 'patch-layer' || age <= 60000);
    const probe = fresh ? savedProbe : {};
    const observation = {
      ...(typeof savedProbe.at === 'string' ? {observedAt: savedProbe.at} : {}),
      freshness: fresh ? 'current' : savedProbe.at ? 'stale' : 'unknown',
      ...(!fresh ? {reason: !savedProbe.binding ? 'unbound' : !bound ? 'configuration_changed' : 'expired'} : {}),
    };
    const config = inspectError ? 'unknown' : entry === undefined ? 'absent' : ownedEntry ? 'present' : 'conflict';
    const facts = {
      config,
      nativeLoad: probe.nativeLoad || (inspectError ? 'unknown' : 'unknown'),
      connection: authorization === 'revoked' ? 'revoked' : probe.connection || 'unknown',
      tools: authorization === 'revoked' ? 'unauthorized' : probe.tools || 'unknown',
      authorization,
      ownership: ownedEntry ? 'bridge' : foreign ? 'external' : 'unconfirmed',
    };
    const state = inspectError
      ? 'conflict'
      : row && !row.enabled && entry !== undefined
        ? 'revoked_config_pending'
        : foreign
          ? 'conflict'
          : row?.enabled && matching
            ? 'installed'
            : row?.enabled
              ? 'exported'
              : 'absent';
    return {
      ...base,
      installed: matching,
      conflict: foreign || !!inspectError,
      configPath: target.file,
      state,
      facts,
      evidence: {
        configPath: target.file,
        observation,
        nativeProbe: probe.nativeLoad ? {kind: probe.kind || 'native-list', command: probe.command, outcome: probe.outcome, detail: probe.detail} : {kind: 'none'},
        ...(probe.tools ? {toolsProbe: {kind: 'bridge-stdio', outcome: probe.tools, ...(probe.toolCount === undefined ? {} : {toolCount: probe.toolCount})}} : {}),
        ...(inspectError ? {configError: {code: inspectError.code, message: inspectError.message}} : {}),
      },
      ...(row?.enabled ? {files: this.files(row)} : {}),
    };
  }
  files(row) {
    const directory = path.join(this.directory, row.connectionId);
    return {
      opendesk: path.join(directory, "agentbridge.opendesk.json"),
      json: path.join(directory, "agentbridge.mcp.json"),
      codex: path.join(directory, "agentbridge.codex.toml"),
      opencode: path.join(directory, "agentbridge.opencode.jsonc"),
      dsh: path.join(directory, "agentbridge.dsh.patch.yml"),
    };
  }
  // OpenDesk 0.3.9 refuses the Electron runtime as a stdio MCP command (its
  // worker reports ENOENT / connection-closed) while a plain Node executable
  // works. Prefer a real Node on PATH for the native entry and keep the Electron
  // runtime only as a fallback with its limitation reported.
  nodeLauncher() {
    const env = this.options.environment || {};
    const searchPath = String(env.PATH || process.env.PATH || '');
    for (const directory of searchPath.split(path.delimiter)) {
      if (!directory) continue;
      for (const file of process.platform === 'win32' || /[A-Za-z]:[\\/]/.test(directory) ? ['node.exe'] : ['node']) {
        const candidate = path.join(directory, file);
        try { if (fs.statSync(candidate).isFile()) return candidate; } catch { /* keep looking */ }
      }
    }
    return null;
  }
  // Find the native executable for a read-only list probe without starting any
  // product UI. Only a real installed binary is used; nothing is downloaded.
  executable(adapter) {
    const candidates = this.options.candidates?.[adapter] || [];
    for (const candidate of Array.isArray(candidates) ? candidates : [candidates]) {
      if (typeof candidate !== 'string' || !candidate) continue;
      try { if (fs.statSync(candidate).isFile()) return candidate; } catch { /* try the next candidate */ }
    }
    // Discovery metadata may be absent (for example the local Linux host). A
    // PATH lookup finds only an already installed product; nothing is downloaded.
    const name = {claude: 'claude', codex: 'codex', opencode: 'opencode'}[adapter];
    if (!name) return null;
    const env = this.options.environment || {};
    const searchPath = String(env.PATH || process.env.PATH || '');
    for (const directory of searchPath.split(path.delimiter)) {
      if (!directory) continue;
      for (const file of [name, name + '.exe', name + '.cmd']) {
        const candidate = path.join(directory, file);
        try { if (fs.statSync(candidate).isFile()) return candidate; } catch { /* keep looking */ }
      }
    }
    return null;
  }
  // The native list probe must work in the shipped path, where no caller passes
  // `candidates`. Resolve through tool discovery first, then PATH.
  async nativeProbe(adapter) {
    const list = nativeLists[adapter];
    let executable = this.executable(adapter);
    if (list && !executable) {
      try {
        const installed = (await scanTools(this.options)).find(item => item.adapter === adapter && typeof item.executable === 'string');
        executable = installed?.executable || null;
      } catch { /* discovery failure leaves the probe unsupported, not guessed */ }
    }
    if (!list || !executable) return {kind: 'none'};
    const result = await run(executable, list.args, {env: this.options.environment || process.env});
    const text = (result.stdout + '\n' + result.stderr).trim();
    const detail = text.split('\n').filter(Boolean).slice(0, 6).join('\n').slice(0, 800);
    if (result.error && !text) return {kind: 'native-list', command: adapter + ' ' + list.args.join(' '), outcome: 'error', detail: String(result.error.code || result.error.message)};
    const line = text.split('\n').find(value => /agentbridge/i.test(value));
    if (!line) return {kind: 'native-list', command: adapter + ' ' + list.args.join(' '), outcome: 'absent', detail};
    if (list.health) {
      const failed = /failed|✘|error|✗/i.test(line);
      return {kind: 'native-list', command: adapter + ' ' + list.args.join(' '), outcome: failed ? 'failed' : 'connected', detail};
    }
    return {kind: 'native-list', command: adapter + ' ' + list.args.join(' '), outcome: 'listed', detail};
  }
  // Real MCP protocol evidence: start the exported stdio server and read its tool
  // catalogue. This proves the connection Bridge hands to the product, not that a
  // specific native product has connected already.
  async toolsProbe(row) {
    const declaration = row?.configuration;
    const command = declaration?.config?.command || (Array.isArray(declaration?.command) ? declaration.command[0] : declaration?.command);
    const args = declaration?.config?.args || declaration?.args || (Array.isArray(declaration?.command) ? declaration.command.slice(1) : []);
    const env = declaration?.config?.env || declaration?.environment || declaration?.env;
    if (typeof command !== 'string' || !command) return null;
    return await new Promise(resolve => {
      let output = '', settled = false;
      const done = value => { if (settled) return; settled = true; try { child.kill(); } catch { /* already exited */ } resolve(value); };
      let child;
      try {
        child = spawn(command, args, {env: {...process.env, ...(env || {})}, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
      } catch { return resolve(null); }
      const timer = setTimeout(() => done({outcome: 'timeout'}), 10000);
      child.on('error', () => { clearTimeout(timer); done({outcome: 'unavailable'}); });
      child.stdout.on('data', chunk => {
        output += chunk;
        let index;
        while ((index = output.indexOf('\n')) >= 0) {
          const line = output.slice(0, index); output = output.slice(index + 1);
          let message; try { message = JSON.parse(line); } catch { continue; }
          if (message.id === 1) child.stdin.write(JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n' + JSON.stringify({jsonrpc: '2.0', id: 2, method: 'tools/list'}) + '\n');
          if (message.id === 2) { clearTimeout(timer); const count = Array.isArray(message.result?.tools) ? message.result.tools.length : 0; done({outcome: message.error ? 'unavailable' : 'available', toolCount: count}); }
        }
      });
      child.stdin.write(JSON.stringify({jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'agentbridge-mcp-probe', version: '1'}}}) + '\n');
    });
  }
  async call(method, params) {
    const prior = this.pending || Promise.resolve();
    const job = prior.catch(() => {}).then(() => this.perform(method, params));
    this.pending = job;
    return job;
  }
  async perform(method, params) {
    if (
      typeof params.nodeId !== "string" ||
      !params.nodeId
    )
      throw fail("MCP_UNSUPPORTED", "请选择支持 MCP 配置的 Agent 节点。");
    if (method === "mcp.status") return this.status(params);
    let row = this.rows.find((r) => r.nodeId === params.nodeId);
    let protocol = row?.nativeProtocol || 'v2';
    const profile = params.profile === undefined ? row?.profile : params.profile;
    const support = this.nativeSupport(params.adapter, profile);
    if (method === 'mcp.revoke') {
      // Authorization revocation is independent of native cleanup and must work
      // even when the user already deleted or edited the native entry.
      if (!row) throw fail('MCP_NOT_CONFIGURED', '这个节点还没有 Bridge 登记的 MCP 接入。');
      if (row.enabled) { row.enabled = false; this.save(); }
      return this.status(params);
    }
    if (method === 'mcp.probe') {
      if (!support.supported) return this.status(params);
      const binding = this.probeBinding(params, row);
      const native = await this.nativeProbe(params.adapter);
      const tools = row?.enabled ? await this.toolsProbe(row) : null;
      if (row) {
        row.probe = {
          kind: native.kind || 'none',
          outcome: native.outcome,
          ...(native.command ? {command: native.command} : {}),
          ...(native.detail ? {detail: native.detail} : {}),
          ...(native.outcome === 'connected' || native.outcome === 'listed' ? {nativeLoad: 'loaded'} : native.outcome === 'absent' ? {nativeLoad: 'not_loaded'} : native.outcome === 'failed' ? {nativeLoad: 'loaded'} : {}),
          ...(native.outcome === 'connected' ? {connection: 'connected'} : native.outcome === 'failed' ? {connection: 'disconnected'} : {}),
          ...(tools ? {tools: tools.outcome, ...(tools.toolCount === undefined ? {} : {toolCount: tools.toolCount})} : {}),
          at: new Date().toISOString(),
          binding,
        };
        this.save();
      }
      return this.status(params);
    }
    if (!support.supported) {
      if (method === 'mcp.remove' || method === 'mcp.export') {
        // No Bridge-managed native entry exists for this product: export prepares
        // a standard fragment; remove only revokes the registration and deletes
        // no native file Bridge never wrote.
        if (method === 'mcp.export') return await this.exportOnly(params, row);
        if (row) { row.enabled = false; this.save(); }
        return this.status(params);
      }
      throw fail(support.code, support.reason);
    }
    if (params.adapter === 'opencode' && method !== 'mcp.remove') {
      const installation = (await scanTools(this.options)).find(i => i.adapter === 'opencode');
      if (!installation?.healthy) throw fail('DISCOVERY_CHANGED', '原 OpenCode 安装当前不可调用，请重新扫描。');
      if (!openCodeCompatibility(installation.version).supported) throw openCodeVersionError(installation.version);
      protocol = installation.version.startsWith('1.') ? 'v1' : 'v2';
      if (row?.enabled && (row.nativeProtocol || 'v2') !== protocol) throw fail('MCP_CONFIG_CONFLICT', 'OpenCode 协议已变化，请先移除原 MCP 接入再重新添加。');
    }
    const target = this.config(params.adapter, protocol, profile);
    if (method === "mcp.remove") {
      // Revoke first, including when the native entry has since been edited.
      if (row) {
        row.enabled = false;
        this.save();
      }
      try {
        target.update(undefined, row?.configuration);
      } catch (error) {
        // Configuration cleanup failed, but the authorization is already gone.
        // Report both facts; never restore the revoked authorization.
        const status = this.status(params);
        return {...status, state: 'revoked_config_pending', cleanupError: {code: error.code || 'MCP_CONFIG_CONFLICT', message: error.message}};
      }
      return this.status(params);
    }
    if (!["mcp.install", "mcp.export"].includes(method))
      throw fail("INVALID_INPUT", "MCP 操作不受支持。");
    if (method === "mcp.install") {
      const { entry } = target.inspect();
      if (entry !== undefined && !equal(entry, row?.configuration))
        throw fail(
          "MCP_CONFIG_CONFLICT",
          "原配置已有其他 agentbridge 条目，已保留，请先处理冲突。",
        );
    }
    const owned = row?.configuration;
    if (!row?.enabled) {
      const fresh = {
        nodeId: params.nodeId,
        adapter: params.adapter,
        connectionId: randomUUID(),
        enabled: true,
        ...(params.adapter === 'opencode' ? {nativeProtocol:protocol} : {}),
        ...(params.adapter === 'dsh' ? {profile} : {}),
      };
      if (row) this.rows[this.rows.indexOf(row)] = fresh;
      else this.rows.push(fresh);
      row = fresh;
      this.save();
    }
    const { config, files } = await this.configure(row, {selectLauncher:true});
    row.configuration = nativeEntry(params.adapter, config, protocol);
    delete row.probe;
    this.save();
    if (method === "mcp.install") target.update(row.configuration, owned);
    if (method === "mcp.install" && ['dsh-web', 'dsh'].includes(params.adapter)) {
      // DSH applies the profile patch layer itself (live when HMR is enabled).
      // Bridge reports the requirement instead of claiming a loaded connection.
      row.probe = {kind: 'patch-layer', nativeLoad: 'reload_required', at:new Date().toISOString(), binding:this.probeBinding(params,row)};
      this.save();
    }
    return { ...this.status(params), files, configuration: row.configuration };
  }
  // Export for a product Bridge cannot write yet: identity registration plus a
  // standard config fragment. It never claims the native product installed it.
  async exportOnly(params, row) {
    const profile = params.profile === undefined ? row?.profile : params.profile;
    if (!row?.enabled) {
      const fresh = {nodeId: params.nodeId, adapter: params.adapter, connectionId: randomUUID(), enabled: true, ...(params.adapter === 'dsh' ? {profile} : {})};
      if (row) this.rows[this.rows.indexOf(row)] = fresh; else this.rows.push(fresh);
      row = fresh;
      this.save();
    }
    const { config, files } = await this.configure(row, {selectLauncher:true});
    this.save();
    return {...this.status(params), files, configuration: {command: config.command, args: config.args, env: config.env}, exported: true};
  }
}
module.exports = { McpIntegration, configurable };
