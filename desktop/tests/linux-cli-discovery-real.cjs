// Real installed CLI --version through production daemon and TCP SSH relay.
// SSH endpoint/installer are isolated stand-ins, not the user's remote server.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),assert=require('node:assert/strict');
const {generateKeyPairSync}=require('node:crypto'),{Server}=require('../../node_modules/ssh2');
const packageRoot=process.env.AGENTBRIDGE_DISCOVERY_PACKAGE;
const modules=packageRoot?path.resolve(packageRoot,'desktop/electron'):path.resolve(__dirname,'../electron');
const {MachineHost}=require(path.join(modules,'machine-host.cjs')),{startDaemon}=require(path.join(modules,'machine-daemon.cjs')),{SshManager}=require(path.join(modules,'ssh-host.cjs'));
if(process.platform!=='linux')throw Error('Linux required');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-linux-discovery-')),clients=new Set(),sockets=new Set();
const report={date:new Date().toISOString(),version:require('../package.json').version,environment:'Linux real CLI version probes / minimal PATH / production daemon and relay / isolated TCP SSH endpoint',productionModules:packageRoot?'release-package':'source',status:'running',checks:[],nativePrompts:0};
const output=process.env.AGENTBRIDGE_DISCOVERY_REPORT||path.resolve(__dirname,'../../artifacts/linux-cli-discovery/2026-10-14/real-cli-ssh.json');
let daemon,server,manager;
(async()=>{
 const home=os.homedir(),environment={...process.env,PATH:'/usr/local/bin:/usr/bin:/bin'};
 delete environment.Path;
 const stateDirectory=path.join(directory,'state');
 const legacy={async call(method){if(method==='snapshot')return {environment:{home},agents:{items:[],revision:0},tasks:[],conversations:[]};throw Error('No native execution allowed in discovery verification');},close(){}};
 daemon=await startDaemon({stateDirectory,ownerCoordinatorId:'discovery-fixture',profileId:'discovery-fixture',monitorIntervalMs:0,hostFactory:()=>new MachineHost({directory:path.join(stateDirectory,'native'),home,environment,legacy})});
 const hostKey=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'}}).privateKey;
 server=new Server({hostKeys:[hostKey]},peer=>{clients.add(peer);peer.on('error',()=>{});peer.on('close',()=>clients.delete(peer));peer.on('authentication',ctx=>ctx.method==='password'&&ctx.password==='controlled'?ctx.accept():ctx.reject(['password']));peer.on('ready',()=>peer.on('session',accept=>{const session=accept();session.on('exec',(acceptExec,reject,info)=>{const channel=acceptExec();if(info.command.includes('machine-daemon.cjs')){channel.exit(0);channel.end(JSON.stringify(daemon.info));}else if(info.command.includes('machine-relay.cjs')){const socket=net.createConnection(daemon.info.socketPath);sockets.add(socket);socket.on('error',()=>channel.close());socket.on('close',()=>sockets.delete(socket));channel.on('close',()=>socket.destroy());channel.pipe(socket).pipe(channel);}else{reject?.();channel.close();}});}));});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const installer={async probe(){return {previewId:'discovery-fixture',uid:process.getuid(),arch:'x64',installNeeded:false,installPath:directory};},async install(){return {node:process.execPath,versionPath:directory,stateDirectory,profileId:daemon.info.profileId,version:require('../package.json').version};}};
 manager=new SshManager({directory:path.join(directory,'client'),coordinatorId:'discovery-fixture',installer,openSshFiles:[]});
 const draft=await manager.call('machine.createSshDraft',{host:'127.0.0.1',port:server.address().port,username:'fixture',authKind:'password'}),connection=manager.find(draft);
 await manager.call('credential.provide',{connectionId:connection.connectionId,secret:'controlled',save:false});let probe=await manager.call('machine.testSsh',{connectionId:connection.connectionId});assert(probe.trustChallenge);
 await manager.call('machine.trustHost',{connectionId:connection.connectionId,challengeId:probe.trustChallenge.challengeId,fingerprint:probe.trustChallenge.fingerprint});await manager.call('machine.testSsh',{connectionId:connection.connectionId});await manager.call('machine.connectSsh',{connectionId:connection.connectionId,operationId:'discovery-fixture',installIfNeeded:false});
 const one=await manager.host(connection).call('discover',{}),two=await manager.host(connection).call('discover',{});
 const codex=one.items.find(i=>i.adapter==='codex');assert(codex?.healthy,'Installed Linux Codex CLI must be discoverable with daemon PATH');assert.equal(codex.executable,two.items.find(i=>i.adapter==='codex')?.executable);
 report.tools=one.items.map(({adapter,healthy,version})=>({adapter,healthy,version}));
 report.checks.push('Actual Linux Codex CLI version probe succeeds through authenticated SSH relay with minimal non-interactive PATH');report.checks.push('Repeated discovery retains canonical executable identity; no native submit or model request');
 report.status='passed';
})().catch(error=>{report.status='failed';report.error={code:error.code,message:error.message};process.exitCode=1;}).finally(async()=>{manager?.close();for(const client of clients)client.end();for(const socket of sockets)socket.destroy();if(server?.listening)await new Promise(resolve=>server.close(resolve));await daemon?.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');fs.rmSync(directory,{recursive:true,force:true});console.log(JSON.stringify(report));});
