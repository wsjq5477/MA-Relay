# AgentBridge 使用文档

AgentBridge 连接你已有的原生 Agent，在桌面配置机器、授权与查看执行历史，让获准的 Agent 从自己的原生会话调用其他 Agent。账号、模型、Skill 和业务执行仍由各个原生 Agent 管理。

当前 Windows x64 便携版为 `0.6.0-alpha.76.local.20261123.acp`，包含 DSH ACP 和自定义 ACP。ACP 工具权限回复仍仅在开发源码中提供。[下载公开便携版](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.76.local.20261123.acp)

从[快速开始](quickstart.md)完成第一条连接。在[产品功能](product.md)和[系统设计](architecture.md)了解整体工作方式。

## Agent 接入总览

**✓ 表示 Bridge 已适配该方式，— 表示尚未接入。** DSH NEXT 的插件是可选连接面板。ChatGPT Web 通过浏览器扩展接入。

<!--@include: ./_generated/connection-table.md-->

原生 CLI / API 是 **Bridge 调用 Agent** 的方式，MCP 是 **Agent 调用 Bridge** 的方式。OpenCode 的 CLI 启动服务，实际任务通过 HTTP 执行。OpenDesk CLI 只支持导出 MCP 配置片段，主动调用 Bridge 尚未确认。

查看[启动命令与会话控制表](agents/index.md#启动与会话控制)、[全部 Agent 的功能对照](agents/index.md#功能对照)和[接入方式比较](integration-methods.md)。

## 按工具阅读

- [Claude Code](agents/claude.md)、[Codex](agents/codex.md)、[OpenCode](agents/opencode.md)：直接任务、被委派，以及通过 MCP 主动协作。
- [Hermes](agents/hermes.md)、[Pi](agents/pi.md)：原生 CLI 任务与普通被委派。
- [DSH](agents/dsh.md)说明 DSH NEXT、ACP、CLI、Windows Desktop 和 Linux / WSL Web 的接入方式。

## 按工作场景阅读

- [机器与 Agent](machines.md)：本机、WSL、SSH 的发现与连接。
- [任务与会话](sessions.md)：原生需求入口、历史结果与原执行恢复。
- [关系与协作](collaboration.md)：保存授权关系，让 Agent 委派任务。
- [工作材料](materials.md)：阅读、选择与导出公共材料。
- [MCP 与连接授权](connections.md)：给原生 Agent 配置 Bridge MCP，管理连接权限。
