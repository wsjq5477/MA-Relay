const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { workerRuntime } = require("../electron/worker-runtime.cjs");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-runtime-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "portable-extraction");
  const state = path.join(root, "profile");
  fs.mkdirSync(source);
  for (const name of ["AgentBridge.exe", "icudtl.dat", "snapshot_blob.bin", "v8_context_snapshot.bin", "LICENSE.electron.txt"])
    fs.writeFileSync(path.join(source, name), name);
  return { root, source, state, options: { executable: path.join(source, "AgentBridge.exe"), electron: "fixture" } };
}

test("detached runtime survives portable extraction cleanup and retains license", t => {
  const f = fixture(t);
  const executable = workerRuntime(f.state, f.options);
  assert.notEqual(path.dirname(executable), f.source);
  assert.equal(fs.readFileSync(path.join(path.dirname(executable), "icudtl.dat"), "utf8"), "icudtl.dat");
  assert.ok(fs.existsSync(path.join(path.dirname(executable), "LICENSE.electron.txt")));
  fs.rmSync(f.source, { recursive: true });
  assert.equal(workerRuntime(f.state, f.options), executable);
});

test("missing ICU or V8 resources reject startup before admitting a native task", t => {
  const f = fixture(t);
  fs.rmSync(path.join(f.source, "icudtl.dat"));
  assert.throws(() => workerRuntime(f.state, f.options), { code: "CLAUDE_RUNTIME_MISSING" });
  assert.equal(fs.existsSync(f.state), false);
});

test("ordinary Node keeps using its existing executable", t => {
  const f = fixture(t);
  assert.equal(workerRuntime(f.state, { executable: process.execPath, electron: "" }), process.execPath);
  assert.equal(fs.existsSync(f.state), false);
});

test('Coordinator to Windows runtime copies never track or copy their own manifest', t => {
  const f = fixture(t);
  const coordinator = workerRuntime(path.join(f.state, 'coordinator'), f.options);
  const options = { ...f.options, executable: coordinator };
  const executable = workerRuntime(path.join(f.state, 'windows'), options);
  const manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(executable), 'runtime.json')));
  assert.equal(manifest.files.some(file => file.name === 'runtime.json'), false);
  assert.equal(workerRuntime(path.join(f.state, 'windows'), options), executable);
  fs.rmSync(f.source, { recursive: true });
  assert.equal(workerRuntime(path.join(f.state, 'windows'), options), executable);
});

test('alpha.9 self-referential manifests remain usable without changing their files', t => {
  const f = fixture(t), executable = workerRuntime(f.state, f.options), destination = path.dirname(executable);
  const manifest = path.join(destination, 'runtime.json');
  const legacy = JSON.parse(fs.readFileSync(manifest));
  delete legacy.version;
  legacy.files = legacy.files.map(({ name, size }) => ({ name, size }));
  legacy.files.push({ name: 'runtime.json', size: 1 });
  const before = JSON.stringify(legacy);fs.writeFileSync(manifest, before);
  fs.rmSync(f.source, { recursive: true });
  assert.equal(workerRuntime(f.state, f.options), executable);
  assert.equal(fs.readFileSync(manifest, 'utf8'), before);
});

test('damaged runtime rebuilds into a validated sibling while preserving the old worker files', t => {
  const f = fixture(t), old = workerRuntime(f.state, f.options);
  const icu = path.join(path.dirname(old), 'icudtl.dat');
  fs.writeFileSync(icu, 'broken');
  const repaired = workerRuntime(f.state, f.options);
  assert.notEqual(repaired, old);
  assert.equal(fs.readFileSync(icu, 'utf8'), 'broken');
  assert.equal(fs.readFileSync(path.join(path.dirname(repaired), 'icudtl.dat'), 'utf8'), 'icudtl.dat');
  assert.equal(workerRuntime(f.state, f.options), repaired);
  fs.rmSync(f.source, { recursive: true });
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
