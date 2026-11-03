import type { AgentNode, McpFacts, McpStatus } from "./types";
import {
  canConfigureMcp,
  connectionCapability,
} from "./connection-capabilities";

export type McpSummary = "unconfigured" | "configured" | "ready" | "failed";
export type McpCheckTone = "ok" | "unknown" | "failed";
export interface McpCheck {
  label: string;
  value: string;
  tone: McpCheckTone;
}
export const MCP_OBSERVATION_TTL = 60_000;

export function mcpConnectionActions(
  node: AgentNode,
  status: McpStatus | null,
  disabled = false,
) {
  const boundary = connectionCapability(node, "nativeMcpConfig");
  const configurable = canConfigureMcp(node),
    unsupported = status?.nativeSupport === false;
  const openDesk = node.adapter === "opendesk-desktop";
  const installed =
    status?.installed ||
    status?.enabled ||
    status?.state === "revoked_config_pending" ||
    status?.facts?.config === "disabled";
  const canExport = configurable || boundary === false;
  return {
    canExport,
    canRevoke: canExport && !!status?.enabled,
    canRemove:
      configurable &&
      !unsupported &&
      !!installed &&
      status?.state !== "unsupported" &&
      status?.facts?.ownership !== "external",
    probeSupported:
      boundary === true &&
      !unsupported &&
      !openDesk &&
      status?.nativeProbeSupported !== false,
    canInstall:
      configurable &&
      !unsupported &&
      !!status &&
      !status.conflict &&
      !status.installed &&
      !status.nativeTargetChanged &&
      status.facts?.config !== "disabled" &&
      !disabled &&
      node.online &&
      (node.connected || openDesk) &&
      (!openDesk || status.lifecycle?.safeToWrite === true) &&
      status.state !== "unsupported",
  };
}

/** Presentation only. Config, authorization and native observations never substitute for one another. */
export function mcpConnectionView(status: McpStatus | null, now = Date.now()) {
  const observation = status?.evidence?.observation;
  const observedAt = Date.parse(observation?.observedAt || "");
  const fresh =
    observation?.freshness === "current" &&
    Number.isFinite(observedAt) &&
    now >= observedAt &&
    now - observedAt <= MCP_OBSERVATION_TTL;
  const facts: McpFacts = {
    config: "unknown",
    authorization: "unknown",
    nativeLoad: "unknown",
    connection: "unknown",
    tools: "unknown",
    ownership: "unconfirmed",
    ...status?.facts,
  };
  // A legacy payload proves neither native loading nor connection. Stale positive
  // and negative native observations both lose authority; revocation stays valid.
  if (!fresh || status?.nativeTargetChanged) {
    if (
      facts.nativeLoad !== "unsupported" &&
      facts.nativeLoad !== "reload_required"
    )
      facts.nativeLoad = "unknown";
    facts.connection =
      facts.authorization === "revoked" ? "revoked" : "unknown";
    facts.tools =
      facts.authorization === "revoked" ? "unauthorized" : "unknown";
  }
  if (
    status?.nativeProbeSupported === false ||
    status?.nativeSupport === false
  ) {
    facts.nativeLoad = "unsupported";
    facts.connection =
      facts.authorization === "revoked" ? "revoked" : "unknown";
    facts.tools =
      facts.authorization === "revoked" ? "unauthorized" : "unknown";
  }
  // The current adapter may project a Bridge-side stdio directory as `available`.
  // It is diagnostic server evidence, never proof of tools seen by the native Agent.
  if (
    status?.evidence?.toolsProbe?.kind === "bridge-stdio" &&
    facts.tools === "available"
  )
    facts.tools = "unknown";
  const configError =
    !!status?.conflict ||
    !!status?.evidence?.configError ||
    !!status?.nativeTargetChanged ||
    ["conflict", "disabled"].includes(facts.config);
  const nativeError =
    fresh &&
    (facts.nativeLoad === "not_loaded" ||
      facts.connection === "disconnected" ||
      facts.tools === "unavailable");
  const configured =
    facts.config === "present" ||
    status?.installed === true ||
    status?.state === "installed" ||
    status?.state === "revoked_config_pending";
  let summary: McpSummary = "configured";
  if (configError) summary = "failed";
  else if (
    facts.config === "absent" ||
    (!status?.facts && ["absent", "exported"].includes(status?.state || ""))
  )
    summary = "unconfigured";
  else if (
    facts.authorization === "revoked" ||
    facts.tools === "unauthorized" ||
    nativeError
  )
    summary = "failed";
  else if (
    fresh &&
    facts.config === "present" &&
    facts.authorization === "valid" &&
    facts.nativeLoad === "loaded" &&
    facts.connection === "connected" &&
    facts.tools === "available"
  )
    summary = "ready";
  const configLabels: Record<McpFacts["config"], string> = {
    present: "已写入",
    absent: "未配置",
    disabled: "已禁用",
    conflict: "配置冲突",
    unsupported: "不支持管理",
    unknown: "未验证",
  };
  const checks: McpCheck[] = [
    {
      label: "MCP 配置",
      value: configLabels[facts.config],
      tone:
        facts.config === "present" ? "ok" : configError ? "failed" : "unknown",
    },
    {
      label: "连接授权",
      value:
        facts.authorization === "valid"
          ? "有效"
          : facts.authorization === "revoked"
            ? "已撤销"
            : "未验证",
      tone:
        facts.authorization === "valid"
          ? "ok"
          : facts.authorization === "revoked"
            ? "failed"
            : "unknown",
    },
    {
      label: "Agent 加载",
      value: (
        {
          loaded: "已加载",
          not_loaded: "未加载",
          reload_required: "待重新加载",
          unsupported: "未验证",
          unknown: "未验证",
        } as const
      )[facts.nativeLoad],
      tone:
        facts.nativeLoad === "loaded"
          ? "ok"
          : facts.nativeLoad === "not_loaded"
            ? "failed"
            : "unknown",
    },
    {
      label: "工具可用性",
      value: (
        {
          available: "可用",
          unauthorized: "未授权",
          unavailable: "不可用",
          unknown: "未验证",
        } as const
      )[facts.tools],
      tone:
        facts.tools === "available"
          ? "ok"
          : ["unauthorized", "unavailable"].includes(facts.tools)
            ? "failed"
            : "unknown",
    },
  ];
  return {
    summary,
    facts,
    checks,
    fresh,
    configured,
    observedAt: observation?.observedAt,
  };
}

/** Defensive display redaction; raw native configuration is never rendered. */
export function mcpDisplayMessage(message: string) {
  return message
    .replace(/\bBearer\s+\S+/gi, "Bearer [已隐藏]")
    .replace(
      /((?:token|password|secret|api[_-]?key)\s*[=:]\s*)["']?[^\s,"';]+/gi,
      "$1[已隐藏]",
    )
    .replace(/\bsk-[A-Za-z0-9_-]{12,}/g, "[已隐藏]")
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, "$1[已隐藏]@");
}
