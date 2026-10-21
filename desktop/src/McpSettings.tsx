import { useEffect, useState } from "react";
import { Plug } from "lucide-react";
import { call } from "./api";
import type { AgentNode } from "./types";
interface McpStatus {
  enabled: boolean;
  installed: boolean;
  conflict: boolean;
  configPath: string;
  state: "installed" | "exported" | "absent" | "conflict";
  files?: Record<string, string>;
}
const labels = {
  installed: "已添加",
  exported: "已生成独立配置",
  absent: "未添加",
  conflict: "配置冲突",
};
export default function McpSettings({node, disabled = false, onBusyChange}: {
  node: AgentNode;
  disabled?: boolean;
  onBusyChange?: (busy:boolean) => void;
}) {
  const supported = ['claude', 'codex', 'opencode'].includes(node.adapter);
  const nodeId = node.nodeId;
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => {
    let current = true;
    setStatus(null);
    setNotice("");
    if (supported && nodeId)
      void call<McpStatus>("mcp.status", { nodeId })
        .then((result) => {
          if (current) setStatus(result);
        })
        .catch((error) => {
          if (current) setNotice(error.message);
        });
    return () => {
      current = false;
    };
  }, [nodeId, supported, revision]);
  async function manage(action: "install" | "remove" | "export") {
    if (busy || disabled) return;
    setBusy(true);
    setNotice("");
    try {
      setStatus(await call<McpStatus>("mcp." + action, { nodeId }));
      setNotice(
        action === "remove"
          ? "已移除 Bridge MCP 并撤销接入。已有任务仍可在 Bridge 核对。"
          : action === "export"
            ? "已生成独立文件，请将对应条目合入客户端的 MCP 配置。文件仅适用于该 Agent 所在机器。"
            : "已添加到用户配置。请重开 Agent 会话，在 MCP 列表查看 agentbridge。",
      );
    } catch (error) {
      try {
        setStatus(await call<McpStatus>("mcp.status", { nodeId }));
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
          <h2 id="settings-mcp">Agent MCP 接入</h2>
          <p>
            把 Bridge 加到 Agent 的 MCP 列表，日常会话也能使用已授权的连接。
          </p>
        </div>
      </div>
      <p className="settings-footnote">
        支持 Claude Code、Codex 和 OpenCode 2。Windows、WSL 与 SSH
        各自管理用户配置；远端后台需要支持此功能。接入沿用已保存的主从连接关系，Bridge
        后台需保持运行。原生列表可能异步刷新；必要时重开 Agent，OpenCode
        还需重启其原生后台。
      </p>
      {supported ? (
        <>
          <p role="status">
            {status
              ? labels[status.state]
              : notice
                ? "尚未读取配置"
                : "正在读取配置…"}
            {status
              ? status.enabled
                ? " · 接入授权有效"
                : " · 接入授权已关闭"
              : ""}
          </p>
          {status && (
            <p className="settings-footnote">
              原生配置：<code>{status.configPath}</code>
            </p>
          )}
          {status?.conflict && (
            <p role="alert">
              同名条目已存在或被外部修改，Bridge
              会保留原条目。移除仍会先撤销本接入授权。
            </p>
          )}
          <div className="ssh-actions">
            <button
              className="btn primary"
              disabled={
                busy || disabled ||
                !status ||
                status.conflict ||
                status.installed ||
                !node.connected
              }
              onClick={() => void manage("install")}
            >
              添加 Bridge MCP
            </button>
            <button
              className="btn"
              disabled={busy || disabled || !status?.enabled}
              onClick={() => void manage("remove")}
            >
              移除 Bridge MCP
            </button>
            <button
              className="btn"
              disabled={
                busy || disabled ||
                !status ||
                !node.connected
              }
              onClick={() => void manage("export")}
            >
              生成独立 MCP 文件
            </button>
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
                      {format === "codex"
                        ? "Codex TOML"
                        : format === "opencode"
                          ? "OpenCode 2 JSONC"
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
        </>
      ) : (
        <p>这个 Agent 当前不支持 Bridge MCP 配置。</p>
      )}
      {notice && (
        <p role="status" className="settings-footnote">
          {notice}
        </p>
      )}
    </section>
  );
}
