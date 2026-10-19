'use strict';
const assert = require('node:assert/strict');
const {createAdapterRegistry} = require('../../desktop/electron/agent-adapter-contract.cjs');
const {exampleAdapter} = require('./adapter.cjs');

async function check() {
  const registry = createAdapterRegistry([exampleAdapter]);
  assert.equal(registry.get('example-agent').name, 'Example Agent (contract scaffold)');
  const host = registry.createHost('example-agent', {directory: __dirname});
  try {
    assert.deepEqual((await host.call('snapshot')).tasks, []);
    await assert.rejects(host.call('ipc', {op: 'submit', requestId: 'example-original-request', message: 'contract check'}), {code: 'ADAPTER_UNSUPPORTED'});
    await assert.rejects(host.call('ipc', {op: 'request', requestId: 'example-original-request'}), {code: 'NOT_FOUND'});
    process.stdout.write('Custom-agent contract scaffold passed; native executions: 0.\n');
  } finally { host.close(); }
}

module.exports = {check};
if (require.main === module) check().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
