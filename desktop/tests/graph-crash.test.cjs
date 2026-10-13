const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {GraphOperationJournal}=require('../electron/graph-operations.cjs');
test('actual isolated process death before/after authority or layout rename preserves original receipt and never replays a write',async t=>{
  for(const lane of ['relation','layout'])for(const phase of ['before','after']){
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-graph-crash-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
    const result=spawnSync(process.execPath,[path.join(__dirname,'graph-crash-child.cjs'),directory,lane,phase],{timeout:10000});
    assert.equal(result.signal,'SIGKILL');
    const network=new AgentNetwork({directory,platform:'linux',createHost:()=>{throw Error('Native host forbidden');}});t.after(()=>network.close());
    const journal=new GraphOperationJournal(directory);
    assert.equal(journal.pending().length,1);
    const method=lane==='relation'?'collaborationOperation':'graphLayoutOperation';
    const receipt=await journal.lookup(method,{operationId:'crash-operation'},(m,p)=>network.call(m,p));
    assert.equal(receipt.state,phase==='after'?'confirmed':'not_found');
    assert.equal(journal.pending().length,phase==='after'?0:1);
    const revision=lane==='relation'?network.network.collaboration.revision:network.layoutStore.get().layoutRevision;
    assert.equal(revision,phase==='after'?1:0);
    assert.equal(network.network.requests.length,0);
    if(phase==='before')await assert.rejects(journal.save(lane==='relation'?'saveCollaboration':'saveGraphLayout',{operationId:'alias'},(m,p)=>network.call(m,p)),{code:'GRAPH_UNCONFIRMED'});
  }
});
