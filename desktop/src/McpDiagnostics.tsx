import type { McpFacts, McpState, McpStatus } from "./types";

export type McpAction = "install" | "remove" | "export" | "probe" | "revoke";
const stateLabels: Record<McpState, string> = {
  installed: "已添加",
  exported: "已生成独立配置",
  absent: "未添加",
  conflict: "配置冲突",
  revoked_config_pending: "已撤销授权，原生配置待清理",
  unsupported: "当前产品不支持此操作",
};
export function mcpStateLabel(state: string) {
  return stateLabels[state as McpState] ?? "状态未知";
}
// Each dimension is separate evidence. Never fold them into one "已连接" claim:
// a written config does not prove native load, a loaded entry does not prove a
// handshake, and a handshake does not prove tool authorization.
const factRows: { key: keyof McpFacts; label: string }[] = [
  { key: "config", label: "配置" },
  { key: "nativeLoad", label: "原生加载" },
  { key: "connection", label: "连接" },
  { key: "tools", label: "工具" },
  { key: "authorization", label: "授权" },
  { key: "ownership", label: "归属" },
];
const factValueLabels: { [K in keyof McpFacts]: Record<McpFacts[K], string> } =
  {
    config: {
      absent: "不存在",
      present: "存在",
      disabled: "已禁用",
      conflict: "冲突",
      unsupported: "不支持",
      unknown: "未知",
    },
    nativeLoad: {
      loaded: "已加载",
      not_loaded: "未加载",
      reload_required: "需重新加载/重开",
      unsupported: "无法探测",
      unknown: "未知",
    },
    connection: {
      connected: "已连接",
      disconnected: "未连接",
      revoked: "已撤销",
      unknown: "未知",
    },
    tools: {
      available: "可用",
      unauthorized: "未授权",
      unavailable: "不可用",
      unknown: "未知",
    },
    authorization: { valid: "有效", revoked: "已撤销", unknown: "未知" },
    ownership: {
      bridge: "Bridge 管理",
      external: "原生外部管理",
      unconfirmed: "未确认",
    },
  };
const factNotes: {
  [K in keyof McpFacts]?: Partial<Record<McpFacts[K], string>>;
} = {
  config: {
    unknown: "未知：后台没有读到该产品的原生 MCP 配置。",
    unsupported: "不支持：当前产品没有 Bridge 可管理的原生 MCP 配置。",
    disabled: "已禁用：条目存在但原生配置关闭了它，Bridge 不会静默重新启用。",
    conflict:
      "冲突：同名条目已被外部修改，Bridge 会保留原条目，不按名称猜归属。",
  },
  nativeLoad: {
    unknown: "未知：无法探测原生 MCP 列表是否加载了该条目。",
    unsupported: "无法探测：该产品没有可用的原生列表核对入口。",
    not_loaded:
      "未加载：配置已写入，但原生 Agent 还没有加载；请重开或重新加载后再核对。",
    reload_required:
      "需重新加载：原生客户端需要重开或重新加载配置后才会读取该条目。",
  },
  connection: {
    unknown: "未知：没有取得原生连接握手结果，不能据此判断连接情况。",
    disconnected: "未连接：原生客户端当前没有建立 MCP 连接。",
    revoked:
      "已撤销：连接授权已撤销，后续调用会被拒绝；原生配置条目可能仍待清理。",
  },
  tools: {
    unknown: "未知：未取得原生工具目录，不能判断工具是否就绪。",
    unavailable: "不可用：原生工具目录没有返回 AgentBridge 工具。",
    unauthorized: "未授权：工具目录可见，但当前授权不允许调用。",
  },
  authorization: {
    unknown: "未知：后台未返回持久授权记录。",
    revoked: "已撤销：新的调用会被拒绝，历史任务仍可在 Bridge 核对。",
  },
  ownership: {
    unconfirmed:
      "未确认：无法确认条目由 Bridge 还是原生外部管理，Bridge 不会静默接管或覆盖。",
    external: "原生外部管理：条目由原生配置或用户手动维护，Bridge 只读识别。",
  },
};
export function McpFactsView({ status }: { status: McpStatus }) {
  const facts = status.facts;
  if (!facts)
    return (
      <p className="settings-footnote mcp-facts-legacy" role="status">
        当前后台只返回旧的配置与授权摘要，没有逐项原生证据（原生加载、连接握手、工具目录、条目归属）。请升级后台后再核对原生可见性；此摘要不能证明连接成功或工具已就绪。
      </p>
    );
  return (
    <dl className="mcp-facts" aria-label="MCP 状态事实">
      {factRows.map((row) => {
        const value = facts[row.key];
        const label =
          (factValueLabels[row.key] as Record<string, string>)[value] ?? "未知";
        const note = (
          factNotes[row.key] as Record<string, string | undefined> | undefined
        )?.[value];
        return (
          <div key={row.key} className={`mcp-fact mcp-fact-${row.key}`}>
            <dt>{row.label}</dt>
            <dd>
              <span>{label}</span>
              {note && <small className="settings-footnote">{note}</small>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
export function probeText(status: McpStatus) {
  const probe = status.evidence?.nativeProbe;
  if (!probe) return "";
  const command = probe.command ? `（${probe.command}）` : "";
  const outcome = probe.outcome ? ` · ${probe.outcome}` : "";
  const detail = probe.detail ? ` · ${probe.detail}` : "";
  return probe.kind === "none"
    ? `原生列表探测：尚未执行原生列表探测${outcome}${detail}`
    : `原生列表探测：使用该产品自身的 MCP 列表命令${command}${outcome}${detail}`;
}
export function toolsProbeText(status: McpStatus) {
  const probe = status.evidence?.toolsProbe;
  if (!probe) return "";
  const count =
    typeof probe.toolCount === "number" ? ` · ${probe.toolCount} 个工具` : "";
  return `Bridge 工具探测：stdio 握手结果 ${probe.outcome}${count}`;
}
export function actionNotice(
  action: McpAction,
  status: McpStatus,
  adapter: string,
) {
  if (action === "install")
    return adapter.startsWith("opendesk")
      ? "已在确认 OpenDesk 完全退出后写入配置。请手动打开 OpenDesk，在 MCP 管理 → 已安装 MCP 人工核对；Bridge 当前无法核验原生加载、连接或工具。"
      : adapter.startsWith("dsh")
        ? "已添加到 DSH 原生配置。请重新打开 DSH 会话，在 MCP 列表查看 AgentBridge。"
        : "已添加到用户配置。请重开 Agent 会话，在 MCP 列表查看 agentbridge。";
  if (action === "export")
    return "已生成独立文件，请将对应条目合入客户端的 MCP 配置。文件仅适用于该 Agent 所在机器。";
  if (action === "probe")
    return "已重新探测原生列表；只读刷新不会新增、恢复或启用原生配置。";
  if (action === "revoke")
    return "已撤销连接授权，未改动原生配置条目；原生列表若仍显示该条目，新的调用会被拒绝。";
  const configPending =
    status.state === "revoked_config_pending" ||
    status.facts?.config === "present";
  return configPending && status.installed === false
    ? "已撤销连接授权，原生配置仍存在，待清理。已有任务仍可在 Bridge 核对。"
    : "已移除 Bridge MCP 并撤销接入。已有任务仍可在 Bridge 核对。";
}
