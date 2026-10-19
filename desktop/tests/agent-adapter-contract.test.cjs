'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {defineAdapter, createAdapterRegistry} = require('../electron/agent-adapter-contract.cjs');
const {exampleAdapter} = require('../../examples/custom-agent/adapter.cjs');
const host = () => ({call: async () => ({}), close() {}});
const definition = overrides => ({id: 'example', name: 'Example', commands: ['example'], npmEntrypoints: ['@example/agent/bin/cli.js'], createHost: host, ...overrides});

test('registry validates discovery data and freezes caller-independent metadata', () => {
  const input = definition({capabilities: {resume: true}}), registry = createAdapterRegistry([input]);
  input.commands.push('changed'); input.capabilities.resume = false;
  const metadata = registry.get('example');
  assert.deepEqual(metadata.commands, ['example']); assert.equal(metadata.capabilities.resume, true);
  assert.equal('createHost' in metadata, false); assert.equal(registry.list()[0], metadata);
  assert.throws(() => metadata.commands.push('other'), TypeError);
  assert.throws(() => registry.list().push({}), TypeError);
  assert.throws(() => { metadata.capabilities.resume = false; }, TypeError);
  assert.equal(registry.get('missing'), undefined);
});

test('source registration rejects unsafe identities, launch paths, unknown fields and invalid capabilities', () => {
  for (const override of [
    {id: '../agent'}, {id: 'Example'}, {name: ' '}, {name: 'Example\n'}, {commands: []},
    {commands: ['../agent']}, {commands: ['agent.exe']}, {commands: ['example', 'example']},
    {npmEntrypoints: ['/tmp/cli.js']}, {npmEntrypoints: ['@example/../cli.js']},
    {npmEntrypoints: ['C:\\tools\\cli.js']}, {npmEntrypoints: ['@example//cli.js']},
    {npmEntrypoints: ['@example/agent/cli.js', '@example/agent/CLI.js']},
    {capabilities: {resume: 'yes'}}, {capabilities: {automaticExecution: true}},
    {capabilities: {execution: 'yes'}}, {capabilities: {bridgeMcp: null}},
    {driver: 'acp'}, {driver: '/tmp/untrusted.cjs'},
    {createHost: undefined}, {modulePath: '/tmp/untrusted.cjs'},
  ]) assert.throws(() => defineAdapter(definition(override)), {code: 'ADAPTER_DEFINITION'});
});

test('connection declarations accept only source-owned booleans and fixed driver names', () => {
  const registry = createAdapterRegistry([definition({driver: 'native-cli', capabilities: {execution: true, delegation: true, bridgeMcp: false}})]);
  assert.deepEqual(registry.get('example').capabilities, {execution: true, delegation: true, bridgeMcp: false});
  assert.equal(registry.get('example').driver, 'native-cli');
  assert.equal(Object.hasOwn(createAdapterRegistry([definition()]).get('example').capabilities, 'execution'), false);
});

test('registry rejects ambiguous IDs, command aliases and Windows npm entrypoint collisions', () => {
  assert.throws(() => createAdapterRegistry([definition(), definition()]), {code: 'ADAPTER_DUPLICATE'});
  assert.throws(() => createAdapterRegistry([definition(), definition({id: 'other', npmEntrypoints: []})]), {code: 'ADAPTER_DUPLICATE'});
  assert.throws(() => createAdapterRegistry([definition(), definition({id: 'other', commands: ['other'], npmEntrypoints: ['@EXAMPLE/agent/bin/cli.js']})]), {code: 'ADAPTER_DUPLICATE'});
});

test('host construction rejects unknown adapters and incomplete or async lifecycle implementations', () => {
  let constructions = 0;
  const registry = createAdapterRegistry([definition({createHost: options => {constructions++; return {call: async () => options, close() {}};}})]);
  assert.throws(() => registry.createHost('../untrusted.cjs', {}), {code: 'ADAPTER_UNSUPPORTED'});
  assert.equal(constructions, 0);
  const options = {directory: '/example/context'}; assert.equal(typeof registry.createHost('example', options).call, 'function');
  assert.equal(constructions, 1);
  for (const factory of [() => null, () => ({call() {}}), () => ({close() {}}), async () => host()]) {
    assert.throws(() => createAdapterRegistry([definition({createHost: factory})]).createHost('example', {}), {code: 'ADAPTER_HOST'});
  }
});

test('contract-only scaffold never reports native acceptance or turns missing receipts into execution', async () => {
  const instance = createAdapterRegistry([exampleAdapter]).createHost('example-agent', {directory: '/example/context'});
  try {
    for (const op of ['submit', 'continue', 'reply', 'cancel', 'reconcile']) {
      await assert.rejects(instance.call('ipc', {op, requestId: 'original-request', operationId: 'original-operation'}), {code: 'ADAPTER_UNSUPPORTED'});
    }
    for (const op of ['request', 'operation']) await assert.rejects(instance.call('ipc', {op}), {code: 'NOT_FOUND'});
    const snapshot = await instance.call('snapshot'); assert.deepEqual(snapshot.tasks, []); assert.deepEqual(snapshot.agents.items, []);
  } finally { instance.close(); }
  await assert.rejects(instance.call('snapshot'), {code: 'ADAPTER_CLOSED'});
});
