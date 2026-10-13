// Real packaged GUI regression: no old window remains; the current GUI stops
// the authenticated existing older Coordinator through its own Settings page.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {_electron,expect}=require('../node_modules/@playwright/test'),{CoordinatorClient}=require('../electron/coordinator-client.cjs');
const version=require('../package.json').version;
const reuse=!!process.argv[2];
const profile=reuse?path.resolve(process.argv[2]):fs.mkdtempSync(path.join(os.tmpdir(),'ab-new-client-stop-'));
const linuxDirectory='/tmp/'+path.basename(profile);
fs.mkdirSync('\\\\wsl.localhost\\Ubuntu'+linuxDirectory.replaceAll('/','\\'),{recursive:true});
fs.writeFileSync(path.join(profile,'desktop.json'),JSON.stringify({distribution:'Ubuntu',directory:linuxDirectory,theme:'system'}));
const oldExe=process.env.AGENTBRIDGE_OLD_UNPACKED||path.join(os.tmpdir(),'ab-i06a-package-0.6.0-alpha.2/AgentBridge.exe');
const current=path.join(profile,'new-app');if(!reuse)fs.cpSync(path.resolve(__dirname,'../release/win-unpacked'),current,{recursive:true});
const newExe=path.join(current,'AgentBridge.exe'),out=path.resolve(__dirname,'../../artifacts/new-client-stop/2026-10-12');
const report={date:new Date().toISOString(),version,evidence:'real packaged Windows old alpha.2 and current GUI in one isolated profile; actual Settings buttons, no native prompts',status:'running',checks:{}};
let app,client;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function launch(executable){const started=Date.now();const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;app=await _electron.launch({executablePath:executable,env,timeout:120000});const page=await app.firstWindow();await expect(page.getByRole('heading',{name:'机器与 Agent',exact:true})).toBeVisible({timeout:120000});const end=Date.now()+120000;let fresh=false;while(Date.now()<end){try{fresh=Date.parse(JSON.parse(fs.readFileSync(path.join(profile,'runtime.json'))).time)>=started;}catch{}if(fresh)break;await sleep(200);}assert(fresh,'Fresh GUI snapshot missing');client=new CoordinatorClient({directory:profile});await client.attach();return page;}
(async()=>{
 assert.equal(process.platform,'win32');
 if(reuse){client=new CoordinatorClient({directory:profile,version:'0.6.0-alpha.2',bridgeDirectory:path.join(path.dirname(oldExe),'resources/bridge'),packageDirectory:path.join(path.dirname(oldExe),'resources/linux-package')});await client.open();}else await launch(oldExe);
 assert.equal(client.info.version,'0.6.0-alpha.2');const oldPid=client.info.pid,owner=client.info.coordinatorId;
 client.close();if(app){await app.close();app=null;}
 client=new CoordinatorClient({directory:profile});await client.attach();assert.equal(client.info.pid,oldPid);client.close();
 report.checks.oldWindowGoneBackendSurvives=true;
 console.log('New GUI is opening while only the older Coordinator remains');
 const page=await launch(newExe);assert.equal(client.info.pid,oldPid);assert.equal(client.info.version,'0.6.0-alpha.2');
 await page.getByRole('button',{name:'设置',exact:true}).click();await expect(page.getByRole('heading',{name:'设置',exact:true})).toBeVisible();
 const stop=page.getByRole('button',{name:'停止后台并退出',exact:true});await expect(stop).toBeVisible();
 fs.mkdirSync(out,{recursive:true});await page.locator('section').filter({has:page.getByRole('heading',{name:'后台运行',exact:true})}).screenshot({path:path.join(out,'new-settings.png')});
 report.checks.newGuiHasStopForOlderBackend=true;
 console.log('New GUI Settings stop button is visible');
 await stop.click();const dialog=page.getByRole('dialog',{name:'停止后台',exact:true});await expect(dialog).toBeVisible();
 const exited=new Promise(resolve=>app.process().once('exit',resolve));await dialog.getByRole('button',{name:'确认停止并退出',exact:true}).click().catch(e=>{if(!/Target page, context or browser has been closed/.test(e.message))throw e;});await Promise.race([exited,sleep(30000).then(()=>{throw Error('GUI stop did not exit');})]);app=null;client.close();
 const end=Date.now()+20000;let stopped=false;
 while(Date.now()<end){const probe=new CoordinatorClient({directory:profile});try{await probe.attach();probe.close();}catch(e){if(['ENOENT','ECONNREFUSED'].includes(e.code)){stopped=true;break;}throw e;}await sleep(200);}
 assert(stopped);report.checks.newGuiStopsActualOldBackend=true;
 console.log('Old Coordinator stopped; reopening current GUI');
 await launch(newExe);assert.equal(client.info.version,version);assert.notEqual(client.info.pid,oldPid);assert.equal(client.info.coordinatorId,owner);
 const state=JSON.parse(fs.readFileSync(path.join(profile,'agent-network.json')));assert.equal(state.requests.length,0);assert.equal(state.delegations.length,0);
 report.checks.reopenStartsCurrentBackendWithSameIdentity=true;report.checks.noNativePrompts=true;report.status='passed';console.log('Current backend and original identity verified');
})().catch(e=>{report.status='failed';report.error={code:e.code,message:e.message.replace(/agentbridge-coordinator-[a-f0-9]+/g,'agentbridge-coordinator-[private]')};process.exitCode=1;}).finally(async()=>{
 // Quit the GUI before stopping its backend: live polling can restart it.
 if(app){const child=app.process();await app.evaluate(({app})=>app.quit()).catch(()=>{});const end=Date.now()+10000;while(child.exitCode===null&&Date.now()<end)await sleep(100);}
 try{await client?.request('shutdown');}catch{}client?.close();
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));process.exit(report.status==='passed'?0:1);
});
