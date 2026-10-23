# Hermes

## 如何连接

Bridge 调用 Hermes Agent 原生 CLI，通过 stream-json 读取会话输出，保留原生会话标识以续聊。账号、模型与工具使用 Hermes 自身配置。

在执行机器安装并配置 Hermes，确认原生 CLI 可工作，然后在 Bridge 检测工具，选择节点与工作目录发起需求。

## 支持的功能

支持直接会话、同会话续聊、结果读取、取消，以及接收普通委派。alpha.50本地候选支持独立MCP调用方与原生配置；原生小队、Bridge内权限与结构化表单回复未适配。早期alpha.46仅导出MCP片段。

这表示 Claude Code、Codex 或 OpenCode 可以把普通任务委派给 Hermes，Hermes要主动调用Bridge则需要独立MCP接入及相应关系授权，接收委派本身不授予该权限。

## 使用注意

安装和版本发现不等于原生账号、模型及具体环境已经可用。首次连接先确认实际任务与续聊行为，再用于跨机器工作。配置仍在 Hermes 侧维护。

[功能对照](index.md#功能对照)与[关系授权](../collaboration.md)说明入口之间的区别。

## 原生 MCP 配置

alpha.50本地候选可在Hermes节点的配置窗口添加、移除、导出或撤销AgentBridge MCP。Bridge沿用目标机器的原生Home和当前Profile，保留模型、其他MCP和用户配置；更改后在Hermes执行`/reload-mcp`并核对原生列表。列表显示条目并不代表模型已调用。

切换Home/Profile后，先移除原接入再为当前目标添加。移除只清理原目标；原生禁用或删除不会被自动恢复，显式撤权后旧客户端的新调用被拒绝。不要重发状态未知的原任务。
