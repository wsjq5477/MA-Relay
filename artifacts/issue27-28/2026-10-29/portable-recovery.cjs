// Ordinary portable EXE, isolated synthetic profile, no model/native execution.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{createHash}=require('node:crypto');
const repo=path.resolve(__dirname,'../../..'),{CoordinatorClient}=require(path.join(repo,'desktop/electron/coordinator-client.cjs'));
const {digest}=require(path.join(repo,'desktop/electron/graph-layout.cjs'));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-issues27-28-portable-'));
const exe=path.join(repo,'desktop/release/AgentBridge-0.6.0-alpha.70-Windows-x64.exe');
const {record,bytes}=require('./runtime-fixture.cjs').makeProfile(directory);
const file=path.join(directory,'agent-network.json');
const report={date:new Date().toISOString(),version:'0.6.0-alpha.70',environment:'Windows ordinary portable EXE / actual coordinator pipe / synthetic profile',modelCalls:0,checks:[],status:'running'};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));let wrapper,main,client;
const ps=command=>new Promise((resolve,reject)=>execFile(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:20000},(error,out)=>error?reject(error):resolve(out.trim())));
async function launch(){
  const start=Date.now(),env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:directory};delete env.ELECTRON_RUN_AS_NODE;
  wrapper=spawn(exe,[],{env,stdio:'ignore'});wrapper.on('error',()=>{});
  const deadline=Date.now()+420000;
  while(Date.now()<deadline){
    if(fs.existsSync(path.join(directory,'coordinator-status.json'))){
      const c=new CoordinatorClient({directory});
      try{await c.attach();assert.equal(c.info.version,report.version);assert(c.info.capabilities.includes('relation-recovery-observations-v2'));assert(c.info.capabilities.includes('ssh-current-observation-v1'));client=c;
        const text=await ps(`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${wrapper.pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;title=(Get-Process -Id $_.ProcessId).MainWindowTitle;debug=($_.CommandLine -match 'remote-debugging|--inspect')}} | ConvertTo-Json -Compress`);
        const parsed=text?JSON.parse(text):[],found=(Array.isArray(parsed)?parsed:[parsed]).find(row=>row.title==='AgentBridge');
        if(found){assert.equal(found.debug,false);main=found;report.checks.push({name:'ordinary-window-open',elapsedMs:Date.now()-start});return;}
        client.close();client=null;
      }catch(error){c.close();if(!['ENOENT','ECONNREFUSED','COORDINATOR_TRANSPORT'].includes(error.code))throw error;}
    }
    await delay(1000);
  }
  throw Error('Portable window did not become ready in test budget');
}
async function closeWindow(){
  if(!main)return;
  assert.equal(main.parent,wrapper.pid);
  const result=await ps(`$p=Get-Process -Id ${main.pid}; if($p.MainWindowTitle -ne 'AgentBridge'){throw 'Window identity changed'}; $p.CloseMainWindow()`);
  assert.equal(result,'True');const until=Date.now()+60000;
  while(wrapper.exitCode===null&&Date.now()<until)await delay(250);
  assert.notEqual(wrapper.exitCode,null);main=null;
}
async function call(method,params={}){const reply=await client.request('call',{method,params});assert.equal(reply.ok,true,JSON.stringify(reply.error));return reply.result;}
(async()=>{
  await launch();report.checks.push('Original 13→15 conflict and node observation retained by ordinary startup');assert.deepEqual(fs.readFileSync(file),bytes);
  const view=await call('relationRecovery.inspect');assert.equal(view.proposal.revisionTo,15);assert.deepEqual(fs.readFileSync(file),bytes);
  const params={operationId:'synthetic-recovery',sourceDigest:view.proposal.sourceDigest,confirm:true};
  const receipt=await call('relationRecovery.confirm',params);assert.deepEqual(fs.readFileSync(path.join(directory,receipt.backup)),bytes);
  const saved=JSON.parse(fs.readFileSync(file));assert.deepEqual(saved.requests,record.requests);assert.deepEqual(saved.relationOperations,record.relationOperations);assert.equal(saved.relations[0].revision,15);
  assert.deepEqual(await call('relationRecovery.confirm',params),receipt);report.checks.push('Actual packaged coordinator performs backup, confirmed recovery and original-ID idempotency; original unknown and receipts retained');
  const first=client.info.pid;await closeWindow();assert.equal(client.socket.destroyed,false);await client.request('shutdown');client.close();client=null;
  const until=Date.now()+30000;while(Date.now()<until){try{process.kill(first,0);}catch{break;}await delay(200);}
  await launch();assert.notEqual(client.info.pid,first);assert.equal((await call('snapshot')).collaboration.revision,15);
  // Inspect must remain before any normal network activation in this test.
  assert.deepEqual(JSON.parse(fs.readFileSync(file)).requests,record.requests);report.checks.push('Ordinary window and full coordinator restart keep recovered relations and original unknown without replay');
  await closeWindow();await client.request('shutdown');client.close();client=null;report.status='passed';
})().catch(error=>{report.status='failed';report.error={code:error.code||'VERIFY_FAILED',message:error.message};process.exitCode=1;}).finally(async()=>{
  try{await closeWindow();}catch{}try{await client?.request('shutdown');}catch{}client?.close();
  report.portable={bytes:fs.statSync(exe).size,sha256:createHash('sha256').update(fs.readFileSync(exe)).digest('hex')};
  fs.writeFileSync(path.join(__dirname,'portable.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
});
