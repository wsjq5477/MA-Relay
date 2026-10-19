// Regression checks for acceptance recovery. No installed CLI or model started.
const test=require('node:test');
const assert=require('node:assert/strict');
const {plan,original,taskReceipt,cancelOriginal}=require('./linux-connection-native.cjs');
const params={requestId:'original-request',machineId:'original-machine',message:'original input'};
const task={...params,taskId:'original-task',conversationId:'original-conversation',status:'running'};

test('native connection plan is model-free and keeps real native/package/topology boundaries explicit',()=>{
  assert.equal(plan.realModelStarted,false);assert.equal(plan.adapters.length,6);
  assert.match(plan.recovery,/never replays/);assert.match(plan.limits,/no permission approval/);
  assert(plan.untested.includes('Windows EXE'));assert(plan.untested.includes('Real delegate/MCP caller direction'));
});
test('first send persists complete original intent before dispatch and only recovers by query afterward',async()=>{
  const cp={intents:{}},calls=[];
  const query=async()=>{calls.push('query');return task;};
  await original(cp,'first',params,()=>calls.push('save'),query,async()=>{calls.push('dispatch');assert(cp.intents.first.params.requestId);return task;},true);
  assert.deepEqual(calls,['save','dispatch','save']);calls.length=0;
  await original(cp,'first',params,()=>calls.push('save'),query,async()=>assert.fail('replayed'),true);
  assert.deepEqual(calls,['query','save']);
});
test('lost response and absent original receipt never dispatch again even with explicit continuation',async()=>{
  const cp={intents:{}},save=()=>{};let sends=0;
  const lost=()=>{throw Object.assign(Error(),{code:'ETIMEDOUT'});};
  await assert.rejects(original(cp,'first',params,save,lost,async()=>{sends++;return lost();},true),{code:'ETIMEDOUT'});
  await assert.rejects(original(cp,'first',params,save,()=>{throw Object.assign(Error(),{code:'NOT_FOUND'});},async()=>{sends++;return task;},true),{code:'NOT_FOUND'});
  assert.equal(sends,1);assert.equal(cp.intents.first.params.requestId,params.requestId);
});
test('changed input and observation-only new stage cannot initiate a native request',async()=>{
  const cp={intents:{}},save=()=>{};await original(cp,'first',params,save,async()=>task,async()=>task,true);
  await assert.rejects(original(cp,'first',{...params,message:'changed'},save,()=>assert.fail(),()=>assert.fail(),true),{code:'PROBE_INPUT_CHANGED'});
  await assert.rejects(original(cp,'next',params,save,()=>assert.fail(),()=>assert.fail(),false),{code:'PROBE_OBSERVATION_ONLY'});
});
test('foreign or incomplete task/Conversation/machine receipts do not bind the original attempt',()=>{
  assert.equal(taskReceipt(task,params),task);
  for(const value of [null,{...task,taskId:''},{...task,conversationId:' '},{...task,requestId:'foreign'},{...task,machineId:'foreign'}])assert.throws(()=>taskReceipt(value,params),{code:'PROBE_RECEIPT_IDENTITY'});
  assert.throws(()=>taskReceipt(task,{...params,conversationId:'other'}),{code:'PROBE_RECEIPT_IDENTITY'});
  assert.throws(()=>taskReceipt(task,params,{taskId:'other'}),{code:'PROBE_RECEIPT_IDENTITY'});
});
test('cancel checkpoints before first send; an unknown/lost control is queried with the same operation',async()=>{
  const cp={intents:{}},calls=[];let originalId;
  const save=()=>calls.push('save');
  await assert.rejects(cancelOriginal(cp,task,save,async(method,p)=>{calls.push(p.op);originalId=p.operationId;assert.equal(cp.cancel.operationId,p.operationId);throw Object.assign(Error(),{code:'ETIMEDOUT'});},true),{code:'ETIMEDOUT'});
  const receipt=await cancelOriginal(cp,task,save,async(method,p)=>{calls.push(p.op);assert.equal(p.operationId,originalId);return {operationId:p.operationId,taskId:task.taskId,state:'unknown'};},true);
  assert.equal(receipt.state,'unknown');assert.deepEqual(calls,['save','cancel','operation']);
});
test('foreign cancellation receipt and task changes are rejected without replacement controls',async()=>{
  const cp={cancel:{operationId:'original-cancel',taskId:task.taskId,machineId:task.machineId}};
  await assert.rejects(cancelOriginal(cp,task,()=>assert.fail(),async()=>({operationId:'foreign',state:'confirmed'}),true),{code:'PROBE_CANCEL_RECEIPT'});
  const minimal=await cancelOriginal(cp,task,()=>assert.fail(),async(method,p)=>{assert.equal(p.op,'operation');assert.equal(p.taskId,task.taskId);assert.equal(p.machineId,task.machineId);return {operationId:'original-cancel',state:'confirmed'};},false);
  assert.equal(minimal.state,'confirmed');
  await assert.rejects(cancelOriginal(cp,task,()=>assert.fail(),async()=>({operationId:'original-cancel',taskId:'foreign',state:'confirmed'}),true),{code:'PROBE_CANCEL_RECEIPT'});
  await assert.rejects(cancelOriginal(cp,{...task,taskId:'foreign'},()=>assert.fail(),()=>assert.fail(),true),{code:'PROBE_CANCEL_IDENTITY'});
  await assert.rejects(cancelOriginal({},task,()=>assert.fail(),()=>assert.fail(),false),{code:'PROBE_OBSERVATION_ONLY'});
});
