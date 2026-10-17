const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {MachineHost}=require('../electron/machine-host.cjs');
const {recoverJournal}=require('../electron/pending-journal.cjs');
const failure=code=>Object.assign(Error(code),{code});
function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-context-routing-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 // A failed connect persists a context before assigning its agentId. Reopen
 // this exact catalogue to exercise the same state after a backend restart.
 fs.writeFileSync(path.join(directory,'node-contexts.json'),JSON.stringify([
  {contextId:'unfinished',adapter:'opencode',nodeId:'broken-node'},
  {contextId:'healthy',adapter:'opencode',nodeId:'healthy-node',agentId:'healthy-agent'}
 ]));
 const calls=[];
 const task={taskId:'original-task',conversationId:'original-conversation',requestId:'original-request',targetAgent:'healthy-agent',status:'running'};
 const host=new MachineHost({directory,legacy:{close(){},async call(method,p){
  calls.push({backend:'legacy',method,op:p?.op});
  if(method==='snapshot')return {agents:{items:[]},tasks:[],conversations:[]};
  throw failure('NOT_FOUND');
 }},openCode:contextDirectory=>({close(){},async call(method,p){
  const backend=path.basename(contextDirectory);calls.push({backend,method,op:p?.op});
  if(backend==='unfinished')throw failure('NOT_CONFIGURED');
  if(method==='snapshot')return {agents:{items:[{agentId:'healthy-agent'}]},tasks:[task],conversations:[{conversationId:task.conversationId,targetAgent:task.targetAgent}]};
  if(method==='ipc'&&p.op==='request'&&p.requestId===task.requestId)return task;
  if(method==='ipc'&&p.op==='task'&&p.taskId===task.taskId)return task;
  throw failure('NOT_FOUND');
 }})});
 t.after(()=>host.close());return {host,calls,task};
}
test('reopened incomplete context cannot hide an original request receipt during read-only recovery',async t=>{
 const {host,calls,task}=fixture(t),settled=[];
 const result=await recoverJournal([{id:task.requestId,machineId:'windows',op:'submit',state:'unknown'}],
  (method,p)=>host.call(method,p),async(...args)=>{settled.push(args);return true;});
 assert.equal(result.resolved,1);assert.equal(settled[0][1],'confirmed');assert.deepEqual(settled[0][2],task);
 assert.deepEqual(calls.map(c=>[c.backend,c.op]),[['legacy','request'],['healthy','request']]);
});
test('missing original receipt stays unknown without querying an unfinished context or dispatching a prompt',async t=>{
 const {host,calls}=fixture(t);
 const result=await recoverJournal([{id:'missing',machineId:'windows',op:'submit',state:'unknown'}],
  (method,p)=>host.call(method,p),()=>{throw Error('must remain unknown');});
 assert.equal(result.resolved,0);assert.equal(result.items[0].code,'NOT_FOUND');
 assert(calls.every(c=>c.op==='request'&&c.backend!=='unfinished'));
});
test('unbound task and control lookups never select a context through two absent identities',async t=>{
 const {host,calls}=fixture(t);
 for(const p of [{op:'task',taskId:'missing'},{op:'conversation',conversationId:'missing'},
  {op:'operation',taskId:'missing',operationId:'original-control'},
  {op:'cancel',taskId:'missing',operationId:'original-control'},
  {op:'reply',taskId:'missing',operationId:'original-control'}]){
  await assert.rejects(host.call('ipc',p),{code:'NOT_FOUND'});
 }
 assert(calls.every(c=>c.backend!=='unfinished'));
});
test('an explicit agent and a bound original task still route to their owning context',async t=>{
 const {host,calls,task}=fixture(t);
 assert.deepEqual(await host.call('ipc',{op:'request',agentId:'healthy-agent',requestId:task.requestId}),task);
 assert.deepEqual(calls.map(c=>[c.backend,c.op]),[['healthy','request']]);calls.length=0;
 assert.deepEqual(await host.call('ipc',{op:'task',taskId:task.taskId}),task);
 assert.equal(calls.at(-1).backend,'healthy');assert(calls.every(c=>c.backend!=='unfinished'));
});
