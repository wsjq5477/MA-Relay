// Reconcile receipts only. Never send a prompt, reply, or cancellation.
const missingRequest = new Set(["NOT_FOUND", "REQUEST_NOT_FOUND"]);
async function recoverJournal(rows, call, settle, rejectsVerificationContinuation = () => false) {
  let resolved = 0;
  for (const row of rows) {
    if (!["pending", "unknown"].includes(row.state) || !row.machineId) continue;
    try {
      const request = ["submit", "continue", "verify"].includes(row.op);
      if (request) {
        let task;
        try { task = await call("ipc", { op: "request", requestId: row.id, machineId: row.machineId }); }
        catch (error) {
          // The original authenticated daemon receipt can report a durable
          // Hub rejection before task creation. This is positive evidence,
          // unlike an absent receipt or the tool's current health status.
          if (error.code === 'AGENT_UNHEALTHY') {
            if (await settle(row, 'rejected', {code:'AGENT_UNHEALTHY',message:'原请求在执行前被原生健康检查拒绝，未提交需求。',reconciliation:'original durable pre-execution rejection'})) resolved++;
            continue;
          }
          if (!missingRequest.has(error.code) || row.op !== "continue" || !row.params?.conversationId) continue;
          // Old versions allowed attempting to continue a verification. Both
          // WSL Hub forbids this before admitting a task. An absent request
          // alone is insufficient evidence; verify its original parent too.
          if (!rejectsVerificationContinuation(row)) continue;
          const parent = await call("ipc", { op: "conversation", conversationId: row.params.conversationId, machineId: row.machineId });
          if (parent.conversationId !== row.params.conversationId && parent.conversationId !== row.machineId + "::" + row.params.conversationId) continue;
          if (parent.turns !== 1 || parent.items?.length !== 1 || parent.items[0].verification !== true) continue;
          if (await settle(row, "rejected", { code: "CONVERSATION_BINDING", message: "原请求未被接收；连接验证记录无法续问，请新建实际会话。", reconciliation: "missing request and immutable verification parent confirmed" })) resolved++;
          continue;
        }
        if (task?.taskId && task.requestId === row.id && (!task.machineId || task.machineId === row.machineId))
          if (await settle(row, "confirmed", task)) resolved++;
      } else if (["reply", "cancel"].includes(row.op)) {
        const taskId = row.params?.taskId || row.params?.reply?.taskId;
        if (!taskId) continue;
        const receipt = await call("ipc", { op: "operation", taskId, operationId: row.id, machineId: row.machineId });
        if (receipt?.operationId === row.id && ["confirmed", "rejected"].includes(receipt.state))
          if (await settle(row, receipt.state, receipt)) resolved++;
      }
    } catch { /* Offline, missing, or ambiguous receipts remain protected. */ }
  }
  return { resolved };
}
module.exports = { recoverJournal };
