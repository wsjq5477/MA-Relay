const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {WebSocket}=require('ws');
const {BrowserChannel}=require('../electron/browser-channel.cjs');
const {BrowserPairing,sign,derive}=require('../electron/browser-pairing.cjs');
const origin='chrome-extension://'+'a'.repeat(32);
async function setup(t,extra={}) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-channel-'));
  const node=new BrowserChannel({directory,...extra});
  t.after(async()=>{await node.close();fs.rmSync(directory,{recursive:true,force:true});});
  const config=await node.createPair('a'.repeat(32));
  const {BrowserClient}=await import('../../browser-extension/src/background/client.mjs');
  // A browser sets the Origin itself. ws supplies the same extension Origin in
  // this real loopback transport test, without using a user browser profile.
  class ExtensionSocket extends WebSocket {constructor(url){super(url,{origin});}}
  const persisted=[];
  const options={origin,WebSocket:ExtensionSocket,persist:async c=>persisted.push(c),...extra.client};
  const client=new BrowserClient(config,options);t.after(()=>client.close());
  return {directory,node,config,client,persisted,options,BrowserClient};
}
const wait=async predicate=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,5));}throw Error('Timed out waiting for channel state.');};

test('Node HMAC/HKDF match extension Web Crypto with canonical field ordering',async()=>{
  const web=await import('../../browser-extension/src/shared/wire.mjs');
  const key='ab'.repeat(32),value={z:[3,{y:'中文',x:1}],a:2};
  assert.equal(await web.sign(key,value),sign(key,value));
  assert.equal(await web.derive(key,value),derive(key,value));
  assert.equal(await web.verify(key,value,sign(key,value)),true);
  assert.equal(await web.verify(key,{...value,a:3},sign(key,value)),false);
});

test('real WS pairing persists derived credentials before commit; original identity survives reconnect',async t=>{
  const f=await setup(t);await f.client.open();
  assert.equal(f.persisted.length,1);assert.equal(f.persisted[0].secret,undefined);
  assert.equal(f.node.pairing.list()[0].state,'committed');
  assert.equal(f.node.forInstance(f.config.browserInstanceId).online,true);
  f.client.close();await wait(()=>!f.node.forInstance(f.config.browserInstanceId).online);
  const reconnect=new f.BrowserClient(f.persisted[0],f.options);t.after(()=>reconnect.close());await reconnect.open();
  assert.equal(f.node.pairing.list().length,1);
  assert.equal(reconnect.config.browserInstanceId,f.config.browserInstanceId);
});

test('real WS command/result and durable event acknowledgement use the bound profile',async t=>{
  const f=await setup(t,{client:{onCommand:async(method,p)=>({method,requestId:p.requestId}),onEventReceipt:r=>receipts.push(r)}});const receipts=[];
  await f.client.open();const endpoint=f.node.forInstance(f.config.browserInstanceId);
  assert.deepEqual(await endpoint.request('health.check',{browserInstanceId:f.config.browserInstanceId,requestId:'original'}),{method:'health.check',requestId:'original'});
  let committed=false;
  endpoint.subscribe('execution-1',async e=>{assert.equal(e.seq,1);committed=true;return {throughSeq:1};});
  await f.client.sendEvent({browserInstanceId:f.config.browserInstanceId,executionId:'execution-1',seq:1});
  await wait(()=>receipts.length===1);assert.equal(committed,true);assert.equal(receipts[0].throughSeq,1);
});

test('failed event persistence sends an error receipt, never an acknowledgement',async t=>{
  const receipts=[];const f=await setup(t,{client:{onEventReceipt:r=>receipts.push(r)}});await f.client.open();
  f.node.forInstance(f.config.browserInstanceId).subscribe('execution-1',async()=>{throw Object.assign(Error('disk failure'),{code:'BROWSER_STORAGE_ERROR'});});
  await f.client.sendEvent({browserInstanceId:f.config.browserInstanceId,executionId:'execution-1',seq:1});
  await wait(()=>receipts.length===1);assert.equal(receipts[0].kind,'event.error');assert.equal(receipts[0].code,'BROWSER_STORAGE_ERROR');assert.equal(receipts[0].throughSeq,undefined);
});

test('revocation closes live transport and rejects retained credentials',async t=>{
  const f=await setup(t);await f.client.open();f.node.revoke(f.config.pairingId);
  await wait(()=>!f.client.online);
  const another=new f.BrowserClient(f.persisted[0],f.options);t.after(()=>another.close());
  await assert.rejects(another.open());
});

test('business timeout does not resend a command; late result cannot resolve another request',async t=>{
  let calls=0,release;
  const f=await setup(t,{requestTimeoutMs:40,client:{onCommand:async()=>{calls++;return new Promise(resolve=>{release=resolve;});}}});await f.client.open();
  await assert.rejects(f.node.forInstance(f.config.browserInstanceId).request('message.send',{browserInstanceId:f.config.browserInstanceId,requestId:'original'}),{code:'BROWSER_REQUEST_UNKNOWN'});
  assert.equal(calls,1);release({requestId:'original'});
  await new Promise(r=>setTimeout(r,20));assert.equal(calls,1);
});

test('wrong shared secret cannot authenticate and cannot change persistent pairing state',async t=>{
  const f=await setup(t);const client=new f.BrowserClient({...f.config,secret:'ff'.repeat(32)},f.options);t.after(()=>client.close());
  await assert.rejects(client.open());assert.equal(f.node.pairing.list()[0].state,'pending');
});

test('invalid or expired bootstrap configuration is rejected before connecting or persisting credentials',async t=>{
  const f=await setup(t);let opened=0,persisted=0;
  const opts={...f.options,WebSocket:class {constructor(){opened++;}},persist:async()=>{persisted++;}};
  for(const config of [null,[],{...f.config,protocol:'another-protocol'},{...f.config,pairingId:''},{...f.config,url:'ws://127.0.0.1:99999/browser/v1'},{...f.config,secret:'short'},{...f.config,key:'ff'.repeat(32)},{...f.config,expiresAt:1},{...f.config,state:'revoked'},{...f.config,providerToken:'test-only forbidden field'}])assert.throws(()=>new f.BrowserClient(config,opts),/Invalid local pairing configuration/);
  assert.equal(opened,0);assert.equal(persisted,0);assert.equal(f.node.pairing.list().length,1);assert.equal(f.node.pairing.list()[0].state,'pending');
});

test('an expired pending pairing rejects both bootstrap and an offline-derived resume credential without replacing its identity',async t=>{
  const f=await setup(t),state=structuredClone(f.node.pairing.state);state.pairs[0].expiresAt=1;f.node.pairing.commit(state);
  await assert.rejects(f.client.open());assert.throws(()=>f.node.pairing.confirm(f.config.pairingId),{code:'BROWSER_AUTH_FAILED'});
  const info={protocol:f.config.protocol,nodeId:f.config.nodeId,pairingId:f.config.pairingId,browserInstanceId:f.config.browserInstanceId,origin:f.config.origin};
  const resumed=new f.BrowserClient({...f.config,secret:undefined,key:derive(f.config.secret,{purpose:'pair-key',...info})},f.options);t.after(()=>resumed.close());await assert.rejects(resumed.open());
  assert.equal(f.node.pairing.list().length,1);assert.equal(f.node.pairing.list()[0].state,'pending');assert.equal(f.node.pairing.list()[0].browserInstanceId,f.config.browserInstanceId);
});

test('expiry between credential persistence and pair.commit keeps the original intent pending and refuses later resume',async t=>{
  let f,credential;
  f=await setup(t,{client:{persist:async config=>{credential=config;const state=structuredClone(f.node.pairing.state);state.pairs[0].expiresAt=1;f.node.pairing.commit(state);}}});
  await assert.rejects(f.client.open());assert.ok(credential?.key);assert.equal(f.node.pairing.list()[0].state,'pending');
  const resumed=new f.BrowserClient(credential,{...f.options,persist:async()=>{}});t.after(()=>resumed.close());await assert.rejects(resumed.open());assert.equal(f.node.pairing.list()[0].state,'pending');
});

test('a committed pairing resumes after bootstrap expiry using the same original long-term credential',async t=>{
  const f=await setup(t);await f.client.open();const state=structuredClone(f.node.pairing.state);state.pairs[0].expiresAt=1;f.node.pairing.commit(state);f.client.close();
  const resumed=new f.BrowserClient(f.persisted[0],f.options);t.after(()=>resumed.close());await resumed.open();
  assert.equal(f.node.forInstance(f.config.browserInstanceId).online,true);assert.equal(f.node.pairing.list().length,1);assert.equal(resumed.config.pairingId,f.config.pairingId);
  assert.equal(f.node.pairing.confirm(f.config.pairingId).state,'committed');
});

test('page error codes survive transport without exposing arbitrary command error text',async t=>{
  const f=await setup(t,{client:{onCommand:async()=>{throw Error('BROWSER_DRAFT_PRESENT');}}});await f.client.open();
  await assert.rejects(f.node.forInstance(f.config.browserInstanceId).request('session.resume',{browserInstanceId:f.config.browserInstanceId}),error=>error.code==='BROWSER_DRAFT_PRESENT'&&!error.message.includes('DRAFT_PRESENT'));
});

test('arbitrary command failures are reduced to a fixed public code',async t=>{
  const f=await setup(t,{client:{onCommand:async()=>{throw Error('synthetic private command detail');}}});await f.client.open();
  await assert.rejects(f.node.forInstance(f.config.browserInstanceId).request('message.send',{browserInstanceId:f.config.browserInstanceId}),error=>error.code==='BROWSER_COMMAND_FAILED'&&!error.message.includes('synthetic'));
});

test('unpaired extension Origin is rejected before the handshake',async t=>{
  const f=await setup(t);
  const socket=new WebSocket(f.config.url,{origin:'chrome-extension://'+'b'.repeat(32)});t.after(()=>socket.terminate());
  await new Promise(resolve=>socket.once('error',resolve));assert.equal(f.node.clients.size,0);
});

test('derived credentials recover a crash between durable client write and pairing commit',async t=>{
  const f=await setup(t);let saved;
  const first=new f.BrowserClient(f.config,{...f.options,persist:async c=>{saved=c;throw Error('process stopped after durable write');}});t.after(()=>first.close());
  await assert.rejects(first.open());assert.ok(saved.key);assert.equal(f.node.pairing.list()[0].state,'pending');
  const resumed=new f.BrowserClient(saved,f.options);t.after(()=>resumed.close());await resumed.open();
  assert.equal(f.node.pairing.list()[0].state,'committed');assert.equal(f.node.pairing.list().length,1);
});

test('lost pairing commit response resumes the original committed browser identity',async t=>{
  const f=await setup(t);
  class DropCommitSocket extends WebSocket {
    constructor(url){super(url,{origin});}
    addEventListener(name,callback,...rest){
      if(name==='message')return super.addEventListener(name,message=>{
        if(JSON.parse(String(message.data)).body?.kind==='result'){this.close();return;}
        callback(message);
      },...rest);
      return super.addEventListener(name,callback,...rest);
    }
  }
  const client=new f.BrowserClient(f.config,{...f.options,WebSocket:DropCommitSocket});t.after(()=>client.close());
  await assert.rejects(client.open());assert.equal(f.node.pairing.list()[0].state,'committed');
  const resumed=new f.BrowserClient(f.persisted.at(-1),f.options);t.after(()=>resumed.close());await resumed.open();
  assert.equal(f.node.pairing.list().length,1);assert.equal(resumed.config.browserInstanceId,f.config.browserInstanceId);
});

test('validly signed frame replay retires the connection without revoking the pairing',async t=>{
  const f=await setup(t);await f.client.open();
  const envelope={protocol:'agentbridge-browser-v1',connectionEpoch:f.client.epoch,frameSeq:f.client.outSeq+1,body:{kind:'ping'}};
  const data=JSON.stringify({...envelope,mac:sign(f.client.key,{direction:'extension',...envelope})});
  f.client.socket.send(data);f.client.socket.send(data);
  await wait(()=>!f.client.online);assert.equal(f.node.pairing.list()[0].state,'committed');
});

test('invalid frame signature closes the authenticated connection',async t=>{
  const f=await setup(t);await f.client.open();
  f.client.socket.send(JSON.stringify({protocol:'agentbridge-browser-v1',connectionEpoch:f.client.epoch,frameSeq:f.client.outSeq+1,body:{kind:'ping'},mac:'00'.repeat(32)}));
  await wait(()=>!f.client.online);assert.equal(f.node.forInstance(f.config.browserInstanceId).online,false);
});

test('authentication deadline drops a socket that never proves possession',async t=>{
  const f=await setup(t,{authTimeoutMs:30});const socket=new WebSocket(f.config.url,{origin});t.after(()=>socket.terminate());
  await new Promise(resolve=>socket.once('close',resolve));assert.equal(f.node.clients.size,0);
});

test('pairing commit persistence failure never enables business commands',async t=>{
  const f=await setup(t);f.node.pairing.write=()=>{throw Error('disk failure');};
  await assert.rejects(f.client.open());assert.equal(f.node.forInstance(f.config.browserInstanceId).online,false);
  assert.equal(f.node.pairing.list()[0].state,'pending');
});

test('real Host receives original events over authenticated WS and preserves unknown on disconnect',async t=>{
  const {BrowserAdapterHost}=require('../electron/browser-adapter-host.cjs');
  const f=await setup(t,{client:{onCommand:async(_method,p)=>({requestId:p.requestId,executionId:p.executionId,bridgeSessionId:p.bridgeSessionId})}});await f.client.open();
  const host=new BrowserAdapterHost({directory:path.join(f.directory,'context'),adapter:'chatgpt-web',browserInstanceId:f.config.browserInstanceId,channel:f.node.forInstance(f.config.browserInstanceId)});t.after(()=>host.close());
  const {agentId}=await host.call('connect');const task=await host.call('ipc',{op:'submit',requestId:'request-1',agentId,message:'Test'});await Promise.all([...host.jobs]);
  const raw=host.store.read().tasks[0];
  await f.client.sendEvent({requestId:task.requestId,taskId:task.taskId,executionId:task.executionId,bridgeSessionId:task.conversationId,browserInstanceId:f.config.browserInstanceId,seq:1,kind:'submitted',bindingRevision:raw.bindingRevision,leaseEpoch:raw.leaseEpoch,binding:{sessionKey:'session-1',userAnchor:'user-1',documentId:'document-1'}});
  await wait(()=>host.store.read().tasks[0].browserSeq===1);
  assert.equal((await host.call('ipc',{op:'task',taskId:task.taskId})).status,'running');
  f.client.close();await wait(()=>host.store.read().tasks[0].status==='unknown');
  await assert.rejects(host.call('ipc',{op:'submit',agentId,requestId:'alias',message:'Again'}),{code:'AGENT_BUSY'});
});

test('pairing file reopen preserves node and browser identities; corrupt state fails closed',async t=>{
  const f=await setup(t);await f.client.open();const reopened=new BrowserPairing(f.directory);
  assert.equal(reopened.state.nodeId,f.config.nodeId);assert.equal(reopened.list()[0].browserInstanceId,f.config.browserInstanceId);
  fs.writeFileSync(path.join(f.directory,'browser-pairings.json'),'{bad');
  assert.throws(()=>new BrowserPairing(f.directory),{code:'BROWSER_PAIRING_STATE'});
});
