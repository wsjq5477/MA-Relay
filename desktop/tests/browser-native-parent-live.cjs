'use strict';
// Explicit acceptance only: production Coordinator/native adapters/MCP, actual
// ChatGPT DOM/model. Native accounts/configuration are inherited, never copied.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../package.json'))('playwright');
const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
const {createBundle}=require('../scripts/build-browser-extension.cjs');
if(process.env.AGENTBRIDGE_REAL_CHATGPT!=='1'||process.env.AGENTBRIDGE_REAL_NATIVE!=='1')throw Error('Real native/Provider acceptance requires both explicit opt-ins.');
const root='E:/AgentBridge-Browser-build/2026-10-31/chatgpt-native-parent-01';
const evidence=path.resolve(__dirname,'../../artifacts/browser-agent/2026-10-31');
const parents=(process.env.AGENTBRIDGE_NATIVE_PARENTS||'codex,claude,opencode').split(',');
if(!parents.length||new Set(parents).size!==parents.length||parents.some(p=>!['codex','claude','opencode'].includes(p)))throw Error('Invalid native acceptance selection.');
if(fs.existsSync(root))throw Error('NATIVE_LIVE_ROOT_EXISTS: query original requests; do not replace state or use an alias.');
// The preceding actual-page case must be quiescent before another acceptance.
const priorRoot='E:/AgentBridge-Browser-build/2026-10-31/chatgpt-adapter-live-01/machine';
if(fs.existsSync(priorRoot))for(const row of JSON.parse(fs.readFileSync(path.join(priorRoot,'node-contexts.json'))))if(row.browserInstanceId){
 const state=JSON.parse(fs.readFileSync(path.join(priorRoot,'node-contexts',row.contextId,'browser-state.json')));
 if(state.tasks.some(t=>!['succeeded','failed','cancelled'].includes(t.status))||state.operations.some(o=>o.state==='unknown')||state.conversations.some(c=>!c.closed))throw Error('PRIOR_REAL_BROWSER_AUTHORITY_NOT_SETTLED');
}
fs.mkdirSync(root);fs.mkdirSync(evidence,{recursive:true});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run(){
 const report={executedAtUtc:new Date().toISOString(),scope:'production Windows Coordinator/MachineHost/native adapters, real native parent model and stdio MCP -> actual Chromium MV3/authenticated loopback/public ChatGPT DOM/model; no fixture parent or intercepted Provider HTML',nativeConfigurationInherited:true,modelOverrides:false,providerNetworkIntercepted:false,productionBrowserProfileUsed:false,permissionConsentValidated:false,manifestDelta:'test-only ChatGPT host permission pregrant',parents:[],checks:[],ok:false};
 const service=createCoordinatorService({directory:path.join(root,'coordinator'),platform:process.platform});let context,keep=false,activeTask;
 const save=()=>fs.writeFileSync(path.join(evidence,'chatgpt-native-parent-live.json'),JSON.stringify(report,null,2)+'\n');
 const call=async(method,params={})=>{const reply=await service.call({method,params});if(!reply.ok)throw Object.assign(Error(reply.error.code),{code:reply.error.code});return reply.result;};
 const until=async(predicate,ms=120000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await predicate();if(value)return value;await pause(500);}throw Error('NATIVE_LIVE_OBSERVATION_TIMEOUT');};
 const diagnostic=globalThis.agentBridgeNativeCheck={service,report,save,call,root,parents,context:null,activeTask:null,finished:false};
 try{
  save();const bundle=createBundle(),extension=path.join(root,'extension');fs.mkdirSync(extension);
  for(const file of bundle.manifest.files){const target=path.join(extension,file.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(bundle.sourceRoot,file.path),target);}report.extensionSourceDigest=bundle.manifest.sourceDigest;
  const manifestPath=path.join(extension,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath));manifest.host_permissions=['https://chatgpt.com/*'];manifest.optional_host_permissions=[];fs.writeFileSync(manifestPath,JSON.stringify(manifest));
  context=await chromium.launchPersistentContext(path.join(root,'profile'),{executablePath:process.env.AGENTBRIDGE_TEST_CHROMIUM,headless:false,args:['--disable-extensions-except='+extension,'--load-extension='+extension]});diagnostic.context=context;report.browser=context.browser().version();report.node=process.version;
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),extensionId=new URL(worker.url()).host,setup=await context.newPage();await setup.goto('chrome-extension://'+extensionId+'/src/options/index.html');await setup.getByText('尚未配对',{exact:true}).waitFor();
  const initial=await call('snapshot'),machine=initial.machines.find(m=>m.kind==='windows');assert.ok(machine,'Actual Windows machine must exist');diagnostic.machine=machine;
  const pair=await call('browser.pair',{machineId:machine.machineId,operationId:'native-live-pair-01',extensionId});await setup.locator('#pair-code').fill(JSON.stringify(pair));await setup.getByRole('button',{name:'连接 AgentBridge',exact:true}).click();await setup.getByText('已连接本机后台',{exact:true}).waitFor();assert.equal(await setup.locator('#pair-code').inputValue(),'');
  await call('discover',{machineId:machine.machineId});let snapshot=await call('snapshot'),browser=snapshot.nodes.find(n=>n.adapter==='chatgpt-web'&&n.browserInstanceId===pair.browserInstanceId);assert.ok(browser);diagnostic.browser=browser;
  await call('manageNode',{nodeId:browser.nodeId,action:'attach',operationId:'native-live-browser-attach-01'});report.checks.push('production Coordinator owns actual Windows MachineHost, pairing/channel, Registry and Browser node');save();
  for(const adapter of parents){
   const record={adapter,state:'preparing',nativeModel:false,rounds:[]};report.parents.push(record);save();
   snapshot=await call('snapshot');const parent=snapshot.nodes.find(n=>n.adapter===adapter&&n.machineId===machine.machineId);if(!parent?.healthy){record.state='unavailable';record.code='NATIVE_INSTALLATION_UNAVAILABLE';save();continue;}
   record.version=parent.version;await call('manageNode',{nodeId:parent.nodeId,action:'attach',operationId:'native-live-'+adapter+'-attach-01'});
   const relation=(await call('snapshot')).collaboration;await call('saveCollaboration',{leaderId:parent.nodeId,memberIds:[browser.nodeId],expectedRevision:relation.revision});
   const workspace=path.join(root,'workspaces',adapter);fs.mkdirSync(workspace,{recursive:true});
   const marker='AB_NATIVE_'+adapter.toUpperCase()+'_20261031';
   const message='这是实际AgentBridge调用验收。只使用当前agentbridge MCP服务器，禁止终端、浏览器工具、私有API或直接网络请求。先list_agents选择adapter为chatgpt-web的已授权节点。第一轮delegate使用稳定requestId native-'+adapter+'-web-turn1，message为“请只回复 '+marker+'，不要添加其他内容。”；task_result查询原task直到终态，unknown时停止并报告，禁止改ID重发。第一轮成功后，第二轮delegate使用稳定requestId native-'+adapter+'-web-turn2、第一轮原conversationId，message为“请在上一条回复末尾加 _TWO，只回复结果。”；查询原task_result直到终态。必须取得第二轮实际网页结果，最后只输出该结果。不要修改文件或原生配置。';
   activeTask=await call('nodeRequest',{nodeId:parent.nodeId,machineId:machine.machineId,requestId:'native-live-'+adapter+'-parent-01',message,workspace,collaboration:true});diagnostic.activeTask=activeTask;record.state='running';save();
   const result=await until(async()=>{const task=await call('ipc',{op:'task',machineId:machine.machineId,taskId:activeTask.taskId});return ['succeeded','failed','unknown','cancelled'].includes(task.status)?task:false;},240000);
   record.state=result.status;record.nativeModel=!!result.native?.sessionId;record.nativeToolEvents=result.events.filter(e=>e.event.kind==='progress'&&/agentbridge|agentbridge_/.test(e.event.text||'')).map(e=>String(e.event.text).replace(/[^a-zA-Z0-9_/ ·-]/g,'').slice(0,120));record.expectedFinalResult=result.result?.message?.trim()===marker+'_TWO';record.code=result.error?.code;save();
   const privateNetwork=JSON.parse(fs.readFileSync(path.join(root,'coordinator','agent-network.json'))),delegations=privateNetwork.delegations.filter(d=>d.parentRequestId===activeTask.requestId||d.parentTaskId===activeTask.taskId||d.leaderId===parent.nodeId);
   for(const item of delegations){if(!item.taskId)continue;const child=await call('ipc',{op:'task',machineId:machine.machineId,taskId:item.taskId});record.rounds.push({state:child.status,outputEvents:child.events.filter(e=>e.event.kind==='output').length,expected:child.result?.message?.trim()===marker+(record.rounds.length?'_TWO':''),conversationSameAsFirst:!record.rounds.length||item.conversationId===delegations[0].conversationId});}
   save();if(result.status==='unknown'||record.rounds.some(r=>!['succeeded','failed','cancelled'].includes(r.state))){keep=true;throw Error('ORIGINAL_NATIVE_OR_WEB_REQUEST_UNRESOLVED');}
   if(result.status!=='succeeded'||!record.nativeModel||!record.expectedFinalResult||record.rounds.length!==2||record.rounds.some(r=>r.state!=='succeeded'||!r.expected||!r.conversationSameAsFirst))throw Error('REAL_NATIVE_PARENT_CHECK_FAILED');
   const latest=delegations.at(-1),conversation=await call('ipc',{op:'conversation',machineId:machine.machineId,conversationId:latest.conversationId});
   const closeId='native-live-'+adapter+'-web-close-01';await call('ipc',{op:'session.close',machineId:machine.machineId,taskId:latest.taskId,expectedRevision:conversation.bindingRevision,operationId:closeId});
   await until(async()=>{const receipt=await call('ipc',{op:'operation',machineId:machine.machineId,taskId:latest.taskId,operationId:closeId});return receipt.state==='confirmed'&&receipt.data.closed===true;},30000);record.originalWebSessionClosed=true;save();
  }
  report.ok=report.parents.length===parents.length&&report.parents.every(p=>p.state==='succeeded'&&p.expectedFinalResult&&p.originalWebSessionClosed);if(!report.ok)throw Error('NATIVE_ACCEPTANCE_INCOMPLETE');
 }catch(error){report.error={code:/^[A-Z0-9_]+$/.test(error.code||error.message||'')?error.code||error.message:'NATIVE_LIVE_CHECK_FAILED'};
  try{const snapshot=await call('snapshot');keep=keep||snapshot.tasks.some(t=>!['succeeded','failed','cancelled'].includes(t.status))||service.pending().some(p=>p.state==='unknown');}catch{keep=true;}
 }finally{
  report.finishedAtUtc=new Date().toISOString();report.liveRecoveryRequired=keep;diagnostic.finished=true;diagnostic.keep=keep;save();console.log(JSON.stringify({ok:report.ok,parents:report.parents.map(p=>({adapter:p.adapter,state:p.state,rounds:p.rounds.length})),liveRecoveryRequired:keep,error:report.error}));
  if(keep){diagnostic.hold=setInterval(()=>{},60000);return;}
  await context?.close();service.close();if(!report.ok)process.exitCode=1;
 }
}
run().catch(()=>{console.error('NATIVE_LIVE_SETUP_FAILED');process.exitCode=1;});
