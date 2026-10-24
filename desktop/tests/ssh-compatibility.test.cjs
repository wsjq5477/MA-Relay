const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createHash}=require('node:crypto'),{EventEmitter}=require('node:events'),{Readable}=require('node:stream');
const {SshInstaller,remoteExec}=require(process.env.AGENTBRIDGE_COMPATIBILITY_INSTALLER||'../electron/ssh-install.cjs');
const pinRoot=process.env.AGENTBRIDGE_COMPATIBILITY_PIN_ROOT||path.resolve(__dirname,'../compatible-daemons');
const digest=m=>createHash('sha256').update(JSON.stringify(m)).digest('hex');
function fixture(t,oldManifest){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-ssh-compat-')),payload=Buffer.from('test-node');
 const entry=(name,bytes)=>({path:name,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 const old=oldManifest||{version:'0.6.0-alpha.2',protocolVersion:2,platform:'linux',arch:'x64',runtime:{path:'runtime/node',version:'22.23.1'},files:[entry('runtime/node',payload)]};
 fs.mkdirSync(path.join(directory,'runtime'));fs.writeFileSync(path.join(directory,'runtime/node'),payload);
 const pinPath='compatible-daemons/'+old.version+'.json';fs.mkdirSync(path.join(directory,'compatible-daemons'));const pin=Buffer.from(JSON.stringify(old));fs.writeFileSync(path.join(directory,pinPath),pin);
 const manifest={...old,version:'0.6.0-alpha.4',files:[entry('runtime/node',payload),entry(pinPath,pin)],compatibleDaemons:[{version:old.version,manifestPath:pinPath,manifestDigest:digest(old)}]};fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest));
 const installer=new SshInstaller({directory,coordinatorId:'test-owner',packageDirectory:directory});
 const installPath='/home/u/.local/share/agentbridge/profiles/'+installer.profileId,versionPath=installPath+'/versions/'+old.version;
 const current={version:old.version,digest:digest(old),versionPath};
 const objects=new Map([[installPath+'/install.json',{kind:'agentbridge-install',ownerCoordinatorId:'test-owner',profileId:installer.profileId}],[installPath+'/current.json',current],[versionPath+'/.bridge-release.json',{ownerCoordinatorId:'test-owner',digest:digest(old)}]]);
 const writes=[],commands=[],unsafe=new Map();let failVerify=false;
 const sftp={end(){},lstat(target,cb){const object=objects.get(target),override=unsafe.get(target);cb(null,{uid:override?.uid??1000,size:object?Buffer.byteLength(JSON.stringify(object)):0,isDirectory:()=>!object&&!override?.file,isFile:()=>!!object,isSymbolicLink:()=>!!override?.symlink});},createReadStream(target){return Readable.from([Buffer.from(JSON.stringify(objects.get(target)))]);}};
 for(const name of ['mkdir','chmod','rename','createWriteStream','write','unlink'])sftp[name]=()=>{writes.push(name);throw Error('Unexpected remote mutation');};
 const client={sftp(cb){cb(null,sftp);},exec(command,options,cb){commands.push(command);const stream=new EventEmitter();stream.stderr=new EventEmitter();stream.close=()=>{};stream.end=_input=>queueMicrotask(()=>{const probe=command==='/bin/sh -s';stream.emit('data',Buffer.from(probe?['AGENTBRIDGE_PROBE_V2','Linux','x86_64','1000','u','/home/u','glibc 2.32','9999999','/usr/bin/node','22.23.1','','END_AGENTBRIDGE_PROBE',''].join('\n'):'{"verified":true}'));stream.emit('close',!probe&&failVerify?1:0);});cb(null,stream);}};
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return {directory,installer,client,current,old,objects,commands,writes,unsafe,installPath,versionPath,setFailVerify(){failVerify=true;}};
}
test('a newer client reuses its pinned compatible daemon without upload, activation or remote state writes',async t=>{
 const f=fixture(t),before=JSON.stringify([...f.objects]);const probe=await f.installer.probe(f.client);
 assert.equal(probe.daemonVersion,'0.6.0-alpha.2');assert.equal(probe.clientDaemonVersion,'0.6.0-alpha.4');assert.equal(probe.reuseCompatible,true);assert.equal(probe.installNeeded,false);
 // A stale/missing presentation flag cannot bypass release selection.
 probe.reuseCompatible=false;const result=await f.installer.install(f.client,probe,'reuse');assert.equal(result.version,'0.6.0-alpha.2');assert.equal(result.versionPath,f.versionPath);assert.deepEqual(f.writes,[]);assert.equal(JSON.stringify([...f.objects]),before);
 assert.equal(f.commands.length,2);assert(!f.commands.some(c=>/tar|kill|daemon.cjs/.test(c)));
});
function expandPins(f,count){
 const file=path.join(f.directory,'manifest.json'),manifest=JSON.parse(fs.readFileSync(file));
 for(let i=1;i<count;i++){
  const old={...f.old,version:'0.6.0-pinned-'+i},pinPath='compatible-daemons/'+old.version+'.json',bytes=Buffer.from(JSON.stringify(old));
  fs.writeFileSync(path.join(f.directory,pinPath),bytes);
  manifest.files.push({path:pinPath,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  manifest.compatibleDaemons.push({version:old.version,manifestPath:pinPath,manifestDigest:digest(old)});
 }
 fs.writeFileSync(file,JSON.stringify(manifest));
}
test('33 individually pinned releases still verify and reuse the original daemon without mutations',async t=>{
 const f=fixture(t);expandPins(f,33);
 assert.equal(f.installer.bundle().manifest.compatibleDaemons.length,33);
 const before=JSON.stringify([...f.objects]),probe=await f.installer.probe(f.client);
 assert.equal(probe.daemonVersion,f.old.version);assert.equal(probe.reuseCompatible,true);
 assert.equal((await f.installer.install(f.client,probe,'over-32')).version,f.old.version);
 assert.deepEqual(f.writes,[]);assert.equal(JSON.stringify([...f.objects]),before);
});
test('the compatibility index remains bounded and rejects 129 entries before any remote command',async t=>{
 const f=fixture(t);expandPins(f,129);
 assert.throws(()=>f.installer.bundle(),{code:'SSH_PACKAGE_INVALID'});assert.deepEqual(f.writes,[]);assert.deepEqual(f.commands,[]);
});
test('the full 128-entry bound accepts every individually hashed pin including its last entry',t=>{
 const f=fixture(t);expandPins(f,128);
 const bundle=f.installer.bundle();assert.equal(bundle.manifest.compatibleDaemons.length,128);
 assert.equal(f.installer.release('0.6.0-pinned-127',bundle).manifest.version,'0.6.0-pinned-127');
 assert.throws(()=>f.installer.release('0.6.0-untrusted',bundle),{code:'SSH_DAEMON_UPGRADE_REQUIRED'});
 assert.deepEqual(f.commands,[]);assert.deepEqual(f.writes,[]);
});
test('same protocol alone never authorizes unknown versions, changed digests or directory aliases',async t=>{
 const f=fixture(t);f.current.version='0.6.0-alpha.99';await assert.rejects(f.installer.probe(f.client),{code:'SSH_DAEMON_UPGRADE_REQUIRED'});
 f.current.version=f.old.version;f.current.digest='0'.repeat(64);await assert.rejects(f.installer.probe(f.client),{code:'SSH_VERSION_CONFLICT'});
 f.current.digest=digest(f.old);f.current.versionPath='/other/alias';await assert.rejects(f.installer.probe(f.client),{code:'SSH_VERSION_CONFLICT'});assert.deepEqual(f.writes,[]);
});
test('compatible reuse refuses changed installation, foreign ownership and symbolic parents before execution',async t=>{
 const f=fixture(t),probe=await f.installer.probe(f.client);
 f.current.digest='0'.repeat(64);await assert.rejects(f.installer.install(f.client,probe,'changed'),{code:'INSTALL_PREVIEW_CHANGED'});f.current.digest=digest(f.old);
 f.unsafe.set('/home/u/.local',{symlink:true});await assert.rejects(f.installer.install(f.client,probe,'symlink'),{code:'REMOTE_DIRECTORY_UNSAFE'});f.unsafe.clear();
 f.objects.get(f.installPath+'/install.json').ownerCoordinatorId='foreign';await assert.rejects(f.installer.install(f.client,probe,'foreign'),{code:'REMOTE_DIRECTORY_UNSAFE'});
 assert.equal(f.commands.length,1);assert.deepEqual(f.writes,[]);
});
test('tampered local pins and failed remote file verification reject reuse without mutations',async t=>{
 const f=fixture(t),probe=await f.installer.probe(f.client);f.setFailVerify();await assert.rejects(f.installer.install(f.client,probe,'checksum'),{code:'SSH_PACKAGE_CHECKSUM'});
 fs.appendFileSync(path.join(f.directory,'compatible-daemons',f.old.version+'.json'),' ');await assert.rejects(f.installer.probe(f.client),{code:'SSH_PACKAGE_CHECKSUM'});assert.deepEqual(f.writes,[]);
});
test('maintenance preview reads probe markers and previous version over one shared SFTP session',async t=>{
 const f=fixture(t);
 f.objects.set(f.installPath+'/previous.json',{version:f.old.version,digest:digest(f.old),versionPath:f.versionPath});
 let sftpOpens=0;const counting={sftp(cb){sftpOpens++;return f.client.sftp(cb);},exec:(...args)=>f.client.exec(...args)};
 const preview=await f.installer.maintenancePreview(counting);
 assert.equal(preview.daemonVersion,f.old.version);assert.equal(preview.targetVersion,'0.6.0-alpha.4');assert.equal(preview.rollbackVersion,f.old.version);
 assert.equal(sftpOpens,1,'one SFTP session must cover probe markers and previous.json');assert.equal(f.commands.length,1);
});
test('remoteExec reports the channel rejection reason and the remote exit code',async()=>{
 const rejected={exec(_command,_options,cb){cb(Object.assign(new Error('(SSH) Channel open failure: open failed'),{reason:4}));}};
 await assert.rejects(remoteExec(rejected,'fixture'),e=>e.code==='SSH_EXEC_FAILED'&&e.message.includes('通道原因码 4'));
 const failed={exec(_command,_options,cb){const stream=new EventEmitter();stream.stderr=new EventEmitter();stream.close=()=>{};stream.end=()=>queueMicrotask(()=>stream.emit('close',127));cb(null,stream);}};
 await assert.rejects(remoteExec(failed,'fixture'),e=>e.code==='SSH_EXEC_FAILED'&&e.message.includes('退出码 127'));
});
for(const action of ['query','upgrade'])test(`maintenance ${action} preserves the original intent while sending only the required catalogue`,async t=>{
 const f=fixture(t),input={...require('./maintenance-input-fixture.cjs').frozenCatalogueInput(),action},before=JSON.stringify(input);let sent;
 const client={exec(_command,_options,cb){const stream=new EventEmitter();stream.stderr=new EventEmitter();stream.close=()=>{};stream.end=text=>{sent=text;queueMicrotask(()=>{stream.emit('data',Buffer.from(JSON.stringify({operationId:input.operationId,state:'unknown'})));stream.emit('close',0);});};cb(null,stream);}};
 const reply=await f.installer.remoteMaintenance(client,input,'/controlled-maintenance-runtime');
 assert.equal(reply.operationId,input.operationId);assert.equal(reply.state,'unknown');assert.equal(JSON.stringify(input),before);
 if(action==='query'){assert(Buffer.byteLength(sent)<8*1048576);assert.deepEqual(JSON.parse(sent),{...input,releases:[]});}
 else{assert(Buffer.byteLength(sent)>8*1048576);assert.equal(sent,before);}
 assert.deepEqual(f.writes,[]);
});

test('a verified maintenance bundle still rejects a compatibility manifest changed before input construction',t=>{
 const f=fixture(t),bundle=f.installer.bundle();
 assert.equal(f.installer.release(f.old.version,bundle).digest,digest(f.old));
 const filename=path.join(f.directory,'compatible-daemons',f.old.version+'.json');
 fs.writeFileSync(filename,JSON.stringify({...f.old,runtime:{...f.old.runtime,version:'22.24.0'}}));
 assert.throws(()=>f.installer.release(f.old.version,bundle),{code:'SSH_PACKAGE_CHECKSUM'});
 assert.deepEqual(f.writes,[]);
});

for(const [version,expectedDigest] of [
 ['0.6.0-alpha.24','e631db77604099d70c96bf7c7d85657bb957a3dd251a2ae91ad89fc33c7b9955'],
 ['0.6.0-alpha.25','54ada2b6d01fd9537de00e93b277f2cae50de5d969ebefc08544b49647654146'],
 ['0.6.0-alpha.26','6674f37902908e329ce76cb634d6ebae36c55f33f8e7ad836488986b10879c4e'],
 ['0.6.0-alpha.27','e3862fdd030496218e69166fb3bb928277b41477003f68dac48a2a5db09945af'],
 ['0.6.0-alpha.29','71ac17c760bc26122581c06bf1a2b0522234e62040312c4a6c1aeec4e6084983'],
 ['0.6.0-alpha.30','911331194e2c94d3488e5ef81637364b248189d1c71b336f41e60c1a3a8b06f0'],
 ['0.6.0-alpha.31','c28d31a989b05d51903497494922ae5b7b0f1d8fa1c50d365896d68e8a5612eb'],
 ['0.6.0-alpha.32','33bbd002f9163bbada063b5ef9feb89aaa8653e12dcd6b86d068c5beaa190d19'],
 ['0.6.0-alpha.46','4722efad31cf45a26e7e15d98f7abe58ccfa673c139c22fcca57e6553e733c8f'],
 ['0.6.0-alpha.51.recovery.2','64e82373cc336d44194af8060c397f90b97894e7621f720b5aba77acf0eedafe'],
 ['0.6.0-alpha.52','3bf18b4d97d0c951767fbe3bfa612b4031e2e5078ae067a2ac77a48b9c8c66ba'],
 ['0.6.0-alpha.53','cd70e10faaedd92364a92d4cfb9c601becb5eb7403c3a62e869a8fdcd16a7a3c'],
 ['0.6.0-alpha.54','9ad57b4eef6330c634e87a0ebd77f777e1389fc685a306d268d53fee4c56e7bd'],
 ['0.6.0-alpha.55','489718bb811abbee6650ae2a97e6df0d5ce5c331a61c8df370f11fdc8fcc6e3f']
])test(`frozen ${version} reconnects and previews upgrade using its exact frozen manifest without replacing the daemon`,async t=>{
 const old=JSON.parse(fs.readFileSync(path.join(pinRoot,version+'.json')));
 assert.equal(old.version,version);assert.equal(digest(old),expectedDigest);
 const f=fixture(t,old);
 f.objects.set(f.installPath+'/previous.json',{version:old.version,digest:digest(old),versionPath:f.versionPath});
 const before=JSON.stringify([...f.objects]);
 const probe=await f.installer.probe(f.client);
 assert.equal(probe.daemonVersion,version);assert.equal(probe.reuseCompatible,true);assert.equal(probe.installNeeded,false);
 const installed=await f.installer.install(f.client,probe,'retained-connection');assert.equal(installed.version,version);
 const preview=await f.installer.maintenancePreview(f.client);assert.equal(preview.daemonVersion,version);assert.equal(preview.targetVersion,'0.6.0-alpha.4');
 assert.deepEqual(f.writes,[]);assert.equal(JSON.stringify([...f.objects]),before);
 f.current.digest='0'.repeat(64);await assert.rejects(f.installer.probe(f.client),{code:'SSH_VERSION_CONFLICT'});
 assert.deepEqual(f.writes,[]);
});
