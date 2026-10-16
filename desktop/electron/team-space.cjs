const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { digest } = require('./graph-layout.cjs');

const terminal = new Set(['succeeded', 'failed', 'cancelled']);
const fail = (code, message) => Object.assign(new Error(message), { code });
const copy = value => JSON.parse(JSON.stringify(value));
const stamp = () => new Date().toISOString();
function text(value, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    throw fail('TEAM_INPUT', '请填写有效内容，并检查长度。');
  return value;
}
function ids(value, max = 30) {
  if (!Array.isArray(value) || value.length > max || value.some(v => typeof v !== 'string' || !v || v.length > 150) || new Set(value).size !== value.length)
    throw fail('TEAM_INPUT', '成员列表不合法。');
  return value;
}
const { instructions } = require('./team-tools.cjs');
const automation = require('./team-automation.cjs');
const { taskMethods, applyTask, taskView, task: workItem, idle } = require('./team-work.cjs');

class TeamSpace {
  constructor(options) {
    this.options = options;
    fs.mkdirSync(options.directory, { recursive: true });
    const file = path.join(options.directory, 'team-space.sqlite');
    this.db = new DatabaseSync(file);
    if (process.platform !== 'win32') fs.chmodSync(file, 0o600);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS receipts (actor TEXT NOT NULL, operation TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(actor,operation));');
    this.db.prepare('INSERT OR IGNORE INTO state VALUES (1, ?)').run(JSON.stringify({ version: 1, agents: [], teams: [], runs: [], documents: [], messages: [], deliveries: [], sessions: [], attempts: [] }));
    // Migrate the A records in one durable transaction; preserve all old IDs/receipts.
    this.db.exec('BEGIN IMMEDIATE');
    try {
      let s;
      try { s = JSON.parse(this.db.prepare('SELECT body FROM state WHERE id=1').get().body); } catch { throw fail('TEAM_STATE', '小队记录无法读取，请保留原数据排查。'); }
      if (s.version === 1 && ['agents','teams','runs','documents','messages','deliveries','sessions','attempts'].every(k => Array.isArray(s[k]))) {
        s.version = 2; s.workItems = []; s.handoffGrants = []; s.handoffs = [];
        this.db.prepare('UPDATE state SET body=? WHERE id=1').run(JSON.stringify(s));
      }
      if(s.version===2&&['workItems','handoffGrants','handoffs'].every(k=>Array.isArray(s[k]))){s.version=3;s.activationEvents=[];this.db.prepare('UPDATE state SET body=? WHERE id=1').run(JSON.stringify(s));}
      this.read(); this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); this.db.close(); throw error; }
  }
  read() {
    let s;
    try { s = JSON.parse(this.db.prepare('SELECT body FROM state WHERE id=1').get().body); }
    catch { throw fail('TEAM_STATE', '小队记录无法读取，请保留原数据排查。'); }
    if (s.version !== 3 || ['agents', 'teams', 'runs', 'documents', 'messages', 'deliveries', 'sessions', 'attempts', 'workItems', 'handoffGrants', 'handoffs', 'activationEvents'].some(k => !Array.isArray(s[k])))
      throw fail('TEAM_STATE', '小队记录格式不受支持。');
    return s;
  }
  transaction(action) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const s = this.read(), result = action(s);
      automation.sync(s);
      const encoded = JSON.stringify(s);
      if (Buffer.byteLength(encoded) > 8 * 1024 * 1024) throw fail('TEAM_CAPACITY', '小队材料达到容量限制，请归档整理后再写入。未完成记录保留。');
      this.db.prepare('UPDATE state SET body=? WHERE id=1').run(encoded);
      this.db.exec('COMMIT');
      return copy(result);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  mutate(actor, method, p, action) {
    text(p.operationId, 150);
    const fingerprint = digest({ method, ...p, operationId: undefined });
    return this.transaction(s => {
      // Check the current identity even on receipt lookup: a revoked member may
      // not use an old operation ID to retrieve another copy of private data.
      this.authorize(s, actor, p.runId);
      const old = this.db.prepare('SELECT fingerprint,result FROM receipts WHERE actor=? AND operation=?').get(actor.key, p.operationId);
      if (old) {
        if (old.fingerprint !== fingerprint) throw fail('TEAM_OPERATION_CONFLICT', '原操作ID已用于不同内容，请查询原操作。');
        return JSON.parse(old.result);
      }
      if (this.db.prepare('SELECT count(*) AS n FROM receipts').get().n >= 10000) throw fail('TEAM_CAPACITY', '小队操作记录已达到上限，原记录保留。');
      if (this.db.prepare('SELECT coalesce(sum(length(result)),0) AS n FROM receipts').get().n >= 32 * 1024 * 1024) throw fail('TEAM_CAPACITY', '小队收据达到容量限制，原记录保留。');
      const result = action(s);
      this.db.prepare('INSERT INTO receipts VALUES (?,?,?,?)').run(actor.key, p.operationId, fingerprint, JSON.stringify(result));
      return result;
    });
  }
  agent(s, id) {
    const a = s.agents.find(a => a.agentId === id && !a.disabled);
    if (!a) throw fail('TEAM_AGENT', '智能体未接入或已停用。');
    return a;
  }
  run(s, id) {
    const r = s.runs.find(r => r.runId === id);
    if (!r) throw fail('TEAM_RUN', '这项小队工作不存在。');
    return r;
  }
  authorize(s, actor, runId) {
    if (actor.user) return runId ? this.run(s, runId) : null;
    const session = s.sessions.find(x => x.sessionId === actor.sessionId && !x.revoked);
    if (!session || (runId && session.runId !== runId)) throw fail('TEAM_FORBIDDEN', '当前小队接入已失效或不属于这项工作。');
    const run = this.run(s, session.runId);
    this.agent(s, session.agentId);
    if (run.state !== 'active' || !run.memberIds.includes(session.agentId)) throw fail('TEAM_FORBIDDEN', '成员已撤权或工作已结束。');
    if (session.kind === 'native') {
      const attempt = s.attempts.find(a => a.sessionId === session.sessionId);
      if (!attempt || !['dispatching', 'queued', 'accepted', 'running'].includes(attempt.state) || attempt.continuationError) throw fail('TEAM_FORBIDDEN', '原生执行已结束或待核对，不能继续写入。');
    }
    actor.agentId = session.agentId;
    return run;
  }
  message(s, run, sender, content, notifyIds = [], extra = {}) {
    if (notifyIds.some(id => !run.memberIds.includes(id))) throw fail('TEAM_FORBIDDEN', '只能通知本次工作中仍获准的成员。');
    const m = { messageId: randomUUID(), runId: run.runId, seq: (s.messages.filter(m => m.runId === run.runId).at(-1)?.seq || 0) + 1, senderId: sender, content, notifyIds, createdAt: stamp(), ...extra };
    s.messages.push(m);
    for (const agentId of notifyIds) s.deliveries.push({ messageId: m.messageId, runId: run.runId, agentId, state: 'pending' });
    return m;
  }
  view(s, runId, actor = { user: true }) {
    const r = this.authorize(s, actor, runId) || this.run(s, runId);
    const { memberIds, ...run } = r;
    return { identity: { agentId: actor.user ? 'user' : actor.agentId, role: actor.user ? 'user' : actor.agentId === r.leaderId ? 'leader' : 'member' }, run: { ...run, memberIds }, members: memberIds.map(id => ({ ...this.agent(s, id), role: id === r.leaderId ? 'leader' : 'member' })), documents: s.documents.filter(d => d.runId === runId), messages: s.messages.filter(m => m.runId === runId).slice(-100), hasOlderMessages: s.messages.filter(m => m.runId === runId).length > 100, deliveries: s.deliveries.filter(d => d.runId === runId), attempts: s.attempts.filter(a => a.runId === runId).map(a=>this.publicAttempt(a)), ...taskView(s, r), automation: automation.view(s,r,this.options), permissions: { manageTasks: !!actor.user || actor.agentId === r.leaderId, configureHandoffs: !!actor.user, manageMembers: !!actor.user, writeOwnDocuments: true, automaticallyDispatch: !!r.automation?.enabled }, instructions };
  }
  async call(method, p = {}, actor = { user: true, key: 'user' }) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw fail('TEAM_INPUT', '小队请求不合法。');
    if (!actor.user && !['team.context', 'team.messages', 'team.postMessage', 'team.document', 'team.writeDocument', 'team.acknowledge', 'team.operation', 'team.tasks', 'team.wake', ...taskMethods].includes(method))
      throw fail('TEAM_FORBIDDEN', '成员只能使用获准的小队协作操作。');
    if (method === 'team.snapshot') {
      const s = this.read();
      return { stage: 'I07C1', agents: s.agents, teams: s.teams, runs: s.runs, automaticCoordination: true };
    }
    if (method === 'team.operation') {
      this.authorize(this.read(), actor, p.runId);
      const receipt = this.db.prepare('SELECT result FROM receipts WHERE actor=? AND operation=?').get(actor.key, text(p.operationId, 150));
      if (!receipt) return { state: 'not_found' };
      const result = JSON.parse(receipt.result);
      if (result.kind === 'connection' && result.sessionId) {
        this.authorize(this.read(), { sessionId: result.sessionId }, result.runId);
        const {command,args,env}=await this.options.configure(result);
        return { state: 'confirmed', data: { configuration: {command,args,env}, instructions, automaticExecution: false } };
      }
      const attempt = result.attemptId && this.read().attempts.find(a => a.attemptId === result.attemptId);
      return { state: 'confirmed', data: attempt ? this.publicAttempt(attempt) : result };
    }
    if (method === 'team.tasks') { const s = this.read(); const r = this.authorize(s, actor, p.runId) || this.run(s, p.runId); return taskView(s, r); }
    if (method === 'team.context') return this.view(this.read(), p.runId, actor);
    if (method === 'team.messages') {
      const s = this.read(), r = this.authorize(s, actor, p.runId) || this.run(s, p.runId);
      const after = p.after ?? 0;
      if (!Number.isSafeInteger(after) || after < 0) throw fail('TEAM_INPUT', '消息游标不合法。');
      const items = s.messages.filter(m => m.runId === r.runId && m.seq > after).slice(0, 100);
      return { items, cursor: items.at(-1)?.seq || after, hasMore: s.messages.some(m => m.runId === r.runId && m.seq > (items.at(-1)?.seq || after)) };
    }
    if (method === 'team.document') {
      const s = this.read(); this.authorize(s, actor, p.runId);
      const d = s.documents.find(d => d.runId === p.runId && d.documentId === p.documentId);
      if (!d) throw fail('TEAM_DOCUMENT', '共享文档不存在。');
      return d;
    }
    if (method === 'team.execute') return this.execute(p);
    if (method === 'team.connect') return this.connect(p);
    if (method === 'team.refresh') { await this.refresh(p.runId); return this.view(this.read(), p.runId); }
    return this.mutate(actor, method, p, s => {
      const sender = actor.user ? 'user' : actor.agentId;
      if (method === 'team.registerAgent') {
        const kind = p.kind;
        if (!['native', 'mcp'].includes(kind)) throw fail('TEAM_INPUT', '请选择已接入节点或外部MCP智能体。');
        const key = text(kind === 'native' ? p.nodeId : p.externalKey, 150);
        if (s.agents.some(a => a.kind === kind && a.entryKey === key)) throw fail('TEAM_DUPLICATE', '这个入口已登记，请使用原智能体。');
        if (kind === 'native') this.options.validateNode(p.nodeId);
        const a = { agentId: randomUUID(), kind, entryKey: key, ...(kind === 'native' ? { nodeId: key } : {}), name: text(p.name, 100), purpose: text(p.purpose, 2000), inputs: text(p.inputs || '', 2000, false), outputs: text(p.outputs || '', 2000, false), limitations: text(p.limitations || '', 2000, false), capabilitySource: 'user_declared', revision: 1, createdAt: stamp(), disabled: false };
        s.agents.push(a); return a;
      }
      if (method === 'team.disableAgent') {
        const a = this.agent(s, p.agentId);
        if (s.attempts.some(x => x.agentId === a.agentId && !terminal.has(x.state) && x.state !== 'rejected')) throw fail('TEAM_BUSY', '智能体有运行或待核对执行，请先查询原请求。');
        a.disabled = true; a.revision++;
        for (const r of s.runs.filter(r => r.memberIds.includes(a.agentId))) {
          r.memberIds = r.memberIds.filter(id => id !== a.agentId); r.revision++;
          if (r.leaderId === a.agentId) r.paused = true;
        }
        for (const x of s.sessions.filter(x => x.agentId === a.agentId)) x.revoked = true;
        return { disabled: true };
      }
      if (method === 'team.createTeam') {
        const members = ids(p.memberIds);
        if (!members.length || !members.includes(p.leaderId)) throw fail('TEAM_INPUT', '请选择成员和其中的一名主智能体。');
        for (const id of members) this.agent(s, id);
        const team = { teamId: randomUUID(), name: text(p.name, 100), leaderId: p.leaderId, memberIds: members, charter: text(p.charter || '', 8000, false), revision: 1, createdAt: stamp() };
        s.teams.push(team); return team;
      }
      if (method === 'team.createRun') {
        const team = s.teams.find(t => t.teamId === p.teamId);
        if (!team) throw fail('TEAM_INPUT', '请选择一个小队。');
        for (const id of team.memberIds) this.agent(s, id);
        const r = { runId: randomUUID(), teamId: team.teamId, name: text(p.name, 150), goal: text(p.goal, 8000), acceptance: text(p.acceptance, 8000), charter: team.charter, teamRevision: team.revision, leaderId: team.leaderId, memberIds: [...team.memberIds], revision: 1, state: 'active', paused: false, createdAt: stamp() };
        s.runs.push(r); this.message(s, r, 'system', '工作已建立。当前为手动执行阶段，群消息不会自动启动队友。', [r.leaderId]); return r;
      }
      const run = this.run(s, p.runId);
      if (method === 'team.configureAutomation') {
        if(!actor.user)throw fail('TEAM_FORBIDDEN','只有用户可以授权自动执行。');
        const result=automation.configure(s,run,p,this.options);
        this.message(s,run,'system',p.enabled?'用户已启用有预算限制的持续协作；普通群消息不触发执行。':'用户已停止自动调度；原执行仍须核对。');return result;
      }
      if (method === 'team.wake') {
        if(run.state!=='active'||!run.automation?.enabled)throw fail('TEAM_CAPABILITY','请先由用户启用持续协作。');
        if(!actor.user&&actor.agentId===run.leaderId)throw fail('TEAM_FORBIDDEN','主智能体不能通过自我提醒反复激活。');
        const m=this.message(s,run,sender,text(p.reason,2000),[run.leaderId]);
        automation.enqueue(s,run,run.leaderId,'attention:'+m.messageId,'attention',{messageId:m.messageId});return {saved:true,executionStarted:false};
      }
      if (taskMethods.includes(method)) return applyTask(s, run, actor, method, p, this);
      if (method === 'team.revokeMember') {
        if (p.expectedRevision !== run.revision) throw fail('TEAM_REVISION', '成员设置已更新，请刷新后重试。');
        if (!run.memberIds.includes(p.agentId)) throw fail('TEAM_INPUT', '该成员不在本次工作中。');
        run.memberIds = run.memberIds.filter(id => id !== p.agentId); run.revision++;
        if (run.leaderId === p.agentId) run.paused = true;
        for (const x of s.sessions.filter(x => x.runId === run.runId && x.agentId === p.agentId)) x.revoked = true;
        this.message(s, run, 'system', '用户撤销了一位成员的后续协作访问；已有执行不会因此被取消。');
        return { revision: run.revision };
      }
      if (method === 'team.pause') {
        run.paused = !!p.paused; run.revision++;
        return { paused: run.paused, revision: run.revision };
      }
      if (method === 'team.closeRun') {
        if (s.attempts.some(a => a.runId === run.runId && !terminal.has(a.state) && a.state !== 'rejected')) throw fail('TEAM_BUSY', '还有执行正在运行或待核对，不能结束工作。');
        run.state = 'closed'; run.revision++;
        for (const x of s.sessions.filter(x => x.runId === run.runId)) x.revoked = true;
        return { state: 'closed', revision: run.revision };
      }
      if (run.state !== 'active') throw fail('TEAM_CLOSED', '工作已结束，不能继续写入。');
      if (method === 'team.postMessage') {
        const notify = ids(p.notifyIds || []);
        if (p.replyTo && !s.messages.some(m => m.runId === run.runId && m.messageId === p.replyTo)) throw fail('TEAM_INPUT', '回复的消息不属于本次工作。');
        return this.message(s, run, sender, text(p.content, 16000), notify, p.replyTo ? { replyTo: p.replyTo } : {});
      }
      if (method === 'team.writeDocument') {
        let d = s.documents.find(d => d.runId === run.runId && d.documentId === p.documentId);
        if (p.documentId && !d) throw fail('TEAM_DOCUMENT', '共享文档不存在。');
        if (d && !actor.user && d.ownerId !== actor.agentId && !d.editorIds.includes(actor.agentId)) throw fail('TEAM_FORBIDDEN', '只能编辑你拥有或获准维护的文档。');
        if ((d?.revision || 0) !== p.expectedRevision) throw fail('TEAM_REVISION', '共享文档已更新，请读取最新版本再整合。');
        const editors = ids(p.editorIds ?? d?.editorIds ?? []);
        if (editors.some(id => !run.memberIds.includes(id))) throw fail('TEAM_INPUT', '文档编辑者必须是当前成员。');
        if (!actor.user && digest(editors) !== digest(d?.editorIds || [])) throw fail('TEAM_FORBIDDEN', '只有用户可以调整文档编辑权限。');
        if (!d) { d = { documentId: randomUUID(), runId: run.runId, ownerId: sender, editorIds: editors, revision: 0, history: [] }; s.documents.push(d); }
        d.history.push({ revision: d.revision + 1, title: text(p.title, 150), content: text(p.content, 32000, false), authorId: sender, time: stamp() });
        d.revision++; d.title = p.title; d.content = p.content; d.editorIds = editors; d.updatedAt = stamp();
        return d;
      }
      if (method === 'team.acknowledge') {
        const recipient = actor.user ? p.agentId : actor.agentId;
        if (!run.memberIds.includes(recipient) || !['delivered', 'read'].includes(p.state)) throw fail('TEAM_INPUT', '通知回执不合法。');
        // The desktop can inspect deliveries, but cannot claim a model read them.
        if (actor.user) throw fail('TEAM_FORBIDDEN', '阅读回执须由相应智能体提交。');
        const messageIds = ids(p.messageIds, 100);
        for (const id of messageIds) {
          const d = s.deliveries.find(d => d.runId === run.runId && d.agentId === recipient && d.messageId === id);
          if (!d) throw fail('TEAM_INPUT', '这条通知不属于当前接收者。');
          if (d.state !== 'read') d.state = p.state;
        }
        return { acknowledged: messageIds.length, executionStarted: false };
      }
      throw fail('TEAM_METHOD', '小队操作不受支持。');
    });
  }
  async connect(p) {
    const session = this.mutate({ user: true, key: 'user' }, 'team.connect', p, s => {
      const r = this.run(s, p.runId); this.agent(s, p.agentId);
      if (r.state !== 'active' || !r.memberIds.includes(p.agentId)) throw fail('TEAM_FORBIDDEN', '成员未获准参加这项工作。');
      const x = { sessionId: randomUUID(), runId: r.runId, agentId: p.agentId, kind: 'connection', createdAt: stamp() };
      s.sessions.push(x); return x;
    });
    // Reissuing the same connection refreshes only its local endpoint, not work.
    this.authorize(this.read(), { sessionId: session.sessionId }, p.runId);
    const {command,args,env}=await this.options.configure(session);
    return { configuration: {command,args,env}, instructions, automaticExecution: false };
  }
  async tool(sessionId, name, p = {}) {
    const actor = { sessionId }, s = this.read();
    const run = this.authorize(s, actor);
    actor.key = 'member:' + run.runId + ':' + actor.agentId;
    const methods = { team_request_attention: 'team.wake', team_retry_task: 'team.retryTask', team_tasks: 'team.tasks', team_operation: 'team.operation', team_create_task: 'team.createTask', team_claim_task: 'team.claimTask', team_report_task: 'team.reportTask', team_handoff_task: 'team.handoffTask', team_accept_task: 'team.acceptTask', team_accept_run: 'team.acceptRun', team_context: 'team.context', team_messages: 'team.messages', team_post_message: 'team.postMessage', team_document: 'team.document', team_update_document: 'team.writeDocument', team_acknowledge: 'team.acknowledge' };
    if (!methods[name]) throw fail('TEAM_METHOD', '当前阶段不支持该协作操作。');
    if (p.runId && p.runId !== run.runId) throw fail('TEAM_FORBIDDEN', '不能访问其他工作。');
    if (['team_claim_task', 'team_report_task'].includes(name)) {
      const session = s.sessions.find(x => x.sessionId === sessionId);
      if (session.kind === 'native') {
        const attempt = s.attempts.find(x => x.sessionId === sessionId);
        if (!attempt.workItemId || attempt.workItemId !== p.workItemId) throw fail('TEAM_FORBIDDEN', '原生报告须绑定本轮安排的工作项。');
      }
    }
    return this.call(methods[name], { ...p, runId: run.runId }, actor);
  }
  async execute(p, activation = null) {
    text(p.message, 16000);
    // Validate admission before creating an intent; no unknown may be discarded.
    const old = this.read(), agent = this.agent(old, p.agentId), run = this.run(old, p.runId);
    if (agent.kind !== 'native') throw fail('TEAM_MANUAL', '外部MCP成员请从自己的智能体发起工作，再读取本次公共空间。');
    if (!run.memberIds.includes(agent.agentId) || run.state !== 'active' || run.paused) throw fail('TEAM_FORBIDDEN', '工作暂停、已结束或成员已撤权。');
    let previous;
    if(activation){
      previous=old.attempts.find(a=>a.attemptId===activation.previousAttemptId);
      if(previous){
        if(previous.runId!==run.runId||previous.agentId!==agent.agentId||previous.state!=='succeeded'||!previous.nativeSessionId||previous.continuationError)throw fail('TEAM_CAPABILITY','原生会话不能安全续接。');
        const conversation=await this.options.conversation(previous);
        if(!conversation.canContinue)throw fail('TEAM_CAPABILITY','原生会话当前不支持继续，不能另开会话。');
      }
    }
    const intent = this.mutate({ user: true, key: 'user' }, 'team.execute', p, s => {
      const run=this.run(s,p.runId);
      if(run.state!=='active'||run.paused||!run.memberIds.includes(agent.agentId))throw fail('TEAM_FORBIDDEN','原工作已暂停、结束或撤权。');
      if (s.attempts.some(a => a.agentId === agent.agentId && !terminal.has(a.state) && a.state !== 'rejected')) throw fail('TEAM_BUSY', '该智能体有原执行待处理，请查询原请求。');
      if(activation){
        const policy=this.run(s,p.runId).automation;
        if(!policy?.enabled||!policy.agentIds.includes(agent.agentId)||!automation.capability(agent,this.options).resume||policy.used>=policy.maxActivations||Date.now()-Date.parse(policy.startedAt)>=policy.maxMinutes*60000)throw fail('TEAM_CAPABILITY','自动执行授权或预算已经变化。');
        if(!activation.eventIds.length||activation.eventIds.some(id=>!s.activationEvents.some(e=>e.eventId===id&&e.runId===run.runId&&e.agentId===agent.agentId&&e.state==='pending')))throw fail('TEAM_REVISION','激活事件已被处理。');
        const latest=s.attempts.filter(a=>a.runId===run.runId&&a.agentId===agent.agentId).at(-1);
        if(latest?.attemptId!==previous?.attemptId)throw fail('TEAM_REVISION','原执行已变化，请先核对。');
        policy.used++;
        if(policy.issues)delete policy.issues[agent.agentId];
      }
      let item;
      if (p.workItemId) {
        item = workItem(s, run, p.workItemId);
        if (item.ownerId !== agent.agentId || item.revision !== p.expectedRevision || !['ready','running'].includes(item.state)) throw fail('TEAM_REVISION', '任务负责人、修订或状态已变化，请刷新后重新安排。');
        idle(s, item);
        if (item.state === 'ready') applyTask(s, run, {user:true}, 'team.claimTask', {workItemId:item.workItemId,expectedRevision:item.revision}, this);
        if (item.kind === 'verification' && !item.targetArtifactId) throw fail('TEAM_ARTIFACT','复验任务尚未绑定产物。');
      }
      const sessionId = randomUUID(), requestId = 'team-' + randomUUID();
      const a = { attemptId: randomUUID(), runId: run.runId, agentId: agent.agentId, nodeId: agent.nodeId, sessionId, requestId, message: p.message, ...(item ? {workItemId:item.workItemId,workRound:item.round} : {}), state: 'dispatching', ...(activation?{automatic:true,activationEventIds:activation.eventIds,policyGeneration:this.run(s,p.runId).automation.generation,...(previous?{previousAttemptId:previous.attemptId,resumeConversationId:previous.conversationId}:{})}:{}), createdAt: stamp() };
      if(activation)for(const event of s.activationEvents.filter(e=>activation.eventIds.includes(e.eventId))){event.state='consumed';event.attemptId=a.attemptId;}
      s.attempts.push(a); s.sessions.push({ sessionId, runId: run.runId, agentId: agent.agentId, kind: 'native', requestId, createdAt: stamp() });
      this.message(s, run, activation?'system':'user', p.message, [agent.agentId], { attemptId: a.attemptId }); return a;
    });
    // A replay only reads the original attempt, never invokes the native again.
    const a = this.read().attempts.find(a => a.attemptId === intent.attemptId);
    if (a.dispatched) { await this.refresh(run.runId); return this.publicAttempt(this.read().attempts.find(x => x.attemptId === a.attemptId)); }
    const claimed = this.transaction(s => { const original = s.attempts.find(x => x.attemptId === a.attemptId); if (original.dispatched) return false; original.dispatched = true; return true; });
    if (!claimed) { await this.refresh(run.runId); return this.publicAttempt(this.read().attempts.find(x => x.attemptId === a.attemptId)); }
    try {
      const result = await this.options.execute({ ...a, teamScope: { teamSessionId: a.sessionId, nodeId: agent.nodeId, parentRequestId: a.requestId } });
      this.observe(a.attemptId, result);
    } catch (error) {
      this.transaction(s => {
        const item = s.attempts.find(x => x.attemptId === a.attemptId);
        item.state = error.executionNotDispatched ? 'rejected' : 'unknown';
        item.error = { code: error.code || 'TEAM_EXECUTION', message: error.executionNotDispatched ? '本轮未派发，请检查原节点和配置。' : '原执行回应未确认，请查询原请求。' };
        return null;
      });
    }
    return this.publicAttempt(this.read().attempts.find(x => x.attemptId === a.attemptId));
  }
  publicAttempt(a) { const { sessionId, nativeSessionId, ...result } = a; return {...result,nativeSessionBound:!!nativeSessionId}; }
  admit(scope, nodeId) {
    try {
      const s=this.read(),run=this.authorize(s,{sessionId:scope.teamSessionId});
      const session=s.sessions.find(x=>x.sessionId===scope.teamSessionId);
      const attempt=s.attempts.find(x=>x.sessionId===scope.teamSessionId);
      if(attempt?.automatic&&(!run.automation?.enabled||!run.automation.agentIds.includes(attempt.agentId)||run.automation.generation!==attempt.policyGeneration||Date.now()-Date.parse(run.automation.startedAt)>=run.automation.maxMinutes*60000))throw fail('TEAM_FORBIDDEN','自动执行授权已变化。');
      if (attempt?.workItemId) { const item=workItem(s,run,attempt.workItemId); if(item.ownerId!==attempt.agentId||item.round!==attempt.workRound||item.state!=='running')throw fail('TEAM_FORBIDDEN','本轮任务已变化，不能继续派发。'); }
      if(session.kind!=='native'||run.paused||!attempt||attempt.nodeId!==nodeId||attempt.requestId!==scope.parentRequestId)throw fail('TEAM_FORBIDDEN','小队执行已暂停、撤权或来源不匹配。');
    }catch(error){error.executionNotDispatched=true;throw error;}
  }
  async nativeTool(scope, name, p, sourceMachine) {
    const s = this.read(), session = s.sessions.find(x => x.sessionId === scope.teamSessionId);
    if (!session || session.kind !== 'native') throw fail('TEAM_FORBIDDEN', '原生小队调用身份不合法。');
    const a = s.attempts.find(x => x.sessionId === session.sessionId);
    if (!a || a.nodeId !== scope.nodeId || a.requestId !== scope.parentRequestId || this.options.validateNode(a.nodeId).machineId !== sourceMachine)
      throw fail('TEAM_FORBIDDEN', '小队调用来源不属于原执行。');
    try { this.observe(a.attemptId, await this.options.query(a)); }
    catch { throw fail('TEAM_UNCONFIRMED', '无法核对原执行，小队写入暂不可用。'); }
    return this.tool(session.sessionId, name, p);
  }
  observe(id, task) {
    if (!task || !['queued', 'accepted', 'running', 'succeeded', 'failed', 'cancelled', 'unknown'].includes(task.status)) throw fail('TEAM_EXECUTION', '原执行返回不完整，保留原请求待核对。');
    this.transaction(s => {
      const a = s.attempts.find(x => x.attemptId === id);
      if (task.requestId !== a.requestId || (a.taskId && task.taskId !== a.taskId) || (a.conversationId && task.conversationId !== a.conversationId)) throw fail('TEAM_EXECUTION', '原请求身份不匹配，保留原记录待核对。');
      if (terminal.has(a.state)) return null;
      a.state = task.status; a.taskId = task.taskId; a.conversationId = task.conversationId;
      if(typeof task.native?.sessionId==='string'&&task.native.sessionId.length<500){
        const previous=s.attempts.find(x=>x.attemptId===a.previousAttemptId);
        if((a.nativeSessionId&&a.nativeSessionId!==task.native.sessionId)||(previous?.nativeSessionId&&previous.nativeSessionId!==task.native.sessionId))a.continuationError='TEAM_SESSION_CHANGED';
        a.nativeSessionId=task.native.sessionId;
      }
      a.updatedAt = stamp();
      if(task.taskId&&task.status!=='unknown')for(const m of s.messages.filter(m=>m.attemptId===a.attemptId))for(const d of s.deliveries.filter(d=>d.messageId===m.messageId&&d.agentId===a.agentId&&d.state==='pending'))d.state='delivered';
      if (terminal.has(task.status)) {
        a.result = String(task.result?.message || '').slice(0,32000); a.error = task.error ? { code: task.error.code, message: String(task.error.message || '').slice(0,2000) } : undefined;
        s.sessions.find(x => x.sessionId === a.sessionId).revoked = true;
        const r = this.run(s, a.runId);
        this.message(s, r, 'system', task.status === 'succeeded' ? '一轮原生执行已完成，请核对结果与业务验收条件。' : '一轮原生执行未成功，请查看原执行结果。', r.memberIds.includes(r.leaderId) ? [r.leaderId] : [], { attemptId: a.attemptId });
      }
      automation.settleAcceptance(s,this.run(s,a.runId),this);
      return null;
    });
  }
  async refresh(runId) {
    this.run(this.read(), runId);
    for (const a of this.read().attempts.filter(a => a.runId === runId && !terminal.has(a.state) && a.state !== 'rejected')) {
      try { this.observe(a.attemptId, await this.options.query(a)); }
      catch { /* Missing receipts do not release an intent or replay it. */ }
    }
  }
  async restoreConnections() {
    for (const x of this.read().sessions.filter(x => !x.revoked && x.kind === 'connection')) {
      try { this.authorize(this.read(), { sessionId: x.sessionId }); await this.options.configure(x); }
      catch { /* Revoked/offline members retain their original records. */ }
    }
  }
  close() { this.db.close(); }
}
module.exports = { TeamSpace, instructions };
