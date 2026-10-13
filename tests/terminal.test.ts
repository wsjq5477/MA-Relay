import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { SettingsStore } from '../src/settings.js';
import { ipc, ensureController } from '../src/controller.js';
import { safeTerminal } from '../src/terminal.js';

class Tty {
  output = ''; all = ''; pending = ''; code: number | undefined;
  child;
  constructor(dir: string, cwd: string, extra: string[] = [], env = process.env) {
    this.child = spawn('python3', [resolve('scripts/pty-driver.py'), process.execPath, '--disable-warning=ExperimentalWarning', resolve('dist/cli.js'), '--dir', dir, ...extra], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child.stdout.on('data', chunk => {
      this.pending += chunk.toString(); let end: number;
      while ((end = this.pending.indexOf('\n')) >= 0) {
        const item = JSON.parse(this.pending.slice(0, end)) as { output?: string; exit?: number }; this.pending = this.pending.slice(end + 1);
        if (item.output) { const s = safeTerminal(item.output); this.output += s; this.all += s; }
        if (item.exit !== undefined) this.code = item.exit;
      }
    });
  }
  send(keys: string) { this.child.stdin.write(JSON.stringify({ send: keys }) + '\n'); }
  async expect(needle: string, response?: string) {
    for (let i = 0; i < 1000; i++) {
      const index = this.output.indexOf(needle);
      if (index >= 0) { this.output = this.output.slice(index + needle.length); if (response !== undefined) this.send(response); return; }
      if (this.code !== undefined) throw new Error('TTY exited ' + this.code + ' before ' + needle + ': ' + this.all);
      await delay(20);
    }
    throw new Error('TTY missing ' + needle + ': ' + this.all);
  }
  async exitCode(expected: number) { for (let i = 0; i < 200 && this.code === undefined; i++) await delay(20); assert.equal(this.code, expected, this.all); }
  async cleanup() { if (this.code === undefined) { this.send('\x03'); for (let i = 0; i < 100 && this.code === undefined; i++) await delay(20); } this.child.stdin.end(); }
}
function installed(root: string, broken = false) {
  const bin = resolve(root, 'bin'); mkdirSync(bin);
  const executable = resolve(bin, 'opencode'), reads = resolve(root, 'requests.jsonl');
  writeFileSync(executable, `#!/usr/bin/env node
import {createServer} from 'node:http'; import {appendFileSync} from 'node:fs';
if(process.argv.includes('--version')) { console.log('opencode v2.0.24'); process.exit(0); }
${broken ? 'process.exit(1);' : ''}
const port=Number(process.argv[process.argv.indexOf('--port')+1]);
createServer((req,res)=>{
 appendFileSync(${JSON.stringify(reads)}, JSON.stringify({method:req.method,url:req.url})+'\\n');
 res.setHeader('content-type','application/json');
 if(req.headers.authorization!=='Basic '+Buffer.from('opencode:'+(process.env.OPENCODE_PASSWORD||'terminal-fixture-secret')).toString('base64')) {res.statusCode=401; res.end('{}');return;}
 const path=new URL(req.url,'http://localhost').pathname;
 const model={providerID:'fixture',id:'local'};
 const value=path==='/api/info'?{version:'2.0.24'}:path==='/api/model/default'?{data:model}:path==='/api/model'?{data:[model]}:path==='/api/agent'?{data:[{id:'build'}]}:{data:[]};
 res.end(JSON.stringify(value));
}).listen(port,'127.0.0.1',()=>{console.log('server password terminal-fixture-secret');console.log('server listening on http://127.0.0.1:'+port);});
`, { mode: 0o700 });
  return { executable, reads, env: { ...process.env, PATH: bin + ':' + process.env.PATH, HOME: root } };
}
async function stop(dir: string) { try { await ipc(dir, { op: 'stop' }); await delay(400); } catch { /* no controller */ } }

test('TTY discovers OpenCode, space-selects and connects without configuration questions or model calls', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-quick-')), dir = resolve(root, 'bridge'); const native = installed(root);
  let tty = new Tty(dir, root, [], native.env);
  try {
    await tty.expect('选择要连接的 Agent', ' \r');
    await tty.expect('✓ 已连接'); await tty.expect('下一步');
    const settings = new SettingsStore(dir).read(); assert.equal(settings.agents.length, 1);
    assert.equal(settings.agents[0]!.executable, native.executable); assert.equal(settings.agents[0]!.workspace, root);
    assert.equal(settings.agents[0]!.managed, true); assert.equal(settings.agents[0]!.enabled, true);
    assert.equal(settings.agents[0]!.model, undefined); assert.equal(settings.connectOnStart, true);
    assert(!/连接名称|OpenCode 可执行文件|连接方式|原生 Agent|启用\?|保存草稿|确认连接|配置版本|生效.*期望/.test(tty.all));
    assert(!tty.all.includes('terminal-fixture-secret'));
    assert(readFileSync(native.reads, 'utf8').trim().split('\n').map(s => JSON.parse(s) as { method: string }).every(r => r.method === 'GET'));
    const before = await ipc<{ pid: number }>(dir, { op: 'status' });
    tty.send('\x1b[B'.repeat(10) + '\r'); await tty.exitCode(0); await tty.cleanup();
    assert.equal((await ipc<{ pid: number }>(dir, { op: 'status' })).pid, before.pid);
    tty = new Tty(dir, root, [], native.env); await tty.expect('✓ 已连接'); await tty.expect('下一步');
    assert(!tty.all.includes('选择要连接的 Agent')); assert.equal(new SettingsStore(dir).read().agents[0]!.agentId, settings.agents[0]!.agentId);
    assert.equal((await ipc<{ pid: number }>(dir, { op: 'status' })).pid, before.pid);
  } finally { await tty.cleanup(); await stop(dir); rmSync(root, { recursive: true, force: true }); }
});
test('TTY exposes real native startup failure instead of reporting a connected Agent', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-quick-fail-')), dir = resolve(root, 'bridge'); const native = installed(root, true);
  const tty = new Tty(dir, root, [], native.env);
  try {
    await tty.expect('选择要连接的 Agent', ' \r'); await tty.expect('OpenCode 启动后退出'); await tty.expect('下一步');
    assert(!tty.all.includes('✓ 已连接')); assert(tty.all.includes('连接失败'));
    assert.equal((await ipc<{ items: { startupError?: { code: string }; available: boolean }[] }>(dir, { op: 'agents' })).items[0]!.startupError?.code, 'NATIVE_EXITED');
  } finally { await tty.cleanup(); await stop(dir); rmSync(root, { recursive: true, force: true }); }
});
test('advanced setup can save an explicitly disabled draft without launching services', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-advanced-')), dir = resolve(root, 'bridge');
  const tty = new Tty(dir, root, ['setup', '--advanced']);
  try {
    for (const [label, value] of [['连接名称', 'Draft'], ['OpenCode 可执行文件', '/missing/opencode'], ['项目目录', root], ['连接方式', '1'], ['模型:', 'inherit'], ['原生 Agent', 'build'], ['文件修改需要逐次确认', 'y'], ['启用?', 'y'], ['1 保存草稿', '1']]) await tty.expect(label!, value + '\r');
    await tty.exitCode(0); const settings = new SettingsStore(dir).read();
    assert.equal(settings.agents.length, 1); assert.equal(settings.agents[0]!.enabled, false); assert.equal(settings.connectOnStart, false);
    assert.equal((await ipc<{ connected: boolean }>(dir, { op: 'status' })).connected, false);
  } finally { await tty.cleanup(); await stop(dir); rmSync(root, { recursive: true, force: true }); }
});
test('Ctrl+C and EOF at TTY menu exit cleanly while the existing controller survives', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-tty-exit-')); const store = new SettingsStore(root); const s = store.initialize();
  store.write({ ...s, revision: s.revision + 1, agents: [store.normalize({ agentId: 'draft', name: 'Draft', adapter: 'opencode', workspace: root, executable: '/missing', passwordFile: 'native.password', serverUrl: 'http://127.0.0.1:4318', enabled: false }, s.deviceId)] }, s.revision);
  await ensureController(root); const pid = (await ipc<{ pid: number }>(root, { op: 'status' })).pid;
  try {
    for (const key of ['\u0003', '\u0004']) {
      const tty = new Tty(root, root);
      try { await tty.expect('下一步'); tty.send(key); await tty.exitCode(130); assert.equal((await ipc<{ pid: number }>(root, { op: 'status' })).pid, pid); }
      finally { await tty.cleanup(); }
    }
  } finally { await stop(root); rmSync(root, { recursive: true, force: true }); }
});
