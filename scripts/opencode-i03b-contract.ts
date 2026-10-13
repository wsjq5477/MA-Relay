import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { opencodeSchema, parseNativeModel } from '../src/config.js';
import { startNativeServer, type NativeServerHandle } from '../src/native-server.js';
import { OpenCodeClient, type NativeMessage } from '../src/drivers/opencode-client.js';

const { values } = parseArgs({ options: { model: { type: 'string' } } });
assert(values.model, 'Pass an explicitly selected --model provider/model');
const root = mkdtempSync(resolve(tmpdir(), 'ab-i03b-contract-'));
const workspace = resolve(root, 'project'); cpSync(resolve('examples/opencode-project'), workspace, { recursive: true });
const server = createServer(); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
const port = (server.address() as { port: number }).port; await new Promise<void>(r => server.close(() => r()));
const config = opencodeSchema.parse({ agentId: 'contract', name: 'Contract', adapter: 'opencode', workspace,
  serverUrl: 'http://127.0.0.1:' + port, passwordFile: resolve(root, 'native.password'),
  executable: resolve(homedir(), '.opencode/bin/opencode'), model: parseNativeModel(values.model), pollMs: 100 });
const native = new OpenCodeClient(config); let handle: NativeServerHandle | undefined;
const report: Record<string, unknown> = { date: new Date().toISOString(), kind: 'real-installed-native-contract', status: 'running', model: values.model, workspace };
const rounds: unknown[] = []; report.rounds = rounds;
const id = (prefix: string) => prefix + randomUUID().replaceAll('-', '');
async function until<T>(fn: () => Promise<T | false>): Promise<T> {
  const end = Date.now() + 90000; while (Date.now() < end) { const r = await fn(); if (r !== false) return r; await delay(150); } throw new Error('Native evidence timeout');
}
function clean(messages: NativeMessage[]) { return messages.map(m => ({ id: m.id, type: m.type, text: m.text, outcome: m.outcome, time: m.time, content: m.content, error: m.error })); }
try {
  handle = await startNativeServer(config); report.check = await native.check(3000);
  const sessionId = id('ses_'); const marker = 'AB_CONTEXT_' + randomUUID().slice(0, 8);
  await native.call('/api/session', { id: sessionId, title: 'I03B contract', agent: 'build', location: { directory: workspace }, model: config.model, permissions: [{ action: '*', resource: '*', effect: 'deny' }] });
  const prompts = [
    'Remember this unique value for later turns: ' + marker + '. Reply with this value only. Do not use any tools.',
    'What was the unique value in my previous message? Reply with it only. Do not use any tools.',
    'Reply with the unique value from our first turn followed by the suffix :THREE. Do not use any tools.',
  ];
  for (const [i, text] of prompts.entries()) {
    const messageId = id('msg_'); await native.call('/api/session/' + sessionId + '/prompt', { id: messageId, text });
    const messages = await until(async () => {
      const all = await native.messages(sessionId); const turn = all.slice(all.findIndex(m => m.id === messageId));
      return turn.some(m => m.type === 'idle') ? all : false;
    });
    const turn = messages.slice(messages.findIndex(m => m.id === messageId));
    const answer = turn.filter(m => m.type === 'assistant').flatMap(m => m.content || []).filter(p => p.type === 'text').map(p => p.text || '').join('\n');
    assert(answer.includes(marker)); assert.equal(turn.findLast(m => m.type === 'idle')?.outcome, 'succeeded');
    assert(!turn.some(m => m.content?.some(p => p.type === 'tool')));
    rounds.push({ turn: i + 1, sessionId, messageId, answer, messages: clean(turn), session: await native.session(sessionId) });
    console.log('Native turn ' + (i + 1) + ' passed');
  }
  const idleReceipt = await native.call<{ interrupted: boolean }>('/api/session/' + sessionId + '/interrupt?resume=false', {});
  assert.equal(idleReceipt.interrupted, false); report.idleInterrupt = idleReceipt;
  const cancelSession = id('ses_'), cancelMessage = id('msg_');
  await native.call('/api/session', { id: cancelSession, title: 'I03B cancellation contract', agent: 'build', location: { directory: workspace }, model: config.model, permissions: [{ action: 'edit', resource: '*', effect: 'ask' }] });
  await native.call('/api/session/' + cancelSession + '/prompt', { id: cancelMessage, text: 'Read src/calculator.js, then use only the edit tool to append // I03B isolated contract. Do not use shell or other mutation tools. Do not bypass a permission request.' });
  const waiting = await until(async () => { const w = await native.waiting(cancelSession); return w.permissions.length ? w : false; }); report.permissionBeforeInterrupt = waiting;
  const receipt = await native.call<{ interrupted: boolean }>('/api/session/' + cancelSession + '/interrupt?resume=false', {});
  assert.equal(receipt.interrupted, true); report.activeInterrupt = receipt;
  const interrupted = await until(async () => { const m = await native.messages(cancelSession); return m.findLast(x => x.type === 'idle')?.outcome === 'interrupted' ? m : false; });
  report.interruptedMessages = clean(interrupted); report.waitingAfterInterrupt = await native.waiting(cancelSession);
  const nextId = id('msg_'); await native.call('/api/session/' + cancelSession + '/prompt', { id: nextId, text: 'Reply only AB_AFTER_CANCEL. Do not use tools.' });
  await until(async () => { const m = await native.messages(cancelSession); return m.slice(m.findIndex(x => x.id === nextId)).some(x => x.type === 'idle' && x.outcome === 'succeeded') ? m : false; });
  report.continueAfterCancel = true;
  const before = await native.messages(sessionId); await handle.close(); handle = await startNativeServer(config);
  const after = await native.messages(sessionId); assert.deepEqual(after, before); report.restartPersistsMessages = true;
  report.sessionAfterRestart = await native.session(sessionId); report.status = 'passed';
} catch (e) { report.status = 'failed'; report.error = e instanceof Error ? e.message : String(e); throw e; }
finally { await handle?.close(); mkdirSync('artifacts', { recursive: true }); writeFileSync('artifacts/I03B-native-contract.json', JSON.stringify(report, null, 2) + '\n'); }
