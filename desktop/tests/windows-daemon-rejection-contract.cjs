// Run directly with Windows Node; synthetic profiles, no Agent or SSH server.
if(process.platform!=='win32')throw Error('Windows required');
require('./daemon-rejection-recovery.test.cjs');
require('./pending-journal.test.cjs');
require('./agent-network.test.cjs');
require('./machine-host-routing.test.cjs');
