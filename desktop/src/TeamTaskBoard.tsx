import { useState } from 'react';
import type { FormEvent } from 'react';
import type { TeamContext } from './team-types';

type Act = (method: string, params: Record<string, unknown>, done?: () => void) => Promise<void>;
const states: Record<string, string> = { waiting: '等待依赖', ready: '待接手', running: '进行中', blocked: '受阻', review: '待验收', completed: '已验收' };
const outcomes: Record<string, string> = { submitted: '已交付', passed: '复验通过', failed: '失败', blocked: '受阻' };
export default function TeamTaskBoard({ context, act, disabled }: { context: TeamContext; act: Act; disabled: boolean }) {
  const [kind, setKind] = useState<'delivery' | 'verification'>('delivery');
  const [dependencies, setDependencies] = useState<string[]>([]), [fromId, setFromId] = useState(''), [toId, setToId] = useState('');
  if (!Array.isArray(context.workItems)) return <p>当前后台只支持公共空间；更新并重启后台后可使用任务板。</p>;
  const items = context.workItems, runId = context.run.runId, active = context.run.state === 'active' && !context.run.paused;
  const name = (id: string) => context.members.find(a => a.agentId === id)?.name || '已撤权成员';
  const title = (id: string) => items.find(x => x.workItemId === id)?.title || '历史任务';
  const grant = context.handoffGrants.find(g => g.fromTaskId === fromId && g.toTaskId === toId);
  const targets = items.filter(x => { const from = items.find(y => y.workItemId === fromId); return from && (x.sourceTaskId === fromId || from.sourceTaskId === x.workItemId); });
  const form = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); return Object.fromEntries(new FormData(e.currentTarget)); };
  return <section className="team-card team-task-board" aria-label="任务板">
    <div className="team-row"><h2>任务板与交接</h2><span className="team-meta">{items.filter(x => x.state === 'completed').length} / {items.length} 项已验收</span></div>
    <p className="team-meta">主智能体分配，负责人接手和报告；报错与交接通知主智能体。交接保存后，仅用户已授权且支持自动续接的原生成员会由事件激活；其他成员手动执行。每次工作最多 50 项，每项最多 5 轮。</p>
    {context.acceptance && <p role="status">总工作已验收：{context.acceptance.summary}</p>}
    <div className="team-task-grid">{items.map(item => {
      const current = item.reports.find(r => r.reportId === item.currentReportId);
      const target = item.kind === 'verification' ? items.find(x => x.workItemId === item.sourceTaskId) : items.find(x => x.sourceTaskId === item.workItemId);
      const canHandoff = target && (item.kind === 'delivery' ? item.state === 'review' && target.state === 'ready' : item.state === 'blocked');
      const native = context.members.find(a => a.agentId === item.ownerId)?.kind === 'native';
      return <article className="team-task" key={item.workItemId} aria-label={'任务：' + item.title}>
        <div className="team-row"><h3>{item.title}</h3><strong>{states[item.state] || item.state}</strong></div>
        <small>{name(item.ownerId)} · {item.kind === 'delivery' ? '交付' : '独立复验'} · 第 {item.round} 轮 · 修订 {item.revision}</small>
        <pre>{item.description}</pre>{item.dependsOn.length > 0 && <p>依赖：{item.dependsOn.map(title).join('、')}</p>}
        {current?.artifact && <p>当前版本：<strong>{current.artifact.version}</strong><br/>产物引用：{current.artifact.reference}</p>}
        {current && <p>{outcomes[current.outcome]}{current.targetVersion ? ' · 版本 ' + current.targetVersion : ''}：{current.summary}</p>}
        {current?.evidenceReference && <p>证据引用：{current.evidenceReference} · {current.accessConfirmed ? '成员确认已取得产物' : '未确认取得产物'}</p>}
        <div className="team-actions">
          <button className="btn small" disabled={disabled || !active || item.state !== 'review'} onClick={() => { const summary = prompt('核对当前版本、复验报告和原执行后，填写验收说明：'); if (summary?.trim()) void act('team.acceptTask', {runId,workItemId:item.workItemId,expectedRevision:item.revision,summary}); }}>验收此项</button>
          {item.state === 'blocked' && <button className="btn small" disabled={disabled || !active} onClick={() => void act('team.retryTask',{runId,workItemId:item.workItemId,expectedRevision:item.revision})}>安排重试本项</button>}
          {canHandoff && <button className="btn small" disabled={disabled || !active} onClick={() => void act('team.handoffTask', {runId,workItemId:item.workItemId,expectedRevision:item.revision,toTaskId:target.workItemId,targetRevision:target.revision})}>{item.kind === 'delivery' ? '交给复验' : '退回返修'}</button>}
        </div>
        {native && ['ready','running'].includes(item.state) && <details><summary>手动执行此任务</summary><form onSubmit={e => {const p=form(e);void act('team.execute',{...p,runId,agentId:item.ownerId,workItemId:item.workItemId,expectedRevision:item.revision});}}><label>任务执行要求<textarea aria-label={'执行要求：'+item.title} name="message" required rows={3} maxLength={16000} defaultValue={'请读取 team_context 和 team_tasks，完成分配给你的“'+item.title+'”，使用 team_report_task 提交实际结果和版本。'}/></label><button className="btn primary" disabled={disabled || !active}>启动此项原生执行</button></form></details>}
        <details><summary>完整报告历史（{item.reports.length}）</summary>{item.reports.map(r => <div key={r.reportId}><strong>第 {r.round} 轮 · {outcomes[r.outcome]} · {r.artifact?.version || r.targetVersion || '无产物版本'}</strong><pre>{r.summary}</pre>{r.artifact && <p>产物：{r.artifact.reference}</p>}{r.evidenceReference && <p>证据：{r.evidenceReference}</p>}</div>)}</details>
      </article>;
    })}</div>
    {!items.length && <p>先分配交付任务，再创建指定该交付的独立复验任务。</p>}
    <div className="team-columns">
      <details><summary>分配新任务</summary><form onSubmit={e => {const element=e.currentTarget,p=form(e);void act('team.createTask',{...p,runId,kind,dependsOn:dependencies},()=>{element.reset();setDependencies([]);});}}>
        <label>任务名称<input aria-label="任务名称" name="title" maxLength={150} required/></label><label>任务要求<textarea aria-label="任务要求" name="description" rows={3} maxLength={8000} required/></label>
        <label>任务类型<select aria-label="任务类型" value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="delivery">交付</option><option value="verification">独立复验</option></select></label>
        <label>任务负责人<select aria-label="任务负责人" name="ownerId" required defaultValue=""><option value="" disabled>请选择队员</option>{context.members.map(a=><option key={a.agentId} value={a.agentId}>{a.name}</option>)}</select></label>
        {kind==='verification' && <label>复验的交付<select aria-label="复验的交付" name="sourceTaskId" required defaultValue=""><option value="" disabled>请选择交付任务</option>{items.filter(x=>x.kind==='delivery').map(x=><option key={x.workItemId} value={x.workItemId}>{x.title}</option>)}</select></label>}
        <fieldset><legend>其他依赖（验收后解锁）</legend>{items.map(x=><label className="team-check" key={x.workItemId}><input type="checkbox" checked={dependencies.includes(x.workItemId)} onChange={()=>setDependencies(dependencies.includes(x.workItemId)?dependencies.filter(id=>id!==x.workItemId):[...dependencies,x.workItemId])}/>{x.title}</label>)}</fieldset>
        <button className="btn primary" disabled={disabled || !active}>分配任务</button>
      </form></details>
      <details><summary>用户授权队员直接交接</summary><form onSubmit={e=>{const p=form(e);void act('team.configureHandoff',{runId,workItemId:fromId,toTaskId:toId,maxUses:Number(p.maxUses),enabled:true,expectedRevision:grant?.revision || 0});}}>
        <p className="team-meta">只授权这两个任务之间的复验或返修，不允许扩大任务范围，也不代替原生工具权限。</p>
        <label>交出任务<select aria-label="交出任务" value={fromId} required onChange={e=>{setFromId(e.target.value);setToId('');}}><option value="" disabled>请选择任务</option>{items.map(x=><option key={x.workItemId} value={x.workItemId}>{x.title}</option>)}</select></label>
        <label>交给任务<select aria-label="交给任务" value={toId} required onChange={e=>setToId(e.target.value)}><option value="" disabled>请选择关联任务</option>{targets.map(x=><option key={x.workItemId} value={x.workItemId}>{x.title}</option>)}</select></label>
        <label>累计交接次数上限<input aria-label="累计交接次数上限" name="maxUses" type="number" min={Math.max(1,grant?.used || 0)} max={20} defaultValue={3} required/></label>
        {grant && <p>已用 {grant.used} / {grant.maxUses} 次 · {grant.enabled ? '授权有效' : '已撤销'}</p>}
        <button className="btn primary" disabled={disabled || !active || !toId}>保存交接授权</button>
        {grant?.enabled && <button type="button" className="text-btn" disabled={disabled || !active} onClick={()=>void act('team.configureHandoff',{runId,workItemId:fromId,toTaskId:toId,maxUses:grant.maxUses,enabled:false,expectedRevision:grant.revision})}>撤销这项交接授权</button>}
      </form></details>
    </div>
    {context.handoffGrants.length>0 && <p className="team-meta">交接授权：{context.handoffGrants.map(g=>`${title(g.fromTaskId)} → ${title(g.toTaskId)}（${g.used}/${g.maxUses}，${g.enabled?'启用':'撤销'}）`).join('；')}</p>}
    <button className="btn primary" disabled={disabled || !active || !items.length || items.some(x=>x.state!=='completed')} onClick={()=>{const summary=prompt('请核对完成标准，并填写总工作验收说明：');if(summary?.trim())void act('team.acceptRun',{runId,expectedRevision:context.run.revision,summary});}}>验收总工作</button>
  </section>;
}
