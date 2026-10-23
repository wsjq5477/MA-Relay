// Ordinary no-debug Windows EXE, disposable synthetic profile, model 0.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{createHash}=require('node:crypto');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
if(process.platform!=='win32')throw Error('Windows required');
const version=process.argv[4]||require('../package.json').version,directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-native-lifecycle-portable-'));
const source=path.resolve(process.argv[2]),exe=path.join(directory,path.basename(source));fs.copyFileSync(source,exe);
const machineId='synthetic-local',nodeId='history-node',agentId='current-row-agent',conversationId='orphan-session',time='2020-01-01T00:00:00Z';
const dshNode='synthetic-dsh',nativeHome=path.join(directory,'native-home');fs.mkdirSync(nativeHome,{recursive:true});let selected,originalA,originalDshExecutable;
const write=(name,data)=>{const file=path.join(directory,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data));};
const tasks=[1,2].map(turn=>({taskId:'retained-'+turn,conversationId,requestId:'original-'+turn,targetAgent:'retired-agent',message:'Synthetic original '+turn,status:'succeeded',createdAt:time,updatedAt:time,turn,lastSeq:1,offset:0,events:[],native:{sessionId:'native-original'},result:{message:'retained answer '+turn}}));
write('graph-pending.json',[{operationId:'original-node-unknown',lane:'node',method:'manageNode',params:{operationId:'original-node-unknown',nodeId:'old-opencode',machineId,action:'attach'},state:'unknown',time,error:{code:'NATIVE_START_TIMEOUT',message:'synthetic original timeout'}}]);
write('desktop.json',{theme:'light',distribution:'',directory:'/tmp/'+path.basename(directory)});
write('machines.json',{version:1,localMachineId:machineId,machines:[{machineId,name:'Synthetic Windows',kind:'windows',platform:'win32'}],connections:[],instances:[]});
write('agent-network.json',{version:1,revision:0,nodes:[{nodeId:'old-opencode',machineId,adapter:'opencode',name:'Synthetic original OpenCode',executable:'C:/synthetic/original-opencode.exe',connected:false,executionSupported:true},{nodeId:'independent-b',machineId,adapter:'opendesk-desktop',name:'Synthetic independent OpenDesk',executable:'C:/synthetic/opendesk.exe',connected:true,executionSupported:true},{nodeId:dshNode,machineId,adapter:'dsh-desktop',executable:'C:/synthetic/DSH Desktop.exe',connected:false,executionSupported:true},{nodeId,machineId,adapter:'codex',executable:'C:/synthetic/never-execute.exe',connected:true,executionSupported:true}],collaboration:{leaderId:null,memberIds:[],revision:0},requests:[],delegations:[]});
write('windows/node-contexts.json',[{contextId:'retained-codex',nodeId,adapter:'codex',agentId,executable:'C:/synthetic/never-execute.exe',workspace:directory}]);
const native={revision:1,agents:[{agentId,adapter:'codex',executable:'C:/synthetic/never-execute.exe',workspace:directory,enabled:true}],tasks,conversations:[{conversationId,targetAgent:'retired-agent',sessionId:'native-original',turns:2,lastTaskId:tasks[1].taskId}],requests:tasks.map(t=>({requestId:t.requestId,taskId:t.taskId})),operations:[]};
write('windows/node-contexts/retained-codex/codex-state.json',native);
const report={date:new Date().toISOString(),version,environment:'Windows ordinary no-debug EXE / production Coordinator+MachineHost+CodexHost / synthetic persisted original history',status:'running',modelCalls:0,checks:[],portable:{bytes:fs.statSync(exe).size,sha256:createHash('sha256').update(fs.readFileSync(exe)).digest('hex')}};
const output=path.resolve(process.argv[3]);
function checkpoint(phase){report.phase=phase;fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
checkpoint('created');
const delay=ms=>new Promise(r=>setTimeout(r,ms));let wrapper,client,main;
const ps=command=>new Promise((resolve,reject)=>execFile(path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:15000},(error,out)=>error?reject(error):resolve(out.trim())));
async function launch(executable=exe,expectedVersion=version){
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:directory,USERPROFILE:nativeHome,OPENDESK_CONFIG_DIRECTORY:path.join(nativeHome,'opendesk')};delete env.ELECTRON_RUN_AS_NODE;
 checkpoint('launching '+expectedVersion);wrapper=spawn(executable,[],{env,stdio:'ignore'});
 const until=Date.now()+120000;
 while(Date.now()<until){
  if(fs.existsSync(path.join(directory,'coordinator-status.json'))){
   const text=await ps(`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${wrapper.pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;command=$_.CommandLine;title=(Get-Process -Id $_.ProcessId).MainWindowTitle}} | ConvertTo-Json -Compress`);
   const parsed=text?JSON.parse(text):[];main=(Array.isArray(parsed)?parsed:[parsed]).find(p=>p.title==='AgentBridge');
   if(main){assert(!/remote-debugging|--inspect/.test(main.command));const next=new CoordinatorClient({directory});try{await next.attach();client=next;assert.equal(client.info.version,expectedVersion);checkpoint('attached '+expectedVersion);return;}catch(error){next.close();if(!['ENOENT','ECONNREFUSED'].includes(error.code))throw error;}}
  }
  await delay(500);
 }
 throw Error('Ordinary EXE did not open');
}
async function closeWindow(){
 if(!main)return;assert.equal(main.parent,wrapper.pid);
 await ps(`(Get-Process -Id ${main.pid}).CloseMainWindow() | Out-Null`);
 const until=Date.now()+30000;while(Date.now()<until&&wrapper.exitCode===null)await delay(200);
 assert.notEqual(wrapper.exitCode,null);main=null;
}
async function call(method,params){const reply=await client.request('call',{method,params});assert.equal(reply.ok,true,JSON.stringify(reply.error));return reply.result;}
async function check(){
 const reply=await client.request('call',{method:'ipc',params:{op:'conversation',machineId,conversationId:machineId+'::'+conversationId}});
 assert.equal(reply.ok,true,JSON.stringify(reply.error));assert.equal(reply.result.items.length,2);assert.equal(reply.result.items[0].result.message,'retained answer 1');assert.equal(reply.result.items[1].native.sessionId,'native-original');assert.equal(reply.result.canContinue,false);
 const missing=await client.request('call',{method:'ipc',params:{op:'conversation',machineId,conversationId:machineId+'::missing'}});assert.equal(missing.ok,false);assert.equal(missing.error.code,'NOT_FOUND');
 const snapshot=await client.request('call',{method:'snapshot',params:{}});assert.equal(snapshot.ok,true);
 const original=await client.request('call',{method:'graphPending',params:{}});assert.equal(original.ok,true);assert.equal(original.result.length,1);assert.equal(original.result[0].operationId,'original-node-unknown');assert.equal(original.result[0].state,'unknown');assert.equal(original.result[0].params.machineId,machineId);
 if(selected){const state=await call('dsh.status',{machineId,nodeId:dshNode});assert.equal(state.selectedConnectionId,selected);assert.equal(state.items.find(i=>i.connectionId===selected).origin,'http://127.0.0.1:43120');assert(!JSON.stringify(state).includes('synthetic-private-token'));assert.equal(fs.readFileSync(originalA.file,'utf8'),originalA.bytes);const savedNetwork=JSON.parse(fs.readFileSync(path.join(directory,'agent-network.json')));assert.equal(savedNetwork.dshBindings.find(b=>b.nodeId===dshNode).connectionId,selected);assert.equal(savedNetwork.nodes.find(n=>n.nodeId===dshNode).executable,originalDshExecutable);}
 const versionInfo=client.info.capabilities;assert(versionInfo.includes('scoped-management-v1'));assert(versionInfo.includes('opencode-v2-admission-v1'));assert(versionInfo.includes('scoped-node-management-v1'));
 const saved=JSON.parse(fs.readFileSync(path.join(directory,'windows/node-contexts/retained-codex/codex-state.json')));assert.deepEqual(saved.tasks,native.tasks);assert.deepEqual(saved.requests,native.requests);assert.deepEqual(saved.conversations,native.conversations);assert.deepEqual(saved.operations,[]);assert(!fs.existsSync(path.join(directory,'windows/node-contexts/retained-codex/runs')));
}
(async()=>{
 const oldVersion='0.6.0-alpha.51.recovery.2',oldExe=path.join(directory,'old-'+oldVersion+'.exe');const oldSource=path.resolve(process.argv[5]);assert.equal(createHash('sha256').update(fs.readFileSync(oldSource)).digest('hex'),'db079cb622d4fea75607758cb7e94a6f151683fb81c8f29b88b5f382f65152cd');fs.copyFileSync(oldSource,oldExe);
 await launch(oldExe,oldVersion);const oldPid=client.info.pid;assert(!client.info.capabilities?.includes('scoped-relation-management-v1'));await closeWindow();client.close();
 await launch(exe,oldVersion);await assert.rejects(client.request('call',{method:'snapshot',params:{}}),{code:'COORDINATOR_UPGRADE_REQUIRED'});assert.equal((await client.request('preferences')).version,oldVersion);report.checks.push('New ordinary EXE detects the still-running alpha.51.recovery.2 coordinator and blocks unsafe calls while settings remain accessible');
 checkpoint('old coordinator refused; stopping controlled old runtime');await closeWindow();await client.request('shutdown');client.close();for(let i=0;i<150;i++){try{process.kill(oldPid,0);}catch{break;}await delay(200);}
 await launch();assert(client.info.capabilities.includes('owned-object-controls-v1'));const firstPid=client.info.pid;
 assert(client.info.capabilities.includes('scoped-relation-management-v1'));assert(client.info.capabilities.includes('opendesk-mcp-lifecycle-v1'));
 const pendingBefore=JSON.parse(fs.readFileSync(path.join(directory,'graph-pending.json'))).find(r=>r.operationId==='original-node-unknown');
 const originalSettings=path.join(nativeHome,'opendesk/setting.json');fs.mkdirSync(path.dirname(originalSettings),{recursive:true});fs.writeFileSync(originalSettings,JSON.stringify({theme:'synthetic-untouched'}));const nativeBefore=fs.readFileSync(originalSettings);
 const status=await call('mcp.status',{nodeId:'independent-b'});assert.equal(status.nativeProbeSupported,false);assert.equal(status.lifecycle.processState,'running','actual running OpenDesk required for packaged refusal check');
 const refused=await client.request('call',{method:'mcp.install',params:{nodeId:'independent-b'}});assert.equal(refused.ok,false);assert.equal(refused.error.code,'MCP_NATIVE_RUNNING');assert.deepEqual(fs.readFileSync(originalSettings),nativeBefore);assert(!fs.existsSync(path.join(directory,'windows/mcp-connections/connections.json')));
 const probe=await call('mcp.probe',{nodeId:'independent-b'});assert.equal(probe.evidence.nativeProbe.outcome,'unsupported');assert.equal(probe.facts.connection,'unknown');report.checks.push('Packaged production lifecycle detects real running OpenDesk and refuses isolated native write before registration; native list explicitly unsupported.');
 const relationParams={operationId:'one-independent-relation',leaderId:'independent-b',memberIds:[],expectedRevision:0};const saved=await call('saveCollaboration',relationParams);assert.equal(saved.state,'confirmed');assert.equal(saved.data.leaderId,'independent-b');const again=await call('saveCollaboration',relationParams);assert.equal(again.state,'confirmed');const savedNetwork=JSON.parse(fs.readFileSync(path.join(directory,'agent-network.json')));assert.equal(savedNetwork.relationOperations.filter(r=>r.operationId===relationParams.operationId).length,1);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory,'graph-pending.json'))).find(r=>r.operationId==='original-node-unknown'),pendingBefore);report.checks.push('Independent original node B saves one idempotent relationship while original A unknown, time, parameters and error remain unchanged. No model execution.');

 originalDshExecutable=JSON.parse(fs.readFileSync(path.join(directory,'agent-network.json'))).nodes.find(n=>n.nodeId===dshNode).executable;
 const a=await call('dsh.configure',{machineId,nodeId:dshNode,adapter:'dsh-desktop',url:'http://127.0.0.1:3080/',token:'synthetic-private-token',enabled:false});const aRow=a.items.find(i=>i.connectionId===a.selectedConnectionId);assert(aRow.executable.startsWith(nativeHome+path.sep));originalA={file:aRow.executable,bytes:fs.readFileSync(aRow.executable,'utf8')};
 const b=await call('dsh.configure',{machineId,nodeId:dshNode,adapter:'dsh-desktop',url:'http://127.0.0.1:43120/',token:'synthetic-private-token',enabled:false});selected=b.selectedConnectionId;assert.notEqual(selected,a.selectedConnectionId);assert.equal(b.items.length,2);assert(!JSON.stringify(b).includes('synthetic-private-token'));await check();report.checks.push('Packaged DSH configure/status selects B before rescan, preserves private A bytes and never returns a token; disabled synthetic endpoints avoid service traffic.');report.checks.push('Actual orphan Codex turns load through the frozen backend; absent original is NOT_FOUND, global snapshot remains usable');
 await closeWindow();client.close();await launch();assert.equal(client.info.pid,firstPid);await check();report.checks.push('Ordinary window close/reopen retains original coordinator and history without replay');
 await closeWindow();await client.request('shutdown');client.close();const until=Date.now()+30000;while(Date.now()<until){try{process.kill(firstPid,0);}catch{break;}await delay(200);}
 await launch();assert.notEqual(client.info.pid,firstPid);await check();report.checks.push('Full coordinator restart preserves both original turns, requests and native session');
 const frozen=fs.readdirSync(path.join(directory,'coordinator/versions')).find(n=>n.startsWith(version+'-'));
 for(const name of ['machine-host.cjs','agent-network.cjs','dsh-connection.cjs','opendesk-lifecycle.cjs','mcp-integration.cjs','coordinator-service.cjs','runtime-capabilities.cjs','graph-operations.cjs'])assert.equal(createHash('sha256').update(fs.readFileSync(path.join(directory,'coordinator/versions',frozen,'desktop/electron',name))).digest('hex'),createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../electron',name))).digest('hex'));
 report.checks.push('Frozen lifecycle, MCP, network, journal and coordinator modules match the verified source');report.status='passed';
})().catch(error=>{report.status='failed';report.error={code:error.code,message:error.message};process.exitCode=1;}).finally(async()=>{try{await closeWindow();}catch{}try{await client?.request('shutdown');}catch{}client?.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
