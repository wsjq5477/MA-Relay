// Windows Node / synthetic profiles only; no native Agent is started.
// Run directly because --test discovery cannot resolve these UNC file paths.
if(process.platform!=='win32')throw Error('Windows required');
require('./codex-recovery.test.cjs');
require('./network-persistence.test.cjs');
require('./agent-network.test.cjs');
require('./machine-host-routing.test.cjs');
require('./pending-journal.test.cjs');
