// Ordinary portable EXE, disposable profile, Win32 visible-console observation.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn, execFile } = require('node:child_process');
const assert = require('node:assert/strict');
const { CoordinatorClient } = require('../electron/coordinator-client.cjs');
const [source, version, output] = process.argv.slice(2);
if (process.platform !== 'win32' || !output) throw Error('Provide EXE, version, output path using Windows Node');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-poll-portable-'));
const exe = path.join(profile, path.basename(source)); fs.copyFileSync(source, exe);
const report = { date: new Date().toISOString(), version, environment: 'ordinary Windows portable EXE / disposable profile / Win32 EnumWindows every 20 ms', modelCalls: 0, checks: [] };
const psPath = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const ps = command => new Promise((resolve, reject) => execFile(psPath, ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, timeout: 20000 }, (error, out) => error ? reject(error) : resolve(out.trim())));
const observerFile = path.join(profile, 'console-observation.json'), readyFile = path.join(profile, 'console-observer.ready');
let wrapper, client, observer, mainPid;
(async () => {
  observer = spawn(psPath, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'windows-console-observer.ps1'), '-DurationMs', '90000', '-OutputFile', observerFile, '-ReadyFile', readyFile], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let observerError = ''; observer.stderr.on('data', b => observerError += b); observer.on('error', e => observerError += e.message);
  for (let i = 0; i < 300 && !fs.existsSync(readyFile); i++) { if (observerError) throw Error(observerError); await delay(100); }
  assert(fs.existsSync(readyFile), 'Console observer must start before the EXE');
  const env = { ...process.env, AGENTBRIDGE_DESKTOP_PROFILE: profile }; delete env.ELECTRON_RUN_AS_NODE;
  wrapper = spawn(exe, [], { env, stdio: 'ignore' }); wrapper.on('error', e => report.launchError = e.message);
  client = new CoordinatorClient({ directory: profile, version });
  let ready = false;
  for (let i = 0; i < 600; i++) {
    if (report.launchError) throw Error(report.launchError);
    if (fs.existsSync(path.join(profile, 'coordinator-status.json'))) {
      try { await client.attach(); ready = true; break; } catch { /* Wait for authenticated startup. */ }
    }
    await delay(100);
  }
  assert(ready); assert.equal(client.info.version, version);
  let main;
  for (let i = 0; i < 20 && !main; i++) {
    const text = await ps(`Get-CimInstance Win32_Process | Where-Object {$_.ParentProcessId -eq ${wrapper.pid} -and $_.Name -eq 'AgentBridge.exe'} | ForEach-Object {@{pid=$_.ProcessId;title=(Get-Process -Id $_.ProcessId).MainWindowTitle;command=$_.CommandLine}} | ConvertTo-Json -Compress`);
    const windows = text ? JSON.parse(text) : [];
    main = (Array.isArray(windows) ? windows : [windows]).find(row => row.title === 'AgentBridge');
    if (!main) await delay(500);
  }
  assert(main); mainPid = main.pid; assert(!/remote-debugging|--inspect/.test(main.command));
  report.checks.push('Ordinary EXE opens a visible main window with its own candidate version, no debugging flags');
  const times = new Set(), idleStart = Date.now();
  while (Date.now() - idleStart < 70000) {
    try { const runtime = JSON.parse(fs.readFileSync(path.join(profile, 'runtime.json'), 'utf8')); times.add(runtime.time); } catch { /* Atomic diagnostic replacement. */ }
    assert.equal(wrapper.exitCode, null, 'EXE must remain open during idle observation');
    await delay(250);
  }
  assert(times.size >= 30, 'Renderer must keep polling throughout the idle observation');
  report.idleMs = Date.now() - idleStart; report.distinctRendererHeartbeats = times.size;
  report.checks.push('More than 70 seconds of real renderer polling without window exit');
  for (let i = 0; i < 300 && !fs.existsSync(observerFile); i++) { if (observerError) throw Error(observerError); await delay(100); }
  assert(fs.existsSync(observerFile));
  report.consoleObservation = JSON.parse(fs.readFileSync(observerFile, 'utf8').replace(/^\uFEFF/, ''));
  const ownedPids = new Set([wrapper.pid, mainPid, client.info.pid]);
  report.candidateConsoleEvents = report.consoleObservation.events.filter(event => event.ancestors.some(row => ownedPids.has(row.pid) || ownedPids.has(row.parentPid)));
  report.unattributedConsoleEvents = report.consoleObservation.events.filter(event => !event.ancestors?.length);
  assert.deepEqual(report.candidateConsoleEvents, [], 'Candidate process tree created a visible console window');
  assert.deepEqual(report.unattributedConsoleEvents, [], 'A console window could not be attributed; acceptance requires a complete observation');
  report.checks.push('90-second Win32 sampling observed no visible console window from the candidate process tree; other system windows remain recorded with ancestry');
  const reply = await client.request('call', { method: 'snapshot', params: {} }); assert(reply.ok);
  report.nativeTasks = reply.result.tasks.length;
  const coordinatorPid = client.info.pid;
  await ps(`(Get-Process -Id ${mainPid}).CloseMainWindow() | Out-Null`); mainPid = null;
  for (let i = 0; i < 300 && wrapper.exitCode === null; i++) await delay(100);
  assert.notEqual(wrapper.exitCode, null);
  await client.attach(); assert.equal(client.info.pid, coordinatorPid);
  report.checks.push('Normal window close keeps the same Coordinator available');
  report.status = 'passed';
})().catch(error => { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; }).finally(async () => {
  try { if (mainPid) await ps(`(Get-Process -Id ${mainPid} -ErrorAction SilentlyContinue).CloseMainWindow() | Out-Null`); } catch {}
  try { await client?.request('shutdown'); } catch {} client?.close(); observer?.kill();
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2));
});
