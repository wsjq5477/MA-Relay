const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {MachineHost} = require('../electron/machine-host.cjs');
const {desktopTarget, targetFile} = require('../electron/dsh-desktop-config.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-dsh-desktop-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const home = path.join(root, 'home'), appData = path.join(root, 'roaming');
  const env = {APPDATA: appData}, native = path.join(appData, 'DSH Desktop');
  const write = (file, value) => {fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));};
  const profile = (name, dshHome = path.join(home, '.dsh')) => {
    const dir = path.join(dshHome, 'profiles', name);
    write(path.join(dir, 'package.json'), {name: 'native-profile', dsh: {profile: {bundles: ['@deepseek-ai/dsh-web-app']}}});
    write(path.join(dir, 'cordis.patch.yml'), '# preserve native comment\n[]\n');
    return path.join(dir, 'cordis.patch.yml');
  };
  const select = name => write(path.join(native, 'profile-selection', 'state.json'), {version: 2, active: name});
  const relocate = dshHome => write(path.join(native, 'data-directory', 'state.json'), {version: 1, activeHome: dshHome, previousHome: null, generation: 1, updatedAt: new Date().toISOString()});
  const makeHost = () => new MachineHost({directory: path.join(root, 'bridge'), home, environment: env, legacy: {close() {}}, collaboration: async () => ({items: []})});
  return {root, home, native, env, write, profile, select, relocate, makeHost};
}
const params = {nodeId: 'desktop', adapter: 'dsh-desktop'};
test('DSH Desktop refuses a selection race without leaving a new authorization or overwriting native files', async t => {
  const f = fixture(t), original = f.profile('desktop'), other = f.profile('next');
  const before = fs.readFileSync(original, 'utf8'), otherBytes = fs.readFileSync(other, 'utf8');
  const host = f.makeHost(); t.after(() => host.close());
  const configure = host.mcp.configure.bind(host.mcp);
  host.mcp.configure = async (...args) => {const result = await configure(...args); f.select('next'); return result;};
  await assert.rejects(host.call('mcp.install', params), {code: 'MCP_NATIVE_TARGET_CHANGED'});
  assert.equal(host.mcp.rows.length, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(host.mcp.file, 'utf8')), []);
  assert.equal(fs.readFileSync(original, 'utf8'), before); assert.equal(fs.readFileSync(other, 'utf8'), otherBytes);
});
test('DSH Desktop reads native selection, preserves other profiles and keeps original cleanup across switches', async t => {
  const f = fixture(t), original = f.profile('desktop'), other = f.profile('研发 Profile');
  const before = fs.readFileSync(other, 'utf8');
  let host = f.makeHost(); t.after(() => host.close());
  const installed = await host.call('mcp.install', params);
  assert.equal(installed.configPath, original); assert.equal(installed.profile, 'desktop');
  assert.equal(installed.facts.nativeLoad, 'reload_required');
  assert.equal(fs.readFileSync(other, 'utf8'), before);
  assert.match(fs.readFileSync(original, 'utf8'), /preserve native comment/);
  f.select('研发 Profile');
  const switched = await host.call('mcp.status', params);
  assert.equal(switched.nativeTargetChanged, true); assert.equal(switched.installed, false);
  assert.equal(switched.configPath, original); assert.equal(switched.currentConfigPath, other);
  assert.equal(switched.facts.ownership, 'bridge'); assert.equal(switched.facts.connection, 'unknown');
  assert.equal(switched.evidence.configError.code, 'MCP_NATIVE_TARGET_CHANGED');
  await assert.rejects(host.call('mcp.install', params), {code: 'MCP_NATIVE_TARGET_CHANGED'});
  const bytes = fs.readFileSync(original, 'utf8');
  host.close(); host = f.makeHost(); await host.mcpReady;
  assert.equal(fs.readFileSync(original, 'utf8'), bytes); assert.equal(fs.readFileSync(other, 'utf8'), before);
  const removed = await host.call('mcp.remove', params);
  assert.equal(removed.cleanupError, undefined); assert.equal(removed.facts.authorization, 'revoked');
  assert.equal(removed.facts.config, 'absent'); assert.equal(fs.readFileSync(other, 'utf8'), before);
  const fresh = await host.call('mcp.install', params);
  assert.equal(fresh.configPath, other); assert.equal(fresh.profile, '研发 Profile');
  assert.notEqual(fresh.connectionId, installed.connectionId);
});
test('DSH Desktop uses native custom data root and never falls back after damaged selection', async t => {
  const f = fixture(t), original = f.profile('desktop');
  const customHome = path.join(f.root, 'custom home'), custom = f.profile('selected', customHome);
  f.relocate(customHome); f.select('selected');
  assert.equal(targetFile(desktopTarget(f.home, f.env)), custom);
  const host = f.makeHost(); t.after(() => host.close());
  const installed = await host.call('mcp.install', params); assert.equal(installed.configPath, custom);
  const originalBytes = fs.readFileSync(original, 'utf8');
  f.write(path.join(f.native, 'data-directory', 'state.json'), {version: 999, activeHome: f.home});
  const status = await host.call('mcp.status', params);
  assert.equal(status.nativeTargetChanged, true); assert.equal(status.facts.ownership, 'bridge');
  await assert.rejects(host.call('mcp.install', params), {code: 'MCP_DSH_DESKTOP_TARGET'});
  const removed = await host.call('mcp.remove', params);
  assert.equal(removed.cleanupError, undefined); assert.equal(removed.facts.authorization, 'revoked');
  assert.equal(fs.readFileSync(original, 'utf8'), originalBytes);
});
test('DSH Desktop unavailable/invalid targets fail without inventing profiles and still allow export/revoke', async t => {
  const f = fixture(t), host = f.makeHost(); t.after(() => host.close());
  const status = await host.call('mcp.status', params);
  assert.equal(status.facts.config, 'unknown'); assert.equal(status.installed, false);
  await assert.rejects(host.call('mcp.install', params), {code: 'MCP_DSH_DESKTOP_TARGET'});
  assert.equal(host.mcp.rows.length, 0);
  const exported = await host.call('mcp.export', params); assert.equal(exported.exported, true);
  const removed = await host.call('mcp.remove', params); assert.equal(removed.facts.authorization, 'revoked');
  assert.equal(fs.existsSync(path.join(f.home, '.dsh', 'profiles')), false);
  f.profile('desktop');
  for (const name of ['../escape', 'a/b', 'node_modules', 'NUL', 'dot.', 'trailing ', '']) {
    f.select(name);
    assert.throws(() => desktopTarget(f.home, f.env), {code: 'MCP_DSH_DESKTOP_TARGET'});
  }
  f.select('desktop');
  const selection = path.join(f.native, 'profile-selection', 'state.json');
  fs.unlinkSync(selection); const destination = path.join(f.root, 'selection.json');
  f.write(destination, {version: 2, active: 'desktop'}); fs.symlinkSync(destination, selection);
  assert.throws(() => desktopTarget(f.home, f.env), {code: 'MCP_DSH_DESKTOP_TARGET'});
});
test('DSH Desktop revokes but refuses cleanup through a replaced native profile directory', async t => {
  const f = fixture(t), original = f.profile('desktop');
  const host = f.makeHost(); t.after(() => host.close());
  await host.call('mcp.install', params);
  const dir = path.dirname(original), moved = dir + '-preserved';
  fs.renameSync(dir, moved); fs.symlinkSync(moved, dir, 'dir');
  const bytes = fs.readFileSync(path.join(moved, 'cordis.patch.yml'), 'utf8');
  const removed = await host.call('mcp.remove', params);
  assert.equal(removed.facts.authorization, 'revoked');
  assert.equal(removed.state, 'revoked_config_pending');
  assert.equal(removed.cleanupError.code, 'MCP_DSH_DESKTOP_TARGET');
  assert.equal(fs.readFileSync(path.join(moved, 'cordis.patch.yml'), 'utf8'), bytes);
});
