// Real automatically activated native permission observation; stable operations and isolated files.
// No account/model changes. Only the exact isolated Write may be approved.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {AgentNetwork}=require('../electron/agent-network.cjs'),{MachineHost}=require('../electron/machine-host.cjs'),{ClaudeHost}=require('../electron/claude-host.cjs'),{HostConnection}=require('../electron/rpc.cjs'),{createCoordinatorService}=require('../electron/coordinator-service.cjs');
const root=path.resolve(__dirname,'../..'),profile=path.join(root,'.agentbridge-dev','i07c-resume-permission-native-first'),output=path.join(root,'artifacts/I07C-resume-permission/2026-10-17/native.json');
fs.mkdirSync(profile,{recursive:true});let network,service;
const prior=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):null;
function open(){network=new AgentNetwork({directory:profile,platform:'linux',distributions:async()=>[],createHost:()=>new MachineHost({directory:path.join(profile,'native'),home:os.homedir(),legacy:new ClaudeHost({directory:path.join(profile,'native','legacy')}),openCode:directory=>new HostConnection(path.join(root,'dist/desktop-host.js'),{directory,native:true,leaf:true})})});service=createCoordinatorService({directory:profile,network,version:require('../package.json').version});}
const report={date:new Date().toISOString(),version:require('../package.json').version,environment:'WSL Linux / production Coordinator event activation, MachineHost and real Claude leader / isolated file targets',status:'running',manualNativeStarts:0,checks:[],scenarios:[]};
async function call(method,params){const r=await service.call({method,params});if(!r.ok)throw Object.assign(Error('Original operation unresolved'),{code:r.error.code});return r.result;}
async function user(name,p){const r=await call('team.operation',{operationId:p.operationId});if(r.state==='confirmed')return r.data;if(r.state!=='not_found')throw Object.assign(Error('Original automatic operation requires query'),{code:'ORIGINAL_UNRESOLVED'});return call('team.'+name,p);}
async function wait(runId,predicate){const until=Date.now()+150000;while(Date.now()<until){const c=await call('team.refresh',{runId});if(predicate(c))return c;await new Promise(r=>setTimeout(r,500));}throw Object.assign(Error('Original execution unresolved'),{code:'PROBE_TIMEOUT'});}
(async()=>{
 open();const snapshot=await network.snapshot(),node=snapshot.nodes.find(n=>n.adapter==='claude'&&n.executionSupported&&n.healthy);assert(node);report.nativeVersion=node.version;if(!node.connected)await network.call('attachNode',{nodeId:node.nodeId});
 const a=await user('registerAgent',{operationId:'member',kind:'native',nodeId:node.nodeId,name:'权限验收成员',purpose:'验证隔离文件Write权限与原终态'});
 const team=await user('createTeam',{operationId:'team',name:'隔离权限验证',leaderId:a.agentId,memberIds:[a.agentId],charter:'这是同一工作原会话续接的权限验收。读team_context/team_tasks/team_messages，从最新用户群消息取得本阶段的Write目标和内容，只执行本阶段一次Write。不要重复之前阶段，不创建或验收业务任务，不使用其他文件工具或Bash；结束本轮等待下一次明确协调事件。'});
 const run=await user('createRun',{operationId:'run',teamId:team.teamId,name:'同会话两阶段权限',goal:'按最新用户阶段消息完成一次精确隔离Write；收到新阶段协调再继续原会话，不能重做已结束阶段。',acceptance:'两阶段保留同Conversation和原生Session，各自权限独立核对'});
 let previousTask;
 for(const stage of [1,2]){
  const decision='once',target=path.join(profile,'stage-'+stage+'.txt'),marker='I07C_RESUME_STAGE_'+stage;
  await user('postMessage',{operationId:'stage-message-'+stage,runId:run.runId,content:'阶段'+stage+'：仅用Write将 '+marker+' 写入 '+target+'。不执行其他阶段或工具。等待用户本次权限决定，然后结束本轮，不验收总工作。',notifyIds:[a.agentId]});
  if(stage===1)await user('configureAutomation',{operationId:'enable',runId:run.runId,expectedRevision:run.revision,enabled:true,agentIds:[a.agentId],maxActivations:2,maxMinutes:20,idleMinutes:120});
  else await user('wake',{operationId:'wake-stage-2',runId:run.runId,reason:'执行新阶段2，按最新用户消息写第二个隔离文件；不要重做第一阶段。'});
  const recovered=prior?.scenarios?.find(x=>x.stage===stage);
  if(recovered){const c=await call('team.refresh',{runId:run.runId});assert(c.attempts.length>=stage);const item=c.attempts[stage-1];assert.equal(item.automatic,true);assert.equal(item.state,recovered.nativeTerminal);assert.equal(item.waiting,undefined);assert.equal(fs.readFileSync(target,'utf8').trim(),marker);const task=await call('ipc',{op:'request',machineId:node.machineId,requestId:item.requestId});if(previousTask){assert.notEqual(task.taskId,previousTask.taskId);assert.notEqual(task.requestId,previousTask.requestId);assert(task.native?.sessionId);assert.equal(task.conversationId,previousTask.conversationId);assert.equal(task.native.sessionId,previousTask.native.sessionId);}previousTask=task;const {sameSession,...evidence}=recovered;report.scenarios.push({...evidence,sameSessionAsPrevious:stage===2?true:null,used:stage,recoveredWithoutExecution:true});continue;}
  let c=await wait(run.runId,c=>c.attempts[stage-1]?.waiting||['succeeded','failed','cancelled'].includes(c.attempts[stage-1]?.state));
  const attempt=c.attempts[stage-1];assert.equal(attempt.automatic,true);assert.equal(c.automation.policy.used,stage);assert(attempt.waiting,'Native CLI did not expose permission wait; cannot claim permission validation');
  assert.equal(attempt.waiting.kind,'permission');assert(!['succeeded','failed','cancelled'].includes(attempt.state));assert(!fs.existsSync(target),'Write happened before approval');
  const noticeCount=c.messages.filter(m=>m.attemptId===attempt.attemptId&&m.content.includes('需要用户处理原生')).length;
  service.close();open();c=await call('team.refresh',{runId:run.runId});assert.equal(c.attempts[stage-1].attemptId,attempt.attemptId);assert.equal(c.attempts[stage-1].waiting.kind,'permission');assert.equal(c.messages.filter(m=>m.attemptId===attempt.attemptId&&m.content.includes('需要用户处理原生')).length,noticeCount);
  const task=await call('ipc',{op:'request',machineId:node.machineId,requestId:attempt.requestId});
  const pending=await call('ipc',{op:'pending',machineId:node.machineId,taskId:task.taskId});assert.equal(pending.permissions.length,1);assert.equal(pending.permissions[0].action,'Write');assert(pending.permissions[0].resources.includes(target),'Only isolated exact Write can be approved');
  const params={op:'reply',machineId:node.machineId,taskId:task.taskId,reply:{executionId:task.executionId,operationId:'permission-stage-'+stage,action:'permission',requestId:pending.permissions[0].id,decision}};
  const receipt=await call('ipc',params);assert.equal(receipt.state,'confirmed');assert.equal((await call('ipc',params)).state,'confirmed');
  c=await wait(run.runId,c=>['succeeded','failed','cancelled'].includes(c.attempts[stage-1]?.state));assert.equal(c.attempts.length,stage);assert.equal(c.automation.policy.used,stage);assert.equal(c.automation.pending,0);assert.equal(c.automation.events.length,stage);assert.equal(c.attempts[stage-1].waiting,undefined);assert.equal(c.run.state,'active');
  if(decision==='once'){assert.equal(c.attempts[stage-1].state,'succeeded');assert.equal(fs.readFileSync(target,'utf8').trim(),marker);}else{assert.equal(c.attempts[stage-1].state,'failed');assert(!fs.existsSync(target));}
  const finished=await call('ipc',{op:'request',machineId:node.machineId,requestId:attempt.requestId});if(previousTask){assert.notEqual(finished.taskId,previousTask.taskId);assert.notEqual(finished.requestId,previousTask.requestId);assert(finished.native?.sessionId);assert.equal(finished.conversationId,previousTask.conversationId);assert.equal(finished.native.sessionId,previousTask.native.sessionId);}previousTask=finished;
  report.scenarios.push({stage,decision,sameSessionAsPrevious:stage===2?true:null,waitingObserved:true,automatic:true,used:stage,observerRestartPreservedOriginal:true,noticeCount,nativeTerminal:c.attempts[stage-1].state,fileResult:decision==='once'?'exact marker':'absent',attemptCount:stage});fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 }
 const finalContext=await call('team.refresh',{runId:run.runId});assert.equal(finalContext.attempts.length,2);assert.equal(finalContext.automation.policy.used,2);assert.equal(finalContext.automation.pending,0);assert.deepEqual(finalContext.automation.events.map(e=>e.kind),['user_start','attention']);report.finalActivations=2;
 let permissionCommands=0,nativeToolUses=0;
 function scan(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const file=path.join(dir,entry.name);
   if(entry.isDirectory()){scan(file);continue;}
   if(!['commands.jsonl','events.jsonl'].includes(entry.name))continue;
   for(const line of fs.readFileSync(file,'utf8').split('\n').filter(Boolean)){
    const event=JSON.parse(line);
    if(entry.name==='commands.jsonl'&&event.action==='permission')permissionCommands++;
    if(entry.name==='events.jsonl'&&event.kind==='progress'&&event.data?.text?.startsWith('Claude 正在使用 ')){
     assert(['Claude 正在使用 Write','Claude 正在使用 mcp__agentbridge__team_context','Claude 正在使用 mcp__agentbridge__team_tasks','Claude 正在使用 mcp__agentbridge__team_messages','Claude 正在使用 mcp__agentbridge__team_post_message','Claude 正在使用 mcp__agentbridge__team_document','Claude 正在使用 mcp__agentbridge__team_operation','Claude 正在使用 mcp__agentbridge__team_acknowledge'].includes(event.data.text));if(event.data.text==='Claude 正在使用 Write')nativeToolUses++;
    }
   }
  }
 }
 scan(profile);assert.equal(permissionCommands,2);assert.equal(nativeToolUses,2);
 report.permissionCommands=permissionCommands;report.nativeToolUses=nativeToolUses;
 report.checks.push('Real automatic activation reached permission waiting without manual native starts; original waiting persisted across observer restart without duplicate notice or execution','Exact isolated Write approved once; original native task succeeded and file marker matched','Second stage resumed the same Conversation/native Session, required its own Write permission and did not repeat the first stage');report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code||'ASSERTION',message:'Native permission verification incomplete; retain private original operations and query them, never reset profile or substitute IDs.'};process.exitCode=1;}).finally(()=>{service?.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
