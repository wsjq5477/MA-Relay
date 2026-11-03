// Actual Windows Codex caller -> authenticated production Coordinator/MCP ->
// production WSL HostConnection/MachineHost -> original Linux Codex account.
// Explicit opt-in; no mocked native responses. All native/test writes are on D/E.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFile}=require('node:child_process'),{promisify}=require('node:util'),{randomBytes}=require('node:crypto');
const execute=promisify(execFile),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const {prepareWindowsProfile,windowsNativeEnvironment}=require('./interconnect-windows-profile.cjs');
const {AgentNetwork}=require('../electron/agent-network.cjs'),{MachineHost}=require('../electron/machine-host.cjs');
const {ClaudeHost}=require('../electron/claude-host.cjs'),{CodexHost}=require('../electron/codex-host.cjs');
const {HostConnection,distributions}=require('../electron/rpc.cjs');
const {createCoordinatorService}=require('../electron/coordinator-service.cjs'),{startCoordinator}=require('../electron/coordinator.cjs');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
const {verifyPreviousAttempts}=require('./interconnect-native-case-guard.cjs');
const terminal=status=>['succeeded','failed','cancelled'].includes(status);
async function run(){
 assert.equal(process.platform,'win32');assert.equal(process.env.AGENTBRIDGE_REAL_NATIVE,'1');
 const root=process.env.AGENTBRIDGE_LIVE_ROOT,reportFile=process.env.AGENTBRIDGE_LIVE_REPORT,distribution=process.env.AGENTBRIDGE_WSL_DISTRIBUTION||'Ubuntu-22.04';
 const attempt=process.env.AGENTBRIDGE_ACCEPTANCE_ATTEMPT||'1';assert.ok(/^[1-9][0-9]{0,2}$/.test(attempt));
 assert.ok(root&&path.isAbsolute(root)&&!/^c:/i.test(root));assert.ok(reportFile&&path.isAbsolute(reportFile)&&!/^c:/i.test(reportFile));
 const prepared=await prepareWindowsProfile({root,executable:process.env.AGENTBRIDGE_WINDOWS_CODEX,sourceProfile:process.env.AGENTBRIDGE_WINDOWS_PROFILE,sourceProfileBasis:process.env.AGENTBRIDGE_WINDOWS_PROFILE_BASIS});
 Object.assign(process.env,windowsNativeEnvironment(prepared));
 const ownerFile=path.join(root,'case-owner.json');
 const birth=async pid=>{if(!Number.isSafeInteger(pid)||pid<1)throw Object.assign(Error(),{code:'NATIVE_OWNER_RECORD_INVALID'});try{return (await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command','try { [Diagnostics.Process]::GetProcessById('+pid+').StartTime.ToUniversalTime().Ticks.ToString() } catch { exit 3 }'],{windowsHide:true,timeout:10000})).stdout.trim();}catch(error){if(error.code===3)return null;throw error;}};
 if(fs.existsSync(ownerFile)){
  const old=JSON.parse(fs.readFileSync(ownerFile)),now=await birth(old.pid);
  if(now&&old.birth===now)throw Object.assign(Error(),{code:'LIVE_CASE_ALREADY_RUNNING_QUERY_ORIGINAL'});
  if(now&&!old.birth){const info=JSON.parse((await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command','Get-CimInstance Win32_Process -Filter "ProcessId = '+old.pid+'" | Select-Object ExecutablePath,CommandLine | ConvertTo-Json -Compress'],{windowsHide:true,timeout:10000})).stdout);if(info?.ExecutablePath?.toLowerCase()===prepared.node.toLowerCase()&&info.CommandLine?.includes('interconnect-windows-wsl-live.cjs'))throw Object.assign(Error(),{code:'LIVE_CASE_ALREADY_RUNNING_QUERY_ORIGINAL'});}
 }
 verifyPreviousAttempts(root,attempt);
 fs.writeFileSync(ownerFile,JSON.stringify({pid:process.pid,birth:await birth(process.pid)}),{mode:0o600});
 const checkpoint=path.join(root,attempt==='1'?'checkpoint.json':'checkpoint-attempt'+attempt+'.json');
 const originalCheckpoint=path.join(root,'checkpoint.json');
 const state=fs.existsSync(checkpoint)?JSON.parse(fs.readFileSync(checkpoint)): {version:1,challenge:fs.existsSync(originalCheckpoint)?JSON.parse(fs.readFileSync(originalCheckpoint)).challenge:randomBytes(12).toString('hex'),rounds:[],calls:[]};
 assert.equal(state.version,1);
 const write=(file,value)=>{const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(tmp,file);};
 const save=()=>write(checkpoint,state),report={date:new Date().toISOString(),topology:'Windows Codex -> WSL Codex',distribution,attempt:Number(attempt),isolatedWindowsProfile:true,sourceProfileBasis:prepared.sourceProfileBasis||'user-native-config',sourceModelConfigUnchanged:true,rounds:[],checks:{},ok:false};
 let network,service,server,client,parent,keep=false;
 const directory=path.join(root,'coordinator'),linuxRoot='/tmp/ab-interconnect-win-wsl-20261103';
 const publish=()=>{fs.mkdirSync(path.dirname(reportFile),{recursive:true});write(reportFile,report);};
 const call=async(method,params={})=>{const reply=await client.request('call',{method,params});if(!reply.ok)throw Object.assign(Error(),{code:reply.error.code});return reply.result;};
 const original=async(method,params)=>{const receipt=await call(method.startsWith('agents.')?'agents.operation':'callers.operation',{operationId:params.operationId});return receipt.state==='not_found'?call(method,params):receipt.data;};
 const open=async()=>{
  const empty=Object.fromEntries(['claude','codex','opencode','hermes','pi','dsh','opendesk'].map(id=>[id,[]]));
  network=new AgentNetwork({directory,platform:'win32',preferences:()=>({distribution,directory:linuxRoot}),distributions:async()=>[distribution],createHost:machine=>machine.kind==='windows'
   ?new MachineHost({directory:path.join(root,'windows-machine'),home:prepared.home,candidates:empty,legacy:new ClaudeHost({directory:path.join(root,'windows-legacy'),home:prepared.home,candidates:[]})})
   :new HostConnection(path.resolve(__dirname,'../../dist/desktop-host.js'),{distribution:machine.distribution,directory:linuxRoot,bootstrapPath:path.resolve(__dirname,'interconnect-wsl-native-bootstrap.sh')})});
  const scoped=network.scopedCollaborationTool.bind(network);
  network.scopedCollaborationTool=async(node,relation,owner,name,args)=>{
   const result=await scoped(node,relation,owner,name,args);
   if(owner.authority?.view().contextId===state.contextId){state.calls.push({round:state.activeRound,name,completed:true});save();}
   return result;
  };
  service=createCoordinatorService({directory,network});server=await startCoordinator({directory,service,version:'interconnect-win-wsl-source'});
  client=new CoordinatorClient({directory});parent=new CodexHost({directory:path.join(root,attempt==='1'?'parent':'parent-attempt'+attempt),executable:prepared.codex});
 };
 const close=async()=>{parent?.close();client?.close();await server?.close();network?.close();};
 try{
  assert.ok((await distributions()).includes(distribution));
  await open();save();publish();
  const version=await execute(prepared.codex,['--version'],{env:process.env,windowsHide:true,timeout:15000});report.windowsCodexVersion=version.stdout.trim();
  let snapshot,node;const readyBy=Date.now()+180000;
  do{
   snapshot=await call('snapshot');node=snapshot.nodes.find(n=>n.adapter==='codex'&&snapshot.machines.find(m=>m.machineId===n.machineId)?.distribution===distribution);
   if(node?.healthy)break;
   report.phase='wsl-startup';report.wslOnline=snapshot.machines.find(m=>m.distribution===distribution)?.online===true;publish();
   await pause(1000);
  }while(Date.now()<readyBy);
  if(!node?.healthy)throw Object.assign(Error(),{code:'WSL_CODEX_DISCOVERY_UNAVAILABLE'});report.wslCodexVersion=node.version;report.wslOnline=snapshot.machines.find(m=>m.distribution===distribution)?.online===true;
  if(!node.connected)await call('manageNode',{nodeId:node.nodeId,action:'attach',operationId:'win-wsl-attach-codex'});
  const target=await original('agents.register',{operationId:'win-wsl-register-target',kind:'native',nodeId:node.nodeId,name:'BuildAgent',purpose:'A real WSL Codex using its existing native account and configuration.'});
  const identity=await original('agents.register',{operationId:'win-wsl-register-caller',kind:'mcp',externalKey:'windows-native-upper-codex',name:'Windows Codex main',purpose:'Explicit delegation to the user-selected WSL Codex.'});
  const caller=await original('callers.create',{operationId:'win-wsl-create-caller',agentId:identity.agentId,allowedAgentIds:[target.agentId],operations:['delegate','result','pending','reply','cancel']});
  const attemptSuffix=attempt==='1'?'':'-attempt'+attempt;
  let opened=await original('callers.openContext',{operationId:'win-wsl-open-context'+attemptSuffix,principalId:caller.principalId});
  if(state.contextId)assert.equal(state.contextId,opened.contextId);state.contextId=opened.contextId;save();
  report.checks.callerNotAnExecutionNode=!network.network.nodes.some(n=>n.nodeId===caller.principalId);
  const machine=network.machine(node.machineId),host=network.host(machine),context=await host.call('context',{nodeId:node.nodeId,adapter:node.adapter,executable:node.executable});
  assert.ok(context.workspace.startsWith(linuxRoot+'/sessions/'));assert.ok(!/^\/mnt\/c\//i.test(context.workspace));
  const challengeFile=context.workspace+'/interconnect-challenge.txt';
  const seed='const fs=require("fs"),path=require("path");const f=process.argv[1],s=process.argv[2];if(!fs.realpathSync(path.dirname(f)).startsWith("/tmp/ab-interconnect-win-wsl-20261103/"))throw Error("BOUNDARY");if(fs.existsSync(f)){if(fs.readFileSync(f,"utf8").trim()!==s)throw Error("ORIGINAL_CHALLENGE_CHANGED");}else fs.writeFileSync(f,s+String.fromCharCode(10),{mode:0o600});';
  // The original installed Node is selected by the unchanged production bootstrap.
  await execute('wsl.exe',['-d',distribution,'--exec','/bin/bash','-c','export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:/usr/bin:/bin"; export TMPDIR=/tmp TEMP=/tmp TMP=/tmp; exec node -e "$1" "$2" "$3"','bridge-seed',seed,challengeFile,state.challenge],{windowsHide:true,timeout:15000});
  const workspace=path.join(root,'parent-workspace');fs.mkdirSync(workspace,{recursive:true});let agent=await parent.call('connect',{workspace});
  for(let round=0;round<2;round++){
   state.activeRound=round;save();
   if(round===1){
    const rotated=await original('callers.rotateCredential',{operationId:'win-wsl-rotate-context'+attemptSuffix,contextId:state.contextId,expectedRevision:1});
    assert.equal(rotated.contextId,state.contextId);state.rotatedCredential=rotated.credentialId;save();
    await close();await open();opened=(await call('callers.operation',{operationId:'win-wsl-rotate-context'+attemptSuffix})).data;
    assert.equal(opened.credentialId,state.rotatedCredential);assert.ok(opened.configuration);agent=await parent.call('connect',{workspace});report.checks.observersReopened=true;
   }
   let record=state.rounds[round];
   if(!record){
    record={requestId:'windows-main-wsl'+attemptSuffix+'-turn-'+(round+1),intent:true};state.rounds.push(record);save();
    const message=round===0
     ? 'This is the user-authorized real Windows-main / WSL-sub AgentBridge acceptance. Use the agentbridge MCP server only. Native code-mode wrappers may invoke those tools, but do not use shell, OS commands, file tools, network tools or native subagent tools yourself. First list_agents, select the registered BuildAgent on the WSL machine, then delegate with stable requestId win-wsl-child-turn-1. Ask that WSL Codex to read interconnect-challenge.txt from its default native workspace and return exactly the trimmed content. Poll the original task_result with afterSeq:0 and limit:100 until terminal. On unknown, retain the original IDs and query the original delegation, never resubmit. After success, output exactly the child result. Do not guess the challenge or change any native configuration.'
     : 'Continue the same real Windows-main / WSL-sub acceptance using only agentbridge MCP. Use list_agents and list_delegations to recover the original BuildAgent conversation. Delegate with stable requestId win-wsl-child-turn-2 and that original conversationId. Ask WSL Codex to recall the challenge from the preceding turn without reading files again, then return exactly the challenge followed by _TWO. Read original task_result with afterSeq:0 until terminal; unknown must never trigger another submission. Output exactly the actual child result. Do not use shell, direct files, network or native subagents yourself.';
    const task=await parent.call('ipc',{op:round?'continue':'submit',requestId:record.requestId,agentId:agent.agentId,...(round?{conversationId:state.rounds[0].conversationId}:{}),message,mcp:opened.configuration});
    record.taskId=task.taskId;record.conversationId=task.conversationId;save();
   }
   let task=await parent.call('ipc',{op:'request',requestId:record.requestId}),lastReport=0;
   while(!terminal(task.status)){
    if(Date.now()-lastReport>15000){report.phase='parent-'+(round+1);report.parentStatus=task.status;report.parentNativeSession=!!task.native?.sessionId;report.completedBridgeCalls=state.calls.filter(c=>c.round===round).map(c=>c.name);publish();console.log(JSON.stringify({phase:report.phase,status:task.status,nativeSession:report.parentNativeSession,bridgeCalls:report.completedBridgeCalls.length}));lastReport=Date.now();}
    await pause(1000);task=await parent.call('ipc',{op:'task',taskId:task.taskId});
   }
   const d=network.network.delegations.find(row=>row.callerContextId===state.contextId&&row.message.includes(round?'_TWO':'interconnect-challenge.txt'));
   const child=d?.taskId?await call('ipc',{op:'task',machineId:node.machineId,taskId:d.taskId}):null;
   report.parentStatus=task.status;report.parentNativeSession=!!task.native?.sessionId;report.phase='parent-'+(round+1)+'-terminal';
   if(task.status==='failed')report.nativeParentFailure={code:task.error?.code,category:/base_url/.test(task.error?.message||'')?'native-proxy-configuration':/unauthorized|invalid_jwt|401/.test(task.error?.message||'')?'native-authentication':'native-execution'};
   const expected=state.challenge+(round?'_TWO':''),methods=[...new Set(state.calls.filter(c=>c.round===round&&c.completed).map(c=>c.name))];
   report.rounds[round]={parentStatus:task.status,parentNativeSession:!!task.native?.sessionId,childStatus:child?.status,childNativeSession:!!child?.native?.sessionId,expectedParentResult:task.result?.message?.trim()===expected,expectedChildResult:child?.result?.message?.trim()===expected,methods,parentUsedShell:task.events.some(e=>e.event.kind==='progress'&&/command_execution|file_change/.test(e.event.text||''))};
   Object.assign(record,{status:task.status,conversationId:task.conversationId,parentNative:task.native?.sessionId,childNative:child?.native?.sessionId,childConversationId:d?.conversationId});save();publish();
   if(task.status!=='succeeded')throw Object.assign(Error(),{code:'NATIVE_PARENT_FAILED'});
   assert.equal(child?.status,'succeeded');assert.equal(report.rounds[round].expectedParentResult,true);assert.equal(report.rounds[round].expectedChildResult,true);assert.equal(report.rounds[round].parentUsedShell,false);
   assert.ok(methods.includes('list_agents')&&methods.includes('delegate')&&methods.includes('task_result'));assert.ok(task.native?.sessionId&&child.native?.sessionId);
  }
  report.checks.sameParentSession=state.rounds[0].parentNative===state.rounds[1].parentNative;
  report.checks.sameChildSession=state.rounds[0].childNative===state.rounds[1].childNative;
  report.checks.sameChildConversation=state.rounds[0].childConversationId===state.rounds[1].childConversationId;
  report.checks.sameExplicitContext=true;report.ok=Object.values(report.checks).every(Boolean);assert.equal(report.ok,true);
 }catch(error){
  report.error={code:/^[A-Z][A-Z0-9_]+$/.test(error.code||'')?error.code:'WINDOWS_WSL_ACCEPTANCE_ASSERTION'};
  try{keep=!!(await parent?.call('snapshot'))?.tasks.some(t=>!terminal(t.status))||network?.network.delegations.some(d=>!['succeeded','failed','cancelled','rejected'].includes(d.state));}catch{keep=true;}
 }finally{
  report.finishedAt=new Date().toISOString();report.liveRecoveryRequired=keep;publish();console.log(JSON.stringify(report));
  if(keep){setInterval(()=>{},60000);}else{await close();if(!report.ok)process.exitCode=1;}
 }
}
run().catch(error=>{console.error(JSON.stringify({error:error.code||'WINDOWS_WSL_NATIVE_SETUP_FAILED'}));process.exitCode=1;});
