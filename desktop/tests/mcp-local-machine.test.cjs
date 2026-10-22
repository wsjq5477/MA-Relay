'use strict';
// I08-MCP02: the local Linux desktop machine manages MCP configuration in the
// coordinator process, while execution keeps its existing core host.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { localMcpHost, localMcpMethods } = require('../electron/coordinator-service.cjs');
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-mcp-local-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const options = {
    directory: path.join(directory, 'state'), home: path.join(directory, 'home'),
    environment: { DSH_HOME: path.join(directory, 'home', '.dsh') },
    platform: 'linux',
    collaboration: async () => ({ items: [] }),
  };
  fs.mkdirSync(options.home, { recursive: true });
  // An installed DSH Web profile: DSH itself initializes the profile directory
  // and its patch layer; Bridge only edits its own row inside that layer.
  const profile = path.join(options.environment.DSH_HOME, 'profiles', 'web');
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profile, 'cordis.patch.yml'), '[]\n');
  return { directory, options };
}
test('the local machine routes MCP calls only and never borrows the execution host', async (t) => {
  const { options } = fixture(t), host = localMcpHost(options);
  t.after(() => host.close());
  assert.deepEqual([...localMcpMethods].sort(), ['mcp.export', 'mcp.install', 'mcp.probe', 'mcp.remove', 'mcp.revoke', 'mcp.status']);
  await assert.rejects(host.call('snapshot', {}), { code: 'DESKTOP_METHOD' });
  const params = { nodeId: 'dsh-web-local', adapter: 'dsh-web' };
  const before = await host.call('mcp.status', params);
  assert.equal(before.state, 'absent');
  assert.equal(before.nativeSupport, true);
  const installed = await host.call('mcp.install', params);
  assert.equal(installed.state, 'installed');
  assert.equal(installed.facts.config, 'present');
  assert.equal(installed.facts.ownership, 'bridge');
  assert.equal(installed.facts.nativeLoad, 'reload_required');
  const file = path.join(options.home, '.dsh', 'profiles', 'web', 'cordis.patch.yml');
  const yaml = require('yaml');
  const rows = yaml.parse(fs.readFileSync(file, 'utf8')).flatMap(row => row.insert || []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'agentbridge-mcp');
  assert.equal(rows[0].config.serverName, 'agentbridge');
});
test('local restart re-creates the endpoint but never rewrites the user-deleted native entry', async (t) => {
  const { options } = fixture(t);
  let host = localMcpHost(options);
  const params = { nodeId: 'dsh-web-local', adapter: 'dsh-web' };
  const installed = await host.call('mcp.install', params);
  host.close();
  const file = path.join(options.home, '.dsh', 'profiles', 'web', 'cordis.patch.yml');
  // The user removes the row in the native product, keeping their own layer.
  fs.writeFileSync(file, '# user layer only\n[]\n');
  host = localMcpHost(options);
  t.after(() => host.close());
  const status = await host.call('mcp.status', params);
  const descriptor = JSON.parse(fs.readFileSync(installed.configuration.config.args[1], 'utf8'));
  const response = await fetch(descriptor.url, {
    method:'POST', headers:{authorization:'Bearer '+descriptor.token,'content-type':'application/json'},
    body:JSON.stringify({name:'list_agents',args:{},callId:'restart-read-only'}),
  });
  assert.deepEqual((await response.json()).result, {items:[]});
  assert.equal(status.state, 'exported');
  assert.equal(status.facts.config, 'absent');
  assert.equal(status.facts.authorization, 'valid');
  assert.equal(fs.readFileSync(file, 'utf8'), '# user layer only\n[]\n');
  assert.ok(fs.existsSync(installed.files.json));
  const revoked = await host.call('mcp.revoke', params);
  assert.equal(revoked.facts.authorization, 'revoked');
  assert.equal(revoked.state, 'absent');
  assert.equal(fs.readFileSync(file, 'utf8'), '# user layer only\n[]\n');
});
