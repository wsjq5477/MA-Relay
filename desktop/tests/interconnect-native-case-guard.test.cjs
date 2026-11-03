const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {verifyPreviousAttempts}=require('./interconnect-native-case-guard.cjs');
function fixture(t){assert.ok(!/^c:/i.test(os.tmpdir()));const root=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-native-case-'));t.after(()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true});});return {root,write(file,data){const f=path.join(root,file);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data));}};}
test('a new native attempt is allowed only after original parent intents and executions are terminal',t=>{
 const f=fixture(t);f.write('parent/codex-state.json',{tasks:[{requestId:'original',taskId:'task',status:'failed'}]});f.write('checkpoint.json',{rounds:[{requestId:'original',taskId:'task',intent:true}]});f.write('coordinator/agent-network.json',{delegations:[]});assert.doesNotThrow(()=>verifyPreviousAttempts(f.root,'2'));
 f.write('parent/codex-state.json',{tasks:[{requestId:'original',taskId:'task',status:'unknown'}]});assert.throws(()=>verifyPreviousAttempts(f.root,'2'),{code:'ORIGINAL_PARENT_UNRESOLVED_QUERY_ONLY'});
});
test('a saved intent without its original request record cannot be bypassed with another attempt',t=>{
 const f=fixture(t);f.write('checkpoint.json',{rounds:[{requestId:'unresolved',intent:true}]});assert.throws(()=>verifyPreviousAttempts(f.root,'2'),{code:'ORIGINAL_PARENT_UNRESOLVED_QUERY_ONLY'});
 f.write('parent/codex-state.json',{tasks:[]});assert.throws(()=>verifyPreviousAttempts(f.root,'2'),{code:'ORIGINAL_PARENT_UNRESOLVED_QUERY_ONLY'});
});
test('an unresolved original child blocks another attempt even when its parent ended',t=>{
 const f=fixture(t);f.write('parent/codex-state.json',{tasks:[{requestId:'original',taskId:'task',status:'failed'}]});f.write('coordinator/agent-network.json',{delegations:[{state:'unknown'}]});assert.throws(()=>verifyPreviousAttempts(f.root,'2'),{code:'ORIGINAL_CHILD_UNRESOLVED_QUERY_ONLY'});
});
test('the same saved attempt can be observed without treating it as permission for a new native attempt',t=>{
 const f=fixture(t);f.write('parent/codex-state.json',{tasks:[{requestId:'first',taskId:'first-task',status:'failed'}]});f.write('parent-attempt2/codex-state.json',{tasks:[{requestId:'original-second',taskId:'second-task',status:'running'}]});f.write('checkpoint-attempt2.json',{rounds:[{requestId:'original-second',taskId:'second-task',intent:true}]});assert.doesNotThrow(()=>verifyPreviousAttempts(f.root,'2'));assert.throws(()=>verifyPreviousAttempts(f.root,'3'),{code:'ORIGINAL_PARENT_UNRESOLVED_QUERY_ONLY'});
});
test('resuming the same saved caller context may observe its unresolved child but cannot adopt another context',t=>{
 const f=fixture(t);f.write('parent/codex-state.json',{tasks:[{requestId:'first',taskId:'first-task',status:'failed'}]});f.write('checkpoint-attempt2.json',{contextId:'second-context',rounds:[{requestId:'second',intent:true}]});f.write('coordinator/agent-network.json',{delegations:[{callerContextId:'second-context',state:'unknown'}]});assert.doesNotThrow(()=>verifyPreviousAttempts(f.root,'2'));
 f.write('coordinator/agent-network.json',{delegations:[{callerContextId:'different-context',state:'unknown'}]});assert.throws(()=>verifyPreviousAttempts(f.root,'2'),{code:'ORIGINAL_CHILD_UNRESOLVED_QUERY_ONLY'});
});
