// Presentation phases are observations, never evidence of task completion.
const transitional=new Set(['validating_host','awaiting_host_trust','authenticating','inspecting','ready','installing','starting','handshaking','reconnecting']);
const isSshTransition=stage=>transitional.has(stage);
const versionRefusal=code=>code==='SSH_DAEMON_UPGRADE_REQUIRED';
module.exports={isSshTransition,versionRefusal};
