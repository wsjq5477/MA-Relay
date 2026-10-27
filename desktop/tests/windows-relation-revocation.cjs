// Issue #25: production renderer + Coordinator, controlled machines, no models.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const {graphFixture}=require('./i06b-ui-fixture.cjs');
const runtimeRoot=process.argv[3]?path.resolve(process.argv[3]):undefined;
const {GraphOperationJournal}=require(runtimeRoot?path.join(runtimeRoot,'desktop/electron/graph-operations.cjs'):'../electron/graph-operations.cjs');
const {digest}=require('../electron/graph-layout.cjs');
const out=path.resolve(process.argv[2]||'artifacts/issue25/2026-10-27/ui');
const report={date:new Date().toISOString(),version:require('../package.json').version,environment:'Windows Edge / production renderer and Coordinator / controlled machines',modelCalls:0,checks:[],pageErrors:[]};
let server,browser,context,f,page;
let mode='';
const check=value=>{report.checks.push(value);console.log(value);};
async function fresh(options={}){
 await context?.close();f?.close();mode=options.mode||'';f=await graphFixture({runtimeRoot});
 const [leader,member,other]=f.nodes;
 await f.router.call('saveCollaboration',{operationId:'initial',leaderId:leader.nodeId,memberIds:[member.nodeId],expectedRevision:0});
 const target=options.target?member:other,lane=options.lane||'node',params={operationId:'original-intent',machineId:target.machineId,...(lane==='node'?{nodeId:target.nodeId,action:'attach'}:{})};
 if(options.missingSource)delete params.machineId;
 const row={lane,operationId:params.operationId,method:lane==='node'?'manageNode':lane==='machine'?'machine.maintainDaemon':lane==='layout'?'saveGraphLayout':'saveCollaboration',params,fingerprint:digest(params),state:'unknown',time:'2026-10-20T00:00:00Z'};
 new GraphOperationJournal(f.directory).update(row);
 if(options.corrupt)fs.writeFileSync(path.join(f.directory,'graph-pending.json'),'{');
 if(options.unavailable){f.router.node(member.nodeId).executionSupported=false;f.router.saveNetwork();}
 context=await browser.newContext({viewport:{width:1600,height:1100}});
 await context.exposeFunction('bridgeCall',async(method,p)=>{
  if(mode==='layout-unavailable'&&method==='graphLayout')return {ok:false,error:{code:'METHOD_NOT_SUPPORTED',message:'受控布局接口不可用'}};
  if(mode==='read-failure'&&method==='graphPending')return {ok:false,error:{code:'READ_FAILED',message:'受控台账读取失败'}};
  return f.call(method,p);
 });
 await context.addInitScript(({version})=>{window.agentbridge={call:(m,p)=>window.bridgeCall(m,p),preferences:async()=>({theme:'light',version,platform:'win32'}),pending:async()=>[],recoverPending:async()=>({resolved:0}),window:async()=>{},savePreferences:async p=>p};},{version:report.version});
 page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));
 await open();return {leader,member,other,row};
}
async function open(){
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.getByRole('button',{name:'关系图',exact:true}).click();
 await expect(page.locator('.graph-tool')).toHaveCount(3);
 await expect(page.locator('.react-flow__edge')).toHaveCount(1);
 // Initial draft persistence precedes the interaction; normal read-only
 // recovery polling remains enabled throughout this UI test.
 await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('agentbridge.graph.')))).toBe(true);
}
const save=()=>page.getByRole('button',{name:'保存授权',exact:true});
async function selectEdge(){await page.locator('.react-flow__edge-textbg').first().click();return page.getByRole('button',{name:'删除这条授权',exact:true});}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const directory=process.argv[4]?path.resolve(process.argv[4]):path.resolve(__dirname,'../dist');
 server=http.createServer((req,res)=>{try{const file=path.resolve(directory,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html');if(!file.startsWith(directory+path.sep))return res.writeHead(403).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({channel:'msedge',headless:true});report.browser=browser.version();
 for(const options of [{},{target:true,unavailable:true},{lane:'machine'},{mode:'layout-unavailable'},{lane:'layout'}]){
  const {leader,row}=await fresh(options),remove=await selectEdge();await expect(remove).toBeEnabled();
  const before=structuredClone({requests:f.router.network.requests,delegations:f.router.network.delegations,instances:f.router.catalog.instances});
  await remove.click();await expect(page.locator('.react-flow__edge')).toContainText('待移除');await expect(save()).toBeEnabled();
  assert.equal(f.router.network.collaboration.revision,1);assert.equal(f.calls.filter(c=>c.method==='saveCollaboration').length,0);
  await page.screenshot({path:path.join(out,'draft-'+(options.target?'target':options.mode||options.lane||'unrelated')+'.png'),fullPage:true});
  await save().click();await expect.poll(()=>f.router.network.collaboration.revision).toBe(2);await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  assert.deepEqual(f.router.network.collaboration,{leaderId:leader.nodeId,memberIds:[],revision:2});
  assert.deepEqual(new GraphOperationJournal(f.directory).pending(),[row]);assert.deepEqual({requests:f.router.network.requests,delegations:f.router.network.delegations,instances:f.router.catalog.instances},before);
  assert.equal(f.calls.filter(c=>c.method==='saveCollaboration').length,1);
  await f.inject('hold-relation'); // Supply an explicitly stale poll after the receipt.
  const call=f.call.bind(f);f.call=async(m,p)=>{const result=await call(m,p);if(m==='snapshot'&&result.ok)result.result.collaboration={leaderId:leader.nodeId,memberIds:[f.nodes[1].nodeId],revision:1};return result;};
  await page.reload();await page.getByRole('button',{name:'关系图',exact:true}).click();await expect(page.locator('.graph-toolbar')).toContainText('0 条已保存授权');await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  assert.equal(f.router.network.collaboration.revision,2);check('revoke, one revision, original intent/history intact, stale poll and reopen: '+JSON.stringify(options));
 }
 for(const options of [{lane:'relation'},{missingSource:true},{corrupt:true},{mode:'read-failure'}]){
  await fresh(options);const remove=await selectEdge();await expect(remove).toBeDisabled();assert(await remove.getAttribute('title'));assert.equal(f.calls.filter(c=>c.method==='saveCollaboration').length,0);check('conservative lock with reason: '+JSON.stringify(options));
 }
 {
  const {leader,other}=await fresh();const card=id=>page.locator('.react-flow__node[data-id="'+id+'"]');
  const target=card(other.nodeId).getByRole('button',{name:'设为主 Agent',exact:true});await expect(target).toBeDisabled();assert.match(await target.getAttribute('title'),/待核对/);
  const independent=card(f.nodes[1].nodeId).getByRole('button',{name:'设为主 Agent',exact:true});await expect(independent).toBeEnabled();await independent.click();await expect(save()).toBeEnabled();assert.equal(f.calls.filter(c=>c.method==='saveCollaboration').length,0);assert.equal(await page.locator('.agent-graph-panel').getAttribute('data-draft-members'),'');
  assert.equal(f.router.network.collaboration.leaderId,leader.nodeId);check('independent main selection remains a draft with no automatic grants; blocked target gives reason');
 }
 {
  const {leader}=await fresh();const remove=await selectEdge();await expect(remove).toBeEnabled();await remove.click();
  await f.router.call('saveCollaboration',{operationId:'other-window',expectedRevision:1,leaderId:leader.nodeId,memberIds:[f.nodes[1].nodeId]});
  // Snapshot polling observes the newer revision without overwriting the draft.
  await expect(page.getByRole('button',{name:'保留草稿，以最新版本重新校验',exact:true})).toBeVisible({timeout:10000});await expect(save()).toBeDisabled();await expect(page.locator('.react-flow__edge')).toContainText('待移除');
  await page.getByRole('button',{name:'保留草稿，以最新版本重新校验',exact:true}).click();await expect(save()).toBeEnabled();await save().click();await expect.poll(()=>f.router.network.collaboration.revision).toBe(3);assert.equal(f.calls.filter(c=>c.method==='saveCollaboration').length,1);check('revision conflict preserves deletion draft; explicit rebase commits once');
 }
 {
  await fresh();const remove=await selectEdge();await expect(remove).toBeEnabled();
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('agentbridge.graph.'))throw new DOMException('controlled full storage','QuotaExceededError');return original.call(this,key,value);};});
  await remove.click();await expect(remove).toBeDisabled();assert.match(await remove.getAttribute('title'),/持久保存/);await expect(page.locator('.react-flow__edge')).toContainText('授权已保存');assert.equal(f.calls.filter(c=>c.method==='saveCollaboration').length,0);check('failed local draft persistence keeps saved edge and disables writes with reason');
 }
 assert.deepEqual(report.pageErrors,[]);report.status='passed';
})().catch(e=>{report.status='failed';report.error=e.stack;process.exitCode=1;}).finally(async()=>{if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'final.png'),fullPage:true}).catch(()=>{});await browser?.close();f?.close();if(server)await new Promise(r=>server.close(r));fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
