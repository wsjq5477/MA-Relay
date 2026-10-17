// Production UI/Coordinator/AgentNetwork; controlled native backend, model 0.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const {graphFixture}=require('./i06b-ui-fixture.cjs');
const out=path.resolve(__dirname,'../../artifacts/I07C-stop/2026-10-16/windows-ui.json');
const report={date:new Date().toISOString(),version:require('../package.json').version,environment:'Windows Edge / production frontend, Coordinator, SQLite and AgentNetwork; controlled native backend, model 0',status:'running',checks:[]};
function bootstrap(){
 window.agentbridge={call:(method,params={})=>fetch('/rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,params})}).then(r=>r.json()),preferences:async()=>({theme:'light',platform:'win32',version:'I07C stop controlled UI'}),pending:async()=>[],runtimes:async()=>({platform:'win32',distributions:[]}),window:async()=>{},savePreferences:async p=>p};
}
(async()=>{
 const f=await graphFixture({nativeExecution:true,loseCancelAck:true});let browser,server,loseStopAck=true,oldStopCapability=true;let op=0;
 const call=async(name,p={})=>{const r=await f.call('team.'+name,{operationId:'stop-ui-'+ ++op,...p});assert(r.ok,JSON.stringify(r.error));return r.result;};
 try{
  const node=f.nodes.find(n=>n.adapter==='claude'),host=f.hosts.get(node.machineId);
  const a=await call('registerAgent',{kind:'native',nodeId:node.nodeId,name:'原生成员',purpose:'受控原生执行'}),b=await call('registerAgent',{kind:'mcp',externalKey:'external',name:'外部成员',purpose:'由原入口执行'});
  const team=await call('createTeam',{name:'停止验证队',leaderId:a.agentId,memberIds:[a.agentId,b.agentId]});
  const run=await call('createRun',{teamId:team.teamId,name:'停止与原终态验证',goal:'核对停止流程',acceptance:'实际终态后归档'});
  await call('execute',{runId:run.runId,agentId:a.agentId,message:'受控权限等待任务'});
  const root=path.resolve(__dirname,'../dist');
  server=http.createServer(async(req,res)=>{
   if(req.url==='/rpc'){
    try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1048576)throw Error('limit');}const p=JSON.parse(raw),r=await f.call(p.method,p.params);res.setHeader('Content-Type','application/json');
     if(oldStopCapability&&['team.context','team.refresh'].includes(p.method)&&r.ok)delete r.result.stopSupported;
     if(p.method==='team.stopRun'&&loseStopAck&&r.ok){loseStopAck=false;res.end(JSON.stringify({ok:false,error:{code:'DESKTOP_TRANSPORT',message:'停止回应未确认，请查询原小队操作。'}}));}else res.end(JSON.stringify(r));
    }catch{res.writeHead(500).end();}return;
   }
   const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html');if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
   try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});report.browserVersion=browser.version();
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(bootstrap);await page.goto('http://127.0.0.1:'+server.address().port);
  await page.getByRole('button',{name:'小队协作',exact:true}).click();await page.getByLabel('当前工作',{exact:true}).selectOption(run.runId);
  await expect(page.getByRole('button',{name:'停止本项工作',exact:true})).toBeDisabled();
  await expect(page.locator('.team-workspace')).toContainText('当前后台尚不支持停止整项工作');
  oldStopCapability=false;await page.getByRole('button',{name:'刷新工作',exact:true}).click();await expect(page.getByRole('button',{name:'停止本项工作',exact:true})).toBeEnabled();
  report.checks.push('An old Coordinator without stop capability disables the new action and explains the backend upgrade requirement');
  await expect(page.locator('.team-attempt')).toContainText('需要用户处理原生权限等待（1 项）');
  assert(!await page.locator('.team-workspace').innerText().then(t=>t.includes('private-tool-arguments')||t.includes('private-controlled-permission')));
  report.checks.push('Team UI shows original permission waiting category/count without private tool arguments or permission identity');
  page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'停止本项工作',exact:true}).click();
  assert.equal(host.calls.filter(c=>c.p.op==='cancel').length,0);assert.equal((await call('context',{runId:run.runId})).run.state,'active');
  report.checks.push('Dismissing explicit stop confirmation leaves scheduling, access and native execution unchanged');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'停止本项工作',exact:true}).click();
  await expect(page.getByRole('button',{name:'查询原小队操作',exact:true})).toBeVisible();await page.getByRole('button',{name:'查询原小队操作',exact:true}).click();
  await expect(page.getByRole('button',{name:'查询原小队操作',exact:true})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'工作停止进度'})).toContainText('还有 1 项原生执行待核对终态');
  await expect(page.getByRole('button',{name:'执行这一轮',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'停止本项工作',exact:true})).toBeDisabled();
  assert.equal(host.calls.filter(c=>c.p.op==='cancel').length,1);
  report.checks.push('Lost stop ACK recovers the original operation; new execution is disabled, one original cancel is sent');
  await page.getByRole('button',{name:'刷新工作',exact:true}).click();
  await expect(page.locator('.team-attempt')).toContainText('取消操作已确认，仍以原执行终态为准');
  await expect(page.getByRole('region',{name:'工作停止进度'})).toContainText('外部 MCP 成员');
  assert.equal((await call('context',{runId:run.runId})).run.state,'stopping');
  report.checks.push('Confirmed cancel receipt stays distinct from native terminal, with accurate external-member stop boundary');
  host.tasks[0].status='unknown';delete host.tasks[0].waiting;
  await page.reload();await page.getByRole('button',{name:'小队协作',exact:true}).click();await page.getByLabel('当前工作',{exact:true}).selectOption(run.runId);
  await expect(page.locator('.team-attempt')).toContainText('上次观察到原生权限等待');assert.equal(host.calls.filter(c=>c.p.op==='cancel').length,1);
  report.checks.push('Reload and unknown snapshot preserve stop progress and last observed waiting, without another execution/control');
  host.tasks[0].status='cancelled';await page.getByRole('button',{name:'刷新工作',exact:true}).click();
  await expect(page.getByRole('heading',{name:'本项工作已停止并归档',exact:true})).toBeVisible();await expect(page.locator('.team-attempt')).toContainText('本轮已取消');
  assert.equal((await call('context',{runId:run.runId})).acceptance,null);assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(path.dirname(out),'workspace.png'),fullPage:true});
  report.checks.push('Only the original cancelled terminal archives the work, preserves history and does not accept business success');report.status='passed';
 }finally{await browser?.close();if(server)await new Promise(r=>server.close(r));f.close();}
})().catch(e=>{report.status='failed';report.error={code:e.code||'ASSERTION',message:e.message};process.exitCode=1;}).finally(()=>{fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
