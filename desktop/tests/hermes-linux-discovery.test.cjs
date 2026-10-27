const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const childProcess = require('node:child_process');

function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-hermes-linux-'));
  t.after(() => fs.rmSync(home, {recursive: true, force: true}));
  const calls = [], failures = new Set();
  t.mock.method(childProcess, 'execFile', (executable, args, options, callback) => {
    calls.push({executable, args, options});
    callback(failures.has(executable) ? Object.assign(Error('controlled version failure'), {code: 'ETIMEDOUT'}) : null, 'Hermes Agent v0.22.5\n', '');
  });
  delete require.cache[require.resolve('../electron/tool-discovery.cjs')];
  const {scanTools} = require('../electron/tool-discovery.cjs');
  t.after(() => {delete require.cache[require.resolve('../electron/tool-discovery.cjs')];});
  const environment = {HOME: home, PATH: ''};
  const install = (folder, name = 'hermes') => {
    fs.mkdirSync(folder, {recursive: true}); const file = path.join(folder, name);
    fs.writeFileSync(file, '# controlled installed launcher\n', {mode: 0o755});
    return fs.realpathSync(file);
  };
  const scan = extra => scanTools({home, environment, platform: 'linux', candidates: {claude: [], codex: [], opencode: [], pi: [], dsh: []}, ...extra});
  return {home, environment, install, scan, calls, failures};
}

test('Linux Hermes discovers published and legacy install layouts with a noninteractive PATH', async t => {
  for (const suffix of ['.local/bin', '.hermes/bin', '.hermes/hermes-agent/.hermes/bin', '.hermes/hermes-agent/venv/bin', '.hermes/venv/bin']) {
    const f = fixture(t), executable = f.install(path.join(f.home, suffix)), before = {...f.environment};
    fs.writeFileSync(path.join(f.home, '.bashrc'), 'exit 97\n');
    fs.writeFileSync(path.join(f.home, '.profile'), 'exit 98\n');
    const rows = await f.scan(); assert.equal(rows.length, 1, suffix); assert.equal(rows[0].executable, executable);
    assert.equal(rows[0].healthy, true); assert.equal(rows[0].version, '0.22.5');
    assert.deepEqual(f.calls[0].args, ['--version']); assert.equal(f.calls[0].options.timeout, 20000);
    assert.deepEqual(f.environment, before);
  }
});

test('Linux Hermes honors an independent source root before convenience fallbacks but keeps PATH authoritative', async t => {
  const f = fixture(t), source = path.join(f.home, 'source 中文 with spaces');
  f.environment.HERMES_INSTALL_DIR = source;
  const selected = f.install(path.join(source, '.hermes/bin'));
  f.install(path.join(f.home, '.local/bin'));
  assert.equal((await f.scan())[0].executable, selected);
  const preferred = f.install(path.join(f.home, 'selected PATH'));
  f.environment.PATH = path.dirname(preferred);
  assert.equal((await f.scan())[0].executable, preferred);
  f.failures.add(preferred); f.calls.length = 0;
  const rows = await f.scan(); assert.equal(rows[0].healthy, false); assert.equal(rows[0].executable, preferred); assert.equal(f.calls.length, 1);
});

test('Linux Hermes expands custom data and source roots without executing shell substitutions', async t => {
  for (const variable of ['HERMES_HOME', 'HERMES_INSTALL_DIR']) {
    for (const value of ['~/managed 中文', '${ROOT}/managed 中文', '$ROOT/managed 中文']) {
      const f = fixture(t); f.environment.ROOT = f.home; f.environment[variable] = value;
      const root = path.join(f.home, 'managed 中文');
      const executable = f.install(variable === 'HERMES_HOME' ? path.join(root, 'bin') : path.join(root, '.hermes/bin'));
      assert.equal((await f.scan())[0].executable, executable, variable + ' ' + value);
      assert.equal(f.calls[0].options.env[variable], value, 'The original native environment is preserved');
    }
  }
});

test('Linux Hermes pinned Profiles retain their owning and default installed launchers', async t => {
  for (const defaultInstall of [true, false]) {
    const f = fixture(t), owner = path.join(f.home, 'custom owner');
    f.environment.HERMES_HOME = path.join(owner, 'profiles/research');
    const executable = f.install(defaultInstall ? path.join(f.home, '.hermes/hermes-agent/.hermes/bin') : path.join(owner, 'hermes-agent/.hermes/bin'));
    const rows = await f.scan(); assert.equal(rows[0].executable, executable);
    assert.equal(f.calls[0].options.env.HERMES_HOME, f.environment.HERMES_HOME);
    assert.equal(fs.existsSync(f.environment.HERMES_HOME), false, 'Discovery never creates a native Profile');
  }
});

test('Linux Hermes honors native data-directory suffixes and legacy custom-home venvs', async t => {
  for (const custom of [true, false]) {
    const f = fixture(t); f.environment.HERMES_DATA_DIR_SUFFIX = '-work';
    if (custom) f.environment.HERMES_HOME = path.join(f.home, 'custom home');
    const root = custom ? f.environment.HERMES_HOME : path.join(f.home, '.hermes-work');
    const executable = f.install(path.join(root, custom ? 'venv/bin' : 'hermes-agent/.hermes/bin'));
    assert.equal((await f.scan())[0].executable, executable);
  }
});

test('Linux Hermes directories cannot supply another adapter and explicit empty candidates disable Hermes discovery', async t => {
  const f = fixture(t), folder = path.join(f.home, '.hermes/hermes-agent/.hermes/bin');
  f.install(folder); f.install(folder, 'codex'); f.install(folder, 'pi'); f.install(folder, 'claude');
  assert.deepEqual(await f.scan({candidates: {hermes: [], opencode: [], dsh: []}}), []);
  assert.equal(f.calls.length, 0);
});

test('Linux Hermes ignores relative or unresolved installer roots instead of resolving against the daemon cwd', async t => {
  for (const value of ['relative-source', '${MISSING}/hermes']) {
    const f = fixture(t); f.environment.HERMES_INSTALL_DIR = value;
    assert.deepEqual(await f.scan(), []); assert.equal(f.calls.length, 0);
  }
});

test('Linux-specific Hermes installation roots are never probed as Windows launchers', async t => {
  const f = fixture(t); f.environment.HERMES_INSTALL_DIR = path.join(f.home, 'linux source');
  f.install(path.join(f.environment.HERMES_INSTALL_DIR, '.hermes/bin'), 'hermes.exe');
  assert.deepEqual(await f.scan({platform: 'win32'}), []); assert.equal(f.calls.length, 0);
});
