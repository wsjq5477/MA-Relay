const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {MachineHost}=require('../electron/machine-host.cjs');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {installation,connectionId}=require('../electron/adapter-identity.cjs');
function setup(t){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-browser-network-'));
  const profiles=['profile-a','profile-b'],listeners=new Map(),calls=[];
  const channel={pairing:{list:()=>profiles.map(browserInstanceId=>({browserInstanceId,pairingId:browserInstanceId,state:'committed'}))},forInstance:browserInstanceId=>({online:true,knownProfiles:()=>[...profiles],request:async(method,p)=>{calls.push({browserInstanceId,method,p});return method==='health.check'?{enabled:true}:{requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId};},subscribe:(executionId,fn)=>{listeners.set(executionId,fn);return ()=>listeners.delete(executionId);}})};
  const legacy={async call(method){if(method==='snapshot')return {agents:{items:[]},tasks:[],conversations:[]};if(method==='ipc')throw Object.assign(Error('missing'),{code:'NOT_FOUND'});throw Error('Unexpected legacy mutation.');},close(){}};
  const host=new MachineHost({directory:path.join(directory,'machine'),legacy,browserChannel:channel,home:directory,environment:{PATH:'',Path:'',APPDATA:path.join(directory,'empty')},platform:'linux'});
  const options={directory,platform:'linux',createHost:()=>host};const network=new AgentNetwork(options);
  t.after(()=>{network.close();fs.rmSync(directory,{recursive:true,force:true});});
  const raw=id=>{const row=host.rows.find(r=>r.browserInstanceId===id);return host.backend(row);};
  const emit=async(id,kind,seq,data={})=>{const backend=raw(id),task=backend.store.read().tasks.at(-1);return listeners.get(task.executionId)({requestId:task.requestId,taskId:task.taskId,executionId:task.executionId,bridgeSessionId:task.conversationId,browserInstanceId:id,bindingRevision:task.bindingRevision,leaseEpoch:task.leaseEpoch,kind,seq,...data});};
  return {directory,host,network,profiles,calls,raw,emit,options};
}
async function attach(f,id){const snapshot=await f.network.snapshot(),node=snapshot.nodes.find(n=>n.browserInstanceId===id);assert.ok(node);await f.network.call('manageNode',{action:'attach',nodeId:node.nodeId,operationId:'attach-'+id});return node;}
const start=(f,node,id)=>f.network.call('nodeRequest',{nodeId:node.nodeId,requestId:id,message:'Controlled browser task'});
async function finish(f,id){await f.emit(id,'submitted',1,{binding:{sessionKey:'session-'+id,userAnchor:'user-'+id,documentId:'doc-'+id}});await f.emit(id,'completed',2,{text:'Result '+id,continuation:{transcriptFingerprint:'a'.repeat(64),assistantAnchor:'assistant-'+id,historyRevision:2}});}

test('typed browser identity has no executable and preserves native connection hashing',()=>{
  const machine={machineId:'machine',kind:'windows'};
  assert.equal(installation(machine,{adapter:'claude',executable:'C:/TOOLS/CLAUDE.EXE'}),'c:/tools/claude.exe');
  assert.notEqual(connectionId(machine,{adapter:'chatgpt-web',browserInstanceId:'a'}),connectionId(machine,{adapter:'chatgpt-web',browserInstanceId:'b'}));
  assert.throws(()=>installation(machine,{adapter:'chatgpt-web',executable:'fake.exe'}),{code:'BROWSER_IDENTITY'});
});

test('discovery retains two independent profile nodes without fake executables or superseded aliases',async t=>{
  const f=setup(t);const first=await f.network.snapshot(),nodes=first.nodes.filter(n=>n.adapter==='chatgpt-web');
  assert.equal(nodes.length,2);assert.equal(nodes[0].executable,undefined);assert.notEqual(nodes[0].nodeId,nodes[1].nodeId);
  assert.equal(nodes.some(n=>n.supersededBy),false);assert.equal(nodes.every(n=>n.connectionCapabilities.mcpClient===false),true);
  const again=await f.network.snapshot();assert.deepEqual(again.nodes.map(n=>n.nodeId),nodes.map(n=>n.nodeId));
  assert.equal(f.calls.some(c=>c.method==='message.send'),false);
});

test('original nodeRequest traverses Registry/MachineHost/Router and reads the qualified original result',async t=>{
  const f=setup(t),node=await attach(f,'profile-a');const task=await start(f,node,'request-1');await Promise.all([...f.raw('profile-a').jobs]);
  assert.ok(task.taskId.includes('::'));assert.equal(f.calls.filter(c=>c.method==='message.send').length,1);
  await finish(f,'profile-a');
  const result=await f.network.call('ipc',{op:'task',taskId:task.taskId});assert.equal(result.status,'succeeded');assert.equal(result.result.message,'Result profile-a');
  const original=await f.network.call('nodeRequest',{nodeId:node.nodeId,requestId:'request-1',message:'Controlled browser task'});
  assert.equal(original.taskId,task.taskId);assert.equal(f.calls.filter(c=>c.method==='message.send').length,1);
  const snapshot=await f.network.snapshot();assert.equal(snapshot.nodes.find(n=>n.nodeId===node.nodeId).busy,false);
});

test('session close follows original task routing and Coordinator control journaling without changing its Task result',async t=>{
  const f=setup(t),node=await attach(f,'profile-a'),task=await start(f,node,'close-original');await Promise.all([...f.raw('profile-a').jobs]);await finish(f,'profile-a');
  const original=f.raw('profile-a').channel.request;f.raw('profile-a').channel.request=async(method,p)=>({...await original(method,p),...(method==='session.close'?{closed:true}:{})});
  const directory=path.join(f.directory,'coordinator');fs.mkdirSync(directory);
  const service=require('../electron/coordinator-service.cjs').createCoordinatorService({directory,network:f.network,platform:'linux'});
  const params={op:'session.close',taskId:task.taskId,executionId:task.executionId,operationId:'close-network',expectedRevision:1};
  const accepted=await service.call({method:'ipc',params});assert.equal(accepted.ok,true);assert.equal(accepted.result.state,'unknown');
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'pending.json')))[0].op,'session.close');await Promise.all([...f.raw('profile-a').jobs]);
  const receipt=await service.call({method:'ipc',params:{op:'operation',taskId:task.taskId,operationId:params.operationId}});assert.equal(receipt.result.state,'confirmed');assert.equal(receipt.result.taskId,task.taskId);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'pending.json')))[0].state,'confirmed');
  assert.equal((await f.network.call('ipc',{op:'task',taskId:task.taskId})).status,'succeeded');
  assert.equal((await f.network.call('ipc',{op:'conversation',conversationId:task.conversationId})).canContinue,false);
  assert.equal(f.calls.filter(c=>c.method==='session.close').length,1);
});
test('original session health follows object routing without allocating a central control or changing Task state',async t=>{
  const f=setup(t),node=await attach(f,'profile-a'),task=await start(f,node,'health-original');await Promise.all([...f.raw('profile-a').jobs]);await finish(f,'profile-a');
  const backend=f.raw('profile-a'),before=JSON.stringify(backend.store.read()),calls=[];
  backend.channel.request=async(method,p)=>{calls.push({method,p});return {adapterId:p.adapterId,browserInstanceId:p.browserInstanceId,requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId,probeId:p.probeId,enabled:true,domChecked:true,pageReady:true,loginChecked:false,sessionClosed:false,blocked:false};};
  const directory=path.join(f.directory,'health-coordinator');fs.mkdirSync(directory);const service=require('../electron/coordinator-service.cjs').createCoordinatorService({directory,network:f.network,platform:'linux'});
  const reply=await service.call({method:'ipc',params:{op:'session.health',taskId:task.taskId,probeId:'probe-network'}});assert.equal(reply.ok,true);assert.equal(reply.result.ready,true);assert.equal(reply.result.taskId,task.taskId);assert.equal(reply.result.machineId,node.machineId);
  assert.deepEqual(calls.map(c=>c.method),['health.check']);assert.equal(JSON.stringify(backend.store.read()),before);const file=path.join(directory,'pending.json');assert.equal(fs.existsSync(file)?JSON.parse(fs.readFileSync(file)).length:0,0);
});
test('a new pairing cannot bypass unknown close even when the original Task already succeeded',async t=>{
  const f=setup(t),a=await attach(f,'profile-a'),b=await attach(f,'profile-b'),task=await start(f,a,'close-unknown-original');await Promise.all([...f.raw('profile-a').jobs]);await finish(f,'profile-a');
  const receipt=await f.network.call('ipc',{op:'session.close',taskId:task.taskId,operationId:'close-unknown',expectedRevision:1});await Promise.all([...f.raw('profile-a').jobs]);assert.equal(receipt.knownBrowserInstances,undefined);
  assert.equal((await f.network.call('ipc',{op:'task',taskId:task.taskId})).status,'succeeded');
  f.profiles.push('late-close-alias');await f.network.call('discover',{machineId:a.machineId});const replacement=await attach(f,'late-close-alias');
  await assert.rejects(start(f,replacement,'bypass-close'),{code:'BROWSER_RESOURCE_UNCONFIRMED'});
  const other=await start(f,b,'known-independent');assert.ok(other.taskId);await Promise.all([...f.raw('profile-b').jobs]);assert.equal(f.calls.filter(c=>c.method==='message.send').length,2);
});

test('known independent profile can run while the original profile stays unknown',async t=>{
  const f=setup(t),a=await attach(f,'profile-a'),b=await attach(f,'profile-b');
  await start(f,a,'request-a');await Promise.all([...f.raw('profile-a').jobs]);await f.emit('profile-a','unknown',1,{text:'lost original response'});
  await assert.rejects(start(f,a,'alias-request'),{code:'AGENT_BUSY'});
  const other=await start(f,b,'request-b');await Promise.all([...f.raw('profile-b').jobs]);assert.ok(other.taskId);
  assert.equal(f.calls.filter(c=>c.method==='message.send').length,2);
  const snapshot=await f.network.snapshot();assert.equal(snapshot.nodes.find(n=>n.nodeId===a.nodeId).uncertain,true);
});

test('new profile pairing cannot bypass an earlier unknown resource',async t=>{
  const f=setup(t),a=await attach(f,'profile-a');await start(f,a,'request-a');await Promise.all([...f.raw('profile-a').jobs]);await f.emit('profile-a','unknown',1,{text:'lost'});
  f.profiles.push('replacement-profile');await f.network.call('discover',{machineId:a.machineId});const replacement=await attach(f,'replacement-profile');
  await assert.rejects(start(f,replacement,'replacement-request'),{code:'BROWSER_RESOURCE_UNCONFIRMED'});
  assert.equal(f.calls.filter(c=>c.method==='message.send').length,1);
});

test('same profile cannot acquire a second context through a new node or directory',async t=>{
  const f=setup(t),node=await attach(f,'profile-a');await start(f,node,'original');await Promise.all([...f.raw('profile-a').jobs]);
  await assert.rejects(f.host.call('context',{nodeId:'alias-node',adapter:'chatgpt-web',browserInstanceId:'profile-a'}),{code:'BROWSER_RESOURCE_ALIAS'});
  await assert.rejects(f.host.call('context',{nodeId:node.nodeId,adapter:'chatgpt-web',browserInstanceId:'profile-a',workspace:f.directory}),{code:'ADAPTER_UNSUPPORTED'});
  assert.equal(f.host.rows.filter(r=>r.browserInstanceId==='profile-a').length,1);
});

test('core reopen retains profile/node ownership and original unknown without dispatching again',async t=>{
  const f=setup(t),node=await attach(f,'profile-a');const task=await start(f,node,'request-before-reopen');await Promise.all([...f.raw('profile-a').jobs]);
  f.network.close();
  const reopenedHost=new MachineHost({...f.host.options});
  const reopened=new AgentNetwork({...f.options,createHost:()=>reopenedHost});t.after(()=>reopened.close());
  const snapshot=await reopened.snapshot();assert.equal(snapshot.nodes.find(n=>n.browserInstanceId==='profile-a').nodeId,node.nodeId);
  const original=await reopened.call('nodeRequest',{nodeId:node.nodeId,requestId:'request-before-reopen',message:'Controlled browser task'});
  assert.equal(original.taskId,task.taskId);assert.equal(original.status,'unknown');
  assert.equal(f.calls.filter(c=>c.method==='message.send').length,1);
});

test('an unresolved central dispatch without a backend Task still fences newly paired profiles',async t=>{
  const f=setup(t),node=await attach(f,'profile-a');
  f.network.network.requests.push({requestId:'lost-before-backend-receipt',nodeId:node.nodeId,machineId:node.machineId,dispatched:true,knownBrowserInstances:['profile-a','profile-b']});f.network.saveNetwork();
  f.profiles.push('new-pairing');await f.network.call('discover',{machineId:node.machineId});const target=await attach(f,'new-pairing');
  await assert.rejects(start(f,target,'new-alias'),{code:'BROWSER_RESOURCE_UNCONFIRMED'});
  assert.equal(f.calls.filter(c=>c.method==='message.send').length,0);
});
