// Actual, externally started OpenCode service; original Controller/Client only.
// No model messages and no fake native responses. Not an AgentDirectory test.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {randomBytes,createHash}=require('node:crypto'),assert=require('node:assert/strict');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){
 assert.equal(process.platform,'linux');assert.equal(process.env.AGENTBRIDGE_REAL_NATIVE,'1');
 const home=os.homedir(),root='/tmp/ab-existing-opencode-20261103',testRoot=root+'/lifecycle',workspace=root+'/workspace',executable=home+'/.opencode/bin/opencode';
 for(const p of [home,process.execPath,executable,workspace])assert.ok(!/^\/mnt\/c(?:\/|$)/.test(fs.realpathSync(p)));
 if(fs.existsSync(testRoot)){
  const previous=JSON.parse(fs.readFileSync(testRoot+'/result.json')),owner=JSON.parse(fs.readFileSync(testRoot+'/owner.json'));
  assert.equal(previous.ok,false);assert.equal(previous.nativeServiceExitObserved,true);assert.equal(previous.modelMessagesSubmitted,0);
  let currentBirth;try{currentBirth=fs.readFileSync('/proc/'+owner.pid+'/stat','utf8').split(') ')[1].split(' ')[19];}catch{}
  assert.ok(!currentBirth||currentBirth!==owner.birth,'Original native service is still alive; query it instead');
  let attempt=1;while(fs.existsSync(testRoot+'/attempt-'+attempt+'-result.json'))attempt++;
  fs.copyFileSync(testRoot+'/result.json',testRoot+'/attempt-'+attempt+'-result.json',fs.constants.COPYFILE_EXCL);
  fs.copyFileSync(testRoot+'/owner.json',testRoot+'/attempt-'+attempt+'-owner.json',fs.constants.COPYFILE_EXCL);
 }else fs.mkdirSync(testRoot,{mode:0o700});
 const repo=path.resolve(__dirname,'../..'),imported=await Promise.all(['settings','controller'].map(name=>import(pathToFileURL(path.join(repo,'dist',name+'.js')).href)));
 const [{SettingsStore},{startController,ipc}]=imported;
 const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 const password=randomBytes(24).toString('hex'),origin='http://127.0.0.1:'+port,environment={...process.env,HOME:home,PATH:home+'/.opencode/bin:'+path.dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin',TEMP:root+'/tmp',TMP:root+'/tmp',TMPDIR:root+'/tmp',XDG_CONFIG_HOME:home+'/.config',XDG_DATA_HOME:home+'/.local/share',XDG_CACHE_HOME:home+'/.cache',XDG_STATE_HOME:home+'/.local/state',OPENCODE_PASSWORD:password,OPENCODE_SERVER_PASSWORD:password,OPENCODE_SERVER_USERNAME:'opencode',NO_PROXY:'127.0.0.1,localhost,::1'};
 for(const key of ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy'])delete environment[key];
 Object.assign(process.env,{TEMP:root+'/tmp',TMP:root+'/tmp',TMPDIR:root+'/tmp',XDG_CACHE_HOME:home+'/.cache'});
 const config=home+'/.config/opencode/opencode.json',fingerprint=()=>createHash('sha256').update(fs.readFileSync(config)).digest('hex'),before=fingerprint();
 const passwordFile=testRoot+'/native.password';fs.writeFileSync(passwordFile,password,{mode:0o600});
 const child=spawn(executable,['serve','--hostname','127.0.0.1','--port',String(port)],{cwd:workspace,env:environment,detached:true,stdio:['ignore','pipe','pipe']});child.stdout.resume();child.stderr.resume();
 let ended=false;const closed=new Promise(resolve=>child.once('close',(code,signal)=>{ended=true;resolve({code,signal});}));
 const birth=()=>{try{return fs.readFileSync('/proc/'+child.pid+'/stat','utf8').split(') ')[1].split(' ')[19];}catch{return null;}};
 const stateFile=testRoot+'/owner.json';fs.writeFileSync(stateFile,JSON.stringify({pid:child.pid,birth:birth(),ownedBy:'acceptance-operator-not-bridge'}),{mode:0o600});
 const report={date:new Date().toISOString(),sourceOnly:true,actualNativeService:true,throughOriginalController:false,throughAgentDirectory:false,throughMachineHost:false,modelMessagesSubmitted:0,checks:{},ok:false};
 const headers={authorization:'Basic '+Buffer.from('opencode:'+password).toString('base64')};
 let observer;
 const health=async()=>{const response=await fetch(origin+'/global/health',{headers,signal:AbortSignal.timeout(3000)});assert.equal(response.status,200);const body=await response.json();assert.equal(body.healthy,true);return body;};
 try{
  const deadline=Date.now()+15000;let ready;do{assert.equal(ended,false);try{ready=await health();break;}catch{}await pause(200);}while(Date.now()<deadline);assert.ok(ready);report.nativeVersion=ready.version;const originalBirth=birth();assert.ok(originalBirth);report.checks.nativeServiceStartedBeforeObserver=true;
  const directory=testRoot+'/observer',store=new SettingsStore(directory);store.initialize();const settings=store.read();
  settings.agents=[store.normalize({agentId:'existing-service',name:'Existing native OpenCode',adapter:'opencode',serverUrl:origin,passwordFile,workspace,executable,managed:false,inheritNativeCli:true},settings.deviceId)];settings.defaultAgent='existing-service';settings.connectOnStart=true;const expectedRevision=settings.revision;settings.revision++;store.write(settings,expectedRevision);
  observer=await startController(directory);
  report.throughOriginalController=true;
  const checked=await ipc(directory,{op:'check',agentId:'existing-service'});assert.equal(checked.connection,'connected');report.checks.originalClientContractConnected=true;
  const status=await ipc(directory,{op:'status'});assert.deepEqual(status.ownedNative,[]);report.checks.observerDoesNotOwnExistingNativeProcess=true;
  const tasks=await ipc(directory,{op:'tasks'});assert.ok(Array.isArray(tasks.items));assert.equal(tasks.items.length,0);report.checks.noTaskCreatedByAttach=true;
  await observer.close();observer=null;assert.equal(ended,false);assert.equal(birth(),originalBirth);await health();report.checks.originalServiceSurvivesObserverClose=true;
  observer=await startController(directory);const reopened=await ipc(directory,{op:'check',agentId:'existing-service'});assert.equal(reopened.connection,'connected');assert.equal(birth(),originalBirth);assert.equal(store.read().agents[0].managed,false);report.checks.sameExternalServiceReusedAfterReopen=true;
  const tasksAfter=await ipc(directory,{op:'tasks'});assert.equal(tasksAfter.items.length,0);report.checks.noTaskReplayedAfterReopen=true;
  await observer.close();observer=null;assert.equal(ended,false);assert.equal(birth(),originalBirth);await health();report.checks.externalServiceSurvivesBothObserverCloses=true;
  report.checks.nativeModelAndProviderConfigUnchanged=before===fingerprint();assert.equal(report.checks.nativeModelAndProviderConfigUnchanged,true);report.ok=Object.values(report.checks).every(Boolean);
 }catch(error){report.error={code:error.code||'EXISTING_SERVICE_ACCEPTANCE_FAILED'};}
 finally{
  await observer?.close();if(!ended)process.kill(-child.pid,'SIGTERM');const outcome=await Promise.race([closed,pause(5000).then(()=>null)]);report.acceptanceOwnerStoppedOwnService=!!outcome;report.nativeServiceExitObserved=!!outcome;report.finishedAt=new Date().toISOString();if(!outcome)report.ok=false;
  fs.writeFileSync(testRoot+'/result.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1;
 }
}
run().catch(error=>{console.log(JSON.stringify({error:error.code||'EXISTING_SERVICE_SETUP_FAILED'}));process.exitCode=1;});
