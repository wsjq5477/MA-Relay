import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { descriptorSchema, eventSchema, idSchema, nativeSchema } from './core.js';

const base = {
  protocolVersion: z.literal(1), messageId: idSchema, timestamp: z.iso.datetime(),
};
export const executionSchema = z.object({
  taskId: idSchema, executionId: idSchema, conversationId: idSchema,
  targetAgent: idSchema, message: z.string().max(262144),
  verification: z.boolean().optional(), resumeNative: nativeSchema.optional(),
  configFingerprint: z.string().optional(), configRevision: z.number().int().positive().optional(),
}).strict();
export type Execution = z.infer<typeof executionSchema>;
export const interactionSchema = z.object({
  taskId: idSchema, executionId: idSchema, operationId: idSchema,
  action: z.enum(['pending', 'permission', 'form', 'cancel', 'reconcile']), requestId: idSchema.optional(),
  decision: z.enum(['once', 'reject']).optional(),
  answer: z.record(z.string(), z.union([z.string().max(65536), z.number().finite(), z.boolean(), z.array(z.string())])).optional(),
}).strict();
export type Interaction = z.infer<typeof interactionSchema>;
export const wireSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('agent.register'), payload: z.object({
    device: z.string().min(1).max(100), agents: z.array(descriptorSchema).min(1).max(100),
  }).strict() }).strict(),
  z.object({ ...base, type: z.literal('agent.heartbeat'), payload: z.object({
    agents: z.array(z.object({ agentId: idSchema, healthy: z.boolean(),
      selectedModel: descriptorSchema.shape.selectedModel, modelCheckedAt: descriptorSchema.shape.modelCheckedAt,
    }).strict()).max(100),
  }).strict() }).strict(),
  z.object({ ...base, type: z.literal('task.submit'), payload: executionSchema }).strict(),
  z.object({ ...base, type: z.literal('interaction.request'), payload: interactionSchema }).strict(),
  z.object({ ...base, type: z.literal('interaction.result'), correlationId: idSchema,
    payload: z.object({ data: z.unknown().optional(), error: z.object({ code: idSchema, message: z.string(), status: z.number() }).optional() }).strict(),
  }).strict(),
  z.object({ ...base, type: z.literal('agent.update'), payload: z.object({ agents: z.array(descriptorSchema).min(1).max(100) }).strict() }).strict(),
  z.object({ ...base, type: z.literal('task.event'), taskId: idSchema, executionId: idSchema,
    payload: z.object({ seq: z.number().int().positive(), event: eventSchema }).strict(),
  }).strict(),
  z.object({ ...base, type: z.literal('message.ack'), payload: z.object({
    ackedMessageId: idSchema,
  }).strict() }).strict(),
  z.object({ ...base, type: z.literal('protocol.error'), payload: z.object({
    code: idSchema, message: z.string().max(1000), correlationId: idSchema.optional(),
  }).strict() }).strict(),
]);
export type WireMessage = z.infer<typeof wireSchema>;
export function envelope() {
  return { protocolVersion: 1 as const, messageId: randomUUID(), timestamp: new Date().toISOString() };
}
