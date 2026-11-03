# Paperclip 功能调研与 AgentBridge 借鉴候选

调研日期：2026-10-30。本文为候选分析，不改变当前需求、迭代范围、功能状态或发布基线。

Paperclip 对象为官方仓库 `paperclipai/paperclip`，在线读取时固定源码提交 `b3c2172d417ea6b783e0c796aaed4a91e1f9d381`。AgentBridge 对照本地 `6e7ec6f` 的源码、整体设计、M01/M07/M08 设计与报告及 I07C 记录；公开包状态沿用 alpha.71 的历史交付说明。本次只做在线文档/源码阅读与本地静态核对，没有安装运行 Paperclip、调用模型、运行真实原生 Agent、修改用户配置或重新验证 EXE。

## 1. 结论与产品定位

Paperclip 把 Agent 放入持续工作的任务管理体系：组织与角色、目标与项目、任务线程、运行唤醒、审查、预算、技能和交付物。AgentBridge 当前重点是让用户已有的原生 Agent 跨机器发现、连接和受限协作，账号、模型与原生配置仍由原工具管理。

最值得参考的是用户如何知道“现在该处理什么”和“交付有什么证据”，以及重复触发、审查修订、预算计量的明确规则。建议首先考虑统一待办和交付证据聚合；任务认领、独立复验、上下文和事件驱动已有基础，应在现有合约上补齐体验与策略。

以下 P0/P1/P2 仅表示本文建议的相对顺序，不代表已经排期。当前真实接入、生命周期、故障和性能验收仍按[项目路线](../../project-plan.md)推进。

## 2. Paperclip 已核对的功能

| 功能 | 本次读取到的行为 | 主要来源 |
| --- | --- | --- |
| 任务驱动执行 | 每次唤醒读取身份和分配工作，执行前认领；冲突返回 409。任务保存上下文与进展，子任务关联父任务和目标，长任务可等待事件再唤醒 | [Heartbeat Protocol](https://github.com/paperclipai/paperclip/blob/b3c2172d417ea6b783e0c796aaed4a91e1f9d381/docs/guides/agent-developer/heartbeat-protocol.md) |
| 统一待办 | Inbox 汇集审批、任务与失败运行等事项；失败运行按可恢复性呈现下一步，包含预算、凭据、暂停等阻塞原因 | [Inbox 源码](https://github.com/paperclipai/paperclip/blob/b3c2172d417ea6b783e0c796aaed4a91e1f9d381/ui/src/pages/Inbox.tsx) |
| 目标与项目 | 目标形成层级；项目可关联目标及多个工作区，任务能取得上层目的 | [Goals and Projects](https://github.com/paperclipai/paperclip/blob/b3c2172d417ea6b783e0c796aaed4a91e1f9d381/docs/api/goals-and-projects.md) |
| 审查与确认 | 审查策略包含 `human_only`、`not_creator`；后者比较当前送审人，而非简单比较任务最初创建人。计划确认要求绑定最新计划修订 | [审查策略](https://github.com/paperclipai/paperclip/blob/b3c2172d417ea6b783e0c796aaed4a91e1f9d381/server/src/services/issue-review-policy.ts)、上述 Heartbeat Protocol |
| 例行任务 | cron/时区、Webhook、API 触发；支持活跃任务合并、跳过或排队，错过执行默认跳过，也可有界补齐；手动/API 重复触发有幂等键 | [Routines API](https://github.com/paperclipai/paperclip/blob/b3c2172d417ea6b783e0c796aaed4a91e1f9d381/docs/api/routines.md)、[实现](https://github.com/paperclipai/paperclip/blob/b3c2172d417ea6b783e0c796aaed4a91e1f9d381/server/src/services/routines.ts) |
| 成本与预算 | 按上报用量/费用统计；预算服务含公司、Agent、项目范围、阈值和预算事件，以及运行中费用暴露与预留相关处理 | [预算服务](https://github.com/paperclipai/paperclip/blob/b3c2172d417ea6b783e0c796aaed4a91e1f9d381/server/src/services/budgets.ts)。旧费用指南偏月度说明，本文不把其阈值当作全部当前配置能力 |
| 技能与团队复用 | 技能来源、固定提交、内容摘要、版本管理和共享；区分纯 Markdown、静态资源与可执行脚本。组织包可预览、导入、导出 | [Skills Store](https://github.com/paperclipai/paperclip/blob/b3c2172d417ea6b783e0c796aaed4a91e1f9d381/docs/guides/agent-developer/skills-store.md)、[组织迁移服务](https://github.com/paperclipai/paperclip/blob/b3c2172d417ea6b783e0c796aaed4a91e1f9d381/server/src/services/company-portability.ts) |
| 交付物聚合 | 文件和文档按工作来源聚合，识别内容类型、生成有限预览；README 另说明文档评论和历史 | [产物服务](https://github.com/paperclipai/paperclip/blob/b3c2172d417ea6b783e0c796aaed4a91e1f9d381/server/src/services/company-artifacts.ts)、[README](https://github.com/paperclipai/paperclip/blob/b3c2172d417ea6b783e0c796aaed4a91e1f9d381/README.md) |
| 工作区隔离 | 可创建或复用执行工作区/worktree，工作区有独立分支、目录和运行服务；多个任务也可有意共享 | [执行工作区](https://github.com/paperclipai/paperclip/blob/b3c2172d417ea6b783e0c796aaed4a91e1f9d381/docs/guides/board-operator/execution-workspaces-and-runtime-services.md) |
| 有界持续推进与恢复 | `plan_only`、`empty_response` 可触发有界继续，源码默认上限两次；基础设施恢复、原请求去重、执行隔离与外部副作用分别处理，未知写入仍需要权威对账 | [持续推进判定](https://github.com/paperclipai/paperclip/blob/b3c2172d417ea6b783e0c796aaed4a91e1f9d381/server/src/services/recovery/run-liveness-continuations.ts)、[任务恢复](https://github.com/paperclipai/paperclip/blob/b3c2172d417ea6b783e0c796aaed4a91e1f9d381/doc/task-recovery.md) |

上述“已核对”表示文档描述或实现分支存在，不表示本次实际运行成功，也不证明 Paperclip 的全部适配器行为一致。

## 3. 与 AgentBridge 的真实差距

| 借鉴候选 | AgentBridge 已有基础 | 建议增量与适用场景 | 顺序 / 主要落点 |
| --- | --- | --- | --- |
| 统一“需要处理”列表 | 任务页已有等待提示；设置有原操作恢复；小队有任务、报告和接收收据审计 | 聚合待权限/输入、范围外连接确认、待验收、原执行 unknown、预算到限。显示来源、阻塞原因、观察时间并定位原对象；默认只读，实际动作沿现有设置或显式原执行恢复入口 | P0；M01，读取 M07/M08 投影 |
| 任务线程与交付证据面板 | 工作项已有修订、业务轮次、产物版本、报告历史、复验证据及原生尝试 | 用一个时间线关联原需求、文档准确修订、上下文包、交付版本、复验和原生终态；优先引用与差异摘要，后续再考虑文件预览。典型问题是“这次通过究竟验证了哪个版本” | P0；M01/M07/M08 |
| 显式审查策略与计划修订确认 | 交付必须由另一成员复验，当前产物与复验证据严格绑定；原生成功也不直接等于业务验收 | 为确有需求的工作增加“最终需人类确认”等可选规则；计划确认绑定准确修订和内容摘要，计划改变使旧确认失效。先复用现有独立复验规则，避免重建状态机 | P1；M07/M08，M01 只提供授权内入口 |
| 团队与技能模板 | 已有公共约定、职责、材料包和原生 MCP 接入 | 先做三种小模板：开发/复验、调研/交叉核对、交付/文档。模板保存职责、任务骨架、所需能力与技能准确版本，导入时映射用户已有节点并预览差异；不携带机器身份或凭据，不自动授予连接权限 | P1；M08/M03/M06 |
| 定时/外部事件例行工作 | 已有重要事件合并、持久激活、次数与总时长预算、原 Session 续接 | 后续确需每天巡检或 PR 到达后核对时，再添加例行任务定义与触发记录。必须先明确时区、重复事件、活跃任务合并、离线错过策略、授权与原请求查询 | P2；M02/M07/M08，属于新增范围 |
| 可解释用量与费用 | 自动协作已有累计激活次数和总时长限制 | 增加原生工具可提供的 usage/cost 投影，注明来源、覆盖率、币种/计价依据和更新时间；缺数据标“不可获取”。先统计，后讨论金额门禁；可先完善次数/时长到限原因 | P2；M06/M07，M01 展示 |
| 执行工作区与写入冲突提示 | 任务有目录与执行资源占用；节点不绑定项目；同一目录不保证文件隔离 | 先识别可证明的同目录并发写入风险，再试可选 worktree。绑定具体执行及原生 Session，不绑定节点；远端路径归属、共享目录、脏文件保留和清理规则需单独设计 | P2；M03/M06/M07 |
| 可解释的无进展诊断 | 已有一次性无进展事件、事件激活和累计预算，并非缺少心跳机制 | 展示为何未继续：等待外部输入、只提交计划、空结果、预算、能力或原执行未知。自动继续只能在已有授权和可靠终态基础上，采用有界次数及持久原因；不能按“没看到文件变化”判定无进展 | P2；M07/M08 |
| 目标上下文层级 | 工作已有目标、完成标准、任务依赖和公共材料 | 若跨多个工作反复丢失“为什么”，可增加可选目标引用并投影到上下文包；先改进现有目标呈现，不引入必填公司/项目或节点项目绑定 | P2；M07/M08 |

本地核对入口：

- [任务认领、报告、版本与独立复验](../../../desktop/electron/team-work.cjs)、[任务板及报告历史](../../../desktop/src/TeamTaskBoard.tsx)。
- [事件去重、累计预算与激活](../../../desktop/electron/team-automation.cjs)、[I07C 行为与证据边界](../I07/automation.md)。
- [任务页与设置恢复入口](../../../desktop/src/WorkspacePages.tsx)、[公共材料类型与未核对产物引用](../../../desktop/src/team-types.ts)。
- [当前配置/审计控制台约束](../I07/configuration-console.md)、[原包传递和接收声明](../I07/context-delivery.md)。
- [M07 设计](../../modules/07-task-session/design.md) / [报告](../../modules/07-task-session/test-report.md)、[M08 设计](../../modules/08-collaboration/design.md) / [报告](../../modules/08-collaboration/test-report.md)。

## 4. 借鉴时必须保留的边界

1. **不以组织层级替代授权。** 角色和模板只表达职责；真正可连接、可委派、可读取的范围仍由 Bridge 当前成员资格、能力与来源交集决定。
2. **不改变原生工具配置归属。** 不引入统一模型 API、账号管理或强制选模型；费用观察也不意味着接管供应商账单。
3. **不把确认当成功。** 计划同意、权限同意、材料接收、取消收据和业务验收是不同事实；新列表和模板也不能合并这些状态。
4. **不把自动恢复理解为自动重做。** Paperclip 的恢复设计也区分执行隔离、文件保存与未知副作用。AgentBridge 的 requestId/operationId unknown 仍只查原请求，不能换 ID、节点、目录或 worktree 释放占位。
5. **不宣称金额绝对封顶。** 原生订阅、缺失用量、延迟上报、外部手动运行和运行中消费都可能超出 Bridge 观察；只能对已知范围及新激活施加可证明的门禁。
6. **模板导出采用字段白名单。** Paperclip README 也提示普通环境变量和本地路径可能残留；不能把“导出包”自动当成可公开分享或完整灾备。
7. **保持桌面配置/审计定位。** Inbox 优先做只读聚合和原入口定位；日常委派与工作推进继续从原生 Agent/MCP 进行。

## 5. 可独立评审的第一片候选

建议先做“需要处理”只读聚合，复用现有数据，不引入例行调度或新的日常执行入口。

最小内容为事项类型、原机器/节点/工作/任务定位、当前阻塞原因、观察时间和“查看原记录”。权限/输入必须来自当前原 pending；unknown 与待人工决定分开；待接收不能写成“对方未工作”。同事项按来源和原 ID 合并，关闭窗口或切筛选不清理后台占位。

若后续获选开发，验收重点为：重复刷新不写状态、不触发模型或重派；离线/旧观察显式标记；跨机器同名任务不串线；撤权后不泄露材料；原操作 unknown 仍沿原 ID；现有只读入口和显式恢复边界保持。届时再同步当次需求、整体设计、受影响模块设计/测试及必要的协议/数据文档。

## 6. 本次检查

本次仅新增调研和迭代索引，无产品行为变更，不新增功能编号或模型测试通过数。

修改前执行 `node scripts/check-docs.mjs`：退出 1，289 份 Markdown，2243 个既有错误，样例为历史原始证据链接缺失。修改后实际执行仍退出 1，290 份 Markdown、2243 个错误；前后排序后错误数组 SHA-256 均为 `0e04fd72ce0fd065e013b918ab7336bd8c456d34a4728d3d995df8f5e7df8177`，错误集合完全一致，没有新增文档检查错误。迭代索引本来已有历史证据缺链，本次未修复；新调研文档无报错。`git diff --check` 通过。
