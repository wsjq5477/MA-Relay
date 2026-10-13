import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { initOpenCode, loadConfig } from '../src/config.js';
import { HubStore } from '../src/storage/hub-store.js';
import { SettingsStore, resourceKey } from '../src/settings.js';
import { startController, ipc } from '../src/controller.js';

test('import preserves limited operator ACL and hides foreign occupied task in offline summary', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-owner-')), dir = resolve(root, 'bridge'); initOpenCode(dir, root);
  const path = resolve(dir, 'hub.json'); const raw = JSON.parse(readFileSync(path, 'utf8'));
  const operator = { ...raw.users[0], allowedAgents: [] };
  writeFileSync(resolve(dir, 'other.token'), 'other-owner-' + 'x'.repeat(64), { mode: 0o600 });
  raw.users = [{ id: 'other-owner', tokenFile: './other.token', allowedAgents: ['opencode'], diagnostics: true }, operator]; writeFileSync(path, JSON.stringify(raw));
  const config = loadConfig(path, 'hub'), db = new HubStore(config.dataDir);
  try {
    db.register([{ agentId: 'opencode', name: 'Old', adapter: 'opencode', workspace: root, healthy: true, connectorId: 'edge-a', device: 'old', lastSeenAt: new Date().toISOString(), capabilities: { concurrency: 1, progress: true, cancel: false, nativeSessions: true } }]);
    const task = db.create('other-owner', 'private-request', 'opencode', 'private message'); db.attempted(task.taskId); db.unknown(task.taskId, 'private execution'); db.close();
    const store = new SettingsStore(dir), settings = store.initialize(dir);
    assert.deepEqual(store.hub(settings).users.find(u => u.id === operator.id)!.allowedAgents, []);
    const controller = await startController(dir);
    try { const list = await ipc<{ items: { currentTask: { status: string; taskId?: string } }[] }>(dir, { op: 'agents' });
      assert.equal(list.items[0]!.currentTask.status, 'private'); assert.equal(list.items[0]!.currentTask.taskId, undefined);
      assert(!JSON.stringify(list).includes(task.taskId)); assert(!JSON.stringify(list).includes('private message'));
    } finally { await controller.close(); }
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});
test('legacy unknown without native binding pins historical directory even when desired config changed', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-history-')), old = resolve(root, 'old'), next = resolve(root, 'next'); mkdirSync(old); mkdirSync(next);
  const db = new HubStore(resolve(root, 'data'));
  const agent = { agentId: 'a', name: 'A', adapter: 'opencode' as const, workspace: old, healthy: true, connectorId: 'edge', device: 'local', lastSeenAt: new Date().toISOString(), capabilities: { concurrency: 1 as const, progress: true as const, cancel: false as const, nativeSessions: true } };
  try {
    db.register([agent]); const task = db.create('owner', 'legacy', 'a', 'work'); db.attempted(task.taskId); db.unknown(task.taskId, 'no binding');
    db.register([{ ...agent, workspace: next, resourceKey: resourceKey(next) }]); assert.equal(db.get(task.taskId)!.resourceKey, resourceKey(old));
    db.register([{ ...agent, agentId: 'alias', resourceKey: resourceKey(old) }]); assert.throws(() => db.create('owner', 'bypass', 'alias', 'work'), /occupied/);
    const unresolved = { ...agent, agentId: 'unresolved', workspace: undefined }; db.register([unresolved]);
    const uncertain = db.create('owner', 'unknown-location', 'unresolved', 'work'); db.attempted(uncertain.taskId); db.unknown(uncertain.taskId, 'no location');
    db.register([{ ...unresolved, workspace: next, resourceKey: resourceKey(next) }]); assert(db.get(uncertain.taskId)!.resourceKey?.startsWith('unresolved:'));
    assert.equal(db.occupied('new-agent', resourceKey(next))!.taskId, uncertain.taskId);
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});
