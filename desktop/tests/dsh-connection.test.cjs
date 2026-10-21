const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const {configure, status, client, address} = require('../electron/dsh-connection.cjs');
const {NativeCliHost} = require('../electron/native-cli-host.cjs');
const {scanTools} = require('../electron/tool-discovery.cjs');
const {outcome} = require('../electron/dsh-worker.cjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function wait(fn) {for(let i = 0; i < 150; i++) {const r = await fn(); if(r) return r; await sleep(40);} throw Error('DSH fixture timeout');}
async function fixture(t, adapter = 'dsh-web', authStatus = 303) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-dsh-web-'));
  const sessions = new Map(), calls = []; let seq = 0, hold = false, drop = false;
  const add = (id, type, data) => sessions.get(id).push({seq: ++seq, time: Date.now(), type, data});
  const finish = (id, turn, message, reason = 'completed') => {add(id, 'assistant/message', {turn, message: {content: [{type: 'text', text: message + ' 中文 reply'}]}}); add(id, 'turn/end', {turn, reason: {kind: reason}});};
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET') { if(req.url === '/?token=synthetic-token') {res.writeHead(authStatus, {'set-cookie':'dsh-test=allowed; HttpOnly', location:'/'}); res.end();} else {res.writeHead(401);res.end();} return; }
    if(req.headers.cookie !== 'dsh-test=allowed') {res.writeHead(401);res.end();return;}
    let text = ''; for await (const part of req) text += part;
    const envelope = JSON.parse(text), method = envelope.method, parameter = method === 'session/list' ? '_request' : 'request';
    const parameters = envelope.payload?.args;
    if(!parameters || Object.keys(parameters).length !== 1 || typeof parameters[parameter] !== 'object' || parameters[parameter] === null) {
      res.setHeader('content-type','application/json');res.end(JSON.stringify({type:'server-response',rpcId:envelope.rpcId,result:{ok:false,error:{code:'gateway/bad-request'}}}));return;
    }
    const args = parameters[parameter];
    calls.push({method, args}); let value;
    if(method === 'session/list') value = {items: [...sessions.keys()].map(sessionId => ({sessionId}))};
    if(method === 'session/create') { const sessionId = 'session-' + sessions.size; sessions.set(sessionId, []); value = {sessionId}; }
    if(method === 'session/projections') value = {kind:'sequenced', asOfSeq: seq, values:{}};
    if(method === 'session/page') value = {records:sessions.get(args.address.sessionId).map(event=>({type:'event',event})), hasMore:false};
    if(method === 'session/prompt') {
      const turn = sessions.get(args.sessionId).filter(e => e.type === 'turn/start').length + 1;
      add(args.sessionId, 'turn/start', {turn});add(args.sessionId, 'user/message', {source:{kind:'user', rpcId:args.requestId}, content:args.content});
      if(!hold) finish(args.sessionId, turn, args.content[0].text);
      value = {accepted:true};
      if(drop) {req.socket.destroy(); return;}
    }
    if(method === 'session/cancel') {const turn = sessions.get(args.sessionId).filter(e => e.type === 'turn/start').length; finish(args.sessionId, turn, '', 'aborted');value={accepted:true};}
    res.setHeader('content-type', 'application/json');res.end(JSON.stringify({type:'server-response', rpcId:envelope.rpcId, result:{ok:true,value}}));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const item = configure({home:directory}, {adapter, url, token:'synthetic-token'}).items[0];
  const host = new NativeCliHost({directory:path.join(directory,'context'), adapter, executable:item.executable});
  const agent = await host.call('connect', {workspace:directory});
  t.after(async () => {
    host.close(); server.closeAllConnections();await new Promise(r=>server.close(r));
    const runs = path.join(directory,'context/runs');
    if(fs.existsSync(runs)) for(const name of fs.readdirSync(runs)) {
      const heartbeat=path.join(runs,name,'heartbeat.json');
      if(!fs.existsSync(heartbeat)) continue;
      const {pid}=JSON.parse(fs.readFileSync(heartbeat,'utf8'));
      await wait(()=>{try{process.kill(pid,0);return false;}catch{return true;}});
    }
    // Yield while Windows releases exited workers' file/directory handles.
    await fs.promises.rm(directory,{recursive:true,force:true,maxRetries:20,retryDelay:100});
  });
  return {directory, host, agent, calls, item, url, sessions, finish, hold:()=>{hold=true;}, drop:()=>{drop=true;}};
}
for(const adapter of ['dsh-desktop', 'dsh-web']) test(adapter + ' authenticates, discovers, runs and continues the original Session without configuration overrides or duplicate prompts', async t => {
  const f = await fixture(t, adapter);
  const found = await scanTools({home:f.directory,environment:{PATH:''},candidates:{claude:[],codex:[],opencode:[],hermes:[],pi:[],dsh:[]}});
  assert.equal(found.length,1);assert.equal(found[0].healthy,true);assert.equal(found[0].adapter,adapter);
  const input = {op:'submit',agentId:f.agent.agentId,requestId:'one',message:'literal $(no-shell) `x`'};
  const first=await f.host.call('ipc', input);
  const result=await wait(async()=>{const r=await f.host.call('ipc',{op:'task',taskId:first.taskId});return r.status==='succeeded'&&r;});
  assert.match(result.result.message,/中文 reply/);
  assert.equal((await f.host.call('ipc',input)).taskId,first.taskId);
  f.host.close();const observer = new NativeCliHost({directory:path.join(f.directory,'context'),adapter,executable:f.item.executable});t.after(()=>observer.close());
  const next=await observer.call('ipc',{op:'continue',conversationId:first.conversationId,requestId:'two',message:'next'});
  const second=await wait(async()=>{const r=await observer.call('ipc',{op:'task',taskId:next.taskId});return r.status==='succeeded'&&r;});
  assert.equal(second.native.sessionId,result.native.sessionId);
  assert.equal(f.calls.filter(c=>c.method==='session/create').length,1);
  assert.equal(f.calls.filter(c=>c.method==='session/prompt').length,2);
  assert(!JSON.stringify(await observer.call('snapshot')).includes('synthetic-token'));
  assert(!JSON.stringify(status({home:f.directory})).includes('synthetic-token'));
  assert(f.calls.every(c=>!['session/selectModel','credentials/set'].includes(c.method)));
});
test('DSH cancellation receipt waits for the original turn aborted event', async t => {
  const f=await fixture(t);f.hold();const first=await f.host.call('ipc',{op:'submit',agentId:f.agent.agentId,requestId:'cancel-me',message:'wait'});
  await wait(()=>f.calls.some(c=>c.method==='session/prompt'));
  assert.equal((await f.host.call('ipc',{op:'cancel',taskId:first.taskId,operationId:'cancel-original'})).state,'unknown');
  await wait(async()=> (await f.host.call('ipc',{op:'task',taskId:first.taskId})).status==='cancelled');
  assert.equal((await f.host.call('ipc',{op:'operation',operationId:'cancel-original'})).state,'confirmed');
  assert.equal(f.calls.filter(c=>c.method==='session/cancel').length,1);
});
test('DSH dropped prompt response remains occupied and recovers by reading original request without replay', async t => {
  const f=await fixture(t);f.drop();const first=await f.host.call('ipc',{op:'submit',agentId:f.agent.agentId,requestId:'lost',message:'once'});
  await wait(async()=> (await f.host.call('ipc',{op:'task',taskId:first.taskId})).status==='unknown');
  await assert.rejects(f.host.call('ipc',{op:'submit',agentId:f.agent.agentId,requestId:'replacement',message:'again'}),{code:'AGENT_BUSY'});
  const job=path.join(f.directory,'context','runs',first.taskId);
  await wait(()=>{try{process.kill(JSON.parse(fs.readFileSync(path.join(job,'heartbeat.json'))).pid,0);return false;}catch{return true;}});
  assert.equal((await f.host.call('ipc',{op:'reconcile',taskId:first.taskId,operationId:'read-original'})).state,'unknown');
  await wait(async()=> (await f.host.call('ipc',{op:'request',requestId:'lost'})).status==='succeeded');
  assert.equal(f.calls.filter(c=>c.method==='session/prompt').length,1);
  assert.equal((await f.host.call('ipc',{op:'operation',operationId:'read-original'})).state,'confirmed');
});
test('DSH connection identity and secret handling reject unsafe URLs and never redirect credentials', async t => {
  const f=await fixture(t);
  for(const url of ['file:///tmp/a','http://example.com/','http://user:secret@localhost/','http://localhost/api','http://localhost/?wrong=x']) assert.throws(()=>address(url),{code:'INVALID_INPUT'});
  configure({home:f.directory},{adapter:'dsh-web',url:f.url,token:'invalid'});
  await assert.rejects(client(f.item.executable),{code:'DSH_AUTH'});
  assert(!JSON.stringify(status({home:f.directory})).includes('invalid'));
  configure({home:f.directory},{adapter:'dsh-web',url:f.url,enabled:false});
  assert.equal(status({home:f.directory}).items[0].enabled,false);
});

test('DSH native authentication accepts cookie-bearing 302 and 303 only, without following redirects', async t => {
  for(const statusCode of [302,303,301,307,308,200]) {
    const f=await fixture(t,'dsh-web',statusCode);
    if([302,303].includes(statusCode)) assert.equal((await client(f.item.executable)).origin,new URL(f.url).origin);
    else await assert.rejects(client(f.item.executable),{code:'DSH_AUTH'});
    assert.equal(f.calls.length,0,'authentication must never follow into Session RPC or redirect target');
  }
});
test('DSH read-only observer launch failure cannot settle an already dispatched unknown execution', async t => {
  const f=await fixture(t);f.drop();const first=await f.host.call('ipc',{op:'submit',agentId:f.agent.agentId,requestId:'lost-observer',message:'once'});
  await wait(async()=> (await f.host.call('ipc',{op:'task',taskId:first.taskId})).status==='unknown');
  const heartbeat=path.join(f.directory,'context','runs',first.taskId,'heartbeat.json');
  await wait(()=>{try{process.kill(JSON.parse(fs.readFileSync(heartbeat)).pid,0);return false;}catch{return true;}});
  const mkdir=fs.mkdirSync;
  fs.mkdirSync=(directory,...args)=>{if(String(directory).includes('native-'))throw Object.assign(Error('controlled observer launch failure'),{code:'EPERM'});return mkdir(directory,...args);};
  try {assert.equal((await f.host.call('ipc',{op:'reconcile',taskId:first.taskId,operationId:'observe-once'})).state,'unknown');}
  finally {fs.mkdirSync=mkdir;}
  assert.equal((await f.host.call('ipc',{op:'request',requestId:'lost-observer'})).status,'unknown');
  assert.equal(f.calls.filter(c=>c.method==='session/prompt').length,1);
});
test('DSH never settles from old turns, another request, or a completed receipt', () => {
  const rows=[{seq:1,type:'turn/start',data:{turn:1}},{seq:2,type:'user/message',data:{source:{rpcId:'foreign'}}},{seq:3,type:'turn/end',data:{turn:1,reason:{kind:'completed'}}}];
  assert.equal(outcome(rows,'original',0).reason,undefined);
  assert.equal(outcome(rows,'foreign',3).reason,undefined);
  assert.equal(outcome([{seq:1,type:'user/message',data:{source:{rpcId:'original'}}}], 'original',0).reason,undefined);
});

test('installed Windows Desktop is discoverable without CLI or token, with configuration guidance', async t => {
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'ab-desktop-install-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const local=path.join(home,'Local'),app=path.join(local,'Programs/DSH Desktop');
  fs.mkdirSync(path.join(app,'resources/app'),{recursive:true});
  const executable=path.join(app,'DSH Desktop.exe');fs.writeFileSync(executable,'must never launch');
  fs.writeFileSync(path.join(app,'resources/app/package.json'),JSON.stringify({name:'dsh-plugin-desktop',version:'2.0.18'}));
  const options={home,platform:'win32',environment:{Path:'',LOCALAPPDATA:local},candidates:{claude:[],codex:[],opencode:[],hermes:[],pi:[],dsh:[]}};
  const items=await scanTools(options);assert.equal(items.length,1);assert.equal(items[0].adapter,'dsh-desktop');
  assert.equal(items[0].executable,executable);assert.equal(items[0].version,'2.0.18');assert.equal(items[0].healthy,false);assert.equal(items[0].errorCode,'DSH_CONNECTION_REQUIRED');assert.match(items[0].error,/连接 token/);
  configure({home},{adapter:'dsh-desktop',url:'http://127.0.0.1:12345/',token:'synthetic-token',enabled:false});
  assert.deepEqual(await scanTools(options),[],'disabled service must not reappear as an unconfigured installation');
});

test('Linux Web profile is a configuration hint without reading native credentials or launching dsh', async t => {
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'ab-web-install-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  for(const custom of [false,true]) {
    const root=custom?path.join(home,'custom-dsh'):path.join(home,'.dsh'),profile=path.join(root,'profiles/web');
    fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(path.join(profile,'package.json'),JSON.stringify({name:'dsh-profile-web'}));
    const options={home,platform:'linux',environment:{PATH:'',...(custom?{DSH_HOME:root}:{})},candidates:{claude:[],codex:[],opencode:[],hermes:[],pi:[],dsh:[]}};
    const items=await scanTools(options);assert.equal(items.length,1);assert.equal(items[0].adapter,'dsh-web');assert.equal(items[0].healthy,false);assert.equal(items[0].errorCode,'DSH_CONNECTION_REQUIRED');
    assert.equal(items[0].executable,path.join(profile,'package.json'));assert.match(items[0].error,/本机器.*连接 token/);
    fs.writeFileSync(path.join(profile,'package.json'),JSON.stringify({name:'unrelated'}));
    assert.deepEqual(await scanTools(options),[]);
  }
  fs.writeFileSync(path.join(home,'.dsh/profiles/web/package.json'),JSON.stringify({name:'dsh-profile-web'}));
  configure({home},{adapter:'dsh-web',url:'http://127.0.0.1:12345/',token:'synthetic-token',enabled:false});
  const items=await scanTools({home,platform:'linux',environment:{PATH:''},candidates:{claude:[],codex:[],opencode:[],hermes:[],pi:[],dsh:[]}});
  assert.deepEqual(items,[],'disabled service must not reappear as a profile hint');
});
test('DSH damaged connection is isolated from other discovered tools and secrets never enter coordinator journals', async t => {
  const f = await fixture(t);
  fs.writeFileSync(f.item.executable, '{broken');
  const found = await scanTools({home:f.directory,environment:{PATH:''},candidates:{claude:[],codex:[],opencode:[],hermes:[],pi:[],dsh:[]}});
  assert.equal(found.length, 1); assert.equal(found[0].healthy, false);
  const {MachineHost} = require('../electron/machine-host.cjs');
  const {AgentNetwork} = require('../electron/agent-network.cjs');
  const {createCoordinatorService} = require('../electron/coordinator-service.cjs');
  const home = path.join(f.directory,'private-home');
  const directory = path.join(f.directory,'coordinator');
  const network = new AgentNetwork({directory, platform:'linux', createHost:()=>new MachineHost({directory:path.join(directory,'machine'),home,legacy:{close(){}}})});
  const service = createCoordinatorService({directory, network, teamTickMs:600000});t.after(()=>service.close());
  const machineId = network.catalog.localMachineId;
  const result = await service.call({method:'dsh.configure', params:{machineId,adapter:'dsh-web',url:f.url,token:'synthetic-new-token'}});
  assert.equal(result.ok,true);assert(!JSON.stringify(result).includes('synthetic-new-token'));
  const check = await service.call({method:'dsh.status',params:{machineId}});assert.equal(check.result.items.length,1);
  for(const name of ['pending.json','runtime.json','machine-history.json','network.json']) if(fs.existsSync(path.join(directory,name))) assert(!fs.readFileSync(path.join(directory,name),'utf8').includes('synthetic-new-token'));
  assert.equal((await service.call({method:'dsh.status',params:{machineId:'foreign'}})).ok,false);
});
