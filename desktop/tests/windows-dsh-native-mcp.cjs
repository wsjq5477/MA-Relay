// Installed, unmodified Desktop profile composer and MCP client; isolated parent, model 0.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module'), {pathToFileURL} = require('node:url');
const {createHash} = require('node:crypto');
const [bridge, nativeRoot, output, version] = process.argv.slice(2);
if (process.platform !== 'win32' || !version) throw Error('Windows runtime, Bridge resources, installed DSH Desktop, report, version required');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-dsh-desktop-native-'));
const home = path.join(directory, 'native'), profile = '验收 Profile', profileDir = path.join(home, 'profiles', profile);
const environment = {...process.env, DSH_HOME: home, APPDATA: path.join(directory, 'roaming')};
process.env.DSH_HOME = home;
const nativeRequire = createRequire(path.join(nativeRoot, 'package.json'));
const load = name => import(pathToFileURL(nativeRequire.resolve('@deepseek-ai/' + name)).href);
const {MachineHost} = require(path.join(bridge, 'desktop/electron/machine-host.cjs'));
const {assertListArgs} = require(path.join(bridge, 'desktop/electron/agent-connections.cjs'));
const report = {date: new Date().toISOString(), bridgeVersion: version,
  nativeVersion: JSON.parse(fs.readFileSync(path.join(nativeRoot, 'package.json'))).version,
  environment: 'installed unmodified DSH Desktop profile composer and MCP client / controlled parent / isolated native profile', modelCalls: 0, status: 'running', checks: []};
let host, ctx; const calls = [];
const params = {nodeId: 'desktop', adapter: 'dsh-desktop'};
const newHost = () => new MachineHost({directory: path.join(directory, 'bridge'), home: directory, environment, legacy: {close() {}},
  collaboration: async (scope, name, args) => {assertListArgs(args); calls.push({scope, name}); return {items: []};}});
function write(file, value) {fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));}
(async () => {
  fs.mkdirSync(path.join(profileDir, 'node_modules'), {recursive: true});
  // Only new junctions below the scratch profile; never modify the installed package.
  for (const item of fs.readdirSync(path.join(nativeRoot, 'node_modules'), {withFileTypes: true})) {
    if (item.name.startsWith('.') || !item.isDirectory()) continue;
    fs.symlinkSync(path.join(nativeRoot, 'node_modules', item.name), path.join(profileDir, 'node_modules', item.name), 'junction');
  }
  if (!fs.existsSync(path.join(profileDir, 'node_modules', 'dsh-plugin-desktop')))
    fs.symlinkSync(nativeRoot, path.join(profileDir, 'node_modules', 'dsh-plugin-desktop'), 'junction');
  const bundles = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'];
  const dependencies = Object.fromEntries(bundles.map(name => [name, JSON.parse(fs.readFileSync(nativeRequire.resolve(name + '/package.json'))).version]));
  write(path.join(profileDir, 'package.json'), {name: 'dsh-profile-native-acceptance', private: true, type: 'module', dependencies, dsh: {profile: {bundles}}});
  write(path.join(profileDir, 'cordis.yml'), '[]\n');
  write(path.join(profileDir, 'cordis.patch.yml'), '# preserve native user comment\n[]\n');
  write(path.join(environment.APPDATA, 'DSH Desktop', 'profile-selection', 'state.json'), {version: 2, active: profile});
  const nativeProfileModule = path.join(nativeRoot, 'lib/profile.js');
  report.nativeProfileModuleSha256 = createHash('sha256').update(fs.readFileSync(nativeProfileModule)).digest('hex');
  const [{prepareDesktopProfile}, boot, {Context}, {default: SystemPrompt}, {default: ToolRuntime}, McpClient] = await Promise.all([
    import(pathToFileURL(nativeProfileModule).href), load('dsh-app-boot'), load('cordis'), load('dsh-system-prompt'), load('dsh-tools'), load('dsh-mcp-client'),
  ]);
  host = newHost();
  const installed = await host.call('mcp.install', params);
  assert.equal(installed.profile, profile); assert.equal(installed.facts.nativeLoad, 'reload_required');
  const prepared = prepareDesktopProfile('1', home, 'win32', profile);
  const rows = boot.composeEntries(prepared.patches);
  const entry = rows.find(row => row.id === 'agentbridge-mcp');
  assert.equal(rows.filter(row => row.id === 'agentbridge-mcp').length, 1);
  assert.equal(entry.name, '@deepseek-ai/dsh-mcp-client');
  report.checks.push('Installed Desktop prepareDesktopProfile and native composeEntries read the Bridge-written row from the selected native Profile exactly once');
  ctx = new Context(); await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime);
  await McpClient.apply(ctx, {...entry.config, cwd: directory, failOnStartupError: true, toolCallTimeoutMs: 15000});
  const runtime = ctx.tools;
  assert.equal(runtime.schemas().filter(tool => tool.name.startsWith('mcp__agentbridge__')).length, 7);
  const invoke = args => runtime.execute({signal: new AbortController().signal, callId: 'desktop-' + calls.length, name: 'mcp__agentbridge__list_agents', arguments: args || {}});
  const result = await invoke(); assert.equal(result.isError, false); assert.deepEqual(JSON.parse(result.content[0].text), {items: []});
  assert.equal(calls[0].scope.nodeId, params.nodeId);
  report.checks.push('Installed native MCP client discovers seven tools and calls list_agents through production Bridge authorization with the original node scope');
  assert.equal((await invoke({nodeId: 'forged'})).isError, true); assert.equal(calls.length, 1);
  report.checks.push('Production validation rejects forged identity arguments without forwarding an extra collaboration call');
  const nativeFile = installed.configPath;
  fs.writeFileSync(nativeFile, '# removed in native profile\n[]\n');
  const deleted = await host.call('mcp.status', params); assert.equal(deleted.facts.config, 'absent');
  host.close(); host = newHost(); await host.mcpReady;
  assert.equal(fs.readFileSync(nativeFile, 'utf8'), '# removed in native profile\n[]\n');
  assert.equal((await invoke()).isError, false);
  report.checks.push('Native deletion and Bridge restart leave the profile untouched; the cached client retains only its still-valid original authorization');
  await host.call('mcp.revoke', params);
  const rejected = await invoke(); assert.equal(rejected.isError, true); assert.match(rejected.content[0].text, /MCP_REVOKED/);
  await ctx.fiber.dispose(); ctx = null;
  assert.equal(runtime.schemas().filter(tool => tool.name.startsWith('mcp__agentbridge__')).length, 0);
  const reinstalled = await host.call('mcp.install', params); assert.notEqual(reinstalled.connectionId, installed.connectionId);
  const removed = await host.call('mcp.remove', params); assert.equal(removed.cleanupError, undefined); assert.equal(removed.facts.config, 'absent');
  const afterRows = boot.composeEntries(prepareDesktopProfile('1', home, 'win32', profile).patches);
  assert.equal(afterRows.some(row => row.id === 'agentbridge-mcp'), false);
  report.checks.push('Explicit revoke rejects the cached client; native disposal removes tools; reinstall rotates identity and Bridge removal is absent in the real Desktop composition');
  report.status = 'passed';
})().catch(error => {report.status = 'failed'; report.error = {code: error.code, message: error.message}; process.exitCode = 1;})
  .finally(async () => {await ctx?.fiber.dispose(); host?.close(); fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));});
