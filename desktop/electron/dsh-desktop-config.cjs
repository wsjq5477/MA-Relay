const fs = require('node:fs');
const path = require('node:path');
const fail = message => Object.assign(new Error(message), {code: 'MCP_DSH_DESKTOP_TARGET'});
const record = value => value && typeof value === 'object' && !Array.isArray(value);
function json(file, optional = false) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) throw Error();
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!record(value)) throw Error();
    return value;
  } catch (error) {
    if (optional && error.code === 'ENOENT') return undefined;
    throw fail('无法核对 DSH Desktop 的原生选择记录或 Profile；已保留原配置，请在原生设置核对数据目录与 Profile。');
  }
}
function profileName(value) {
  if (typeof value !== 'string' || !value || ['.', '..', 'node_modules'].includes(value) ||
      Buffer.byteLength(value, 'utf8') > 255 || /[\\/\x00-\x1f\x7f-\x9f<>:"|?*]/.test(value) ||
      /[. ]$/.test(value) || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(value) ||
      /^\..+\.(?:creating|deleting|incomplete)-\d+-[0-9a-f-]{36}$/i.test(value))
    throw fail('DSH Desktop Profile 名称无效；Bridge 不猜测或跳转到其他 Profile。');
  return value;
}
function validateTarget(value) {
  if (!record(value) || typeof value.home !== 'string' || !path.isAbsolute(value.home) || /[\0\r\n]/.test(value.home))
    throw fail('DSH Desktop 原接入目标无法核对，请保留原登记。');
  return {home: path.resolve(value.home), profile: profileName(value.profile)};
}
function targetFile(value) {
  const target = validateTarget(value);
  return path.join(target.home, 'profiles', target.profile, 'cordis.patch.yml');
}
function assertTargetDirectory(value) {
  const target = validateTarget(value), directory = path.dirname(targetFile(target));
  for (const dir of [target.home, path.dirname(directory), directory]) {
    let stat;
    try { stat = fs.lstatSync(dir); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw fail('DSH Desktop 原接入目录已被替换或变为链接；已保留原配置，请核对原目标。');
  }
}
function desktopTarget(home, env = process.env) {
  const appData = env.APPDATA || (process.platform === 'win32' ? path.join(home, 'AppData', 'Roaming') : process.platform === 'darwin'
    ? path.join(home, 'Library', 'Application Support') : env.XDG_CONFIG_HOME || path.join(home, '.config'));
  const userData = path.join(appData, 'DSH Desktop');
  const location = json(path.join(userData, 'data-directory', 'state.json'), true);
  let root = env.DSH_HOME?.trim() || path.join(home, '.dsh');
  if (root === '~' || /^~[\\/]/.test(root)) root = path.join(home, root.slice(2));
  root = path.resolve(root);
  if (location) {
    const keys = Object.keys(location).sort().join(',');
    const timestamp = Date.parse(location.updatedAt);
    if (keys !== 'activeHome,generation,previousHome,updatedAt,version' || location.version !== 1 ||
        !Number.isSafeInteger(location.generation) || location.generation < 1 ||
        !(location.previousHome === null || typeof location.previousHome === 'string' && path.isAbsolute(location.previousHome)) ||
        !Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== location.updatedAt)
      throw fail('DSH Desktop 数据目录选择记录无法核对，Bridge 不回落到默认目录。');
    root = validateTarget({home: location.activeHome, profile: 'desktop'}).home;
  }
  const selection = json(path.join(userData, 'profile-selection', 'state.json'), true);
  if (selection && selection.version !== 2)
    throw fail('DSH Desktop Profile 选择记录版本无法核对，请保留原记录。');
  const target = validateTarget({home: root, profile: selection ? selection.active : 'desktop'});
  const directory = path.dirname(targetFile(target));
  try {
    for (const dir of [target.home, path.dirname(directory), directory]) {
      const stat = fs.lstatSync(dir);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error();
    }
    const manifest = json(path.join(directory, 'package.json'));
    if (!Array.isArray(manifest.dsh?.profile?.bundles) || !manifest.dsh.profile.bundles.includes('@deepseek-ai/dsh-web-app')) throw Error();
  } catch {
    throw fail('未找到 DSH Desktop 当前 Profile 的原生 Web 配置；请先在 DSH Desktop 打开该 Profile，Bridge 不新建或替换 Profile。');
  }
  return target;
}
module.exports = {desktopTarget, validateTarget, targetFile, assertTargetDirectory};
