const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");
const { fileURLToPath } = require("node:url");

process.env.TSX_TSCONFIG_PATH = path.resolve(__dirname, "../tsconfig.json");
const desktopRequire = createRequire(path.resolve(__dirname, "../package.json"));
const React = desktopRequire("react");
const { renderToStaticMarkup } = desktopRequire("react-dom/server");
const { require: requireTsx } = require("tsx/cjs/api");
const AgentIcon = requireTsx("../src/AgentIcon.tsx", __filename).default;
const MachineInventory = requireTsx("../src/MachineInventory.tsx", __filename).default;
const { TasksPage, ConversationsPage } = requireTsx("../src/WorkspacePages.tsx", __filename);
const { agentTools, agentTool, toolLabel } = requireTsx("../src/agent-tools.ts", __filename);
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const noop = () => {};
const kinds = ["claude", "codex", "opencode", "hermes", "pi", "dsh"];

test("six official agent icons retain their exact source bytes and bundled provenance", () => {
  assert.deepEqual(Object.keys(agentTools).filter(k => !['dsh-desktop', 'dsh-web', 'opendesk', 'opendesk-desktop'].includes(k)), kinds);
  assert.equal(agentTools['dsh-desktop'].icon, agentTools.dsh.icon);
  assert.equal(agentTools['dsh-web'].icon, agentTools.dsh.icon);
  const directory = path.resolve(__dirname, "../assets/agents");
  const sources = JSON.parse(fs.readFileSync(path.join(directory, "sources.json"), "utf8"));
  assert.equal(sources.length, 6);
  for (const kind of kinds) {
    const source = sources.find((entry) => entry.adapter === kind);
    assert.ok(source, `provenance for ${kind}`);
    const filename = fileURLToPath(agentTools[kind].icon);
    assert.equal(filename, path.join(directory, source.file));
    const bytes = fs.readFileSync(filename);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256);
    assert.match(source.source, /^https:\/\//);
    if (filename.endsWith(".svg")) {
      assert.match(bytes.toString(), /<svg\b/);
      assert.doesNotMatch(bytes.toString(), /<script\b|\bonload\s*=|(?:href|src)\s*=\s*["']https?:/i);
    } else {
      assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    }
  }
});

test("agent icons use local product identity, accessible labels and a neutral custom fallback", () => {
  for (const kind of kinds) {
    const html = render(AgentIcon, { adapter: kind, decorative: false });
    assert.match(html, new RegExp(`data-agent-kind="${kind}"`));
    assert.ok(html.includes(`aria-label="${agentTools[kind].fullName}"`));
    assert.match(html, /role="img"/);
    assert.match(html, /<img\b/);
    assert.doesNotMatch(html, /(?:src|href)="https?:\/\//);
    assert.match(html, /color-scheme:light/);
  }
  const decorative = render(AgentIcon, { adapter: "hermes" });
  assert.match(decorative, /aria-hidden="true"/);
  assert.doesNotMatch(decorative, /role="img"/);
  for (const custom of ["my-agent", "__proto__", undefined]) {
    assert.equal(agentTool(custom), undefined);
    const html = render(AgentIcon, { adapter: custom });
    assert.doesNotMatch(html, /<img\b|OpenCode/);
    assert.match(html, /lucide-bot/);
  }
  assert.equal(toolLabel("dsh"), "DSH");
  assert.equal(toolLabel("hermes"), "Hermes");
  assert.equal(toolLabel("my-agent"), "my-agent");
});

const machine = { machineId: "machine-a", name: "测试机器", kind: "linux", platform: "linux", online: true };
function node(kind, supported = true) {
  return {
    nodeId: `node-${kind}`, machineId: machine.machineId, adapter: kind,
    name: `测试 ${toolLabel(kind)}`, executable: `/opt/${kind}`, version: "test",
    connected: true, online: true, healthy: true, busy: false, available: true,
    executionSupported: supported, activeTasks: 0, status: "connected",
  };
}

test("inventory renders all six product marks while honoring execution capability", () => {
  const html = render(MachineInventory, {
    machines: [machine], nodes: kinds.map((kind) => node(kind, kind !== "dsh")),
    relation: { leaderId: null, memberIds: [], revision: 0 }, filter: "all", query: "",
    busy: false, metadataBusy: false, managementSupported: true,
    machineManagementSupported: true, daemonManagementSupported: true,
    blocked: () => false, start: noop, attach: noop, nodeAction: noop,
    addAgent: noop, machineAction: noop,
  });
  for (const kind of kinds) {
    assert.match(html, new RegExp(`data-agent-kind="${kind}"`));
    assert.ok(html.includes(toolLabel(kind)));
  }
  const dsh = html.match(/<article\b[^>]*aria-label="测试 DSH[^>]*>([\s\S]*?)<\/article>/);
  assert.ok(dsh);
  assert.match(dsh[1], /尚未支持执行/);
  assert.match(dsh[1], /<button\b[^>]*disabled[^>]*>开始会话[\s\S]*?<\/button>/);
});

test("task and conversation marks follow the bound source node", () => {
  const source = node("pi");
  const task = {
    taskId: "task-a", executionId: "execution-a", requestId: "request-a",
    conversationId: "conversation-a", targetAgent: source.nodeId, nodeId: source.nodeId,
    machineId: machine.machineId, message: "原需求", status: "succeeded",
    createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z",
    lastSummary: "完成", lastSeq: 0, result: { message: "原回答" },
  };
  const conversation = {
    conversationId: task.conversationId, targetAgent: source.nodeId, nodeId: source.nodeId,
    machineId: machine.machineId, title: "原会话", turns: 1,
    updatedAt: task.updatedAt, items: [task], canContinue: false,
  };
  const common = { machineName: () => machine.name, nodeFor: () => source, onNew: noop };
  const board = render(TasksPage, { ...common, tasks: [task], onOpen: noop });
  assert.match(board, /data-agent-kind="pi"/);
  const reader = render(ConversationsPage, {
    ...common, conversations: [conversation], selected: conversation, showChecks: false,
    onShowChecks: noop, onOpen: noop, onTask: noop, followup: "", onFollowup: noop,
    onSend: noop, busy: false, blocked: () => false,
  });
  assert.equal((reader.match(/data-agent-kind="pi"/g) || []).length, 2);
  assert.doesNotMatch(reader, /data-agent-kind="opencode"/);
});

test("OpenDesk CLI and desktop use the same bundled first-party identity", () => {
  assert.equal(agentTools.opendesk.icon, agentTools['opendesk-desktop'].icon);
  const bytes = fs.readFileSync(fileURLToPath(agentTools.opendesk.icon));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.match(fs.readFileSync(path.resolve(__dirname,"../assets/agents/opendesk-LICENSE"),"utf8"), /Mulan|木兰/);
});
