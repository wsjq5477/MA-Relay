import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, promises as fs} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {SettingsStore} from '../src/settings.js';
import {startController, ipc} from '../src/controller.js';
import {fixture} from './native-fixture.js';
import {opencodeSchema} from '../src/config.js';

for (const extension of ['cjs', 'mjs']) {
  test(`controller installation check launches the exact selected ${extension} without shell or model calls`, async t => {
    const root = mkdtempSync(resolve(tmpdir(), 'ab-install-check-')), directory = resolve(root, 'bridge');
    const native = await fixture(root);
    const owned: {controller?:Awaited<ReturnType<typeof startController>>} = {};
    t.after(async () => {
      await owned.controller?.close();
      await native.close();
      await fs.rm(root, {recursive:true, force:true, maxRetries:8, retryDelay:100});
    });
    const store = new SettingsStore(directory);
    const settings = store.initialize();
    const selected = resolve(root, 'selected & literal.' + extension), receipt = resolve(root, 'version-read.json');
    const imports = extension === 'mjs' ? "import {writeFileSync} from 'node:fs';" : "const {writeFileSync}=require('node:fs');";
    // No shebang: launch must use the already selected script through Node.
    writeFileSync(selected, `${imports}
      writeFileSync(${JSON.stringify(receipt)},JSON.stringify({args:process.argv.slice(2),nodeMode:process.env.ELECTRON_RUN_AS_NODE}));
      process.stdout.write('opencode v2.0.24\\n');`);
    const passwordFile = resolve(directory, 'native.password');
    writeFileSync(passwordFile, native.password, {mode:0o600});
    store.write({...settings, revision:settings.revision+1, agents:[opencodeSchema.parse({
      agentId:'original', name:'Original', adapter:'opencode', workspace:root, executable:selected,
      serverUrl:native.url, passwordFile, managed:false, nativeAgent:'build', enabled:true,
      pollMs:50, permissions:[], revision:1,
    })]}, settings.revision);
    owned.controller = await startController(directory);
    const check = await ipc<{installation:string;version:string;connection:string;modelResponse:string}>(directory, {op:'check',agentId:'original'});
    assert.equal(check.installation, 'available');
    assert.equal(check.version, 'opencode v2.0.24');
    assert.equal(check.connection, 'connected');
    assert.equal(check.modelResponse, 'not_checked');
    assert.deepEqual(JSON.parse(readFileSync(receipt,'utf8')), {args:['--version'],nodeMode:'1'});
    assert.equal(native.count(), 0);
    unlinkSync(receipt); unlinkSync(selected);
    const other = resolve(root, '.opencode/bin'); mkdirSync(other, {recursive:true});
    writeFileSync(resolve(other,'opencode.cjs'), `require('node:fs').writeFileSync(${JSON.stringify(receipt)},'wrong-installation');console.log('opencode v2.0.24');`);
    assert.equal((await ipc<{installation:string}>(directory, {op:'check',agentId:'original'})).installation, 'unavailable');
    await assert.rejects(fs.stat(receipt), {code:'ENOENT'});
    assert.equal(native.count(), 0);
  });
}
