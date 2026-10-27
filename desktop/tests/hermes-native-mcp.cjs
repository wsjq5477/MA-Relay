// Explicit acceptance against original Hermes source/runtime; no model or parent.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict'), {spawn} = require('node:child_process');
const [bridge, nativeRoot, python, executable, output, expectedTools = '10'] = process.argv.slice(2);
if (!output) throw Error('Provide Bridge resources, Hermes source, Python, CLI and report');
const {MachineHost} = require(path.join(bridge, 'desktop/electron/machine-host.cjs'));
const {assertListArgs} = require(path.join(bridge, 'desktop/electron/agent-connections.cjs'));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-hermes-native-')), root = path.join(directory, 'native');
const selected = path.join(root, 'profiles/research'), other = path.join(root, 'profiles/review');
for (const folder of [root, selected, other]) {fs.mkdirSync(folder, {recursive: true}); fs.writeFileSync(path.join(folder, 'config.yaml'), '# original native user configuration\n');}
const active = path.join(root, 'active_profile'); fs.writeFileSync(active, 'Research\n');
const environment = {...process.env, HERMES_HOME: root, HERMES_RUNTIME_DIR: path.join(directory, 'runtime'), HERMES_DISABLE_LAZY_INSTALLS: '1'};
// Installed Hermes scopes dependency selection to its data root. Reuse the
// original committed runtime through a fixture-only junction instead of asking
// its installer to provision another environment for the disposable Profile.
if (fs.existsSync(path.join(nativeRoot, 'install-stamp.json'))) {
  const owner = path.dirname(nativeRoot);
  fs.symlinkSync(path.join(owner, 'installs'), path.join(root, 'installs'), process.platform === 'win32' ? 'junction' : 'dir');
  environment.HERMES_RUNTIME_DIR = path.join(owner, 'tools');
}
const candidates = Object.fromEntries(['claude', 'codex', 'opencode', 'hermes', 'pi', 'dsh'].map(id => [id, []])); candidates.hermes = [executable];
const params = {nodeId: 'hermes-native-acceptance', adapter: 'hermes'}, calls = [], clients = [];
const stampFile = path.join(nativeRoot, 'install-stamp.json'), stamp = fs.existsSync(stampFile) ? JSON.parse(fs.readFileSync(stampFile, 'utf8')) : null;
const report = {date: new Date().toISOString(), bridgeVersion: require('../package.json').version, nativeSource: stamp?.commit || 'external source (see supplied provenance)', nativeVersion: stamp?.displayVersion || 'unknown', expectedTools: Number(expectedTools),
  environment: `${process.platform} / original Hermes source and installed Python/MCP runtime / production MachineHost and broker / isolated native Profile / controlled parent`, status: 'running', modelCalls: 0, checks: []};
let host;
const createHost = () => new MachineHost({directory: path.join(directory, 'bridge'), home: directory, environment, candidates, legacy: {close() {}},
  collaboration: async (scope, name, args) => {assert.equal(name, 'list_agents'); assertListArgs(args); calls.push(scope); return {items: []};}});
function driver(home) {
  const child = spawn(python, [path.join(__dirname, 'hermes-mcp-native-driver.py'), nativeRoot], {env: {...environment, HERMES_HOME: home}, stdio: ['pipe', 'pipe', 'pipe'], cwd: directory});
  const pending = new Map(); let sequence = 0, lines = ''; child.stderr.resume();
  child.stdout.on('data', chunk => {lines += chunk; let index; while ((index = lines.indexOf('\n')) >= 0) {
    const line = lines.slice(0, index); lines = lines.slice(index + 1); let reply; try {reply = JSON.parse(line);} catch {continue;}
    const job = pending.get(reply.id); if (job) {pending.delete(reply.id); clearTimeout(job.timer); if (reply.error) job.reject(Error('Original Hermes fixture: ' + reply.error)); else job.resolve(reply.result);}
  }});
  child.once('exit', () => {for (const job of pending.values()) {clearTimeout(job.timer); job.reject(Error('Original Hermes fixture exited'));} pending.clear();});
  const call = input => new Promise((resolve, reject) => {const id = ++sequence, timer = setTimeout(() => {pending.delete(id); reject(Error('Original Hermes response unconfirmed'));}, 45000); pending.set(id, {resolve, reject, timer}); child.stdin.write(JSON.stringify({id, ...input}) + '\n');});
  const close = async () => {
    await call({action: 'close'}); child.stdin.end();
    if (child.exitCode === null) await new Promise((resolve, reject) => {const timer = setTimeout(() => reject(Error('Native fixture exit unconfirmed')), 15000); child.once('exit', () => {clearTimeout(timer); resolve();});});
  };
  const result = {call, close}; clients.push(result); return result;
}
const invoke = async (client, args = {}) => client.call({action: 'call', args});
(async () => {
  host = createHost(); const installed = await host.call('mcp.install', params);
  assert.equal(installed.configPath, path.join(selected, 'config.yaml')); assert.equal(installed.profile, 'research');
  const probe = await host.call('mcp.probe', params); assert.equal(probe.facts.nativeLoad, 'loaded'); assert.equal(probe.facts.connection, 'unknown'); assert.equal(probe.facts.tools, 'available');
  report.checks.push('Original Hermes CLI follows the sticky native Profile and lists the Bridge-written entry; product status correctly leaves connection unconfirmed by a plain list');
  const old = driver(selected), ready = await old.call({action: 'connect'}); assert.equal(ready.tools, Number(expectedTools)); assert.equal(ready.configPath, installed.configPath);
  assert.deepEqual(JSON.parse((await invoke(old)).content[0].text), {items: []}); assert.equal(calls.at(-1).nodeId, params.nodeId);
  const before = calls.length; assert.equal((await invoke(old, {nodeId: 'forged'})).isError, true); assert.equal(calls.length, before);
  report.checks.push('Unmodified native MCPServerTask and actual SDK expose the expected classic tools and call the production broker with original scope; forged arguments are rejected');
  assert.equal((await old.call({action: 'disable'})).enabled, false); assert.equal((await host.call('mcp.status', params)).facts.config, 'disabled');
  await assert.rejects(host.call('mcp.install', params), {code: 'MCP_NATIVE_DISABLED'});
  assert.equal((await old.call({action: 'remove'})).removed, true); assert.equal((await host.call('mcp.status', params)).facts.config, 'absent');
  host.close(); host = createHost(); await host.mcpReady;
  assert.equal((await host.call('mcp.status', params)).facts.config, 'absent'); assert.deepEqual(JSON.parse((await invoke(old)).content[0].text), {items: []});
  report.checks.push('Original native config writer disables and removes the entry; Bridge refuses re-enable and restart never reinstalls native deletion');
  await host.call('mcp.revoke', params); assert.match((await invoke(old)).content[0].text, /MCP_REVOKED/);
  fs.writeFileSync(active, 'review\n'); const fresh = await host.call('mcp.install', params); assert.notEqual(fresh.connectionId, installed.connectionId); assert.equal(fresh.configPath, path.join(other, 'config.yaml'));
  const current = driver(other), next = await current.call({action: 'connect'}); assert.equal(next.tools, Number(expectedTools));
  assert.deepEqual(JSON.parse((await invoke(current)).content[0].text), {items: []}); assert.match((await invoke(old)).content[0].text, /MCP_REVOKED/);
  report.checks.push('Explicit revoke rejects a cached native client; new native Profile binding rotates identity and only the fresh client remains authorized');
  await host.call('mcp.remove', params); assert.equal((await host.call('mcp.status', params)).facts.config, 'absent'); assert.match((await invoke(current)).content[0].text, /MCP_REVOKED/);
  report.checks.push('Removal clears only the new registered Profile and revokes its cached client, without a model task or replay');
  report.status = 'passed';
})().catch(error => {report.status = 'failed'; report.error = {code: error.code || 'ACCEPTANCE_FAILED', message: error.code === 'ERR_ASSERTION' ? 'Original Hermes evidence did not meet the expected contract' : error.message, location: error.stack?.split('\n').find(line => line.includes('hermes-native-mcp.cjs:'))?.trim()}; process.exitCode = 1;})
  .finally(async () => {for (const client of clients) {try {await client.close();} catch {report.cleanupPending = true;}} host?.close(); if (!report.cleanupPending) fs.rmSync(directory, {recursive: true, force: true, maxRetries: 8, retryDelay: 200}); fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));});
