const assert = require('node:assert/strict');
const { execFile, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { ensurePrivateDirectory, ensurePrivateDirectoryAsync, retryPrivateDirectory } = require('../electron/private-directory.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentbridge-acl-'));
  const directory = path.join(root, 'profile [already existing]');
  t.after(() => {
    fs.rmSync(path.join(directory, 'existing.json'), { force: true });
    if (fs.existsSync(directory)) fs.rmdirSync(directory);
    fs.rmdirSync(root);
  });
  return directory;
}

test('Windows ACL wait allows other work, shares its timeout and backs off until an explicit retry', async t => {
  const directory = fixture(t);
  const calls = [];
  let finished;
  let notifyStarted;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  const options = {
    platform: 'win32',
    execFile(executable, args, config, callback) {
      calls.push({ executable, args, config });
      finished = callback;
      notifyStarted();
    }
  };

  const first = ensurePrivateDirectoryAsync(directory, options);
  const second = ensurePrivateDirectoryAsync(directory, options);
  await started;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].config.timeout, 10000);
  assert.ok(calls[0].executable.endsWith('powershell.exe'));
  assert.equal(calls[0].config.env.AGENTBRIDGE_PRIVATE_DIRECTORY, directory);
  assert.equal(calls[0].args.some(argument => argument.includes(directory)), false);
  const original = Object.assign(new Error('S-1-5-21-999-1000 token with private path ' + directory), {
    killed: true, code: null, signal: 'SIGTERM'
  });
  finished(original);
  const failures = await Promise.allSettled([first, second]);
  assert.equal(failures[0].reason, failures[1].reason);
  assert.equal(failures[0].reason.code, 'PRIVATE_DIRECTORY_TIMEOUT');
  assert.match(failures[0].reason.message, /^PRIVATE_DIRECTORY_TIMEOUT：/);
  assert.doesNotMatch(failures[0].reason.message, /S-1-5|token|profile/);
  assert.equal(failures[0].reason.cause, undefined);

  await assert.rejects(ensurePrivateDirectoryAsync(directory, options), error => error === failures[0].reason);
  assert.equal(calls.length, 1);
  retryPrivateDirectory(directory);
  const result = await ensurePrivateDirectoryAsync(directory, {
    ...options,
    execFile(executable, args, config, callback) {
      calls.push({ executable, args, config });
      callback(null, 'verified');
    }
  });
  assert.equal(result, directory);
  assert.equal(calls.length, 2);
});

test('Windows ACL initialization rejects an unconfirmed result without exposing tool output', async t => {
  const directory = fixture(t);
  await assert.rejects(ensurePrivateDirectoryAsync(directory, {
    platform: 'win32',
    execFile(_executable, _args, _config, callback) { callback(null, 'S-1-5-21-999-1000'); }
  }), { code: 'PRIVATE_DIRECTORY', message: /^PRIVATE_DIRECTORY：/ });
});

test('real Windows ACL repairs new and unsafe roots, and only reads on later startup', { skip: process.platform !== 'win32' }, async t => {
  const directory = fixture(t);
  const results = [];
  const options = {
    execFile(executable, args, config, callback) {
      execFile(executable, args, config, (error, stdout) => {
        if (!error) results.push(stdout.trim());
        callback(error, stdout);
      });
    }
  };
  await ensurePrivateDirectoryAsync(directory, options);
  const child = path.join(directory, 'existing.json');
  fs.writeFileSync(child, '{"kept":true}');
  await ensurePrivateDirectoryAsync(directory, options);

  const legacyAcl = String.raw`$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& "$env:SystemRoot\System32\icacls.exe" $env:AGENTBRIDGE_PRIVATE_DIRECTORY '/inheritance:r' '/grant:r' ('*' + $sid + ':(OI)(CI)F')
exit $LASTEXITCODE`;
  const powershell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(legacyAcl, 'utf16le').toString('base64')], {
    windowsHide: true, stdio: 'ignore', env: { ...process.env, AGENTBRIDGE_PRIVATE_DIRECTORY: directory }
  });
  await ensurePrivateDirectoryAsync(directory, options);

  const icacls = path.join(process.env.SystemRoot, 'System32', 'icacls.exe');
  execFileSync(icacls, [directory, '/grant', '*S-1-1-0:(RX)'], { windowsHide: true, stdio: 'pipe' });
  await ensurePrivateDirectoryAsync(directory, options);
  await ensurePrivateDirectoryAsync(directory, options);
  assert.deepEqual(results, ['repaired', 'verified', 'verified', 'repaired', 'verified']);
  assert.equal(fs.readFileSync(child, 'utf8'), '{"kept":true}');

  let synchronousResult;
  ensurePrivateDirectory(directory, {
    execFileSync(executable, args, config) {
      synchronousResult = execFileSync(executable, args, config).trim();
      return synchronousResult;
    }
  });
  assert.equal(synchronousResult, 'verified');
});
