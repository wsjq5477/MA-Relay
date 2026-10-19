// Windows production CJS regressions; no real native model or SSH server.
if(process.platform!=='win32')throw Error('Windows required');
require('./graph-operations.test.cjs');
require('./machine-host-readiness.test.cjs');
