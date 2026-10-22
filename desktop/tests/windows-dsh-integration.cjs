// Real Windows Edge, production renderer, isolated API fixtures; model calls 0.
// I08-MCP02: the unified "AgentBridge MCP 操作" card (native load/connection/
// tools/authorization/ownership) is separate from the DSH service connection.
// A full native-visibility run must add mcp.status/mcp.probe/mcp.revoke fixtures
// and click 重新探测原生列表 / 撤销连接授权; this file keeps only the service flow.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const output=path.resolve(process.argv[2]);fs.mkdirSync(output,{recursive:true});
const report={date:new Date().toISOString(),environment:'Windows Node / Edge / frozen production renderer / controlled API',modelCalls:0,checks:[],pageErrors:[],externalRequests:[]};
let browser,server;
function setup(){
  const machines=[{machineId:'windows',name:'Windows 本机',kind:'windows',platform:'win32',online:true},{machineId:'wsl',name:'WSL Web',kind:'wsl',platform:'linux',online:true}];
  const nodes=['dsh-desktop','dsh-web'].map((adapter,i)=>({nodeId:adapter,machineId:machines[i].machineId,adapter,name:i?'DSH Web':'DSH Desktop',executable:'/controlled/'+adapter,version:'web-api-v1',connected:true,online:true,healthy:true,busy:false,available:true,executionSupported:true,teamCollaboration:false,activeTasks:0,status:'connected',connectionCapabilities:{execution:true,delegation:true,mcpClient:true,nativeMcpConfig:adapter==='dsh-web',hostManagedTask:false,bridgeMcp:true,resume:true,cancellation:true,permissions:false,forms:false,verification:false}}));
  const saved={windows:[],wsl:[]};window.dshTest={saved,writes:0,executions:0};
  window.agentbridge={preferences:async()=>({theme:'light',directory:'dsh-ui',platform:'win32'}),savePreferences:async v=>v,pending:async()=>[],call:async(method,p={})=>{
    if(method==='snapshot')return {ok:true,result:{configured:true,directory:'dsh-ui',machines,nodes,nodeManagement:true,machineManagement:true,daemonManagement:true,status:{connected:true,connectionState:'connected'},agents:{items:[],revision:1,connected:true},tasks:[],conversations:[],collaboration:{leaderId:null,memberIds:[],revision:0}}};
    if(method==='dsh.status')return {ok:true,result:{items:saved[p.machineId]}};
    if(method==='dsh.configure'){
      window.dshTest.writes++;if(p.token!=='fixture-connection-token')return {ok:false,error:{code:'FIXTURE_TOKEN',message:'Wrong fixture token'}};
      saved[p.machineId]=[{adapter:p.adapter,origin:new URL(p.url).origin,enabled:true,executable:'/controlled/connection.json'}];return {ok:true,result:{items:saved[p.machineId]}};
    }
    if(method==='graphPending')return {ok:true,result:[]};
    if(method==='nodeRequest')window.dshTest.executions++;
    return {ok:false,error:{code:'FIXTURE_READ_ONLY',message:'No fixture implementation for '+method}};
  }};
}
(async()=>{
  const dist=path.resolve(__dirname,'../dist');
  server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.join(dist,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname));if(!file.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}try{res.setHeader('content-type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100}});await page.addInitScript(setup);
  page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin))report.externalRequests.push(r.url());});
  await page.goto(origin);await page.getByRole('button',{name:'概览',exact:true}).click();
  for(const name of ['DSH Desktop','DSH Web']){const row=page.locator('.inventory-node').filter({has:page.getByRole('heading',{name,exact:true})});await expect(row.getByRole('button',{name:'开始会话'})).toBeEnabled();await expect(row).toContainText('可被委派');await expect(row).toContainText('可调用 Bridge MCP');await expect(row).not.toContainText('暂不能调用 Bridge MCP');await expect(row.locator('.agent-brand-icon img').first()).toBeVisible();}
  report.checks.push('Desktop and Web have bundled icons, enabled direct conversations and independent MCP-caller wording; hosted-task binding stays unadapted');await page.screenshot({path:path.join(output,'inventory.png'),fullPage:true});
  await page.getByRole('button',{name:'配置 Windows 本机 / DSH Desktop',exact:true}).click();
  // The unified MCP card is capability-driven: DSH Desktop has an MCP client but
  // no Bridge-managed native config path, so it shows the manual note + export
  // and no install/probe button. DSH Web below owns the managed config.
  await expect(page.getByRole('heading',{name:'AgentBridge MCP 操作',exact:true})).toBeVisible();
  await expect(page.getByText('该产品已有 MCP 客户端，但 Bridge 暂不能管理它的原生 MCP 配置',{exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'添加 Bridge MCP',exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'DSH 服务连接',exact:true})).toBeVisible();
  await expect(page.getByLabel('DSH 连接 token',{exact:true})).toHaveAttribute('type','password');
  await page.getByLabel('DSH 连接 token',{exact:true}).fill('fixture-connection-token');
  await page.getByRole('button',{name:'关闭 Agent 配置',exact:true}).click();
  await page.getByRole('button',{name:'配置 WSL Web / DSH Web',exact:true}).click();
  await expect(page.getByRole('heading',{name:'AgentBridge MCP 操作',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'添加 Bridge MCP',exact:true})).toBeVisible();
  await expect(page.getByLabel('DSH 连接 token',{exact:true})).toHaveValue('');
  report.checks.push('Switching node configuration clears secret input and binds the WSL Web target');
  await page.getByLabel('DSH 服务地址',{exact:true}).fill('http://127.0.0.1:3080/');await page.getByLabel('DSH 连接 token',{exact:true}).fill('fixture-connection-token');await page.getByRole('button',{name:'保存 DSH 连接',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'连接已保存'})).toBeVisible();await expect(page.getByLabel('DSH 连接 token',{exact:true})).toHaveValue('');
  const state=await page.evaluate(()=>({writes:window.dshTest.writes,executions:window.dshTest.executions,windows:window.dshTest.saved.windows.length,wsl:window.dshTest.saved.wsl.length,visible:document.body.innerText}));
  assert.equal(state.writes,1);assert.equal(state.executions,0);assert.equal(state.windows,0);assert.equal(state.wsl,1);assert(!state.visible.includes('fixture-connection-token'));report.checks.push('Saving routes only to the selected WSL machine, clears secret, starts zero tasks, and retains token-free visible status');
  await page.screenshot({path:path.join(output,'settings.png'),fullPage:true});assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.externalRequests,[]);report.status='passed';
})().catch(e=>{report.status='failed';report.error=e.stack;process.exitCode=1;}).finally(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length}));});
