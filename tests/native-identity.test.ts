import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { opencodeSchema } from '../src/config.js';
import { startNativeServer } from '../src/native-server.js';
import { identityPath, readNativeIdentity, processIdentity } from '../src/native-identity.js';
import { OpenCodeClient } from '../src/drivers/opencode-client.js';

test('B05: owned native process is reused; wrong PID/start identity and unsafe file never adopt or signal a process', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-native-ownership-'));
  const socket = createServer(); await new Promise<void>(r => socket.listen(0, '127.0.0.1', r));
  const port = (socket.address() as { port: number }).port; await new Promise<void>(r => socket.close(() => r()));
  const executable = resolve(root, 'native');
  writeFileSync(executable, `#!/usr/bin/env node
import {createServer} from 'node:http';
const port=Number(process.argv[process.argv.indexOf('--port')+1]);
createServer((req,res)=>{res.setHeader('content-type','application/json');if(req.headers.authorization!=='Basic '+Buffer.from('opencode:'+(process.env.OPENCODE_PASSWORD||'identity-fixture-secret')).toString('base64')){res.statusCode=401;res.end('{}');return;}res.end(JSON.stringify({version:'2.0.24'}));}).listen(port,'127.0.0.1',()=>{console.log('server password identity-fixture-secret');console.log('server listening on http://127.0.0.1:'+port);});
`, { mode: 0o700 });
  const config = opencodeSchema.parse({ agentId: 'native', name: 'Native', adapter: 'opencode', workspace: root, executable, passwordFile: resolve(root, 'secret'), serverUrl: 'http://127.0.0.1:' + port });
  const first = await startNativeServer(config); let second: Awaited<ReturnType<typeof startNativeServer>> | undefined;
  try {
    const record = readFileSync(identityPath(config), 'utf8'); assert(!record.includes('identity-fixture-secret'));
    second = await startNativeServer(config); assert.equal(second.pid, first.pid); assert.equal(second.reused, true);
    const original = readNativeIdentity(config)!;
    writeFileSync(identityPath(config), JSON.stringify({ ...original, startTicks: 'fake-start' }), { mode: 0o600 });
    await assert.rejects(() => startNativeServer(config), /未确认归属/); assert(processIdentity(first.pid));
    writeFileSync(identityPath(config), JSON.stringify({ ...original, pid: process.pid, ...processIdentity(process.pid), credentialHash: original.credentialHash }), { mode: 0o600 });
    await assert.rejects(() => startNativeServer(config), /身份与托管记录不一致/); assert(processIdentity(process.pid));
    writeFileSync(identityPath(config), record, { mode: 0o600 }); chmodSync(identityPath(config), 0o644);
    await assert.rejects(() => startNativeServer(config), /权限不安全/); chmodSync(identityPath(config), 0o600);
    assert.equal((await new OpenCodeClient(config).call<{ version: string }>('/api/info')).version, '2.0.24');
  } finally { await second?.close(); await first.close(); rmSync(root, { recursive: true, force: true }); }
});

test('B05: an unregistered live endpoint is left running with its credential untouched', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-native-external-')); const server = createServer();
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const passwordFile = resolve(root, 'secret'); writeFileSync(passwordFile, 'external-secret', { mode: 0o600 });
  const config = opencodeSchema.parse({ agentId: 'external', name: 'External', adapter: 'opencode', workspace: root, passwordFile, serverUrl: 'http://127.0.0.1:' + (server.address() as { port: number }).port });
  try { await assert.rejects(() => startNativeServer(config), /未确认归属/); assert(server.listening); assert.equal(readFileSync(passwordFile, 'utf8'), 'external-secret'); }
  finally { await new Promise<void>(r => server.close(() => r())); rmSync(root, { recursive: true, force: true }); }
});

test('B05: native diagnostic output after parent SIGKILL does not kill the adopted service', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-native-parent-loss-'));
  const socket = createServer(); await new Promise<void>(r => socket.listen(0, '127.0.0.1', r));
  const port = (socket.address() as { port: number }).port; await new Promise<void>(r => socket.close(() => r()));
  const executable = resolve(root, 'native.mjs');
  writeFileSync(executable, `#!/usr/bin/env node
import{createServer}from'node:http';
const port=Number(process.argv[process.argv.indexOf('--port')+1]);
createServer((req,res)=>{console.log('native diagnostic after parent loss');console.error('native error diagnostic');res.setHeader('content-type','application/json');res.end(JSON.stringify({version:'2.0.24'}));}).listen(port,'127.0.0.1');
`, { mode: 0o700 });
  const config = opencodeSchema.parse({ agentId: 'orphan', name: 'Orphan', adapter: 'opencode', workspace: root, executable, passwordFile: resolve(root, 'secret'), serverUrl: 'http://127.0.0.1:' + port });
  const parent = spawn(process.execPath, ['--input-type=module', '-e', `import{startNativeServer}from ${JSON.stringify(new URL('../dist/native-server.js', import.meta.url).href)};const h=await startNativeServer(${JSON.stringify(config)});console.log(JSON.stringify({pid:h.pid}));`], { stdio: ['ignore', 'pipe', 'pipe'] });
  let parentCode: number | null | undefined; const ended = new Promise<void>(r => parent.once('close', c => { parentCode = c; r(); }));
  let output = ''; parent.stdout.on('data', b => { output += b.toString(); }); parent.stderr.on('data', () => {});
  let adopted: Awaited<ReturnType<typeof startNativeServer>> | undefined;
  try {
    for (let i = 0; i < 300 && !output.includes('\n') && parentCode === undefined; i++) await delay(20);
    assert(output.includes('\n'), 'Parent did not publish its owned service identity'); const { pid } = JSON.parse(output.trim()) as { pid: number };
    parent.kill('SIGKILL'); await ended;
    adopted = await startNativeServer(config); assert.equal(adopted.pid, pid); assert(adopted.reused);
    await new OpenCodeClient(config).call('/api/info'); await delay(100); assert(processIdentity(pid));
  } finally { if (parentCode === undefined) { parent.kill('SIGTERM'); await ended; } await adopted?.close(); rmSync(root, { recursive: true, force: true }); }
});
