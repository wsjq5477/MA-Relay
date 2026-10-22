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

test('installed OpenCode 3.x remains visible but cannot create a context or start a native backend',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-old-version-node-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const executable=path.join(directory,'opencode.cjs');fs.writeFileSync(executable,"console.log('opencode 3.0.0');",{mode:0o700});let starts=0;
 const host=new MachineHost({directory,home:directory,environment:{},legacy:{close(){}},candidates:{opencode:[executable],claude:[],codex:[],hermes:[],pi:[],dsh:[]},openCode:()=>{starts++;throw Error('must not start');}});t.after(()=>host.close());
 const item=(await host.discover()).items[0];assert.equal(item.healthy,true);assert.equal(item.version,'3.0.0');assert.equal(item.executionSupported,false);assert.equal(item.compatibility.supported,false);
 await assert.rejects(host.context({nodeId:'original',adapter:'opencode',executable}),e=>e.code==='NATIVE_VERSION'&&e.message.includes('1.x'));
 assert.equal(starts,0);assert.deepEqual(host.rows,[]);assert.equal(fs.existsSync(path.join(directory,'node-contexts.json')),false);
});
test('installed OpenCode 1.x reaches production context preparation instead of a 2.x rejection',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-v1-node-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const executable=path.join(directory,'opencode.cjs');fs.writeFileSync(executable,"console.log('opencode 1.19.3');",{mode:0o700});
 const calls=[],backend={async call(method){calls.push(method);return method==='connect'?{agentId:'v1-agent'}:{agents:{items:[{agentId:'v1-agent',healthy:true}]}};},close(){}};
 const host=new MachineHost({directory,home:directory,environment:{},legacy:{close(){}},candidates:{opencode:[executable],claude:[],codex:[],hermes:[],pi:[],dsh:[]},openCode:()=>backend});t.after(()=>host.close());
 const item=(await host.discover()).items[0];assert.equal(item.executionSupported,true);assert.equal(item.compatibility.supported,true);
 assert.equal((await host.context({nodeId:'v1',adapter:'opencode',executable})).agentId,'v1-agent');assert.deepEqual(calls,['connect','snapshot']);
});

test('explicit preparation restores an exited OpenCode service in the original context without reconnecting or submitting',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-exited-native-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 let restored=false;const calls=[];
 const backend={close(){},async call(method,p){calls.push({method,p});if(method==='connect')return {agentId:'original-agent'};if(method==='ipc'&&p.op==='start'){restored=true;return {};}
  if(method==='snapshot')return {agents:{items:[{agentId:'original-agent',healthy:restored,startupError:restored?undefined:{code:'NATIVE_UNAVAILABLE',message:'OpenCode 服务已退出'}}]}};
  throw Error('unexpected mutation');}};
 const host=new MachineHost({directory,legacy:{},openCode:()=>backend});t.after(()=>host.close());host.discover=async()=>({items:[{adapter:'opencode',executable:'/native/opencode',name:'OpenCode',healthy:true,executionSupported:true}]});
 const params={nodeId:'original-node',adapter:'opencode',executable:'/native/opencode'};
 const first=await host.context(params),frozen=structuredClone(first);assert.equal(first.agentId,'original-agent');
 restored=false;const again=await host.context(params);assert.deepEqual(again,frozen);assert.equal(host.rows.length,1);
 assert.equal(calls.filter(c=>c.method==='connect').length,1);assert.equal(calls.filter(c=>c.method==='ipc').length,2);
 assert(calls.filter(c=>c.method==='ipc').every(c=>c.p.op==='start'));
});

test('restoration surfaces native startup errors and missing original owners without allocating another agent',async t=>{
 for(const mode of ['startup-error','missing-owner'])await t.test(mode,async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-native-refusal-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));let started=false,connects=0;
  const backend={close(){},async call(method,p){if(method==='connect'){connects++;return {agentId:'original'};}if(method==='ipc'&&p.op==='start'){started=true;return {};}
   if(method==='snapshot')return {agents:{items:mode==='missing-owner'?[]:[{agentId:'original',healthy:false,startupError:started?{code:'NATIVE_EXITED',message:'native startup exited'}:{code:'NATIVE_UNAVAILABLE',message:'service exited'}}]}};
   throw Error('unexpected call');}};
  const host=new MachineHost({directory,legacy:{},openCode:()=>backend});t.after(()=>host.close());host.discover=async()=>({items:[{adapter:'opencode',executable:'/native/opencode',name:'OpenCode',healthy:true,executionSupported:true}]});
  await assert.rejects(host.context({nodeId:'n',adapter:'opencode',executable:'/native/opencode'}),{code:mode==='missing-owner'?'CONTEXT_STATE':'NATIVE_EXITED'});assert.equal(connects,1);assert.equal(host.rows[0].agentId,'original');
 });
});

test('snapshot and original-request reads never restart an exited OpenCode service',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-readonly-exited-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const calls=[];
 const backend={close(){},async call(method,p){calls.push({method,p});if(method==='snapshot')return {agents:{items:[{agentId:'original',healthy:false,startupError:{code:'NATIVE_UNAVAILABLE',message:'exited'}}]},tasks:[],conversations:[]};if(method==='ipc'&&p.op==='request')return {requestId:p.requestId,status:'unknown'};throw Error('read attempted mutation');}};
 const host=new MachineHost({directory,legacy:{close(){},async call(method){if(method==='snapshot')return {agents:{items:[]},tasks:[],conversations:[]};throw Object.assign(Error('missing'),{code:'NOT_FOUND'});}},openCode:()=>backend});t.after(()=>host.close());
 host.rows=[{contextId:'original-context',agentId:'original',adapter:'opencode'}];
 assert.equal((await host.call('snapshot')).agents.items[0].healthy,false);assert.equal((await host.call('ipc',{op:'request',requestId:'original-request'})).status,'unknown');
 assert(calls.every(c=>c.method==='snapshot'||c.method==='ipc'&&c.p.op==='request'));assert.equal(host.rows[0].agentId,'original');
});
