const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {AgentDirectory}=require('../electron/agent-directory.cjs');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const terminal=new Set(['succeeded','failed','cancelled']);
const fail=code=>Object.assign(Error(code),{code});
async function fixture(t) {
  if (/^c:[\\/]/i.test(os.tmpdir())) throw Error('Tests require a non-C temporary directory.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-agent-directory-'));
  const resources = [];
  const state = {agents: [], tasks: [], conversations: [], executions: 0};
  const host = {close() {}, setCollaboration() {}, async call(method, p = {}) {
    if (method === 'discover') return {items: ['claude', 'codex', 'hermes'].map(adapter => ({adapter, name: adapter, executable: '/controlled/' + adapter, version: '2.0.0', healthy: true, executionSupported: true}))};
    if (method === 'context') {
      let a = state.agents.find(a => a.nodeId === p.nodeId);
      if (!a) { a = {agentId: 'instance-' + state.agents.length, nodeId: p.nodeId, adapter: p.adapter, executable: p.executable, workspace: '/controlled/work-' + state.agents.length, enabled: true, healthy: true}; state.agents.push(a); }
      if (state.onContext) { const callback = state.onContext; state.onContext = null; await callback(); }
      return {agentId: a.agentId, contextId: 'context-' + a.agentId, workspace: a.workspace};
    }
    if (method === 'snapshot') return structuredClone({agents: {revision: 1, items: state.agents.map(a => ({...a, busy: state.tasks.some(task => task.targetAgent === a.agentId && !terminal.has(task.status))}))}, tasks: state.tasks, conversations: state.conversations});
    if (method !== 'ipc') throw fail('METHOD');
    if (p.op === 'request' || p.op === 'task') {
      const task = state.tasks.find(task => p.op === 'request' ? task.requestId === p.requestId : task.taskId === p.taskId);
      if (!task) throw fail('NOT_FOUND');
      if(p.op==='task'&&state.onTaskRead){const callback=state.onTaskRead;state.onTaskRead=null;await callback();}
      if(p.op==='request'&&state.onRequestRead){const callback=state.onRequestRead;state.onRequestRead=null;await callback();}
      return structuredClone(task);
    }
    if (p.op === 'conversation') {
      const c = state.conversations.find(c => c.conversationId === p.conversationId); if (!c) throw fail('NOT_FOUND');
      return {...structuredClone(c), canContinue: terminal.has(state.tasks.find(task => task.taskId === c.lastTaskId)?.status)};
    }
    if (p.op === 'submit' || p.op === 'continue') {
      const previous = state.tasks.find(task => task.requestId === p.requestId); if (previous) return structuredClone(previous);
      const stamp = new Date().toISOString();
      let c = state.conversations.find(c => c.conversationId === p.conversationId);
      if (!c) { c = {conversationId: 'conversation-' + state.executions, targetAgent: p.agentId, createdAt: stamp, updatedAt: stamp, turns: 0}; state.conversations.push(c); }
      const task = {taskId: 'task-' + state.executions++, requestId: p.requestId, targetAgent: c.targetAgent, conversationId: c.conversationId, status: 'running', message: p.message, createdAt: stamp, updatedAt: stamp};
      state.tasks.push(task); c.lastTaskId = task.taskId; c.turns++;
      if(state.loseNextSubmitResponse){state.loseNextSubmitResponse=false;throw fail('DESKTOP_TRANSPORT');}
      return structuredClone(task);
    }
    throw fail('METHOD');
  }};
  const network = new AgentNetwork({directory, platform: 'linux', createHost: () => host});
  const snapshot = await network.snapshot();
  for (const node of snapshot.nodes) await network.call('manageNode', {nodeId: node.nodeId, action: 'attach', operationId: 'attach-' + node.adapter});
  const [leader, child, outsider] = ['claude', 'codex', 'hermes'].map(adapter => snapshot.nodes.find(node => node.adapter === adapter));
  await network.call('saveCollaboration', {leaderId: leader.nodeId, memberIds: [child.nodeId], expectedRevision: 0});
  const registry = new AgentDirectory({directory, network}); network.options.agentDirectory = () => registry;
  let operation = 0;
  const admin = (method, params = {}) => registry.call('agents.' + method, {operationId: 'registry-' + ++operation, ...params});
  const register = (node = child, extra = {}) => admin('register', {kind: 'native', nodeId: node.nodeId, name: 'BuildAgent', purpose: 'Build using the native runtime', ...extra});
  const scope = {nodeId: leader.nodeId, parentRequestId: 'external-a', externalConnectionId: 'external-a'};
  const tool = (name, args = {}) => network.collaborationTool(scope, name, args, 'controlled-call', leader.machineId);
  const finish = task => { const original = state.tasks.find(row => row.taskId === task.taskId.split('::').at(-1)); original.status = 'succeeded'; original.result = {message: 'Actual controlled result'}; };
  t.after(async () => { for (const resource of resources.reverse()) await resource.close(); registry.close(); network.close(); fs.rmSync(directory, {recursive: true, force: true}); });
  return {directory, state, network, registry, admin, register, leader, child, outsider, tool, finish, keep(resource) {resources.push(resource); return resource;}};
}

module.exports={fixture};
