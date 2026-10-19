// Windows Edge + production renderer; all API data is synthetic, model calls 0.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const assert = require("node:assert/strict");
const { chromium, expect } = require("../node_modules/@playwright/test");

const kinds = ["claude", "codex", "opencode", "hermes", "pi", "dsh"];
const output = path.resolve(process.argv[2] || path.join(__dirname, "../../artifacts/agent-support/2026-10-18/icons"));
const report = {
  date: new Date().toISOString(),
  version: require("../package.json").version,
  environment: "Windows Node / Edge / frozen production frontend / six synthetic nodes",
  status: "running", modelCalls: 0, checks: [], screenshots: [], pageErrors: [], externalRequests: [],
};
let frozen, server, browser;

function mockAgentAPI() {
  const kinds = ["claude", "codex", "opencode", "hermes", "pi", "dsh"];
  const names = ["Claude Code", "Codex", "OpenCode", "Hermes", "Pi", "DSH"];
  const machines = [{ machineId: "machine-icons", name: "Agent 图标验收机器", kind: "linux", platform: "linux", online: true }];
  const nodes = kinds.map((adapter, index) => ({
    nodeId: `node-${adapter}`, machineId: machines[0].machineId, adapter, name: names[index],
    executable: `/fixture/${adapter}`, version: "icon-fixture", connected: true, online: true,
    healthy: true, busy: false, available: true, executionSupported: true, activeTasks: 0, status: "connected",
  }));
  const relation = { leaderId: nodes[0].nodeId, memberIds: nodes.slice(1).map((node) => node.nodeId), revision: 1 };
  const layout = {
    version: 1, layoutRevision: 1,
    groups: { "machine-icons": { x: 0, y: 0 } },
    nodes: Object.fromEntries(nodes.map((node, index) => [node.nodeId, { x: 40, y: 130 + index * 155 }])),
    viewport: { x: 200, y: 10, zoom: 0.5 },
  };
  localStorage.setItem("agentbridge.graph.icon-fixture", JSON.stringify({
    base: relation, draft: relation, layout, layoutDirty: false, relationPending: null, layoutPending: null,
  }));
  window.agentbridge = {
    preferences: async () => ({ theme: "system", directory: "icon-fixture", distribution: "", platform: "win32" }),
    savePreferences: async (value) => value,
    pending: async () => [],
    call: async (method) => {
      if (method === "snapshot") return { ok: true, result: {
        configured: true, directory: "icon-fixture", machines, nodes,
        nodeManagement: true, machineManagement: true, daemonManagement: true,
        status: { connected: true, connectionState: "connected" },
        agents: { items: [], revision: 1, connected: true }, tasks: [], conversations: [],
        collaboration: relation,
      } };
      if (method === "graphPending") return { ok: true, result: [] };
      if (method === "graphLayout") return { ok: true, result: layout };
      return { ok: false, error: { code: "FIXTURE_READ_ONLY", message: `Icon fixture does not execute ${method}` } };
    },
  };
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  frozen = fs.mkdtempSync(path.join(os.tmpdir(), "agentbridge-agent-icons-"));
  fs.cpSync(path.resolve(__dirname, "../dist"), frozen, { recursive: true });
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
  server = http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, "") || "index.html";
    const filename = path.resolve(frozen, relative);
    if (!filename.startsWith(frozen + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      response.writeHead(404); response.end(); return;
    }
    response.writeHead(200, { "Content-Type": mime[path.extname(filename)] || "application/octet-stream" });
    response.end(fs.readFileSync(filename));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
  report.browserVersion = browser.version();
  report.nodeVersion = process.version;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: "reduce", colorScheme: "light" });
  await context.addInitScript(mockAgentAPI);
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(origin + "/") && !request.url().startsWith("data:")) report.externalRequests.push(request.url());
  });
  await page.goto(origin);
  await expect(page.locator(".inventory-node")).toHaveCount(6);
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme });
    for (const kind of kinds) {
      const image = page.locator(`.inventory-node [data-agent-kind="${kind}"] img`);
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
      const detail = await image.evaluate((element) => ({
        source: element.currentSrc, width: element.naturalWidth, height: element.naturalHeight,
        colorScheme: getComputedStyle(element).colorScheme,
      }));
      assert.equal(detail.colorScheme, "light");
      assert.ok(detail.source.startsWith(origin + "/") || detail.source.startsWith("data:image/"));
      report.checks.push({ theme, kind, imageLoaded: true, ...detail });
    }
    const file = `inventory-${theme}.png`;
    await page.screenshot({ path: path.join(output, file), animations: "disabled" });
    report.screenshots.push(file);
  }
  await page.getByRole("button", { name: "关系图", exact: true }).click();
  await expect(page.locator(".graph-tool")).toHaveCount(6);
  for (const kind of kinds) {
    const mark = page.locator(`.graph-tool [data-agent-kind="${kind}"]`);
    await expect(mark).toHaveCount(1);
    assert.equal(await mark.evaluate((element) => element.classList.contains("graph-tool-role")), false);
  }
  report.checks.push({ graph: "six product icons retain separate leader/member role markers" });
  await page.screenshot({ path: path.join(output, "graph-dark.png"), animations: "disabled" });
  report.screenshots.push("graph-dark.png");
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.externalRequests, []);
  report.status = "passed";
}

main().catch((error) => {
  report.status = "failed"; report.error = error.stack || String(error); process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (frozen) fs.rmSync(frozen, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ status: report.status, checks: report.checks.length, screenshots: report.screenshots.length, output }) + "\n");
});
