const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomUUID, createHash } = require("node:crypto");

const idKeys = new Set(["agentId", "instanceId", "targetAgent", "defaultAgent", "taskId", "conversationId", "lastTaskId"]);
const terminal = new Set(["succeeded", "failed", "cancelled"]);
function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function hash(value) { return createHash("sha256").update(value).digest("hex").slice(0, 20); }
function qualified(machineId, id) { return id ? machineId + "::" + id : id; }
function project(value, machineId) {
  if (Array.isArray(value)) return value.map(v => project(v, machineId));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key,
    idKeys.has(key) && typeof v === "string" ? qualified(machineId, v) : project(v, machineId)]));
}
function workspaceKey(machine, workspace) {
  // An SSH machine owns a separate filesystem, including paths such as /mnt/c.
  // Only Windows and its WSL distributions share the local drive aliases.
  if (machine.kind === 'ssh') return machine.machineId + ':' + workspace.replace(/\/+$/, '');
  const drive = workspace.match(/^([a-z]):[\\/](.*)$/i);
  const mount = workspace.match(/^\/mnt\/([a-z])\/(.*)$/i);
  if (drive || mount) {
    const [, disk, tail] = drive || mount;
    return "drive:" + disk.toLowerCase() + ":" + tail.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
  }
  const unc = workspace.match(/^\\\\wsl(?:\.localhost|\$)\\([^\\]+)\\(.*)$/i);
  if (unc) return "wsl:" + unc[1].toLowerCase() + ":/" + unc[2].replaceAll("\\", "/").replace(/\/+$/, "");
  return (machine.kind === "wsl" ? "wsl:" + machine.distribution.toLowerCase() : machine.machineId) + ":" + workspace.replace(/\/+$/, "");
}
function folderPath(value, machine) {
  if (machine.kind !== "wsl") return value;
  const unc = value.match(/^\\\\wsl(?:\.localhost|\$)\\([^\\]+)\\(.*)$/i);
  if (unc) {
    if (unc[1].toLowerCase() !== machine.distribution.toLowerCase()) fail("WRONG_MACHINE", "所选目录属于另一个 WSL 环境，请选择当前机器的项目。");
    return "/" + unc[2].replaceAll("\\", "/");
  }
  const drive = value.match(/^([A-Za-z]):\\(.*)$/);
  if (drive) return "/mnt/" + drive[1].toLowerCase() + "/" + drive[2].replaceAll("\\", "/");
  return value;
}

/** The desktop catalog owns machines and tool connections. Backend agent IDs remain
 * execution-instance IDs so existing CLI history and native sessions are preserved. */
class MachineRouter {
  constructor(options) {
    this.options = options;
    this.file = path.join(options.directory, "machines.json");
    this.hosts = new Map(); this.historyFile=path.join(options.directory,'machine-history.json');this.history=fs.existsSync(this.historyFile)?JSON.parse(fs.readFileSync(this.historyFile,'utf8')):{};this.cache = new Map(Object.entries(this.history)); this.locks = new Set();
    this.discovered = new Map(); this.scanning = new Map(); this.machineScanTime = 0;
    this.snapshotJobs = new Map(); this.retryAfter = new Map();
    fs.mkdirSync(options.directory, { recursive: true });
    if (fs.existsSync(this.file)) {
      this.catalog = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (this.catalog.version !== 1 || !Array.isArray(this.catalog.machines) || !Array.isArray(this.catalog.connections) || !Array.isArray(this.catalog.instances)) fail("CATALOG_INVALID", "机器目录无法读取，原后台历史没有改动。");
    } else {
      const machineId = "local-" + randomUUID();
      this.catalog = { version: 1, localMachineId: machineId, machines: [{
        machineId, name: options.hostname || os.hostname(), kind: options.platform === "win32" ? "windows" : "linux",
        platform: options.platform || process.platform,
      }], connections: [], instances: [] };
      this.save();
    }
  }
  save() {
    const temp = this.file + "." + randomUUID() + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(this.catalog, null, 2), { mode: 0o600 });
    fs.renameSync(temp, this.file);
  }
  preferences() { return this.options.preferences?.() || {}; }
  async machines() {
    if (this.machineScanTime && Date.now() - this.machineScanTime < 15000) return this.catalog.machines;
    if ((this.options.platform || process.platform) === "win32") {
      try {
        const names = await this.options.distributions();
        const preferred = this.preferences().distribution;
        for (const distribution of [...new Set([...names, ...(preferred ? [preferred] : [])])]) {
          const machineId = "wsl-" + hash(distribution.toLowerCase());
          let machine = this.catalog.machines.find(m => m.machineId === machineId);
          if (!machine) {
            machine = { machineId, name: "WSL · " + distribution, kind: "wsl", platform: "linux", distribution, parentMachineId: this.catalog.localMachineId };
            this.catalog.machines.push(machine);
          }
          delete machine.unavailable;
        }
        for (const machine of this.catalog.machines.filter(m => m.kind === "wsl")) machine.unavailable = !names.includes(machine.distribution);
      } catch (error) {
        for (const machine of this.catalog.machines.filter(m => m.kind === "wsl")) machine.unavailable = true;
        this.discoveryError = error.message;
      }
      this.save();
    }
    this.machineScanTime = Date.now();
    return this.catalog.machines;
  }
  defaultMachine() {
    const prefs = this.preferences();
    return this.catalog.machines.find(m => m.kind === "wsl" && m.distribution === prefs.distribution)
      || this.catalog.machines.find(m => m.kind === "wsl" && !m.unavailable)
      || this.catalog.machines[0];
  }
  machine(machineId) {
    const machine = machineId ? this.catalog.machines.find(m => m.machineId === machineId) : this.defaultMachine();
    if (!machine) fail("MACHINE_NOT_FOUND", "所选机器不存在，请刷新机器列表。");
    return machine;
  }
  host(machine) {
    if (machine.unavailable) fail("MACHINE_OFFLINE", "这个 WSL 环境当前不可用，其他机器仍可使用。");
    let host = this.hosts.get(machine.machineId);
    if (!host) { host = this.options.createHost(machine); this.hosts.set(machine.machineId, host); }
    return host;
  }
  connection(machine, executable, details = {}) {
    const normalized = machine.kind === "windows" ? executable.toLowerCase() : executable;
    const connectionId = "tool-" + hash(machine.machineId + ":" + normalized);
    let row = this.catalog.connections.find(c => c.connectionId === connectionId);
    if (!row) {
      row = { connectionId, machineId: machine.machineId, adapter: machine.kind === "windows" ? "claude" : "opencode", name: machine.kind === "windows" ? "Claude Code" : "OpenCode", executable, connected: false };
      this.catalog.connections.push(row);
    }
    Object.assign(row, details, { connectionId, machineId: machine.machineId, executable });
    return row;
  }
  importSnapshot(machine, snapshot) {
    for (const a of snapshot.agents?.items || []) {
      const existing = this.catalog.instances.find(i => i.machineId === machine.machineId && i.backendId === a.agentId);
      const executable = a.executable || snapshot.connections?.find(c => c.connectionId === a.connectionId)?.executable || existing?.executable || (machine.kind === "windows" ? "claude" : "opencode");
      const connection = this.connection(machine, executable, { connected: true, ...(a.adapter ? {adapter:a.adapter,name:a.adapter==='codex'?'Codex':a.adapter==='claude'?'Claude Code':'OpenCode'} : {}) });
      const row = { instanceId: qualified(machine.machineId, a.agentId), machineId: machine.machineId, connectionId: connection.connectionId, backendId: a.agentId, name: a.name, workspace: a.workspace, enabled: a.enabled, nativeAgent: a.nativeAgent, model: a.model, default: a.default, busy: a.busy, executable, adapter:connection.adapter,
        ...(a.nodeId ? {nodeId:a.nodeId} : {}),
        ...(a.currentTask ? { currentTask: { taskId: a.currentTask.taskId, status: a.currentTask.status } } : { currentTask: undefined }) };
      if (existing) Object.assign(existing, row); else this.catalog.instances.push(row);
    }
    this.save();
  }
  async discover(machine) {
    let pending = this.scanning.get(machine.machineId);
    if (!pending) {
      pending = this.host(machine).call("discover", {}).then(result => {
        const items = (result.items || []).map(item => ({ ...item, error: typeof item.error === "object" ? item.error?.message : item.error, machineId: machine.machineId, adapter: item.adapter || (machine.kind === "windows" ? "claude" : "opencode") }));
        this.discovered.set(machine.machineId, { time: Date.now(), items });
        return { machineId: machine.machineId, items };
      }).finally(() => this.scanning.delete(machine.machineId));
      this.scanning.set(machine.machineId, pending);
    }
    return pending;
  }
  async oneSnapshot(machine) {
    let timer;
    try {
      if((this.network?.removedMachines||[]).includes(machine.machineId))fail('MACHINE_REMOVED','机器已移除，历史保留。');
      if ((this.retryAfter.get(machine.machineId) || 0) > Date.now()) fail("MACHINE_TIMEOUT", "机器后台正在恢复连接，其他机器仍可使用。");
      let job = this.snapshotJobs.get(machine.machineId);
      if (!job) {
        job = (async () => {
          const snapshot = await this.host(machine).call("snapshot", {});
          this.importSnapshot(machine, snapshot);
          const scanned = this.discovered.get(machine.machineId);
          if (!scanned || Date.now() - scanned.time > 30000) {
            try { await this.discover(machine); } catch { /* Machine status is independent of installed tools. */ }
          }
          this.cache.set(machine.machineId, snapshot);
          // Preserve private history for disconnected/removed machines across restarts.
          const previousHistory=this.history[machine.machineId]||{};
          const retain=(older,newer,key)=>[...new Map([...(older||[]),...(newer||[])].map(row=>[row[key],row])).values()];
          this.history[machine.machineId]={agents:{revision:snapshot.agents?.revision,connected:snapshot.agents?.connected,items:(snapshot.agents?.items||[]).map(a=>Object.fromEntries(['agentId','name','workspace','enabled','nativeAgent','default','busy','executable','adapter','nodeId','connectionId','currentTask','online','healthy','available','capabilities','startupError'].filter(k=>a[k]!==undefined).map(k=>[k,a[k]])))},tasks:retain(previousHistory.tasks,snapshot.tasks,'taskId'),conversations:retain(previousHistory.conversations,snapshot.conversations,'conversationId')};
          const historyTemp=this.historyFile+'.'+randomUUID()+'.tmp';
          fs.writeFileSync(historyTemp,JSON.stringify(this.history),{mode:0o600});fs.renameSync(historyTemp,this.historyFile);
          this.retryAfter.delete(machine.machineId);
          return snapshot;
        })();
        this.snapshotJobs.set(machine.machineId, job);
        job.finally(() => { if (this.snapshotJobs.get(machine.machineId) === job) this.snapshotJobs.delete(machine.machineId); }).catch(() => {});
      }
      const deadline = new Promise((_, reject) => { timer = setTimeout(() => {
        this.retryAfter.set(machine.machineId, Date.now() + 5000);
        reject(Object.assign(new Error("机器后台响应超时，其他机器仍可使用。"), { code: "MACHINE_TIMEOUT" }));
      }, this.options.snapshotTimeoutMs || 10000); });
      const snapshot = await Promise.race([job, deadline]);
      return { machine: { ...machine, online: true, error: undefined, connectionError: undefined, lastSyncedAt:new Date().toISOString(), home: snapshot.environment?.home, cwd: snapshot.environment?.cwd }, snapshot };
    } catch (error) {
      return { machine: { ...machine, online: false, error: error.message }, snapshot: this.history[machine.machineId]||this.cache.get(machine.machineId), stale: true };
    } finally { clearTimeout(timer); }
  }
  async snapshot() {
    await this.machines();
    const rows = await Promise.all(this.catalog.machines.map(m => this.oneSnapshot(m)));
    const agents = [], tasks = [], conversations = [], instances = [], connections = [];
    for (const { machine, snapshot, stale } of rows) {
      const found = this.discovered.get(machine.machineId)?.items || [];
      const configured = this.catalog.connections.filter(c => c.machineId === machine.machineId);
      for (const item of found) {
        const saved = configured.find(c => c.executable === item.executable);
        connections.push({ ...item, connectionId: saved?.connectionId || "tool-" + hash(machine.machineId + ":" + (machine.kind === "windows" ? item.executable.toLowerCase() : item.executable)), connected: !!saved?.connected, healthy: machine.online && item.healthy !== false, error: item.error });
      }
      for (const c of configured.filter(c => !found.some(f => f.executable === c.executable))) connections.push({ ...c, healthy: false, error: machine.error || "没有发现这个工具，请重新扫描。" });
      if (!snapshot) {
        for (const row of this.catalog.instances.filter(i => i.machineId === machine.machineId)) {
          const placeholder = { ...row, agentId: row.instanceId, adapter: row.adapter || (machine.kind === "windows" ? "claude" : "opencode"), online: false, healthy: false, available: false, stale: true,
            capabilities: { verification: false, permissions: false, forms: false }, startupError: { code: "MACHINE_OFFLINE", message: machine.error },
            ...(row.currentTask ? { currentTask: { ...row.currentTask, taskId: qualified(machine.machineId, row.currentTask.taskId), status: "unknown", summary: "来源机器离线，等待核对原任务。" } } : {}) };
          instances.push(placeholder); agents.push(placeholder);
        }
        continue;
      }
      for (const a of snapshot.agents?.items || []) {
        const row = this.catalog.instances.find(i => i.machineId === machine.machineId && i.backendId === a.agentId);
        const tagged = { ...project(a, machine.machineId), instanceId: qualified(machine.machineId, a.agentId), machineId: machine.machineId, connectionId: row.connectionId, adapter: a.adapter || row.adapter || (machine.kind === "windows" ? "claude" : "opencode"), settingsRevision: snapshot.agents.revision,
          capabilities: { verification: machine.kind !== "windows", permissions: true, forms: machine.kind !== "windows", ...a.capabilities },
          ...(stale ? { online: false, available: false, startupError: { code: "MACHINE_OFFLINE", message: machine.error } } : {}) };
        agents.push(tagged); instances.push(tagged);
      }
      for (const task of snapshot.tasks || []) tasks.push({ ...project(task, machine.machineId), machineId: machine.machineId,
        ...(stale && !terminal.has(task.status) ? { status: "unknown", uncertaintyReason: "来源机器暂不可访问，请核对原任务。" } : {}) });
      for (const c of snapshot.conversations || []) conversations.push({ ...project(c, machine.machineId), machineId: machine.machineId });
    }
    const connected = rows.some(r => r.machine.online);
    tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { configured: instances.length > 0, directory: this.options.directory, machines: rows.map(r => r.machine), connections, instances,
      discoveryError: this.discoveryError, agents: { items: agents, revision: 0, connected, defaultAgent: agents.find(a => a.default && a.available)?.agentId || agents.find(a => a.available)?.agentId, connectionState: connected ? "connected" : "offline" },
      tasks, conversations, status: { connected, connectionState: connected ? "connected" : "offline" } };
  }
  route(params = {}) {
    let machineId = params.machineId;
    const stripped = structuredClone(params);
    function walk(value) {
      if (!value || typeof value !== "object") return;
      for (const [key, v] of Object.entries(value)) {
        if (idKeys.has(key) && typeof v === "string" && v.includes("::")) {
          const end = v.indexOf("::"), id = v.slice(0, end);
          if (!thisRouter.catalog.machines.some(m => m.machineId === id)) {
            if (/^(?:local-|wsl-)/.test(id)) fail("MACHINE_NOT_FOUND", "这个对象的来源机器不在当前目录中。");
            continue; // A legacy raw ID may contain colons.
          }
          if (machineId && machineId !== id) fail("WRONG_MACHINE", "这个对象属于另一台机器，请刷新后重试。");
          machineId = id; value[key] = v.slice(end + 2);
        } else walk(v);
      }
    }
    const thisRouter = this;
    walk(stripped);
    const machine = this.machine(machineId);
    delete stripped.machineId;
    return { machine, params: stripped };
  }
  async prepare(method, params = {}) {
    await this.machines();
    if (method === "snapshot") return { machineId: null, params };
    const routed = this.route(params);
    return { machineId: routed.machine.machineId, params: { ...params, machineId: routed.machine.machineId } };
  }
  async execute(machine, params) {
    const host = this.host(machine);
    if (!["submit", "continue", "verify"].includes(params.op)) return host.call("ipc", params);
    // Let the backend enforce the original request contract on retries before
    // applying resource occupancy checks to a new execution.
    if (params.requestId) {
      const cached = this.cache.get(machine.machineId)?.tasks.find(t => t.requestId === params.requestId);
      if (cached) return host.call("ipc", params);
      try {
        const original = await host.call("ipc", { op: "request", requestId: params.requestId });
        if (original?.taskId) return host.call("ipc", params);
      } catch (error) {
        if (!["NOT_FOUND", "TASK_NOT_FOUND", "REQUEST_NOT_FOUND", "NOT_CONFIGURED"].includes(error.code)) throw error;
      }
    }
    let backendId = params.agentId || params.targetAgent;
    if (params.op === "continue") backendId = (await host.call("ipc", { op: "conversation", conversationId: params.conversationId })).targetAgent;
    const instance = this.catalog.instances.find(i => i.machineId === machine.machineId && i.backendId === backendId);
    if (!instance) fail("AGENT_NOT_FOUND", "请先选择已连接的项目实例。");
    const key = workspaceKey(machine, instance.workspace);
    if (this.locks.has(key)) fail("PROJECT_BUSY", "这个项目正在另一台机器或工具上启动任务，请稍后再试。");
    this.locks.add(key);
    try {
      const state = await this.snapshot();
      const unavailable = this.catalog.instances.find(i => i.enabled !== false && workspaceKey(this.machine(i.machineId), i.workspace) === key
        && state.machines.find(m => m.machineId === i.machineId)?.online === false);
      if (unavailable) fail("PROJECT_SOURCE_OFFLINE", "共享这个项目的来源机器离线，无法确认占用；恢复连接并核对原任务后再提交。");
      const overlapping = state.instances.filter(i => workspaceKey(this.machine(i.machineId), i.workspace) === key);
      if (overlapping.some(i => i.busy || i.currentTask?.status === "unknown")
        || state.tasks.some(t => !terminal.has(t.status) && overlapping.some(i => i.agentId === t.targetAgent))) fail("PROJECT_BUSY", "这个项目已有未结束任务，Windows 与 WSL 共享目录也需要等待。");
      this.assertAdmission?.(machine,instance);
      return await host.call("ipc", params);
    } finally { this.locks.delete(key); }
  }
  historical(machine,p){
    const snapshot=this.history[machine.machineId]||this.cache.get(machine.machineId);if(!snapshot)return null;
    const mark=t=>({...t,...(!terminal.has(t.status)?{status:'unknown',uncertaintyReason:'历史快照，等待来源机器核对。'}:{}),historical:true});
    if(p.op==='task'){const task=snapshot.tasks.find(t=>t.taskId===p.taskId);return task?mark(task):null;}
    if(p.op==='conversation'){const conversation=snapshot.conversations.find(c=>c.conversationId===p.conversationId);return conversation?{...conversation,items:snapshot.tasks.filter(t=>t.conversationId===p.conversationId).map(mark),canContinue:false,historical:true}:null;}
    return null;
  }
  async call(method, params = {}) {
    if (method === "snapshot") return this.snapshot();
    await this.machines();
    const routed = this.route(params), machine = routed.machine, p = routed.params;
    if (method === "environment") return { ...await this.host(machine).call(method, p), machineId: machine.machineId };
    if (method === "discover") return this.discover(machine);
    if (method === "connectTool") {
      const result = await this.discover(machine);
      const selected = result.items.find(i => i.executable === p.executable);
      if (!selected) fail("DISCOVERY_CHANGED", "这个工具已不可用，请重新扫描。");
      if (selected.healthy === false) fail("AGENT_UNAVAILABLE", selected.error || "工具尚不可用，请先在该机器完成登录。");
      const connection = this.connection(machine, selected.executable, { ...selected, connected: true });
      this.save(); return { machineId: machine.machineId, connection };
    }
    if (method === "createInstance" || method === "connect") {
      const connection = method === "createInstance" ? this.catalog.connections.find(c => c.connectionId === p.connectionId && c.machineId === machine.machineId && c.connected) : this.connection(machine, p.executable);
      if (!connection) fail("CONNECTION_NOT_FOUND", "请先连接这台机器上的 Agent 工具。");
      const workspace = folderPath(p.workspace || "", machine);
      if (!workspace) fail("INVALID_INPUT", "请选择项目目录。");
      const result = await this.host(machine).call("connect", { executable: connection.executable, workspace, name: p.name || connection.name, ...(p.model ? { model: p.model } : {}) });
      connection.connected = true;
      const snapshot = await this.host(machine).call("snapshot", {});
      this.importSnapshot(machine, snapshot); this.cache.set(machine.machineId, snapshot);
      return { ...project(result, machine.machineId), machineId: machine.machineId };
    }
    if (method === "setInstanceModel") {
      const result = await this.host(machine).call(method, p);
      return { ...project(result, machine.machineId), machineId: machine.machineId };
    }
    if (method !== "ipc") fail("INVALID_INPUT", "不支持这个桌面操作。");
    let result;
    try{if((this.network?.removedMachines||[]).includes(machine.machineId)&&['task','conversation'].includes(p.op))fail('MACHINE_REMOVED','机器已移除。');result=await this.execute(machine,p);}
    catch(error){
      if(!['task','conversation'].includes(p.op)||!['MACHINE_REMOVED','MACHINE_OFFLINE','DESKTOP_TRANSPORT','DESKTOP_TIMEOUT','MACHINE_TIMEOUT'].includes(error.code))throw error;
      result=this.historical(machine,p);if(!result)throw error;
    }
    return { ...project(result, machine.machineId), machineId: machine.machineId };
  }
  close() { for (const host of this.hosts.values()) host.close(); this.hosts.clear(); }
}
module.exports = { MachineRouter, qualified, project, workspaceKey, folderPath };
