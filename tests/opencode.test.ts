import test from 'node:test';
import { fixture } from './native-fixture.js';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { initOpenCode, loadConfig, opencodeSchema } from '../src/config.js';
import { OpenCodeClient } from '../src/drivers/opencode-client.js';
import { OpenCodeDriver } from '../src/drivers/opencode.js';
import { EdgeJournal } from '../src/storage/edge-journal.js';
import { startHub } from '../src/hub.js';
import { startEdge } from '../src/edge.js';
import { request } from '../src/client.js';
import type { Task, TaskEvent } from '../src/core.js';


async function until(fn: () => boolean | Promise<boolean>, description: string) {
  const end = Date.now() + 10000;
  while (Date.now() < end) { if (await fn()) return; await delay(20); }
  assert.fail('Timed out: ' + description);
}
function command(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [resolve('dist/cli.js'), ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', b => { stdout += b.toString(); }); child.stderr.on('data', b => { stderr += b.toString(); });
    child.once('error', reject); const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('CLI fixture timeout')); }, 15000);
    child.once('close', code => { clearTimeout(timeout); resolveResult({ code, stdout, stderr }); });
  });
}

test('OpenCode v2 through Hub/Edge: ownership, waiting/reply, pagination, result, isolation, dedupe and restart', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'agentbridge-native-contract-')); const dir = resolve(root, 'bridge');
  const native = await fixture(root); const logs: string[] = [];
  let hub: Awaited<ReturnType<typeof startHub>> | undefined; let edge: Awaited<ReturnType<typeof startEdge>> | undefined;
  try {
    initOpenCode(dir, root);
    const edgeFile = resolve(dir, 'edge-a.json'); const raw = JSON.parse(readFileSync(edgeFile, 'utf8'));
    raw.agents[0].serverUrl = native.url; raw.agents[0].managed = false; raw.agents[0].pollMs = 50;
    writeFileSync(edgeFile, JSON.stringify(raw)); writeFileSync(resolve(dir, 'native.password'), native.password, { mode: 0o600 });
    const hc = loadConfig(resolve(dir, 'hub.json'), 'hub'); hc.port = 0;
    const otherToken = 'other-user-token-' + 'x'.repeat(32);
    hc.users.push({ id: 'other', tokenFile: 'other.token', token: otherToken, allowedAgents: ['opencode'], diagnostics: true });
    hub = await startHub(hc, s => logs.push(s));
    const client = loadConfig(resolve(dir, 'client.json'), 'client'); client.hubUrl = 'http://127.0.0.1:' + hub.port;
    const clientFile = resolve(dir, 'client.json'); const cc = JSON.parse(readFileSync(clientFile, 'utf8')); cc.hubUrl = client.hubUrl; writeFileSync(clientFile, JSON.stringify(cc));
    const ec = loadConfig(edgeFile, 'edge'); ec.hubUrl = client.hubUrl;
    edge = await startEdge(ec, s => logs.push(s));
    const agents = await request<{ items: { adapter: string; healthy: boolean; capabilities: { nativeSessions: boolean } }[] }>(client, '/v1/agents');
    assert.equal(agents.items[0]!.adapter, 'opencode'); assert(agents.items[0]!.healthy); assert(agents.items[0]!.capabilities.nativeSessions);
    const submit = (key: string, text: string) => request<Task>(client, '/v1/tasks', { requestId: key, targetAgent: 'opencode', message: text });
    const read = (id: string) => request<Task>(client, '/v1/tasks/' + id);
    const tasks = await Promise.all(Array.from({ length: 5 }, () => submit('same-key', 'analyze fixture')));
    assert.equal(new Set(tasks.map(t => t.taskId)).size, 1); const id = tasks[0]!.taskId;
    await until(async () => !!(await read(id)).waiting, 'native permission visibility');
    assert.equal(native.count(), 1);
    const active = await read(id); assert.equal(active.status, 'running'); assert(active.native);
    const otherFile = resolve(dir, 'other-client.json');
    writeFileSync(resolve(dir, 'other.token'), otherToken);
    writeFileSync(otherFile, JSON.stringify({ ...cc, tokenFile: './other.token' }));
    const forbidden = await command(['native', id, '--config', otherFile, '--permission', 'per_fixture', '--decision', 'once']);
    assert.equal(forbidden.code, 5); assert(forbidden.stderr.includes('Task not found'));
    assert.deepEqual(edge.journal.native(active.executionId), active.native);
    const waitingCli = await command(['native', id, '--config', clientFile, '--json']); assert.equal(waitingCli.code, 0, waitingCli.stderr); assert.equal(JSON.parse(waitingCli.stdout).permissions[0].id, 'per_fixture');
    const invalidReply = await command(['native', id, '--config', clientFile, '--permission', 'per_wrong', '--decision', 'once']); assert.equal(invalidReply.code, 2);
    const reply = await command(['native', id, '--config', clientFile, '--permission', 'per_fixture', '--decision', 'once']); assert.equal(reply.code, 0, reply.stderr);
    const watched = await command(['task', id, '--watch', '--config', clientFile]); assert.equal(watched.code, 0, watched.stderr);
    assert(watched.stdout.includes('Tool bash')); assert(watched.stdout.includes('passed 1 test')); assert(watched.stdout.includes('Real-shaped fixture answer: analyze fixture'));
    const first = await read(id); assert.equal(first.status, 'succeeded');
    await assert.rejects(() => submit('same-key', 'changed'), /different input/);
    const next = await submit('next-key', 'modify fixture');
    await until(async () => !!(await read(next.taskId)).waiting, 'second native waiting');
    assert.notEqual((await read(next.taskId)).native!.sessionId, first.native!.sessionId);
    assert.equal((await command(['native', next.taskId, '--config', clientFile, '--permission', 'per_fixture', '--decision', 'once'])).code, 0);
    await until(async () => (await read(next.taskId)).status === 'succeeded', 'second task complete');
    assert.equal(native.count(), 2); assert(edge.journal.counts().every(x => x.invocations === 1));
    await edge.close(); await hub.close();
    hc.port = Number(new URL(client.hubUrl).port); hub = await startHub(hc, s => logs.push(s)); edge = await startEdge(ec, s => logs.push(s));
    assert.deepEqual(await read(id), first);
    assert.equal((await submit('same-key', 'analyze fixture')).taskId, id); assert.equal(native.count(), 2);
    const fault = await submit('fault-key', 'disconnect fixture');
    await until(async () => !!(await read(fault.taskId)).waiting, 'fault task started'); native.break();
    await until(async () => (await read(fault.taskId)).status === 'unknown', 'unknown after native interruption');
    assert.equal(native.count(), 3);
    const stillConnected = await request<{ items: { online: boolean }[] }>(client, '/v1/agents');
    assert(stillConnected.items[0]!.online, 'Native interruption must not disconnect unrelated Agents');
    await edge.close();
    const retained = new EdgeJournal(ec.dataDir);
    try { assert.equal(retained.counts().find(t => t.taskId === fault.taskId)!.invocations, 1); } finally { retained.close(); }
    assert.equal((await submit('fault-key', 'disconnect fixture')).taskId, fault.taskId);
    assert(!logs.join('\n').includes(native.password));
  } finally { await edge?.close(); await hub?.close(); await native.close(); rmSync(root, { recursive: true, force: true }); }
});

test('native Driver distinguishes explicit rejection, model failure and ambiguous admission; bounds result', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'agentbridge-native-driver-')); const native = await fixture(root);
  const journal = new EdgeJournal(resolve(root, 'edge'));
  try {
    const passwordFile = resolve(root, 'password'); writeFileSync(passwordFile, native.password);
    const config = opencodeSchema.parse({ adapter: 'opencode', agentId: 'a', name: 'A', workspace: root, serverUrl: native.url, passwordFile, pollMs: 50 });
    const client = new OpenCodeClient(config); assert((await client.check()).healthy);
    native.cold(); assert.equal((await client.check()).healthy, false);
    native.cold(); assert.equal((await client.check(1000)).healthy, true);
    for (const [i, text] of ['explicit rejection', 'native failure', 'ambiguous response', 'long answer'].entries()) {
      const execution = { taskId: 'task-' + i, executionId: 'execution-' + i, conversationId: 'conversation-' + i, targetAgent: 'a', message: text };
      journal.claim(execution);
      const driver = new OpenCodeDriver(config, id => journal.invoke(id), (id, ref) => journal.bind(id, ref));
      const events: TaskEvent[] = [];
      if (text === 'ambiguous response') {
        await assert.rejects(async () => { for await (const event of driver.execute(execution)) events.push(event); }, /may still be active/);
        assert(!events.some(e => e.kind === 'completed' || e.kind === 'failed'));
      } else {
        for await (const event of driver.execute(execution)) {
          events.push(event);
          if (event.kind === 'waiting' && event.waiting) {
            const ref = journal.native(execution.executionId)!;
            await client.call('/api/session/' + ref.sessionId + '/permission/per_fixture/reply', { decision: 'once' });
          }
        }
        const last = events.at(-1)!;
        assert.equal(last.kind, text === 'long answer' ? 'completed' : 'failed');
        if (last.kind === 'completed') { assert(last.result.truncated); assert(Buffer.byteLength(last.result.message) <= 60000); }
      }
      assert.equal(journal.counts().find(x => x.executionId === execution.executionId)!.invocations, 1);
    }
    native.noModel(); assert.equal((await client.check()).healthy, false);
    writeFileSync(passwordFile, 'wrong'); await assert.rejects(() => client.check(), /HTTP 401/); assert(native.authFailures() > 0);
  } finally { journal.close(); await native.close(); rmSync(root, { recursive: true, force: true }); }
});
