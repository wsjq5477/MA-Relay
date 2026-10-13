/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Windows acceptance. */
// Real packaged Windows window + independent Linux. Credentials/config come from environment, never report.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {_electron,expect}=require('../node_modules/@playwright/test');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
const out=path.resolve(__dirname,'../../artifacts/I06A-real');fs.mkdirSync(out,{recursive:true});
const reuse=process.env.AB_ACCEPTANCE_REUSE==='1';
const profile=process.env.AB_ACCEPTANCE_PROFILE||(reuse?fs.readFileSync(path.resolve(__dirname,'../../.agentbridge-dev/i06a-windows-profile.txt'),'utf8').trim():fs.mkdtempSync(path.join(os.tmpdir(),'ab-i06a-real-')));
const sourceExecutable=path.resolve(process.argv[2]||path.join(__dirname,'../release/win-unpacked/AgentBridge.exe'));
const localPackage=path.join(os.tmpdir(),'ab-i06a-package-'+require('../package.json').version);
fs.cpSync(path.dirname(sourceExecutable),localPackage,{recursive:true});
const executable=path.join(localPackage,'AgentBridge.exe');
const report={date:new Date().toISOString(),version:require('../package.json').version,scope:'real packaged Windows window and independent Linux using existing native account; isolated Bridge profile',checks:[],errors:[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let app,page,client,windowProcess;
async function launch(){
 client?.close();
 const started=Date.now();const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
 app=await _electron.launch({executablePath:executable,env,timeout:120000});windowProcess=app.process();fs.writeFileSync(path.join(profile,'acceptance-owner.json'),JSON.stringify({windowPid:windowProcess.pid}));page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));
 await expect(page.getByRole('heading',{name:'机器与 Agent',exact:true})).toBeVisible({timeout:120000});
 await expect.poll(()=>{try{return Date.parse(JSON.parse(fs.readFileSync(path.join(profile,'runtime.json'),'utf8')).time)>=started;}catch{return false;}},{timeout:120000}).toBeTruthy();
 client=new CoordinatorClient({directory:profile});await client.attach();
}
async function call(method,params={}){const r=await client.request('call',{method,params});if(!r.ok)throw Object.assign(new Error(r.error.message),{code:r.error.code});return r.result;}
async function finish(taskId,machineId){const deadline=Date.now()+240000;let task;do{task=await call('ipc',{op:'task',taskId,machineId});if(['succeeded','failed','cancelled','unknown'].includes(task.status))break;await sleep(2000);}while(Date.now()<deadline);assert.equal(task.status,'succeeded',task.error?.code||'native reply failed');assert(task.result?.message);assert(task.native?.sessionId,'native Session ID missing');return task;}
async function clickClosing(button){
 try{await button.click({noWaitAfter:true});}catch(e){if(!/Target page, context or browser has been closed/.test(e.message))throw e;}
 await expect.poll(()=>windowProcess.exitCode!==null,{timeout:30000}).toBeTruthy();
}
async function runNative(){
 await page.getByRole('button',{name:'添加 Linux 机器',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'添加 Linux 机器',exact:true});
 await dialog.getByLabel('机器显示名称').fill('6A 验收 Linux');
 await dialog.getByLabel('服务器地址',{exact:true}).fill(process.env.AB_E2E_HOST);
 await dialog.getByLabel('SSH 用户名',{exact:true}).fill(process.env.AB_E2E_USER||'root');
 await dialog.getByRole('radio',{name:'私钥文件',exact:true}).check();
 await dialog.getByLabel('本机私钥路径').fill(process.env.AB_E2E_KEY);
 await dialog.getByRole('button',{name:'测试连接',exact:true}).click();
 await expect.poll(async()=>await dialog.getByRole('button',{name:'信任此主机并继续'}).isVisible()||await dialog.getByRole('heading',{name:'SSH 登录成功',exact:true}).isVisible(),{timeout:60000}).toBeTruthy();
 // Import the already trusted host record; the UI can also reuse Windows OpenSSH known_hosts.
 if(await dialog.getByRole('button',{name:'信任此主机并继续'}).isVisible()){
  const fingerprint=await dialog.locator('.ssh-fingerprint').innerText();assert.equal(fingerprint.trim(),process.env.AB_E2E_FINGERPRINT,'Host fingerprint must match independently verified known_hosts');
  await dialog.getByRole('button',{name:'信任此主机并继续'}).click();
 }
 await expect(dialog.getByRole('heading',{name:'SSH 登录成功',exact:true})).toBeVisible({timeout:60000});
 const started=Date.now();
 const install=dialog.getByRole('button',{name:'安装并连接',exact:true});
 if(await install.isVisible())await install.click();else await dialog.getByRole('button',{name:'连接机器',exact:true}).click();
 await expect.poll(async()=>{const alert=dialog.getByRole('alert');if(await alert.count())throw Error(await alert.innerText());return await dialog.count();},{timeout:1200000}).toBe(0);report.installElapsedMs=Date.now()-started;
 const remote=page.getByRole('region',{name:'6A 验收 Linux',exact:true});await expect(remote).toContainText('OpenCode',{timeout:60000});await expect(remote).toContainText('在线');
 let snapshot=await call('snapshot'),machine=snapshot.machines.find(m=>m.kind==='ssh'&&m.online),node=snapshot.nodes.find(n=>n.machineId===machine.machineId&&n.adapter==='opencode');assert(node);
 const box=remote.getByRole('checkbox',{name:/OpenCode/});await box.focus();await page.keyboard.press('Space');await page.getByRole('button',{name:'接入所选 Agent',exact:true}).click();
 await remote.getByRole('button',{name:'开始会话',exact:true}).click();
 const marker='AB_6A_'+randomUUID().replaceAll('-','');
 const compose=page.getByRole('dialog',{name:'新建会话',exact:true});await compose.getByLabel('需求',{exact:true}).fill('只回复标记 '+marker+'，不要执行任何工具或修改文件。');await compose.getByRole('button',{name:'发送需求',exact:true}).click();
 await expect(compose).toHaveCount(0,{timeout:90000});snapshot=await call('snapshot');let first=snapshot.tasks.find(t=>t.nodeId===node.nodeId);assert(first);
 first=await finish(first.taskId,machine.machineId);assert(first.result.message.includes(marker));report.firstRound={taskId:first.taskId,conversationId:first.conversationId,sessionId:first.native.sessionId,markerReturned:true};
 await page.getByLabel('继续会话',{exact:true}).fill('请只回复上一条用户消息中的验证标记，不要执行工具或修改文件。');
 await expect(page.locator('.network-followup').getByRole('button',{name:'发送',exact:true})).toBeEnabled({timeout:15000});await page.locator('.network-followup').getByRole('button',{name:'发送',exact:true}).click();
 await expect.poll(async()=>{const s=await call('snapshot');return s.tasks.filter(t=>t.nodeId===node.nodeId).length;},{timeout:60000}).toBe(2);
 snapshot=await call('snapshot');let second=snapshot.tasks.find(t=>t.nodeId===node.nodeId&&t.taskId!==first.taskId);second=await finish(second.taskId,machine.machineId);
 assert.equal(second.conversationId,first.conversationId);assert.equal(second.native.sessionId,first.native.sessionId);assert(second.result.message.includes(marker));
 report.native={conversationId:first.conversationId,firstSessionId:first.native.sessionId,secondSessionId:second.native.sessionId,firstTaskId:first.taskId,secondTaskId:second.taskId,markerReturnedBothRounds:true};
 report.checks.push('Actual Windows SSH UI connects Linux, installs package, discovers OpenCode and attaches using Space');
 report.checks.push('Two real native replies from the UI share exact Conversation and native Session IDs');
 return {machine,node,first};
}
async function restoreNative(){
 const previous=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));
 if(!previous.native){const network=JSON.parse(fs.readFileSync(path.join(profile,'agent-network.json'),'utf8'));const requests=network.requests.filter(r=>r.machineId.startsWith('ssh-')&&r.taskId);assert.equal(requests.length,2);previous.native={firstTaskId:requests[0].taskId,secondTaskId:requests[1].taskId};}
 const machineId=previous.native.firstTaskId.split('::')[0];
 await expect.poll(async()=>{const snap=await call('snapshot');return snap.machines.find(m=>m.machineId===machineId)?.online;},{timeout:120000}).toBeTruthy();
 const first=await finish(previous.native.firstTaskId,machineId),second=await finish(previous.native.secondTaskId,machineId);
 assert.equal(first.conversationId,second.conversationId);assert.equal(first.native.sessionId,second.native.sessionId);
 const marker=first.result.message.match(/AB_6A_[a-f0-9]+/)?.[0];assert(marker&&second.result.message.includes(marker));
 const snap=await call('snapshot'),machine=snap.machines.find(m=>m.machineId===machineId),node=snap.nodes.find(n=>snap.tasks.find(t=>t.taskId===first.taskId)?.nodeId===n.nodeId);assert(node);
 report.native={conversationId:first.conversationId,firstSessionId:first.native.sessionId,secondSessionId:second.native.sessionId,firstTaskId:first.taskId,secondTaskId:second.taskId,markerReturnedBothRounds:true};report.firstRound={taskId:first.taskId,conversationId:first.conversationId,sessionId:first.native.sessionId,markerReturned:true};report.nativeEvidenceDate=first.createdAt;
 report.installElapsedMs=previous.installElapsedMs;report.submittedNativePrompts=0;
 report.checks.push('Prior actual Windows SSH UI installation and two native replies reverified by original Task and Session IDs; no prompts resubmitted');
 return {machine,node,first};
}
(async()=>{
 assert.equal(process.platform,'win32');assert(reuse||(process.env.AB_E2E_HOST&&process.env.AB_E2E_KEY),'Set AB_E2E_HOST and AB_E2E_KEY for a new run');
 console.log('Acceptance: launch window');await launch();console.log('Acceptance: window and Coordinator ready');
 const {machine,node,first}=await (reuse?restoreNative():runNative());let snapshot;
 console.log('Acceptance: original native rounds verified');const backendPid=client.info.pid,owner=client.info.coordinatorId;
 await page.getByRole('button',{name:'设置',exact:true}).click();await clickClosing(page.getByRole('button',{name:'仅关闭窗口',exact:true}));
 await sleep(3000);client.close();client=new CoordinatorClient({directory:profile});await client.open();assert.equal(client.info.pid,backendPid);snapshot=await call('snapshot');assert.equal(snapshot.tasks.filter(t=>t.nodeId===node.nodeId).length,2);
 console.log('Acceptance: ordinary close retains backend');report.checks.push('Closing actual window retains the same Coordinator process and original remote tasks');
 await launch();assert.equal(client.info.pid,backendPid);assert.equal(client.info.coordinatorId,owner);snapshot=await call('snapshot');assert.equal(snapshot.tasks.filter(t=>t.nodeId===node.nodeId).length,2);
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'停止后台并退出',exact:true}).click();await clickClosing(page.getByRole('dialog',{name:'停止后台',exact:true}).getByRole('button',{name:'确认停止并退出',exact:true}));
 await sleep(3000);client.close();await expect.poll(()=>{try{process.kill(backendPid,0);return false;}catch{return true;}},{timeout:20000}).toBeTruthy();
 console.log('Acceptance: explicit stop verified');report.checks.push('Reopen reuses same backend without new prompts; explicit stop exits Coordinator');
 await launch();assert.notEqual(client.info.pid,backendPid);assert.equal(client.info.coordinatorId,owner);
 await expect.poll(async()=>{const s=await call('snapshot');return s.machines.find(m=>m.machineId===machine.machineId)?.online;},{timeout:120000}).toBeTruthy();
 const original=await call('ipc',{op:'task',machineId:machine.machineId,taskId:first.taskId});assert.equal(original.native.sessionId,first.native.sessionId);
 snapshot=await call('snapshot');assert.equal(snapshot.tasks.filter(t=>t.nodeId===node.nodeId).length,2);
 report.checks.push('After explicit stop and new backend launch, same Linux machine reconnects and original task/session/history remain; no new prompts');
 await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.screenshot({path:path.join(out,'windows-settings.png'),mask:[page.locator('.network-relations p').filter({hasText:/桌面数据/})]});
 report.status='passed';
})().catch(e=>{report.status='failed';report.errors.push({code:e.code||'VERIFY_FAILED',message:e.message.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,'[server]')});process.exitCode=1;}).finally(async()=>{
 const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.resolve(__dirname,'../../.agentbridge-dev/i06a-windows-profile.txt'),profile,{mode:0o600});save();
 // Close the polling UI first; shutdown must not trigger a new backend from a live renderer.
 if(windowProcess?.exitCode===null){try{await Promise.race([app.close(),sleep(10000)]);}catch{}}
 try{if(client?.socket&&!client.socket.destroyed)await Promise.race([client.request('shutdown'),sleep(5000)]);}catch{}client?.close();
 save();console.log(JSON.stringify(report,null,2));process.exit(process.exitCode||0);
});
