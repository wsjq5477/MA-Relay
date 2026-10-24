// Real Windows Edge pointer input; controlled machines and production stores.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const {graphFixture}=require('./i06b-ui-fixture.cjs');
const out=process.env.AGENTBRIDGE_GRAPH_REPORT_DIR?path.resolve(process.env.AGENTBRIDGE_GRAPH_REPORT_DIR):path.resolve(__dirname,'../../artifacts/graph-usability/2026-10-13');
const report={date:new Date().toISOString(),version:require('../package.json').version,status:'running',scope:'Windows Edge real pointer input / production graph stores / controlled machines; no native inference',checks:[],submittedNativePrompts:0};
let browser,fixture,page,server;
(async()=>{
  fs.mkdirSync(out,{recursive:true});fixture=await graphFixture({runtimeRoot:process.env.AGENTBRIDGE_GRAPH_RUNTIME_ROOT});
  let frontendUrl=process.argv[2]||'http://127.0.0.1:4217';
  if(process.env.AGENTBRIDGE_GRAPH_FRONTEND){
    const frontend=path.resolve(process.env.AGENTBRIDGE_GRAPH_FRONTEND);
    server=require('node:http').createServer((req,res)=>{
      const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html',file=path.resolve(frontend,relative);
      if(!file.startsWith(frontend+path.sep))return res.writeHead(403).end();
      try{res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));frontendUrl='http://127.0.0.1:'+server.address().port;
  }
  // Arrange the controlled catalog like the reported Windows + adjacent WSL scene.
  fixture.router.catalog.machines.sort((a,b)=>({windows:0,wsl:1,ssh:2}[a.kind]-{windows:0,wsl:1,ssh:2}[b.kind]));
  browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:960}});
  await context.exposeFunction('bridgeCall',(m,p)=>fixture.call(m,p));
  await context.addInitScript(version=>{window.agentbridge={call:(m,p)=>window.bridgeCall(m,p),preferences:async()=>({theme:'light',version,platform:'win32'}),pending:async()=>[],recoverPending:async()=>({resolved:0}),window:async()=>{},savePreferences:async p=>p};},report.version);
  const open=async()=>{page=await context.newPage();await page.goto(frontendUrl);await page.getByRole('button',{name:'关系图',exact:true}).click();await expect(page.locator('.graph-tool')).toHaveCount(3);await expect(page.locator('.graph-view-tools').getByText('布局已保存',{exact:true})).toBeVisible();};
  await open();await page.getByRole('button',{name:'适配全图',exact:true}).click();await expect(page.locator('.graph-view-tools').getByText('布局已保存',{exact:true})).toBeVisible();await page.waitForTimeout(300);
  const snapshot=await fixture.router.snapshot(),leader=snapshot.nodes.find(n=>snapshot.machines.find(m=>m.machineId===n.machineId)?.kind==='wsl'),child=snapshot.nodes.find(n=>snapshot.machines.find(m=>m.machineId===n.machineId)?.kind==='windows');
  const tool=id=>page.locator('.react-flow__node[data-id="'+id+'"]');
  await tool(leader.nodeId).getByRole('button',{name:'设为主 Agent',exact:true}).click();
  await expect(tool(leader.nodeId).locator('.graph-tool')).toHaveClass(/is-leader/);
  await expect(tool(leader.nodeId).locator('.graph-leader-icon')).toHaveCount(1);
  await expect(tool(leader.nodeId).locator('.react-flow__handle.target')).toBeHidden();
  await expect(tool(leader.nodeId).locator('.react-flow__handle.source')).toBeVisible();
  await expect(tool(child.nodeId).locator('.react-flow__handle.source')).toBeHidden();
  assert.equal(await tool(leader.nodeId).locator('.react-flow__handle.target').getAttribute('tabindex'),'-1');
  assert.equal(await tool(child.nodeId).locator('.react-flow__handle.source').getAttribute('aria-hidden'),'true');
  report.checks.push('WSL leader has crown, prominent styling and only right output; ordinary/child nodes only left input; unused handles hidden from keyboard and accessibility');
  const a=await tool(leader.nodeId).locator('.react-flow__handle.source').boundingBox(),b=await tool(child.nodeId).locator('.react-flow__handle.target').boundingBox();assert(a&&b&&a.x>b.x);assert(Math.abs(a.y-b.y)<2,'reproduces same-row reverse connection');
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:24});await page.mouse.up();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge-path')).toBeVisible();
  const route=await page.locator('.react-flow__edge-path').evaluate(path=>{
    path.getBoundingClientRect();
    const matrix=path.getScreenCTM(),numbers=path.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number),points=[];
    for(let i=0;i<numbers.length;i+=2){const p=new DOMPoint(numbers[i],numbers[i+1]).matrixTransform(matrix);points.push({x:p.x,y:p.y});}
    return {points,rects:[...document.querySelectorAll('.graph-tool')].map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}),d:path.getAttribute('d'),marker:path.getAttribute('marker-end')};
  });
  assert(route.points.length>=6);assert(route.points[1].x>route.points[0].x);assert(route.points.at(-2).x<route.points.at(-1).x);assert(route.marker);
  for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i];for(const r of route.rects){const vertical=Math.abs(a.x-b.x)<.1;assert(!(vertical?a.x>r.x+1&&a.x<r.x+r.width-1&&Math.max(a.y,b.y)>r.y+1&&Math.min(a.y,b.y)<r.y+r.height-1:a.y>r.y+1&&a.y<r.y+r.height-1&&Math.max(a.x,b.x)>r.x+1&&Math.min(a.x,b.x)<r.x+r.width-1),'rendered edge crosses card');}}
  await page.getByRole('button',{name:'保存授权',exact:true}).click();await expect.poll(()=>fixture.router.network.collaboration.memberIds).toEqual([child.nodeId]);
  report.routing=route;report.checks.push('Actual same-row WSL-right to Windows-left drag routes outside every rendered card and keeps directed arrow and explicit authorization save');
  await expect(page.locator('.graph-view-tools').getByText('布局已保存',{exact:true})).toBeVisible();
  const relation=structuredClone(fixture.router.network.collaboration),writes=fixture.calls.filter(c=>c.method==='saveCollaboration').length;
  async function pan(selector,dx,dy){
    const before=await fixture.router.call('graphLayout'),box=await page.locator(selector).boundingBox();assert(box);
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down({button:'middle'});await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:12});await page.mouse.up({button:'middle'});
    await expect.poll(async()=>Math.abs((await fixture.router.call('graphLayout')).viewport.x-before.viewport.x-dx)).toBeLessThan(1);
    await expect.poll(async()=>Math.abs((await fixture.router.call('graphLayout')).viewport.y-before.viewport.y-dy)).toBeLessThan(1);
    await expect(page.locator('.graph-view-tools').getByText('布局已保存',{exact:true})).toBeVisible();
    const after=await fixture.router.call('graphLayout');assert.deepEqual(after.groups,before.groups);assert.deepEqual(after.nodes,before.nodes);assert.equal(after.viewport.zoom,before.viewport.zoom);assert.deepEqual(fixture.router.network.collaboration,relation);assert.equal(fixture.calls.filter(c=>c.method==='saveCollaboration').length,writes);await expect(page.locator('.graph-canvas')).not.toHaveClass(/is-panning/);assert.equal(await page.locator('.react-flow__connection').count(),0);
  }
  await pan('.graph-tool.is-leader .graph-tool-title',45,25);
  await pan('.graph-tool.is-leader .graph-tool-actions button:first-child',-35,-15);
  await pan('.graph-tool.is-leader .react-flow__handle.source',20,10);
  await pan('.react-flow__node[data-id="machine:'+leader.machineId+'"] .graph-group-handle',-20,-10);
  // Blank pane point is chosen outside groups, rather than its obstructed center.
  const canvas=await page.locator('.graph-canvas').boundingBox(),beforeBlank=await fixture.router.call('graphLayout');
  await page.mouse.move(canvas.x+8,canvas.y+120);await page.mouse.down({button:'middle'});await page.mouse.move(canvas.x+38,canvas.y+90,{steps:10});await page.mouse.up({button:'middle'});
  await expect.poll(async()=>(await fixture.router.call('graphLayout')).viewport.x).toBeCloseTo(beforeBlank.viewport.x+30,0);
  await expect(page.locator('.graph-view-tools').getByText('布局已保存',{exact:true})).toBeVisible();
  report.checks.push('Middle-button pan on card title, action button, output port, machine header and blank canvas moves only viewport; no node/group move, connection or authorization write');
  const saved=await fixture.router.call('graphLayout');await page.close();await open();
  await expect.poll(async()=>page.locator('.react-flow__viewport').evaluate((el,v)=>{const matrix=new DOMMatrix(getComputedStyle(el).transform);return Math.max(Math.abs(matrix.e-v.x),Math.abs(matrix.f-v.y),Math.abs(matrix.a-v.zoom));},saved.viewport)).toBeLessThan(.001);
  assert.deepEqual((await fixture.router.call('graphLayout')).viewport,saved.viewport);
  report.checks.push('Viewport after middle pan survives window reopen and stored node/authorization identities stay unchanged');
  // A pending layout receipt locks all pan gestures and cannot create a second write.
  await fixture.inject('lose-layout');await fixture.inject('hide-receipt');
  const group=page.locator('.react-flow__node[data-id="machine:'+leader.machineId+'"] .graph-group-handle');await group.focus();await page.keyboard.press('ArrowDown');
  await expect(page.locator('.graph-view-tools').getByText('布局回应待核对',{exact:true})).toBeVisible();
  const locked=await fixture.router.call('graphLayout'),layoutWrites=fixture.calls.filter(c=>c.method==='saveGraphLayout').length,box=await group.boundingBox();
  await page.mouse.move(box.x+20,box.y+15);await page.mouse.down({button:'middle'});await page.mouse.move(box.x+60,box.y+40,{steps:10});await page.mouse.up({button:'middle'});
  assert.deepEqual((await fixture.router.call('graphLayout')).viewport,locked.viewport);assert.equal(fixture.calls.filter(c=>c.method==='saveGraphLayout').length,layoutWrites);
  await fixture.inject('show-receipt');await page.getByRole('button',{name:'查询原布局保存',exact:true}).click();await expect(page.locator('.graph-view-tools').getByText('布局已保存',{exact:true})).toBeVisible();
  report.checks.push('Unknown layout receipt blocks middle pan and additional layout writes; recovery queries only the original operation');
  // Switch leader: old saved edge still needs its now-hidden anchors until save.
  await tool(child.nodeId).getByRole('button',{name:'设为主 Agent',exact:true}).click();
  await expect(tool(child.nodeId).locator('.graph-leader-icon')).toHaveCount(1);await expect(tool(leader.nodeId).locator('.graph-leader-icon')).toHaveCount(0);
  report.switchDebug=await page.evaluate(()=>({edges:[...document.querySelectorAll('.react-flow__edge')].map(e=>e.outerHTML),handles:[...document.querySelectorAll('.react-flow__handle')].map(e=>({class:e.className,id:e.getAttribute('data-handleid'),box:e.getBoundingClientRect().toJSON()})),state:JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('agentbridge.graph.')))||'null')}));
  await expect(page.locator('.react-flow__edge-text')).toContainText('待移除');assert((await page.locator('.react-flow__edge-path').getAttribute('d')).length>10);
  await page.getByRole('button',{name:'放弃草稿',exact:true}).click();await expect(tool(leader.nodeId).locator('.graph-leader-icon')).toHaveCount(1);
  report.checks.push('Leader styling/usable ports follow draft role changes; pending removal edge keeps measured hidden anchors and discard restores saved role');
  await page.getByRole('button',{name:'适配全图',exact:true}).click();await page.waitForTimeout(700);
  await page.screenshot({path:path.join(out,'usability-light.png'),fullPage:true});await page.getByRole('button',{name:'切换深浅主题',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.screenshot({path:path.join(out,'usability-dark.png'),fullPage:true});
  // Real dimension changes must still update the retained measurements. Add
  // tools to the same group, then compare its new child against saved geometry.
  await fixture.inject('scale');
  await expect(page.locator('.graph-tool')).toHaveCount(60);
  await expect(page.locator('.graph-machine')).toHaveCount(20);
  await expect(page.locator('.graph-view-tools').getByText('布局已保存',{exact:true})).toBeVisible();
  const expanded=await fixture.router.snapshot(),added=expanded.nodes.find(n=>n.machineId===child.machineId&&n.adapter==='opencode');assert(added);
  await expect.poll(async()=>(await fixture.router.call('graphLayout')).nodes[added.nodeId]?.y||0).toBeGreaterThan(300);
  const grownLayout=await fixture.router.call('graphLayout');
  await expect.poll(async()=>{
    const card=await tool(added.nodeId).boundingBox(),group=await tool('machine:'+child.machineId).boundingBox();
    const zoom=await page.locator('.react-flow__viewport').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a);
    return Math.abs((card.y-group.y)/zoom-grownLayout.nodes[added.nodeId].y);
  }).toBeLessThan(1);
  assert(!JSON.stringify(grownLayout).includes('measured'));
  report.checks.push('Adding tools grows the same machine group, refreshes actual measurements and renders the new child at its saved position; DOM measurements never enter the saved layout');
  report.status='passed';
})().catch(async e=>{report.status='failed';report.error=e.stack;process.exitCode=1;try{await page.screenshot({path:path.join(out,'usability-failure.png'),fullPage:true});}catch{}}).finally(async()=>{await browser?.close();fixture?.close();if(server)await new Promise(resolve=>server.close(resolve));fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'usability.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));});
