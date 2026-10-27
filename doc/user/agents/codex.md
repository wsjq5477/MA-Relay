# Codex

当前alpha.64的Bridge桌面提供配置、审计和原执行恢复；本页列出的执行/续聊等是后台适配能力。日常需求从原生Agent会话提出，或由获准主Agent委派。

## 如何连接

Bridge 使用 Codex 原生 CLI 的 exec / resume 与 JSON 输出，创建任务并在同一原生会话续聊。执行沿用该机器上的 Codex 登录和原生配置。

在目标机器确认 Codex 可正常执行，再运行 Bridge 工具检测。为Codex配置Bridge MCP，从Codex原生会话开始工作，或由获准主Agent委派给该节点。WSL 与 Windows 的 Codex 是各自环境中的安装，不能混用目录和配置。

## 支持的功能

支持直接会话、续聊、结果读取、取消、普通被委派，以及通过 Bridge MCP 主动协作。当前入口没有适配 Bridge 内的原生权限回复或结构化输入表单。

取消会作用于原执行进程，并继续核对原任务结果。结果未知时先查询原请求，不重复提交。

## MCP 与协作

“接入配置”的 Codex 行右侧“配置”支持管理原生 MCP 连接；托管协作会话也可使用其获准的 Bridge MCP 通路。MCP 调用方能力与 CLI 执行能力分开管理。

按[MCP 与连接授权](../connections.md)配置，再通过[关系与协作](../collaboration.md)选择允许委派的目标。

## 配置归属

模型、供应商、工具策略和项目约定由原生 Codex 配置。Bridge 不为这个节点另存模型账号，也不通过切换会话绕过原生策略。
