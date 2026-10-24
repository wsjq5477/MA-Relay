const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const runtimeRoot=process.env.AGENTBRIDGE_VERIFY_RELATION_RUNTIME;
const runtimeModule=name=>require(runtimeRoot?path.join(runtimeRoot,'desktop/electron',name):path.join(__dirname,'../electron',name));
const {loadRelationState,runtimeRelations}=runtimeModule('relation-state.cjs');
const {GraphOperationJournal}=runtimeModule('graph-operations.cjs');
const {digest}=runtimeModule('graph-layout.cjs');
const {graphFixture}=require('./i06b-ui-fixture.cjs');
async function fixture(t){
  const f=await graphFixture({nativeExecution:true,runtimeRoot});t.after(()=>f.close());
  const nodes=(await f.router.snapshot()).nodes,a=nodes.find(n=>n.adapter==='claude'),b=nodes.find(n=>n.adapter==='opencode');
  const call=async(method,params={})=>{const reply=await f.call(method,params);if(!reply.ok)throw Object.assign(Error(reply.error.message),reply.error);return reply.result;};
  await call('saveCollaboration',{operationId:'grant-a',leaderId:a.nodeId,memberIds:[b.nodeId],expectedRevision:0});
  const grantB=await call('saveCollaboration',{operationId:'grant-b',relationId:'relation-b',leaderId:b.nodeId,memberIds:[a.nodeId],expectedRevision:0});
  const tool=(node,name,args={},connection='connection-'+node.nodeId)=>f.router.collaborationTool({nodeId:node.nodeId,externalConnectionId:connection},name,args,'controlled-tool-call',node.machineId);
  return {...f,a,b,call,tool,grantB};
}
test('version-1 inactive rows remain inert after migration; selected row alone becomes enabled',()=>{
  const old={relationsVersion:1,activeRelationId:'original',collaboration:{leaderId:'a',memberIds:['b'],revision:4},relations:[{relationId:'original',leaderId:'a',memberIds:['b'],revision:4},{relationId:'held',leaderId:'b',memberIds:['a'],revision:12}],requests:[{requestId:'original',dispatched:true}],delegations:[{state:'unknown'}]};
  const before=structuredClone(old),next=loadRelationState(old);assert.deepEqual(old,before);assert.equal(next.relationsVersion,3);
  assert.deepEqual(runtimeRelations(next).map(r=>r.leaderId),['a']);assert.equal(next.relations[1].enabled,false);assert.equal(next.relations[1].revision,12);
  assert.deepEqual(next.requests,old.requests);assert.deepEqual(next.delegations,old.delegations);
});
test('two authenticated callers see only their own outgoing relationship despite the selected legacy leader',async t=>{
  const f=await fixture(t),a=await f.tool(f.a,'list_agents'),b=await f.tool(f.b,'list_agents');
  assert.equal(f.router.network.collaboration.leaderId,f.a.nodeId);assert.equal(a.caller.role,'leader');assert.equal(b.caller.role,'leader');
  assert.deepEqual(a.items.map(n=>n.nodeId),[f.b.nodeId]);assert.deepEqual(b.items.map(n=>n.nodeId),[f.a.nodeId]);
  await assert.rejects(f.tool(f.b,'list_agents',{relationId:f.router.network.activeRelationId}),{code:'INVALID_INPUT'});
  assert.equal(f.router.network.requests.length,0);assert.equal(f.router.network.delegations.length,0);
});
test('both managed native parents use their own current relationship and retain original parent/source admission',async t=>{
  const f=await fixture(t);
  for(const [node,requestId] of [[f.a,'parent-a'],[f.b,'parent-b']])await f.router.call('nodeRequest',{op:'submit',nodeId:node.nodeId,machineId:node.machineId,requestId,message:'controlled parent',collaboration:true});
  const scope={nodeId:f.b.nodeId,parentRequestId:'parent-b'};
  const view=await f.router.collaborationTool(scope,'list_agents',{},'native-read',f.b.machineId);assert.equal(view.caller.kind,'native-parent');assert.equal(view.caller.role,'leader');assert.deepEqual(view.items.map(n=>n.nodeId),[f.a.nodeId]);
  await assert.rejects(f.router.collaborationTool(scope,'list_agents',{},'forged-source',f.a.machineId),{code:'COLLABORATION_FORBIDDEN'});
  const parent=f.hosts.get(f.b.machineId).tasks.find(row=>row.requestId==='parent-b');parent.status='unknown';
  await assert.rejects(f.router.collaborationTool(scope,'delegate',{nodeId:f.a.nodeId,requestId:'blocked',message:'must not dispatch'},'unknown-parent',f.b.machineId),{code:'COLLABORATION_FORBIDDEN'});
  assert.equal(f.router.network.requests.length,2);assert.equal(f.router.network.delegations.length,0);
});
test('independent relation revisions and original operation receipts cannot be reused across relationship IDs',async t=>{
  const f=await fixture(t),before=f.router.network.relations.find(r=>r.relationId==='relation-b');
  await f.call('saveCollaboration',{operationId:'revoke-a',leaderId:f.a.nodeId,memberIds:[],expectedRevision:1});
  assert.deepEqual(f.router.network.relations.find(r=>r.relationId==='relation-b'),before);
  assert.deepEqual(await f.call('collaborationOperation',{operationId:'grant-b'}),f.grantB);
  await assert.rejects(f.call('saveCollaboration',{operationId:'grant-b',relationId:'alias-b',leaderId:f.b.nodeId,memberIds:[f.a.nodeId],expectedRevision:0}),{code:'OPERATION_CONFLICT'});
  await assert.rejects(f.call('saveCollaboration',{operationId:'stale-b',relationId:'relation-b',leaderId:f.b.nodeId,memberIds:[],expectedRevision:0}),{code:'REVISION_CONFLICT'});
  assert.equal((await f.call('relations')).items.length,2);
});
test('a duplicate enabled leader and an explicit write without its original operation ID are refused before mutation',async t=>{
  const f=await fixture(t),bytes=fs.readFileSync(f.router.networkFile);
  await assert.rejects(f.call('saveCollaboration',{operationId:'duplicate-b',relationId:'other-b',leaderId:f.b.nodeId,memberIds:[],expectedRevision:0}),{code:'INVALID_INPUT'});
  await assert.rejects(f.call('saveCollaboration',{relationId:'new-b',leaderId:f.b.nodeId,memberIds:[],expectedRevision:0}),{code:'INVALID_INPUT'});
  assert.deepEqual(fs.readFileSync(f.router.networkFile),bytes);assert.equal(f.router.network.relations.length,2);
});
test('delegation results remain bound to original caller/connection after one relationship is revoked',async t=>{
  const f=await fixture(t),aTask=await f.tool(f.a,'delegate',{nodeId:f.b.nodeId,requestId:'a-one',message:'controlled arithmetic'});
  const bTask=await f.tool(f.b,'delegate',{nodeId:f.a.nodeId,requestId:'b-one',message:'controlled arithmetic'});
  assert.notEqual(aTask.taskId,bTask.taskId);
  await assert.rejects(f.tool(f.b,'task_result',{taskId:aTask.taskId}),{code:'COLLABORATION_FORBIDDEN'});
  await assert.rejects(f.tool(f.a,'task_result',{taskId:aTask.taskId},'different-a-connection'),{code:'COLLABORATION_FORBIDDEN'});
  await f.call('saveCollaboration',{operationId:'revoke-only-a',leaderId:f.a.nodeId,memberIds:[],expectedRevision:1});
  await assert.rejects(f.tool(f.a,'delegate',{nodeId:f.b.nodeId,requestId:'a-two',message:'not dispatched'}),{code:'COLLABORATION_FORBIDDEN'});
  assert.equal((await f.tool(f.a,'task_result',{taskId:aTask.taskId})).taskId,aTask.taskId);
  assert.deepEqual((await f.tool(f.b,'list_agents')).items.map(n=>n.nodeId),[f.a.nodeId]);
  assert.equal(f.router.network.delegations.length,2);assert.equal(f.router.network.requests.length,2);
});
test('original unknown delegation survives revocation and relationship alias attempts without a second native submit',async t=>{
  const f=await fixture(t),host=f.hosts.get(f.b.machineId),original=host.call.bind(host);let submits=0;
  host.call=async(method,p)=>{const result=await original(method,p);if(method==='ipc'&&p.op==='submit'){submits++;throw Object.assign(Error('controlled lost ack'),{code:'TRANSPORT_LOST'});}return result;};
  await assert.rejects(f.tool(f.a,'delegate',{nodeId:f.b.nodeId,requestId:'original-unknown',message:'controlled'}),{code:'TRANSPORT_LOST'});
  const row=structuredClone(f.router.network.delegations[0]),request=structuredClone(f.router.network.requests[0]);assert.equal(row.state,'unknown');assert.equal(request.dispatched,true);
  await f.call('saveCollaboration',{operationId:'revoke-unknown-a',leaderId:f.a.nodeId,memberIds:[],expectedRevision:1});
  await assert.rejects(f.tool(f.a,'delegate',{nodeId:f.b.nodeId,requestId:'original-unknown',message:'controlled'}),{code:'COLLABORATION_FORBIDDEN'});
  await assert.rejects(f.call('saveCollaboration',{operationId:'alias-a',relationId:'other-a',leaderId:f.a.nodeId,memberIds:[f.b.nodeId],expectedRevision:0}),{code:'INVALID_INPUT'});
  assert.deepEqual(f.router.network.delegations[0],row);assert.deepEqual(f.router.network.requests[0],request);assert.equal(submits,1);
  // Even a later explicit human reauthorization under a different relation ID
  // must only query the original request, never release its native occupancy.
  await f.call('saveCollaboration',{operationId:'clear-original-a',leaderId:null,memberIds:[],expectedRevision:2});
  await f.call('saveCollaboration',{operationId:'human-regrant-a',relationId:'new-authorized-a',leaderId:f.a.nodeId,memberIds:[f.b.nodeId],expectedRevision:0});
  const recovered=await f.tool(f.a,'delegate',{nodeId:f.b.nodeId,requestId:'original-unknown',message:'controlled'});
  assert.equal(recovered.delegationId,row.delegationId);assert.equal(f.router.network.delegations.length,1);
  assert.equal(f.router.network.delegations[0].requestId,row.requestId);assert.equal(f.router.network.requests[0].requestId,request.requestId);assert.equal(submits,1);
});
test('revocation while a caller snapshot waits uses the new caller relationship rather than the earlier snapshot',async t=>{
  const f=await fixture(t),original=f.router.snapshot.bind(f.router);let release,entered;
  const ready=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
  f.router.snapshot=async()=>{const snapshot=await original();entered();await gate;return snapshot;};
  const pending=f.tool(f.b,'list_agents');await ready;
  try{await f.call('saveCollaboration',{operationId:'revoke-b-during-read',relationId:'relation-b',leaderId:f.b.nodeId,memberIds:[],expectedRevision:1});}finally{release();}
  assert.deepEqual((await pending).items,[]);assert.equal(f.router.network.requests.length,0);
});
test('node disconnect atomically revokes every incoming and outgoing relationship',async t=>{
  const f=await fixture(t);await f.call('manageNode',{operationId:'disconnect-a-everywhere',nodeId:f.a.nodeId,machineId:f.a.machineId,action:'disconnect'});
  const rows=f.router.network.relations;assert.equal(rows.find(r=>r.relationId===f.router.network.activeRelationId).leaderId,null);assert.deepEqual(rows.find(r=>r.relationId==='relation-b').memberIds,[]);
  assert(rows.every(r=>r.revision===2));assert.deepEqual(loadRelationState(JSON.parse(fs.readFileSync(f.router.networkFile))).relations,rows);
});
test('machine removal revokes all owned leaders and members while restoring does not recreate grants',async t=>{
  const f=await fixture(t);f.router.finalizeMachine({operationId:'remove-a',state:'confirmed',data:{machineId:f.a.machineId,action:'remove'}});
  const before=structuredClone(f.router.network.relations);assert(before.every(r=>r.leaderId!==f.a.nodeId&&!r.memberIds.includes(f.a.nodeId)));
  f.router.finalizeMachine({operationId:'restore-a',state:'confirmed',data:{machineId:f.a.machineId,action:'restore'}});assert.deepEqual(f.router.network.relations,before);
});
test('a lost explicit relation-save reply recovers the original ID and does not dispatch another save',async t=>{
  const f=await fixture(t),original=f.router.call.bind(f.router);let saves=0,lose=true;
  f.router.call=async(method,p)=>{const result=await original(method,p);if(method==='saveCollaboration'&&p.operationId==='lost-b-save'){saves++;if(lose){lose=false;throw Object.assign(Error('controlled lost relation reply'),{code:'TRANSPORT_LOST'});}}return result;};
  const input={operationId:'lost-b-save',relationId:'relation-b',leaderId:f.b.nodeId,memberIds:[],expectedRevision:1};
  await assert.rejects(f.call('saveCollaboration',input),{code:'TRANSPORT_LOST'});
  const receipt=await f.call('collaborationOperation',{operationId:input.operationId});assert.equal(receipt.state,'confirmed');assert.equal(receipt.data.relationId,'relation-b');
  assert.deepEqual(await f.call('saveCollaboration',input),receipt);assert.equal(saves,1);
});
test('a missing fingerprint or a changed relationship in a receipt cannot clear the original unknown',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-relation-receipt-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const journal=new GraphOperationJournal(directory);
  const params={operationId:'original-relation-op',relationId:'original-relation',leaderId:'a',memberIds:['b'],expectedRevision:0};
  await assert.rejects(journal.save('saveCollaboration',params,async()=>{throw Object.assign(Error('controlled lost ack'),{code:'TRANSPORT_LOST'});}));
  const expected=digest({relationId:params.relationId,leaderId:'a',memberIds:['b'],expectedRevision:0});
  for(const receipt of [{operationId:params.operationId,state:'confirmed',data:{relationId:params.relationId}},{operationId:params.operationId,state:'confirmed',fingerprint:expected,data:{relationId:'other'}}]){
    await assert.rejects(journal.lookup('collaborationOperation',{operationId:params.operationId},async()=>receipt),{code:'RECEIPT_MISMATCH'});assert.equal(journal.pending()[0].state,'unknown');
  }
});
test('old coordinators reject only new relationship methods before dispatch and daemon hello never advertises the central capability',async()=>{
  const {CoordinatorClient}=runtimeModule('coordinator-client.cjs'),caps=runtimeModule('runtime-capabilities.cjs');
  assert(!caps.runtimeCapabilities.includes(caps.MULTI_PARENT_RELATIONS_CAPABILITY));assert(caps.coordinatorRuntimeCapabilities.includes(caps.MULTI_PARENT_RELATIONS_CAPABILITY));
  const client=new CoordinatorClient({directory:'unused-controlled'});client.open=async()=>{};client.info={capabilities:caps.runtimeCapabilities};let writes=0;
  client.socket={write(value){writes++;const id=JSON.parse(value).id,job=client.pending.get(id);clearTimeout(job.timer);client.pending.delete(id);job.resolve({legacy:true});}};
  for(const request of [{method:'relations'},{method:'collaboration',params:{relationId:'r'}},{method:'saveCollaboration',params:{relationId:'r',operationId:'op'}}])await assert.rejects(client.request('call',request),{code:'RELATIONS_BACKEND_UPGRADE_REQUIRED'});
  assert.equal(writes,0);assert.deepEqual(await client.request('call',{method:'snapshot'}),{legacy:true});assert.equal(writes,1);
});
test('only an original persisted prewrite rejection settles an explicit relationship operation after its reply is lost',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-relation-rejected-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const journal=new GraphOperationJournal(directory);
  const params={operationId:'original-prewrite-refusal',relationId:'original-relation',leaderId:'a',memberIds:['a'],expectedRevision:0};let writes=0;
  await assert.rejects(journal.save('saveCollaboration',params,async()=>{writes++;throw Object.assign(Error('controlled original self-link refusal'),{code:'INVALID_INPUT'});}),{code:'INVALID_INPUT'});
  const query=async()=>({operationId:params.operationId,state:'not_found'});
  const receipt=await journal.lookup('collaborationOperation',{operationId:params.operationId},query);
  assert.equal(receipt.state,'rejected');assert.equal(receipt.data.relationId,params.relationId);assert.equal(receipt.error.code,'INVALID_INPUT');assert.equal(writes,1);
  const original=journal.read()[0];journal.update({...original,state:'unknown'});
  assert.equal((await journal.lookup('collaborationOperation',{operationId:params.operationId},query)).state,'not_found');assert.equal(journal.pending().length,1);
});
