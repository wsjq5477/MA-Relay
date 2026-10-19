const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {TeamSpace}=require('../electron/team-space.cjs'),{TeamAutomation}=require('../electron/team-automation.cjs');
async function fixture(t,overrides={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-auto-')),calls=[],tasks=new Map(),sessions=[];let space,engine,op=0;
 const options={directory,validateNode:id=>({nodeId:id,machineId:'controlled',adapter:id==='unsupported'?'codex':'claude'}),configure:async x=>{sessions.push(x);return {command:'fixture'};},execute:async a=>{calls.push(a);const task={requestId:a.requestId,taskId:'task-'+calls.length,conversationId:a.resumeConversationId||'conversation-'+a.agentId,status:'running',native:{sessionId:'native-'+a.agentId}};tasks.set(a.requestId,task);return task;},query:async a=>{if(!tasks.has(a.requestId))throw Error('offline');return tasks.get(a.requestId);},conversation:async()=>({canContinue:true}),...overrides};
 space=new TeamSpace(options);engine=new TeamAutomation(space);t.after(()=>{engine.close();space.close();fs.rmSync(directory,{recursive:true,force:true});});
 const call=(name,p={})=>space.call('team.'+name,{operationId:'u-'+ ++op,...p});
 const leader=await call('registerAgent',{kind:'native',nodeId:'leader',name:'leader',purpose:'coordinate'}),worker=await call('registerAgent',{kind:'native',nodeId:'worker',name:'worker',purpose:'deliver'}),external=await call('registerAgent',{kind:'mcp',externalKey:'external',name:'external',purpose:'compile'});
 const team=await call('createTeam',{name:'team',leaderId:leader.agentId,memberIds:[leader.agentId,worker.agentId,external.agentId]});
 const run=await call('createRun',{teamId:team.teamId,name:'work',goal:'deliver and verify',acceptance:'exact version evidence'});
 const enable=async (p={})=>call('configureAutomation',{runId:run.runId,expectedRevision:space.run(space.read(),run.runId).revision,enabled:true,agentIds:[leader.agentId,worker.agentId],maxActivations:10,maxMinutes:60,idleMinutes:10,...p});
 const connect=async who=>{await call('connect',{runId:run.runId,agentId:who.agentId});return sessions.at(-1).sessionId;};
 const tool=(session,name,p={})=>space.tool(session,'team_'+name,{operationId:'m-'+ ++op,...p});
 const complete=()=>{for(const task of tasks.values())task.status='succeeded';};
 return {directory,options,calls,tasks,leader,worker,external,run,call,enable,connect,tool,complete,get space(){return space;},get engine(){return engine;},restart(){engine.close();space.close();space=new TeamSpace(options);engine=new TeamAutomation(space);}};
}
test('explicit policy starts once; polling, ordinary @ and acknowledgments never cause self wake; fresh scope resumes original conversation',async t=>{
 const f=await fixture(t);await f.enable();await f.engine.tick();assert.equal(f.calls.length,1);f.complete();await f.engine.tick();await f.engine.tick();assert.equal(f.calls.length,1);
 await f.call('postMessage',{runId:f.run.runId,content:'@leader',notifyIds:[f.leader.agentId]});await f.engine.tick();assert.equal(f.calls.length,1);
 const session=await f.connect(f.external);await f.tool(session,'request_attention',{operationId:'attention',reason:'actual blocker'});await f.tool(session,'request_attention',{operationId:'attention',reason:'actual blocker'});
 await Promise.all([f.engine.tick(),f.engine.tick()]);assert.equal(f.calls.length,2);assert.equal(f.calls[1].resumeConversationId,f.calls[0].resumeConversationId||'conversation-'+f.leader.agentId);assert.notEqual(f.calls[0].sessionId,f.calls[1].sessionId);
 await assert.rejects(f.space.tool(f.calls[0].sessionId,'team_context'),{code:'TEAM_FORBIDDEN'});
 assert.equal(f.space.publicAttempt(f.space.read().attempts[0]).nativeSessionId,undefined);
});
test('lost ACK and offline restart only query original request and retain event, budget and occupancy',async t=>{
 let sent=0;const f=await fixture(t,{execute:async()=>{sent++;throw Error('ACK lost');},query:async()=>{throw Error('missing original');}});
 await f.enable();await f.engine.tick();assert.equal(f.space.read().attempts[0].state,'unknown');f.restart();await f.engine.tick();await f.engine.tick();assert.equal(sent,1);assert.equal(f.space.read().runs[0].automation.used,1);
 assert.equal(f.space.read().activationEvents.find(e=>e.kind==='user_start').state,'consumed');
});
test('worker readiness binds exact task and round; business report waits for real native terminal before waking leader',async t=>{
 const f=await fixture(t);const d=await f.call('createTask',{runId:f.run.runId,title:'deliver',description:'exact version',ownerId:f.worker.agentId,kind:'delivery'});await f.enable();await f.engine.tick();assert.equal(f.calls.length,2);const a=f.calls.find(x=>x.agentId===f.worker.agentId);assert.equal(a.workItemId,d.workItemId);assert.equal(a.workRound,1);
 const item=f.space.read().workItems[0];await f.space.tool(a.sessionId,'team_report_task',{operationId:'report',workItemId:item.workItemId,expectedRevision:item.revision,outcome:'submitted',version:'X',reference:'artifact://X',summary:'ready for verification'});
 f.tasks.get(f.calls.find(x=>x.agentId===f.leader.agentId).requestId).status='succeeded';await f.engine.tick();assert.equal(f.calls.length,2);
 f.tasks.get(a.requestId).status='succeeded';await f.engine.tick();assert.equal(f.calls.length,3);assert.equal(f.calls.at(-1).agentId,f.leader.agentId);
});
test('pause and revoked admission block new dispatch; cumulative budget cannot be reset by disabling or reconfiguring',async t=>{
 const f=await fixture(t);await f.enable({maxActivations:1});await f.call('pause',{runId:f.run.runId,paused:true});await f.engine.tick();assert.equal(f.calls.length,0);
 await f.call('pause',{runId:f.run.runId,paused:false});await f.engine.tick();f.complete();await f.call('wake',{runId:f.run.runId,reason:'new event'});await f.engine.tick();assert.equal(f.calls.length,1);
 await f.enable({maxActivations:1});await f.engine.tick();assert.equal(f.calls.length,1);assert.equal(f.space.read().runs[0].automation.used,1);
 const scope={teamSessionId:f.calls[0].sessionId,parentRequestId:f.calls[0].requestId};await f.call('configureAutomation',{runId:f.run.runId,expectedRevision:f.space.read().runs[0].revision,enabled:false});
 assert.throws(()=>f.space.admit(scope,'leader'),{executionNotDispatched:true});
});
test('unsupported, unbound and changed-session continuations never fall back to a new conversation',async t=>{
 const f=await fixture(t);await f.enable();await f.engine.tick();f.complete();await f.engine.tick();await f.call('wake',{runId:f.run.runId,reason:'continue'});
 f.options.conversation=async()=>({canContinue:false});await f.engine.tick();assert.equal(f.calls.length,1);
 f.options.conversation=async()=>({canContinue:true});await f.engine.tick();assert.equal(f.calls.length,2);assert.equal(f.space.read().runs[0].automation.issues?.[f.leader.agentId],undefined);
 f.tasks.get(f.calls[1].requestId).native.sessionId='wrong-session';f.complete();await f.engine.tick();assert.equal(f.space.read().attempts[1].continuationError,'TEAM_SESSION_CHANGED');
 await f.call('wake',{runId:f.run.runId,reason:'after mismatch'});await f.engine.tick();assert.equal(f.calls.length,2);
 const unsupported=await f.call('registerAgent',{kind:'native',nodeId:'unsupported',name:'codex',purpose:'unverified'});
 await assert.rejects(f.enable({agentIds:[f.leader.agentId,unsupported.agentId]}),{code:'TEAM_CAPABILITY'});
});
test('deferred native leader acceptance is not success until original terminal, and task revision races invalidate it',async t=>{
 const f=await fixture(t);await f.enable();await f.engine.tick();const a=f.calls[0];
 f.space.transaction(s=>{s.workItems.push({workItemId:'accepted',runId:f.run.runId,title:'test',kind:'delivery',ownerId:f.worker.agentId,state:'completed',revision:1,round:1,reports:[],dependsOn:[]});return null;});
 const accept=()=>f.space.tool(a.sessionId,'team_accept_run',{operationId:'finish',expectedRevision:f.space.read().runs[0].revision,summary:'all evidence checked'});
 assert.equal((await accept()).state,'awaiting_leader_terminal');assert.equal(f.space.read().runs[0].state,'active');f.complete();await f.engine.tick();assert.equal(f.space.read().runs[0].state,'completed');
});
test('v2 migration preserves work items and receipts; a crash before dispatch is retained without replay',async t=>{
 const f=await fixture(t);const old=f.space.read();old.version=2;delete old.activationEvents;f.space.db.prepare('UPDATE state SET body=? WHERE id=1').run(JSON.stringify(old));f.restart();assert.equal(f.space.read().version,3);
 await f.enable();await f.engine.tick();f.space.transaction(s=>{s.attempts[0].state='dispatching';s.attempts[0].dispatched=false;return null;});f.tasks.clear();f.restart();await f.engine.tick();assert.equal(f.calls.length,1);assert.equal(f.space.read().attempts[0].state,'dispatching');
});
test('pause during async original-conversation check prevents even a new task intent; native leader cannot self wake',async t=>{
 const f=await fixture(t);await f.enable();await f.engine.tick();await assert.rejects(f.space.tool(f.calls[0].sessionId,'team_request_attention',{operationId:'self',reason:'again'}),{code:'TEAM_FORBIDDEN'});f.complete();await f.engine.tick();await f.call('wake',{runId:f.run.runId,reason:'new evidence'});
 let release,entered;const gate=new Promise(r=>release=r),ready=new Promise(r=>entered=r);f.options.conversation=async()=>{entered();await gate;return {canContinue:true};};const tick=f.engine.tick();await ready;await f.call('pause',{runId:f.run.runId,paused:true});release();await tick;assert.equal(f.calls.length,1);assert.equal(f.space.read().attempts.length,1);
});
test('deferred acceptance is invalidated by newer task revision; no-progress checks enqueue once and elapsed budget stops new work',async t=>{
 const f=await fixture(t);await f.enable();await f.engine.tick();const a=f.calls[0];
 f.space.transaction(s=>{s.workItems.push({workItemId:'race',runId:f.run.runId,title:'test',kind:'delivery',ownerId:f.worker.agentId,state:'completed',revision:1,round:1,reports:[],dependsOn:[]});return null;});
 await f.space.tool(a.sessionId,'team_accept_run',{operationId:'accept-race',expectedRevision:f.space.read().runs[0].revision,summary:'checked'});f.space.transaction(s=>{s.workItems[0].revision++;return null;});f.complete();await f.engine.tick();assert.equal(f.space.read().runs[0].state,'active');assert.equal(f.space.read().runs[0].acceptancePending,undefined);
 f.space.transaction(s=>{s.runs[0].automation.startedAt=new Date(Date.now()-11*60000).toISOString();return null;});await f.engine.tick();assert.equal(f.calls.length,2);f.complete();await f.engine.tick();await f.engine.tick();assert.equal(f.calls.length,2);
 f.space.transaction(s=>{s.runs[0].automation.startedAt=new Date(Date.now()-61*60000).toISOString();return null;});await f.call('wake',{runId:f.run.runId,reason:'after deadline'});await f.engine.tick();assert.equal(f.calls.length,2);
});
test('atomic failure plus immediate repair still emits a leader event; external claim settles its readiness event',async t=>{
 const f=await fixture(t);const d=await f.call('createTask',{runId:f.run.runId,title:'external delivery',description:'deliver X',kind:'delivery',ownerId:f.external.agentId}),v=await f.call('createTask',{runId:f.run.runId,title:'verify',description:'verify X',kind:'verification',ownerId:f.worker.agentId,sourceTaskId:d.workItemId});
 await f.enable({agentIds:[f.leader.agentId]});await f.engine.tick();f.complete();await f.engine.tick();
 const item=id=>f.space.read().workItems.find(x=>x.workItemId===id);
 await f.call('claimTask',{runId:f.run.runId,workItemId:d.workItemId,expectedRevision:item(d.workItemId).revision});
 assert.equal(f.space.read().activationEvents.find(e=>e.workItemId===d.workItemId&&e.kind==='task_ready').state,'handled');
 const delivered=await f.call('reportTask',{runId:f.run.runId,workItemId:d.workItemId,expectedRevision:item(d.workItemId).revision,outcome:'submitted',version:'X',reference:'artifact://X',summary:'ready'});
 await f.call('claimTask',{runId:f.run.runId,workItemId:v.workItemId,expectedRevision:item(v.workItemId).revision});
 const failed=await f.call('reportTask',{runId:f.run.runId,workItemId:v.workItemId,expectedRevision:item(v.workItemId).revision,outcome:'failed',artifactId:delivered.report.artifact.artifactId,summary:'X fails',handoffTaskId:d.workItemId,targetRevision:item(d.workItemId).revision});
 assert.equal(item(v.workItemId).currentReportId,undefined);assert(f.space.read().activationEvents.some(e=>e.agentId===f.leader.agentId&&e.reportId===failed.report.reportId&&e.state==='pending'));
});
test('new explicit attention after a native acceptance proposal prevents premature completion and remains queued',async t=>{
 const f=await fixture(t);await f.enable();await f.engine.tick();const a=f.calls[0];
 f.space.transaction(s=>{s.workItems.push({workItemId:'final',runId:f.run.runId,title:'test',kind:'delivery',ownerId:f.worker.agentId,state:'completed',revision:1,round:1,reports:[],dependsOn:[]});return null;});
 await f.space.tool(a.sessionId,'team_accept_run',{operationId:'propose',expectedRevision:f.space.read().runs[0].revision,summary:'complete'});await f.call('wake',{runId:f.run.runId,reason:'new user decision required'});f.complete();await f.engine.tick();assert.equal(f.space.read().runs[0].state,'active');assert.equal(f.calls.length,2);
});

test('native permission waiting is visible and deduplicated across restart without approval or a new activation',async t=>{
 const f=await fixture(t);await f.enable();await f.engine.tick();const original=f.calls[0],task=f.tasks.get(original.requestId);
 task.waiting={kind:'permission',requestIds:['private-permission'],summary:'sensitive command must not enter public space'};
 await f.engine.tick();let context=f.space.view(f.space.read(),f.run.runId);
 assert.deepEqual(context.attempts[0].waiting,{kind:'permission',requestCount:1});
 const notices=()=>f.space.read().messages.filter(m=>m.content.includes('需要用户处理原生'));
 assert.equal(notices().length,1);assert(!JSON.stringify(context).includes('private-permission'));assert(!JSON.stringify(context).includes('sensitive command'));
 f.restart();await f.engine.tick();assert.equal(notices().length,1);assert.equal(f.calls.length,1);
 task.status='unknown';delete task.waiting;await f.engine.tick();assert.equal(f.space.read().attempts[0].waiting.kind,'permission');assert.equal(f.calls.length,1);
 task.status='running';await f.engine.tick();assert.equal(f.space.read().attempts[0].waiting,undefined);
 task.waiting={kind:'input',requestIds:['private-form-a','private-form-b']};await f.engine.tick();assert.equal(notices().length,2);assert.equal(f.space.read().attempts[0].waiting.requestCount,2);
 f.complete();await f.engine.tick();assert.equal(f.space.read().attempts[0].waiting,undefined);assert.equal(f.calls.length,1);
});

test('incomplete native task identities cannot settle an activation and recover only from its original full task',async t=>{
 for(const missing of [{taskId:undefined},{conversationId:undefined},{taskId:''},{conversationId:23},{taskId:'   '}])await t.test(JSON.stringify(missing),async t=>{
  let accepted,complete=false,executions=0;
  const response=()=>({requestId:accepted.requestId,taskId:'original-task',conversationId:'original-conversation',status:'succeeded',native:{sessionId:'original-session'},...(!complete?missing:{})});
  const f=await fixture(t,{execute:async a=>{executions++;accepted=a;return response();},query:async()=>response()});
  await f.enable();await f.engine.tick();assert.equal(f.space.read().attempts[0].state,'unknown');assert.equal(f.space.read().sessions.find(s=>s.sessionId===accepted.sessionId).revoked,undefined);
  await f.call('wake',{runId:f.run.runId,reason:'must not bypass incomplete original'});await f.engine.tick();assert.equal(f.space.read().attempts.length,1);
  complete=true;await f.space.refresh(f.run.runId);const original=f.space.read().attempts[0];assert.equal(original.state,'succeeded');assert.equal(original.requestId,accepted.requestId);assert.equal(original.taskId,'original-task');assert.equal(f.space.read().attempts.length,1);assert.equal(executions,1);
 });
});

test('first continuation response must match the intended original Conversation even with the same native Session',async t=>{
 for(const status of ['running','succeeded'])await t.test(status,async t=>{
  const f=await fixture(t),execute=f.options.execute;
  f.options.execute=async a=>{const task=await execute(a);if(a.resumeConversationId){task.conversationId='foreign-conversation';task.status=status;}return task;};
  await f.enable();await f.engine.tick();f.complete();await f.engine.tick();const original=f.space.read().attempts[0];
  await f.call('wake',{runId:f.run.runId,reason:'continue original context'});await f.engine.tick();
  let resumed=f.space.read().attempts[1];assert.equal(resumed.state,'unknown');assert.equal(resumed.conversationId,undefined);assert.equal(resumed.resumeConversationId,original.conversationId);
  await f.engine.tick();assert.equal(f.calls.length,2);assert.equal(f.space.read().attempts[1].state,'unknown');
  const response=f.tasks.get(resumed.requestId);response.conversationId=original.conversationId;response.status='succeeded';await f.space.refresh(f.run.runId);
  resumed=f.space.read().attempts[1];assert.equal(resumed.state,'succeeded');assert.equal(resumed.conversationId,original.conversationId);assert.equal(f.calls.length,2);
 });
});

test('blank native Session observations never enable continuation or erase an established binding',async t=>{
 await t.test('whitespace is not a native Session binding',async t=>{
  const f=await fixture(t),execute=f.options.execute;
  f.options.execute=async a=>{const task=await execute(a);task.native.sessionId='   ';return task;};
  await f.enable();await f.engine.tick();assert.equal(f.space.publicAttempt(f.space.read().attempts[0]).nativeSessionBound,false);
  f.complete();await f.engine.tick();await f.call('wake',{runId:f.run.runId,reason:'must not resume blank binding'});await f.engine.tick();assert.equal(f.calls.length,1);assert.equal(f.space.read().attempts.length,1);
 });
 await t.test('missing native binding evidence cannot clear an earlier valid Session',async t=>{
  const f=await fixture(t);await f.enable();await f.engine.tick();const original=f.space.read().attempts[0],task=f.tasks.get(original.requestId),sessionId=task.native.sessionId;
  for(const empty of ['', '   ']){task.native.sessionId=empty;await f.engine.tick();const a=f.space.read().attempts[0];assert.equal(a.nativeSessionId,sessionId);assert.equal(a.continuationError,undefined);}
  task.native.sessionId=sessionId;f.complete();await f.engine.tick();await f.call('wake',{runId:f.run.runId,reason:'valid original continuation'});await f.engine.tick();assert.equal(f.calls.length,2);assert.equal(f.calls[1].resumeConversationId,original.conversationId);
 });
});

test('binding errors observed after a leader acceptance proposal prevent deferred completion',async t=>{
 const f=await fixture(t);await f.enable();await f.engine.tick();const a=f.calls[0];
 f.space.transaction(s=>{s.workItems.push({workItemId:'final-binding',runId:f.run.runId,title:'done',kind:'delivery',ownerId:f.worker.agentId,state:'completed',revision:1,round:1,reports:[],dependsOn:[]});return null;});
 await f.space.tool(a.sessionId,'team_accept_run',{operationId:'propose-binding',expectedRevision:f.space.read().runs[0].revision,summary:'all checked'});
 f.space.transaction(s=>{s.attempts.push({attemptId:'late-worker-binding',runId:f.run.runId,agentId:f.worker.agentId,workItemId:'final-binding',workRound:1,state:'succeeded',continuationError:'TEAM_SESSION_CHANGED'});return null;});
 f.complete();await f.space.refresh(f.run.runId);assert.equal(f.space.read().runs[0].state,'active');assert.equal(f.space.read().runs[0].acceptancePending,undefined);
});
