const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash, createHmac, timingSafeEqual, randomUUID } = require('node:crypto');

function problem(code, message, details) { return Object.assign(new Error(message), { code, ...(details ? { details } : {}) }); }
function fingerprint(key) { return 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, ''); }
function keyType(key) {
  if (!Buffer.isBuffer(key) || key.length < 8) throw problem('SSH_HOST_KEY_INVALID', '服务器返回的 SSH 主机公钥无效。');
  const size = key.readUInt32BE(0);
  if (size < 1 || size > 100 || size + 4 > key.length) throw problem('SSH_HOST_KEY_INVALID', '服务器返回的 SSH 主机公钥无效。');
  return key.subarray(4, 4 + size).toString('ascii');
}
function endpoint(host, port = 22) { return port === 22 ? host.toLowerCase() : '[' + host.toLowerCase() + ']:' + port; }
function same(a, b) { const aa = Buffer.from(a, 'base64'), bb = Buffer.from(b, 'base64'); return aa.length === bb.length && timingSafeEqual(aa, bb); }
function glob(pattern, value) {
  return new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replaceAll('?', '.') + '$', 'i').test(value);
}
function matches(patterns, target) {
  if (patterns.startsWith('|1|')) {
    const parts = patterns.split('|');
    if (parts.length !== 4) return false;
    const actual = createHmac('sha1', Buffer.from(parts[2], 'base64')).update(target).digest();
    const expected = Buffer.from(parts[3], 'base64');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  let accepted = false;
  for (const pattern of patterns.split(',')) {
    if (pattern.startsWith('!')) { if (glob(pattern.slice(1), target)) return false; }
    else if (glob(pattern, target)) accepted = true;
  }
  return accepted;
}
class KnownHosts {
  constructor(directory, options = {}) {
    this.file = path.join(directory, 'ssh-known-hosts.json');
    this.openSshFiles = options.openSshFiles || [path.join(os.homedir(), '.ssh', 'known_hosts')];
    this.records = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : { version: 1, hosts: {} };
    if (this.records.version !== 1 || !this.records.hosts || typeof this.records.hosts !== 'object') throw problem('SSH_KNOWN_HOSTS_INVALID', 'Bridge 主机信任记录无法读取，请检查文件。');
  }
  check(host, port, rawKey) {
    const target = endpoint(host, port), publicKey = rawKey.toString('base64');
    const offered = { target, keyType: keyType(rawKey), publicKey, fingerprint: fingerprint(rawKey) };
    const matching = [];
    for (const file of this.openSshFiles) {
      if (!fs.existsSync(file)) continue;
      let content;
      try { content = fs.readFileSync(file, 'utf8'); } catch { throw problem('SSH_KNOWN_HOSTS_UNREADABLE', '无法读取本机 OpenSSH 主机信任记录。'); }
      for (const raw of content.split(/\r?\n/)) {
        const line = raw.trim(); if (!line || line.startsWith('#')) continue;
        const fields = line.split(/\s+/); let marker;
        if (fields[0].startsWith('@')) marker = fields.shift();
        if (fields.length < 3 || !matches(fields[0], target)) continue;
        if (marker === '@cert-authority') throw problem('SSH_HOST_CA_UNSUPPORTED', '此地址使用 OpenSSH 主机证书 CA 信任，当前版本尚不支持，请使用原生 SSH 核实。');
        if (marker && marker !== '@revoked') throw problem('SSH_KNOWN_HOSTS_UNSUPPORTED', '此地址包含不支持的 OpenSSH 主机信任标记。');
        if (marker === '@revoked' && same(fields[2], publicKey)) throw problem('SSH_HOST_KEY_REVOKED', '服务器主机公钥已在 OpenSSH 中撤销，连接已拒绝。');
        if (!marker) matching.push({ keyType: fields[1], publicKey: fields[2], fingerprint: fingerprint(Buffer.from(fields[2], 'base64')) });
      }
    }
    const saved = this.records.hosts[target];
    if (saved) matching.push(saved);
    if (matching.some(item => same(item.publicKey, publicKey))) return { ...offered, trusted: true };
    if (matching.length) throw problem('SSH_HOST_KEY_CHANGED', 'SSH 主机公钥与可信记录不同，连接已停止。请先核实服务器身份。', { previousFingerprints: matching.map(item => item.fingerprint), fingerprint: offered.fingerprint, host, port });
    return { ...offered, trusted: false };
  }
  trust(record) {
    const old = this.records.hosts[record.target];
    if (old && !same(old.publicKey, record.publicKey)) throw problem('SSH_HOST_KEY_CHANGED', '此地址已有其他可信主机公钥，不能自动覆盖。');
    this.records.hosts[record.target] = { keyType: record.keyType, publicKey: record.publicKey, fingerprint: record.fingerprint, trustedAt: new Date().toISOString() };
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const temp = this.file + '.' + randomUUID() + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(this.records, null, 2), { mode: 0o600 }); fs.renameSync(temp, this.file);
  }
}
module.exports = { KnownHosts, endpoint, fingerprint, keyType, matches, problem };
