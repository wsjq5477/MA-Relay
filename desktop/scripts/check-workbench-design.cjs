// Production renderer + disposable Coordinator. Synthetic history; no native/model execution.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium, expect } = require("../node_modules/@playwright/test");
const { startPreview } = require("./preview-ui.cjs");

const outputIndex = process.argv.indexOf("--output");
if (outputIndex < 0 || !process.argv[outputIndex + 1]) {
  throw new Error(
    "Supply a fresh evidence directory with --output <directory>.",
  );
}
const out = path.resolve(process.argv[outputIndex + 1]);
assert(
  !fs.existsSync(path.join(out, "report.json")),
  "Keep previous evidence; choose a fresh output directory.",
);
const captureOnly = process.argv.includes("--capture-only");
const report = {
  date: new Date().toISOString(),
  version: require("../package.json").version,
  environment:
    "Windows / Edge / production renderer / disposable Coordinator / synthetic history",
  status: "running",
  modelCalls: 0,
  checks: [],
  contrast: [],
  fonts: [],
  externalRequests: [],
  screenshots: [],
  pageErrors: [],
};
let preview, browser, page;

async function navigate(label) {
  await page
    .locator(".sidebar")
    .getByRole("button", { name: label, exact: true })
    .click();
}

async function capture(name) {
  await expect(page.locator(".workbench")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const overflow = await page.evaluate(() => {
    const content = document.querySelector(".main > .content");
    return {
      document: document.documentElement.scrollWidth > innerWidth + 1,
      content: content.scrollWidth > content.clientWidth + 1,
    };
  });
  assert.deepEqual(
    overflow,
    { document: false, content: false },
    `${name}: horizontal overflow`,
  );
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(out, file), animations: "disabled" });
  report.screenshots.push({ file, viewport: page.viewportSize(), overflow });
}

async function checkContrast(theme) {
  const samples = await page.evaluate(() => {
    function paintedBackground(selector) {
      const layers = [];
      for (
        let element = document.querySelector(selector);
        element;
        element = element.parentElement
      ) {
        layers.unshift(getComputedStyle(element).backgroundColor);
      }
      const result = layers.reduce(
        (background, color) => {
          const channels = color.match(/[\d.]+/g).map(Number);
          const alpha = channels[3] ?? 1;
          return background.map(
            (value, i) => channels[i] * alpha + value * (1 - alpha),
          );
        },
        [255, 255, 255],
      );
      return `rgb(${result.join(", ")})`;
    }
    return [
      ["sidebar brand", ".sidebar .brand strong", ".sidebar"],
      [
        "active navigation",
        ".sidebar .nav-item.active",
        ".sidebar .nav-item.active",
      ],
      ["summary label", ".overview-summary span", ".overview-summary > div"],
      [
        "primary action",
        ".page-heading .btn.primary",
        ".page-heading .btn.primary",
      ],
    ].map(([name, textSelector, backgroundSelector]) => ({
      name,
      color: getComputedStyle(document.querySelector(textSelector)).color,
      background: paintedBackground(backgroundSelector),
    }));
  });
  const luminance = (color) =>
    color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const channel = value / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      })
      .reduce(
        (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
        0,
      );
  for (const sample of samples) {
    const values = [luminance(sample.color), luminance(sample.background)].sort(
      (a, b) => b - a,
    );
    const ratio = (values[0] + 0.05) / (values[1] + 0.05);
    report.contrast.push({ theme, ...sample, ratio: Number(ratio.toFixed(2)) });
    assert(
      ratio >= 4.5,
      `${theme} ${sample.name}: text contrast ${ratio.toFixed(2)} < 4.5`,
    );
  }
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  preview = await startPreview({ port: 0 });
  browser = await chromium.launch({ channel: "msedge", headless: true });
  report.browserVersion = browser.version();
  report.nodeVersion = process.version;
  page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      new URL(request.url()).origin !== new URL(preview.url).origin
    ) {
      report.externalRequests.push(request.url());
    }
  });
  await page.goto(preview.url);
  await expect(page.locator(".inventory-node")).toHaveCount(3);
  await capture("01-machines-light");
  if (!captureOnly) {
    report.fonts = await page.evaluate(() =>
      Array.from(document.fonts, (face) => ({
        family: face.family,
        status: face.status,
      })),
    );
    assert(
      report.fonts.some(
        (face) => face.family === "IBM Plex Sans" && face.status === "loaded",
      ),
      "The bundled IBM Plex Sans must actually load",
    );
    const installation = page.locator(".inventory-node-details").first();
    await installation.locator("summary").click();
    await expect(installation.locator("code")).toBeVisible();
    await capture("19-installation-path");
    report.fonts = await page.evaluate(() =>
      Array.from(document.fonts, (face) => ({
        family: face.family,
        status: face.status,
      })),
    );
    assert(
      report.fonts.some(
        (face) => face.family === "IBM Plex Mono" && face.status === "loaded",
      ),
      "Source paths must load the bundled IBM Plex Mono",
    );
    await installation.locator("summary").click();
  }
  if (!captureOnly) await checkContrast("light");
  await page.getByRole("button", { name: "关系图", exact: true }).click();
  await expect(page.locator(".agent-graph-panel")).toBeVisible();
  await capture("02-graph-light");
  await page.getByRole("button", { name: "概览", exact: true }).click();
  await navigate("执行审计");
  await expect(page.locator(".workspace-task")).toHaveCount(4);
  await capture("03-audit-light");
  await navigate("会话审计");
  await page
    .locator(".workspace-conversation-choice")
    .filter({ hasText: "为协作工作流补充验收记录" })
    .click();
  await expect(page.locator(".workspace-answer-text")).toContainText(
    "验收记录包含",
  );
  await capture("04-conversations-light");
  await navigate("小队设置");
  await capture("05-teams-light");
  await navigate("设置");
  await capture("06-settings-light");
  await page.getByLabel("主题", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await navigate("接入配置");
  await capture("07-machines-dark");
  if (!captureOnly) await checkContrast("dark");
  await navigate("执行审计");
  await capture("08-audit-dark");
  await navigate("会话审计");
  await capture("09-conversations-dark");
  await navigate("设置");
  await page.getByLabel("主题", { exact: true }).selectOption("light");
  await page.setViewportSize({ width: 980, height: 660 });
  for (const [label, file] of [
    ["接入配置", "10-machines-compact"],
    ["执行审计", "11-audit-compact"],
    ["会话审计", "12-conversations-compact"],
    ["小队设置", "13-teams-compact"],
    ["设置", "14-settings-compact"],
  ]) {
    await navigate(label);
    await capture(file);
  }
  report.checks.push(
    "Five pages and graph, light/dark, 1440×960 and 980×660 captured without horizontal overflow",
  );
  if (!captureOnly)
    report.checks.push(
      "Representative brand, active navigation, metric label and primary action text contrast is at least 4.5:1 in both themes",
    );

  if (!captureOnly) {
    await page.setViewportSize({ width: 1440, height: 960 });
    await navigate("接入配置");
    const search = page.getByRole("searchbox", { name: "搜索机器与 Agent" });
    await search.fill("没有这台机器");
    await expect(
      page.getByText("没有匹配的机器或 Agent", { exact: true }),
    ).toBeVisible();
    await capture("15-search-empty");
    await page
      .getByRole("button", { name: "清空机器搜索", exact: true })
      .click();
    await expect(search).toBeFocused();
    await expect(page.locator(".inventory-node")).toHaveCount(3);
    report.checks.push(
      "Search, empty state and clear-to-focus work without changing resource identities",
    );

    await page.getByRole("button", { name: "收起侧栏", exact: true }).click();
    await expect(page.locator(".workbench")).toHaveClass(/sidebar-collapsed/);
    await capture("16-sidebar-collapsed");
    await page.reload();
    await expect(page.locator(".workbench")).toHaveClass(/sidebar-collapsed/);
    await page.getByRole("button", { name: "展开侧栏", exact: true }).click();
    report.checks.push(
      "Sidebar preference survives reload; navigation remains accessible by name",
    );

    await page
      .getByRole("button", { name: "添加 Linux 机器", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture("17-add-machine-dialog");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const configure = page.locator(".inventory-configure").first();
    await configure.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture("18-agent-configuration");
    await page.keyboard.press("Escape");
    await expect(configure).toBeFocused();
    report.checks.push(
      "Machine and native configuration dialogs open, close with Escape, and return native configuration focus",
    );

    assert.equal(await page.locator(".inventory-start").count(), 0);
    await navigate("会话审计");
    assert.equal(await page.locator(".workspace-followup textarea").count(), 0);
    const executionWrites = preview.fixture.calls.filter((call) =>
      ["nodeRequest", "team.execute", "replyPermission", "cancelTask"].includes(
        call.method,
      ),
    );
    assert.equal(executionWrites.length, 0);
    report.checks.push(
      "Configuration/audit remains read-only for execution: no start/follow-up controls or execution requests",
    );
  }
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.externalRequests, []);
  if (!captureOnly)
    report.checks.push(
      "Bundled IBM Plex Sans and path-only IBM Plex Mono load; UI, icons and fonts make no external HTTP requests",
    );
  report.status = "passed";
})()
  .catch(async (error) => {
    report.status = "failed";
    report.error = error.stack;
    process.exitCode = 1;
    try {
      await page?.screenshot({ path: path.join(out, "failure.png") });
    } catch {}
  })
  .finally(async () => {
    await browser?.close();
    await preview?.close();
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));
  });
