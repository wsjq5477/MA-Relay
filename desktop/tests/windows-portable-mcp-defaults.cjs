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
  driverNode: process.version,
  lifecycle: [],
  portable: {
    bytes: fs.statSync(exe).size,
    sha256: createHash("sha256").update(fs.readFileSync(exe)).digest("hex"),
  },
};
let wrapper, main, client, originalTeamReceipt, windowBinding, originalContextProof, nativeMcpLifecycle;
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
          windowBinding=await require('./windows-portable-window.cjs').bindPortableWindow(main.pid);
          await next.attach();
          client = next;
          assert.equal(client.info.version, version);
          nativeMcpLifecycle?.windowOpened(main.command);
          return;
        } catch (error) {
          next.close();
          windowBinding?.dispose();windowBinding=null;
          if (!["ENOENT", "ECONNREFUSED", "WINDOW_TARGET_CHANGED"].includes(error.code)) throw error;
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
  const closeRequest=await windowBinding.close();
  assert.equal(closeRequest.verified,true,"The original product window must still belong to the observed process and keep its product title");
  report.lifecycle.push({closeRequest});
  fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  assert.equal(closeRequest.accepted,true,"Windows must accept normal close for the owned candidate window");
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && wrapper.exitCode === null) await delay(200);
  const remaining=await ps(`Get-CimInstance Win32_Process | Where-Object {$_.ProcessId -in ${main.pid},${wrapper.pid}} | ForEach-Object {$_.ProcessId} | ConvertTo-Json -Compress`);
  const remainingPids=remaining?[JSON.parse(remaining)].flat():[];report.lifecycle.push({mainProcessExited:!remainingPids.includes(main.pid),wrapperExitCode:wrapper.exitCode,remainingOwnedPids:remainingPids});
  assert.notEqual(
    wrapper.exitCode,
    null,
    "Normal close must exit the portable window wrapper",
  );
  assert.equal(wrapper.exitCode,0,'Normal close must return success');
  assert.deepEqual(remainingPids,[],'Both original main and wrapper must be gone');
  windowBinding?.dispose();windowBinding=null;main = null;
  if(nativeMcpLifecycle)await nativeMcpLifecycle.windowClosed();
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
  if(process.env.AGENTBRIDGE_VERIFY_CONTEXT_PROOF==='1')originalContextProof=await require('./windows-context-transfer-proof.cjs').seed(call,run.runId,agent.agentId,process.env.AGENTBRIDGE_VERIFY_BRIDGE);
  if(process.env.AGENTBRIDGE_VERIFY_NATIVE_MCP_ROOT){nativeMcpLifecycle=await require('./windows-native-mcp-lifecycle.cjs').open({call,runId:run.runId,agentId:agent.agentId,profile,nativeRoot:process.env.AGENTBRIDGE_VERIFY_NATIVE_MCP_ROOT});nativeMcpLifecycle.windowOpened(main.command);}
  async function checkOriginal() {
    if(nativeMcpLifecycle)await nativeMcpLifecycle.verify('window_open');
    if(originalContextProof)await require('./windows-context-transfer-proof.cjs').verify(call,originalContextProof);
    if(process.env.AGENTBRIDGE_VERIFY_TEAM_PROOF==='1'){const receipt=await call("team.operation",{operationId:"ui-portable-message"});assert.equal(receipt.operationId,"ui-portable-message");assert.match(receipt.fingerprint,/^[a-f0-9]{64}$/);if(originalTeamReceipt)assert.deepEqual(receipt,originalTeamReceipt);else originalTeamReceipt=receipt;}
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
  if(nativeMcpLifecycle)await nativeMcpLifecycle.reopen();
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
  if(process.env.AGENTBRIDGE_VERIFY_TEAM_PROOF==='1')report.checks.push("Original Team operation ID, durable fingerprint and original result remain exactly identical across ordinary window and full Coordinator restarts, without redispatch");
  if(originalContextProof)report.checks.push("Original selected packet, recipient stdio acknowledgement/time and send receipt survive all ordinary window and full Coordinator restarts; user audit never receives the private proof");
  if(nativeMcpLifecycle){report.nativeMcp=nativeMcpLifecycle.result();report.checks.push('Real native Pi MCP remains usable after GUI close and extraction removal, explicit native client reopen, three distinct portable extraction paths and full Coordinator restart with the same original identity/configuration');}
  report.status = "checks_passed_cleanup_pending";
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
    const cleanupErrors=[];
    try {await closeWindow();}catch{cleanupErrors.push('original_window_exit_unconfirmed');}
    try {await nativeMcpLifecycle?.close();report.nativeClientClosed=true;}catch{cleanupErrors.push('native_client_exit_unconfirmed');}
    if(nativeMcpLifecycle&&report.status==='checks_passed_cleanup_pending'&&!cleanupErrors.length)report.nativeMcp=nativeMcpLifecycle.result();
    const originalCoordinatorPid=client?.info?.pid;
    try {
      await client?.request("shutdown");
      if(originalCoordinatorPid){
        const until=Date.now()+30000;let exited=false;
        do{try{process.kill(originalCoordinatorPid,0);}catch(error){if(error.code==='ESRCH'){exited=true;break;}}await delay(100);}while(Date.now()<until);
        report.finalCoordinatorExitConfirmed=exited;
        if(!exited)cleanupErrors.push('original_coordinator_exit_unconfirmed');
      }
    }catch{cleanupErrors.push('original_coordinator_shutdown_unconfirmed');}
    client?.close();windowBinding?.dispose();
    if(wrapper&&wrapper.exitCode===null)cleanupErrors.push('original_portable_wrapper_exit_unconfirmed');
    if(cleanupErrors.length){report.status='cleanup_pending';report.cleanupErrors=cleanupErrors;process.exitCode=1;}
    else if(report.status==='checks_passed_cleanup_pending')report.status='passed';
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
