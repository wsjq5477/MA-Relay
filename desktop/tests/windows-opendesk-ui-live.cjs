// Manual Windows acceptance: packaged Electron renderer + real Coordinator and
// installed Desktop gateway, disposable Bridge profile, no prompt submission.
const fs=require(process.versions.electron?'original-fs':'node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
if(process.platform!=='win32')throw Error('Windows required');
const executable=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]);
const {_electron,expect}=require(process.env.AGENTBRIDGE_TEST_PLAYWRIGHT||'../node_modules/@playwright/test');
const resources=path.join(path.dirname(executable),'resources');
const {CoordinatorClient}=require(path.join(resources,'bridge/desktop/electron/coordinator-client.cjs'));
const version=JSON.parse(fs.readFileSync(path.join(resources,'linux-package/manifest.json'))).version;
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-opendesk-ui-live-')),machineId='ui-live-windows';
fs.writeFileSync(path.join(directory,'desktop.json'),JSON.stringify({theme:'dark',distribution:'',directory:'/tmp/'+path.basename(directory)}));
fs.writeFileSync(path.join(directory,'machines.json'),JSON.stringify({version:1,localMachineId:machineId,machines:[{machineId,name:'Windows 本机',kind:'windows',platform:'win32'}],connections:[],instances:[]}));
const report={date:new Date().toISOString(),status:'running',version,environment:'Windows packaged Electron with Playwright debug transport / disposable profile / production Coordinator and installed OpenDesk gateway',modelCalls:0,checks:[],pageErrors:[],appAsarSha256:createHash('sha256').update(fs.readFileSync(path.join(resources,'app.asar'))).digest('hex')};
let app,client,page;
async function call(method,params={}){const r=await client.request('call',{method,params});if(!r.ok)throw Error(r.error.code);return r.result;}
(async()=>{
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:directory};delete env.ELECTRON_RUN_AS_NODE;
 app=await _electron.launch({executablePath:executable,args:[],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',e=>report.pageErrors.push(e.message));
 const row=page.locator('.inventory-node').filter({has:page.getByRole('heading',{name:'OpenDesk Desktop',exact:true})});
 await expect(row).toBeVisible({timeout:60000});await expect(row).toContainText('已发现，待接入');await expect(row).not.toContainText('尚未支持执行');
 client=new CoordinatorClient({directory});await client.attach();assert.equal(client.info.version,version);
 const before=await call('snapshot'),original=before.nodes.find(n=>n.machineId===machineId&&n.adapter==='opendesk-desktop');assert.equal(original.healthy,true);assert.equal(original.executionSupported,true);
 report.checks.push('packaged renderer shows the healthy installed Desktop as discovered and ready to attach');
 await expect(row.getByRole('button',{name:'接入',exact:true})).toBeEnabled();await row.getByRole('button',{name:'接入',exact:true}).click();
 await expect(row.getByRole('button',{name:'开始会话',exact:true})).toBeEnabled({timeout:60000});
 const after=await call('snapshot'),node=after.nodes.find(n=>n.nodeId===original.nodeId);assert.equal(node.connected,true);assert.equal(node.teamCollaboration,false);
 report.checks.push('clicking attach reaches real production management on the original Windows node and enables the session action');
 await row.getByRole('button',{name:'开始会话',exact:true}).click();const dialog=page.getByRole('dialog',{name:'新建会话',exact:true});await expect(dialog).toContainText('OpenDesk Desktop');await expect(dialog.getByRole('textbox',{name:'需求',exact:true})).toBeVisible();await expect(dialog.getByRole('checkbox')).toHaveCount(0);
 await dialog.getByRole('button',{name:'关闭新建会话',exact:true}).click();await expect(dialog).toHaveCount(0);
 report.checks.push('real session composer opens with the original target and hosted collaboration disabled; no prompt is sent');
 await row.screenshot({path:output.replace(/\.json$/,'.png')});
 const final=await call('snapshot');assert.equal(final.tasks.length,before.tasks.length);assert.deepEqual(report.pageErrors,[]);
 report.checks.push('no new task or page error; native configuration and model/provider were not changed');report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code,message:e.message};process.exitCode=1;}).finally(async()=>{
 // Electron's child tree may keep Playwright close pending while its detached
 // Coordinator is alive. Stop only this disposable backend, after proof of no
 // tasks/pending operations, before waiting for the test window process.
 if(client){try{
   const snapshot=await call('snapshot'),pending=await client.request('pending'),graph=await call('graphPending');
   if(snapshot.tasks.every(t=>['succeeded','failed','cancelled'].includes(t.status))&&pending.length===0&&graph.length===0)await client.request('shutdown');
 }catch{}client.close();}
 try{await app?.close();}catch{}
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
});
