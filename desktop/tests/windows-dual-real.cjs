// Run with Windows Node. Uses isolated Bridge data/projects and existing CLI login.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { MachineRouter } = require("../electron/machine-router.cjs");
const { ClaudeHost } = require("../electron/claude-host.cjs");
const { HostConnection, distributions } = require("../electron/rpc.cjs");
const [base] = process.argv.slice(2);
if (process.platform !== "win32" || !base) throw new Error("Windows Node and an isolated output directory are required");
const stamp = Date.now().toString(16), root = path.join(base, "I04B-" + stamp);
const directory = path.join(root, "profile"), winProject = path.join(root, "windows-project");
const linuxRoot = "/tmp/agentbridge-i04b-" + stamp, linuxProject = linuxRoot + "/project", linuxState = linuxRoot + "/state";
fs.mkdirSync(winProject, { recursive: true });
fs.writeFileSync(path.join(winProject, "README.md"), "Isolated AgentBridge Windows Claude acceptance project.\n");
execFileSync("wsl.exe", ["-d", "Ubuntu", "--exec", "/bin/mkdir", "-p", linuxProject], { timeout: 15000, windowsHide: true });
const report = { date: new Date().toISOString(), platform: process.platform, status: "running", root, linuxRoot, checks: {}, errors: [], tasks: [] };
const output = path.resolve(__dirname, "../../artifacts/I04B-dual-real.json");
const save = () => { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2)); };
const settings = { distribution: "Ubuntu", directory: linuxState };
function open() {
  return new MachineRouter({ directory, platform: "win32", preferences: () => settings, distributions,
    createHost: machine => machine.kind === "windows" ? new ClaudeHost({ directory: path.join(directory, "windows") })
      : new HostConnection(path.resolve(__dirname, "../../dist/desktop-host.js"), { distribution: machine.distribution, directory: linuxState, bootstrapPath: path.resolve(__dirname, "../electron/bootstrap.sh") }),
  });
}
let router = open();
const delay = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, timeout = 120000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await fn(); if (value) return value; await delay(300); }
  throw new Error("Dual-machine acceptance timed out");
}
async function done(taskId) {
  return until(async () => { const t = await router.call("ipc", { op: "task", taskId });
    if (t.waiting) report.waiting = t.waiting;
    if (["succeeded", "failed", "cancelled", "unknown"].includes(t.status)) return t;
    return false;
  });
}
(async () => {
  let state = await router.call("snapshot");
  const windows = state.machines.find(m => m.kind === "windows"), wsl = state.machines.find(m => m.distribution === "Ubuntu");
  assert(windows?.online && wsl?.online); assert.equal(state.instances.length, 0);
  report.checks.machinesBeforeInstances = true; report.machines = state.machines;
  const native = (await router.call("discover", { machineId: windows.machineId })).items[0];
  const linux = (await router.call("discover", { machineId: wsl.machineId })).items[0];
  assert(native?.healthy && linux); report.tools = [{ name: native.name, version: native.version, authentication: native.authentication }, { name: linux.name, version: linux.version }];
  const winTool = await router.call("connectTool", { machineId: windows.machineId, executable: native.executable });
  const linuxTool = await router.call("connectTool", { machineId: wsl.machineId, executable: linux.executable });
  assert.equal((await router.call("snapshot")).instances.length, 0); report.checks.connectWithoutProjectOrModel = true;
  const a = await router.call("createInstance", { machineId: windows.machineId, connectionId: winTool.connection.connectionId, workspace: winProject, name: "Windows Claude 验收", model: { providerID: "claude", id: "DeepSeek-V4.1-Flash" } });
  const b = await router.call("createInstance", { machineId: wsl.machineId, connectionId: linuxTool.connection.connectionId, workspace: linuxProject, name: "WSL OpenCode 验收", model: { providerID: "csi-provider", id: "DeepSeek-V4.1-Flash" } });
  report.models = [{ machineId: windows.machineId, model: "DeepSeek-V4.1-Flash" }, { machineId: wsl.machineId, model: "csi-provider/DeepSeek-V4.1-Flash" }];
  await until(async () => (await router.call("snapshot")).instances.every(i => i.available));
  report.checks.bothInstancesAvailable = true; save();
  const winMarker = "AB_WIN_" + stamp, linuxMarker = "AB_WSL_" + stamp;
  const [winTask, linuxTask] = await Promise.all([
    router.call("ipc", { op: "submit", agentId: a.agentId, requestId: randomUUID(), message: "只回复 " + winMarker + "，不要执行工具、不要读写文件。" }),
    router.call("ipc", { op: "submit", agentId: b.agentId, requestId: randomUUID(), message: "只回复 " + linuxMarker + "，不要执行工具、不要读写文件。" }),
  ]);
  report.checks.simultaneousDispatch = winTask.machineId !== linuxTask.machineId;
  report.tasks = [winTask, linuxTask].map(t => ({ taskId: t.taskId, machineId: t.machineId, status: t.status })); save();
  const completed = await Promise.all([done(winTask.taskId), done(linuxTask.taskId)]);
  for (let i = 0; i < completed.length; i++) {
    const task = completed[i]; report.tasks[i] = { ...report.tasks[i], status: task.status, result: task.result?.message, error: task.error, summary: task.lastSummary, nativeSession: task.native?.sessionId };
  }
  save(); assert(completed.every(t => t.status === "succeeded"), JSON.stringify(report.tasks));
  assert(completed[0].result.message.includes(winMarker)); assert(completed[1].result.message.includes(linuxMarker));
  report.checks.realResponsesBothSources = true;
  const followups = await Promise.all(completed.map(t => router.call("ipc", { op: "continue", conversationId: t.conversationId, requestId: randomUUID(), message: "只回复上一轮要求回复的完整标记，不要执行工具。" })));
  const continued = await Promise.all(followups.map(t => done(t.taskId)));
  continued.forEach((t, i) => { assert.equal(t.status, "succeeded"); assert.equal(t.native?.sessionId, completed[i].native?.sessionId); assert(t.result.message.includes(i === 0 ? winMarker : linuxMarker)); });
  report.checks.nativeSessionsResumed = true;
  router.close(); router = open();
  state = await router.call("snapshot");
  assert.equal(state.instances.length, 2); assert.equal(state.conversations.length, 2); assert.equal(state.tasks.length, 4);
  for (const t of continued) assert.equal((await router.call("ipc", { op: "task", taskId: t.taskId })).status, "succeeded");
  report.checks.historyAfterReopen = true;
  report.status = "passed";
})().catch(error => { report.status = "failed"; report.errors.push(error.stack); process.exitCode = 1; }).finally(() => { router.close(); save(); console.log("Windows Claude + WSL OpenCode: " + report.status); });
