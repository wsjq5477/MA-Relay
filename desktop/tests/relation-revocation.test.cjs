const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {graphFixture}=require('./i06b-ui-fixture.cjs');
const {GraphOperationJournal}=require('../electron/graph-operations.cjs');
const {digest}=require('../electron/graph-layout.cjs');

async function fixture(t){
 const f=await graphFixture();t.after(()=>f.close());
 const [leader,member,other]=f.nodes;
 await f.router.call('saveCollaboration',{operationId:'initial-grant',leaderId:leader.nodeId,memberIds:[member.nodeId,other.nodeId],expectedRevision:0});
 const journal=new GraphOperationJournal(f.directory);
 const unknown=(node,lane='node')=>{const params={operationId:'original-unknown',machineId:node.machineId,...(lane==='node'?{nodeId:node.nodeId,action:'attach'}:{})};const row={lane,method:lane==='node'?'manageNode':'machine.maintainDaemon',operationId:params.operationId,params,fingerprint:digest(params),state:'unknown',time:'2026-10-20T00:00:00Z'};journal.update(row);return row;};
 const save=(leaderId,memberIds,expectedRevision=1,operationId='revoke')=>f.call('saveCollaboration',{operationId,leaderId,memberIds,expectedRevision});
 return {...f,leader,member,other,journal,unknown,save};
}

test('issue25: revoke a blocked unavailable member without querying its original intent; replay and reopen retain one revision',async t=>{
 const f=await fixture(t),row=f.unknown(f.member),node=f.router.node(f.member.nodeId);
 node.connected=false;node.executionSupported=false;f.router.saveNetwork();
 const history=JSON.stringify({requests:f.router.network.requests,delegations:f.router.network.delegations,instances:f.router.catalog.instances}),calls=[];
 const original=f.router.call.bind(f.router);f.router.call=async(m,p)=>{calls.push(m);return original(m,p);};
 const receipt=await f.save(f.leader.nodeId,[f.other.nodeId]);assert.equal(receipt.ok,true,JSON.stringify(receipt));
 assert.equal(receipt.result.data.revision,2);assert.deepEqual(receipt.result.data.memberIds,[f.other.nodeId]);
 assert.equal((await f.save(f.leader.nodeId,[f.other.nodeId])).result.data.revision,2);
 assert.equal(calls.filter(m=>m==='saveCollaboration').length,1);assert(!calls.includes('nodeOperation'));
 const addBack=await f.save(f.leader.nodeId,[f.member.nodeId,f.other.nodeId],2,'add-back');assert.equal(addBack.error?.code,'GRAPH_UNCONFIRMED');
 assert.deepEqual(f.journal.pending(),[row]);assert.equal(JSON.stringify({requests:f.router.network.requests,delegations:f.router.network.delegations,instances:f.router.catalog.instances}),history);
 const stored=JSON.parse(fs.readFileSync(f.router.networkFile));assert.equal(stored.collaboration.revision,2);assert.deepEqual(stored.collaboration.memberIds,[f.other.nodeId]);
 assert.deepEqual(new GraphOperationJournal(f.directory).pending(),[row]);
});

test('issue25: explicit relation revocation uses that row as its base and preserves the selected and other relations',async t=>{
 const f=await fixture(t),relationId='another-relation';
 await f.router.call('saveCollaboration',{relationId,operationId:'other-initial',leaderId:f.other.nodeId,memberIds:[f.member.nodeId],expectedRevision:0});
 const selected=structuredClone(f.router.network.collaboration),originalRows=structuredClone(f.router.network.relations.filter(r=>r.relationId!==relationId)),row=f.unknown(f.member);
 const reply=await f.call('saveCollaboration',{relationId,operationId:'other-revoke',leaderId:f.other.nodeId,memberIds:[],expectedRevision:1});
 assert.equal(reply.ok,true,JSON.stringify(reply));assert.equal(reply.result.data.relationId,relationId);assert.equal(reply.result.data.revision,2);
 assert.deepEqual(f.router.network.collaboration,selected);assert.deepEqual(f.router.network.relations.filter(r=>r.relationId!==relationId),originalRows);assert.deepEqual(f.journal.pending(),[row]);
});

test('issue25: retained offline nodes do not block a reduction, clear, new member or replacement leader',async t=>{
 for(const action of ['reduce','clear','add','replace'])await t.test(action,async t=>{
  const f=await fixture(t);const old=f.router.node(f.member.nodeId);old.connected=false;old.executionSupported=false;f.router.saveNetwork();
  const row=f.unknown(f.member);let leader=f.leader.nodeId,members=[f.other.nodeId];
  if(action==='clear'){leader=null;members=[];}
  if(action==='replace'){leader=f.other.nodeId;members=[f.member.nodeId];}
  if(action==='add'){
   const added={...f.router.node(f.other.nodeId),nodeId:'new-independent',adapter:'codex',executable:'/opt/new-codex'};f.router.network.nodes.push(added);f.router.saveNetwork();members=[f.member.nodeId,f.other.nodeId,added.nodeId];
  }
  const reply=await f.save(leader,members);assert.equal(reply.ok,true,JSON.stringify(reply));assert.deepEqual(f.journal.pending(),[row]);assert.deepEqual(reply.result.data.memberIds,members);
 });
});

test('issue25: machine unknown is scoped to new targets and never blocks pure revocation',async t=>{
 const f=await fixture(t),row=f.unknown(f.member,'machine');
 const reply=await f.save(f.leader.nodeId,[f.other.nodeId]);assert.equal(reply.ok,true,JSON.stringify(reply));assert.deepEqual(f.journal.pending(),[row]);
 const blocked=await f.save(f.member.nodeId,[],2,'blocked-new-main');assert.equal(blocked.error?.code,'GRAPH_UNCONFIRMED');
 const independent=await f.save(f.other.nodeId,[],2,'independent-main');assert.equal(independent.ok,true,JSON.stringify(independent));assert.deepEqual(f.journal.pending(),[row]);
});

test('issue25: original relation uncertainty, corrupt journal and missing management provenance still block revocation',async t=>{
 for(const mode of ['relation','corrupt','missing-machine','missing-node'])await t.test(mode,async t=>{
  const f=await fixture(t),row=f.unknown(f.member,mode==='relation'?'relation':'node');
  if(mode==='missing-machine')delete row.params.machineId;
  if(mode==='missing-node')delete row.params.nodeId;
  f.journal.update(row);
  if(mode==='corrupt')fs.writeFileSync(path.join(f.directory,'graph-pending.json'),'{');
  const reply=await f.save(f.leader.nodeId,[]);assert.equal(reply.ok,false);assert.equal(f.router.network.collaboration.revision,1);
  if(mode!=='corrupt'){assert.equal(reply.error.code,'GRAPH_UNCONFIRMED');assert.deepEqual(f.journal.pending(),[row]);}
 });
});

test('issue25: new targets still require management and capabilities; stale revision and changed operation content reject',async t=>{
 const f=await fixture(t),row=f.unknown(f.member);
 let reply=await f.save(f.member.nodeId,[]);assert.equal(reply.error?.code,'GRAPH_UNCONFIRMED');
 reply=await f.save(f.leader.nodeId,[],0);assert.equal(reply.error?.code,'REVISION_CONFLICT');
 assert.equal(f.router.network.collaboration.revision,1);assert.deepEqual(f.journal.pending(),[row]);
 const added={...f.router.node(f.other.nodeId),nodeId:'new-ineligible',adapter:'unknown',executable:'/ineligible',executionSupported:false};f.router.network.nodes.push(added);f.router.saveNetwork();
 reply=await f.save(f.leader.nodeId,[added.nodeId],1,'ineligible');assert.equal(reply.ok,false);assert.equal(reply.error.code,'NODE_DISCONNECTED');
 reply=await f.save(f.leader.nodeId,[],1,'valid');assert.equal(reply.ok,true,JSON.stringify(reply));
 reply=await f.save(null,[],2,'valid');assert.equal(reply.error?.code,'OPERATION_CONFLICT');
 assert.deepEqual(f.journal.pending(),[row]);
});
