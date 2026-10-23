import { useEffect, useState } from "react";
import { Plug } from "lucide-react";
import { call } from "./api";
import { canConfigureMcp, connectionCapability } from "./connection-capabilities";
import type { AgentNode, McpFacts, McpState, McpStatus } from "./types";

type McpAction = "install" | "remove" | "export" | "probe" | "revoke";
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
const factValueLabels: { [K in keyof McpFacts]: Record<McpFacts[K], string> } = {
  config: { absent: "不存在", present: "存在", disabled: "已禁用", conflict: "冲突", unsupported: "不支持", unknown: "未知" },
  nativeLoad: { loaded: "已加载", not_loaded: "未加载", reload_required: "需重新加载/重开", unsupported: "无法探测", unknown: "未知" },
  connection: { connected: "已连接", disconnected: "未连接", revoked: "已撤销", unknown: "未知" },
  tools: { available: "可用", unauthorized: "未授权", unavailable: "不可用", unknown: "未知" },
  authorization: { valid: "有效", revoked: "已撤销", unknown: "未知" },
  ownership: { bridge: "Bridge 管理", external: "原生外部管理", unconfirmed: "未确认" },
};
const factNotes: { [K in keyof McpFacts]?: Partial<Record<McpFacts[K], string>> } = {
  config: {
    unknown: "未知：后台没有读到该产品的原生 MCP 配置。",
    unsupported: "不支持：当前产品没有 Bridge 可管理的原生 MCP 配置。",
    disabled: "已禁用：条目存在但原生配置关闭了它，Bridge 不会静默重新启用。",
    conflict: "冲突：同名条目已被外部修改，Bridge 会保留原条目，不按名称猜归属。",
  },
  nativeLoad: {
    unknown: "未知：无法探测原生 MCP 列表是否加载了该条目。",
    unsupported: "无法探测：该产品没有可用的原生列表核对入口。",
    not_loaded: "未加载：配置已写入，但原生 Agent 还没有加载；请重开或重新加载后再核对。",
    reload_required: "需重新加载：原生客户端需要重开或重新加载配置后才会读取该条目。",
  },
  connection: {
    unknown: "未知：没有取得原生连接握手结果，不能据此判断连接情况。",
    disconnected: "未连接：原生客户端当前没有建立 MCP 连接。",
    revoked: "已撤销：连接授权已撤销，后续调用会被拒绝；原生配置条目可能仍待清理。",
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
    unconfirmed: "未确认：无法确认条目由 Bridge 还是原生外部管理，Bridge 不会静默接管或覆盖。",
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
        const label = (factValueLabels[row.key] as Record<string, string>)[value] ?? "未知";
        const note = (factNotes[row.key] as Record<string, string | undefined> | undefined)?.[value];
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
function probeText(status: McpStatus) {
  const probe = status.evidence?.nativeProbe;
  if (!probe) return "";
  const command = probe.command ? `（${probe.command}）` : "";
  const outcome = probe.outcome ? ` · ${probe.outcome}` : "";
  const detail = probe.detail ? ` · ${probe.detail}` : "";
  return probe.kind === "none"
    ? `原生列表探测：尚未执行原生列表探测${outcome}${detail}`
    : `原生列表探测：使用该产品自身的 MCP 列表命令${command}${outcome}${detail}`;
}
function toolsProbeText(status: McpStatus) {
  const probe = status.evidence?.toolsProbe;
  if (!probe) return "";
  const count = typeof probe.toolCount === "number" ? ` · ${probe.toolCount} 个工具` : "";
  return `Bridge 工具探测：stdio 握手结果 ${probe.outcome}${count}`;
}
function actionNotice(action: McpAction, status: McpStatus, adapter: string) {
  if (action === "install")
    return adapter.startsWith("opendesk")
      ? "已在确认 OpenDesk 完全退出后写入配置。请手动打开 OpenDesk，在 MCP 管理 → 已安装 MCP 人工核对；Bridge 当前无法核验原生加载、连接或工具。"
      : adapter.startsWith("dsh")
        ? "已添加到 DSH 原生配置。请重新打开 DSH 会话，在 MCP 列表查看 AgentBridge。"
        : "已添加到用户配置。请重开 Agent 会话，在 MCP 列表查看 agentbridge。";
  if (action === "export")
    return "已生成独立文件，请将对应条目合入客户端的 MCP 配置。文件仅适用于该 Agent 所在机器。";
  if (action === "probe") return "已重新探测原生列表；只读刷新不会新增、恢复或启用原生配置。";
  if (action === "revoke") return "已撤销连接授权，未改动原生配置条目；原生列表若仍显示该条目，新的调用会被拒绝。";
  const configPending = status.state === "revoked_config_pending" || status.facts?.config === "present";
  return configPending && status.installed === false
    ? "已撤销连接授权，原生配置仍存在，待清理。已有任务仍可在 Bridge 核对。"
    : "已移除 Bridge MCP 并撤销接入。已有任务仍可在 Bridge 核对。";
}
export default function McpSettings({ node, disabled = false, onBusyChange, initialStatus }: {
  node: AgentNode;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  /** Render a known status without a backend round trip; used by UI tests. */
  initialStatus?: McpStatus;
}) {
  const nodeId = node.nodeId;
  // nativeMcpConfig answers whether Bridge can manage this product's own MCP
  // entry. MCP *calling* support is a separate dimension and never gates this.
  const boundary = connectionCapability(node, "nativeMcpConfig");
  const caller = connectionCapability(node, "mcpClient");
  const configurable = canConfigureMcp(node);
  const [status, setStatus] = useState<McpStatus | null>(initialStatus ?? null);
  // DSH CLI keeps one native config per launch profile; the user names it and
  // Bridge edits exactly that profile's patch layer (never guesses).
  const [profile, setProfile] = useState(initialStatus?.profile ?? "");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  // A backend may still refuse native config management for a specific entry
  // (e.g. a product with a client but no Bridge-owned config adapter). That
  // reason is authoritative evidence and must be shown verbatim.
  const nativeUnsupported = status?.nativeSupport === false;
  const openDesk=node.adapter==='opendesk-desktop';
  const writeReason=openDesk?(status?.lifecycle?.safeToWrite?'':status?.lifecycle?.message||'当前后台未提供 OpenDesk 安全退出检查，请升级来源后台后再添加。'):'';
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const mcpParams = () => ({ nodeId, adapter: node.adapter, ...(node.adapter === "dsh" && profile.trim() ? { profile: profile.trim() } : {}) });
  useEffect(() => {
    let current = true;
    setStatus(null);
    setNotice("");
    if (!nodeId) return;
    void call<McpStatus>("mcp.status", mcpParams())
      .then((result) => {
        if (!current) return;
        setStatus(result);
        if (node.adapter === "dsh" && !profile && result.profile) setProfile(result.profile);
      })
      .catch((error) => {
        if (current) setNotice((error as Error).message);
      });
    return () => {
      current = false;
    };
  }, [nodeId, node.adapter, revision, profile]);
  async function manage(action: McpAction) {
    if (busy || disabled) return;
    if (action === "revoke" && !window.confirm("撤销后原生配置条目会保留，但新的调用会被拒绝。已有任务仍可在 Bridge 核对。确定撤销连接授权？")) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await call<McpStatus>("mcp." + action, mcpParams());
      setStatus(result);
      setNotice(actionNotice(action, result, node.adapter));
    } catch (error) {
      try {
        setStatus(await call<McpStatus>("mcp.status", mcpParams()));
      } catch {
        setStatus(null);
      }
      setNotice((error as Error).message + " 请刷新配置状态核对操作结果。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="settings-card network-relations settings-mcp"
      aria-labelledby="settings-mcp"
    >
      <div className="settings-card-heading">
        <Plug size={20} />
        <div>
          <h2 id="settings-mcp">AgentBridge MCP 操作</h2>
          <p>
            为每个 Agent 统一管理同一个 AgentBridge MCP：写入或导出原生配置、核对原生加载与工具，并撤销连接授权。DSH Desktop/Web 的原生服务连接在下方单独配置，不是第二种 MCP 安装方式。
          </p>
        </div>
      </div>
      <p className="settings-footnote">
        Windows、WSL 与 SSH 各自管理目标环境的用户配置；写文件或生成配置不等于原生已加载。原生列表可能异步刷新，必要时重开 Agent，OpenCode 还可能需重启其原生后台。Bridge 后台需保持运行，不会在检测到外部删除后自动补回。
      </p>
      {openDesk && <p className="workspace-inline-note mcp-native-lifecycle" role="status">{status?.lifecycle?.message||'正在核对 OpenDesk 的退出状态；原生加载、连接和工具无法由 Bridge 自动核验。'}</p>}
      {boundary === false && (
        <p role="status" className="settings-footnote">
          {caller === true
            ? "该产品已有 MCP 客户端，但 Bridge 暂不能管理它的原生 MCP 配置。仍可在原生工具中手动添加 AgentBridge MCP，但本页无法核对原生加载、连接或工具。"
            : "该产品未确认提供 MCP 客户端，Bridge 也暂不能管理它的原生 MCP 配置。仍可在原生工具中手动添加 AgentBridge MCP，但本页无法核对原生加载、连接或工具。"}
        </p>
      )}
      {boundary === null && (
        <p role="status" className="settings-footnote">
          当前后台未报告此 Agent 的原生 MCP 配置能力，暂不能从 Bridge 增删；如原生列表已添加 AgentBridge，请升级后台后再核对原生证据。
        </p>
      )}
      {node.adapter === "dsh" && (
        <label className="settings-field mcp-profile">
          <span>DSH 原生 profile</span>
          <input
            type="text"
            value={profile}
            placeholder="与启动 dsh 时使用的 profile 名称一致，例如 web"
            disabled={disabled || busy}
            onChange={(event) => setProfile(event.target.value)}
          />
          <small className="settings-footnote">
            只在 DSH CLI 需要：它按启动时选择的 profile 读取原生配置，Bridge 不会猜测目标 profile。切换 profile 会重新读取该 profile 的条目。
          </small>
        </label>
      )}
          <p role="status">
            {status
              ? openDesk&&status.state==='installed'?'配置已写入 · 原生加载尚未核验':mcpStateLabel(status.state)
              : notice
                ? "尚未读取配置"
                : "正在读取配置…"}
            {status && !status.facts
              ? status.enabled
                ? " · 接入授权有效"
                : " · 接入授权已关闭"
              : ""}
          </p>
          {nativeUnsupported && (
            <p role="alert">
              原生配置不可管理：{status?.nativeSupportReason || "当前产品未适配 Bridge 管理的原生 MCP 配置。"}
              {status?.nativeSupportCode ? `（${status.nativeSupportCode}）` : ""}
            </p>
          )}
          {status?.state === "revoked_config_pending" && (
            <p role="alert">
              已撤销连接授权，原生配置仍存在，待清理。清理完成前原生列表可能仍显示条目，但新的调用会被拒绝；Bridge 不会自动恢复授权。
            </p>
          )}
          {status && (
            <p className="settings-footnote">
              原生配置：<code>{status.configPath}</code>
            </p>
          )}
          {node.adapter === 'dsh-desktop' && status?.profile && (
            <p className="settings-footnote">接入的 DSH Desktop Profile：{status.profile}</p>
          )}
          {node.adapter === 'pi' && (
            <p className="settings-footnote">支持 Pi 1.4 及以上的 1.x 正式版，管理用户级 MCP 配置。更改后请在 Pi 执行 /reload；项目覆盖或原生禁用请在 Pi 中核对，Bridge 不会重新启用。</p>
          )}
          {node.adapter === 'hermes' && (
            <p className="settings-footnote">Hermes 按原生 Home 与当前 Profile 管理配置{status?.profile ? `（${status.profile}）` : ""}。更改后在 Hermes 执行 /reload-mcp；切换 Profile 后先移除原接入，再为当前目标添加。原生列表仅证明条目已加载。</p>
          )}
          {status?.evidence?.configError && (
            <p role="alert">{status.evidence.configError.message}</p>
          )}
          {status?.nativeTargetChanged && status.currentConfigPath && (
            <p className="settings-footnote">当前原生配置：<code>{status.currentConfigPath}</code>。移除仅清理原接入目标，再添加才使用当前选择。</p>
          )}
          {status?.conflict && !status.evidence?.configError && (
            <p role="alert">
              同名条目已存在或被外部修改，Bridge
              会保留原条目。移除仍会先撤销本接入授权。
            </p>
          )}
          {status && <McpFactsView status={status} />}
          {!openDesk && status?.evidence?.observation && (
            <p className="settings-footnote" role="status">
              最近探测：{status.evidence.observation.observedAt || "尚未探测"}。
              {status.evidence.observation.freshness === "current"
                ? "该次观测与当前配置匹配；连接与工具观测有效期为60秒。"
                : "探测已过期、配置已变化或缺少绑定证据，原生加载、连接和工具状态保留未知；请重新探测。"}
              服务端工具目录可用不代表原生Agent已连接或已获准委派。
            </p>
          )}
          {node.adapter.startsWith("opendesk") && status?.launcher === "electron" && (
            <p role="alert">
              OpenDesk 0.3.9 无法启动 Bridge 的 Electron 运行时作为 MCP 命令。请先安装 Node.js（或让它出现在 PATH 中）后重新添加；否则请在 OpenDesk 原生界面手动添加 AgentBridge。
            </p>
          )}
          {node.adapter.startsWith("opendesk") && status?.launcher === "node" && (
            <p className="settings-footnote">
              原生启动器：Node（OpenDesk 可以启动它）。工具调用还需要 Bridge 后台保持运行并保留该接入授权。
            </p>
          )}
          {status?.evidence?.nativeProbe && (
            <p className="settings-footnote">{probeText(status)}</p>
          )}
          {status?.evidence?.toolsProbe && (
            <p className="settings-footnote">{toolsProbeText(status)}</p>
          )}
          <div className="ssh-actions">
            {configurable && !nativeUnsupported && (
              <button
                className="btn primary"
                disabled={
                  busy || disabled ||
                  !status ||
                  status.conflict ||
                  status.installed ||
                  status.facts?.config === 'disabled' ||
                  (!node.connected && !openDesk) || !!writeReason ||
                  status.state === "unsupported"
                }
                title={writeReason||undefined}
                onClick={() => void manage("install")}
              >
                添加 Bridge MCP
              </button>
            )}
            {configurable && !nativeUnsupported && (
              <button
                className="btn"
                disabled={
                  busy || disabled ||
                  !status ||
                  status.state === "unsupported" ||
                  !(status.enabled || status.installed || status.state === "revoked_config_pending")
                }
                onClick={() => void manage("remove")}
              >
                移除 Bridge MCP
              </button>
            )}
            {(configurable || boundary === false) && (
              <button
                className="btn"
                disabled={busy || disabled || !node.connected}
                onClick={() => void manage("export")}
              >
                生成独立 MCP 文件
              </button>
            )}
            {(configurable || boundary === false) && status?.enabled && (
              <button
                className="btn"
                disabled={busy || disabled}
                onClick={() => void manage("revoke")}
              >
                撤销连接授权
              </button>
            )}
            {boundary !== false && (
              <button
                className="btn"
                disabled={busy || disabled || !node.connected || openDesk || status?.nativeProbeSupported===false}
                title={openDesk?'OpenDesk 没有可查询的原生 MCP 列表，无法由 Bridge 核验；请在原生 MCP 管理中人工核对。':undefined}
                onClick={() => void manage("probe")}
              >
                重新探测原生列表
              </button>
            )}
            <button
              className="btn"
              disabled={busy}
              onClick={() => setRevision((r) => r + 1)}
            >
              刷新配置状态
            </button>
          </div>
          {status?.files && (
            <details>
              <summary>独立配置文件</summary>
              <dl>
                {Object.entries(status.files).map(([format, file]) => (
                  <div key={format}>
                    <dt>
                      {format === "opendesk" ? "OpenDesk 原生 MCP JSON" : format === "codex"
                        ? "Codex TOML"
                        : format === "opencode"
                          ? "OpenCode 2 JSONC"
                          : format === "dsh"
                            ? "DSH 原生 MCP 配置"
                            : "通用 MCP JSON"}
                    </dt>
                    <dd>
                      <code>{file}</code>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="settings-footnote">
                文件引用本机连接描述，未包含授权
                Token。客户端需加载对应格式；项目配置可能覆盖用户配置。
              </p>
            </details>
          )}
      {notice && (
        <p role="status" className="settings-footnote">
          {notice}
        </p>
      )}
    </section>
  );
}
