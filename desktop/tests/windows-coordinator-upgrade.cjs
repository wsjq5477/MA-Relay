// Run the packaged GUI over an isolated profile owned by the previous packaged Coordinator.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { CoordinatorClient } = require('../electron/coordinator-client.cjs');

const [oldExe, newExe, testRoot, oldVersion, newVersion] = process.argv.slice(2);
assert.equal(process.platform, 'win32');
assert(oldExe && newExe && testRoot && oldVersion && newVersion);
for (const target of [oldExe, newExe, testRoot, process.env.TEMP, process.env.TMP]) {
  assert(path.isAbsolute(target) && !/^c:/i.test(path.parse(target).root));
}
const root = fs.mkdtempSync(path.join(testRoot, 'packaged-upgrade-'));
const directory = path.join(root, 'profile');
const bin = path.join(root, 'bin');
const env = { ...process.env, AGENTBRIDGE_DESKTOP_PROFILE: directory };
for (const key of ['TEMP', 'TMP', 'TMPDIR', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'NODE_COMPILE_CACHE', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR']) {
  env[key] = path.join(root, key.toLowerCase());
  fs.mkdirSync(env[key], { recursive: true });
}
for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
delete env.ELECTRON_RUN_AS_NODE;
env.PATH = bin + path.delimiter + path.dirname(process.execPath);
fs.mkdirSync(bin);
fs.copyFileSync(path.join(process.env.SystemRoot, 'System32', 'where.exe'), path.join(bin, 'wsl.exe'));
fs.mkdirSync(directory);
const identity = JSON.stringify({ coordinatorId: randomUUID(), token: randomBytes(32).toString('hex') });
const machineId = 'local-upgrade-windows';
const operation = { id: 'original-upgrade-request', machineId, op: 'invoke', state: 'unknown', params: { requestId: 'original-upgrade-request' }, updatedAt: new Date().toISOString() };
const pending = JSON.stringify([operation]);
fs.writeFileSync(path.join(directory, 'coordinator-identity.json'), identity);
fs.writeFileSync(path.join(directory, 'pending.json'), pending);
fs.writeFileSync(path.join(directory, 'desktop.json'), JSON.stringify({ theme: 'system', distribution: '', directory: '' }));
fs.writeFileSync(path.join(directory, 'machines.json'), JSON.stringify({
  version: 1, localMachineId: machineId,
  machines: [{ machineId, name: 'Upgrade fixture', kind: 'windows', platform: 'win32' }],
  connections: [], instances: [],
}));

const report = { oldVersion, newVersion, checks: {}, scope: 'packaged startup and authenticated local shutdown, isolated profile' };
const client = new CoordinatorClient({ directory });
let old, gui;
let launchError;

async function checkPending() {
  const rows = await client.request('pending');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, operation.id);
  assert.equal(rows[0].state, operation.state);
  assert.deepEqual(rows[0].params, operation.params);
}

async function waitFor(file, predicate) {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    if (gui && (gui.exitCode !== null || gui.signalCode)) throw Error('New desktop exited before becoming ready: ' + (gui.signalCode || gui.exitCode));
    if (!gui && old && (old.exitCode !== null || old.signalCode)) throw Error('Old coordinator exited before becoming ready: ' + (old.signalCode || old.exitCode));
    let row;
    try { row = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')); } catch {}
    if (row && predicate(row)) return row;
    await delay(500);
  }
  throw Error('Timed out waiting for ' + file);
}

async function validate() {
  const oldEntry = path.join(path.dirname(oldExe), 'resources', 'bridge', 'desktop', 'electron', 'coordinator.cjs');
  old = spawn(oldExe, [oldEntry, '--directory', directory, '--version', oldVersion], {
    cwd: root, env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, stdio: 'ignore',
  });
  old.once('error', error => { launchError = error; });
  await waitFor('coordinator-status.json', row => row.version === oldVersion && row.pid === old.pid);
  await client.attach();
  assert.equal((await client.request('preferences')).version, oldVersion);
  await checkPending();
  client.close();
  const exited = new Promise(resolve => old.once('exit', resolve));
  const started = Date.now();
  const log = fs.openSync(path.join(root, 'window.log'), 'a');
  try { gui = spawn(newExe, [], { cwd: root, env, stdio: ['ignore', log, log] }); }
  finally { fs.closeSync(log); }
  gui.once('error', error => { launchError = error; });
  const status = await waitFor('coordinator-status.json', row => row.version === newVersion);
  assert.equal(await exited, 0);
  assert.notEqual(status.pid, old.pid);
  report.checks.originalProcessExited = true;
  await client.attach();
  assert.equal((await client.request('preferences')).version, newVersion);
  await checkPending();
  report.checks.newVersionAttachedAndRead = true;
  await waitFor('runtime.json', row => row.version === newVersion && Date.parse(row.time) >= started &&
    row.machines.some(machine => machine.machineId === machineId));
  assert.ok(fs.readFileSync(path.join(directory, 'coordinator-identity.json'), 'utf8') === identity);
  assert.equal(fs.readFileSync(path.join(directory, 'pending.json'), 'utf8'), pending);
  report.checks.desktopReadOriginalMachineFromNewVersion = true;
  report.checks.identityAndUnknownBytesPreserved = true;
  report.startupMs = Date.now() - started;
  gui.kill();
  await client.request('shutdown');
}

validate().then(() => { report.ok = true; }, error => {
  report.error = error.message;
  process.exitCode = 1;
}).finally(async () => {
  if (gui?.exitCode === null) gui.kill();
  if (old?.exitCode === null) old.kill();
  if (!report.ok) {
    try {
      await client.attach();
      await client.send('shutdown', undefined, 3000);
    } catch {}
  }
  client.close();
  fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  console.log('Evidence directory ' + root);
});
