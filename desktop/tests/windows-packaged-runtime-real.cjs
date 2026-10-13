// A normal Electron main process loads the shipped ASAR host, starts a real
// Claude verification, and closes while the detached worker finishes. No CDP.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { ClaudeHost } = require('../electron/claude-host.cjs');
if (process.platform !== 'win32') throw new Error('Windows execution required');
const source = path.resolve(__dirname, '../release/win-unpacked');
const prior = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../artifacts/I04B-dual-real.json'), 'utf8'));
const root = path.join(path.dirname(prior.root), 'I04C-' + Date.now().toString(16));
const runtime = path.join(root, 'portable-runtime'), profile = path.join(root, 'profile'), project = path.join(root, 'project');
for (const folder of [runtime, profile, project]) fs.mkdirSync(folder, { recursive: true });
for (const file of fs.readdirSync(source, { withFileTypes: true })) if (file.isFile()) fs.copyFileSync(path.join(source, file.name), path.join(runtime, file.name));
const app = path.join(runtime, 'resources/app'); fs.mkdirSync(app, { recursive: true });
fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name:'agentbridge-runtime-acceptance', version:'1.0.0', main:'main.cjs' }));
const marker = 'AB_VERIFY_' + Date.now().toString(16);
const reportPath = path.resolve(__dirname, '../../artifacts/I04C-packaged-runtime-real.json');
const report = { date:new Date().toISOString(), status:'running', root, checks:{}, errors:[] };
const launch = path.join(root, 'launch.json');
fs.writeFileSync(path.join(app, 'main.cjs'), `
const {app}=require('electron');const fs=require('node:fs'),path=require('node:path');
const {ClaudeHost}=require(${JSON.stringify(path.join(source,'resources/app.asar/electron/claude-host.cjs'))});
const profile=${JSON.stringify(profile)}, project=${JSON.stringify(project)}, launch=${JSON.stringify(launch)};
app.setPath('userData',path.join(profile,'electron'));
let host;
app.whenReady().then(async()=>{
 host=new ClaudeHost({directory:path.join(profile,'windows')});
 const discovered=await host.call('discover');const tool=discovered.items.find(t=>t.installed&&t.available!==false)||discovered.items[0];
 if(!tool)throw Error('Claude missing');
 const instance=await host.call('connect',{executable:tool.executable,workspace:project,model:{providerID:'claude',id:'DeepSeek-V4.1-Flash'}});
 const task=await host.call('ipc',{op:'verify',agentId:instance.agentId,requestId:'packaged-runtime-check',message:${JSON.stringify('只回复标记 '+marker+'，不要执行其他动作。')}});
 const end=Date.now()+30000;
 while(Date.now()<end){
  const current=await host.call('ipc',{op:'task',taskId:task.taskId});
  if(current.status==='running'){
   const state=JSON.parse(fs.readFileSync(path.join(profile,'windows/claude-state.json'),'utf8'));
   const owned=state.tasks.find(t=>t.taskId===task.taskId);
   fs.writeFileSync(launch,JSON.stringify({status:'started',taskId:task.taskId,workerPid:owned.worker.workerPid,source:process.execPath,packagedAsarHost:true}));
   host.close();app.quit();return;
  }
  if(['failed','cancelled'].includes(current.status))throw Error(current.lastSummary);
  await new Promise(r=>setTimeout(r,100));
 }
 throw Error('Worker did not start');
}).catch(e=>{fs.writeFileSync(launch,JSON.stringify({status:'failed',error:e.stack}));host?.close();app.exit(1)});
`);
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(path.join(runtime,'AgentBridge.exe'),[],{env,stdio:'ignore',windowsHide:true});
let observerClosedAt;
const observerClosed = new Promise(resolve => child.once('exit', () => { observerClosedAt = Date.now(); resolve(); }));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let started;
 const end=Date.now()+160000;
 while(Date.now()<end){
  try { started=JSON.parse(fs.readFileSync(launch,'utf8')); } catch {}
  if(started?.status==='failed')throw Error(started.error);
  if(started?.status==='started')break;
  await delay(200);
 }
 assert(started?.status==='started','Electron main did not start a task');
 report.taskId=started.taskId;report.checks.shippedAsarHostInNormalElectron=true;
 await Promise.race([observerClosed, delay(20000).then(() => { throw Error('Observer did not close'); })]);
 for (const name of ['icudtl.dat','snapshot_blob.bin','v8_context_snapshot.bin']) fs.rmSync(path.join(runtime,name));
 assert(!fs.existsSync(path.join(runtime,'icudtl.dat')));report.checks.originalRuntimeResourcesRemoved=true;
 const run=path.join(profile,'windows/runs',started.taskId);
 let completion;
 while(Date.now()<end){try{completion=JSON.parse(fs.readFileSync(path.join(run,'completion.json'),'utf8'));}catch{}if(completion)break;await delay(200);}
 assert(completion,'Native completion missing');
 assert(Date.parse(completion.time) >= observerClosedAt, 'Native task completed before observer-close boundary');
 assert.equal(completion.status,'succeeded',completion.message);assert(completion.message.includes(marker));assert.equal(completion.nativeExited,true);
 report.checks.realModelResponseAfterObserverClosed=true;report.checks.nativeProcessExitConfirmed=true;
 const host=new ClaudeHost({directory:path.join(profile,'windows')});
 const task=await host.call('ipc',{op:'task',taskId:started.taskId});assert.equal(task.status,'succeeded');host.close();
 report.checks.historyRecoveredWithoutReplay=true;report.status='passed';
})().catch(e=>{report.status='failed';report.errors.push(e.stack);process.exitCode=1}).finally(()=>{
 try{process.kill(child.pid)}catch{}
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log('Packaged Electron native worker: '+report.status);
});
