// Windows production Coordinator/AgentNetwork/HostConnection -> actual WSL; model 0.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
const {spawn} = require('node:child_process'), {randomUUID, createHash} = require('node:crypto');
const [bridge, output, distribution = 'Ubuntu', exe, samplesArg = '180', intervalArg = '5000'] = process.argv.slice(2);
if (process.platform !== 'win32' || !output) throw Error('Windows runtime, final Bridge resources and report path required');
const sampleCount=Number(samplesArg),intervalMs=Number(intervalArg);assert(Number.isInteger(sampleCount)&&sampleCount>=180&&sampleCount<=720);assert(Number.isInteger(intervalMs)&&intervalMs>=5000&&intervalMs<=10000);
const expectedHash='2ba100ea01ceee057bed3a03763b92a442c75bd4b094ed70873608f49157b40a';assert.equal(createHash('sha256').update(fs.readFileSync(exe)).digest('hex'),expectedHash);
const manifest=JSON.parse(fs.readFileSync(path.join(bridge,'../linux-package/manifest.json')));assert.equal(manifest.version,'0.6.0-alpha.63');
for(const file of ['desktop/electron/rpc.cjs','desktop/electron/agent-network.cjs','desktop/electron/mcp-integration.cjs','desktop/electron/mcp-client.cjs','dist/desktop-host.js','bootstrap.sh']){assert.equal(createHash('sha256').update(fs.readFileSync(path.join(bridge,file))).digest('hex'),manifest.files.find(x=>x.path===(file==='bootstrap.sh'?'desktop/electron/bootstrap.sh':file))?.sha256);}
const {HostConnection, linuxResourcePath} = require(path.join(bridge, 'desktop/electron/rpc.cjs'));
const {AgentNetwork} = require(path.join(bridge, 'desktop/electron/agent-network.cjs'));
const {createCoordinatorService} = require(path.join(bridge, 'desktop/electron/coordinator-service.cjs'));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-wsl-mcp-'));
const linuxDirectory = '/tmp/agentbridge-wsl-mcp-' + randomUUID();
const bootstrap = path.join(directory, 'bootstrap.sh');
const report = {date: new Date().toISOString(), version: '0.6.0-alpha.63', environment: 'Windows production Coordinator and AgentNetwork / candidate HostConnection and core entry / actual WSL Ubuntu / isolated native Codex profile', modelCalls: 0, status: 'running', checks: [], samples: [], plannedSamples:sampleCount,intervalMs,packageSha256:expectedHash,scope:'Actual Windows to WSL transport with isolated native Codex listing and generic Linux stdio MCP client; sustained original scope, no parent model or daily configuration'};
const save=()=>{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');};
let network, service, host, node, client; const clients = [];
function windowsToLinux(value) {return linuxResourcePath(value,distribution);}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function quote(value) {return "'" + value.replaceAll("'", "'\\''") + "'";}
fs.writeFileSync(bootstrap, '#!/bin/bash\nset -eu\nprintf "WSL_ISOLATED_BOOT\\n" >&2\nexport CODEX_HOME="$2/native-codex"\nmkdir -p "$CODEX_HOME"\nexec /bin/bash ' + quote(windowsToLinux(path.join(bridge, 'bootstrap.sh'))) + ' "$@"\n');
const empty = {setCollaboration() {}, close() {}, async call(method) {if (method === 'discover') return {items: []}; if (method === 'snapshot') return {agents: {items: [], revision: 0}, tasks: [], conversations: []}; throw Error('No Windows execution expected');}};
const wslRun = (command, args) => new Promise((resolve, reject) => {
  const child = spawn('wsl.exe', ['--distribution', distribution, '--exec', command, ...args], {windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
  const out = [], err = [], timer = setTimeout(() => reject(Error('Isolated WSL helper unconfirmed')), 20000);
  child.stdout.on('data', bytes => out.push(bytes)); child.stderr.on('data', bytes => err.push(bytes));
  child.once('error', error => {clearTimeout(timer); reject(error);});
  child.once('exit', code => {clearTimeout(timer); if (code === 0) resolve(Buffer.concat(out).toString()); else reject(Object.assign(Error('Isolated WSL helper failed'), {code, diagnostic: Buffer.concat(err).toString().slice(-1500)}));});
});
const call = async (method, params = {}) => {const reply = await service.call({method, params}); if (!reply.ok) throw Object.assign(Error(reply.error.message), {code: reply.error.code}); return reply.result;};
async function closeHost() {
  const process = host?.child; host?.close();
  if (process && process.exitCode === null) await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Original WSL transport is still live; do not start another host')), 15000);
    process.once('exit', () => {clearTimeout(timer); resolve();});
  });
}
const driverProcesses = [];
let connectedHostChild;
const unc = value => '\\\\wsl.localhost\\' + distribution + value.replaceAll('/', '\\');
async function prepareNativeClients() {
  for (let i = 0; i < 2; i++) {
    const id = randomUUID(), configFile = path.join(directory, id + '.config.json');
    driverProcesses.push({configFile, state: '/tmp/agentbridge-wsl-native-driver-' + id + '/state.json'});
  }
  const driver = linuxResourcePath(path.join(__dirname, 'wsl-mcp-client-driver.cjs'), distribution);
  const packagedNode = linuxResourcePath(path.join(bridge,'../linux-package/runtime/node'), distribution);
  await wslRun(packagedNode, [driver, '--launch', ...driverProcesses.flatMap(item => [windowsToLinux(item.configFile), item.state])]);
  for (const item of driverProcesses) {
    const until = Date.now() + 20000;
    while (!fs.existsSync(unc(item.state)) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 100));
    assert(fs.existsSync(unc(item.state)), 'Owned native WSL MCP driver must be live');
    item.details = JSON.parse(fs.readFileSync(unc(item.state), 'utf8'));
  }
}
async function driverCall(native, input) {
  const id = randomUUID().replaceAll('-', ''), request = unc(native.state) + '.request', response = unc(native.state) + '.response-' + id;
  fs.writeFileSync(request + '.tmp', JSON.stringify({...input, id, secret: native.details.secret}));
  fs.renameSync(request + '.tmp', request);
  const until = Date.now() + 45000;
  while (!fs.existsSync(response) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 50));
  assert(fs.existsSync(response), 'Original native MCP fixture response must be confirmed');
  const reply = JSON.parse(fs.readFileSync(response, 'utf8')); fs.unlinkSync(response);
  if (reply.error) throw Error(reply.error); return reply.result;
}
async function nativeClient(config) {
  const native = driverProcesses[clients.length]; assert(native);
  fs.writeFileSync(native.configFile, JSON.stringify(config), {mode: 0o600}); clients.push(native);
  return (method, params = {}) => driverCall(native, {method, params});
}
const tool = async rpc => JSON.parse((await rpc('tools/call', {name: 'list_agents', arguments: {}})).content[0].text);
(async () => {
  // Native Agents spawn MCP locally inside WSL. Start isolated Linux drivers
  // before the persistent Windows transport, then observe their local RPC.
  await prepareNativeClients();
  network = new AgentNetwork({directory: path.join(directory, 'coordinator'), platform: 'win32', distributions: async () => [distribution],
    createHost(machine) {
      if (machine.kind !== 'wsl') return empty;
      host = new HostConnection(path.join(bridge, 'dist/desktop-host.js'), {distribution, directory: linuxDirectory, bootstrapPath: bootstrap});
      const launch = host.launch.bind(host);
      host.launch = async () => {await launch(); const child = host.child; if (child) {
        child.once('exit', (code, signal) => {report.transportExit = {code, signal};});
        child.stdout.on('data', bytes => {report.transportStdoutBytes = (report.transportStdoutBytes || 0) + bytes.length; report.transportPrefixHex ||= bytes.subarray(0, 8).toString('hex');});
      } return child;};
      return host;
    }});
  const machine = (await network.machines()).find(machine => machine.kind === 'wsl'); assert(machine);
  const discovered = await network.host(machine).call('discover');
  const codex = discovered.items.find(item => item.adapter === 'codex' && item.healthy); assert(codex, 'Current WSL Codex must be installed for its native list check');
  node = {nodeId: 'wsl-mcp-acceptance', machineId: machine.machineId, adapter: 'codex', executable: codex.executable, name: 'WSL Codex acceptance', connected: true, managed: true, executionSupported: true};
  network.network.nodes.push(node); network.saveNetwork();
  service = createCoordinatorService({directory: path.join(directory, 'coordinator'), network, version: report.version});
  const params = {nodeId: node.nodeId};
  const beforeWindows = path.join(os.homedir(), '.codex/config.toml');
  const hashWindows = () => fs.existsSync(beforeWindows) ? createHash('sha256').update(fs.readFileSync(beforeWindows)).digest('hex') : null;
  const windowsHash = hashWindows();
  const before = await call('mcp.status', params); assert.equal(before.facts.config, 'absent');
  const installed = await call('mcp.install', params);
  assert(installed.configPath.startsWith(linuxDirectory + '/native-codex/')); assert.equal(installed.facts.config, 'present');
  const probe = await call('mcp.probe', params);
  assert.equal(probe.facts.nativeLoad, 'loaded'); assert.equal(probe.facts.tools, 'available');
  report.nativeVersion = codex.version;
  report.checks.push('Production Coordinator and AgentNetwork route MCP management through the actual WSL HostConnection; native Codex lists the isolated written entry and ten Bridge tools are probed');
  client = await nativeClient(installed.configuration);
  await client('initialize', {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'WSL acceptance', version: '1'}});
  assert.equal((await client('tools/list')).tools.length, 10);
  const listed = await tool(client); assert.equal(listed.caller.nodeId, node.nodeId); assert.equal(listed.caller.role, 'unassigned'); assert.deepEqual(listed.items, []);
  const forged = await client('tools/call', {name: 'list_agents', arguments: {nodeId: 'forged'}});
  assert.equal(forged.isError, true); assert.equal(JSON.parse(forged.content[0].text).error.code, 'INVALID_INPUT');
  report.checks.push('Actual WSL stdio client calls the production broker and Windows collaboration route with its original scope; forged identity is rejected');
  connectedHostChild=host.child;const originalPid=connectedHostChild.pid,firstDriver=driverProcesses[0].details.pid;
  const nativeConfigHash=createHash('sha256').update(fs.readFileSync(unc(installed.configPath))).digest('hex');
  const started=Date.now();report.sustainedStartedAt=new Date(started).toISOString();save();
  for(let index=0;index<sampleCount;index++){
    const due=started+(index+1)*intervalMs;await sleep(Math.max(0,due-Date.now()));
    const stamp=Date.now(),current=await tool(client),status=await call('mcp.status',params);
    assert.equal(host.child,connectedHostChild,'Sustained sample must use the original Windows WSL child');assert.equal(host.child.pid,originalPid);assert.equal(host.child.exitCode,null);
    assert.equal(JSON.parse(fs.readFileSync(unc(driverProcesses[0].state),'utf8')).pid,firstDriver);
    assert.equal(current.caller.nodeId,node.nodeId);assert.deepEqual(current.items,[]);assert.equal(current.caller.role,'unassigned');assert.equal(status.connectionId,installed.connectionId);assert.equal(status.facts.config,'present');assert.equal(status.facts.authorization,'valid');
    assert.equal(createHash('sha256').update(fs.readFileSync(unc(installed.configPath))).digest('hex'),nativeConfigHash);assert.equal(hashWindows(),windowsHash);
    assert.equal(network.network.requests.length,0);assert.equal(network.network.delegations.length,0);
    report.samples.push({index:index+1,elapsedMs:Date.now()-started,callMs:Date.now()-stamp,originalHost:true,originalLinuxClient:true,originalIdentity:true,nativeConfigUnchanged:true,requests:0,delegations:0});save();
    if((index+1)%12===0)console.log(JSON.stringify({sustainedSamples:index+1,planned:sampleCount,elapsedMs:Date.now()-started}));
  }
  report.sustainedElapsedMs=Date.now()-started;assert(report.sustainedElapsedMs>=sampleCount*intervalMs);
  report.checks.push('Original Windows WSL host, Linux stdio client and independent identity remain live for the entire 15-minute/180-sample window; native configs and zero task/delegation records stay unchanged');save();
  fs.unlinkSync(unc(installed.configPath));
  assert.equal((await call('mcp.status', params)).facts.config, 'absent');
  await closeHost(); network.hosts.delete(machine.machineId);
  const restored = await call('mcp.status', params);
  assert.equal(restored.facts.config, 'absent'); assert.equal(restored.facts.authorization, 'valid');
  assert.equal((await tool(client)).caller.nodeId, node.nodeId);
  report.checks.push('External native deletion and a confirmed WSL transport restart preserve the original connection and never reinstall the removed native entry');
  await call('mcp.revoke', params); assert.equal((await tool(client)).error.code, 'MCP_REVOKED');
  const fresh = await call('mcp.install', params); assert.notEqual(fresh.connectionId, installed.connectionId);
  assert.equal((await tool(client)).error.code, 'MCP_REVOKED');
  const current = await nativeClient(fresh.configuration); await current('initialize', {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'WSL acceptance', version: '1'}});
  assert.equal((await tool(current)).caller.nodeId, node.nodeId);
  report.checks.push('Explicit revocation rejects the old WSL client; reinstallation rotates identity and only the new client is authorized');
  const removed = await call('mcp.remove', params); assert.equal(removed.facts.config, 'absent'); assert.equal((await tool(current)).error.code, 'MCP_REVOKED');
  assert.equal(hashWindows(), windowsHash); assert.equal(network.network.requests.length, 0); assert.equal(network.network.delegations.length, 0);
  report.checks.push('Removal clears only the WSL native entry; Windows native config bytes are unchanged and zero execution or delegation requests were created');
  report.status = 'passed';
})().catch(error => {report.status = 'failed'; report.error = {code: error.code, message: 'Original WSL lifecycle did not meet the expected contract; preserve its original handles and state'}; report.transportStderrBytes = Buffer.byteLength(host?.lastError||''); process.exitCode = 1;})
  .finally(async () => {
    for (const native of driverProcesses) {
      try {
        await driverCall(native, {close: true});
        const until = Date.now() + 10000;
        while (!fs.existsSync(unc(native.state) + '.stopped') && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 100));
        assert(fs.existsSync(unc(native.state) + '.stopped'), 'Owned native driver must confirm exit');
        fs.rmSync(path.dirname(unc(native.state)), {recursive: true, force: true});
      } catch {report.cleanupPending = true;}
    }
    try {await closeHost();report.originalHostExitConfirmed=true;} catch {report.cleanupPending=true;}
    service?.close();
    if (!report.cleanupPending) {fs.rmSync(unc(linuxDirectory), {recursive: true, force: true});fs.rmSync(directory,{recursive:true,force:true,maxRetries:8,retryDelay:200});}
    else {report.status='cleanup_pending';process.exitCode=1;}
    fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({status:report.status,version:report.version,samples:report.samples.length,checks:report.checks,cleanupPending:report.cleanupPending}));
  });
