# Hermes

## 如何连接

Bridge 调用 Hermes Agent 原生 CLI，通过 stream-json 读取会话输出，保留原生会话标识以续聊。账号、模型与工具使用 Hermes 自身配置。

在执行机器安装并配置 Hermes，确认原生 CLI 可工作，然后在 Bridge 检测工具，选择节点与工作目录发起需求。

## 支持的功能

支持直接会话、同会话续聊、结果读取、取消，以及接收普通委派。当前不支持作为 Bridge MCP 调用方或原生小队成员，也没有 Bridge 内权限与结构化表单回复。

这表示 Claude Code、Codex 或 OpenCode 可以把普通任务委派给 Hermes，但 Hermes 不能据此主动调用 Bridge 再委派其他目标。

## 使用注意

安装和版本发现不等于原生账号、模型及具体环境已经可用。首次连接先确认实际任务与续聊行为，再用于跨机器工作。配置仍在 Hermes 侧维护。

[功能对照](index.md#功能对照)与[关系授权](../collaboration.md)说明入口之间的区别。
