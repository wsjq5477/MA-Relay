const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {McpIntegration} = require('../electron/mcp-integration.cjs');

function fixture(t, adapter, executable, environment = process.env) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-native-list-'));
  t.after(() => fs.promises.rm(root, {recursive:true, force:true, maxRetries:8, retryDelay:100}));
  const integration = new McpIntegration({directory:root, home:root, environment, candidates:{[adapter]:[path.join(root, executable)]}}, {});
  return {root, integration, executable:path.join(root, executable)};
}

for (const adapter of ['claude', 'codex', 'opencode']) {
  test(adapter + ' native MCP list launches the selected script with literal arguments and inherited settings', async t => {
    const f = fixture(t, adapter, 'selected entry.cjs', {...process.env, AB_NATIVE_LIST_TEST:'native-default'});
    const log = path.join(f.root, 'invocation.json');
    fs.writeFileSync(f.executable, `require('node:fs').writeFileSync(${JSON.stringify(log)}, JSON.stringify({args:process.argv.slice(2),setting:process.env.AB_NATIVE_LIST_TEST})); console.log('agentbridge: Connected');`);
    const result = await f.integration.nativeProbe(adapter);
    assert.equal(result.kind, 'native-list');
    assert.equal(result.outcome, adapter === 'claude' ? 'connected' : 'listed');
    assert.deepEqual(JSON.parse(fs.readFileSync(log, 'utf8')), {args:['mcp', 'list'], setting:'native-default'});
    assert.equal(fs.existsSync(f.integration.file), false, 'a native observation cannot create authorization');
  });
}

test('an unsupported selected npm shim reports a native probe error without executing a shell or guessing another installation', async t => {
  const f = fixture(t, 'claude', 'claude.cmd');
  const marker = path.join(f.root, 'shell-must-not-run.txt');
  fs.writeFileSync(f.executable, `echo unsafe > "${marker}"`);
  const result = await f.integration.nativeProbe('claude');
  assert.equal(result.outcome, 'error');
  assert.equal(result.detail, 'TOOL_LAUNCHER');
  assert.equal(fs.existsSync(marker), false);
  assert.equal(fs.existsSync(f.integration.file), false);
});

test('an OS launch failure remains a failed native observation and does not escape the probe', async t => {
  const f = fixture(t, 'claude', 'invalid-native.exe');
  fs.writeFileSync(f.executable, Buffer.from([0, 1, 2, 3]));
  const result = await f.integration.nativeProbe('claude');
  assert.equal(result.kind, 'native-list');
  assert.equal(result.outcome, 'error');
  assert.equal(fs.existsSync(f.integration.file), false);
});
