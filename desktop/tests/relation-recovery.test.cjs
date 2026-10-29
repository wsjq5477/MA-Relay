const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const runtimeRoot=process.env.AGENTBRIDGE_VERIFY_RELATION_RUNTIME;
const runtimePath=name=>runtimeRoot?path.join(runtimeRoot,'desktop/electron',name):path.join(__dirname,'../electron',name);
const loadRuntime=name=>require(runtimePath(name));
const {digest}=loadRuntime('graph-layout.cjs');
const {inspect,recover}=loadRuntime('relation-recovery.cjs');
const {loadRelationState}=loadRuntime('relation-state.cjs');
const {createCoordinatorService}=loadRuntime('coordinator-service.cjs');
const {CoordinatorClient}=loadRuntime('coordinator-client.cjs');
function fixture(){
  const members=['a','b','c','d','e'],added=[...members,'f','g'],final=added.filter(id=>id!=='a');
  const collaboration={leaderId:'leader',memberIds:final,revision:15};
  return {version:1,nodes:['leader',...added].map(nodeId=>({nodeId,machineId:'machine',connected:nodeId!=='a',removed:nodeId==='a'})),requests:[{requestId:'preserved',state:'unknown'}],delegations:[{state:'unknown'}],
    relationsVersion:3,activeRelationId:'selected',collaboration,
    relations:[{relationId:'selected',enabled:true,leaderId:'leader',memberIds:members,revision:13,envelope:{version:1,revision:3,allowedNodeIds:[...members,'preauthorized']}},{relationId:'other',enabled:false,leaderId:null,memberIds:[],revision:2,envelope:{version:1,revision:0,allowedNodeIds:[]}}],
    relationOperations:[{operationId:'save14',state:'confirmed',fingerprint:digest({leaderId:'leader',memberIds:added,expectedRevision:13}),data:{leaderId:'leader',memberIds:added,revision:14}}],
    nodeOperations:[{operationId:'remove15',state:'confirmed',fingerprint:digest({nodeId:'a',machineId:'machine',action:'remove'}),data:{node:{nodeId:'a',machineId:'machine',connected:false,removed:true},collaboration}}],machineOperations:[],future:{preserved:true}};
}
function setup(t,record=fixture()){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-recovery-')),file=path.join(directory,'agent-network.json');
  const bytes=Buffer.from(JSON.stringify(record,null,3)+'\r\n');fs.writeFileSync(file,bytes);
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return {directory,file,bytes,record};
}
test('5→7→6 chain needs explicit confirmation, preserves exact backup, history and restart state; original ID is idempotent',t=>{
  const {directory,file,bytes,record}=setup(t),view=inspect(directory),p=view.proposal;
  assert.equal(view.conflict,true);assert.equal(p.revisionTo,15);assert.equal(p.members.filter(m=>m.change==='add').length,2);assert.equal(p.members.filter(m=>m.change==='remove').length,1);
  assert.deepEqual(fs.readFileSync(file),bytes);
  assert.throws(()=>recover(directory,{operationId:'recovery',sourceDigest:p.sourceDigest}),{code:'RELATION_RECOVERY_BLOCKED'});assert.deepEqual(fs.readFileSync(file),bytes);
  const params={operationId:'recovery',sourceDigest:p.sourceDigest,confirm:true},receipt=recover(directory,params),next=JSON.parse(fs.readFileSync(file));
  assert.deepEqual(fs.readFileSync(path.join(directory,receipt.backup)),bytes);assert.equal(receipt.backupDigest,p.sourceDigest);
  assert.equal(next.relations[0].revision,15);assert.equal(next.relations[0].envelope.revision,5);assert.equal(next.relations[0].envelope.allowedNodeIds.includes('a'),false);assert.equal(next.relations[0].envelope.allowedNodeIds.includes('preauthorized'),true);
  for(const key of Object.keys(record).filter(k=>k!=='relations'))assert.deepEqual(next[key],record[key]);assert.deepEqual(next.relations[1],record.relations[1]);
  assert.deepEqual(loadRelationState(next),next);const after=fs.readFileSync(file);assert.deepEqual(recover(directory,params),receipt);assert.deepEqual(fs.readFileSync(file),after);
});
test('a confirmed old attach observes revision 14 without becoming a second relationship mutation',t=>{
  const record=fixture(),collaboration=record.relationOperations[0].data;
  record.nodeOperations.unshift({operationId:'attach-observation',state:'confirmed',fingerprint:digest({nodeId:'f',machineId:'machine',action:'attach'}),data:{node:{nodeId:'f',machineId:'machine',connected:true,removed:false},collaboration}});
  const {directory,file,bytes}=setup(t,record),view=inspect(directory);
  assert.equal(view.proposal?.revisionTo,15,view.blockedReason);assert.deepEqual(fs.readFileSync(file),bytes);
  const receipt=recover(directory,{operationId:'recover-with-observation',sourceDigest:view.proposal.sourceDigest,confirm:true});
  const after=JSON.parse(fs.readFileSync(file));assert.equal(after.relations[0].memberIds.length,6);assert.deepEqual(after.nodeOperations,record.nodeOperations);assert.equal(receipt.state,'confirmed');
});
test('an attach observation contradicting its original revision never authorizes recovery',t=>{
  const record=fixture();record.nodeOperations.push({operationId:'contradictory-attach',state:'confirmed',fingerprint:digest({nodeId:'f',action:'attach'}),data:{node:{nodeId:'f',machineId:'machine',connected:true},collaboration:{...record.relationOperations[0].data,memberIds:['other']}}});
  const {directory,file,bytes}=setup(t,record);assert.equal(inspect(directory).proposal,undefined);assert.deepEqual(fs.readFileSync(file),bytes);
});
test('missing, ambiguous, unknown, duplicate, bad fingerprint and unexplained revocation sources remain read-only',t=>{
  for(const mutate of [r=>r.relationOperations=[],r=>r.nodeOperations[0].state='unknown',r=>r.relationOperations.push({...r.relationOperations[0]}),r=>r.nodeOperations[0].data.node.nodeId='missing',r=>r.relationOperations[0].fingerprint='a'.repeat(64),r=>r.machineOperations.push({operationId:'machine-remove',state:'confirmed',fingerprint:'a'.repeat(64),data:{action:'remove',machineId:'machine'}}),r=>r.relations.push({...r.relations[0]})]){
    const record=fixture();mutate(record);const {directory,file,bytes}=setup(t,record);
    let view;try{view=inspect(directory);}catch(e){assert.equal(e.code,'RELATION_STATE');}
    if(view)assert.equal(view.proposal,undefined);assert.deepEqual(fs.readFileSync(file),bytes);
  }
});
test('management unknown, source change and backup/write/rename failures cannot modify the original',t=>{
  const {directory,file,bytes}=setup(t),p=inspect(directory).proposal,params={operationId:'recover',sourceDigest:p.sourceDigest,confirm:true};
  fs.writeFileSync(path.join(directory,'graph-pending.json'),JSON.stringify([{lane:'node',state:'unknown'}]));assert.equal(inspect(directory).proposal,undefined);assert.throws(()=>recover(directory,params));fs.unlinkSync(path.join(directory,'graph-pending.json'));
  for(const method of ['openSync','readFileSync','writeFileSync','renameSync']){
    const original=fs[method];let calls=0;
    fs[method]=(...args)=>{const target=String(args[0]);if((method==='readFileSync'?target.endsWith('.bak'):method==='writeFileSync'?typeof args[0]==='number':target.includes('.bak')||target.endsWith('.tmp'))&&++calls===1)throw Object.assign(Error('controlled failure'),{code:'EIO'});return original(...args);};
    try{assert.throws(()=>recover(directory,params));}finally{fs[method]=original;}
    assert.deepEqual(fs.readFileSync(file),bytes);
  }
  fs.appendFileSync(file,' ');assert.throws(()=>recover(directory,params),{code:'RELATION_RECOVERY_BLOCKED'});
});
test('service exposes recovery before normal mutable load',async t=>{
  const {directory}=setup(t),service=createCoordinatorService({directory,platform:'win32'});t.after(()=>service.close());
  const result=await service.dispatch('call',{method:'relationRecovery.inspect',params:{}});assert.equal(result.ok,true);assert.equal(result.result.proposal.revisionTo,15);
  const confirmed=await service.dispatch('call',{method:'relationRecovery.confirm',params:{confirm:true,operationId:'service',sourceDigest:result.result.proposal.sourceDigest}});assert.equal(confirmed.ok,true);
});
test('v3 writer guard rejects old capability sets before use and permits declared sync runtime',t=>{
  const {directory}=setup(t),client=new CoordinatorClient({directory});
  for(const capabilities of [[],['multi-parent-relations-v1'],['relation-index-sync-v1']])assert.throws(()=>client.guardRelations({version:'old',capabilities}),{code:'RELATIONS_BACKEND_UPGRADE_REQUIRED'});
  assert.doesNotThrow(()=>client.guardRelations({version:'current',capabilities:['multi-parent-relations-v1','relation-index-sync-v1']}));
});
test('old live coordinator handshake is refused before any business dispatch',async t=>{
  const net=require('node:net'),{endpoint,identity,readLines,PROTOCOL}=loadRuntime('coordinator.cjs');
  const {directory,file,bytes}=setup(t),owner=identity(directory);let dispatched=0;
  const sockets=new Set();
  const server=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let hello=false;
    readLines(socket,()=>{if(hello){dispatched++;return;}hello=true;socket.write(JSON.stringify({hello:true,protocol:PROTOCOL,coordinatorId:owner.coordinatorId,version:'old',capabilities:['multi-parent-relations-v1']})+'\n');});
  });
  await new Promise(resolve=>server.listen(endpoint(directory),resolve));
  const client=new CoordinatorClient({directory});
  try{await assert.rejects(client.request('call',{method:'snapshot',params:{}}),{code:'RELATIONS_BACKEND_UPGRADE_REQUIRED'});assert.equal(dispatched,0);assert.deepEqual(fs.readFileSync(file),bytes);}
  finally{client.close();for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
});
test('backup mismatch blocks recovery and preserves original bytes',t=>{
  const {directory,file,bytes}=setup(t),p=inspect(directory).proposal,original=fs.readFileSync;
  fs.readFileSync=(file,...args)=>String(file).endsWith('.bak')?Buffer.from('mismatch'):original(file,...args);
  try{assert.throws(()=>recover(directory,{operationId:'mismatch',sourceDigest:p.sourceDigest,confirm:true}),{code:'RELATION_RECOVERY_BLOCKED'});}finally{fs.readFileSync=original;}
  assert.deepEqual(fs.readFileSync(file),bytes);
});
test('auto-start checks runtime manifest capabilities before spawning a writer',async t=>{
  const {directory,file,bytes}=setup(t),runtimeModule=loadRuntime('coordinator-runtime.cjs'),original=runtimeModule.coordinatorRuntime;
  const clientPath=require.resolve(runtimePath('coordinator-client.cjs')),cached=require.cache[clientPath];
  fs.writeFileSync(path.join(directory,'coordinator-runtime.json'),JSON.stringify({version:'old',capabilities:['multi-parent-relations-v1']}));
  runtimeModule.coordinatorRuntime=()=>({directory,executable:'must-not-launch',entry:'must-not-launch'});delete require.cache[clientPath];
  try{
    const {CoordinatorClient:FreshClient}=require(clientPath),client=new FreshClient({directory});
    client.attach=async()=>{throw Object.assign(Error('absent'),{code:'ENOENT'});};
    await assert.rejects(client.ensure(),{code:'RELATIONS_BACKEND_UPGRADE_REQUIRED'});assert.equal(fs.existsSync(path.join(directory,'coordinator.log')),false);assert.deepEqual(fs.readFileSync(file),bytes);
  }finally{runtimeModule.coordinatorRuntime=original;require.cache[clientPath]=cached;}
});

test('a confirmed unrelated disconnect at an observed revision is not a duplicate mutation',t=>{
  const record=fixture();record.nodes.push({nodeId:'unrelated',machineId:'other-machine',connected:false});
  record.nodeOperations.unshift({operationId:'unrelated-disconnect',state:'confirmed',fingerprint:digest({nodeId:'unrelated',action:'disconnect'}),data:{node:{nodeId:'unrelated',machineId:'other-machine',connected:false,removed:false},collaboration:record.relationOperations[0].data}});
  const {directory,file,bytes}=setup(t,record),view=inspect(directory);assert.equal(view.proposal?.revisionTo,15,view.blockedReason);assert.deepEqual(fs.readFileSync(file),bytes);
});

test('lost observer acknowledgement is checked against the exact original durable receipt without rewriting unknowns',t=>{
  const {directory,file}=setup(t),record=fixture(),op=record.relationOperations[0];
  const params={operationId:op.operationId,expectedRevision:13,leaderId:op.data.leaderId,memberIds:op.data.memberIds};
  const journal=[{lane:'relation',method:'saveCollaboration',operationId:op.operationId,state:'unknown',params,fingerprint:digest(params)}],journalFile=path.join(directory,'graph-pending.json');
  fs.writeFileSync(journalFile,JSON.stringify(journal));const bytes=fs.readFileSync(journalFile),view=inspect(directory);
  assert.equal(view.proposal?.revisionTo,15,view.blockedReason);recover(directory,{operationId:'recover-original-receipt',sourceDigest:view.proposal.sourceDigest,confirm:true});
  assert.deepEqual(fs.readFileSync(journalFile),bytes);assert.deepEqual(JSON.parse(fs.readFileSync(file)).relationOperations,record.relationOperations);
});
test('a mismatched original journal fingerprint or ID cannot release an unknown placeholder',t=>{
  for(const changed of ['fingerprint','operationId']){
    const {directory,file,bytes}=setup(t),record=fixture(),op=record.relationOperations[0],params={operationId:op.operationId,expectedRevision:13,leaderId:op.data.leaderId,memberIds:op.data.memberIds};
    const row={lane:'relation',method:'saveCollaboration',operationId:op.operationId,state:'unknown',params,fingerprint:digest(params)};row[changed]='mismatch';
    fs.writeFileSync(path.join(directory,'graph-pending.json'),JSON.stringify([row]));assert.equal(inspect(directory).proposal,undefined);assert.deepEqual(fs.readFileSync(file),bytes);
  }
});

test('new recovery window cannot silently call an older index-sync coordinator',async t=>{
  const {directory}=setup(t),client=new CoordinatorClient({directory});client.open=async()=>{};client.info={capabilities:['relation-index-sync-v1','multi-parent-relations-v1']};
  for(const method of ['relationRecovery.inspect','relationRecovery.confirm'])await assert.rejects(client.request('call',{method,params:{}}),{code:'RELATION_RECOVERY_BACKEND_UPGRADE_REQUIRED'});
});

test('confirmed policy and connection history already covered by the selected baseline does not block later old-writer recovery',t=>{
  const record=fixture(),owner={nodeId:'leader',requestId:'synthetic-parent',conversationId:'synthetic-session'};
  record.connectionOperations=[{operationId:'connect-at-baseline',operationKey:digest({owner,operationId:'connect-at-baseline'}),owner,action:'connect',nodeId:'b',relationId:'selected',relationRevision:12,state:'confirmed',fingerprint:digest({action:'connect',nodeId:'b'})}];
  record.connectionPolicyOperations=[{operationId:'policy-at-baseline',state:'confirmed',fingerprint:'a'.repeat(64),data:{relationId:'selected',revision:11,policyRevision:2}}];
  const {directory,file,bytes}=setup(t,record),view=inspect(directory);assert.equal(view.proposal?.revisionTo,15,view.blockedReason);assert.deepEqual(fs.readFileSync(file),bytes);
  recover(directory,{operationId:'recover-with-baseline-policy',sourceDigest:view.proposal.sourceDigest,confirm:true});const after=JSON.parse(fs.readFileSync(file));assert.deepEqual(after.connectionOperations,record.connectionOperations);assert.deepEqual(after.connectionPolicyOperations,record.connectionPolicyOperations);
});
test('a later or unbound policy decision cannot be hidden as baseline history',t=>{
  for(const data of [{relationId:'selected',revision:14,policyRevision:4},{relationId:'selected',revision:10,policyRevision:9},{approvalId:'missing',decision:'allow'}]){
    const record=fixture();record.connectionPolicyOperations=[{operationId:'unproven-policy',state:'confirmed',fingerprint:'a'.repeat(64),data}];const {directory,file,bytes}=setup(t,record);assert.equal(inspect(directory).proposal,undefined);assert.deepEqual(fs.readFileSync(file),bytes);
  }
});

test('an observer payload with extra unproven parameters cannot borrow a matching subset receipt',t=>{
 const {directory}=setup(t),record=fixture(),op=record.relationOperations[0],params={operationId:op.operationId,leaderId:op.data.leaderId,memberIds:op.data.memberIds,expectedRevision:13,foreignScope:'unproven'};
 fs.writeFileSync(path.join(directory,'graph-pending.json'),JSON.stringify([{lane:'relation',method:'saveCollaboration',operationId:op.operationId,state:'unknown',params,fingerprint:digest(params)}]));assert.equal(inspect(directory).proposal,undefined);
});

test('a contradictory removed-but-connected receipt cannot justify automatic recovery',t=>{
 const record=fixture();record.nodeOperations[0].data.node.connected=true;const {directory,file,bytes}=setup(t,record);assert.equal(inspect(directory).proposal,undefined);assert.deepEqual(fs.readFileSync(file),bytes);
});
