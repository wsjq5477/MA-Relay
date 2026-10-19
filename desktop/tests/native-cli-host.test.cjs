const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { NativeCliHost } = require('../electron/native-cli-host.cjs');
const { MachineHost } = require('../electron/machine-host.cjs');
const { profiles, argumentsFor } = require('../electron/native-cli-protocols.cjs');
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const terminal = status => ['succeeded', 'failed', 'cancelled'].includes(status);
async function done(host, taskId) {
  for (let attempt = 0; attempt < 150; attempt++) { const task = await host.call('ipc', { op: 'task', taskId }); if (terminal(task.status)) return task; await delay(30); }
  throw Error('native fixture timeout');
}
function fixture(t, adapter) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-' + adapter + '-')), executable = path.join(directory, adapter + '.cjs'), calls = path.join(directory, 'calls.jsonl');
  fs.writeFileSync(executable, `
const fs = require('node:fs'), path = require('node:path');
const args = process.argv.slice(2), adapter = ${JSON.stringify(adapter)}, calls = ${JSON.stringify(calls)};
if(args.includes('--version')) { console.log(adapter + ' 1.0.0'); process.exit(0); }
let prompt = '';
process.stdin.setEncoding('utf8'); process.stdin.on('data', part => prompt += part);
process.stdin.on('end', () => {
  fs.appendFileSync(calls, JSON.stringify({args,prompt,cwd:process.cwd()}) + '\\n');
  let id = adapter + '-session';
  if(adapter === 'pi') {
    const directory = args[args.indexOf('--session-dir') + 1]; fs.mkdirSync(directory, {recursive:true});
    if(args.includes('--session')) id = JSON.parse(fs.readFileSync(args[args.indexOf('--session')+1], 'utf8').split('\\n')[0]).id;
    else fs.writeFileSync(path.join(directory, 'session.jsonl'), JSON.stringify({type:'session', id, cwd:process.cwd()})+'\\n');
  } else if(adapter === 'hermes' && args.includes('--resume')) id = args[args.indexOf('--resume')+1];
  else if(adapter === 'dsh' && args.includes('--session-id')) id = args[args.indexOf('--session-id')+1];
  if(prompt === 'mismatch') id = 'foreign-session';
  if(prompt === 'blank-session') id = '   ';
  const emit = event => process.stdout.write(JSON.stringify(event) + '\\n');
  if(adapter === 'hermes') emit({type:'system',subtype:'init',session_id:id});
  if(adapter === 'pi') emit({type:'session',version:3,id,cwd:process.cwd()});
  if(adapter === 'dsh') emit({type:'session',sessionId:id,cwd:process.cwd()});
  if(prompt === 'oversized') { process.on('SIGTERM',()=>{}); process.stdout.write('x'.repeat(4*1024*1024+1)); setInterval(()=>{},1000); return; }
  if(prompt === 'wait' || prompt === 'ignore-term') { if(prompt==='ignore-term') process.on('SIGTERM',()=>{}); setInterval(()=>{},1000); return; }
  if(prompt === 'malformed') process.stdout.write('not-json\\n');
  if(prompt === 'no-terminal') return;
  const answer = prompt + ' reply';
  if(adapter === 'hermes') {
    emit({type:'text',text:prompt}); emit({type:'text',text:' reply'});
    emit({type:'tool_use',name:'read'});
    emit({type:'result',session_id:id,exit_code:prompt==='fail'?1:0,text:answer,...(prompt==='fail'?{error:'native failure'}:{})});
  }
  if(adapter === 'pi') {
    emit({type:'message_update',assistantMessageEvent:{type:'text_delta',delta:prompt}});
    emit({type:'message_end',message:{role:'assistant',content:[{type:'text',text:answer}],stopReason:prompt==='fail'?'error':'stop',...(prompt==='fail'?{errorMessage:'native failure'}:{})}});
    emit({type:'agent_end',messages:[],willRetry:false}); emit({type:'agent_settled',aborted:false});
  }
  if(adapter === 'dsh') {
    emit({type:'text',text:answer});
    emit({type:'status',phase:'turn_end',reason:prompt==='fail'?{kind:'error',error:{message:'native failure'}}:{kind:'completed'}});
    emit({type:'final',text:answer});
  }
  if(prompt === 'late-error') emit({type:'error',message:'explicit late native error'});
  if(prompt === 'cancel-race') process.on('SIGTERM',()=>process.exit(0));
  if(prompt === 'cancel-race') setTimeout(()=>process.exit(0),500);
});
`);
  const host = new NativeCliHost({ directory, executable, adapter });
  t.after(async () => { try { const snapshot = await host.call('snapshot'); for (const task of snapshot.tasks.filter(item => !terminal(item.status))) { await host.call('ipc', {op:'cancel',taskId:task.taskId,operationId:'cleanup-'+task.taskId}); await done(host,task.taskId); } } finally { host.close(); fs.rmSync(directory,{recursive:true,force:true}); } });
  return { host, directory, executable, calls };
}
async function connected(f) { return f.host.call('connect', { workspace:f.directory }); }
function callLog(f) { return fs.readFileSync(f.calls,'utf8').trim().split('\n').map(JSON.parse); }
for (const adapter of ['hermes','pi','dsh']) {
  test(adapter + ' uses its actual protocol, preserves prompt/config, deduplicates and resumes the exact native session across observer restart', async t => {
    const f = fixture(t,adapter), agent = await connected(f), message = 'hello\u2028literal $(no-shell) `quote` 中文';
    const params = {op:'submit',agentId:agent.agentId,requestId:'one',message};
    const first = await f.host.call('ipc',params), result = await done(f.host,first.taskId);
    assert.equal(result.status,'succeeded'); assert.equal(result.result.message,message+' reply'); assert.equal(result.native.sessionId,adapter+'-session');
    assert.equal((await f.host.call('ipc',params)).taskId,first.taskId);
    await assert.rejects(f.host.call('ipc',{...params,message:'changed'}),{code:'REQUEST_CONFLICT'});
    assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:first.conversationId})).canContinue,true);
    f.host.close(); const reopened = new NativeCliHost({directory:f.directory,executable:f.executable,adapter}); t.after(()=>reopened.close());
    const next = await reopened.call('ipc',{op:'continue',conversationId:first.conversationId,requestId:'two',message:'next'});
    const second = await done(reopened,next.taskId); assert.equal(second.native.sessionId,result.native.sessionId);
    const calls = callLog(f); assert.equal(calls.length,2); assert.equal(calls[0].prompt,message);
    assert(!calls.some(call=>call.args.some(arg=>['--model','--provider','--api-key','--yolo','--yes','--no-session'].includes(arg))));
    if(adapter==='hermes') { assert.deepEqual(calls[0].args,['chat','--query-file','-','--format','stream-json','--no-restore-cwd']); assert(calls[1].args.includes('--resume')); assert(calls[1].args.includes(adapter+'-session')); }
    if(adapter==='pi') { assert(calls[0].args.includes('--mode')); const sessionFile=calls[1].args[calls[1].args.indexOf('--session')+1]; assert(path.isAbsolute(sessionFile)); assert.equal(JSON.parse(fs.readFileSync(sessionFile,'utf8').split('\n')[0]).id,result.native.sessionId); }
    if(adapter==='dsh') { assert.deepEqual(calls[0].args,['--profile','headless','--json','-']); assert(calls[1].args.includes('--session-id')); assert(calls[1].args.includes(adapter+'-session')); }
    assert.equal((await reopened.call('ipc',{op:'request',requestId:'one'})).taskId,first.taskId); assert.equal(callLog(f).length,2);
  });
  test(adapter + ' native error/malformed/absent completion/blank session cannot become success with process exit zero', async t => {
    const f=fixture(t,adapter),agent=await connected(f);
    for(const message of ['fail','late-error','malformed','no-terminal','blank-session']) {
      const first=await f.host.call('ipc',{op:'submit',agentId:agent.agentId,requestId:message,message}); const result=await done(f.host,first.taskId);
      assert.equal(result.status,'failed',message); assert.equal(result.result,undefined);
      assert.equal((await f.host.call('ipc',{op:'request',requestId:message})).status,'failed');
    }
    assert.equal(callLog(f).length,5);
  });
  test(adapter + ' cancel receipt stays unknown until owned process exits; native success wins a natural exit race', async t => {
    const f=fixture(t,adapter),agent=await connected(f);
    const first=await f.host.call('ipc',{op:'submit',agentId:agent.agentId,requestId:'wait',message:'wait'});
    while(!fs.existsSync(f.calls)) await delay(20);
    assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:first.conversationId})).canContinue,false);
    const receipt=await f.host.call('ipc',{op:'cancel',taskId:first.taskId,operationId:'cancel'}); assert.equal(receipt.state,'unknown');
    await assert.rejects(f.host.call('ipc',{op:'cancel',taskId:first.taskId,operationId:'replacement-cancel'}),{code:'REQUEST_CLAIMED'});
    assert.equal((await done(f.host,first.taskId)).status,'cancelled');
    assert.equal((await f.host.call('ipc',{op:'operation',operationId:'cancel'})).state,'confirmed');
    const next=await f.host.call('ipc',{op:'submit',agentId:agent.agentId,requestId:'race',message:'cancel-race'});
    while(callLog(f).length<2) await delay(20);
    await f.host.call('ipc',{op:'cancel',taskId:next.taskId,operationId:'race-cancel'});
    assert.equal((await done(f.host,next.taskId)).status,'succeeded');
    await assert.rejects(f.host.call('ipc',{op:'cancel',taskId:next.taskId,operationId:'cancel'}),{code:'REQUEST_CONFLICT'});
  });
  test(adapter + ' wrong native session keeps original binding and disables continuation; capability claims are explicit', async t => {
    const f=fixture(t,adapter),agent=await connected(f);
    const one=await f.host.call('ipc',{op:'submit',agentId:agent.agentId,requestId:'one',message:'hello'}); await done(f.host,one.taskId);
    const second=await f.host.call('ipc',{op:'continue',conversationId:one.conversationId,requestId:'two',message:'mismatch'});
    assert.equal((await done(f.host,second.taskId)).status,'failed');
    assert.equal((await f.host.call('ipc',{op:'continue',conversationId:one.conversationId,requestId:'two',message:'mismatch'})).taskId,second.taskId);
    const conversation=await f.host.call('ipc',{op:'conversation',conversationId:one.conversationId}); assert.equal(conversation.canContinue,false);
    await assert.rejects(f.host.call('ipc',{op:'continue',conversationId:one.conversationId,requestId:'three',message:'next'}),{code:'CONVERSATION_CONFIG'});
    const snapshot=await f.host.call('snapshot'); assert.equal(snapshot.agents.items[0].capabilities.permissions,false); assert.equal(snapshot.agents.items[0].capabilities.teamCollaboration,false);
    await assert.rejects(f.host.call('ipc',{op:'submit',agentId:agent.agentId,requestId:'scope',message:'hello',mcp:{command:'native'}}),{code:'ADAPTER_UNSUPPORTED'});
    await assert.rejects(f.host.call('ipc',{op:'submit',agentId:agent.agentId,requestId:'override',message:'hello',model:'other'}),{code:'INVALID_INPUT'});
    assert.equal(callLog(f).length,2);
  });
}
test('Pi refuses a missing persisted native file before dispatch rather than creating an empty session', async t => {
  const f=fixture(t,'pi'),agent=await connected(f),first=await f.host.call('ipc',{op:'submit',agentId:agent.agentId,requestId:'one',message:'hello'}); await done(f.host,first.taskId);
  const sessionDirectory=path.join(f.directory,'native-sessions'), original=path.join(sessionDirectory,'session.jsonl'), duplicate=path.join(sessionDirectory,'duplicate.jsonl');
  fs.copyFileSync(original,duplicate);
  assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:first.conversationId})).canContinue,false);
  await assert.rejects(f.host.call('ipc',{op:'continue',conversationId:first.conversationId,requestId:'duplicate',message:'next'}),{code:'CONVERSATION_CONFIG'});
  fs.rmSync(duplicate);assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:first.conversationId})).canContinue,true);
  fs.rmSync(sessionDirectory,{recursive:true});
  assert.equal((await f.host.call('snapshot')).conversations[0].canContinue,false);
  await assert.rejects(f.host.call('ipc',{op:'continue',conversationId:first.conversationId,requestId:'two',message:'next'}),{code:'CONVERSATION_CONFIG'});
  assert.equal(callLog(f).length,1);
});
test('missing original worker evidence stays unknown, occupied and read-only across restart', async t => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-native-unknown-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const task={taskId:'original-task',executionId:'original-exec',requestId:'original',conversationId:'original-conversation',targetAgent:'pi-agent',status:'unknown',createdAt:'2000-01-01T00:00:00.000Z',updatedAt:'2000-01-01T00:00:00.000Z',lastSeq:1,events:[{seq:1,event:{kind:'accepted'}}],offset:0};
  fs.writeFileSync(path.join(directory,'pi-state.json'),JSON.stringify({revision:1,agents:[{agentId:'pi-agent',workspace:directory}],tasks:[task],conversations:[{conversationId:task.conversationId,targetAgent:task.targetAgent,lastTaskId:task.taskId,sessionId:'original-native',profile:profiles.pi}],requests:[{requestId:'original',taskId:task.taskId}],operations:[]}));
  const host=new NativeCliHost({directory,executable:'/missing/pi',adapter:'pi'});t.after(()=>host.close());
  assert.equal((await host.call('ipc',{op:'request',requestId:'original'})).status,'unknown');
  assert.equal((await host.call('ipc',{op:'reconcile',taskId:task.taskId})).state,'unknown');
  const snapshot=await host.call('snapshot');assert.equal(snapshot.agents.items[0].busy,true);assert.equal(snapshot.conversations[0].canContinue,false);
  await assert.rejects(host.call('ipc',{op:'submit',agentId:task.targetAgent,requestId:'new',message:'new'}),{code:'AGENT_BUSY'});
  assert(!fs.existsSync(path.join(directory,'runs')));
});
test('MachineHost registry rejects unknown adapters and exposes new backends without claiming MCP collaboration', async t => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-machine-adapters-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const host=new MachineHost({directory,legacy:{close(){},async call(){return {agents:{items:[]},tasks:[],conversations:[]};}}});t.after(()=>host.close());
  assert.throws(()=>host.backend({adapter:'unregistered',contextId:'foreign',executable:'/never/codex'}),{code:'ADAPTER_UNSUPPORTED'});
  for(const adapter of ['hermes','pi','dsh']) {
    host.discover=async()=>({items:[{adapter,name:adapter,executable:'/native/'+adapter,healthy:true,executionSupported:true}]});
    const context=await host.context({nodeId:adapter,adapter,executable:'/native/'+adapter});assert.equal(context.adapter,adapter);assert.equal(context.teamCollaboration,false);
    host.discover=async()=>({items:[{adapter,name:adapter,executable:'/moved/'+adapter,healthy:true,executionSupported:true}]});
    const upgraded=await host.context({nodeId:adapter,adapter,executable:'/moved/'+adapter});
    assert.notEqual(upgraded.contextId,context.contextId);
    assert.equal(host.rows.find(row=>row.contextId===context.contextId).executable,'/native/'+adapter);
    assert.equal(host.rows.find(row=>row.contextId===upgraded.contextId).executable,'/moved/'+adapter);
    await assert.rejects(host.call('scope',{contextId:context.contextId,scope:{}}),{code:'ADAPTER_UNSUPPORTED'});
    assert(!fs.existsSync(path.join(directory,'node-contexts',context.contextId,'mcp.json')));
  }
});
test('native command profiles are immutable and no unsupported adapter defaults to another CLI', () => {
  assert.throws(()=>argumentsFor({adapter:'foreign',profile:profiles.pi}),{code:'CONVERSATION_CONFIG'});
  assert.throws(()=>argumentsFor({adapter:'dsh',profile:'other'}),{code:'CONVERSATION_CONFIG'});
});
test('detached Pi execution survives observer close and SIGTERM-resistant process cancellation escalates before confirmation', async t => {
  const f=fixture(t,'pi'),agent=await connected(f),first=await f.host.call('ipc',{op:'submit',agentId:agent.agentId,requestId:'one',message:'ignore-term'});
  while(!fs.existsSync(f.calls)) await delay(20);
  f.host.close();const reopened=new NativeCliHost({directory:f.directory,adapter:'pi',executable:f.executable});t.after(()=>reopened.close());
  assert.equal((await reopened.call('ipc',{op:'request',requestId:'one'})).taskId,first.taskId);
  const receipt=await reopened.call('ipc',{op:'cancel',taskId:first.taskId,operationId:'original-cancel'});assert.equal(receipt.state,'unknown');
  await delay(300);assert.equal((await reopened.call('ipc',{op:'operation',operationId:'original-cancel'})).state,'unknown');
  assert.equal((await done(reopened,first.taskId)).status,'cancelled');
  assert.equal((await reopened.call('ipc',{op:'operation',operationId:'original-cancel'})).state,'confirmed');
  assert.equal(callLog(f).length,1);
});

test('an active unrelated conversation keeps older native sessions unavailable for continuation', async t => {
  const f=fixture(t,'hermes'),agent=await connected(f),first=await f.host.call('ipc',{op:'submit',agentId:agent.agentId,requestId:'one',message:'hello'});await done(f.host,first.taskId);
  const active=await f.host.call('ipc',{op:'submit',agentId:agent.agentId,requestId:'two',message:'wait'});
  const snapshot=await f.host.call('snapshot');assert(snapshot.conversations.every(item=>item.canContinue===false));
  await assert.rejects(f.host.call('ipc',{op:'continue',conversationId:first.conversationId,requestId:'three',message:'next'}),{code:'AGENT_BUSY'});
  await f.host.call('ipc',{op:'cancel',taskId:active.taskId,operationId:'cancel-active'});await done(f.host,active.taskId);
});

test('oversized protocol records terminate a SIGTERM-resistant owned process and retain an explicit failure', async t => {
  const f=fixture(t,'hermes'),agent=await connected(f),first=await f.host.call('ipc',{op:'submit',agentId:agent.agentId,requestId:'oversized',message:'oversized'});
  const result=await done(f.host,first.taskId);assert.equal(result.status,'failed');assert.match(result.error.message,/4 MiB/);assert.equal(result.result,undefined);
  assert.equal(callLog(f).length,1);
});
