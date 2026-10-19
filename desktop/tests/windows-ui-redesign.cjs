// Windows Edge / production renderer + disposable Coordinator / model calls 0.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium, expect } = require("../node_modules/@playwright/test");
const { startPreview } = require("../scripts/preview-ui.cjs");

const outputArg = process.argv.indexOf("--output");
const outputDirectory =
  outputArg >= 0
    ? process.argv[outputArg + 1]
    : process.env.AGENTBRIDGE_UI_REPORT_DIR;
const out = outputDirectory
  ? path.resolve(outputDirectory)
  : path.resolve(__dirname, "../../artifacts/ui-redesign/2026-10-18/initial");
const captureOnly = process.argv.includes("--capture-only");
const report = {
  date: new Date().toISOString(),
  version: require("../package.json").version,
  environment:
    "Windows Node / Edge / production renderer and isolated Coordinator; synthetic task history",
  status: "running",
  modelCalls: 0,
  checks: [],
  steps: [],
  errors: [],
};
let preview, browser, page;
function save() {
  fs.writeFileSync(
    path.join(out, "ui.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
async function click(locator) {
  await locator.ariaSnapshot();
  await locator.click();
}
async function capture(name, description) {
  await expect(page.locator(".workbench")).toBeVisible();
  const file = name + ".png";
  await page.screenshot({ path: path.join(out, file), animations: "disabled" });
  const viewport = page.viewportSize();
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth > innerWidth + 1,
    content:
      document.querySelector(".content").scrollWidth >
      document.querySelector(".content").clientWidth + 1,
  }));
  report.steps.push({ file, description, viewport, overflow });
  save();
}
async function navigate(label) {
  await click(page.getByRole("button", { name: label, exact: true }));
  await expect(
    page.getByRole("heading", { name: label, exact: true }),
  ).toBeVisible();
}
function check(message) {
  report.checks.push(message);
  save();
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  preview = await startPreview({ port: 0 });
  browser = await chromium.launch({
    executablePath:
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true,
  });
  report.browserVersion = browser.version();
  report.nodeVersion = process.version;
  page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.goto(preview.url);
  await expect(page.locator(".inventory-node")).toHaveCount(3);
  await expect(page.locator(".inventory-start").first()).toBeEnabled();
  await capture("01-machines", "机器概览：机器分组、工具、角色、状态与操作");
  await click(page.getByRole("button", { name: "关系图", exact: true }));
  await expect(page.locator(".agent-graph-panel")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "自动整理", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".graph-view-tools")).toContainText("布局已保存");
  await capture("02-graph", "关系图：保留原机器分组、授权与独立布局");
  await navigate("任务看板");
  await expect(page.locator(".workspace-task")).toHaveCount(4);
  await capture("03-tasks", "任务看板：运行、待核对、成功与失败分列");
  await navigate("会话");
  await click(
    page
      .locator(".workspace-conversation-choice")
      .filter({ hasText: "为协作工作流补充验收记录" }),
  );
  await expect(page.locator(".workspace-answer-text")).toContainText(
    "验收记录包含",
  );
  await capture(
    "04-conversation",
    "会话：双栏列表、原轮次回答、来源与续问原因",
  );
  await navigate("设置");
  await capture("05-settings", "设置：外观、连接、生命周期与原操作恢复分组");
  await navigate("小队协作");
  await expect(
    page.getByRole("button", { name: "接入第一个智能体", exact: true }),
  ).toBeVisible();
  await capture("06-team-start", "小队：页内导航、首次接入与工作空间");
  await click(page.getByRole("button", { name: "智能体", exact: true }));
  await capture("07-team-agent", "小队：智能体接入表单");
  await navigate("设置");
  await page.getByLabel("主题", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await navigate("机器与 Agent");
  await click(page.getByRole("button", { name: "概览", exact: true }));
  await capture("08-machines-dark", "深色机器概览");
  await navigate("会话");
  await capture("09-conversation-dark", "深色会话阅读");
  await navigate("设置");
  await page.getByLabel("主题", { exact: true }).selectOption("light");
  await page.setViewportSize({ width: 980, height: 660 });
  await navigate("机器与 Agent");
  await capture("10-machines-minimum", "980×660最小桌面窗口：图标侧栏与概览");
  await navigate("会话");
  await capture("11-conversation-minimum", "980×660最小桌面窗口：双栏阅读");
  await navigate("设置");
  await capture("12-settings-minimum", "980×660最小桌面窗口：设置滚动");
  check(
    "Five production pages, relation graph, agent form, light/dark and minimum desktop window captured",
  );
  if (!captureOnly) {
    await page.setViewportSize({ width: 1440, height: 960 });
    await navigate("机器与 Agent");
    await page
      .getByRole("searchbox", { name: "搜索机器与 Agent" })
      .fill("不存在的机器");
    await expect(
      page.getByText("没有匹配的机器或 Agent", { exact: true }),
    ).toBeVisible();
    await click(
      page.getByRole("button", { name: "清空机器搜索", exact: true }),
    );
    await expect(page.locator(".inventory-node")).toHaveCount(3);
    await click(page.getByRole("button", { name: "收起侧栏", exact: true }));
    await expect(page.locator(".workbench")).toHaveClass(/sidebar-collapsed/);
    await page.reload();
    await expect(page.locator(".workbench")).toHaveClass(/sidebar-collapsed/);
    await click(page.getByRole("button", { name: "展开侧栏", exact: true }));
    check(
      "Machine search and empty state work; sidebar preference survives reload and remains operable",
    );
    await click(page.getByRole("button", { name: "关系图", exact: true }));
    const leader = preview.fixture.nodes.find(
      (node) => node.adapter === "claude",
    );
    const card = page
      .locator(".react-flow__node")
      .filter({ has: page.locator(`[data-id="${leader.nodeId}"]`) });
    const tool = page.locator(`.react-flow__node[data-id="${leader.nodeId}"]`);
    await click(
      tool.getByRole("button", { name: "设为主 Agent", exact: true }),
    );
    await expect(
      page.getByRole("button", { name: "保存授权", exact: true }),
    ).toBeEnabled();
    await click(page.getByRole("button", { name: "概览", exact: true }));
    await navigate("任务看板");
    await navigate("机器与 Agent");
    await click(page.getByRole("button", { name: "关系图", exact: true }));
    await expect(tool).toContainText("主 Agent");
    await expect(
      page.getByRole("button", { name: "保存授权", exact: true }),
    ).toBeEnabled();
    await preview.fixture.inject("lose-relation");
    await preview.fixture.inject("hide-receipt");
    await click(page.getByRole("button", { name: "保存授权", exact: true }));
    await expect(
      page.getByRole("button", { name: "查询原授权保存", exact: true }),
    ).toBeVisible();
    const writes = preview.fixture.calls.filter(
      (call) => call.method === "saveCollaboration",
    ).length;
    await click(page.getByRole("button", { name: "概览", exact: true }));
    for (const button of await page.locator(".inventory-start").all())
      await expect(button).toBeDisabled();
    await navigate("会话");
    await click(page.getByRole("button", { name: "新建会话", exact: true }));
    await expect(
      page.getByRole("dialog", { name: "新建会话", exact: true }),
    ).toHaveCount(0);
    await navigate("机器与 Agent");
    await click(page.getByRole("button", { name: "关系图", exact: true }));
    await preview.fixture.inject("show-receipt");
    await click(
      page.getByRole("button", { name: "查询原授权保存", exact: true }),
    );
    await expect(
      page.getByRole("button", { name: "查询原授权保存", exact: true }),
    ).toHaveCount(0);
    assert.equal(
      preview.fixture.calls.filter(
        (call) => call.method === "saveCollaboration",
      ).length,
      writes,
    );
    check(
      "Graph draft survives view/page switches; lost authorization ACK blocks overview/new conversation and recovers original receipt without replay",
    );
    await navigate("任务看板");
    await page.getByRole("searchbox", { name: "搜索任务" }).fill("Linux");
    await expect(page.locator(".workspace-task")).toHaveCount(1);
    await click(
      page.getByRole("button", { name: "清空搜索任务", exact: true }),
    );
    await expect(page.locator(".workspace-task")).toHaveCount(4);
    await click(
      page
        .locator(".workspace-task")
        .filter({ hasText: "为协作工作流补充验收记录" }),
    );
    await expect(page.getByRole("dialog", { name: "任务详情" })).toBeVisible();
    await click(
      page.getByRole("button", { name: "关闭任务详情", exact: true }),
    );
    check(
      "Task search filters original records; original task details open and close",
    );
    await navigate("设置");
    await page.getByLabel("主题", { exact: true }).selectOption("system");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await click(
      page.getByRole("button", { name: "停止后台并退出", exact: true }),
    );
    await expect(
      page.getByRole("dialog", { name: "停止后台", exact: true }),
    ).toBeVisible();
    await click(page.getByRole("button", { name: "继续使用", exact: true }));
    await expect(
      page.getByRole("dialog", { name: "停止后台", exact: true }),
    ).toHaveCount(0);
    check(
      "System theme follows live OS changes; stop background opens explicit confirmation and can be cancelled",
    );
    assert.equal(
      preview.fixture.calls.filter(
        (call) =>
          call.method === "nodeRequest" || call.method === "team.execute",
      ).length,
      0,
    );
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
  save();
  console.log(
    JSON.stringify({
      status: report.status,
      checks: report.checks.length,
      screenshots: report.steps.length,
      browser: report.browserVersion,
    }),
  );
})()
  .catch(async (error) => {
    report.status = "failed";
    report.failure = error.message;
    try {
      if (page) await page.screenshot({ path: path.join(out, "failure.png") });
    } catch {}
    save();
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    await preview?.close();
  });
