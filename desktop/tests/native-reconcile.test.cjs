const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { NativeCliHost } = require('../electron/native-cli-host.cjs');
const { CodexHost } = require('../electron/codex-host.cjs');
const { profiles } = require('../electron/native-cli-protocols.cjs');

// Persisted observations only: none of these fixtures launches a worker/CLI.
function fixture(t, adapter, operations = []) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-native-reconcile-'));
  const time = '2000-01-01T00:00:00.000Z';
  const tasks = ['unknown', 'succeeded'].map((status, index) => ({
    taskId: 'task-' + index, executionId: 'execution-' + index,
    requestId: 'request-' + index, conversationId: 'conversation-' + index,
    targetAgent: 'original-agent', status, createdAt: time, updatedAt: time,
    lastSeq: 1, offset: 0, events: [{ seq: 1, timestamp: time, event: { kind: 'accepted' } }],
  }));
  fs.writeFileSync(path.join(directory, adapter + '-state.json'), JSON.stringify({
    revision: 1, agents: [{ agentId: 'original-agent', adapter, workspace: directory }],
    tasks, requests: tasks.map(task => ({ requestId: task.requestId, taskId: task.taskId })),
    conversations: tasks.map(task => ({ conversationId: task.conversationId,
      targetAgent: task.targetAgent, lastTaskId: task.taskId, profile: profiles[adapter] })),
    operations,
  }));
  const hosts = [];
  const reopen = () => {
    const host = adapter === 'codex'
      ? new CodexHost({ directory, executable: '/unavailable/original-codex' })
      : new NativeCliHost({ directory, adapter, executable: '/unavailable/original-' + adapter });
    hosts.push(host);
    return host;
  };
  t.after(() => { for (const host of hosts) host.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  return { directory, host: reopen(), reopen, task: tasks[0], terminal: tasks[1] };
}
const input = (op, taskId = 'task-0', operationId = 'original-check') => ({ op, taskId, operationId });

for (const adapter of ['hermes', 'pi', 'dsh', 'codex']) {
  test(adapter + ' persists original reconciliation receipts across restart without releasing unknown work or replaying it', async t => {
    const f = fixture(t, adapter), params = input('reconcile');
    for (const operationId of ['', '   ', null, 42, 'x'.repeat(4097)]) {
      await assert.rejects(f.host.call('ipc', { ...params, operationId }), { code: 'INVALID_INPUT' });
    }
    const receipt = await f.host.call('ipc', params);
    assert.equal(receipt.operationId, params.operationId);
    assert.equal(receipt.taskId, f.task.taskId);
    assert.equal(receipt.kind, 'reconcile');
    assert.equal(receipt.state, 'unknown');
    assert.deepEqual(await f.host.call('ipc', input('operation')), receipt);
    assert.deepEqual(await f.host.call('ipc', params), receipt);
    const reconciliation = (await f.host.call('ipc', { op: 'task', taskId: f.task.taskId })).reconciliation;
    f.host.close();
    const reopened = f.reopen();
    assert.deepEqual(await reopened.call('ipc', input('operation')), receipt);
    assert.deepEqual(await reopened.call('ipc', params), receipt);
    assert.deepEqual((await reopened.call('ipc', { op: 'task', taskId: f.task.taskId })).reconciliation, reconciliation);
    assert.equal((await reopened.call('snapshot')).agents.items[0].busy, true);
    await assert.rejects(reopened.call('ipc', { op: 'submit', agentId: f.task.targetAgent, requestId: 'replacement', message: 'do not replay' }), { code: 'AGENT_BUSY' });
    assert.equal(fs.existsSync(path.join(f.directory, 'runs')), false);
    assert.equal(fs.existsSync(path.join(f.directory, 'runtime')), false);
    assert.equal(reopened.state.tasks.length, 2);
    assert.equal(reopened.state.requests.length, 2);
  });

  test(adapter + ' binds operation IDs to the original task and kind while an unknown check permits one original cancellation', async t => {
    const f = fixture(t, adapter);
    const receipt = await f.host.call('ipc', input('reconcile'));
    await assert.rejects(f.host.call('ipc', input('reconcile', f.terminal.taskId)), { code: 'REQUEST_CONFLICT' });
    await assert.rejects(f.host.call('ipc', input('cancel')), { code: 'REQUEST_CONFLICT' });
    await assert.rejects(f.host.call('ipc', input('operation', f.terminal.taskId)), { code: 'NOT_FOUND' });
    if (adapter === 'hermes') {
      await assert.rejects(f.host.call('ipc', input('cancel', f.task.taskId, 'original-cancel')), {code:'ADAPTER_UNSUPPORTED'});
      assert.equal(f.host.state.operations.length, 1); assert.equal((await f.host.call('snapshot')).agents.items[0].busy, true);
      return;
    }
    const cancellation = await f.host.call('ipc', input('cancel', f.task.taskId, 'original-cancel'));
    assert.equal(cancellation.kind, 'cancel');
    assert.equal(cancellation.state, 'unknown');
    assert.deepEqual(await f.host.call('ipc', input('cancel', f.task.taskId, 'original-cancel')), cancellation);
    await assert.rejects(f.host.call('ipc', input('reconcile', f.task.taskId, 'original-cancel')), { code: 'REQUEST_CONFLICT' });
    await assert.rejects(f.host.call('ipc', input('cancel', f.terminal.taskId, 'original-cancel')), { code: 'REQUEST_CONFLICT' });
    await assert.rejects(f.host.call('ipc', input('cancel', f.task.taskId, 'replacement-cancel')), { code: 'REQUEST_CLAIMED' });
    assert.deepEqual(await f.host.call('ipc', input('operation')), receipt);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.directory, 'runs', f.task.taskId, 'cancel.json'), 'utf8')), { operationId: 'original-cancel' });
    assert.equal(f.host.state.operations.length, 2);
    assert.equal((await f.host.call('snapshot')).agents.items[0].busy, true);
  });

  test(adapter + ' completes saved check and cancellation receipts only after observing the original terminal event', async t => {
    const f = fixture(t, adapter);
    await f.host.call('ipc', input('reconcile'));
    if (adapter === 'hermes') {
      f.host.state.operations.push({operationId:'original-cancel',taskId:f.task.taskId,kind:'cancel',state:'unknown'}); f.host.save();
    } else await f.host.call('ipc', input('cancel', f.task.taskId, 'original-cancel'));
    const job = path.join(f.directory, 'runs', f.task.taskId);
    fs.mkdirSync(job,{recursive:true});
    fs.writeFileSync(path.join(job, 'events.jsonl'), JSON.stringify({ kind: 'terminal', status: 'succeeded', text: 'original completion' }) + '\n');
    const check = await f.host.call('ipc', input('operation'));
    assert.equal(check.state, 'confirmed');
    assert.equal(check.kind, 'reconcile');
    assert.equal(check.data.status, 'succeeded');
    assert.match(check.data.message, /原.*终态/);
    const cancellation = await f.host.call('ipc', input('operation', f.task.taskId, 'original-cancel'));
    assert.equal(cancellation.state, 'confirmed');
    assert.equal(cancellation.kind, 'cancel');
    assert.equal(cancellation.data.status, 'succeeded');
    assert.equal((await f.host.call('ipc', { op: 'task', taskId: f.task.taskId })).status, 'succeeded');
    assert.deepEqual(await f.host.call('ipc', input('reconcile')), check);
    f.host.close();
    assert.deepEqual(await f.reopen().call('ipc', input('operation')), check);
    assert.equal(fs.existsSync(path.join(f.directory, 'runtime')), false);
  });

  test(adapter + ' preserves legacy cancellation receipts without a kind and rejects reuse for reconciliation', async t => {
    const legacy = { operationId: 'legacy-cancel', taskId: 'task-0', state: 'unknown' };
    const f = fixture(t, adapter, [legacy]);
    assert.deepEqual(await f.host.call('ipc', input('cancel', f.task.taskId, legacy.operationId)), legacy);
    assert.deepEqual(await f.host.call('ipc', input('operation', f.task.taskId, legacy.operationId)), legacy);
    await assert.rejects(f.host.call('ipc', input('reconcile', f.task.taskId, legacy.operationId)), { code: 'REQUEST_CONFLICT' });
    await assert.rejects(f.host.call('ipc', input('cancel', f.task.taskId, 'replacement-cancel')), { code: 'REQUEST_CLAIMED' });
    const check = await f.host.call('ipc', input('reconcile'));
    assert.equal(check.state, 'unknown');
    assert.equal(fs.existsSync(path.join(f.directory, 'runs')), false);
    f.host.close();
    assert.deepEqual(await f.reopen().call('ipc', input('operation', f.task.taskId, legacy.operationId)), legacy);
  });

  test(adapter + ' confirms an observed failed task without treating the check receipt as native success', async t => {
    const f = fixture(t, adapter);
    f.host.state.tasks[1].status = 'failed';
    const receipt = await f.host.call('ipc', input('reconcile', f.terminal.taskId));
    assert.equal(receipt.state, 'confirmed');
    assert.equal(receipt.data.status, 'failed');
    assert.deepEqual(await f.host.call('ipc', input('operation', f.terminal.taskId)), receipt);
    assert.equal((await f.host.call('ipc', { op: 'task', taskId: f.terminal.taskId })).status, 'failed');
    f.host.close();
    assert.deepEqual(await f.reopen().call('ipc', input('operation', f.terminal.taskId)), receipt);
    assert.equal(fs.existsSync(path.join(f.directory, 'runs')), false);
  });
}

test('Codex persists the original check receipt when strict preparation evidence confirms no dispatch', async t => {
  const f = fixture(t, 'codex'), job = path.join(f.directory, 'runs', f.task.taskId);
  fs.mkdirSync(job, { recursive: true });
  fs.writeFileSync(path.join(job, 'job.json'), JSON.stringify({ executable: '/original/codex', workspace: f.directory, message: 'original' }));
  const receipt = await f.host.call('ipc', input('reconcile'));
  assert.equal(receipt.state, 'confirmed');
  assert.equal(receipt.data.status, 'failed');
  assert.match(receipt.data.message, /没有派发/);
  assert.equal((await f.host.call('ipc', { op: 'task', taskId: f.task.taskId })).error.code, 'CODEX_START');
  assert.deepEqual(await f.host.call('ipc', input('operation')), receipt);
  f.host.close();
  const reopened = f.reopen();
  assert.deepEqual(await reopened.call('ipc', input('operation')), receipt);
  assert.deepEqual(await reopened.call('ipc', input('reconcile')), receipt);
  assert.equal((await reopened.call('snapshot')).agents.items[0].busy, false);
  assert.deepEqual(fs.readdirSync(job), ['job.json']);
});

for (const status of ['succeeded', 'failed']) {
  test('Codex preserves original ' + status + ' and its receipts when late worker events share the terminal batch', async t => {
    const f = fixture(t, 'codex');
    await f.host.call('ipc', input('reconcile'));
    await f.host.call('ipc', input('cancel', f.task.taskId, 'original-cancel'));
    const records = [
      { kind: 'terminal', status, text: 'original terminal result' },
      { kind: 'started' },
      { kind: 'output', text: 'late untrusted output' },
      { kind: 'native', sessionId: 'late-untrusted-session' },
    ];
    fs.writeFileSync(path.join(f.directory, 'runs', f.task.taskId, 'events.jsonl'), records.map(record => JSON.stringify(record)).join('\n') + '\n');
    const task = await f.host.call('ipc', { op: 'task', taskId: f.task.taskId });
    assert.equal(task.status, status);
    assert.equal(task.lastSummary, 'original terminal result');
    assert.equal(task.native, undefined);
    assert.equal(f.host.state.conversations[0].sessionId, undefined);
    assert.equal(task.events.filter(event => ['completed', 'failed'].includes(event.event.kind)).length, 1);
    assert.equal(task.events.length, 2);
    assert.equal(f.host.state.tasks[0].offset, records.length);
    if (status === 'succeeded') assert.equal(task.result.message, 'original terminal result');
    else { assert.equal(task.result, undefined); assert.equal(task.error.message, 'original terminal result'); }
    const check = await f.host.call('ipc', input('operation'));
    const cancellation = await f.host.call('ipc', input('operation', f.task.taskId, 'original-cancel'));
    for (const receipt of [check, cancellation]) {
      assert.equal(receipt.state, 'confirmed');
      assert.equal(receipt.data.status, status);
    }
    assert.match(check.data.message, /原.*终态/);
    assert.deepEqual(await f.host.call('ipc', { op: 'task', taskId: f.task.taskId }), task);
    f.host.close();
    const reopened = f.reopen();
    assert.deepEqual(await reopened.call('ipc', { op: 'task', taskId: f.task.taskId }), task);
    assert.deepEqual(await reopened.call('ipc', input('operation')), check);
    assert.deepEqual(await reopened.call('ipc', input('operation', f.task.taskId, 'original-cancel')), cancellation);
    assert.equal(reopened.state.tasks[0].offset, records.length);
    assert.equal(fs.existsSync(path.join(f.directory, 'runtime')), false);
  });
}
