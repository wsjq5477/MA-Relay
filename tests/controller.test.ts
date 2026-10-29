import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { SettingsStore } from '../src/settings.js';
import { ipc, ensureController, startController, socketPath } from '../src/controller.js';
import { fixture } from './native-fixture.js';
import type { Task } from '../src/core.js';
import type { Operation } from '../src/storage/operations.js';
import { safeTerminal } from '../src/terminal.js';
import { initOpenCode, loadConfig } from '../src/config.js';
import { HubStore } from '../src/storage/hub-store.js';

async function until<T>(fn: () => Promise<T | false>): Promise<T> {
  for (let i = 0; i < 300; i++) { const value = await fn(); if (value !== false) return value; await delay(20); }
  throw new Error('Timed out');
}
async function command(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((done, reject) => {
    const child = spawn(process.execPath, ['dist/cli.js', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; child.stdout.on('data', b => { stdout += b.toString(); }); child.stderr.on('data', b => { stderr += b.toString(); });
    child.once('error', reject); child.once('close', code => done({ code, stdout, stderr }));
  });
}
test('controller: concurrent startup, configuration conflicts, local apply, dedupe, forms and unknown resource protection', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-i03-')); const dir = resolve(root, 'bridge');
  const one = resolve(root, 'one'), two = resolve(root, 'two'); mkdirSync(one); mkdirSync(two);
  const a = await fixture(one), b = await fixture(two); const store = new SettingsStore(dir); store.initialize();
  const list = () => ipc<{ revision: number; items: { agentId: string; currentTask?: { status: string }; online: boolean; busy: boolean; enabled: boolean; verification?: { stale: boolean } }[] }>(dir, { op: 'agents' });
  const read = (taskId: string) => ipc<Task>(dir, { op: 'task', taskId });
  try {
    await Promise.all(Array.from({ length: 5 }, () => ensureController(dir)));
    const states = await Promise.all(Array.from({ length: 5 }, () => ipc<{ pid: number }>(dir, { op: 'status' })));
    assert.equal(new Set(states.map(s => s.pid)).size, 1);
    const stateAlias = resolve(root, 'state-alias'); symlinkSync(dir, stateAlias);
    await ensureController(stateAlias); assert.equal((await ipc<{ pid: number }>(stateAlias, { op: 'status' })).pid, states[0]!.pid);
    if (process.platform !== 'win32') {
      assert.equal(statSync(socketPath(dir)).mode & 0o777, 0o600);
      assert.equal(statSync(dir).mode & 0o777, 0o700);
    } else assert.match(socketPath(dir), /^\\\\\.\\pipe\\agentbridge-/);
    for (const [id, native, workspace] of [['a', a, one], ['b', b, two]] as const) {
      const passwordFile = resolve(dir, id + '.password'); writeFileSync(passwordFile, native.password, { mode: 0o600 });
      await ipc(dir, { op: 'save', expectedRevision: (await list()).revision,
        agent: { agentId: id, name: id, adapter: 'opencode', workspace, serverUrl: native.url, passwordFile, managed: false, pollMs: 50 } });
    }
    const revision = (await list()).revision;
    await assert.rejects(() => ipc(dir, { op: 'save', expectedRevision: revision - 1, agent: { agentId: 'a', name: 'old' } }), /配置已变化/);
    const alias = resolve(root, 'alias'); symlinkSync(one, alias);
    await assert.rejects(() => ipc(dir, { op: 'save', expectedRevision: revision, agent: { ...store.read().agents[0], agentId: 'alias', workspace: alias } }), /同一本机项目/);
    assert.equal((await list()).revision, revision);
    assert.equal(a.count() + b.count(), 0, 'Configuration does not prompt the model');
    await ipc(dir, { op: 'start' });
    const verified = await ipc<Task>(dir, { op: 'verify', agentId: 'a', requestId: randomUUID(), message: '只回复标记 AB_VERIFY_abcdef1234，不要执行其他动作。' });
    await until(async () => (await read(verified.taskId)).status === 'succeeded');
    assert.equal((await list()).items.find(a => a.agentId === 'a')!.verification?.stale, false);
    a.setModel('next'); await ipc(dir, { op: 'check', agentId: 'a' });
    assert.equal((await list()).items.find(a => a.agentId === 'a')!.verification?.stale, true, 'Native inherited model change invalidates prior response evidence');
    a.setModel('fixture'); await ipc(dir, { op: 'check', agentId: 'a' });
    assert.equal((await list()).items.find(a => a.agentId === 'a')!.verification?.stale, false);
    assert.equal(a.count(), 1, 'Checking inherited model change is read-only');
    const requestId = randomUUID();
    const submits = await Promise.all(Array.from({ length: 5 }, () => ipc<Task>(dir, { op: 'submit', agentId: 'b', requestId, message: 'work' })));
    assert.equal(new Set(submits.map(t => t.taskId)).size, 1);
    const task = await until(async () => { const task = await read(submits[0]!.taskId); return task.waiting ? task : false; });
    assert.equal(b.count(), 1);
    await ipc(dir, { op: 'save', expectedRevision: (await list()).revision, agent: { agentId: 'a', model: { providerID: 'offline', id: 'fixture' } } });
    assert.equal((await list()).items.find(a => a.agentId === 'a')!.verification?.stale, true);
    assert.equal((await read(task.taskId)).status, 'running', 'Other connection apply does not restart Edge');
    await assert.rejects(async () => ipc(dir, { op: 'save', expectedRevision: (await list()).revision, agent: { agentId: 'b', nativeAgent: 'other' } }), /不能更改执行配置/);
    const reply = { taskId: task.taskId, executionId: task.executionId, operationId: randomUUID(), action: 'permission' as const, requestId: 'per_fixture', decision: 'once' as const };
    const receipts = await Promise.all(Array.from({ length: 5 }, () => ipc<Operation>(dir, { op: 'reply', taskId: task.taskId, reply })));
    assert(receipts.some(r => r.state === 'confirmed')); assert.equal(b.replyCount(), 1);
    await until(async () => (await read(task.taskId)).status === 'succeeded');
    assert.equal((await ipc<Task>(dir, { op: 'request', requestId })).taskId, task.taskId);
    const form = await ipc<Task>(dir, { op: 'submit', agentId: 'a', requestId: randomUUID(), message: 'form' });
    const activeForm = await until(async () => { const task = await read(form.taskId); return task.waiting ? task : false; });
    const formReply = { taskId: form.taskId, executionId: form.executionId, action: 'form' as const, requestId: 'frm_fixture', operationId: randomUUID(), answer: { reply: 'hello' } };
    const invalidForm = { ...formReply, operationId: randomUUID(), answer: {} };
    assert.equal((await ipc<Operation>(dir, { op: 'reply', taskId: form.taskId, reply: invalidForm })).state, 'rejected');
    assert.equal(a.replyCount(), 0, 'Invalid required field must not reach native mutation');
    const mismatched = await ipc<Operation>(dir, { op: 'reply', taskId: task.taskId, reply: { ...formReply, taskId: task.taskId } }).catch(e => e);
    assert(mismatched instanceof Error);
    assert.equal((await ipc<Operation>(dir, { op: 'reply', taskId: form.taskId, reply: formReply })).state, 'confirmed');
    assert.equal(a.replyCount(), 1); assert(activeForm.native);
    await until(async () => (await read(form.taskId)).status === 'succeeded');
    const concurrent = await ipc<Task>(dir, { op: 'submit', agentId: 'a', requestId: randomUUID(), message: 'distinct operation IDs' });
    await until(async () => !!(await read(concurrent.taskId)).waiting);
    const distinctReplies = await Promise.allSettled(Array.from({ length: 5 }, () => ipc<Operation>(dir, { op: 'reply', taskId: concurrent.taskId,
      reply: { taskId: concurrent.taskId, executionId: concurrent.executionId, operationId: randomUUID(), action: 'permission', requestId: 'per_fixture', decision: 'once' } })));
    assert.equal(distinctReplies.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(a.replyCount(), 2, 'Different operation IDs competing for one pending native request cause one write');
    await until(async () => (await read(concurrent.taskId)).status === 'succeeded');
    const ambiguous = await ipc<Task>(dir, { op: 'submit', agentId: 'a', requestId: randomUUID(), message: 'ambiguous reply' });
    await until(async () => !!(await read(ambiguous.taskId)).waiting);
    a.loseReply();
    const uncertainReply = { taskId: ambiguous.taskId, executionId: ambiguous.executionId, operationId: randomUUID(), action: 'permission' as const, requestId: 'per_fixture', decision: 'once' as const };
    assert.equal((await ipc<Operation>(dir, { op: 'reply', taskId: ambiguous.taskId, reply: uncertainReply })).state, 'unknown');
    await until(async () => (await read(ambiguous.taskId)).status === 'succeeded');
    const retries = await Promise.all(Array.from({ length: 5 }, () => ipc<Operation>(dir, { op: 'reply', taskId: ambiguous.taskId, reply: uncertainReply })));
    assert(retries.every(r => r.state === 'unknown')); assert.equal(a.replyCount(), 3, 'Lost mutation response cannot authorize another native write');
    const distinct = { ...uncertainReply, operationId: randomUUID() };
    await assert.rejects(() => ipc(dir, { op: 'reply', taskId: ambiguous.taskId, reply: distinct }), /not active|已有回复/);
    const fault = await ipc<Task>(dir, { op: 'submit', agentId: 'b', requestId: randomUUID(), message: 'fault' });
    await until(async () => !!(await read(fault.taskId)).waiting); b.break();
    await until(async () => (await read(fault.taskId)).status === 'unknown');
    assert((await list()).items.find(a => a.agentId === 'a')!.online);
    await ipc(dir, { op: 'save', expectedRevision: (await list()).revision, agent: { agentId: 'b', enabled: false } });
    await ipc(dir, { op: 'default', expectedRevision: (await list()).revision, agentId: 'b' });
    await assert.rejects(() => ipc(dir, { op: 'submit', requestId: randomUUID(), message: 'no silent fallback' }), /disabled/);
    await assert.rejects(async () => ipc(dir, { op: 'save', expectedRevision: (await list()).revision, agent: { ...store.read().agents[1], agentId: 'alias-b', enabled: true } }), /该项目已有/);
    await ipc(dir, { op: 'stop' }); await until(async () => { try { await ipc(dir, { op: 'status' }); return false; } catch { return true; } });
    await ensureController(dir);
    await until(async () => (await list()).items.some(a => a.agentId === 'b' && a.currentTask?.status === 'unknown'));
    assert.equal(b.count(), 2, 'Restart never resubmits native prompt');
    const secrets = [a.password, b.password, readFileSync(resolve(dir, 'user.token'), 'utf8').trim()];
    const visible = JSON.stringify(await list()) + readFileSync(resolve(dir, 'controller.log'), 'utf8');
    assert(!secrets.some(secret => visible.includes(secret)));
  } finally {
    try { await ipc(dir, { op: 'stop' }); await delay(300); } catch { /* already stopped */ }
    await a.close(); await b.close(); rmSync(root, { recursive: true, force: true });
  }
});
test('foreign IPC server or POSIX socket-path file is never adopted, stopped or unlinked', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-foreign-')); new SettingsStore(root).initialize();
  const path = socketPath(root);
  try {
    if (process.platform !== 'win32') {
      writeFileSync(path, 'foreign file');
      await assert.rejects(() => ensureController(root), /其他文件占用/); assert.equal(readFileSync(path, 'utf8'), 'foreign file');
      unlinkSync(path);
    }
    let mutations = 0;
    const server = createServer(socket => { socket.on('data', data => { const input = JSON.parse(data.toString()) as { op: string }; if (input.op !== 'status') mutations++; socket.end(JSON.stringify({ data: { pid: 1, directory: root } }) + '\n'); }); });
    await new Promise<void>(done => server.listen(path, done)); const inode = process.platform === 'win32' ? undefined : statSync(path).ino;
    try { await assert.rejects(() => ensureController(root), /无法确认的服务/); assert(server.listening); if(inode !== undefined) assert.equal(statSync(path).ino, inode); assert.equal(mutations, 0); }
    finally { await new Promise<void>(done => server.close(() => done())); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('in-place migration preserves old identity/history/unknown without native binding and refuses live storage', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-import-')), dir = resolve(root, 'legacy'); initOpenCode(dir, root);
  const config = loadConfig(resolve(dir, 'hub.json'), 'hub'); const data = new HubStore(config.dataDir);
  data.register([{ agentId: 'opencode', name: 'Old', adapter: 'opencode', healthy: true, workspace: root, connectorId: 'edge-a', device: 'old', lastSeenAt: new Date().toISOString(), capabilities: { concurrency: 1, progress: true, cancel: false, nativeSessions: true } }]);
  const task = data.create('local-user', 'old-request', 'opencode', 'old'); data.attempted(task.taskId); data.unknown(task.taskId, 'old without binding');
  const store = new SettingsStore(dir);
  try {
    assert.throws(() => store.initialize(dir), /already in use/); assert(!store.exists()); data.close();
    const raw = JSON.parse(readFileSync(resolve(dir, 'edge-a.json'), 'utf8')); raw.futureField = { preserved: true }; writeFileSync(resolve(dir, 'edge-a.json'), JSON.stringify(raw));
    store.initialize(dir); assert.equal(store.read().agents[0]!.agentId, 'opencode'); assert.deepEqual(store.read().legacy?.edge, raw);
    const daemon = await startController(dir);
    try { const list = await ipc<{ revision: number; items: { busy: boolean; currentTask: { status: string } }[] }>(dir, { op: 'agents' }); assert(list.items[0]!.busy); assert.equal(list.items[0]!.currentTask.status, 'unknown');
      await assert.rejects(() => ipc(dir, { op: 'save', expectedRevision: list.revision, agent: { agentId: 'opencode', serverUrl: 'http://127.0.0.1:9876' } }), /不能更改执行配置/);
    } finally { await daemon.close(); }
  } finally { data.close(); rmSync(root, { recursive: true, force: true }); }
});
test('non-TTY default command is passive; terminal control sequences cannot rewrite display', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-passive-'));
  try { const result = await command(['--dir', root]); assert.equal(result.code, 0); assert(result.stdout.includes('setup')); assert(!new SettingsStore(root).exists());
    assert.equal(safeTerminal('a\x1b[2Jb\x1b]0;title\x07c\x00d'), 'abcd');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
