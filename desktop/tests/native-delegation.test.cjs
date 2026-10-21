const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { createHash } = require('node:crypto');
const { AgentNetwork } = require('../electron/agent-network.cjs');
const { MachineHost } = require('../electron/machine-host.cjs');
const { ClaudeHost } = require('../electron/claude-host.cjs');
const { createCoordinatorService } = require('../electron/coordinator-service.cjs');
const {renderDelegation}=require('../electron/delegation-context.cjs');

const terminal = status => ['succeeded', 'failed', 'cancelled'].includes(status);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(read, accepts, message) {
  const deadline = Date.now() + 10000;
  do { const value = await read(); if (accepts(value)) return value; await pause(30); } while (Date.now() < deadline);
  throw Error(message || 'native delegation fixture timeout');
}
function invocations(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []; }

// A real CLI subprocess speaking the three distinct upstream event shapes.
// No installed account, model or user settings are consulted.
function writeCli(executable, adapter, log) {
  fs.writeFileSync(executable, `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline');
const args=process.argv.slice(2),adapter=${JSON.stringify(adapter)},log=${JSON.stringify(log)};
const contextPrefix=${JSON.stringify(renderDelegation({contextVersion:1,message:''}))};
const emit=value=>process.stdout.write(JSON.stringify(value)+'\\n');
if(args.includes('--version')){console.log(adapter+' 1.0.0');process.exit(0);}
if(args[0]==='auth'){emit({loggedIn:true});process.exit(0);}
if(adapter==='claude'){
 const lines=readline.createInterface({input:process.stdin});
 lines.on('line',line=>{const input=JSON.parse(line);
  if(input.type==='control_request'&&input.request.subtype==='initialize')emit({type:'control_response',response:{subtype:'success',request_id:input.request_id,response:{}}});
  if(input.type==='user'){
   fs.appendFileSync(log,JSON.stringify({adapter,prompt:input.message.content[0].text,cwd:process.cwd()})+'\\n');
   emit({type:'system',subtype:'init',session_id:args.find(a=>a.startsWith('--session-id=')).slice(13)});
   setInterval(()=>{},1000);
  }
 });
}else{
 let prompt='';process.stdin.setEncoding('utf8');process.stdin.on('data',part=>prompt+=part);
 process.stdin.on('end',()=>{
  const config=JSON.parse(fs.readFileSync('native-settings.json','utf8'));
  fs.appendFileSync(log,JSON.stringify({adapter,args,prompt,cwd:process.cwd(),config})+'\\n');
  const id=adapter+'-controlled-session';
  if(adapter==='hermes')emit({type:'system',subtype:'init',session_id:id});
  if(adapter==='pi'){
   const directory=args[args.indexOf('--session-dir')+1];fs.mkdirSync(directory,{recursive:true});
   fs.writeFileSync(path.join(directory,'session.jsonl'),JSON.stringify({type:'session',id,cwd:process.cwd()})+'\\n');
   emit({type:'session',version:3,id,cwd:process.cwd()});
  }
  if(adapter==='dsh')emit({type:'session',sessionId:id,cwd:process.cwd()});
  const requirement=prompt.startsWith(contextPrefix)?prompt.slice(contextPrefix.length):prompt;
  if(requirement==='hold'){
   process.on('SIGTERM',()=>setTimeout(()=>process.exit(143),500));setInterval(()=>{},1000);return;
  }
  const text=adapter+': '+requirement+' / '+config.selection;
  if(adapter==='hermes'){emit({type:'text',text});emit({type:'result',session_id:id,exit_code:0,text});}
  if(adapter==='pi'){emit({type:'message_end',message:{role:'assistant',content:[{type:'text',text}],stopReason:'stop'}});emit({type:'agent_end',willRetry:false});emit({type:'agent_settled',aborted:false});}
  if(adapter==='dsh'){emit({type:'text',text});emit({type:'status',phase:'turn_end',reason:{kind:'completed'}});emit({type:'final',text});}
  if(requirement==='race'){process.on('SIGTERM',()=>process.exit(0));setTimeout(()=>process.exit(0),1500);}
 });
}
`, { mode: 0o755 });
}

function mcpClient(t, config) {
  const child = spawn(config.command, config.args, { env: { ...process.env, ...config.env }, stdio: ['pipe', 'pipe', 'pipe'] });
  const waiting = new Map(); let id = 0;
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => { const reply = JSON.parse(line); const done = waiting.get(reply.id); waiting.delete(reply.id); done?.(reply); });
  t.after(() => { child.kill(); lines.close(); });
  return async (name, args = {}) => {
    const response = await new Promise((resolve, reject) => {
      const current = ++id, timer = setTimeout(() => { waiting.delete(current); reject(Error('MCP delegation timeout')); }, 12000);
      waiting.set(current, value => { clearTimeout(timer); resolve(value); });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: current, method: 'tools/call', params: { name, arguments: args } }) + '\n');
    });
    assert.equal(response.error, undefined, JSON.stringify(response.error));
    const value = JSON.parse(response.result.content[0].text);
    if (value.error) throw Object.assign(Error(value.error.message), { code: value.error.code });
    return value;
  };
}

async function fixture(t, adapter) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-native-delegation-'));
  const workspace = path.join(directory, 'native-workspace'), home = path.join(directory, 'home');
  fs.mkdirSync(workspace); fs.mkdirSync(home);
  const config = JSON.stringify({ selection: 'native-default-' + adapter, untouched: true }) + '\n';
  fs.writeFileSync(path.join(workspace, 'native-settings.json'), config);
  const calls = path.join(directory, 'calls.jsonl'), candidates = Object.fromEntries(['claude', 'opencode', 'codex', 'hermes', 'pi', 'dsh'].map(id => [id, []]));
  for (const id of ['claude', adapter]) { const executable = path.join(directory, id); writeCli(executable, id, calls); candidates[id] = [executable]; }
  let loseNextResponse = false;
  const options = { directory, platform: process.platform, distributions: async () => [], createHost: () => {
    const host = new MachineHost({ directory: path.join(directory, 'machine'), home, candidates,
      legacy: new ClaudeHost({ directory: path.join(directory, 'legacy'), home, candidates: candidates.claude }) });
    const original = host.call.bind(host);
    host.call = async (method, params = {}) => {
      const result = await original(method, params);
      // Lose only the reply after the real production backend persisted and
      // started its worker. Every dispatch still reaches the actual CLI.
      if (loseNextResponse && method === 'ipc' && params.op === 'submit' && params.requestId.startsWith('delegation-')) {
        loseNextResponse = false;
        throw Object.assign(Error('controlled loss after original native dispatch'), { code: 'DESKTOP_TRANSPORT' });
      }
      return result;
    };
    return host;
  } };
  let network, service;
  const open = () => { network = new AgentNetwork(options); service = createCoordinatorService({ directory, network }); };
  const call = async (method, params = {}) => { const reply = await service.call({ method, params }); if (!reply.ok) throw Object.assign(Error(reply.error.message), { code: reply.error.code }); return reply.result; };
  open();
  t.after(async () => {
    try {
      const snapshot = await network.snapshot();
      for (const task of snapshot.tasks.filter(item => !terminal(item.status))) {
        await call('ipc', { op: 'cancel', machineId: task.machineId, taskId: task.taskId, operationId: 'cleanup-' + task.taskId });
        await until(() => call('ipc', { op: 'task', machineId: task.machineId, taskId: task.taskId }), value => terminal(value.status));
      }
    } finally { service.close(); network.close(); fs.rmSync(directory, { recursive: true, force: true }); }
  });
  const snapshot = await call('snapshot'), leader = snapshot.nodes.find(node => node.adapter === 'claude'), member = snapshot.nodes.find(node => node.adapter === adapter);
  assert.ok(leader && member, 'production discovery found both fixture installations');
  await call('attachNode', { nodeId: leader.nodeId }); await call('attachNode', { nodeId: member.nodeId });
  await call('saveCollaboration', { leaderId: leader.nodeId, memberIds: [member.nodeId], expectedRevision: 0 });
  const parent = await call('nodeRequest', { op: 'submit', nodeId: leader.nodeId, requestId: 'parent', message: 'hold parent scope', collaboration: true });
  await until(() => call('ipc', { op: 'task', machineId: leader.machineId, taskId: parent.taskId }), value => value.status === 'running');
  const machine = network.host(network.machine(leader.machineId)), context = machine.rows.find(row => row.nodeId === leader.nodeId);
  const mcp = mcpClient(t, context.mcp), scope = { nodeId: leader.nodeId, parentRequestId: 'parent' };
  return { directory, workspace, config, calls, leader, member, parent, scope, mcp, call,
    get network() { return network; },
    loseNextSubmitResponse: () => { loseNextResponse = true; },
    reopen: async () => { service.close(); network.close(); open(); await call('snapshot'); },
  };
}

for (const adapter of ['hermes', 'pi', 'dsh']) test(adapter + ' is an ordinary delegated target through Coordinator, MCP, MachineHost and an owned native process', { timeout: 45000 }, async t => {
  const f = await fixture(t, adapter), args = { nodeId: f.member.nodeId, requestId: 'original-child', message: 'literal $(no-shell) `quote` 中文', workspace: f.workspace };
  assert.deepEqual((await f.mcp('list_agents')).items.map(node => node.nodeId), [f.member.nodeId]);
  f.loseNextSubmitResponse();
  await assert.rejects(f.mcp('delegate', args), { code: 'DESKTOP_TRANSPORT' });
  const uncertain = f.network.network.delegations.find(item => item.message === args.message);
  assert.equal(uncertain.state, 'unknown'); assert.equal(uncertain.taskId, undefined);
  assert.equal(uncertain.contextVersion,1);
  assert.equal(f.network.network.requests.find(item => item.requestId === uncertain.requestId).dispatched, true);
  await f.reopen();
  const recovered = await f.call('ipc', { op: 'request', machineId: f.member.machineId, requestId: uncertain.requestId });
  assert.equal(recovered.requestId, uncertain.requestId);
  const child = await f.mcp('delegate', args);
  assert.equal(child.taskId, recovered.taskId);
  assert.equal(child.parentTaskId, f.parent.taskId);
  const result = await until(() => f.mcp('task_result', { taskId: child.taskId }), value => terminal(value.status));
  assert.equal(result.status, 'succeeded'); assert.equal(result.result.message, adapter + ': ' + args.message + ' / native-default-' + adapter);
  const pending = await f.mcp('task_pending', { taskId: child.taskId });
  assert.deepEqual(pending.permissions, []); assert.deepEqual(pending.forms, []);
  assert.equal(pending.machineId, f.member.machineId);
  for (let attempt = 0; attempt < 3; attempt++) assert.equal((await f.mcp('delegate', args)).taskId, child.taskId);
  await assert.rejects(f.mcp('delegate', { ...args, message: 'changed' }), { code: 'REQUEST_CONFLICT' });
  await assert.rejects(f.mcp('task_result', { taskId: f.parent.taskId }), { code: 'COLLABORATION_FORBIDDEN' });
  await assert.rejects(f.network.collaborationTool({ ...f.scope, parentRequestId: 'other-parent' }, 'task_result', { taskId: child.taskId }, 'forged', f.leader.machineId), { code: 'COLLABORATION_FORBIDDEN' });
  await assert.rejects(f.network.collaborationTool(f.scope, 'task_result', { taskId: child.taskId }, 'forged', 'other-machine'), { code: 'COLLABORATION_FORBIDDEN' });
  const row = f.network.network.delegations.find(item => item.taskId === child.taskId);
  await f.reopen();
  const original = await f.call('ipc', { op: 'request', machineId: f.member.machineId, requestId: row.requestId });
  assert.equal(original.taskId, child.taskId); assert.equal(original.status, 'succeeded');
  assert.equal((await f.mcp('task_result', { taskId: child.taskId })).status, 'succeeded');
  assert.equal(invocations(f.calls).filter(item => item.adapter === adapter).length, 1, 'reopening/read/deduplication never starts the original prompt again');
  assert.equal(invocations(f.calls).find(item=>item.adapter===adapter).prompt,renderDelegation({contextVersion:1,message:args.message}));

  const held = await f.mcp('delegate', { ...args, requestId: 'held-child', message: 'hold' });
  await until(() => invocations(f.calls), values => values.some(item => item.adapter === adapter && item.prompt === renderDelegation({contextVersion:1,message:'hold'})));
  const cancellation = await f.mcp('cancel_task', { taskId: held.taskId, operationId: 'original-cancel' });
  assert.equal(cancellation.state, 'unknown');
  assert.equal(terminal((await f.mcp('task_result', { taskId: held.taskId })).status), false, 'the control receipt does not make the process terminal');
  await f.reopen();
  const receipt = await f.call('ipc', { op: 'operation', machineId: f.member.machineId, taskId: held.taskId, operationId: 'original-cancel' });
  assert.equal(receipt.operationId, 'original-cancel');
  const cancelled = await until(() => f.mcp('task_result', { taskId: held.taskId }), value => terminal(value.status));
  assert.equal(cancelled.status, 'cancelled');
  const confirmed = await f.call('ipc', { op: 'operation', machineId: f.member.machineId, taskId: held.taskId, operationId: 'original-cancel' });
  assert.equal(confirmed.state, 'confirmed'); assert.equal(confirmed.data.nativeExited, true);
  assert.equal((await f.mcp('cancel_task', { taskId: held.taskId, operationId: 'original-cancel' })).state, 'confirmed');

  const raced = await f.mcp('delegate', { ...args, requestId: 'race-child', message: 'race' });
  await until(() => invocations(f.calls), values => values.some(item => item.adapter === adapter && item.prompt === renderDelegation({contextVersion:1,message:'race'})));
  await f.mcp('cancel_task', { taskId: raced.taskId, operationId: 'natural-finish-race' });
  assert.equal((await until(() => f.mcp('task_result', { taskId: raced.taskId }), value => terminal(value.status))).status, 'succeeded', 'an actual successful exit wins the cancellation race');
  assert.equal((await f.call('ipc', { op: 'operation', machineId: f.member.machineId, taskId: raced.taskId, operationId: 'natural-finish-race' })).state, 'confirmed');
  const calls = invocations(f.calls).filter(item => item.adapter === adapter);
  assert.equal(calls.length, 3); assert(calls.every(item => item.cwd === f.workspace));
  assert(calls.every(item => !item.args.some(arg => /model|provider|mcp/.test(arg))));
  assert(calls.every(item => item.config.selection === 'native-default-' + adapter));
  assert.equal(fs.readFileSync(path.join(f.workspace, 'native-settings.json'), 'utf8'), f.config);
  const target = f.network.host(f.network.machine(f.member.machineId)).rows.find(item => item.nodeId === f.member.nodeId);
  assert.equal(target.mcp, undefined, 'ordinary delegation does not require child MCP caller capability');
  if (adapter === 'hermes') assert.deepEqual(calls[0].args, ['chat', '--query-file', '-', '--format', 'stream-json', '--no-restore-cwd']);
  if (adapter === 'pi') assert.deepEqual(calls[0].args.slice(0, 3), ['--mode', 'json', '--print']);
  if (adapter === 'dsh') assert.deepEqual(calls[0].args, ['--profile', 'headless', '--json', '-']);

  if (process.env.AGENTBRIDGE_NATIVE_DELEGATION_REPORT_DIR) {
    const output = path.resolve(process.env.AGENTBRIDGE_NATIVE_DELEGATION_REPORT_DIR); fs.mkdirSync(output, { recursive: true });
    const nativeDirectory = path.join(f.directory, 'machine', 'node-contexts', target.contextId);
    const state = JSON.parse(fs.readFileSync(path.join(nativeDirectory, adapter + '-state.json'), 'utf8'));
    const observedEvents = state.tasks.map(task => ({
      prompt: task.message, status: task.status,
      events: fs.readFileSync(path.join(nativeDirectory, 'runs', task.taskId, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
        .map(event => ({ kind: event.kind, ...(event.status ? { status: event.status } : {}),
          ...(event.text ? { text: event.text } : {}), ...(event.kind === 'native' ? { nativeSessionObserved: true } : {}) })),
    }));
    fs.writeFileSync(path.join(output, 'delegation-' + adapter + '.json'), JSON.stringify({
      date: new Date().toISOString(), environment: process.platform + ' / Node ' + process.versions.node,
      evidence: 'controlled CLI subprocesses, production Coordinator/MCP/AgentNetwork/MachineHost/NativeCliHost and real disk',
      models: 0, realInstalledAgent: false, adapter, nativeExecutions: calls.length,
      invocations: calls.map(item => ({ adapter: item.adapter, args: item.args.map(arg => arg.replaceAll(f.directory, '<isolated-profile>')),
        prompt: item.prompt, originalWorkspace: item.cwd === f.workspace, originalConfiguration: item.config })),
      observedWorkerEvents: observedEvents,
      cancellation: { original: cancellation.state, terminal: cancelled.status, confirmed: confirmed.state, nativeExited: confirmed.data.nativeExited },
      checks: ['native protocol and original workspace/configuration', 'stable request deduplication and conflict', 'exact parent/machine ownership', 'empty permission/form pending', 'lost native dispatch reply recovered only through original request', 'observer reopen queries original request', 'cancel unknown before actual process exit', 'original operation confirmation after exit', 'natural success retained in cancellation race'],
      fixtureSha256: createHash('sha256').update(fs.readFileSync(path.join(f.directory, adapter))).digest('hex'),
      sourceSha256: Object.fromEntries(['coordinator-service.cjs', 'agent-network.cjs', 'machine-host.cjs', 'native-cli-host.cjs', 'native-cli-protocols.cjs'].map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../electron', name))).digest('hex')])),
      status: 'passed', limitations: ['No real Hermes/Pi/DSH model or credentials', 'No Windows EXE', 'No independent SSH server'],
    }, null, 2) + '\n');
  }
});
