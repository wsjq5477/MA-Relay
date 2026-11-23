# Windows 本机 DSH 首次委派开发与验收

2026-11-23 至 24 日，Windows 11，本机原生 DSH NEXT 2.0.24-next。调用方使用 DSH NEXT 的原生界面和已有 DeepSeek 账号，目标使用同一原生安装的独立 DSH ACP 节点。Bridge 配置、任务工作目录、临时文件和日志位于 D 盘，候选 EXE 位于 E 盘。[计划](windows-dsh-next-steps.md) · [候选包使用说明](windows-dsh-first-use-guide.md)

## 首个候选和发现的问题

首个本地便携 EXE `0.6.0-alpha.76.local.20261123.dsh.1` 使用源码 `e9a9120`。真实窗口普通启动，约 187 秒观察到已连接的后台快照。本次使用全新 Bridge 配置，由生产后台接口完成节点接入、单向授权和原生 MCP 写入。隔离的 DSH 原生 Profile 完成引导，写入 MCP 后退出并重开 DSH。过程含人工准备及两段操作间隔，未采集连续的新用户首用耗时。

| 实现场景 | 观察结果 |
| --- | --- |
| 本机首次委派 | 从真实 DSH NEXT 窗口发一条需求。模型调用 `list_agents` 找到 DSH ACP，实际委派一次，目标读取指定目录的夹具并返回正确标记。主会话通过 MCP 读回原回复。首次正文含 Markdown 包裹，标记匹配。 |
| 原会话追问和重开 | 第二条真实请求沿用原委派会话。目标返回同一标记，Bridge 会话和原生 Session 都相同。正常关闭原窗口，重开同一份包后查回原结果。原生 MCP 用原任务续读事件游标。 |
| 原生工具权限 | 独立任务通过 DSH ACP 触发真实工具询问。Windows DSH 原生把 PowerShell 报作 `kind: other`，桥接只展示 `pwsh`，却允许单次批准。操作方拒绝原询问，按同一操作 ID 查得 `confirmed` 写入收据。 |
| 原生取消 | 另一个独立任务在原生权限等待时取消。首个收据为 `unknown`，同 ID 后续为 `confirmed`，原 ACP 任务独立达到 `cancelled`，待处理权限已消失。 |
| 上一轮未知任务 | Bridge 原日志仍为 `native`、`started`、`unknown`。逐帧读取同一原生 Session 的压缩日志，发现模型尝试以及 `MISSING_CREDENTIAL` 轮次错误，没有原生工具调用或权限询问。Bridge 未收到可结算的原协议终态，保留原 task 的 `unknown`。 |

## 修复

DSH ACP 的原生工具信息在请求权限前通过 `session/update` 发送。共享 worker 根据同一工具 ID 合并之前的更新。DSH 的 PowerShell 和 Bash，即使类型为 `other`，也按命令执行展示。通用 ACP 工具携带明确的 `command` 或 `cmd` 参数时同样按执行类展示。只有完整命令可显示时才开放单次允许，缺命令时仍可拒绝。结果状态和原回复收据各自核对。[ACP worker](../../../desktop/electron/acp-worker.cjs) · [协议](../../protocol.md)

受控 Windows ACP worker 专项 11/11 通过，新增两项用例覆盖 DSH PowerShell 的实际事件格式以及命令缺失时的禁止批准。

## 最终候选

使用修复提交 `5aadfeb` 构建 Windows x64 便携 EXE `0.6.0-alpha.76.local.20261123.dsh.2`。大小 588,292,933 字节，SHA-256 为 `cfa4287b7ac2be40a1f65faa2d8f6cd6fbe1e11913866ec7d227878aea0c5ade`。本地取得，已核对实际 EXE。

| 场景 | 最终候选观察 |
| --- | --- |
| 启动和首次配置 | 以空白 Bridge profile 启动实际 EXE。使用桌面界面接入两个独立节点，把 DSH NEXT 设为主 Agent，以键盘连线保存到 DSH ACP 的单向授权。打开配置核对原生 MCP 已写入，重开 DSH NEXT。约 184 秒观察到后台快照，约 8 分 12 秒观察并核对首次正确结果。这次计时含桌面自动化及人工核对间隔。 |
| 首次委派和续聊 | 从原生 DSH NEXT 新会话开始，模型发现获准的 DSH ACP，目标文件的唯一标记出现在原结果与主会话。第二条委派沿同一 Bridge 会话和原生 Session 读回同一标记。 |
| 仅允许本次 | 真正的 ACP 询问显示 `pwsh` 与完整 `echo` 命令。从原任务进入处理状态，点击「仅允许本次」。原操作写入为 `confirmed`。原生记录有一次询问、一次 `allowed-once`，工具输出匹配测试文字。原任务单独达到 `succeeded`。 |
| 拒绝 | 独立的新任务从「执行审计」打开原权限并拒绝。原生记录有一次 `rejected`，命令未执行。原生会话随后结束并报告拒绝，Bridge 记录该会话任务为 `succeeded`。 |
| 取消 | 独立的新任务触发原生权限等待。界面经「取消本轮」确认取消，原权限得出 `cancelled`，原生记录没有命令输出，原 task 终态为 `cancelled`。 |
| 关窗重开与原请求 | 关闭窗口后普通重开同一份 EXE，出现真实窗口和本次连接快照。按 5 条原 request ID 找回同一任务、原生 Session、终态和事件序列。查回两条回复收据和一条取消收据，均为 `confirmed`。DSH 原生会话用 `task_result` 沿原任务从游标 2 读取事件分页，任务数仍为 5。 |

开发者试用范围为 Windows 本机 DSH。独立新用户的自助试用仍待安排。编排脚本通过本地调试端口操作真实界面，重开用普通启动。源码专项共 35/35，用户文档 8/8，实际构建含 19 个 HTML 页。历史证据引用仍有 2,219 条缺失，基线差异为零。

本机证据包括候选旁的 `acceptance-summary.json`、`build.log`、`regression.log` 和 `docs-build.log`。任务原标识、原生 Profile 和现场日志保留在 D 盘的私有验收目录。
