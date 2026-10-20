// Ordinary Windows EXE + production IPC/SQLite/MCP export in a disposable profile; no native/model submission.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{createHash}=require('node:crypto');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
if(process.platform!=='win32')throw Error('Windows required');
const version=require('../package.json').version,source=path.resolve(process.argv[2]),output=path.resolve(process.argv[3]);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-integrated-portable-')),exe=path.join(directory,path.basename(source));fs.copyFileSync(source,exe);
const machineId='synthetic-machine',nodeId='synthetic-codex',agentId='current-agent',conversationId='orphan-conversation',stamp='2020-01-01T00:00:00Z';
const write=(name,value)=>{const file=path.join(directory,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value));};
const tasks=[1,2].map(turn=>({taskId:'retained-'+turn,conversationId,requestId:'retained-request-'+turn,targetAgent:'old-agent',message:'original synthetic turn',status:'succeeded',createdAt:stamp,updatedAt:stamp,turn,lastSeq:1,offset:0,events:[],native:{sessionId:'original-native'},result:{message:'retained '+turn}}));
const native={revision:1,agents:[{agentId,adapter:'codex',executable:'C:/synthetic/never-run.exe',workspace:directory,enabled:true}],tasks,conversations:[{conversationId,targetAgent:'old-agent',sessionId:'original-native',turns:2,lastTaskId:'retained-2'}],requests:tasks.map(t=>({requestId:t.requestId,taskId:t.taskId})),operations:[]};
const originalUnknown={operationId:'synthetic-original-unknown',lane:'node',method:'manageNode',params:{operationId:'synthetic-original-unknown',nodeId:'retained-node',machineId,action:'attach'},state:'unknown',time:stamp,error:{code:'NATIVE_START_TIMEOUT',message:'original timeout'}};
write('desktop.json',{theme:'light',distribution:'',directory:'/tmp/'+path.basename(directory)});
write('machines.json',{version:1,localMachineId:machineId,machines:[{machineId,name:'Synthetic Windows',kind:'windows',platform:'win32'}],connections:[],instances:[]});
write('agent-network.json',{version:1,revision:0,nodes:[{nodeId,machineId,adapter:'codex',executable:'C:/synthetic/never-run.exe',connected:true,executionSupported:true}],collaboration:{leaderId:null,memberIds:[],revision:0},requests:[],delegations:[]});
write('windows/node-contexts.json',[{contextId:'original-codex',nodeId,adapter:'codex',agentId,executable:'C:/synthetic/never-run.exe',workspace:directory}]);
write('windows/node-contexts/original-codex/codex-state.json',native);write('graph-pending.json',[originalUnknown]);
const report={date:new Date().toISOString(),version,environment:'Windows ordinary no-debug EXE / production Coordinator+MachineHost+SQLite / synthetic retained history and isolated native configuration paths',modelCalls:0,status:'running',checks:[],portable:{bytes:fs.statSync(exe).size,sha256:createHash('sha256').update(fs.readFileSync(exe)).digest('hex')}};
const delay=ms=>new Promise(r=>setTimeout(r,ms));let wrapper,main,client,runId,documentId,connectionId;
const ps=text=>new Promise((resolve,reject)=>execFile(path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',text],{windowsHide:true,timeout:15000},(e,out)=>e?reject(e):resolve(out.trim())));
async function launch(){
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:directory,CODEX_HOME:path.join(directory,'native-config/codex'),CLAUDE_CONFIG_DIR:path.join(directory,'native-config/claude'),OPENCODE_CONFIG_DIR:path.join(directory,'native-config/opencode')};delete env.ELECTRON_RUN_AS_NODE;
 wrapper=spawn(exe,[],{env,stdio:'ignore'});const until=Date.now()+120000;
 while(Date.now()<until){
  if(fs.existsSync(path.join(directory,'coordinator-status.json'))){
   const raw=await ps(`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${wrapper.pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;command=$_.CommandLine;title=(Get-Process -Id $_.ProcessId).MainWindowTitle}} | ConvertTo-Json -Compress`);
   const rows=raw?JSON.parse(raw):[];main=(Array.isArray(rows)?rows:[rows]).find(x=>x.title==='AgentBridge');
   if(main){assert(!/remote-debugging|--inspect/.test(main.command));const next=new CoordinatorClient({directory});try{await next.attach();client=next;assert.equal(client.info.version,version);return;}catch(e){next.close();if(!['ENOENT','ECONNREFUSED'].includes(e.code))throw e;}}
  }
  await delay(500);
 }
 throw Error('Ordinary candidate did not open');
}
async function closeWindow(){if(!main)return;assert.equal(main.parent,wrapper.pid);await ps(`(Get-Process -Id ${main.pid}).CloseMainWindow() | Out-Null`);const until=Date.now()+30000;while(Date.now()<until&&wrapper.exitCode===null)await delay(200);assert.notEqual(wrapper.exitCode,null);main=null;}
async function call(method,params={}){const r=await client.request('call',{method,params});if(!r.ok)throw Object.assign(Error(r.error.message),{code:r.error.code});return r.result;}
async function check(){
 const old=await call('ipc',{op:'conversation',machineId,conversationId:machineId+'::'+conversationId});assert.equal(old.items.length,2);assert.equal(old.canContinue,false);assert.equal(old.items[0].native.sessionId,'original-native');
 const pending=await call('graphPending');assert.equal(pending.length,1);assert.equal(pending[0].operationId,originalUnknown.operationId);assert.equal(pending[0].state,'unknown');
 const index=await call('team.materials',{runId});assert.equal(index.documents.items[0].revision,2);assert.equal(index.readOnly,true);
 const pinned=await call('team.document',{runId,documentId,revision:1});assert.equal(pinned.content,'synthetic old body');assert.equal(pinned.revision,1);assert.equal(pinned.currentRevision,2);
 assert.equal(pinned.contentSha256,createHash('sha256').update(pinned.content).digest('hex'));
 const state=await call('mcp.status',{nodeId});assert.equal(state.connectionId,connectionId);assert.equal(state.enabled,true);
 const saved=JSON.parse(fs.readFileSync(path.join(directory,'windows/node-contexts/original-codex/codex-state.json')));assert.deepEqual(saved.tasks,native.tasks);assert.deepEqual(saved.requests,native.requests);assert.deepEqual(saved.operations,[]);
 const network=JSON.parse(fs.readFileSync(path.join(directory,'agent-network.json')));assert.equal(network.requests.length,0);assert.equal(network.delegations.length,0);
}
(async()=>{
 await launch();assert(['owned-object-controls-v1','scoped-management-v1','opencode-v2-admission-v1'].every(x=>client.info.capabilities.includes(x)));
 report.checks.push('Ordinary candidate opens with all three safe routing/management/version capabilities and no debug flags.');
 const member=await call('team.registerAgent',{operationId:'member',kind:'mcp',externalKey:'synthetic-reader',name:'材料验证',purpose:'只读'});
 const team=await call('team.createTeam',{operationId:'team',name:'合并验证',leaderId:member.agentId,memberIds:[member.agentId]});
 const run=await call('team.createRun',{operationId:'run',teamId:team.teamId,name:'材料读取',goal:'保持准确修订',acceptance:'原版正文与历史均保留'});runId=run.runId;
 const doc=await call('team.writeDocument',{operationId:'document-one',runId,title:'版本文档',content:'synthetic old body',expectedRevision:0});documentId=doc.documentId;
 await call('team.writeDocument',{operationId:'document-two',runId,documentId,title:'版本文档',content:'synthetic new body',expectedRevision:1});
 const exported=await call('mcp.export',{nodeId});connectionId=exported.connectionId;assert.equal(exported.enabled,true);
 const tomlFile=Object.values(exported.files).find(f=>f.endsWith('.toml'));assert(tomlFile&&fs.readFileSync(tomlFile,'utf8').includes('[mcp_servers.agentbridge]'));
 const status=await call('mcp.status',{nodeId});assert(status.configPath.startsWith(path.join(directory,'native-config/codex')));assert(!fs.existsSync(status.configPath));
 await check();report.checks.push('Packaged exact document revision, standalone MCP TOML export and orphan native history work together; original unknown is retained and no native config is installed.');
 const first=client.info.pid;await closeWindow();client.close();await launch();assert.equal(client.info.pid,first);await check();report.checks.push('Ordinary window reopen reuses the same coordinator and original records without native requests.');
 await closeWindow();await client.request('shutdown');client.close();for(let i=0;i<150;i++){try{process.kill(first,0);}catch{break;}await delay(200);}
 await launch();assert.notEqual(client.info.pid,first);await check();report.checks.push('Full coordinator restart reloads shared SQLite materials and the same standalone MCP connection without replay.');
 const frozen=fs.readdirSync(path.join(directory,'coordinator/versions')).find(n=>n.startsWith(version+'-'));assert(frozen);
 const tomlPackage=JSON.parse(fs.readFileSync(path.join(directory,'coordinator/versions',frozen,'node_modules/smol-toml/package.json')));assert.equal(tomlPackage.version,'1.9.1');
 for(const name of ['machine-host.cjs','agent-network.cjs','team-materials.cjs','mcp-integration.cjs','mcp-config.cjs','runtime-capabilities.cjs'])assert.equal(createHash('sha256').update(fs.readFileSync(path.join(directory,'coordinator/versions',frozen,'desktop/electron',name))).digest('hex'),createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../electron',name))).digest('hex'));
 report.checks.push('Frozen packaged runtime contains the repaired TOML dependency and all integrated modules match source bytes.');report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code,message:e.message};process.exitCode=1;}).finally(async()=>{try{await closeWindow();}catch{}try{await client?.request('shutdown');}catch{}client?.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
