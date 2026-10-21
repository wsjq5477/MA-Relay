const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {version,renderDelegation}=require('../electron/delegation-context.cjs');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {MachineHost}=require('../electron/machine-host.cjs');
const {spawn}=require('node:child_process'),{createInterface}=require('node:readline');
test('versioned child context preserves the exact requirement and adds no parent identity, credentials or MCP capability',()=>{
 const body='literal $(no-shell) `quote` 中文\n\n[委派需求]\nuser text',row={contextVersion:1,message:body,parentTaskId:'private-parent',parentConversationId:'private-conversation',externalConnectionId:'private-connection',workspace:'/private/work',token:'private-token'};
 const before=JSON.stringify(row),message=renderDelegation(row);assert.equal(version,1);assert(message.endsWith('\n\n[委派需求]\n'+body));assert(message.startsWith('[协作任务说明]\n'));assert(message.includes('不要继续委派或修改连接关系'));assert(message.includes('不附带新的协作工具或权限'));assert(message.includes('不代替用户的原生权限确认'));assert(!message.includes('private'));assert.equal(JSON.stringify(row),before);assert.equal(renderDelegation(row),message);
 assert.equal(require('node:crypto').createHash('sha256').update(renderDelegation({contextVersion:1,message:''})).digest('hex'),'07d9ba5b8b019274ad0ef6fa9268185320e7014f2ae4936826792df12264f9b6','v1 prefix is a persisted input contract; new text needs a new supported version');
});
test('legacy content remains byte-for-byte unchanged and unsupported stored versions fail without migration',()=>{
 const text='old\r\nrequest\n',row={message:text};assert.equal(renderDelegation(row),text);assert.equal(row.contextVersion,undefined);
 for(const contextVersion of [null,0,2,'1'])assert.throws(()=>renderDelegation({...row,contextVersion}),{code:'DELEGATION_CONTEXT_UNSUPPORTED'});
});
test('new context plus requirement has an exact UTF-8 limit and never truncates or nests a retry prefix',()=>{
 const prefix=renderDelegation({contextVersion:1,message:''}),space=65536-Buffer.byteLength(prefix),body='中'.repeat(Math.floor(space/3))+'x'.repeat(space%3),message=renderDelegation({contextVersion:1,message:body});
 assert.equal(Buffer.byteLength(message),65536);assert(message.endsWith(body));assert.throws(()=>renderDelegation({contextVersion:1,message:body+'x'}),{code:'INVALID_INPUT'});
 assert.equal(renderDelegation({message:'x'.repeat(65536)}).length,65536);
});
async function fixture(t,adapter='codex'){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-child-context-')),mainAdapter=adapter==='claude'?'codex':'claude';let executions=0,network;
 const host={agents:[],tasks:[],calls:[],lose:false,close(){},setCollaboration(){},async call(method,p={}){
  this.calls.push({method,p:structuredClone(p)});
  if(method==='discover')return {items:[mainAdapter,adapter].map(adapter=>({adapter,name:adapter,version:'2.0.24',executable:'/controlled/'+adapter,healthy:true,executionSupported:true}))};
  if(method==='connectTool')return {};
  if(method==='snapshot')return structuredClone({agents:{items:this.agents},tasks:this.tasks,conversations:[]});
  if(method==='context'){const agentId='agent-'+this.agents.length;this.agents.push({agentId,adapter:p.adapter,nodeId:p.nodeId,workspace:'/controlled/'+agentId,executable:p.executable,available:true,online:true,enabled:true,healthy:true});return {agentId,contextId:'context-'+agentId};}
  if(method==='ipc'&&p.op==='submit'){
   const task={taskId:'task-'+ ++executions,conversationId:'conversation-'+executions,targetAgent:p.agentId,requestId:p.requestId,message:p.message,status:'running',createdAt:'2026-10-21',updatedAt:'2026-10-21'};this.tasks.push(task);
   if(this.lose){this.lose=false;throw Object.assign(Error('controlled response loss'),{code:'DESKTOP_TRANSPORT'});}return structuredClone(task);
  }
  if(method==='ipc'&&['request','task'].includes(p.op)){const task=this.tasks.find(x=>p.op==='request'?x.requestId===p.requestId:x.taskId===p.taskId);if(task)return structuredClone(task);}
  throw Object.assign(Error('Not found'),{code:'NOT_FOUND'});
 }};
 const open=()=>network=new AgentNetwork({directory,platform:'linux',createHost:()=>host});open();t.after(()=>{network.close();fs.rmSync(directory,{recursive:true,force:true});});
 const nodes=(await network.snapshot()).nodes;for(const n of nodes)await network.call('attachNode',{nodeId:n.nodeId});
 const main=nodes.find(n=>n.adapter===mainAdapter),child=nodes.find(n=>n.adapter===adapter);
 await network.call('saveCollaboration',{leaderId:main.nodeId,memberIds:[child.nodeId],expectedRevision:0});await network.call('nodeRequest',{nodeId:main.nodeId,requestId:'parent',message:'private parent requirement',collaboration:true});
 const scope={nodeId:main.nodeId,parentRequestId:'parent'},call=(name,args)=>network.collaborationTool(scope,name,args,'controlled-call',main.machineId);
 return {directory,get network(){return network;},host,main,child,call,reopen(){network.close();open();}};
}
test('all eight target entries receive one versioned child context without an injected parent or team scope',async t=>{
 for(const adapter of ['claude','codex','opencode','hermes','pi','dsh','dsh-desktop','dsh-web'])await t.test(adapter,async t=>{
  const f=await fixture(t,adapter),args={nodeId:f.child.nodeId,requestId:'original-child',message:'exact original requirement'};
  const task=await f.call('delegate',args),row=f.network.network.delegations[0],sent=f.host.calls.filter(c=>c.method==='ipc'&&c.p.op==='submit').at(-1).p;
  assert.equal(row.contextVersion,1);assert.equal(row.message,args.message);assert.equal(task.message,renderDelegation(row));assert.equal(sent.message,renderDelegation(row));assert(!sent.message.includes('private parent requirement'));
  const context=f.host.calls.filter(c=>c.method==='context'&&c.p.nodeId===f.child.nodeId).at(-1).p;assert(!Object.hasOwn(context,'scope'));assert(!Object.hasOwn(context,'collaborationId'));assert(!Object.hasOwn(sent,'mcp'));assert(!Object.hasOwn(sent,'teamScope'));assert.equal(f.host.tasks.length,2);
  const file=JSON.parse(fs.readFileSync(f.network.networkFile,'utf8'));assert.equal(file.delegations[0].contextVersion,1);assert.equal(file.requests.find(r=>r.requestId===row.requestId).collaboration,false);
 });
});
test('a response lost after original child dispatch retains the same context/version/IDs across reopen and never submits twice',async t=>{
 const f=await fixture(t),args={nodeId:f.child.nodeId,requestId:'lost-child',message:'original text',contextVersion:999};f.host.lose=true;
 await assert.rejects(f.call('delegate',args),{code:'DESKTOP_TRANSPORT'});const row=structuredClone(f.network.network.delegations[0]);assert.equal(row.state,'unknown');assert.equal(row.contextVersion,1);assert.equal(row.taskId,undefined);
 const submit=f.host.calls.filter(c=>c.method==='ipc'&&c.p.op==='submit'&&c.p.requestId===row.requestId);assert.equal(submit.length,1);const message=submit[0].p.message;
 f.reopen();for(let i=0;i<3;i++){const task=await f.call('delegate',args);assert.equal(task.message,message);assert.equal(task.taskId,f.network.network.delegations[0].taskId);}
 assert.equal(f.host.calls.filter(c=>c.method==='ipc'&&c.p.op==='submit'&&c.p.requestId===row.requestId).length,1);assert.equal(f.host.tasks.length,2);assert.equal(f.network.network.delegations[0].requestId,row.requestId);assert.equal(f.network.network.delegations[0].contextVersion,1);
});
test('an existing legacy delegation recovers its original plain child receipt without adding a prefix or version',async t=>{
 const f=await fixture(t),args={nodeId:f.child.nodeId,requestId:'legacy-child',message:'original legacy body'};
 // A pre-upgrade durable row and request, using the original ID derivation.
 const {createHash}=require('node:crypto'),parent=f.host.tasks[0],conversationId=f.main.machineId+'::'+parent.conversationId,requestId='delegation-'+createHash('sha256').update(f.main.nodeId+':'+conversationId+':'+args.requestId).digest('hex').slice(0,40);
 const task=await f.network.call('nodeRequest',{op:'submit',nodeId:f.child.nodeId,requestId,message:args.message,collaboration:false});
 f.network.network.delegations.push({delegationId:'legacy-row',requestId,leaderId:f.main.nodeId,memberId:f.child.nodeId,parentRequestId:'parent',parentTaskId:f.main.machineId+'::'+parent.taskId,parentConversationId:conversationId,message:args.message,state:'unknown'});f.network.saveNetwork();f.reopen();
 const recovered=await f.call('delegate',args);assert.equal(recovered.taskId,task.taskId);assert.equal(recovered.message,args.message);assert.equal(f.host.tasks.length,2);assert.equal(f.network.network.delegations[0].contextVersion,undefined);
});
test('unsupported durable context versions preserve the unknown row and never query or mutate the child',async t=>{
 const f=await fixture(t),args={nodeId:f.child.nodeId,requestId:'future-child',message:'original'};await f.call('delegate',args);const row=f.network.network.delegations[0];row.contextVersion=2;row.state='unknown';f.network.saveNetwork();
 const before=fs.readFileSync(f.network.networkFile,'utf8'),count=f.host.calls.length;await assert.rejects(f.call('delegate',args),{code:'DELEGATION_CONTEXT_UNSUPPORTED'});
 assert.equal(fs.readFileSync(f.network.networkFile,'utf8'),before);assert.deepEqual(f.host.calls.slice(count).map(c=>[c.method,c.p.op]),[['ipc','request']]);assert.equal(f.host.tasks.length,2);
});
test('oversized new context is rejected before a delegation row, child preparation or request is created',async t=>{
 const f=await fixture(t),count=f.host.calls.length;
 await assert.rejects(f.call('delegate',{nodeId:f.child.nodeId,requestId:'too-large',message:'x'.repeat(65536)}),{code:'INVALID_INPUT'});
 assert.equal(f.network.network.delegations.length,0);assert.equal(f.network.network.requests.length,1);assert.equal(f.host.tasks.length,1);assert.deepEqual(f.host.calls.slice(count).map(c=>[c.method,c.p.op]),[['ipc','request']]);
});
test('durable preparation refusal matches the rendered original input across retry and reopen, never the unwrapped body',async t=>{
 const f=await fixture(t),original=f.host.call.bind(f.host);let preparations=0;
 f.host.call=async(method,p)=>{if(method==='context'){preparations++;throw Object.assign(Error('controlled original refusal'),{code:'FUTURE_CONTEXT_REFUSAL'});}return original(method,p);};
 const args={nodeId:f.child.nodeId,requestId:'refused-child',message:'not dispatched'};
 for(let i=0;i<3;i++){
  await assert.rejects(f.call('delegate',args),{code:'FUTURE_CONTEXT_REFUSAL'});assert.equal(f.network.network.delegations[0].state,'rejected');f.reopen();
 }
 assert.equal(preparations,1);assert.equal(f.host.tasks.length,1);const row=f.network.network.delegations[0],receipt=f.network.network.requests.find(r=>r.requestId===row.requestId);assert.equal(receipt.dispatched,false);assert.equal(receipt.taskId,undefined);
 row.contextVersion=2;row.state='unknown';assert.equal(f.network.reconcileDelegation(row),null);assert.equal(row.state,'unknown');
 row.contextVersion=1;row.message+='changed';assert.equal(f.network.reconcileDelegation(row),null);assert.equal(row.state,'unknown');
});
test('independent MCP through actual stdio creates the same child context without disclosing its connection identity or granting child tools',async t=>{
 const f=await fixture(t),machine=new MachineHost({directory:path.join(f.directory,'machine'),home:path.join(f.directory,'home'),legacy:{close(){}},collaboration:(...args)=>f.network.collaborationTool(...args,f.main.machineId)});t.after(()=>machine.close());await machine.mcpReady;
 const exported=await machine.call('mcp.export',{nodeId:f.main.nodeId,adapter:'claude'}),config=JSON.parse(fs.readFileSync(exported.files.json)).mcpServers.agentbridge;
 const child=spawn(config.command,config.args,{env:{...process.env,...config.env},stdio:['pipe','pipe','ignore']}),lines=createInterface({input:child.stdout}),pending=new Map();let id=0;t.after(()=>{child.kill();lines.close();});
 lines.on('line',line=>{const r=JSON.parse(line);pending.get(r.id)?.(r);pending.delete(r.id);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('MCP timeout'));},10000);pending.set(n,r=>{clearTimeout(timer);resolve(r);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method,params})+'\n');});
 await send('initialize',{protocolVersion:'2025-03-26'});
 const args={nodeId:f.child.nodeId,requestId:'external-original',message:'exact external requirement'},invoke=async()=>JSON.parse((await send('tools/call',{name:'delegate',arguments:args})).result.content[0].text);
 const task=await invoke(),row=f.network.network.delegations[0];assert.equal(row.contextVersion,1);assert.equal(row.parentTaskId,null);assert.equal(row.externalConnectionId,exported.connectionId);assert.equal(task.message,renderDelegation(row));assert(!task.message.includes(exported.connectionId));assert.equal(task.parentTaskId,null);
 const same=await invoke();assert.equal(same.taskId,task.taskId);assert.equal(f.host.tasks.length,2);const context=f.host.calls.filter(c=>c.method==='context'&&c.p.nodeId===f.child.nodeId).at(-1).p;assert(!Object.hasOwn(context,'scope'));assert(!Object.hasOwn(context,'collaborationId'));
 await machine.call('mcp.remove',{nodeId:f.main.nodeId,adapter:'claude'});assert.equal((await invoke()).error.code,'MCP_REVOKED');assert.equal(f.host.tasks.length,2);
});
