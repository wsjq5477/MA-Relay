const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process'),{createInterface}=require('node:readline');
const runtimeRoot=process.env.AGENTBRIDGE_VERIFY_RELATION_RUNTIME;
const runtime=name=>require(runtimeRoot?path.join(runtimeRoot,'desktop/electron',name):path.join(__dirname,'../electron',name));
const {graphFixture}=require('./i06b-ui-fixture.cjs');
async function setup(t){
 const f=await graphFixture({nativeExecution:true,runtimeRoot}),cleaners=[];t.after(async()=>{for(const clean of cleaners.reverse())await clean();f.close();});
 const nodes=(await f.router.snapshot()).nodes,a=nodes.find(n=>n.adapter==='claude'),[b,c]=nodes.filter(n=>n.adapter==='opencode');assert(c);
 const call=async(method,params={})=>{const result=await f.call(method,params);if(!result.ok)throw Object.assign(Error(result.error.message),result.error);return result.result;};
 await call('saveCollaboration',{operationId:'initial-parent',leaderId:a.nodeId,memberIds:[b.nodeId],expectedRevision:0});
 const tool=(name,args={},node=a,connection='original-connection')=>f.router.collaborationTool({nodeId:node.nodeId,externalConnectionId:connection},name,args,'controlled-call',node.machineId);
 const view=()=>call('connectionPolicies');
 const policy=async(ids,operationId='save-policy')=>{const row=(await view()).relations.find(r=>r.leaderId===a.nodeId);return call('saveConnectionPolicy',{operationId,relationId:row.relationId,leaderId:a.nodeId,expectedRevision:row.revision,expectedPolicyRevision:row.envelope.revision,allowedNodeIds:ids});};
 const decide=async(decision,operationId='human-decision',revision)=>{const state=await view(),op=state.pending[0],row=state.relations.find(r=>r.relationId===f.router.network.relations.find(r=>r.leaderId===a.nodeId).relationId);return call('decideConnection',{operationId,approvalId:op.approvalId,decision,expectedPolicyRevision:revision??row.envelope.revision});};
 return {...f,a,b,c,call,tool,view,policy,decide,cleaners};
}
test('legacy member grants become the exact initial preauthorization, never global discovery',async t=>{
 const f=await setup(t),before=structuredClone(f.router.network.relations),list=await f.tool('list_connectable');
 assert.deepEqual(list.items.map(n=>n.nodeId),[f.b.nodeId]);assert.equal(list.items[0].connected,true);assert.equal(list.canManage,true);
 assert.deepEqual(f.router.network.relations,before);assert.equal(f.router.network.requests.length,0);
});
test('preauthorized connect/disconnect only change this outgoing grant; disconnect preserves original delegated task ownership',async t=>{
 const f=await setup(t);assert.equal((await f.policy([f.b.nodeId,f.c.nodeId])).state,'confirmed');
 assert.equal((await f.tool('connect_agent',{operationId:'connect-c',nodeId:f.c.nodeId})).state,'confirmed');
 const task=await f.tool('delegate',{requestId:'original-child',nodeId:f.c.nodeId,message:'controlled child'});
 const receipt=await f.tool('disconnect_agent',{operationId:'disconnect-c',nodeId:f.c.nodeId});assert.equal(receipt.state,'confirmed');
 assert(!(await f.tool('list_agents')).items.some(n=>n.nodeId===f.c.nodeId));
 assert((await f.tool('list_connectable')).items.some(n=>n.nodeId===f.c.nodeId&&!n.connected));
 assert.equal((await f.tool('task_result',{taskId:task.taskId})).taskId,task.taskId);assert.equal(f.router.network.requests.length,1);
 assert.equal((await f.tool('connect_agent',{operationId:'reconnect-c',nodeId:f.c.nodeId})).state,'confirmed');assert.equal(f.router.network.requests.length,1);
});
test('outside-envelope request grants nothing until a matching human decision, with original receipt lookup',async t=>{
 const f=await setup(t),args={operationId:'outside-c',nodeId:f.c.nodeId};const first=await f.tool('connect_agent',args);
 assert.equal(first.state,'pending_approval');assert(!(await f.tool('list_agents')).items.some(n=>n.nodeId===f.c.nodeId));
 const bytes=fs.readFileSync(f.router.networkFile);assert.deepEqual(await f.tool('connect_agent',{...args,queryOnly:true}),first);assert.deepEqual(fs.readFileSync(f.router.networkFile),bytes);
 assert.equal((await f.decide('allow')).state,'confirmed');const settled=await f.tool('connect_agent',{...args,queryOnly:true});assert.equal(settled.state,'confirmed');
 assert((await f.tool('list_agents')).items.some(n=>n.nodeId===f.c.nodeId));assert.equal(f.router.network.requests.length,0);assert.equal(f.router.network.delegations.length,0);
});
test('human denial settles only the original connection request and never claims a task cancellation',async t=>{
 const f=await setup(t);await f.tool('connect_agent',{operationId:'outside',nodeId:f.c.nodeId});
 assert.equal((await f.decide('reject')).state,'confirmed');const result=await f.tool('connect_agent',{operationId:'outside',nodeId:f.c.nodeId,queryOnly:true});
 assert.equal(result.state,'rejected');assert.equal(result.error.code,'CONNECTION_USER_REJECTED');assert.equal(f.router.network.requests.length,0);assert.equal(f.router.network.delegations.length,0);
});
test('child role cannot create a main role or approval request, and queries cannot read another owner receipt',async t=>{
 const f=await setup(t);assert.equal((await f.tool('list_connectable',{},f.b)).block,'not_leader');
 await assert.rejects(f.tool('connect_agent',{operationId:'child-attempt',nodeId:f.c.nodeId},f.b),{code:'COLLABORATION_FORBIDDEN'});
 await f.tool('connect_agent',{operationId:'same-id',nodeId:f.c.nodeId});
 assert.equal((await f.tool('connect_agent',{operationId:'same-id',nodeId:f.c.nodeId,queryOnly:true},f.a,'different-connection')).state,'not_found');
 const duplicate=await f.tool('connect_agent',{operationId:'replacement-id',nodeId:f.c.nodeId},f.a,'different-connection');assert.equal(duplicate.state,'rejected');assert.equal(duplicate.error.code,'CONNECTION_PENDING_APPROVAL');assert.equal((await f.view()).pending.length,1);
});
test('target/action/identity forgery and operation-ID content reuse are refused without changing original records',async t=>{
 const f=await setup(t);await f.tool('connect_agent',{operationId:'original',nodeId:f.c.nodeId});const before=fs.readFileSync(f.router.networkFile);
 await assert.rejects(f.tool('disconnect_agent',{operationId:'original',nodeId:f.c.nodeId}),{code:'OPERATION_CONFLICT'});
 for(const extra of [{relationId:'other'},{sourceNodeId:f.b.nodeId},{leaderId:f.b.nodeId}])await assert.rejects(f.tool('connect_agent',{operationId:'forged',nodeId:f.c.nodeId,...extra}),{code:'INVALID_INPUT'});
 assert.deepEqual(fs.readFileSync(f.router.networkFile),before);
});
test('policy/decision revision conflicts retain the pending request and do not auto-approve',async t=>{
 const f=await setup(t);await f.tool('connect_agent',{operationId:'outside',nodeId:f.c.nodeId});const old=(await f.view()).relations[0].envelope.revision;
 await f.policy([f.b.nodeId,f.c.nodeId]);const decision=await f.decide('allow','stale-decision',old);assert.equal(decision.state,'rejected');assert.equal(decision.error.code,'REVISION_CONFLICT');
 assert.equal((await f.tool('connect_agent',{operationId:'outside',nodeId:f.c.nodeId,queryOnly:true})).state,'pending_approval');
 assert.equal((await f.decide('allow','reviewed-decision')).state,'confirmed');
});
test('human revocation removes the current connection and preauthorization while historical confirmation never reconnects it',async t=>{
 const f=await setup(t);await f.policy([f.b.nodeId,f.c.nodeId]);const original=await f.tool('connect_agent',{operationId:'original-c',nodeId:f.c.nodeId});
 await f.policy([f.b.nodeId],'revoke-c');assert.deepEqual(await f.tool('connect_agent',{operationId:'original-c',nodeId:f.c.nodeId,queryOnly:true}),original);
 assert(!(await f.tool('list_agents')).items.some(n=>n.nodeId===f.c.nodeId));
 assert.equal((await f.tool('connect_agent',{operationId:'new-c',nodeId:f.c.nodeId})).state,'pending_approval');
});
test('legacy explicit human graph grants update the envelope; removing a member revokes its reconnect authority',async t=>{
 const f=await setup(t);await f.policy([f.b.nodeId,f.c.nodeId]);const current=await f.call('collaboration');
 await f.call('saveCollaboration',{operationId:'human-graph-change',leaderId:f.a.nodeId,memberIds:[f.c.nodeId],expectedRevision:current.revision});
 const row=(await f.view()).relations[0];assert.deepEqual(row.envelope.allowedNodeIds,[f.c.nodeId]);
 assert.equal((await f.tool('connect_agent',{operationId:'b-again',nodeId:f.b.nodeId})).state,'pending_approval');
});
test('node disconnect rejects its pending approvals and revokes reconnect authority; reattach restores no grant',async t=>{
 const f=await setup(t);await f.tool('connect_agent',{operationId:'outside-c',nodeId:f.c.nodeId});
 await f.call('manageNode',{operationId:'disconnect-c',nodeId:f.c.nodeId,machineId:f.c.machineId,action:'disconnect'});
 const query=await f.tool('connect_agent',{operationId:'outside-c',nodeId:f.c.nodeId,queryOnly:true});assert.equal(query.state,'rejected');assert.equal(query.error.code,'CONNECTION_REVOKED');
 await f.call('manageNode',{operationId:'reattach-c',nodeId:f.c.nodeId,machineId:f.c.machineId,action:'attach'});
 assert(!(await f.tool('list_connectable')).items.some(n=>n.nodeId===f.c.nodeId));assert.equal((await f.view()).pending.length,0);
});
test('an original graph unknown blocks connection mutation and keeps every original graph byte and native request',async t=>{
 const f=await setup(t),{GraphOperationJournal}=runtime('graph-operations.cjs');const journal=new GraphOperationJournal(f.directory),row={operationId:'original-unknown-graph',lane:'relation',method:'saveCollaboration',params:{operationId:'original-unknown-graph',leaderId:f.a.nodeId,memberIds:[],expectedRevision:1},state:'unknown',time:'2026-10-20T00:00:00Z'};journal.update(row);const bytes=fs.readFileSync(journal.file);
 const result=await f.tool('disconnect_agent',{operationId:'new-disconnect',nodeId:f.b.nodeId});assert.equal(result.state,'rejected');assert.equal(result.error.code,'GRAPH_UNCONFIRMED');assert.deepEqual(fs.readFileSync(journal.file),bytes);assert.equal(f.router.network.requests.length,0);
});
test('pre-rename failure grants nothing; a lost post-rename acknowledgement queries exact durable state without reapplying',async t=>{
 const f=await setup(t);await f.policy([f.b.nodeId,f.c.nodeId]);const original=fs.renameSync,before=fs.readFileSync(f.router.networkFile);
 fs.renameSync=(a,b)=>{if(b===f.router.networkFile)throw Object.assign(Error('controlled disk full'),{code:'ENOSPC'});return original(a,b);};
 try{await assert.rejects(f.tool('connect_agent',{operationId:'disk-before',nodeId:f.c.nodeId}),{code:'ENOSPC'});}finally{fs.renameSync=original;}
 assert.deepEqual(fs.readFileSync(f.router.networkFile),before);assert.equal((await f.tool('connect_agent',{operationId:'disk-before',nodeId:f.c.nodeId,queryOnly:true})).state,'not_found');
 let renames=0;fs.renameSync=(a,b)=>{const result=original(a,b);if(b===f.router.networkFile){renames++;throw Object.assign(Error('controlled lost ack'),{code:'EIO'});}return result;};
 try{await assert.rejects(f.tool('connect_agent',{operationId:'disk-after',nodeId:f.c.nodeId}),{code:'EIO'});}finally{fs.renameSync=original;}
 const settled=await f.tool('connect_agent',{operationId:'disk-after',nodeId:f.c.nodeId,queryOnly:true});assert.equal(settled.state,'confirmed');assert.equal(renames,1);assert.equal(f.router.network.requests.length,0);
});
test('policy reads re-evaluate current allowed targets after an asynchronous snapshot',async t=>{
 const f=await setup(t);await f.policy([f.b.nodeId,f.c.nodeId]);const original=f.router.snapshot.bind(f.router);let enter,release;const entered=new Promise(r=>enter=r),wait=new Promise(r=>release=r);
 f.router.snapshot=async()=>{const value=await original();enter();await wait;return value;};
 const pending=f.tool('list_connectable');await entered;try{await f.policy([f.b.nodeId],'narrow-during-read');}finally{release();}
 assert.deepEqual((await pending).items.map(n=>n.nodeId),[f.b.nodeId]);
});
test('human audit omits private parent/connection identities and query-only missing operations never create intents',async t=>{
 const f=await setup(t);await f.tool('connect_agent',{operationId:'outside',nodeId:f.c.nodeId});
 const state=await f.view();assert(!JSON.stringify(state).includes('original-connection'));assert(!JSON.stringify(state).includes('conversationId'));assert(!JSON.stringify(state).includes('taskId'));
 const count=f.router.network.connectionOperations.length;assert.equal((await f.tool('connect_agent',{operationId:'missing-original',nodeId:f.c.nodeId,queryOnly:true})).state,'not_found');assert.equal(f.router.network.connectionOperations.length,count);
});
async function stdio(config,cleaners){
 const child=spawn(config.command,config.args,{env:{...process.env,...config.env},windowsHide:true,stdio:['pipe','pipe','ignore']}),lines=createInterface({input:child.stdout}),jobs=new Map();let id=0;
 cleaners.push(async()=>{lines.close();if(child.exitCode!==null||child.signalCode!==null)return;await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();},1000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.stdin.end();});});lines.on('line',line=>{const r=JSON.parse(line);jobs.get(r.id)?.(r);jobs.delete(r.id);});
 return (method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(Error('MCP timeout')),10000);jobs.set(n,value=>{clearTimeout(timer);resolve(value);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method,params})+'\n');});
}
test('actual independent MCP stdio advertises ten bounded tools, cannot call user-only approval, and revokes cached access',async t=>{
 const f=await setup(t),{MachineHost}=runtime('machine-host.cjs');const machine=new MachineHost({directory:path.join(f.directory,'mcp'),home:path.join(f.directory,'home'),legacy:{close(){}},collaboration:(...args)=>f.router.collaborationTool(...args,f.a.machineId)});f.cleaners.push(()=>machine.close());await machine.mcpReady;
 const exported=await machine.call('mcp.export',{nodeId:f.a.nodeId,adapter:'claude'}),config=JSON.parse(fs.readFileSync(exported.files.json)).mcpServers.agentbridge,send=await stdio(config,f.cleaners);await send('initialize',{protocolVersion:'2025-03-26'});
 const catalog=(await send('tools/list')).result.tools;assert.equal(catalog.length,10);assert.equal(catalog.find(t=>t.name==='list_connectable').annotations.readOnlyHint,true);assert.equal(catalog.find(t=>t.name==='connect_agent').inputSchema.additionalProperties,false);
 const invoke=async(name,args={})=>{const result=await send('tools/call',{name,arguments:args});return {raw:result,data:JSON.parse(result.result.content[0].text)};};
 assert.deepEqual((await invoke('list_connectable')).data.items.map(n=>n.nodeId),[f.b.nodeId]);
 assert.equal((await invoke('connect_agent',{nodeId:f.c.nodeId,operationId:'stdio-outside'})).data.state,'pending_approval');
 const forbidden=await send('tools/call',{name:'decideConnection',arguments:{decision:'allow'}});assert(forbidden.error);
 await machine.call('mcp.revoke',{nodeId:f.a.nodeId,adapter:'claude'});const revoked=await invoke('connect_agent',{nodeId:f.c.nodeId,operationId:'stdio-outside',queryOnly:true});assert.equal(revoked.data.error.code,'MCP_REVOKED');assert.equal(f.router.network.requests.length,0);
});
test('new user policy RPC methods have a targeted old-coordinator gate without affecting legacy reads',async()=>{
 const {CoordinatorClient}=runtime('coordinator-client.cjs'),caps=runtime('runtime-capabilities.cjs'),client=new CoordinatorClient({directory:'unused'});client.open=async()=>{};client.info={capabilities:[...caps.runtimeCapabilities,caps.MULTI_PARENT_RELATIONS_CAPABILITY]};let writes=0;
 client.socket={write(input){writes++;const id=JSON.parse(input).id,job=client.pending.get(id);clearTimeout(job.timer);client.pending.delete(id);job.resolve({legacy:true});}};
 for(const method of ['connectionPolicies','saveConnectionPolicy','decideConnection','connectionPolicyOperation'])await assert.rejects(client.request('call',{method,params:{}}),{code:'CONNECTION_POLICY_UPGRADE_REQUIRED'});
 assert.equal(writes,0);assert.deepEqual(await client.request('call',{method:'snapshot'}),{legacy:true});
});
