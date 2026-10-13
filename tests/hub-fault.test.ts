import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { connect } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';
import { DatabaseSync } from 'node:sqlite';
import { initDemo, loadConfig } from '../src/config.js';
import { startHub } from '../src/hub.js';
import { startEdge } from '../src/edge.js';
import { envelope, type WireMessage } from '../src/protocol.js';
import type { Task } from '../src/core.js';

test('AC-F06-04: real Hub preserves truncated results and returns 503 on SQLite write failure', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'agentbridge-fault-'));
  const dir = resolve(root, 'demo'); initDemo(dir);
  const hubConfig = loadConfig(resolve(dir, 'hub.json'), 'hub');
  const hub = await startHub({ ...hubConfig, port: 0, maxEventBytes: 4 }, () => {});
  const url = 'http://127.0.0.1:' + hub.port;
  const edgeConfig = loadConfig(resolve(dir, 'edge-a.json'), 'edge');
  const edge = await startEdge({ ...edgeConfig, hubUrl: url, agents: edgeConfig.agents.map(a => ({ ...a, delayMs: 1 })) }, () => {});
  const token = hubConfig.users[0]!.token;
  const submit = (message: string) => fetch(url + '/v1/tasks', {
    method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ targetAgent: 'mock-a', message, requestId: randomUUID() }),
  });
  try {
    const submitted = await submit('你好');
    assert.equal(submitted.status, 202);
    const initial = await submitted.json() as Task;
    let final: Task | undefined;
    for (let i = 0; i < 100; i++) {
      const response = await fetch(url + '/v1/tasks/' + initial.taskId, { headers: { authorization: 'Bearer ' + token } });
      final = await response.json() as Task;
      if (final.status === 'succeeded') break;
      await delay(10);
    }
    assert.equal(final!.status, 'succeeded');
    assert.equal(final!.result!.message, '你');
    assert.equal(final!.result!.truncated, true);
    assert(final!.detailsTruncated);
    const beforeTasks = hub.store.list('demo-user').items.length;
    const beforeInvokes = edge.journal.counts().length;
    hub.store.db.exec('PRAGMA query_only=ON');
    const failed = await submit('must not execute');
    assert.equal(failed.status, 503);
    assert.equal((await failed.json()).error.code, 'STORAGE_UNAVAILABLE');
    assert.equal(hub.store.list('demo-user').items.length, beforeTasks);
    assert.equal(edge.journal.counts().length, beforeInvokes);
    assert.equal((await fetch(url + '/healthz')).status, 503);
  } finally {
    await edge.close(); await hub.close();
    rmSync(root, { recursive: true, force: true });
  }
});
test('AC-F06-04: Edge write failure before execution sends no false ACK or invocation', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'agentbridge-edge-fault-'));
  const dir = resolve(root, 'demo'); initDemo(dir);
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise<void>(r => server.once('listening', r));
  const messages: WireMessage[] = [];
  let peer: WebSocket | undefined;
  server.on('connection', ws => {
    peer = ws;
    ws.on('message', b => {
      const message = JSON.parse(b.toString()) as WireMessage;
      messages.push(message);
      if (message.type === 'agent.register') ws.send(JSON.stringify({
        ...envelope(), type: 'message.ack', payload: { ackedMessageId: message.messageId },
      }));
    });
  });
  const port = (server.address() as { port: number }).port;
  const config = loadConfig(resolve(dir, 'edge-a.json'), 'edge');
  const edge = await startEdge({ ...config, hubUrl: 'http://127.0.0.1:' + port }, () => {});
  try {
    edge.journal.db.exec('PRAGMA query_only=ON');
    peer!.send(JSON.stringify({ ...envelope(), messageId: 'storage-fault-submit', type: 'task.submit', payload: {
      taskId: randomUUID(), executionId: randomUUID(), conversationId: randomUUID(), targetAgent: 'mock-a', message: 'must not invoke',
    } }));
    await edge.closed;
    assert(!messages.some(m => m.type === 'message.ack' && m.payload.ackedMessageId === 'storage-fault-submit'));
    assert(!messages.some(m => m.type === 'task.event'));
    const db = new DatabaseSync(resolve(config.dataDir, 'edge.sqlite'), { readOnly: true });
    try { assert.equal((db.prepare('SELECT COUNT(*) AS n FROM executions').get() as { n: number }).n, 0); }
    finally { db.close(); }
  } finally {
    await edge.close();
    for (const client of server.clients) client.terminate();
    await new Promise<void>(r => server.close(() => r()));
    rmSync(root, { recursive: true, force: true });
  }
});
test('an interrupted HTTP upload does not disable healthy Hub storage', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'agentbridge-upload-'));
  const dir = resolve(root, 'demo'); initDemo(dir);
  const config = loadConfig(resolve(dir, 'hub.json'), 'hub');
  const hub = await startHub({ ...config, port: 0 }, () => {});
  try {
    const socket = connect(hub.port, '127.0.0.1');
    await new Promise<void>(r => socket.once('connect', r));
    socket.write('POST /v1/tasks HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer ' + config.users[0]!.token
      + '\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{');
    await delay(30); socket.destroy(); await delay(50);
    const response = await fetch('http://127.0.0.1:' + hub.port + '/healthz');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ready, true);
    assert.equal(hub.store.list(config.users[0]!.id).items.length, 0);
  } finally { await hub.close(); rmSync(root, { recursive: true, force: true }); }
});
