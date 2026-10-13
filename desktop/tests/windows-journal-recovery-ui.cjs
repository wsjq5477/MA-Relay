// Isolated frontend Mock: automatic read-only receipt recovery, no native task.
const fs=require('node:fs'),path=require('node:path');
const {chromium,expect}=require(path.resolve(__dirname,'../node_modules/@playwright/test'));
const report={date:new Date().toISOString(),status:'running',scope:'isolated frontend Mock',checks:[],errors:[]};
function mock(){
 const machine={machineId:'win',name:'Windows',kind:'windows',platform:'win32',online:true};
 const agent={agentId:'win::agent',machineId:'win',name:'Claude',adapter:'claude',workspace:'D:/mock',enabled:true,available:true,online:true,healthy:true,busy:false,default:true};
 let pending=[{id:'original',op:'verify',state:'unknown',machineId:'win',params:{machineId:'win'},time:new Date().toISOString()}];
 const calls=[];let resolveRecovery;
 window.agentbridge={call:async(method,p={})=>{calls.push({method,params:p});return {ok:true,result:method==='snapshot'?{configured:true,agents:{items:[agent],revision:1,connected:true},instances:[agent],machines:[machine],connections:[],tasks:[],conversations:[],status:{connected:true},directory:'/mock'}:{home:'/mock',cwd:'/mock',node:'mock'}};},preferences:async()=>({theme:'light',platform:'win32',version:'0.4.7'}),runtimes:async()=>({platform:'win32',distributions:[]}),pending:async()=>pending,recoverPending:async()=>{calls.push({method:'recover-pending'});return new Promise(r=>{resolveRecovery=r;});},window:async()=>{}};
 window.journalTest={calls,resolve:()=>{pending=[];resolveRecovery({resolved:1});},unknown:()=>{pending=[{id:'unresolved',op:'submit',state:'unknown',machineId:'win',params:{machineId:'win'},time:new Date().toISOString()}];},keep:()=>resolveRecovery({resolved:0})};
}
(async()=>{
 const browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1360,height:940}});page.on('pageerror',e=>report.errors.push(e.message));await page.addInitScript(mock);await page.goto(process.argv[2]||'http://127.0.0.1:4199');
 await expect(page.locator('.notice-banner')).toContainText('1 个操作');report.checks.push('未确认操作仍明确提示，不预先放行');
 await expect.poll(()=>page.evaluate(()=>window.journalTest.calls.filter(c=>c.method==='recover-pending').length)).toBe(1);report.checks.push('进入界面自动发起只读收据核对');
 await page.getByRole('button',{name:'设置',exact:true}).click();await expect(page.locator('.pending-operations')).toContainText('连接验证');report.checks.push('验证操作显示正确名称');
 await page.evaluate(()=>window.journalTest.resolve());await expect(page.locator('.notice-banner')).toHaveCount(0);await expect(page.locator('.pending-operations')).toHaveCount(0);report.checks.push('后台证据确认后自动清除提示');
 await page.evaluate(()=>window.journalTest.unknown());await expect(page.locator('.notice-banner')).toContainText('1 个操作');await expect.poll(()=>page.evaluate(()=>window.journalTest.calls.filter(c=>c.method==='recover-pending').length)).toBe(2);await page.evaluate(()=>window.journalTest.keep());await expect(page.locator('.notice-banner')).toHaveCount(1);report.checks.push('无法核对的操作继续保留保护');
 const calls=await page.evaluate(()=>window.journalTest.calls);if(calls.some(c=>['submit','continue','verify','reply','cancel'].includes(c.params?.op)))throw Error('Prompt or control replayed');report.checks.push('恢复过程未自动提交任务或控制请求');
 if(report.errors.length)throw Error(report.errors.join(';'));report.status='passed';
 }finally{await browser.close();}
})().catch(e=>{report.status='failed';report.errors.push(e.stack);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.resolve(__dirname,'../../artifacts/I04G-journal-ui.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));});
