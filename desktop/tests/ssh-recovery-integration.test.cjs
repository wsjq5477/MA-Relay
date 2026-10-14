// Real TCP SSH + production daemon/frame protocol; isolated SSH endpoint/installer/native host.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {generateKeyPairSync}=require('node:crypto'),{Server}=require('../../node_modules/ssh2');
const {SshManager}=require('../electron/ssh-host.cjs'),{startDaemon}=require('../electron/machine-daemon.cjs'),{remoteExec}=require('../electron/ssh-install.cjs');
test('TCP SSH reconnect drains real daemon cursorGap pages, restores original receipt and refuses changed machine host key before authentication',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-c-ssh-'));let submitted=0,authenticated=0;const items=[],seen=[],snapshots=[],clients=new Set(),sockets=new Set();
 const native={setCollaboration(){},close(){},async call(m,p){if(m==='snapshot')return {agents:{items:[]},tasks:items,conversations:[]};if(m==='ipc'&&p.op==='submit'){submitted++;const result={taskId:'task-original',conversationId:'session-original',requestId:p.requestId,status:'running'};items.push(result);return result;}if(m==='ipc'&&p.op==='request')return items.find(x=>x.requestId===p.requestId);throw Error(m);}};
 const daemon=await startDaemon({stateDirectory:path.join(directory,'state'),ownerCoordinatorId:'coordinator-test',profileId:'profile-test',monitorIntervalMs:0,hostFactory:()=>native});
 const hostKey=()=>generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'}}).privateKey;
 const server=new Server({hostKeys:[hostKey()]},client=>{clients.add(client);client.on('error',()=>{});client.on('close',()=>clients.delete(client));client.on('authentication',ctx=>{authenticated++;ctx.method==='password'&&ctx.password==='synthetic'?ctx.accept():ctx.reject(['password']);});client.on('ready',()=>client.on('session',accept=>{const session=accept();session.on('exec',(accept,reject,info)=>{const channel=accept();if(info.command.includes('machine-daemon.cjs')){channel.exit(0);channel.end(JSON.stringify(daemon.info));}else if(info.command.includes('machine-relay.cjs')){const socket=net.createConnection(daemon.info.socketPath);sockets.add(socket);socket.on('error',()=>channel.close());socket.on('close',()=>sockets.delete(socket));channel.on('close',()=>socket.destroy());channel.pipe(socket).pipe(channel);}else{reject?.();channel.close();}});}));});
 await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
 const installer={async probe(){return {previewId:'fixed',uid:process.getuid(),arch:'x64',installNeeded:false,installPath:directory};},async install(){return {node:process.execPath,versionPath:directory,stateDirectory:daemon.info.stateDirectory,profileId:daemon.info.profileId,version:require('../package.json').version};}};
 const manager=new SshManager({directory:path.join(directory,'client'),coordinatorId:'coordinator-test',installer,openSshFiles:[],onEvent:(_m,e)=>seen.push(e.cursor),onSnapshot:(_m,s)=>snapshots.push(s)});
 t.after(async()=>{manager.close();for(const c of clients)c.end();for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));await daemon.close();fs.rmSync(directory,{recursive:true,force:true});});
 const draft=await manager.call('machine.createSshDraft',{host:'127.0.0.1',port:server.address().port,username:'fixture',authKind:'password'}),c=manager.find(draft);
 await manager.call('credential.provide',{connectionId:c.connectionId,secret:'synthetic',save:false});let probe=await manager.call('machine.testSsh',{connectionId:c.connectionId});assert(probe.trustChallenge);await manager.call('machine.trustHost',{connectionId:c.connectionId,challengeId:probe.trustChallenge.challengeId,fingerprint:probe.trustChallenge.fingerprint});
 probe=await manager.call('machine.testSsh',{connectionId:c.connectionId});assert.equal(probe.stage,'ready');await manager.call('machine.connectSsh',{connectionId:c.connectionId,operationId:'first',installIfNeeded:false});const id=c.machineId;
 const task=await manager.host(c).call('ipc',{op:'submit',requestId:'original',message:'controlled'});assert.equal(submitted,1);manager.manualDisconnect(c);items[0].status='succeeded';
 for(let i=0;i<2105;i++)daemon.emitEvent('task.changed',{taskId:task.taskId,status:'succeeded',sample:i});seen.length=0;
 await manager.call('credential.provide',{connectionId:c.connectionId,secret:'synthetic',save:false});const before=Date.now();await manager.call('machine.reconnect',{connectionId:c.connectionId});assert.equal(c.machineId,id);assert.equal(snapshots.length,1);assert.equal(snapshots[0].tasks[0].status,'succeeded');assert.equal(new Set(seen).size,2000);assert.equal(c.lastCursor,2107);assert.equal(submitted,1);assert.equal((await manager.host(c).call('ipc',{op:'request',requestId:'original'})).taskId,task.taskId);assert(Date.now()-before<30000);
 manager.manualDisconnect(c);const changedKey=hostKey();const changed=new Server({hostKeys:[changedKey]},client=>{client.on('error',()=>{});client.on('authentication',ctx=>{authenticated++;ctx.reject();});});await new Promise((r,j)=>{changed.once('error',j);changed.listen(0,'127.0.0.1',r);});t.after(()=>new Promise(r=>changed.close(r)));
 c.port=changed.address().port;const count=authenticated;await manager.call('credential.provide',{connectionId:c.connectionId,secret:'synthetic',save:false});await assert.rejects(manager.authenticate(c),{code:'SSH_HOST_KEY_CHANGED'});assert.equal(authenticated,count);assert.equal(submitted,1);
});
// Controlled TCP SSH with a session-budget-limited sshd stand-in (the real server's
// observed maintenance-entry failure). No daemon, no model; the installer is stubbed
// around a real remoteExec so the actual channel-open rejection path is exercised.
function maintenanceServer(t,policy){
 const hostKey=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'}}).privateKey,perPeer=new WeakMap();let connections=0;
 const server=new Server({hostKeys:[hostKey]},peer=>{
   connections++;peer.on('error',()=>{});
   peer.on('authentication',ctx=>ctx.method==='password'&&ctx.password==='synthetic'?ctx.accept():ctx.reject(['password']));
   peer.on('ready',()=>peer.on('session',(accept,reject)=>{
     if(policy.rejectOnce){policy.rejectOnce=false;return reject();}
     const used=perPeer.get(peer)||0;
     if(used>=policy.limit)return reject();
     perPeer.set(peer,used+1);
     const session=accept();session.on('exec',acceptExec=>{const channel=acceptExec();channel.exit(0);channel.end('controlled');});
   }));
 });
 return {server,connections:()=>connections,listen:()=>new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);})};
}
function maintenanceManager(directory,installer){
 return new SshManager({directory:path.join(directory,'client'),coordinatorId:'coordinator-test',installer,openSshFiles:[],knownHosts:{check:()=>({trusted:true,fingerprint:'controlled-key',keyType:'ssh-rsa'})},onChange:()=>{}});
}
const controlledProbe={previewId:'controlled-preview',daemonVersion:'0.6.0-alpha.10',targetVersion:'0.6.0-alpha.14',rollbackVersion:'0.6.0-alpha.10',home:'/home/fixture',installPath:'/home/fixture/install',stateDirectory:'/home/fixture/state',uid:1000,profileId:'profile'};
test('session-capped maintenance preview recovers on one fresh connection, stages there and keeps the receipt unknown',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-c-maint-')),harness=maintenanceServer(t,{limit:1});
 await harness.listen();
 const previewCalls=[];let stagedClient,remoteCalls=0;
 const installer={
   async maintenancePreview(client){previewCalls.push(client);await remoteExec(client,'/bin/sh -s','');return {...controlledProbe};},
   async stageMaintenance(client){stagedClient=client;return {directory:'/controlled-runtime',release:{version:'0.6.0-alpha.14',digest:'d'.repeat(64),manifest:{version:'0.6.0-alpha.14'}}};},
   release(version){return {manifest:{version},digest:version==='0.6.0-alpha.10'?'o'.repeat(64):'d'.repeat(64)};},
   bundle(){return {manifest:{version:'0.6.0-alpha.14',compatibleDaemons:[]},digest:'d'.repeat(64)};},
   async remoteMaintenance(){remoteCalls++;return {operationId:'still-running',state:'unknown'};}
 };
 const manager=maintenanceManager(directory,installer);
 t.after(async()=>{manager.close();await new Promise(r=>harness.server.close(r));fs.rmSync(directory,{recursive:true,force:true});});
 const draft=await manager.call('machine.createSshDraft',{host:'127.0.0.1',port:harness.server.address().port,username:'fixture',authKind:'password'}),c=manager.find(draft);
 const provide=()=>manager.call('credential.provide',{connectionId:c.connectionId,secret:'synthetic',save:false});
 await provide();
 // Entry preview consumes the first connection's only session slot.
 assert.equal((await manager.call('machine.daemonPreview',{connectionId:c.connectionId})).previewId,'controlled-preview');
 // The maintain preview's session open is rejected on that connection; the same-connection
 // retry is rejected too, so one fresh connection (new login) recovers the read-only
 // preview and staging runs on it while the receipt stays a queryable unknown.
 const operationId='maintain-original';
 await provide();
 await manager.call('machine.maintainDaemon',{connectionId:c.connectionId,operationId,expectedRevision:c.revision,config:{action:'upgrade',previewId:controlledProbe.previewId,expectedVersion:controlledProbe.daemonVersion,targetVersion:controlledProbe.targetVersion}});
 assert.equal(previewCalls.length,4);assert.equal(previewCalls[0],previewCalls[1]);assert.equal(previewCalls[1],previewCalls[2]);assert.notEqual(previewCalls[2],previewCalls[3]);
 assert.equal(stagedClient,previewCalls[3]);assert.equal(harness.connections(),2);
 const row=await manager.call('machine.operation',{operationId});
 assert.equal(row.state,'unknown');assert.equal(remoteCalls,2);assert.equal(c.stage,'maintaining');assert.equal(c.maintenance.state,'unknown');
});
test('maintenance preview retries transport rejection on the same connection first and never retries semantic rejection',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-c-maint-boundary-')),policy={limit:Infinity,rejectOnce:true},harness=maintenanceServer(t,policy);
 await harness.listen();
 const previewCalls=[];let semantic=false;
 const installer={
   async maintenancePreview(client){
     previewCalls.push(client);
     if(semantic)throw Object.assign(new Error('controlled semantic'),{code:'SSH_VERSION_CONFLICT'});
     await remoteExec(client,'/bin/sh -s','');return {...controlledProbe};
   },
   release(version){return {manifest:{version},digest:version==='0.6.0-alpha.10'?'o'.repeat(64):'d'.repeat(64)};},
   bundle(){return {manifest:{version:'0.6.0-alpha.14',compatibleDaemons:[]}};}
 };
 const manager=maintenanceManager(directory,installer);
 t.after(async()=>{manager.close();await new Promise(r=>harness.server.close(r));fs.rmSync(directory,{recursive:true,force:true});});
 const draft=async username=>{const d=await manager.call('machine.createSshDraft',{host:'127.0.0.1',port:harness.server.address().port,username,authKind:'password'});await manager.call('credential.provide',{connectionId:d.connectionId,secret:'synthetic',save:false});return d.connectionId;};
 // A transient session-open rejection recovers on the SAME connection: no new login.
 const transient=await draft('transient');
 assert.equal((await manager.call('machine.daemonPreview',{connectionId:transient})).previewId,'controlled-preview');
 assert.equal(previewCalls.length,2);assert.equal(previewCalls[0],previewCalls[1]);assert.equal(harness.connections(),1);
 // A persistent rejection surfaces after the same-connection retry and one fresh
 // connection; no maintenance intent is created. The entry preview first caches the
 // connection, so the fresh-login retry has a re-provided password to use.
 const persistent=await draft('persistent');
 assert.equal((await manager.call('machine.daemonPreview',{connectionId:persistent})).previewId,'controlled-preview');
 policy.limit=0;await manager.call('credential.provide',{connectionId:persistent,secret:'synthetic',save:false});
 await assert.rejects(manager.call('machine.maintainDaemon',{connectionId:persistent,operationId:'no-intent',expectedRevision:manager.find({connectionId:persistent}).revision,config:{action:'upgrade',previewId:controlledProbe.previewId,expectedVersion:controlledProbe.daemonVersion,targetVersion:controlledProbe.targetVersion}}),{code:'DAEMON_STAGE_REJECTED'});
 assert.equal(previewCalls.length,6);assert.equal(harness.connections(),3);
 assert.equal((await manager.call('machine.operation',{operationId:'no-intent'})).state,'not_found');
 // A semantic preview rejection is never retried.
 policy.limit=Infinity;semantic=true;const guarded=await draft('guarded');
 await assert.rejects(manager.call('machine.daemonPreview',{connectionId:guarded}),{code:'SSH_VERSION_CONFLICT'});
 assert.equal(previewCalls.length,7);assert.equal(harness.connections(),4);
 // Missing credentials surface as a re-entry need, not a generic stage rejection.
 const missing=await manager.call('machine.createSshDraft',{host:'127.0.0.1',port:harness.server.address().port,username:'missing',authKind:'password'});
 await assert.rejects(manager.call('machine.maintainDaemon',{connectionId:missing.connectionId,operationId:'missing-credentials',expectedRevision:missing.revision,config:{action:'upgrade',previewId:controlledProbe.previewId,expectedVersion:controlledProbe.daemonVersion,targetVersion:controlledProbe.targetVersion}}),{code:'SSH_AUTH_REQUIRED'});
 assert.equal(manager.find({connectionId:missing.connectionId}).stage,'needs_credentials');assert.equal(previewCalls.length,7);
});

test('pre-transmission maintenance rejection with missing retry credentials stays definitively not started across restart',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-c-maint-no-send-')),harness=maintenanceServer(t,{limit:0});
 await harness.listen();let remoteCalls=0;
 const installer={
  async maintenancePreview(){return {...controlledProbe};},
  async stageMaintenance(){return {directory:'/controlled-runtime',release:{version:controlledProbe.targetVersion,digest:'d'.repeat(64),manifest:{version:controlledProbe.targetVersion}}};},
  release(version){return {manifest:{version},digest:version===controlledProbe.daemonVersion?'o'.repeat(64):'d'.repeat(64)};},
  bundle(){return {manifest:{version:controlledProbe.targetVersion,compatibleDaemons:[]}};},
  async remoteMaintenance(client,input){remoteCalls++;await remoteExec(client,'/bin/sh -s',JSON.stringify(input));throw Error('fixture must reject channel before receiving input');}
 };
 let manager=maintenanceManager(directory,installer);
 t.after(async()=>{manager.close();await new Promise(r=>harness.server.close(r));fs.rmSync(directory,{recursive:true,force:true});});
 const draft=await manager.call('machine.createSshDraft',{host:'127.0.0.1',port:harness.server.address().port,username:'fixture',authKind:'password'}),c=manager.find(draft);
 let crashSnapshot;const save=manager.save.bind(manager);
 manager.save=()=>{save();const r=manager.lifecycleOperations[0];if(r?.state==='unknown'&&r.remoteLaunched===false&&c.maintenance?.state==='unknown')crashSnapshot=fs.readFileSync(manager.file);};
 await manager.call('credential.provide',{connectionId:c.connectionId,secret:'synthetic',save:false});
 const params={connectionId:c.connectionId,operationId:'not-started-original',expectedRevision:c.revision,config:{action:'upgrade',previewId:controlledProbe.previewId,expectedVersion:controlledProbe.daemonVersion,targetVersion:controlledProbe.targetVersion}};
 const receipt=await manager.call('machine.maintainDaemon',params);
 assert.equal(receipt.state,'rejected');assert.equal(receipt.error.code,'DAEMON_NOT_STARTED');assert.equal(c.stage,'needs_credentials');assert.equal(c.error.code,'SSH_AUTH_REQUIRED');
 assert.equal(manager.lifecycleOperations[0].remoteLaunched,false);assert.equal(remoteCalls,1);
 const logins=harness.connections();manager.close();manager=maintenanceManager(directory,installer);
 const query=await manager.call('machine.operation',{operationId:params.operationId});
 assert.equal(query.state,'rejected');assert.equal(query.error.code,'DAEMON_NOT_STARTED');
 assert.equal((await manager.call('machine.maintainDaemon',params)).state,'rejected');
 assert.equal(remoteCalls,1);assert.equal(harness.connections(),logins);
 // Restore the actual atomic snapshot recorded between the first rejection and
 // the next login, as if the process had exited at that checkpoint.
 assert(crashSnapshot);manager.close();fs.writeFileSync(manager.file,crashSnapshot);manager=maintenanceManager(directory,installer);
 assert.equal(manager.find(draft).maintenance.state,'unknown');
 assert.equal((await manager.call('machine.operation',{operationId:params.operationId})).state,'rejected');
 assert.equal(manager.find(draft).maintenance.state,'rejected');assert.equal(manager.find(draft).autoReconnect,false);
 assert.equal(remoteCalls,1);assert.equal(harness.connections(),logins);
});

for(const retryFailure of ['open','stream','timeout'])test('maintenance retry '+retryFailure+' preserves the original transmission boundary and receipt',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-c-maint-boundary-send-')),harness=maintenanceServer(t,{limit:retryFailure==='open'?0:Infinity,rejectOnce:true});
 await harness.listen();let launches=0,queries=0,manager,c;
 const installer={
  async maintenancePreview(){return {...controlledProbe};},
  async stageMaintenance(){return {directory:'/controlled-runtime',release:{version:controlledProbe.targetVersion,digest:'d'.repeat(64),manifest:{version:controlledProbe.targetVersion}}};},
  release(version){return {manifest:{version},digest:version===controlledProbe.daemonVersion?'o'.repeat(64):'d'.repeat(64)};},
  bundle(){return {manifest:{version:controlledProbe.targetVersion,compatibleDaemons:[]}};},
  async remoteMaintenance(client,input){
   if(input.action==='query'){queries++;return {operationId:input.operationId,state:'unknown'};}
   launches++;
   if(launches===1){await manager.call('credential.provide',{connectionId:c.connectionId,secret:'synthetic',save:false});return remoteExec(client,'/bin/sh -s',JSON.stringify(input));}
   if(retryFailure==='open')return remoteExec(client,'/bin/sh -s',JSON.stringify(input));
   // The retry channel accepted its input before its response was lost.
   await remoteExec(client,'/bin/sh -s',JSON.stringify(input));
   throw Object.assign(new Error('controlled response lost'),retryFailure==='stream'?{code:'SSH_EXEC_FAILED',details:{stage:'stream'}}:{code:'SSH_COMMAND_TIMEOUT'});
  }
 };
 manager=maintenanceManager(directory,installer);
 t.after(async()=>{manager.close();await new Promise(r=>harness.server.close(r));fs.rmSync(directory,{recursive:true,force:true});});
 const draft=await manager.call('machine.createSshDraft',{host:'127.0.0.1',port:harness.server.address().port,username:'fixture',authKind:'password'});c=manager.find(draft);
 await manager.call('credential.provide',{connectionId:c.connectionId,secret:'synthetic',save:false});
 const params={connectionId:c.connectionId,operationId:'send-boundary-original',expectedRevision:c.revision,config:{action:'upgrade',previewId:controlledProbe.previewId,expectedVersion:controlledProbe.daemonVersion,targetVersion:controlledProbe.targetVersion}};
 const receipt=await manager.call('machine.maintainDaemon',params),expected=retryFailure==='open'?'rejected':'unknown';
 assert.equal(receipt.state,expected);assert.equal(manager.lifecycleOperations[0].remoteLaunched,retryFailure!=='open');assert.equal(launches,2);assert.equal(harness.connections(),2);
 if(expected==='rejected')assert.equal(receipt.error.code,'DAEMON_NOT_STARTED');
 else {await manager.call('credential.provide',{connectionId:c.connectionId,secret:'synthetic',save:false});await assert.rejects(manager.call('machine.maintainDaemon',{...params,operationId:'must-not-replace-unknown',expectedRevision:c.revision}),{code:'MACHINE_BUSY'});}
 assert.equal((await manager.call('machine.maintainDaemon',params)).state,expected);assert.equal(launches,2);
 const query=await manager.call('machine.operation',{operationId:params.operationId});assert.equal(query.state,expected);assert.equal(queries,expected==='unknown'?1:0);assert.equal(launches,2);
});
