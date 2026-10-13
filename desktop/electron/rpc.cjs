const { spawn, execFile } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { resolve } = require("node:path");

function distributions() {
  if (process.platform !== "win32") return Promise.resolve([]);
  return new Promise((done, reject) =>
    execFile(
      "wsl.exe",
      ["--list", "--quiet"],
      { encoding: "buffer", windowsHide: true, timeout: 10000 },
      (error, out) => {
        if (error)
          return reject(
            Object.assign(
              new Error("未找到可用的 WSL，请先安装 WSL 或选择其他运行环境。"),
              { code: "WSL_UNAVAILABLE" },
            ),
          );
        done(
          out
            .toString("utf16le")
            .replace(/^\uFEFF/, "")
            .split(/[\r\n]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        );
      },
    ),
  );
}
function linuxResourcePath(windowsPath, distribution) {
  const unc = windowsPath.match(/^\\\\wsl(?:\.localhost|\$)\\([^\\]+)\\(.*)$/i);
  if (unc) {
    if (unc[1].toLowerCase() !== distribution.toLowerCase())
      throw new Error(
        "程序位于其他 WSL 发行版，请将程序解压到 Windows 本机目录。",
      );
    return "/" + unc[2].replaceAll("\\", "/");
  }
  const drive = windowsPath.match(/^([A-Za-z]):\\(.*)$/);
  if (!drive)
    throw new Error("无法解析程序资源路径，请将程序解压到 Windows 本机目录。");
  return (
    "/mnt/" + drive[1].toLowerCase() + "/" + drive[2].replaceAll("\\", "/")
  );
}
class HostConnection {
  constructor(hostPath, options = {}) {
    this.hostPath = hostPath;
    this.options = options;
    this.pending = new Map();
    this.lines = "";
    this.child = null;
    this.starting = null;
    this.lastError = "";
  }
  async start() {
    if (this.child) return;
    if (this.starting) return this.starting;
    this.starting = this.launch();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }
  async launch() {
    let command,
      args,
      env = { ...process.env };
    if (process.platform === "win32" && !this.options.native) {
      const names = await distributions();
      const distribution = this.options.distribution || names[0];
      if (!distribution || !names.includes(distribution))
        throw Object.assign(
          new Error("所选 WSL 发行版不存在，请在设置中重新选择。"),
          { code: "WSL_DISTRIBUTION" },
        );
      const path = linuxResourcePath(this.hostPath, distribution);
      command = "wsl.exe";
      args = [
        "--distribution",
        distribution,
        "--exec",
        "/bin/bash",
        this.options.bootstrapPath
          ? linuxResourcePath(this.options.bootstrapPath, distribution)
          : path.slice(0, path.lastIndexOf("/dist/")) + "/bootstrap.sh",
        path,
        ...(this.options.directory ? [this.options.directory] : []),
      ];
    } else {
      command = this.options.runtime || process.execPath;
      args = [
        "--disable-warning=ExperimentalWarning",
        this.hostPath,
        ...(this.options.directory ? [this.options.directory] : []),
        ...(this.options.leaf ? ["--opencode-only"] : []),
      ];
      env.ELECTRON_RUN_AS_NODE = "1";
    }
    const child = spawn(command, args, {
      env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });
    this.child = child;
    this.lines = "";
    child.stdout.on("data", (b) => {
      this.lines += b.toString();
      if (Buffer.byteLength(this.lines) > 20 * 1024 * 1024) {
        this.fail("后台返回的数据过大，请查看原生会话。");
        return;
      }
      let n;
      while ((n = this.lines.indexOf("\n")) >= 0) {
        const raw = this.lines.slice(0, n);
        this.lines = this.lines.slice(n + 1);
        let value;
        try {
          value = JSON.parse(raw);
        } catch {
          this.fail("后台返回无效数据。");
          return;
        }
        if(value.bridgeTool){
          const reply=async()=>{
            try {const result=await this.collaboration?.(value.scope,value.name,value.args,value.callId);if(!this.collaboration)throw new Error('协作通道未接入');child.stdin.write(JSON.stringify({bridgeReply:value.id,result})+'\n');}
            catch(error){child.stdin.write(JSON.stringify({bridgeReply:value.id,error:{code:error.code||'COLLABORATION_ERROR',message:error.message}})+'\n');}
          };
          void reply().catch(()=>{});continue;
        }
        const job = this.pending.get(value.id);
        if (job) {
          this.pending.delete(value.id);
          clearTimeout(job.timer);
          if (value.error)
            job.reject(
              Object.assign(new Error(value.error.message), {
                code: value.error.code,
              }),
            );
          else job.resolve(value.result);
        }
      }
    });
    child.stderr.on("data", (b) => {
      this.lastError = (this.lastError + b.toString()).slice(-4000);
    });
    child.once("error", () =>
      this.fail("无法启动本机后台通道，请检查运行环境。"),
    );
    child.once("exit", () => {
      if (this.child === child) {
        this.child = null;
        this.rejectAll(
          this.lastError.includes("AGENTBRIDGE_NODE_MISSING")
            ? "WSL 中需要 Node 22.13 或更新版本；安装后重新连接。"
            : "后台通道已断开；请求结果可能未知，请查询原请求。",
        );
      }
    });
  }
  rejectAll(message) {
    for (const job of this.pending.values()) {
      clearTimeout(job.timer);
      job.reject(
        Object.assign(new Error(message), { code: "DESKTOP_TRANSPORT" }),
      );
    }
    this.pending.clear();
  }
  fail(message) {
    this.rejectAll(message);
    const child = this.child;
    this.child = null;
    child?.kill();
  }
  async call(method, params = {}) {
    await this.start();
    if (!this.child) throw new Error("后台通道不可用");
    const id = randomUUID();
    const data = JSON.stringify({ id, method, params });
    if (Buffer.byteLength(data) > 1048576) throw new Error("请求超过大小限制");
    return new Promise((resolveResult, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          Object.assign(
            new Error(
              "后台响应超时，写入结果可能未知。请查询原请求，不要重复提交。",
            ),
            { code: "DESKTOP_TIMEOUT" },
          ),
        );
      }, 65000);
      this.pending.set(id, { resolve: resolveResult, reject, timer });
      this.child.stdin.write(data + "\n", (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(
            Object.assign(new Error("后台通道断开，请查询原请求。"), {
              code: "DESKTOP_TRANSPORT",
            }),
          );
        }
      });
    });
  }
  close() {
    this.rejectAll("桌面通道已关闭，后台任务继续运行。");
    this.child?.stdin.end();
    this.child = null;
  }
  setCollaboration(handler){this.collaboration=handler;}
}
module.exports = {
  HostConnection,
  distributions,
  linuxResourcePath,
};
