import type {DetailRead} from './types';
import { useId, useRef, useState, type ReactNode } from "react";
import McpSettings from './McpSettings';
import {
  ArrowUpRight,
  CheckCheck,
  Circle,
  Clock3,
  Folder,
  History,
  Inbox,
  LayoutGrid,
  MessageSquare,
  Monitor,
  Palette,
  Plus,
  Power,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  conversationTitle,
  isTerminal,
  isVerificationConversation,
  labels,
  streamingAnswer,
  taskLabel,
  time,
} from "./api";
import type {
  AgentNode,
  Conversation,
  Journal,
  Machine,
  Preferences,
  RecoveryItem,
  Status,
  Task,
} from "./types";
import AgentIcon from "./AgentIcon";

type SourceProps = {
  machineName: (id?: string) => string;
  nodeFor: (item: Task | Conversation) => AgentNode | undefined;
};

function EmptyState({
  icon: Icon,
  title,
  children,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={"ui-empty" + (compact ? " ui-empty-compact" : "")}>
      <div className="ui-empty-icon">
        <Icon size={22} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  function clear() {
    onChange("");
    input.current?.focus();
  }
  return (
    <div
      className="workspace-search"
      onKeyDown={(event) => {
        if (event.key === "Escape" && value) {
          event.preventDefault();
          event.stopPropagation();
          clear();
        }
      }}
    >
      <Search size={16} aria-hidden="true" />
      <input
        ref={input}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          className="icon-btn"
          aria-label={"清空" + label}
          onClick={clear}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

const taskColumns: {
  title: string;
  statuses: Status[];
  empty: string;
  tone: string;
}[] = [
  {
    title: "进行中",
    statuses: ["queued", "accepted", "running"],
    empty: "暂无进行中的任务",
    tone: "active",
  },
  {
    title: "待处理",
    statuses: ["unknown"],
    empty: "暂无结果待核对的任务",
    tone: "warning",
  },
  {
    title: "已完成",
    statuses: ["succeeded"],
    empty: "暂无已完成的任务",
    tone: "success",
  },
  {
    title: "执行异常",
    statuses: ["failed", "cancelled"],
    empty: "暂无失败或取消的任务",
    tone: "danger",
  },
];

function TaskStatus({ task }: { task: Task }) {
  return (
    <span className={"ui-status ui-status-" + task.status}>
      <i aria-hidden="true" />
      {labels[task.status]}
    </span>
  );
}

export interface TasksPageProps extends SourceProps {
  tasks: Task[];
  scope?: ReactNode;
  onOpen: (task: Task) => void;
  onNew: () => void;
}

export function TasksPage({
  tasks,
  scope,
  machineName,
  nodeFor,
  onOpen,
  onNew,
}: TasksPageProps) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const visible = tasks.filter(
    (task) =>
      !query ||
      [
        task.message,
        machineName(task.machineId),
        nodeFor(task)?.name || "历史 Agent",
      ].some((value) => value.toLocaleLowerCase().includes(query)),
  );
  const waiting = tasks.filter((task) => task.waiting).length;

  return (
    <section className="workspace-page workspace-tasks">
      <div className="page-heading workspace-page-heading">
        <div>
          <div className="eyebrow">WORKSPACE / TASKS</div>
          <h1>任务看板</h1>
          <p>从需求到结果，查看每次执行的进展。</p>
        </div>
        <button className="btn primary" onClick={onNew}>
          <Plus size={16} aria-hidden="true" />
          新建任务
        </button>
      </div>
      {scope != null && <div className="workspace-scope">{scope}</div>}
      <div className="workspace-toolbar">
        <div className="workspace-toolbar-summary">
          <LayoutGrid size={16} aria-hidden="true" />
          <span>{tasks.length} 个任务</span>
          {waiting > 0 && (
            <span className="ui-status ui-status-waiting">
              {waiting} 个等待你处理
            </span>
          )}
        </div>
        <SearchField
          value={search}
          onChange={setSearch}
          label="搜索任务"
          placeholder="搜索需求、机器或 Agent…"
        />
      </div>
      {query && (
        <p className="workspace-filter-result" role="status">
          找到 {visible.length} 个匹配任务
        </p>
      )}
      {tasks.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="还没有任务">
          新建任务，选择已接入的 Agent，开始第一项工作。
        </EmptyState>
      ) : (
        <div className="workspace-board network-board">
          {taskColumns.map((column) => {
            const items = visible.filter((task) =>
              column.statuses.includes(task.status),
            );
            return (
              <section
                className={
                  "workspace-column network-column workspace-column-" +
                  column.tone
                }
                key={column.title}
                aria-label={column.title}
              >
                <div className="workspace-column-heading">
                  <h2>
                    <i aria-hidden="true" />
                    {column.title}
                  </h2>
                  <span className="workspace-count">{items.length}</span>
                </div>
                <div className="workspace-column-items">
                  {items.map((task) => (
                    <button
                      className="workspace-task network-task"
                      key={task.taskId}
                      onClick={() => onOpen(task)}
                    >
                      <div className="workspace-task-source">
                        <AgentIcon adapter={nodeFor(task)?.adapter} size={18} />
                        <span>
                          {machineName(task.machineId)} /{" "}
                          {nodeFor(task)?.name || "历史 Agent"}
                        </span>
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </div>
                      <strong className="workspace-task-title">
                        {task.message}
                      </strong>
                      {(task.error?.message ||
                        task.result?.message ||
                        task.lastSummary) && (
                        <p className="workspace-task-summary">
                          {task.error?.message ||
                            task.result?.message ||
                            task.lastSummary}
                        </p>
                      )}
                      <div className="workspace-task-footer">
                        <TaskStatus task={task} />
                        <time dateTime={task.updatedAt}>
                          {time(task.updatedAt)}
                        </time>
                      </div>
                      {task.waiting && (
                        <div className="workspace-task-waiting">
                          <Clock3 size={13} aria-hidden="true" />
                          等待你处理
                        </div>
                      )}
                      {task.historical && (
                        <span className="workspace-history-label">
                          <History size={12} aria-hidden="true" />
                          历史快照
                        </span>
                      )}
                    </button>
                  ))}
                  {items.length === 0 && (
                    <div className="workspace-column-empty">
                      <Inbox size={18} aria-hidden="true" />
                      <p>{query ? "没有匹配的任务" : column.empty}</p>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

export interface ConversationsPageProps extends SourceProps {
  detailRead?: DetailRead | null;
  onReload?: () => void;
  conversations: Conversation[];
  scope?: ReactNode;
  selected: Conversation | null;
  showChecks: boolean;
  onShowChecks: (value: boolean) => void;
  onOpen: (conversation: Conversation) => void;
  onTask: (task: Task) => void;
  onNew: () => void;
  followup: string;
  onFollowup: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  executionLocked?: boolean;
  blocked: (machineId?: string, nodeId?: string) => boolean;
}

export function ConversationsPage({
  conversations,
  detailRead,
  onReload,
  scope,
  selected: requested,
  showChecks,
  onShowChecks,
  machineName,
  nodeFor,
  onOpen,
  onTask,
  onNew,
  followup,
  onFollowup,
  onSend,
  busy,
  executionLocked = false,
  blocked,
}: ConversationsPageProps) {
  const [search, setSearch] = useState("");
  const composerId = useId();
  const query = search.trim().toLocaleLowerCase();
  const normal = conversations.filter(
    (conversation) => showChecks || !isVerificationConversation(conversation),
  );
  const selected =
    requested &&
    (showChecks || !isVerificationConversation(requested)) &&
    normal.some(
      (conversation) =>
        conversation.conversationId === requested.conversationId,
    )
      ? requested
      : null;
  const visible = normal.filter(
    (conversation) =>
      !query ||
      [
        conversationTitle(conversation),
        machineName(conversation.machineId),
        nodeFor(conversation)?.name || "历史 Agent",
      ].some((value) => value.toLocaleLowerCase().includes(query)),
  );
  const node = selected ? nodeFor(selected) : undefined;
  const verification = selected ? isVerificationConversation(selected) : false;
  const isBlocked = !!selected && blocked(selected.machineId, node?.nodeId);
  const read=detailRead?.id===selected?.conversationId?detailRead:undefined;
  const detailUnavailable=!!read&&read.status!=="ready";
  const latest = selected?.items?.at(-1);
  const canSend =
    !!selected &&
    !verification &&
    !selected.historical &&
    !detailUnavailable &&
    !busy &&
    !executionLocked &&
    !!followup.trim() &&
    !isBlocked &&
    !!node?.connected &&
    node.online &&
    !node.removed &&
    !!selected.canContinue &&
    !!latest &&
    isTerminal(latest);
  const continuationHint = !selected
    ? ""
    : detailUnavailable
      ? read?.message || "正在读取原会话，核对完成后才能继续。"
    : isBlocked
      ? "当前 Agent 有未确认操作，请查询原请求；可选择其他可用 Agent 开始独立会话。"
      : executionLocked
        ? "请先恢复后台连接或核对原授权保存，再继续当前会话。"
        : selected.historical
          ? "这是保留的历史快照。来源后台暂未提供实时详情；仅可查看已保存的轮次，不能继续会话。"
          : !node?.connected || node.removed
            ? "来源 Agent 尚未接入，恢复连接后才能继续当前会话。"
            : !node.online
              ? "来源机器离线，恢复连接后才能继续当前会话。"
              : !latest
                ? "正在等待原会话的执行记录，核对完成后才能继续。"
                : !isTerminal(latest)
                  ? "请先等待本轮结束；结果待核对时，请查询原请求。"
                  : !selected.canContinue
                    ? selected.continuationReason ||
                      "当前原生上下文不支持继续会话，请新建会话。"
                    : "";

  return (
    <section className="workspace-page workspace-conversations">
      <div className="page-heading workspace-page-heading">
        <div>
          <div className="eyebrow">WORKSPACE / CONVERSATIONS</div>
          <h1>会话</h1>
          <p>接着上次的上下文，与 Agent 继续工作。</p>
        </div>
        <button className="btn primary" onClick={onNew}>
          <Plus size={16} aria-hidden="true" />
          新建会话
        </button>
      </div>
      {scope != null && <div className="workspace-scope">{scope}</div>}
      <div className="workspace-conversation-layout conversation-layout">
        <aside className="workspace-conversation-list" aria-label="会话列表">
          <div className="workspace-conversation-tools">
            <div className="workspace-section-heading">
              <h2>全部会话</h2>
              <span className="workspace-count">{normal.length}</span>
            </div>
            <SearchField
              value={search}
              onChange={setSearch}
              label="搜索会话"
              placeholder="搜索会话或来源…"
            />
            <label className="workspace-check network-checks">
              <input
                type="checkbox"
                checked={showChecks}
                onChange={(event) => onShowChecks(event.target.checked)}
              />
              显示连接验证记录
            </label>
          </div>
          <div className="workspace-conversation-choices">
            {visible.map((conversation) => (
              <button
                className={
                  "workspace-conversation-choice conversation-choice" +
                  (selected?.conversationId === conversation.conversationId
                    ? " chosen"
                    : "")
                }
                aria-current={
                  selected?.conversationId === conversation.conversationId
                    ? "true"
                    : undefined
                }
                key={conversation.conversationId}
                onClick={() => onOpen(conversation)}
              >
                <div className="workspace-conversation-choice-icon">
                  {isVerificationConversation(conversation) ? (
                    <ShieldCheck size={17} aria-hidden="true" />
                  ) : (
                    <AgentIcon adapter={nodeFor(conversation)?.adapter} size={22} />
                  )}
                </div>
                <div className="workspace-conversation-choice-body">
                  <strong>{conversationTitle(conversation)}</strong>
                  <span>
                    {machineName(conversation.machineId)} /{" "}
                    {nodeFor(conversation)?.name || "历史 Agent"}
                  </span>
                  <small>
                    {conversation.turns} 轮 · {time(conversation.updatedAt)}
                    {conversation.historical ? " · 历史快照" : ""}
                  </small>
                </div>
              </button>
            ))}
            {visible.length === 0 && (
              <EmptyState
                compact
                icon={Search}
                title={query ? "没有匹配的会话" : "还没有会话"}
              >
                {query
                  ? "试试其他关键词。"
                  : "新建会话后，执行记录会保存在这里。"}
              </EmptyState>
            )}
          </div>
        </aside>
        <div className="workspace-conversation-reading conversation-reading">
          {selected ? (
            <>
              <div className="workspace-conversation-content">
                <div className="workspace-conversation-heading conversation-title">
                  <div>
                    <h2>{conversationTitle(selected)}</h2>
                    <p>
                      <Monitor size={13} aria-hidden="true" />
                      {machineName(selected.machineId)}
                      <span aria-hidden="true">/</span>
                      {node?.name || "历史 Agent"}
                    </p>
                  </div>
                  {verification ? (
                    <span className="ui-status ui-status-neutral">
                      <ShieldCheck size={13} aria-hidden="true" />
                      连接验证
                    </span>
                  ) : (
                    latest && <TaskStatus task={latest} />
                  )}
                </div>
                {selected.workspace && (
                  <div className="workspace-conversation-directory">
                    <Folder size={14} aria-hidden="true" />
                    <span>{selected.workspace}</span>
                  </div>
                )}
                {detailUnavailable && <div className="workspace-inline-note" role="status">
                  <div><strong>{read?.status==='loading'?'正在读取原会话':read?.status==='missing'?'未找到原会话':'会话详情暂不可用'}</strong><p>{read?.message||'只读取原会话，不会重新发送需求。'}</p></div>
                  {onReload&&read?.status!=='loading'&&<button className="text-btn" onClick={onReload}>重新读取原会话</button>}
                </div>}
                {selected.historical && (
                  <div className="workspace-inline-note" role="status">
                    <History size={16} aria-hidden="true" />
                    <span>
                      这是保留的历史快照。来源后台暂未提供实时详情；仅可查看已保存的轮次，不能继续会话。
                    </span>
                  </div>
                )}
                {verification && (
                  <div className="workspace-inline-note">
                    <ShieldCheck size={16} aria-hidden="true" />
                    <span>这是连接验证记录。请新建会话发送实际需求。</span>
                  </div>
                )}
                <div className="workspace-turns turns">
                  {selected.items?.map((task) => {
                    const answer =
                      task.error?.message ||
                      task.result?.message ||
                      streamingAnswer(task, node?.adapter) ||
                      task.lastSummary;
                    return (
                      <article
                        className="workspace-turn turn"
                        key={task.taskId}
                      >
                        <div className="workspace-question user-question">
                          <div className="workspace-turn-label">
                            <span>{verification ? "系统验证" : "你"}</span>
                            <span>第 {task.turn || 1} 轮</span>
                          </div>
                          <p>
                            {verification ? "检查真实回复。" : task.message}
                          </p>
                        </div>
                        <div className="workspace-answer assistant-answer">
                          <div className="workspace-answer-meta answer-meta">
                            <AgentIcon adapter={node?.adapter} size={20} />
                            <strong>{node?.name || "Agent"}</strong>
                            <span
                              className={
                                "workspace-answer-state ui-status ui-status-" +
                                (task.waiting ? "waiting" : task.status)
                              }
                            >
                              {taskLabel(task)}
                            </span>
                            <button
                              className="text-btn"
                              onClick={() =>
                                onTask({
                                  ...task,
                                  nodeId: selected.nodeId || task.nodeId,
                                })
                              }
                            >
                              查看过程
                              <ArrowUpRight size={12} aria-hidden="true" />
                            </button>
                          </div>
                          {answer ? (
                            <pre className="workspace-answer-text network-answer">
                              {answer}
                            </pre>
                          ) : (
                            <p className="workspace-answer-placeholder">
                              {isTerminal(task)
                                ? "本轮没有可展示的回答，请查看执行过程。"
                                : "暂未收到本轮回答。"}
                            </p>
                          )}
                          {task.result?.truncated && (
                            <p className="workspace-answer-placeholder">
                              结果已截断，完整记录请查看原生 Agent。
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  {!selected.items?.length && !detailUnavailable && (
                    <EmptyState
                      compact
                      icon={MessageSquare}
                      title={selected.historical?"保留快照暂无轮次记录":"本会话尚无轮次记录"}
                    >
                      来源后台未提供可展示的轮次；可稍后重新读取原会话。
                    </EmptyState>
                  )}
                </div>
              </div>
              {!verification && (
                <form
                  className="workspace-followup network-followup"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (canSend) onSend();
                  }}
                >
                  <label
                    className="workspace-composer-label"
                    htmlFor={composerId}
                  >
                    继续会话
                  </label>
                  <textarea
                    id={composerId}
                    aria-label="继续会话"
                    aria-describedby={
                      continuationHint ? composerId + "-hint" : undefined
                    }
                    placeholder="继续当前会话…"
                    value={followup}
                    onChange={(event) => onFollowup(event.target.value)}
                    rows={3}
                  />
                  <div className="workspace-composer-footer">
                    <p
                      id={composerId + "-hint"}
                      role={continuationHint ? "status" : undefined}
                    >
                      {continuationHint || "沿用当前 Agent 和原生会话上下文。"}
                    </p>
                    <button className="btn primary" disabled={!canSend}>
                      <Send size={15} aria-hidden="true" />
                      发送
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <EmptyState icon={MessageSquare} title="选择或新建一个会话">
              从左侧继续之前的工作，或新建会话发送需求。
            </EmptyState>
          )}
        </div>
      </div>
    </section>
  );
}

export interface SettingsPageProps {
  preferences: Preferences;
  onTheme: (theme: Preferences["theme"]) => void;
  directory: string;
  machines: Machine[];
  nodes: AgentNode[];
  journal: Journal[];
  recoveryItems: RecoveryItem[];
  machineName: (id?: string) => string;
  busy: boolean;
  managementLocked: boolean;
  managementReason?: (machineId?:string)=>string;
  machineManagementSupported: boolean;
  onRestore: (machine: Machine) => void;
  onCloseWindow: () => void;
  onStop: () => void;
  querying: boolean;
  onQuery: () => void;
}

const operationName = (operation: string) =>
  (
    ({
      verify: "连接验证",
      continue: "继续会话",
      submit: "提交任务",
    }) as Record<string, string>
  )[operation] || operation;

export function SettingsPage({
  preferences,
  onTheme,
  directory,
  machines,
  nodes,
  journal,
  recoveryItems,
  machineName,
  busy,
  managementLocked,
  managementReason,
  machineManagementSupported,
  onRestore,
  onCloseWindow,
  onStop,
  querying,
  onQuery,
}: SettingsPageProps) {
  const activeMachines = machines.filter((machine) => !machine.removed);
  const activeNodes = nodes.filter(
    (node) =>
      !node.removed &&
      !machines.find((machine) => machine.machineId === node.machineId)
        ?.removed,
  );
  const removed = machines.filter((machine) => machine.removed);

  return (
    <section className="workspace-page workspace-settings">
      <div className="page-heading workspace-page-heading">
        <div>
          <div className="eyebrow">WORKSPACE / SETTINGS</div>
          <h1>设置</h1>
          <p>让工作台按你的习惯运行。</p>
        </div>
        {preferences.version && (
          <span className="workspace-version">
            AgentBridge v{preferences.version}
          </span>
        )}
      </div>
      <div className="settings-grid">
        <McpSettings nodes={nodes} machines={machines}/>
        <section
          className="settings-card network-relations"
          aria-labelledby="settings-appearance"
        >
          <div className="settings-card-heading">
            <Palette size={19} aria-hidden="true" />
            <div>
              <h2 id="settings-appearance">外观</h2>
              <p>选择适合当前环境的显示主题。</p>
            </div>
          </div>
          <div className="settings-row">
            <div>
              <label htmlFor="workspace-theme">
                <strong>主题</strong>
              </label>
              <span id="workspace-theme-help">跟随系统，或使用固定主题</span>
            </div>
            <select
              id="workspace-theme"
              aria-describedby="workspace-theme-help"
              className="settings-theme-select"
              value={preferences.theme}
              disabled={busy}
              onChange={(event) =>
                onTheme(event.target.value as Preferences["theme"])
              }
            >
              <option value="system">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </div>
        </section>
        <section
          className="settings-card network-relations"
          aria-labelledby="settings-connections"
        >
          <div className="settings-card-heading">
            <Monitor size={19} aria-hidden="true" />
            <div>
              <h2 id="settings-connections">连接状态</h2>
              <p>当前后台提供的机器与 Agent 概况。</p>
            </div>
          </div>
          <dl className="settings-facts">
            <div>
              <dt>机器</dt>
              <dd>
                {activeMachines.length} 台
                <span>
                  {activeMachines.filter((machine) => machine.online).length}{" "}
                  台在线
                </span>
              </dd>
            </div>
            <div>
              <dt>Agent 节点</dt>
              <dd>
                {activeNodes.length} 个
                <span>
                  {activeNodes.filter((node) => node.connected).length} 个已接入
                </span>
              </dd>
            </div>
            <div className="settings-fact-wide">
              <dt>桌面数据</dt>
              <dd>
                <code>{directory || "尚未读取到数据目录"}</code>
              </dd>
            </div>
          </dl>
          <p className="settings-footnote">
            AgentBridge 管理机器连接和协作，原生工具管理自己的账户、模型与配置。
          </p>
          {!machineManagementSupported && (
            <div className="workspace-inline-note" role="status">
              <Circle size={15} aria-hidden="true" />
              <span>
                当前后台不支持机器管理。请在“后台运行”停止旧后台并重新打开新版程序。
              </span>
            </div>
          )}
        </section>
        <section
          className="settings-card network-relations"
          aria-labelledby="settings-background"
        >
          <div className="settings-card-heading">
            <Power size={19} aria-hidden="true" />
            <div>
              <h2 id="settings-background">后台运行</h2>
              <p>分别管理桌面窗口与后台连接。</p>
            </div>
          </div>
          <div className="settings-row">
            <div>
              <strong>关闭桌面窗口</strong>
              <span>后台继续管理连接，重新打开程序可查看原任务和历史。</span>
            </div>
            <button className="btn" disabled={busy} onClick={onCloseWindow}>
              仅关闭窗口
            </button>
          </div>
          <div className="settings-row">
            <div>
              <strong>停止后台并退出</strong>
              <span>
                断开本机协调通道。远端已接收的任务继续执行，重开后查询原记录。
              </span>
            </div>
            <button
              className="btn settings-stop-button"
              disabled={busy}
              onClick={onStop}
            >
              停止后台并退出
            </button>
          </div>
          <p className="settings-footnote">
            升级后如仍连接旧后台，停止后台并重新打开新版程序，才会启动新版后台。
          </p>
        </section>
        <section
          className={
            "settings-card settings-recovery" +
            (journal.length ? " pending-operations" : "")
          }
          aria-labelledby="settings-recovery"
        >
          <div className="settings-card-heading">
            <ShieldCheck size={19} aria-hidden="true" />
            <div>
              <h2 id="settings-recovery">未确认操作</h2>
              <p>沿原请求核对结果，保留原执行归属。</p>
            </div>
            <span className="workspace-count">{journal.length}</span>
          </div>
          {journal.length > 0 ? (
            <>
              <div className="settings-pending-list">
                {journal.map((record) => {
                  const item = recoveryItems.find(
                    (recovery) =>
                      recovery.id === record.id &&
                      recovery.machineId === record.machineId,
                  );
                  return (
                    <article
                      className="settings-pending"
                      key={record.machineId + ":" + record.id}
                    >
                      <div className="settings-pending-heading">
                        <strong>{operationName(record.op)}</strong>
                        <time dateTime={record.time}>{time(record.time)}</time>
                      </div>
                      <span className="settings-pending-source">
                        {machineName(record.machineId)}
                      </span>
                      <p>
                        {item
                          ? item.reason
                          : "正在只读核对原请求；不会重复发送。"}
                      </p>
                      {item && (
                        <code className="settings-recovery-code">
                          {item.code}
                        </code>
                      )}
                    </article>
                  );
                })}
              </div>
              <div className="settings-card-footer">
                <p>原回应未知时，执行资源继续保留占位。</p>
                <button
                  className="btn"
                  disabled={busy || querying}
                  onClick={onQuery}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  {querying ? "正在查询原请求…" : "查询原请求"}
                </button>
              </div>
            </>
          ) : (
            <div className="settings-clear-state">
              <CheckCheck size={20} aria-hidden="true" />
              <div>
                <strong>当前没有未确认操作</strong>
                <p>原操作需要核对时，会显示在这里。</p>
              </div>
            </div>
          )}
        </section>
        {removed.length > 0 && (
          <section
            className="settings-card network-relations"
            aria-labelledby="settings-removed"
          >
            <div className="settings-card-heading">
              <History size={19} aria-hidden="true" />
              <div>
                <h2 id="settings-removed">已移除机器</h2>
                <p>恢复原机器身份，继续保留任务和会话历史。</p>
              </div>
            </div>
            {removed.map((machine) => (
              <div className="settings-row" key={machine.machineId}>
                <div>
                  <strong>{machine.name}</strong>
                  <span>历史保留</span>
                </div>
                <button
                  className="btn"
                  disabled={
                    (managementReason?!!managementReason(machine.machineId):managementLocked) ||
                    !machineManagementSupported ||
                    !machine.connectionId
                  }
                  onClick={() => onRestore(machine)}
                >
                  恢复机器 · {machine.name}
                </button>
              </div>
            ))}
          </section>
        )}
      </div>
    </section>
  );
}
