// Configuration-only tests: no native process, broker socket or model request.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const YAML = require('yaml');
const {McpIntegration} = require('../electron/mcp-integration.cjs');
const native = require('../electron/hermes-mcp-config.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-hermes-config-')), home = path.join(root, 'user'), env = {};
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const nativeRoot = process.platform === 'win32' ? path.join(home, 'AppData/Local/hermes') : path.join(home, '.hermes'), file = path.join(nativeRoot, 'config.yaml');
  const write = (file, value) => {fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, value);};
  const profile = (name, at = nativeRoot) => {const file = path.join(at, 'profiles', name, 'config.yaml'); write(file, '# profile comment\nmodel: unchanged\n'); return file;};
  const select = (name, at = nativeRoot) => write(path.join(at, 'active_profile'), name);
  const create = () => new McpIntegration({directory: path.join(root, 'bridge'), home, environment: env}, {async configure() {return {command: '/fixture/node', args: ['/fixture/mcp-client', '/fixture/endpoint'], env: {ELECTRON_RUN_AS_NODE: '1'}};}});
  return {root, home, env, nativeRoot, file, write, profile, select, create};
}
const params = {nodeId: 'original-hermes', adapter: 'hermes'};
test('Hermes native YAML preserves model settings, comments, other MCP entries and unrelated anchors', async t => {
  const f = fixture(t), integration = f.create();
  f.write(f.file, '# user comment\nmodel:\n  default: native-model\nterminal: &terminal\n  timeout: 80\nother: *terminal\nmcp_servers:\n  external:\n    command: /other/mcp\n    args: []\n');
  const before = YAML.parse(fs.readFileSync(f.file, 'utf8'));
  const installed = await integration.call('mcp.install', params);
  assert.equal(installed.configPath, f.file); assert.equal(installed.facts.config, 'present'); assert.equal(installed.facts.connection, 'unknown');
  assert.deepEqual(YAML.parse(fs.readFileSync(installed.files.hermes, 'utf8')), {mcp_servers: {agentbridge: installed.configuration}});
  const current = fs.readFileSync(f.file, 'utf8'); assert.match(current, /# user comment/); assert.match(current, /&terminal/); assert.match(current, /\*terminal/);
  const json = YAML.parse(current); assert.deepEqual(json.model, before.model); assert.deepEqual(json.mcp_servers.external, before.mcp_servers.external);
  assert.equal((await integration.call('mcp.install', params)).connectionId, installed.connectionId);
  await integration.call('mcp.remove', params); assert.deepEqual(YAML.parse(fs.readFileSync(f.file, 'utf8')), before);
});
test('Hermes follows sticky native selection and only cleans original binding after selection changes', async t => {
  const f = fixture(t), first = f.profile('research'), second = f.profile('review'); f.select('Research');
  let integration = f.create(); const installed = await integration.call('mcp.install', params); assert.equal(installed.configPath, first); assert.equal(installed.profile, 'research');
  const secondBytes = fs.readFileSync(second, 'utf8'); f.select('review');
  const status = await integration.call('mcp.status', params); assert.equal(status.nativeTargetChanged, true); assert.equal(status.currentConfigPath, second); assert.equal(status.configPath, first);
  await assert.rejects(integration.call('mcp.install', params), {code: 'MCP_NATIVE_TARGET_CHANGED'});
  integration = f.create(); await integration.restore(); assert.equal(fs.readFileSync(second, 'utf8'), secondBytes);
  const removed = await integration.call('mcp.remove', params); assert.equal(removed.cleanupError, undefined); assert.equal(fs.readFileSync(second, 'utf8'), secondBytes);
  const fresh = await integration.call('mcp.install', params); assert.equal(fresh.configPath, second); assert.notEqual(fresh.connectionId, installed.connectionId);
});
test('Hermes explicit profile home ignores a different sticky selection, custom roots read their own selection', t => {
  const f = fixture(t); f.profile('pinned'); f.profile('other'); f.select('other');
  f.env.HERMES_HOME = path.join(f.nativeRoot, 'profiles', 'pinned');
  assert.equal(native.currentTarget(f.home, f.env).home, f.env.HERMES_HOME);
  const custom = path.join(f.root, 'custom root'); f.env.HERMES_HOME = custom; const config = f.profile('custom', custom); f.select('custom', custom);
  const selected = native.currentTarget(f.home, f.env); assert.equal(selected.named, true); assert.equal(native.targetFile(selected), config);
});
test('Hermes rejects missing, tombstoned, malformed or linked native selection rather than writing a fallback profile', async t => {
  for (const kind of ['missing', 'deleted', 'invalid', 'linked']) {
    const f = fixture(t), integration = f.create(); f.select(kind === 'invalid' ? '../escape' : 'selected');
    if (kind !== 'missing') f.profile('selected');
    if (kind === 'deleted') f.write(path.join(f.nativeRoot, 'profiles/.deleted/selected'), 'deleted');
    if (kind === 'linked') {const active = path.join(f.nativeRoot, 'active_profile'); fs.renameSync(active, active + '.original'); fs.symlinkSync(active + '.original', active);}
    await assert.rejects(integration.call('mcp.install', params), {code: 'MCP_HERMES_TARGET'});
    assert.equal(integration.rows.length, 0); assert.equal(fs.existsSync(f.file), false);
  }
});
test('Hermes named custom profile must not be mistaken for a new custom root', async t => {
  const f = fixture(t), integration = f.create(); f.select('custom');
  await assert.rejects(integration.call('mcp.install', params), {code: 'MCP_HERMES_TARGET'});
  assert.equal(fs.existsSync(path.join(f.nativeRoot, 'profiles/custom')), false);
});
test('Hermes Windows layout, suffix, variable and tilde expansion follow the target environment', t => {
  const f = fixture(t), local = path.join(f.root, 'Local');
  assert.equal(native.currentTarget(f.home, {LOCALAPPDATA: local}, 'win32').home, path.join(local, 'hermes'));
  assert.equal(native.currentTarget(f.home, {HERMES_DATA_DIR_SUFFIX: '-test'}, 'linux').home, path.join(f.home, '.hermes-test'));
  assert.equal(native.currentTarget(f.home, {HERMES_HOME: '~/root'}).home, path.join(f.home, 'root'));
  assert.equal(native.currentTarget(f.home, {HERMES_HOME: '${ROOT}/hermes', ROOT: f.root}).home, path.join(f.root, 'hermes'));
  assert.equal(native.currentTarget(f.home, {HERMES_HOME: '%root%/hermes', ROOT: f.root}, 'win32').home, path.join(f.root, 'hermes'));
  assert.throws(() => native.currentTarget(f.home, {HERMES_HOME: '${MISSING}/hermes'}), {code: 'MCP_HERMES_TARGET'});
  assert.throws(() => native.currentTarget(f.home, {HERMES_HOME: 'relative'}), {code: 'MCP_HERMES_TARGET'});
});
test('Hermes original cleanup works after a damaged selection, but never follows a redirected directory', async t => {
  const f = fixture(t), first = f.profile('first'); f.select('first'); const integration = f.create(); await integration.call('mcp.install', params);
  f.select('../invalid'); const status = await integration.call('mcp.status', params); assert.equal(status.nativeTargetChanged, true); assert.equal(status.facts.ownership, 'bridge');
  assert.equal((await integration.call('mcp.remove', params)).cleanupError, undefined);
  f.select('first'); await integration.call('mcp.install', params);
  const dir = path.dirname(first), moved = dir + '-saved'; fs.renameSync(dir, moved); fs.symlinkSync(moved, dir, process.platform === 'win32' ? 'junction' : 'dir');
  const bytes = fs.readFileSync(path.join(moved, 'config.yaml'), 'utf8');
  const removed = await integration.call('mcp.remove', params); assert.equal(removed.facts.authorization, 'revoked'); assert.equal(removed.state, 'revoked_config_pending');
  assert.equal(fs.readFileSync(path.join(moved, 'config.yaml'), 'utf8'), bytes);
});
test('Hermes native disable variants remain owned and cannot be re-enabled by Bridge', async t => {
  for (const flag of [false, 0, 'false', 'off', 'no', '0']) {
    const f = fixture(t), integration = f.create(); await integration.call('mcp.install', params);
    const data = YAML.parse(fs.readFileSync(f.file, 'utf8')); data.mcp_servers.agentbridge.enabled = flag; f.write(f.file, YAML.stringify(data));
    const before = fs.readFileSync(f.file, 'utf8'), status = await integration.call('mcp.status', params);
    assert.equal(status.facts.config, 'disabled'); assert.equal(status.facts.ownership, 'bridge'); assert.equal(status.installed, false);
    await assert.rejects(integration.call('mcp.install', params), {code: 'MCP_NATIVE_DISABLED'});
    await integration.call('mcp.export', params); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    assert.equal((await integration.call('mcp.remove', params)).cleanupError, undefined);
  }
});
test('Hermes foreign settings remain conflicts and revoke before native cleanup failure', async t => {
  const f = fixture(t), integration = f.create(), installed = await integration.call('mcp.install', params);
  const data = YAML.parse(fs.readFileSync(f.file, 'utf8')); data.mcp_servers.agentbridge.tools = {include: []}; f.write(f.file, YAML.stringify(data));
  const before = fs.readFileSync(f.file, 'utf8'); await assert.rejects(integration.call('mcp.install', params), {code: 'MCP_CONFIG_CONFLICT'});
  const removed = await integration.call('mcp.remove', params); assert.equal(removed.state, 'revoked_config_pending'); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
  assert.throws(() => integration.authorize({externalConnectionId: installed.connectionId, nodeId: params.nodeId}), {code: 'MCP_REVOKED'});
});
test('Hermes profile preparation races roll back newly registered authorization and write no native file', async t => {
  const f = fixture(t), integration = f.create(), other = f.profile('other'), before = fs.readFileSync(other, 'utf8');
  const configure = integration.configure.bind(integration); integration.configure = async (...args) => {const result = await configure(...args); f.select('other'); return result;};
  await assert.rejects(integration.call('mcp.install', params), {code: 'MCP_NATIVE_TARGET_CHANGED'});
  assert.equal(integration.rows.length, 0); assert.equal(fs.existsSync(f.file), false); assert.equal(fs.readFileSync(other, 'utf8'), before);
});
test('Hermes native deletion stays deleted after restore; independent export never installs', async t => {
  const f = fixture(t); let integration = f.create();
  const exported = await integration.call('mcp.export', params); assert.equal(exported.facts.config, 'absent'); assert.equal(fs.existsSync(f.file), false);
  await integration.call('mcp.install', params); fs.unlinkSync(f.file);
  integration = f.create(); await integration.restore(); assert.equal(fs.existsSync(f.file), false); assert.equal((await integration.call('mcp.status', params)).facts.config, 'absent');
});
test('Hermes invalid YAML, duplicates, aliases in owned entries and root/MCP merges are preserved', async t => {
  for (const content of ['[]', 'mcp_servers: []', 'mcp_servers: {}\nmcp_servers: {}', 'mcp_servers:\n  agentbridge: *missing', 'base: &base {}\n<<: *base', 'mcp_servers:\n  <<: {}', 'mcp_servers:\n  agentbridge: null']) {
    const f = fixture(t), integration = f.create(); f.write(f.file, content);
    await assert.rejects(integration.call('mcp.install', params)); assert.equal(fs.readFileSync(f.file, 'utf8'), content); assert.equal(integration.rows.length, 0);
  }
});
test('Hermes native list parses only exact enabled/disabled rows and never infers a connection', () => {
  const line = '  agentbridge       /private/transport   all          ✓ enabled';
  assert.equal(native.parseNativeList(line).outcome, 'listed'); assert.doesNotMatch(native.parseNativeList(line).detail, /private/);
  assert.equal(native.parseNativeList(line.replace('✓ enabled', '✗ disabled')).outcome, 'absent');
  assert.equal(native.parseNativeList(line.replace('agentbridge', 'agentbridge-other')).outcome, 'absent');
  assert.equal(native.parseNativeList(line + '\n' + line).outcome, 'error');
  assert.equal(native.parseNativeList('agentbridge unknown').outcome, 'error');
});
