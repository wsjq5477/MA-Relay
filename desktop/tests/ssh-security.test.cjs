const {linuxTest} = require('./platform-test.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHmac, randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const { KnownHosts, fingerprint, endpoint } = require('../electron/ssh-known-hosts.cjs');
const { CredentialStore, dpapiScript } = require('../electron/ssh-credentials.cjs');
const { validateDraft } = require('../electron/ssh-host.cjs');
const { quote, localManifest, sufficientNode, privateDirectory, verifyScript } = require('../electron/ssh-install.cjs');
function temp(t) { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-ssh-security-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true })); return directory; }
function publicKey(seed = 'first') { const type = Buffer.from('ssh-ed25519'), header = Buffer.alloc(4); header.writeUInt32BE(type.length); return Buffer.concat([header, type, Buffer.from(seed)]); }
test('a large-manifest checksum failure emits a bounded diagnostic instead of echoing the script', t => {
  const directory = temp(t), manifest = {files: Array.from({length: 1702}, (_, i) => ({path: 'controlled-' + i, size: 1, sha256: 'a'.repeat(64)}))};
  const result = require('node:child_process').spawnSync(process.execPath, ['-'], {input: verifyScript(directory, manifest), encoding: 'utf8', maxBuffer: 1024 * 1024});
  assert.ifError(result.error); assert.notEqual(result.status, 0); assert.equal(result.stdout, '');
  assert(result.stderr.length <= 1024, 'Checksum diagnostics must stay below the RPC stderr bound');
  assert.equal(result.stderr.trim(), 'CHECKSUM');
});
test('host trust persists only a specifically accepted key and refuses changes', t => {
  const directory = temp(t), store = new KnownHosts(directory, { openSshFiles: [] }), key = publicKey();
  const record = store.check('SERVER.example', 2222, key); assert.equal(record.trusted, false); assert.equal(record.fingerprint, fingerprint(key)); assert.equal(record.target, '[server.example]:2222');
  assert.equal(fs.existsSync(store.file), false); store.trust(record);
  assert.equal(new KnownHosts(directory, { openSshFiles: [] }).check('server.example', 2222, key).trusted, true);
  assert.throws(() => store.check('server.example', 2222, publicKey('changed')), { code: 'SSH_HOST_KEY_CHANGED' });
  assert.equal(store.check('server.example', 22, key).trusted, false);
});
test('OpenSSH known_hosts supports hashed names, wildcard exclusions, and revoked keys take precedence', t => {
  const directory = temp(t), file = path.join(directory, 'known_hosts'), key = publicKey(), salt = randomBytes(20), target = endpoint('host.example', 2200);
  const hashed = '|1|' + salt.toString('base64') + '|' + createHmac('sha1', salt).update(target).digest('base64');
  fs.writeFileSync(file, hashed + ' ssh-ed25519 ' + key.toString('base64') + '\n');
  const store = new KnownHosts(directory, { openSshFiles: [file] }); assert.equal(store.check('host.example', 2200, key).trusted, true);
  fs.appendFileSync(file, '@revoked ' + target + ' ssh-ed25519 ' + key.toString('base64') + '\n');
  assert.throws(() => store.check('host.example', 2200, key), { code: 'SSH_HOST_KEY_REVOKED' });
  fs.writeFileSync(file, '*.example,!other.example ssh-ed25519 ' + key.toString('base64') + '\n');
  assert.equal(store.check('good.example', 22, key).trusted, true); assert.equal(store.check('other.example', 22, key).trusted, false);
});
test('relevant CA records and changed global keys cannot become an automatic first trust', t => {
  const directory = temp(t), file = path.join(directory, 'known_hosts'), key = publicKey();
  fs.writeFileSync(file, '@cert-authority *.example ssh-ed25519 ' + key.toString('base64'));
  const store = new KnownHosts(directory, { openSshFiles: [file] }); assert.throws(() => store.check('host.example', 22, key), { code: 'SSH_HOST_CA_UNSUPPORTED' });
  fs.writeFileSync(file, 'host.example ssh-ed25519 ' + key.toString('base64')); assert.throws(() => store.check('host.example', 22, publicKey('changed')), { code: 'SSH_HOST_KEY_CHANGED' });
});
test('unsaved credentials are memory-only, expire, and are zeroed after consumption', async t => {
  const directory = temp(t), store = new CredentialStore(directory, { ttlMs: 30 }), connection = { connectionId: 'draft', authKind: 'password' }; t.after(() => store.close());
  await store.provide(connection, { secret: 'synthetic-test-password', save: false }); const buffer = store.memory.get('draft');
  assert.equal(await store.read(connection), 'synthetic-test-password'); assert.equal(fs.existsSync(path.join(directory, 'ssh-credentials')), false);
  store.discard('draft'); assert(buffer.every(byte => byte === 0)); assert.equal(await store.read(connection), undefined);
  await store.provide(connection, { secret: 'temporary', save: false }); await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(await store.read(connection), undefined);
});
test('saved credentials use only encrypted system-store output and configs contain only a reference', async t => {
  const directory = temp(t), key = randomBytes(32);
  const protect = async text => { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv), data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64'); };
  const unprotect = async text => { const data = Buffer.from(text, 'base64'), decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12)); decipher.setAuthTag(data.subarray(12, 28)); return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'); };
  const store = new CredentialStore(directory, { platform: 'win32', protect, unprotect, ensurePrivate: async target => fs.mkdirSync(target, { recursive: true }) }), connection = { connectionId: 'saved', authKind: 'password' }; t.after(() => store.close());
  await store.provide(connection, { secret: 'unique-synthetic-test-password', save: true }); store.discard(connection.connectionId);
  const stored = fs.readFileSync(path.join(store.directory, connection.credentialRef + '.json'), 'utf8'); assert(!stored.includes('unique-synthetic-test-password')); assert(!JSON.stringify(connection).includes('unique-synthetic-test-password')); assert.equal(await store.read(connection), 'unique-synthetic-test-password');
  await store.provide(connection, { secret: 'once', save: false }); assert.equal(connection.credentialRef, undefined); assert.deepEqual(fs.readdirSync(store.directory), []);
});
test('system protection failure has no plaintext fallback and DPAPI uses current user', async t => {
  const directory = temp(t), store = new CredentialStore(directory, { platform: 'win32', protect: async () => { throw new Error('failed'); } }), connection = { connectionId: 'bad', authKind: 'password' };
  await assert.rejects(store.provide(connection, { secret: 'do-not-store', save: true }), { code: 'CREDENTIAL_STORE_UNAVAILABLE' }); assert.equal(await store.read(connection), undefined); assert.equal(fs.existsSync(store.directory), false);
  assert(dpapiScript.includes('DataProtectionScope]::CurrentUser')); assert(dpapiScript.includes('[Console]::In.ReadToEnd()'));
});
test('SSH endpoint validation rejects shell-looking addresses while usernames stay structured data', () => {
  assert.throws(() => validateDraft({ host: 'example; touch /tmp/bad', username: 'u', authKind: 'password' }), { code: 'INVALID_INPUT' });
  assert.throws(() => validateDraft({ host: 'example', username: 'u', port: 65536, authKind: 'password' }), { code: 'INVALID_INPUT' });
  assert.equal(validateDraft({ host: '[::1]', username: 'u', authKind: 'password' }).host, '::1');
  assert.equal(validateDraft({ host: 'host.example', username: 'u;$(touch nope)', authKind: 'password' }).username, 'u;$(touch nope)');
  assert.equal(quote("/home/some one's/node"), "'/home/some one'\\''s/node'"); assert.throws(() => quote('/tmp/x\nsh'), { code: 'INVALID_INPUT' });
});
test('release manifest path traversal and checksum changes stop before upload', t => {
  const directory = temp(t), file = path.join(directory, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify({ version: '0.6.0-alpha.1', protocolVersion: 2, platform: 'linux', arch: 'x64', files: [{ path: '../outside', sha256: 'a'.repeat(64), size: 1 }], runtime: { path: 'runtime/node', version: '22.23.1' } }));
  assert.throws(() => localManifest(directory), { code: 'SSH_PACKAGE_INVALID' });
  assert(sufficientNode('22.13.0')); assert(!sufficientNode('22.12.9')); assert(sufficientNode('24.1.0'));
});
test('SFTP directory checks reject symlink parents and foreign UID before mutation', async () => {
  const attributes = type => ({ uid: 1000, isDirectory: () => type === 'directory', isSymbolicLink: () => type === 'symlink' });
  const calls = [], sftp = { lstat(target, callback) { callback(null, attributes(target === '/home/u' ? 'directory' : 'symlink')); }, chmod() { calls.push('chmod'); }, mkdir() { calls.push('mkdir'); } };
  await assert.rejects(privateDirectory(sftp, '/home/u/.local/share', '/home/u', 1000), { code: 'REMOTE_DIRECTORY_UNSAFE' }); assert.deepEqual(calls, []);
  await assert.rejects(privateDirectory(sftp, '/other/private', '/home/u', 1000), { code: 'REMOTE_DIRECTORY_UNSAFE' });
});

linuxTest('Linux maintenance helper keeps executable mode through the actual compressed installation archive', async t => {
  const {packArchive}=require('../electron/ssh-install.cjs'),{stageLinuxPackage}=require('../scripts/stage-linux-package.cjs'),{execFileSync}=require('node:child_process');
  const directory=temp(t),repo=path.join(directory,'repo'),runtime=path.join(directory,'runtime'),destination=path.join(directory,'linux');
  for(const p of [path.join(runtime,'node_modules'),path.join(runtime,'desktop/electron'),path.join(repo,'dist')])fs.mkdirSync(p,{recursive:true});
  fs.writeFileSync(path.join(repo,'package.json'),JSON.stringify({name:'archive-mode-test',version:'0.1.0'}));
  stageLinuxPackage({repo,runtime,destination,nodeExecutable:process.execPath,version:'0.6.0-mode-test'});
  const manifest=JSON.parse(fs.readFileSync(path.join(destination,'manifest.json')));
  assert.equal(manifest.files.find(f=>f.path==='runtime/owned-stop').mode,0o700);
  const packed=await packArchive(manifest,destination),extracted=path.join(directory,'extracted');fs.mkdirSync(extracted);
  execFileSync('tar',['-xzf',packed.archive,'-C',extracted]);const helper=path.join(extracted,'runtime/owned-stop');
  assert.equal(fs.statSync(helper).mode&0o777,0o700);
  assert.throws(()=>execFileSync(helper,[],{stdio:'ignore'}),error=>error.status===2&&!error.code);
});
