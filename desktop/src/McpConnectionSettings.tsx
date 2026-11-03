import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  CircleHelp,
  CircleAlert,
  ChevronDown,
  ChevronRight,
  Copy,
  RefreshCw,
  Plus,
  LoaderCircle,
} from "lucide-react";
import { call } from "./api";
import {
  canConfigureMcp,
  connectionCapability,
} from "./connection-capabilities";
import {
  McpFactsView,
  actionNotice,
  probeText,
  toolsProbeText,
  type McpAction,
} from "./McpDiagnostics";
import {
  mcpConnectionActions,
  mcpConnectionView,
  mcpDisplayMessage,
} from "./mcp-connection-view";
import type { AgentNode, McpStatus } from "./types";

const summaryTitles = {
  unconfigured: "尚未配置 Bridge MCP",
  configured: "Bridge MCP 已配置，待验证",
  ready: "Bridge MCP 接入正常",
  failed: "接入存在异常",
};
function CheckIcon({ tone }: { tone: "ok" | "unknown" | "failed" }) {
  const Icon =
    tone === "ok" ? Check : tone === "failed" ? CircleAlert : CircleHelp;
  return (
    <Icon
      className={"mcp-check-icon mcp-tone-" + tone}
      size={16}
      aria-hidden="true"
    />
  );
}
export default function McpConnectionSettings({
  node,
  disabled = false,
  onBusyChange,
  initialStatus,
  advancedChildren,
}: {
  node: AgentNode;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  initialStatus?: McpStatus;
  advancedChildren?: ReactNode;
}) {
  const [status, setStatus] = useState<McpStatus | null>(initialStatus ?? null);
  const [profile, setProfile] = useState(initialStatus?.profile ?? "");
  const [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [action, setAction] = useState<McpAction | null>(null),
    [reading, setReading] = useState(false);
  const [advanced, setAdvanced] = useState(false),
    [diagnostics, setDiagnostics] = useState(false),
    [menu, setMenu] = useState(false);
  const [configurationDetails, setConfigurationDetails] = useState(false);
  const [now, setNow] = useState(Date.now);
  const menuWrap = useRef<HTMLDivElement>(null),
    menuButton = useRef<HTMLButtonElement>(null),
    diagnosticsRef = useRef<HTMLDetailsElement>(null);
  const flight = useRef(false),
    readFlight = useRef(false);
  const source = JSON.stringify([
    node.machineId,
    node.nodeId,
    node.adapter,
    profile,
  ]);
  const current = useRef(source);
  current.current = source;
  const boundary = connectionCapability(node, "nativeMcpConfig"),
    caller = connectionCapability(node, "mcpClient");
  const configurable = canConfigureMcp(node);
  const openDesk = node.adapter === "opendesk-desktop";
  const writeReason = openDesk
    ? status?.lifecycle?.safeToWrite
      ? ""
      : status?.lifecycle?.message ||
        "当前后台未提供 OpenDesk 安全退出检查，请升级来源后台后再添加。"
    : "";
  const view = mcpConnectionView(status, now);
  const busy = action !== null;
  const params = () => ({
    nodeId: node.nodeId,
    adapter: node.adapter,
    ...(node.adapter === "dsh" && profile.trim()
      ? { profile: profile.trim() }
      : {}),
  });
  function checkedStatus(value: McpStatus) {
    if (value.nodeId !== node.nodeId || value.adapter !== node.adapter)
      throw new Error("返回的 MCP 状态与当前 Agent 不一致，请重新读取。");
    return value;
  }
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function read({ feedback = false }: { feedback?: boolean } = {}) {
    if (readFlight.current || flight.current) return;
    const ticket = source;
    readFlight.current = true;
    setReading(true);
    try {
      const result = await call<McpStatus>("mcp.status", params());
      if (current.current !== ticket) return;
      setStatus(checkedStatus(result));
      setNow(Date.now());
      setError("");
      if (feedback) setNotice("已重新读取配置，未探测原生 Agent。");
    } catch (cause) {
      if (current.current !== ticket) return;
      setStatus(null);
      setError(mcpDisplayMessage((cause as Error).message));
    } finally {
      readFlight.current = false;
      if (current.current === ticket) setReading(false);
    }
  }
  useEffect(() => {
    setStatus(initialStatus ?? null);
    setNotice("");
    setError("");
    // Each source owns its status read; a late old response cannot replace it.
    let active = true;
    setReading(true);
    void call<McpStatus>("mcp.status", params())
      .then((result) => {
        if (!active) return;
        setStatus(checkedStatus(result));
        setNow(Date.now());
        if (node.adapter === "dsh" && !profile && result.profile)
          setProfile(result.profile);
      })
      .catch((cause) => {
        if (active) {
          setStatus(null);
          setError(mcpDisplayMessage((cause as Error).message));
        }
      })
      .finally(() => {
        if (active) setReading(false);
      });
    const poll = setInterval(() => {
      if (active && document.visibilityState === "visible") void read();
    }, 15000);
    const focus = () => {
      if (active && !flight.current) void read();
    };
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      clearInterval(poll);
      window.removeEventListener("focus", focus);
    };
  }, [source]);
  useEffect(() => {
    if (!menu) return;
    const outside = (event: PointerEvent) => {
      if (!menuWrap.current?.contains(event.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menu]);

  async function manage(next: McpAction) {
    setMenu(false);
    if (flight.current || readFlight.current || busy || disabled) return;
    if (
      next === "export" &&
      status?.files &&
      Object.keys(status.files).length > 0 &&
      !window.confirm(
        "将重新生成当前 Agent 的独立 MCP 文件，已有同路径导出文件会被覆盖；不会修改原生 MCP 配置。确认导出？",
      )
    )
      return;
    if (
      next === "remove" &&
      !window.confirm(
        "将移除这项由 Bridge 管理的原生 MCP 配置并撤销其连接授权；保留其他 MCP 配置和已有任务。需要时可重新添加。确认移除 Bridge MCP？",
      )
    )
      return;
    if (
      next === "revoke" &&
      !window.confirm(
        "只撤销当前 Agent 的 Bridge 连接授权，保留原生 MCP 配置和已有任务；后续调用将被拒绝。确认撤销授权？",
      )
    )
      return;
    const ticket = source;
    flight.current = true;
    setAction(next);
    setNotice("");
    setError("");
    try {
      const result = await call<McpStatus>("mcp." + next, params());
      if (current.current !== ticket) return;
      setStatus(checkedStatus(result));
      setNow(Date.now());
      setNotice(actionNotice(next, result, node.adapter));
      if (next === "export") {
        setAdvanced(true);
        setConfigurationDetails(true);
      }
    } catch (cause) {
      if (current.current !== ticket) return;
      try {
        const result = await call<McpStatus>("mcp.status", params());
        if (current.current === ticket) setStatus(checkedStatus(result));
      } catch {
        if (current.current === ticket) setStatus(null);
      }
      if (current.current === ticket) {
        setError(
          mcpDisplayMessage((cause as Error).message) +
            " 请重新读取配置核对结果；未自动重试。",
        );
        setAdvanced(true);
        setDiagnostics(true);
      }
    } finally {
      flight.current = false;
      if (current.current === ticket) setAction(null);
    }
  }
  function showDiagnostics() {
    setAdvanced(true);
    setDiagnostics(true);
    requestAnimationFrame(() => {
      diagnosticsRef.current?.scrollIntoView({ block: "nearest" });
      diagnosticsRef.current?.querySelector("summary")?.focus();
    });
  }
  const { canRemove, canExport, canRevoke, probeSupported, canInstall } =
    mcpConnectionActions(node, status, disabled);
  let primaryLabel = "检测接入状态",
    primaryAction: () => void = () => void manage("probe"),
    primaryDisabled = disabled || !node.connected || busy || reading || !status;
  let PrimaryIcon = RefreshCw;
  if (!status && error) {
    primaryLabel = "重新读取配置";
    primaryAction = () => void read({ feedback: true });
    primaryDisabled = busy || reading;
  } else if (view.summary === "unconfigured" || (!status && configurable)) {
    primaryLabel = "添加 Bridge MCP";
    PrimaryIcon = Plus;
    primaryAction = () => void manage("install");
    primaryDisabled = !canInstall || busy || reading;
  } else if (view.summary === "failed") {
    primaryLabel = "诊断并修复";
    PrimaryIcon = CircleAlert;
    primaryAction = showDiagnostics;
    primaryDisabled = busy;
  } else if (!probeSupported) {
    primaryLabel = "查看验证说明";
    PrimaryIcon = CircleHelp;
    primaryAction = showDiagnostics;
    primaryDisabled = busy;
  } else if (view.summary === "ready") primaryLabel = "重新检测";
  if (
    node.adapter === "dsh" &&
    status?.nativeSupportCode === "MCP_DSH_PROFILE_REQUIRED"
  ) {
    primaryLabel = "设置原生 profile";
    PrimaryIcon = Plus;
    primaryDisabled = busy || disabled;
    primaryAction = () => {
      setAdvanced(true);
      requestAnimationFrame(() =>
        document.querySelector<HTMLInputElement>(".mcp-profile input")?.focus(),
      );
    };
  }
  if (action === "probe") primaryLabel = "检测中…";
  else if (action === "install") primaryLabel = "添加中…";
  else if (busy) primaryLabel = "处理中…";

  let title = summaryTitles[view.summary];
  let description = {
    unconfigured: "未检测到可用配置，可先添加 Bridge MCP。",
    configured: `配置已写入，尚未确认 ${node.name} 成功加载。`,
    ready: `已验证 ${node.name} 加载、连接和工具可用。`,
    failed: "查看诊断原因，按当前接入状态处理。",
  }[view.summary];
  let badge = {
    unconfigured: "未配置",
    configured: "待检测",
    ready: "已连接",
    failed: "异常",
  }[view.summary];
  if (!status) {
    title = error ? "暂时无法读取接入状态" : "正在读取接入状态";
    description = error
      ? "保留原配置，可重新读取或查看诊断。"
      : "正在核对当前 Agent 的配置与授权。";
    badge = "未验证";
  } else if (!view.configured && view.summary === "configured") {
    title = "Bridge MCP 接入待核对";
    description = "当前配置或原生证据不足，请查看验证说明。";
    badge = "未验证";
  } else if (!probeSupported && view.summary === "configured")
    description = "该接入器暂不支持自动检测，请在原生 Agent 中核对。";
  if (openDesk && view.summary === "unconfigured" && writeReason)
    description = "请先从托盘完全退出 OpenDesk，再重新读取配置。";
  if (
    node.adapter === "dsh" &&
    status?.nativeSupportCode === "MCP_DSH_PROFILE_REQUIRED"
  )
    description = "请在高级设置中指定启动 dsh 时使用的 profile。";
  const summaryTone = status
    ? view.summary === "ready"
      ? "ok"
      : view.summary === "failed"
        ? "failed"
        : "unknown"
    : "unknown";
  const items = [
    {
      label: "重新读取配置",
      disabled: busy || reading,
      run: () => void read({ feedback: true }),
      danger: false,
    },
    ...(canExport
      ? [
          {
            label: "导出 MCP 配置",
            disabled: busy || reading || disabled || !node.connected,
            run: () => void manage("export"),
            danger: false,
          },
        ]
      : []),
    ...(canRemove
      ? [
          {
            label: "移除 Bridge MCP",
            disabled: busy || reading || disabled,
            run: () => void manage("remove"),
            danger: true,
          },
        ]
      : []),
  ];
  function menuKey(event: React.KeyboardEvent) {
    const buttons = Array.from(
      menuWrap.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) || [],
    );
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setMenu(false);
      menuButton.current?.focus();
      return;
    }
    if (event.key === "Tab") {
      setMenu(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    setMenu(true);
    requestAnimationFrame(() => {
      const all = Array.from(
        menuWrap.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]:not(:disabled)',
        ) || buttons,
      );
      const i = all.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? all.length - 1
            : event.key === "ArrowUp"
              ? i <= 0
                ? all.length - 1
                : i - 1
              : (i + 1) % all.length;
      all[next]?.focus();
    });
  }
  return (
    <section
      className="mcp-connection"
      aria-label="AgentBridge MCP"
      data-mcp-menu-open={menu || undefined}
    >
      <div className="mcp-connection-body">
        {disabled && (
          <p className="mcp-inline-message" role="status">
            原机器或节点当前不可用，配置仅供查看。
          </p>
        )}
        <div className="mcp-summary" role="status">
          <CheckIcon tone={summaryTone} />
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <span className={"mcp-summary-badge mcp-tone-" + summaryTone}>
            {badge}
          </span>
        </div>
        <section
          className="mcp-status-board"
          aria-labelledby="mcp-status-title"
        >
          <div className="mcp-board-heading">
            <h3 id="mcp-status-title">接入状态</h3>
            <span title={view.observedAt}>
              {view.observedAt && Number.isFinite(Date.parse(view.observedAt))
                ? "上次检测：" +
                  new Intl.DateTimeFormat("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }).format(Date.parse(view.observedAt)) +
                  (view.fresh ? "" : " · 待复核")
                : "上次检测：尚未检测"}
            </span>
          </div>
          <dl className="mcp-status-grid">
            {view.checks.map((check) => (
              <div key={check.label}>
                <CheckIcon tone={check.tone} />
                <div>
                  <dt>{check.label}</dt>
                  <dd>{check.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </section>
        <div className="mcp-config-path">
          <div>
            <span>原生配置路径</span>
            <code title={status?.configPath || undefined}>
              {status?.configPath || "暂无配置路径"}
            </code>
          </div>
          <button
            className="btn small"
            disabled={!status?.configPath}
            onClick={() =>
              void navigator.clipboard
                .writeText(status!.configPath)
                .then(() => setNotice("已复制原生配置路径。"))
                .catch(() => setError("复制失败，请从路径中手动复制。"))
            }
          >
            <Copy size={14} />
            复制
          </button>
        </div>
        {notice && (
          <p className="mcp-feedback" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="mcp-feedback mcp-tone-failed" role="alert">
            {error}
          </p>
        )}
        <details
          className="mcp-advanced"
          open={advanced}
          onToggle={(event) => setAdvanced(event.currentTarget.open)}
        >
          <summary>
            <ChevronRight size={16} />
            <span>高级设置</span>
            <small>配置文件 · 授权 · 维护</small>
          </summary>
          <div className="mcp-advanced-content">
            {node.adapter === "dsh" && (
              <label className="mcp-profile">
                DSH 原生 profile
                <input
                  aria-label="DSH 原生 profile"
                  value={profile}
                  disabled={busy || disabled}
                  placeholder="与启动 dsh 时的 profile 一致"
                  onChange={(event) => setProfile(event.target.value)}
                />
                <small>
                  Bridge 不会猜测目标 profile，切换后重新读取该目标。
                </small>
              </label>
            )}
            <details
              className="mcp-detail-row"
              open={configurationDetails}
              onToggle={(event) =>
                setConfigurationDetails(event.currentTarget.open)
              }
            >
              <summary>原生配置</summary>
              {status && (
                <>
                  <p>
                    原生配置：<code>{status.configPath || "暂无配置路径"}</code>
                  </p>
                  {status.profile && (
                    <p>
                      {node.adapter === "dsh-desktop"
                        ? "接入的 DSH Desktop Profile："
                        : "原生 Profile："}
                      {status.profile}
                    </p>
                  )}
                  {status.nativeTargetChanged && (
                    <p>
                      当前原生配置：<code>{status.currentConfigPath}</code>
                      。移除仅清理原接入目标，再添加才使用当前选择。
                    </p>
                  )}
                </>
              )}
              {status?.files && (
                <div className="mcp-exported-files">
                  <h4>独立配置文件</h4>
                  {Object.entries(status.files).map(([format, file]) => (
                    <p key={format}>
                      <span>{format}</span>
                      <code>{file}</code>
                    </p>
                  ))}
                  <p>
                    仅适用于该 Agent 所在机器，引用受保护连接文件，不包含授权
                    Token。
                  </p>
                </div>
              )}
              {node.adapter === "pi" && (
                <p>
                  Pi 更改后执行 /reload。原生禁用或项目覆盖请在 Pi
                  中核对，Bridge 不会重新启用。
                </p>
              )}
              {node.adapter === "hermes" && (
                <p>
                  Hermes 更改后执行 /reload-mcp。切换 Profile
                  后先移除原接入，再为当前目标添加。
                </p>
              )}
              {node.adapter === "opendesk-desktop" && (
                <p>
                  桌面会话沿用 OpenDesk
                  原生工作目录。原桌面连接断开后，旧会话仅可查看。
                </p>
              )}
            </details>
            <div className="mcp-authorization-row">
              <div>
                <h4>授权管理</h4>
                <p>连接授权：{view.checks[1]?.value || "未验证"}</p>
              </div>
              {canRevoke && (
                <button
                  className="btn small danger"
                  disabled={busy || reading || disabled}
                  onClick={() => void manage("revoke")}
                >
                  撤销授权
                </button>
              )}
            </div>
            <details
              ref={diagnosticsRef}
              className="mcp-detail-row"
              open={diagnostics}
              onToggle={(event) => setDiagnostics(event.currentTarget.open)}
            >
              <summary>故障诊断</summary>
              <p>
                在原生 Agent 的 MCP 列表核对
                AgentBridge、连接和工具；更改配置后重开或重载会话。本页不会自动覆盖或修复配置。
              </p>
              {boundary === false && (
                <p>
                  {caller === true
                    ? "该产品已有 MCP 客户端，但 Bridge 暂不能管理它的原生 MCP 配置。"
                    : "该产品未确认提供 MCP 客户端，Bridge 暂不能管理它的原生 MCP 配置。"}
                  可导出配置后在原生工具中手动添加。
                </p>
              )}
              {boundary === null && (
                <p>
                  当前后台未报告此 Agent 的原生 MCP
                  配置能力，请升级后台后再核对。
                </p>
              )}
              {status?.nativeSupport === false && (
                <p>
                  {mcpDisplayMessage(
                    status.nativeSupportReason || "原生配置不可管理",
                  )}
                  {status.nativeSupportCode &&
                    `（${status.nativeSupportCode}）`}
                </p>
              )}
              {status?.evidence?.configError && (
                <p className="mcp-tone-failed">
                  {mcpDisplayMessage(status.evidence.configError.message)}
                </p>
              )}
              {status?.conflict && !status.evidence?.configError && (
                <p>
                  同名条目已存在或被外部修改，Bridge
                  会保留原条目，不会自动覆盖。
                </p>
              )}
              {status?.state === "revoked_config_pending" && (
                <p>已撤销连接授权，原生配置仍存在，待清理。</p>
              )}
              {openDesk && (
                <p>
                  {mcpDisplayMessage(status?.lifecycle?.message || writeReason)}{" "}
                  请从托盘完全退出后核对；添加完成需手动重开，并在原生 MCP
                  管理中人工验证。
                </p>
              )}
              {!probeSupported && (
                <p>
                  该接入器暂不支持自动检测，原生加载、连接与工具保持未验证。
                </p>
              )}
              {status && (
                <McpFactsView
                  status={{
                    ...status,
                    facts: status.facts ? view.facts : undefined,
                  }}
                />
              )}
              {view.observedAt && (
                <p>
                  最近探测：{view.observedAt}。
                  {view.fresh
                    ? "观测与当前配置匹配，有效期60秒。"
                    : "探测已过期、配置已变化或缺少绑定证据，请重新探测。"}
                </p>
              )}
              <p>服务端工具目录可用不代表原生Agent已连接或已获准委派。</p>
              {status && (
                <>
                  {status.evidence?.nativeProbe && (
                    <p>{mcpDisplayMessage(probeText(status))}</p>
                  )}
                  {status.evidence?.toolsProbe && (
                    <p>{mcpDisplayMessage(toolsProbeText(status))}</p>
                  )}
                </>
              )}
              {node.adapter.startsWith("opendesk") &&
                status?.launcher === "electron" && (
                  <p className="mcp-tone-failed">
                    OpenDesk 0.3.9 无法启动 Electron MCP 命令，请安装系统
                    Node.js 后重新添加。
                  </p>
                )}
              {node.adapter.startsWith("opendesk") &&
                status?.launcher === "node" && (
                  <p>
                    原生启动器：Node；Bridge 后台仍需保持运行并保留连接授权。
                  </p>
                )}
              {probeSupported && (
                <button
                  className="btn small"
                  disabled={busy || reading || disabled || !node.connected}
                  onClick={() => void manage("probe")}
                >
                  重新探测原生列表
                </button>
              )}
            </details>
            {advancedChildren}
          </div>
        </details>
      </div>
      <footer className="mcp-connection-footer">
        <div ref={menuWrap} className="mcp-menu-wrap" onKeyDown={menuKey}>
          <button
            ref={menuButton}
            className="btn"
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-controls="mcp-actions-menu"
            disabled={busy}
            onClick={() => setMenu(!menu)}
          >
            更多操作
            <ChevronDown size={14} />
          </button>
          {menu && (
            <div
              className="mcp-actions-menu"
              id="mcp-actions-menu"
              role="menu"
              aria-label="MCP 更多操作"
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  role="menuitem"
                  className={item.danger ? "danger" : undefined}
                  disabled={item.disabled}
                  onClick={() => {
                    setMenu(false);
                    menuButton.current?.focus();
                    item.run();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="btn primary mcp-primary-action"
          disabled={primaryDisabled}
          title={
            primaryLabel === "添加 Bridge MCP"
              ? writeReason || undefined
              : undefined
          }
          onClick={primaryAction}
        >
          {busy ? (
            <LoaderCircle size={16} className="mcp-spinning" />
          ) : (
            <PrimaryIcon size={16} />
          )}
          {primaryLabel}
        </button>
      </footer>
    </section>
  );
}
