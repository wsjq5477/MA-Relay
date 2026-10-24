const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {delegationList}=require('../electron/delegation-list.cjs');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {CollaborationBroker}=require('../electron/collaboration-broker.cjs');
const {MachineHost}=require('../electron/machine-host.cjs');
const {spawn}=require('node:child_process'),{createInterface}=require('node:readline');
const node={nodeId:'leader'},owner={requestId:'parent',taskId:'parent-task',conversationId:'parent-conversation'};
function row(i=1,change={}){return {delegationId:'d'+i,requestId:'original-request-'+i,leaderId:'leader',memberId:'member',parentRequestId:'parent',parentTaskId:'parent-task',parentConversationId:'parent-conversation',state:'unknown',createdAt:'2026-10-20',message:'private-prompt',workspace:'/private/work',error:{code:'TRANSPORT_LOST',message:'private-error'},...change};}
const data=rows=>({delegations:rows,nodes:[{nodeId:'member',machineId:'machine'}]});
test('read-only ledger lists original unknown/pending IDs without task invention, private content, writes or status inference',()=>{
 const n=data([row(),row(2,{state:'pending'}),row(3,{state:'running',taskId:'child',conversationId:'child-conversation'}),row(4,{state:'rejected',error:{code:'NOT_CONFIGURED',message:'private-error'}})]),before=JSON.stringify(n);
 const p=delegationList(n,node,owner);assert.equal(p.readOnly,true);assert.equal(p.liveTaskStatus,false);assert.equal(p.items[0].ledgerState,'unknown');assert.equal(p.items[0].taskQueryable,false);assert.equal(p.items[0].taskId,undefined);assert.equal(p.items[2].taskQueryable,true);
 assert.equal(p.items[3].errorCode,'NOT_CONFIGURED');assert.equal(JSON.stringify(n),before);for(const secret of ['private-prompt','/private/work','private-error','parent-task','parent-conversation'])assert(!JSON.stringify(p).includes(secret));
 assert.equal(delegationList(data([row(1,{state:'succeeded'})]),node,owner).items[0].ledgerState,'succeeded');assert.equal(JSON.stringify(n),before);
});
test('native parent request/task/conversation and independent connections are isolated, including absent identities',()=>{
 const foreign=[row(2,{leaderId:'other'}),row(3,{parentRequestId:'other'}),row(4,{parentTaskId:'other'}),row(5,{parentConversationId:'other'}),row(6,{externalConnectionId:'connection'}),row(7,{parentTaskId:null})];
 assert.deepEqual(delegationList(data([row(),...foreign]),node,owner).items.map(x=>x.delegationId),['d1']);
 for(const key of ['requestId','taskId','conversationId'])for(const value of [undefined,null,'',' '])assert.equal(delegationList(data([row(1,{parentRequestId:undefined,parentTaskId:undefined,parentConversationId:undefined})]),node,{...owner,[key]:value}).total,0);
 const ext={requestId:'connection',conversationId:'mcp:connection',taskId:null,externalConnectionId:'connection'};
 const rows=[row(1,{parentRequestId:ext.requestId,parentConversationId:ext.conversationId,parentTaskId:null,externalConnectionId:'connection'}),row(2,{parentRequestId:ext.requestId,parentConversationId:ext.conversationId,parentTaskId:null,externalConnectionId:'other'}),row(3,{parentRequestId:ext.requestId,parentConversationId:ext.conversationId,parentTaskId:null})];
 assert.deepEqual(delegationList(data(rows),node,ext).items.map(x=>x.delegationId),['d1']);assert.equal(delegationList(data(rows),node,{...ext,taskId:'native-task'}).total,0);
});
test('bounded stable pages and scoped cursors cannot expose another owner or silently replace an invalid cursor',()=>{
 const n=data(Array.from({length:53},(_,i)=>row(i))),p=delegationList(n,node,owner);assert.equal(p.items.length,20);assert.equal(p.next,'d19');
 const last=delegationList(n,node,owner,{after:p.next,limit:50});assert.equal(last.items.length,33);assert.equal(last.next,null);assert.equal(last.hasMore,false);
 n.delegations.push(row(99,{parentRequestId:'other'}));assert.throws(()=>delegationList(n,node,owner,{after:'d99'}),{code:'INVALID_INPUT'});
 for(const args of [null,[],{limit:0},{limit:51},{limit:'20'},{after:''},{after:'foreign'},{nodeId:'other'},{externalConnectionId:'other'},{after:'x'.repeat(129)}])assert.throws(()=>delegationList(n,node,owner,args),{code:'INVALID_INPUT'});
});
async function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-delegation-list-'));let count=0;
 const host={agents:[],tasks:[],calls:[],close(){},setCollaboration(){},async call(method,p={}){
  this.calls.push({method,p});if(method==='discover')return {items:['claude','codex'].map(adapter=>({adapter,name:adapter,version:'2.0.24',executable:'/controlled/'+adapter,healthy:true,executionSupported:true}))};
  if(method==='connectTool')return {};
  if(method==='snapshot')return structuredClone({agents:{items:this.agents},tasks:this.tasks,conversations:[]});
  if(method==='context'){const agentId='agent-'+this.agents.length;this.agents.push({agentId,adapter:p.adapter,nodeId:p.nodeId,workspace:'/controlled/'+agentId,executable:p.executable,available:true,online:true,enabled:true,healthy:true});return {agentId,contextId:'context-'+agentId};}
  if(method==='ipc'&&p.op==='submit'){const task={taskId:'task-'+ ++count,conversationId:'conversation-'+count,targetAgent:p.agentId,requestId:p.requestId,message:p.message,status:'running',createdAt:'2026-10-20',updatedAt:'2026-10-20'};this.tasks.push(task);return structuredClone(task);}
  if(method==='ipc'&&['request','task'].includes(p.op)){const task=this.tasks.find(x=>p.op==='request'?x.requestId===p.requestId:x.taskId===p.taskId);if(task)return structuredClone(task);}
  throw Object.assign(Error('Not found'),{code:'NOT_FOUND'});
 }};
 const network=new AgentNetwork({directory,platform:'linux',createHost:()=>host});t.after(()=>{network.close();fs.rmSync(directory,{recursive:true,force:true});});
 const nodes=(await network.snapshot()).nodes;for(const n of nodes)await network.call('attachNode',{nodeId:n.nodeId});
 const leader=nodes.find(n=>n.adapter==='claude'),member=nodes.find(n=>n.adapter==='codex');
 await network.call('saveCollaboration',{leaderId:leader.nodeId,memberIds:[member.nodeId],expectedRevision:0});
 const parent=await network.call('nodeRequest',{nodeId:leader.nodeId,requestId:'original-parent',message:'controlled parent',collaboration:true});
 const scope={nodeId:leader.nodeId,parentRequestId:'original-parent'};
 const call=(name,p={})=>network.collaborationTool(scope,name,p,'unused-read-call-id',leader.machineId);
 await call('delegate',{nodeId:member.nodeId,requestId:'original-child',message:'controlled child'});
 return {directory,network,host,leader,member,parent,scope,call};
}
test('production AgentNetwork checks live parent and source machine; revoked child relations retain owned reads without new native queries or ledger writes',async t=>{
 const f=await fixture(t);await f.network.call('saveCollaboration',{leaderId:f.member.nodeId,memberIds:[],expectedRevision:1});
 const before=fs.readFileSync(f.network.networkFile,'utf8'),count=f.host.calls.length;
 const p=await f.call('list_delegations');assert.equal(p.items.length,1);assert.equal(p.items[0].ledgerState,'running');
 assert.deepEqual(f.host.calls.slice(count).map(x=>[x.method,x.p.op]),[['ipc','request']]);assert.equal(fs.readFileSync(f.network.networkFile,'utf8'),before);
 f.host.tasks[1].status='succeeded';assert.equal((await f.call('list_delegations')).items[0].ledgerState,'running');assert.equal((await f.call('task_result',{taskId:p.items[0].taskId})).status,'succeeded');assert.equal((await f.call('list_delegations')).items[0].ledgerState,'succeeded');
 await assert.rejects(f.network.collaborationTool(f.scope,'list_delegations',{},'read','foreign-machine'),{code:'COLLABORATION_FORBIDDEN'});
 f.host.tasks[0].status='unknown';assert.equal((await f.call('list_delegations')).items.length,1);
 await assert.rejects(f.call('delegate',{nodeId:f.member.nodeId,requestId:'must-not-send',message:'no replay'}),{code:'COLLABORATION_FORBIDDEN'});
 f.host.tasks[0].status='succeeded';await assert.rejects(f.call('list_delegations'),{code:'COLLABORATION_FORBIDDEN'});
});
async function client(t,config){
 const child=spawn(config.command,config.args,{env:{...process.env,...config.env},stdio:['pipe','pipe','ignore']}),lines=createInterface({input:child.stdout});t.after(()=>{child.kill();lines.close();});const pending=new Map();let id=0;
 lines.on('line',line=>{const r=JSON.parse(line);pending.get(r.id)?.(r);pending.delete(r.id);});
 return (method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('MCP timeout'));},10000);pending.set(n,r=>{clearTimeout(timer);resolve(r);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method,params})+'\n');});
}
test('actual broker/stdio discovers the seventh read-only tool and binds lookup to authenticated parent rather than caller arguments',async t=>{
 const f=await fixture(t),broker=new CollaborationBroker(path.join(f.directory,'broker'),(scope,name,p)=>f.network.collaborationTool(scope,name,p,'unused',f.leader.machineId));t.after(()=>broker.close());
 const send=await client(t,await broker.configure('native-parent',f.scope));await send('initialize',{protocolVersion:'2025-03-26'});
 const tools=(await send('tools/list')).result.tools;assert.equal(tools.length,10);assert.equal(tools.find(x=>x.name==='list_delegations').annotations.readOnlyHint,true);
 const read=async args=>JSON.parse((await send('tools/call',{name:'list_delegations',arguments:args})).result.content[0].text);
 assert.equal((await read({})).items.length,1);assert.equal((await read({nodeId:'forged'})).error.code,'INVALID_INPUT');
});
test('production independent MCP entry enforces connection isolation and immediate revocation for the new list tool',async t=>{
 const f=await fixture(t),machine=new MachineHost({directory:path.join(f.directory,'machine'),home:path.join(f.directory,'home'),legacy:{close(){}},collaboration:(...args)=>f.network.collaborationTool(...args,f.leader.machineId)});t.after(()=>machine.close());await machine.mcpReady;
 const e=await machine.call('mcp.export',{nodeId:f.leader.nodeId,adapter:'claude'}),config=JSON.parse(fs.readFileSync(e.files.json)).mcpServers.agentbridge,scope=machine.broker.scopes.find(s=>s.scope.externalConnectionId===e.connectionId).scope;
 const own={...row(8),leaderId:f.leader.nodeId,memberId:f.member.nodeId,parentRequestId:e.connectionId,parentTaskId:null,parentConversationId:'mcp:'+e.connectionId,externalConnectionId:e.connectionId};
 f.network.network.delegations.push(own,{...own,delegationId:'another-connection',externalConnectionId:'foreign'});f.network.saveNetwork();
 const send=await client(t,config),read=async()=>JSON.parse((await send('tools/call',{name:'list_delegations',arguments:{}})).result.content[0].text);
 assert.deepEqual((await read()).items.map(x=>x.delegationId),['d8']);await machine.call('mcp.remove',{nodeId:f.leader.nodeId,adapter:'claude'});assert.equal((await read()).error.code,'MCP_REVOKED');
 assert.equal(f.network.network.delegations.find(d=>d.delegationId==='d8').state,'unknown');assert.equal(scope.externalConnectionId,e.connectionId);
});

test('reopening the observer lists the same original delegation without another submission, reconciliation or identity change',async t=>{
 const f=await fixture(t),before=fs.readFileSync(f.network.networkFile,'utf8'),count=f.host.calls.length;f.network.close();
 const reopened=new AgentNetwork({directory:f.directory,platform:'linux',createHost:()=>f.host});t.after(()=>reopened.close());
 const p=await reopened.collaborationTool(f.scope,'list_delegations',{},'read',f.leader.machineId);
 assert.equal(p.items.length,1);assert.equal(p.items[0].taskQueryable,true);assert.equal(f.host.tasks.length,2);assert(!f.host.calls.slice(count).some(c=>c.p.op==='submit'||c.p.op==='continue'||c.p.op==='cancel'));
 assert.equal(fs.readFileSync(f.network.networkFile,'utf8'),before);
});
