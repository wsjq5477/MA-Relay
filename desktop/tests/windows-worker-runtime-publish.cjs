// Actual Windows Electron/ICU resources, synthetic state, no native Agent/model.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { workerRuntime } = require('../electron/worker-runtime.cjs');

assert.equal(process.platform, 'win32');
const output = path.resolve(process.argv[2]);
const temporaryRoot = fs.realpathSync(os.tmpdir());
const source = fs.realpathSync(require('electron'));
for (const file of [output, temporaryRoot, source]) assert(!/^c:/i.test(file), 'Use non-C storage');
const root = fs.mkdtempSync(path.join(temporaryRoot, 'ab-runtime-publish-'));
const report = { date: new Date().toISOString(), platform: process.platform, node: process.versions.node,
  status: 'running', checks: [], nativePrompts: 0 };
const probe = executable => {
  const result = spawnSync(executable, ['-p', 'JSON.stringify({electron:process.versions.electron,node:process.versions.node,answer:21*2})'],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true, encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const value = JSON.parse(result.stdout.trim()); assert.equal(value.answer, 42); return value;
};
try {
  report.electron = probe(source).electron;
  const state = path.join(root, 'state'), options = { executable: source, electron: report.electron };
  const rename = fs.renameSync;
  let attempts = 0, firstPublish;
  fs.renameSync = (from, to) => {
    assert(path.resolve(from).startsWith(root + path.sep));
    firstPublish ??= performance.now();
    if (++attempts <= 2) throw Object.assign(new Error('controlled Windows publication lock'),
      { code: attempts === 1 ? 'ENOTEMPTY' : 'EPERM' });
    return rename(from, to);
  };
  let executable;
  try { executable = workerRuntime(state, options); }
  finally { fs.renameSync = rename; }
  report.publicationMilliseconds = performance.now() - firstPublish;
  assert.equal(attempts, 3); assert(report.publicationMilliseconds < 5000);
  assert.equal(probe(executable).electron, report.electron);
  report.checks.push('Two controlled locks followed by a complete, executable persistent Electron/ICU runtime');
  assert.equal(workerRuntime(state, options), executable);
  report.checks.push('Repeated preparation reuses the original validated runtime');

  const resource = path.join(path.dirname(executable), 'icudtl.dat');
  fs.writeFileSync(resource, 'controlled-corruption');
  const repaired = workerRuntime(state, options);
  assert.notEqual(repaired, executable); assert(repaired.includes('.repair-'));
  assert.equal(fs.readFileSync(resource, 'utf8'), 'controlled-corruption');
  assert.equal(probe(repaired).electron, report.electron);
  assert.equal(workerRuntime(state, options), repaired);
  report.checks.push('Corruption repairs into an executable sibling and preserves the original runtime');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = { code: error.code, message: error.message }; process.exitCode = 1;
} finally {
  // Resolve this exact owned fixture before recursive teardown. Cleanup never
  // changes the test outcome or erases a primary diagnostic.
  try {
    assert.equal(fs.realpathSync(root), root);
    assert.equal(path.dirname(root), temporaryRoot);
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    report.cleanup = 'removed owned fixture';
  } catch (error) { report.cleanup = { code: error.code, message: error.message }; }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
