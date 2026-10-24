// Explicit real native MCP components; no parent model or native execution.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{spawn}=require('node:child_process'),{createHash}=require('node:crypto');
const [kind,bridgeArg,nativeArg,output,python,executable]=process.argv.slice(2);
const bridge=path.resolve(bridgeArg),nativeRoot=path.resolve(nativeArg);
if(!['pi','hermes'].includes(kind)||!output)throw Error('Native kind, frozen bridge, native source and output required');
const version=require('../package.json').version,runtime=name=>require(path.join(bridge,'desktop/electron',name));
const report={date:new Date().toISOString(),version,nodeVersion:process.version,nativeKind:kind,platform:process.platform,status:'running',modelCalls:0,nativeParentModel:false,
 evidence:'Unmodified native config loader and actual MCP client, frozen production Bridge, controlled discovered nodes, isolated native home; no real task or daily configuration',checks:[]};
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-native-policy-')),home=path.join(directory,'native'),cwd=path.join(directory,'project');
fs.mkdirSync(cwd,{recursive:true});fs.mkdirSync(home,{recursive:true});
const environment={...process.env,...(kind==='pi'?{PI_CODING_AGENT_DIR:home}:{HERMES_HOME:home,HERMES_RUNTIME_DIR:path.join(directory,'hermes-runtime'),HERMES_DISABLE_LAZY_INSTALLS:'1'})};
if(kind==='hermes')fs.writeFileSync(path.join(home,'config.yaml'),'# isolated native acceptance\n');
let fixture,host;const clients=[],dispatches=[];
async function piClient(){
 const load=file=>import(pathToFileURL(path.join(nativeRoot,file)).href);
 const [{loadMcpConfig},runtime,{FileAuthStorageBackend}]=await Promise.all([load('dist/extensions/mcp/config.js'),load('dist/extensions/mcp/runtime.js'),load('dist/core/auth-storage.js')]);
 const loaded=loadMcpConfig({agentDir:home,cwd,projectTrusted:false});assert.deepEqual(loaded.errors,[]);assert.equal(loaded.servers.length,1);
 const client=new runtime.McpServerConnection({entry:loaded.servers[0],cwd,createTransport:runtime.createDefaultTransport,credentials:new runtime.McpOAuthCredentialStore(new FileAuthStorageBackend(path.join(home,'mcp-auth.json')),home),onTools(){}});
 clients.push({close:()=>client.close()});await client.getClient();
 return {catalog:client.tools,call:(name,args={})=>client.callTool(name,args,{}),disable:async()=>{const file=path.join(home,'mcp.json'),config=JSON.parse(fs.readFileSync(file));config.mcpServers.agentbridge.enabled=false;fs.writeFileSync(file,JSON.stringify(config));}};
}
async function hermesClient(){
 const child=spawn(python,[path.join(__dirname,'hermes-mcp-native-driver.py'),nativeRoot],{env:environment,cwd,stdio:['pipe','pipe','pipe'],windowsHide:true}),pending=new Map();let serial=0,buffer='';child.stderr.resume();
 child.stdout.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let reply;try{reply=JSON.parse(line);}catch{continue;}const job=pending.get(reply.id);if(job){clearTimeout(job.timer);pending.delete(reply.id);reply.error?job.reject(Error('Native Hermes: '+reply.error)):job.resolve(reply.result);}}});
 const rejectAll=error=>{for(const job of pending.values()){clearTimeout(job.timer);job.reject(error);}pending.clear();};child.once('error',rejectAll);child.once('exit',()=>rejectAll(Error('Native driver exited')));
 const call=input=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('Original native response unconfirmed'));},45000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,...input})+'\n');});
 clients.push({close:async()=>{if(child.exitCode!==null)return;await call({action:'close'});child.stdin.end();if(child.exitCode===null)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Native process exit unconfirmed')),15000);child.once('exit',()=>{clearTimeout(timer);resolve();});});}});
 const connected=await call({action:'connect'});return {catalog:connected.catalog,call:(name,args={})=>call({action:'call',name,args}),disable:()=>call({action:'disable'})};
}
(async()=>{
 report.modules=Object.fromEntries(['machine-host.cjs','mcp-integration.cjs','mcp-client.cjs','agent-network.cjs','relation-state.cjs','connection-policy.cjs'].map(name=>{const file=path.join(bridge,'desktop/electron',name),value=hash(file);assert.equal(value,hash(path.join(__dirname,'../electron',name)));return [name,value];}));
 fixture=await require('./i06b-ui-fixture.cjs').graphFixture({nativeExecution:true,runtimeRoot:bridge,callerAdapter:kind});
 const snapshot=await fixture.router.snapshot(),leader=snapshot.nodes.find(n=>n.adapter===kind),[b,c]=snapshot.nodes.filter(n=>n.adapter==='opencode');assert(leader&&b&&c);
 const rpc=async(method,params={})=>{const reply=await fixture.call(method,params);assert.equal(reply.ok,true);return reply.result;};
 const old=await rpc('collaboration');assert.equal((await rpc('saveCollaboration',{operationId:'native-initial',expectedRevision:old.revision,leaderId:leader.nodeId,memberIds:[b.nodeId]})).state,'confirmed');
 const policy=async(ids,id)=>{const row=(await rpc('connectionPolicies')).relations.find(r=>r.leaderId===leader.nodeId);return rpc('saveConnectionPolicy',{operationId:id,relationId:row.relationId,leaderId:leader.nodeId,expectedRevision:row.revision,expectedPolicyRevision:row.envelope.revision,allowedNodeIds:ids});};
 const {MachineHost}=runtime('machine-host.cjs'),candidates=Object.fromEntries(['claude','codex','opencode','hermes','pi','dsh'].map(id=>[id,[]]));candidates[kind]=[kind==='pi'?path.join(nativeRoot,'dist/bundle/cli.js'):executable];
 host=new MachineHost({directory:path.join(directory,'bridge'),home:directory,environment,candidates,legacy:{close(){}},collaboration:(scope,name,args,callId)=>{dispatches.push(name);return fixture.router.collaborationTool(scope,name,args,callId,leader.machineId);}});
 const params={nodeId:leader.nodeId,adapter:kind},installed=await host.call('mcp.install',params),probe=await host.call('mcp.probe',params);assert.equal(installed.facts.config,'present');assert.equal(probe.facts.nativeLoad,'loaded');
 report.nativeVersion=probe.toolVersion|| (kind==='pi'?JSON.parse(fs.readFileSync(path.join(nativeRoot,'package.json'))).version:'fixed-source-vunknown');report.nativeLoad=probe.facts.nativeLoad;
 const connect=kind==='pi'?piClient:hermesClient,client=await connect();
 const catalog=client.catalog.map(t=>t.name).sort(),expected=['list_delegations','list_agents','list_connectable','connect_agent','disconnect_agent','delegate','task_result','task_pending','reply_task','cancel_task'].sort();assert.deepEqual(catalog,expected);report.tools=catalog;
 for(const name of ['connect_agent','disconnect_agent']){const schema=client.catalog.find(t=>t.name===name).inputSchema;assert.equal(schema.additionalProperties,false);assert.deepEqual(schema.required,['nodeId','operationId']);assert.equal(schema.properties.queryOnly.type,'boolean');}
 report.checks.push('Original native config loader and actual MCP client load exactly ten tools including bounded new schemas from frozen Bridge');
 const invoke=async(name,args={})=>{const value=await client.call(name,args);assert.notEqual(value.isError,true);return JSON.parse(value.content[0].text);};
 const error=async(name,args={})=>{try{const value=await client.call(name,args);assert.equal(value.isError,true);return JSON.parse(value.content[0].text).error?.code;}catch(e){if(e.code==='ERR_ASSERTION')throw e;return 'native-rejected';}};
 assert.deepEqual((await invoke('list_connectable')).items.map(n=>n.nodeId),[b.nodeId]);
 const before=dispatches.length;assert(await error('list_connectable',{nodeId:'forged-owner'}));assert(dispatches.length===before||dispatches.length===before+1);assert.equal((fixture.router.network.connectionOperations||[]).length,0); // native or backend schema rejection grants nothing
 assert(await error('decideConnection',{approvalId:'forged',decision:'allow'}));
 report.checks.push('Native list_connectable is limited to own preauthorization; forged scope fields and user-only approval method are rejected');
 assert.equal((await policy([b.nodeId,c.nodeId],'native-preauthorize')).state,'confirmed');
 const args={operationId:'native-connect-original',nodeId:c.nodeId},grant=await invoke('connect_agent',args);assert.equal(grant.state,'confirmed');
 assert.deepEqual(await invoke('connect_agent',args),grant);assert.deepEqual(await invoke('connect_agent',{...args,queryOnly:true}),grant);
 assert.equal(await error('connect_agent',{...args,nodeId:b.nodeId}),'OPERATION_CONFLICT');
 assert.equal((await invoke('disconnect_agent',{operationId:'native-disconnect-original',nodeId:c.nodeId})).state,'confirmed');
 assert.equal((await invoke('list_connectable')).items.find(n=>n.nodeId===c.nodeId).connected,false);
 assert(!((await invoke('list_agents')).items.some(n=>n.nodeId===c.nodeId)));
 report.checks.push('Native connect/disconnect honor original ID and fingerprint, expose historical receipt without replay and retain preauthorization after disconnect');
 assert.equal((await policy([b.nodeId],'native-revoke-range')).state,'confirmed');
 const request={operationId:'native-outside-original',nodeId:c.nodeId};assert.equal((await invoke('connect_agent',request)).state,'pending_approval');
 const view=await rpc('connectionPolicies');assert(view.pending.length===1);assert.equal((await invoke('connect_agent',{...request,queryOnly:true})).state,'pending_approval');
 assert.equal((await invoke('connect_agent',{...request,operationId:'native-outside-alias'})).state,'rejected');
 const row=view.relations.find(r=>r.leaderId===leader.nodeId);assert.equal((await rpc('decideConnection',{operationId:'native-user-allow',approvalId:view.pending[0].approvalId,decision:'allow',expectedPolicyRevision:row.envelope.revision})).state,'confirmed');
 assert.equal((await invoke('connect_agent',{...request,queryOnly:true})).state,'confirmed');assert((await invoke('list_agents')).items.some(n=>n.nodeId===c.nodeId));
 report.checks.push('Outside-envelope native request grants nothing and cannot use a new ID to bypass confirmation; explicit isolated human decision settles the original native query');
 await client.disable();assert.equal((await host.call('mcp.status',params)).facts.config,'disabled');await assert.rejects(host.call('mcp.install',params),{code:'MCP_NATIVE_DISABLED'});
 assert.equal((await invoke('list_connectable')).canManage,true);
 await host.call('mcp.revoke',params);assert.equal(await error('connect_agent',{...request,queryOnly:true}),'MCP_REVOKED');
 const fresh=await host.call('mcp.install',params).catch(e=>{if(e.code!=='MCP_NATIVE_DISABLED')throw e;return null;});assert.equal(fresh,null);
 report.checks.push('Native disable remains disabled and cannot be silently reinstalled; explicit revoke blocks cached native reads of original operations');
 // Removal must be explicit before recreating a disabled native entry.
 await host.call('mcp.remove',params);const replacement=await host.call('mcp.install',params);assert.notEqual(replacement.connectionId,installed.connectionId);
 const next=await connect();assert.deepEqual(next.catalog.map(t=>t.name).sort(),expected);
 const missing=await next.call('connect_agent',{...request,queryOnly:true});assert.notEqual(missing.isError,true);assert.equal(JSON.parse(missing.content[0].text).state,'not_found');
 assert.equal(await error('list_connectable'),'MCP_REVOKED');
 const retained=fixture.router.network.connectionOperations.find(op=>op.operationId===request.operationId);assert.equal(retained.state,'confirmed');
 await host.call('mcp.remove',params);const denied=await next.call('list_connectable',{});assert.equal(denied.isError,true);assert.match(denied.content[0].text,/MCP_REVOKED/);
 report.checks.push('Explicit remove/reinstall rotates identity; fresh native client cannot inherit old operation receipts and old client remains revoked; final removal revokes fresh cached calls');
 assert.equal(fixture.router.network.requests.length,0);assert.equal(fixture.router.network.delegations.length,0);assert.equal([...fixture.hosts.values()].flatMap(h=>h.tasks).length,0);
 report.checks.push('All connection operations leave controlled native tasks, requests and delegations at zero; no daily files, native credentials or real relationships are used');report.status='passed';
})().catch(error=>{report.status='failed';report.error={code:error.code||'ACCEPTANCE_FAILED',message:error.message,stack:error.stack};process.exitCode=1;})
.finally(async()=>{for(const client of clients.reverse())try{await client.close();}catch{report.cleanupPending=true;}host?.close();if(!report.cleanupPending){fixture?.close();fs.rmSync(directory,{recursive:true,force:true,maxRetries:8,retryDelay:200});}fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
