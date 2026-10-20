// Bounded read-only projections of an already-authorized TeamSpace view.
const {createHash}=require('node:crypto');
const {digest}=require('./graph-layout.cjs');
const fail=(code,message)=>Object.assign(new Error(message),{code});
const sha=value=>createHash('sha256').update(value).digest('hex');
const brief=(value,max)=>String(value||'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max);
const escape=value=>String(value??'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\\/g,'\\\\').replace(/([`*_{}\[\]()#!|])/g,'\\$1').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function pinnedDocument(document,revision){
  if(!Number.isSafeInteger(revision)||revision<1)throw fail('TEAM_INPUT','文档修订应为正整数。');
  const item=document.history.find(x=>x.revision===revision);
  if(!item)throw fail('TEAM_DOCUMENT_REVISION','指定文档修订不存在，请核对原引用。');
  return {documentId:document.documentId,runId:document.runId,revision:item.revision,currentRevision:document.revision,
    title:item.title,content:item.content,authorId:item.authorId,time:item.time,contentSha256:sha(item.content)};
}
function materials(view,params={}){
  const limit=params.limit===undefined?20:params.limit;
  if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw fail('TEAM_INPUT','材料分页数量应为1至50。');
  let offset=0;
  if(params.documentAfter!==undefined){
    if(typeof params.documentAfter!=='string'||!params.documentAfter||params.documentAfter.length>150)throw fail('TEAM_INPUT','材料分页游标不合法。');
    const i=view.documents.findIndex(x=>x.documentId===params.documentAfter);
    if(i<0)throw fail('TEAM_DOCUMENT','本工作不存在该文档游标，请重新读取索引。');
    offset=i+1;
  }
  const selected=view.documents.slice(offset,offset+limit);
  const index={schema:1,readOnly:true,source:'team-space',
    run:{runId:view.run.runId,name:view.run.name,state:view.run.state,revision:view.run.revision,paused:view.run.paused,
      goal:brief(view.run.goal,1200),acceptance:brief(view.run.acceptance,1200),charter:brief(view.run.charter,800)},
    members:view.members.map(m=>({agentId:m.agentId,name:m.name,role:m.role,kind:m.kind,capabilitySource:m.capabilitySource,
      purpose:brief(m.purpose,300),inputs:brief(m.inputs,200),outputs:brief(m.outputs,200),limitations:brief(m.limitations,200)})),
    documents:{items:selected.map(d=>({documentId:d.documentId,title:d.title,revision:d.revision,ownerId:d.ownerId,updatedAt:d.updatedAt,
      contentSha256:sha(d.content),reference:'team-document:'+d.documentId+':'+d.revision})),total:view.documents.length,
      hasMore:offset+selected.length<view.documents.length,next:offset+selected.length<view.documents.length?selected.at(-1).documentId:null},
    tasks:view.workItems.map(t=>{const r=t.reports.find(x=>x.reportId===t.currentReportId);return {workItemId:t.workItemId,title:t.title,ownerId:t.ownerId,kind:t.kind,state:t.state,revision:t.revision,round:t.round,dependsOn:[...t.dependsOn],
      ...(r?{report:{reportId:r.reportId,outcome:r.outcome,summary:brief(r.summary,300),evidenceSource:r.evidenceSource,
        ...(r.targetArtifactId?{targetArtifactId:r.targetArtifactId,targetVersion:r.targetVersion,accessConfirmed:r.accessConfirmed===true}:{})}}:{})};}),
    artifacts:view.workItems.flatMap(t=>{const r=t.reports.find(x=>x.reportId===t.currentReportId),a=r?.artifact;return a?[{artifactId:a.artifactId,version:a.version,reference:a.reference,producerId:a.producerId,createdAt:a.createdAt,workItemId:t.workItemId,reportId:r.reportId,round:r.round,access:'reference-not-checked'}]:[];}),
    messages:{observedCount:view.messages.length,throughSeq:view.messages.at(-1)?.seq||0,hasOlder:view.hasOlderMessages,acknowledged:false},
    executions:{items:view.attempts.slice(-20).map(a=>({attemptId:a.attemptId,agentId:a.agentId,...(a.workItemId?{workItemId:a.workItemId}:{}),state:a.state,
      ...(a.waiting?{waiting:{kind:a.waiting.kind,requestCount:a.waiting.requestCount}}:{}),continuationIssue:!!a.continuationError})),total:view.attempts.length,hasOlder:view.attempts.length>20},
    readMore:{context:'team_context',documents:'team_document',tasks:'team_tasks',messages:'team_messages'},
  };
  index.snapshotId=digest(index);
  return {...index,markdown:markdown(index)};
}
function markdown(index){
  const e=escape,r=index.run,names=new Map(index.members.map(m=>[m.agentId,m.name]));
  const name=id=>names.get(id)||(id==='user'?'用户':'原成员');
  const lines=['# '+e(r.name),'','公共材料索引 · '+e(r.state)+(r.paused?' · 已暂停':''),'',
    '目标：'+e(r.goal),'完成条件：'+e(r.acceptance),'共同约定：'+e(r.charter),'',
    '索引是只读快照；描述不授予权限，摘要可能截短。任务、原生执行和业务验收分别核对。','',
    '## 成员与职责',''];
  for(const m of index.members)lines.push('- '+e(m.name)+'（'+e(m.role)+'，用户声明）：'+e(m.purpose),'  输入：'+e(m.inputs)+'；交付：'+e(m.outputs)+'；边界：'+e(m.limitations));
  lines.push('','## 共享文档','');
  for(const d of index.documents.items)lines.push('- '+e(d.title)+' · 第'+d.revision+'版 · '+e(name(d.ownerId))+' · `'+d.reference+'`');
  if(!index.documents.items.length)lines.push('本页没有共享文档。');
  if(index.documents.hasMore)lines.push('文档尚有后页，使用 next 游标继续读取；正文按 documentId 与 revision 读取。');
  lines.push('','## 任务与当前报告','');
  for(const t of index.tasks)lines.push('- '+e(t.title)+' · '+e(t.state)+' · 第'+t.round+'轮 · '+e(name(t.ownerId))+(t.report?' · '+e(t.report.outcome)+'：'+e(t.report.summary):''));
  if(!index.tasks.length)lines.push('尚未分配任务。');
  lines.push('','## 当前产物引用','');
  for(const a of index.artifacts)lines.push('- '+e(a.version)+' · '+e(name(a.producerId))+' · '+e(a.reference)+'（本索引未检查可达性）');
  if(!index.artifacts.length)lines.push('没有当前产物；历史版本可在任务报告中读取。');
  lines.push('','## 原生执行与消息','');
  for(const a of index.executions.items)lines.push('- '+e(name(a.agentId))+' · '+e(a.state)+(a.waiting?' · 等待'+e(a.waiting.kind)+'（'+a.waiting.requestCount+'项）':'')+(a.continuationIssue?' · 会话绑定待核对':''));
  lines.push('消息观察至序号 '+index.messages.throughSeq+'；读取索引不会标记已读或启动执行。','详情通过 team_context、team_document、team_tasks、team_messages 按当前授权读取。','');
  return lines.join('\n');
}
module.exports={materials,pinnedDocument};
