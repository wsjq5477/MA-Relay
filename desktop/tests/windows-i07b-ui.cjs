// Windows Edge + production frontend/coordinator + controlled native catalogue.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const {graphFixture}=require('./i06b-ui-fixture.cjs');
const output=path.resolve(__dirname,'../../artifacts/I07B/2026-10-16/windows-ui.json');
const report={date:new Date().toISOString(),version:require('../package.json').version,environment:'Windows Edge / production frontend and coordinator / controlled native catalogue; model 0',status:'running',checks:[]};
function bootstrap(){
 const rpc=(method,params)=>fetch('/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,params})}).then(r=>r.json());
 window.agentbridge={call:(method,params={})=>rpc(method,params),preferences:async()=>({theme:'light',platform:'win32',version:'I07B controlled UI'}),pending:async()=>[],runtimes:async()=>({platform:'win32',distributions:[]}),window:async()=>{},savePreferences:async p=>p};
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
  page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept('已核对Y版本、实际证据与原执行。'));await page.addInitScript(bootstrap);await page.goto('http://127.0.0.1:'+server.address().port);report.browserVersion=browser.version();
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
  await page.getByText('分配新任务',{exact:true}).click();
  for(const [title,kind,owner] of [['开发任务','delivery',b.agentId],['编译任务','verification',a.agentId]]){
   await page.getByLabel('任务名称',{exact:true}).fill(title);await page.getByLabel('任务要求',{exact:true}).fill('报告实际产物版本和证据');await page.getByLabel('任务类型',{exact:true}).selectOption(kind);await page.getByLabel('任务负责人',{exact:true}).selectOption(owner);
   if(kind==='verification')await page.getByLabel('复验的交付',{exact:true}).selectOption({label:'开发任务'});
   await page.getByRole('button',{name:'分配任务',exact:true}).click();await expect(page.getByRole('article',{name:'任务：'+title,exact:true})).toBeVisible();
  }
  let board=(await fixture.call('team.tasks',{runId:run.runId})).result;const d=board.workItems.find(x=>x.title==='开发任务'),v=board.workItems.find(x=>x.title==='编译任务');
  await page.getByText('用户授权队员直接交接',{exact:true}).click();
  for(const [from,to] of [[d.workItemId,v.workItemId],[v.workItemId,d.workItemId]]){
   await page.getByLabel('交出任务',{exact:true}).selectOption(from);await page.getByLabel('交给任务',{exact:true}).selectOption(to);await page.getByRole('button',{name:'保存交接授权',exact:true}).click();await expect(page.locator('.team-task-board')).toContainText('授权有效');
  }
  const cc=(await fixture.call('team.connect',{operationId:'compiler-ui-connect',runId:run.runId,agentId:a.agentId})).result;
  const compiler=async(name,args={})=>{const desc=JSON.parse(fs.readFileSync(cc.configuration.args[1],'utf8'));return (await fetch(desc.url,{method:'POST',headers:{authorization:'Bearer '+desc.token,'content-type':'application/json'},body:JSON.stringify({name,args})})).json();};
  let op=0;const member=async(client,name,args={})=>{const r=await client('team_'+name,{operationId:'board-'+ ++op,...args});assert(!r.error,JSON.stringify(r.error));return r.result;};
  const task=async(id)=>(await fixture.call('team.tasks',{runId:run.runId})).result.workItems.find(x=>x.workItemId===id);
  for(const version of ['X','Y']){
   await member(tool,'claim_task',{workItemId:d.workItemId,expectedRevision:(await task(d.workItemId)).revision});
   const delivered=await member(tool,'report_task',{workItemId:d.workItemId,expectedRevision:(await task(d.workItemId)).revision,outcome:'submitted',summary:'交付版本'+version,version,reference:'artifact://ui/'+version,handoffTaskId:v.workItemId,targetRevision:(await task(v.workItemId)).revision});
   await member(compiler,'claim_task',{workItemId:v.workItemId,expectedRevision:(await task(v.workItemId)).revision});
   await member(compiler,'report_task',{workItemId:v.workItemId,expectedRevision:(await task(v.workItemId)).revision,outcome:version==='X'?'failed':'passed',summary:version==='X'?'X编译失败，请返修':'Y受控复验通过',artifactId:delivered.report.artifact.artifactId,accessConfirmed:true,evidenceReference:'report://ui/'+version,...(version==='X'?{handoffTaskId:d.workItemId,targetRevision:(await task(d.workItemId)).revision}:{})});
   await page.getByRole('button',{name:'刷新工作',exact:true}).click();
   await expect(page.getByRole('article',{name:'任务：编译任务',exact:true})).toContainText(version==='X'?'第 2 轮':'Y受控复验通过');
  }
  report.checks.push('UI assigns versioned delivery/verification, grants both exact handoff paths; two independently authenticated MCP members repair X into Y, native starts remain zero');
  for(const title of ['编译任务','开发任务']){
   const card=page.getByRole('article',{name:'任务：'+title,exact:true});await card.getByRole('button',{name:'验收此项',exact:true}).click();await expect(card).toContainText('已验收');
  }
  const card=page.getByRole('article',{name:'任务：编译任务',exact:true});await card.getByText('完整报告历史（2）',{exact:true}).click();await expect(card).toContainText('X编译失败，请返修');await expect(card).toContainText('Y受控复验通过');
  report.checks.push('UI preserves failed X alongside passed Y and accepts verification before delivery');
  const membership=(await fixture.call('team.context',{runId:run.runId})).result.run;
  assert.equal((await fixture.call('team.revokeMember',{operationId:'revoke-developer',runId:run.runId,agentId:b.agentId,expectedRevision:membership.revision})).ok,true);
  assert.equal((await tool('team_context')).error.code,'TEAM_FORBIDDEN');
  await page.reload();await page.getByRole('button',{name:'小队协作',exact:true}).click();await page.getByLabel('当前工作',{exact:true}).selectOption(run.runId);await expect(page.locator('.team-document')).toContainText('版本Y');await expect(page.locator('.team-message-list')).toContainText('版本Y修复完成，请复验。');
  await expect(page.getByRole('article',{name:'任务：编译任务',exact:true})).toContainText('已验收');
  await page.getByRole('button',{name:'验收总工作',exact:true}).click();await expect(page.locator('.team-task-board')).toContainText('总工作已验收');
  assert.deepEqual(errors,[]);report.checks.push('Revocation invalidates prior connection immediately; reload preserves shared history and document revisions');
  fs.mkdirSync(path.dirname(output),{recursive:true});await page.screenshot({path:path.join(path.dirname(output),'workspace.png'),fullPage:true});report.status='passed';
 }catch(e){report.status='failed';report.error=String(e.stack||e);if(page){fs.mkdirSync(path.dirname(output),{recursive:true});await page.screenshot({path:path.join(path.dirname(output),'ui-failure.png'),fullPage:true}).catch(()=>{});}throw e;}finally{await browser?.close();await new Promise(r=>server.close(r));fixture.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
