const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { TeamSpace } = require('../electron/team-space.cjs');
async function setup(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-work-'));
  let space, op = 0; const sessions = [];
  const config = { directory, validateNode: nodeId => ({nodeId,machineId:'fixture',adapter:'claude'}), configure: async x => {sessions.push(x);return {command:'fixture'};}, ...options };
  space = new TeamSpace(config); t.after(() => {space.close(); fs.rmSync(directory,{recursive:true,force:true});});
  const call = (name,p={}) => space.call('team.'+name,{operationId:'u-'+ ++op,...p});
  const agents = [];
  for (const role of ['leader','developer','compiler']) agents.push(await call('registerAgent',{kind: options.native && role === 'developer' ? 'native' : 'mcp',nodeId:'fixture-node',externalKey:role,name:role,purpose:role}));
  const [leader,a,b] = agents;
  const team = await call('createTeam',{name:'team',leaderId:leader.agentId,memberIds:agents.map(a=>a.agentId)});
  const run = await call('createRun',{teamId:team.teamId,name:'work',goal:'build and verify',acceptance:'current version verified'});
  for (const agent of agents) await call('connect',{runId:run.runId,agentId:agent.agentId});
  const tool = (agent,name,p={}) => space.tool(sessions.find(x=>x.agentId===agent.agentId).sessionId,'team_'+name,{operationId:'m-'+ ++op,...p});
  const d = await tool(leader,'create_task',{title:'develop',description:'implement',ownerId:a.agentId,kind:'delivery'});
  const v = await tool(leader,'create_task',{title:'compile',description:'verify exact artifact',ownerId:b.agentId,kind:'verification',sourceTaskId:d.workItemId});
  const view = async () => (await call('tasks',{runId:run.runId}));
  const item = async id => (await view()).workItems.find(x=>x.workItemId===id);
  const claim = async (who,id) => tool(who,'claim_task',{workItemId:id,expectedRevision:(await item(id)).revision});
  const report = async (who,id,p) => tool(who,'report_task',{workItemId:id,expectedRevision:(await item(id)).revision,...p});
  const grant = (from,to,maxUses=2,enabled=true,expectedRevision=0) => call('configureHandoff',{runId:run.runId,workItemId:from,toTaskId:to,maxUses,enabled,expectedRevision});
  const accept = async id => tool(leader,'accept_task',{workItemId:id,expectedRevision:(await item(id)).revision,summary:'checked evidence and version'});
  return {directory,call,tool,leader,a,b,run,d,v,view,item,claim,report,grant,accept,get space(){return space;},restart(){space.close();space=new TeamSpace(config);}};
}
async function deliver(f,version='X',handoff=false) {
  await f.claim(f.a,f.d.workItemId);
  return f.report(f.a,f.d.workItemId,{outcome:'submitted',summary:'implemented '+version,version,reference:'artifact://test/'+version,...(handoff?{handoffTaskId:f.v.workItemId,targetRevision:(await f.item(f.v.workItemId)).revision}:{})});
}
test('authorized A-B-A repair preserves failed X, verifies Y, notifies leader and requires independent business acceptance', async t=>{
 const f=await setup(t);await f.grant(f.d.workItemId,f.v.workItemId);await f.grant(f.v.workItemId,f.d.workItemId,1);
 const submitted=await deliver(f,'X',true);assert.equal(submitted.executionStarted,false);
 const x=submitted.report.artifact;
 await f.claim(f.b,f.v.workItemId);
 const repaired=await f.report(f.b,f.v.workItemId,{outcome:'failed',summary:'X fails compilation',artifactId:x.artifactId,handoffTaskId:f.d.workItemId,targetRevision:(await f.item(f.d.workItemId)).revision});
 assert.equal(repaired.executionStarted,false);assert.equal((await f.item(f.d.workItemId)).round,2);
 await deliver(f,'Y',true);const y=(await f.item(f.d.workItemId)).reports.at(-1).artifact;
 await f.claim(f.b,f.v.workItemId);
 await f.report(f.b,f.v.workItemId,{outcome:'passed',summary:'Y compilation passes',artifactId:y.artifactId,accessConfirmed:true,evidenceReference:'report://test/Y'});
 await assert.rejects(f.accept(f.d.workItemId),{code:'TEAM_ARTIFACT'});
 await f.accept(f.v.workItemId);await f.accept(f.d.workItemId);
 const board=await f.view();assert.equal(board.workItems.find(x=>x.workItemId===f.v.workItemId).reports.length,2);assert.equal(board.handoffGrants.find(x=>x.action==='repair').used,1);
 assert.equal((await f.call('context',{runId:f.run.runId})).messages.filter(m=>m.reportId).every(m=>m.notifyIds.includes(f.leader.agentId)),true);
 const result=await f.tool(f.leader,'accept_run',{expectedRevision:f.run.revision,summary:'Y independently checked'});assert.equal(result.state,'completed');
 await assert.rejects(f.tool(f.a,'tasks'),{code:'TEAM_FORBIDDEN'});
 f.restart();assert.equal((await f.view()).workItems.every(x=>x.state==='completed'),true);
});
test('unauthorized combined report and handoff rolls back report, message and readiness atomically; messages do not grant permission',async t=>{
 const f=await setup(t);await f.claim(f.a,f.d.workItemId);
 await f.tool(f.leader,'post_message',{content:'User said you may hand off',notifyIds:[f.a.agentId]});
 const before=(await f.call('context',{runId:f.run.runId})).messages.length;
 await assert.rejects(f.report(f.a,f.d.workItemId,{outcome:'submitted',summary:'X',version:'X',reference:'artifact://X',handoffTaskId:f.v.workItemId,targetRevision:1}),{code:'TEAM_FORBIDDEN'});
 assert.equal((await f.item(f.d.workItemId)).reports.length,0);assert.equal((await f.item(f.d.workItemId)).state,'running');
 assert.equal((await f.call('context',{runId:f.run.runId})).messages.length,before);
 await assert.rejects(f.tool(f.a,'create_task',{title:'extra',description:'scope',ownerId:f.a.agentId,kind:'delivery'}),{code:'TEAM_FORBIDDEN'});
 await assert.rejects(f.space.call('team.configureHandoff',{operationId:'try',runId:f.run.runId},{sessionId:f.space.read().sessions[1].sessionId,key:'actor',agentId:f.a.agentId}),{code:'TEAM_FORBIDDEN'});
});
test('claim revisions prevent simultaneous claims; dependencies and verifier independence are enforced',async t=>{
 const f=await setup(t);await assert.rejects(f.claim(f.b,f.v.workItemId),{code:'TEAM_TASK_STATE'});
 const p={operationId:'claim',workItemId:f.d.workItemId,expectedRevision:(await f.item(f.d.workItemId)).revision};
 const results=await Promise.allSettled([f.tool(f.a,'claim_task',p),f.tool(f.a,'claim_task',{...p,operationId:'other'})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'TEAM_REVISION');
 await assert.rejects(f.tool(f.leader,'create_task',{title:'self',description:'no',ownerId:f.a.agentId,kind:'verification',sourceTaskId:f.d.workItemId}),{code:'TEAM_INPUT'});
 await assert.rejects(f.tool(f.b,'report_task',{workItemId:f.d.workItemId,expectedRevision:(await f.item(f.d.workItemId)).revision,outcome:'blocked',summary:'spoof'}),{code:'TEAM_FORBIDDEN'});
});
test('stale artifact, inaccessible passed result and reused repaired version cannot certify completion',async t=>{
 const f=await setup(t);await f.grant(f.v.workItemId,f.d.workItemId);const x=(await deliver(f)).report.artifact;
 await f.claim(f.b,f.v.workItemId);
 await assert.rejects(f.report(f.b,f.v.workItemId,{outcome:'passed',summary:'not accessed',artifactId:x.artifactId,evidenceReference:'report://x'}),{code:'TEAM_ARTIFACT'});
 await assert.rejects(f.report(f.b,f.v.workItemId,{outcome:'passed',summary:'wrong',artifactId:'foreign',accessConfirmed:true,evidenceReference:'report://x'}),{code:'TEAM_ARTIFACT'});
 await f.report(f.b,f.v.workItemId,{outcome:'blocked',summary:'cannot access artifact',artifactId:x.artifactId,handoffTaskId:f.d.workItemId,targetRevision:(await f.item(f.d.workItemId)).revision});
 await f.claim(f.a,f.d.workItemId);
 await assert.rejects(f.report(f.a,f.d.workItemId,{outcome:'submitted',summary:'alias',version:'X',reference:'artifact://alias'}),{code:'TEAM_ARTIFACT'});
 await f.report(f.a,f.d.workItemId,{outcome:'submitted',summary:'Y',version:'Y',reference:'artifact://Y'});await f.claim(f.b,f.v.workItemId);
 await assert.rejects(f.report(f.b,f.v.workItemId,{outcome:'passed',summary:'old X',artifactId:x.artifactId,accessConfirmed:true,evidenceReference:'report://X'}),{code:'TEAM_ARTIFACT'});
});
test('handoff receipts survive reconnect/restart; revoked grants and spent budgets do not create new repair rounds',async t=>{
 const f=await setup(t);const g=await f.grant(f.v.workItemId,f.d.workItemId,1);
 await deliver(f);await f.claim(f.b,f.v.workItemId);
 const artifact=(await f.item(f.d.workItemId)).reports.at(-1).artifact;
 await f.report(f.b,f.v.workItemId,{outcome:'failed',summary:'failed',artifactId:artifact.artifactId});
 const p={operationId:'repair-once',workItemId:f.v.workItemId,expectedRevision:(await f.item(f.v.workItemId)).revision,toTaskId:f.d.workItemId,targetRevision:(await f.item(f.d.workItemId)).revision};
 const first=await f.tool(f.b,'handoff_task',p);f.restart();assert.deepEqual(await f.tool(f.b,'handoff_task',p),first);
 const receipt=await f.tool(f.b,'operation',{operationId:p.operationId});assert.equal(receipt.state,'confirmed');
 await deliver(f,'Y');await f.claim(f.b,f.v.workItemId);const y=(await f.item(f.d.workItemId)).reports.at(-1).artifact;
 await f.report(f.b,f.v.workItemId,{outcome:'failed',summary:'Y fails',artifactId:y.artifactId});
 await assert.rejects(f.tool(f.b,'handoff_task',{workItemId:f.v.workItemId,expectedRevision:(await f.item(f.v.workItemId)).revision,toTaskId:f.d.workItemId,targetRevision:(await f.item(f.d.workItemId)).revision}),{code:'TEAM_FORBIDDEN'});
 await f.grant(f.v.workItemId,f.d.workItemId,2,false,g.revision+1);
 assert.equal((await f.item(f.d.workItemId)).round,2);
});
test('native task binding preserves unknown occupancy and native success still needs a versioned report',async t=>{
 let nativeRequest,queryStatus='unknown';const f=await setup(t,{native:true,execute:async a=>{nativeRequest=a;return {requestId:a.requestId,taskId:'task',status:queryStatus};},query:async a=>({requestId:a.requestId,taskId:'task',status:queryStatus})});
 const attempt=await f.call('execute',{runId:f.run.runId,agentId:f.a.agentId,workItemId:f.d.workItemId,expectedRevision:(await f.item(f.d.workItemId)).revision,message:'work'});
 assert.equal(attempt.state,'unknown');assert.equal(attempt.workRound,1);
 await assert.rejects(f.report(f.a,f.d.workItemId,{outcome:'submitted',summary:'bypass',version:'X',reference:'artifact://X'}),{code:'TEAM_BUSY'});
 await assert.rejects(f.call('execute',{runId:f.run.runId,agentId:f.a.agentId,message:'alias'}),{code:'TEAM_BUSY'});
 f.restart();await f.call('refresh',{runId:f.run.runId});assert.equal((await f.item(f.d.workItemId)).state,'running');
 queryStatus='succeeded';await f.call('refresh',{runId:f.run.runId});assert.equal((await f.item(f.d.workItemId)).state,'running');
 await assert.rejects(f.accept(f.d.workItemId),{code:'TEAM_TASK_STATE'});
 assert.ok(nativeRequest.requestId);
});
test('repair invalidates every dependent validation and downstream acceptance, retaining all history',async t=>{
 const f=await setup(t);const extra=await f.tool(f.leader,'create_task',{title:'second check',description:'other check',ownerId:f.b.agentId,kind:'verification',sourceTaskId:f.d.workItemId});
 await deliver(f);const x=(await f.item(f.d.workItemId)).reports.at(-1).artifact;
 await f.claim(f.b,extra.workItemId);await f.report(f.b,extra.workItemId,{outcome:'passed',summary:'checked X',artifactId:x.artifactId,accessConfirmed:true,evidenceReference:'report://X'});await f.accept(extra.workItemId);
 await f.claim(f.b,f.v.workItemId);await f.report(f.b,f.v.workItemId,{outcome:'failed',summary:'X fails',artifactId:x.artifactId});
 await f.tool(f.leader,'handoff_task',{workItemId:f.v.workItemId,expectedRevision:(await f.item(f.v.workItemId)).revision,toTaskId:f.d.workItemId,targetRevision:(await f.item(f.d.workItemId)).revision});
 const reset=await f.item(extra.workItemId);assert.equal(reset.state,'waiting');assert.equal(reset.currentReportId,undefined);assert.equal(reset.reports.length,1);
});
test('A database migration preserves prior documents, receipts and original requests, without fabricating new work',async t=>{
 const f=await setup(t);const doc=await f.call('writeDocument',{operationId:'old-doc',runId:f.run.runId,expectedRevision:0,title:'old',content:'A data'});
 const s=f.space.read();s.version=1;delete s.workItems;delete s.handoffGrants;delete s.handoffs;
 f.space.db.prepare('UPDATE state SET body=? WHERE id=1').run(JSON.stringify(s));f.restart();
 assert.equal(f.space.read().version,3);assert.equal((await f.call('operation',{operationId:'old-doc'})).data.documentId,doc.documentId);assert.deepEqual((await f.view()).workItems,[]);
});
test('blocked retries obey five-round budget and paused work denies new scheduling but retains reports',async t=>{
 const f=await setup(t);
 for(let round=1;round<=5;round++) {
  await f.claim(f.a,f.d.workItemId);await f.report(f.a,f.d.workItemId,{outcome:'blocked',summary:'external access unavailable'});
  if(round<5)await f.tool(f.leader,'retry_task',{workItemId:f.d.workItemId,expectedRevision:(await f.item(f.d.workItemId)).revision});
 }
 await assert.rejects(f.tool(f.leader,'retry_task',{workItemId:f.d.workItemId,expectedRevision:(await f.item(f.d.workItemId)).revision}),{code:'TEAM_TASK_STATE'});
 assert.equal((await f.item(f.d.workItemId)).reports.length,5);
 await f.call('pause',{runId:f.run.runId,paused:true});
 await assert.rejects(f.tool(f.leader,'create_task',{title:'new',description:'paused',ownerId:f.a.agentId,kind:'delivery'}),{code:'TEAM_FORBIDDEN'});
});
test('three real independent stdio MCP clients run versioned repair and acceptance through production broker',async t=>{
 const {CollaborationBroker}=require('../electron/collaboration-broker.cjs'),{spawn}=require('node:child_process');
 const f=await setup(t),broker=new CollaborationBroker(path.join(f.directory,'connections'),(scope,name,p)=>f.space.tool(scope.teamSessionId,name,p));
 t.after(()=>broker.close());
 async function client(agent) {
  const session=f.space.read().sessions.find(x=>x.agentId===agent.agentId);
  const config=await broker.configure('work-'+session.sessionId,{nodeId:'external',parentRequestId:session.sessionId,teamSessionId:session.sessionId});
  const child=spawn(process.execPath,config.args,{env:{...process.env,...config.env},stdio:['pipe','pipe','ignore']});t.after(()=>child.kill());
  let seq=0,buffer='';const pending=new Map();
  child.stdout.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const r=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);pending.get(r.id)?.(r);pending.delete(r.id);}});
  return async(name,args={})=>{const id=++seq;const response=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{pending.delete(id);reject(Error('stdio timeout'));},5000);pending.set(id,r=>{clearTimeout(timeout);resolve(r);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',params:{name:'team_'+name,arguments:args}})+'\n');});assert.equal(response.result.isError,undefined,JSON.stringify(response.result));return JSON.parse(response.result.content[0].text);};
 }
 const a=await client(f.a),b=await client(f.b),leader=await client(f.leader);await f.grant(f.d.workItemId,f.v.workItemId);await f.grant(f.v.workItemId,f.d.workItemId);
 let n=0;const claim=async(c,id)=>c('claim_task',{operationId:'stdio-'+ ++n,workItemId:id,expectedRevision:(await f.item(id)).revision});
 for(const version of ['X','Y']) {
  await claim(a,f.d.workItemId);
  const r=await a('report_task',{operationId:'stdio-'+ ++n,workItemId:f.d.workItemId,expectedRevision:(await f.item(f.d.workItemId)).revision,outcome:'submitted',summary:'implement '+version,version,reference:'artifact://'+version,handoffTaskId:f.v.workItemId,targetRevision:(await f.item(f.v.workItemId)).revision});
  await claim(b,f.v.workItemId);
  await b('report_task',{operationId:'stdio-'+ ++n,workItemId:f.v.workItemId,expectedRevision:(await f.item(f.v.workItemId)).revision,outcome:version==='X'?'failed':'passed',summary:'verify '+version,artifactId:r.report.artifact.artifactId,accessConfirmed:true,evidenceReference:'report://'+version,...(version==='X'?{handoffTaskId:f.d.workItemId,targetRevision:(await f.item(f.d.workItemId)).revision}:{})});
 }
 const seen=await leader('tasks');assert.equal(seen.workItems.find(x=>x.workItemId===f.v.workItemId).reports.length,2);
 for(const id of [f.v.workItemId,f.d.workItemId])await leader('accept_task',{operationId:'stdio-'+ ++n,workItemId:id,expectedRevision:(await f.item(id)).revision,summary:'actual report reviewed'});
 assert.equal((await f.item(f.d.workItemId)).state,'completed');
});
test('creating a verification does not rewrite the caller dependency array or break its durable receipt replay',async t=>{
 const f=await setup(t);const p={operationId:'immutable-create',title:'check again',description:'test request immutability',ownerId:f.b.agentId,kind:'verification',sourceTaskId:f.d.workItemId,dependsOn:[]};
 const first=await f.tool(f.leader,'create_task',p);assert.deepEqual(p.dependsOn,[]);f.restart();assert.deepEqual(await f.tool(f.leader,'create_task',p),first);
});

test('current native binding errors prevent task and total acceptance without poisoning older rounds',async t=>{
 const f=await setup(t),submitted=await deliver(f);
 await f.claim(f.b,f.v.workItemId);await f.report(f.b,f.v.workItemId,{outcome:'passed',summary:'checked X',artifactId:submitted.report.artifact.artifactId,accessConfirmed:true,evidenceReference:'report://X'});
 f.space.transaction(s=>{s.attempts.push({attemptId:'bad-current',runId:f.run.runId,agentId:f.b.agentId,workItemId:f.v.workItemId,workRound:1,state:'succeeded',continuationError:'TEAM_SESSION_CHANGED'});return null;});
 await assert.rejects(f.accept(f.v.workItemId),{code:'TEAM_BUSY'});
 f.space.transaction(s=>{s.attempts[0].workRound=0;return null;});
 await f.accept(f.v.workItemId);await f.accept(f.d.workItemId);
 f.space.transaction(s=>{s.attempts.push({attemptId:'bad-leader',runId:f.run.runId,agentId:f.leader.agentId,state:'succeeded',continuationError:'TEAM_SESSION_CHANGED'});return null;});
 const accept=()=>f.call('acceptRun',{runId:f.run.runId,expectedRevision:f.space.read().runs[0].revision,summary:'checked all'});
 await assert.rejects(accept(),{code:'TEAM_TASK_STATE'});assert.equal(f.space.read().runs[0].state,'active');
 f.space.transaction(s=>{s.attempts.push({attemptId:'new-leader',runId:f.run.runId,agentId:f.leader.agentId,state:'succeeded'});return null;});
 assert.equal((await accept()).state,'completed');
});
