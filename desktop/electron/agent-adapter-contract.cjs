'use strict';

/**
 * Source-owned native adapter registration. No RPC value, manifest path, or
 * discovered executable is ever passed to require() by this module.
 *
 * @typedef {Object} AdapterCapabilities
 * @property {boolean} [execution] Bridge can start a native execution.
 * @property {boolean} [delegation] Receive an ordinary delegated native task.
 * @property {boolean} [bridgeMcp] Act as caller through scoped Bridge MCP.
 * @property {boolean} [resume] Continue the same persisted native Session.
 * @property {boolean} [cancellation] Request cancellation and observe its result.
 * @property {boolean} [permissions] Read/reply to native permission requests.
 * @property {boolean} [forms] Read/reply to native structured input requests.
 * @property {boolean} [verification] Perform a separate native verification task.
 * @property {boolean} [teamCollaboration] Inject the scoped Bridge MCP connection.
 *
 * @typedef {Object} AdapterDescriptor
 * @property {string} id Stable, lowercase persisted adapter identity.
 * @property {string} name Public tool name.
 * @property {ReadonlyArray<string>} commands Extensionless executable basenames.
 * @property {ReadonlyArray<string>} npmEntrypoints Paths below node_modules.
 * @property {Readonly<AdapterCapabilities>} capabilities Declared, tested features.
 * @property {'native-cli'|'cli-http'} [driver] Source-owned implementation route.
 *
 * @typedef {Object} AdapterHost
 * @property {function(string, Object=): Promise<*>} call Supports connect,
 * snapshot, and ipc operations. Submit/continue persist requestId and its input
 * fingerprint before dispatch. An unknown result is queried by the ORIGINAL
 * requestId/operationId; reads never replay a prompt, reply, or cancellation.
 * Receipt confirmation and native task completion are distinct facts.
 * @property {function(): *} close Releases observers and owned resources; does
 * not imply a native task was cancelled or completed.
 *
 * @typedef {Object} AdapterDefinition
 * @property {string} id
 * @property {string} name
 * @property {string[]} commands
 * @property {string[]} [npmEntrypoints]
 * @property {AdapterCapabilities} [capabilities]
 * @property {'native-cli'|'cli-http'} [driver]
 * @property {function(Object): AdapterHost} createHost Synchronous factory.
 */

const capabilityNames = new Set([
  'execution', 'delegation', 'bridgeMcp', 'mcpClient', 'nativeMcpConfig', 'hostManagedTask',
  'resume', 'cancellation', 'permissions', 'forms', 'verification', 'teamCollaboration',
]);
const definitionKeys = new Set(['id', 'name', 'commands', 'npmEntrypoints', 'capabilities', 'driver', 'createHost']);
const fail = (code, message) => Object.assign(new Error(message), {code});
function invalid(message) { throw fail('ADAPTER_DEFINITION', message); }
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function stringList(value, name, valid, {required = false} = {}) {
  if (!Array.isArray(value) || (required && value.length === 0)) invalid(name + ' must be an array' + (required ? ' with at least one entry.' : '.'));
  if (value.length > 64) invalid(name + ' has too many entries.');
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string' || !valid(item)) invalid('Invalid ' + name + ' entry.');
    const key = item.toLowerCase();
    if (seen.has(key)) invalid('Duplicate ' + name + ' entry.');
    seen.add(key);
  }
  return Object.freeze([...value]);
}

/** Validate and freeze an adapter definition supplied by reviewed source code.
 * @param {AdapterDefinition} definition
 * @returns {Readonly<AdapterDefinition>}
 */
function defineAdapter(definition) {
  if (!object(definition)) invalid('An adapter definition must be an object.');
  for (const key of Object.keys(definition)) if (!definitionKeys.has(key)) invalid('Unknown adapter definition field: ' + key);
  if (typeof definition.id !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(definition.id)) invalid('Invalid adapter id.');
  if (typeof definition.name !== 'string' || !definition.name.trim() || definition.name !== definition.name.trim() || definition.name.length > 100 || /[\x00-\x1f\x7f]/.test(definition.name)) invalid('Invalid adapter name.');
  if (typeof definition.createHost !== 'function') invalid('createHost must be a function.');
  if (definition.driver !== undefined && !['native-cli', 'cli-http'].includes(definition.driver)) invalid('Invalid adapter driver.');
  const commands = stringList(definition.commands, 'commands', value => /^[a-z][a-z0-9-]{0,63}$/.test(value), {required: true});
  const npmEntrypoints = stringList(definition.npmEntrypoints ?? [], 'npmEntrypoints', value =>
    value.length <= 240 && /^[a-zA-Z0-9@_./-]+$/.test(value) && !value.startsWith('/') &&
    value.split('/').every(part => part && part !== '.' && part !== '..') && /\.(?:c?js|mjs|exe)$/.test(value));
  const capabilities = definition.capabilities ?? {};
  if (!object(capabilities)) invalid('capabilities must be an object.');
  for (const [name, value] of Object.entries(capabilities)) {
    if (!capabilityNames.has(name) || typeof value !== 'boolean') invalid('Invalid adapter capability: ' + name);
  }
  return Object.freeze({
    id: definition.id, name: definition.name, commands, npmEntrypoints,
    ...(definition.driver === undefined ? {} : {driver: definition.driver}),
    capabilities: Object.freeze({...capabilities}), createHost: definition.createHost,
  });
}

/** Validate the lifecycle boundary; native protocol semantics remain the host's
 * responsibility and must be covered by that adapter's integration tests.
 * @param {*} host
 * @param {string} [id]
 * @returns {AdapterHost}
 */
function assertAdapterHost(host, id = 'adapter') {
  if (!object(host) || typeof host.then === 'function' || typeof host.call !== 'function' || typeof host.close !== 'function') {
    throw fail('ADAPTER_HOST', id + ' must synchronously create a host with call() and close().');
  }
  return host;
}

/** Build an isolated registry from a static list, rejecting ambiguous discovery.
 * The returned metadata contains no factory or adapter module loading target.
 * @param {AdapterDefinition[]} definitions
 */
function createAdapterRegistry(definitions) {
  if (!Array.isArray(definitions)) invalid('Adapter definitions must be an array.');
  const factories = new Map(), metadata = new Map(), commands = new Set(), npmEntrypoints = new Set();
  for (const input of definitions) {
    const definition = defineAdapter(input);
    if (factories.has(definition.id)) throw fail('ADAPTER_DUPLICATE', 'Duplicate adapter id: ' + definition.id);
    for (const name of definition.commands) {
      if (commands.has(name)) throw fail('ADAPTER_DUPLICATE', 'Ambiguous adapter command: ' + name);
      commands.add(name);
    }
    for (const name of definition.npmEntrypoints) {
      const key = name.toLowerCase();
      if (npmEntrypoints.has(key)) throw fail('ADAPTER_DUPLICATE', 'Ambiguous adapter npm entrypoint: ' + name);
      npmEntrypoints.add(key);
    }
    factories.set(definition.id, definition.createHost);
    metadata.set(definition.id, Object.freeze({
      id: definition.id, name: definition.name, commands: definition.commands,
      npmEntrypoints: definition.npmEntrypoints, capabilities: definition.capabilities,
      ...(definition.driver === undefined ? {} : {driver: definition.driver}),
    }));
  }
  const descriptors = Object.freeze([...metadata.values()]);
  return Object.freeze({
    list: () => descriptors,
    get: id => metadata.get(id),
    createHost(id, options) {
      const factory = factories.get(id);
      if (!factory) throw fail('ADAPTER_UNSUPPORTED', 'Unsupported native adapter: ' + String(id));
      return assertAdapterHost(factory(options), id);
    },
  });
}

module.exports = {defineAdapter, createAdapterRegistry, assertAdapterHost};
