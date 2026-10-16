// Windows Edge + production frontend/coordinator + controlled native catalogue.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const {graphFixture}=require('./i06b-ui-fixture.cjs');
const output=path.resolve(__dirname,'../../artifacts/I07A/2026-10-15/windows-ui.json');
const report={date:new Date().toISOString(),version:require('../package.json').version,environment:'Windows Edge / production frontend and coordinator / controlled native catalogue; model 0',status:'running',checks:[]};
function bootstrap(){
 const rpc=(method,params)=>fetch('/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,params})}).then(r=>r.json());
 window.agentbridge={call:(method,params={})=>rpc(method,params),preferences:async()=>({theme:'light',platform:'win32',version:'I07A controlled UI'}),pending:async()=>[],runtimes:async()=>({platform:'win32',distributions:[]}),window:async()=>{},savePreferences:async p=>p};
}
(async()=>{
 const fixture=await graphFixture(),root=path.resolve(__dirname,'../dist');let browser,page,loseAck=true;
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/rpc'){
   try{let body='';for await(const chunk of req){body+=chunk;if(body.length>1048576)throw Error('limit');}const input=JSON.parse(body),r=await fixture.call(input.method,input.params);
    res.setHeader('content-type','application/json');
    if(loseAck&&input.method==='team.postMessage'&&input.params.content==='原消息只保存一次'){loseAck=false;res.end(JSON.stringify({ok:false,error:{code:'DESKTOP_TRANSPORT',message:'受控回应丢失，请查询原小队操作。'}}));}else res.end(JSON.stringify(r));
   }catch{res.writeHead(500).end();}return;
  }
  const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html');if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
  page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.addInitScript(bootstrap);await page.goto('http://127.0.0.1:'+server.address().port);report.browserVersion=browser.version();
  await page.getByRole('button',{name:'小队协作',exact:true}).click();await page.getByRole('button',{name:'智能体',exact:true}).click();
  for(const [id,name,purpose] of [['compiler','编译员','编译并报告错误'],['developer','开发员','修复代码']]){
   await page.getByLabel('接入方式',{exact:true}).selectOption('mcp');await page.getByLabel('外部实例标识',{exact:true}).fill(id);await page.getByLabel('智能体名称',{exact:true}).fill(name);await page.getByLabel('职责与适用任务',{exact:true}).fill(purpose);await page.getByRole('button',{name:'保存智能体',exact:true}).click();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  }
  report.checks.push('User registers two distinct externally configured agent entries and their roles');
  await page.getByRole('button',{name:'小队设置',exact:true}).click();await page.getByLabel('小队名称',{exact:true}).fill('开发验证队');await page.getByLabel('编译员 — 编译并报告错误',{exact:true}).check();await page.getByLabel('开发员 — 修复代码',{exact:true}).check();
  const state=(await fixture.call('team.snapshot')).result;const a=state.agents.find(a=>a.name==='编译员'),b=state.agents.find(a=>a.name==='开发员');
  await page.getByLabel('主智能体',{exact:true}).selectOption(a.agentId);await page.getByLabel('小队公共约定',{exact:true}).fill('先说明代码版本，失败报告公开，不扩大权限。');await page.getByRole('button',{name:'保存小队',exact:true}).click();await expect(page.getByRole('heading',{name:'开发验证队',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'工作空间',exact:true}).click();await page.getByLabel('选择小队',{exact:true}).selectOption({label:'开发验证队'});await page.getByLabel('工作名称',{exact:true}).fill('实现并验证');await page.getByLabel('工作目标',{exact:true}).fill('修复并编译');await page.getByLabel('完成标准',{exact:true}).fill('相同版本有编译证据');await page.getByRole('button',{name:'建立工作空间',exact:true}).click();await expect(page.getByRole('heading',{name:'实现并验证',exact:true})).toBeVisible();
  await expect(page.locator('.team-members')).toContainText('编译员 · 主智能体');report.checks.push('Team, leader, charter, goal and acceptance are saved in real coordinator storage');
  const s=(await fixture.call('team.snapshot')).result,run=s.runs[0];
  await page.getByRole('button',{name:'新建共享文档',exact:true}).click();await page.getByLabel('文档标题',{exact:true}).fill('接口共识');await page.getByLabel('文档内容',{exact:true}).fill('版本X');
  await page.getByRole('dialog',{name:'编辑共享文档'}).getByLabel('开发员',{exact:true}).check();await page.getByRole('button',{name:'保存共享文档',exact:true}).click();await expect(page.getByRole('heading',{name:/接口共识/})).toBeVisible();
  await page.getByRole('textbox',{name:'工作群消息',exact:true}).fill('原消息只保存一次');await page.getByRole('button',{name:'发送群消息',exact:true}).click();await expect(page.getByRole('button',{name:'查询原小队操作',exact:true})).toBeVisible();await page.getByRole('button',{name:'查询原小队操作',exact:true}).click();await expect(page.getByRole('button',{name:'查询原小队操作',exact:true})).toHaveCount(0);
  assert.equal((await fixture.call('team.context',{runId:run.runId})).result.messages.filter(m=>m.content==='原消息只保存一次').length,1);report.checks.push('Lost post ACK is recovered by original receipt query, no duplicate group message');
  await page.locator('.team-members article').filter({hasText:'开发员 · 队员'}).getByRole('button',{name:'生成接入配置',exact:true}).click();
  const configuration=JSON.parse(await page.getByLabel('本机 MCP 配置',{exact:true}).inputValue()).mcpServers.agentbridge;
  const descriptor=JSON.parse(fs.readFileSync(configuration.args[1],'utf8'));
  const tool=async(name,args={})=>{const r=await fetch(descriptor.url,{method:'POST',headers:{authorization:'Bearer '+descriptor.token,'content-type':'application/json'},body:JSON.stringify({name,args})});return r.json();};
  await page.getByRole('button',{name:'关闭接入配置',exact:true}).click();
  const doc=(await fixture.call('team.context',{runId:run.runId})).result.documents[0];
  assert.equal((await tool('team_update_document',{operationId:'external-edit',documentId:doc.documentId,expectedRevision:1,title:'接口共识',content:'版本Y'})).result.revision,2);
  await tool('team_post_message',{operationId:'external-report',content:'版本Y修复完成，请复验。',notifyIds:[a.agentId]});
  await page.getByRole('button',{name:'刷新工作',exact:true}).click();await expect(page.locator('.team-document')).toContainText('版本Y');await expect(page.locator('.team-message-list')).toContainText('版本Y修复完成，请复验。');report.checks.push('Member-scoped authenticated MCP updates authorized document and posts a report visible to the leader');
  const membership=(await fixture.call('team.context',{runId:run.runId})).result.run;
  assert.equal((await fixture.call('team.revokeMember',{operationId:'revoke-developer',runId:run.runId,agentId:b.agentId,expectedRevision:membership.revision})).ok,true);
  assert.equal((await tool('team_context')).error.code,'TEAM_FORBIDDEN');
  await page.reload();await page.getByRole('button',{name:'小队协作',exact:true}).click();await page.getByLabel('当前工作',{exact:true}).selectOption(run.runId);await expect(page.locator('.team-document')).toContainText('版本Y');await expect(page.locator('.team-message-list')).toContainText('版本Y修复完成，请复验。');
  assert.deepEqual(errors,[]);report.checks.push('Revocation invalidates prior connection immediately; reload preserves shared history and document revisions');
  fs.mkdirSync(path.dirname(output),{recursive:true});await page.screenshot({path:path.join(path.dirname(output),'workspace.png'),fullPage:true});report.status='passed';
 }catch(e){report.status='failed';report.error=String(e.stack||e);if(page){fs.mkdirSync(path.dirname(output),{recursive:true});await page.screenshot({path:path.join(path.dirname(output),'ui-failure.png'),fullPage:true}).catch(()=>{});}throw e;}finally{await browser?.close();await new Promise(r=>server.close(r));fixture.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
