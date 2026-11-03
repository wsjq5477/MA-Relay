// Opt-in operator acceptance: revoke the owner of one real running native task.
// Uses a separate legitimate context, never aliases or releases an unknown task.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const execute=promisify(execFile),{CoordinatorClient}=require('../electron/coordinator-client.cjs');
const {windowsNativeEnvironment}=require('./interconnect-windows-profile.cjs');
async function run(){
 assert.equal(process.platform,'win32');assert.equal(process.env.AGENTBRIDGE_REAL_NATIVE,'1');
 const root=process.env.AGENTBRIDGE_CURRENT_CHAT_ROOT,base=process.env.AGENTBRIDGE_NATIVE_BASE,phase=process.argv[2];
 assert.ok(root&&base&&!/^c:/i.test(fs.realpathSync(root))&&!/^c:/i.test(fs.realpathSync(base)));
 Object.assign(process.env,windowsNativeEnvironment(JSON.parse(fs.readFileSync(path.join(base,'native-profile-manifest.json')))));
 const read=p=>JSON.parse(fs.readFileSync(p)),dir=path.join(root,'after-login','owner-inflight');fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const write=(p,v)=>{const tmp=p+'.tmp';fs.writeFileSync(tmp,JSON.stringify(v,null,2),{mode:0o600});fs.renameSync(tmp,p);};
 const file=path.join(dir,'checkpoint.json'),peer=read(path.join(root,'peer.json')),state=fs.existsSync(file)?read(file):{version:1,intents:{},checks:{}};
 const save=()=>write(file,state),client=new CoordinatorClient({directory:path.join(root,'coordinator')});await client.attach();
 const call=async(method,params)=>{const r=await client.request('call',{method,params});if(!r.ok)throw Object.assign(Error(),{code:r.error.code});return r.result;};
 const once=async(method,params)=>{const id=params.operationId,prior=state.intents[id];if(!prior){state.intents[id]={method,params};save();}else assert.deepEqual(prior,{method,params});const r=await call('callers.operation',{operationId:id});if(r.state==='confirmed')return r.data;if(prior||r.state!=='not_found')throw Object.assign(Error(),{code:'ORIGINAL_MANAGEMENT_RESPONSE_UNCONFIRMED'});return call(method,params);};
 const tool=async(label,who,name,args)=>{const descriptor=path.join(dir,label+'-peer.json'),params=path.join(dir,label+'-args.json');write(descriptor,who);write(params,args);let raw;try{raw=(await execute(process.execPath,[path.resolve(__dirname,'../scripts/interconnect-peer-call.cjs'),descriptor,name,params],{env:process.env,windowsHide:true,timeout:75000,maxBuffer:1024*1024})).stdout;}catch(e){if(!e.stdout)throw Object.assign(Error(),{code:'ORIGINAL_MCP_RESPONSE_UNCONFIRMED'});raw=e.stdout;}const r=JSON.parse(raw);write(path.join(dir,label+'-result.json'),r);return r;};
 try{
  if(phase==='start'){
   assert.ok(!state.taskId&&!state.delegateIntent,'Existing native intent must be queried');
   const ledger=read(path.join(root,'coordinator','agent-network.json'));assert.ok(ledger.delegations.every(d=>['succeeded','failed','cancelled','rejected'].includes(d.state)));
   const opened=state.opened||await once('callers.openContext',{operationId:'after-login-inflight-owner-open',principalId:peer.principalId});state.opened=opened;save();assert.notEqual(opened.contextId,peer.contextId);
   const owner={...peer,contextId:opened.contextId,configuration:opened.configuration};state.owner=owner;
   state.delegateIntent={agentId:peer.targetAgentId,requestId:'after-login-inflight-owner-native-1',message:'User-authorized native context ownership verification. Use a native shell tool to wait for 60 seconds without changing files or configuration. Then reply exactly OWNER_CLOSE_COMPLETED. Do not invoke other agents.'};save();
   const r=await tool('submit',owner,'delegate',state.delegateIntent);state.taskId=r.taskId;state.delegationId=r.delegationId;state.status=r.status;save();assert.ok(state.taskId);console.log(JSON.stringify({newExplicitOwnerContext:true,originalMainContextUnchanged:true,status:state.status}));
  }else if(phase==='continue-after-network-repair'){
   assert.ok(state.taskId);assert.equal(state.repairedAttempt,undefined,'Query the original repair attempt');
   const original=await tool('failed-network-original',state.owner,'task_result',{delegationId:state.delegationId,waitMs:0});assert.equal(original.status,'failed');assert.equal(original.outcome?.terminal,true);assert.equal(original.error?.message,'workspace routing discovery failed');
   state.initialFailedTask={taskId:state.taskId,delegationId:state.delegationId,conversationId:original.conversationId,status:original.status};
   const intent={...state.delegateIntent,requestId:'after-login-inflight-owner-native-2',conversationId:original.conversationId};state.repairedAttempt=intent;save();
   const r=await tool('network-repaired-submit',state.owner,'delegate',intent);state.taskId=r.taskId;state.delegationId=r.delegationId;state.status=r.status;save();assert.ok(state.taskId);console.log(JSON.stringify({knownFailedTaskPreserved:true,sameOwnerContext:true,sameConversation:true,status:state.status,originalRequestReplayed:false}));
  }else if(phase==='close'){
   assert.ok(state.taskId);assert.ok(!state.checks.ownerContextClosed,'Already closed; poll original task');
   const observation=await tool('owner-before-close',state.owner,'task_result',{delegationId:state.delegationId,waitMs:0});console.log(JSON.stringify({beforeCloseStatus:observation.status,nativeTaskAssociated:observation.outcome?.evidence==='original-task'}));
   const before=await call('ipc',{op:'task',machineId:peer.targetMachineId,taskId:state.taskId});assert.equal(before.status,'running');assert.ok(before.native?.sessionId);state.originalNativeSession=before.native.sessionId;write(path.join(dir,'before-close-native.json'),before);save();
   const denied=await tool('main-cannot-read',peer,'task_result',{delegationId:state.delegationId,waitMs:0});assert.equal(denied.error?.code,'COLLABORATION_FORBIDDEN');state.checks.mainCannotReadOtherContext=true;
   const closed=await once('callers.closeContext',{operationId:'after-login-inflight-owner-close',contextId:state.opened.contextId,expectedRevision:1});assert.equal(closed.closed,true);state.checks.ownerContextClosed=true;save();
   const revoked=await tool('closed-owner-cannot-read',state.owner,'task_result',{delegationId:state.delegationId,waitMs:0});assert.ok(['CALLER_REVOKED','COLLABORATION_FORBIDDEN'].includes(revoked.error?.code));state.checks.closedOwnerCannotRead=true;
   const after=await call('ipc',{op:'task',machineId:peer.targetMachineId,taskId:state.taskId});assert.equal(after.status,'running');assert.equal(after.native.sessionId,state.originalNativeSession);state.checks.originalStillRunningAfterOwnerClose=true;save();console.log(JSON.stringify({ownerContextClosedWhileRunning:true,closedOwnerReadDenied:true,mainCrossContextReadDenied:true,originalNativeStillRunning:true,nativeCancellationRequested:false}));
  }else if(phase==='poll'){
   assert.ok(state.checks.ownerContextClosed);const task=await call('ipc',{op:'task',machineId:peer.targetMachineId,taskId:state.taskId});assert.equal(task.native.sessionId,state.originalNativeSession);write(path.join(dir,'original-native-current.json'),task);state.status=task.status;state.checks.nativeTerminalAfterOwnerClose=['succeeded','failed','cancelled'].includes(task.status);if(task.status==='succeeded'){assert.equal(task.result?.message,'OWNER_CLOSE_COMPLETED');state.checks.nativeSucceededAfterOwnerClose=true;}save();console.log(JSON.stringify({status:task.status,originalNativeBindingPreserved:true,operatorObservation:true,closedCallerAccessRestored:false,checks:state.checks}));
  }else throw Error('Unknown phase');
 }finally{client.close();}
}
run().catch(e=>{console.log(JSON.stringify({error:e.code||'REAL_NATIVE_CONTEXT_CHECK_UNCONFIRMED',privateDetailsOmitted:true}));process.exitCode=1;});
