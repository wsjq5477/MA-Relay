const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const runtimeRoot=process.env.AGENTBRIDGE_VERIFY_SSH_RUNTIME;
const runtime=name=>require(runtimeRoot?path.join(runtimeRoot,'desktop/electron',name):path.join(__dirname,'../electron',name));
const { SshManager } = runtime('ssh-host.cjs');
const { MachineRouter } = require('../electron/machine-router.cjs');
const { mergeSshState } = runtime('coordinator-service.cjs');
const {projectSshNodes}=runtime('coordinator-service.cjs');

test('current SSH transitions revoke stale probe/offline errors and version errors win for both machines and nodes',()=>{
  for(const stage of ['validating_host','authenticating','inspecting','ready','installing','starting','handshaking','reconnecting']){
    const old={machineId:'m',kind:'ssh',online:false,error:'old offline',probe:{old:true}};
    const merged=mergeSshState(old,{machineId:'m',stage,online:false},true);
    assert.equal(merged.error,undefined);assert.equal(merged.probe,undefined);assert.equal(merged.online,false);
    const node=projectSshNodes([{nodeId:'n',machineId:'m',online:false,error:'old offline',status:'offline',available:false}], [merged])[0];
    assert.equal(node.error,undefined);assert.equal(node.connectionState,stage);assert.equal(node.available,false);
  }
  const error={code:'SSH_DAEMON_UPGRADE_REQUIRED',message:'unsupported version',retryable:false};
  const machine=mergeSshState({machineId:'m',kind:'ssh',online:false,error:'old offline',probe:{old:true}},{stage:'disconnected',online:false,connectionError:error},true);
  assert.equal(machine.error,error.message);assert.equal(machine.probe,undefined);
  assert.equal(projectSshNodes([{machineId:'m',error:'old offline'}],[machine])[0].errorCode,error.code);
});

test('failed current probe clears cached success, version refusal halts auto-retry, and explicit reconnect re-probes',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-ssh-probe-state-'));
  const states=[],manager=new SshManager({directory,onChange:s=>states.push(structuredClone(s))});
  t.after(()=>{manager.close();fs.rmSync(directory,{recursive:true,force:true});});
  const c={connectionId:'c',machineId:'m',daemonId:'d',profileId:'p',host:'example.invalid',port:22,username:'fixture',authKind:'agent',autoReconnect:true,probe:{previewId:'old'},stage:'disconnected'};
  let probes=0,installs=0,code='SSH_DAEMON_UPGRADE_REQUIRED';
  const client={end(){}};manager.authenticate=async()=>{manager.clients.set('c',{client,ready:true});return client;};
  manager.installer.probe=async()=>{probes++;throw Object.assign(Error('current rejection'),{code});};
  manager.installer.install=async()=>{installs++;throw Error('must not install');};
  await assert.rejects(manager.connect(c,{operationId:'probe-one'},true),{code});
  assert.equal(c.probe,undefined);assert.equal(c.stage,'disconnected');assert.equal(c.error.retryable,false);
  assert(states.filter(s=>s.stage==='inspecting').every(s=>s.probe===undefined&&s.error===undefined));
  manager.scheduleReconnect(c,true);assert.equal(manager.reconnectTimers.size,0);
  c.probe={previewId:'another-stale'};await assert.rejects(manager.connect(c,{operationId:'probe-two'},true),{code});assert.equal(probes,2);
  for(const failure of ['SSH_PACKAGE_CHECKSUM','DAEMON_IDENTITY_CHANGED','SSH_VERSION_CONFLICT']){
    code=failure;c.probe={previewId:'obsolete-current-proof'};await assert.rejects(manager.test(c),{code});assert.equal(manager.publicState(c).probe,undefined);
  }
  assert.equal(installs,0);assert.equal(c.daemonId,'d');assert.equal(c.profileId,'p');assert.deepEqual(manager.operations,{});
});

test('SSH recovery clears persisted version errors without losing identity, nodes or history; a new failure remains visible', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-ssh-recovery-'));
  let failSnapshot = false;
  const task = { taskId: 'original-task', status: 'failed', error: { message: 'original native failure' }, createdAt: '2026-10-12T00:00:00Z' };
  const host = { async call(method) {
    if (method === 'discover') return { items: [{ adapter: 'opencode', executable: '/opt/opencode', healthy: true }] };
    if (failSnapshot) throw Object.assign(new Error('current RPC failure'), { code: 'DESKTOP_TIMEOUT' });
    return { agents: { items: [] }, tasks: [task], conversations: [] };
  }, close() {} };
  const makeRouter = () => new MachineRouter({ directory, platform: 'linux', createHost: () => host });
  const router = makeRouter();
  const connection = { connectionId: 'original-connection', machineId: 'original-machine', name: 'fixture', host: 'example.invalid', port: 22, username: 'fixture', authKind: 'agent' };
  const machine = { ...connection, kind: 'ssh', platform: 'linux' };
  router.catalog.machines.push(machine);
  router.catalog.connections.push({ connectionId: 'original-tool', machineId: machine.machineId, executable: '/opt/opencode', connected: true });
  const manager = new SshManager({ directory, onChange: state => { mergeSshState(machine, state); router.save(); } });
  t.after(() => { manager.close(); router.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  const oldFailure = Object.assign(new Error('old version refusal'), { code: 'SSH_DAEMON_UPGRADE_REQUIRED' });
  manager.state(connection, 'blocked', oldFailure);
  assert.equal(machine.connectionError.code, oldFailure.code);
  manager.state(connection, 'online');
  assert.equal(machine.error, undefined);
  assert.equal(machine.connectionError, undefined);
  const reopened = makeRouter();
  try {
    const saved = reopened.catalog.machines.find(m => m.machineId === machine.machineId);
    assert.equal(saved.error, undefined); assert.equal(saved.connectionError, undefined);
    assert.equal(saved.connectionId, connection.connectionId);
    assert.equal(reopened.catalog.connections.find(c => c.connectionId === 'original-tool').connected, true);
    // Reproduce catalogs written by older clients: successful snapshots repair display.
    saved.error = oldFailure.message; saved.connectionError = { code: oldFailure.code };
    const healthy = await reopened.oneSnapshot(saved);
    mergeSshState(healthy.machine, manager.publicState(connection), true);
    assert.equal(healthy.machine.online, true); assert.equal(healthy.machine.error, undefined);
    assert.deepEqual(healthy.snapshot.tasks, [task]);
    failSnapshot = true;
    const failed = await reopened.oneSnapshot(saved);
    mergeSshState(failed.machine, manager.publicState(connection), true);
    assert.equal(failed.machine.online, false); assert.equal(failed.machine.error, 'current RPC failure');
    assert.equal(failed.stale, true);
    manager.state(connection, 'blocked', Object.assign(new Error('current host key refusal'), { code: 'SSH_HOST_KEY_CHANGED' }));
    assert.equal(machine.connectionError.code, 'SSH_HOST_KEY_CHANGED');
    assert.equal(machine.error, 'current host key refusal');
    mergeSshState(failed.machine, manager.publicState(connection), true);
    assert.equal(failed.machine.error, 'current host key refusal');
  } finally { reopened.close(); }
});

test('an authoritative SSH snapshot revokes stale errors but cannot make a failed RPC online', () => {
  const stale = { machineId: 'original', online: true, error: 'obsolete version error', connectionError: { code: 'SSH_DAEMON_UPGRADE_REQUIRED' } };
  const state = { machineId: 'original', online: true, stage: 'online' };
  const recovered = mergeSshState({ ...stale }, state, true);
  assert.equal(recovered.error, undefined); assert.equal(recovered.connectionError, undefined);
  assert.equal(recovered.online, true);
  const rpcFailure = mergeSshState({ ...stale, online: false, error: 'response timed out' }, state, true);
  assert.equal(rpcFailure.online, false); assert.equal(rpcFailure.error, 'response timed out');
  assert.equal(rpcFailure.connectionError, undefined);
});

test('old coordinator SSH snapshots and mutations require explicit backend upgrade before dispatch',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-ssh-old-backend-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  fs.writeFileSync(path.join(directory,'ssh-connections.json'),JSON.stringify({connections:[{connectionId:'synthetic'}]}));
  const {CoordinatorClient}=runtime('coordinator-client.cjs'),client=new CoordinatorClient({directory});client.open=async()=>{};client.info={capabilities:[]};
  for(const method of ['snapshot','machine.reconnect','machine.createSshDraft'])await assert.rejects(client.request('call',{method,params:{}}),{code:'SSH_STATE_BACKEND_UPGRADE_REQUIRED'});
});

test('actual Coordinator snapshot projects current SSH phase and refusal over an offline cached business snapshot',async t=>{
  const {graphFixture}=require('./i06b-ui-fixture.cjs'),{createCoordinatorService}=require('../electron/coordinator-service.cjs');
  const f=await graphFixture();let stage='inspecting',error;
  const ssh={states:()=>[{machineId:'ssh-fixture',kind:'ssh',stage,connectionState:stage,online:false,...(error?{error:error.message,connectionError:error}:{})}],close(){}};
  const service=createCoordinatorService({directory:f.directory,platform:'win32',network:f.router,ssh});t.after(()=>{service.close();f.close();});
  f.hosts.get('ssh-fixture').offline=true;f.router.retryAfter.delete('ssh-fixture');
  let reply=await service.dispatch('call',{method:'snapshot',params:{}});assert.equal(reply.ok,true);
  let machine=reply.result.machines.find(m=>m.machineId==='ssh-fixture'),node=reply.result.nodes.find(n=>n.machineId==='ssh-fixture');
  assert.equal(machine.stage,'inspecting');assert.equal(machine.error,undefined);assert.equal(node.connectionState,'inspecting');assert.equal(node.error,undefined);assert.equal(node.available,false);
  stage='disconnected';error={code:'SSH_DAEMON_UPGRADE_REQUIRED',message:'current unsupported version',retryable:false};
  reply=await service.dispatch('call',{method:'snapshot',params:{}});assert.equal(reply.ok,true);machine=reply.result.machines.find(m=>m.machineId==='ssh-fixture');node=reply.result.nodes.find(n=>n.machineId==='ssh-fixture');
  assert.equal(machine.error,error.message);assert.equal(node.errorCode,error.code);assert.equal(node.error,error.message);assert.equal(node.available,false);
});
