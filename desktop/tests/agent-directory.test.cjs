const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {CollaborationBroker} = require('../electron/collaboration-broker.cjs');
const {AgentDirectory} = require('../electron/agent-directory.cjs');
const {TeamSpace} = require('../electron/team-space.cjs');
const {createCoordinatorService} = require('../electron/coordinator-service.cjs');
const {CoordinatorClient} = require('../electron/coordinator-client.cjs');
const {startCoordinator} = require('../electron/coordinator.cjs');

const {fixture}=require('./interconnect-fixture.cjs');

test('core registration shares the existing agent source without a team, run or automation event', async t => {
  const f = await fixture(t), before = f.registry.store.read(), a = await f.register(f.outsider);
  assert.equal(a.bindingStatus, 'pinned'); assert.equal(a.endpoint.nodeId, f.outsider.nodeId);
  const existing = f.keep(new TeamSpace({directory: f.directory}));
  const snapshot = await existing.call('team.snapshot', {});
  assert.equal(snapshot.agents[0].agentId, a.agentId);
  const after = f.registry.store.read();
  for (const key of ['teams', 'runs', 'activationEvents', 'attempts', 'sessions', 'messages']) assert.deepEqual(after[key], before[key]);
  await assert.rejects(existing.call('team.registerAgent', {operationId: 'duplicate-old-entry', kind: 'native', nodeId: f.outsider.nodeId, name: 'Duplicate', purpose: 'Must share source'}), {code: 'TEAM_DUPLICATE'});
  assert.equal(f.state.executions, 0);
});

test('registry receipts survive restart, reject changed content and preserve the original endpoint', async t => {
  const f = await fixture(t), params = {kind: 'native', nodeId: f.child.nodeId, name: 'BuildAgent', purpose: 'Compile', operationId: 'original-register'};
  const a = await f.registry.call('agents.register', params);
  const reopened = f.keep(new AgentDirectory({directory: f.directory, network: f.network}));
  assert.deepEqual(await reopened.call('agents.register', params), a);
  const receipt = await reopened.call('agents.operation', {operationId: params.operationId});
  assert.equal(receipt.state, 'confirmed'); assert.equal(receipt.data.agentId, a.agentId); assert.match(receipt.fingerprint, /^[a-f0-9]{64}$/);
  await assert.rejects(reopened.call('agents.register', {...params, purpose: 'Different goal'}), {code: 'TEAM_OPERATION_CONFLICT'});
  const updated = await reopened.call('agents.update', {agentId: a.agentId, expectedRevision: 1, name: 'Renamed BuildAgent', operationId: 'rename'});
  assert.equal(updated.agentId, a.agentId); assert.deepEqual(updated.endpoint, a.endpoint);
  assert.equal(a.endpoint.ownership.closeObserverCancels, false); assert.equal(a.endpoint.admission.filesystemIsolation, 'native-environment');
  await assert.rejects(reopened.call('agents.update', {agentId: a.agentId, expectedRevision: 1, name: 'Stale', operationId: 'stale'}), {code: 'AGENT_REVISION'});
  await assert.rejects(reopened.call('agents.update', {agentId: a.agentId, expectedRevision: 2, nodeId: f.outsider.nodeId, operationId: 'rebind'}), {code: 'AGENT_INPUT'});
});

test('legacy registrations need explicit endpoint confirmation; MCP membership never grants execution', async t => {
  const f = await fixture(t);
  const existing = f.keep(new TeamSpace({directory: f.directory, validateNode: nodeId => f.network.node(nodeId)}));
  const old = await existing.call('team.registerAgent', {operationId: 'legacy-register', kind: 'native', nodeId: f.child.nodeId, name: 'Existing BuildAgent', purpose: 'Existing role'});
  assert.equal((await f.registry.call('agents.get', {agentId: old.agentId})).bindingStatus, 'confirmation-required');
  assert.throws(() => f.registry.resolve(old.agentId), {code: 'AGENT_ENDPOINT_UNCONFIRMED'});
  const confirmed = await f.admin('confirmEndpoint', {agentId: old.agentId, expectedRevision: old.revision});
  assert.equal(confirmed.agentId, old.agentId); assert.equal(confirmed.bindingStatus, 'pinned');
  await assert.rejects(f.admin('confirmEndpoint', {agentId: old.agentId, expectedRevision: confirmed.revision}), {code: 'AGENT_ENDPOINT_CONFLICT'});
  const external = await f.admin('register', {kind: 'mcp', externalKey: 'standalone-tool', name: 'External', purpose: 'Public collaboration'});
  assert.equal(external.bindingStatus, 'collaboration-only'); assert.throws(() => f.registry.resolve(external.agentId), {code: 'AGENT_ENDPOINT_UNCONFIRMED'});
});

test('MCP discovers only currently authorized registrations, with no identity or permission side effects', async t => {
  const f = await fixture(t), a = await f.register(), secret = await f.register(f.outsider, {name: 'Unrelated private agent'});
  const view = await f.tool('list_agents');
  assert.ok(view.supportedOperations.includes('delegate.agent-id-v1'));
  assert.deepEqual(view.items.flatMap(item => item.agents).map(agent => agent.agentId), [a.agentId]);
  assert.equal(JSON.stringify(view).includes(secret.agentId), false);
  await assert.rejects(f.tool('delegate', {agentId: secret.agentId, requestId: 'unauthorized', message: 'Never execute'}), {code: 'COLLABORATION_FORBIDDEN'});
  assert.equal(f.state.executions, 0);
});

test('registered identity invokes and continues the same native session; retries do not execute again', async t => {
  const f = await fixture(t), a = await f.register();
  const params = {agentId: a.agentId, requestId: 'named-first', message: 'Build'};
  const first = await f.tool('delegate', params); assert.equal((await f.tool('delegate', params)).taskId, first.taskId);
  const ledger = f.network.network.delegations[0]; assert.equal(ledger.registeredAgentId, a.agentId); assert.equal(ledger.endpointId, a.endpoint.endpointId);
  f.finish(first);
  const second = await f.tool('delegate', {agentId: a.agentId, conversationId: first.conversationId, requestId: 'named-next', message: 'Explain the result'});
  assert.equal(second.conversationId, first.conversationId); assert.equal(f.state.executions, 2);
  await assert.rejects(f.tool('delegate', {...params, agentId: undefined, nodeId: f.child.nodeId}), {code: 'REQUEST_CONFLICT'});
  await assert.rejects(f.tool('delegate', {...params, requestId: 'wrong-node', nodeId: f.outsider.nodeId}), {code: 'AGENT_ENDPOINT_CONFLICT'});
});

test('disabling an identity blocks new named calls while retaining original execution and unknown occupancy', async t => {
  const f = await fixture(t), a = await f.register(), task = await f.tool('delegate', {agentId: a.agentId, requestId: 'original', message: 'Build'});
  f.state.tasks[0].status = 'unknown';
  await f.admin('disable', {agentId: a.agentId, expectedRevision: 1});
  await assert.rejects(f.tool('delegate', {agentId: a.agentId, requestId: 'new-name', message: 'Never repeat'}), {code: 'AGENT_DISABLED'});
  await assert.rejects(f.tool('delegate', {nodeId: f.child.nodeId, requestId: 'raw-alias', message: 'Never repeat'}), {code: 'AGENT_BUSY'});
  assert.equal((await f.tool('task_result', {taskId: task.taskId})).status, 'unknown');
  assert.equal(f.state.executions, 1); assert.equal(f.network.network.requests.filter(row => row.dispatched).length, 1);
});

test('endpoint changes and revocation during preparation never dispatch the named prompt', async t => {
  const f = await fixture(t), a = await f.register();
  f.state.onContext = () => f.admin('disable', {agentId: a.agentId, expectedRevision: 1});
  await assert.rejects(f.tool('delegate', {agentId: a.agentId, requestId: 'revoke-before-prompt', message: 'Never execute'}), {code: 'AGENT_DISABLED'});
  assert.equal(f.state.executions, 0);
  const intent = f.network.network.requests[0]; assert.equal(intent.dispatched, false); assert.equal(intent.preparationRejection, 'AGENT_DISABLED');
  assert.equal(f.network.network.delegations[0].state, 'rejected');
});

test('service binding changes keep original registered identity and refuse automatic retargeting', async t => {
  const f = await fixture(t), a = await f.register();
  f.network.network.dshBindings = [{nodeId: f.child.nodeId, machineId: f.child.machineId, connectionId: 'changed-service'}];
  assert.throws(() => f.registry.resolve(a.agentId), {code: 'AGENT_ENDPOINT_CHANGED'});
  assert.equal((await f.registry.call('agents.get', {agentId: a.agentId})).endpoint.endpointId, a.endpoint.endpointId);
  assert.equal(f.state.executions, 0);
});

test('authenticated coordinator exposes the registry without a team or native task and gates old backends', async t => {
  const f = await fixture(t), service = createCoordinatorService({directory: f.directory, platform: 'linux', network: f.network});
  f.keep(await startCoordinator({directory: f.directory, version: 'controlled', service}));
  const connected = f.keep(new CoordinatorClient({directory: f.directory}));
  const created = await connected.request('call', {method: 'agents.register', params: {operationId: 'via-coordinator', kind: 'native', nodeId: f.child.nodeId, name: 'BuildAgent', purpose: 'Compile'}});
  assert.equal(created.ok, true);
  const list = await connected.request('call', {method: 'agents.list', params: {}}); assert.equal(list.result.items[0].agentId, created.result.agentId);
  const cli = spawn(process.execPath, [path.join(__dirname, '../scripts/agent-directory.cjs'), '--directory', f.directory, 'agents.list'], {windowsHide: true, env: process.env, stdio: ['ignore', 'pipe', 'pipe']});
  let output = '', diagnostic = ''; cli.stdout.on('data', data => { output += data; }); cli.stderr.on('data', data => { diagnostic += data; });
  const cliExit = await new Promise((resolve, reject) => {cli.once('error', reject);cli.once('close', resolve);});
  assert.equal(cliExit, 0, diagnostic); assert.equal(JSON.parse(output).items[0].agentId, created.result.agentId);
  const rootCli=spawn(process.execPath,[path.join(__dirname,'../../dist/cli.js'),'interconnect','agents.list','--profile-dir',f.directory,'--json'],{windowsHide:true,env:process.env,stdio:['ignore','pipe','pipe']});
  let rootOutput='',rootDiagnostic='';rootCli.stdout.on('data',data=>{rootOutput+=data;});rootCli.stderr.on('data',data=>{rootDiagnostic+=data;});
  const rootExit=await new Promise((resolve,reject)=>{rootCli.once('error',reject);rootCli.once('close',resolve);});
  assert.equal(rootExit,0,rootDiagnostic);assert.equal(JSON.parse(rootOutput).items[0].agentId,created.result.agentId);
  const runCli=async args=>{
    const processChild=spawn(process.execPath,[path.join(__dirname,'../../dist/cli.js'),'interconnect',...args],{windowsHide:true,env:process.env,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';processChild.stdout.on('data',data=>{stdout+=data;});processChild.stderr.on('data',data=>{stderr+=data;});
    const code=await new Promise((resolve,reject)=>{processChild.once('error',reject);processChild.once('close',resolve);});return {code,stdout,stderr};
  };
  const callers=await runCli(['callers.list','--profile-dir',f.directory,'--json']);assert.equal(callers.code,0,callers.stderr);assert.deepEqual(JSON.parse(callers.stdout).items,[]);
  const absentProfile=path.join(f.directory,'must-not-create-profile'),params=path.join(f.directory,'invalid-params.json');
  fs.writeFileSync(params,JSON.stringify({kind:'mcp',name:'No operation ID',purpose:'Must fail before opening coordinator'}));
  const invalidWrite=await runCli(['agents.register','--profile-dir',absentProfile,'--file',params,'--json']);assert.notEqual(invalidWrite.code,0);assert.equal(fs.existsSync(absentProfile),false);
  const invalidProfile=await runCli(['agents.list','--profile-dir','relative-profile','--json']);assert.notEqual(invalidProfile.code,0);
  fs.writeFileSync(params,'[]');const invalidBody=await runCli(['agents.list','--profile-dir',absentProfile,'--file',params,'--json']);assert.notEqual(invalidBody.code,0);assert.equal(fs.existsSync(absentProfile),false);
  const client = new CoordinatorClient({directory: f.directory}); client.open = async () => {}; client.info = {capabilities: []};
  await assert.rejects(client.request('call', {method: 'agents.register', params: {}}), {code: 'AGENT_DIRECTORY_BACKEND_UPGRADE_REQUIRED'});
  assert.equal(f.state.executions, 0);
});

test('corrupt or future endpoint records fail closed without rebuilding the original binding', async t => {
  const f = await fixture(t), a = await f.register();
  f.registry.store.transaction(state => { state.agents[0].interconnectEndpoint.version = 999; return {updated: true}; }, {sync: false});
  assert.throws(() => f.registry.resolve(a.agentId), {code: 'AGENT_ENDPOINT_STATE'});
  await assert.rejects(f.tool('delegate', {agentId: a.agentId, requestId: 'corrupt', message: 'Never send'}), {code: 'AGENT_ENDPOINT_STATE'});
  assert.equal(f.registry.store.read().agents[0].interconnectEndpoint.version, 999); assert.equal(f.state.executions, 0);
});

test('real MCP stdio proves named-agent and continuation support before forwarding a prompt', async t => {
  for (const scenario of [
    {support: [], error: 'AGENT_DIRECTORY_BACKEND_UPGRADE_REQUIRED'},
    {support: ['delegate.continue-v1'], continuation: true, error: 'AGENT_DIRECTORY_BACKEND_UPGRADE_REQUIRED'},
    {support: ['delegate.agent-id-v1'], continuation: true, error: 'MCP_CONTINUATION_BACKEND_UPGRADE_REQUIRED'},
    {support: ['delegate.agent-id-v1']},
  ]) await t.test(JSON.stringify(scenario), async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-named-stdio-'));
    let executions = 0;
    const broker = new CollaborationBroker(directory, (_scope, name) => {
      if (name === 'list_agents') return {supportedOperations: scenario.support};
      executions++; return {taskId: 'controlled-original'};
    });
    try {
      const config = await broker.configure('original-caller', {nodeId: 'caller', parentRequestId: 'original'});
      const child = spawn(config.command, config.args, {windowsHide: true, env: {...process.env, ...config.env}, stdio: ['pipe', 'pipe', 'pipe']});
      let stdout = '', stderr = ''; child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
      const ended = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
      child.stdin.end(JSON.stringify({jsonrpc: '2.0', id: 1, method: 'tools/call', params: {name: 'delegate', arguments: {agentId: 'registered-build-agent', nodeId: 'same-node', message: 'Build', requestId: 'original', ...(scenario.continuation ? {conversationId: 'original-session'} : {})}}}) + '\n');
      assert.equal(await ended, 0, stderr);
      const reply = JSON.parse(stdout.trim()); const value = JSON.parse(reply.result.content[0].text);
      if (scenario.error) { assert.equal(value.error.code, scenario.error); assert.equal(executions, 0); }
      else { assert.equal(value.taskId, 'controlled-original'); assert.equal(executions, 1); }
    } finally { broker.close(); fs.rmSync(directory, {recursive: true, force: true}); }
  });
});
