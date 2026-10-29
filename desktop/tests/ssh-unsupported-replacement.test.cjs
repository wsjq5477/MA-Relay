const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createHash}=require('node:crypto'),{EventEmitter}=require('node:events'),{Readable}=require('node:stream');
const {SshInstaller}=require(process.env.AGENTBRIDGE_REPLACEMENT_INSTALLER||'../electron/ssh-install.cjs');
const {SshManager}=require('../electron/ssh-host.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-replacement-')),node=Buffer.from('synthetic trusted node');
 fs.mkdirSync(path.join(directory,'runtime'));fs.writeFileSync(path.join(directory,'runtime/node'),node);
 const manifest={version:'0.6.0-test-client',protocolVersion:2,platform:'linux',arch:'x64',runtime:{path:'runtime/node',version:'22.23.1'},files:[{path:'runtime/node',size:node.length,sha256:sha(node)}]};
 fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest));
 const installer=new SshInstaller({directory,coordinatorId:'synthetic-owner',packageDirectory:directory});
 const installPath='/home/test/.local/share/agentbridge/profiles/'+installer.profileId,stateDirectory='/home/test/.local/state/agentbridge/profiles/'+installer.profileId;
 const version='0.6.0-alpha.46-synthetic.4',versionPath=installPath+'/versions/'+version,current={version,digest:'a'.repeat(64),versionPath};
 const objects=new Map([[installPath+'/install.json',{kind:'agentbridge-install',ownerCoordinatorId:'synthetic-owner',profileId:installer.profileId}],[installPath+'/current.json',current],[versionPath+'/.bridge-release.json',{ownerCoordinatorId:'synthetic-owner',digest:current.digest}]]),unsafe=new Map(),writes=[],commands=[];
 const sftp={end(){},lstat(file,cb){const value=objects.get(file),o=unsafe.get(file)||{};cb(null,{uid:o.uid??1000,size:value?Buffer.byteLength(JSON.stringify(value)):0,isDirectory:()=>!value,isFile:()=>!!value,isSymbolicLink:()=>!!o.link});},createReadStream:file=>Readable.from([Buffer.from(JSON.stringify(objects.get(file)))])};
 for(const method of ['mkdir','chmod','rename','createWriteStream','write','unlink'])sftp[method]=()=>{writes.push(method);throw Error('unexpected mutation');};
 const client={sftp(cb){cb(null,sftp);},exec(command,options,cb){commands.push(command);const stream=new EventEmitter();stream.stderr=new EventEmitter();stream.close=()=>{};stream.end=()=>queueMicrotask(()=>{stream.emit('data',Buffer.from(['AGENTBRIDGE_PROBE_V2','Linux','x86_64','1000','test','/home/test','glibc 2.32','9999999','/usr/bin/node','22.23.1','','END_AGENTBRIDGE_PROBE',''].join('\n')));stream.emit('close',0);});cb(null,stream);}};
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 return {directory,installer,client,current,objects,unsafe,writes,commands,installPath,stateDirectory,versionPath,manifest};
}
test('unlisted suffix stays refused for normal connection but has a read-only replacement preview independent of old manifest pins',async t=>{
 const f=fixture(t),before=JSON.stringify([...f.objects]);
 await assert.rejects(f.installer.probe(f.client),{code:'SSH_DAEMON_UPGRADE_REQUIRED'});
 const p=await f.installer.maintenancePreview(f.client);
 assert.equal(p.replacementRequired,true);assert.equal(p.daemonVersion,f.current.version);assert.equal(p.targetVersion,f.manifest.version);assert.equal(p.reuseCompatible,false);assert.equal(p.rollbackVersion,undefined);
 assert.equal(p.manifestDigest,f.current.digest);assert.equal(p.versionPath,f.versionPath);
 await assert.rejects(f.installer.install(f.client,p,'must-not-reuse'),{code:'SSH_DAEMON_UPGRADE_REQUIRED'});
 assert.deepEqual(f.writes,[]);assert.equal(JSON.stringify([...f.objects]),before);assert(f.commands.every(c=>c==='/bin/sh -s'));
});
test('replacement preview checks original ownership, digest, current path and symlink parents without executing unlisted code',async t=>{
 const f=fixture(t);
 for(const change of ['owner','digest','path','link','uid']){
  const marker=f.objects.get(f.versionPath+'/.bridge-release.json');
  if(change==='owner')marker.ownerCoordinatorId='foreign';
  if(change==='digest')marker.digest='b'.repeat(64);
  if(change==='path')f.current.versionPath='/other/source';
  if(change==='link')f.unsafe.set('/home/test/.local',{link:true});
  if(change==='uid')f.unsafe.set(f.stateDirectory,{uid:2000});
  await assert.rejects(f.installer.maintenancePreview(f.client),e=>['REMOTE_DIRECTORY_UNSAFE','SSH_VERSION_CONFLICT'].includes(e.code));
  marker.ownerCoordinatorId='synthetic-owner';marker.digest='a'.repeat(64);f.current.versionPath=f.versionPath;f.unsafe.clear();
 }
 const first=await f.installer.maintenancePreview(f.client);f.current.digest='b'.repeat(64);f.objects.get(f.versionPath+'/.bridge-release.json').digest=f.current.digest;
 assert.notEqual((await f.installer.maintenancePreview(f.client)).previewId,first.previewId);
 assert.deepEqual(f.writes,[]);assert(f.commands.every(c=>c==='/bin/sh -s'));
});
test('an untrusted previous version does not prevent the explicit replacement route',async t=>{
 const f=fixture(t);f.objects.set(f.installPath+'/previous.json',{version:'0.6.0-unknown',digest:'b'.repeat(64),versionPath:'/unknown'});
 assert.equal((await f.installer.maintenancePreview(f.client)).replacementRequired,true);assert.deepEqual(f.writes,[]);
});
test('replacement confirmation, target CAS and original unknown intent survive manager restart without retransmission',async t=>{
 const f=fixture(t),manager=new SshManager({directory:f.directory,coordinatorId:'synthetic-owner'});t.after(()=>manager.close());
 const c={connectionId:'synthetic-connection',machineId:'synthetic-machine',daemonId:'synthetic-daemon',revision:1,host:'example.invalid',username:'test',port:22,authKind:'agent',stage:'disconnected',autoReconnect:false};manager.connections.push(c);
 const p=await f.installer.maintenancePreview(f.client),target={manifest:f.manifest,digest:sha(JSON.stringify(f.manifest))};let sent=0,staged=0;
 manager.authenticate=async()=>f.client;manager.maintenanceEntry=async()=>p;
 manager.installer={bundle:()=>({manifest:f.manifest,digest:target.digest}),release(v){assert.equal(v,f.manifest.version,'unlisted code must never enter release selection');return target;},async stageMaintenance(){staged++;return {directory:'/synthetic-controller',release:{version:f.manifest.version,digest:target.digest,manifest:f.manifest}};},async remoteMaintenance(_client,input){sent++;assert.equal(input.action,'replace');assert.equal(input.confirmReplacement,true);assert.equal(input.from.version,f.current.version);assert.equal(input.from.digest,f.current.digest);return {state:'unknown'};}};
 const input={connectionId:c.connectionId,operationId:'original-replace',expectedRevision:1,config:{action:'replace',previewId:p.previewId,expectedVersion:p.daemonVersion,targetVersion:p.targetVersion}};
 for(const value of [undefined,false,'true'])await assert.rejects(manager.maintainDaemon({...input,config:{...input.config,confirmReplacement:value}}),{code:'SSH_REPLACEMENT_CONFIRMATION_REQUIRED'});
 await assert.rejects(manager.maintainDaemon({...input,config:{...input.config,action:'upgrade'}}),{code:'SSH_REPLACEMENT_CONFIRMATION_REQUIRED'});
 await assert.rejects(manager.maintainDaemon({...input,config:{...input.config,confirmReplacement:true,allowUnresolved:true}}),{code:'SSH_REPLACEMENT_CONFIRMATION_REQUIRED'});
 await assert.rejects(manager.maintainDaemon({...input,config:{...input.config,confirmReplacement:true,previewId:'stale'}}),{code:'INSTALL_PREVIEW_CHANGED'});
 assert.equal(staged,0);assert.equal(sent,0);
 input.config.confirmReplacement=true;assert.equal((await manager.maintainDaemon(input)).state,'unknown');assert.equal((await manager.maintainDaemon(input)).state,'unknown');assert.equal(sent,1);
 manager.close();const reopened=new SshManager({directory:f.directory,coordinatorId:'synthetic-owner'});t.after(()=>reopened.close());
 assert.equal((await reopened.maintainDaemon(input)).state,'unknown');assert.equal(reopened.lifecycleOperations[0].remoteInput.confirmReplacement,true);assert.equal(sent,1);
 await assert.rejects(reopened.maintainDaemon({...input,config:{...input.config,targetVersion:'different'}}),{code:'OPERATION_CONFLICT'});
 assert.equal(c.daemonId,'synthetic-daemon');assert.deepEqual(f.writes,[]);
});
test('old central backends get an explicit replacement capability error before dispatch',async()=>{
 const {CoordinatorClient}=require('../electron/coordinator-client.cjs'),{coordinatorRuntimeCapabilities}=require('../electron/runtime-capabilities.cjs');
 const client=new CoordinatorClient({directory:os.tmpdir()});client.open=async()=>{};client.info={capabilities:coordinatorRuntimeCapabilities.filter(c=>c!=='ssh-daemon-replacement-v1')};
 for(const params of [{method:'machine.daemonPreview'},{method:'machine.maintainDaemon',params:{config:{action:'replace'}}}])await assert.rejects(client.request('call',params),{code:'SSH_REPLACEMENT_BACKEND_UPGRADE_REQUIRED'});
});

test('coordinator validates the replacement confirmation field and admits only idle offline maintenance without relaxing other writes',async t=>{
 const f=fixture(t),{createCoordinatorService}=require('../electron/coordinator-service.cjs');let dispatched=0,busy=false;
 const c={connectionId:'synthetic-connection',machineId:'synthetic-machine',revision:1};
 const machine={machineId:c.machineId,online:false,kind:'ssh'};
 const network={machineLocks:new Set(),nodeJobs:new Map(),locks:new Set(),catalog:{instances:[]},async snapshot(){return {machines:[machine],tasks:busy?[{machineId:c.machineId,status:'unknown'}]:[],nodes:[],instances:[]};},finalizeMachine:r=>r,close(){}};
 const service=createCoordinatorService({directory:f.directory,platform:'win32',network,ssh:{find:()=>c,async call(method,params){dispatched++;return {operationId:params.operationId,state:'confirmed',data:{action:'maintainDaemon',machineId:c.machineId}};},close(){}}});t.after(()=>service.close());
 const request=(id,action)=>service.call({method:'machine.maintainDaemon',params:{connectionId:c.connectionId,machineId:c.machineId,operationId:id,expectedRevision:1,config:{action,previewId:'synthetic',expectedVersion:'unlisted',targetVersion:'trusted',confirmReplacement:true}}});
 const allowed=await request('replace-original','replace');assert.equal(allowed.ok,true,JSON.stringify(allowed));assert.equal(dispatched,1);
 const other=await request('ordinary-upgrade','upgrade');assert.equal(other.ok,false);assert.equal(other.error.code,'MACHINE_OFFLINE');assert.equal(dispatched,1);
 busy=true;const blocked=await request('busy-replace','replace');assert.equal(blocked.ok,false);assert.equal(blocked.error.code,'MACHINE_BUSY');assert.equal(dispatched,1);
});
