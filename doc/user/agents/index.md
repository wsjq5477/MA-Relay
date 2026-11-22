# 原生 Agent 适配

OpenDesk 提供 CLI 和 Windows 桌面入口。DSH 提供 DSH NEXT、CLI、Windows Desktop 和 Linux / WSL Web 入口。各入口沿用各自的原生配置。

## 接入方式总览

✓ 表示 Bridge 已适配该方式，— 表示尚未适配。MCP 列表示 Agent 主动调用 Bridge。DSH NEXT 的插件显示已获准的连接与状态，任务使用原生 CLI 执行。

<!--@include: ../_generated/connection-table.md-->

OpenCode 的 CLI 用于启动服务，HTTP API 用于执行任务。DSH Desktop / Web 直接连接已运行的原生服务，不经 headless CLI。

ChatGPT Web 使用浏览器扩展。将[扩展附件](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.72)解压到固定目录，在 Chrome 或 Edge 的扩展管理页启用开发者模式并加载。打开 AgentBridge 的「设置 → 浏览器接入」为该扩展生成配对包，再到扩展设置页连接并授予 ChatGPT 网页访问权限。已绑定会话可续聊，网页提交后的停止在网页处理。

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
| [DSH](dsh.md) | DSH NEXT、CLI、Windows Desktop、Linux / WSL Web |
| [OpenDesk](opendesk.md) | CLI原生HTTP、Windows桌面WebSocket与独立MCP |

比较[六种接入方式](../integration-methods.md)，或按[快速开始](../quickstart.md)配置现有入口。

Hermes的原生网关任务不能通过关闭CLI确认取消，Bridge的取消能力为不支持；请在Hermes原生会话停止。缺终态时保留原请求，不重发。
