const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test'),{mock}=require('./ui-workspace-fixture.cjs');
const root=path.resolve(__dirname,'../dist'),out=path.resolve(__dirname,'../../artifacts/issue32-ui');fs.mkdirSync(out,{recursive:true});
function control(){
 const original=window.agentbridge.call;window.__confirmCalls=[];let cleared=false;
 window.agentbridge.call=async(method,params={})=>{
  if(method==='machine.confirmMaintenanceNotRun'){window.__confirmCalls.push(params);cleared=true;return {ok:true,result:{operationId:params.operationId,state:'rejected'}};}
  const result=await original(method,params);
  if(method==='machine.operation'&&cleared)return {ok:true,result:{operationId:params.operationId,state:'rejected'}};
  if(method==='snapshot'&&result.ok)for(const machine of result.result.machines)if(machine.machineId==='remote'&&!cleared)machine.daemonMaintenance={operationId:'original',state:'unknown',action:'upgrade',error:{code:'DAEMON_MAINTENANCE_NOT_FOUND',message:'未找到'}};
  return result;
 };
}
(async()=>{let browser,server;try{
 server=http.createServer((req,res)=>{try{const p=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html');if(!p.startsWith(root+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:960}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(mock,{});await page.addInitScript(control);await page.goto('http://127.0.0.1:'+server.address().port);const group=page.locator('.inventory-machine').filter({hasText:'远端测试机器'});await expect(group).toBeVisible();await group.getByRole('button',{name:'原操作待核对 · 查看',exact:true}).first().click();const dialog=page.getByRole('dialog',{name:'后台维护',exact:true});await expect(dialog).toBeVisible();const button=dialog.getByRole('button',{name:'确认并解除占用'});await expect(button).toBeDisabled();await dialog.getByRole('checkbox',{name:'我确认本次维护未执行'}).check();await expect(button).toBeEnabled();await page.screenshot({path:path.join(out,'confirmation.png')});await page.setViewportSize({width:800,height:760});await page.screenshot({path:path.join(out,'confirmation-narrow.png')});await button.click();await expect.poll(()=>page.evaluate(()=>window.__confirmCalls.length)).toBe(1);const calls=await page.evaluate(()=>window.__confirmCalls);assert.deepEqual(calls[0],{operationId:'original',connectionId:'fixture-ssh',machineId:'remote',confirmNotRun:true});await expect(button).toHaveCount(0);assert.deepEqual(errors,[]);console.log('controlled UI confirmation passed');
 }finally{await browser?.close();await new Promise(r=>server?server.close(r):r());}})().catch(e=>{console.error(e);process.exitCode=1;});
