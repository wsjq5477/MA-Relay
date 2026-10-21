'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
const {adapters,connectionCapabilities}=require('../electron/builtin-adapters.cjs');
const tools=['claude','opencode','codex','hermes','pi','dsh','dsh-desktop','dsh-web'];
const callers=['claude','opencode','codex'];
function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-connection-capabilities-'));
 const host={agents:[],tasks:[],conversations:[],calls:[],executions:0,scopeSupported:undefined,
  setCollaboration(){},close(){},
  async call(method,p={}){
   this.calls.push({method,p:structuredClone(p)});
   if(method==='discover')return {items:tools.map(adapter=>({adapter,name:adapter,version:'2.0.24',executable:'/controlled/'+adapter,healthy:true,executionSupported:true}))};
   if(method==='snapshot')return structuredClone({agents:{items:this.agents,revision:0},tasks:this.tasks,conversations:this.conversations});
   if(method==='connectTool')return {};
   if(method==='context'){
    const agentId='agent-'+this.agents.length,contextId='context-'+agentId;
    this.agents.push({agentId,adapter:p.adapter,nodeId:p.nodeId,workspace:'/controlled/work/'+agentId,executable:p.executable,healthy:true,available:true,online:true,enabled:true});
    return {agentId,contextId,...(this.scopeSupported===undefined?{}:{teamCollaboration:this.scopeSupported})};
   }
   if(method==='scope')return {configured:true,...(this.scopeSupported===undefined?{}:{teamCollaboration:this.scopeSupported})};
   if(method==='ipc'){
    if(p.op==='submit'){
     this.executions++;const task={taskId:'task-'+p.requestId,conversationId:'conversation-'+p.requestId,targetAgent:p.agentId,requestId:p.requestId,message:p.message,status:'running',createdAt:'2026-10-18T00:00:00.000Z',updatedAt:'2026-10-18T00:00:00.000Z'};
     this.tasks.push(task);this.conversations.push({conversationId:task.conversationId,targetAgent:task.targetAgent,updatedAt:task.updatedAt,canContinue:false});return structuredClone(task);
    }
    if(p.op==='request'||p.op==='task'){const task=this.tasks.find(task=>p.op==='request'?task.requestId===p.requestId:task.taskId===p.taskId);if(task)return structuredClone(task);}
   }
   throw Object.assign(Error('Not found'),{code:'NOT_FOUND'});
  }};
 const network=new AgentNetwork({directory,platform:'linux',hostname:'Controlled',createHost:()=>host});
 const service=createCoordinatorService({directory,network,teamTickMs:600000});
 t.after(()=>{service.close();fs.rmSync(directory,{recursive:true,force:true});});
 return {directory,host,network,service,async ready(){const s=await network.snapshot();for(const n of s.nodes)await network.call('attachNode',{nodeId:n.nodeId});return (await network.snapshot()).nodes;}};
}
test('eight static descriptors explicitly separate execution, delegation, MCP caller and controls',()=>{
 for(const adapter of tools){
  const d=adapters.get(adapter),n=connectionCapabilities({adapter,executionSupported:true});
  assert.equal(d.capabilities.execution,true);assert.equal(d.capabilities.delegation,true);
  assert.equal(d.capabilities.bridgeMcp,callers.includes(adapter));
  assert.equal(n.connectionCapabilities.execution,true);assert.equal(n.connectionCapabilities.delegation,true);
  assert.equal(n.connectionCapabilities.bridgeMcp,callers.includes(adapter));
  for(const key of ['resume','cancellation','permissions','forms','verification'])assert.equal(typeof n.connectionCapabilities[key],'boolean');
  assert.deepEqual(n.capabilitySource,{kind:'static-adapter',adapterId:adapter,driver:['opencode','dsh-desktop','dsh-web'].includes(adapter)?'cli-http':'native-cli'});
 }
});
test('unknown or explicitly absent capabilities cannot be enabled by RPC metadata',()=>{
 const unknown=connectionCapabilities({adapter:'unregistered',executionSupported:true,connectionCapabilities:{execution:true,bridgeMcp:true}});
 assert.equal(unknown.connectionCapabilities.execution,null);assert.equal(unknown.connectionCapabilities.bridgeMcp,null);
 assert.deepEqual(unknown.capabilitySource,{kind:'unknown'});
 assert.equal(connectionCapabilities({adapter:'hermes',connectionCapabilities:{bridgeMcp:true}}).connectionCapabilities.bridgeMcp,false);
 for(const value of [false,null])assert.equal(connectionCapabilities({adapter:'claude',connectionCapabilities:{bridgeMcp:value}}).connectionCapabilities.bridgeMcp,value);
 const unavailable=connectionCapabilities({adapter:'claude',executionSupported:false});assert.equal(unavailable.connectionCapabilities.execution,false);assert.equal(unavailable.connectionCapabilities.delegation,false);
 assert.equal(connectionCapabilities({adapter:'claude',teamCollaboration:false}).connectionCapabilities.bridgeMcp,false);
 assert.equal(connectionCapabilities({adapter:'claude',connectionCapabilities:{bridgeMcp:true}}).connectionCapabilities.execution,null);
 assert.equal(connectionCapabilities({adapter:'claude',capabilitySource:{kind:'unknown'}}).connectionCapabilities.bridgeMcp,null);
 assert.equal(connectionCapabilities({adapter:'claude',capabilitySource:{kind:'static-adapter',adapterId:'codex'}}).connectionCapabilities.execution,null);
 assert.equal(unavailable.connectionCapabilities.bridgeMcp,false);
});
test('new classic callers reject before business intent while direct-only agents remain delegation targets',async t=>{
 const f=fixture(t),nodes=await f.ready(),leader=nodes.find(n=>n.adapter==='claude');
 for(const adapter of tools.filter(a=>!callers.includes(a))){
  const target=nodes.find(n=>n.adapter===adapter),params={operationId:'reject-'+adapter,leaderId:target.nodeId,memberIds:[],expectedRevision:0};
  const relation=await f.service.call({method:'saveCollaboration',params});assert.equal(relation.ok,false);assert.equal(relation.error.code,'COLLABORATION_CAPABILITY');
  assert.equal((await f.network.call('collaborationOperation',{operationId:params.operationId})).state,'not_found');
  const request=await f.service.call({method:'nodeRequest',params:{op:'submit',nodeId:target.nodeId,requestId:'reject-'+adapter,message:'controlled',collaboration:true}});
  assert.equal(request.ok,false);assert.equal(request.error.code,'COLLABORATION_CAPABILITY');
 }
 assert.equal(f.network.network.requests.length,0);assert.equal(f.host.executions,0);assert.equal(f.host.calls.filter(c=>c.method==='context'&&c.p.scope).length,0); // OpenCode attach probes read-only API metadata without a task scope.
 assert.equal(f.service.pending().length,0);
 const graphRows=JSON.parse(fs.readFileSync(path.join(f.directory,'graph-pending.json')));assert(graphRows.every(row=>row.state==='rejected'));
 for(const row of graphRows){const original=await f.service.call({method:'collaborationOperation',params:{operationId:row.operationId}});assert.equal(original.result.state,'rejected');assert.equal(original.result.error.code,'COLLABORATION_CAPABILITY');}
 const members=nodes.filter(n=>!callers.includes(n.adapter));
 const saved=await f.service.call({method:'saveCollaboration',params:{operationId:'valid',leaderId:leader.nodeId,memberIds:members.map(n=>n.nodeId),expectedRevision:0}});assert.equal(saved.ok,true,JSON.stringify(saved.error));
 const parent=await f.network.call('nodeRequest',{op:'submit',nodeId:leader.nodeId,requestId:'parent',message:'controlled',collaboration:true});
 const scope={nodeId:leader.nodeId,parentRequestId:'parent'},listed=await f.network.collaborationTool(scope,'list_agents',{},'list',leader.machineId);
 assert.equal(listed.items.length,tools.length-callers.length);
 for(const target of listed.items){
  assert.equal(target.connectionCapabilities.bridgeMcp,false);assert.equal(target.connectionCapabilities.delegation,true);assert.equal(target.capabilitySource.kind,'static-adapter');
  assert.equal(Object.hasOwn(target,'executable'),false);assert.equal(Object.hasOwn(target,'model'),false);
  const task=await f.network.collaborationTool(scope,'delegate',{nodeId:target.nodeId,requestId:'child-'+target.adapter,message:'controlled'},'delegate-'+target.adapter,leader.machineId);assert.equal(task.status,'running');
  const childCall=f.host.calls.filter(c=>c.method==='context'&&c.p.nodeId===target.nodeId).at(-1);assert.equal(Object.hasOwn(childCall.p,'scope'),false);
 }
 assert.equal(f.host.executions,1+tools.length-callers.length);assert.equal(parent.status,'running');
});
test('old relation and dispatched request receipts recover before current caller capability checks',async t=>{
 const f=fixture(t),nodes=await f.ready(),leader=nodes.find(n=>n.adapter==='claude'),params={operationId:'original-relation',leaderId:leader.nodeId,memberIds:[],expectedRevision:0};
 const saved=await f.service.call({method:'saveCollaboration',params});assert.equal(saved.ok,true);
 const request={op:'submit',nodeId:leader.nodeId,requestId:'original-request',message:'controlled',collaboration:true};
 const accepted=await f.service.call({method:'nodeRequest',params:request});assert.equal(accepted.ok,true,JSON.stringify(accepted.error));
 f.network.node(leader.nodeId).connectionCapabilities={execution:false,bridgeMcp:false};
 const receipt=await f.service.call({method:'saveCollaboration',params});assert.deepEqual(receipt,saved);
 const task=await f.service.call({method:'nodeRequest',params:request});assert.equal(task.ok,true,JSON.stringify(task.error));assert.equal(task.result.taskId,accepted.result.taskId);assert.equal(f.host.executions,1);
 const query=await f.service.call({method:'ipc',params:{op:'request',machineId:leader.machineId,requestId:request.requestId}});assert.equal(query.ok,true);assert.equal(query.result.taskId,accepted.result.taskId);
});
test('actual context refusal prevents classic dispatch even after static admission',async t=>{
 const f=fixture(t),nodes=await f.ready(),leader=nodes.find(n=>n.adapter==='claude');f.host.scopeSupported=false;
 await f.network.call('saveCollaboration',{leaderId:leader.nodeId,memberIds:[],expectedRevision:0});
 const result=await f.service.call({method:'nodeRequest',params:{op:'submit',nodeId:leader.nodeId,requestId:'remote-refusal',message:'controlled',collaboration:true}});
 assert.equal(result.ok,false);assert.equal(result.error.code,'COLLABORATION_CAPABILITY');assert.equal(f.host.executions,0);assert.equal(f.service.pending().length,0);
 assert.equal(f.network.network.requests[0].dispatched,false);
});
test('explicit unknown execution or delegation blocks a new relation without modifying the old one',async t=>{
 for(const lane of ['execution','delegation'])await t.test(lane,async t=>{
  const f=fixture(t),nodes=await f.ready(),leader=nodes.find(n=>n.adapter==='claude'),child=nodes.find(n=>n.adapter==='hermes');
  const n=f.network.node(lane==='execution'?leader.nodeId:child.nodeId);
  n.connectionCapabilities={...connectionCapabilities(n).connectionCapabilities,[lane]:null};
  await assert.rejects(f.network.call('saveCollaboration',{leaderId:leader.nodeId,memberIds:[child.nodeId],expectedRevision:0}),{code:'COLLABORATION_CAPABILITY'});
  assert.equal(f.network.network.collaboration.revision,0);assert.equal(f.network.network.delegations.length,0);assert.equal(f.host.executions,0);
 });
});
test('new delegation rechecks declared caller and target but original delegated task remains readable',async t=>{
 const f=fixture(t),nodes=await f.ready(),leader=nodes.find(n=>n.adapter==='claude'),child=nodes.find(n=>n.adapter==='hermes');
 await f.network.call('saveCollaboration',{leaderId:leader.nodeId,memberIds:[child.nodeId],expectedRevision:0});
 await f.network.call('nodeRequest',{op:'submit',nodeId:leader.nodeId,requestId:'parent',message:'controlled',collaboration:true});
 const scope={nodeId:leader.nodeId,parentRequestId:'parent'},args={nodeId:child.nodeId,requestId:'original-child',message:'controlled'};
 const original=await f.network.collaborationTool(scope,'delegate',args,'original',leader.machineId);
 const n=f.network.node(child.nodeId);n.connectionCapabilities={...connectionCapabilities(n).connectionCapabilities,delegation:false};
 const replay=await f.network.collaborationTool(scope,'delegate',args,'retry',leader.machineId);assert.equal(replay.taskId,original.taskId);assert.equal(f.host.executions,2);
 await assert.rejects(f.network.collaborationTool(scope,'delegate',{...args,requestId:'new-child'},'new',leader.machineId),{code:'COLLABORATION_CAPABILITY'});
 const read=await f.network.collaborationTool(scope,'task_result',{taskId:original.taskId},'read',leader.machineId);assert.equal(read.taskId,original.taskId);
 const parent=f.network.node(leader.nodeId);parent.connectionCapabilities={...connectionCapabilities(parent).connectionCapabilities,bridgeMcp:false};
 await assert.rejects(f.network.collaborationTool(scope,'delegate',{...args,requestId:'new-child-caller'},'new',leader.machineId),{code:'COLLABORATION_CAPABILITY'});
 assert.equal(f.network.network.delegations.length,1);assert.equal(f.host.executions,2);
});
test('bare remote capability error after native dispatch remains unknown and recovers by original request',async t=>{
 const f=fixture(t),nodes=await f.ready(),node=nodes.find(n=>n.adapter==='claude'),call=f.host.call.bind(f.host);
 f.host.call=async(method,p)=>{const result=await call(method,p);if(method==='ipc'&&p.op==='submit')throw Object.assign(Error('remote same code is not non-dispatch proof'),{code:'COLLABORATION_CAPABILITY'});return result;};
 const result=await f.service.call({method:'nodeRequest',params:{op:'submit',nodeId:node.nodeId,requestId:'lost-after-execution',message:'controlled',collaboration:false}});
 assert.equal(result.ok,false);assert.equal(result.error.code,'COLLABORATION_CAPABILITY');assert.equal(f.host.executions,1);
 assert.equal(f.service.pending().length,1);assert.equal(f.network.network.requests[0].dispatched,true);
 const recovered=await f.service.recoverPending();assert.equal(recovered.resolved,1);assert.equal(f.service.pending().length,0);assert.equal(f.host.executions,1);
});
