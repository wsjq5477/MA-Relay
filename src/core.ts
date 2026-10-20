import { z } from 'zod';

export const idSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_.:-]+$/);
export const statusSchema = z.enum(['queued', 'accepted', 'running', 'succeeded', 'failed', 'cancelled', 'unknown']);
export type Status = z.infer<typeof statusSchema>;
export interface TaskError { code: string; message: string; phase: 'before_execution' | 'execution' }
export interface Result { agentId: string; message: string; truncated?: boolean }
export interface Task {
  taskId: string; executionId: string; conversationId: string; requestId: string;
  owner: string; targetAgent: string; message: string; status: Status;
  createdAt: string; updatedAt: string; startedAt?: string; finishedAt?: string;
  lastSummary: string; result?: Result; error?: TaskError;
  uncertaintyReason?: string; lastKnownStatus?: Status; attempted: boolean;
  lastSeq: number; detailsTruncated: boolean;
  turn?: number; resumeNative?: NativeReference; transportUnknown?: boolean;
  reconciliation?: { time: string; state: string; reason: string };
  native?: NativeReference; waiting?: { kind: 'permission' | 'input'; summary: string; requestIds: string[] };
  resourceKey?: string; verification?: boolean; configRevision?: number; configFingerprint?: string;
}
export const nativeSchema = z.object({
  sessionId: idSchema, messageId: idSchema, serverUrl: z.string().url(), workspace: z.string().min(1),
  priorMessageIds: z.array(idSchema).max(1000).optional(),
  snapshot: z.object({ nativeAgent: z.string(), passwordFile: z.string(), configFingerprint: z.string(),
    nativeProtocol: z.enum(['v1', 'v2']).optional(),
    configRevision: z.number().int().positive().optional(), resourceKey: z.string().optional(),
    model: z.object({ providerID: z.string(), id: z.string(), variant: z.string().optional() }).strict().optional(),
    permissions: z.array(z.object({ action: z.string(), resource: z.string(), effect: z.enum(['ask', 'deny']) }).strict()).optional(),
  }).strict().optional(),
}).strict();
export interface Conversation {
  conversationId: string; owner: string; title: string; targetAgent: string;
  createdAt: string; updatedAt: string; resourceKey?: string; configFingerprint?: string;
  native?: NativeReference; turns: number; lastTaskId?: string;
}
export type NativeReference = z.infer<typeof nativeSchema>;
export const descriptorSchema = z.object({
  agentId: idSchema, name: z.string().min(1).max(100), adapter: z.enum(['mock', 'opencode']),
  healthy: z.boolean(),
  workspace: z.string().optional(),
  enabled: z.boolean().optional(), resourceKey: z.string().optional(), revision: z.number().int().positive().optional(),
  configFingerprint: z.string().optional(),
  selectedModel: z.object({ providerID: z.string(), id: z.string(), variant: z.string().optional() }).strict().nullable().optional(),
  modelCheckedAt: z.iso.datetime().optional(),
}).strict();
export type Descriptor = z.infer<typeof descriptorSchema>;
export interface Agent extends Descriptor {
  connectorId: string; device: string; lastSeenAt: string;
  capabilities: { concurrency: 1; progress: true; cancel: boolean; nativeSessions: boolean };
}
export const errorSchema = z.object({
  code: idSchema, message: z.string().max(65536),
  phase: z.enum(['before_execution', 'execution']),
}).strict();
export const eventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('accepted') }).strict(),
  z.object({ kind: z.literal('started') }).strict(),
  z.object({ kind: z.literal('native'), reference: nativeSchema }).strict(),
  z.object({ kind: z.literal('waiting'), waiting: z.object({
    kind: z.enum(['permission', 'input']), summary: z.string().max(16000), requestIds: z.array(idSchema).max(100),
  }).strict().nullable() }).strict(),
  z.object({ kind: z.literal('progress'), text: z.string().max(262144) }).strict(),
  z.object({ kind: z.literal('output'), text: z.string().max(262144) }).strict(),
  z.object({
    kind: z.literal('completed'),
    result: z.object({ agentId: idSchema, message: z.string().max(262144), truncated: z.boolean().optional() }).strict(),
  }).strict(),
  z.object({ kind: z.literal('failed'), error: errorSchema }).strict(),
  z.object({ kind: z.literal('cancelled'), reason: z.string().max(1000) }).strict(),
  z.object({ kind: z.literal('reconciled'), reference: nativeSchema, reason: z.string().max(1000) }).strict(),
  z.object({ kind: z.literal('unknown'), reason: z.string().max(1000) }).strict(),
]);
export type TaskEvent = z.infer<typeof eventSchema>;
export interface StoredEvent {
  seq: number; timestamp: string; event: TaskEvent; truncated: boolean;
}
export function terminal(status: Status): boolean { return status === 'succeeded' || status === 'failed' || status === 'cancelled'; }
export function nextStatus(current: Status, event: TaskEvent): Status {
  if (current === 'unknown' && event.kind === 'unknown') return 'unknown';
  if (current === 'unknown' && event.kind === 'reconciled') return 'running';
  if (terminal(current) || current === 'unknown') throw new BridgeError('ILLEGAL_STATE', 'Task state does not allow this event', 409);
  switch (event.kind) {
    case 'unknown': return 'unknown';
    case 'accepted': if (current === 'queued') return 'accepted'; break;
    case 'started': if (current === 'accepted') return 'running'; break;
    case 'reconciled':
    case 'progress':
    case 'native':
    case 'waiting':
    case 'output': if (current === 'running') return current; break;
    case 'cancelled': if (current === 'running') return 'cancelled'; break;
    case 'completed': if (current === 'running') return 'succeeded'; break;
    case 'failed':
      if (current === 'running' && event.error.phase === 'execution') return 'failed';
      if ((current === 'queued' || current === 'accepted') && event.error.phase === 'before_execution') return 'failed';
  }
  throw new BridgeError('ILLEGAL_STATE', 'Task state does not allow this event', 409);
}
export class BridgeError extends Error {
  constructor(public readonly code: string, message: string, public readonly httpStatus = 400) { super(message); }
}
export function clip(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const bytes = Buffer.from(text);
  if (bytes.length <= maxBytes) return { text, truncated: false };
  // Decode without splitting a UTF-8 code point.
  let end = maxBytes;
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end--;
  return { text: bytes.subarray(0, end).toString('utf8'), truncated: true };
}
