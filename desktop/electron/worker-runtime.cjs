const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

// A portable launcher removes its extraction directory when its window closes.
// Detached workers therefore need their own persistent Electron/Node runtime.
function workerRuntime(directory, options = {}) {
  const executable = options.executable || process.execPath;
  const electron = options.electron ?? process.versions.electron;
  if (!electron) return executable;
  const source = path.dirname(executable);
  const destination = path.join(directory, "runtime", `electron-${electron}-${process.arch}`);
  const manifest = path.join(destination, "runtime.json");
  try {
    const saved = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (saved.files.every(file => fs.statSync(path.join(destination, file.name)).size === file.size))
      return path.join(destination, saved.executable);
    throw Object.assign(new Error("已保存的后台运行资源不完整，请保留运行目录后排查。"), { code: "CLAUDE_RUNTIME_INVALID" });
  } catch (error) {
    if (error.code !== "ENOENT" || fs.existsSync(manifest)) throw error;
  }
  const required = [path.basename(executable), "icudtl.dat", "snapshot_blob.bin", "v8_context_snapshot.bin"];
  if (required.some(name => !fs.existsSync(path.join(source, name))))
    throw Object.assign(new Error("后台运行资源已被便携启动器清理，请关闭窗口后重新打开新版程序。"), { code: "CLAUDE_RUNTIME_MISSING" });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = destination + "." + randomUUID() + ".tmp";
  fs.mkdirSync(temporary);
  try {
    const files = [];
    for (const item of fs.readdirSync(source, { withFileTypes: true })) {
      if (!item.isFile() || item.name === "debug.log") continue;
      fs.copyFileSync(path.join(source, item.name), path.join(temporary, item.name));
      files.push({ name: item.name, size: fs.statSync(path.join(temporary, item.name)).size });
    }
    fs.writeFileSync(path.join(temporary, "runtime.json"), JSON.stringify({ executable: path.basename(executable), files }));
    try { fs.renameSync(temporary, destination); }
    catch (error) {
      if (!["EEXIST", "ENOTEMPTY", "EPERM"].includes(error.code) || !fs.existsSync(manifest)) throw error;
      // Another host published the same complete runtime; never replace files
      // which may already be in use by a detached worker.
      fs.rmSync(temporary, { recursive: true, force: true });
    }
    return path.join(destination, path.basename(executable));
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}
module.exports = { workerRuntime };
