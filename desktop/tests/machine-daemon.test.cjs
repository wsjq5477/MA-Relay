const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { PassThrough, Duplex } = require('node:stream');
const { FrameDecoder, FramedStream, encodeFrame, MAX_FRAME_BYTES } = require('../electron/machine-protocol.cjs');
const { startDaemon, ensureDaemon, inspectDaemon, identity, socketPathFor } = require('../electron/machine-daemon.cjs');
const { runRelay } = require('../electron/machine-relay.cjs');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const failure = code => Object.assign(new Error(code), { code });
function setup(t, overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-i06-daemon-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { stateDirectory: path.join(directory, 'state'), ownerCoordinatorId: 'coordinator-test', profileId: 'profile-test', monitorIntervalMs: 0, ...overrides };
}
function hostFixture() {
  let executions = 0, closed = 0, handler;
  const receipts = new Map(), tasks = [];
  return {
    receipts, tasks,
    get executions() { return executions; }, get closed() { return closed; },
    setCollaboration(value) { handler = value; },
    callback(...args) { return handler(...args); },
    close() { closed++; },
    async call(method, params) {
      if (method === 'snapshot') return { agents: { items: [] }, tasks, conversations: [] };
      if (method === 'discover') return { items: [{ adapter: 'opencode', name: 'OpenCode', healthy: true }] };
      if (method === 'environment') return { platform: 'linux', home: '/home/test' };
      if (method === 'ipc' && params.op === 'submit') {
        executions++; await wait(20);
        const result = { requestId: params.requestId, taskId: 'task-' + executions, conversationId: 'session-' + executions, status: 'running' };
        receipts.set(params.requestId, result); tasks.push(result); return result;
      }
      if (method === 'ipc' && params.op === 'continue') {
        executions++; const result = { requestId: params.requestId, taskId: 'task-' + executions, conversationId: params.conversationId, status: 'running' };
        receipts.set(params.requestId, result); tasks.push(result); return result;
      }
      if (method === 'ipc' && params.op === 'request') {
        if (!receipts.has(params.requestId)) throw failure('NOT_FOUND'); return receipts.get(params.requestId);
      }
      throw failure('INVALID_INPUT');
    },
  };
}
async function client(t, options, hello = {}, timeoutMs = 3000) {
  const socket = net.createConnection(socketPathFor(options.stateDirectory)), channel = new FramedStream(socket), pending = new Map(), events = [], callbacks = [];
  let counter = 0;
  channel.on('error', error => { for (const job of pending.values()) job.reject(error); pending.clear(); });
  channel.on('close', () => { for (const job of pending.values()) job.reject(failure('DAEMON_TRANSPORT')); pending.clear(); });
  channel.on('frame', frame => {
    if (frame.type === 'event') { events.push(frame); return; }
    if (frame.bridgeTool) { callbacks.push(frame); return; }
    const job = pending.get(frame.id); if (!job) return;
    pending.delete(frame.id); clearTimeout(job.timer);
    frame.error ? job.reject(Object.assign(new Error(frame.error.message), { code: frame.error.code })) : job.resolve(frame.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = 'test-' + ++counter, timer = setTimeout(() => { pending.delete(id); reject(failure('TEST_TIMEOUT')); }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    try { channel.send({ id, method, params }); } catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
  t.after(() => channel.close());
  const peer = await call('hello', { protocolVersion: 2, coordinatorId: options.ownerCoordinatorId, profileId: options.profileId, nonce: 'nonce-' + Math.random().toString(16).slice(2), ...hello });
  return { peer, channel, call, events, callbacks };
}

test('4BE framing preserves Chinese and emoji across every byte and coalesced messages', () => {
  const decoder = new FrameDecoder(), received = [], errors = [];
  decoder.on('frame', frame => received.push(frame)); decoder.on('error', error => errors.push(error));
  const first = { id: '1', result: '跨设备连接 🧑‍💻' }, second = { id: '2', result: { done: true } };
  for (const byte of encodeFrame(first)) decoder.push(Buffer.from([byte]));
  decoder.push(Buffer.concat([encodeFrame(second), encodeFrame(first)])); decoder.end();
  assert.deepEqual(received, [first, second, first]); assert.equal(errors.length, 0);
});

test('frame decoder rejects oversized headers before allocation, malformed UTF-8 and truncation', () => {
  const decode = chunks => { const decoder = new FrameDecoder(), errors = []; decoder.on('error', e => errors.push(e)); chunks.forEach(c => decoder.push(c)); decoder.end(); return errors; };
  const header = Buffer.alloc(4); header.writeUInt32BE(MAX_FRAME_BYTES + 1);
  assert.equal(decode([header])[0].code, 'PROTOCOL_LIMIT');
  const invalid = Buffer.from([0, 0, 0, 3, 0x22, 0xff, 0x22]); assert.equal(decode([invalid])[0].code, 'PROTOCOL_JSON');
  assert.equal(decode([encodeFrame({ id: 'x' }).subarray(0, 6)])[0].code, 'PROTOCOL_TRUNCATED');
  assert.throws(() => encodeFrame({ result: 'x'.repeat(MAX_FRAME_BYTES) }), { code: 'PROTOCOL_LIMIT' });
});

test('private daemon identity rejects symlinks, conflicting profile and ordinary socket files', async t => {
  const opts = setup(t), host = hostFixture(), daemon = await startDaemon({ ...opts, hostFactory: () => host }); t.after(() => daemon.close());
  await assert.rejects(startDaemon({ ...opts, ownerCoordinatorId: 'different', hostFactory: () => host }), { code: 'DAEMON_OWNER_CONFLICT' });
  const target = path.join(path.dirname(opts.stateDirectory), 'linked'); fs.symlinkSync(opts.stateDirectory, target);
  assert.throws(() => identity({ ...opts, stateDirectory: target }), { code: 'DAEMON_OWNERSHIP' });
  const another = setup(t); identity(another); fs.writeFileSync(socketPathFor(another.stateDirectory), 'unrelated file', { mode: 0o600 });
  await assert.rejects(startDaemon({ ...another, hostFactory: () => host }), { code: 'DAEMON_OWNERSHIP' });
  assert.equal(fs.readFileSync(socketPathFor(another.stateDirectory), 'utf8'), 'unrelated file');
});

test('daemon socket is private at bind time and restores the caller umask', async t => {
  const opts = setup(t), originalListen = net.Server.prototype.listen;
  const previousMask = process.umask(0o022);
  let boundMode;
  t.after(() => { net.Server.prototype.listen = originalListen; process.umask(previousMask); });
  net.Server.prototype.listen = function (...args) {
    const result = originalListen.apply(this, args);
    if (args[0] === socketPathFor(opts.stateDirectory)) boundMode = fs.statSync(args[0]).mode & 0o777;
    return result;
  };
  const daemon = await startDaemon({ ...opts, hostFactory: () => hostFixture() });
  t.after(() => daemon.close());
  assert.equal(boundMode, 0o600);
  assert.equal(process.umask(), 0o022);
  assert.equal((await inspectDaemon(opts)).daemonId, daemon.info.daemonId);
});

test('daemon handshake binds owner, daemon identity and protocol before exposing native calls', async t => {
  const opts = setup(t), host = hostFixture(), daemon = await startDaemon({ ...opts, hostFactory: () => host }); t.after(() => daemon.close());
  const info = await inspectDaemon(opts); assert.equal(info.daemonId, daemon.info.daemonId); assert.equal(info.uid, process.getuid());
  await assert.rejects(client(t, opts, { protocolVersion: 1 }), { code: 'PROTOCOL_MISMATCH' });
  await assert.rejects(client(t, opts, { coordinatorId: 'other' }), { code: 'DAEMON_OWNER_CONFLICT' });
  await assert.rejects(client(t, opts, { expectedDaemonId: 'other-daemon' }), { code: 'MACHINE_IDENTITY_CHANGED' });
  const connection = await client(t, opts); assert.equal(connection.peer.version, require('../package.json').version);
  assert.equal((await connection.call('ping', { nonce: 'heartbeat' })).nonce, 'heartbeat');
  assert.equal((await connection.call('discover')).items[0].name, 'OpenCode');
  assert.equal(host.executions, 0);
});

test('one daemon per profile owns its socket and short paths safely support long user homes', async t => {
  const opts = setup(t, { stateDirectory: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ab-long-')), 'a'.repeat(100), 'profile') });
  const host = hostFixture(), daemon = await startDaemon({ ...opts, hostFactory: () => host });
  t.after(async () => { await daemon.close(); fs.rmSync(path.dirname(path.dirname(opts.stateDirectory)), { recursive: true, force: true }); fs.rmSync(path.dirname(daemon.info.socketPath), { recursive: true, force: true }); });
  assert(Buffer.byteLength(daemon.info.socketPath) < 104);
  await assert.rejects(startDaemon({ ...opts, hostFactory: () => host }), { code: 'DAEMON_ALREADY_RUNNING' });
  assert.equal((await inspectDaemon(opts)).daemonId, daemon.info.daemonId);
});

test('ten same-ID requests invoke native submit once and changed content cannot reuse an ID', async t => {
  const opts = setup(t), host = hostFixture(), daemon = await startDaemon({ ...opts, hostFactory: () => host }); t.after(() => daemon.close());
  const connection = await client(t, opts), params = { op: 'submit', requestId: 'single-submit', agentId: 'agent', message: '执行需求' };
  const results = await Promise.all(Array.from({ length: 10 }, () => connection.call('ipc', params)));
  assert(results.every(result => result.taskId === results[0].taskId)); assert.equal(host.executions, 1);
  await assert.rejects(connection.call('ipc', { ...params, message: '内容改变' }), { code: 'REQUEST_CONFLICT' });
  const record = await connection.call('daemon.receiptRead', { requestId: params.requestId }); assert.equal(record.state, 'confirmed');
  await assert.rejects(connection.call('ipc', { ...params, requestId: 'large', message: '中'.repeat(22000) }), { code: 'INVALID_INPUT' });
  assert.equal(host.executions, 1);
});

test('closing a relay preserves running tasks and reconnect continuation uses the original native session', async t => {
  const opts = setup(t), host = hostFixture(), daemon = await startDaemon({ ...opts, hostFactory: () => host }); t.after(() => daemon.close());
  const input = new PassThrough(), output = new PassThrough(), frames = [], decoder = new FrameDecoder();
  decoder.on('error', () => {}); decoder.on('frame', f => frames.push(f)); output.on('data', b => decoder.push(b));
  const relay = runRelay(opts, { input, output });
  input.write(encodeFrame({ id: 'hello', method: 'hello', params: { protocolVersion: 2, coordinatorId: opts.ownerCoordinatorId, profileId: opts.profileId, nonce: 'relay-session' } }));
  for (let i = 0; i < 50 && !frames.find(f => f.id === 'hello'); i++) await wait(10);
  assert(frames.find(f => f.id === 'hello')?.result.daemonId);
  input.write(encodeFrame({ id: 'submit', method: 'ipc', params: { op: 'submit', requestId: 'relay-job', agentId: 'a', message: 'run' } }));
  await wait(5); input.end(); await relay;
  await wait(40); assert.equal(host.executions, 1); assert.equal(host.closed, 0); assert.equal(host.tasks[0].status, 'running');
  const connection = await client(t, opts), original = await connection.call('ipc', { op: 'request', requestId: 'relay-job' });
  const continued = await connection.call('ipc', { op: 'continue', requestId: 'relay-followup', conversationId: original.conversationId, message: 'continue' });
  assert.equal(continued.conversationId, original.conversationId); assert.equal(host.executions, 2);
});

test('restart keeps daemon ID and receipts; missing backend receipt remains unknown without replay', async t => {
  const opts = setup(t), host = hostFixture(), first = await startDaemon({ ...opts, hostFactory: () => host });
  const connection = await client(t, opts), original = await connection.call('ipc', { op: 'submit', requestId: 'retained', message: 'start' });
  const daemonId = first.info.daemonId; connection.channel.close(); await first.close();
  const file = path.join(opts.stateDirectory, 'daemon-receipts.json'), records = JSON.parse(fs.readFileSync(file));
  records.push({ key: 'unknown', method: 'ipc', op: 'submit', fingerprint: 'unknown', state: 'dispatched' }); fs.writeFileSync(file, JSON.stringify(records), { mode: 0o600 });
  const restarted = await startDaemon({ ...opts, hostFactory: () => host }); t.after(() => restarted.close());
  const next = await client(t, opts); assert.equal(next.peer.daemonId, daemonId); assert(next.peer.generation > connection.peer.generation);
  assert.equal((await next.call('ipc', { op: 'request', requestId: 'retained' })).taskId, original.taskId);
  await assert.rejects(next.call('ipc', { op: 'request', requestId: 'unknown' }), { code: 'DESKTOP_UNCONFIRMED' });
  assert.equal(host.executions, 1);
});

test('inspect never fences a live coordinator; new hello fences stale callbacks and event cursors survive restart', async t => {
  const opts = setup(t), host = hostFixture(), daemon = await startDaemon({ ...opts, hostFactory: () => host });
  const first = await client(t, opts), pending = host.callback({ nodeId: 'leader', parentRequestId: 'parent' }, 'list_agents', {}, 'native-call');
  const rejection = assert.rejects(pending, { code: 'COLLABORATION_OFFLINE' });
  await wait(5); assert.equal(first.callbacks.length, 1);
  await inspectDaemon(opts); assert.equal((await first.call('ping')).generation, first.peer.generation);
  const second = await client(t, opts); await rejection; assert(second.peer.generation > first.peer.generation);
  const event = daemon.emitEvent('task.changed', { taskId: 'real-task', status: 'running' });
  assert.equal((await second.call('daemon.eventRead', { afterCursor: 0 })).items[0].cursor, event.cursor);
  const callback = host.callback({ nodeId: 'leader', parentRequestId: 'new-parent' }, 'list_agents', {}, 'next-call');
  await wait(5); const wire = second.callbacks[0]; second.channel.send({ bridgeReply: wire.id, result: { items: ['child'] } });
  assert.deepEqual(await callback, { items: ['child'] });
  second.channel.close(); await daemon.close();
  const restarted = await startDaemon({ ...opts, hostFactory: () => host }); t.after(() => restarted.close());
  const third = await client(t, opts), history = await third.call('daemon.eventRead', { afterCursor: 0 });
  assert.equal(history.items[0].name, 'task.changed'); assert.equal(restarted.emitEvent('task.changed', {}).cursor, event.cursor + 1);
});

test('production daemon loads built DesktopHost and real MachineHost without creating native tasks', { skip: !fs.existsSync(path.join(__dirname, '../../dist/desktop-host.js')) }, async t => {
  const opts = setup(t), daemon = await startDaemon(opts); t.after(() => daemon.close());
  const connection = await client(t, opts, {}, 15000), environment = await connection.call('environment');
  assert.equal(environment.platform, 'linux'); assert.equal(environment.directory, opts.stateDirectory);
  const detected = await connection.call('discover'); assert(Array.isArray(detected.items));
  const snapshot = await connection.call('snapshot'); assert.equal(snapshot.tasks.length, 0);
  const codex = detected.items.find(tool => tool.adapter === 'codex' && tool.healthy);
  if (codex) {
    const context = await connection.call('context', { nodeId: 'production-codex', adapter: codex.adapter, executable: codex.executable });
    assert.equal(context.adapter, 'codex'); assert(context.agentId);
    const contextual = await connection.call('snapshot'); assert.equal(contextual.tasks.length, 0); assert.equal(contextual.agents.items.length, 1);
  }
});

test('uncertain cancellation recovery retains original task identity', async t => {
  const opts = setup(t), calls = [], host = { close() {}, async call(method, params) {
    calls.push({ method, params });
    if (params.op === 'cancel') throw failure('DESKTOP_TRANSPORT');
    if (params.op === 'operation') { assert.equal(params.taskId, 'owned-task'); return { operationId: params.operationId, taskId: params.taskId, state: 'confirmed' }; }
    throw failure('NOT_FOUND');
  } };
  const daemon = await startDaemon({ ...opts, hostFactory: () => host }); t.after(() => daemon.close());
  const connection = await client(t, opts), params = { op: 'cancel', operationId: 'cancel-original', taskId: 'owned-task', executionId: 'execution-original' };
  await assert.rejects(connection.call('ipc', params), { code: 'DESKTOP_TRANSPORT' });
  assert.equal((await connection.call('ipc', { op: 'operation', operationId: params.operationId })).taskId, 'owned-task');
  assert.equal(calls.filter(call => call.params.op === 'cancel').length, 1);
});

test('blocked transport rejects excess queued bytes and daemon rejects request 65', async t => {
  const stream = new Duplex({ highWaterMark: 16, read() {}, write() {} }), channel = new FramedStream(stream, { maxQueueBytes: 100 });
  channel.on('error', () => {}); channel.send({ result: 'x'.repeat(40) });
  assert.throws(() => channel.send({ result: 'y'.repeat(40) }), { code: 'PROTOCOL_BACKPRESSURE' }); channel.close();
  const opts = setup(t), resolves = [], host = { close() {}, async call() { return new Promise(resolve => resolves.push(resolve)); } };
  const daemon = await startDaemon({ ...opts, hostFactory: () => host }); t.after(() => daemon.close());
  const connection = await client(t, opts), requests = Array.from({ length: 64 }, () => connection.call('snapshot'));
  await assert.rejects(connection.call('snapshot'), { code: 'DAEMON_BUSY' });
  resolves.forEach(resolve => resolve({ agents: { items: [] }, tasks: [], conversations: [] })); await Promise.all(requests);
});

test('real detached ensure calls reuse one verified daemon and it survives its bootstrap parent', { skip: !fs.existsSync(path.join(__dirname, '../../dist/desktop-host.js')) }, async t => {
  const opts = setup(t), ensured = await Promise.all([ensureDaemon(opts), ensureDaemon(opts)]);
  assert.equal(ensured[0].daemonId, ensured[1].daemonId); assert.equal(ensured[0].pid, ensured[1].pid);
  const pid = ensured[0].pid;
  t.after(async () => {
    // The PID came from an identity-checked private socket in this test profile.
    try { process.kill(pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    for (let i = 0; i < 100; i++) { try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') return; throw error; } await wait(10); }
    throw new Error('Owned daemon did not exit after SIGTERM');
  });
  assert.equal((await ensureDaemon(opts)).started, false);
  assert.equal((await inspectDaemon(opts)).pid, pid);
  const connection = await client(t, opts); assert.equal((await connection.call('snapshot')).tasks.length, 0);
  connection.channel.close(); await wait(25); assert.equal((await inspectDaemon(opts)).pid, pid);
});

test('native unhealthy is a stable pre-execution rejection; same ID and original query never execute again', async t => {
  const opts=setup(t);let submits=0;
  const host={close(){},async call(method,p){if(method==='ipc'&&p.op==='submit'){submits++;throw failure('AGENT_UNHEALTHY');}throw failure('NOT_FOUND');}};
  const first=await startDaemon({...opts,hostFactory:()=>host}),peer=await client(t,opts),params={op:'submit',requestId:'not-ready',agentId:'agent',message:'same message'};
  await assert.rejects(peer.call('ipc',params),{code:'AGENT_UNHEALTHY'});
  assert.equal((await peer.call('daemon.receiptRead',{requestId:params.requestId})).state,'rejected');
  peer.channel.close();await first.close();
  const restarted=await startDaemon({...opts,hostFactory:()=>host});t.after(()=>restarted.close());const next=await client(t,opts);
  await assert.rejects(next.call('ipc',params),{code:'AGENT_UNHEALTHY'});
  await assert.rejects(next.call('ipc',{op:'request',requestId:params.requestId}),{code:'AGENT_UNHEALTHY'});
  assert.equal(submits,1);
});

test('original read reconciles only durable unhealthy rejection; missing native receipts remain unknown', async t => {
  const opts=setup(t);identity(opts);
  const rows=[{key:'old-unhealthy',method:'ipc',op:'submit',state:'unknown',error:{code:'AGENT_UNHEALTHY',message:'Agent is unhealthy'}},{key:'transport-unknown',method:'ipc',op:'submit',state:'unknown',error:{code:'DESKTOP_TRANSPORT',message:'reply lost'}}];
  fs.writeFileSync(path.join(opts.stateDirectory,'daemon-receipts.json'),JSON.stringify(rows),{mode:0o600});
  let queries=0,submits=0;const host={close(){},async call(method,p){if(p.op==='submit')submits++;else queries++;throw failure('NOT_FOUND');}};
  const daemon=await startDaemon({...opts,hostFactory:()=>host});t.after(()=>daemon.close());const peer=await client(t,opts);
  await assert.rejects(peer.call('ipc',{op:'request',requestId:'old-unhealthy'}),{code:'AGENT_UNHEALTHY'});
  assert.equal((await peer.call('daemon.receiptRead',{requestId:'old-unhealthy'})).state,'rejected');
  assert.equal(queries,0);assert.equal(submits,0);
  await assert.rejects(peer.call('ipc',{op:'request',requestId:'transport-unknown'}),{code:'DESKTOP_UNCONFIRMED'});
  assert.equal((await peer.call('daemon.receiptRead',{requestId:'transport-unknown'})).state,'unknown');
  assert.equal(queries,1);assert.equal(submits,0);
});

test('unknown native control receipt remains unknown through daemon restart; original query confirms it without another cancellation',async t=>{
 const opts=setup(t),calls=[];let confirmed=false;
 const host={close(){},setCollaboration(){},async call(method,p){calls.push(p?.op||method);if(method==='snapshot')return {agents:{items:[]},tasks:[],conversations:[]};if(p.op==='cancel'||p.op==='operation')return {operationId:p.operationId,taskId:'original-task',state:confirmed?'confirmed':'unknown'};throw failure('NOT_FOUND');}};
 let daemon=await startDaemon({...opts,hostFactory:()=>host});const first=await client(t,opts);
 assert.equal((await first.call('ipc',{op:'cancel',operationId:'cancel-unknown',taskId:'original-task'})).state,'unknown');assert.equal((await first.call('daemon.receiptRead',{operationId:'cancel-unknown'})).state,'unknown');
 first.channel.close();await daemon.close();daemon=await startDaemon({...opts,hostFactory:()=>host});t.after(()=>daemon.close());const second=await client(t,opts);
 assert.equal((await second.call('ipc',{op:'operation',operationId:'cancel-unknown',taskId:'original-task'})).state,'unknown');await assert.rejects(second.call('daemon.quiesce',{operationId:'maintenance'}),{code:'DAEMON_BUSY'});
 confirmed=true;assert.equal((await second.call('ipc',{op:'operation',operationId:'cancel-unknown',taskId:'original-task'})).state,'confirmed');assert.equal(calls.filter(c=>c==='cancel').length,1);
 assert.equal((await second.call('daemon.quiesce',{operationId:'maintenance'})).quiescent,true);await assert.rejects(second.call('ipc',{op:'submit',requestId:'blocked',message:'blocked'}),{code:'DAEMON_MAINTENANCE'});assert.equal((await second.call('daemon.releaseMaintenance',{operationId:'maintenance'})).released,true);
});

test('permission and form lost acknowledgements query original receipts after restart and cannot read a foreign task operation',async t=>{
 const opts=setup(t),effects=new Map();let received=0;
 const host={close(){},setCollaboration(){},async call(method,p){if(p.op==='reply'){received++;const r={operationId:p.reply.operationId,taskId:p.taskId,state:'confirmed'};effects.set(r.operationId,r);throw failure('DESKTOP_TRANSPORT');}if(p.op==='operation'){if(!effects.has(p.operationId))throw failure('NOT_FOUND');return effects.get(p.operationId);}throw failure('ADAPTER_UNSUPPORTED');}};
 let daemon=await startDaemon({...opts,hostFactory:()=>host}),one=await client(t,opts);
 for(const action of ['permission','form'])await assert.rejects(one.call('ipc',{op:'reply',taskId:'owned-task',reply:{operationId:'original-'+action,action,taskId:'owned-task',executionId:'owned-execution',requestId:'interaction',...(action==='permission'?{decision:'once'}:{answer:{field:'synthetic'}})}}),{code:'DESKTOP_TRANSPORT'});
 one.channel.close();await daemon.close();daemon=await startDaemon({...opts,hostFactory:()=>host});t.after(()=>daemon.close());const two=await client(t,opts);
 await assert.rejects(two.call('ipc',{op:'operation',operationId:'original-form',taskId:'other-task'}),{code:'EXECUTION_MISMATCH'});
 for(const action of ['permission','form'])assert.equal((await two.call('ipc',{op:'operation',operationId:'original-'+action,taskId:'owned-task'})).state,'confirmed');assert.equal(received,2);
 const journal=fs.readFileSync(path.join(opts.stateDirectory,'daemon-receipts.json'),'utf8');assert(!journal.includes('synthetic'));
});
test('foreign native control receipt IDs never confirm the original action and rejected original controls remain readable',async t=>{
 const opts=setup(t);let effect=0,queryState='rejected';
 const host={close(){},async call(_m,p){if(p.op==='cancel'){effect++;return {operationId:'foreign',state:'confirmed'};}if(p.op==='operation')return {operationId:p.operationId,state:queryState,taskId:'owned'};throw failure('NOT_FOUND');}};
 const d=await startDaemon({...opts,hostFactory:()=>host});t.after(()=>d.close());const c=await client(t,opts);assert.equal((await c.call('ipc',{op:'cancel',taskId:'owned',operationId:'original'})).state,'unknown');
 assert.equal((await c.call('ipc',{op:'operation',taskId:'owned',operationId:'original'})).state,'rejected');assert.equal((await c.call('ipc',{op:'operation',taskId:'owned',operationId:'original'})).state,'rejected');assert.equal(effect,1);
});

test('authenticated daemon exposes MCP configuration methods and blocks configuration writes during maintenance',async t=>{
 const opts=setup(t),host=hostFixture(),original=host.call.bind(host),calls=[];
 host.call=async(method,params)=>{if(method.startsWith('mcp.')){calls.push(method);return {nodeId:params.nodeId,state:'absent'};}return original(method,params);};
 const daemon=await startDaemon({...opts,hostFactory:()=>host});t.after(()=>daemon.close());const connection=await client(t,opts);
 for(const method of ['mcp.status','mcp.install','mcp.export','mcp.remove'])assert.equal((await connection.call(method,{nodeId:'node',adapter:'claude'})).nodeId,'node');
 await connection.call('daemon.quiesce',{operationId:'maintenance'});
 await assert.rejects(connection.call('mcp.install',{nodeId:'node',adapter:'claude'}),{code:'DAEMON_MAINTENANCE'});
 await connection.call('mcp.status',{nodeId:'node',adapter:'claude'});assert.equal(calls.length,5);assert.equal(host.executions,0);
});
