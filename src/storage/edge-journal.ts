import { createHash } from 'node:crypto';
import { BridgeError, type TaskEvent, type NativeReference } from '../core.js';
import type { Execution } from '../protocol.js';
import { Database } from './database.js';
import { Operations } from './operations.js';

export class EdgeJournal extends Database {
  readonly operations: Operations;
  constructor(directory: string) {
    super(directory, 'edge.sqlite');
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS executions(
          task_id TEXT PRIMARY KEY, execution_id TEXT NOT NULL UNIQUE, agent_id TEXT NOT NULL,
          fingerprint TEXT NOT NULL, phase TEXT NOT NULL, seq INTEGER NOT NULL DEFAULT 0,
          invocations INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS events(
          execution_id TEXT NOT NULL REFERENCES executions(execution_id),
          seq INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(execution_id,seq));
        CREATE TABLE IF NOT EXISTS native_bindings(
          execution_id TEXT PRIMARY KEY REFERENCES executions(execution_id), data TEXT NOT NULL);
      `);
      const columns = this.db.prepare('PRAGMA table_info(executions)').all() as { name: string }[];
      if (!columns.some(column => column.name === 'resource_key')) this.db.exec('ALTER TABLE executions ADD COLUMN resource_key TEXT');
      if (!columns.some(column => column.name === 'payload')) this.db.exec('ALTER TABLE executions ADD COLUMN payload TEXT');
      if (!columns.some(column => column.name === 'ack_seq')) this.db.exec('ALTER TABLE executions ADD COLUMN ack_seq INTEGER NOT NULL DEFAULT 0');
      this.operations = new Operations(this.db);
    } catch { this.close(); throw new BridgeError('STORAGE_UNAVAILABLE', 'Cannot initialize Edge storage'); }
  }
  claim(execution: Execution, resourceKey?: string): boolean {
    const fingerprint = createHash('sha256').update(JSON.stringify(execution)).digest('hex');
    return this.transaction(() => {
      const existing = this.db.prepare('SELECT fingerprint FROM executions WHERE task_id=? OR execution_id=?')
        .get(execution.taskId, execution.executionId) as { fingerprint: string } | undefined;
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw new BridgeError('EXECUTION_CONFLICT', 'Execution identity has different input', 409);
        return false;
      }
      this.db.prepare("INSERT INTO executions(task_id,execution_id,agent_id,fingerprint,phase,resource_key,payload) VALUES(?,?,?,?,'prepared',?,?)")
        .run(execution.taskId, execution.executionId, execution.targetAgent, fingerprint, resourceKey || null, JSON.stringify(execution));
      return true;
    });
  }
  busy(agentId: string, resourceKey?: string): boolean {
    return !!this.db.prepare("SELECT task_id FROM executions WHERE (agent_id=? OR resource_key=?) AND phase!='terminal' LIMIT 1").get(agentId, resourceKey || null);
  }
  bind(executionId: string, reference: NativeReference): void {
    this.db.prepare('INSERT INTO native_bindings(execution_id,data) VALUES(?,?)').run(executionId, JSON.stringify(reference));
  }
  native(executionId: string): NativeReference | undefined {
    const row = this.db.prepare('SELECT data FROM native_bindings WHERE execution_id=?').get(executionId) as { data: string } | undefined;
    return row ? JSON.parse(row.data) as NativeReference : undefined;
  }
  execution(executionId: string): { task_id: string; agent_id: string; phase: string } | undefined {
    return this.db.prepare('SELECT task_id,agent_id,phase FROM executions WHERE execution_id=?').get(executionId) as ReturnType<EdgeJournal['execution']>;
  }
  invoke(executionId: string): void {
    const result = this.db.prepare("UPDATE executions SET phase='invoked',invocations=1 WHERE execution_id=? AND phase='prepared' AND invocations=0").run(executionId);
    if (result.changes !== 1) throw new BridgeError('DUPLICATE_EXECUTION', 'Driver invocation is already recorded', 409);
  }
  record(executionId: string, event: TaskEvent): number {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT seq FROM executions WHERE execution_id=?').get(executionId) as { seq: number } | undefined;
      if (!row) throw new BridgeError('EXECUTION_MISSING', 'Execution record missing');
      const seq = row.seq + 1;
      const terminal = event.kind === 'completed' || event.kind === 'failed' || event.kind === 'cancelled';
      this.db.prepare('INSERT INTO events(execution_id,seq,data) VALUES(?,?,?)').run(executionId, seq, JSON.stringify(event));
      this.db.prepare('UPDATE executions SET seq=?,phase=CASE WHEN ? THEN ? ELSE phase END WHERE execution_id=?')
        .run(seq, terminal ? 1 : 0, 'terminal', executionId);
      return seq;
    });
  }
  payload(executionId: string): Execution | undefined {
    const row = this.db.prepare('SELECT payload FROM executions WHERE execution_id=?').get(executionId) as { payload: string | null } | undefined;
    return row?.payload ? JSON.parse(row.payload) as Execution : undefined;
  }
  outstanding(): { taskId: string; executionId: string; agentId: string; phase: string; invocations: number }[] {
    return this.db.prepare("SELECT task_id AS taskId,execution_id AS executionId,agent_id AS agentId,phase,invocations FROM executions WHERE phase!='terminal'").all() as ReturnType<EdgeJournal['outstanding']>;
  }
  outbox(): { taskId: string; executionId: string; seq: number; event: TaskEvent }[] {
    return this.db.prepare('SELECT x.task_id AS taskId,e.execution_id AS executionId,e.seq,e.data FROM events e JOIN executions x ON x.execution_id=e.execution_id WHERE e.seq>x.ack_seq ORDER BY x.rowid,e.seq')
      .all().map(r => { const row = r as { taskId: string; executionId: string; seq: number; data: string }; return { taskId: row.taskId, executionId: row.executionId, seq: row.seq, event: JSON.parse(row.data) as TaskEvent }; });
  }
  acknowledge(executionId: string, seq: number): void {
    const row = this.db.prepare('SELECT ack_seq,seq FROM executions WHERE execution_id=?').get(executionId) as { ack_seq: number; seq: number };
    if (!row || seq > row.seq || seq > row.ack_seq + 1) throw new BridgeError('ACK_ORDER', 'ACK 必须连续且对应已持久事件', 409);
    if (seq <= row.ack_seq) return;
    this.db.prepare('UPDATE executions SET ack_seq=? WHERE execution_id=?').run(seq, executionId);
  }
  events(executionId: string): TaskEvent[] {
    return this.db.prepare('SELECT data FROM events WHERE execution_id=? ORDER BY seq').all(executionId).map(r => JSON.parse((r as { data: string }).data) as TaskEvent);
  }
  counts(): { taskId: string; executionId: string; agentId: string; invocations: number; phase: string }[] {
    return this.db.prepare('SELECT task_id AS taskId,execution_id AS executionId,agent_id AS agentId,invocations,phase FROM executions ORDER BY task_id').all() as ReturnType<EdgeJournal['counts']>;
  }
}
