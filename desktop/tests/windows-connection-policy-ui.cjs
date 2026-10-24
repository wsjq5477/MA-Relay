// Production React UI in Windows Edge; controlled backend stores; no native model.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const {graphFixture}=require('./i06b-ui-fixture.cjs');
const [frontend,out,runtimeRoot]=process.argv.slice(2);
const report={date:new Date().toISOString(),version:require('../package.json').version,status:'running',scope:'Windows Edge headless production React / controlled production stores; no real native model, daily configuration or graph timing evidence',modelCalls:0,checks:[]};
let browser,fixture,server,page;
(async()=>{
 fs.mkdirSync(out,{recursive:true});fixture=await graphFixture({nativeExecution:true,runtimeRoot});
 const snapshot=await fixture.router.snapshot(),leader=snapshot.nodes.find(n=>n.adapter==='claude'),targets=snapshot.nodes.filter(n=>n.nodeId!==leader.nodeId),[b,c]=targets;
 const label=n=>snapshot.machines.find(m=>m.machineId===n.machineId).name+' / '+n.name;
 const old=await fixture.router.call('collaboration');await fixture.router.call('saveCollaboration',{operationId:'ui-initial-grant',expectedRevision:old.revision,leaderId:leader.nodeId,memberIds:[b.nodeId]});
 let lose=false,hide=false,forge=false;
 const call=async(m,p)=>{if(m==='connectionPolicyOperation'&&hide)return {ok:true,result:{operationId:p.operationId,state:'not_found'}};const reply=await fixture.call(m,p);if(m==='connectionPolicyOperation'&&forge&&reply.ok)return {...reply,result:{...reply.result,fingerprint:'wrong-fingerprint'}};if(m==='saveConnectionPolicy'&&lose){lose=false;throw Error('Controlled lost acknowledgement');}return reply;};
 server=require('node:http').createServer((req,res)=>{const file=path.resolve(frontend,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html');if(!file.startsWith(frontend+path.sep))return res.writeHead(403).end();try{res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.exposeFunction('bridgeCall',call);
 await context.addInitScript(version=>{window.agentbridge={call:(m,p)=>window.bridgeCall(m,p),preferences:async()=>({theme:'light',version,platform:'win32'}),pending:async()=>[],recoverPending:async()=>({resolved:0}),window:async()=>{},savePreferences:async p=>p};},report.version);
 const open=async()=>{page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('button',{name:'连接策略与确认',exact:true}).click();await expect(page.getByRole('dialog',{name:'连接策略与确认'})).toBeVisible();};
 await open();const dialog=()=>page.getByRole('dialog',{name:'连接策略与确认'}),select=()=>dialog().getByLabel('策略所属主 Agent'),save=()=>dialog().getByRole('button',{name:'保存预授权范围',exact:true});
 await select().selectOption(leader.nodeId);await expect(dialog().getByLabel('预授权 '+label(b))).toBeChecked();await expect(dialog().getByLabel('预授权 '+label(c))).not.toBeChecked();
 await dialog().getByLabel('预授权 '+label(c)).check();await save().click();await expect(dialog().getByRole('status')).toContainText('授权操作已确认');await expect(save()).toHaveCount(0);
 const row=fixture.router.network.relations.find(r=>r.leaderId===leader.nodeId);assert.deepEqual(new Set(row.envelope.allowedNodeIds),new Set([b.nodeId,c.nodeId]));assert.deepEqual(row.memberIds,[b.nodeId]);
 report.checks.push('Production panel reads exact migrated envelope and saves preauthorization without connecting or running a task; browser canonical fingerprint matches backend receipt');
 const tool=(name,args)=>fixture.router.collaborationTool({nodeId:leader.nodeId,externalConnectionId:'ui-controlled-external'},name,args,'ui-controlled-parent',leader.machineId);
 await tool('connect_agent',{nodeId:c.nodeId,operationId:'ui-envelope-connect'});await dialog().getByRole('button',{name:'刷新策略与请求',exact:true}).click();await expect(dialog().locator('p').filter({hasText:'· 修订 '+fixture.router.network.relations.find(r=>r.leaderId===leader.nodeId).revision})).toHaveCount(1);await select().selectOption(leader.nodeId);await dialog().getByLabel('预授权 '+label(c)).uncheck();await save().click();await expect(dialog().getByRole('status')).toContainText('授权操作已确认');await expect(save()).toHaveCount(0);assert(!fixture.router.network.relations.find(r=>r.leaderId===leader.nodeId).memberIds.includes(c.nodeId));
 const pending=await tool('connect_agent',{nodeId:c.nodeId,operationId:'ui-outside-envelope'});assert.equal(pending.state,'pending_approval');await dialog().getByRole('button',{name:'刷新策略与请求',exact:true}).click();await dialog().getByRole('button',{name:'允许此连接',exact:true}).click();await expect(dialog().getByRole('status')).toContainText('授权操作已确认');await expect(save()).toHaveCount(0);assert(fixture.router.network.relations.find(r=>r.leaderId===leader.nodeId).memberIds.includes(c.nodeId));
 report.checks.push('User removes an active target from envelope and revokes its grant; subsequent Agent request waits for explicit user allow in the panel');
 // Lose the save response after commit, retain browser intent across full page close.
 await select().selectOption(leader.nodeId);lose=true;await save().click();await expect(dialog().getByRole('button',{name:'查询原策略操作',exact:true})).toBeVisible();
 const key=await page.evaluate(()=>Object.keys(localStorage).find(k=>k.startsWith('agentbridge.connection-policy.'))),original=await page.evaluate(k=>localStorage.getItem(k),key),writes=fixture.calls.filter(c=>c.method==='saveConnectionPolicy').length;assert(original);
 await page.close();await open();await expect(dialog().getByRole('button',{name:'查询原策略操作',exact:true})).toBeVisible();assert.equal(fixture.calls.filter(c=>c.method==='saveConnectionPolicy').length,writes);
 hide=true;await dialog().getByRole('button',{name:'查询原策略操作',exact:true}).click();assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),original);hide=false;forge=true;
 await dialog().getByRole('button',{name:'查询原策略操作',exact:true}).click();assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),original);forge=false;
 await dialog().getByRole('button',{name:'查询原策略操作',exact:true}).click();await expect(dialog().getByRole('button',{name:'查询原策略操作',exact:true})).toHaveCount(0);assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),null);assert.equal(fixture.calls.filter(c=>c.method==='saveConnectionPolicy').length,writes);
 report.checks.push('Lost acknowledgement retains exact original intent across full page reopen; not_found and wrong fingerprint cannot release it; only matching original receipt clears without redispatch');
 // Failure to persist intent is deterministically pre-dispatch.
 await select().selectOption(leader.nodeId);await page.evaluate(()=>{window.originalStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('agentbridge.connection-policy.'))throw Error('controlled storage failure');return window.originalStorageSet.call(this,k,v);};});await save().click();await expect(dialog().getByRole('status')).toContainText('操作未发送');assert.equal(fixture.calls.filter(c=>c.method==='saveConnectionPolicy').length,writes);
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalStorageSet;});
 // Use exact known key, then reopen; malformed bytes must remain and lock writes.
 await page.evaluate(k=>localStorage.setItem(k,'{invalid'),key);await page.close();await open();await expect(dialog().getByRole('alert')).toContainText('本机原策略意图无法读取');await expect(select()).toBeDisabled();assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),'{invalid');assert.equal(fixture.calls.filter(c=>c.method==='saveConnectionPolicy').length,writes);
 report.checks.push('Browser storage failure prevents dispatch; malformed persisted intent remains untouched and locks new writes');
 assert.equal(fixture.router.network.requests.length,0);assert.equal(fixture.router.network.delegations.length,0);assert.equal([...fixture.hosts.values()].flatMap(h=>h.tasks).length,0);
 await page.screenshot({path:path.join(out,'policy-intent-recovery.png'),fullPage:true});report.status='passed';
})().catch(async error=>{report.status='failed';report.error=error.stack;process.exitCode=1;try{await page?.screenshot({path:path.join(out,'policy-failure.png'),fullPage:true});}catch{}}).finally(async()=>{await browser?.close();fixture?.close();if(server)await new Promise(resolve=>server.close(resolve));fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'windows-policy-ui.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));});
