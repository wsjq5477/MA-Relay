import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { parseArgs } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { SettingsStore } from '../src/settings.js';
import { ipc, ensureController } from '../src/controller.js';
import { OpenCodeClient } from '../src/drivers/opencode-client.js';
import { terminal, type Task } from '../src/core.js';
import { safeTerminal } from '../src/terminal.js';
import { parseNativeModel } from '../src/config.js';

const { values } = parseArgs({ options: { model: { type: 'string' }, executable: { type: 'string' }, 'timeout-ms': { type: 'string' }, 'output-prefix': { type: 'string' } } });
assert(values.model, 'Pass --model provider/model; this test never chooses another model automatically');
const limit = Number(values['timeout-ms'] || 600000); const executable = values.executable || resolve(process.env.HOME || '', '.opencode/bin/opencode');
const prefix = values['output-prefix'] || 'I03A'; assert(/^[a-zA-Z0-9_-]+$/.test(prefix));
const root = mkdtempSync(resolve(tmpdir(), 'ab-i03-real-')), dir = resolve(root, 'bridge'), one = resolve(root, 'one'), two = resolve(root, 'two');
cpSync(resolve('examples/opencode-project'), one, { recursive: true }); cpSync(one, two, { recursive: true });
const report: Record<string, unknown> = { date: new Date().toISOString(), kind: 'I03A-real-TTY-acceptance', status: 'running', node: process.version, model: values.model, checks: {}, tasks: [], modelAutonomousForm: 'not_verified' };
const checks = report.checks as Record<string, unknown>; const tasks = report.tasks as Task[];
const transcripts: string[] = []; let tty: Tty | undefined;
let activeWorkspace = one;
class Tty {
  child: ChildProcessWithoutNullStreams; all = ''; buffer = ''; lines = ''; exited: number | undefined;
  constructor() {
    this.child = spawn('python3', [resolve('scripts/pty-driver.py'), process.execPath, '--disable-warning=ExperimentalWarning', resolve('dist/cli.js'), '--dir', dir], { cwd: activeWorkspace, env: { ...process.env, PATH: dirname(executable) + ':' + process.env.PATH }, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child.stdout.on('data', b => {
      this.lines += b.toString(); let end: number;
      while ((end = this.lines.indexOf('\n')) >= 0) {
        const item = JSON.parse(this.lines.slice(0, end)) as { output?: string; exit?: number }; this.lines = this.lines.slice(end + 1);
        if (item.output) { const text = safeTerminal(item.output); this.all += text; this.buffer += text; }
        if (item.exit !== undefined) this.exited = item.exit;
      }
    });
    this.child.stderr.on('data', b => { this.all += safeTerminal(b.toString()); });
  }
  send(text: string) { this.child.stdin.write(JSON.stringify({ send: text + '\r' }) + '\n'); }
  keys(text: string) { this.child.stdin.write(JSON.stringify({ send: text }) + '\n'); }
  action(value: string) { this.keys('\x1b[B'.repeat(['7', '8', '1', '5', '6', '4', '3', '2', '9', '10', '0'].indexOf(value)) + '\r'); }
  async expect(needle: string, send?: string, timeout = limit): Promise<number> {
    // Clack repeats the title on submission (◇). Wait for the next active prompt (◆),
    // otherwise keystrokes can be consumed by a spinner before the menu is listening.
    if (needle === '下一步') needle = '◆  下一步';
    if (needle === '选择 Agent') needle = '◆  选择 Agent';
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const index = this.buffer.indexOf(needle);
      if (index >= 0) { this.buffer = this.buffer.slice(index + needle.length); if (send !== undefined) this.send(send); return Date.now(); }
      if (this.exited !== undefined) throw new Error('TTY exited ' + this.exited + ' before ' + needle);
      await delay(20);
    }
    throw new Error('TTY timed out before ' + needle);
  }
  async exit() { this.action('0'); for (let i = 0; i < 200 && this.exited === undefined; i++) await delay(20); assert.equal(this.exited, 0); transcripts.push(this.all); this.child.stdin.end(); }
}
function digest(directory: string): string {
  const hash = createHash('sha256');
  const visit = (dir: string) => { for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const path = resolve(dir, e.name); if (e.isDirectory()) visit(path); else hash.update(path.slice(directory.length)).update(readFileSync(path)); } };
  visit(directory); return hash.digest('hex');
}
async function command(args: string[], cwd = process.cwd()): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('CLI timeout')); }, limit);
    child.stdout.on('data', b => { stdout += b.toString(); }); child.stderr.on('data', b => { stderr += b.toString(); });
    child.once('error', reject); child.once('close', code => { clearTimeout(timer); done({ code, stdout, stderr }); });
  });
}
async function until<T>(fn: () => Promise<T | false>): Promise<T> {
  const deadline = Date.now() + limit; while (Date.now() < deadline) { const value = await fn(); if (value !== false) return value; await delay(100); } throw new Error('Evidence timeout');
}
const readTask = (id: string) => ipc<Task>(dir, { op: 'task', taskId: id });
async function latest(agentId: string, previous: number): Promise<Task> {
  return until(async () => { const { items } = await ipc<{ items: Task[] }>(dir, { op: 'tasks' }); return items.length > previous ? items.findLast(t => t.targetAgent === agentId) || false : false; });
}
async function wizard(name: string, workspace: string) {
  await tty!.expect('选择要连接的 Agent'); tty!.keys(' \r'); await tty!.expect('✓ 已连接'); await tty!.expect('下一步');
  const s = new SettingsStore(dir).read(), a = s.agents.find(a => a.workspace === workspace)!;
  assert.equal(a.executable, realpathSync(executable)); assert.equal(a.model, undefined, 'Quick setup inherits the native model without asking');
  assert(!/连接名称|OpenCode 可执行文件|连接方式|原生 Agent|启用\?|保存草稿/.test(tty!.all));
  // Isolate the model explicitly requested by this acceptance invocation, without rewriting native configuration.
  await ipc(dir, { op: 'save', expectedRevision: s.revision, agent: { agentId: a.agentId, name, model: parseNativeModel(values.model!) } });
  report.testModelSelection = 'Explicit --model applied through Bridge IPC after quick setup; quick setup itself inherits OpenCode configuration';
}
async function pick(agentId: string) {
  const s = new SettingsStore(dir).read(); if (s.agents.length === 1) return;
  await tty!.expect('选择 Agent');
  const target = s.agents.findIndex(a => a.agentId === agentId), initial = s.agents.findIndex(a => a.agentId === s.defaultAgent);
  tty!.keys((target >= initial ? '\x1b[B'.repeat(target - initial) : '\x1b[A'.repeat(initial - target)) + '\r');
}
async function taskInTty(agentId: string, prompt: string, permission?: '1' | '2'): Promise<Task> {
  const before = (await ipc<{ items: Task[] }>(dir, { op: 'tasks' })).items.length;
  tty!.action('7'); await pick(agentId); await tty!.expect('任务需求', prompt);
  const task = await latest(agentId, before);
  if (permission) { await tty!.expect('如何处理这次权限请求'); tty!.keys('\x1b[B'.repeat(Number(permission)) + '\r'); }
  if (permission === '2') {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && !terminal((await readTask(task.taskId)).status)) await delay(200);
    if (!terminal((await readTask(task.taskId)).status)) {
      tty!.child.stdin.write(JSON.stringify({ interrupt: true }) + '\n');
      checks.rejectModelCompletion = 'not_confirmed; observation exited without cancellation or re-prompt';
    }
  }
  await tty!.expect('下一步'); const final = await readTask(task.taskId); tasks.push(final); return final;
}
async function verify(agentId: string, workspace: string): Promise<Task> {
  const before = (await ipc<{ items: Task[] }>(dir, { op: 'tasks' })).items.length, hash = digest(workspace);
  tty!.action('6'); await pick(agentId); await tty!.expect('执行验证?', 'y'); await tty!.expect('下一步');
  const task = await latest(agentId, before); const finished = await readTask(task.taskId);
  assert.equal(finished.status, 'succeeded', finished.error?.message || finished.uncertaintyReason);
  assert.equal(finished.result?.message.trim(), finished.message.match(/AB_VERIFY_[a-f0-9]+/)![0]);
  const a = new SettingsStore(dir).read().agents.find(a => a.agentId === agentId)!; const native = new OpenCodeClient(a);
  const messages = await native.messages(finished.native!.sessionId); assert.equal(messages.filter(m => m.type === 'user').length, 1);
  assert.equal(messages.flatMap(m => m.content || []).filter(p => p.type === 'tool').length, 0); assert.equal(digest(workspace), hash);
  const session = await native.session(finished.native!.sessionId) as unknown as Record<string, unknown>;
  report[agentId + '-verification'] = { task: finished, sessionModel: session.model, nativeVersion: (await native.check()).version, tools: 0, fileChanges: 0, beforeHash: hash, afterHash: digest(workspace) };
  tasks.push(finished); return finished;
}
try {
  report.sourceHash = digest(resolve('src'));
  assert.equal((await command(['--test'], one)).code, 1);
  tty = new Tty(); await wizard('Coder A', one);
  const store = new SettingsStore(dir), aId = store.read().agents[0]!.agentId;
  checks.firstWizard = true; checks.extraTerminalsRequired = 0; checks.handEditedJSON = 0;
  // Wait for read-only native catalogue initialization, never re-prompt.
  await until(async () => (await ipc<{ items: { agentId: string; healthy: boolean }[] }>(dir, { op: 'agents' })).items.some(a => a.agentId === aId && a.healthy));
  tty.action('5'); await pick(aId); await tty.expect('下一步');
  const readOnlyCheck = store.read().checks[aId]; report.readOnlyCheck = readOnlyCheck;
  assert.equal(readOnlyCheck?.modelResponse, 'not_checked'); assert.equal((await ipc<{ items: Task[] }>(dir, { op: 'tasks' })).items.length, 0);
  await verify(aId, one); checks.firstRealRestrictedVerification = true;
  const analysis = await taskInTty(aId, '只读分析项目，读取 package.json、src/calculator.js、test/calculator.test.js，说明 multiply 的具体错误。不要改文件，不运行 shell。用中文回答。');
  assert.equal(analysis.status, 'succeeded'); assert(analysis.result?.message.includes('multiply')); checks.realAnalysis = true;
  const testBefore = readFileSync(resolve(one, 'test/calculator.test.js'), 'utf8');
  const fix = await taskInTty(aId, '修复 src/calculator.js：必须使用 edit 工具将 multiply(a,b) 改为返回 a*b，保持 add 不变。只改这个文件，不改测试。然后通过 bash 工具运行 npm test，报告实际结果。不安装依赖，不联网，不创建其他文件。', '1');
  assert.equal(fix.status, 'succeeded', fix.error?.message || fix.uncertaintyReason); assert.equal(readFileSync(resolve(one, 'test/calculator.test.js'), 'utf8'), testBefore);
  const independent = await command(['--test'], one); assert.equal(independent.code, 0); report.independentTests = independent;
  const nativeA = new OpenCodeClient(store.read().agents.find(a => a.agentId === aId)!);
  const fixMessages = await nativeA.messages(fix.native!.sessionId); const tools = fixMessages.flatMap(m => m.content || []).filter(p => p.type === 'tool');
  assert(tools.some(t => t.state?.status === 'completed' && /npm (test|run test)|node --test/.test(String(t.state.input?.command))));
  checks.realEditPermissionInSameTerminal = true; checks.realBashTest = true;
  const beforeReject = digest(one);
  const rejected = await taskInTty(aId, '读取 src/calculator.js，然后只使用 edit 工具在末尾增加 // rejected acceptance comment。若权限被拒绝，立刻停止并解释，不使用其他工具绕过，不再次尝试。不运行 shell。', '2');
  assert(['running', 'succeeded', 'failed'].includes(rejected.status)); assert.equal(digest(one), beforeReject);
  assert.equal((await nativeA.waiting(rejected.native!.sessionId)).permissions.length, 0); checks.realRejectNoModification = true;
  await tty.exit(); activeWorkspace = two; tty = new Tty(); await tty.expect('下一步');
  tty.action('1'); await wizard('Coder B', two); const bId = store.read().agents[1]!.agentId;
  await until(async () => (await ipc<{ items: { agentId: string; healthy: boolean }[] }>(dir, { op: 'agents' })).items.some(a => a.agentId === bId && a.healthy));
  await verify(bId, two); checks.twoRealWorkspaces = true;
  const requestId = randomUUID();
  const duplicates = await Promise.all(Array.from({ length: 5 }, () => command([resolve('dist/cli.js'), 'run', bId, '只读 src/calculator.js，说明 multiply 的问题，不改文件，不运行 shell。', '--request-id', requestId, '--dir', dir, '--json'])));
  duplicates.forEach(r => assert.equal(r.code, 0, r.stderr)); const dupTasks = duplicates.map(r => JSON.parse(r.stdout) as Task); assert.equal(new Set(dupTasks.map(t => t.taskId)).size, 1);
  tty.action('8'); await tty.expect('选择要查看的任务'); tty.keys('\r'); await tty.expect('下一步');
  const duplicate = await readTask(dupTasks[0]!.taskId); assert.equal(duplicate.status, 'succeeded'); tasks.push(duplicate);
  const nativeB = new OpenCodeClient(store.read().agents[1]!); assert.equal((await nativeB.messages(duplicate.native!.sessionId)).filter(m => m.type === 'user').length, 1);
  checks.duplicateSubmissions = { submissions: 5, tasks: 1, prompts: 1 };
  const beforeFault = (await ipc<{ items: Task[] }>(dir, { op: 'tasks' })).items.length;
  tty.action('7'); await pick(bId); await tty.expect('任务需求', '读取 src/calculator.js，然后只使用 edit 工具增加一行注释 // fault acceptance。不要使用 shell，不要绕过权限。');
  await tty.expect('如何处理这次权限请求');
  const fault = await latest(bId, beforeFault); const paused = await readTask(fault.taskId); assert(paused.native);
  // Genuine native form API contract, explicitly separate from autonomous model form generation.
  await nativeB.call('/api/session/' + paused.native.sessionId + '/form', { title: '验收文本表单', fields: [{ key: 'reply', title: '验收回答', type: 'string', required: true }] });
  tty.keys('\r'); await tty.expect('验收回答', 'acceptance text'); await tty.expect('发送这份表单?', 'y'); await tty.expect('回复收据: 已确认');
  assert.equal((await nativeB.waiting(paused.native.sessionId)).forms.length, 0); checks.nativeTextFormTTYContract = true;
  const status = await ipc<{ ownedNative: { agentId: string; pid: number }[] }>(dir, { op: 'status' });
  const owned = status.ownedNative.find(a => a.agentId === bId); assert(owned); process.kill(owned.pid, 'SIGKILL');
  await tty.expect('下一步'); const uncertain = await until(async () => { const task = await readTask(fault.taskId); return task.status === 'unknown' ? task : false; }); tasks.push(uncertain);
  const rev = (await ipc<{ revision: number }>(dir, { op: 'agents' })).revision;
  await ipc(dir, { op: 'save', expectedRevision: rev, agent: { agentId: bId, enabled: false } });
  await assert.rejects(() => ipc(dir, { op: 'save', expectedRevision: rev + 1, agent: { ...store.read().agents[1], agentId: 'resource-alias', enabled: true } }), /该项目已有/);
  checks.unknownResourceBypass = 0;
  await tty.exit(); tty = undefined; const stateBefore = await ipc<{ pid: number }>(dir, { op: 'status' });
  await Promise.all(Array.from({ length: 5 }, () => ensureController(dir))); assert.equal((await ipc<{ pid: number }>(dir, { op: 'status' })).pid, stateBefore.pid);
  tty = new Tty(); await tty.expect('下一步'); checks.exitAndReenter = true;
  // Twenty backend-confirmed descriptor changes observed by the actual CLI watch mode.
  tty.action('9'); await tty.expect('持续查看状态'); const samples: { confirmedAt: string; displayedAt: string; delayMs: number }[] = [];
  for (let i = 0; i < 20; i++) {
    const name = 'LATENCY_' + i + '_' + randomUUID(); const list = await ipc<{ revision: number }>(dir, { op: 'agents' });
    await ipc(dir, { op: 'save', expectedRevision: list.revision, agent: { agentId: aId, name } });
    const db = new DatabaseSync(resolve(dir, 'hub-data/hub.sqlite'), { readOnly: true });
    let confirmedAt: string; try { const row = db.prepare('SELECT data FROM agents WHERE id=?').get(aId) as { data: string }; confirmedAt = (JSON.parse(row.data) as { lastSeenAt: string }).lastSeenAt; } finally { db.close(); }
    const displayed = await tty.expect(name); samples.push({ confirmedAt, displayedAt: new Date(displayed).toISOString(), delayMs: Math.max(0, displayed - Date.parse(confirmedAt)) });
  }
  tty.child.stdin.write(JSON.stringify({ interrupt: true }) + '\n'); await tty.expect('下一步');
  const p95 = samples.map(s => s.delayMs).sort((a, b) => a - b)[18]!; assert(p95 <= 2000); report.observation = { samples, p95Ms: p95, modelLatencyExcluded: true };
  await tty.exit(); tty = undefined;
  await ipc(dir, { op: 'stop' }); await until(async () => { try { await ipc(dir, { op: 'status' }); return false; } catch { return true; } });
  await ensureController(dir); await until(async () => (await ipc<{ connected: boolean }>(dir, { op: 'status' })).connected);
  for (const task of tasks.filter(t => terminal(t.status))) assert.deepEqual(await readTask(task.taskId), task);
  assert.equal((await readTask(fault.taskId)).status, 'unknown'); checks.historyLost = 0; checks.automaticReprompts = 0;
  const db = new DatabaseSync(resolve(dir, 'edge-data/edge.sqlite'), { readOnly: true });
  try { const invocations = db.prepare('SELECT task_id,invocations FROM executions').all() as { task_id: string; invocations: number }[]; assert(invocations.every(row => row.invocations === 1)); report.invocations = invocations; report.interactions = db.prepare('SELECT id,data FROM interactions').all(); } finally { db.close(); }
  const secrets = ['user.token', 'edge.token', ...store.read().agents.map(a => a.passwordFile)].map(path => readFileSync(resolve(dir, path), 'utf8').trim());
  const all = transcripts.join('\n') + readFileSync(resolve(dir, 'controller.log'), 'utf8') + JSON.stringify(report);
  assert(!secrets.some(s => all.includes(s))); checks.credentialLeaks = 0; report.status = 'passed';
} catch (e) { report.status = 'failed'; report.error = e instanceof Error ? e.message : String(e); process.exitCode = 1; console.error(report.error); }
finally {
  if (tty) { transcripts.push(tty.all); tty.child.stdin.end(); }
  try { await ipc(dir, { op: 'stop' }); await delay(500); } catch { /* stopped */ }
  mkdirSync(resolve('artifacts'), { recursive: true }); let evidence = JSON.stringify(report, null, 2), transcript = transcripts.join('\n\n');
  if (new SettingsStore(dir).exists()) for (const path of ['user.token', 'edge.token', ...new SettingsStore(dir).read().agents.map(a => a.passwordFile)]) {
    try { const secret = readFileSync(resolve(dir, path), 'utf8').trim(); if (secret) { evidence = evidence.replaceAll(secret, '[REDACTED]'); transcript = transcript.replaceAll(secret, '[REDACTED]'); } } catch { /* missing */ }
  }
  writeFileSync(resolve('artifacts', prefix + '-acceptance.json'), evidence + '\n'); writeFileSync(resolve('artifacts', prefix + '-terminal.txt'), transcript + '\n');
  rmSync(root, { recursive: true, force: true }); console.log('I03A acceptance: ' + report.status);
}
