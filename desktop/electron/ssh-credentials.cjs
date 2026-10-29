const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { problem } = require('./ssh-known-hosts.cjs');

const dpapiScript = `$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
if ($request.operation -eq 'protect') {
  $bytes = [Text.Encoding]::UTF8.GetBytes([string]$request.value)
  $result = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  [Console]::Out.Write([Convert]::ToBase64String($result))
} elseif ($request.operation -eq 'unprotect') {
  $bytes = [Convert]::FromBase64String([string]$request.value)
  $result = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  [Console]::Out.Write([Text.Encoding]::UTF8.GetString($result))
} else { exit 2 }`;
function dpapi(operation, value) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(dpapiScript, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    let output = '', finished = false;
    const fail = () => { if (finished) return; finished = true; child.kill(); reject(problem('CREDENTIAL_STORE_UNAVAILABLE', 'Windows 系统凭据保护不可用，凭据没有保存。')); };
    const timer = setTimeout(fail, 15000); timer.unref?.();
    child.stdout.on('data', chunk => { output += chunk.toString('utf8'); if (Buffer.byteLength(output) > 131072) fail(); });
    child.stderr.resume(); child.on('error', fail);
    child.on('close', code => { clearTimeout(timer); if (finished) return; if (code !== 0 || !output) return fail(); finished = true; resolve(output); });
    child.stdin.on('error', fail); child.stdin.end(JSON.stringify({ operation, value }));
  });
}
class CredentialStore {
  constructor(directory, options = {}) {
    this.directory = path.join(directory, 'ssh-credentials'); this.platform = options.platform || process.platform;
    this.protect = options.protect || (value => dpapi('protect', value));
    this.unprotect = options.unprotect || (value => dpapi('unprotect', value));
    this.ensurePrivate = options.ensurePrivate || (async target => require('./private-directory.cjs').ensurePrivateDirectory(target));
    this.memory = new Map(); this.expiries = new Map(); this.ttlMs = options.ttlMs || 300000;
  }
  get saveSupported() { return this.platform === 'win32'; }
  async provide(connection, input) {
    if (typeof input.secret !== 'string' || Buffer.byteLength(input.secret) > 32768 || input.secret.includes('\0')) throw problem('INVALID_INPUT', '请输入有效的 SSH 密码或私钥口令。');
    const secret = input.passphrase ?? input.secret;
    if (typeof secret !== 'string' || Buffer.byteLength(secret) > 32768) throw problem('INVALID_INPUT', '私钥口令格式无效。');
    const buffer = Buffer.from(secret, 'utf8');
    this.discard(connection.connectionId); this.memory.set(connection.connectionId, buffer);
    const expiry = setTimeout(() => this.discard(connection.connectionId), this.ttlMs); expiry.unref?.(); this.expiries.set(connection.connectionId, expiry);
    if (input.save) {
      if (!this.saveSupported) { this.discard(connection.connectionId); throw problem('CREDENTIAL_STORE_UNAVAILABLE', '当前系统不能安全保存 SSH 凭据，请使用本次输入。'); }
      try {
        const encrypted = await this.protect(secret); await this.ensurePrivate(this.directory);
        const credentialRef = 'credential-' + randomUUID();
        const file = path.join(this.directory, credentialRef + '.json');
        fs.writeFileSync(file, JSON.stringify({ version: 1, kind: 'dpapi-current-user', ciphertext: encrypted }), { mode: 0o600 });
        const previous = connection.credentialRef; connection.credentialRef = credentialRef;
        if (previous) this.remove(previous);
      } catch (error) { this.discard(connection.connectionId); throw problem('CREDENTIAL_STORE_UNAVAILABLE', '无法使用 Windows 系统保护保存凭据；没有写入明文凭据。'); }
    } else if (connection.credentialRef) { this.remove(connection.credentialRef); delete connection.credentialRef; }
    return { available: true, saved: !!input.save };
  }
  available(connection) { return this.memory.has(connection.connectionId) || !!connection.credentialRef || connection.authKind === 'agent' || connection.authKind === 'privateKey'; }
  async read(connection) {
    const buffer = this.memory.get(connection.connectionId); if (buffer) return buffer.toString('utf8');
    if (!connection.credentialRef) return undefined;
    if (!this.saveSupported || !/^credential-[a-f0-9-]+$/.test(connection.credentialRef)) throw problem('CREDENTIAL_STORE_UNAVAILABLE', '保存的 SSH 凭据当前不可读取。');
    try {
      const stored = JSON.parse(fs.readFileSync(path.join(this.directory, connection.credentialRef + '.json'), 'utf8'));
      if (stored.version !== 1 || stored.kind !== 'dpapi-current-user' || typeof stored.ciphertext !== 'string') throw new Error();
      return await this.unprotect(stored.ciphertext);
    } catch { throw problem('CREDENTIAL_STORE_UNAVAILABLE', '无法解密当前用户保存的 SSH 凭据，请重新输入。'); }
  }
  discard(connectionId) { clearTimeout(this.expiries.get(connectionId)); this.expiries.delete(connectionId); const previous = this.memory.get(connectionId); if (previous) previous.fill(0); this.memory.delete(connectionId); }
  remove(ref) {
    if (!/^credential-[a-f0-9-]+$/.test(ref)) return;
    // This is one exact file, not a directory tree. unlink also removes it on
    // Windows runtimes where rmSync silently leaves Unicode paths in place.
    try { fs.unlinkSync(path.join(this.directory, ref + '.json')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  close() { for (const id of this.memory.keys()) this.discard(id); }
}
module.exports = { CredentialStore, dpapi, dpapiScript };
