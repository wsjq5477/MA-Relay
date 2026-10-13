# M08 主从协作测试报告

核对日期：2026-10-12。对应 [功能设计](design.md)。结论：单组单层协作及四条 Windows/WSL 真实委派链通过；alpha.6 的换主/清主原父读控反例和独立 SSH 双向核心链通过；全部权限/表单/取消和 I06C 故障矩阵仍不能标全部通过。

## 1. 证据层级

本报告保留发现修复的历史 89/89 基线；alpha.6 当次桌面 110/110 与核心 43/43 均实际重跑通过，见文末 I06B 证据。映射案例与其他模块共享，不独立叠加数量。

- [桌面 TAP](../../../artifacts/codex-discovery/2026-10-12/desktop-tests.tap)：受控节点、授权和 stdio MCP。
- [I05-real.json](../../../artifacts/I05-real.json)：真实生产工具、原生子回复及父汇总；总状态 partial，不能删去原生失败。
- [I05-codex-main.json](../../../artifacts/I05-codex-main.json)：WSL Codex 主任务真实 MCP 接入。
- [I05-ui.json](../../../artifacts/I05-ui.json)：隔离浏览器 mock 交互，只证明界面操作与调用参数。
- [I05 验收说明](../../iterations/I05/acceptance.md)：环境、产物与历史验收口径；当前权限限定以本报告和当前源码为准。

## 2. 功能与案例映射

| 案例 ID | 功能 | 真实测试文件 / 名称 | 结果与断言 |
| --- | --- | --- | --- |
| T-M08-01 | M08-F01 | `agent-network.test.cjs`：`relations persist with optimistic revisions and reject self, duplicate, unknown and source-forged identities` | 通过；修订冲突、重复、自身、未知节点和来源冲突拒绝 |
| T-M08-02 | M08-F02 / F03 / F04 | `agent-network.test.cjs`：`a main Agent actually discovers and delegates only its allowed children; results and cancellation are owned by the original parent` | 通过；受控主请求只能发现允许目标，委派、原父回查/取消 |
| T-M08-03 | M08-F03 | 同一 `agent-network.test.cjs` 案例中的重复委派断言 | 通过；重复 10 次，子 native 执行计数=1 |
| T-M08-04 | M08-F04 | 同一案例中的自我委派、跨父任务读取与伪造来源断言 | 通过；全部返回授权拒绝 |
| T-M08-05 | M08-F05 | `collaboration-broker.test.cjs`：`real stdio MCP initializes, exposes scoped operations and authenticates its loopback dispatch without leaking identity into arguments` | 通过；真实子进程 stdio 与环回 broker，业务 dispatcher 受控 |
| T-M08-06 | M08-F05 | `codex-host.test.cjs`：`MCP approval adaptation is scoped to bridge tools and does not replace native account, model or filesystem policies` | 通过；桥接审批范围不替换原生策略 |
| T-M08-07 | M08-F06 | `agent-network.test.cjs` 上述主从案例：仅撤 memberIds、保留 leaderId 后重查旧子任务 | 通过；同主、原父任务仍活跃的有限撤销场景 |
| T-M08-08 | M08-F01 | `windows-i05-ui.cjs` 与 [界面报告](../../../artifacts/I05-ui.json) | 通过；mock 关系选择与保存，不是生产授权端到端 |

测试入口：[agent-network.test.cjs](../../../desktop/tests/agent-network.test.cjs)、[collaboration-broker.test.cjs](../../../desktop/tests/collaboration-broker.test.cjs)、[codex-host.test.cjs](../../../desktop/tests/codex-host.test.cjs)。

## 3. 四条真实协作链

以下运行在同一 Windows 宿主和它的 WSL，日期为 2026-10-10。本次仅核对原始报告，未再次调用模型。

| 案例 ID | 功能 | 主 → 子 | 结果 |
| --- | --- | --- | --- |
| T-M08-09 | M08-F02 / F03 / F04 / F05 | Windows Claude → WSL OpenCode | 通过；真实 MCP、子原生回复、父汇总 |
| T-M08-10 | M08-F02 / F03 / F04 / F05 | WSL OpenCode → Windows Claude | 通过；反向原生主/子链路 |
| T-M08-11 | M08-F02 / F03 / F04 / F05 | Windows Claude → WSL Codex | 通过；子 Codex 新会话回复 |
| T-M08-12 | M08-F02 / F03 / F04 / F05 | WSL Codex → Windows Claude | 通过；原生 Codex 主任务通过 MCP 委派 |

指标：以上四条链人工转述子结果次数=0，子结果来自原生工具，父回答在原主会话产生。受控委派十次重试执行次数=1，与真实生产链的成功数是两种不同指标。

## 4. 当前不通过、部分满足与未验收

| 案例 ID / 范围 | 判定 | 原因及后续验收 |
| --- | --- | --- |
| T-M08-13：Windows Codex 相关生产链 | 未通过 / 原生配置阻塞 | 其默认模型被账号拒绝；不替换模型来制造成功 |
| T-M08-14：更换 leader 后旧主读/控原子任务 | alpha.6 已修复，受控换主/清主反例见 T-M08-20 | 新委派仍检查当前 leader；活跃原父读控按原请求/任务/会话账本检查，受控修复通过 |
| T-M08-15：清空主关系后旧主读/控原子任务 | alpha.6 已修复，受控通过 | 活跃原父查控原子，清主不授权新委派；父终态和来源伪造仍拒绝 |
| T-M08-16：父任务终态后 MCP task_result | 当前明确拒绝，不能宣称仍可读 | 人类界面的 owner 查询另路可读；是否扩大原 scope 生命周期需明确设计 |
| T-M08-17：独立 Linux 与 Windows 双向协作 | alpha.6 本次通过 | 独立 SSH Linux OpenCode ↔ Windows Claude，两方向实际 list_agents/delegate/task_result、原生父子 succeeded；[最终原请求报告](../../../artifacts/I06B/2026-10-12/real-resumed.json) |
| T-M08-18：节点图、拖拽、保存回应丢失恢复 | alpha.6 本次通过 | 真实 Windows 图交互、稳定 operationId、丢 ACK 重开原收据恢复；[报告](../../../artifacts/I06B/2026-10-12/ui.json) |
| 真实协作中的全部权限/表单/取消 | 部分证据 | 本轮真实核心样本是文本回复，复用受控控制链不能冒充所有原生控制实测 |

历史 I05 文档“撤销后既有任务可查询/取消”只能对应 T-M08-07 的同主撤子场景。必须保留这一限定，不能据历史文字扩大当前已测试权限。

## 5. 复现和下一次更新

受控回归：`npm test --prefix desktop`。真实运行脚本：[windows-i05-real.cjs](../../../desktop/tests/windows-i05-real.cjs)、[windows-i05-codex-main.cjs](../../../desktop/tests/windows-i05-codex-main.cjs)，需要隔离 profile，会实际调用模型。

I06B 已将 M08-F06 拆成新委派授权和旧任务管理授权的独立反例，验证换主、清空、撤子、父终态、伪造来源、跨父会话、未知委派不重放。原测试 ID 保留，新增断言和真实证据已更新本报告及 [整体设计](design.md)，同时更新 I06B 迭代验收。

## 当前自然语言发现验收

T-M08-19 / M08-F02/F03/F04/F05：2026-10-12 / alpha.2 加发现修复源码（随后交付 alpha.3）/ WSL / Codex 0.161.0 与 Claude Code 2.1.296。复用用户“查看你的模型，以及你连接的子agent有哪些……”原需求，真实主工具调用 Bridge `list_agents`、`delegate`、`task_result`，真实 Claude 自报模型，主回答输出连接图；双方 succeeded。允许关系与 dispatcher 为隔离受控实现，MCP/原生主子进程及回复是真实执行。模型自报未独立核实到供应商运行时字段，不把客户端名等同模型名。证据：[真实报告](../../../artifacts/codex-discovery/2026-10-12/native-report.json)、[脚本](../../../desktop/tests/linux-codex-discovery-real.cjs)。

受控 T-M06-CX-06 同时检查新会话与原 Session 续聊收到指引、普通聊天消息不变、去重和原生配置保持。真实 Codex resume、GUI 全关系、独立物理机器链未因本条验收被标通过。原故障核对：[脱敏报告](../../../artifacts/codex-discovery/2026-10-12/diagnosis.json)。

## I06B 当前验证入口

2026-10-12 / 0.6.0-alpha.6：T-M08-20 / M08-F01/F04/F06：同 ID 并发十次只增一次关系 revision、失败落盘不改内存、新主/别父/伪造源拒绝、旧父读控反例。本次代码、命令、逐项结果与限制汇总于 [I06B 实施](../../iterations/I06/graph-implementation.md)。受控工程结果见 [桌面 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)、[核心 TAP](../../../artifacts/I06B/2026-10-12/root-tests.tap)，界面见 [UI](../../../artifacts/I06B/2026-10-12/ui.json)、[性能](../../../artifacts/I06B/2026-10-12/performance.json)，本次核心 43/43、桌面 110/110、Windows 图 10 组通过；性能 p95 30.0ms。独立 SSH 双向原生链、普通无 debug EXE 及源/包完整性分别通过，原始证据与范围见当次报告。历史表保留原日期/版本，不计为本次重新运行。


最终包真实双向链核对：反向原生服务退出后，在同一上下文恢复服务，原 requestId/同内容完成父子任务；原鼠标授权保持，actual tools 与标记均确认。仅查询已完成原结果的验证通过，窗口首次失败与恢复分开保留；不宣称自动恢复服务。[最终结果](../../../artifacts/I06B/2026-10-12/real-resumed.json)。

## alpha.9 当前节点管理专项

T-M08-21 / M08-F01/F06：2026-10-13 / 0.6.0-alpha.9。范围：子撤权、主清空与节点事务原子提交，恢复不重新授权，未知元数据屏障与旧任务原来源保持。逐项实际结果、环境、脚本、原始证据与未测范围见 [节点管理完整验收](../../iterations/I06/node-management.md)。工程证据为本次 [桌面 TAP](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)；窗口/程序/包状态以该报告实际结果为准，历史表不充当本次重测。原生 SSH/模型链保留 alpha.6 历史结果，本次未重跑、不改用户 profile、不提交 Prompt。
