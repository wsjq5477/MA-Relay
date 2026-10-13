const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SshManager } = require('../electron/ssh-host.cjs');
const { MachineRouter } = require('../electron/machine-router.cjs');
const { mergeSshState } = require('../electron/coordinator-service.cjs');

test('SSH recovery clears persisted version errors without losing identity, nodes or history; a new failure remains visible', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-ssh-recovery-'));
  let failSnapshot = false;
  const task = { taskId: 'original-task', status: 'failed', error: { message: 'original native failure' }, createdAt: '2026-10-12T00:00:00Z' };
  const host = { async call(method) {
    if (method === 'discover') return { items: [{ adapter: 'opencode', executable: '/opt/opencode', healthy: true }] };
    if (failSnapshot) throw Object.assign(new Error('current RPC failure'), { code: 'DESKTOP_TIMEOUT' });
    return { agents: { items: [] }, tasks: [task], conversations: [] };
  }, close() {} };
  const makeRouter = () => new MachineRouter({ directory, platform: 'linux', createHost: () => host });
  const router = makeRouter();
  const connection = { connectionId: 'original-connection', machineId: 'original-machine', name: 'fixture', host: 'example.invalid', port: 22, username: 'fixture', authKind: 'agent' };
  const machine = { ...connection, kind: 'ssh', platform: 'linux' };
  router.catalog.machines.push(machine);
  router.catalog.connections.push({ connectionId: 'original-tool', machineId: machine.machineId, executable: '/opt/opencode', connected: true });
  const manager = new SshManager({ directory, onChange: state => { mergeSshState(machine, state); router.save(); } });
  t.after(() => { manager.close(); router.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  const oldFailure = Object.assign(new Error('old version refusal'), { code: 'SSH_DAEMON_UPGRADE_REQUIRED' });
  manager.state(connection, 'blocked', oldFailure);
  assert.equal(machine.connectionError.code, oldFailure.code);
  manager.state(connection, 'online');
  assert.equal(machine.error, undefined);
  assert.equal(machine.connectionError, undefined);
  const reopened = makeRouter();
  try {
    const saved = reopened.catalog.machines.find(m => m.machineId === machine.machineId);
    assert.equal(saved.error, undefined); assert.equal(saved.connectionError, undefined);
    assert.equal(saved.connectionId, connection.connectionId);
    assert.equal(reopened.catalog.connections.find(c => c.connectionId === 'original-tool').connected, true);
    // Reproduce catalogs written by older clients: successful snapshots repair display.
    saved.error = oldFailure.message; saved.connectionError = { code: oldFailure.code };
    const healthy = await reopened.oneSnapshot(saved);
    mergeSshState(healthy.machine, manager.publicState(connection), true);
    assert.equal(healthy.machine.online, true); assert.equal(healthy.machine.error, undefined);
    assert.deepEqual(healthy.snapshot.tasks, [task]);
    failSnapshot = true;
    const failed = await reopened.oneSnapshot(saved);
    mergeSshState(failed.machine, manager.publicState(connection), true);
    assert.equal(failed.machine.online, false); assert.equal(failed.machine.error, 'current RPC failure');
    assert.equal(failed.stale, true);
    manager.state(connection, 'blocked', Object.assign(new Error('current host key refusal'), { code: 'SSH_HOST_KEY_CHANGED' }));
    assert.equal(machine.connectionError.code, 'SSH_HOST_KEY_CHANGED');
    assert.equal(machine.error, 'current host key refusal');
    mergeSshState(failed.machine, manager.publicState(connection), true);
    assert.equal(failed.machine.error, 'current host key refusal');
  } finally { reopened.close(); }
});

test('an authoritative SSH snapshot revokes stale errors but cannot make a failed RPC online', () => {
  const stale = { machineId: 'original', online: true, error: 'obsolete version error', connectionError: { code: 'SSH_DAEMON_UPGRADE_REQUIRED' } };
  const state = { machineId: 'original', online: true, stage: 'online' };
  const recovered = mergeSshState({ ...stale }, state, true);
  assert.equal(recovered.error, undefined); assert.equal(recovered.connectionError, undefined);
  assert.equal(recovered.online, true);
  const rpcFailure = mergeSshState({ ...stale, online: false, error: 'response timed out' }, state, true);
  assert.equal(rpcFailure.online, false); assert.equal(rpcFailure.error, 'response timed out');
  assert.equal(rpcFailure.connectionError, undefined);
});
