const { randomUUID } = require('node:crypto');
const fail = (code, message) => Object.assign(new Error(message), { code });
const stamp = () => new Date().toISOString();
const done = a => ['succeeded', 'failed', 'cancelled', 'rejected'].includes(a.state);
function hasBindingIssue(s, run) {
  const latest = new Map();
  for (const a of s.attempts.filter(x => x.runId === run.runId)) {
    if (a.workItemId && !s.workItems.some(x => x.workItemId === a.workItemId && x.runId === run.runId && x.round === a.workRound)) continue;
    latest.set(a.workItemId ? 'task:' + a.workItemId : 'member:' + a.agentId, a);
  }
  return [...latest.values()].some(a => !!a.continuationError);
}
function text(v, max = 4000) {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw fail('TEAM_INPUT', '请填写有效的任务内容，并检查长度。');
  return v;
}
function task(s, run, id) {
  const item = s.workItems.find(x => x.runId === run.runId && x.workItemId === id);
  if (!item) throw fail('TEAM_WORK_ITEM', '工作项不存在或不属于本次工作。');
  return item;
}
function revision(item, value) {
  if (item.revision !== value) throw fail('TEAM_REVISION', '工作项已更新，请读取最新修订后操作。');
}
function coordinator(run, actor) {
  if (!actor.user && actor.agentId !== run.leaderId) throw fail('TEAM_FORBIDDEN', '只有用户或本次主智能体可以分配和验收任务。');
}
function owner(run, actor, item) {
  if (!run.memberIds.includes(item.ownerId) || (!actor.user && actor.agentId !== item.ownerId)) throw fail('TEAM_FORBIDDEN', '只有本项仍获准的负责人可以接手或报告。');
}
function idle(s, item, actor = {}) {
  const unresolved = s.attempts.filter(a => a.agentId === item.ownerId && !done(a));
  if (unresolved.some(a => a.sessionId !== actor.sessionId || a.workItemId !== item.workItemId || a.state === 'unknown')) throw fail('TEAM_BUSY', '负责人有原执行运行或待核对，请查询原请求。');
}
function active(run) {
  if (run.state !== 'active') throw fail('TEAM_CLOSED', '工作已结束，不能修改任务。');
  if (run.paused) throw fail('TEAM_FORBIDDEN', '工作已暂停，不能接手、交接或分配新任务。');
}
function currentArtifact(item) { return item.reports.find(r => r.reportId === item.currentReportId)?.artifact; }
function satisfied(s, run, item) {
  return item.dependsOn.every(id => {
    const d = task(s, run, id);
    return item.kind === 'verification' && id === item.sourceTaskId ? ['review', 'completed'].includes(d.state) && !!currentArtifact(d) : d.state === 'completed';
  });
}
function syncTasks(s, run) {
  for (const item of s.workItems.filter(x => x.runId === run.runId && ['waiting', 'ready'].includes(x.state))) {
    const state = satisfied(s, run, item) ? 'ready' : 'waiting';
    if (item.state !== state) { item.state = state; item.revision++; }
  }
}
function taskView(s, run) {
  return { workItems: s.workItems.filter(x => x.runId === run.runId), handoffGrants: s.handoffGrants.filter(x => x.runId === run.runId), handoffs: s.handoffs.filter(x => x.runId === run.runId), budget: { maxTasks: 50, maxRounds: 5 }, acceptance: run.acceptedAt ? { acceptedAt: run.acceptedAt, acceptedBy: run.acceptedBy, summary: run.acceptanceSummary } : null };
}
function handoff(s, run, actor, p, space) {
  active(run);
  const from = task(s, run, p.workItemId), to = task(s, run, p.toTaskId);
  revision(from, p.expectedRevision); revision(to, p.targetRevision);
  if (!actor.user && actor.agentId !== run.leaderId) owner(run, actor, from);
  idle(s, from); idle(s, to);
  if (!run.memberIds.includes(to.ownerId)) throw fail('TEAM_FORBIDDEN', '交接目标负责人已撤权。');
  const review = from.kind === 'delivery' && to.kind === 'verification' && to.sourceTaskId === from.workItemId && from.state === 'review' && currentArtifact(from) && to.state === 'ready';
  const report = from.reports.find(r => r.reportId === from.currentReportId);
  const repair = from.kind === 'verification' && from.sourceTaskId === to.workItemId && from.state === 'blocked' && ['failed', 'blocked'].includes(report?.outcome) && to.kind === 'delivery';
  const action = review ? 'review' : repair ? 'repair' : null;
  if (!action) throw fail('TEAM_TASK_STATE', '当前状态不支持这项复验或返修交接。');
  if (s.handoffs.some(h => h.runId === run.runId && h.fromTaskId === from.workItemId && h.toTaskId === to.workItemId && h.fromRound === from.round)) throw fail('TEAM_TASK_STATE', '本轮已交接，请查询原操作。');
  let grant;
  if (!actor.user && actor.agentId !== run.leaderId) {
    grant = s.handoffGrants.find(g => g.runId === run.runId && g.fromTaskId === from.workItemId && g.toTaskId === to.workItemId && g.action === action && g.enabled && g.used < g.maxUses);
    if (!grant) throw fail('TEAM_FORBIDDEN', '没有本项交接授权，或授权次数已经用尽。');
  }
  if (repair) {
    const ids = new Set([to.workItemId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of s.workItems.filter(x => x.runId === run.runId)) {
        if (!ids.has(item.workItemId) && item.dependsOn.some(id => ids.has(id))) { ids.add(item.workItemId); changed = true; }
      }
    }
    const affected = s.workItems.filter(x => x.runId === run.runId && ids.has(x.workItemId));
    for (const item of affected) {
      idle(s, item, item === from ? actor : {});
      if (item.state === 'running' || item.round >= 5) throw fail('TEAM_TASK_STATE', '相关任务仍在执行或已达到五轮上限，请由用户处理。');
    }
    // Reopen the delivery and every validation of its old artifact together.
    for (const item of affected) {
      item.round++; item.state = 'waiting'; item.currentReportId = undefined; item.claimedBy = undefined; item.targetArtifactId = undefined; item.revision++;
    }
  } else from.revision++;
  syncTasks(s, run);
  if (grant) { grant.used++; grant.revision++; }
  const h = { handoffId: randomUUID(), runId: run.runId, fromTaskId: from.workItemId, toTaskId: to.workItemId, fromRound: repair ? from.round - 1 : from.round, toRound: to.round, action, senderId: actor.user ? 'user' : actor.agentId, grantId: grant?.grantId, createdAt: stamp() };
  s.handoffs.push(h);
  const notify = [...new Set([to.ownerId, run.leaderId])].filter(id => run.memberIds.includes(id));
  space.message(s, run, h.senderId, `${action === 'repair' ? '返修' : '复验'}交接：${from.title} → ${to.title}。交接已保存，原生执行仍须手动安排。`, notify, { workItemId: to.workItemId, handoffId: h.handoffId });
  return { handoff: h, from, to, executionStarted: false };
}
const taskMethods = ['team.createTask', 'team.claimTask', 'team.reportTask', 'team.handoffTask', 'team.acceptTask', 'team.acceptRun', 'team.configureHandoff', 'team.retryTask'];
function applyTask(s, run, actor, method, p, space) {
  const sender = actor.user ? 'user' : actor.agentId;
  const notify = item => [...new Set([run.leaderId, item.ownerId])].filter(id => run.memberIds.includes(id));
  if (method === 'team.createTask') {
    coordinator(run, actor); active(run);
    if (s.workItems.filter(x => x.runId === run.runId).length >= 50) throw fail('TEAM_TASK_STATE', '本次工作达到五十项上限，请由用户整理范围。');
    if (!run.memberIds.includes(p.ownerId) || !['delivery', 'verification'].includes(p.kind)) throw fail('TEAM_INPUT', '请选择当前成员和任务类型。');
    if(run.automation?.enabled&&p.ownerId===run.leaderId)throw fail('TEAM_INPUT','持续协作主角色负责协调，请把执行任务分配给其他成员。');
    const dependencies = p.dependsOn === undefined ? [] : Array.isArray(p.dependsOn) ? [...p.dependsOn] : p.dependsOn;
    if (!Array.isArray(dependencies) || dependencies.length > 30 || new Set(dependencies).size !== dependencies.length) throw fail('TEAM_INPUT', '任务依赖不合法。');
    for (const id of dependencies) task(s, run, id);
    if (p.kind === 'verification') {
      const source = task(s, run, p.sourceTaskId);
      if (source.kind !== 'delivery' || source.ownerId === p.ownerId) throw fail('TEAM_INPUT', '复验需由另一成员负责，且指定一个交付任务。');
      if (!dependencies.includes(source.workItemId)) dependencies.push(source.workItemId);
    } else if (p.sourceTaskId) throw fail('TEAM_INPUT', '交付任务不设置复验来源。');
    // Dependencies reference existing items only and cannot be rewritten: no cycle.
    const item = { workItemId: randomUUID(), runId: run.runId, title: text(p.title, 150), description: text(p.description, 8000), ownerId: p.ownerId, kind: p.kind, sourceTaskId: p.kind === 'verification' ? p.sourceTaskId : undefined, dependsOn: [...dependencies], state: 'waiting', revision: 1, round: 1, reports: [], createdAt: stamp(), createdBy: sender };
    s.workItems.push(item); syncTasks(s, run);
    space.message(s, run, sender, `已分配任务：${item.title}。`, notify(item), { workItemId: item.workItemId }); return item;
  }
  if (method === 'team.configureHandoff') {
    if (!actor.user) throw fail('TEAM_FORBIDDEN', '交接授权只能由用户设置。');
    active(run);
    const from = task(s, run, p.workItemId), to = task(s, run, p.toTaskId);
    const action = from.kind === 'delivery' && to.sourceTaskId === from.workItemId ? 'review' : from.sourceTaskId === to.workItemId ? 'repair' : null;
    if (!action || !run.memberIds.includes(from.ownerId) || !run.memberIds.includes(to.ownerId) || !Number.isSafeInteger(p.maxUses) || p.maxUses < 1 || p.maxUses > 20 || typeof p.enabled !== 'boolean') throw fail('TEAM_INPUT', '交接仅允许关联交付/复验任务，次数应为1至20。');
    let g = s.handoffGrants.find(g => g.runId === run.runId && g.fromTaskId === from.workItemId && g.toTaskId === to.workItemId);
    if ((g?.revision || 0) !== p.expectedRevision) throw fail('TEAM_REVISION', '交接授权已更新，请刷新。');
    if (p.maxUses < (g?.used || 0)) throw fail('TEAM_INPUT', '授权上限不能少于已用次数。');
    if (!g) { g = { grantId: randomUUID(), runId: run.runId, fromTaskId: from.workItemId, toTaskId: to.workItemId, action, used: 0, revision: 0 }; s.handoffGrants.push(g); }
    g.maxUses = p.maxUses; g.enabled = p.enabled; g.revision++;
    space.message(s, run, 'system', `用户${g.enabled ? '启用' : '撤销'}任务交接授权：${from.title} → ${to.title}，累计上限 ${g.maxUses} 次。`, notify(from)); return g;
  }
  if (method === 'team.acceptRun') {
    coordinator(run, actor); active(run);
    const items = s.workItems.filter(x => x.runId === run.runId);
    if (p.expectedRevision !== run.revision) throw fail('TEAM_REVISION', '工作状态已更新，请刷新。');
    if (hasBindingIssue(s, run)) throw fail('TEAM_TASK_STATE', '当前原生执行的会话身份异常，不能验收总工作。');
    const live=s.attempts.filter(a=>a.runId===run.runId&&!done(a));
    const leaderAttempt=!actor.user&&s.attempts.find(a=>a.sessionId===actor.sessionId&&a.agentId===run.leaderId&&!a.workItemId);
    if(items.length&&items.every(x=>x.state==='completed')&&leaderAttempt&&live.length===1&&live[0]===leaderAttempt&&['running','accepted'].includes(leaderAttempt.state)){
      run.acceptancePending={attemptId:leaderAttempt.attemptId,summary:text(p.summary,4000),runRevision:run.revision,eventCount:s.activationEvents.length,revisions:Object.fromEntries(items.map(x=>[x.workItemId,x.revision]))};
      return {state:'awaiting_leader_terminal',accepted:false};
    }
    if (!items.length || items.some(x => x.state !== 'completed') || s.attempts.some(a => a.runId === run.runId && !done(a))) throw fail('TEAM_TASK_STATE', '所有任务须逐项验收且原执行已核对，才能验收总工作。');
    run.acceptanceSummary = text(p.summary, 4000); run.acceptedAt = stamp(); run.acceptedBy = sender; run.state = 'completed'; run.revision++;
    space.message(s, run, sender, `总工作已验收：${run.acceptanceSummary}`, run.memberIds.includes(run.leaderId) ? [run.leaderId] : []);
    for (const session of s.sessions.filter(x => x.runId === run.runId)) session.revoked = true;
    return { state: run.state, revision: run.revision, acceptedAt: run.acceptedAt };
  }
  if (method === 'team.handoffTask') return handoff(s, run, actor, p, space);
  const item = task(s, run, p.workItemId); revision(item, p.expectedRevision);
  if (method === 'team.retryTask') {
    coordinator(run, actor); active(run); idle(s, item);
    if (item.state !== 'blocked' || item.round >= 5 || !run.memberIds.includes(item.ownerId)) throw fail('TEAM_TASK_STATE', '只有仍获准负责人受阻的任务可重试，最多五轮。');
    item.round++; item.state = 'waiting'; delete item.currentReportId; delete item.claimedBy; delete item.targetArtifactId; item.revision++;
    syncTasks(s, run);
    space.message(s, run, sender, `已安排重新接手：${item.title}（第${item.round}轮），旧报告保留。`, notify(item), {workItemId:item.workItemId});
    return item;
  }
  if (method === 'team.claimTask') {
    active(run); owner(run, actor, item); idle(s, item, actor); syncTasks(s, run);
    if (item.state !== 'ready' || !satisfied(s, run, item)) throw fail('TEAM_TASK_STATE', '任务未就绪或已被接手。');
    if (item.kind === 'verification') item.targetArtifactId = currentArtifact(task(s, run, item.sourceTaskId)).artifactId;
    item.state = 'running'; item.claimedBy = sender; item.revision++;
    space.message(s, run, sender, `已接手：${item.title}（第${item.round}轮）。`, notify(item), { workItemId: item.workItemId }); return item;
  }
  if (method === 'team.reportTask') {
    if (run.state !== 'active') throw fail('TEAM_CLOSED', '工作已结束，不能报告新结果。');
    owner(run, actor, item); idle(s, item, actor);
    if (item.state !== 'running') throw fail('TEAM_TASK_STATE', '请先接手本轮任务，完成后再提交报告。');
    if (!['submitted', 'passed', 'failed', 'blocked'].includes(p.outcome) || (item.kind === 'delivery' && p.outcome === 'passed') || (item.kind === 'verification' && p.outcome === 'submitted')) throw fail('TEAM_INPUT', '报告结果与任务类型不符。');
    if (p.handoffTaskId) revision(task(s, run, p.handoffTaskId), p.targetRevision);
    const report = { reportId: randomUUID(), round: item.round, outcome: p.outcome, summary: text(p.summary, 8000), reporterId: sender, evidenceSource: actor.user ? 'user_report' : 'member_report', createdAt: stamp() };
    if (item.kind === 'delivery' && p.outcome === 'submitted') {
      const version = text(p.version, 200), reference = text(p.reference, 2000);
      if (item.reports.some(r => r.artifact?.version === version)) throw fail('TEAM_ARTIFACT', '产物版本已使用；返修须登记新的明确版本。');
      report.artifact = { artifactId: randomUUID(), version, reference, producerId: item.ownerId, createdAt: stamp() };
    }
    if (item.kind === 'verification') {
      const artifact = currentArtifact(task(s, run, item.sourceTaskId));
      if (!artifact || p.artifactId !== item.targetArtifactId || artifact.artifactId !== item.targetArtifactId) throw fail('TEAM_ARTIFACT', '验收产物已变化或不属于本轮，请重新核对版本。');
      report.targetArtifactId = artifact.artifactId; report.targetVersion = artifact.version;
      if (p.outcome === 'passed' && (p.accessConfirmed !== true || !p.evidenceReference)) throw fail('TEAM_ARTIFACT', '复验通过须确认已实际取得指定产物，并填写证据引用。');
      report.accessConfirmed = p.accessConfirmed === true;
      if (p.evidenceReference) report.evidenceReference = text(p.evidenceReference, 2000);
    }
    item.reports.push(report); item.currentReportId = report.reportId; item.state = ['submitted', 'passed'].includes(p.outcome) ? 'review' : 'blocked'; item.revision++;
    space.message(s, run, sender, `任务报告：${item.title} · ${p.outcome}${report.targetVersion ? ` · 版本${report.targetVersion}` : report.artifact ? ` · 版本${report.artifact.version}` : ''}\n${report.summary}`, notify(item), { workItemId: item.workItemId, reportId: report.reportId });
    syncTasks(s, run);
    if (p.handoffTaskId) {
      // Reporting, grant consumption, task state and both recipients commit once.
      const target = task(s, run, p.handoffTaskId);
      return { report, ...handoff(s, run, actor, { workItemId: item.workItemId, expectedRevision: item.revision, toTaskId: p.handoffTaskId, targetRevision: target.revision }, space) };
    }
    return { report, workItem: item };
  }
  if (method === 'team.acceptTask') {
    coordinator(run, actor); active(run);
    if (item.state !== 'review') throw fail('TEAM_TASK_STATE', '任务须先提交交付或复验结果，才能验收。');
    const attempts = s.attempts.filter(a => a.workItemId === item.workItemId && a.workRound === item.round);
    if (attempts.some(a => !done(a)) || (attempts.length && (attempts.at(-1).state !== 'succeeded' || attempts.at(-1).continuationError))) throw fail('TEAM_BUSY', '本轮原生执行尚未成功结束或会话身份异常，不能仅按报告验收。');
    if (item.kind === 'delivery') {
      const checks = s.workItems.filter(x => x.runId === run.runId && x.sourceTaskId === item.workItemId);
      if (!checks.length || checks.some(x => x.state !== 'completed' || x.reports.find(r => r.reportId === x.currentReportId)?.targetArtifactId !== currentArtifact(item)?.artifactId)) throw fail('TEAM_ARTIFACT', '当前产物必须由另一成员复验并验收，旧版本结果不能替代。');
    } else {
      const report = item.reports.find(r => r.reportId === item.currentReportId);
      if (report?.outcome !== 'passed' || !report.accessConfirmed || report.targetArtifactId !== currentArtifact(task(s, run, item.sourceTaskId))?.artifactId) throw fail('TEAM_ARTIFACT', '复验结果不完整或已过期。');
    }
    item.acceptanceSummary = text(p.summary, 4000); item.state = 'completed'; item.acceptedBy = sender; item.acceptedAt = stamp(); item.revision++;
    syncTasks(s, run); space.message(s, run, sender, `任务已验收：${item.title}。${item.acceptanceSummary}`, notify(item), { workItemId: item.workItemId }); return item;
  }
  throw fail('TEAM_METHOD', '任务操作不受支持。');
}
module.exports = { taskMethods, applyTask, taskView, task, currentArtifact, syncTasks, idle, hasBindingIssue };
