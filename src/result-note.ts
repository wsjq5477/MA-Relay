import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, open, readFile, unlink } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { BridgeError, clip } from './core.js';
import { safeTerminal } from './terminal.js';

const id = z.string().min(1).max(4096).regex(/^[\w.:-]+$/);
const descriptorSchema = z.object({ mode: z.literal('caller'), url: z.url(), token: z.string().regex(/^[\w-]{43}$/) });
const eventsSchema = z.discriminatedUnion('supported', [
  z.object({ supported: z.literal(false), taskId: id }),
  z.object({
    supported: z.literal(true), taskId: id, cursor: z.number().int().min(0), highestObservedSeq: z.number().int().min(0),
    hasMore: z.boolean(), cursorGap: z.boolean(), detailsTruncated: z.boolean(),
    items: z.array(z.object({ seq: z.number().int().min(1), event: z.object({
      kind: z.string().regex(/^[a-z-]+$/), text: z.string().optional(),
    }) })).max(20),
  }),
]);
const resultSchema = z.object({
  taskId: id, status: z.enum(['succeeded', 'failed', 'cancelled']),
  outcome: z.object({ terminal: z.literal(true), evidence: z.literal('original-task'), businessAcceptance: z.literal('not-evaluated') }),
  invocation: z.object({ taskId: id, requestId: id, agentId: id }),
  result: z.object({ message: z.string(), truncated: z.boolean().optional() }).optional(),
  error: z.object({ code: z.string().regex(/^[\w.-]{1,96}$/) }).optional(),
  events: eventsSchema,
});
const responseSchema = z.object({ result: z.unknown().optional(), error: z.object({ code: z.string().regex(/^[A-Z_0-9]{1,96}$/) }).optional() });
const errorCode = (error: unknown) => (error as NodeJS.ErrnoException)?.code;

async function readResult(descriptorFile: string, taskId: string) {
  const info = await lstat(descriptorFile).catch(() => undefined);
  if (!info?.isFile() || info.size > 16384)
    throw new BridgeError('NOTE_DESCRIPTOR_INVALID', '请使用独立调用方原有的私有 MCP 描述文件。');
  let descriptor: z.infer<typeof descriptorSchema>;
  try { descriptor = descriptorSchema.parse(JSON.parse(await readFile(descriptorFile, 'utf8'))); }
  catch { throw new BridgeError('NOTE_DESCRIPTOR_INVALID', '请使用独立调用方原有的私有 MCP 描述文件。'); }
  const url = new URL(descriptor.url);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.pathname !== '/tools' ||
      url.username || url.password || url.search || url.hash)
    throw new BridgeError('NOTE_DESCRIPTOR_INVALID', '描述文件须指向本机 AgentBridge 协作端点。');

  let body;
  try {
    const response = await fetch(url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { authorization: 'Bearer ' + descriptor.token, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'task_result', args: { taskId, afterSeq: 0, limit: 20 }, callId: randomUUID() }),
    });
    if (response.status === 403) throw new BridgeError('NOTE_ACCESS_DENIED', '调用方凭据不可用，请核对原权限。', 403);
    if (!response.ok) throw Error();
    body = responseSchema.parse(await response.json());
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    throw new BridgeError('NOTE_RESULT_UNAVAILABLE', '无法读取原结果，未写入笔记。', 503);
  }
  if (body.error) throw new BridgeError(body.error.code, '原结果读取被拒绝，未写入笔记。', 409);
  const parsed = resultSchema.safeParse(body.result);
  if (!parsed.success || parsed.data.taskId !== taskId || parsed.data.invocation.taskId !== taskId || parsed.data.events.taskId !== taskId)
    throw new BridgeError('NOTE_RESULT_UNVERIFIED', '需要同一原任务的明确终态与可核对的结果来源。', 409);
  return parsed.data;
}

function literal(value: string, maxBytes: number): string {
  const { text, truncated } = clip(safeTerminal(value), maxBytes);
  const longest = Math.max(2, ...(text.match(/~+/g) || []).map(run => run.length));
  const fence = '~'.repeat(longest + 1);
  return fence + '\n' + text + '\n' + fence + (truncated ? '\n\n显示内容已截断。' : '');
}

function render(view: z.infer<typeof resultSchema>): string {
  const lines = ['# AgentBridge 任务结果', '', '- 原 Task：`' + view.taskId + '`',
    '- 原请求：`' + view.invocation.requestId + '`',
    '- 原任务状态：`' + view.status + '`', '- 业务验收：未评估'];
  if (view.error) lines.push('- 错误代码：`' + view.error.code + '`');
  if (view.result) {
    lines.push('', '## 结果', '', literal(view.result.message, 24576));
    if (view.result.truncated) lines.push('', '来源结果标记为已截断。');
  }
  lines.push('', '## 原事件');
  if (!view.events.supported) return [...lines, '', '原后台未提供可用事件。', ''].join('\n');
  const events = view.events;
  lines.push('', '从原序号 0 读取，本页游标 `' + events.cursor + '`，原任务已观察到 `' + events.highestObservedSeq + '`。',
    '- 后续事件：' + (events.hasMore ? '有' : '无'),
    '- 历史缺口：' + (events.cursorGap ? '有' : '无'),
    '- 来源截断：' + (events.detailsTruncated ? '有' : '无'));
  for (const row of events.items)
    lines.push('', '### ' + row.seq + ' · `' + row.event.kind + '`', ...(row.event.kind === 'output' && row.event.text ? ['', literal(row.event.text, 1024)] : []));
  return [...lines, ''].join('\n');
}

async function publishNote(output: string, content: string): Promise<'created' | 'unchanged'> {
  const staged = join(dirname(output), '.bridge-note-' + randomUUID() + '.tmp');
  const bytes = Buffer.from(content);
  const file = await open(staged, 'wx', 0o600).catch(() => {
    throw new BridgeError('NOTE_WRITE_FAILED', '无法在目标目录创建笔记临时文件。', 503);
  });
  try {
    try {
      await file.writeFile(bytes);
      await file.sync();
    } finally { await file.close(); }
    // Publish all bytes with a no-replace filesystem operation.
    await link(staged, output);
    return 'created';
  } catch (error) {
    if (errorCode(error) !== 'EEXIST') throw new BridgeError('NOTE_WRITE_FAILED', '无法在目标目录安全新建笔记。', 503);
    const info = await lstat(output).catch(() => undefined);
    if (info?.isFile() && info.size === bytes.length && (await readFile(output).catch(() => undefined))?.equals(bytes)) return 'unchanged';
    throw new BridgeError('NOTE_REVISION_CONFLICT', '目标已有其他版本或内容，请选择新的笔记路径。', 409);
  } finally { await unlink(staged).catch(() => undefined); }
}

export async function writeResultNote(taskId: string, descriptor: string, output: string) {
  if (!id.safeParse(taskId).success || !isAbsolute(descriptor) || !isAbsolute(output) || extname(output).toLowerCase() !== '.md')
    throw new BridgeError('INVALID_ARGUMENT', '需要原 Task ID、私有描述文件及 Markdown 笔记的绝对路径。');
  const view = await readResult(descriptor, taskId);
  const content = render(view);
  const state = await publishNote(output, content);
  return { state, sha256: createHash('sha256').update(content).digest('hex') };
}
