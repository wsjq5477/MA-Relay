const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
const {identity,endpoint,readLines}=require('../electron/coordinator.cjs');
const {SshHost}=require('../electron/ssh-host.cjs');
const {supportsRecovery,RECOVERY_CAPABILITY}=require('../electron/runtime-capabilities.cjs');
test('new frontend blocks old coordinator semantics while authenticated settings and explicit shutdown stay usable',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-old-central-')),owner=identity(directory),calls=[];let capabilities;
 const sockets=new Set();const server=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let ready=false;readLines(socket,input=>{
  if(!ready){assert.equal(input.auth,owner.token);ready=true;socket.write(JSON.stringify({hello:true,protocol:2,coordinatorId:owner.coordinatorId,version:'0.6.0-alpha.29',capabilities})+'\n');return;}
  calls.push(input.method);socket.write(JSON.stringify({id:input.id,result:{version:'0.6.0-alpha.29'}})+'\n');
 });});await new Promise(r=>server.listen(endpoint(directory),r));const client=new CoordinatorClient({directory});
 t.after(async()=>{client.close();for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));fs.rmSync(directory,{recursive:true,force:true});});
 await assert.rejects(client.request('call',{method:'snapshot',params:{}}),e=>e.code==='COORDINATOR_UPGRADE_REQUIRED'&&e.message.includes('停止后台并退出'));
 assert.deepEqual(calls,[]);await client.request('preferences');await client.request('shutdown');assert.deepEqual(calls,['preferences','shutdown']);
 client.close();capabilities=[RECOVERY_CAPABILITY];await client.request('call',{method:'snapshot',params:{}});assert.equal(calls.at(-1),'call');
});
test('old daemon remains observable and maintainable but cannot dispatch or misroute object reads and controls',async()=>{
 const connection={stage:'online',objectRoutingSupported:false},host=new SshHost({},connection),calls=[];
 host.request=async(method,p)=>{calls.push({method,p});return {original:true};};
 for(const op of ['task','conversation','pending','reply','cancel','operation','continue','submit','reconcile'])await assert.rejects(host.call('ipc',{op,taskId:'original',conversationId:'original',requestId:'original'}),{code:'DAEMON_UPGRADE_REQUIRED'});
 await assert.rejects(host.call('context',{}),{code:'DAEMON_UPGRADE_REQUIRED'});assert.equal(calls.length,0);
 for(const method of ['snapshot','discover','daemon.receiptRead','daemon.eventRead'])await host.call(method,{});
 await host.call('ipc',{op:'request',requestId:'original'});assert.equal(calls.length,5);
 connection.objectRoutingSupported=true;await host.call('ipc',{op:'task',taskId:'original'});assert.equal(calls.at(-1).p.taskId,'original');
 assert.equal(supportsRecovery(undefined),false);assert.equal(supportsRecovery([RECOVERY_CAPABILITY]),true);
});

test('maintenance controller stages its full dependency closure including runtime capabilities',async t=>{
 if(process.platform==='win32')return;
 const {SshInstaller}=require('../electron/ssh-install.cjs'),{EventEmitter}=require('node:events'),{execFileSync}=require('node:child_process');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-maint-stage-')),version='0.6.0-stage',versionPath=path.join(directory,'install/versions',version),stateDirectory=path.join(directory,'state');
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));fs.mkdirSync(path.join(versionPath,'desktop/electron'),{recursive:true});fs.mkdirSync(path.join(versionPath,'runtime'));fs.mkdirSync(stateDirectory,{mode:0o700});
 fs.writeFileSync(path.join(versionPath,'package.json'),JSON.stringify({version}));fs.copyFileSync(process.execPath,path.join(versionPath,'runtime/node'));fs.writeFileSync(path.join(versionPath,'runtime/owned-stop'),'synthetic');
 for(const name of ['machine-daemon.cjs','machine-protocol.cjs','remote-maintenance.cjs','runtime-capabilities.cjs'])fs.copyFileSync(path.resolve(__dirname,'../electron',name),path.join(versionPath,'desktop/electron',name));
 const bundle={manifest:{version},digest:'synthetic'},installer=new SshInstaller({directory,coordinatorId:'synthetic'});installer.bundle=()=>bundle;installer.install=async()=>{};
 const client={exec(_command,_options,done){const stream=new EventEmitter();stream.stderr=new EventEmitter();stream.close=()=>{};stream.end=script=>{try{const output=execFileSync(process.execPath,['-'],{input:script});queueMicrotask(()=>{stream.emit('data',output);stream.emit('close',0);});}catch(error){queueMicrotask(()=>{stream.emit('close',error.status||1);});}};done(null,stream);}};
 const staged=await installer.stageMaintenance(client,{stateDirectory,uid:process.getuid(),installPath:path.join(directory,'install')},'stage');
 execFileSync(process.execPath,['-e','require(process.argv[1])',path.join(staged.directory,'desktop/electron/remote-maintenance.cjs')]);
 assert.equal(require(path.join(staged.directory,'desktop/electron/runtime-capabilities.cjs')).supportsRecovery([RECOVERY_CAPABILITY]),true);
});
