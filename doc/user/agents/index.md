# 原生 Agent 适配

Bridge 当前适配 8 种产品的 13 个入口。OpenDesk 提供 CLI 和 Windows 桌面入口。DSH 提供 DSH NEXT、ACP、CLI、Windows Desktop 和 Linux / WSL Web 入口。各入口沿用各自的原生配置。

## 接入方式总览

✓ 表示 Bridge 已适配该方式，— 表示尚未适配。OpenDesk CLI 的 MCP 可导出配置片段。MCP 列表示 Agent 主动调用 Bridge。DSH NEXT 的插件显示已获准的连接与状态，任务使用原生 CLI 执行。

<!--@include: ../_generated/connection-table.md-->

OpenCode 的 CLI 用于启动服务，HTTP API 用于执行任务。DSH Desktop / Web 直接连接已运行的原生服务，不经 headless CLI。

ChatGPT Web 使用浏览器扩展。将[扩展附件](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.72)解压到固定目录，在 Chrome 或 Edge 的扩展管理页启用开发者模式并加载。打开 AgentBridge 的「设置 → 浏览器接入」为该扩展生成配对包，再到扩展设置页连接并授予 ChatGPT 网页访问权限。已绑定会话可续聊，网页提交后的停止在网页处理。

## 启动与会话控制

下表列出 Bridge 实际调用的关键参数或服务入口。Bridge 会按原生入口补充工作目录、认证、会话和权限参数。✓ 表示 Bridge 支持，— 表示 Bridge 暂无此操作入口。

### 原生 CLI（6）

| Agent | Bridge 使用的命令或入口 | 同会话续聊 | 回合中插话 | 回退检查点 | Bridge 主动压缩 |
| --- | --- | --- | --- | --- | --- |
| Claude Code | `claude --print --input-format stream-json --output-format stream-json` | ✓ `--resume` | — | — | — |
| Codex | `codex exec --json` | ✓ `codex exec resume` | — | — | — |
| Hermes | `hermes chat --query-file - --format stream-json` | ✓ `--resume` | — | — | — |
| Pi | `pi --mode json --print --session-dir <目录>` | ✓ `--session` | — | — | — |
| DSH CLI | `dsh --profile headless --json -` | ✓ `--session-id` | — | — | — |
| DSH NEXT | Windows 安装包内 CLI，带 `--profile headless --json -` | ✓ `--session-id` | — | — | — |

### 原生 HTTP / WebSocket（5）

| Agent | Bridge 使用的命令或入口 | 同会话续聊 | 回合中插话 | 回退检查点 | Bridge 主动压缩 |
| --- | --- | --- | --- | --- | --- |
| OpenCode | `opencode serve` 启动服务，HTTP 执行任务 | ✓ 原 Session | — | — | — |
| OpenDesk CLI | `opendesk serve --mode opencode` 启动服务，HTTP 执行任务 | ✓ 原 Session | — | — | — |
| DSH Desktop | 连接已启动的 Windows 桌面服务，使用认证 HTTP Session API | ✓ 原 Session | — | — | — |
| DSH Web | 连接已启动的 `dsh --profile web` 服务，使用认证 HTTP Session API | ✓ 原 Session | — | — | — |
| OpenDesk Desktop | 连接已启动桌面实例的 WebSocket 设备网关 | ✓ 原网关连接与会话 | — | — | — |

### ACP（1）

| Agent | Bridge 使用的命令或入口 | 同会话续聊 | 回合中插话 | 回退检查点 | Bridge 主动压缩 |
| --- | --- | --- | --- | --- | --- |
| DSH ACP | Windows DSH NEXT 包内 CLI，带 `--profile acp` | ✓ 同一原生 Session | — | — | — |

### 浏览器扩展（1）

| Agent | Bridge 使用的命令或入口 | 同会话续聊 | 回合中插话 | 回退检查点 | Bridge 主动压缩 |
| --- | --- | --- | --- | --- | --- |
| ChatGPT Web | Chrome / Edge 扩展与 Bridge 配对，操作获准的网页会话 | ✓ 原可验证可见对话 | — | — | — |

**同会话续聊**在上一轮结束后沿用原会话与目标。**回合中插话**指任务仍运行时发送一条新需求。等待权限或表单时的原生答复见下方功能对照。

**回退检查点**指由 Bridge 将会话或工作区恢复到指定检查点。**Bridge 主动压缩**指由 Bridge 触发上下文压缩。原生工具自己的历史与上下文管理仍由该工具负责。

Claude Code 和 Codex 使用原生 CLI。当前 ACP 入口为 DSH ACP。厂家 SDK 驱动暂未接入。MCP 用于 Agent 主动调用 Bridge。

## 功能对照

<!--@include: ../_generated/capability-table.md-->

“被委派”指接收普通子任务；“调用 Bridge MCP”指主动发现目标、委派和查询。权限回复按原生入口支持的交互类型处理。Claude Code 的结构化提问尚不支持 Bridge 内表单回复。

## 按 Agent 阅读

| Agent | 入口与主要说明 |
| --- | --- |
| [Claude Code](claude.md) | stream-json CLI、续聊、权限与 MCP |
| [Codex](codex.md) | exec / resume CLI、取消与 MCP |
| [OpenCode](opencode.md) | CLI 启动原生服务，HTTP 执行与交互 |
| [Hermes](hermes.md) | CLI 直接会话与普通被委派 |
| [Pi](pi.md) | CLI 会话文件、续聊与普通被委派 |
| [DSH](dsh.md) | DSH NEXT、ACP、CLI、Windows Desktop、Linux / WSL Web |
| [OpenDesk](opendesk.md) | CLI原生HTTP、Windows桌面WebSocket与独立MCP |

比较[六种接入方式](../integration-methods.md)，或按[快速开始](../quickstart.md)配置现有入口。

Hermes的原生网关任务不能通过关闭CLI确认取消，Bridge的取消能力为不支持；请在Hermes原生会话停止。缺终态时保留原请求，不重发。
