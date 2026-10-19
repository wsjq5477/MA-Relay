// Manual real-native acceptance. Import/default --plan never opens a host/model.
// Durable original intents survive process interruption; existing --run observes.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const {randomUUID, createHash} = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const supported = ['claude', 'codex', 'opencode', 'hermes', 'pi', 'dsh'];
const terminal = task => ['succeeded', 'failed', 'cancelled'].includes(task?.status);
const hash = value => createHash('sha256').update(value).digest('hex');
const fault = code => Object.assign(new Error('Native connection acceptance requires original-state review.'), {code});
const transient = code => ['NOT_FOUND', 'REQUEST_NOT_FOUND', 'TASK_NOT_FOUND', 'NOT_CONFIGURED', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT'].includes(code);
const plan = {status:'plan', realModelStarted:false, adapters:supported,
  scope:'Production Coordinator/AgentNetwork/MachineHost on one WSL host; inherited native account/model. Direct task, exact-session continuation, observer reopen, original cancellation.',
  recovery:'First --run creates intents. Existing --run and --observe only read original requests. --continue may advance after confirmed earlier stages; a missing original receipt never replays an intent.',
  limits:'At most three native invocations per adapter; no permission approval, no installation/configuration of accounts, no business files or remote deployment.',
  untested:['Real delegate/MCP caller direction','Windows EXE','Independent SSH','All unsupported controls']};
function write(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive:true, mode:0o700});
  const temp = file+'.'+randomUUID()+'.tmp';
  fs.writeFileSync(temp, JSON.stringify(value,null,2)+'\n', {mode:0o600}); fs.renameSync(temp,file);
}
function read(file) {return JSON.parse(fs.readFileSync(file,'utf8'));}
function taskReceipt(value, params, prior) {
  if (!value || value.requestId !== params.requestId || typeof value.taskId !== 'string' || !value.taskId.trim() || typeof value.conversationId !== 'string' || !value.conversationId.trim()
    || params.machineId && value.machineId !== params.machineId
    || params.conversationId && value.conversationId !== params.conversationId
    || prior?.taskId && value.taskId !== prior.taskId || prior?.conversationId && value.conversationId !== prior.conversationId) throw fault('PROBE_RECEIPT_IDENTITY');
  return value;
}
// Persist before the very first send. Once prepared, reads are the only recovery.
async function original(checkpoint, key, params, save, query, dispatch, allowNew) {
  const fingerprint = hash(JSON.stringify(params)), prior = checkpoint.intents[key];
  if (prior && prior.fingerprint !== fingerprint) throw fault('PROBE_INPUT_CHANGED');
  let value;
  if (prior) value = await query(params);
  else {
    if (!allowNew) throw fault('PROBE_OBSERVATION_ONLY');
    checkpoint.intents[key] = {params, fingerprint, preparedAt:new Date().toISOString()}; save();
    value = await dispatch(params);
  }
  taskReceipt(value, params, checkpoint.intents[key]);
  Object.assign(checkpoint.intents[key], {taskId:value.taskId, conversationId:value.conversationId}); save();
  return value;
}
async function cancelOriginal(checkpoint, task, save, call, allowNew) {
  let intent = checkpoint.cancel;
  if (intent && (intent.taskId !== task.taskId || intent.machineId !== task.machineId)) throw fault('PROBE_CANCEL_IDENTITY');
  let receipt;
  if (intent) receipt = await call('ipc', {op:'operation',...intent});
  else {
    if (!allowNew) throw fault('PROBE_OBSERVATION_ONLY');
    intent = checkpoint.cancel = {operationId:randomUUID(), taskId:task.taskId, machineId:task.machineId}; save();
    receipt = await call('ipc', {op:'cancel',...intent});
  }
  // Core/OpenCode receipts are deliberately minimal. The authenticated task
  // route verifies its execution ownership before returning this original ID.
  // Native-host receipts additionally carry taskId, which must match if present.
  if (receipt?.operationId !== intent.operationId || receipt.taskId !== undefined && receipt.taskId !== task.taskId) throw fault('PROBE_CANCEL_RECEIPT');
  return receipt;
}
function open(directory) {
  const {AgentNetwork} = require('../electron/agent-network.cjs');
  const {MachineHost} = require('../electron/machine-host.cjs');
  const {ClaudeHost} = require('../electron/claude-host.cjs');
  const {HostConnection} = require('../electron/rpc.cjs');
  const {createCoordinatorService} = require('../electron/coordinator-service.cjs');
  const network = new AgentNetwork({directory, platform:'linux', distributions:async()=>[], createHost:()=>new MachineHost({
    directory:path.join(directory,'machine'), home:os.homedir(),
    legacy:new ClaudeHost({directory:path.join(directory,'legacy'), home:os.homedir()}),
    openCode:context=>new HostConnection(path.join(root,'dist/desktop-host.js'), {directory:context,native:true,leaf:true}),
  })});
  const service = createCoordinatorService({directory,network,version:require('../package.json').version});
  const call = async (method,params={}) => {const r=await service.call({method,params});if(!r.ok)throw Object.assign(new Error('Native original operation failed.'),{code:r.error.code});return r.result;};
  return {network,service,call,close(){service.close();}};
}
function publicTask(task) {
  return {status:task.status, requestRef:hash(task.requestId).slice(0,16), taskRef:hash(task.taskId).slice(0,16),
    sessionRef:task.native?.sessionId?hash(task.native.sessionId).slice(0,16):null,
    answerSha256:hash(task.result?.message||''), answerLength:(task.result?.message||'').length,
    errorCode:task.error?.code, waiting:!!task.waiting};
}
async function waitTask(call, task, accept=terminal, timeout=150000) {
  const deadline = Date.now()+timeout;
  do {
    task=await call('ipc',{op:'task',machineId:task.machineId,taskId:task.taskId});
    if(accept(task)) return task;
    if(task.status==='unknown'||task.waiting) throw fault('PROBE_ORIGINAL_PENDING');
    await new Promise(r=>setTimeout(r,500));
  } while(Date.now()<deadline);
  throw fault('PROBE_ORIGINAL_PENDING');
}
// One process owns advancement. A dead harness lock may be reclaimed, but the
// durable intent still forbids replay. An observer does not acquire this lock.
function lock(file) {
  try {const pid=read(file).pid;try{process.kill(pid,0);throw fault('PROBE_ALREADY_RUNNING');}catch(e){if(e.code!=='ESRCH')throw e;}fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}
  const fd=fs.openSync(file,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({pid:process.pid}));fs.closeSync(fd);
  return ()=>{if(read(file).pid===process.pid)fs.unlinkSync(file);};
}
async function run(mode, adapter) {
  if(process.platform!=='linux'||!supported.includes(adapter)||!['--run','--observe','--continue'].includes(mode))throw fault('PROBE_ARGUMENTS');
  const directory=path.join(root,'.agentbridge-dev/connection-native-ct02',adapter),file=path.join(directory,'checkpoint.json');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const existed=fs.existsSync(file),allowNew=mode==='--continue'||mode==='--run'&&!existed;
  if(mode==='--continue'&&!existed)throw fault('PROBE_NO_ORIGINAL');
  const unlock=allowNew?lock(path.join(directory,'advance.lock')):()=>{};
  let current;
  const output=path.join(root,'artifacts/connection-native/2026-10-19',new Date().toISOString().replaceAll(':','-')+'-'+adapter+'.json');
  const report={date:new Date().toISOString(),adapter,status:'running',environment:'WSL / real installed CLI / production Coordinator, AgentNetwork and MachineHost',
    scope:plan.scope,observeOnly:!allowNew,checks:[],tasks:[],untested:plan.untested,profileRetained:true};
  try {
    if(!existed&&!allowNew)throw fault('PROBE_NO_ORIGINAL');
    let checkpoint=existed?read(file):{schema:1,adapter,token:'CT02_'+randomUUID().replaceAll('-',''),intents:{}};
    if(checkpoint.schema!==1||checkpoint.adapter!==adapter)throw fault('PROBE_CHECKPOINT');
    const save=()=>write(file,checkpoint);
    current=open(directory);let {call}=current;
    const snapshot=await call('snapshot');
    report.backendTaskCountBefore=snapshot.tasks.length;
    const node=snapshot.nodes.find(n=>n.adapter===adapter&&!n.supersededBy&&n.healthy&&n.executionSupported);
    if(!node)throw fault('PROBE_NATIVE_UNAVAILABLE');
    if(checkpoint.nodeId && (checkpoint.nodeId!==node.nodeId||checkpoint.executable!==node.executable))throw fault('PROBE_INSTALLATION_CHANGED');
    report.nativeVersion=node.version;
    if(!existed){checkpoint.nodeId=node.nodeId;checkpoint.machineId=node.machineId;checkpoint.executable=node.executable;save();}
    if(!node.connected){if(!allowNew)throw fault('PROBE_OBSERVATION_ONLY');await call('attachNode',{nodeId:node.nodeId});}
    const query=p=>call('ipc',{op:'request',machineId:node.machineId,requestId:p.requestId});
    const submit=p=>call('nodeRequest',p);
    async function step(key, extra) {
      const params=checkpoint.intents[key]?.params||{op:'submit',nodeId:node.nodeId,machineId:node.machineId,requestId:randomUUID(),collaboration:false,...extra};
      return original(checkpoint,key,params,save,query,submit,allowNew);
    }
    let first=await step('first',{message:'这是连接通路验收，不使用任何工具、不读写文件、不调用其他Agent。请记住本会话标记 '+checkpoint.token+'，本轮只原样输出这个标记。'});
    first=await waitTask(call,first);report.tasks.push(publicTask(first));assert.equal(first.status,'succeeded');assert(first.result?.message?.includes(checkpoint.token));assert(first.native?.sessionId);
    checkpoint.firstSession=checkpoint.firstSession||first.native.sessionId;assert.equal(first.native.sessionId,checkpoint.firstSession);save();
    report.checks.push('Actual native direct reply and non-empty Session binding.');
    // Close every observer before reading the ORIGINAL first request and resume.
    current.close();current=open(directory);call=current.call;
    const recovered=taskReceipt(await queryOriginal(call,node,checkpoint.intents.first.params),checkpoint.intents.first.params,checkpoint.intents.first);
    assert.equal(recovered.native?.sessionId,checkpoint.firstSession);assert.equal(recovered.result?.message,first.result?.message);
    report.checks.push('Complete observer reopen retained original Task, answer and native Session.');
    // Update closures after reopen, preserving original identities/parameters.
    let resumed=await original(checkpoint,'resume',checkpoint.intents.resume?.params||{op:'continue',nodeId:node.nodeId,machineId:node.machineId,requestId:randomUUID(),conversationId:first.conversationId,collaboration:false,message:'不使用任何工具。请只输出上一轮让你记住的会话标记，不添加其他文字。'},save,p=>queryOriginal(call,node,p),p=>call('nodeRequest',p),allowNew);
    resumed=await waitTask(call,resumed);report.tasks.push(publicTask(resumed));assert.equal(resumed.status,'succeeded');assert.equal(resumed.conversationId,first.conversationId);assert.equal(resumed.native?.sessionId,checkpoint.firstSession);assert(resumed.result?.message?.includes(checkpoint.token));
    report.checks.push('Real continuation recalled earlier marker in the exact original Conversation and native Session.');
    let held=await original(checkpoint,'cancel-target',checkpoint.intents['cancel-target']?.params||{op:'submit',nodeId:node.nodeId,machineId:node.machineId,requestId:randomUUID(),collaboration:false,message:'这是原任务取消验证。不要使用任何工具，不读写文件。请在回答中逐行列出1到10000的每个整数，每行一个，不跳过、不总结。'},save,p=>queryOriginal(call,node,p),p=>call('nodeRequest',p),allowNew);
    held=await waitTask(call,held,t=>t.status==='running'&&!!t.native?.sessionId||terminal(t),30000);
    if(terminal(held)&&!checkpoint.cancel)throw fault('PROBE_CANCEL_RACE');
    const initialReceipt=await cancelOriginal(checkpoint,held,save,call,allowNew);
    held=await waitTask(call,held,terminal,45000);report.tasks.push(publicTask(held));
    const receipt=await cancelOriginal(checkpoint,held,save,call,false);
    assert.equal(held.status,'cancelled');assert.equal(receipt.state,'confirmed');
    report.checks.push('Cancellation sent once; original control receipt and actual native terminal checked separately.');
    report.cancellation={initial:initialReceipt.state,confirmed:receipt.state,terminal:held.status};
    report.backendTaskCountAfter=(await call('snapshot')).tasks.length;
    report.originalRequestCount=Object.keys(checkpoint.intents).length;
    assert.equal(report.backendTaskCountAfter,3);
    if(!allowNew)assert.equal(report.backendTaskCountBefore,report.backendTaskCountAfter);
    checkpoint.completed=true;save();report.status='passed';
  } catch(error) {
    report.status=transient(error.code)||['PROBE_ORIGINAL_PENDING','PROBE_OBSERVATION_ONLY'].includes(error.code)?'pending':'failed';
    report.error={code:/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'PROBE_ASSERTION'};
    // No retry, replacement ID, cancellation or approval on an error/timeout.
    if(report.status==='failed')process.exitCode=1;
  } finally {current?.close();unlock();write(output,report);console.log(JSON.stringify({status:report.status,adapter,checks:report.checks.length,error:report.error,output}));}
  return report;
}
function queryOriginal(call,node,p){return call('ipc',{op:'request',machineId:node.machineId,requestId:p.requestId});}
module.exports={plan,taskReceipt,original,cancelOriginal,transient,run};
if(require.main===module){const [mode='--plan',adapter]=process.argv.slice(2);if(mode==='--plan')console.log(JSON.stringify(plan,null,2));else run(mode,adapter).catch(e=>{console.error(e.code||'PROBE_FAILURE');process.exitCode=1;});}
