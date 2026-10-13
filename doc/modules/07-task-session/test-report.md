# M07 任务、会话与恢复测试报告

核对日期：2026-10-12。对应 [功能设计](design.md)。结论：请求去重、状态持久化、原执行恢复和受控交互通过；真实能力按适配器区分，Windows Codex 账号拒绝和 WSL Codex 续聊限制未解决。

## 1. 证据与统计口径

本节保留早期资料核对的核心 43/43、桌面 87/87 历史基线；alpha.6 本次核心 43/43、桌面 110/110 见文末，无失败、跳过：[核心 TAP](../../../artifacts/docs-baseline/2026-10-12/root-tests.tap)、[桌面 TAP](../../../artifacts/docs-baseline/2026-10-12/desktop-tests.tap)。以下案例是总基线的映射，共用案例不会被重复计为新的测试数量。

Core OpenCode 测试使用受控原生协议 fixture，是真实 Hub/Edge/存储集成，不是生产模型回复。真实生产工具证据另见 [I05-real.json](../../../artifacts/I05-real.json) 与 [I06A 原始报告](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.json)。

## 2. 功能与案例映射

| 案例 ID | 对应功能 | 真实测试文件 / 名称 | 判定与主要断言 |
| --- | --- | --- | --- |
| T-M07-01 | M07-F01 / F03 | `core.test.ts`：`state machine rejects impossible events, unknown recovery and terminal overwrite` | 通过；拒绝非法跃迁及终态覆写 |
| T-M07-02 | M07-F01 / F06 | `core.test.ts`：`Hub transactions, serial reservation and restart history are durable`；`Edge journal rejects input conflicts, duplicate invocation and replay after restart` | 通过；持久预约、输入冲突与 invocation 去重 |
| T-M07-03 | M07-F02 / F06 | `i03b.test.ts`：`B01: three turns use one Session, isolate answers, preserve owner/config and dedupe` | 通过；受控原生三轮同 Session，每轮结果隔离 |
| T-M07-04 | M07-F03 | `core.test.ts`：`duplicate events, payload conflicts, illegal transitions and result target checks preserve facts`；`UTF-8 clipping never splits code points` | 通过；seq 去重、来源/内容校验、裁剪标记 |
| T-M07-05 | M07-F04 / F06 | `opencode.test.ts`：`OpenCode v2 through Hub/Edge: ownership, waiting/reply, pagination, result, isolation, dedupe and restart` | 通过；受控权限/表单、原身份与恢复 |
| T-M07-06 | M07-F05 | `i03b.test.ts`：`B02: cancel once across duplicate IDs, lost response and completion race` | 通过；取消只调用一次，自然完成竞态保留真实终态 |
| T-M07-07 | M07-F07 | `i03b.test.ts`：`B03: Hub restart preserves observation and replays durable events without a new Prompt`；`B03: an ACK lost after Hub persistence replays the same seq once without invoking again` | 通过；仅补传事件，不补发 Prompt |
| T-M07-08 | M07-F07 | `i03b.test.ts`：`B04: Edge rebuild restores waiting and completed original executions using reads only`；`B04: missing input, foreign steering and configuration mismatch retain unknown occupancy` | 通过；原绑定恢复，证据不足保留 unknown |
| T-M07-09 | M07-F06 / F07 | `agent-network.test.cjs`：`transport uncertainty remains durable and retry queries the original receipt without a second native execution` | 通过；同 ID 查询，缺失回执继续占用 |
| T-M07-10 | M07-F06 / F07 | `pending-journal.test.cjs`：`request receipt from another identity or source cannot clear the warning`；`missing ordinary submission stays unknown`；`control receipts settle only confirmed or rejected original operation IDs` | 通过；恢复只核对原身份及有效收据 |
| T-M07-11 | M07-F06 / F07 | `main.test.cjs`：`a rejection on retry cannot erase uncertainty from the original attempt`；`changing an unresolved request payload cannot replace its original journal` | 通过；原始不确定性不能被新重试掩盖 |
| T-M07-12 | M07-F06 / F07 | `machine-daemon.test.cjs`：`ten same-ID requests invoke native submit once and changed content cannot reuse an ID`；`restart keeps daemon ID and receipts; missing backend receipt remains unknown without replay` | 通过；受控远端执行与回执持久化 |
| T-M07-13 | M07-F02 / F07 | `machine-daemon.test.cjs`：`closing a relay preserves running tasks and reconnect continuation uses the original native session` | 通过；受控 Session 一致及 relay 断开生存 |

代码：[核心单元测试](../../../tests/core.test.ts)、[会话/故障集成测试](../../../tests/i03b.test.ts)、[原生协议集成](../../../tests/opencode.test.ts)、[台账恢复测试](../../../desktop/tests/pending-journal.test.cjs)、[桌面入口测试](../../../desktop/tests/main.test.cjs)、[daemon 测试](../../../desktop/tests/machine-daemon.test.cjs)。

## 3. 真实工具与发布证据

| 案例 ID | 功能 | 环境与证据 | 结果 |
| --- | --- | --- | --- |
| T-M07-14 | M07-F01 / F02 | I05 Windows Claude、WSL OpenCode；[真实报告](../../../artifacts/I05-real.json) | 新会话和续聊通过；原生默认配置继承 |
| T-M07-15 | M07-F01 / F02 | I05 WSL Codex | 新会话通过；续聊失败，原生 `list_turns` 不支持 |
| T-M07-16 | M07-F01 | I05 Windows Codex | 未通过；默认模型被账号拒绝，未替换模型 |
| T-M07-17 | M07-F01 / F02 / F07 | I06A WSL 开发机 → 独立 Linux OpenCode；[说明](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.md) | 两轮回复、原会话查询、断线期间执行及重连读取通过 |
| T-M07-18 | M07-F07 | I05 0.5.0 普通 EXE 重开；[发布观察](../../../artifacts/I05-portable.json) | 历史保留，无新增 Prompt；不代表 I06A Windows 发布验收 |

T-M07-17 的脚本使用原 conversationId 续聊，原始报告没有保存两轮 native Session ID 对比。报告据此标记“同桥接会话续聊通过”，原生 Session ID 相等的真实验收证据仍待补齐。

## 4. 指标、限制及待补验收

| 项目 | 已有结果 | 尚未证明 |
| --- | --- | --- |
| 重复请求 10 次 | 节点/daemon 受控测试 native 调用次数=1 | 任意第三方原生故障下的全局恰好一次事务 |
| 输入与输出边界 | UTF-8 裁剪、截断标记、分页与输出上限受控通过 | 所有原生工具/版本的无限长输出体验 |
| 权限/表单控制 | OpenCode 协议 fixture 与既有原生控制证据 | 所有适配器、全部表单类型；Codex 表单代答未完整实现 |
| SSH 断线恢复 | 独立 Linux 开发链路读取原任务通过 | 新 Windows EXE 同链路验收、完整恢复延迟指标 |
| 流式表现 | 原生增量 → 后台记录 → UI 快照链路存在 | token 级实时延迟指标；界面不能以碎片日志数量冒充完整答案数量 |

本模块的 unknown 是预期保护行为。没有原生绑定或可靠未执行证明时，测试应断言继续占用、查询不重放，而不是断言自动变为失败并释放。

## 5. 复现与后续维护

运行核心 `npm test`、桌面 `npm test --prefix desktop`。真实脚本见 [windows-i05-real.cjs](../../../desktop/tests/windows-i05-real.cjs)；Linux 开发验收脚本在 `.agentbridge-dev`，需要隔离 profile 与明确的目标机器。

修改任务协议、状态、waiting、operation 或 Session 恢复时，先补反例，随后更新 [设计](design.md)、本报告和对应迭代验收。报告须保留原失败与环境限制，不能把新建 Session 的回复记为原会话恢复通过。

## 2026-10-12：6A 收尾

| 用例 ID | 功能 | 场景 | 结果 |
| --- | --- | --- | --- |
| T-M07-19 | M07-F02 | DesktopHost 会话列表/详情对已完成 OpenCode 返回 canContinue=true；权限等待时返回 false | 通过；扩展 [desktop-host.test.ts](../../../tests/desktop-host.test.ts)，真实受控 Hub/Edge 集成。完整核心基线见 [TAP](../../../artifacts/I06A-final/root-tests.tap) |

真实两轮原生 Session 比较、关闭窗口、停止后台与重连回查按 [Windows 报告](../../../artifacts/I06A-real/report.json) 实际结果记录；不能用此受控用例替代真实模型验证。

## 当前 6A 候选验收结果

2026-10-12 / 0.6.0-alpha.2：[真实 Windows 窗口](../../../artifacts/I06A-real/report.json)与[普通便携程序](../../../artifacts/I06A-final/portable.json)均通过。两轮保持同一 Conversation/native Session，关闭窗口保留同一后台，明确停止后新 PID 保留身份/机器/历史，恢复只查询原任务；普通程序请求数不增加。专项覆盖边界见 [6A 候选验收](../../iterations/I06/acceptance.md)。

## I06B 当前验证入口

2026-10-12 / 0.6.0-alpha.6：T-M07-20 / M07-F06/F07：旧父活跃时换主/清主读控原子；父终态拒绝；图元数据恢复不提交新 Prompt。本次代码、命令、逐项结果与限制汇总于 [I06B 实施](../../iterations/I06/graph-implementation.md)。受控工程结果见 [桌面 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)、[核心 TAP](../../../artifacts/I06B/2026-10-12/root-tests.tap)，界面见 [UI](../../../artifacts/I06B/2026-10-12/ui.json)、[性能](../../../artifacts/I06B/2026-10-12/performance.json)，本次核心 43/43、桌面 110/110、Windows 图 10 组通过；性能 p95 30.0ms。独立 SSH 双向原生链、普通无 debug EXE 及源/包完整性分别通过，原始证据与范围见当次报告。历史表保留原日期/版本，不计为本次重新运行。


T-M07-21 / M07-F06：2026-10-12 / alpha.6，执行前拒绝的原请求只读核对及传输/缺收据反例通过；与 T-M02-15 为同一共享回归，不增加项目测试数。[测试](../../../desktop/tests/pending-journal.test.cjs)。已有任务终态和控制效果没有因该元数据拒绝而变化。

## alpha.9 节点管理下的来源与历史

T-M07-22 / M07-F01/F02/F06/F07：2026-10-13 / alpha.9。[AgentNetwork 回归](../../../desktop/tests/agent-network.test.cjs)验证保留 task/conversation/nodeId，断开/移除后的新需求与旧 IPC 续聊拒绝，原任务可读、恢复沿用原身份，忙碌/unknown 不释放；工程通过，共用本次 [125/125 桌面结果](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)。未重跑真实模型续聊、原生故障或有历史的全部视觉矩阵。[完整证据与限制](../../iterations/I06/node-management.md)。
