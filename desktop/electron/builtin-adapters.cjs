const { createAdapterRegistry } = require('./agent-adapter-contract.cjs');
// Code-owned registration only. Deferred imports keep discovery metadata usable
// without loading MachineHost, a native process, or a provider SDK.
//
// Capability contract (I08-MCP02): four independent questions are never folded
// into one flag.
//   nativeMcpConfig — Bridge can read/manage this product's own native MCP entry
//   mcpClient       — the product implements an MCP client that can load the
//                     AgentBridge MCP server (independent of hosted sessions)
//   hostManagedTask — Bridge can inject a per-managed-task scoped MCP into its
//                     managed session; this is the ONLY hosted-scope admission
//   execution/delegation — Bridge can drive the node / it may receive ordinary work
// `bridgeMcp` and `teamCollaboration` stay in the projection as legacy aliases of
// mcpClient and hostManagedTask. A product with no MCP client evidence omits
// mcpClient so the projection reports unknown instead of "not supported".
const adapters = createAdapterRegistry([
  // OpenDesk CLI 0.3.8 exposes no MCP manager: `opendesk plugins list/tools` has no
  // MCP entry and launching it rewrites setting.json dropping unrecognized
  // `applications` sections, so only the Desktop surface keeps a write adapter (its
  // native read is still unverified). Both keep independent MCP client support.
  ...['opendesk', 'opendesk-desktop'].map(id => ({
    id, name: id === 'opendesk' ? 'OpenDesk' : 'OpenDesk Desktop', commands: [id], npmEntrypoints: [], driver: 'cli-http',
    capabilities: {execution: true, delegation: true, mcpClient: true, nativeMcpConfig: id === 'opendesk-desktop', hostManagedTask: false, resume: true, cancellation: true, permissions: false, forms: false, verification: false},
    createHost: options => new (require('./native-cli-host.cjs').NativeCliHost)({...options, adapter: id}),
  })),
  // DSH Desktop resolves its native data-directory and profile-selection state;
  // Web uses the fixed web profile. Both edit only the target's user patch layer.
  ...['dsh-desktop', 'dsh-web'].map(id => ({
    id, name: id === 'dsh-desktop' ? 'DSH Desktop' : 'DSH Web', commands: [id], npmEntrypoints: [], driver: 'cli-http',
    capabilities: {execution: true, delegation: true, mcpClient: true, nativeMcpConfig: true, hostManagedTask: false, resume: true, cancellation: true, permissions: false, forms: false, verification: false},
    createHost: options => new (require('./native-cli-host.cjs').NativeCliHost)({...options, adapter: id}),
  })),
  {
    id: 'claude', name: 'Claude Code', commands: ['claude'],
    npmEntrypoints: ['@anthropic-ai/claude-code/bin/claude.exe', '@anthropic-ai/claude-code/cli.js'],
    driver: 'native-cli',
    capabilities: { execution: true, delegation: true, mcpClient: true, nativeMcpConfig: true, hostManagedTask: true, resume: true, cancellation: true, permissions: true, forms: false, verification: true },
    createHost: options => new (require('./claude-host.cjs').ClaudeHost)({ directory: options.directory, home: options.home, candidates: [options.executable], environment: options.environment }),
  },
  {
    id: 'opencode', name: 'OpenCode', commands: ['opencode'],
    npmEntrypoints: ['opencode-windows-x64/bin/opencode.exe', 'opencode-ai/node_modules/opencode-windows-x64/bin/opencode.exe'],
    driver: 'cli-http',
    capabilities: { execution: true, delegation: true, mcpClient: true, nativeMcpConfig: true, hostManagedTask: true, resume: true, cancellation: true, permissions: true, forms: true, verification: true },
    createHost: options => options.openCode?.(options.directory),
  },
  {
    id: 'codex', name: 'Codex', commands: ['codex'], npmEntrypoints: ['@openai/codex/bin/codex.js'],
    driver: 'native-cli',
    capabilities: { execution: true, delegation: true, mcpClient: true, nativeMcpConfig: true, hostManagedTask: true, resume: true, cancellation: true, permissions: false, forms: false, verification: false },
    createHost: options => options.codex ? options.codex(options.directory, options.executable) : new (require('./codex-host.cjs').CodexHost)({ directory: options.directory, executable: options.executable }),
  },
  ...[
    { id: 'hermes', name: 'Hermes Agent', npmEntrypoints: [] },
    { id: 'pi', name: 'Pi', npmEntrypoints: ['@earendil-works/pi-coding-agent/dist/bundle/cli.js', '@earendil-works/pi-coding-agent/dist/cli.js', '@mariozechner/pi-coding-agent/dist/cli.js'] },
    { id: 'dsh', name: 'DeepSeek Harness', npmEntrypoints: ['@deepseek-ai/dsh/lib/bin.js'] },
  ].map(definition => ({
    ...definition, commands: [definition.id], driver: 'native-cli',
    // Hermes and Pi have reviewed independent native MCP configuration adapters.
    // Their hosted task scope remains a separate, unimplemented capability.
    // DSH CLI keeps one native profile per launch argument, so Bridge can manage
    // its MCP entry only when the user names that profile explicitly (the MCP
    // status reports `MCP_DSH_PROFILE_REQUIRED` until then).
    capabilities: { execution: true, delegation: true, mcpClient: true, nativeMcpConfig: true, hostManagedTask: false, resume: true, cancellation: definition.id !== 'hermes', permissions: false, forms: false, verification: false },
    createHost: options => new (require('./native-cli-host.cjs').NativeCliHost)({ ...options, adapter: definition.id }),
  })),
]);
const connectionCapabilityNames = ['execution', 'delegation', 'mcpClient', 'nativeMcpConfig', 'hostManagedTask', 'resume', 'cancellation', 'permissions', 'forms', 'verification'];
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
  if (node?.executionSupported === false) {
    for (const name of connectionCapabilityNames) if (capabilities[name] === true) capabilities[name] = false;
  }
  if (capabilities.execution !== true && capabilities.delegation === true) capabilities.delegation = capabilities.execution;
  // Hosted task binding is its own admission. A product that cannot host a
  // scoped session keeps independent MCP call ability; the two are never folded.
  if (capabilities.execution !== true && capabilities.hostManagedTask === true) capabilities.hostManagedTask = capabilities.execution;
  // Legacy aliases: old snapshots, planner code and the renderer read these.
  // An older node payload may narrow through the legacy name only; that can
  // still only narrow, never widen, the reviewed declaration.
  const legacy = node?.connectionCapabilities && typeof node.connectionCapabilities === 'object' ? node.connectionCapabilities : undefined;
  capabilities.bridgeMcp = capabilities.mcpClient;
  // An explicit old-style false is a real observation and narrows even an
  // unknown projection; it can never enable anything.
  if (legacy && Object.hasOwn(legacy, 'bridgeMcp') && legacy.bridgeMcp === false) capabilities.bridgeMcp = false;
  // A node that reports hosted scope unsupported narrows the hosted dimension
  // only; its independent MCP ability and authorization stay untouched.
  if (node?.teamCollaboration === false && capabilities.hostManagedTask === true) capabilities.hostManagedTask = false;
  capabilities.teamCollaboration = capabilities.hostManagedTask;
  if (node?.teamCollaboration === false && capabilities.teamCollaboration === true) capabilities.teamCollaboration = false;
  if (legacy && Object.hasOwn(legacy, 'teamCollaboration') && legacy.teamCollaboration === false && capabilities.teamCollaboration === true) capabilities.teamCollaboration = false;
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
// This is the local adapter admission gate for a Bridge-hosted, scoped task — not
// remote capability negotiation and not independent MCP call ability. Old nodes
// may omit the field; a flag cannot enable an unsupported or unknown adapter.
// The actual remote context/scope still confirms backend support.
function supportsTeamCollaboration(node) {
  const capabilities = connectionCapabilities(node).connectionCapabilities;
  return adapters.get(node?.adapter)?.capabilities.hostManagedTask === true
    && capabilities.execution === true && capabilities.hostManagedTask === true
    && capabilities.mcpClient === true
    && (node.teamCollaboration === undefined || node.teamCollaboration === true);
}
// Independent MCP call admission: product MCP client support plus execution.
// Native config adaptation is reported separately by the MCP status facts.
function supportsIndependentMcp(node) {
  const capabilities = connectionCapabilities(node).connectionCapabilities;
  return capabilities.execution === true && capabilities.mcpClient === true;
}
module.exports = { adapters, supportsTeamCollaboration, supportsIndependentMcp, connectionCapabilities, collaborationCapabilityError, isCollaborationCapabilityRejection };
