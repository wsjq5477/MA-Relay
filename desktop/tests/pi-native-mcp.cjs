// Explicit acceptance only; never included in the automatic unit test glob.
// Requires approval for native processes. No model or native parent is invoked.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict'), {pathToFileURL} = require('node:url');
const [bridge, nativeRoot, output, version = '0.6.0-alpha.50'] = process.argv.slice(2);
if (!bridge || !nativeRoot || !output) throw Error('Provide Bridge resources, unmodified Pi package and report path');
const {MachineHost} = require(path.join(bridge, 'desktop/electron/machine-host.cjs'));
const {assertListArgs} = require(path.join(bridge, 'desktop/electron/agent-connections.cjs'));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-pi-native-'));
const agentDir = path.join(directory, 'native-user'), cwd = path.join(directory, 'project');
fs.mkdirSync(cwd, {recursive: true});
const environment = {...process.env, PI_CODING_AGENT_DIR: agentDir};
const candidates = Object.fromEntries(['claude', 'codex', 'opencode', 'hermes', 'pi', 'dsh'].map(id => [id, []]));
candidates.pi = [path.join(nativeRoot, 'dist/bundle/cli.js')];
const params = {nodeId: 'pi-native-acceptance', adapter: 'pi'}, clients = [], calls = [];
const report = {date: new Date().toISOString(), bridgeVersion: version, environment: 'unmodified official Pi native config loader and MCP runtime / production MachineHost and broker / isolated user directory / controlled parent',
  nativeVersion: JSON.parse(fs.readFileSync(path.join(nativeRoot, 'package.json'))).version, status: 'running', checks: [], modelCalls: 0};
let host;
const createHost = () => new MachineHost({directory: path.join(directory, 'bridge'), home: directory, environment, candidates, legacy: {close() {}},
  collaboration: async (scope, name, args) => {assert.equal(name, 'list_agents'); assertListArgs(args); calls.push(scope); return {items: []};}});
const load = file => import(pathToFileURL(path.join(nativeRoot, file)).href);
(async () => {
  const [{loadMcpConfig}, runtime, {FileAuthStorageBackend}] = await Promise.all([load('dist/extensions/mcp/config.js'), load('dist/extensions/mcp/runtime.js'), load('dist/core/auth-storage.js')]);
  host = createHost(); const installed = await host.call('mcp.install', params);
  assert.equal(installed.facts.config, 'present');
  const probe = await host.call('mcp.probe', params);
  assert.equal(probe.facts.nativeLoad, 'loaded'); assert.equal(probe.facts.connection, 'connected'); assert.equal(probe.facts.tools, 'available');
  report.checks.push('Production install and original Pi CLI mcp list --json load the isolated entry and confirm a native MCP connection');
  async function connect() {
    const loaded = loadMcpConfig({agentDir, cwd, projectTrusted: false}); assert.deepEqual(loaded.errors, []);
    assert.equal(loaded.servers.length, 1);
    const client = new runtime.McpServerConnection({entry: loaded.servers[0], cwd, createTransport: runtime.createDefaultTransport,
      credentials: new runtime.McpOAuthCredentialStore(new FileAuthStorageBackend(path.join(agentDir, 'mcp-auth.json')), agentDir), onTools() {}});
    clients.push(client); await client.getClient(); assert.equal(client.tools.length, 7); return client;
  }
  const invoke = async (client, args = {}) => client.callTool('list_agents', args, {});
  const old = await connect(); assert.deepEqual(JSON.parse((await invoke(old)).content[0].text), {items: []});
  assert.equal(calls.at(-1).nodeId, params.nodeId);
  const before = calls.length; assert.equal((await invoke(old, {nodeId: 'forged'})).isError, true); assert.equal(calls.length, before);
  report.checks.push('Unmodified native config loader and MCP runtime expose seven tools and enforce original scope and argument validation');
  let json = JSON.parse(fs.readFileSync(installed.configPath)); json.mcpServers.agentbridge.enabled = false; fs.writeFileSync(installed.configPath, JSON.stringify(json));
  assert.equal((await host.call('mcp.status', params)).facts.config, 'disabled');
  await assert.rejects(host.call('mcp.install', params), {code: 'MCP_NATIVE_DISABLED'});
  const disabled = loadMcpConfig({agentDir, cwd, projectTrusted: false}); assert.equal(disabled.servers[0].config.enabled, false);
  fs.unlinkSync(installed.configPath); host.close(); host = createHost(); await host.mcpReady;
  assert.equal(fs.existsSync(installed.configPath), false);
  const restoredReply = await invoke(old); assert.notEqual(restoredReply.isError, true); assert.deepEqual(JSON.parse(restoredReply.content[0].text), {items: []});
  report.checks.push('Native disable never auto-enables; native deletion and Bridge restart never reinstall the entry or replay a task');
  await host.call('mcp.revoke', params); assert.match((await invoke(old)).content[0].text, /MCP_REVOKED/);
  const fresh = await host.call('mcp.install', params); assert.notEqual(fresh.connectionId, installed.connectionId);
  assert.match((await invoke(old)).content[0].text, /MCP_REVOKED/);
  const current = await connect(), freshReply = await invoke(current); assert.notEqual(freshReply.isError, true); assert.deepEqual(JSON.parse(freshReply.content[0].text), {items: []});
  report.checks.push('Revocation rejects a cached original native client; reinstall rotates identity and authorizes only the new client');
  const removed = await host.call('mcp.remove', params); assert.equal(removed.facts.config, 'absent');
  assert.equal(loadMcpConfig({agentDir, cwd, projectTrusted: false}).servers.length, 0);
  assert.match((await invoke(current)).content[0].text, /MCP_REVOKED/);
  assert.equal(fs.existsSync(path.join(cwd, '.pi/mcp.json')), false);
  report.checks.push('Removal disappears from the original Pi config loader, revokes cached calls and never creates a project override');
  report.status = 'passed';
})().catch(error => {report.status = 'failed'; report.error = {code: error.code || 'ACCEPTANCE_FAILED', message: 'Original Pi acceptance did not meet its contract; no model request was submitted.'}; process.exitCode = 1;})
  .finally(async () => {
    for (const client of clients) {try {await client.close();} catch {report.cleanupPending = true;}}
    host?.close();
    if (!report.cleanupPending) fs.rmSync(directory, {recursive: true, force: true, maxRetries: 8, retryDelay: 200});
    fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
  });
