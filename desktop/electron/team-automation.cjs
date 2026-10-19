const {randomUUID}=require('node:crypto');
const {supportsTeamCollaboration}=require('./builtin-adapters.cjs');
const fail=(code,message)=>Object.assign(Error(message),{code});
const terminal=a=>['succeeded','failed','cancelled','rejected'].includes(a.state);
const now=()=>new Date().toISOString();
function capability(agent,options){
  if(agent.kind!=='native')return {start:false,resume:false,runningMessages:false,reason:'外部MCP成员需从自身入口读取任务，本批不自动启动。'};
  try{const node=options.validateNode(agent.nodeId);if(!supportsTeamCollaboration(node))return {start:false,resume:false,runningMessages:false,reason:'这个接入尚不支持小队协作，请从“机器与 Agent”使用直接会话。'};return node.adapter==='claude'?{start:true,resume:true,runningMessages:false,adapter:'claude',testedVersion:'2.1.299'}:{start:false,resume:false,runningMessages:false,reason:'该接入尚未通过小队自动续接验证，请手动执行。'};}
  catch{return {start:false,resume:false,runningMessages:false,reason:'原节点未连接或不可执行。'};}
}
function enqueue(s,run,agentId,key,kind,extra={}){
  if(!run.memberIds.includes(agentId)||s.activationEvents.some(e=>e.runId===run.runId&&e.key===key))return;
  s.activationEvents.push({eventId:randomUUID(),runId:run.runId,agentId,key,kind,state:'pending',createdAt:now(),...extra});
}
function sync(s){
  for(const run of s.runs.filter(r=>r.state==='active'&&r.automation)){
    for(const item of s.workItems.filter(x=>x.runId===run.runId)){
      if(item.state==='ready'&&item.ownerId!==run.leaderId)enqueue(s,run,item.ownerId,`ready:${item.workItemId}:${item.round}`,'task_ready',{workItemId:item.workItemId,workRound:item.round});
      for(const report of item.reports.filter(x=>x.createdAt>=run.automation.startedAt||x.reportId===item.currentReportId)){
        if(report.reporterId!==run.leaderId)enqueue(s,run,run.leaderId,'report:'+report.reportId,'task_report',{workItemId:item.workItemId,workRound:report.round,reportId:report.reportId});
      }
    }
    for(const e of s.activationEvents.filter(e=>e.runId===run.runId&&e.kind==='task_ready'&&e.state==='pending')){
      const item=s.workItems.find(x=>x.workItemId===e.workItemId);
      if(!item||item.round!==e.workRound)e.state='superseded';else if(item.state!=='ready')e.state='handled';
    }
    for(const a of s.attempts.filter(x=>x.runId===run.runId&&terminal(x)&&x.agentId!==run.leaderId&&x.createdAt>=run.automation.startedAt))enqueue(s,run,run.leaderId,'terminal:'+a.attemptId,'native_terminal',{sourceAttemptId:a.attemptId,workItemId:a.workItemId,workRound:a.workRound});
  }
}
function configure(s,run,p,options){
  if(run.revision!==p.expectedRevision)throw fail('TEAM_REVISION','工作设置已更新，请刷新。');
  if(run.state!=='active'||typeof p.enabled!=='boolean')throw fail('TEAM_INPUT','只能设置进行中的工作。');
  if(!p.enabled){if(run.automation)run.automation.enabled=false;run.revision++;return view(s,run,options);}
  for(const [key,min,max] of [['maxActivations',1,100],['maxMinutes',1,1440],['idleMinutes',1,120]])if(!Number.isSafeInteger(p[key])||p[key]<min||p[key]>max)throw fail('TEAM_INPUT','请填写有效的激活次数和时间上限。');
  if(!Array.isArray(p.agentIds)||new Set(p.agentIds).size!==p.agentIds.length||!p.agentIds.includes(run.leaderId))throw fail('TEAM_INPUT','请明确授权原生主智能体和可自动执行的成员。');
  for(const id of p.agentIds){const a=s.agents.find(x=>x.agentId===id&&!x.disabled);if(!a||!run.memberIds.includes(id)||!capability(a,options).resume)throw fail('TEAM_CAPABILITY','所选成员不支持本批已验证的自动续接。');}
  // Limits are cumulative for this work. Reconfiguring does not erase usage,
  // restart the clock, release unknowns, or discard pending events.
  const old=run.automation;
  run.automation={enabled:true,agentIds:[...p.agentIds],maxActivations:p.maxActivations,maxMinutes:p.maxMinutes,idleMinutes:p.idleMinutes,used:old?.used||0,startedAt:old?.startedAt||now(),generation:(old?.generation||0)+1};
  if(run.automation.maxActivations<run.automation.used)throw fail('TEAM_INPUT','激活上限不能少于已经使用的次数。');
  run.revision++;enqueue(s,run,run.leaderId,'start:'+run.automation.generation,'user_start');sync(s);return view(s,run,options);
}
function view(s,run,options){
  const p=run.automation;
  return {policy:p||null,capabilities:run.memberIds.map(id=>({agentId:id,...capability(s.agents.find(a=>a.agentId===id),options)})),events:s.activationEvents.filter(e=>e.runId===run.runId).slice(-100),pending:s.activationEvents.filter(e=>e.runId===run.runId&&e.state==='pending').length,limitReached:!!p&&(p.used>=p.maxActivations||Date.now()-Date.parse(p.startedAt)>=p.maxMinutes*60000),runningMessages:false};
}
function settleAcceptance(s,run,space){
  const pending=run.acceptancePending;if(!pending)return;
  const a=s.attempts.find(x=>x.attemptId===pending.attemptId);
  if(!a||!terminal(a))return;
  delete run.acceptancePending;
  const items=s.workItems.filter(x=>x.runId===run.runId);
  if(a.state!=='succeeded'||a.continuationError||require('./team-work.cjs').hasBindingIssue(s,run)||run.state!=='active'||run.paused||run.revision!==pending.runRevision||s.activationEvents.slice(pending.eventCount).some(e=>e.runId===run.runId&&e.agentId===run.leaderId&&e.state==='pending')||items.some(x=>x.state!=='completed'||pending.revisions[x.workItemId]!==x.revision)||s.attempts.some(x=>x.runId===run.runId&&!terminal(x))){space.message(s,run,'system','主智能体提出的总验收尚未生效，请核对原执行、权限和最新任务。');return;}
  run.state='completed';run.acceptedAt=now();run.acceptedBy=run.leaderId;run.acceptanceSummary=pending.summary;run.revision++;
  for(const session of s.sessions.filter(x=>x.runId===run.runId))session.revoked=true;
  space.message(s,run,'system','主智能体原生轮已成功结束，总工作验收已生效。');
}
class TeamAutomation{
  constructor(space){this.space=space;this.closed=false;}
  tick(){if(this.closed)return Promise.resolve();if(this.running)return this.running;this.running=this.step().finally(()=>{this.running=null;});return this.running;}
  async step(){
    const space=this.space;
    for(const r of space.read().runs.filter(r=>r.state==='stopping')){await space.refresh(r.runId);if(this.closed)return;}
    for(const r of space.read().runs.filter(r=>r.state==='active'&&r.automation)){
      await space.refresh(r.runId);if(this.closed)return;
      space.transaction(s=>{sync(s);const run=space.run(s,r.runId),p=run.automation;
        if(!p.enabled||run.state!=='active')return null;
        const progress=s.workItems.filter(x=>x.runId===r.runId).flatMap(x=>x.reports.map(y=>y.createdAt)).sort().at(-1)||p.startedAt;
        if(Date.now()-Date.parse(progress)>=p.idleMinutes*60000)enqueue(s,run,run.leaderId,'idle:'+progress,'no_progress');return null;});
      const s=space.read(),run=space.run(s,r.runId),p=run.automation;
      if(run.state!=='active'||run.paused||!p.enabled||p.used>=p.maxActivations||Date.now()-Date.parse(p.startedAt)>=p.maxMinutes*60000)continue;
      // Workers first; one activation per member, no model calls from polling.
      for(const id of [...p.agentIds.filter(x=>x!==run.leaderId),run.leaderId]){
        if(this.closed)return;
        const fresh=space.read(),current=space.run(fresh,run.runId);
        if(!current.memberIds.includes(id)||fresh.attempts.some(a=>a.agentId===id&&!terminal(a)))continue;
        let events=fresh.activationEvents.filter(e=>e.runId===run.runId&&e.agentId===id&&e.state==='pending');
        if(!events.length)continue;
        if(id===current.leaderId){
          // A report written during a native round is not its terminal receipt.
          if(events.some(e=>e.workItemId&&fresh.attempts.some(a=>a.workItemId===e.workItemId&&a.workRound===e.workRound&&!terminal(a))))continue;
        }else{
          events=events.filter(e=>fresh.workItems.some(x=>x.workItemId===e.workItemId&&x.round===e.workRound&&x.state==='ready'));
          if(!events.length)continue;
          const first=events[0];events=events.filter(e=>e.workItemId===first.workItemId&&e.workRound===first.workRound);
        }
        const previous=fresh.attempts.filter(a=>a.runId===run.runId&&a.agentId===id).at(-1);
        // A failed/unbound previous turn needs a human decision, never a new
        // conversation masquerading as continuation.
        if(previous&&(previous.state!=='succeeded'||!previous.nativeSessionId||previous.continuationError)){
          this.issue(run.runId,id,'原执行未成功结束或缺少原生会话绑定，请人工核对；不会另开会话。');continue;
        }
        const item=id===current.leaderId?null:fresh.workItems.find(x=>x.workItemId===events[0].workItemId);
        const message=id===current.leaderId?'你是本次工作的主智能体。重要事件已排队：'+events.map(e=>e.kind).join('、')+'。请读取 team_context、team_tasks 和新群消息，按已授权范围分配、交接、检查失败和当前版本证据；条件齐备时逐项验收，再调用 team_accept_run。若需等待外部成员或人工权限，请明确报告等待并结束本轮，不重复创建已存在任务。不要把任务分配给自己；普通发言不启动成员。':'新任务事件：'+item.title+'。请先读取 team_context 和 team_tasks，完成本轮绑定的任务，用 team_report_task 报告实际产物版本或复验证据。不要自行绕过权限或宣称总工作完成；报错后由主智能体协调。';
        try{await space.execute({operationId:'activation-'+events[0].eventId,runId:run.runId,agentId:id,message,...(item?{workItemId:item.workItemId,expectedRevision:item.revision}:{})},{eventIds:events.map(e=>e.eventId),previousAttemptId:previous?.attemptId});}
        catch(error){this.issue(run.runId,id,error.code==='TEAM_CAPABILITY'?'原生自动续接能力不可用，请人工核对。':'本次激活未完成，请查询原操作及当前任务；未重复派发。');}
      }
    }
  }
  issue(runId,agentId,message){if(this.space.run(this.space.read(),runId).automation?.issues?.[agentId]===message)return;this.space.transaction(s=>{const r=this.space.run(s,runId);r.automation.issues??={};r.automation.issues[agentId]=message;return null;});}
  close(){this.closed=true;}
}
module.exports={TeamAutomation,sync,configure,view,enqueue,settleAcceptance,terminal,capability};
