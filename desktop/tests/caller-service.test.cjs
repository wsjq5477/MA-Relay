const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {spawn}=require('node:child_process');
const {createInterface}=require('node:readline');
const {fixture}=require('./interconnect-fixture.cjs');
const {CallerService}=require('../electron/caller-service.cjs');
const {MachineHost}=require('../electron/machine-host.cjs');
const {CollaborationBroker}=require('../electron/collaboration-broker.cjs');
const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
const {startCoordinator}=require('../electron/coordinator.cjs');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');

async function setup(t){
  const f=await fixture(t),target=await f.register();
  const identity=await f.admin('register',{kind:'mcp',externalKey:'external-super-agent',name:'Super-agent',purpose:'Explicit remote delegation'});
  let controller=new CallerService({directory:f.directory,agents:f.registry,network:f.network}),operation=0;
  f.keep({close(){controller.close();}});
  await controller.ready;
  const admin=(name,args={})=>controller.call('callers.'+name,{operationId:'caller-op-'+ ++operation,...args});
  const caller=await admin('create',{agentId:identity.agentId,allowedAgentIds:[target.agentId],operations:['delegate','result','pending','reply','cancel']});
  const opened=await admin('openContext',{principalId:caller.principalId});
  const scopeOf=context=>({principalId:context.principalId,callerContextId:context.contextId,credentialId:context.credentialId});
  const tool=(name,args={},context=opened)=>controller.tool(scopeOf(context),name,args);
  const descriptor=context=>JSON.parse(fs.readFileSync(context.configuration.args.at(-1),'utf8'));
  const http=async(desc,name,args={},extra={})=>{
    const reply=await fetch(desc.url,{method:'POST',headers:{authorization:'Bearer '+desc.token,'content-type':'application/json'},body:JSON.stringify({name,args,...extra})});
    assert.equal(reply.status,200);return reply.json();
  };
  return {...f,target,identity,caller,opened,admin,tool,descriptor,http,scopeOf,get controller(){return controller;},
    async restart(){controller.close();controller=new CallerService({directory:f.directory,agents:f.registry,network:f.network});await controller.ready;}};
}

test('a caller-only principal uses the existing agent identity without installing or impersonating a runtime node',async t=>{
  const f=await setup(t),view=await f.tool('list_agents');
  assert.equal(f.caller.principalId,f.identity.agentId);assert.equal(f.network.network.nodes.length,3);
  assert.equal(view.caller.kind,'independent-caller');assert.equal(view.caller.role,'caller');
  assert.equal(view.caller.nodeId,undefined);assert.equal(view.caller.machineId,undefined);
  assert.equal(view.caller.contextId,f.opened.contextId);
  assert.deepEqual(view.items.map(node=>node.nodeId),[f.child.nodeId]);
  assert.deepEqual(view.items[0].agents.map(agent=>agent.agentId),[f.target.agentId]);
  const publicState=await f.controller.call('callers.list',{}),privateDescriptor=f.descriptor(f.opened);
  assert.equal(privateDescriptor.mode,'caller');assert.equal(JSON.stringify(publicState).includes(privateDescriptor.token),false);
  await assert.rejects(f.tool('connect_agent',{nodeId:f.outsider.nodeId,operationId:'self-grant'}),{code:'CALLER_POLICY_USER_ONLY'});
  assert.equal(f.state.executions,0);assert.deepEqual(f.registry.store.read().runs,[]);
});

test('contexts have separate request and control ownership while sharing one serial native target',async t=>{
  const f=await setup(t),other=await f.admin('openContext',{principalId:f.caller.principalId});
  const input={agentId:f.target.agentId,requestId:'same-upper-request',message:'Compile'};
  const first=await f.tool('delegate',input);
  assert.equal((await f.tool('delegate',input)).taskId,first.taskId);
  await assert.rejects(f.tool('task_result',{taskId:first.taskId},other),{code:'COLLABORATION_FORBIDDEN'});
  await assert.rejects(f.tool('cancel_task',{taskId:first.taskId,operationId:'steal'},other),{code:'COLLABORATION_FORBIDDEN'});
  await assert.rejects(f.tool('delegate',input,other),{code:'AGENT_BUSY'});
  f.state.tasks[0].status='unknown';
  await assert.rejects(f.tool('delegate',{...input,requestId:'unknown-alias'},other),{code:'AGENT_BUSY'});
  await assert.rejects(f.tool('delegate',{nodeId:f.child.nodeId,requestId:'raw-alias',message:'Never send'},other),{code:'COLLABORATION_FORBIDDEN'});
  f.finish(first);
  const next=await f.tool('delegate',{...input,requestId:'known-new-intent'},other);
  assert.notEqual(next.taskId,first.taskId);assert.notEqual(next.conversationId,first.conversationId);
  assert.equal(f.state.executions,2);
  const ledger=f.network.network.delegations.find(row=>row.taskId===first.taskId);
  assert.equal(ledger.parentTaskId,null);assert.equal(ledger.callerPrincipalId,f.caller.principalId);assert.equal(ledger.callerContextId,f.opened.contextId);
  await assert.rejects(f.tool('task_result',{taskId:next.taskId}),{code:'COLLABORATION_FORBIDDEN'});
});

test('credential rotation revokes old bearer tokens and retains the same context and original delegated task',async t=>{
  const f=await setup(t),input={agentId:f.target.agentId,requestId:'original',message:'Compile'},task=await f.tool('delegate',input);
  const previous=f.descriptor(f.opened);
  const rotated=await f.admin('rotateCredential',{contextId:f.opened.contextId,expectedRevision:1,operationId:'rotate-original'});
  assert.equal(rotated.contextId,f.opened.contextId);assert.notEqual(rotated.credentialId,f.opened.credentialId);
  const current=f.descriptor(rotated);assert.ok(current.token!==previous.token,'Rotation must issue a different secret.');
  assert.equal((await f.http(previous,'task_result',{taskId:task.taskId})).error.code,'CALLER_REVOKED');
  assert.equal((await f.http(current,'task_result',{taskId:task.taskId})).result.status,'running');
  await assert.rejects(f.tool('task_result',{taskId:task.taskId}),{code:'CALLER_REVOKED'});
  f.finish(task);
  const next=await f.tool('delegate',{...input,requestId:'follow-up',conversationId:task.conversationId},rotated);
  assert.equal(next.conversationId,task.conversationId);assert.equal(f.state.executions,2);
  const receipt=await f.controller.call('callers.operation',{operationId:'rotate-original'});
  assert.equal(receipt.data.credentialId,rotated.credentialId);
  const stored=f.registry.store.db.prepare('SELECT result FROM receipts WHERE actor=? AND operation=?').get('user','rotate-original').result;
  assert.equal(stored.includes(current.token),false);
  const twice=await f.admin('rotateCredential',{contextId:f.opened.contextId,expectedRevision:2});
  const newest=f.descriptor(twice);
  const oldReceipt=await f.controller.call('callers.operation',{operationId:'rotate-original'});
  assert.equal(oldReceipt.data.configurationState,'superseded');assert.ok(JSON.stringify(f.descriptor(twice))===JSON.stringify(newest),'An old receipt must not rewrite the current descriptor.');
});

test('context preparation receipts and restart restore original IDs without creating tasks or new credentials',async t=>{
  const f=await setup(t),task=await f.tool('delegate',{agentId:f.target.agentId,requestId:'original',message:'Compile'});
  const counts=f.controller.state();await f.restart();
  const restored=f.controller.state();assert.deepEqual(restored,counts);
  assert.equal((await f.tool('task_result',{taskId:task.taskId})).status,'running');assert.equal(f.state.executions,1);
  const params={principalId:f.caller.principalId,operationId:'open-original'};
  const opened=await f.controller.call('callers.openContext',params);
  assert.equal((await f.controller.call('callers.openContext',params)).contextId,opened.contextId);
  assert.equal((await f.controller.call('callers.operation',{operationId:'open-original'})).data.credentialId,opened.credentialId);
  await assert.rejects(f.controller.call('callers.openContext',{...params,principalId:'different'}),{code:'TEAM_OPERATION_CONFLICT'});
});

test('a forged context in the HTTP body cannot borrow another authenticated context task',async t=>{
  const f=await setup(t),other=await f.admin('openContext',{principalId:f.caller.principalId});
  const task=await f.tool('delegate',{agentId:f.target.agentId,requestId:'original',message:'Compile'});
  const reply=await f.http(f.descriptor(other),'task_result',{taskId:task.taskId}, {scope:f.scopeOf(f.opened),principalId:f.caller.principalId});
  assert.equal(reply.error.code,'COLLABORATION_FORBIDDEN');assert.equal(f.state.executions,1);
  const original=await f.tool('task_result',{taskId:task.taskId});assert.equal(original.status,'running');
});

test('target revocation during preparation refuses the prompt and preserves the exact original intent',async t=>{
  const f=await setup(t);
  f.state.onContext=()=>f.admin('configure',{principalId:f.caller.principalId,expectedRevision:1,allowedAgentIds:[]});
  await assert.rejects(f.tool('delegate',{agentId:f.target.agentId,requestId:'never-replay',message:'Never send'}),{code:'COLLABORATION_FORBIDDEN'});
  assert.equal(f.state.executions,0);assert.equal(f.network.network.requests[0].dispatched,false);
  assert.equal(f.network.network.requests[0].preparationRejection,'COLLABORATION_FORBIDDEN');
  assert.equal(f.network.network.delegations[0].state,'rejected');
  assert.deepEqual((await f.tool('list_agents')).items,[]);
});

test('grant shrinkage and operation revocation are current while original owned results remain separate',async t=>{
  const f=await setup(t),task=await f.tool('delegate',{agentId:f.target.agentId,requestId:'original',message:'Compile'});f.finish(task);
  await f.admin('configure',{principalId:f.caller.principalId,expectedRevision:1,allowedAgentIds:[],operations:['result']});
  const result=await f.tool('task_result',{taskId:task.taskId});assert.equal(result.status,'succeeded');assert.equal(result.canContinue,false);
  await assert.rejects(f.tool('cancel_task',{taskId:task.taskId,operationId:'cancel'}),{code:'CALLER_OPERATION_FORBIDDEN'});
  await f.admin('closeContext',{contextId:f.opened.contextId,expectedRevision:1});
  await assert.rejects(f.tool('task_result',{taskId:task.taskId}),{code:'CALLER_REVOKED'});
  assert.equal(f.state.tasks[0].status,'succeeded');assert.equal(f.state.executions,1);
});

test('principal and context revoke invalidate access without cancellation or namespace reuse',async t=>{
  const f=await setup(t),task=await f.tool('delegate',{agentId:f.target.agentId,requestId:'original',message:'Compile'});
  f.state.tasks[0].status='unknown';
  await f.admin('revoke',{principalId:f.caller.principalId,expectedRevision:1});
  await assert.rejects(f.tool('task_result',{taskId:task.taskId}),{code:'CALLER_REVOKED'});
  assert.equal(f.state.tasks[0].status,'unknown');
  await assert.rejects(f.admin('create',{agentId:f.identity.agentId}),{code:'CALLER_DUPLICATE'});
  await f.admin('closeContext',{contextId:f.opened.contextId,expectedRevision:1});
  assert.equal(f.controller.state().contexts[0].enabled,false);
});

test('workspace overrides are rejected before creating an intent and cannot expand native resource permissions',async t=>{
  const f=await setup(t);
  for(const workspace of ['/outside','',null])await assert.rejects(f.tool('delegate',{agentId:f.target.agentId,requestId:'directory-'+String(workspace),message:'Never send',workspace}),{code:'CALLER_RESOURCE_FORBIDDEN'});
  assert.equal(f.state.executions,0);assert.equal(f.network.network.delegations.length,0);
  assert.equal((await f.controller.call('callers.list',{})).items[0].resourcePolicy.workspace,'native-default-only');
});

test('disabling the shared agent identity revokes its caller credentials while allowing user cleanup',async t=>{
  const f=await setup(t),task=await f.tool('delegate',{agentId:f.target.agentId,requestId:'original',message:'Compile'});
  await f.registry.call('agents.disable',{agentId:f.identity.agentId,expectedRevision:1,operationId:'disable-principal-identity'});
  await assert.rejects(f.tool('task_result',{taskId:task.taskId}),{code:'CALLER_REVOKED'});
  await f.admin('revoke',{principalId:f.caller.principalId,expectedRevision:1});
  await f.admin('closeContext',{contextId:f.opened.contextId,expectedRevision:1});
  assert.equal(f.state.tasks[0].status,'running');assert.equal(f.state.executions,1);
});

test('permission removed during a task read blocks replies and suppresses stale results after context closure',async t=>{
  const f=await setup(t),task=await f.tool('delegate',{agentId:f.target.agentId,requestId:'original',message:'Compile'});
  f.state.onTaskRead=()=>f.admin('configure',{principalId:f.caller.principalId,expectedRevision:1,operations:['result']});
  await assert.rejects(f.tool('reply_task',{taskId:task.taskId,operationId:'reply',requestId:'pending',action:'permission',decision:'reject'}),{code:'CALLER_OPERATION_FORBIDDEN'});
  f.state.onTaskRead=()=>f.admin('closeContext',{contextId:f.opened.contextId,expectedRevision:1});
  await assert.rejects(f.tool('task_result',{taskId:task.taskId}),{code:'CALLER_REVOKED'});
  assert.equal(f.state.tasks[0].status,'running');assert.equal(f.state.executions,1);
});

test('different principals share a node without sharing sessions, task results or authority',async t=>{
  const f=await setup(t),secondIdentity=await f.registry.call('agents.register',{kind:'mcp',externalKey:'second-super-agent',name:'Second',purpose:'Independent peer',operationId:'register-second-peer'});
  const second=await f.admin('create',{agentId:secondIdentity.agentId,allowedAgentIds:[f.target.agentId]});
  const context=await f.admin('openContext',{principalId:second.principalId});
  const first=await f.tool('delegate',{agentId:f.target.agentId,requestId:'same-request',message:'Compile'});
  await assert.rejects(f.tool('delegate',{agentId:f.target.agentId,requestId:'busy',message:'Compile'},context),{code:'AGENT_BUSY'});
  await assert.rejects(f.tool('task_result',{taskId:first.taskId},context),{code:'COLLABORATION_FORBIDDEN'});
  f.finish(first);
  const next=await f.tool('delegate',{agentId:f.target.agentId,requestId:'same-request',message:'Compile'},context);
  assert.notEqual(next.conversationId,first.conversationId);assert.equal(f.state.executions,2);
});

test('a real MCP stdio caller recovers a lost submission receipt, reads the original result and survives explicit credential rotation',async t=>{
  const f=await setup(t),config=f.opened.configuration;
  const child=spawn(config.command,config.args,{windowsHide:true,env:{...process.env,...config.env},stdio:['pipe','pipe','pipe']});
  const lines=createInterface({input:child.stdout}),waiting=new Map();let id=0,diagnostic='';
  child.stderr.on('data',data=>{diagnostic+=data;});
  const ended=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
  f.keep({async close(){child.kill();lines.close();await ended;}});
  lines.on('line',line=>{const reply=JSON.parse(line);waiting.get(reply.id)?.(reply);waiting.delete(reply.id);});
  const call=(name,args={})=>new Promise((resolve,reject)=>{
    const current=++id,timer=setTimeout(()=>reject(Error('Caller MCP response timeout')),10000);
    waiting.set(current,reply=>{clearTimeout(timer);if(reply.error)return reject(Error('MCP protocol failed: '+diagnostic));resolve(JSON.parse(reply.result.content[0].text));});
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:current,method:'tools/call',params:{name,arguments:args}})+'\n');
  });
  const view=await call('list_agents');assert.equal(view.caller.kind,'independent-caller');
  f.state.loseNextSubmitResponse=true;
  assert.equal((await call('delegate',{agentId:f.target.agentId,requestId:'stdio-original',message:'Compile'})).error.code,'DESKTOP_TRANSPORT');
  const original=(await call('list_delegations')).items[0];assert.equal(original.taskId,undefined);
  const task=await call('task_result',{delegationId:original.delegationId});assert.equal(task.status,'running');
  f.state.tasks[0].lastSeq=1;f.state.tasks[0].events=[{seq:1,timestamp:new Date().toISOString(),event:{kind:'output',text:'Controlled progress'}}];
  const progress=await call('task_result',{taskId:task.taskId,afterSeq:0});
  assert.equal(progress.events.cursor,1);assert.equal(progress.events.items[0].event.text,'Controlled progress');assert.equal(progress.outcome.terminal,false);
  f.finish(task);assert.equal((await call('task_result',{taskId:task.taskId})).status,'succeeded');
  await f.admin('rotateCredential',{contextId:f.opened.contextId,expectedRevision:1});
  assert.equal((await call('task_result',{taskId:task.taskId})).status,'succeeded');
  await f.admin('closeContext',{contextId:f.opened.contextId,expectedRevision:2});
  assert.equal((await call('task_result',{taskId:task.taskId})).error.code,'CALLER_REVOKED');
  assert.equal(f.state.executions,1);
});

test('parallel machine snapshots share one scope restoration and do not publish premature readiness',async()=>{
  let enter,release,restores=0,snapshots=0;
  const entered=new Promise(resolve=>enter=resolve),resume=new Promise(resolve=>release=resolve);
  const host=Object.create(MachineHost.prototype);
  host.options={};host.rows=[];host.contexts=new Map();host.broker={scopes:[{contextId:'original',scope:{nodeId:'original-node',parentRequestId:'original-parent'}}],close(){}};
  host.legacy={call(){snapshots++;return {agents:{items:[]},tasks:[],conversations:[]};}};
  const original=host.call.bind(host);host.call=async(method,p)=>{if(method==='scope'){restores++;enter();await resume;return {configured:true};}return original(method,p);};
  const first=host.call('snapshot',{});await entered;
  const second=host.call('snapshot',{});await Promise.resolve();
  assert.equal(restores,1);assert.equal(snapshots,0);assert.notEqual(host.restored,true);
  release();await Promise.all([first,second]);assert.equal(host.restored,true);assert.equal(snapshots,2);
});

test('a closed broker cannot recreate an endpoint or accept a late configuration',{timeout:10000},async t=>{
  const f=await fixture(t),broker=new CollaborationBroker(f.directory,()=>({}));
  f.keep(broker);broker.close();
  await assert.rejects(broker.configure('original',{nodeId:'node',parentRequestId:'request'}),{code:'COLLABORATION_CLOSED'});
  const pendingBroker=new CollaborationBroker(f.directory,()=>({}));f.keep(pendingBroker);
  const pending=pendingBroker.configure('late-original',{nodeId:'node',parentRequestId:'request'});
  pendingBroker.close();
  await assert.rejects(pending,{code:'COLLABORATION_CLOSED'});
});

test('real authenticated coordinator manages a caller-only identity and old peers reject only new methods',async t=>{
  const f=await fixture(t),target=await f.register(),identity=await f.admin('register',{kind:'mcp',externalKey:'coordinator-caller',name:'Caller',purpose:'Independent caller'});
  const service=createCoordinatorService({directory:f.directory,platform:'linux',network:f.network});
  f.keep(await startCoordinator({directory:f.directory,version:'controlled',service}));
  const client=f.keep(new CoordinatorClient({directory:f.directory}));
  const principal=await client.request('call',{method:'callers.create',params:{operationId:'create',agentId:identity.agentId,allowedAgentIds:[target.agentId]}});
  assert.equal(principal.ok,true);
  const opened=await client.request('call',{method:'callers.openContext',params:{operationId:'open',principalId:principal.result.principalId}});
  assert.equal(opened.ok,true);assert.equal(f.network.network.nodes.length,3);assert.equal(f.state.executions,0);
  const old=new CoordinatorClient({directory:f.directory});old.open=async()=>{};old.info={capabilities:[]};
  await assert.rejects(old.request('call',{method:'callers.create',params:{}}),{code:'CALLER_BACKEND_UPGRADE_REQUIRED'});
});

test('lost submission receipts recover through read-only original delegation after target and delegate grants are revoked',async t=>{
  const f=await setup(t);f.state.loseNextSubmitResponse=true;
  await assert.rejects(f.tool('delegate',{agentId:f.target.agentId,requestId:'lost-receipt',message:'Original intent'}),{code:'DESKTOP_TRANSPORT'});
  const row=(await f.tool('list_delegations')).items[0];assert.equal(row.taskId,undefined);assert.equal(row.ledgerState,'unknown');
  await f.admin('configure',{principalId:f.caller.principalId,expectedRevision:1,allowedAgentIds:[],operations:['result']});
  await f.admin('configure',{principalId:f.caller.principalId,expectedRevision:2,operations:['result']});
  await f.registry.call('agents.disable',{operationId:'disable-original-target',agentId:f.target.agentId,expectedRevision:f.target.revision});
  const result=await f.tool('task_result',{delegationId:row.delegationId,afterSeq:0});
  assert.equal(result.status,'running');assert.equal(result.invocation.delegationId,row.delegationId);assert.equal(result.invocation.requestId,row.requestId);
  assert.equal(result.invocation.caller.contextId,f.opened.contextId);assert.ok(result.taskId);assert.equal(f.state.executions,1);
  f.finish(result);assert.equal((await f.tool('task_result',{delegationId:row.delegationId})).status,'succeeded');
  assert.equal((await f.tool('task_result',{taskId:result.taskId})).status,'succeeded');
  await assert.rejects(f.tool('task_result',{delegationId:row.delegationId,taskId:'another-task'}),{code:'RECEIPT_MISMATCH'});
  assert.equal(f.state.executions,1);
});

test('an original delegation query never treats missing native records as permission to resubmit',async t=>{
  const f=await setup(t);f.state.loseNextSubmitResponse=true;
  await assert.rejects(f.tool('delegate',{agentId:f.target.agentId,requestId:'unresolved',message:'One original execution'}),{code:'DESKTOP_TRANSPORT'});
  const row=(await f.tool('list_delegations')).items[0];f.state.tasks.length=0;
  for(let i=0;i<2;i++){
    const result=await f.tool('task_result',{delegationId:row.delegationId,afterSeq:0});
    assert.equal(result.status,'unknown');assert.equal(result.taskId,undefined);assert.equal(result.outcome.terminal,false);
    assert.equal(result.recovery.state,'request-not-found');assert.equal(result.recovery.resubmissionAllowed,false);assert.equal(result.events.cursor,0);
  }
  assert.equal(f.state.executions,1);assert.equal(f.network.network.delegations[0].state,'unknown');assert.equal(f.network.network.requests.at(-1).dispatched,true);
  await assert.rejects(f.tool('delegate',{agentId:f.target.agentId,requestId:'not-found-alias',message:'Must remain blocked'}),{code:'AGENT_BUSY'});
  for(const args of [{},{taskId:''},{delegationId:''},{delegationId:row.delegationId,afterSeq:-1}])await assert.rejects(f.tool('task_result',args));
  assert.equal(f.state.executions,1);
});

test('original-request recovery enforces context ownership and rechecks revocation after the native read',async t=>{
  const f=await setup(t);f.state.loseNextSubmitResponse=true;
  await assert.rejects(f.tool('delegate',{agentId:f.target.agentId,requestId:'owned-recovery',message:'Original'}),{code:'DESKTOP_TRANSPORT'});
  const row=(await f.tool('list_delegations')).items[0],other=await f.admin('openContext',{principalId:f.caller.principalId});
  await assert.rejects(f.tool('task_result',{delegationId:row.delegationId},other),{code:'COLLABORATION_FORBIDDEN'});
  f.state.onRequestRead=()=>f.admin('closeContext',{contextId:f.opened.contextId,expectedRevision:1});
  await assert.rejects(f.tool('task_result',{delegationId:row.delegationId}),{code:'CALLER_REVOKED'});
  assert.equal(f.network.network.delegations[0].taskId,undefined);assert.equal(f.state.executions,1);
});

test('a proven preparation rejection is reported without inventing a Task or querying a new native request',async t=>{
  const f=await setup(t);
  f.state.onContext=()=>f.admin('configure',{principalId:f.caller.principalId,expectedRevision:1,allowedAgentIds:[]});
  await assert.rejects(f.tool('delegate',{agentId:f.target.agentId,requestId:'before-native',message:'Never submit'}),{code:'COLLABORATION_FORBIDDEN'});
  const row=(await f.tool('list_delegations')).items[0];let reads=0;f.state.onRequestRead=()=>{reads++;};
  const result=await f.tool('task_result',{delegationId:row.delegationId});
  assert.equal(result.status,'rejected');assert.equal(result.taskId,undefined);assert.equal(result.outcome.terminal,false);
  assert.equal(result.outcome.errorPhase,'before_execution');assert.equal(result.recovery.state,'not-dispatched');assert.equal(result.recovery.resubmissionAllowed,false);
  assert.equal(reads,0);assert.equal(f.state.executions,0);
});

test('a mismatched original native receipt cannot attach a different request to the delegation',async t=>{
  for(const field of ['requestId','targetAgent','conversationId']){
  const f=await setup(t);f.state.loseNextSubmitResponse=true;
  await assert.rejects(f.tool('delegate',{agentId:f.target.agentId,requestId:'bound-recovery',message:'Original'}),{code:'DESKTOP_TRANSPORT'});
  const row=(await f.tool('list_delegations')).items[0];
  if(field==='conversationId')f.network.network.requests.at(-1).conversationId=f.child.machineId+'::'+f.state.tasks[0].conversationId;
  f.state.onRequestRead=()=>{f.state.tasks[0][field]='different-original-object';};
  await assert.rejects(f.tool('task_result',{delegationId:row.delegationId}),{code:'RECEIPT_MISMATCH'});
  assert.equal(f.network.network.delegations[0].taskId,undefined);assert.equal(f.state.executions,1);
  }
});
