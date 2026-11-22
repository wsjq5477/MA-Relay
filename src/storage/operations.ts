import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { BridgeError } from '../core.js';
import type { Interaction } from '../protocol.js';
import { canonicalJSON } from '../security.js';

export interface Operation { operationId: string; state: 'attempted' | 'confirmed' | 'unknown' | 'rejected'; data?: unknown }
interface StoredOperation extends Operation {
  binding?: { taskId: string; executionId: string; kind: 'reply' | 'cancel' };
}
export class Operations {
  constructor(private readonly db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS interactions(
      id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, data TEXT NOT NULL);`);
    for (const row of db.prepare('SELECT id,data FROM interactions').all() as { id: string; data: string }[]) {
      const operation = JSON.parse(row.data) as Operation;
      if (operation.state === 'attempted') this.finish(row.id, 'unknown');
    }
  }
  private read(id: string): StoredOperation | undefined {
    const row = this.db.prepare('SELECT data FROM interactions WHERE id=?').get(id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) as StoredOperation : undefined;
  }
  get(id: string): Operation | undefined {
    const stored = this.read(id);
    return stored && { operationId: stored.operationId, state: stored.state, ...(stored.data === undefined ? {} : { data: stored.data }) };
  }
  forTask(id: string, task: { taskId: string; executionId: string }): (Operation & { taskId?: string; kind?: 'reply' | 'cancel' }) | undefined {
    const stored = this.read(id);
    if (!stored) return undefined;
    const { binding, ...operation } = stored;
    if (binding) {
      if (binding.taskId !== task.taskId || binding.executionId !== task.executionId) return undefined;
      return { ...operation, taskId: binding.taskId, kind: binding.kind };
    }
    const row = this.db.prepare('SELECT request_key FROM interactions WHERE id=?').get(id) as { request_key: string } | undefined;
    return row?.request_key.startsWith(task.executionId + ':') ? operation : undefined;
  }
  claim(input: Interaction): { fresh: boolean; operation: Operation } {
    const fingerprint = createHash('sha256').update(canonicalJSON(input)).digest('hex');
    const prior = this.db.prepare('SELECT fingerprint FROM interactions WHERE id=?').get(input.operationId) as { fingerprint: string } | undefined;
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new BridgeError('OPERATION_CONFLICT', '操作 ID 已绑定不同内容', 409);
      return { fresh: false, operation: this.get(input.operationId)! };
    }
    const key = input.executionId + ':' + (input.action === 'cancel' ? 'cancel' : input.requestId);
    if (this.db.prepare('SELECT id FROM interactions WHERE request_key=?').get(key)) throw new BridgeError('REQUEST_CLAIMED', '此原生请求已有回复记录，请查询原操作，不能重复发送', 409);
    const operation: Operation = { operationId: input.operationId, state: 'attempted' };
    const binding = { taskId: input.taskId, executionId: input.executionId, kind: input.action === 'cancel' ? 'cancel' : 'reply' };
    this.db.prepare('INSERT INTO interactions(id,request_key,fingerprint,data) VALUES(?,?,?,?)').run(input.operationId, key, fingerprint, JSON.stringify({ ...operation, binding }));
    return { fresh: true, operation };
  }
  finish(id: string, state: Operation['state'], data?: unknown): Operation {
    const operation: Operation = { operationId: id, state, ...(data === undefined ? {} : { data }) };
    const binding = this.read(id)?.binding;
    const stored = JSON.stringify({ ...operation, ...(binding ? { binding } : {}) });
    if (state === 'rejected') this.db.prepare('UPDATE interactions SET data=?, request_key=? WHERE id=?').run(stored, 'rejected:' + id, id);
    else this.db.prepare('UPDATE interactions SET data=? WHERE id=?').run(stored, id);
    return operation;
  }
}
