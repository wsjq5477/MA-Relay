const { randomUUID } = require('node:crypto');
const done = a => ['succeeded', 'failed', 'cancelled', 'rejected'].includes(a.state);
const fail = (code, message) => Object.assign(Error(message), {code});
const now = () => new Date().toISOString();

function request(s, run, p, space) {
  if (run.revision !== p.expectedRevision) throw fail('TEAM_REVISION', '工作设置已更新，请刷新后核对停止范围。');
  if (run.state !== 'active') throw fail('TEAM_CLOSED', '工作已结束或正在停止，请查询原停止操作。');
  run.state = 'stopping'; run.paused = true; run.revision++;
  if (run.automation) run.automation.enabled = false;
  delete run.acceptancePending;
  const attempts = s.attempts.filter(a => a.runId === run.runId && !done(a));
  run.stop = {requestedAt:now(), targetIds:attempts.map(a => a.attemptId), externalCount:run.memberIds.filter(id => s.agents.find(a => a.agentId === id)?.kind === 'mcp').length};
  for (const a of attempts) a.cancellation = {operationId:'team-cancel-'+randomUUID(), state:'awaiting_original', dispatched:false};
  for (const session of s.sessions.filter(x => x.runId === run.runId)) session.revoked = true;
  space.message(s, run, 'system', '用户已停止本项工作的新调度并撤销成员访问，正在核对并取消原生执行；外部MCP成员自身的运行需在原入口停止。');
  settle(s, run, space);
  return {stopRequested:true, runId:run.runId, state:run.state};
}

function view(s, run) {
  if (!run.stop) return null;
  return {requestedAt:run.stop.requestedAt, completedAt:run.stop.completedAt,
    total:run.stop.targetIds.length, unresolved:s.attempts.filter(a => run.stop.targetIds.includes(a.attemptId) && !done(a)).length,
    externalCount:run.stop.externalCount};
}

function settle(s, run, space) {
  if (run.state !== 'stopping' || !run.stop) return;
  // Receipt confirmation is deliberately absent from this predicate.
  if (s.attempts.some(a => a.runId === run.runId && !done(a))) return;
  run.state = 'closed'; run.stop.completedAt = now(); run.revision++;
  space.message(s, run, 'system', '本项工作已停止调度并归档，Bridge关联的原生执行均已核对终态；已有结果与失败记录保留，这不是业务验收。外部成员自身的运行状态仍由原入口负责。');
}

function change(space, attemptId, action) {
  return space.transaction(s => {
    const a = s.attempts.find(x => x.attemptId === attemptId);
    if (!a?.cancellation) return null;
    action(a.cancellation); return null;
  });
}

function observeReceipt(space, attemptId, result) {
  change(space, attemptId, c => {
    const taskId = result?.taskId || result?.data?.taskId;
    const matches = result?.operationId === c.operationId && (!taskId || taskId === c.taskId);
    c.state = matches && ['confirmed', 'rejected'].includes(result.state) ? result.state : 'unknown';
  });
}

async function reconcile(space, runId) {
  const run = space.run(space.read(), runId);
  if (run.state !== 'stopping') return;
  for (const attemptId of run.stop.targetIds) {
    let a = space.read().attempts.find(x => x.attemptId === attemptId);
    if (!a || done(a)) continue;
    // A fresh, matching original task is required before the first control.
    let original;
    try {
      original = await space.options.query(a);
      space.observe(a.attemptId, original);
    } catch {
      original = null;
      if (!['confirmed', 'rejected'].includes(a.cancellation.state)) change(space, attemptId, c => {c.state = c.dispatched ? 'unknown' : 'awaiting_original';});
    }
    a = space.read().attempts.find(x => x.attemptId === attemptId);
    if (done(a)) continue;
    const c = a.cancellation;
    if (['confirmed', 'rejected'].includes(c.state)) continue;
    if (c.dispatched) {
      try { observeReceipt(space, attemptId, await space.options.cancellation(a)); }
      catch { change(space, attemptId, c => {c.state = 'unknown';}); }
      continue;
    }
    if (!original?.taskId || original.status === 'unknown') continue;
    if (typeof space.options.cancel !== 'function') {change(space, attemptId, c => {c.state = 'unsupported';}); continue;}
    // Write the send marker before I/O. After an uncertain interruption only
    // query this operation; even NOT_FOUND is not proof that it was unsent.
    const claimed = space.transaction(s => {
      const current = s.attempts.find(x => x.attemptId === attemptId), stop = current.cancellation;
      if (done(current) || stop.dispatched) return false;
      stop.taskId = original.taskId; stop.dispatched = true; stop.state = 'pending';
      return true;
    });
    if (!claimed) continue;
    a = space.read().attempts.find(x => x.attemptId === attemptId);
    try { observeReceipt(space, attemptId, await space.options.cancel(a)); }
    catch { change(space, attemptId, c => {c.state = 'unknown';}); }
  }
  space.transaction(s => {settle(s, space.run(s, runId), space); return null;});
}

module.exports = { request, view, settle, reconcile };
