const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { workerRuntime } = require("../electron/worker-runtime.cjs");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-runtime-"));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true, maxRetries:8, retryDelay:100 }));
  const source = path.join(root, "portable-extraction");
  const state = path.join(root, "profile");
  fs.mkdirSync(source);
  for (const name of ["AgentBridge.exe", "icudtl.dat", "snapshot_blob.bin", "v8_context_snapshot.bin", "LICENSE.electron.txt"])
    fs.writeFileSync(path.join(source, name), name);
  return { root, source, state, options: { executable: path.join(source, "AgentBridge.exe"), electron: "fixture" } };
}

test("detached runtime survives portable extraction cleanup and retains license", async t => {
  const f = fixture(t);
  const executable = workerRuntime(f.state, f.options);
  assert.notEqual(path.dirname(executable), f.source);
  assert.equal(fs.readFileSync(path.join(path.dirname(executable), "icudtl.dat"), "utf8"), "icudtl.dat");
  assert.ok(fs.existsSync(path.join(path.dirname(executable), "LICENSE.electron.txt")));
  await fs.promises.rm(f.source, { recursive: true });
  assert.equal(fs.existsSync(f.source), false);
  assert.equal(workerRuntime(f.state, f.options), executable);
});

test("missing ICU or V8 resources reject startup before admitting a native task", t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.source, "icudtl.dat"));
  assert.throws(() => workerRuntime(f.state, f.options), { code: "CLAUDE_RUNTIME_MISSING" });
  assert.equal(fs.existsSync(f.state), false);
});

test("ordinary Node keeps using its existing executable", t => {
  const f = fixture(t);
  assert.equal(workerRuntime(f.state, { executable: process.execPath, electron: "" }), process.execPath);
  assert.equal(fs.existsSync(f.state), false);
});

test('Coordinator to Windows runtime copies never track or copy their own manifest', async t => {
  const f = fixture(t);
  const coordinator = workerRuntime(path.join(f.state, 'coordinator'), f.options);
  const options = { ...f.options, executable: coordinator };
  const executable = workerRuntime(path.join(f.state, 'windows'), options);
  const manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(executable), 'runtime.json')));
  assert.equal(manifest.files.some(file => file.name === 'runtime.json'), false);
  assert.equal(workerRuntime(path.join(f.state, 'windows'), options), executable);
  await fs.promises.rm(f.source, { recursive: true });
  assert.equal(fs.existsSync(f.source), false);
  assert.equal(workerRuntime(path.join(f.state, 'windows'), options), executable);
});

test('alpha.9 self-referential manifests remain usable without changing their files', async t => {
  const f = fixture(t), executable = workerRuntime(f.state, f.options), destination = path.dirname(executable);
  const manifest = path.join(destination, 'runtime.json');
  const legacy = JSON.parse(fs.readFileSync(manifest));
  delete legacy.version;
  legacy.files = legacy.files.map(({ name, size }) => ({ name, size }));
  legacy.files.push({ name: 'runtime.json', size: 1 });
  const before = JSON.stringify(legacy);fs.writeFileSync(manifest, before);
  await fs.promises.rm(f.source, { recursive: true });
  assert.equal(fs.existsSync(f.source), false);
  assert.equal(workerRuntime(f.state, f.options), executable);
  assert.equal(fs.readFileSync(manifest, 'utf8'), before);
});

test('damaged runtime rebuilds into a validated sibling while preserving the old worker files', async t => {
  const f = fixture(t), old = workerRuntime(f.state, f.options);
  const icu = path.join(path.dirname(old), 'icudtl.dat');
  fs.writeFileSync(icu, 'broken');
  const repaired = workerRuntime(f.state, f.options);
  assert.notEqual(repaired, old);
  assert.equal(fs.readFileSync(icu, 'utf8'), 'broken');
  assert.equal(fs.readFileSync(path.join(path.dirname(repaired), 'icudtl.dat'), 'utf8'), 'icudtl.dat');
  assert.equal(workerRuntime(f.state, f.options), repaired);
  await fs.promises.rm(f.source, { recursive: true });
  assert.equal(fs.existsSync(f.source), false);
  assert.equal(workerRuntime(f.state, f.options), repaired);
});

test('new runtime manifests detect same-size resource changes and preserve volatile logs outside the manifest', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.source, 'native.log'), 'temporary');
  const old = workerRuntime(f.state, f.options);
  fs.writeFileSync(path.join(path.dirname(old), 'icudtl.dat'), 'ICUDTL.DAT');
  const repaired = workerRuntime(f.state, f.options);
  assert.notEqual(repaired, old);
  assert.equal(fs.existsSync(path.join(path.dirname(repaired), 'native.log')), false);
});

test('incomplete or malformed caches never become valid from an empty or unsafe manifest', t => {
  for (const value of [null, {}, { executable:'AgentBridge.exe', files:[] }, { executable:'AgentBridge.exe', files:[{name:'../icudtl.dat',size:0}] }, { version:99, executable:'AgentBridge.exe', files:[] }]) {
    const f=fixture(t), old=workerRuntime(f.state,f.options), file=path.join(path.dirname(old),'runtime.json');
    fs.writeFileSync(file,JSON.stringify(value));
    const repaired=workerRuntime(f.state,f.options);assert.notEqual(repaired,old);
    assert.equal(fs.readFileSync(file,'utf8'),JSON.stringify(value));
  }
});

test('broken source cache cannot be used to rebuild another runtime', t => {
  const f=fixture(t),source=workerRuntime(path.join(f.state,'coordinator'),f.options);
  fs.writeFileSync(path.join(path.dirname(source),'icudtl.dat'),'broken');
  assert.throws(()=>workerRuntime(path.join(f.state,'windows'),{...f.options,executable:source}),{code:'CLAUDE_RUNTIME_INVALID'});
  assert.equal(fs.existsSync(path.join(f.state,'windows')),false);
});

test('publish races never return an incomplete competing runtime', t => {
  const f=fixture(t),rename=fs.renameSync;let raced=false;
  fs.renameSync=(from,to)=>{
    if(!raced&&to.endsWith('electron-fixture-'+process.arch)){
      raced=true;fs.mkdirSync(to);fs.writeFileSync(path.join(to,'runtime.json'),'{}');
      throw Object.assign(Error('competing incomplete publisher'),{code:'EEXIST'});
    }
    return rename(from,to);
  };
  try{const executable=workerRuntime(f.state,f.options);assert(raced);assert(executable.includes('.repair-'));assert.equal(workerRuntime(f.state,f.options),executable);}
  finally{fs.renameSync=rename;}
});

test('default publication recovers after consecutive ENOTEMPTY and EPERM directory locks', t => {
  const f = fixture(t), rename = fs.renameSync;
  let attempts = 0;
  fs.renameSync = (from, to) => {
    if (String(from).endsWith('.tmp') && ++attempts <= 2)
      throw Object.assign(new Error('transient publication lock'), { code: attempts === 1 ? 'ENOTEMPTY' : 'EPERM' });
    return rename(from, to);
  };
  try {
    const executable = workerRuntime(f.state, f.options);
    assert.equal(attempts, 3);
    assert.equal(fs.readFileSync(executable, 'utf8'), 'AgentBridge.exe');
    assert.equal(workerRuntime(f.state, f.options), executable);
    assert(!fs.readdirSync(path.dirname(path.dirname(executable))).some(name => name.endsWith('.tmp')));
  } finally { fs.renameSync = rename; }
});

test('publication EIO is preserved when temporary cleanup also fails with ENOTEMPTY', t => {
  const f = fixture(t), rename = fs.renameSync, remove = fs.rmSync, rmdir = fs.rmdirSync;
  const primary = Object.assign(new Error('original publication failure'), { code: 'EIO' });
  let cleanups = 0, temporary;
  fs.renameSync = (from, to) => {
    if (String(from).endsWith('.tmp')) { temporary = from; throw primary; }
    return rename(from, to);
  };
  const cleanup = original => (file, ...args) => {
    if (String(file).endsWith('.tmp')) {
      cleanups++;
      throw Object.assign(new Error('secondary cleanup failure'), { code: 'ENOTEMPTY' });
    }
    return original(file, ...args);
  };
  fs.rmSync = cleanup(remove); fs.rmdirSync = cleanup(rmdir);
  try {
    assert.throws(() => workerRuntime(f.state, f.options), error => error === primary);
    assert(cleanups > 0);
    assert(fs.existsSync(path.join(temporary, 'runtime.json')));
  } finally { fs.renameSync = rename; fs.rmSync = remove; fs.rmdirSync = rmdir; }
});

test('all supported transient directory errors retry without publishing unvalidated files', t => {
  for (const code of ['EACCES', 'EBUSY', 'EEXIST', 'ENOTEMPTY', 'EPERM']) {
    const f = fixture(t), rename = fs.renameSync;
    let attempts = 0;
    fs.renameSync = (from, to) => {
      if (String(from).endsWith('.tmp')) {
        const manifest = JSON.parse(fs.readFileSync(path.join(from, 'runtime.json')));
        assert.equal(manifest.version, 2);
        assert(manifest.files.every(file => file.sha256?.length === 64));
        if (++attempts === 1) throw Object.assign(new Error('temporary lock'), { code });
      }
      return rename(from, to);
    };
    try { assert(fs.existsSync(workerRuntime(f.state, f.options))); assert.equal(attempts, 2, code); }
    finally { fs.renameSync = rename; }
  }
});

test('a complete concurrent publisher is reused after a lock without deleting preparation evidence', t => {
  const f = fixture(t), rename = fs.renameSync;
  let attempts = 0, temporary, target;
  const unrelated = path.join(f.state, 'runtime', 'unrelated.tmp');
  fs.mkdirSync(unrelated, { recursive: true });
  fs.writeFileSync(path.join(unrelated, 'evidence'), 'keep');
  fs.renameSync = (from, to) => {
    attempts++; temporary = from; target = to;
    fs.cpSync(from, to, { recursive: true });
    throw Object.assign(new Error('concurrent publisher finished'), { code: 'EBUSY' });
  };
  try {
    const executable = workerRuntime(f.state, f.options);
    assert.equal(executable, path.join(target, 'AgentBridge.exe'));
    assert.equal(attempts, 1);
    assert.equal(workerRuntime(f.state, f.options), executable);
    assert(fs.existsSync(path.join(temporary, 'runtime.json')));
    assert.equal(fs.readFileSync(path.join(unrelated, 'evidence'), 'utf8'), 'keep');
  } finally { fs.renameSync = rename; }
});

test('permanent directory locks exhaust the five second budget with the first error and allow a new preparation', t => {
  const f = fixture(t), rename = fs.renameSync;
  const first = Object.assign(new Error('first lock'), { code: 'EACCES' });
  let attempts = 0, temporary;
  fs.renameSync = (from, to) => {
    if (String(from).endsWith('.tmp')) {
      temporary = from;
      if (++attempts === 1) throw first;
      throw Object.assign(new Error('later lock'), { code: 'EPERM' });
    }
    return rename(from, to);
  };
  const started = performance.now();
  try {
    assert.throws(() => workerRuntime(f.state, f.options), error => error === first);
    const elapsed = performance.now() - started;
    assert(elapsed >= 5000 && elapsed < 7000, `bounded lock recovery took ${elapsed}ms`);
    assert(attempts > 2);
  } finally { fs.renameSync = rename; }
  assert(fs.existsSync(path.join(temporary, 'runtime.json')));
  const executable = workerRuntime(f.state, f.options);
  assert(fs.existsSync(executable));
  assert(fs.existsSync(path.join(temporary, 'runtime.json')));
});

test('copy and validation failures preserve their original error and never publish partial resources', t => {
  for (const kind of ['copy', 'validate']) {
    const f = fixture(t), copy = fs.copyFileSync, write = fs.writeFileSync, rename = fs.renameSync;
    const primary = Object.assign(new Error('copy failed'), { code: 'EIO' });
    let publications = 0;
    fs.copyFileSync = (...args) => { if (kind === 'copy') throw primary; return copy(...args); };
    fs.writeFileSync = (file, ...args) => {
      const result = write(file, ...args);
      if (kind === 'validate' && String(file).endsWith('runtime.json'))
        write(path.join(path.dirname(file), 'icudtl.dat'), 'corrupted');
      return result;
    };
    fs.renameSync = (...args) => { publications++; return rename(...args); };
    try {
      assert.throws(() => workerRuntime(f.state, f.options), error => kind === 'copy'
        ? error === primary : error.code === 'CLAUDE_RUNTIME_INVALID');
      assert.equal(publications, 0);
      const leftovers = fs.readdirSync(path.join(f.state, 'runtime'));
      assert.equal(leftovers.length, kind === 'copy' ? 0 : 1);
      if (kind === 'validate') assert(leftovers[0].endsWith('.tmp'));
    } finally { fs.copyFileSync = copy; fs.writeFileSync = write; fs.renameSync = rename; }
  }
});
