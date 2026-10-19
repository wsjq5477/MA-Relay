const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const timestamp='2026-10-10T00:00:00.000Z';
const error=code=>Object.assign(new Error(code),{code});
function fixture(t){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-network-')),hosts=new Map();
  const createHost=machine=>{
    const adapter=machine.kind==='windows'?'claude':'opencode',executable=machine.kind==='windows'?'C:/tools/claude.exe':'/opt/opencode';
    const host={items:[{adapter,name:adapter,executable,healthy:true,executionSupported:true},{adapter:'codex',name:'Codex',executable:machine.kind==='windows'?'C:/tools/codex.exe':'/opt/codex',healthy:true,executionSupported:true}],agents:[{agentId:'old-a',adapter,name:'project A',workspace:machine.kind==='windows'?'D:/a':'/home/a',executable,available:true,healthy:true,online:true,enabled:true,busy:false,model:{id:'legacy-model',providerID:'legacy'}}],tasks:[],conversations:[],requests:new Map(),calls:[],executions:0,contexts:new Map(),offline:false,lose:false,
      setCollaboration(handler){this.handler=handler;},close(){},
      async call(method,p={}){this.calls.push({method,p:structuredClone(p)});if(this.offline)throw error('OFFLINE');
        if(method==='discover')return {items:this.items};
        if(method==='snapshot')return structuredClone({agents:{items:this.agents,revision:1},tasks:this.tasks,conversations:this.conversations});
        if(method==='context'){const key=p.nodeId+':'+(p.workspace||'default');if(this.contexts.has(key))return this.contexts.get(key);const contextId='context-'+this.contexts.size,agentId='context-a-'+this.contexts.size;this.agents.push({agentId,adapter:p.adapter,name:p.adapter,workspace:p.workspace||'/sessions/'+agentId,executable:p.executable,available:true,healthy:true,online:true,enabled:true,busy:false});const context={contextId,agentId,workspace:this.agents.at(-1).workspace};this.contexts.set(key,context);return context;}
        if(method==='scope')return {configured:true};
        if(method==='connectTool')return {};
        if(method==='ipc'){
          if(p.op==='request'){if(!this.requests.has(p.requestId))throw error('NOT_FOUND');return structuredClone(this.requests.get(p.requestId));}
          if(p.op==='conversation'){const c=this.conversations.find(c=>c.conversationId===p.conversationId);if(!c)throw error('NOT_FOUND');return structuredClone({...c,items:this.tasks.filter(t=>t.conversationId===c.conversationId)});}
          if(p.op==='task'){const task=this.tasks.find(t=>t.taskId===p.taskId);if(!task)throw error('TASK_NOT_FOUND');return structuredClone(task);}
          if(p.op==='submit'||p.op==='continue'){
            if(this.requests.has(p.requestId))return structuredClone(this.requests.get(p.requestId));
            const agentId=p.agentId||this.conversations.find(c=>c.conversationId===p.conversationId)?.targetAgent,task={taskId:'t-'+this.executions++,conversationId:p.conversationId||'c-'+this.executions,targetAgent:agentId,requestId:p.requestId,message:p.message,status:'running',createdAt:timestamp,updatedAt:timestamp};
            this.tasks.push(task);this.requests.set(p.requestId,task);const a=this.agents.find(a=>a.agentId===agentId);a.busy=true;a.currentTask={taskId:task.taskId,status:'running'};
            if(!p.conversationId)this.conversations.push({conversationId:task.conversationId,targetAgent:agentId,title:p.message,turns:1,updatedAt:timestamp,canContinue:true});
            if(this.lose)throw error('DESKTOP_TRANSPORT');return structuredClone(task);
          }
          if(p.op==='cancel')return {taskId:p.taskId,operationId:p.operationId,state:'unknown'};
        }
        throw error('METHOD');
      }
    };hosts.set(machine.machineId,host);return host;
  };
  const options={directory,platform:'win32',hostname:'Windows',distributions:async()=>['Ubuntu'],createHost,snapshotTimeoutMs:500};
  const router=new AgentNetwork(options);t.after(()=>{router.close();fs.rmSync(directory,{recursive:true,force:true});});
  return {directory,router,hosts,options};
}
async function setup(t){const f=fixture(t);const s=await f.router.snapshot();return {...f,nodes:s.nodes};}
const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
test('sharing locks at receipt boundaries retry or reject only before native dispatch',async t=>{
 for(const stage of ['transient','initial','dispatch','result'])await t.test(stage,async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId);
  const service=createCoordinatorService({directory:f.directory,network:f.router});t.after(()=>service.close());
  const requestId='persist-'+stage,params={op:'submit',nodeId:node.nodeId,machineId:node.machineId,requestId,message:'controlled',collaboration:false};
  const rename=fs.renameSync;let injected=0;
  fs.renameSync=(source,target)=>{
   if(target===f.router.networkFile){
    const receipt=JSON.parse(fs.readFileSync(source,'utf8')).requests.find(r=>r.requestId===requestId);
    const matches=receipt&&(stage==='transient'?!injected:stage==='initial'?!receipt.agentId:stage==='dispatch'?receipt.dispatched&&!receipt.taskId:!!receipt.taskId);
    if(matches){injected++;throw Object.assign(Error(`EPERM: operation not permitted, rename '${source}' -> '${target}'`),{code:'EPERM'});}
   }
   return rename(source,target);
  };
  let result;try{result=await service.call({method:'nodeRequest',params});}finally{fs.renameSync=rename;}
  assert.ok(injected);
  const receipt=f.router.network.requests.find(r=>r.requestId===requestId);
  if(stage==='transient'){
   assert.equal(result.ok,true,JSON.stringify(result.error));assert.equal(injected,1);assert.equal(host.executions,1);assert.equal(service.pending().length,0);
  }else{
   assert.equal(result.error.code,'NETWORK_PERSIST');assert.match(result.error.message,/EPERM/);
   if(stage==='result'){
    assert.equal(host.executions,1);assert.equal(receipt.dispatched,true);assert.equal(service.pending().length,1);
    assert.equal(f.router.undispatchedRejection(service.pending()[0]),null);
    assert.equal((await service.recoverPending()).resolved,1);assert.equal(host.executions,1);
   }else{
    assert.equal(host.executions,0);assert.equal(receipt.dispatched,false);assert.equal(service.pending().length,0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory,'pending.json')))[0].state,'rejected');
    if(stage==='dispatch')assert.ok(receipt.agentId);
   }
  }
  assert.equal(fs.readdirSync(f.directory).filter(n=>n.startsWith('agent-network.json.')&&n.endsWith('.tmp')).length,0);
 });
});
test('legacy local rename recovery requires exact profile paths, original fingerprints and an undispatched idle receipt',async t=>{
 for(const variant of ['valid','case-target','foreign-target','foreign-source','invalid-tmp','native-error','dispatched','bound','fingerprint','empty-fingerprint','missing-input','inflight','missing'])await t.test(variant,async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId);
  const service=createCoordinatorService({directory:f.directory,network:f.router});t.after(()=>service.close());
  const params={op:'submit',nodeId:node.nodeId,machineId:node.machineId,requestId:'legacy-persist',message:'controlled',collaboration:false};
  const call=host.call.bind(host);host.call=async(method,p)=>{if(method==='context')throw error('DESKTOP_TRANSPORT');return call(method,p);};
  await service.call({method:'nodeRequest',params});host.call=call;
  const original=f.router.network.requests.find(r=>r.requestId===params.requestId);delete original.preparationRejection;
  const target=f.router.networkFile,source=target+'.12345678-1234-4234-8234-123456789abc.tmp';
  const row=JSON.parse(fs.readFileSync(path.join(f.directory,'pending.json')))[0];row.state='unknown';
  row.result={error:{code:'EPERM',message:`EPERM: operation not permitted, rename '${source}' -> '${target}'`}};
  if(variant==='foreign-target')row.result.error.message=`EPERM: operation not permitted, rename '${source}' -> '${target}.other'`;
  if(variant==='case-target')row.result.error.message=`EPERM: operation not permitted, rename '${source}' -> '${target.toUpperCase()}'`;
  if(variant==='foreign-source')row.result.error.message=`EPERM: operation not permitted, rename '${path.join(f.directory,'other',path.basename(source))}' -> '${target}'`;
  if(variant==='invalid-tmp')row.result.error.message=`EPERM: operation not permitted, rename '${target}.arbitrary.tmp' -> '${target}'`;
  if(variant==='native-error')row.result.error.message='EPERM: operation not permitted, native execution';
  if(variant==='dispatched')original.dispatched=true;
  if(variant==='bound')original.taskId='bound-task';
  if(variant==='fingerprint')original.inputFingerprint='wrong';
  if(variant==='empty-fingerprint')original.inputFingerprint='';
  if(variant==='missing-input')delete original.inputFingerprint;
  if(variant==='inflight')f.router.nodeJobs.set(node.nodeId,Promise.resolve());
  if(variant==='missing')f.router.network.requests=[];
  f.router.saveNetwork();fs.writeFileSync(path.join(f.directory,'pending.json'),JSON.stringify([row]));
  const valid=variant==='valid'||variant==='case-target'&&process.platform==='win32';
  const result=await service.recoverPending();assert.equal(result.resolved,valid?1:0);
  assert.equal(service.pending().length,valid?0:1);assert.equal(host.executions,0);
  if(valid){
   const settled=JSON.parse(fs.readFileSync(path.join(f.directory,'pending.json')))[0];assert.equal(settled.state,'rejected');assert.equal(settled.id,params.requestId);
   assert.match(settled.result.error.message,/持久化/);
  }
 });
});
test('team execution binds a fresh member scope without altering legacy relations; terminal scope and forged ingress are rejected',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),h=f.hosts.get(node.machineId),original=h.call.bind(h);
  let scope;
  h.call=async(method,p)=>{const r=await original(method,p);if(method==='context'){scope=p.scope;return {...r,teamCollaboration:true};}return r;};
  const service=createCoordinatorService({directory:f.directory,network:f.router});try{
  const invoke=async(method,p={})=>{const r=await service.call({method:'team.'+method,params:{operationId:require('node:crypto').randomUUID(),...p}});assert.equal(r.ok,true,JSON.stringify(r.error));return r.result;};
  const agent=await invoke('registerAgent',{kind:'native',nodeId:node.nodeId,name:'开发',purpose:'实现'});
  const team=await invoke('createTeam',{name:'小队',leaderId:agent.agentId,memberIds:[agent.agentId]});
  const run=await invoke('createRun',{teamId:team.teamId,name:'工作',goal:'实现',acceptance:'实际结果'});
  const a=await invoke('execute',{runId:run.runId,agentId:agent.agentId,message:'read team_context and report'});
  assert.equal(a.state,'running');assert.ok(scope.teamSessionId);assert.equal(f.router.network.collaboration.leaderId,null);
  const context=await f.router.options.teamTool(scope,'team_context',{},node.machineId);assert.equal(context.run.runId,run.runId);
  await assert.rejects(f.router.options.teamTool(scope,'team_context',{},'forged-machine'),{code:'TEAM_FORBIDDEN'});
  const forged=await service.call({method:'nodeRequest',params:{nodeId:node.nodeId,op:'submit',message:'forged',requestId:'forged',teamScope:scope}});assert.equal(forged.error.code,'TEAM_FORBIDDEN');
  h.tasks[0].status='succeeded';h.tasks[0].result={message:'real result'};
  const after=await invoke('refresh',{runId:run.runId});assert.equal(after.attempts[0].state,'succeeded');assert.equal(after.run.state,'active');
  await assert.rejects(f.router.options.teamTool(scope,'team_context',{},node.machineId),{code:'TEAM_FORBIDDEN'});
  }finally{service.close();}
});
async function uncertainSubmission(t,workspace){
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId);
  const service=createCoordinatorService({directory:f.directory,platform:'win32',network:f.router});
  host.lose=true;
  const params={op:'submit',nodeId:node.nodeId,machineId:node.machineId,requestId:'uncertain',message:'original',...(workspace?{workspace}:{})};
  assert.equal((await service.call({method:'nodeRequest',params})).error.code,'DESKTOP_TRANSPORT');
  host.lose=false;host.requests.clear();host.tasks=[];host.conversations=[];
  for(const a of host.agents){a.busy=false;delete a.currentTask;}
  return {...f,node,host,service,params};
}
test('team member revocation during context preparation is rechecked immediately before native dispatch',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),h=f.hosts.get(node.machineId),original=h.call.bind(h);
  let release,started;const prepared=new Promise(r=>started=r),gate=new Promise(r=>release=r);
  h.call=async(method,p)=>{const result=await original(method,p);if(method==='context'){started();await gate;return {...result,teamCollaboration:true};}return result;};
  const service=createCoordinatorService({directory:f.directory,network:f.router});try{
    const invoke=async(method,p={})=>{const r=await service.call({method:'team.'+method,params:{operationId:require('node:crypto').randomUUID(),...p}});assert.equal(r.ok,true,JSON.stringify(r.error));return r.result;};
    const a=await invoke('registerAgent',{kind:'native',nodeId:node.nodeId,name:'开发',purpose:'实现'});
    const team=await invoke('createTeam',{name:'队',leaderId:a.agentId,memberIds:[a.agentId]});
    const run=await invoke('createRun',{teamId:team.teamId,name:'工作',goal:'目标',acceptance:'证据'});
    const execution=invoke('execute',{runId:run.runId,agentId:a.agentId,message:'must not dispatch'});
    await prepared;await invoke('revokeMember',{runId:run.runId,agentId:a.agentId,expectedRevision:1});release();
    const result=await execution;assert.equal(result.state,'rejected');assert.equal(h.executions,0);
  }finally{release?.();service.close();}
});
test('configuration and preparation failures are durable rejections; recovery and same-ID retries never dispatch',async t=>{
  for(const code of ['NOT_CONFIGURED','DESKTOP_TRANSPORT','CLAUDE_RUNTIME_INVALID']){
    const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId),original=host.call.bind(host);
    host.call=async(m,p)=>m==='context'?Promise.reject(error(code)):original(m,p);
    let service=createCoordinatorService({directory:f.directory,network:f.router});
    const p={op:'submit',nodeId:node.nodeId,machineId:node.machineId,requestId:'prepare-'+code,message:'original'};
    assert.equal((await service.call({method:'nodeRequest',params:p})).error.code,code);
    assert.equal(service.pending().length,0);assert.equal(host.executions,0);
    const file=path.join(f.directory,'pending.json'),rows=JSON.parse(fs.readFileSync(file));rows[0].state='unknown';fs.writeFileSync(file,JSON.stringify(rows));
    const restored=new AgentNetwork(f.options);t.after(()=>restored.close());service=createCoordinatorService({directory:f.directory,network:restored});
    assert.equal((await service.recoverPending()).resolved,1);assert.equal(service.pending().length,0);
    // The original rejection remains authoritative after configuration is repaired.
    await assert.rejects(restored.call('nodeRequest',p),{code});assert.equal(restored.network.requests.length,1);
    assert.equal([...restored.hosts.values()].reduce((n,h)=>n+h.executions,0),0);
  }
});
test('native admission NOT_CONFIGURED leaves no phantom busy node and permits a new request after configuration repair',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId),call=host.call.bind(host);
  host.call=async(method,p)=>method==='ipc'&&p.op==='submit'?Promise.reject(error('NOT_CONFIGURED')):call(method,p);
  const service=createCoordinatorService({directory:f.directory,network:f.router}),p={op:'submit',nodeId:node.nodeId,machineId:node.machineId,requestId:'config-gate',message:'original'};
  assert.equal((await service.call({method:'nodeRequest',params:p})).error.code,'NOT_CONFIGURED');
  assert.equal(f.router.network.requests[0].dispatched,false);assert.equal(service.pending().length,0);assert.equal(host.executions,0);
  assert.equal((await f.router.snapshot()).nodes.find(n=>n.nodeId===node.nodeId).available,true);
  host.call=call;
  assert.equal((await service.call({method:'nodeRequest',params:p})).error.code,'NOT_CONFIGURED');assert.equal(host.executions,0);
  assert.equal((await service.call({method:'nodeRequest',params:{...p,requestId:'new-after-repair'}})).ok,true);assert.equal(host.executions,1);
});
test('an unresolved request blocks its node but permits a different node on the same machine and keeps the original journal',async t=>{
  const f=await uncertainSubmission(t),other=f.nodes.find(n=>n.machineId===f.node.machineId&&n.nodeId!==f.node.nodeId);
  await f.router.call('attachNode',{nodeId:other.nodeId});
  const pending=f.service.pending()[0];assert(pending.blockedNodeIds.includes(f.node.nodeId));assert(!pending.blockedNodeIds.includes(other.nodeId));
  const attempt={op:'submit',nodeId:f.node.nodeId,requestId:'alias',message:'new',workspace:'D:/different'};
  assert.equal((await f.service.call({method:'nodeRequest',params:attempt})).error.code,'DESKTOP_UNCONFIRMED');
  const result=await f.service.call({method:'nodeRequest',params:{...attempt,nodeId:other.nodeId,requestId:'independent'}});
  assert.equal(result.ok,true);assert.equal(f.host.executions,2);
  assert.equal(f.service.pending().length,1);assert.equal(f.service.pending()[0].id,'uncertain');
});
test('preparation rejection in a continuation preserves inherited collaboration and the exact original input',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId);
  await f.router.call('saveCollaboration',{leaderId:node.nodeId,memberIds:[],expectedRevision:0});
  const first=await f.router.call('nodeRequest',{op:'submit',nodeId:node.nodeId,machineId:node.machineId,requestId:'parent',message:'first',collaboration:true});
  for(const task of host.tasks)task.status='succeeded';for(const a of host.agents){a.busy=false;delete a.currentTask;}
  const call=host.call.bind(host);host.call=async(method,p)=>method==='scope'?Promise.reject(error('NOT_CONFIGURED')):call(method,p);
  const service=createCoordinatorService({directory:f.directory,network:f.router});
  const p={op:'continue',nodeId:node.nodeId,machineId:node.machineId,conversationId:first.conversationId,requestId:'followup-rejected',message:'second'};
  assert.equal((await service.call({method:'nodeRequest',params:p})).error.code,'NOT_CONFIGURED');
  const file=path.join(f.directory,'pending.json'),rows=JSON.parse(fs.readFileSync(file));rows[0].state='unknown';fs.writeFileSync(file,JSON.stringify(rows));
  assert.equal((await service.recoverPending()).resolved,1);assert.equal(host.executions,1);assert.equal(service.pending().length,0);
  assert.equal(f.router.network.requests.at(-1).collaboration,true);
});
test('resolved directory admission rejects different-node and Windows/WSL aliases before any new native execution',async t=>{
  for(const crossMachine of [false,true]){
    const f=await uncertainSubmission(t,'D:/shared'),other=f.nodes.find(n=>crossMachine?n.machineId!==f.node.machineId:n.machineId===f.node.machineId&&n.nodeId!==f.node.nodeId);
    await f.router.call('attachNode',{nodeId:other.nodeId});
    const result=await f.service.call({method:'nodeRequest',params:{op:'submit',nodeId:other.nodeId,requestId:'shared-alias',message:'no',workspace:crossMachine?'/mnt/d/shared':'d:/SHARED/'}});
    assert.equal(result.error.code,'DESKTOP_UNCONFIRMED');
    assert.equal([...f.hosts.values()].reduce((n,h)=>n+h.executions,0),1);
    assert.equal(f.service.pending().length,1);assert.equal(f.service.pending()[0].id,'uncertain');
  }
});
test('legacy missing ownership remains protected; current NOT_CONFIGURED is not evidence of original rejection',async t=>{
  const f=await uncertainSubmission(t),file=path.join(f.directory,'pending.json');
  const row=JSON.parse(fs.readFileSync(file))[0];row.params={op:'submit',requestId:row.id,machineId:row.machineId};fs.writeFileSync(file,JSON.stringify([row]));
  f.router.network.requests=[];f.router.saveNetwork();
  const other=f.nodes.find(n=>n.machineId===f.node.machineId&&n.nodeId!==f.node.nodeId);
  assert(f.service.pending()[0].blockedNodeIds.includes(other.nodeId));
  f.host.call=async()=>{throw error('NOT_CONFIGURED');};
  const result=await f.service.recoverPending();assert.equal(result.resolved,0);assert.equal(result.items[0].code,'NOT_CONFIGURED');
  assert.match(result.items[0].reason,/配置未就绪/);assert.equal(f.host.executions,1);assert.equal(f.service.pending().length,1);
});
test('legacy NOT_CONFIGURED settles only with the original matching undispatched intent and saved original error',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId),call=host.call.bind(host);
  host.call=async(method,p)=>method==='context'?Promise.reject(error('NOT_CONFIGURED')):call(method,p);
  const service=createCoordinatorService({directory:f.directory,network:f.router}),p={op:'submit',nodeId:node.nodeId,machineId:node.machineId,requestId:'legacy-config',message:'original'};
  await service.call({method:'nodeRequest',params:p});
  const intent=f.router.network.requests[0];delete intent.preparationRejection;delete intent.inputFingerprint;f.router.saveNetwork();
  const file=path.join(f.directory,'pending.json'),rows=JSON.parse(fs.readFileSync(file));rows[0].state='unknown';
  for(const dispatched of [true,false]){
    intent.dispatched=dispatched;fs.writeFileSync(file,JSON.stringify(rows));
    const result=await service.recoverPending();assert.equal(result.resolved,dispatched?0:1);
  }
  assert.equal(host.executions,0);assert.equal(service.pending().length,0);
});
test('nodes are machine/tool identities without workspace or model; all adapters on the same machine survive rescan',async t=>{
  const f=await setup(t);assert.equal(f.nodes.length,4);for(const n of f.nodes){assert(!Object.hasOwn(n,'workspace'));assert(!Object.hasOwn(n,'model'));assert(!Object.hasOwn(n,'providerID'));}
  const ids=f.nodes.map(n=>n.nodeId);assert.deepEqual((await f.router.snapshot()).nodes.map(n=>n.nodeId),ids);
  const legacy=f.hosts.values().next().value;legacy.agents.push({...legacy.agents[0],agentId:'old-b',workspace:'D:/b'});const snapshot=await f.router.snapshot();assert.equal(snapshot.nodes.length,4);assert.equal(snapshot.instances.length,3);assert(fs.existsSync(path.join(f.directory,'machines.json.before-nodes.json')));
});
test('relations persist with optimistic revisions and reject self, duplicate, unknown and source-forged identities',async t=>{
  const f=await setup(t),[leader,member]=f.nodes;await f.router.call('attachNode',{nodeId:member.nodeId});const r=await f.router.call('saveCollaboration',{leaderId:leader.nodeId,memberIds:[member.nodeId],expectedRevision:0});assert.equal(r.revision,1);
  await assert.rejects(f.router.call('saveCollaboration',{leaderId:leader.nodeId,memberIds:[],expectedRevision:0}),{code:'REVISION_CONFLICT'});
  for(const memberIds of [[leader.nodeId],[member.nodeId,member.nodeId],['missing']])await assert.rejects(f.router.call('saveCollaboration',{leaderId:leader.nodeId,memberIds,expectedRevision:1}));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.directory,'agent-network.json'))).collaboration,r);
  await assert.rejects(f.router.prepare('nodeRequest',{nodeId:leader.nodeId,machineId:member.machineId===leader.machineId?'other':member.machineId}),{code:'WRONG_MACHINE'});
});
test('node submission uses an independent context, inherits native settings, preserves old model bindings, deduplicates retries',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId);host.agents[0].model={providerID:'old',id:'fixed'};
  const p={op:'submit',nodeId:node.nodeId,machineId:node.machineId,message:'hello',requestId:'first'};
  const result=await f.router.call('nodeRequest',p);assert.equal(host.executions,1);const ctx=host.calls.find(c=>c.method==='context');assert(!ctx.p.workspace);assert(!ctx.p.model);assert.notEqual(result.targetAgent,node.machineId+'::old-a');assert.equal(host.agents[0].model.id,'fixed');
  const repeats=await Promise.all(Array.from({length:10},()=>f.router.call('nodeRequest',p)));assert(repeats.every(r=>r.taskId===result.taskId));assert.equal(host.executions,1);
  await assert.rejects(f.router.call('nodeRequest',{...p,message:'changed'}),{code:'REQUEST_CONFLICT'});
  await assert.rejects(f.router.call('nodeRequest',{...p,requestId:'new',model:{id:'x'}}),{code:'INVALID_INPUT'});
});
test('transport uncertainty remains durable and retry queries the original receipt without a second native execution',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId);host.lose=true;
  const p={op:'submit',nodeId:node.nodeId,machineId:node.machineId,message:'hello',requestId:'lost'};await assert.rejects(f.router.call('nodeRequest',p),{code:'DESKTOP_TRANSPORT'});
  const original=await f.router.call('nodeRequest',p);assert.equal(original.status,'running');assert.equal(host.executions,1);
  host.requests.delete('lost');await assert.rejects(f.router.call('nodeRequest',p),{code:'DESKTOP_UNCONFIRMED'});assert.equal(host.executions,1);
  host.tasks=[];host.agents.at(-1).busy=false;delete host.agents.at(-1).currentTask;
  const state=await f.router.snapshot();const uncertain=state.nodes.find(n=>n.nodeId===node.nodeId);assert.equal(uncertain.unconfirmed,1);assert.equal(uncertain.available,false);
  await assert.rejects(f.router.call('nodeRequest',{...p,requestId:'different'}),{code:'AGENT_BUSY'});assert.equal(host.executions,1);
});
test('a native context retains its authoritative node when the backend reports a resolved launcher path',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId);
  const result=await f.router.call('nodeRequest',{op:'submit',nodeId:node.nodeId,requestId:'alias',message:'hello'});
  const context=host.agents.at(-1);context.nodeId=node.nodeId;context.executable='C:/tools/native/claude.exe';
  const original=host.tasks[0];original.status='succeeded';context.busy=false;delete context.currentTask;
  const snapshot=await f.router.snapshot();assert.equal(snapshot.nodes.length,4);assert.equal(snapshot.conversations[0].nodeId,node.nodeId);
  const resumed=await f.router.call('nodeRequest',{op:'continue',nodeId:node.nodeId,conversationId:result.conversationId,requestId:'alias-resume',message:'continue'});
  assert.equal(resumed.conversationId,result.conversationId);assert.equal(host.executions,2);
});
test('a main Agent actually discovers and delegates only its allowed children; results and cancellation are owned by the original parent',async t=>{
  const f=await setup(t),leader=f.nodes.find(n=>n.adapter==='claude'),member=f.nodes.find(n=>n.adapter==='opencode');
  await f.router.call('attachNode',{nodeId:member.nodeId});await f.router.call('saveCollaboration',{leaderId:leader.nodeId,memberIds:[member.nodeId],expectedRevision:0});
  const parent=await f.router.call('nodeRequest',{op:'submit',nodeId:leader.nodeId,machineId:leader.machineId,requestId:'main',message:'delegate',collaboration:true});const scope={nodeId:leader.nodeId,parentRequestId:'main'};
  const found=await f.router.collaborationTool(scope,'list_agents',{},'call',leader.machineId);assert.deepEqual(found.items.map(n=>n.nodeId),[member.nodeId]);
  const args={nodeId:member.nodeId,requestId:'child',message:'run child'};const task=await f.router.collaborationTool(scope,'delegate',args,'call',leader.machineId);assert.equal(task.parentTaskId,parent.taskId);
  for(let i=0;i<10;i++){const retry=await f.router.collaborationTool(scope,'delegate',args,'call',leader.machineId);assert.equal(retry.taskId,task.taskId);}assert.equal(f.hosts.get(member.machineId).executions,1);
  const result=await f.router.collaborationTool(scope,'task_result',{taskId:task.taskId},'call',leader.machineId);assert.equal(result.status,'running');
  await assert.rejects(f.router.collaborationTool(scope,'delegate',{...args,nodeId:leader.nodeId},'call',leader.machineId),{code:'COLLABORATION_FORBIDDEN'});
  await assert.rejects(f.router.collaborationTool(scope,'task_result',{taskId:parent.taskId},'call',leader.machineId),{code:'COLLABORATION_FORBIDDEN'});
  await assert.rejects(f.router.collaborationTool(scope,'list_agents',{},'call',member.machineId),{code:'COLLABORATION_FORBIDDEN'});
  const receipt=await f.router.collaborationTool(scope,'cancel_task',{taskId:task.taskId,operationId:'cancel-child'},'call',leader.machineId);assert.equal(receipt.state,'unknown');
  await f.router.call('saveCollaboration',{leaderId:leader.nodeId,memberIds:[],expectedRevision:1});await assert.rejects(f.router.collaborationTool(scope,'delegate',{...args,requestId:'revoked'},'call',leader.machineId),{code:'COLLABORATION_FORBIDDEN'});
  assert.equal((await f.router.collaborationTool(scope,'task_result',{taskId:task.taskId},'call',leader.machineId)).status,'running');
});
test('graph authorization receipts deduplicate concurrent saves and survive restart; storage failure does not commit memory',async t=>{
  const f=await setup(t),leader=f.nodes.find(n=>n.adapter==='claude'),member=f.nodes.find(n=>n.adapter==='opencode');
  await f.router.call('attachNode',{nodeId:member.nodeId});
  const params={operationId:'relation-once',expectedRevision:0,leaderId:leader.nodeId,memberIds:[member.nodeId]};
  const results=await Promise.all(Array.from({length:10},()=>f.router.call('saveCollaboration',params)));
  assert(results.every(r=>r.state==='confirmed'&&r.data.revision===1));
  assert.equal((await f.router.call('collaboration')).revision,1);
  await assert.rejects(f.router.call('saveCollaboration',{...params,memberIds:[]}),{code:'OPERATION_CONFLICT'});
  const restored=new AgentNetwork(f.options);t.after(()=>restored.close());
  assert.deepEqual(await restored.call('collaborationOperation',{operationId:params.operationId}),results[0]);
  assert.deepEqual(await restored.call('saveCollaboration',params),results[0]);
  assert.equal((await restored.call('collaborationOperation',{operationId:'missing'})).state,'not_found');
  const rename=fs.renameSync;fs.renameSync=(a,b)=>{if(b===restored.networkFile)throw error('ENOSPC');return rename(a,b);};
  try{await assert.rejects(restored.call('saveCollaboration',{...params,operationId:'failed-write',expectedRevision:1,memberIds:[]}),{code:'ENOSPC'});}
  finally{fs.renameSync=rename;}
  assert.equal((await restored.call('collaboration')).revision,1);
  assert.equal((await restored.call('collaborationOperation',{operationId:'failed-write'})).state,'not_found');
  assert.deepEqual(JSON.parse(fs.readFileSync(restored.networkFile)).collaboration,results[0].data);
});
test('graph rejects unconnected or unsupported authorization but permits known connected offline nodes',async t=>{
  const f=await setup(t),leader=f.nodes.find(n=>n.adapter==='claude'),member=f.nodes.find(n=>n.adapter==='opencode');
  const params={operationId:'validation',expectedRevision:0,leaderId:leader.nodeId,memberIds:[member.nodeId]};f.router.node(member.nodeId).connected=false;
  await assert.rejects(f.router.call('saveCollaboration',params),{code:'NODE_DISCONNECTED'});
  await f.router.call('attachNode',{nodeId:member.nodeId});f.router.node(member.nodeId).executionSupported=false;
  await assert.rejects(f.router.call('saveCollaboration',params),{code:'NODE_DISCONNECTED'});
  f.router.node(member.nodeId).executionSupported=true;f.hosts.get(member.machineId).offline=true;
  assert.equal((await f.router.call('saveCollaboration',params)).state,'confirmed');
});
test('changing and clearing the leader preserves live old-parent result and cancel rights without granting new delegation or child takeover',async t=>{
  const f=await setup(t),leader=f.nodes.find(n=>n.adapter==='claude'),member=f.nodes.find(n=>n.adapter==='opencode'),other=f.nodes.find(n=>n.adapter==='codex');
  await f.router.call('attachNode',{nodeId:member.nodeId});await f.router.call('attachNode',{nodeId:other.nodeId});
  await f.router.call('saveCollaboration',{leaderId:leader.nodeId,memberIds:[member.nodeId],expectedRevision:0});
  await f.router.call('nodeRequest',{nodeId:leader.nodeId,requestId:'old-parent',message:'delegate',collaboration:true});
  const scope={nodeId:leader.nodeId,parentRequestId:'old-parent'};
  const child=await f.router.collaborationTool(scope,'delegate',{nodeId:member.nodeId,requestId:'child',message:'run'},'call',leader.machineId);
  await f.router.call('saveCollaboration',{leaderId:other.nodeId,memberIds:[],expectedRevision:1});
  assert.deepEqual((await f.router.collaborationTool(scope,'list_agents',{},'call',leader.machineId)).items,[]);
  assert.equal((await f.router.collaborationTool(scope,'task_result',{taskId:child.taskId},'call',leader.machineId)).status,'running');
  assert.equal((await f.router.collaborationTool(scope,'cancel_task',{taskId:child.taskId,operationId:'cancel-old'},'call',leader.machineId)).state,'unknown');
  await assert.rejects(f.router.collaborationTool(scope,'delegate',{nodeId:member.nodeId,requestId:'new-child',message:'run'},'call',leader.machineId),{code:'COLLABORATION_FORBIDDEN'});
  await f.router.call('nodeRequest',{nodeId:other.nodeId,requestId:'new-parent',message:'read',collaboration:true});
  await assert.rejects(f.router.collaborationTool({nodeId:other.nodeId,parentRequestId:'new-parent'},'task_result',{taskId:child.taskId},'call',other.machineId),{code:'COLLABORATION_FORBIDDEN'});
  await assert.rejects(f.router.collaborationTool(scope,'task_result',{taskId:child.taskId},'call',member.machineId),{code:'COLLABORATION_FORBIDDEN'});
  await f.router.call('saveCollaboration',{leaderId:null,memberIds:[],expectedRevision:2});
  assert.equal((await f.router.collaborationTool(scope,'task_result',{taskId:child.taskId},'call',leader.machineId)).status,'running');
  const old=f.hosts.get(leader.machineId).requests.get('old-parent');old.status='succeeded';
  await assert.rejects(f.router.collaborationTool(scope,'task_result',{taskId:child.taskId},'call',leader.machineId),{code:'COLLABORATION_FORBIDDEN'});
});
test('graph separates uncertain, waiting and failed native facts while retaining occupancy and successful machine sync time',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId);
  await f.router.call('nodeRequest',{nodeId:node.nodeId,requestId:'graph-status',message:'read only'});
  host.tasks[0].status='unknown';
  let s=await f.router.snapshot(),n=s.nodes.find(n=>n.nodeId===node.nodeId);
  assert(n.uncertain);assert(!n.available);assert(s.machines.find(m=>m.machineId===node.machineId).lastSyncedAt);
  host.tasks[0].status='running';host.tasks[0].waiting={kind:'permission',requestIds:['original']};
  n=(await f.router.snapshot()).nodes.find(n=>n.nodeId===node.nodeId);assert(n.waiting);assert(!n.available);
  delete host.tasks[0].waiting;host.tasks[0].status='failed';host.tasks[0].error={code:'NATIVE_ACCOUNT',message:'Original native account rejected'};
  n=(await f.router.snapshot()).nodes.find(n=>n.nodeId===node.nodeId);assert.equal(n.lastError.code,'NATIVE_ACCOUNT');
  host.tasks[0].status='succeeded';assert.equal((await f.router.snapshot()).nodes.find(n=>n.nodeId===node.nodeId).lastError,undefined);
});
test('node removal is atomic with authority revocation, survives rescan/restart, and restoring reuses the original identity and history',async t=>{
  const f=await setup(t),leader=f.nodes.find(n=>n.adapter==='claude'),member=f.nodes.find(n=>n.adapter==='opencode');
  await f.router.call('attachNode',{nodeId:member.nodeId});
  await f.router.call('saveCollaboration',{leaderId:leader.nodeId,memberIds:[member.nodeId],expectedRevision:0});
  const task=await f.router.call('nodeRequest',{nodeId:member.nodeId,requestId:'history',message:'original'});
  const host=f.hosts.get(member.machineId);host.tasks[0].status='succeeded';host.agents.at(-1).busy=false;delete host.agents.at(-1).currentTask;
  const p={nodeId:member.nodeId,machineId:member.machineId,operationId:'remove-once',action:'remove'};
  const result=await f.router.call('manageNode',p);assert.equal(result.state,'confirmed');assert.deepEqual(result.data.collaboration.memberIds,[]);assert.equal(result.data.collaboration.revision,2);
  await f.router.call('discover',{machineId:member.machineId});let s=await f.router.snapshot();const removed=s.nodes.find(n=>n.nodeId===member.nodeId);assert(removed.removed);assert(!removed.connected);assert(!removed.available);assert.equal(s.conversations[0].nodeId,member.nodeId);
  assert.equal((await f.router.call('ipc',{op:'task',taskId:task.taskId})).status,'succeeded');
  await assert.rejects(f.router.call('ipc',{op:'continue',conversationId:task.conversationId,requestId:'bypass',message:'no'}),{code:'NODE_DISCONNECTED'});
  await assert.rejects(f.router.call('nodeRequest',{nodeId:member.nodeId,requestId:'new',message:'no'}),{code:'NODE_DISCONNECTED'});
  const restored=new AgentNetwork(f.options);t.after(()=>restored.close());assert.deepEqual(await restored.call('nodeOperation',{operationId:p.operationId}),result);
  assert.deepEqual(await restored.call('manageNode',p),result);
  await assert.rejects(restored.call('manageNode',{...p,action:'attach'}),{code:'OPERATION_CONFLICT'});
  const reattach=await f.router.call('manageNode',{...p,action:'attach',operationId:'restore'});assert.equal(reattach.data.node.nodeId,member.nodeId);
  s=await f.router.snapshot();assert.equal(s.nodes.length,f.nodes.length);assert(!s.nodes.find(n=>n.nodeId===member.nodeId).removed);assert(s.nodes.find(n=>n.nodeId===member.nodeId).connected);assert.deepEqual(s.collaboration.memberIds,[]);assert.equal(s.conversations[0].conversationId,task.conversationId);
});
test('disconnecting the leader clears current authority, stays disconnected despite native contexts, and never changes native settings',async t=>{
  const f=await setup(t),leader=f.nodes.find(n=>n.adapter==='claude'),member=f.nodes.find(n=>n.adapter==='codex');
  await f.router.call('attachNode',{nodeId:member.nodeId});await f.router.call('saveCollaboration',{leaderId:leader.nodeId,memberIds:[member.nodeId],expectedRevision:0});
  const host=f.hosts.get(leader.machineId),before=structuredClone(host.agents);
  await f.router.call('manageNode',{nodeId:leader.nodeId,action:'disconnect',operationId:'disconnect'});
  const s=await f.router.snapshot();assert.deepEqual(s.collaboration,{leaderId:null,memberIds:[],revision:2});assert(!s.nodes.find(n=>n.nodeId===leader.nodeId).connected);assert(!s.nodes.find(n=>n.nodeId===leader.nodeId).removed);assert.deepEqual(host.agents,before);assert.equal(host.executions,0);
});
test('node changes block running, waiting, unknown and omitted busy tasks, plus unconfirmed dispatches and offline sources',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId);
  await f.router.call('nodeRequest',{nodeId:node.nodeId,requestId:'busy',message:'original'});
  let count=0;for(const status of ['running','unknown']){host.tasks[0].status=status;for(const action of ['attach','disconnect','remove'])await assert.rejects(f.router.call('manageNode',{nodeId:node.nodeId,action,operationId:'blocked-'+count++}),{code:'AGENT_BUSY'});}
  host.tasks[0].waiting={kind:'permission'};await assert.rejects(f.router.call('manageNode',{nodeId:node.nodeId,action:'remove',operationId:'waiting'}),{code:'AGENT_BUSY'});
  host.tasks=[];await assert.rejects(f.router.call('manageNode',{nodeId:node.nodeId,action:'remove',operationId:'omitted'}),{code:'AGENT_BUSY'});
  host.agents.at(-1).busy=false;delete host.agents.at(-1).currentTask;await assert.rejects(f.router.call('manageNode',{nodeId:node.nodeId,action:'remove',operationId:'unconfirmed'}),{code:'AGENT_BUSY'});
  host.offline=true;await assert.rejects(f.router.call('manageNode',{nodeId:node.nodeId,action:'remove',operationId:'offline'}),{code:'MACHINE_OFFLINE'});
  assert.equal((f.router.network.nodeOperations||[]).length,0);
});
test('failed node commit keeps identity, admission, relations and original receipt unchanged',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),before=structuredClone(f.router.network),rename=fs.renameSync;
  fs.renameSync=(a,b)=>{if(b===f.router.networkFile&&JSON.parse(fs.readFileSync(a)).nodeOperations?.some(o=>o.operationId==='disk-failure'))throw error('ENOSPC');return rename(a,b);};
  try{await assert.rejects(f.router.call('manageNode',{nodeId:node.nodeId,action:'remove',operationId:'disk-failure'}),{code:'ENOSPC'});}finally{fs.renameSync=rename;}
  assert.equal(f.router.node(node.nodeId).connected,before.nodes.find(n=>n.nodeId===node.nodeId).connected);assert.deepEqual(f.router.network.collaboration,before.collaboration);assert.equal((await f.router.call('nodeOperation',{operationId:'disk-failure'})).state,'not_found');
});
test('the admission lock blocks concurrent new node and legacy submissions during a node change',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude');let release,started;
  const entered=new Promise(r=>started=r),hold=new Promise(r=>release=r),original=f.router.snapshot.bind(f.router);
  f.router.snapshot=async()=>{started();await hold;return original();};
  const pending=f.router.call('manageNode',{nodeId:node.nodeId,action:'disconnect',operationId:'locked'});await entered;
  await assert.rejects(f.router.call('nodeRequest',{nodeId:node.nodeId,requestId:'race',message:'no'}),{code:'AGENT_BUSY'});
  await assert.rejects(f.router.call('ipc',{op:'submit',agentId:node.machineId+'::old-a',requestId:'legacy-race',message:'no'}),{code:'AGENT_BUSY'});
  release();await pending;assert.equal(f.hosts.get(node.machineId).executions,0);
});
test('the production coordinator rejects node changes while original native controls or authorization writes are unknown',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude');const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
  const service=createCoordinatorService({directory:f.directory,platform:'win32',network:f.router,version:'test'});t.after(()=>service.close());
  fs.writeFileSync(path.join(f.directory,'pending.json'),JSON.stringify([{id:'original-control',machineId:node.machineId,state:'unknown',params:{op:'cancel',operationId:'original-control'}}]));
  let reply=await service.call({method:'manageNode',params:{nodeId:node.nodeId,operationId:'new-node',action:'remove'}});assert.equal(reply.error.code,'DESKTOP_UNCONFIRMED');assert.equal(f.router.node(node.nodeId).removed,undefined);
  reply=await service.call({method:'attachNode',params:{nodeId:node.nodeId}});assert.equal(reply.error.code,'DESKTOP_UNCONFIRMED');
  fs.writeFileSync(path.join(f.directory,'pending.json'),'[]');
  fs.writeFileSync(path.join(f.directory,'graph-pending.json'),JSON.stringify([{lane:'relation',operationId:'original-relation',state:'unknown',params:{operationId:'original-relation',expectedRevision:0,leaderId:node.nodeId,memberIds:[]}}]));
  reply=await service.call({method:'manageNode',params:{nodeId:node.nodeId,operationId:'another-node',action:'remove'}});assert.equal(reply.error.code,'GRAPH_UNCONFIRMED');assert.equal(f.router.node(node.nodeId).removed,undefined);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory,'graph-pending.json')))[0].operationId,'original-relation');
});
test('the coordinator retains a definitive node rejection for original receipt queries and enforces machine provenance',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude');const {createCoordinatorService}=require('../electron/coordinator-service.cjs');const service=createCoordinatorService({directory:f.directory,platform:'win32',network:f.router,version:'test'});t.after(()=>service.close());
  const p={nodeId:node.nodeId,operationId:'rejected-node',action:'invalid'};
  const rejected=await service.call({method:'manageNode',params:p});assert.equal(rejected.error.code,'INVALID_INPUT');
  const receipt=await service.call({method:'nodeOperation',params:{operationId:p.operationId}});assert.equal(receipt.result.state,'rejected');assert.equal(receipt.result.operationId,p.operationId);
  const forged=await service.call({method:'manageNode',params:{...p,operationId:'forged',action:'remove',machineId:'other'}});assert.equal(forged.error.code,'WRONG_MACHINE');assert(!f.router.node(node.nodeId).removed);
});
test('legacy imported instance ownership is rechecked after snapshot before native admission',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude');await f.router.call('manageNode',{nodeId:node.nodeId,operationId:'detach-import',action:'disconnect'});
  const instance=f.router.catalog.instances.find(i=>i.nodeId===node.nodeId);delete instance.nodeId;
  await assert.rejects(f.router.call('ipc',{op:'submit',agentId:instance.instanceId,requestId:'unbound-bypass',message:'no'}),{code:'NODE_DISCONNECTED'});
  assert.equal(f.hosts.get(node.machineId).executions,0);
});

test('Windows OpenCode runtime failures reject before dispatch and legacy unknown recovery reads the original intent only',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId);
  node.adapter='opencode';f.router.node(node.nodeId).adapter='opencode';
  const originalCall=host.call.bind(host);host.call=async(method,p)=>method==='context'?Promise.reject(error('CLAUDE_RUNTIME_INVALID')):originalCall(method,p);
  const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
  let service=createCoordinatorService({directory:f.directory,platform:'win32',version:'fixture',network:f.router});
  const params={op:'submit',nodeId:node.nodeId,machineId:node.machineId,requestId:'runtime-original',message:'private original prompt',collaboration:false};
  const failed=await service.call({method:'nodeRequest',params});assert.equal(failed.error.code,'CLAUDE_RUNTIME_INVALID');assert.equal(service.pending().length,0);
  const file=path.join(f.directory,'pending.json'),rows=JSON.parse(fs.readFileSync(file));
  assert.equal(rows[0].state,'rejected');assert.equal(host.executions,0);
  assert.equal(f.router.network.requests[0].dispatched,false);
  // Reproduce the original alpha.9 journal and reopen the same identity.
  rows[0].state='unknown';fs.writeFileSync(file,JSON.stringify(rows));
  const restored=new AgentNetwork(f.options);t.after(()=>restored.close());
  service=createCoordinatorService({directory:f.directory,platform:'win32',version:'fixture',network:restored});
  const before=host.calls.length,result=await service.recoverPending();
  assert.equal(result.resolved,1);assert.equal(result.remaining,0);assert.equal(service.pending().length,0);
  assert.equal(host.calls.length,before);assert.equal(host.executions,0);
  const saved=JSON.parse(fs.readFileSync(file))[0];assert.equal(saved.id,'runtime-original');assert.equal(saved.state,'rejected');assert.equal(saved.params.message,params.message);assert(saved.reconciledAt);
  assert.equal(restored.network.requests.length,1);assert.equal(restored.network.requests[0].requestId,'runtime-original');
});

test('runtime migration cannot settle missing, changed, foreign, in-flight or dispatched original intents',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId);
  f.router.node(node.nodeId).adapter='opencode';
  const originalCall=host.call.bind(host);host.call=async(method,p)=>method==='context'?Promise.reject(error('CLAUDE_RUNTIME_INVALID')):originalCall(method,p);
  const p={op:'submit',nodeId:node.nodeId,machineId:node.machineId,requestId:'runtime-protected',message:'private original prompt'};
  await assert.rejects(f.router.call('nodeRequest',p),{code:'CLAUDE_RUNTIME_INVALID'});
  const row={id:p.requestId,op:'submit',machineId:p.machineId,params:p,result:{error:{code:'CLAUDE_RUNTIME_INVALID'}}};
  assert(f.router.undispatchedRejection(row));
  const receipt=f.router.network.requests[0],baseline=structuredClone(receipt);
  for(const changes of [{dispatched:true},{dispatched:undefined},{taskId:'existing-task'},{conversationId:'existing-conversation'},{fingerprint:'different'},{machineId:'foreign'},{nodeId:'foreign'}]){
    Object.assign(receipt,changes);assert.equal(f.router.undispatchedRejection(row),null);Object.keys(receipt).forEach(k=>delete receipt[k]);Object.assign(receipt,baseline);
  }
  for(const changed of [{...row,result:{error:{code:'DESKTOP_TRANSPORT'}}},{...row,params:{...p,message:'changed'}},{...row,params:{...p,collaboration:true}},{...row,params:{...p,machineId:'foreign'}},{...row,params:{...p,requestId:'other'}}])assert.equal(f.router.undispatchedRejection(changed),null);
  f.router.nodeJobs.set(node.nodeId,Promise.resolve());assert.equal(f.router.undispatchedRejection(row),null);f.router.nodeJobs.delete(node.nodeId);
  f.router.network.requests=[];assert.equal(f.router.undispatchedRejection(row),null);assert.equal(host.executions,0);
});

test('legacy runtime lookup retains uncertainty when the original intent is dispatched or changes during recovery',async t=>{
  const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId);
  f.router.node(node.nodeId).adapter='opencode';const originalCall=host.call.bind(host);
  host.call=async(method,p)=>method==='context'?Promise.reject(error('CLAUDE_RUNTIME_INVALID')):originalCall(method,p);
  const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
  const service=createCoordinatorService({directory:f.directory,platform:'win32',network:f.router});
  const p={op:'submit',nodeId:node.nodeId,machineId:node.machineId,requestId:'runtime-race',message:'original'};
  await service.call({method:'nodeRequest',params:p});
  const file=path.join(f.directory,'pending.json'),rows=JSON.parse(fs.readFileSync(file));rows[0].state='unknown';fs.writeFileSync(file,JSON.stringify(rows));
  const check=f.router.undispatchedRejection.bind(f.router);let changed=false;
  f.router.undispatchedRejection=row=>{const result=check(row);if(!changed){changed=true;queueMicrotask(()=>{f.router.network.requests[0].dispatched=true;});}return result;};
  const result=await service.recoverPending();assert.equal(result.resolved,0);assert.equal(service.pending().length,1);assert.equal(result.items[0].code,'JOURNAL_CHANGED');
  const again=await service.recoverPending();assert.equal(again.resolved,0);assert.equal(service.pending().length,1);assert.equal(host.executions,0);
});
test('team continuation keeps original context/conversation, rotates scope and rejects unscoped continuation or old backend',async t=>{
 const f=await setup(t),node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId),original=host.call.bind(host);let upgraded=true;
 host.call=async(method,p)=>{const r=await original(method,p);return method==='context'?{...r,teamCollaboration:true}:method==='scope'?{...r,teamContinuation:upgraded}:r;};
 const first=await f.router.call('nodeRequest',{op:'submit',nodeId:node.nodeId,requestId:'team-first',message:'first',teamScope:{teamSessionId:'first-scope',nodeId:node.nodeId,parentRequestId:'team-first'}});
 for(const task of host.tasks)task.status='succeeded';for(const agent of host.agents){agent.busy=false;delete agent.currentTask;}
 await assert.rejects(f.router.call('nodeRequest',{op:'continue',nodeId:node.nodeId,conversationId:first.conversationId,requestId:'unscoped',message:'no'}),{code:'TEAM_FORBIDDEN'});
 const second=await f.router.call('nodeRequest',{op:'continue',nodeId:node.nodeId,conversationId:first.conversationId,requestId:'team-second',message:'second',teamScope:{teamSessionId:'new-scope',nodeId:node.nodeId,parentRequestId:'team-second'}});
 assert.equal(second.conversationId,first.conversationId);assert.equal(host.executions,2);assert.equal(host.calls.filter(x=>x.method==='context').length,1);assert.equal(host.calls.find(x=>x.method==='scope').p.scope.teamSessionId,'new-scope');
 for(const task of host.tasks)task.status='succeeded';for(const agent of host.agents){agent.busy=false;delete agent.currentTask;}
 upgraded=false;await assert.rejects(f.router.call('nodeRequest',{op:'continue',nodeId:node.nodeId,conversationId:first.conversationId,requestId:'old-backend',message:'third',teamScope:{teamSessionId:'third',nodeId:node.nodeId,parentRequestId:'old-backend'}}),{code:'TEAM_UPGRADE_REQUIRED'});assert.equal(host.executions,2);
});

test('native upgrades keep one current node and its role, retaining historical aliases and unknown occupancy',async t=>{
  const f=await setup(t),original=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(original.machineId);
  await f.router.call('attachNode',{nodeId:original.nodeId});
  f.router.network.collaboration={leaderId:original.nodeId,memberIds:[],revision:7};
  const connection=f.router.connection(f.router.machine(original.machineId),'C:/old/2.1.299/claude.exe',{adapter:'claude',name:'Claude Code',connected:true});
  const alias={...f.router.node(original.nodeId),nodeId:'historical-claude',connectionId:connection.connectionId,executable:connection.executable};
  f.router.network.nodes.push(alias);
  const receipt={nodeId:alias.nodeId,machineId:alias.machineId,requestId:'original-unknown',dispatched:true,fingerprint:'unchanged'};
  f.router.network.requests.push(receipt);
  host.items[0]={...host.items[0],executable:'C:/current/claude.exe',version:'2.1.302'};
  await f.router.call('discover',{machineId:original.machineId});
  let snapshot=await f.router.snapshot();
  const visible=snapshot.nodes.filter(n=>n.machineId===original.machineId&&n.adapter==='claude'&&!n.supersededBy);
  assert.equal(visible.length,1);const current=visible[0];
  assert.equal(current.nodeId,original.nodeId);assert.equal(current.version,'2.1.302');assert.equal(current.executable,host.items[0].executable);
  assert.equal(current.connected,true);assert.equal(current.busy,true);assert.equal(current.unconfirmed,1);assert.equal(current.available,false);
  assert.equal(snapshot.nodes.find(n=>n.nodeId===alias.nodeId).supersededBy,current.nodeId);
  assert.deepEqual(f.router.network.requests[0],receipt);assert.equal(snapshot.collaboration.leaderId,original.nodeId);assert.equal(snapshot.collaboration.revision,7);
  assert.equal(f.router.pendingBlocks({machineId:alias.machineId,params:{nodeId:alias.nodeId}},{machineId:current.machineId,nodeId:current.nodeId}),true);
  await assert.rejects(f.router.call('nodeRequest',{nodeId:current.nodeId,requestId:'new',message:'blocked'}),{code:'AGENT_BUSY'});
  await assert.rejects(f.router.call('nodeRequest',{nodeId:alias.nodeId,requestId:'alias-new',message:'blocked'}),{code:'NODE_SUPERSEDED'});
  assert.equal(host.executions,0);
  const reopened=new AgentNetwork({...f.options,createHost:machine=>f.hosts.get(machine.machineId)});t.after(()=>reopened.close());
  snapshot=await reopened.snapshot();
  const refreshed=snapshot.nodes.find(n=>n.nodeId===original.nodeId);
  assert.equal(refreshed.version,'2.1.302');assert.equal(refreshed.busy,true);
  assert.equal(snapshot.nodes.filter(n=>n.machineId===original.machineId&&n.adapter==='claude'&&!n.supersededBy).length,1);
});

test('delegation uses durable undispatched preparation rejection for any code and keeps it on same-ID retry',async t=>{
 const f=await setup(t),leader=f.nodes.find(n=>n.adapter==='claude'),member=f.nodes.find(n=>n.adapter==='codex');
 await f.router.call('attachNode',{nodeId:member.nodeId});
 await f.router.call('saveCollaboration',{leaderId:leader.nodeId,memberIds:[member.nodeId],expectedRevision:0});
 await f.router.call('nodeRequest',{nodeId:leader.nodeId,requestId:'proof-parent',message:'delegate',collaboration:true});
 const h=f.hosts.get(member.machineId),call=h.call.bind(h),scope={nodeId:leader.nodeId,parentRequestId:'proof-parent'};let preparations=0;
 h.call=async(method,p)=>{if(method==='context'){preparations++;throw Object.assign(Error('当前原生 API 不兼容，请接入受支持的工具。'),{code:'FUTURE_PREPARATION_ERROR'});}return call(method,p);};
 const args={nodeId:member.nodeId,requestId:'same-child',message:'must never dispatch'};
 for(let i=0;i<2;i++){
  await assert.rejects(f.router.collaborationTool(scope,'delegate',args,'fixture',leader.machineId),e=>e.code==='FUTURE_PREPARATION_ERROR'&&e.message==='当前原生 API 不兼容，请接入受支持的工具。');
  assert.equal(f.router.network.delegations[0].state,'rejected');
 }
 assert.equal(preparations,1);assert.equal(h.executions,1,'only parent executed on this shared machine');
 const receipt=f.router.network.requests.find(r=>r.requestId===f.router.network.delegations[0].requestId);assert.equal(receipt.dispatched,false);assert.equal(receipt.taskId,undefined);
});

test('API compatibility and old-daemon capability constrain node availability before delegation',async t=>{
 const f=await setup(t),node=f.nodes.find(n=>n.adapter==='opencode'),machine=f.router.machine(node.machineId),h=f.hosts.get(node.machineId),call=h.call.bind(h);
 let observed=(await f.router.snapshot()).nodes.find(n=>n.nodeId===node.nodeId);assert.equal(observed.status,'needs_check');assert.equal(observed.available,false);assert.equal(observed.connectionCapabilities.execution,false);
 h.call=async(method,p)=>{if(method==='context')throw Object.assign(Error('原生 API 不兼容'),{code:'OPENCODE_API_UNSUPPORTED'});return call(method,p);};
 await assert.rejects(f.router.call('attachNode',{nodeId:node.nodeId}),{code:'OPENCODE_API_UNSUPPORTED'});
 observed=(await f.router.snapshot()).nodes.find(n=>n.nodeId===node.nodeId);assert.equal(observed.available,false);assert.equal(observed.status,'needs_check');assert.match(observed.error,/API 不兼容/);
 h.call=call;await f.router.call('attachNode',{nodeId:node.nodeId});observed=(await f.router.snapshot()).nodes.find(n=>n.nodeId===node.nodeId);assert.equal(observed.status,'connected');assert.equal(observed.connectionCapabilities.delegation,true);
 machine.objectRoutingSupported=false;observed=(await f.router.snapshot()).nodes.find(n=>n.nodeId===node.nodeId);assert.equal(observed.status,'upgrade_required');assert.equal(observed.available,false);assert.equal(observed.connectionCapabilities.delegation,false);
});

test('delegated result exposes each backend native failure and preserves original task IDs',async t=>{
 const f=await setup(t),leader=f.nodes.find(n=>n.adapter==='claude'),member=f.nodes.find(n=>n.adapter==='opencode');await f.router.call('attachNode',{nodeId:member.nodeId});
 await f.router.call('saveCollaboration',{leaderId:leader.nodeId,memberIds:[member.nodeId],expectedRevision:0});await f.router.call('nodeRequest',{nodeId:leader.nodeId,requestId:'error-parent',message:'read errors',collaboration:true});
 const scope={nodeId:leader.nodeId,parentRequestId:'error-parent'},h=f.hosts.get(member.machineId),task=await f.router.collaborationTool(scope,'delegate',{nodeId:member.nodeId,requestId:'child-error',message:'controlled'},'fixture',leader.machineId),raw=h.tasks[0];
 for(const error of [{code:'CLAUDE_SSL',message:'API SSL certificate verification failed'},{code:'CODEX_EVENT_LIMIT',message:'Codex 事件超过长度限制'}]){
  raw.status='failed';raw.error=error;const result=await f.router.collaborationTool(scope,'task_result',{taskId:task.taskId},'fixture',leader.machineId);assert.equal(result.status,'failed');assert.deepEqual(result.error,error);assert.equal(result.taskId,task.taskId);
 }
 assert.equal(h.executions,1);
});
