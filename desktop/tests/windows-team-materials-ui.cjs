// Real production renderer/Coordinator/SQLite; isolated controlled machines, no native/model execution.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const {graphFixture}=require('./i06b-ui-fixture.cjs');
async function main(){
  const base=path.resolve(__dirname,'../../artifacts/public-materials-ui/2026-10-19/ui');
  const out=path.join(base,new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(out,{recursive:true});
  const report={date:new Date().toISOString(),environment:'Windows Node/Edge, production renderer and Coordinator/SQLite, controlled machines, isolated data',modelCalls:0,status:'running',checks:[],pageErrors:[],screenshots:[]};
  const fixture=await graphFixture();let browser,server,page,delayed,releaseDelay,failClipboard=false,oldServer=false,badHash=false,missingMaterials=false;
  const observed=[];let copied='',op=0;
  const setup=async(name,p={})=>{const r=await fixture.call('team.'+name,{operationId:'setup-'+ ++op,...p});if(!r.ok)throw Error(r.error.message);return r.result;};
  try{
    const agent=await setup('registerAgent',{kind:'mcp',externalKey:'isolated-reader',name:'材料维护员',purpose:'维护测试材料'});
    const team=await setup('createTeam',{name:'材料队',leaderId:agent.agentId,memberIds:[agent.agentId],charter:'版本与任务分别核对'});
    const a=await setup('createRun',{teamId:team.teamId,name:'材料工作 A',goal:'读取精确版本',acceptance:'正确阅读和导出'});
    const b=await setup('createRun',{teamId:team.teamId,name:'材料工作 B',goal:'另一工作材料',acceptance:'工作隔离'});
    const doc=await setup('writeDocument',{runId:a.runId,title:'接口共识 <img src=x onerror=alert(1)>',content:'原版中文 😀\n<script>window.materialExecuted=true</script>',expectedRevision:0});
    await setup('writeDocument',{runId:a.runId,documentId:doc.documentId,title:doc.title,content:'当前第二版正文',expectedRevision:1});
    for(let i=2;i<=21;i++)await setup('writeDocument',{runId:a.runId,title:'材料 '+String(i).padStart(2,'0'),content:'正文 '+i,expectedRevision:0});
    await setup('writeDocument',{runId:b.runId,title:'B 工作唯一文档',content:'仅属于 B',expectedRevision:0});
    const pending={method:'team.pause',params:{operationId:'controlled-original-unknown',runId:a.runId,paused:true}};
    const root=path.resolve(__dirname,'../dist');
    server=http.createServer((req,res)=>{
      try{const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html',file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
        res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
      }catch{res.writeHead(404).end();}
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
    report.browserVersion=browser.version();report.nodeVersion=process.version;
    page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true});
    page.on('pageerror',e=>report.pageErrors.push(e.message));
    await page.exposeFunction('abCopy',value=>{if(failClipboard)throw Error('controlled clipboard denied');copied=value;});
    await page.exposeFunction('abCall',async(method,p)=>{
      observed.push({method,p});
      if(method==='team.materials'&&missingMaterials)return {ok:false,error:{code:'TEAM_METHOD',message:'旧后台不支持公共材料索引，请升级后台。'}};
      const r=await fixture.call(method,p);
      if(method==='team.materials'&&p.runId===a.runId&&delayed){const gate=delayed;delayed=null;await gate;}
      if(method==='team.document'&&r.ok){if(oldServer)return fixture.call(method,{...p,revision:undefined});if(badHash)r.result.content='corrupted';}
      return r;
    });
    await page.addInitScript(({directory,pending})=>{
      localStorage.setItem('agentbridge.team.pending.'+directory,JSON.stringify(pending));
      Object.defineProperty(navigator,'clipboard',{value:{writeText:value=>window.abCopy(value)},configurable:true});
      window.agentbridge={call:(m,p={})=>window.abCall(m,p),preferences:async()=>({theme:'light',platform:'win32',version:'CT-04 controlled UI',directory,distribution:''}),runtimes:async()=>({platform:'win32',distributions:[]}),pending:async()=>[],savePreferences:async p=>p,closeWindow:async()=>{},stop:async()=>{},machines:async()=>[]};
    },{directory:fixture.directory,pending});
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.getByRole('button',{name:'小队协作',exact:true}).click();
    await page.getByLabel('当前工作',{exact:true}).selectOption(a.runId);
    await expect(page.getByRole('button',{name:'查询原小队操作',exact:true})).toBeVisible();
    const panel=page.getByRole('region',{name:'公共材料阅读',exact:true});
    await expect(panel.getByRole('button',{name:'打开材料索引'})).toBeVisible();
    assert.equal(observed.filter(x=>x.method==='team.materials').length,0);
    await panel.getByRole('button',{name:'打开材料索引'}).click();
    await expect(panel).toContainText('文档共 21 份，本页 20 份');
    assert.equal(await panel.locator('.team-material-documents article').count(),20);
    assert.equal(await panel.locator('.team-material-documents img').count(),0);
    await expect(panel.locator('.team-material-documents')).toContainText('<img src=x onerror=alert(1)>');
    report.checks.push('Index reads on explicit open only; page 1 is bounded, HTML-like titles stay literal, pending original operation does not block read-only access.');
    await panel.getByRole('button',{name:'下一页文档'}).click();await expect(panel).toContainText('本页 1 份');
    await expect(panel.locator('.team-material-documents')).toContainText('材料 21');
    await expect(panel.getByRole('button',{name:'下一页文档'})).toBeDisabled();
    await panel.getByRole('button',{name:'上一页文档'}).click();await expect(panel).toContainText('本页 20 份');
    report.checks.push('Document pagination forwards/backwards without inventing a full-document export.');
    await panel.getByRole('button',{name:'阅读文档：'+doc.title,exact:true}).click();
    const reader=panel.getByRole('article',{name:'文档版本阅读'});
    await expect(reader).toContainText('正在阅读第 2 版');
    await reader.getByLabel('指定文档修订').fill('1');await reader.getByRole('button',{name:'读取指定版本'}).click();
    await expect(reader).toContainText('正在阅读第 1 版 · 读取时最新为第 2 版');
    await expect(reader.locator('pre')).toHaveText('原版中文 😀\n<script>window.materialExecuted=true</script>');
    assert.equal(await page.evaluate(()=>window.materialExecuted),undefined);
    await reader.getByRole('button',{name:'复制此版本文档'}).click();await expect(panel).toContainText('已复制 Markdown');
    assert(copied.includes('team-document:'+doc.documentId+':1'));assert(copied.includes('原版中文 😀'));assert(!copied.includes('当前第二版正文'));
    const downloaded=page.waitForEvent('download');await reader.getByRole('button',{name:'下载此版本 MD'}).click();const download=await downloaded;
    assert(download.suggestedFilename().endsWith('-第1版.md'));assert(!/[<>:"/\\|?*]/.test(download.suggestedFilename()));
    const saved=path.join(out,'document-revision-1.md');await download.saveAs(saved);assert.equal(fs.readFileSync(saved,'utf8'),copied);
    await panel.screenshot({path:path.join(out,'pinned-document.png')});report.screenshots.push('pinned-document.png');
    report.checks.push('Exact old revision is verified and read as text; clipboard and actual browser MD download preserve the old UTF-8 body, revision reference and digest.');
    failClipboard=true;await reader.getByRole('button',{name:'复制此版本文档'}).click();await expect(panel).toContainText('复制失败');
    await reader.getByText('此版本文档 Markdown',{exact:true}).click();assert((await reader.getByLabel('文档 Markdown',{exact:true}).inputValue()).includes('原版中文 😀'));failClipboard=false;
    report.checks.push('Denied clipboard reports failure and retains a manual Markdown copy field.');
    await reader.getByLabel('指定文档修订').fill('99');await reader.getByRole('button',{name:'读取指定版本'}).click();await expect(panel.getByRole('alert')).toContainText('指定文档修订不存在');await expect(reader.getByRole('button',{name:'下载此版本 MD'})).toHaveCount(0);
    oldServer=true;await reader.getByLabel('指定文档修订').fill('1');await reader.getByRole('button',{name:'读取指定版本'}).click();await expect(panel.getByRole('alert')).toContainText('未返回指定文档版本');oldServer=false;
    badHash=true;await reader.getByRole('button',{name:'读取指定版本'}).click();await expect(panel.getByRole('alert')).toContainText('摘要不一致');badHash=false;
    report.checks.push('Missing revisions, old-server current-document fallback and corrupted bodies never enable stale document copy/export.');
    missingMaterials=true;await panel.getByRole('button',{name:'刷新材料索引'}).click();await expect(panel.getByRole('alert')).toContainText('旧后台不支持');await expect(panel.getByRole('button',{name:'复制当前页索引'})).toHaveCount(0);missingMaterials=false;
    report.checks.push('Unsupported old backend remains an explicit error, while the original shared-document path is retained.');
    delayed=new Promise(r=>releaseDelay=r);const before=observed.filter(x=>x.method==='team.materials').length;
    await panel.getByRole('button',{name:'刷新材料索引'}).click();await expect.poll(()=>observed.filter(x=>x.method==='team.materials').length).toBe(before+1);
    await page.getByLabel('当前工作',{exact:true}).selectOption(b.runId);await expect(panel.getByRole('button',{name:'打开材料索引'})).toBeVisible();
    await panel.getByRole('button',{name:'打开材料索引'}).click();await expect(panel).toContainText('B 工作唯一文档');releaseDelay();
    await page.waitForTimeout(350);await expect(panel).not.toContainText('接口共识');await expect(panel).toContainText('文档共 1 份，本页 1 份');
    const indexDownload=page.waitForEvent('download');await panel.getByRole('button',{name:'下载当前页索引 MD'}).click();const exported=await indexDownload;await exported.saveAs(path.join(out,'work-b-index.md'));
    const indexText=fs.readFileSync(path.join(out,'work-b-index.md'),'utf8');assert(indexText.includes('材料工作 B'));assert(!indexText.includes('原版中文'));assert(!indexText.includes('接口共识'));
    report.checks.push('A delayed prior-work response cannot replace the new work view or exported index.');
    await page.setViewportSize({width:760,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const screenshot=path.join(out,'materials-work-b.png');await page.screenshot({path:screenshot,fullPage:true});report.screenshots.push('materials-work-b.png');
    const allowed=new Set(['team.snapshot','team.refresh','team.materials','team.document']);assert(observed.filter(x=>x.method.startsWith('team.')).every(x=>allowed.has(x.method)));
    assert.equal(fixture.calls.filter(x=>x.method==='nodeRequest').length,0);
    const pendingKey='agentbridge.team.pending.'+fixture.directory;assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),pendingKey),pending);
    assert.deepEqual(report.pageErrors,[]);report.checks.push('Narrow viewport has no overflow; all team interactions were reads and the original unknown operation is unchanged, with no native requests.');
    report.status='passed';
  }catch(e){report.status='failed';report.error=e.message;process.exitCode=1;if(page)await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});}
  finally{releaseDelay?.();await browser?.close();if(server)await new Promise(r=>server.close(r));fixture.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error,out}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
