const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const {graphFixture}=require('./i06b-ui-fixture.cjs');
const out=process.env.AGENTBRIDGE_GRAPH_REPORT_DIR?path.resolve(process.env.AGENTBRIDGE_GRAPH_REPORT_DIR):path.resolve(__dirname,'../../artifacts/graph-check',require('../package.json').version);
const report={date:new Date().toISOString(),version:require('../package.json').version,status:'running',scope:'Windows Edge controlled 20-machine/60-node / 59-edge graph; actual pointer to node-transform feedback; no native inference',viewport:{width:1440,height:960},cpu:os.cpus()[0]?.model};
let browser,fixture;
(async()=>{
  fixture=await graphFixture();await fixture.inject('scale');
  const initial=await fixture.router.snapshot(),initialLeader=initial.nodes.find(n=>n.adapter==='claude'&&initial.machines.find(m=>m.machineId===n.machineId)?.kind==='windows');
  await fixture.router.call('saveCollaboration',{operationId:require('node:crypto').randomUUID(),expectedRevision:initial.collaboration.revision,leaderId:initialLeader.nodeId,memberIds:initial.nodes.filter(n=>n.nodeId!==initialLeader.nodeId).map(n=>n.nodeId)});
  report.savedEdges=59;
  browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
  const page=await browser.newPage({viewport:report.viewport});
  await page.exposeFunction('bridgeCall',(m,p)=>fixture.call(m,p));
  await page.addInitScript(version=>{window.agentbridge={call:(m,p)=>window.bridgeCall(m,p),preferences:async()=>({theme:'light',version,platform:'win32'}),pending:async()=>[],recoverPending:async()=>({resolved:0})};},report.version);
  await page.goto(process.argv[2]||'http://127.0.0.1:4216');
  await expect(page.locator('.react-flow__edge')).toHaveCount(59);
  await expect(page.locator('.graph-tool')).toHaveCount(60);await expect(page.locator('.graph-machine')).toHaveCount(20);
  await page.getByRole('button',{name:'Windows 测试机',exact:true}).click();
  await page.waitForTimeout(1200);
  const snapshot=await fixture.router.snapshot(),node=snapshot.nodes.find(n=>n.adapter==='claude'&&snapshot.machines.find(m=>m.machineId===n.machineId)?.kind==='windows');
  const selector='.react-flow__node[data-id="'+node.nodeId+'"]';
  await page.evaluate(selector=>{
    window.feedbackSamples=[];window.dragLongTasks=[];let began=null,recorded=false;
    document.addEventListener('pointerdown',()=>{began=null;recorded=false;},true);
    document.addEventListener('pointermove',e=>{if(e.buttons===1&&!recorded&&began===null)began=performance.now();},true);
    new MutationObserver(()=>{if(began!==null&&!recorded){window.feedbackSamples.push(performance.now()-began);recorded=true;}}).observe(document.querySelector(selector),{attributes:true,attributeFilter:['style']});
    new PerformanceObserver(list=>window.dragLongTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:false});
  },selector);
  for(let i=0;i<20;i++){
    const box=await page.locator(selector+' .graph-tool-title').boundingBox();assert(box);
    await page.mouse.move(box.x+55,box.y+8);await page.mouse.down();
    await page.mouse.move(box.x+55+(i%2?-8:8),box.y+8+(i%2?-10:10),{steps:4});await page.mouse.up();
  }
  const result=await page.evaluate(()=>({samples:window.feedbackSamples,longTasks:window.dragLongTasks,userAgent:navigator.userAgent}));
  report.samplesMs=result.samples;report.longTasksMs=result.longTasks;report.browser=result.userAgent;
  assert.equal(result.samples.length,20);
  report.p95Ms=[...result.samples].sort((a,b)=>a-b)[Math.ceil(result.samples.length*.95)-1];
  report.maximumLongTaskMs=Math.max(0,...result.longTasks);
  assert(report.p95Ms<=100);assert(report.maximumLongTaskMs<=500);
  report.status='passed';
})().catch(e=>{report.status='failed';report.error=e.message;process.exitCode=1;}).finally(async()=>{await browser?.close();fixture?.close();fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));});
