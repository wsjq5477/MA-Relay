const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const repo=path.resolve(__dirname,'../../..'),{CoordinatorClient}=require(path.join(repo,'desktop/electron/coordinator-client.cjs'));
const report={date:new Date().toISOString(),status:'running',scope:'close only the ordinary test window bound by its owned synthetic profile, authenticated coordinator and parent PID; no other application is touched'};
(async()=>{
 const dirs=fs.readdirSync(os.tmpdir()).filter(n=>n.startsWith('ab-alpha71-portable-'));assert.equal(dirs.length,1);const directory=path.join(os.tmpdir(),dirs[0]);
 const client=new CoordinatorClient({directory});try{
  await client.attach();const worker=client.info.pid;assert.equal(client.info.version,'0.6.0-alpha.71');
  const safe=directory.replaceAll("'","''");
  const script=`$worker=Get-CimInstance Win32_Process -Filter 'ProcessId=${worker}'; if(!$worker -or !$worker.CommandLine.Contains('${safe}')){throw 'owned coordinator not found'}; $main=Get-Process -Id $worker.ParentProcessId; $process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$main.Id); if($main.MainWindowTitle -ne 'AgentBridge' -or $process.CommandLine -match 'remote-debugging|--inspect'){throw 'window identity mismatch'}; if(!$main.CloseMainWindow()){throw 'window close rejected'}; $main.WaitForExit(15000)`;
  const closed=cp.execFileSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:25000,encoding:'utf8'}).trim();assert.equal(closed,'True');
  report.normalWindowClosed=true;await client.request('shutdown');report.ownedCoordinatorStopped=true;report.status='passed';
 }finally{client.close();}
})().catch(e=>{report.status='failed';report.error={code:e.code||'VERIFY_FAILED',message:e.message};process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(__dirname,'portable-close.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
