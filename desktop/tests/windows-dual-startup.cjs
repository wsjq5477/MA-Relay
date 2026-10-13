// Normal portable launch: no debugger and no automation control interface.
const fs = require("node:fs"), path = require("node:path");
const { spawn, execFile } = require("node:child_process");
const [exe] = process.argv.slice(2);
const prior = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../artifacts/I04B-dual-real.json"), "utf8"));
const profile = path.join(prior.root, "profile"), runtime = path.join(profile, "runtime.json");
const report = { date: new Date().toISOString(), platform: process.platform, status: "running", checks: {}, errors: [], debugInterface: false };
const delay = ms => new Promise(r => setTimeout(r, ms));
function children(pid) {
  return new Promise((done, reject) => execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `$ProgressPreference='SilentlyContinue';Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;parent=$_.ParentProcessId;command=$_.CommandLine;title=(Get-Process -Id $_.ProcessId).MainWindowTitle}} | ConvertTo-Json -Compress`], { windowsHide: true, timeout: 15000 }, (error, text) => {
    if (error) return reject(error);
    const value = text.trim() ? JSON.parse(text) : [];
    done(Array.isArray(value) ? value : [value]);
  }));
}
let wrapper;
(async () => {
  fs.writeFileSync(path.join(profile, "desktop.json"), JSON.stringify({ theme: "light", distribution: "Ubuntu", directory: prior.linuxRoot + "/state" }));
  fs.rmSync(runtime, { force: true });
  const env = { ...process.env, AGENTBRIDGE_DESKTOP_PROFILE: profile }; delete env.ELECTRON_RUN_AS_NODE;
  const started = Date.now(); wrapper = spawn(exe, [], { env, stdio: "ignore" });
  const end = Date.now() + 120000;
  while (Date.now() < end) {
    let snapshot; try { snapshot = JSON.parse(fs.readFileSync(runtime, "utf8")); } catch {}
    if (snapshot?.version === "0.4.1" && Date.parse(snapshot.time) >= started && snapshot.machines?.filter(m => m.online).length === 2 && snapshot.instances === 2 && snapshot.tasks >= 4) {
      const child = (await children(wrapper.pid)).find(p => p.title === "AgentBridge");
      if (child && !/remote-debugging|--inspect/.test(child.command)) {
        report.status = "passed"; report.snapshot = snapshot; report.windowTitle = child.title; report.elapsedMs = Date.now() - started;
        report.checks.portableNormalWindow = true; report.checks.rendererReceivedBothMachines = true; report.checks.restoredBothInstancesAndHistory = true; report.checks.noDebugInterface = true;
        return;
      }
    }
    await delay(400);
  }
  throw new Error("No fresh dual-source snapshot received by normal Windows portable renderer");
})().catch(e => { report.status = "failed"; report.errors.push(e.stack); process.exitCode = 1; }).finally(async () => {
  if (wrapper) { try { const owned = (await children(wrapper.pid)).find(p => p.title === "AgentBridge"); if (owned?.parent === wrapper.pid) process.kill(owned.pid); } catch {} }
  fs.writeFileSync(path.resolve(__dirname, "../../artifacts/I04B-windows-startup.json"), JSON.stringify(report, null, 2)); console.log("Normal dual-machine Windows window: " + report.status);
});
