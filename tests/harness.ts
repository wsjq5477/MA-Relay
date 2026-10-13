import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir, platform, release } from 'node:os';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { type Task } from '../src/core.js';
import { envelope, type WireMessage } from '../src/protocol.js';

interface CommandResult { code: number; stdout: string; stderr: string }
interface Service { child: ChildProcess; stdout: string; stderr: string; stop(signal?: NodeJS.Signals): Promise<void> }
export interface AcceptanceReport {
  date: string; environment: { node: string; platform: string; release: string };
  sourceHash: string; topology: { hub: number; edgeA: number; edgeB: number };
  baseline: { success: number; failure: number; historyLost: number };
  idempotency: { submissions: number; tasks: number; invocations: number };
  fault: { automaticReruns: number; unknownOccupancyPreserved: boolean };
  privacy: { credentialLeaks: number };
  checks: string[]; durationMs: number;
}
const cliFile = resolve('dist/cli.js');
export async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(r => server.close(() => r()));
  return port;
}
async function until<T>(fn: () => Promise<T | false>, description: string, timeout = 10000): Promise<T> {
  const deadline = Date.now() + timeout;
  let last: unknown;
  while (Date.now() < deadline) {
    try { const value = await fn(); if (value !== false) return value; } catch (e) { last = e; }
    await delay(50);
  }
  throw new Error('Timed out: ' + description + (last ? ' (' + String(last) + ')' : ''));
}
function counts(dataDir: string) {
  const db = new DatabaseSync(resolve(dataDir, 'edge.sqlite'), { readOnly: true });
  try { return db.prepare('SELECT task_id AS taskId, invocations, phase FROM executions ORDER BY task_id').all() as { taskId: string; invocations: number; phase: string }[]; }
  finally { db.close(); }
}
function hubTaskCount(dir: string): number {
  const db = new DatabaseSync(resolve(dir, 'hub.sqlite'), { readOnly: true });
  try { return (db.prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number }).n; } finally { db.close(); }
}
function digest(paths: string[]): string {
  const hash = createHash('sha256');
  for (const path of paths.sort()) hash.update(path + '\0').update(readFileSync(resolve(path)));
  return hash.digest('hex');
}
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = directory + '/' + entry.name;
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}
export async function runAcceptance(): Promise<AcceptanceReport> {
  const started = Date.now();
  const root = mkdtempSync(resolve(tmpdir(), 'agentbridge-i01-'));
  const dir = resolve(root, 'demo');
  const logs: string[] = [];
  const services: Service[] = [];
  const env = { ...process.env, NODE_NO_WARNINGS: '1' };
  const command = (args: string[], input?: string | Buffer): Promise<CommandResult> => new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliFile, ...args], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', b => { stdout += b.toString(); });
    child.stderr.on('data', b => { stderr += b.toString(); });
    child.on('error', reject);
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('CLI command timed out')); }, 15000);
    child.on('close', code => {
      clearTimeout(timer); logs.push(stdout, stderr);
      resolveResult({ code: code ?? 130, stdout, stderr });
    });
    child.stdin.end(input);
  });
  const config = (name: string) => resolve(dir, name + '.json');
  const jsonFile = (name: string) => JSON.parse(readFileSync(config(name), 'utf8'));
  const edit = (name: string, change: (raw: Record<string, unknown>) => void) => {
    const raw = jsonFile(name); change(raw); writeFileSync(config(name), JSON.stringify(raw, null, 2));
  };
  const cli = (args: string[], name = 'client', input?: string | Buffer) => command([...args, '--config', config(name)], input);
  const expectCode = async (args: string[], code: number, name = 'client', input?: string | Buffer) => {
    const result = await cli(args, name, input);
    assert.equal(result.code, code, result.stderr);
    return result;
  };
  const interruptWatch = async (id: string) => {
    const child = spawn(process.execPath, [cliFile, 'task', id, '--watch', '--json', '--config', config('client')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout!.on('data', b => { stdout += b.toString(); });
    child.stderr!.on('data', b => { stderr += b.toString(); });
    const exited = new Promise<number | null>(r => child.once('exit', r));
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    try {
      await until(async () => stdout.includes('\n'), 'Watch initial JSON');
      child.kill('SIGINT');
      assert.equal(await exited, 130, stderr);
      stdout.trim().split('\n').forEach(line => JSON.parse(line));
      logs.push(stdout, stderr);
    } finally { clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
  };
  const launch = async (name: 'hub' | 'edge-a' | 'edge-b'): Promise<Service> => {
    const args = name === 'hub' ? ['hub', 'start'] : ['connect'];
    const child = spawn(process.execPath, [cliFile, ...args, '--config', config(name)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const service: Service = {
      child, stdout: '', stderr: '',
      async stop(signal = 'SIGTERM') {
        if (child.exitCode !== null || child.signalCode !== null) return;
        const done = new Promise<void>(r => child.once('exit', () => r()));
        child.kill(signal);
        const timer = setTimeout(() => child.kill('SIGKILL'), 4000);
        await done; clearTimeout(timer);
      },
    };
    child.stdout!.on('data', b => { service.stdout += b.toString(); });
    child.stderr!.on('data', b => { service.stderr += b.toString(); });
    services.push(service);
    await until(async () => {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(service.stderr);
      return service.stderr.includes(name === 'hub' ? 'Hub ready' : 'Edge ready') && service;
    }, name + ' startup');
    return service;
  };
  let hub: Service; let edgeA: Service; let edgeB: Service;
  let url = ''; let token = ''; let limitedToken = ''; let connectorBToken = '';
  const http = async (path: string, body?: unknown, credential = token) => {
    const response = await fetch(url + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: 'Bearer ' + credential, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    logs.push(JSON.stringify(data));
    return { status: response.status, data };
  };
  const task = async (id: string): Promise<Task & { events: unknown[] }> => {
    const r = await http('/v1/tasks/' + id); assert.equal(r.status, 200); return r.data;
  };
  const settled = async (id: string, expected: string = 'succeeded') => {
    const t = await until(async () => { const t = await task(id); return ['succeeded', 'failed', 'unknown'].includes(t.status) && t; }, 'Task completion');
    assert.equal(t.status, expected); return t;
  };
  const run = async (target: string, message: string, id: string = randomUUID()) => {
    const result = await expectCode(['run', target, message, '--request-id', id, '--json'], 0);
    return JSON.parse(result.stdout) as Task;
  };
  const agents = async () => (await http('/v1/agents')).data.items as { agentId: string; device: string; online: boolean; busy: boolean; healthy: boolean; available: boolean; currentTask?: { taskId?: string; uncertaintyReason?: string } }[];
  const wsProbe = (credential: string, connectorId: string, message?: WireMessage): Promise<{ httpStatus?: number; message?: WireMessage }> => new Promise((resolveProbe, reject) => {
    const wsUrl = url.replace('http:', 'ws:') + '/v1/connectors/ws';
    const ws = new WebSocket(wsUrl, { headers: { authorization: 'Bearer ' + credential, 'x-connector-id': connectorId } });
    const timer = setTimeout(() => { ws.terminate(); reject(new Error('WebSocket probe timed out')); }, 5000);
    ws.on('unexpected-response', (_req, response) => { clearTimeout(timer); response.resume(); ws.terminate(); resolveProbe({ httpStatus: response.statusCode }); });
    ws.on('error', () => { /* Rejected upgrades are expected. */ });
    ws.on('open', () => { if (message) ws.send(JSON.stringify(message)); });
    ws.on('message', data => { clearTimeout(timer); const result = JSON.parse(data.toString()); ws.close(); resolveProbe({ message: result }); });
  });
  const checks: string[] = [];
  const mark = (...ids: string[]) => checks.push(...ids);
  try {
    const port = await freePort(); url = 'http://127.0.0.1:' + port;
    let result = await command(['init', '--dir', dir, '--port', String(port), '--json']);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).files.length, 6);
    const beforeConfig = readFileSync(config('hub'), 'utf8');
    result = await command(['init', '--dir', dir]);
    assert.equal(result.code, 2);
    assert.equal(readFileSync(config('hub'), 'utf8'), beforeConfig);
    mark('AC-F01-02');
    token = readFileSync(resolve(dir, 'user.token'), 'utf8').trim();
    limitedToken = readFileSync(resolve(dir, 'limited.token'), 'utf8').trim();
    connectorBToken = readFileSync(resolve(dir, 'edge-b.token'), 'utf8').trim();
    edit('hub', raw => {
      raw.heartbeatTimeoutMs = 2000;
      (raw.users as { allowedAgents: string[] }[])[0]!.allowedAgents.push('absent');
    });
    for (const name of ['edge-a', 'edge-b']) edit(name, raw => {
      raw.heartbeatMs = 200;
      (raw.agents as { delayMs: number }[])[0]!.delayMs = 20;
    });
    writeFileSync(config('invalid'), JSON.stringify({ role: 'hub', token }));
    const invalid = await expectCode(['hub', 'start'], 2, 'invalid');
    assert(!invalid.stderr.includes('Hub ready'));
    const missing = jsonFile('client'); missing.tokenFile = './missing.token';
    writeFileSync(config('missing'), JSON.stringify(missing));
    await expectCode(['agents'], 2, 'missing');
    const blocked = resolve(dir, 'blocked'); writeFileSync(blocked, 'not a directory');
    const storage = jsonFile('hub'); storage.dataDir = blocked;
    writeFileSync(config('bad-storage'), JSON.stringify(storage));
    const unavailable = await expectCode(['hub', 'start'], 2, 'bad-storage');
    assert(!unavailable.stderr.includes('Hub ready'));
    hub = await launch('hub'); edgeA = await launch('edge-a'); edgeB = await launch('edge-b');
    const collision = await expectCode(['hub', 'start'], 2, 'hub');
    assert(!collision.stderr.includes('Hub ready'));
    const duplicatePort = jsonFile('hub'); duplicatePort.dataDir = './port-collision-data';
    writeFileSync(config('port-collision'), JSON.stringify(duplicatePort));
    await expectCode(['hub', 'start'], 5, 'port-collision');
    mark('AC-F01-03');
    const topology = { hub: hub.child.pid!, edgeA: edgeA.child.pid!, edgeB: edgeB.child.pid! };
    assert.equal(new Set(Object.values(topology)).size, 3);
    assert(!Object.values(topology).includes(process.pid));
    mark('AC-F01-01');
    const discovered = await agents();
    assert.equal(discovered.length, 2);
    assert.deepEqual(discovered.map(a => a.agentId), ['mock-a', 'mock-b']);
    assert(discovered.every(a => a.online && a.healthy && a.available));
    assert.equal(new Set(discovered.map(a => a.device)).size, 2);
    const agentText = await expectCode(['agents'], 0);
    assert(agentText.stdout.includes('mock-a') && agentText.stdout.includes('mock-b') && agentText.stdout.includes('HEALTHY'));
    mark('AC-F02-01');
    const duplicate = await wsProbe(connectorBToken, 'edge-b');
    assert.equal(duplicate.httpStatus, 409);
    assert.equal((await wsProbe('wrong', 'edge-b')).httpStatus, 401);

    const baseline: (Task & { events: unknown[] })[] = [];
    for (const target of ['mock-a', 'mock-b']) for (let i = 0; i < 10; i++) {
      const message = target + '-success-' + i;
      const submitted = await run(target, message);
      const finished = await settled(submitted.taskId);
      assert.equal(finished.result!.agentId, target);
      assert.equal(finished.result!.message, message);
      assert.equal(finished.events.length, 5);
      const observed = await expectCode(['task', finished.taskId, '--json'], 0);
      assert.deepEqual(JSON.parse(observed.stdout), finished);
      baseline.push(finished);
    }
    mark('AC-F04-01');
    await edgeA.stop(); await edgeB.stop();
    for (const name of ['edge-a', 'edge-b']) edit(name, raw => { (raw.agents as { mode: string }[])[0]!.mode = 'failure'; });
    edgeA = await launch('edge-a'); edgeB = await launch('edge-b');
    for (const target of ['mock-a', 'mock-b']) for (let i = 0; i < 5; i++) {
      const submitted = await run(target, target + '-failure-' + i);
      const finished = await settled(submitted.taskId, 'failed');
      assert.equal(finished.error!.code, 'MOCK_FAILURE');
      assert.equal(finished.result, undefined);
      const observed = await expectCode(['task', finished.taskId, '--json'], 0);
      assert.deepEqual(JSON.parse(observed.stdout), finished);
      baseline.push(finished);
    }
    mark('AC-F04-02');
    const firstFailed = baseline.find(t => t.status === 'failed')!;
    await expectCode(['task', firstFailed.taskId, '--json'], 0);
    const failWatch = await expectCode(['task', firstFailed.taskId, '--watch', '--json'], 1);
    failWatch.stdout.trim().split('\n').forEach(line => JSON.parse(line));
    await edgeA.stop(); await edgeB.stop();
    for (const name of ['edge-a', 'edge-b']) edit(name, raw => { (raw.agents as { mode: string }[])[0]!.mode = 'success'; });
    edgeA = await launch('edge-a'); edgeB = await launch('edge-b');

    const special = 'literal $(touch ' + resolve(root, 'unexpected') + ') \x60echo data\x60\n中文 "quotes"';
    const submitted = await run('mock-a', special);
    const successWatch = await expectCode(['task', submitted.taskId, '--watch', '--json'], 0);
    successWatch.stdout.trim().split('\n').forEach(line => JSON.parse(line));
    assert.equal((await settled(submitted.taskId)).result!.message, special);
    assert(!existsSync(resolve(root, 'unexpected')));
    const stdin = await expectCode(['run', 'mock-a', '--stdin', '--json'], 0, 'client', special);
    assert.equal((await settled(JSON.parse(stdin.stdout).taskId)).result!.message, special);
    writeFileSync(resolve(root, 'message.txt'), special);
    const file = await expectCode(['run', 'mock-a', '--file', resolve(root, 'message.txt'), '--json'], 0);
    assert.equal((await settled(JSON.parse(file.stdout).taskId)).result!.message, special);
    mark('AC-F03-01');

    const beforeInvalid = hubTaskCount(resolve(dir, 'hub-data'));
    await expectCode(['run', 'mock-a', '  '], 2);
    await expectCode(['run', 'mock-a', 'x'.repeat(65537)], 2);
    await expectCode(['run', 'mock-a', '--stdin'], 2, 'client', Buffer.from([0xff]));
    await expectCode(['run', 'mock-a', 'message', '--stdin'], 2);
    const absent = await http('/v1/tasks', { targetAgent: 'absent', message: 'message', requestId: 'absent' });
    assert.equal(absent.status, 404);
    await expectCode(['run', 'absent', 'not registered'], 5);
    assert.equal((await http('/v1/tasks', { targetAgent: 'mock-a', requestId: 'raw-limit', message: 'x'.repeat(65537) })).status, 400);
    assert.equal(hubTaskCount(resolve(dir, 'hub-data')), beforeInvalid);
    // An authorized but unregistered target is a separate not-found route.
    await edgeB.stop();
    await until(async () => !(await agents()).find(a => a.agentId === 'mock-b')!.online, 'Edge B offline');
    await expectCode(['run', 'mock-b', 'offline'], 4);
    const originalB = baseline.find(t => t.targetAgent === 'mock-b')!;
    const offlineRepeat = await run('mock-b', originalB.message, originalB.requestId);
    assert.equal(offlineRepeat.taskId, originalB.taskId);
    assert((await agents()).find(a => a.agentId === 'mock-a')!.online);
    mark('AC-F02-03');
    const hijack = await wsProbe(connectorBToken, 'edge-b', { ...envelope(), type: 'agent.register', payload: {
      device: 'spoof-device', agents: [{ agentId: 'mock-a', name: 'Hijacked', adapter: 'mock', healthy: true }],
    } });
    assert.equal(hijack.message!.type, 'protocol.error');
    assert.equal((await agents()).find(a => a.agentId === 'mock-a')!.device, 'local-a');
    mark('AC-F02-02');
    edgeB = await launch('edge-b');

    const key = randomUUID();
    const repeated = await Promise.all(Array.from({ length: 10 }, () => run('mock-a', 'same logical request', key)));
    assert.equal(new Set(repeated.map(t => t.taskId)).size, 1);
    await settled(repeated[0]!.taskId);
    assert.equal(counts(resolve(dir, 'edge-a-data')).find(t => t.taskId === repeated[0]!.taskId)!.invocations, 1);
    mark('AC-F03-03');
    await expectCode(['run', 'mock-a', 'changed', '--request-id', key], 4);
    await expectCode(['run', 'mock-b', 'same logical request', '--request-id', key], 4);
    await edgeA.stop();
    const repeatOffline = await run('mock-a', 'same logical request', key);
    assert.equal(repeatOffline.taskId, repeated[0]!.taskId);
    edit('edge-a', raw => { (raw.agents as { delayMs: number }[])[0]!.delayMs = 2000; });
    edgeA = await launch('edge-a');
    const raceKeys = Array.from({ length: 6 }, () => randomUUID());
    const races = await Promise.all(raceKeys.map(id => http('/v1/tasks', { targetAgent: 'mock-a', message: 'reservation race', requestId: id })));
    assert.equal(races.filter(r => r.status === 202).length, 1);
    assert.equal(races.filter(r => r.status === 409).length, 5);
    const raceTask = races.find(r => r.status === 202)!.data as Task;
    await until(async () => (await task(raceTask.taskId)).status === 'running', 'Driver running');
    const runningAgent = (await agents()).find(a => a.agentId === 'mock-a')!;
    assert(runningAgent.busy && !runningAgent.available);
    assert.equal(runningAgent.currentTask!.taskId, raceTask.taskId);
    const observationTimeout = await expectCode(['task', raceTask.taskId, '--watch', '--json', '--timeout-ms', '50'], 3);
    assert(observationTimeout.stderr.includes('not changed'));
    assert.equal((await task(raceTask.taskId)).status, 'running');
    await interruptWatch(raceTask.taskId);
    assert.equal((await task(raceTask.taskId)).status, 'running');
    const textTask = await expectCode(['task', raceTask.taskId], 0);
    assert(textTask.stdout.includes('Status: running'));
    await expectCode(['run', 'mock-a', 'busy'], 4);
    await settled(raceTask.taskId);
    assert.equal(counts(resolve(dir, 'edge-a-data')).find(t => t.taskId === raceTask.taskId)!.invocations, 1);
    mark('AC-F02-04', 'AC-F03-04', 'AC-F04-03', 'AC-F05-03');
    const rejectedKey = raceKeys[races.findIndex(r => r.status === 409)]!;
    const retryRejected = await run('mock-a', 'rejected request can retry', rejectedKey);
    await settled(retryRejected.taskId);
    await edgeA.stop();
    edit('edge-a', raw => { (raw.agents as { delayMs: number }[])[0]!.delayMs = 20; });
    edgeA = await launch('edge-a');
    await edgeB.stop();
    edit('edge-b', raw => { (raw.agents as { healthy: boolean }[])[0]!.healthy = false; });
    edgeB = await launch('edge-b');
    const unhealthyAgent = (await agents()).find(a => a.agentId === 'mock-b')!;
    assert(unhealthyAgent.online && !unhealthyAgent.healthy && !unhealthyAgent.available);
    const beforeUnhealthy = hubTaskCount(resolve(dir, 'hub-data'));
    await expectCode(['run', 'mock-b', 'unhealthy'], 4);
    assert.equal(hubTaskCount(resolve(dir, 'hub-data')), beforeUnhealthy);
    await edgeB.stop();
    edit('edge-b', raw => { (raw.agents as { healthy: boolean }[])[0]!.healthy = true; });
    edgeB = await launch('edge-b');
    mark('AC-F03-02');

    const beforeUnauthorized = hubTaskCount(resolve(dir, 'hub-data'));
    const offlineClient = jsonFile('client'); offlineClient.hubUrl = 'http://127.0.0.1:' + await freePort();
    writeFileSync(config('network-down'), JSON.stringify(offlineClient));
    const retained = await expectCode(['run', 'mock-a', 'uncertain response', '--request-id', 'retained-explicit-key'], 5, 'network-down');
    assert(retained.stderr.includes('retained-explicit-key'));
    for (const credential of ['', 'wrong']) {
      assert.equal((await http('/v1/tasks', { targetAgent: 'mock-a', message: 'unauthorized', requestId: randomUUID() }, credential)).status, 401);
    }
    await expectCode(['run', 'mock-b', 'forbidden'], 2, 'limited-client');
    await expectCode(['task', submitted.taskId, '--json'], 5, 'limited-client');
    assert.equal((await http('/v1/tasks', { targetAgent: 'mock-a', message: 'spoof', requestId: 'spoof', sourceUser: 'admin' })).status, 400);
    assert.equal(hubTaskCount(resolve(dir, 'hub-data')), beforeUnauthorized);
    const limitedTask = await expectCode(['run', 'mock-a', 'same logical request', '--request-id', key, '--json'], 0, 'limited-client');
    const limitedId = JSON.parse(limitedTask.stdout).taskId;
    assert.notEqual(limitedId, repeated[0]!.taskId);
    await settledLimited(limitedId);
    async function settledLimited(id: string) {
      await until(async () => {
        const r = await http('/v1/tasks/' + id, undefined, limitedToken);
        return r.status === 200 && r.data.status === 'succeeded';
      }, 'Limited owner Task');
    }
    const noDetails = await expectCode(['task', limitedId, '--json'], 0, 'limited-client');
    assert.equal(JSON.parse(noDetails.stdout).events, undefined);
    await expectCode(['task', limitedId, '--diagnostics'], 2, 'limited-client');
    const ownerView = await expectCode(['tasks', '--json'], 0, 'limited-client');
    assert.deepEqual(JSON.parse(ownerView.stdout).items.map((t: Task) => t.taskId), [limitedId]);
    mark('AC-F07-02');

    // Verify event authorization and state guards on an authenticated test Connector.
    await edgeB.stop();
    const ws = new WebSocket(url.replace('http:', 'ws:') + '/v1/connectors/ws', {
      headers: { authorization: 'Bearer ' + connectorBToken, 'x-connector-id': 'edge-b' },
    });
    const messages: WireMessage[] = [];
    ws.on('message', b => messages.push(JSON.parse(b.toString())));
    await new Promise<void>((r, reject) => { ws.once('open', r); ws.once('error', reject); });
    const emit = async (message: WireMessage) => {
      const start = messages.length; ws.send(JSON.stringify(message));
      return until(async () => messages.slice(start).find(m => m.type === 'protocol.error' && m.payload.correlationId === message.messageId
        || m.type === 'message.ack' && m.payload.ackedMessageId === message.messageId) || false, 'Protocol response');
    };
    assert.equal((await emit({ ...envelope(), type: 'agent.register', payload: { device: 'local-b', agents: [{ agentId: 'mock-b', name: 'Mock B', adapter: 'mock', healthy: true }] } })).type, 'message.ack');
    const unauthorizedEvent = await emit({ ...envelope(), type: 'task.event', taskId: submitted.taskId, executionId: submitted.executionId, payload: { seq: 99, event: { kind: 'started' } } });
    assert.equal(unauthorizedEvent.type, 'protocol.error');
    const ownFinal = baseline.find(t => t.targetAgent === 'mock-b' && t.status === 'succeeded')!;
    const finalBefore = await task(ownFinal.taskId);
    const illegal = await emit({ ...envelope(), type: 'task.event', taskId: ownFinal.taskId, executionId: ownFinal.executionId, payload: { seq: 6, event: { kind: 'started' } } });
    assert.equal(illegal.type, 'protocol.error');
    const dupFinal = await emit({ ...envelope(), type: 'task.event', taskId: ownFinal.taskId, executionId: ownFinal.executionId, payload: { seq: 5, event: { kind: 'completed', result: { agentId: 'mock-b', message: ownFinal.message } } } });
    assert.equal(dupFinal.type, 'message.ack');
    assert.deepEqual(await task(ownFinal.taskId), finalBefore);
    mark('AC-F04-04', 'AC-F07-01');
    // Heartbeat expiry closes this test Connector. There is no automatic reconnection.
    await until(async () => !(await agents()).find(a => a.agentId === 'mock-b')!.online, 'Heartbeat expiry', 5000);
    ws.terminate();
    edgeB = await launch('edge-b');

    const allBefore = await expectCode(['tasks', '--json'], 0);
    assert(JSON.parse(allBefore.stdout).items.length >= 30);
    const textList = await expectCode(['tasks'], 0);
    assert(textList.stdout.includes('AgentBridge-created tasks only'));
    const listWatch = await expectCode(['tasks', '--watch', '--json', '--timeout-ms', '100'], 3);
    listWatch.stdout.trim().split('\n').forEach(line => JSON.parse(line));
    const page = await http('/v1/tasks?limit=3'); assert.equal(page.data.items.length, 3); assert(page.data.nextCursor);
    const next = await http('/v1/tasks?limit=3&cursor=' + page.data.nextCursor);
    assert.equal(next.data.items.length, 3); assert.notEqual(next.data.items[0].taskId, page.data.items[0].taskId);
    mark('AC-F05-01', 'AC-F05-02', 'AC-F05-04');
    const historical = new Map(baseline.map(t => [t.taskId, JSON.stringify(t)]));
    await hub.stop(); await edgeA.stop(); await edgeB.stop();
    hub = await launch('hub'); edgeA = await launch('edge-a'); edgeB = await launch('edge-b');
    for (const [id, snapshot] of historical) assert.equal(JSON.stringify(await task(id)), snapshot);
    const repeatedAfterRestart = await run('mock-a', 'same logical request', key);
    assert.equal(repeatedAfterRestart.taskId, repeated[0]!.taskId);
    assert.equal(counts(resolve(dir, 'edge-a-data')).find(t => t.taskId === repeated[0]!.taskId)!.invocations, 1);
    mark('AC-F06-01', 'AC-F06-02');

    // Hub SIGKILL while an actual Mock invocation is active.
    await edgeA.stop();
    edit('edge-a', raw => { (raw.agents as { delayMs: number }[])[0]!.delayMs = 60000; });
    edgeA = await launch('edge-a');
    const interruptedHub = await run('mock-a', 'Hub crash fixture');
    await until(async () => (await task(interruptedHub.taskId)).status === 'running', 'Hub fault running');
    await hub.stop('SIGKILL'); await edgeA.stop(); await edgeB.stop();
    hub = await launch('hub'); edgeA = await launch('edge-a'); edgeB = await launch('edge-b');
    const hubUnknown = await task(interruptedHub.taskId);
    assert.equal(hubUnknown.status, 'unknown'); assert(hubUnknown.uncertaintyReason);
    const unknownWatch = await expectCode(['task', interruptedHub.taskId, '--watch', '--json'], 3);
    assert.equal(JSON.parse(unknownWatch.stdout).status, 'unknown');
    await expectCode(['run', 'mock-a', 'must stay occupied'], 4);
    assert.equal((await run('mock-a', interruptedHub.message, interruptedHub.requestId)).taskId, interruptedHub.taskId);
    assert.equal(counts(resolve(dir, 'edge-a-data')).find(t => t.taskId === interruptedHub.taskId)!.invocations, 1);
    const independent = await run('mock-b', 'independent Agent still usable');
    await settled(independent.taskId);
    assert((await agents()).find(a => a.agentId === 'mock-a')!.currentTask!.uncertaintyReason);

    // Edge SIGKILL while an actual Mock invocation is active.
    await edgeB.stop();
    edit('edge-b', raw => { (raw.agents as { delayMs: number }[])[0]!.delayMs = 60000; });
    edgeB = await launch('edge-b');
    const interruptedEdge = await run('mock-b', 'Edge crash fixture');
    await until(async () => (await task(interruptedEdge.taskId)).status === 'running', 'Edge fault running');
    await edgeB.stop('SIGKILL');
    await until(async () => (await task(interruptedEdge.taskId)).status === 'unknown', 'Edge unknown');
    edgeB = await launch('edge-b');
    await expectCode(['run', 'mock-b', 'must stay occupied'], 4);
    assert.equal(counts(resolve(dir, 'edge-b-data')).find(t => t.taskId === interruptedEdge.taskId)!.invocations, 1);
    for (const [id, snapshot] of historical) assert.equal(JSON.stringify(await task(id)), snapshot);
    mark('AC-F08-01', 'AC-F08-02', 'AC-F08-03', 'AC-F08-04');

    // A matching old execution delivered by a test Hub to restarted Edge never invokes twice.
    await edgeA.stop();
    const fakeServer = new (await import('ws')).WebSocketServer({ port: 0, host: '127.0.0.1' });
    await new Promise<void>(r => fakeServer.once('listening', r));
    const fakePort = (fakeServer.address() as { port: number }).port;
    let submitAck = 0;
    fakeServer.on('connection', peer => {
      peer.on('message', buffer => {
        const msg = JSON.parse(buffer.toString()) as WireMessage;
        if (msg.type === 'agent.register') {
          peer.send(JSON.stringify({ ...envelope(), type: 'message.ack', payload: { ackedMessageId: msg.messageId } }));
          for (let n = 0; n < 2; n++) peer.send(JSON.stringify({ ...envelope(), messageId: 'old-submit-' + n, type: 'task.submit', payload: {
            taskId: interruptedHub.taskId, executionId: interruptedHub.executionId, conversationId: interruptedHub.conversationId,
            targetAgent: interruptedHub.targetAgent, message: interruptedHub.message,
          } }));
        } else if (msg.type === 'message.ack' && msg.payload.ackedMessageId.startsWith('old-submit-')) submitAck++;
      });
    });
    const originalA = readFileSync(config('edge-a'), 'utf8');
    edit('edge-a', raw => { raw.hubUrl = 'http://127.0.0.1:' + fakePort; });
    try {
      edgeA = await launch('edge-a');
      await until(async () => submitAck === 2, 'Old execution duplicate receipts');
      assert.equal(counts(resolve(dir, 'edge-a-data')).find(t => t.taskId === interruptedHub.taskId)!.invocations, 1);
      await edgeA.stop();
    } finally {
      writeFileSync(config('edge-a'), originalA);
      for (const peer of fakeServer.clients) peer.terminate();
      await new Promise<void>(r => fakeServer.close(() => r()));
    }
    mark('AC-F06-03');
    // Detailed truncation and write fault evidence comes from storage/Hub fault tests.
    // Those are asserted separately by the Node test runner, not claimed by this process run.
    const secrets = ['user', 'limited', 'edge-a', 'edge-b'].map(n => readFileSync(resolve(dir, n + '.token'), 'utf8').trim());
    for (const service of services) logs.push(service.stdout, service.stderr);
    assert(!logs.some(log => secrets.some(secret => log.includes(secret))));
    mark('AC-F07-03');
    return {
      date: new Date().toISOString(), environment: { node: process.version, platform: platform(), release: release() },
      sourceHash: digest([...sourceFiles('src'), 'package.json', 'package-lock.json', 'tsconfig.json']),
      topology, baseline: { success: 20, failure: 10, historyLost: 0 },
      idempotency: { submissions: 10, tasks: 1, invocations: 1 },
      fault: { automaticReruns: 0, unknownOccupancyPreserved: true },
      privacy: { credentialLeaks: 0 }, checks: [...new Set(checks)].sort(), durationMs: Date.now() - started,
    };
  } finally {
    for (const service of services.reverse()) await service.stop();
    rmSync(root, { recursive: true, force: true });
  }
}
export function writeReport(report: AcceptanceReport): void {
  mkdirSync(resolve('artifacts'), { recursive: true });
  writeFileSync(resolve('artifacts/I01-acceptance.json'), JSON.stringify(report, null, 2) + '\n');
}
