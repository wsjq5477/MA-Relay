/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Linux runtime acceptance. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{randomUUID}=require('node:crypto');
const {probeScript,localManifest}=require('../electron/ssh-install.cjs');
const {inspectDaemon}=require('../electron/machine-daemon.cjs');
const report={date:new Date().toISOString(),scope:'real Linux processes in an isolated HOME without discoverable system/user Node; published private runtime; no SSH deployment or model calls',checks:[],errors:[]};
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ab-i06a-no-node-')),home=path.join(temp,'home');fs.mkdirSync(home,{mode:0o700});
const bundle=path.resolve(__dirname,'../.linux-package'),env={...process.env,HOME:home,PATH:'/usr/bin:/bin',XDG_STATE_HOME:path.join(home,'.local/state')};
let daemon;
(async()=>{
 assert.equal(process.platform,'linux');
 const lines=execFileSync('/bin/sh',['-s'],{input:probeScript,env,encoding:'utf8'}).trimEnd().split('\n');assert.equal(lines[8],'');assert.equal(lines[9],'');
 const {manifest}=localManifest(bundle);assert.equal(manifest.version,require('../package.json').version);
 report.checks.push('Actual production probe finds no system/user Node in isolated Linux HOME');
 const options={stateDirectory:path.join(home,'bridge-state'),ownerCoordinatorId:randomUUID(),profileId:randomUUID()};
 const node=path.join(bundle,manifest.runtime.path),entry=path.join(bundle,'desktop/electron/machine-daemon.cjs');
 const args=[entry,'--state-directory',options.stateDirectory,'--owner',options.ownerCoordinatorId,'--profile',options.profileId];
 daemon=JSON.parse(execFileSync(node,args,{env,encoding:'utf8',timeout:30000}));assert.equal(daemon.version,manifest.version);assert.equal(daemon.started,true);
 const second=JSON.parse(execFileSync(node,args,{env,encoding:'utf8',timeout:10000}));assert.equal(second.daemonId,daemon.daemonId);assert.equal(second.pid,daemon.pid);assert.equal(second.started,false);
 const info=await inspectDaemon(options);assert.equal(info.daemonId,daemon.daemonId);
 assert.equal(fs.realpathSync('/proc/'+daemon.pid+'/exe'),fs.realpathSync(node));
 report.checks.push('Published ELF Node starts actual Linux daemon, handshake matches bundle version, repeat bootstrap reuses same process/identity');
 report.nodeVersion=manifest.runtime.version;report.daemonVersion=daemon.version;report.status='passed';
})().catch(e=>{report.status='failed';report.errors.push({code:e.code||'VERIFY_FAILED',message:e.message});process.exitCode=1;}).finally(async()=>{
 if(daemon?.pid){try{process.kill(daemon.pid,'SIGTERM');}catch{}const end=Date.now()+3000;while(Date.now()<end){try{process.kill(daemon.pid,0);}catch{break;}await new Promise(r=>setTimeout(r,50));}}
 fs.rmSync(temp,{recursive:true,force:true});fs.writeFileSync(path.resolve(__dirname,'../../artifacts/I06A-final/private-runtime.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
});
