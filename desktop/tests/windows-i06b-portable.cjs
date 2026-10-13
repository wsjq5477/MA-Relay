// Manual normal Windows portable launch. Fresh Windows/WSL state; no prompts.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{createHash}=require('node:crypto');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
const version=require('../package.json').version,profile=fs.mkdtempSync(path.join(os.tmpdir(),'ab-i06b-portable-'));
const source=path.resolve(__dirname,`../release/AgentBridge-${version}-Windows-x64.exe`),exe=path.join(profile,path.basename(source));
const linuxDirectory='/tmp/'+path.basename(profile);
fs.mkdirSync('\\\\wsl.localhost\\Ubuntu'+linuxDirectory.replaceAll('/','\\'),{recursive:true});
fs.writeFileSync(path.join(profile,'desktop.json'),JSON.stringify({distribution:'Ubuntu',directory:linuxDirectory,theme:'system'}));
fs.copyFileSync(source,exe);
const output=process.env.AGENTBRIDGE_PORTABLE_REPORT?path.resolve(process.env.AGENTBRIDGE_PORTABLE_REPORT):path.resolve(__dirname,'../../artifacts/graph-check',version,'portable.json');
const report={date:new Date().toISOString(),version,environment:'Windows ordinary portable EXE / fresh isolated Windows and WSL state',status:'running',checks:[],submittedNativePrompts:0};
const delay=ms=>new Promise(r=>setTimeout(r,ms));let wrapper,main,client;
const ps=command=>new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:20000},(e,o)=>e?reject(e):resolve(o.trim())));
async function launch(){
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
 wrapper=spawn(exe,[],{env,stdio:'ignore'});const deadline=Date.now()+120000;
 while(Date.now()<deadline){
  if(fs.existsSync(path.join(profile,'runtime.json'))){
   const text=await ps(`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${wrapper.pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;command=$_.CommandLine;title=(Get-Process -Id $_.ProcessId).MainWindowTitle}} | ConvertTo-Json -Compress`);
   const rows=text?JSON.parse(text):[];main=(Array.isArray(rows)?rows:[rows]).find(p=>p.title==='AgentBridge');
   if(main){assert(!/remote-debugging|--inspect/.test(main.command));client=new CoordinatorClient({directory:profile});await client.attach();assert.equal(client.info.version,version);return;}
  }
  await delay(1000);
 }
 throw Error('Portable did not open a normal window and versioned Coordinator');
}
async function closeWindow(){if(!main)return;assert.equal(main.parent,wrapper.pid);await ps(`(Get-Process -Id ${main.pid}).CloseMainWindow() | Out-Null`);const end=Date.now()+30000;while(Date.now()<end&&wrapper.exitCode===null)await delay(200);assert.notEqual(wrapper.exitCode,null);main=null;}
(async()=>{
 assert.equal(process.platform,'win32');await launch();
 const pid=client.info.pid;
 const frozen=fs.readdirSync(path.join(profile,'coordinator/versions')).find(n=>n.startsWith(version+'-'));
 for(const name of ['agent-network.cjs','machine-router.cjs','graph-layout.cjs','graph-operations.cjs']){const file=path.join(profile,'coordinator/versions',frozen,'desktop/electron',name);assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../electron',name))).digest('hex'));}
 await delay(1200);const layoutBefore=JSON.parse(fs.readFileSync(path.join(profile,'graph-layout.json'))).layout;assert(Object.keys(layoutBefore.groups).length);assert(Object.keys(layoutBefore.nodes).length);
 report.checks.push('Ordinary portable window and current version Coordinator start without debug flags; frozen graph/router/authorization modules match final source; real renderer saves initial graph layout');
 await closeWindow();client.close();client=new CoordinatorClient({directory:profile});await client.attach();assert.equal(client.info.pid,pid);
 report.checks.push('Normal window/wrapper close preserves the same frozen Coordinator');
 await launch();assert.equal(client.info.pid,pid);
 const state=JSON.parse(fs.readFileSync(path.join(profile,'agent-network.json')));assert.equal(state.requests.length,0);assert.equal(state.delegations.length,0);await delay(1200);const layoutAfter=JSON.parse(fs.readFileSync(path.join(profile,'graph-layout.json'))).layout;assert.deepEqual(layoutAfter.groups,layoutBefore.groups);assert.deepEqual(layoutAfter.nodes,layoutBefore.nodes);
 report.checks.push('Ordinary reopen uses the same Coordinator and same graph positions; no submitted native prompts or delegations');report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code,message:e.message};process.exitCode=1;}).finally(async()=>{
 try{await closeWindow();}catch{}try{await client?.request('shutdown');}catch{}client?.close();
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
});
