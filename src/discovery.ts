import { accessSync, constants, realpathSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export interface DetectedAgent { executable: string; version: string; name: string }

/** Read-only executable discovery. Never starts a service or invokes a model. */
export async function discoverOpenCode(environment: { path?: string; home?: string } = {}): Promise<DetectedAgent[]> {
  const home = environment.home ?? homedir();
  const candidates = [
    ...(environment.path ?? process.env.PATH ?? '').split(delimiter).filter(Boolean).map(dir => resolve(dir, 'opencode')),
    resolve(home, '.opencode/bin/opencode'), resolve(home, '.local/bin/opencode'), resolve(home, '.npm-global/bin/opencode'),
  ];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    let executable: string;
    try { accessSync(candidate, constants.X_OK); executable = realpathSync(candidate); } catch { continue; }
    if (seen.has(executable)) continue; seen.add(executable);
    try {
      const { stdout } = await promisify(execFile)(executable, ['--version'], { timeout: 5000, maxBuffer: 65536 });
      const version = stdout.match(/\b(?:v)?(2\.\d+\.\d+(?:[-+][\w.-]+)?)/)?.[1];
      if (version) return [{ name: 'OpenCode', executable, version }];
    } catch { /* Try the next installed location; never claim a broken binary is connected. */ }
  }
  return [];
}
