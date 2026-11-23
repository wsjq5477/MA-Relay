const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, pendingPermissionFile } = require('../electron/acp-worker.cjs');

function fixture(t, mode, sessionId) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-dsh-acp-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const capture = path.join(dir, 'wire.jsonl');
  const worker = path.join(dir, 'server.cjs');
  fs.writeFileSync(worker, `
const fs=require('node:fs');
const readline=require('node:readline');
const [capture,mode]=process.argv.slice(2);
const send=x=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',...x})+'\\n');
let prompt;
readline.createInterface({input:process.stdin}).on('line',line=>{
  const m=JSON.parse(line);
  fs.appendFileSync(capture,line+'\\n');
  if(m.method==='initialize') send({id:m.id,result:{protocolVersion:1,agentCapabilities:mode==='load'?{loadSession:true}:mode==='no-resume'?{}:{sessionCapabilities:{resume:{},close:{}}}}});
  if(m.method==='session/load') send({id:m.id,result:null});
  if(m.method==='session/new') {
    if(mode==='auth')send({id:m.id,error:{code:-32000,message:'Authentication required'}});
    else send({id:m.id,result:{sessionId:'owned-acp'}});
  }
  if(m.method==='session/resume') send({id:m.id,result:mode==='wrong-session'?{sessionId:'foreign'}:{}});
  if(m.method==='session/prompt'){
    if(mode==='lost') process.exit(0);
    function update(sessionId,text) {
      send({method:'session/update',params:{sessionId,update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text}}}});
    }
    update('foreign','foreign content');
    update('owned-acp','first ');
    update('owned-acp','second');
    if(mode==='permission-cancel'||mode==='only-persistent'){
      prompt=m.id;
      const options=[{kind:'allow_always',optionId:'persistent'},{kind:'reject_always',optionId:'persistent-reject'}];
      if(mode==='permission-cancel')options.unshift({kind:'allow_once',optionId:'one'});
      send({method:'session/request_permission',id:998,params:{sessionId:'owned-acp',toolCall:{toolCallId:'read-one',kind:'read',title:'Read test fixture'},options}});
    } else if(mode==='dsh-shell-permission'||mode==='dsh-shell-incomplete') {
      prompt=m.id;
      const toolCallId='shell-one';
      const toolCall={toolCallId,kind:'other',title:'pwsh'};
      if(mode==='dsh-shell-permission')toolCall.rawInput={command:'echo AB_PERMISSION_TEST'};
      send({method:'session/update',params:{sessionId:'owned-acp',update:{sessionUpdate:'tool_call',...toolCall}}});
      const options=[{kind:'allow_once',optionId:'one'},{kind:'reject_once',optionId:'no'}];
      send({method:'session/request_permission',id:997,params:{sessionId:'owned-acp',toolCall:{toolCallId},options}});
    } else if(mode==='cancel') {
      prompt=m.id;
      send({method:'session/request_permission',id:999,params:{sessionId:'owned-acp',options:[{optionId:'allow'}]}});
      fs.writeFileSync('cancel.json','{}');
    } else {
      send({id:m.id,result:{stopReason:'end_turn'}});
    }
  }
  if(m.id===997||m.id===998&&mode==='only-persistent')send({id:prompt,result:{stopReason:'end_turn'}});
  if(m.method==='session/cancel') send({id:prompt,result:{stopReason:'cancelled'}});
  if(m.method==='session/close') send({id:m.id,result:{}});
});
`);
  const workspace = fs.realpathSync(dir);
  const generic=['load','no-resume','auth'].includes(mode);
  const job = { adapter:generic?'acp':'dsh-acp', profile:generic?'acp-stdio-v1':'desktop-acp-stdio-v1',requestId:'original-request', workspace, dshHome:workspace, executable:'native-dsh', message:'original prompt', sessionId };
  const wire = () => fs.readFileSync(capture,'utf8').trim().split('\n').map(JSON.parse);
  const eventFile = path.join(dir,'events.jsonl');
  const events = () => fs.existsSync(eventFile) ? fs.readFileSync(eventFile,'utf8').trim().split('\n').map(JSON.parse) : [];
  const execute = () => run(job, dir, {
    write(file, value) { fs.writeFileSync(file, JSON.stringify(value)); },
    safe(value) { return value; },
    launchNative(executable, args, home, adapter) {
      assert.equal(executable, 'native-dsh'); assert.equal(home, workspace);
      assert.deepEqual(args, adapter==='acp'?[]:['--profile', 'acp']);
      return { executable:process.execPath, args:[worker,capture,mode], env:{...process.env,ELECTRON_RUN_AS_NODE:'1'} };
    },
  });
  return { execute, wire, events, workspace,
    pending(id) { return JSON.parse(fs.readFileSync(pendingPermissionFile(dir,id),'utf8')); },
    reply(id, decision) { fs.writeFileSync(path.join(dir,'permission-'+id+'.json'),JSON.stringify({operationId:'permission-decision',decision})); },
    cancel() { fs.writeFileSync(path.join(dir,'cancel.json'),'{}'); },
  };
}

test('DSH ACP starts and resumes the original session with only its streamed text', async t => {
  for (const sessionId of [undefined, 'owned-acp']) {
    const f = fixture(t, 'ok', sessionId);
    await f.execute();
    const bind = f.wire().find(row => row.method === (sessionId ? 'session/resume' : 'session/new'));
    assert.deepEqual(bind.params, { cwd:f.workspace, mcpServers:[], ...(sessionId ? {sessionId} : {}) });
    assert.equal(f.wire().filter(row => row.method === 'session/prompt').length, 1);
    assert.deepEqual(f.events().find(row => row.kind === 'native'), {kind:'native',sessionId:'owned-acp'});
    assert.deepEqual(f.events().at(-1), {kind:'terminal',status:'succeeded',text:'first second'});
  }
});

test('DSH ACP refuses an altered session before prompting', async t => {
  const f = fixture(t, 'wrong-session', 'owned-acp');
  await f.execute();
  assert.equal(f.wire().some(row => row.method === 'session/prompt'), false);
  assert.equal(f.events().at(-1).status, 'failed');
  assert.equal(f.events().at(-1).code, 'CONVERSATION_CONFIG');
});

test('DSH ACP holds a disconnected prompt as unknown with one original send', async t => {
  const f = fixture(t, 'lost');
  await f.execute();
  assert.equal(f.wire().filter(row => row.method === 'session/prompt').length, 1);
  assert.equal(f.events().at(-1).kind, 'unknown');
  assert.match(f.events().at(-1).text,/原生 ACP 通道已断开/);
  assert.equal(f.events().some(row => row.kind === 'terminal'), false);
});

test('DSH ACP declines unsolicited permission and waits for the original cancel terminal', async t => {
  const f = fixture(t, 'cancel');
  await f.execute();
  const denied = f.wire().find(row => row.id === 999);
  assert.deepEqual(denied.result, {outcome:{outcome:'cancelled'}});
  const cancellations = f.wire().filter(row => row.method === 'session/cancel');
  assert.equal(cancellations.length, 1);
  assert.equal(cancellations[0].params.sessionId, 'owned-acp');
  assert.equal(f.events().at(-1).status, 'cancelled');
});

test('generic ACP loads the original ID only when the agent advertises it', async t => {
  const allowed=fixture(t,'load','owned-acp');
  await allowed.execute();
  assert.deepEqual(allowed.wire().find(row=>row.method==='session/load').params,{sessionId:'owned-acp',cwd:allowed.workspace,mcpServers:[]});
  assert.equal(allowed.events().at(-1).status,'succeeded');
  const refused=fixture(t,'no-resume','owned-acp');
  await refused.execute();
  assert.deepEqual(refused.wire().map(row=>row.method),['initialize']);
  assert.equal(refused.events().at(-1).code,'CONVERSATION_CONFIG');
});

test('ACP reports native login requirements before sending a prompt', async t => {
  const f = fixture(t, 'auth');
  await f.execute();
  assert.deepEqual(f.wire().map(row => row.method), ['initialize', 'session/new']);
  assert.equal(f.events().at(-1).status, 'failed');
  assert.equal(f.events().at(-1).code, 'ACP_AUTH_REQUIRED');
});

async function waitingPermission(f) {
  const deadline = Date.now() + 6000;
  do {
    const match = f.events().find(event => event.kind === 'permission');
    if (match) return f.pending(match.id);
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (Date.now() < deadline);
  throw Error('Expected native permission request');
}

test('DSH ACP never selects permanent options for a one-time decision', {timeout:15000}, async t => {
  const f = fixture(t, 'only-persistent');
  const running = f.execute();
  const permission = await waitingPermission(f);
  assert.equal(permission.canAllowOnce,false);
  f.reply(permission.id,'reject');
  await running;
  assert.deepEqual(f.wire().find(row=>row.id===998).result,{outcome:{outcome:'cancelled'}});
  const receipt = f.events().find(row=>row.kind==='permission_receipt');
  assert.equal(receipt.state,'confirmed');
  assert.equal(receipt.operationId,'permission-decision');
});

test('DSH ACP displays the full command for a generic native PowerShell request', {timeout:15000}, async t => {
  const f = fixture(t, 'dsh-shell-permission');
  const running = f.execute();
  const permission = await waitingPermission(f);
  assert.deepEqual(permission.resources,['pwsh','echo AB_PERMISSION_TEST']);
  assert.equal(permission.canAllowOnce,true);
  f.reply(permission.id,'once');
  await running;
  assert.deepEqual(f.wire().find(row=>row.id===997).result,{outcome:{outcome:'selected',optionId:'one'}});
});

test('DSH ACP blocks approval when a native PowerShell request omits its command', {timeout:15000}, async t => {
  const f = fixture(t, 'dsh-shell-incomplete');
  const running = f.execute();
  const permission = await waitingPermission(f);
  assert.deepEqual(permission.resources,['pwsh']);
  assert.equal(permission.canAllowOnce,false);
  f.reply(permission.id,'reject');
  await running;
  assert.deepEqual(f.wire().find(row=>row.id===997).result,{outcome:{outcome:'selected',optionId:'no'}});
});

test('DSH ACP cancels the waiting permission before cancelling the original prompt', {timeout:15000}, async t => {
  const f = fixture(t, 'permission-cancel');
  const running = f.execute();
  const permission = await waitingPermission(f);
  assert.equal(permission.canAllowOnce,true);
  f.cancel();
  f.reply(permission.id,'once');
  await running;
  const frames = f.wire();
  const permissionReply = frames.findIndex(row=>row.id===998);
  const cancel = frames.findIndex(row=>row.method==='session/cancel');
  assert.ok(permissionReply >= 0 && cancel > permissionReply);
  assert.deepEqual(frames[permissionReply].result,{outcome:{outcome:'cancelled'}});
  assert.equal(f.events().at(-1).status,'cancelled');
});

test('the terminal task does not confirm a reply without an ACP write receipt', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'ab-acp-reply-receipt-'));
  const {NativeCliHost} = require('../electron/native-cli-host.cjs');
  const host = new NativeCliHost({directory,adapter:'acp'});
  t.after(() => {
    host.close();
    fs.rmSync(directory,{recursive:true,force:true});
  });
  const taskId = 'original-acp-task';
  const run = path.join(directory,'runs',taskId);
  fs.mkdirSync(run,{recursive:true});
  host.state.tasks.push({taskId,status:'running',lastSeq:0,events:[],permissions:['pending-id']});
  host.state.operations.push({taskId,kind:'reply',operationId:'uncertain-reply',requestId:'pending-id',state:'unknown'});
  fs.writeFileSync(path.join(run,'events.jsonl'),JSON.stringify({kind:'terminal',status:'succeeded',text:'response'})+'\n');
  const operation = await host.call('ipc',{op:'operation',taskId,operationId:'uncertain-reply'});
  assert.equal(operation.state,'unknown');
  assert.equal((await host.call('ipc',{op:'task',taskId})).status,'succeeded');
  assert.deepEqual(await host.call('ipc',{op:'pending',taskId}),{permissions:[],forms:[]});
});
