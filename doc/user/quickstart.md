# 快速开始

从 Windows 上已有的原生 Agent 会话，把一条只读任务交给另一位 Agent，再回到原会话核对答案。下面以 DSH NEXT 作主 Agent 为例。

## 准备便携版和两个 Agent

1. 下载并直接运行当前 Windows x64 便携版 `0.6.0-alpha.76.local.20261123.acp`。[下载便携 EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.76.local.20261123.acp/AgentBridge-0.6.0-alpha.76.local.20261123.acp-Windows-x64.exe) · [发布页和校验文件](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.76.local.20261123.acp)
2. 准备一个能调用 Bridge MCP 的主 Agent 和一个能接收委派的目标 Agent。例子可以用 Windows 上的 DSH NEXT 和已配置好的 Claude Code。先确认两者各自在原生环境中能返回回答。账号、模型和工具权限由各自的原生配置提供。[Agent 能力对照](agents/index.md#功能对照) · [DSH 接入说明](agents/dsh.md)
3. 在目标 Agent 实际使用的工作目录中选一个已有的短文本文件，例如 `README.md`。自行记下第一行非空文字，稍后用于核对。目标在另一台机器时，使用那台机器上的文件。

## 接入并授权

1. 在 Bridge 的「接入配置」打开本机，检测工具，接入主 Agent 和目标 Agent。若目标在 WSL 或 SSH 机器上，先添加并检测对应环境。
2. 保存主 Agent 到目标 Agent 的连接授权。打开主 Agent 行的「配置」，按提示添加或导出 Bridge MCP 配置，再按原生工具要求重新加载。[MCP 与连接授权](connections.md)
3. 回到主 Agent 的**原生会话**，请它“用 AgentBridge 的 `list_agents` 列出我已获准调用的目标”。核对返回结果中的名称和机器。找不到目标时，回到「接入配置」核对授权和原生 MCP 的连接状态。

## 发出第一条只读任务

在同一原生会话中发送下面这句话，把目标和文件名替换成实际值。将预期答案留给自己核对。

> 请通过 AgentBridge 把任务委派给刚才列出的 Claude Code。让它只读自己工作目录里的 README.md，返回第一行非空文字，保留原文。不要改文件。请从原任务取回结果，告诉我目标名称、任务 ID 和原文。

成功时，主 Agent 应给出目标返回的原文。在 Bridge 的「执行审计」打开同一目标和任务 ID，核对原任务已成功、结果正文与文件一致。需要续聊时回到刚才的主 Agent 会话，指定继续上一条委派；支持续聊的目标会沿用原绑定。[任务与会话](sessions.md)

## 回应未知时

若原生会话中断或任务显示 `unknown`，保留这次请求。在原会话里请主 Agent 通过 `task_result` 查询原任务 ID 或原委派 ID。独立调用方如果在收到任务 ID 前掉线，可用提交时的同一个请求 ID 作为 `clientRequestId` 只读查询。暂时查不到结果时保留原记录，避免重发需求。

若原任务在等待权限或输入，先检查原生工具。需要从 Bridge 处理时，在「执行审计」打开原任务，选择「处理这条原执行」，按该入口提供的能力操作。回复或取消后，回到原任务查看最终结果。[交互与恢复](sessions.md)
