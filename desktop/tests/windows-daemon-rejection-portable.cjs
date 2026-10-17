// Ordinary Windows EXE, isolated synthetic profiles, production recovery, model 0.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{createHash}=require('node:crypto');
const {digest}=require('../electron/graph-layout.cjs');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
if(process.platform!=='win32')throw Error('Windows required');
const version=require('../package.json').version,directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-daemon-rejection-portable-'));
const source=path.resolve(__dirname,`../release/AgentBridge-${version}-Windows-x64.exe`),exe=path.join(directory,path.basename(source));
fs.copyFileSync(source,exe);
const machineId='synthetic-machine',nodeId='synthetic-node',agentId='synthetic-agent',taskId='synthetic-task',original='synthetic-original';
const conversationId='synthetic-conversation',legacy='synthetic-rename',missing='synthetic-missing',time='2020-01-01T00:00:00Z';
const task={taskId,conversationId,requestId:original,targetAgent:agentId,status:'unknown',createdAt:time,updatedAt:time,turn:1,lastSeq:1,offset:0,events:[{seq:1,timestamp:time,event:{kind:'accepted'}}]};
const write=(name,data)=>{const file=path.join(directory,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data));};
const params=id=>({op:'submit',nodeId,machineId,requestId:id,message:'Synthetic input; never execute',collaboration:false});
const fingerprint=p=>createHash('sha256').update(JSON.stringify({nodeId,op:p.op,message:p.message,workspace:'',conversationId:'',collaboration:false})).digest('hex');
write('desktop.json',{theme:'light',distribution:'',directory:'/tmp/'+path.basename(directory)});
write('machines.json',{version:1,localMachineId:machineId,machines:[{machineId,name:'Synthetic Windows',kind:'windows',platform:'win32'}],connections:[],instances:[]});
write('agent-network.json',{version:1,revision:0,nodes:[{nodeId,machineId,adapter:'codex',executable:'C:/synthetic/never-execute.exe',connected:true,executionSupported:true}],collaboration:{leaderId:null,memberIds:[],revision:0},requests:[{requestId:original,machineId,nodeId,dispatched:true,taskId,conversationId},{requestId:legacy,machineId,nodeId,dispatched:false,collaboration:false,fingerprint:fingerprint(params(legacy)),inputFingerprint:fingerprint(params(legacy))}],delegations:[]});
const target=path.join(directory,'agent-network.json'),temporary=target+'.12345678-1234-4234-8234-123456789abc.tmp';
write('pending.json',[legacy,missing].map(id=>({id,op:'submit',machineId,state:'unknown',time,params:params(id),result:{error:id===legacy?{code:'EPERM',message:`EPERM: operation not permitted, rename '${temporary}' -> '${target}'`}:{code:'DESKTOP_TRANSPORT',message:'Synthetic unavailable receipt'}}})));
write('windows/node-contexts.json',[{contextId:'retained',nodeId,adapter:'codex',agentId,executable:'C:/synthetic/never-execute.exe',workspace:directory}]);
write('windows/node-contexts/retained/codex-state.json',{revision:1,agents:[{agentId,adapter:'codex',executable:'C:/synthetic/never-execute.exe',workspace:directory,enabled:true}],tasks:[task],conversations:[{conversationId,targetAgent:agentId,turns:1,lastTaskId:taskId}],requests:[{requestId:original,taskId}],operations:[]});
write('windows/node-contexts/retained/runs/'+taskId+'/job.json',{executable:'C:/synthetic/never-execute.exe',workspace:directory,message:'Synthetic original; never execute'});
// Synthetic previously authenticated proof exercises persisted recovery in the
// frozen EXE. Live provenance is separately tested over real TCP SSH on Linux.
const remoteMachine='ssh-synthetic-daemon',remoteNode='synthetic-remote-node',remoteRequest='synthetic-remote-rejected';
const remoteParams={op:'submit',nodeId:remoteNode,machineId:remoteMachine,requestId:remoteRequest,message:'Synthetic remote original; never execute'};
const remoteFingerprint=createHash('sha256').update(JSON.stringify({nodeId:remoteNode,op:'submit',message:remoteParams.message,workspace:'',conversationId:'',collaboration:false})).digest('hex');
const catalog=JSON.parse(fs.readFileSync(path.join(directory,'machines.json')));catalog.machines.push({machineId:remoteMachine,kind:'ssh',daemonId:'synthetic-daemon',profileId:'synthetic-profile'});write('machines.json',catalog);
const network=JSON.parse(fs.readFileSync(path.join(directory,'agent-network.json')));network.nodes.push({nodeId:remoteNode,machineId:remoteMachine,adapter:'opencode',connected:true,executionSupported:true});
network.requests.push({requestId:remoteRequest,machineId:remoteMachine,nodeId:remoteNode,agentId:remoteMachine+'::synthetic-agent',fingerprint:remoteFingerprint,inputFingerprint:remoteFingerprint,dispatched:false,preparationRejection:'NOT_CONFIGURED',daemonRejection:{version:1,source:'daemon.receiptRead',machineId:remoteMachine,daemonId:'synthetic-daemon',profileId:'synthetic-profile',requestId:remoteRequest,op:'submit',code:'NOT_CONFIGURED',target:{agentId:'synthetic-agent'},fingerprint:digest({method:'ipc',params:{op:'submit',agentId:'synthetic-agent',requestId:remoteRequest,message:remoteParams.message}})}});write('agent-network.json',network);
const pending=JSON.parse(fs.readFileSync(path.join(directory,'pending.json')));pending.push({id:remoteRequest,op:'submit',machineId:remoteMachine,state:'unknown',time,params:remoteParams});write('pending.json',pending);
const report={date:new Date().toISOString(),version,environment:'Windows ordinary no-debug EXE / production coordinator, network and Codex / synthetic records',status:'running',nativePrompts:0,checks:[],portable:{bytes:fs.statSync(exe).size,sha256:createHash('sha256').update(fs.readFileSync(exe)).digest('hex')}};
const output=path.resolve(__dirname,'../../artifacts/daemon-rejection-recovery/2026-10-17/portable.json');
const delay=ms=>new Promise(r=>setTimeout(r,ms));let wrapper,client,main;
const ps=command=>new Promise((resolve,reject)=>execFile(path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:15000},(error,out)=>error?reject(error):resolve(out.trim())));
async function launch(){
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:directory};delete env.ELECTRON_RUN_AS_NODE;
 wrapper=spawn(exe,[],{env,stdio:'ignore'});
 const until=Date.now()+120000;
 while(Date.now()<until){
  if(fs.existsSync(path.join(directory,'coordinator-status.json'))){
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
 await client.request('recoverPending');
 const rows=JSON.parse(fs.readFileSync(path.join(directory,'pending.json')));
 assert.equal(rows.find(r=>r.id===legacy).state,'rejected');
 assert.equal(rows.find(r=>r.id===missing).state,'unknown');
 const remote=rows.find(r=>r.id===remoteRequest);assert.equal(remote.state,'rejected');assert.equal(remote.time,time);assert.deepEqual(remote.params,remoteParams);assert.equal(remote.result.error.code,'NOT_CONFIGURED');
 const kept=JSON.parse(fs.readFileSync(path.join(directory,'agent-network.json'))).requests.find(r=>r.requestId===remoteRequest);assert.equal(kept.dispatched,false);assert.equal(kept.taskId,undefined);
 const reply=await client.request('call',{method:'ipc',params:{op:'reconcile',machineId,taskId:machineId+'::'+taskId}});
 assert.equal(reply.ok,true,JSON.stringify(reply.error));assert.equal(reply.result.state,'confirmed');assert.equal(reply.result.data.status,'failed');
 const state=JSON.parse(fs.readFileSync(path.join(directory,'windows/node-contexts/retained/codex-state.json')));
 assert.equal(state.tasks.length,1);assert.equal(state.requests.length,1);assert.equal(state.tasks[0].status,'failed');assert.equal(state.tasks[0].error.code,'CODEX_START');
 assert.deepEqual(fs.readdirSync(path.join(directory,'windows/node-contexts/retained/runs',taskId)),['job.json']);
 assert(!fs.existsSync(path.join(directory,'windows/node-contexts/retained/runtime')));
 assert.equal((await client.request('pending')).length,1);
}
(async()=>{
 await launch();const firstPid=client.info.pid;await check();
 report.checks.push('Production Codex reconciliation ends only the original undispatched task; run evidence remains job.json only');
 report.checks.push('Exact local legacy EPERM receipt settles rejected; missing original receipt remains unknown');
 report.checks.push('Persisted synthetic daemon proof settles only the original SSH request; ID, parameters and time remain unchanged');
 await closeWindow();client.close();await launch();assert.equal(client.info.pid,firstPid);await check();
 report.checks.push('Ordinary window close/reopen retains the same coordinator and performs no replay');
 await closeWindow();await client.request('shutdown');client.close();
 const until=Date.now()+30000;while(Date.now()<until){try{process.kill(firstPid,0);}catch{break;}await delay(200);}
 await launch();assert.notEqual(client.info.pid,firstPid);await check();
 report.checks.push('Full coordinator restart preserves terminal originals, missing-receipt protection and zero replay');
 const frozen=fs.readdirSync(path.join(directory,'coordinator/versions')).find(n=>n.startsWith(version+'-'));
 for(const name of ['daemon-rejection.cjs','ssh-host.cjs','agent-network.cjs','coordinator-service.cjs','pending-journal.cjs'])assert.equal(createHash('sha256').update(fs.readFileSync(path.join(directory,'coordinator/versions',frozen,'desktop/electron',name))).digest('hex'),createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../electron',name))).digest('hex'));
 report.checks.push('All five frozen corrected backend modules match the current source');report.status='passed';
})().catch(error=>{report.status='failed';report.error={code:error.code,message:error.message};process.exitCode=1;}).finally(async()=>{
 try{await closeWindow();}catch{}try{await client?.request('shutdown');}catch{}client?.close();
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
});
