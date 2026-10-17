const { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { HostConnection, distributions } = require('./rpc.cjs');
const { ClaudeHost } = require('./claude-host.cjs');
const { AgentNetwork } = require('./agent-network.cjs');
const { MachineHost } = require('./machine-host.cjs');
const { workerRuntime } = require('./worker-runtime.cjs');
const { recoverJournal } = require('./pending-journal.cjs');
const {digest}=require('./graph-layout.cjs');
const { GraphOperationJournal } = require('./graph-operations.cjs');
const teamMethods=new Set(['team.stopRun','team.configureAutomation','team.wake','team.tasks',...require('./team-work.cjs').taskMethods,'team.snapshot','team.operation','team.registerAgent','team.disableAgent','team.createTeam','team.createRun','team.context','team.messages','team.postMessage','team.document','team.writeDocument','team.revokeMember','team.pause','team.closeRun','team.connect','team.execute','team.refresh']);
const machineWrites=new Set(['machine.updateSsh','machine.remove','machine.restore','machine.disconnect','machine.reconnect','machine.maintainDaemon']);
const sshMethods = new Set(['machine.createSshDraft','credential.provide','machine.testSsh','machine.trustHost','machine.connectSsh','machine.reconnect','machine.disconnect','machine.daemonPreview']);
const methods = new Set(['snapshot','discover','ipc','environment','attachNode','manageNode','nodeOperation','nodeRequest','saveCollaboration','collaboration','collaborationOperation','graphLayout','saveGraphLayout','graphLayoutOperation','graphPending','machine.operation',...machineWrites,...sshMethods,...teamMethods]);
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
  let host, ssh=options.ssh;
  let teams,teamBroker,teamEngine,teamTimer,teamReady=Promise.resolve();
  const teamInvocation=Symbol('teamInvocation');
  const graphJournal=new GraphOperationJournal(options.directory);
  async function teamRead(params){
    const reply=await call({method:'ipc',params});
    if(!reply.ok)throw Object.assign(Error('原执行或控制收据尚无法核对。'),{code:reply.error.code});
    return reply.result;
  }
  function teamService(){
    if(teams)return teams;
    const {TeamSpace}=require('./team-space.cjs');
    const {CollaborationBroker}=require('./collaboration-broker.cjs');
    teamBroker=new CollaborationBroker(resolve(options.directory,'team-connections'),(scope,name,args)=>teamService().tool(scope.teamSessionId,name,args));
    teams=new TeamSpace({directory:options.directory,
      validateNode:nodeId=>{const n=connection().node(nodeId);if(!n.connected||n.removed||!n.executionSupported)throw Object.assign(Error('请先接入一个支持执行的原生节点。'),{code:'TEAM_NODE'});return n;},
      configure:session=>teamBroker.configure('team-'+session.sessionId,{teamSessionId:session.sessionId,nodeId:'external',parentRequestId:session.sessionId}),
      execute:async attempt=>{
        const reply=await call({method:'nodeRequest',params:{op:attempt.resumeConversationId?'continue':'submit',...(attempt.resumeConversationId?{conversationId:attempt.resumeConversationId}:{}),nodeId:attempt.nodeId,requestId:attempt.requestId,message:attempt.message,teamScope:attempt.teamScope},[teamInvocation]:true});
        if(!reply.ok){const row=read('pending.json',[]).find(r=>r.id===attempt.requestId);throw Object.assign(Error(reply.error.message),{code:reply.error.code,executionNotDispatched:row?.state==='rejected'||!row});}
        return reply.result;
      },
      conversation:attempt=>{const n=connection().node(attempt.nodeId);return connection().call('ipc',{op:'conversation',machineId:n.machineId,conversationId:attempt.conversationId});},
      query:attempt=>{const n=connection().node(attempt.nodeId);return teamRead({op:'request',machineId:n.machineId,requestId:attempt.requestId});},
      cancel:async attempt=>{
        const n=connection().node(attempt.nodeId);
        const reply=await call({method:'ipc',params:{op:'cancel',machineId:n.machineId,taskId:attempt.cancellation.taskId,operationId:attempt.cancellation.operationId}});
        if(!reply.ok)throw Object.assign(Error('原取消操作尚未确认，请查询原操作。'),{code:reply.error.code});
        return reply.result;
      },
      cancellation:attempt=>{const n=connection().node(attempt.nodeId);return teamRead({op:'operation',machineId:n.machineId,taskId:attempt.cancellation.taskId,operationId:attempt.cancellation.operationId});}
    });
    teamEngine=new (require('./team-automation.cjs').TeamAutomation)(teams);
    teamTimer=setInterval(()=>{void teamReady.then(()=>teamEngine.tick()).catch(()=>{});},options.teamTickMs||2000);teamTimer.unref?.();
    teamReady=teams.restoreConnections();
    void teamReady.catch(()=>{});
    return teams;
  }
function dataFile(name) {
  const folder = options.directory;
  mkdirSync(folder, { recursive: true });
  return resolve(folder, name);
}
const payloadDigest=params=>digest({...params,machineId:undefined});
function journalParams(params){
  if(params?.op!=='reply'||params.reply?.action!=='form')return params;
  return {...params,reply:{...params.reply,answer:Object.fromEntries(Object.keys(params.reply.answer||{}).map(key=>[key,'[redacted]']))}};
}
function journalResult(row,result){return row.op==='reply'&&row.params.reply?.action==='form'?{operationId:result?.operationId,state:result?.state,data:{redacted:true}}:result;}
function read(name, fallback) {
  try {
    const value=JSON.parse(readFileSync(dataFile(name),"utf8"));
    if(name==='pending.json'&&Array.isArray(value)){let changed=false;for(const row of value)if(row.op==='reply'&&row.params?.reply?.action==='form'&&!row.payloadFingerprint){row.payloadFingerprint=payloadDigest(row.params);row.params=journalParams(row.params);if(row.result)row.result=journalResult(row,row.result);changed=true;}if(changed)write(name,value);}
    return value;
  } catch(error) {
    if(name==='pending.json'&&error.code!=='ENOENT')throw Object.assign(Error('原操作台账无法读取或保存，保留占位并停止新提交。'),{code:'DESKTOP_JOURNAL_INVALID'});
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
    onSnapshot:(machineId,snapshot)=>{const machine=host.machine(machineId);host.importSnapshot(machine,snapshot);host.cache.set(machineId,snapshot);host.retryAfter.delete(machineId);},
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
    params:journalParams(params),
    payloadFingerprint:payloadDigest(params),
    machineId: params.machineId,
    state,
    time: new Date().toISOString(),
    ...(result ? {result:journalResult({op:name,params},result)} : {}),
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
  if(['cancel','reply'].includes(row.op)){
    if(result?.operationId!==id||!['confirmed','rejected'].includes(result.state))return;
    const receivedTask=result.taskId||result.data?.taskId,originalTask=row.params.taskId||row.params.reply?.taskId;
    if(receivedTask&&receivedTask!==originalTask)return;
  }else if(!result?.taskId||result.requestId!==id||(result.machineId&&result.machineId!==machineId))return;
  row.state = ["unknown","rejected"].includes(result?.state) ? result.state : "confirmed";
  row.result = journalResult(row,result);
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
      if (['original undispatched node intent and rejection verified','original undispatched node intent and runtime rejection verified'].includes(result?.reconciliation)
        && !connection().undispatchedRejection?.(row)) return false;
      Object.assign(row, { state, result:journalResult(row,result), reconciledAt: new Date().toISOString() });
      write("pending.json", rows);
      return true;
    }, row => connection().machine(row.machineId).kind === "wsl",
    row => connection().undispatchedRejection?.(row)
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
    connection().options??={};
    connection().options.teamTool=(scope,name,args,sourceMachine)=>teamService().nativeTool(scope,name,args,sourceMachine);
    if(input.params.teamScope&&input[teamInvocation]!==true)throw Object.assign(Error('小队执行身份必须由后台派生。'),{code:'TEAM_FORBIDDEN'});
    if(teamMethods.has(input.method)){const service=teamService();await teamReady;return {ok:true,result:await service.call(input.method,input.params)};}
    connection().options.admissionCheck=machine=>{if(graphJournal.pending().some(r=>r.lane==='machine'&&r.params.machineId===machine.machineId))throw Object.assign(Error('原机器维护尚未确认，请查询原操作。'),{code:'DESKTOP_UNCONFIRMED'});};
    connection().options.executionAdmissionCheck=(machine,instance,params)=>{
      if(params.teamScope)teamService().admit(params.teamScope,instance.nodeId);
      if(read('pending.json',[]).some(row=>['pending','unknown'].includes(row.state)&&
        connection().pendingBlocks?.(row,{machineId:machine.machineId,agentId:instance.instanceId})&&
        !(row.id===journalKey(params)&&row.machineId===machine.machineId)))throw Object.assign(Error('这个执行资源有未确认操作，请查询原请求；独立节点仍可使用。'),{code:'DESKTOP_UNCONFIRMED',executionNotDispatched:true});
    };
    const machineDispatch=async(method,params)=>{
      if(!ssh)throw Object.assign(Error('当前后台未启用 SSH 连接管理。'),{code:'INVALID_INPUT'});
      if(method==='machine.operation'){
        const receipt=await ssh.call(method,params);
        const result=connection().finalizeMachine(receipt);
        if(result.state==='confirmed'&&result.data?.action==='reconnect')await ssh.resumeConnection(result.data.connectionId,result.data.revision);
        return result;
      }
      const c=ssh.find(params),machineId=c.machineId;
      if(machineId&&connection().machineLocks.has(machineId))throw Object.assign(Error('机器连接正在变更。'),{code:'MACHINE_BUSY'});
      if(machineId)connection().machineLocks.add(machineId);
      try{
        // Reconnect restores observations, so it remains available for unknown work.
        if(!['machine.reconnect','machine.restore'].includes(method)&&machineId){
          if(read('pending.json',[]).some(r=>['pending','unknown'].includes(r.state)&&(!r.machineId||r.machineId===machineId)))throw Object.assign(Error('来源机器有未确认操作，请查询原请求。'),{code:'DESKTOP_UNCONFIRMED'});
          const state=await connection().snapshot();
          const machine=state.machines.find(m=>m.machineId===machineId);
          const busy=state.tasks.some(t=>t.machineId===machineId&&!['succeeded','failed','cancelled'].includes(t.status))||state.nodes.some(n=>n.machineId===machineId&&(n.busy||n.unconfirmed||connection().nodeJobs.has(n.nodeId)))||state.instances.some(i=>i.machineId===machineId&&(i.busy||i.currentTask&&!['succeeded','failed','cancelled'].includes(i.currentTask.status)))||connection().catalog.instances.some(i=>i.machineId===machineId&&(connection().nodeJobs.has(i.nodeId)||connection().locks.has(require('./machine-router.cjs').workspaceKey(machine,i.workspace||''))));
          if(busy)throw Object.assign(Error('机器有运行、等待或未知任务，请先核对原执行。'),{code:'MACHINE_BUSY'});
          if(!machine.online)throw Object.assign(Error('先重新连接并核对原执行，再编辑或移除机器。'),{code:'MACHINE_OFFLINE'});
        }
        const receipt=await ssh.call(method,params);const result=connection().finalizeMachine(receipt);
        if(result.data?.action==='reconnect')await ssh.resumeConnection(result.data.connectionId,result.data.revision);
        return result;
      }finally{if(machineId)connection().machineLocks.delete(machineId);}
    };
    const graphDispatch=(method,params)=>method.startsWith('machine.')?machineDispatch(method,params):connection().call(method,params);
    if(input.method==='machine.operation')return {ok:true,result:await graphJournal.lookup(input.method,input.params,graphDispatch)};
    if(machineWrites.has(input.method)){
      if(!ssh)throw Object.assign(Error('当前后台未启用 SSH 连接管理。'),{code:'INVALID_INPUT'});
      const c=ssh.find(input.params);
      if(input.params.machineId&&input.params.machineId!==c.machineId)throw Object.assign(Error('连接不属于这台机器。'),{code:'WRONG_MACHINE'});
      if(input.method==='machine.updateSsh'){
        const config=input.params.config;
        if(!config||typeof config!=='object'||Object.keys(config).some(k=>!['name','host','port','username','authKind','keyPath'].includes(k)))throw Object.assign(Error('连接配置只接受地址、用户和认证方式；凭据请使用专用入口。'),{code:'INVALID_INPUT'});
        input={...input,params:{...input.params,config:require('./ssh-host.cjs').validateDraft(config)}};
      }
      if(input.method==='machine.maintainDaemon'){const config=input.params.config;if(!config||Object.keys(config).some(k=>!['action','previewId','expectedVersion','targetVersion'].includes(k)))throw Object.assign(Error('后台维护只接受动作与可信版本摘要。'),{code:'INVALID_INPUT'});}else if(input.method!=='machine.updateSsh'&&input.params.config)throw Object.assign(Error('该机器操作不接受配置字段。'),{code:'INVALID_INPUT'});
      const params={...input.params,connectionId:c.connectionId,...(c.machineId?{machineId:c.machineId}:{}),operationId:input.params.operationId||require('node:crypto').randomUUID(),expectedRevision:input.params.expectedRevision??c.revision};
      return {ok:true,result:await graphJournal.save(input.method,params,graphDispatch)};
    }
    if (sshMethods.has(input.method)) return {ok: true, result: await ssh.call(input.method, input.params)};
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
    if(mutation&&graphJournal.pending().some(r=>r.lane==='machine'&&r.params.machineId===p.machineId))throw Object.assign(Error('原机器维护尚未确认，请查询原操作。'),{code:'DESKTOP_UNCONFIRMED'});
    const previousPending = mutation && read("pending.json", []).find(r =>
      r.id === journalKey(p) && r.machineId === p.machineId && ["pending", "unknown"].includes(r.state));
    if (previousPending && (previousPending.payloadFingerprint||payloadDigest(previousPending.params)) !== payloadDigest(p))
      throw Object.assign(new Error("原请求的回应尚未确认，不能用相同 ID 替换内容；请先核对原请求。"), { code: "DESKTOP_UNCONFIRMED" });
    if (mutation && !journalKey(p))
      throw new Error("提交或控制前必须保存请求 ID");
    if (
      mutation &&
      read("pending.json", []).some(
        (r) =>
          ["pending", "unknown"].includes(r.state) && !(r.id === journalKey(p)&&r.machineId===p.machineId)
            && (connection().pendingBlocks ? connection().pendingBlocks(r,p) : !r.machineId || r.machineId === p.machineId),
      )
    )
      throw Object.assign(
        new Error(
          "这个执行资源有操作的回应尚未确认，请先在设置中查询原操作；独立节点仍可使用。",
        ),
        { code: "DESKTOP_UNCONFIRMED" },
      );
    if (mutation) operation(p.op, p, "pending");
    try {
      const result = await connection().call(input.method, p);
      if (input.method === 'snapshot' && ssh) {
        result.machineManagement=true;result.daemonManagement=true;
        const states = ssh.states();
        result.machines = result.machines.map(machine => ({...mergeSshState({...machine}, states.find(s => s.machineId === machine.machineId), true),busy:result.tasks.some(t=>t.machineId===machine.machineId&&!['succeeded','failed','cancelled'].includes(t.status))||result.nodes.some(n=>n.machineId===machine.machineId&&n.busy)||read('pending.json',[]).some(r=>['pending','unknown'].includes(r.state)&&(!r.machineId||r.machineId===machine.machineId))}));
        for (const draft of states.filter(s => !s.machineId)) result.machines.push({...draft, machineId: 'draft-' + draft.connectionId, kind:'ssh', platform:'linux', online:false});
      }
      if (input.method === "snapshot") {
        result.teamSpaceSupported=true;
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
      const runtimeRejection = mutation && input.method === 'nodeRequest' && !previousPending
        && connection().undispatchedRejection?.({id:journalKey(p),op:p.op,machineId:p.machineId,params:p,result:{error:{code:error.code}}});
      if (mutation)
        operation(
          p.op,
          p,
          runtimeRejection || !previousPending && [
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

if(existsSync(resolve(options.directory,'team-space.sqlite')))teamService();
return { call, pending: () => read('pending.json', []).filter(r => ['pending','unknown'].includes(r.state)).map(row=>({
    ...row,...(connection().pendingBlocks?{blockedNodeIds:connection().network.nodes.filter(node=>connection().pendingBlocks(row,{nodeId:node.nodeId,machineId:node.machineId})).map(node=>node.nodeId)}:{})
  })),
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
  }, close() { clearInterval(teamTimer);teamEngine?.close();teamBroker?.close();teams?.close();ssh?.close(); host?.close(); }
};
}
module.exports = {createCoordinatorService, mergeSshState};
