// Frozen Windows backend contract only; no SSH or native task execution.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process'), {createHash} = require('node:crypto');
const [bridge, pins, output] = process.argv.slice(2);
if (process.platform !== 'win32' || !output) throw Error('Windows/frozen bridge/pins/report required');
const installer = path.join(bridge, 'desktop/electron/ssh-install.cjs');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = {date: new Date().toISOString(), version: require('../package.json').version, status: 'running', environment: 'Shipped Windows Node / frozen packaged installer and pins / controlled SFTP fixtures; no SSH network or models', modelCalls: 0, checks: []};
(async()=>{try {
  assert.equal(hash(installer), hash(path.resolve(__dirname, '../electron/ssh-install.cjs')));
  report.installerSha256 = hash(installer);
  const names=fs.readdirSync(pins).filter(v=>v.endsWith('.json')).sort();
  assert.deepEqual(names,fs.readdirSync(path.resolve(__dirname,'../compatible-daemons')).filter(v=>v.endsWith('.json')).sort());
  for(const name of names)assert.equal(hash(path.join(pins,name)),hash(path.resolve(__dirname,'../compatible-daemons',name)));
  report.packagedPins=names.length;
  const tested = spawnSync(process.execPath, ['--test-reporter=tap', path.join(__dirname, 'ssh-compatibility.test.cjs')], {encoding: 'utf8', maxBuffer: 1024 * 1024, env: {...process.env, AGENTBRIDGE_COMPATIBILITY_INSTALLER: installer, AGENTBRIDGE_COMPATIBILITY_PIN_ROOT: pins}});
  fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(path.join(path.dirname(output), 'windows-contract.tap'), tested.stdout || '');
  assert.ifError(tested.error); assert.equal(tested.status, 0); assert.match(tested.stdout, /# pass 26\s/); assert.match(tested.stdout, /# fail 0\s/);
  report.contractTestsPassed = 26; report.checks.push('Frozen Windows installer passes 26 strict reuse/index/identity/digest/query contracts with the exact packaged pins');
  const {verifyScript} = require(installer);
  const script = verifyScript('Z:/controlled-absent-fixture', {files: Array.from({length: 1702}, (_, i) => ({path: 'controlled-' + i, size: 1, sha256: 'a'.repeat(64)}))});
  const failed = spawnSync(process.execPath, ['-'], {input: script, encoding: 'utf8', maxBuffer: 1024 * 1024});
  assert.ifError(failed.error); assert.equal(failed.status, 3); assert.equal(failed.stdout, ''); assert.equal(failed.stderr, 'CHECKSUM');
  report.checks.push('Shipped Windows Node executes the frozen large-manifest verifier and emits the fixed eight-byte failure without echoing its source');
  const controller=path.join(bridge,'desktop/electron/remote-maintenance.cjs');
  assert.equal(hash(controller),hash(path.resolve(__dirname,'../electron/remote-maintenance.cjs')));
  const {readMaintenanceInput,digest,MAX_MAINTENANCE_INPUT_BYTES}=require(controller);
  const original=require('./maintenance-input-fixture.cjs').frozenCatalogueInput(),bytes=Buffer.from(JSON.stringify(original));
  assert(bytes.length>8*1048576);assert.equal(MAX_MAINTENANCE_INPUT_BYTES,64*1048576);
  const chunks=[];for(let offset=0;offset<bytes.length;offset+=32768)chunks.push(bytes.subarray(offset,offset+32768));
  const decoded=await readMaintenanceInput(require('node:stream').Readable.from(chunks));
  assert.deepEqual(decoded,original);assert.equal(digest(decoded),digest(original));
  report.maintenanceInputBytes=bytes.length;report.checks.push('Frozen maintenance input reader retains every field and fingerprint of the full catalogue above 8MiB');
  report.status = 'passed';
} catch (error) {report.status = 'failed'; report.error = {code: error.code, message: error.message}; process.exitCode = 1;}
finally {fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));}})();
