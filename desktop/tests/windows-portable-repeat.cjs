// Normal Windows portable startup/reopen; process/file observations only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process');
const exe=process.argv[2];if(process.platform!=='win32'||!exe)throw Error('Pass a Windows portable executable');
const prior=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../artifacts/I04B-dual-real.json'),'utf8'));
const stamp=Date.now().toString(16),root=path.join(path.dirname(prior.root),'I04C-repeat-'+stamp),profile=path.join(root,'profile');
fs.mkdirSync(profile,{recursive:true});
const linuxDirectory='/tmp/agentbridge-i04c-portable-'+stamp+'/state';
fs.writeFileSync(path.join(profile,'desktop.json'),JSON.stringify({theme:'light',distribution:'Ubuntu',directory:linuxDirectory}));
const report={date:new Date().toISOString(),status:'running',root,linuxDirectory,checks:{},errors:[]};
const output=path.resolve(__dirname,'../../artifacts/I04C-portable-repeat.json');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function children(pid){return new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;executable=$_.ExecutablePath;title=(Get-Process -Id $_.ProcessId).MainWindowTitle;command=$_.CommandLine}} | ConvertTo-Json -Compress`],{windowsHide:true,timeout:15000},(e,o)=>{if(e)return reject(e);const a=o.trim()?JSON.parse(o):[];resolve(Array.isArray(a)?a:[a])}));}
let first,second,main;
(async()=>{
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
 first=spawn(exe,[],{env,stdio:'ignore'});
 const end=Date.now()+100000;
 while(Date.now()<end){let s;try{s=JSON.parse(fs.readFileSync(path.join(profile,'runtime.json'),'utf8'))}catch{}if(s?.version==='0.4.2'){main=(await children(first.pid)).find(p=>p.title==='AgentBridge');if(main)break;}await delay(500);}
 assert(main,'No normal portable window');assert(!/remote-debugging|--inspect/.test(main.command));report.checks.normalWindowStarted=true;
 const runtime=path.dirname(main.executable);assert(fs.existsSync(path.join(runtime,'icudtl.dat')));
 second=spawn(exe,[],{env,stdio:'ignore'});
 await Promise.race([new Promise((resolve,reject)=>{second.once('error',reject);second.once('exit',resolve)}),delay(60000).then(()=>{throw Error('Second portable launch did not exit')})]);
 assert(fs.existsSync(path.join(runtime,'icudtl.dat')),'Second launch removed first ICU resource');assert(fs.existsSync(path.join(runtime,'resources/app.asar')),'Second launch removed first ASAR');
 assert((await children(first.pid)).some(p=>p.pid===main.pid&&p.title==='AgentBridge'));report.checks.secondLaunchRetainsFirstRuntime=true;
 const after=Date.now();await delay(4000);const fresh=JSON.parse(fs.readFileSync(path.join(profile,'runtime.json'),'utf8'));assert(Date.parse(fresh.time)>=after);
 report.checks.firstWindowRemainsResponsive=true;report.version=fresh.version;report.machines=fresh.machines;report.status='passed';
})().catch(e=>{report.status='failed';report.errors.push(e.stack);process.exitCode=1}).finally(()=>{
 if(main)try{process.kill(main.pid)}catch{};if(second?.exitCode===null)try{process.kill(second.pid)}catch{}
 fs.writeFileSync(output,JSON.stringify(report,null,2));console.log('Portable repeat launch: '+report.status);
});
