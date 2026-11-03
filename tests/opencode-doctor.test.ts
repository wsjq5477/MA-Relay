import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { initOpenCode } from '../src/config.js';
import { doctor } from '../src/local.js';
import { v1Fixture } from './opencode-v1-fixture.js';
import { fixture } from './native-fixture.js';

for (const [protocol, start] of [['v1', v1Fixture], ['v2', fixture]] as const) {
  test(`doctor retains its public JSON fields with ${protocol} internal agent metadata`, async t => {
    const root = mkdtempSync(resolve(tmpdir(), 'ab-doctor-contract-'));
    const native = await start(root);
    t.after(async () => { await native.close(); rmSync(root, { recursive: true, force: true }); });
    const directory = resolve(root, 'bridge'); initOpenCode(directory, root);
    const file = resolve(directory, 'edge-a.json'), config = JSON.parse(readFileSync(file, 'utf8'));
    Object.assign(config.agents[0], { serverUrl: native.url, managed: false });
    writeFileSync(file, JSON.stringify(config));
    writeFileSync(resolve(directory, 'native.password'), native.password, { mode: 0o600 });
    const result = await doctor(directory) as Record<string, unknown>;
    assert.deepEqual(Object.keys(result).sort(), ['agentId', 'healthy', 'model', 'serverUrl', 'version', 'workspace']);
    assert.equal(result.healthy, true);
    assert.equal(native.sessions.size, 0);
  });
}
