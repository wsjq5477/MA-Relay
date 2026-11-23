# Windows 本机 DSH 首次委派

适用版本为 AgentBridge Windows x64 便携候选 `0.6.0-alpha.76.local.20261123.dsh.2`。本例在同一台 Windows 机器上，从 DSH NEXT 原生会话委派给单独接入的 DSH ACP 节点。

## 准备并接入

1. 直接运行交付的便携 EXE，等「接入配置」能显示本机。打开已经安装并登录的 DSH NEXT。
2. 在 Bridge 扫描本机，分别接入「DSH NEXT」和「DSH ACP」。如果只发现 DSH NEXT，核对原生安装是否包含 ACP Profile。DSH ACP 使用自己的原生模型路由。使用已有 DeepSeek 账号时，按 DSH 文档在原生 ACP Profile 核对认证和模型。
3. 打开「关系图」，把 DSH NEXT 设为主 Agent，从 DSH NEXT 的输出端连到 DSH ACP 的输入端，再点「保存授权」。如果接入操作暂时显示「待核对」，等原操作完成。
4. 打开 DSH NEXT 的「配置」，确认 Bridge MCP 显示「已写入」。如果尚未配置，按页面操作写入。需要重载时完整退出 DSH NEXT 再打开。只关闭 DSH 窗口后，检查它是否仍驻留。
5. 在 DSH NEXT 新开原生会话，让它通过 AgentBridge 的 `list_agents` 列出获准目标。返回结果中应有同一台 Windows 机器上的「DSH ACP」。若工具没加载，回到原生工具确认使用的是刚写入配置的 Profile；若工具能调用但列表没有该目标，回到 Bridge 核对授权方向。[DSH 入口和认证](../../user/agents/dsh.md)

## 读回第一条结果

选一个目标工作目录，在其中新建 `first-use.txt`，写入一行自己知道的短文本。把下方的目录换成实际路径。

> 请通过 AgentBridge 把任务交给获准的 DSH ACP，工作目录是 D:/我的测试目录。请目标只读 first-use.txt，返回第一行原文，然后用 task_result 查回原任务并告诉我结果和任务 ID。

在原生会话中核对答案，再到 Bridge 的「执行审计」按原任务 ID 查看实际目标、状态和正文。继续追问时让主 Agent 使用原委派的会话，要求目标只根据上一轮记忆回答。关闭 Bridge 窗口重新打开后，仍可查询原任务和原事件。

## 处理原任务

出现工具权限询问时，在「执行审计」打开原任务，点「处理这条原执行」。执行命令要核对页面显示的完整命令，再决定拒绝或「仅允许本次」。如果命令信息缺失，界面只提供拒绝。回复和取消后回到原任务查看实际结局。

如果结果为 `unknown`，请主 Agent 通过 `task_result` 查询原任务 ID 或原委派 ID。暂时找不到结果时保留原记录，等原请求可核对后再决定下一步。[任务与会话](../../user/sessions.md)
