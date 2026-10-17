// Actual Windows Edge rendering, controlled API responses, no model execution.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const version=require('../package.json').version;
const output=process.env.AGENTBRIDGE_RECOVERY_UI_REPORT||path.resolve(__dirname,'../../artifacts/runtime-recovery/2026-10-14/ui.json');
const report={date:new Date().toISOString(),version,environment:'Windows Edge / production frontend / controlled API',status:'running',checks:[],nativePrompts:0};
function mock(){
 const machine={machineId:'win',name:'Windows',kind:'windows',platform:'win32',online:true};
 let pending=[{id:'original',op:'submit',state:'unknown',machineId:'win',params:{machineId:'win'},time:new Date().toISOString()}],mode='unknown';const calls=[];
 window.agentbridge={call:async(method,params)=>{calls.push({method,op:params?.op});return {ok:true,result:method==='snapshot'?{configured:false,directory:'controlled-profile',collaboration:{leaderId:null,memberIds:[],revision:0},agents:{items:[],revision:0,connected:true},machines:[machine],nodes:[],tasks:[],conversations:[],instances:[],connections:[]}:method==='graphLayout'?{version:1,layoutRevision:0,groups:{},nodes:{},viewport:{x:0,y:0,zoom:1}}:[]};},preferences:async()=>({theme:'light',platform:'win32',version:'fixture'}),runtimes:async()=>({platform:'win32',distributions:[]}),pending:async()=>pending,recoverPending:async()=>{calls.push({method:'recoverPending'});if(mode==='resolved'){pending=[];return {resolved:1,remaining:0,items:[]};}if(mode==='old')return {resolved:0};return {resolved:0,remaining:1,items:[{id:'original',machineId:'win',op:'submit',code:'NOT_FOUND',reason:'原机器尚无可核对回执，不能据此判断任务未执行。'}]};},window:async()=>{}};
 window.recoveryTest={mode:value=>{mode=value;},calls};
}
(async()=>{
 const root=path.resolve(__dirname,'../dist');const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),file=path.resolve(root,relative||'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1360,height:940}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(mock);await page.goto('http://127.0.0.1:'+server.address().port);
  await page.getByRole('button',{name:'查看操作',exact:true}).click();await expect(page.locator('.pending-operations')).toContainText('提交任务');await expect(page.locator('.pending-operations')).toContainText('NOT_FOUND');
  await page.getByRole('button',{name:'查询原请求',exact:true}).click();await expect(page.getByRole('status')).toContainText('仍有 1 项待确认');await expect(page.locator('.pending-operations')).toContainText('不能据此判断任务未执行');
  report.checks.push('Manual query displays unresolved count and safe original lookup reason; pending protection remains');
  await page.evaluate(()=>window.recoveryTest.mode('old'));await page.getByRole('button',{name:'查询原请求',exact:true}).click();await expect(page.getByRole('status')).toContainText('当前后台未提供具体原因');
  report.checks.push('Older background response produces explicit upgrade guidance instead of no feedback');
  await page.evaluate(()=>window.recoveryTest.mode('resolved'));await page.getByRole('button',{name:'查询原请求',exact:true}).click();await expect(page.getByRole('status')).toContainText('没有未确认操作');await expect(page.locator('.pending-operations')).toHaveCount(0);
  const calls=await page.evaluate(()=>window.recoveryTest.calls);assert.equal(calls.some(c=>['submit','continue','verify','reply','cancel'].includes(c.op)),false);assert.deepEqual(errors,[]);
  report.checks.push('Resolved original disappears with explicit result, no prompt or control replay and no browser errors');report.status='passed';
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{report.status='failed';report.error={code:e.code,message:e.message};process.exitCode=1;}).finally(()=>{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
