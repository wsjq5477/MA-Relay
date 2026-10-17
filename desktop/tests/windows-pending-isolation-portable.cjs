// Ordinary portable EXE, synthetic original NOT_CONFIGURED intent, Windows only.
// No inspector, no WSL requirement and no native Agent prompt.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{createHash}=require('node:crypto');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
if(process.platform!=='win32')throw Error('Windows required');
const version=require('../package.json').version,profile=fs.mkdtempSync(path.join(os.tmpdir(),'ab-pending-portable-'));
const source=path.resolve(__dirname,`../release/AgentBridge-${version}-Windows-x64.exe`),exe=path.join(profile,path.basename(source));
fs.copyFileSync(source,exe);
const machineId='local-pending-fixture',nodeId='node-pending-fixture',requestId='original-pending-fixture';
const params={op:'submit',nodeId,machineId,requestId,message:'controlled original request; never execute',collaboration:true};
const fingerprint=createHash('sha256').update(JSON.stringify({nodeId,op:params.op,message:params.message,workspace:'',conversationId:'',collaboration:true})).digest('hex');
fs.writeFileSync(path.join(profile,'machines.json'),JSON.stringify({version:1,localMachineId:machineId,machines:[{machineId,name:'Windows',kind:'windows',platform:'win32'}],connections:[],instances:[]}));
fs.writeFileSync(path.join(profile,'agent-network.json'),JSON.stringify({version:1,revision:0,nodes:[{nodeId,machineId,adapter:'opencode',name:'Controlled OpenCode',executable:'C:/controlled-unavailable/opencode.exe',connected:true,executionSupported:true}],collaboration:{leaderId:nodeId,memberIds:[],revision:1},requests:[{requestId,machineId,nodeId,fingerprint,createdAt:new Date().toISOString(),dispatched:false,collaboration:true}],delegations:[]}));
fs.writeFileSync(path.join(profile,'pending.json'),JSON.stringify([{id:requestId,op:'submit',params,machineId,state:'unknown',time:new Date().toISOString(),result:{error:{code:'NOT_CONFIGURED',message:'controlled original configuration error'}}}]));
const output=process.env.AGENTBRIDGE_PENDING_PORTABLE_REPORT||path.resolve(__dirname,'../../artifacts/pending-isolation/2026-10-15/portable.json');
const report={date:new Date().toISOString(),version,environment:`Windows ordinary ${version} portable EXE / synthetic original NOT_CONFIGURED intent / isolated profile`,status:'running',checks:[],nativePrompts:0};
const delay=ms=>new Promise(r=>setTimeout(r,ms));let wrapper,main,client;
const ps=command=>new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:15000},(e,o)=>e?reject(e):resolve(o.trim())));
async function launch(){
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
 wrapper=spawn(exe,[],{env,stdio:'ignore'});const end=Date.now()+120000;
 while(Date.now()<end){
  if(fs.existsSync(path.join(profile,'runtime.json'))){
   const text=await ps(`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${wrapper.pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;command=$_.CommandLine;title=(Get-Process -Id $_.ProcessId).MainWindowTitle}} | ConvertTo-Json -Compress`);
   const parsed=text?JSON.parse(text):[];main=(Array.isArray(parsed)?parsed:[parsed]).find(p=>p.title==='AgentBridge');
   if(main){assert(!/remote-debugging|--inspect/.test(main.command));client=new CoordinatorClient({directory:profile});await client.attach();assert.equal(client.info.version,version);return;}
  }
  await delay(500);
 }
 throw Error('Ordinary portable window did not start');
}
async function closeWindow(){
 if(!main)return;assert.equal(main.parent,wrapper.pid);await ps(`(Get-Process -Id ${main.pid}).CloseMainWindow() | Out-Null`);
 const end=Date.now()+30000;while(Date.now()<end&&wrapper.exitCode===null)await delay(200);assert.notEqual(wrapper.exitCode,null);main=null;
}
(async()=>{
 await launch();const pid=client.info.pid;
 const end=Date.now()+30000;let original;
 while(Date.now()<end){original=JSON.parse(fs.readFileSync(path.join(profile,'pending.json'))).find(r=>r.id===requestId);if(original?.state==='rejected')break;await delay(500);}
 assert.equal(original?.state,'rejected');assert(original.reconciledAt);assert.equal(original.params.message,params.message);
 assert.deepEqual(await client.request('pending'),[]);
 let network=JSON.parse(fs.readFileSync(path.join(profile,'agent-network.json')));assert.equal(network.requests.length,1);assert.equal(network.requests[0].requestId,requestId);assert.equal(network.requests[0].dispatched,false);
 report.checks.push('Normal no-debug EXE automatically reconciles original undispatched configuration rejection to rejected, retaining original identity and content, no execution');
 const frozen=fs.readdirSync(path.join(profile,'coordinator/versions')).find(n=>n.startsWith(version+'-'));
 for(const name of ['worker-runtime.cjs','agent-network.cjs','pending-journal.cjs','coordinator-service.cjs'])assert.equal(createHash('sha256').update(fs.readFileSync(path.join(profile,'coordinator/versions',frozen,'desktop/electron',name))).digest('hex'),createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../electron',name))).digest('hex'));
 report.checks.push('Frozen runtime and original-request recovery modules match current source');
 await closeWindow();client.close();client=new CoordinatorClient({directory:profile});await client.attach();assert.equal(client.info.pid,pid);
 report.checks.push('Ordinary window close preserves same Coordinator after portable wrapper exits');
 await launch();assert.equal(client.info.pid,pid);assert.deepEqual(await client.request('pending'),[]);network=JSON.parse(fs.readFileSync(path.join(profile,'agent-network.json')));assert.equal(network.requests.length,1);assert.equal(network.delegations.length,0);assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'pending.json')))[0].state,'rejected');
 report.checks.push('Ordinary reopen preserves original rejected history with no new requests or delegations');report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code,message:e.message};process.exitCode=1;}).finally(async()=>{
 try{await closeWindow();}catch{}try{await client?.request('shutdown');}catch{}client?.close();
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
});
