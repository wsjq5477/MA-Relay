# Claude Code

本地alpha.62的Bridge桌面只提供配置、审计和原执行恢复；本页列出的执行/续聊等是后台适配能力。日常需求从原生Agent会话提出，或由获准主Agent委派；公开alpha.60仍保留旧桌面入口。

## 如何连接

Bridge 调用 Claude Code 原生 CLI，通过 stream-json 接收输出与执行状态；续聊继续关联原生会话。任务继承目标机器上的 Claude Code 登录与原生配置。

在对应机器安装并确认 Claude Code 可独立工作，再在“接入配置”检测工具。为Claude Code配置获准的Bridge MCP，再从Claude原生会话输入需求；委派时指定目标机器上的目录。

## 支持的功能

直接会话、新建与续聊、读取结果、取消、普通被委派，以及作为 Bridge MCP 调用方。支持已适配的权限请求回复；结构化 AskUserQuestion 当前不能在 Bridge 表单里回复。

权限操作完成后仍需等待任务状态；允许一次原生工具调用不表示整条任务已经成功。

## MCP 与协作

可在启用协作的托管会话中使用 Bridge MCP，也可在“接入配置”的 Claude Code 行点击“配置”，将 Bridge MCP 写入原生工具配置。连接身份和授权范围决定可用目标，保存关系不会立即开始执行。

详见[MCP 与连接授权](../connections.md)和[关系与协作](../collaboration.md)。

## 配置归属

模型、Skill、工具权限和项目约定继续由 Claude Code 管理。更换本机或远端程序版本后重新检测，旧会话仍关联其原执行环境。
