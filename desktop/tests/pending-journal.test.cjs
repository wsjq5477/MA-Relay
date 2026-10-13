const test = require("node:test"), assert = require("node:assert/strict");
const { recoverJournal } = require("../electron/pending-journal.cjs");
const row = (extra = {}) => ({ id: "original", op: "continue", state: "unknown", machineId: "wsl", params: { conversationId: "parent" }, ...extra });
const missing = () => { throw Object.assign(new Error("not found"), { code: "NOT_FOUND" }); };
test("accepted original request is confirmed by its receipt without sending a prompt", async () => {
 const calls=[],updates=[];
 const r=await recoverJournal([row()],async(m,p)=>{calls.push(p);return {requestId:'original',taskId:'task',machineId:'wsl'};},async(...u)=>{updates.push(u);return true;});
 assert.equal(r.resolved,1);assert.deepEqual(calls.map(c=>c.op),['request']);assert.equal(updates[0][1],'confirmed');
});
test("request receipt from another identity or source cannot clear the warning", async () => {
 for(const receipt of [{requestId:'other',taskId:'task'},{requestId:'original',taskId:'task',machineId:'windows'},{}]){
  const r=await recoverJournal([row()],async()=>receipt,()=>{throw Error('unexpected settlement');});assert.equal(r.resolved,0);
 }
});
test("missing ordinary submission stays unknown", async () => {
 const r=await recoverJournal([row({op:'submit'})],missing,()=>{throw Error('unexpected settlement');},()=>true);assert.equal(r.resolved,0);
});
test("missing legacy WSL verification continuation is rejected only after checking its exact immutable parent", async () => {
 const calls=[],updates=[];
 const original=row();
 const r=await recoverJournal([original],async(m,p)=>{calls.push(p);if(p.op==='request')return missing();return {conversationId:'wsl::parent',turns:1,items:[{verification:true}]};},async(...u)=>{updates.push(u);return true;},()=>true);
 assert.equal(r.resolved,1);assert.deepEqual(calls.map(c=>c.op),['request','conversation']);assert(calls.every(c=>c.machineId==='wsl'));assert.equal(updates[0][1],'rejected');assert.equal(original.state,'unknown');
});
test("missing receipt with normal, different, or incomplete parent remains unknown", async () => {
 for(const parent of [{conversationId:'other',turns:1,items:[{verification:true}]},{conversationId:'parent',turns:1,items:[{verification:false}]},{conversationId:'parent',turns:2,items:[{verification:true}]},{conversationId:'parent',turns:1}]){
  const r=await recoverJournal([row()],async(m,p)=>p.op==='request'?missing():parent,()=>{throw Error('unexpected settlement');},()=>true);assert.equal(r.resolved,0);
 }
});
test("verification parent rejection cannot be assumed for Windows or unknown host contracts", async()=>{
 const calls=[];
 const r=await recoverJournal([row({machineId:'windows'})],async(m,p)=>{calls.push(p);return missing();},()=>{throw Error('unexpected settlement');});
 assert.equal(r.resolved,0);assert.deepEqual(calls.map(c=>c.op),['request']);
});
test("control receipts settle only confirmed or rejected original operation IDs", async()=>{
 for(const state of ['confirmed','rejected','unknown']){
  const calls=[],updates=[];
  const r=await recoverJournal([row({op:'cancel',params:{taskId:'task'}})],async(m,p)=>{calls.push(p);return {operationId:'original',state};},async(...u)=>{updates.push(u);return true;});
  assert.deepEqual(calls.map(c=>c.op),['operation']);assert.equal(r.resolved,state==='unknown'?0:1);
 }
});
test("offline transport and missing machine provenance preserve all unknown records", async()=>{
 for(const item of [row(),row({machineId:undefined})]){
  const r=await recoverJournal([item],async()=>{throw Error('offline');},()=>{throw Error('unexpected settlement');});assert.equal(r.resolved,0);
 }
});
test("a concurrent ledger update is not counted as a successful settlement", async()=>{
 const r=await recoverJournal([row()],async()=>({taskId:'task',requestId:'original'}),async()=>false);assert.equal(r.resolved,0);
});
test('original durable unhealthy rejection settles the original request only; transport and absent receipts cannot',async()=>{
 for(const code of ['AGENT_UNHEALTHY','NOT_FOUND','DESKTOP_UNCONFIRMED','DESKTOP_TRANSPORT']){
  const calls=[],updates=[];
  const result=await recoverJournal([row({op:'submit',machineId:'ssh-original'})],async(m,p)=>{calls.push(p);throw Object.assign(Error('original lookup'),{code});},async(...args)=>{updates.push(args);return true;});
  assert.deepEqual(calls,[{op:'request',requestId:'original',machineId:'ssh-original'}]);
  assert.equal(result.resolved,code==='AGENT_UNHEALTHY'?1:0);
  if(updates.length)assert.equal(updates[0][1],'rejected');
 }
});
