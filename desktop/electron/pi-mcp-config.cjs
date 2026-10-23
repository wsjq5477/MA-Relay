const fs = require('node:fs');
const path = require('node:path');
const fail = message => Object.assign(new Error(message), {code: 'MCP_PI_TARGET'});
function validateTarget(value) {
  if (!value || value.kind !== 'pi-agent-dir' || typeof value.agentDir !== 'string' ||
      !path.isAbsolute(value.agentDir) || /[\0\r\n]/.test(value.agentDir))
    throw fail('Pi 原接入目录无法核对，请保留原登记并核对 PI_CODING_AGENT_DIR。');
  return {kind: 'pi-agent-dir', agentDir: path.resolve(value.agentDir)};
}
function targetFile(value) { return path.join(validateTarget(value).agentDir, 'mcp.json'); }
function currentTarget(home, env) {
  let agentDir = env.PI_CODING_AGENT_DIR || path.join(home, '.pi', 'agent');
  if (agentDir === '~' || /^~[\\/]/.test(agentDir)) agentDir = path.join(home, agentDir.slice(2));
  return validateTarget({kind: 'pi-agent-dir', agentDir});
}
function assertTargetDirectory(value) {
  // A saved target must not be redirected through a replaced parent directory.
  for (let dir = validateTarget(value).agentDir; dir !== path.dirname(dir); dir = path.dirname(dir)) {
    try {
      const stat = fs.lstatSync(dir);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw fail('Pi 原接入目录包含链接或已被替换，已保留原配置。');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
function compatibleVersion(version) {
  const match = typeof version === 'string' && /^1\.(\d+)\.(\d+)$/.exec(version);
  return !!match && Number(match[1]) >= 4;
}
function parseNativeList(stdout) {
  try {
    const value = JSON.parse(stdout);
    if (!Array.isArray(value.servers) || !Array.isArray(value.errors)) throw Error();
    const entries = value.servers.filter(entry => entry?.name === 'agentbridge');
    if (entries.length > 1) throw Error();
    const entry = entries[0];
    if (!entry) return {outcome: 'absent', detail: 'Pi 原生列表未返回 agentbridge。'};
    if (entry.scope !== 'global' || entry.override)
      return {outcome: 'error', detail: 'Pi 项目配置覆盖了用户条目，请在原生项目设置核对；Bridge 不修改项目配置。'};
    if (!entry.enabled || entry.state === 'disabled') return {outcome: 'absent', detail: 'Pi 原生列表中的 agentbridge 已禁用。'};
    if (entry.state === 'connected') return {outcome: 'connected', detail: 'Pi 原生 agentbridge 已连接；工具数量：' + (Array.isArray(entry.tools) ? entry.tools.length : 0)};
    return {outcome: 'failed', detail: 'Pi 原生 agentbridge 未连接。'};
  } catch { return {outcome: 'error', detail: 'Pi 原生 MCP 列表不是已核对的 JSON 格式。'}; }
}
module.exports = {validateTarget, targetFile, currentTarget, assertTargetDirectory, compatibleVersion, parseNativeList};
