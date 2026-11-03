// Production renderer + real isolated MCP stores; native probes are controlled.
// Visual ready state is a separate synthetic native-client facts contract.
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const { chromium, expect } = require("../node_modules/@playwright/test");
const { graphFixture } = require("../tests/i06b-ui-fixture.cjs");
const { CollaborationBroker } = require("../electron/collaboration-broker.cjs");
const { McpIntegration } = require("../electron/mcp-integration.cjs");
const out = path.resolve(
  process.argv[2] || "artifacts/mcp-config-ui/2026-11-03/browser",
);
assert(
  !fs.existsSync(path.join(out, "report.json")),
  "Use a fresh evidence directory",
);
fs.mkdirSync(out, { recursive: true });
const report = {
  date: new Date().toISOString(),
  version: require("../package.json").version,
  environment:
    "Windows / non-C Chrome / production React / controlled machines and native probes / real isolated Coordinator-MCP stores",
  status: "running",
  modelCalls: 0,
  checks: [],
  screenshots: [],
  pageErrors: [],
  externalRequests: [],
};
let fixture, server, browser, page, projection, releaseProbe;
let pauseProbe = false;
const managers = [];
const root = path.resolve(__dirname, "../dist");
async function shot(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, name + ".png") });
  report.screenshots.push(name + ".png");
}
async function compare(state) {
  const implementation = path.join(out, `visual-${state}-modal.png`);
  await dialog().screenshot({ path: implementation });
  const reference = path.resolve(
    __dirname,
    "../../todo",
    state === "ready"
      ? "AgentBridge_Claude_Code_已连接参考图.png"
      : "AgentBridge_Claude_Code_简洁版参考图.png",
  );
  const proof = await browser.newPage({
    viewport: { width: 1400, height: 700 },
    deviceScaleFactor: 1,
  });
  const source =
      "data:image/png;base64," + fs.readFileSync(reference).toString("base64"),
    actual =
      "data:image/png;base64," +
      fs.readFileSync(implementation).toString("base64");
  await proof.setContent(
    `<style>body{margin:0;padding:16px;font:14px system-ui;background:#edf0f3;display:flex;gap:24px}.pane{width:672px;flex-shrink:0}.label{margin-bottom:12px}.crop{width:672px;height:592px;overflow:hidden;position:relative}.crop img{position:absolute;width:1440px;height:900px;left:-384px;top:-154px}.actual{width:672px;display:block}</style><div class="pane"><div class="label">参考：${state}</div><div class="crop"><img src="${source}"></div></div><div class="pane"><div class="label">生产组件：${state}（受控状态）</div><img class="actual" src="${actual}"></div>`,
  );
  await proof.screenshot({ path: path.join(out, `comparison-${state}.png`) });
  await proof.close();
  report.screenshots.push(
    `visual-${state}-modal.png`,
    `comparison-${state}.png`,
  );
}
const dialog = () =>
  page.getByRole("dialog", { name: "Claude Code 配置", exact: true });
const card = () => dialog().locator(".mcp-connection");
const more = () =>
  card().getByRole("button", { name: "更多操作", exact: true });
async function item(label) {
  await more().click();
  await card().getByRole("menuitem", { name: label, exact: true }).click();
}
async function open() {
  await page
    .getByRole("button", {
      name: "配置 Windows 测试机 / Claude Code",
      exact: true,
    })
    .click();
  await expect(dialog()).toBeVisible();
  await expect(card().locator(".mcp-primary-action")).toBeEnabled();
}
async function reopen() {
  await dialog()
    .getByRole("button", { name: "关闭 Agent 配置", exact: true })
    .click();
  await open();
}
async function advanced() {
  const details = card().locator(".mcp-advanced");
  if (!(await details.evaluate((e) => e.open)))
    await details.locator(":scope > summary").click();
}
async function diagnostics() {
  await advanced();
  const details = card()
    .locator(".mcp-detail-row")
    .filter({ has: page.locator("summary", { hasText: "故障诊断" }) });
  if (!(await details.evaluate((e) => e.open)))
    await details.locator(":scope > summary").click();
}
async function summary(text) {
  await expect(card().locator(".mcp-summary h3")).toHaveText(text);
}
async function bounds() {
  const value = await dialog().evaluate((e) => {
    const r = e.getBoundingClientRect(),
      f = e.querySelector(".mcp-connection-footer").getBoundingClientRect(),
      body = e.querySelector(".mcp-connection-body");
    return {
      inside:
        r.x >= 0 &&
        r.y >= 0 &&
        r.right <= innerWidth + 1 &&
        r.bottom <= innerHeight + 1,
      footer: f.bottom <= r.bottom + 1 && f.y >= r.y,
      noOverflow: e.scrollWidth <= e.clientWidth + 1,
      scroll: body.scrollHeight > body.clientHeight,
    };
  });
  assert(
    value.inside && value.footer && value.noOverflow,
    JSON.stringify(value),
  );
  return value;
}
function visual(state, extra = {}) {
  const present = state !== "unconfigured";
  return {
    nodeId: "visual-fixture",
    adapter: "claude",
    configPath: "/home/fixture/.claude.json",
    enabled: present,
    installed: present,
    conflict: state === "failed",
    state: state === "failed" ? "conflict" : present ? "installed" : "absent",
    nativeSupport: true,
    facts: {
      config: state === "failed" ? "conflict" : present ? "present" : "absent",
      authorization: present ? "valid" : "unknown",
      nativeLoad: state === "ready" ? "loaded" : "unknown",
      connection: state === "ready" ? "connected" : "unknown",
      tools: state === "ready" ? "available" : "unknown",
      ownership: present ? "bridge" : "unconfirmed",
    },
    evidence: {
      configPath: "/home/fixture/.claude.json",
      nativeProbe: {
        kind: state === "ready" ? "native-list" : "none",
        outcome: state === "ready" ? "connected" : "unknown",
      },
      ...(state === "ready"
        ? {
            observation: {
              freshness: "current",
              observedAt: new Date().toISOString(),
            },
          }
        : {}),
    },
    ...extra,
  };
}
(async () => {
  fixture = await graphFixture();
  assert(
    !path.resolve(fixture.directory).toLowerCase().startsWith("c:"),
    "No C-drive test data",
  );
  for (const [id, host] of fixture.hosts) {
    const directory = path.join(fixture.directory, id),
      broker = new CollaborationBroker(directory, async () => ({ items: [] }));
    const mcp = new McpIntegration(
      { directory, home: path.join(directory, "user"), environment: {} },
      broker,
    );
    mcp.nativeProbe = async () => {
      if (pauseProbe)
        await new Promise((resolve) => {
          releaseProbe = resolve;
        });
      return {
        kind: "native-list",
        outcome: "connected",
        detail: "受控原生列表",
      };
    };
    mcp.toolsProbe = async () => ({ outcome: "available", toolCount: 7 });
    const target = mcp.config("claude");
    fs.mkdirSync(path.dirname(target.file), { recursive: true });
    fs.writeFileSync(
      target.file,
      JSON.stringify({
        mcpServers: { fixtureOther: { command: "fixture-other-server" } },
      }),
    );
    managers.push({ mcp, broker, target });
    const call = host.call.bind(host);
    host.call = (method, params) =>
      method.startsWith("mcp.")
        ? mcp.call(method, params)
        : call(method, params);
  }
  server = http.createServer((req, res) => {
    try {
      const file = path.resolve(
        root,
        decodeURIComponent(
          new URL(req.url, "http://localhost").pathname,
        ).replace(/^\/+/, "") || "index.html",
      );
      if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
      res.setHeader(
        "content-type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".woff2")
              ? "font/woff2"
              : file.endsWith(".png")
                ? "image/png"
                : "text/html",
      );
      res.end(fs.readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  assert(
    process.env.AGENTBRIDGE_TEST_CHROMIUM &&
      !path
        .resolve(process.env.AGENTBRIDGE_TEST_CHROMIUM)
        .toLowerCase()
        .startsWith("c:"),
    "Set a non-C browser",
  );
  browser = await chromium.launch({
    executablePath: process.env.AGENTBRIDGE_TEST_CHROMIUM,
    headless: true,
  });
  report.browserVersion = browser.version();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await context.exposeFunction("abCall", async (method, params) => {
    if (method === "mcp.status" && projection === "error")
      return {
        ok: false,
        error: {
          code: "CONTROLLED_READ",
          message: "受控配置读取失败 token=fixture-private-secret",
        },
      };
    if (method === "mcp.status" && projection === "wrong-source")
      return {
        ok: true,
        result: {
          ...visual("ready"),
          nodeId: "another-node",
          adapter: "codex",
        },
      };
    if (method === "mcp.status" && projection)
      return {
        ok: true,
        result: {
          ...structuredClone(projection),
          nodeId: params.nodeId,
          adapter: params.adapter,
        },
      };
    return fixture.call(method, params);
  });
  await context.addInitScript(() => {
    window.agentbridge = {
      call: (m, p = {}) => window.abCall(m, p),
      preferences: async () => ({
        theme: "light",
        platform: "win32",
        version: "受控接入配置验收",
      }),
      pending: async () => [],
      savePreferences: async (v) => v,
      window: async () => {},
    };
  });
  page = await context.newPage();
  page.on("pageerror", (e) => report.pageErrors.push(e.message));
  const url = "http://127.0.0.1:" + server.address().port;
  page.on("request", (req) => {
    if (/^https?:/.test(req.url()) && new URL(req.url()).origin !== url)
      report.externalRequests.push(req.url());
  });
  await page.goto(url);
  await open();
  await summary("尚未配置 Bridge MCP");
  await expect(card().locator(".mcp-advanced")).not.toHaveAttribute("open", "");
  await expect(
    card().locator(".mcp-connection-footer > button.primary"),
  ).toHaveCount(1);
  await expect(card().locator(".mcp-connection-footer button")).toHaveCount(2);
  await bounds();
  await shot("01-real-unconfigured");
  await card()
    .getByRole("button", { name: "添加 Bridge MCP", exact: true })
    .click();
  await summary("Bridge MCP 已配置，待验证");
  const manager = managers.find((x) => x.mcp.rows.length),
    row = manager.mcp.rows[0],
    target = manager.mcp.config(row.adapter);
  assert(target.inspect().entry);
  assert.equal(
    JSON.parse(fs.readFileSync(target.file)).mcpServers.fixtureOther.command,
    "fixture-other-server",
  );
  await reopen();
  await summary("Bridge MCP 已配置，待验证");
  await shot("02-real-configured");
  await card().getByRole("button", { name: "复制", exact: true }).click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    target.file,
  );
  report.checks.push(
    "Add writes only the original isolated native environment, preserves other MCP entries, stays unverified; path copy returns the actual target path",
  );

  const before = fixture.calls.filter((x) => x.method === "mcp.probe").length;
  await item("重新读取配置");
  await expect(card()).toContainText("未探测原生 Agent");
  assert.equal(
    fixture.calls.filter((x) => x.method === "mcp.probe").length,
    before,
  );
  const exportsBefore = fixture.calls.filter(
    (x) => x.method === "mcp.export",
  ).length;
  page.once("dialog", (d) => d.dismiss());
  await item("导出 MCP 配置");
  assert.equal(
    fixture.calls.filter((x) => x.method === "mcp.export").length,
    exportsBefore,
  );
  page.once("dialog", (d) => d.accept());
  await item("导出 MCP 配置");
  await expect(card().locator(".mcp-exported-files")).toBeVisible();
  const files = manager.mcp.files(row);
  for (const file of Object.values(files)) {
    assert(!file.toLowerCase().startsWith("c:"));
    assert(fs.existsSync(file));
  }
  await reopen();
  pauseProbe = true;
  const probeBefore = fixture.calls.filter(
    (x) => x.method === "mcp.probe",
  ).length;
  await card()
    .getByRole("button", { name: "检测接入状态", exact: true })
    .click();
  await expect(
    card().getByRole("button", { name: "检测中…", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog().getByRole("button", { name: "关闭 Agent 配置", exact: true }),
  ).toBeDisabled();
  await card()
    .locator(".mcp-primary-action")
    .evaluate((e) => {
      e.click();
      e.click();
    });
  await expect.poll(() => !!releaseProbe).toBe(true);
  pauseProbe = false;
  releaseProbe();
  await expect(card()).toContainText("已重新探测原生列表");
  await summary("Bridge MCP 已配置，待验证");
  await expect(
    card().locator(".mcp-status-grid > div").filter({ hasText: "工具可用性" }),
  ).toContainText("未验证");
  assert.equal(
    fixture.calls.filter((x) => x.method === "mcp.probe").length,
    probeBefore + 1,
  );
  report.checks.push(
    "Reload calls only mcp.status; export uses the original files and shows their locations; probe calls mcp.probe but Bridge-side stdio tools never make the summary ready",
  );

  await more().focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    card().getByRole("menuitem", { name: "重新读取配置", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    card().getByRole("menuitem", { name: "移除 Bridge MCP", exact: true }),
  ).toBeFocused();
  const menuBox = await card().getByRole("menu").boundingBox(),
    dialogBox = await dialog().boundingBox();
  assert(
    menuBox.y >= dialogBox.y &&
      menuBox.x >= dialogBox.x &&
      menuBox.x + menuBox.width <= dialogBox.x + dialogBox.width,
  );
  await page.keyboard.press("Escape");
  await expect(card().getByRole("menu")).toHaveCount(0);
  await expect(dialog()).toBeVisible();
  await expect(more()).toBeFocused();
  await more().click();
  await dialog().locator(".modal-head").click();
  await expect(card().getByRole("menu")).toHaveCount(0);
  report.checks.push(
    "More menu starts closed, supports arrows/End/Escape and outside click, stays inside the dialog, and Escape returns focus without closing the dialog",
  );

  await diagnostics();
  const callsBeforeRevoke = fixture.calls.filter(
    (x) => x.method === "mcp.revoke",
  ).length;
  const dangerPaint = await card()
    .getByRole("button", { name: "撤销授权", exact: true })
    .evaluate((e) => ({
      color: getComputedStyle(e).color,
      background: getComputedStyle(e).backgroundColor,
    }));
  assert.notEqual(
    dangerPaint.color,
    dangerPaint.background,
    "Revoke text must not disappear into its button",
  );
  page.once("dialog", (d) => d.dismiss());
  await card().getByRole("button", { name: "撤销授权", exact: true }).click();
  assert.equal(
    fixture.calls.filter((x) => x.method === "mcp.revoke").length,
    callsBeforeRevoke,
  );
  page.once("dialog", (d) => d.accept());
  await card().getByRole("button", { name: "撤销授权", exact: true }).click();
  await summary("接入存在异常");
  assert(target.inspect().entry);
  assert.equal(row.enabled, false);
  const callsBeforeRemove = fixture.calls.filter(
    (x) => x.method === "mcp.remove",
  ).length;
  page.once("dialog", (d) => d.dismiss());
  await item("移除 Bridge MCP");
  assert.equal(
    fixture.calls.filter((x) => x.method === "mcp.remove").length,
    callsBeforeRemove,
  );
  page.once("dialog", (d) => d.accept());
  await item("移除 Bridge MCP");
  await summary("尚未配置 Bridge MCP");
  assert.equal(target.inspect().entry, undefined);
  assert.equal(
    JSON.parse(fs.readFileSync(target.file)).mcpServers.fixtureOther.command,
    "fixture-other-server",
  );
  report.checks.push(
    "Revoke and remove each require their specific confirmation; cancelling dispatches nothing; revocation retains native config, removal cleans only the owned entry and leaves other MCP config",
  );

  await card()
    .getByRole("button", { name: "添加 Bridge MCP", exact: true })
    .click();
  await summary("Bridge MCP 已配置，待验证");
  const newRow = manager.mcp.rows.find((x) => x.nodeId === row.nodeId);
  target.update(
    { ...newRow.configuration, command: "fixture-user-edited-command" },
    newRow.configuration,
  );
  await item("重新读取配置");
  await summary("接入存在异常");
  await more().click();
  await expect(
    card().getByRole("menuitem", { name: "移除 Bridge MCP", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  assert.equal(target.inspect().entry.command, "fixture-user-edited-command");
  report.checks.push(
    "An externally edited entry opens diagnostics, cannot be overwritten or removed from the menu, and keeps its content",
  );

  for (const state of ["unconfigured", "configured", "ready", "failed"]) {
    projection = visual(state);
    await reopen();
    await summary(
      {
        unconfigured: "尚未配置 Bridge MCP",
        configured: "Bridge MCP 已配置，待验证",
        ready: "Bridge MCP 接入正常",
        failed: "接入存在异常",
      }[state],
    );
    await bounds();
    await shot("visual-" + state + "-light-1440");
    if (["configured", "ready"].includes(state)) await compare(state);
  }
  report.checks.push(
    "Four summary/primary-button states render from controlled independent native-client facts; the visual ready fixture is not a real native-tool acceptance",
  );
  projection = visual("ready");
  projection.evidence.observation.observedAt = new Date(
    Date.now() - 59000,
  ).toISOString();
  await reopen();
  await summary("Bridge MCP 接入正常");
  await expect(card().locator(".mcp-summary h3")).toHaveText(
    "Bridge MCP 已配置，待验证",
    { timeout: 4000 },
  );
  report.checks.push(
    "An open ready dialog drops native success on TTL expiry without needing a page reload",
  );

  projection = visual("configured", { nativeProbeSupported: false });
  await reopen();
  await expect(
    card().getByRole("button", { name: "查看验证说明", exact: true }),
  ).toBeVisible();
  await card()
    .getByRole("button", { name: "查看验证说明", exact: true })
    .click();
  await expect(card()).toContainText("该接入器暂不支持自动检测");
  await expect(
    card().getByRole("button", { name: "重新探测原生列表", exact: true }),
  ).toHaveCount(0);
  projection = "error";
  await reopen();
  await expect(card().getByRole("alert")).toContainText("[已隐藏]");
  assert(!(await card().innerText()).includes("fixture-private-secret"));
  await expect(
    card().getByRole("button", { name: "重新读取配置", exact: true }),
  ).toBeEnabled();
  projection = "wrong-source";
  await reopen();
  await expect(card().getByRole("alert")).toContainText("与当前 Agent 不一致");
  await expect(card().locator(".mcp-summary-badge")).not.toHaveText("已连接");
  report.checks.push(
    "Unsupported native detection stays unverified with no probe request; read failures keep a retry/diagnostic path and redact secrets",
  );

  projection = visual("configured");
  await reopen();
  for (const [theme, width, height] of [
    ["dark", 1440, 900],
    ["light", 980, 660],
    ["dark", 980, 660],
    ["light", 390, 844],
    ["dark", 390, 844],
    ["light", 980, 480],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    await bounds();
    await shot(`configured-${theme}-${width}-${height}`);
    if (height === 480) {
      await advanced();
      await diagnostics();
      await bounds();
      await shot("advanced-short-window");
      await reopen();
    }
  }
  await more().focus();
  await page.keyboard.press("Shift+Tab");
  assert(await dialog().evaluate((e) => e.contains(document.activeElement)));
  await page.keyboard.press("Escape");
  await expect(dialog()).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "配置 Windows 测试机 / Claude Code",
      exact: true,
    }),
  ).toBeFocused();
  projection = visual("configured");
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [machine, name] of [
    ["WSL · Ubuntu", "OpenCode"],
    ["Linux 测试服务器", "OpenCode"],
  ]) {
    await page
      .getByRole("button", { name: `配置 ${machine} / ${name}`, exact: true })
      .click();
    const d = page.getByRole("dialog");
    await expect(d.locator(".mcp-config-path")).toContainText(
      "/home/fixture/.claude.json",
    );
    await d
      .getByRole("button", { name: "关闭 Agent 配置", exact: true })
      .click();
  }
  report.checks.push(
    "Light/dark at 1440, 980, 390 and a 480px-high window keep the footer visible and body scrollable; WSL/SSH node identity stays bound; focus traps and restores correctly",
  );
  assert.equal(
    fixture.calls.filter((x) =>
      ["nodeRequest", "team.execute", "cancelTask"].includes(x.method),
    ).length,
    0,
  );
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.externalRequests, []);
  report.checks.push(
    "No model or task execution, external HTTP or renderer exceptions",
  );
  report.status = "passed";
})()
  .catch(async (error) => {
    report.status = "failed";
    report.error = error.stack;
    process.exitCode = 1;
    try {
      await shot("failure");
    } catch {}
  })
  .finally(async () => {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    for (const x of managers) x.broker.close();
    fixture?.close();
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({
        status: report.status,
        checks: report.checks.length,
        screenshots: report.screenshots.length,
        error: report.error?.slice(0, 500),
      }),
    );
  });
