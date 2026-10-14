// Actual Windows input and production Coordinator/SshManager stores; controlled hosts, no model calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,_electron,expect}=require('../node_modules/@playwright/test');
const {SshManager}=require('../electron/ssh-host.cjs');
const {createCoordinatorService,mergeSshState}=require('../electron/coordinator-service.cjs');
const {startCoordinator}=require('../electron/coordinator.cjs');
const {graphFixture}=require('./i06b-ui-fixture.cjs');
const out=process.env.AGENTBRIDGE_GRAPH_REPORT_DIR||path.resolve(__dirname,'../../artifacts/I06C/2026-10-13'),electron=process.argv[2]==='electron';
const report={date:new Date().toISOString(),version:require('../package.json').version,scope:electron?'Packaged Windows Electron, authenticated production Coordinator/SSH lifecycle; controlled hosts':'Windows Edge, production UI/Coordinator/SSH lifecycle; controlled hosts',status:'running',checks:[],nativePrompts:0};
let fixture,ssh,service,server,app,browser,page,lose=false,hide=false,supported=true;const calls=[];
const check=s=>report.checks.push(s);
(async()=>{
 fs.mkdirSync(out,{recursive:true});fixture=await graphFixture();const machine=fixture.router.machine('ssh-fixture');
 ssh=new SshManager({directory:fixture.directory,coordinatorId:'test',installer:{},knownHosts:{}});
 const c={connectionId:'ssh-control',machineId:machine.machineId,daemonId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',revision:1,name:machine.name,host:machine.host,port:22,username:machine.username,authKind:'agent',online:true,stage:'online',autoReconnect:true};ssh.connections.push(c);ssh.save();Object.assign(machine,ssh.publicState(c));fixture.router.save();
 const host=fixture.hosts.get(machine.machineId),drop=ssh.dropTransport.bind(ssh);ssh.dropTransport=connection=>{host.offline=true;drop(connection);};
 ssh.options.onChange=()=>{mergeSshState(machine,ssh.publicState(c));fixture.router.save();};
 // Only transport/probe are controlled. Mutations, receipts, revocation and IPC use production code.
 ssh.test=async()=>{ssh.state(c,'ready');return {status:'ready',probe:{home:'/home/fixture',platform:'linux',arch:'x64',installNeeded:false,runtimeNeeded:false,installPath:'/home/fixture/.local/share/agentbridge',daemonVersion:report.version}};};
 ssh.connect=async()=>{host.offline=false;fixture.router.retryAfter.delete(c.machineId);ssh.state(c,'online');return ssh.publicState(c);};
 ssh.scheduleReconnect=()=>{host.offline=false;fixture.router.retryAfter.delete(c.machineId);ssh.state(c,'online');};
 service=createCoordinatorService({directory:fixture.directory,platform:'win32',network:fixture.router,ssh,version:report.version});
 const invoke=async(method,p={})=>{
  calls.push({method,operationId:p.operationId});
  if(hide&&method==='machine.operation')return {ok:true,result:{operationId:p.operationId,state:'not_found'}};
  const reply=await service.call({method,params:p});if(method==='snapshot'&&!supported){delete reply.result.machineManagement;delete reply.result.daemonManagement;}
  if(lose&&method==='machine.remove'&&reply.ok){lose=false;return {ok:false,error:{code:'DESKTOP_TRANSPORT',message:'controlled lost ACK'}};}return reply;
 };
 if(electron){
  server=await startCoordinator({directory:fixture.directory,version:report.version,service:{async dispatch(m,p={}){if(m==='call')return invoke(p.method,p.params);if(m==='preferences')return {theme:'light',version:report.version,platform:'win32',distribution:'Ubuntu',directory:fixture.directory};if(m==='pending')return [];if(m==='recoverPending')return {resolved:0};if(m==='savePreferences')return p;throw Error(m);},close(){}}});
  const bundle=path.join(fixture.directory,'app');fs.cpSync(path.resolve(__dirname,'../release/win-unpacked'),bundle,{recursive:true});const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:fixture.directory};delete env.ELECTRON_RUN_AS_NODE;
  app=await _electron.launch({executablePath:path.join(bundle,'AgentBridge.exe'),env,timeout:120000});page=await app.firstWindow();assert.equal(await app.evaluate(({app})=>app.getVersion()),report.version);
 }else{
  browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});const ctx=await browser.newContext({viewport:{width:1440,height:960}});await ctx.exposeFunction('machineBridgeCall',invoke);await ctx.addInitScript(({version})=>{window.agentbridge={call:(m,p)=>window.machineBridgeCall(m,p),preferences:async()=>({theme:'light',version,platform:'win32'}),pending:async()=>[],recoverPending:async()=>({resolved:0}),window:async()=>{},savePreferences:async p=>p};},{version:report.version});page=await ctx.newPage();await page.goto(process.argv[2]||'http://127.0.0.1:4218');
 }
 await expect(page.locator('.graph-tool')).toHaveCount(3);await page.getByRole('button',{name:'适配全图',exact:true}).click();const controls=page.locator('.graph-machine-controls>div').filter({hasText:'Linux 测试服务器'});
 await controls.getByRole('button',{name:'连接详情',exact:true}).click();await page.getByRole('button',{name:'关闭机器接入',exact:true}).click();assert.equal(c.stage,'online');assert(!calls.some(x=>x.method==='machine.disconnect'));
 check('Closing details has no connection mutation; editing and remove are explicit machine controls');
 await controls.getByRole('button',{name:'编辑连接',exact:true}).click();await expect(page.getByRole('textbox',{name:'SSH 用户名',exact:true})).toBeDisabled();await page.getByRole('textbox',{name:'机器显示名称'}).fill('编辑后的服务器');await page.getByRole('textbox',{name:'服务器地址'}).fill('alias.example.test');await page.getByRole('spinbutton',{name:'SSH 端口'}).fill('2222');await page.getByRole('button',{name:'保存并测试连接',exact:true}).click();await page.getByRole('button',{name:'连接机器',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);assert.equal(c.host,'alias.example.test');assert.equal(c.port,2222);assert.equal(c.revision,2);assert.equal(c.machineId,'ssh-fixture');
 check('Editing endpoint commits one original receipt then tests/reconnects the same machine; bound SSH user cannot change');
 const updated=page.locator('.graph-machine-controls>div').filter({hasText:'编辑后的服务器'});
 await updated.getByRole('button',{name:'断开',exact:true}).click();await page.getByRole('dialog',{name:'机器操作确认'}).getByRole('button',{name:'返回',exact:true}).click();assert.equal(c.stage,'online');
 await updated.getByRole('button',{name:'断开',exact:true}).click();await page.getByRole('button',{name:'确认断开机器',exact:true}).click();await expect(updated.getByRole('button',{name:'重新连接',exact:true})).toBeVisible();assert.equal(c.autoReconnect,false);assert.equal(fixture.router.network.nodes.length,3);
 await updated.getByRole('button',{name:'重新连接',exact:true}).click();await expect(updated.getByRole('button',{name:'断开',exact:true})).toBeVisible();
 check('Cancel disconnect changes nothing; confirmed disconnect pauses auto-reconnect, retains graph, and original reconnect restores it');
 const member=fixture.nodes.find(n=>n.machineId===c.machineId),leader=fixture.nodes.find(n=>n.adapter==='claude');await fixture.router.call('saveCollaboration',{operationId:'authorize-test',expectedRevision:0,leaderId:leader.nodeId,memberIds:[member.nodeId]});await page.getByRole('button',{name:'刷新数据',exact:true}).click();
 lose=true;hide=true;const at=calls.length;await updated.getByRole('button',{name:'移除机器',exact:true}).click();await page.getByRole('button',{name:'确认移除机器',exact:true}).click();await expect(page.getByText('机器操作回应尚未确认。只查询原操作，机器与授权编辑暂停。',{exact:false})).toBeVisible();const original=calls.slice(at).find(x=>x.method==='machine.remove').operationId;
 await page.reload();await expect(page.locator('.graph-tool')).toHaveCount(2);await expect(page.getByRole('button',{name:'当前主 Agent',exact:true})).toBeDisabled();assert.deepEqual(fixture.router.network.collaboration.memberIds,[]);
 hide=false;await page.getByRole('button',{name:'查询原机器操作',exact:true}).click();await expect(page.getByRole('button',{name:'当前主 Agent',exact:true})).toBeEnabled();assert.equal(calls.slice(at).filter(x=>x.method==='machine.remove').length,1);assert(calls.slice(at).filter(x=>x.method==='machine.operation').every(x=>x.operationId===original));
 check('Remove lost ACK survives reload; authority edits are locked until original receipt query, with exactly one mutation and child revocation');
 await page.locator('nav').getByRole('button',{name:'设置',exact:true}).click();await expect(page.getByText('已移除机器',{exact:true})).toBeVisible();await page.getByRole('button',{name:'恢复机器 · 编辑后的服务器',exact:true}).click();await page.locator('nav').getByRole('button',{name:'机器与 Agent',exact:true}).click();await expect(page.locator('.graph-tool')).toHaveCount(3);await page.locator('.graph-machine-controls>div').filter({hasText:'编辑后的服务器'}).getByRole('button',{name:'重新连接',exact:true}).click();assert.equal(fixture.router.network.nodes.length,3);assert.deepEqual(fixture.router.network.collaboration.memberIds,[]);
 check('Settings restores the same removed machine and nodes without restoring authority; reconnect is explicit');
 if(!electron){
  const samples=[],group=page.locator('.graph-machine[aria-label="编辑后的服务器"] .graph-machine-status');
  for(let i=0;i<20;i++){
   const online=i%2===1,start=performance.now();host.offline=!online;fixture.router.retryAfter.delete(c.machineId);ssh.state(c,online?'online':'disconnected_manual');
   await expect(group).toHaveText(online?'在线':'已断开');samples.push(performance.now()-start);
  }
  const sorted=[...samples].sort((a,b)=>a-b);report.stateSync={environment:'Windows Edge; controlled connection-state events; no forced refresh; actual DOM presentation',samplesMs:samples,p95Ms:sorted[Math.ceil(samples.length*.95)-1],targetMs:2000};assert(report.stateSync.p95Ms<=2000,'state presentation p95 exceeds 2 seconds');check('20 controlled source events reach actual Windows UI within the state-sync p95 target');
 }
 // Native transport/executor controlled; lifecycle/journal/revocation remain production.
 let maintenanceReady=false;const remoteRows=new Map();
 ssh.authenticate=async()=>({controlled:true});
 const current='0.6.0-test-old',target=report.version,release=v=>({digest:'controlled-'+v,manifest:{version:v,files:[]}});
 ssh.installer={maintenancePreview:async()=>({daemonVersion:c.daemonVersion||current,targetVersion:target,rollbackVersion:current,previewId:'controlled-preview',home:'/home/fixture',uid:1000,stateDirectory:'/home/fixture/state',installPath:'/home/fixture/install',profileId:'test'}),stageMaintenance:async()=>({directory:'/controlled-runtime',release:{version:target,...release(target)}}),release,bundle:()=>({manifest:{compatibleDaemons:[]}}),remoteMaintenance:async(_client,input)=>{
  if(input.action!=='query'){remoteRows.set(input.operationId,{operationId:input.operationId,state:'unknown',action:input.action,targetVersion:input.target?.version});return remoteRows.get(input.operationId);}
  const row=remoteRows.get(input.operationId);if(!maintenanceReady)return row;
  return {operationId:row.operationId,state:'confirmed',data:{action:row.action,version:row.targetVersion||target,historyPreserved:true}};
 }};
 await page.locator('.graph-machine-controls>div').filter({hasText:'编辑后的服务器'}).getByRole('button',{name:'后台维护',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'后台维护'})).toContainText(current);await page.getByRole('button',{name:'升级后台',exact:true}).click();const atMaintenance=calls.length;await page.getByRole('button',{name:'确认升级',exact:true}).click();await page.getByRole('button',{name:'关闭后台维护',exact:true}).click();
 await expect(page.getByText('机器操作回应尚未确认。只查询原操作，机器与授权编辑暂停。',{exact:false})).toBeVisible();
 const localTool=page.locator('.react-flow__node[data-id="'+leader.nodeId+'"]');await expect(localTool.getByRole('button',{name:'开始会话',exact:true})).toBeEnabled();await expect(localTool.getByRole('button',{name:'当前主 Agent',exact:true})).toBeDisabled();
 await page.reload();await expect(page.getByRole('button',{name:'查询原机器操作',exact:true})).toBeVisible();maintenanceReady=true;await page.getByRole('button',{name:'查询原机器操作',exact:true}).click();await expect(localTool.getByRole('button',{name:'当前主 Agent',exact:true})).toBeEnabled();assert.equal(calls.slice(atMaintenance).filter(x=>x.method==='machine.maintainDaemon').length,1);assert.equal(c.daemonVersion,target);
 check('Daemon upgrade preview/confirmation uses one original intent, survives reload, allows other machine sessions, and resolves only the original remote receipt');
 supported=false;await page.getByRole('button',{name:'刷新数据',exact:true}).click();await expect(page.getByRole('button',{name:'编辑连接',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'移除机器',exact:true})).toBeDisabled();
 check('An older backend disables unsupported edits/removal; existing graph stays usable');
 await page.screenshot({path:path.join(out,electron?'electron-machines.png':'ui-machines.png'),fullPage:true});report.status='passed';
})().catch(async e=>{report.status='failed';report.error=e.stack||e.message;try{await page?.screenshot({path:path.join(out,electron?'electron-failure.png':'ui-failure.png'),fullPage:true});}catch{}process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,electron?'electron-machines.json':'ui-machines.json'),JSON.stringify(report,null,2));try{await app?.close();await browser?.close();}finally{await server?.close();ssh?.close();fixture?.close();}console.log(JSON.stringify(report,null,2));});
