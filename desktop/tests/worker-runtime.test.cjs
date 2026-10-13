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
