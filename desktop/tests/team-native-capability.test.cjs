const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TeamSpace } = require('../electron/team-space.cjs');
const { capability } = require('../electron/team-automation.cjs');
const { createCoordinatorService } = require('../electron/coordinator-service.cjs');

const supported = ['claude', 'opencode', 'codex'];
const directOnly = ['hermes', 'pi', 'dsh'];
function node(adapter, extra = {}) {
  return { nodeId: 'node-' + adapter, machineId: 'original-machine', adapter, name: adapter,
    connected: true, executionSupported: true, online: true, healthy: true, busy: false,
    available: true, activeTasks: 0, status: 'connected', executable: '/fixture/' + adapter, ...extra };
}
function fixture(t, adapter = 'claude') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-team-capability-'));
  const nodes = new Map(), executions = [], tasks = new Map();
  let space, sequence = 0, queries = 0;
  const original = node(adapter); nodes.set(original.nodeId, original);
  const options = {
    directory,
    validateNode(id) {
      const current = nodes.get(id);
      if (!current?.connected || current.removed || !current.executionSupported)
        throw Object.assign(Error('original node unavailable'), {code: 'TEAM_NODE'});
      return current;
    },
    configure: async () => ({command: 'fixture'}),
    execute: async attempt => {
      executions.push(attempt);
      const task = {requestId: attempt.requestId, taskId: 'task-' + executions.length,
        conversationId: 'conversation-' + executions.length, status: 'running'};
      tasks.set(attempt.requestId, task); return task;
    },
    query: async attempt => { queries++; return tasks.get(attempt.requestId); },
  };
  space = new TeamSpace(options);
  t.after(() => {space.close(); fs.rmSync(directory, {recursive: true, force: true});});
  const call = (name, p = {}) => space.call('team.' + name, {operationId: 'cap-' + ++sequence, ...p});
  async function work() {
    const member = await call('registerAgent', {kind: 'native', nodeId: original.nodeId, name: 'member', purpose: 'deliver'});
    const team = await call('createTeam', {name: 'team', memberIds: [member.agentId], leaderId: member.agentId});
    const run = await call('createRun', {teamId: team.teamId, name: 'work', goal: 'deliver', acceptance: 'exact evidence'});
    const item = await call('createTask', {runId: run.runId, ownerId: member.agentId, kind: 'delivery', title: 'deliver', description: 'current version'});
    return {member, run, item};
  }
  return {directory, options, nodes, original, executions, tasks, call, work,
    get queries() {return queries;}, get space() {return space;},
    restart() {space.close(); space = new TeamSpace(options);}};
}

test('direct-only and unknown native adapters cannot be registered as team members or forge collaboration support', async t => {
  for (const adapter of [...directOnly, 'unregistered']) await t.test(adapter, async t => {
    const f = fixture(t, adapter); f.original.teamCollaboration = true;
    const before = f.space.read();
    await assert.rejects(f.call('registerAgent', {kind: 'native', nodeId: f.original.nodeId, name: adapter, purpose: 'deliver'}), {code: 'TEAM_CAPABILITY'});
    assert.deepEqual(f.space.read(), before);
    assert.equal(f.space.db.prepare('SELECT count(*) AS n FROM receipts').get().n, 0);
    assert.equal(f.executions.length, 0);
  });
});

test('legacy supported nodes with no collaboration field retain manual team execution and external MCP registration', async t => {
  for (const adapter of supported) await t.test(adapter, async t => {
    const f = fixture(t, adapter), {member, run, item} = await f.work();
    assert.equal(Object.hasOwn(f.original, 'teamCollaboration'), false);
    const attempt = await f.call('execute', {runId: run.runId, agentId: member.agentId,
      workItemId: item.workItemId, expectedRevision: item.revision, message: 'original'});
    assert.equal(attempt.state, 'running'); assert.equal(f.executions.length, 1);
    assert.equal(f.space.read().workItems[0].state, 'running');
    const external = await f.call('registerAgent', {kind: 'mcp', externalKey: 'external-' + adapter, name: 'external', purpose: 'own entry'});
    assert.equal(external.kind, 'mcp');
  });
});

test('persisted direct-only members reject a new execution before task claim, intent, scope, message or dispatch', async t => {
  for (const adapter of [...directOnly, 'unregistered']) await t.test(adapter, async t => {
    const f = fixture(t), {member, run, item} = await f.work();
    f.original.adapter = adapter; f.original.teamCollaboration = true;
    f.restart(); const before = f.space.read();
    const receiptCount = f.space.db.prepare('SELECT count(*) AS n FROM receipts').get().n;
    await assert.rejects(f.call('execute', {runId: run.runId, agentId: member.agentId,
      workItemId: item.workItemId, expectedRevision: item.revision, message: 'must not start'}), {code: 'TEAM_CAPABILITY'});
    assert.deepEqual(f.space.read(), before);
    assert.equal(f.space.db.prepare('SELECT count(*) AS n FROM receipts').get().n, receiptCount);
    assert.equal(f.space.read().workItems[0].state, 'ready');
    assert.equal(f.executions.length, 0);
  });
});

test('explicit lack of collaboration on a supported node rejects admission without treating an absent old field as false', async t => {
  const f = fixture(t); f.original.teamCollaboration = false;
  await assert.rejects(f.call('registerAgent', {kind: 'native', nodeId: f.original.nodeId, name: 'unsupported', purpose: 'no collaboration'}), {code: 'TEAM_CAPABILITY'});
  delete f.original.teamCollaboration;
  const {member, run, item} = await f.work(); f.original.teamCollaboration = false;
  const before = f.space.read();
  await assert.rejects(f.call('execute', {runId: run.runId, agentId: member.agentId,
    workItemId: item.workItemId, expectedRevision: item.revision, message: 'blocked'}), {code: 'TEAM_CAPABILITY'});
  assert.deepEqual(f.space.read(), before); assert.equal(f.executions.length, 0);
});

test('an original execution and its receipts remain readable after restart and capability loss without redispatch', async t => {
  const f = fixture(t), {member, run, item} = await f.work();
  const execute = f.options.execute;
  f.options.execute = async attempt => {await execute(attempt); throw Object.assign(Error('original ACK lost'), {code: 'DESKTOP_TRANSPORT'});};
  const request = {operationId: 'original-execute', runId: run.runId, agentId: member.agentId,
    workItemId: item.workItemId, expectedRevision: item.revision, message: 'original'};
  const first = await f.space.call('team.execute', request);
  assert.equal(first.state, 'unknown');
  f.original.adapter = 'hermes'; f.original.teamCollaboration = false; f.original.connected = false;
  f.restart();
  const originalTask = f.tasks.get(first.requestId); originalTask.status = 'succeeded';
  const replay = await f.space.call('team.execute', request);
  assert.equal(replay.state, 'succeeded'); assert.equal(replay.requestId, first.requestId);
  const receipt = await f.call('operation', {operationId: request.operationId});
  assert.equal(receipt.state, 'confirmed'); assert.equal(receipt.data.attemptId, first.attemptId);
  assert.equal(f.executions.length, 1); assert.ok(f.queries >= 1);
  assert.equal(f.space.read().attempts.length, 1);
  await assert.rejects(f.space.call('team.execute', {...request, message: 'replace original'}), {code: 'TEAM_OPERATION_CONFLICT'});
  f.original.connected = true;
  await assert.rejects(f.space.call('team.execute', {...request, operationId: 'new-execute'}), {code: 'TEAM_CAPABILITY'});
  assert.equal(f.executions.length, 1); assert.equal(f.space.read().attempts.length, 1);
});

test('automatic capability descriptions distinguish direct-only tools from manually supported native team tools', () => {
  for (const adapter of [...supported, ...directOnly, 'unregistered']) {
    const data = capability({kind: 'native', nodeId: adapter}, {validateNode: () => node(adapter)});
    if (adapter === 'claude') {assert.equal(data.start, true); assert.equal(data.resume, true);}
    else {
      assert.equal(data.start, false); assert.equal(data.resume, false);
      if (supported.includes(adapter)) assert.match(data.reason, /手动执行/);
      else {assert.match(data.reason, /小队/); assert.doesNotMatch(data.reason, /请手动执行/);}
    }
  }
});

test('production coordinator projects collaboration capability for old node snapshots and rejects direct-only registrations', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-team-coordinator-capability-'));
  const nodes = [...supported, ...directOnly, 'unregistered'].map(adapter => node(adapter));
  const network = {
    node: id => nodes.find(n => n.nodeId === id),
    prepare: async (method, params) => ({params: params || {}}),
    call: async method => {assert.equal(method, 'snapshot'); return {configured: true, nodes,
      agents: {items: [], connected: true}, tasks: [], conversations: [], machines: []};},
    close() {},
  };
  const service = createCoordinatorService({directory, network, teamTickMs: 600000});
  t.after(() => {service.close(); fs.rmSync(directory, {recursive: true, force: true});});
  const snapshot = await service.call({method: 'snapshot', params: {}});
  assert.equal(snapshot.ok, true, JSON.stringify(snapshot.error));
  for (const n of snapshot.result.nodes) assert.equal(n.teamCollaboration, supported.includes(n.adapter));
  assert(nodes.every(n => !Object.hasOwn(n, 'teamCollaboration')), 'capability projection must not rewrite persisted node identities');
  for (const adapter of directOnly) {
    const reply = await service.call({method: 'team.registerAgent', params: {operationId: 'register-' + adapter,
      kind: 'native', nodeId: 'node-' + adapter, name: adapter, purpose: 'not supported'}});
    assert.equal(reply.ok, false); assert.equal(reply.error.code, 'TEAM_CAPABILITY');
  }
  const state = await service.call({method: 'team.snapshot', params: {}});
  assert.equal(state.result.agents.length, 0);
  assert.equal(service.pending().length, 0);
});

test('production team node picker excludes direct-only and unsupported nodes while retaining old compatible snapshots', () => {
  const {createRequire} = require('node:module');
  process.env.TSX_TSCONFIG_PATH = path.resolve(__dirname, '../tsconfig.json');
  const desktopRequire = createRequire(path.resolve(__dirname, '../package.json'));
  const React = desktopRequire('react');
  const {renderToStaticMarkup} = desktopRequire('react-dom/server');
  const {require: requireTsx} = require('tsx/cjs/api');
  const {default: NativeTeamNodeSelect, supportsNativeTeam, nativeTeamNodes} = requireTsx('../src/TeamNativeNodeSelect.tsx', __filename);
  const {adapters, supportsTeamCollaboration} = require('../electron/builtin-adapters.cjs');
  for (const adapter of [...adapters.list().map(entry => entry.id), 'unregistered']) {
    for (const value of [undefined, false, true]) {
      const input = node(adapter, value === undefined ? {} : {teamCollaboration: value});
      assert.equal(supportsNativeTeam(input), supportsTeamCollaboration(input), 'renderer and reviewed registry must agree for ' + adapter + ':' + value);
    }
  }
  const nodes = [...supported, ...directOnly, 'unregistered'].map(adapter => node(adapter,
    supported.includes(adapter) ? {} : {teamCollaboration: true}));
  nodes.push(node('claude', {nodeId: 'not-collaborating', teamCollaboration: false}),
    node('codex', {nodeId: 'offline', connected: false}),
    node('opencode', {nodeId: 'history', supersededBy: 'node-opencode'}),
    node('claude', {nodeId: 'removed', removed: true}));
  const html = renderToStaticMarkup(React.createElement(NativeTeamNodeSelect, {nodes}));
  const options = Array.from(html.matchAll(/<option\b[^>]*value="([^"]*)"/g), m => m[1]).filter(Boolean);
  assert.deepEqual(options, supported.map(adapter => 'node-' + adapter));
  assert.deepEqual(nativeTeamNodes(nodes).map(n => n.nodeId), options);
  assert.match(html, /Hermes/); assert.match(html, /Pi/); assert.match(html, /DSH/);
  assert.match(html, /直接会话/); assert.match(html, /尚不支持小队/);
});
