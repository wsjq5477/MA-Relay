import type { DesktopAPI, Status, Task, Agent, Conversation, Event } from "./types";
export function bridge(): DesktopAPI {
  if (!window.agentbridge)
    throw new Error("请在 AgentBridge 桌面程序中使用此界面。");
  return window.agentbridge;
}
export async function call<T>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const reply = await bridge().call<T>(method, params);
  if (!reply.ok)
    throw Object.assign(new Error(reply.error.message), {
      code: reply.error.code,
    });
  return reply.result;
}
export const invoke = <T>(op: string, params: Record<string, unknown> = {}) =>
  call<T>("ipc", { op, ...params });
export const labels: Record<Status, string> = {
  queued: "待开始",
  accepted: "已接收",
  running: "进行中",
  succeeded: "已完成",
  failed: "执行失败",
  cancelled: "已取消",
  unknown: "结果待核对",
};
export const isTerminal = (t: Task) =>
  ["succeeded", "failed", "cancelled"].includes(t.status);
export const isVerificationTask = (t: Task) =>
  t.verification ?? /^只回复标记 AB_VERIFY_/.test(t.message);
export const isVerificationConversation = (c: Conversation) =>
  c.kind ? c.kind === "verification" :
    c.items?.length ? isVerificationTask(c.items[0]!) : /^只回复标记 AB_VERIFY_/.test(c.title);
export const conversationTitle = (c: Conversation) =>
  isVerificationConversation(c) ? "连接验证" : c.title;
export const hasNativeConversation = (c: Conversation) =>
  c.canContinue ?? !!c.items?.some(t => t.native?.sessionId);
export const taskLabel = (t: Task) =>
  t.waiting ? "等待你处理" : labels[t.status];
// Claude output events contain text deltas; OpenCode emits text snapshots.
// Merge only within a visible output span, keeping tools and state changes in
// their original order. Raw task events remain untouched for reconciliation.
export function taskEvents(task: Task, adapter?: Agent["adapter"]): Event[] {
  const rows: Event[] = [];
  for (const item of task.events || []) {
    if (["native", "reconciled"].includes(item.event.kind)) continue;
    if (isVerificationTask(task) && item.event.kind === "output") continue;
    const last = rows.at(-1);
    if (item.event.kind === "output" && last?.event.kind === "output") {
      const previous = last.event.text || "", next = item.event.text || "";
      if (adapter === "claude" || (adapter === "opencode" && next.startsWith(previous))) {
        last.event.text = adapter === "claude" ? previous + next : next;
        last.timestamp = item.timestamp;
        continue;
      }
    }
    rows.push({ ...item, event: { ...item.event,
      ...(item.event.kind === "completed" ? { text: isVerificationTask(task) ? "模型真实回复验证通过。" : "本轮执行完成。" } : {}),
    } });
  }
  return rows;
}
export function streamingAnswer(task: Task, adapter?: Agent["adapter"]) {
  return taskEvents(task, adapter).filter(e => e.event.kind === "output").map(e => e.event.text || "").join("\n\n");
}
export const agentLabel = (a: Agent) =>
  !a.enabled
    ? "已停用"
    : a.startupError
      ? "连接失败"
      : !a.online
        ? "未连接"
        : !a.healthy
          ? "检查异常"
          : a.currentTask?.status === "unknown"
            ? "结果待核对"
            : a.busy
              ? "正在工作"
              : a.verification?.status === "failed" && !a.verification.stale
                ? "模型回复失败"
              : "已连接";
export const agentTone = (a: Agent) =>
  a.startupError ? "danger" : a.currentTask?.status === "unknown" ? "warning" :
    a.verification?.status === "failed" && !a.verification.stale && !a.busy ? "danger" :
      a.online && a.healthy ? "success" : "neutral";
export const time = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
export const relative = (value: string) => {
  const m = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  return m < 1
    ? "刚刚"
    : m < 60
      ? `${m} 分钟前`
      : m < 1440
        ? `${Math.floor(m / 60)} 小时前`
        : time(value);
};
export const shortPath = (path: string) =>
  path.split(/[\\/]/).filter(Boolean).slice(-2).join("/");
export function readable(text: string) {
  return text
    .replace(
      "OpenCode accepted the prompt; waiting for actual execution",
      "OpenCode 已接收需求，等待执行",
    )
    .replace(/^Completed$/, "已完成")
    .replace(/^Waiting for /, "等待 ")
    .replace(/^Tool /, "工具 ");
}
