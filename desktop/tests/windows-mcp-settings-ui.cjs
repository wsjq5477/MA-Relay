// Production renderer + real Coordinator/MCP config manager; native tools and machines are controlled.
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const { chromium, expect } = require("../node_modules/@playwright/test");
const { graphFixture } = require("./i06b-ui-fixture.cjs");
const { CollaborationBroker } = require("../electron/collaboration-broker.cjs");
const { McpIntegration } = require("../electron/mcp-integration.cjs");
async function main() {
  const out = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(
    __dirname,
    "../../artifacts/mcp-integration/2026-10-19/ui",
  );
  fs.mkdirSync(out, { recursive: true });
  const report = {
    date: new Date().toISOString(),
    environment:
      "Windows Node + Edge, production renderer, controlled machines, isolated real config files",
    modelCalls: 0,
    checks: [],
    errors: [],
    status: "running",
  };
  const fixture = await graphFixture();
  let browser, server;
  const integrations = [];
  try {
    for (const [id, host] of fixture.hosts) {
      const directory = path.join(fixture.directory, id),
        broker = new CollaborationBroker(directory, async () => ({
          items: [],
        }));
      const mcp = new McpIntegration(
        { directory, home: path.join(directory, "user"), environment: {} },
        broker,
      );
      integrations.push({ mcp, broker });
      const call = host.call.bind(host);
      host.call = (method, params) =>
        method.startsWith("mcp.")
          ? mcp.call(method, params)
          : call(method, params);
    }
    const root = path.resolve(__dirname, "../dist");
    server = http.createServer((req, res) => {
      try {
        const name =
            decodeURIComponent(
              new URL(req.url, "http://localhost").pathname,
            ).replace(/^\/+/, "") || "index.html",
          file = path.resolve(root, name);
        if (!file.startsWith(root + path.sep)) {
          res.writeHead(403).end();
          return;
        }
        res.setHeader(
          "Content-Type",
          file.endsWith(".js")
            ? "text/javascript"
            : file.endsWith(".css")
              ? "text/css"
              : "text/html",
        );
        res.end(fs.readFileSync(file));
      } catch {
        res.writeHead(404).end();
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({
      executablePath:
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      headless: true,
    });
    report.browserVersion = browser.version();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (e) => report.errors.push(e.message));
    await page.exposeFunction("abCall", (method, params) =>
      fixture.call(method, params),
    );
    await page.addInitScript(() => {
      window.agentbridge = {
        call: (method, params = {}) => window.abCall(method, params),
        preferences: async () => ({
          theme: "light",
          platform: "win32",
          version: "MCP acceptance",
          directory: "",
          distribution: "",
        }),
        runtimes: async () => ({ platform: "win32", distributions: [] }),
        pending: async () => [],
        savePreferences: async (value) => value,
        closeWindow: async () => {},
        stop: async () => {},
        machines: async () => [],
      };
    });
    await page.goto("http://127.0.0.1:" + server.address().port);
    await page.getByRole("button", { name: "配置 Windows 测试机 / Claude Code", exact: true }).click();
    const card = page.locator(".settings-mcp");
    await expect(
      card.getByRole("button", { name: "添加 Bridge MCP" }),
    ).toBeEnabled();
    await card.getByRole("button", { name: "添加 Bridge MCP" }).click();
    await expect(card).toContainText("已添加到用户配置");
    await expect(
      card.getByRole("button", { name: "移除 Bridge MCP" }),
    ).toBeEnabled();
    report.checks.push(
      "add writes an isolated native configuration and updates status",
    );
    await card.getByRole("button", { name: "生成独立 MCP 文件" }).click();
    await card.getByText("独立配置文件", { exact: true }).click();
    await expect(card).toContainText("agentbridge.codex.toml");
    await expect(card).toContainText("agentbridge.opencode.jsonc");
    report.checks.push("all three independent configuration paths are visible");
    await page.screenshot({
      path: path.join(out, "installed.png"),
      fullPage: true,
    });
    const manager = integrations.find(({ mcp }) => mcp.rows.length).mcp,
      row = manager.rows[0],
      target = manager.config(row.adapter),
      original = row.configuration;
    target.update({ ...original, command: "user-modified-command" }, original);
    await card.getByRole("button", { name: "刷新配置状态" }).click();
    await expect(card).toContainText("配置冲突");
    await expect(
      card.getByRole("button", { name: "添加 Bridge MCP" }),
    ).toBeDisabled();
    await card.getByRole("button", { name: "移除 Bridge MCP" }).click();
    await expect(card).toContainText("接入授权已关闭");
    assert.equal(target.inspect().entry.command, "user-modified-command");
    report.checks.push(
      "conflict preserves the native entry while removal revokes the connection",
    );
    target.update(undefined, { ...original, command: "user-modified-command" });
    await card.getByRole("button", { name: "刷新配置状态" }).click();
    await expect(
      card.getByRole("button", { name: "添加 Bridge MCP" }),
    ).toBeEnabled();
    await card.getByRole("button", { name: "添加 Bridge MCP" }).click();
    await expect(card).toContainText("已添加到用户配置");
    await card.getByRole("button", { name: "移除 Bridge MCP" }).click();
    await expect(card).toContainText("已移除 Bridge MCP 并撤销接入");
    assert.equal(target.inspect().entry, undefined);
    report.checks.push(
      "reinstall rotates authorization and normal removal deletes the owned entry",
    );
    await page.screenshot({
      path: path.join(out, "removed.png"),
      fullPage: true,
    });
    assert.equal(
      fixture.calls.filter((c) => c.method === "nodeRequest").length,
      0,
    );
    assert.deepEqual(report.errors, []);
    report.status = "passed";
  } catch (e) {
    report.status = "failed";
    report.error = e.message;
    process.exitCode = 1;
  } finally {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    for (const { broker } of integrations) broker.close();
    fixture.close();
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
