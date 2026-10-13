// Ordinary portable launch with isolated desktop data, existing installations,
// and metadata only. No debug interface, prompt submission, or model changes.
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process');
if(process.platform!=='win32')throw Error('Windows Node required');
const base=process.argv[2], version='0.4.5';
if(!base)throw Error('Windows output directory required');
const profile=path.join(base,'I04E-portable-health-'+Date.now().toString(16));fs.mkdirSync(path.join(profile,'windows'),{recursive:true});
const daily=path.join(process.env.APPDATA,'agentbridge-desktop');
const state=JSON.parse(fs.readFileSync(path.join(daily,'windows/claude-state.json'),'utf8'));
const dailyModel=JSON.stringify(state.instances.map(i=>i.model));
const baseline=fs.readFileSync(path.join(daily,'windows/claude-state.json'));
fs.writeFileSync(path.join(profile,'windows/claude-state.json'),JSON.stringify({...state,tasks:[],conversations:[],requests:{},operations:{},instances:state.instances.map(i=>({...i,check:undefined,verification:undefined}))}));
fs.copyFileSync(path.join(daily,'machines.json'),path.join(profile,'machines.json'));
fs.copyFileSync(path.join(daily,'desktop.json'),path.join(profile,'desktop.json'));
const report={date:new Date().toISOString(),version,status:'running',scope:'normal portable launch; isolated desktop profile; real tool metadata; no model call',profile,checks:{},errors:[]};
const output=path.resolve(__dirname,'../../artifacts/I04E-portable-health.json');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const children=pid=>new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${pid} -and $_.Name -eq 'AgentBridge.exe'} | Select-Object ProcessId,ParentProcessId,ExecutablePath | ConvertTo-Json -Compress`],{windowsHide:true,timeout:15000},(e,o)=>e?reject(e):resolve(o.trim()?JSON.parse(o):null)));
let wrapper;
(async()=>{
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
 wrapper=spawn(path.join(base,`AgentBridge-${version}-Windows-x64.exe`),[],{cwd:base,env,stdio:'ignore'});
 const start=Date.now(),end=start+120000;
 while(Date.now()<end){
  let runtime;try{runtime=JSON.parse(fs.readFileSync(path.join(profile,'runtime.json'),'utf8'));}catch{}
  if(runtime?.version===version&&Date.parse(runtime.time)>=start&&runtime.machines.every(m=>m.online)&&runtime.connections.every(c=>c.healthy)){
   assert(runtime.machines.some(m=>m.kind==='windows'));assert(runtime.machines.some(m=>m.kind==='wsl'));assert.equal(runtime.instances,2);
   report.snapshot=runtime;report.checks.normalPortableReceivesFreshSnapshot=true;report.checks.windowsAndWslMetadataHealthy=true;
   const cloned=JSON.parse(fs.readFileSync(path.join(profile,'windows/claude-state.json'),'utf8'));
   assert.equal(JSON.stringify(cloned.instances.map(i=>i.model)),dailyModel);
   assert.equal(cloned.tasks.length,0);report.checks.noWindowsPromptOrModelChange=true;
   const originalNow=fs.readFileSync(path.join(daily,'windows/claude-state.json'));
   // The user's running window may refresh check timestamps. Compare task
   // receipts and model configuration instead of requiring identical bytes.
   const prior=JSON.parse(baseline),current=JSON.parse(originalNow);
   assert.deepEqual(current.requests,prior.requests);assert.equal(JSON.stringify(current.instances.map(i=>i.model)),dailyModel);
   report.checks.dailyRequestsAndModelPreserved=true;report.status='passed';return;
  }
  await delay(400);
 }
 throw Error('No healthy fresh snapshot from portable launch');
})().catch(e=>{report.status='failed';report.errors.push(e.stack);process.exitCode=1;}).finally(async()=>{
 if(wrapper?.pid){try{const child=await children(wrapper.pid);for(const c of (Array.isArray(child)?child:child?[child]:[])){if(c.ParentProcessId===wrapper.pid)process.kill(c.ProcessId);}}catch(e){report.cleanupError=e.message;}}
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
});
