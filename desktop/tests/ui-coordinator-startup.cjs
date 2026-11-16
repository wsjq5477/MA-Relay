// Production renderer with a controlled bridge. No user profile or native agent is loaded.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const { mock } = require('./ui-workspace-fixture.cjs');

const dist = path.resolve(process.argv[2] || path.join(__dirname, '../dist'));
const evidence = path.resolve(process.argv[3] || path.join(__dirname, '../../artifacts/issue33-ui'));
const baseline = process.argv.includes('--baseline');
const viewport = { width: 1280, height: 860 };

function control() {
  const api = window.agentbridge;
  const { call, pending, preferences } = api;
  let phase = 'loading';
  let releaseStartup, releaseRetry;
  const startup = new Promise(resolve => { releaseStartup = resolve; });
  let preferenceFailuresAfterRecovery = 1;
  const counts = { snapshots: 0, preferences: 0, reconnects: 0 };
  api.call = async (method, params) => {
    if (method !== 'snapshot') return call(method, params);
    counts.snapshots++;
    await startup;
    if (phase === 'failed') {
      // Let the unstructured Electron-style rejection arrive before this result.
      await new Promise(resolve => setTimeout(resolve, 30));
      return { ok: false, error: { code: 'PRIVATE_DIRECTORY_TIMEOUT', message: '后台私有目录初始化超时，请重新连接。' } };
    }
    const response = await call(method, params);
    if (phase === 'empty') {
      Object.assign(response.result, {
        machines: [], nodes: [], tasks: [], conversations: [],
        collaboration: { leaderId: null, memberIds: [], revision: 2 },
      });
    } else {
      response.result.tasks[0].status = 'running';
    }
    return response;
  };
  api.pending = async () => {
    await startup;
    if (phase === 'failed') throw Error("Error invoking remote method 'bridge:pending': Error: spawnSync icacls.exe ETIMEDOUT");
    return phase === 'empty' ? [] : pending();
  };
  api.preferences = async () => {
    counts.preferences++;
    await startup;
    if (phase === 'failed' || preferenceFailuresAfterRecovery-- > 0) {
      throw Error('版本偏好暂不可读');
    }
    return preferences();
  };
  api.reconnect = async () => {
    counts.reconnects++;
    await new Promise(resolve => { releaseRetry = resolve; });
  };
  window.__startupControl = {
    counts,
    fail() { phase = 'failed'; releaseStartup(); },
    recover(nextPhase = 'ready') { phase = nextPhase; releaseRetry(); },
  };
}

async function run() {
  fs.mkdirSync(evidence, { recursive: true });
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(dist + path.sep)) return response.writeHead(403).end();
    fs.readFile(file, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser, page;
  const report = { date: new Date().toISOString(), node: process.version, baseline, checks: [], screenshots: [], pageErrors: [], modelCalls: 0 };
  async function capture(name) {
    await page.screenshot({ path: path.join(evidence, name + '.png'), animations: 'disabled' });
    report.screenshots.push(name + '.png');
  }
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.AGENTBRIDGE_TEST_CHROMIUM });
    report.browser = browser.version();
    page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    page.on('pageerror', error => report.pageErrors.push(error.message));
    await page.addInitScript({ content: `(${mock})({pendingOriginal:true}); (${control})();` });
    await page.goto('http://127.0.0.1:' + server.address().port);
    const metrics = page.locator('.overview-summary strong');
    const alert = page.getByRole('alert');
    const connection = page.locator('.connection-dot');
    const version = page.locator('.sidebar-meta');
    const nav = page.getByRole('navigation', { name: '主导航' });

    await expect(connection).toContainText('正在连接后台');
    await expect(version).toContainText('版本读取中');
    await expect(metrics).toHaveText(Array(4).fill(baseline ? '0' : '—'));
    await capture('01-startup');
    await page.evaluate(() => window.__startupControl.fail());
    if (baseline) {
      await expect(alert).toContainText('spawnSync icacls.exe ETIMEDOUT');
      await expect(version).toContainText('版本读取中');
      await expect(metrics).toHaveText(Array(4).fill('0'));
      assert(report.pageErrors.some(message => message.includes('版本偏好暂不可读')));
      await capture('02-timeout');
      report.checks.push('Original renderer shows raw pending rejection, initial zeroes and endless version loading');
      return;
    }

    await expect(alert).toContainText('后台私有目录初始化超时，请重新连接。');
    await expect(alert).not.toContainText('icacls.exe');
    await expect(connection).toContainText('私有目录初始化超时');
    await expect(version).toContainText('版本未读取');
    await expect(metrics).toHaveText(Array(4).fill('—'));
    await expect(page.getByRole('heading', { name: '机器与 Agent 尚未读取' })).toBeVisible();
    await capture('02-timeout');
    await page.setViewportSize({ width: 980, height: 660 });
    await capture('03-timeout-minimum-window');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewportSize(viewport);
    await nav.getByRole('button', { name: '执行审计' }).click();
    await expect(page.getByRole('status').filter({ hasText: '后台数据尚未读取' })).toBeVisible();
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await expect(page.getByText('后台记录尚未读取。')).toBeVisible();
    await expect(page.getByText('当前没有未确认操作')).toHaveCount(0);
    await new Promise(resolve => setTimeout(resolve, 1800));
    assert.deepEqual(await page.evaluate(() => window.__startupControl.counts), { snapshots: 1, preferences: 1, reconnects: 0 });
    report.checks.push('Initial failure leaves counts and backend records unread, displays the structured ACL error, and pauses background IPC');

    await nav.getByRole('button', { name: '接入配置' }).click();
    await alert.getByRole('button', { name: '重新连接' }).click();
    await expect(alert.getByRole('button', { name: '正在连接' })).toBeDisabled();
    await expect(connection).toContainText('正在连接后台');
    await page.evaluate(() => window.__startupControl.recover());
    await expect(alert).toHaveCount(0);
    await expect(page.locator('.inventory-machine')).toHaveCount(2);
    await expect(metrics).toHaveText(['2', '2', '1', '1']);
    await expect(version).toContainText('vsynthetic-api');
    await expect(connection).toContainText('2 台机器在线');
    assert.equal(await page.evaluate(() => window.__startupControl.counts.reconnects), 1);
    await capture('04-reconnected');
    report.checks.push('One manual retry restores the snapshot and the originally failed preferences recover on a later poll');

    await page.evaluate(() => window.__startupControl.fail());
    await expect(alert).toBeVisible();
    await expect(metrics).toHaveText(['2', '2', '1', '1']);
    await expect(version).toContainText('vsynthetic-api');
    await expect(page.getByText('1 个操作的回应尚未确认。', { exact: false })).toBeVisible();
    await capture('05-disconnected-with-cache');
    await alert.getByRole('button', { name: '重新连接' }).click();
    await expect(alert.getByRole('button', { name: '正在连接' })).toBeDisabled();
    await page.evaluate(() => window.__startupControl.recover('empty'));
    await expect(alert).toHaveCount(0);
    await expect(metrics).toHaveText(['0', '0', '0', '0']);
    assert.deepEqual(report.pageErrors, []);
    assert.equal(await page.evaluate(() => window.__testControl.calls.filter(call => call.businessAttempt).length), 0);
    report.checks.push('Connection loss preserves cached metrics, version and the original pending record; zeroes appear after a confirmed empty snapshot');
  } finally {
    if (page) report.counts = await page.evaluate(() => window.__startupControl?.counts).catch(() => undefined);
    fs.writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
