const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createHash}=require('node:crypto');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {SshHost}=require('../electron/ssh-host.cjs');
const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
const {digest}=require('../electron/graph-layout.cjs');
const failure=code=>Object.assign(Error(code),{code});
function fixture(t,variant='valid',op='submit'){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-daemon-reject-'));
 const machineId='ssh-daemon-test',nodeId='node-test',requestId='original-request';
 const connection={stage:'online',machineId,daemonId:'daemon-test',identity:{machineId,daemonId:'daemon-test',profileId:'profile-test',protocolVersion:2}};
 const wire={op,...(op==='continue'?{conversationId:'parent-conversation'}:{agentId:'agent-test'}),requestId,message:'controlled original'};
 const ledger={key:requestId,method:'ipc',op,state:'rejected',target:op==='continue'?{conversationId:wire.conversationId}:{agentId:wire.agentId},fingerprint:digest({method:'ipc',params:wire}),error:{code:'NOT_CONFIGURED',message:'untrusted remote message'}};
 const calls=[],host=new SshHost({options:{coordinatorId:'coordinator-test'},dropTransport(){}},connection);
 host.request=async(method,p)=>{calls.push({method,p});if(method==='daemon.receiptRead'){if(variant==='missing')throw failure('NOT_FOUND');return structuredClone(ledger);}throw failure('NOT_CONFIGURED');};
 const network=new AgentNetwork({directory,platform:'win32',distributions:async()=>[],createHost:()=>host});
 network.catalog.machines.push({machineId,kind:'ssh',daemonId:'daemon-test',profileId:'profile-test',online:true});network.save();
 network.network.nodes.push({nodeId,machineId,adapter:'opencode',connected:true,executionSupported:true});
 const params={op,machineId,nodeId,requestId,message:wire.message,...(op==='continue'?{conversationId:machineId+'::'+wire.conversationId}:{})};
 const fingerprint=createHash('sha256').update(JSON.stringify({nodeId,op,message:wire.message,workspace:'',conversationId:params.conversationId||'',collaboration:false})).digest('hex');
 const original={requestId,machineId,nodeId,agentId:machineId+'::agent-test',dispatched:true,fingerprint,inputFingerprint:fingerprint,createdAt:'2026-10-17T00:00:00.000Z'};
 network.network.requests.push(original);network.saveNetwork();
 const row={id:requestId,op,machineId,params,time:original.createdAt,state:'unknown',result:{error:{code:'DESKTOP_TRANSPORT',message:'lost original response'}}};
 fs.writeFileSync(path.join(directory,'pending.json'),JSON.stringify([row]));
 const service=createCoordinatorService({directory,network});
 t.after(()=>{service.close();fs.rmSync(directory,{recursive:true,force:true});});
 return {directory,connection,ledger,calls,host,network,params,original,row,service};
}
test('durable SSH rejection recovers the original dispatched intent, persists it and never resends',async t=>{
 const f=fixture(t),before=structuredClone(f.row);
 assert.equal((await f.service.recoverPending()).resolved,1);
 assert.equal(f.original.dispatched,false);assert.equal(f.original.preparationRejection,'NOT_CONFIGURED');
 const saved=JSON.parse(fs.readFileSync(path.join(f.directory,'pending.json')))[0];
 assert.equal(saved.state,'rejected');assert.equal(saved.time,before.time);assert.deepEqual(saved.params,before.params);assert.equal(saved.result.error.code,'NOT_CONFIGURED');
 assert.equal(f.service.pending().length,0);assert(f.network.undispatchedRejection(before));
 const retry=await f.service.call({method:'nodeRequest',params:f.params});assert.equal(retry.ok,false);assert.equal(retry.error.code,'NOT_CONFIGURED');
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory,'pending.json')))[0].time,before.time);
 const conflict=await f.service.call({method:'nodeRequest',params:{...f.params,message:'different'}});assert.equal(conflict.error.code,'REQUEST_CONFLICT');
 assert.equal(f.calls.filter(c=>c.method==='ipc'&&c.p.op!=='request').length,0);
 assert.equal(f.calls.filter(c=>c.method==='context').length,0);
 const reopened=new AgentNetwork({directory:f.directory,platform:'win32',distributions:async()=>[],createHost:()=>f.host});t.after(()=>reopened.close());
 assert(reopened.undispatchedRejection(before));
});
test('ordinary original-request query and same-ID retry settle a durable rejection without a fake task',async t=>{
 for(const method of ['ipc','nodeRequest'])await t.test(method,async t=>{
  const f=fixture(t),params=method==='ipc'?{op:'request',requestId:f.params.requestId,machineId:f.params.machineId}:f.params;
  const result=await f.service.call({method,params});
  assert.equal(method==='ipc'?result.result?.state:result.ok,method==='ipc'?'rejected':false);
  assert.equal(result.result?.taskId,undefined);assert.equal(f.service.pending().length,0);assert.equal(f.original.dispatched,false);
  const row=JSON.parse(fs.readFileSync(path.join(f.directory,'pending.json')))[0];assert.equal(row.time,f.row.time);assert.deepEqual(row.params,f.row.params);
 });
});
test('unproven, mismatched or ambiguous daemon records never release the original occupancy',async t=>{
 for(const variant of ['missing','wrong-id','wrong-machine','wrong-profile','wrong-op','wrong-method','wrong-target','wrong-fingerprint','unknown','dispatched','confirmed','task-bound','result-bound','local-bound','input-changed','missing-input','inflight','generation','bare','forged'])await t.test(variant,async t=>{
  const f=fixture(t,variant);
  if(variant==='wrong-id')f.ledger.key='different';
  if(variant==='wrong-machine')f.connection.identity.daemonId='different';
  if(variant==='wrong-profile')f.network.machine(f.params.machineId).profileId='different';
  if(variant==='wrong-op')f.ledger.op='continue';
  if(variant==='wrong-method')f.ledger.method='context';
  if(variant==='wrong-target')f.ledger.target.agentId='different';
  if(variant==='wrong-fingerprint')f.ledger.fingerprint='0'.repeat(64);
  if(['unknown','dispatched','confirmed'].includes(variant))f.ledger.state=variant;
  if(variant==='task-bound')f.ledger.target.taskId='task';
  if(variant==='result-bound')f.ledger.result={taskId:'task'};
  if(variant==='local-bound')f.original.taskId='task';
  if(variant==='input-changed')f.original.inputFingerprint='changed';
  if(variant==='missing-input')delete f.original.inputFingerprint;
  if(variant==='inflight')f.network.nodeJobs.set(f.params.nodeId,Promise.resolve());
  if(variant==='bare')f.host.call=async()=>{throw failure('NOT_CONFIGURED');};
  if(variant==='generation'){const request=f.host.request;f.host.request=async(m,p)=>{const result=await request(m,p);if(m==='daemon.receiptRead')f.host.generation++;return result;};}
  if(variant==='forged')f.host.call=async()=>{throw Object.assign(failure('DAEMON_REQUEST_REJECTED'),{receipt:{...f.ledger,source:'daemon.receiptRead'}});};
  const result=await f.service.recoverPending();assert.equal(result.resolved,0);assert.equal(result.remaining,1);assert.equal(f.original.dispatched,true);assert.equal(f.service.pending().length,1);
 });
});
test('rejected continuation binds the original parent and never requires a new task or context',async t=>{
 const f=fixture(t,'valid','continue');assert.equal((await f.service.recoverPending()).resolved,1);assert.equal(f.original.dispatched,false);
 assert.equal(f.calls.filter(c=>c.method!=='daemon.receiptRead'&&c.p.op!=='request').length,0);
});
test('network proof persistence failure keeps both journals unknown',async t=>{
 const f=fixture(t),save=f.network.saveNetwork;f.network.saveNetwork=()=>{throw failure('NETWORK_PERSIST');};
 assert.equal((await f.service.recoverPending()).resolved,0);assert.equal(f.original.dispatched,true);assert.equal(f.service.pending().length,1);f.network.saveNetwork=save;
});
module.exports={fixture};
