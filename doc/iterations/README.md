# 迭代资料目录

2026-10-19：当前完整源码已发布为 **alpha.29 GitHub预发布**，新Tag、EXE与SHA-256校验附件均已上传；版本、包资源与实际发布状态统一见[alpha.29 交付](I07/alpha29-release.md)。历史专项保留原日期/冻结范围，完整 I06C/I07C 未准出。

2026-10-19：[I07 CT-02真实MCP六方向](I07/connection-delegation.md)完成当前WSL三工具发现、委派、真实结果读取与汇总；9个真实成功Task，完整重开无重放，桌面517/517。新增验收工具，未改生产行为或发布包。

2026-10-19[Projects / Dots / Grok Bot最新研究](I07/projects-dots-bots-research.md)：官方资料、当前实现映射和CT-03/04/05的候选细化；共享材料不等于共享原生会话，Grok Build的ACP不等于Grok Bot已接入。本轮无产品或发布变化。

2026-10-19：[I07 CT-02首批真实连接验证](I07/connection-native.md)完成当前WSL三工具直接执行/原Session续聊/取消/重开；新增恢复验收工具和7项保护回归，无产品运行改动，不是六工具/新EXE/独立SSH全部验收。

2026-10-19：[I07 CT-01连接能力与原关系拒绝恢复](I07/connection-capabilities.md)已完成未发布源码及受控验收；下一优先为接入矩阵CT-02真实工具验证，公开alpha.28不变。

2026-10-18[连接通路目标与ACP/Multica研究](I07/connectivity-research.md)：逐Agent现状和后续目标统一见[接入矩阵](../agent-integration-matrix.md)。本轮明确发现/操控为核心，自动续接、多用户不列为后续目标；公共MD/共享上下文与可选ACP为研究方案，未新增产品或发布能力。

2026-10-18 [真实三原生成员验收](I07/native-members.md)：实际Claude主协调/开发/复核，公共文档精确版本与原生终态闭环；同WSL受控路由，不冒充独立SSH或代码编译返修。

2026-10-18 [原生接入准入与核对收据](I07/native-integration-guards.md)：新增工具不能误登记小队，核对收据可沿原 ID 持久恢复；未发布源码。

2026-10-18 [I07桌面空闲黑窗与刷新优化](I07/desktop-polling.md)：本地独立候选，安装扫描与实时状态分离，Windows界面与EXE分别验证。

I07新增：当前 Agent 版本发现修复，源码已修改；已发布包不变。 [需求、开发与实际验证](I07/current-agent-discovery.md)。

## 2026-10-18：I07 原生 Agent 扩展（未发布源码）

[Hermes/Pi/DSH、六种图标与自定义接口](I07/native-agent-expansion.md)。安装发现、持久宿主、原请求恢复、开发指南与前端素材合并交付；受控工程与 Windows 浏览器图标证据独立记录，不代表真实模型或新 EXE。

## 2026-10-18：I07 UI 重构与本地候选 alpha.28.ui.2

[CC Switch 研究](I07/cc-switch-ui-research.md)、[UI需求/设计/开发与交付](I07/ui-redesign.md)、[Windows视觉与交互验收](I07/ui-visual-acceptance.md)。最终桌面381/381（含59项SSR）；Edge主界面5组12图、状态10组8图、小队3组3图和关系图10组分别通过，不跨层叠加。独立快照生成本地候选 **0.6.0-alpha.28.ui.2**，包资源及普通无debug Windows EXE4项IPC/SQLite/生命周期验证通过；原请求无新增/重放，模型0。未使用用户profile或连接用户SSH，完整I06C/I07C未准出。

381项工程、前端和候选包结果仅对应北京时间08:50冻结的UI交付源码。11:18之后其他线程新增的Agent适配、工具发现和图标变更不在本候选内，也没有由本轮测试覆盖。

主工作区package/lock仍alpha.28，GitHub公开附件为原alpha.28，本地候选未发布、旧EXE不变。候选大小129899528字节，SHA-256 `20a84ce98380457e5520d6bb9fc941c666c299a67b216e862d8568b7b3d015a6`；[包报告](../../artifacts/ui-redesign/2026-10-18/package-ui2.json)、[普通EXE报告](../../artifacts/ui-redesign/2026-10-18/portable-ui2.json)。

## 2026-10-17：alpha.28已预发布，SSH持久拒绝恢复

alpha.28公开包修复issue #5。 [设计、需求、开发、验收与边界](I06/daemon-rejection-recovery.md)。下列alpha.27、alpha.26、alpha.25及更早说明均保留各自历史时点，不表示替代当前公开包或本地候选。

当前GitHub预发布alpha.27：[Windows未派发任务与本地持久化恢复（issue #3/#4）](I06/windows-start-persistence.md)，含原Codex任务核对、分享锁重试及严格历史拒绝结算；EXE、摘要和未测边界见该页。
2026-10-17当前源码/当前预发布 **alpha.26**：[alpha.24 Linux 后台连接与升级](I06/ssh-alpha24-upgrade.md)。GitHub当前预发布为alpha.26；下文较早的alpha.25候选状态保留原时点。

2026-10-17源码/本地候选alpha.25：[Windows原请求上下文恢复](I06/windows-context-recovery.md)，修复未完成上下文截获原请求查询；GitHub保持alpha.24，用户故障机器尚待复验。

更新：2026-10-18。当前范围与优先级见 [迭代路线](../project-plan.md)；整项目设计见 [整体资料](../README.md)。

迭代说明“这次改了什么”。阅读模块如何工作，应去对应完整模块设计；历史报告只证明原日期、原版本和原环境。

| 迭代 | 需求与设计 | 结果 / 当前状态 |
| --- | --- | --- |
| I01 | [需求](I01/requirements.md)、[设计](I01/design.md)、[开发](I01/development.md) | [测试与验收](I01/testing.md) |
| I02 | [需求](I02/requirements.md)、[设计](I02/design.md)、[开发](I02/development.md) | [测试](I02/testing.md) |
| I03A | [需求](I03A/requirements.md)、[设计](I03A/design.md)、[开发](I03A/development.md) | [报告](I03A/report.md)、[体验修正](I03A/cli-fix.md) |
| I03B | [需求](I03B/requirements.md)、[设计](I03B/design.md)、[开发](I03B/development.md) | [报告](I03B/report.md) |
| I04 | [需求](I04/requirements.md)、[设计](I04/design.md)、[开发](I04/development.md) | [报告](I04/report.md) |
| I04B | [需求](I04B/requirements.md)、[设计](I04B/design.md) | [双环境交付](I04B/report.md) |
| I04C–G | 各版本稳定性修正 | [C](I04C/report.md)、[D](I04D/report.md)、[E](I04E/report.md)、[F](I04F/report.md)、[G](I04G/report.md) |
| I05 | [提案](I05/proposal.md)、[节点](I05/node-design.md)、[协作](I05/collaboration-design.md) | [0.5.0 验收](I05/acceptance.md) |
| I06 | [需求](I06/requirements.md)、[开发](I06/development.md)、[验收计划](I06/testing.md) | [当前进度](I06/progress.md)、[6A 候选验收](I06/acceptance.md)、[alpha.3 发现修复](I06/codex-discovery-fix.md)、[alpha.4 兼容复用](I06/ssh-compatible-reuse.md)；[6B 验收](I06/graph-implementation.md)，I06C 未完成 |
| I07 | [目标](I07/goals.md)、[需求](I07/requirements.md)、[设计](I07/design.md)、[开发切片](I07/development.md) | [验收计划](I07/testing.md)；[I07A交付](I07/delivery.md)、[I07B交付](I07/task-handoff.md)、[I07C首批](I07/automation.md)已实现；[UI重构与本地候选](I07/ui-redesign.md)、[视觉/交互验收](I07/ui-visual-acceptance.md)已形成分层证据，完整范围仍未准出，不替代I06C准出 |

## 后续迭代必须写清

下一迭代：[I07 外部智能体接入与小队协作](I07/goals.md)。2026-10-15 已细化公共约定/文档/任务/群消息、角色权限、授权交接与持续激活草案；Bridge只连接与组织；I07A/B已实现，[I07B证据](I07/task-handoff.md)分层记录，I07C首批Claude持续主协调已实现，完整范围未准出，不替代I06C准出。

1. 需求编号、对应整体功能与模块、可验收行为。
2. 本次设计取舍与被更新的整体/模块文件。
3. 实际完成项、代码落点与未完成项。
4. 测试运行范围、真实证据、失败/未测和发布包状态。

不能只把新方案追加在迭代目录而让整体设计继续描述旧实现。同步规则见 [开发维护指南](../development-guide.md)。

当前新增 [I06B 图编辑实施与验收](I06/graph-implementation.md)，记录 alpha.6 与各层原始证据，不覆盖 I06A 的历史结论。

最新 I06B 图优化候选见 [alpha.7 专项](I06/graph-usability.md)：主节点强调、连线避让、中键平移，原生历史结论保留。

最新 [alpha.8 拖动修复](I06/graph-drag-fix.md)：旧后台兼容、本机布局、组背景拖动、主组居左与实际打包窗口验证。

## GitHub Windows EXE 交付

2026-10-13：[alpha.9 GitHub 预发布及附件核验](I06/github-release.md)。分发已有程序，不变更原源码行为、不替代 Windows/SSH/原生 Agent 验收。

当前 alpha.16 维护未发送边界补强与发布状态：[I06C 当前验收](I06/final-delivery.md)；[GitHub 源码与 Windows EXE 发布](I06/github-release.md)。完整 I06C 仍未准出。

当前 alpha.16 维护发送失败、原收据恢复、工程与实机分层验收见 [增量交付](I06/maintenance-launch-recovery.md)。

- [I06 alpha.18：Windows 运行缓存与原提交恢复](I06/runtime-recovery.md) — 同原意图核对、无 Prompt 重放；工程/Windows/包证据分别记录。

- [I06 alpha.19：Linux 非交互后台 CLI 发现](I06/linux-cli-discovery.md) — 用户态安装目录、原 PATH/身份保留及 SSH 实际后台升级边界。

- [I06 alpha.19：OpenCode 二次发现与 Windows 配置写入](I06/opencode-discovery.md) — 核验原安装、Windows实际PE/配置/受控启动退出及合并交付边界。

I06C alpha.20预发布：[未确认请求的资源范围与准备拒绝恢复](I06/pending-isolation.md)，独立节点可继续工作，原 unknown 与共享目录保护保留。

2026-10-16：I07A/B及I07C首批以alpha.23预发布分发；[下载与发布核验](I07/github-release.md)。完整I07C/I06C未准出。

当前源码/本地候选alpha.24：[小队停止与原生终态核对](I07/native-stop.md)，包含[等待可见性](I07/native-waiting.md)；GitHub仍为原alpha.23。
