const { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { HostConnection, distributions } = require('./rpc.cjs');
const { ClaudeHost } = require('./claude-host.cjs');
const { AgentNetwork } = require('./agent-network.cjs');
const { MachineHost } = require('./machine-host.cjs');
const { workerRuntime } = require('./worker-runtime.cjs');
const { recoverJournal } = require('./pending-journal.cjs');
const { GraphOperationJournal } = require('./graph-operations.cjs');
const sshMethods = new Set(['machine.createSshDraft','credential.provide','machine.testSsh','machine.trustHost','machine.connectSsh','machine.reconnect','machine.disconnect']);
const methods = new Set(['snapshot','discover','ipc','environment','attachNode','manageNode','nodeOperation','nodeRequest','saveCollaboration','collaboration','collaborationOperation','graphLayout','saveGraphLayout','graphLayoutOperation','graphPending',...sshMethods]);
// SSH state is a complete observation: absent errors revoke cached failures.
// A live transport must not hide a failed business snapshot (e.g. RPC timeout).
function mergeSshState(machine, state, snapshot = false) {
  if (!state) return machine;
  const snapshotOnline = machine.online;
  const snapshotError = snapshot && snapshotOnline === false ? machine.error : undefined;
  Object.assign(machine, state);
  delete machine.error;
  delete machine.connectionError;
  if (state.error || snapshotError) machine.error = state.error || snapshotError;
  if (state.connectionError) machine.connectionError = state.connectionError;
  if (snapshot) machine.online = state.online && snapshotOnline;
  return machine;
}
function createCoordinatorService(options) {
  const platform = options.platform || process.platform;
  let host, ssh;
  const graphJournal=new GraphOperationJournal(options.directory);
function dataFile(name) {
  const folder = options.directory;
  mkdirSync(folder, { recursive: true });
  return resolve(folder, name);
}
function read(name, fallback) {
  try {
    return JSON.parse(readFileSync(dataFile(name), "utf8"));
  } catch {
    return fallback;
  }
}
function write(name, value) {
  const file = dataFile(name),
    tmp = file + ".tmp";
  writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(tmp, file);
}
function settings() {
  return read("desktop.json", {
    theme: "system",
    distribution: "",
    directory: "",
  });
}
function hostPath() {
  return options.packaged
    ? resolve(options.resourcesPath, "bridge/dist/desktop-host.js")
    : resolve(__dirname, "../../dist/desktop-host.js");
}
function connection() {
  if (host) return host;
  if (options.network) return (host = options.network);
  const { SshManager } = require('./ssh-host.cjs');
  const register = machine => {
    const existing = host.catalog.machines.find(m => m.machineId === machine.machineId);
    if (existing) Object.assign(existing, machine); else host.catalog.machines.push(machine);
    host.save();
  };
  ssh = new SshManager({directory: options.directory, coordinatorId: options.coordinatorId,
    packageDirectory: options.packageDirectory, onMachine: register,
    onChange: () => { if (!host) return; for (const state of ssh.states()) {
      const machine = host.catalog.machines.find(m => m.connectionId === state.connectionId);
      if (machine) mergeSshState(machine, state);
    } host.save(); }});
  host = new AgentNetwork({ directory: options.directory, platform: platform,
    preferences: settings, distributions,
    createHost: machine => machine.kind === 'ssh' ? ssh.host(machine)
      : machine.kind === 'windows' ? new MachineHost({directory: resolve(options.directory,'windows'),
        legacy: new ClaudeHost({directory: resolve(options.directory,'windows')}),
        openCode: directory => new HostConnection(hostPath(), {directory,native:true,leaf:true,runtime:workerRuntime(resolve(options.directory,'windows'))})})
      : new HostConnection(hostPath(), {native: platform !== 'win32',distribution: machine.distribution,
        bootstrapPath: existsSync(resolve(__dirname,'../../bootstrap.sh')) ? resolve(__dirname,'../../bootstrap.sh') : resolve(__dirname,'bootstrap.sh'),
        directory: (!settings().distribution || settings().distribution === machine.distribution) ? settings().directory : ''})
  });
  void ssh.start();
  return host;
}
const mutating = new Set(["submit", "continue", "verify", "reply", "cancel"]);
function journalKey(params) {
  return params.requestId || params.operationId || params.reply?.operationId;
}
function operation(name, params, state, result) {
  const rows = read("pending.json", []);
  const key = journalKey(params);
  if (!key) return;
  const index = rows.findIndex((r) => r.id === key && r.machineId === params.machineId);
  const row = {
    id: key,
    op: name,
    params,
    machineId: params.machineId,
    state,
    time: new Date().toISOString(),
    ...(result ? { result } : {}),
  };
  if (index >= 0) rows[index] = row;
  else rows.push(row);
  write(
    "pending.json",
    rows
      .filter((r) => ["pending", "unknown"].includes(r.state))
      .concat(
        rows
          .filter((r) => !["pending", "unknown"].includes(r.state))
          .slice(-100),
      ),
  );
}
function settleOperation(id, result, machineId) {
  const rows = read("pending.json", []);
  const row = rows.find((r) => r.id === id && r.machineId === machineId);
  if (!row) return;
  row.state = result?.state === "unknown" ? "unknown" : "confirmed";
  row.result = result;
  write("pending.json", rows);
}
let recoveringJournal;
function recoverPending() {
  if (recoveringJournal) return recoveringJournal;
  recoveringJournal = recoverJournal(read("pending.json", []),
    (method, params) => connection().call(method, params),
    (original, state, result) => {
      const rows = read("pending.json", []);
      const row = rows.find(r => r.id === original.id && r.machineId === original.machineId);
      // A concurrent submission/query may already have updated this receipt.
      if (!row || !["pending", "unknown"].includes(row.state) || row.time !== original.time
        || JSON.stringify(row.params) !== JSON.stringify(original.params)) return false;
      Object.assign(row, { state, result, reconciledAt: new Date().toISOString() });
      write("pending.json", rows);
      return true;
    }, row => connection().machine(row.machineId).kind === "wsl"
  ).finally(() => { recoveringJournal = null; });
  return recoveringJournal;
}
async function call(input) {
  try {
    if (
      !input ||
      !methods.has(input.method) ||
      !input.params ||
      typeof input.params !== "object" ||
      JSON.stringify(input).length > 1048576
    )
      throw new Error("桌面请求不合法");
    if(input.method==='attachNode')input={...input,method:'manageNode',params:{...input.params,action:'attach',operationId:require('node:crypto').randomUUID()}};
    connection();
    if (sshMethods.has(input.method)) return {ok: true, result: await ssh.call(input.method, input.params)};
    const graphDispatch=(method,params)=>connection().call(method,params);
    if(input.method==='graphPending')return {ok:true,result:graphJournal.pending()};
    if(['collaborationOperation','graphLayoutOperation','nodeOperation'].includes(input.method))return {ok:true,result:await graphJournal.lookup(input.method,input.params,graphDispatch)};
    if(input.method==='manageNode'){
      const prepared=await connection().prepare(input.method,input.params);input={...input,params:prepared.params};
      if(read('pending.json',[]).some(r=>['pending','unknown'].includes(r.state)&&(!r.machineId||r.machineId===prepared.machineId)))throw Object.assign(new Error('来源机器仍有未确认操作，请先查询原请求。'),{code:'DESKTOP_UNCONFIRMED'});
    }
    if(['saveCollaboration','saveGraphLayout','manageNode'].includes(input.method)&&input.params.operationId)return {ok:true,result:await graphJournal.save(input.method,input.params,graphDispatch)};
    const prepared = await connection().prepare(input.method, input.params);
    const oldRows = read("pending.json", []);
    if (oldRows.some(r => !r.machineId && ["pending", "unknown"].includes(r.state))) {
      const originalMachine = connection().defaultMachine();
      if (platform === "win32" && originalMachine.kind !== "wsl")
        throw Object.assign(new Error("旧操作来自 WSL，目前无法定位原发行版；请恢复原 WSL 后查询原操作。"), { code: "LEGACY_SOURCE_UNKNOWN" });
      for (const row of oldRows.filter(r => !r.machineId && ["pending", "unknown"].includes(r.state))) {
        row.machineId = originalMachine.machineId;
        row.params = { ...row.params, machineId: originalMachine.machineId };
      }
      write("pending.json", oldRows);
    }
    const p = prepared.params,
      mutation = ["ipc","nodeRequest"].includes(input.method) && mutating.has(p.op);
    const previousPending = mutation && read("pending.json", []).find(r =>
      r.id === journalKey(p) && r.machineId === p.machineId && ["pending", "unknown"].includes(r.state));
    if (previousPending && JSON.stringify(previousPending.params) !== JSON.stringify(p))
      throw Object.assign(new Error("原请求的回应尚未确认，不能用相同 ID 替换内容；请先核对原请求。"), { code: "DESKTOP_UNCONFIRMED" });
    if (mutation && !journalKey(p))
      throw new Error("提交或控制前必须保存请求 ID");
    if (
      mutation &&
      read("pending.json", []).some(
        (r) =>
          ["pending", "unknown"].includes(r.state) && r.id !== journalKey(p)
            && (!r.machineId || r.machineId === p.machineId),
      )
    )
      throw Object.assign(
        new Error(
          "有操作的回应尚未确认，请先在设置中查询原操作，再执行新操作。",
        ),
        { code: "DESKTOP_UNCONFIRMED" },
      );
    if (mutation) operation(p.op, p, "pending");
    try {
      const result = await connection().call(input.method, p);
      if (input.method === 'snapshot' && ssh) {
        const states = ssh.states();
        result.machines = result.machines.map(machine => mergeSshState({...machine}, states.find(s => s.machineId === machine.machineId), true));
        for (const draft of states.filter(s => !s.machineId)) result.machines.push({...draft, machineId: 'draft-' + draft.connectionId, kind:'ssh', platform:'linux', online:false});
      }
      if (input.method === "snapshot") {
        try {
          write("runtime.json", {
            time: new Date().toISOString(),
            platform: platform,
            version: options.version,
            configured: result.configured,
            connected: !!result.agents?.connected,
            agents: result.agents?.items.length || 0,
            tasks: result.tasks?.length || 0,
            machines: (result.machines || []).map(m => ({ machineId: m.machineId, name: m.name, kind: m.kind, online: m.online })),
            connections: (result.connections || []).map(c => ({ name: c.name, machineId: c.machineId, connected: c.connected, healthy: c.healthy })),
            instances: result.instances?.length || 0,
            nodes: (result.nodes || []).map(n => ({nodeId:n.nodeId,machineId:n.machineId,name:n.name,adapter:n.adapter,status:n.status,connected:n.connected,version:n.version})),
            collaboration: result.collaboration,
          });
        } catch {
          /* Diagnostic persistence must not block the user flow. */
        }
      }
      if (mutation)
        operation(
          p.op,
          p,
          result?.state === "unknown" ? "unknown" : "confirmed",
          result,
        );
      if (!mutation && p.op === "request") settleOperation(p.requestId, result, p.machineId);
      if (!mutation && p.op === "operation")
        settleOperation(p.operationId, result, p.machineId);
      return { ok: true, result };
    } catch (error) {
      if (mutation)
        operation(
          p.op,
          p,
          !previousPending && [
            "AGENT_BUSY",
            "PROJECT_BUSY",
            "AGENT_NOT_FOUND",
            "AGENT_UNAVAILABLE",
            "INVALID_ANSWER",
            "REVISION_CONFLICT",
            "REQUEST_CONFLICT",
            "NOT_CONFIGURED",
            "CONFIG_NOT_APPLIED",
            "INVALID_VERIFY",
            "VERIFICATION_CONTRACT",
            "INVALID_INPUT",
            "TASK_NOT_FOUND",
            "AGENT_OFFLINE",
            "MACHINE_NOT_FOUND",
            "MACHINE_OFFLINE",
            "WRONG_MACHINE",
            "AUTH_REQUIRED",
            "PROJECT_SOURCE_OFFLINE",
            "REQUEST_ID_REQUIRED",
            "IDEMPOTENCY_CONFLICT",
            "AGENT_DISABLED",
            "INVALID_MESSAGE",
            "CONVERSATION_NOT_FOUND",
            "CONVERSATION_UNBOUND",
            "CONVERSATION_BINDING",
            "CONVERSATION_CONFIG",
            "CONVERSATION_LIMIT",
            "CONVERSATION_BUSY",
            "AGENT_UNHEALTHY",
            "STALE_TASK",
            "NODE_NOT_FOUND",
            "NODE_DISCONNECTED",
            "ADAPTER_UNSUPPORTED",
            "WORKSPACE_UNAVAILABLE",
            "DISCOVERY_CHANGED",
            "COLLABORATION_FORBIDDEN",
            "TOOL_LAUNCHER",
          ].includes(error.code)
            ? "rejected"
            : "unknown",
          { error: { code: error.code || "DESKTOP_ERROR", message: error.message || "操作未完成" } },
        );
      throw error;
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        code: error.code || "DESKTOP_ERROR",
        message: error.message || "操作未完成",
      },
    };
  }
}
function savePreferences(value) {
  if (
    !value ||
    !["light", "dark", "system"].includes(value.theme) ||
    typeof value.distribution !== "string" ||
    typeof value.directory !== "string" ||
    value.directory.length > 1000 ||
    value.distribution.length > 100
  )
    throw new Error("设置不合法");
  const previous = settings();
  if (
    (previous.distribution !== value.distribution ||
      previous.directory !== value.directory) &&
    read("pending.json", []).some((r) =>
      ["pending", "unknown"].includes(r.state),
    )
  )
    throw new Error("请先查询原操作，再切换运行环境或实例。主题仍可调整。");
  write("desktop.json", {
    theme: value.theme,
    distribution: value.distribution,
    directory: value.directory,
  });
  if (
    previous.distribution !== value.distribution ||
    previous.directory !== value.directory
  ) {
    // Selecting a different machine must retain other machine channels.
    if (previous.directory !== value.directory) {
      for (const machine of host?.catalog.machines || []) {
        if (machine.kind === "wsl" && (!value.distribution || machine.distribution === value.distribution)) {
          host.hosts.get(machine.machineId)?.close();
          host.hosts.delete(machine.machineId);
        }
      }
    }
  }
  return settings();
}

return { call, pending: () => read('pending.json', []).filter(r => ['pending','unknown'].includes(r.state)),
  recoverPending, preferences: () => ({...settings(), platform, version:options.version}), savePreferences,
  runtimes: async () => ({platform,distributions:await distributions()}),
  machines: async () => connection().machines(),
  dispatch(method, params) {
    if (method === 'call') return call(params);
    if (method === 'pending') return this.pending();
    if (method === 'recoverPending') return recoverPending();
    if (method === 'preferences') return this.preferences();
    if (method === 'savePreferences') return savePreferences(params);
    if (method === 'runtimes') return this.runtimes();
    if (method === 'machines') return this.machines();
    throw Object.assign(new Error('后台请求不受支持。'), {code:'COORDINATOR_METHOD'});
  }, close() { ssh?.close(); host?.close(); }
};
}
module.exports = {createCoordinatorService, mergeSshState};
