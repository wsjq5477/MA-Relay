const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { atomicWrite } = require("./graph-layout.cjs");
const { McpConfig, nativeEntry, equal } = require("./mcp-config.cjs");
const { scanTools, openCodeCompatibility, openCodeVersionError } = require('./tool-discovery.cjs');
const toml = require("smol-toml");
const fail = (code, message) => Object.assign(new Error(message), { code });
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
  config(adapter, protocol = 'v2') {
    return new McpConfig(
      adapter,
      this.options.home || os.homedir(),
      this.options.environment || process.env,
      protocol,
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
  async configure(row) {
    const config = await this.broker.configure("external-" + row.connectionId, {
      nodeId: row.nodeId,
      parentRequestId: row.connectionId,
      externalConnectionId: row.connectionId,
    });
    const directory = path.join(this.directory, row.connectionId);
    fs.mkdirSync(directory, { recursive: true });
    const files = {
      json: path.join(directory, "agentbridge.mcp.json"),
      codex: path.join(directory, "agentbridge.codex.toml"),
      opencode: path.join(directory, "agentbridge.opencode.jsonc"),
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
    return { config, files };
  }
  async restore() {
    for (const row of this.rows.filter((r) => r.enabled))
      await this.configure(row);
  }
  status(params) {
    const row = this.rows.find((r) => r.nodeId === params.nodeId),
      target = this.config(params.adapter, row?.nativeProtocol),
      { entry } = target.inspect();
    const installed = !!row?.enabled && equal(entry, row.configuration);
    const foreign = entry !== undefined && !equal(entry, row?.configuration);
    return {
      nodeId: params.nodeId,
      adapter: params.adapter,
      enabled: !!row?.enabled,
      installed,
      conflict: foreign,
      configPath: target.file,
      ...(row ? { connectionId: row.connectionId } : {}),
      ...(row?.enabled
        ? {
            files: {
              json: path.join(
                this.directory,
                row.connectionId,
                "agentbridge.mcp.json",
              ),
              codex: path.join(
                this.directory,
                row.connectionId,
                "agentbridge.codex.toml",
              ),
              opencode: path.join(
                this.directory,
                row.connectionId,
                "agentbridge.opencode.jsonc",
              ),
            },
          }
        : {}),
      state: foreign
        ? "conflict"
        : installed
          ? "installed"
          : row?.enabled
            ? "exported"
            : "absent",
    };
  }
  async call(method, params) {
    const prior = this.pending || Promise.resolve();
    const job = prior.catch(() => {}).then(() => this.perform(method, params));
    this.pending = job;
    return job;
  }
  async perform(method, params) {
    if (
      !["claude", "codex", "opencode"].includes(params.adapter) ||
      typeof params.nodeId !== "string" ||
      !params.nodeId
    )
      throw fail("MCP_UNSUPPORTED", "请选择支持 MCP 配置的 Agent 节点。");
    if (method === "mcp.status") return this.status(params);
    let row = this.rows.find((r) => r.nodeId === params.nodeId);
    let protocol = row?.nativeProtocol || 'v2';
    if (params.adapter === 'opencode' && method !== 'mcp.remove') {
      const installation = (await scanTools(this.options)).find(i => i.adapter === 'opencode');
      if (!installation?.healthy) throw fail('DISCOVERY_CHANGED', '原 OpenCode 安装当前不可调用，请重新扫描。');
      if (!openCodeCompatibility(installation.version).supported) throw openCodeVersionError(installation.version);
      protocol = installation.version.startsWith('1.') ? 'v1' : 'v2';
      if (row?.enabled && (row.nativeProtocol || 'v2') !== protocol) throw fail('MCP_CONFIG_CONFLICT', 'OpenCode 协议已变化，请先移除原 MCP 接入再重新添加。');
    }
    const target = this.config(params.adapter, protocol);
    if (method === "mcp.remove") {
      // Revoke first, including when the native entry has since been edited.
      if (row) {
        row.enabled = false;
        this.save();
      }
      target.update(undefined, row?.configuration);
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
      };
      if (row) this.rows[this.rows.indexOf(row)] = fresh;
      else this.rows.push(fresh);
      row = fresh;
      this.save();
    }
    const { config, files } = await this.configure(row);
    row.configuration = nativeEntry(params.adapter, config, protocol);
    this.save();
    if (method === "mcp.install") target.update(row.configuration, owned);
    return { ...this.status(params), files, configuration: row.configuration };
  }
}
module.exports = { McpIntegration };
