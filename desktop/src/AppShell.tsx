import { useState, type ReactNode } from "react";
import {
  Monitor,
  GitBranch,
  MessageSquare,
  LayoutGrid,
  Settings2,
  RefreshCw,
  Minus,
  Square,
  X,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Workflow,
} from "lucide-react";
import type { Preferences } from "./types";

export const pages = [
  {
    id: "machines",
    label: "接入配置",
    icon: Monitor,
  },
  {
    id: "teams",
    label: "小队设置",
    icon: GitBranch,
  },
  {
    id: "board",
    label: "执行审计",
    icon: LayoutGrid,
  },
  {
    id: "conversations",
    label: "会话审计",
    icon: MessageSquare,
  },
  {
    id: "settings",
    label: "设置",
    icon: Settings2,
  },
] as const;
export type Page = (typeof pages)[number]["id"];

export default function AppShell({
  page,
  onPage,
  preferences,
  onlineCount,
  loading,
  error,
  counts,
  onTheme,
  onRefresh,
  onWindow,
  children,
}: {
  page: Page;
  onPage: (page: Page) => void;
  preferences: Preferences;
  onlineCount: number;
  loading: boolean;
  error: boolean;
  counts: Partial<Record<Page, number>>;
  onTheme: () => void;
  onRefresh: () => void;
  onWindow: (action: "minimize" | "maximize" | "close") => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("agentbridge.ui.sidebar") === "collapsed";
    } catch {
      return false;
    }
  });
  const current = pages.find((p) => p.id === page)!;
  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(
        "agentbridge.ui.sidebar",
        next ? "collapsed" : "expanded",
      );
    } catch {
      /* Layout remains usable without storage. */
    }
  }
  return (
    <div
      className={
        "app-shell workbench" + (collapsed ? " sidebar-collapsed" : "")
      }
    >
      <header className="titlebar">
        <div className="titlebar-brand">
          <Workflow size={14} />
          <span>AgentBridge</span>
        </div>
        <div className="window-controls">
          <button aria-label="最小化" onClick={() => onWindow("minimize")}>
            <Minus size={15} />
          </button>
          <button aria-label="最大化" onClick={() => onWindow("maximize")}>
            <Square size={12} />
          </button>
          <button
            className="close"
            aria-label="关闭窗口"
            onClick={() => onWindow("close")}
          >
            <X size={17} />
          </button>
        </div>
      </header>
      <aside className="sidebar" aria-label="应用导航">
        <div className="brand">
          <div className="brand-mark">
            <Workflow size={22} />
          </div>
          <div className="brand-copy">
            <strong>AgentBridge</strong>
          </div>
        </div>
        <nav aria-label="主导航">
          {pages
            .filter((p) => p.id !== "settings")
            .map((p) => (
              <button
                key={p.id}
                title={p.label}
                aria-label={p.label}
                aria-current={page === p.id ? "page" : undefined}
                className={"nav-item " + (page === p.id ? "active" : "")}
                onClick={() => onPage(p.id)}
              >
                <p.icon size={18} />
                <span>{p.label}</span>
                {p.id === "board" && !!counts[p.id] && <b>{counts[p.id]}</b>}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            aria-label="设置"
            title="设置"
            aria-current={page === "settings" ? "page" : undefined}
            className={"nav-item " + (page === "settings" ? "active" : "")}
            onClick={() => onPage("settings")}
          >
            <Settings2 size={18} />
            <span>设置</span>
          </button>
          <div
            className={
              "connection-dot " +
              (loading ? "is-loading" : !error && onlineCount ? "online" : "")
            }
          >
            <i />
            <span>
              {loading
                ? "正在连接后台"
                : error
                  ? "后台连接异常"
                  : `${onlineCount} 台机器在线`}
            </span>
          </div>
          <div className="sidebar-meta">
            <span>
              {preferences.version ? `v${preferences.version}` : "版本读取中"}
            </span>
            <button
              className="icon-btn"
              title="切换深浅主题"
              aria-label="切换深浅主题"
              onClick={onTheme}
            >
              <Sun className="theme-dark-icon" size={16} />
              <Moon className="theme-light-icon" size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className={"main page-" + page} id="workspace-main">
        <div className="topbar">
          <div className="topbar-location">
            <button
              className="icon-btn sidebar-toggle"
              title={collapsed ? "展开侧栏" : "收起侧栏"}
              aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
              aria-expanded={!collapsed}
              onClick={toggleSidebar}
            >
              {collapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
            <span className="breadcrumb">
              工作台
              <ChevronRight size={13} />
              <strong>{current.label}</strong>
            </span>
          </div>
          <div className="topbar-actions">
            <span
              className={
                "sync-status " +
                (error ? "has-error" : loading ? "is-loading" : "")
              }
            >
              <i />
              {loading ? "正在同步" : error ? "同步中断" : "自动同步"}
            </span>
            <button
              className="icon-btn"
              title="刷新数据"
              aria-label="刷新数据"
              onClick={onRefresh}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
