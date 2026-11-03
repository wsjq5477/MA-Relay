// Operator acceptance against the ORIGINAL real WSL tasks. Never submits work.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const execute=promisify(execFile);
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
const {windowsNativeEnvironment}=require('./interconnect-windows-profile.cjs');
async function run(){
 assert.equal(process.platform,'win32');assert.equal(process.env.AGENTBRIDGE_REAL_NATIVE,'1');
 const root=process.env.AGENTBRIDGE_CURRENT_CHAT_ROOT,base=process.env.AGENTBRIDGE_NATIVE_BASE,phase=process.argv[2];
 assert.ok(root&&base&&path.isAbsolute(root)&&!/^c:/i.test(root));assert.ok(['rotate','reopened','policy','grant','verify'].includes(phase));
 assert.ok(!/^c:/i.test(fs.realpathSync(root)));assert.ok(path.isAbsolute(base)&&!/^c:/i.test(fs.realpathSync(base)));
 Object.assign(process.env,windowsNativeEnvironment(JSON.parse(fs.readFileSync(path.join(base,'native-profile-manifest.json')))));
 const dir=path.join(root,'owner-recovery');fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const write=(file,data)=>{const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2),{mode:0o600});fs.renameSync(tmp,file);};
 const read=file=>JSON.parse(fs.readFileSync(file)),peerFile=path.join(root,'peer.json');let peer=read(peerFile);
 const stateFile=path.join(dir,'checkpoint.json'),state=fs.existsSync(stateFile)?read(stateFile):{version:1,intents:{},checks:{}};
 if(phase==='rotate'&&state.checks.isolatedContextClosed||phase==='policy'&&state.checks.originalOperationPolicyRestored||phase==='grant'&&state.checks.originalTargetGrantRestored)
  throw Object.assign(Error(),{code:'ORIGINAL_PHASE_COMPLETED_USE_VERIFY_READONLY'});
 const save=()=>write(stateFile,state),client=new CoordinatorClient({directory:path.join(root,'coordinator')});
 await client.attach();
 const call=async(method,params={})=>{const response=await client.request('call',{method,params});if(!response.ok)throw Object.assign(Error(),{code:response.error.code});return response.result;};
 const once=async(method,params)=>{
  const receipt=await call(method.startsWith('agents.')?'agents.operation':'callers.operation',{operationId:params.operationId});
  if(receipt.state==='confirmed')return receipt.data;
  assert.equal(receipt.state,'not_found');
  if(state.intents[params.operationId])throw Object.assign(Error(),{code:'ORIGINAL_USER_OPERATION_UNCONFIRMED'});
  state.intents[params.operationId]={method,params};save();return call(method,params);
 };
 const tool=async(label,who,name,args={})=>{
  const file=path.join(dir,label+'-peer.json'),params=path.join(dir,label+'-args.json');write(file,who);write(params,args);
  let output;try{output=(await execute(process.execPath,[path.resolve(__dirname,'../scripts/interconnect-peer-call.cjs'),file,name,params],{env:process.env,windowsHide:true,timeout:75000,maxBuffer:1024*1024})).stdout;}
  catch(error){if(!error.stdout)throw Object.assign(Error(),{code:'ORIGINAL_MCP_OBSERVATION_UNCONFIRMED'});output=error.stdout;}
  const result=JSON.parse(output);write(path.join(dir,label+'-result.json'),result);return result;
 };
 const oldCredentialDenied=async()=>{
  const current=read(peer.configuration.args.at(-1)),old=read(path.join(dir,'old-descriptor.json'));
  const response=await fetch(current.url,{method:'POST',headers:{authorization:'Bearer '+old.token,'content-type':'application/json'},body:JSON.stringify({name:'list_agents',args:{},callId:'original-old-credential-readonly'}),signal:AbortSignal.timeout(10000)});
  if(response.status===403)return true;assert.equal(response.status,200);const body=await response.json();assert.equal(body.error?.code,'CALLER_REVOKED');return true;
 };
 const originals=async(label)=>{
  const tasks=[];
  for(const row of state.originals){
   const result=await tool(label+'-'+tasks.length,peer,'task_result',{delegationId:row.delegationId,afterSeq:0,limit:100,waitMs:0});
   assert.equal(result.outcome?.evidence,'original-task');assert.equal(result.taskId,row.taskId);assert.equal(result.status,row.status);assert.equal(result.outcome.terminal,true);
   assert.equal(result.invocation.caller.contextId,state.contextId);assert.equal(result.invocation.caller.principalId,state.principalId);
   const native=await call('ipc',{op:'task',machineId:peer.targetMachineId,taskId:row.taskId});
   assert.equal(native.native?.sessionId,row.nativeSession);tasks.push(result);
  }
  assert.equal(new Set(tasks.map(t=>t.conversationId)).size,1);return tasks;
 };
 try{
  if(phase==='rotate'){
   if(!state.originals){
    const tasks=[];
    for(const name of ['first','network-recovered','auth-restored']){
     const result=read(path.join(root,name+'-result.json'));assert.equal(result.outcome.terminal,true);
     const native=await call('ipc',{op:'task',machineId:peer.targetMachineId,taskId:result.taskId});assert.ok(native.native?.sessionId);
     tasks.push({taskId:result.taskId,delegationId:result.delegationId,status:result.status,nativeSession:native.native.sessionId});
    }
    assert.equal(tasks.length,3);state.originals=tasks;state.contextId=peer.contextId;state.principalId=peer.principalId;
    state.originalRequests=read(path.join(root,'coordinator','agent-network.json')).requests.length;
    state.originalDelegations=read(path.join(root,'coordinator','agent-network.json')).delegations.length;
    const contexts=await call('callers.list'),context=contexts.contexts.find(c=>c.contextId===peer.contextId);assert.ok(context?.enabled);
    state.originalRevision=context.revision;state.originalCredentialId=context.currentCredentialId;
    write(path.join(dir,'old-descriptor.json'),read(peer.configuration.args.at(-1)));save();
   }
   await originals('before-rotation');state.checks.originalTasksReadBeforeRotation=true;
   const rotated=await once('callers.rotateCredential',{operationId:'current-chat-rotate-context',contextId:state.contextId,expectedRevision:state.originalRevision});
   assert.equal(rotated.contextId,state.contextId);assert.notEqual(rotated.credentialId,state.originalCredentialId);assert.ok(rotated.configuration);
   peer={...peer,configuration:rotated.configuration};write(peerFile,peer);state.rotatedCredentialId=rotated.credentialId;
   state.checks.sameContextNewCredential=true;state.checks.oldCredentialRejectedAfterRotation=await oldCredentialDenied();save();
   await originals('after-rotation');state.checks.originalTasksAndNativeSessionReadAfterRotation=true;
   const isolated=await once('callers.openContext',{operationId:'native-owner-recovery-open-isolated-20261103',principalId:state.principalId});
   assert.notEqual(isolated.contextId,state.contextId);
   const isolatedPeer={...peer,contextId:isolated.contextId,configuration:isolated.configuration};
   const denied=await tool('cross-context',isolatedPeer,'task_result',{taskId:state.originals[0].taskId,waitMs:0});assert.equal(denied.error?.code,'COLLABORATION_FORBIDDEN');
   state.checks.otherContextCannotReadOriginalTask=true;
   const closed=await once('callers.closeContext',{operationId:'native-owner-recovery-close-isolated-20261103',contextId:isolated.contextId,expectedRevision:1});assert.equal(closed.closed,true);state.checks.isolatedContextClosed=true;
   await originals('after-isolated-close');state.checks.closingOtherContextDidNotCancelOrChangeOriginals=true;save();
  }else if(phase==='reopened'){
   assert.ok(state.rotatedCredentialId);assert.equal(peer.contextId,state.contextId);
   const restored=await call('callers.operation',{operationId:'current-chat-rotate-context'});assert.equal(restored.state,'confirmed');assert.equal(restored.data.credentialId,state.rotatedCredentialId);
   peer={...peer,configuration:restored.data.configuration};write(peerFile,peer);
   await originals('after-observer-reopen');state.checks.originalTasksAndNativeSessionReadAfterObserverReopen=true;
   state.checks.oldCredentialRejectedAfterObserverReopen=await oldCredentialDenied();save();
  }else if(phase==='policy'){
   assert.ok(state.rotatedCredentialId);assert.equal(peer.contextId,state.contextId);
   const rows=await call('callers.list'),caller=rows.items.find(row=>row.principalId===state.principalId);assert.ok(caller?.enabled);
   if(!state.originalPolicy){state.originalPolicy={revision:caller.revision,operations:caller.operations};save();}
   const original=state.originalPolicy;
   try{
    await once('callers.configure',{operationId:'native-owner-remove-delegate-20261103',principalId:state.principalId,expectedRevision:original.revision,operations:original.operations.filter(op=>op!=='delegate')});
    const readable=await tool('result-without-delegate',peer,'task_result',{taskId:state.originals.at(-1).taskId,waitMs:0});
    assert.equal(readable.outcome?.evidence,'original-task');assert.equal(readable.canContinue,false);state.checks.resultReadWithoutDelegatePermission=true;
    await once('callers.configure',{operationId:'native-owner-remove-result-20261103',principalId:state.principalId,expectedRevision:original.revision+1,operations:original.operations.filter(op=>!['delegate','result'].includes(op))});
    const denied=await tool('result-permission-revoked',peer,'task_result',{taskId:state.originals[0].taskId,waitMs:0});
    assert.equal(denied.error?.code,'CALLER_OPERATION_FORBIDDEN');state.checks.currentResultPermissionRevocationEnforced=true;save();
   }finally{
    const latest=(await call('callers.list')).items.find(row=>row.principalId===state.principalId);assert.ok(latest?.enabled);
    if(JSON.stringify(latest.operations)!==JSON.stringify(original.operations))await once('callers.configure',{operationId:'native-owner-restore-original-policy-20261103',principalId:state.principalId,expectedRevision:latest.revision,operations:original.operations});
   }
   const restored=(await call('callers.list')).items.find(row=>row.principalId===state.principalId);assert.deepEqual(restored.operations,original.operations);state.checks.originalOperationPolicyRestored=true;
   await originals('after-policy-restoration');state.checks.originalTasksAndNativeSessionReadAfterPolicyRestoration=true;save();
  }else if(phase==='grant'){
   const caller=(await call('callers.list')).items.find(row=>row.principalId===state.principalId);assert.ok(caller?.enabled);
   if(!state.originalGrantPolicy){state.originalGrantPolicy={revision:caller.revision,grants:caller.grants};save();}
   const original=state.originalGrantPolicy;
   try{
    await once('callers.configure',{operationId:'native-owner-remove-target-grants-20261103',principalId:state.principalId,expectedRevision:original.revision,allowedAgentIds:[]});
    const view=await tool('targets-revoked-discovery',peer,'list_agents');assert.ok(Array.isArray(view.items));assert.equal(view.items.length,0);state.checks.revokedTargetsAbsentFromDiscovery=true;
    const readable=await tool('result-without-target-grant',peer,'task_result',{taskId:state.originals.at(-1).taskId,waitMs:0});
    assert.equal(readable.outcome?.evidence,'original-task');assert.equal(readable.canContinue,false);state.checks.originalResultReadWithoutCurrentTargetGrant=true;save();
   }finally{
    const latest=(await call('callers.list')).items.find(row=>row.principalId===state.principalId);assert.ok(latest?.enabled);
    if(JSON.stringify(latest.grants)!==JSON.stringify(original.grants))await once('callers.configure',{operationId:'native-owner-restore-target-grants-20261103',principalId:state.principalId,expectedRevision:latest.revision,allowedAgentIds:original.grants.map(g=>g.agentId)});
   }
   const restored=(await call('callers.list')).items.find(row=>row.principalId===state.principalId);assert.deepEqual(restored.grants,original.grants);state.checks.originalTargetGrantRestored=true;
   await originals('after-target-restoration');state.checks.originalTasksAndNativeSessionReadAfterTargetRestoration=true;save();
  }else{
   assert.equal(peer.contextId,state.contextId);await originals('readonly-final');
   assert.equal(await oldCredentialDenied(),true);
   const caller=(await call('callers.list')).items.find(row=>row.principalId===state.principalId);assert.ok(caller?.enabled);
   assert.deepEqual(caller.operations,state.originalPolicy.operations);assert.deepEqual(caller.grants,state.originalGrantPolicy.grants);
  }
  const network=read(path.join(root,'coordinator','agent-network.json'));
  assert.equal(network.requests.length,state.originalRequests);assert.equal(network.delegations.length,state.originalDelegations);state.checks.noNewRequestsOrDelegations=true;save();
  const report={date:new Date().toISOString(),phase,sourceOnly:true,originalRealNativeTasks:state.originals.length,originalTaskStatuses:state.originals.map(r=>r.status),allOriginalTasksTerminal:true,sameOriginalCallerContext:true,checksAreCumulative:true,uniqueChecks:Object.keys(state.checks).length,checks:state.checks,newNativeMessagesSubmitted:0,modelReplyVerified:false,modelLoginIndependent:true,missingSubmitReceiptNotSimulated:true,inFlightOwnerContextClosureNotTested:true,allNewAuditStateNonC:true};
  write(path.resolve('artifacts/interconnect-core/2026-11-03/native-owner-recovery-'+phase+'.json'),report);console.log(JSON.stringify(report));
 }finally{client.close();}
}
run().catch(error=>{console.log(JSON.stringify({error:error.code||'ORIGINAL_NATIVE_OWNER_ACCEPTANCE_FAILED'}));process.exitCode=1;});
