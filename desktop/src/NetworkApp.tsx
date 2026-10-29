import { useEffect, useMemo, useRef, useState } from "react";
import { shareUnchanged } from "./poll-state";
import {
  Monitor,
  Plus,
  X,
  ShieldCheck,
  Search,
  List,
  Network,
} from "lucide-react";
import { bridge, call, invoke, labels } from "./api";
import { TaskDetail } from "./App";
import DaemonDialog, {
  type BlockedOperationResult,
  type MaintenanceBlockers,
} from "./DaemonDialog";
import AddMachineDialog from "./AddMachineDialog";
import { useMachineManagement, type MachineAction } from "./machine-management";
import AgentGraph from "./AgentGraph";
import ConnectionPolicyPanel from "./ConnectionPolicyPanel";
import RelationConflictPanel from './RelationConflictPanel';
import AppShell, { type Page } from "./AppShell";
import MachineInventory from "./MachineInventory";
import AgentConfigurationDialog from './AgentConfigurationDialog';
import AgentIcon from "./AgentIcon";
import { TasksPage, ConversationsPage, SettingsPage } from "./WorkspacePages";
import {useGraphRecovery,mergeRecoveryRows,executionRecoveryReason,relationRecoveryReason,querySummaryText,type ManagementLane} from './management-recovery';
import TeamWorkspace from "./TeamWorkspace";
import { useNodeManagement, type NodeAction } from "./node-management";
import type {
  Snapshot,
  DetailRead,
  AgentNode,
  Conversation,
  Task,
  Journal,
  Preferences,
  Status,
  Machine,
  SshConnectionState,
  RecoveryItem,
} from "./types";
import "./network.css";
import {sshNodeState} from './ssh-node-state';
const empty: Snapshot = {
  configured: false,
  directory: "",
  agents: { items: [], revision: 0, connected: false },
  machines: [],
  nodes: [],
  tasks: [],
  conversations: [],
};
const nodeStatus = (n: AgentNode) =>
  sshNodeState(n) || (
  n.status === "offline"
    ? "机器离线"
    : n.status === "upgrade_required" ? "后台需要升级"
    : n.status === "version_incompatible" ? "版本不兼容，需要 OpenCode 2.x"
    : n.status === "needs_check" ? "需要检查原生 API"
    : n.status === "configuration_required" ? "待配置服务连接"
    : n.status === "tool_error"
      ? "工具检查异常"
      : n.status === "unsupported"
        ? "已发现，尚未支持执行"
        : n.status === "discovered"
          ? "已发现，待接入"
          : n.unconfirmed || n.uncertain
            ? "执行待核对"
            : n.waiting
              ? "等待你处理"
              : n.busy
                ? "正在工作"
                : n.lastError
                  ? "最近执行失败"
                  : "已接入");
export default function NetworkApp() {
  const [data, setData] = useState(empty),
    [page, setPage] = useState<Page>("machines"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<Preferences>({
      theme: "system",
      distribution: "",
      directory: "",
    }),
    [journal, setJournal] = useState<Journal[]>([]),
    [machineFilter, setMachineFilter] = useState("all");
  const [conversation, setConversation] = useState<Conversation | null>(null),
    [task, setTask] = useState<Task | null>(null),
    [showChecks, setShowChecks] = useState(false);
  const [conversationRead,setConversationRead]=useState<DetailRead|null>(null),
    [taskRead,setTaskRead]=useState<DetailRead|null>(null);
  const detailJobs=useRef(new Set<string>()),conversationMachine=useRef<string|undefined>(undefined),taskMachine=useRef<string|undefined>(undefined);
  const [stopDialog, setStopDialog] = useState(false);
  const [recoveryItems, setRecoveryItems] = useState<RecoveryItem[]>([]),
    [querying, setQuerying] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'recovery'|null>(null);
  const [configuration, setConfiguration] = useState<{node:AgentNode;machine:Machine}|null>(null);
  function showSettings(section:'recovery') { setSettingsSection(section); setPage('settings'); }
  function configureAgent(node:AgentNode) {
    const machine=(data.machines || []).find(item=>item.machineId===node.machineId);
    if(machine)setConfiguration({node,machine});
  }
  useEffect(()=>{
    if(page!=='settings'||!settingsSection)return;
    const frame=requestAnimationFrame(()=>{
      document.getElementById('settings-'+settingsSection)?.closest('section')?.scrollIntoView({block:'start'});
      setSettingsSection(null);
    });
    return()=>cancelAnimationFrame(frame);
  },[page,settingsSection]);
  const stopping = useRef(false);
  const [machineView, setMachineView] = useState<"overview" | "graph">(() => {
    try {
      return localStorage.getItem("agentbridge.ui.machineView") === "graph"
        ? "graph"
        : "overview";
    } catch {
      return "overview";
    }
  });
  const [machineQuery, setMachineQuery] = useState("");
  const [graphExecutionLocked, setGraphExecutionLocked] = useState(true);
  const executionLocked = busy || !!error || loading || graphExecutionLocked;
  const machineSearch = useRef<HTMLInputElement>(null);
  function changeMachineView(view: "overview" | "graph") {
    setMachineView(view);
    try {
      localStorage.setItem("agentbridge.ui.machineView", view);
    } catch {
      /* Keep view usable without persistence. */
    }
  }
  const [addAgent, setAddAgent] = useState<Machine | null>(null),
    [nodeDialog, setNodeDialog] = useState<{
      node: AgentNode;
      action: NodeAction;
    } | null>(null);
  const [daemonDialog, setDaemonDialog] = useState<Machine | null>(null);
  const [sshDialog, setSshDialog] = useState<{
    machine?: Machine;
    editing?: boolean;
  } | null>(null);
  const updating = useRef(false),
    alive = useRef(true),
    conversationId = useRef<string | null>(null),
    taskId = useRef<string | null>(null);
  const allMachines = data.machines || [],
    machines = useMemo(() => allMachines.filter((m) => !m.removed), [allMachines]);
  const allNodes = data.nodes || [],
    nodes = useMemo(() => allNodes.filter(
      (n) =>
        !n.removed &&
        !n.supersededBy &&
        !allMachines.find((m) => m.machineId === n.machineId)?.removed,
    ), [allNodes, allMachines]),
    relationship = data.collaboration || {
      leaderId: null,
      memberIds: [],
      revision: 0,
    };
  const [policyOpen,setPolicyOpen]=useState(false);
  const machineName = (id?: string) =>
    allMachines.find((m) => m.machineId === id)?.name || "原机器";
  const nodeName = (id?: string) =>
    allNodes.find((n) => n.nodeId === id)?.name || "历史 Agent";
  const nodeFor = (t: Task | Conversation) =>
    t.nodeId
      ? allNodes.find((n) => n.nodeId === t.nodeId)
      : nodes.find(
          (n) =>
            n.machineId === t.machineId &&
            n.adapter ===
              data.agents.items.find((a) => a.agentId === t.targetAgent)
                ?.adapter,
        );
  async function refreshDetail(kind: "conversation" | "task", snapshot: Snapshot) {
    const id=kind==='conversation'?conversationId.current:taskId.current;
    const source=kind==='conversation'?conversationMachine.current:taskMachine.current;
    if(!id)return;
    const key=kind+':'+source+':'+id;
    if(detailJobs.current.has(key))return;
    detailJobs.current.add(key);
    const current=()=>alive.current&&(kind==='conversation'?conversationId.current===id&&conversationMachine.current===source:taskId.current===id&&taskMachine.current===source);
    try {
      const value=await invoke<Conversation|Task>(kind,{[kind==='conversation'?'conversationId':'taskId']:id,machineId:source});
      if((kind==='conversation'?(value as Conversation)?.conversationId:(value as Task)?.taskId)!==id||(source&&value.machineId&&value.machineId!==source))
        throw Object.assign(Error('原记录身份不匹配。'),{code:'RECEIPT_MISMATCH'});
      if(!current())return;
      if(kind==='conversation'){
        const meta=snapshot.conversations.find(c=>c.conversationId===id&&(!source||c.machineId===source));
        setConversation(previous=>shareUnchanged(previous,{...value as Conversation,nodeId:meta?.nodeId??value.nodeId,workspace:meta?.workspace??value.workspace}));
        setConversationRead(previous=>shareUnchanged(previous,{id,status:'ready'}));
      }else{
        const meta=snapshot.tasks.find(t=>t.taskId===id&&(!source||t.machineId===source));
        setTask(previous=>shareUnchanged(previous,{...value as Task,nodeId:meta?.nodeId??value.nodeId,workspace:meta?.workspace??value.workspace}));
        setTaskRead(previous=>shareUnchanged(previous,{id,status:'ready'}));
      }
    }catch(error){
      if(!current())return;
      const missing=['NOT_FOUND','CONVERSATION_NOT_FOUND','TASK_NOT_FOUND'].includes((error as {code?:string}).code||'');
      const label=kind==='conversation'?'会话':'任务';
      const state:DetailRead={id,status:missing?'missing':'error',message:(error as {code?:string}).code==='DAEMON_UPGRADE_REQUIRED'?'来源机器后台需要升级；请在该机器的后台维护中升级后重新读取原记录。':missing?'原后台和保留历史中未找到这条'+label+'，其他会话仍可使用。':'来源后台暂时无法读取这条'+label+'的详情；请稍后重新读取原记录。'};
      if(kind==='conversation')setConversationRead(previous=>shareUnchanged(previous,state));else setTaskRead(previous=>shareUnchanged(previous,state));
    }finally{detailJobs.current.delete(key);}
  }
  async function refresh() {
    if (updating.current || stopping.current) return;
    updating.current = true;
    let snapshot: Snapshot;
    try {
      const result = await Promise.all([call<Snapshot>("snapshot"),bridge().pending()]);
      snapshot=result[0];
      if (!alive.current) return;
      setData(previous=>shareUnchanged(previous,snapshot));
      setJournal(previous=>shareUnchanged(previous,result[1]));
      setError("");
    } catch (e) {
      if (alive.current) setError((e as Error).message);
      return;
    } finally {
      updating.current = false;
      if (alive.current) setLoading(false);
    }
    // Detail reads have independent lifetimes and errors. A slow/missing object
    // cannot interrupt machine snapshots or an unrelated selected object.
    void refreshDetail('conversation',snapshot);
    void refreshDetail('task',snapshot);
  }
  useEffect(() => {
    alive.current = true;
    void refresh();
    void bridge()
      .preferences()
      .then((p) => {
        if (alive.current) setPrefs(p);
      });
    const timer = setInterval(() => void refresh(), 1500);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!/^(布局已保存。|协作授权已保存。|扫描完成。)$/.test(notice)) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        prefs.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : prefs.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [prefs.theme]);
  const blocked = (machineId?: string, nodeId?: string, chosenWorkspace?:string) =>
    journal.some((r) =>
      nodeId && r.blockedNodeIds
        ? r.blockedNodeIds.includes(nodeId)
        : !r.machineId || r.machineId === machineId,
    ) ||
    !!executionReason(machineId,nodeId,chosenWorkspace);
  const pendingKey = journal.map((r) => r.id + ":" + r.state).join("|");
  useEffect(() => {
    if (!pendingKey || !bridge().recoverPending) return;
    let done = false,
      running = false;
    const recover = async () => {
      if (running) return;
      running = true;
      try {
        const r = await bridge().recoverPending!();
        if (!done) setRecoveryItems(r.items || []);
        if (!done && r.resolved) {
          setJournal(await bridge().pending());
          setNotice("已核对原请求，记录已更新。");
        }
      } catch {
        /* Keep original uncertainty. */
      } finally {
        running = false;
      }
    };
    void recover();
    const timer = setInterval(() => void recover(), 10000);
    return () => {
      done = true;
      clearInterval(timer);
    };
  }, [pendingKey]);
  async function act(
    _key: string,
    work: () => Promise<unknown>,
    success?: string,
  ) {
    if (busy) return false;
    setBusy(true);
    setNotice("");
    try {
      await work();
      if (success) setNotice(success);
      await refresh();
      return true;
    } catch (e) {
      setNotice((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function queryOriginals(cleanup = false) {
    if (busy || querying) return;
    setQuerying(true);
    try {
      await act("recover", async () => {
        const summaries = [];
        if(managementRows.some(row=>row.lane==='node'))summaries.push(await management.query());
        if(managementRows.some(row=>row.lane==='machine'))summaries.push(await machineManagement.query());
        const otherRows=managementRows.filter(row=>row.lane==='relation'||row.lane==='layout');
        if(otherRows.length)summaries.push(await graphRecovery.query(otherRows));
        const api = bridge();
        if (!api.recoverPending)
          throw Error(
            "当前后台不支持原请求核对，请停止旧后台后重新打开新版程序。",
          );
        const result = await api.recoverPending();
        const pending = await api.pending();
        setJournal(pending);
        setRecoveryItems(result.items || []);
        if (cleanup) {
          const rejected = summaries.reduce((total, summary) => total + (summary?.rejected || 0), 0);
          const confirmed = summaries.reduce((total, summary) => total + (summary?.confirmed || 0), 0);
          const remaining = managementRows.length - rejected - confirmed + pending.length;
          setNotice(`清理完成：已解除 ${rejected} 项已失败管理操作的占位，另核对 ${confirmed} 项管理结果、${result.resolved} 项执行请求；仍有 ${remaining} 项待确认。原 ID 与失败历史保留；无法确认的操作继续保留，请查看查询原因。`);
          return;
        }
        setNotice(
          pending.length
            ? `查询完成，已核对 ${result.resolved} 项，仍有 ${pending.length} 项待确认。${result.items?.length ? "请查看下方查询原因。" : "当前后台未提供具体原因，请在设置中停止旧后台后重新打开新版程序。"}`
            : managementRows.length ? `执行请求已核对 ${result.resolved} 项；原管理操作已查询，请查看下方结果。` : `查询完成，已核对 ${result.resolved} 项，没有未确认操作。`,
        );
      });
    } finally {
      setQuerying(false);
    }
  }
  const graphRecovery=useGraphRecovery(data.directory);
  const management = useNodeManagement(data.directory, setNotice, refresh,graphRecovery);
  const machineManagement = useMachineManagement(
    data.directory,
    setNotice,
    refresh,
    graphRecovery,
  );
  const [machineDialog, setMachineDialog] = useState<{
    machine: Machine;
    action: MachineAction;
  } | null>(null);
  const managementLocked =
    busy ||
    management.working ||
    !!management.pending ||
    machineManagement.working ||
    !!machineManagement.pending;
  const managementRows=mergeRecoveryRows(graphRecovery.rows,management.pendingItems.map(management.asRow),machineManagement.pendingItems.map(machineManagement.asRow));
  const managementSummary=querySummaryText(graphRecovery.summary);
  const relationReason=!graphRecovery.loaded||graphRecovery.error||management.storageError||machineManagement.storageError?'原管理台账尚未安全读取，请在设置中核对后再编辑授权。':relationRecoveryReason(managementRows,allNodes,allMachines);
  function executionReason(machineId?:string,nodeId?:string,chosenWorkspace?:string){
    if(!graphRecovery.loaded||graphRecovery.error||management.storageError||machineManagement.storageError)return '原管理台账尚未安全读取，请保留原记录。';
    return executionRecoveryReason(managementRows,machineId,nodeId,allNodes,allMachines,data.instances,chosenWorkspace);
  }
  function queryManagement(lane:ManagementLane){
    if(lane==='node')return management.query();if(lane==='machine')return machineManagement.query();
    return graphRecovery.query(managementRows.filter(row=>row.lane===lane));
  }
  function managementReason(machineId?:string,nodeId?:string){
    const machine=allMachines.find(m=>m.machineId===machineId);
    const reason=management.blockReason(machineId,machine?.connectionId,nodeId)||machineManagement.blockReason(machineId,machine?.connectionId,nodeId);
    return reason?(machine?.name||'来源机器')+'：'+reason:'';
  }
  function nodeAction(node: AgentNode, action: NodeAction) {
    setNodeDialog({ node, action });
  }
  async function stopBackground() {
    if (stopping.current) return;
    stopping.current = true;
    setBusy(true);
    setNotice("");
    try {
      await bridge().window("quit-background");
    } catch (e) {
      stopping.current = false;
      setBusy(false);
      setNotice((e as Error).message);
      setStopDialog(false);
      void refresh();
    }
  }
  async function openConversation(c: Conversation) {
    conversationId.current = c.conversationId;
    conversationMachine.current=c.machineId;
    setConversationRead({id:c.conversationId,status:"loading"});
    setConversation(c);
    setPage("conversations");
    await refresh();
  }
  async function openTask(t: Task) {
    taskId.current = t.taskId;
    taskMachine.current=t.machineId;
    setTaskRead({id:t.taskId,status:"loading"});
    setTask(t);
    await refresh();
  }
  async function reconnectMachine(machine: Machine) {
    if (
      data.machineManagement &&
      machine.connectionId &&
      machine.connectionState !== "needs_credentials"
    ) {
      await machineManagement.run(
        machine.connectionId,
        machine.machineId,
        machine.revision || 1,
        "reconnect",
      );
      return;
    }
    if (machine.connectionState === "needs_credentials") {
      setSshDialog({ machine });
      return;
    }
    await act("reconnect", async () => {
      try {
        const result = await call<{
          status?: SshConnectionState;
          connectionState?: SshConnectionState;
        }>("machine.reconnect", { machineId: machine.machineId });
        if ((result.status || result.connectionState) === "needs_credentials")
          setSshDialog({ machine });
      } catch (failure) {
        if (
          /CREDENTIAL|AUTH_REQUIRED/.test(
            (failure as Error & { code?: string }).code || "",
          )
        ) {
          setSshDialog({ machine });
          return;
        }
        throw failure;
      }
    });
  }
  const scopedConversations = data.conversations.filter(
    (c) => machineFilter === "all" || c.machineId === machineFilter,
  );
  const visibleTasks = data.tasks.filter(
    (t) =>
      !t.verification &&
      (machineFilter === "all" || t.machineId === machineFilter),
  );
  const scopedNodes = nodes.filter(
    (n) => machineFilter === "all" || n.machineId === machineFilter,
  );
  const running = data.tasks.filter(
    (t) =>
      !t.verification && ["queued", "accepted", "running"].includes(t.status),
  ).length;
  function machineAction(
    m: Machine,
    action:
      | "scan"
      | "disconnect"
      | "reconnect"
      | "details"
      | "edit"
      | "remove"
      | "daemon",
  ) {
    if (action === "reconnect") void reconnectMachine(m);
    else if (action === "details") setSshDialog({ machine: m });
    else if (action === "daemon") setDaemonDialog(m);
    else if (action === "edit") setSshDialog({ machine: m, editing: true });
    else if (action === "remove" || action === "disconnect")
      setMachineDialog({ machine: m, action });
    else if (action === "scan")
      void act(
        "scan",
        () => call("discover", { machineId: m.machineId }),
        "扫描完成。",
      );
  }
  const filters = (
    <div className="machine-tabs" aria-label="机器筛选">
      <button
        aria-pressed={machineFilter === "all"}
        className={machineFilter === "all" ? "active" : ""}
        onClick={() => setMachineFilter("all")}
      >
        全部机器
      </button>
      {machines.map((m) => (
        <button
          aria-pressed={machineFilter === m.machineId}
          className={machineFilter === m.machineId ? "active" : ""}
          key={m.machineId}
          onClick={() => setMachineFilter(m.machineId)}
        >
          {m.name}
        </button>
      ))}
    </div>
  );
  return (
    <AppShell
      page={page}
      onPage={setPage}
      preferences={prefs}
      onlineCount={machines.filter((m) => m.online).length}
      loading={loading}
      error={!!error}
      counts={{
        machines: machines.length,
        board: running,
        conversations: data.conversations.filter(
          (c) => c.kind !== "verification",
        ).length,
      }}
      onTheme={() =>
        void act("theme", async () =>
          setPrefs(
            await bridge().savePreferences({
              ...prefs,
              theme:
                document.documentElement.dataset.theme === "dark"
                  ? "light"
                  : "dark",
            }),
          ),
        )
      }
      onRefresh={() => void refresh()}
      onWindow={(action) => void bridge().window(action)}
    >
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button className="btn small" onClick={() => void refresh()}>
            重新连接
          </button>
        </div>
      )}
      {error && <RelationConflictPanel onRecovered={message=>{setNotice(message);void refresh();}}/>}
      {journal.length > 0 && (
        <div className="notice-banner">
          <ShieldCheck size={17} />
          <span>
            {journal.length}{" "}
            个操作的回应尚未确认。原执行资源保留占位，独立节点仍可使用。请查询原请求。
          </span>
          <button className="text-btn" onClick={() => showSettings('recovery')}>
            查看操作
          </button>
        </div>
      )}
      {notice && (
        <div className="network-notice" role="status">
          {notice}
          <button aria-label="关闭提示" onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {managementRows.some(row=>row.lane==='machine') && (
        <div className="notice-banner" role="status">
          原机器管理操作待核对，相关机器的执行、管理及新增授权继续受保护；已有授权可单独撤销。
          <button
            className="text-btn"
            disabled={graphRecovery.querying} onClick={() => void queryManagement('machine')}
          >
            {graphRecovery.querying?'正在查询原管理操作…':'查询原机器操作'}
          </button>
        </div>
      )}
      {managementRows.some(row=>row.lane==='node') && (
        <div className="notice-banner" role="status">
          原节点管理操作待核对，冲突节点的执行、管理及新增授权继续受保护；独立节点仍可使用，已有授权可单独撤销。
          <button className="text-btn" disabled={graphRecovery.querying} onClick={() => void queryManagement('node')}>
            {graphRecovery.querying?'正在查询原管理操作…':'查询原节点操作'}
          </button>
        </div>
      )}
      {(['relation','layout'] as const).filter(lane=>managementRows.some(row=>row.lane===lane)).map(lane=><div key={lane} className="notice-banner" role="status">
        {lane==='relation'?'原协作授权操作待核对，执行与授权保护保留。':'原布局操作待核对，独立执行仍可使用。'}
        <button className="text-btn" disabled={graphRecovery.querying} onClick={()=>void queryManagement(lane)}>{graphRecovery.querying?'正在查询原管理操作…':lane==='relation'?'查询原授权操作':'查询原布局操作'}</button>
      </div>)}
      {managementSummary&&<div className="notice-banner" role="status">{managementSummary}</div>}
      {graphRecovery.error&&<div className="notice-banner" role="status">管理台账读取失败，原未知记录与保护保留；请稍后查询原操作。</div>}
      {page === "teams" &&
        (data.teamSpaceSupported ? (
          <TeamWorkspace nodes={nodes} directory={data.directory} settingsOnly />
        ) : (
          <div className="notice-banner">
            当前后台尚不支持小队协作。请在“设置”中停止后台并退出，再重新打开新版程序。
          </div>
        ))}
      {page === "machines" && (
        <>
          <div className="page-heading">
            <div>
              <h1>接入配置</h1>
              <p>配置机器、原生 Agent 和 MCP；日常需求从原生 Agent 会话发起。</p>
            </div>
            <div className="page-heading-actions">
              <button className="btn" onClick={() => setPolicyOpen(true)}>
                <ShieldCheck size={15} />
                连接策略与确认
              </button>
              <button className="btn primary" onClick={() => setSshDialog({})}>
                <Plus size={15} />
                添加 Linux 机器
              </button>
            </div>
          </div>
          <div className="overview-summary" aria-label="当前机器范围概况">
            <div>
              <div className="summary-copy">
                <strong>
                  {
                    machines.filter(
                      (m) =>
                        machineFilter === "all" ||
                        m.machineId === machineFilter,
                    ).length
                  }
                </strong>
                <span>机器总数</span>
              </div>
            </div>
            <div>
              <div className="summary-copy">
                <strong>
                  {
                    scopedNodes.filter(
                      (n) => n.available && !blocked(n.machineId, n.nodeId),
                    ).length
                  }
                </strong>
                <span>可用 Agent</span>
              </div>
            </div>
            <div>
              <div className="summary-copy">
                <strong>
                  {
                    visibleTasks.filter((t) =>
                      ["queued", "accepted", "running"].includes(t.status),
                    ).length
                  }
                </strong>
                <span>进行中任务</span>
              </div>
            </div>
            <div>
              <div className="summary-copy">
                <strong>{data.relations?data.relations.filter(row=>row.enabled).reduce((sum,row)=>sum+row.memberIds.length,0):relationship.memberIds.length}</strong>
                <span>已保存授权</span>
              </div>
            </div>
          </div>
          <div className="machine-filterbar">
            {filters}
            <div
              className="ui-segmented"
              role="group"
              aria-label="机器显示方式"
            >
              <button
                aria-pressed={machineView === "overview"}
                onClick={() => changeMachineView("overview")}
              >
                <List size={14} />
                概览
              </button>
              <button
                aria-pressed={machineView === "graph"}
                onClick={() => changeMachineView("graph")}
              >
                <Network size={14} />
                关系图
              </button>
            </div>
          </div>
          {machineView === "overview" && (
            <>
              <div className="workspace-toolbar">
                <div className="inventory-section-heading">
                  <h2>机器与 Agent</h2>
                  <span className="machine-count">按机器管理原生工具</span>
                </div>
                <label className="ui-search">
                  <Search size={15} />
                  <input
                    ref={machineSearch}
                    type="search"
                    aria-label="搜索机器与 Agent"
                    placeholder="搜索机器、Agent 或安装位置…"
                    value={machineQuery}
                    onChange={(e) => setMachineQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape" && machineQuery) {
                        e.preventDefault();
                        setMachineQuery("");
                      }
                    }}
                  />
                  {machineQuery && (
                    <button
                      className="icon-btn"
                      aria-label="清空机器搜索"
                      onClick={() => {
                        setMachineQuery("");
                        machineSearch.current?.focus();
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
              </div>
              {loading && !machines.length ? (
                <div className="ui-empty" role="status">
                  <Monitor size={24} />
                  <h3>正在读取机器与 Agent</h3>
                  <p>连接后台后，已有机器和工具会显示在这里。</p>
                </div>
              ) : (
                <MachineInventory
                  openSettings={() => showSettings('recovery')}
                  configure={configureAgent}
                  machines={machines}
                  nodes={nodes}
                  relation={relationship}
                  filter={machineFilter}
                  query={machineQuery}
                  executionLocked={executionLocked}
                  busy={busy}
                  metadataBusy={managementLocked}
                  managementReason={managementReason}
                  executionReason={executionReason}
                  managementSupported={!!data.nodeManagement}
                  machineManagementSupported={!!data.machineManagement}
                  daemonManagementSupported={!!data.daemonManagement}
                  blocked={blocked}
                  configurationOnly
                  attach={(id) => {
                    const n = nodes.find((n) => n.nodeId === id);
                    if (n) void management.run(n.nodeId, n.machineId, "attach");
                  }}
                  nodeAction={nodeAction}
                  addAgent={setAddAgent}
                  machineAction={machineAction}
                />
              )}
            </>
          )}
        </>
      )}
      {policyOpen&&data.directory&&<ConnectionPolicyPanel directory={data.directory} nodes={nodes} machineName={machineName} online={!error&&!loading} onClose={()=>setPolicyOpen(false)}/>}
      {data.directory && (
        <AgentGraph
          key={data.directory}
          directory={data.directory}
          machines={machines}
          nodes={nodes}
          relation={relationship}
          relationReason={relationReason}
          onExecutionLockChange={setGraphExecutionLocked}
          hidden={page !== "machines" || machineView !== "graph"}
          filter={machineFilter}
          online={!error && !loading}
          busy={busy}
                  managementReason={managementReason}
                  executionReason={executionReason}
          notify={setNotice}
          configurationOnly
          blocked={blocked}
          daemonManagementSupported={!!data.daemonManagement}
          machineManagementSupported={!!data.machineManagement}
          managementSupported={!!data.nodeManagement}
          nodeAction={nodeAction}
          addAgent={setAddAgent}
          attach={(id) => {
            const n = nodes.find((n) => n.nodeId === id);
            if (n) void management.run(n.nodeId, n.machineId, "attach");
          }}
          machineAction={machineAction}
          configure={configureAgent}
        />
      )}
      {page === "machines" && (
        <>
          {(data.delegations || []).length > 0 && (
            <section className="network-topology">
              <h3>最近委派</h3>
              {data.delegations!.map((d) => (
                <button
                  className="network-delegation"
                  key={d.delegationId}
                  onClick={() => {
                    const t = data.tasks.find((t) => t.taskId === d.taskId);
                    if (t) void openTask(t);
                  }}
                >
                  <strong>
                    {machineName(
                      nodes.find((n) => n.nodeId === d.leaderId)?.machineId,
                    )}{" "}
                    / {nodeName(d.leaderId)} →{" "}
                    {machineName(
                      nodes.find((n) => n.nodeId === d.memberId)?.machineId,
                    )}{" "}
                    / {nodeName(d.memberId)}
                  </strong>
                  <span>{d.message}</span>
                  <small>
                    {labels[d.state as Status] ||
                      (
                        { pending: "待委派", rejected: "委派未接收" } as Record<
                          string,
                          string
                        >
                      )[d.state] ||
                      "待核对"}
                  </small>
                </button>
              ))}
            </section>
          )}
        </>
      )}
      {page === "board" && (
        <TasksPage
          scope={filters}
          tasks={visibleTasks}
          machineName={machineName}
          nodeFor={nodeFor}
          onOpen={(t) => void openTask(t)}
          auditOnly
        />
      )}
      {page === "conversations" && (
        <ConversationsPage
          scope={filters}
          executionLocked={executionLocked}
          conversations={scopedConversations}
          selected={conversation}
          detailRead={conversationRead}
          onReload={()=>void refresh()}
          showChecks={showChecks}
          onShowChecks={setShowChecks}
          machineName={machineName}
          nodeFor={nodeFor}
          onOpen={(c) => void openConversation(c)}
          onTask={(t) => void openTask(t)}
          auditOnly
          busy={busy}
          blocked={blocked}
        />
      )}
      {page === "settings" && (
        <SettingsPage
          preferences={prefs}
          onTheme={(theme) =>
            void act("prefs", async () =>
              setPrefs(await bridge().savePreferences({ ...prefs, theme })),
            )
          }
          directory={data.directory}
          machines={allMachines}
          nodes={nodes}
          journal={journal}
          recoveryItems={recoveryItems}
          managementRows={managementRows}
          managementOutcomes={graphRecovery.outcomes}
          managementSummary={managementSummary}
          managementQuerying={graphRecovery.querying}
          onQueryManagement={lane=>void queryManagement(lane)}
          onCleanup={()=>void queryOriginals(true)}
          machineName={machineName}
          busy={busy}
          managementLocked={managementLocked}
          managementReason={managementReason}
          machineManagementSupported={!!data.machineManagement}
          onRestore={(m) =>
            void machineManagement.run(
              m.connectionId!,
              m.machineId,
              m.revision || 1,
              "restore",
            )
          }
          onCloseWindow={() => void bridge().window("close")}
          onStop={() => setStopDialog(true)}
          querying={querying}
          onQuery={() => void queryOriginals()}
        />
      )}
      {configuration && <AgentConfigurationDialog
        key={configuration.node.machineId+':'+configuration.node.nodeId}
        node={allNodes.find(node=>node.nodeId===configuration.node.nodeId&&node.machineId===configuration.node.machineId)||configuration.node}
        machine={allMachines.find(machine=>machine.machineId===configuration.machine.machineId)||configuration.machine}
        unavailable={!nodes.some(node=>node.nodeId===configuration.node.nodeId&&node.machineId===configuration.node.machineId)||!machines.some(machine=>machine.machineId===configuration.machine.machineId)}
        onClose={()=>setConfiguration(null)}
      />}
      {addAgent && (
        <div className="modal-overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="添加 Agent"
          >
            <div className="modal-head">
              <h2>添加 Agent · {addAgent.name}</h2>
              <button
                className="icon-btn"
                aria-label="关闭添加 Agent"
                onClick={() => setAddAgent(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>选择这台机器上已安装的原生工具；沿用它自己的账号和配置。</p>
              {!data.nodeManagement && (
                <p role="alert">
                  当前后台不支持节点管理。请在“设置 →
                  后台运行”停止旧后台并重新打开新版程序。
                </p>
              )}
              <button
                className="btn"
                disabled={
                  busy || !addAgent.online
                }
                onClick={() =>
                  void act(
                    "scan",
                    () => call("discover", { machineId: addAgent.machineId }),
                    "扫描完成。",
                  )
                }
              >
                重新扫描 Agent
              </button>
              <div className="node-picker">
                {allNodes
                  .filter((n) => !n.supersededBy && n.machineId === addAgent.machineId)
                  .map((n) => (
                    <div className="agent-candidate" key={n.nodeId}>
                      <strong>
                        <AgentIcon adapter={n.adapter} size={22} /> {n.name} · {n.version || "版本未知"}
                      </strong>
                      <small>
                        {n.removed ? "已移除，可重新接入" : nodeStatus(n)}
                      </small>
                      <code>{n.executable}</code>
                      <button
                        className="btn"
                        disabled={
                          !!managementReason(n.machineId,n.nodeId) || busy ||
                          graphExecutionLocked ||
                          !data.nodeManagement ||
                          !n.online ||
                          !n.healthy ||
                          !n.executionSupported ||
                          n.busy ||
                          blocked(n.machineId) ||
                          (n.connected && !n.removed)
                        }
                        onClick={() =>
                          void management
                            .run(n.nodeId, n.machineId, "attach")
                            .then((ok) => {
                              if (ok) setAddAgent(null);
                            })
                        }
                      >
                        {n.connected && !n.removed
                          ? "已接入"
                          : n.removed
                            ? "重新添加"
                            : "添加并接入"}
                      </button>
                    </div>
                  ))}
              </div>
              {!allNodes.some((n) => !n.supersededBy && n.machineId === addAgent.machineId) && (
                <p>
                  没有发现受支持的
                  Agent。请先在这台机器安装并登录原生工具，再重新扫描。
                </p>
              )}
            </div>
          </section>
        </div>
      )}
      {nodeDialog && (
        <div className="modal-overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              nodeDialog.action === "remove" ? "移除 Agent" : "断开 Agent"
            }
          >
            <div className="modal-head">
              <h2>
                {nodeDialog.action === "remove" ? "移除" : "断开"}{" "}
                {nodeDialog.node.name}？
              </h2>
              <button
                className="icon-btn"
                aria-label="关闭节点操作确认"
                disabled={management.working}
                onClick={() => setNodeDialog(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                {machineName(nodeDialog.node.machineId)} /{" "}
                {nodeDialog.node.name}
              </p>
              <p>
                {nodeDialog.action === "remove"
                  ? "从机器图中移除，之后可在原机器的“添加 Agent”中恢复。"
                  : "停止通过 AgentBridge 接收新需求，保留节点，之后可重新接入。"}
                任务、会话和原生安装配置保留。
              </p>
              <p>
                与此节点有关的协作授权会同时撤销；若它是主
                Agent，会清除当前主节点及子授权。正在执行、等待处理或回应未知的节点无法操作。
              </p>
              <button
                className="btn"
                disabled={management.working}
                onClick={() => setNodeDialog(null)}
              >
                返回
              </button>{" "}
              <button
                className="btn primary"
                disabled={
                  !!managementReason(nodeDialog.node.machineId,nodeDialog.node.nodeId) || busy ||
                  graphExecutionLocked ||
                  !data.nodeManagement ||
                  !nodeDialog.node.online ||
                  nodeDialog.node.busy ||
                  blocked(nodeDialog.node.machineId)
                }
                onClick={() =>
                  void management
                    .run(
                      nodeDialog.node.nodeId,
                      nodeDialog.node.machineId,
                      nodeDialog.action,
                    )
                    .then((ok) => {
                      if (ok) setNodeDialog(null);
                    })
                }
              >
                确认{nodeDialog.action === "remove" ? "移除" : "断开"}
              </button>
            </div>
          </section>
        </div>
      )}
      {machineDialog && (
        <div className="modal-overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="机器操作确认"
          >
            <div className="modal-head">
              <h2>
                {machineDialog.action === "remove" ? "移除机器" : "断开机器"} ·{" "}
                {machineDialog.machine.name}
              </h2>
              <button
                className="icon-btn"
                aria-label="关闭机器操作确认"
                disabled={machineManagement.working}
                onClick={() => setMachineDialog(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                {machineDialog.action === "remove"
                  ? "从机器图移除，并撤销该机器相关的协作授权；可在设置中恢复原机器。"
                  : "断开 SSH 通道并暂停自动重连；之后可手动重新连接。"}
                任务与会话历史、远端后台和原生安装保留。运行、等待或结果未知时请先核对原执行。
              </p>
              {!data.machineManagement && (
                <p role="alert">
                  当前后台不支持机器管理。请在设置中停止旧后台并重新打开新版程序。
                </p>
              )}
              <button
                className="btn"
                disabled={machineManagement.working}
                onClick={() => setMachineDialog(null)}
              >
                返回
              </button>{" "}
              <button
                className="btn primary"
                disabled={busy || !!managementReason(machineDialog.machine.machineId) || !data.machineManagement}
                onClick={() =>
                  void machineManagement
                    .run(
                      machineDialog.machine.connectionId!,
                      machineDialog.machine.machineId,
                      machineDialog.machine.revision || 1,
                      machineDialog.action,
                    )
                    .then((ok) => {
                      if (ok) {
                        setMachineDialog(null);
                        setMachineFilter("all");
                      }
                    })
                }
              >
                确认
                {machineDialog.action === "remove" ? "移除机器" : "断开机器"}
              </button>
            </div>
          </section>
        </div>
      )}
      {stopDialog && (
        <div className="modal-overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="停止后台"
          >
            <div className="modal-head">
              <h2>停止后台并退出？</h2>
              <button
                className="icon-btn"
                aria-label="关闭后台退出确认"
                disabled={busy}
                onClick={() => setStopDialog(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                机器连接与主从协作将暂停。已接收的远端任务不会被取消，任务和会话记录保留。
              </p>
              <p>若只想关闭界面，请选择“仅关闭窗口”。</p>
              <button
                className="btn"
                disabled={busy}
                onClick={() => setStopDialog(false)}
              >
                继续使用
              </button>{" "}
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => void stopBackground()}
              >
                {busy ? "正在停止后台…" : "确认停止并退出"}
              </button>
            </div>
          </section>
        </div>
      )}
      {daemonDialog && (
        <DaemonDialog
          machine={
            allMachines.find((m) => m.machineId === daemonDialog.machineId) ??
            daemonDialog
          }
          pending={!!managementReason(daemonDialog.machineId)}
          onClose={() => setDaemonDialog(null)}
          poll={async () => {
            const intent = machineManagement.pendingItems.find(
              (i) => i.connectionId === daemonDialog.connectionId,
            );
            if (intent) await machineManagement.query(intent, false);
          }}
          blockers={() =>
            call<MaintenanceBlockers>("machine.maintenanceBlockers", {
              connectionId: daemonDialog.connectionId,
              machineId: daemonDialog.machineId,
            })
          }
          queryBlocked={(key, op) =>
            call<BlockedOperationResult>("machine.queryBlockedOperation", {
              connectionId: daemonDialog.connectionId,
              machineId: daemonDialog.machineId,
              key,
              op,
            })
          }
          run={(config) =>
            machineManagement.run(
              daemonDialog.connectionId!,
              daemonDialog.machineId,
              allMachines.find((m) => m.machineId === daemonDialog.machineId)
                ?.revision ||
                daemonDialog.revision ||
                1,
              "maintainDaemon",
              config,
            )
          }
        />
      )}
      {sshDialog && (
        <AddMachineDialog
          machine={sshDialog.machine}
          editing={sshDialog.editing}
          managementPending={!!managementReason(sshDialog.machine?.machineId)}
          updateConnection={(config) =>
            machineManagement.run(
              sshDialog.machine!.connectionId!,
              sshDialog.machine!.machineId,
              allMachines.find(
                (m) => m.machineId === sshDialog.machine!.machineId,
              )?.revision ||
                sshDialog.machine!.revision ||
                1,
              "updateSsh",
              config,
            )
          }
          platform={prefs.platform}
          onClose={() => {
            setSshDialog(null);
            void refresh();
          }}
          onConnected={() => {
            setSshDialog(null);
            setNotice("Linux 机器已连接，已有 Agent 已自动发现。");
            void refresh();
          }}
        />
      )}
      {task && (
        <TaskDetail
          key={JSON.stringify([task.machineId,task.taskId])}
          auditOnly
          task={task}
          readState={taskRead}
          name={nodeFor(task)?.name || "历史 Agent"}
          adapter={nodeFor(task)?.adapter}
          modelOverride={false}
          busy={
            busy ||
            blocked(task.machineId, nodeFor(task)?.nodeId) ||
            !!task.historical ||
            (taskRead?.id===task.taskId&&taskRead.status!=="ready")
          }
          onClose={() => {
            taskId.current = null;
            setTask(null);
          }}
          act={act}
          notify={(text) => setNotice(text)}
          onConversation={() => {
            const c = data.conversations.find(
              (c) => c.conversationId === task.conversationId,
            );
            taskId.current = null;
            setTask(null);
            if (c) void openConversation(c);
          }}
        />
      )}
    </AppShell>
  );
}
