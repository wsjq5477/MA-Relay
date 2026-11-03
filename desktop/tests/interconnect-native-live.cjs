// Opt-in acceptance: installed native Codex -> scoped MCP -> installed native target.
// Linux HOME/config/account are inherited. No credentials or native output enter
// the public report. Keep the original root/checkpoint on every retry.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {randomBytes}=require('node:crypto');
const assert=require('node:assert/strict');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {MachineHost}=require('../electron/machine-host.cjs');
const {ClaudeHost}=require('../electron/claude-host.cjs');
const {CodexHost}=require('../electron/codex-host.cjs');
const {HostConnection}=require('../electron/rpc.cjs');
const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
const {startCoordinator}=require('../electron/coordinator.cjs');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
const terminal=value=>['succeeded','failed','cancelled'].includes(value);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run(){
 assert.equal(process.platform,'linux');assert.equal(process.env.AGENTBRIDGE_REAL_NATIVE,'1');
 const root=process.env.AGENTBRIDGE_LIVE_ROOT,reportFile=process.env.AGENTBRIDGE_LIVE_REPORT;
 assert.ok(root&&path.isAbsolute(root)&&reportFile&&path.isAbsolute(reportFile));
 const nonC=file=>assert.ok(!/^\/mnt\/c(?:\/|$)/i.test(fs.realpathSync(file)),'C drive forbidden');
 for(const file of [os.homedir(),process.execPath,process.env.TMPDIR])nonC(file);
 fs.mkdirSync(root,{recursive:true,mode:0o700});nonC(root);
 const checkpoint=path.join(root,'checkpoint.json'),write=(file,value)=>{const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(tmp,file);};
 let state=fs.existsSync(checkpoint)?JSON.parse(fs.readFileSync(checkpoint)): {version:1,rounds:[],challenge:randomBytes(12).toString('hex')};
 const save=()=>write(checkpoint,state),report={date:new Date().toISOString(),environment:'WSL Ubuntu-22.04, physical non-C storage',nativeModelObserved:false,rounds:[],checks:{},ok:false};
 const publish=()=>{fs.mkdirSync(path.dirname(reportFile),{recursive:true});write(reportFile,report);};
 const codex=path.join(os.homedir(),'.nvm/versions/node/v24.13.0/bin/codex'),opencode=path.join(os.homedir(),'.opencode/bin/opencode');
 for(const file of [codex,opencode,path.join(os.homedir(),'.codex/auth.json'),path.join(os.homedir(),'.codex/config.toml'),path.join(os.homedir(),'.local/share/opencode/auth.json')])nonC(file);
 const adapter=process.env.AGENTBRIDGE_LIVE_TARGET||'opencode';assert.ok(['codex','opencode'].includes(adapter));
 if(state.targetAdapter&&state.targetAdapter!==adapter){assert.equal(state.rounds.length,0,'Never change an original native intent');const oldFile=path.join(root,'coordinator','agent-network.json');if(fs.existsSync(oldFile)){const old=JSON.parse(fs.readFileSync(oldFile));assert.equal(old.requests.length,0);assert.equal(old.delegations.length,0);}}
 state.targetAdapter=adapter;save();report.targetAdapter=adapter;
 const directory=path.join(root,'coordinator'),machineDirectory=path.join(root,'machine');
 const candidates=Object.fromEntries(['claude','codex','opencode','hermes','pi','dsh','opendesk'].map(id=>[id,id===adapter?[adapter==='codex'?codex:opencode]:[]]));
 let network,service,server,client,parent,keep=false;
 const open=async()=>{
  network=new AgentNetwork({directory,platform:'linux',distributions:async()=>[],createHost:()=>new MachineHost({directory:machineDirectory,candidates,home:os.homedir(),legacy:new ClaudeHost({directory:path.join(root,'legacy'),home:os.homedir(),candidates:[]}),openCode:dir=>new HostConnection(path.resolve(__dirname,'../../dist/desktop-host.js'),{directory:dir,native:true,leaf:true,runtime:process.execPath})})});
  service=createCoordinatorService({directory,network});server=await startCoordinator({directory,service,version:'interconnect-source-live'});
  client=new CoordinatorClient({directory,entry:path.resolve(__dirname,'../electron/coordinator.cjs'),runtime:process.execPath,version:'interconnect-source-live'});
  parent=new CodexHost({directory:path.join(root,'parent'),executable:codex});
 };
 const close=async()=>{parent?.close();client?.close();await server?.close();network?.close();};
 const call=async(method,params={})=>{const response=await client.request('call',{method,params});if(!response.ok)throw Object.assign(Error('Original coordinator call failed'),{code:response.error.code});return response.result;};
 const original=async(method,params)=>{
  const old=await call(method.startsWith('agents.')?'agents.operation':'callers.operation',{operationId:params.operationId});
  return old.state==='not_found'?call(method,params):old.data;
 };
 try{
  await open();save();publish();
  let snapshot=await call('snapshot'),node=snapshot.nodes.find(n=>n.adapter===adapter);assert.ok(node?.healthy);
  await call('attachNode',{nodeId:node.nodeId});
  const target=await original('agents.register',{operationId:'live-register-target',kind:'native',nodeId:node.nodeId,name:'BuildAgent',purpose:'Read a test challenge using the original native workspace.'});
  const identity=await original('agents.register',{operationId:'live-register-caller',kind:'mcp',externalKey:'live-independent-super-agent',name:'Native Super-agent',purpose:'Use the explicitly granted BuildAgent through scoped MCP.'});
  const caller=await original('callers.create',{operationId:'live-create-caller',agentId:identity.agentId,allowedAgentIds:[target.agentId],operations:['delegate','result','pending','reply','cancel']});
  report.checks.callerIsNotExecutableNode=!network.network.nodes.some(item=>item.nodeId===caller.principalId);
  let opened=await original('callers.openContext',{operationId:'live-open-context',principalId:caller.principalId});
  state.contextId=opened.contextId;save();
  const native=network.host(network.machine(node.machineId));
  const context=await native.call('context',{nodeId:node.nodeId,adapter:node.adapter,executable:node.executable});nonC(context.workspace);
  const challengeFile=path.join(context.workspace,'interconnect-challenge.txt');
  if(!fs.existsSync(challengeFile))fs.writeFileSync(challengeFile,state.challenge+'\n',{mode:0o600});
  assert.equal(fs.readFileSync(challengeFile,'utf8').trim(),state.challenge);
  const parentWorkspace=path.join(root,'parent-workspace');fs.mkdirSync(parentWorkspace,{recursive:true});
  let parentAgent=await parent.call('connect',{workspace:parentWorkspace});
  for(let round=0;round<2;round++){
   if(round===1){
    const rotation=await original('callers.rotateCredential',{operationId:'live-rotate-context',contextId:state.contextId,expectedRevision:1});
    assert.equal(rotation.contextId,state.contextId);state.rotatedCredentialId=rotation.credentialId;save();
    await close();await open();
    opened=(await call('callers.operation',{operationId:'live-rotate-context'})).data;
    assert.equal(opened.credentialId,state.rotatedCredentialId);assert.ok(opened.configuration);
    parentAgent=await parent.call('connect',{workspace:parentWorkspace});report.checks.observersReopened=true;
   }
   let record=state.rounds[round];
   if(!record){record={requestId:'native-super-agent-turn-'+(round+1),intent:true};state.rounds.push(record);save();
    const message=round===0
     ? 'This is an actual AgentBridge acceptance. Use only the agentbridge MCP server. Do not use shell, command, file, network or other tools yourself. First list_agents and choose the registered BuildAgent. Delegate with requestId live-child-turn-1. Ask it to read interconnect-challenge.txt from its default native workspace and return exactly its trimmed content. Query task_result on the original task with afterSeq:0 and limit:100, waiting until terminal. On unknown stop without resubmission. After success output exactly the child result. Do not invent the challenge or modify config.'
     : 'Continue the actual Bridge acceptance using only agentbridge MCP. Call list_agents and list_delegations to recover the original BuildAgent conversation. Delegate with requestId live-child-turn-2 and the first original conversationId. Ask BuildAgent to recall the challenge from the preceding turn, without reading files again, and return exactly the challenge followed by _TWO. Poll the original task_result with afterSeq:0 until terminal; unknown means stop, never resubmit. Finally output exactly the child result. Do not use shell or any non-agentbridge tool.';
    const task=await parent.call('ipc',{op:round?'continue':'submit',requestId:record.requestId,agentId:parentAgent.agentId,...(round?{conversationId:state.rounds[0].conversationId}:{}),message,mcp:opened.configuration});
    record.taskId=task.taskId;record.conversationId=task.conversationId;save();
   }
   // A saved intent without receipt is resolved only through the original ID.
   let task=await parent.call('ipc',{op:'request',requestId:record.requestId});
   const deadline=Date.now()+240000;
   while(!terminal(task.status)&&task.status!=='unknown'&&Date.now()<deadline){await pause(1000);task=await parent.call('ipc',{op:'task',taskId:task.taskId});}
   record.taskId=task.taskId;record.conversationId=task.conversationId;record.status=task.status;save();
   const calls=task.events.filter(e=>e.event.kind==='progress'&&/^mcp_tool_call · agentbridge\//.test(e.event.text||'')).map(e=>e.event.text.split('/').at(-1));
   const child=network.network.delegations.find(d=>d.callerContextId===state.contextId&&d.message.includes(round?'_TWO':'interconnect-challenge.txt'));
   const childTask=child?.taskId?await call('ipc',{op:'task',machineId:node.machineId,taskId:child.taskId}):null;
   report.rounds[round]={parentStatus:task.status,parentNativeSession:!!task.native?.sessionId,childStatus:childTask?.status,childNativeSession:!!childTask?.native?.sessionId,methods:[...new Set(calls)],parentOnlyBridgeTools:!task.events.some(e=>e.event.kind==='progress'&&/command_execution|file_change/.test(e.event.text||'')),expectedParentResult:task.result?.message?.trim()===state.challenge+(round?'_TWO':''),expectedChildResult:childTask?.result?.message?.trim()===state.challenge+(round?'_TWO':'')};
   record.parentNative=task.native?.sessionId;record.childNative=childTask?.native?.sessionId;record.childConversationId=child?.conversationId;report.nativeModelObserved=report.rounds.some(r=>r.parentNativeSession||r.childNativeSession);save();publish();
   if(!terminal(task.status)||childTask&&!terminal(childTask.status)){keep=true;throw Object.assign(Error(),{code:'ORIGINAL_NATIVE_UNRESOLVED'});}
   assert.equal(task.status,'succeeded');assert.equal(childTask?.status,'succeeded');assert.equal(report.rounds[round].expectedChildResult,true);assert.equal(report.rounds[round].expectedParentResult,true);assert.ok(calls.includes('list_agents')&&calls.includes('delegate')&&calls.includes('task_result'));
  }
  report.checks.sameParentSession=state.rounds[0].parentNative===state.rounds[1].parentNative;
  report.checks.sameChildSession=state.rounds[0].childNative===state.rounds[1].childNative;
  report.checks.sameChildConversation=state.rounds[0].childConversationId===state.rounds[1].childConversationId;
  report.checks.sameExplicitContext=true;report.ok=Object.values(report.checks).every(Boolean)&&report.rounds.every(r=>r.parentOnlyBridgeTools&&r.parentNativeSession&&r.childNativeSession);assert.equal(report.ok,true);
 }catch(error){report.error={code:/^[A-Z][A-Z0-9_]+$/.test(error.code||'')?error.code:'NATIVE_LIVE_ASSERTION_FAILED'};
  try{const view=await parent?.call('snapshot');keep=keep||!!view?.tasks.some(task=>!terminal(task.status))||network.network.delegations.some(d=>!['succeeded','failed','cancelled','rejected'].includes(d.state));}catch{keep=true;}
 }finally{
  report.finishedAt=new Date().toISOString();report.liveRecoveryRequired=keep;publish();console.log(JSON.stringify(report));
  if(keep){state.livePid=process.pid;save();setInterval(()=>{},60000);}
  else{await close();if(!report.ok)process.exitCode=1;}
 }
}
run().catch(error=>{console.error(/^[A-Z][A-Z0-9_]+$/.test(error.code||'')?error.code:'NATIVE_LIVE_SETUP_FAILED');process.exitCode=1;});
