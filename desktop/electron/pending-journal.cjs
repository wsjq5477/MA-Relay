// Reconcile receipts only. Never send a prompt, reply, or cancellation.
const missingRequest = new Set(["NOT_FOUND", "REQUEST_NOT_FOUND"]);
function diagnostic(row, code) {
  // Do not return arbitrary remote error messages, prompts or credentials.
  code = typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : 'QUERY_UNAVAILABLE';
  const reason = missingRequest.has(code) ? '原机器尚无可核对回执，不能据此判断任务未执行。'
    : code === 'SOURCE_MISSING' ? '缺少原机器来源，无法安全查询。'
    : code === 'RECEIPT_MISMATCH' ? '返回信息与原请求不一致，保留待确认状态。'
    : code === 'RECEIPT_PENDING' ? '原操作尚未返回确定结果，继续保留待确认状态。'
    : code === 'JOURNAL_CHANGED' ? '原记录已被另一项查询更新，请刷新后核对。'
    : code === 'NOT_CONFIGURED' ? '原后台的执行配置未就绪，暂时无法核对原请求。请恢复原后台配置后查询；未确认记录不会自动重发，独立节点仍可使用。'
    : '原机器或后台查询未完成，请恢复连接后查询原请求。';
  return { id: row.id, machineId: row.machineId, op: row.op, code, reason };
}
async function recoverJournal(rows, call, settle, rejectsVerificationContinuation = () => false, undispatchedRejection = () => null) {
  let resolved = 0;
  const items = [];
  async function resolve(row, state, result) {
    if (await settle(row, state, result)) resolved++;
    else items.push(diagnostic(row, 'JOURNAL_CHANGED'));
  }
  for (const row of rows) {
    if (!["pending", "unknown"].includes(row.state)) continue;
    if (!row.machineId) { items.push(diagnostic(row, 'SOURCE_MISSING')); continue; }
    try {
      const request = ["submit", "continue", "verify"].includes(row.op);
      if (request) {
        const rejected = await undispatchedRejection(row);
        if (rejected?.state === 'rejected' && rejected.requestId === row.id && rejected.machineId === row.machineId) {
          await resolve(row, 'rejected', rejected);
          continue;
        }
        let task;
        try { task = await call("ipc", { op: "request", requestId: row.id, machineId: row.machineId }); }
        catch (error) {
          // Only an original durable pre-execution rejection is positive proof.
          if (error.code === 'AGENT_UNHEALTHY') {
            await resolve(row, 'rejected', {code:'AGENT_UNHEALTHY',message:'原请求在执行前被原生健康检查拒绝，未提交需求。',reconciliation:'original durable pre-execution rejection'});
            continue;
          }
          if (!missingRequest.has(error.code) || row.op !== "continue" || !row.params?.conversationId || !rejectsVerificationContinuation(row)) {
            items.push(diagnostic(row, error.code)); continue;
          }
          const parent = await call("ipc", { op: "conversation", conversationId: row.params.conversationId, machineId: row.machineId });
          if ((parent.conversationId !== row.params.conversationId && parent.conversationId !== row.machineId + "::" + row.params.conversationId)
            || parent.turns !== 1 || parent.items?.length !== 1 || parent.items[0].verification !== true) {
            items.push(diagnostic(row, 'RECEIPT_MISMATCH')); continue;
          }
          await resolve(row, "rejected", { code: "CONVERSATION_BINDING", message: "原请求未被接收；连接验证记录无法续问，请新建实际会话。", reconciliation: "missing request and immutable verification parent confirmed" });
          continue;
        }
        if (task?.taskId && task.requestId === row.id && (!task.machineId || task.machineId === row.machineId))
          await resolve(row, "confirmed", task);
        else items.push(diagnostic(row, 'RECEIPT_MISMATCH'));
      } else if (["reply", "cancel"].includes(row.op)) {
        const taskId = row.params?.taskId || row.params?.reply?.taskId;
        if (!taskId) { items.push(diagnostic(row, 'RECEIPT_MISMATCH')); continue; }
        const receipt = await call("ipc", { op: "operation", taskId, operationId: row.id, machineId: row.machineId });
        if (receipt?.operationId === row.id && ["confirmed", "rejected"].includes(receipt.state))
          await resolve(row, receipt.state, receipt);
        else items.push(diagnostic(row, receipt?.operationId === row.id ? 'RECEIPT_PENDING' : 'RECEIPT_MISMATCH'));
      } else items.push(diagnostic(row, 'QUERY_UNAVAILABLE'));
    } catch (error) { items.push(diagnostic(row, error.code)); }
  }
  return { resolved, remaining: items.length, items };
}
module.exports = { recoverJournal };
