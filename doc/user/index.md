# AgentBridge 使用文档

AgentBridge 连接你已有的原生 Agent，让你在一个桌面入口查看机器、发起任务、继续会话，并允许获准的 Agent 调用其他 Agent。账号、模型、Skill 和业务执行仍由各个原生 Agent 管理。

从[快速开始](quickstart.md)完成第一条连接；在[产品功能](product.md)和[系统设计](architecture.md)了解整体工作方式。

## Agent 接入总览

七种产品按十个执行入口展示。**✓ 表示当前适配方式，— 表示尚未接入该方式**，不是厂商产品的全部能力。Desktop/Web 服务入口需要包含该功能的 AgentBridge 版本，当前公开 0.6.0-alpha.60 已包含这两个入口。

<!--@include: ./_generated/connection-table.md-->

原生 CLI / API 是 **Bridge 调用 Agent** 的方式；MCP 是 **Agent 调用 Bridge** 的方式。OpenCode 的 CLI 用于启动服务，实际任务通过 HTTP 执行。ACP、插件和 SDK 当前均没有内置驱动。

查看[全部 Agent 的功能对照](agents/index.md)、[六种接入方式的优缺点与选择建议](integration-methods.md)。

## 按工具阅读

- [Claude Code](agents/claude.md)、[Codex](agents/codex.md)、[OpenCode](agents/opencode.md)：直接任务、被委派，以及通过 MCP 主动协作。
- [Hermes](agents/hermes.md)、[Pi](agents/pi.md)：原生 CLI 任务与普通被委派。
- [DSH](agents/dsh.md)：分别说明 CLI、Windows Desktop 和 Linux / WSL Web 的接入与能力。

## 按工作场景阅读

- [机器与 Agent](machines.md)：本机、WSL、SSH 的发现与连接。
- [任务与会话](sessions.md)：新建、续聊、结果、权限与取消。
- [关系与协作](collaboration.md)：保存授权关系，让 Agent 委派任务。
- [工作材料](materials.md)：阅读、选择与导出公共材料。
- [MCP 与连接授权](connections.md)：给原生 Agent 配置 Bridge MCP，管理连接权限。
