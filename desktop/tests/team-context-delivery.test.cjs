const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=process.env.AGENTBRIDGE_VERIFY_CONTEXT_RUNTIME,runtimeFile=file=>root?path.join(root,'desktop/electron',file):path.join(__dirname,'../electron',file),TeamSpace=require(runtimeFile('team-space.cjs')).TeamSpace;
async function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-context-delivery-')),sessions=[];let space;const open=()=>new TeamSpace({directory,configure:async s=>{sessions.push(s);return {command:'controlled-context-client'};},execute:()=>assert.fail('Context delivery cannot execute a model')});space=open();t.after(()=>{space.close();fs.rmSync(directory,{recursive:true,force:true});});let serial=0;const call=(m,p={})=>space.call('team.'+m,{operationId:'setup-'+ ++serial,...p});const agents=[];for(const key of ['sender','recipient','unrelated'])agents.push(await call('registerAgent',{kind:'mcp',externalKey:'controlled-'+key,name:key,purpose:'No native execution'}));const [a,b,c]=agents,team=await call('createTeam',{name:'context delivery',leaderId:a.agentId,memberIds:agents.map(a=>a.agentId)}),run=await call('createRun',{teamId:team.teamId,name:'original work',goal:'Receive exact selected materials',acceptance:'Receipt does not mean business acceptance'});for(const agent of agents)await call('connect',{runId:run.runId,agentId:agent.agentId});const tool=(agent,name,p={})=>space.tool(sessions.find(s=>s.agentId===agent.agentId).sessionId,'team_'+name,p);const doc=await call('writeDocument',{runId:run.runId,title:'original title',content:'ORIGINAL_SELECTED_BODY',expectedRevision:0});await call('writeDocument',{runId:run.runId,documentId:doc.documentId,title:'current title',content:'CURRENT_UNSELECTED_BODY',expectedRevision:1});const selection={targetAgentId:b.agentId,selections:{documents:[{documentId:doc.documentId,revision:1}]}},packet=await tool(a,'context_packet',selection);return {directory,sessions,agents,a,b,c,run,doc,call,tool,selection,packet,get space(){return space;},restart(){space.close();space=open();}};}
async function send(f,extra={}){return f.tool(f.a,'send_context',{operationId:'original-send',...f.selection,packetId:f.packet.packetId,...extra});}
async function receive(f,transfer){return f.tool(f.b,'context_transfer',{transferId:transfer.transferId});}
function ack(f,transfer,received,extra={}){return f.tool(f.b,'ack_context',{operationId:'original-ack',transferId:transfer.transferId,packetId:transfer.packetId,deliveryProof:received.deliveryProof,contentSha256:require(runtimeFile('graph-layout.cjs')).digest(received.packet),...extra});}
test('explicit send persists a version packet; only the recipient can acknowledge the exact retrieved body',async t=>{const f=await fixture(t),before=f.space.read(),transfer=await send(f);assert.equal(transfer.stage,'pending_receipt');assert.equal(transfer.executionStarted,false);assert.equal(transfer.grantsAccess,false);assert(!Object.hasOwn(transfer,'deliveryProof'));const queued=await f.tool(f.b,'context_transfers');assert.equal(queued.items.length,1);assert.equal(queued.items[0].packetId,f.packet.packetId);assert(!JSON.stringify(queued).includes('ORIGINAL_SELECTED_BODY'));const got=await receive(f,transfer);assert.equal(got.packet.documents[0].content,'ORIGINAL_SELECTED_BODY');assert.equal(got.packet.target.agentId,f.b.agentId);assert(typeof got.deliveryProof==='string'&&got.deliveryProof.length===64,'Recipient receives an opaque receipt challenge');const confirmed=await ack(f,transfer,got);assert.equal(confirmed.stage,'acknowledged');assert.equal(confirmed.evidence,'recipient_acknowledgement');assert.equal(confirmed.businessAccepted,false);assert.equal((await f.tool(f.a,'context_transfers')).items[0].stage,'acknowledged');assert.deepEqual(f.space.read(),before);});
test('original send and acknowledgement survive restart and response loss without duplicates or proof leakage',async t=>{const f=await fixture(t),transfer=await send(f);f.restart();assert.deepEqual(await send(f),transfer);assert.equal(f.space.db.prepare('SELECT count(*) AS n FROM context_transfers').get().n,1);const receipt=await f.tool(f.a,'operation',{operationId:'original-send'});assert.equal(receipt.operationId,'original-send');assert.equal(receipt.data.transferId,transfer.transferId);const got=await receive(f,transfer),proof=got.deliveryProof,confirmed=await ack(f,transfer,got);f.restart();assert.deepEqual(await ack(f,transfer,got),confirmed);assert((await receive(f,transfer)).deliveryProof===proof,'Original recipient challenge survives restart');assert.equal((await f.tool(f.b,'operation',{operationId:'original-ack'})).data.stage,'acknowledged');for(const result of [await f.call('contextTransfer',{runId:f.run.runId,transferId:transfer.transferId}),await f.tool(f.a,'context_transfer',{transferId:transfer.transferId}),await f.tool(f.a,'operation',{operationId:'original-send'}),await f.tool(f.b,'operation',{operationId:'original-ack'})])assert(!JSON.stringify(result).includes(proof),'Proof is absent from audit/operation receipts');});
test('stale preview, changed original input, forged identities and blind/wrong acknowledgements do not commit',async t=>{const f=await fixture(t);await assert.rejects(send(f,{packetId:'0'.repeat(64)}),{code:'TEAM_CONTEXT_STALE'});assert.equal(f.space.db.prepare('SELECT count(*) AS n FROM context_transfers').get().n,0);const transfer=await send(f);await assert.rejects(send(f,{targetAgentId:f.a.agentId}),{code:'TEAM_OPERATION_CONFLICT'});await assert.rejects(f.tool(f.b,'ack_context',{operationId:'blind-ack',transferId:transfer.transferId,packetId:transfer.packetId,deliveryProof:'0'.repeat(64),contentSha256:'0'.repeat(64)}),{code:'TEAM_CONTEXT_RECEIPT'});await assert.rejects(send(f,{operationId:'forged',senderId:f.b.agentId}),{code:'TEAM_INPUT'});const got=await receive(f,transfer);await assert.rejects(ack(f,transfer,got,{contentSha256:'0'.repeat(64)}),{code:'TEAM_CONTEXT_RECEIPT'});await assert.rejects(f.call('ackContext',{runId:f.run.runId,transferId:transfer.transferId,packetId:transfer.packetId,deliveryProof:got.deliveryProof,contentSha256:require(runtimeFile('graph-layout.cjs')).digest(got.packet)}),{code:'TEAM_FORBIDDEN'});assert.equal((await f.tool(f.a,'context_transfers')).items[0].stage,'pending_receipt');});
test('same-work unrelated members and foreign work cannot list/read/ack transfers; revoke denies cached recipient access',async t=>{const f=await fixture(t),transfer=await send(f),got=await receive(f,transfer);assert.equal((await f.tool(f.c,'context_transfers')).items.length,0);await assert.rejects(f.tool(f.c,'context_transfer',{transferId:transfer.transferId}),{code:'TEAM_CONTEXT_TRANSFER'});await assert.rejects(f.tool(f.c,'ack_context',{operationId:'foreign-ack',transferId:transfer.transferId,packetId:transfer.packetId,deliveryProof:got.deliveryProof,contentSha256:require(runtimeFile('graph-layout.cjs')).digest(got.packet)}),{code:'TEAM_CONTEXT_TRANSFER'});const other=await f.call('createRun',{teamId:f.run.teamId,name:'other receipt scope',goal:'No cross-work reads',acceptance:'Original scope remains separate'});await f.call('connect',{runId:other.runId,agentId:f.b.agentId});const foreignSession=f.sessions.find(s=>s.runId===other.runId&&s.agentId===f.b.agentId).sessionId,foreign=(name,p={})=>f.space.tool(foreignSession,'team_'+name,p);assert.equal((await foreign('context_transfers')).items.length,0);await assert.rejects(foreign('context_transfer',{transferId:transfer.transferId}),{code:'TEAM_CONTEXT_TRANSFER'});await assert.rejects(foreign('ack_context',{operationId:'other-work-ack',transferId:transfer.transferId,packetId:transfer.packetId,deliveryProof:got.deliveryProof,contentSha256:require(runtimeFile('graph-layout.cjs')).digest(got.packet)}),{code:'TEAM_CONTEXT_TRANSFER'});await assert.rejects(foreign('context_transfers',{runId:f.run.runId}),{code:'TEAM_FORBIDDEN'});await f.call('revokeMember',{runId:f.run.runId,agentId:f.b.agentId,expectedRevision:1});await assert.rejects(receive(f,transfer),{code:'TEAM_FORBIDDEN'});await assert.rejects(ack(f,transfer,got),{code:'TEAM_FORBIDDEN'});const audit=await f.call('contextTransfers',{runId:f.run.runId});assert.equal(audit.items[0].recipientAuthorized,false);assert.equal(audit.items[0].stage,'pending_receipt');assert.equal(f.space.read().requests,undefined);});


test('sent snapshot remains original after source edits, run revisions and a recipient acknowledgement with a new operation ID',async t=>{
  const f=await fixture(t),transfer=await send(f),got=await receive(f,transfer);
  await f.call('writeDocument',{runId:f.run.runId,documentId:f.doc.documentId,title:'later title',content:'LATER_UNSELECTED_BODY',expectedRevision:2});
  await f.call('pause',{runId:f.run.runId,paused:true});
  const later=await receive(f,transfer);assert.deepEqual(later.packet,got.packet);
  const confirmed=await ack(f,transfer,got),again=await ack(f,transfer,got,{operationId:'explicit-repeat-ack'});
  assert.deepEqual(again,confirmed);assert.equal((await send(f)).stage,'pending_receipt','Original send receipt stays immutable');
  const fresh=await f.tool(f.a,'context_packet',f.selection);
  assert.notEqual(fresh.packetId,f.packet.packetId);
  await assert.rejects(send(f,{operationId:'stale-new-send'}),{code:'TEAM_CONTEXT_STALE'});
  assert.equal(f.space.db.prepare('SELECT count(*) AS n FROM context_transfers').get().n,1);
});
test('foreign work, unrelated cursors, strict input shapes and bounded forward pages preserve read state',async t=>{
  const f=await fixture(t),first=await send(f),second=await send(f,{operationId:'explicit-second-send'});
  const before=f.space.db.prepare('SELECT body FROM state').get().body,count=f.space.db.prepare('SELECT count(*) AS n FROM receipts').get().n;
  const page=await f.tool(f.b,'context_transfers',{limit:1});assert.equal(page.items[0].transferId,first.transferId);assert.equal(page.hasMore,true);
  const last=await f.tool(f.b,'context_transfers',{limit:1,after:page.next});assert.equal(last.items[0].transferId,second.transferId);assert.equal(last.hasMore,false);
  for(const limit of [0,51,null,'1',1.5])await assert.rejects(f.tool(f.b,'context_transfers',{limit}),{code:'TEAM_INPUT'});
  await assert.rejects(f.tool(f.c,'context_transfers',{after:first.transferId}),{code:'TEAM_CONTEXT_TRANSFER'});
  await assert.rejects(f.tool(f.b,'context_transfer',{transferId:first.transferId,runId:'foreign-work'}),{code:'TEAM_FORBIDDEN'});
  const other=await f.call('createRun',{teamId:f.run.teamId,name:'foreign work',goal:'separate',acceptance:'no leak'});
  await assert.rejects(f.call('contextTransfer',{runId:other.runId,transferId:first.transferId}),{code:'TEAM_CONTEXT_TRANSFER'});
  for(const extra of [{sessionId:'forged'},{targetAgentId:f.a.agentId},{deliveryProof:'private'},{constructor:'forged'}])
    await assert.rejects(f.tool(f.b,'context_transfers',extra),{code:'TEAM_INPUT'});
  assert.equal(count+1,f.space.db.prepare('SELECT count(*) AS n FROM receipts').get().n);
  assert.notEqual(f.space.db.prepare('SELECT body FROM state').get().body,before,'Only explicit setup of another run changed state');
});
test('archived work permits user audit, denies member receipt/replay and denies new sending',async t=>{
  const f=await fixture(t),transfer=await send(f),got=await receive(f,transfer);
  await f.call('closeRun',{runId:f.run.runId});
  for(const operation of [()=>receive(f,transfer),()=>ack(f,transfer,got),()=>send(f)])await assert.rejects(operation(),{code:'TEAM_FORBIDDEN'});
  const original=await f.call('contextTransfer',{runId:f.run.runId,transferId:transfer.transferId});assert.equal(original.packet.packetId,f.packet.packetId);assert.equal(original.recipientAuthorized,false);assert(!Object.hasOwn(original,'deliveryProof'));
  await assert.rejects(f.call('sendContext',{runId:f.run.runId,operationId:'user-new-send',...f.selection,packetId:f.packet.packetId}),{code:'TEAM_CLOSED'});
});
test('unknown and terminal native scopes cannot read or acknowledge using a previously retrieved proof',async t=>{
  const f=await fixture(t),transfer=await send(f),got=await receive(f,transfer),session=f.sessions.find(s=>s.agentId===f.b.agentId);
  for(const state of ['unknown','succeeded','failed','cancelled']){
    const s=f.space.read();s.sessions.find(s=>s.sessionId===session.sessionId).kind='native';s.attempts=[{sessionId:session.sessionId,state}];
    f.space.db.prepare('UPDATE state SET body=? WHERE id=1').run(JSON.stringify(s));
    await assert.rejects(receive(f,transfer),{code:'TEAM_FORBIDDEN'});await assert.rejects(ack(f,transfer,got),{code:'TEAM_FORBIDDEN'});
  }
  assert.equal((await f.call('contextTransfers',{runId:f.run.runId})).items[0].stage,'pending_receipt');
});
test('capacity and write failures roll back packet/acknowledgement and original operation receipts atomically',async t=>{
  const f=await fixture(t),transfer=await send(f),got=await receive(f,transfer);
  f.space.db.exec("CREATE TRIGGER deny_transfer_update BEFORE UPDATE ON context_transfers BEGIN SELECT RAISE(ABORT,'controlled disk failure'); END");
  await assert.rejects(ack(f,transfer,got),/controlled disk failure/);
  assert.equal((await f.tool(f.b,'operation',{operationId:'original-ack'})).state,'not_found');
  assert.equal((await receive(f,transfer)).stage,'pending_receipt');f.space.db.exec('DROP TRIGGER deny_transfer_update');
  f.space.db.prepare('INSERT INTO context_transfers VALUES (?,?,?,?,?)').run('capacity-marker',f.run.runId,'user',f.b.agentId,' '.repeat(8*1024*1024));
  await assert.rejects(ack(f,transfer,got),{code:'TEAM_CONTEXT_CAPACITY'});
  await assert.rejects(send(f,{operationId:'capacity-send'}),{code:'TEAM_CONTEXT_CAPACITY'});
  assert.equal((await f.tool(f.a,'operation',{operationId:'capacity-send'})).state,'not_found');
  assert.equal((await f.tool(f.b,'operation',{operationId:'original-ack'})).state,'not_found');
  f.space.db.prepare('DELETE FROM context_transfers WHERE transfer_id=?').run('capacity-marker');
  assert.equal((await ack(f,transfer,got)).stage,'acknowledged');
});
test('row limit preserves all original transfers without evicting pending receipts',async t=>{
  const f=await fixture(t),transfer=await send(f),source=f.space.db.prepare('SELECT * FROM context_transfers WHERE transfer_id=?').get(transfer.transferId);
  f.space.db.exec('BEGIN');for(let i=1;i<256;i++){const id='controlled-'+i,x=JSON.parse(source.body);x.transferId=id;f.space.db.prepare('INSERT INTO context_transfers VALUES (?,?,?,?,?)').run(id,source.run_id,source.sender_id,source.target_id,JSON.stringify(x));}f.space.db.exec('COMMIT');
  await assert.rejects(send(f,{operationId:'limit-send'}),{code:'TEAM_CONTEXT_CAPACITY'});
  assert.equal(f.space.db.prepare('SELECT count(*) AS n FROM context_transfers').get().n,256);
  assert.equal((await receive(f,transfer)).packet.documents[0].content,'ORIGINAL_SELECTED_BODY');
});
test('corrupt original packet rejects reads and receipts instead of regenerating from current materials',async t=>{
  const f=await fixture(t),transfer=await send(f),got=await receive(f,transfer),row=f.space.db.prepare('SELECT body FROM context_transfers').get(),broken=JSON.parse(row.body);
  broken.packet.markdown+='CORRUPTED';f.space.db.prepare('UPDATE context_transfers SET body=?').run(JSON.stringify(broken));
  for(const operation of [()=>receive(f,transfer),()=>f.tool(f.a,'context_transfers'),()=>ack(f,transfer,got)])await assert.rejects(operation(),{code:'TEAM_CONTEXT_STATE'});
  assert.equal(f.space.db.prepare('SELECT body FROM context_transfers').get().body,JSON.stringify(broken),'Original corrupt bytes preserved');
});
test('transfer-only writes do not backfill activation events; legacy state-v3 SQL writer preserves the separate table',async t=>{
  const f=await fixture(t),s=f.space.read();
  s.runs[0].automation={enabled:true};f.space.db.prepare('UPDATE state SET body=?').run(JSON.stringify(s));
  const before=f.space.db.prepare('SELECT body FROM state').get().body,transfer=await send(f);await ack(f,transfer,await receive(f,transfer));
  assert.equal(f.space.db.prepare('SELECT body FROM state').get().body,before);
  const {DatabaseSync}=require('node:sqlite'),old=new DatabaseSync(path.join(f.directory,'team-space.sqlite'));
  try{const v=JSON.parse(old.prepare('SELECT body FROM state WHERE id=1').get().body);assert.equal(v.version,3);v.runs[0].paused=true;old.prepare('UPDATE state SET body=? WHERE id=1').run(JSON.stringify(v));}finally{old.close();}
  f.restart();assert.equal((await receive(f,transfer)).stage,'acknowledged');assert.equal(f.space.read().runs[0].paused,true);
});
test('new tools describe original identities and receipt boundaries; optional capability does not gate older calls',async()=>{
  const {teamTools}=require(runtimeFile('team-tools.cjs')),caps=require(runtimeFile('runtime-capabilities.cjs'));
  assert.equal(teamTools.length,22);
  for(const name of ['team_context_transfers','team_context_transfer'])assert.equal(teamTools.find(t=>t.name===name).annotations.readOnlyHint,true);
  for(const name of ['team_send_context','team_ack_context']){const tool=teamTools.find(t=>t.name===name);assert.equal(tool.annotations.readOnlyHint,false);assert.equal(tool.inputSchema.additionalProperties,false);assert(tool.inputSchema.required.includes('operationId'));}
  assert(caps.coordinatorRuntimeCapabilities.includes(caps.TEAM_CONTEXT_TRANSFER_CAPABILITY));assert(!caps.runtimeCapabilities.includes(caps.TEAM_CONTEXT_TRANSFER_CAPABILITY));
  assert(caps.supportsCurrentCoordinator(caps.coordinatorCapabilities));assert(!caps.supportsTeamContextTransfer(caps.coordinatorCapabilities));
  const {CoordinatorClient}=require(runtimeFile('coordinator-client.cjs')),client=new CoordinatorClient({directory:'/unused'});client.open=async()=>{};client.info={capabilities:caps.coordinatorCapabilities};
  for(const method of ['team.sendContext','team.contextTransfers','team.contextTransfer','team.ackContext'])await assert.rejects(client.request('call',{method,params:{}}),{code:'TEAM_CONTEXT_UPGRADE_REQUIRED'});
  assert.equal(client.pending.size,0);
});
