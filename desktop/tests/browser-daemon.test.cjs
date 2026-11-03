'use strict';
const {linuxTest}=require('./platform-test.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {fork}=require('node:child_process');
const {WebSocket}=require('ws');
const {FramedStream}=require('../electron/machine-protocol.cjs');
const {socketPathFor}=require('../electron/machine-daemon.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){const end=Date.now()+15000;while(Date.now()<end){if(await check())return;await pause(50);}throw Error('Browser daemon fixture timed out');}
async function spawnNode(options,children){
  const child=fork(path.join(__dirname,'browser-daemon-fixture.cjs'),{stdio:['ignore','ignore','ignore','ipc']});children.add(child);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Child startup timed out')),20000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('message',result=>{clearTimeout(timer);resolve({child,...result});});child.send({type:'start',options});
  });
}
async function stopChild(child){
  if(child.exitCode!==null||child.signalCode)return;
  await new Promise(resolve=>{
    const timer=setTimeout(()=>child.kill('SIGTERM'),5000);
    child.once('exit',()=>{clearTimeout(timer);resolve();});
    if(child.connected)child.send({type:'close'});else child.kill('SIGTERM');
  });
}
async function connect(options,channels){
  const socket=net.createConnection(socketPathFor(options.stateDirectory)),channel=new FramedStream(socket),pending=new Map();let next=0;channels.add(channel);
  const abort=()=>{for(const job of pending.values()){clearTimeout(job.timer);job.reject(Error('Fixture RPC disconnected'));}pending.clear();};
  channel.on('error',abort);channel.on('close',abort);
  channel.on('frame',frame=>{
    const job=pending.get(frame.id);if(!job)return;pending.delete(frame.id);clearTimeout(job.timer);
    frame.error?job.reject(Object.assign(Error(frame.error.code),{code:frame.error.code})):job.resolve(frame.result);
  });
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const id='fixture-'+(++next),timer=setTimeout(()=>{pending.delete(id);reject(Error('Fixture RPC timed out'));},15000);
    pending.set(id,{resolve,reject,timer});channel.send({id,method,params});
  });
  const peer=await call('hello',{protocolVersion:2,coordinatorId:options.ownerCoordinatorId,profileId:options.profileId,nonce:'isolated-browser-fixture'});
  return {channel,call,peer};
}
linuxTest('independent Linux processes retain one browser listener and recover original close by query only', {timeout:120000},async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-browser-daemon-')),children=new Set(),channels=new Set(),browsers=new Set();
  t.after(async()=>{for(const browser of browsers)browser.close();for(const channel of channels)channel.close();for(const child of children)await stopChild(child);fs.rmSync(directory,{recursive:true,force:true});});
  const options={stateDirectory:path.join(directory,'state'),ownerCoordinatorId:'fixture-coordinator',profileId:'fixture-profile',monitorIntervalMs:0};
  const first=await spawnNode(options,children);assert.equal(first.type,'ready');let rpc=await connect(options,channels);
  assert.ok(rpc.peer.capabilities.includes('browser-session-health-v1'));assert.ok(rpc.peer.capabilities.includes('browser-session-close-v1'));
  const extensionId='a'.repeat(32),origin='chrome-extension://'+extensionId;
  const pair=await rpc.call('browser.pair',{extensionId,operationId:'pair-original'});
  const {BrowserClient}=await import('../../browser-extension/src/background/client.mjs');
  class Socket extends WebSocket {constructor(url){super(url,{origin});}}
  let credential,browser,sends=0,closes=0;const closeReceipts=new Map(),commands=[],eventReceipts=[];
  const clientOptions={origin,WebSocket:Socket,persist:async c=>{credential=c;},onEventReceipt:async r=>{eventReceipts.push(r);},onCommand:async(method,p)=>{
    commands.push(method);const base={requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId};
    if(method==='health.check')return p.bridgeSessionId?{...base,probeId:p.probeId,adapterId:p.adapterId,browserInstanceId:p.browserInstanceId,enabled:true,domChecked:!closeReceipts.size,pageReady:!closeReceipts.size,sessionClosed:closeReceipts.size>0,blocked:false,loginChecked:false}:{enabled:true};
    if(method==='message.send'){
      sends++;const meta=Object.fromEntries(['requestId','taskId','executionId','bridgeSessionId','browserInstanceId','bindingRevision','leaseEpoch'].map(k=>[k,p[k]]));
      await browser.sendEvent({...meta,seq:1,kind:'submitted',binding:{sessionKey:'fixture-session',userAnchor:'fixture-user',documentId:'fixture-document'}});
      await browser.sendEvent({...meta,seq:2,kind:'completed',text:'Controlled Linux browser result',continuation:{transcriptFingerprint:'a'.repeat(64),assistantAnchor:'assistant-linux',historyRevision:2}});
    }
    if(method==='session.close'){closes++;closeReceipts.set(p.operationId,{operationId:p.operationId,method:'session.close',state:'confirmed',result:{...base,closed:true}});throw Error('BROWSER_TEST_LOST_CLOSE_REPLY');}
    if(method==='operation.get')return closeReceipts.get(p.operationId);
    return base;
  }};
  browser=new BrowserClient(pair,clientOptions);browsers.add(browser);await browser.open();
  const second=await spawnNode(options,children);assert.equal(second.type,'rejected');assert.equal(second.code,'DAEMON_ALREADY_RUNNING');await stopChild(second.child);
  assert.equal((await rpc.call('browser.status')).endpoint.url,pair.url);assert.equal((await rpc.call('browser.pair',{extensionId,operationId:'pair-original',queryOnly:true})).browserInstanceId,pair.browserInstanceId);
  const context=await rpc.call('context',{nodeId:'fixture-browser-node',adapter:'chatgpt-web',browserInstanceId:pair.browserInstanceId});
  const task=await rpc.call('ipc',{op:'submit',agentId:context.agentId,requestId:'original-task-request',message:'Controlled prompt; no Provider used'});
  await until(async()=>{assert.equal(eventReceipts.some(r=>r.kind==='event.error'),false,'Synthetic page event must satisfy the real wire contract');return (await rpc.call('ipc',{op:'task',taskId:task.taskId})).status==='succeeded';});assert.equal(sends,1);
  const receiptFile=path.join(options.stateDirectory,'daemon-receipts.json'),beforeHealth=fs.readFileSync(receiptFile,'utf8');
  const health=await rpc.call('ipc',{op:'session.health',taskId:task.taskId,probeId:'linux-health'});assert.equal(health.ready,true);assert.equal(health.loginChecked,false);assert.equal(fs.readFileSync(receiptFile,'utf8'),beforeHealth);
  const close={op:'session.close',taskId:task.taskId,executionId:task.executionId,operationId:'original-close',expectedRevision:1};
  assert.equal((await rpc.call('ipc',close)).state,'unknown');await until(()=>closes===1);
  assert.equal((await rpc.call('daemon.receiptRead',{operationId:close.operationId})).state,'unknown');await assert.rejects(rpc.call('daemon.quiesce',{operationId:'blocked-maintenance'}),{code:'DAEMON_BUSY'});
  rpc.channel.close();await stopChild(first.child);browser.close();
  const recovered=await spawnNode(options,children);assert.equal(recovered.type,'ready');assert.equal(recovered.info.daemonId,first.info.daemonId);rpc=await connect(options,channels);
  const status=await rpc.call('browser.status');assert.equal(status.endpoint.url,pair.url);assert.equal(status.endpoint.nodeId,pair.nodeId);
  browser=new BrowserClient(credential,clientOptions);browsers.add(browser);await browser.open();
  const atReconnect=commands.length;await rpc.call('snapshot');assert.equal(commands.slice(atReconnect).includes('session.close'),false);
  await assert.rejects(rpc.call('ipc',{op:'operation',taskId:task.taskId,executionId:'foreign-execution',operationId:close.operationId}),{code:'EXECUTION_MISMATCH'});
  await until(async()=>(await rpc.call('ipc',{op:'operation',taskId:task.taskId,operationId:close.operationId})).state==='confirmed');
  assert.equal(sends,1);assert.equal(closes,1);assert.ok(commands.includes('operation.get'));
  assert.equal((await rpc.call('ipc',{op:'task',taskId:task.taskId})).result.message,'Controlled Linux browser result');assert.equal((await rpc.call('ipc',{op:'conversation',conversationId:task.conversationId})).canContinue,false);
  assert.equal((await rpc.call('daemon.quiesce',{operationId:'idle-maintenance'})).quiescent,true);
  const closed=await rpc.call('ipc',{op:'session.health',taskId:task.taskId,probeId:'health-during-maintenance'});assert.equal(closed.sessionClosed,true);assert.equal(closed.ready,false);
  await assert.rejects(rpc.call('browser.pair',{extensionId,operationId:'blocked-pair'}),{code:'DAEMON_MAINTENANCE'});assert.equal((await rpc.call('browser.status')).pairs.length,1);
  await rpc.call('daemon.releaseMaintenance',{operationId:'idle-maintenance'});
});
