import { useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Bot,
  Crown,
  GitBranch,
  Monitor,
  MoreHorizontal,
  Plus,
  Plug,
  RefreshCw,
  Search,
  Server,
  Terminal,
} from "lucide-react";
import { sshStageLabel } from "./AddMachineDialog";
import { time } from "./api";
import AgentIcon from "./AgentIcon";
import { toolLabel } from "./agent-tools";
import {canExecuteNode,connectionCapabilitySummary} from "./connection-capabilities";
import type { NodeAction } from "./node-management";
import type { AgentNode, Collaboration, Machine } from "./types";

type MachineAction =
  | "scan"
  | "disconnect"
  | "reconnect"
  | "details"
  | "edit"
  | "remove"
  | "daemon";
type Tone = "success" | "neutral" | "warning" | "danger";

interface Props {
  machines: Machine[];
  nodes: AgentNode[];
  relation: Collaboration;
  filter: string;
  query: string;
  busy: boolean;
  executionLocked?: boolean;
  metadataBusy: boolean;
  managementReason?: (machineId:string)=>string;
  executionReason?: (machineId?:string,nodeId?:string)=>string;
  managementSupported: boolean;
  machineManagementSupported: boolean;
  daemonManagementSupported: boolean;
  blocked: (machineId?: string, nodeId?: string) => boolean;
  start: (node: AgentNode) => void;
  attach: (id: string) => void;
  nodeAction: (node: AgentNode, action: NodeAction) => void;
  addAgent: (machine: Machine) => void;
  machineAction: (machine: Machine, action: MachineAction) => void;
}

const machineKind = (machine: Machine) =>
  machine.kind === "windows"
    ? "Windows 本机"
    : machine.kind === "wsl"
      ? `WSL · ${machine.distribution || "Linux"}`
      : machine.kind === "ssh"
        ? "SSH · Linux"
        : "Linux 本机";

function nodeState(node: AgentNode): { label: string; tone: Tone } {
  if (!node.online) return { label: "机器离线", tone: "neutral" };
  if (node.status === "upgrade_required") return {label:"后台需要升级",tone:"warning"};
  if (node.status === "version_incompatible") return {label:"版本不兼容，需要 OpenCode 2.x",tone:"danger"};
  if (node.status === "needs_check") return {label:"需要检查原生 API",tone:"warning"};
  if (node.status === "tool_error")
    return { label: "工具检查异常", tone: "danger" };
  if (!canExecuteNode(node))
    return { label: "尚未支持执行", tone: "neutral" };
  if (!node.connected) return { label: "已发现，待接入", tone: "neutral" };
  if (node.unconfirmed || node.uncertain)
    return { label: "原执行待核对", tone: "warning" };
  if (node.waiting) return { label: "等待你处理", tone: "warning" };
  if (node.busy) return { label: "正在工作", tone: "success" };
  if (node.lastError) return { label: "最近执行失败", tone: "danger" };
  return node.available
    ? { label: "可开始会话", tone: "success" }
    : { label: "暂不可执行", tone: "neutral" };
}

export default function MachineInventory(props: Props) {
  const menuRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      for (const menu of menuRoot.current?.querySelectorAll<HTMLDetailsElement>(
        ".inventory-menu[open]",
      ) || []) {
        if (!menu.contains(event.target as Node)) menu.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const menus = Array.from(
        menuRoot.current?.querySelectorAll<HTMLDetailsElement>(
          ".inventory-menu[open]",
        ) || [],
      );
      if (!menus.length) return;
      event.preventDefault();
      event.stopPropagation();
      const focused =
        menus.find((menu) => menu.contains(document.activeElement)) ||
        menus.at(-1)!;
      for (const menu of menus) menu.open = false;
      focused.querySelector<HTMLElement>("summary")?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  const query = props.query.trim().toLocaleLowerCase();
  const machines = props.machines.filter((machine) => !machine.removed);
  const nodes = props.nodes.filter((node) => !node.removed);
  const groups = machines
    .filter(
      (machine) => props.filter === "all" || machine.machineId === props.filter,
    )
    .map((machine) => {
      const owned = nodes.filter(
        (node) => node.machineId === machine.machineId,
      );
      const matchesMachine =
        !query ||
        [
          machine.name,
          machineKind(machine),
          machine.platform,
          machine.host,
          machine.distribution,
        ].some((value) => value?.toLocaleLowerCase().includes(query));
      const visible = matchesMachine
        ? owned
        : owned.filter((node) =>
            [node.name, node.adapter, toolLabel(node.adapter), node.version, node.executable].some(
              (value) => value?.toLocaleLowerCase().includes(query),
            ),
          );
      return {
        machine,
        owned,
        visible,
        matches: matchesMachine || visible.length > 0,
      };
    })
    .filter((group) => group.matches);

  if (!groups.length) {
    return (
      <div className="ui-empty inventory-empty" role="status">
        {query ? <Search size={26} /> : <Monitor size={26} />}
        <h2>{query ? "没有匹配的机器或 Agent" : "从一台机器开始"}</h2>
        <p>
          {query
            ? "试试机器名称、Agent 名称或安装位置。"
            : "本机工具会在扫描后出现在这里，也可以添加一台 Linux 机器。"}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={menuRoot}
      className="inventory-list"
      aria-label="机器与 Agent 列表"
      onClick={(event) => {
        const summary = (event.target as Element).closest('summary');
        const menu = summary?.parentElement;
        if(menu instanceof HTMLDetailsElement && menu.classList.contains('inventory-menu')) {
          event.preventDefault();
          const open = !menu.open;
          for(const other of menuRoot.current?.querySelectorAll<HTMLDetailsElement>('.inventory-menu[open]')||[]) other.open = false;
          menu.open = open;
          return;
        }
        const button = (event.target as Element).closest("button");
        if (button && !button.disabled)
          button.closest("details.inventory-menu")?.removeAttribute("open");
      }}
    >
      {groups.map(({ machine, owned, visible }) => {
        const metadataReason=props.managementReason?.(machine.machineId)??(props.metadataBusy?"原管理操作进行中或待核对。":"");
        const MachineIcon =
          machine.kind === "windows"
            ? Monitor
            : machine.kind === "wsl"
              ? Terminal
              : Server;
        const managementLocked =
          props.busy ||
          props.executionLocked ||
          !!metadataReason ||
          !props.managementSupported ||
          !machine.online ||
          props.blocked(machine.machineId);
        const machineEditLocked =
          props.busy ||
          props.executionLocked ||
          !!metadataReason ||
          !props.machineManagementSupported ||
          !machine.online ||
          !!machine.busy ||
          props.blocked(machine.machineId) ||
          owned.some((node) => node.busy);
        const machineStatus = machine.online
          ? "在线"
          : machine.kind === "ssh"
            ? sshStageLabel(machine.connectionState || machine.stage)
            : "离线";

        return (
          <section
            className="inventory-machine"
            key={machine.machineId}
            aria-label={machine.name}
          >
            <header className="inventory-machine-head">
              <div className="inventory-machine-icon">
                <MachineIcon size={20} />
              </div>
              <div className="inventory-machine-title">
                <h2>{machine.name}</h2>
                <div className="inventory-machine-meta">
                  <span>{machineKind(machine)}</span>
                  <span>
                    {visible.length === owned.length
                      ? `${owned.length} 个工具`
                      : `${visible.length} / ${owned.length} 个工具`}
                  </span>
                  {machine.kind === "wsl" && machine.parentMachineId && (
                    <span>
                      宿主{" "}
                      {machines.find(
                        (item) => item.machineId === machine.parentMachineId,
                      )?.name || "Windows"}
                    </span>
                  )}
                </div>
              </div>
              <span
                className="ui-status"
                data-tone={
                  machine.online
                    ? "success"
                    : machine.error
                      ? "danger"
                      : "neutral"
                }
              >
                {machineStatus}
              </span>
              <div className="inventory-machine-actions">
                <button
                  className="btn small"
                  title={metadataReason}
                  disabled={props.busy || !!metadataReason || !machine.online}
                  onClick={() => props.machineAction(machine, "scan")}
                  aria-label={`重新扫描 · ${machine.name}`}
                >
                  <RefreshCw size={14} />
                  扫描
                </button>
                <button
                  className="btn small"
                  title={metadataReason}
                  disabled={props.busy || !!metadataReason}
                  onClick={() => props.addAgent(machine)}
                  aria-label={`添加 Agent · ${machine.name}`}
                >
                  <Plus size={14} />
                  添加 Agent
                </button>
                <details className="inventory-menu">
                  <summary aria-label={`${machine.name} 的更多操作`}>
                    <MoreHorizontal size={18} />
                  </summary>
                  <div className="inventory-menu-content">
                    <p className="inventory-menu-caption">
                      {machine.platform}
                      {machine.lastSyncedAt
                        ? ` · 同步于 ${time(machine.lastSyncedAt)}`
                        : ""}
                    </p>
                    {machine.kind === "ssh" && (
                      <>
                        <button
                          disabled={props.busy}
                          onClick={() =>
                            props.machineAction(machine, "details")
                          }
                        >
                          连接详情
                        </button>
                        <button
                          title={metadataReason}
                          disabled={
                            props.busy ||
                            !!metadataReason ||
                            (machine.online && !!machine.busy)
                          }
                          onClick={() =>
                            props.machineAction(
                              machine,
                              machine.online ? "disconnect" : "reconnect",
                            )
                          }
                        >
                          {machine.online
                            ? "断开连接"
                            : machine.connectionState === "needs_credentials"
                              ? "输入凭据"
                              : "重新连接"}
                        </button>
                        <button
                          title={metadataReason || (machineEditLocked?"来源机器仍有未结束或待核对的原执行。":"")}
                          disabled={machineEditLocked}
                          onClick={() => props.machineAction(machine, "edit")}
                        >
                          编辑连接
                        </button>
                        <button
                          disabled={
                            props.busy ||
                            !!metadataReason ||
                            !props.daemonManagementSupported ||
                            !machine.online ||
                            !!machine.busy || owned.some(node=>node.busy) || props.blocked(machine.machineId)
                          }
                          onClick={() => props.machineAction(machine, "daemon")}
                          title={metadataReason || (!machine.online?"请先连接来源机器。":machine.busy||owned.some(node=>node.busy)||props.blocked(machine.machineId)?"来源机器仍有运行、等待或待核对的原执行。":!props.daemonManagementSupported?"当前后台不支持维护。":"预览来源后台版本，确认后才执行维护。 ")}
                        >
                          后台维护
                        </button>
                        <button
                          className="inventory-danger"
                          title={metadataReason || (machineEditLocked?"来源机器仍有未结束或待核对的原执行。":"")}
                          disabled={machineEditLocked}
                          onClick={() => props.machineAction(machine, "remove")}
                        >
                          移除机器
                        </button>
                      </>
                    )}
                  </div>
                </details>
              </div>
            </header>
            {machine.progressWarning && <p className="inventory-machine-error" role="status">{machine.progressWarning.message}</p>}
            {machine.error && (
              <p className="inventory-machine-error" role="status">
                {machine.error}
              </p>
            )}
            <div className="inventory-nodes">
              {visible.map((node) => {
                const role =
                  node.nodeId === props.relation.leaderId
                    ? "主 Agent"
                    : props.relation.memberIds.includes(node.nodeId)
                      ? "子 Agent"
                      : "";
                const state = nodeState(node);
                const resourceBlocked = props.blocked(
                  node.machineId,
                  node.nodeId,
                );
                const nodeManagementLocked =
                  managementLocked || !node.online || node.busy;
                const canStart =
                  !props.busy &&
                  !props.executionLocked &&
                  machine.online &&
                  node.online &&
                  node.connected &&
                  canExecuteNode(node) &&
                  node.healthy &&
                  node.available &&
                  !node.busy &&
                  !node.waiting &&
                  !node.unconfirmed &&
                  !node.uncertain &&
                  !resourceBlocked;

                return (
                  <article
                    className="inventory-node"
                    key={node.nodeId}
                    aria-label={`${node.name} · ${role || "Agent"} · ${state.label}`}
                  >
                    <div
                      className="inventory-node-icon"
                      data-adapter={node.adapter}
                    >
                      <AgentIcon adapter={node.adapter} size={28} />
                    </div>
                    <div className="inventory-node-body">
                      <div className="inventory-node-name">
                        <h3>{node.name}</h3>
                        {role && (
                          <span className="inventory-role">
                            {role === "主 Agent" ? (
                              <Crown size={12} />
                            ) : (
                              <GitBranch size={12} />
                            )}
                            {role}
                          </span>
                        )}
                      </div>
                      <div className="inventory-node-meta">
                        <span>{toolLabel(node.adapter)}</span>
                        <span>{node.version || "版本未知"}</span>
                        <span>{node.status === "version_incompatible" ? "版本不兼容" : node.connected ? "已接入" : "未接入"}</span>
                      </div>
                      <small>{connectionCapabilitySummary(node)}</small>
                      <details className="inventory-node-details">
                        <summary>安装位置</summary>
                        <code>{node.executable || "未提供安装位置"}</code>
                      </details>
                      {(node.error || node.lastError) && (
                        <p className="inventory-node-error" role="status">
                          {node.error || node.lastError?.message}
                        </p>
                      )}
                    </div>
                    <div className="inventory-node-status">
                      <span className="ui-status" data-tone={state.tone}>
                        {state.label}
                      </span>
                      {resourceBlocked && <small title={props.executionReason?.(node.machineId,node.nodeId)}>原操作待核对</small>}
                    </div>
                    <div className="inventory-node-actions">
                      {(node.connected && node.status !== "needs_check") ? (
                        <button
                          className="btn small inventory-start"
                          title={props.executionReason?.(node.machineId,node.nodeId)}
                          disabled={!canStart}
                          onClick={() => props.start(node)}
                        >
                          开始会话
                          <ArrowUpRight size={14} />
                        </button>
                      ) : (
                        <button
                          className="btn small"
                          disabled={
                            nodeManagementLocked ||
                            !node.healthy ||
                            (!canExecuteNode(node) && node.status !== "needs_check")
                          }
                          onClick={() => props.attach(node.nodeId)}
                        >
                          <Plug size={14} />
                          接入
                        </button>
                      )}
                      <details className="inventory-menu">
                        <summary
                          aria-label={`${machine.name} / ${node.name} 的更多操作`}
                        >
                          <MoreHorizontal size={18} />
                        </summary>
                        <div className="inventory-menu-content">
                          {node.connected && (
                            <button
                              disabled={nodeManagementLocked}
                              onClick={() =>
                                props.nodeAction(node, "disconnect")
                              }
                            >
                              断开 Agent
                            </button>
                          )}
                          <button
                            className="inventory-danger"
                            disabled={nodeManagementLocked}
                            onClick={() => props.nodeAction(node, "remove")}
                          >
                            移除 Agent
                          </button>
                        </div>
                      </details>
                    </div>
                  </article>
                );
              })}
              {!owned.length && (
                <div className="ui-empty inventory-empty inventory-empty-machine">
                  <Bot size={24} />
                  <h3>这台机器还没有 Agent</h3>
                  <p>
                    {machine.online
                      ? "扫描已安装的原生工具，接入后就可以开始会话。"
                      : "连接这台机器后，扫描已安装的原生工具。"}
                  </p>
                </div>
              )}
            </div>
          </section>
        );
      })}
      <p className="inventory-note">
        接入与可执行状态来自工具检查，真实模型回复以实际任务结果为准。
      </p>
    </div>
  );
}
