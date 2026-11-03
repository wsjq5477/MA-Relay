// Real isolated Chromium extension integration, with provider HTML intercepted.
// Does not visit the provider service or use a personal browser profile.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createRequire}=require('node:module');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const {chromium}=createRequire(path.join(__dirname,'../package.json'))('playwright');
const {MachineHost}=require('../electron/machine-host.cjs');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
const {startPreview}=require('../scripts/preview-ui.cjs');
const http=require('node:http');
const {spawn}=require('node:child_process');
const readline=require('node:readline');
const contentEditable=process.env.AGENTBRIDGE_TEST_EDITOR==='contenteditable';
const navigationTest=process.env.AGENTBRIDGE_TEST_NAVIGATION==='reload';
const sessionCloseTest=process.env.AGENTBRIDGE_TEST_SESSION_CLOSE==='1';
const healthTest=process.env.AGENTBRIDGE_TEST_HEALTH==='1';
const manualTurnTest=process.env.AGENTBRIDGE_TEST_MANUAL_TURN==='1';
const historyConflictTest=process.env.AGENTBRIDGE_TEST_HISTORY_CONFLICT||'';
if(historyConflictTest&&!['user-edit','assistant-regenerate'].includes(historyConflictTest))throw Error('Invalid history conflict fixture.');
const precontentCancelTest=process.env.AGENTBRIDGE_TEST_PRECONTENT_CANCEL==='1';
const cancelledSessionCloseTest=process.env.AGENTBRIDGE_TEST_CANCELLED_SESSION_CLOSE==='1';
if(cancelledSessionCloseTest&&(!precontentCancelTest||!healthTest))throw Error('Cancelled close verification requires cancellation and health fixtures.');
const cancelPreparedTest=process.env.AGENTBRIDGE_TEST_CANCEL_PREPARED==='1';
if(cancelPreparedTest&&!cancelledSessionCloseTest)throw Error('Prepared cancellation verification requires sealed-session close coverage.');
const evidenceDay=process.env.AGENTBRIDGE_BROWSER_EVIDENCE_DATE||'2026-10-30';
if(!/^\d{4}-\d{2}-\d{2}$/.test(evidenceDay))throw Error('Invalid evidence date.');
const evidenceRoot=path.resolve(__dirname,'../../artifacts/browser-agent',evidenceDay);
const reportName=process.env.AGENTBRIDGE_BROWSER_REPORT||'mv3-integration.json';
if(!/^[a-z0-9-]+\.json$/.test(reportName))throw Error('Invalid browser evidence filename.');
const extensionInput=path.resolve(process.env.AGENTBRIDGE_TEST_EXTENSION_SOURCE||path.resolve(__dirname,'../../browser-extension'));
const bundleInput=process.env.AGENTBRIDGE_TEST_EXTENSION_SOURCE?require('../scripts/build-browser-extension.cjs').createBundle({source:extensionInput}).manifest:undefined;
if(bundleInput&&process.env.AGENTBRIDGE_TEST_INPUT_DIAGNOSTICS==='1')throw Error('Delivered bundle verification cannot instrument production scripts.');
let html=`<!doctype html><meta charset="utf-8"><title>Controlled ChatGPT DOM fixture</title><style>body{font:16px sans-serif}textarea{width:600px;height:90px}button{min-height:30px}.markdown,[data-message-author-role="user"]{white-space:pre-wrap}</style><main id="messages"></main><textarea id="prompt-textarea"></textarea><button data-testid="send-button" disabled>Send</button><button data-testid="stop-button" style="display:none">Stop</button><script>
window.clicks=0;const editor=document.querySelector('textarea'),send=document.querySelector('[data-testid=send-button]'),stop=document.querySelector('[data-testid=stop-button]');editor.addEventListener('input',()=>send.disabled=!editor.value);send.onclick=()=>{const input=editor.value;if(!input)return;const n=++window.clicks;history.replaceState(null,'','/c/fixture');const user=document.createElement('div');user.dataset.messageAuthorRole='user';user.dataset.messageId='user-'+n;user.textContent=input;document.querySelector('main').append(user);const turn=document.createElement('section');turn.dataset.testid='conversation-turn-'+n;const assistant=document.createElement('div');assistant.dataset.messageAuthorRole='assistant';assistant.dataset.messageId='assistant-'+n;const text=document.createElement('div');text.className='markdown';assistant.append(text);turn.append(assistant);document.querySelector('main').append(turn);editor.value='';send.disabled=true;stop.style.display='inline-block';setTimeout(()=>text.textContent='Partial '+n,150);const finish=()=>{text.textContent='Answer '+n;stop.style.display='none';const copy=document.createElement('button');copy.dataset.testid='copy-turn-action-button';copy.textContent='Copy';turn.append(copy);};if(input.includes('[hold]'))window.finishHeld=finish;else setTimeout(finish,450);};
</script>`.replace('setTimeout(finish,450)','setTimeout(finish,2000)');
if(contentEditable)html=html.replace('<textarea id="prompt-textarea"></textarea>','<div id="prompt-textarea" contenteditable="true" role="textbox" aria-multiline="true" style="white-space:pre-wrap;min-height:90px"></div>').replace('send.disabled=!editor.value','send.disabled=!editor.innerText').replace('const input=editor.value','const input=editor.innerText').replace("editor.value=''","editor.textContent=''");
if(contentEditable)html=html.replace("document.querySelector('textarea')","document.querySelector('#prompt-textarea')");
const wait=async predicate=>{const deadline=Date.now()+20000;while(Date.now()<deadline){if(await predicate())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out waiting for extension state.');};
async function run() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-extension-live-'));
  const extension=path.join(root,'extension');fs.mkdirSync(extension);
  const copy=(source,target)=>{fs.mkdirSync(target,{recursive:true});for(const entry of fs.readdirSync(source,{withFileTypes:true})){const from=path.join(source,entry.name),to=path.join(target,entry.name);if(entry.isDirectory())copy(from,to);else if(entry.isFile())fs.writeFileSync(to,fs.readFileSync(from));else throw Error('Unexpected extension source link.');}};
  copy(path.join(extensionInput,'src'),path.join(extension,'src'));
  if(process.env.AGENTBRIDGE_TEST_INPUT_DIAGNOSTICS==='1'){
    const runtimeFile=path.join(extension,'src/content/runtime.js'),driverFile=path.join(extension,'src/providers/chatgpt/driver.js');
    const runtime=fs.readFileSync(runtimeFile,'utf8'),driver=fs.readFileSync(driverFile,'utf8');
    assert.ok(runtime.includes('if(!event.isTrusted)return;'));assert.ok(driver.includes('const send=document.querySelector(selectors.send);'));
    fs.writeFileSync(runtimeFile,runtime.replace('if(!event.isTrusted)return;','if(!event.isTrusted)return;(globalThis.agentBridgeTestInputs??=[]).push({type:event.type,inputType:event.inputType,dataNull:event.data===null,composing:event.isComposing,owned:!!composerWrite,seen:composerWrite?.seen,targetMatch:event.target===composerWrite?.editor,exact:composerWrite?normalize(composerWrite.editor.innerText)===composerWrite.text:false});'));
    fs.writeFileSync(driverFile,driver.replace('const send=document.querySelector(selectors.send);','const send=document.querySelector(selectors.send);globalThis.agentBridgeTestGuard={sameVersion:this.ownership.version===version,valueExact:value(editor)===normal(p.message.text),enabled:!send?.disabled,visible:visible(send),sameUrl:location.origin+location.pathname===initial.url,sameEditor:document.querySelector(selectors.editor)===editor,connected:editor.isConnected,stopped:visible(document.querySelector(selectors.stop))};'));
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(extensionInput,'manifest.json')));
  // Test-only pregrant: validates runtime APIs, not optional-permission UX.
  manifest.host_permissions=['https://chatgpt.com/*'];manifest.optional_host_permissions=manifest.optional_host_permissions.filter(h=>h!=='https://chatgpt.com/*');
  fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));fs.writeFileSync(path.join(extension,'setup.html'),'<!doctype html><title>Isolated extension test setup</title>');
  let channel,context,host,network,mcpChild,machineHost,preview;const errors=[];
  let blockedRequests=0;
  const networkGuard=http.createServer((_req,res)=>{blockedRequests++;res.writeHead(403).end();});
  networkGuard.on('connect',(_req,socket)=>{blockedRequests++;socket.end('HTTP/1.1 502 Blocked by test network guard\r\n\r\n');});
  await new Promise(resolve=>networkGuard.listen(0,'127.0.0.1',resolve));
  const report={executedAtUtc:new Date().toISOString(),scope:'real Chromium MV3/WS/IndexedDB/content with controlled provider HTML; no real provider or native parent model',editor:contentEditable?'contenteditable':'textarea',manifestDelta:'test-only ChatGPT host permission pregrant; production manifest is optional',checks:[]};
  if(bundleInput)report.extensionBundle={archive:bundleInput.archive.file,sha256:bundleInput.archive.sha256,sourceDigest:bundleInput.sourceDigest,files:bundleInput.files.length,codeDelta:'none; test-only permission pregrant and setup.html'};
  try {
    const parent={active:false,agent:{agentId:'controlled-parent-agent',adapter:'claude',name:'Controlled native parent',executable:'/controlled/native-parent',workspace:root,enabled:true,healthy:true,online:true}};
    const timestamp=new Date().toISOString();
    parent.task={taskId:'controlled-parent-task',executionId:'controlled-parent-execution',requestId:'controlled-parent-request',conversationId:'controlled-parent-conversation',targetAgent:parent.agent.agentId,message:'Controlled parent fixture',status:'running',createdAt:timestamp,updatedAt:timestamp};
    const legacy={async call(method,p={}){
      if(method==='snapshot')return {agents:{items:[{...parent.agent,busy:parent.active,...(parent.active?{currentTask:{taskId:parent.task.taskId,status:'running'}}:{})}]},tasks:parent.active?[parent.task]:[],conversations:parent.active?[{conversationId:parent.task.conversationId,targetAgent:parent.agent.agentId,title:'Controlled parent',createdAt:timestamp,updatedAt:timestamp}]:[]};
      if(method==='ipc'&&parent.active&&(p.op==='request'&&p.requestId===parent.task.requestId||p.op==='task'&&p.taskId===parent.task.taskId))return structuredClone(parent.task);
      throw Object.assign(Error('No native object'),{code:'NOT_FOUND'});
    },close(){}};
    machineHost=new MachineHost({directory:path.join(root,'machine'),legacy,enableBrowser:true,home:root,environment:{PATH:'',Path:'',APPDATA:path.join(root,'empty')},platform:'linux'});
    channel=machineHost.browser;
    network=new AgentNetwork({directory:path.join(root,'network'),platform:'linux',hostname:'隔离浏览器测试机',createHost:()=>machineHost});
    const coordinator=createCoordinatorService({directory:path.join(root,'coordinator'),network,platform:'linux'});
    preview=await startPreview({port:0,fixture:{nodes:(await network.snapshot()).nodes,call:(method,params)=>coordinator.call({method,params}),close(){}}});
    context=await chromium.launchPersistentContext(path.join(root,'profile'),{channel:'chromium',...(process.env.AGENTBRIDGE_TEST_CHROMIUM?{executablePath:process.env.AGENTBRIDGE_TEST_CHROMIUM}:{}),headless:true,proxy:{server:'http://127.0.0.1:'+networkGuard.address().port,bypass:'127.0.0.1,localhost'},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
    context.on('weberror',error=>errors.push(String(error.error())));
    report.routedRequests=0;
    await context.route('https://chatgpt.com/**',route=>{report.routedRequests++;return route.fulfill({status:200,contentType:'text/html',body:html});});
    // Extension-created tabs can start their first navigation before Playwright
    // attaches Fetch interception. Navigate the empty test tab only, before any
    // prompt exists, so all fixture content is supplied through the test route.
    context.on('page',page=>{
      (async()=>{
        await wait(()=>page.url()!=='about:blank');if(!page.url().startsWith('https://chatgpt.com/')&&!page.url().startsWith('chrome-error://'))return;
        await page.route('**/*',route=>{if(route.request().url().startsWith('https://chatgpt.com/')){report.routedRequests++;return route.fulfill({status:200,contentType:'text/html',body:html});}return route.abort();});
        // An already intercepted fixture must never be navigated again: the
        // adapter can have probed and started its first turn by this point.
        // Only recover the initial network-error document, which cannot have
        // been accepted by the content probe. Never navigate a healthy page.
        await page.waitForLoadState('domcontentloaded').catch(()=>{});
        if(page.url().startsWith('chrome-error://'))await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
      })().catch(()=>{});
    });
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    const id=new URL(worker.url()).host;
    const setup=await context.newPage();await setup.goto('chrome-extension://'+id+'/src/options/index.html');
    await setup.getByText('尚未配对',{exact:true}).waitFor();assert.equal(await setup.locator('#extension-id').textContent(),id);
    await setup.locator('#pair-code').fill('invalid');await setup.getByRole('button',{name:'连接 AgentBridge',exact:true}).click();await setup.getByText('配对包格式不完整，请从 AgentBridge 复制完整内容。',{exact:true}).waitFor();
    const desktop=await context.newPage();await desktop.goto(preview.url);await desktop.getByRole('button',{name:'设置',exact:true}).click();
    const section=desktop.locator('section[aria-labelledby="settings-browser"]');await section.getByLabel('浏览器扩展 ID',{exact:true}).fill(id);
    await section.getByRole('button',{name:'生成配对包',exact:true}).click();await section.getByRole('button',{name:'复制配对包',exact:true}).waitFor();
    await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:preview.url});await section.getByRole('button',{name:'复制配对包',exact:true}).click();
    const code=await desktop.evaluate(()=>navigator.clipboard.readText());
    const stored=await desktop.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('agentbridge.browser-pair.v1:')).map(([,v])=>JSON.parse(v)));
    assert.equal(stored.length,1);assert.equal(stored[0].secret,undefined);assert.equal(stored[0].key,undefined);
    const originalBundle=JSON.parse(code),badBundle={...originalBundle,secret:(originalBundle.secret[0]==='0'?'1':'0')+originalBundle.secret.slice(1)};
    await setup.bringToFront();await setup.locator('#pair-code').fill(JSON.stringify(badBundle));await setup.getByRole('button',{name:'连接 AgentBridge',exact:true}).click();await setup.getByText('原配对尚未确认',{exact:true}).waitFor();
    assert.equal(await setup.locator('#pair-form').isVisible(),true);await setup.locator('#pair-code').fill('');
    const wrongIdentity=await setup.evaluate(config=>chrome.runtime.sendMessage({protocol:'agentbridge-options-v1',method:'configure',config:{...config,browserInstanceId:'different-browser-profile'}}),originalBundle);assert.equal(wrongIdentity.error?.code,'BROWSER_CONFIGURATION_FAILED');
    const originalStatus=await setup.evaluate(()=>chrome.runtime.sendMessage({protocol:'agentbridge-options-v1',method:'status'}));assert.equal(originalStatus.result.browserInstanceId,originalBundle.browserInstanceId);assert.equal(originalStatus.result.credentialSaved,false);assert.equal(channel.pairing.list().length,1);
    const recoveryShots=path.join(evidenceRoot,'ui');fs.mkdirSync(recoveryShots,{recursive:true});
    for(const theme of ['light','dark'])for(const width of [980,390]){await setup.setViewportSize({width,height:960});await setup.emulateMedia({colorScheme:theme});await setup.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await setup.screenshot({path:path.join(recoveryShots,`extension-unverified-${theme}-${width}.png`),fullPage:true});}
    await setup.bringToFront();await setup.locator('#pair-code').fill(code);await setup.getByRole('button',{name:'连接 AgentBridge',exact:true}).click();await setup.getByText('已连接本机后台',{exact:true}).waitFor();assert.equal(await setup.locator('#pair-code').inputValue(),'');
    const config=channel.pairing.list()[0];assert.equal(channel.pairing.list().length,1);assert.equal(config.state,'committed');
    await desktop.reload();await desktop.getByRole('button',{name:'设置',exact:true}).click();await desktop.getByRole('button',{name:'查询原配对',exact:true}).click();await desktop.getByText('扩展已完成原配对，请扫描并接入 ChatGPT Web 节点。',{exact:true}).waitFor();assert.equal(channel.pairing.list().length,1);
    report.checks.push('actual production desktop form / secret-free local intent / clipboard pairing / real extension options / original pairing query after reload');
    report.checks.push('first authentication failure permits correction only for the original binding; changed profile is rejected; no new pairing or journal reset');
    report.checks.push('normal MachineHost-owned durable endpoint / Coordinator pairing RPC / real extension Origin / HMAC / trusted storage');
    await network.call('discover',{machineId:network.catalog.localMachineId});
    const discovered=await network.snapshot(),node=discovered.nodes.find(n=>n.browserInstanceId===config.browserInstanceId);assert.ok(node);assert.equal(node.executable,undefined);
    await network.call('manageNode',{nodeId:node.nodeId,action:'attach',operationId:'attach-browser'});
    const caller=discovered.nodes.find(n=>n.adapter==='claude');assert.ok(caller);
    await network.call('saveCollaboration',{leaderId:caller.nodeId,memberIds:[node.nodeId],expectedRevision:0});
    parent.active=true;network.network.requests.push({requestId:parent.task.requestId,nodeId:caller.nodeId,machineId:caller.machineId,dispatched:true,collaboration:true});network.saveNetwork();
    const mcp=await machineHost.broker.configure('controlled-parent',{nodeId:caller.nodeId,parentRequestId:parent.task.requestId});
    mcpChild=spawn(mcp.command,mcp.args,{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,...mcp.env}});
    let rpcId=0;const pending=new Map();
    readline.createInterface({input:mcpChild.stdout}).on('line',line=>{const message=JSON.parse(line),job=pending.get(message.id);if(job){pending.delete(message.id);clearTimeout(job.timer);message.error?job.reject(Error('MCP protocol failure: '+message.error.message)):job.resolve(message.result);}});
    mcpChild.on('error',()=>{for(const job of pending.values()){clearTimeout(job.timer);job.reject(Error('MCP child failed'));}pending.clear();});
    const rpc=(method,params={})=>new Promise((resolve,reject)=>{report.lastMcpMethod=method;const id=++rpcId,timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP response timeout'));},20000);pending.set(id,{resolve,reject,timer});mcpChild.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
    const tool=async(name,args)=>{const result=await rpc('tools/call',{name,arguments:args}),data=JSON.parse(result.content[0].text);if(result.isError)throw Object.assign(Error(data.error.code),{code:data.error.code});return data;};
    await rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'controlled-parent-test',version:'1'}});
    assert.equal((await rpc('tools/list')).tools.length,10);
    assert.ok((await tool('list_agents',{})).items.some(n=>n.nodeId===node.nodeId));
    const request=p=>tool('delegate',{nodeId:node.nodeId,requestId:p.requestId,message:p.message,...(p.conversationId?{conversationId:p.conversationId}:{})});
    const readTask=taskId=>network.call('ipc',{op:'task',taskId});let task;
    report.checks.push('existing Registry / MachineHost / Router / AgentNetwork discovery and explicit node admission');
    report.checks.push('real stdio MCP / existing authenticated CollaborationBroker / original parent scope; native parent model is controlled');
    for(let round=1;round<=3;round++) {
      task=await request(round===1?{op:'submit',requestId:'round-1',message:'First requirement'}:{op:'continue',conversationId:task.conversationId,requestId:'round-'+round,message:'Continue '+round});
      host=machineHost.backend(machineHost.rows.find(r=>r.browserInstanceId===config.browserInstanceId));
      await wait(async()=>['succeeded','unknown','failed'].includes((await readTask(task.taskId)).status));
      const result=await readTask(task.taskId);assert.equal(result.status,'succeeded');assert.equal(result.result.message,'Answer '+round);
      const delegated=await tool('task_result',{taskId:task.taskId});assert.equal(delegated.conversationId,task.conversationId);assert.equal(delegated.canContinue,true);
      if(healthTest){const before=JSON.stringify(host.store.read()),health=await coordinator.call({method:'ipc',params:{op:'session.health',taskId:task.taskId,probeId:'probe-round-'+round}});assert.equal(health.ok,true);assert.equal(health.result.ready,true);assert.equal(health.result.sitePermission,true);assert.equal(health.result.domChecked,true);assert.equal(health.result.loginChecked,false);assert.equal(JSON.stringify(host.store.read()),before);}
      const output=result.events.filter(e=>e.event.kind==='output');assert.ok(output.some(e=>e.event.text==='Partial '+round));assert.ok(output.some(e=>e.event.text==='Answer '+round));report.checks.push('round '+round+': actual DOM click, partial streaming before final answer and bound result');
    }
    let controlled=context.pages().find(p=>p.url().startsWith('https://chatgpt.com/'));
    assert.equal(await controlled.evaluate(()=>window.clicks),3);report.checks.push('three rounds retain one provider session / exactly three clicks');
    if(healthTest)report.checks.push('three original session health probes verify DOM and permission without changing Tasks, clicking or claiming login verification');
    const hold=await request({op:'continue',conversationId:task.conversationId,requestId:'held-round',message:'[hold]'});
    await wait(async()=>((await readTask(hold.taskId)).status==='running'));
    if(healthTest){const health=await network.call('ipc',{op:'session.health',taskId:hold.taskId,probeId:'probe-running'});assert.equal(health.ready,false);assert.equal(health.blocked,true);assert.equal(health.pageCode,'BROWSER_MANUAL_BUSY');assert.equal(await controlled.evaluate(()=>window.clicks),4);}
    const cdp=await context.browser().newBrowserCDPSession();
    const targets=await cdp.send('Target.getTargets');const target=targets.targetInfos.find(t=>t.type==='service_worker'&&t.url.startsWith('chrome-extension://'+id+'/'));
    assert.ok(target);await cdp.send('Target.closeTarget',{targetId:target.targetId});
    await wait(async()=>((await readTask(hold.taskId)).status==='unknown'));
    await setup.evaluate(()=>chrome.runtime.sendMessage({protocol:'agentbridge-options-v1',method:'status'}));
    await wait(()=>channel.forInstance(config.browserInstanceId).online);
    assert.equal(await controlled.evaluate(()=>window.clicks),4);
    const reconciling=await network.call('ipc',{op:'reconcile',taskId:hold.taskId,executionId:hold.executionId,operationId:'original-held-reconcile'});assert.equal(reconciling.state,'unknown');
    assert.equal((await readTask(hold.taskId)).status,'unknown');
    if(healthTest){const health=await network.call('ipc',{op:'session.health',taskId:hold.taskId,probeId:'probe-unknown'});assert.equal(health.ready,false);assert.equal(health.blocked,true);assert.equal((await readTask(hold.taskId)).status,'unknown');report.checks.push('health during generation and after worker loss stays unavailable and never reconciles the unknown Task');}
    await assert.rejects(request({op:'continue',conversationId:task.conversationId,requestId:'bypass-unknown',message:'Again'}),{code:'CONVERSATION_BINDING'});
    report.checks.push('actual MV3 worker termination / original unknown / no second click after recovery');
    await controlled.evaluate(()=>window.finishHeld());
    await wait(async()=>((await readTask(hold.taskId)).status==='succeeded'));
    const reconciled=await network.call('ipc',{op:'operation',taskId:hold.taskId,operationId:'original-held-reconcile'});assert.equal(reconciled.state,'confirmed');assert.equal(reconciled.data.status,'succeeded');
    report.checks.push('original reconciliation only resubscribes stored events; ACK alone stays unknown; actual late terminal event confirms the original control');
    assert.equal(await controlled.evaluate(()=>window.clicks),4);report.checks.push('late original DOM completion reconciles unknown without replay');
    let clicksBeforePause=4;
    if(sessionCloseTest){
      const original=controlled,conversation=await network.call('ipc',{op:'conversation',conversationId:hold.conversationId});
      const close={op:'session.close',taskId:hold.taskId,executionId:hold.executionId,operationId:'close-held-session',expectedRevision:conversation.bindingRevision};
      const accepted=await coordinator.call({method:'ipc',params:close});assert.equal(accepted.ok,true);assert.equal(accepted.result.state,'unknown');
      await wait(async()=>{const reply=await coordinator.call({method:'ipc',params:{op:'operation',taskId:hold.taskId,operationId:close.operationId}});return reply.ok&&reply.result.state==='confirmed'&&reply.result.data.closed===true;});
      assert.equal((await network.call('ipc',{op:'conversation',conversationId:hold.conversationId})).canContinue,false);
      assert.equal((await readTask(hold.taskId)).status,'succeeded');assert.equal(await original.evaluate(()=>window.clicks),4);assert.equal(original.isClosed(),false);
      if(healthTest){const health=await network.call('ipc',{op:'session.health',taskId:hold.taskId,probeId:'probe-closed'});assert.equal(health.sessionClosed,true);assert.equal(health.ready,false);assert.equal(health.domChecked,false);assert.equal(health.code,'BROWSER_SESSION_CLOSED');report.checks.push('closed session health reads its tombstone without inspecting or reopening the original tab');}
      await assert.rejects(request({conversationId:hold.conversationId,requestId:'closed-resume',message:'Do not reopen'}),{code:'CONVERSATION_BINDING'});
      report.checks.push('original Coordinator journal and authenticated MV3 atomically close the idle session; original result/tab remain; continuation is refused');
      const next=await request({requestId:'after-close-new-session',message:'Explicitly start a new session'});
      await wait(async()=>['succeeded','unknown'].includes((await readTask(next.taskId)).status));assert.equal((await readTask(next.taskId)).status,'succeeded');assert.notEqual(next.conversationId,hold.conversationId);
      controlled=context.pages().find(p=>p!==original&&p.url().startsWith('https://chatgpt.com/'));assert.ok(controlled);assert.equal(await controlled.evaluate(()=>window.clicks),1);assert.equal(await original.evaluate(()=>window.clicks),4);clicksBeforePause=1;
      report.sessionClose={closed:true,originalTask:'succeeded',originalTabRetained:true,oldTabClicks:4,newTabClicks:1};
      report.checks.push('explicit new request creates one separate session after close; retained old session receives no new click');
    }else if(navigationTest){
      const originalDocument=await setup.evaluate(async()=>{const [tab]=await chrome.tabs.query({url:'https://chatgpt.com/*'});return (await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},func:()=>null}))[0].documentId;});
      const navigating=await request({op:'continue',conversationId:task.conversationId,requestId:'navigation-protection',message:'[hold] actual document replacement'});
      await wait(async()=>((await readTask(navigating.taskId)).status==='running'));assert.equal(await controlled.evaluate(()=>window.clicks),5);
      await controlled.reload({waitUntil:'domcontentloaded'});
      await wait(async()=>((await readTask(navigating.taskId)).status==='unknown'));
      if(healthTest){const health=await network.call('ipc',{op:'session.health',taskId:navigating.taskId,probeId:'probe-navigated'});assert.equal(health.ready,false);assert.equal(health.domChecked,false);assert.equal((await readTask(navigating.taskId)).status,'unknown');report.checks.push('health after document replacement refuses the stale document and preserves unknown');}
      const replacedDocument=await setup.evaluate(async()=>{const [tab]=await chrome.tabs.query({url:'https://chatgpt.com/*'});return (await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},func:()=>null}))[0].documentId;});
      assert.notEqual(replacedDocument,originalDocument);assert.equal(await controlled.evaluate(()=>window.clicks),0);
      await assert.rejects(request({op:'continue',conversationId:task.conversationId,requestId:'after-navigation',message:'Do not send again'}),{code:'CONVERSATION_BINDING'});
      assert.equal(await controlled.evaluate(()=>window.clicks),0);clicksBeforePause=0;
      report.navigation={documentChanged:true,originalTaskStatus:'unknown',newDocumentClicks:0};report.checks.push('real document replacement keeps the original task unknown, rejects continuation and never sends into the new document');
    }else if(manualTurnTest){
      await controlled.locator('#prompt-textarea').fill('A separate human turn');await controlled.locator('[data-testid="send-button"]').click();
      await controlled.waitForFunction(()=>window.clicks===5&&document.querySelector('[data-message-id="assistant-5"] .markdown')?.textContent==='Answer 5');
      if(healthTest){const health=await network.call('ipc',{op:'session.health',taskId:hold.taskId,probeId:'probe-manual-turn'});assert.equal(health.ready,false);assert.equal(health.pageCode,'BROWSER_SESSION_MISMATCH');assert.equal((await readTask(hold.taskId)).status,'succeeded');report.checks.push('health refuses an untracked newer human turn while preserving the original completed Task');}
      const refused=await request({conversationId:hold.conversationId,requestId:'manual-turn-protection',message:'Do not cross the human turn'});
      await wait(async()=>((await readTask(refused.taskId)).status==='unknown'));assert.equal(await controlled.evaluate(()=>window.clicks),5);clicksBeforePause=5;
      report.checks.push('a real human send after the completed turn prevents automatic continuation; no sixth click or replacement result');
    }else if(historyConflictTest){
      await controlled.evaluate(kind=>{
        const button=document.createElement('button');button.dataset.testid=kind==='user-edit'?'edit-message-last':'regenerate-response-button';button.textContent='Controlled human history action';
        button.onclick=()=>{const role=kind==='user-edit'?'user':'assistant',element=[...document.querySelectorAll('[data-message-author-role]')].filter(e=>e.dataset.messageAuthorRole===role).at(-1);(element.querySelector('.markdown')||element).textContent='A manually changed '+role+' message';};document.body.append(button);
      },historyConflictTest);
      await controlled.getByRole('button',{name:'Controlled human history action',exact:true}).click();
      if(healthTest){const health=await network.call('ipc',{op:'session.health',taskId:hold.taskId,probeId:'probe-history-change'});assert.equal(health.ready,false);assert.equal(health.pageCode,'BROWSER_TRANSCRIPT_CHANGED');assert.equal((await readTask(hold.taskId)).status,'succeeded');report.checks.push('health refuses a same-anchor human history change while preserving the original completed Task');}
      const refused=await request({conversationId:hold.conversationId,requestId:'history-change-protection',message:'Never cross manually changed history'});
      await wait(async()=>(await readTask(refused.taskId)).status==='unknown');assert.equal(await controlled.evaluate(()=>window.clicks),4);clicksBeforePause=4;
      report.historyConflict={kind:historyConflictTest,originalTaskPreserved:true,newTaskStatus:'unknown',additionalProviderSends:0};report.checks.push('trusted human edit/regenerate action with the original message IDs blocks continuation before any fifth send; no automatic rebind');
    }else{
      await controlled.locator('#prompt-textarea').fill('User draft must survive');
      if(healthTest){const health=await network.call('ipc',{op:'session.health',taskId:hold.taskId,probeId:'probe-draft'});assert.equal(health.ready,false);assert.equal(health.domChecked,true);assert.equal(health.pageCode,'BROWSER_DRAFT_PRESENT');assert.equal(await controlled.locator('#prompt-textarea')[contentEditable?'innerText':'inputValue'](),'User draft must survive');report.checks.push('health reports a real human draft without changing text, clicking or modifying the completed Task');}
      const dispatchOriginal=host.dispatch;let releasePreparedDispatch;
      if(cancelPreparedTest)host.dispatch=async function(original){if(original.message.includes('Do not overwrite the draft'))await new Promise(resolve=>releasePreparedDispatch=resolve);return dispatchOriginal.call(this,original);};
      const draft=await request({op:'continue',conversationId:task.conversationId,requestId:'draft-protection',message:'Do not overwrite the draft'});
      if(cancelPreparedTest){await wait(async()=>typeof releasePreparedDispatch==='function');assert.equal(host.store.read().tasks.at(-1).phase,'prepared');}
      else await wait(async()=>((await readTask(draft.taskId)).status==='unknown'));
      assert.equal(await controlled.locator('#prompt-textarea')[contentEditable?'innerText':'inputValue'](),'User draft must survive');assert.equal(await controlled.evaluate(()=>window.clicks),4);
      report.checks.push(cancelPreparedTest?'held prepared continuation preserves human draft before any browser resume/prepare/send':'trusted manual draft input is preserved; resume refuses a fifth click');
      if(precontentCancelTest){
        const cancel={op:'cancel',taskId:draft.taskId,executionId:draft.executionId,operationId:'cancel-unsubmitted-draft'};
        const requestOriginal=host.channel.request;let cancelCommands=0,cancelQueries=0,preparedDispatchCommands=0;
        host.channel.request=async(method,p)=>{
          if(p.executionId===draft.executionId&&['session.resume','message.prepare','message.send'].includes(method))preparedDispatchCommands++;
          const result=await requestOriginal.call(host.channel,method,p);
          if(method==='task.cancel'){cancelCommands++;throw Error('Controlled loss after durable extension cancellation');}
          if(method==='operation.get'&&p.operationId===cancel.operationId)cancelQueries++;
          return result;
        };
        assert.equal((await tool('cancel_task',{taskId:cancel.taskId,operationId:cancel.operationId})).state,'unknown');
        await wait(async()=>!host.controlJobs.has(cancel.operationId));
        assert.equal(host.store.read().operations.find(o=>o.operationId===cancel.operationId).state,'unknown');
        assert.equal((await tool('cancel_task',{taskId:cancel.taskId,operationId:cancel.operationId})).state,'unknown');
        if(cancelledSessionCloseTest){const health=await network.call('ipc',{op:'session.health',taskId:draft.taskId,probeId:'probe-cancel-unconfirmed'});assert.equal(health.ready,false);assert.equal((await readTask(draft.taskId)).status,'unknown');assert.equal(host.store.read().operations.find(o=>o.operationId===cancel.operationId).state,'unknown');}
        await wait(async()=>(await tool('cancel_task',{taskId:cancel.taskId,operationId:cancel.operationId,queryOnly:true})).state==='confirmed');
        if(cancelPreparedTest){releasePreparedDispatch();await wait(async()=>host.jobs.size===0);host.dispatch=dispatchOriginal;assert.equal(preparedDispatchCommands,0);}
        assert.equal(cancelCommands,1);assert.ok(cancelQueries>=1);
        await assert.rejects(tool('cancel_task',{taskId:cancel.taskId,operationId:'missing-original-cancel',queryOnly:true}),{code:'NOT_FOUND'});assert.equal(cancelCommands,1);
        host.channel.request=requestOriginal;report.cancellationRecovery={cancelCommands,cancelQueries,missingLookupCreatedControl:false};
        assert.equal((await readTask(draft.taskId)).status,'cancelled');assert.equal(await controlled.evaluate(()=>window.clicks),4);
        assert.equal(await controlled.locator('#prompt-textarea')[contentEditable?'innerText':'inputValue'](),'User draft must survive');
        assert.equal((await tool('cancel_task',{taskId:cancel.taskId,operationId:cancel.operationId})).state,'confirmed');
        const conversation=await network.call('ipc',{op:'conversation',conversationId:draft.conversationId});assert.equal(conversation.canContinue,true);
        if(cancelledSessionCloseTest){const health=await network.call('ipc',{op:'session.health',taskId:draft.taskId,probeId:'probe-cancelled-draft'});assert.equal(health.ready,false);assert.equal(health.domChecked,true);assert.equal(health.pageCode,'BROWSER_DRAFT_PRESENT');assert.equal((await readTask(draft.taskId)).status,'cancelled');}
        await controlled.locator('#prompt-textarea').fill('');
        if(cancelledSessionCloseTest){
          const health=await network.call('ipc',{op:'session.health',taskId:draft.taskId,probeId:'probe-cancelled-clear'});assert.equal(health.ready,true);assert.equal(health.taskStatus,'cancelled');
          const original=controlled,close={op:'session.close',taskId:draft.taskId,executionId:draft.executionId,operationId:'close-cancelled-session',expectedRevision:conversation.bindingRevision};let closeCommands=0,closeQueries=0;
          host.channel.request=async(method,p)=>{const result=await requestOriginal.call(host.channel,method,p);if(method==='session.close'){closeCommands++;throw Error('Controlled loss after durable sealed-session close');}if(method==='operation.get'&&p.operationId===close.operationId)closeQueries++;return result;};
          const accepted=await coordinator.call({method:'ipc',params:close});assert.equal(accepted.ok,true);assert.equal(accepted.result.state,'unknown');await wait(async()=>!host.controlJobs.has(close.operationId));
          assert.equal(host.store.read().operations.find(o=>o.operationId===close.operationId).state,'unknown');
          await wait(async()=>{const reply=await coordinator.call({method:'ipc',params:{op:'operation',taskId:draft.taskId,operationId:close.operationId}});return reply.ok&&reply.result.state==='confirmed';});host.channel.request=requestOriginal;
          assert.equal(closeCommands,1);assert.ok(closeQueries>=1);assert.equal((await readTask(draft.taskId)).status,'cancelled');assert.equal((await readTask(hold.taskId)).status,'succeeded');assert.equal(await original.evaluate(()=>window.clicks),4);
          const closedHealth=await network.call('ipc',{op:'session.health',taskId:draft.taskId,probeId:'probe-cancelled-closed'});assert.equal(closedHealth.sessionClosed,true);assert.equal(closedHealth.domChecked,false);assert.equal(closedHealth.ready,false);
          const worker=context.serviceWorkers()[0],proof=await worker.evaluate(async({requestId,operationId,cancelId})=>{
            const db=await new Promise((resolve,reject)=>{const open=indexedDB.open('agentbridge-browser-v1',1);open.onupgradeneeded=()=>{open.transaction.abort();reject(Error('Expected original journal'));};open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(Error('Journal open failed'));});
            try{const state=await new Promise((resolve,reject)=>{const tx=db.transaction('state','readonly'),get=tx.objectStore('state').get('authority');let value;get.onsuccess=()=>value=get.result;tx.oncomplete=()=>resolve(value);tx.onabort=tx.onerror=()=>reject(Error('Journal read failed'));}),op=state.operations.find(o=>o.operationId===operationId);return {requestRowAbsent:!state.requests.some(r=>r.requestId===requestId),originalSealReferenced:op?.recoverySealOperationId===cancelId,existingSessionClosed:state.sessions.find(s=>s.bridgeSessionId===op?.meta.bridgeSessionId)?.closed===true};}finally{db.close();}
          },{requestId:draft.requestId,operationId:close.operationId,cancelId:cancel.operationId});assert.deepEqual(proof,{requestRowAbsent:true,originalSealReferenced:true,existingSessionClosed:true});
          await assert.rejects(request({conversationId:draft.conversationId,requestId:'do-not-reopen-cancelled-session',message:'Do not reopen'}),{code:'CONVERSATION_BINDING'});
          const next=await request({requestId:'after-cancelled-close-new-session',message:'Explicit new session after sealed close'});await wait(async()=>(await readTask(next.taskId)).status==='succeeded');assert.notEqual(next.conversationId,draft.conversationId);
          controlled=context.pages().find(p=>p!==original&&p.url().startsWith('https://chatgpt.com/'));assert.ok(controlled);assert.equal(await controlled.evaluate(()=>window.clicks),1);assert.equal(await original.evaluate(()=>window.clicks),4);clicksBeforePause=1;
          report.cancelledSessionClose={...proof,closeCommands,closeQueries,originalTaskStatus:'cancelled',oldTabClicks:4,newTabClicks:1,...(cancelPreparedTest?{preparedBeforeCommand:true,preparedDispatchCommands}:{})};
          report.checks.push('sealed cancellation without a prepared row permits read-only health; draft stays protected, clearing permits readiness, unconfirmed cancellation stays unknown');
          report.checks.push('original Coordinator close loses its reply, then queries only the original seal-backed tombstone; no synthetic request, extra close, old-session send or Task outcome change');
          report.checks.push('closed cancelled session cannot resume; one explicit new request creates a separate tab while the original page remains at four sends');
        }else{
          const next=await request({conversationId:draft.conversationId,requestId:'new-turn-after-proven-cancel',message:'Explicit new turn after draft removal'});
          await wait(async()=>(await readTask(next.taskId)).status==='succeeded');assert.equal(await controlled.evaluate(()=>window.clicks),5);clicksBeforePause=5;
          report.checks.push('real stdio cancel_task loses its durable MV3 reply, queryOnly resolves the original receipt without another cancellation or prompt, preserves human draft, then permits one explicit new turn after user clears it');
        }
      }
    }
    await setup.bringToFront();await setup.getByRole('button',{name:'暂停接入',exact:true}).click();await setup.getByText('已暂停',{exact:true}).waitFor();
    await setup.getByRole('button',{name:'恢复原连接',exact:true}).click();await setup.getByText('已连接本机后台',{exact:true}).waitFor();assert.equal(await controlled.evaluate(()=>window.clicks),clicksBeforePause);assert.equal(channel.pairing.list().length,1);
    report.checks.push(sessionCloseTest||cancelledSessionCloseTest?'real options pause/resume retain the pairing and closed session tombstone without extra clicks':'real options pause/resume retain the same pairing and do not replay an unknown task');
    const shots=path.join(evidenceRoot,'ui');fs.mkdirSync(shots,{recursive:true});
    report.ui=[];
    let taste;
    if(process.env.AGENTBRIDGE_TASTE_SKILL){const base=process.env.AGENTBRIDGE_TASTE_SKILL;taste={...await import(pathToFileURL(path.join(base,'scripts/lib/probe.mjs')).href),...await import(pathToFileURL(path.join(base,'scripts/lib/rules.mjs')).href)};}
    for(const [name,page,widths] of [['extension',setup,[980,768,390]],['desktop',desktop,[1440,980]]])for(const theme of ['light','dark'])for(const width of widths){
      await page.setViewportSize({width,height:960});await page.emulateMedia({colorScheme:theme});
      if(name==='desktop'){await page.locator('#workspace-theme').selectOption(theme);await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);}
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.evaluate(()=>{window.scrollTo(0,0);for(const element of document.querySelectorAll('*'))if(element.scrollTop)element.scrollTop=0;});
      await page.evaluate(()=>document.fonts.ready);const file=path.join(shots,`${name}-${theme}-${width}.png`);await page.screenshot({path:file,fullPage:true});
      const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,font:document.fonts.check('14px "IBM Plex Sans"'),passwordVisible:[...document.querySelectorAll('input[type=password]')].some(e=>e.value.length>0)}));
      assert.ok(metrics.scrollWidth<=width);assert.equal(metrics.font,true);assert.equal(metrics.passwordVisible,false);report.ui.push({name,theme,...metrics,file:path.basename(file)});
      if(taste){const m=await page.evaluate(taste.probe),lay=await page.evaluate(taste.layout),app=await page.evaluate(taste.app);report.ui.at(-1).findings=[...taste.judge(m,{width,allow:[]}),...taste.judgeLayout(lay,{width,allow:[]})].filter(f=>!taste.APP_SKIP.has(f.id)&&f.id!=='no-title'&&f.id!=='small-title').concat(taste.judgeApp(app,m,{width,allow:[]}));}
      if(name==='desktop'){assert.ok((await page.getByRole('heading',{name:'设置',exact:true}).boundingBox()).y>=0);const panel=page.locator('section[aria-labelledby="settings-browser"]'),panelFile=path.join(shots,`desktop-browser-${theme}-${width}.png`);await panel.screenshot({path:panelFile});report.ui.at(-1).panelFile=path.basename(panelFile);}
    }
    report.checks.push('real desktop light/dark at 1440/980 and extension light/dark at 980/768/390; no overflow; loaded bundled font; no pairing secret in captures');
    report.browser=context.browser().version();report.pageErrors=errors;assert.deepEqual(errors,[]);report.ok=true;
  } catch(error){
    report.ok=false;report.error=error.stack;report.pageErrors=errors;
    if(host)report.tasks=host.store.read().tasks.map(t=>({status:t.status,phase:t.phase,browserSeq:t.browserSeq,reason:t.uncertaintyReason,observationCodes:t.events.filter(e=>e.event.kind==='unknown').map(e=>/^BROWSER_[A-Z_]+$/.test(e.event.reason||'')?e.event.reason:'OBSERVATION_LOST')}));
    if(context)report.pages=await Promise.all(context.pages().map(async page=>({url:page.url(),details:page.url().startsWith('https://chatgpt.com/')?await page.evaluate(()=>({clicks:window.clicks,editors:document.querySelectorAll('#prompt-textarea').length,body:document.body.innerText.slice(0,200)})).catch(()=>null):null})));
    if(process.env.AGENTBRIDGE_TEST_INPUT_DIAGNOSTICS==='1'){
      const options=context.pages().find(p=>p.url().startsWith('chrome-extension://'));
      report.inputDiagnostics=await options?.evaluate(async()=>{const tabs=await chrome.tabs.query({url:'https://chatgpt.com/*'});return Promise.all(tabs.map(tab=>chrome.scripting.executeScript({target:{tabId:tab.id},world:'ISOLATED',func:()=>({guard:globalThis.agentBridgeTestGuard,inputs:globalThis.agentBridgeTestInputs})})));}).catch(()=>null);
    }
    throw error;
  }
  finally {
    if(mcpChild){mcpChild.stdin.end();await new Promise(resolve=>{if(mcpChild.exitCode!==null)return resolve();const timer=setTimeout(()=>mcpChild.kill(),3000);mcpChild.once('exit',()=>{clearTimeout(timer);resolve();});});}
    host?.close();network?.close();await context?.close();await machineHost?.close();await preview?.close();await new Promise(resolve=>networkGuard.close(resolve));
    report.networkGuard={upstreamConnections:0,blockedRequests};
    const out=path.join(evidenceRoot,reportName);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
    fs.rmSync(root,{recursive:true,force:true});
  }
  console.log(JSON.stringify({ok:report.ok,checks:report.checks,browser:report.browser}));
}
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={run};
