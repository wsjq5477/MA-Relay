// Local Linux / Playwright chromium / vite production dist / synthetic IPC, model 0.
// Unlike tests/windows-*.cjs this case launches plain chromium (no Edge channel and no
// Windows absolute executable path), so it runs on this machine:
//   PLAYWRIGHT_BROWSERS_PATH=<repo>/artifacts/maintenance-offline/pw-browsers \
//   LD_LIBRARY_PATH=<repo>/artifacts/maintenance-offline/pw-libs/root/usr/lib/x86_64-linux-gnu \
//   node tests/ui-maintenance-blockers.cjs
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test'),{mock}=require('./ui-workspace-fixture.cjs');
const out=path.resolve(process.argv[2]||process.env.AGENTBRIDGE_BLOCKERS_UI_DIR||path.join(__dirname,'../../artifacts/ui-maintenance-blockers/2026-10-21'));
fs.mkdirSync(out,{recursive:true});
const report={date:new Date().toISOString(),version:require('../package.json').version,environment:'Linux Node / Playwright chromium / vite production dist / synthetic IPC',modelCalls:0,status:'running',checks:[],pageErrors:[],observations:{}};
let frozen,server,browser,context,page;const calls=[];
async function collect(){if(page&&!page.isClosed())calls.push(...await page.evaluate(()=>window.__testControl.calls.splice(0)));}
async function check(label){await collect();assert.equal(calls.filter(c=>c.businessAttempt).length,0);assert.deepEqual(report.pageErrors,[]);report.checks.push(label);await page.screenshot({path:path.join(out,String(report.checks.length).padStart(2,'0')+'.png')});}
// The shared fixture has no maintenance-gate surface, so this wrapper answers the two
// new read-only methods and records every call the dialog makes.
function blockersControl(initial){
 const control=window.__blockerControl={blockers:{available:true,tasks:[],agents:[],receipts:[],...(initial.blockers||{})},query:{state:'confirmed',detail:{taskId:'blocked-task'}},...(initial.query?{query:initial.query}:{}),...(initial.preview?{preview:initial.preview}:{}),blockersCalls:[],queryCalls:[],maintenanceCalls:[],machines:{...(initial.machines||{})}};
 const original=window.agentbridge.call;
 window.agentbridge.call=async(method,params={})=>{
  if(method==='machine.maintenanceBlockers'){control.blockersCalls.push(structuredClone(params));return {ok:true,result:structuredClone(control.blockers)};}
  if(method==='machine.daemonPreview'&&control.preview)return {ok:true,result:structuredClone(control.preview)};
  if(method==='machine.queryBlockedOperation'){control.queryCalls.push(structuredClone(params));return {ok:true,result:structuredClone(control.query)};}
  if(method==='machine.maintainDaemon')control.maintenanceCalls.push(structuredClone(params));
  const reply=await original(method,params);
  if(method==='snapshot'&&reply&&reply.ok){reply.result.machines=reply.result.machines.map(m=>{const patch=control.machines[m.machineId];if(!patch)return m;const merged={...m};for(const [key,value] of Object.entries(patch)){if(value===null)delete merged[key];else merged[key]=structuredClone(value);}return merged;});}
  return reply;
 };
}
async function fresh(initial){await collect();await context?.close();context=await browser.newContext({viewport:{width:1280,height:960},reducedMotion:'reduce'});page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));await page.addInitScript(mock,{});await page.addInitScript(blockersControl,initial);await page.goto('http://127.0.0.1:'+server.address().port);await expect(page.locator('.inventory-node')).toHaveCount(3);}
function dialog(){return page.getByRole('dialog',{name:'后台维护',exact:true});}
async function openMaintenance(expected='0.6.0-alpha.24'){const group=page.locator('.inventory-machine').filter({hasText:'远端测试机器'});await group.locator('summary[aria-label="远端测试机器 的更多操作"]').click();await group.getByRole('button',{name:'后台维护',exact:true}).click();await expect(dialog()).toContainText(expected);}
const gate=()=>dialog().locator('section[aria-label="维护前置门禁"]');
const blockedReceipt={key:'blocked-submit',op:'submit',state:'unknown',updatedAt:'2026-10-21T00:00:00.000Z'};
const control=()=>page.evaluate(()=>({blockers:window.__blockerControl.blockersCalls.length,blockersCalls:structuredClone(window.__blockerControl.blockersCalls),query:structuredClone(window.__blockerControl.queryCalls),maintenance:structuredClone(window.__blockerControl.maintenanceCalls)}));
(async()=>{
 frozen=fs.mkdtempSync(path.join(os.tmpdir(),'ab-blockers-ui-'));const renderer=path.join(frozen,'renderer');fs.cpSync(path.resolve(__dirname,'../dist'),renderer,{recursive:true});
 server=http.createServer((req,res)=>{try{const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'')||'index.html';const file=path.resolve(renderer,relative);if(!file.startsWith(renderer+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});report.browser=browser.version();report.node=process.version;

 // 1) A running task/Agent blocks: the list is rendered and the override surface is absent.
 await fresh({blockers:{available:true,tasks:[{taskId:'running-task',requestId:'running-request',status:'running',adapter:'opencode'}],agents:[{nodeId:'agent-a',adapter:'claude',busy:true,currentTask:{taskId:'agent-task',status:'accepted'}}],receipts:[blockedReceipt]}});
 await openMaintenance();
 await expect(gate()).toContainText('任务：running');
 await expect(gate()).toContainText('running-task');
 await expect(gate()).toContainText('running-request');
 await expect(gate()).toContainText('Agent：正在工作');
 await expect(gate()).toContainText('agent-a');
 await expect(gate()).toContainText('blocked-submit');
 await expect(dialog().getByRole('button',{name:'确认升级（保留未确认收据）'})).toHaveCount(0);
 await expect(dialog().getByRole('checkbox')).toHaveCount(0);
 await expect(dialog().getByText('任务或 Agent 仍在运行、等待或未知，维护前置门禁不可越过。请先完成或按原 ID 核对这些操作。')).toBeVisible();
 const taskCase=await control();report.observations.taskCase=taskCase;
 assert.equal(taskCase.maintenance.length,0,'no maintenance may be dispatched while task work blocks');
 assert.ok(taskCase.blockersCalls.length>=1,'the gate projection is read on open');
 assert.ok(taskCase.blockersCalls.every(entry=>entry.connectionId==='fixture-ssh'&&entry.machineId==='remote'));
 await check('Running tasks and Agent work are listed with status/id and never grow an override control; no maintenance is dispatched');

 // 2) Only unconfirmed receipts block: single original-ID query refreshes the list, and the checked override sends allowUnresolved.
 await fresh({blockers:{available:true,tasks:[],agents:[],receipts:[blockedReceipt]}});
 await openMaintenance();
 await expect(gate()).toContainText('收据：blocked-submit · submit · unknown · 2026-10-21T00:00:00.000Z');
 const overrideButton=dialog().getByRole('button',{name:'确认升级（保留未确认收据）'});
 await expect(overrideButton).toBeVisible();await expect(overrideButton).toBeDisabled();
 const checkbox=dialog().getByRole('checkbox');
 await expect(checkbox).not.toBeChecked();
 let receiptCase=await control();assert.equal(receiptCase.blockers,1);
 await dialog().getByRole('button',{name:'按原 ID 查询'}).click();
 await expect.poll(async()=>(await control()).blockers).toBe(2);
 receiptCase=await control();
 assert.deepEqual(receiptCase.query,[{connectionId:'fixture-ssh',machineId:'remote',key:'blocked-submit',op:'submit'}]);
 await expect(dialog().getByRole('status').filter({hasText:'已核对到确定收据'})).toBeVisible();
 await checkbox.check();
 await expect(overrideButton).toBeEnabled();
 await overrideButton.click();
 await expect.poll(async()=>(await control()).maintenance.length).toBe(1);
 receiptCase=await control();report.observations.receiptCase=receiptCase;
 const maintenance=receiptCase.maintenance[0];
 assert.equal(maintenance.config.allowUnresolved,true);
 assert.equal(maintenance.config.action,'upgrade');
 assert.equal(maintenance.config.previewId,'synthetic-preview');
 assert.equal(maintenance.config.expectedVersion,'0.6.0-alpha.24');
 assert.equal(maintenance.config.targetVersion,'0.6.0-alpha.32');
 assert.equal(maintenance.connectionId,'fixture-ssh');assert.equal(maintenance.machineId,'remote');
 assert.match(maintenance.operationId,/^[0-9a-f-]{36}$/);
 assert.notEqual(maintenance.operationId,blockedReceipt.key,'the overridden receipt key is never reused as the maintenance operation');
 await check('An unconfirmed receipt alone is listed, queried once by its original key, and only a checked confirmation sends allowUnresolved:true under a fresh maintenance operation id');

 // 3) A gate refusal (DAEMON_BUSY) keeps its own wording and the blocker detail, but reads as
 // neutral history even while an upgrade target still exists: the admission check runs before
 // the backend is stopped, so nothing was stopped or switched.
 await fresh({blockers:{available:true,tasks:[],agents:[],receipts:[blockedReceipt]},machines:{remote:{daemonMaintenance:{operationId:'prior-maintenance',state:'rejected',action:'upgrade',error:{code:'DAEMON_BUSY',message:'后台仍有未确认的原任务/控制收据。',details:{gate:'receipts',tasks:[],agents:[],receipts:[blockedReceipt]}}}}}});
 await openMaintenance();
 const refusalHistory=dialog().locator('section[aria-label="上次维护结果"]');
 await expect(refusalHistory).toHaveAttribute('role','status');
 await expect(dialog().getByRole('alert')).toHaveCount(0);
 await expect(refusalHistory).toContainText('上次维护结果：后台仍有未确认的原任务/控制收据。');
 await expect(refusalHistory).toContainText('不代表现在又失败了');
 await expect(dialog().getByText('远端门禁原话：后台仍有未确认的原任务/控制收据。（未确认收据 1 条）')).toBeVisible();
 await expect(dialog().locator('section[aria-label="维护前置门禁"]')).not.toHaveAttribute('role','alert');
 await expect(dialog().getByRole('button',{name:'升级后台',exact:true})).toBeEnabled();
 await check('A gate refusal (DAEMON_BUSY) keeps its own wording and blocker detail yet reads as neutral history while the standard actions stay available');

 // 3b) A real switch failure (stop/health/ownership) is NOT a gate refusal and must stay red
 // even though an upgrade target exists.
 await fresh({blockers:{available:true,tasks:[],agents:[],receipts:[]},machines:{remote:{daemonMaintenance:{operationId:'failed-switch',state:'rejected',action:'upgrade',error:{code:'DAEMON_STOP_TIMEOUT',message:'停止原后台超时，已回到原版本。'}}}}});
 await openMaintenance();
 const failureHistory=dialog().locator('section[aria-label="上次维护结果"]');
 await expect(failureHistory).toHaveAttribute('role','alert');
 await expect(dialog().getByRole('alert')).toContainText('停止原后台超时，已回到原版本。');
 await expect(failureHistory).not.toContainText('不代表现在又失败了');
 await expect(dialog().getByRole('button',{name:'升级后台',exact:true})).toBeEnabled();
 await check('A genuine switch failure (stop/health) still renders as an alert while an upgrade target exists');
 await page.getByRole('button',{name:'关闭后台维护'}).click();

 // 4) History and live blockers coexist and stay separately identifiable; an up-to-date
 // version has no clickable upgrade even though an old rejection is still on record.
 await fresh({preview:{daemonVersion:'0.6.0-alpha.32',targetVersion:'0.6.0-alpha.32',rollbackVersion:'0.6.0-alpha.9',previewId:'synthetic-preview',installPath:'/synthetic/install',stateDirectory:'/synthetic/state'},blockers:{available:true,tasks:[],agents:[],receipts:[blockedReceipt]},machines:{remote:{daemonMaintenance:{operationId:'stale-maintenance',state:'rejected',action:'upgrade',error:{code:'DAEMON_BUSY',message:'后台维护未执行或未完成（DAEMON_BUSY）；原版本与历史保留。'}}}}});
 await openMaintenance('0.6.0-alpha.32');
 const history=dialog().locator('section[aria-label="上次维护结果"]');
 await expect(history).toHaveCount(1);await expect(gate()).toHaveCount(1);
 await expect(history).toHaveAttribute('role','status');
 await expect(history).toContainText('上次维护结果：后台维护未执行或未完成（DAEMON_BUSY）');
 await expect(history).toContainText('无需升级');
 await expect(history).not.toContainText('当前阻塞项');
 await expect(gate()).toContainText('当前阻塞项');
 await expect(gate()).toContainText('blocked-submit');
 await expect(gate()).not.toContainText('上次维护结果');
 await expect(dialog().getByRole('button',{name:'升级后台',exact:true})).toBeDisabled();
 await expect(dialog().getByRole('button',{name:'确认升级（保留未确认收据）'})).toHaveCount(0);
 assert.equal((await control()).maintenance.length,0);
 await check('Durable history reads as a neutral record (not an alert) beside the live blocker list, both separately labelled, and an up-to-date daemon offers no clickable upgrade');
 await page.getByRole('button',{name:'关闭后台维护'}).click();

 // 5) A daemon without a receipt endpoint reports that instead of erroring as a whole.
 await fresh({blockers:{available:true,tasks:[],agents:[],receipts:[],receiptsSupported:false}});
 await openMaintenance();
 await expect(dialog().getByText('该后台无收据端点，无法列出未确认收据；维护仍按任务/Agent 门禁执行。')).toBeVisible();
 await expect(dialog().getByRole('alert')).toHaveCount(0);
 await expect(dialog().getByRole('button',{name:'确认升级（保留未确认收据）'})).toHaveCount(0);
 await expect(dialog().getByRole('button',{name:'升级后台',exact:true})).toBeEnabled();
 await check('A daemon without a receipt endpoint is reported inline and never blocks the dialog as a whole failure');
 await page.getByRole('button',{name:'关闭后台维护'}).click();

 await collect();
 assert.equal(calls.filter(c=>c.method==='machine.maintainDaemon').length,1,'exactly one maintenance dispatch across all cases');
 assert.equal(calls.filter(c=>c.businessAttempt).length,0);
 report.status='passed';
})().catch(async error=>{report.status='failed';report.error={message:error.message,stack:error.stack};process.exitCode=1;try{report.failureText=await page.locator('body').innerText();await page?.screenshot({path:path.join(out,'failure.png')});}catch{}}).finally(async()=>{await collect();report.calls=calls;await context?.close();await browser?.close();if(server)await new Promise(r=>server.close(r));if(frozen)fs.rmSync(frozen,{recursive:true,force:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks.length,browser:report.browser,error:report.error?.message}));});
