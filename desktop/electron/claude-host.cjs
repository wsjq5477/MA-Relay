/* Windows-native Claude Code host. The detached worker owns the CLI; closing
 * the desktop only stops observation. Credentials stay with Claude Code. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn, execFile } = require("node:child_process");
const { randomUUID, createHash } = require("node:crypto");
// The copied standalone worker does not load the host's runtime preparation.
const workerRuntime = process.argv[2] === "--worker"
  ? null : require("./worker-runtime.cjs").workerRuntime;
const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);
const now = () => new Date().toISOString();
const fail = (code, message) => Object.assign(new Error(message), { code });
const clone = (value) => JSON.parse(JSON.stringify(value));
const hash = (value) => createHash("sha256").update(value).digest("hex");
function modelSelection(value) {
  if (value === undefined) return undefined;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.providerID !== "string" ||
    !value.providerID.trim() ||
    value.providerID.length > 100 ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    value.id.length > 200 ||
    /[\x00-\x1f]/.test(value.providerID + value.id)
  )
    throw fail("INVALID_INPUT", "模型覆盖需要有效的提供方和模型 ID");
  return { providerID: value.providerID.trim(), id: value.id.trim() };
}
function sanitize(value) {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitize(item)]),
    );
  return value;
}
function redact(value) {
  let text = String(value ?? "").replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  for (const [key, secret] of Object.entries(process.env))
    if (/(?:TOKEN|SECRET|PASSWORD|API_KEY)$/i.test(key) && secret.length > 6)
      text = text.split(secret).join("[已隐藏]");
  return text
    .replace(/\bsk-(?:ant-)?[A-Za-z0-9_-]{12,}/g, "[已隐藏]")
    .slice(0, 1000000);
}
function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + "." + process.pid + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  replaceFile(temp, file);
}
function replaceFile(source, target) {
  const pause = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(source, target);
      return;
    } catch (error) {
      if (attempt >= 5 || !["EPERM", "EACCES", "EBUSY"].includes(error.code))
        throw error;
      // Windows file readers/virus scanners can temporarily prevent replacing
      // an existing file. A bounded retry preserves the atomic-write contract.
      Atomics.wait(pause, 0, 0, 20 * (attempt + 1));
    }
  }
}
function workerDiagnostic(directory, context, error) {
  try {
    fs.appendFileSync(
      path.join(directory, "worker-diagnostics.jsonl"),
      JSON.stringify({
        time: now(),
        context,
        error: {
          code: error?.code || error?.name || "CLAUDE_WORKER",
          message: redact(error?.message || String(error)),
          stack: redact(error?.stack || "").slice(0, 12000),
        },
      }) + "\n",
      { mode: 0o600 },
    );
  } catch {
    /* Failure to write diagnostics must not crash the native observer. */
  }
}
function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw fail("CLAUDE_STATE", "Claude 本地记录无法读取，请保留数据目录后排查");
  }
}
function rows(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    return text
      .slice(0, text.lastIndexOf("\n") + 1)
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
function canonical(file) {
  const resolved = fs.realpathSync(file);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
function locationKey(file) {
  const resolved = path.resolve(file);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
function cliCommand(executable, args, environment = process.env) {
  if (/\.(?:cmd|bat)$/i.test(executable)) {
    // npm's Windows shim is not a native executable. Invoke the installed JS
    // directly, keeping user messages and paths out of cmd.exe interpretation.
    const binary = path.resolve(
      path.dirname(executable),
      "node_modules/@anthropic-ai/claude-code/bin/claude.exe",
    );
    if (fs.existsSync(binary)) {
      const env = { ...environment };
      delete env.ELECTRON_RUN_AS_NODE;
      return { executable: binary, args, env };
    }
    const script = path.resolve(
      path.dirname(executable),
      "node_modules/@anthropic-ai/claude-code/cli.js",
    );
    if (!fs.existsSync(script))
      throw fail(
        "CLAUDE_LAUNCHER",
        "此 Claude 命令脚本不是支持的 npm 安装，请使用原生 claude.exe 或标准 npm 安装",
      );
    const localNode = path.resolve(path.dirname(executable), "node.exe");
    return {
      executable: fs.existsSync(localNode) ? localNode : process.execPath,
      args: [script, ...args],
      env: { ...environment, ELECTRON_RUN_AS_NODE: "1" },
    };
  }
  const env = { ...environment };
  delete env.ELECTRON_RUN_AS_NODE;
  return { executable, args, env };
}
function launchError(error, executable) {
  const code = String(error?.code || "CLAUDE_LAUNCHER");
  return {
    code,
    executable,
    message: code === "ENOENT"
      ? "Claude 程序或探测目录不存在，请检查安装后重新扫描。"
      : code === "EACCES" || code === "EPERM"
        ? "Windows 拒绝启动 Claude 程序，请检查安装文件的访问权限和系统拦截记录后重新扫描。"
        : `Claude 程序无法启动（${code}）。请在 Windows 终端检查 claude --version，修复安装后重新扫描。`,
    detail: redact(error?.message || "Claude 安装无法启动"),
  };
}
function probe(executable, args, environment = process.env, cwd = os.homedir()) {
  return new Promise((done) => {
    let command;
    const failed = error => done({ code: error?.code || -1, stdout: "", stderr: "", error: launchError(error, command?.executable || executable) });
    try {
      command = cliCommand(executable, args, environment);
      // Metadata probes must not inherit a temporary launcher directory. Both
      // synchronous Windows spawn failures and callback failures are tool
      // health results, not failures of the machine's snapshot transport.
      execFile(
      command.executable,
      command.args,
      { env: command.env, cwd, windowsHide: true, timeout: 10000, maxBuffer: 65536 },
      (error, stdout, stderr) =>
        done({
          code: error ? error.code || -1 : 0,
          stdout: redact(stdout),
          stderr: redact(stderr),
          ...(error ? { error: launchError(error, command.executable) } : {}),
        }),
      );
    } catch (error) { failed(error); }
  });
}
async function authentication(executable, environment, cwd) {
  const result = await probe(executable, ["auth", "status"], environment, cwd);
  try {
    const info = JSON.parse(result.stdout);
    if (info.loggedIn === true || info.authenticated === true)
      return "accepted";
    if (info.loggedIn === false || info.authenticated === false)
      return "credential_missing";
  } catch {
    /* A version/provider may not expose the supported status contract. */
  }
  return "not_checked";
}
function windowsCandidates(home, environment) {
  const names = ["claude.exe", "claude.cmd"];
  const locations = (environment.Path || environment.PATH || "")
    .split(process.platform === "win32" ? ";" : path.delimiter)
    .filter(Boolean);
  locations.push(
    path.join(home, ".local/bin"),
    path.join(home, ".claude/local"),
    path.join(environment.APPDATA || path.join(home, "AppData/Roaming"), "npm"),
    path.join(
      environment.LOCALAPPDATA || path.join(home, "AppData/Local"),
      "Programs/Claude",
    ),
    path.join(home, "scoop/shims"),
  );
  return locations.flatMap((folder) =>
    names.map((name) => path.resolve(folder, name)),
  );
}

class ClaudeHost {
  constructor(options = {}) {
    this.directory = path.resolve(
      options.directory ||
        path.join(
          process.env.LOCALAPPDATA || os.homedir(),
          "AgentBridge/claude",
        ),
    );
    this.home = options.home || os.homedir();
    this.environment = options.environment || process.env;
    this.candidates = options.candidates; // Trusted test/runtime injection; never a renderer parameter.
    this.workerRuntime = options.workerRuntime || workerRuntime;
    this.file = path.join(this.directory, "claude-state.json");
    this.closed = false;
    this.chain = Promise.resolve();
    this.state = readJSON(this.file, {
      version: 1,
      revision: 0,
      connections: [],
      instances: [],
      tasks: [],
      conversations: [],
      requests: {},
      operations: {},
    });
    this.state.requests = Object.assign(
      Object.create(null),
      this.state.requests,
    );
    this.state.operations = Object.assign(
      Object.create(null),
      this.state.operations,
    );
    this.sync();
    this.timer = setInterval(() => {
      this.chain = this.chain
        .then(() => {
          if (!this.closed) this.sync();
        })
        .catch(() => {});
    }, 250);
    this.timer.unref();
  }
  save() {
    writeJSON(this.file, this.state);
  }
  call(method, params = {}) {
    const run = this.chain.then(() => this.handle(method, params));
    this.chain = run.catch(() => {});
    return run;
  }
  close() {
    this.closed = true;
    clearInterval(this.timer);
  }
  job(task) {
    return path.join(this.directory, "runs", task.taskId);
  }
  task(id) {
    const task = this.state.tasks.find((t) => t.taskId === id);
    if (!task) throw fail("TASK_NOT_FOUND", "Claude 任务不存在");
    return task;
  }
  agent(id) {
    const agent = this.state.instances.find((a) => a.agentId === id);
    if (!agent) throw fail("AGENT_NOT_FOUND", "Claude 实例不存在");
    return agent;
  }
  publicTask(task, detailed = true) {
    const result = clone(task);
    delete result.worker;
    delete result.pending;
    if (!detailed) delete result.events;
    return result;
  }
  publicConversation(conversation) {
    const result = clone(conversation);
    delete result.sessionId;
    const first = this.state.tasks.find(t => t.conversationId === conversation.conversationId);
    result.kind = first?.verification ? "verification" : "task";
    result.canContinue = !!conversation.sessionId;
    if (!result.canContinue)
      result.continuationReason = "此记录尚未建立原生会话。启动失败后请新建会话；连接验证可重新验证。";
    return result;
  }
  event(task, kind, values = {}) {
    task.updatedAt = now();
    task.lastSeq++;
    task.events.push({
      seq: task.lastSeq,
      timestamp: task.updatedAt,
      event: { kind, ...values },
    });
  }
  sync() {
    let changed = false;
    for (const task of this.state.tasks) {
      if (!task.worker || TERMINAL.has(task.status)) continue;
      const frames = rows(path.join(this.job(task), "events.jsonl"));
      for (const frame of frames.slice(task.worker.offset)) {
        this.apply(task, frame);
        task.worker.offset++;
        changed = true;
      }
      const completion = readJSON(
        path.join(this.job(task), "completion.json"),
        null,
      );
      if (!TERMINAL.has(task.status) && completion?.nativeExited === true) {
        this.apply(task, {
          time: completion.time,
          kind: "finished",
          data: completion,
        });
        changed = true;
      }
      if (!TERMINAL.has(task.status)) {
        const beat = readJSON(
          path.join(this.job(task), "heartbeat.json"),
          null,
        );
        const fresh = beat && Date.now() - Date.parse(beat.time) < 10000;
        if (
          !fresh &&
          Date.now() - Date.parse(task.createdAt) > 15000 &&
          task.status !== "unknown"
        ) {
          task.status = "unknown";
          task.uncertaintyReason =
            "Claude 任务观察进程没有更新；结果未确认，项目仍保留占用，请核对任务";
          task.lastSummary = task.uncertaintyReason;
          this.event(task, "unknown", { reason: task.uncertaintyReason });
          changed = true;
        } else if (fresh && task.status === "unknown") {
          task.status = "running";
          delete task.uncertaintyReason;
          this.event(task, "reconciled", {
            reason: "已重新接回 Claude 原执行进程",
          });
          changed = true;
        }
      }
    }
    if (changed) this.save();
  }
  apply(task, frame) {
    const data = frame.data || {};
    if (frame.kind === "started") {
      task.status = "running";
      task.lastSummary = "Claude Code 正在执行";
      task.worker.pid = data.pid;
      this.event(task, "started");
    } else if (frame.kind === "native") {
      task.native = {
        sessionId: data.sessionId,
        messageId: data.messageId || "",
      };
      const conversation = this.state.conversations.find(
        (c) => c.conversationId === task.conversationId,
      );
      if (conversation) conversation.sessionId = data.sessionId;
      this.event(task, "native", task.native);
    } else if (frame.kind === "output") {
      task.lastSummary = data.text || task.lastSummary;
      this.event(task, "output", { text: data.text });
    } else if (frame.kind === "progress") {
      task.lastSummary = data.text || task.lastSummary;
      this.event(task, "progress", { text: data.text });
    } else if (frame.kind === "permission") {
      task.pending.push(data);
      task.waiting = {
        kind: "permission",
        summary: data.description || "Claude 需要批准工具操作",
        requestIds: task.pending.map((p) => p.id),
      };
      task.lastSummary = task.waiting.summary;
      this.event(task, "waiting", { text: task.lastSummary });
    } else if (frame.kind === "permission_cancel") {
      task.pending = task.pending.filter((p) => p.id !== data.id);
      if (!task.pending.length) delete task.waiting;
    } else if (frame.kind === "operation") {
      const operation = this.state.operations[data.operationId];
      if (operation) {
        operation.state = data.state;
        operation.data = {
          message: data.message || "Claude 已收到操作",
          nativeInputWritten: data.state === "confirmed",
        };
      }
      if (data.requestId && data.state === "confirmed") {
        task.pending = task.pending.filter((p) => p.id !== data.requestId);
        if (!task.pending.length) delete task.waiting;
      }
    } else if (frame.kind === "finished") {
      task.status = data.status;
      task.pending = [];
      delete task.waiting;
      delete task.uncertaintyReason;
      task.finishedAt = frame.time;
      task.lastSummary = data.message;
      if (data.status === "succeeded") {
        task.result = { message: data.message };
        this.event(task, "completed", { text: data.message });
      } else if (data.status === "cancelled")
        this.event(task, "cancelled", { reason: data.message });
      else {
        task.error = {
          code: data.code || "CLAUDE_FAILED",
          message: data.message,
        };
        this.event(task, "failed", { error: task.error });
      }
      for (const operation of Object.values(this.state.operations))
        if (
          operation.taskId === task.taskId &&
          operation.op === "cancel" &&
          operation.state === "unknown"
        ) {
          operation.state = "confirmed";
          operation.data = {
            status: task.status,
            nativeExited: true,
            message: "已确认 Claude 原执行进程结束",
          };
        }
      if (task.verification) {
        const agent = this.agent(task.targetAgent);
        const marker = task.message.match(/AB_VERIFY_[a-f0-9]+/)?.[0];
        agent.verification = {
          taskId: task.taskId,
          time: now(),
          status:
            data.status === "succeeded" &&
            data.message.trim() === marker &&
            data.toolUses === 0
              ? "passed"
              : "failed",
          stale: false,
          tools: data.toolUses,
        };
      }
    }
    const conversation = this.state.conversations.find(
      (c) => c.conversationId === task.conversationId,
    );
    if (conversation) conversation.updatedAt = task.updatedAt;
  }
  async discover() {
    const seen = new Set(),
      items = [];
    for (const candidate of this.candidates ||
      windowsCandidates(this.home, this.environment)) {
      let executable;
      try {
        if (!fs.statSync(candidate).isFile()) continue;
        executable = fs.realpathSync(candidate);
      } catch {
        continue;
      }
      let launch;
      try {
        launch = cliCommand(executable, ["--version"], this.environment);
        if (/claude\.exe$/i.test(launch.executable))
          executable = fs.realpathSync(launch.executable);
      } catch {
        continue;
      }
      const key =
        process.platform === "win32" ? executable.toLowerCase() : executable;
      if (seen.has(key)) continue;
      seen.add(key);
      const result = await probe(executable, ["--version"], this.environment, this.home);
      const version = result.stdout.match(
        /\b(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)/,
      )?.[1];
      if (result.code === 0 && version) {
        const auth = await authentication(executable, this.environment, this.home);
        items.push({
          executable,
          version,
          name: "Claude Code",
          adapter: "claude",
          tool: "claude",
          healthy: auth === "accepted",
          authentication: auth,
          ...(auth === "accepted"
            ? {}
            : {
                error: {
                  code:
                    auth === "credential_missing"
                      ? "CLAUDE_AUTH_MISSING"
                      : "CLAUDE_AUTH_UNCHECKED",
                  message:
                    auth === "credential_missing"
                      ? "Claude 尚未登录或未检测到可用认证，请在 Windows 终端检查 claude 登录及配置"
                      : "已检测到 Claude 安装，但当前版本未返回可核验的认证状态",
                },
              }),
        });
      } else {
        items.push({ executable, name: "Claude Code", adapter: "claude", tool: "claude", healthy: false, authentication: "not_checked",
          error: result.error || { code: "CLAUDE_VERSION", message: "Claude 程序未返回可识别的版本，请检查安装后重新扫描。" } });
      }
    }
    return items;
  }
  async check(agent) {
    const connection = this.state.connections.find(
      (c) => c.connectionId === agent.connectionId,
    );
    const version = await probe(
      connection.executable,
      ["--version"],
      this.environment,
      this.home,
    );
    const report = {
      time: now(),
      installation: version.code === 0 ? "available" : "unavailable",
      version: version.stdout.match(/\b\d+\.\d+\.\d+(?:[-+][\w.-]+)?/)?.[0],
      connection: version.code === 0 ? "connected" : "failed",
      authentication: "not_checked",
      nativeAgentConfiguration: "available",
      modelConfiguration: agent.model ? "selected" : "inherited",
      selectedModel: agent.model ? clone(agent.model) : null,
      modelResponse: "not_checked",
      ...(version.error ? { error: version.error, message: version.error.message } : {}),
    };
    try {
      report.workspace = fs.statSync(agent.workspace).isDirectory()
        ? "available"
        : "unavailable";
    } catch {
      report.workspace = "unavailable";
    }
    if (version.code === 0) {
      report.authentication = await authentication(
        connection.executable,
        this.environment,
        this.home,
      );
    }
    if (report.authentication === "credential_missing")
      report.message =
        "Claude 尚未登录或未检测到可用认证；请在 Windows 终端检查 claude 登录及配置";
    if (version.code === 0 && report.authentication === "not_checked")
      report.message =
        "Claude 已安装，当前版本未返回认证状态；发送任务后才能确认模型响应";
    connection.version = report.version || connection.version;
    connection.check = { ...report };
    agent.check = report;
    this.save();
    return report;
  }
  views() {
    const items = this.state.instances.map((agent) => {
      const active = this.state.tasks.find(
        (task) =>
          task.targetAgent === agent.agentId && !TERMINAL.has(task.status),
      );
      const check = agent.check || {};
      const healthy =
        check.installation === "available" &&
        check.workspace === "available" &&
        check.authentication === "accepted";
      const connection = this.state.connections.find(
        (c) => c.connectionId === agent.connectionId,
      );
      return {
        ...clone(agent),
        adapter: "claude",
        tool: "claude",
        executable: connection.executable,
        online: check.installation === "available",
        healthy,
        busy: !!active,
        available: !!agent.enabled && healthy && !active,
        default: this.state.defaultAgent === agent.agentId,
        nativeAgent: "claude",
        selectedModel: agent.model ? clone(agent.model) : null,
        ...(check.installation === "unavailable" ? {
          startupError: check.error || { code: "CLAUDE_LAUNCHER", message: check.message || "Claude 程序无法启动，请检查安装后重新扫描。" },
        } : {}),
        capabilities: {
          verification: true,
          permissions: true,
          forms: false,
          cancellation: true,
          resume: true,
        },
        ...(active
          ? {
              currentTask: {
                taskId: active.taskId,
                status: active.status,
                summary: active.lastSummary,
              },
            }
          : {}),
      };
    });
    return {
      items,
      revision: this.state.revision,
      connected: items.some((a) => a.online),
      connectionState: items.some((a) => a.online) ? "online" : "stopped",
      defaultAgent: this.state.defaultAgent,
    };
  }
  async handle(method, params) {
    if (this.closed) throw fail("CLAUDE_HOST_CLOSED", "Claude 观察连接已关闭");
    this.sync();
    if (method === "environment")
      return {
        platform: process.platform,
        home: this.home,
        directory: this.directory,
        cwd: process.cwd(),
        node: process.version,
        desktopHostVersion: 1,
        adapter: "claude",
      };
    if (method === "discover") return { items: await this.discover() };
    if (method === "setInstanceModel") {
      if (params.expectedRevision !== this.state.revision)
        throw fail("REVISION_CONFLICT", "Claude 实例配置已变化，请刷新后重试");
      const agent = this.agent(params.agentId);
      if (
        this.state.tasks.some(
          (task) =>
            task.targetAgent === agent.agentId && !TERMINAL.has(task.status),
        )
      )
        throw fail("AGENT_BUSY", "请先结束当前 Claude 任务，再更改实例模型");
      if (params.model === null) delete agent.model;
      else {
        const selected = modelSelection(params.model);
        if (!selected)
          throw fail("INVALID_INPUT", "请提供模型覆盖，或选择恢复继承");
        agent.model = selected;
      }
      if (agent.verification) agent.verification.stale = true;
      this.state.revision++;
      await this.check(agent);
      this.save();
      return {
        agentId: agent.agentId,
        instanceId: agent.instanceId,
        revision: this.state.revision,
        model: agent.model ? clone(agent.model) : null,
        check: clone(agent.check),
      };
    }
    if (method === "connect") {
      const model = modelSelection(params.model);
      if (
        typeof params.workspace !== "string" ||
        !params.workspace.trim() ||
        typeof params.executable !== "string"
      )
        throw fail("INVALID_INPUT", "请选择 Windows 项目目录与 Claude 安装");
      let workspace;
      try {
        if (!fs.statSync(params.workspace).isDirectory()) throw new Error();
        workspace = fs.realpathSync(params.workspace);
      } catch {
        throw fail("INVALID_INPUT", "Windows 项目目录不存在");
      }
      let selected;
      try {
        selected = cliCommand(
          params.executable,
          ["--version"],
          this.environment,
        ).executable;
        selected = canonical(selected);
      } catch {
        throw fail("DISCOVERY_CHANGED", "Claude 安装已不可用，请重新扫描");
      }
      const detected = (await this.discover()).find(
        (a) =>
          canonical(a.executable) === selected ||
          canonical(a.executable) === canonical(params.executable),
      );
      if (!detected)
        throw fail("DISCOVERY_CHANGED", "Claude 安装已不可用，请重新扫描");
      const duplicate = this.state.instances.find(
        (a) => a.enabled && locationKey(a.workspace) === locationKey(workspace),
      );
      if (duplicate) {
        if (
          model &&
          JSON.stringify(model) !== JSON.stringify(duplicate.model)
        ) {
          if (
            this.state.tasks.some(
              (task) =>
                task.targetAgent === duplicate.agentId &&
                !TERMINAL.has(task.status),
            )
          )
            throw fail(
              "AGENT_BUSY",
              "请先结束当前 Claude 任务，再更改实例模型",
            );
          duplicate.model = model;
          if (duplicate.verification) duplicate.verification.stale = true;
          this.state.revision++;
          this.save();
        }
        return {
          agentId: duplicate.agentId,
          instanceId: duplicate.instanceId,
          connectionId: duplicate.connectionId,
          check: await this.check(duplicate),
          reused: true,
        };
      }
      let connection = this.state.connections.find(
        (c) => canonical(c.executable) === canonical(detected.executable),
      );
      if (!connection) {
        connection = {
          connectionId:
            "claude-tool-" + hash(canonical(detected.executable)).slice(0, 12),
          adapter: "claude",
          tool: "claude",
          name: "Claude Code",
          executable: detected.executable,
          version: detected.version,
        };
        this.state.connections.push(connection);
      }
      const agentId = "claude-" + randomUUID();
      const agent = {
        agentId,
        instanceId: agentId,
        connectionId: connection.connectionId,
        name: redact(
          params.name || path.basename(workspace) || "Claude Code",
        ).slice(0, 100),
        workspace,
        enabled: true,
        nativeAgent: "claude",
        ...(model ? { model } : {}),
      };
      this.state.instances.push(agent);
      this.state.defaultAgent ||= agentId;
      this.state.revision++;
      this.save();
      return {
        agentId,
        instanceId: agentId,
        connectionId: connection.connectionId,
        check: await this.check(agent),
      };
    }
    if (method === "snapshot") {
      for (const agent of this.state.instances)
        if (!agent.check || Date.now() - Date.parse(agent.check.time) > 30000)
          await this.check(agent);
      const agents = this.views();
      return {
        configured: this.state.instances.length > 0,
        directory: this.directory,
        environment: {
          home: this.home,
          cwd: process.cwd(),
          node: process.version,
          platform: process.platform,
        },
        status: {
          connected: agents.connected,
          connectionState: agents.connectionState,
        },
        agents,
        connections: clone(this.state.connections),
        instances: agents.items,
        tasks: this.state.tasks.map((t) => this.publicTask(t, false)),
        conversations: this.state.conversations.map(c => this.publicConversation(c)),
      };
    }
    if (method !== "ipc")
      throw fail("DESKTOP_METHOD", "不支持的 Claude 桌面操作");
    return this.ipc(params);
  }
  async ipc(params) {
    const op = params.op;
    if (["status", "start"].includes(op))
      return {
        connected: this.views().connected,
        connectionState: this.views().connectionState,
        directory: this.directory,
        revision: this.state.revision,
      };
    if (op === "agents") return this.views();
    if (op === "default" || op === "save") {
      if (params.expectedRevision !== this.state.revision)
        throw fail("REVISION_CONFLICT", "Claude 配置已变化，请刷新后重试");
      const agent = this.agent(
        op === "default" ? params.agentId : params.agent?.agentId,
      );
      if (op === "default") this.state.defaultAgent = agent.agentId;
      else {
        if (params.agent.name !== undefined) {
          if (
            typeof params.agent.name !== "string" ||
            !params.agent.name.trim()
          )
            throw fail("INVALID_INPUT", "实例名称不能为空");
          agent.name = redact(params.agent.name).slice(0, 100);
        }
        if (params.agent.enabled !== undefined) {
          if (
            this.state.tasks.some(
              (t) => t.targetAgent === agent.agentId && !TERMINAL.has(t.status),
            )
          )
            throw fail("AGENT_BUSY", "当前实例有尚未结束的任务");
          agent.enabled = !!params.agent.enabled;
        }
      }
      this.state.revision++;
      this.save();
      return this.views();
    }
    if (op === "check") return this.check(this.agent(params.agentId));
    if (["submit", "continue", "verify"].includes(op))
      return this.submit(params);
    if (op === "tasks")
      return { items: this.state.tasks.map((t) => this.publicTask(t, false)) };
    if (op === "request") {
      const receipt = this.state.requests[params.requestId];
      if (!receipt)
        throw fail(
          "REQUEST_NOT_FOUND",
          "尚未找到此 Claude 请求，请保留原请求 ID",
        );
      return this.publicTask(this.task(receipt.taskId));
    }
    if (op === "conversations")
      return {
        items: this.state.conversations.map(c => this.publicConversation(c)),
      };
    if (op === "conversation") {
      const conversation = this.state.conversations.find(
        (c) => c.conversationId === params.conversationId,
      );
      if (!conversation)
        throw fail("CONVERSATION_NOT_FOUND", "Claude 会话不存在");
      const result = this.publicConversation(conversation);
      return {
        ...result,
        items: this.state.tasks
          .filter((t) => t.conversationId === conversation.conversationId)
          .map((t) => this.publicTask(t)),
      };
    }
    const task = this.task(params.taskId);
    if (op === "task") return this.publicTask(task);
    if (op === "pending")
      return {
        permissions: task.pending.map((p) => ({
          id: p.id,
          action: p.toolName,
          resources: p.resources,
        })),
        forms: [],
      };
    if (op === "operation") {
      const receipt = this.state.operations[params.operationId];
      if (!receipt || receipt.taskId !== task.taskId)
        throw fail(
          "OPERATION_NOT_FOUND",
          "尚未找到此 Claude 操作，请保留原操作 ID",
        );
      return clone(receipt);
    }
    if (op === "reconcile") {
      const reason = TERMINAL.has(task.status)
        ? "已读取 Claude 原进程结束记录"
        : task.status === "unknown"
          ? "没有收到原进程结束记录，保留未知结果与项目占用"
          : "已重新读取 Claude 原执行事件";
      task.reconciliation = { time: now(), state: task.status, reason };
      this.save();
      return {
        operationId: params.operationId || randomUUID(),
        state: task.status === "unknown" ? "unknown" : "confirmed",
        data: { status: task.status, message: reason },
      };
    }
    if (op === "reply") return this.operation(task, params.reply || {});
    if (op === "cancel")
      return this.operation(task, {
        operationId: params.operationId,
        action: "cancel",
        executionId: task.executionId,
      });
    throw fail("DESKTOP_METHOD", "不支持的 Claude 操作");
  }
  async submit(params) {
    if (
      typeof params.requestId !== "string" ||
      !params.requestId ||
      params.requestId.length > 128 ||
      typeof params.message !== "string" ||
      !params.message.trim() ||
      params.message.length > 100000
    )
      throw fail("INVALID_INPUT", "提交需要请求 ID 和有效需求文本");
    const conversation =
      params.op === "continue"
        ? this.state.conversations.find(
            (c) => c.conversationId === params.conversationId,
          )
        : undefined;
    if (params.op === "continue" && !conversation)
      throw fail("CONVERSATION_NOT_FOUND", "Claude 会话不存在");
    const agent = this.agent(
      conversation?.targetAgent || params.agentId || this.state.defaultAgent,
    );
    const model =
      conversation && Object.hasOwn(conversation, "model")
        ? conversation.model
        : agent.model || null;
    const fingerprint = hash(
      JSON.stringify({
        op: params.op,
        agent: agent.agentId,
        conversationId: conversation?.conversationId,
        message: params.message,
      }),
    );
    const previous = this.state.requests[params.requestId];
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw fail("REQUEST_CONFLICT", "相同请求 ID 已用于另一条需求");
      return this.publicTask(this.task(previous.taskId));
    }
    if (!agent.enabled) throw fail("AGENT_UNAVAILABLE", "Claude 实例已停用");
    if (
      this.state.tasks.some(
        (t) => t.targetAgent === agent.agentId && !TERMINAL.has(t.status),
      )
    )
      throw fail("AGENT_BUSY", "Claude 实例有尚未结束的任务");
    if (
      this.state.tasks.some(
        (t) =>
          !TERMINAL.has(t.status) &&
          locationKey(this.agent(t.targetAgent).workspace) ===
            locationKey(agent.workspace),
      )
    )
      throw fail("PROJECT_BUSY", "此项目正在由另一个 Claude 实例执行");
    if (conversation && !conversation.sessionId)
      throw fail(
        "CONVERSATION_UNBOUND",
        "此前任务尚未建立 Claude 原生会话，无法继续上下文",
      );
    const check = await this.check(agent);
    if (
      check.installation !== "available" ||
      check.workspace !== "available" ||
      check.authentication === "credential_missing"
    )
      throw fail(
        "AGENT_UNAVAILABLE",
        check.message || "Claude 安装或项目不可用",
      );
    if (
      params.op === "verify" &&
      !/^只回复标记 AB_VERIFY_[a-f0-9]+，不要执行其他动作。$/.test(
        params.message,
      )
    )
      throw fail("INVALID_VERIFY", "验证必须使用随机标记");
    const workerExecutable = this.workerRuntime(this.directory);
    const task = {
      taskId: "claude-task-" + randomUUID(),
      executionId: randomUUID(),
      conversationId:
        conversation?.conversationId || "claude-conversation-" + randomUUID(),
      targetAgent: agent.agentId,
      requestId: params.requestId,
      message: redact(params.message),
      status: "accepted",
      createdAt: now(),
      updatedAt: now(),
      turn: (conversation?.turns || 0) + 1,
      lastSummary: "已接受，正在启动 Claude Code",
      lastSeq: 0,
      events: [],
      pending: [],
      worker: { offset: 0 },
      model: model ? clone(model) : null,
      ...(params.op === "verify" ? { verification: true } : {}),
    };
    const job = this.job(task);
    const connection = this.state.connections.find(
      (c) => c.connectionId === agent.connectionId,
    );
    fs.mkdirSync(job, { recursive: true });
    writeJSON(path.join(job, "job.json"), {
      executable: connection.executable,
      workspace: agent.workspace,
      message: params.message,
      sessionId: conversation?.sessionId,
      newSessionId: randomUUID(),
      verification: !!task.verification,
      model: model?.id,
      mcp: params.mcp,
    });
    this.state.tasks.push(task);
    this.state.requests[params.requestId] = {
      fingerprint,
      taskId: task.taskId,
    };
    if (conversation) {
      conversation.turns++;
      conversation.lastTaskId = task.taskId;
      conversation.updatedAt = now();
    } else
      this.state.conversations.push({
        conversationId: task.conversationId,
        targetAgent: agent.agentId,
        title: redact(params.message).slice(0, 100),
        turns: 1,
        lastTaskId: task.taskId,
        updatedAt: now(),
        model: model ? clone(model) : null,
      });
    this.event(task, "accepted");
    this.save(); // A receipt must exist before any native process is started.
    try {
      const workerFile = path.join(this.directory, "runtime/claude-worker.cjs");
      fs.mkdirSync(path.dirname(workerFile), { recursive: true });
      const temporaryWorker = workerFile + "." + process.pid + ".tmp";
      fs.copyFileSync(__filename, temporaryWorker); // Also works when this module is in app.asar.
      replaceFile(temporaryWorker, workerFile);
      const log = fs.openSync(path.join(job, "worker-console.log"), "a", 0o600);
      let worker;
      try { worker = spawn(workerExecutable, [workerFile, "--worker", job], {
        env: { ...this.environment, ELECTRON_RUN_AS_NODE: "1" },
        cwd: agent.workspace,
        detached: true,
        stdio: ["ignore", log, log],
        windowsHide: true,
      }); } finally { fs.closeSync(log); }
      const startupFailure = (message, exitCode) => {
        // The current worker durably records native intent BEFORE spawning the
        // CLI. Its own exit before that barrier proves the prompt was not run.
        if (fs.existsSync(path.join(job, "native-starting.json"))) return;
        try {
          fs.appendFileSync(path.join(job, "events.jsonl"), JSON.stringify({
            time: now(), kind: "finished", data: {
              status: "failed", code: "CLAUDE_WORKER_START", message,
              nativeNotStarted: true, workerExitCode: exitCode,
            },
          }) + "\n", { mode: 0o600 });
        } catch (error) { workerDiagnostic(job, "worker.startupFailure", error); }
      };
      worker.once("exit", code => startupFailure("Claude 后台启动失败，原生任务尚未执行；请查看启动诊断。", code));
      worker.once("error", () => {
        startupFailure("Claude 任务观察进程无法启动");
      });
      task.worker.workerPid = worker.pid;
      worker.unref();
      this.save();
    } catch {
      this.apply(task, {
        time: now(),
        kind: "finished",
        data: {
          status: "failed",
          code: "CLAUDE_WORKER_START",
          message: "Claude 任务观察进程无法启动",
        },
      });
      this.save();
    }
    return this.publicTask(task);
  }
  async operation(task, input) {
    if (
      typeof input.operationId !== "string" ||
      !input.operationId ||
      input.operationId.length > 128 ||
      (input.executionId && input.executionId !== task.executionId)
    )
      throw fail("INVALID_INPUT", "控制操作需要原执行 ID 与操作 ID");
    const fingerprint = hash(
      JSON.stringify({
        task: task.taskId,
        action: input.action,
        requestId: input.requestId,
        decision: input.decision,
      }),
    );
    const previous = this.state.operations[input.operationId];
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw fail("REQUEST_CONFLICT", "此操作 ID 已用于另一条控制操作");
      return clone(previous);
    }
    if (input.action !== "cancel" && input.action !== "permission")
      throw fail(
        "INVALID_ANSWER",
        "Claude 当前仅支持工具权限审批，尚不支持问题表单",
      );
    if (
      input.action === "permission" &&
      !["once", "reject"].includes(input.decision)
    )
      throw fail("INVALID_ANSWER", "请选择本次允许或拒绝");
    if (
      input.action === "permission" &&
      !task.pending.some((p) => p.id === input.requestId)
    )
      throw fail("INVALID_ANSWER", "该权限请求已结束或不属于本轮任务");
    const receipt = {
      operationId: input.operationId,
      taskId: task.taskId,
      op: input.action === "cancel" ? "cancel" : "reply",
      state: TERMINAL.has(task.status) ? "confirmed" : "unknown",
      fingerprint,
      data: {
        message: TERMINAL.has(task.status)
          ? "原任务已经结束"
          : "已保存操作，等待 Claude 原进程确认",
      },
    };
    this.state.operations[input.operationId] = receipt;
    this.save();
    if (!TERMINAL.has(task.status))
      fs.appendFileSync(
        path.join(this.job(task), "commands.jsonl"),
        JSON.stringify({
          operationId: input.operationId,
          action: input.action,
          requestId: input.requestId,
          decision: input.decision,
        }) + "\n",
        { mode: 0o600 },
      );
    const deadline = Date.now() + 10000;
    while (
      receipt.state === "unknown" &&
      Date.now() < deadline &&
      !this.closed
    ) {
      await new Promise((done) => setTimeout(done, 100));
      this.sync();
    }
    return clone(receipt);
  }
}

async function runWorker(jobDirectory) {
  const job = readJSON(path.join(jobDirectory, "job.json"), null);
  if (!job) throw new Error("Missing Claude job");
  const diagnose = (context, error) =>
    workerDiagnostic(jobDirectory, context, error);
  const emit = (kind, data = {}) => {
    try {
      fs.appendFileSync(
        path.join(jobDirectory, "events.jsonl"),
        JSON.stringify({ time: now(), kind, data: sanitize(data) }) + "\n",
        { mode: 0o600 },
      );
      return true;
    } catch (error) {
      diagnose("events:" + kind, error);
      return false;
    }
  };
  const persist = (name, value) => {
    try {
      writeJSON(path.join(jobDirectory, name), sanitize(value));
      return true;
    } catch (error) {
      diagnose("persist:" + name, error);
      return false;
    }
  };
  const heartbeat = () =>
    persist("heartbeat.json", { time: now(), pid: process.pid });
  heartbeat();
  const args = [
    "--print",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-mode",
    "default",
    "--permission-prompt-tool",
    "stdio",
  ];
  args.push(
    job.sessionId
      ? "--resume=" + job.sessionId
      : "--session-id=" + job.newSessionId,
  );
  if (job.model) args.push("--model=" + job.model);
  if (job.mcp) {
    const config=path.join(jobDirectory,'bridge-mcp.json');
    writeJSON(config,{mcpServers:{agentbridge:{command:job.mcp.command,args:job.mcp.args,env:job.mcp.env}}});
    args.push('--mcp-config',config);
    args.push('--append-system-prompt','你是用户选定的主 Agent。需要协作时使用 agentbridge 的 list_agents 发现已允许的子节点，delegate 委派，task_result 等待实际结果并在当前会话汇总。对每项委派使用稳定 requestId，回应不明时查询原任务，不重复发送。不要用终端命令绕过协作接口。子节点不能扩大连接关系或继续委派。');
    // Only Bridge's scoped collaboration tools are pre-authorized.
    args.push('--allowedTools','mcp__agentbridge__list_agents','mcp__agentbridge__delegate','mcp__agentbridge__task_result','mcp__agentbridge__cancel_task','mcp__agentbridge__task_pending');
  }
  if (job.verification) args.push("--tools", "");
  const environment = {
    ...process.env,
    CLAUDE_CODE_ENTRYPOINT: "sdk-ts",
    CLAUDE_CODE_SDK_READS_SESSION_STATE: "1",
  };
  delete environment.CLAUDECODE;
  const command = cliCommand(job.executable, args, environment);
  let child,
    exited = false,
    cancelled = false,
    result,
    stderr = "",
    toolUses = 0,
    denied = false,
    sessionState,
    text = "",
    partial = false,
    cursor = 0,
    finishingTimer,
    initTimer;
  const pending = new Map(),
    operations = new Map(),
    background = new Set();
  const send = (data) => {
    if (
      !exited &&
      child.stdin.writable &&
      !child.stdin.writableEnded &&
      !child.stdin.destroyed
    ) {
      try {
        child.stdin.write(JSON.stringify(data) + "\n", (error) => {
          if (error) diagnose("stdin.write", error);
        });
        return true;
      } catch (error) {
        diagnose("stdin.write", error);
      }
    }
    return false;
  };
  const stop = () => {
    if (exited) return;
    if (process.platform === "win32") {
      // This PID was obtained directly from our child. No process discovery or
      // broad name matching can terminate the user's other Claude sessions.
      execFile(
        path.join(
          process.env.SystemRoot || "C:\\Windows",
          "System32/taskkill.exe",
        ),
        ["/PID", String(child.pid), "/T", "/F"],
        { windowsHide: true },
        () => {},
      );
    } else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }
  };
  const endInput = () => {
    if (
      !exited &&
      child.stdin.writable &&
      !child.stdin.writableEnded &&
      !child.stdin.destroyed
    ) {
      try {
        child.stdin.end();
      } catch (error) {
        diagnose("stdin.end", error);
      }
    }
  };
  const settleInput = () => {
    if (!result || pending.size || background.size) return;
    if (result.is_error || sessionState === "idle" || !sessionState) endInput();
  };
  const onMessage = (message) => {
    if (
      message.session_id &&
      ["system", "assistant", "result"].includes(message.type)
    )
      emit("native", {
        sessionId: message.session_id,
        messageId: message.message?.id || "",
      });
    if (
      message.type === "control_response" &&
      message.response?.request_id === "agentbridge-initialize"
    ) {
      clearTimeout(initTimer);
      if (message.response.subtype === "error") {
        stderr = "Claude 版本不支持当前初始化协议";
        stop();
        return;
      }
      send({
        type: "user",
        session_id: job.sessionId || job.newSessionId,
        message: {
          role: "user",
          content: [{ type: "text", text: job.message }],
        },
        parent_tool_use_id: null,
      });
      return;
    }
    if (message.type === "control_request") {
      const request = message.request || {};
      if (request.subtype !== "can_use_tool") {
        send({
          type: "control_response",
          response: {
            subtype: "error",
            request_id: message.request_id,
            error: "AgentBridge does not support this control request",
          },
        });
        return;
      }
      if (request.tool_name === "AskUserQuestion") {
        denied = true;
        send({
          type: "control_response",
          response: {
            subtype: "success",
            request_id: message.request_id,
            response: {
              behavior: "deny",
              message:
                "AgentBridge 当前尚未支持 Claude 问题表单，请用普通文本说明问题",
            },
          },
        });
        emit("progress", {
          text: "Claude 请求了尚未支持的问题表单，已拒绝此工具请求",
        });
        return;
      }
      pending.set(message.request_id, request);
      const input = request.input || {};
      const resources = [
        input.file_path,
        input.path,
        input.command,
        request.description,
      ]
        .filter((v) => typeof v === "string")
        .map((v) => redact(v).slice(0, 500));
      emit("permission", {
        id: message.request_id,
        toolName: request.tool_name,
        resources,
        description: redact(
          request.description || "Claude 请求执行 " + request.tool_name,
        ),
      });
    } else if (message.type === "control_cancel_request") {
      pending.delete(message.request_id);
      emit("permission_cancel", { id: message.request_id });
      settleInput();
    } else if (
      message.type === "system" &&
      message.subtype === "task_started"
    ) {
      if (["local_agent", "local_workflow"].includes(message.task_type))
        background.add(message.task_id);
    } else if (
      message.type === "system" &&
      message.subtype === "task_notification"
    ) {
      background.delete(message.task_id);
    } else if (
      message.type === "system" &&
      message.subtype === "task_updated"
    ) {
      if (
        ["completed", "failed", "stopped", "cancelled"].includes(
          message.patch?.status,
        )
      )
        background.delete(message.task_id);
    } else if (
      message.type === "system" &&
      message.subtype === "session_state_changed"
    ) {
      sessionState = message.state || message.session_state;
      settleInput();
    } else if (
      message.type === "stream_event" &&
      message.event?.delta?.type === "text_delta" &&
      !message.parent_tool_use_id
    ) {
      const delta = message.event.delta.text || "";
      partial = true;
      text += delta;
      emit("output", { text: delta });
    } else if (message.type === "assistant") {
      for (const content of message.message?.content || []) {
        if (content.type === "tool_use") {
          toolUses++;
          emit("progress", { text: "Claude 正在使用 " + content.name });
        }
        if (
          content.type === "text" &&
          !partial &&
          !message.parent_tool_use_id
        ) {
          text += content.text;
          emit("output", { text: content.text });
        }
      }
    } else if (
      message.type === "system" &&
      message.subtype === "permission_denied"
    )
      denied = true;
    else if (message.type === "result") {
      result = message;
      persist("result.json", {
        time: now(),
        is_error: !!message.is_error,
        subtype: message.subtype,
        result: message.result,
        errors: message.errors,
        sessionId: message.session_id,
        permissionDenials: message.permission_denials,
      });
      if (
        Array.isArray(message.permission_denials) &&
        message.permission_denials.length
      )
        denied = true;
      settleInput();
      // A process exit, rather than this result frame, confirms the terminal
      // state. Background work still has its control channel while running.
      clearTimeout(finishingTimer);
      finishingTimer = setTimeout(settleInput, 2000);
    }
  };
  try {
    if (!persist("native-starting.json", { time: now(), workerPid: process.pid })) {
      emit("finished", { status: "failed", code: "CLAUDE_START_RECORD", message: "原生启动记录保存失败，任务未执行" });
      return;
    }
    child = spawn(command.executable, command.args, {
      env: command.env,
      cwd: job.workspace,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    emit("finished", {
      status: "failed",
      code: "CLAUDE_START",
      message: "Claude Code 无法启动",
    });
    return;
  }
  emit("started", { pid: child.pid });
  child.stdin.on("error", (error) => diagnose("stdin.error", error));
  child.stdout.on("error", (error) => diagnose("stdout.error", error));
  child.stderr.on("error", (error) => diagnose("stderr.error", error));
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    if (buffer.length > 4000000) {
      stderr = "Claude 输出超出协议限制";
      stop();
      return;
    }
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      try {
        onMessage(JSON.parse(line));
      } catch (error) {
        diagnose("stdout.message", error);
        stderr = "Claude 返回了无法读取的协议消息";
        stop();
      }
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr = redact(stderr + chunk).slice(-16000);
    try {
      fs.appendFileSync(
        path.join(jobDirectory, "claude-stderr.log"),
        redact(chunk),
        { mode: 0o600 },
      );
    } catch (error) {
      diagnose("stderr.persist", error);
    }
  });
  child.on("error", (error) => {
    diagnose("child.error", error);
    stderr = "Claude Code 无法启动，请检查安装";
  });
  const commands = setInterval(() => {
    heartbeat();
    try {
      for (const input of rows(path.join(jobDirectory, "commands.jsonl")).slice(
        cursor,
      )) {
        cursor++;
        if (operations.has(input.operationId)) continue;
        operations.set(input.operationId, input);
        if (input.action === "cancel") {
          cancelled = true;
          send({
            type: "control_request",
            request_id: "cancel-" + input.operationId,
            request: { subtype: "interrupt" },
          });
          endInput();
          setTimeout(stop, 500);
        } else if (input.action === "permission") {
          const request = pending.get(input.requestId);
          if (!request) {
            emit("operation", {
              operationId: input.operationId,
              state: "rejected",
              message: "Claude 权限请求已结束",
            });
            continue;
          }
          pending.delete(input.requestId);
          if (input.decision === "reject") denied = true;
          const written = send({
            type: "control_response",
            response: {
              subtype: "success",
              request_id: input.requestId,
              response:
                input.decision === "once"
                  ? { behavior: "allow", updatedInput: request.input || {} }
                  : { behavior: "deny", message: "用户拒绝本次工具操作" },
            },
          });
          emit("operation", {
            operationId: input.operationId,
            requestId: input.requestId,
            state: written ? "confirmed" : "unknown",
            message: written
              ? "已将本次权限答复写入 Claude 原生控制通道"
              : "Claude 控制通道已关闭，权限答复结果未确认",
          });
          settleInput();
        }
      }
    } catch (error) {
      diagnose("commands.poll", error);
    }
  }, 200);
  const done = new Promise((resolve) =>
    child.once("close", (code, signal) => {
      exited = true;
      clearInterval(commands);
      clearTimeout(initTimer);
      clearTimeout(finishingTimer);
      const success =
        !cancelled &&
        code === 0 &&
        result &&
        !result.is_error &&
        result.subtype === "success" &&
        !denied;
      const status = cancelled ? "cancelled" : success ? "succeeded" : "failed";
      const message = cancelled
        ? "已确认 Claude 原执行进程退出，本轮已取消"
        : denied
          ? "Claude 有工具操作被拒绝，本轮需求未完整完成"
          : success
            ? redact(result.result || text)
            : redact(
                result?.result ||
                  (Array.isArray(result?.errors)
                    ? result.errors.join("\n")
                    : typeof result?.errors === "string"
                      ? result.errors
                      : "") ||
                  stderr ||
                  "Claude 进程结束，但没有返回成功结果",
              );
      const completion = {
        time: now(),
        nativeExited: true,
        status,
        code: denied
          ? "CLAUDE_PERMISSION_DENIED"
          : result?.is_error
            ? "CLAUDE_RESULT_ERROR"
            : "CLAUDE_EXIT",
        message,
        toolUses,
        exitCode: code,
        signal,
      };
      persist("completion.json", completion);
      emit("finished", completion);
      heartbeat();
      resolve();
    }),
  );
  initTimer = setTimeout(() => {
    stderr = "Claude 初始化协议超时，请检查版本和登录状态";
    stop();
  }, 60000);
  send({
    type: "control_request",
    request_id: "agentbridge-initialize",
    request: { subtype: "initialize", hooks: null },
  });
  await done;
}

module.exports = {
  ClaudeHost,
  cliCommand,
  windowsCandidates,
  runWorker,
  writeJSON,
};
if (require.main === module && process.argv[2] === "--worker") {
  process.on("uncaughtExceptionMonitor", (error) =>
    workerDiagnostic(process.argv[3], "worker.uncaughtException", error),
  );
  process.on("unhandledRejection", (error) => {
    workerDiagnostic(process.argv[3], "worker.unhandledRejection", error);
    process.exitCode = 1;
  });
  runWorker(process.argv[3]).catch((error) => {
    workerDiagnostic(process.argv[3], "worker.run", error);
    // An observer failure cannot prove the native process has exited. Leave
    // this execution unknown; never invent a terminal native outcome.
    process.exitCode = 1;
  });
}
