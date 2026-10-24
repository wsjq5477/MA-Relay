const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {importManifest} = require('../scripts/import-daemon-manifest.cjs');
const {stageLinuxPackage} = require('../scripts/stage-linux-package.cjs');
const temp = t => {const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-pin-import-test-')); t.after(() => fs.rmSync(dir, {recursive: true, force: true})); return dir;};
test('a mismatched frozen EXE hash rejects before extraction or trust-directory writes', t => {
  const dir = temp(t), exe = path.join(dir, 'source.exe'), destination = path.join(dir, 'pins');
  fs.writeFileSync(exe, 'synthetic-not-an-executable');
  assert.throws(() => importManifest({exe, expectedSha256: '0'.repeat(64), version: '0.6.0-fixture', sevenZip: path.join(dir, 'must-not-run'), destination}), /checksum mismatch/);
  assert(!fs.existsSync(destination)); assert.equal(fs.readFileSync(exe, 'utf8'), 'synthetic-not-an-executable');
});
test('an invalid version never becomes a pin path or an extraction attempt', t => {
  const dir = temp(t), destination = path.join(dir, 'pins');
  assert.throws(() => importManifest({exe: 'must-not-read', expectedSha256: '0'.repeat(64), version: '../escape', sevenZip: 'must-not-run', destination}), /exact version/);
  assert(!fs.existsSync(destination));
});
test('packaging rejects excess compatibility pins before staging files or compiling a runtime', t => {
  const repo = temp(t), pins = path.join(repo, 'desktop/compatible-daemons'), destination = path.join(repo, 'output');
  fs.mkdirSync(pins, {recursive: true});
  for (let i = 0; i < 129; i++) fs.writeFileSync(path.join(pins, `${i}.json`), '{}');
  assert.throws(() => stageLinuxPackage({repo, runtime: 'must-not-read', destination, nodeExecutable: 'must-not-run', version: '0.6.0-fixture'}), /索引上限/);
  assert(!fs.existsSync(destination));
});
