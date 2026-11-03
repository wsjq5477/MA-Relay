'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {WebSocket}=require('ws');
const {BrowserManagement}=require('../electron/browser-management.cjs');
const {MachineHost}=require('../electron/machine-host.cjs');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {createCoordinatorService,localMcpHost}=require('../electron/coordinator-service.cjs');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
const extensionId='a'.repeat(32),origin='chrome-extension://'+extensionId;
const fault=code=>Object.assign(Error(code),{code});
function fixture(t) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-browser-management-'));
  const managed=[];
  t.after(async()=>{for(const m of managed.reverse())await m.close();fs.rmSync(directory,{recursive:true,force:true});});
  return {directory,own:m=>(managed.push(m),m)};
}
const native=()=>({async call(method){if(method==='snapshot')return {agents:{items:[]},tasks:[],conversations:[]};if(method==='environment')return {platform:'linux'};throw fault('NOT_FOUND');},close(){}});
const options=directory=>({directory,enableBrowser:true,legacy:native(),home:directory,platform:'linux',environment:{PATH:'',Path:'',APPDATA:path.join(directory,'empty')}});

test('management keeps native-only Nodes non-listening; pairing retries return the original identity and expiry',async t=>{
  const f=fixture(t),m=f.own(new BrowserManagement({directory:f.directory}));
  assert.equal((await m.call('browser.status')).ready,false);
  assert.equal(m.channel.server.listening,false);assert.equal(fs.existsSync(path.join(f.directory,'browser-endpoint.json')),false);
  await assert.rejects(m.call('browser.pair',{extensionId}),{code:'INVALID_INPUT'});
  await assert.rejects(m.call('browser.pair',{extensionId:'invalid',operationId:'pair-original'}),{code:'INVALID_INPUT'});
  assert.equal(m.channel.server.listening,false);
  await assert.rejects(m.call('browser.pair',{extensionId,operationId:'not-saved',queryOnly:true}),{code:'NOT_FOUND'});assert.equal(m.channel.server.listening,false);assert.equal(m.channel.pairing.list().length,0);
  const p=await m.call('browser.pair',{extensionId,operationId:'pair-original'});
  assert.deepEqual(await m.call('browser.pair',{extensionId,operationId:'pair-original'}),p);
  assert.deepEqual(await m.call('browser.pair',{extensionId,operationId:'pair-original',queryOnly:true}),p);
  await assert.rejects(m.call('browser.pair',{extensionId:'b'.repeat(32),operationId:'pair-original'}),{code:'REQUEST_CONFLICT'});
  const saved=structuredClone(m.channel.pairing.state);saved.pairs[0].expiresAt=1;m.channel.pairing.commit(saved);
  const expired=await m.call('browser.pair',{extensionId,operationId:'pair-original'});
  assert.equal(expired.browserInstanceId,p.browserInstanceId);assert.equal(expired.expiresAt,1);assert.equal(m.channel.pairing.list().length,1);
  const publicStatus=JSON.stringify(await m.call('browser.status'));assert.ok(!publicStatus.includes(p.secret));assert.ok(!publicStatus.includes(saved.pairs[0].key));
  assert.equal((await m.call('browser.status')).ready,true);
  await assert.rejects(m.call('browser.status',{secret:p.secret}),{code:'INVALID_INPUT'});
});

test('actual machine-owned listener reopens the same endpoint and committed profile; original derived credential resumes',async t=>{
  const f=fixture(t);let h=f.own(new MachineHost(options(f.directory)));
  const p=await h.call('browser.pair',{extensionId,operationId:'original-pair'});
  const {BrowserClient}=await import('../../browser-extension/src/background/client.mjs');
  class Socket extends WebSocket {constructor(url){super(url,{origin});}}
  let credential;
  const client=new BrowserClient(p,{origin,WebSocket:Socket,persist:async c=>{credential=c;},onCommand:async()=>({enabled:true})});
  await client.open();client.close();await h.close();
  h=f.own(new MachineHost(options(f.directory)));await h.call('snapshot',{});
  const status=await h.call('browser.status');assert.equal(status.endpoint.url,p.url);assert.equal(status.endpoint.nodeId,p.nodeId);assert.equal(status.pairs.length,1);assert.equal(status.pairs[0].browserInstanceId,p.browserInstanceId);
  const resumed=new BrowserClient(credential,{origin,WebSocket:Socket,persist:async()=>{},onCommand:async()=>({enabled:true})});t.after(()=>resumed.close());
  await resumed.open();const discovered=await h.call('discover');assert.equal(discovered.items.find(i=>i.browserInstanceId===p.browserInstanceId)?.healthy,true);
  const revoke=await h.call('browser.revoke',{pairingId:p.pairingId});assert.equal(revoke.state,'revoked');assert.deepEqual(await h.call('browser.revoke',{pairingId:p.pairingId}),revoke);
  assert.equal((await h.call('discover')).items.some(i=>i.browserInstanceId===p.browserInstanceId),false);
});

test('an occupied retained port fails closed without selecting a new port or breaking native observation',async t=>{
  const f=fixture(t);let h=f.own(new MachineHost(options(f.directory)));
  const p=await h.call('browser.pair',{extensionId,operationId:'retained-port'});await h.close();
  const file=path.join(f.directory,'browser','browser-endpoint.json'),before=fs.readFileSync(file,'utf8');
  const occupied=net.createServer();await new Promise(resolve=>occupied.listen(Number(new URL(p.url).port),'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>occupied.close(resolve)));
  h=f.own(new MachineHost(options(f.directory)));assert.deepEqual((await h.call('snapshot')).tasks,[]);
  const status=await h.call('browser.status');assert.equal(status.ready,false);assert.equal(status.error.code,'BROWSER_ENDPOINT_UNAVAILABLE');
  await assert.rejects(h.call('browser.pair',{extensionId,operationId:'new-op'}),{code:'BROWSER_ENDPOINT_UNAVAILABLE'});
  assert.equal(fs.readFileSync(file,'utf8'),before);assert.equal(h.browser.pairing.list().length,1);
});

test('corrupt endpoint or pairing stays intact and native snapshots remain available',async t=>{
  const f=fixture(t);let h=f.own(new MachineHost(options(f.directory)));
  await h.call('browser.pair',{extensionId,operationId:'old-pair'});await h.close();
  const endpoint=path.join(f.directory,'browser','browser-endpoint.json');fs.writeFileSync(endpoint,'{"version":1}');
  h=f.own(new MachineHost(options(f.directory)));await h.call('snapshot');assert.equal((await h.call('browser.status')).error.code,'BROWSER_ENDPOINT_STATE');assert.equal(fs.readFileSync(endpoint,'utf8'),'{"version":1}');await h.close();
  const pairing=path.join(f.directory,'browser','browser-pairings.json');fs.writeFileSync(pairing,'broken');
  h=f.own(new MachineHost(options(f.directory)));assert.deepEqual((await h.call('snapshot')).tasks,[]);assert.equal((await h.call('browser.status')).error.code,'BROWSER_PAIRING_STATE');assert.equal(fs.readFileSync(pairing,'utf8'),'broken');
});

test('existing Coordinator and machine RPC deliver pairing without writing its secret into central task journals',async t=>{
  const f=fixture(t),h=f.own(new MachineHost(options(path.join(f.directory,'machine'))));
  const network=f.own(new AgentNetwork({directory:path.join(f.directory,'network'),platform:'linux',createHost:()=>h}));
  const service=createCoordinatorService({directory:path.join(f.directory,'coordinator'),platform:'linux',network});
  const machineId=network.catalog.localMachineId,p={machineId,extensionId,operationId:'coordinator-pair'};
  const reply=await service.call({method:'browser.pair',params:p});assert.equal(reply.ok,true);
  const repeated=await service.call({method:'browser.pair',params:p});assert.deepEqual(repeated,reply);
  fs.mkdirSync(path.join(f.directory,'coordinator'),{recursive:true});fs.writeFileSync(path.join(f.directory,'coordinator','pending.json'),JSON.stringify([{id:'original-unlocated',state:'unknown',params:{op:'submit'}}]));
  const status=await service.call({method:'browser.status',params:{machineId}});assert.equal(status.ok,true);assert.equal(status.result.ready,true);assert.ok(!JSON.stringify(status).includes(reply.result.secret));
  const pending=path.join(f.directory,'coordinator','pending.json');assert.ok(!fs.readFileSync(pending,'utf8').includes(reply.result.secret));assert.equal(JSON.parse(fs.readFileSync(pending,'utf8')).length,1);
  const revoked=await service.call({method:'browser.revoke',params:{machineId,pairingId:reply.result.pairingId}});assert.equal(revoked.ok,true);assert.equal(revoked.result.state,'revoked');
});

test('local Linux keeps native discovery, context and scope handling while adding browser management',async t=>{
  const f=fixture(t),base=native(),calls=[];
  const legacy={...base,async call(method,p){calls.push(method);return method==='discover'?{items:[{adapter:'codex',executable:'/original/codex',healthy:true}]}:['context','scope'].includes(method)?{original:true,method}:base.call(method,p);},setCollaboration(handler){this.handler=handler;}};
  const h=f.own(localMcpHost({...options(f.directory),legacy}));
  assert.deepEqual(await h.call('environment',{}),{platform:'linux'});
  const p=await h.call('browser.pair',{extensionId,operationId:'linux-local'});assert.equal((await h.call('browser.status')).endpoint.url,p.url);
  assert.deepEqual(await h.call('context',{adapter:'codex'}),{original:true,method:'context'});assert.deepEqual(await h.call('scope',{contextId:'original-native'}),{original:true,method:'scope'});
  assert.deepEqual((await h.call('discover')).items,[{adapter:'codex',executable:'/original/codex',healthy:true}]);
  const handler=()=>{};h.setCollaboration(handler);assert.equal(legacy.handler,handler);assert.ok(calls.includes('context'));
});

test('an older Coordinator rejects browser management before sending a new request',async()=>{
  const c=new CoordinatorClient({directory:'unused'});c.open=async()=>{};c.info={capabilities:[]};
  await assert.rejects(c.request('call',{method:'browser.pair',params:{extensionId,operationId:'old-peer'}}),{code:'BROWSER_BACKEND_UPGRADE_REQUIRED'});
  await assert.rejects(c.request('call',{method:'browser.status',params:{}}),{code:'BROWSER_BACKEND_UPGRADE_REQUIRED'});
  c.info={capabilities:['browser-agent-v1']};
  await assert.rejects(c.request('call',{method:'ipc',params:{op:'session.close',taskId:'original',operationId:'close-original',expectedRevision:1}}),{code:'BROWSER_BACKEND_UPGRADE_REQUIRED'});
  await assert.rejects(c.request('call',{method:'ipc',params:{op:'session.health',taskId:'original',probeId:'health-original'}}),{code:'BROWSER_BACKEND_UPGRADE_REQUIRED'});
});
test('SSH without the session-close marker refuses before sending a frame while ordinary reads stay usable',async()=>{
  const {SshHost}=require('../electron/ssh-host.cjs');const calls=[];
  const host=new SshHost({}, {stage:'online',browserAgent:true,browserSessionClose:false});host.request=async(method,p)=>{calls.push({method,p});return {original:true};};
  await assert.rejects(host.call('ipc',{op:'session.close',taskId:'original-task',operationId:'original-close',expectedRevision:1}),{code:'BROWSER_BACKEND_UPGRADE_REQUIRED'});assert.equal(calls.length,0);
  await assert.rejects(host.call('ipc',{op:'session.health',taskId:'original-task',probeId:'original-health'}),{code:'BROWSER_BACKEND_UPGRADE_REQUIRED'});assert.equal(calls.length,0);
  assert.deepEqual(await host.call('ipc',{op:'task',taskId:'original-task'}),{original:true});assert.equal(calls.length,1);
});
