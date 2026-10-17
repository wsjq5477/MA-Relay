// Run directly: Node's --test file discovery does not resolve these UNC paths.
// Real Windows runtime, isolated records and controlled backends, model 0.
if(process.platform!=='win32')throw Error('Windows required');
require('./machine-host-routing.test.cjs');
require('./machine-host-readiness.test.cjs');
require('./pending-journal.test.cjs');
