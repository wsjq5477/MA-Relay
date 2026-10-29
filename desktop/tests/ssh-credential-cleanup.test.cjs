const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {CredentialStore} = require('../electron/ssh-credentials.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-credential-cleanup-'));
  t.after(() => fs.promises.rm(root, {recursive:true, force:true, maxRetries:8, retryDelay:100}));
  const directory = path.join(root, '用户 profile');
  const store = new CredentialStore(directory, {
    platform:'win32', protect:async () => 'synthetic-ciphertext',
    ensurePrivate:async target => fs.mkdirSync(target, {recursive:true}),
  });
  t.after(() => store.close());
  const connection = {connectionId:'controlled-connection', authKind:'password'};
  const file = ref => path.join(store.directory, ref + '.json');
  return {store, connection, file};
}

test('replacing and forgetting a saved credential removes its exact ciphertext file in a Unicode profile', async t => {
  const {store, connection, file} = fixture(t);
  await store.provide(connection, {secret:'synthetic-first', save:true});
  const original = connection.credentialRef;
  assert.equal(fs.existsSync(file(original)), true);
  await store.provide(connection, {secret:'synthetic-second', save:true});
  const replacement = connection.credentialRef;
  assert.notEqual(replacement, original);
  assert.equal(fs.existsSync(file(original)), false);
  assert.equal(fs.existsSync(file(replacement)), true);
  await store.provide(connection, {secret:'synthetic-once', save:false});
  assert.equal(connection.credentialRef, undefined);
  assert.equal(fs.existsSync(file(replacement)), false);
  assert.deepEqual(fs.readdirSync(store.directory), []);
  assert.equal(await store.read(connection), 'synthetic-once');
  store.remove(original); store.remove(replacement);
});

test('credential cleanup ignores absent and invalid references and preserves filesystem errors', t => {
  const {store, file} = fixture(t), ref = 'credential-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  fs.mkdirSync(store.directory, {recursive:true});
  const untouched = path.join(store.directory, 'unrelated.json');
  fs.writeFileSync(untouched, 'synthetic-unrelated');
  for (const value of ['../unrelated', 'credential-../unrelated', '', undefined]) store.remove(value);
  store.remove(ref);
  assert.equal(fs.readFileSync(untouched, 'utf8'), 'synthetic-unrelated');
  // A directory at a credential filename is not an absent file and must not be
  // recursively erased or treated as successful cleanup.
  fs.mkdirSync(file(ref));
  assert.throws(() => store.remove(ref), error => ['EISDIR', 'EPERM', 'EACCES'].includes(error.code));
  assert.equal(fs.statSync(file(ref)).isDirectory(), true);
});
