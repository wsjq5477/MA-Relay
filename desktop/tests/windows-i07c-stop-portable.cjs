// Ordinary no-debug Windows portable EXE, production IPC and SQLite, model 0.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{createHash}=require('node:crypto');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
if(process.platform!=='win32')throw Error('Windows required');
const version=require('../package.json').version,profile=fs.mkdtempSync(path.join(os.tmpdir(),'ab-team-portable-'));
const source=path.resolve(__dirname,`../release/AgentBridge-${version}-Windows-x64.exe`),exe=path.join(profile,path.basename(source));fs.copyFileSync(source,exe);
const output=path.resolve(__dirname,'../../artifacts/I07C-stop/2026-10-16/portable.json');
const report={date:new Date().toISOString(),version,environment:'Windows ordinary portable EXE / real coordinator, IPC, SQLite and local MCP / isolated profile / model 0',status:'running',checks:[],nativePrompts:0};
report.portable={bytes:fs.statSync(exe).size,sha256:createHash('sha256').update(fs.readFileSync(exe)).digest('hex')};
assert.equal(report.portable.sha256,createHash('sha256').update(fs.readFileSync(source)).digest('hex'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));let wrapper,main,client;
const ps=command=>new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:15000},(e,o)=>e?reject(e):resolve(o.trim())));
async function launch(){
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;wrapper=spawn(exe,[],{env,stdio:'ignore'});
 const until=Date.now()+120000;
 while(Date.now()<until){
  if(fs.existsSync(path.join(profile,'runtime.json'))){
   const text=await ps(`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${wrapper.pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;command=$_.CommandLine;title=(Get-Process -Id $_.ProcessId).MainWindowTitle}} | ConvertTo-Json -Compress`);
   const parsed=text?JSON.parse(text):[];main=(Array.isArray(parsed)?parsed:[parsed]).find(p=>p.title==='AgentBridge');
   if(main){assert(!/remote-debugging|--inspect/.test(main.command));const next=new CoordinatorClient({directory:profile});try{await next.attach();client=next;assert.equal(client.info.version,version);return;}catch(error){next.close();if(!['ENOENT','ECONNREFUSED'].includes(error.code))throw error;main=null;}}
  }await delay(500);
 }throw Error('Ordinary portable did not start');
}
async function closeWindow(){
 if(!main)return;assert.equal(main.parent,wrapper.pid);await ps(`(Get-Process -Id ${main.pid}).CloseMainWindow() | Out-Null`);
 const until=Date.now()+30000;while(Date.now()<until&&wrapper.exitCode===null)await delay(200);assert.notEqual(wrapper.exitCode,null);main=null;
}
async function call(method,p={}){const reply=await client.request('call',{method:'team.'+method,params:{...p}});assert.equal(reply.ok,true,JSON.stringify(reply.error));return reply.result;}
(async()=>{
 await launch();const coordinatorPid=client.info.pid;
 const agent=await call('registerAgent',{operationId:'portable-agent',kind:'mcp',externalKey:'controlled-external',name:'受控外部成员',purpose:'验证公共群通信'});
 const developer=await call('registerAgent',{operationId:'portable-dev',kind:'mcp',externalKey:'developer',name:'开发员',purpose:'交付明确版本'});
 const compilerAgent=await call('registerAgent',{operationId:'portable-compiler',kind:'mcp',externalKey:'compiler',name:'编译员',purpose:'报告指定版本'});
 const team=await call('createTeam',{operationId:'portable-team',name:'便携验证小队',leaderId:agent.agentId,memberIds:[agent.agentId,developer.agentId,compilerAgent.agentId],charter:'仅做连接和消息验证'});
 const run=await call('createRun',{operationId:'portable-run',teamId:team.teamId,name:'保存工作',goal:'保存并读取',acceptance:'消息和文档重开后保留'});
 await call('writeDocument',{operationId:'portable-doc',runId:run.runId,expectedRevision:0,title:'便携共享文档',content:'受控内容',editorIds:[agent.agentId]});
 const connection=await call('connect',{operationId:'portable-connection',runId:run.runId,agentId:agent.agentId});
 let descriptor=JSON.parse(fs.readFileSync(connection.configuration.args[1],'utf8'));
 const tool=async(name,args={})=>{const r=await fetch(descriptor.url,{method:'POST',headers:{authorization:'Bearer '+descriptor.token,'content-type':'application/json'},body:JSON.stringify({name,args})});return r.json();};
 assert((await tool('team_post_message',{operationId:'portable-member-message',content:'来自外部成员的公开报告'})).result.messageId);
 const view=await call('context',{runId:run.runId});assert.equal(view.automation.runningMessages,false);assert.equal(view.automation.policy,null);assert.equal(view.documents[0].title,'便携共享文档');assert(view.messages.some(m=>m.content==='来自外部成员的公开报告'));report.checks.push('Ordinary EXE uses embedded SQLite for registry, team, work, document and member-authenticated public report');
 const d=await call('createTask',{operationId:'portable-d',runId:run.runId,title:'开发',description:'提交X，再返修Y',kind:'delivery',ownerId:developer.agentId});
 const v=await call('createTask',{operationId:'portable-v',runId:run.runId,title:'复验',description:'报告版本一致',kind:'verification',ownerId:compilerAgent.agentId,sourceTaskId:d.workItemId});
 await call('configureHandoff',{operationId:'portable-grant',runId:run.runId,workItemId:v.workItemId,toTaskId:d.workItemId,maxUses:2,enabled:true,expectedRevision:0});
 const dc=await call('connect',{operationId:'portable-dc',runId:run.runId,agentId:developer.agentId}),bc=await call('connect',{operationId:'portable-bc',runId:run.runId,agentId:compilerAgent.agentId});
 const member=config=>async(name,args={})=>{const desc=JSON.parse(fs.readFileSync(config.args[1],'utf8'));const r=await (await fetch(desc.url,{method:'POST',headers:{authorization:'Bearer '+desc.token,'content-type':'application/json'},body:JSON.stringify({name:'team_'+name,args})})).json();assert(!r.error,JSON.stringify(r.error));return r.result;};
 const dev=member(dc.configuration),compiler=member(bc.configuration),item=async id=>(await call('tasks',{runId:run.runId})).workItems.find(x=>x.workItemId===id);
 await dev('claim_task',{operationId:'claim-X',workItemId:d.workItemId,expectedRevision:d.revision});
 const x=await dev('report_task',{operationId:'deliver-X',workItemId:d.workItemId,expectedRevision:(await item(d.workItemId)).revision,outcome:'submitted',summary:'X',version:'X',reference:'artifact://portable/X'});
 await compiler('claim_task',{operationId:'verify-X',workItemId:v.workItemId,expectedRevision:(await item(v.workItemId)).revision});
 await compiler('report_task',{operationId:'failed-X',workItemId:v.workItemId,expectedRevision:(await item(v.workItemId)).revision,outcome:'failed',summary:'X受控失败',artifactId:x.report.artifact.artifactId,handoffTaskId:d.workItemId,targetRevision:(await item(d.workItemId)).revision});
 assert.equal((await item(d.workItemId)).round,2);report.checks.push('Portable production member MCP commits failed X and an authorized repair with no native activation');
 const frozen=fs.readdirSync(path.join(profile,'coordinator/versions')).find(n=>n.startsWith(version+'-'));
 for(const name of ['team-space.cjs','team-work.cjs','team-automation.cjs','team-stop.cjs','team-tools.cjs','collaboration-broker.cjs','mcp-client.cjs','coordinator-service.cjs'])assert.equal(createHash('sha256').update(fs.readFileSync(path.join(profile,'coordinator/versions',frozen,'desktop/electron',name))).digest('hex'),createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../electron',name))).digest('hex'));
 report.checks.push('Frozen team and MCP resources exactly match current source');
 await closeWindow();client.close();client=new CoordinatorClient({directory:profile});await client.attach();assert.equal(client.info.pid,coordinatorPid);assert((await call('context',{runId:run.runId})).messages.some(m=>m.content==='来自外部成员的公开报告'));report.checks.push('Closing the ordinary window preserves the same coordinator and public workspace');
 await launch();assert.equal(client.info.pid,coordinatorPid);await closeWindow();await client.request('shutdown');client.close();
 const until=Date.now()+30000;while(Date.now()<until){try{process.kill(coordinatorPid,0);}catch{break;}await delay(200);}
 await launch();assert.notEqual(client.info.pid,coordinatorPid);
 const recovered=await call('context',{runId:run.runId});assert.equal(recovered.documents[0].content,'受控内容');descriptor=JSON.parse(fs.readFileSync(connection.configuration.args[1],'utf8'));assert((await tool('team_context')).result.run.runId===run.runId);
 assert.equal((await item(d.workItemId)).round,2);assert.equal((await compiler('operation',{operationId:'failed-X'})).state,'confirmed');
 await dev('claim_task',{operationId:'claim-Y',workItemId:d.workItemId,expectedRevision:(await item(d.workItemId)).revision});
 const y=await dev('report_task',{operationId:'deliver-Y',workItemId:d.workItemId,expectedRevision:(await item(d.workItemId)).revision,outcome:'submitted',summary:'Y',version:'Y',reference:'artifact://portable/Y'});
 await compiler('claim_task',{operationId:'verify-Y',workItemId:v.workItemId,expectedRevision:(await item(v.workItemId)).revision});
 await compiler('report_task',{operationId:'passed-Y',workItemId:v.workItemId,expectedRevision:(await item(v.workItemId)).revision,outcome:'passed',summary:'Y受控通过',artifactId:y.report.artifact.artifactId,accessConfirmed:true,evidenceReference:'report://portable/Y'});
 for(const id of [v.workItemId,d.workItemId])await call('acceptTask',{operationId:'portable-accept-'+id,runId:run.runId,workItemId:id,expectedRevision:(await item(id)).revision,summary:'已核对当前Y版本'});
 const board=await call('tasks',{runId:run.runId});assert.equal(board.workItems.every(x=>x.state==='completed'),true);assert.equal(board.workItems.find(x=>x.workItemId===v.workItemId).reports.length,2);assert.equal(board.handoffGrants[0].used,1);
 report.checks.push('Full backend restart restores original endpoints, task rounds, grant use and original receipts; Y repair and current-version acceptance preserve failed X');
 const beforeStop=await call('context',{runId:run.runId});assert.equal(beforeStop.stopSupported,true);
 const stopped=await call('stopRun',{operationId:'portable-stop',runId:run.runId,expectedRevision:beforeStop.run.revision});assert.equal(stopped.state,'closed');
 assert.equal((await tool('team_context')).error.code,'TEAM_FORBIDDEN');
 let stoppedContext=await call('context',{runId:run.runId});assert.equal(stoppedContext.stop.unresolved,0);assert.equal(stoppedContext.stop.externalCount,3);assert.equal(stoppedContext.acceptance,null);assert.equal(stoppedContext.workItems[1].reports.length,2);
 report.checks.push('Ordinary EXE stop revokes external member access, preserves exact-version task history and clearly reports external execution is unmanaged');
 const stoppedPid=client.info.pid;await closeWindow();await client.request('shutdown');client.close();
 const stoppedUntil=Date.now()+30000;while(Date.now()<stoppedUntil){try{process.kill(stoppedPid,0);}catch{break;}await delay(200);}
 await launch();stoppedContext=await call('context',{runId:run.runId});assert.equal(stoppedContext.run.state,'closed');assert(stoppedContext.stop.completedAt);
 assert.equal((await call('operation',{operationId:'portable-stop'})).state,'confirmed');
 report.checks.push('Full ordinary EXE/backend restart retains stopped archive and original stop receipt without restoring revoked member endpoints');
 report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code,message:e.code==='ENOENT'?'Private IPC endpoint was not ready.':'Ordinary portable lifecycle check failed; isolated original state retained.'};process.exitCode=1;}).finally(async()=>{try{await closeWindow();}catch{}try{await client?.request('shutdown');}catch{}client?.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
