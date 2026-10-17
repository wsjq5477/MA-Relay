const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TeamSpace } = require('../electron/team-space.cjs');
const { CollaborationBroker } = require('../electron/collaboration-broker.cjs');
const { spawn } = require('node:child_process');

function fixture(t, overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-team-'));
  const sessions = [];
  const options = { directory, validateNode: id => ({ nodeId: id, machineId: 'machine' }), configure: async s => { sessions.push(s); return { command: 'fixture' }; }, ...overrides };
  let space = new TeamSpace(options);
  t.after(() => { space.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  let op = 0;
  return { directory, options, sessions, get space() { return space; }, restart() { space.close(); space = new TeamSpace(options); }, call: (method, p = {}) => space.call('team.' + method, { operationId: 'op-' + ++op, ...p }) };
}
async function setup(t, overrides) {
  const f = fixture(t, overrides);
  const a = await f.call('registerAgent', { kind: 'mcp', externalKey: 'configured-compiler', name: '编译', purpose: '编译并报告实际错误' });
  const b = await f.call('registerAgent', { kind: 'mcp', externalKey: 'configured-developer', name: '开发', purpose: '实现和修复' });
  const team = await f.call('createTeam', { name: '小队', leaderId: a.agentId, memberIds: [a.agentId, b.agentId], charter: '报告实际结果，不修改授权。' });
  const run = await f.call('createRun', { teamId: team.teamId, name: '工作', goal: '实现并验证', acceptance: '版本一致且构建通过' });
  await f.call('connect', { runId: run.runId, agentId: a.agentId });
  await f.call('connect', { runId: run.runId, agentId: b.agentId });
  return { ...f, get space() { return f.space; }, a, b, team, run, aSession: f.sessions[0].sessionId, bSession: f.sessions[1].sessionId };
}
test('two independent agent identities share messages and docs; receipts survive restart without replay or impersonation', async t => {
  const f = await setup(t), p = { operationId: 'compile-X', content: '版本X失败，详见报告。', notifyIds: [f.b.agentId] };
  const m = await f.space.tool(f.aSession, 'team_post_message', p);
  assert.equal(m.senderId, f.a.agentId);
  assert.deepEqual(await f.space.tool(f.aSession, 'team_post_message', p), m);
  await assert.rejects(f.space.tool(f.aSession, 'team_post_message', { ...p, content: 'other' }), { code: 'TEAM_OPERATION_CONFLICT' });
  f.restart();
  assert.deepEqual(await f.space.tool(f.aSession, 'team_post_message', p), m);
  const context = await f.space.tool(f.bSession, 'team_context');
  assert.equal(context.messages.filter(x => x.messageId === m.messageId).length, 1);
  assert.equal(context.deliveries.find(x => x.messageId === m.messageId).state, 'pending');
  await f.space.tool(f.bSession, 'team_acknowledge', { operationId: 'read-X', messageIds: [m.messageId], state: 'read' });
  assert.equal((await f.space.tool(f.bSession, 'team_context')).deliveries.find(x => x.messageId === m.messageId).state, 'read');
  await assert.rejects(f.space.tool(f.aSession, 'team_acknowledge', { operationId: 'false-read', messageIds: [m.messageId], state: 'read' }), { code: 'TEAM_INPUT' });
  await assert.rejects(f.space.tool(f.aSession, 'team_context', { runId: 'foreign' }), { code: 'TEAM_FORBIDDEN' });
  await assert.rejects(f.space.tool(f.aSession, 'team.createTeam', {}), { code: 'TEAM_METHOD' });
});
test('document revision conflicts, edit grants and atomic rollback preserve originals', async t => {
  const f = await setup(t);
  const d = await f.space.tool(f.aSession, 'team_update_document', { operationId: 'doc1', expectedRevision: 0, title: '报告', content: 'X' });
  await assert.rejects(f.space.tool(f.bSession, 'team_update_document', { operationId: 'steal', documentId: d.documentId, expectedRevision: 1, title: '改', content: 'Y' }), { code: 'TEAM_FORBIDDEN' });
  await f.call('writeDocument', { runId: f.run.runId, documentId: d.documentId, expectedRevision: 1, title: '报告', content: 'X', editorIds: [f.b.agentId] });
  await assert.rejects(f.space.tool(f.aSession, 'team_update_document', { operationId: 'stale', documentId: d.documentId, expectedRevision: 1, title: '旧', content: 'lost' }), { code: 'TEAM_REVISION' });
  const revised = await f.space.tool(f.bSession, 'team_update_document', { operationId: 'update', documentId: d.documentId, expectedRevision: 2, title: '报告', content: 'Y' });
  assert.equal(revised.revision, 3); assert.equal(revised.history.length, 3);
  await assert.rejects(f.space.tool(f.bSession, 'team_update_document', { operationId: 'grant', documentId: d.documentId, expectedRevision: 3, title: '报告', content: 'Z', editorIds: [f.a.agentId] }), { code: 'TEAM_FORBIDDEN' });
  assert.equal((await f.space.tool(f.aSession, 'team_document', { documentId: d.documentId })).content, 'Y');
  const before = f.space.read().messages.length;
  await assert.rejects(f.call('postMessage', { runId: f.run.runId, content: 'bad', notifyIds: ['foreign'] }), { code: 'TEAM_FORBIDDEN' });
  assert.equal(f.space.read().messages.length, before);
});
test('revocation denies old receipt reads and tokens immediately without hiding history from owner', async t => {
  const f = await setup(t), p = { operationId: 'old', content: '原消息' };
  await f.space.tool(f.bSession, 'team_post_message', p);
  await f.call('revokeMember', { runId: f.run.runId, agentId: f.b.agentId, expectedRevision: 1 });
  await assert.rejects(f.space.tool(f.bSession, 'team_post_message', p), { code: 'TEAM_FORBIDDEN' });
  await assert.rejects(f.space.tool(f.bSession, 'team_context'), { code: 'TEAM_FORBIDDEN' });
  const r = await f.call('context', { runId: f.run.runId });
  assert.equal(r.members.length, 1); assert.ok(r.messages.some(m => m.content === '原消息'));
  assert.equal(JSON.stringify(r).includes(f.bSession), false);
});
test('new connection for same member deduplicates original business messages and pagination does not mark work read', async t => {
  const f = await setup(t), p = { operationId: 'same-business', content: '一次提交' };
  const first = await f.space.tool(f.aSession, 'team_post_message', p);
  await f.call('connect', { runId: f.run.runId, agentId: f.a.agentId });
  const session = f.sessions.at(-1).sessionId;
  assert.equal((await f.space.tool(session, 'team_post_message', p)).messageId, first.messageId);
  for (let i = 0; i < 101; i++) await f.space.tool(session, 'team_post_message', { operationId: 'message-' + i, content: '记录' });
  const page = await f.space.tool(session, 'team_messages', { after: 0 });
  assert.equal(page.items.length, 100); assert.equal(page.hasMore, true);
  const last = await f.space.tool(session, 'team_messages', { after: page.cursor });
  assert.equal(last.hasMore, false); assert.ok(last.cursor > page.cursor);
  assert.equal((await f.space.tool(session, 'team_context')).deliveries[0].state, 'pending');
});
test('native intent is never replayed after lost ACK or restart; source/task identity and terminal scope are enforced', async t => {
  let executions = 0, result;
  const f = fixture(t, { execute: async a => { executions++; result = { requestId: a.requestId, taskId: 't', conversationId: 'c', status: 'running' }; throw Object.assign(Error('lost'), { code: 'DESKTOP_TRANSPORT' }); }, query: async () => result });
  const a = await f.call('registerAgent', { kind: 'native', nodeId: 'node', name: '原生', purpose: '验证' });
  const team = await f.call('createTeam', { name: '小队', leaderId: a.agentId, memberIds: [a.agentId] });
  const run = await f.call('createRun', { teamId: team.teamId, name: '工作', goal: '执行', acceptance: '证据' });
  const p = { runId: run.runId, agentId: a.agentId, operationId: 'execute-original', message: 'do' };
  assert.equal((await f.space.call('team.execute', p)).state, 'unknown');
  f.restart();
  assert.equal((await f.space.call('team.execute', p)).state, 'running');
  assert.equal(executions, 1);
  const intent = f.space.read().attempts[0];
  const scope = { teamSessionId: intent.sessionId, nodeId: 'node', parentRequestId: intent.requestId };
  await assert.rejects(f.space.nativeTool(scope, 'team_context', {}, 'wrong-machine'), { code: 'TEAM_FORBIDDEN' });
  assert.equal((await f.space.nativeTool(scope, 'team_context', {}, 'machine')).run.runId, run.runId);
  await assert.rejects(f.call('disableAgent', { agentId: a.agentId }), { code: 'TEAM_BUSY' });
  result = { ...result, status: 'succeeded', result: { message: 'actual' } };
  await f.space.refresh(run.runId);
  await assert.rejects(f.space.nativeTool(scope, 'team_context', {}, 'machine'), { code: 'TEAM_FORBIDDEN' });
  const view = await f.call('context', { runId: run.runId });
  assert.equal(view.attempts[0].result, 'actual'); assert.equal(view.run.state, 'active');
  assert.equal(executions, 1);
});
test('database corruption and concurrent writers do not silently replace records', async t => {
  const f = await setup(t), second = new TeamSpace(f.options);
  try {
    await f.call('postMessage', { runId: f.run.runId, content: 'first' });
    await second.call('team.postMessage', { operationId: 'second-process', runId: f.run.runId, content: 'second' });
    assert.equal(f.space.read().messages.filter(m => ['first', 'second'].includes(m.content)).length, 2);
  } finally { second.close(); }
  f.space.db.prepare('UPDATE state SET body=? WHERE id=1').run('{bad');
  assert.throws(() => f.space.read(), { code: 'TEAM_STATE' });
  await assert.rejects(f.call('postMessage', { runId: f.run.runId, content: 'must not replace' }), { code: 'TEAM_STATE' });
});

function client(configuration) {
  const child = spawn(process.execPath, configuration.args, { env: { ...process.env, ...configuration.env }, stdio: ['pipe', 'pipe', 'pipe'] });
  const jobs = new Map(); let pending = '', seq = 0;
  child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { pending += chunk; let end; while ((end = pending.indexOf('\n')) >= 0) { const response = JSON.parse(pending.slice(0, end)); pending = pending.slice(end + 1); const job = jobs.get(response.id); if (job) { jobs.delete(response.id); response.error ? job.reject(Error(response.error.message)) : job.resolve(response.result); } } });
  return { close: () => child.kill(), request(method, params = {}) { return new Promise((resolve, reject) => { const id = ++seq; const timeout = setTimeout(() => { jobs.delete(id); reject(Error('MCP timeout')); }, 5000); jobs.set(id, { resolve: r => { clearTimeout(timeout); resolve(r); }, reject: e => { clearTimeout(timeout); reject(e); } }); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); }); } };
}
test('real stdio MCP clients exchange public reports through authenticated broker and revoked configuration fails', async t => {
  const f = await setup(t);
  const broker = new CollaborationBroker(path.join(f.directory, 'connections'), (scope, name, p) => f.space.tool(scope.teamSessionId, name, p));
  t.after(() => broker.close());
  const config = await Promise.all([f.aSession, f.bSession].map(sessionId => broker.configure('team-' + sessionId, { nodeId: 'external', parentRequestId: sessionId, teamSessionId: sessionId })));
  const one = client(config[0]), two = client(config[1]); t.after(() => { one.close(); two.close(); });
  const tools = await one.request('tools/list');
  assert.ok(tools.tools.some(t => t.name === 'team_post_message')); assert.equal(tools.tools.some(t => t.name === 'delegate'), false);
  await one.request('tools/call', { name: 'team_post_message', arguments: { operationId: 'real-stdio-report', content: '版本X编译错误', notifyIds: [f.b.agentId] } });
  const reply = await two.request('tools/call', { name: 'team_messages', arguments: {} });
  assert.ok(JSON.parse(reply.content[0].text).items.some(m => m.content === '版本X编译错误'));
  await f.call('revokeMember', { runId: f.run.runId, agentId: f.b.agentId, expectedRevision: 1 });
  const rejected = await two.request('tools/call', { name: 'team_context', arguments: {} });
  assert.equal(rejected.isError, true); assert.equal(JSON.parse(rejected.content[0].text).error.code, 'TEAM_FORBIDDEN');
});
