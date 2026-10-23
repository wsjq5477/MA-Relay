const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const jsonc = require("jsonc-parser");
const toml = require("smol-toml");
const YAML = require("yaml");
const fail = (code, message) => Object.assign(new Error(message), { code });
const begin = "# BEGIN AgentBridge managed MCP";
const end = "# END AgentBridge managed MCP";
// One native AgentBridge entry per product family. DSH keeps its row id stable so
// a user can find, edit or delete exactly this entry in the native patch file.
const dshRowId = "agentbridge-mcp";
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
    if (adapter === 'hermes') return require('./hermes-mcp-config.cjs').document(text).data;
    if (adapter === 'pi') {
      // Pi's native loader uses JSON.parse, not JSONC. Reject duplicate keys too:
      // ownership must never depend on which duplicate a parser happens to pick.
      const strictText = text.replace(/^\uFEFF/, '') || '{}';
      const value = JSON.parse(strictText);
      const visit = node => {
        if (node?.type === 'object') {
          const keys = node.children.map(property => property.children[0].value);
          if (new Set(keys).size !== keys.length) throw Error();
        }
        for (const child of node?.children || []) visit(child);
      };
      visit(jsonc.parseTree(strictText));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
      return value;
    }
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
function dshHome(home, env) {
  return env.DSH_HOME || path.join(home, ".dsh");
}
// DSH Web is the one DSH surface with an unambiguous on-disk profile. The CLI
// profile is a launch argument and Desktop owns an application profile, so
// neither is guessed here.
// A DSH profile name is a directory under `$DSH_HOME/profiles`. It is chosen by
// the user (Web ships `web`; the CLI picks whichever profile it was launched
// with), so it is validated as a single safe path segment and never guessed.
const dshProfilePattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
function dshProfile(value) {
  if (typeof value !== 'string' || !dshProfilePattern.test(value))
    throw fail("MCP_DSH_PROFILE_REQUIRED", "请提供 DSH 的原生 profile 名称（例如 web 或启动 dsh 时使用的 profile），它决定 Bridge 写入哪个原生配置。");
  return value;
}
function dshPatchFile(home, env, profile) {
  const name = dshProfile(profile);
  return path.join(dshHome(home, env), "profiles", name, "cordis.patch.yml");
}
function location(adapter, home, env, profile, nativeTarget) {
  if (adapter === 'hermes') return require('./hermes-mcp-config.cjs').targetFile(nativeTarget);
  if (adapter === 'pi') return require('./pi-mcp-config.cjs').targetFile(nativeTarget);
  if (adapter === 'dsh-desktop') return require('./dsh-desktop-config.cjs').targetFile(nativeTarget);
  if (adapter === "dsh-web") return dshPatchFile(home, env, "web");
  if (adapter === "dsh") return dshPatchFile(home, env, profile);
  if (['opendesk', 'opendesk-desktop'].includes(adapter)) return path.join(require('./opendesk-connection.cjs').nativeHome({home,environment:env}), 'setting.json');
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
  if (['dsh-web', 'dsh', 'dsh-desktop'].includes(adapter)) return {
    id: dshRowId,
    name: "@deepseek-ai/dsh-mcp-client",
    config: {serverName: "agentbridge", transport: "stdio", command: config.command, args: config.args, env: config.env},
  };
  if (['opendesk', 'opendesk-desktop'].includes(adapter)) return {id:'agentbridge',name:'AgentBridge',transport:'stdio',enabled:true,command:config.command,args:config.args,env:config.env};
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
// ---------------------------------------------------------------- DSH patches
// A DSH user patch layer is a top-level YAML array of loader patch rows. A new
// entity is added with `- insert: [row]`; an id-only patch replaces an existing
// row's config. Bridge therefore owns exactly one insert row, edited through the
// YAML document so user comments, anchors and unrelated entries survive.
function dshDocument(text, file) {
  let doc;
  // A missing patch file is "no layer" for DSH and may be created for the user;
  // an existing empty or comments-only file is a broken native layer that Bridge
  // must report instead of silently replacing.
  if (!text.trim() && fs.existsSync(file))
    throw fail("MCP_CONFIG_INVALID", "DSH 补丁配置为空；请先在 DSH 原生配置中写入 [] 或原有条目，Bridge 不覆盖空文件。");
  try {
    doc = YAML.parseDocument(text.trim() ? text : "[]");
  } catch {
    throw fail("MCP_CONFIG_INVALID", "DSH 原生补丁配置无法解析，已保留原文件，请先修复配置。");
  }
  if (doc.errors.length)
    throw fail("MCP_CONFIG_INVALID", "DSH 原生补丁配置无法解析，已保留原文件，请先修复配置。");
  const root = doc.contents;
  if (root === null || root === undefined) {
    throw fail("MCP_CONFIG_INVALID", "DSH 补丁配置为空；请先在 DSH 原生配置中写入 [] 或原有条目，Bridge 不覆盖空文件。");
  }
  if (!YAML.isSeq(root))
    throw fail("MCP_CONFIG_INVALID", "DSH 补丁配置需要顶层条目数组，已保留原文件。");
  return doc;
}
function dshRows(doc) {
  const found = [];
  doc.contents.items.forEach((row, patchIndex) => {
    if (!YAML.isMap(row)) return;
    const insert = row.get("insert");
    if (!YAML.isSeq(insert)) return;
    insert.items.forEach((item, rowIndex) => {
      if (!YAML.isMap(item) || item.get("id") !== dshRowId) return;
      found.push({patchIndex, rowIndex, value: item.toJS(doc)});
    });
  });
  return found;
}
function dshInspect(text, file) {
  if (!text.trim()) return {text, entry: undefined, present: 0};
  const doc = dshDocument(text, file);
  const rows = dshRows(doc);
  if (rows.length > 1)
    throw fail("MCP_CONFIG_CONFLICT", "DSH 配置中有多个 AgentBridge MCP 条目，已保留原文件，请先处理重复配置。");
  return {text, entry: rows[0]?.value, present: rows.length, doc};
}
class McpConfig {
  constructor(adapter, home, env = process.env, protocol = 'v2', profile, nativeTarget) {
    this.adapter = adapter;
    this.protocol = protocol;
    // Both DSH surfaces edit a native patch layer; only the profile differs.
    this.dshWeb = ['dsh-web', 'dsh', 'dsh-desktop'].includes(adapter);
    this.targetModule = {pi: './pi-mcp-config.cjs', hermes: './hermes-mcp-config.cjs', 'dsh-desktop': './dsh-desktop-config.cjs'}[adapter];
    if (adapter === 'hermes') {
      const hermes = require(this.targetModule);
      this.nativeSelection = () => hermes.currentTarget(home, env);
      this.nativeTarget = nativeTarget ? hermes.validateTarget(nativeTarget) : this.nativeSelection();
    }
    if (adapter === 'pi') {
      const pi = require('./pi-mcp-config.cjs');
      this.nativeSelection = () => pi.currentTarget(home, env);
      this.nativeTarget = nativeTarget ? pi.validateTarget(nativeTarget) : this.nativeSelection();
    }
    if (adapter === 'dsh-desktop') {
      const desktop = require('./dsh-desktop-config.cjs');
      this.nativeSelection = () => desktop.desktopTarget(home, env);
      this.nativeTarget = nativeTarget ? desktop.validateTarget(nativeTarget) : this.nativeSelection();
    }
    this.profile = adapter === 'dsh-desktop' ? this.nativeTarget.profile : adapter === 'dsh-web' ? 'web' : profile === undefined ? undefined : dshProfile(profile);
    this.file = location(adapter, home, env, this.profile, this.nativeTarget);
    // OpenCode merges json/jsonc. Edit the existing file, and reject ambiguous dual entries.
    if (
      adapter === "opencode" &&
      !fs.existsSync(this.file) &&
      fs.existsSync(this.file.replace(/jsonc$/, "json"))
    )
      this.file = this.file.replace(/jsonc$/, "json");
    this.key =
      ['codex', 'hermes'].includes(adapter)
        ? "mcp_servers"
        : ['claude', 'pi'].includes(adapter)
          ? "mcpServers"
          : "mcp";
    this.openDesk = ['opendesk', 'opendesk-desktop'].includes(adapter);
    this.keys = this.openDesk ? ['applications','mcpmgr','servers'] :
      adapter === "opencode"
        ? protocol === 'v1' ? ["mcp", "agentbridge"] : ["mcp", "servers", "agentbridge"]
        : [this.key, "agentbridge"];
  }
  inspect() {
    if (this.nativeTarget) require(this.targetModule).assertTargetDirectory(this.nativeTarget);
    const text = read(this.file);
    if (this.dshWeb) return dshInspect(text, this.file);
    const data = parse(text, this.adapter);
    if (this.openDesk) {
      for (const value of [data.applications, data.applications?.mcpmgr]) if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) throw fail('MCP_CONFIG_INVALID','OpenDesk 原 MCP 配置结构不合法，已保留原文件。');
      const servers = data.applications?.mcpmgr?.servers ?? [];
      if (!Array.isArray(servers) || servers.some(item => !item || typeof item !== 'object' || typeof item.id !== 'string') || new Set(servers.map(item => item.id)).size !== servers.length) throw fail('MCP_CONFIG_INVALID','OpenDesk MCP 列表包含无效或重复身份，已保留原文件。');
      return {text, entry:servers.find(item => item.id === 'agentbridge'), servers};
    }
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
  // True when the native file exists at the expected place for this product.
  get exists() { return fs.existsSync(this.file); }
  assertCurrentTarget() {
    if (this.nativeTarget) require(this.targetModule).assertTargetDirectory(this.nativeTarget);
    if (this.nativeSelection && !equal(this.nativeTarget, this.nativeSelection()))
      throw fail('MCP_NATIVE_TARGET_CHANGED', this.adapter === 'pi'
        ? 'Pi 已切换原生 Agent 目录；请先移除原接入配置，再为当前目录添加。原连接和任务未重发。'
        : this.adapter === 'hermes' ? 'Hermes 已切换原生 Home 或 Profile；请先移除原接入配置，再为当前目标添加。原连接和任务未重发。'
        : 'DSH Desktop 已切换数据目录或 Profile；请先移除原接入配置，再为当前 Profile 添加。原连接和任务未重发。');
  }
  matches(entry, owned) {
    // OpenDesk 0.3.9 persists this schema default even for stdio. Accept only
    // the empty object on an otherwise identical, registered stdio entry.
    // Never ignore unknown fields or apply this equivalence to other adapters.
    const normalize = value => {
      if (this.adapter === 'hermes') return require('./hermes-mcp-config.cjs').normalizeEntry(value);
      if (this.adapter === 'pi' && value && typeof value === 'object' && !Array.isArray(value) && typeof value.enabled === 'boolean') {
        const copy = {...value}; delete copy.enabled; return copy;
      }
      if (!this.openDesk || value?.transport !== 'stdio' || !value.headers ||
          typeof value.headers !== 'object' || Array.isArray(value.headers) ||
          Object.keys(value.headers).length) return value;
      const copy = {...value};
      delete copy.headers;
      return copy;
    };
    return equal(normalize(entry), normalize(owned));
  }
  disabled(entry) {return this.adapter === 'hermes' ? !require('./hermes-mcp-config.cjs').enabled(entry?.enabled) : this.adapter === 'pi' && entry?.enabled === false;}
  update(entry, owned) {
    if (entry) this.assertCurrentTarget();
    const { text, entry: current } = this.inspect();
    if (entry && this.disabled(current))
      throw fail('MCP_NATIVE_DISABLED', '原生 AgentBridge MCP 已禁用，Bridge 不会重新启用；请在原生 MCP 设置中启用后核对。');
    if (
      current !== undefined &&
      !this.matches(current, owned) &&
      !equal(current, entry)
    )
      throw fail(
        "MCP_CONFIG_CONFLICT",
        "agentbridge 条目已存在或被外部修改，已保留原配置。",
      );
    if (equal(current, entry) || (this.matches(current, owned) && this.matches(current, entry))) return;
    let next;
    if (this.dshWeb) {
      if (entry && !fs.existsSync(path.dirname(this.file)))
        throw fail("MCP_PROFILE_MISSING", "未找到 DSH Web 的原生 profile 目录；请先启动一次 DSH Web 再添加 AgentBridge MCP。");
      const doc = dshDocument(text, this.file);
      const rows = dshRows(doc);
      for (const row of rows.sort((a, b) => b.patchIndex - a.patchIndex)) {
        const patch = doc.contents.items[row.patchIndex];
        const insert = patch.get('insert');
        insert.items.splice(row.rowIndex, 1);
        if (!insert.items.length) doc.contents.items.splice(row.patchIndex, 1);
      }
      if (entry) {
        const patch = new YAML.YAMLMap();
        patch.set('insert', doc.createNode([entry]));
        doc.contents.items.push(patch);
      }
      next = doc.toString();
    } else if (this.adapter === 'hermes') {
      const {doc} = require('./hermes-mcp-config.cjs').document(text);
      if (entry) {
        if (!YAML.isMap(doc.get('mcp_servers', true))) doc.set('mcp_servers', new YAML.YAMLMap());
        doc.setIn(['mcp_servers', 'agentbridge'], doc.createNode(entry));
      } else doc.deleteIn(['mcp_servers', 'agentbridge']);
      next = doc.toString();
    } else if (this.adapter === "codex") {
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
        jsonc.modify(text || "{}\n", this.keys, this.openDesk ? [...this.inspect().servers.filter(item=>item.id!=="agentbridge"), ...(entry ? [entry] : [])] : entry, {
          formattingOptions: { insertSpaces: true, tabSize: 2 },
        }),
      );
    if (!this.dshWeb) parse(next, this.adapter);
    let updated = this.dshWeb
      ? dshInspect(next, this.file).entry
      : this.keys.reduce((v, key) => v?.[key], parse(next, this.adapter));
    if (this.openDesk) updated = updated?.find(item => item.id === "agentbridge");
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
      if (entry) this.assertCurrentTarget();
      fs.renameSync(tmp, this.file);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
}
module.exports = { McpConfig, nativeEntry, equal, dshPatchFile, dshRowId, dshProfile };
