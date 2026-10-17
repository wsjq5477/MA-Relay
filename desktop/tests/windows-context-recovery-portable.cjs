// Ordinary EXE, production Windows routing and retained synthetic Codex receipt.
// No installed CLI is launched and no model prompt is submitted.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{createHash}=require('node:crypto');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
if(process.platform!=='win32')throw Error('Windows required');
const baseline=process.argv.includes('--baseline'),version=baseline?'0.6.0-alpha.24':require('../package.json').version;
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-context-portable-'));
const source=path.resolve(__dirname,`../release/AgentBridge-${version}-Windows-x64.exe`),exe=path.join(directory,path.basename(source));
fs.copyFileSync(source,exe);
const machineId='local-context-fixture',nodeId='node-context-fixture',agentId='retained-agent';
const original='retained-request',missing='unknown-request',taskId='retained-task',conversationId='retained-conversation';
const task={taskId,conversationId,requestId:original,targetAgent:agentId,status:'succeeded',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),lastSeq:0,events:[],result:{message:'Retained synthetic result, never execute'}};
const write=(name,data)=>{const file=path.join(directory,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data));};
write('machines.json',{version:1,localMachineId:machineId,machines:[{machineId,name:'Windows',kind:'windows',platform:'win32'}],connections:[],instances:[]});
write('agent-network.json',{version:1,revision:0,nodes:[{nodeId,machineId,adapter:'codex',name:'Controlled Codex',executable:'C:/controlled-unavailable/codex.exe',connected:true,executionSupported:true}],collaboration:{leaderId:null,memberIds:[],revision:0},requests:[original,missing].map(requestId=>({requestId,machineId,nodeId,dispatched:true,createdAt:task.createdAt})),delegations:[]});
write('pending.json',[original,missing].map(id=>({id,op:'submit',machineId,state:'unknown',time:task.createdAt,params:{op:'submit',nodeId,machineId,requestId:id,message:'Synthetic retained input, never execute'},result:{error:{code:'DESKTOP_TRANSPORT'}}})));
write('windows/node-contexts.json',[
 {contextId:'unfinished',nodeId:'unfinished-node',adapter:'opencode',executable:'C:/controlled-unavailable/opencode.exe',workspace:directory},
 {contextId:'retained',nodeId,adapter:'codex',agentId,executable:'C:/controlled-unavailable/codex.exe',workspace:directory}
]);
write('windows/node-contexts/retained/codex-state.json',{revision:1,agents:[{agentId,adapter:'codex',executable:'C:/controlled-unavailable/codex.exe',workspace:directory,enabled:true}],tasks:[task],conversations:[{conversationId,targetAgent:agentId,turns:1,updatedAt:task.updatedAt}],requests:[{requestId:original,taskId}],operations:[]});
const report={date:new Date().toISOString(),version,baseline,environment:'Windows ordinary no-debug EXE / production coordinator, MachineHost and CodexHost / isolated synthetic records',status:'running',nativePrompts:0,checks:[],portable:{bytes:fs.statSync(exe).size,sha256:createHash('sha256').update(fs.readFileSync(exe)).digest('hex')}};
const output=path.resolve(__dirname,`../../artifacts/windows-context-recovery/2026-10-17/portable-${baseline?'baseline':'candidate'}.json`);
const delay=ms=>new Promise(r=>setTimeout(r,ms));let wrapper,client,main;
const ps=command=>new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:15000},(error,out)=>error?reject(error):resolve(out.trim())));
async function launch(){
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:directory};delete env.ELECTRON_RUN_AS_NODE;
 wrapper=spawn(exe,[],{env,stdio:'ignore'});
 const until=Date.now()+120000;
 while(Date.now()<until){
  if(fs.existsSync(path.join(directory,'runtime.json'))){
   const text=await ps(`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${wrapper.pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;command=$_.CommandLine;title=(Get-Process -Id $_.ProcessId).MainWindowTitle}} | ConvertTo-Json -Compress`);
   const parsed=text?JSON.parse(text):[];main=(Array.isArray(parsed)?parsed:[parsed]).find(p=>p.title==='AgentBridge');
   if(main){assert(!/remote-debugging|--inspect/.test(main.command));const next=new CoordinatorClient({directory});try{await next.attach();client=next;assert.equal(client.info.version,version);return;}catch(error){next.close();if(!['ENOENT','ECONNREFUSED'].includes(error.code))throw error;}}
  }
  await delay(500);
 }
 throw Error('Ordinary EXE did not open');
}
async function closeWindow(){
 if(!main)return;assert.equal(main.parent,wrapper.pid);
 await ps(`(Get-Process -Id ${main.pid}).CloseMainWindow() | Out-Null`);
 const until=Date.now()+30000;while(Date.now()<until&&wrapper.exitCode===null)await delay(200);
 assert.notEqual(wrapper.exitCode,null);main=null;
}
async function check(){
 const result=await client.request('recoverPending');
 const rows=JSON.parse(fs.readFileSync(path.join(directory,'pending.json')));
 assert.equal(rows.find(r=>r.id===original).state,baseline?'unknown':'confirmed');
 assert.equal(rows.find(r=>r.id===missing).state,'unknown');
 assert.equal(result.items.find(r=>r.id===missing).code,baseline?'NOT_CONFIGURED':'NOT_FOUND');
 if(baseline)assert.equal(result.items.find(r=>r.id===original).code,'NOT_CONFIGURED');
 else assert.equal(rows.find(r=>r.id===original).result.taskId,machineId+'::'+taskId);
 assert.equal((await client.request('pending')).length,baseline?2:1);
 const state=JSON.parse(fs.readFileSync(path.join(directory,'windows/node-contexts/retained/codex-state.json')));
 assert.equal(state.tasks.length,1);assert.equal(state.requests.length,1);
 assert(!fs.existsSync(path.join(directory,'windows/node-contexts/retained/runs')));
 return result;
}
(async()=>{
 await launch();const firstPid=client.info.pid;await check();
 report.checks.push(baseline?'Frozen alpha.24 reproduces NOT_CONFIGURED for both originals despite a retained receipt':'Candidate confirms the retained original receipt and preserves the absent original as unknown');
 await closeWindow();client.close();await launch();assert.equal(client.info.pid,firstPid);await check();
 report.checks.push('Ordinary close and reopen retains the same coordinator and original records');
 await closeWindow();await client.request('shutdown');client.close();
 const until=Date.now()+30000;while(Date.now()<until){try{process.kill(firstPid,0);}catch{break;}await delay(200);}
 await launch();assert.notEqual(client.info.pid,firstPid);await check();
 report.checks.push('Full coordinator restart preserves original identities, unknown protection and zero replay');
 if(!baseline){const frozen=fs.readdirSync(path.join(directory,'coordinator/versions')).find(n=>n.startsWith(version+'-'));assert.equal(createHash('sha256').update(fs.readFileSync(path.join(directory,'coordinator/versions',frozen,'desktop/electron/machine-host.cjs'))).digest('hex'),createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../electron/machine-host.cjs'))).digest('hex'));report.checks.push('Frozen MachineHost matches the corrected source');}
 report.status='passed';
})().catch(error=>{report.status='failed';report.error={code:error.code,message:error.message};process.exitCode=1;}).finally(async()=>{
 try{await closeWindow();}catch{}try{await client?.request('shutdown');}catch{}client?.close();
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
});
