const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const repo=process.cwd(),out=path.resolve('artifacts/issue27-28/2026-10-29'),{graphFixture}=require(path.join(repo,'desktop/tests/i06b-ui-fixture.cjs'));
const {loadRelationState}=require(path.join(repo,'desktop/electron/relation-state.cjs')),{inspect,recover}=require(path.join(repo,'desktop/electron/relation-recovery.cjs'));
(async()=>{const f=await graphFixture({runtimeRoot:path.join(out,'legacy-writer')});
try{
 const [leader,...members]=f.nodes,first=members[0],second=members[1];assert(second);
 f.router.network=loadRelationState({...f.router.network,collaboration:{leaderId:leader.nodeId,memberIds:[first.nodeId],revision:1}});f.router.saveNetwork();
 const saved=await f.router.call('saveCollaboration',{operationId:'synthetic-old-save',leaderId:leader.nodeId,memberIds:[first.nodeId,second.nodeId],expectedRevision:1});assert.equal(saved.state,'confirmed');
 await f.router.call('manageNode',{operationId:'synthetic-old-observe',nodeId:second.nodeId,action:'attach'});
 await f.router.call('manageNode',{operationId:'synthetic-old-remove',nodeId:first.nodeId,action:'remove'});
 const file=path.join(f.directory,'agent-network.json'),bytes=fs.readFileSync(file),record=JSON.parse(bytes);assert.equal(record.relations[0].revision,1);assert.equal(record.collaboration.revision,3);
 assert.throws(()=>loadRelationState(record),{code:'RELATION_STATE_CONFLICT'});
 const old=require(path.join(out,'baseline/desktop/electron/relation-recovery.cjs')).inspect(f.directory);assert.equal(old.proposal,undefined);
 const view=inspect(f.directory);assert.equal(view.proposal?.revisionTo,3,view.blockedReason);assert.deepEqual(fs.readFileSync(file),bytes);
 recover(f.directory,{operationId:'synthetic-recovery',sourceDigest:view.proposal.sourceDigest,confirm:true});const after=JSON.parse(fs.readFileSync(file));assert.deepEqual(loadRelationState(after),after);assert.deepEqual(after.nodeOperations,record.nodeOperations);assert.deepEqual(after.relationOperations,record.relationOperations);
 fs.writeFileSync(path.join(out,'legacy-writer-report.json'),JSON.stringify({status:'passed',writerSource:'v0.6.0-alpha.46 agent-network.cjs',environment:'controlled hosts, original old writer code, temporary synthetic profile',oldSelectedRevision:1,oldCollaborationRevision:3,baselineProposalAvailable:false,fixedProposalRevision:3,originalReceiptsRetained:true,modelCalls:0},null,2)+'\n');console.log('Original legacy writer reproduction and confirmed recovery passed');
}finally{f.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
