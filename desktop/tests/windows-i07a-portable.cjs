// Ordinary no-debug Windows portable EXE, production IPC and SQLite, model 0.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{createHash}=require('node:crypto');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
if(process.platform!=='win32')throw Error('Windows required');
const version=require('../package.json').version,profile=fs.mkdtempSync(path.join(os.tmpdir(),'ab-team-portable-'));
const source=path.resolve(__dirname,`../release/AgentBridge-${version}-Windows-x64.exe`),exe=path.join(profile,path.basename(source));fs.copyFileSync(source,exe);
const output=path.resolve(__dirname,'../../artifacts/I07A/2026-10-15/portable.json');
const report={date:new Date().toISOString(),version,environment:'Windows ordinary portable EXE / real coordinator, IPC, SQLite and local MCP / isolated profile / model 0',status:'running',checks:[],nativePrompts:0};
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
 const team=await call('createTeam',{operationId:'portable-team',name:'便携验证小队',leaderId:agent.agentId,memberIds:[agent.agentId],charter:'仅做连接和消息验证'});
 const run=await call('createRun',{operationId:'portable-run',teamId:team.teamId,name:'保存工作',goal:'保存并读取',acceptance:'消息和文档重开后保留'});
 await call('writeDocument',{operationId:'portable-doc',runId:run.runId,expectedRevision:0,title:'便携共享文档',content:'受控内容',editorIds:[agent.agentId]});
 const connection=await call('connect',{operationId:'portable-connection',runId:run.runId,agentId:agent.agentId});
 let descriptor=JSON.parse(fs.readFileSync(connection.configuration.args[1],'utf8'));
 const tool=async(name,args={})=>{const r=await fetch(descriptor.url,{method:'POST',headers:{authorization:'Bearer '+descriptor.token,'content-type':'application/json'},body:JSON.stringify({name,args})});return r.json();};
 assert((await tool('team_post_message',{operationId:'portable-member-message',content:'来自外部成员的公开报告'})).result.messageId);
 const view=await call('context',{runId:run.runId});assert.equal(view.documents[0].title,'便携共享文档');assert(view.messages.some(m=>m.content==='来自外部成员的公开报告'));report.checks.push('Ordinary EXE uses embedded SQLite for registry, team, work, document and member-authenticated public report');
 const frozen=fs.readdirSync(path.join(profile,'coordinator/versions')).find(n=>n.startsWith(version+'-'));
 for(const name of ['team-space.cjs','team-tools.cjs','collaboration-broker.cjs','mcp-client.cjs','coordinator-service.cjs'])assert.equal(createHash('sha256').update(fs.readFileSync(path.join(profile,'coordinator/versions',frozen,'desktop/electron',name))).digest('hex'),createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../electron',name))).digest('hex'));
 report.checks.push('Frozen team and MCP resources exactly match current source');
 await closeWindow();client.close();client=new CoordinatorClient({directory:profile});await client.attach();assert.equal(client.info.pid,coordinatorPid);assert((await call('context',{runId:run.runId})).messages.some(m=>m.content==='来自外部成员的公开报告'));report.checks.push('Closing the ordinary window preserves the same coordinator and public workspace');
 await launch();assert.equal(client.info.pid,coordinatorPid);await closeWindow();await client.request('shutdown');client.close();
 const until=Date.now()+30000;while(Date.now()<until){try{process.kill(coordinatorPid,0);}catch{break;}await delay(200);}
 await launch();assert.notEqual(client.info.pid,coordinatorPid);
 const recovered=await call('context',{runId:run.runId});assert.equal(recovered.documents[0].content,'受控内容');descriptor=JSON.parse(fs.readFileSync(connection.configuration.args[1],'utf8'));assert((await tool('team_context')).result.run.runId===run.runId);
 report.checks.push('Full backend restart preserves history and refreshes the original private MCP endpoint without reissuing work');report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code,message:e.code==='ENOENT'?'Private IPC endpoint was not ready.':'Ordinary portable lifecycle check failed; isolated original state retained.'};process.exitCode=1;}).finally(async()=>{try{await closeWindow();}catch{}try{await client?.request('shutdown');}catch{}client?.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
