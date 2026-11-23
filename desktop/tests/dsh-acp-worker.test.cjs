const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('../electron/acp-worker.cjs');

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
    if(mode==='cancel') {
      prompt=m.id;
      send({method:'session/request_permission',id:999,params:{sessionId:'owned-acp',options:[{optionId:'allow'}]}});
      fs.writeFileSync('cancel.json','{}');
    } else {
      send({id:m.id,result:{stopReason:'end_turn'}});
    }
  }
  if(m.method==='session/cancel') send({id:prompt,result:{stopReason:'cancelled'}});
  if(m.method==='session/close') send({id:m.id,result:{}});
});
`);
  const workspace = fs.realpathSync(dir);
  const generic=['load','no-resume','auth'].includes(mode);
  const job = { adapter:generic?'acp':'dsh-acp', profile:generic?'acp-stdio-v1':'desktop-acp-stdio-v1',requestId:'original-request', workspace, dshHome:workspace, executable:'native-dsh', message:'original prompt', sessionId };
  const wire = () => fs.readFileSync(capture,'utf8').trim().split('\n').map(JSON.parse);
  const events = () => fs.readFileSync(path.join(dir,'events.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const execute = () => run(job, dir, {
    write(file, value) { fs.writeFileSync(file, JSON.stringify(value)); },
    safe(value) { return value; },
    launchNative(executable, args, home, adapter) {
      assert.equal(executable, 'native-dsh'); assert.equal(home, workspace);
      assert.deepEqual(args, adapter==='acp'?[]:['--profile', 'acp']);
      return { executable:process.execPath, args:[worker,capture,mode], env:{...process.env,ELECTRON_RUN_AS_NODE:'1'} };
    },
  });
  return { execute, wire, events, workspace };
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
