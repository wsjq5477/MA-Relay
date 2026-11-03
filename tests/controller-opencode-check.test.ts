import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { SettingsStore } from '../src/settings.js';
import { startController, ipc } from '../src/controller.js';
import { v1Fixture } from './opencode-v1-fixture.js';
import { fixture } from './native-fixture.js';

test('Controller checks a healthy v1 service without querying its hanging v2 agent endpoint', async t => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-controller-v1-'));
  const native = await v1Fixture(root, { hangInfo: true, hangV2Agents: true });
  t.after(async () => { await native.close(); rmSync(root, { recursive: true, force: true }); });
  const directory = resolve(root, 'observer'), store = new SettingsStore(directory);
  store.initialize();
  const settings = store.read(), passwordFile = resolve(root, 'native.password');
  writeFileSync(passwordFile, native.password, { mode: 0o600 });
  settings.agents = [store.normalize({ agentId: 'v1', name: 'Existing v1', adapter: 'opencode',
    serverUrl: native.url, passwordFile, workspace: root, executable: process.execPath,
    managed: false, inheritNativeCli: true }, settings.deviceId)];
  const revision = settings.revision;
  settings.revision++;
  store.write(settings, revision);
  const controller = await startController(directory);
  try {
    const report = await ipc<Record<string, unknown>>(directory, { op: 'check', agentId: 'v1' });
    assert.equal(report.connection, 'connected');
    assert.equal(report.authentication, 'accepted');
    assert.equal(report.nativeAgentConfiguration, 'available');
    assert.equal(report.modelConfiguration, 'available');
    assert.equal(report.modelResponse, 'not_checked');
    assert.equal(native.counts.info, 0);
    assert.equal(native.counts.v2Agents, 0);
    assert.equal(native.counts.writes, 0);
    assert.equal(native.counts.creates, 0);
    assert.equal(native.counts.prompts, 0);
  } finally {
    await controller.close();
  }
});

for (const agents of [[{ id: 'build' }], [{ name: 'build' }], [{ id: 'other' }]]) {
  test(`Controller preserves v2 agent availability: ${JSON.stringify(agents)}`, async t => {
    const root = mkdtempSync(resolve(tmpdir(), 'ab-controller-v2-'));
    const native = await fixture(root, { agents });
    t.after(async () => { await native.close(); rmSync(root, { recursive: true, force: true }); });
    const directory = resolve(root, 'observer'), store = new SettingsStore(directory);
    store.initialize();
    const settings = store.read(), passwordFile = resolve(root, 'native.password');
    writeFileSync(passwordFile, native.password, { mode: 0o600 });
    settings.agents = [store.normalize({ agentId: 'v2', name: 'Existing v2', adapter: 'opencode',
      serverUrl: native.url, passwordFile, workspace: root, executable: process.execPath,
      managed: false }, settings.deviceId)];
    const revision = settings.revision;
    settings.revision++;
    store.write(settings, revision);
    const controller = await startController(directory);
    try {
      const report = await ipc<Record<string, unknown>>(directory, { op: 'check', agentId: 'v2' });
      assert.equal(report.connection, 'connected');
      assert.equal(report.authentication, 'accepted');
      assert.equal(report.nativeAgentConfiguration, 'id' in agents[0]! && agents[0].id === 'other' ? 'unavailable' : 'available');
      assert.equal(report.modelConfiguration, 'available');
      assert.equal(report.modelResponse, 'not_checked');
      assert.equal(native.count(), 0);
      assert.equal(native.sessions.size, 0);
    } finally {
      await controller.close();
    }
  });
}
