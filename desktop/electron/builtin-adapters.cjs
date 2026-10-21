const { createAdapterRegistry } = require('./agent-adapter-contract.cjs');
// Code-owned registration only. Deferred imports keep discovery metadata usable
// without loading MachineHost, a native process, or a provider SDK.
const adapters = createAdapterRegistry([
  ...['dsh-desktop', 'dsh-web'].map(id => ({
    id, name: id === 'dsh-desktop' ? 'DSH Desktop' : 'DSH Web', commands: [id], npmEntrypoints: [], driver: 'cli-http',
    capabilities: {execution: true, delegation: true, bridgeMcp: false, resume: true, cancellation: true, permissions: false, forms: false, verification: false, teamCollaboration: false},
    createHost: options => new (require('./native-cli-host.cjs').NativeCliHost)({...options, adapter: id}),
  })),
  {
    id: 'claude', name: 'Claude Code', commands: ['claude'],
    npmEntrypoints: ['@anthropic-ai/claude-code/bin/claude.exe', '@anthropic-ai/claude-code/cli.js'],
    driver: 'native-cli',
    capabilities: { execution: true, delegation: true, bridgeMcp: true, resume: true, cancellation: true, permissions: true, forms: false, verification: true, teamCollaboration: true },
    createHost: options => new (require('./claude-host.cjs').ClaudeHost)({ directory: options.directory, home: options.home, candidates: [options.executable], environment: options.environment }),
  },
  {
    id: 'opencode', name: 'OpenCode', commands: ['opencode'],
    npmEntrypoints: ['opencode-windows-x64/bin/opencode.exe', 'opencode-ai/node_modules/opencode-windows-x64/bin/opencode.exe'],
    driver: 'cli-http',
    capabilities: { execution: true, delegation: true, bridgeMcp: true, resume: true, cancellation: true, permissions: true, forms: true, verification: true, teamCollaboration: true },
    createHost: options => options.openCode?.(options.directory),
  },
  {
    id: 'codex', name: 'Codex', commands: ['codex'], npmEntrypoints: ['@openai/codex/bin/codex.js'],
    driver: 'native-cli',
    capabilities: { execution: true, delegation: true, bridgeMcp: true, resume: true, cancellation: true, permissions: false, forms: false, verification: false, teamCollaboration: true },
    createHost: options => options.codex ? options.codex(options.directory, options.executable) : new (require('./codex-host.cjs').CodexHost)({ directory: options.directory, executable: options.executable }),
  },
  ...[
    { id: 'hermes', name: 'Hermes Agent', npmEntrypoints: [] },
    { id: 'pi', name: 'Pi', npmEntrypoints: ['@earendil-works/pi-coding-agent/dist/bundle/cli.js', '@earendil-works/pi-coding-agent/dist/cli.js', '@mariozechner/pi-coding-agent/dist/cli.js'] },
    { id: 'dsh', name: 'DeepSeek Harness', npmEntrypoints: ['@deepseek-ai/dsh/lib/bin.js'] },
  ].map(definition => ({ ...definition, commands: [definition.id], driver: 'native-cli', capabilities: { execution: true, delegation: true, bridgeMcp: false, resume: true, cancellation: true, permissions: false, forms: false, verification: false, teamCollaboration: false }, createHost: options => new (require('./native-cli-host.cjs').NativeCliHost)({ ...options, adapter: definition.id }) })),
]);
const connectionCapabilityNames = ['execution', 'delegation', 'bridgeMcp', 'resume', 'cancellation', 'permissions', 'forms', 'verification'];
// Static implementation declarations are an upper bound, not installation,
// account, model, remote daemon or field acceptance evidence. A stale/remote
// false or unknown may narrow them; untrusted metadata cannot enable features.
function connectionCapabilities(node) {
  const descriptor = adapters.get(node?.adapter), declared = descriptor?.capabilities;
  const capabilities = Object.fromEntries(connectionCapabilityNames.map(name => {
    let value = typeof declared?.[name] === 'boolean' ? declared[name] : null;
    if (value === true && node?.connectionCapabilities !== undefined) {
      const observed = node.connectionCapabilities && Object.hasOwn(node.connectionCapabilities, name) ? node.connectionCapabilities[name] : null;
      value = observed === true ? true : observed === false ? false : null;
    }
    if (value === true && (node?.capabilitySource?.kind === 'unknown' || node?.capabilitySource?.adapterId && node.capabilitySource.adapterId !== node.adapter)) value = null;
    return [name, value];
  }));
  if (node?.executionSupported === false) {capabilities.execution = false; capabilities.delegation = false; capabilities.bridgeMcp = false;}
  if (capabilities.execution !== true && capabilities.delegation === true) capabilities.delegation = capabilities.execution;
  if (node?.teamCollaboration === false && capabilities.bridgeMcp === true) capabilities.bridgeMcp = false;
  return {connectionCapabilities: capabilities, capabilitySource: descriptor
    ? {kind: 'static-adapter', adapterId: descriptor.id, ...(descriptor.driver ? {driver: descriptor.driver} : {})}
    : {kind: 'unknown'}};
}
// Only this process can brand a proven pre-execution capability refusal. A JSON
// RPC error carrying the same public code is not proof that work never ran.
const capabilityRejections = new WeakSet();
function collaborationCapabilityError(message) {
  const error = Object.assign(new Error(message), {code: 'COLLABORATION_CAPABILITY'});
  capabilityRejections.add(error);return error;
}
function isCollaborationCapabilityRejection(error) {return !!error && capabilityRejections.has(error);}
// This is the local adapter admission gate, not remote capability negotiation.
// Old nodes may omit the field; a flag cannot enable an unsupported or unknown
// adapter. The actual remote context/scope still confirms backend support.
function supportsTeamCollaboration(node) {
  const capabilities = connectionCapabilities(node).connectionCapabilities;
  return adapters.get(node?.adapter)?.capabilities.teamCollaboration === true
    && capabilities.execution === true && capabilities.bridgeMcp === true
    && (node.teamCollaboration === undefined || node.teamCollaboration === true);
}
module.exports = { adapters, supportsTeamCollaboration, connectionCapabilities, collaborationCapabilityError, isCollaborationCapabilityRejection };
