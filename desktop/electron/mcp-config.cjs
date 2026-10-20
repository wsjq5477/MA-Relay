const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const jsonc = require("jsonc-parser");
const toml = require("smol-toml");
const fail = (code, message) => Object.assign(new Error(message), { code });
const begin = "# BEGIN AgentBridge managed MCP";
const end = "# END AgentBridge managed MCP";
function read(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return "";
    throw e;
  }
}
function parse(text, adapter) {
  try {
    if (adapter === "codex") return toml.parse(text);
    const errors = [],
      value = jsonc.parse(text || "{}", errors, { allowTrailingComma: true });
    if (
      errors.length ||
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    )
      throw Error();
    return value;
  } catch {
    throw fail(
      "MCP_CONFIG_INVALID",
      "原生配置无法解析，已保留原文件，请先修复配置。",
    );
  }
}
function location(adapter, home, env) {
  if (adapter === "codex")
    return path.join(
      env.CODEX_HOME || path.join(home, ".codex"),
      "config.toml",
    );
  if (adapter === "claude")
    return env.CLAUDE_CONFIG_DIR
      ? path.join(env.CLAUDE_CONFIG_DIR, ".claude.json")
      : path.join(home, ".claude.json");
  if (adapter === "opencode")
    return path.join(
      env.OPENCODE_CONFIG_DIR ||
        path.join(
          env.XDG_CONFIG_HOME || path.join(home, ".config"),
          "opencode",
        ),
      "opencode.jsonc",
    );
  throw fail("MCP_UNSUPPORTED", "这个 Agent 尚未提供可验证的 MCP 配置格式。");
}
function nativeEntry(adapter, config, protocol = 'v2') {
  if (adapter === "opencode")
    return {
      type: "local",
      command: [config.command, ...config.args],
      environment: config.env,
      ...(protocol === 'v2' ? { codemode: false } : {}),
    };
  return { command: config.command, args: config.args, env: config.env };
}
function equal(a, b) {
  const canonical = (value) =>
    value && typeof value === "object"
      ? Array.isArray(value)
        ? value.map(canonical)
        : Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((k) => [k, canonical(value[k])]),
          )
      : value;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
class McpConfig {
  constructor(adapter, home, env = process.env, protocol = 'v2') {
    this.adapter = adapter;
    this.protocol = protocol;
    this.file = location(adapter, home, env);
    // OpenCode merges json/jsonc. Edit the existing file, and reject ambiguous dual entries.
    if (
      adapter === "opencode" &&
      !fs.existsSync(this.file) &&
      fs.existsSync(this.file.replace(/jsonc$/, "json"))
    )
      this.file = this.file.replace(/jsonc$/, "json");
    this.key =
      adapter === "codex"
        ? "mcp_servers"
        : adapter === "claude"
          ? "mcpServers"
          : "mcp";
    this.keys =
      adapter === "opencode"
        ? protocol === 'v1' ? ["mcp", "agentbridge"] : ["mcp", "servers", "agentbridge"]
        : [this.key, "agentbridge"];
  }
  inspect() {
    const text = read(this.file),
      data = parse(text, this.adapter);
    if (
      data[this.key] !== undefined &&
      (!data[this.key] ||
        typeof data[this.key] !== "object" ||
        Array.isArray(data[this.key]))
    )
      throw fail("MCP_CONFIG_INVALID", "原 MCP 配置结构不合法，已保留原文件。");
    if (this.adapter === "opencode") {
      const sibling = this.file.endsWith(".jsonc")
        ? this.file.slice(0, -1)
        : this.file + "c";
      if ((this.protocol === 'v2' ? data.mcp?.agentbridge : data.mcp?.servers?.agentbridge) !== undefined)
        throw fail(
          "MCP_CONFIG_CONFLICT",
          "另一代 OpenCode 配置已有 agentbridge，请先移除原接入再添加，原配置已保留。",
        );
      if (
        data.mcp?.servers !== undefined &&
        (!data.mcp.servers ||
          typeof data.mcp.servers !== "object" ||
          Array.isArray(data.mcp.servers))
      )
        throw fail("MCP_CONFIG_INVALID", "OpenCode servers 配置结构不合法。");
      if (
        parse(read(sibling), this.adapter).mcp?.servers?.agentbridge !== undefined ||
        parse(read(sibling), this.adapter).mcp?.agentbridge !== undefined
      )
        throw fail(
          "MCP_CONFIG_CONFLICT",
          "OpenCode 的另一份配置已有 agentbridge，请先处理重复配置。",
        );
    }
    return { text, entry: this.keys.reduce((v, key) => v?.[key], data) };
  }
  update(entry, owned) {
    const { text, entry: current } = this.inspect();
    if (
      current !== undefined &&
      !equal(current, owned) &&
      !equal(current, entry)
    )
      throw fail(
        "MCP_CONFIG_CONFLICT",
        "agentbridge 条目已存在或被外部修改，已保留原配置。",
      );
    if (equal(current, entry)) return;
    let next;
    if (this.adapter === "codex") {
      const start = text.indexOf(begin),
        stop = text.indexOf(end);
      if (start < 0 !== stop < 0 || (start >= 0 && stop <= start))
        throw fail(
          "MCP_CONFIG_CONFLICT",
          "Bridge 配置标记不完整，请保留原配置核对。",
        );
      if (current !== undefined && start < 0)
        throw fail(
          "MCP_CONFIG_CONFLICT",
          "此 TOML 条目不是 Bridge 管理的配置，已保留。",
        );
      if (
        start >= 0 &&
        !equal(parse(text.slice(start + begin.length, stop), "codex"), {
          mcp_servers: { agentbridge: current },
        })
      )
        throw fail(
          "MCP_CONFIG_CONFLICT",
          "Bridge 标记内存在其他配置，已保留原文件。",
        );
      next =
        start < 0
          ? text
          : text.slice(0, start) +
            text.slice(stop + end.length).replace(/^\r?\n/, "");
      if (entry)
        next +=
          (next.endsWith("\n") || !next ? "" : "\n") +
          begin +
          "\n" +
          toml.stringify({ mcp_servers: { agentbridge: entry } }) +
          "\n" +
          end +
          "\n";
    } else
      next = jsonc.applyEdits(
        text || "{}\n",
        jsonc.modify(text || "{}\n", this.keys, entry, {
          formattingOptions: { insertSpaces: true, tabSize: 2 },
        }),
      );
    parse(next, this.adapter);
    const updated = this.keys.reduce(
      (v, key) => v?.[key],
      parse(next, this.adapter),
    );
    if (!equal(updated, entry))
      throw fail(
        "MCP_CONFIG_CONFLICT",
        "配置包含重复或歧义条目，已保留原文件。",
      );
    if (fs.existsSync(this.file) && fs.lstatSync(this.file).isSymbolicLink())
      throw fail(
        "MCP_CONFIG_CONFLICT",
        "原生配置为符号链接，请手动合并独立 MCP 文件。",
      );
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + "." + randomUUID() + ".tmp";
    try {
      fs.writeFileSync(tmp, next, {
        mode: fs.existsSync(this.file)
          ? fs.statSync(this.file).mode & 0o777
          : 0o600,
        flag: "wx",
      });
      if (read(this.file) !== text)
        throw fail(
          "MCP_CONFIG_CONFLICT",
          "配置同时被其他程序更新，请刷新状态后重试。",
        );
      fs.renameSync(tmp, this.file);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
}
module.exports = { McpConfig, nativeEntry, equal };
