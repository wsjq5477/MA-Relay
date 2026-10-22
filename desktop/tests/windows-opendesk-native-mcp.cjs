// Installed, unmodified OpenDesk MCP worker/client component; controlled parent, no GUI or model.
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads'),{pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
const [bridge,nativeArchive,chunkName,output]=process.argv.slice(2);
if(process.platform!=='win32'||!output)throw Error('Windows Node, packaged Bridge, installed archive, native chunk, report required');
const {MachineHost}=require(path.join(bridge,'desktop/electron/machine-host.cjs'));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-opendesk-native-mcp-')),nativeHome=path.join(directory,'native');
const environment={...process.env,OPENDESK_CONFIG_DIRECTORY:nativeHome};
const report={date:new Date().toISOString(),bridgeVersion:'0.6.0-alpha.46',nativeVersion:'0.3.9',environment:'unmodified installed OpenDesk MCP worker component / controlled parent / isolated native profile',modelCalls:0,status:'running',checks:[]};
let host,worker,sequence=0;const calls=[],pending=new Map();
const newHost=()=>new MachineHost({directory:path.join(directory,'bridge'),home:directory,environment,legacy:{close(){}},
  collaboration:async(scope,name,args)=>{calls.push({scope,name,args});return {items:[]};}});
const params={nodeId:'native-opendesk',adapter:'opendesk-desktop'};
async function rpc(method,args=[]){const id=++sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('Native component timeout: '+method));},30000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});worker.postMessage({id,method,args});});}
(async()=>{
  host=newHost();const installed=await host.call('mcp.install',params);
  assert.equal(installed.launcher,'node','real system Node required by native client');
  const entry=JSON.parse(fs.readFileSync(installed.configPath)).applications.mcpmgr.servers[0];
  const chunk=path.join(nativeArchive,'dist/main/chunks',chunkName);
  report.nativeChunkSha256=createHash('sha256').update(fs.readFileSync(chunk)).digest('hex');
  worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');
    (async()=>{const api=await import(workerData.module);const platform=new api.W();api.ah(platform);
    const App=platform.getApplicationClasses().find(C=>new C().bundleName==='mcpmgr');if(!App)throw Error('Native MCP application not found');
    const Client=App.getWorkerClass(),client=new Client('mcpmgr',workerData.home);await client.initialize();
    parentPort.on('message',async m=>{try{const value=await client.handleMessage(m.method,...m.args);parentPort.postMessage({id:m.id,value});}catch(e){parentPort.postMessage({id:m.id,error:e.message});}});
    parentPort.postMessage({ready:true});})().catch(e=>parentPort.postMessage({fatal:e.message}));`,
    {eval:true,env:{...environment,ELECTRON_RUN_AS_NODE:'1'},workerData:{module:pathToFileURL(chunk).href,home:nativeHome,paths:{opendeskDirectory:nativeHome},setting:{applications:{},network_config:{use_proxy:'none'}}},stdout:true,stderr:true});
  const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Native worker boot timeout')),30000);worker.on('message',m=>{if(m.ready){clearTimeout(timer);resolve();}if(m.fatal){clearTimeout(timer);reject(Error(m.fatal));}if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.value);}});worker.on('error',reject);});
  // Native logs are consumed, not copied: they can include native user settings.
  worker.stdout.resume();worker.stderr.resume();await ready;
  await rpc('applicationConfigChanged',[{servers:[entry]}]);
  let tools=[];for(let i=0;i<80;i++){tools=await rpc('getDiscoveredTools');if(tools.length===7)break;await new Promise(r=>setTimeout(r,250));}
  assert.equal(tools.length,7);assert(tools.some(t=>t.name==='list_agents'));
  const call=()=>rpc('callMcpTool',['agentbridge','list_agents',{}]);
  assert.deepEqual(JSON.parse(await call()),{items:[]});assert.equal(calls[0].scope.nodeId,params.nodeId);
  report.checks.push('Native installed MCP client reads Bridge-written entry, connects, discovers seven tools and calls list_agents with real connection authorization');
  const native=JSON.parse(fs.readFileSync(installed.configPath));delete native.applications.mcpmgr.servers;
  fs.writeFileSync(installed.configPath,JSON.stringify(native));
  const deleted=await host.call('mcp.status',params);assert.equal(deleted.facts.config,'absent');assert.equal(deleted.facts.authorization,'valid');
  assert.deepEqual(JSON.parse(await call()),{items:[]});
  report.checks.push('Deleting the native config does not falsely revoke a cached native client');
  const bytes=fs.readFileSync(installed.configPath,'utf8');host.close();host=newHost();await host.mcpReady;
  assert.equal(fs.readFileSync(installed.configPath,'utf8'),bytes);assert.deepEqual(JSON.parse(await call()),{items:[]});
  report.checks.push('Bridge host restart restores the same authorized endpoint without reinstalling deleted native config');
  await host.call('mcp.revoke',params);assert.equal(JSON.parse(await call()).error.code,'MCP_REVOKED');
  const fresh=await host.call('mcp.install',params);assert.notEqual(fresh.connectionId,installed.connectionId);
  assert.equal(JSON.parse(await call()).error.code,'MCP_REVOKED');
  await rpc('applicationConfigChanged',[{servers:[]}]);assert.equal((await rpc('getDiscoveredTools')).length,0);
  const freshEntry=JSON.parse(fs.readFileSync(fresh.configPath)).applications.mcpmgr.servers[0];
  await rpc('applicationConfigChanged',[{servers:[freshEntry]}]);
  for(let i=0;i<80;i++){tools=await rpc('getDiscoveredTools');if(tools.length===7)break;await new Promise(r=>setTimeout(r,250));}
  assert.deepEqual(JSON.parse(await call()),{items:[]});
  report.checks.push('Revocation rejects the already-connected native client; reinstallation rotates identity and only the new native entry works');
  await host.call('mcp.remove',params);await rpc('applicationConfigChanged',[{servers:[]}]);assert.equal((await rpc('getDiscoveredTools')).length,0);
  report.checks.push('Bridge removal revokes authorization and native reload removes all seven Bridge tools');
  await rpc('finalize');report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code,message:e.message};process.exitCode=1;}).finally(async()=>{
  if(worker)await worker.terminate();host?.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
});
