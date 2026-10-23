// Ordinary Windows EXE / disposable profile / authenticated production IPC / model 0.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  assert = require("node:assert/strict");
const { spawn, execFile } = require("node:child_process"),
  { createHash } = require("node:crypto");
const { CoordinatorClient } = require(path.join(process.env.AGENTBRIDGE_VERIFY_BRIDGE, "desktop/electron/coordinator-client.cjs"));
if (process.platform !== "win32") throw Error("Windows Node required");
const source = process.argv[2],
  version = process.argv[3],
  output = process.argv[4];
if (!source || !version || !output)
  throw Error("Provide candidate EXE, exact version and report path");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ab-ui-portable-")),
  exe = path.join(profile, path.basename(source));
fs.copyFileSync(source, exe);
const report = {
  date: new Date().toISOString(),
  version,
  environment:
    "ordinary no-debug Windows portable EXE / disposable profile / real Coordinator IPC and SQLite / model 0",
  status: "running",
  checks: [],
  modelCalls: 0,
  portable: {
    bytes: fs.statSync(exe).size,
    sha256: createHash("sha256").update(fs.readFileSync(exe)).digest("hex"),
  },
};
let wrapper, main, client;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ps = (command) =>
  new Promise((resolve, reject) =>
    execFile(
      path.join(
        process.env.SystemRoot || "C:/Windows",
        "System32/WindowsPowerShell/v1.0/powershell.exe",
      ),
      ["-NoProfile", "-NonInteractive", "-Command", command],
      { windowsHide: true, timeout: 15000 },
      (error, out) => (error ? reject(error) : resolve(out.trim())),
    ),
  );
async function launch() {
  const env = { ...process.env, AGENTBRIDGE_DESKTOP_PROFILE: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  wrapper = spawn(exe, [], { env, stdio: "ignore" });
  let exitFailure = null;
  wrapper.once("error", (error) => {
    exitFailure = error;
  });
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (exitFailure) throw exitFailure;
    if (fs.existsSync(path.join(profile, "coordinator-status.json"))) {
      const text = await ps(
        `Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${wrapper.pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;command=$_.CommandLine;title=(Get-Process -Id $_.ProcessId).MainWindowTitle}} | ConvertTo-Json -Compress`,
      );
      const rows = text ? JSON.parse(text) : [];
      main = (Array.isArray(rows) ? rows : [rows]).find(
        (row) => row.title === "AgentBridge",
      );
      if (main) {
        assert(!/remote-debugging|--inspect/.test(main.command));
        const next = new CoordinatorClient({ directory: profile, version });
        try {
          await next.attach();
          client = next;
          assert.equal(client.info.version, version);
          return;
        } catch (error) {
          next.close();
          if (!["ENOENT", "ECONNREFUSED"].includes(error.code)) throw error;
        }
      }
    }
    await delay(400);
  }
  throw Error(
    "Candidate portable did not expose a fresh ordinary window and authenticated Coordinator",
  );
}
async function closeWindow() {
  if (!main) return;
  assert.equal(main.parent, wrapper.pid);
  await ps(
    `(Get-Process -Id ${main.pid} -ErrorAction Stop).CloseMainWindow() | Out-Null`,
  );
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && wrapper.exitCode === null) await delay(200);
  assert.notEqual(
    wrapper.exitCode,
    null,
    "Normal close must exit the portable window wrapper",
  );
  main = null;
}
async function call(method, params = {}) {
  const reply = await client.request("call", { method, params });
  assert.equal(reply.ok, true, JSON.stringify(reply.error));
  return reply.result;
}
(async () => {
  await launch();
  const firstPid = client.info.pid;
  const snapshot = await call("snapshot");
  assert(snapshot.machines.some((machine) => machine.kind === "windows"));
  const nativeRequests = () =>
    JSON.stringify(
      (
        JSON.parse(
          fs.readFileSync(path.join(profile, "agent-network.json"), "utf8"),
        ).requests || []
      ).map((row) => ({
        requestId: row.requestId,
        nodeId: row.nodeId,
        machineId: row.machineId,
      })),
    );
  const originalRequests = nativeRequests();
  report.observedHistoryCount = snapshot.tasks.length;
  report.checks.push(
    "Candidate ordinary EXE opens with its own version and real Windows catalogue, no debugging flags; observed native history is read-only",
  );
  const agent = await call("team.registerAgent", {
    operationId: "ui-portable-agent",
    kind: "mcp",
    externalKey: "ui-portable-member",
    name: "界面候选检查成员",
    purpose: "验证公共资料持久化",
  });
  const team = await call("team.createTeam", {
    operationId: "ui-portable-team",
    name: "界面候选检查小队",
    leaderId: agent.agentId,
    memberIds: [agent.agentId],
    charter: "仅验证公共资料，不执行模型",
  });
  const run = await call("team.createRun", {
    operationId: "ui-portable-run",
    teamId: team.teamId,
    name: "界面候选持久化",
    goal: "关闭与重开后读取原资料",
    acceptance: "原消息文档保持，无执行尝试",
  });
  await call("team.writeDocument", {
    operationId: "ui-portable-document",
    runId: run.runId,
    expectedRevision: 0,
    title: "候选验证资料",
    content: "仅受控持久化验证",
    editorIds: [],
  });
  await call("team.postMessage", {
    operationId: "ui-portable-message",
    runId: run.runId,
    content: "候选普通EXE保持原公共资料",
    notifyIds: [],
  });
  async function checkOriginal() {
    const context = await call("team.context", { runId: run.runId });
    assert.equal(context.documents[0].title, "候选验证资料");
    assert(
      context.messages.some(
        (message) => message.content === "候选普通EXE保持原公共资料",
      ),
    );
    assert.equal(context.attempts.length, 0);
    await call("snapshot");
    assert.equal(
      nativeRequests(),
      originalRequests,
      "No original native request may be added or replayed",
    );
  }
  await checkOriginal();
  report.checks.push(
    "Production IPC and SQLite persist external member, team, public document and message without a model attempt",
  );
  await closeWindow();
  client.close();
  await launch();
  assert.equal(client.info.pid, firstPid);
  await checkOriginal();
  report.checks.push(
    "Normal close/reopen reuses the same Coordinator and original team records; no request replay",
  );
  await closeWindow();
  await client.request("shutdown");
  client.close();
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    try {
      process.kill(firstPid, 0);
    } catch {
      break;
    }
    await delay(200);
  }
  await launch();
  assert.notEqual(client.info.pid, firstPid);
  await checkOriginal();
  report.checks.push(
    "Full isolated Coordinator restart keeps original public records and zero native execution",
  );
  report.status = "passed";
})()
  .catch((error) => {
    report.status = "failed";
    report.error = {
      code: error.code || "VERIFY_FAILED",
      message: error.message,
    };
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeWindow();
    } catch {}
    try {
      await client?.request("shutdown");
    } catch {}
    client?.close();
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(
      JSON.stringify({
        status: report.status,
        version: report.version,
        checks: report.checks,
        error: report.error,
      }),
    );
  });
