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
