// Test-only Linux stdio MCP client, controlled through a private file mailbox.
const fs = require('node:fs'), path = require('node:path');
const {spawn} = require('node:child_process'), {randomBytes} = require('node:crypto');
const readline = require('node:readline');
if (process.platform !== 'linux') throw Error('Native WSL Linux runtime required');
const [mode, ...files] = process.argv.slice(2);
if (mode === '--launch') {
  if (!files.length || files.length % 2) throw Error('Configuration/state pairs required');
  for (let i = 0; i < files.length; i += 2) {
    fs.mkdirSync(path.dirname(files[i + 1]), {mode: 0o700});
    spawn(process.execPath, [__filename, '--serve', files[i], files[i + 1]], {detached: true, stdio: 'ignore'}).unref();
  }
} else if (mode === '--serve') {
  const [configFile, stateFile] = files;
  const pending = new Map(), secret = randomBytes(32).toString('hex');
  let native, sequence = 0, busy = false, timer;
  function stopped() {
    clearInterval(timer);
    fs.writeFileSync(stateFile + '.stopped', 'true', {mode: 0o600});
  }
  function initialize() {
    if (native) return;
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    native = spawn(config.command, config.args, {env: {...process.env, ...config.env}, stdio: ['pipe', 'pipe', 'pipe']});
    native.stderr.resume();
    readline.createInterface({input: native.stdout}).on('line', line => {
      try {
        const reply = JSON.parse(line), job = pending.get(reply.id);
        if (job) {clearTimeout(job.timer); pending.delete(reply.id); if (reply.error) job.reject(Error('Native MCP protocol error')); else job.resolve(reply.result);}
      } catch {}
    });
    native.once('error', stopped);
    native.once('exit', () => {
      for (const job of pending.values()) {clearTimeout(job.timer); job.reject(Error('Native client exited'));}
      stopped();
    });
  }
  const rpc = (method, params) => {initialize(); return new Promise((resolve, reject) => {
    const id = ++sequence, timeout = setTimeout(() => {pending.delete(id); reject(Error('Original native response unconfirmed'));}, 30000);
    pending.set(id, {resolve, reject, timer: timeout});
    native.stdin.write(JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\n');
  });};
  timer = setInterval(async () => {
    if (busy || !fs.existsSync(stateFile + '.request')) return;
    busy = true;
    try {
      const input = JSON.parse(fs.readFileSync(stateFile + '.request', 'utf8'));
      fs.unlinkSync(stateFile + '.request');
      if (input.secret !== secret || !/^[a-f0-9]+$/.test(input.id)) throw Error('Invalid fixture control');
      let result, error;
      try {result = input.close ? {} : await rpc(input.method, input.params || {});} catch (failure) {error = failure.message;}
      const response = stateFile + '.response-' + input.id;
      fs.writeFileSync(response + '.tmp', JSON.stringify({result, error}), {mode: 0o600});
      fs.renameSync(response + '.tmp', response);
      if (input.close) {if (native) native.stdin.end(); else stopped();}
    } finally {busy = false;}
  }, 50);
  fs.writeFileSync(stateFile, JSON.stringify({pid: process.pid, secret}), {mode: 0o600});
} else throw Error('Explicit fixture mode required');
