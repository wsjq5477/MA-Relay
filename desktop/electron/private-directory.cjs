const fs = require('node:fs');
const path = require('node:path');
const { execFile, execFileSync } = require('node:child_process');

const windowsTimeoutMs = 10000;
const retryDelayMs = 30000;
const initializing = new Map();
const failures = new Map();

// Use the Windows security descriptor directly, without enumerating descendants
// or relying on localized icacls output. Apply the protected DACL in one write.
const aclScript = `$ErrorActionPreference = 'Stop'
$folder = [IO.DirectoryInfo]::new($env:AGENTBRIDGE_PRIVATE_DIRECTORY)
if ($folder.Attributes -band [IO.FileAttributes]::ReparsePoint) { exit 2 }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$sid = $identity.User
$sections = [Security.AccessControl.AccessControlSections]'Access, Owner'
$inheritance = [Security.AccessControl.InheritanceFlags]'ObjectInherit, ContainerInherit'
$fullControl = [Security.AccessControl.FileSystemRights]::FullControl

function Read-Descriptor {
  $acl = $folder.GetAccessControl($sections)
  [Security.AccessControl.RawSecurityDescriptor]::new($acl.GetSecurityDescriptorBinaryForm(), 0)
}

function Test-Private($descriptor) {
  if (!$descriptor -or !$descriptor.Owner.Equals($sid) -or
      !($descriptor.ControlFlags -band [Security.AccessControl.ControlFlags]::DiscretionaryAclProtected) -or
      $descriptor.DiscretionaryAcl.Count -ne 1) { return $false }
  $entry = $descriptor.DiscretionaryAcl[0]
  return $entry.AceType -eq [Security.AccessControl.AceType]::AccessAllowed -and
    $entry.AceFlags -eq [Security.AccessControl.AceFlags]'ObjectInherit, ContainerInherit' -and
    $entry.AccessMask -eq [int]$fullControl -and $entry.SecurityIdentifier.Equals($sid)
}

$existing = $null
try { $existing = Read-Descriptor } catch {}
if (Test-Private $existing) { [Console]::Out.Write('verified'); exit 0 }

$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetAccessRuleProtection($true, $false)
if (!$existing -or !$existing.Owner.Equals($sid)) { $acl.SetOwner($sid) }
$rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, $fullControl, $inheritance,
  [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow)
$acl.AddAccessRule($rule)
$folder.SetAccessControl($acl)
if (!(Test-Private (Read-Descriptor))) { exit 3 }
[Console]::Out.Write('repaired')`;
const aclArgs = ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(aclScript, 'utf16le').toString('base64')];

function directoryError(code = 'PRIVATE_DIRECTORY') {
  const message = code === 'PRIVATE_DIRECTORY_TIMEOUT'
    ? '后台私有目录权限初始化超时，请稍后重新连接。'
    : '无法安全初始化后台私有目录，请检查目录权限后重新连接。';
  return Object.assign(new Error(code + '：' + message), { code });
}

function assertDirectory(stat) {
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw Object.assign(new Error('后台私有目录被其他文件占用，请保留现场排查。'), { code: 'PRIVATE_DIRECTORY' });
}

function assertOwner(stat) {
  if (typeof process.getuid === 'function' && stat.uid !== process.getuid())
    throw Object.assign(new Error('后台目录不属于当前用户。'), { code: 'PRIVATE_DIRECTORY' });
}

function windowsCommand(directory) {
  return [
    path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    aclArgs,
    {
      encoding: 'utf8', windowsHide: true, timeout: windowsTimeoutMs, maxBuffer: 16384,
      env: { ...process.env, AGENTBRIDGE_PRIVATE_DIRECTORY: directory }
    }
  ];
}

function confirmWindowsProtection(output) {
  if (!['verified', 'repaired'].includes(output.trim())) throw directoryError();
}

function rememberFailure(directory, cause) {
  const timedOut = cause.code === 'ETIMEDOUT' ||
    (cause.killed && cause.code === null && cause.signal === 'SIGTERM');
  const error = directoryError(timedOut ? 'PRIVATE_DIRECTORY_TIMEOUT' : 'PRIVATE_DIRECTORY');
  failures.set(directory, { error, expires: Date.now() + retryDelayMs });
  return error;
}

function recentFailure(directory) {
  const previous = failures.get(directory);
  if (previous && previous.expires > Date.now()) return previous.error;
  failures.delete(directory);
}

// Explicitly reconnecting can retry sooner. An active operation is shared.
function retryPrivateDirectory(directory) {
  failures.delete(path.resolve(directory));
}

function ensurePrivateDirectory(directory, options = {}) {
  if ((options.platform || process.platform) !== 'win32') {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(directory);
    assertDirectory(stat);
    assertOwner(stat);
    fs.chmodSync(directory, 0o700);
    return directory;
  }

  const target = path.resolve(directory);
  const previous = recentFailure(target);
  if (previous) throw previous;
  if (initializing.has(target)) throw directoryError();
  try {
    fs.mkdirSync(target, { recursive: true });
    assertDirectory(fs.lstatSync(target));
    const run = options.execFileSync || execFileSync;
    confirmWindowsProtection(run(...windowsCommand(target)));
    return directory;
  } catch (error) {
    throw rememberFailure(target, error);
  }
}

async function ensurePrivateDirectoryAsync(directory, options = {}) {
  if ((options.platform || process.platform) !== 'win32') return ensurePrivateDirectory(directory, options);
  const target = path.resolve(directory);
  const previous = recentFailure(target);
  if (previous) throw previous;
  if (!initializing.has(target)) {
    const initialize = async () => {
      try {
        await fs.promises.mkdir(target, { recursive: true });
        assertDirectory(await fs.promises.lstat(target));
        const run = options.execFile || execFile;
        const output = await new Promise((resolve, reject) => {
          run(...windowsCommand(target), (error, stdout) => error ? reject(error) : resolve(stdout));
        });
        confirmWindowsProtection(output);
      } catch (error) {
        throw rememberFailure(target, error);
      } finally {
        initializing.delete(target);
      }
    };
    initializing.set(target, initialize());
  }
  await initializing.get(target);
  return directory;
}

module.exports = { ensurePrivateDirectory, ensurePrivateDirectoryAsync, retryPrivateDirectory };
