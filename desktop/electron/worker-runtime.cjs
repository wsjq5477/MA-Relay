const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");

const resources = ["icudtl.dat", "snapshot_blob.bin", "v8_context_snapshot.bin"];
const failure = (code, message) => Object.assign(new Error(message), { code });
const digest = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const resourceFile = name => name !== "runtime.json" && !/\.(?:log|tmp)$/i.test(name);

function inspectRuntime(directory, executable) {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(directory, "runtime.json"), "utf8"));
    if (!saved || ![undefined, 1, 2].includes(saved.version) || saved.executable !== executable || !Array.isArray(saved.files)) return false;
    const names = new Set();
    for (const file of saved.files) {
      if (!file || typeof file.name !== "string" || file.name !== path.basename(file.name)
        || /[\\/]/.test(file.name) || [".", ".."].includes(file.name) || names.has(file.name)) return false;
      names.add(file.name);
      // alpha.9 copied the Coordinator's manifest, then overwrote it with this
      // manifest. It is metadata, never an executable resource to validate.
      if (file.name === "runtime.json") continue;
      if (!Number.isSafeInteger(file.size) || file.size < 0) return false;
      const target = path.join(directory, file.name), stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.size !== file.size) return false;
      if (saved.version === 2 && (typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256)
        || digest(target) !== file.sha256)) return false;
    }
    return [executable, ...resources].every(name => names.has(name));
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return false;
    throw error;
  }
}

// Never replace a runtime that an existing detached worker may still use.
// Broken directories stay intact; a complete sibling is published atomically.
function workerRuntime(directory, options = {}) {
  const executable = options.executable || process.execPath;
  const electron = options.electron ?? process.versions.electron;
  if (!electron) return executable;
  const source = path.dirname(executable), name = path.basename(executable);
  const root = path.join(directory, "runtime"), prefix = `electron-${electron}-${process.arch}`;
  const destination = path.join(root, prefix);
  const candidates = [destination];
  if (fs.existsSync(root)) for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    if (item.isDirectory() && item.name.startsWith(prefix + ".repair-") && !item.name.endsWith(".tmp"))
      candidates.push(path.join(root, item.name));
  }
  for (const candidate of candidates) {
    if (inspectRuntime(candidate, name)) return path.join(candidate, name);
  }
  if ([name, ...resources].some(file => {
    try { return !fs.lstatSync(path.join(source, file)).isFile(); } catch { return true; }
  })) throw failure("CLAUDE_RUNTIME_MISSING", "后台运行资源不完整，请在设置中停止后台后重新打开完整的程序文件；原请求与历史已保留。");
  if (fs.existsSync(path.join(source, "runtime.json")) && !inspectRuntime(source, name))
    throw failure("CLAUDE_RUNTIME_INVALID", "后台运行资源校验失败，请在设置中停止后台后重新打开完整的程序文件；原请求与历史已保留。");

  fs.mkdirSync(root, { recursive: true });
  let target = fs.existsSync(destination) ? destination + ".repair-" + randomUUID() : destination;
  const temporary = destination + "." + randomUUID() + ".tmp";
  fs.mkdirSync(temporary);
  try {
    const files = [];
    for (const item of fs.readdirSync(source, { withFileTypes: true })) {
      if (!item.isFile() || !resourceFile(item.name)) continue;
      const file = path.join(temporary, item.name);
      fs.copyFileSync(path.join(source, item.name), file);
      files.push({ name: item.name, size: fs.statSync(file).size, sha256: digest(file) });
    }
    fs.writeFileSync(path.join(temporary, "runtime.json"), JSON.stringify({ version: 2, executable: name, files }));
    if (!inspectRuntime(temporary, name)) throw failure("CLAUDE_RUNTIME_INVALID", "新后台运行资源校验失败，原运行目录与请求记录已保留。");
    try { fs.renameSync(temporary, target); }
    catch (error) {
      if (!["EEXIST", "ENOTEMPTY", "EPERM"].includes(error.code)) throw error;
      if (inspectRuntime(target, name)) {
        fs.rmSync(temporary, { recursive: true, force: true });
        return path.join(target, name);
      }
      target = destination + ".repair-" + randomUUID();
      fs.renameSync(temporary, target);
    }
    return path.join(target, name);
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}
module.exports = { workerRuntime };
