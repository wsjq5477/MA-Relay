import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { opencodeSchema } from '../src/config.js';
import { OpenCodeClient } from '../src/drivers/opencode-client.js';
import { v1Fixture } from './opencode-v1-fixture.js';

test('issue21: valid v1 skips permanently hanging api/info and only reads metadata', async t => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-probe-v1-'));
  const native = await v1Fixture(root, { hangInfo: true });
  t.after(async () => { await native.close(); rmSync(root, { recursive: true, force: true }); });
  const passwordFile = resolve(root, 'password'); writeFileSync(passwordFile, native.password);
  const client = new OpenCodeClient(opencodeSchema.parse({ adapter: 'opencode', agentId: 'a', name: 'A', workspace: root, serverUrl: native.url, passwordFile }));
  const start = Date.now();
  assert.equal((await client.check()).healthy, true);
  assert.equal(client.protocol, 'v1'); assert(Date.now() - start < 2500);
  assert.equal(native.counts.info, 0); assert.equal(native.counts.writes, 0); assert.equal(native.sessions.size, 0);
});

test('issue21: bounded candidate and metadata probes distinguish API, auth and offline errors', async t => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-probe-errors-'));
  let mode = 'v2', writes = 0;
  const paths: string[] = [];
  const server = createServer((req, res) => {
    const route = new URL(req.url!, 'http://localhost').pathname; paths.push(route);
    if (req.method !== 'GET') writes++;
    if (mode === 'hang-all' || mode === 'v2' && route === '/global/health' || mode === 'hang-metadata' && route === '/agent') return;
    res.setHeader('content-type', 'application/json');
    if (mode === 'v2-health500' && route === '/global/health') { res.statusCode = 500; res.end('{}'); return; }
    if (mode === 'auth') { res.statusCode = 401; res.end('{}'); return; }
    const v1 = mode === 'hang-metadata' || mode === 'bad-v1';
    const body = route === '/global/health' ? (v1 ? { healthy: true, version: '1.2.22.h0.r1' } : {})
      : route === '/api/info' ? (mode === 'bad' ? {} : { version: '2.0.24' })
      : route === '/api/agent' ? { data: [{ id: 'build' }] }
      : route === '/api/model/default' ? { data: null }
      : route === '/api/model' ? { data: [] }
      : route === '/api/config' ? [] : {};
    res.end(JSON.stringify(body));
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); rmSync(root, { recursive: true, force: true }); });
  const passwordFile = resolve(root, 'password'); writeFileSync(passwordFile, 'synthetic');
  const client = new OpenCodeClient(opencodeSchema.parse({ adapter: 'opencode', agentId: 'a', name: 'A', workspace: root, passwordFile, serverUrl: 'http://127.0.0.1:' + (server.address() as { port: number }).port, inheritNativeCli: true }));
  let start = Date.now(); assert.equal((await client.probe()).version, '2.0.24'); assert.equal(client.protocol, 'v2'); assert(Date.now() - start < 2500);
  mode = 'v2-health500'; assert.equal((await client.probe()).version, '2.0.24'); assert.equal(client.protocol, 'v2');
  for (mode of ['bad', 'hang-all', 'hang-metadata', 'bad-v1', 'auth']) {
    paths.length = 0; start = Date.now();
    await assert.rejects(client.probe(), { code: mode === 'auth' ? 'OPENCODE_HTTP_401' : 'OPENCODE_API_UNSUPPORTED' });
    assert(Date.now() - start < 5000, mode + ' must not consume the business/startup budget');
    assert.equal(client.protocol, undefined, 'failed recheck must not leave a stale protocol');
    if (mode === 'bad-v1' || mode === 'hang-metadata') assert(!paths.includes('/api/info'));
  }
  assert.equal(writes, 0);
  server.closeAllConnections(); await new Promise<void>(done => server.close(() => done()));
  await assert.rejects(client.probe(), { code: 'NATIVE_UNAVAILABLE' });
});
