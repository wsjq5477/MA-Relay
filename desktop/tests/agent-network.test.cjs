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
