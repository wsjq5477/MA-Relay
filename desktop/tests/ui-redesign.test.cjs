const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");

// Use the renderer's JSX configuration and its own React installation. These
// tests render production components without a window, IPC bridge or model.
process.env.TSX_TSCONFIG_PATH = path.resolve(__dirname, "../tsconfig.json");
const desktopRequire = createRequire(
  path.resolve(__dirname, "../package.json"),
);
const React = desktopRequire("react");
const { renderToStaticMarkup } = desktopRequire("react-dom/server");
const { require: requireTsx } = require("tsx/cjs/api");
const MachineInventory = requireTsx(
  "../src/MachineInventory.tsx",
  __filename,
).default;
const { ConversationsPage, SettingsPage, TasksPage } = requireTsx(
  "../src/WorkspacePages.tsx",
  __filename,
);

const noop = () => {};
const timestamp = "2026-10-17T08:00:00.000Z";
const render = (Component, props) =>
  renderToStaticMarkup(React.createElement(Component, props));
const plainText = (html) =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

function buttons(html) {
  return Array.from(
    html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g),
    (match) => ({
      attributes: match[1],
      html: match[2],
      text: plainText(match[2]),
      disabled: /(?:^|\s)disabled(?:\s|=|$)/.test(match[1]),
    }),
  );
}

function buttonNamed(html, label) {
  const matches = buttons(html).filter((button) => button.text === label);
  assert.equal(
    matches.length,
    1,
    `Expected exactly one button named "${label}"`,
  );
  return matches[0];
}

function nodeArticle(html, name) {
  const articles = Array.from(
    html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g),
  );
  const matches = articles.filter((match) =>
    match[1].includes(`aria-label="${name} ·`),
  );
  assert.equal(matches.length, 1, `Expected exactly one article for ${name}`);
  return matches[0][2];
}

function conversationChoices(html) {
  const list = html.match(
    /<aside\b[^>]*aria-label="会话列表"[^>]*>([\s\S]*?)<\/aside>/,
  );
  assert.ok(list, "The conversation list must retain an accessible name");
  return buttons(list[1]);
}

function machine(overrides = {}) {
  return {
    machineId: "machine-a",
    name: "测试机器 A",
    kind: "ssh",
    platform: "linux",
    online: true,
    connectionId: "connection-a",
    connectionState: "online",
    ...overrides,
  };
}

function node(overrides = {}) {
  return {
    nodeId: "node-a",
    machineId: "machine-a",
    adapter: "claude",
    name: "测试 Agent A",
    executable: "/opt/test-agent",
    version: "test-version",
    connected: true,
    online: true,
    healthy: true,
    busy: false,
    available: true,
    executionSupported: true,
    activeTasks: 0,
    status: "connected",
    ...overrides,
  };
}

function task(overrides = {}) {
  return {
    taskId: "task-a",
    executionId: "execution-a",
    conversationId: "conversation-a",
    targetAgent: "agent-a",
    requestId: "request-a",
    machineId: "machine-a",
    nodeId: "node-a",
    message: "检查交付内容",
    status: "succeeded",
    createdAt: timestamp,
    updatedAt: timestamp,
    lastSummary: "",
    lastSeq: 0,
    turn: 1,
    ...overrides,
  };
}

function conversation(overrides = {}) {
  return {
    conversationId: "conversation-a",
    machineId: "machine-a",
    nodeId: "node-a",
    title: "正常会话",
    targetAgent: "agent-a",
    turns: 1,
    updatedAt: timestamp,
    kind: "task",
    canContinue: true,
    items: [task()],
    ...overrides,
  };
}

function inventoryProps(overrides = {}) {
  return {
    machines: [machine()],
    nodes: [node()],
    relation: { leaderId: null, memberIds: [], revision: 1 },
    filter: "all",
    query: "",
    busy: false,
    metadataBusy: false,
    managementSupported: true,
    machineManagementSupported: true,
    daemonManagementSupported: true,
    blocked: () => false,
    start: noop,
    attach: noop,
    nodeAction: noop,
    addAgent: noop,
    machineAction: noop,
    ...overrides,
  };
}

function conversationsProps(overrides = {}) {
  const selected = conversation();
  return {
    conversations: [selected],
    selected,
    showChecks: false,
    onShowChecks: noop,
    machineName: () => "测试机器 A",
    nodeFor: () => node(),
    onOpen: noop,
    onTask: noop,
    onNew: noop,
    followup: "继续检查",
    onFollowup: noop,
    onSend: noop,
    busy: false,
    blocked: () => false,
    ...overrides,
  };
}

function settingsProps(overrides = {}) {
  return {
    preferences: {
      theme: "system",
      distribution: "",
      directory: "",
      version: "test-version",
    },
    onTheme: noop,
    directory: "/test/bridge-data",
    machines: [machine()],
    nodes: [node()],
    journal: [],
    recoveryItems: [],
    machineName: (id) => (id === "machine-a" ? "测试机器 A" : "测试机器 B"),
    busy: false,
    managementLocked: false,
    machineManagementSupported: true,
    onRestore: noop,
    onCloseWindow: noop,
    onStop: noop,
    querying: false,
    onQuery: noop,
    ...overrides,
  };
}

test("inventory keeps an unknown operation scoped to its node while an independent node remains usable", () => {
  const unknown = node({
    name: "待核对 Agent",
    nodeId: "node-unknown",
    unconfirmed: 1,
  });
  const independent = node({ name: "独立 Agent", nodeId: "node-independent" });
  const html = render(
    MachineInventory,
    inventoryProps({
      nodes: [unknown, independent],
      blocked: (_machineId, nodeId) => nodeId === unknown.nodeId,
    }),
  );
  const unknownRow = nodeArticle(html, unknown.name);
  assert.equal(buttonNamed(unknownRow, "开始会话").disabled, true);
  assert.match(plainText(unknownRow), /原执行待核对/);
  assert.match(plainText(unknownRow), /原操作待核对/);
  assert.equal(
    buttonNamed(nodeArticle(html, independent.name), "开始会话").disabled,
    false,
  );
});

test("inventory respects a shared coordination execution lock even when every node is available", () => {
  const available = [
    node({ name: "可用主 Agent", nodeId: "leader" }),
    node({ name: "可用独立 Agent", nodeId: "independent" }),
  ];
  const html = render(
    MachineInventory,
    inventoryProps({
      nodes: available,
      executionLocked: true,
      relation: { leaderId: "leader", memberIds: [], revision: 1 },
    }),
  );
  for (const item of available) {
    assert.equal(
      buttonNamed(nodeArticle(html, item.name), "开始会话").disabled,
      true,
      item.name,
    );
  }
});

test("inventory does not expose a usable execution action when its prerequisite is missing", async (t) => {
  for (const [scenario, overrides] of [
    ["node offline", { online: false }],
    ["tool unhealthy", { healthy: false }],
    [
      "execution unsupported",
      { executionSupported: false, status: "unsupported" },
    ],
    ["node busy", { busy: true }],
    ["native permission or input waiting", { waiting: true }],
    ["unconfirmed execution count", { unconfirmed: 1 }],
    ["uncertain native execution", { uncertain: true }],
    ["not currently available", { available: false }],
  ]) {
    await t.test(scenario, () => {
      const html = render(
        MachineInventory,
        inventoryProps({ nodes: [node(overrides)] }),
      );
      assert.equal(
        buttonNamed(nodeArticle(html, "测试 Agent A"), "开始会话").disabled,
        true,
      );
    });
  }
  for (const [scenario, overrides] of [
    ["machine offline", { machines: [machine({ online: false })] }],
    ["global execution busy", { busy: true }],
    [
      "pending resource with no uncertainty projection",
      { blocked: () => true },
    ],
  ]) {
    await t.test(scenario, () => {
      const html = render(MachineInventory, inventoryProps(overrides));
      assert.equal(
        buttonNamed(nodeArticle(html, "测试 Agent A"), "开始会话").disabled,
        true,
      );
    });
  }
});

test("inventory separates connection permission from existing node execution capability", () => {
  const connected = node({ nodeId: "connected", name: "已接入 Agent" });
  const discovered = node({
    nodeId: "discovered",
    name: "待接入 Agent",
    connected: false,
    status: "discovered",
  });
  const enabled = render(
    MachineInventory,
    inventoryProps({ nodes: [connected, discovered] }),
  );
  assert.equal(
    buttonNamed(nodeArticle(enabled, connected.name), "开始会话").disabled,
    false,
  );
  assert.equal(
    buttonNamed(nodeArticle(enabled, discovered.name), "接入").disabled,
    false,
  );
  assert.equal(
    buttons(nodeArticle(enabled, discovered.name)).some(
      (button) => button.text === "开始会话",
    ),
    false,
  );

  const legacy = render(
    MachineInventory,
    inventoryProps({
      nodes: [connected, discovered],
      managementSupported: false,
    }),
  );
  assert.equal(
    buttonNamed(nodeArticle(legacy, discovered.name), "接入").disabled,
    true,
  );
  assert.equal(
    buttonNamed(nodeArticle(legacy, connected.name), "断开 Agent").disabled,
    true,
  );
  assert.equal(
    buttonNamed(nodeArticle(legacy, connected.name), "开始会话").disabled,
    false,
  );
});

test("inventory disables attach and SSH maintenance actions while management is locked or unsupported", async (t) => {
  for (const [scenario, overrides] of [
    ["metadata mutation in progress", { metadataBusy: true }],
    ["node management unsupported", { managementSupported: false }],
    ["resource pending", { blocked: () => true }],
    ["tool unhealthy", { nodes: [node({ connected: false, healthy: false })] }],
    [
      "execution unsupported",
      { nodes: [node({ connected: false, executionSupported: false })] },
    ],
    ["node offline", { nodes: [node({ connected: false, online: false })] }],
    ["node already busy", { nodes: [node({ connected: false, busy: true })] }],
  ]) {
    await t.test(scenario, () => {
      const html = render(
        MachineInventory,
        inventoryProps({
          nodes: [node({ connected: false })],
          ...overrides,
        }),
      );
      assert.equal(
        buttonNamed(nodeArticle(html, "测试 Agent A"), "接入").disabled,
        true,
      );
    });
  }
  const unsupported = render(
    MachineInventory,
    inventoryProps({
      machineManagementSupported: false,
      daemonManagementSupported: false,
    }),
  );
  for (const label of ["编辑连接", "移除机器", "后台维护"]) {
    assert.equal(buttonNamed(unsupported, label).disabled, true, label);
  }
  const active = render(
    MachineInventory,
    inventoryProps({ machines: [machine({ busy: true })] }),
  );
  for (const label of ["断开连接", "编辑连接", "移除机器", "后台维护"]) {
    assert.equal(buttonNamed(active, label).disabled, true, label);
  }
});

test("conversation continuation requires a current, settled, connected, supported original context", async (t) => {
  for (const [scenario, selectedOverrides, propOverrides] of [
    ["historical snapshot", { historical: true }, {}],
    ["queued turn", { items: [task({ status: "queued" })] }, {}],
    ["accepted turn", { items: [task({ status: "accepted" })] }, {}],
    ["running turn", { items: [task({ status: "running" })] }, {}],
    ["unknown turn", { items: [task({ status: "unknown" })] }, {}],
    [
      "backend rejects continuation",
      { canContinue: false, continuationReason: "原生上下文不能续接" },
      {},
    ],
    ["continuation capability absent", { canContinue: undefined }, {}],
    ["missing original turn", { items: [] }, {}],
    [
      "source node disconnected",
      {},
      { nodeFor: () => node({ connected: false }) },
    ],
    ["source node removed", {}, { nodeFor: () => node({ removed: true }) }],
    [
      "source node offline but still attached",
      {},
      { nodeFor: () => node({ online: false }) },
    ],
    ["source node missing", {}, { nodeFor: () => undefined }],
    ["original resource pending", {}, { blocked: () => true }],
    ["backend or coordination execution locked", {}, { executionLocked: true }],
    ["send already in progress", {}, { busy: true }],
    ["empty followup", {}, { followup: "   " }],
  ]) {
    await t.test(scenario, () => {
      const selected = conversation(selectedOverrides);
      const html = render(
        ConversationsPage,
        conversationsProps({
          selected,
          conversations: [selected],
          ...propOverrides,
        }),
      );
      assert.equal(buttonNamed(html, "发送").disabled, true);
    });
  }
});

test("conversation continuation remains available after an actual terminal turn when backend allows it", async (t) => {
  for (const status of ["succeeded", "failed", "cancelled"]) {
    await t.test(status, () => {
      const selected = conversation({ items: [task({ status })] });
      const html = render(
        ConversationsPage,
        conversationsProps({ selected, conversations: [selected] }),
      );
      assert.equal(buttonNamed(html, "发送").disabled, false);
    });
  }
});

test("conversation explains a shared execution lock and an offline source without inviting a resend", () => {
  const locked = render(
    ConversationsPage,
    conversationsProps({ executionLocked: true }),
  );
  assert.equal(buttonNamed(locked, "发送").disabled, true);
  assert.match(plainText(locked), /恢复后台连接或核对原授权/);
  const offline = render(
    ConversationsPage,
    conversationsProps({ nodeFor: () => node({ online: false }) }),
  );
  assert.equal(buttonNamed(offline, "发送").disabled, true);
  assert.match(plainText(offline), /来源机器离线/);
});

test("changing the machine scope hides the previous reader and composer while preserving the original conversation", () => {
  const original = conversation({
    title: "只属于机器 A 的会话",
    items: [task({ result: { message: "原机器 A 的保留结果" } })],
  });
  const other = conversation({
    conversationId: "conversation-b",
    machineId: "machine-b",
    title: "机器 B 的会话",
  });
  const props = conversationsProps({
    selected: original,
    conversations: [other],
  });
  const hidden = render(ConversationsPage, props);
  assert.match(plainText(hidden), /机器 B 的会话/);
  assert.match(plainText(hidden), /选择或新建一个会话/);
  assert.doesNotMatch(
    hidden,
    /只属于机器 A 的会话|原机器 A 的保留结果|<textarea\b/,
  );
  assert.equal(
    buttons(hidden).some((button) => button.text === "发送"),
    false,
  );

  const restored = render(ConversationsPage, {
    ...props,
    conversations: [original],
  });
  assert.match(plainText(restored), /原机器 A 的保留结果/);
  assert.equal(buttonNamed(restored, "发送").disabled, false);
  assert.equal(original.conversationId, "conversation-a");
  assert.equal(original.items[0].requestId, "request-a");
});

test("hiding verification records also hides the selected reader without replacing its identity", () => {
  const original = conversation({
    conversationId: "verification-original",
    kind: "verification",
    items: [
      task({ verification: true, result: { message: "已保留的原验证结果" } }),
    ],
  });
  const props = conversationsProps({
    selected: original,
    conversations: [original],
  });
  const hidden = render(ConversationsPage, props);
  assert.match(plainText(hidden), /选择或新建一个会话/);
  assert.doesNotMatch(
    hidden,
    /已保留的原验证结果|这是连接验证记录|<textarea\b/,
  );
  const restored = render(ConversationsPage, { ...props, showChecks: true });
  assert.match(plainText(restored), /已保留的原验证结果/);
  assert.match(plainText(restored), /这是连接验证记录/);
  assert.doesNotMatch(restored, /<textarea\b/);
  assert.equal(original.conversationId, "verification-original");
});

test("conversation explains recovery and capability restrictions instead of inviting a resend", () => {
  const blocked = render(
    ConversationsPage,
    conversationsProps({ blocked: () => true }),
  );
  assert.match(plainText(blocked), /未确认操作，请查询原请求/);
  assert.match(plainText(blocked), /其他可用 Agent 开始独立会话/);
  const selected = conversation({
    canContinue: false,
    continuationReason: "测试原生上下文拒绝续接原因",
  });
  const unsupported = render(
    ConversationsPage,
    conversationsProps({ selected }),
  );
  assert.match(plainText(unsupported), /测试原生上下文拒绝续接原因/);
  assert.equal(buttonNamed(unsupported, "发送").disabled, true);
});

test("verification records stay out of the normal list until explicitly included", () => {
  const normal = conversation();
  const byKind = conversation({
    conversationId: "check-kind",
    kind: "verification",
    title: "内部验证标题",
  });
  const byTask = conversation({
    conversationId: "check-task",
    kind: undefined,
    items: [task({ verification: true })],
  });
  const legacy = conversation({
    conversationId: "check-legacy",
    kind: undefined,
    title: "只回复标记 AB_VERIFY_TEST_ONLY",
    items: undefined,
  });
  const all = [normal, byKind, byTask, legacy];
  const hidden = render(
    ConversationsPage,
    conversationsProps({ conversations: all, selected: normal }),
  );
  assert.equal(conversationChoices(hidden).length, 1);
  assert.match(conversationChoices(hidden)[0].text, /正常会话/);
  const shown = render(
    ConversationsPage,
    conversationsProps({
      conversations: all,
      selected: normal,
      showChecks: true,
    }),
  );
  assert.equal(conversationChoices(shown).length, 4);
  assert.equal(
    conversationChoices(shown).filter((button) =>
      button.text.startsWith("连接验证"),
    ).length,
    3,
  );
  assert.doesNotMatch(shown, /AB_VERIFY_TEST_ONLY|内部验证标题/);
});

test("a selected verification record has no followup form even with terminal status and native continuation", () => {
  const selected = conversation({
    kind: "verification",
    items: [
      task({ verification: true, message: "只回复标记 AB_VERIFY_TEST_ONLY" }),
    ],
  });
  const html = render(
    ConversationsPage,
    conversationsProps({
      selected,
      conversations: [selected],
      showChecks: true,
    }),
  );
  assert.doesNotMatch(html, /<textarea\b/);
  assert.equal(
    buttons(html).some((button) => button.text === "发送"),
    false,
  );
  assert.match(plainText(html), /这是连接验证记录。请新建会话发送实际需求。/);
  assert.doesNotMatch(html, /AB_VERIFY_TEST_ONLY/);
});

test("task board preserves waiting and unknown execution without presenting receipt acceptance as completion", () => {
  const waiting = task({
    status: "running",
    message: "等待原生权限的任务",
    waiting: {
      kind: "permission",
      summary: "等待批准",
      requestIds: ["permission-test"],
    },
    lastSummary: "控制请求已接收，仍等待原生终态",
  });
  const unknown = task({
    taskId: "task-unknown",
    status: "unknown",
    message: "原结果待核对的任务",
  });
  const html = render(TasksPage, {
    tasks: [waiting, unknown],
    machineName: () => "测试机器 A",
    nodeFor: () => node(),
    onOpen: noop,
    onNew: noop,
  });
  const waitingCard = buttons(html).find((button) =>
    button.text.includes(waiting.message),
  );
  const unknownCard = buttons(html).find((button) =>
    button.text.includes(unknown.message),
  );
  assert.ok(waitingCard);
  assert.ok(unknownCard);
  assert.match(waitingCard.text, /进行中/);
  assert.match(waitingCard.text, /等待你处理/);
  assert.match(unknownCard.text, /结果待核对/);
  assert.doesNotMatch(waitingCard.text + unknownCard.text, /已完成|已取消/);
});

test("settings matches original recovery identity across machines and retains its reason and code", () => {
  const html = render(
    SettingsPage,
    settingsProps({
      journal: [
        {
          id: "original-operation",
          machineId: "machine-a",
          op: "continue",
          time: timestamp,
        },
      ],
      recoveryItems: [
        {
          id: "original-operation",
          machineId: "machine-b",
          code: "WRONG_MACHINE",
          reason: "其他机器的诊断不得误配",
        },
        {
          id: "original-operation",
          machineId: "machine-a",
          code: "PENDING_ORIGINAL_REQUEST",
          reason: "来源仍待核对，保留原请求占位",
        },
      ],
    }),
  );
  assert.match(plainText(html), /来源仍待核对，保留原请求占位/);
  assert.match(plainText(html), /PENDING_ORIGINAL_REQUEST/);
  assert.match(plainText(html), /执行资源继续保留占位/);
  assert.doesNotMatch(html, /WRONG_MACHINE|其他机器的诊断不得误配/);
  assert.equal(buttonNamed(html, "查询原请求").disabled, false);
  assert.equal(
    buttons(html).some((button) => /重发|重新发送|重新执行/.test(button.text)),
    false,
  );
});

test("settings exposes the exact theme name separately from its help text", () => {
  const html = render(SettingsPage, settingsProps());
  const label = html.match(
    /<label\b[^>]*for="workspace-theme"[^>]*>([\s\S]*?)<\/label>/,
  );
  assert.ok(label);
  assert.equal(plainText(label[1]), "主题");
  const select = html.match(/<select\b[^>]*id="workspace-theme"[^>]*>/);
  assert.ok(select);
  assert.match(select[0], /aria-describedby="workspace-theme-help"/);
  assert.match(
    html,
    /id="workspace-theme-help"[^>]*>跟随系统，或使用固定主题<\//,
  );
});

test("settings keeps an unmatched recovery read-only and prevents duplicate queries", () => {
  const props = settingsProps({
    journal: [
      {
        id: "unmatched-original",
        machineId: "machine-a",
        op: "submit",
        time: timestamp,
      },
    ],
  });
  const html = render(SettingsPage, props);
  assert.match(plainText(html), /正在只读核对原请求；不会重复发送。/);
  const querying = render(SettingsPage, { ...props, querying: true });
  assert.equal(buttonNamed(querying, "正在查询原请求…").disabled, true);
  const busy = render(SettingsPage, { ...props, busy: true });
  assert.equal(buttonNamed(busy, "查询原请求").disabled, true);
});

test("settings retains distinct window-close and backend-stop actions with lifecycle consequences", () => {
  const html = render(SettingsPage, settingsProps());
  assert.equal(buttonNamed(html, "仅关闭窗口").disabled, false);
  assert.equal(buttonNamed(html, "停止后台并退出").disabled, false);
  assert.match(plainText(html), /后台继续管理连接/);
  assert.match(plainText(html), /远端已接收的任务继续执行/);
  assert.match(plainText(html), /重开后查询原记录/);
  const busy = render(SettingsPage, settingsProps({ busy: true }));
  assert.equal(buttonNamed(busy, "仅关闭窗口").disabled, true);
  assert.equal(buttonNamed(busy, "停止后台并退出").disabled, true);
});

test("settings restores the original removed machine only with supported management and connection identity", async (t) => {
  const removed = machine({ removed: true, online: false });
  const baseline = settingsProps({ machines: [removed], nodes: [] });
  assert.equal(
    buttonNamed(render(SettingsPage, baseline), "恢复机器 · 测试机器 A")
      .disabled,
    false,
  );
  for (const [scenario, overrides] of [
    ["management pending", { managementLocked: true }],
    [
      "old backend without machine management",
      { machineManagementSupported: false },
    ],
    [
      "missing original connection",
      { machines: [{ ...removed, connectionId: undefined }] },
    ],
  ]) {
    await t.test(scenario, () => {
      assert.equal(
        buttonNamed(
          render(SettingsPage, { ...baseline, ...overrides }),
          "恢复机器 · 测试机器 A",
        ).disabled,
        true,
      );
    });
  }
});

// View status is separate from Task/Conversation facts and does not lock new work.
test('conversation details distinguish loading, missing and backend error while preserving independent compose',async t=>{
 for(const [status,title] of [['loading','正在读取原会话'],['missing','未找到原会话'],['error','会话详情暂不可用']])await t.test(status,()=>{
  const props=conversationsProps();props.selected={...props.selected,items:[]};props.detailRead={id:props.selected.conversationId,status,message:'只读原记录暂不可用。'};const before=structuredClone(props.selected);
  const html=render(ConversationsPage,props);assert.match(plainText(html),new RegExp(title));assert.equal(buttonNamed(html,'发送').disabled,true);assert.equal(buttonNamed(html,'新建会话').disabled,false);assert.deepEqual(props.selected,before);
 });
});

test('scoped node or machine unknown blocks only the target machine maintenance and explains the blocker',()=>{
 const remote=machine({machineId:'remote'}),reason=id=>id==='local'?'本机节点接入原操作待核对。':'';
 const allowed=render(MachineInventory,inventoryProps({machines:[remote],metadataBusy:true,managementReason:reason}));
 assert.equal(buttonNamed(allowed,'后台维护').disabled,false);assert.equal(buttonNamed(allowed,'编辑连接').disabled,false);assert.equal(buttonNamed(allowed,'断开连接').disabled,false);
 const denied=render(MachineInventory,inventoryProps({machines:[remote],managementReason:()=> '原后台维护操作待核对。'}));
 const button=buttonNamed(denied,'后台维护');assert.equal(button.disabled,true);assert.match(button.attributes,/title="原后台维护操作待核对/);
 const busy=render(MachineInventory,inventoryProps({machines:[remote],nodes:[node({machineId:'remote',busy:true})],managementReason:()=>''}));assert.equal(buttonNamed(busy,'后台维护').disabled,true);
});
test('incompatible OpenCode never appears connected or executable; safe history management remains',()=>{
 const n=node({adapter:'opencode',name:'Old OpenCode',version:'1.2.22',status:'version_incompatible',connected:false,executionSupported:false,available:false});
 const html=render(MachineInventory,inventoryProps({nodes:[n]})),article=nodeArticle(html,n.name);
 assert.match(article,/版本不兼容/);assert.doesNotMatch(article,/已接入/);assert.equal(buttonNamed(article,'接入').disabled,true);assert.equal(buttonNamed(article,'移除 Agent').disabled,false);
});
