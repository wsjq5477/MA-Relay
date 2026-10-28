const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { NativeCliHost } = require('../electron/native-cli-host.cjs');
const { createParser } = require('../electron/native-cli-protocols.cjs');

const inputRequired = 'Input required; detached without cancelling. Resume this session interactively.';
const retained = 'Unknown execution blocks this session; your accepted input is retained. Resume interactively to resolve the lost turn; do not resend the input.';

for (const [name, nativeCode, processCode, error] of [
  ['waiting for native approval or input', 3, 3, inputRequired],
  ['queued behind unknown work', 3, 3, retained],
  ['detached result without diagnostic text', 3, 3, undefined],
  ['detached result despite mismatched process code', 3, 1, inputRequired],
  ['detached process despite mismatched result code', 1, 3, 'native error'],
  ['detached process after an apparent successful result', 0, 3, undefined],
  ['interrupted viewer', 130, 130, undefined],
]) {
  test('Hermes ' + name + ' cannot establish a gateway terminal state', () => {
    const parser = createParser({ adapter: 'hermes' }, () => {});
    parser.accept({ type: 'result', session_id: 'original-session', exit_code: nativeCode, text: '', ...(error ? { error } : {}) });
    const result = parser.finish(processCode);
    assert.equal(result.uncertain, true);
    assert.equal(result.succeeded, false);
    assert.equal(result.sessionId, 'original-session');
  });
}

test('Hermes confirmed native failure and normal success retain their existing meanings', () => {
  for (const code of [0, 1, 2]) {
    const parser = createParser({ adapter: 'hermes' }, () => {});
    parser.accept({ type: 'result', session_id: 'original-session', exit_code: code, text: code === 0 ? 'answer' : '', ...(code ? { error: 'native failure' } : {}) });
    const result = parser.finish(code);
    assert.equal(result.uncertain, false);
    assert.equal(result.succeeded, code === 0);
  }
});

async function awaitStatus(host, taskId, expected) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const task = await host.call('ipc', { op: 'task', taskId });
    if (task.status === expected) return task;
    assert(!['failed', 'succeeded', 'cancelled'].includes(task.status), 'unexpected terminal state: ' + task.status);
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw Error('Detached viewer was not observed within 15 seconds');
}

for (const [name, error] of [['input', inputRequired], ['retained', retained], ['no-diagnostic', undefined]]) {
  test('Hermes exit 3 (' + name + ') retains the original request and controls across observer restart', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-hermes-detach-'));
    const executable = path.join(directory, 'hermes.cjs'), calls = path.join(directory, 'calls.jsonl');
    fs.writeFileSync(executable, `
const fs = require('node:fs');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', part => input += part);
process.stdin.on('end', () => {
  fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ input, args: process.argv.slice(2) }) + '\\n');
  console.log(JSON.stringify({ type: 'system', subtype: 'init', session_id: 'original-session' }));
  console.log(JSON.stringify({ type: 'result', session_id: 'original-session', exit_code: 3, text: '', error: ${JSON.stringify(error) ?? 'undefined'} }));
  process.exitCode = 3;
});
`);
    let host = new NativeCliHost({ directory, executable, adapter: 'hermes' });
    t.after(() => { host.close(); fs.rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 }); });
    const { agentId } = await host.call('connect', { workspace: directory });
    const params = { op: 'submit', agentId, requestId: 'original-request', message: 'controlled request' };
    const submitted = await host.call('ipc', params);
    const original = await awaitStatus(host, submitted.taskId, 'unknown');
    assert.equal(original.native.sessionId, 'original-session');
    assert.equal(original.error, undefined);
    assert.equal(original.finishedAt, undefined);
    assert.equal((await host.call('ipc', params)).taskId, original.taskId);
    const check = { op: 'reconcile', taskId: original.taskId, operationId: 'original-check' };
    assert.equal((await host.call('ipc', check)).state, 'unknown');
    host.close();
    host = new NativeCliHost({ directory, executable, adapter: 'hermes' });
    assert.equal((await host.call('ipc', { op: 'request', requestId: params.requestId })).status, 'unknown');
    assert.equal((await host.call('ipc', params)).taskId, original.taskId);
    assert.equal((await host.call('ipc', check)).state, 'unknown');
    await assert.rejects(host.call('ipc', { ...params, requestId: 'replacement-request' }), { code: 'AGENT_BUSY' });
    const alternate = path.join(directory, 'alternate'); fs.mkdirSync(alternate);
    const other = await host.call('connect', { workspace: alternate });
    await assert.rejects(host.call('ipc', { ...params, agentId: other.agentId, requestId: 'replacement-context' }), { code: 'AGENT_BUSY' });
    await assert.rejects(host.call('ipc', { op: 'continue', conversationId: original.conversationId, requestId: 'replacement-turn', message: 'again' }), { code: 'AGENT_BUSY' });
    await assert.rejects(host.call('ipc', { op: 'cancel', taskId: original.taskId, operationId: 'new-cancel' }), { code: 'ADAPTER_UNSUPPORTED' });
    let snapshot = await host.call('snapshot');
    assert.equal(snapshot.agents.items[0].busy, true);
    assert.equal(snapshot.conversations[0].canContinue, false);
    assert.equal(fs.readFileSync(calls, 'utf8').trim().split('\n').length, 1);
    // A controlled late event verifies that unknown remains observable. This
    // is not evidence of native gateway recovery or a new prompt submission.
    fs.appendFileSync(path.join(directory, 'runs', original.taskId, 'events.jsonl'), JSON.stringify({ kind: 'terminal', status: 'succeeded', text: 'original late result' }) + '\n');
    assert.equal((await host.call('ipc', { op: 'task', taskId: original.taskId })).status, 'succeeded');
    const receipt = await host.call('ipc', { op: 'operation', operationId: check.operationId });
    assert.equal(receipt.state, 'confirmed');
    assert.equal(receipt.data.status, 'succeeded');
    snapshot = await host.call('snapshot');
    assert.equal(snapshot.agents.items[0].busy, false);
    assert.equal(snapshot.conversations[0].canContinue, true);
    assert.equal(fs.readFileSync(calls, 'utf8').trim().split('\n').length, 1);
  });
}
