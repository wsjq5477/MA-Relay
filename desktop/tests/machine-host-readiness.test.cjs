const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {MachineHost}=require('../electron/machine-host.cjs');
test('OpenCode context observes native health before returning and never submits a prompt while warming',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-native-ready-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const calls=[];let reads=0;
 const backend={close(){},async call(method,p){calls.push(method);if(method==='connect')return {agentId:'ready-agent'};if(method==='snapshot')return {agents:{items:[{agentId:'ready-agent',healthy:++reads>=2}]}};throw Error('No native submit allowed');}};
 const host=new MachineHost({directory,legacy:{},openCode:()=>backend});t.after(()=>host.close());
 host.discover=async()=>({items:[{adapter:'opencode',executable:'/native/opencode',name:'OpenCode',healthy:true,executionSupported:true}]});
 const context=await host.context({nodeId:'node',adapter:'opencode',executable:'/native/opencode'});
 assert.equal(context.agentId,'ready-agent');assert.equal(reads,2);assert.deepEqual(calls,['connect','snapshot','snapshot']);
});

test('a new installation creates a separate context while the original backend remains queryable',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-upgraded-context-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const host=new MachineHost({directory,legacy:{close(){}}});t.after(()=>host.close());
  host.discover=async()=>({items:[{adapter:'claude',executable:host.selected,name:'Claude Code',healthy:true,executionSupported:true}]});
  const backends=new Map();host.backend=row=>{
    if(!backends.has(row.contextId))backends.set(row.contextId,{async call(method){
      if(method==='connect')return {agentId:'agent-'+row.contextId};
      if(method==='snapshot')return {agents:{items:[{agentId:row.agentId,healthy:true}]}};
      if(method==='ipc')return {originalExecutable:row.executable};
    }});
    return backends.get(row.contextId);
  };
  host.selected='/versions/2.1.299/claude';const old=await host.context({nodeId:'same-node',adapter:'claude',executable:host.selected});
  const saved=structuredClone(host.rows[0]);
  host.selected='/versions/2.1.302/claude';const current=await host.context({nodeId:'same-node',adapter:'claude',executable:host.selected});
  assert.notEqual(current.contextId,old.contextId);assert.deepEqual(host.rows[0],saved);
  assert.equal((await host.call('ipc',{op:'request',agentId:old.agentId,requestId:'original'})).originalExecutable,saved.executable);
  assert.equal((await host.context({nodeId:'same-node',adapter:'claude',executable:host.selected})).contextId,current.contextId);
});
