const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFile}=require('node:child_process');
const {command}=require('../electron/tool-discovery.cjs');
const output=process.argv[2];
const report={date:new Date().toISOString(),environment:'Windows Node / real installed Codex npm package / version only',modelCalls:0};
(async()=>{
 const selected=path.join(process.env.APPDATA,'npm/codex.cmd');
 const fromCmd=command(selected,['--version']);
 assert.equal(path.basename(fromCmd.executable),'codex.exe');
 assert.equal(path.basename(fromCmd.installationExecutable),'codex.js');
 const fromJs=command(fromCmd.installationExecutable,['--version']);
 assert.equal(fromJs.executable,fromCmd.executable);
 const version=await new Promise((resolve,reject)=>execFile(fromCmd.executable,fromCmd.args,{env:fromCmd.env,windowsHide:true,timeout:15000},(error,stdout)=>error?reject(error):resolve(stdout.trim())));
 assert.match(version,/codex-cli \d+\.\d+\.\d+/);
 report.version=version;report.selectedIdentityPreserved=true;report.launchesNativeDirectly=true;report.status='passed';
})().catch(error=>{report.status='failed';report.error=error.stack;process.exitCode=1;}).finally(()=>{fs.writeFileSync(output,JSON.stringify(report,null,2));});
