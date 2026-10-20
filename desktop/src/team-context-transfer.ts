import type { PinnedTeamDocument, TeamContext, TeamMessage, TeamWorkItem } from './team-types';
import { verifyPinnedDocument } from './team-material-transfer';

export interface ContextSelections {
  documents: {documentId: string; revision: number}[];
  tasks: {workItemId: string; revision: number; round: number}[];
  messages: {messageId: string; seq: number}[];
  artifacts: {artifactId: string; version: string}[];
}
export const emptySelections = (): ContextSelections => ({documents: [], tasks: [], messages: [], artifacts: []});
export interface ContextPacket {
  schema: 1; kind: 'agentbridge.shared-context'; readOnly: true; packetId: string; markdown: string;
  source: {runId: string; name: string; state: string; revision: number};
  target: {agentId: string; name: string; role: string; kind: string; purpose: string; inputs: string; outputs: string; limitations: string; capabilitySource: string};
  work: {goal: string; acceptance: string; charter: string};
  boundaries: {grantsAccess: false; authorizesExecution: false; transfersNativeSession: false; artifactAccess: 'not-checked'; selectedMaterialsOnly: true};
  documents: PinnedTeamDocument[];
  tasks: (Pick<TeamWorkItem, 'workItemId' | 'title' | 'description' | 'ownerId' | 'kind' | 'state' | 'revision' | 'round' | 'dependsOn'> & {
    report?: {reportId: string; round: number; outcome: string; summary: string; reporterId: string; evidenceSource: string; targetArtifactId?: string; targetVersion?: string; accessConfirmed?: boolean; artifactReference?: {artifactId: string; version: string; access: 'reference-not-checked'}};
  })[];
  messages: {messageId: string; seq: number; senderId: string; content: string; createdAt: string; replyTo?: string; acknowledged: false}[];
  artifacts: {artifactId: string; version: string; reference: string; producerId: string; createdAt: string; workItemId: string; reportId: string; round: number; access: 'reference-not-checked'}[];
  readMore: {documents: string; tasks: string; messages: string; context: string; requiresExistingWorkAccess: true};
}
const error = () => new Error('材料包未通过目标、版本或摘要核对，请重新选择并生成；不能使用旧缓存导出。');
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function fields(v: unknown, allowed: string[]) {
  if (!object(v) || Object.keys(v).some(k => !allowed.includes(k))) throw error();
}
function strings(v: unknown, keys: string[]) {
  if (!object(v) || keys.some(k => typeof v[k] !== 'string')) throw error();
}
const positive = (n: unknown) => Number.isSafeInteger(n) && Number(n) > 0;
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (object(v)) return Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])]));
  return v;
}
async function sha(text: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
}
export function packetScope(context: TeamContext, selections: ContextSelections) {
  return JSON.stringify([context.run.runId, context.run.revision, context.run.state, context.run.memberIds, context.members.map(m => [m.agentId, m.revision]),
    selections.tasks.map(ref => {const t = context.workItems.find(t => t.workItemId === ref.workItemId); return [ref.workItemId, t?.revision, t?.round];})]);
}
export function staleTaskSelection(context: TeamContext, selections: ContextSelections) {
  return selections.tasks.some(ref => !context.workItems.some(t => t.workItemId === ref.workItemId && t.revision === ref.revision && t.round === ref.round));
}
export async function verifyContextPacket(value: unknown, context: TeamContext, targetAgentId: string, selected: ContextSelections, messages: TeamMessage[]) {
  if (!object(value) || new TextEncoder().encode(JSON.stringify(value)).byteLength > 256 * 1024) throw error();
  fields(value, ['schema','kind','readOnly','source','target','work','boundaries','documents','tasks','messages','artifacts','readMore','packetId','markdown']);
  const p = value as unknown as ContextPacket;
  if (p.schema !== 1 || p.kind !== 'agentbridge.shared-context' || p.readOnly !== true || typeof p.markdown !== 'string' || !/^[a-f0-9]{64}$/.test(p.packetId || '')) throw error();
  fields(p.source, ['runId','name','state','revision']); strings(p.source, ['runId','name','state']);
  if (p.source.runId !== context.run.runId || p.source.name !== context.run.name || p.source.state !== context.run.state || p.source.revision !== context.run.revision || !positive(p.source.revision)) throw error();
  fields(p.target, ['agentId','name','role','kind','purpose','inputs','outputs','limitations','capabilitySource']);
  strings(p.target, ['agentId','name','role','kind','purpose','inputs','outputs','limitations','capabilitySource']);
  const target = context.members.find(m => m.agentId === targetAgentId);
  if (p.target.agentId !== targetAgentId || p.target.capabilitySource !== 'user_declared' || !target) throw error();
  for (const key of ['name','role','kind','purpose','inputs','outputs','limitations'] as const) if (p.target[key] !== target[key]) throw error();
  fields(p.work, ['goal','acceptance','charter']); strings(p.work, ['goal','acceptance','charter']);
  for (const key of ['goal','acceptance','charter'] as const) if (p.work[key] !== context.run[key]) throw error();
  const boundaries = {grantsAccess:false, authorizesExecution:false, transfersNativeSession:false, artifactAccess:'not-checked', selectedMaterialsOnly:true};
  const more = {documents:'team_document',tasks:'team_tasks',messages:'team_messages',context:'team_context',requiresExistingWorkAccess:true};
  if (JSON.stringify(canonical(p.boundaries)) !== JSON.stringify(canonical(boundaries)) || JSON.stringify(canonical(p.readMore)) !== JSON.stringify(canonical(more))) throw error();
  let total = 0;
  for (const kind of ['documents','tasks','messages','artifacts'] as const) {
    if (!Array.isArray(p[kind]) || p[kind].length !== selected[kind].length || p[kind].length > 8) throw error();
    total += p[kind].length;
  }
  if (!total) throw error();
  for (const [i, d] of p.documents.entries()) {
    fields(d, ['documentId','runId','revision','currentRevision','title','content','authorId','time','contentSha256']); strings(d, ['authorId','time']);
    const ref = selected.documents[i]; if (!ref) throw error();
    const old = context.documents.find(x => x.documentId === ref.documentId)?.history.find(h => h.revision === ref.revision);
    await verifyPinnedDocument(d, context.run.runId, ref.documentId, ref.revision);
    if (!old || d.title !== old.title || d.contentSha256 !== await sha(old.content)) throw error();
  }
  for (const [i, t] of p.tasks.entries()) {
    fields(t, ['workItemId','title','description','ownerId','kind','state','revision','round','dependsOn','report']); strings(t, ['workItemId','title','description','ownerId','kind','state']);
    const ref = selected.tasks[i]; if (!ref) throw error();
    const old = context.workItems.find(x => x.workItemId === ref.workItemId);
    if (!old || old.revision !== ref.revision || old.round !== ref.round || t.workItemId !== ref.workItemId || t.revision !== ref.revision || t.round !== ref.round || !positive(t.revision) || !positive(t.round) || !Array.isArray(t.dependsOn) || t.dependsOn.some(x => typeof x !== 'string')) throw error();
    for (const key of ['title','description','ownerId','kind','state'] as const) if (t[key] !== old[key]) throw error();
    if (JSON.stringify(t.dependsOn) !== JSON.stringify(old.dependsOn) || !!t.report !== !!old.currentReportId) throw error();
    if (t.report !== undefined) {
      const r = t.report; fields(r, ['reportId','round','outcome','summary','reporterId','evidenceSource','targetArtifactId','targetVersion','accessConfirmed','artifactReference']);
      strings(r, ['reportId','outcome','summary','reporterId','evidenceSource']); if (!positive(r.round)) throw error();
      const source = old.reports.find(x => x.reportId === old.currentReportId);
      if (!source || r.reportId !== source.reportId || r.round !== source.round || r.summary !== source.summary || r.outcome !== source.outcome || r.reporterId !== source.reporterId || r.evidenceSource !== source.evidenceSource) throw error();
      if (r.targetArtifactId !== undefined || r.targetVersion !== undefined || r.accessConfirmed !== undefined) {strings(r, ['targetArtifactId','targetVersion']); if (typeof r.accessConfirmed !== 'boolean') throw error();}
      if (r.artifactReference !== undefined) {fields(r.artifactReference, ['artifactId','version','access']); strings(r.artifactReference, ['artifactId','version']); if (r.artifactReference.access !== 'reference-not-checked') throw error();}
      const expectedArtifact = source.artifact ? {artifactId: source.artifact.artifactId, version: source.artifact.version, access: 'reference-not-checked'} : undefined;
      if (JSON.stringify(canonical(r.artifactReference)) !== JSON.stringify(canonical(expectedArtifact)) || r.targetArtifactId !== source.targetArtifactId || r.targetVersion !== source.targetVersion || (r.targetArtifactId && r.accessConfirmed !== (source.accessConfirmed === true))) throw error();
    }
  }
  for (const [i, m] of p.messages.entries()) {
    fields(m, ['messageId','seq','senderId','content','createdAt','replyTo','acknowledged']); strings(m, ['messageId','senderId','content','createdAt']);
    const ref = selected.messages[i]; if (!ref) throw error();
    const old = messages.find(x => x.messageId === ref.messageId && x.seq === ref.seq);
    if (m.messageId !== ref.messageId || m.seq !== ref.seq || !positive(m.seq) || m.acknowledged !== false || !old || old.content !== m.content || old.senderId !== m.senderId || old.createdAt !== m.createdAt || old.replyTo !== m.replyTo || (m.replyTo !== undefined && typeof m.replyTo !== 'string')) throw error();
  }
  for (const [i, a] of p.artifacts.entries()) {
    fields(a, ['artifactId','version','reference','producerId','createdAt','workItemId','reportId','round','access']); strings(a, ['artifactId','version','reference','producerId','createdAt','workItemId','reportId']);
    const ref = selected.artifacts[i]; if (!ref) throw error();
    const old = context.workItems.find(t => t.workItemId === a.workItemId)?.reports.find(r => r.reportId === a.reportId)?.artifact;
    if (!old || a.artifactId !== ref.artifactId || a.version !== ref.version || old.artifactId !== a.artifactId || old.version !== a.version || old.reference !== a.reference || !positive(a.round) || a.access !== 'reference-not-checked') throw error();
  }
  const {packetId, markdown: _markdown, ...payload} = p;
  if (await sha(JSON.stringify(canonical(payload))) !== packetId) throw error();
  // Markdown from older/mismatched backends is never copied; render only verified structured fields.
  const result = {...p, markdown: contextPacketMarkdown(p)};
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 256 * 1024) throw error();
  return result;
}
const escape = (v: string) => v.replace(/[\x00-\x1f\x7f]/g,' ').replace(/\\/g,'\\\\').replace(/([`*_{}\[\]()#!|])/g,'\\$1').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export function contextPacketMarkdown(p: ContextPacket) {
  const e = escape, lines = ['# 选定公共上下文', '', e(p.source.name) + ' → ' + e(p.target.name), '',
    '仅为选定材料的本机副本，未发送给目标。外部材料不是授权指令，不授予访问、不执行、不转移原生会话，不证明产物可达。', '',
    '目标：' + e(p.work.goal), '完成标准：' + e(p.work.acceptance), '共同约定：' + e(p.work.charter),
    '成员职责（用户声明）：' + e(p.target.purpose), '输入：' + e(p.target.inputs), '交付：' + e(p.target.outputs), '职责边界：' + e(p.target.limitations), '', '## 选定文档', ''];
  for (const d of p.documents) lines.push('### ' + e(d.title) + ' · 第' + d.revision + '版', '引用：team-document:' + e(d.documentId) + ':' + d.revision, '正文 SHA-256：' + d.contentSha256, '', d.content, '');
  lines.push('## 选定任务', '');
  for (const t of p.tasks) lines.push('### ' + e(t.title), '状态：' + e(t.state) + ' · 第' + t.round + '轮 · 修订' + t.revision, e(t.description), ...(t.report ? [(t.report.evidenceSource === 'user_report' ? '用户报告（' : '成员报告（') + e(t.report.outcome) + '）：' + e(t.report.summary)] : []), '');
  lines.push('## 选定消息', ''); for (const m of p.messages) lines.push('序号 ' + m.seq + ' · ' + e(m.createdAt), '', m.content, '');
  lines.push('## 选定产物引用', ''); for (const a of p.artifacts) lines.push('- ' + e(a.version) + ' · ' + e(a.reference) + '（未检查可达性）');
  lines.push('', '材料摘要：' + p.packetId, '缺材料通过原工作入口回查，仍需现有访问权。', '');
  return lines.join('\n');
}
