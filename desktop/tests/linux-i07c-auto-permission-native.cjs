// Real automatically activated native permission observation; stable operations and isolated files.
// No account/model changes. Only the exact isolated Write may be approved.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {AgentNetwork}=require('../electron/agent-network.cjs'),{MachineHost}=require('../electron/machine-host.cjs'),{ClaudeHost}=require('../electron/claude-host.cjs'),{HostConnection}=require('../electron/rpc.cjs'),{createCoordinatorService}=require('../electron/coordinator-service.cjs');
const root=path.resolve(__dirname,'../..'),profile=path.join(root,'.agentbridge-dev','i07c-auto-permission-native-first'),output=path.join(root,'artifacts/I07C-auto-permission/2026-10-16/native.json');
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
 const team=await user('createTeam',{operationId:'team',name:'隔离权限验证',leaderId:a.agentId,memberIds:[a.agentId],charter:'这是自动激活权限验收。先读team_context和team_tasks，从本次目标取得精确隔离文件和内容，只使用Write执行该写入。没有业务任务，不创建/分配/验收任务，不调用team_accept_run。不使用Bash或其他文件工具。权限被拒后立即报告并结束，不得绕过或重试。'});
 for(const decision of ['once','reject']){
  const target=path.join(profile,'permission-'+decision+'.txt'),marker='I07C_PERMISSION_'+decision.toUpperCase();
  const run=await user('createRun',{operationId:'run-'+decision,teamId:team.teamId,name:'原生权限'+decision,goal:'仅使用Write工具将 '+marker+' 写入绝对路径 '+target+'。等待用户权限决定；被拒后结束，不换工具或重试，不给自己创建任务，不验收总工作。',acceptance:'等待不等于完成，拒绝不能绕过'});
  await user('configureAutomation',{operationId:'enable-'+decision,runId:run.runId,expectedRevision:run.revision,enabled:true,agentIds:[a.agentId],maxActivations:1,maxMinutes:20,idleMinutes:120});
  const recovered=prior?.scenarios?.find(x=>x.decision===decision);
  if(recovered){const c=await call('team.refresh',{runId:run.runId});assert.equal(c.attempts.length,1);assert.equal(c.attempts[0].automatic,true);assert.equal(c.automation.policy.used,1);assert.equal(c.automation.pending,0);assert.equal(c.automation.events.length,1);assert.equal(c.automation.events[0].kind,'user_start');assert.equal(c.attempts[0].state,recovered.nativeTerminal);assert.equal(c.attempts[0].waiting,undefined);if(decision==='once')assert.equal(fs.readFileSync(target,'utf8').trim(),marker);else assert(!fs.existsSync(target));report.scenarios.push({...recovered,recoveredWithoutExecution:true});continue;}
  let c=await wait(run.runId,c=>c.attempts[0]?.waiting||['succeeded','failed','cancelled'].includes(c.attempts[0]?.state));
  const attempt=c.attempts[0];assert.equal(attempt.automatic,true);assert.equal(c.automation.policy.used,1);assert(attempt.waiting,'Native CLI did not expose permission wait; cannot claim permission validation');
  assert.equal(attempt.waiting.kind,'permission');assert(!['succeeded','failed','cancelled'].includes(attempt.state));assert(!fs.existsSync(target),'Write happened before approval');
  const noticeCount=c.messages.filter(m=>m.attemptId===attempt.attemptId&&m.content.includes('需要用户处理原生')).length;
  service.close();open();c=await call('team.refresh',{runId:run.runId});assert.equal(c.attempts[0].attemptId,attempt.attemptId);assert.equal(c.attempts[0].waiting.kind,'permission');assert.equal(c.messages.filter(m=>m.attemptId===attempt.attemptId&&m.content.includes('需要用户处理原生')).length,noticeCount);
  const task=await call('ipc',{op:'request',machineId:node.machineId,requestId:attempt.requestId});
  const pending=await call('ipc',{op:'pending',machineId:node.machineId,taskId:task.taskId});assert.equal(pending.permissions.length,1);assert.equal(pending.permissions[0].action,'Write');assert(pending.permissions[0].resources.includes(target),'Only isolated exact Write can be approved');
  const params={op:'reply',machineId:node.machineId,taskId:task.taskId,reply:{executionId:task.executionId,operationId:'permission-'+decision,action:'permission',requestId:pending.permissions[0].id,decision}};
  const receipt=await call('ipc',params);assert.equal(receipt.state,'confirmed');assert.equal((await call('ipc',params)).state,'confirmed');
  c=await wait(run.runId,c=>['succeeded','failed','cancelled'].includes(c.attempts[0]?.state));assert.equal(c.attempts.length,1);assert.equal(c.automation.policy.used,1);assert.equal(c.automation.pending,0);assert.equal(c.automation.events.length,1);assert.equal(c.automation.events[0].kind,'user_start');assert.equal(c.attempts[0].waiting,undefined);assert.equal(c.run.state,'active');
  if(decision==='once'){assert.equal(c.attempts[0].state,'succeeded');assert.equal(fs.readFileSync(target,'utf8').trim(),marker);}else{assert.equal(c.attempts[0].state,'failed');assert(!fs.existsSync(target));}
  report.scenarios.push({decision,waitingObserved:true,automatic:true,used:1,observerRestartPreservedOriginal:true,noticeCount,nativeTerminal:c.attempts[0].state,fileResult:decision==='once'?'exact marker':'absent',attemptCount:1});fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 }
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
 report.checks.push('Real automatic activation reached permission waiting without manual native starts; original waiting persisted across observer restart without duplicate notice or execution','Exact isolated Write approved once; original native task succeeded and file marker matched','Real Write rejected; no alternate execution/file and original task failed; business work remained active');report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code||'ASSERTION',message:'Native permission verification incomplete; retain private original operations and query them, never reset profile or substitute IDs.'};process.exitCode=1;}).finally(()=>{service?.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
