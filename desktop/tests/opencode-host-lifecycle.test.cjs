'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { HostConnection } = require('../electron/rpc.cjs');
const { startDaemon, identity } = require('../electron/machine-daemon.cjs');
const { assertAdapterHost } = require('../electron/agent-adapter-contract.cjs');
const hostPath = path.resolve(__dirname, '../../dist/desktop-host.js');

function fixture(t, daemon = false) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-opencode-host-'));
  t.after(() => fs.rmSync(directory, {recursive:true, force:true}));
  if (daemon) identity({stateDirectory:directory, ownerCoordinatorId:'test-coordinator', profileId:'test-profile'});
  // An existing binding with no settings must be observed passively. No native
  // executable is launched and no user request is submitted by these tests.
  const row = {contextId:'original-context', nodeId:'original-node', adapter:'opencode', executable:'/unused/opencode', workspace:directory, agentId:'original-agent'};
  fs.writeFileSync(path.join(directory, 'node-contexts.json'), JSON.stringify([row]));
  return {directory, row};
}

test('production stdio MachineHost restores an OpenCode leaf without ADAPTER_HOST or rewriting its binding', {timeout:15000}, async t => {
  const {directory, row} = fixture(t), connection = new HostConnection(hostPath, {directory, native:true});
  t.after(() => connection.close());
  const snapshot = await connection.call('snapshot');
  assert.deepEqual(snapshot.agents.items, [], 'passive leaf must not become a synthetic ADAPTER_HOST failure');
  assert.deepEqual(snapshot.tasks, []);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'node-contexts.json'))), [row]);
});

test('production daemon creates synchronous OpenCode hosts and close preserves passive state', {timeout:15000}, async t => {
  const {directory, row} = fixture(t, true);
  const daemon = await startDaemon({stateDirectory:directory, ownerCoordinatorId:'test-coordinator', profileId:'test-profile', monitorIntervalMs:0});
  t.after(() => daemon.close());
  const leaf = daemon.host.backend(row);
  assert.equal(assertAdapterHost(leaf, 'opencode'), leaf);
  assert.equal(leaf.directory, path.join(directory, 'node-contexts', row.contextId));
  const before = await leaf.call('snapshot');
  leaf.close(); leaf.close();
  assert.deepEqual(await leaf.call('snapshot'), before);
  assert.deepEqual(before.tasks, []);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'node-contexts.json'))), [row]);
});
