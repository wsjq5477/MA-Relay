import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { BridgeError } from '../core.js';
import type { Interaction } from '../protocol.js';
import { canonicalJSON } from '../security.js';

export interface Operation { operationId: string; state: 'attempted' | 'confirmed' | 'unknown' | 'rejected'; data?: unknown }
export class Operations {
  constructor(private readonly db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS interactions(
      id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, data TEXT NOT NULL);`);
    for (const row of db.prepare('SELECT id,data FROM interactions').all() as { id: string; data: string }[]) {
      const operation = JSON.parse(row.data) as Operation;
      if (operation.state === 'attempted') this.finish(row.id, 'unknown');
    }
  }
  get(id: string): Operation | undefined {
    const row = this.db.prepare('SELECT data FROM interactions WHERE id=?').get(id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) as Operation : undefined;
  }
  belongs(id: string, executionId: string): boolean {
    const row = this.db.prepare('SELECT request_key FROM interactions WHERE id=?').get(id) as { request_key: string } | undefined;
    return !!row?.request_key.startsWith(executionId + ':');
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
    this.db.prepare('INSERT INTO interactions(id,request_key,fingerprint,data) VALUES(?,?,?,?)').run(input.operationId, key, fingerprint, JSON.stringify(operation));
    return { fresh: true, operation };
  }
  finish(id: string, state: Operation['state'], data?: unknown): Operation {
    const operation: Operation = { operationId: id, state, ...(data === undefined ? {} : { data }) };
    this.db.prepare('UPDATE interactions SET data=? WHERE id=?').run(JSON.stringify(operation), id);
    if (state === 'rejected') this.db.prepare('UPDATE interactions SET request_key=? WHERE id=?').run('rejected:' + id, id);
    return operation;
  }
}
