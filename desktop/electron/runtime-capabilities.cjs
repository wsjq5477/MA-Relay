const RECOVERY_CAPABILITY='owned-object-controls-v1';
const runtimeCapabilities=[RECOVERY_CAPABILITY,'scoped-management-v1','opencode-v2-admission-v1','maintenance-persistence-v1','opencode-dual-api-v1','team-context-mcp-v1','scoped-management-execution-v1'];
const supportsCurrentCoordinator=capabilities=>Array.isArray(capabilities)&&runtimeCapabilities.every(capability=>capabilities.includes(capability));
const supportsRecovery=capabilities=>Array.isArray(capabilities)&&capabilities.includes(RECOVERY_CAPABILITY);
module.exports={RECOVERY_CAPABILITY,runtimeCapabilities,supportsRecovery,supportsCurrentCoordinator};
