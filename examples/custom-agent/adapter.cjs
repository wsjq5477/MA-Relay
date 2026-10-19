'use strict';

// Contract-only scaffold. Importing this file does not register a production
// adapter, scan a machine, invoke a native CLI, or load user-supplied modules.
const {defineAdapter} = require('../../desktop/electron/agent-adapter-contract.cjs');
const unsupported = () => Object.assign(new Error('This scaffold has no native execution implementation.'), {code: 'ADAPTER_UNSUPPORTED'});

class ExampleHost {
  constructor(options) { this.directory = options.directory; this.closed = false; }
  async call(method, params = {}) {
    if (this.closed) throw Object.assign(new Error('The example host is closed.'), {code: 'ADAPTER_CLOSED'});
    if (method === 'snapshot') return {agents: {items: [], connected: false, revision: 1}, tasks: [], conversations: []};
    if (method === 'ipc' && ['request', 'operation'].includes(params.op)) {
      // Absence is a read result. It is never proof that an earlier real native
      // operation did not run, and never triggers a replacement submission.
      throw Object.assign(new Error('No receipt exists in this contract-only scaffold.'), {code: 'NOT_FOUND'});
    }
    throw unsupported();
  }
  close() { this.closed = true; }
}

const exampleAdapter = defineAdapter({
  id: 'example-agent', name: 'Example Agent (contract scaffold)',
  commands: ['example-agent'], npmEntrypoints: ['@example/agent/bin/cli.js'],
  capabilities: {resume: false, cancellation: false, permissions: false, forms: false, verification: false, teamCollaboration: false},
  createHost: options => new ExampleHost(options),
});

module.exports = {exampleAdapter, ExampleHost};
