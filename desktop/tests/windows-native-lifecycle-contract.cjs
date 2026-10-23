// Windows production CJS contracts / isolated fixtures / model 0.
if(process.platform!=='win32')throw Error('Windows required');
for(const name of ['native-lifecycle-scope','graph-operations','mcp-remote-routing'])require('./'+name+'.test.cjs');
