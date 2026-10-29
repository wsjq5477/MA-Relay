const {linuxTest} = require('./platform-test.cjs');
// Real TCP SSH + production daemon/frame protocol; isolated SSH endpoint/installer/native host.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {generateKeyPairSync}=require('node:crypto'),{Server}=require('../../node_modules/ssh2');
const {SshManager}=require('../electron/ssh-host.cjs'),{startDaemon}=require('../electron/machine-daemon.cjs'),{remoteExec}=require('../electron/ssh-install.cjs');
linuxTest('TCP SSH reconnect drains real daemon cursorGap pages, restores original receipt and refuses changed machine host key before authentication',async t=>{
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

test('a terminal maintenance receipt releases the reconnect hold unless the remote daemon was left stopped',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-c-maint-hold-')),harness=maintenanceServer(t,{limit:Infinity});
 await harness.listen();
 let receipt={operationId:'hold-original',state:'rejected',error:{code:'DESKTOP_METHOD',message:'后台维护未执行或未完成（DESKTOP_METHOD）；原版本与历史保留。'},data:{action:'upgrade',stopped:false,rolledBack:false,version:controlledProbe.daemonVersion}};
 const installer={
  async maintenancePreview(){return {...controlledProbe};},
  async stageMaintenance(){return {directory:'/controlled-runtime',release:{version:controlledProbe.targetVersion,digest:'d'.repeat(64),manifest:{version:controlledProbe.targetVersion}}};},
  release(version){return {manifest:{version},digest:version===controlledProbe.daemonVersion?'o'.repeat(64):'d'.repeat(64)};},
  bundle(){return {manifest:{version:controlledProbe.targetVersion,compatibleDaemons:[]}};},
  async remoteMaintenance(client,input){return input.action==='query'?{...receipt,operationId:input.operationId}:{operationId:input.operationId,state:'unknown'};}
 };
 const manager=maintenanceManager(directory,installer);
 t.after(async()=>{manager.close();await new Promise(r=>harness.server.close(r));fs.rmSync(directory,{recursive:true,force:true});});
 const draft=await manager.call('machine.createSshDraft',{host:'127.0.0.1',port:harness.server.address().port,username:'fixture',authKind:'password'}),c=manager.find(draft);
 await manager.call('credential.provide',{connectionId:c.connectionId,secret:'synthetic',save:false});
 const params={connectionId:c.connectionId,operationId:'hold-original',expectedRevision:c.revision,config:{action:'upgrade',previewId:controlledProbe.previewId,expectedVersion:controlledProbe.daemonVersion,targetVersion:controlledProbe.targetVersion}};
 assert.equal((await manager.call('machine.maintainDaemon',params)).state,'unknown');
 assert.equal(c.stage,'maintaining');assert.equal(c.autoReconnect,false);
 // The remote rejected before it stopped anything: the daemon still runs, so the
 // machine must not stay offline with automatic reconnects switched off.
 const rejected=await manager.call('machine.operation',{operationId:params.operationId});
 assert.equal(rejected.state,'rejected');assert.equal(rejected.error.code,'DESKTOP_METHOD');
 assert.equal(c.maintenance.state,'rejected');assert.equal(c.autoReconnect,true);assert.notEqual(c.stage,'disconnected_manual');
 // A receipt that names a stopped, unrestored daemon keeps the barrier instead.
 manager.manualDisconnect(c);await manager.call('credential.provide',{connectionId:c.connectionId,secret:'synthetic',save:false});c.maintenance={operationId:'hold-second',state:'unknown',action:'upgrade'};
 manager.lifecycleOperations.push({operationId:'hold-second',state:'unknown',remoteLaunched:true,fingerprint:'controlled',remoteInput:{action:'upgrade',operationId:'hold-second'},controller:'/controlled-runtime',data:{action:'maintainDaemon',remoteAction:'upgrade',machineId:c.machineId,connectionId:c.connectionId,revision:c.revision}});
 receipt={operationId:'hold-second',state:'rejected',error:{code:'DAEMON_ROLLBACK_UNCONFIRMED',message:'后台已停止但原版本未确认恢复；请查询原操作。'},data:{action:'upgrade',stopped:true,rolledBack:false,version:controlledProbe.daemonVersion}};
 const held=await manager.call('machine.operation',{operationId:'hold-second'});
 assert.equal(held.state,'rejected');assert.equal(c.autoReconnect,false);assert.equal(c.stage,'disconnected_manual');
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

// Read-only pre-maintenance projection over the existing relay channel. The host is
// a controlled stand-in for the real relay because this case is about the manager's
// projection/paging rules and the single original-ID query, not the transport.
test('maintenance blockers project tasks/agents/receipts read-only and original-ID queries never resend or mint an ID',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-c-blockers-'));
 const manager=maintenanceManager(directory,{});
 t.after(()=>{manager.close();fs.rmSync(directory,{recursive:true,force:true});});
 const draft=await manager.call('machine.createSshDraft',{host:'127.0.0.1',port:22,username:'fixture',authKind:'agent'}),c=manager.find(draft);
 let saves=0;const save=manager.save.bind(manager);manager.save=()=>{saves++;save();};
 const calls=[];
 const records=[{key:'blocked-submit',method:'ipc',op:'submit',state:'unknown',createdAt:'2026-10-21T00:00:00.000Z',updatedAt:'2026-10-21T00:00:00.000Z'},{key:'settled-submit',method:'ipc',op:'submit',state:'confirmed',updatedAt:'2026-10-21T00:00:00.000Z'},{key:'control-unknown',method:'ipc',op:'cancel',state:'confirmed',result:{operationId:'control-unknown',state:'unknown'},updatedAt:'2026-10-21T00:00:00.000Z'}];
 const snapshot={tasks:[{taskId:'running-task',requestId:'running-request',status:'running',adapter:'opencode'},{taskId:'done-task',status:'succeeded'}],agents:{items:[{nodeId:'agent-a',adapter:'claude',busy:true,currentTask:{taskId:'agent-task',status:'accepted'}},{nodeId:'agent-b',busy:false}]}};
 const stub=call=>{manager.hosts.set(c.connectionId,{detach(){},close(){},call:async(method,params={})=>{calls.push({method,params});return call(method,params);}});};
 stub((method,params)=>{if(method==='snapshot')return structuredClone(snapshot);if(method==='daemon.receiptRead')return {items:params.afterCursor?[]:structuredClone(records),nextCursor:params.afterCursor||records.length,hasMore:false};throw Object.assign(new Error('controlled method'),{code:'DESKTOP_METHOD'});});
 c.stage='online';c.online=true;saves=0;
 const blockers=await manager.call('machine.maintenanceBlockers',{connectionId:c.connectionId});
 assert.equal(blockers.available,true);assert.equal(blockers.receiptsSupported,true);
 assert.deepEqual(blockers.tasks,[{taskId:'running-task',requestId:'running-request',status:'running',adapter:'opencode'}]);
 assert.deepEqual(blockers.agents,[{nodeId:'agent-a',adapter:'claude',busy:true,currentTask:{taskId:'agent-task',status:'accepted'}}]);
 assert.deepEqual(blockers.receipts,[{key:'blocked-submit',op:'submit',state:'unknown',updatedAt:'2026-10-21T00:00:00.000Z'},{key:'control-unknown',op:'cancel',state:'unknown',updatedAt:'2026-10-21T00:00:00.000Z'}]);
 assert.deepEqual(calls.map(entry=>entry.method),['snapshot','daemon.receiptRead']);
 assert.equal(saves,0,'the blockers projection must not write any local state');
 assert.equal(c.stage,'online');
 // Offline machines report unavailability instead of throwing, and never touch the channel.
 c.stage='disconnected';c.online=false;saves=0;
 const offline=await manager.call('machine.maintenanceBlockers',{connectionId:c.connectionId});
 assert.equal(offline.available,false);assert.match(offline.reason,/当前离线/);
 assert.deepEqual(calls.map(entry=>entry.method),['snapshot','daemon.receiptRead']);assert.equal(saves,0);
 c.stage='online';c.online=true;
 // A daemon released before the receipt endpoint reports the missing ledger instead of failing.
 calls.length=0;
 stub(method=>{if(method==='snapshot')return structuredClone(snapshot);throw Object.assign(new Error('controlled legacy daemon'),{code:'DESKTOP_METHOD'});});
 const legacy=await manager.call('machine.maintenanceBlockers',{connectionId:c.connectionId});
 assert.equal(legacy.available,true);assert.equal(legacy.receiptsSupported,false);
 assert.deepEqual(legacy.receipts,[]);assert.equal(legacy.tasks.length,1);assert.equal(legacy.agents.length,1);
 assert.deepEqual(calls.map(entry=>entry.method),['snapshot','daemon.receiptRead']);
 assert.equal(saves,0);
 // A submit receipt is queried as the original request; one call, same ID, nothing resent.
 calls.length=0;
 stub((method,params)=>{if(method==='ipc'&&params.op==='request')return {taskId:'blocked-task',requestId:'blocked-submit',status:'running'};throw Object.assign(new Error('controlled method'),{code:'DESKTOP_METHOD'});});
 const queried=await manager.call('machine.queryBlockedOperation',{connectionId:c.connectionId,key:'blocked-submit',op:'submit'});
 assert.equal(queried.state,'confirmed');assert.equal(queried.detail.taskId,'blocked-task');
 assert.deepEqual(calls,[{method:'ipc',params:{op:'request',requestId:'blocked-submit'}}]);
 // A control receipt is queried as the original operation.
 calls.length=0;
 stub((method,params)=>{if(method==='ipc'&&params.op==='operation')return {operationId:'control-original',state:'rejected'};throw Object.assign(new Error('controlled method'),{code:'DESKTOP_METHOD'});});
 assert.equal((await manager.call('machine.queryBlockedOperation',{connectionId:c.connectionId,key:'control-original',op:'cancel'})).state,'rejected');
 assert.deepEqual(calls,[{method:'ipc',params:{op:'operation',operationId:'control-original'}}]);
 // A query failure keeps its original code instead of pretending success.
 calls.length=0;
 stub(()=>{throw Object.assign(new Error('原请求已发往原生后台但尚无可核对收据，请查询原请求，不重复执行。'),{code:'DESKTOP_UNCONFIRMED'});});
 await assert.rejects(manager.call('machine.queryBlockedOperation',{connectionId:c.connectionId,key:'blocked-submit',op:'submit'}),{code:'DESKTOP_UNCONFIRMED'});
 assert.equal(calls.length,1);assert.equal(saves,0);
 // Only a recorded original task/control ID can be queried this way.
 await assert.rejects(manager.call('machine.queryBlockedOperation',{connectionId:c.connectionId,key:'../escape',op:'submit'}),{code:'INVALID_INPUT'});
 await assert.rejects(manager.call('machine.queryBlockedOperation',{connectionId:c.connectionId,key:'blocked-submit',op:'submit-many'}),{code:'INVALID_INPUT'});
});
test('maintenance input carries the strict unresolved-receipt override and never a truthy lookalike',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-c-override-')),harness=maintenanceServer(t,{limit:Infinity});
 await harness.listen();const inputs=[];
 const installer={
  async maintenancePreview(){return {...controlledProbe};},
  async stageMaintenance(){return {directory:'/controlled-runtime',release:{version:controlledProbe.targetVersion,digest:'d'.repeat(64),manifest:{version:controlledProbe.targetVersion}}};},
  release(version){return {manifest:{version},digest:version===controlledProbe.daemonVersion?'o'.repeat(64):'d'.repeat(64)};},
  bundle(){return {manifest:{version:controlledProbe.targetVersion,compatibleDaemons:[]}};},
  async remoteMaintenance(client,input){inputs.push(structuredClone(input));return {operationId:input.operationId,state:'unknown'};}
 };
 const manager=maintenanceManager(directory,installer);
 t.after(async()=>{manager.close();await new Promise(r=>harness.server.close(r));fs.rmSync(directory,{recursive:true,force:true});});
 const draft=async username=>{const d=await manager.call('machine.createSshDraft',{host:'127.0.0.1',port:harness.server.address().port,username,authKind:'password'});await manager.call('credential.provide',{connectionId:d.connectionId,secret:'synthetic',save:false});return manager.find(d);};
 const config=extra=>({action:'upgrade',previewId:controlledProbe.previewId,expectedVersion:controlledProbe.daemonVersion,targetVersion:controlledProbe.targetVersion,...extra});
 const confirmed=await draft('override-confirmed');
 await manager.call('machine.maintainDaemon',{connectionId:confirmed.connectionId,operationId:'override-original',expectedRevision:confirmed.revision,config:config({allowUnresolved:true})});
 assert.equal(inputs.length,1);assert.equal(inputs[0].allowUnresolvedReceipts,true);
 const lookalike=await draft('override-lookalike');
 await manager.call('machine.maintainDaemon',{connectionId:lookalike.connectionId,operationId:'override-lookalike-original',expectedRevision:lookalike.revision,config:config({allowUnresolved:'yes'})});
 assert.equal(inputs.length,2);assert.equal(inputs[1].allowUnresolvedReceipts,false,'only the strict boolean enables the override');
 const absent=await draft('override-absent');
 await manager.call('machine.maintainDaemon',{connectionId:absent.connectionId,operationId:'override-absent-original',expectedRevision:absent.revision,config:config({})});
 assert.equal(inputs.length,3);assert.equal(inputs[2].allowUnresolvedReceipts,false);
});
