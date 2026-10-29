// Configuration-only filesystem regression; all profiles and credentials are synthetic.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {McpConfig, nativeEntry} = require('../electron/mcp-config.cjs');

const variants = [
  ['claude'], ['codex'], ['opencode', 'v1'], ['opencode', 'v2'],
  ['pi'], ['hermes'], ['dsh'], ['dsh-web'], ['dsh-desktop'], ['opendesk-desktop'],
];
const connection = {
  command: '/synthetic/node', args: ['/synthetic/client.cjs', '/synthetic/endpoint.json'],
  env: {BRIDGE_TEST_VALUE: 'synthetic-private-value'},
};

function fixture(t, adapter, protocol) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-mcp-cleanup-'));
  t.after(() => fs.promises.rm(root, {recursive:true, force:true, maxRetries:8, retryDelay:100}));
  const home = path.join(root, '用户 profile'), env = {APPDATA:path.join(home, 'roaming')};
  const write = (file, value) => {
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, value);
  };
  if (adapter === 'dsh-desktop') {
    write(path.join(home, '.dsh/profiles/desktop/package.json'),
      JSON.stringify({name:'native-profile', dsh:{profile:{bundles:['@deepseek-ai/dsh-web-app']}}}));
  }
  const target = new McpConfig(adapter, home, env, protocol, adapter === 'dsh' ? 'selected' : undefined);
  const before = adapter === 'codex' ? '# keep native\nmodel = "native/model"\n'
    : adapter === 'hermes' ? '# keep native\nmodel:\n  default: native/model\n'
      : adapter.startsWith('dsh') ? '# keep native\n[]\n'
        : '{"unrelated":{"value":"keep-native"}}\n';
  write(target.file, before);
  const sibling = path.join(path.dirname(target.file), 'unrelated.tmp');
  write(sibling, 'keep-unrelated-temporary-file');
  const entry = nativeEntry(adapter, connection, protocol);
  const temporaryFiles = () => fs.readdirSync(path.dirname(target.file))
    .filter(name => name.startsWith(path.basename(target.file) + '.') && name.endsWith('.tmp'));
  return {target, entry, before, sibling, temporaryFiles, home, env};
}

for (const adapter of ['pi', 'hermes', 'dsh-desktop']) {
  test(`${adapter} removes its staged file when the native target switches before replacement`, t => {
    const f = fixture(t, adapter, 'v2'), original = fs.writeFileSync;
    const other = path.join(f.home, 'another-native-target');
    const otherFile = adapter === 'pi' ? path.join(other, 'mcp.json')
      : adapter === 'hermes' ? path.join(other, 'config.yaml')
        : path.join(f.home, '.dsh/profiles/other/cordis.patch.yml');
    fs.mkdirSync(path.dirname(otherFile), {recursive:true});
    original(otherFile, f.before);
    if (adapter === 'dsh-desktop') original(path.join(path.dirname(otherFile), 'package.json'),
      JSON.stringify({name:'native-profile', dsh:{profile:{bundles:['@deepseek-ai/dsh-web-app']}}}));
    let staged = false;
    t.mock.method(fs, 'writeFileSync', function(file, ...args) {
      const result = original.call(this, file, ...args);
      if (String(file).startsWith(f.target.file + '.') && String(file).endsWith('.tmp')) {
        staged = true;
        if (adapter === 'pi') f.env.PI_CODING_AGENT_DIR = other;
        else if (adapter === 'hermes') f.env.HERMES_HOME = other;
        else {
          const selection = path.join(f.env.APPDATA, 'DSH Desktop/profile-selection/state.json');
          fs.mkdirSync(path.dirname(selection), {recursive:true});
          original(selection, JSON.stringify({version:2, active:'other'}));
        }
      }
      return result;
    });
    assert.throws(() => f.target.update(f.entry), {code:'MCP_NATIVE_TARGET_CHANGED'});
    assert.equal(staged, true);
    assert.equal(fs.readFileSync(f.target.file, 'utf8'), f.before);
    assert.equal(fs.readFileSync(otherFile, 'utf8'), f.before);
    assert.deepEqual(f.temporaryFiles(), []);
  });
}

test('MCP staged-file cleanup reports a filesystem denial instead of treating it as absence', t => {
  const f = fixture(t, 'claude', 'v2');
  const original = fs.renameSync, unlink = fs.unlinkSync;
  const denied = Object.assign(new Error('controlled cleanup rejection'), {code:'EACCES'});
  t.mock.method(fs, 'renameSync', function(source, destination) {
    if (destination === f.target.file) throw Object.assign(new Error('controlled replacement rejection'), {code:'EBUSY'});
    return original.call(this, source, destination);
  });
  t.mock.method(fs, 'unlinkSync', function(file) {
    if (String(file).startsWith(f.target.file + '.')) throw denied;
    return unlink.call(this, file);
  });
  assert.throws(() => f.target.update(f.entry), error => error === denied);
  assert.equal(fs.readFileSync(f.target.file, 'utf8'), f.before);
  assert.equal(f.temporaryFiles().length, 1);
});

for (const [adapter, protocol = 'v2'] of variants) {
  for (const action of ['install', 'remove']) {
    const name = `${adapter}/${protocol} ${action}`;
    test(`${name} removes its Unicode temporary file after a concurrent config change`, t => {
      const f = fixture(t, adapter, protocol);
      if (action === 'remove') f.target.update(f.entry);
      const original = fs.writeFileSync, external = f.before + '\n';
      let staged = false;
      t.mock.method(fs, 'writeFileSync', function(file, ...args) {
        const result = original.call(this, file, ...args);
        if (String(file).startsWith(f.target.file + '.') && String(file).endsWith('.tmp')) {
          staged = true;
          original(f.target.file, external);
        }
        return result;
      });
      assert.throws(() => action === 'install' ? f.target.update(f.entry)
        : f.target.update(undefined, f.entry), {code:'MCP_CONFIG_CONFLICT'});
      assert.equal(staged, true);
      assert.equal(fs.readFileSync(f.target.file, 'utf8'), external);
      assert.deepEqual(f.temporaryFiles(), []);
      assert.equal(fs.readFileSync(f.sibling, 'utf8'), 'keep-unrelated-temporary-file');
    });

    test(`${name} removes its Unicode temporary file when atomic replacement fails`, t => {
      const f = fixture(t, adapter, protocol);
      if (action === 'remove') f.target.update(f.entry);
      const before = fs.readFileSync(f.target.file, 'utf8'), original = fs.renameSync;
      const failure = Object.assign(new Error('controlled replacement rejection'), {code:'EACCES'});
      let attempted = false;
      t.mock.method(fs, 'renameSync', function(source, destination) {
        if (destination === f.target.file) {attempted = true; throw failure;}
        return original.call(this, source, destination);
      });
      assert.throws(() => action === 'install' ? f.target.update(f.entry)
        : f.target.update(undefined, f.entry), error => error === failure);
      assert.equal(attempted, true);
      assert.equal(fs.readFileSync(f.target.file, 'utf8'), before);
      assert.deepEqual(f.temporaryFiles(), []);
      assert.equal(fs.readFileSync(f.sibling, 'utf8'), 'keep-unrelated-temporary-file');
    });
  }
}
