// Import only an explicitly frozen portable EXE. Never run it or contact SSH.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const {localManifest, MAX_COMPATIBLE_DAEMONS} = require('../electron/ssh-install.cjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function importManifest({exe, expectedSha256, version, sevenZip, destination}) {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256) || !/^[a-zA-Z0-9.-]{1,80}$/.test(version)) throw Error('Provide the frozen SHA-256 and exact version');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-import-manifest-'));
  try {
    const snapshot = path.join(work, 'frozen.exe'); fs.copyFileSync(exe, snapshot);
    const bytes = fs.readFileSync(snapshot), actual = hash(bytes);
    if (actual !== expectedSha256) throw Error('Frozen EXE checksum mismatch; no manifest imported');
    const run = args => execFileSync(sevenZip, args, {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
    run(['e', '-y', '-bd', '-bb0', '-o' + work, snapshot, '$PLUGINSDIR/app-64.7z']);
    const payload = path.join(work, 'app-64.7z');
    const listing = run(['l', '-slt', payload, 'resources/linux-package/*']);
    const entries = listing.slice(listing.indexOf('----------\n') + 11).split(/\r?\n\r?\n/).filter(block => /^Path = /m.test(block));
    if (!entries.length) throw Error('Frozen Linux package is absent');
    for (const entry of entries) {
      const name = /^Path = (.+)$/m.exec(entry)?.[1]?.trim();
      if (!name?.startsWith('resources/linux-package/') || name.split('/').some(p => !p || p === '.' || p === '..') || name.includes('\\') || /^(Symbolic Link|Hard Link) = .+$/m.test(entry) || /(?:^|\s)l[rwx-]{9}/m.test(entry)) throw Error('Unsafe frozen archive member');
    }
    run(['x', '-y', '-bd', '-bb0', '-o' + work, payload, 'resources/linux-package/*']);
    const packageDirectory = path.join(work, 'resources/linux-package');
    const {manifest, digest} = localManifest(packageDirectory);
    if (manifest.version !== version) throw Error('Frozen Linux package version mismatch');
    const raw = fs.readFileSync(path.join(packageDirectory, 'manifest.json'));
    fs.mkdirSync(destination, {recursive: true});
    const target = path.join(destination, version + '.json');
    const existed = fs.existsSync(target);
    if (existed) {
      if (!fs.readFileSync(target).equals(raw)) throw Error('An existing pin differs; preserve it for review');
    } else {
      if (fs.readdirSync(destination).filter(name => name.endsWith('.json')).length >= MAX_COMPATIBLE_DAEMONS) throw Error('Compatibility index limit reached');
      fs.writeFileSync(target, raw, {flag: 'wx'});
    }
    return {status: 'passed', version, exeBytes: bytes.length, exeSha256: actual,
      manifestDigest: digest, manifestFileSha256: hash(raw), linuxFilesVerified: manifest.files.length,
      result: existed ? 'identical_existing_pin' : 'imported', remoteWrites: 0, modelCalls: 0};
  } finally {fs.rmSync(work, {recursive: true, force: true});}
}
module.exports = {importManifest};
if (require.main === module) {
  const [exe, expectedSha256, version, sevenZip, destination = path.resolve(__dirname, '../compatible-daemons')] = process.argv.slice(2);
  try {console.log(JSON.stringify(importManifest({exe, expectedSha256, version, sevenZip, destination}), null, 2));}
  catch (error) {console.error(error.message); process.exitCode = 1;}
}
