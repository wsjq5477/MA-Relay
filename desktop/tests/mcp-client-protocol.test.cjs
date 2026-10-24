'use strict';
// I08-MCP02: the standalone stdio server must answer the 2026-07-28
// `server/discover` probe. A JSON-RPC error there makes strict clients (OpenDesk
// Desktop 0.3.9) treat the whole connection as broken during tools/list.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawn } = require('node:child_process');
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-mcp-client-protocol-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function runServer(script, descriptor, requests, timeout = 8000) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [script, descriptor], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', error = '', settled = false;
    const done = value => { if (settled) return; settled = true; try { child.kill(); } catch {} resolve(value); };
    const timer = setTimeout(() => done({ output, error, timeout: true }), timeout);
    child.on('error', e => { clearTimeout(timer); done({ output, error: String(e.message) }); });
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.trim().split('\n').length >= requests.filter(item => item.id !== undefined).length) { clearTimeout(timer); setTimeout(() => done({ output, error }), 50); }
    });
    child.stderr.on('data', chunk => { error += chunk; });
    child.stdin.write(requests.map(item => JSON.stringify(item)).join('\n') + '\n');
  });
}
test('server/discover advertises the legacy protocol versions and never errors', async (t) => {
  const directory = fixture(t), descriptor = path.join(directory, 'endpoint.json');
  fs.writeFileSync(descriptor, JSON.stringify({ url: 'http://127.0.0.1:1/tools', token: 'probe' }), { mode: 0o600 });
  const { output, error } = await runServer(path.join(__dirname, '..', 'electron', 'mcp-client.cjs'), descriptor, [
    { jsonrpc: '2.0', id: 'discover', method: 'server/discover', params: {} },
  ]);
  const lines = output.trim().split('\n').map(line => JSON.parse(line));
  const reply = lines.find(line => line.id === 'discover');
  assert.ok(reply, 'server/discover must be answered: ' + error);
  assert.equal(reply.error, undefined);
  assert.ok(Array.isArray(reply.result.supportedVersions));
  assert.ok(reply.result.supportedVersions.includes('2025-06-18'));
  assert.equal(typeof reply.result.capabilities, 'object');
});
test('the legacy initialize and tools/list catalogue still work after the discover probe', async (t) => {
  const directory = fixture(t), descriptor = path.join(directory, 'endpoint.json');
  fs.writeFileSync(descriptor, JSON.stringify({ url: 'http://127.0.0.1:1/tools', token: 'probe' }), { mode: 0o600 });
  const { output } = await runServer(path.join(__dirname, '..', 'electron', 'mcp-client.cjs'), descriptor, [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'probe', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  ]);
  const lines = output.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(lines.find(line => line.id === 1).result.serverInfo.name, 'agentbridge');
  const tools = lines.find(line => line.id === 2).result.tools;
  assert.equal(tools.length, 10);
  assert.ok(tools.some(tool => tool.name === 'list_agents'));
});
