// Explicit installed-Hermes acceptance. Uses the native account/model settings.
// Creates two small native turns; credentials and native IDs never enter reports.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), {createHash} = require('node:crypto');
const [bridgeArg, executable, output] = process.argv.slice(2);
const token = process.argv[5] || 'BRIDGE_HERMES_中文_2710';
if (!/^[\w\u4e00-\u9fff]+$/.test(token)) throw Error('A plain verification token is required');
if (process.platform !== 'win32' || !output) throw Error('Provide Bridge root, installed Hermes executable and output report on Windows');
const {NativeCliHost} = require(path.resolve(bridgeArg, 'desktop/electron/native-cli-host.cjs'));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-hermes-execution-'));
const daily = process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA, 'hermes');
const digest = file => fs.existsSync(file) ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
const original = Object.fromEntries(['config.yaml', '.env', 'auth.json'].map(name => [name, digest(path.join(daily, name))]));
let host = new NativeCliHost({directory, executable, adapter: 'hermes'});
const report = {date: new Date().toISOString(), version: require('../package.json').version, platform: process.platform, status: 'running', completedModelTurns: 0, checks: []};
const checkpoint = () => {fs.mkdirSync(path.dirname(path.resolve(output)), {recursive: true}); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function finish(taskId) {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    const task = await host.call('ipc', {op: 'task', taskId});
    if (['succeeded', 'failed', 'cancelled', 'unknown'].includes(task.status)) return task;
    await delay(250);
  }
  throw Error('Original Hermes request did not reach a terminal state in the observation budget; retained for original-ID recovery');
}
(async () => {
  checkpoint(); const {agentId} = await host.call('connect', {workspace: directory});
  const params = {op: 'submit', agentId, requestId: token+'-first', message: 'Do not use any tools. Reply with exactly this token and nothing else: '+token};
  const accepted = await host.call('ipc', params), first = await finish(accepted.taskId);
  assert.equal(first.status, 'succeeded', 'Installed Hermes first turn must succeed');
  assert(first.result.message.includes(token)); report.completedModelTurns++;
  assert.equal((await host.call('ipc', params)).taskId, first.taskId);
  report.checks.push('Installed native CLI stream-json completes a Unicode prompt using its existing account/model; duplicate original request returns the same task'); checkpoint();
  host.close(); host = new NativeCliHost({directory, executable, adapter: 'hermes'});
  const next = await host.call('ipc', {op: 'continue', conversationId: first.conversationId, requestId: token+'-second', message: 'This is the release heartbeat regression check. Do not use any tools. Repeat the exact token from my previous user message, followed immediately by _CONTINUED. No other text.'});
  const second = await finish(next.taskId); assert.equal(second.status, 'succeeded', 'Installed Hermes continuation must succeed');
  assert.equal(second.native.sessionId, first.native.sessionId); assert(second.result.message.includes(token+'_CONTINUED')); report.completedModelTurns++;
  report.checks.push('Observer restart continues the same native Session and remembers the previous turn'); checkpoint();
  assert.equal((await host.call('snapshot')).agents.items[0].capabilities.cancellation, false);
  report.checks.push('Gateway cancellation is explicitly unsupported; client exit is never presented as a cancelled gateway task');
  report.nativeConfiguration = {byteIdentical: true, changedFiles: []};
  for (const name of Object.keys(original)) if (digest(path.join(daily,name)) !== original[name]) report.nativeConfiguration.changedFiles.push(name);
  report.nativeConfiguration.byteIdentical = report.nativeConfiguration.changedFiles.length === 0;
  // The native client may refresh auth or migrate its own settings. Bridge never
  // supplies model/account overrides; native-managed writes are observations.
  report.checks.push('Native configuration file changes are recorded separately from the verified task/session results'); report.status = 'passed';
})().catch(error => {report.status = 'failed'; report.error = {code: error.code || 'ACCEPTANCE_FAILED', message: error.code === 'ERR_ASSERTION' ? error.message.split('\n')[0] : 'Native execution acceptance failed; inspect retained original requests locally'}; report.recoveryDirectory = directory; process.exitCode = 1;})
  .finally(() => {host.close(); checkpoint(); console.log(JSON.stringify(report));});
