const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { CustomRuntimeStore } = require('../electron/custom-runtime.cjs');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-custom-runtime-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const program = path.join(directory, 'version.cjs');
  fs.writeFileSync(program, "console.log('1.4.0');");
  return { directory, store: new CustomRuntimeStore(directory), input: { adapter: 'pi', name: 'Custom Pi', command: `"${process.execPath}" "${program}"`, profileId: randomUUID() } };
}

test('Pi profile persists its protocol across restart and cannot change protocol under the same identity', async t => {
  const f = fixture(t), created = await f.store.create(f.input);
  const reopened = new CustomRuntimeStore(f.directory);
  assert.equal(reopened.read(created.executable).adapter, 'pi');
  assert.equal(reopened.list()[0].adapter, 'pi');
  assert.deepEqual(await reopened.create(f.input), created);
  await assert.rejects(reopened.create({ ...f.input, adapter: 'hermes' }), { code: 'CUSTOM_RUNTIME_INVALID' });
});

test('legacy Hermes profiles without adapter retain their identity and idempotent creation', async t => {
  const f = fixture(t), input = { ...f.input, adapter: 'hermes' };
  const created = await f.store.create(input);
  const file = path.join(f.store.directory, input.profileId + '.json');
  const old = JSON.parse(fs.readFileSync(file, 'utf8')); delete old.adapter;
  fs.writeFileSync(file, JSON.stringify(old));
  assert.equal(f.store.read(created.executable).adapter, 'hermes');
  assert.equal(f.store.list()[0].adapter, 'hermes');
  assert.deepEqual(await f.store.create(input), created);
  await assert.rejects(f.store.create({ ...input, adapter: 'pi' }), { code: 'CUSTOM_RUNTIME_INVALID' });
});

test('Pi rejects flags that override protocol, original session or native model selection before probing', async t => {
  const f = fixture(t);
  for (const flag of ['--mode rpc', '--print', '-p', '--session foreign', '--session-dir=/foreign', '--continue', '-c', '--resume', '-rforeign', '--no-session', '--model foreign', '--provider=foreign', '--api-key=secret', '--export=foreign', '--help', '--version', '--']) {
    await assert.rejects(f.store.create({ ...f.input, command: f.input.command + ' ' + flag }), { code: 'CUSTOM_RUNTIME_INVALID' });
  }
  assert.equal(f.store.list().length, 0);
});


test('a saved runtime cannot be executed through a different protocol context', t => {
  const { MachineHost } = require('../electron/machine-host.cjs');
  const host = { contexts: new Map(), directory: os.tmpdir(), customRuntimes: { read: () => ({ adapter: 'pi' }) } };
  assert.throws(() => MachineHost.prototype.backend.call(host, { contextId: 'original', adapter: 'hermes', executable: 'custom-runtime:original' }), { code: 'CONVERSATION_CONFIG' });
  assert.equal(host.contexts.size, 0);
});
