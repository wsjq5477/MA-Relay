// Windows Edge + frozen production renderer. All API data is synthetic;
// model/business mutations are rejected before any real backend can be used.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { chromium, expect } = require("../node_modules/@playwright/test");

const baseOut = path.resolve(
  process.env.AGENTBRIDGE_UI_STATE_DIR ||
    path.join(__dirname, "../../artifacts/ui-redesign/2026-10-18/state"),
);
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const out = path.join(baseOut, runId);
const report = {
  date: new Date().toISOString(),
  version: require("../package.json").version,
  environment:
    "Windows Node / Edge / frozen production dist / isolated addInitScript API",
  status: "running",
  modelCalls: 0,
  businessAttempts: 0,
  checks: [],
  screenshots: [],
  geometry: [],
  pageErrors: [],
  notRun: process.argv.includes("--skip-menu")
    ? ["Menu behavior; isolated diagnostic run"]
    : [],
};
let frozen, server, browser, context, page;
let collectedFromPage = 0;
const everyCall = [];

function mock(initial) {
  const date = "2026-10-18T00:00:00.000Z";
  const state = {
    snapshotFailure: false,
    remoteOnline: true,
    pendingOriginal: false,
    longNames: false,
    ...initial,
  };
  const calls = [],
    heldConversations = new Set(),
    heldTasks = new Set();
  const conversationWaiters = new Map(),
    taskWaiters = new Map();
  const long = (value) =>
    value + "_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".repeat(5);
  const names = () => ({
    local: state.longNames ? long("LOCAL_MACHINE") : "本机测试机器",
    remote: state.longNames ? long("REMOTE_MACHINE") : "远端测试机器",
    a: state.longNames ? long("ORIGINAL_AGENT_A") : "原节点 A",
    b: state.longNames ? long("INDEPENDENT_AGENT_B") : "独立节点 B",
    remoteNode: state.longNames ? long("REMOTE_AGENT") : "远端节点",
  });
  function machines() {
    const n = names();
    return [
      {
        machineId: "local",
        name: n.local,
        kind: "windows",
        platform: "win32",
        online: true,
      },
      {
        machineId: "remote",
        name: n.remote,
        kind: "ssh",
        platform: "linux",
        online: state.remoteOnline,
        connectionId: "fixture-ssh",
        connectionState: state.remoteOnline ? "online" : "disconnected",
      },
    ];
  }
  function nodes() {
    const n = names();
    return [
      {
        nodeId: "a",
        machineId: "local",
        name: n.a,
        adapter: "claude",
        executable: "C:/fixture/claude-a.exe",
      },
      {
        nodeId: "b",
        machineId: "local",
        name: n.b,
        adapter: "codex",
        executable: "C:/fixture/codex-b.exe",
      },
      {
        nodeId: "remote-agent",
        machineId: "remote",
        name: n.remoteNode,
        adapter: "opencode",
        executable: "/opt/fixture/opencode",
      },
    ].map((n) => ({
      ...n,
      connected: true,
      executionSupported: true,
      online: n.machineId !== "remote" || state.remoteOnline,
      healthy: true,
      available: true,
      busy: false,
      activeTasks: 0,
      version: "fixture-version",
      status: "connected",
      ...(n.nodeId === "a" && state.pendingOriginal
        ? { unconfirmed: 1, uncertain: true }
        : {}),
    }));
  }
  const tasks = [
    {
      taskId: "task-a",
      conversationId: "conversation-a",
      nodeId: "a",
      machineId: "local",
      message: "任务 A 的原始需求",
      result: { message: "A_ONLY_BODY" },
    },
    {
      taskId: "task-b",
      conversationId: "conversation-b",
      nodeId: "b",
      machineId: "local",
      message: "任务 B 的原始需求",
      result: { message: "B_ONLY_BODY" },
    },
    {
      taskId: "task-remote",
      conversationId: "conversation-remote",
      nodeId: "remote-agent",
      machineId: "remote",
      message: "远端任务的原始需求",
      result: { message: "REMOTE_ONLY_BODY" },
    },
  ].map((t) => ({
    ...t,
    executionId: "execution-" + t.taskId,
    requestId: "request-" + t.taskId,
    targetAgent: "instance-" + t.nodeId,
    status: "succeeded",
    createdAt: date,
    updatedAt: date,
    turn: 1,
    lastSummary: "",
    lastSeq: 0,
    events: [],
  }));
  const conversations = tasks.map((t) => ({
    conversationId: t.conversationId,
    nodeId: t.nodeId,
    machineId: t.machineId,
    targetAgent: t.targetAgent,
    title:
      t.nodeId === "a" ? "会话 A" : t.nodeId === "b" ? "会话 B" : "远端会话",
    kind: "task",
    turns: 1,
    updatedAt: date,
    canContinue: true,
    items: [t],
  }));
  let layout = {
    version: 1,
    layoutRevision: 0,
    groups: { local: { x: 0, y: 0 }, remote: { x: 650, y: 0 } },
    nodes: {
      a: { x: 25, y: 110 },
      b: { x: 25, y: 270 },
      "remote-agent": { x: 25, y: 110 },
    },
    viewport: { x: 0, y: 0, zoom: 0.7 },
  };
  const copy = (value) => structuredClone(value);
  function defer(waiters, key, value) {
    return new Promise((resolve) => {
      const list = waiters.get(key) || [];
      list.push({ resolve, value: copy(value) });
      waiters.set(key, list);
    });
  }
  function release(waiters, key, late) {
    const rows = waiters.get(key) || [];
    waiters.delete(key);
    for (const row of rows) row.resolve(late ? late(row.value) : row.value);
    return rows.length;
  }
  function pending() {
    return state.pendingOriginal
      ? [
          {
            id: "original-unresolved",
            op: "submit",
            state: "unknown",
            machineId: "local",
            params: { nodeId: "a", machineId: "local" },
            blockedNodeIds: ["a"],
            time: date,
          },
        ]
      : [];
  }
  window.agentbridge = {
    call: async (method, params = {}) => {
      const entry = {
        method,
        op: params.op,
        conversationId: params.conversationId,
        taskId: params.taskId,
      };
      calls.push(entry);
      if (
        method === "nodeRequest" ||
        method === "team.execute" ||
        method === "manageNode" ||
        (method === "ipc" &&
          ["submit", "continue", "reply", "cancel"].includes(params.op))
      ) {
        entry.businessAttempt = true;
        return {
          ok: false,
          error: {
            code: "MODEL_DISABLED_IN_FIXTURE",
            message: "隔离状态测试禁止执行模型或业务变更。",
          },
        };
      }
      if (method === "snapshot") {
        if (state.snapshotFailure)
          return {
            ok: false,
            error: {
              code: "CONTROLLED_SNAPSHOT_FAILURE",
              message: "受控后台连接失败，保留上次快照。",
            },
          };
        return {
          ok: true,
          result: {
            configured: true,
            directory: "controlled-ui-state-profile",
            nodeManagement: true,
            machineManagement: true,
            daemonManagement: true,
            collaboration: { leaderId: "a", memberIds: ["b"], revision: 1 },
            agents: { items: [], revision: 1, connected: true },
            machines: machines(),
            nodes: nodes(),
            tasks: copy(tasks),
            conversations: copy(conversations),
            instances: [],
            connections: [],
          },
        };
      }
      if (method === "graphLayout") return { ok: true, result: copy(layout) };
      if (method === "graphPending") return { ok: true, result: [] };
      if (method === "saveGraphLayout") {
        layout = {
          ...copy(params.layout),
          layoutRevision: layout.layoutRevision + 1,
        };
        return {
          ok: true,
          result: {
            operationId: params.operationId,
            state: "confirmed",
            data: copy(layout),
          },
        };
      }
      if (method === "ipc" && params.op === "conversation") {
        const value = conversations.find(
          (c) => c.conversationId === params.conversationId,
        );
        if (heldConversations.delete(params.conversationId))
          return {
            ok: true,
            result: await defer(
              conversationWaiters,
              params.conversationId,
              value,
            ),
          };
        return { ok: true, result: copy(value) };
      }
      if (method === "ipc" && params.op === "task") {
        const value = tasks.find((t) => t.taskId === params.taskId);
        if (heldTasks.delete(params.taskId))
          return {
            ok: true,
            result: await defer(taskWaiters, params.taskId, value),
          };
        return { ok: true, result: copy(value) };
      }
      if (method === "ipc" && params.op === "pending")
        return { ok: true, result: { permissions: [], forms: [] } };
      return {
        ok: false,
        error: {
          code: "CONTROLLED_UNSUPPORTED_READ",
          message: "状态夹具没有实现该入口：" + method,
        },
      };
    },
    preferences: async () => ({
      theme: "light",
      platform: "win32",
      version: "0.6.0-alpha.28 · 状态夹具",
      distribution: "",
      directory: "",
    }),
    savePreferences: async (value) => value,
    runtimes: async () => ({ platform: "win32", distributions: [] }),
    pending: async () => copy(pending()),
    recoverPending: async () => ({
      resolved: 0,
      remaining: pending().length,
      items: state.pendingOriginal
        ? [
            {
              id: "original-unresolved",
              machineId: "local",
              op: "submit",
              code: "NOT_CONFIGURED",
              reason: "原后台配置尚未就绪，只能核对原请求。",
            },
          ]
        : [],
    }),
    window: async (action) => {
      calls.push({ method: "window", action });
    },
  };
  window.__testControl = {
    calls,
    names,
    nodes,
    setSnapshotFailure: (value) => {
      state.snapshotFailure = value;
    },
    holdConversation: (id) => heldConversations.add(id),
    holdTask: (id) => heldTasks.add(id),
    pendingConversationCount: (id) => conversationWaiters.get(id)?.length || 0,
    pendingTaskCount: (id) => taskWaiters.get(id)?.length || 0,
    releaseConversation: (id) =>
      release(conversationWaiters, id, (value) => ({
        ...value,
        items: value.items.map((t) => ({
          ...t,
          result: { message: "A_ONLY_BODY_LATE" },
        })),
      })),
    releaseTask: (id) =>
      release(taskWaiters, id, (value) => ({
        ...value,
        result: { message: "TASK_A_LATE" },
      })),
  };
}

function save() {
  fs.writeFileSync(
    path.join(out, "ui.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
async function capture(name, description) {
  const file = name + ".png";
  await page.screenshot({ path: path.join(out, file), animations: "disabled" });
  report.screenshots.push({ file, description, viewport: page.viewportSize() });
  save();
}
async function collectCalls() {
  if (!page || page.isClosed()) return;
  const calls = await page.evaluate(() => window.__testControl?.calls || []);
  everyCall.push(...calls.slice(collectedFromPage));
  collectedFromPage = calls.length;
  report.businessAttempts = everyCall.filter(
    (call) => call.businessAttempt,
  ).length;
  assert.equal(
    report.businessAttempts,
    0,
    "No model/business request may be attempted",
  );
}
async function fresh(initial = {}, viewport = { width: 1280, height: 860 }) {
  await collectCalls();
  await context?.close();
  context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  page = await context.newPage();
  collectedFromPage = 0;
  page.on("pageerror", (error) => {
    report.pageErrors.push(error.message);
    save();
  });
  await page.addInitScript(mock, initial);
  await page.goto("http://127.0.0.1:" + server.address().port);
  await expect(page.locator(".inventory-node")).toHaveCount(3);
  await expect(
    page
      .locator(".inventory-node")
      .nth(1)
      .getByRole("button", { name: "开始会话" }),
  ).toBeEnabled();
}
async function navigate(label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: label, exact: true }),
  ).toBeVisible();
}
async function selectConversation(title) {
  await page
    .locator(".workspace-conversation-choice")
    .filter({ hasText: title })
    .click();
  await expect(page.locator(".workspace-conversation-heading h2")).toHaveText(
    title,
  );
}
async function flushFrame() {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
async function check(description) {
  await collectCalls();
  report.checks.push(description);
  save();
}
async function geometry(label) {
  const result = await page.evaluate(() => {
    const selectors = [
      "html",
      ".content",
      ".inventory-machine",
      ".inventory-node",
    ];
    const overflow = selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector))
        .filter(
          (element) =>
            element.clientWidth &&
            element.scrollWidth > element.clientWidth + 1,
        )
        .map((element) => ({
          selector,
          width: element.clientWidth,
          scrollWidth: element.scrollWidth,
        })),
    );
    return { viewport: { width: innerWidth, height: innerHeight }, overflow };
  });
  report.geometry.push({ label, ...result });
  save();
  assert.deepEqual(
    result.overflow,
    [],
    label + ": no page/card horizontal overflow",
  );
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const dist = path.resolve(__dirname, "../dist");
  assert.ok(
    fs.existsSync(path.join(dist, "index.html")),
    "Build the production renderer first",
  );
  frozen = fs.mkdtempSync(path.join(os.tmpdir(), "agentbridge-ui-state-"));
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
  server = http.createServer((request, response) => {
    try {
      const pathname =
        decodeURIComponent(
          new URL(request.url, "http://localhost").pathname,
        ).replace(/^\/+/, "") || "index.html";
      const file = path.resolve(renderer, pathname);
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

  await fresh();
  await navigate("会话");
  await selectConversation("会话 B");
  await page
    .getByRole("textbox", { name: "继续会话", exact: true })
    .fill("这条需求不得发出");
  await expect(
    page.getByRole("button", { name: "发送", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => window.__testControl.setSnapshotFailure(true));
  await page.getByRole("button", { name: "刷新数据", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("受控后台连接失败");
  assert.equal(
    await page.evaluate(() =>
      window.__testControl.nodes().every((node) => node.available),
    ),
    true,
  );
  await expect(
    page.getByRole("button", { name: "发送", exact: true }),
  ).toBeDisabled();
  await page
    .locator(".workspace-followup")
    .evaluate((form) => form.requestSubmit());
  await capture(
    "01-snapshot-failure",
    "旧快照仍有available节点，后台失败锁禁止续问",
  );
  await check(
    "Snapshot failure preserves cached available data while continuation and submit handler stay locked",
  );

  await fresh({ remoteOnline: false });
  await navigate("会话");
  await selectConversation("远端会话");
  await page
    .getByRole("textbox", { name: "继续会话", exact: true })
    .fill("离线续问不得发送");
  await expect(
    page.getByRole("button", { name: "发送", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".workspace-composer-footer")).toContainText(
    "来源机器离线",
  );
  assert.equal(
    await page.evaluate(
      () =>
        window.__testControl
          .nodes()
          .find((node) => node.nodeId === "remote-agent").connected,
    ),
    true,
  );
  await page
    .locator(".workspace-followup")
    .evaluate((form) => form.requestSubmit());
  await capture("02-offline-node", "节点保留connected但online=false时禁续问");
  await check(
    "A connected but offline remote node cannot continue its original conversation",
  );

  await fresh();
  await navigate("会话");
  await page.evaluate(() =>
    window.__testControl.holdConversation("conversation-a"),
  );
  await selectConversation("会话 A");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__testControl.pendingConversationCount("conversation-a"),
      ),
    )
    .toBe(1);
  await selectConversation("会话 B");
  assert.equal(
    await page.evaluate(() =>
      window.__testControl.releaseConversation("conversation-a"),
    ),
    1,
  );
  await flushFrame();
  await expect(page.locator(".workspace-conversation-heading h2")).toHaveText(
    "会话 B",
  );
  await expect(page.locator(".workspace-conversation-reading")).toContainText(
    "B_ONLY_BODY",
  );
  await expect(
    page.locator(".workspace-conversation-reading"),
  ).not.toContainText("A_ONLY_BODY_LATE");
  await expect(page.locator(".workspace-conversation-heading")).toContainText(
    "独立节点 B",
  );
  await expect(
    page.locator(".workspace-conversation-heading"),
  ).not.toContainText("原节点 A");
  await capture(
    "03-late-conversation",
    "A详情迟到后，B标题、正文和来源保持一致",
  );
  await check(
    "Delayed conversation A response is discarded after selecting B; title, answer and source all remain B",
  );

  await fresh();
  await navigate("任务看板");
  await page.evaluate(() => window.__testControl.holdTask("task-a"));
  await page
    .locator(".workspace-task")
    .filter({ hasText: "任务 A 的原始需求" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "任务详情", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => window.__testControl.pendingTaskCount("task-a")),
    )
    .toBe(1);
  await page.getByRole("button", { name: "关闭任务详情", exact: true }).click();
  assert.equal(
    await page.evaluate(() => window.__testControl.releaseTask("task-a")),
    1,
  );
  await flushFrame();
  await expect(
    page.getByRole("dialog", { name: "任务详情", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "刷新数据", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "任务详情", exact: true }),
  ).toHaveCount(0);
  await capture(
    "04-late-task-close",
    "关闭任务详情后，迟到详情响应不会重开抽屉",
  );
  await check(
    "Closing task A clears its requested identity; a delayed read cannot reopen the drawer",
  );

  await fresh({ pendingOriginal: true });
  await expect(
    page
      .locator(".inventory-node")
      .filter({ hasText: "原节点 A" })
      .getByRole("button", { name: "开始会话" }),
  ).toBeDisabled();
  await expect(
    page
      .locator(".inventory-node")
      .filter({ hasText: "独立节点 B" })
      .getByRole("button", { name: "开始会话" }),
  ).toBeEnabled();
  await capture(
    "05-node-isolation",
    "unknown仅阻塞原节点，同机器独立节点仍可用",
  );
  await navigate("会话");
  await selectConversation("会话 A");
  await page
    .getByRole("textbox", { name: "继续会话", exact: true })
    .fill("原节点不得重放");
  await expect(
    page.getByRole("button", { name: "发送", exact: true }),
  ).toBeDisabled();
  await selectConversation("会话 B");
  await page
    .getByRole("textbox", { name: "继续会话", exact: true })
    .fill("独立节点可继续");
  await expect(
    page.getByRole("button", { name: "发送", exact: true }),
  ).toBeEnabled();
  await check(
    "Original unknown node stays blocked while a same-machine independent node and conversation remain usable",
  );

  await fresh();
  await navigate("会话");
  await selectConversation("会话 B");
  await page
    .getByRole("textbox", { name: "继续会话", exact: true })
    .fill("筛选后不得残留发送框");
  await expect(
    page.getByRole("button", { name: "发送", exact: true }),
  ).toBeEnabled();
  await page
    .locator(".machine-tabs")
    .getByRole("button", { name: "远端测试机器", exact: true })
    .click();
  await expect(page.locator(".workspace-conversation-choice")).toHaveCount(1);
  await expect(page.locator(".workspace-conversation-reading")).toContainText(
    "选择或新建一个会话",
  );
  await expect(
    page.getByRole("textbox", { name: "继续会话", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "发送", exact: true }),
  ).toHaveCount(0);
  await capture(
    "06-filter-hidden-selection",
    "机器筛选排除原选择时，阅读区与续问框一并清空",
  );
  await check(
    "Machine filtering hides an out-of-scope selected conversation and removes its composer",
  );

  await fresh();
  if (!process.argv.includes("--skip-menu")) {
    const summaryA = page.locator(
      'summary[aria-label="本机测试机器 / 原节点 A 的更多操作"]',
    );
    const summaryB = page.locator(
      'summary[aria-label="本机测试机器 / 独立节点 B 的更多操作"]',
    );
    await summaryA.click();
    await expect(page.locator("details.inventory-menu[open]")).toHaveCount(1);
    await summaryA.press("Escape");
    await expect(page.locator("details.inventory-menu[open]")).toHaveCount(0);
    await expect(summaryA).toBeFocused();
    await summaryA.click();
    await page
      .getByRole("heading", { name: "机器与 Agent", exact: true })
      .click();
    await expect(page.locator("details.inventory-menu[open]")).toHaveCount(0);
    await summaryA.click();
    // The open popup covers the next row's pointer target. Keyboard activation
    // tests native toggle mutual exclusion without forcing a click through it.
    await summaryB.focus();
    await summaryB.press("Enter");
    await expect(page.locator("details.inventory-menu[open]")).toHaveCount(1);
    await expect(summaryB.locator("..")).toHaveAttribute("open", "");
    await summaryB
      .locator("..")
      .getByRole("button", { name: "移除 Agent", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "移除 Agent", exact: true }),
    ).toBeVisible();
    await expect(page.locator("details.inventory-menu[open]")).toHaveCount(0);
    await page
      .getByRole("button", { name: "关闭节点操作确认", exact: true })
      .click();
    await check(
      "Menus restore summary focus on Escape, dismiss outside, allow one open menu and close before removal confirmation",
    );
  }

  const machineSearch = page.getByRole("searchbox", {
    name: "搜索机器与 Agent",
    exact: true,
  });
  await machineSearch.fill("没有这台机器");
  await page.getByRole("button", { name: "清空机器搜索", exact: true }).click();
  await expect(machineSearch).toBeFocused();
  await expect(machineSearch).toHaveValue("");
  await machineSearch.fill("再次过滤");
  await machineSearch.press("Escape");
  await expect(machineSearch).toHaveValue("");
  await expect(machineSearch).toBeFocused();
  await navigate("会话");
  const conversationSearch = page.getByRole("searchbox", {
    name: "搜索会话",
    exact: true,
  });
  await conversationSearch.fill("没有这条会话");
  await page.getByRole("button", { name: "清空搜索会话", exact: true }).click();
  await expect(conversationSearch).toBeFocused();
  await conversationSearch.fill("再次过滤");
  await conversationSearch.press("Escape");
  await expect(conversationSearch).toHaveValue("");
  await expect(conversationSearch).toBeFocused();
  await check(
    "Machine and conversation search clear buttons restore input focus; Escape clears without losing focus",
  );

  await fresh({ longNames: true });
  await geometry("Long unbroken machine/node names at 1280×860");
  await page.setViewportSize({ width: 980, height: 660 });
  await geometry("Long unbroken machine/node names at 980×660");
  await capture(
    "07-long-names-minimum",
    "980×660长无空格机器与节点名，无页面/卡片横向溢出",
  );
  await check(
    "Long unbroken machine/node names keep page and cards within both desktop widths",
  );

  await fresh({}, { width: 980, height: 660 });
  await navigate("会话");
  await selectConversation("会话 B");
  await page
    .getByRole("textbox", { name: "继续会话", exact: true })
    .fill("仅检查最小窗口按钮，不发送");
  const send = page.getByRole("button", { name: "发送", exact: true });
  await expect(send).toBeEnabled();
  const bounds = await send.boundingBox();
  assert.ok(
    bounds &&
      bounds.x >= 0 &&
      bounds.y >= 0 &&
      bounds.x + bounds.width <= 981 &&
      bounds.y + bounds.height <= 661,
    "Send action must remain inside the minimum desktop viewport",
  );
  report.geometry.push({
    label: "Minimum viewport conversation send action",
    viewport: page.viewportSize(),
    bounds,
  });
  await capture(
    "08-conversation-send-minimum",
    "980×660会话发送操作保持在可见窗口内",
  );
  await check(
    "Conversation composer send action is inside the 980×660 viewport",
  );

  await collectCalls();
  assert.deepEqual(report.pageErrors, []);
  report.status = "passed";
  report.completedAt = new Date().toISOString();
  save();
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      screenshots: report.screenshots.length,
      businessAttempts: report.businessAttempts,
      modelCalls: report.modelCalls,
      output: out,
      browser: report.browserVersion,
    }),
  );
})()
  .catch(async (error) => {
    report.status = "failed";
    report.error = String(error.stack || error);
    try {
      if (page && !page.isClosed())
        report.failureState = await page.evaluate(() => ({
          activeElement: document.activeElement?.outerHTML.slice(0, 500),
          menus: Array.from(
            document.querySelectorAll("details.inventory-menu"),
          ).map((menu) => ({
            label: menu.querySelector("summary")?.getAttribute("aria-label"),
            open: menu.open,
          })),
        }));
    } catch {}
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
      await collectCalls();
    } catch (error) {
      report.status = "failed";
      report.finalCheckError = error.message;
      process.exitCode = 1;
    }
    await context?.close();
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (frozen) fs.rmSync(frozen, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(
      path.join(out, "calls.json"),
      JSON.stringify(everyCall, null, 2) + "\n",
    );
    save();
  });
