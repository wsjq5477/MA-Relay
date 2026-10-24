// Real frozen Linux files and Node verification behind controlled probe/SFTP
// transport. No SSH network, daemon lifecycle, model or user-profile mutation.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), {EventEmitter} = require('node:events');
const {spawn} = require('node:child_process'), {createHash} = require('node:crypto');
const {SshInstaller, localManifest} = require('../electron/ssh-install.cjs');
const [packageDirectory, frozenDirectory, output] = process.argv.slice(2);
if (process.platform !== 'linux' || !output) throw Error('Linux and current/frozen packages/report required');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-frozen-reuse-'));
const installer = new SshInstaller({directory: path.join(directory, 'client'), coordinatorId: 'controlled-owner', packageDirectory: path.resolve(packageDirectory)});
const report = {date: new Date().toISOString(), status: 'running', scope: 'Controlled probe and filesystem SFTP shim / actual frozen Linux files / actual frozen Node runs production verifyScript; no SSH network or daemon lifecycle', modelCalls: 0, remoteMutationMethods: [], commands: [], checks: []};
const home = path.join(directory, 'fixture-home'), installPath = path.join(home, '.local/share/agentbridge/profiles', installer.profileId);
let frozen, versionPath, runtime, markers;
const sftp = {end() {}, lstat(file, cb) {fs.lstat(file, cb);}, createReadStream: file => fs.createReadStream(file)};
for (const name of ['mkdir', 'chmod', 'rename', 'createWriteStream', 'write', 'unlink']) sftp[name] = () => {report.remoteMutationMethods.push(name); throw Error('Unexpected mutation');};
const client = {sftp(cb) {cb(null, sftp);}, exec(command, _options, cb) {
  const stream = new EventEmitter(); stream.stderr = new EventEmitter();
  if (command === '/bin/sh -s') {
    report.commands.push('controlled-probe'); stream.close = () => {};
    stream.end = () => queueMicrotask(() => {
      stream.emit('data', Buffer.from(['AGENTBRIDGE_PROBE_V2', 'Linux', 'x86_64', String(process.getuid()), 'controlled-user', home, 'glibc 2.32', '9999999', runtime, frozen.manifest.runtime.version, '', 'END_AGENTBRIDGE_PROBE', ''].join('\n')));
      stream.emit('close', 0);
    }); cb(null, stream); return;
  }
  report.commands.push('actual-production-file-verification');
  assert(command.startsWith("'" + runtime.replaceAll("'", "'\\''") + "' -"));
  const child = spawn('/bin/sh', ['-c', command], {stdio: ['pipe', 'pipe', 'pipe']});
  child.stdout.on('data', chunk => stream.emit('data', chunk));
  child.stderr.on('data', chunk => stream.stderr.emit('data', chunk));
  child.on('close', code => stream.emit('close', code)); child.on('error', error => stream.emit('error', error));
  stream.end = input => child.stdin.end(input); stream.close = () => child.kill('SIGTERM'); cb(null, stream);
}};
const snapshot = () => markers.map(file => createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
(async () => {
  frozen = localManifest(path.resolve(frozenDirectory));
  const trusted = installer.release(frozen.manifest.version); assert.equal(trusted.digest, frozen.digest);
  report.clientVersion = installer.bundle().manifest.version; report.frozenVersion = frozen.manifest.version;
  report.frozenFiles = frozen.manifest.files.length; report.frozenDigest = frozen.digest;
  versionPath = path.join(installPath, 'versions', frozen.manifest.version);
  fs.mkdirSync(versionPath, {recursive: true, mode: 0o700}); fs.cpSync(frozenDirectory, versionPath, {recursive: true});
  const state = path.join(home, '.local/state/agentbridge/profiles', installer.profileId); fs.mkdirSync(state, {recursive: true, mode: 0o700});
  runtime = path.join(versionPath, frozen.manifest.runtime.path); fs.chmodSync(runtime, 0o700);
  const data = [
    [path.join(installPath, 'install.json'), {kind: 'agentbridge-install', ownerCoordinatorId: 'controlled-owner', profileId: installer.profileId}],
    [path.join(installPath, 'current.json'), {version: frozen.manifest.version, digest: frozen.digest, versionPath}],
    [path.join(versionPath, '.bridge-release.json'), {ownerCoordinatorId: 'controlled-owner', digest: frozen.digest}],
    [path.join(state, 'original-receipt.json'), {requestId: 'controlled-original-request', operationId: 'controlled-original-operation', status: 'unknown'}],
  ];
  for (const [file, value] of data) fs.writeFileSync(file, JSON.stringify(value), {mode: 0o600});
  markers = data.map(v => v[0]); const before = snapshot();
  const probe = await installer.probe(client); assert.equal(probe.reuseCompatible, true); assert.equal(probe.installNeeded, false);
  const result = await installer.install(client, probe, 'controlled-readonly-reuse');
  assert.equal(result.version, frozen.manifest.version); assert.equal(result.versionPath, versionPath); assert.deepEqual(snapshot(), before);
  report.checks.push('Actual frozen Node verifies every original file under production reuse; original current/ownership/unknown receipt bytes remain identical');
  fs.appendFileSync(path.join(versionPath, 'desktop/electron/ssh-install.cjs'), '\ncontrolled tamper\n');
  await assert.rejects(installer.install(client, probe, 'controlled-readonly-tamper'), {code: 'SSH_PACKAGE_CHECKSUM'});
  assert.deepEqual(snapshot(), before); assert.deepEqual(report.remoteMutationMethods, []);
  assert.equal(report.commands.filter(v => v === 'actual-production-file-verification').length, 2);
  report.checks.push('Changing one frozen backend file is rejected by actual remote-file verification before any upload, activation or task action');
  report.checks.push('No SFTP mutation method or daemon/model command is issued; original synthetic unknown receipt remains unchanged');
  report.status = 'passed';
})().catch(error => {report.status = 'failed'; report.error = {code: error.code, message: error.message}; process.exitCode = 1;})
  .finally(() => {fs.rmSync(directory, {recursive: true, force: true}); fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));});
