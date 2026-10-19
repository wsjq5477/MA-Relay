import {
  Activity,
  ArrowRight,
  Folder,
  Monitor,
  Plus,
  Plug,
  Server,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import { agentLabel } from "./api";
import AgentIcon from "./AgentIcon";
import { toolLabel } from "./agent-tools";
import type { Agent, Machine, ToolConnection } from "./types";

export const toolName = toolLabel;
export function MachinesView({
  machines,
  connections,
  instances,
  loading,
  busy,
  onDiscover,
  onCreate,
  onOpenInstances,
}: {
  machines: Machine[];
  connections: ToolConnection[];
  instances: Agent[];
  loading: boolean;
  busy: boolean;
  onDiscover: (machine: Machine) => void;
  onCreate: (connection: ToolConnection) => void;
  onOpenInstances: (machineId: string) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MACHINES & AGENTS</div>
          <h1>机器</h1>
          <p>先选择机器，再连接工具，为项目创建独立实例。</p>
        </div>
        <span className="machine-count">
          <Monitor size={16} />
          {machines.length} 个运行环境 ·{" "}
          {machines.filter((m) => m.online).length} 个在线
        </span>
      </div>
      <div className="machine-intro">
        <Monitor size={19} />
        <p>
          Windows 本机和 WSL 分别管理，在各自环境发现已安装的原生 Agent，沿用其登录和模型配置。
        </p>
      </div>
      <div className="machine-grid">
        {machines.map((machine) => {
          const tools = connections.filter(
            (c) => c.machineId === machine.machineId,
          );
          const owned = instances.filter(
            (a) => a.machineId === machine.machineId,
          );
          return (
            <section
              className="machine-card"
              key={machine.machineId}
              aria-label={machine.name}
            >
              <div className="machine-card-head">
                <div className={"machine-logo " + machine.kind}>
                  {machine.kind === "windows" ? (
                    <Monitor size={27} />
                  ) : (
                    <Terminal size={27} />
                  )}
                </div>
                <div className="machine-heading">
                  <h2>{machine.name}</h2>
                  <p>
                    {machine.kind === "wsl"
                      ? `WSL · ${machine.distribution || "Linux"} · 运行于 Windows 宿主`
                      : machine.kind === "windows"
                        ? "Windows 本机"
                        : "本机 Linux"}
                  </p>
                </div>
                <span
                  className={"badge " + (machine.online ? "success" : "danger")}
                >
                  <i />
                  {machine.online ? "在线" : "无法连接"}
                </span>
              </div>
              <div className="machine-summary">
                <span>
                  <Plug size={14} />
                  {tools.length} 个工具连接
                </span>
                <span>
                  <Folder size={14} />
                  {owned.length} 个项目实例
                </span>
              </div>
              {machine.error && (
                <div className="machine-error">
                  <TriangleAlert size={16} />
                  <span>{machine.error}</span>
                </div>
              )}
              <div className="machine-connections">
                {tools.length ? (
                  tools.map((tool) => {
                    const children = owned.filter(
                      (a) => a.connectionId === tool.connectionId,
                    );
                    return (
                      <div className="machine-tool" key={tool.connectionId}>
                        <div className="machine-tool-head">
                          <div className="agent-logo">
                            <AgentIcon adapter={tool.adapter} size={25} />
                          </div>
                          <div>
                            <strong>
                              {tool.name || toolName(tool.adapter)}
                            </strong>
                            <small>
                              {tool.version ? `v${tool.version} · ` : ""}
                              {toolName(tool.adapter)}
                            </small>
                          </div>
                          <span
                            className={
                              "badge " +
                              (machine.online && tool.connected && tool.healthy
                                ? "success"
                                : "warning")
                            }
                          >
                            <i />
                            {!machine.online
                              ? "机器不可用"
                              : !tool.connected
                                ? "已发现，待连接"
                                : tool.healthy
                                  ? "已连接"
                                  : "连接异常"}
                          </span>
                        </div>
                        {tool.error && (
                          <p className="inline-error">{tool.error}</p>
                        )}
                        <details className="tool-location">
                          <summary>安装位置</summary>
                          <p>{tool.executable}</p>
                        </details>
                        <div className="machine-instance-list">
                          {children.map((instance) => (
                            <button
                              className="machine-instance"
                              key={instance.agentId}
                              onClick={() => onOpenInstances(machine.machineId)}
                            >
                              <Folder size={16} />
                              <div>
                                <strong>{instance.name}</strong>
                                <small title={instance.workspace}>
                                  {instance.workspace}
                                </small>
                              </div>
                              <span>{agentLabel(instance)}</span>
                              <ArrowRight size={14} />
                            </button>
                          ))}
                          {!children.length && (
                            <p className="machine-no-instance">
                              {tool.connected
                                ? "工具已连接，添加项目实例后即可提交任务。"
                                : "已识别安装的工具，连接后可添加项目实例。"}
                            </p>
                          )}
                        </div>
                        <button
                          className="btn small"
                          disabled={
                            busy ||
                            !machine.online ||
                            !tool.connected ||
                            !tool.healthy
                          }
                          onClick={() => onCreate(tool)}
                        >
                          <Plus size={14} />
                          添加项目实例
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="machine-empty">
                    <Server size={24} />
                    <strong>还没有工具连接</strong>
                    <p>
                      发现此环境中安装的原生 Agent，沿用已有登录和模型配置。
                    </p>
                  </div>
                )}
              </div>
              <div className="machine-card-footer">
                <button
                  className="btn"
                  disabled={busy || !machine.online}
                  onClick={() => onDiscover(machine)}
                >
                  <Plug size={15} />
                  发现并连接工具
                </button>
                <button
                  className="text-btn"
                  onClick={() => onOpenInstances(machine.machineId)}
                >
                  查看项目实例
                  <ArrowRight size={14} />
                </button>
              </div>
            </section>
          );
        })}
      </div>
      {!machines.length && (
        <div className="empty">
          <div className="empty-icon">
            <Activity size={26} />
          </div>
          <h3>{loading ? "正在识别机器" : "机器信息暂时不可用"}</h3>
          <p>
            {loading
              ? "正在连接 Windows 本机与 WSL 执行环境。"
              : "请刷新数据或在设置中检查后台连接。"}
          </p>
        </div>
      )}
    </>
  );
}
