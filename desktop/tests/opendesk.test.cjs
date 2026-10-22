const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const {randomUUID,randomBytes} = require('node:crypto');
const {WebSocketServer} = require('ws');
const {NativeCliHost} = require('../electron/native-cli-host.cjs');
const {McpConfig, nativeEntry} = require('../electron/mcp-config.cjs');
const {connectionCapabilities,supportsTeamCollaboration} = require('../electron/builtin-adapters.cjs');
const connection = require('../electron/opendesk-connection.cjs');
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function until(read,predicate,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){const v=await read();if(predicate(v))return v;await delay(60);}throw Error('Timed out observing original request');}
async function fixture(t,adapter='opendesk'){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-opendesk-existing-')),context=path.join(directory,'context'),root=path.join(context,'opendesk-existing-v2');
 fs.mkdirSync(root,{recursive:true});const calls=[],messages=new Map(),pending=new Map(),sockets=new Set(),hosts=[];let drop=false,server;
 const deviceId=randomBytes(32).toString('hex'),sessions=new Map();
 const file=connection.settingsFile({home:directory,environment:{}});
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.mkdirSync(path.join(path.dirname(file),'apps/devicemgr/identity'),{recursive:true});
 fs.writeFileSync(path.join(path.dirname(file),'apps/devicemgr/identity/device.json'),JSON.stringify({deviceId}));
 function add(sessionId,role,body,parentID){const row={info:{id:'msg_'+randomUUID(),sessionID:sessionId,role,parentID,time:{completed:Date.now()}},parts:[{type:'text',text:body}]};messages.get(sessionId).push(row);return row;}
 if(adapter==='opendesk'){
  server=http.createServer(async(req,res)=>{
   const route=new URL(req.url,'http://local').pathname;let body='';for await(const b of req)body+=b;body=body?JSON.parse(body):undefined;calls.push({method:req.method,route,body});
   const reply=v=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(v));};
   if(route==='/global/health')return reply({healthy:true,version:'0.3.8'});
   if(req.headers.authorization!=='Basic '+Buffer.from('opencode:secret').toString('base64')){res.writeHead(401);return res.end();}
   if(route==='/session'&&req.method==='POST'){const id='ses_'+randomUUID();messages.set(id,[]);sessions.set(id,{id,directory});return reply(sessions.get(id));}
   const match=/^\/session\/([^/]+)(\/message|\/abort)?$/.exec(route),id=match?.[1];
   if(!messages.has(id)){res.writeHead(404);return res.end();}
   if(!match[2])return reply(sessions.get(id));
   if(match[2]==='/abort')return reply(true);
   if(req.method==='GET')return reply(messages.get(id));
   const user=add(id,'user',body.parts[0].text);pending.set(body.parts[0].text,{id,user,res});
   if(drop){drop=false;req.socket.destroy();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  fs.writeFileSync(path.join(root,'service.json'),JSON.stringify({origin:'http://127.0.0.1:'+server.address().port,password:'secret',pid:process.pid,executable:process.execPath,instanceId:randomUUID()}),{mode:0o600});
 }else{
  server=new WebSocketServer({port:0,host:'127.0.0.1'});await new Promise(r=>server.once('listening',r));
  server.on('connection',socket=>{sockets.add(socket);const connId=randomUUID(),map=new Map();socket.send(JSON.stringify({type:'event',event:'connect.challenge',payload:{nonce:'test'}}));
   socket.on('message',data=>{const f=JSON.parse(data);calls.push({method:f.method,body:f.params,connId});const reply=value=>socket.send(JSON.stringify({type:'res',id:f.id,ok:true,payload:value}));
    if(f.method==='connect')return reply({type:'hello-ok',server:{connId},features:{methods:['chat.send','chat.history','chat.abort']}});
    if(f.method==='gateway.identity.get')return reply({deviceId});
    if(f.method==='chat.send'){const p=f.params;if(!map.has(p.sessionKey))map.set(p.sessionKey,[]);map.get(p.sessionKey).push(p.message);pending.set(p.message,{socket,connId,p});return reply({runId:p.idempotencyKey,status:'started'});}
    if(f.method==='chat.abort')return reply({ok:true,aborted:true});
    if(f.method==='chat.history')return reply({messages:map.get(f.params.sessionKey)||[]});
    throw Error('Unexpected native method: '+f.method);
   });socket.on('close',()=>sockets.delete(socket));
  });
 }
 fs.writeFileSync(file,JSON.stringify({default_workspace:directory,applications:{devicemgr:{host:'127.0.0.1',port:server.address().port}}}));
 const originalConfig=fs.readFileSync(file,'utf8');
 const makeHost=()=>{const h=new NativeCliHost({adapter,directory:context,executable:adapter==='opendesk'?process.execPath:file,home:directory,environment:{...process.env,APPDATA:'',OPENDESK_CONFIG_DIRECTORY:path.dirname(file)}});hosts.push(h);return h;};
 const host=makeHost(),agent=await host.call('connect',{workspace:directory});
 t.after(async()=>{hosts.forEach(h=>h.close());const owner=connection.controller(root);if(owner)try{process.kill(owner.pid,'SIGTERM');}catch{}for(const s of sockets)s.terminate();server.closeAllConnections?.();await new Promise(r=>server.close(r));await delay(250);assert.equal(fs.readFileSync(file,'utf8'),originalConfig);fs.rmSync(directory,{recursive:true,force:true,maxRetries:20,retryDelay:100});});
 function finish(message,answer='native answer',options={}){const p=pending.get(message);assert(p);if(adapter==='opendesk'){const result=add(p.id,'assistant',answer,p.user.info.id);if(!options.historyOnly)p.res.end(JSON.stringify(result));return result;}p.socket.send(JSON.stringify({type:'event',event:'chat',payload:{runId:p.p.idempotencyKey,sessionKey:p.p.sessionKey,seq:options.seq||2,state:options.error?'error':'final',message:{role:'assistant',content:[{type:'text',text:answer}],...(options.early?{}:{timestamp:Date.now()})}}}));}
 return {directory,context,root,file,host,agent,calls,pending,messages,sockets,makeHost,finish,drop:()=>{drop=true;}};
}
for(const adapter of ['opendesk','opendesk-desktop'])test(adapter+' existing APIs preserve original session and Bridge dedupe without native changes',async t=>{
 const f=await fixture(t,adapter),p={op:'submit',agentId:f.agent.agentId,requestId:'one',message:'first'};
 const task=await f.host.call('ipc',p);await until(()=>f.pending.has('first'),Boolean);await f.host.call('ipc',p);
 await assert.rejects(f.host.call('ipc',{...p,message:'different'}),{code:'REQUEST_CONFLICT'});
 if(adapter==='opendesk-desktop'){f.finish('first','premature partial',{early:true,seq:1});await delay(250);assert.equal((await f.host.call('ipc',{op:'request',requestId:'one'})).status,'running');}
 f.finish('first');const result=await until(()=>f.host.call('ipc',{op:'request',requestId:'one'}),r=>r.status==='succeeded');assert.equal(result.result.message,'native answer');
 f.host.close();const h=f.makeHost(),conversation=await h.call('ipc',{op:'conversation',conversationId:task.conversationId});assert.equal(conversation.canContinue,true);
 await h.call('ipc',{op:'continue',conversationId:task.conversationId,requestId:'two',message:'second'});await until(()=>f.pending.has('second'),Boolean);
 if(adapter==='opendesk-desktop'){assert.equal(f.pending.get('first').connId,f.pending.get('second').connId);assert.equal(f.pending.get('first').p.sessionKey,f.pending.get('second').p.sessionKey);}
 else assert.equal(f.pending.get('first').id,f.pending.get('second').id);
 f.finish('second','second result');await until(()=>h.call('ipc',{op:'request',requestId:'two'}),r=>r.status==='succeeded');
 assert.equal(f.calls.filter(c=>c.method==='chat.send'||c.method==='POST'&&c.route.endsWith('/message')).length,2);
 assert(!f.calls.some(c=>c.method==='agentbridge.call'||c.route==='/agentbridge'));
});
for(const adapter of ['opendesk','opendesk-desktop'])test(adapter+' cancel ACK never fabricates cancelled or success and is sent once',async t=>{
 const f=await fixture(t,adapter);const task=await f.host.call('ipc',{op:'submit',agentId:f.agent.agentId,requestId:'cancelled',message:'stop'});await until(()=>f.pending.has('stop'),Boolean);
 const command={op:'cancel',operationId:'cancel-once',taskId:task.taskId};assert.equal((await f.host.call('ipc',command)).state,'unknown');await f.host.call('ipc',command);
 const cancels=()=>f.calls.filter(c=>c.method==='chat.abort'||c.route?.endsWith('/abort'));
 await until(()=>cancels().length,n=>n===1);f.finish('stop');await until(()=>f.host.call('ipc',{op:'request',requestId:'cancelled'}),r=>r.status==='unknown');
 assert.equal((await f.host.call('ipc',{op:'operation',operationId:command.operationId})).state,'unknown');
 await f.host.call('ipc',{op:'reconcile',taskId:task.taskId,operationId:'read-cancel'});await delay(300);assert.equal(cancels().length,1);
});
test('lost HTTP response stays unknown even with manufactured completed history; reconciliation never resubmits',async t=>{
 const f=await fixture(t);f.drop();const task=await f.host.call('ipc',{op:'submit',agentId:f.agent.agentId,requestId:'lost',message:'lost response'});
 await until(()=>f.host.call('ipc',{op:'request',requestId:'lost'}),r=>r.status==='unknown');f.finish('lost response','history claims completed',{historyOnly:true});
 await f.host.call('ipc',{op:'reconcile',taskId:task.taskId,operationId:'only-read'});await delay(300);
 assert.equal((await f.host.call('ipc',{op:'request',requestId:'lost'})).status,'unknown');assert.equal(f.calls.filter(c=>c.method==='POST'&&c.route.endsWith('/message')).length,1);
 await assert.rejects(f.host.call('ipc',{op:'submit',agentId:f.agent.agentId,requestId:'new-id',message:'bypass'}),{code:'AGENT_BUSY'});
});
test('Desktop disconnect closes continuation instead of binding an old sessionKey to a new socket',async t=>{
 const f=await fixture(t,'opendesk-desktop');const task=await f.host.call('ipc',{op:'submit',agentId:f.agent.agentId,requestId:'complete',message:'complete'});await until(()=>f.pending.has('complete'),Boolean);f.finish('complete');await until(()=>f.host.call('ipc',{op:'request',requestId:'complete'}),r=>r.status==='succeeded');
 for(const s of f.sockets)s.close();await delay(1400);assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:task.conversationId})).canContinue,false);
 await assert.rejects(f.host.call('ipc',{op:'continue',conversationId:task.conversationId,requestId:'unsafe',message:'must not send'}),{code:'CONVERSATION_CONFIG'});
 assert.equal(f.calls.filter(c=>c.method==='chat.send').length,1);
});
test('Desktop uses native config and existing gateway identity; foreign workspace is rejected before input',async t=>{
 const f=await fixture(t,'opendesk-desktop');await assert.rejects(f.host.call('connect',{workspace:path.dirname(f.directory)}),{code:'OPENDESK_WORKSPACE'});
 const cfg=connection.desktopConfig(f.file),bad={...cfg,deviceId:'0'.repeat(64)};await assert.rejects(connection.desktopClient(bad),{code:'OPENDESK_IDENTITY'});
 assert.equal(connectionCapabilities({adapter:'opendesk'}).connectionCapabilities.bridgeMcp,true);assert.equal(supportsTeamCollaboration({adapter:'opendesk'}),false);
});
test('known extensionless OpenDesk npm entry uses the same installation and bundled Node',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'ab-opendesk-launch-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'opendesk');fs.writeFileSync(file,'#!/usr/bin/env node\n');
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'@bitclub.ai/opendesk-cli',bin:{opendesk:'./opendesk'}}));
  const launch=require('../electron/tool-discovery.cjs').command(file,['--version'],{PATH:'/without-node'},'linux');
  assert.equal(launch.executable,process.execPath);assert.deepEqual(launch.args,[file,'--version']);
  assert.equal(launch.env.ELECTRON_RUN_AS_NODE,'1');
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'unrelated',bin:{opendesk:'./opendesk'}}));
  assert.equal(require('../electron/tool-discovery.cjs').command(file,[],{}).executable,file);
});
for(const adapter of ['opendesk','opendesk-desktop'])test(adapter+' MCP array ownership, conflict and removal preserve native settings',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'ab-opendesk-mcp-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const target=new McpConfig(adapter,root,{}),original={default_model:'native',applications:{mcpmgr:{servers:[{id:'other',command:'keep'}]}}};
  fs.mkdirSync(path.dirname(target.file),{recursive:true});fs.writeFileSync(target.file,JSON.stringify(original));
  const entry=nativeEntry(adapter,{command:'node',args:['bridge'],env:{}});target.update(entry);
  assert.deepEqual(target.inspect().entry,entry);assert.equal(JSON.parse(fs.readFileSync(target.file)).default_model,'native');
  const foreign={...entry,command:'foreign'};target.update(foreign,entry);
  assert.throws(()=>target.update(undefined,entry),{code:'MCP_CONFIG_CONFLICT'});
  target.update(undefined,foreign);assert.deepEqual(JSON.parse(fs.readFileSync(target.file)),original);
});
test('Desktop lost ACK/connection retains original request; read-only recovery never opens a replacement',async t=>{
 const f=await fixture(t,'opendesk-desktop'),task=await f.host.call('ipc',{op:'submit',agentId:f.agent.agentId,requestId:'lost-desktop',message:'in flight'});await until(()=>f.pending.has('in flight'),Boolean);
 for(const s of f.sockets)s.close();await until(()=>f.host.call('ipc',{op:'request',requestId:'lost-desktop'}),r=>r.status==='unknown');
 const connections=f.calls.filter(c=>c.method==='connect').length;
 await f.host.call('ipc',{op:'reconcile',taskId:task.taskId,operationId:'read-original-desktop'});f.host.close();const reopened=f.makeHost();await reopened.call('ipc',{op:'request',requestId:'lost-desktop'});await delay(300);
 assert.equal(f.calls.filter(c=>c.method==='connect').length,connections);assert.equal(f.calls.filter(c=>c.method==='chat.send').length,1);
});
test('HTTP response must belong to the sole new user message; old/foreign completion is insufficient',()=>{
 const {responseOutcome}=require('../electron/opendesk-worker.cjs'),binding={baseline:['old'],message:'input',sessionId:'ses_current'};
 const user={info:{id:'new-user',role:'user'},parts:[{type:'text',text:'input'}]},answer={info:{id:'answer',role:'assistant',parentID:'new-user',sessionID:'ses_current',time:{completed:1}},parts:[{type:'text',text:'answer'}]};
 assert.equal(responseOutcome(binding,answer,[user,answer]).answer,'answer');
 for(const response of [{...answer,info:{...answer.info,sessionID:'foreign'}},{...answer,info:{...answer.info,id:'old'}},{...answer,info:{...answer.info,parentID:'foreign'}},{...answer,parts:[{type:'text',text:'Error: failed'}]}])assert.equal(responseOutcome(binding,response,[user,answer]),null);
 assert.equal(responseOutcome(binding,answer,[user,user,answer]),null);
});

test('Desktop empty handler final after cancel retains unknown instead of waiting forever',async t=>{
 const f=await fixture(t,'opendesk-desktop');const task=await f.host.call('ipc',{op:'submit',agentId:f.agent.agentId,requestId:'empty-cancel',message:'empty cancel'});await until(()=>f.pending.has('empty cancel'),Boolean);
 await f.host.call('ipc',{op:'cancel',operationId:'cancel-empty',taskId:task.taskId});await until(()=>f.calls.some(c=>c.method==='chat.abort'),Boolean);
 const p=f.pending.get('empty cancel');p.socket.send(JSON.stringify({type:'event',event:'chat',payload:{runId:p.p.idempotencyKey,sessionKey:p.p.sessionKey,seq:3,state:'final'}}));
 await until(()=>f.host.call('ipc',{op:'request',requestId:'empty-cancel'}),r=>r.status==='unknown');
});
