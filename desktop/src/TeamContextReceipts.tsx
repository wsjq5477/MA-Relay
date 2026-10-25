import { useEffect, useRef, useState } from 'react';
import { call, time } from './api';
import { verifyContextReceipts } from './team-context-receipts';
import type { ContextReceipt } from './team-context-receipts';

export default function TeamContextReceipts({ runId }: { runId: string }) {
  const [items, setItems] = useState<ContextReceipt[] | null>(null), [next, setNext] = useState<string | null>(null);
  const [more, setMore] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const generation = useRef(0), mounted = useRef(false), lock = useRef(false);
  useEffect(() => {
    mounted.current = true; generation.current++; lock.current = false;
    setItems(null); setNext(null); setMore(false); setBusy(false); setNotice('');
    return () => { mounted.current = false; generation.current++; };
  }, [runId]);
  async function read(append = false) {
    if (lock.current) return;
    lock.current = true; const original = ++generation.current, after = append ? next || undefined : undefined;
    setBusy(true); setNotice(''); if (!append) { setItems(null); setMore(false); setNext(null); }
    try {
      const result = verifyContextReceipts(await call('team.contextTransfers', { runId, ...(after ? { after } : {}) }), runId, after);
      if (!mounted.current || generation.current !== original) return;
      if (append && result.items.some(x => items?.some(old => old.transferId === x.transferId))) throw Error('传递审计分页重复，请刷新原列表。');
      setItems(append ? [...(items || []), ...result.items] : result.items); setNext(result.next); setMore(result.hasMore);
    } catch (e) { if (mounted.current && generation.current === original) { setNotice((e as Error).message); if (append) setMore(false); } }
    finally { if (mounted.current && generation.current === original) { lock.current = false; setBusy(false); } }
  }
  return <details className="team-card team-context-receipts"><summary>选材传递与接收审计</summary>
    <p className="team-meta">查看成员通过工作 MCP 保存的原包及接收收据。待确认仅表示尚无接收收据；接收确认不代表业务验收、模型理解或产物可达，也不会启动执行。</p>
    <button className="btn small" disabled={busy} onClick={() => void read()}>{items === null ? '读取传递审计' : '刷新传递审计'}</button>
    {busy && <p role="status">正在读取传递记录…</p>}{notice && <p role="status">{notice}</p>}
    {items?.length === 0 && <p>当前工作没有已保存的选材传递记录。</p>}
    {items?.map(x => <article className="team-document" key={x.transferId}><h3>{x.senderName} → {x.targetName}</h3>
      <p>{x.stage === 'acknowledged' ? '目标接入已确认原包' : '已保存原包，待接收确认'} · {time(x.createdAt)}</p>
      {x.acknowledgedAt && <p>接收确认：{time(x.acknowledgedAt)}</p>}
      {!x.recipientAuthorized && <p>目标成员当前没有这项工作的访问权；历史记录保留。</p>}
      <p className="team-meta">文档 {x.materials.documents} · 任务 {x.materials.tasks} · 消息 {x.materials.messages} · 产物引用 {x.materials.artifacts}</p>
      <details><summary>原传递引用</summary><p>传递 ID：<code>{x.transferId}</code></p><p>原包摘要：<code>{x.packetId}</code></p></details>
    </article>)}
    {more && <button className="btn small" disabled={busy} onClick={() => void read(true)}>读取后续传递记录</button>}
  </details>;
}
