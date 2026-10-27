// Explicit acceptance: actual Windows transport -> Linux MachineHost -> installed
// Hermes and its existing account/model. Two small turns; no tools or overrides.
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const {randomUUID, createHash} = require('node:crypto');
const [bridgeArg, distribution, outputArg, bootstrapArg] = process.argv.slice(2);
if (process.platform !== 'win32' || !outputArg) throw Error('Provide frozen Bridge resources, WSL distribution and output directory on Windows');
const bridge = path.resolve(bridgeArg), output = path.resolve(outputArg);
const {HostConnection} = require(path.join(bridge,'desktop/electron/rpc.cjs'));
const manifest = JSON.parse(fs.readFileSync(path.join(bridge,'../linux-package/manifest.json')));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const name of ['desktop/electron/rpc.cjs','desktop/electron/machine-host.cjs','desktop/electron/native-cli-host.cjs','desktop/electron/native-cli-protocols.cjs','desktop/electron/tool-discovery.cjs','dist/desktop-host.js','bootstrap.sh']) {
  assert.equal(hash(path.join(bridge,name)),manifest.files.find(row=>row.path===(name==='bootstrap.sh'?'desktop/electron/bootstrap.sh':name))?.sha256,'Frozen runtime must match its packaged Linux manifest');
}
fs.mkdirSync(output,{recursive:true});
const stateFile = path.join(output,'private-checkpoint.json'), reportFile = path.join(output,'report.json');
const resuming = fs.existsSync(stateFile);
const state = resuming ? JSON.parse(fs.readFileSync(stateFile)) : {schema:1,version:manifest.version,distribution,bridge,linuxDirectory:'/tmp/ab-hermes-wsl-execution-'+randomUUID(),marker:'WSL_HERMES_中文_'+randomUUID().replaceAll('-',''),firstIntent:false,secondIntent:false};
assert.equal(state.version,manifest.version); assert.equal(state.distribution,distribution); assert.equal(state.bridge,bridge);
const report = {date:new Date().toISOString(),version:manifest.version,status:'running',environment:'Windows HostConnection -> actual WSL Linux MachineHost -> installed Hermes with original native account/model',resumedOriginalCheckpoint:resuming,customBootstrap:!!bootstrapArg,completedModelTurns:0,checks:[]};
let host, childExit, originalChild;
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
const checkpoint = () => {fs.writeFileSync(stateFile,JSON.stringify(state,null,2)+'\n',{mode:0o600});fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');};
const unc = name => '\\\\wsl.localhost\\'+distribution+name.replaceAll('/','\\');
function configuration(home) {
  const root=home+'/.hermes', roots=[['default',root]];
  const activeFile=unc(root+'/active_profile');
  if(fs.existsSync(activeFile)) {const active=fs.readFileSync(activeFile,'utf8').trim();if(/^[\w-]+$/.test(active)&&active!=='default')roots.push(['active',root+'/profiles/'+active]);}
  return Object.fromEntries(roots.flatMap(([label,folder])=>['config.yaml','.env','auth.json','active_profile'].map(name=>{const file=unc(folder+'/'+name);return [label+'/'+name,fs.existsSync(file)?hash(file):null];})));
}
async function open() {
  host=new HostConnection(path.join(bridge,'dist/desktop-host.js'),{distribution,directory:state.linuxDirectory,bootstrapPath:bootstrapArg?path.resolve(bootstrapArg):path.join(bridge,'bootstrap.sh')});
  const starting=host.start();
  const track=()=>{if(!host?.child||originalChild===host.child)return;originalChild=host.child;const child=originalChild;childExit=child.exitCode!==null||child.signalCode!==null?Promise.resolve({code:child.exitCode,signal:child.signalCode}):new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));};
  const tracking=setInterval(track,10);
  try{await starting;}finally{track();clearInterval(tracking);}
  const environment=await host.call('environment');assert.equal(environment.platform,'linux');assert.equal(environment.directory,state.linuxDirectory);
  report.linuxNode=environment.node;return environment;
}
async function close() {
  if(!host)return;
  const diagnostics=host.lastError||'';
  report.transportDiagnostic=diagnostics.includes('AGENTBRIDGE_NODE_MISSING')?'AGENTBRIDGE_NODE_MISSING':diagnostics?'private diagnostics retained locally':'none';
  if(diagnostics)fs.writeFileSync(path.join(output,'private-transport-diagnostic.txt'),diagnostics,{mode:0o600});
  host.close();host=null;
  if(!childExit)return;
  let timer;
  try {const result=await Promise.race([childExit,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Original WSL host exit is not confirmed; retain its checkpoint')),20000);})]);(report.transportExits||=[]).push(result);assert.equal(result.code,0);report.originalTransportsExited=(report.originalTransportsExited||0)+1;}
  finally {clearTimeout(timer);}
}
async function original(requestId) {
  try{return await host.call('ipc',{op:'request',requestId});}
  catch(error){if(error.code==='NOT_FOUND'||error.code==='NOT_CONFIGURED')return null;throw error;}
}
async function finish(task) {
  const deadline=Date.now()+180000;
  while(Date.now()<deadline) {
    const current=await host.call('ipc',{op:'task',taskId:task.taskId});
    if(['succeeded','failed','cancelled'].includes(current.status))return current;
    report.observedStatus=current.status;checkpoint();await delay(500);
  }
  throw Error('Observation budget ended; query the original request, never replace or replay it');
}
async function firstRequest() {
  const existing=await original(state.first.requestId);
  if(existing)return existing;
  if(state.firstIntent)throw Error('Original submission has no confirmed receipt; retain its ID and checkpoint without resubmitting');
  state.firstIntent=true;checkpoint();return host.call('ipc',state.first);
}
(async()=>{
  checkpoint();const environment=await open();state.nativeBefore ||= configuration(environment.home);
  if(!state.context) {
    const discovered=await host.call('discover'), installed=discovered.items.find(row=>row.adapter==='hermes');
    assert(installed?.healthy);assert.equal(installed.version,'0.22.5');assert.equal(installed.executionSupported,true);
    state.context=await host.call('context',{nodeId:'wsl-hermes-live-acceptance',adapter:'hermes',executable:installed.executable});
    state.first={op:'submit',agentId:state.context.agentId,requestId:state.marker+'-first',message:'Do not use any tools. Reply with exactly this token and nothing else: '+state.marker};checkpoint();
  }
  report.checks.push('Frozen Windows transport discovers and prepares the actual Linux Hermes installation without a model/provider override');
  const first=await finish(await firstRequest());assert.equal(first.status,'succeeded','Original first native turn must succeed');assert(first.result.message.includes(state.marker));
  state.firstTask=first.taskId;state.conversation=first.conversationId;checkpoint();report.completedModelTurns=1;
  const duplicate=await host.call('ipc',state.first);assert.equal(duplicate.taskId,first.taskId);
  report.checks.push('Unicode native first turn succeeds and an exact duplicate original request resolves to its existing task');checkpoint();
  await close();await open();
  const recovered=await original(state.first.requestId);assert.equal(recovered.taskId,first.taskId);assert.equal(recovered.status,'succeeded');
  const conversation=await host.call('ipc',{op:'conversation',conversationId:first.conversationId});assert.equal(conversation.canContinue,true);
  state.second ||= {op:'continue',conversationId:first.conversationId,requestId:state.marker+'-second',message:'Do not use tools. Repeat the exact token from my previous user message, followed immediately by _CONTINUED. No other text.'};checkpoint();
  let next=await original(state.second.requestId);
  if(!next) {
    if(state.secondIntent)throw Error('Original continuation has no confirmed receipt; retain it without resubmitting');
    state.secondIntent=true;checkpoint();next=await host.call('ipc',state.second);
  }
  const second=await finish(next);assert.equal(second.status,'succeeded','Original continuation must succeed');assert.equal(second.native.sessionId,first.native.sessionId);assert(second.result.message.includes(state.marker+'_CONTINUED'));
  report.completedModelTurns=2;report.checks.push('Full Windows-to-WSL observer restart preserves the original request and continues exactly the same native Session with prior-turn memory');
  const snapshot=await host.call('snapshot');assert.equal(snapshot.tasks.length,2);assert.equal(snapshot.agents.items.find(row=>row.agentId===state.context.agentId).capabilities.cancellation,false);
  report.checks.push('Only the two intended tasks exist; gateway cancellation remains explicitly unsupported');
  const nativeAfter=configuration(environment.home);report.nativeConfiguration={byteIdentical:JSON.stringify(nativeAfter)===JSON.stringify(state.nativeBefore),changedFiles:[...new Set([...Object.keys(nativeAfter),...Object.keys(state.nativeBefore)])].filter(name=>nativeAfter[name]!==state.nativeBefore[name])};
  report.checks.push('Native-managed configuration changes are recorded separately; no credentials or native Session IDs are copied into this report');
  await close();report.status='passed';checkpoint();
})().catch(error=>{report.status='failed';report.error={code:error.code||'ACCEPTANCE_FAILED',executionNotDispatched:error.executionNotDispatched===true,message:error.code==='ERR_ASSERTION'?error.message.split('\n')[0]:'Original WSL execution acceptance is incomplete; inspect the retained checkpoint locally'};process.exitCode=1;})
  .finally(async()=>{try{await close();}catch{report.cleanupPending=true;report.status='failed';process.exitCode=1;}checkpoint();console.log(JSON.stringify(report));});
