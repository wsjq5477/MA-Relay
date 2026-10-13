// Packaged Electron window and authenticated production IPC; controlled hosts.
// Reproduce the original alpha.5 method rejection, without user-profile writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron,expect}=require('../node_modules/@playwright/test');
const {startCoordinator}=require('../electron/coordinator.cjs');
const {graphFixture}=require('./i06b-ui-fixture.cjs');
const out=path.resolve(__dirname,'../../artifacts/graph-drag-fix/2026-10-13'),before=process.argv[2]==='before';
const report={date:new Date().toISOString(),scope:'Packaged Windows Electron + authenticated production IPC + controlled machines; legacy alpha.5 method errors match original read-only diagnosis; no native tasks',status:'running',checks:[],submittedNativePrompts:0};
let fixture,server,app,page,supported=false,graphCalls=[];
const local=()=>page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('agentbridge.graph.'));return key?JSON.parse(localStorage.getItem(key)):null;});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  fs.mkdirSync(out,{recursive:true});fixture=await graphFixture();
  const snapshot=await fixture.router.snapshot(),leader=snapshot.nodes.find(n=>snapshot.machines.find(m=>m.machineId===n.machineId)?.kind==='wsl'),child=snapshot.nodes.find(n=>snapshot.machines.find(m=>m.machineId===n.machineId)?.kind==='windows');
  await fixture.router.call('saveCollaboration',{operationId:'fixture-existing-authority',expectedRevision:snapshot.collaboration.revision,leaderId:leader.nodeId,memberIds:[child.nodeId]});
  const original=structuredClone(fixture.router.network.collaboration);
  const service={async dispatch(method,p={}){
    if(method==='call'){
      if(/graph|Graph|collaborationOperation/.test(p.method)){graphCalls.push({method:p.method,operationId:p.params?.operationId});if(!supported)return {ok:false,error:{code:'DESKTOP_ERROR',message:'桌面请求不合法'}};}
      return fixture.call(p.method,p.params);
    }
    if(method==='preferences')return {theme:'light',version:'0.6.0-alpha.5',platform:'win32',distribution:'Ubuntu',directory:fixture.directory};
    if(method==='pending')return [];
    if(method==='recoverPending')return {resolved:0};
    if(method==='runtimes')return {platform:'win32',distributions:['Ubuntu']};
    if(method==='savePreferences')return p;
    throw Error('Fixture blocked unsupported method: '+method);
  },close(){}};
  server=await startCoordinator({directory:fixture.directory,version:'0.6.0-alpha.5',service});
  const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:fixture.directory};delete env.ELECTRON_RUN_AS_NODE;
  const bundle=path.join(fixture.directory,'app');fs.cpSync(path.resolve(__dirname,'../release/win-unpacked'),bundle,{recursive:true});
  app=await _electron.launch({executablePath:path.join(bundle,'AgentBridge.exe'),env,timeout:120000});
  app.process().on('exit',(code,signal)=>{report.windowExit={code,signal};});
  page=await app.firstWindow();report.windowVersion=await app.evaluate(({app})=>app.getVersion());
  await expect(page.locator('.graph-tool')).toHaveCount(3);
  const tool=id=>page.locator('.react-flow__node[data-id="'+id+'"]');
  if(before){
    await pause(800);await expect(page.getByRole('button',{name:'自动整理',exact:true})).toBeDisabled();
    assert.equal(await page.locator('.react-flow__node.draggable').count(),0);
    report.checks.push('alpha.7 packaged window connected to legacy alpha.5 IPC rejects layout methods and disables every node/group drag');
    await page.getByRole('button',{name:'适配全图',exact:true}).click();await pause(400);
    const initial=await page.locator('.react-flow__viewport').getAttribute('style'),box=await tool(leader.nodeId).boundingBox(),canvas=await page.locator('.graph-canvas').boundingBox();
    await page.mouse.move(box.x+70,box.y+25);await page.mouse.down();await page.mouse.move(box.x+90,box.y+45,{steps:12});await page.mouse.up();
    await page.mouse.move(canvas.x+10,canvas.y+120);await page.mouse.down({button:'middle'});await page.mouse.move(canvas.x+60,canvas.y+150,{steps:12});await page.mouse.up({button:'middle'});
    assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'),initial);
    const stored=await local();assert.equal(Object.keys(stored.layout.nodes).length,0);assert.equal(Object.keys(stored.layout.groups).length,0);report.checks.push('Real Electron mouse node drag and middle pan do not move or save; no speculative graph writes');
    report.status='reproduced';return;
  }
  await expect(page.getByRole('alert')).toContainText('布局仅保存在本机');await expect(page.getByRole('button',{name:'自动整理',exact:true})).toBeEnabled();
  await expect.poll(async()=>(await local())?.layout.groups[leader.machineId]?.x).toBe(0);
  const leaderBox=await tool(leader.nodeId).boundingBox(),childBox=await tool(child.nodeId).boundingBox();assert(leaderBox.x<childBox.x);
  await expect(tool(child.nodeId).getByRole('button',{name:'设为主 Agent',exact:true})).toBeDisabled();await expect(tool(child.nodeId).getByRole('button',{name:'开始会话',exact:true})).toBeEnabled();
  report.checks.push('Legacy layout read failure permits local graph movement; initial existing WSL main is leftmost, authorization edits disabled, native conversation entry remains available');
  await page.getByRole('button',{name:'适配全图',exact:true}).click();await pause(400);
  const initial=await local(),title=await tool(leader.nodeId).locator('.graph-tool-title').boundingBox();
  await page.mouse.move(title.x+45,title.y+8);await page.mouse.down();await page.mouse.move(title.x+60,title.y+23,{steps:12});await page.mouse.up();
  await expect.poll(async()=>(await local()).layout.nodes[leader.nodeId].y).not.toBe(initial.layout.nodes[leader.nodeId].y);
  const afterNode=await local();assert.deepEqual(afterNode.layout.groups,initial.layout.groups);
  report.checks.push('Real Electron left-button Agent card drag updates local relative node coordinates, preserving machine positions and authority');
  const group=page.locator('.react-flow__node[data-id="machine:'+leader.machineId+'"] .graph-machine'),groupBox=await group.boundingBox();
  await page.mouse.move(groupBox.x+groupBox.width-8,groupBox.y+groupBox.height-10);await page.mouse.down();await page.mouse.move(groupBox.x+groupBox.width+17,groupBox.y+groupBox.height+10,{steps:12});await page.mouse.up();
  await expect.poll(async()=>(await local()).layout.groups[leader.machineId].x).not.toBe(afterNode.layout.groups[leader.machineId].x);
  const afterGroup=await local();assert.deepEqual(afterGroup.layout.nodes,afterNode.layout.nodes);
  report.checks.push('Real Electron machine-group background drag moves the group with its tools; relative tool positions stay unchanged');
  const card=await tool(leader.nodeId).boundingBox(),canvas=await page.locator('.graph-canvas').boundingBox();
  await page.mouse.move(card.x+60,card.y+25);await page.mouse.down({button:'middle'});await page.mouse.move(card.x+110,card.y+55,{steps:12});await page.mouse.up({button:'middle'});
  await expect.poll(async()=>(await local()).layout.viewport.x).toBeCloseTo(afterGroup.layout.viewport.x+50,0);
  const afterPan=await local();assert.deepEqual(afterPan.layout.nodes,afterGroup.layout.nodes);assert.deepEqual(afterPan.layout.groups,afterGroup.layout.groups);
  await page.mouse.move(canvas.x+12,canvas.y+80);await page.mouse.down();await page.mouse.move(canvas.x+32,canvas.y+100,{steps:10});await page.mouse.up();
  await expect.poll(async()=>(await local()).layout.viewport.x).toBeCloseTo(afterPan.layout.viewport.x+20,0);
  const captureBefore=await local(),panCard=await tool(leader.nodeId).boundingBox();
  await page.mouse.move(panCard.x+60,panCard.y+25);await page.mouse.down({button:'middle'});await page.mouse.move(panCard.x+100,canvas.y-15,{steps:12});await page.mouse.up({button:'middle'});
  await expect.poll(async()=>(await local()).layout.viewport.x).toBeCloseTo(captureBefore.layout.viewport.x+40,0);await expect(page.locator('.graph-canvas')).not.toHaveClass(/is-panning/);
  report.checks.push('Middle pan over card, left pan on blank canvas and captured middle release outside canvas move only viewport and end correctly');
  assert.equal(graphCalls.filter(c=>c.method==='saveGraphLayout').length,0);assert.equal(fixture.calls.filter(c=>c.method==='saveCollaboration').length,0);assert.deepEqual(fixture.router.network.collaboration,original);
  const saved=await local();await page.reload();await expect(page.getByRole('alert')).toContainText('布局仅保存在本机');await expect.poll(async()=>JSON.stringify((await local()).layout)).toBe(JSON.stringify(saved.layout));
  report.checks.push('Legacy-mode local layout survives renderer reload; graph and authorization writes remain zero, original saved main/child authority untouched');
  supported=true;await page.getByRole('button',{name:'重新读取后台布局',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.locator('.graph-view-tools').getByText('布局已保存',{exact:true})).toBeVisible();
  const stored=await fixture.router.call('graphLayout');assert.deepEqual(stored.nodes,saved.layout.nodes);assert.deepEqual(stored.groups,saved.layout.groups);assert.deepEqual(stored.viewport,saved.layout.viewport);
  await page.getByRole('button',{name:'自动整理',exact:true}).click();await expect(page.locator('.graph-view-tools').getByText('布局已保存',{exact:true})).toBeVisible();
  await expect.poll(async()=>(await fixture.router.call('graphLayout')).groups[leader.machineId].x).toBe(0);
  report.checks.push('Restored graph capability saves retained local layout with a normal stable receipt; auto-arrange places main machine at left without changing permission revision');
  assert.deepEqual(fixture.router.network.collaboration,original);
  await page.screenshot({path:path.join(out,'electron-drag-light.png'),fullPage:true});
  // Preserve a real original layout operation and lose its ACK before reopen.
  const queryStart=graphCalls.length;await fixture.inject('lose-layout');await fixture.inject('hide-receipt');const header=group.locator('.graph-group-handle');await header.focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('.graph-view-tools').getByText('布局回应待核对',{exact:true})).toBeVisible();
  const pending=(await local()).layoutPending,writes=fixture.calls.filter(c=>c.method==='saveGraphLayout').length;
  supported=false;await page.reload();await expect(page.getByRole('alert')).toContainText('拖动保持锁定');await expect(page.getByRole('button',{name:'自动整理',exact:true})).toBeDisabled();
  const pendingLayout=(await local()).layout,box=await tool(leader.nodeId).boundingBox();await page.mouse.move(box.x+60,box.y+20);await page.mouse.down({button:'middle'});await page.mouse.move(box.x+100,box.y+40,{steps:10});await page.mouse.up({button:'middle'});
  assert.deepEqual((await local()).layout,pendingLayout);assert.equal((await local()).layoutPending.operationId,pending.operationId);assert.equal(fixture.calls.filter(c=>c.method==='saveGraphLayout').length,writes);
  assert(graphCalls.slice(queryStart).filter(c=>c.method==='graphLayoutOperation').every(c=>c.operationId===pending.operationId));
  supported=true;await fixture.inject('show-receipt');await page.getByRole('button',{name:'查询原布局保存',exact:true}).click();await expect(page.locator('.graph-view-tools').getByText('布局回应待核对',{exact:true})).toHaveCount(0);
  assert.equal(fixture.calls.filter(c=>c.method==='saveGraphLayout').length,writes);
  report.checks.push('Real lost layout ACK plus legacy-mode reopen preserves original pending ID, locks layout drag and queries only the original receipt without another write');
  report.status='passed';
})().catch(async e=>{report.status='failed';report.error=e.stack;process.exitCode=1;try{await page.screenshot({path:path.join(out,'electron-drag-failure.png'),fullPage:true});}catch{}}).finally(async()=>{await app?.close();await server?.close();fixture?.close();fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,before?'before.json':'electron.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));});
