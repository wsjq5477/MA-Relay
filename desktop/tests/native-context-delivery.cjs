// Explicit component acceptance: native Pi -> native Hermes MCP clients, no parent models.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{spawn}=require('node:child_process'),{createHash}=require('node:crypto');
const [bridgeArg,piArg,hermesArg,python,output]=process.argv.slice(2),bridge=path.resolve(bridgeArg),piRoot=path.resolve(piArg),hermesRoot=path.resolve(hermesArg);
if(!output||!python)throw Error('Frozen bridge, native Pi/Hermes sources, Python and output required');
const runtime=name=>require(path.join(bridge,'desktop/electron',name)),version=JSON.parse(fs.readFileSync(path.join(bridge,'../linux-package/manifest.json'))).version;
const report={date:new Date().toISOString(),version,platform:process.platform,node:process.version,status:'running',modelCalls:0,nativeParentModel:false,evidence:'Retained native Pi and fixed-source Hermes config loaders/MCP clients, frozen production Coordinator/SQLite, disposable work and homes; no managed native task, file transfer or daily config',checks:[]};
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-native-context-')),piHome=path.join(directory,'pi'),hermesHome=path.join(directory,'hermes'),cwd=path.join(directory,'project');
for(const dir of [piHome,hermesHome,cwd])fs.mkdirSync(dir,{recursive:true});
let service,pi,hermes;const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function openPi(configuration){
 fs.writeFileSync(path.join(piHome,'mcp.json'),JSON.stringify({mcpServers:{agentbridge:{...configuration,enabled:true}}}));
 const load=file=>import(pathToFileURL(path.join(piRoot,file)).href),[{loadMcpConfig},r,{FileAuthStorageBackend}]=await Promise.all([load('dist/extensions/mcp/config.js'),load('dist/extensions/mcp/runtime.js'),load('dist/core/auth-storage.js')]);
 const loaded=loadMcpConfig({agentDir:piHome,cwd,projectTrusted:false});assert.equal(loaded.errors.length,0);assert.equal(loaded.servers.length,1);
 const client=new r.McpServerConnection({entry:loaded.servers[0],cwd,createTransport:r.createDefaultTransport,credentials:new r.McpOAuthCredentialStore(new FileAuthStorageBackend(path.join(piHome,'mcp-auth.json')),piHome),onTools(){}});
 pi={close:()=>client.close(),catalog:[],call:(name,args)=>client.callTool(name,args,{})};await client.getClient();pi.catalog=client.tools;return pi;
}
async function openHermes(configuration){
 // JSON is valid YAML; no credentials/native daily settings are copied.
 fs.writeFileSync(path.join(hermesHome,'config.yaml'),JSON.stringify({mcp_servers:{agentbridge:{...configuration,enabled:true}}}));
 const child=spawn(python,[path.join(__dirname,'hermes-mcp-native-driver.py'),hermesRoot],{cwd,env:{...process.env,HERMES_HOME:hermesHome,HERMES_RUNTIME_DIR:path.join(directory,'hermes-runtime'),HERMES_DISABLE_LAZY_INSTALLS:'1',PYTHONDONTWRITEBYTECODE:'1'},stdio:['pipe','pipe','pipe']}),pending=new Map();let serial=0,buffer='';child.stderr.resume();
 const fail=()=>{for(const job of pending.values()){clearTimeout(job.timer);job.reject(Error('Original Hermes component exited'));}pending.clear();};child.once('error',fail);child.once('exit',fail);
 child.stdout.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let reply;try{reply=JSON.parse(line);}catch{continue;}const job=pending.get(reply.id);if(job){clearTimeout(job.timer);pending.delete(reply.id);if(reply.error)job.reject(Error('Native Hermes component rejected request'));else job.resolve(reply.result);}}});
 const request=input=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('Original Hermes response remains unconfirmed'));},45000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,...input})+'\n');});
 hermes={call:(name,args)=>request({action:'call',name,args}),catalog:[],async close(){if(child.exitCode!==null)return;await request({action:'close'});child.stdin.end();if(child.exitCode===null)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Original Hermes exit unconfirmed')),15000);child.once('exit',()=>{clearTimeout(timer);resolve();});});}};
 hermes.catalog=(await request({action:'connect'})).catalog;return hermes;
}
(async()=>{
 const freeze=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../artifacts/context-delivery/2026-10-25/source-manifest.json'))),backend=freeze.filter(x=>x.path.startsWith('desktop/electron/')&&x.path.endsWith('.cjs'));
 for(const row of backend)assert.equal(hash(path.join(bridge,row.path)),row.sha256,'Frozen production backend mismatch');report.frozenBackendFiles=backend.length;
 const provenance=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../artifacts/native-policy/2026-10-25/native-provenance.json')));
 for(const [kind,root] of [['pi',piRoot],['hermes',hermesRoot]])for(const [file,expected]of Object.entries(provenance[kind].criticalFilesEqualArchive))assert.equal(hash(path.join(root,file)),expected,'Retained native source mismatch');
 report.native={pi:{version:JSON.parse(fs.readFileSync(path.join(piRoot,'package.json'))).version,verifiedFiles:5},hermes:{ref:provenance.hermes.ref,verifiedFiles:8,version:'fixed-source-unknown'}};
 report.checks.push('All frozen Bridge backend files and 5 Pi / 8 fixed-source Hermes pins match retained provenance');
 const options={directory,network:{close(){},node(){throw Error('No native task authorized by this component test');}}};service=runtime('coordinator-service.cjs').createCoordinatorService(options);let serial=0;
 const call=async(method,p={})=>{const r=await service.call({method:'team.'+method,params:{operationId:'setup-'+ ++serial,...p}});assert.equal(r.ok,true,r.error?.code);return r.result;};
 const a=await call('registerAgent',{kind:'mcp',externalKey:'isolated-pi',name:'Pi发送者',purpose:'读取选定旧版'}),b=await call('registerAgent',{kind:'mcp',externalKey:'isolated-hermes',name:'Hermes接收者',purpose:'确认原包'}),team=await call('createTeam',{name:'原生组件传递',leaderId:a.agentId,memberIds:[a.agentId,b.agentId]}),run=await call('createRun',{teamId:team.teamId,name:'隔离工作',goal:'原包实际传递',acceptance:'接收声明不代替业务验收'});
 const doc=await call('writeDocument',{runId:run.runId,title:'原文',content:'NATIVE_COMPONENT_SELECTED_V1',expectedRevision:0});await call('writeDocument',{runId:run.runId,documentId:doc.documentId,title:'新文',content:'NATIVE_COMPONENT_UNSELECTED_V2',expectedRevision:1});
 const ca=await call('connect',{runId:run.runId,agentId:a.agentId}),cb=await call('connect',{runId:run.runId,agentId:b.agentId});await openPi(ca.configuration);await openHermes(cb.configuration);
 for(const c of [pi,hermes]){assert.equal(c.catalog.length,22);for(const name of ['team_send_context','team_context_transfers','team_context_transfer','team_ack_context'])assert(c.catalog.some(t=>t.name===name));}
 report.checks.push('Unmodified native configuration loaders and actual Pi/Hermes MCP clients both discover all 22 Team tools');
 const invoke=async(c,name,args={})=>{const r=await c.call(name,args);assert.notEqual(r.isError,true,'Native tool returned an error');return JSON.parse(r.content[0].text);};
 const selection={targetAgentId:b.agentId,selections:{documents:[{documentId:doc.documentId,revision:1}]}},packet=await invoke(pi,'team_context_packet',selection);assert.equal(packet.documents[0].content,'NATIVE_COMPONENT_SELECTED_V1');assert.equal(packet.documents[0].currentRevision,2);
 const sent={operationId:'native-original-send',packetId:packet.packetId,...selection},transfer=await invoke(pi,'team_send_context',sent);assert.equal(transfer.stage,'pending_receipt');assert(!Object.hasOwn(transfer,'deliveryProof'));
 const listed=await invoke(hermes,'team_context_transfers');assert.equal(listed.items[0].transferId,transfer.transferId);
 const got=await invoke(hermes,'team_context_transfer',{transferId:transfer.transferId});assert.equal(got.packet.documents[0].content,'NATIVE_COMPONENT_SELECTED_V1');assert.equal(got.packet.packetId,packet.packetId);assert(got.deliveryProof?.length===64,'Only recipient gets the private receipt challenge');
 report.checks.push('Native Pi selects exact v1 while current source is v2 and persists it; actual native Hermes lists and retrieves the same immutable packet');
 const ack={operationId:'native-original-ack',transferId:transfer.transferId,packetId:packet.packetId,deliveryProof:got.deliveryProof,contentSha256:runtime('graph-layout.cjs').digest(got.packet)},confirmed=await invoke(hermes,'team_ack_context',ack);assert.equal(confirmed.stage,'acknowledged');assert.equal(confirmed.businessAccepted,false);assert.equal((await invoke(pi,'team_context_transfers')).items[0].stage,'acknowledged');
 report.checks.push('Native Hermes submits a matching original-packet receipt; native Pi observes acknowledgement without business acceptance or execution');
 await pi.close();pi=null;await hermes.close();hermes=null;service.close();service=runtime('coordinator-service.cjs').createCoordinatorService(options);await openPi(ca.configuration);await openHermes(cb.configuration);
 assert.deepEqual(await invoke(pi,'team_send_context',sent),transfer);assert.deepEqual(await invoke(hermes,'team_ack_context',ack),confirmed);assert.equal((await invoke(pi,'team_operation',{operationId:sent.operationId})).data.transferId,transfer.transferId);assert.equal((await invoke(hermes,'team_context_transfers')).items.length,1);
 report.checks.push('Both native clients and the broker/SQLite reopen with original config; original send/ack receipts survive without duplicate transfers');
 await call('revokeMember',{runId:run.runId,agentId:b.agentId,expectedRevision:1});for(const [name,args]of [['team_context_transfer',{transferId:transfer.transferId}],['team_ack_context',ack]]){const r=await hermes.call(name,args);assert.equal(r.isError,true);assert.equal(JSON.parse(r.content[0].text).error.code,'TEAM_FORBIDDEN');}
 const audit=await call('contextTransfers',{runId:run.runId});assert.equal(audit.items[0].recipientAuthorized,false);assert.equal(audit.items[0].stage,'acknowledged');const context=await call('context',{runId:run.runId});assert.equal(context.attempts.length,0);assert.equal(context.workItems.length,0);
 report.checks.push('Revoked native recipient cannot read or replay acknowledgement with its cached proof; historical receipt remains, attempts/tasks remain zero');
 report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code||'COMPONENT_FAILED',message:e.message};process.exitCode=1;}).finally(async()=>{for(const client of [pi,hermes])try{await client?.close();}catch{report.cleanupPending=true;}if(report.cleanupPending){report.status='cleanup_pending';process.exitCode=1;}else{service?.close();fs.rmSync(directory,{recursive:true,force:true,maxRetries:8,retryDelay:200});report.checks.push('Original native clients exited and isolated homes/work/broker were removed; no daily settings or credentials changed');}fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
