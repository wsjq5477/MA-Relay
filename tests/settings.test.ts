import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtempSync, readFileSync, writeFileSync, chmodSync, rmSync, unlinkSync, type PathLike } from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { SettingsStore } from '../src/settings.js';
import { initOpenCode } from '../src/config.js';

test('atomic settings write refuses stale revision; storage failure preserves complete last version', t => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-save-fault-')); const store = new SettingsStore(root); const first = store.initialize();
  try {
    const second = { ...first, revision: 2, checks: { probe: { state: 'recorded' } } }; store.write(second, 1);
    const before = readFileSync(store.path, 'utf8'); assert.throws(() => store.write({ ...first, revision: 2 }, 1), /另一个操作更新/); assert.equal(readFileSync(store.path, 'utf8'), before);
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      // chmod cannot deny Windows writes, and root can bypass POSIX mode bits.
      // Inject a disk failure at the final rename so the real staged write runs.
      const rename = fs.renameSync, failure = Object.assign(new Error('controlled disk full'), {code:'ENOSPC'});
      t.mock.method(fs,'renameSync',(source:PathLike,destination:PathLike) => {
        if(destination === store.path) throw failure;
        return rename(source,destination);
      });
      syncBuiltinESMExports();
      try { assert.throws(() => store.write({...second,revision:3},2), error => error === failure); }
      finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
    } else {
      chmodSync(root, 0o500);
      try { assert.throws(() => store.write({ ...second, revision: 3 }, 2)); }
      finally { chmodSync(root, 0o700); }
    }
    assert.equal(readFileSync(store.path, 'utf8'), before); assert.equal(store.read().revision, 2);
    store.write({ ...second, revision: 3 }, 2); assert.equal(store.read().revision, 3);
  } finally { chmodSync(root, 0o700); rmSync(root, { recursive: true, force: true }); }
});
test('missing credential and malformed import do not write authority or alter legacy files; repair can import', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ab-import-fault-')), dir = resolve(root, 'legacy'); initOpenCode(dir, root);
  const store = new SettingsStore(dir); const hub = resolve(dir, 'hub.json'); const old = readFileSync(hub, 'utf8'); const edge = readFileSync(resolve(dir, 'edge-a.json'), 'utf8');
  const tokenPath = resolve(dir, 'user.token'); const token = readFileSync(tokenPath, 'utf8');
  try {
    unlinkSync(tokenPath); assert.throws(() => store.initialize(dir), /Credential file/); assert(!store.exists()); assert.equal(readFileSync(hub, 'utf8'), old);
    writeFileSync(tokenPath, token, { mode: 0o600 }); writeFileSync(hub, '{bad'); assert.throws(() => store.initialize(dir)); assert(!store.exists()); assert.equal(readFileSync(hub, 'utf8'), '{bad');
    assert.equal(readFileSync(resolve(dir, 'edge-a.json'), 'utf8'), edge); writeFileSync(hub, old); assert.equal(store.initialize(dir).agents[0]!.agentId, 'opencode');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
