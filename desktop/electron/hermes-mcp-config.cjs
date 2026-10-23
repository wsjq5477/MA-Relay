const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const fail = message => Object.assign(new Error(message), {code: 'MCP_HERMES_TARGET'});
const namePattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;
function absolute(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || /[\0\r\n]/.test(value)) throw fail('Hermes 原生路径无法核对，请核对 HERMES_HOME 与 Profile。');
  return path.resolve(value);
}
function validateTarget(value) {
  if (!value || value.kind !== 'hermes-profile' || typeof value.named !== 'boolean' || typeof value.profile !== 'string' || !namePattern.test(value.profile)) throw fail('Hermes 原接入 Profile 无法核对，请保留原登记。');
  const home = absolute(value.home), root = absolute(value.root);
  if (value.named && home !== path.join(root, 'profiles', value.profile)) throw fail('Hermes 原接入目录与 Profile 不匹配。');
  return {kind: 'hermes-profile', home, root, profile: value.profile, named: value.named};
}
function targetFile(target) {return path.join(validateTarget(target).home, 'config.yaml');}
function assertTargetDirectory(target) {
  for (let dir = validateTarget(target).home; dir !== path.dirname(dir); dir = path.dirname(dir)) {
    try {const stat = fs.lstatSync(dir); if (!stat.isDirectory() || stat.isSymbolicLink()) throw fail('Hermes 原接入目录已变成链接或被替换，已保留原配置。');}
    catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
}
function expand(value, home, env, windows) {
  const names = windows ? Object.fromEntries(Object.entries(env).map(([key, value]) => [key.toUpperCase(), value])) : env;
  let text = String(value).trim();
  const pattern = windows ? /%([^%]+)%|\$\{([^}]+)\}|\$([A-Za-z0-9_-]+)/g : /\$\{([^}]+)\}|\$([A-Za-z0-9_]+)/g;
  text = text.replace(pattern, (_match, ...parts) => {
    const name = parts.slice(0, windows ? 3 : 2).find(Boolean), found = names[windows ? name.toUpperCase() : name];
    if (typeof found !== 'string') throw fail('Hermes 路径引用的环境变量未配置，Bridge 不猜测目标。');
    return found;
  });
  if (text === '~' || /^~[\\/]/.test(text)) text = path.join(home, text.slice(2));
  return absolute(text);
}
function inside(child, parent) {const relative = path.relative(parent, child); return !relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));}
function currentTarget(home, env, platform = process.platform) {
  const windows = platform === 'win32', suffix = env.HERMES_DATA_DIR_SUFFIX || '';
  if (/[\0\r\n\\/]/.test(suffix)) throw fail('Hermes 数据目录后缀无法核对。');
  const nativeRoot = absolute(windows ? path.join(env.LOCALAPPDATA?.trim() || path.join(home, 'AppData', 'Local'), 'hermes' + suffix) : path.join(home, '.hermes' + suffix));
  const explicit = typeof env.HERMES_HOME === 'string' && !!env.HERMES_HOME.trim();
  const base = explicit ? expand(env.HERMES_HOME, home, env, windows) : nativeRoot;
  const pinned = explicit && path.basename(path.dirname(base)) === 'profiles';
  const activeRoot = inside(base, nativeRoot) ? nativeRoot : pinned ? path.dirname(path.dirname(base)) : base;
  let profile = pinned ? path.basename(base) : base === nativeRoot ? 'default' : 'custom', selected = base, root = pinned ? path.dirname(path.dirname(base)) : base, named = pinned;
  if (!pinned) {
    const file = path.join(activeRoot, 'active_profile');
    let active;
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw fail('Hermes active_profile 无法核对，已保留原配置。');
      active = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim().toLowerCase();
    } catch (error) {if (error.code !== 'ENOENT') throw error;}
    if (active && active !== 'default') {
      if (!namePattern.test(active)) throw fail('Hermes active_profile 无效，Bridge 不回落默认 Profile。');
      // The CLI reads the sticky name at its default root, then resolves that
      // name relative to the launch HERMES_HOME (which can be a custom root).
      profile = active; root = base; selected = path.join(root, 'profiles', active); named = true;
    }
  }
  const target = validateTarget({kind: 'hermes-profile', home: selected, root, profile, named});
  assertTargetDirectory(target);
  if (named) {
    const markers = ['config.yaml', '.env', 'SOUL.md', 'profile.yaml', 'auth.json', 'state.db'];
    const live = fs.existsSync(selected) && fs.statSync(selected).isDirectory() && markers.some(marker => {
      try {const stat = fs.lstatSync(path.join(selected, marker)); return stat.isFile() || stat.isSymbolicLink();} catch {return false;}
    });
    if (!live || fs.existsSync(path.join(path.dirname(selected), '.deleted', profile))) throw fail('Hermes 原生 Profile 不存在或已删除；Bridge 不新建或恢复 Profile。');
  }
  return target;
}
function document(text) {
  const doc = YAML.parseDocument(text, {version: '1.1', uniqueKeys: true, prettyErrors: false});
  if (doc.errors.length || doc.warnings.length || (doc.contents && !YAML.isMap(doc.contents))) throw Object.assign(Error('Hermes YAML 配置无法解析，已保留原文件。'), {code: 'MCP_CONFIG_INVALID'});
  if (!doc.contents) doc.contents = new YAML.YAMLMap();
  const merged = map => map.items.some(pair => pair.key?.value === '<<' || typeof pair.key?.value === 'symbol');
  const servers = doc.get('mcp_servers', true);
  if (servers && !(YAML.isScalar(servers) && servers.value === null) && (!YAML.isMap(servers) || merged(servers))) throw Object.assign(Error('Hermes MCP 配置含歧义结构或合并，已保留原文件。'), {code: 'MCP_CONFIG_INVALID'});
  const node = YAML.isMap(servers) ? servers.get('agentbridge', true) : undefined;
  if (node && (!YAML.isMap(node) || merged(node))) throw Object.assign(Error('Hermes agentbridge 配置含歧义结构，已保留原文件。'), {code: 'MCP_CONFIG_INVALID'});
  // Reject a root merge too: it may provide an inherited MCP with the same key.
  if (merged(doc.contents)) throw Object.assign(Error('Hermes 顶层合并配置需在原生设置处理，Bridge 不猜测覆盖关系。'), {code: 'MCP_CONFIG_CONFLICT'});
  const data = doc.toJS({maxAliasCount: 20});
  return {doc, data, entry: data?.mcp_servers?.agentbridge};
}
function enabled(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'boolean' || typeof value === 'number') return !!value;
  if (typeof value === 'string' && /^(?:true|1|yes|on|false|0|no|off)$/i.test(value.trim())) return /^(?:true|1|yes|on)$/i.test(value.trim());
  return true;
}
function normalizeEntry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, 'enabled')) return value;
  const flag = value.enabled;
  if (flag === null || typeof flag === 'boolean' || typeof flag === 'number' || (typeof flag === 'string' && /^(?:true|1|yes|on|false|0|no|off)$/i.test(flag.trim()))) {
    const copy = {...value}; delete copy.enabled; return copy;
  }
  return value;
}
function parseNativeList(stdout) {
  const lines = stdout.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').split(/\r?\n/).filter(line => /^\s*agentbridge\s+/.test(line));
  if (lines.length > 1) return {outcome: 'error', detail: 'Hermes 原生列表中存在歧义 AgentBridge 条目。'};
  if (!lines.length) return {outcome: 'absent', detail: 'Hermes 原生列表未返回 agentbridge。'};
  if (/\s✗\s+disabled\s*$/.test(lines[0])) return {outcome: 'absent', detail: 'Hermes 原生 AgentBridge 条目已禁用。'};
  if (/\s✓\s+enabled\s*$/.test(lines[0])) return {outcome: 'listed', detail: 'Hermes 原生列表已加载 agentbridge；列表不证明连接或工具调用。'};
  return {outcome: 'error', detail: 'Hermes 原生列表格式无法核对。'};
}
module.exports = {currentTarget, validateTarget, targetFile, assertTargetDirectory, document, enabled, normalizeEntry, parseNativeList};
