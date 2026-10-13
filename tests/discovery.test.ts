import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverOpenCode } from '../src/discovery.js';

test('discovery uses PATH and the native installation fallback, skips broken versions, and never connects', async () => {
  const home = mkdtempSync(resolve(tmpdir(), 'ab-discover-'));
  const bad = resolve(home, 'bad'), path = resolve(home, 'bin'), native = resolve(home, '.opencode/bin');
  for (const dir of [bad, path, native]) mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(bad, 'opencode'), '#!/bin/sh\nexit 1\n', { mode: 0o700 });
  writeFileSync(resolve(native, 'opencode'), '#!/bin/sh\n[ "$1" = "--version" ] || exit 9\necho "opencode v2.0.24"\n', { mode: 0o700 });
  symlinkSync(resolve(native, 'opencode'), resolve(path, 'opencode'));
  try {
    assert.equal((await discoverOpenCode({ path: bad + ':' + path, home }))[0]!.executable, resolve(native, 'opencode'));
    assert.equal((await discoverOpenCode({ path: '', home }))[0]!.version, '2.0.24');
    writeFileSync(resolve(native, 'opencode'), '#!/bin/sh\necho "opencode v1.0.0"\n', { mode: 0o700 });
    assert.deepEqual(await discoverOpenCode({ path: '', home }), []);
  } finally { rmSync(home, { recursive: true, force: true }); }
});
