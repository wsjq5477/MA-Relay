// A live bridge for the actual Windows Codex desktop chat acting as an external
// MCP caller. No parent Task/LLM is fabricated or launched by this fixture.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {AgentNetwork}=require('../electron/agent-network.cjs'),{MachineHost}=require('../electron/machine-host.cjs');
const {ClaudeHost}=require('../electron/claude-host.cjs'),{HostConnection,distributions}=require('../electron/rpc.cjs');
const {createCoordinatorService}=require('../electron/coordinator-service.cjs'),{startCoordinator}=require('../electron/coordinator.cjs');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
const {ensurePrivateDirectory}=require('../electron/private-directory.cjs');
const {windowsNativeEnvironment}=require('./interconnect-windows-profile.cjs');
const {verifyPreviousAttempts}=require('./interconnect-native-case-guard.cjs');
async function run(){
 assert.equal(process.platform,'win32');assert.equal(process.env.AGENTBRIDGE_REAL_NATIVE,'1');
 const base=process.env.AGENTBRIDGE_NATIVE_BASE,root=process.env.AGENTBRIDGE_CURRENT_CHAT_ROOT,reportFile=process.env.AGENTBRIDGE_LIVE_REPORT;
 assert.ok(base&&root&&reportFile&&path.isAbsolute(root)&&!/^c:/i.test(root));
 verifyPreviousAttempts(base,'2');
 ensurePrivateDirectory(root);assert.ok(!/^c:/i.test(fs.realpathSync(root)));
 const m=JSON.parse(fs.readFileSync(path.join(base,'native-profile-manifest.json')));Object.assign(process.env,windowsNativeEnvironment(m));
 const distribution='Ubuntu-22.04',linuxRoot='/tmp/ab-interconnect-win-wsl-20261103',directory=path.join(root,'coordinator');
 const existing=new CoordinatorClient({directory});
 try{await existing.attach();throw Object.assign(Error(),{code:'CURRENT_CHAT_BRIDGE_ALREADY_RUNNING'});}
 catch(error){if(!['ENOENT','ECONNREFUSED'].includes(error.code))throw error;}finally{existing.close();}
 assert.ok((await distributions()).includes(distribution));
 const empty=Object.fromEntries(['claude','codex','opencode','hermes','pi','dsh','opendesk'].map(id=>[id,[]]));
 const network=new AgentNetwork({directory,platform:'win32',distributions:async()=>[distribution],createHost:machine=>machine.kind==='windows'
  ?new MachineHost({directory:path.join(root,'local-machine'),home:m.home,candidates:empty,legacy:new ClaudeHost({directory:path.join(root,'local-legacy'),home:m.home,candidates:[]})})
  :new HostConnection(path.resolve(__dirname,'../../dist/desktop-host.js'),{distribution,directory:linuxRoot,bootstrapPath:path.resolve(__dirname,'interconnect-wsl-native-bootstrap.sh')})});
 const traceFile=path.join(root,'confirmed-calls.json'),trace=fs.existsSync(traceFile)?JSON.parse(fs.readFileSync(traceFile)):[];
 const write=(file,value)=>{const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(tmp,file);};
 const scoped=network.scopedCollaborationTool.bind(network);network.scopedCollaborationTool=async(...args)=>{const result=await scoped(...args);trace.push({name:args[3],completed:true,date:new Date().toISOString()});write(traceFile,trace);return result;};
 const service=createCoordinatorService({directory,network}),server=await startCoordinator({directory,service,version:'current-windows-chat-source'}),client=new CoordinatorClient({directory});
 const call=async(method,params={})=>{const r=await client.request('call',{method,params});if(!r.ok)throw Object.assign(Error(),{code:r.error.code});return r.result;};
 const original=async(method,p)=>{const r=await call(method.startsWith('agents.')?'agents.operation':'callers.operation',{operationId:p.operationId});return r.state==='not_found'?call(method,p):r.data;};
 let snapshot,node;const deadline=Date.now()+180000;do{snapshot=await call('snapshot');node=snapshot.nodes.find(n=>n.adapter==='codex'&&snapshot.machines.find(x=>x.machineId===n.machineId)?.distribution===distribution);if(node?.healthy)break;await new Promise(r=>setTimeout(r,1000));}while(Date.now()<deadline);
 assert.ok(node?.healthy);if(!node.connected)await call('manageNode',{nodeId:node.nodeId,action:'attach',operationId:'current-chat-attach-wsl'});
 const target=await original('agents.register',{operationId:'current-chat-register-target',kind:'native',nodeId:node.nodeId,name:'BuildAgent',purpose:'The user-selected real WSL Codex child.'});
 const identity=await original('agents.register',{operationId:'current-chat-register-main',kind:'mcp',externalKey:'current-windows-codex-desktop-chat',name:'Current Windows Codex chat',purpose:'The actual native desktop chat chooses MCP tools and consumes WSL native results.'});
 const caller=await original('callers.create',{operationId:'current-chat-create-caller',agentId:identity.agentId,allowedAgentIds:[target.agentId],operations:['delegate','result','pending','reply','cancel']});
 const rotation=await call('callers.operation',{operationId:'current-chat-rotate-context'});
 if(!['confirmed','not_found'].includes(rotation.state))throw Object.assign(Error(),{code:'ORIGINAL_ROTATION_UNCONFIRMED'});
 const opened=rotation.state==='confirmed'?rotation.data:await original('callers.openContext',{operationId:'current-chat-open-context',principalId:caller.principalId});
 assert.ok(opened.configuration);assert.equal(opened.principalId,caller.principalId);
 const peer={version:1,configuration:opened.configuration,contextId:opened.contextId,principalId:caller.principalId,targetAgentId:target.agentId,targetNodeId:node.nodeId,targetMachineId:node.machineId};write(path.join(root,'peer.json'),peer);
 const report={date:new Date().toISOString(),ready:true,main:'current Windows Codex desktop chat',mainUsesStandaloneCli:false,target:'WSL Codex',wslVersion:node.version,callerIsNotExecutionNode:!network.network.nodes.some(n=>n.nodeId===caller.principalId),nativeParentTasksCreated:0,delegations:network.network.delegations.length,allNewBridgeStateNonC:true};write(reportFile,report);console.log(JSON.stringify(report));
 const interval=setInterval(()=>{void(async()=>{
  const f=path.join(root,'close-observer.json');if(!fs.existsSync(f))return;
  const command=JSON.parse(fs.readFileSync(f));if(command.action!=='close-observer'||typeof command.operationId!=='string')return;
  let runningObserved=false;
  for(const d of network.network.delegations){if(!d.taskId)throw Error('ORIGINAL_REQUEST_UNRESOLVED');const task=await call('ipc',{op:'task',machineId:node.machineId,taskId:d.taskId});if(!['succeeded','failed','cancelled'].includes(task.status)){
   if(process.env.AGENTBRIDGE_ALLOW_LIVE_OBSERVER_TEST!=='1'||command.expectedTaskId!==d.taskId||command.expectedContextId!==d.callerContextId||task.status!=='running'||!task.native?.sessionId)throw Error('ORIGINAL_TASK_UNRESOLVED');
   runningObserved=true;
  }}
  if(command.expectedTaskId&&!runningObserved)throw Error('EXPECTED_LIVE_TASK_NO_LONGER_RUNNING');
  clearInterval(interval);write(path.join(root,'observer-close-receipt.json'),{operationId:command.operationId,state:'confirmed',observerOnly:true,nativeCancellationRequested:false,runningOriginalObserved:runningObserved});fs.unlinkSync(f);client.close();await server.close();network.close();
 })().catch(error=>console.log(JSON.stringify({observationControlError:error.code||error.message})));},1000);
}
run().catch(error=>{console.log(JSON.stringify({error:error.code||'CURRENT_CHAT_BRIDGE_SETUP_FAILED'}));process.exitCode=1;});
