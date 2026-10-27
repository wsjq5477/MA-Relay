const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {EventEmitter} = require('node:events');
const {PassThrough, Writable} = require('node:stream');
function fixture(t, native = false, deferDistribution = false) {
  const child = new EventEmitter(), writes = [], timers = new Map();
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.stdin = new Writable({write(bytes, _encoding, done) {writes.push(JSON.parse(bytes.toString())); done();}});
  child.kill = () => child.emit('exit', 1, null);
  child.stdin.on('finish', () => child.emit('exit', 0, null));
  const module = {exports: {}};
  const distributionCallbacks = []; let spawns = 0;
  const timeout = (fn, ms) => {const token = {fn, ms}; timers.set(token, token); return token;};
  const context = {module, exports: module.exports, Buffer, process: {platform: 'win32', execPath: 'C:\\node.exe', env: {}},
    setTimeout: timeout, clearTimeout: token => timers.delete(token), require(name) {
      if (name === 'node:child_process') return {spawn: () => {spawns++; return child;}, execFile(_command, _args, _options, cb) {if (deferDistribution) distributionCallbacks.push(cb); else cb(null, Buffer.from('Ubuntu\r\n', 'utf16le'));}};
      return require(name);
    }};
  vm.runInNewContext(fs.readFileSync(process.env.AGENTBRIDGE_VERIFY_RPC || path.join(__dirname, '../electron/rpc.cjs'), 'utf8'), context);
  const host = new module.exports.HostConnection('C:\\bridge\\dist\\desktop-host.js', {distribution: 'Ubuntu', native});
  t.after(() => host.close());
  const ready = () => child.stdout.write(JSON.stringify({bridgeReady: 1, protocol: 'agentbridge-host-v1'}) + '\n');
  const reply = value => child.stdout.write(JSON.stringify({id: writes.at(-1).id, result: value}) + '\n');
  return {host, child, writes, timers, ready, reply, get spawns() {return spawns;}, distributionReady(index = distributionCallbacks.length - 1) {distributionCallbacks[index](null, Buffer.from('Ubuntu\r\n', 'utf16le'));}};
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('concurrent WSL calls send no bytes before the Linux reader confirms readiness', async t => {
  const f = fixture(t);
  const first = f.host.call('environment'), second = f.host.call('mcp.status', {nodeId: 'fixture', adapter: 'codex'});
  await tick(); assert.equal(f.writes.length, 0);
  f.ready(); await tick(); assert.equal(f.writes.length, 2);
  for (const input of f.writes) f.child.stdout.write(JSON.stringify({id: input.id, result: input.method}) + '\n');
  assert.equal(await first, 'environment'); assert.equal(await second, 'mcp.status');
});
test('WSL startup exit and old peers without readiness reject before dispatch and never replay', async t => {
  for (const kind of ['exit', 'timeout', 'malformed', 'close']) {
    const f = fixture(t), promise = f.host.call('ipc', {op: 'submit', requestId: 'stable-original'});
    const rejected = assert.rejects(promise, error => error.code === 'WSL_HOST_NOT_READY' && error.executionNotDispatched === true);
    await tick(); assert.equal(f.writes.length, 0);
    if (kind === 'exit') f.child.emit('exit', 1, null);
    if (kind === 'timeout') [...f.timers.values()].find(timer => timer.ms === 120000).fn();
    if (kind === 'malformed') f.child.stdout.write('not protocol\n');
    if (kind === 'close') f.host.close();
    await rejected; assert.equal(f.writes.length, 0);
  }
});

test('a slow WSL cold import retains a bounded startup wait without consuming or sending a business request', async t => {
  const f=fixture(t), result=f.host.call('environment');
  await tick();
  assert.equal(f.writes.length,0);
  assert.equal([...f.timers.values()].filter(timer=>timer.ms===120000).length,1);
  assert.equal([...f.timers.values()].filter(timer=>timer.ms===30000).length,0);
  f.ready();await tick();assert.equal(f.writes.length,1);
  f.reply({platform:'linux'});assert.equal((await result).platform,'linux');
});
test('a response lost after readiness remains unknown and is never relabeled not dispatched', async t => {
  const f = fixture(t), promise = f.host.call('ipc', {op: 'submit', requestId: 'stable-original'});
  const rejected = assert.rejects(promise, error => error.code === 'DESKTOP_TRANSPORT' && !error.executionNotDispatched);
  await tick(); f.ready(); await tick(); assert.equal(f.writes.length, 1);
  f.child.emit('exit', 1, null); await rejected; assert.equal(f.writes.length, 1);
});
test('native transports retain the existing immediate request contract', async t => {
  const f = fixture(t, true), promise = f.host.call('environment');
  await tick(); assert.equal(f.writes.length, 1);
  f.ready(); f.reply({platform: 'win32'}); assert.equal((await promise).platform, 'win32');
});
test('closing while WSL distribution enumeration is pending cancels the original startup before spawn', async t => {
  const f = fixture(t, false, true);
  const promise = f.host.call('ipc', {op: 'submit', requestId: 'original-before-close'});
  const rejected = assert.rejects(promise, error => error.code === 'WSL_HOST_NOT_READY' && error.executionNotDispatched === true);
  f.host.close(); f.distributionReady(); await tick();
  assert.equal(f.spawns, 0, 'A closed preflight must not create a late WSL host');
  assert.equal(f.writes.length, 0); await rejected;
});
test('a late closed preflight cannot clear or join the new explicit startup', async t => {
  const f = fixture(t, false, true);
  const original = f.host.call('ipc', {op: 'submit', requestId: 'original-before-close'});
  const rejected = assert.rejects(original, error => error.executionNotDispatched === true);
  f.host.close();
  const fresh = f.host.call('environment'), starting = f.host.starting;
  f.distributionReady(0); await tick(); await rejected;
  assert.equal(f.host.starting, starting); assert.equal(f.spawns, 0);
  const concurrent = f.host.call('environment');
  f.distributionReady(1); await tick(); assert.equal(f.spawns, 1); f.ready(); await tick();
  assert.equal(f.writes.length, 2); assert(f.writes.every(row => row.method === 'environment'));
  for (const row of f.writes) f.child.stdout.write(JSON.stringify({id: row.id, result: 'fresh'}) + '\n');
  assert.equal(await fresh, 'fresh'); assert.equal(await concurrent, 'fresh');
});
test('closing after the WSL ready frame but before the original call resumes still proves no dispatch', async t => {
  const f = fixture(t), original = f.host.call('ipc', {op: 'submit', requestId: 'ready-before-close'});
  const rejected = assert.rejects(original, error => error.code === 'WSL_HOST_NOT_READY' && error.executionNotDispatched === true);
  await tick(); f.ready(); f.host.close(); await rejected; assert.equal(f.writes.length, 0);
});
test('closing native startup before its first write preserves the same no-dispatch boundary', async t => {
  const f = fixture(t, true), original = f.host.call('ipc', {op: 'submit', requestId: 'native-before-close'});
  const rejected = assert.rejects(original, error => error.code === 'DESKTOP_TRANSPORT' && error.executionNotDispatched === true);
  f.host.close(); await rejected; assert.equal(f.writes.length, 0);
});
