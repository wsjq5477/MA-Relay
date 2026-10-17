// Windows Edge + built production UI, controlled API, no native prompts.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const output=process.env.AGENTBRIDGE_PENDING_UI_REPORT||path.resolve(__dirname,'../../artifacts/pending-isolation/2026-10-15/ui.json');
const report={date:new Date().toISOString(),version:require('../package.json').version,environment:'Windows Edge / built production frontend / controlled API',status:'running',checks:[],nativePrompts:0};
function mock(){
  const machine={machineId:'win',name:'Windows',kind:'windows',platform:'win32',online:true};
  const nodes=['a','b'].map((id,i)=>({nodeId:id,machineId:'win',name:i?'独立节点':'原节点',adapter:'claude',executable:'C:/tools/'+id+'.exe',connected:true,executionSupported:true,online:true,healthy:true,available:true,status:'connected'}));
  const tasks=nodes.map(n=>({taskId:'t-'+n.nodeId,conversationId:'c-'+n.nodeId,nodeId:n.nodeId,targetAgent:'i-'+n.nodeId,machineId:'win',requestId:'done-'+n.nodeId,message:n.nodeId==='a'?'原会话':'独立会话',status:'succeeded',result:{message:'已完成'},updatedAt:'2026-10-15T00:00:00Z'}));
  const conversations=tasks.map(t=>({conversationId:t.conversationId,targetAgent:t.targetAgent,nodeId:t.nodeId,machineId:'win',title:t.message,turns:1,updatedAt:t.updatedAt,canContinue:true,items:[t]}));
  let scoped=true;const calls=[];
  window.agentbridge={call:async(method,p={})=>{calls.push({method,op:p.op});return {ok:true,result:method==='snapshot'?{configured:true,directory:'controlled-pending-profile',collaboration:{leaderId:'a',memberIds:[],revision:0},agents:{items:[],revision:0,connected:true},machines:[machine],nodes,tasks,conversations,instances:[],connections:[]}:method==='graphLayout'?{version:1,layoutRevision:0,groups:{},nodes:{},viewport:{x:0,y:0,zoom:1}}:method==='ipc'&&p.op==='conversation'?conversations.find(c=>c.conversationId===p.conversationId):[]};},
    preferences:async()=>({theme:'light',platform:'win32',version:'fixture'}),runtimes:async()=>({platform:'win32',distributions:[]}),
    pending:async()=>[{id:'unresolved',op:'submit',state:'unknown',machineId:'win',params:{nodeId:'a',machineId:'win'},time:'2026-10-15T00:00:00Z',...(scoped?{blockedNodeIds:['a']}:{})}],
    recoverPending:async()=>({resolved:0,remaining:1,items:[{id:'unresolved',machineId:'win',op:'submit',code:'NOT_CONFIGURED',reason:'原后台的执行配置未就绪，暂时无法核对原请求。'}]}),window:async()=>{}};
  window.pendingTest={legacy:()=>{scoped=false;},calls};
}
(async()=>{
  const root=path.resolve(__dirname,'../dist');
  const server=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html');if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
    const page=await browser.newPage({viewport:{width:1360,height:940}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(mock);await page.goto('http://127.0.0.1:'+server.address().port);
    await page.getByRole('button',{name:'会话',exact:true}).click();
    await page.locator('.conversation-choice').filter({hasText:'独立会话'}).click();await page.getByRole('textbox',{name:'继续会话'}).fill('继续独立工作');await expect(page.getByRole('button',{name:'发送',exact:true})).toBeEnabled();
    await page.locator('.conversation-choice').filter({hasText:'原会话'}).click();await page.getByRole('textbox',{name:'继续会话'}).fill('不能重放');await expect(page.getByRole('button',{name:'发送',exact:true})).toBeDisabled();report.checks.push('Independent conversation on the same machine remains usable; original node stays blocked');
    await page.getByRole('button',{name:'新建会话',exact:true}).click();await page.getByRole('textbox',{name:'需求',exact:true}).fill('新工作');await expect(page.getByRole('button',{name:'发送需求',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'选择节点',exact:true}).click();await page.locator('.node-picker button').filter({hasText:'独立节点'}).click();await expect(page.getByRole('button',{name:'发送需求',exact:true})).toBeEnabled();report.checks.push('New conversation permits independent target while preserving blocked original target');
    await page.getByRole('button',{name:'关闭新建会话',exact:true}).click();await page.evaluate(()=>window.pendingTest.legacy());await page.getByRole('button',{name:'刷新数据',exact:true}).click();
    await page.locator('.conversation-choice').filter({hasText:'独立会话'}).click();await page.getByRole('textbox',{name:'继续会话'}).fill('旧后台保护');await expect(page.getByRole('button',{name:'发送',exact:true})).toBeDisabled();report.checks.push('Older background without scope projection keeps conservative machine protection');
    await page.getByRole('button',{name:'查看操作',exact:true}).click();await expect(page.locator('.pending-operations')).toContainText('配置未就绪');
    const mutations=await page.evaluate(()=>window.pendingTest.calls.filter(c=>c.method==='nodeRequest'||['submit','continue','reply','cancel'].includes(c.op)));assert.equal(mutations.length,0);assert.deepEqual(errors,[]);report.checks.push('Configuration diagnostic is visible; all recovery remains read-only');report.status='passed';
  }catch(e){report.status='failed';report.error=String(e.stack||e);throw e;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
