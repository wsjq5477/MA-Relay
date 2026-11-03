// User-side administration over the authenticated local coordinator IPC. This
// command manages explicit user caller policies, and never starts a native task.
const fs = require('node:fs');
const path = require('node:path');
const {CoordinatorClient} = require('../electron/coordinator-client.cjs');
const methods = new Set([...require('../electron/agent-directory.cjs').methods,...require('../electron/caller-service.cjs').methods]);

async function main(argv) {
  let directory, paramsFile, method;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--directory') directory = argv[++i];
    else if (argv[i] === '--params') paramsFile = argv[++i];
    else if (!method && methods.has(argv[i])) method = argv[i];
    else throw Error('用法：node desktop/scripts/agent-directory.cjs --directory D:\\BridgeProfile agents.*|callers.* [--params D:\\request.json]');
  }
  if (!directory || !path.isAbsolute(directory) || !method) throw Error('必须明确指定原 profile 的绝对目录与 agents.* 方法。');
  const params = paramsFile ? JSON.parse(fs.readFileSync(paramsFile, 'utf8')) : {};
  if (!params || typeof params !== 'object' || Array.isArray(params)) throw Error('参数文件必须包含 JSON 对象。');
  const client = new CoordinatorClient({directory, version: require('../package.json').version});
  try {
    const reply = await client.request('call', {method, params});
    if (!reply.ok) throw Object.assign(Error(reply.error.message), {code: reply.error.code});
    process.stdout.write(JSON.stringify(reply.result, null, 2) + '\n');
  } finally { client.close(); }
}
if (require.main === module) main(process.argv.slice(2)).catch(error => { process.stderr.write((error.code || 'AGENT_DIRECTORY') + ': ' + error.message + '\n'); process.exitCode = 1; });
module.exports = {main};
