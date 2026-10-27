const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const childProcess = require('node:child_process');

function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-hermes-windows-'));
  t.after(() => fs.rmSync(home, {recursive: true, force: true}));
  const probes = [], failures = new Set();
  t.mock.method(childProcess, 'execFile', (executable, args, options, callback) => {
    probes.push({executable, args, options});
    callback(failures.has(executable) ? Object.assign(Error('controlled timeout'), {code: 'ETIMEDOUT'}) : null, 'Hermes Agent v0.22.5\n', '');
  });
  // Load after the mock: production discovery captures execFile on import.
  delete require.cache[require.resolve('../electron/tool-discovery.cjs')];
  const {scanTools} = require('../electron/tool-discovery.cjs');
  t.after(() => {delete require.cache[require.resolve('../electron/tool-discovery.cjs')];});
  const environment = {LOCALAPPDATA: path.join(home, 'Local App Data')};
  const install = root => {
    const file = path.join(root, 'bin/hermes.exe');
    fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, 'controlled native launcher');
    return fs.realpathSync(file);
  };
  const scan = extra => scanTools({home, environment, platform: 'win32', candidates: {claude: [], codex: [], opencode: [], pi: [], dsh: []}, ...extra});
  return {home, environment, install, scan, probes, failures};
}

test('Windows Hermes is discovered outside a stale PATH with its native launcher and bounded Python startup budget', async t => {
  const f = fixture(t), file = f.install(path.join(f.environment.LOCALAPPDATA, 'hermes'));
  const before = {...f.environment}, items = await f.scan();
  assert.equal(items.length, 1); assert.equal(items[0].executable, file); assert.equal(items[0].healthy, true); assert.equal(items[0].version, '0.22.5');
  assert.deepEqual(f.probes[0].args, ['--version']); assert.equal(f.probes[0].options.timeout, 20000); assert.equal(f.probes[0].options.windowsHide, true);
  assert.deepEqual(f.environment, before);
});

test('Windows Hermes honors HERMES_HOME and the default local app data directory without probing another home', async t => {
  for (const custom of [true, false]) {
    const f = fixture(t); delete f.environment.LOCALAPPDATA;
    if (custom) f.environment.HERMES_HOME = path.join(f.home, 'custom 中文 home');
    const file = f.install(custom ? f.environment.HERMES_HOME : path.join(f.home, 'AppData/Local/hermes'));
    const items = await f.scan(); assert.equal(items[0].executable, file);
  }
});

test('Hermes PATH selection and a failing selected installation cannot silently switch to the fallback', async t => {
  const f = fixture(t), selected = f.install(path.join(f.home, 'selected'));
  f.install(path.join(f.environment.LOCALAPPDATA, 'hermes')); f.environment.Path = path.dirname(selected);
  assert.equal((await f.scan())[0].executable, selected);
  f.failures.add(selected); f.probes.length = 0;
  const items = await f.scan(); assert.equal(items[0].healthy, false); assert.equal(items[0].executable, selected); assert.equal(f.probes.length, 1);
});

test('a pinned Hermes Profile keeps the default installed launcher discoverable', async t => {
  const f = fixture(t), file = f.install(path.join(f.environment.LOCALAPPDATA, 'hermes'));
  f.environment.HERMES_HOME = path.join(f.home, 'profiles/research');
  const items = await f.scan(); assert.equal(items[0].executable, file); assert.equal(items[0].healthy, true);
  assert.equal(f.probes[0].options.env.HERMES_HOME, f.environment.HERMES_HOME);
});

test('Hermes fallback stays adapter/platform specific and explicit empty candidates disable probing', async t => {
  const f = fixture(t), root = path.join(f.environment.LOCALAPPDATA, 'hermes'); f.install(root);
  fs.writeFileSync(path.join(root, 'bin/claude.exe'), 'must not probe');
  assert.deepEqual(await f.scan({candidates: {hermes: [], codex: [], opencode: [], pi: [], dsh: []}}), []);
  assert.deepEqual(await f.scan({platform: 'linux'}), []);
  assert.equal(f.probes.length, 0);
});
