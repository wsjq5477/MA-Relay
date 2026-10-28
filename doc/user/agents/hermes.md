# Hermes

Bridge桌面提供配置、审计和原执行恢复；本页列出的执行/续聊等是后台适配能力。日常需求从原生Agent会话提出，或由获准主Agent委派。

## 如何连接

Bridge 调用 Hermes Agent 原生 CLI，通过 stream-json 读取会话输出，保留原生会话标识以续聊。账号、模型与工具使用 Hermes 自身配置。

Windows会在PATH之外检查`%LOCALAPPDATA%/hermes/bin/hermes.exe`及`HERMES_HOME/bin`，版本探测最多20秒；无需移动安装目录。

在执行机器安装并配置 Hermes，确认原生 CLI 可工作，然后在 Bridge 检测工具，配置独立Bridge MCP并从Hermes原生会话工作，或由获准主Agent委派给该节点。

## 支持的功能

支持直接会话、同会话续聊、结果读取，以及接收普通委派。Windows原生Hermes 0.22.5已核对；网关任务的Bridge取消尚未适配，请在Hermes原生会话停止，退出CLI不代表取消成功。当前支持独立MCP调用方与原生配置；原生小队、Bridge内权限与结构化表单回复未适配。

这表示 Claude Code、Codex 或 OpenCode 可以把普通任务委派给 Hermes，Hermes要主动调用Bridge则需要独立MCP接入及相应关系授权，接收委派本身不授予该权限。

## 使用注意

安装和版本发现不等于原生账号、模型及具体环境已经可用。首次连接先确认实际任务与续聊行为，再用于跨机器工作。配置仍在 Hermes 侧维护。

Hermes提示等待审批或补充输入、查看器已分离时，请回到同一个Hermes原生会话处理；退出查看器不代表后台任务结束。保留Bridge原请求并查询原状态，不换ID重发。当前源码已补齐这类退出的待核对保护，公开alpha.67尚未包含该修复。

当前源码另可在所选启动进程明确未启动时显示启动失败；先修复原安装，再另行发起需求，查询旧请求仍返回原失败，不自动重试。已经启动但结果不明的任务继续保留待核对。此修复尚未包含在公开alpha.67中。

[功能对照](index.md#功能对照)与[关系授权](../collaboration.md)说明入口之间的区别。

## 原生 MCP 配置

当前可在Hermes节点的配置窗口添加、移除、导出或撤销AgentBridge MCP。Bridge沿用目标机器的原生Home和当前Profile，保留模型、其他MCP和用户配置；更改后在Hermes执行`/reload-mcp`并核对原生列表。列表显示条目并不代表模型已调用。

切换Home/Profile后，先移除原接入再为当前目标添加。移除只清理原目标；原生禁用或删除不会被自动恢复，显式撤权后旧客户端的新调用被拒绝。不要重发状态未知的原任务。

经典MCP提供十个工具，包含预授权连接/断开。Windows和Linux正式安装版Hermes 0.22.5均已核对原生MCP组件、实际执行与同Session续聊；网络与模型账号须在目标机器上可用。模型自主MCP委派、原生网关取消与完整生命周期仍未准出。

## Linux / WSL / SSH

WSL后台需要该发行版中的Node 22.13或更新版本，以及可访问原生模型端点的网络。安装CLI不代表模型已经登录或可用。

在目标Linux机器安装并配置Hermes后，先确认原生`hermes --version`可工作，再在Bridge扫描该机器。账号、模型与Profile仍由那台机器上的Hermes管理，Windows安装与Linux安装独立。

Linux支持非交互环境发现：除了PATH和`~/.local/bin/hermes`，还会检查原生数据目录的`bin`、`hermes-agent/.hermes/bin`及旧`venv/bin`布局。若源码安装在独立位置，让目标机器的Bridge后台继承`HERMES_INSTALL_DIR`；它与`HERMES_HOME`（数据与配置目录）分开解析。支持`~`及已配置的环境变量，不执行shell初始化文件。

切换Profile不会创建新Profile或自动迁移旧任务；状态未知的请求继续查询原ID。网关任务须在原生Hermes会话停止，关闭CLI不代表取消。新源码不会自动替换已运行的Linux/SSH后台。
