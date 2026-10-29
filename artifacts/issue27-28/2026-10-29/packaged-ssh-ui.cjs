// Actual packaged renderer + coordinator + real loopback SSH/SFTP. No native execution.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createHash,generateKeyPairSync}=require('node:crypto'),{createRequire}=require('node:module');
const repo=path.resolve(__dirname,'../../..'),localRequire=createRequire(path.join(repo,'desktop/package.json'));
const {_electron}=localRequire('playwright'),{Server,utils}=require(path.join(repo,'node_modules/ssh2'));
const {identity}=require(path.join(repo,'desktop/electron/coordinator.cjs')),{CoordinatorClient}=require(path.join(repo,'desktop/electron/coordinator-client.cjs'));
const {SshInstaller}=require(path.join(repo,'desktop/electron/ssh-install.cjs'));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-issues27-28-ssh-ui-')),owner=identity(directory),profileId=new SshInstaller({directory,coordinatorId:owner.coordinatorId}).profileId;
const bundle=JSON.parse(fs.readFileSync(path.join(repo,'desktop/release/win-unpacked/resources/linux-package/manifest.json'))),installPath='/home/fixture/.local/share/agentbridge/profiles/'+profileId;
const current={version:bundle.version,digest:createHash('sha256').update(JSON.stringify(bundle)).digest('hex'),versionPath:installPath+'/versions/'+bundle.version};
const objects=new Map([[installPath+'/install.json',{kind:'agentbridge-install',ownerCoordinatorId:owner.coordinatorId,profileId}],[installPath+'/current.json',current],[installPath+'/original-ledger.json',{tasks:['unknown'],requests:['original'],delegations:['original']}]]);
const beforeLedger=JSON.stringify(objects.get(installPath+'/original-ledger.json'));
let app,client,server,releaseProbe,holdProbe=false,probes=0,mutations=0,forbiddenCommands=0;const peers=new Set(),errors=[];
const report={date:new Date().toISOString(),version:'0.6.0-alpha.70',status:'running',scope:'actual packaged unpacked EXE UI with debugging transport, actual coordinator and loopback SSH/SFTP virtual files; no production remote or profile',modelCalls:0,checks:[]};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,reason){const end=Date.now()+30000;while(Date.now()<end){if(await fn())return;await delay(50);}throw Error(reason);}
const bounded=(promise,ms)=>Promise.race([promise,new Promise(r=>{const t=setTimeout(()=>r('timeout'),ms);t.unref();})]);
async function call(method,params={}){const reply=await client.request('call',{method,params});assert.equal(reply.ok,true,JSON.stringify(reply.error));return reply.result;}
function attrs(file){return {uid:1000,gid:1000,mode:objects.has(file)?0o100600:0o40700,size:objects.has(file)?Buffer.byteLength(JSON.stringify(objects.get(file))):0,atime:1,mtime:1};}
function sftpSession(stream){
  const handles=new Map();let next=1;
  const stat=(id,file)=>stream.attrs(id,attrs(file));stream.on('LSTAT',stat);stream.on('STAT',stat);
  stream.on('OPEN',(id,file,flags)=>{if(flags!==utils.sftp.OPEN_MODE.READ){mutations++;stream.status(id,3);return;}if(!objects.has(file)){stream.status(id,2);return;}const handle=Buffer.alloc(4);handle.writeUInt32BE(next++);handles.set(handle.toString('hex'),file);stream.handle(id,handle);});
  stream.on('FSTAT',(id,handle)=>{const file=handles.get(handle.toString('hex'));file?stream.attrs(id,attrs(file)):stream.status(id,2);});
  stream.on('READ',(id,handle,offset,length)=>{const file=handles.get(handle.toString('hex'));if(!file){stream.status(id,2);return;}const bytes=Buffer.from(JSON.stringify(objects.get(file)));if(offset>=bytes.length)stream.status(id,1);else stream.data(id,bytes.subarray(offset,offset+length));});
  stream.on('CLOSE',(id,handle)=>{handles.delete(handle.toString('hex'));stream.status(id,0);});
  for(const method of ['WRITE','MKDIR','RMDIR','REMOVE','RENAME','SETSTAT','FSETSTAT','SYMLINK'])stream.on(method,id=>{mutations++;stream.status(id,3);});
}
(async()=>{
  const key=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'}}).privateKey;
  server=new Server({hostKeys:[key]},peer=>{
    peers.add(peer);peer.on('error',()=>{});peer.on('close',()=>peers.delete(peer));peer.on('authentication',ctx=>ctx.method==='password'&&ctx.password==='synthetic'?ctx.accept():ctx.reject());
    peer.on('ready',()=>peer.on('session',accept=>{
      const session=accept();session.on('sftp',acceptSftp=>sftpSession(acceptSftp()));
      session.on('exec',(acceptExec,reject,info)=>{if(info.command!=='/bin/sh -s'){forbiddenCommands++;reject();return;}const channel=acceptExec();channel.on('data',()=>{});channel.on('end',()=>{probes++;const respond=()=>{channel.exit(0);channel.end(['AGENTBRIDGE_PROBE_V2','Linux','x86_64','1000','fixture','/home/fixture','glibc 2.32','9999999','/usr/bin/node','24.12.0','','END_AGENTBRIDGE_PROBE',''].join('\n'));};if(holdProbe)releaseProbe=respond;else respond();});});
    }));
  });await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
  const machineId='synthetic-ssh-machine',connectionId='synthetic-ssh-connection',nodeId='synthetic-ssh-node';
  const network={version:1,revision:0,nodes:[{nodeId,machineId,name:'Synthetic remote Codex',adapter:'codex',executable:'/synthetic/not-executed',connected:true,managed:true,executionSupported:true}],collaboration:{leaderId:null,memberIds:[],revision:0},requests:[{requestId:'synthetic-original-unknown',nodeId,machineId,dispatched:true,lastStatus:'unknown'}],delegations:[]};
  const write=(name,value)=>fs.writeFileSync(path.join(directory,name),JSON.stringify(value,null,2));
  write('agent-network.json',network);
  write('machines.json',{version:1,localMachineId:'synthetic-local',machines:[{machineId:'synthetic-local',name:'Synthetic Windows',kind:'windows',platform:'win32'},{machineId,connectionId,name:'Synthetic remote',kind:'ssh',platform:'linux',online:false}],connections:[],instances:[]});
  const connection={connectionId,machineId,daemonId:'synthetic-original-daemon',revision:1,name:'Synthetic remote',host:'127.0.0.1',port:server.address().port,username:'fixture',authKind:'password',autoReconnect:false,identity:{machineId,daemonId:'synthetic-original-daemon',profileId,ownerCoordinatorId:owner.coordinatorId,daemonVersion:bundle.version}};
  write('ssh-connections.json',{version:1,connections:[connection],operations:{},lifecycleOperations:[]});
  const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:directory};delete env.ELECTRON_RUN_AS_NODE;
  app=await _electron.launch({executablePath:path.join(repo,'desktop/release/win-unpacked/AgentBridge.exe'),env,timeout:420000});
  const page=await app.firstWindow({timeout:420000});page.setDefaultTimeout(420000);page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('heading',{name:'接入配置',exact:true}).waitFor();
  client=new CoordinatorClient({directory});const readyUntil=Date.now()+420000;while(true){try{await client.attach();break;}catch(error){if(!['ENOENT','ECONNREFUSED','COORDINATOR_TRANSPORT'].includes(error.code)||Date.now()>readyUntil)throw error;await delay(100);}}assert.equal(client.info.version,report.version);
  const credential=await call('credential.provide',{connectionId,secret:'synthetic',save:true});assert.equal(credential.saved,true);let tested=await call('machine.testSsh',{connectionId});
  if(tested.stage==='awaiting_host_trust'){await call('machine.trustHost',{connectionId,challengeId:tested.trustChallenge.challengeId,fingerprint:tested.trustChallenge.fingerprint});tested=await call('machine.testSsh',{connectionId});}
  assert.equal(tested.stage,'ready');assert(tested.probe);assert.equal(tested.probe.daemonVersion,bundle.version);
  report.checks.push('Actual packaged coordinator accepts its trusted public manifest as a fresh ready probe');
  objects.set(installPath+'/current.json',{version:'synthetic-unlisted-daemon',digest:'a'.repeat(64),versionPath:installPath+'/versions/synthetic-unlisted-daemon'});holdProbe=true;
  const rejected=client.request('call',{method:'machine.reconnect',params:{connectionId}});await until(()=>!!releaseProbe,'Second probe did not reach inspecting');
  let snapshot=await call('snapshot'),machine=snapshot.machines.find(m=>m.machineId===machineId),node=snapshot.nodes.find(n=>n.nodeId===nodeId);
  assert.equal(machine.stage,'inspecting');assert.equal(machine.probe,undefined);assert.equal(machine.error,undefined);assert.equal(node.connectionState,'inspecting');assert.equal(node.error,undefined);assert.equal(node.available,false);
  const card=page.getByRole('region',{name:'Synthetic remote',exact:true});await card.getByText('正在检查远端环境',{exact:true}).first().waitFor();await card.screenshot({path:path.join(__dirname,'packaged-ssh-inspecting.png')});
  report.checks.push('Actual packaged snapshot and UI suppress old probe/offline errors during held inspecting');
  releaseProbe();const accepted=await rejected;assert.equal(accepted.ok,true);assert.equal(accepted.result.state,'confirmed');await until(async()=>{const value=await call('snapshot');return value.machines.find(m=>m.machineId===machineId)?.connectionError?.code==='SSH_DAEMON_UPGRADE_REQUIRED';},'Current version refusal did not become visible');
  for(let i=0;i<3;i++){snapshot=await call('snapshot');machine=snapshot.machines.find(m=>m.machineId===machineId);node=snapshot.nodes.find(n=>n.nodeId===nodeId);assert.equal(machine.stage,'disconnected');assert.equal(machine.probe,undefined);assert.equal(machine.connectionError.code,'SSH_DAEMON_UPGRADE_REQUIRED');assert.equal(machine.connectionError.retryable,false);assert.equal(node.errorCode,'SSH_DAEMON_UPGRADE_REQUIRED');}
  await card.getByText('远端后台版本不受当前客户端支持',{exact:true}).waitFor();await card.screenshot({path:path.join(__dirname,'packaged-ssh-refusal.png')});await delay(1600);assert.equal(probes,2);
  const saved=JSON.parse(fs.readFileSync(path.join(directory,'agent-network.json'))),connections=JSON.parse(fs.readFileSync(path.join(directory,'ssh-connections.json')));
  assert.deepEqual(saved.requests,network.requests);assert.deepEqual(saved.delegations,network.delegations);assert.deepEqual(connections.connections[0].identity,connection.identity);assert.equal(connections.connections[0].daemonId,connection.daemonId);assert.deepEqual(connections.operations,{});
  assert.equal(JSON.stringify(objects.get(installPath+'/original-ledger.json')),beforeLedger);assert.equal(mutations,0);assert.equal(forbiddenCommands,0);assert.deepEqual(errors,[]);
  report.checks.push('Stable unsupported-version UI over three snapshots; no automatic repeat, install/upload/start command or remote mutation; original IDs and unknown request retained');
  report.remoteWrites=mutations;report.nonProbeCommands=forbiddenCommands;report.probes=probes;report.pageErrors=0;report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code||'VERIFY_FAILED',message:e.message};process.exitCode=1;}).finally(async()=>{
  try{if(client?.socket&&!client.socket.destroyed)await bounded(client.request('shutdown'),5000);}catch{}client?.close();
  if(app){await bounded(app.evaluate(({app})=>app.exit(0)).catch(()=>{}),5000);if(app.process().exitCode===null)app.process().kill();}
  for(const peer of peers)peer.end();if(server)await bounded(new Promise(r=>server.close(r)),5000);
  fs.writeFileSync(path.join(__dirname,'packaged-ssh-ui.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));process.exit(process.exitCode||0);
});
