const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { CoordinatorClient } = require('../electron/coordinator-client.cjs');

const coordinator = require.resolve('../electron/coordinator.cjs');
const capabilities = require.resolve('../electron/runtime-capabilities.cjs');
const oldVersion = '0.6.0-alpha.76.issue33.9';
const newVersion = '0.6.0-alpha.76.issue33.10';

function createFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-upgrade-'));
  const directory = path.join(root, 'profile');
  const bridgeDirectory = path.join(root, 'bridge');
  const entryDir = path.join(bridgeDirectory, 'desktop', 'electron');
  fs.mkdirSync(directory);
  fs.mkdirSync(entryDir, { recursive: true });
  fs.mkdirSync(path.join(bridgeDirectory, 'dist'));
  const ledger = path.join(directory, 'pending.json');
  const bytes = '[{"id":"original-request","state":"unknown"}]';
  fs.writeFileSync(ledger, bytes);
  fs.writeFileSync(path.join(bridgeDirectory, 'package.json'), '{}');
  fs.writeFileSync(path.join(entryDir, 'runtime-capabilities.cjs'), `module.exports=require(${JSON.stringify(capabilities)});`);
  const fixture = path.join(entryDir, 'coordinator.cjs');
  fs.writeFileSync(fixture, `
    const fs = require('node:fs'), path = require('node:path');
    const [, , , directory, , version] = process.argv;
    if(process.send) require(${JSON.stringify(capabilities)}).coordinatorRuntimeCapabilities = [];
    const { startCoordinator } = require(${JSON.stringify(coordinator)});
    const state = name => path.join(directory, name);
    startCoordinator({directory, version, service:{
      dispatch(method) {
        if(method==='preferences') return {version};
        if(method==='pending') return JSON.parse(fs.readFileSync(state('pending.json')));
        throw Error('Unexpected dispatch: '+method);
      },
      close() {
        fs.appendFileSync(state('shutdown.log'), version + '\\n');
        if(process.connected) setTimeout(() => {
          fs.writeFileSync(state('old-closed'), 'closed');
          process.disconnect();
        }, 1000);
      }
    }}).then(()=>{
      if(process.send) process.send('ready');
      else if(!fs.existsSync(state('old-closed'))) throw Error('New backend started during old cleanup');
    })
      .catch(error=>{console.error(error);process.exitCode=1;if(process.connected) process.disconnect();});
  `);
  const old = fork(fixture, ['--directory', directory, '--version', oldVersion], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const ready = new Promise((resolve, reject) => {
    old.once('message', resolve);
    old.once('error', reject);
    old.once('exit', code => reject(new Error('Old fixture exited: ' + code)));
  });
  const client = new CoordinatorClient({ directory, bridgeDirectory, version: newVersion, upgradeOnStart: true });
  t.after(async () => {
    const cleanup = new CoordinatorClient({ directory });
    try {
      await cleanup.attach();
      await cleanup.send('shutdown', undefined, 2000);
    } catch {}
    cleanup.close();
    client.close();
    if(old.exitCode===null && old.signalCode===null) {
      const exited = new Promise(resolve => old.once('exit', resolve));
      old.kill();
      await exited;
    }
    await delay(300);
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  });
  return { directory, bridgeDirectory, old, ready, client, ledger, bytes };
}

test('an upgrade stops the authenticated old writer, waits for exit, and reads the original pending data with the new version', async t => {
  const f = createFixture(t);
  await f.ready;
  const identityFile = path.join(f.directory, 'coordinator-identity.json');
  const originalIdentity = fs.readFileSync(identityFile);
  // The old fixture cannot use the newer relation schema. Only shutdown may
  // use the authenticated old connection during replacement.
  fs.writeFileSync(path.join(f.directory, 'agent-network.json'), '{"relationsVersion":3}');
  const [preferences, pending] = await Promise.all([f.client.request('preferences'), f.client.request('pending')]);
  assert.equal(f.old.exitCode, 0);
  assert.equal(preferences.version, newVersion);
  assert.deepEqual(pending, JSON.parse(f.bytes));
  assert.equal(fs.readFileSync(path.join(f.directory, 'shutdown.log'), 'utf8'), oldVersion + '\n');
  assert.equal(fs.readFileSync(f.ledger, 'utf8'), f.bytes);
  assert.ok(fs.readFileSync(identityFile).equals(originalIdentity));
});

test('the same or a newer backend stays running and an invalid upgrade cannot stop it', async t => {
  const f = createFixture(t);
  await f.ready;
  for (const version of [oldVersion, '0.6.0-alpha.76.issue33.8']) {
    const client = new CoordinatorClient({ directory: f.directory, version, upgradeOnStart: true });
    try {
      assert.equal((await client.request('preferences')).version, oldVersion);
      assert.equal(client.info.pid, f.old.pid);
    } finally { client.close(); }
  }
  fs.unlinkSync(path.join(f.bridgeDirectory, 'package.json'));
  await assert.rejects(f.client.request('preferences'), { code: 'ENOENT' });
  assert.equal(f.old.exitCode, null);
  assert.equal(fs.existsSync(path.join(f.directory, 'shutdown.log')), false);
  assert.equal(f.client.socket, null);
});
