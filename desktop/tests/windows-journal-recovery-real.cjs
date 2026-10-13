// Normal portable window, isolated desktop journal, original WSL parent.
// No debug interface and no prompt/control submission.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process');
if(process.platform!=='win32')throw Error('Windows Node required');
const base=process.argv[2],version='0.4.7';if(!base)throw Error('Isolated output directory required');
const daily=path.join(process.env.APPDATA,'agentbridge-desktop');
const evidence=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../artifacts/I04G-existing-journal-recovery.json'),'utf8'));
assert.equal(evidence.status,'passed');
const oldRows=JSON.parse(fs.readFileSync(path.join(daily,path.posix.basename(evidence.backup)),'utf8'));
const row=oldRows.find(r=>r.id===evidence.requestId);assert.equal(row.state,'unknown');
const profile=path.join(base,'I04G-portable-recovery-'+Date.now().toString(16));fs.mkdirSync(path.join(profile,'windows'),{recursive:true});
const before=JSON.parse(fs.readFileSync(path.join(daily,'windows/claude-state.json'),'utf8'));
fs.writeFileSync(path.join(profile,'windows/claude-state.json'),JSON.stringify({...before,tasks:[],conversations:[],requests:{},operations:{}}));
for(const f of ['machines.json','desktop.json'])fs.copyFileSync(path.join(daily,f),path.join(profile,f));
fs.writeFileSync(path.join(profile,'pending.json'),JSON.stringify([row]));
const report={date:new Date().toISOString(),version,status:'running',scope:'normal portable launch; isolated journal; real WSL readonly recovery',profile,checks:{},errors:[]};
const output=path.resolve(__dirname,'../../artifacts/I04G-portable-recovery.json');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const children=pid=>new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${pid} -and $_.Name -eq 'AgentBridge.exe'} | Select-Object ProcessId,ParentProcessId,ExecutablePath | ConvertTo-Json -Compress`],{windowsHide:true,timeout:15000},(e,o)=>e?reject(e):resolve(o.trim()?JSON.parse(o):null)));
let wrapper;
(async()=>{
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
 wrapper=spawn(path.join(base,`AgentBridge-${version}-Windows-x64.exe`),[],{env,cwd:base,stdio:'ignore'});
 const start=Date.now(),deadline=start+120000;
 while(Date.now()<deadline){
  let runtime;try{runtime=JSON.parse(fs.readFileSync(path.join(profile,'runtime.json'),'utf8'));}catch{}
  const resolved=JSON.parse(fs.readFileSync(path.join(profile,'pending.json'),'utf8'))[0];
  if(runtime?.version===version&&Date.parse(runtime.time)>=start&&resolved?.state==='rejected'){
   assert.equal(resolved.id,row.id);assert.equal(resolved.machineId,row.machineId);assert.deepEqual(resolved.params,row.params);
   assert.equal(resolved.result.code,'CONVERSATION_BINDING');assert(resolved.reconciledAt);
   report.snapshot=runtime;report.checks.normalWindowAutoReconciledOriginalRecord=true;report.checks.originalIdentityAndContentPreserved=true;
   const state=JSON.parse(fs.readFileSync(path.join(profile,'windows/claude-state.json'),'utf8'));assert.equal(state.tasks.length,0);report.checks.noWindowsTaskSubmitted=true;
   const after=JSON.parse(fs.readFileSync(path.join(daily,'windows/claude-state.json'),'utf8'));assert.deepEqual(after.requests,before.requests);assert.deepEqual(after.instances.map(i=>i.model),before.instances.map(i=>i.model));report.checks.dailyWindowsRequestsAndModelsPreserved=true;
   report.status='passed';return;
  }
  await delay(400);
 }
 throw Error('Old journal record was not automatically recovered');
})().catch(e=>{report.status='failed';report.errors.push(e.stack);process.exitCode=1;}).finally(async()=>{
 if(wrapper?.pid){try{const list=await children(wrapper.pid);for(const c of (Array.isArray(list)?list:list?[list]:[])){if(c.ParentProcessId===wrapper.pid)process.kill(c.ProcessId);}}catch(e){report.cleanupError=e.message;}}
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
});
