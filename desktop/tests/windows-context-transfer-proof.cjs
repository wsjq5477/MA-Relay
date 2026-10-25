// Optional proof for the isolated ordinary EXE verifier. All writes use its
// authenticated production RPC or its original member's actual stdio MCP scope.
const assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process'),{createInterface}=require('node:readline');
async function seed(call,runId,agentId,runtimeRoot){
 const context=await call('team.context',{runId}),selection={runId,targetAgentId:agentId,selections:{documents:[{documentId:context.documents[0].documentId,revision:1}]}},packet=await call('team.contextPacket',selection);
 const transfer=await call('team.sendContext',{...selection,operationId:'portable-original-context-send',packetId:packet.packetId});
 const connection=await call('team.connect',{operationId:'portable-context-recipient',runId,agentId});
 const child=spawn(connection.configuration.command,connection.configuration.args,{env:{...process.env,...connection.configuration.env},stdio:['pipe','pipe','pipe'],windowsHide:true}),lines=createInterface({input:child.stdout}),pending=new Map();let id=0;
 child.stderr.resume();
 const rejectPending=()=>{for(const x of pending.values()){clearTimeout(x.timer);x.reject(Error('Original scoped stdio client exited'));}pending.clear();};child.once('error',rejectPending);child.once('exit',rejectPending);
 lines.on('line',line=>{const r=JSON.parse(line),x=pending.get(r.id);if(x){pending.delete(r.id);clearTimeout(x.timer);x.resolve(r);}});
 const request=(method,params={})=>new Promise((resolve,reject)=>{const current=++id,timer=setTimeout(()=>{pending.delete(current);reject(Error('Original scoped stdio receipt unconfirmed'));},15000);pending.set(current,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:current,method,params})+'\n');});
 const tool=async(name,args)=>{const r=await request('tools/call',{name,arguments:args});assert.equal(r.error,undefined);const data=JSON.parse(r.result.content[0].text);assert.equal(data.error,undefined);return data;};
 try{
  await request('initialize',{protocolVersion:'2025-03-26'});
  const got=await tool('team_context_transfer',{transferId:transfer.transferId});
  const digest=require(path.join(runtimeRoot,'desktop/electron/graph-layout.cjs')).digest;
  const ack=await tool('team_ack_context',{operationId:'portable-original-context-ack',transferId:transfer.transferId,packetId:packet.packetId,deliveryProof:got.deliveryProof,contentSha256:digest(got.packet)});
  assert.equal(ack.stage,'acknowledged');assert.equal(ack.businessAccepted,false);
  return {runId,transferId:transfer.transferId,packet,receipt:await call('team.operation',{operationId:'portable-original-context-send'}),ack};
 }finally{lines.close();rejectPending();if(child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}}
}
async function verify(call,proof){
 const read=await call('team.contextTransfer',{runId:proof.runId,transferId:proof.transferId});
 assert.deepEqual(read.packet,proof.packet);assert.equal(read.stage,'acknowledged');assert.equal(read.acknowledgedAt,proof.ack.acknowledgedAt);assert(!Object.hasOwn(read,'deliveryProof'));
 assert.deepEqual(await call('team.operation',{operationId:'portable-original-context-send'}),proof.receipt);
 const list=await call('team.contextTransfers',{runId:proof.runId});assert.equal(list.items.length,1);assert.equal(list.items[0].transferId,proof.transferId);
}
module.exports={seed,verify};
