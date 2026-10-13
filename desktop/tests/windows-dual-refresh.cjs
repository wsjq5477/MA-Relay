const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { MachineRouter } = require("../electron/machine-router.cjs");
const { ClaudeHost } = require("../electron/claude-host.cjs");
const { HostConnection, distributions } = require("../electron/rpc.cjs");
const prior = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../artifacts/I04B-dual-real.json"), "utf8"));
const directory = path.join(prior.root, "profile"), prefs = { distribution: "Ubuntu", directory: prior.linuxRoot + "/state" };
const router = new MachineRouter({ directory, platform: "win32", distributions, preferences: () => prefs,
  createHost: m => m.kind === "windows" ? new ClaudeHost({ directory: path.join(directory, "windows") })
    : new HostConnection(path.resolve(__dirname, "../../dist/desktop-host.js"), { distribution: m.distribution, directory: prefs.directory, bootstrapPath: path.resolve(__dirname, "../electron/bootstrap.sh") }),
});
const report = { date: new Date().toISOString(), status: "running", samples: [], errors: [] };
(async () => {
  await router.snapshot();
  for (let i = 0; i < 20; i++) {
    const started = performance.now(), state = await router.snapshot(), elapsed = performance.now() - started;
    assert.equal(state.machines.filter(m => m.online).length, 2); assert.equal(state.instances.length, 2);
    report.samples.push(Number(elapsed.toFixed(1)));
  }
  const ordered = [...report.samples].sort((a, b) => a - b);
  report.p95Ms = ordered[Math.ceil(ordered.length * 0.95) - 1];
  assert(report.p95Ms < 3000); report.status = "passed";
})().catch(e => { report.status = "failed"; report.errors.push(e.stack); process.exitCode = 1; }).finally(() => {
  router.close(); fs.writeFileSync(path.resolve(__dirname, "../../artifacts/I04B-refresh.json"), JSON.stringify(report, null, 2)); console.log("Dual-source readonly refresh: " + report.status + ", p95 " + report.p95Ms + "ms");
});
