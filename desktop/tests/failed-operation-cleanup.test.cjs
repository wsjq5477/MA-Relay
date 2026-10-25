const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {GraphOperationJournal}=require('../electron/graph-operations.cjs');
const {digest}=require('../electron/graph-layout.cjs');
const timeout={code:'NATIVE_START_TIMEOUT',message:'OpenCode did not become ready within 20 seconds'};
function original(){const params={operationId:'original-timeout',nodeId:'original-node',machineId:'original-machine',action:'attach'};return {operationId:params.operationId,lane:'node',method:'manageNode',params,fingerprint:digest(params),state:'unknown',time:'2026-10-19T08:23:00.000Z',error:{...timeout}};}
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-failed-cleanup-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return {directory,journal:new GraphOperationJournal(directory)};}
test('historical original startup failure releases only local admission and allows a later explicit attach after restart',async t=>{
 const {directory,journal}=fixture(t),row=original(),other={...original(),operationId:'other-unknown',error:{code:'DESKTOP_TRANSPORT',message:'ACK lost'}};
 other.params={...other.params,operationId:other.operationId,nodeId:'other-node',machineId:'other-machine'};other.fingerprint=digest(other.params);
 journal.update(row);journal.update(other);const calls=[];
 const restored=new GraphOperationJournal(directory),receipt=await restored.lookup('nodeOperation',{operationId:row.operationId},async(method,params)=>{calls.push({method,params});return {operationId:params.operationId,state:'not_found'};});
 assert.equal(receipt.state,'rejected');assert.deepEqual(receipt.error,timeout);
 assert.deepEqual(restored.read()[0],{...row,state:'rejected'});assert.deepEqual(restored.pending(),[other]);
 assert.deepEqual(calls,[{method:'nodeOperation',params:{operationId:row.operationId}}]);
 let writes=0;await new GraphOperationJournal(directory).save('manageNode',{...row.params,operationId:'explicit-next-attach'},async(method,params)=>{
  assert.equal(method,'manageNode');writes++;return {operationId:params.operationId,state:'confirmed'};
 });
 assert.equal(writes,1);assert.deepEqual(new GraphOperationJournal(directory).read()[0],{...row,state:'rejected'});
});
test('a new exact startup refusal becomes rejected immediately rather than blocking all later attaches',async t=>{
 const {journal}=fixture(t);let calls=0;
 await assert.rejects(journal.save('manageNode',original().params,async()=>{calls++;throw Object.assign(Error(timeout.message),timeout);}),{code:timeout.code});
 assert.equal(calls,1);assert.deepEqual(journal.pending(),[]);assert.equal(journal.read()[0].state,'rejected');
});
test('cleanup retains uncertainty without exact original startup proof, identity, fingerprint and original not_found',async t=>{
 for(const mode of ['missing-error','generic-timeout','transport','query-timeout','fingerprint','changed-node','changed-machine','changed-id','disconnect','other-method','other-lane','missing-source','foreign-receipt','unknown-receipt','pending-receipt'])await t.test(mode,async t=>{
  const {journal}=fixture(t),row=original();
  if(mode==='missing-error')delete row.error;
  if(mode==='generic-timeout')row.error.message='timeout';
  if(mode==='transport')row.error.code='DESKTOP_TRANSPORT';
  if(mode==='query-timeout')delete row.error;
  if(mode==='fingerprint')row.fingerprint='wrong';
  if(mode==='changed-node')row.params.nodeId='foreign';
  if(mode==='changed-machine')row.params.machineId='foreign';
  if(mode==='changed-id'){row.params.operationId='foreign';row.fingerprint=digest(row.params);}
  if(mode==='disconnect'){row.params.action='disconnect';row.fingerprint=digest(row.params);}
  if(mode==='other-method')row.method='nodeRequest';
  if(mode==='other-lane')row.lane='machine';
  if(mode==='missing-source'){delete row.params.machineId;row.fingerprint=digest(row.params);}
  journal.update(row);const dispatch=async()=>{if(mode==='query-timeout')throw Object.assign(Error(timeout.message),timeout);return {operationId:mode==='foreign-receipt'?'foreign':row.operationId,state:mode==='unknown-receipt'?'unknown':mode==='pending-receipt'?'pending':'not_found'};};
  if(mode==='query-timeout')await assert.rejects(journal.lookup('nodeOperation',{operationId:row.operationId},dispatch));else await journal.lookup('nodeOperation',{operationId:row.operationId},dispatch);
  assert.deepEqual(journal.pending(),[row]);
 });
});
test('a matching actual receipt wins over historical startup error and a foreign source cannot release it',async t=>{
 const {journal}=fixture(t),row=original();journal.update(row);
 await assert.rejects(journal.lookup('nodeOperation',{operationId:row.operationId},async()=>({operationId:row.operationId,state:'confirmed',data:{nodeId:'foreign'}})),{code:'RECEIPT_MISMATCH'});
 assert.deepEqual(journal.pending(),[row]);
 const receipt={operationId:row.operationId,state:'confirmed',data:{nodeId:row.params.nodeId,machineId:row.params.machineId}};
 assert.deepEqual(await journal.lookup('nodeOperation',{operationId:row.operationId},async()=>receipt),receipt);
 await journal.lookup('nodeOperation',{operationId:row.operationId},async()=>({operationId:row.operationId,state:'not_found'}));
 assert.equal(journal.read()[0].state,'confirmed');
});
