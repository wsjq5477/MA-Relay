import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BridgeError, clip, nextStatus } from '../src/core.js';
import { initDemo, loadConfig } from '../src/config.js';
import { matchesToken, redactor } from '../src/security.js';
import { HubStore } from '../src/storage/hub-store.js';
import { EdgeJournal } from '../src/storage/edge-journal.js';
import { wireSchema, envelope, type Execution } from '../src/protocol.js';
import { MockDriver } from '../src/drivers/mock.js';

function directory() {
  const path = mkdtempSync(resolve(tmpdir(), 'agentbridge-unit-'));
  return { path, clean: () => rmSync(path, { recursive: true, force: true }) };
}
test('state machine rejects impossible events, unknown recovery and terminal overwrite', () => {
  assert.equal(nextStatus('queued', { kind: 'accepted' }), 'accepted');
  assert.equal(nextStatus('accepted', { kind: 'started' }), 'running');
  assert.throws(() => nextStatus('queued', { kind: 'completed', result: { agentId: 'a', message: 'done' } }), BridgeError);
  for (const state of ['unknown', 'succeeded', 'failed'] as const) assert.throws(() => nextStatus(state, { kind: 'started' }), BridgeError);
  assert.throws(() => nextStatus('running', { kind: 'failed', error: { code: 'BAD', message: '', phase: 'before_execution' } }), BridgeError);
});
test('UTF-8 clipping never splits code points', () => {
  assert.deepEqual(clip('你好a', 4), { text: '你', truncated: true });
  assert.deepEqual(clip('你好', 6), { text: '你好', truncated: false });
});
test('credentials use fixed digest comparison and known secrets are redacted', () => {
  assert(matchesToken('secret', 'secret'));
  assert(!matchesToken('', 'secret'));
  assert(!matchesToken('secret-long', 'secret'));
  assert.equal(redactor(['abc', 'abcdef'])('abcdef abc'), '[REDACTED] [REDACTED]');
  const quoted = 'token-"with-quote\\slash';
  assert.equal(JSON.parse(redactor([quoted])(JSON.stringify({ value: quoted }))).value, '[REDACTED]');
});
test('config paths are anchored, credentials protected, unsafe URLs and identity collisions rejected', () => {
  const temp = directory();
  try {
    const dir = resolve(temp.path, 'demo');
    initDemo(dir);
    const config = loadConfig(resolve(dir, 'edge-a.json'), 'edge');
    assert.equal(config.dataDir, resolve(dir, 'edge-a-data'));
    const before = readFileSync(resolve(dir, 'hub.json'), 'utf8');
    assert.throws(() => initDemo(dir), /never overwritten/);
    assert.equal(readFileSync(resolve(dir, 'hub.json'), 'utf8'), before);
    const raw = JSON.parse(readFileSync(resolve(dir, 'client.json'), 'utf8'));
    raw.hubUrl = 'http://example.com';
    writeFileSync(resolve(dir, 'bad.json'), JSON.stringify(raw));
    assert.throws(() => loadConfig(resolve(dir, 'bad.json'), 'client'), /hubUrl/);
    const hub = JSON.parse(before);
    hub.connectors[1].allowedAgents = ['mock-a'];
    writeFileSync(resolve(dir, 'bad-hub.json'), JSON.stringify(hub));
    assert.throws(() => loadConfig(resolve(dir, 'bad-hub.json'), 'hub'), /unique/);
  } finally { temp.clean(); }
});
test('POSIX demo credentials and directory use owner-only mode bits', {skip:process.platform === 'win32' && 'Windows mode bits do not describe an owner-only ACL'}, () => {
  const temp = directory();
  try {
    const dir = resolve(temp.path, 'demo'); initDemo(dir);
    assert.equal(statSync(resolve(dir,'user.token')).mode & 0o777, 0o600);
    assert.equal(statSync(dir).mode & 0o777, 0o700);
  } finally { temp.clean(); }
});
test('Hub transactions, serial reservation and restart history are durable', () => {
  const temp = directory();
  let store = new HubStore(temp.path);
  try {
    const task = store.create('u', 'key', 'a', 'hello');
    assert.throws(() => store.create('u', 'other', 'a', 'hello'), /occupied/);
    assert.equal(store.byRequest('u', 'other'), undefined);
    store.attempted(task.taskId);
    store.acceptEvent(task.taskId, task.executionId, 1, { kind: 'accepted' });
    store.acceptEvent(task.taskId, task.executionId, 2, { kind: 'started' });
    store.acceptEvent(task.taskId, task.executionId, 3, { kind: 'completed', result: { agentId: 'a', message: 'hello' } });
    const final = store.get(task.taskId);
    store.close(); store = new HubStore(temp.path); store.recover();
    assert.deepEqual(store.get(task.taskId), final);
    assert.equal(store.events(task.taskId).length, 3);
    assert.equal(store.byRequest('u', 'key')!.taskId, task.taskId);
    assert.equal(store.active('a'), undefined);
    assert.throws(() => store.create('u', 'key', 'a', 'changed')); // unique constraint rolls back Conversation too
    const count = store.db.prepare('SELECT COUNT(*) AS n FROM conversations').get() as { n: number };
    assert.equal(count.n, 1);
  } finally { store.close(); temp.clean(); }
});
test('duplicate events, payload conflicts, illegal transitions and result target checks preserve facts', () => {
  const temp = directory(); const store = new HubStore(temp.path);
  try {
    const t = store.create('u', 'key', 'a', 'hello');
    assert.throws(() => store.acceptEvent(t.taskId, t.executionId, 1, { kind: 'started' }), /state/);
    assert.equal(store.events(t.taskId).length, 0);
    store.acceptEvent(t.taskId, t.executionId, 1, { kind: 'accepted' });
    store.acceptEvent(t.taskId, t.executionId, 1, { kind: 'accepted' });
    assert.throws(() => store.acceptEvent(t.taskId, t.executionId, 1, { kind: 'started' }), /different content/);
    store.acceptEvent(t.taskId, t.executionId, 2, { kind: 'started' });
    assert.throws(() => store.acceptEvent(t.taskId, t.executionId, 3, { kind: 'completed', result: { agentId: 'b', message: '' } }), /does not match/);
    assert.equal(store.get(t.taskId)!.status, 'running');
    const completed = { kind: 'completed' as const, result: { agentId: 'a', message: 'ok' } };
    store.acceptEvent(t.taskId, t.executionId, 3, completed);
    const before = store.get(t.taskId);
    store.acceptEvent(t.taskId, t.executionId, 3, completed);
    assert.throws(() => store.acceptEvent(t.taskId, t.executionId, 4, { kind: 'started' }), /state/);
    assert.deepEqual(store.get(t.taskId), before);
    assert.equal(store.events(t.taskId).length, 3);
  } finally { store.close(); temp.clean(); }
});
test('recovery distinguishes proven undispatched tasks and preserves unknown occupancy', () => {
  const temp = directory(); const store = new HubStore(temp.path);
  try {
    const one = store.create('u', 'one', 'a', 'pending');
    const two = store.create('u', 'two', 'b', 'attempted');
    store.attempted(two.taskId);
    store.recover();
    assert.equal(store.get(one.taskId)!.status, 'failed');
    assert.equal(store.get(one.taskId)!.error!.phase, 'before_execution');
    assert.equal(store.get(two.taskId)!.status, 'unknown');
    assert.equal(store.get(two.taskId)!.lastKnownStatus, 'queued');
    assert.equal(store.active('b')!.taskId, two.taskId);
    assert.throws(() => store.create('u', 'new', 'b', 'message'), /occupied/);
  } finally { store.close(); temp.clean(); }
});
test('bounded event and result text is marked; SQLite failure cannot save false confirmation', () => {
  const temp = directory(); const store = new HubStore(temp.path, 4);
  try {
    const t = store.create('u', 'key', 'a', '你好');
    store.acceptEvent(t.taskId, t.executionId, 1, { kind: 'accepted' });
    store.acceptEvent(t.taskId, t.executionId, 2, { kind: 'started' });
    store.acceptEvent(t.taskId, t.executionId, 3, { kind: 'output', text: '你好' });
    store.acceptEvent(t.taskId, t.executionId, 4, { kind: 'completed', result: { agentId: 'a', message: '你好' } });
    assert.equal(store.get(t.taskId)!.result!.message, '你');
    assert.equal(store.get(t.taskId)!.result!.truncated, true);
    assert.equal(store.events(t.taskId)[2]!.truncated, true);
    const previous = store.list('u');
    store.db.exec('PRAGMA query_only=ON');
    assert.throws(() => store.create('u', 'other', 'b', 'message'));
    assert.deepEqual(store.list('u'), previous);
    assert.equal(store.byRequest('u', 'other'), undefined);
  } finally { store.close(); temp.clean(); }
});
test('data lock prohibits duplicate service and newer schemas refuse startup', () => {
  const temp = directory(); const store = new HubStore(temp.path);
  try {
    assert.throws(() => new HubStore(temp.path), /already in use/);
    store.db.exec('PRAGMA user_version=2');
    store.close();
    assert.throws(() => new HubStore(temp.path), /compatible writable database/);
  } finally { store.close(); temp.clean(); }
});
test('Edge journal rejects input conflicts, duplicate invocation and replay after restart', async () => {
  const temp = directory(); let journal = new EdgeJournal(temp.path);
  try {
    const execution: Execution = { taskId: randomUUID(), executionId: randomUUID(), conversationId: randomUUID(), targetAgent: 'a', message: '$(echo literal)\n中文' };
    assert(journal.claim(execution));
    assert(!journal.claim(execution));
    assert.throws(() => journal.claim({ ...execution, message: 'changed' }), /different input/);
    journal.record(execution.executionId, { kind: 'accepted' });
    const driver = new MockDriver({ agentId: 'a', name: 'A', adapter: 'mock', mode: 'success', delayMs: 1, healthy: true }, id => journal.invoke(id));
    let seq = 1;
    for await (const event of driver.execute(execution)) seq = journal.record(execution.executionId, event);
    assert.equal(seq, 5);
    assert.equal(journal.counts()[0]!.invocations, 1);
    assert.throws(() => journal.invoke(execution.executionId), /already recorded/);
    journal.close(); journal = new EdgeJournal(temp.path);
    assert(!journal.claim(execution));
    assert.equal(journal.counts()[0]!.invocations, 1);
    journal.db.exec('PRAGMA query_only=ON');
    assert.throws(() => journal.claim({ ...execution, taskId: randomUUID(), executionId: randomUUID() }));
    assert.equal(journal.counts().length, 1);
  } finally { journal.close(); temp.clean(); }
});
test('protocol rejects unsupported versions, source spoofing and missing event shape', () => {
  const base = { ...envelope(), type: 'agent.heartbeat', payload: { agents: [] } };
  assert(wireSchema.safeParse(base).success);
  assert(!wireSchema.safeParse({ ...base, protocolVersion: 2 }).success);
  assert(!wireSchema.safeParse({ ...base, sourceUser: 'admin' }).success);
  assert(!wireSchema.safeParse({ ...envelope(), type: 'task.event', taskId: 't', executionId: 'e', payload: { seq: 1, event: { kind: 'completed' } } }).success);
});
