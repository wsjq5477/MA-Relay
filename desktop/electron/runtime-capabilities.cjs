const RECOVERY_CAPABILITY='owned-object-controls-v1';
const runtimeCapabilities=[RECOVERY_CAPABILITY];
const supportsRecovery=capabilities=>Array.isArray(capabilities)&&capabilities.includes(RECOVERY_CAPABILITY);
module.exports={RECOVERY_CAPABILITY,runtimeCapabilities,supportsRecovery};
