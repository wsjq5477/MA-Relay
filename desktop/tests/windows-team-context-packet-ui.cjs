// Production renderer/Coordinator/SQLite. Controlled machines, no native/model execution.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const {graphFixture}=require('./i06b-ui-fixture.cjs');
async function main(){
 const base=path.resolve(__dirname,'../../artifacts/context-packet-ui/2026-10-20/ui'),out=path.join(base,new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
 const report={date:new Date().toISOString(),status:'running',environment:'Windows Node/Edge production frontend and Coordinator/SQLite, controlled machines',modelCalls:0,checks:[],pageErrors:[],screenshots:[]};
 const f=await graphFixture();let browser,server,page,releaseDelay,delayNext=false,oldServer=false,corrupt=false,clipboardDenied=false,hideUpdates=false,heldContext=null;let copied='',op=0;
 const calls=[];
 const setup=async(m,p={})=>{const r=await f.call('team.'+m,{operationId:'setup-'+ ++op,...p});assert(r.ok,JSON.stringify(r.error));return r.result;};
 const item=async(run,id)=>(await setup('tasks',{runId:run})).workItems.find(t=>t.workItemId===id);
 const claim=async(run,id)=>setup('claimTask',{runId:run,workItemId:id,expectedRevision:(await item(run,id)).revision});
 const post=async(run,id,p)=>setup('reportTask',{runId:run,workItemId:id,expectedRevision:(await item(run,id)).revision,...p});
 try{
  const a=await setup('registerAgent',{kind:'mcp',externalKey:'controlled-leader',name:'开发成员',purpose:'开发',inputs:'需求',outputs:'明确版本'});
  const b=await setup('registerAgent',{kind:'mcp',externalKey:'controlled-reviewer',name:'复核成员',purpose:'复核原材料',limitations:'不扩大范围'});
  const team=await setup('createTeam',{name:'材料队',leaderId:a.agentId,memberIds:[a.agentId,b.agentId],charter:'明确材料不扩大权限'});
  const run=await setup('createRun',{teamId:team.teamId,name:'材料工作 A',goal:'选定版本',acceptance:'准确引用'});
  const other=await setup('createRun',{teamId:team.teamId,name:'材料工作 B',goal:'隔离另一工作',acceptance:'无A内容'});
  const title='接口文档 <img src=x onerror=alert(1)>',oldBody='OLD_BODY_中文 😀\n<script>window.packetExecuted=true</script>';
  const d=await setup('writeDocument',{runId:run.runId,title,content:oldBody,expectedRevision:0});
  await setup('writeDocument',{runId:run.runId,documentId:d.documentId,title,content:'NEW_BODY_NOT_SELECTED',expectedRevision:1});
  for(let i=0;i<9;i++)await setup('writeDocument',{runId:run.runId,title:'额外文档'+i,content:'UNSELECTED_BODY',expectedRevision:0});
  await setup('writeDocument',{runId:other.runId,title:'B文档',content:'ONLY_B',expectedRevision:0});
  const task=await setup('createTask',{runId:run.runId,title:'开发交付',description:'明确轮次',ownerId:a.agentId,kind:'delivery'});
  const verify=await setup('createTask',{runId:run.runId,title:'复验',description:'核对产物',ownerId:b.agentId,kind:'verification',sourceTaskId:task.workItemId});
  await claim(run.runId,task.workItemId);const x=(await post(run.runId,task.workItemId,{outcome:'submitted',summary:'原X',version:'X',reference:'artifact://never-fetch/X'})).report.artifact;
  await claim(run.runId,verify.workItemId);await post(run.runId,verify.workItemId,{outcome:'failed',summary:'需要返修',artifactId:x.artifactId});
  await setup('handoffTask',{runId:run.runId,workItemId:verify.workItemId,toTaskId:task.workItemId,expectedRevision:(await item(run.runId,verify.workItemId)).revision,targetRevision:(await item(run.runId,task.workItemId)).revision});
  await claim(run.runId,task.workItemId);await post(run.runId,task.workItemId,{outcome:'submitted',summary:'当前Y',version:'Y',reference:'artifact://never-fetch/Y'});
  const message=await setup('postMessage',{runId:run.runId,content:'OLD_MESSAGE_SELECTED',notifyIds:[b.agentId]});
  for(let i=0;i<105;i++)await setup('postMessage',{runId:run.runId,content:'未选消息'+i});
  const pending={method:'team.pause',params:{operationId:'controlled-original-unknown',runId:run.runId,paused:true}};
  server=http.createServer((req,res)=>{try{const root=path.resolve(__dirname,'../dist'),rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html',file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});report.nodeVersion=process.version;report.browserVersion=browser.version();
  page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true});page.on('pageerror',e=>report.pageErrors.push(e.message));
  await page.exposeFunction('abCopy',v=>{if(clipboardDenied)throw Error('controlled denial');copied=v;});
  await page.exposeFunction('abCall',async(method,p)=>{
   calls.push({method,p});if(method==='team.contextPacket'&&oldServer)return {ok:false,error:{code:'TEAM_METHOD',message:'旧后台不支持选定材料包，请升级后台。'}};
   if(method==='team.refresh'&&hideUpdates&&heldContext)return {ok:true,result:heldContext};
   const r=await f.call(method,p);
   if(method==='team.refresh'&&r.ok)heldContext=structuredClone(r.result);
   if(method==='team.contextPacket'&&r.ok){if(corrupt){r.result.documents[0].content='CORRUPTED';}if(delayNext){delayNext=false;await new Promise(resolve=>{releaseDelay=resolve;});}}
   return r;
  });
  await page.addInitScript(({directory,pending})=>{localStorage.setItem('agentbridge.team.pending.'+directory,JSON.stringify(pending));Object.defineProperty(navigator,'clipboard',{value:{writeText:v=>window.abCopy(v)},configurable:true});window.agentbridge={call:(m,p={})=>window.abCall(m,p),preferences:async()=>({theme:'light',platform:'win32',version:'CT05 controlled UI',directory,distribution:''}),runtimes:async()=>({platform:'win32',distributions:[]}),pending:async()=>[],savePreferences:async p=>p,closeWindow:async()=>{},stop:async()=>{},machines:async()=>[]};},{directory:f.directory,pending});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('button',{name:'小队协作',exact:true}).click();await page.getByLabel('当前工作',{exact:true}).selectOption(run.runId);
  const panel=page.getByRole('region',{name:'选定上下文包',exact:true}),generate=panel.getByRole('button',{name:'生成只读材料包',exact:true});
  await panel.getByRole('button',{name:'打开上下文选材'}).click();await expect(generate).toBeDisabled();assert.equal(calls.filter(x=>x.method==='team.contextPacket').length,0);
  await expect(page.getByRole('button',{name:'查询原小队操作',exact:true})).toBeVisible();
  await panel.getByLabel('上下文目标成员').selectOption(b.agentId);await panel.getByLabel('选择文档：'+title,{exact:true}).check();await panel.getByLabel('材料修订：'+title,{exact:true}).selectOption('1');
  await panel.getByText('任务当前轮次（已选 0/8）',{exact:true}).click();await panel.getByLabel('选择任务：开发交付',{exact:true}).check();
  await panel.getByText('消息（已选 0/8）',{exact:true}).click();await expect(panel.getByLabel('选择消息：序号 '+message.seq,{exact:true})).toHaveCount(0);await panel.getByRole('button',{name:'读取较早消息供选择'}).click();await panel.getByLabel('选择消息：序号 '+message.seq,{exact:true}).check();
  await panel.getByText('产物版本引用（已选 0/8）',{exact:true}).click();await panel.getByLabel('选择产物：开发交付 · X',{exact:true}).check();
  report.checks.push('Explicit target and four selected kinds including pinned document revision 1, current task round 2, older paged message and immutable historical artifact X; open triggers no packet read.');
  const baseline=await setup('context',{runId:run.runId});await generate.click();const preview=panel.getByRole('article',{name:'已核对上下文包'});await expect(preview).toBeVisible();
  const markdown=await panel.getByLabel('已核对材料包 Markdown',{exact:true}).inputValue();assert(markdown.includes(oldBody));assert(!markdown.includes('NEW_BODY_NOT_SELECTED'));assert(!markdown.includes('UNSELECTED_BODY'));assert(markdown.includes('OLD_MESSAGE_SELECTED'));assert(markdown.includes('artifact://never-fetch/X'));assert(!markdown.includes('artifact://never-fetch/Y'));
  assert.equal(await page.evaluate(()=>window.packetExecuted),undefined);assert.equal(await panel.locator('img').count(),0);
  await panel.getByRole('button',{name:'复制材料包 Markdown'}).click();await expect(panel).toContainText('已复制选定材料包');assert.equal(copied,markdown);
  for(const format of ['MD','JSON']){const pendingDownload=page.waitForEvent('download');await panel.getByRole('button',{name:'下载材料包 '+format,exact:true}).click();const download=await pendingDownload;assert(!/[<>:"/\\|?*]/.test(download.suggestedFilename()));const file=path.join(out,'selected-context.'+format.toLowerCase());await download.saveAs(file);if(format==='MD')assert.equal(fs.readFileSync(file,'utf8'),markdown);else{const p=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(p.documents[0].revision,1);assert.equal(p.tasks[0].round,2);assert.equal(p.artifacts[0].version,'X');assert.equal(p.boundaries.grantsAccess,false);}}
  assert.deepEqual(await setup('context',{runId:run.runId}),baseline);report.checks.push('Verified preview and real browser MD/JSON downloads match selected old UTF-8 body; HTML remains literal, no unselected bodies and complete public state unchanged.');
  for(const row of await panel.locator('.team-context-choices > details').all())if(await row.getAttribute('open')!==null)await row.locator('summary').click();
  await panel.getByRole('heading',{name:'选定上下文包',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'selected-context.png')});report.screenshots.push('selected-context.png');
  for(const row of await panel.locator('.team-context-choices > details').all())if(await row.getAttribute('open')===null)await row.locator('summary').click();
  clipboardDenied=true;await panel.getByRole('button',{name:'复制材料包 Markdown'}).click();await expect(panel).toContainText('复制失败');assert.equal(await panel.getByLabel('已核对材料包 Markdown').inputValue(),markdown);clipboardDenied=false;
  await panel.getByLabel('上下文目标成员').selectOption(a.agentId);await expect(preview).toHaveCount(0);await generate.click();await expect(preview).toBeVisible();
  report.checks.push('Clipboard rejection keeps verified manual text; changing the target immediately removes previous preview/export controls and requires regeneration.');
  corrupt=true;await generate.click();await expect(panel.getByRole('alert')).toContainText('摘要');await expect(preview).toHaveCount(0);corrupt=false;
  oldServer=true;await generate.click();await expect(panel.getByRole('alert')).toContainText('旧后台');await expect(preview).toHaveCount(0);oldServer=false;
  report.checks.push('Corrupted response and unsupported old backend clear export controls; neither falls back to a latest document or previous packet.');
  await panel.getByRole('button',{name:'清空材料选择'}).click();await expect(generate).toBeDisabled();await panel.getByLabel('选择文档：'+title,{exact:true}).check();
  for(let i=0;i<7;i++)await panel.getByLabel('选择文档：额外文档'+i,{exact:true}).check();await expect(panel.getByLabel('选择文档：额外文档7',{exact:true})).toBeDisabled();
  report.checks.push('Per-kind selection limit is visible and enforced; clearing the selection removes preview and disables generation.');
  await panel.getByRole('button',{name:'清空材料选择'}).click();await panel.getByLabel('选择任务：开发交付',{exact:true}).check();await generate.click();await expect(preview).toBeVisible();
  // Advance the current delivery report's state via an authorized user retry scenario on a separate task.
  const next=await setup('createTask',{runId:run.runId,title:'待变化任务',description:'任务版本变化',ownerId:a.agentId,kind:'delivery'});hideUpdates=false;
  await page.getByRole('button',{name:'刷新工作',exact:true}).click();await expect(panel.getByLabel('选择任务：待变化任务',{exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'清空材料选择'}).click();await panel.getByLabel('选择任务：待变化任务',{exact:true}).check();await generate.click();await expect(preview).toBeVisible();
  hideUpdates=true;await claim(run.runId,next.workItemId);await generate.click();await expect(panel.getByRole('alert')).toContainText('轮次已变化');await expect(preview).toHaveCount(0);hideUpdates=false;
  await page.getByRole('button',{name:'刷新工作',exact:true}).click();await expect(panel).toContainText('所选任务修订或轮次已变化');await expect(generate).toBeDisabled();
  report.checks.push('A task changed after selection is rejected by production backend; refreshed task revision invalidates preview and requires explicit reselection.');
  await panel.getByRole('button',{name:'清空材料选择'}).click();await panel.getByLabel('选择文档：'+title,{exact:true}).check();await panel.getByLabel('上下文目标成员').selectOption(b.agentId);await generate.click();await expect(preview).toBeVisible();
  await setup('revokeMember',{runId:run.runId,agentId:b.agentId,expectedRevision:(await setup('context',{runId:run.runId})).run.revision});await page.getByRole('button',{name:'刷新工作',exact:true}).click();await expect(panel).toContainText('原目标已不在当前有效成员');await expect(preview).toHaveCount(0);await expect(generate).toBeDisabled();
  report.checks.push('Revoking the chosen target removes preview/export controls on current work refresh and blocks generation without changing original pending operation.');
  await panel.getByLabel('上下文目标成员').selectOption(a.agentId);delayNext=true;await generate.click();await expect.poll(()=>!!releaseDelay).toBe(true);
  await page.getByLabel('当前工作',{exact:true}).selectOption(other.runId);const bpanel=page.getByRole('region',{name:'选定上下文包',exact:true});await bpanel.getByRole('button',{name:'打开上下文选材'}).click();releaseDelay();releaseDelay=null;
  await expect(bpanel.getByRole('article',{name:'已核对上下文包'})).toHaveCount(0);await expect(bpanel).not.toContainText('OLD_BODY');
  await bpanel.getByLabel('上下文目标成员').selectOption(a.agentId);await bpanel.getByLabel('选择文档：B文档',{exact:true}).check();await bpanel.getByRole('button',{name:'生成只读材料包',exact:true}).click();await expect(bpanel.getByRole('article',{name:'已核对上下文包'})).toBeVisible();assert((await bpanel.getByLabel('已核对材料包 Markdown').inputValue()).includes('ONLY_B'));
  report.checks.push('Late A response is discarded after switching work; B starts with empty explicit selection and exports only its own selected materials.');
  await page.setViewportSize({width:760,height:920});await expect(bpanel.getByRole('button',{name:'下载材料包 JSON'})).toBeVisible();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await bpanel.getByRole('heading',{name:'选定上下文包',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'narrow-context.png')});report.screenshots.push('narrow-context.png');
  const allowed=new Set(['team.snapshot','team.refresh','team.messages','team.contextPacket']);assert(calls.filter(x=>x.method.startsWith('team.')).every(x=>allowed.has(x.method)));assert.equal(f.calls.filter(x=>x.method==='nodeRequest').length,0);
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),'agentbridge.team.pending.'+f.directory),pending);assert.deepEqual(report.pageErrors,[]);
  report.checks.push('Narrow viewport has no horizontal overflow, renderer made read-only team calls, no native requests and original unknown localStorage intent retained.');report.status='passed';
 }catch(e){report.status='failed';report.error=e.message;process.exitCode=1;if(page)await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});}
 finally{releaseDelay?.();await browser?.close();if(server)await new Promise(r=>server.close(r));f.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error,out}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
