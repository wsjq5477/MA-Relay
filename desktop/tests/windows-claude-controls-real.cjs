const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { MachineRouter } = require("../electron/machine-router.cjs");
const { ClaudeHost } = require("../electron/claude-host.cjs");
const { HostConnection, distributions } = require("../electron/rpc.cjs");
const prior = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../artifacts/I04B-dual-real.json"), "utf8"));
if (process.platform !== "win32" || prior.status !== "passed") throw new Error("Run successful isolated dual-machine acceptance first");
const directory = path.join(prior.root, "profile"), prefs = { theme: "light", distribution: "Ubuntu", directory: prior.linuxRoot + "/state" };
fs.writeFileSync(path.join(directory, "desktop.json"), JSON.stringify(prefs));
const output = path.resolve(__dirname, "../../artifacts/I04B-claude-controls-real.json");
const report = { date: new Date().toISOString(), status: "running", checks: {}, tasks: [], errors: [] };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2));
function open() { return new MachineRouter({ directory, platform: "win32", distributions, preferences: () => prefs,
  createHost: m => m.kind === "windows" ? new ClaudeHost({ directory: path.join(directory, "windows") })
    : new HostConnection(path.resolve(__dirname, "../../dist/desktop-host.js"), { distribution: m.distribution, directory: prefs.directory, bootstrapPath: path.resolve(__dirname, "../electron/bootstrap.sh") }),
}); }
let router = open();
const delay = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, timeout = 150000) { const end = Date.now() + timeout; while (Date.now() < end) { const r = await fn(); if (r) return r; await delay(200); } throw new Error("Claude controls acceptance timed out"); }
async function approve(task) {
  const pending = await router.call("ipc", { op: "pending", taskId: task.taskId });
  for (const p of pending.permissions) {
    report.checks.realNativePermission = true;
    const receipt = await router.call("ipc", { op: "reply", taskId: task.taskId, reply: { action: "permission", taskId: task.taskId, executionId: task.executionId, operationId: randomUUID(), requestId: p.id, decision: "once" } });
    assert(["confirmed", "unknown"].includes(receipt.state));
  }
}
(async () => {
  const state = await router.call("snapshot"), instance = state.instances.find(i => i.adapter === "claude");
  assert(instance && instance.workspace === path.join(prior.root, "windows-project"));
  const existing = state.tasks.find(t => t.targetAgent === instance.agentId && !["succeeded", "failed", "cancelled"].includes(t.status) && t.message.includes("bridge-native-check.txt"));
  assert(instance.available || existing);
  const marker = existing?.message.match(/AB_NATIVE_[a-f0-9]+/)?.[0] || "AB_NATIVE_" + Date.now().toString(16);
  const task = existing || await router.call("ipc", { op: "submit", agentId: instance.agentId, requestId: randomUUID(), message: "请使用 Write 工具在当前项目根目录创建 bridge-native-check.txt，文件内容严格为 " + marker + "。完成后只回复完成，不要运行 Bash，不要读取项目以外文件。" });
  const completed = await until(async () => { const t = await router.call("ipc", { op: "task", taskId: task.taskId }); if (t.waiting) await approve(t); return ["succeeded", "failed", "cancelled"].includes(t.status) ? t : false; });
  report.tasks.push({ taskId: completed.taskId, status: completed.status, error: completed.error }); save();
  assert.equal(completed.status, "succeeded"); assert.equal(fs.readFileSync(path.join(instance.workspace, "bridge-native-check.txt"), "utf8").trim(), marker);
  report.checks.realNativeWrite = true;
  const waiting = await router.call("ipc", { op: "submit", agentId: instance.agentId, requestId: randomUUID(), message: "请用 Bash 执行 sleep 30，结束后只回复 WAIT_DONE。不要读写任何文件。" });
  await until(async () => { const t = await router.call("ipc", { op: "task", taskId: waiting.taskId });
    if (t.waiting) { await approve(t); return true; }
    if (["failed", "succeeded"].includes(t.status)) throw new Error("Wait task finished before cancellation: " + t.lastSummary);
    return t.events?.some(e => e.event.text?.includes("Bash")) || false;
  });
  const operationId = randomUUID();
  await router.call("ipc", { op: "cancel", taskId: waiting.taskId, operationId });
  const cancelled = await until(async () => { const t = await router.call("ipc", { op: "task", taskId: waiting.taskId }); return ["succeeded", "failed", "cancelled"].includes(t.status) ? t : false; });
  const receipt = await router.call("ipc", { op: "operation", taskId: waiting.taskId, operationId });
  assert.equal(cancelled.status, "cancelled"); assert.equal(receipt.state, "confirmed"); assert.equal(receipt.data.nativeExited, true);
  report.tasks.push({ taskId: cancelled.taskId, status: cancelled.status }); report.checks.cancelConfirmedNativeExit = true;
  router.close(); router = open();
  assert.equal((await router.call("ipc", { op: "task", taskId: cancelled.taskId })).status, "cancelled");
  assert.equal((await router.call("ipc", { op: "task", taskId: completed.taskId })).status, "succeeded");
  report.checks.controlsHistoryAfterReopen = true; report.status = "passed";
})().catch(e => { report.status = "failed"; report.errors.push(e.stack); process.exitCode = 1; }).finally(() => { router.close(); save(); console.log("Real Claude approval/write/cancel: " + report.status); });
