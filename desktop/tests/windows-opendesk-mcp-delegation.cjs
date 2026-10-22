// Installed OpenDesk MCP component -> production graph/broker -> one real Claude task.
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads'),{pathToFileURL}=require('node:url'),{randomUUID,createHash}=require('node:crypto');
const [bridge,archive,output]=process.argv.slice(2);
if(process.platform!=='win32'||!output)throw Error('Windows packaged bridge, native archive, report required');
const {MachineHost}=require(path.join(bridge,'desktop/electron/machine-host.cjs'));
const {ClaudeHost}=require(path.join(bridge,'desktop/electron/claude-host.cjs'));
const {AgentNetwork}=require(path.join(bridge,'desktop/electron/agent-network.cjs'));
const {createCoordinatorService}=require(path.join(bridge,'desktop/electron/coordinator-service.cjs'));
const planFile=path.join(os.tmpdir(),'agentbridge-native-opendesk-delegation-20261022.private-plan.json');
const existed=fs.existsSync(planFile),cp=existed?JSON.parse(fs.readFileSync(planFile)):{directory:fs.mkdtempSync(path.join(os.tmpdir(),'ab-od-delegation-')),phase:'new',requestId:randomUUID()};
const save=()=>fs.writeFileSync(planFile,JSON.stringify(cp,null,2),{mode:0o600});save();
const report={date:new Date().toISOString(),version:'0.6.0-alpha.46',nativeVersion:'0.3.9',environment:'installed OpenDesk MCP component / production Coordinator, AgentNetwork, MachineHost, broker / real Windows Claude child',nativeParentModel:false,modelTasksStarted:0,status:'running',checks:[]};
const record=()=>{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');};
const nativeHome=path.join(cp.directory,'native');
let host,worker,service,terminal=false;const pending=new Map();let seq=0;
const network=new AgentNetwork({directory:cp.directory,platform:'win32',distributions:async()=>[],createHost:()=>{
  host=new MachineHost({directory:path.join(cp.directory,'machine'),home:os.homedir(),environment:process.env,
    candidates:{codex:[],opencode:[],hermes:[],pi:[],dsh:[]},legacy:new ClaudeHost({directory:path.join(cp.directory,'legacy'),home:os.homedir(),environment:process.env})});
  // Only MCP native configuration uses the disposable profile; discovery and the
  // real child's account/model keep their normal production configuration.
  host.mcp.options={...host.options,environment:{...process.env,OPENDESK_CONFIG_DIRECTORY:nativeHome}};
  return host;
}});
service=createCoordinatorService({directory:cp.directory,network,version:report.version});
const call=async(method,params={})=>{const r=await service.call({method,params});if(!r.ok)throw Object.assign(Error(r.error.code),{code:r.error.code});return r.result;};
async function rpc(method,args=[]){return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('Native component timeout'));},60000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});worker.postMessage({id,method,args});});}
(async()=>{
  if(existed&&cp.phase==='complete'){const task=await call('ipc',{op:'request',machineId:cp.child.machineId,requestId:cp.derivedRequestId});assert.equal(task.taskId,cp.taskId);assert.equal(task.requestId,cp.derivedRequestId);assert(task.native?.sessionId);report.nativeSessionBound=true;assert.equal(task.status,'succeeded');assert.match(task.result.message,/AB_MCP_OD_NATIVE_221/);assert.equal(network.network.requests.length,1);terminal=true;report.childStatus=task.status;report.status='passed';report.checks.push('Fresh observer reopens the original native task and result, retains exactly one request and starts zero new tasks');return;}
  const snapshot=await call('snapshot');
  if(!cp.leader){assert(!existed);cp.leader=snapshot.nodes.find(n=>n.adapter==='opendesk-desktop'&&n.healthy&&!n.supersededBy);cp.child=snapshot.nodes.find(n=>n.adapter==='claude'&&n.healthy&&!n.supersededBy);assert(cp.leader&&cp.child,'live OpenDesk Desktop and Claude required');save();}
  for(const [name,node]of [['leader',cp.leader],['child',cp.child]]){
    if(cp[name+'Attach']){const r=await call('nodeOperation',{nodeId:node.nodeId,operationId:cp[name+'Attach']});assert.equal(r.state,'confirmed');}
    else{assert(!existed);cp[name+'Attach']=randomUUID();save();assert.equal((await call('manageNode',{nodeId:node.nodeId,operationId:cp[name+'Attach'],action:'attach'})).state,'confirmed');}
  }
  if(!cp.relationOperation){assert(!existed);cp.relationOperation=randomUUID();save();await call('saveCollaboration',{operationId:cp.relationOperation,leaderId:cp.leader.nodeId,memberIds:[cp.child.nodeId],expectedRevision:snapshot.collaboration.revision});}
  else assert.equal((await call('collaborationOperation',{operationId:cp.relationOperation})).state,'confirmed');
  const params={nodeId:cp.leader.nodeId};
  if(!cp.connectionId){assert(!existed);const installed=await call('mcp.install',params);cp.connectionId=installed.connectionId;cp.configPath=installed.configPath;save();}
  const entry=JSON.parse(fs.readFileSync(cp.configPath)).applications.mcpmgr.servers[0];
  const chunk=path.join(archive,'dist/main/chunks/index-Vy3xA3BA.js');
  worker=new Worker(`const{parentPort,workerData}=require('node:worker_threads');(async()=>{
    const api=await import(workerData.module),platform=new api.W();api.ah(platform);
    const App=platform.getApplicationClasses().find(C=>new C().bundleName==='mcpmgr'),Client=App.getWorkerClass(),client=new Client('mcpmgr',workerData.home);await client.initialize();
    parentPort.on('message',async m=>{try{parentPort.postMessage({id:m.id,value:await client.handleMessage(m.method,...m.args)});}catch(e){parentPort.postMessage({id:m.id,error:e.message});}});parentPort.postMessage({ready:true});})().catch(e=>parentPort.postMessage({fatal:e.message}));`,
    {eval:true,env:{...process.env,OPENDESK_CONFIG_DIRECTORY:nativeHome},workerData:{module:pathToFileURL(chunk).href,home:nativeHome,paths:{opendeskDirectory:nativeHome},setting:{applications:{}}},stdout:true,stderr:true});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Native worker boot timeout')),30000);worker.on('error',reject);worker.on('message',m=>{if(m.ready){clearTimeout(timer);resolve();}if(m.fatal){clearTimeout(timer);reject(Error(m.fatal));}const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.value);}});worker.stdout.resume();worker.stderr.resume();});
  await rpc('applicationConfigChanged',[{servers:[entry]}]);
  for(let i=0;i<80;i++){if((await rpc('getDiscoveredTools')).length===7)break;await new Promise(r=>setTimeout(r,250));}
  const tool=async(name,args={})=>JSON.parse(await rpc('callMcpTool',['agentbridge',name,args]));
  const listed=await tool('list_agents');assert.equal(listed.caller.role,'leader');assert.equal(listed.caller.delegationAuthorized,true);assert.deepEqual(listed.items.map(n=>n.nodeId),[cp.child.nodeId]);
  report.versions={opendesk:'0.3.9',child:cp.child.version};report.checks.push('Installed OpenDesk MCP client is admitted as an independent leader and sees only the authorized real Windows Claude child');
  const denied=await tool('delegate',{nodeId:cp.leader.nodeId,requestId:'forbidden-probe',message:'must not execute'});assert.equal(denied.error.code,'COLLABORATION_FORBIDDEN');assert.equal(network.network.requests.length,existed?1:0);
  if(cp.phase==='new'){
    cp.phase='prepared';cp.derivedRequestId='delegation-'+createHash('sha256').update(cp.leader.nodeId+':mcp:'+cp.connectionId+':'+cp.requestId).digest('hex').slice(0,40);save();report.modelTasksStarted=1;record();
    const task=await tool('delegate',{nodeId:cp.child.nodeId,requestId:cp.requestId,message:'这是AgentBridge原生MCP验收。不要使用任何工具，不读取或修改文件，不调用其他Agent。计算13乘17，只回复：AB_MCP_OD_NATIVE_221',workspace:cp.directory});
    if(task.error)throw Object.assign(Error(task.error.code),{code:task.error.code});cp.taskId=task.taskId;cp.phase='dispatched';save();
  }else if(!cp.taskId){const task=await call('ipc',{op:'request',machineId:cp.child.machineId,requestId:cp.derivedRequestId});assert.equal(task.requestId,cp.derivedRequestId);cp.taskId=task.taskId;save();}
  let task;const until=Date.now()+240000;
  do{task=await tool('task_result',{taskId:cp.taskId,waitMs:1000});if(['succeeded','failed','cancelled'].includes(task.status))break;if(task.status==='unknown'||task.waiting)throw Object.assign(Error('Original pending'),{code:'ORIGINAL_PENDING'});}while(Date.now()<until);
  report.childStatus=task.status;terminal=['succeeded','failed','cancelled'].includes(task.status);record();if(!terminal)throw Object.assign(Error('Original pending'),{code:'ORIGINAL_PENDING'});
  assert.equal(task.status,'succeeded');assert.match(task.result.message,/AB_MCP_OD_NATIVE_221/);
  const d=network.network.delegations.find(d=>d.taskId===cp.taskId);assert.equal(d.externalConnectionId,cp.connectionId);assert.equal(d.parentTaskId,null);assert.equal(d.parentConversationId,'mcp:'+cp.connectionId);assert.equal(network.network.requests.length,1);
  report.checks.push('One real Windows Claude task succeeded; installed OpenDesk client reads its original result with durable external-connection ownership');
  await call('saveCollaboration',{operationId:randomUUID(),leaderId:cp.leader.nodeId,memberIds:[],expectedRevision:network.network.collaboration.revision});
  assert.equal((await tool('list_agents')).items.length,0);assert.equal((await tool('delegate',{nodeId:cp.child.nodeId,requestId:'revoked-probe',message:'must not execute'})).error.code,'COLLABORATION_FORBIDDEN');assert.equal(network.network.requests.length,1);
  assert.equal((await tool('task_result',{taskId:cp.taskId,waitMs:0})).status,'succeeded');
  report.checks.push('Revoked grant blocks new delegation and preserves exactly one original task and its readable result');
  cp.phase='complete';save();report.status='passed';await rpc('finalize');
})().catch(error=>{report.status=terminal?'failed':cp.phase==='new'?'failed':'pending';report.error={code:error.code||'ASSERTION',message:error.message};process.exitCode=report.status==='failed'?1:0;}).finally(async()=>{
  record();console.log(JSON.stringify(report));if(terminal||cp.phase==='new'){if(worker)await worker.terminate();service.close();}else{console.log('Original context retained; no replay or cancellation.');setInterval(()=>{},60000);}
});
