const { test } = require('node:test');
const assert = require('node:assert/strict');
const { require: requireTsx } = require('tsx/cjs/api');
const { shareUnchanged } = requireTsx('../src/poll-state.ts', __filename);

test('unchanged polling preserves references without losing real heartbeat, status or occupancy updates', () => {
  const previous = { machines: [{ machineId: 'm', online: true, lastSyncedAt: 'first' }], nodes: [{ nodeId: 'n', status: 'connected', busy: false }], tasks: [], journal: [{ requestId: 'original', state: 'unknown' }] };
  assert.equal(shareUnchanged(previous, structuredClone(previous)), previous);
  const heartbeat = structuredClone(previous);
  heartbeat.machines[0].lastSyncedAt = 'second';
  const updated = shareUnchanged(previous, heartbeat);
  assert.equal(updated.machines[0].lastSyncedAt, 'second');
  assert.equal(updated.nodes, previous.nodes);
  assert.equal(updated.tasks, previous.tasks);
  assert.equal(updated.journal, previous.journal);
  const changed = structuredClone(heartbeat);
  changed.nodes[0].busy = true;
  changed.journal[0].state = 'confirmed';
  const live = shareUnchanged(updated, changed);
  assert.equal(live.nodes[0].busy, true);
  assert.equal(live.journal[0].state, 'confirmed');
  assert.equal(live.journal[0].requestId, 'original');
});

test('polling applies removed fields, added fields, empty arrays and reordered rows', () => {
  const before = { error: 'offline', rows: [{ id: 'a' }, { id: 'b' }] };
  const after = { rows: [{ id: 'b' }, { id: 'a' }], online: true };
  assert.deepEqual(shareUnchanged(before, after), after);
  assert.deepEqual(shareUnchanged(after, { rows: [], online: false }), { rows: [], online: false });
  assert.equal(shareUnchanged(null, before), before);
});
