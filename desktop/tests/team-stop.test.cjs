const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TeamSpace } = require('../electron/team-space.cjs');
const { TeamAutomation } = require('../electron/team-automation.cjs');

async function fixture(t, overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-team-stop-'));
  const tasks = new Map(), cancellations = [], receipts = new Map(), calls = [], sessions = [];
  const options = {
    directory, validateNode: nodeId => ({ nodeId, machineId: 'original-machine', adapter: 'claude' }),
    configure: async session => { sessions.push(session); return {command:'fixture'}; },
    execute: async a => {
      calls.push(a);
      const task = {requestId:a.requestId, taskId:'task-'+calls.length, conversationId:'conversation-'+calls.length, status:'running'};
      tasks.set(a.requestId, task); return task;
    },
    query: async a => { const task = tasks.get(a.requestId); if (!task) throw Object.assign(Error('missing'), {code:'NOT_FOUND'}); return task; },
    cancel: async a => {
      cancellations.push(structuredClone(a));
      const result = {operationId:a.cancellation.operationId, state:'confirmed'};
      receipts.set(result.operationId, result); return result;
    },
    cancellation: async a => receipts.get(a.cancellation.operationId) || {operationId:a.cancellation.operationId, state:'not_found'},
    ...overrides
  };
  let space = new TeamSpace(options), engine = new TeamAutomation(space), op = 0;
  t.after(() => {engine.close(); space.close(); fs.rmSync(directory, {recursive:true, force:true});});
  const call = (method, p = {}) => space.call('team.'+method, {operationId:'user-'+ ++op, ...p});
  const leader = await call('registerAgent', {kind:'native', nodeId:'leader', name:'leader', purpose:'coordinate'});
  const worker = await call('registerAgent', {kind:'native', nodeId:'worker', name:'worker', purpose:'deliver'});
  const external = await call('registerAgent', {kind:'mcp', externalKey:'external', name:'external', purpose:'external work'});
  const team = await call('createTeam', {name:'team', leaderId:leader.agentId, memberIds:[leader.agentId,worker.agentId,external.agentId]});
  const run = await call('createRun', {teamId:team.teamId,name:'work',goal:'deliver',acceptance:'real evidence'});
  const start = who => call('execute',{runId:run.runId, agentId:who.agentId,message:'original work'});
  const stop = p => call('stopRun',{runId:run.runId,expectedRevision:space.read().runs[0].revision,...p});
  return {directory, options, tasks, cancellations, receipts, calls, sessions, call, start, stop, leader, worker, external, run,
    get space(){return space;}, get engine(){return engine;},
    restart(){engine.close();space.close();space=new TeamSpace(options);engine=new TeamAutomation(space);}
  };
}

test('stop revokes access and new scheduling, cancels each original once, and waits for real terminals rather than confirmed receipts', async t => {
  const f = await fixture(t); await f.start(f.leader); await f.start(f.worker);
  await f.call('connect',{runId:f.run.runId,agentId:f.external.agentId}); const externalSession=f.sessions.at(-1).sessionId;
  const result=await f.stop({operationId:'stop-original'});
  assert.equal(result.state,'stopping'); assert.equal(f.cancellations.length,2);
  assert.equal(f.space.read().runs[0].paused,true);
  assert(f.space.read().sessions.every(s=>s.revoked));
  await assert.rejects(f.space.tool(externalSession,'team_context'),{code:'TEAM_FORBIDDEN'});
  await assert.rejects(f.start(f.worker),{code:'TEAM_FORBIDDEN'});
  await assert.rejects(f.call('pause',{runId:f.run.runId,paused:false}),{code:'TEAM_CLOSED'});
  const context=await f.call('context',{runId:f.run.runId});
  assert.equal(context.stop.unresolved,2); assert.equal(context.stop.externalCount,1);
  assert.equal(context.attempts[0].stop.state,'confirmed');
  assert.equal(context.attempts[0].cancellation,undefined);
  await f.stop({operationId:'stop-original',expectedRevision:1});
  await f.engine.tick(); assert.equal(f.cancellations.length,2);
  f.tasks.get(f.calls[0].requestId).status='succeeded';
  f.tasks.get(f.calls[1].requestId).status='cancelled';
  await f.engine.tick();
  assert.equal(f.space.read().runs[0].state,'closed');
  assert.deepEqual(f.space.read().attempts.map(a=>a.state),['succeeded','cancelled']);
  assert.equal(f.space.read().runs[0].acceptedAt,undefined);
  assert.equal(f.calls.length,2);
});

test('lost cancel ACK and restart query the original operation; not_found never licenses another cancel', async t => {
  let sent=0;
  const f=await fixture(t,{cancel:async()=>{sent++;throw Error('ACK lost');}});
  await f.start(f.leader); await f.stop();
  const original=f.space.read().attempts[0].cancellation.operationId;
  assert.equal(sent,1); assert.equal(f.space.read().attempts[0].cancellation.state,'unknown');
  f.restart(); await Promise.all([f.engine.tick(),f.engine.tick(),f.call('refresh',{runId:f.run.runId})]);
  assert.equal(sent,1); assert.equal(f.space.read().runs[0].state,'stopping');
  f.receipts.set(original,{operationId:original,state:'confirmed'});
  await f.engine.tick(); assert.equal(f.space.read().attempts[0].cancellation.state,'confirmed');
  assert.equal(f.space.read().runs[0].state,'stopping');
  f.tasks.get(f.calls[0].requestId).status='cancelled'; await f.engine.tick();
  assert.equal(f.space.read().runs[0].state,'closed'); assert.equal(sent,1);
});

test('unbound or foreign original snapshots cannot cancel another task; recovery uses the original attempt', async t => {
  const f=await fixture(t); await f.start(f.leader);
  const original=structuredClone(f.tasks.get(f.calls[0].requestId));
  f.tasks.set(f.calls[0].requestId,{...original,requestId:'foreign',taskId:'foreign'});
  await f.stop(); assert.equal(f.cancellations.length,0);
  f.tasks.delete(f.calls[0].requestId);f.restart();await f.engine.tick();assert.equal(f.cancellations.length,0);
  f.tasks.set(f.calls[0].requestId,original);await f.engine.tick();
  assert.equal(f.cancellations.length,1);assert.equal(f.cancellations[0].taskId,original.taskId);
});

test('a crash after cancel intent is marked dispatched retains uncertainty and only queries its original receipt', async t => {
  const f=await fixture(t);await f.start(f.leader);
  // Persist the exact state left between durable send marker and transport call.
  f.space.transaction(s=>{
    const run=s.runs[0];run.state='stopping';run.paused=true;run.stop={requestedAt:new Date().toISOString(),targetIds:[s.attempts[0].attemptId],externalCount:1};
    s.attempts[0].cancellation={operationId:'cancel-crash',taskId:s.attempts[0].taskId,dispatched:true,state:'pending'};
    return null;
  });
  f.restart();await f.engine.tick();await f.engine.tick();
  assert.equal(f.cancellations.length,0);assert.equal(f.space.read().attempts[0].cancellation.state,'unknown');
  assert.equal(f.space.read().runs[0].state,'stopping');
});

test('stop during asynchronous execution preparation rejects dispatch; stale revision and member stop are rejected', async t => {
  let release,entered;
  const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  const f=await fixture(t,{execute:async a=>{entered();await gate;f.space.admit(a.teamScope,a.nodeId);throw Error('must not reach transport');}});
  await assert.rejects(f.stop({expectedRevision:999}),{code:'TEAM_REVISION'});
  const executing=f.start(f.leader);await ready;
  await f.stop();release();await executing;await f.engine.tick();
  assert.equal(f.calls.length,0);assert.equal(f.space.read().attempts[0].state,'rejected');
  assert.equal(f.space.read().runs[0].state,'closed');
  await assert.rejects(f.space.call('team.stopRun',{runId:f.run.runId,operationId:'agent-stop'},{sessionId:'foreign',key:'foreign'}),{code:'TEAM_FORBIDDEN'});
});

test('rejected or unsupported cancellation never closes a running task and receipt identity mismatches remain unknown', async t => {
  const f=await fixture(t,{cancel:async()=>({operationId:'wrong-operation',state:'confirmed'})});
  await f.start(f.leader);await f.stop();await f.engine.tick();
  assert.equal(f.space.read().attempts[0].cancellation.state,'unknown');assert.equal(f.space.read().runs[0].state,'stopping');
  const a=f.space.read().attempts[0];f.receipts.set(a.cancellation.operationId,{operationId:a.cancellation.operationId,state:'rejected'});
  await f.engine.tick();assert.equal(f.space.read().attempts[0].cancellation.state,'rejected');
  assert.equal(f.space.read().runs[0].state,'stopping');
  const g=await fixture(t,{cancel:undefined});await g.start(g.leader);await g.stop();
  assert.equal(g.space.read().attempts[0].cancellation.state,'unsupported');assert.equal(g.space.read().runs[0].state,'stopping');
});

test('a delayed submit transport error cannot overwrite a terminal already observed while stopping',async t=>{
 let release,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 const f=await fixture(t,{execute:async a=>{
  f.tasks.set(a.requestId,{requestId:a.requestId,taskId:'original-task',conversationId:'original-conversation',status:'running'});
  entered();await gate;throw Error('delayed lost submit ACK');
 }});
 const executing=f.start(f.leader);await ready;await f.stop();
 f.tasks.values().next().value.status='cancelled';await f.engine.tick();
 assert.equal(f.space.read().runs[0].state,'closed');
 release();await executing;
 assert.equal(f.space.read().attempts[0].state,'cancelled');assert.equal(f.cancellations.length,1);
});

test('stopping disables an enabled event policy and never wakes another model after original terminals',async t=>{
 const f=await fixture(t);
 await f.call('configureAutomation',{runId:f.run.runId,expectedRevision:f.run.revision,enabled:true,agentIds:[f.leader.agentId],maxActivations:10,maxMinutes:60,idleMinutes:10});
 await f.engine.tick();assert.equal(f.calls.length,1);
 await f.stop();assert.equal(f.space.read().runs[0].automation.enabled,false);
 f.tasks.values().next().value.status='cancelled';await f.engine.tick();await f.engine.tick();
 assert.equal(f.space.read().runs[0].state,'closed');assert.equal(f.calls.length,1);
 await assert.rejects(f.call('configureAutomation',{runId:f.run.runId,expectedRevision:f.space.read().runs[0].revision,enabled:true,agentIds:[f.leader.agentId],maxActivations:10,maxMinutes:60,idleMinutes:10}),{code:'TEAM_CLOSED'});
});
