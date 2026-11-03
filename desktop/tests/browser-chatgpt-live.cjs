'use strict';
// Explicit opt-in: real anonymous ChatGPT DOM/model, controlled native caller.
// Never overwrite this run's profile/state or resend after an unknown result.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),readline=require('node:readline');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../package.json'))('playwright');
const {MachineHost}=require('../electron/machine-host.cjs'),{AgentNetwork}=require('../electron/agent-network.cjs'),{createCoordinatorService}=require('../electron/coordinator-service.cjs');
const {createBundle}=require('../scripts/build-browser-extension.cjs');
if(process.env.AGENTBRIDGE_REAL_CHATGPT!=='1')throw Error('Real Provider calls require explicit AGENTBRIDGE_REAL_CHATGPT=1.');
const root='E:/AgentBridge-Browser-build/2026-10-31/chatgpt-adapter-live-01',evidence=path.resolve(__dirname,'../../artifacts/browser-agent/2026-10-31');
if(fs.existsSync(root))throw Error('LIVE_PROFILE_EXISTS: query the original run; do not replace state or choose an alias.');fs.mkdirSync(root);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,ms=120000){const deadline=Date.now()+ms;while(Date.now()<deadline){const value=await predicate();if(value)return value;await pause(250);}throw Error('LIVE_OBSERVATION_TIMEOUT');}
async function run(){
 const report={executedAtUtc:new Date().toISOString(),scope:'real Chromium MV3/authenticated loopback/Registry/Router/stdio MCP/anonymous ChatGPT DOM and model; native parent is a controlled fixture',nativeParentModel:false,productionProfileUsed:false,providerNetworkIntercepted:false,manifestDelta:'test-only ChatGPT host permission pregrant and setup page; production scripts unchanged',checks:[],rounds:[]};
 let context,machine,network,mcpChild,coordinator,node,task,keep=false;const pending=new Map();
 const save=()=>fs.writeFileSync(path.join(evidence,'chatgpt-adapter-live-01.json'),JSON.stringify(report,null,2)+'\n');
 try{
  const bundle=createBundle(),extension=path.join(root,'extension');fs.mkdirSync(extension);
  for(const record of bundle.manifest.files){const target=path.join(extension,record.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(bundle.sourceRoot,record.path),target);}
  report.extensionSourceDigest=bundle.manifest.sourceDigest;report.extensionZipSha256=bundle.manifest.archive.sha256;
  const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8'));manifest.host_permissions=['https://chatgpt.com/*'];manifest.optional_host_permissions=manifest.optional_host_permissions.filter(v=>v!=='https://chatgpt.com/*');fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
  const now=new Date().toISOString(),parent={active:false,agent:{agentId:'controlled-parent-agent',adapter:'claude',name:'Controlled native parent',executable:'/controlled/native-parent',workspace:root,enabled:true,healthy:true,online:true}};
  parent.task={taskId:'controlled-parent-task',executionId:'controlled-parent-execution',requestId:'controlled-parent-request',conversationId:'controlled-parent-conversation',targetAgent:parent.agent.agentId,message:'Controlled parent fixture',status:'running',createdAt:now,updatedAt:now};
  const legacy={async call(method,p={}){if(method==='snapshot')return {agents:{items:[{...parent.agent,busy:parent.active,...(parent.active?{currentTask:{taskId:parent.task.taskId,status:'running'}}:{})}]},tasks:parent.active?[parent.task]:[],conversations:parent.active?[{conversationId:parent.task.conversationId,targetAgent:parent.agent.agentId,title:'Controlled parent',createdAt:now,updatedAt:now}]:[]};if(method==='ipc'&&parent.active&&(p.op==='request'&&p.requestId===parent.task.requestId||p.op==='task'&&p.taskId===parent.task.taskId))return structuredClone(parent.task);throw Object.assign(Error('No native fixture object'),{code:'NOT_FOUND'});},close(){}};
  machine=new MachineHost({directory:path.join(root,'machine'),legacy,enableBrowser:true,home:root,environment:{PATH:'',Path:'',APPDATA:path.join(root,'empty')},platform:'linux'});
  network=new AgentNetwork({directory:path.join(root,'network'),platform:'linux',hostname:'Controlled caller / real Web Provider',createHost:()=>machine});coordinator=createCoordinatorService({directory:path.join(root,'coordinator'),network,platform:'linux'});
  context=await chromium.launchPersistentContext(path.join(root,'profile'),{executablePath:process.env.AGENTBRIDGE_TEST_CHROMIUM,headless:false,args:['--disable-extensions-except='+extension,'--load-extension='+extension]});report.browser=context.browser().version();report.node=process.version;
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),extensionId=new URL(worker.url()).host,setup=await context.newPage();await setup.goto('chrome-extension://'+extensionId+'/src/options/index.html');await setup.getByText('尚未配对',{exact:true}).waitFor();
  const pairing=await coordinator.call({method:'browser.pair',params:{machineId:network.catalog.localMachineId,operationId:'real-chatgpt-pair-01',extensionId}});assert.equal(pairing.ok,true);
  await setup.locator('#pair-code').fill(JSON.stringify(pairing.result));await setup.getByRole('button',{name:'连接 AgentBridge',exact:true}).click();await setup.getByText('已连接本机后台',{exact:true}).waitFor();assert.equal(await setup.locator('#pair-code').inputValue(),'');
  const pair=machine.browser.pairing.list()[0];assert.equal(pair.state,'committed');report.checks.push('actual extension Origin/HMAC/HKDF/IndexedDB and original Node pairing committed; no keys copied to evidence');
  await network.call('discover',{machineId:network.catalog.localMachineId});const discovered=await network.snapshot();node=discovered.nodes.find(n=>n.browserInstanceId===pair.browserInstanceId);assert.ok(node);await network.call('manageNode',{nodeId:node.nodeId,action:'attach',operationId:'real-chatgpt-attach-01'});
  const caller=discovered.nodes.find(n=>n.adapter==='claude');assert.ok(caller);await network.call('saveCollaboration',{leaderId:caller.nodeId,memberIds:[node.nodeId],expectedRevision:0});parent.active=true;network.network.requests.push({requestId:parent.task.requestId,nodeId:caller.nodeId,machineId:caller.machineId,dispatched:true,collaboration:true});network.saveNetwork();
  const config=await machine.broker.configure('controlled-parent',{nodeId:caller.nodeId,parentRequestId:parent.task.requestId});mcpChild=spawn(config.command,config.args,{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,...config.env}});
  readline.createInterface({input:mcpChild.stdout}).on('line',line=>{try{const data=JSON.parse(line),job=pending.get(data.id);if(job){pending.delete(data.id);clearTimeout(job.timer);data.error?job.reject(Error('MCP_PROTOCOL_ERROR')):job.resolve(data.result);}}catch{for(const job of pending.values())job.reject(Error('MCP_OUTPUT_INVALID'));}});
  mcpChild.on('error',()=>{for(const job of pending.values())job.reject(Error('MCP_CHILD_FAILED'));});let sequence=0;
  const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP_RESPONSE_TIMEOUT'));},30000);pending.set(id,{resolve,reject,timer});mcpChild.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
  const tool=async(name,args)=>{const response=await rpc('tools/call',{name,arguments:args}),value=JSON.parse(response.content[0].text);if(response.isError)throw Object.assign(Error(value.error.code),{code:value.error.code});return value;};
  await rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'real-web-controlled-caller',version:'1'}});assert.equal((await rpc('tools/list')).tools.length,10);assert.ok((await tool('list_agents',{})).items.some(n=>n.nodeId===node.nodeId));report.checks.push('existing Registry/discovery/admission/relationship and real authenticated stdio MCP; no duplicate router');save();
  const cases=[['请只回复 AB_BRIDGE_WEB_20261031，不要添加其他内容。','AB_BRIDGE_WEB_20261031'],['请在上一条回复末尾加 _TWO，只回复结果。','AB_BRIDGE_WEB_20261031_TWO'],['请将上一条回复末尾的 _TWO 换成 _THREE，只回复结果。','AB_BRIDGE_WEB_20261031_THREE']];let conversation;
  for(let index=0;index<cases.length;index++){
   const [message,expected]=cases[index],record={round:index+1,requestId:'chatgpt-live-01-turn'+(index+1),state:'dispatching'};report.rounds.push(record);save();
   task=await tool('delegate',{nodeId:node.nodeId,requestId:record.requestId,message,...(conversation?{conversationId:conversation}:{})});
   const result=await until(async()=>{const value=await network.call('ipc',{op:'task',taskId:task.taskId});return ['succeeded','failed','unknown','cancelled'].includes(value.status)?value:false;});
   record.state=result.status;record.outputEvents=result.events.filter(e=>e.event.kind==='output').length;record.lastUnknownCodes=result.events.filter(e=>e.event.kind==='unknown').map(e=>/^BROWSER_[A-Z_]+$/.test(e.event.reason||'')?e.event.reason:'OBSERVATION_LOST');save();
   assert.equal(result.status,'succeeded');assert.equal(result.result.message.trim(),expected);const final=await tool('task_result',{taskId:task.taskId});assert.equal(final.conversationId,task.conversationId);assert.equal(final.canContinue,true);if(conversation)assert.equal(task.conversationId,conversation);conversation=task.conversationId;record.expectedReplyMatched=true;report.checks.push('round '+(index+1)+': original MCP request -> real Provider DOM -> original Task result; context preserved');save();
  }
  report.ok=true;
 }catch(error){report.ok=false;report.error={code:/^[A-Z0-9_]+$/.test(error.code||error.message||'')?error.code||error.message:'LIVE_CHECK_FAILED'};if(task){try{const value=await network.call('ipc',{op:'task',taskId:task.taskId});report.lastTaskState=value.status;keep=!['succeeded','failed','cancelled'].includes(value.status);}catch{keep=true;}}}
 finally{
  report.authorityAndProfileRetained=true;report.liveRecoveryRequired=keep;save();console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,rounds:report.rounds.map(r=>({round:r.round,state:r.state})),liveRecoveryRequired:keep,...(report.error?{error:report.error}:{})}));
  if(keep){setInterval(()=>{},60000);return;} // Keep the original live authority/browser; never auto-retry.
  if(mcpChild){mcpChild.stdin.end();await Promise.race([new Promise(r=>mcpChild.once('exit',r)),pause(5000)]);}await context?.close();network?.close();await machine?.close();if(!report.ok)process.exitCode=1;
 }
}
run().catch(error=>{console.error(/^[A-Z0-9_]+$/.test(error.message)?error.message:'LIVE_SETUP_FAILED');process.exitCode=1;});
