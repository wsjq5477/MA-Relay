// Harness safeguards only: these tests never construct a host or start a model.
const test = require('node:test');
const assert = require('node:assert/strict');
const { plan, deniedTools, reference, documentRevision, inspectArtifact, once, transientObservation, validateContinuation } = require('./linux-i07c-native-members.cjs');

test('native-member plan declares controlled topology and denies native filesystem/terminal tools', () => {
  assert.equal(plan.realModelStarted, false);
  assert.match(plan.topology, /controlled machine routing on one WSL host/);
  assert.equal(plan.nativeRoles.length, 3);
  for (const name of ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Agent', 'Task']) assert(deniedTools.includes(name));
});

test('an uncertain prepared operation cannot be dispatched again when receipt is absent', async () => {
  const params = { operationId: 'stable-original', runId: 'original-run' };
  const checkpoint = { operations: { 'stable-original': { method: 'configureAutomation', params } } };
  let writes = 0, mutations = 0;
  await assert.rejects(once(checkpoint, () => { writes++; }, async method => {
    if (method !== 'team.operation') mutations++;
    return { state: 'not_found' };
  }, 'configureAutomation', params), { code: 'PROBE_ORIGINAL_UNRESOLVED' });
  assert.equal(writes, 0); assert.equal(mutations, 0);
});

test('a first mutation writes its checkpoint before dispatch and a confirmed recovery only queries', async () => {
  const checkpoint = { operations: {} }, params = { operationId: 'stable-original', message: 'same-input' };
  const calls = [];
  const result = await once(checkpoint, () => calls.push('checkpoint'), async method => {
    calls.push(method);
    return method === 'team.operation' ? { state: 'not_found' } : { enabled: true };
  }, 'configureAutomation', params);
  assert.equal(result.enabled, true);
  assert.deepEqual(calls, ['team.operation', 'checkpoint', 'team.configureAutomation', 'checkpoint']);
  calls.length = 0;
  assert.deepEqual(await once(checkpoint, () => calls.push('checkpoint'), async method => {
    calls.push(method); return { state: 'confirmed', data: result };
  }, 'configureAutomation', params), result);
  assert.deepEqual(calls, ['team.operation']);
});

test('a stable operation cannot be reused for a different message', async () => {
  const checkpoint = { operations: { original: { method: 'postMessage', params: { operationId: 'original', message: 'before' } } } };
  let queried = false;
  await assert.rejects(once(checkpoint, () => {}, async () => { queried = true; }, 'postMessage', { operationId: 'original', message: 'after' }), { code: 'PROBE_OPERATION_CONFLICT' });
  assert.equal(queried, false);
});

test('verification reads the exact immutable revision and independently rejects an incorrect artifact', () => {
  const ref = reference('team-document:private-document:1');
  const correct = { inputs: [3, 5, 8], squares: [9, 25, 64], sum: 98, explanation: '先分别计算平方，然后将三项相加。' };
  const document = { revision: 2, history: [{ revision: 1, content: JSON.stringify(correct) }, { revision: 2, content: JSON.stringify({ ...correct, sum: 0 }) }] };
  inspectArtifact(documentRevision(document, ref.revision));
  assert.throws(() => inspectArtifact(documentRevision(document, 2)));
  assert.throws(() => documentRevision(document, 3), { code: 'PROBE_DOCUMENT_REVISION' });
  for (const invalid of ['team-document:x:0', 'team-document:x:1:extra', 'https://example.invalid/1', 'team-document:x:9007199254740992']) assert.throws(() => reference(invalid), { code: 'PROBE_DOCUMENT_REFERENCE' });
});

function continuationFixture() {
  const params = { operationId: 'enable-automation', runId: 'original-run', enabled: true, agentIds: ['leader', 'developer', 'verifier'], maxActivations: 8, maxMinutes: 12, idleMinutes: 120 };
  const policy = { ...params, used: 3, startedAt: '2026-10-18T10:00:00.000Z', generation: 1 };
  const checkpoint = { schema: 1, phase: 'enabled', runId: params.runId, operations: { 'enable-automation': { method: 'configureAutomation', params, confirmed: true } } };
  const run = { runId: params.runId, state: 'active', automation: { ...policy } };
  const audit = { state: { runs: [run], attempts: [{ runId: params.runId, state: 'unknown' }] }, receipts: [{ actor: 'user', operation: 'enable-automation', result: { policy: { ...policy } } }] };
  return { checkpoint, audit, run };
}

test('continuation admits only the original confirmed enabled policy, retaining usage and unknown occupancy', () => {
  const { checkpoint, audit, run } = continuationFixture();
  const before = JSON.stringify({ checkpoint, audit });
  assert.equal(validateContinuation(checkpoint, audit), run);
  assert.equal(run.automation.used, 3);
  assert.equal(audit.state.attempts[0].state, 'unknown');
  assert.equal(JSON.stringify({ checkpoint, audit }), before);
});

test('continuation rejects incomplete setup, absent receipt, changed budgets and terminal/permission faults', () => {
  for (const change of [
    f => { f.checkpoint.phase = 'arming'; },
    f => { f.checkpoint.operations['enable-automation'].confirmed = false; },
    f => { f.audit.receipts = []; },
    f => { f.run.automation.maxActivations = 9; },
    f => { f.run.automation.generation = 2; },
    f => { f.audit.state.attempts[0].state = 'failed'; },
    f => { f.audit.state.attempts[0].waiting = { kind: 'permission' }; },
  ]) {
    const fixture = continuationFixture(); change(fixture);
    assert.throws(() => validateContinuation(fixture.checkpoint, fixture.audit), error => /^PROBE_CONTINUE_/.test(error.code));
  }
});

test('missing original receipts and transient transports remain observations without classifying identity faults as retries', () => {
  for (const code of ['NOT_FOUND', 'NOT_CONFIGURED', 'REQUEST_NOT_FOUND', 'RPC_TIMEOUT', 'MACHINE_OFFLINE', 'ECONNRESET']) assert.equal(transientObservation(code), true);
  for (const code of ['WRONG_MACHINE', 'TEAM_FORBIDDEN', 'PROBE_NATIVE_IDENTITY', 'INVALID_INPUT']) assert.equal(transientObservation(code), false);
});
