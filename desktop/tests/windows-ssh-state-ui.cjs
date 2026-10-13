// Manual Windows renderer check: controlled snapshots, no SSH/native prompts.
const fs = require('node:fs'), path = require('node:path');
const { chromium, expect } = require('../node_modules/@playwright/test');
const { mergeSshState } = require('../electron/coordinator-service.cjs');
const version = require('../package.json').version;
const output = path.resolve(__dirname, '../../artifacts/ssh-error-clear/2026-10-12');
const error = '远端已有其他版本后台；I06A 不会自动替换运行中的版本，请使用对应客户端或等待后台升级功能。';
const stale = { machineId: 'fixture-machine', connectionId: 'fixture-connection', kind: 'ssh', platform: 'linux', name: '测试 Linux', host: 'linux.example.test', port: 22, username: 'fixture', online: true, error, connectionError: { code: 'SSH_DAEMON_UPGRADE_REQUIRED', message: error } };
const state = { ...stale, stage: 'online' }; delete state.error; delete state.connectionError;
const node = { nodeId: 'fixture-node', machineId: stale.machineId, name: 'OpenCode', adapter: 'opencode', version: '2.0.26', executable: '/opt/opencode', healthy: true, online: true, executionSupported: true, connected: true, status: 'connected', busy: false, available: true };
const report = { date: new Date().toISOString(), version, scope: 'Real Windows Edge renderer with controlled snapshot payloads from the production SSH merge; no real SSH or native models', status: 'running', checks: [], submittedNativePrompts: 0 };
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1250, height: 850 } });
    await page.addInitScript(({ machine, node, version }) => {
      window.fixtureMachine = machine;
      window.agentbridge = {
        call: async method => {
          if (method !== 'snapshot') throw new Error('Unexpected mutation in read-only UI fixture');
          return { ok: true, result: { configured: true, machines: [window.fixtureMachine], nodes: [node], agents: { items: [], revision: 0, connected: true }, collaboration: { leaderId: null, memberIds: [], revision: 0 }, tasks: [], conversations: [] } };
        },
        preferences: async () => ({ theme: 'light', platform: 'win32', version }),
        pending: async () => [], recoverPending: async () => ({ resolved: 0 }),
      };
    }, { machine: stale, node, version });
    await page.goto(process.argv[2] || 'http://127.0.0.1:4215');
    await expect(page.locator('.machine-error')).toHaveText(error);
    const recovered = mergeSshState({ ...stale }, state, true);
    await page.evaluate(machine => { window.fixtureMachine = machine; }, recovered);
    await expect(page.locator('.machine-error')).toHaveCount(0, { timeout: 12000 });
    await expect(page.getByText('已接入', { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(output, 'recovered-ui.png'), fullPage: true });
    report.checks.push('Same online machine and connected OpenCode retain their card; old version warning disappears after snapshot refresh');
    const failed = mergeSshState({ ...stale, online: false, error: '机器后台响应超时，其他机器仍可使用。' }, state, true);
    await page.evaluate(machine => { window.fixtureMachine = machine; }, failed);
    await expect(page.locator('.machine-error')).toHaveText(failed.error, { timeout: 12000 });
    report.checks.push('A new RPC failure remains visible even while SSH transport state is online');
    report.status = 'passed';
  } finally { await browser.close(); }
})().catch(e => { report.status = 'failed'; report.error = e.message; process.exitCode = 1; }).finally(() => {
  fs.writeFileSync(path.join(output, 'ui.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
});
