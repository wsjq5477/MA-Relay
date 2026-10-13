import { createHash, randomUUID } from 'node:crypto';
import { Database } from './database.js';
import { BridgeError, clip, nextStatus, terminal, type Agent, type StoredEvent, type Task, type TaskEvent, type Conversation } from '../core.js';
import { Operations } from './operations.js';
import { localDeviceId } from '../settings.js';
import { realpathSync } from 'node:fs';

type Row = { data: string };
function decode<T>(row: unknown): T | undefined { return row ? JSON.parse((row as Row).data) as T : undefined; }
function hash(data: unknown): string { return createHash('sha256').update(JSON.stringify(data)).digest('hex'); }
export class HubStore extends Database {
  readonly operations: Operations;
  constructor(directory: string, private readonly eventBytes = 4096, private readonly maxEvents = 128) {
    super(directory, 'hub.sqlite');
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY, owner TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS agents(id TEXT PRIMARY KEY, connector TEXT NOT NULL, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS tasks(
          ordinal INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
          owner TEXT NOT NULL, request_id TEXT NOT NULL, target TEXT NOT NULL,
          execution_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL, data TEXT NOT NULL,
          conversation_id TEXT NOT NULL REFERENCES conversations(id), UNIQUE(owner,request_id));
        CREATE UNIQUE INDEX IF NOT EXISTS one_active_per_agent ON tasks(target)
          WHERE status NOT IN ('succeeded','failed','cancelled');
        CREATE TABLE IF NOT EXISTS events(
          task_id TEXT NOT NULL REFERENCES tasks(id), seq INTEGER NOT NULL,
          fingerprint TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(task_id,seq));
      `);
      const columns = this.db.prepare('PRAGMA table_info(conversations)').all() as { name: string }[];
      if (!columns.some(c => c.name === 'data')) this.db.exec('ALTER TABLE conversations ADD COLUMN data TEXT');
      this.db.exec("DROP INDEX IF EXISTS one_active_per_agent; CREATE UNIQUE INDEX one_active_per_agent ON tasks(target) WHERE status NOT IN ('succeeded','failed','cancelled');");
      this.transaction(() => {
        for (const task of this.db.prepare('SELECT data FROM tasks ORDER BY ordinal').all().map(r => decode<Task>(r)!)) {
          if (this.conversation(task.conversationId)) continue;
          this.saveConversation({ conversationId: task.conversationId, owner: task.owner, title: clip(task.message, 160).text,
            targetAgent: task.targetAgent, createdAt: task.createdAt, updatedAt: task.updatedAt, resourceKey: task.resourceKey,
            configFingerprint: task.configFingerprint, native: task.native, turns: 1, lastTaskId: task.taskId });
        }
      });
      this.operations = new Operations(this.db);
    } catch { this.close(); throw new BridgeError('STORAGE_UNAVAILABLE', 'Cannot initialize Hub storage'); }
  }
  agents(): Agent[] { return this.db.prepare('SELECT data FROM agents ORDER BY id').all().map(row => decode<Agent>(row)!); }
  agent(id: string): Agent | undefined { return decode<Agent>(this.db.prepare('SELECT data FROM agents WHERE id=?').get(id)); }
  register(agents: Agent[]): void {
    this.transaction(() => {
      for (const agent of agents) {
        const old = this.agent(agent.agentId);
        if (old && old.connectorId !== agent.connectorId) throw new BridgeError('AGENT_OWNERSHIP', 'Agent belongs to another Connector', 403);
        const task = this.active(agent.agentId);
        if (task && !task.resourceKey && (old?.resourceKey || agent.resourceKey)) {
          let historical = task.native?.workspace;
          if (!historical && old?.workspace) { try { const canonical = realpathSync(old.workspace); if (canonical === old.workspace) historical = canonical; } catch { /* Do not guess an unavailable historical resource. */ } }
          task.resourceKey = task.native?.snapshot?.resourceKey || old?.resourceKey || (historical
            ? createHash('sha256').update(localDeviceId() + ':' + historical).digest('hex') : 'unresolved:' + task.executionId);
          this.save(task);
        }
        this.db.prepare('INSERT INTO agents(id,connector,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
          .run(agent.agentId, agent.connectorId, JSON.stringify(agent));
      }
    });
  }
  get(id: string): Task | undefined { return decode<Task>(this.db.prepare('SELECT data FROM tasks WHERE id=?').get(id)); }
  byRequest(owner: string, requestId: string): Task | undefined {
    return decode<Task>(this.db.prepare('SELECT data FROM tasks WHERE owner=? AND request_id=?').get(owner, requestId));
  }
  active(agentId: string): Task | undefined {
    return decode<Task>(this.db.prepare("SELECT data FROM tasks WHERE target=? AND status NOT IN ('succeeded','failed','cancelled')").get(agentId));
  }
  occupied(agentId: string, resourceKey?: string): Task | undefined {
    const direct = this.active(agentId);
    if (direct || !resourceKey) return direct;
    return this.db.prepare("SELECT data FROM tasks WHERE status NOT IN ('succeeded','failed','cancelled')").all()
      .map(row => decode<Task>(row)!).find(task => task.resourceKey === resourceKey || task.resourceKey?.startsWith('unresolved:'));
  }
  private save(task: Task): void {
    this.db.prepare('UPDATE tasks SET status=?,data=? WHERE id=?').run(task.status, JSON.stringify(task), task.taskId);
  }
  conversation(id: string): Conversation | undefined {
    return decode<Conversation>(this.db.prepare('SELECT data FROM conversations WHERE id=?').get(id));
  }
  conversations(owner: string): Conversation[] {
    return this.db.prepare('SELECT data FROM conversations WHERE owner=? ORDER BY created_at DESC').all(owner).map(r => decode<Conversation>(r)).filter((c): c is Conversation => !!c);
  }
  turns(id: string, owner: string): Task[] {
    return this.db.prepare('SELECT data FROM tasks WHERE conversation_id=? AND owner=? ORDER BY ordinal').all(id, owner).map(r => decode<Task>(r)!);
  }
  private saveConversation(conversation: Conversation): void {
    this.db.prepare('UPDATE conversations SET data=? WHERE id=?').run(JSON.stringify(conversation), conversation.conversationId);
  }
  create(owner: string, requestId: string, target: string, message: string, verification?: boolean, conversationId?: string): Task {
    return this.transaction(() => {
      const agent = this.agent(target);
      if (this.occupied(target, agent?.resourceKey)) throw new BridgeError('AGENT_BUSY', 'Agent/project is occupied', 409);
      const time = new Date().toISOString();
      const conversation = conversationId ? this.conversation(conversationId) : undefined;
      if (conversationId) {
        if (!conversation || conversation.owner !== owner) throw new BridgeError('NOT_FOUND', '会话不存在', 404);
        if (conversation.targetAgent !== target || conversation.resourceKey !== agent?.resourceKey || !conversation.configFingerprint || conversation.configFingerprint !== agent?.configFingerprint) throw new BridgeError('CONVERSATION_CONFIG', '连接配置已变化，请新建会话', 409);
        if (conversation.turns >= 1001) throw new BridgeError('CONVERSATION_LIMIT', '会话达到轮次上限，请新建会话', 409);
        const last = conversation.lastTaskId ? this.get(conversation.lastTaskId) : undefined;
        if (!last || !terminal(last.status)) throw new BridgeError('CONVERSATION_BUSY', '上一轮尚未结束或需要对账', 409);
        if (!conversation.native || last.verification || verification) throw new BridgeError('CONVERSATION_BINDING', '此会话无法续问，请新建会话', 409);
      }
      const task: Task = {
        taskId: randomUUID(), executionId: randomUUID(), conversationId: conversation?.conversationId || randomUUID(), requestId,
        owner, targetAgent: target, message, status: 'queued', createdAt: time, updatedAt: time,
        turn: (conversation?.turns || 0) + 1, ...(conversation?.native ? { resumeNative: conversation.native } : {}),
        lastSummary: 'Preparing dispatch', attempted: false, lastSeq: 0, detailsTruncated: false,
        ...(agent?.resourceKey ? { resourceKey: agent.resourceKey } : {}),
        ...(agent?.revision ? { configRevision: agent.revision } : {}), ...(verification ? { verification: true } : {}),
        ...(agent?.configFingerprint ? { configFingerprint: agent.configFingerprint } : {}),
      };
      if (!conversation) this.db.prepare('INSERT INTO conversations(id,owner,created_at) VALUES(?,?,?)').run(task.conversationId, owner, time);
      this.saveConversation({ ...(conversation || { conversationId: task.conversationId, owner, title: clip(message, 160).text, targetAgent: target, createdAt: time,
        resourceKey: task.resourceKey, configFingerprint: task.configFingerprint }), updatedAt: time, turns: task.turn!, lastTaskId: task.taskId });
      this.db.prepare('INSERT INTO tasks(id,owner,request_id,target,execution_id,status,data,conversation_id) VALUES(?,?,?,?,?,?,?,?)')
        .run(task.taskId, owner, requestId, target, task.executionId, task.status, JSON.stringify(task), task.conversationId);
      return task;
    });
  }
  attempted(id: string): void {
    const task = this.get(id)!;
    task.attempted = true;
    task.updatedAt = new Date().toISOString();
    this.save(task);
  }
  list(owner: string, cursor = 0, limit = 100): { items: Task[]; nextCursor?: number; scope: string } {
    const rows = this.db.prepare('SELECT ordinal,data FROM tasks WHERE owner=? AND ordinal>? ORDER BY ordinal LIMIT ?')
      .all(owner, cursor, limit + 1) as { ordinal: number; data: string }[];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return { items: page.map(row => decode<Task>(row)!), ...(hasMore ? { nextCursor: page.at(-1)!.ordinal } : {}), scope: 'AgentBridge-created tasks only' };
  }
  events(id: string): StoredEvent[] {
    return this.db.prepare('SELECT data FROM events WHERE task_id=? ORDER BY seq').all(id).map(row => decode<StoredEvent>(row)!);
  }
  acceptEvent(taskId: string, executionId: string, seq: number, event: TaskEvent): void {
    this.transaction(() => {
      const task = this.get(taskId);
      if (!task || task.executionId !== executionId) throw new BridgeError('EXECUTION_MISMATCH', 'Execution does not match Task', 403);
      const prior = this.db.prepare('SELECT fingerprint FROM events WHERE task_id=? AND seq=?').get(taskId, seq) as { fingerprint: string } | undefined;
      const fingerprint = hash(event);
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new BridgeError('EVENT_CONFLICT', 'Event sequence has different content', 409);
        return;
      }
      if (seq !== task.lastSeq + 1) throw new BridgeError('EVENT_ORDER', 'Event sequence is not contiguous', 409);
      const previousStatus = task.status;
      const provenNotInvoked = event.kind === 'failed' && event.error.code === 'NOT_INVOKED' && event.error.phase === 'before_execution' && !task.native && ['queued', 'accepted'].includes(task.lastKnownStatus || '');
      const base = task.status === 'unknown' && (task.transportUnknown || provenNotInvoked) && event.kind !== 'reconciled' ? task.lastKnownStatus || 'queued' : task.status;
      const status = nextStatus(base, event);
      if (event.kind === 'reconciled' && (!task.native || JSON.stringify(task.native) !== JSON.stringify(event.reference))) throw new BridgeError('NATIVE_CONFLICT', '对账必须使用原始绑定', 409);
      const timestamp = new Date().toISOString();
      let safe = event;
      let truncated = false;
      if (event.kind === 'progress' || event.kind === 'output') {
        const clipped = clip(event.text, this.eventBytes);
        safe = { ...event, text: clipped.text }; truncated = clipped.truncated;
      } else if (event.kind === 'completed') {
        if (event.result.agentId !== task.targetAgent) throw new BridgeError('RESULT_TARGET', 'Result Agent does not match Task', 409);
        const clipped = clip(event.result.message, this.eventBytes);
        truncated = clipped.truncated || !!event.result.truncated;
        safe = { ...event, result: { ...event.result, message: clipped.text, ...(truncated ? { truncated: true } : {}) } };
      } else if (event.kind === 'failed') {
        const clipped = clip(event.error.message, this.eventBytes);
        truncated = clipped.truncated;
        safe = { ...event, error: { ...event.error, message: clipped.text } };
      }
      // Reserve room for a terminal event; the bounded Driver host emits only a few events in I01.
      const count = this.db.prepare('SELECT COUNT(*) AS n FROM events WHERE task_id=?').get(taskId) as { n: number };
      if (count.n >= this.maxEvents - 1 && !terminal(status)) throw new BridgeError('EVENT_LIMIT', 'Task event limit reached', 409);
      if (status !== 'unknown') { delete task.transportUnknown; delete task.uncertaintyReason; delete task.lastKnownStatus; }
      task.status = status; task.updatedAt = timestamp; task.lastSeq = seq;
      task.detailsTruncated ||= truncated;
      switch (safe.kind) {
        case 'unknown': task.transportUnknown = false; task.lastKnownStatus = previousStatus === 'unknown' ? task.lastKnownStatus || 'running' : previousStatus; task.uncertaintyReason = safe.reason; task.lastSummary = 'Execution outcome unknown'; break;
        case 'accepted': task.lastSummary = 'Edge accepted'; break;
        case 'started': task.startedAt = timestamp; task.lastSummary = 'Driver started'; break;
        case 'native':
          if (task.native && JSON.stringify(task.native) !== JSON.stringify(safe.reference)) throw new BridgeError('NATIVE_CONFLICT', 'Native execution binding cannot change', 409);
          task.native = safe.reference; task.lastSummary = 'OpenCode session bound';
          { const c = this.conversation(task.conversationId)!;
            if (c.native && c.native.sessionId !== safe.reference.sessionId) throw new BridgeError('NATIVE_CONFLICT', '会话的原生 Session 不可更换', 409);
            c.native = safe.reference; c.updatedAt = timestamp; this.saveConversation(c); }
          break;
        case 'reconciled': task.reconciliation = { time: timestamp, state: 'observing', reason: safe.reason }; task.lastSummary = safe.reason; break;
        case 'cancelled': delete task.waiting; task.lastSummary = safe.reason; task.finishedAt = timestamp; break;
        case 'waiting':
          if (safe.waiting) task.waiting = safe.waiting;
          else delete task.waiting;
          task.lastSummary = safe.waiting?.summary || 'OpenCode execution resumed'; break;
        case 'progress':
        case 'output': task.lastSummary = safe.text; break;
        case 'completed': delete task.waiting; task.result = safe.result; task.lastSummary = 'Completed'; task.finishedAt = timestamp; break;
        case 'failed': delete task.waiting; task.error = safe.error; task.lastSummary = safe.error.message; task.finishedAt = timestamp; break;
      }
      this.db.prepare('INSERT INTO events(task_id,seq,fingerprint,data) VALUES(?,?,?,?)')
        .run(taskId, seq, fingerprint, JSON.stringify({ seq, timestamp, event: safe, truncated }));
      this.save(task);
    });
  }
  noteReconciliation(id: string, state: string, reason: string): void {
    const task = this.get(id); if (!task) return;
    task.reconciliation = { time: new Date().toISOString(), state, reason }; this.save(task);
  }
  unknown(id: string, reason: string, transport = false): void {
    this.transaction(() => {
      const task = this.get(id);
      if (!task || terminal(task.status) || task.status === 'unknown') return;
      task.transportUnknown = transport; task.lastKnownStatus = task.status; task.status = 'unknown'; task.uncertaintyReason = reason;
      task.lastSummary = 'Execution outcome unknown'; task.updatedAt = new Date().toISOString();
      this.save(task);
    });
  }
  disconnect(connectorId: string, reason: string): void {
    for (const agent of this.agents().filter(a => a.connectorId === connectorId)) {
      const task = this.active(agent.agentId);
      if (task) this.unknown(task.taskId, reason, true);
    }
  }
  recover(): void {
    const tasks = this.db.prepare("SELECT data FROM tasks WHERE status NOT IN ('succeeded','failed','cancelled','unknown')").all().map(row => decode<Task>(row)!);
    for (const task of tasks) {
      if (task.attempted) this.unknown(task.taskId, 'Hub restarted before a terminal result was confirmed', true);
      else this.acceptEvent(task.taskId, task.executionId, task.lastSeq + 1, {
        kind: 'failed', error: { code: 'NOT_DISPATCHED', message: 'Hub stopped before dispatch was attempted', phase: 'before_execution' },
      });
    }
  }
}
