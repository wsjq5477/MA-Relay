// Manual real-device acceptance. This sends two bounded prompts only when explicitly run.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{randomUUID,createHash}=require('node:crypto');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
if(process.platform!=='win32')throw Error('Windows required');
const source=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]),planFile=output+'.private-plan.json';
if(fs.existsSync(planFile))throw Error('Original debug plan already exists. Query its original request IDs; do not replay.');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-opendesk-packaged-live-')),exe=path.join(directory,'candidate.exe'),machineId='desktop-live-machine';
fs.copyFileSync(source,exe);
const plan={directory,first:randomUUID(),second:randomUUID(),marker:'BRIDGE_CHECK_'+randomUUID().replaceAll('-','').slice(0,12)};fs.writeFileSync(planFile,JSON.stringify(plan),{mode:0o600});
fs.writeFileSync(path.join(directory,'desktop.json'),JSON.stringify({theme:'light',distribution:'',directory:'/tmp/'+path.basename(directory)}));
fs.writeFileSync(path.join(directory,'machines.json'),JSON.stringify({version:1,localMachineId:machineId,machines:[{machineId,name:'Windows desktop live check',kind:'windows',platform:'win32'}],connections:[],instances:[]}));
const report={date:new Date().toISOString(),version:require('../package.json').version,environment:'Windows ordinary AgentBridge EXE / production Coordinator and MachineHost / installed OpenDesk Desktop 0.3.9',status:'running',bridgeSubmissions:0,checks:[],portable:{bytes:fs.statSync(exe).size,sha256:createHash('sha256').update(fs.readFileSync(exe)).digest('hex')}};
const delay=ms=>new Promise(r=>setTimeout(r,ms));let wrapper,main,client,allTerminal=false;
const ps=script=>new Promise((resolve,reject)=>execFile(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:15000},(e,out)=>e?reject(e):resolve(out.trim())));
async function launch(){
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:directory};delete env.ELECTRON_RUN_AS_NODE;wrapper=spawn(exe,[],{env,stdio:'ignore'});
 const end=Date.now()+120000;
 while(Date.now()<end){
  if(fs.existsSync(path.join(directory,'coordinator-status.json'))){
   const raw=await ps(`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${wrapper.pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;command=$_.CommandLine;title=(Get-Process -Id $_.ProcessId).MainWindowTitle}} | ConvertTo-Json -Compress`);
   const rows=raw?JSON.parse(raw):[];main=(Array.isArray(rows)?rows:[rows]).find(r=>r.title==='AgentBridge');
   if(main){assert(!/remote-debugging|--inspect/.test(main.command));client=new CoordinatorClient({directory});await client.attach();assert.equal(client.info.version,report.version);return;}
  }
  await delay(400);
 }
 throw Error('Ordinary EXE did not open');
}
async function closeWindow(){if(!main)return;assert.equal(main.parent,wrapper.pid);await ps(`(Get-Process -Id ${main.pid}).CloseMainWindow() | Out-Null`);const until=Date.now()+30000;while(Date.now()<until&&wrapper.exitCode===null)await delay(200);assert.notEqual(wrapper.exitCode,null);main=null;}
async function call(method,params={}){const r=await client.request('call',{method,params});if(!r.ok)throw Object.assign(Error(r.error.message),{code:r.error.code});return r.result;}
async function wait(requestId){const end=Date.now()+180000;while(Date.now()<end){const task=await call('ipc',{op:'request',machineId,requestId});if(['succeeded','failed','cancelled','unknown'].includes(task.status))return task;await delay(400);}throw Error('Original native request remains pending; do not replay');}
(async()=>{
 await launch();report.checks.push('ordinary EXE opens with production Coordinator and no debug flags');
 let snapshot=await call('snapshot');let node=snapshot.nodes.find(n=>n.machineId===machineId&&n.adapter==='opendesk-desktop');
 assert(node,'OpenDesk desktop must be discovered on the Windows machine');report.discoveredHealthy=node.healthy;assert.equal(node.executionSupported,true);
 const attached=await call('manageNode',{operationId:randomUUID(),action:'attach',nodeId:node.nodeId,machineId});assert.equal(attached.state,'confirmed');report.checks.push('production inventory discovers and attaches the installed native Desktop gateway');
 const input={op:'submit',nodeId:node.nodeId,requestId:plan.first,message:'这是 AgentBridge EXE 接入验证。请记住测试字符串 '+plan.marker+'，只回复“已记住”。不要调用工具或读取、修改文件。',collaboration:false};
 const accepted=await call('nodeRequest',input);report.bridgeSubmissions++;plan.taskId=accepted.taskId;plan.conversationId=accepted.conversationId;fs.writeFileSync(planFile,JSON.stringify(plan),{mode:0o600});
 let task=await wait(plan.first);report.firstStatus=task.status;assert.equal(task.status,'succeeded','First original native request did not complete');assert.equal((await call('nodeRequest',input)).taskId,accepted.taskId);report.checks.push('packaged Node request reaches a real desktop model result; duplicate request returns original task');
 const coordinator=client.info.pid;await closeWindow();client.close();await launch();assert.equal(client.info.pid,coordinator);task=await call('ipc',{op:'request',machineId,requestId:plan.first});assert.equal(task.status,'succeeded');assert.equal(task.taskId,accepted.taskId);
 const conversation=await call('ipc',{op:'conversation',machineId,conversationId:accepted.conversationId});assert.equal(conversation.canContinue,true);report.checks.push('window reopen preserves original result and native connection without resubmission');
 await call('nodeRequest',{op:'continue',nodeId:node.nodeId,conversationId:accepted.conversationId,requestId:plan.second,message:'请只回复上一轮记住的测试字符串，不要调用任何工具或读写文件。',collaboration:false});report.bridgeSubmissions++;
 task=await wait(plan.second);report.secondStatus=task.status;report.originalContextMatched=task.result?.message?.includes(plan.marker)===true;assert.equal(task.status,'succeeded');assert.equal(report.originalContextMatched,true);report.checks.push('packaged continuation after window reopen recalls the original native conversation');allTerminal=true;report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code,message:e.message};process.exitCode=1;}).finally(async()=>{
 try{await closeWindow();}catch{}
 if(allTerminal){
  const contexts=path.join(directory,'windows/node-contexts');
  if(fs.existsSync(contexts))for(const name of fs.readdirSync(contexts)){const f=path.join(contexts,name,'opendesk-existing-v2/controller.json');if(fs.existsSync(f)){const owner=JSON.parse(fs.readFileSync(f));if(owner.protocol==='opendesk-existing-v1')try{process.kill(owner.pid,'SIGTERM');}catch{}}}
  try{await client?.request('shutdown');}catch{}
 }
 client?.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
});
