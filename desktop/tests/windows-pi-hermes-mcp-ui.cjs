// Production frontend + MachineHost/MCP config manager; controlled discovery, model 0.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium, expect} = require('../node_modules/@playwright/test');
const {graphFixture} = require('./i06b-ui-fixture.cjs');
const {MachineHost} = require(path.join(process.env.AGENTBRIDGE_VERIFY_BRIDGE, 'desktop/electron/machine-host.cjs'));
const {connectionCapabilities} = require(path.join(process.env.AGENTBRIDGE_VERIFY_BRIDGE, 'desktop/electron/builtin-adapters.cjs'));
const output = path.resolve(process.argv[2]); fs.mkdirSync(output, {recursive: true});
const report = {bridgeVersion: '0.6.0-alpha.50', date: new Date().toISOString(), environment: 'Windows Edge / production frontend / real isolated MachineHost MCP config / controlled discovery', modelCalls: 0, checks: [], errors: [], status: 'running'};
let fixture, host, browser, server, page;
(async () => {
  fixture = await graphFixture();
  const machine = fixture.router.catalog.machines.find(item => item.kind === 'windows');
  const home = path.join(fixture.directory, 'native-user'), appData = path.join(fixture.directory, 'roaming');
  const YAML = require(path.join(process.env.AGENTBRIDGE_VERIFY_BRIDGE, 'node_modules/yaml'));
  const environment = {...process.env, LOCALAPPDATA: appData, HERMES_HOME: path.join(home, 'hermes'), PI_CODING_AGENT_DIR: path.join(home, 'pi-original')};
  const write = (file, value) => {fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));};
  const hermesFile = name => path.join(environment.HERMES_HOME, 'profiles', name, 'config.yaml');
  for (const name of ['original', 'next']) write(hermesFile(name), '# preserve native comment\n');
  const active = path.join(environment.HERMES_HOME, 'active_profile'); write(active, 'original');
  const nativeFiles = {pi: path.join(environment.PI_CODING_AGENT_DIR, 'mcp.json'), hermes: hermesFile('original')};
  const candidates = Object.fromEntries(['claude', 'codex', 'opencode', 'hermes', 'pi', 'dsh'].map(id => [id, []]));
  candidates.pi = [process.env.AGENTBRIDGE_VERIFY_PI];
  host = new MachineHost({directory: path.join(fixture.directory, 'mcp'), home, environment, candidates, legacy: {close() {}}, collaboration: async () => ({items: []})});
  const nodes = ['pi', 'hermes'].map(adapter => {
    const node = {nodeId: 'controlled-' + adapter, machineId: machine.machineId, adapter, name: adapter === 'pi' ? 'Pi' : 'Hermes', executable: '/controlled/' + adapter, version: adapter === 'pi' ? '1.4.0' : 'source', connected: true, online: true, healthy: true, available: true, busy: false, executionSupported: true, activeTasks: 0, status: 'connected'};
    return Object.assign(node, connectionCapabilities(node));
  });
  const call = async (method, params) => {
    if (method.startsWith('mcp.')) {
      const node = nodes.find(node => node.nodeId === params.nodeId); assert(node);
      try {return {ok: true, result: await host.call(method, {...params, adapter: node.adapter})};}
      catch (error) {return {ok: false, error: {code: error.code, message: error.message}};}
    }
    const result = await fixture.call(method, params);
    if (method === 'snapshot' && result.ok) result.result.nodes.push(...nodes);
    return result;
  };
  const root = path.resolve(__dirname, '../dist');
  server = http.createServer((req, res) => {
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    try {res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(fs.readFileSync(file));}
    catch {res.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true});
  report.browserVersion = browser.version();
  page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
  page.on('pageerror', error => report.errors.push(error.message));
  await page.exposeFunction('abCall', call);
  await page.addInitScript(() => {window.agentbridge = {call: (method, params = {}) => window.abCall(method, params), preferences: async () => ({theme: 'light', platform: 'win32', version: 'alpha.50 Pi/Hermes acceptance', directory: ''}), pending: async () => [], savePreferences: async value => value, closeWindow: async () => {}, stop: async () => {}, machines: async () => []};});
  await page.goto('http://127.0.0.1:' + server.address().port);
  for (const node of nodes) {
    await page.getByRole('button', {name: '配置 Windows 测试机 / ' + node.name, exact: true}).click();
    const card = page.locator('.settings-mcp');
    await expect(card.getByRole('button', {name: '添加 Bridge MCP', exact: true})).toBeEnabled();
    await card.getByRole('button', {name: '添加 Bridge MCP', exact: true}).click();
    await expect(card.getByRole('button', {name: '添加 Bridge MCP', exact: true})).toBeDisabled();
    await expect(card).toContainText('已添加到用户配置');
    const file = nativeFiles[node.adapter]; assert(fs.existsSync(file));
    const data = node.adapter === 'pi' ? JSON.parse(fs.readFileSync(file)) : YAML.parse(fs.readFileSync(file, 'utf8'));
    const entry = node.adapter === 'pi' ? data.mcpServers.agentbridge : data.mcp_servers.agentbridge;
    entry.enabled = false; write(file, node.adapter === 'pi' ? data : YAML.stringify(data));
    await card.getByRole('button', {name: '刷新配置状态', exact: true}).click();
    await expect(card).toContainText('已禁用'); await expect(card.getByRole('button', {name: '添加 Bridge MCP', exact: true})).toBeDisabled();
    await page.screenshot({path: path.join(output, node.adapter + '-disabled.png'), fullPage: true});
    report.checks.push(node.name + ' production card writes only its native user target, displays native disable and blocks re-enable');
    if (node.adapter === 'pi') environment.PI_CODING_AGENT_DIR = path.join(home, 'pi-next'); else write(active, 'next');
    await card.getByRole('button', {name: '刷新配置状态', exact: true}).click();
    await expect(card).toContainText('已切换原生'); await expect(card).toContainText('移除仅清理原接入目标');
    await expect(card.getByRole('button', {name: '添加 Bridge MCP', exact: true})).toBeDisabled();
    await page.screenshot({path: path.join(output, node.adapter + '-target-changed.png'), fullPage: true});
    await card.getByRole('button', {name: '移除 Bridge MCP', exact: true}).click();
    await expect(card).toContainText('已移除 Bridge MCP 并撤销接入');
    await card.getByRole('button', {name: '添加 Bridge MCP', exact: true}).click();
    await expect(card).toContainText('已添加到用户配置');
    const current = node.adapter === 'pi' ? path.join(environment.PI_CODING_AGENT_DIR, 'mcp.json') : hermesFile('next');
    assert(fs.existsSync(current)); assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /agentbridge/);
    await page.screenshot({path: path.join(output, node.adapter + '-current-target.png'), fullPage: true});
    report.checks.push(node.name + ' native target change is explicit; removal cleans only the old target and re-add binds the current selection');
    await card.getByRole('button', {name: '移除 Bridge MCP', exact: true}).click();
    await page.getByRole('button', {name: '关闭 Agent 配置', exact: true}).click();
  }
  assert.deepEqual(report.errors, []);
  assert.equal(fixture.calls.some(item => ['nodeRequest', 'manageNode'].includes(item.method)), false);
  report.checks.push('Both original node identities stay bound throughout interactions; zero model submissions and browser errors');
  report.status = 'passed';
})().catch(async error => {report.status = 'failed'; report.error = {message: error.message}; try {await page?.screenshot({path: path.join(output, 'failure.png'), fullPage: true});} catch {} process.exitCode = 1;})
  .finally(async () => {await browser?.close(); host?.close(); await fixture?.close(); if (server) await new Promise(resolve => server.close(resolve)); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));});
