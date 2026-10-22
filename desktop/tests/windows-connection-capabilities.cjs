// Current production renderer with synthetic data. The only permitted mutation
// is one simulated relation save whose response is lost; no backend/model exists.
// I08-MCP02: the four capability dimensions are independent. This synthetic run
// covers inventory/graph admission only; native MCP config visibility now needs
// the Agent configuration dialog's 重新探测原生列表 (mcp.probe) and 撤销连接授权
// (mcp.revoke + window.confirm) actions against a fixture that implements them.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {chromium,expect}=require('../node_modules/@playwright/test');
const base=path.resolve(__dirname,'../../artifacts/connection-capabilities/2026-10-18/ui');
const out=path.join(base,new Date().toISOString().replace(/[:.]/g,'-'));
let browser,server,page,frozen;
const report={date:new Date().toISOString(),status:'running',environment:'Windows Edge / frozen production renderer / synthetic directional capabilities and simulated lost relation ACK',modelExecutions:0,realBackendCalls:0,checks:[],screenshots:[],pageErrors:[]};
function mock(){
  const historical=new URL(location.href).searchParams.has('historical');
  const mode=historical?'historical':'normal',directory='capability-browser-'+mode;
  // MCP client support, native config management, hosted-task binding and
  // execution are projected separately by the backend; hermes/pi/dsh keep an
  // unknown MCP client instead of the old "not reviewed" false claim.
  const capabilities={execution:true,delegation:true,mcpClient:true,nativeMcpConfig:true,hostManagedTask:true,bridgeMcp:true,resume:true,cancellation:true,permissions:false,forms:false,verification:false};
  const unknownMcp={...capabilities,mcpClient:null,nativeMcpConfig:false,hostManagedTask:false,bridgeMcp:null};
  const reviewedCaps={claude:capabilities,opencode:capabilities,codex:capabilities,hermes:unknownMcp,pi:unknownMcp,dsh:unknownMcp};
  const nodes=[['claude','claude','Claude'],['opencode','opencode','OpenCode'],['codex','codex','Codex'],['hermes','hermes','Hermes'],['pi','pi','Pi'],['dsh','dsh','DSH'],['no-mcp','codex','调用能力未知'],['no-execution','claude','执行能力未知'],['unknown','unregistered','未知工具']].map(([nodeId,adapter,name],i)=>({nodeId,adapter,name,machineId:'machine-'+Math.floor(i/3),executable:'C:/fixture/'+nodeId+'.exe',version:'controlled',connected:true,executionSupported:true,online:true,healthy:true,busy:false,available:true,activeTasks:0,status:'connected',connectionCapabilities:reviewedCaps[adapter]||capabilities,capabilitySource:{kind:'static-adapter',adapterId:adapter},...(nodeId==='no-mcp'?{connectionCapabilities:{...capabilities,mcpClient:null,bridgeMcp:null}}:nodeId==='no-execution'?{connectionCapabilities:{...capabilities,execution:null}}:nodeId==='unknown'?{connectionCapabilities:capabilities,capabilitySource:{kind:'static-adapter',adapterId:'unregistered'}}:{})}));
  const machines=[0,1,2].map(i=>({machineId:'machine-'+i,name:'受控机器 '+i,kind:'windows',platform:'win32',online:true}));
  const layout={version:1,layoutRevision:1,groups:Object.fromEntries(machines.map((m,i)=>[m.machineId,{x:20+i*410,y:20}])),nodes:Object.fromEntries(nodes.map((n,i)=>[n.nodeId,{x:40,y:130+i%3*155}])),viewport:{x:5,y:5,zoom:.7}};
  const relation={leaderId:historical?'hermes':'claude',memberIds:[],revision:1};
  const preferences={directory,theme:'light',platform:'win32',distribution:'',version:'alpha.28 plus unpublished capability contract'};
  const snapshot={directory,configured:true,agents:{items:[],connected:true,revision:1},tasks:[],conversations:[],machines,nodes,collaboration:relation,nodeManagement:true,teamSpaceSupported:true};
  const state=JSON.parse(sessionStorage.getItem('capability-calls-'+mode)||'{"saves":0,"queries":0,"forbidden":0}');
  function save(){sessionStorage.setItem('capability-calls-'+mode,JSON.stringify(state));}
  window.__capabilityFixture={state,directory};
  window.agentbridge={
    async call(method,p={}){
      if(method==='snapshot')return {ok:true,result:structuredClone(snapshot)};
      if(method==='graphLayout')return {ok:true,result:structuredClone(layout)};
      if(method==='graphPending')return {ok:true,result:[]};
      if(method==='team.snapshot')return {ok:true,result:{stage:'I07C1',agents:[],teams:[],runs:[],automaticCoordination:false}};
      if(method==='saveCollaboration'){
        state.saves++;state.original=p.operationId;state.savedParams=p;save();
        return {ok:false,error:{code:'DESKTOP_TRANSPORT',message:'受控夹具：保存回应丢失，只查询原操作。'}};
      }
      if(method==='collaborationOperation'){
        state.queries++;if(state.original&&p.operationId!==state.original)state.foreignQuery=true;save();
        return {ok:true,result:{operationId:p.operationId,state:sessionStorage.getItem('allow-capability-recovery')==='yes'?'rejected':'not_found',...(sessionStorage.getItem('allow-capability-recovery')==='yes'?{error:{code:'COLLABORATION_CAPABILITY',message:'原能力拒绝已核对，关系未提交。'}}:{})}};
      }
      state.forbidden++;state.lastForbidden=method;save();
      return {ok:false,error:{code:'FIXTURE_WRITE_DENIED',message:'隔离夹具拒绝应用调用：'+method}};
    },
    async preferences(){return preferences;},async pending(){return [];},async runtimes(){return {platform:'win32',distributions:[]};},async recoverPending(){return {resolved:0,items:[]};},async pickFolder(){return null;},
    async savePreferences(){state.forbidden++;save();throw Error('settings writes denied');},async window(){state.forbidden++;save();throw Error('window writes denied');}
  };
}
const save=()=>fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify(report,null,2)+'\n');
async function check(text,file){report.checks.push(text);if(file){await page.screenshot({path:path.join(out,file),animations:'disabled'});report.screenshots.push(file);}save();}
(async()=>{
  fs.mkdirSync(out,{recursive:true});frozen=fs.mkdtempSync(path.join(os.tmpdir(),'ab-capability-ui-'));fs.cpSync(path.resolve(__dirname,'../dist'),frozen,{recursive:true});
  report.renderer=fs.readdirSync(path.join(frozen,'assets')).sort().map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(path.join(frozen,'assets',file))).digest('hex')}));
  server=http.createServer((req,res)=>{try{const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html';const file=path.resolve(frozen,relative);if(!file.startsWith(frozen+path.sep)){res.writeHead(403).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});report.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce'});await context.addInitScript(mock);page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));await page.goto(url);
  await expect(page.locator('.inventory-node')).toHaveCount(9);
  for(const name of ['Hermes','Pi','DSH']){const row=page.locator('.inventory-node').filter({has:page.getByRole('heading',{name,exact:true})});await expect(row.getByRole('button',{name:'开始会话'})).toBeEnabled();await expect(row).toContainText('可被委派');await expect(row).toContainText('MCP 调用能力未确认');await expect(row).not.toContainText('暂不能调用 Bridge MCP');}
  for(const name of ['执行能力未知','未知工具'])await expect(page.locator('.inventory-node').filter({has:page.getByRole('heading',{name,exact:true})}).getByRole('button',{name:'开始会话'})).toBeDisabled();
  await check('Direct-only tools keep direct execution and recipient capability; unknown execution or adapter cannot be enabled by availability or forged metadata.','01-inventory.png');
  await page.getByRole('button',{name:'关系图',exact:true}).click();
  for(const name of ['Hermes','Pi','DSH','调用能力未知','执行能力未知','未知工具'])await expect(page.locator('.graph-tool').filter({has:page.getByText(name,{exact:true})}).getByRole('button',{name:'设为主 Agent',exact:true})).toBeDisabled();
  const open=page.locator('.graph-tool').filter({has:page.getByText('OpenCode',{exact:true})});await expect(open.getByRole('button',{name:'设为主 Agent',exact:true})).toBeEnabled();await open.getByRole('button',{name:'设为主 Agent',exact:true}).click();
  await expect(page.getByRole('button',{name:'从 OpenCode 允许委派',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'从 OpenCode 允许委派',exact:true}).press('Enter');await page.getByRole('button',{name:'连接到 受控机器 1 / Hermes',exact:true}).press('Enter');
  await expect(page.locator('.agent-graph-panel')).toHaveAttribute('data-draft-members','hermes');await expect(page.getByRole('button',{name:'保存授权',exact:true})).toBeEnabled();
  await check('Only projected MCP clients can become leader; unconfirmed MCP clients stay direct/recipient only and remain keyboard-connectable.','02-directional-graph.png');
  await page.getByRole('button',{name:'保存授权',exact:true}).click();await expect(page.getByRole('button',{name:'查询原授权保存',exact:true})).toBeVisible();
  const pending=await page.evaluate(()=>JSON.parse(localStorage.getItem('agentbridge.graph.'+window.__capabilityFixture.directory)).relationPending);assert(pending?.operationId);
  await check('A lost simulated relation response retains the original pending ID and draft; not_found does not clear it.','03-original-pending.png');
  await page.evaluate(()=>sessionStorage.setItem('allow-capability-recovery','yes'));await page.reload();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('agentbridge.graph.'+window.__capabilityFixture.directory)).relationPending)).toBeNull();
  const after=await page.evaluate(()=>({graph:JSON.parse(localStorage.getItem('agentbridge.graph.'+window.__capabilityFixture.directory)),counts:window.__capabilityFixture.state}));
  assert.equal(after.counts.saves,1);assert.equal(after.counts.foreignQuery,undefined);assert.equal(after.graph.base.leaderId,'claude');assert.equal(after.graph.draft.leaderId,'opencode');assert.deepEqual(after.graph.draft.memberIds,['hermes']);assert.equal(after.counts.forbidden,0);
  await check('Reload queries the original durable rejection, clears only its pending lock, retains base/draft, and never replays save.','04-original-recovered.png');
  await page.goto(url+'/?historical');await page.getByRole('button',{name:'概览',exact:true}).click();await expect(page.locator('.inventory-node')).toHaveCount(9);
  await page.locator('.inventory-node').filter({has:page.getByRole('heading',{name:'Hermes',exact:true})}).getByRole('button',{name:'开始会话'}).click();
  const dialog=page.getByRole('dialog',{name:'新建会话'});await expect(dialog.getByRole('checkbox')).toBeDisabled();await expect(dialog.getByRole('checkbox')).not.toBeChecked();await expect(dialog).toContainText('已有主节点记录保留');await expect(dialog).toContainText('MCP 调用能力未确认');await dialog.getByLabel('需求',{exact:true}).fill('只验证输入条件，不发送需求。');
  await check('An unsupported historical main node remains visible and can compose a direct task; its collaboration checkbox is disabled and no task is sent.','05-historical-leader.png');
  const last=await page.evaluate(()=>window.__capabilityFixture.state);assert.equal(last.saves,0);assert.equal(last.forbidden,0);assert.deepEqual(report.pageErrors,[]);report.relationSaveAttempts=after.counts.saves;report.recoveryQueries=after.counts.queries;report.forbiddenAttempts=0;report.originalOperationRef=createHash('sha256').update(pending.operationId).digest('hex').slice(0,16);report.status='passed';save();console.log(JSON.stringify({status:report.status,checks:report.checks.length,output:out}));
})().catch(async e=>{report.status='failed';report.error=e.stack;if(page){try{report.diagnostic=await page.evaluate(()=>({calls:window.__capabilityFixture?.state,notices:[...document.querySelectorAll('[role="status"],.notice-banner,.graph-warning')].map(n=>n.textContent),graph:JSON.parse(localStorage.getItem('agentbridge.graph.'+window.__capabilityFixture?.directory)||'null')}));await page.screenshot({path:path.join(out,'failure.png')});}catch{}}save();console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));if(frozen)fs.rmSync(frozen,{recursive:true,force:true});});
