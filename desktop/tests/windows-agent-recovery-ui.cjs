// Production renderer, controlled IPC and ordinary Edge input. Model calls 0.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const output=path.resolve(process.argv[2]);fs.mkdirSync(output,{recursive:true});
const report={date:new Date().toISOString(),environment:'Windows Edge / production renderer / isolated IPC',modelCalls:0,status:'running',checks:[],pageErrors:[]};
let browser,server,page;
function setup(){
 const machine={machineId:'wsl',name:'WSL Ubuntu',kind:'wsl',distribution:'Ubuntu',platform:'linux',online:true};
 const nodes=['codex','opencode','dsh-web'].map(adapter=>({nodeId:adapter,machineId:'wsl',adapter,name:adapter==='codex'?'Codex':adapter==='opencode'?'OpenCode':'DSH Web',executable:'/controlled/'+adapter,version:'2.0.24',connected:adapter!=='dsh-web',online:true,healthy:adapter!=='dsh-web',busy:false,available:adapter==='codex',executionSupported:adapter!=='opencode',activeTasks:0,status:adapter==='codex'?'connected':adapter==='opencode'?'needs_check':'configuration_required'}));
 const original={operationId:'original-opencode-attach',lane:'node',method:'manageNode',params:{operationId:'original-opencode-attach',nodeId:'opencode',machineId:'wsl',action:'attach',config:{token:'secret-must-not-render'}},state:'unknown',time:'2026-10-20T07:40:00.000Z',error:{code:'ADAPTER_HOST',message:'opencode must synchronously create a host with call() and close().'}};
 window.recoveryTest={rows:[original],calls:[],queryFails:false,confirmed:false};
 window.agentbridge={preferences:async()=>({theme:'dark',directory:'recovery-ui',platform:'win32',version:'test'}),savePreferences:async value=>value,pending:async()=>[],recoverPending:async()=>({resolved:0,items:[]}),call:async(method,p={})=>{
  const state=window.recoveryTest;state.calls.push({method,params:p});let result;
  if(method==='snapshot')result={configured:true,directory:'recovery-ui',machines:[machine],nodes,nodeManagement:true,machineManagement:true,daemonManagement:true,status:{connected:true,connectionState:'connected'},agents:{items:[],revision:0,connected:true},tasks:[],conversations:[],collaboration:{leaderId:null,memberIds:[],revision:0}};
  else if(method==='graphPending')result=state.rows;
  else if(method==='graphLayout')result={version:1,layoutRevision:0,groups:{},nodes:{},viewport:{x:0,y:0,zoom:1}};
  else if(method==='nodeOperation'){
   if(state.queryFails)return {ok:false,error:{code:'MACHINE_OFFLINE',message:'来源暂时离线'}};
   if(state.confirmed)state.rows=[];
   result={operationId:p.operationId,state:state.confirmed?'rejected':'not_found',error:{code:'ADAPTER_HOST',message:'原接入未完成'}};
  }else if(method==='discover')result={machineId:'wsl',items:[]};
  else if(method==='dsh.status')result={items:[]};
  else return {ok:false,error:{code:'FIXTURE_READ_ONLY',message:'未实现的测试入口'}};
  return {ok:true,result};
 }};
}
(async()=>{
 const dist=path.resolve(__dirname,'../dist');
 server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.join(dist,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname));if(!file.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}try{res.setHeader('content-type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({channel:'msedge',headless:true});page=await browser.newPage({viewport:{width:1440,height:1100}});await page.addInitScript(setup);page.on('pageerror',e=>report.pageErrors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 const group=page.locator('.inventory-machine');
 await expect(group.getByRole('button',{name:'重新扫描 · WSL Ubuntu',exact:true})).toBeEnabled();
 await expect(group.getByRole('button',{name:'添加 Agent · WSL Ubuntu',exact:true})).toBeEnabled();
 const codex=page.locator('.inventory-node').filter({has:page.getByRole('heading',{name:'Codex',exact:true})});
 await expect(codex.getByRole('button',{name:'开始会话',exact:true})).toBeDisabled();
 await group.getByRole('button',{name:'重新扫描 · WSL Ubuntu',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.recoveryTest.calls.filter(c=>c.method==='discover').length)).toBe(1);
 await group.getByRole('button',{name:'添加 Agent · WSL Ubuntu',exact:true}).click();await expect(page.getByRole('dialog',{name:'添加 Agent',exact:true})).toBeVisible();await page.getByRole('button',{name:'关闭添加 Agent',exact:true}).click();
 report.checks.push('Unknown management preserves execution/attach barriers but scan and Add Agent browse controls work');
 await codex.getByRole('button',{name:'原操作待核对 · 查看',exact:true}).click();
 const recovery=page.locator('.settings-recovery');await expect(recovery).toBeInViewport();await expect(recovery).toContainText('Agent 接入');await expect(recovery).toContainText('OpenCode');await expect(recovery).toContainText('original-opencode-attach');await expect(recovery).not.toContainText('当前没有未确认操作');await expect(recovery).not.toContainText('secret-must-not-render');
 await page.screenshot({path:path.join(output,'management-pending.png'),fullPage:true});
 report.checks.push('Codex recovery shortcut shows original OpenCode management ID/source/error with an empty execution journal; config secret is excluded');
 await page.evaluate(()=>{window.recoveryTest.queryFails=true;});await recovery.getByRole('button',{name:'查询原请求',exact:true}).click();await expect(recovery).toContainText('原操作查询失败');
 report.checks.push('Original query failure is visible and retains the intent and machine barrier');
 await page.evaluate(()=>{window.recoveryTest.queryFails=false;window.recoveryTest.confirmed=true;});await recovery.getByRole('button',{name:'查询原请求',exact:true}).click();await expect(recovery).toContainText('当前没有未确认操作',{timeout:15000});
 await page.getByRole('button',{name:'机器与 Agent',exact:true}).click();await expect(codex.getByRole('button',{name:'开始会话',exact:true})).toBeEnabled({timeout:15000});
 report.checks.push('Only an original terminal management receipt clears the barrier and restores Codex execution');
 const web=page.locator('.inventory-node').filter({has:page.getByRole('heading',{name:'DSH Web',exact:true})});await expect(web).toContainText('待配置服务连接');await expect(web).not.toContainText('工具检查异常');await web.getByRole('button',{name:'配置 WSL Ubuntu / DSH Web',exact:true}).click();await expect(page.getByRole('heading',{name:'DSH 服务连接',exact:true})).toBeVisible();
 report.checks.push('Unconfigured DSH Web has a working service configuration entry');
 const calls=await page.evaluate(()=>window.recoveryTest.calls);assert(!calls.some(c=>['manageNode','nodeRequest','saveCollaboration'].includes(c.method)));assert(calls.filter(c=>c.method==='nodeOperation').every(c=>c.params.operationId==='original-opencode-attach'));
 assert.deepEqual(report.pageErrors,[]);report.checks.push('No attach/prompt/control replay or new management ID; all recovery reads use the original operation');report.status='passed';
})().catch(async e=>{report.status='failed';report.error=e.stack;try{await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true});}catch{}process.exitCode=1;}).finally(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length}));});
