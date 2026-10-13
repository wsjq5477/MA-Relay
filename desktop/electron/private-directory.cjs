const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const secured = new Set();

function ensurePrivateDirectory(directory, options = {}) {
  const platform = options.platform || process.platform;
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw Object.assign(new Error('后台私有目录被其他文件占用，请保留现场排查。'), { code: 'PRIVATE_DIRECTORY' });
  if (platform === 'win32') {
    if (!secured.has(directory)) {
      const run = options.execFileSync || execFileSync;
      const identity = run('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
      const sid = identity.match(/S-1-5-\d+(?:-\d+)+/i)?.[0];
      if (!sid) throw Object.assign(new Error('无法确认当前 Windows 用户，未建立后台连接。'), { code: 'PRIVATE_DIRECTORY' });
      run('icacls.exe', [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true, timeout: 10000, stdio: 'pipe' });
      secured.add(directory);
    }
  } else {
    if (typeof process.getuid === 'function' && stat.uid !== process.getuid())
      throw Object.assign(new Error('后台目录不属于当前用户。'), { code: 'PRIVATE_DIRECTORY' });
    fs.chmodSync(directory, 0o700);
  }
  return directory;
}
module.exports = { ensurePrivateDirectory };
