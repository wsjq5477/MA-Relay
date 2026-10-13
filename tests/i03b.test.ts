import test from 'node:test';
import { WebSocket, WebSocketServer } from 'ws';
import type { WireMessage } from '../src/protocol.js';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { initOpenCode, loadConfig } from '../src/config.js';
import { startHub } from '../src/hub.js';
import { startEdge } from '../src/edge.js';
import { request } from '../src/client.js';
import { terminal, type Task, type Conversation } from '../src/core.js';
import { OpenCodeDriver } from '../src/drivers/opencode.js';
import { continuousFixture } from './i03b-fixture.js';
import type { Operation } from '../src/storage/operations.js';

async function until<T>(fn: () => Promise<T | false> | T | false): Promise<T> {
  const end = Date.now() + 10000;
  while (Date.now() < end) { const value = await fn(); if (value !== false) return value; await delay(20); }
  throw new Error('I03B evidence timeout');
}
async function harness() {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-i03b-fixture-')); const dir = resolve(root, 'bridge');
  const native = await continuousFixture(root); initOpenCode(dir, root);
  const edgePath = resolve(dir, 'edge-a.json'); const raw = JSON.parse(readFileSync(edgePath, 'utf8'));
  raw.agents[0].serverUrl = native.url; raw.agents[0].managed = false; raw.agents[0].pollMs = 50;
  writeFileSync(edgePath, JSON.stringify(raw)); writeFileSync(resolve(dir, 'native.password'), native.password, { mode: 0o600 });
  const hc = loadConfig(resolve(dir, 'hub.json'), 'hub'); hc.port = 0;
  hc.users.push({ id: 'foreign', token: 'f'.repeat(40), tokenFile: 'foreign', diagnostics: true, allowedAgents: ['opencode'] });
  let hub = await startHub(hc, () => {}); hc.port = hub.port;
  const client = loadConfig(resolve(dir, 'client.json'), 'client'); client.hubUrl = 'http://127.0.0.1:' + hub.port;
  const ec = loadConfig(edgePath, 'edge'); ec.hubUrl = client.hubUrl; ec.heartbeatMs = 100;
  let edge = await startEdge(ec, () => {});
  const read = (taskId: string) => request<Task>(client, '/v1/tasks/' + taskId);
  const submit = (message: string, conversationId?: string, requestId = randomUUID()) => request<Task>(client, '/v1/tasks', { message, conversationId, requestId, targetAgent: 'opencode' });
  const active = (task: Task) => until(async () => { const t = await read(task.taskId); return t.native && t.status === 'running' && native.sessions.get(t.native.sessionId)?.active === t.native.messageId ? t : false; });
  const finish = (task: Task) => until(async () => { const t = await read(task.taskId); return terminal(t.status) ? t : false; });
  const cancel = (task: Task, operationId = randomUUID()) => request<Operation>(client, '/v1/tasks/' + task.taskId + '/cancel', { taskId: task.taskId, executionId: task.executionId, action: 'cancel', operationId });
  return { root, native, client, ec, read, submit, active, finish, cancel, get hub() { return hub; }, get edge() { return edge; },
    async restartHub(during?: () => Promise<void> | void) { await hub.close(); await during?.(); hub = await startHub(hc, () => {}); },
    async rebuildEdge(during?: () => Promise<void> | void) { await edge.close(); await during?.(); edge = await startEdge(ec, () => {}); },
    async close() { await edge.close(); await hub.close(); await native.close(); rmSync(root, { recursive: true, force: true }); } };
}

test('B01: three turns use one Session, isolate answers, preserve owner/config and dedupe', async () => {
  const h = await harness();
  try {
    const first = await h.finish(await h.submit('finish first'));
    const key = randomUUID(); const duplicates = await Promise.all(Array.from({ length: 5 }, () => h.submit('finish second', first.conversationId, key)));
    assert.equal(new Set(duplicates.map(t => t.taskId)).size, 1);
    const second = await h.finish(duplicates[0]!); const third = await h.finish(await h.submit('finish third', first.conversationId));
    assert.equal(first.native!.sessionId, second.native!.sessionId); assert.equal(first.native!.sessionId, third.native!.sessionId);
    assert.equal(second.result!.message, 'finish second'); assert.equal(third.result!.message, 'finish third');
    assert.deepEqual([first.turn, second.turn, third.turn], [1, 2, 3]);
    assert.deepEqual(h.native.counters(), { prompts: 3, creates: 1, interrupts: 0, replies: 0 });
    const c = await request<Conversation & { items: Task[] }>(h.client, '/v1/conversations/' + first.conversationId); assert.equal(c.items.length, 3); assert.equal(c.native!.messageId, third.native!.messageId);
    const foreign = { ...h.client, token: 'f'.repeat(40) }; await assert.rejects(() => request(foreign, '/v1/conversations/' + c.conversationId), /不存在/);
    await assert.rejects(() => h.submit('changed input', c.conversationId, key), /different input/);
    const config = h.ec.agents[0]!; assert(config.adapter === 'opencode');
    const driver = new OpenCodeDriver(config, () => assert.fail('Read-only historical inspection must not invoke'), () => assert.fail());
    const historical = await driver.inspect(first.native!); assert.equal(historical.outcome, 'succeeded'); assert.equal(historical.hasLaterInput, true);
    assert.equal(historical.turn.filter(m => m.type === 'assistant')[0]!.content![0]!.text, 'finish first');
    await h.edge.apply([{ ...config, nativeAgent: 'other' }]);
    await assert.rejects(() => h.submit('finish forbidden', c.conversationId), /配置已变化/);
    assert.equal(h.native.counters().prompts, 3);
  } finally { await h.close(); }
});

test('B02: cancel once across duplicate IDs, lost response and completion race', async () => {
  const h = await harness();
  try {
    const task = await h.active(await h.submit('wait for permission'));
    await assert.rejects(() => h.submit('concurrent turn', task.conversationId), /occupied/);
    const id = randomUUID(); const receipts = await Promise.all(Array.from({ length: 5 }, () => h.cancel(task, id)));
    assert(receipts.some(r => r.state === 'confirmed')); assert.equal(h.native.counters().interrupts, 1);
    assert.equal((await h.finish(task)).status, 'cancelled');
    await assert.rejects(() => h.cancel(task), /已结束/); assert.equal(h.native.counters().interrupts, 1);
    const continued = await h.finish(await h.submit('finish after cancellation', task.conversationId)); assert.equal(continued.native!.sessionId, task.native!.sessionId);
    const lost = await h.active(await h.submit('running lost response')); h.native.loseCancel(); const lostId = randomUUID();
    assert.equal((await h.cancel(lost, lostId)).state, 'unknown'); assert.equal((await h.finish(lost)).status, 'cancelled');
    const repeats = await Promise.all(Array.from({ length: 5 }, () => h.cancel(lost, lostId))); assert(repeats.every(r => r.state === 'unknown')); assert.equal(h.native.counters().interrupts, 2);
    const racing = await h.active(await h.submit('running completion race')); h.native.race(); await h.cancel(racing);
    const raced = await h.finish(racing); assert.equal(raced.status, 'succeeded'); assert.equal(raced.result!.message, 'won completion race');
    const competing = await h.active(await h.submit('wait competing cancel IDs'));
    await Promise.allSettled(Array.from({ length: 5 }, () => h.cancel(competing)));
    assert.equal((await h.finish(competing)).status, 'cancelled'); assert.equal(h.native.counters().interrupts, 4);
  } finally { await h.close(); }
});

test('B03: Hub restart preserves observation and replays durable events without a new Prompt', async () => {
  const h = await harness();
  try {
    const task = await h.active(await h.submit('running over Hub restart'));
    const start = Date.now();
    await h.restartHub(async () => {
      h.native.finish(task.native!.sessionId, 'succeeded', 'completed while transport offline');
      await until(() => h.edge.journal.outbox().some(e => e.event.kind === 'completed'));
    });
    const result = await h.finish(task); assert.equal(result.result!.message, 'completed while transport offline'); assert(Date.now() - start < 10000);
    await until(() => h.edge.journal.outbox().length === 0);
    const events = h.hub.store.events(task.taskId); assert.deepEqual(events.map(e => e.seq), Array.from({ length: events.length }, (_, i) => i + 1));
    assert.equal(h.edge.journal.counts()[0]!.invocations, 1); assert.equal(h.native.counters().prompts, 1);
  } finally { await h.close(); }
});

test('B04: Edge rebuild restores waiting and completed original executions using reads only', async () => {
  const h = await harness();
  try {
    const task = await h.active(await h.submit('wait Edge rebuild'));
    await h.rebuildEdge();
    await until(async () => { const t = await h.read(task.taskId); return t.status === 'running' && !!t.waiting; });
    assert.equal(h.native.counters().prompts, 1); assert.equal(h.native.counters().replies, 0);
    await h.rebuildEdge(() => h.native.finish(task.native!.sessionId, 'failed'));
    assert.equal((await h.finish(task)).status, 'failed'); assert.equal(h.native.counters().prompts, 1);
    const complete = await h.active(await h.submit('running complete while Edge down'));
    await h.rebuildEdge(() => h.native.finish(complete.native!.sessionId, 'succeeded', 'original recovered answer'));
    assert.equal((await h.finish(complete)).result!.message, 'original recovered answer'); assert.equal(h.native.counters().prompts, 2);
    const interrupted = await h.active(await h.submit('running interrupted while Edge down'));
    await h.rebuildEdge(() => h.native.finish(interrupted.native!.sessionId, 'interrupted'));
    assert.equal((await h.finish(interrupted)).status, 'cancelled'); assert.equal(h.native.counters().interrupts, 0);
  } finally { await h.close(); }
});

test('B04: missing input, foreign steering and configuration mismatch retain unknown occupancy', async () => {
  const h = await harness();
  try {
    const task = await h.active(await h.submit('running corrupt identity'));
    const session = h.native.sessions.get(task.native!.sessionId)!;
    session.messages = []; await until(async () => (await h.read(task.taskId)).status === 'unknown');
    await assert.rejects(() => request(h.client, '/v1/tasks/' + task.taskId + '/reconcile', { taskId: task.taskId, executionId: task.executionId, operationId: randomUUID(), action: 'reconcile' }), /原输入/);
    await assert.rejects(() => h.submit('do not bypass unknown'), /occupied/); assert.equal(h.native.counters().prompts, 1);
    session.messages = [{ id: task.native!.messageId, type: 'user' }, { id: 'foreign_input', type: 'user' }];
    const config = h.ec.agents[0]!; assert(config.adapter === 'opencode'); const driver = new OpenCodeDriver(config, () => assert.fail(), () => assert.fail());
    await assert.rejects(() => driver.inspect(task.native!), /其他输入/);
    await assert.rejects(() => driver.inspect({ ...task.native!, workspace: '/tmp/foreign' }), /身份不匹配/);
    assert.equal(h.hub.store.occupied('opencode')?.taskId, task.taskId);
    assert.deepEqual(h.native.counters(), { prompts: 1, creates: 1, interrupts: 0, replies: 0 });
  } finally { await h.close(); }
});

test('B03: an ACK lost after Hub persistence replays the same seq once without invoking again', async () => {
  const h = await harness(); const proxy = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise<void>(r => proxy.once('listening', r));
  let cut = false; let lostId: string | undefined; let repeats = 0;
  proxy.on('connection', socket => {
    const upstream = new WebSocket(new URL('/v1/connectors/ws', h.client.hubUrl).href.replace('http:', 'ws:'), { headers: { authorization: 'Bearer ' + h.ec.token, 'x-connector-id': h.ec.connectorId } });
    const queued: string[] = [];
    upstream.on('open', () => { for (const b of queued) upstream.send(b); queued.length = 0; });
    socket.on('message', b => {
      const message = JSON.parse(b.toString()) as WireMessage;
      if (message.type === 'task.event' && message.payload.seq === 1) { repeats++; if (!cut) lostId = message.messageId; }
      if (upstream.readyState === WebSocket.OPEN) upstream.send(b.toString()); else queued.push(b.toString());
    });
    upstream.on('message', b => {
      const message = JSON.parse(b.toString()) as WireMessage;
      if (!cut && message.type === 'message.ack' && message.payload.ackedMessageId === lostId) { cut = true; socket.terminate(); upstream.terminate(); return; }
      if (socket.readyState === WebSocket.OPEN) socket.send(b.toString());
    });
    upstream.on('error', () => socket.terminate()); socket.on('error', () => {});
    upstream.on('close', () => socket.terminate()); socket.on('close', () => upstream.terminate());
  });
  try {
    h.ec.hubUrl = 'http://127.0.0.1:' + (proxy.address() as { port: number }).port; await h.rebuildEdge();
    const task = await h.finish(await h.submit('finish lost ACK'));
    assert.equal(task.status, 'succeeded'); assert(cut); assert.equal(repeats, 2);
    const events = h.hub.store.events(task.taskId); assert.equal(events.filter(e => e.seq === 1).length, 1);
    assert.equal(h.native.counters().prompts, 1); assert.equal(h.edge.journal.counts()[0]!.invocations, 1);
    await until(() => h.edge.journal.outbox().length === 0);
  } finally { await h.close(); for (const c of proxy.clients) c.terminate(); await new Promise<void>(r => proxy.close(() => r())); }
});
