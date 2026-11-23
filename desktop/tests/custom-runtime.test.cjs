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

test('ACP registration verifies v1 on stdio, keeps its fixed argv, and stores negotiated resume', async t => {
  const f = fixture(t);
  const source = path.join(f.directory, 'acp.cjs');
  const wire = path.join(f.directory, 'wire.json');
  fs.writeFileSync(source, `
const fs = require('node:fs');
const readline = require('node:readline');
readline.createInterface({input:process.stdin}).on('line', line => {
  const frame = JSON.parse(line);
  fs.appendFileSync(process.argv[2], frame.method+'\\n');
  if (frame.method === 'initialize') process.stdout.write(JSON.stringify({
    jsonrpc:'2.0', id:frame.id, result:{protocolVersion:1,agentInfo:{version:'1.2.3'},
      agentCapabilities:{loadSession:process.argv[3]==='load'}}
  })+'\\n');
});
`);
  for (const mode of ['load', 'none']) {
    const input = {...f.input, adapter:'acp', profileId:randomUUID(), command:`"${process.execPath}" "${source}" "${wire}" ${mode}`};
    const result = await f.store.create(input);
    const reopened = new CustomRuntimeStore(f.directory);
    const found = reopened.list().find(row => row.executable === result.executable);
    assert.equal(found.acpResume, mode === 'load');
    assert.equal(found.version, '1.2.3');
    assert.deepEqual(reopened.read(result.executable).args, [source, wire, mode]);
    assert.deepEqual(await reopened.create(input), result);
  }
  assert.deepEqual(fs.readFileSync(wire, 'utf8').trim().split('\n'), ['initialize','initialize']);
  await assert.rejects(f.store.create({...f.input,adapter:'acp'}), {code:'CUSTOM_RUNTIME_INVALID'});
  assert.equal(f.store.list().length, 2);
});

test('ACP resolves a Windows npm bin without executing its batch launcher', { skip: process.platform !== 'win32' }, async t => {
  const f = fixture(t);
  const packageRoot = path.join(f.directory, 'node_modules', '@fixture', 'agent');
  fs.mkdirSync(packageRoot, { recursive: true });
  const program = path.join(packageRoot, 'agent.cjs');
  fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({name:'@fixture/agent',bin:{'fixture-acp':'agent.cjs'}}));
  fs.writeFileSync(program, `
require('node:readline').createInterface({input:process.stdin}).on('line', line => {
  const frame=JSON.parse(line);
  if(process.argv[2]==='--acp' && frame.method==='initialize')
    process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:frame.id,result:{protocolVersion:1}})+'\\n');
});
`);
  const shim = path.join(f.directory, 'fixture-acp.cmd');
  const npmLauncher = [
    '@ECHO off',
    'EXIT /B 9',
    ' SET "_prog=node"',
    'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & set PATHEXT=%PATHEXT:;.JS;=;% & "%_prog%" "%dp0%\\node_modules\\@fixture\\agent\\agent.cjs" %*',
  ].join('\r\n')+'\r\n';
  fs.writeFileSync(shim, npmLauncher);
  const store = new CustomRuntimeStore(f.directory, { ...process.env, PATH: f.directory });
  const input = {...f.input, adapter:'acp', command:'fixture-acp --acp'};
  const result = await store.create(input);
  assert.equal(store.read(result.executable).program, fs.realpathSync(program));
  assert.deepEqual(store.read(result.executable).args, ['--acp']);

  fs.writeFileSync(shim, npmLauncher.replace('agent.cjs', 'undeclared.cjs'));
  fs.copyFileSync(program, path.join(packageRoot, 'undeclared.cjs'));
  await assert.rejects(store.create({...input, profileId:randomUUID()}), {code:'CUSTOM_RUNTIME_INVALID'});
});
