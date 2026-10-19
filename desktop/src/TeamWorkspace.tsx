import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {Info,Users,UserRound,FolderOpen,ArrowRight} from 'lucide-react';
import { call, time } from './api';
import AgentIcon from './AgentIcon';
import type { AgentNode } from './types';
import type { TeamSnapshot, TeamContext, TeamDocument, TeamConnection, TeamRun } from './team-types';
import './team.css';
import TeamTaskBoard from './TeamTaskBoard';
import TeamAutomationSettings from './TeamAutomationSettings';
import TeamStopStatus, {cancellationLabel} from './TeamStopStatus';
import NativeTeamNodeSelect, { nativeTeamNodes } from './TeamNativeNodeSelect';

type Pending = { method: string; params: Record<string, unknown> };
const initial: TeamSnapshot = { stage: 'I07C1', agents: [], teams: [], runs: [], automaticCoordination: false };
const status: Record<string, string> = { dispatching: '准备提交', queued: '等待执行', accepted: '已接收', running: '执行中', succeeded: '本轮已完成', failed: '本轮失败', cancelled: '本轮已取消', unknown: '原执行待核对', rejected: '未派发' };

export default function TeamWorkspace({ nodes, directory }: { nodes: AgentNode[]; directory: string }) {
  const [data, setData] = useState(initial), [context, setContext] = useState<TeamContext | null>(null);
  const [tab, setTab] = useState<'work' | 'agents' | 'teams'>('work');
  const [runId, setRunId] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null), [config, setConfig] = useState<TeamConnection | null>(null);
  const [kind, setKind] = useState<'native' | 'mcp'>('native'), [memberIds, setMemberIds] = useState<string[]>([]);
  const [doc, setDoc] = useState<TeamDocument | null>(null), [editingDoc, setEditingDoc] = useState(false);
  const [docTitle, setDocTitle] = useState(''), [docContent, setDocContent] = useState(''), [editorIds, setEditorIds] = useState<string[]>([]);
  const [message, setMessage] = useState(''), [notifyIds, setNotifyIds] = useState<string[]>([]), [replyTo, setReplyTo] = useState('');
  const [allMessages, setAllMessages] = useState<TeamContext['messages'] | null>(null);
  const selected = useRef(runId), alive = useRef(true), refreshing = useRef(false), lock = useRef(false);
  const key = 'agentbridge.team.pending.' + directory;
  const agents = data.agents.filter(a => !a.disabled);
  const manualNodes = nativeTeamNodes(nodes);
  const manualMembers = context?.members.filter(a => a.kind === 'native' && manualNodes.some(n => n.nodeId === a.nodeId)) || [];
  const name = (id: string) => id === 'user' ? '你' : id === 'system' ? 'Bridge' : data.agents.find(a => a.agentId === id)?.name || '已撤权成员';
  selected.current = runId;
  async function refresh() {
    if (refreshing.current) return; refreshing.current = true;
    try {
      const snapshot = await call<TeamSnapshot>('team.snapshot');
      if (!alive.current) return; setData(snapshot);
      const id = selected.current;
      if (id) {
        const view = await call<TeamContext>('team.refresh', { runId: id });
        if (alive.current && selected.current === id) setContext(view);
      }
    } catch (e) { if (alive.current) setNotice((e as Error).message); }
    finally { refreshing.current = false; }
  }
  useEffect(() => {
    alive.current = true;
    try { const stored = localStorage.getItem(key); if (stored) setPending(JSON.parse(stored)); } catch { setNotice('原操作记录无法读取，请保留数据并查询后台原操作。'); }
    void refresh(); const timer = setInterval(() => void refresh(), 2500);
    return () => { alive.current = false; clearInterval(timer); };
  }, [key]);
  useEffect(() => { setContext(null); setAllMessages(null); setEditingDoc(false); setReplyTo(''); setMessage(''); setNotifyIds([]); void refresh(); }, [runId]);
  function applyResult(result: unknown) {
    const r = result as Partial<TeamConnection & TeamRun>;
    if (r?.configuration) setConfig(r as TeamConnection);
    if (r?.runId && r?.goal) setRunId(r.runId);
  }
  async function act(method: string, params: Record<string, unknown>, done?: () => void) {
    if (lock.current || pending) return;
    lock.current = true; setBusy(true); setNotice('');
    const operation = { method, params: { ...params, operationId: crypto.randomUUID() } };
    try {
      localStorage.setItem(key, JSON.stringify(operation)); setPending(operation);
      const result = await call(method, operation.params);
      localStorage.removeItem(key); setPending(null); applyResult(result); done?.(); await refresh();
    } catch (e) {
      const error = e as Error & { code?: string };
      if (/^TEAM_(INPUT|DUPLICATE|AGENT|NODE|RUN|FORBIDDEN|REVISION|DOCUMENT|BUSY|CLOSED|MANUAL|METHOD|WORK_ITEM|TASK_STATE|ARTIFACT|CAPABILITY)$/.test(error.code || '')) { localStorage.removeItem(key); setPending(null); }
      setNotice(error.message);
    } finally { lock.current = false; setBusy(false); }
  }
  async function queryOriginal() {
    if (!pending || lock.current) return; lock.current = true; setBusy(true);
    try {
      const result = await call<{ state: string; data?: unknown }>('team.operation', { operationId: pending.params.operationId });
      if (result.state === 'confirmed') { localStorage.removeItem(key); setPending(null); applyResult(result.data); setNotice('原操作已核对，未重复提交。'); await refresh(); }
      else setNotice('后台尚无可核对收据，原操作保留。请勿重复创建。');
    } catch (e) { setNotice((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  function toggle(list: string[], id: string) { return list.includes(id) ? list.filter(x => x !== id) : [...list, id]; }
  function form(event: FormEvent<HTMLFormElement>) { event.preventDefault(); return Object.fromEntries(new FormData(event.currentTarget)); }
  function editDocument(value: TeamDocument | null) { setDoc(value); setDocTitle(value?.title || ''); setDocContent(value?.content || ''); setEditorIds(value?.editorIds || []); setEditingDoc(true); }
  const disabled = busy || !!pending;
  const active = context?.run.state === 'active';
  return <section className="team-workspace">
    <div className="page-heading"><div><div className="eyebrow">TEAMS</div><h1>小队协作</h1><p>连接已有智能体，共用约定、文档和群消息。</p></div></div>
    <details className="team-stage"><summary><Info size={15}/>协作如何运行</summary><p>普通群消息和 @ 只负责沟通，不会启动执行。原生智能体可以手动执行，或在你授权的预算内按重要事件继续；外部 MCP 智能体从自己的入口工作。</p></details>
    <nav className="team-tabs" aria-label="小队导航">{([['work', '工作空间'], ['agents', '智能体'], ['teams', '小队设置']] as const).map(([value, label]) => <button key={value} aria-label={label} aria-current={tab===value?'page':undefined} className={'btn ' + (tab === value ? 'primary' : '')} onClick={() => setTab(value)}>{value==='work'?<FolderOpen size={15}/>:value==='agents'?<UserRound size={15}/>:<Users size={15}/>} {label}<span>{value==='work'?data.runs.length:value==='agents'?agents.length:data.teams.length}</span></button>)}</nav>
    {notice && <div className="notice-banner" role="status">{notice}<button className="text-btn" onClick={() => setNotice('')}>关闭提示</button></div>}
    {pending && <div className="notice-banner" role="status">原小队操作尚待确认，其他写入暂停。<button className="btn small" disabled={busy} onClick={() => void queryOriginal()}>查询原小队操作</button></div>}
    {tab === 'agents' && <div className="team-columns">
      <form className="team-card" onSubmit={e => { const element=e.currentTarget;const p = form(e); void act('team.registerAgent', { ...p, kind }, () => element.reset()); }}>
        <h2>接入智能体</h2><label>接入方式<select aria-label="接入方式" value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="native">已接入的原生节点</option><option value="mcp">外部智能体（支持 MCP）</option></select></label>
        {kind === 'native' ? <NativeTeamNodeSelect nodes={nodes}/> : <label>外部实例标识<input aria-label="外部实例标识" name="externalKey" maxLength={150} required placeholder="该智能体已有的唯一名称或实例标识"/><small>功能与运行环境由你在外部配置；每个独立入口分别登记。</small></label>}
        <label>智能体名称<input aria-label="智能体名称" name="name" maxLength={100} required/></label><label>职责与适用任务<textarea aria-label="职责与适用任务" name="purpose" maxLength={2000} required rows={3}/></label>
        <label>需要的输入<textarea aria-label="需要的输入" name="inputs" maxLength={2000} rows={2}/></label><label>交付什么<textarea aria-label="交付什么" name="outputs" maxLength={2000} rows={2}/></label><label>不负责什么<textarea aria-label="不负责什么" name="limitations" maxLength={2000} rows={2}/></label>
        <button className="btn primary" disabled={disabled}>保存智能体</button>
      </form>
      <div className="team-stack">{agents.length === 0 && <p>先登记已有智能体，再把它们组成小队。</p>}{agents.map(a => <article className="team-card" key={a.agentId}><h2><AgentIcon adapter={nodes.find(n => n.nodeId === a.nodeId)?.adapter} size={22}/> {a.name}</h2><span className="team-meta">{a.kind === 'native' ? '原生节点' : '外部 MCP'} · 职责为用户提供</span><p>{a.purpose}</p><dl><dt>输入</dt><dd>{a.inputs || '未说明'}</dd><dt>交付</dt><dd>{a.outputs || '未说明'}</dd><dt>边界</dt><dd>{a.limitations || '未说明'}</dd></dl><button className="btn small" disabled={disabled} onClick={() => { if (confirm('停用此智能体将撤销其当前工作访问，不取消已有执行。')) void act('team.disableAgent', { agentId: a.agentId }); }}>停用接入</button></article>)}</div>
    </div>}
    {tab === 'teams' && <div className="team-columns">
      <form className="team-card" onSubmit={e => { const p = form(e); void act('team.createTeam', { ...p, memberIds }, () => { setMemberIds([]); setNotice('小队已建立，可以发起工作。'); }); }}>
        <h2>创建小队</h2><label>小队名称<input aria-label="小队名称" name="name" maxLength={100} required/></label>
        <fieldset><legend>队员</legend>{agents.map(a => <label className="team-check" key={a.agentId}><input type="checkbox" checked={memberIds.includes(a.agentId)} onChange={() => setMemberIds(toggle(memberIds, a.agentId))}/>{a.name} — {a.purpose}</label>)}</fieldset>
        <label>主智能体<select aria-label="主智能体" name="leaderId" required defaultValue=""><option value="" disabled>从队员中选择</option>{agents.filter(a => memberIds.includes(a.agentId)).map(a => <option key={a.agentId} value={a.agentId}>{a.name}</option>)}</select></label>
        <label>小队公共约定<textarea aria-label="小队公共约定" name="charter" maxLength={8000} rows={6} placeholder="职责边界、协作约定及需要人工决定的事项"/></label>
        <p className="team-meta">成员可在本次工作群内交流；只能编辑本人或你明确授权的文档，不能增删队员或更改权限。</p><button className="btn primary" disabled={disabled || memberIds.length === 0}>保存小队</button>
      </form>
      <div className="team-stack">{data.teams.map(t => <article className="team-card" key={t.teamId}><h2>{t.name}</h2><p>主智能体：{name(t.leaderId)}</p><p>队员：{t.memberIds.map(name).join('、')}</p><pre>{t.charter || '未填写公共约定'}</pre></article>)}</div>
    </div>}
    {tab === 'work' && <>
      {!agents.length&&<div className="team-onboarding"><div className="team-onboarding-icon"><Users size={23}/></div><div><h2>把已有的 Agent 组织成小队</h2><p>先登记智能体和职责，再建立小队，为每项工作准备共享空间。</p></div><button className="btn" onClick={()=>setTab('agents')}>接入第一个智能体<ArrowRight size={14}/></button></div>}
      <div className="team-run-picker"><label>当前工作<select aria-label="当前工作" value={runId} onChange={e => setRunId(e.target.value)}><option value="">选择工作，或在下方新建</option>{data.runs.map(r => <option key={r.runId} value={r.runId}>{r.name}{r.state === 'completed' ? ' · 已验收' : r.state === 'closed' ? ' · 已归档' : r.state === 'stopping' ? ' · 停止中' : r.paused ? ' · 已暂停' : ''}</option>)}</select></label><button className="btn" disabled={busy} onClick={() => void refresh()}>刷新工作</button></div>
      {!runId && <form className="team-card team-new-run" onSubmit={e => { const p = form(e); void act('team.createRun', p); }}><h2>发起小队工作</h2><label>选择小队<select aria-label="选择小队" name="teamId" required defaultValue=""><option value="" disabled>请选择小队</option>{data.teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}</select></label><label>工作名称<input aria-label="工作名称" name="name" maxLength={150} required/></label><label>工作目标<textarea aria-label="工作目标" name="goal" rows={4} maxLength={8000} required/></label><label>完成标准<textarea aria-label="完成标准" name="acceptance" rows={3} maxLength={8000} required/></label><button className="btn primary" disabled={disabled || !data.teams.length}>建立工作空间</button></form>}
      {runId && !context && <p role="status">正在读取工作空间…</p>}
      {context && <>
        <article className="team-card"><div className="team-row"><h2>{context.run.name}</h2><span>{active ? context.run.paused ? '暂停新执行' : '工作进行中' : context.run.state === 'stopping' ? '正在停止并核对原执行' : context.run.state === 'completed' ? '总工作已验收' : '已归档'}</span><div className="team-actions"><button className="btn small" disabled={disabled || !active} onClick={() => void act('team.pause', { runId, paused: !context.run.paused })}>{context.run.paused ? '恢复手动执行' : '暂停新执行'}</button><button className="btn small" disabled={disabled || !active || !context.stopSupported} onClick={() => { if (confirm('停止本项工作将阻止新调度、撤销成员访问，并取消Bridge关联的原生执行。外部MCP成员自身的运行需在原入口停止。已有记录保留，是否继续？')) void act('team.stopRun', { runId, expectedRevision: context.run.revision }); }}>停止本项工作</button><button className="btn small" disabled={disabled || !active} onClick={() => { if (confirm('归档将结束成员访问，已有消息与文档保留。请先核对所有原执行。')) void act('team.closeRun', { runId }); }}>结束并归档</button></div></div><p>{context.run.goal}</p><h3>完成标准</h3><pre>{context.run.acceptance}</pre><details><summary>小队公共约定</summary><pre>{context.run.charter || '未填写'}</pre></details></article>
        <div className="team-members">{context.members.map(a => <article className="team-card" key={a.agentId}><h3>{a.name} · {a.role === 'leader' ? '主智能体' : '队员'}</h3><p>{a.purpose}</p><small>{a.limitations || '未说明职责边界'}</small><div className="team-actions"><button className="btn small" disabled={disabled || !active} onClick={() => void act('team.connect', { runId, agentId: a.agentId })}>生成接入配置</button><button className="text-btn" disabled={disabled || !active} onClick={() => { if (confirm('撤销该成员后，原接入配置立即失效；已有执行不会自动取消。')) void act('team.revokeMember', { runId, agentId: a.agentId, expectedRevision: context.run.revision }); }}>撤销本次访问</button></div></article>)}</div>
        <TeamStopStatus context={context}/>
        <TeamAutomationSettings key={runId+':auto'} context={context} act={act} disabled={disabled}/>
        <TeamTaskBoard key={runId} context={context} act={act} disabled={disabled}/>
        <div className="team-columns">
          <section className="team-card"><h2>公共群消息</h2><div className="team-message-list">{context.hasOlderMessages && !allMessages && <button className="btn small" onClick={() => { void (async () => { let cursor = 0; const items: TeamContext['messages'] = []; for (;;) { const p = await call<{ items: TeamContext['messages']; cursor: number; hasMore: boolean }>('team.messages', { runId, after: cursor }); items.push(...p.items); cursor = p.cursor; if (!p.hasMore) break; } if (selected.current === runId) setAllMessages(items); })().catch(e => setNotice((e as Error).message)); }}>读取更早消息</button>}{(allMessages || context.messages).map(m => <article className="team-message" key={m.messageId}><div className="team-row"><strong>{name(m.senderId)}</strong><time>{time(m.createdAt)}</time>{m.replyTo && <small>回复群内消息</small>}</div><pre>{m.content}</pre>{context.deliveries.filter(d => d.messageId === m.messageId).map(d => <small key={d.agentId}>{name(d.agentId)}：{d.state === 'pending' ? '待接收' : d.state === 'delivered' ? '接入端已接收' : '已读'}　</small>)}<button className="text-btn" disabled={!active} onClick={() => { setReplyTo(m.messageId); setNotifyIds(context.members.some(a => a.agentId === m.senderId) ? [m.senderId] : []); }}>回复</button></article>)}</div>
            <form onSubmit={e => { e.preventDefault(); void act('team.postMessage', { runId, content: message, notifyIds, ...(replyTo ? { replyTo } : {}) }, () => { setMessage(''); setReplyTo(''); setAllMessages(null); }); }}>{replyTo && <p>正在回复选中消息 <button type="button" className="text-btn" onClick={() => setReplyTo('')}>取消回复</button></p>}<label>发到工作群<textarea aria-label="工作群消息" value={message} onChange={e => setMessage(e.target.value)} rows={3} maxLength={16000} required/></label><fieldset><legend>通知队员</legend>{context.members.map(a => <label className="team-check" key={a.agentId}><input type="checkbox" checked={notifyIds.includes(a.agentId)} onChange={() => setNotifyIds(toggle(notifyIds, a.agentId))}/>{a.name}</label>)}</fieldset><button className="btn primary" disabled={disabled || !active}>发送群消息</button></form>
          </section>
          <section className="team-card"><div className="team-row"><h2>共享工作文档</h2><button className="btn small" disabled={disabled || !active} onClick={() => editDocument(null)}>新建共享文档</button></div>{context.documents.map(d => <article className="team-document" key={d.documentId}><h3>{d.title} <small>第 {d.revision} 版</small></h3><pre>{d.content}</pre><small>维护者：{name(d.ownerId)} · 授权编辑：{d.editorIds.map(name).join('、') || '仅维护者及你'}</small><div className="team-actions"><button className="text-btn" disabled={disabled || !active} onClick={() => editDocument(d)}>编辑文档</button><details><summary>修订历史</summary>{d.history.map(v => <div key={v.revision}><strong>第 {v.revision} 版 · {name(v.authorId)}</strong><pre>{v.content}</pre></div>)}</details></div></article>)}{!context.documents.length && <p>保存方案、接口共识或执行报告，成员可读取获准的公共材料。</p>}</section>
        </div>
        <section className="team-card"><h2>手动执行与原结果</h2><p className="team-meta">已接入原生节点可以在这里执行一轮，成员会收到本次工作的小队工具。外部 MCP 智能体请配置接入后，从其自身入口开始工作。任务板中的“手动执行此任务”会绑定具体任务；这里的独立一轮可用于主智能体协调，不直接改变任务状态。</p><form className="team-execute" onSubmit={e => { const p = form(e); void act('team.execute', { ...p, runId }); }}><label>执行成员<select aria-label="执行成员" name="agentId" required defaultValue=""><option value="" disabled>选择原生成员</option>{manualMembers.map(a => <option key={a.agentId} value={a.agentId}>{a.name}</option>)}</select></label><label>本轮需求<textarea aria-label="本轮需求" name="message" required rows={3} maxLength={16000}/></label><button className="btn primary" disabled={disabled || !active || context.run.paused || manualMembers.length === 0}>执行这一轮</button></form>{context.attempts.map(a => <article className="team-attempt" key={a.attemptId}><h3>{name(a.agentId)} · {status[a.state] || '待核对'}</h3>{a.continuationError && <p className="notice-banner team-binding-warning" role="status">会话身份异常，当前记录不能作为可信验收依据。</p>}<pre>{a.message}</pre>{a.waiting && <p role="status">{a.state === 'unknown' ? '上次观察到' : '需要用户处理'}原生{a.waiting.kind === 'permission' ? '权限' : '输入'}等待（{a.waiting.requestCount} 项）。请到对应节点的原任务处理，当前未批准或重新执行。</p>}{a.stop && <p role="status">{cancellationLabel[a.stop.state] || '停止操作待核对'}</p>}{a.result && <pre>{a.result}</pre>}{a.error && <p role="status">{a.error.message}</p>}</article>)}</section>
      </>}
    </>}
    {editingDoc && context && <div className="modal-overlay"><section className="modal team-modal" role="dialog" aria-modal="true" aria-label="编辑共享文档"><div className="modal-head"><h2>{doc ? '编辑共享文档' : '新建共享文档'}</h2><button className="btn small" disabled={busy} onClick={() => setEditingDoc(false)}>关闭文档编辑</button></div><form className="team-card" onSubmit={e => { e.preventDefault(); void act('team.writeDocument', { runId, documentId: doc?.documentId, expectedRevision: doc?.revision || 0, title: docTitle, content: docContent, editorIds }, () => setEditingDoc(false)); }}><label>文档标题<input aria-label="文档标题" value={docTitle} onChange={e => setDocTitle(e.target.value)} required maxLength={150}/></label><label>文档内容<textarea aria-label="文档内容" value={docContent} onChange={e => setDocContent(e.target.value)} rows={12} maxLength={32000}/></label><fieldset><legend>允许编辑此文档的队员</legend>{context.members.map(a => <label key={a.agentId} className="team-check"><input type="checkbox" checked={editorIds.includes(a.agentId)} onChange={() => setEditorIds(toggle(editorIds, a.agentId))}/>{a.name}</label>)}</fieldset><button className="btn primary" disabled={disabled}>保存共享文档</button></form></section></div>}
    {config && <div className="modal-overlay"><section className="modal team-modal" role="dialog" aria-modal="true" aria-label="智能体接入配置"><div className="modal-head"><h2>智能体接入配置</h2><button className="btn small" onClick={() => setConfig(null)}>关闭接入配置</button></div><div className="team-card"><p>在这台电脑上，把此配置添加到该智能体现有的 MCP 设置。接入仅对本成员和本次工作有效，撤销访问后失效。</p><label>本机 MCP 配置<textarea aria-label="本机 MCP 配置" rows={9} readOnly value={JSON.stringify({ mcpServers: { agentbridge: config.configuration } }, null, 2)}/></label><button className="btn" onClick={() => void navigator.clipboard.writeText(JSON.stringify({ mcpServers: { agentbridge: config.configuration } }, null, 2)).then(() => setNotice('接入配置已复制。')).catch(() => setNotice('复制失败，请从配置框中手动复制。'))}>复制接入配置</button><label>协作指引<textarea aria-label="协作指引" readOnly rows={6} value={config.instructions}/></label><p className="team-meta">配置引用本机受保护连接文件，不包含模型账号或供应商配置。</p></div></section></div>}
  </section>;
}
