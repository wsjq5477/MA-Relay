const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {CodexHost}=require('../electron/codex-host.cjs');
function fixture(t,kind='intact'){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-codex-recovery-')),time='2020-01-01T00:00:00Z';
 const task={taskId:'original-task',conversationId:'original-conversation',requestId:'original-request',targetAgent:'original-agent',status:'unknown',createdAt:time,updatedAt:time,turn:1,lastSeq:1,offset:0,events:[{seq:1,timestamp:time,event:{kind:'accepted'}}]};
 const job=path.join(directory,'runs',task.taskId);
 if(kind!=='missing-run'){
  fs.mkdirSync(job,{recursive:true});fs.writeFileSync(path.join(job,'job.json'),JSON.stringify({executable:process.execPath,workspace:directory,message:'synthetic'}));
  if(kind==='heartbeat')fs.writeFileSync(path.join(job,'heartbeat.json'),JSON.stringify({time,pid:1}));
  if(kind==='null-heartbeat')fs.writeFileSync(path.join(job,'heartbeat.json'),'null');
  if(kind==='events')fs.writeFileSync(path.join(job,'events.jsonl'),'');
  if(kind==='worker-log')fs.writeFileSync(path.join(job,'worker.log'),'');
  if(kind==='native')task.native={sessionId:'original-native'};
  if(kind==='progress'){task.lastSeq=2;task.events.push({seq:2,timestamp:time,event:{kind:'started'}});}
 }
 const state={revision:1,agents:[{agentId:task.targetAgent,adapter:'codex',executable:process.execPath,workspace:directory,enabled:true}],tasks:[task],conversations:[{conversationId:task.conversationId,targetAgent:task.targetAgent,turns:1,lastTaskId:task.taskId}],requests:[{requestId:task.requestId,taskId:task.taskId,fingerprint:'synthetic'}],operations:[]};
 fs.writeFileSync(path.join(directory,'codex-state.json'),JSON.stringify(state));
 const host=new CodexHost({directory,executable:process.execPath});
 t.after(()=>{host.close();fs.rmSync(directory,{recursive:true,force:true});});
 return {directory,host,task,job};
}
test('Codex preparation failures persist a terminal original receipt, free admission and never start a worker',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-codex-prepare-')),host=new CodexHost({directory,executable:process.execPath});
 t.after(()=>{host.close();fs.rmSync(directory,{recursive:true,force:true});});
 const a=await host.call('connect',{workspace:directory});fs.writeFileSync(path.join(directory,'runtime'),'blocked');
 const params={op:'submit',agentId:a.agentId,requestId:'blocked',message:'synthetic'};
 const task=await host.call('ipc',params);
 assert.equal(task.status,'failed');assert.equal(task.error.code,'EEXIST');assert.match(task.error.message,/准备失败/);
 assert.equal(task.events.at(-1).event.kind,'failed');assert.ok(task.finishedAt);
 assert.deepEqual(fs.readdirSync(path.join(directory,'runs',task.taskId)),['job.json']);
 assert.equal((await host.call('snapshot')).agents.items[0].available,true);
 assert.deepEqual(await host.call('ipc',params),task);
 host.close();const reopened=new CodexHost({directory,executable:process.execPath});t.after(()=>reopened.close());
 assert.equal((await reopened.call('ipc',{op:'request',requestId:params.requestId})).status,'failed');
 // Keep the blocked runtime: admission of a different request must work, with
 // the same local preparation failure and zero native CLI/worker launches.
 const next=await reopened.call('ipc',{...params,requestId:'new-request'});
 assert.notEqual(next.taskId,task.taskId);assert.equal(next.status,'failed');
});
test('Codex reconciles an intact original launch that never reached its worker fence, without replay',async t=>{
 const f=fixture(t),files=fs.readdirSync(f.job);
 const result=await f.host.call('ipc',{op:'reconcile',taskId:f.task.taskId,operationId:'original-check'});
 assert.equal(result.operationId,'original-check');assert.equal(result.state,'confirmed');assert.equal(result.data.status,'failed');assert.match(result.data.message,/没有派发/);
 const task=await f.host.call('ipc',{op:'request',requestId:f.task.requestId});
 assert.equal(task.taskId,f.task.taskId);assert.equal(task.status,'failed');assert.equal(task.error.code,'CODEX_START');assert.ok(task.reconciliation);
 assert.equal((await f.host.call('snapshot')).agents.items[0].busy,false);
 assert.deepEqual(fs.readdirSync(f.job),files);assert.equal(fs.existsSync(path.join(f.directory,'runtime')),false);
 f.host.close();const reopened=new CodexHost({directory:f.directory,executable:process.execPath});t.after(()=>reopened.close());
 assert.equal((await reopened.call('ipc',{op:'reconcile',taskId:f.task.taskId})).data.status,'failed');
 assert.equal(reopened.state.tasks.length,1);assert.equal(reopened.state.requests.length,1);
});
test('Codex keeps uncertain executions occupied when evidence is missing or any worker/native activity exists',async t=>{
 for(const kind of ['missing-run','heartbeat','null-heartbeat','events','worker-log','native','progress'])await t.test(kind,async t=>{
  const f=fixture(t,kind),result=await f.host.call('ipc',{op:'reconcile',taskId:f.task.taskId});
  assert.equal(result.state,'unknown');assert.equal(result.data.status,'unknown');assert.match(result.data.message,/保留原请求/);
  const task=await f.host.call('ipc',{op:'task',taskId:f.task.taskId});assert.equal(task.error,undefined);
  assert.equal((await f.host.call('snapshot')).agents.items[0].available,false);assert.equal(fs.existsSync(path.join(f.directory,'runtime')),false);
 });
});
