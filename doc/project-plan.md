# 迭代路线与当前交付

这里维护交付顺序与后续目标，不另建一套架构；完整功能与模块设计见 [资料入口](README.md)。逐轮历史与发布记录见 [迭代目录](iterations/README.md)。

## 1. 当前基线

| 项目 | 状态 |
| --- | --- |
| 最近稳定 Windows 程序 | 0.5.0 / I05；机器节点与主从协作，原生限制保留 |
| 最新 Windows 预发布 | **0.6.0-alpha.35**，公开元数据指向 `b5de577`；本轮未重下EXE。alpha.35独立修复已整合至alpha.36本地源码；[当前核对边界](iterations/I07/delegation-list.md) |
| 本地整合候选 | **0.6.0-alpha.36**，含公开alpha.35独立修复与当前全部增量；[文件、校验与实际验证](iterations/I07/alpha36-delivery.md)，未公开GitHub |
| 当前自动回归 | 子任务上下文冻结源码桌面667/667、定向121/121、Windows受控36/36及Core构建通过；[来源与限制](iterations/I07/delegation-context.md)。核心57/57、普通EXE等仍是.config.2原冻结证据，本片未跑上游模型/EXE |
| 当前用户文档网站 | 只发布doc/user当前功能/设计/使用页，六Agent章节、DSH三入口与六方式/能力摘要；内部资料不发布，见[M11](modules/11-documentation-portal/design.md) |
| 当前源码未发布增量 | [DSH Desktop/Web 服务入口](iterations/I07/dsh-desktop-web.md)（受控验证）；[CT-07只读委派列表](iterations/I07/delegation-list.md)与[当前连接视图](iterations/I07/agent-connections.md)（源码）；CT-06/08及CT-07余项仍按原规划 |
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

alpha.36已按三方内容整合公开alpha.35独立修复与当前工作区；当前优先完成冻结包和Windows验证，不以源码测试替代真实模型或独立SSH准出。

当前后续目标以"Agent 发现和操控其他 Agent 的通路"为核心；自动续接、多用户、模型管理、云平台不作为目标。连接类目标统一定义在 [接入矩阵](agent-integration-matrix.md) §4。

| 顺序 | 目标 | 内容与前置 |
| --- | --- | --- |
| 1 | I07C 收尾 | 六工具真实覆盖（Hermes/Pi/DSH 真实直接执行与被委派验收）、DSH Desktop/Web 原实例验证、真实执行成员链与完整停止；[矩阵](agent-integration-matrix.md) §4 CT-02 行 |
| 2 | CT-06 通用 MCP 调用方 | 先只读核对各工具原生 MCP 客户端与插件扩展点，再按独立MCP模式逐工具接入；静态 `bridgeMcp` 验收后翻真；[规划](iterations/I07/agent-centric-operations.md) |
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
