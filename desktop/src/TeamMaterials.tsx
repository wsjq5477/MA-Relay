import { useEffect, useRef, useState } from 'react';
import { call, time } from './api';
import type { PinnedTeamDocument, TeamMaterials as Materials } from './team-types';
import { documentMarkdown, downloadMarkdown, materialFilename, verifyPinnedDocument } from './team-material-transfer';

export default function TeamMaterials({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false), [index, setIndex] = useState<Materials | null>(null);
  const [busy, setBusy] = useState(false), [reading, setReading] = useState(false);
  const [notice, setNotice] = useState(''), [error, setError] = useState(''), [readAt, setReadAt] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(), [back, setBack] = useState<(string | undefined)[]>([]);
  const [chosen, setChosen] = useState<Materials['documents']['items'][number] | null>(null);
  const [revision, setRevision] = useState(''), [document, setDocument] = useState<PinnedTeamDocument | null>(null);
  const alive = useRef(true), generation = useRef(0), documentGeneration = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; documentGeneration.current++; }; }, []);
  async function load(next?: string, previous: (string | undefined)[] = []) {
    const seq = ++generation.current; documentGeneration.current++;
    setBusy(true); setError(''); setNotice(''); setIndex(null); setChosen(null); setDocument(null); setReading(false);
    try {
      const value = await call<Materials>('team.materials', { runId, ...(next ? { documentAfter: next } : {}) });
      if (value.run?.runId !== runId || value.schema !== 1 || value.readOnly !== true || typeof value.markdown !== 'string')
        throw new Error('后台未返回本工作的材料索引，请升级后台后重试。');
      if (!alive.current || seq !== generation.current) return;
      setIndex(value); setCursor(next); setBack(previous); setReadAt(new Date().toISOString());
    } catch (e) {
      if (alive.current && seq === generation.current) setError((e as Error).message + ' 原共享工作文档仍可阅读。');
    } finally { if (alive.current && seq === generation.current) setBusy(false); }
  }
  async function read(item: NonNullable<typeof chosen>, wanted: number) {
    const seq = ++documentGeneration.current;
    setChosen(item); setRevision(String(wanted)); setReading(true); setDocument(null); setError(''); setNotice('');
    try {
      if (!Number.isSafeInteger(wanted) || wanted < 1) throw new Error('请输入有效的正整数文档修订。');
      const result = await call<PinnedTeamDocument>('team.document', { runId, documentId: item.documentId, revision: wanted });
      await verifyPinnedDocument(result, runId, item.documentId, wanted);
      if (wanted === item.revision && result.contentSha256 !== item.contentSha256)
        throw new Error('正文与索引指定版本的摘要不一致，请刷新索引后重试。');
      if (alive.current && seq === documentGeneration.current) setDocument(result);
    } catch (e) { if (alive.current && seq === documentGeneration.current) setError((e as Error).message); }
    finally { if (alive.current && seq === documentGeneration.current) setReading(false); }
  }
  async function copy(content: string) {
    setNotice('');
    try { await navigator.clipboard.writeText(content); if (alive.current) setNotice('已复制 Markdown。'); }
    catch { if (alive.current) setNotice('复制失败，请从下方 Markdown 文本框手动复制。'); }
  }
  function download(content: string, filename: string) {
    try { downloadMarkdown(content, filename); setNotice('已发起 MD 下载，请在本机下载记录中确认文件。'); }
    catch { setNotice('下载未发起，请复制下方 Markdown 文本。'); }
  }
  return <section className="team-card team-materials" aria-label="公共材料阅读">
    <div className="team-row"><div><h2>公共材料</h2><p className="team-meta">按需读取工作索引和指定文档版本，复制或下载为 Markdown。</p></div>
      <button className="btn small" aria-expanded={open} onClick={() => { setOpen(!open); if (!open && !index && !busy) void load(); }}>{open ? '收起材料索引' : '打开材料索引'}</button></div>
    {open && <>
      <p className="team-meta">材料是读取时的快照。索引仅含当前页文档目录；文档正文单独读取。下载是本机副本，任务状态和成员权限仍以 Bridge 为准。</p>
      <div className="team-actions"><button className="btn small" disabled={busy} onClick={() => void load()}>刷新材料索引</button>
        {index && <><button className="btn small" disabled={busy} onClick={() => void copy(index.markdown)}>复制当前页索引</button><button className="btn small" disabled={busy} onClick={() => download(index.markdown, materialFilename(index.run.name, '索引'))}>下载当前页索引 MD</button></>}</div>
      {busy && <p role="status">正在读取材料索引…</p>}
      {error && <p className="notice-banner" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {index && <>
        <p className="team-meta">读取于 {time(readAt)} · 文档共 {index.documents.total} 份，本页 {index.documents.items.length} 份；刷新从首页重新读取。</p>
        <div className="team-material-documents">{index.documents.items.map(d => <article key={d.documentId}><h3>{d.title}</h3><span className="team-meta">索引指定第 {d.revision} 版</span><button className="btn small" disabled={busy || reading} onClick={() => void read(d, d.revision)} aria-label={'阅读文档：' + d.title}>阅读此版本</button></article>)}</div>
        {!index.documents.items.length && <p>本页没有共享文档。</p>}
        <nav className="team-actions" aria-label="材料文档分页"><button className="btn small" disabled={busy || !back.length} onClick={() => void load(back.at(-1), back.slice(0, -1))}>上一页文档</button><button className="btn small" disabled={busy || !index.documents.hasMore || !index.documents.next} onClick={() => void load(index.documents.next!, [...back, cursor])}>下一页文档</button></nav>
        {!!index.artifacts.length && <details><summary>当前产物引用（未检查可达性）</summary>{index.artifacts.map(a => <p key={a.workItemId + ':' + a.artifactId}>{a.version} · {a.reference}</p>)}</details>}
        <details><summary>当前页索引 Markdown</summary><label>索引 Markdown<textarea aria-label="索引 Markdown" readOnly rows={12} value={index.markdown}/></label></details>
      </>}
      {chosen && <article className="team-material-reader" aria-label="文档版本阅读">
        <h3>{chosen.title}</h3><form className="team-material-revision" onSubmit={e => { e.preventDefault(); void read(chosen, Number(revision)); }}><label>指定文档修订<input aria-label="指定文档修订" type="number" min={1} step={1} required value={revision} onChange={e => setRevision(e.target.value)}/></label><button className="btn small" disabled={reading || busy}>读取指定版本</button></form>
        {reading && <p role="status">正在核对指定文档版本…</p>}
        {document && <><p>正在阅读第 {document.revision} 版 · 读取时最新为第 {document.currentRevision} 版</p><pre>{document.content}</pre><div className="team-actions"><button className="btn small" onClick={() => void copy(documentMarkdown(document))}>复制此版本文档</button><button className="btn small" onClick={() => download(documentMarkdown(document), materialFilename(document.title, '第' + document.revision + '版'))}>下载此版本 MD</button></div><details><summary>此版本文档 Markdown</summary><label>文档 Markdown<textarea aria-label="文档 Markdown" readOnly rows={12} value={documentMarkdown(document)}/></label></details></>}
      </article>}
    </>}
  </section>;
}
