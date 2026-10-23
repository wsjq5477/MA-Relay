// Raw WSL transport comparison; no Bridge/native Agent/config reads or model calls.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {spawn} = require('node:child_process');
const {performance} = require('node:perf_hooks');
const [output, distribution = 'Ubuntu'] = process.argv.slice(2);
if (process.platform !== 'win32' || !output) throw Error('Windows runtime and output required');
const report = {date: new Date().toISOString(), scope: 'Raw WSL argv/stdio comparison, simple printf/read, no Bridge or model process',
  environment: {platform: process.platform, release: os.release(), runtime: process.version,
    inheritedWslKeys: ['WSL_INTEROP', 'WSL_DISTRO_NAME', 'WSLENV'].filter(key => process.env[key])}, modelCalls: 0, samples: []};
async function probe(mode, round) {
  const started = performance.now(), sample = {mode, round};
  const detached = mode === 'pipe-no-interop';
  const environment = {...process.env};
  if (detached) for (const key of ['WSL_INTEROP', 'WSL_DISTRO_NAME', 'WSLENV']) delete environment[key];
  const type = mode === 'overlapped' ? 'overlapped' : 'pipe';
  const ignore = mode === 'ignore';
  const script = ignore ? 'printf "WSL_RAW_READY\\n"' : 'printf "WSL_RAW_READY\\n"; IFS= read -r line; test "$line" = WSL_RAW_INPUT && printf "WSL_RAW_ACK\\n"';
  const child = spawn('wsl.exe', ['--distribution', distribution, '--exec', '/bin/sh', '-c', script], {env: environment, windowsHide: true, stdio: [ignore ? 'ignore' : type, type, type]});
  let stdout = '', stderrBytes = 0, timer;
  child.stdout.on('data', bytes => {
    stdout += bytes.toString();
    if (!ignore && stdout.includes('WSL_RAW_READY\n') && !sample.sent) {sample.sent = true; child.stdin.end('WSL_RAW_INPUT\n');}
  });
  child.stderr.on('data', bytes => {stderrBytes += bytes.length;});
  child.stdin?.on('error', error => {sample.stdinError = error.code;});
  timer = setTimeout(() => {sample.timedOut = true; child.kill();}, 10000);
  await new Promise(resolve => {
    child.once('error', error => {sample.spawnError = error.code; resolve();});
    child.once('exit', (code, signal) => {sample.exitCode = code; sample.signal = signal; resolve();});
  });
  clearTimeout(timer);
  sample.elapsedMs = performance.now() - started; sample.ready = stdout.includes('WSL_RAW_READY\n');
  sample.ack = stdout.includes('WSL_RAW_ACK\n'); sample.stdoutBytes = Buffer.byteLength(stdout); sample.stderrBytes = stderrBytes;
  sample.passed = sample.exitCode === 0 && sample.ready && (ignore || sample.ack);
  report.samples.push(sample);
  fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(sample));
}
(async () => {
  // Interleave conditions to avoid presenting a warmed-up batch as a transport difference.
  for (let round = 1; round <= 5; round++) for (const mode of ['pipe', 'ignore', 'overlapped', 'pipe-no-interop']) await probe(mode, round);
  report.summary = Object.fromEntries(['pipe', 'ignore', 'overlapped', 'pipe-no-interop'].map(mode => {
    const values = report.samples.filter(sample => sample.mode === mode);
    return [mode, {passed: values.filter(sample => sample.passed).length, total: values.length}];
  }));
})().catch(error => {report.error = {code: error.code, message: error.message}; process.exitCode = 1;})
  .finally(() => {fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report.summary));});
