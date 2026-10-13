import { z } from 'zod';
import { BridgeError } from '../core.js';
const field = z.object({ key: z.string(), type: z.enum(['string', 'boolean', 'number', 'integer', 'multiselect', 'external']),
  title: z.string().optional(), description: z.string().optional(), required: z.boolean().optional(), hidden: z.boolean().optional(),
  when: z.array(z.object({ key: z.string(), op: z.enum(['eq', 'neq']), value: z.union([z.string(), z.number(), z.boolean()]) })).optional(),
  minLength: z.number().optional(), maxLength: z.number().optional(), pattern: z.string().optional(),
  minimum: z.number().optional(), maximum: z.number().optional(), minItems: z.number().optional(), maxItems: z.number().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() }).passthrough()).optional(), custom: z.boolean().optional(),
}).passthrough();
export const fieldsSchema = z.array(field).min(1).max(100);
export type FormField = z.infer<typeof field>;
export type Answer = Record<string, string | number | boolean | string[]>;
export function visible(field: FormField, answer: Answer): boolean {
  return !field.hidden && (field.when || []).every(w => w.op === 'eq' ? answer[w.key] === w.value : answer[w.key] !== w.value);
}
export function validateAnswer(raw: unknown, answer: Answer): void {
  const fields = fieldsSchema.parse(raw);
  if (Object.keys(answer).some(key => !fields.some(f => f.key === key && visible(f, answer) && f.type !== 'external'))) throw new BridgeError('INVALID_ANSWER', '表单包含未知或隐藏字段');
  for (const f of fields.filter(f => visible(f, answer) && f.type !== 'external')) {
    const value = answer[f.key];
    if (value === undefined) { if (f.required) throw new BridgeError('INVALID_ANSWER', '缺少必填字段: ' + f.key); continue; }
    let valid = false;
    if (f.type === 'string') valid = typeof value === 'string' && value.length >= (f.minLength || 0) && value.length <= (f.maxLength ?? 65536)
      && (!f.required || !!value.trim()) && (!f.pattern || new RegExp(f.pattern).test(value))
      && (!f.options || f.custom || f.options.some(o => o.value === value));
    if (f.type === 'boolean') valid = typeof value === 'boolean';
    if (f.type === 'number' || f.type === 'integer') valid = typeof value === 'number' && Number.isFinite(value) && (f.type !== 'integer' || Number.isInteger(value)) && value >= (f.minimum ?? -Infinity) && value <= (f.maximum ?? Infinity);
    if (f.type === 'multiselect') valid = Array.isArray(value) && value.length >= (f.minItems || 0) && value.length <= (f.maxItems ?? 100) && value.every(v => f.custom || f.options?.some(o => o.value === v));
    if (!valid) throw new BridgeError('INVALID_ANSWER', '字段不符合原生表单约束: ' + f.key);
  }
}
