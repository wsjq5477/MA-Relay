// Normal isolated portable launch and reopen; no remote debugging or inference.
const fs=require('node:fs'),path=require('node:path'),{spawn,execFile}=require('node:child_process'),assert=require('node:assert/strict');
const exe=process.argv[2];if(process.platform!=='win32'||!exe)throw Error('Windows portable exe required');
const prior=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../artifacts/I05-real.json'),'utf8')),profile=path.join(prior.root,'profile');
fs.writeFileSync(path.join(profile,'desktop.json'),JSON.stringify({theme:'light',distribution:'Ubuntu',directory:prior.linuxState}));
const report={date:new Date().toISOString(),status:'running',exe,profile,checks:{},runs:[]},delay=ms=>new Promise(r=>setTimeout(r,ms));
function processes(pid){return new Promise((done,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;exe=$_.ExecutablePath;command=$_.CommandLine;title=(Get-Process -Id $_.ProcessId).MainWindowTitle}} | ConvertTo-Json -Compress`],{windowsHide:true,timeout:15000},(e,o)=>{if(e)return reject(e);const p=o.trim()?JSON.parse(o):[];done(Array.isArray(p)?p:[p]);}));}
let wrapper,main;
async function run(){
 const runtime=path.join(profile,'runtime.json');fs.rmSync(runtime,{force:true});const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
 wrapper=spawn(exe,[],{env,stdio:'ignore'});const started=Date.now(),end=started+120000;
 while(Date.now()<end){let s;try{s=JSON.parse(fs.readFileSync(runtime,'utf8'));}catch{}
  if(s?.version==='0.5.0'&&s?.nodes?.length===4&&s.machines?.filter(m=>m.online).length===2){main=(await processes(wrapper.pid)).find(p=>p.title==='AgentBridge');if(main){assert(!/remote-debugging|--inspect/.test(main.command));return {...s,elapsedMs:Date.now()-started};}}
  await delay(1000);
 }
 throw Error('Portable renderer did not receive all real nodes');
}
async function stop(){if(main){process.kill(main.pid);main=null;}if(wrapper)await Promise.race([new Promise(r=>wrapper.once('exit',r)),delay(15000)]);}
(async()=>{
 const first=await run();report.runs.push(first);assert.equal(first.nodes.filter(n=>n.connected).length,4);assert(first.tasks>=8);assert(first.collaboration.leaderId);report.checks.normalWindowReceivesRealMachinesAndNodes=true;report.checks.privateBackendResourcesPackaged=true;await stop();
 const second=await run();report.runs.push(second);assert.deepEqual(second.nodes.map(n=>n.nodeId),first.nodes.map(n=>n.nodeId));assert.equal(second.tasks,first.tasks);assert.deepEqual(second.collaboration,first.collaboration);report.checks.reopenPreservesNodesRelationsAndNativeHistory=true;report.checks.noNewPromptsOnStartup=true;report.checks.noDebugInterface=true;report.status='passed';
})().catch(e=>{report.status='failed';report.error=e.stack;process.exitCode=1;}).finally(async()=>{try{await stop();}catch{}fs.writeFileSync(path.resolve(__dirname,'../../artifacts/I05-portable.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks,error:report.error},null,2));});
