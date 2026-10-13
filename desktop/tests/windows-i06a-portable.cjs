/* eslint-disable @typescript-eslint/no-require-imports -- Standalone normal Windows portable acceptance. */
// Normal executable launch; no Playwright/debug arguments or model submissions. Uses only the isolated real-test profile.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{CoordinatorClient}=require('../electron/coordinator-client.cjs');
const version=require('../package.json').version,profile=fs.readFileSync(path.resolve(__dirname,'../../.agentbridge-dev/i06a-windows-profile.txt'),'utf8').trim();
const native=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../artifacts/I06A-real/report.json'),'utf8')).native;
const source=path.resolve(__dirname,`../release/AgentBridge-${version}-Windows-x64.exe`),exe=path.join(os.tmpdir(),path.basename(source));fs.copyFileSync(source,exe);
const report={date:new Date().toISOString(),version,scope:'ordinary Windows portable EXE launch, close and reopen; existing isolated real SSH history; no debugging interface or new prompts',checks:[],errors:[]};
const delay=ms=>new Promise(r=>setTimeout(r,ms));let wrapper,main,client;
function ps(command){return new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:20000},(e,o)=>e?reject(e):resolve(o.trim())));}
async function launch(){
 const started=Date.now(),env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
 wrapper=spawn(exe,[],{env,stdio:'ignore'});
 const deadline=Date.now()+180000;
 while(Date.now()<deadline){
  let runtime;try{runtime=JSON.parse(fs.readFileSync(path.join(profile,'runtime.json'),'utf8'));}catch{}
  if(runtime?.version===version&&Date.parse(runtime.time)>=started&&runtime.machines?.some(m=>m.kind==='ssh'&&m.online)){
   const text=await ps(`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${wrapper.pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;exe=$_.ExecutablePath;command=$_.CommandLine;title=(Get-Process -Id $_.ProcessId).MainWindowTitle}} | ConvertTo-Json -Compress`);
   const rows=text?JSON.parse(text):[];main=(Array.isArray(rows)?rows:[rows]).find(p=>p.title==='AgentBridge');
   if(main){assert(!/remote-debugging|--inspect/.test(main.command));client=new CoordinatorClient({directory:profile});await client.open();return runtime;}
  }
  await delay(1000);
 }
 throw Error('Portable window did not receive a fresh online SSH snapshot');
}
async function closeWindow(){
 if(!main)return;
 assert.equal(main.parent,wrapper.pid);
 await ps(`(Get-Process -Id ${main.pid} -ErrorAction Stop).CloseMainWindow() | Out-Null`);
 const deadline=Date.now()+30000;while(Date.now()<deadline&&wrapper.exitCode===null)await delay(300);
 assert.notEqual(wrapper.exitCode,null,'Portable wrapper must exit after normal window close');main=null;
}
async function original(){
 const task=await client.request('call',{method:'ipc',params:{op:'task',machineId:native.firstTaskId.split('::')[0],taskId:native.firstTaskId}});assert(task.ok);assert.equal(task.result.native.sessionId,native.firstSessionId);assert.equal(task.result.status,'succeeded');
 return task.result;
}
(async()=>{
 assert.equal(process.platform,'win32');assert(native?.markerReturnedBothRounds);
 const before=JSON.parse(fs.readFileSync(path.join(profile,'agent-network.json'),'utf8')).requests.length;
 const first=await launch(),pid=client.info.pid,owner=client.info.coordinatorId;await original();
 report.checks.push('Normal portable EXE receives actual Windows/WSL/SSH metadata and original Linux task; no inspector or remote-debugging flags');
 await closeWindow();client.close();client=new CoordinatorClient({directory:profile});await client.open();assert.equal(client.info.pid,pid);await original();
 report.checks.push('Portable window/extraction wrapper exit leaves frozen Coordinator and original task readable');
 const second=await launch();assert.equal(client.info.pid,pid);assert.equal(client.info.coordinatorId,owner);await original();assert.equal(second.tasks,first.tasks);
 const after=JSON.parse(fs.readFileSync(path.join(profile,'agent-network.json'),'utf8')).requests.length;assert.equal(after,before);
 report.checks.push('Ordinary reopen reuses same Coordinator/identity and task count; request count unchanged, no prompts submitted');
 report.status='passed';
})().catch(e=>{report.status='failed';report.errors.push({code:e.code||'VERIFY_FAILED',message:e.message});process.exitCode=1;}).finally(async()=>{
 try{await closeWindow();}catch{}try{await client?.request('shutdown');}catch{}client?.close();
 fs.writeFileSync(path.resolve(__dirname,'../../artifacts/I06A-final/portable.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
});
