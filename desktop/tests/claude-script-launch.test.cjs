const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const {cliCommand} = require('../electron/claude-host.cjs');
const {scanTools} = require('../electron/tool-discovery.cjs');
const run = promisify(execFile);

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-claude-script-'));
  t.after(() => fs.promises.rm(directory, {recursive:true, force:true, maxRetries:8, retryDelay:100}));
  return directory;
}

test('Claude launches selected JS, CJS and MJS scripts with literal arguments and inherited environment', async t => {
  const directory = fixture(t), args = ['--query', '原需求 & echo injected | $() `test` "quoted"\nnext'];
  for (const extension of ['js', 'cjs', 'mjs']) {
    const script = path.join(directory, 'selected script.' + extension);
    fs.writeFileSync(script, 'console.log(JSON.stringify({args:process.argv.slice(2),inherited:process.env.BRIDGE_CONTROLLED_SETTING,nodeMode:process.env.ELECTRON_RUN_AS_NODE}));');
    const environment = {...process.env, BRIDGE_CONTROLLED_SETTING:'native-default', ELECTRON_RUN_AS_NODE:'0'};
    const command = cliCommand(script, args, environment);
    assert.equal(command.executable, process.execPath);
    assert.deepEqual(command.args, [script, ...args]);
    const {stdout} = await run(command.executable, command.args, {env:command.env, cwd:directory, windowsHide:true});
    assert.deepEqual(JSON.parse(stdout), {args, inherited:'native-default', nodeMode:'1'});
    assert.equal(environment.ELECTRON_RUN_AS_NODE, '0');
  }
});

test('Claude can launch the exact npm script identity returned by shared machine discovery', async t => {
  const directory = fixture(t), launcher = path.join(directory, 'claude.cmd');
  const script = path.join(directory, 'node_modules/@anthropic-ai/claude-code/cli.js');
  fs.mkdirSync(path.dirname(script), {recursive:true});
  fs.writeFileSync(script, 'console.log("2.1.290 (Claude Code)");');
  fs.writeFileSync(launcher, 'this wrapper must not execute');
  const candidates = Object.fromEntries(['claude','opencode','codex','hermes','pi','dsh','opendesk'].map(id => [id, id === 'claude' ? [launcher] : []]));
  const found = (await scanTools({home:directory, candidates})).find(item => item.adapter === 'claude');
  assert.equal(found.healthy, true);
  assert.equal(found.executable, script);
  const command = cliCommand(found.executable, ['--version']);
  const {stdout} = await run(command.executable, command.args, {env:command.env, cwd:directory, windowsHide:true});
  assert.match(stdout, /2\.1\.290 \(Claude Code\)/);
});
