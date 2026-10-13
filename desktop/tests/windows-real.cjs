const { _electron, expect } = require("@playwright/test");
const fs = require("node:fs"),
  path = require("node:path");
const [exe, profile, workspace, marker, stageFile] = process.argv.slice(2);
const output = path.resolve(__dirname, "../../artifacts");
const report = {
  date: new Date().toISOString(),
  platform: process.platform,
  status: "running",
  checks: {},
  errors: [],
  tasks: [],
};
let app, page;
const stage = (value) => {
  const temporary = stageFile + "." + process.pid + ".tmp";
  fs.writeFileSync(temporary, JSON.stringify({ stage: value }));
  fs.renameSync(temporary, stageFile);
};
const call = (op, params = {}) =>
  page.evaluate(
    async ({ op, params }) => {
      const r = await window.agentbridge.call("ipc", { op, ...params });
      if (!r.ok) throw new Error(r.error.message);
      return r.result;
    },
    { op, params },
  );
async function tasks() {
  return (await call("tasks")).items;
}
async function until(fn, timeout = 120000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Windows real acceptance timed out");
}
async function terminal(id) {
  return until(async () => {
    const t = await call("task", { taskId: id });
    return ["succeeded", "failed", "cancelled"].includes(t.status) ? t : false;
  });
}
async function submit(message) {
  await page.getByRole("button", { name: "总览", exact: true }).click();
  await page
    .getByRole("button", { name: "新建任务", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "任务需求", exact: true })
    .fill(message);
  await page.getByRole("button", { name: "提交任务", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "任务详情" })).toBeVisible();
  return (await tasks()).at(-1);
}
async function launch(configured = true) {
  const env = { ...process.env, AGENTBRIDGE_DESKTOP_PROFILE: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await _electron.launch({ executablePath: exe, env, timeout: 60000 });
  page = await app.firstWindow();
  page.on("pageerror", (e) => report.errors.push(e.message));
  if (configured)
    await expect(page.locator(".connection-dot.online")).toBeVisible({
      timeout: 60000,
    });
}
(async () => {
  await launch(false);
  await expect(page.locator(".welcome-card")).toBeVisible({ timeout: 30000 });
  await page
    .getByRole("button", { name: "发现并连接 Agent", exact: true })
    .click();
  const connect = page.getByRole("dialog", { name: "发现并连接 Agent" });
  await expect(connect.locator("input[type=checkbox]")).toHaveCount(1, {
    timeout: 30000,
  });
  await connect.locator("input[type=checkbox]").focus();
  await page.keyboard.press("Space");
  await expect(connect.locator("input[type=checkbox]")).toBeChecked();
  await connect.getByRole("textbox", { name: "工作项目" }).fill(workspace);
  await connect
    .getByRole("button", { name: "连接 OpenCode", exact: true })
    .click();
  await expect(connect).toBeHidden({ timeout: 60000 });
  await expect(page.locator(".connection-dot.online")).toBeVisible({
    timeout: 60000,
  });
  const agents = (await call("agents")).items;
  report.agentId = agents[0].agentId;
  report.checks.discoveryAndSpaceSelection = true;
  report.checks.initialConnectionPrompts = (await tasks()).length;
  stage("connected");
  await until(async () => {
    const a = (await call("agents")).items[0];
    return (
      a.selectedModel?.providerID === "csi-provider" &&
      a.selectedModel?.id === "DeepSeek-V4.1-Flash"
    );
  }, 60000);
  const first = await submit("记住值 " + marker + "，只回复此值，不调用工具。");
  const done = await terminal(first.taskId);
  expect(done.status).toBe("succeeded");
  expect(done.result.message).toContain(marker);
  report.tasks.push(done);
  await expect(page.locator(".task-drawer")).toContainText(marker, {
    timeout: 10000,
  });
  await page
    .getByRole("button", { name: "进入会话 / 继续追问", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "继续追问", exact: true })
    .fill("只回复上轮记住的值加 :SECOND，不调用工具。");
  await page.waitForTimeout(2600); // Polling must not reset focus or draft text.
  await expect(page.getByRole("textbox", { name: "继续追问" })).toHaveValue(
    "只回复上轮记住的值加 :SECOND，不调用工具。",
  );
  await page.getByRole("button", { name: "发送追问", exact: true }).click();
  const second = await until(async () => {
    const rows = await tasks();
    return rows.length === 2 ? rows.at(-1) : false;
  });
  const next = await terminal(second.taskId);
  expect(next.status).toBe("succeeded");
  expect(next.native.sessionId).toBe(done.native.sessionId);
  expect(next.result.message.trim()).toBe(marker + ":SECOND");
  report.tasks.push(next);
  await page
    .getByRole("button", { name: "进入会话 / 继续追问", exact: true })
    .click();
  await expect(page.locator(".turn")).toHaveCount(2);
  await page.screenshot({
    path: path.join(output, "I04-windows-real-conversation.png"),
  });
  report.checks.twoRealTurnsSameSession = true;
  await app.close();
  app = null;
  await launch();
  await page.getByRole("button", { name: "会话", exact: true }).click();
  await page.locator(".conversation-choice").first().click();
  await expect(page.locator(".turn")).toHaveCount(2);
  expect((await tasks()).length).toBe(2);
  report.checks.reentryRetainsHistory = true;
  const edit = await submit(
    "读取 src/calculator.js，用 edit 工具把 multiply 函数中的 return a + b 改为 return a * b。add 函数保持原样。不使用 shell，不绕过权限。完成后只回复“乘法已修复”。",
  );
  await until(async () =>
    Boolean((await call("task", { taskId: edit.taskId })).waiting),
  );
  await expect(
    page.getByRole("button", { name: "仅允许本次", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await page.screenshot({
    path: path.join(output, "I04-windows-real-permission.png"),
  });
  await page.getByRole("button", { name: "仅允许本次", exact: true }).click();
  const edited = await terminal(edit.taskId);
  expect(edited.status).toBe("succeeded");
  report.tasks.push(edited);
  report.checks.realPermissionApproved = true;
  await page.getByRole("button", { name: "关闭任务详情", exact: true }).click();
  const cancel = await submit(
    "读取 src/calculator.js，只用 edit 工具在文件末尾追加 // I04 cancel proof。不使用 shell，不绕过权限。",
  );
  await until(async () =>
    Boolean((await call("task", { taskId: cancel.taskId })).waiting),
  );
  await expect(
    page.getByRole("button", { name: "仅允许本次", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "取消本轮", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "取消当前轮次？" }),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "任务详情" })).toBeVisible();
  await page.getByRole("button", { name: "取消本轮", exact: true }).click();
  await page.getByRole("button", { name: "确认取消本轮", exact: true }).click();
  const cancelled = await terminal(cancel.taskId);
  expect(cancelled.status).toBe("cancelled");
  report.tasks.push(cancelled);
  report.checks.realWaitingCancelled = true;
  await page.getByRole("button", { name: "关闭任务详情", exact: true }).click();
  await page.getByRole("button", { name: "任务看板", exact: true }).click();
  await expect(page.locator(".task-card")).toHaveCount(4);
  await page.screenshot({
    path: path.join(output, "I04-windows-real-board.png"),
  });
  report.checks.boardShowsRealResults = true;
  report.checks.topmostDialogEscape = true;
  report.journal = await page.evaluate(() => window.agentbridge.pending());
  expect(report.journal).toHaveLength(0);
  await page.getByRole("button", { name: "Agent 连接", exact: true }).click();
  stage("latency");
  for (let i = 0; i < 20; i++) {
    const name = "I04_OBSERVE_" + i;
    await expect(page.locator(".agent-card h2")).toContainText(name, {
      timeout: 10000,
    });
    const observedAt = Date.now();
    stage("observed:" + i + ":" + observedAt);
    await until(
      () => JSON.parse(fs.readFileSync(stageFile, "utf8")).stage === "ack:" + i,
      15000,
    );
  }
  expect(report.errors).toHaveLength(0);
  report.checks.rendererErrors = 0;
  report.status = "passed";
  stage("finished");
})()
  .catch(async (e) => {
    report.status = "failed";
    report.error = e.stack;
    process.exitCode = 1;
    if (page) {
      report.body = await page
        .locator("body")
        .innerText()
        .catch(() => "<window closed>");
      await page
        .screenshot({ path: path.join(output, "I04-windows-real-failed.png") })
        .catch(() => {});
    }
    stage("failed");
  })
  .finally(async () => {
    if (app) await app.close();
    fs.writeFileSync(
      path.join(output, "I04-windows-real.json"),
      JSON.stringify(report, null, 2),
    );
    console.log("Windows real acceptance: " + report.status);
  });
