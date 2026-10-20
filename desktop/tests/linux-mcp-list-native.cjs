// Real native MCP catalogue acceptance, isolated user configuration, no model calls.
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const assert = require("node:assert/strict"),
  { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { MachineHost } = require("../electron/machine-host.cjs");
const { scanTools, command } = require("../electron/tool-discovery.cjs");
const run = promisify(execFile);
async function main() {
  const output = path.resolve(
    process.env.AGENTBRIDGE_MCP_EVIDENCE ||
      "artifacts/mcp-integration/2026-10-19/native-list.json",
  );
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ab-mcp-native-"));
  const home = path.join(directory, "home"),
    work = path.join(directory, "work");
  fs.mkdirSync(home);
  fs.mkdirSync(work);
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    CODEX_HOME: path.join(home, ".codex"),
    CLAUDE_CONFIG_DIR: path.join(home, ".claude"),
    XDG_CONFIG_HOME: path.join(home, ".config"),
    XDG_DATA_HOME: path.join(home, ".local/share"),
    XDG_STATE_HOME: path.join(home, ".local/state"),
    XDG_CACHE_HOME: path.join(home, ".cache"),
  };
  env.OPENCODE_CONFIG_DIR = path.join(home, ".config/opencode");
  delete env.CLAUDECODE;
  delete env.OPENCODE_CONFIG;
  delete env.OPENCODE_CONFIG_CONTENT;
  const report = {
    date: new Date().toISOString(),
    environment: "WSL Linux, real native CLIs, isolated user directories",
    version: require("../package.json").version,
    modelCalls: 0,
    checks: [],
    status: "running",
  };
  const host = new MachineHost({
    directory: path.join(directory, "bridge"),
    home,
    environment: env,
    legacy: { close() {} },
    collaboration: async () => ({ items: [] }),
  });
  let stopOpenCode;
  try {
    const items = await scanTools();
    for (const adapter of ["claude", "codex", "opencode"]) {
      const tool = items.find((i) => i.adapter === adapter);
      assert(tool?.healthy, adapter + " not available");
      const cli = async (args) => {
        const launch = command(tool.executable, args, env);
        return run(launch.executable, launch.args, {
          env: launch.env,
          cwd: work,
          timeout: 45000,
          maxBuffer: 1048576,
          windowsHide: true,
        });
      };
      const version = (await cli(["--version"])).stdout.trim();
      if (adapter === "opencode") {
        const socket = require("node:net").createServer();
        await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
        const port = socket.address().port;
        await new Promise((resolve) => socket.close(resolve));
        await cli(["service", "set", "disabled", "false"]);
        await cli(["service", "set", "port", String(port)]);
        stopOpenCode = () => cli(["service", "stop"]);
      }
      const params = { nodeId: "native-" + adapter, adapter };
      const installed = await host.call("mcp.install", params);
      assert.equal(installed.installed, true);
      const listArgs = ["mcp", "list"];
      let added = (await cli(listArgs)).stdout;
      for (
        let retry = 0;
        adapter === "opencode" &&
        !(/agentbridge/.test(added) && /connected/i.test(added)) &&
        retry < 20;
        retry++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        added = (await cli(listArgs)).stdout;
      }
      if (adapter === "opencode") report.openCodeList = added.trim();
      assert.match(added, /agentbridge/);
      if (adapter !== "codex")
        assert.match(added, /connected/i, adapter + " did not connect");
      const config = JSON.parse(fs.readFileSync(installed.files.json))
        .mcpServers.agentbridge;
      const descriptor = JSON.parse(fs.readFileSync(config.args[1]));
      assert(!added.includes(descriptor.token));
      await host.call("mcp.remove", params);
      let removed = (await cli(listArgs)).stdout;
      for (
        let retry = 0;
        adapter === "opencode" && removed.includes("agentbridge") && retry < 20;
        retry++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        removed = (await cli(listArgs)).stdout;
      }
      assert(
        !removed.includes("agentbridge"),
        adapter + " still listed after removal",
      );
      report.checks.push({
        adapter,
        version,
        listed: true,
        connected: adapter === "codex" ? "catalogue only" : true,
        removed: true,
      });
    }
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = {
      code: error.code || "ASSERTION",
      message: error.message.slice(0, 600),
    };
    process.exitCode = 1;
  } finally {
    if (stopOpenCode) await stopOpenCode().catch(() => {});
    host.close();
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    fs.rmSync(directory, { recursive: true, force: true });
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
