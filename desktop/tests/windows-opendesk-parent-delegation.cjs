// One real native parent prompt and at most one authorized native child; retries observe original records only.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const {randomUUID, createHash} = require('node:crypto');
const {desktopConfig, desktopClient, settingsFile, nativeHome} = require('../electron/opendesk-connection.cjs');
// An unchanged daily coordinator must be observed through its own frozen client.
// Do not weaken the current product client's upgrade gate or switch the background.
const frozenClient = process.env.AGENTBRIDGE_PARENT_COORDINATOR_CLIENT;
const {CoordinatorClient} = require(frozenClient || '../electron/coordinator-client.cjs');
if (process.platform !== 'win32') throw Error('Windows runtime required');
const output = path.resolve(process.argv[2]);
// A different child adapter requires explicit human authorization; no fallback.
const requestedChildAdapter = process.argv[3] || 'claude';
assert(['claude', 'opencode'].includes(requestedChildAdapter));
const preflightOnly = process.argv.includes('--preflight');
const planFile = path.join(os.tmpdir(), 'agentbridge-opendesk-parent-delegation-20261022.private-plan.json');
const existed = fs.existsSync(planFile);
const cp = existed ? JSON.parse(fs.readFileSync(planFile)) : {phase: 'new', startedAt: Date.now(), sessionKey: 'ab-parent-' + randomUUID(), requestId: randomUUID(), childRequestId: randomUUID(), marker: 'AB_NATIVE_PARENT_' + randomUUID().replaceAll('-', '').slice(0, 12)};
const save = () => fs.writeFileSync(planFile, JSON.stringify(cp), {mode: 0o600});
const report = {date: new Date().toISOString(), environment: 'daily unmodified OpenDesk Desktop 0.3.9 / native parent model / existing formal Bridge MCP / real authorized Windows child', status: 'running', nativeParentModel: true, parentSubmissions: 0, childTasksStarted: 0, checks: []};
const record = () => {fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');};
let client, gateway;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const directory = path.join(process.env.APPDATA, 'agentbridge-desktop');
const brokerRows = () => read(path.join(directory, 'windows/mcp-connections/connections.json'));
const nativeTasks = path.join(nativeHome(), 'tasks');
function nativeTask() {
  if (cp.nativeTaskFile && fs.existsSync(cp.nativeTaskFile)) return read(cp.nativeTaskFile);
  for (const name of fs.readdirSync(nativeTasks).filter(name => name.endsWith('.json'))) {
    const file = path.join(nativeTasks, name), stat = fs.statSync(file);
    if (stat.mtimeMs < cp.startedAt - 2000 || stat.size > 20 * 1024 * 1024) continue;
    let task; try {task = read(file);} catch {continue;}
    if (task.task_name === 'Gateway: ' + cp.sessionKey) {cp.nativeTaskFile = file; save(); return task;}
  }
  return null;
}
const callsIn = task => (task?.chat_context?.messages || []).flatMap(message => (message.content || []).flatMap(part => part.type === 'tool_call' ? part.toolcalls || [] : []));
(async () => {
  client = new CoordinatorClient({directory}); await client.attach();
  report.bridgeVersion = client.info.version;
  if (frozenClient) {
    assert.equal(path.basename(path.dirname(path.dirname(path.dirname(frozenClient)))).split(/-[0-9a-f]{12}$/)[0], client.info.version);
    report.coordinatorClientSha256 = createHash('sha256').update(fs.readFileSync(frozenClient)).digest('hex');
  }
  report.phase = 'formal_native_configuration';
  const setting = read(settingsFile());
  const entry = setting.applications?.mcpmgr?.servers?.find(item => item.id === 'agentbridge');
  assert(entry?.enabled && entry.transport === 'stdio');
  const row = brokerRows().find(row => row.enabled && row.configuration?.command === entry.command && JSON.stringify(row.configuration.args) === JSON.stringify(entry.args));
  assert(row, 'Native entry must match an existing, enabled formal registration');
  const descriptor = read(entry.args.at(-1));
  const endpoint = new URL(descriptor.url); assert.equal(endpoint.hostname, '127.0.0.1');
  async function tool(name, args = {}) {
    const response = await fetch(descriptor.url, {method: 'POST', headers: {authorization: 'Bearer ' + descriptor.token, 'content-type': 'application/json'}, body: JSON.stringify({name, args, callId: randomUUID()}), signal: AbortSignal.timeout(60000)});
    assert.equal(response.status, 200); const reply = await response.json(); if (reply.error) throw Object.assign(Error(reply.error.message), {code: reply.error.code}); return reply.result;
  }
  const list = await tool('list_agents');
  report.phase = 'authorized_connections';
  report.authorizedTargets = list.items.length;
  report.targetFieldNames = list.items.length ? Object.keys(list.items[0]) : [];
  report.targetAdapters = [...new Set(list.items.map(item => typeof item.adapter === 'string' ? item.adapter : 'absent'))];
  report.namedClaudeTargets = list.items.filter(item => /claude/i.test(item.name || '')).length;
  assert.equal(list.caller.role, 'leader'); assert.equal(list.caller.delegationAuthorized, true);
  const snapshotReply = await client.request('call', {method: 'snapshot', params: {}}); assert.equal(snapshotReply.ok, true);
  const machines = snapshotReply.result.machines;
  report.windowsOpenCodeStates = snapshotReply.result.nodes.filter(item => item.adapter === 'opencode' && machines.some(machine => machine.machineId === item.machineId && machine.kind === 'windows')).map(item => ({status: item.status, busy: item.busy, connected: item.connected, executionSupported: item.executionSupported, errorCode: item.errorCode, authorized: list.items.some(target => target.nodeId === item.nodeId)}));
  report.phase = 'eligible_child';
  report.claudeStates = list.items.filter(item => item.adapter === 'claude').map(item => ({status: item.status, busy: item.busy, windows: machines.some(machine => machine.machineId === item.machineId && machine.kind === 'windows')}));
  const windowsIdle = list.items.filter(item => !item.busy && item.status === 'connected' && machines.some(machine => machine.machineId === item.machineId && machine.kind === 'windows'));
  report.authorizedStates = list.items.map(item => ({adapter: item.adapter, status: item.status, busy: item.busy, windows: machines.some(machine => machine.machineId === item.machineId && machine.kind === 'windows')}));
  const childAdapter = cp.childAdapter || requestedChildAdapter;
  assert.equal(childAdapter, requestedChildAdapter, 'An original intent cannot change its child adapter');
  const eligible = windowsIdle.filter(item => item.adapter === childAdapter);
  report.originalIntentExists = existed;
  report.originalPhase = cp.phase;
  report.eligibleTargets = eligible.length;
  if (preflightOnly) {report.status = eligible.length || existed ? 'preflight_ready' : 'preflight_unavailable'; return;}
  if (!existed) {
    assert(eligible.length, 'An idle, authorized Windows native child is required before sending the native parent prompt');
    cp.eligible = eligible.map(item => item.nodeId); cp.connectionId = row.connectionId; cp.childAdapter = childAdapter;
    cp.originalDelegations = (await tool('list_delegations', {limit: 50})).total;
    cp.originalCollaboration = JSON.stringify(read(path.join(directory, 'agent-network.json')).collaboration);
    save();
  }
  assert.equal(row.connectionId, cp.connectionId, 'Never switch the original formal MCP identity');
  report.childAdapter = cp.childAdapter;
  const intended = () => read(path.join(directory, 'agent-network.json')).delegations.filter(item => item.externalConnectionId === cp.connectionId && item.requestId === 'delegation-' + createHash('sha256').update(row.nodeId + ':mcp:' + cp.connectionId + ':' + cp.childRequestId).digest('hex').slice(0, 40));
  if (cp.phase === 'new') {
    assert(!existed, 'An existing intent may only be observed');
    gateway = await desktopClient(desktopConfig(settingsFile()));
    let final;
    gateway.onEvent(frame => {const event = frame.payload; if (frame.event === 'chat' && event?.sessionKey === cp.sessionKey && event.runId === cp.requestId && ['final', 'error'].includes(event.state)) {final = event; cp.nativeState = event.state; save();}});
    const message = '这是一次独立的原生主Agent委派验收。只使用AgentBridge MCP工具；不要读写业务文件，不要执行命令，不要批准权限或取消任务。先实际调用list_agents，从当前获准节点中自主选择一个Windows机器上status为connected、busy为false、adapter为' + cp.childAdapter + '的节点。只能委派一个新子任务：delegate的requestId必须逐字使用 ' + cp.childRequestId + '，message必须逐字使用“只进行心算：13乘17是多少？只回复 ' + cp.marker + '=221。不要调用工具、不读写文件、不执行命令、不继续委派。”，不要传workspace。随后使用返回的原taskId调用task_result（waitMs最多45000），未结束只查询原taskId，绝不能换ID或再发新任务；权限/未知/失败时报告真实状态。最后实际调用list_delegations核对该条原委派，并只回复子任务实际状态和原结果。';
    cp.phase = 'attempted'; save();
    report.parentSubmissions = 1;
    record();
    const ack = await gateway.request('chat.send', {sessionKey: cp.sessionKey, idempotencyKey: cp.requestId, message});
    assert.equal(ack.runId, cp.requestId); assert.equal(ack.status, 'started'); cp.phase = 'observing'; save();
    const end = Date.now() + 240000;
    while (!final && Date.now() < end) {nativeTask(); await delay(500);}
  }
  const until = Date.now() + 10000; let task, tools;
  while (Date.now() < until) {task = nativeTask(); tools = callsIn(task); if (task?.finished_at && tools?.some(call => /__list_delegations$/.test(call.tool_name) && call.status === 'success')) break; await delay(300);}
  const bridgeCalls = (tools || []).filter(call => /^mcpmgr-AgentBridge__/.test(call.tool_name));
  report.otherNativeToolCalls = (tools || []).filter(call => !/^mcpmgr-AgentBridge__(list_agents|delegate|task_result|list_delegations)$/.test(call.tool_name)).map(call => ({tool: call.tool_name, status: call.status}));
  assert.equal(report.otherNativeToolCalls.length, 0, 'Only the explicitly requested Bridge tools are allowed');
  report.nativeToolTrace = bridgeCalls.map(call => ({tool: call.tool_name, status: call.status}));
  report.nativeTaskStatus = task?.task_status;
  const delegateCalls = bridgeCalls.filter(call => /__delegate$/.test(call.tool_name));
  const results = bridgeCalls.filter(call => /__task_result$/.test(call.tool_name));
  assert.equal(delegateCalls.length, 1); assert.equal(delegateCalls[0].status, 'success');
  assert.equal(delegateCalls[0].args_object.requestId, cp.childRequestId); assert(cp.eligible.includes(delegateCalls[0].args_object.nodeId));
  assert(bridgeCalls.some(call => /__list_agents$/.test(call.tool_name) && call.status === 'success'));
  assert(bridgeCalls.some(call => /__list_delegations$/.test(call.tool_name) && call.status === 'success'));
  assert(results.length && results.every(call => call.status === 'success'));
  const ledger = intended(); assert.equal(ledger.length, 1); assert(ledger[0].taskId);
  assert.equal(ledger[0].parentTaskId, null); assert.equal(ledger[0].parentRequestId, cp.connectionId);
  const child = await tool('task_result', {taskId: ledger[0].taskId, waitMs: 0});
  assert.equal(child.status, 'succeeded'); assert.match(child.result.message, new RegExp(cp.marker + '=221'));
  assert(results.every(call => call.args_object.taskId === ledger[0].taskId));
  const traceText = results.map(call => JSON.stringify(call.result_object || call.result)).join('\n'); assert(traceText.includes(cp.marker));
  assert.equal((await tool('list_delegations', {limit: 50})).total, cp.originalDelegations + 1);
  const originalReply = await client.request('call', {method: 'ipc', params: {op: 'task', machineId: machines.find(machine => cp.eligible.includes(ledger[0].memberId) && read(path.join(directory, 'agent-network.json')).nodes.some(node => node.nodeId === ledger[0].memberId && node.machineId === machine.machineId)).machineId, taskId: ledger[0].taskId}});
  assert.equal(originalReply.ok, true);
  report.childTasksStarted = existed ? 0 : 1; report.childStatus = child.status; report.nativeSessionBound = !!originalReply.result.native?.sessionId;
  assert(report.nativeSessionBound);
  report.relationshipUnchanged = JSON.stringify(read(path.join(directory, 'agent-network.json')).collaboration) === cp.originalCollaboration;
  assert(report.relationshipUnchanged);
  report.checks.push('Real OpenDesk parent autonomously discovers and selects an authorized idle Windows native child, invokes one delegation with the stable original request ID');
  report.checks.push('Real parent reads the original child task result and its own delegation ledger; production ledger has exactly one new child with independent-connection ownership');
  report.checks.push('Real native child succeeds with the requested arithmetic marker and original native Session binding; no approval, cancellation or retry submission');
  if (existed) report.checks.push('Fresh observer reads the same native task and original child, starts zero new model tasks and preserves exactly one new delegation');
  cp.phase = 'complete'; save(); report.status = 'passed';
})().catch(error => {report.status = 'failed_or_pending'; report.error = {code: error.code, message: error.code === 'ERR_ASSERTION' ? 'Original native parent/child evidence did not satisfy acceptance; preserve and query original intent' : ['ENOENT','ECONNREFUSED'].includes(error.code) ? 'Original required file or Coordinator endpoint is unavailable; preserve original intent, no retry submission' : error.message}; process.exitCode = 1;})
  .finally(() => {gateway?.close(); client?.close(); record(); console.log(JSON.stringify(report));});
