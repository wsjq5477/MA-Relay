// Ordinary final portable EXE, no debugging flags; authenticated production IPC verifies real native work.
const fs=require('node:fs'),path=require('node:path'),{spawn,execFile}=require('node:child_process'),{randomUUID}=require('node:crypto'),assert=require('node:assert/strict');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async({profile,call,member,finish,report,save,phase,closeInstrumented})=>{
 phase('final-ordinary-portable-real-native');const version=report.version||require('../package.json').version,source=path.resolve(__dirname,'../release/AgentBridge-'+version+'-Windows-x64.exe'),exe=path.join(profile,'ordinary-'+version+'.exe');if(!fs.existsSync(exe))fs.writeFileSync(exe,fs.readFileSync(source));
 const ps=text=>new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',text],{encoding:'utf8',windowsHide:true,timeout:20000},(e,o)=>e?reject(e):resolve(o.trim())));
 if(closeInstrumented)await closeInstrumented();else{const needle=profile.replaceAll("'","''");await ps(`Get-CimInstance Win32_Process | Where-Object {$_.Name -eq 'AgentBridge.exe' -and $_.CommandLine -like '*${needle}\\package*' -and $_.CommandLine -notlike '*--type=*'} | ForEach-Object {(Get-Process -Id $_.ProcessId).CloseMainWindow() | Out-Null}`);await pause(1500);}
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;const launcher=spawn(exe,[],{env,cwd:profile,stdio:'ignore'});let main;
 try{
  const end=Date.now()+120000;while(Date.now()<end){const text=await ps(`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${launcher.pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;debug=($_.CommandLine -match 'remote-debugging|--inspect');title=(Get-Process -Id $_.ProcessId).MainWindowTitle}} | ConvertTo-Json -Compress`);const rows=text?JSON.parse(text):[];main=(Array.isArray(rows)?rows:[rows]).find(r=>r.title==='AgentBridge');if(main)break;await pause(500);}assert(main);assert.equal(main.debug,false);
  const snapshot=await call('snapshot'),count=snapshot.tasks.length,marker='AB_NORMAL_'+randomUUID().slice(0,8);const value=await finish(await call('nodeRequest',{op:'submit',nodeId:member.nodeId,requestId:randomUUID(),message:'仅回复 '+marker+'，不要调用任何工具或读写文件。'}),member.machineId);assert.equal(value.status,'succeeded');assert(value.result.message.includes(marker));assert.equal((await call('snapshot')).tasks.length,count+1);
  report.extra.ordinaryPortable={status:'passed',actualNormalWindow:true,debuggingFlags:false,realNativeReply:true,targetKind:snapshot.machines.find(m=>m.machineId===member.machineId)?.kind,originalHistoryRetained:true};save();
 }finally{
  if(main){assert.equal(main.parent,launcher.pid);await ps(`(Get-Process -Id ${main.pid}).CloseMainWindow() | Out-Null`);const end=Date.now()+20000;while(launcher.exitCode===null&&Date.now()<end)await pause(200);assert.notEqual(launcher.exitCode,null);}
 }
};
