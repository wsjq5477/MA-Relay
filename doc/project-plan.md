# 迭代路线与当前交付

最新验收：alpha.46的已安装OpenDesk/DSH原生MCP组件正式授权、撤权和恢复通过；两条生产协作链各完成1个真实Claude子任务，原观察器重开保持原Session与请求，不重放。OpenDesk 日常原生父模型只读发现已通过，实际 list_agents 返回 7 个获准节点；[原生发现证据](iterations/I08/opendesk-mcp-diagnostic-repair.md)。父模型自主委派与原生页面仍未验；[组件层级与原始证据](iterations/I08/mcp-native-acceptance.md)。

当前公开alpha.46已承接[I08-MCP02](iterations/I08/mcp-open-integration.md)，完成[恢复与观测修复、非GUI首次接入](iterations/I08/mcp-open-recovery.md)。六项事实按配置绑定与60秒观测有效期核对，Linux重启恢复端点且不补装原生条目；根68/68、桌面758/758，最终JSON修复后CLI11/11与工程检查通过。未签名、已公开、未部署远端；逐入口真实原生增删、主Agent委派与托管归属仍未准出，公开基线已为alpha.46。

当前发布已补齐OpenDesk前端能力门禁；[本轮交付](iterations/I08/opendesk-ui-admission.md)。当前OpenDesk接入只在Bridge侧适配现有CLI HTTP和桌面设备网关，不修改或构建OpenDesk。Bridge保存去重、派发围栏和原回应；断线证据不足保留unknown，Desktop原连接丢失后不可续聊。独立MCP支持增删与撤权，托管scope/小队及Bridge权限表单未开放。[实现与证据边界](iterations/I08/opendesk-existing-interfaces.md)。 当前Windows Desktop 0.3.9原实例真实执行、续聊和窗口重开通过；[现场验证范围](iterations/I08/opendesk-desktop-live.md)。

当前修复：OpenCode OOM 后原上下文恢复与本地接入拒绝收据已实现并完成受控与限定现场验证；已纳入当前公开 alpha.46，完整I06C/I07C未准出。详见[OpenCode OOM 恢复与接入拒绝收据](iterations/I08/opencode-oom-recovery.md)。

这里维护交付顺序与后续目标，不另建一套架构；完整功能与模块设计见 [资料入口](README.md)。逐轮历史与发布记录见 [迭代目录](iterations/README.md)。

## 1. 当前基线

| 项目 | 状态 |
| --- | --- |
| 最近稳定 Windows 程序 | 0.5.0 / I05；机器节点与主从协作，原生限制保留 |
| 最新 Windows 预发布 | **0.6.0-alpha.46**，标签冻结 `9766eb4`；源码、EXE 与校验附件已公开并通过匿名完整下载核验；[交付与边界](iterations/I08/alpha46-release.md) |
| 上一公开预发布 | **0.6.0-alpha.36**，冻结 `1fef25f`；[发布登记](iterations/release-ledger.md) |
| 当前自动回归 | 本轮核心68/68、桌面758/758、类型/lint、用户站6/6与构建通过；普通EXE同日4组隔离生命周期及真实原生证据分别见[发布专项](iterations/I08/alpha46-release.md)，不混算计数 |
| 当前用户文档网站 | 只发布doc/user当前功能/设计/使用页，六Agent章节、DSH三入口与六方式/能力摘要；内部资料不发布，见[M11](modules/11-documentation-portal/design.md) |
| 当前发布范围与缺口 | DSH Desktop/Web、CT-07、OpenDesk与MCP02源码均已随alpha.46公开；CT-06/08及逐入口准出仍按专项与规划推进 |
| I06A/I06B | 6A 候选已验收（见 [6A 验收](iterations/I06/acceptance.md)）；6B alpha.6 主要范围已验收（见 [实施报告](iterations/I06/graph-implementation.md)） |
| I06C | alpha.10 首批、alpha.13/15/16 维护收尾已交付（见 [I06C 收尾](iterations/I06/final-delivery.md)）；完整范围与正式 0.6.0 未准出 |
| I07 | I07A/B 与 I07C 首批已实现（见 [I07A 交付](iterations/I07/delivery.md)、[I07B 任务交接](iterations/I07/task-handoff.md)、[I07C 首批](iterations/I07/automation.md)）；完整 I07C 未准出 |

## 2. 迭代和长期模块的关系

| 阶段 | 交付目标 | 当前状态 | 主要模块 |
| --- | --- | --- | --- |
| I01 | CLI + Mock 的任务路由、认证、存储与故障基本合约 | 历史验收已记录 | M07、M09 |
| I02 | 真实 OpenCode 接入与原生事实 | 历史验收已记录 | M06、M07、M09 |
| I03A | 一个终端的自动发现、向导与后台使用 | 已实现并有真实/TTY 证据 | M03、M06、M09 |
| I03B | 原会话续聊、控制、恢复与补传 | 已实现；原生限制单列 | M06、M07、M09 |
| I04 / I04B–G | Windows 看板、双环境、原生控制与稳定性修复 | 历史发布与限制见迭代报告 | M01、M03、M06、M07、M10 |
| I05 | 工具节点与受限主从协作 | 0.5.0 已发布，四条 Windows/WSL 真实协作链 | M03、M06、M08 |
| I06A | 独立 Coordinator、SSH、Linux daemon、直接会话 | 候选已交付，Windows/SSH 主要流程通过 | M01–M07、M10 |
| I06B | 节点图、真实授权连线、跨物理设备双向协作与旧父权限修复 | 主要范围已验收 | M01、M03、M08 |
| I06C | 完整故障与指标、版本切换/回滚、最终候选包与准出 | 首批与维护收尾已交付，完整范围未准出 | M01–M05、M07、M08、M10 |
| I07 | 外部智能体登记、小队公共空间、授权交接与持续协调 | I07A/B 与 I07C 首批已实现；完整接入/故障/停止范围未准出，不替代 I06C 准出 | M01、M02、M03、M06、M07、M08 |

## 3. 后续目标与顺序

alpha.36已按三方内容整合公开alpha.35独立修复与当前工作区，并已公开发布（标签`1fef25f`，EXE与校验附件通过匿名完整下载核验）；发布不替代真实模型、用户profile或独立SSH准出，完整I06C/I07C仍未准出。

当前后续目标以"Agent 发现和操控其他 Agent 的通路"为核心；自动续接、多用户、模型管理、云平台不作为目标。连接类目标统一定义在 [接入矩阵](agent-integration-matrix.md) §4。

| 顺序 | 目标 | 内容与前置 |
| --- | --- | --- |
| 1 | I07C 收尾 | 六工具真实覆盖（Hermes/Pi/DSH 真实直接执行与被委派验收）、DSH Desktop/Web 原实例验证、真实执行成员链与完整停止；[矩阵](agent-integration-matrix.md) §4 CT-02 行 |
| 2 | CT-06 通用 MCP 调用方 / I08-MCP02 | **源码第一片完成**（能力三维、六项状态事实、`mcp.revoke`/`mcp.probe`、DSH Web原生适配、非GUI CLI、Linux本机路由、`mcp-open-access-v1`升级错误）；下一步逐入口真实原生增删/列表/工具/主调用与托管归属验收，按实际产品变化准备后续候选。优先OpenDesk/DSH；不强制等待完整I07C完成，不将未实现能力批量翻真；旧[总体规划](iterations/I07/agent-centric-operations.md)保留历史 |
| 3 | CT-07 Agent 侧连接操作面 | [委派列表](iterations/I07/delegation-list.md)、[当前连接视图](iterations/I07/agent-connections.md)、[子会话最小上下文](iterations/I07/delegation-context.md)均已源码/受控覆盖；最新667/667/Windows36/36，整合包与真实原生消费仍待验 |
| 4 | CT-08 多主关系与连接管理 | 单主关系泛化为按身份 relations、连接管理工具与 envelope 确认流；先重构后行为分片验收 |
| 5 | CT-03 可选 ACP 试点 | OpenCode ACP Client 试点，保留现有驱动；第二种 Agent 复用同一 Client 后再决定扩大 |
| ∥ | I06C 剩余 | 完整故障矩阵、指标、最终包与正式 0.6.0 准出；按 [I06 验收矩阵](iterations/I06/testing.md) 复验 |

CT-04 公共材料与 CT-05 选材包的源码已实现（见矩阵 §4 各行状态），实际发送/收件与跨工具消费待开发。

## 4. 阅读与变更入口

- [迭代目录与报告](iterations/README.md)：历次约定与证据的唯一索引。
- [模块目录](module-plan.md)：长期职责与联动范围。
- [整体测试报告](testing.md)：当前验收基线。
- [同步维护规则](development-guide.md)：修改模块时同时更新当前设计与迭代。
