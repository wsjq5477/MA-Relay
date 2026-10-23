// Configuration-only regression: no native subprocess, sockets or model calls.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {McpIntegration} = require('../electron/mcp-integration.cjs');
const {McpConfig} = require('../electron/mcp-config.cjs');
const {currentTarget, compatibleVersion, parseNativeList} = require('../electron/pi-mcp-config.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-pi-config-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const home = path.join(root, 'home'), env = {}, directory = path.join(root, 'bridge');
  const broker = {async configure() {return {command: '/fixture/node', args: ['/fixture/mcp-client.cjs', '/fixture/endpoint.json'], env: {ELECTRON_RUN_AS_NODE: '1'}};}};
  const create = () => {
    const integration = new McpIntegration({directory, home, environment: env}, broker);
    integration.piInstallation = async () => ({healthy: true, version: '1.4.0'});
    return integration;
  };
  const file = path.join(home, '.pi/agent/mcp.json');
  const write = (file, value) => {fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));};
  return {root, home, env, create, file, write};
}
const params = {nodeId: 'pi-original', adapter: 'pi'};
test('Pi native config preserves unrelated settings, installs once and removes only its registered entry', async t => {
  const f = fixture(t), integration = f.create();
  const unrelated = {command: '/other/mcp', args: ['keep']};
  f.write(f.file, {autoEnableCodemode: false, mcpServers: {other: unrelated}});
  const installed = await integration.call('mcp.install', params);
  assert.equal(installed.facts.config, 'present'); assert.equal(installed.configPath, f.file);
  assert.equal(installed.facts.nativeLoad, 'unknown'); assert.equal(installed.facts.connection, 'unknown');
  const repeated = await integration.call('mcp.install', params); assert.equal(repeated.connectionId, installed.connectionId);
  const json = JSON.parse(fs.readFileSync(f.file)); assert.equal(json.autoEnableCodemode, false); assert.deepEqual(json.mcpServers.other, unrelated);
  assert.deepEqual(json.mcpServers.agentbridge, installed.configuration);
  const removed = await integration.call('mcp.remove', params); assert.equal(removed.facts.authorization, 'revoked');
  assert.deepEqual(JSON.parse(fs.readFileSync(f.file)), {autoEnableCodemode: false, mcpServers: {other: unrelated}});
});
test('Pi external disable remains owned, cannot be re-enabled and can be revoked and cleaned', async t => {
  const f = fixture(t), integration = f.create(); await integration.call('mcp.install', params);
  const value = JSON.parse(fs.readFileSync(f.file)); value.mcpServers.agentbridge.enabled = false; f.write(f.file, value);
  const before = fs.readFileSync(f.file, 'utf8'), disabled = await integration.call('mcp.status', params);
  assert.equal(disabled.facts.config, 'disabled'); assert.equal(disabled.installed, false); assert.equal(disabled.facts.ownership, 'bridge');
  await assert.rejects(integration.call('mcp.install', params), {code: 'MCP_NATIVE_DISABLED'});
  await integration.call('mcp.export', params); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
  const removed = await integration.call('mcp.remove', params); assert.equal(removed.cleanupError, undefined); assert.equal(removed.facts.config, 'absent');
});
test('Pi native edits remain conflicts and remove revokes before preserving the changed file', async t => {
  const f = fixture(t), integration = f.create(), installed = await integration.call('mcp.install', params);
  const value = JSON.parse(fs.readFileSync(f.file)); value.mcpServers.agentbridge.args.push('foreign'); f.write(f.file, value);
  const before = fs.readFileSync(f.file, 'utf8');
  await assert.rejects(integration.call('mcp.install', params), {code: 'MCP_CONFIG_CONFLICT'});
  const removed = await integration.call('mcp.remove', params);
  assert.equal(removed.state, 'revoked_config_pending'); assert.equal(fs.readFileSync(f.file, 'utf8'), before);
  assert.throws(() => integration.authorize({externalConnectionId: installed.connectionId, nodeId: params.nodeId}), {code: 'MCP_REVOKED'});
});
test('Pi restart does not reinstall native deletion; directory changes retain original cleanup and rotate only after remove', async t => {
  const f = fixture(t); let integration = f.create();
  const installed = await integration.call('mcp.install', params); fs.unlinkSync(f.file);
  integration = f.create(); await integration.restore(); assert.equal(fs.existsSync(f.file), false);
  assert.equal((await integration.call('mcp.status', params)).facts.config, 'absent');
  await integration.call('mcp.install', params);
  f.env.PI_CODING_AGENT_DIR = path.join(f.root, 'other agent');
  const other = path.join(f.env.PI_CODING_AGENT_DIR, 'mcp.json'); f.write(other, {keep: true});
  const bytes = fs.readFileSync(other, 'utf8'), status = await integration.call('mcp.status', params);
  assert.equal(status.nativeTargetChanged, true); assert.equal(status.configPath, f.file); assert.equal(status.currentConfigPath, other);
  await assert.rejects(integration.call('mcp.install', params), {code: 'MCP_NATIVE_TARGET_CHANGED'});
  await integration.call('mcp.remove', params); assert.equal(fs.readFileSync(other, 'utf8'), bytes);
  const fresh = await integration.call('mcp.install', params); assert.equal(fresh.configPath, other); assert.notEqual(fresh.connectionId, installed.connectionId);
});
test('Pi selection race rolls back authorization and never writes either native target', async t => {
  const f = fixture(t), integration = f.create(), configure = integration.configure.bind(integration);
  integration.configure = async (...args) => {const result = await configure(...args); f.env.PI_CODING_AGENT_DIR = path.join(f.root, 'changed'); return result;};
  await assert.rejects(integration.call('mcp.install', params), {code: 'MCP_NATIVE_TARGET_CHANGED'});
  assert.equal(integration.rows.length, 0); assert.equal(fs.existsSync(f.file), false);
  assert.equal(fs.existsSync(path.join(f.env.PI_CODING_AGENT_DIR, 'mcp.json')), false);
});
test('Pi strict JSON rejects comments, duplicate keys and malformed structures without a new registration', async t => {
  for (const content of ['{"mcpServers": {},}', '{/*comment*/"mcpServers":{}}', '{"mcpServers":{},"mcpServers":{}}', '{"mcpServers":[]}']) {
    const f = fixture(t), integration = f.create(); f.write(f.file, content);
    await assert.rejects(integration.call('mcp.install', params), {code: 'MCP_CONFIG_INVALID'});
    assert.equal(fs.readFileSync(f.file, 'utf8'), content); assert.equal(integration.rows.length, 0);
  }
  const f = fixture(t), integration = f.create(); f.write(f.file, '\uFEFF{"keep": true}');
  await integration.call('mcp.install', params);
  assert.equal(JSON.parse(fs.readFileSync(f.file, 'utf8').replace(/^\uFEFF/, '')).keep, true);
});
test('Pi unknown native versions reject install but allow independent export without inventing native load', async t => {
  for (const version of ['0.73.0', '1.3.9', '2.0.0', '1.4.0-beta', undefined]) {
    assert.equal(compatibleVersion(version), false);
    const f = fixture(t), integration = f.create(); integration.piInstallation = async () => ({healthy: true, version});
    await assert.rejects(integration.call('mcp.install', params), {code: 'NATIVE_VERSION'});
    assert.equal(integration.rows.length, 0); assert.equal(fs.existsSync(f.file), false);
    const exported = await integration.call('mcp.export', params); assert.equal(exported.facts.config, 'absent'); assert.equal(exported.facts.nativeLoad, 'unknown');
  }
  assert.equal(compatibleVersion('1.4.0'), true);
});
test('Pi target uses native user directory, refuses relative paths and preserves cleanup after a directory becomes a link', async t => {
  const f = fixture(t), integration = f.create();
  assert.equal(currentTarget(f.home, {PI_CODING_AGENT_DIR: '~/custom'}).agentDir, path.join(f.home, 'custom'));
  assert.throws(() => currentTarget(f.home, {PI_CODING_AGENT_DIR: 'relative'}), {code: 'MCP_PI_TARGET'});
  await integration.call('mcp.install', params);
  const dir = path.dirname(f.file), moved = dir + '-original'; fs.renameSync(dir, moved); fs.symlinkSync(moved, dir, process.platform === 'win32' ? 'junction' : 'dir');
  const before = fs.readFileSync(path.join(moved, 'mcp.json'), 'utf8');
  const removed = await integration.call('mcp.remove', params);
  assert.equal(removed.facts.authorization, 'revoked'); assert.equal(removed.state, 'revoked_config_pending');
  assert.equal(fs.readFileSync(path.join(moved, 'mcp.json'), 'utf8'), before);
});
test('Pi native list evidence requires exact identity, global source and confirmed connected state', () => {
  const report = entry => JSON.stringify({servers: [entry], errors: []});
  const row = {name: 'agentbridge', enabled: true, scope: 'global', state: 'connected', tools: ['list_agents']};
  assert.equal(parseNativeList(report(row)).outcome, 'connected');
  assert.equal(parseNativeList(report({...row, name: 'agentbridge-other'})).outcome, 'absent');
  assert.equal(parseNativeList(report({...row, state: 'disconnected'})).outcome, 'failed');
  assert.equal(parseNativeList(report({...row, enabled: false, state: 'disabled'})).outcome, 'absent');
  assert.equal(parseNativeList(report({...row, override: '/project/.pi/mcp.json'})).outcome, 'error');
  assert.equal(parseNativeList('not JSON').outcome, 'error');
  assert.equal(parseNativeList(JSON.stringify({servers: [row, row], errors: []})).outcome, 'error');
});
test('Pi foreign unregistered agentbridge and native file symlinks never grant ownership', async t => {
  const f = fixture(t), integration = f.create();
  f.write(f.file, {mcpServers: {agentbridge: {command: '/foreign', args: []}}});
  await assert.rejects(integration.call('mcp.install', params), {code: 'MCP_CONFIG_CONFLICT'}); assert.equal(integration.rows.length, 0);
  fs.unlinkSync(f.file); const real = f.file + '.native'; f.write(real, {}); fs.symlinkSync(real, f.file);
  assert.throws(() => new McpConfig('pi', f.home, f.env).update({command: '/fixture', args: []}), {code: 'MCP_CONFIG_CONFLICT'});
  assert.deepEqual(JSON.parse(fs.readFileSync(real)), {});
});
