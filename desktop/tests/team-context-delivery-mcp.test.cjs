const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process'), { createInterface } = require('node:readline');
const runtime = process.env.AGENTBRIDGE_VERIFY_CONTEXT_RUNTIME;
const runtimeFile = file => runtime ? path.join(runtime, 'desktop/electron', file) : path.join(__dirname, '../electron', file);
const { createCoordinatorService } = require(runtimeFile('coordinator-service.cjs'));
const { digest } = require(runtimeFile('graph-layout.cjs'));
function client(configuration) {
  const child = spawn(configuration.command, configuration.args, { env: { ...process.env, ...configuration.env }, stdio: ['pipe','pipe','pipe'] });
  const lines = createInterface({ input: child.stdout }), pending = new Map(); let id = 0;
  child.stderr.resume();
  const failPending = () => { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(Error('Original MCP client exited')); } pending.clear(); };
  child.on('error', failPending); child.on('exit', failPending);
  lines.on('line', line => { const value = JSON.parse(line), item = pending.get(value.id); if (item) { pending.delete(value.id); clearTimeout(item.timer); item.resolve(value); } });
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const current = ++id, timer = setTimeout(() => { pending.delete(current); reject(Error('Original MCP response remains unconfirmed')); }, 10000);
    pending.set(current, { resolve, reject, timer }); child.stdin.write(JSON.stringify({jsonrpc:'2.0', id:current, method, params})+'\n');
  });
  return { request, async tool(name, args={}) { const reply = await request('tools/call', {name, arguments:args}); assert.equal(reply.error, undefined); return JSON.parse(reply.result.content[0].text); },
    async close() { lines.close(); failPending(); if (child.exitCode !== null) return; const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; } };
}
test('two production stdio clients send, retrieve and acknowledge original packets across broker/SQLite restart without execution', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-context-mcp-'));
  const options = {directory, network:{close(){},node(){throw Error('Context delivery must not execute native nodes');}}};
  let service=createCoordinatorService(options),aClient,bClient;
  t.after(async()=>{await aClient?.close();await bClient?.close();service.close();fs.rmSync(directory,{recursive:true,force:true});});
  let serial=0;
  const call=async(method,params={})=>{const reply=await service.call({method:'team.'+method,params:{operationId:'setup-'+ ++serial,...params}});assert.equal(reply.ok,true,reply.error?.code);return reply.result;};
  const a=await call('registerAgent',{kind:'mcp',externalKey:'controlled-sender',name:'发送成员',purpose:'选择版本'}),b=await call('registerAgent',{kind:'mcp',externalKey:'controlled-recipient',name:'接收成员',purpose:'确认原包'});
  const team=await call('createTeam',{name:'传递小队',leaderId:a.agentId,memberIds:[a.agentId,b.agentId]}),run=await call('createRun',{teamId:team.teamId,name:'原工作',goal:'准确旧版',acceptance:'接收不代替业务验收'});
  const doc=await call('writeDocument',{runId:run.runId,title:'第一版',content:'ACTUAL_STDIO_OLD_BODY',expectedRevision:0});
  await call('writeDocument',{runId:run.runId,documentId:doc.documentId,title:'第二版',content:'ACTUAL_STDIO_LATEST_BODY',expectedRevision:1});
  const ca=await call('connect',{runId:run.runId,agentId:a.agentId}),cb=await call('connect',{runId:run.runId,agentId:b.agentId});
  const open=async()=>{aClient=client(ca.configuration);bClient=client(cb.configuration);for(const c of [aClient,bClient])await c.request('initialize',{protocolVersion:'2025-03-26'});};await open();
  const tools=(await bClient.request('tools/list')).result.tools;assert.equal(tools.length,22);assert(tools.some(x=>x.name==='team_ack_context'&&!x.annotations.readOnlyHint));
  const selection={targetAgentId:b.agentId,selections:{documents:[{documentId:doc.documentId,revision:1}]}},packet=await aClient.tool('team_context_packet',selection);
  const send={operationId:'stdio-original-send',packetId:packet.packetId,...selection},transfer=await aClient.tool('team_send_context',send);
  assert.equal(transfer.stage,'pending_receipt');assert(!Object.hasOwn(transfer,'deliveryProof'));
  const got=await bClient.tool('team_context_transfer',{transferId:transfer.transferId});assert.equal(got.packet.documents[0].content,'ACTUAL_STDIO_OLD_BODY');assert(got.deliveryProof?.length===64,'Recipient got the private proof');
  const ack={operationId:'stdio-original-ack',transferId:transfer.transferId,packetId:packet.packetId,deliveryProof:got.deliveryProof,contentSha256:digest(got.packet)};
  const confirmed=await bClient.tool('team_ack_context',ack);assert.equal(confirmed.stage,'acknowledged');assert.equal(confirmed.businessAccepted,false);
  await aClient.close();await bClient.close();service.close();service=createCoordinatorService(options);await open();
  assert.deepEqual(await aClient.tool('team_send_context',send),transfer);
  assert.deepEqual(await bClient.tool('team_ack_context',ack),confirmed);
  assert.equal((await aClient.tool('team_context_transfers')).items.length,1);
  const receipt=await bClient.tool('team_operation',{operationId:ack.operationId});assert.equal(receipt.operationId,ack.operationId);assert.equal(receipt.data.transferId,transfer.transferId);assert(!JSON.stringify(receipt).includes(got.deliveryProof),'Proof is absent from the durable public receipt');
  const context=await call('context',{runId:run.runId});assert.equal(context.attempts.length,0);assert.equal(context.workItems.length,0);assert.equal(context.messages.length,1);
  await call('revokeMember',{runId:run.runId,agentId:b.agentId,expectedRevision:1});
  assert.equal((await bClient.tool('team_context_transfer',{transferId:transfer.transferId})).error.code,'TEAM_FORBIDDEN');
  assert.equal((await bClient.tool('team_ack_context',ack)).error.code,'TEAM_FORBIDDEN');
});
