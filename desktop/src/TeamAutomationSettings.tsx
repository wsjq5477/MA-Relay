import {useState} from 'react';
import type {TeamContext} from './team-types';
type Act=(method:string,params:Record<string,unknown>,done?:()=>void)=>Promise<void>;
const reasons:Record<string,string>={user_start:'用户启用',task_ready:'任务就绪',task_report:'任务报告',native_terminal:'原执行结束',attention:'明确请求协调',no_progress:'无进展检查'};
export default function TeamAutomationSettings({context,act,disabled,policyOnly=false}:{context:TeamContext;act:Act;disabled:boolean;policyOnly?:boolean}){
 const data=context.automation,policy=data?.policy;
 const [selected,setSelected]=useState<string[]|null>(null);
 if(!data)return <p className="team-meta">当前后台尚不支持持续协作设置，请升级并重启后台。</p>;
 const permitted=(selected||policy?.agentIds||[context.run.leaderId]).filter(id=>context.run.memberIds.includes(id)),active=context.run.state==='active';
 const name=(id:string)=>context.members.find(a=>a.agentId===id)?.name||'已撤权成员';
 return <section className="team-card team-automation" aria-label="持续协作">
  <div className="team-row"><h2>持续协作</h2><strong>{context.run.state==='stopping'?'停止中，不再激活':!active?'工作已结束':context.run.paused?'已暂停新激活':policy?.enabled?data.limitReached?'预算已到限':'事件驱动已启用':'手动执行'}</strong></div>
  <p className="team-meta">本批支持Claude结束当前轮后续接原会话；运行中的消息排队。普通群消息不启动模型，重要报告和明确协调请求才产生事件。外部MCP成员需从自身入口接手任务。</p>
  {context.run.acceptancePending&&<p role="status">主智能体已提出总验收，正在等待本轮原生执行成功结束；当前尚未验收。</p>}
  {policy&&<p>已用 {policy.used} / {policy.maxActivations} 次激活尝试 · 总时长上限 {policy.maxMinutes} 分钟 · 无进展检查 {policy.idleMinutes} 分钟 · 待处理事件 {data.pending}</p>}
  {policy?.issues&&Object.entries(policy.issues).map(([id,message])=><p role="status" key={id}>{name(id)}：{message}</p>)}
  <details><summary>设置自动成员和预算</summary><form onSubmit={e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));void act('team.configureAutomation',{runId:context.run.runId,expectedRevision:context.run.revision,enabled:true,agentIds:permitted,maxActivations:Number(values.maxActivations),maxMinutes:Number(values.maxMinutes),idleMinutes:Number(values.idleMinutes)});}}>
   <fieldset><legend>允许自动激活的成员（须包含主智能体）</legend>{data.capabilities.map(c=><label className="team-check" key={c.agentId}><input type="checkbox" disabled={!c.resume||disabled||!active} checked={permitted.includes(c.agentId)} onChange={()=>setSelected(permitted.includes(c.agentId)?permitted.filter(id=>id!==c.agentId):[...permitted,c.agentId])}/>{name(c.agentId)} · {c.resume?'支持原会话续接，已测Claude '+c.testedVersion:c.reason}</label>)}</fieldset>
   <div className="team-columns"><label>激活尝试次数上限<input aria-label="激活尝试次数上限" type="number" name="maxActivations" min={Math.max(1,policy?.used||0)} max={100} defaultValue={policy?.maxActivations||20} required/></label><label>总时长上限（分钟）<input aria-label="总时长上限（分钟）" type="number" name="maxMinutes" min={1} max={1440} defaultValue={policy?.maxMinutes||60} required/></label></div>
   <label>无进展检查间隔（分钟）<input aria-label="无进展检查间隔（分钟）" type="number" name="idleMinutes" min={1} max={120} defaultValue={policy?.idleMinutes||10} required/></label>
   <p className="team-meta">预算累计计算，修改或重新启用不会清零次数和开始时间。停止自动调度不会取消已经运行的原生任务。</p>
   <button className="btn primary" disabled={disabled||!active||!data.capabilities.find(c=>c.agentId===context.run.leaderId)?.resume}>保存并启用持续协作</button>
   {policy?.enabled&&<button type="button" className="btn" disabled={disabled||!active} onClick={()=>void act('team.configureAutomation',{runId:context.run.runId,expectedRevision:context.run.revision,enabled:false})}>停止自动调度</button>}
  </form></details>
  {!policyOnly&&policy?.enabled&&<details><summary>明确请求主智能体协调</summary><form onSubmit={e=>{e.preventDefault();const element=e.currentTarget,values=Object.fromEntries(new FormData(element));void act('team.wake',{runId:context.run.runId,reason:values.reason},()=>element.reset());}}><label>需要协调的事项<textarea aria-label="需要协调的事项" name="reason" maxLength={2000} required rows={2}/></label><button className="btn" disabled={disabled||!active}>保存协调请求</button></form></details>}
  <details><summary>最近激活事件</summary>{data.events.length?data.events.slice(-20).map(e=><p key={e.eventId}>{name(e.agentId)} · {reasons[e.kind]||e.kind} · {e.state==='pending'?'待处理':e.state==='consumed'?'已绑定原执行':e.state==='handled'?'任务已接手':'已过期'}</p>):<p>暂无激活事件。</p>}</details>
 </section>;
}
