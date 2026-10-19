const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {GraphOperationJournal}=require('../electron/graph-operations.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ab-graph-journal-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return {dir,journal:new GraphOperationJournal(dir)};}
test('central graph uncertainty survives restart, blocks new IDs in its lane and only queries the original request',async t=>{
  const {journal,dir}=fixture(t),calls=[];let receipt;
  const dispatch=async(m,p)=>{calls.push(m);if(m==='saveCollaboration')throw Object.assign(Error('transport'),{code:'DESKTOP_TRANSPORT'});return receipt||{operationId:p.operationId,state:'not_found'};};
  const params={operationId:'lost',expectedRevision:0,leaderId:'main',memberIds:[]};
  await assert.rejects(journal.save('saveCollaboration',params,dispatch),{code:'DESKTOP_TRANSPORT'});
  const restored=new GraphOperationJournal(dir);
  await assert.rejects(restored.save('saveCollaboration',{...params,operationId:'alias'},dispatch),{code:'GRAPH_UNCONFIRMED'});
  const result=await restored.save('saveCollaboration',params,dispatch);assert.equal(result.state,'not_found');
  assert.equal(calls.filter(m=>m==='saveCollaboration').length,1);
  await assert.rejects(restored.save('saveCollaboration',{...params,memberIds:['changed']},dispatch),{code:'OPERATION_CONFLICT'});
  receipt={operationId:'lost',state:'confirmed',data:{leaderId:'main',memberIds:[],revision:1}};
  assert.deepEqual(await restored.lookup('collaborationOperation',{operationId:'lost'},dispatch),receipt);
  assert.deepEqual(restored.pending(),[]);
});
test('graph intent must persist before dispatch; definite validation failure frees the lane while retaining original payload fingerprint',async t=>{
  const {journal}=fixture(t);let writes=0;
  const rename=fs.renameSync;fs.renameSync=(a,b)=>{if(b===journal.file)throw Error('disk');return rename(a,b);};
  try{await assert.rejects(journal.save('saveGraphLayout',{operationId:'before'},async()=>{writes++;}),{code:'GRAPH_INTENT_FAILED'});}finally{fs.renameSync=rename;}
  assert.equal(writes,0);
  const p={operationId:'invalid',layout:{}};
  await assert.rejects(journal.save('saveGraphLayout',p,async()=>{throw Object.assign(Error('bad layout'),{code:'INVALID_INPUT'});}),{code:'INVALID_INPUT'});
  assert.equal(journal.pending().length,0);
  await assert.rejects(journal.save('saveGraphLayout',{...p,layout:{changed:true}},async()=>{}),{code:'OPERATION_CONFLICT'});
});
test('layout uncertainty does not block authorization and receipts atomically committed before lost ACK reconcile without another write',async t=>{
  const {journal}=fixture(t);let relationWrites=0;
  const dispatch=async(m,p)=>{
    if(m==='saveGraphLayout')throw Object.assign(Error('layout lost'),{code:'DESKTOP_TRANSPORT'});
    if(m==='graphLayoutOperation')return {operationId:p.operationId,state:'not_found'};
    if(m==='saveCollaboration'){relationWrites++;throw Object.assign(Error('ACK lost'),{code:'DESKTOP_TRANSPORT'});}
    return {operationId:p.operationId,state:'confirmed',data:{revision:1}};
  };
  await assert.rejects(journal.save('saveGraphLayout',{operationId:'layout'},dispatch));
  const p={operationId:'relation',expectedRevision:0};
  await assert.rejects(journal.save('saveCollaboration',p,dispatch));
  assert.equal((await journal.save('saveCollaboration',p,dispatch)).state,'confirmed');assert.equal(relationWrites,1);
  assert.equal(journal.pending().length,1);assert.equal(journal.pending()[0].lane,'layout');
});
test('node and authority writes share a safety barrier but layout remains independent; original node receipts are queried after lost ACK',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-node-lane-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const journal=new GraphOperationJournal(directory);let receipt=null,writes=0;
  const dispatch=async(method,p)=>{if(method==='manageNode'){writes++;receipt={operationId:p.operationId,state:'confirmed',data:{node:{removed:true}}};throw Object.assign(Error('lost ACK'),{code:'DESKTOP_TRANSPORT'});}if(method==='nodeOperation')return receipt||{operationId:p.operationId,state:'not_found'};return {operationId:p.operationId,state:'confirmed',data:{}};};
  const p={operationId:'original',nodeId:'node',action:'remove'};
  await assert.rejects(journal.save('manageNode',p,dispatch));assert.equal(journal.pending()[0].lane,'node');
  const actual=receipt;receipt=null;
  await assert.rejects(journal.save('saveCollaboration',{operationId:'other',expectedRevision:0,leaderId:null,memberIds:[]},dispatch),{code:'GRAPH_UNCONFIRMED'});
  await assert.rejects(journal.save('manageNode',{...p,operationId:'alias'},dispatch),{code:'GRAPH_UNCONFIRMED'});assert.equal(writes,1);
  assert.equal((await journal.save('saveGraphLayout',{operationId:'layout',expectedLayoutRevision:0,layout:{}},dispatch)).state,'confirmed');
  receipt=actual;assert.deepEqual(await journal.save('manageNode',p,dispatch),actual);assert.equal(writes,1);assert.equal(journal.pending().length,0);
});

test('an original local node unknown does not block another machine maintenance; same-machine and missing provenance still block',async t=>{
 const {journal}=fixture(t);let writes=0;
 const dispatch=async(method,p)=>{if(method==='manageNode')throw Object.assign(Error('original timeout'),{code:'NATIVE_START_TIMEOUT'});if(method==='nodeOperation')return {operationId:p.operationId,state:'unknown'};writes++;return {operationId:p.operationId,state:'confirmed'};};
 await assert.rejects(journal.save('manageNode',{operationId:'local-original',machineId:'windows',nodeId:'opencode',action:'attach'},dispatch));
 const before=journal.pending()[0];
 assert.equal((await journal.save('machine.maintainDaemon',{operationId:'remote-upgrade',machineId:'ssh-original',connectionId:'ssh-connection',expectedRevision:1,config:{action:'upgrade'}},dispatch)).state,'confirmed');
 assert.equal(writes,1);assert.deepEqual(journal.pending()[0],before);
 await assert.rejects(journal.save('machine.maintainDaemon',{operationId:'same-machine',machineId:'windows',connectionId:'local',expectedRevision:1,config:{action:'upgrade'}},dispatch),{code:'GRAPH_UNCONFIRMED'});
 assert.equal(writes,1);
});

test('scope isolation preserves same-machine, missing-source and authority barriers despite unrelated query failure',async t=>{
 const {journal}=fixture(t);let writes=0;
 const dispatch=async(method,p)=>{if(method==='nodeOperation')throw Object.assign(Error('source offline'),{code:'MACHINE_OFFLINE'});writes++;return {operationId:p.operationId,state:'confirmed'};};
 const row={operationId:'old-node',lane:'node',method:'manageNode',params:{operationId:'old-node',machineId:'local',nodeId:'old',action:'attach'},state:'unknown',time:'original-time',error:{code:'NATIVE_START_TIMEOUT',message:'original'}};journal.update(row);
 assert.equal((await journal.save('machine.disconnect',{operationId:'other',machineId:'remote',connectionId:'remote-conn'},dispatch)).state,'confirmed');assert.equal(writes,1);assert.deepEqual(journal.pending()[0],row);
 await assert.rejects(journal.save('machine.remove',{operationId:'same',machineId:'local',connectionId:'local-conn'},dispatch),{code:'GRAPH_UNCONFIRMED'});
 await assert.rejects(journal.save('saveCollaboration',{operationId:'relation',expectedRevision:0,leaderId:null,memberIds:[]},dispatch),{code:'GRAPH_UNCONFIRMED'});
 delete row.params.machineId;journal.update(row);await assert.rejects(journal.save('machine.disconnect',{operationId:'no-source',machineId:'remote',connectionId:'remote-conn'},dispatch),{code:'GRAPH_UNCONFIRMED'});assert.equal(writes,1);
});
