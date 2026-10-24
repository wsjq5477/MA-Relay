const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const runtimeRoot=process.env.AGENTBRIDGE_VERIFY_RELATION_RUNTIME;
const runtimeModule=name=>require(runtimeRoot?path.join(runtimeRoot,'desktop/electron',name):path.join(__dirname,'../electron',name));
const {loadRelationState,syncSelectedRelation}=runtimeModule('relation-state.cjs');
const {AgentNetwork}=runtimeModule('agent-network.cjs');
const {graphFixture}=require('./i06b-ui-fixture.cjs');
const legacy=()=>({version:1,revision:8,nodes:[],collaboration:{leaderId:'original-parent',memberIds:['original-child'],revision:7},
  requests:[{requestId:'original-unknown',nodeId:'original-child',machineId:'original-machine',dispatched:true,createdAt:'2026-10-20T00:00:00Z'}],
  delegations:[{delegationId:'original-delegation',requestId:'original-unknown',parentRequestId:'original-parent-request',state:'unknown'}],
  relationOperations:[{operationId:'original-operation',state:'unknown',fingerprint:'retained-original-fingerprint'}],futureField:{retained:true}});

test('legacy migration retains exact relationship order, revisions and original unknown ownership without mutating the input',()=>{
  const original=legacy(),before=structuredClone(original),one=loadRelationState(original),two=loadRelationState(original);
  assert.deepEqual(original,before);assert.deepEqual(one,two);
  assert.deepEqual(one.relations,[{relationId:one.activeRelationId,enabled:true,...before.collaboration,envelope:{version:1,revision:0,allowedNodeIds:before.collaboration.memberIds}}]);
  assert.notEqual(one.relations[0].memberIds,original.collaboration.memberIds);
  for(const key of Object.keys(original))assert.deepEqual(one[key],original[key]);
  assert.deepEqual(loadRelationState(one),one);
});

test('selected projection commits preserve inactive relation rows and do not mutate the previous state',()=>{
  const original=loadRelationState(legacy());original.relations.push({relationId:'inactive-preserved',enabled:false,leaderId:'other-parent',memberIds:['other-child'],revision:12,envelope:{version:1,revision:0,allowedNodeIds:['other-child']},policy:{unmodified:true}});
  const before=structuredClone(original),next=syncSelectedRelation({...original,collaboration:{leaderId:'new-parent',memberIds:[],revision:8}});
  assert.deepEqual(original,before);assert.deepEqual(next.relations[1],before.relations[1]);
  assert.deepEqual(next.relations[0],{relationId:before.activeRelationId,enabled:true,...next.collaboration,envelope:{version:1,revision:1,allowedNodeIds:[]}});
  assert.deepEqual(loadRelationState(next),next);
});

test('partial, unknown, duplicate, missing-selection and conflicting stored indexes never silently migrate or overwrite either view',()=>{
  const cases=[r=>{r.relationsVersion=1;},r=>{Object.assign(r,loadRelationState(r));r.relationsVersion=4;},
    r=>{Object.assign(r,loadRelationState(r));r.relations.push({...r.relations[0]});},
    r=>{Object.assign(r,loadRelationState(r));r.activeRelationId='missing';},
    r=>{Object.assign(r,loadRelationState(r));r.collaboration.revision++;},
    r=>{r.collaboration.revision=-1;},r=>{r.collaboration.memberIds.push('original-child');}];
  for(const change of cases){const row=legacy();change(row);const before=structuredClone(row);
    assert.throws(()=>loadRelationState(row),error=>['RELATION_STATE','RELATION_STATE_CONFLICT'].includes(error.code));assert.deepEqual(row,before);}
});

test('existing legacy file is read without a write, then the first normal atomic commit persists migration and all original receipts',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-relations-'));
  const options={directory,platform:'win32',distributions:async()=>[]};
  let router=new AgentNetwork(options);router.close();
  const file=path.join(directory,'agent-network.json'),source=JSON.stringify(legacy(),null,2)+'\n';fs.writeFileSync(file,source);
  router=new AgentNetwork(options);t.after(()=>{router.close();fs.rmSync(directory,{recursive:true,force:true});});
  assert.equal(fs.readFileSync(file,'utf8'),source);assert.equal(router.network.relationsVersion,3);
  router.saveNetwork();const stored=JSON.parse(fs.readFileSync(file));
  for(const key of Object.keys(legacy()))assert.deepEqual(stored[key],legacy()[key]);
  assert.deepEqual(loadRelationState(stored),stored);router.close();router=new AgentNetwork(options);assert.deepEqual(router.network,stored);
});

test('an older writer changing only the legacy view causes a closed startup with original bytes retained',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-relations-conflict-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const row=loadRelationState(legacy());row.collaboration={leaderId:null,memberIds:[],revision:8};
  const file=path.join(directory,'agent-network.json'),bytes=JSON.stringify(row,null,2)+'\n';fs.writeFileSync(file,bytes);
  assert.throws(()=>new AgentNetwork({directory,platform:'win32'}),{code:'RELATION_STATE_CONFLICT'});
  assert.equal(fs.readFileSync(file,'utf8'),bytes);assert.deepEqual(fs.readdirSync(directory),['agent-network.json']);
});

test('real relation save and original-ID idempotency atomically retain the index and unrelated unknowns; failed rename commits neither',async t=>{
  const f=await graphFixture({runtimeRoot});t.after(()=>f.close());const snapshot=await f.router.snapshot(),leader=snapshot.nodes.find(n=>n.adapter==='claude'),child=snapshot.nodes.find(n=>n.adapter==='opencode');
  f.router.network.requests.push({...legacy().requests[0]});f.router.network.delegations.push({...legacy().delegations[0]});f.router.saveNetwork();
  const input={operationId:'relation-migration-save',leaderId:leader.nodeId,memberIds:[child.nodeId],expectedRevision:0};
  const first=await f.router.call('saveCollaboration',input);assert.equal(first.state,'confirmed');assert.deepEqual(await f.router.call('saveCollaboration',input),first);
  assert.deepEqual(f.router.network.relations[0],{relationId:f.router.network.activeRelationId,enabled:true,...first.data,envelope:{version:1,revision:1,allowedNodeIds:first.data.memberIds}});
  assert.equal(f.router.network.relationOperations.length,1);assert.deepEqual(f.router.network.requests,legacy().requests);assert.deepEqual(f.router.network.delegations,legacy().delegations);
  const bytes=fs.readFileSync(f.router.networkFile),state=structuredClone(f.router.network),rename=fs.renameSync;
  fs.renameSync=(source,target)=>{if(target===f.router.networkFile)throw Object.assign(Error('controlled full disk'),{code:'ENOSPC'});return rename(source,target);};
  try{await assert.rejects(f.router.call('saveCollaboration',{...input,operationId:'failed-save',memberIds:[],expectedRevision:first.data.revision}),{code:'ENOSPC'});}
  finally{fs.renameSync=rename;}
  assert.deepEqual(f.router.network,state);assert.deepEqual(fs.readFileSync(f.router.networkFile),bytes);
  assert.equal(f.calls.filter(row=>['nodeRequest','ipc'].includes(row.method)).length,0);
});

test('real node disconnect and machine removal keep the selected index synchronized with revocation',async t=>{
  const f=await graphFixture({runtimeRoot});t.after(()=>f.close());const snapshot=await f.router.snapshot(),leader=snapshot.nodes.find(n=>n.adapter==='claude'),child=snapshot.nodes.find(n=>n.adapter==='opencode');
  await f.router.call('saveCollaboration',{operationId:'prepare-relation',leaderId:leader.nodeId,memberIds:[child.nodeId],expectedRevision:0});
  await f.router.call('manageNode',{operationId:'disconnect-child',nodeId:child.nodeId,machineId:child.machineId,action:'disconnect'});
  let stored=JSON.parse(fs.readFileSync(f.router.networkFile));assert.deepEqual(loadRelationState(stored),stored);assert.deepEqual(stored.collaboration.memberIds,[]);
  f.router.finalizeMachine({operationId:'remove-original-machine',state:'confirmed',data:{machineId:leader.machineId,action:'remove'}});
  stored=JSON.parse(fs.readFileSync(f.router.networkFile));assert.equal(stored.collaboration.leaderId,null);assert.deepEqual(loadRelationState(stored),stored);
});
