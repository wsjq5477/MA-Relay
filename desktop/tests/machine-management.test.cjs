const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {SshManager}=require('../electron/ssh-host.cjs');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
const {CredentialStore}=require('../electron/ssh-credentials.cjs');
const {GraphOperationJournal}=require('../electron/graph-operations.cjs');
function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-c-machine-'));let executions=0;
 const credentials=new CredentialStore(directory,{platform:'win32',protect:async s=>'encrypted-'+s,unprotect:async s=>s.slice(10),ensurePrivate:async d=>fs.mkdirSync(d,{recursive:true})});
 const ssh=new SshManager({directory,coordinatorId:'test',credentials,installer:{},knownHosts:{}});
 const c={connectionId:'conn',machineId:'ssh-fixture',daemonId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',revision:1,host:'linux.example.test',port:22,username:'fixture',name:'Linux',authKind:'password',trustedFingerprint:'original-key',stage:'online',online:true,autoReconnect:true,identity:{uid:1000}};
 ssh.connections.push(c);ssh.save();
 const remote={offline:false,busy:false,tasks:[{taskId:'old-task',targetAgent:'a',requestId:'old',conversationId:'old-c',status:'succeeded',message:'history',createdAt:'2026-10-13',updatedAt:'2026-10-13',result:{message:'original'}}],async call(m,p){if(this.offline)throw Object.assign(Error('offline'),{code:'MACHINE_OFFLINE'});if(m==='discover')return {items:[{name:'OpenCode',adapter:'opencode',executable:'/opt/opencode',healthy:true,executionSupported:true}]};if(m==='snapshot')return {agents:{items:[{agentId:'a',name:'original',adapter:'opencode',nodeId:'node-original',executable:'/opt/opencode',workspace:'/work',busy:this.busy,currentTask:this.busy?{taskId:'omitted',status:'unknown'}:undefined}],connected:true,revision:0},tasks:this.tasks,conversations:[{conversationId:'old-c',targetAgent:'a',title:'history',turns:1,updatedAt:'2026-10-13'}]};if(m==='ipc'){executions++;return {};}},setCollaboration(){},close(){}};
 const router=new AgentNetwork({directory,platform:'linux',hostname:'Local',createHost:m=>m.kind==='ssh'?remote:{call:async(m)=>m==='discover'?{items:[]}:{agents:{items:[],revision:0},tasks:[],conversations:[]},close(){}}});
 router.catalog.machines.push({machineId:c.machineId,kind:'ssh',name:'Linux',platform:'linux',connectionId:c.connectionId});router.save();
 ssh.options.onChange=()=>{Object.assign(router.machine(c.machineId),ssh.publicState(c));router.save();};
 const drop=ssh.dropTransport.bind(ssh);ssh.dropTransport=connection=>{remote.offline=true;drop(connection);};
 const service=createCoordinatorService({directory,network:router,ssh,version:'test'});
 t.after(()=>{service.close();ssh.close();fs.rmSync(directory,{recursive:true,force:true});});
 return {directory,ssh,c,router,service,remote,credentials,executions:()=>executions,async ready(){remote.offline=false;c.stage='online';c.online=true;router.retryAfter.clear();await router.snapshot();},async call(method,params){return service.call({method,params});},params(operationId,extra={}){return {connectionId:c.connectionId,machineId:c.machineId,expectedRevision:c.revision,operationId,...extra};}};
}
test('machine edit atomically retains identity and original receipt, rejects foreign user and endpoint aliases, invalidates only changed authentication',async t=>{
 const f=fixture(t);await f.ready();await f.credentials.provide(f.c,{secret:'synthetic',save:true});const ref=f.c.credentialRef;
 const config={name:'Renamed',host:'new.example.test',port:2222,username:'fixture',authKind:'agent'};
 const result=await f.call('machine.updateSsh',f.params('edit',{config}));assert(result.ok,result.error?.message);assert.equal(f.c.machineId,'ssh-fixture');assert.equal(f.c.daemonId,'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');assert.equal(f.c.trustedFingerprint,'original-key');assert.equal(f.c.revision,2);assert.equal(f.c.credentialRef,undefined);assert(!fs.existsSync(path.join(f.credentials.directory,ref+'.json')));
 const stored=JSON.parse(fs.readFileSync(f.ssh.file));assert.equal(stored.connections[0].host,config.host);assert.equal(stored.lifecycleOperations[0].operationId,'edit');
 assert.deepEqual((await f.call('machine.operation',{operationId:'edit'})).result,result.result);
 await f.ready();const bad=await f.call('machine.updateSsh',f.params('user',{config:{...config,username:'other'}}));assert.equal(bad.error.code,'SSH_USER_CHANGE');
 f.ssh.connections.push({...f.c,connectionId:'other',host:'collision.example.test'});
 const conflict=await f.call('machine.updateSsh',f.params('collision',{config:{...config,host:'collision.example.test'}}));assert.equal(conflict.error.code,'SSH_ENDPOINT_CONFLICT');assert.equal(f.executions(),0);
});
test('machine removal revokes related authority, preserves history through restart and restore uses original node without reauthorization',async t=>{
 const f=fixture(t);await f.ready();const node=f.router.network.nodes[0];await f.router.call('attachNode',{nodeId:node.nodeId});await f.router.call('saveCollaboration',{expectedRevision:0,leaderId:node.nodeId,memberIds:[]});
 const result=await f.call('machine.remove',f.params('remove'));assert(result.ok,result.error?.message);assert(f.c.removed);assert.equal(f.router.network.collaboration.leaderId,null);
 const state=(await f.call('snapshot',{})).result;assert(state.machineManagement);assert(state.machines.find(m=>m.machineId===f.c.machineId).removed);assert.equal(state.tasks[0].taskId,'ssh-fixture::old-task');assert.equal(state.nodes[0].available,false);
 const oldConversation=await f.call('ipc',{op:'conversation',machineId:f.c.machineId,conversationId:'ssh-fixture::old-c'});assert(oldConversation.ok,oldConversation.error?.message);assert(oldConversation.result.historical);assert.equal(oldConversation.result.canContinue,false);assert.equal(oldConversation.result.items[0].result.message,'original');
 const reopen=new AgentNetwork({...f.router.options});t.after(()=>reopen.close());const after=await reopen.snapshot();assert.equal(after.tasks[0].result.message,'original');assert(after.machines.find(m=>m.machineId===f.c.machineId).removed);
 const restored=await f.call('machine.restore',f.params('restore'));assert(restored.ok,restored.error?.message);await f.ready();assert.equal(f.router.network.nodes.length,1);assert.equal(f.router.network.nodes[0].nodeId,node.nodeId);assert.equal(f.router.network.collaboration.leaderId,null);assert.equal(f.executions(),0);
});
test('all nonterminal work, original unknown intent, context admission, offline state and config revision prevent dangerous machine changes',async t=>{
 const f=fixture(t);await f.ready();for(const status of ['running','unknown','accepted','queued']){f.remote.tasks[0].status=status;const r=await f.call('machine.remove',f.params('busy-'+status));assert.equal(r.error.code,'MACHINE_BUSY');assert(!f.c.removed);}
 f.remote.tasks[0].status='succeeded';f.remote.busy=true;assert.equal((await f.call('machine.disconnect',f.params('omitted'))).error.code,'MACHINE_BUSY');f.remote.busy=false;
 fs.writeFileSync(path.join(f.directory,'pending.json'),JSON.stringify([{id:'original-native',machineId:f.c.machineId,state:'unknown'}]));assert.equal((await f.call('machine.remove',f.params('native'))).error.code,'DESKTOP_UNCONFIRMED');fs.writeFileSync(path.join(f.directory,'pending.json'),'[]');
 f.router.nodeJobs.set(f.router.network.nodes[0].nodeId,Promise.resolve());assert.equal((await f.call('machine.remove',f.params('context'))).error.code,'MACHINE_BUSY');f.router.nodeJobs.clear();
 f.remote.offline=true;assert.equal((await f.call('machine.remove',f.params('offline'))).error.code,'MACHINE_OFFLINE');await f.ready();
 assert.equal((await f.call('machine.remove',f.params('revision',{expectedRevision:0}))).error.code,'REVISION_CONFLICT');assert.equal(f.executions(),0);
});
test('machine local commit failure changes neither config nor credentials, query never replays an absent operation',async t=>{
 const f=fixture(t);await f.ready();const old=JSON.stringify(f.c),rename=fs.renameSync;fs.renameSync=(a,b)=>{if(b===f.ssh.file)throw Object.assign(Error('disk'),{code:'ENOSPC'});return rename(a,b);};
 try{const r=await f.call('machine.remove',f.params('disk'));assert(!r.ok);}finally{fs.renameSync=rename;}
 assert.equal(JSON.stringify(f.c),old);assert.equal((await f.call('machine.operation',{operationId:'disk'})).result.state,'not_found');assert.equal(f.c.removed,undefined);assert.equal(f.executions(),0);
 const blocked=await f.call('machine.remove',f.params('new-id'));assert.equal(blocked.error.code,'GRAPH_UNCONFIRMED');
});
test('original receipt completes interrupted local revocation once, blocks other lanes until reconciled and never repeats transport mutation',async t=>{
 const f=fixture(t);await f.ready();const n=f.router.network.nodes[0];await f.router.call('attachNode',{nodeId:n.nodeId});await f.router.call('saveCollaboration',{expectedRevision:0,leaderId:n.nodeId,memberIds:[]});
 const finalize=f.router.finalizeMachine.bind(f.router);let once=true;f.router.finalizeMachine=r=>{if(once){once=false;throw Error('crash after SSH commit');}return finalize(r);};
 const r=await f.call('machine.remove',f.params('original'));assert(!r.ok);assert(f.c.removed);assert.equal(f.c.revision,2);assert.equal(new GraphOperationJournal(f.directory).pending()[0].lane,'machine');
 const receipt=await f.call('machine.operation',{operationId:'original'});assert(receipt.ok,receipt.error?.message);assert.equal(f.router.network.collaboration.leaderId,null);const revision=f.router.network.collaboration.revision;
 await f.call('machine.operation',{operationId:'original'});assert.equal(f.router.network.collaboration.revision,revision);assert.equal(f.c.revision,2);assert.equal(new GraphOperationJournal(f.directory).pending().length,0);assert.equal(f.executions(),0);
});
test('reconnect is observation recovery while native intent is unknown; an online reconnect does not drop active transport',async t=>{
 const f=fixture(t);await f.ready();fs.writeFileSync(path.join(f.directory,'pending.json'),JSON.stringify([{id:'native',machineId:f.c.machineId,state:'unknown'}]));f.remote.busy=true;
 const result=await f.call('machine.reconnect',f.params('online'));assert(result.ok,result.error?.message);assert.equal(f.c.stage,'online');assert(!f.remote.offline);assert.equal(f.executions(),0);
 let resumes=0;f.ssh.scheduleReconnect=()=>resumes++;f.c.stage='disconnected';f.c.online=false;f.remote.offline=true;
 const offline=await f.call('machine.reconnect',f.params('offline-reconnect'));assert(offline.ok,offline.error?.message);assert.equal(resumes,1);assert.equal(f.executions(),0);
});
test('machine source forgery, changed payload and concurrent 10 identical requests retain one original operation',async t=>{
 const f=fixture(t);await f.ready();assert.equal((await f.call('machine.remove',f.params('forged',{machineId:'other'}))).error.code,'WRONG_MACHINE');
 const p=f.params('once');const replies=await Promise.all(Array.from({length:10},()=>f.call('machine.disconnect',p)));assert(replies.every(r=>r.ok));assert.equal(f.c.revision,2);assert.equal(f.ssh.lifecycleOperations.length,1);
 const conflict=await f.call('machine.updateSsh',{...p,config:{name:'other',host:'linux.example.test',port:22,username:'fixture',authKind:'agent'}});assert.equal(conflict.error.code,'OPERATION_CONFLICT');assert.equal(f.executions(),0);
});
test('event replay compensates cursorGap and drains all pages without a task mutation or invented cursor',async t=>{
 const f=fixture(t),seen=[],snapshots=[],calls=[];f.ssh.options.onEvent=async(_m,e)=>seen.push(e.cursor);f.ssh.options.onSnapshot=async(_m,s)=>snapshots.push(s);
 const host={request:async(m,p)=>{calls.push({m,p});if(m==='snapshot')return {tasks:[{taskId:'original'}]};return p.afterCursor===0?{cursorGap:true,earliestCursor:10,items:[{cursor:10},{cursor:11}],nextCursor:11,hasMore:true}:{items:[{cursor:12}],nextCursor:12,hasMore:false};}};
 await f.ssh.restoreObservation(host,f.c,'ssh-fixture');assert.deepEqual(seen,[10,11,12]);assert.equal(snapshots.length,1);assert.equal(f.c.lastCursor,12);assert.deepEqual(calls.map(c=>c.m),['daemon.eventRead','snapshot','daemon.eventRead']);
 f.ssh.options.onEvent=()=>{throw Error('cannot ingest');};f.c.lastCursor=0;await assert.rejects(f.ssh.restoreObservation(host,f.c,'ssh-fixture'));assert.equal(f.c.lastCursor,0);
});

test('querying an old reconnect receipt cannot undo a later manual disconnect and secret fields cannot enter the machine journal',async t=>{
 const f=fixture(t);await f.ready();assert((await f.call('machine.reconnect',f.params('older'))).ok);assert((await f.call('machine.disconnect',f.params('later'))).ok);
 let resumes=0;f.ssh.scheduleReconnect=()=>resumes++;await f.call('machine.operation',{operationId:'older'});assert.equal(f.c.autoReconnect,false);assert.equal(resumes,0);
 const result=await f.call('machine.updateSsh',f.params('secret-field',{config:{host:'linux.example.test',username:'fixture',authKind:'password',secret:'synthetic-do-not-persist'}}));assert.equal(result.error.code,'INVALID_INPUT');assert(!fs.readFileSync(path.join(f.directory,'graph-pending.json'),'utf8').includes('synthetic-do-not-persist'));
 const original=await f.ssh.call('machine.createSshDraft',{host:f.c.host,port:f.c.port,username:f.c.username,authKind:f.c.authKind});assert.equal(original.connectionId,f.c.connectionId);assert.equal(f.ssh.connections.length,1);
});

test('observed older tasks survive later paged snapshots and remain readable after removal and Coordinator restart',async t=>{
 const f=fixture(t);await f.ready();f.remote.tasks=[{taskId:'latest',targetAgent:'a',conversationId:'latest-c',status:'succeeded',createdAt:'2026-10-13',updatedAt:'2026-10-13'}];await f.ready();
 assert((await f.call('machine.remove',f.params('remove-pages'))).ok);
 const snapshot=(await f.call('snapshot',{})).result;assert(snapshot.tasks.some(t=>t.taskId==='ssh-fixture::old-task'));assert(snapshot.tasks.some(t=>t.taskId==='ssh-fixture::latest'));
 const after=new AgentNetwork({...f.router.options});t.after(()=>after.close());const history=await after.call('ipc',{op:'task',machineId:f.c.machineId,taskId:'ssh-fixture::old-task'});assert(history.historical);assert.equal(history.result.message,'original');
});
