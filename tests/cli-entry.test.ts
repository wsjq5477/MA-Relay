import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('installed CLI symlink invokes the command instead of silently exiting', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'agentbridge-cli-entry-'));
  try {
    const linked = resolve(directory, 'agentbridge');
    symlinkSync(resolve('dist/cli.js'), linked);
    const { stdout } = await promisify(execFile)(process.execPath, [linked, '--help'], { timeout: 5000 });
    assert(stdout.includes('agentbridge up'));
    assert(stdout.includes('agentbridge run AGENT MESSAGE'));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
