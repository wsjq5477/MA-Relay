const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  MachineRouter,
  qualified,
  folderPath,
  workspaceKey,
} = require("../electron/machine-router.cjs");

const rawAgent = "same-agent::original";
const rawTask = "same-task::original";
const rawConversation = "same-conversation::original";
const timestamp = "2026-10-09T00:00:00.000Z";
test('SSH filesystem paths never alias local Windows or WSL drives',()=>{
  const remote={kind:'ssh',machineId:'ssh-server'},wsl={kind:'wsl',machineId:'wsl',distribution:'Ubuntu'},windows={kind:'windows',machineId:'windows'};
  assert.equal(workspaceKey(windows,'C:\\project'),workspaceKey(wsl,'/mnt/c/project'));
  assert.notEqual(workspaceKey(remote,'/mnt/c/project'),workspaceKey(wsl,'/mnt/c/project'));
  assert.notEqual(workspaceKey(remote,'/home/user'),workspaceKey({...remote,machineId:'ssh-other'},'/home/user'));
  assert.equal(folderPath('/srv/project',remote),'/srv/project');
});
function error(code) {
  return Object.assign(new Error(code), { code });
}
function originalTask(label, status = "succeeded") {
  return {
    taskId: rawTask,
    executionId: "same-execution",
    conversationId: rawConversation,
    requestId: "same-request",
    targetAgent: rawAgent,
    status,
    message: label,
    createdAt: timestamp,
    updatedAt: timestamp,
    native: { sessionId: "same-native::session", messageId: "native-message" },
  };
}
function backend(kind) {
  const executable = kind === "windows" ? "C:\\Tools\\claude.exe" : "/opt/opencode/bin/opencode";
  const state = {
    agents: { revision: 7, items: [{
      agentId: rawAgent, name: kind, enabled: true, executable,
      workspace: kind === "windows" ? "D:\\WindowsProject" : "/home/user/LinuxProject",
      available: true, online: true, healthy: true, busy: false,
    }] },
    tasks: [], conversations: [],
  };
  const host = {
    state, executable, calls: [], requests: new Map(), operations: new Map(),
    executions: 0, closes: 0, failSnapshot: false,
    async call(method, params = {}) {
      this.calls.push({ method, params: structuredClone(params) });
      if (method === "snapshot") {
        if (this.failSnapshot) throw error("FIXTURE_OFFLINE");
        return structuredClone(this.state);
      }
      if (method === "discover") return { items: [{ executable, name: kind, version: "fixture", healthy: true }] };
      if (method === "environment") return { platform: kind === "windows" ? "win32" : "linux" };
      if (method === "connect") {
        const agentId = "created-instance";
        this.state.agents.items.push({ agentId, enabled: true, name: params.name, workspace: params.workspace, executable: params.executable, available: true, busy: false });
        return { agentId };
      }
      if (method === "setInstanceModel") return { agentId: params.agentId, model: params.model, revision: params.expectedRevision + 1 };
      if (method !== "ipc") throw error("FIXTURE_METHOD");
      if (params.op === "request") {
        const saved = this.requests.get(params.requestId);
        if (!saved) throw error("NOT_FOUND");
        return structuredClone(saved.task);
      }
      if (params.op === "conversation") {
        const saved = this.state.conversations.find(c => c.conversationId === params.conversationId);
        if (!saved) throw error("NOT_FOUND");
        return structuredClone(saved);
      }
      if (["submit", "continue", "verify"].includes(params.op)) {
        const previous = this.requests.get(params.requestId);
        if (previous) {
          if (previous.message !== params.message) throw error("REQUEST_CONFLICT");
          return structuredClone(previous.task);
        }
        this.executions++;
        const targetAgent = params.agentId || this.state.conversations.find(c => c.conversationId === params.conversationId)?.targetAgent;
        const task = { ...originalTask(kind, "running"), taskId: "new-" + this.executions, requestId: params.requestId, targetAgent, message: params.message };
        this.state.tasks.push(task);
        const agent = this.state.agents.items.find(a => a.agentId === targetAgent);
        agent.busy = true;
        agent.currentTask = { taskId: task.taskId, status: "running" };
        this.requests.set(params.requestId, { task, message: params.message });
        return structuredClone(task);
      }
      if (params.op === "task") {
        const task = this.state.tasks.find(t => t.taskId === params.taskId);
        if (!task) throw error("TASK_NOT_FOUND");
        return structuredClone(task);
      }
      if (params.op === "operation") {
        const saved = this.operations.get(params.operationId);
        if (!saved) throw error("OPERATION_NOT_FOUND");
        return structuredClone(saved);
      }
      if (["cancel", "reply"].includes(params.op)) {
        const task = this.state.tasks.find(t => t.taskId === params.taskId);
        if (!task) throw error("TASK_NOT_FOUND");
        return { taskId: task.taskId, operationId: params.operationId || params.reply?.operationId, state: "confirmed", data: { machine: kind } };
      }
      throw error("FIXTURE_OPERATION");
    },
    close() { this.closes++; },
  };
  return host;
}
function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ab-machine-router-"));
  const hosts = { windows: backend("windows"), Ubuntu: backend("wsl"), Debian: backend("wsl") };
  const prefs = { distribution: "Ubuntu", directory: "/state/original" };
  const routers = [];
  const factory = () => {
    const router = new MachineRouter({
      directory, platform: "win32", hostname: "Fixture Windows", preferences: () => prefs,
      snapshotTimeoutMs: options.snapshotTimeoutMs,
      distributions: async () => options.distributions || ["Ubuntu"],
      createHost: machine => machine.kind === "windows" ? hosts.windows : hosts[machine.distribution],
    });
    routers.push(router);
    return router;
  };
  t.after(() => {
    routers.forEach(router => router.close());
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { directory, hosts, prefs, factory, router: factory() };
}
function machine(router, kind) {
  return router.catalog.machines.find(m => m.kind === kind);
}
function submit(router, source, requestId = "new-request") {
  return router.call("ipc", { op: "submit", agentId: qualified(source.machineId, rawAgent), requestId, message: "fixture prompt" });
}

test("imports old instances and history with stable machine IDs without rewriting raw or native IDs", async t => {
  const f = fixture(t);
  f.hosts.Ubuntu.state.tasks.push(originalTask("Linux history"));
  f.hosts.Ubuntu.state.conversations.push({ conversationId: rawConversation, targetAgent: rawAgent, lastTaskId: rawTask, turns: 2, updatedAt: timestamp });
  const before = structuredClone(f.hosts.Ubuntu.state);
  const first = await f.router.snapshot();
  const wsl = machine(f.router, "wsl");
  const task = first.tasks.find(row => row.machineId === wsl.machineId);
  assert.equal(task.taskId, qualified(wsl.machineId, rawTask));
  assert.equal(task.targetAgent, qualified(wsl.machineId, rawAgent));
  assert.equal(task.conversationId, qualified(wsl.machineId, rawConversation));
  assert.equal(task.executionId, "same-execution");
  assert.deepEqual(task.native, before.tasks[0].native);
  assert.equal(first.conversations[0].lastTaskId, qualified(wsl.machineId, rawTask));
  const catalog = JSON.parse(fs.readFileSync(path.join(f.directory, "machines.json"), "utf8"));
  assert.equal(catalog.instances.find(row => row.machineId === wsl.machineId).backendId, rawAgent);
  assert.equal(catalog.connections.length, 2);
  await f.router.snapshot();
  const reopened = f.factory();
  await reopened.snapshot();
  assert.deepEqual(reopened.catalog.machines.map(row => row.machineId), catalog.machines.map(row => row.machineId));
  assert.equal(reopened.catalog.instances.length, 2);
  assert.equal(reopened.catalog.connections.length, 2);
  assert.deepEqual(f.hosts.Ubuntu.state, before);
});

test("same raw IDs route tasks, conversations, requests, replies and operations to their source machine", async t => {
  const f = fixture(t);
  for (const [label, host] of [["Windows", f.hosts.windows], ["Linux", f.hosts.Ubuntu]]) {
    const task = originalTask(label);
    host.state.tasks.push(task);
    host.state.conversations.push({ conversationId: rawConversation, targetAgent: rawAgent, lastTaskId: rawTask, updatedAt: timestamp });
    host.requests.set("same-request", { task, message: label });
    host.operations.set("same-operation", { taskId: rawTask, operationId: "same-operation", state: "confirmed", data: { label } });
  }
  const snapshot = await f.router.snapshot();
  assert.equal(new Set(snapshot.tasks.map(row => row.taskId)).size, 2);
  for (const [kind, label, host] of [["windows", "Windows", f.hosts.windows], ["wsl", "Linux", f.hosts.Ubuntu]]) {
    const source = machine(f.router, kind);
    const result = await f.router.call("ipc", { op: "task", taskId: qualified(source.machineId, rawTask) });
    assert.equal(result.message, label);
    const request = await f.router.call("ipc", { op: "request", machineId: source.machineId, requestId: "same-request" });
    assert.equal(request.taskId, qualified(source.machineId, rawTask));
    const operation = await f.router.call("ipc", { op: "operation", machineId: source.machineId, taskId: qualified(source.machineId, rawTask), operationId: "same-operation" });
    assert.equal(operation.data.label, label);
    await f.router.call("ipc", { op: "reply", taskId: qualified(source.machineId, rawTask), reply: { operationId: "same-operation", requestId: "native-request", decision: "deny" } });
    assert.equal(host.calls.at(-1).params.taskId, rawTask);
    assert.equal(host.calls.at(-1).params.reply.operationId, "same-operation");
    const continued = await f.router.call("ipc", { op: "continue", conversationId: qualified(source.machineId, rawConversation), requestId: "same-next", message: "fixture next" });
    assert.equal(continued.targetAgent, qualified(source.machineId, rawAgent));
    await f.router.call("ipc", { op: "cancel", taskId: continued.taskId, operationId: "same-cancel" });
    assert.equal(host.calls.at(-1).params.taskId, "new-1");
  }
  const windows = machine(f.router, "windows"), wsl = machine(f.router, "wsl");
  await assert.rejects(f.router.call("ipc", { op: "task", machineId: windows.machineId, taskId: qualified(wsl.machineId, rawTask) }), { code: "WRONG_MACHINE" });
});

test("keeps Windows paths native and maps only the selected WSL distribution", () => {
  const windows = { kind: "windows", machineId: "local-test" };
  const wsl = { kind: "wsl", machineId: "wsl-test", distribution: "Ubuntu" };
  assert.equal(folderPath("D:\\我的项目\\a b", windows), "D:\\我的项目\\a b");
  assert.equal(folderPath("D:\\我的项目\\a b", wsl), "/mnt/d/我的项目/a b");
  assert.equal(folderPath("\\\\wsl.localhost\\Ubuntu\\home\\user\\project", wsl), "/home/user/project");
  assert.equal(folderPath("/home/user/project", wsl), "/home/user/project");
  assert.throws(() => folderPath("\\\\wsl$\\Debian\\home\\user\\project", wsl), { code: "WRONG_MACHINE" });
  assert.equal(workspaceKey(windows, "D:\\Shared\\Project"), workspaceKey(wsl, "/mnt/d/shared/project/"));
  assert.equal(workspaceKey(windows, "\\\\wsl$\\Ubuntu\\home\\user\\project"), workspaceKey(wsl, "/home/user/project"));
});

test("shared Windows and WSL projects reject new work while either instance is busy", async t => {
  const f = fixture(t);
  f.hosts.windows.state.agents.items[0].workspace = "D:\\Shared";
  const linux = f.hosts.Ubuntu.state.agents.items[0];
  linux.workspace = "/mnt/d/Shared"; linux.busy = true;
  f.hosts.Ubuntu.state.tasks.push(originalTask("in progress", "running"));
  await f.router.snapshot();
  await assert.rejects(submit(f.router, machine(f.router, "windows")), { code: "PROJECT_BUSY" });
  assert.equal(f.hosts.windows.executions, 0);
});

test("shared occupancy includes an active instance outside the first 100 displayed tasks", async t => {
  const f = fixture(t);
  f.hosts.windows.state.agents.items[0].workspace = "D:\\Shared";
  const linux = f.hosts.Ubuntu.state.agents.items[0];
  linux.workspace = "/mnt/d/Shared"; linux.busy = true;
  linux.currentTask = { taskId: "task-101", status: "running" };
  f.hosts.Ubuntu.state.tasks = Array.from({ length: 100 }, (_, index) => ({ ...originalTask("old history"), taskId: "old-" + index }));
  await f.router.snapshot();
  await assert.rejects(submit(f.router, machine(f.router, "windows")), { code: "PROJECT_BUSY" });
  assert.equal(f.hosts.windows.executions, 0);
});

test("reopening with an offline shared source retains occupancy but independent projects still run", async t => {
  const f = fixture(t);
  f.hosts.windows.state.agents.items[0].workspace = "D:\\Shared";
  f.hosts.Ubuntu.state.agents.items[0].workspace = "/mnt/d/Shared";
  await f.router.snapshot();
  f.router.close();
  f.hosts.Ubuntu.failSnapshot = true;
  const reopened = f.factory();
  const reopenedSnapshot = await reopened.snapshot();
  const offlineInstance = reopenedSnapshot.instances.find(row => row.machineId === machine(reopened, "wsl").machineId);
  assert.ok(offlineInstance, "a persisted instance must remain visible while its machine is offline");
  assert.equal(offlineInstance.available, false);
  assert.equal(offlineInstance.workspace, "/mnt/d/Shared");
  assert.equal(reopened.cache.has(machine(reopened, "wsl").machineId), false);
  await assert.rejects(submit(reopened, machine(reopened, "windows")), { code: "PROJECT_SOURCE_OFFLINE" });
  f.hosts.windows.state.agents.items[0].workspace = "D:\\Independent";
  await reopened.snapshot();
  const independent = await submit(reopened, machine(reopened, "windows"), "independent-request");
  assert.equal(independent.status, "running");
  assert.equal(f.hosts.windows.executions, 1);
});

test("idempotent retries reach the original backend contract before shared project occupancy", async t => {
  const f = fixture(t);
  await f.router.snapshot();
  const source = machine(f.router, "windows");
  const first = await submit(f.router, source, "retry-request");
  for (let index = 0; index < 10; index++) {
    const repeated = await submit(f.router, source, "retry-request");
    assert.equal(repeated.taskId, first.taskId);
  }
  assert.equal(f.hosts.windows.executions, 1);
  await assert.rejects(f.router.call("ipc", { op: "submit", agentId: qualified(source.machineId, rawAgent), requestId: "retry-request", message: "different content" }), { code: "REQUEST_CONFLICT" });
  assert.equal(f.hosts.windows.executions, 1);
});

test("changing the selected machine preserves other hosts and their running work", async t => {
  const f = fixture(t, { distributions: ["Ubuntu", "Debian"] });
  await f.router.snapshot();
  const windows = machine(f.router, "windows"), wsl = machine(f.router, "wsl");
  const nativeHost = f.router.hosts.get(windows.machineId), linuxHost = f.router.hosts.get(wsl.machineId);
  await submit(f.router, windows);
  f.prefs.distribution = "Debian";
  assert.equal(f.router.defaultMachine().distribution, "Debian");
  await f.router.snapshot();
  await f.router.call("environment", { machineId: wsl.machineId });
  assert.equal(f.router.hosts.get(windows.machineId), nativeHost);
  assert.equal(f.router.hosts.get(wsl.machineId), linuxHost);
  assert.equal(f.hosts.windows.closes, 0);
  assert.equal(f.hosts.Ubuntu.closes, 0);
  assert.equal(f.hosts.windows.state.tasks[0].status, "running");
});

test("one failed source keeps healthy results and marks only cached active tasks uncertain", async t => {
  const f = fixture(t);
  f.hosts.windows.state.tasks.push(originalTask("Windows complete"));
  f.hosts.Ubuntu.state.tasks.push(originalTask("Linux active", "running"));
  await f.router.snapshot();
  f.hosts.Ubuntu.failSnapshot = true;
  const snapshot = await f.router.snapshot();
  const windows = machine(f.router, "windows"), wsl = machine(f.router, "wsl");
  assert.equal(snapshot.machines.find(row => row.machineId === windows.machineId).online, true);
  assert.equal(snapshot.machines.find(row => row.machineId === wsl.machineId).online, false);
  assert.equal(snapshot.tasks.find(row => row.machineId === windows.machineId).status, "succeeded");
  assert.equal(snapshot.tasks.find(row => row.machineId === wsl.machineId).status, "unknown");
  assert.equal(f.hosts.Ubuntu.state.tasks[0].status, "running");
});

test("empty machines exist before instances and connecting a tool does not ask for a project", async t => {
  const f = fixture(t);
  f.hosts.windows.state.agents.items = [];
  f.hosts.Ubuntu.state.agents.items = [];
  const snapshot = await f.router.snapshot();
  assert.equal(snapshot.machines.length, 2);
  assert.equal(snapshot.instances.length, 0);
  const source = machine(f.router, "windows");
  const connected = await f.router.call("connectTool", { machineId: source.machineId, executable: f.hosts.windows.executable });
  assert.equal(connected.connection.connected, true);
  assert.equal(f.hosts.windows.calls.filter(call => call.method === "connect").length, 0);
  const created = await f.router.call("createInstance", { machineId: source.machineId, connectionId: connected.connection.connectionId, workspace: "D:\\Selected Project", name: "Selected project" });
  assert.equal(created.agentId, qualified(source.machineId, "created-instance"));
  assert.equal(f.router.catalog.instances.length, 1);
  assert.equal(f.router.catalog.instances[0].connectionId, connected.connection.connectionId);
  assert.equal(f.hosts.windows.calls.find(call => call.method === "connect").params.workspace, "D:\\Selected Project");
  assert.equal(f.hosts.windows.executions, 0);
  assert.equal(f.hosts.Ubuntu.executions, 0);
});

test("an unavailable legacy preferred WSL retains its identity instead of falling back to another distro", async t => {
  const f = fixture(t);
  f.prefs.distribution = "Missing";
  const snapshot = await f.router.snapshot();
  const missing = f.router.catalog.machines.find(row => row.distribution === "Missing");
  const ubuntu = f.router.catalog.machines.find(row => row.distribution === "Ubuntu");
  assert.ok(missing);
  assert.ok(ubuntu);
  assert.equal(missing.unavailable, true);
  assert.equal(f.router.defaultMachine().machineId, missing.machineId);
  assert.equal(snapshot.machines.find(row => row.machineId === missing.machineId).online, false);
  assert.equal(snapshot.machines.find(row => row.machineId === ubuntu.machineId).online, true);
  const prepared = await f.router.prepare("ipc", { op: "request", requestId: "legacy-request" });
  assert.equal(prepared.params.machineId, missing.machineId);
  const before = f.hosts.Ubuntu.calls.length;
  await assert.rejects(f.router.call("ipc", prepared.params), { code: "MACHINE_OFFLINE" });
  assert.equal(f.hosts.Ubuntu.calls.length, before);
});

test("a never-ending WSL snapshot times out without blocking Windows or spawning repeated jobs", async t => {
  const f = fixture(t, { snapshotTimeoutMs: 30 });
  const originalCall = f.hosts.Ubuntu.call.bind(f.hosts.Ubuntu);
  let stalledCalls = 0;
  f.hosts.Ubuntu.call = async (method, params) => {
    if (method === "snapshot") {
      stalledCalls++;
      return new Promise(() => {});
    }
    return originalCall(method, params);
  };
  const started = performance.now();
  const first = await f.router.snapshot();
  assert.ok(performance.now() - started < 200, "the 30 ms source deadline must bound the aggregate refresh");
  const windows = machine(f.router, "windows"), wsl = machine(f.router, "wsl");
  assert.equal(first.machines.find(row => row.machineId === windows.machineId).online, true);
  assert.equal(first.machines.find(row => row.machineId === wsl.machineId).online, false);
  assert.equal(first.instances.find(row => row.machineId === windows.machineId).available, true);
  const coolingStarted = performance.now();
  for (let index = 0; index < 5; index++) {
    const duringCooldown = await f.router.snapshot();
    assert.equal(duringCooldown.machines.find(row => row.machineId === windows.machineId).online, true);
    assert.equal(duringCooldown.machines.find(row => row.machineId === wsl.machineId).online, false);
  }
  assert.ok(performance.now() - coolingStarted < 200, "cooldown refreshes should immediately reuse the failed source status");
  assert.equal(stalledCalls, 1);
  assert.equal(f.router.snapshotJobs.size, 1);
});

test("instance model overrides and inheritance resets retain source routing and revision contracts", async t => {
  const f = fixture(t);
  await f.router.snapshot();
  for (const [kind, host, model] of [["windows", f.hosts.windows, "DeepSeek-V4.1-Flash"], ["wsl", f.hosts.Ubuntu, { providerID: "csi-provider", id: "DeepSeek-V4.1-Flash" }]]) {
    const source = machine(f.router, kind);
    for (const selected of [model, null]) {
      const beforeOther = kind === "windows" ? f.hosts.Ubuntu.calls.length : f.hosts.windows.calls.length;
      const result = await f.router.call("setInstanceModel", { machineId: source.machineId, agentId: qualified(source.machineId, rawAgent), expectedRevision: 7, model: selected });
      const sent = host.calls.at(-1);
      assert.equal(sent.method, "setInstanceModel");
      assert.deepEqual(sent.params, { agentId: rawAgent, expectedRevision: 7, model: selected });
      assert.equal(result.agentId, qualified(source.machineId, rawAgent));
      assert.equal(result.machineId, source.machineId);
      assert.deepEqual(result.model, selected);
      assert.equal(result.revision, 8);
      assert.equal(kind === "windows" ? f.hosts.Ubuntu.calls.length : f.hosts.windows.calls.length, beforeOther);
    }
  }
});
