const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {MachineHost}=require('../electron/machine-host.cjs'),{MachineRouter}=require('../electron/machine-router.cjs');
const error=code=>Object.assign(Error(code==='NOT_CONFIGURED'?'请先发现并连接 OpenCode':code),{code});
function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-history-detail-')),calls=[];
 const snapshots={legacy:{agents:{items:[]},tasks:[],conversations:[]},codex:{agents:{items:[{agentId:'codex-agent'}]},tasks:[],conversations:[]},claude:{agents:{items:[{agentId:'claude-agent'}]},tasks:[],conversations:[]}};
 const hosts=Object.fromEntries(Object.keys(snapshots).map(name=>[name,{close(){},async call(method,p){calls.push({name,method,...p});if(method==='snapshot')return structuredClone(snapshots[name]);if(name==='legacy')throw error('NOT_CONFIGURED');const items=p.op==='task'?snapshots[name].tasks:snapshots[name].conversations;const id=p.op==='task'?'taskId':'conversationId';const found=items.find(x=>x[id]===p[id]);if(!found)throw error('NOT_FOUND');return {...found,items:[],canContinue:true};}}]));
 fs.writeFileSync(path.join(directory,'node-contexts.json'),JSON.stringify([{contextId:'unfinished',adapter:'opencode'},{contextId:'codex',adapter:'codex',agentId:'codex-agent'},{contextId:'claude',adapter:'claude',agentId:'claude-agent'}]));
 const host=new MachineHost({directory,legacy:hosts.legacy});host.contexts.set('codex',hosts.codex);host.contexts.set('claude',hosts.claude);
 t.after(()=>{host.close();fs.rmSync(directory,{recursive:true,force:true});});return {directory,host,hosts,snapshots,calls};
}
test('orphan metadata never routes a Codex conversation or task into unconfigured root OpenCode',async t=>{
 const f=fixture(t);f.snapshots.codex.conversations.push({conversationId:'old',targetAgent:'deleted-agent'});f.snapshots.codex.tasks.push({taskId:'old-task'});
 for(const p of [{op:'conversation',conversationId:'old'},{op:'task',taskId:'old-task'},{op:'conversation',conversationId:'missing'}]){
  try{const result=await f.host.call('ipc',p);assert.equal(result[p.op==='task'?'taskId':'conversationId'],p[p.op==='task'?'taskId':'conversationId']);}catch(e){assert.equal(e.code,'NOT_FOUND');}
 }
 assert.equal(f.calls.filter(c=>c.name==='legacy'&&c.method==='ipc').length,0);
 assert(f.calls.every(c=>c.method==='snapshot'||['conversation','task'].includes(c.op)));
});
test('the actual backend snapshot owns reads regardless of a stale or missing targetAgent',async t=>{
 const f=fixture(t);
 for(const name of ['codex','claude'])for(const targetAgent of [name+'-agent',undefined,'deleted-agent']){
  f.snapshots[name].conversations=[{conversationId:name,targetAgent}];
  const result=await f.host.call('ipc',{op:'conversation',conversationId:name,agentId:'codex-agent'});
  assert.equal(result.conversationId,name);assert.equal(result.canContinue,targetAgent===name+'-agent');
  assert.equal(f.calls.at(-1).name,name);
 }
});
test('genuine legacy objects still read from legacy; its real configuration failure is not hidden',async t=>{
 const f=fixture(t);f.snapshots.legacy.conversations=[{conversationId:'legacy-original'}];
 await assert.rejects(f.host.call('ipc',{op:'conversation',conversationId:'legacy-original'}),{code:'NOT_CONFIGURED'});
 assert.equal(f.calls.at(-1).name,'legacy');
 const call=f.hosts.legacy.call;f.hosts.legacy.call=async(method,p)=>method==='ipc'?{conversationId:p.conversationId,items:[],canContinue:true}:call(method,p);
 assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:'legacy-original'})).canContinue,true);
});
test('duplicate backend IDs and mismatched detail responses are rejected without guessing an owner',async t=>{
 const f=fixture(t);f.snapshots.codex.conversations=[{conversationId:'duplicate'}];f.snapshots.claude.conversations=[{conversationId:'duplicate'}];
 await assert.rejects(f.host.call('ipc',{op:'conversation',conversationId:'duplicate'}),{code:'OBJECT_SOURCE_CONFLICT'});
 assert.equal(f.calls.filter(c=>c.method==='ipc').length,0);
 f.snapshots.claude.conversations=[];f.hosts.codex.call=async(method)=>method==='snapshot'?f.snapshots.codex:{conversationId:'foreign'};
 await assert.rejects(f.host.call('ipc',{op:'conversation',conversationId:'duplicate'}),{code:'RECEIPT_MISMATCH'});
});
test('router missing details fall back only to the same machine and exact historical ID, without mutating history',async t=>{
 const f=fixture(t),router=new MachineRouter({directory:path.join(f.directory,'central'),platform:'linux',createHost:()=>({close(){},call:async()=>{throw error('NOT_FOUND');}})});t.after(()=>router.close());
 const machine=router.catalog.machines[0],task={taskId:'t',conversationId:'c',requestId:'r',status:'running',native:{sessionId:'native-original'}};
 router.history[machine.machineId]={tasks:[task],conversations:[{conversationId:'c',targetAgent:'deleted',turns:1}]};const before=structuredClone(router.history);
 const result=await router.call('ipc',{op:'conversation',machineId:machine.machineId,conversationId:machine.machineId+'::c'});
 assert.equal(result.historical,true);assert.equal(result.canContinue,false);assert.equal(result.items[0].status,'unknown');assert.equal(result.items[0].native.sessionId,'native-original');assert.deepEqual(router.history,before);
 await assert.rejects(router.call('ipc',{op:'conversation',machineId:machine.machineId,conversationId:'other'}),{code:'NOT_FOUND'});
 await assert.rejects(router.call('ipc',{op:'conversation',machineId:'missing-machine',conversationId:'c'}),{code:'MACHINE_NOT_FOUND'});
 router.history[machine.machineId].conversations[0].machineId='foreign-machine';
 await assert.rejects(router.call('ipc',{op:'conversation',machineId:machine.machineId,conversationId:'c'}),{code:'NOT_FOUND'});
 router.history[machine.machineId]=before[machine.machineId];
 router.hosts.clear();router.options.createHost=()=>({close(){},call:async()=>{throw error('NOT_CONFIGURED');}});
 await assert.rejects(router.call('ipc',{op:'conversation',machineId:machine.machineId,conversationId:'c'}),{code:'NOT_CONFIGURED'});
});

test('a genuine snapshot failure is preserved when no source can prove ownership',async t=>{
 const f=fixture(t);f.hosts.claude.call=async()=>{throw error('NOT_CONFIGURED');};
 await assert.rejects(f.host.call('ipc',{op:'conversation',conversationId:'missing'}),{code:'NOT_CONFIGURED'});
 assert.equal(f.calls.filter(c=>c.method==='ipc').length,0);
 f.snapshots.codex.conversations=[{conversationId:'known'}];
 assert.equal((await f.host.call('ipc',{op:'conversation',conversationId:'known'})).conversationId,'known');
});
