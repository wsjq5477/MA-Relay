import { useEffect, useRef, useState } from 'react';
import { call, time } from './api';
import type { TeamContext, TeamMessage } from './team-types';
import { downloadMarkdown, materialFilename } from './team-material-transfer';
import { emptySelections, packetScope, staleTaskSelection, verifyContextPacket } from './team-context-transfer';
import type { ContextPacket, ContextSelections } from './team-context-transfer';

export default function TeamContextPacket({runId, context}: {runId: string; context: TeamContext}) {
  const [open, setOpen] = useState(false), [target, setTarget] = useState('');
  const [selected, setSelected] = useState(emptySelections), [revisions, setRevisions] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{packet: ContextPacket; scope: string; readAt: string} | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [older, setOlder] = useState<TeamMessage[]>([]), [cursor, setCursor] = useState(0), [more, setMore] = useState(true), [reading, setReading] = useState(false);
  const alive = useRef(true), generation = useRef(0);
  const scope = packetScope(context, selected), currentScope = useRef(scope); currentScope.current = scope;
  const ready = result?.scope === scope && context.run.runId === runId ? result : null;
  const pool = [...new Map([...older, ...context.messages].map(m => [m.messageId, m])).values()].sort((a,b) => a.seq - b.seq);
  const artifacts = context.workItems.flatMap(t => t.reports.flatMap(r => r.artifact ? [{...r.artifact, title: t.title, round: r.round}] : []));
  const total = Object.values(selected).reduce((n, items) => n + items.length, 0);
  const validTarget = context.members.some(m => m.agentId === target), stale = staleTaskSelection(context, selected);
  useEffect(() => {alive.current = true; return () => {alive.current = false; generation.current++;};}, []);
  useEffect(() => {generation.current++; setResult(null); setBusy(false); setError(''); setNotice('');}, [scope]);
  function invalidate() {generation.current++; setResult(null); setBusy(false); setError(''); setNotice('');}
  function change(next: ContextSelections) {invalidate(); setSelected(next);}
  async function generate() {
    const seq = ++generation.current, originalScope = scope;
    setResult(null); setBusy(true); setError(''); setNotice('');
    try {
      const value = await call<unknown>('team.contextPacket', {runId, targetAgentId: target, selections: selected});
      const packet = await verifyContextPacket(value, context, target, selected, pool);
      if (alive.current && generation.current === seq && currentScope.current === originalScope)
        setResult({packet, scope: originalScope, readAt: new Date().toISOString()});
    } catch (e) {if (alive.current && generation.current === seq && currentScope.current === originalScope) setError((e as Error).message);}
    finally {if (alive.current && generation.current === seq) setBusy(false);}
  }
  async function history() {
    const originalScope = scope; setReading(true); setError('');
    try {
      const page = await call<{items: TeamMessage[]; cursor: number; hasMore: boolean}>('team.messages', {runId, after: cursor});
      if (!Array.isArray(page.items) || !Number.isSafeInteger(page.cursor) || page.cursor < cursor || (page.hasMore && page.cursor <= cursor) ||
          page.items.some(m => m.runId !== runId || typeof m.messageId !== 'string' || !Number.isSafeInteger(m.seq) || m.seq <= cursor || typeof m.content !== 'string'))
        throw new Error('历史消息未返回本工作的有效分页，请刷新工作后重试。');
      if (alive.current && currentScope.current === originalScope) {setOlder(v => [...v, ...page.items]); setCursor(page.cursor); setMore(page.hasMore);}
    } catch (e) {if (alive.current && currentScope.current === originalScope) setError((e as Error).message);}
    finally {if (alive.current) setReading(false);}
  }
  async function copy() {
    if (!ready) return;
    const seq = generation.current; setNotice('');
    try {await navigator.clipboard.writeText(ready.packet.markdown); if (alive.current && seq === generation.current) setNotice('已复制选定材料包，尚未发送给目标。');}
    catch {if (alive.current && seq === generation.current) setNotice('复制失败，请手动复制下方已核对的材料包文本。');}
  }
  function download(format: 'md' | 'json') {
    if (!ready) return;
    const p = ready.packet, content = format === 'md' ? p.markdown : JSON.stringify(p, null, 2) + '\n';
    const filename = materialFilename(p.source.name + '-' + p.target.name, '上下文包').replace(/\.md$/, '.' + format);
    try {
      if (format === 'md') downloadMarkdown(content, filename);
      else {
        const url = URL.createObjectURL(new Blob([content], {type:'application/json;charset=utf-8'})), a = document.createElement('a');
        a.href = url; a.download = filename; document.body.appendChild(a);
        try {a.click();} finally {a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);}
      }
      setNotice('已发起材料包下载，请在本机下载记录确认文件；尚未发送给目标。');
    } catch {setNotice('下载未发起，请手动复制下方材料包文本。');}
  }
  if (context.run.runId !== runId) return null;
  return <section className="team-card team-context-packet" aria-label="选定上下文包">
    <div className="team-row"><div><h2>选定上下文包</h2><p className="team-meta">为本工作成员整理明确版本的材料，预览后复制或下载。</p></div>
      <button className="btn small" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '收起上下文选材' : '打开上下文选材'}</button></div>
    {open && <>
      <p className="team-meta">只生成本机副本，不发送、执行、授予访问或确认已读。产物仅保留引用，未检查可达性。每类最多选 8 项；材料过大时请拆分。</p>
      <label>目标成员<select aria-label="上下文目标成员" value={target} onChange={e => {invalidate(); setTarget(e.target.value);}}><option value="">请明确选择本工作成员</option>{context.members.map(m => <option key={m.agentId} value={m.agentId}>{m.name} · {m.role === 'leader' ? '主智能体' : '队员'}</option>)}</select></label>
      {target && !validTarget && <p role="alert">原目标已不在当前有效成员中，请重新选择。</p>}
      <div className="team-context-choices">
        <details open><summary>文档版本（已选 {selected.documents.length}/8）</summary>{context.documents.map(d => {
          const chosen = selected.documents.find(x => x.documentId === d.documentId), revision = chosen?.revision ?? revisions[d.documentId] ?? d.revision;
          return <article key={d.documentId}><label className="team-check"><input aria-label={'选择文档：' + d.title} type="checkbox" checked={!!chosen} disabled={!chosen && selected.documents.length >= 8} onChange={() => change({...selected, documents: chosen ? selected.documents.filter(x => x.documentId !== d.documentId) : [...selected.documents, {documentId: d.documentId, revision}]})}/>{d.title}</label>
            <label>材料修订<select aria-label={'材料修订：' + d.title} value={revision} onChange={e => {const value = Number(e.target.value); invalidate(); setRevisions({...revisions, [d.documentId]: value}); if (chosen) setSelected({...selected, documents: selected.documents.map(x => x.documentId === d.documentId ? {...x, revision: value} : x)});}}>{d.history.map(h => <option key={h.revision} value={h.revision}>第 {h.revision} 版 · {h.title}</option>)}</select></label></article>;
        })}{!context.documents.length && <p>本工作没有共享文档。</p>}</details>
        <details><summary>任务当前轮次（已选 {selected.tasks.length}/8）</summary>{context.workItems.map(t => {
          const chosen = selected.tasks.some(x => x.workItemId === t.workItemId);
          return <label className="team-check" key={t.workItemId}><input aria-label={'选择任务：' + t.title} type="checkbox" checked={chosen} disabled={!chosen && selected.tasks.length >= 8} onChange={() => change({...selected, tasks: chosen ? selected.tasks.filter(x => x.workItemId !== t.workItemId) : [...selected.tasks, {workItemId: t.workItemId, revision: t.revision, round: t.round}]})}/>{t.title} · 第 {t.round} 轮 · 修订 {t.revision}</label>;
        })}{stale && <p role="alert">所选任务修订或轮次已变化，请取消该任务后重新选择。</p>}{!context.workItems.length && <p>尚未分配任务。</p>}</details>
        <details><summary>消息（已选 {selected.messages.length}/8）</summary><div className="team-context-message-list">{pool.map(m => {
          const chosen = selected.messages.some(x => x.messageId === m.messageId);
          return <label className="team-check" key={m.messageId}><input aria-label={'选择消息：序号 ' + m.seq} type="checkbox" checked={chosen} disabled={!chosen && selected.messages.length >= 8} onChange={() => change({...selected, messages: chosen ? selected.messages.filter(x => x.messageId !== m.messageId) : [...selected.messages, {messageId: m.messageId, seq: m.seq}]})}/><span>序号 {m.seq} · {time(m.createdAt)}<br/>{m.content.slice(0, 280)}{m.content.length > 280 ? '…（生成时包含完整原文）' : ''}</span></label>;
        })}</div>{more && (context.hasOlderMessages || cursor > 0) && <button className="btn small" disabled={reading} onClick={() => void history()}>{reading ? '正在读取历史消息…' : cursor ? '读取下一页历史消息' : '读取较早消息供选择'}</button>}{!pool.length && <p>尚无消息。</p>}</details>
        <details><summary>产物版本引用（已选 {selected.artifacts.length}/8）</summary>{artifacts.map(a => {
          const chosen = selected.artifacts.some(x => x.artifactId === a.artifactId);
          return <label className="team-check" key={a.artifactId}><input aria-label={'选择产物：' + a.title + ' · ' + a.version} type="checkbox" checked={chosen} disabled={!chosen && selected.artifacts.length >= 8} onChange={() => change({...selected, artifacts: chosen ? selected.artifacts.filter(x => x.artifactId !== a.artifactId) : [...selected.artifacts, {artifactId: a.artifactId, version: a.version}]})}/><span>{a.title} · {a.version} · 第 {a.round} 轮<br/>{a.reference}（未检查可达性）</span></label>;
        })}{!artifacts.length && <p>没有已登记的产物版本。</p>}</details>
      </div>
      <div className="team-actions"><span>已明确选择 {total} 项材料</span><button className="btn primary" disabled={busy || !validTarget || !total || stale} onClick={() => void generate()}>{busy ? '正在核对材料包…' : '生成只读材料包'}</button><button className="btn small" onClick={() => {change(emptySelections()); setRevisions({});}}>清空材料选择</button></div>
      {error && <p className="notice-banner" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      {ready && <article className="team-context-preview" aria-label="已核对上下文包"><h3>材料包预览 · {ready.packet.target.name}</h3><p className="team-meta">读取于 {time(ready.readAt)} · 仅为本机副本，未通过此入口发送给目标。</p>
        <div className="team-actions"><button className="btn small" onClick={() => void copy()}>复制材料包 Markdown</button><button className="btn small" onClick={() => download('md')}>下载材料包 MD</button><button className="btn small" onClick={() => download('json')}>下载材料包 JSON</button></div>
        <label>已核对材料包 Markdown<textarea aria-label="已核对材料包 Markdown" readOnly rows={16} value={ready.packet.markdown}/></label>
        <details><summary>已核对材料包 JSON</summary><textarea aria-label="已核对材料包 JSON" readOnly rows={12} value={JSON.stringify(ready.packet, null, 2)}/></details>
      </article>}
    </>}
  </section>;
}
