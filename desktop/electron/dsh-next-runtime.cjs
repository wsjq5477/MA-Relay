const fs = process.versions.electron ? require('original-fs') : require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFile} = require('node:child_process');

const name = 'DSH NEXT';
const filename = name + '.exe';
const cli = 'desktop-cli.js';

function installation(executable) {
  if (typeof executable !== 'string' || !path.isAbsolute(executable) || path.basename(executable).toLowerCase() !== filename.toLowerCase()) return null;
  let fd;
  try {
    const resolved = fs.realpathSync(executable);
    if (path.basename(resolved).toLowerCase() !== filename.toLowerCase() || !fs.statSync(resolved).isFile()) return null;
    const archive = path.join(path.dirname(resolved), 'resources', 'app.asar');
    fd = fs.openSync(archive, 'r');
    const prefix = Buffer.alloc(16);
    if (fs.readSync(fd, prefix, 0, prefix.length, 0) !== prefix.length || prefix.readUInt32LE(0) !== 4) return null;
    const headerSize = prefix.readUInt32LE(4), jsonSize = prefix.readUInt32LE(12), size = fs.fstatSync(fd).size;
    if (jsonSize < 2 || jsonSize > 32 * 1024 * 1024 || headerSize < jsonSize + 8 || 8 + headerSize > size) return null;
    const header = Buffer.alloc(jsonSize);
    if (fs.readSync(fd, header, 0, jsonSize, 16) !== jsonSize) return null;
    const {files} = JSON.parse(header);
    const manifest = files?.['package.json'], entry = files?.lib?.files?.[cli];
    const offset = file => {
      if (!file || file.unpacked || !/^\d+$/.test(file.offset) || !Number.isSafeInteger(file.size) || file.size < 1) return null;
      const start = 8 + headerSize + Number(file.offset);
      return Number.isSafeInteger(start) && start + file.size <= size ? start : null;
    };
    const start = offset(manifest);
    if (start === null || manifest.size > 65536 || offset(entry) === null) return null;
    const bytes = Buffer.alloc(manifest.size);
    if (fs.readSync(fd, bytes, 0, bytes.length, start) !== bytes.length) return null;
    const {name: packageName, version} = JSON.parse(bytes);
    if (packageName !== 'dsh-desktop-next' || typeof version !== 'string' || !/^\d+\.\d+\.\d+-next(?:[.-][\w.-]+)?$/.test(version)) return null;
    return {adapter:'dsh-next', name, version, executable:resolved, entry:path.join(archive, 'lib', cli), healthy:true};
  } catch { return null; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}

// Read the installer's Start menu shortcut for custom installation locations.
// The shortcut is data; only a verified DSH NEXT executable is ever launched.
function shortcutTargets(env) {
  if (process.platform !== 'win32' || !env.SystemRoot || !env.APPDATA) return Promise.resolve([]);
  const powershell = path.join(env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$shell = New-Object -ComObject WScript.Shell
$paths = @($shell.SpecialFolders.Item('Programs'), $shell.SpecialFolders.Item('AllUsersPrograms'))
$targets = @(foreach ($directory in $paths) {
  if ($directory) { Get-ChildItem -LiteralPath $directory -Filter 'DSH NEXT.lnk' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object { $shell.CreateShortcut($_.FullName).TargetPath } }
})
ConvertTo-Json -InputObject $targets -Compress`;
  return new Promise(resolve => execFile(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], {env, windowsHide:true, timeout:5000, maxBuffer:65536}, (error, stdout) => {
    if (error) return resolve([]);
    try { const targets = JSON.parse(stdout); resolve(Array.isArray(targets) ? targets : []); }
    catch { resolve([]); }
  }));
}

async function discover(options = {}) {
  if ((options.platform || process.platform) !== 'win32') return [];
  const env = options.environment || process.env;
  const local = env.LOCALAPPDATA || path.join(options.home || os.homedir(), 'AppData', 'Local');
  const directories = [path.join(local, 'Programs'), env.ProgramFiles, env['ProgramFiles(x86)']].filter(Boolean);
  const candidates = options.candidates?.['dsh-next'] ?? directories.map(directory => path.join(directory, name, filename));
  const detected = candidates.map(installation).filter(Boolean);
  if (!detected.length && !options.candidates?.['dsh-next']) detected.push(...(await shortcutTargets(env)).map(installation).filter(Boolean));
  return [...new Map(detected.map(({entry, ...row}) => [row.executable.toLowerCase(), row])).values()];
}

function launch(executable, args, home, env = process.env) {
  const target = installation(executable);
  if (!target || !path.isAbsolute(home || '')) throw Object.assign(new Error('DSH NEXT 的原生安装或数据目录不可用，请重新扫描。'), {code:'TOOL_LAUNCHER'});
  return {executable:target.executable, args:[target.entry, ...args], env:{...env, ELECTRON_RUN_AS_NODE:'1', DSH_HOME:home}};
}

module.exports = {discover, launch};
