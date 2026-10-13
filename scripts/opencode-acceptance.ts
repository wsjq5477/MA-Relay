import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { initOpenCode, loadConfig } from '../src/config.js';
import { request } from '../src/client.js';
import { OpenCodeClient, type NativeMessage } from '../src/drivers/opencode-client.js';
import { terminal, type Task } from '../src/core.js';

const { values } = parseArgs({ options: { model: { type: 'string' }, executable: { type: 'string' }, 'timeout-ms': { type: 'string' } } });
const limit = values['timeout-ms'] === undefined ? 600000 : Number(values['timeout-ms']);
assert(Number.isSafeInteger(limit) && limit > 0, '--timeout-ms must be positive');
const root = mkdtempSync(resolve(tmpdir(), 'agentbridge-i02-real-'));
const workspace = resolve(root, 'project'); const dir = resolve(root, 'bridge');
const cli = resolve('dist/cli.js'); const logs: string[] = [];
let service: ChildProcess | undefined; let serviceExit: Promise<number | null> | undefined;
let serviceCode: number | null | undefined;
const report: Record<string, unknown> = { date: new Date().toISOString(), kind: 'real-opencode-acceptance', status: 'running', environment: { node: process.version, platform: process.platform }, workspace, checks: {} };
const checks = report.checks as Record<string, unknown>;
function digest(directory: string): string {
  const hash = createHash('sha256');
  function read(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) read(path); else hash.update(path.slice(directory.length)).update(readFileSync(path));
    }
  }
  read(directory); return hash.digest('hex');
}
async function port() {
  const server = createServer(); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const result = (server.address() as { port: number }).port; await new Promise<void>(r => server.close(() => r())); return result;
}
function command(args: string[], cwd = process.cwd()) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((done, reject) => {
    const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Command timeout')); }, limit);
    child.stdout.on('data', b => { stdout += b.toString(); }); child.stderr.on('data', b => { stderr += b.toString(); });
    child.once('error', reject); child.once('close', code => { clearTimeout(timeout); logs.push(stdout, stderr); done({ code, stdout, stderr }); });
  });
}
async function start(requireAvailable = true) {
  service = spawn(process.execPath, [cli, 'up', '--dir', dir], { stdio: ['ignore', 'pipe', 'pipe'] });
  service.stdout!.on('data', b => { logs.push(b.toString()); }); service.stderr!.on('data', b => { logs.push(b.toString()); });
  serviceExit = new Promise<number | null>(r => { service!.once('exit', code => { serviceCode = code; r(code); }); });
  service.once('error', () => { serviceCode = -1; });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (serviceCode !== undefined) throw new Error('Combined startup failed; see the sanitized service log');
    try { const { items } = await request<{ items: { available: boolean; online: boolean; healthy: boolean }[] }>(loadConfig(resolve(dir, 'client.json'), 'client'), '/v1/agents'); if (items[0]?.available || !requireAvailable && items[0]?.online && items[0].healthy) return; } catch { /* wait for readiness */ }
    await delay(200);
  }
  throw new Error('Native Agent did not become available; check model configuration');
}
async function stop() {
  if (!service || serviceCode !== undefined) return;
  service.kill('SIGTERM'); const force = setTimeout(() => service?.kill('SIGKILL'), 10000);
  await serviceExit; clearTimeout(force);
}
try {
  cpSync(resolve('examples/opencode-project'), workspace, { recursive: true });
  const sourceHash = digest(resolve('src')); report.sourceHash = sourceHash;
  const baseline = await command(['--test'], workspace); assert.equal(baseline.code, 1); checks.initialExampleTestFails = true;
  const hubPort = await port(); const nativePort = await port();
  initOpenCode(dir, workspace, hubPort, values.executable, values.model);
  const edgePath = resolve(dir, 'edge-a.json'); const raw = JSON.parse(readFileSync(edgePath, 'utf8'));
  raw.agents[0].serverUrl = 'http://127.0.0.1:' + nativePort;
  // Require a real native tool approval even when the user's normal policy allows shell tests.
  raw.agents[0].permissions = [{ action: 'edit', resource: '*', effect: 'ask' }];
  writeFileSync(edgePath, JSON.stringify(raw, null, 2));
  await start(); checks.combinedStartup = true;
  const client = loadConfig(resolve(dir, 'client.json'), 'client'); const config = loadConfig(edgePath, 'edge').agents[0]!;
  assert(config.adapter === 'opencode'); const native = new OpenCodeClient(config); report.native = await native.check();
  const run = async (message: string, requestId: string) => {
    const out = await command([cli, 'run', 'opencode', message, '--request-id', requestId, '--json', '--config', resolve(dir, 'client.json')]);
    assert.equal(out.code, 0, out.stderr); return JSON.parse(out.stdout) as Task;
  };
  const approvals: { taskId: string; requestId: string; action: string; resources: string[] }[] = [];
  async function finish(id: string): Promise<Task> {
    const deadline = Date.now() + limit; const handled = new Set<string>(); let last = '';
    while (Date.now() < deadline) {
      const task = await request<Task>(client, '/v1/tasks/' + id);
      if (task.lastSummary !== last) { console.log(task.taskId + ' ' + task.status + ': ' + task.lastSummary.slice(0, 180)); last = task.lastSummary; }
      if (terminal(task.status) || task.status === 'unknown') return task;
      if (task.native && task.waiting?.kind === 'permission') {
        const waiting = await native.waiting(task.native.sessionId);
        for (const permission of waiting.permissions) {
          if (handled.has(permission.id)) continue;
          // The user authorized this isolated example's edit/test. Restrict approvals to those operations.
          const inProject = permission.resources.every(p => p.startsWith(workspace + '/') || !p.startsWith('/') && !p.includes('..'));
          const testCommand = permission.action === 'bash' && permission.resources.every(p => /^(npm (test|run test)|node --test)(\s|$)/.test(p));
          const fileOperation = ['edit', 'write', 'read', 'glob', 'grep', 'list'].includes(permission.action) && inProject;
          if (!testCommand && !fileOperation) throw new Error('Native permission exceeds the isolated acceptance scope: ' + permission.action);
          const out = await command([cli, 'native', id, '--permission', permission.id, '--decision', 'once', '--config', resolve(dir, 'client.json')]);
          assert.equal(out.code, 0, out.stderr); handled.add(permission.id);
          approvals.push({ taskId: id, requestId: permission.id, action: permission.action, resources: permission.resources });
        }
      }
      await delay(500);
    }
    throw new Error('Real task observation timed out; native execution may still be active');
  }
  const beforeSource = readFileSync(resolve(workspace, 'src/calculator.js'), 'utf8');
  const beforeTest = readFileSync(resolve(workspace, 'test/calculator.test.js'), 'utf8');
  const readKey = randomUUID(); const analysisPrompt = '只读分析当前项目：读取 package.json、src/calculator.js、test/calculator.test.js，说明用途和导致测试失败的具体错误。不要修改文件，不运行 shell，不请求外部网络。用中文回答。';
  const repeated = await Promise.all(Array.from({ length: 5 }, () => run(analysisPrompt, readKey)));
  assert.equal(new Set(repeated.map(t => t.taskId)).size, 1);
  const analysis = await finish(repeated[0]!.taskId); report.analysis = analysis;
  assert.equal(analysis.status, 'succeeded', analysis.error?.message || analysis.uncertaintyReason);
  assert(analysis.result?.message.includes('multiply'));
  assert.equal(readFileSync(resolve(workspace, 'src/calculator.js'), 'utf8'), beforeSource); checks.readOnlyAnalysis = true;
  const modification = await run('修复 src/calculator.js 的 multiply(a,b)：使用 edit 工具使它返回 a*b，保持 add 不变。仅修改这一文件，不修改测试。然后必须通过 shell 工具在当前项目运行 npm test，确认通过并报告实际测试结果。不要安装依赖，不访问网络，不创建额外文件。', randomUUID());
  const changed = await finish(modification.taskId); report.modification = changed;
  assert.equal(changed.status, 'succeeded', changed.error?.message || changed.uncertaintyReason);
  assert.notEqual(changed.native!.sessionId, analysis.native!.sessionId); checks.sessionIsolation = true;
  const afterSource = readFileSync(resolve(workspace, 'src/calculator.js'), 'utf8'); report.fileChange = { before: beforeSource, after: afterSource };
  assert.notEqual(afterSource, beforeSource); assert.equal(readFileSync(resolve(workspace, 'test/calculator.test.js'), 'utf8'), beforeTest);
  const actualTests = await command(['--test'], workspace); assert.equal(actualTests.code, 0, actualTests.stderr); report.independentTest = actualTests;
  const history = await native.messages(changed.native!.sessionId);
  report.nativeMessages = history.map(m => ({ id: m.id, type: m.type, ...(m.text ? { text: m.text } : {}),
    ...(m.outcome ? { outcome: m.outcome } : {}),
    ...(m.content ? { content: m.content.map(p => ({ type: p.type, ...(p.id ? { id: p.id } : {}), ...(p.name ? { name: p.name } : {}), ...(p.text ? { text: p.text } : {}),
      ...(p.state ? { state: { status: p.state.status, input: { command: p.state.input?.command, filePath: p.state.input?.filePath }, content: p.state.content?.map(c => ({ type: c.type, text: c.text })) } } : {}) })) } : {}) }));
  const tools = history.flatMap(m => m.content || []).filter(p => p.type === 'tool');
  assert(tools.some(t => t.state?.status === 'completed' && /npm (test|run test)|node --test/.test(String(t.state.input?.command))));
  checks.realFileModification = true; checks.nativeToolTestExecution = true;
  const analysisMessages = await native.messages(analysis.native!.sessionId);
  const prompts = (messages: NativeMessage[]) => messages.filter(m => m.type === 'user');
  assert.equal(prompts(analysisMessages).length, 1); assert.equal(prompts(analysisMessages)[0]!.id, analysis.native!.messageId);
  assert.equal(prompts(history).length, 1); checks.idempotency = { submissions: 5, tasks: 1, nativePrompts: 1 };
  report.approvals = approvals; checks.realPermissionHandling = approvals.length > 0;
  await stop(); service = undefined; serviceCode = undefined; await start();
  assert.deepEqual(await request<Task>(client, '/v1/tasks/' + analysis.taskId), analysis); assert.deepEqual(await request<Task>(client, '/v1/tasks/' + changed.taskId), changed);
  checks.restartHistoryLost = 0;
  assert(checks.realPermissionHandling, 'Native edit policy must produce a real waiting/reply scenario');
  const faultKey = randomUUID();
  const fault = await run('读取 src/calculator.js，然后使用 edit 工具在文件末尾增加一行注释 // acceptance fault exercise。不要使用 shell；等待工具授权，不尝试绕过等待。', faultKey);
  const faultDeadline = Date.now() + limit;
  let paused: Task | undefined;
  while (Date.now() < faultDeadline) {
    const task = await request<Task>(client, '/v1/tasks/' + fault.taskId);
    if (task.waiting?.kind === 'permission') { paused = task; break; }
    if (terminal(task.status) || task.status === 'unknown') throw new Error('Fault exercise ended before a real permission wait');
    await delay(500);
  }
  assert(paused?.native, 'Fault exercise must wait for permission before shutdown');
  report.fault = { taskId: paused.taskId, native: paused.native, stateBefore: paused.status };
  await stop(); service = undefined; serviceCode = undefined; await start(false);
  const uncertain = await request<Task>(client, '/v1/tasks/' + paused.taskId);
  assert.equal(uncertain.status, 'unknown');
  assert.equal((await run(fault.message, faultKey)).taskId, paused.taskId);
  const afterFaultMessages = await native.messages(paused.native.sessionId);
  assert.equal(prompts(afterFaultMessages).length, 1);
  const database = new DatabaseSync(resolve(dir, 'edge-a-data/edge.sqlite'), { readOnly: true });
  try {
    const row = database.prepare('SELECT invocations FROM executions WHERE execution_id=?').get(paused.executionId) as { invocations: number };
    assert.equal(row.invocations, 1);
  } finally { database.close(); }
  await assert.rejects(() => request(client, '/v1/tasks', { targetAgent: 'opencode', message: 'must remain occupied', requestId: randomUUID() }), /occupied/);
  checks.realDisconnectProtection = { state: uncertain.status, automaticReruns: 0, invocations: 1, nativePrompts: 1, occupancyPreserved: true };
  const secrets = ['user.token', 'edge-a.token', 'native.password'].map(p => readFileSync(resolve(dir, p), 'utf8').trim());
  assert(!logs.some(s => secrets.some(secret => s.includes(secret)))); checks.credentialLeaks = 0;
  report.status = 'passed';
  console.log('Real OpenCode analysis, modification, tool test and history checks completed.');
} catch (e) {
  report.status = 'failed'; report.error = e instanceof Error ? e.message : 'Acceptance failed';
  console.error(String(report.error)); process.exitCode = 1;
} finally {
  await stop(); mkdirSync(resolve('artifacts'), { recursive: true });
  // Runtime logs can include native output: retain only this controlled example's evidence, redact known credentials.
  const secrets = ['user.token', 'edge-a.token', 'native.password'].flatMap(p => { try { return [readFileSync(resolve(dir, p), 'utf8').trim()]; } catch { return []; } });
  let data = JSON.stringify(report, null, 2);
  for (const secret of secrets.filter(Boolean)) data = data.replaceAll(secret, '[REDACTED]');
  writeFileSync(resolve('artifacts/I02-real-acceptance.json'), data + '\n');
  console.log('Report: ' + resolve('artifacts/I02-real-acceptance.json'));
  rmSync(root, { recursive: true, force: true });
}
