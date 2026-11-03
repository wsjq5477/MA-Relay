const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {tools}=require('../electron/mcp-client.cjs');
const terminal=new Set(['succeeded','failed','cancelled']);
const fault=code=>Object.assign(Error(code),{code});
async function setup(t,{native=false}={}) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-mcp-resume-'));
  const state={agents:[],tasks:[],conversations:[],operations:[],controls:[],executions:0,conversationReads:0};
  const host={close(){},setCollaboration(handler){this.handler=handler;},async call(method,p={}){
    if(method==='discover')return {items:['claude','codex'].map(adapter=>({adapter,name:adapter,executable:'/controlled/'+adapter,version:'2.0.0',healthy:true,executionSupported:true}))};
    if(method==='scope')return {configured:true,teamCollaboration:true};
    if(method==='context'){let a=state.agents.find(a=>a.nodeId===p.nodeId);if(!a){a={agentId:'agent-'+state.agents.length,nodeId:p.nodeId,adapter:p.adapter,executable:p.executable,workspace:'/workspace/'+state.agents.length,enabled:true,healthy:true,online:true};state.agents.push(a);}return {contextId:'context-'+a.agentId,agentId:a.agentId,workspace:a.workspace};}
    if(method==='snapshot')return structuredClone({agents:{items:state.agents.map(a=>({...a,busy:state.tasks.some(t=>t.targetAgent===a.agentId&&!terminal.has(t.status))})),revision:1},tasks:state.tasks,conversations:state.conversations});
    if(method!=='ipc')throw fault('METHOD');
    if(p.op==='request'){const task=state.tasks.find(t=>t.requestId===p.requestId);if(!task)throw fault('NOT_FOUND');return structuredClone(task);}
    if(p.op==='task'){const task=state.tasks.find(t=>t.taskId===p.taskId);if(!task)throw fault('NOT_FOUND');return structuredClone(task);}
    if(p.op==='cancel'){state.controls.push('cancel');let op=state.operations.find(o=>o.operationId===p.operationId);if(!op){op={taskId:p.taskId,operationId:p.operationId,kind:'cancel',state:'unknown'};state.operations.push(op);}return structuredClone(op);}
    if(p.op==='operation'){state.controls.push('operation');const op=state.operations.find(o=>o.operationId===p.operationId&&o.taskId===p.taskId);if(!op)throw fault('NOT_FOUND');return structuredClone(op);}
    if(p.op==='conversation'){
      state.conversationReads++;
      if(state.onConversation){const callback=state.onConversation;state.onConversation=null;await callback();}
      if(state.refuseAt===state.conversationReads)throw fault('FUTURE_PREPARATION_ERROR');
      const c=state.conversations.find(c=>c.conversationId===p.conversationId);if(!c)throw fault('NOT_FOUND');
      const last=state.tasks.find(t=>t.taskId===c.lastTaskId);
      return structuredClone({...c,canContinue:terminal.has(last.status)&&!state.controlUnknown,items:state.tasks.filter(t=>t.conversationId===c.conversationId)});
    }
    if(['submit','continue'].includes(p.op)) {
      const old=state.tasks.find(t=>t.requestId===p.requestId);if(old)return structuredClone(old);
      let c=state.conversations.find(c=>c.conversationId===p.conversationId);
      if(!c){c={conversationId:'conversation-'+state.executions,targetAgent:p.agentId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),turns:0};state.conversations.push(c);}
      if(state.tasks.some(t=>t.targetAgent===c.targetAgent&&!terminal.has(t.status)))throw fault('AGENT_BUSY');
      const task={taskId:'task-'+state.executions++,executionId:'execution-'+state.executions,requestId:p.requestId,conversationId:c.conversationId,targetAgent:c.targetAgent,message:p.message,status:'running',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      state.tasks.push(task);c.lastTaskId=task.taskId;c.turns++;return structuredClone(task);
    }
    throw fault('METHOD');
  }};
  const network=new AgentNetwork({directory,platform:'linux',createHost:()=>host});t.after(()=>{network.close();fs.rmSync(directory,{recursive:true,force:true});});
  const snapshot=await network.snapshot(),leader=snapshot.nodes.find(n=>n.adapter==='claude'),child=snapshot.nodes.find(n=>n.adapter==='codex');
  for(const node of [leader,child])await network.call('manageNode',{nodeId:node.nodeId,action:'attach',operationId:'attach-'+node.adapter});
  await network.call('saveCollaboration',{leaderId:leader.nodeId,memberIds:[child.nodeId],expectedRevision:0});
  let scope={nodeId:leader.nodeId,parentRequestId:'connection-a',externalConnectionId:'connection-a'};
  if(native){await network.call('nodeRequest',{nodeId:leader.nodeId,requestId:'parent-a',message:'Parent',collaboration:true});scope={nodeId:leader.nodeId,parentRequestId:'parent-a'};}
  const call=(name,args,override=scope)=>network.collaborationTool(override,name,args,'controlled-call',leader.machineId);
  const delegate=(id,conversationId)=>call('delegate',{nodeId:child.nodeId,requestId:id,message:'Child '+id,...(conversationId?{conversationId}:{})});
  const finish=task=>{const original=state.tasks.find(t=>t.taskId===task.taskId.split('::').at(-1));original.status='succeeded';original.result={message:'Finished'};};
  return {network,state,host,leader,child,scope,call,delegate,finish};
}

test('MCP schema keeps ten tools with optional continuation and cancellation query fields',()=>{
  assert.equal(tools.length,10);const tool=tools.find(t=>t.name==='delegate');assert.ok(tool.inputSchema.properties.conversationId);assert.equal(tool.inputSchema.required.includes('conversationId'),false);
  const cancel=tools.find(t=>t.name==='cancel_task');assert.deepEqual(cancel.inputSchema.properties.queryOnly,{type:'boolean'});assert.equal(cancel.inputSchema.required.includes('queryOnly'),false);
});
test('original cancellation can be queried without reissuing control or claiming task completion',async t=>{
  const f=await setup(t),task=await f.delegate('cancel-original'),args={taskId:task.taskId,operationId:'original-cancel'};
  assert.equal((await f.call('cancel_task',args)).state,'unknown');f.state.operations[0].state='confirmed';
  assert.equal((await f.call('cancel_task',{...args,queryOnly:true})).state,'confirmed');
  assert.deepEqual(f.state.controls,['cancel','operation']);assert.equal((await f.call('task_result',{taskId:task.taskId})).status,'running');
  assert.ok((await f.call('list_agents',{})).supportedOperations.includes('cancel.query-v1'));
});
test('missing or non-cancellation operations never create a control or settle a task',async t=>{
  const f=await setup(t),task=await f.delegate('query-missing'),args={taskId:task.taskId,operationId:'missing',queryOnly:true};
  await assert.rejects(f.call('cancel_task',args),{code:'NOT_FOUND'});assert.equal(f.state.operations.length,0);
  f.state.operations.push({taskId:f.state.tasks[0].taskId,operationId:'permission',kind:'reply',state:'confirmed'});
  await assert.rejects(f.call('cancel_task',{...args,operationId:'permission'}),{code:'OPERATION_CONFLICT'});
  delete f.state.operations[0].kind;await assert.rejects(f.call('cancel_task',{...args,operationId:'permission'}),{code:'OPERATION_CONFLICT'});
  f.state.operations[0].kind='cancel';f.state.operations[0].state='guessed';await assert.rejects(f.call('cancel_task',{...args,operationId:'permission'}),{code:'RECEIPT_MISMATCH'});
  for(const queryOnly of ['true',null,1])await assert.rejects(f.call('cancel_task',{...args,queryOnly}),{code:'INVALID_INPUT'});
  assert.ok(f.state.controls.every(c=>c==='operation'));assert.equal(f.state.tasks[0].status,'running');
});
test('cancellation lookup keeps the original delegation owner after relation changes',async t=>{
  const f=await setup(t),task=await f.delegate('query-owner'),args={taskId:task.taskId,operationId:'owned-cancel'};await f.call('cancel_task',args);
  await assert.rejects(f.call('cancel_task',{...args,queryOnly:true},{...f.scope,externalConnectionId:'different-connection'}),{code:'COLLABORATION_FORBIDDEN'});
  await f.network.call('saveCollaboration',{leaderId:f.leader.nodeId,memberIds:[],expectedRevision:1});
  assert.equal((await f.call('cancel_task',{...args,queryOnly:true})).state,'unknown');assert.deepEqual(f.state.controls,['cancel','operation']);
});
test('independent MCP performs three original child turns; repeats return the same original task',async t=>{
  const f=await setup(t);let task=await f.delegate('first');const conversationId=task.conversationId;
  for(let round=0;round<3;round++){
    f.finish(task);const result=await f.call('task_result',{taskId:task.taskId});assert.equal(result.conversationId,conversationId);assert.equal(result.canContinue,true);
    if(round<2){task=await f.delegate('follow-'+round,conversationId);const retry=await f.delegate('follow-'+round,conversationId);assert.equal(retry.taskId,task.taskId);assert.equal(task.conversationId,conversationId);}
  }
  assert.equal(f.state.executions,3);assert.deepEqual(f.network.network.delegations.map(d=>d.op),['submit','continue','continue']);
});
test('other connection and unowned conversation cannot be used as continuation authority',async t=>{
  const f=await setup(t),task=await f.delegate('first');f.finish(task);
  const args={nodeId:f.child.nodeId,requestId:'steal',message:'New',conversationId:task.conversationId};
  await assert.rejects(f.call('delegate',args,{...f.scope,externalConnectionId:'connection-b'}),{code:'COLLABORATION_FORBIDDEN'});
  await assert.rejects(f.delegate('missing','unknown-conversation'),{code:'COLLABORATION_FORBIDDEN'});assert.equal(f.state.executions,1);
});
test('active task, task unknown and unresolved control all refuse continuation',async t=>{
  const f=await setup(t),task=await f.delegate('first');
  await assert.rejects(f.delegate('running',task.conversationId),{code:'CONVERSATION_BINDING'});
  f.state.tasks[0].status='unknown';await assert.rejects(f.delegate('unknown',task.conversationId),{code:'CONVERSATION_BINDING'});
  f.finish(task);f.state.controlUnknown=true;await assert.rejects(f.delegate('cancel-unknown',task.conversationId),{code:'CONVERSATION_BINDING'});assert.equal(f.state.executions,1);
});
test('same request cannot change continuation identity or workspace',async t=>{
  const f=await setup(t),task=await f.delegate('first');f.finish(task);
  await assert.rejects(f.delegate('first',task.conversationId),{code:'REQUEST_CONFLICT'});
  await assert.rejects(f.call('delegate',{nodeId:f.child.nodeId,requestId:'directory-alias',message:'New',conversationId:task.conversationId,workspace:'/alias'}),{code:'CONVERSATION_CONFIG'});assert.equal(f.state.executions,1);
});
test('revocation during session query refuses continuation but preserves original result reading',async t=>{
  const f=await setup(t),task=await f.delegate('first');f.finish(task);
  f.state.onConversation=()=>f.network.call('saveCollaboration',{leaderId:f.leader.nodeId,memberIds:[],expectedRevision:1});
  await assert.rejects(f.delegate('revoked',task.conversationId),{code:'COLLABORATION_FORBIDDEN'});
  const result=await f.call('task_result',{taskId:task.taskId});assert.equal(result.status,'succeeded');assert.equal(result.canContinue,false);assert.equal(f.state.executions,1);
});
test('continuation preparation rejection reconciles the exact original continue fingerprint',async t=>{
  const f=await setup(t),task=await f.delegate('first');f.finish(task);f.state.conversationReads=0;f.state.refuseAt=2;
  await assert.rejects(f.delegate('prepare-fails',task.conversationId),{code:'FUTURE_PREPARATION_ERROR'});
  const intent=f.network.network.delegations.at(-1);assert.equal(intent.op,'continue');assert.equal(intent.resumeConversationId,task.conversationId);assert.equal(intent.state,'rejected');assert.equal(intent.taskId,undefined);
  f.state.refuseAt=undefined;await assert.rejects(f.delegate('prepare-fails',task.conversationId),{code:'FUTURE_PREPARATION_ERROR'});assert.equal(f.state.executions,1);
});
test('new native parent turn cannot claim the old parent execution delegated session or request namespace',async t=>{
  const f=await setup(t,{native:true}),child=await f.delegate('first');f.finish(child);
  const parent=f.state.tasks.find(t=>t.requestId==='parent-a');parent.status='succeeded';
  const snapshot=await f.network.snapshot(),conversation=snapshot.conversations.find(c=>c.targetAgent===f.network.network.requests.find(r=>r.requestId==='parent-a').agentId);
  await f.network.call('nodeRequest',{op:'continue',nodeId:f.leader.nodeId,conversationId:conversation.conversationId,requestId:'parent-b',message:'New parent'});
  const newScope={nodeId:f.leader.nodeId,parentRequestId:'parent-b'};
  await assert.rejects(f.call('delegate',{nodeId:f.child.nodeId,requestId:'first',message:'Child first'},newScope),{code:'COLLABORATION_FORBIDDEN'});
  await assert.rejects(f.call('delegate',{nodeId:f.child.nodeId,requestId:'steal-old-session',message:'New',conversationId:child.conversationId},newScope),{code:'COLLABORATION_FORBIDDEN'});assert.equal(f.state.executions,3);
});
