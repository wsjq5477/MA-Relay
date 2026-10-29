const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{Readable}=require('node:stream');
const {generateKeyPairSync,createHash}=require('node:crypto'),{Server}=require('ssh2');
const runtimeRoot=process.env.AGENTBRIDGE_VERIFY_SSH_RUNTIME;
const {SshManager}=require(runtimeRoot?path.join(runtimeRoot,'desktop/electron/ssh-host.cjs'):'../electron/ssh-host.cjs');

test('real loopback SSH authentication and production probe reject an unlisted daemon without stale evidence or remote writes',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-ssh-unlisted-')),packageDirectory=path.join(directory,'package');fs.mkdirSync(packageDirectory);
  const payload=Buffer.from('controlled runtime; never executed');fs.writeFileSync(path.join(packageDirectory,'node'),payload);
  fs.writeFileSync(path.join(packageDirectory,'manifest.json'),JSON.stringify({version:'synthetic-public',protocolVersion:2,platform:'linux',arch:'x64',runtime:{path:'node',version:'24.12.0'},files:[{path:'node',size:payload.length,sha256:createHash('sha256').update(payload).digest('hex')}],compatibleDaemons:[]}));
  const peers=new Set(),states=[],objects=new Map(),commands=[];let authentications=0,writes=0;
  const hostKey=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'}}).privateKey;
  const server=new Server({hostKeys:[hostKey]},peer=>{
    peers.add(peer);peer.on('error',()=>{});peer.on('close',()=>peers.delete(peer));
    peer.on('authentication',ctx=>{authentications++;ctx.method==='password'&&ctx.password==='synthetic'?ctx.accept():ctx.reject();});
    peer.on('ready',()=>peer.on('session',accept=>accept().on('exec',(acceptExec,_reject,info)=>{
      commands.push(info.command);assert.equal(info.command,'/bin/sh -s');const channel=acceptExec();channel.on('data',()=>{});
      channel.on('end',()=>{channel.exit(0);channel.end(['AGENTBRIDGE_PROBE_V2','Linux','x86_64','1000','fixture','/home/fixture','glibc 2.32','9999999','/usr/bin/node','24.12.0','','END_AGENTBRIDGE_PROBE',''].join('\n'));});
    })));
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const manager=new SshManager({directory:path.join(directory,'profile'),coordinatorId:'synthetic-owner',packageDirectory,onChange:s=>states.push(structuredClone(s)),knownHosts:{check:()=>({trusted:true,fingerprint:'synthetic-host-key',keyType:'ssh-rsa'})}});
  t.after(async()=>{manager.close();for(const peer of peers)peer.end();await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});});
  const installPath='/home/fixture/.local/share/agentbridge/profiles/'+manager.installer.profileId;
  objects.set(installPath+'/install.json',{kind:'agentbridge-install',ownerCoordinatorId:'synthetic-owner',profileId:manager.installer.profileId});
  objects.set(installPath+'/current.json',{version:'synthetic-unlisted',digest:'a'.repeat(64),versionPath:installPath+'/versions/synthetic-unlisted'});
  objects.set(installPath+'/synthetic-original-ledger.json',{tasks:[{status:'unknown'}],requests:['original'],delegations:['original'],unknown:['original']});
  const before=JSON.stringify([...objects]);
  const sftp={end(){},lstat(file,cb){cb(null,{uid:1000,isDirectory:()=>!objects.has(file),isFile:()=>objects.has(file),isSymbolicLink:()=>false});},createReadStream:file=>Readable.from([Buffer.from(JSON.stringify(objects.get(file)))])};
  for(const method of ['mkdir','chmod','rename','createWriteStream','write','unlink'])sftp[method]=()=>{writes++;throw Error('remote mutation forbidden');};
  const authenticate=manager.authenticate.bind(manager);manager.authenticate=async c=>{const client=await authenticate(c);client.sftp=cb=>cb(null,sftp);return client;};
  const draft=await manager.call('machine.createSshDraft',{host:'127.0.0.1',port:server.address().port,username:'fixture',authKind:'password'}),connection=manager.connections.find(c=>c.connectionId===draft.connectionId);
  connection.machineId='synthetic-machine';connection.daemonId='synthetic-daemon';connection.identity={profileId:manager.installer.profileId,daemonId:connection.daemonId,machineId:connection.machineId};
  const originalIdentity=structuredClone(connection.identity);
  await manager.call('credential.provide',{connectionId:connection.connectionId,secret:'synthetic',save:false});
  connection.probe={previewId:'obsolete-success',daemonVersion:'obsolete'};
  await assert.rejects(manager.connect(connection,{operationId:'synthetic-first'},true),{code:'SSH_DAEMON_UPGRADE_REQUIRED'});
  assert.equal(manager.publicState(connection).probe,undefined);assert.equal(connection.stage,'disconnected');assert.equal(connection.error.retryable,false);
  assert(states.filter(s=>s.stage==='inspecting').every(s=>!s.probe&&!s.error));
  manager.scheduleReconnect(connection,true);assert.equal(manager.reconnectTimers.size,0);
  await manager.call('credential.provide',{connectionId:connection.connectionId,secret:'synthetic',save:false});
  await assert.rejects(manager.connect(connection,{operationId:'synthetic-explicit-retry'},true),{code:'SSH_DAEMON_UPGRADE_REQUIRED'});
  assert(authentications>=2);assert.equal(commands.length,2);assert.equal(writes,0);assert.equal(JSON.stringify([...objects]),before);assert.deepEqual(manager.operations,{});
  assert.deepEqual(connection.identity,originalIdentity);assert.equal(connection.daemonId,originalIdentity.daemonId);assert.equal(connection.machineId,originalIdentity.machineId);
  const reopened=new SshManager({directory:path.join(directory,'profile'),coordinatorId:'synthetic-owner',packageDirectory});
  try{await reopened.start();assert.equal(reopened.reconnectTimers.size,0);assert.equal(reopened.connections[0].error.code,'SSH_DAEMON_UPGRADE_REQUIRED');}finally{reopened.close();}
});
