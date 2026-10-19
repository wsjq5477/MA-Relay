// Windows Edge, production renderer, controlled Coordinator; no model calls.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, expect } = require('../node_modules/@playwright/test');
const { startPreview } = require('../scripts/preview-ui.cjs');
const out = path.resolve(process.argv[2] || 'artifacts/desktop-polling/2026-10-18');
const report = { date: new Date().toISOString(), environment: 'Windows Node / Edge / production renderer / controlled Coordinator', modelCalls: 0, checks: [] };
let browser, preview;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  preview = await startPreview({ port: 0 });
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  report.browserVersion = browser.version(); report.nodeVersion = process.version;
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  let polls = 0, offline = false;
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/rpc', async route => {
    const response = await route.fetch();
    const body = await response.json();
    if (route.request().postDataJSON().method === 'snapshot' && body.ok) {
      polls++;
      for (const machine of body.result.machines) machine.lastSyncedAt = new Date().toISOString();
      if (offline) {
        body.result.machines[0].online = false;
        for (const node of body.result.nodes.filter(n => n.machineId === body.result.machines[0].machineId)) { node.online = false; node.available = false; node.status = 'offline'; }
      }
    }
    await route.fulfill({ response, json: body });
  });
  await page.goto(preview.url);
  await expect(page.locator('.inventory-node')).toHaveCount(3);
  await expect(page.locator('.inventory-start').first()).toBeEnabled();
  await page.getByRole('searchbox', { name: '搜索机器与 Agent' }).fill('');
  await page.locator('.inventory-node-details').first().locator('summary').click();
  await page.locator('.inventory-machine-actions .inventory-menu').first().locator('summary').click();
  await page.evaluate(() => {
    window.__pollNodes = [...document.querySelectorAll('.inventory-machine,.inventory-node')];
    window.__pollChanges = [];
    window.__pollObserver = new MutationObserver(rows => window.__pollChanges.push(...rows.filter(r => r.type === 'childList' || r.type === 'characterData').map(r => r.target.textContent)));
    // The explicitly opened menu contains the detailed sync timestamp. Observe
    // the cards' visible content separately from that requested diagnostic.
    for (const node of document.querySelectorAll('.inventory-node,.inventory-machine-title,.inventory-machine-head > .ui-status')) window.__pollObserver.observe(node, { subtree: true, childList: true, characterData: true });
  });
  const start = polls;
  await expect.poll(() => polls, { timeout: 15000 }).toBeGreaterThanOrEqual(start + 5);
  const stable = await page.evaluate(() => ({ changes: window.__pollChanges, same: window.__pollNodes.every((n, i) => n === document.querySelectorAll('.inventory-machine,.inventory-node')[i]), details: document.querySelector('.inventory-node-details').open, menu: document.querySelector('.inventory-machine-actions .inventory-menu').open }));
  assert.deepEqual(stable.changes, []); assert(stable.same && stable.details && stable.menu);
  report.checks.push('Five live polls with changing heartbeat: identical card DOM, no visible content replacement; expanded details and menu retained');
  await page.evaluate(() => window.__pollObserver.disconnect());
  await page.getByRole('button', { name: '关系图', exact: true }).click();
  await expect(page.locator('.graph-view-tools')).toContainText('布局已保存');
  await page.evaluate(() => {
    window.__graphBefore = [...document.querySelectorAll('.react-flow__node')].map(n => ({ id: n.dataset.id, transform: n.style.transform, text: n.textContent }));
    window.__pollChanges = [];
    window.__pollObserver = new MutationObserver(rows => window.__pollChanges.push(...rows.map(r => r.type)));
    for (const node of document.querySelectorAll('.graph-machine,.graph-tool')) window.__pollObserver.observe(node, { subtree: true, childList: true, characterData: true });
  });
  const graphStart = polls;
  await expect.poll(() => polls, { timeout: 15000 }).toBeGreaterThanOrEqual(graphStart + 5);
  const graph = await page.evaluate(() => ({ changes: window.__pollChanges, before: window.__graphBefore, after: [...document.querySelectorAll('.react-flow__node')].map(n => ({ id: n.dataset.id, transform: n.style.transform, text: n.textContent })) }));
  assert.deepEqual(graph.changes, []); assert.deepEqual(graph.after, graph.before);
  report.checks.push('Five graph polls with changing heartbeat: no card text/DOM mutations or position changes');
  offline = true;
  await expect(page.locator('.graph-machine-status').first()).toHaveText('离线', { timeout: 7000 });
  offline = false;
  await expect(page.locator('.graph-machine-status').first()).toHaveText('在线', { timeout: 7000 });
  report.checks.push('Actual disconnect and reconnect still update on live polling');
  await page.screenshot({ path: path.join(out, 'stable-graph.png') });
  assert.deepEqual(errors, []); report.polls = polls; report.status = 'passed';
})().catch(error => { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(out, 'windows-ui.json'), JSON.stringify(report, null, 2));
  await browser?.close(); await preview?.close();
});
