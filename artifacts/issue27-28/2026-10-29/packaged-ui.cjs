const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const repo=path.resolve(__dirname,'../../..'),desktopRequire=createRequire(path.join(repo,'desktop/package.json'));
const {_electron}=desktopRequire('playwright');
const {CoordinatorClient}=require(path.join(repo,'desktop/electron/coordinator-client.cjs'));
const {makeProfile}=require('./runtime-fixture.cjs');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-issues27-28-ui-')),{record,bytes}=makeProfile(directory);
const report={date:new Date().toISOString(),version:'0.6.0-alpha.70',status:'running',scope:'actual packaged unpacked EXE UI with Playwright debugging transport; isolated synthetic profile; separate ordinary portable test has no debugging',modelCalls:0,checks:[]};
let app,client;const errors=[];
const bounded=(promise,ms)=>Promise.race([promise,new Promise(resolve=>{const timer=setTimeout(()=>resolve('timeout'),ms);timer.unref();})]);
(async()=>{
  const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:directory};delete env.ELECTRON_RUN_AS_NODE;
  app=await _electron.launch({executablePath:path.join(repo,'desktop/release/win-unpacked/AgentBridge.exe'),env,timeout:420000});
  const page=await app.firstWindow({timeout:420000});page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(420000);
  await page.getByRole('button',{name:'检查关系冲突'}).click();
  await page.getByRole('heading',{name:'核对恢复提案'}).waitFor();
  assert.deepEqual(fs.readFileSync(path.join(directory,'agent-network.json')),bytes);
  const submit=page.getByRole('button',{name:'备份并恢复关系'});assert.equal(await submit.isDisabled(),true);
  await page.locator('.relation-conflict-panel').screenshot({path:path.join(__dirname,'packaged-recovery-proposal-final.png')});
  await page.getByRole('button',{name:'取消提案'}).click();assert.deepEqual(fs.readFileSync(path.join(directory,'agent-network.json')),bytes);
  await page.getByRole('button',{name:'检查关系冲突'}).click();await page.getByRole('checkbox').check();await submit.click();
  await page.getByText(/关系恢复已提交。原文件副本/).waitFor();
  const restored=JSON.parse(fs.readFileSync(path.join(directory,'agent-network.json')));
  assert.equal(restored.relations[0].revision,15);assert.equal(restored.relations[0].memberIds.length,6);assert.equal(restored.relations[0].memberIds.includes('a'),false);assert(restored.relations[0].memberIds.includes('f'));assert(restored.relations[0].memberIds.includes('g'));
  assert.deepEqual(restored.requests,record.requests);assert.deepEqual(restored.nodeOperations,record.nodeOperations);assert.deepEqual(restored.relationOperations,record.relationOperations);assert.deepEqual(restored.relations[1],record.relations[1]);
  const receipt=restored.relationRecoveryOperations[0];assert.deepEqual(fs.readFileSync(path.join(directory,receipt.backup)),bytes);
  await page.getByText(/关系恢复已提交。原文件副本/).screenshot({path:path.join(__dirname,'packaged-recovery-success-final.png')});
  assert.deepEqual(errors,[]);report.checks.push('Actual packaged UI: read-only proposal, disabled submit, cancellation preserves bytes, explicit checkbox/submit restores 13→15 and 5→7→6 without regranting removed member');report.checks.push('Actual backup bytes, original task unknown, all original receipts and other relationship retained');report.pageErrors=0;
  client=new CoordinatorClient({directory});await client.attach();assert(client.info.capabilities.includes('relation-recovery-observations-v2'));assert(client.info.capabilities.includes('ssh-current-observation-v1'));
  await client.request('shutdown');client.close();client=null;report.status='passed';
  report.teardown='owned debugging application exits explicitly; ordinary portable lifecycle is verified separately';
  fs.writeFileSync(path.join(__dirname,'packaged-ui-checkpoint.json'),JSON.stringify(report,null,2)+'\n');
  await bounded(app.evaluate(({app})=>app.exit(0)).catch(()=>{}),5000);if(app.process().exitCode===null)app.process().kill();app=null;
})().catch(error=>{report.status='failed';report.error={code:error.code||'UI_VERIFY',message:error.message};process.exitCode=1;}).finally(async()=>{
  try{if(client?.socket&&!client.socket.destroyed)await bounded(client.request('shutdown'),5000);}catch{}client?.close();if(app){try{app.process().kill();}catch{}}
  fs.writeFileSync(path.join(__dirname,'packaged-ui.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));process.exit(process.exitCode||0);
});
