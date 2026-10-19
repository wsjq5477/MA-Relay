// Acceptance guard tests only. Never open native hosts or model processes.
const test=require('node:test'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {plan,setupOnce,childPrompt,parentPrompt,expected,validateDelegations,auditedResult}=require('./linux-connection-delegation.cjs');
const digest=x=>createHash('sha256').update(x).digest('hex');
const params={operationId:'stable-relation',leaderId:'leader',memberIds:['child'],expectedRevision:0};
test('delegation plan separates same-host real production routing from package and SSH acceptance',()=>{
  assert.equal(plan.realModelStarted,false);assert.deepEqual(plan.leaders,['claude','codex','opencode']);
  assert.match(plan.topology,/no fake dispatcher/);assert.match(plan.recovery,/No replacement IDs/);
  assert(plan.untested.includes('Windows EXE'));assert(plan.untested.includes('Independent SSH'));
});
test('new setup intent is persisted before dispatch, then recovered using its original receipt only',async()=>{
  const cp={setup:{}},calls=[];const call=async(method,p)=>{calls.push(method);assert.equal(p.operationId,params.operationId);return {operationId:p.operationId,state:'confirmed',data:{revision:1}};};
  await setupOnce(cp,'relation','saveCollaboration',params,()=>calls.push('save'),call,true);
  assert.deepEqual(calls,['save','saveCollaboration']);calls.length=0;
  await setupOnce(cp,'relation','saveCollaboration',params,()=>calls.push('save'),call,true);
  assert.deepEqual(calls,['collaborationOperation']);
});
test('lost setup response or missing receipt never replays the prepared relation, even when continuation is enabled',async()=>{
  const cp={setup:{}},sends=[];
  await assert.rejects(setupOnce(cp,'relation','saveCollaboration',params,()=>{},async method=>{sends.push(method);throw Object.assign(Error(),{code:'ETIMEDOUT'});},true),{code:'ETIMEDOUT'});
  await assert.rejects(setupOnce(cp,'relation','saveCollaboration',params,()=>{},async method=>{sends.push(method);return {operationId:params.operationId,state:'not_found'};},true),{code:'PROBE_ORIGINAL_PENDING'});
  assert.deepEqual(sends,['saveCollaboration','collaborationOperation']);
});
test('observation, changed setup content and foreign setup receipts cannot initiate or settle a new mutation',async()=>{
  const cp={setup:{}};
  await assert.rejects(setupOnce(cp,'relation','saveCollaboration',params,()=>assert.fail(),()=>assert.fail(),false),{code:'PROBE_OBSERVATION_ONLY'});
  await assert.rejects(setupOnce(cp,'relation','saveCollaboration',params,()=>{},async()=>({operationId:'foreign',state:'confirmed'}),true),{code:'PROBE_SETUP_RECEIPT'});
  await assert.rejects(setupOnce(cp,'relation','saveCollaboration',{...params,memberIds:[]},()=>assert.fail(),()=>assert.fail(),true),{code:'PROBE_SETUP_CHANGED'});
});
function fixture(){
  const cp={leader:'claude',children:['codex','opencode'],token:'synthetic-marker',inputs:[13,17],nodes:{claude:{nodeId:'leader'},codex:{nodeId:'child-code'},opencode:{nodeId:'child-open'}}};
  const parent={requestId:'parent-original',conversationId:'parent-conversation',taskId:'parent-task'};
  const rows=cp.children.map(adapter=>({parentRequestId:parent.requestId,parentTaskId:parent.taskId,parentConversationId:parent.conversationId,leaderId:'leader',memberId:cp.nodes[adapter].nodeId,
    requestId:'delegation-'+digest('leader:'+parent.conversationId+':ct02-live-'+adapter).slice(0,40),message:childPrompt(cp,adapter)}));
  return {cp,parent,rows};
}
test('delegation evidence requires exact parent, target, stable derived request and unmodified message',()=>{
  const {cp,parent,rows}=fixture();assert.equal(validateDelegations(cp,parent,rows).length,2);
  for(const field of ['parentTaskId','parentConversationId','leaderId','requestId','message']){
    const bad=structuredClone(rows);bad[0][field]='foreign';assert.throws(()=>validateDelegations(cp,parent,bad),{code:'PROBE_DELEGATION_IDENTITY'});
  }
  assert.throws(()=>validateDelegations(cp,parent,rows.slice(0,1)),{code:'PROBE_DELEGATION_COUNT'});
  const duplicate=structuredClone(rows);duplicate[1].memberId=duplicate[0].memberId;assert.throws(()=>validateDelegations(cp,parent,duplicate),{code:'PROBE_DELEGATION_COUNT'});
});
test('native instructions require Bridge discovery and exact ordinary child messages without prescribing a fake parent result',()=>{
  const {cp}=fixture(),message=parentPrompt(cp);
  assert.match(message,/list_agents/);assert.match(message,/task_result/);assert.match(message,/ct02-live-codex/);
  assert.equal(expected(cp,'codex'),'synthetic-marker codex 221');
  assert(!message.includes(expected(cp,'codex')));
});
test('MCP observations expose only adapter/capability facts and anonymous task references',()=>{
  const network={network:{nodes:[{nodeId:'private-node',adapter:'codex'}]}};
  const d=auditedResult('delegate',{nodeId:'private-node'},{taskId:'private-task',status:'running'},network);
  assert.equal(d.adapter,'codex');assert.equal(d.resultTaskRef.length,16);assert(!JSON.stringify(d).includes('private-'));
  const list=auditedResult('list_agents',{}, {items:[{adapter:'codex',connectionCapabilities:{execution:true},capabilitySource:{kind:'static-adapter'}}]},network);
  assert.equal(list.capabilitiesPresent,true);assert.deepEqual(list.adapters,['codex']);
});
