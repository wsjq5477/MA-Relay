// Synthetic renderer API. No native Agent or real profile is used.
function mock(initial) {
  const date = "2026-10-18T00:00:00.000Z";
  const state = {
    snapshotFailure: false,
    remoteOnline: true,
    pendingOriginal: false,
    longNames: false,
    ...initial,
  };
  const calls = [],
    heldConversations = new Set(),
    heldTasks = new Set();
  const conversationWaiters = new Map(),
    taskWaiters = new Map();
  const long = (value) =>
    value + "_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".repeat(5);
  const names = () => ({
    local: state.longNames ? long("LOCAL_MACHINE") : "本机测试机器",
    remote: state.longNames ? long("REMOTE_MACHINE") : "远端测试机器",
    a: state.longNames ? long("ORIGINAL_AGENT_A") : "原节点 A",
    b: state.longNames ? long("INDEPENDENT_AGENT_B") : "独立节点 B",
    remoteNode: state.longNames ? long("REMOTE_AGENT") : "远端节点",
  });
  function machines() {
    const n = names();
    return [
      {
        machineId: "local",
        name: n.local,
        kind: "windows",
        platform: "win32",
        online: true,
      },
      {
        machineId: "remote",
        name: n.remote,
        kind: "ssh",
        platform: "linux",
        online: state.remoteOnline,
        connectionId: "fixture-ssh",
        connectionState: state.remoteOnline ? "online" : "disconnected",
      },
    ];
  }
  function nodes() {
    const n = names();
    return [
      {
        nodeId: "a",
        machineId: "local",
        name: n.a,
        adapter: "claude",
        executable: "C:/fixture/claude-a.exe",
      },
      {
        nodeId: "b",
        machineId: "local",
        name: n.b,
        adapter: "codex",
        executable: "C:/fixture/codex-b.exe",
      },
      {
        nodeId: "remote-agent",
        machineId: "remote",
        name: n.remoteNode,
        adapter: "opencode",
        executable: "/opt/fixture/opencode",
      },
    ].map((n) => ({
      ...n,
      connected: true,
      executionSupported: true,
      online: n.machineId !== "remote" || state.remoteOnline,
      healthy: true,
      available: true,
      busy: false,
      activeTasks: 0,
      version: "fixture-version",
      status: "connected",
      ...(n.nodeId === "a" && state.pendingOriginal
        ? { unconfirmed: 1, uncertain: true }
        : {}),
    }));
  }
  const tasks = [
    {
      taskId: "task-a",
      conversationId: "conversation-a",
      nodeId: "a",
      machineId: "local",
      message: "任务 A 的原始需求",
      result: { message: "A_ONLY_BODY" },
    },
    {
      taskId: "task-b",
      conversationId: "conversation-b",
      nodeId: "b",
      machineId: "local",
      message: "任务 B 的原始需求",
      result: { message: "B_ONLY_BODY" },
    },
    {
      taskId: "task-remote",
      conversationId: "conversation-remote",
      nodeId: "remote-agent",
      machineId: "remote",
      message: "远端任务的原始需求",
      result: { message: "REMOTE_ONLY_BODY" },
    },
  ].map((t) => ({
    ...t,
    executionId: "execution-" + t.taskId,
    requestId: "request-" + t.taskId,
    targetAgent: "instance-" + t.nodeId,
    status: "succeeded",
    createdAt: date,
    updatedAt: date,
    turn: 1,
    lastSummary: "",
    lastSeq: 0,
    events: [],
  }));
  const conversations = tasks.map((t) => ({
    conversationId: t.conversationId,
    nodeId: t.nodeId,
    machineId: t.machineId,
    targetAgent: t.targetAgent,
    title:
      t.nodeId === "a" ? "会话 A" : t.nodeId === "b" ? "会话 B" : "远端会话",
    kind: "task",
    turns: 1,
    updatedAt: date,
    canContinue: true,
    items: [t],
  }));
  let layout = {
    version: 1,
    layoutRevision: 0,
    groups: { local: { x: 0, y: 0 }, remote: { x: 650, y: 0 } },
    nodes: {
      a: { x: 25, y: 110 },
      b: { x: 25, y: 270 },
      "remote-agent": { x: 25, y: 110 },
    },
    viewport: { x: 0, y: 0, zoom: 0.7 },
  };
  const copy = (value) => structuredClone(value);
  function defer(waiters, key, value) {
    return new Promise((resolve) => {
      const list = waiters.get(key) || [];
      list.push({ resolve, value: copy(value) });
      waiters.set(key, list);
    });
  }
  function release(waiters, key, late) {
    const rows = waiters.get(key) || [];
    waiters.delete(key);
    for (const row of rows) row.resolve(late ? late(row.value) : row.value);
    return rows.length;
  }
  function pending() {
    return state.pendingOriginal
      ? [
          {
            id: "original-unresolved",
            op: "submit",
            state: "unknown",
            machineId: "local",
            params: { nodeId: "a", machineId: "local" },
            blockedNodeIds: ["a"],
            time: date,
          },
        ]
      : [];
  }
  window.agentbridge = {
    call: async (method, params = {}) => {
      const entry = {
        method,
        op: params.op,
        conversationId: params.conversationId,
        taskId: params.taskId,
      };
      calls.push(entry);
      if (
        method === "nodeRequest" ||
        method === "team.execute" ||
        method === "manageNode" ||
        (method === "ipc" &&
          ["submit", "continue", "reply", "cancel"].includes(params.op))
      ) {
        entry.businessAttempt = true;
        return {
          ok: false,
          error: {
            code: "MODEL_DISABLED_IN_FIXTURE",
            message: "隔离状态测试禁止执行模型或业务变更。",
          },
        };
      }
      if (method === "snapshot") {
        if (state.snapshotFailure)
          return {
            ok: false,
            error: {
              code: "CONTROLLED_SNAPSHOT_FAILURE",
              message: "受控后台连接失败，保留上次快照。",
            },
          };
        return {
          ok: true,
          result: {
            configured: true,
            directory: "controlled-ui-state-profile",
            nodeManagement: true,
            machineManagement: true,
            daemonManagement: true,
            collaboration: { leaderId: "a", memberIds: ["b"], revision: 1 },
            agents: { items: [], revision: 1, connected: true },
            machines: machines(),
            nodes: nodes(),
            tasks: copy(tasks),
            conversations: copy(conversations),
            instances: [],
            connections: [],
          },
        };
      }
      if (method === "graphLayout") return { ok: true, result: copy(layout) };
      if (method === "graphPending") return { ok: true, result: [] };
      if (method === "saveGraphLayout") {
        layout = {
          ...copy(params.layout),
          layoutRevision: layout.layoutRevision + 1,
        };
        return {
          ok: true,
          result: {
            operationId: params.operationId,
            state: "confirmed",
            data: copy(layout),
          },
        };
      }
      if (method === "ipc" && params.op === "conversation") {
        if(state.conversationFailure===params.conversationId)return {ok:false,error:{code:state.conversationCode||'NOT_FOUND',message:'请先发现并连接 OpenCode'}};

        const value = conversations.find(
          (c) => c.conversationId === params.conversationId,
        );
        if (heldConversations.delete(params.conversationId))
          return {
            ok: true,
            result: await defer(
              conversationWaiters,
              params.conversationId,
              value,
            ),
          };
        return { ok: true, result: copy(state.historical&&params.op==='conversation'?{...value,historical:true,canContinue:false}:value) };
      }
      if (method === "ipc" && params.op === "task") {
        if(state.taskFailure===params.taskId)return {ok:false,error:{code:state.taskCode||'NOT_FOUND',message:'请先发现并连接 OpenCode'}};

        const value = tasks.find((t) => t.taskId === params.taskId);
        if (heldTasks.delete(params.taskId))
          return {
            ok: true,
            result: await defer(taskWaiters, params.taskId, value),
          };
        return { ok: true, result: copy(state.historical&&params.op==='conversation'?{...value,historical:true,canContinue:false}:value) };
      }
      if (method === "ipc" && params.op === "pending")
        return { ok: true, result: { permissions: [], forms: [] } };
      return {
        ok: false,
        error: {
          code: "CONTROLLED_UNSUPPORTED_READ",
          message: "状态夹具没有实现该入口：" + method,
        },
      };
    },
    preferences: async () => ({
      theme: "light",
      platform: "win32",
      version: "synthetic-api · 状态夹具",
      distribution: "",
      directory: "",
    }),
    savePreferences: async (value) => value,
    runtimes: async () => ({ platform: "win32", distributions: [] }),
    pending: async () => copy(pending()),
    recoverPending: async () => ({
      resolved: 0,
      remaining: pending().length,
      items: state.pendingOriginal
        ? [
            {
              id: "original-unresolved",
              machineId: "local",
              op: "submit",
              code: "NOT_CONFIGURED",
              reason: "原后台配置尚未就绪，只能核对原请求。",
            },
          ]
        : [],
    }),
    window: async (action) => {
      calls.push({ method: "window", action });
    },
  };
  window.__testControl = {
    calls,
    names,
    nodes,
    setConversationFailure: (id,code='NOT_FOUND')=>{state.conversationFailure=id;state.conversationCode=code;},
    setTaskFailure: (id,code='NOT_FOUND')=>{state.taskFailure=id;state.taskCode=code;},
    setSnapshotFailure: (value) => {
      state.snapshotFailure = value;
    },
    holdConversation: (id) => heldConversations.add(id),
    holdTask: (id) => heldTasks.add(id),
    pendingConversationCount: (id) => conversationWaiters.get(id)?.length || 0,
    pendingTaskCount: (id) => taskWaiters.get(id)?.length || 0,
    releaseConversation: (id) =>
      release(conversationWaiters, id, (value) => ({
        ...value,
        items: value.items.map((t) => ({
          ...t,
          result: { message: "A_ONLY_BODY_LATE" },
        })),
      })),
    releaseTask: (id) =>
      release(taskWaiters, id, (value) => ({
        ...value,
        result: { message: "TASK_A_LATE" },
      })),
  };
}

module.exports={mock};
