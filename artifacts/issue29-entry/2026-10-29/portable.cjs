const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),{spawn}=require('child_process');
const repo=path.resolve(__dirname,'../../..'),{CoordinatorClient}=require(path.join(repo,'desktop/electron/coordinator-client.cjs'));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-alpha71-portable-')),exe=path.join(repo,'desktop/release/AgentBridge-0.6.0-alpha.71-Windows-x64.exe');
const report={date:new Date().toISOString(),version:'0.6.0-alpha.71',scope:'ordinary portable EXE without debugging, isolated synthetic profile; no production profile or SSH',status:'running',modelCalls:0};let child,client;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const env={...process.env,AGENTBRIDGE_DESKTOP_PROFILE:directory};delete env.ELECTRON_RUN_AS_NODE;
 child=spawn(exe,[],{env,windowsHide:true,stdio:'ignore'});child.on('error',()=>{});client=new CoordinatorClient({directory});
 const start=Date.now(),deadline=start+420000;while(true){try{await client.attach();break;}catch(e){if(!['ENOENT','ECONNREFUSED','COORDINATOR_TRANSPORT'].includes(e.code)||Date.now()>deadline)throw e;await wait(100);}}
 assert.equal((await client.request('preferences')).version,report.version);assert(client.info.capabilities.includes('ssh-daemon-replacement-v1'));
 const snapshot=await client.request('call',{method:'snapshot',params:{}});assert.equal(snapshot.ok,true);assert.equal(snapshot.result.daemonManagement,true);
 report.startupMs=Date.now()-start;report.coordinatorVersionMatches=true;report.maintenanceSupported=true;
 await client.request('shutdown');client.close();report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code||'VERIFY_FAILED',message:e.message};process.exitCode=1;}).finally(async()=>{
 try{if(client?.socket&&!client.socket.destroyed)await client.request('shutdown');}catch{}client?.close();
 const deadline=Date.now()+10000;while(child&&child.exitCode===null&&Date.now()<deadline)await wait(100);
 report.wrapperExited=!!child&&child.exitCode!==null;if(child?.exitCode===null)child.kill();
 fs.writeFileSync(path.join(__dirname,'portable.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
});
