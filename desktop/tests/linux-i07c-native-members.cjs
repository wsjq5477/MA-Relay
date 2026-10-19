// Explicit, opt-in real-model acceptance. Default --plan starts no host or model.
// All three MachineHosts run on this WSL host. Machine routing is controlled;
// this does not represent SSH, independent computers, or isolated native accounts.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const profile = path.join(root, '.agentbridge-dev/i07c-native-members-first');
const roles = ['leader', 'developer', 'verifier'];
const plan = {
  status: 'plan', realModelStarted: false, nativeRoles: roles,
  topology: 'Three independent Bridge profiles/MachineHosts/workspaces; controlled machine routing on one WSL host; inherited native account and model.',
  scenario: 'Actual Claude delivery document -> actual Claude independent document verification -> actual Claude leader task acceptance -> deferred overall acceptance after leader native terminal.',
  limits: { maxActivations: 8, maxMinutes: 12, timeoutMinutes: 12 },
  recovery: 'Repeated --run observes only. Explicit --continue validates the original confirmed enable receipt and restores only its existing event policy/budget. Missing receipts and unknown tasks keep their original IDs/occupancy; no setup/control/native request is replayed.',
  commands: ['node desktop/tests/linux-i07c-native-members.cjs --run', 'node desktop/tests/linux-i07c-native-members.cjs --observe', 'node desktop/tests/linux-i07c-native-members.cjs --continue'],
  untested: ['Independent SSH/physical hosts', 'Windows EXE', 'Other native adapters', 'Native file/terminal permissions', 'Repair loop'],
};
// Native project restrictions leave Bridge MCP tools available. No native tool
// permission is approved by this harness, including an unexpected new tool.
const deniedTools = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'NotebookRead', 'NotebookEdit', 'Task', 'Agent', 'Skill', 'LSP', 'AskUserQuestion', 'EnterPlanMode', 'ExitPlanMode', 'TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList', 'TaskOutput', 'TaskStop', 'KillShell', 'EnterWorktree', 'ExitWorktree', 'ToolSearch'];
const failure = code => Object.assign(new Error('Original native-member acceptance requires review; private state retained.'), { code });
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + '.' + randomUUID() + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temp, file);
}
function reference(value) {
  const match = /^team-document:([^:\s]+):([1-9]\d*)$/.exec(value || '');
  if (!match || !Number.isSafeInteger(Number(match[2]))) throw failure('PROBE_DOCUMENT_REFERENCE');
  return { documentId: match[1], revision: Number(match[2]) };
}
function documentRevision(document, revision) {
  const item = document.history.find(x => x.revision === revision);
  if (!item) throw failure('PROBE_DOCUMENT_REVISION');
  return JSON.parse(item.content);
}
function inspectArtifact(value) {
  assert.deepEqual(value.inputs, [3, 5, 8]);
  assert.deepEqual(value.squares, value.inputs.map(x => x * x));
  assert.equal(value.sum, value.squares.reduce((a, b) => a + b, 0));
  assert.equal(typeof value.explanation, 'string');
  assert(value.explanation.trim().length > 5);
}
// A prepared-but-unacknowledged command is never replayed, even when its receipt
// is currently unavailable or not_found. That is a review point, not a retry.
async function once(checkpoint, save, call, method, params) {
  const prior = checkpoint.operations[params.operationId];
  if (prior && (prior.method !== method || JSON.stringify(prior.params) !== JSON.stringify(params))) throw failure('PROBE_OPERATION_CONFLICT');
  const receipt = await call('team.operation', { operationId: params.operationId });
  if (receipt.state === 'confirmed') return receipt.data;
  if (prior || receipt.state !== 'not_found') throw failure('PROBE_ORIGINAL_UNRESOLVED');
  checkpoint.operations[params.operationId] = { method, params, preparedAt: new Date().toISOString() };
  save();
  const result = await call('team.' + method, params);
  checkpoint.operations[params.operationId].confirmed = true;
  save();
  return result;
}
function seedCatalog(directory) {
  const machines = roles.map(role => ({ machineId: 'controlled-wsl-native-' + role, name: 'Controlled same-WSL ' + role + ' host', kind: 'linux', platform: 'linux' }));
  write(path.join(directory, 'machines.json'), { version: 1, localMachineId: machines[0].machineId, machines, connections: [], instances: [] });
}
function transientObservation(code) {
  return ['NOT_FOUND', 'REQUEST_NOT_FOUND', 'TASK_NOT_FOUND', 'NOT_CONFIGURED', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT'].includes(code)
    || /(?:^|_)(?:TIMEOUT|OFFLINE|CLOSED|DISCONNECTED|UNAVAILABLE)$/.test(code || '');
}
function validateContinuation(checkpoint, audit) {
  if (checkpoint.schema !== 1 || !['enabled', 'completed'].includes(checkpoint.phase) || !checkpoint.runId) throw failure('PROBE_CONTINUE_PHASE');
  const enable = checkpoint.operations?.['enable-automation'];
  const receipt = audit.receipts.find(r => r.actor === 'user' && r.operation === 'enable-automation');
  const run = audit.state.runs.find(r => r.runId === checkpoint.runId);
  const policy = run?.automation;
  if (!enable?.confirmed || enable.method !== 'configureAutomation' || enable.params?.runId !== checkpoint.runId || enable.params.enabled !== true || !receipt?.result.policy?.enabled || !policy?.enabled || !['active', 'completed'].includes(run.state)) throw failure('PROBE_CONTINUE_ENABLE_RECEIPT');
  for (const key of ['maxActivations', 'maxMinutes', 'idleMinutes']) if (policy[key] !== enable.params[key] || receipt.result.policy[key] !== policy[key]) throw failure('PROBE_CONTINUE_POLICY_CHANGED');
  if (JSON.stringify(policy.agentIds) !== JSON.stringify(enable.params.agentIds) || policy.generation !== receipt.result.policy.generation || policy.startedAt !== receipt.result.policy.startedAt) throw failure('PROBE_CONTINUE_POLICY_CHANGED');
  const attempts = audit.state.attempts.filter(a => a.runId === checkpoint.runId);
  if (attempts.some(a => ['failed', 'rejected', 'cancelled'].includes(a.state) || a.waiting || a.continuationError)) throw failure('PROBE_CONTINUE_NATIVE_REVIEW');
  return run;
}
function open(directory, observeOnly) {
  const { AgentNetwork } = require('../electron/agent-network.cjs');
  const { MachineHost } = require('../electron/machine-host.cjs');
  const { ClaudeHost } = require('../electron/claude-host.cjs');
  const { createCoordinatorService } = require('../electron/coordinator-service.cjs');
  const network = new AgentNetwork({ directory, platform: 'linux', distributions: async () => [], createHost: machine => {
    const role = roles.find(x => machine.machineId === 'controlled-wsl-native-' + x);
    if (!role) throw failure('PROBE_MACHINE_PROVENANCE');
    const hostDirectory = path.join(directory, 'native', role);
    return new MachineHost({ directory: hostDirectory, home: os.homedir(), legacy: new ClaudeHost({ directory: path.join(hostDirectory, 'legacy'), home: os.homedir() }) });
  } });
  // Existing policy and in-flight MCP sessions are restored, but observation
  // never schedules a fresh event. Closing a service does not cancel its task.
  const service = createCoordinatorService({ directory, network, version: require('../package.json').version, teamTickMs: observeOnly ? 2147483647 : 750 });
  return { network, service };
}
function privateState(directory) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(directory, 'team-space.sqlite'), { readOnly: true });
  try {
    return { state: JSON.parse(db.prepare('SELECT body FROM state WHERE id=1').get().body), receipts: db.prepare('SELECT actor, operation, result FROM receipts').all().map(r => ({ ...r, result: JSON.parse(r.result) })) };
  } finally { db.close(); }
}
function nativeModels(sessionId) {
  // Extract only model identifiers from this exact native Session's history;
  // never copy native transcript text, tool arguments, account or config data.
  const projects = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
  if (!/^[\w-]{1,180}$/.test(sessionId) || !fs.existsSync(projects)) return [];
  const models = new Set();
  for (const entry of fs.readdirSync(projects, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(projects, entry.name, sessionId + '.jsonl');
    if (!fs.existsSync(file) || fs.statSync(file).size > 32 * 1024 * 1024) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
      let frame; try { frame = JSON.parse(line); } catch { continue; }
      if (frame.type === 'assistant' && typeof frame.message?.model === 'string' && frame.message.model.trim() && !/synthetic/i.test(frame.message.model)) models.add(frame.message.model);
    }
  }
  return [...models];
}
function auditPrivateRuntime(directory) {
  const result = { permissionCommands: 0, nativeToolUses: 0, bridgeToolUses: 0, jobs: 0, modelOverrides: 0, perRole: {} };
  for (const role of roles) {
    const counts = result.perRole[role] = { jobs: 0, bridgeToolUses: 0, tools: {} };
    const visit = folder => {
      if (!fs.existsSync(folder)) return;
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) { visit(file); continue; }
        if (entry.name === 'job.json') {
          const job = read(file); result.jobs++; counts.jobs++;
          if (job.model) result.modelOverrides++;
          assert.equal(job.mcp?.mode, 'team');
          assert.equal(fs.realpathSync(job.workspace), fs.realpathSync(path.join(directory, 'native', role, 'sessions', path.basename(job.workspace))));
        }
        if (!['events.jsonl', 'commands.jsonl'].includes(entry.name)) continue;
        for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
          const event = JSON.parse(line);
          if (entry.name === 'commands.jsonl' && event.action === 'permission') result.permissionCommands++;
          const name = event.kind === 'progress' && event.data?.text?.match(/^Claude 正在使用 (.+)$/)?.[1];
          if (!name) continue;
          if (name.startsWith('mcp__agentbridge__team_')) { result.bridgeToolUses++; counts.bridgeToolUses++; counts.tools[name] = (counts.tools[name] || 0) + 1; }
          else result.nativeToolUses++;
        }
      }
    };
    visit(path.join(directory, 'native', role));
  }
  assert.equal(result.permissionCommands, 0);
  assert.equal(result.nativeToolUses, 0);
  assert.equal(result.modelOverrides, 0);
  return result;
}
async function main(mode = '--plan') {
  if (mode === '--plan') { console.log(JSON.stringify(plan, null, 2)); return plan; }
  if (!['--run', '--observe', '--continue'].includes(mode)) throw failure('PROBE_MODE');
  const checkpointFile = path.join(profile, 'acceptance-checkpoint.json');
  const exists = fs.existsSync(checkpointFile);
  if ((mode !== '--run' && !exists) || (!exists && fs.existsSync(profile))) throw failure('PROBE_PRIVATE_STATE_REVIEW');
  const observeOnly = exists && mode !== '--continue';
  const checkpoint = exists ? read(checkpointFile) : { schema: 1, startedAt: new Date().toISOString(), phase: 'setup', operations: {}, nodeIds: {}, agentIds: {}, native: {} };
  const save = () => write(checkpointFile, checkpoint);
  const report = { date: new Date().toISOString(), version: require('../package.json').version, status: 'running', topology: plan.topology, independentSsh: false, independentNativeAccounts: false, syntheticRouting: true, realNativeAdapters: true, manualNativeStarts: 0, observeOnly, continuedExistingPolicy: mode === '--continue', checks: [], untested: plan.untested };
  const reportFile = path.join(root, 'artifacts/I07C-native-members/2026-10-18/native-members-' + report.date.replace(/[:.]/g, '-') + '.json');
  let network, service;
  try {
    if (!exists) {
      // Claim the fixed checkpoint exclusively before any machine/control write.
      fs.mkdirSync(profile, { recursive: true, mode: 0o700 });
      fs.writeFileSync(checkpointFile, JSON.stringify(checkpoint, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      seedCatalog(profile);
    }
    if (mode === '--continue') validateContinuation(checkpoint, privateState(profile));
    ({ network, service } = open(profile, observeOnly));
    const call = async (method, params = {}) => {
      const reply = await service.call({ method, params });
      if (!reply.ok) throw failure(reply.error.code || 'PROBE_COORDINATOR');
      return reply.result;
    };
    const user = (method, params) => once(checkpoint, save, call, method, params);
    if (!exists) {
      const snapshot = await network.snapshot();
      for (const role of roles) {
        const machineId = 'controlled-wsl-native-' + role;
        const candidates = snapshot.nodes.filter(n => n.machineId === machineId && n.adapter === 'claude' && n.executionSupported && n.healthy && !n.supersededBy);
        assert.equal(candidates.length, 1);
        const node = candidates[0];
        checkpoint.nodeIds[role] = node.nodeId; save();
        const workspace = path.join(profile, 'native', role, 'sessions', node.nodeId.replace(/[^\w-]/g, '_'));
        write(path.join(workspace, '.claude/settings.local.json'), { permissions: { deny: deniedTools } });
        if (!node.connected) await network.call('manageNode', { operationId: 'native-member-attach-' + role, nodeId: node.nodeId, machineId, action: 'attach' });
        const agent = await user('registerAgent', { operationId: 'register-' + role, kind: 'native', nodeId: node.nodeId, name: role, purpose: role === 'leader' ? '按最新版本协调、核对原生终态并逐项/总验收；不承担执行任务。' : role === 'developer' ? '使用公共文档交付一次计算产物，报告后结束原生回合。' : '实际读取指定版本公共文档，独立复算并记录复核证据，报告后结束原生回合。' });
        checkpoint.agentIds[role] = agent.agentId; save();
      }
      assert.equal(new Set(Object.values(checkpoint.nodeIds)).size, 3);
      const team = await user('createTeam', { operationId: 'create-team', name: '真实原生执行成员直线验收', leaderId: checkpoint.agentIds.leader, memberIds: Object.values(checkpoint.agentIds), charter: '这是同一WSL上的三个独立Bridge宿主，三个实际Claude角色，绝非独立SSH。仅使用本次作用域的agentbridge团队MCP。禁止Bash、文件、网络、其他Agent/子代理和Skill工具；不改原生配置，不调用模型API，不创建新任务或扩展范围。先读team_context/team_tasks/team_messages。执行成员的工作已自动接手，不要重复claim。成员报告前用最新revision，固定每项写操作的operationId，回应不明只查team_operation，不换ID。主角色等待开发员/复核员各自原生succeeded后再验收，不把业务报告/收据当终态；复核任务先验收，再交付任务，再总验收。若不具备条件，说明等待后结束本轮，不轮询空转。awaiting_leader_terminal只表示等待你的本轮真正成功终态。' });
      const run = await user('createRun', { operationId: 'create-run', teamId: team.teamId, name: '自动交付与独立复核', goal: '开发员计算输入[3,5,8]各项平方及平方和，公共文档交付；另一原生成员读取精确版本独立复算。主角色根据复核证据和原生实际终态逐项/总验收。仅此两项既有任务。', acceptance: '真实开发员和复核员均通过MCP完成实际文档工作，原生成员本轮成功与业务验收分别记录。复核先验收，交付后验收；主角色本轮实际成功后总验收才生效。' });
      checkpoint.runId = run.runId; save();
      const delivery = await user('createTask', { operationId: 'create-delivery', runId: run.runId, title: '交付平方和公共文档', description: '无需文件或编译器。将[3,5,8]逐项平方再求和，使用team_update_document创建JSON公共文档，内容包含inputs、squares、sum及你自己的中文explanation。不要把结果只写在最终回答。以版本native-members-v1报告submitted，reference严格使用team-document:<documentId>:<revision>。报告后立即结束本轮，复核由另一成员负责。', kind: 'delivery', ownerId: checkpoint.agentIds.developer });
      const verification = await user('createTask', { operationId: 'create-verification', runId: run.runId, title: '独立复核精确版本', description: '读取来源交付报告的artifact，必须使用team_document实际取得reference指定的精确revision，独立复算而不是照抄结论。创建JSON复核公共文档，包含sourceReference、sourceVersion、observedSum、recomputedSum、passed及你自己的中文explanation。一致才report passed，artifactId用当前绑定的来源artifactId、accessConfirmed true，evidenceReference用team-document:<复核documentId>:<revision>；否则如实failed。不要claim已自动接手的任务，不验收总工作。报告后结束本轮。', kind: 'verification', ownerId: checkpoint.agentIds.verifier, sourceTaskId: delivery.workItemId });
      checkpoint.workItemIds = { delivery: delivery.workItemId, verification: verification.workItemId };
      checkpoint.phase = 'arming'; save();
      await user('configureAutomation', { operationId: 'enable-automation', runId: run.runId, expectedRevision: run.revision, enabled: true, agentIds: Object.values(checkpoint.agentIds), maxActivations: plan.limits.maxActivations, maxMinutes: plan.limits.maxMinutes, idleMinutes: 120 });
      checkpoint.phase = 'enabled'; save();
    }
    // An interrupted setup is not silently completed with new operations.
    if (!checkpoint.runId) throw failure('PROBE_SETUP_INCOMPLETE');
    const until = Date.now() + (observeOnly ? 15000 : plan.limits.timeoutMinutes * 60000);
    let context;
    const pending = code => { checkpoint.pendingObservations ??= {}; checkpoint.pendingObservations[code] = (checkpoint.pendingObservations[code] || 0) + 1; save(); };
    do {
      let unresolvedNativeReads = false;
      try { context = await call('team.refresh', { runId: checkpoint.runId }); }
      catch (error) { if (!transientObservation(error.code)) throw error; pending(error.code); context = null; }
      for (const attempt of context?.attempts || []) {
        const role = roles.find(r => checkpoint.agentIds[r] === attempt.agentId);
        assert(role);
        if (attempt.waiting) throw failure('PROBE_UNEXPECTED_NATIVE_PERMISSION');
        if (['failed', 'cancelled', 'rejected'].includes(attempt.state) || attempt.continuationError) throw failure('PROBE_ORIGINAL_NATIVE_FAILED');
        if (attempt.state === 'unknown') { pending('NATIVE_UNKNOWN'); unresolvedNativeReads = true; }
        let task;
        try { task = await call('ipc', { op: 'request', machineId: 'controlled-wsl-native-' + role, requestId: attempt.requestId }); }
        catch (error) {
          // Context/authentication preparation is asynchronous. An original
          // dispatching intent may not have a native request yet; only observe.
          if (transientObservation(error.code) || (!attempt.taskId && ['dispatching', 'accepted'].includes(attempt.state))) { pending(error.code || 'NATIVE_RECEIPT_PENDING'); unresolvedNativeReads = true; continue; }
          throw error;
        }
        if (task.requestId !== attempt.requestId || (attempt.taskId && task.taskId !== attempt.taskId)) throw failure('PROBE_NATIVE_IDENTITY');
        if (task.native?.sessionId) {
          const old = checkpoint.native[attempt.attemptId];
          if (old && (old.sessionId !== task.native.sessionId || old.conversationId !== task.conversationId)) throw failure('PROBE_NATIVE_SESSION_CHANGED');
          checkpoint.native[attempt.attemptId] = { role, requestId: task.requestId, taskId: task.taskId, conversationId: task.conversationId, sessionId: task.native.sessionId, status: task.status };
          save();
        }
        if (task.status === 'unknown') { pending('NATIVE_UNKNOWN'); unresolvedNativeReads = true; }
      }
      if (context?.run.state === 'completed' && !unresolvedNativeReads) break;
      if (context?.run.state === 'active' && context.automation.limitReached) throw failure('PROBE_AUTOMATION_BUDGET');
      if (Date.now() >= until) throw failure(observeOnly ? 'PROBE_OBSERVATION_PENDING' : 'PROBE_TIMEOUT');
      await new Promise(resolve => setTimeout(resolve, 500));
    } while (true);
    assert.equal(context.workItems.length, 2);
    assert(context.workItems.every(w => w.state === 'completed' && w.acceptedBy === checkpoint.agentIds.leader));
    assert(context.attempts.every(a => a.automatic && a.state === 'succeeded' && a.nativeSessionBound && !a.continuationError));
    assert.equal(context.automation.policy.used, context.attempts.length);
    assert.equal(context.automation.pending, 0);
    const delivery = context.workItems.find(w => w.workItemId === checkpoint.workItemIds.delivery);
    const verification = context.workItems.find(w => w.workItemId === checkpoint.workItemIds.verification);
    assert.equal(delivery.reports.length, 1); assert.equal(verification.reports.length, 1);
    const artifact = delivery.reports[0].artifact, verified = verification.reports[0];
    const sourceRef = reference(artifact.reference), evidenceRef = reference(verified.evidenceReference);
    const sourceDoc = await call('team.document', { runId: checkpoint.runId, documentId: sourceRef.documentId });
    const evidenceDoc = await call('team.document', { runId: checkpoint.runId, documentId: evidenceRef.documentId });
    assert.equal(sourceDoc.ownerId, checkpoint.agentIds.developer);
    assert.equal(evidenceDoc.ownerId, checkpoint.agentIds.verifier);
    inspectArtifact(documentRevision(sourceDoc, sourceRef.revision));
    const evidence = documentRevision(evidenceDoc, evidenceRef.revision);
    assert.equal(evidence.sourceReference, artifact.reference); assert.equal(evidence.sourceVersion, artifact.version);
    assert.equal(evidence.observedSum, 98); assert.equal(evidence.recomputedSum, 98); assert.equal(evidence.passed, true);
    assert.equal(verified.targetArtifactId, artifact.artifactId); assert.equal(verified.accessConfirmed, true);
    assert(Date.parse(verification.acceptedAt) <= Date.parse(delivery.acceptedAt));
    const runtime = auditPrivateRuntime(profile);
    for (const [role, tools] of Object.entries({ leader: ['team_accept_task', 'team_accept_run'], developer: ['team_update_document', 'team_report_task'], verifier: ['team_document', 'team_update_document', 'team_report_task'] })) {
      for (const tool of tools) assert(runtime.perRole[role].tools['mcp__agentbridge__' + tool] > 0);
    }
    const audit = privateState(profile), privateRun = audit.state.runs.find(r => r.runId === checkpoint.runId);
    const attempts = audit.state.attempts.filter(a => a.runId === checkpoint.runId);
    const overall = audit.receipts.filter(r => r.actor === 'member:' + checkpoint.runId + ':' + checkpoint.agentIds.leader && r.result.state === 'awaiting_leader_terminal');
    assert(overall.length >= 1); assert(overall.every(r => r.result.accepted === false));
    assert.equal(privateRun.state, 'completed'); assert.equal(privateRun.acceptedBy, checkpoint.agentIds.leader);
    const roleFacts = {};
    for (const role of roles) {
      const own = attempts.filter(a => a.agentId === checkpoint.agentIds[role]);
      assert(own.length >= 1); if (role !== 'leader') assert.equal(own.length, 1);
      const sessions = new Set(own.map(a => a.nativeSessionId)); assert.equal(sessions.size, 1);
      assert(own.every(a => a.nativeSessionId && a.state === 'succeeded'));
      const models = nativeModels(own[0].nativeSessionId); assert(models.length > 0);
      checkpoint.models ??= {}; checkpoint.models[role] = models; save();
      roleFacts[role] = { automaticTurns: own.length, nativeSessionCount: sessions.size, nativeModelObserved: true, modelOverrideCount: 0, bridgeToolUses: runtime.perRole[role].bridgeToolUses };
      assert(roleFacts[role].bridgeToolUses > 0);
      if (role !== 'leader') {
        const item = role === 'developer' ? delivery : verification;
        assert(Date.parse(own[0].updatedAt) <= Date.parse(item.acceptedAt));
      }
    }
    assert.equal(new Set(attempts.map(a => a.nativeSessionId)).size, 3);
    for (const role of roles) {
      const own = attempts.filter(a => a.agentId === checkpoint.agentIds[role]);
      assert.equal(new Set(own.map(a => a.conversationId)).size, 1);
      for (const a of own.slice(1)) assert(a.previousAttemptId && a.resumeConversationId === a.conversationId);
    }
    const lastLeader = attempts.filter(a => a.agentId === checkpoint.agentIds.leader).at(-1);
    assert(Date.parse(lastLeader.updatedAt) <= Date.parse(privateRun.acceptedAt));
    report.nativeRoles = roleFacts;
    report.pendingObservationCounts = { ...(checkpoint.pendingObservations || {}) };
    report.nativeActivations = attempts.length;
    report.nativeModelObservationCount = Object.keys(roleFacts).length;
    report.permissionCommands = runtime.permissionCommands; report.nonBridgeToolUses = runtime.nativeToolUses;
    report.documentCount = context.documents.length; report.deliveryReports = 1; report.verificationReports = 1;
    report.acceptanceProposalCount = overall.length; report.acceptanceProposalAccepted = false;
    report.checks.push('Three independently addressed MachineHosts discovered actual Claude; no node alias bypass.', 'Real automatic developer authored a public artifact; real automatic verifier read its exact revision and independently verified it.', 'All roles used actual Bridge MCP and native Sessions, inherited models, and no native file/terminal tool or permission reply.', 'Leader accepted verification before delivery, after each bound member native turn succeeded.', 'The overall MCP receipt remained awaiting_leader_terminal/accepted:false; overall completion followed the original leader native successful terminal.');
    report.status = 'passed'; checkpoint.phase = 'completed'; save();
  } catch (error) {
    report.status = error.code === 'PROBE_OBSERVATION_PENDING' || error.code === 'PROBE_ORIGINAL_NATIVE_UNKNOWN' ? 'pending' : 'failed';
    report.error = { code: /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'PROBE_ASSERTION', message: 'Private original requests and native Sessions retained; no replay, cancellation, permission approval, or replacement ID was sent.' };
    process.exitCode = 1;
  } finally {
    service?.close();
    // service owns this same network; close is idempotent and reaches all hosts.
    network?.close();
    report.pendingObservationCounts = { ...(checkpoint.pendingObservations || {}) };
    write(reportFile, report);
    console.log(JSON.stringify(report, null, 2));
  }
  return report;
}
if (require.main === module) main(process.argv[2] || '--plan').catch(error => { console.error(JSON.stringify({ status: 'failed', code: error.code || 'PROBE_SETUP' })); process.exitCode = 1; });
module.exports = { plan, deniedTools, reference, documentRevision, inspectArtifact, once, seedCatalog, transientObservation, validateContinuation, main };
