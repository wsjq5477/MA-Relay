const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createHash}=require('node:crypto'),{EventEmitter}=require('node:events'),{Readable}=require('node:stream');
const {SshInstaller,remoteExec}=require('../electron/ssh-install.cjs');
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
 const client={sftp(cb){cb(null,sftp);},exec(command,options,cb){commands.push(command);const stream=new EventEmitter();stream.stderr=new EventEmitter();stream.close=()=>{};stream.end=input=>queueMicrotask(()=>{const probe=command==='/bin/sh -s';stream.emit('data',Buffer.from(probe?['AGENTBRIDGE_PROBE_V2','Linux','x86_64','1000','u','/home/u','glibc 2.32','9999999','/usr/bin/node','22.23.1','','END_AGENTBRIDGE_PROBE',''].join('\n'):'{"verified":true}'));stream.emit('close',!probe&&failVerify?1:0);});cb(null,stream);}};
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return {directory,installer,client,current,old,objects,commands,writes,unsafe,installPath,versionPath,setFailVerify(){failVerify=true;}};
}
test('a newer client reuses its pinned compatible daemon without upload, activation or remote state writes',async t=>{
 const f=fixture(t),before=JSON.stringify([...f.objects]);const probe=await f.installer.probe(f.client);
 assert.equal(probe.daemonVersion,'0.6.0-alpha.2');assert.equal(probe.clientDaemonVersion,'0.6.0-alpha.4');assert.equal(probe.reuseCompatible,true);assert.equal(probe.installNeeded,false);
 // A stale/missing presentation flag cannot bypass release selection.
 probe.reuseCompatible=false;const result=await f.installer.install(f.client,probe,'reuse');assert.equal(result.version,'0.6.0-alpha.2');assert.equal(result.versionPath,f.versionPath);assert.deepEqual(f.writes,[]);assert.equal(JSON.stringify([...f.objects]),before);
 assert.equal(f.commands.length,2);assert(!f.commands.some(c=>/tar|kill|daemon.cjs/.test(c)));
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
 ['0.6.0-alpha.26','6674f37902908e329ce76cb634d6ebae36c55f33f8e7ad836488986b10879c4e']
])test(`published ${version} reconnects and previews upgrade using its exact frozen manifest without replacing the daemon`,async t=>{
 const old=require('../compatible-daemons/'+version+'.json');
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
