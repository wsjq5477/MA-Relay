const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {GraphOperationJournal}=require('../electron/graph-operations.cjs');
const {collaborationCapabilityError}=require('../electron/builtin-adapters.cjs');
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-connection-graph-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return {directory,journal:new GraphOperationJournal(directory)};}
const params={operationId:'original-relation',expectedRevision:0,leaderId:'direct-only',memberIds:[]};

test('a local capability refusal survives lost response and restart as the original rejected relation receipt',async t=>{
  const f=fixture(t);let writes=0;
  const dispatch=async(method,p)=>{if(method==='saveCollaboration'){writes++;throw collaborationCapabilityError('调用方能力未实现，关系未提交。');}return {operationId:p.operationId,state:'not_found'};};
  await assert.rejects(f.journal.save('saveCollaboration',params,dispatch),{code:'COLLABORATION_CAPABILITY'});
  const restored=new GraphOperationJournal(f.directory);
  assert.equal(restored.pending().length,0);
  const receipt=await restored.lookup('collaborationOperation',{operationId:params.operationId},dispatch);
  assert.deepEqual(receipt,{operationId:params.operationId,state:'rejected',error:{code:'COLLABORATION_CAPABILITY',message:'调用方能力未实现，关系未提交。'}});
  assert.deepEqual(restored.read()[0].params,params);
  await assert.rejects(restored.save('saveCollaboration',params,dispatch),{code:'COLLABORATION_CAPABILITY'});
  assert.equal(writes,1,'recovery never resends the refused original operation');
});

test('unbranded capability codes and other operation lanes retain unknown even when the code is identical',async t=>{
  for(const mode of ['remote-relation','remote-machine','branded-machine'])await t.test(mode,async t=>{
    const f=fixture(t),method=mode==='remote-relation'?'saveCollaboration':'machine.disconnect';
    const p=method==='saveCollaboration'?params:{operationId:'original-machine',machineId:'machine',connectionId:'connection',expectedRevision:1};
    const dispatch=async(name,input)=>{if(name===method)throw mode==='branded-machine'?collaborationCapabilityError('wrong lane'):Object.assign(Error('remote same public code'),{code:'COLLABORATION_CAPABILITY'});return {operationId:input.operationId,state:'not_found'};};
    await assert.rejects(f.journal.save(method,p,dispatch),{code:'COLLABORATION_CAPABILITY'});
    const restored=new GraphOperationJournal(f.directory);
    assert.equal(restored.pending().length,1);
    await assert.rejects(restored.save('saveCollaboration',{...params,operationId:'new-alias'},dispatch),{code:'GRAPH_UNCONFIRMED'});
    assert.equal(restored.pending()[0].operationId,p.operationId);
  });
});

test('foreign confirmed or rejected graph receipts cannot settle the original journal intent',async t=>{
  for(const state of ['confirmed','rejected'])await t.test(state,async t=>{
    const f=fixture(t),foreign={operationId:'foreign',state,data:{revision:99},error:{code:'COLLABORATION_CAPABILITY',message:'foreign receipt'}};
    const dispatch=async()=>foreign;
    await f.journal.save('saveCollaboration',params,dispatch);
    assert.equal(f.journal.pending().length,1);
    await f.journal.lookup('collaborationOperation',{operationId:params.operationId},dispatch);
    assert.equal(f.journal.pending().length,1);
    assert.equal(f.journal.pending()[0].operationId,params.operationId);
  });
});
