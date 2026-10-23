const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {listAgentConnections,assertListArgs}=require('../electron/agent-connections.cjs');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {MachineHost}=require('../electron/machine-host.cjs');
const {spawn}=require('node:child_process'),{createInterface}=require('node:readline');
const leader={nodeId:'leader',machineId:'machine',adapter:'claude',executionSupported:true};
test('caller view projects only current authorized targets and safe caller metadata without changing the input',()=>{
 const network={collaboration:{leaderId:'leader',memberIds:['member','leader'],revision:3}},snapshot={nodes:[leader,{nodeId:'member',machineId:'other-machine',name:'Member',adapter:'hermes',busy:true,status:'offline',workspace:'/private',token:'private-token'},{nodeId:'foreign',name:'private-node'}],machines:[{machineId:'other-machine',name:'Other',token:'machine-token'}]},owner={requestId:'private-parent',taskId:'private-task',conversationId:'private-conversation'};
 const before=JSON.stringify([network,snapshot,owner]),view=listAgentConnections(network,leader,owner,snapshot);
 assert.deepEqual(view.caller,{nodeId:'leader',machineId:'machine',kind:'native-parent',role:'leader',delegationAuthorized:true,delegationBlock:null});
 assert.equal(view.relationRevision,3);assert.equal(view.readOnly,true);assert.equal(view.view,'authorized-connections');assert.deepEqual(view.items.map(n=>n.nodeId),['member']);assert.equal(view.items[0].busy,true);assert.equal(view.items[0].status,'offline');assert.equal(view.items[0].machine,'Other');
 for(const text of ['private','token','workspace'])assert(!JSON.stringify(view).includes(text));assert.equal(JSON.stringify([network,snapshot,owner]),before);
});
test('roles, parent uncertainty and unsupported callers explain authority without turning an offline target into a grant',()=>{
 const network={collaboration:{leaderId:'leader',memberIds:['member'],revision:1}},snapshot={nodes:[{nodeId:'member',machineId:'other',status:'offline'}],machines:[]};
 for(const [node,owner,role,block] of [[leader,{status:'unknown'},'leader','parent_unknown'],[{...leader,adapter:'hermes',connectionCapabilities:{mcpClient:null}}, {},'leader','caller_unsupported'],[{...leader,nodeId:'member'}, {},'member','not_leader'],[{...leader,nodeId:'other'}, {},'unassigned','not_leader'],[{...leader,nodeId:''},{},'unassigned','not_leader']]){
  const view=listAgentConnections(network,node,owner,snapshot);assert.equal(view.caller.role,role);assert.equal(view.caller.delegationAuthorized,false);assert.equal(view.caller.delegationBlock,block);assert.equal(view.items.length,role==='leader'?1:0);
 }
 const external=listAgentConnections(network,leader,{externalConnectionId:'private-connection'},snapshot);assert.equal(external.caller.kind,'external-connection');assert(!JSON.stringify(external).includes('private-connection'));
});
test('list accepts no caller-controlled identity or filtering arguments',()=>{
 assert.doesNotThrow(()=>assertListArgs());assert.doesNotThrow(()=>assertListArgs({}));
 for(const args of [null,[],true,'leader',{nodeId:'other'},{parentRequestId:'other'},{externalConnectionId:'other'},{limit:10}])assert.throws(()=>assertListArgs(args),{code:'INVALID_INPUT'});
});
async function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-caller-view-'));let executions=0;
 const host={agents:[],tasks:[],calls:[],close(){},setCollaboration(){},async call(method,p={}){
  this.calls.push({method,p});if(method==='discover')return {items:['claude','codex','hermes'].map(adapter=>({adapter,name:adapter,version:'2.0.24',executable:'/controlled/'+adapter,healthy:true,executionSupported:true}))};
  if(method==='connectTool')return {};
  if(method==='snapshot')return structuredClone({agents:{items:this.agents},tasks:this.tasks,conversations:[]});
  if(method==='context'){const agentId='agent-'+this.agents.length;this.agents.push({agentId,adapter:p.adapter,nodeId:p.nodeId,workspace:'/controlled/'+agentId,executable:p.executable,available:true,online:true,enabled:true,healthy:true});return {agentId,contextId:'context-'+agentId};}
  if(method==='ipc'&&p.op==='submit'){const task={taskId:'task-'+ ++executions,conversationId:'conversation-'+executions,targetAgent:p.agentId,requestId:p.requestId,message:p.message,status:'running',createdAt:'2026-10-21',updatedAt:'2026-10-21'};this.tasks.push(task);return structuredClone(task);}
  if(method==='ipc'&&p.op==='request'){const task=this.tasks.find(x=>x.requestId===p.requestId);if(task)return structuredClone(task);}
  throw Object.assign(Error('Not found'),{code:'NOT_FOUND'});
 }};
 const network=new AgentNetwork({directory,platform:'linux',createHost:()=>host});t.after(()=>{network.close();fs.rmSync(directory,{recursive:true,force:true});});
 const nodes=(await network.snapshot()).nodes;for(const n of nodes)await network.call('attachNode',{nodeId:n.nodeId});
 const main=nodes.find(n=>n.adapter==='claude'),member=nodes.find(n=>n.adapter==='codex'),other=nodes.find(n=>n.adapter==='hermes');
 const relation=(leaderId,memberIds)=>network.call('saveCollaboration',{leaderId,memberIds,expectedRevision:network.network.collaboration.revision});await relation(main.nodeId,[member.nodeId]);
 await network.call('nodeRequest',{nodeId:main.nodeId,requestId:'original-parent',message:'controlled',collaboration:true});
 const scope={nodeId:main.nodeId,parentRequestId:'original-parent'},call=(name='list_agents',args={})=>network.collaborationTool(scope,name,args,'controlled-read',main.machineId);
 return {directory,network,host,main,member,other,relation,scope,call};
}
test('production parent/source gates remain; unknown, member and unassigned views cannot authorize a new delegation',async t=>{
 const f=await fixture(t),before=f.host.tasks.length,requests=JSON.stringify(f.network.network.requests.map(({lastStatus,...identity})=>identity)),delegations=JSON.stringify(f.network.network.delegations);
 const initial=await f.call();assert.equal(initial.caller.nodeId,f.main.nodeId);assert.equal(initial.caller.role,'leader');assert.equal(initial.caller.delegationAuthorized,true);assert.deepEqual(initial.items.map(n=>n.nodeId),[f.member.nodeId]);
 f.host.tasks[0].status='unknown';const unknown=await f.call();assert.equal(unknown.caller.delegationBlock,'parent_unknown');assert.equal(unknown.items.length,1);
 await assert.rejects(f.call('delegate',{nodeId:f.member.nodeId,requestId:'never-send',message:'no'}),{code:'COLLABORATION_FORBIDDEN'});
 f.host.tasks[0].status='running';await f.relation(f.member.nodeId,[f.main.nodeId]);assert.equal((await f.call()).caller.role,'member');assert.deepEqual((await f.call()).items,[]);
 await f.relation(f.member.nodeId,[]);assert.equal((await f.call()).caller.role,'unassigned');
 const count=f.host.calls.length;await assert.rejects(f.call('list_agents',{nodeId:f.member.nodeId}),{code:'INVALID_INPUT'});assert.deepEqual(f.host.calls.slice(count).map(c=>c.p.op),['request']);
 await assert.rejects(f.network.collaborationTool(f.scope,'list_agents',{},'read','foreign-machine'),{code:'COLLABORATION_FORBIDDEN'});
 await assert.rejects(f.network.collaborationTool({...f.scope,parentRequestId:'missing'},'list_agents',{},'read',f.main.machineId),{code:'COLLABORATION_FORBIDDEN'});
 f.host.tasks[0].status='succeeded';await assert.rejects(f.call(),{code:'COLLABORATION_FORBIDDEN'});
 assert.equal(f.host.tasks.length,before);assert.equal(JSON.stringify(f.network.network.requests.map(({lastStatus,...identity})=>identity)),requests);assert.equal(f.network.network.requests[0].lastStatus,'unknown');assert.equal(JSON.stringify(f.network.network.delegations),delegations);
});
test('revocation while reading the original parent cannot preserve old discovery or new delegation authority',async t=>{
 for(const name of ['list_agents','delegate'])await t.test(name,async t=>{
  const f=await fixture(t),original=f.host.call.bind(f.host);let entered,release;
  const waiting=new Promise(resolve=>entered=resolve),resume=new Promise(resolve=>release=resolve);
  f.host.call=async(method,p)=>{const result=await original(method,p);if(method==='ipc'&&p.op==='request'&&p.requestId==='original-parent'){entered();await resume;}return result;};
  const pending=f.call(name,name==='delegate'?{nodeId:f.member.nodeId,requestId:'never-send-after-revoke',message:'must not dispatch'}:{});
  await waiting;await f.relation(f.member.nodeId,[]);release();
  if(name==='delegate')await assert.rejects(pending,{code:'COLLABORATION_FORBIDDEN'});else {const view=await pending;assert.equal(view.caller.role,'unassigned');assert.deepEqual(view.items,[]);}
  assert.equal(f.host.tasks.length,1);assert.equal(f.network.network.requests.length,1);assert.equal(f.network.network.delegations.length,0);
 });
});
test('relation replacement during a pending snapshot cannot return former grants or the former leader role',async t=>{
 for(const change of ['member-revoked','leader-replaced'])await t.test(change,async t=>{
  const f=await fixture(t),original=f.network.snapshot.bind(f.network);let entered,release;
  const waiting=new Promise(resolve=>entered=resolve),resume=new Promise(resolve=>release=resolve);
  f.network.snapshot=async()=>{const snapshot=await original();entered();await resume;return snapshot;};
  const pending=f.call();await waiting;
  if(change==='member-revoked')await f.relation(f.main.nodeId,[f.other.nodeId]);else await f.relation(f.member.nodeId,[f.main.nodeId]);
  release();const view=await pending;assert.equal(view.relationRevision,2);
  assert.deepEqual(view.items.map(n=>n.nodeId),change==='member-revoked'?[f.other.nodeId]:[]);assert.equal(view.caller.role,change==='member-revoked'?'leader':'member');
  assert.equal(f.host.tasks.length,1);
 });
});
async function client(t,config){
 const child=spawn(config.command,config.args,{env:{...process.env,...config.env},stdio:['pipe','pipe','ignore']}),lines=createInterface({input:child.stdout});t.after(()=>{child.kill();lines.close();});const pending=new Map();let id=0;
 lines.on('line',line=>{const r=JSON.parse(line);pending.get(r.id)?.(r);pending.delete(r.id);});
 return (method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('MCP timeout'));},10000);pending.set(n,r=>{clearTimeout(timer);resolve(r);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method,params})+'\n');});
}
test('independent MCP and actual stdio expose only the authenticated view, with immediate role and connection revocation',async t=>{
 const f=await fixture(t),machine=new MachineHost({directory:path.join(f.directory,'machine'),home:path.join(f.directory,'home'),legacy:{close(){}},collaboration:(...args)=>f.network.collaborationTool(...args,f.main.machineId)});t.after(()=>machine.close());await machine.mcpReady;
 const exported=await machine.call('mcp.export',{nodeId:f.main.nodeId,adapter:'claude'}),config=JSON.parse(fs.readFileSync(exported.files.json)).mcpServers.agentbridge;
 const send=await client(t,config);await send('initialize',{protocolVersion:'2025-03-26'});const tools=(await send('tools/list')).result.tools;assert.equal(tools.length,7);assert.equal(tools.find(t=>t.name==='list_agents').annotations.readOnlyHint,true);
 const read=async(args={})=>JSON.parse((await send('tools/call',{name:'list_agents',arguments:args})).result.content[0].text);
 const view=await read();assert.equal(view.caller.kind,'external-connection');assert.equal(view.caller.delegationAuthorized,true);assert.deepEqual(view.items.map(n=>n.nodeId),[f.member.nodeId]);assert(!JSON.stringify(view).includes(exported.connectionId));
 assert.equal((await read({externalConnectionId:'forged'})).error.code,'INVALID_INPUT');
 await f.relation(f.member.nodeId,[]);assert.equal((await read()).caller.role,'unassigned');assert.deepEqual((await read()).items,[]);
 await machine.call('mcp.remove',{nodeId:f.main.nodeId,adapter:'claude'});assert.equal((await read()).error.code,'MCP_REVOKED');assert.equal(f.host.tasks.length,1);
});
