// Windows CJS contracts; production renderer is verified separately in Edge.
if(process.platform!=='win32')throw Error('Windows required');
require('./history-detail-routing.test.cjs');
require('./machine-host-routing.test.cjs');
require('./machine-router.test.cjs');
require('./agent-network.test.cjs');
require('./pending-journal.test.cjs');
