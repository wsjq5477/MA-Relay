const {createHash, randomUUID} = require('node:crypto');
const {connectionCapabilities} = require('./builtin-adapters.cjs');
const {TeamSpace} = require('./team-space.cjs');

const methods = new Set(['agents.list', 'agents.get', 'agents.register', 'agents.update', 'agents.confirmEndpoint', 'agents.disable', 'agents.operation']);
const fail = (code, message) => Object.assign(new Error(message), {code});
const text = (value, max, required = true) => {
  if (typeof value !== 'string' || value.length > max || required && !value.trim()) throw fail('AGENT_INPUT', '智能体字段为空或超过长度限制。');
  return value;
};
const fields = ['name', 'purpose', 'inputs', 'outputs', 'limitations'];
const limits = {name: 100, purpose: 2000, inputs: 2000, outputs: 2000, limitations: 2000};
const clone = value => structuredClone(value);

// This is a view and a user-only mutation surface over the EXISTING agent
// registration source. No team/run is required and no automation is synchronized.
class AgentDirectory {
  constructor(options) {
    this.network = options.network;
    this.owned = !options.store;
    this.store = options.store || new TeamSpace({directory: options.directory});
  }
  record(id, state = this.store.read()) {
    const agent = state.agents.find(row => row.agentId === text(id, 150));
    if (!agent) throw fail('AGENT_NOT_FOUND', '原智能体登记不存在。');
    return agent;
  }
  binding(nodeId) {
    const node = this.network.node(text(nodeId, 150));
    if (node.removed || !node.connected || (this.network.network.removedMachines || []).includes(node.machineId)) throw fail('AGENT_ENDPOINT_UNAVAILABLE', '请先接入原目标节点。');
    if (connectionCapabilities(node).connectionCapabilities.delegation !== true) throw fail('AGENT_ENDPOINT_UNSUPPORTED', '原节点未声明普通委派执行能力，登记不赋予执行权。');
    const dsh = (this.network.network.dshBindings || []).find(row => row.nodeId === node.nodeId && row.machineId === node.machineId);
    // Binding hashes contain no addresses, paths, cookies or native credentials.
    const bindingDigest = createHash('sha256').update(JSON.stringify({nodeId: node.nodeId, machineId: node.machineId, adapter: node.adapter,
      service: dsh ? dsh.connectionId || dsh.executable : null, browser: node.browserInstanceId || null})).digest('hex');
    const mode = ['dsh-desktop', 'dsh-web', 'opendesk-desktop'].includes(node.adapter) ? 'existing-service'
      : node.adapter === 'chatgpt-web' ? 'existing-browser' : 'native-entry';
    return {nodeId: node.nodeId, machineId: node.machineId, adapter: node.adapter, bindingDigest, mode};
  }
  view(agent) {
    const endpoint=agent.interconnectEndpoint;
    if(endpoint&&(endpoint.version!==1||!Number.isSafeInteger(endpoint.revision)||endpoint.revision!==1
      ||typeof endpoint.endpointId!=='string'||!endpoint.endpointId||endpoint.endpointId.length>150
      ||typeof endpoint.nodeId!=='string'||endpoint.nodeId!==agent.nodeId
      ||typeof endpoint.machineId!=='string'||!endpoint.machineId||typeof endpoint.adapter!=='string'||!endpoint.adapter
      ||!/^[a-f0-9]{64}$/.test(endpoint.bindingDigest)||!['existing-service','existing-browser','native-entry'].includes(endpoint.mode)))
      throw fail('AGENT_ENDPOINT_STATE','原端点记录无法安全读取，未重建或重绑。');
    return {agentId: agent.agentId, kind: agent.kind, name: agent.name, purpose: agent.purpose,
      inputs: agent.inputs, outputs: agent.outputs, limitations: agent.limitations, capabilitySource: agent.capabilitySource,
      revision: agent.revision, disabled: agent.disabled, createdAt: agent.createdAt,
      endpoint: endpoint ? {...clone(endpoint),ownership:{runtime:'native',session:'native',observer:'bridge',closeObserverCancels:false,disconnectCancels:false,sessionAccess:'original-binding-only'},
        admission:{scope:'node',concurrency:1,busy:'reject',unknown:'occupies',filesystemIsolation:'native-environment'}} : null,
      bindingStatus: agent.kind !== 'native' ? 'collaboration-only' : agent.interconnectEndpoint ? 'pinned' : 'confirmation-required'};
  }
  assertEndpoint(agent) {
    this.view(agent);
    if (agent.disabled) throw fail('AGENT_DISABLED', '原智能体登记已停用；旧任务仍须按原任务身份查询。');
    if (agent.kind !== 'native' || !agent.interconnectEndpoint) throw fail('AGENT_ENDPOINT_UNCONFIRMED', '此登记尚无明确确认的可执行端点；MCP成员接入不等于执行接入。');
    const endpoint = agent.interconnectEndpoint;
    const current = this.binding(agent.nodeId);
    if (endpoint.nodeId !== current.nodeId || endpoint.machineId !== current.machineId || endpoint.adapter !== current.adapter || endpoint.bindingDigest !== current.bindingDigest || endpoint.mode !== current.mode)
      throw fail('AGENT_ENDPOINT_CHANGED', '原端点绑定已变化；保留原任务，不自动重绑或向其他服务发送需求。');
    return {...clone(endpoint), registeredAgentId: agent.agentId};
  }
  resolve(id) { return this.assertEndpoint(this.record(id)); }
  authorized(nodeIds) {
    const allowed = new Set(nodeIds);
    return this.store.read().agents.filter(agent => !agent.disabled && agent.kind === 'native' && allowed.has(agent.nodeId)).map(agent => this.view(agent));
  }
  async call(method, p = {}) {
    if (!methods.has(method) || !p || typeof p !== 'object' || Array.isArray(p)) throw fail('AGENT_INPUT', '智能体登记请求不合法。');
    const allowed = method === 'agents.register' ? ['kind', 'nodeId', 'externalKey', ...fields, 'operationId']
      : method === 'agents.update' ? ['agentId', 'expectedRevision', ...fields, 'operationId']
      : ['agents.confirmEndpoint', 'agents.disable'].includes(method) ? ['agentId', 'expectedRevision', 'operationId']
      : method === 'agents.operation' ? ['operationId'] : method === 'agents.get' ? ['agentId'] : [];
    if (Object.keys(p).some(key => !allowed.includes(key))) throw fail('AGENT_INPUT', '登记接口不接受身份、权限或端点重绑字段。');
    if (method === 'agents.list') return {schema: 1, source: 'agent-registration', items: this.store.read().agents.map(agent => this.view(agent))};
    if (method === 'agents.get') return this.view(this.record(p.agentId));
    if (method === 'agents.operation') return this.store.call('team.operation', p);
    return this.store.mutate({user: true, key: 'user'}, method, p, state => {
      if (method === 'agents.register') {
        if (!['native', 'mcp'].includes(p.kind)) throw fail('AGENT_INPUT', '请选择原生端点或仅协作MCP身份。');
        const key = text(p.kind === 'native' ? p.nodeId : p.externalKey, 150);
        if (state.agents.some(agent => agent.kind === p.kind && agent.entryKey === key)) throw fail('AGENT_DUPLICATE', '原入口已登记，请读取原智能体；停用不释放原身份。');
        const binding = p.kind === 'native' ? this.binding(key) : null;
        const agent = {agentId: randomUUID(), kind: p.kind, entryKey: key, ...(p.kind === 'native' ? {nodeId: key} : {}),
          ...Object.fromEntries(fields.map(field => [field, text(p[field] ?? (['name', 'purpose'].includes(field) ? undefined : ''), limits[field], ['name', 'purpose'].includes(field))])),
          capabilitySource: 'user_declared', revision: 1, createdAt: new Date().toISOString(), disabled: false,
          ...(binding ? {interconnectEndpoint: {version:1, endpointId: randomUUID(), revision: 1, ...binding}} : {})};
        state.agents.push(agent);
        return this.view(agent);
      }
      const agent = this.record(p.agentId, state);
      if (!Number.isSafeInteger(p.expectedRevision) || p.expectedRevision !== agent.revision) throw fail('AGENT_REVISION', '登记已变化，请读取原修订后操作。');
      if (agent.disabled) throw fail('AGENT_DISABLED', '原登记已停用，不能恢复旧授权或重用身份。');
      if (method === 'agents.update') {
        if (!fields.some(field => Object.hasOwn(p, field))) throw fail('AGENT_INPUT', '未提供要更新的说明字段。');
        for (const field of fields) if (Object.hasOwn(p, field)) agent[field] = text(p[field], limits[field], ['name', 'purpose'].includes(field));
      } else if (method === 'agents.confirmEndpoint') {
        if (agent.kind !== 'native' || agent.interconnectEndpoint) throw fail('AGENT_ENDPOINT_CONFLICT', '仅允许明确确认旧原生登记；已有端点不能重绑。');
        agent.interconnectEndpoint = {version:1, endpointId: randomUUID(), revision: 1, ...this.binding(agent.nodeId)};
      } else {
        if (state.attempts.some(attempt => attempt.agentId === agent.agentId && !['succeeded', 'failed', 'cancelled', 'rejected'].includes(attempt.state))) throw fail('AGENT_BUSY', '原协作执行未核对，不能停用登记。');
        agent.disabled = true;
        for (const run of state.runs.filter(run => run.memberIds.includes(agent.agentId))) {
          run.memberIds = run.memberIds.filter(id => id !== agent.agentId); run.revision++;
          if (run.leaderId === agent.agentId) run.paused = true;
        }
        for (const session of state.sessions.filter(session => session.agentId === agent.agentId)) session.revoked = true;
      }
      agent.revision++;
      return this.view(agent);
    }, {sync: false});
  }
  close() { if (this.owned) this.store.close(); }
}
module.exports = {AgentDirectory, methods};
