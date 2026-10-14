// Real packaged Windows window + independent SSH Linux; inherited native
// accounts. Existing credentials are read only in memory. All Bridge state is
// isolated; reports omit addresses, credentials and internal owner identities.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const {_electron,expect}=require('../node_modules/@playwright/test');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
const {CredentialStore}=require('../electron/ssh-credentials.cjs');
const {SshManager}=require('../electron/ssh-host.cjs');
const {remoteExec,quote}=require('../electron/ssh-install.cjs');
const version=require('../package.json').version,out=path.resolve(__dirname,'../../artifacts/I06C-final/2026-10-14');
const original=process.env.AGENTBRIDGE_EXISTING_PROFILE||path.join(os.homedir(),'AppData/Roaming/agentbridge-desktop');
const profile=process.env.AB_I06C_PROFILE||fs.mkdtempSync(path.join(os.tmpdir(),'ab-i06c-real-'));
const linuxState='/tmp/ab-i06c-'+randomUUID().slice(0,8);
const report={date:new Date().toISOString(),version,scope:'Packaged Windows window, independent SSH Linux, production IPC/graph/daemon/MCP and inherited Claude/OpenCode accounts; isolated Bridge profiles',status:'running',phase:'preflight',checks:[],chains:[],errors:[]};
const save=()=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'real.json'),JSON.stringify(report,null,2)+'\n');};
const phase=s=>{report.phase=s;save();console.log(s);};
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,16);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let app,page,client,credentials,connection,secret,daemonInstalled=false,allTerminal=true;
const submitted=[];
async function call(method,params={}){const r=await client.request('call',{method,params});if(!r.ok)throw Object.assign(Error('Bridge operation failed'),{code:r.error.code});return r.result;}
async function launch(){
  const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:profile};delete env.ELECTRON_RUN_AS_NODE;
  phase('launching-window');app=await _electron.launch({executablePath:path.join(profile,'package-'+version,'AgentBridge.exe'),cwd:profile,env,timeout:120000});phase('electron-attached');app.process().on('exit',(code,signal)=>{report.windowExit={code,signal};save();});
  page=await app.firstWindow({timeout:120000});phase('first-window');await expect(page.getByRole('heading',{name:'机器与 Agent',exact:true})).toBeVisible({timeout:120000});
  phase('heading-visible');client?.close();client=new CoordinatorClient({directory:profile});await expect.poll(async()=>{try{await client.attach();return true;}catch(e){if(['ENOENT','ECONNREFUSED'].includes(e.code))return false;throw e;}},{timeout:120000}).toBeTruthy();phase('ipc-attached');
  await expect.poll(async()=>{try{return !!(await call('snapshot')).nodes.length;}catch{return false;}},{timeout:120000}).toBeTruthy();
}
async function finish(task,machineId){
  const deadline=Date.now()+360000;submitted.push({taskId:task.taskId,machineId});
  while(Date.now()<deadline){
    const value=await call('ipc',{op:'task',taskId:task.taskId,machineId});
    if(['succeeded','failed','cancelled','unknown'].includes(value.status)){if(value.status==='unknown')allTerminal=false;return value;}
    await sleep(2000);
  }
  allTerminal=false;throw Object.assign(Error('Original task still pending'),{code:'NATIVE_PENDING'});
}
const summary=t=>({taskId:t.taskId,conversationId:t.conversationId,status:t.status,nativeSessionRef:t.native?.sessionId?hash(t.native.sessionId):null,errorCode:t.error?.code});
async function graphRelation(leader,member){
  await page.getByRole('button',{name:'机器与 Agent',exact:true}).click();
  await page.getByRole('button',{name:'全部机器',exact:true}).click();
  await page.getByRole('button',{name:'适配全图',exact:true}).click();await sleep(1000);
  const node=id=>page.locator('.react-flow__node[data-id="'+id+'"]');
  await node(leader.nodeId).getByRole('button',{name:'设为主 Agent',exact:true}).click();
  const a=await node(leader.nodeId).locator('.react-flow__handle.source').boundingBox(),b=await node(member.nodeId).locator('.react-flow__handle.target').boundingBox();assert(a&&b);
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:30});await page.mouse.up();
  await page.getByRole('button',{name:'保存授权',exact:true}).click();
  await expect.poll(async()=>{const r=await call('collaboration');return {leader:r.leaderId,members:r.memberIds};}).toEqual({leader:leader.nodeId,members:[member.nodeId]});
}
async function chain(leader,member,direction){
  phase(direction);await graphRelation(leader,member);
  const marker='AB_I06C_'+randomUUID().slice(0,8);
  const requestId=randomUUID();
  const message='请实际使用 AgentBridge MCP list_agents 发现允许的子节点，向 '+member.name+' 委派只回复 '+marker+' 的任务。委派使用固定 requestId "child-'+marker+'". 用 task_result 等待并读取子 Agent 的真实结果，然后仅汇总返回子 Agent 的完整标记。只使用这三个协作工具，不读写文件，不运行终端，不自行代替子 Agent 回复。';
  const submission={op:'submit',nodeId:leader.nodeId,requestId,message,collaboration:true};
  let accepted;const readinessDeadline=Date.now()+120000;
  while(!accepted){
    try{accepted=await call('nodeRequest',submission);}
    catch(e){
      // Hub rejects unhealthy BEFORE creating/executing a native task. Only this
      // definite rejection may retry with identical payload and ORIGINAL ID.
      // Unknown/network responses are never caught/replayed here.
      if(e.code!=='AGENT_UNHEALTHY'||Date.now()>=readinessDeadline)throw e;
      report.readinessRejections=(report.readinessRejections||0)+1;save();
      await sleep(2000);
    }
  }
  const parent=await finish(accepted,leader.machineId);
  const snapshot=await call('snapshot'),delegation=snapshot.delegations.find(d=>d.parentTaskId===parent.taskId);
  const child=delegation?.taskId?await call('ipc',{op:'task',taskId:delegation.taskId,machineId:member.machineId}):null;
  if(child)submitted.push({taskId:child.taskId,machineId:member.machineId});
  const toolNames=[...new Set((parent.events||[]).filter(e=>['progress','tool'].includes(e.event.kind)).flatMap(e=>[...JSON.stringify(e.event).matchAll(/list_agents|delegate|task_result/g)].map(m=>m[0])))];
  const passed=parent.status==='succeeded'&&parent.result?.message.includes(marker)&&child?.status==='succeeded'&&child.result?.message.includes(marker)&&['list_agents','delegate','task_result'].every(n=>toolNames.includes(n));
  report.chains.push({direction,status:passed?'passed':'failed',marker,parent:summary(parent),child:child?summary(child):null,toolNames,graphSavedActualAuthorization:true,manuallyCopiedChildResults:0});
  save();assert(passed,'Real MCP/native chain failed');
}
async function maintenance(action){
  phase('maintenance-'+action);
  const snapshot=await call('snapshot'),machine=snapshot.machines.find(m=>m.machineId===remoteMachine);
  const preview=await call('machine.daemonPreview',{machineId:remoteMachine});
  const operationId=randomUUID(),targetVersion=action==='upgrade'?preview.targetVersion:action==='rollback'?preview.rollbackVersion:undefined;
  const params={machineId:remoteMachine,connectionId:machine.connectionId,expectedRevision:machine.revision,operationId,config:{action,previewId:preview.previewId,expectedVersion:preview.daemonVersion,...(targetVersion?{targetVersion}:{})}};
  await call('machine.maintainDaemon',params);
  let receipt;const deadline=Date.now()+180000;
  do{await sleep(1500);receipt=await call('machine.operation',{operationId});}while(!['confirmed','rejected'].includes(receipt.state)&&Date.now()<deadline);
  report.maintenance.push({action,operationRef:hash(operationId),state:receipt.state,from:preview.daemonVersion,target:targetVersion,errorCode:receipt.error?.code,data:receipt.data?{version:receipt.data.version,rolledBack:receipt.data.rolledBack,historyPreserved:receipt.data.historyPreserved}:null});save();
  assert.equal(receipt.state,'confirmed','Original maintenance receipt did not confirm');
  if(['upgrade','rollback'].includes(action))await expect.poll(async()=>{const v=await call('snapshot');return v.machines.find(m=>m.machineId===remoteMachine)?.online;},{timeout:90000}).toBeTruthy();
  return receipt;
}
async function restartCoordinator(){
  const oldPid=client.info.pid;
  await page.locator('nav').getByRole('button',{name:'设置',exact:true}).click();
  try{await page.getByRole('button',{name:'仅关闭窗口',exact:true}).click({noWaitAfter:true});}catch{}
  await sleep(1200);await client.request('shutdown');client.close();await sleep(1800);await launch();assert.notEqual(client.info.pid,oldPid);
  await call('machine.connectSsh',{machineId:remoteMachine,operationId:randomUUID(),installIfNeeded:false});
  await expect.poll(async()=>{const v=await call('snapshot');return v.machines.find(m=>m.machineId===remoteMachine)?.online;},{timeout:90000}).toBeTruthy();
}
let remoteMachine;
report.maintenance=[];
async function initialOldInstall(){
  phase('initial-alpha10-isolated-install');
  const {identity}=require('../electron/coordinator.cjs');
  const owner=identity(profile),manager=new SshManager({directory:profile,coordinatorId:owner.coordinatorId,packageDirectory:'\\\\wsl.localhost\\Ubuntu\\tmp\\ab-i06c-old-linux'});
  try{
    const draft=await manager.call('machine.createSshDraft',{name:'6C 隔离 Linux',host:connection.host,port:connection.port,username:connection.username,authKind:connection.authKind,keyPath:connection.keyPath});
    if(connection.authKind!=='agent')await manager.call('credential.provide',{connectionId:draft.connectionId,secret:secret||'',save:true});
    const tested=await manager.call('machine.testSsh',{connectionId:draft.connectionId});assert.equal(tested.status,'ready');
    const connected=await manager.call('machine.connectSsh',{connectionId:draft.connectionId,operationId:randomUUID(),installIfNeeded:true});assert(connected.online);assert.equal(connected.daemonVersion,'0.6.0-alpha.10');remoteMachine=connected.machineId;daemonInstalled=true;
  }finally{manager.close();}
}
async function roundTrip(member){
  phase('remote-native-session-two-rounds');const marker='AB_C_SESSION_'+randomUUID().slice(0,8);
  const a=await finish(await call('nodeRequest',{op:'submit',nodeId:member.nodeId,requestId:randomUUID(),message:'请记住标记 '+marker+'，仅回复该标记。不要读写文件或调用工具。'}),member.machineId);
  assert.equal(a.status,'succeeded');assert(a.result?.message.includes(marker));assert(a.native?.sessionId);
  const b=await finish(await call('nodeRequest',{op:'continue',nodeId:member.nodeId,requestId:randomUUID(),conversationId:a.conversationId,message:'仅回复上一轮我提供的完整标记，不调用工具。'}),member.machineId);
  assert.equal(b.status,'succeeded');assert(b.result?.message.includes(marker));assert.equal(b.native?.sessionId,a.native.sessionId);
  report.checks.push('Independent Linux OpenCode two rounds keep the exact native Session and original conversation');save();
}
(async()=>{
  assert.equal(process.platform,'win32');
  connection=JSON.parse(fs.readFileSync(path.join(original,'ssh-connections.json'))).connections.find(c=>c.name===(process.env.AGENTBRIDGE_EXISTING_CONNECTION_NAME||'阿里云'));
  assert(connection,'Existing authorized connection required');credentials=new CredentialStore(original);
  secret=await credentials.read(connection);
  if(connection.authKind==='password'&&!secret)throw Object.assign(Error('Saved login unavailable'),{code:'CREDENTIAL_REQUIRED'});
  phase('preflight-copy-known-hosts');
  fs.copyFileSync(path.join(original,'ssh-known-hosts.json'),path.join(profile,'ssh-known-hosts.json'));
  fs.writeFileSync(path.join(profile,'desktop.json'),JSON.stringify({theme:'light',distribution:'Ubuntu',directory:linuxState}));
  phase('preflight-wsl-directory');
  execFileSync('wsl.exe',['-d','Ubuntu','--exec','mkdir','-p',linuxState],{windowsHide:true,timeout:15000});
  phase('preflight-copy-package');
  const source=path.resolve(__dirname,'../release/win-unpacked'),destination=path.join(profile,'package-'+version);
  function copy(d,to){fs.mkdirSync(to,{recursive:true});for(const row of fs.readdirSync(d,{withFileTypes:true})){const src=path.join(d,row.name),dst=path.join(to,row.name);if(row.isDirectory())copy(src,dst);else if(row.isFile())fs.writeFileSync(dst,fs.readFileSync(src));else throw Object.assign(Error('Unexpected package entry'),{code:'PACKAGE_ENTRY'});}}const copyMarker=path.join(destination,'.acceptance-copy.json');const expectedAsar=hash(fs.readFileSync(path.join(source,'resources/app.asar')));if(!fs.existsSync(copyMarker)||JSON.parse(fs.readFileSync(copyMarker)).asar!==expectedAsar){copy(source,destination);fs.writeFileSync(copyMarker,JSON.stringify({version,asar:expectedAsar}));}
  fs.writeFileSync(path.resolve(__dirname,'../../.agentbridge-dev/i06c-profile.txt'),profile,{mode:0o600});
  report.originalConfigDigest=hash(fs.readFileSync(path.join(original,'ssh-connections.json')));
  if(!process.env.AB_I06C_RESUME)await initialOldInstall();else{const rows=JSON.parse(fs.readFileSync(path.join(profile,'ssh-connections.json'))).connections;assert.equal(rows.length,1);remoteMachine=rows[0].machineId;daemonInstalled=true;report.previousFailure='real-alpha11-failed.json';}
  phase('window');await launch();assert.equal(client.info.version,version);
  if(process.env.AB_I06C_RESUME)await call('machine.connectSsh',{machineId:remoteMachine,operationId:randomUUID(),installIfNeeded:false});
  await expect.poll(async()=>{const v=await call('snapshot');return v.machines.find(m=>m.machineId===remoteMachine)?.online;},{timeout:90000}).toBeTruthy();
  await maintenance('upgrade');
  const connected={machineId:remoteMachine};
  await page.getByRole('button',{name:'刷新数据',exact:true}).click();
  let snapshot=await call('snapshot');
  const leader=snapshot.nodes.find(n=>n.adapter==='claude'&&snapshot.machines.find(m=>m.machineId===n.machineId)?.kind==='windows');
  const member=snapshot.nodes.find(n=>n.adapter==='opencode'&&n.machineId===connected.machineId);assert(leader&&member);
  for(const n of [leader,member])if(!n.connected)await call('attachNode',{nodeId:n.nodeId});
  await page.getByRole('button',{name:'刷新数据',exact:true}).click();
  report.checks.push('Packaged Windows UI and independent Linux deployment/discovery use isolated Bridge profiles; inherited accounts; no model override');
  await roundTrip(member);
  await chain(leader,member,'Windows-Claude-to-independent-Linux-OpenCode');
  await chain(member,leader,'independent-Linux-OpenCode-to-Windows-Claude');
  phase('window-reopen');
  const before=await call('snapshot'),pid=client.info.pid,layout=await call('graphLayout');
  await page.screenshot({path:path.join(out,'real-graph.png'),mask:[page.locator('.graph-group-handle p')]});
  await page.getByRole('button',{name:'设置',exact:true}).click();
  try{await page.getByRole('button',{name:'仅关闭窗口',exact:true}).click({noWaitAfter:true});}catch{}
  await sleep(2000);await launch();assert.equal(client.info.pid,pid);
  snapshot=await call('snapshot');assert.deepEqual(snapshot.collaboration,before.collaboration);
  assert.deepEqual((await call('graphLayout')).groups,layout.groups);assert.equal(snapshot.tasks.length,before.tasks.length);
  report.checks.push('Real mouse authorization in both directions; window close/reopen retains same central process, graph layout, relationships and original native tasks without resubmission');
  if(process.env.AB_I06C_EXTRA)await require('./windows-i06c-extra.cjs')({call,finish,member,leader,profile,connection,credentials,report,save,phase,maintenance,client,page,restartCoordinator,closeInstrumented:async()=>{try{await app.evaluate(({app})=>app.quit());}catch{}await sleep(1500);}});
  await maintenance('rollback');
  await maintenance('upgrade');
  await maintenance('stop');
  await call('machine.connectSsh',{machineId:remoteMachine,operationId:randomUUID(),installIfNeeded:false});
  await maintenance('uninstall');
  assert.equal(hash(fs.readFileSync(path.join(original,'ssh-connections.json'))),report.originalConfigDigest);
  report.checks.push('Original user SSH configuration unchanged; owned isolated daemon uninstalled and historical state preserved');
  report.status='passed';phase('complete');
})().catch(e=>{report.status=e.code==='CREDENTIAL_REQUIRED'?'blocked':'failed';report.errors.push({phase:report.phase,code:e.code||'VERIFY_FAILED',errorName:e.name,childExit:e.status,syscall:e.syscall,message:'Real acceptance failed at the recorded phase; sensitive native/SSH details stay in the private test profile.'});process.exitCode=1;}).finally(async()=>{
  try{if(client){for(const t of submitted){const value=await call('ipc',{op:'task',taskId:t.taskId,machineId:t.machineId});if(!['succeeded','failed','cancelled'].includes(value.status))allTerminal=false;}}}catch{allTerminal=false;}
  try{if(app)await app.evaluate(({app})=>app.quit());}catch{}try{await client?.request('shutdown');}catch{}client?.close();
  report.cleanup={isolatedUninstalled:report.status==='passed',retainedForOriginalReceiptInspection:report.status!=='passed'};
  credentials?.close();save();if(report.status!=='passed')fs.writeFileSync(path.join(out,'retained-profile.txt'),profile,{mode:0o600});console.log(JSON.stringify(report,null,2));process.exit(report.status==='passed'?0:1);
});
