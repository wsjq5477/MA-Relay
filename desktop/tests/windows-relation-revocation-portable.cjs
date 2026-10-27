// Ordinary no-debug portable EXE, production pipe and disposable persisted data.
// UI draft interactions are covered separately by windows-relation-revocation.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{createHash}=require('node:crypto');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
const {bindPortableWindow}=require('./windows-portable-window.cjs');
const {digest}=require('../electron/graph-layout.cjs');
if(process.platform!=='win32')throw Error('Windows required');
const source=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]),version=require('../package.json').version;
const resuming=!!process.argv[4],profile=resuming?path.resolve(process.argv[4]):fs.mkdtempSync(path.join(os.tmpdir(),'ab-revocation-portable-')),exe=path.join(profile,path.basename(source)),nativeHome=path.join(profile,'native-home');
if(resuming){assert(profile.startsWith(path.resolve(os.tmpdir())+path.sep));assert(path.basename(profile).startsWith('ab-revocation-portable-'));assert.deepEqual(fs.readFileSync(exe),fs.readFileSync(source));}else fs.copyFileSync(source,exe);
fs.mkdirSync(nativeHome,{recursive:true});
const machineId='isolated-windows',time='2020-01-01T00:00:00Z';
const write=(name,data)=>{if(resuming)return;const file=path.join(profile,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data));};
const node=(nodeId,adapter,extra={})=>({nodeId,machineId,adapter,name:'Controlled '+nodeId,executable:'C:/synthetic-never-run/'+nodeId+'.exe',managed:true,connected:true,executionSupported:true,...extra});
write('desktop.json',{theme:'light',distribution:'',directory:'/tmp/'+path.basename(profile)});
write('machines.json',{version:1,localMachineId:machineId,machines:[{machineId,name:'Controlled Windows',kind:'windows',platform:'win32'}],connections:[],instances:[]});
write('agent-network.json',{version:1,revision:0,nodes:[node('main','claude',{executionSupported:false}),node('member','opencode',{connected:false,executionSupported:false}),node('independent','codex'),node('other','pi')],collaboration:{leaderId:'main',memberIds:['member'],revision:4},requests:[],delegations:[]});
const params={operationId:'original-node-unknown',machineId,nodeId:'member',action:'attach'},unknown={lane:'node',method:'manageNode',operationId:params.operationId,params,fingerprint:digest(params),state:'unknown',time,error:{code:'NATIVE_START_TIMEOUT',message:'controlled retained timeout'}};
write('graph-pending.json',[unknown]);
const task={taskId:'retained-task',conversationId:'retained-session',requestId:'retained-request',targetAgent:'retained-agent',message:'Synthetic retained history',status:'succeeded',createdAt:time,updatedAt:time,lastSeq:0,events:[],native:{sessionId:'original-native-session'},result:{message:'retained answer'}};
write('windows/node-contexts.json',[{contextId:'retained-context',nodeId:'independent',adapter:'codex',agentId:'retained-agent',executable:'C:/synthetic-never-run/independent.exe',workspace:profile}]);
const history={revision:1,agents:[{agentId:'retained-agent',adapter:'codex',executable:'C:/synthetic-never-run/independent.exe',workspace:profile,enabled:true}],tasks:[task],conversations:[{conversationId:task.conversationId,targetAgent:task.targetAgent,turns:1,updatedAt:time}],requests:[{requestId:task.requestId,taskId:task.taskId}],operations:[]};
write('windows/node-contexts/retained-context/codex-state.json',history);
const historyFile=path.join(profile,'windows/node-contexts/retained-context/codex-state.json'),historyBytes=fs.readFileSync(historyFile);
const report={date:new Date().toISOString(),version,scope:'Ordinary no-debug EXE, real owned windows and authenticated production Coordinator pipe, synthetic retained nodes/history; no native prompt or daily profile',modelCalls:0,checks:[],portable:{bytes:fs.statSync(exe).size,sha256:createHash('sha256').update(fs.readFileSync(exe)).digest('hex')}};
let wrapper,main,windowBinding,client,coordinatorPid;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const ps=command=>new Promise((resolve,reject)=>execFile(path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:15000},(e,out)=>e?reject(e):resolve(out.trim())));
function checkpoint(phase){report.phase=phase;fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
async function launch(){
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:profile,USERPROFILE:nativeHome};delete env.ELECTRON_RUN_AS_NODE;
 const started=Date.now();wrapper=spawn(exe,[],{env,stdio:'ignore'});const deadline=started+300000;
 while(Date.now()<deadline){
  if(wrapper.exitCode!==null)throw Error('Portable wrapper exited before the owned window appeared: '+wrapper.exitCode);
  if(fs.existsSync(path.join(profile,'coordinator-status.json'))){
   const text=await ps(`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${wrapper.pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;command=$_.CommandLine;title=(Get-Process -Id $_.ProcessId).MainWindowTitle}} | ConvertTo-Json -Compress`);
   const rows=text?JSON.parse(text):[];main=(Array.isArray(rows)?rows:[rows]).find(row=>row.title==='AgentBridge');
   if(main){
    assert.equal(main.parent,wrapper.pid);assert(!/remote-debugging|--inspect/.test(main.command));if(!windowBinding)windowBinding=await bindPortableWindow(main.pid);
    const next=new CoordinatorClient({directory:profile});
    try{await next.attach();assert.equal(next.info.version,version);client=next;coordinatorPid=next.info.pid;(report.startupDurationsMs||=[]).push(Date.now()-started);return;}
    catch(e){next.close();if(!['ENOENT','ECONNREFUSED'].includes(e.code))throw e;}
   }
  }
  await delay(500);
 }
 throw Error('Ordinary portable window or Coordinator did not start');
}
async function closeWindow(){
 if(!windowBinding)return;
 const result=await windowBinding.close();assert.equal(result.verified,true);assert.equal(result.accepted,true);windowBinding.dispose();windowBinding=null;
 const deadline=Date.now()+120000;while(wrapper.exitCode===null&&Date.now()<deadline)await delay(100);
 assert.equal(wrapper.exitCode,0,'Original wrapper must exit normally');main=null;
}
async function waitExit(pid){const deadline=Date.now()+30000;while(Date.now()<deadline){try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')return;throw e;}await delay(100);}throw Error('Original Coordinator has not exited');}
const rpc=(method,params={})=>client.request('call',{method,params});
async function call(method,params){const reply=await rpc(method,params);assert.equal(reply.ok,true,JSON.stringify(reply.error));return reply.result;}
async function retained(expected){
 const current=await call('collaboration');assert.deepEqual(current,expected);
 const pending=await call('graphPending');assert.equal(pending.length,1);const {blockedNodeIds,...row}=pending[0];assert.deepEqual(row,unknown);assert(blockedNodeIds.includes('member'));
 assert.deepEqual(fs.readFileSync(historyFile),historyBytes);
 const state=JSON.parse(fs.readFileSync(path.join(profile,'agent-network.json')));assert.deepEqual(state.requests,[]);assert.deepEqual(state.delegations,[]);
 assert.equal(state.relationOperations.filter(r=>r.operationId==='revoke-original').length,1);
}
(async()=>{
 if(resuming){
  const prior=JSON.parse(fs.readFileSync(path.resolve(process.argv[5])));assert.equal(prior.version,version);assert.equal(prior.status,'failed');
  const knownReadinessFailure=prior.error.code==='ENOENT'&&prior.checks.length===5;
  const knownWrapperWaitFailure=prior.error.code==='ERR_ASSERTION'&&prior.checks.length===4&&prior.error.message.startsWith('Original wrapper must exit normally');
  assert(knownReadinessFailure||knownWrapperWaitFailure,'Only the demonstrated readiness or original-wrapper wait failure may resume');assert.deepEqual(prior.portable,report.portable);
  assert.deepEqual(fs.readFileSync(historyFile),Buffer.from(JSON.stringify(history)));assert.equal(JSON.parse(fs.readFileSync(path.join(profile,'machines.json'))).localMachineId,machineId);
  report.priorPassedChecks=prior.checks.length;report.resumedSameProfile=true;report.priorFailurePreserved=prior.error.code;report.checks.push(...prior.checks);checkpoint('resume same original profile');
  let oldPid=JSON.parse(fs.readFileSync(path.join(profile,'coordinator-status.json'))).pid;assert(Number.isInteger(oldPid)&&oldPid>0);
  const old=new CoordinatorClient({directory:profile});
  try{await old.attach();oldPid=old.info.pid;assert.equal(old.info.version,version);await old.request('shutdown');}catch(e){if(!['ENOENT','ECONNREFUSED'].includes(e.code))throw e;}finally{old.close();}
  await waitExit(oldPid);await launch();assert.notEqual(coordinatorPid,oldPid);
  const expected={leaderId:'independent',memberIds:[],revision:6};await retained(expected);
  const original=await call('collaborationOperation',{operationId:'revoke-original'});assert.equal(original.state,'confirmed');assert.deepEqual(original.data,{leaderId:'main',memberIds:[],revision:5});
  if(process.env.AGENTBRIDGE_VERIFY_INSTALLED_HERMES==='1'){
   const found=await call('discover',{machineId}),hermes=found.items.find(item=>item.adapter==='hermes');assert(hermes);assert.equal(hermes.healthy,true);assert.equal(hermes.version,'0.22.5');
   assert.equal(fs.realpathSync(hermes.executable),fs.realpathSync(path.join(process.env.LOCALAPPDATA,'hermes/bin/hermes.exe')));
   const snapshot=await call('snapshot'),node=snapshot.nodes.find(item=>item.adapter==='hermes'&&item.machineId===machineId);assert(node);assert.equal(node.connectionCapabilities.cancellation,false);await retained(expected);
   report.installedHermes={version:hermes.version,healthy:hermes.healthy,originalInstallationMatched:true,cancellation:false,modelCalls:0};
   report.checks.push('Ordinary EXE discovers the installed Windows Hermes outside PATH and projects gateway cancellation unsupported without changing original receipts');
  }
  report.checks.push('Same original profile completes full Coordinator restart; exact original revocation receipt, unknown and native history survive without replay');checkpoint('resume final shutdown');
  const lastPid=coordinatorPid;await closeWindow();await client.request('shutdown');client.close();await waitExit(lastPid);client=null;
  report.checks.push('Follow-up original window/wrapper exits normally and the explicitly restarted test Coordinator exits');report.status='passed';return;
 }
 checkpoint('launch');await launch();const firstPid=coordinatorPid;
 const frozen=fs.readdirSync(path.join(profile,'coordinator/versions')).find(name=>name.startsWith(version+'-'));assert(frozen);
 for(const name of ['agent-network.cjs','relation-admission.cjs','graph-operations.cjs','coordinator-service.cjs','relation-state.cjs'])assert.equal(createHash('sha256').update(fs.readFileSync(path.join(profile,'coordinator/versions',frozen,'desktop/electron',name))).digest('hex'),createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../electron',name))).digest('hex'));
 report.checks.push('Ordinary no-debug EXE starts a real owned window and current Coordinator; frozen revocation modules match source');checkpoint('revoke');
 const revoke={operationId:'revoke-original',leaderId:'main',memberIds:[],expectedRevision:4};
 const receipt=await call('saveCollaboration',revoke);assert.equal(receipt.state,'confirmed');assert.deepEqual(receipt.data,{leaderId:'main',memberIds:[],revision:5});assert.deepEqual(await call('saveCollaboration',revoke),receipt);
 await retained(receipt.data);report.checks.push('Unavailable leader and blocked unavailable member permit pure revocation; original ID replays one receipt/revision and retains unknown/history');
 const denied=await rpc('saveCollaboration',{operationId:'forbidden-add-back',leaderId:'main',memberIds:['member'],expectedRevision:5});assert.equal(denied.ok,false);assert.equal(denied.error.code,'GRAPH_UNCONFIRMED');
 await retained(receipt.data);report.checks.push('Adding the blocked target back is refused without settling its original unknown or altering history');
 const next=await call('saveCollaboration',{operationId:'independent-main',leaderId:'independent',memberIds:[],expectedRevision:5});const expected={leaderId:'independent',memberIds:[],revision:6};assert.deepEqual(next.data,expected);await retained(expected);
 report.checks.push('An unrelated executable independent node becomes main with zero automatic member grants');
 await closeWindow();await retained(expected);assert.equal(client.info.pid,firstPid);client.close();await launch();assert.equal(coordinatorPid,firstPid);await retained(expected);
 report.checks.push('Normal window close and reopen retain the same frozen Coordinator, removed member, original unknown and history');
 await closeWindow();await client.request('shutdown');client.close();await waitExit(firstPid);await launch();assert.notEqual(coordinatorPid,firstPid);await retained(expected);
 report.checks.push('Complete Coordinator restart preserves revocation, exact receipt, original unknown and native history without replay');
 checkpoint('final shutdown');const lastPid=coordinatorPid;await closeWindow();await client.request('shutdown');client.close();await waitExit(lastPid);client=null;
 report.checks.push('All three original windows/wrappers exit normally; both original test Coordinators exit after explicit shutdown');report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code,message:e.message};process.exitCode=1;}).finally(async()=>{try{await closeWindow();}catch{}try{await client?.request('shutdown');}catch{}client?.close();checkpoint('complete');console.log(JSON.stringify(report));});
