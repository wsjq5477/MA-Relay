// Explicit Windows -> WSL acceptance against frozen package resources. No model calls.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const {performance} = require('node:perf_hooks');
const {randomUUID, createHash} = require('node:crypto');
const [bridge, executable, output, distribution = 'Ubuntu', countArg = '20'] = process.argv.slice(2);
if (process.platform !== 'win32' || !output) throw Error('Windows runtime, frozen package resources, EXE and output required');
const count = Number(countArg);
assert(Number.isInteger(count) && count >= 20 && count <= 100);
const expectedHash = '0468608387c0f2894cfe1df58f3a92dec24427030c1bb2a0420f689be1f7230d';
const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha256(executable), expectedHash, 'Acceptance must use the frozen alpha.50 EXE resources');
const linuxDirectory = '/tmp/agentbridge-wsl-startup-' + randomUUID();
const uncDirectory = '\\\\wsl.localhost\\' + distribution + linuxDirectory.replaceAll('/', '\\');
const report = {date: new Date().toISOString(), version: '0.6.0-alpha.50', status: 'running',
  environment: {platform: process.platform, release: os.release(), architecture: process.arch, runtime: process.version, distribution},
  scope: 'Actual Windows HostConnection -> WSL Linux MachineHost, shared isolated Bridge directory; read-only environment/snapshot, no native model or config mutation',
  modelCalls: 0, taskSubmissions: 0, expectedStarts: count, packageSha256: expectedHash,
  resources: Object.fromEntries(['desktop/electron/rpc.cjs', 'dist/desktop-host.js', 'bootstrap.sh'].map(file => [file, sha256(path.join(bridge, file))])), samples: []};
fs.mkdirSync(path.dirname(output), {recursive: true});
const save = () => {fs.writeFileSync(output + '.tmp', JSON.stringify(report, null, 2) + '\n'); fs.renameSync(output + '.tmp', output);};
let current;
// Observe real child streams without replacing the process, arguments, bytes or timing.
const originalSpawn = cp.spawn;
cp.spawn = function(command, args, options) {
  const child = originalSpawn(command, args, options);
  if (command !== 'wsl.exe') return child;
  const sample = current; assert(sample);
  sample.spawned++; sample.process = child;
  sample.exit = new Promise(resolve => {child.once('exit', (code, signal) => {sample.exitCode = code; sample.exitSignal = signal; resolve();});});
  const write = child.stdin.write;
  child.stdin.write = function(bytes, ...rest) {
    const request = JSON.parse(bytes.toString());
    sample.writes.push({method: request.method, id: request.id, afterReady: sample.ready, elapsedMs: performance.now() - sample.started});
    return write.call(this, bytes, ...rest);
  };
  let lines = '';
  child.stdout.on('data', bytes => {
    lines += bytes.toString(); let newline;
    while ((newline = lines.indexOf('\n')) >= 0) {
      const raw = lines.slice(0, newline); lines = lines.slice(newline + 1);
      try {
        const value = JSON.parse(raw);
        if (value.bridgeReady === 1 && value.protocol === 'agentbridge-host-v1') {sample.ready = true; sample.readyMs = performance.now() - sample.started;}
      } catch {sample.invalidFrames++;}
    }
  });
  return child;
};
const {HostConnection} = require(path.join(bridge, 'desktop/electron/rpc.cjs'));
cp.spawn = originalSpawn;
function serializable(sample) {return Object.fromEntries(Object.entries(sample).filter(([key]) => !['process', 'exit', 'started'].includes(key)));}
async function waitExit(sample) {
  if (!sample.process) return;
  let timer;
  try {await Promise.race([sample.exit, new Promise((_, reject) => {timer = setTimeout(() => reject(Error('Original WSL host exit remains unconfirmed; stop before another start')), 15000);})]);}
  finally {clearTimeout(timer);}
}
(async () => {
  for (let index = 0; index < count; index++) {
    current = {index: index + 1, started: performance.now(), spawned: 0, ready: false, invalidFrames: 0, writes: []};
    const sample = current;
    const host = new HostConnection(path.join(bridge, 'dist/desktop-host.js'), {distribution, directory: linuxDirectory});
    let exitConfirmed = false;
    try {
      const values = await Promise.allSettled([host.call('environment'), host.call('snapshot'), host.call('environment')]);
      sample.results = values.map(value => value.status === 'fulfilled' ? {status: 'fulfilled'} : {status: 'rejected', code: value.reason.code, executionNotDispatched: value.reason.executionNotDispatched === true});
      const failed = values.find(value => value.status === 'rejected');
      if (failed) throw failed.reason;
      const [first, snapshot, last] = values.map(value => value.value);
      assert.equal(first.platform, 'linux'); assert.equal(first.directory, linuxDirectory);
      assert.equal(last.directory, first.directory); assert.equal(last.node, first.node);
      assert.equal(snapshot.configured, false); assert.deepEqual(snapshot.tasks, []);
      assert.equal(sample.spawned, 1, 'Concurrent first calls must share one startup');
      assert.equal(sample.ready, true); assert.equal(sample.invalidFrames, 0);
      assert.equal(sample.writes.length, 3); assert(sample.writes.every(value => value.afterReady));
      assert.equal(new Set(sample.writes.map(value => value.id)).size, 3);
      sample.node = first.node; sample.callsMs = performance.now() - sample.started; sample.status = 'passed';
    } catch (error) {
      sample.status = 'failed'; sample.error = {code: error.code || 'ASSERTION', message: error.message};
      sample.executionNotDispatched = error.executionNotDispatched === true;
      sample.stderrBytes = Buffer.byteLength(host.lastError || '');
      // A pre-ready failure is acceptable only as evidence of no dispatch, never as a passing startup.
      if (!sample.ready) sample.zeroWritesBeforeReady = sample.writes.length === 0;
    } finally {
      host.close();
      try {await waitExit(sample); exitConfirmed = true; sample.exitConfirmed = true;}
      catch (error) {sample.exitConfirmed = false; sample.status = 'failed'; sample.cleanupError = error.message;}
      report.samples.push(serializable(sample)); save();
      console.log(JSON.stringify({sample: index + 1, status: sample.status, readyMs: sample.readyMs, exitConfirmed}));
    }
    if (!exitConfirmed) {report.cleanupPending = true; break;}
  }
  report.passed = report.samples.filter(value => value.status === 'passed').length;
  report.failed = report.samples.filter(value => value.status !== 'passed').length;
  const readyTimes = report.samples.filter(value => value.readyMs !== undefined).map(value => value.readyMs).sort((a, b) => a - b);
  report.readyMs = {samples: readyTimes.length, p50: readyTimes[Math.ceil(readyTimes.length * 0.5) - 1], p95: readyTimes[Math.ceil(readyTimes.length * 0.95) - 1], max: readyTimes.at(-1)};
  report.allRequestsDistinct = new Set(report.samples.flatMap(sample => sample.writes.map(value => value.id))).size === report.samples.reduce((sum, sample) => sum + sample.writes.length, 0);
  assert(report.allRequestsDistinct, 'No original request may be replayed');
  report.status = report.passed === count && report.failed === 0 ? 'passed' : 'failed';
  if (report.status !== 'passed') process.exitCode = 1;
})().catch(error => {report.status = 'failed'; report.error = {code: error.code, message: error.message}; process.exitCode = 1;})
  .finally(() => {if (!report.cleanupPending) fs.rmSync(uncDirectory, {recursive: true, force: true}); save(); console.log(JSON.stringify({status: report.status, passed: report.passed, failed: report.failed, readyMs: report.readyMs}));});
