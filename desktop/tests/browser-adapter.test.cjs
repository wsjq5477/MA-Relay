const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {BrowserAdapterHost} = require('../electron/browser-adapter-host.cjs');
const {BrowserState} = require('../electron/browser-state.cjs');
const {atomicWrite} = require('../electron/graph-layout.cjs');
const {reconcileOutput}=require('../electron/browser-output-reconcile.cjs');

function setup(t, extra = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'bridge-browser-'));
  const calls=[];
  const channel={online:true,async request(method,p) { calls.push({method,params:p}); return {requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId}; }};
  const options={directory,adapter:'chatgpt-web',browserInstanceId:'browser-test',channel,...extra};
  const host=new BrowserAdapterHost(options);
  t.after(() => {host.close();fs.rmSync(directory,{recursive:true,force:true});});
  return {directory,channel,host,calls,options};
}
async function submit(f,id='request-1',message='Explain this') {
  const agent=await f.host.call('connect');
  return f.host.call('ipc',{op:'submit',agentId:agent.agentId,requestId:id,message});
}
async function dispatched(f) { await Promise.all([...f.host.jobs]); }
function incoming(f,task,kind,seq,fields={}) {
  const raw=f.host.store.read().tasks.find(t=>t.taskId===task.taskId);
  return {requestId:task.requestId,taskId:task.taskId,executionId:task.executionId,bridgeSessionId:task.conversationId,browserInstanceId:'browser-test',bindingRevision:raw.bindingRevision,leaseEpoch:raw.leaseEpoch,kind,seq,...(kind==='completed'&&!Object.hasOwn(fields,'continuation')?{continuation:{transcriptFingerprint:'a'.repeat(64),assistantAnchor:'assistant-'+task.requestId,historyRevision:seq}}:{}),...fields};
}
async function bind(f,task) { return f.host.acceptEvent(incoming(f,task,'submitted',1,{binding:{sessionKey:'page-session',userAnchor:task.requestId,documentId:'document-1'}})); }
async function completed(f){const task=await submit(f);await dispatched(f);await bind(f,task);await f.host.acceptEvent(incoming(f,task,'completed',2,{text:'Original answer'}));return task;}
const healthReceipt=(p,extra={})=>({adapterId:p.adapterId,browserInstanceId:p.browserInstanceId,requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId,probeId:p.probeId,enabled:true,domChecked:true,pageReady:true,loginChecked:false,sessionClosed:false,blocked:false,...extra});

test('original integrity reconciliation commits failed only after the bound terminal event',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);await bind(f,task);await f.host.acceptEvent(incoming(f,task,'unknown',2,{text:'BROWSER_USER_INTERFERENCE'}));
  const original=f.channel.request;f.channel.request=async(method,p)=>{const reply=await original(method,p);if(method==='output.subscribe'){assert.equal(p.observeTerminal,'integrity-failure-v1');assert.deepEqual(p.message,{type:'text',text:task.message});await f.host.acceptEvent(incoming(f,task,'failed',3,{error:{code:'BROWSER_CONTEXT_INTEGRITY_LOST',message:'Original submitted generation ended without a trustworthy context.'}}));return {...reply,integrityObservationSupported:true};}return reply;};
  const op=await f.host.call('ipc',{op:'reconcile',taskId:task.taskId,operationId:'original-integrity'});assert.equal(op.state,'unknown');await dispatched(f);
  assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).status,'failed');assert.equal((await f.host.call('ipc',{op:'operation',operationId:'original-integrity'})).state,'confirmed');assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:task.conversationId})).canContinue,false);
  assert.equal((await submit(f)).status,'failed');assert.equal(f.calls.filter(c=>c.method==='message.send').length,1);
});
test('old extension acknowledgement alone never releases an integrity unknown',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);await bind(f,task);await f.host.acceptEvent(incoming(f,task,'unknown',2,{text:'BROWSER_USER_INTERFERENCE'}));
  await f.host.call('ipc',{op:'reconcile',taskId:task.taskId,operationId:'old-extension-observation'});await dispatched(f);
  assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).status,'unknown');assert.equal((await f.host.call('ipc',{op:'operation',operationId:'old-extension-observation'})).state,'unknown');assert.equal((await f.host.call('snapshot')).agents.items[0].busy,true);assert.equal(f.calls.filter(c=>c.method==='message.send').length,1);
});
test('integrity observer requires the original local reconciliation receipt before any command',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);await bind(f,task);await f.host.acceptEvent(incoming(f,task,'unknown',2,{text:'BROWSER_USER_INTERFERENCE'}));const before=f.calls.length;
  await assert.rejects(reconcileOutput(f.host,{taskId:task.taskId,operationId:'missing-original-control'}),{code:'OPERATION_CONFLICT'});assert.equal(f.calls.length,before);
});
test('ordinary connection-loss reconciliation does not request integrity failure settlement',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);await bind(f,task);await f.host.acceptEvent(incoming(f,task,'unknown',2,{text:'BROWSER_CHANNEL_LOST'}));await f.host.call('ipc',{op:'reconcile',taskId:task.taskId,operationId:'original-connection-query'});await dispatched(f);assert.equal(f.calls.find(c=>c.method==='output.subscribe').params.observeTerminal,undefined);assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).status,'unknown');
});

test('original session health is read-only, filters remote fields and does not claim account verification',async t=>{
  const f=setup(t),task=await completed(f),before=JSON.stringify(f.host.store.read()),original=f.channel.request;
  f.channel.request=async(method,p)=>{await original(method,p);return healthReceipt(p,{privatePageData:'must not be projected'});};
  const result=await f.host.call('ipc',{op:'session.health',taskId:task.taskId,probeId:'health-original'});
  assert.equal(result.ready,true);assert.equal(result.pageReady,true);assert.equal(result.loginChecked,false);assert.equal(result.privatePageData,undefined);assert.equal(result.taskId,task.taskId);
  assert.equal(JSON.stringify(f.host.store.read()),before);assert.equal(f.calls.filter(c=>c.method==='message.send').length,1);
});
test('legacy completion remains readable but cannot resume without a transcript proof',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);await bind(f,task);await f.host.acceptEvent(incoming(f,task,'completed',2,{text:'Legacy original',continuation:undefined}));
  assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).status,'succeeded');assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:task.conversationId})).canContinue,false);
  const count=f.calls.length;await assert.rejects(f.host.call('ipc',{op:'continue',conversationId:task.conversationId,requestId:'no-invented-proof',message:'Continue'}),{code:'CONVERSATION_BINDING'});assert.equal(f.calls.length,count);
});
test('completion proof is private and malformed or misplaced proofs never advance the cursor',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);await bind(f,task);
  for(const continuation of [{transcriptFingerprint:'bad',assistantAnchor:'assistant',historyRevision:1},{transcriptFingerprint:'a'.repeat(64),assistantAnchor:'assistant',historyRevision:-1},{transcriptFingerprint:'a'.repeat(64),assistantAnchor:'assistant',historyRevision:1,extra:true}])await assert.rejects(f.host.acceptEvent(incoming(f,task,'completed',2,{text:'Result',continuation})),{code:'INVALID_INPUT'});
  await assert.rejects(f.host.acceptEvent(incoming(f,task,'unknown',2,{text:'Unknown',continuation:{transcriptFingerprint:'a'.repeat(64),assistantAnchor:'assistant',historyRevision:1}})),{code:'INVALID_INPUT'});
  assert.equal(f.host.store.read().tasks[0].browserSeq,1);await f.host.acceptEvent(incoming(f,task,'completed',2,{text:'Original'}));
  assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).binding,undefined);assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:task.conversationId})).canContinue,true);
});
test('a resumed submission cannot move the original continuation proof to another document',async t=>{
  const f=setup(t),first=await completed(f),task=await f.host.call('ipc',{op:'continue',conversationId:first.conversationId,requestId:'same-original-document',message:'Continue'});await dispatched(f);
  await assert.rejects(f.host.acceptEvent(incoming(f,task,'submitted',1,{binding:{sessionKey:'page-session',userAnchor:task.requestId,documentId:'different-document'}})),{code:'BROWSER_SESSION_MISMATCH'});
  assert.equal(f.host.store.read().tasks.at(-1).browserSeq,0);
});
test('known poisoned storage remains unavailable even when the original page reports ready',async t=>{
  const f=setup(t),task=await completed(f);f.host.store.writer=()=>{throw Error('controlled disk failure');};
  await assert.rejects(f.host.call('ipc',{op:'session.close',taskId:task.taskId,operationId:'poison-health',expectedRevision:1}),{code:'BROWSER_STORAGE_ERROR'});
  f.channel.request=async(_method,p)=>healthReceipt(p);
  const result=await f.host.call('ipc',{op:'session.health',taskId:task.taskId,probeId:'poisoned-health'});assert.equal(result.pageReady,true);assert.equal(result.storageReady,false);assert.equal(result.ready,false);assert.equal(result.code,'BROWSER_STORAGE_ERROR');
  assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).result.message,'Original answer');
});

test('offline and unknown tasks stay occupied after health; wrong identities are refused before WS',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);f.channel.online=false;let calls=f.calls.length;
  const offline=await f.host.call('ipc',{op:'session.health',taskId:task.taskId,probeId:'offline-health'});assert.equal(offline.ready,false);assert.equal(offline.sitePermission,null);assert.equal(offline.code,'BROWSER_OFFLINE');assert.equal(f.calls.length,calls);
  await assert.rejects(f.host.call('ipc',{op:'session.health',taskId:task.taskId,executionId:'other-execution',probeId:'wrong-health'}),{code:'EXECUTION_MISMATCH'});assert.equal(f.calls.length,calls);
  f.channel.online=true;await f.host.acceptEvent(incoming(f,task,'unknown',1,{text:'Original observation lost'}));
  f.channel.request=async(_method,p)=>healthReceipt(p);const before=JSON.stringify(f.host.store.read());
  const unknown=await f.host.call('ipc',{op:'session.health',taskId:task.taskId,probeId:'unknown-health'});assert.equal(unknown.pageReady,true);assert.equal(unknown.blocked,true);assert.equal(unknown.ready,false);assert.equal(unknown.taskStatus,'unknown');assert.equal(JSON.stringify(f.host.store.read()),before);
});

test('unverified health response identities and boolean combinations cannot report readiness',async t=>{
  const f=setup(t),task=await completed(f);
  for(const extra of [{requestId:'foreign-request'},{probeId:'foreign-probe'},{loginChecked:true},{enabled:false,pageReady:true},{sessionClosed:true,pageReady:true},{domChecked:false,pageReady:true}]){
    f.channel.request=async(_method,p)=>healthReceipt(p,extra);
    const result=await f.host.call('ipc',{op:'session.health',taskId:task.taskId,probeId:'health-malformed'});assert.equal(result.ready,false);assert.equal(result.code,'BROWSER_HEALTH_UNKNOWN');
  }
});

test('output ahead of the health reply commits without deadlock and invalidates stale readiness',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);await bind(f,task);
  f.channel.request=async(method,p)=>{assert.equal(method,'health.check');await f.host.acceptEvent(incoming(f,task,'output.snapshot',2,{revision:1,text:'Output while checking'}));return healthReceipt(p);};
  let timer;try{
    const result=await Promise.race([f.host.call('ipc',{op:'session.health',taskId:task.taskId,probeId:'streaming-health'}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Health held the event lane')),1500);})]);
    assert.equal(result.ready,false);assert.equal(result.stale,true);assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).lastSummary,'Output while checking');
  }finally{clearTimeout(timer);}
});

test('a new turn admitted during a read-only probe makes the old result stale',async t=>{
  const f=setup(t),task=await completed(f),original=f.channel.request;let entered,release;
  const started=new Promise(resolve=>entered=resolve),held=new Promise(resolve=>release=resolve);
  f.channel.request=async(method,p)=>{if(method==='health.check'){entered();await held;return healthReceipt(p);}return original(method,p);};
  const probe=f.host.call('ipc',{op:'session.health',taskId:task.taskId,probeId:'racing-health'});await started;
  await f.host.call('ipc',{op:'continue',conversationId:task.conversationId,requestId:'next-during-probe',message:'Continue'});release();const result=await probe;
  assert.equal(result.stale,true);assert.equal(result.ready,false);await dispatched(f);
});

test('session close persists a separate tombstone receipt and preserves the completed Task',async t=>{
  const f=setup(t),task=await completed(f),original=f.channel.request;
  f.channel.request=async(method,p)=>({...await original(method,p),...(method==='session.close'?{closed:true}:{})});
  const p={op:'session.close',taskId:task.taskId,executionId:task.executionId,operationId:'close-original',expectedRevision:1};
  assert.equal((await f.host.call('ipc',p)).state,'unknown');await dispatched(f);
  const receipt=await f.host.call('ipc',{op:'operation',taskId:task.taskId,operationId:p.operationId});assert.equal(receipt.state,'confirmed');assert.equal(receipt.data.closed,true);
  assert.equal((await f.host.call('ipc',p)).state,'confirmed');assert.equal(f.calls.filter(c=>c.method==='session.close').length,1);
  const conversation=await f.host.call('ipc',{op:'conversation',conversationId:task.conversationId});assert.equal(conversation.closed,true);assert.equal(conversation.canContinue,false);
  assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).result.message,'Original answer');
  await assert.rejects(f.host.call('ipc',{op:'continue',conversationId:task.conversationId,requestId:'closed-resume',message:'Again'}),{code:'CONVERSATION_BINDING'});
  const next=await submit(f,'new-independent-session');await dispatched(f);assert.notEqual(next.conversationId,task.conversationId);assert.equal(f.calls.filter(c=>c.method==='message.send').length,2);
});

test('lost close response survives reopen; querying original operation never resends close',async t=>{
  const f=setup(t),task=await completed(f),original=f.channel.request;
  f.channel.request=async(method,p)=>{await original(method,p);if(method==='session.close')throw Error('Lost tombstone ACK');if(method==='operation.get')return {operationId:p.operationId,method:'session.close',state:'confirmed',result:{requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId,closed:true}};};
  const p={op:'session.close',taskId:task.taskId,operationId:'close-lost',expectedRevision:1};await f.host.call('ipc',p);await dispatched(f);f.host.close();
  const reopened=new BrowserAdapterHost(f.options);t.after(()=>reopened.close());
  assert.equal((await reopened.call('ipc',p)).state,'unknown');assert.equal(f.calls.filter(c=>c.method==='session.close').length,1);
  await assert.rejects(reopened.call('ipc',{op:'submit',agentId:task.targetAgent,requestId:'alias',message:'Again'}),{code:'AGENT_BUSY'});
  assert.equal((await reopened.call('ipc',{op:'operation',taskId:task.taskId,operationId:p.operationId})).state,'unknown');await Promise.all([...reopened.jobs]);
  assert.equal((await reopened.call('ipc',{op:'operation',taskId:task.taskId,operationId:p.operationId})).state,'confirmed');assert.equal(f.calls.filter(c=>c.method==='session.close').length,1);
  assert.equal((await reopened.call('ipc',{op:'task',taskId:task.taskId})).status,'succeeded');
});

test('an ordinary close ACK without the original tombstone cannot confirm or free occupancy',async t=>{
  const f=setup(t),task=await completed(f),p={op:'session.close',taskId:task.taskId,operationId:'close-unproved',expectedRevision:1};
  await f.host.call('ipc',p);await dispatched(f);assert.equal((await f.host.call('ipc',p)).state,'unknown');
  await assert.rejects(submit(f,'other-request'),{code:'AGENT_BUSY'});assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:task.conversationId})).canContinue,false);
  const snapshot=await f.host.call('snapshot');assert.equal(snapshot.agents.items[0].busy,true);assert.equal(snapshot.agents.items[0].available,false);
});
test('a lost durable close refusal is recovered by original query while the Task and open session remain intact',async t=>{
  const f=setup(t),task=await completed(f),original=f.channel.request;
  f.channel.request=async(method,p)=>{await original(method,p);if(method==='session.close')throw Error('lost refusal');return {operationId:p.operationId,method:'session.close',state:'rejected',result:{requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId,closed:false,state:'rejected',code:'BROWSER_SESSION_BUSY'}};};
  const p={op:'session.close',taskId:task.taskId,operationId:'close-refused',expectedRevision:1};await f.host.call('ipc',p);await dispatched(f);
  await f.host.call('ipc',{op:'operation',taskId:task.taskId,operationId:p.operationId});await dispatched(f);
  assert.equal((await f.host.call('ipc',p)).state,'rejected');assert.equal(f.calls.filter(c=>c.method==='session.close').length,1);
  assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).status,'succeeded');assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:task.conversationId})).canContinue,true);
});

test('session close refuses active execution, changed execution/revision and operation aliasing before dispatch',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);const p={op:'session.close',taskId:task.taskId,operationId:'close-invalid',expectedRevision:1};
  await assert.rejects(f.host.call('ipc',p),{code:'AGENT_BUSY'});assert.equal(f.calls.filter(c=>c.method==='session.close').length,0);
  await bind(f,task);await f.host.acceptEvent(incoming(f,task,'completed',2,{text:'Done'}));
  await assert.rejects(f.host.call('ipc',{...p,executionId:'other-execution'}),{code:'EXECUTION_MISMATCH'});
  await assert.rejects(f.host.call('ipc',{...p,expectedRevision:2}),{code:'CONVERSATION_BINDING'});
  await f.host.call('ipc',{op:'reconcile',taskId:task.taskId,operationId:p.operationId});
  await assert.rejects(f.host.call('ipc',p),{code:'OPERATION_CONFLICT'});assert.equal(f.calls.filter(c=>c.method==='session.close').length,0);
});
test('closing an older turn cannot detach the latest original session binding',async t=>{
  const f=setup(t),first=await completed(f);
  const next=await f.host.call('ipc',{op:'continue',conversationId:first.conversationId,requestId:'next-turn',message:'Continue'});await dispatched(f);await bind(f,next);await f.host.acceptEvent(incoming(f,next,'completed',2,{text:'Next answer'}));
  await assert.rejects(f.host.call('ipc',{op:'session.close',taskId:first.taskId,operationId:'stale-close',expectedRevision:1}),{code:'CONVERSATION_BINDING'});
  assert.equal(f.calls.filter(c=>c.method==='session.close').length,0);assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:first.conversationId})).canContinue,true);
});
test('failed Node close-intent persistence sends no extension command',async t=>{
  const f=setup(t),task=await completed(f);f.host.store.writer=()=>{throw Error('disk unavailable');};
  await assert.rejects(f.host.call('ipc',{op:'session.close',taskId:task.taskId,operationId:'close-storage',expectedRevision:1}),{code:'BROWSER_STORAGE_ERROR'});
  assert.equal(f.calls.filter(c=>c.method==='session.close').length,0);assert.equal(f.host.store.read().operations.length,0);
});

test('browser commands persist intent before delivery; duplicate requests never resubmit',async t=>{
  const f=setup(t);const task=await submit(f);await dispatched(f);
  assert.deepEqual(f.calls.map(c=>c.method),['session.create','message.prepare','message.send']);
  const disk=JSON.parse(fs.readFileSync(path.join(f.directory,'browser-state.json')));
  assert.equal(disk.tasks[0].phase,'dispatching');
  assert.equal((await submit(f)).taskId,task.taskId);
  await dispatched(f);assert.equal(f.calls.length,3);
  await assert.rejects(submit(f,'request-1','Changed'),{code:'REQUEST_CONFLICT'});
  await assert.rejects(submit(f,'request-2'),{code:'AGENT_BUSY'});
});

test('lost send acknowledgement retains original unknown and blocks other IDs after reopen',async t=>{
  const f=setup(t);const original=f.channel.request;
  f.channel.request=async(method,p)=>{ const reply=await original(method,p);if(method==='message.send')throw Error('lost ACK');return reply; };
  const task=await submit(f);await dispatched(f);
  assert.equal((await f.host.call('ipc',{op:'request',requestId:task.requestId})).status,'unknown');
  f.host.close();const reopened=new BrowserAdapterHost(f.options);t.after(()=>reopened.close());
  assert.equal((await reopened.call('ipc',{op:'task',taskId:task.taskId})).status,'unknown');
  await assert.rejects(reopened.call('ipc',{op:'submit',requestId:'alias',agentId:task.targetAgent,message:'Again'}),{code:'AGENT_BUSY'});
  assert.equal(f.calls.filter(c=>c.method==='message.send').length,1);
});

test('reopening an active observer only marks unknown, never sends a browser command',async t=>{
  const f=setup(t);const task=await submit(f);await dispatched(f);f.host.close();
  const reopened=new BrowserAdapterHost(f.options);t.after(()=>reopened.close());
  assert.equal((await reopened.call('ipc',{op:'task',taskId:task.taskId})).status,'unknown');
  assert.equal(f.calls.length,3);
});

test('events require exact execution, lease and contiguous sequence; duplicates have immutable content',async t=>{
  const f=setup(t);const task=await submit(f);await dispatched(f);
  await assert.rejects(f.host.acceptEvent({...incoming(f,task,'unknown',1),executionId:'different'}),{code:'BROWSER_SESSION_MISMATCH'});
  await assert.rejects(f.host.acceptEvent(incoming(f,task,'unknown',2)),{code:'EVENT_GAP'});
  const event=incoming(f,task,'submitted',1,{binding:{sessionKey:'page-session',userAnchor:'user-1',documentId:'document-1'}});
  assert.deepEqual(await f.host.acceptEvent(event),{throughSeq:1});
  assert.deepEqual(await f.host.acceptEvent(event),{throughSeq:1});
  await assert.rejects(f.host.acceptEvent({...event,binding:{...event.binding,userAnchor:'other'}}),{code:'EVENT_CONFLICT'});
  assert.equal(f.host.store.read().tasks[0].lastSeq,2);
});

test('partial output is not completion; revision snapshots may rewrite the prefix',async t=>{
  const f=setup(t);const task=await submit(f);await dispatched(f);await bind(f,task);
  await f.host.acceptEvent(incoming(f,task,'output.snapshot',2,{revision:1,text:'initial text'}));
  await f.host.acceptEvent(incoming(f,task,'output.snapshot',3,{revision:2,text:'revised text'}));
  const current=await f.host.call('ipc',{op:'task',taskId:task.taskId});
  assert.equal(current.status,'running');assert.equal(current.result,undefined);
  assert.equal(current.lastSummary,'revised text');assert.equal(current.events.at(-1).event.mode,'replace');
  await assert.rejects(f.host.acceptEvent(incoming(f,task,'output.snapshot',4,{revision:2,text:'stale'})),{code:'EVENT_CONFLICT'});
  assert.equal(f.host.store.read().tasks[0].browserSeq,3);
});

test('output without a submitted binding cannot complete a task',async t=>{
  const f=setup(t);const task=await submit(f);await dispatched(f);
  await assert.rejects(f.host.acceptEvent(incoming(f,task,'completed',1,{text:'old answer'})),{code:'BROWSER_SUBMISSION_UNKNOWN'});
  assert.equal(f.host.store.read().tasks[0].browserSeq,0);
});

test('three rounds resume the original session; unknown round forbids continuation',async t=>{
  const f=setup(t);let task=await submit(f);await dispatched(f);
  for(let round=0;round<3;round++) {
    await bind(f,task);
    await f.host.acceptEvent(incoming(f,task,'completed',2,{text:'Answer '+round}));
    const c=await f.host.call('ipc',{op:'conversation',conversationId:task.conversationId});
    assert.equal(c.canContinue,true);assert.equal(c.turns,round+1);
    if(round<2) {
      const next=await f.host.call('ipc',{op:'continue',conversationId:task.conversationId,requestId:'follow-'+round,message:'Continue'});
      assert.equal(next.conversationId,task.conversationId);task=next;await dispatched(f);
    }
  }
  assert.equal(f.calls.filter(c=>c.method==='session.create').length,1);
  assert.equal(f.calls.filter(c=>c.method==='session.resume').length,2);
});

test('storage commit failure before submission sends no browser command and poisons writes',async t=>{
  let writes=0;
  const f=setup(t,{storage:{write(file,state){if(++writes===2)throw Error('disk failure');atomicWrite(file,state);}}});
  await assert.rejects(submit(f),{code:'BROWSER_STORAGE_ERROR'});
  assert.equal(f.calls.length,0);
  assert.equal(f.host.store.read().tasks.length,0);
  await assert.rejects(submit(f),{code:'BROWSER_STORAGE_ERROR'});
});

test('event commit failure cannot acknowledge or advance durable browser cursor',async t=>{
  const f=setup(t);const task=await submit(f);await dispatched(f);
  const disk=fs.readFileSync(path.join(f.directory,'browser-state.json'),'utf8');
  f.host.store.writer=()=>{throw Error('write failed');};
  await assert.rejects(bind(f,task),{code:'BROWSER_STORAGE_ERROR'});
  assert.equal(f.host.store.read().tasks[0].browserSeq,0);
  assert.equal(fs.readFileSync(path.join(f.directory,'browser-state.json'),'utf8'),disk);
});

test('cancel acknowledgement never fabricates webpage cancellation; duplicate operation stays identical',async t=>{
  const f=setup(t);const task=await submit(f);await dispatched(f);await bind(f,task);
  const p={op:'cancel',taskId:task.taskId,operationId:'cancel-1'};
  const receipt=await f.host.call('ipc',p);
  assert.equal(receipt.state,'rejected');assert.equal(receipt.data.code,'BROWSER_CANCEL_UNSUPPORTED');
  assert.deepEqual(await f.host.call('ipc',p),receipt);
  assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).status,'running');
  assert.equal(f.calls.filter(c=>c.method==='task.cancel').length,0);
});
const cancelProof=p=>({...p,state:'confirmed',cancelled:true,proof:'content-not-authorized-v1',contentAuthorized:false,sealedThroughSeq:0});
test('pre-content cancellation commits intent before WS and requires a matching durable proof',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);const original=f.channel.request;
  f.channel.request=async(method,p)=>{
    await original(method,p);assert.equal(method,'task.cancel');
    assert.equal(f.host.store.read().operations.find(o=>o.operationId===p.operationId).state,'unknown');
    assert.equal(f.host.store.read().tasks[0].status,'unknown');return cancelProof(p);
  };
  const params={op:'cancel',taskId:task.taskId,operationId:'cancel-proof'};
  assert.equal((await f.host.call('ipc',params)).state,'unknown');await dispatched(f);
  assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).status,'cancelled');
  assert.equal((await f.host.call('ipc',params)).state,'confirmed');assert.equal(f.calls.filter(c=>c.method==='task.cancel').length,1);
});
test('lost cancellation reply is resolved by original operation lookup without resending',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);const original=f.channel.request;let saved;
  f.channel.request=async(method,p)=>{await original(method,p);if(method==='task.cancel'){saved=cancelProof(p);throw Error('lost reply');}assert.equal(method,'operation.get');return {operationId:p.operationId,method:'task.cancel',state:'confirmed',result:saved};};
  const params={op:'cancel',taskId:task.taskId,operationId:'cancel-lost'};
  await f.host.call('ipc',params);await dispatched(f);assert.equal((await f.host.call('ipc',params)).state,'unknown');
  await assert.rejects(f.host.call('ipc',{...params,operationId:'cancel-another'}),{code:'AGENT_BUSY'});
  await f.host.call('ipc',{op:'operation',taskId:task.taskId,operationId:params.operationId});await dispatched(f);
  assert.equal((await f.host.call('ipc',params)).state,'confirmed');assert.equal(f.calls.filter(c=>c.method==='task.cancel').length,1);assert.equal(f.calls.filter(c=>c.method==='operation.get').length,1);
});
test('acknowledgement or foreign proof cannot release an uncertain execution',async t=>{
  for(const wrong of ['ack','identity','fence']){
    const f=setup(t),task=await submit(f);await dispatched(f);
    f.channel.request=async(_method,p)=>wrong==='ack'?{requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId}:cancelProof({...p,...(wrong==='identity'?{taskId:'foreign'}:{senderFence:'before-message-send'})});
    const params={op:'cancel',taskId:task.taskId,operationId:'cancel-'+wrong};await f.host.call('ipc',params);await dispatched(f);
    assert.equal((await f.host.call('ipc',params)).state,'unknown');assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).status,'unknown');
    await assert.rejects(f.host.call('ipc',{...params,executionId:'foreign'}),{code:'EXECUTION_MISMATCH'});
  }
});
test('cancelling a held session creation fences later prepare/send even after its old ACK arrives',async t=>{
  const f=setup(t),original=f.channel.request;let entered,release;const started=new Promise(r=>entered=r),held=new Promise(r=>release=r);
  f.channel.request=async(method,p)=>{await original(method,p);if(method==='session.create'){entered();await held;return {requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId};}assert.equal(method,'task.cancel');assert.equal(p.senderFence,'before-message-send');return cancelProof(p);};
  const task=await submit(f);await started;await f.host.call('ipc',{op:'cancel',taskId:task.taskId,operationId:'cancel-held-create'});
  await f.host.controlJobs.get('cancel-held-create');release();await dispatched(f);
  assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).status,'cancelled');assert.deepEqual(f.calls.map(c=>c.method),['session.create','task.cancel']);
});
test('a prepared continuation seals its inherited session before confirming cancellation',async t=>{
  const f=setup(t),first=await completed(f),dispatchOriginal=f.host.dispatch,requestOriginal=f.channel.request;let release;
  const held=new Promise(resolve=>release=resolve);f.host.dispatch=async function(task){await held;return dispatchOriginal.call(this,task);};
  f.channel.request=async(method,p)=>{await requestOriginal(method,p);assert.equal(method,'task.cancel');assert.equal(p.senderFence,'before-message-send');return cancelProof(p);};
  const task=await f.host.call('ipc',{op:'continue',conversationId:first.conversationId,requestId:'cancel-prepared-continuation',message:'Never send this continuation'});
  assert.equal(f.host.store.read().tasks.at(-1).phase,'prepared');const receipt=await f.host.call('ipc',{op:'cancel',taskId:task.taskId,operationId:'cancel-prepared-original'});assert.equal(receipt.state,'unknown');
  await f.host.controlJobs.get(receipt.operationId);release();await dispatched(f);
  assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).status,'cancelled');assert.equal(f.calls.filter(c=>c.method==='session.resume').length,0);assert.equal(f.calls.filter(c=>c.method==='task.cancel').length,1);
});
test('failed cancellation intent commit cannot send cancellation or free the original task',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);const count=f.calls.length;
  f.host.store.writer=()=>{throw Error('disk unavailable');};await assert.rejects(f.host.call('ipc',{op:'cancel',taskId:task.taskId,operationId:'cancel-no-disk'}),{code:'BROWSER_STORAGE_ERROR'});
  assert.equal(f.calls.length,count);assert.equal(f.host.store.read().tasks[0].status,'accepted');
});
test('an original completed execution wins over a conflicting delayed cancellation proof',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);let release,entered;const held=new Promise(r=>release=r),started=new Promise(r=>entered=r);
  f.channel.request=async(_method,p)=>{entered();await held;return cancelProof(p);};
  const cancel={op:'cancel',taskId:task.taskId,operationId:'cancel-conflicting'};await f.host.call('ipc',cancel);await started;
  await bind(f,task);await f.host.acceptEvent(incoming(f,task,'completed',2,{text:'Actual original result'}));release();await dispatched(f);
  assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).status,'succeeded');assert.equal((await f.host.call('ipc',cancel)).state,'unknown');
});
test('cancellation proof waits for all earlier original events before settling the task',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);let proof;
  f.channel.request=async(method,p)=>{if(method==='task.cancel'){proof={...cancelProof(p),sealedThroughSeq:1};return proof;}return {operationId:p.operationId,method:'task.cancel',state:'confirmed',result:proof};};
  const cancel={op:'cancel',taskId:task.taskId,operationId:'cancel-event-cursor'};await f.host.call('ipc',cancel);await dispatched(f);
  assert.equal((await f.host.call('ipc',cancel)).state,'unknown');await f.host.acceptEvent(incoming(f,task,'unknown',1,{text:'Preflight observation lost'}));
  await f.host.call('ipc',{op:'operation',taskId:task.taskId,operationId:cancel.operationId});await dispatched(f);
  assert.equal((await f.host.call('ipc',cancel)).state,'confirmed');assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).status,'cancelled');
});

test('late completion reconciles only the original submitted unknown task',async t=>{
  const f=setup(t);const task=await submit(f);await dispatched(f);await bind(f,task);
  await f.host.acceptEvent(incoming(f,task,'unknown',2,{text:'transport lost'}));
  assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:task.conversationId})).canContinue,false);
  await f.host.acceptEvent(incoming(f,task,'completed',3,{text:'original result'}));
  assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).status,'succeeded');
});

test('corrupt journal fails closed and preserves original bytes',t=>{
  const f=setup(t);const file=path.join(f.directory,'browser-state.json');fs.writeFileSync(file,'{broken');
  assert.throws(()=>new BrowserState(f.directory),{code:'BROWSER_STATE_INVALID'});
  assert.equal(fs.readFileSync(file,'utf8'),'{broken');
});

test('unknown or missing event fields and oversized text are rejected before state mutation',async t=>{
  const f=setup(t);const task=await submit(f);await dispatched(f);
  await assert.rejects(f.host.acceptEvent({...incoming(f,task,'unknown',1),extra:'field'}),{code:'INVALID_INPUT'});
  await assert.rejects(f.host.acceptEvent(incoming(f,task,'output.snapshot',1,{revision:1,text:'😀'.repeat(70000)})),{code:'INVALID_INPUT'});
  assert.equal(f.host.store.read().tasks[0].browserSeq,0);
});

test('closed host does not send pending work; reads cannot reopen it',async t=>{
  const f=setup(t);let release;f.channel.request=()=>new Promise(r=>{release=r;});
  const task=await submit(f);
  while(!release) await new Promise(r=>setImmediate(r));
  f.host.close();release({requestId:task.requestId,executionId:task.executionId,bridgeSessionId:task.conversationId});await dispatched(f);
  assert.equal(f.host.store.read().tasks[0].status,'unknown');
  await assert.rejects(f.host.call('snapshot'),{code:'ADAPTER_CLOSED'});
});

test('same context cannot be reopened with a different browser profile',async t=>{
  const f=setup(t);await f.host.call('connect');
  assert.throws(()=>new BrowserAdapterHost({...f.options,browserInstanceId:'alias-browser'}),{code:'BROWSER_SESSION_MISMATCH'});
});

test('a later submitted event cannot replace the original user message anchor',async t=>{
  const f=setup(t);const task=await submit(f);await dispatched(f);await bind(f,task);
  await assert.rejects(f.host.acceptEvent(incoming(f,task,'submitted',2,{binding:{sessionKey:'page-session',userAnchor:'manual-message',documentId:'document-1'}})),{code:'BROWSER_SESSION_MISMATCH'});
  assert.equal(f.host.store.read().tasks[0].browserSeq,1);
});

test('syntactically valid journal with inconsistent terminal state fails closed',async t=>{
  const f=setup(t);await submit(f);await dispatched(f);
  const file=path.join(f.directory,'browser-state.json');const saved=JSON.parse(fs.readFileSync(file));
  saved.tasks[0].status='succeeded';fs.writeFileSync(file,JSON.stringify(saved));
  assert.throws(()=>new BrowserState(f.directory),{code:'BROWSER_STATE_INVALID'});
});

test('readonly reconciliation accepts an original terminal event ahead of its command acknowledgement without blocking the event lane',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);await bind(f,task);await f.host.acceptEvent(incoming(f,task,'unknown',2,{text:'Connection lost'}));
  f.channel.request=async(method,p)=>{f.calls.push({method,params:p});assert.equal(method,'output.subscribe');await f.host.acceptEvent(incoming(f,task,'completed',3,{text:'Original late result'}));return {requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId};};
  const receipt=await f.host.call('ipc',{op:'reconcile',taskId:task.taskId,executionId:task.executionId,operationId:'reconcile-original'});assert.equal(receipt.state,'unknown');await dispatched(f);
  const queried=await f.host.call('ipc',{op:'operation',taskId:task.taskId,operationId:receipt.operationId});assert.equal(queried.state,'confirmed');assert.equal(queried.data.status,'succeeded');
  assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).result.message,'Original late result');assert.equal(f.calls.filter(c=>c.method==='message.send').length,1);
  await f.host.call('ipc',{op:'reconcile',taskId:task.taskId,operationId:receipt.operationId});assert.equal(f.calls.filter(c=>c.method==='output.subscribe').length,1);
});

test('a subscription acknowledgement alone neither settles reconciliation nor releases the unknown task',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);await bind(f,task);await f.host.acceptEvent(incoming(f,task,'unknown',2,{text:'Lost observation'}));
  const receipt=await f.host.call('ipc',{op:'reconcile',taskId:task.taskId,operationId:'reconcile-ack-only'});await dispatched(f);
  assert.equal((await f.host.call('ipc',{op:'operation',taskId:task.taskId,operationId:receipt.operationId})).state,'unknown');assert.equal((await f.host.call('ipc',{op:'task',taskId:task.taskId})).status,'unknown');
  await assert.rejects(submit(f,'another-id'),{code:'AGENT_BUSY'});assert.equal(f.calls.filter(c=>c.method==='message.send').length,1);
});

test('reconciliation and cancellation cannot share an operation ID or change the original execution',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);
  await assert.rejects(f.host.call('ipc',{op:'reconcile',taskId:task.taskId,executionId:'foreign-execution',operationId:'wrong-execution'}),{code:'EXECUTION_MISMATCH'});assert.equal(f.host.store.read().operations.length,0);
  await f.host.call('ipc',{op:'cancel',taskId:task.taskId,operationId:'cancel-original'});
  await assert.rejects(f.host.call('ipc',{op:'reconcile',taskId:task.taskId,operationId:'cancel-original'}),{code:'OPERATION_CONFLICT'});
  await f.host.call('ipc',{op:'reconcile',taskId:task.taskId,operationId:'reconcile-original'});
  await assert.rejects(f.host.call('ipc',{op:'cancel',taskId:task.taskId,operationId:'reconcile-original'}),{code:'OPERATION_CONFLICT'});await dispatched(f);
});

test('reopened reconciliation retains the original operation; reads do not send browser commands',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);await f.host.call('ipc',{op:'reconcile',taskId:task.taskId,operationId:'retained-reconcile'});await dispatched(f);f.host.close();const before=f.calls.length;
  const reopened=new BrowserAdapterHost(f.options);t.after(()=>reopened.close());
  const receipt=await reopened.call('ipc',{op:'operation',taskId:task.taskId,operationId:'retained-reconcile'});assert.equal(receipt.state,'unknown');assert.equal(f.calls.length,before);
  await reopened.call('ipc',{op:'reconcile',taskId:task.taskId,operationId:'retained-reconcile'});await Promise.all([...reopened.jobs]);assert.equal(f.calls.at(-1).method,'output.subscribe');assert.equal(f.calls.filter(c=>c.method==='message.send').length,1);
});

test('an offline browser conversation keeps its completed result but does not advertise continuation',async t=>{
  const f=setup(t),task=await submit(f);await dispatched(f);await bind(f,task);await f.host.acceptEvent(incoming(f,task,'completed',2,{text:'Original answer'}));f.channel.online=false;
  const conversation=await f.host.call('ipc',{op:'conversation',conversationId:task.conversationId});assert.equal(conversation.canContinue,false);assert.equal(conversation.items[0].result.message,'Original answer');
  f.channel.online=true;assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:task.conversationId})).canContinue,true);
});
