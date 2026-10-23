const RECOVERY_CAPABILITY='owned-object-controls-v1';
const MCP_OPEN_ACCESS_CAPABILITY='mcp-open-access-v1';
// Ordinary coordinator calls keep their original requirement set. A new MCP
// capability must never turn into a blanket "upgrade every method" gate.
const coordinatorCapabilities=[RECOVERY_CAPABILITY,'scoped-management-v1','opencode-v2-admission-v1','maintenance-persistence-v1','opencode-dual-api-v1','team-context-mcp-v1','dsh-web-desktop-v1','scoped-management-execution-v1','scoped-node-management-v1','scoped-relation-management-v1'];
// Advertised list: coordinator hello and daemon hello both spread this array, and
// maintenance bundles stage this file verbatim.
const runtimeCapabilities=[...coordinatorCapabilities,MCP_OPEN_ACCESS_CAPABILITY,'opendesk-mcp-lifecycle-v1'];
const supportsCurrentCoordinator=capabilities=>Array.isArray(capabilities)&&coordinatorCapabilities.every(capability=>capabilities.includes(capability));
const supportsRecovery=capabilities=>Array.isArray(capabilities)&&capabilities.includes(RECOVERY_CAPABILITY);
// Richer MCP status facts and revocation need this marker. Its absence means the
// peer cannot be probed or revoked safely; callers must report an upgrade instead
// of assuming the capability exists.
const supportsMcpOpenAccess=capabilities=>Array.isArray(capabilities)&&capabilities.includes(MCP_OPEN_ACCESS_CAPABILITY);
module.exports={RECOVERY_CAPABILITY,MCP_OPEN_ACCESS_CAPABILITY,coordinatorCapabilities,runtimeCapabilities,supportsRecovery,supportsCurrentCoordinator,supportsMcpOpenAccess};
