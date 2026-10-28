const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { NativeCliHost } = require('../electron/native-cli-host.cjs');
const { profiles } = require('../electron/native-cli-protocols.cjs');

async function settled(host, taskId) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const task = await host.call('ipc', { op: 'task', taskId });
    if (['failed', 'succeeded', 'cancelled', 'unknown'].includes(task.status)) return task;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw Error('Native start observation timed out');
}

for (const adapter of ['hermes', 'pi', 'dsh']) {
  for (const extension of ['exe', 'cmd']) {
    test(adapter + ' records a definite pre-spawn ' + extension + ' launch failure without claiming native exit or cancellation', async t => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-native-start-'));
      const executable = path.join(directory, 'missing.' + extension);
      let host = new NativeCliHost({ directory, adapter, executable }), starts = 0;
      t.after(async () => { host.close(); await fs.promises.rm(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); });
      const start = host.startWorker.bind(host);
      host.startWorker = (task, ...args) => {
        starts++;
        // Controlled persisted control intents let the production observer
        // settle original receipts against the actual launch evidence.
        for (const kind of ['cancel', 'reconcile']) host.state.operations.push({ operationId: 'original-' + kind, taskId: task.taskId, kind, state: 'unknown' });
        host.save();
        return start(task, ...args);
      };
      const { agentId } = await host.call('connect', { workspace: directory });
      const params = { op: 'submit', agentId, requestId: 'original-request', message: 'controlled request' };
      const original = await host.call('ipc', params), result = await settled(host, original.taskId);
      assert.equal(result.status, 'failed');
      assert.equal(result.error.code, 'NATIVE_START');
      assert.equal(result.native, undefined);
      assert.equal(result.result, undefined);
      assert(result.finishedAt);
      assert(!result.events.some(row => row.event.kind === 'started'));
      const cancel = await host.call('ipc', { op: 'operation', operationId: 'original-cancel' });
      assert.equal(cancel.state, 'confirmed');
      assert.equal(cancel.data.nativeExited, false);
      assert.equal(cancel.data.status, 'failed');
      const check = await host.call('ipc', { op: 'operation', operationId: 'original-reconcile' });
      assert.equal(check.state, 'confirmed');
      assert.equal(check.data.status, 'failed');
      assert.match(check.data.message, /未派发/);
      assert.equal((await host.call('snapshot')).agents.items[0].busy, false);
      assert.equal((await host.call('ipc', params)).taskId, original.taskId);
      assert.equal(starts, 1);
      host.close();
      host = new NativeCliHost({ directory, adapter, executable });
      assert.equal((await host.call('ipc', { op: 'request', requestId: params.requestId })).status, 'failed');
      assert.equal((await host.call('ipc', params)).taskId, original.taskId);
      assert.deepEqual(await host.call('ipc', { op: 'operation', operationId: 'original-cancel' }), cancel);
      assert.equal(fs.readdirSync(path.join(directory, 'runs')).length, 1);
    });
  }
}

test('a spawned Hermes viewer that loses its result stays unknown even when stderr says ENOENT', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-hermes-started-'));
  const executable = path.join(directory, 'viewer.cjs'), calls = path.join(directory, 'calls.jsonl');
  fs.writeFileSync(executable, `
const fs=require('node:fs');
process.stdin.resume();
process.stdin.on('end',()=>{
  fs.appendFileSync(${JSON.stringify(calls)},'original\\n');
  console.log(JSON.stringify({type:'system',subtype:'init',session_id:'original-session'}));
  console.error('ENOENT: native downstream lost its result');
  process.exitCode=1;
});
`);
  let host = new NativeCliHost({ directory, adapter: 'hermes', executable });
  t.after(async () => { host.close(); await fs.promises.rm(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); });
  const { agentId } = await host.call('connect', { workspace: directory });
  const params = { op: 'submit', agentId, requestId: 'original-request', message: 'controlled request' };
  const original = await host.call('ipc', params), result = await settled(host, original.taskId);
  assert.equal(result.status, 'unknown');
  assert.equal(result.native.sessionId, 'original-session');
  assert(result.events.some(row => row.event.kind === 'started'));
  assert.equal((await host.call('ipc', { op: 'reconcile', taskId: original.taskId, operationId: 'read-original' })).state, 'unknown');
  host.close(); host = new NativeCliHost({ directory, adapter: 'hermes', executable });
  assert.equal((await host.call('ipc', params)).taskId, original.taskId);
  assert.equal((await host.call('snapshot')).agents.items[0].busy, true);
  await assert.rejects(host.call('ipc', { ...params, requestId: 'replacement' }), { code: 'AGENT_BUSY' });
  assert.equal(fs.readFileSync(calls, 'utf8'), 'original\n');
});

test('historical unknown tasks cannot be cleared merely because the selected executable is now missing', async t => {
  for (const adapter of ['hermes', 'pi', 'dsh']) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-old-start-'));
    const task = { taskId: 'original-task', requestId: 'original-request', conversationId: 'original-conversation', targetAgent: 'original-agent', status: 'unknown', createdAt: '2000-01-01T00:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z', lastSeq: 0, events: [] };
    const state = { revision: 1, agents: [{ agentId: task.targetAgent, workspace: directory }], tasks: [task], conversations: [{ conversationId: task.conversationId, targetAgent: task.targetAgent, lastTaskId: task.taskId, sessionId: 'original-session', profile: profiles[adapter] }], requests: [{ requestId: task.requestId, taskId: task.taskId }], operations: [] };
    fs.writeFileSync(path.join(directory, adapter + '-state.json'), JSON.stringify(state));
    const host = new NativeCliHost({ directory, adapter, executable: path.join(directory, 'missing.exe') });
    t.after(async () => { host.close(); await fs.promises.rm(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); });
    host.startWorker = () => { throw Error('Read-only historical lookup must never launch'); };
    assert.equal((await host.call('ipc', { op: 'request', requestId: task.requestId })).status, 'unknown');
    assert.equal((await host.call('ipc', { op: 'reconcile', taskId: task.taskId, operationId: 'read-original' })).state, 'unknown');
    assert.equal((await host.call('snapshot')).agents.items[0].busy, true);
    assert.equal(fs.existsSync(path.join(directory, 'runs')), false);
  }
});
