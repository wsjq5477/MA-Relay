const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {SshHost}=require('../electron/ssh-host.cjs');
const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
const {identity,endpoint,readLines}=require('../electron/coordinator.cjs');
const {startDaemon,socketPathFor}=require('../electron/machine-daemon.cjs');
const {FramedStream}=require('../electron/machine-protocol.cjs');
const {runtimeCapabilities,coordinatorCapabilities,MCP_OPEN_ACCESS_CAPABILITY,supportsMcpOpenAccess,supportsCurrentCoordinator}=require('../electron/runtime-capabilities.cjs');
const failure=code=>Object.assign(new Error(code),{code});
function directoryFor(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-mcp-routing-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return directory;}
function mcpHost(){
  return {calls:[],async call(method,params={}){this.calls.push({method,params:structuredClone(params)});
    if(method==='snapshot')return {agents:{items:[]},tasks:[],conversations:[]};
    if(method==='discover')return {items:[]};
    if(method==='environment')return {platform:'linux',home:'/home/controlled'};
    if(['mcp.status','mcp.probe','mcp.revoke','mcp.install','mcp.export','mcp.remove'].includes(method))return {nodeId:params.nodeId,adapter:params.adapter,method,state:method==='mcp.probe'?'probed':'revoked'};
    throw failure('METHOD');},close(){}};
}
function networkFixture(t){
  const directory=directoryFor(t),host=mcpHost();
  const router=new AgentNetwork({directory,platform:'linux',hostname:'Controlled',distributions:async()=>[],createHost:()=>host});
  t.after(()=>router.close());
  const machine=router.catalog.machines[0];
  return {directory,router,host,machine,node(overrides={}){
    const node={nodeId:'node-mcp',machineId:machine.machineId,adapter:'claude',executable:'/opt/claude',connected:true,managed:true,executionSupported:true,...overrides};
    router.network.nodes.push(node);router.saveNetwork();return node;
  }};
}
test('runtime capability negotiation marks MCP open access without changing ordinary coordinator requirements',()=>{
  assert(runtimeCapabilities.includes(MCP_OPEN_ACCESS_CAPABILITY));
  assert(!coordinatorCapabilities.includes(MCP_OPEN_ACCESS_CAPABILITY));
  // A previous coordinator advertising the old strict list is still "current" for
  // unrelated methods; only the MCP-specific marker gate may reject it.
  assert.equal(supportsCurrentCoordinator([...coordinatorCapabilities]),true);
  assert.equal(supportsCurrentCoordinator(runtimeCapabilities),true);
  assert.equal(supportsMcpOpenAccess([...coordinatorCapabilities]),false);
  assert.equal(supportsMcpOpenAccess(runtimeCapabilities),true);
  assert.equal(supportsMcpOpenAccess(undefined),false);
  assert.equal(supportsMcpOpenAccess([MCP_OPEN_ACCESS_CAPABILITY]),true);
});
test('coordinator-service accepts both new MCP methods and forwards them through the network to the host',async t=>{
  const f=networkFixture(t),node=f.node(),service=createCoordinatorService({directory:f.directory,network:f.router});t.after(()=>service.close());
  for(const method of ['mcp.probe','mcp.revoke']){
    const reply=await service.call({method,params:{nodeId:node.nodeId}});assert.equal(reply.ok,true,JSON.stringify(reply.error));
    assert.equal(reply.result.method,method);
    const call=f.host.calls.at(-1);assert.equal(call.method,method);assert.deepEqual(call.params,{nodeId:node.nodeId,adapter:'claude'});
  }
  const unknown=await service.call({method:'mcp.unknown',params:{nodeId:node.nodeId}});
  assert.equal(unknown.ok,false);assert.match(unknown.error.message,/桌面请求不合法/);assert.equal(f.host.calls.length,2);
  // AgentNetwork's own prepare()/call() whitelists must also accept the methods
  // directly, not only through the coordinator.
  const direct=await f.router.call('mcp.probe',(await f.router.prepare('mcp.probe',{nodeId:node.nodeId})).params);assert.equal(direct.method,'mcp.probe');
});
async function daemonClient(t,options){
  const socket=net.createConnection(socketPathFor(options.stateDirectory)),channel=new FramedStream(socket),pending=new Map();let counter=0;
  channel.on('error',error=>{for(const job of pending.values())job.reject(error);pending.clear();});
  channel.on('close',()=>{for(const job of pending.values())job.reject(failure('DAEMON_TRANSPORT'));pending.clear();});
  channel.on('frame',frame=>{const job=pending.get(frame.id);if(!job)return;pending.delete(frame.id);clearTimeout(job.timer);frame.error?job.reject(Object.assign(new Error(frame.error.message),{code:frame.error.code})):job.resolve(frame.result);});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id='test-'+ ++counter,timer=setTimeout(()=>{pending.delete(id);reject(failure('TEST_TIMEOUT'));},3000);pending.set(id,{resolve,reject,timer});try{channel.send({id,method,params});}catch(error){clearTimeout(timer);pending.delete(id);reject(error);}});
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
  t.after(()=>channel.close());
  const peer=await call('hello',{protocolVersion:2,coordinatorId:options.ownerCoordinatorId,profileId:options.profileId,nonce:'nonce-'+Math.random().toString(16).slice(2)});
  return {peer,call};
}
test('daemon advertises the capability, allows read-only probe during maintenance, and blocks revocation like other configuration mutations',async t=>{
  const root=directoryFor(t),options={stateDirectory:path.join(root,'state'),ownerCoordinatorId:'coordinator-test',profileId:'profile-test',monitorIntervalMs:0};
  const host=mcpHost(),daemon=await startDaemon({...options,hostFactory:()=>host});t.after(()=>daemon.close());
  const {peer,call}=await daemonClient(t,options);
  assert(peer.capabilities.includes(MCP_OPEN_ACCESS_CAPABILITY),'the daemon advertises the MCP capability');
  const quiesce=await call('daemon.quiesce',{operationId:'maint-mcp'});assert.equal(quiesce.quiescent,true);
  const probe=await call('mcp.probe',{nodeId:'node-mcp',adapter:'claude'});assert.equal(probe.state,'probed');assert.equal(host.calls.at(-1).method,'mcp.probe');
  assert.equal((await call('mcp.status',{nodeId:'node-mcp',adapter:'claude'})).nodeId,'node-mcp');
  await assert.rejects(call('mcp.remove',{nodeId:'node-mcp',adapter:'claude'}),{code:'DAEMON_MAINTENANCE'});
  await assert.rejects(call('mcp.revoke',{nodeId:'node-mcp',adapter:'claude'}),{code:'DAEMON_MAINTENANCE'});
  assert.equal(host.calls.filter(c=>c.method==='mcp.revoke').length,0);
  await call('daemon.releaseMaintenance',{operationId:'maint-mcp'});
  const revoked=await call('mcp.revoke',{nodeId:'node-mcp',adapter:'claude'});assert.equal(revoked.method,'mcp.revoke');
});
test('an old remote daemon without the capability yields an explicit upgrade error before any frame is sent',async t=>{
  const directory=directoryFor(t),connection={stage:'online',mcpOpenAccess:false},requests=[];
  const sshHost=new SshHost({dropTransport(){},touch(){}},connection);sshHost.request=async(method,params)=>{requests.push({method,params});return {nodeId:params?.nodeId,adapter:params?.adapter,state:'ok'};};
  const router=new AgentNetwork({directory,platform:'linux',hostname:'Controlled',distributions:async()=>[],createHost:()=>sshHost});t.after(()=>router.close());
  router.catalog.machines.push({machineId:'ssh-old',name:'Old Linux',kind:'ssh',platform:'linux',online:true,stage:'online',mcpOpenAccess:false});router.save();
  router.network.nodes.push({nodeId:'old-node',machineId:'ssh-old',adapter:'claude',executable:'/opt/claude',connected:true,managed:true,executionSupported:true});router.saveNetwork();
  for(const method of ['mcp.status','mcp.revoke','mcp.probe'])
    await assert.rejects(router.call(method,{nodeId:'old-node',machineId:'ssh-old'}),error=>error.code==='MCP_BACKEND_UPGRADE_REQUIRED'&&/升级后台/.test(error.message));
  assert.equal(requests.length,0,'no MCP frame reaches an old daemon');
  // A method the old daemon does implement keeps working; the gate is MCP-specific.
  await sshHost.call('mcp.remove',{nodeId:'old-node',adapter:'claude'});assert.equal(requests.at(-1).method,'mcp.remove');
  // A daemon that advertised the capability is not gated.
  connection.mcpOpenAccess=true;
  assert.equal((await router.call('mcp.probe',{nodeId:'old-node',machineId:'ssh-old'})).state,'ok');
  assert.equal(requests.at(-1).method,'mcp.probe');
});
test('probe and revoke require a connected non-removed node while status keeps its existing contract',async t=>{
  const f=networkFixture(t),node=f.node(),service=createCoordinatorService({directory:f.directory,network:f.router});t.after(()=>service.close());
  f.router.node(node.nodeId).removed=true;f.router.saveNetwork();
  for(const method of ['mcp.probe','mcp.revoke']){
    const reply=await service.call({method,params:{nodeId:node.nodeId}});assert.equal(reply.ok,false);assert.equal(reply.error.code,'NODE_DISCONNECTED');
  }
  const status=await service.call({method:'mcp.status',params:{nodeId:node.nodeId}});assert.equal(status.ok,true,JSON.stringify(status.error));
  f.router.node(node.nodeId).removed=false;f.router.node(node.nodeId).connected=false;f.router.saveNetwork();
  for(const method of ['mcp.probe','mcp.revoke']){
    const reply=await service.call({method,params:{nodeId:node.nodeId}});assert.equal(reply.error.code,'NODE_DISCONNECTED');
  }
  // A removed machine is refused by machine admission before any MCP work.
  f.router.node(node.nodeId).connected=true;f.router.network.removedMachines=[node.machineId];f.router.saveNetwork();
  for(const method of ['mcp.probe','mcp.revoke']){
    const reply=await service.call({method,params:{nodeId:node.nodeId}});assert.equal(reply.ok,false);assert.equal(reply.error.code,'MACHINE_REMOVED');
  }
  f.router.network.removedMachines=[];f.router.saveNetwork();
});
test('an offline remote machine refuses MCP methods before any capability or native read',async t=>{
  const connection={stage:'disconnected',mcpOpenAccess:false},requests=[],host=new SshHost({dropTransport(){},touch(){}},connection);
  host.request=async(method,params)=>{requests.push({method,params});return {};};
  for(const method of ['mcp.status','mcp.revoke','mcp.probe'])await assert.rejects(host.call(method,{nodeId:'node-mcp',adapter:'claude'}),{code:'MACHINE_OFFLINE'});
  assert.equal(requests.length,0);
});
test('an old coordinator without the capability is told to upgrade for MCP facts only',async t=>{
  const directory=directoryFor(t),owner=identity(directory),calls=[],sockets=new Set();let capabilities=[...coordinatorCapabilities];
  const server=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});let ready=false;
    readLines(socket,input=>{if(!ready){ready=true;socket.write(JSON.stringify({hello:true,protocol:2,coordinatorId:owner.coordinatorId,version:'controlled-old',capabilities})+'\n');return;}
      calls.push({method:input.method,params:input.params});socket.write(JSON.stringify({id:input.id,result:{accepted:true}})+'\n');});});
  await new Promise(resolve=>server.listen(endpoint(directory),resolve));
  t.after(async()=>{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));});
  const client=new CoordinatorClient({directory});t.after(()=>client.close());
  // Unrelated calls keep the unchanged generic coordinator check.
  assert.deepEqual(await client.request('call',{method:'snapshot',params:{}}),{accepted:true});
  for(const method of ['mcp.status','mcp.revoke','mcp.probe'])
    await assert.rejects(client.request('call',{method,params:{nodeId:'node-mcp'}}),error=>error.code==='MCP_BACKEND_UPGRADE_REQUIRED'&&/停止后台并退出/.test(error.message));
  assert.deepEqual(calls.map(call=>call.method),['call'],'no MCP request reaches the old coordinator');
  client.close();capabilities=[...runtimeCapabilities];
  assert.deepEqual(await client.request('call',{method:'mcp.probe',params:{nodeId:'node-mcp'}}),{accepted:true});
  assert.deepEqual(calls.at(-1).params,{method:'mcp.probe',params:{nodeId:'node-mcp'}});
});

test('OpenDesk native writes require the remote lifecycle marker while reads and revocation stay available',async()=>{
 const {SshHost}=require('../electron/ssh-host.cjs'),connection={stage:'online',mcpOpenAccess:true},host=new SshHost({},connection),calls=[];host.request=async(m,p)=>{calls.push(m);return {};};const p={nodeId:'original',adapter:'opendesk-desktop'};
 for(const method of ['mcp.install','mcp.remove'])await assert.rejects(host.call(method,p),{code:'MCP_BACKEND_UPGRADE_REQUIRED'});assert.deepEqual(calls,[]);for(const method of ['mcp.status','mcp.revoke','mcp.probe'])await host.call(method,p);assert.deepEqual(calls,['mcp.status','mcp.revoke','mcp.probe']);connection.openDeskMcpLifecycle=true;await host.call('mcp.install',p);assert.equal(calls.at(-1),'mcp.install');
});

test('stopped OpenDesk original node can configure while disconnected without enabling other adapters or removed identities',async t=>{
 const f=networkFixture(t),node=f.node({adapter:'opendesk-desktop',connected:false});const result=await f.router.call('mcp.install',{nodeId:node.nodeId});assert.equal(result.method,'mcp.install');assert.equal(f.host.calls.filter(c=>c.method==='mcp.install').length,1);node.removed=true;await assert.rejects(f.router.call('mcp.install',{nodeId:node.nodeId}),{code:'NODE_DISCONNECTED'});delete node.removed;node.adapter='claude';await assert.rejects(f.router.call('mcp.install',{nodeId:node.nodeId}),{code:'NODE_DISCONNECTED'});
});
