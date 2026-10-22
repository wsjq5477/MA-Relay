// Local Linux / Playwright chromium / vite production bundle / synthetic IPC, model 0.
// Unlike tests/windows-*.cjs this case launches plain chromium (no Edge channel and no
// Windows absolute executable path), so it runs on this machine:
//   PLAYWRIGHT_BROWSERS_PATH=<repo>/artifacts/maintenance-offline/pw-browsers \
//   LD_LIBRARY_PATH=<repo>/artifacts/maintenance-offline/pw-libs/root/usr/lib/x86_64-linux-gnu \
//   node tests/ui-maintenance-progress.cjs
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test'),{mock}=require('./ui-workspace-fixture.cjs');
const out=path.resolve(process.argv[2]||process.env.AGENTBRIDGE_MAINTENANCE_UI_DIR||path.join(__dirname,'../../artifacts/ui-maintenance-progress/2026-10-21'));
fs.mkdirSync(out,{recursive:true});
const report={date:new Date().toISOString(),version:require('../package.json').version,environment:'Linux Node / Playwright chromium / vite production dist / synthetic IPC',modelCalls:0,status:'running',checks:[],pageErrors:[],observations:{}};
let frozen,server,browser,context,page;const calls=[];
async function collect(){if(page&&!page.isClosed())calls.push(...await page.evaluate(()=>window.__testControl.calls.splice(0)));}
async function check(label){await collect();assert.equal(calls.filter(c=>c.businessAttempt).length,0);assert.deepEqual(report.pageErrors,[]);report.checks.push(label);await page.screenshot({path:path.join(out,String(report.checks.length).padStart(2,'0')+'.png')});}
// Extends the shared synthetic snapshot with the maintenance fields this case needs: the shared
// fixture has no installProgress/daemonMaintenance/upload-warning and no controllable receipt.
function maintenanceControl(initial){
 const control=window.__maintenanceControl={machines:{...(initial.machines||{})},graphPending:initial.graphPending||[],operations:{...(initial.operations||{})},pendingAt:0,operationCalls:[]};
 const original=window.agentbridge.call;
 window.agentbridge.call=async(method,params={})=>{
  if(method==='graphPending')return {ok:true,result:structuredClone(control.graphPending)};
  if(method==='machine.operation'){
   control.operationCalls.push({operationId:params.operationId,at:Date.now()});
   const receipt=control.operations[params.operationId];
   return receipt?{ok:true,result:structuredClone(receipt)}:{ok:true,result:{operationId:params.operationId,state:'unknown'}};
  }
  if(method==='machine.maintainDaemon')control.pendingAt=Date.now();
  const reply=await original(method,params);
  if(method==='snapshot'&&reply&&reply.ok){
   reply.result.machines=reply.result.machines.map(m=>{const patch=control.machines[m.machineId];if(!patch)return m;const merged={...m};for(const [key,value] of Object.entries(patch)){if(value===null)delete merged[key];else merged[key]=structuredClone(value);}return merged;});
  }
  return reply;
 };
}
async function fresh(patch={}){await collect();await context?.close();context=await browser.newContext({viewport:{width:1280,height:860},reducedMotion:'reduce'});page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));await page.addInitScript(mock,{});await page.addInitScript(maintenanceControl,patch);await page.goto('http://127.0.0.1:'+server.address().port);await expect(page.locator('.inventory-node')).toHaveCount(3);}
function dialog(){return page.getByRole('dialog',{name:'后台维护',exact:true});}
async function openMaintenance(){const group=page.locator('.inventory-machine').filter({hasText:'远端测试机器'});await group.locator('summary[aria-label="远端测试机器 的更多操作"]').click();await group.getByRole('button',{name:'后台维护',exact:true}).click();await expect(dialog()).toContainText('0.6.0-alpha.24');}
const ledger=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('agentbridge-machine-operation:controlled-ui-state-profile')||'null'));
const operationCalls=()=>page.evaluate(()=>window.__maintenanceControl.operationCalls.map(c=>({operationId:c.operationId,delay:c.at-window.__maintenanceControl.pendingAt})));
(async()=>{
 frozen=fs.mkdtempSync(path.join(os.tmpdir(),'ab-maintenance-ui-'));const renderer=path.join(frozen,'renderer');fs.cpSync(path.resolve(__dirname,'../dist'),renderer,{recursive:true});
 server=http.createServer((req,res)=>{try{const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'')||'index.html';const file=path.resolve(renderer,relative);if(!file.startsWith(renderer+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});report.browser=browser.version();report.node=process.version;

 // 1) Upload phase, byte counters, warning-as-hint, and live snapshot resolution in the dialog.
 await fresh({machines:{remote:{installProgress:{phase:'uploading',completedBytes:524288,totalBytes:2097152},progressWarning:{code:'SSH_PROGRESS_WARNING',causeCode:'EPIPE',message:'进度显示更新失败（EPIPE），上传继续；发送维护前仍须保存本地台账。'}}}});
 await openMaintenance();
 await expect(dialog()).toContainText('正在上传 512 KiB / 2.0 MiB');
 await expect(dialog().getByRole('progressbar',{name:'后台维护进度'})).toHaveAttribute('aria-valuenow','25');
 await expect(dialog().getByRole('status').filter({hasText:'进度显示更新失败'})).toContainText('上传仍在继续');
 assert.equal(await dialog().getByRole('alert').count(),0,'progress warning must render as a hint, not a failure');
 const card=page.locator('.inventory-machine').filter({hasText:'远端测试机器'});
 await expect(card).toContainText('正在上传 512 KiB / 2.0 MiB');
 await page.evaluate(()=>{window.__maintenanceControl.machines.remote.installProgress={phase:'verifying',completedBytes:2097152,totalBytes:2097152};});
 await expect(dialog()).toContainText('正在校验 2.0 MiB / 2.0 MiB',{timeout:8000});
 await check('Machine card and dialog show upload stage, byte counters and a non-failure progress warning; the open dialog follows the live snapshot instead of the stale click-time object');
 await page.getByRole('button',{name:'关闭后台维护'}).click();

 // 2) Unconfirmed original operation: actions disabled, waiting text, bounded 1s/2s auto-query of the same operationId, then settlement.
 await fresh();
 await openMaintenance();
 await dialog().getByRole('button',{name:'升级后台',exact:true}).click();
 await dialog().getByRole('button',{name:'确认升级',exact:true}).click();
 await expect(dialog().getByText('已发送维护指令，等待远端切换（原操作已保留，不会重做）')).toBeVisible();
 await expect(dialog().getByRole('button',{name:'升级后台',exact:true})).toBeDisabled();
 await expect(dialog().getByRole('button',{name:'确认升级',exact:true})).toBeDisabled();
 const stored=await ledger();assert.equal(stored.length,1);assert.equal(stored[0].action,'maintainDaemon');assert.equal(stored[0].connectionId,'fixture-ssh');const originalId=stored[0].operationId;
 await expect.poll(async()=>(await operationCalls()).filter(c=>c.delay>500).length,{timeout:8000}).toBeGreaterThanOrEqual(2);
 const timed=await operationCalls();report.observations.pollDelays=timed.map(c=>c.delay);
 const polls=timed.filter(c=>c.delay>500);
 assert.ok(polls[0].delay>=600&&polls[0].delay<=2500,'first auto-query must be about 1s after the unknown receipt, got '+polls[0].delay);
 assert.ok(polls[1].delay>=2400&&polls[1].delay<=6500,'second auto-query must back off to about 2s, got '+polls[1].delay);
 assert.equal(timed.filter(c=>c.delay<=500).length,1,'only the existing immediate lane query runs at once; the dialog poll must not spin');
 assert.ok(timed.every(c=>c.operationId===originalId),'every automatic query must target the retained original operationId');
 await page.evaluate(id=>{const c=window.__maintenanceControl;c.operations[id]={operationId:id,state:'confirmed',data:{action:'upgrade',machineId:'remote',connectionId:'fixture-ssh',version:'0.6.0-alpha.32'}};c.machines.remote={...(c.machines.remote||{}),daemonMaintenance:{operationId:id,state:'confirmed',action:'upgrade'}};},originalId);
 await expect(dialog().getByText('已发送维护指令，等待远端切换（原操作已保留，不会重做）')).toHaveCount(0,{timeout:15000});
 await expect(dialog().getByRole('button',{name:'升级后台',exact:true})).toBeEnabled();
 await expect(dialog().getByRole('button',{name:'确认升级',exact:true})).toBeEnabled();
 await expect(dialog().getByText('后台维护已完成，远端已切换。')).toBeVisible();
 assert.equal(await ledger(),null,'the settled original intent must be removed from the local ledger');
 const settled=await page.evaluate(()=>window.__maintenanceControl.operationCalls.length);
 await page.waitForTimeout(4500);
 assert.equal(await page.evaluate(()=>window.__maintenanceControl.operationCalls.length),settled,'auto-query must stop once the original operation is settled');
 await check('Unconfirmed maintenance disables every action, shows the waiting text, auto-queries only the retained original operationId with 1s/2s backoff, and stops after the original receipt is confirmed');

 // 3) Terminal rejection reason is visible in the dialog.
 await fresh({machines:{remote:{daemonMaintenance:{operationId:'rejected-maintenance',state:'rejected',action:'upgrade',error:{code:'DAEMON_STAGE_REJECTED',message:'后台维护未执行或未完成（DAEMON_STAGE_REJECTED）；原版本与历史保留。'}}}}});
 await openMaintenance();
 await expect(dialog().getByRole('alert')).toContainText('后台维护未执行或未完成（DAEMON_STAGE_REJECTED）');
 await check('Rejected terminal maintenance shows the remote failure reason while the retained version and history stay in place');
 await page.getByRole('button',{name:'关闭后台维护'}).click();

 await collect();
 assert.equal(calls.filter(c=>c.method==='machine.maintainDaemon').length,1,'exactly one maintenance dispatch is allowed');
 assert.equal(calls.filter(c=>c.businessAttempt).length,0);
 report.status='passed';
})().catch(async error=>{report.status='failed';report.error={message:error.message,stack:error.stack};process.exitCode=1;try{report.failureText=await page.locator('body').innerText();await page?.screenshot({path:path.join(out,'failure.png')});}catch{}}).finally(async()=>{await collect();report.calls=calls;await context?.close();await browser?.close();if(server)await new Promise(r=>server.close(r));if(frozen)fs.rmSync(frozen,{recursive:true,force:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks.length,browser:report.browser,error:report.error?.message}));});
