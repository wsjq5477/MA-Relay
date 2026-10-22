'use strict';
/**
 * Regression for the desktop request chain: the alpha.38 maintenance-gate RPCs
 * and the user-confirmed override flag must pass the REAL coordinator allowlists
 * (desktop/electron/coordinator-service.cjs).
 *
 * Why this file exists: the worker/ssh-host tests call SshManager directly and the
 * UI tests stub window.agentbridge.call, so both stayed green while the packaged
 * app rejected `machine.maintenanceBlockers`, `machine.queryBlockedOperation` and
 * `config.allowUnresolved` before they ever reached ssh-host.cjs.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createCoordinatorService } = require('../electron/coordinator-service.cjs');

function harness() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-maintenance-access-'));
  const sshCalls = [];
  const connection = { connectionId: 'ssh-connection-1', machineId: 'machine-1', revision: 1 };
  const ssh = {
    find: () => connection,
    states: () => [],
    close() {},
    async call(method, params) {
      sshCalls.push({ method, params });
      return { operationId: params && params.operationId, state: 'confirmed', data: { action: 'maintainDaemon', version: '0.6.0-alpha.39' } };
    },
  };
  const network = {
    options: {}, machineLocks: new Set(), nodeJobs: new Set(), locks: new Set(),
    catalog: { machines: [{ machineId: 'machine-1', online: true, kind: 'ssh' }], instances: [] },
    machines: async () => [], save() {}, machine: () => ({ kind: 'ssh' }),
    node: () => ({ connected: true, removed: false, executionSupported: true }),
    async snapshot() { return { machines: [{ machineId: 'machine-1', online: true, kind: 'ssh' }], tasks: [], nodes: [], instances: [] }; },
    finalizeMachine: (receipt) => receipt,
    async call() { throw Object.assign(Error('stub network call'), { code: 'STUB' }); },
  };
  const service = createCoordinatorService({ directory, platform: 'linux', coordinatorId: 'coordinator-1', ssh, network });
  return { service, sshCalls, connection, directory };
}

function dispatch(service, method, params) {
  return service.dispatch('call', { method, params });
}

test('machine.maintenanceBlockers and machine.queryBlockedOperation reach ssh-host through the coordinator', async (t) => {
  const { service, sshCalls, connection, directory } = harness();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const blockers = await dispatch(service, 'machine.maintenanceBlockers', { connectionId: connection.connectionId, machineId: connection.machineId });
  assert.equal(blockers.ok, true);
  assert.deepEqual(sshCalls.map(c => c.method), ['machine.maintenanceBlockers']);
  assert.equal(sshCalls[0].params.connectionId, connection.connectionId);
  assert.equal(sshCalls[0].params.machineId, connection.machineId);

  const query = await dispatch(service, 'machine.queryBlockedOperation', { connectionId: connection.connectionId, machineId: connection.machineId, key: 'delegation-original-id', op: 'submit' });
  assert.equal(query.ok, true);
  assert.deepEqual(sshCalls.map(c => c.method), ['machine.maintenanceBlockers', 'machine.queryBlockedOperation']);
  // 只读原 ID 查询：原样透传，不新建 ID、不改 op
  assert.equal(sshCalls[1].params.key, 'delegation-original-id');
  assert.equal(sshCalls[1].params.op, 'submit');
});

test('config.allowUnresolved passes the maintainDaemon whitelist and is forwarded unchanged', async (t) => {
  const { service, sshCalls, connection, directory } = harness();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const base = { connectionId: connection.connectionId, machineId: connection.machineId, expectedRevision: 1, config: { action: 'upgrade', previewId: 'preview-1', expectedVersion: '0.6.0-alpha.38', targetVersion: '0.6.0-alpha.39' } };

  const plain = await dispatch(service, 'machine.maintainDaemon', { ...base, config: { ...base.config } });
  assert.equal(plain.ok, true);
  assert.equal(sshCalls.length, 1);
  assert.equal(sshCalls[0].params.config.allowUnresolved, undefined);

  const override = await dispatch(service, 'machine.maintainDaemon', { ...base, config: { ...base.config, allowUnresolved: true } });
  assert.equal(override.ok, true);
  assert.equal(sshCalls.length, 2);
  assert.equal(sshCalls[1].params.config.allowUnresolved, true);

  // 协调层不替 ssh-host 做布尔归一化：非 true 一律原样透传，由 ssh-host 严格判定
  const loose = await dispatch(service, 'machine.maintainDaemon', { ...base, config: { ...base.config, allowUnresolved: 'yes' } });
  assert.equal(loose.ok, true);
  assert.equal(sshCalls[2].params.config.allowUnresolved, 'yes');
});

test('unknown maintenance config keys are still rejected before ssh-host', async (t) => {
  const { service, sshCalls, connection, directory } = harness();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const config = { action: 'upgrade', previewId: 'preview-1', expectedVersion: '0.6.0-alpha.38', targetVersion: '0.6.0-alpha.39', allowUnresolvedReceipts: true };
  const outcome = await dispatch(service, 'machine.maintainDaemon', { connectionId: connection.connectionId, machineId: connection.machineId, expectedRevision: 1, config });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.code, 'INVALID_INPUT');
  assert.equal(sshCalls.length, 0);
});

test('unknown machine.* methods are still rejected by the coordinator', async (t) => {
  const { service, sshCalls, directory } = harness();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const method of ['machine.overrideMaintenance', 'machine.maintenanceGates']) {
    const outcome = await dispatch(service, method, {});
    assert.equal(outcome.ok, false, method + ' should be rejected');
    assert.equal(outcome.error.code, 'DESKTOP_ERROR');
  }
  assert.equal(sshCalls.length, 0);
});
