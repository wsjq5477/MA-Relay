// Production frontend + MachineHost/MCP config manager; controlled discovery, model 0.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {chromium, expect} = require('../node_modules/@playwright/test');
const {graphFixture} = require('./i06b-ui-fixture.cjs');
const {MachineHost} = require('../electron/machine-host.cjs');
const {connectionCapabilities} = require('../electron/builtin-adapters.cjs');
const output = path.resolve(process.argv[2]); fs.mkdirSync(output, {recursive: true});
const report = {date: new Date().toISOString(), environment: 'Windows Edge / production frontend / real isolated MachineHost MCP config / controlled discovery', modelCalls: 0, checks: [], errors: [], status: 'running'};
let fixture, host, browser, server, page;
(async () => {
  fixture = await graphFixture();
  const machine = fixture.router.catalog.machines.find(item => item.kind === 'windows');
  const home = path.join(fixture.directory, 'native-user'), appData = path.join(fixture.directory, 'roaming');
  const nativeHome = path.join(home, '.dsh');
  const write = (file, value) => {fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));};
  const nativeFile = name => path.join(nativeHome, 'profiles', name, 'cordis.patch.yml');
  for (const name of ['desktop', 'next']) {
    write(path.join(nativeHome, 'profiles', name, 'package.json'), {dsh: {profile: {bundles: ['@deepseek-ai/dsh-web-app']}}});
    write(nativeFile(name), '# native comment\n[]\n');
  }
  const selected = path.join(appData, 'DSH Desktop', 'profile-selection', 'state.json');
  host = new MachineHost({directory: path.join(fixture.directory, 'mcp'), home, environment: {APPDATA: appData}, legacy: {close() {}}, collaboration: async () => ({items: []})});
  const node = {nodeId: 'controlled-dsh-desktop', machineId: machine.machineId, adapter: 'dsh-desktop', name: 'DSH Desktop', executable: '/controlled/dsh', version: '2.0.18', connected: true, online: true, healthy: true, available: true, busy: false, executionSupported: true, activeTasks: 0, status: 'connected'};
  Object.assign(node, connectionCapabilities(node));
  const call = async (method, params) => {
    if (method.startsWith('mcp.')) {
      try {return {ok: true, result: await host.call(method, {...params, adapter: 'dsh-desktop'})};}
      catch (error) {return {ok: false, error: {code: error.code, message: error.message}};}
    }
    if (method === 'dsh.status') return {ok: true, result: {items: []}};
    const result = await fixture.call(method, params);
    if (method === 'snapshot' && result.ok) result.result.nodes.push(node);
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
  await page.addInitScript(() => {window.agentbridge = {call: (method, params = {}) => window.abCall(method, params), preferences: async () => ({theme: 'light', platform: 'win32', version: 'DSH MCP acceptance', directory: ''}), pending: async () => [], savePreferences: async value => value, closeWindow: async () => {}, stop: async () => {}, machines: async () => []};});
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.getByRole('button', {name: '配置 Windows 测试机 / DSH Desktop', exact: true}).click();
  const card = page.locator('.settings-mcp');
  await expect(card.getByRole('button', {name: '添加 Bridge MCP', exact: true})).toBeEnabled();
  await card.getByRole('button', {name: '添加 Bridge MCP', exact: true}).click();
  await expect(card).toContainText('接入的 DSH Desktop Profile：desktop');
  assert.match(fs.readFileSync(nativeFile('desktop'), 'utf8'), /agentbridge-mcp/);
  assert.equal(fs.readFileSync(nativeFile('next'), 'utf8'), '# native comment\n[]\n');
  await expect(page.locator('.settings-dsh')).toBeVisible();
  report.checks.push('DSH Desktop node opens its unified MCP card beside the separate service card; adding writes only the selected native profile');
  write(selected, {version: 2, active: 'next'});
  await card.getByRole('button', {name: '刷新配置状态', exact: true}).click();
  await expect(card).toContainText('已切换数据目录或 Profile');
  await expect(card).toContainText('接入的 DSH Desktop Profile：desktop');
  await expect(card).toContainText('移除仅清理原接入目标');
  await expect(card.getByRole('button', {name: '添加 Bridge MCP', exact: true})).toBeDisabled();
  await page.screenshot({path: path.join(output, 'profile-changed.png'), fullPage: true});
  report.checks.push('Native profile switch displays the original and current targets and blocks installation without mislabeling the registered entry as foreign');
  await card.getByRole('button', {name: '移除 Bridge MCP', exact: true}).click();
  await expect(card).toContainText('已移除 Bridge MCP 并撤销接入');
  assert.equal(fs.readFileSync(nativeFile('next'), 'utf8'), '# native comment\n[]\n');
  assert.doesNotMatch(fs.readFileSync(nativeFile('desktop'), 'utf8'), /agentbridge-mcp/);
  await card.getByRole('button', {name: '添加 Bridge MCP', exact: true}).click();
  await expect(card).toContainText('接入的 DSH Desktop Profile：next');
  assert.match(fs.readFileSync(nativeFile('next'), 'utf8'), /agentbridge-mcp/);
  await page.screenshot({path: path.join(output, 'current-profile.png'), fullPage: true});
  report.checks.push('Removal revokes and cleans only the original target; explicit re-add binds the current profile');
  write(selected, {version: 999, active: 'desktop'});
  await card.getByRole('button', {name: '刷新配置状态', exact: true}).click();
  await expect(card).toContainText('选择记录版本无法核对');
  await card.getByRole('button', {name: '移除 Bridge MCP', exact: true}).click();
  await expect(card).toContainText('已移除 Bridge MCP 并撤销接入');
  assert.doesNotMatch(fs.readFileSync(nativeFile('next'), 'utf8'), /agentbridge-mcp/);
  assert.deepEqual(report.errors, []);
  assert.equal(fixture.calls.some(item => ['nodeRequest', 'manageNode'].includes(item.method)), false);
  report.checks.push('Malformed native selection is shown explicitly while original-target cleanup remains available; zero model submissions and browser errors');
  report.status = 'passed';
})().catch(async error => {report.status = 'failed'; report.error = {message: error.message}; try {await page?.screenshot({path: path.join(output, 'failure.png'), fullPage: true});} catch {} process.exitCode = 1;})
  .finally(async () => {await browser?.close(); host?.close(); await fixture?.close(); if (server) await new Promise(resolve => server.close(resolve)); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));});
