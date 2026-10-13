import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { SettingsStore } from '../src/settings.js';
import { ipc, ensureController } from '../src/controller.js';
import { OpenCodeClient } from '../src/drivers/opencode-client.js';
import { parseNativeModel } from '../src/config.js';
import { terminal, type Task, type Conversation } from '../src/core.js';
import { safeTerminal } from '../src/terminal.js';

const { values } = parseArgs({ options: { model: { type: 'string' }, 'timeout-ms': { type: 'string' } } });
assert(values.model, 'Pass --model provider/model explicitly');
const limit = Number(values['timeout-ms'] || 90000); const executable = resolve(homedir(), '.opencode/bin/opencode');
const root = mkdtempSync(resolve(tmpdir(), 'ab-i03b-real-')), dir = resolve(root, 'bridge'), workspace = resolve(root, 'project');
cpSync('examples/opencode-project', workspace, { recursive: true }); const store = new SettingsStore(dir);
const report: Record<string, unknown> = { date: new Date().toISOString(), kind: 'I03B-real-CLI-native-acceptance', status: 'running', model: values.model, checks: {}, tasks: [] };
const checks = report.checks as Record<string, unknown>; const tasks = report.tasks as Task[]; const transcripts: string[] = [];
class Tty {
  all = ''; buffer = ''; lines = ''; code?: number;
  child = spawn('python3', [resolve('scripts/pty-driver.py'), process.execPath, '--disable-warning=ExperimentalWarning', resolve('dist/cli.js'), '--dir', dir], { cwd: workspace, env: { ...process.env, PATH: dirname(executable) + ':' + process.env.PATH }, stdio: ['pipe', 'pipe', 'pipe'] });
  constructor() {
    this.child.stdout.on('data', b => {
      this.lines += b.toString(); let end: number;
      while ((end = this.lines.indexOf('\n')) >= 0) { const item = JSON.parse(this.lines.slice(0, end)) as { output?: string; exit?: number }; this.lines = this.lines.slice(end + 1);
        if (item.output) { const text = safeTerminal(item.output); this.all += text; this.buffer += text; } if (item.exit !== undefined) this.code = item.exit; }
    });
    this.child.stderr.on('data', b => { this.all += safeTerminal(b.toString()); });
  }
  keys(text: string) { this.child.stdin.write(JSON.stringify({ send: text }) + '\n'); }
  action(value: string) { this.keys('\x1b[B'.repeat(['7', '8', '1', '5', '6', '4', '3', '2', '9', '10', '0'].indexOf(value)) + '\r'); }
  async expect(needle: string, response?: string) {
    const end = Date.now() + limit; while (Date.now() < end) {
      const at = this.buffer.indexOf(needle); if (at >= 0) { this.buffer = this.buffer.slice(at + needle.length); if (response !== undefined) this.keys(response + '\r'); return Date.now(); }
      if (this.code !== undefined) throw new Error('TTY exited ' + this.code + ' before ' + needle); await delay(20);
    } throw new Error('TTY timed out before ' + needle);
  }
  async exit() { this.action('0'); await until(() => this.code === 0); transcripts.push(this.all); this.child.stdin.end(); }
}
let tty: Tty | undefined;
async function until<T>(fn: () => Promise<T | false> | T | false): Promise<T> {
  const end = Date.now() + limit; while (Date.now() < end) { const r = await fn(); if (r !== false) return r; await delay(50); } throw new Error('Real evidence timed out');
}
function digest(directory: string): string {
  const h = createHash('sha256'); const visit = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const path = resolve(d, e.name); if (e.isDirectory()) visit(path); else h.update(path.slice(directory.length)).update(readFileSync(path)); } }; visit(directory); return h.digest('hex');
}
async function command(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((done, reject) => {
    const child = spawn(process.execPath, [resolve('dist/cli.js'), ...args, '--dir', dir], { cwd: workspace, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('CLI command timeout')); }, limit);
    child.stdout.on('data', b => { stdout += b.toString(); }); child.stderr.on('data', b => { stderr += b.toString(); }); child.once('error', reject); child.once('close', code => { clearTimeout(timer); done({ code, stdout, stderr }); });
  });
}
const read = (taskId: string) => ipc<Task>(dir, { op: 'task', taskId });
const done = (task: Task) => until(async () => { const t = await read(task.taskId); return terminal(t.status) ? t : false; });
async function latest(previous: number) { return until(async () => { const p = await ipc<{ items: Task[] }>(dir, { op: 'tasks' }); return p.items.length > previous ? p.items.at(-1)! : false; }); }
async function enterLatest() { tty!.action('10'); await tty!.expect('◆  选择会话'); tty!.keys('\r'); await tty!.expect('◆  会话操作'); }
async function backConversation(terminalTask: boolean) { tty!.keys('\x1b[B'.repeat(terminalTask ? 2 : 4) + '\r'); await tty!.expect('◆  下一步'); }
async function submitCommand(message: string): Promise<Task> { const r = await command(['run', message, '--json']); assert.equal(r.code, 0, r.stderr); return JSON.parse(r.stdout) as Task; }
try {
  report.sourceHash = digest(resolve('src')); const filesBefore = digest(workspace);
  tty = new Tty(); await tty.expect('选择要连接的 Agent'); tty.keys(' \r'); await tty.expect('✓ 已连接'); await tty.expect('◆  下一步');
  const a = store.read().agents[0]!; await ipc(dir, { op: 'save', expectedRevision: store.read().revision, agent: { agentId: a.agentId, model: parseNativeModel(values.model) } });
  const native = new OpenCodeClient(store.read().agents[0]!); report.native = await native.check();
  const marker = 'AB_I03B_' + randomUUID().slice(0, 8);
  tty.action('7'); await tty.expect('◆  任务需求', '请记住值 ' + marker + '，仅回复这个值，不调用任何工具。'); await tty.expect('◆  下一步');
  const first = await done(await latest(0)); assert.equal(first.status, 'succeeded'); assert(first.result!.message.includes(marker)); tasks.push(first);
  await enterLatest();
  for (const [i, message] of ['上一轮我让你记住的值是什么？仅回复该值，不调用工具。', '仅回复首轮记住的值加 :THREE，不调用工具。'].entries()) {
    tty.keys('\r'); await tty.expect('◆  继续追问', message); await tty.expect('◆  会话操作');
    const t = await done(await latest(i + 1)); assert.equal(t.status, 'succeeded'); assert.equal(t.native!.sessionId, first.native!.sessionId); assert(t.result!.message.includes(marker)); tasks.push(t);
  }
  assert.equal(tasks[2]!.result!.message.trim(), marker + ':THREE'); await backConversation(true);
  const beforeReenter = await native.messages(first.native!.sessionId); await tty.exit(); tty = new Tty(); await tty.expect('◆  下一步');
  assert.deepEqual(await native.messages(first.native!.sessionId), beforeReenter); checks.threeRealTurns = { sessionId: first.native!.sessionId, tasks: tasks.map(t => t.taskId), context: marker, prompts: 3, isolatedLastAnswer: tasks[2]!.result!.message };
  checks.normalReentryAdditionalPrompts = 0;
  // Running cancellation before a model can finish; no tools or user project data are involved.
  const running = await submitCommand('不要调用任何工具。从 1 开始逐行输出到 5000，每行一个数字。');
  const active = await until(async () => { const t = await read(running.taskId); if (!t.native) return false; let m; try { m = await native.messages(t.native.sessionId); } catch (e) { if ((e as { code?: string }).code === 'OPENCODE_HTTP_404') return false; throw e; } return m.some(x => x.id === t.native!.messageId) && !m.some(x => x.type === 'idle') ? t : false; });
  await enterLatest(); tty.keys('\x1b[B\r'); await tty.expect('取消收据：已确认'); await tty.expect('◆  会话操作');
  const cancelled = await done(active); assert.equal(cancelled.status, 'cancelled'); tasks.push(cancelled); await backConversation(true); checks.realRunningCancellation = true;
  const permission = await submitCommand('读取 src/calculator.js，然后只用 edit 工具追加 // I03B cancel proof。不使用 shell，不绕过权限。');
  const waiting = await until(async () => { const t = await read(permission.taskId); return t.waiting?.kind === 'permission' ? t : false; });
  await enterLatest(); tty.keys('\x1b[B\r'); await tty.expect('取消收据：已确认'); await tty.expect('◆  会话操作');
  const stoppedPermission = await done(waiting); assert.equal(stoppedPermission.status, 'cancelled'); tasks.push(stoppedPermission); await backConversation(true); assert.equal(digest(workspace), filesBefore); checks.realWaitingCancellationNoFileChanges = true;
  // Kill only this test's controller. The native service and original prompt must survive.
  const fault = await submitCommand('读取 src/calculator.js，然后只用 edit 工具追加 // I03B crash proof。不使用 shell，不绕过权限。');
  const paused = await until(async () => { const t = await read(fault.taskId); return t.waiting?.kind === 'permission' ? t : false; });
  const beforeKill = await ipc<{ pid: number; ownedNative: { pid: number }[] }>(dir, { op: 'status' });
  const beforeMessages = await native.messages(paused.native!.sessionId);
  await tty.exit(); tty = undefined; process.kill(beforeKill.pid, 'SIGKILL');
  await until(async () => { try { await ipc(dir, { op: 'status' }); return false; } catch { return true; } });
  const recoveredAt = Date.now(); await ensureController(dir); tty = new Tty(); await tty.expect('◆  下一步');
  const afterKill = await ipc<{ pid: number; ownedNative: { pid: number }[] }>(dir, { op: 'status' });
  assert.notEqual(afterKill.pid, beforeKill.pid); assert.equal(afterKill.ownedNative[0]!.pid, beforeKill.ownedNative[0]!.pid);
  const recovered = await until(async () => { const t = await read(paused.taskId); return t.status === 'running' && t.waiting ? t : false; });
  assert(Date.now() - recoveredAt < 10000); assert.equal(recovered.native!.messageId, paused.native!.messageId);
  const afterMessages = await native.messages(paused.native!.sessionId); assert.deepEqual(afterMessages, beforeMessages);
  checks.sigkillController = { before: beforeKill, after: afterKill, registrationAndObservationMs: Date.now() - recoveredAt, extraPrompts: 0, extraTools: 0, nativeMessagesUnchanged: true };
  await enterLatest(); tty.keys('\x1b[B'.repeat(2) + '\r'); await tty.expect('如何处理这次权限请求'); tty.keys('\r'); await delay(300); tty.child.stdin.write(JSON.stringify({ interrupt: true }) + '\n'); await tty.expect('◆  会话操作'); // Defer approval and leave observation only.
  // If the waiting observation presents permissions, defer it and return with SIGINT; never send a tool approval.
  // This branch is exercised deterministically in fixture tests; the real cancellation below closes this original execution.
  await backConversation(false);
  const cancellation = await command(['cancel', paused.taskId, '--json']); assert.equal(cancellation.code, 0, cancellation.stderr);
  const finalFault = await done(paused); assert.equal(finalFault.status, 'cancelled'); tasks.push(finalFault);
  assert.equal(digest(workspace), filesBefore);
  const serviceBefore = await ipc<{ ownedNative: { pid: number }[] }>(dir, { op: 'status' });
  const durableBefore = await native.messages(first.native!.sessionId); process.kill(serviceBefore.ownedNative[0]!.pid, 'SIGKILL');
  await until(async () => !(await ipc<{ ownedNative: unknown[] }>(dir, { op: 'status' })).ownedNative.length);
  await ipc(dir, { op: 'start' });
  const serviceAfter = await ipc<{ ownedNative: { pid: number }[] }>(dir, { op: 'status' });
  if (!serviceAfter.ownedNative.length) throw new Error('Dead native restart failed: ' + JSON.stringify(await ipc(dir, { op: 'agents' })));
  assert.notEqual(serviceAfter.ownedNative[0]!.pid, serviceBefore.ownedNative[0]!.pid);
  assert.deepEqual(await native.messages(first.native!.sessionId), durableBefore);
  checks.confirmedDeadNativeRestart = { beforePid: serviceBefore.ownedNative[0]!.pid, afterPid: serviceAfter.ownedNative[0]!.pid, originalSessionAndMessagesRetained: true, extraPrompts: 0 };
  // Twenty confirmed connection state changes displayed by the same CLI watcher.
  tty.action('9'); await tty.expect('持续查看状态'); const samples: { confirmedAt: string; displayedAt: string; delayMs: number }[] = [];
  for (let i = 0; i < 20; i++) {
    const name = 'I03B_LATENCY_' + i + '_' + randomUUID();
    await ipc(dir, { op: 'save', expectedRevision: store.read().revision, agent: { agentId: a.agentId, name } });
    const db = new DatabaseSync(resolve(dir, 'hub-data/hub.sqlite'), { readOnly: true }); let confirmedAt: string;
    try { confirmedAt = (JSON.parse((db.prepare('SELECT data FROM agents WHERE id=?').get(a.agentId) as { data: string }).data) as { lastSeenAt: string }).lastSeenAt; } finally { db.close(); }
    const displayed = await tty.expect(name); samples.push({ confirmedAt, displayedAt: new Date(displayed).toISOString(), delayMs: Math.max(0, displayed - Date.parse(confirmedAt)) });
  }
  tty.child.stdin.write(JSON.stringify({ interrupt: true }) + '\n'); await tty.expect('◆  下一步'); await tty.exit(); tty = undefined;
  const p95 = samples.map(s => s.delayMs).sort((x, y) => x - y)[18]!; assert(p95 <= 2000); report.observation = { samples, p95Ms: p95 };
  const automation = await command(['conversations', '--json']); assert.equal(automation.code, 0, automation.stderr); assert.equal((JSON.parse(automation.stdout) as { items: Conversation[] }).items.length, 4); checks.automationCommands = true;
  const db = new DatabaseSync(resolve(dir, 'edge-data/edge.sqlite'), { readOnly: true });
  try { report.executions = db.prepare('SELECT task_id,execution_id,invocations,seq,ack_seq,phase FROM executions').all(); assert((report.executions as { invocations: number }[]).every(e => e.invocations === 1)); report.operations = db.prepare('SELECT data FROM interactions').all(); } finally { db.close(); }
  for (const task of tasks) {
    const messages = await native.messages(task.native!.sessionId);
    const userIds = messages.filter(m => m.type === 'user').map(m => m.id);
    assert(userIds.includes(task.native!.messageId)); if (task.conversationId !== first.conversationId) assert.equal(userIds.length, 1);
  }
  const secrets = ['user.token', 'edge.token', a.passwordFile].map(p => readFileSync(resolve(dir, p), 'utf8').trim());
  const all = JSON.stringify(report) + transcripts.join('\n') + readFileSync(resolve(dir, 'controller.log'), 'utf8'); assert(!secrets.some(s => all.includes(s)));
  checks.credentialLeaks = 0; checks.additionalTerminalsRequired = 0; checks.automaticReprompts = 0; report.status = 'passed';
} catch (e) { report.status = 'failed'; report.error = e instanceof Error ? e.message : String(e); process.exitCode = 1; console.error(report.error); }
finally {
  if (tty) { transcripts.push(tty.all); tty.child.stdin.end(); }
  try { await ipc(dir, { op: 'stop' }); await delay(500); } catch { /* This isolated controller has already stopped. */ }
  mkdirSync('artifacts', { recursive: true }); let evidence = JSON.stringify(report, null, 2), transcript = transcripts.join('\n\n');
  if (store.exists()) for (const path of ['user.token', 'edge.token', ...store.read().agents.map(a => a.passwordFile)]) {
    try { const secret = readFileSync(resolve(dir, path), 'utf8').trim(); if (secret) { evidence = evidence.replaceAll(secret, '[REDACTED]'); transcript = transcript.replaceAll(secret, '[REDACTED]'); } } catch { /* No secret was persisted. */ }
  }
  writeFileSync('artifacts/I03B-acceptance.json', evidence + '\n'); writeFileSync('artifacts/I03B-terminal.txt', transcript + '\n');
  rmSync(root, { recursive: true, force: true }); console.log('I03B acceptance: ' + report.status);
}
