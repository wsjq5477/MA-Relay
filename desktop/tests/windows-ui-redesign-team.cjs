// Windows Edge + frozen production renderer. All data is synthetic and every
// application mutation is rejected by the injected API before any backend exists.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { chromium, expect } = require("../node_modules/@playwright/test");

const base = path.resolve(
  __dirname,
  "../../artifacts/ui-redesign/2026-10-18/team",
);
const out = path.join(base, new Date().toISOString().replace(/[:.]/g, "-"));
const report = {
  date: new Date().toISOString(),
  version: require("../package.json").version,
  environment:
    "Windows Node / Edge / frozen production renderer / addInitScript synthetic team API",
  status: "running",
  modelCalls: 0,
  writeAttempts: 0,
  checks: [],
  screenshots: [],
  pageErrors: [],
};
let frozen, server, browser, context, page;

function mock() {
  const calls = [];
  let completedTask = false;
  let includeUnknown = false;
  const agent = {
    agentId: "fixture-team-agent",
    kind: "native",
    nodeId: "fixture-node",
    entryKey: "fixture-native-entry",
    name: "受控协调员",
    purpose: "只读界面验证",
    inputs: "合成材料",
    outputs: "合成结果",
    limitations: "不得执行模型或写入",
    revision: 1,
    disabled: false,
  };
  // All nodes can execute direct conversations. Team eligibility must be
  // determined separately, including old snapshots without capability fields
  // and unsupported adapters that incorrectly advertise explicit support.
  const nodes = [
    { nodeId: agent.nodeId, adapter: "claude", name: "受控原生节点" },
    { nodeId: "fixture-opencode-node", adapter: "opencode", name: "受控 OpenCode 节点" },
    { nodeId: "fixture-codex-node", adapter: "codex", name: "受控 Codex 节点", teamCollaboration: true },
    { nodeId: "fixture-hermes-node", adapter: "hermes", name: "Hermes 直接会话", teamCollaboration: true },
    { nodeId: "fixture-pi-node", adapter: "pi", name: "Pi 直接会话", teamCollaboration: false },
    { nodeId: "fixture-dsh-node", adapter: "dsh", name: "DSH 直接会话" },
    { nodeId: "fixture-claude-denied-node", machineId: "fixture-remote-machine", adapter: "claude", name: "受控远端拒绝协作节点", teamCollaboration: false },
    { nodeId: "fixture-unknown-node", adapter: "fixture-unregistered", name: "受控未知工具节点", teamCollaboration: true },
  ].map(node => ({
    machineId: "fixture-machine",
    executable: "C:/fixture/" + node.adapter + ".exe",
    version: "fixture",
    connected: true,
    online: true,
    healthy: true,
    busy: false,
    available: true,
    executionSupported: true,
    activeTasks: 0,
    status: "connected",
    ...node,
  }));
  const agents = [agent, ...nodes.slice(1).map(node => ({
    ...agent,
    agentId: node.nodeId + "-member",
    nodeId: node.nodeId,
    entryKey: node.nodeId + "-entry",
    name: "历史成员：" + node.name,
  }))];
  const run = {
    runId: "fixture-team-run",
    teamId: "fixture-team",
    name: "小队绑定可见性验证",
    goal: "展示历史异常与后续正常执行，不代替后台业务判断。",
    acceptance: "检查原生终态、异常提示及等待语义；不提交真实验收。",
    charter: "全部数据合成，所有应用写入与模型请求拒绝。",
    leaderId: agent.agentId,
    memberIds: agents.map(member => member.agentId),
    revision: 1,
    state: "active",
    paused: false,
  };
  const team = {
    teamId: run.teamId,
    name: "受控验证小队",
    leaderId: agent.agentId,
    memberIds: agents.map(member => member.agentId),
    charter: run.charter,
    revision: 1,
  };
  const attempts = [
    {
      attemptId: "fixture-earlier-binding",
      runId: run.runId,
      agentId: agent.agentId,
      nodeId: agent.nodeId,
      requestId: "fixture-request-earlier",
      taskId: "fixture-task-earlier",
      message: "旧异常原生执行的原始需求",
      state: "succeeded",
      result: "旧执行的原始结果继续保留。",
      continuationError: "TEAM_SESSION_CHANGED",
    },
    {
      attemptId: "fixture-later-normal",
      runId: run.runId,
      agentId: agent.agentId,
      nodeId: agent.nodeId,
      requestId: "fixture-request-later",
      taskId: "fixture-task-later",
      message: "后续正常原生执行的原始需求",
      state: "succeeded",
      result: "后续正常执行的原始结果继续保留。",
    },
  ];
  const copy = (value) => structuredClone(value);
  const snapshot = {
    configured: true,
    directory: "isolated-team-ui-fixture",
    agents: { items: [], revision: 1, connected: true },
    machines: [
      {
        machineId: "fixture-machine",
        name: "隔离测试机器",
        kind: "windows",
        platform: "win32",
        online: true,
      },
      {
        machineId: "fixture-remote-machine",
        name: "隔离合成远端机器",
        kind: "ssh",
        platform: "linux",
        online: true,
      },
    ],
    nodes,
    tasks: [],
    conversations: [],
    teamSpaceSupported: true,
    nodeManagement: true,
    machineManagement: true,
    daemonManagement: true,
    collaboration: { leaderId: null, memberIds: [], revision: 1 },
  };
  function contextView() {
    const currentAttempts = copy(attempts);
    if (includeUnknown)
      currentAttempts.push({
        attemptId: "fixture-unknown-wait",
        runId: run.runId,
        agentId: agent.agentId,
        nodeId: agent.nodeId,
        requestId: "fixture-request-unknown",
        taskId: "fixture-task-unknown",
        message: "原执行未知时保留等待与取消收据",
        state: "unknown",
        waiting: { kind: "permission", requestCount: 2 },
        stop: { state: "confirmed" },
        error: {
          code: "FIXTURE_UNCONFIRMED",
          message: "受控原请求仍待核对，原错误保留。",
        },
      });
    const workItems = completedTask
      ? [
          {
            workItemId: "fixture-completed-item",
            title: "已验收的合成工作项",
            description:
              "仅补足按钮既有前提，检查历史异常不会在前端全局禁用验收。",
            ownerId: agent.agentId,
            kind: "delivery",
            dependsOn: [],
            state: "completed",
            revision: 2,
            round: 1,
            currentReportId: "fixture-report",
            acceptanceSummary: "合成工作项已验收。",
            reports: [
              {
                reportId: "fixture-report",
                round: 1,
                outcome: "submitted",
                summary: "合成报告，不来自真实模型。",
                reporterId: agent.agentId,
                artifact: {
                  artifactId: "fixture-artifact",
                  version: "fixture-v2",
                  reference: "合成共享材料",
                },
              },
            ],
          },
        ]
      : [];
    return {
      stopSupported: true,
      run: copy(run),
      members: agents.map(member => ({ ...copy(member), role: member.agentId === agent.agentId ? "leader" : "member" })),
      documents: [],
      messages: [],
      hasOlderMessages: false,
      deliveries: [],
      attempts: currentAttempts,
      stop: null,
      workItems,
      handoffGrants: [],
      handoffs: [],
      acceptance: null,
      automation: {
        policy: null,
        capabilities: [],
        events: [],
        pending: 0,
        limitReached: false,
        runningMessages: false,
      },
    };
  }
  const denied = (method) => ({
    ok: false,
    error: {
      code: "FIXTURE_READ_ONLY",
      message: "隔离只读验证拒绝应用写入：" + method,
    },
  });
  const preferences = {
    theme: "light",
    distribution: "",
    directory: snapshot.directory,
    platform: "win32",
    version: "0.6.0-alpha.28 · 受控小队验证",
  };
  window.agentbridge = {
    async call(method, params = {}) {
      calls.push({ method, ...(params.op ? { op: params.op } : {}) });
      if (method === "snapshot") return { ok: true, result: copy(snapshot) };
      if (method === "graphLayout")
        return {
          ok: true,
          result: {
            version: 1,
            layoutRevision: 1,
            // Supply a complete saved layout for this expanded inventory.
            // Missing entries legitimately trigger AgentGraph's automatic
            // initial layout/save, including while its canvas is hidden.
            groups: Object.fromEntries(snapshot.machines.map((machine, index) => [machine.machineId, { x: index * 500, y: 0 }])),
            nodes: Object.fromEntries(snapshot.nodes.map(node => [node.nodeId, {
              x: 40,
              y: 130 + snapshot.nodes.filter(other => other.machineId === node.machineId).findIndex(other => other.nodeId === node.nodeId) * 155,
            }])),
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        };
      if (method === "graphPending") return { ok: true, result: [] };
      if (method === "team.snapshot")
        return {
          ok: true,
          result: {
            stage: "I07C1",
            agents: copy(agents),
            teams: [copy(team)],
            runs: [copy(run)],
            automaticCoordination: false,
          },
        };
      if (
        ["team.refresh", "team.context"].includes(method) &&
        params.runId === run.runId
      )
        return { ok: true, result: contextView() };
      calls.at(-1).writeAttempt = true;
      return denied(method);
    },
    async preferences() {
      return copy(preferences);
    },
    async pending() {
      return [];
    },
    async recoverPending() {
      return { resolved: 0, items: [] };
    },
    async runtimes() {
      return { platform: "win32", distributions: [] };
    },
    async pickFolder() {
      return null;
    },
    async savePreferences() {
      calls.push({ method: "savePreferences", writeAttempt: true });
      throw Error("隔离验证禁止保存应用配置。");
    },
    async window() {
      calls.push({ method: "window", writeAttempt: true });
      throw Error("隔离验证禁止窗口或后台写入。");
    },
  };
  window.__teamControl = {
    calls,
    showCompletedTask() {
      completedTask = true;
    },
    showUnknownWait() {
      includeUnknown = true;
    },
  };
}

function save() {
  fs.writeFileSync(
    path.join(out, "ui.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
async function capture(file, description, target) {
  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeInViewport();
  await page.screenshot({ path: path.join(out, file), animations: "disabled" });
  const geometry = await page.evaluate(() => ({
    documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    contentOverflow:
      document.querySelector(".content").scrollWidth >
      document.querySelector(".content").clientWidth + 1,
  }));
  report.screenshots.push({
    file,
    description,
    viewport: page.viewportSize(),
    ...geometry,
  });
  assert.equal(geometry.documentOverflow, false);
  assert.equal(geometry.contentOverflow, false);
  save();
}
function check(description) {
  report.checks.push(description);
  save();
}

(async () => {
  fs.mkdirSync(base, { recursive: true });
  fs.mkdirSync(out);
  const dist = path.resolve(__dirname, "../dist");
  assert.ok(
    fs.existsSync(path.join(dist, "index.html")),
    "Build the production renderer first",
  );
  frozen = fs.mkdtempSync(path.join(os.tmpdir(), "agentbridge-ui-team-"));
  const renderer = path.join(frozen, "renderer");
  fs.cpSync(dist, renderer, { recursive: true });
  report.renderer = fs
    .readdirSync(path.join(renderer, "assets"))
    .sort()
    .map((file) => ({
      file,
      sha256: createHash("sha256")
        .update(fs.readFileSync(path.join(renderer, "assets", file)))
        .digest("hex"),
    }));
  const javascript = report.renderer
    .filter((file) => file.file.endsWith(".js"))
    .map((file) =>
      fs.readFileSync(path.join(renderer, "assets", file.file), "utf8"),
    )
    .join("\n");
  assert.ok(
    javascript.includes("team-binding-warning"),
    "Current production build must contain the binding warning",
  );
  assert.ok(
    javascript.includes("尚不支持小队协作"),
    "Current production build must contain the team-capability admission UI",
  );
  server = http.createServer((request, response) => {
    try {
      const relative =
        decodeURIComponent(
          new URL(request.url, "http://localhost").pathname,
        ).replace(/^\/+/, "") || "index.html";
      const file = path.resolve(renderer, relative);
      if (!file.startsWith(renderer + path.sep)) {
        response.writeHead(403).end();
        return;
      }
      response.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : "text/html",
      );
      response.setHeader("Cache-Control", "no-store");
      response.end(fs.readFileSync(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({
    executablePath:
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true,
  });
  report.browserVersion = browser.version();
  report.nodeVersion = process.version;
  context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (error) => {
    report.pageErrors.push(error.message);
    save();
  });
  await page.addInitScript(mock);
  await page.goto("http://127.0.0.1:" + server.address().port);
  await expect(page.locator(".inventory-node")).toHaveCount(8);
  await page.getByRole("button", { name: "小队协作", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "小队协作", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("当前工作", { exact: true })
    .selectOption("fixture-team-run");
  await expect(page.locator(".team-attempt")).toHaveCount(2);
  const earlier = page
    .locator(".team-attempt")
    .filter({ hasText: "旧异常原生执行的原始需求" });
  const later = page
    .locator(".team-attempt")
    .filter({ hasText: "后续正常原生执行的原始需求" });
  const warning = earlier.locator('.team-binding-warning[role="status"]');
  await expect(warning).toHaveText(
    "会话身份异常，当前记录不能作为可信验收依据。",
  );
  await expect(earlier.locator("h3")).toContainText("本轮已完成");
  await expect(earlier).toContainText("旧执行的原始结果继续保留。");
  await expect(later.locator("h3")).toContainText("本轮已完成");
  await expect(later).toContainText("后续正常执行的原始结果继续保留。");
  await expect(later.locator(".team-binding-warning")).toHaveCount(0);
  await expect(page.locator(".team-binding-warning")).toHaveCount(1);
  await capture(
    "01-binding-warning.png",
    "Earlier succeeded binding anomaly is visible; later succeeded record retains its original result without a warning",
    warning,
  );
  check(
    "Earlier continuationError displays a scoped warning while both original succeeded states and results remain intact",
  );

  // Empty workItems legitimately disable total acceptance. Add one completed
  // synthetic item only in the mock to test the existing UI prerequisite; no
  // team write or real acceptance call is sent and no binding result is inferred.
  await expect(
    page.getByRole("button", { name: "验收总工作", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => window.__teamControl.showCompletedTask());
  await page.getByRole("button", { name: "刷新工作", exact: true }).click();
  const acceptance = page.getByRole("button", {
    name: "验收总工作",
    exact: true,
  });
  await expect(acceptance).toBeEnabled();
  await expect(page.locator(".team-task-board")).not.toContainText(
    "总工作已验收",
  );
  await expect(page.locator(".team-binding-warning")).toHaveCount(1);
  await capture(
    "02-no-global-history-lock.png",
    "The unchanged historical warning does not globally disable the UI acceptance button when its completed-item prerequisite is met; button is not clicked",
    acceptance,
  );
  check(
    "Historical binding warning does not impose a global UI acceptance lock; run remains active and unaccepted, acceptance is never submitted",
  );

  await page.evaluate(() => window.__teamControl.showUnknownWait());
  await page.getByRole("button", { name: "刷新工作", exact: true }).click();
  await expect(page.locator(".team-attempt")).toHaveCount(3);
  const waiting = page
    .locator(".team-attempt")
    .filter({ hasText: "原执行未知时保留等待与取消收据" });
  await expect(waiting.locator("h3")).toContainText("原执行待核对");
  await expect(waiting).toContainText("上次观察到原生权限等待（2 项）");
  await expect(waiting).toContainText("当前未批准或重新执行");
  await expect(waiting).toContainText("取消操作已确认，仍以原执行终态为准");
  await expect(waiting).toContainText("受控原请求仍待核对，原错误保留。");
  await expect(waiting).not.toContainText("本轮已取消");
  await expect(waiting.locator(".team-binding-warning")).toHaveCount(0);
  await capture(
    "03-unknown-waiting-stop.png",
    "Unknown preserves the last observed permission wait, original error and confirmed cancellation receipt without claiming approval or cancelled terminal state",
    waiting,
  );
  check(
    "Unknown waiting and confirmed cancellation receipt keep their original separate meanings; original error remains visible",
  );

  await page.getByRole("button", { name: "智能体", exact: true }).click();
  const registrationNodes = page.getByLabel("原生节点", { exact: true });
  await expect(registrationNodes).toBeVisible();
  assert.deepEqual(
    await registrationNodes.locator("option").evaluateAll(options => options.map(option => option.value).filter(Boolean).sort()),
    ["fixture-node", "fixture-opencode-node", "fixture-codex-node"].sort(),
    "Only original team-capable adapters belong in the native registration selector",
  );
  const unsupportedHint = registrationNodes.locator("..");
  await expect(unsupportedHint).toContainText("尚不支持小队协作");
  await expect(unsupportedHint).toContainText("直接会话");
  for (const tool of ["Hermes", "Pi", "DSH", "fixture-unregistered"])
    await expect(unsupportedHint).toContainText(tool);
  await registrationNodes.selectOption("fixture-opencode-node");
  await expect(registrationNodes).toHaveValue("fixture-opencode-node");
  await registrationNodes.selectOption("fixture-codex-node");
  await expect(registrationNodes).toHaveValue("fixture-codex-node");
  await expect(page.locator(".team-stack .team-card").filter({ hasText: "历史成员：Hermes 直接会话" })).toHaveCount(1);
  await capture(
    "04-native-registration-capabilities.png",
    "Native registration includes Claude, OpenCode and Codex; direct-only, explicitly denied and unknown tools are excluded while historical members remain visible",
    registrationNodes,
  );
  check(
    "Native registration filters all five unsupported nodes, including Hermes/unknown explicit true and Claude explicit false; legacy original adapters remain selectable without submitting registration",
  );

  await page.getByRole("button", { name: "工作空间", exact: true }).click();
  const executionMembers = page.getByLabel("执行成员", { exact: true });
  await expect(executionMembers).toBeVisible();
  assert.deepEqual(
    await executionMembers.locator("option").evaluateAll(options => options.map(option => option.value).filter(Boolean).sort()),
    ["fixture-team-agent", "fixture-opencode-node-member", "fixture-codex-node-member"].sort(),
    "Previously registered unsupported native members cannot be selected for team execution",
  );
  await executionMembers.selectOption("fixture-codex-node-member");
  await expect(executionMembers).toHaveValue("fixture-codex-node-member");
  await expect(page.getByRole("button", { name: "执行这一轮", exact: true })).toBeEnabled();
  await expect(page.locator(".team-members")).toContainText("历史成员：Hermes 直接会话");
  await expect(page.locator(".team-members")).toContainText("历史成员：Pi 直接会话");
  await expect(page.locator(".team-members")).toContainText("历史成员：DSH 直接会话");
  await expect(page.locator(".team-attempt")).toHaveCount(3);
  await expect(page.locator(".team-binding-warning")).toHaveCount(1);
  await capture(
    "05-existing-member-execution-capabilities.png",
    "Only eligible original members can be selected for a new team turn; direct-only historical member cards and all original attempt records remain",
    executionMembers,
  );
  check(
    "Team execution excludes historical unsupported members without deleting their member cards, original attempts or scoped binding warning; no execution is submitted",
  );

  await page.getByRole("button", { name: "机器与 Agent", exact: true }).click();
  await expect(page.locator(".inventory-node")).toHaveCount(8);
  for (const adapter of ["hermes", "pi", "dsh"]) {
    const directNode = page.locator(".inventory-node").filter({ has: page.locator('.inventory-node-icon[data-adapter="' + adapter + '"]') });
    await expect(directNode).toHaveCount(1);
    await expect(directNode.getByRole("button", { name: "开始会话", exact: true })).toBeEnabled();
  }
  await page.getByLabel("搜索机器与 Agent", { exact: true }).fill("直接会话");
  await expect(page.locator(".inventory-node")).toHaveCount(3);
  await capture(
    "06-direct-conversation-inventory.png",
    "Machine inventory retains Hermes, Pi and DSH with enabled direct-conversation controls despite their exclusion from team selectors; no direct conversation is started",
    page.locator(".inventory-list"),
  );
  await page.getByLabel("搜索机器与 Agent", { exact: true }).fill("");
  await expect(page.locator(".inventory-node")).toHaveCount(8);
  check(
    "All eight tools remain in machine inventory; Hermes/Pi/DSH retain enabled direct-conversation entry points and searchable inventory without backend writes",
  );

  const calls = await page.evaluate(() => window.__teamControl.calls);
  report.writeAttempts = calls.filter((call) => call.writeAttempt).length;
  report.callMethods = [...new Set(calls.map((call) => call.method))].sort();
  fs.writeFileSync(
    path.join(out, "calls.json"),
    JSON.stringify(calls, null, 2) + "\n",
  );
  assert.equal(
    report.writeAttempts,
    0,
    "No application write or model request may be attempted",
  );
  assert.deepEqual(report.pageErrors, []);
  report.status = "passed";
  save();
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      screenshots: report.screenshots.length,
      browser: report.browserVersion,
      node: report.nodeVersion,
      output: out,
    }),
  );
})()
  .catch(async (error) => {
    report.status = "failed";
    report.error = String(error.stack || error);
    try {
      if (page && !page.isClosed())
        await page.screenshot({
          path: path.join(out, "failure.png"),
          animations: "disabled",
        });
    } catch {}
    save();
    console.error(report.error);
    console.error("Evidence: " + out);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (page && !page.isClosed()) {
        const calls = await page.evaluate(
          () => window.__teamControl?.calls || [],
        );
        report.writeAttempts = calls.filter((call) => call.writeAttempt).length;
        fs.writeFileSync(
          path.join(out, "calls.json"),
          JSON.stringify(calls, null, 2) + "\n",
        );
        if (report.writeAttempts) {
          report.status = "failed";
          process.exitCode = 1;
        }
      }
    } catch {}
    await context?.close();
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (frozen) fs.rmSync(frozen, { recursive: true, force: true });
    save();
  });
