import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Folder,
  GitBranch,
  LayoutDashboard,
  LayoutGrid,
  LoaderCircle,
  MessageSquare,
  Minus,
  Monitor,
  Moon,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Square,
  Sun,
  Terminal,
  TriangleAlert,
  X,
  Zap,
  Plug,
  ArrowUp,
  OctagonX,
} from "lucide-react";
import {
  bridge,
  call,
  invoke,
  labels,
  isTerminal,
  taskLabel,
  agentLabel,
  agentTone,
  time,
  relative,
  shortPath,
  readable,
  isVerificationConversation,
  conversationTitle,
  hasNativeConversation,
  isVerificationTask,
  taskEvents,
  streamingAnswer,
} from "./api";
import type {
  Snapshot,
  Task,
  Agent,
  Conversation,
  Pending,
  Receipt,
  Preferences,
  Journal,
  Field,
  Machine,
  ToolConnection,
  DiscoveredTool,
  ModelSelection,
} from "./types";
import { MachinesView, toolName } from "./MachinesView";
type Page =
  "machines" | "overview" | "agents" | "board" | "conversations" | "settings";
type Toast = { text: string; error?: boolean };
const pages: { id: Page; label: string; icon: typeof Activity }[] = [
  { id: "machines", label: "机器", icon: Monitor },
  { id: "overview", label: "总览", icon: LayoutDashboard },
  { id: "agents", label: "项目实例", icon: Folder },
  { id: "board", label: "任务看板", icon: LayoutGrid },
  { id: "conversations", label: "会话", icon: MessageSquare },
  { id: "settings", label: "设置", icon: Settings2 },
];
const EMPTY: Snapshot = {
  configured: false,
  directory: "",
  agents: { items: [], revision: 0, connected: false },
  tasks: [],
  conversations: [],
  machines: [],
  connections: [],
  instances: [],
};
function Badge({ text, tone = "neutral" }: { text: string; tone?: string }) {
  return (
    <span className={"badge " + tone}>
      <i />
      {text}
    </span>
  );
}
function friendlyError(message: string, _modelOverride = false) {
  if (
    /deprecated|decommissioned|discontinued|retired|no longer (supported|available)|已停用|已下线|停止服务/i.test(
      message,
    )
  )
    return "原生工具配置的模型已停用，请在对应工具中更新配置后新建会话。";
  if (
    /403|permission_error|model.{0,40}(access|permission|forbidden)|无权限.{0,20}模型|模型.{0,20}无权限/i.test(
      message,
    )
  )
    return "原生工具返回模型权限错误，请在对应工具中检查登录和配置。";
  return message;
}
function ErrorMessage({
  message,
  modelOverride = false,
}: {
  message: string;
  modelOverride?: boolean;
}) {
  const summary = friendlyError(message, modelOverride);
  return (
    <div className="instance-error">
      <p className="inline-error">{summary}</p>
      {summary !== message && (
        <details className="raw-error">
          <summary>原始错误详情</summary>
          <pre>{message}</pre>
        </details>
      )}
    </div>
  );
}
function Empty({
  icon: Icon = MessageSquare,
  title,
  detail,
  action,
}: {
  icon?: typeof Activity;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={26} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function useDialogFocus(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input,textarea,button")?.focus();
    const handler = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key !== "Tab") return;
      const nodes = ref.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary",
      );
      if (!nodes?.length) return;
      const first = nodes[0]!,
        last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      prior?.focus();
    };
  }, [ref]);
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onClose);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={"modal " + (wide ? "wide" : "")}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="关闭弹窗">
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export default function App() {
  const [page, setPage] = useState<Page>("machines"),
    [data, setData] = useState(EMPTY),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState<Toast | null>(null),
    [prefs, setPrefs] = useState<Preferences>({
      theme: "system",
      distribution: "",
      directory: "",
    }),
    [runtimes, setRuntimes] = useState<string[]>([]),
    [environment, setEnvironment] = useState<{
      home: string;
      cwd: string;
      node: string;
    } | null>(null),
    [busy, setBusy] = useState(""),
    [search, setSearch] = useState(""),
    [agentFilter, setAgentFilter] = useState("all"),
    [machineFilter, setMachineFilter] = useState("all"),
    [statusFilter, setStatusFilter] = useState("all"),
    [newTask, setNewTask] = useState(false),
    [newTaskAgent, setNewTaskAgent] = useState<string | null>(null),
    [showVerifications, setShowVerifications] = useState(false),
    [connect, setConnect] = useState<Machine | null>(null),
    [newInstance, setNewInstance] = useState(false),
    [createTool, setCreateTool] = useState<ToolConnection | null>(null),
    [modelAgent, setModelAgent] = useState<Agent | null>(null),
    [selected, setSelected] = useState<Task | null>(null),
    [conversation, setConversation] = useState<Conversation | null>(null),
    [journal, setJournal] = useState<Journal[]>([]),
    [lastUpdate, setLastUpdate] = useState<string>("");
  const alive = useRef(true),
    refreshing = useRef(false),
    chosenTask = useRef<string | null>(null),
    chosenConversation = useRef<string | null>(null),
    chosenTaskMachine = useRef<string | undefined>(undefined),
    chosenConversationMachine = useRef<string | undefined>(undefined);
  function notify(text: string, error = false) {
    setToast({ text, error });
  }
  async function refresh() {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const result = await call<Snapshot>("snapshot");
      if (alive.current) {
        setData(result);
        setError("");
        setLastUpdate(new Date().toISOString());
      }
      if (chosenTask.current) {
        const detail = await invoke<Task>("task", {
          taskId: chosenTask.current,
          machineId: chosenTaskMachine.current,
        });
        if (alive.current && detail.taskId === chosenTask.current)
          setSelected(detail);
      }
      if (chosenConversation.current) {
        const c = await invoke<Conversation>("conversation", {
          conversationId: chosenConversation.current,
          machineId: chosenConversationMachine.current,
        });
        if (alive.current && c.conversationId === chosenConversation.current)
          setConversation(c);
      }
      const j = await bridge().pending();
      if (alive.current) setJournal(j);
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "连接失败，请重新连接");
    } finally {
      refreshing.current = false;
      if (alive.current) setLoading(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    void (async () => {
      try {
        const p = await bridge().preferences();
        if (alive.current) setPrefs(p);
        const r = await bridge().runtimes();
        if (alive.current) setRuntimes(r.distributions);
        const env = await call<{ home: string; cwd: string; node: string }>(
          "environment",
        );
        if (alive.current) setEnvironment(env);
      } catch (e) {
        if (alive.current)
          setError(e instanceof Error ? e.message : "桌面服务不可用");
      }
      await refresh();
    })();
    const timer = setInterval(() => void refresh(), 1250);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        prefs.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : prefs.theme);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [prefs.theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(timer);
  }, [toast]);
  async function act(
    key: string,
    work: () => Promise<unknown>,
    message?: string,
  ) {
    if (busy) return false;
    setBusy(key);
    try {
      await work();
      if (message) notify(message);
      await refresh();
      return true;
    } catch (e) {
      notify(
        e instanceof Error ? friendlyError(e.message) : "操作未完成",
        true,
      );
      return false;
    } finally {
      setBusy("");
    }
  }
  async function openTask(task: Task) {
    chosenTask.current = task.taskId;
    chosenTaskMachine.current = task.machineId;
    setSelected(task);
    try {
      setSelected(
        await invoke<Task>("task", {
          taskId: task.taskId,
          machineId: task.machineId,
        }),
      );
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  async function openConversation(c: Conversation) {
    setPage("conversations");
    setConversation(c);
    chosenConversation.current = c.conversationId;
    chosenConversationMachine.current = c.machineId;
    chosenTask.current = null;
    setSelected(null);
    try {
      setConversation(
        await invoke<Conversation>("conversation", {
          conversationId: c.conversationId,
          machineId: c.machineId,
        }),
      );
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  function closeTask() {
    chosenTask.current = null;
    chosenTaskMachine.current = undefined;
    setSelected(null);
  }
  const pendingKey = journal.map(j => j.id + ":" + j.state).join("|");
  useEffect(() => {
    if (!pendingKey || !bridge().recoverPending) return;
    let active = true, querying = false;
    async function recover() {
      if (querying) return;
      querying = true;
      try {
        const result = await bridge().recoverPending!();
        if (active && result.resolved) {
          setJournal(await bridge().pending());
          notify("已核对原操作的后台记录，未确认提示已更新。");
        }
      } catch { /* Retain the warning while its source cannot be checked. */ }
      finally { querying = false; }
    }
    void recover();
    const timer = setInterval(() => void recover(), 10000);
    return () => { active = false; clearInterval(timer); };
  }, [pendingKey]);
  const machines = data.machines || [];
  const connections = data.connections || [];
  const allAgents = data.instances || data.agents.items;
  const agents = allAgents.filter(
    (a) => machineFilter === "all" || a.machineId === machineFilter,
  );
  const machineConversations = data.conversations.filter(
    (c) => machineFilter === "all" || c.machineId === machineFilter,
  );
  const normalConversations = machineConversations.filter(c => !isVerificationConversation(c));
  const visibleConversations = showVerifications ? machineConversations : normalConversations;
  const machineName = (id?: string) =>
    machines.find((m) => m.machineId === id)?.name || "原运行环境";
  const instanceSource = (a?: Agent) =>
    a ? `${machineName(a.machineId)} · ${toolName(a.adapter)}` : "历史实例";
  const conversationAgent = allAgents.find(a => a.agentId === conversation?.targetAgent);
  const conversationLast = conversation?.items?.at(-1);
  const verificationConversation = conversation ? isVerificationConversation(conversation) : false;
  const unboundConversation = !!conversation && !!conversationLast && isTerminal(conversationLast) && !hasNativeConversation(conversation);
  const conversationModelError = conversationLast?.status === "failed" && conversationLast.error &&
    friendlyError(conversationLast.error.message) !== conversationLast.error.message;
  const recoveryDisabled = !!busy || journal.length > 0 || !conversationAgent?.available || !conversationLast || !isTerminal(conversationLast);
  function startNewConversation() {
    if (!conversationAgent || recoveryDisabled) return;
    setNewTaskAgent(conversationAgent.agentId);
    setNewTask(true);
  }
  async function verifyConversationConnection() {
    const agent = conversationAgent;
    if (!agent || recoveryDisabled) return;
    await act("verify-" + agent.agentId, async () => {
      const task = await invoke<Task>("verify", {
        agentId: agent.agentId, machineId: agent.machineId,
        requestId: crypto.randomUUID(),
        message: "只回复标记 AB_VERIFY_" + crypto.randomUUID().replaceAll("-", "").slice(0, 24) + "，不要执行其他动作。",
      });
      await openConversation({
        conversationId: task.conversationId, targetAgent: task.targetAgent,
        machineId: task.machineId, title: "连接验证", kind: "verification",
        turns: 1, updatedAt: task.updatedAt, lastTaskId: task.taskId,
      });
    });
  }
  function discoverDefault() {
    const machine =
      machines.find((m) => m.machineId === machineFilter) ||
      machines.find((m) => m.online) ||
      machines[0];
    if (machine) setConnect(machine);
    else setPage("machines");
  }
  function createInstance(tool?: ToolConnection) {
    setCreateTool(tool || null);
    setNewInstance(true);
  }
  const tasks = data.tasks.filter(
    (t) =>
      !isVerificationTask(t) &&
      (machineFilter === "all" || t.machineId === machineFilter),
  );
  const active = tasks.filter((t) => !isTerminal(t)),
    attention = tasks.filter((t) => t.waiting || t.status === "unknown");
  const filtered = tasks.filter(
    (t) =>
      (agentFilter === "all" || t.targetAgent === agentFilter) &&
      (statusFilter === "all" || t.status === statusFilter) &&
      (t.message.toLowerCase().includes(search.toLowerCase()) ||
        (allAgents.find((a) => a.agentId === t.targetAgent)?.name || "")
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const agentName = (id: string) =>
    allAgents.find((a) => a.agentId === id)?.name || "历史实例";
  const columns = [
    {
      key: "queued",
      label: "待开始",
      icon: Clock3,
      items: filtered.filter((t) => ["queued", "accepted"].includes(t.status)),
    },
    {
      key: "running",
      label: "进行中",
      icon: Activity,
      items: filtered.filter((t) => t.status === "running" && !t.waiting),
    },
    {
      key: "attention",
      label: "等待处理",
      icon: TriangleAlert,
      items: filtered.filter((t) => t.waiting || t.status === "unknown"),
    },
    {
      key: "done",
      label: "已结束",
      icon: CheckCircle2,
      items: filtered.filter(isTerminal),
    },
  ];
  const connected = agents.filter(
    (a) => a.enabled && a.online && a.healthy,
  ).length;
  function taskCard(t: Task) {
    return (
      <button
        key={t.taskId}
        className="task-card"
        onClick={() => void openTask(t)}
      >
        <div className="card-top">
          <span className="tiny-agent">
            <Terminal size={13} />
            {agentName(t.targetAgent)}
          </span>
          <MoreHorizontal size={16} />
        </div>
        <h3>{t.message}</h3>
        <p className="task-source">
          {instanceSource(allAgents.find((a) => a.agentId === t.targetAgent))}
        </p>
        {(t.waiting || t.status === "unknown" || t.status === "failed") && (
          <p className="card-note">
            {t.waiting
              ? "需要你的授权或输入"
              : t.status === "unknown"
                ? "核对原任务后继续"
                : t.error
                  ? friendlyError(
                      t.error.message,
                      !!allAgents.find((a) => a.agentId === t.targetAgent)
                        ?.model,
                    )
                  : "查看失败原因"}
          </p>
        )}
        <div className="card-bottom">
          <Badge
            text={taskLabel(t)}
            tone={
              t.waiting || t.status === "unknown"
                ? "warning"
                : t.status === "failed"
                  ? "danger"
                  : t.status === "succeeded"
                    ? "success"
                    : "neutral"
            }
          />
          <span>{relative(t.updatedAt)}</span>
        </div>
      </button>
    );
  }
  const newButton = (
    <button
      className="btn primary"
      onClick={() => { setNewTaskAgent(null); setNewTask(true); }}
      disabled={
        journal.length > 0 ||
        !!error ||
        !agents.some((a) => a.enabled && a.available)
      }
    >
      <Plus size={16} />
      新建任务
    </button>
  );
  return (
    <div className="app-shell">
      <div className="titlebar">
        <div className="titlebar-brand">
          <GitBranch size={15} />
          <span>AgentBridge</span>
        </div>
        <div className="titlebar-center">你的 Agent 工作台</div>
        <div className="window-controls">
          <button
            onClick={() => void bridge().window("minimize")}
            aria-label="最小化"
          >
            <Minus size={15} />
          </button>
          <button
            onClick={() => void bridge().window("maximize")}
            aria-label="最大化"
          >
            <Square size={12} />
          </button>
          <button
            className="close"
            onClick={() => void bridge().window("close")}
            aria-label="关闭窗口"
          >
            <X size={17} />
          </button>
        </div>
      </div>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <GitBranch size={22} />
          </div>
          <div>
            <strong>AgentBridge</strong>
            <span>连接 · 执行 · 协作</span>
          </div>
        </div>
        <div className="workspace-selector">
          <div className="workspace-icon">
            <Monitor size={18} />
          </div>
          <label className="machine-selector-label">
            <span>查看机器</span>
            <select
              aria-label="选择机器"
              value={machineFilter}
              onChange={(e) => {
                setMachineFilter(e.target.value);
                setAgentFilter("all");
              }}
            >
              <option value="all">所有机器</option>
              {machines.map((m) => (
                <option value={m.machineId} key={m.machineId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="nav-label">工作台</div>
        <nav>
          {pages.map((p) => (
            <button
              key={p.id}
              className={"nav-item " + (page === p.id ? "active" : "")}
              onClick={() => {
                setPage(p.id);
                setSearch("");
              }}
            >
              <p.icon size={18} />
              <span>{p.label}</span>
              {p.id === "board" && attention.length > 0 && (
                <b>{attention.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div
            className={
              "connection-dot " +
              (data.agents.connected && !error ? "online" : "")
            }
          >
            <i />
            <span>
              {error
                ? "后台连接异常"
                : data.agents.connected
                  ? "后台已连接"
                  : loading
                    ? "正在连接后台"
                    : "后台未连接"}
            </span>
          </div>
          <button
            className="sidebar-help"
            onClick={() => {
              setPage("settings");
              notify("关闭窗口后后台任务继续运行；操作结果不明时查询原请求。");
            }}
          >
            <CircleHelp size={16} />
            使用说明
            <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-meta">
            <span>v{prefs.version || "0.4.0"}</span>
            <button
              className="icon-btn"
              aria-label="切换深浅主题"
              onClick={() => {
                const theme =
                  document.documentElement.dataset.theme === "dark"
                    ? "light"
                    : "dark";
                setPrefs({ ...prefs, theme });
                void bridge()
                  .savePreferences({ ...prefs, theme })
                  .catch((e) => notify(e.message, true));
              }}
            >
              {document.documentElement.dataset.theme === "dark" ? (
                <Sun size={15} />
              ) : (
                <Moon size={15} />
              )}
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <span className="breadcrumb">
            {machineFilter === "all" ? "所有机器" : machineName(machineFilter)}{" "}
            <ChevronRight size={13} />
            <strong>{pages.find((p) => p.id === page)?.label}</strong>
          </span>
          <div className="topbar-actions">
            <span className="sync-status">
              <i className={error ? "" : "online"} />
              {loading ? "正在同步" : error ? "连接异常" : "实时同步"}
            </span>
            <button
              className="icon-btn"
              aria-label="刷新数据"
              onClick={() => void refresh()}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>
        <div className="content">
          {error && (
            <div className="error-banner" role="alert">
              <TriangleAlert size={18} />
              <div>
                <strong>后台暂时不可用</strong>
                <p>{error}</p>
              </div>
              <button className="btn small" onClick={() => void refresh()}>
                重新连接
              </button>
              <button className="text-btn" onClick={() => setPage("settings")}>
                查看设置
              </button>
            </div>
          )}
          {journal.length > 0 && (
            <div className="notice-banner">
              <ShieldCheck size={17} />
              <span>
                {journal.length}{" "}
                个操作的回应尚未确认。请查询原请求，避免重复执行。
              </span>
              <button className="text-btn" onClick={() => setPage("settings")}>
                查看操作
              </button>
            </div>
          )}
          {page === "machines" && (
            <MachinesView
              machines={machines.filter(
                (m) => machineFilter === "all" || m.machineId === machineFilter,
              )}
              connections={connections}
              instances={allAgents}
              loading={loading}
              busy={!!busy}
              onDiscover={setConnect}
              onCreate={createInstance}
              onOpenInstances={(machineId) => {
                setMachineFilter(machineId);
                setAgentFilter("all");
                setPage("agents");
              }}
            />
          )}
          {page === "overview" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">WORKSPACE OVERVIEW</div>
                  <h1>一眼掌握，正在发生的事</h1>
                  <p>连接你的 Agent，把每一次执行变成看得见的进展。</p>
                </div>
                {newButton}
              </div>
              <div className="stats">
                {[
                  {
                    label: "在线项目实例",
                    value: connected,
                    detail: `共 ${agents.length} 个项目实例`,
                    icon: Server,
                    tone: "success",
                  },
                  {
                    label: "活动任务",
                    value: active.length,
                    detail: "已接收、运行与待核对",
                    icon: Activity,
                    tone: "neutral",
                  },
                  {
                    label: "需要你处理",
                    value: attention.length,
                    detail: "授权、输入或结果核对",
                    icon: ShieldCheck,
                    tone: "warning",
                  },
                  {
                    label: "已完成任务",
                    value: tasks.filter((t) => t.status === "succeeded").length,
                    detail: "当前加载的最近任务",
                    icon: CheckCircle2,
                    tone: "neutral",
                  },
                ].map((s) => (
                  <div className="stat" key={s.label}>
                    <div className="stat-label">
                      {s.label}
                      <s.icon size={17} />
                    </div>
                    <strong className={s.tone}>{s.value}</strong>
                    <small>
                      {error ? "上次同步的状态，等待重新连接" : s.detail}
                    </small>
                  </div>
                ))}
              </div>
              {!data.configured && !loading && !error && (
                <div className="welcome-card">
                  <div className="welcome-art">
                    <GitBranch size={44} />
                    <span className="orbit-dot" />
                    <span className="orbit-dot second" />
                  </div>
                  <div>
                    <span className="eyebrow">开始连接</span>
                    <h2>连接机器上的 Agent 工具</h2>
                    <p>
                      查看 Windows 的 Claude Code 和 WSL 的 OpenCode。
                      <br />
                      沿用已有模型配置，不需要再次填写 API Key。
                    </p>
                    <button
                      className="btn primary"
                      onClick={() => setPage("machines")}
                    >
                      <Plus size={16} />
                      查看机器与工具
                    </button>
                  </div>
                </div>
              )}
              <div className="overview-grid">
                <section className="panel">
                  <div className="section-head">
                    <h2>
                      项目实例<span>{connected} 在线</span>
                    </h2>
                    <button
                      className="text-btn"
                      onClick={() => setPage("agents")}
                    >
                      查看全部
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  {agents.length ? (
                    agents.map((a) => (
                      <button
                        className="agent-row"
                        key={a.agentId}
                        onClick={() => setPage("agents")}
                      >
                        <div className="agent-logo">
                          <Terminal size={21} />
                        </div>
                        <div className="row-body">
                          <strong>
                            {a.name}
                            {a.default && (
                              <span className="default-tag">默认</span>
                            )}
                          </strong>
                          <p>
                            {instanceSource(a)} · {shortPath(a.workspace)}
                          </p>
                        </div>
                        <Badge
                          text={error ? "状态待刷新" : agentLabel(a)}
                          tone={error ? "neutral" : agentTone(a)}
                        />
                      </button>
                    ))
                  ) : (
                    <Empty
                      icon={Plug}
                      title="还没有项目实例"
                      detail="在机器页连接工具后，为项目添加实例。"
                    />
                  )}
                </section>
                <section className="panel">
                  <div className="section-head">
                    <h2>
                      需要你处理<span>{attention.length}</span>
                    </h2>
                    <button
                      className="text-btn"
                      onClick={() => setPage("board")}
                    >
                      任务看板
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  {attention.length ? (
                    attention.slice(0, 4).map((t) => (
                      <button
                        className="attention-row"
                        key={t.taskId}
                        onClick={() => void openTask(t)}
                      >
                        <div className="attention-icon">
                          <ShieldCheck size={19} />
                        </div>
                        <div>
                          <strong>
                            {t.waiting
                              ? "Agent 等待你的决定"
                              : "执行结果需要核对"}
                          </strong>
                          <p>{t.message.slice(0, 66)}</p>
                        </div>
                        <ChevronRight size={16} />
                      </button>
                    ))
                  ) : (
                    <Empty
                      icon={CheckCircle2}
                      title="当前没有待办"
                      detail="Agent 需要授权、输入或核对时，会在这里提醒你。"
                    />
                  )}
                </section>
              </div>
              <section className="panel recent-panel">
                <div className="section-head">
                  <h2>最近会话</h2>
                  <button
                    className="text-btn"
                    onClick={() => setPage("conversations")}
                  >
                    所有会话
                    <ArrowRight size={14} />
                  </button>
                </div>
                {normalConversations.length ? (
                  <div className="conversation-list">
                    {normalConversations.slice(0, 5).map((c) => (
                      <button
                        key={c.conversationId}
                        onClick={() => void openConversation(c)}
                      >
                        <MessageSquare size={18} />
                        <div>
                          <strong>{c.title}</strong>
                          <small>
                            {agentName(c.targetAgent)} ·{" "}
                            {machineName(c.machineId)} · {c.turns} 轮对话
                          </small>
                        </div>
                        <span>{relative(c.updatedAt)}</span>
                        <ArrowUpRight size={16} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="从一个需求开始"
                    detail="任务和回答会保存在同一会话中，随时回来继续。"
                    action={newButton}
                  />
                )}
              </section>
            </>
          )}
          {page === "agents" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">
                  PROJECT INSTANCES<h1>项目实例</h1>
                  <p>每个实例属于一台机器和一个工具连接，保留独立会话。</p>
                </div>
                <button
                  className="btn primary"
                  onClick={() => createInstance()}
                >
                  <Plus size={16} />
                  添加项目实例
                </button>
              </div>
              <div className="filter-line">
                <div className="tabs">
                  <button className="selected">
                    {machineFilter === "all"
                      ? "所有实例"
                      : machineName(machineFilter)}{" "}
                    <span>{agents.length}</span>
                  </button>
                  <span className="filter-hint">
                    <Terminal size={14} />
                    Claude Code / OpenCode
                  </span>
                </div>
                <span className="subtle">{connected} 个在线</span>
              </div>
              <div className="agent-grid">
                {agents.map((a) => (
                  <div
                    className={"agent-card " + (a.default ? "is-default" : "")}
                    key={a.agentId}
                  >
                    <div className="agent-card-head">
                      <div className="agent-logo">
                        <Terminal size={25} />
                      </div>
                      <div>
                        <h2>
                          {a.name}
                          {a.default && (
                            <span className="default-tag">默认</span>
                          )}
                        </h2>
                        <small>
                          {toolName(a.adapter)}
                          {a.nativeAgent ? ` · ${a.nativeAgent}` : ""}
                        </small>
                      </div>
                      <Badge
                        text={error ? "状态待刷新" : agentLabel(a)}
                        tone={error ? "neutral" : agentTone(a)}
                      />
                    </div>
                    <div className="agent-card-details">
                      <div>
                        <Folder size={15} />
                        <span title={a.workspace}>{a.workspace}</span>
                      </div>
                      <div>
                        <Zap size={15} />
                        <span>
                          {a.model
                            ? `实例指定 · ${a.adapter === "claude" ? a.model.id : `${a.model.providerID} / ${a.model.id}`}`
                            : a.selectedModel
                              ? `继承默认 · ${a.adapter === "claude" ? a.selectedModel.id : `${a.selectedModel.providerID} / ${a.selectedModel.id}`}`
                              : "继承原生默认模型"}
                        </span>
                      </div>
                      <div>
                        <Monitor size={15} />
                        <span>{machineName(a.machineId)}</span>
                      </div>
                    </div>
                    {a.startupError && (
                      <ErrorMessage
                        message={a.startupError.message}
                        modelOverride={!!a.model}
                      />
                    )}
                    {a.busy && (
                      <button
                        className="active-work"
                        onClick={() => {
                          const t = tasks.find(
                            (t) => t.taskId === a.currentTask?.taskId,
                          );
                          if (t) void openTask(t);
                        }}
                      >
                        <Activity size={15} />
                        {a.currentTask?.status === "unknown"
                          ? "有任务需要核对"
                          : "正在处理任务"}
                        <ArrowRight size={14} />
                      </button>
                    )}
                    <div className="agent-card-footer">
                      <button
                        className="btn small"
                        disabled={!!busy}
                        onClick={() =>
                          void act(
                            "check-" + a.agentId,
                            () =>
                              invoke("check", {
                                agentId: a.agentId,
                                machineId: a.machineId,
                              }),
                            "连接检查完成；此次没有调用模型。",
                          )
                        }
                      >
                        <RefreshCw
                          size={14}
                          className={
                            busy === "check-" + a.agentId ? "spin" : ""
                          }
                        />
                        检查连接
                      </button>
                      <button
                        className="btn small"
                        disabled={
                          !!busy ||
                          a.busy ||
                          a.currentTask?.status === "unknown"
                        }
                        onClick={() => setModelAgent(a)}
                      >
                        <Zap size={14} />
                        模型设置
                      </button>
                      {(a.capabilities?.verification === true ||
                        (!a.capabilities && a.adapter !== "claude")) && (
                        <button
                          className="btn small"
                          disabled={!!busy || !a.available}
                          onClick={() =>
                            void act("verify-" + a.agentId, async () => {
                              const task = await invoke<Task>("verify", {
                                agentId: a.agentId,
                                machineId: a.machineId,
                                requestId: crypto.randomUUID(),
                                message:
                                  "只回复标记 AB_VERIFY_" +
                                  crypto
                                    .randomUUID()
                                    .replaceAll("-", "")
                                    .slice(0, 24) +
                                  "，不要执行其他动作。",
                              });
                              await openTask(task);
                            })
                          }
                        >
                          验证回复
                        </button>
                      )}
                      <button
                        className="text-btn"
                        disabled={!!busy || a.default}
                        onClick={() =>
                          void act(
                            "default",
                            () =>
                              invoke("default", {
                                agentId: a.agentId,
                                machineId: a.machineId,
                                expectedRevision:
                                  a.settingsRevision ?? data.agents.revision,
                              }),
                            "已设为该机器的新任务默认实例",
                          )
                        }
                      >
                        设为默认
                      </button>
                      <button
                        className={"switch " + (a.enabled ? "on" : "")}
                        aria-label={
                          a.enabled ? "停用 " + a.name : "启用 " + a.name
                        }
                        aria-checked={a.enabled}
                        role="switch"
                        disabled={!!busy}
                        onClick={() =>
                          void act(
                            "enabled",
                            () =>
                              invoke("save", {
                                machineId: a.machineId,
                                expectedRevision:
                                  a.settingsRevision ?? data.agents.revision,
                                agent: {
                                  agentId: a.agentId,
                                  enabled: !a.enabled,
                                },
                              }),
                            a.enabled ? "已停用；现有任务继续保留" : "已启用",
                          )
                        }
                      >
                        <span />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {!agents.length && (
                <Empty
                  icon={Server}
                  title="为项目添加一个实例"
                  detail="先在机器页连接工具，再选择该机器上的项目目录。"
                  action={
                    <button
                      className="btn primary"
                      onClick={() => setPage("machines")}
                    >
                      <Plus size={16} />
                      查看机器与工具
                    </button>
                  }
                />
              )}
              <div className="footnote">
                <ShieldCheck size={14} />
                检查连接只读取元数据。支持“验证回复”的工具会产生一次实际模型调用。
              </div>
            </>
          )}
          {page === "board" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">TASK BOARD</div>
                  <h1>任务看板</h1>
                  <p>从接收需求到完成执行，每一步都有记录。</p>
                </div>
                {newButton}
              </div>
              <div className="board-toolbar">
                <div className="search-input">
                  <Search size={16} />
                  <input
                    aria-label="搜索任务"
                    placeholder="搜索任务或项目实例…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="筛选项目实例"
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                >
                  <option value="all">所有项目实例</option>
                  {agents.map((a) => (
                    <option key={a.agentId} value={a.agentId}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="筛选任务状态"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">所有状态</option>
                  {Object.entries(labels).map(([id, label]) => (
                    <option value={id} key={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <span className="board-count">{filtered.length} 项任务</span>
              </div>
              <div className="kanban">
                {columns.map((c) => (
                  <section className={"kanban-column " + c.key} key={c.key}>
                    <div className="column-head">
                      <c.icon size={15} />
                      <h2>{c.label}</h2>
                      <span>{c.items.length}</span>
                    </div>
                    <div className="column-body">
                      {c.items.map(taskCard)}
                      {!c.items.length && (
                        <div className="column-empty">暂无{c.label}任务</div>
                      )}
                    </div>
                  </section>
                ))}
              </div>
              <div className="footnote">
                <Clock3 size={14} />
                展示所选机器的近期任务，可切换“所有机器”同时查看两边进展。待核对的任务保持占位，避免重复执行。
              </div>
            </>
          )}
          {page === "conversations" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">CONVERSATIONS</div>
                  <h1>会话</h1>
                  <p>保留上下文，继续完成你的需求。</p>
                </div>
                {newButton}
              </div>
              <label className="verification-history-toggle">
                <input type="checkbox" checked={showVerifications} onChange={e => {
                  setShowVerifications(e.target.checked);
                  if (!e.target.checked && verificationConversation) {
                    chosenConversation.current = null;
                    chosenConversationMachine.current = undefined;
                    setConversation(null);
                  }
                }} />
                显示连接验证记录
              </label>
              <div className="conversation-workspace">
                <div className="conversation-sidebar">
                  <div className="search-input">
                    <Search size={15} />
                    <input
                      placeholder="搜索会话…"
                      aria-label="搜索会话"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  {visibleConversations
                    .filter((c) =>
                      conversationTitle(c).toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((c) => (
                      <button
                        key={c.conversationId}
                        className={
                          "conversation-choice " +
                          (conversation?.conversationId === c.conversationId
                            ? "chosen"
                            : "")
                        }
                        onClick={() => void openConversation(c)}
                      >
                        <MessageSquare size={17} />
                        <div>
                          <strong>{conversationTitle(c)}</strong>
                          <span>
                            {machineName(c.machineId)} · {c.turns} 轮 ·{" "}
                            {relative(c.updatedAt)}
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
                <div className="conversation-reading">
                  {conversation ? (
                    <>
                      <div className="conversation-title">
                        <h2>{conversationTitle(conversation)}</h2>
                        <span>
                          {agentName(conversation.targetAgent)} ·{" "}
                          {machineName(conversation.machineId)} ·{" "}
                          {conversation.turns} 轮
                        </span>
                      </div>
                      <div className="turns">
                        {conversation.items?.map((t) => (
                          <div className="turn" key={t.taskId}>
                            <div className="user-question">
                              <span>{verificationConversation ? "系统验证" : "你"} · 第 {t.turn || 1} 轮</span>
                              <p>{verificationConversation ? "检查此项目实例的模型能否真实回复。" : t.message}</p>
                            </div>
                            <div className="assistant-answer">
                              <div className="answer-meta">
                                <Terminal size={16} />
                                <strong>{agentName(t.targetAgent)}</strong>
                                <Badge
                                  text={taskLabel(t)}
                                  tone={
                                    t.status === "succeeded"
                                      ? "success"
                                      : t.waiting || t.status === "unknown"
                                        ? "warning"
                                        : t.status === "failed"
                                          ? "danger"
                                          : "neutral"
                                  }
                                />
                                <button
                                  className="text-btn"
                                  onClick={() => void openTask(t)}
                                >
                                  查看过程
                                  <ArrowUpRight size={13} />
                                </button>
                              </div>
                              <p>
                                {(t.result ? (isVerificationTask(t) ? "模型真实回复验证通过。" : t.result.message) : "") ||
                                  (t.error
                                    ? friendlyError(
                                        t.error.message,
                                        !!allAgents.find(
                                          (a) => a.agentId === t.targetAgent,
                                        )?.model,
                                      )
                                    : "") ||
                                  t.uncertaintyReason ||
                                  streamingAnswer(t, allAgents.find(a => a.agentId === t.targetAgent)?.adapter) ||
                                  (t.waiting
                                    ? "Agent 正在等待你的授权或输入。"
                                    : "Agent 正在执行，可打开过程查看进度。")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {verificationConversation || unboundConversation ? (
                        <div className="conversation-recovery">
                          <strong>{verificationConversation ? "这是连接验证记录" : "这次任务没有建立原生会话"}</strong>
                          <p>{conversationModelError
                            ? "这次验证使用的模型不可用。请检查模型设置并重新验证，通过后再开始实际会话。"
                            : unboundConversation
                            ? "这次启动已失败，原记录保留。请重新验证连接，或新建会话发送需求。"
                            : conversationLast && !isTerminal(conversationLast)
                              ? "正在验证，请等待本轮结束；结果待核对时可从执行过程核对原任务。"
                              : "连接验证用于检查真实回复。请新建会话发送你的实际需求。"}</p>
                          <div className="recovery-actions">
                            {verificationConversation && (
                              <button className="btn" disabled={recoveryDisabled} onClick={() => void verifyConversationConnection()}>
                                <RefreshCw size={15} />重新验证连接
                              </button>
                            )}
                            <button className="btn primary" disabled={recoveryDisabled} onClick={startNewConversation}>
                              <Plus size={15} />新建会话
                            </button>
                            {conversationAgent && (
                              <button className="btn" disabled={!!busy || conversationAgent.busy || conversationAgent.currentTask?.status === "unknown"} onClick={() => setModelAgent(conversationAgent)}>
                                <Zap size={15} />模型设置
                              </button>
                            )}
                          </div>
                          {conversationLast?.status === "unknown" && <p>原任务结果未确认，不能重新验证或提交新需求。</p>}
                          {!conversationAgent?.available && <p>对应项目实例当前不可接单，请先检查连接或处理占用。</p>}
                        </div>
                      ) : <Composer
                        key={conversation.conversationId}
                        agentId={conversation.targetAgent}
                        disabled={
                          !!busy ||
                          journal.length > 0 ||
                          !conversation.items?.length ||
                          !hasNativeConversation(conversation) ||
                          !isTerminal(
                            conversation.items[conversation.items.length - 1]!,
                          )
                        }
                        label="继续追问，保留当前上下文…"
                        submit={(message) =>
                          act("continue", async () => {
                            const t = await invoke<Task>("continue", {
                              conversationId: conversation.conversationId,
                              machineId: conversation.machineId,
                              requestId: crypto.randomUUID(),
                              message,
                            });
                            await openTask(t);
                          })
                        }
                      />}
                    </>
                  ) : (
                    <Empty
                      title={normalConversations.length ? "选择一个会话" : "开始你的第一个会话"}
                      detail="点击新建任务发送实际需求。连接验证记录可勾选上方选项查看。"
                      action={newButton}
                    />
                  )}
                </div>
              </div>
            </>
          )}
          {page === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">PREFERENCES</div>
                  <h1>设置</h1>
                  <p>让工作台与你的运行环境保持一致。</p>
                </div>
              </div>
              <section className="settings-panel">
                <div className="settings-section">
                  <div>
                    <h2>外观</h2>
                    <p>选择你习惯的主题，默认跟随系统。</p>
                  </div>
                  <div className="theme-choices">
                    {[
                      { id: "light", label: "浅色", icon: Sun },
                      { id: "dark", label: "深色", icon: Moon },
                      { id: "system", label: "跟随系统", icon: Monitor },
                    ].map((t) => (
                      <button
                        className={prefs.theme === t.id ? "selected" : ""}
                        key={t.id}
                        onClick={() =>
                          void act("theme", async () => {
                            const p = {
                              ...prefs,
                              theme: t.id as Preferences["theme"],
                            };
                            await bridge().savePreferences(p);
                            setPrefs(p);
                          })
                        }
                      >
                        <t.icon size={18} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="settings-section">
                  <div>
                    <h2>Agent 运行环境</h2>
                    <p>
                      {prefs.platform === "win32"
                        ? "同时管理 Windows 本机的 Claude Code 与 WSL 中的 OpenCode。机器页切换视图不会断开另一边。"
                        : "当前运行在本机 Linux 开发环境。"}
                    </p>
                  </div>
                  <div className="settings-fields">
                    <label>
                      默认 WSL 发行版
                      <select
                        value={prefs.distribution || runtimes[0] || ""}
                        disabled={prefs.platform !== "win32"}
                        onChange={(e) =>
                          setPrefs({ ...prefs, distribution: e.target.value })
                        }
                      >
                        {runtimes.length ? (
                          runtimes.map((r) => (
                            <option value={r} key={r}>
                              {r}
                            </option>
                          ))
                        ) : (
                          <option value="">本机环境</option>
                        )}
                      </select>
                    </label>
                    <label>
                      WSL Bridge 数据目录
                      <input
                        placeholder="留空使用已有默认实例"
                        value={prefs.directory}
                        onChange={(e) =>
                          setPrefs({ ...prefs, directory: e.target.value })
                        }
                      />
                    </label>
                    <div className="field-help">
                      WSL 路径，例如
                      /home/用户名/.local/state/agentbridge。此处是后台数据存放位置，与项目实例不同；更改目录不会搬迁旧历史。
                    </div>
                    <button
                      className="btn primary"
                      disabled={!!busy}
                      onClick={() =>
                        void act(
                          "preferences",
                          async () => {
                            await bridge().savePreferences(prefs);
                            await refresh();
                          },
                          "运行设置已保存",
                        )
                      }
                    >
                      保存并重新连接
                    </button>
                  </div>
                </div>
                <div className="settings-section">
                  <div>
                    <h2>连接诊断</h2>
                    <p>这些信息仅用于排查，不需要手工配置内部 ID。</p>
                  </div>
                  <dl className="diagnostics">
                    <dt>后台连接</dt>
                    <dd>{data.agents.connected ? "已连接" : "未连接"}</dd>
                    <dt>后台数据目录</dt>
                    <dd>{data.directory || "尚未连接"}</dd>
                    <dt>后台 Node</dt>
                    <dd>{environment?.node || "未读取"}</dd>
                    <dt>最近同步</dt>
                    <dd>{lastUpdate ? time(lastUpdate) : "尚未同步"}</dd>
                    <dt>任务持久化</dt>
                    <dd>沿用现有 Bridge 台账</dd>
                    <dt>机器与工具</dt>
                    <dd>
                      {machines.length} 个环境 · {connections.length} 个工具连接
                      · {allAgents.length} 个项目实例
                    </dd>
                  </dl>
                </div>
                {journal.length > 0 && (
                  <div className="settings-section">
                    <div>
                      <h2>回应待核对的操作</h2>
                      <p>不会自动重发，请查询原 ID 确认效果。</p>
                    </div>
                    <div className="pending-operations">
                      {journal.map((j) => (
                        <div key={j.id}>
                          <span>
                            {j.op === "submit"
                              ? "提交任务"
                              : j.op === "continue"
                                ? "继续追问"
                                : j.op === "verify"
                                  ? "连接验证"
                                : j.op === "cancel"
                                  ? "取消任务"
                                  : "原生回复"}{" "}
                            ·{" "}
                            {machineName(
                              typeof j.params.machineId === "string"
                                ? j.params.machineId
                                : undefined,
                            )}{" "}
                            · {time(j.time)}
                          </span>
                          <button
                            className="btn small"
                            disabled={!!busy}
                            onClick={() =>
                              void act("query-" + j.id, async () => {
                                if (
                                  ["submit", "continue", "verify"].includes(
                                    j.op,
                                  )
                                ) {
                                  const t = await invoke<Task>("request", {
                                    requestId: j.id,
                                    machineId: j.params.machineId,
                                  });
                                  await openTask(t);
                                } else {
                                  const r = await invoke<Receipt>("operation", {
                                    taskId: j.params.taskId,
                                    operationId: j.id,
                                    machineId: j.params.machineId,
                                  });
                                  notify(
                                    "原操作状态：" +
                                      ({
                                        confirmed: "已确认",
                                        unknown: "回应未知",
                                        rejected: "已拒绝",
                                      }[r.state] || r.state),
                                  );
                                }
                              })
                            }
                          >
                            查询原操作
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="settings-section">
                  <div>
                    <h2>关于 AgentBridge</h2>
                    <p>Windows 桌面工作台 · v{prefs.version || "0.4.0"}</p>
                  </div>
                  <div className="about-note">
                    <GitBranch size={22} />
                    <p>
                      关闭窗口后，后台继续运行。
                      <br />
                      取消任务是单独操作，已发生的修改不会自动撤销。
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
        <div className="statusbar">
          <span>
            <GitBranch size={12} />
            AgentBridge Workspace
          </span>
          <span>
            {machineFilter === "all" ? "所有机器" : machineName(machineFilter)}
            <span className="statusbar-separator">·</span>
            {data.agents.connected ? "后台运行中" : "等待连接"}
          </span>
        </div>
      </main>
      {toast && (
        <div className={"toast " + (toast.error ? "error" : "")} role="status">
          {toast.error ? (
            <TriangleAlert size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          <span>{toast.text}</span>
          <button
            className="icon-btn"
            aria-label="关闭提示"
            onClick={() => setToast(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {newTask && (
        <NewTask
          agents={newTaskAgent ? allAgents.filter(a => a.agentId === newTaskAgent) : agents}
          machines={machines}
          busy={!!busy}
          onClose={() => { setNewTask(false); setNewTaskAgent(null); }}
          submit={(agentId, message) =>
            act("submit", async () => {
              const t = await invoke<Task>("submit", {
                agentId,
                machineId: allAgents.find((a) => a.agentId === agentId)
                  ?.machineId,
                message,
                requestId: crypto.randomUUID(),
              });
              setNewTask(false);
              const recovery = !!newTaskAgent;
              setNewTaskAgent(null);
              if (recovery) {
                await openConversation({
                  conversationId: t.conversationId, machineId: t.machineId,
                  targetAgent: t.targetAgent, title: message,
                  turns: 1, updatedAt: t.updatedAt, lastTaskId: t.taskId,
                });
              } else await openTask(t);
            })
          }
        />
      )}
      {connect && (
        <ConnectDialog
          machine={connect}
          busy={!!busy}
          onClose={() => setConnect(null)}
          onConnect={(executable) =>
            act(
              "connect",
              async () => {
                await call("connectTool", {
                  machineId: connect.machineId,
                  executable,
                });
                setConnect(null);
                setPage("machines");
              },
              "工具连接已登记，可为项目添加实例。",
            )
          }
        />
      )}
      {newInstance && (
        <InstanceDialog
          machines={machines}
          connections={connections}
          initialTool={createTool}
          initialMachineId={machineFilter}
          busy={!!busy}
          onClose={() => setNewInstance(false)}
          onDiscover={(machineId) => {
            setNewInstance(false);
            const machine = machines.find((m) => m.machineId === machineId);
            if (machine) setConnect(machine);
            else discoverDefault();
          }}
          onCreate={(machineId, connectionId, workspace, model) =>
            act(
              "create-instance",
              async () => {
                await call("createInstance", {
                  machineId,
                  connectionId,
                  workspace,
                  ...(model ? { model } : {}),
                });
                setNewInstance(false);
                setMachineFilter(machineId);
                setPage("agents");
              },
              "项目实例已创建。",
            )
          }
        />
      )}
      {modelAgent && (
        <InstanceModelDialog
          agent={modelAgent}
          machineName={machineName(modelAgent.machineId)}
          busy={!!busy}
          locked={
            !!allAgents.find((a) => a.agentId === modelAgent.agentId)?.busy ||
            allAgents.find((a) => a.agentId === modelAgent.agentId)?.currentTask
              ?.status === "unknown"
          }
          onClose={() => setModelAgent(null)}
          onSave={(model) =>
            act(
              "instance-model",
              async () => {
                await call("setInstanceModel", {
                  machineId: modelAgent.machineId,
                  agentId: modelAgent.agentId,
                  expectedRevision:
                    modelAgent.settingsRevision ?? data.agents.revision,
                  model,
                });
                setModelAgent(null);
              },
              "实例模型已更新，请新建会话使用。已有记录已保留。",
            )
          }
        />
      )}
      {selected && (
        <TaskDetail
          task={selected}
          adapter={allAgents.find(a => a.agentId === selected.targetAgent)?.adapter}
          name={`${agentName(selected.targetAgent)} · ${machineName(selected.machineId)}`}
          modelOverride={
            !!allAgents.find((a) => a.agentId === selected.targetAgent)?.model
          }
          busy={!!busy}
          onClose={closeTask}
          act={act}
          notify={notify}
          onConversation={() => {
            const c = data.conversations.find(
              (c) => c.conversationId === selected.conversationId,
            );
            if (c) {
              if (isVerificationConversation(c)) setShowVerifications(true);
              void openConversation(c);
            }
          }}
        />
      )}
    </div>
  );
}
function Composer({
  disabled,
  label,
  submit,
}: {
  agentId: string;
  disabled: boolean;
  label: string;
  submit: (message: string) => Promise<unknown>;
}) {
  const [message, setMessage] = useState("");
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (!message.trim() || disabled) return;
        void submit(message.trim()).then((ok) => {
          if (ok) setMessage("");
        });
      }}
    >
      <textarea
        aria-label="继续追问"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={disabled ? "上一轮结束后可继续追问" : label}
        disabled={disabled}
      />
      <div>
        <span>Enter 换行 · 点击发送继续当前会话</span>
        <button
          className="send-btn"
          disabled={disabled || !message.trim()}
          aria-label="发送追问"
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </form>
  );
}
function NewTask({
  agents,
  machines,
  busy,
  onClose,
  submit,
}: {
  agents: Agent[];
  machines: Machine[];
  busy: boolean;
  onClose: () => void;
  submit: (id: string, message: string) => Promise<unknown>;
}) {
  const available = agents.filter((a) => a.enabled && a.available);
  const [agentId, setAgentId] = useState(
      available.find((a) => a.default)?.agentId || available[0]?.agentId || "",
    ),
    [message, setMessage] = useState("");
  const selected = agents.find((a) => a.agentId === agentId);
  return (
    <Modal title="新建任务" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (message.trim() && agentId && !busy)
            void submit(agentId, message.trim());
        }}
      >
        <div className="modal-body">
          <p className="modal-intro">
            描述你想完成的事情，Agent 会在所选项目中执行。
          </p>
          <label>
            执行项目实例
            <select
              aria-label="执行项目实例"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              {available.map((a) => (
                <option key={a.agentId} value={a.agentId}>
                  {machines.find((m) => m.machineId === a.machineId)?.name ||
                    "原运行环境"}{" "}
                  / {toolName(a.adapter)} / {a.name} · {shortPath(a.workspace)}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <div className="project-note">
              <Folder size={14} />
              {selected.workspace}
            </div>
          )}
          <label>
            任务需求
            <textarea
              aria-label="任务需求"
              placeholder="例如：分析项目结构，说明下一步应该完善的模块…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={65536}
              rows={7}
              required
            />
          </label>
          <div className="field-help">
            <ShieldCheck size={14} />
            {selected?.capabilities?.permissions === false
              ? "沿用工具已有权限策略。此工具当前不支持窗口内授权交互。"
              : "需要文件修改授权时，会在窗口里请你决定。"}
          </div>
          {!available.length && (
            <p className="inline-error">
              当前没有可接单的项目实例，请先创建实例或处理已有任务。
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            disabled={busy || !agentId || !message.trim()}
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <ArrowUpRight size={16} />
            )}
            提交任务
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ConnectDialog({
  machine,
  busy,
  onClose,
  onConnect,
}: {
  machine: Machine;
  busy: boolean;
  onClose: () => void;
  onConnect: (exe: string) => Promise<unknown>;
}) {
  const [items, setItems] = useState<DiscoveredTool[]>([]),
    [chosen, setChosen] = useState(""),
    [scanning, setScanning] = useState(true),
    [error, setError] = useState("");
  async function scan() {
    setScanning(true);
    setError("");
    setChosen("");
    try {
      const result = await call<{ items: DiscoveredTool[] }>("discover", {
        machineId: machine.machineId,
      });
      setItems(result.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }
  useEffect(() => {
    void scan();
  }, [machine.machineId]);
  return (
    <Modal title={"发现工具 · " + machine.name} onClose={onClose}>
      <div className="modal-body">
        <p className="modal-intro">
          自动识别这台机器已安装的工具，按空格选中即可连接。沿用已有登录与模型配置。
        </p>
        <div className="project-note">
          <Monitor size={15} />
          {machine.name}
          {machine.kind === "wsl"
            ? " · WSL " + machine.distribution
            : " · " + machine.platform}
        </div>
        {scanning ? (
          <div className="scan-state">
            <LoaderCircle className="spin" size={20} />
            正在扫描{machine.kind === "windows" ? " Claude Code" : " OpenCode"}…
          </div>
        ) : items.length ? (
          items.map((item) => (
            <label
              className={
                "detected-agent " + (chosen === item.executable ? "chosen" : "")
              }
              key={item.executable}
            >
              <input
                type="checkbox"
                checked={chosen === item.executable}
                onChange={(e) =>
                  setChosen(e.target.checked ? item.executable : "")
                }
              />
              <div className="agent-logo">
                <Terminal size={23} />
              </div>
              <div>
                <strong>
                  {item.name || toolName(item.adapter)}
                  <span className="default-tag">
                    {item.connectionId ? "已有连接" : "已发现"}
                  </span>
                </strong>
                <small>
                  {item.version ? "v" + item.version + " · " : ""}
                  {item.executable}
                </small>
              </div>
            </label>
          ))
        ) : (
          <div className="scan-state">
            <TriangleAlert size={20} />
            <div>
              没有发现可用工具
              <p>
                {machine.kind === "windows"
                  ? "请在 Windows 本机安装或修复 Claude Code 后重新扫描。"
                  : "请在此 WSL / Linux 环境安装或修复 OpenCode 后重新扫描。"}
              </p>
            </div>
          </div>
        )}
        {error && <p className="inline-error">{error}</p>}
        <div className="field-help">
          扫描与连接不会调用模型。工具连接完成后，再为需要使用的项目添加实例。
        </div>
      </div>
      <div className="modal-footer">
        <button
          className="text-btn"
          disabled={scanning || busy}
          onClick={() => void scan()}
        >
          <RefreshCw size={14} />
          重新扫描
        </button>
        <button
          className="btn primary"
          disabled={busy || !chosen || scanning}
          onClick={() => void onConnect(chosen)}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Plug size={16} />
          )}
          连接工具
        </button>
      </div>
    </Modal>
  );
}
function InstanceDialog({
  machines,
  connections,
  initialTool,
  initialMachineId,
  busy,
  onClose,
  onDiscover,
  onCreate,
}: {
  machines: Machine[];
  connections: ToolConnection[];
  initialTool: ToolConnection | null;
  initialMachineId: string;
  busy: boolean;
  onClose: () => void;
  onDiscover: (machineId: string) => void;
  onCreate: (
    machineId: string,
    connectionId: string,
    workspace: string,
    model?: ModelSelection,
  ) => Promise<unknown>;
}) {
  const firstMachine =
    initialTool?.machineId ||
    (initialMachineId !== "all"
      ? initialMachineId
      : connections.find((c) => c.connected && c.healthy)?.machineId ||
        machines.find((m) => m.online)?.machineId ||
        "");
  const [machineId, setMachineId] = useState(firstMachine);
  const [connectionId, setConnectionId] = useState(
    initialTool?.connectionId ||
      connections.find(
        (c) => c.machineId === firstMachine && c.connected && c.healthy,
      )?.connectionId ||
      "",
  );
  const [workspace, setWorkspace] = useState("");
  const [modelId, setModelId] = useState("");
  const [providerID, setProviderID] = useState("");
  const [folderError, setFolderError] = useState("");
  const machine = machines.find((m) => m.machineId === machineId);
  const tools = connections.filter(
    (c) => c.machineId === machineId && c.connected && c.healthy,
  );
  const tool = tools.find((c) => c.connectionId === connectionId);
  const modelValid =
    tool?.adapter === "claude" ||
    (!modelId.trim() && !providerID.trim()) ||
    (!!modelId.trim() && !!providerID.trim());
  async function pickFolder() {
    try {
      setFolderError("");
      const path = await bridge().pickFolder(machineId);
      if (path) setWorkspace(path);
    } catch (e) {
      setFolderError((e as Error).message);
    }
  }
  return (
    <Modal title="添加项目实例" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            machine?.online &&
            tool &&
            workspace.trim() &&
            modelValid &&
            !busy
          )
            void onCreate(
              machineId,
              connectionId,
              workspace.trim(),
              modelId.trim()
                ? {
                    providerID:
                      tool.adapter === "claude" ? "claude" : providerID.trim(),
                    id: modelId.trim(),
                  }
                : undefined,
            );
        }}
      >
        <div className="modal-body">
          <p className="modal-intro">
            选择工具运行在哪台机器，以及它要处理的项目。其余配置沿用原生工具。
          </p>
          <label>
            运行机器
            <select
              aria-label="实例运行机器"
              value={machineId}
              disabled={busy}
              onChange={(e) => {
                setMachineId(e.target.value);
                setConnectionId(
                  connections.find(
                    (c) =>
                      c.machineId === e.target.value &&
                      c.connected &&
                      c.healthy,
                  )?.connectionId || "",
                );
                setWorkspace("");
                setModelId("");
                setProviderID("");
                setFolderError("");
              }}
            >
              <option value="" disabled>
                选择机器
              </option>
              {machines.map((m) => (
                <option
                  value={m.machineId}
                  key={m.machineId}
                  disabled={!m.online}
                >
                  {m.name}
                  {m.online ? "" : " · 无法连接"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Agent 工具
            <select
              aria-label="实例Agent工具"
              value={connectionId}
              disabled={!tools.length || busy}
              onChange={(e) => {
                setConnectionId(e.target.value);
                setModelId("");
                setProviderID("");
              }}
            >
              {tools.length ? (
                tools.map((c) => (
                  <option key={c.connectionId} value={c.connectionId}>
                    {c.name || toolName(c.adapter)}
                    {c.version ? " · v" + c.version : ""}
                  </option>
                ))
              ) : (
                <option value="">此机器尚无可用工具连接</option>
              )}
            </select>
          </label>
          {!tools.length && (
            <div className="field-help">
              先在机器页连接已安装的工具。
              <button
                type="button"
                className="text-btn"
                onClick={() => onDiscover(machineId)}
              >
                发现并连接工具
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          <label>
            工作项目
            <div className="folder-input">
              <input
                aria-label="工作项目"
                required
                value={workspace}
                disabled={busy}
                placeholder={
                  machine?.kind === "windows"
                    ? "例如 C:\\Projects\\my-app"
                    : "例如 /home/用户名/projects/my-app"
                }
                onChange={(e) => setWorkspace(e.target.value)}
              />
              <button
                type="button"
                className="btn"
                disabled={busy || !machine?.online}
                onClick={() => void pickFolder()}
              >
                <Folder size={16} />
                选择目录
              </button>
            </div>
          </label>
          {folderError && <p className="inline-error">{folderError}</p>}
          {tool && (
            <details className="optional-model">
              <summary>
                <Zap size={15} />
                <span>模型设置（可选）</span>
                <small>
                  {modelId.trim() ? "为此实例指定模型" : "默认继承"}
                </small>
                <ChevronDown size={14} />
              </summary>
              <div className="optional-model-fields">
                <p className="field-help">
                  留空沿用工具的原生默认模型。填写后只作用于此项目实例，不修改全局配置。
                </p>
                <ModelFields
                  adapter={tool.adapter}
                  providerID={providerID}
                  modelId={modelId}
                  disabled={busy}
                  onProvider={setProviderID}
                  onModel={setModelId}
                />
                {!modelValid && (
                  <p className="inline-error">
                    同时填写服务商 ID 与模型 ID，或均留空继承默认配置。
                  </p>
                )}
              </div>
            </details>
          )}
          <div className="field-help">
            {machine?.kind === "windows"
              ? "使用 Windows 项目路径，Claude Code 在 Windows 本机执行。"
              : "使用该 WSL / Linux 环境可访问的项目路径，OpenCode 在该环境执行。"}
            创建实例与检查连接不会调用模型。
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            disabled={
              busy ||
              !machine?.online ||
              !tool ||
              !workspace.trim() ||
              !modelValid
            }
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Plus size={16} />
            )}
            创建实例
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ModelFields({
  adapter,
  providerID,
  modelId,
  disabled,
  onProvider,
  onModel,
}: {
  adapter?: "claude" | "opencode" | "codex";
  providerID: string;
  modelId: string;
  disabled: boolean;
  onProvider: (value: string) => void;
  onModel: (value: string) => void;
}) {
  return (
    <>
      {adapter !== "claude" && (
        <label>
          服务商 ID
          <input
            aria-label="实例模型服务商"
            value={providerID}
            disabled={disabled}
            placeholder="填写 OpenCode 已配置的 provider ID"
            onChange={(e) => onProvider(e.target.value)}
          />
        </label>
      )}
      <label>
        模型 ID
        <input
          aria-label="实例模型ID"
          value={modelId}
          disabled={disabled}
          placeholder={
            adapter === "claude"
              ? "填写当前账户有权限的 Claude 模型 ID"
              : "填写该服务商下可用的模型 ID"
          }
          onChange={(e) => onModel(e.target.value)}
        />
      </label>
    </>
  );
}
function InstanceModelDialog({
  agent,
  machineName,
  busy,
  locked,
  onClose,
  onSave,
}: {
  agent: Agent;
  machineName: string;
  busy: boolean;
  locked: boolean;
  onClose: () => void;
  onSave: (model: ModelSelection | null) => Promise<unknown>;
}) {
  const [source, setSource] = useState(agent.model ? "custom" : "inherit");
  const [providerID, setProviderID] = useState(
    agent.model?.providerID || agent.selectedModel?.providerID || "",
  );
  const [modelId, setModelId] = useState(agent.model?.id || "");
  const model =
    source === "inherit"
      ? null
      : {
          providerID: agent.adapter === "claude" ? "claude" : providerID.trim(),
          id: modelId.trim(),
        };
  const valid = !model || (!!model.id && !!model.providerID);
  const unchanged = !model
    ? !agent.model
    : model.providerID === agent.model?.providerID &&
      model.id === agent.model?.id;
  const disabled = busy || locked;
  return (
    <Modal title={"模型设置 · " + agent.name} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !unchanged && !disabled) void onSave(model);
        }}
      >
        <div className="modal-body">
          <p className="modal-intro">
            {machineName} · {toolName(agent.adapter)} · {agent.name}
          </p>
          <label>
            模型来源
            <select
              aria-label="实例模型来源"
              value={source}
              disabled={disabled}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="inherit">继承原生默认模型</option>
              <option value="custom">为此实例指定模型</option>
            </select>
          </label>
          {source === "custom" ? (
            <ModelFields
              adapter={agent.adapter}
              providerID={providerID}
              modelId={modelId}
              disabled={disabled}
              onProvider={setProviderID}
              onModel={setModelId}
            />
          ) : (
            <div className="project-note">
              <Zap size={15} />
              {agent.model
                ? "清除实例指定模型，后续新会话沿用工具的原生默认配置。"
                : agent.selectedModel
                  ? `原生默认：${agent.adapter === "claude" ? agent.selectedModel.id : `${agent.selectedModel.providerID} / ${agent.selectedModel.id}`}`
                  : "将沿用工具的原生默认模型"}
            </div>
          )}
          {!valid && (
            <p className="inline-error">
              {agent.adapter === "claude"
                ? "请填写当前账户可用的模型 ID。"
                : "请同时填写服务商 ID 与模型 ID。"}
            </p>
          )}
          {locked && (
            <p className="inline-error">
              实例正在执行或等待核对，结束后可修改模型。
            </p>
          )}
          <div className="field-help">
            仅修改此实例，不改变工具全局配置。更改后使用新会话，已有记录保留。
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            disabled={disabled || !valid || unchanged}
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}
            保存模型设置
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function TaskDetail({
  task,
  adapter,
  name,
  modelOverride,
  busy,
  onClose,
  act,
  notify,
  onConversation,
}: {
  task: Task;
  adapter?: Agent["adapter"];
  name: string;
  modelOverride: boolean;
  busy: boolean;
  onClose: () => void;
  act: (
    key: string,
    work: () => Promise<unknown>,
    message?: string,
  ) => Promise<boolean>;
  notify: (text: string, error?: boolean) => void;
  onConversation: () => void;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const verification = isVerificationTask(task);
  const events = taskEvents(task, adapter);
  const partialAnswer = streamingAnswer(task, adapter);
  useDialogFocus(drawerRef, onClose);
  const [pending, setPending] = useState<Pending>({
      permissions: [],
      forms: [],
    }),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [pendingError, setPendingError] = useState(""),
    [cancelConfirm, setCancelConfirm] = useState(false),
    [tab, setTab] = useState("answer");
  useEffect(() => {
    let alive = true;
    async function update() {
      if (!task.waiting) {
        if (alive) setPending({ permissions: [], forms: [] });
        return;
      }
      try {
        const p = await invoke<Pending>("pending", {
          taskId: task.taskId,
          machineId: task.machineId,
        });
        if (alive) {
          setPending(p);
          setPendingError("");
        }
      } catch (e) {
        if (alive) setPendingError((e as Error).message);
      }
    }
    void update();
    const timer = setInterval(() => void update(), 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [task.taskId, task.waiting?.requestIds.join(",")]);
  async function reply(
    action: string,
    requestId: string,
    extra: Record<string, unknown>,
  ) {
    const operationId = crypto.randomUUID();
    await act("reply", async () => {
      const r = await invoke<Receipt>("reply", {
        taskId: task.taskId,
        machineId: task.machineId,
        reply: {
          taskId: task.taskId,
          executionId: task.executionId,
          operationId,
          action,
          requestId,
          ...extra,
        },
      });
      setReceipt(r);
    });
  }
  return (
    <div className="drawer-overlay">
      <section
        ref={drawerRef}
        className="task-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="任务详情"
      >
        <div className="drawer-head">
          <span>
            <Terminal size={18} />
            {name}
          </span>
          <button
            className="icon-btn"
            aria-label="关闭任务详情"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="drawer-body">
          <div className="task-title">
            <Badge
              text={taskLabel(task)}
              tone={
                task.status === "succeeded"
                  ? "success"
                  : task.status === "failed"
                    ? "danger"
                    : task.waiting || task.status === "unknown"
                      ? "warning"
                      : "neutral"
              }
            />
            <span>
              第 {task.turn || 1} 轮 · {time(task.createdAt)}
            </span>
            <h2>{verification ? "连接验证" : task.message}</h2>
          </div>
          {task.status === "unknown" && (
            <div className="uncertainty">
              <TriangleAlert size={18} />
              <div>
                <strong>原任务的结果尚未确认</strong>
                <p>
                  {task.uncertaintyReason || "请只读核对原执行，避免重复提交。"}
                </p>
                {task.reconciliation && (
                  <p>最近核对：{task.reconciliation.reason}</p>
                )}
                <button
                  className="btn small"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      "reconcile",
                      () =>
                        invoke("reconcile", {
                          taskId: task.taskId,
                          machineId: task.machineId,
                        }),
                      "已发起只读核对，不会重新执行任务。",
                    )
                  }
                >
                  <RefreshCw size={14} />
                  核对原任务
                </button>
              </div>
            </div>
          )}
          {pendingError && (
            <p className="inline-error">暂时无法读取等待项：{pendingError}</p>
          )}
          {pending.permissions.map((p) => (
            <div className="permission-card" key={p.id}>
              <div className="permission-title">
                <ShieldCheck size={20} />
                <div>
                  <h3>Agent 需要你的授权</h3>
                  <p>将执行 {p.action === "edit" ? "文件修改" : p.action}</p>
                </div>
              </div>
              <div className="permission-resources">
                {p.resources.map((r) => (
                  <code key={r}>{r}</code>
                ))}
              </div>
              <div className="permission-actions">
                <button
                  className="btn small"
                  disabled={busy || receipt?.state === "unknown"}
                  onClick={() =>
                    void reply("permission", p.id, { decision: "reject" })
                  }
                >
                  拒绝
                </button>
                <button
                  className="btn primary small"
                  disabled={busy || receipt?.state === "unknown"}
                  onClick={() =>
                    void reply("permission", p.id, { decision: "once" })
                  }
                >
                  <Check size={15} />
                  仅允许本次
                </button>
              </div>
            </div>
          ))}
          {pending.forms.map((f) => (
            <FormReply
              key={f.id}
              title={f.title}
              fields={f.fields}
              busy={busy || receipt?.state === "unknown"}
              submit={(answer) => reply("form", f.id, { answer })}
            />
          ))}
          {receipt && (
            <div className="receipt">
              <ShieldCheck size={15} />
              {receipt.state === "confirmed"
                ? "操作请求已确认，实际执行结果继续观察。"
                : receipt.state === "unknown"
                  ? "回应未知，请查询原操作，不要再次提交。"
                  : "操作已拒绝"}
              {receipt.state === "unknown" && (
                <button
                  className="text-btn"
                  disabled={busy}
                  onClick={() =>
                    void act("operation", async () => {
                      const r = await invoke<Receipt>("operation", {
                        taskId: task.taskId,
                        operationId: receipt.operationId,
                        machineId: task.machineId,
                      });
                      setReceipt(r);
                    })
                  }
                >
                  查询原操作
                </button>
              )}
            </div>
          )}
          <div className="detail-tabs">
            <button
              className={tab === "answer" ? "selected" : ""}
              onClick={() => setTab("answer")}
            >
              {verification ? "验证结果" : "本轮回答"}
            </button>
            <button
              className={tab === "events" ? "selected" : ""}
              onClick={() => setTab("events")}
            >
              执行过程 <span>{events.length}</span>
            </button>
          </div>
          {tab === "answer" ? (
            <div className="answer-content">
              {task.result ? (
                <>
                  <p>{verification ? "模型真实回复验证通过。" : task.result.message}</p>
                  {task.result.truncated && (
                    <div className="field-help">
                      输出已截断，请查看原生会话。
                    </div>
                  )}
                </>
              ) : task.error ? (
                <div className="inline-error">
                  <h3>执行未完成</h3>
                  <ErrorMessage
                    message={task.error.message}
                    modelOverride={modelOverride}
                  />
                </div>
              ) : partialAnswer ? (
                <>
                  <p>{partialAnswer}</p>
                  <div className="field-help">{task.status === "unknown" ? "结果待核对，以上为已收到的部分回复。" : isTerminal(task) ? "以上为已收到的部分回复。" : "正在接收回复…"}</div>
                </>
              ) : (
                <div className="working-state">
                  {isTerminal(task) ? (
                    <OctagonX size={26} />
                  ) : (
                    <Activity size={26} />
                  )}
                  <h3>
                    {task.status === "cancelled"
                      ? "本轮已取消"
                      : task.waiting
                        ? "Agent 正在等待你的处理"
                        : task.status === "unknown"
                          ? "等待核对真实结果"
                          : verification ? "正在验证模型真实回复" : "Agent 正在处理需求"}
                  </h3>
                  <p>
                    {task.status === "cancelled"
                      ? "已经发生的修改不会自动撤销。"
                      : "执行过程和工具活动会持续保存。"}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="event-list">
              {events.map((e) => (
                  <div className="event" key={e.seq}>
                    <span className="event-dot" />
                    <div>
                      <small>
                        {time(e.timestamp)} ·{" "}
                        {{
                          accepted: "已接收",
                          started: "开始执行",
                          progress: "进度",
                          output: "输出",
                          waiting: "等待处理",
                          completed: "完成",
                          failed: "失败",
                          cancelled: "已取消",
                          unknown: "结果待核对",
                        }[e.event.kind] || "执行事件"}
                      </small>
                      <pre>
                        {readable(
                          e.event.text ||
                            e.event.reason ||
                            e.event.error?.message ||
                            "状态已更新",
                        )}
                      </pre>
                    </div>
                  </div>
                ))}
            </div>
          )}
          <details className="technical-details">
            <summary>
              诊断信息
              <ChevronDown size={14} />
            </summary>
            <dl>
              <dt>任务 ID</dt>
              <dd>{task.taskId}</dd>
              <dt>请求 ID</dt>
              <dd>{task.requestId}</dd>
              {verification && (
                <>
                  <dt>原始验证请求</dt>
                  <dd>{task.message}</dd>
                  {task.result && <><dt>原始验证回复</dt><dd>{task.result.message}</dd></>}
                </>
              )}
              {task.native && (
                <>
                  <dt>原生 Session</dt>
                  <dd>{task.native.sessionId}</dd>
                </>
              )}
            </dl>
          </details>
        </div>
        <div className="drawer-footer">
          <button className="btn" onClick={onConversation}>
            <MessageSquare size={16} />
            {isVerificationTask(task) ? "查看验证记录" : isTerminal(task) ? "进入会话 / 继续追问" : "进入会话"}
          </button>
          {!isTerminal(task) && task.status !== "unknown" && (
            <button
              className="btn danger-outline"
              disabled={busy}
              onClick={() => setCancelConfirm(true)}
            >
              <OctagonX size={16} />
              取消本轮
            </button>
          )}
        </div>
        {cancelConfirm && (
          <Modal title="取消当前轮次？" onClose={() => setCancelConfirm(false)}>
            <div className="modal-body">
              <p>
                Agent
                将停止本轮执行，已发生的修改会保留。关闭窗口或退出观察不会取消任务。
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setCancelConfirm(false)}>
                继续执行
              </button>
              <button
                className="btn danger"
                disabled={busy || receipt?.state === "unknown"}
                onClick={() =>
                  void act("cancel", async () => {
                    const r = await invoke<Receipt>("cancel", {
                      taskId: task.taskId,
                      operationId: crypto.randomUUID(),
                      machineId: task.machineId,
                    });
                    setReceipt(r);
                    setCancelConfirm(false);
                    notify("取消请求已发送，正在核对原生中断结果。");
                  })
                }
              >
                确认取消本轮
              </button>
            </div>
          </Modal>
        )}
      </section>
    </div>
  );
}
function FormReply({
  title,
  fields,
  busy,
  submit,
}: {
  title: string;
  fields: Field[];
  busy: boolean;
  submit: (answer: Record<string, unknown>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const shown = fields.filter(
    (f) =>
      !f.hidden &&
      f.type !== "external" &&
      (f.when || []).every((w) =>
        w.op === "eq" ? values[w.key] === w.value : values[w.key] !== w.value,
      ),
  );
  return (
    <form
      className="permission-card form-reply"
      onSubmit={(e) => {
        e.preventDefault();
        const answer: Record<string, unknown> = {};
        for (const f of shown) {
          const v = values[f.key];
          if (v === undefined || v === "") {
            if (f.required) return;
            continue;
          }
          answer[f.key] = ["integer", "number"].includes(f.type)
            ? Number(v)
            : f.type === "multiselect"
              ? String(v)
                  .split(",")
                  .map((s) => s.trim())
              : v;
        }
        void submit(answer);
      }}
    >
      <div className="permission-title">
        <MessageSquare size={20} />
        <h3>{title || "Agent 需要你的输入"}</h3>
      </div>
      {shown.map((f) => (
        <label key={f.key}>
          {f.title || f.key}
          {f.required && <span className="required"> *</span>}
          {f.description && <small>{f.description}</small>}
          {f.type === "boolean" ? (
            <select
              required={f.required}
              value={values[f.key] === undefined ? "" : String(values[f.key])}
              onChange={(e) =>
                setValues({ ...values, [f.key]: e.target.value === "true" })
              }
            >
              <option value="">请选择</option>
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          ) : f.options && f.type !== "multiselect" ? (
            <select
              required={f.required}
              value={String(values[f.key] || "")}
              onChange={(e) =>
                setValues({ ...values, [f.key]: e.target.value })
              }
            >
              <option value="">请选择</option>
              {f.options.map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              required={f.required}
              minLength={f.minLength}
              maxLength={f.maxLength}
              value={String(values[f.key] ?? "")}
              type={f.sensitive||f.format==="password"||/password|secret|token|api.?key|密码|密钥/i.test(f.key+" "+(f.title||""))?"password":["number", "integer"].includes(f.type) ? "number" : "text"}
              step={f.type === "integer" ? "1" : "any"}
              onChange={(e) =>
                setValues({ ...values, [f.key]: e.target.value })
              }
            />
          )}
        </label>
      ))}
      <button className="btn primary small" disabled={busy}>
        发送回答
      </button>
    </form>
  );
}
