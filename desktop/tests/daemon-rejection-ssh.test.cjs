const {linuxTest} = require('./platform-test.cjs');
// Real TCP SSH, authentication, daemon disk ledger and Coordinator recovery.
// The isolated native host rejects before task creation; no model/CLI is run.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {generateKeyPairSync,createHash}=require('node:crypto'),{Server}=require('../../node_modules/ssh2');
const {SshManager}=require('../electron/ssh-host.cjs'),{startDaemon}=require('../electron/machine-daemon.cjs');
const {FramedStream}=require('../electron/machine-protocol.cjs');
const {AgentNetwork}=require('../electron/agent-network.cjs'),{createCoordinatorService}=require('../electron/coordinator-service.cjs');
linuxTest('lost rejection response survives real daemon restart and TCP SSH reconnect; recovery releases only original intent',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-reject-ssh-')),clients=new Set(),sockets=new Set();
 let nativeCalls=0,drop=true,discarded=0;
 const native={setCollaboration(){},close(){},async call(method,p){
  if(method==='snapshot')return {agents:{items:[]},tasks:[],conversations:[]};
  if(method==='ipc'&&p.op==='submit'){nativeCalls++;throw Object.assign(Error('controlled configuration unavailable before task creation'),{code:'NOT_CONFIGURED'});}
  throw Object.assign(Error('no native receipt'),{code:'NOT_FOUND'});
 }};
 const options={stateDirectory:path.join(directory,'state'),ownerCoordinatorId:'coordinator-test',profileId:'profile-test',monitorIntervalMs:0,hostFactory:()=>native};
 let daemon=await startDaemon(options);
 const key=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'}}).privateKey;
 const server=new Server({hostKeys:[key]},client=>{
  clients.add(client);client.on('error',()=>{});client.on('close',()=>clients.delete(client));
  client.on('authentication',ctx=>ctx.method==='password'&&ctx.password==='synthetic'?ctx.accept():ctx.reject(['password']));
  client.on('ready',()=>client.on('session',accept=>{const session=accept();session.on('exec',(acceptExec,_reject,info)=>{
   const channel=acceptExec();channel.on('error',()=>{});
   if(info.command.includes('machine-daemon.cjs')){channel.exit(0);channel.end(JSON.stringify(daemon.info));return;}
   const socket=net.createConnection(daemon.info.socketPath);sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>channel.close());
   const fromSsh=new FramedStream(channel),fromDaemon=new FramedStream(socket);
   fromSsh.on('error',()=>{});fromDaemon.on('error',()=>{});
   fromSsh.on('frame',frame=>fromDaemon.send(frame));
   fromDaemon.on('frame',frame=>{
    if(drop&&frame.error?.code==='NOT_CONFIGURED'){drop=false;discarded++;socket.destroy();channel.close();return;}
    if(!fromSsh.closed)fromSsh.send(frame);
   });
   channel.on('close',()=>socket.destroy());
  });}));
 });
 await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
 const installer={async probe(){return {previewId:'controlled',uid:process.getuid(),arch:'x64',installNeeded:false,installPath:directory};},async install(){return {node:process.execPath,versionPath:directory,stateDirectory:daemon.info.stateDirectory,profileId:'profile-test',version:require('../package.json').version};}};
 const manager=new SshManager({directory:path.join(directory,'ssh'),coordinatorId:'coordinator-test',installer,openSshFiles:[]});
 let service;
 t.after(async()=>{service?.close();manager.close();for(const c of clients)c.end();for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));await daemon.close();fs.rmSync(directory,{recursive:true,force:true});});
 const draft=await manager.call('machine.createSshDraft',{host:'127.0.0.1',port:server.address().port,username:'fixture',authKind:'password'}),c=manager.find(draft);
 const credential=()=>manager.call('credential.provide',{connectionId:c.connectionId,secret:'synthetic',save:false});await credential();
 const probe=await manager.call('machine.testSsh',{connectionId:c.connectionId});await manager.call('machine.trustHost',{connectionId:c.connectionId,challengeId:probe.trustChallenge.challengeId,fingerprint:probe.trustChallenge.fingerprint});
 await manager.call('machine.connectSsh',{connectionId:c.connectionId,operationId:'connect',installIfNeeded:false});
 const host=manager.host(c),wire={op:'submit',agentId:'controlled-agent',requestId:'lost-rejection',message:'controlled original'};
 await assert.rejects(host.call('ipc',wire),e=>['DESKTOP_TRANSPORT','SSH_CONNECTION_FAILED'].includes(e.code));
 assert.equal(nativeCalls,1);assert.equal(discarded,1);
 manager.manualDisconnect(c);await daemon.close();daemon=await startDaemon(options);
 await credential();await manager.call('machine.reconnect',{connectionId:c.connectionId});
 const clientDirectory=path.join(directory,'central'),network=new AgentNetwork({directory:clientDirectory,platform:'win32',distributions:async()=>[],createHost:()=>host});
 network.catalog.machines.push({...c.identity,kind:'ssh',online:true});network.save();
 const nodeId='controlled-node',params={...wire,machineId:c.machineId,nodeId};delete params.agentId;
 network.network.nodes.push({nodeId,machineId:c.machineId,adapter:'opencode',connected:true,executionSupported:true});
 const fingerprint=createHash('sha256').update(JSON.stringify({nodeId,op:'submit',message:wire.message,workspace:'',conversationId:'',collaboration:false})).digest('hex');
 network.network.requests.push({requestId:wire.requestId,machineId:c.machineId,nodeId,agentId:c.machineId+'::controlled-agent',fingerprint,inputFingerprint:fingerprint,dispatched:true});network.saveNetwork();
 network.network.nodes.push({nodeId:'other-node',machineId:c.machineId,adapter:'codex',connected:true,executionSupported:true});
 network.network.requests.push({requestId:'other-unknown',machineId:c.machineId,nodeId:'other-node',dispatched:true});network.saveNetwork();
 const original={id:wire.requestId,op:'submit',machineId:c.machineId,params,state:'unknown',time:'2026-10-17T00:00:00.000Z'};
 fs.writeFileSync(path.join(clientDirectory,'pending.json'),JSON.stringify([original]));
 service=createCoordinatorService({directory:clientDirectory,network});
 assert.equal((await network.snapshot()).nodes.find(n=>n.nodeId===nodeId).unconfirmed,1);
 const recovered=await service.recoverPending();assert.equal(recovered.resolved,1,JSON.stringify(recovered));assert.equal(service.pending().length,0);
 const row=JSON.parse(fs.readFileSync(path.join(clientDirectory,'pending.json')))[0];assert.equal(row.state,'rejected');assert.equal(row.time,original.time);assert.deepEqual(row.params,params);assert.equal(network.network.requests[0].dispatched,false);
 assert.equal((await service.call({method:'nodeRequest',params})).error.code,'NOT_CONFIGURED');
 const nodes=(await network.snapshot()).nodes;assert.equal(nodes.find(n=>n.nodeId===nodeId).busy,false);assert.equal(nodes.find(n=>n.nodeId===nodeId).unconfirmed,0);assert.equal(nodes.find(n=>n.nodeId==='other-node').unconfirmed,1);
 assert.equal(nativeCalls,1);assert.equal((await host.call('daemon.receiptRead',{requestId:wire.requestId})).state,'rejected');
});
