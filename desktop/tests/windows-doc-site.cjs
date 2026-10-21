/* eslint-disable @typescript-eslint/no-require-imports -- Windows Node runs this CommonJS verification script directly. */
const fs = require('node:fs'), path = require('node:path');
const {chromium, expect} = require('../node_modules/@playwright/test');
const base = (process.argv[2] || 'http://127.0.0.1:4188').replace(/\/$/, '');
const out = path.resolve(process.argv[3] || path.join(__dirname, '../../artifacts/user-documentation', new Date().toISOString().replace(/[:.]/g, '-')));
fs.mkdirSync(out, {recursive: true});
const report = {date: new Date().toISOString(), base, scope: 'actual local user documentation build; no agents or model requests', checks: [], errors: []};
(async () => {
  const browser = await chromium.launch({executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true});
  try {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}}), page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(base + '/', {waitUntil: 'networkidle'});
    report.initialPage = {url: page.url(), title: await page.title()};
    await expect(page.locator('h1')).toContainText('AgentBridge 使用文档');
    await expect(page.locator('.VPSidebar')).toBeVisible();
    await expect.poll(() => page.locator('.VPNavBarTitle .logo').evaluate(element => element.naturalWidth)).toBeGreaterThan(0);
    const table = page.locator('main table').first();
    await expect(table.locator('thead th')).toHaveText(['Agent / 入口', '原生 CLI', '原生 API', 'MCP', 'ACP', '插件', 'SDK']);
    await expect(table.locator('tbody tr')).toHaveCount(8);
    report.checks.push('首页直接显示六方式、八入口总结表与品牌图');
    await page.screenshot({path: path.join(out, 'home-light.png'), fullPage: true});
    const sidebar = page.locator('.VPSidebar');
    for (const name of ['Claude Code', 'Codex', 'OpenCode', 'Hermes', 'Pi', 'DSH']) await expect(sidebar.getByRole('link', {name, exact: true})).toBeVisible();
    await expect(sidebar).not.toContainText(/M\d{2}-F\d+|测试报告|迭代|历史|开发过程/);
    report.checks.push('原生Agent导航六种齐全，不显示内部开发材料');
    await sidebar.getByRole('link', {name: 'DSH', exact: true}).click();
    await expect(page.locator('h1')).toHaveText('DSH');
    const main = page.locator('main');
    for (const text of ['DSH CLI', 'DSH Windows Desktop', 'DSH Linux / WSL Web', '为什么采用原生 API', '设置 → DSH Desktop / Web 接入', '当前公开 alpha.34 尚不包含', '当前未接入']) await expect(main).toContainText(text);
    await page.screenshot({path: path.join(out, 'dsh-light.png'), fullPage: true});
    report.checks.push('DSH独立章节覆盖三入口、实际连接、API原因、版本与能力边界');
    await page.goto(base + '/agents/');
    await expect(page.locator('main table')).toHaveCount(3);
    await expect(page.locator('main table').nth(1)).toContainText('调用 Bridge MCP');
    await expect(page.locator('main table').nth(1)).toContainText('DSH Web');
    report.checks.push('原生Agent总览同时提供方式表、功能表和六种工具章节');
    await page.goto(base + '/integration-methods');
    await expect(page.locator('main')).toContainText('六种方式的优点、代价与功能');
    await expect(page.locator('main')).toContainText('如何快速接入');
    await expect(page.locator('main table').nth(1).locator('tbody tr')).toHaveCount(6);
    report.checks.push('六方式优缺点、可用功能、选择建议和快速接入可阅读');
    await page.goto(base + '/architecture');
    await expect(page.locator('.mermaid-diagram svg').first()).toBeVisible({timeout: 60000});
    await expect(page.locator('.mermaid-diagram [role="alert"]')).toHaveCount(0);
    await expect(page.locator('.VPDocAside')).toBeVisible();
    await page.getByRole('switch').first().click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('.mermaid-diagram svg').first()).toBeVisible();
    await page.screenshot({path: path.join(out, 'architecture-dark.png'), fullPage: true});
    report.checks.push('真实Mermaid图表与深色主题、章节目录可用');
    await page.getByRole('button', {name: '搜索文档', exact: true}).click();
    const search = page.locator('#localsearch-input');
    await search.fill('DSH');
    await expect(page.locator('.VPLocalSearchBox .result').first()).toBeVisible({timeout: 15000});
    const resultLinks = await page.locator('.VPLocalSearchBox .result a').evaluateAll(links => links.map(link => link.getAttribute('href')));
    if (resultLinks.some(link => /modules\/|iterations\/|test-report/.test(link || ''))) throw Error('Search contains internal routes');
    await search.fill('M06-F01');
    await expect(page.locator('.VPLocalSearchBox')).toContainText('没有找到相关文档');
    await expect(page.locator('.VPLocalSearchBox .result')).toHaveCount(0);
    await page.keyboard.press('Escape');
    report.checks.push('搜索DSH有用户结果，搜索内部编号没有结果');
    report.blockedRoutes = [];
    for (const route of ['/modules/06-native-adapters/design', '/modules/04-ssh-access/test-report', '/iterations/README', '/agent-integration-matrix', '/references/desktop/electron/machine-host.cjs.txt']) {
      const response = await page.request.get(base + route);
      if (response.status() !== 404) throw Error('Internal route accessible: ' + route + ' (' + response.status() + ')');
      report.blockedRoutes.push({route, status: response.status()});
    }
    report.checks.push('内部设计/报告/迭代/矩阵和原源码下载地址均返回404');
    if (report.errors.length) throw Error(report.errors.join(';'));
    report.status = 'passed';
  } finally {await browser.close();}
})().catch(error => {report.status = 'failed'; report.errors.push(error.stack); process.exitCode = 1;}).finally(() => {
  fs.writeFileSync(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
});
