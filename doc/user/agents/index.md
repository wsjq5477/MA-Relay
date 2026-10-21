# 原生 Agent 适配

AgentBridge 支持六种产品，DSH 分为 CLI、Windows Desktop 和 Linux / WSL Web 三个入口。各入口沿用原生配置；下面分别列出连接方式与可用功能。

## 接入方式总览

✓ 表示 Bridge 已适配该方式，— 表示尚未适配。MCP 列代表 Agent 主动调用 Bridge，其余执行方式列代表 Bridge 调用 Agent。两种方向要分别判断。

<!--@include: ../_generated/connection-table.md-->

OpenCode 的 CLI 用于启动服务，HTTP API 用于执行任务。DSH Desktop / Web 直接连接已运行的原生服务，不经 headless CLI。

Desktop / Web 服务入口需要包含该功能的 AgentBridge 版本，公开 alpha.34 尚不包含；其原实例连接与任务可用性需按目标环境确认。表中不是对任意版本和机器的可用保证。

## 功能对照

<!--@include: ../_generated/capability-table.md-->

“被委派”指接收普通子任务；“调用 Bridge MCP”指主动发现目标、委派和查询。Hermes、Pi 和 DSH 支持前者，目前不支持后者。权限回复仅覆盖已适配的原生交互类型，Claude Code 的结构化提问尚不支持 Bridge 内表单回复。

## 按 Agent 阅读

| Agent | 入口与主要说明 |
| --- | --- |
| [Claude Code](claude.md) | stream-json CLI、续聊、权限与 MCP |
| [Codex](codex.md) | exec / resume CLI、取消与 MCP |
| [OpenCode](opencode.md) | CLI 启动原生服务，HTTP 执行与交互 |
| [Hermes](hermes.md) | CLI 直接会话与普通被委派 |
| [Pi](pi.md) | CLI 会话文件、续聊与普通被委派 |
| [DSH](dsh.md) | CLI、Windows Desktop、Linux / WSL Web |

比较[六种接入方式](../integration-methods.md)，或按[快速开始](../quickstart.md)配置现有入口。
