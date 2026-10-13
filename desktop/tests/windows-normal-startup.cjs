const fs=require('node:fs'),path=require('node:path');
const {spawn,execFile}=require('node:child_process');
const base='C:\\Users\\jiqi\\.codex\\visualizations\\2026\\10\\08\\01a119ed-c329-7e22-81df-0e3a4c62e86f';
const profile=path.join(base,'I04-normal-startup-profile'),output=path.resolve(__dirname,'../../artifacts/I04-windows-startup.json');
const report={date:new Date().toISOString(),status:'running',platform:process.platform,checks:{},debugPort:false};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const children=pid=>new Promise((done,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$ProgressPreference='SilentlyContinue';Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;exe=$_.ExecutablePath;command=$_.CommandLine;title=(Get-Process -Id $_.ProcessId).MainWindowTitle}} | ConvertTo-Json -Compress`],{windowsHide:true,timeout:15000},(e,o)=>e?reject(e):done(o.trim()?JSON.parse(o):null)));
let wrapper,child;
(async()=>{
 fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(path.join(profile,'desktop.json'),JSON.stringify({theme:'light',distribution:'Ubuntu',directory:''}));const runtime=path.join(profile,'runtime.json');fs.rmSync(runtime,{force:true});
 const started=Date.now(),env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
 wrapper=spawn(path.join(base,'AgentBridge-0.4.0-Windows-x64.exe'),[],{env,stdio:'ignore'});report.wrapperId=wrapper.pid;
 const end=Date.now()+120000;while(Date.now()<end){let data;try{data=JSON.parse(fs.readFileSync(runtime,'utf8'));}catch{}if(data?.connected&&data.platform==='win32'&&Date.parse(data.time)>=started){child=await children(wrapper.pid);if(child?.title==='AgentBridge'&&!/remote-debugging|--inspect/.test(child.command)){report.snapshot=data;report.windowTitle=child.title;report.processId=child.pid;report.elapsedMs=Date.now()-started;report.checks.normalPortableLaunch=true;report.checks.rendererReceivedRealSnapshot=true;report.checks.noDebugInterface=true;report.status='passed';return;}}await delay(400);}
 throw new Error('No fresh connected renderer snapshot after normal startup');
})().catch(e=>{report.status='failed';report.error=e.stack;process.exitCode=1;}).finally(async()=>{if(wrapper){try{const current=await children(wrapper.pid);if(current?.parent===wrapper.pid){process.kill(current.pid);}}catch{}}fs.writeFileSync(output,JSON.stringify(report,null,2));console.log('Normal Windows startup: '+report.status);});
