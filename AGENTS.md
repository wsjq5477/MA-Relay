# AgentBridge 开发与文档协作

项目的完整资料入口是 [doc/README.md](doc/README.md)，同步规则见 [doc/development-guide.md](doc/development-guide.md)。人类和 Agent 按同一套规则开发。

## 开发前

- 阅读整体功能设计、相关模块的 `design.md`、`test-report.md` 和当前迭代。
- 核对实际源码、发布包和测试证据，区分已发布、源码已实现、已确认设计与候选功能。
- 稳定历史 Windows 版本为 0.5.0；当前 GitHub 预发布为 0.6.0-alpha.24，完整 I07C/I06C 仍未准出。I06A 候选 0.6.0-alpha.2 的 Windows/SSH 主要流程已验收，专项覆盖限制见 doc/iterations/I06/acceptance.md；I06B alpha.6 主要范围已验收，专项限制见 doc/iterations/I06/graph-implementation.md；alpha.7 图可用性优化见 doc/iterations/I06/graph-usability.md，alpha.8 旧后台拖动与主居左修复见 doc/iterations/I06/graph-drag-fix.md；alpha.9 合并页面与节点管理见 doc/iterations/I06/node-management.md；I06C alpha.10 首批机器管理/历史与事件补偿见 doc/iterations/I06/machine-management.md；alpha.13 可信后台维护/控制恢复及 alpha.15 维护入口通道拒绝恢复及 alpha.16 未发送边界补强见 doc/iterations/I06/final-delivery.md，以该页当前逐项证据为准。

alpha.18 的 Windows 运行缓存与原未派发提交恢复见 [专项](doc/iterations/I06/runtime-recovery.md)。源码已提交独立修复分支及 PR #1，尚未合入 master；发布标签绑定已验证源码，不以预发布替代完整 I06C 准出。

alpha.19 已作为预发布分发，修复 Linux 非交互后台 CLI 发现及 OpenCode 二次检查/Windows 配置保存，SSH 必须升级原远端后台后重扫；当前验证见 [专项](doc/iterations/I06/linux-cli-discovery.md)，不把本机受控 SSH 当作用户服务器实测。

alpha.20 已作为GitHub预发布分发，修复未确认操作的节点/目录阻塞范围、准备阶段与 NOT_CONFIGURED 拒绝恢复；当前实际验证及发布状态见 [专项](doc/iterations/I06/pending-isolation.md)，不以候选包替代完整 I06C 准出。

## 修改后必须同步

任何产品功能变更，在同一次交付中更新：

1. 当次迭代的需求/开发/验收记录。
2. `doc/product-design.md` 的功能状态、行为或模块修改记录。
3. 每个受影响模块的完整设计与测试报告。
4. 边界/数据/协议变化所影响的 `architecture.md`、`data-model.md`、`protocol.md`。
5. 改变基线、发布或范围时，更新整体验证报告和迭代路线。

不要只写一份新的迭代说明而留下整体设计过期。纯文档改错不用伪造产品需求或重跑模型测试；无行为变更的重构在迭代说明原因，并核对模块落点/测试记录。

## 证据与边界

- 实际运行后才填写通过；模拟、受控测试、真实原生 Agent 和真实 EXE 的结果分别标明。
- 报告写明日期、版本、环境、场景、实际结果、原始证据和未测项。历史记录不能冒充今天实测。
- 关系与节点不绑定模型/供应商或项目；继承原生配置，不添加新的模型 API 层。
- requestId/operationId 回应未知时查询原请求，不重新执行；不能以换 ID、节点或目录别名释放 unknown 占位。
- 不把权限收据或取消收据的 confirmed 当作任务已成功/已取消。
- 不把内部身份、密码、Token、私钥或敏感原生配置写进文档、提交、报告或日志。

## 文件与检查

- 完整材料写入 `doc/`，迭代写入 `doc/iterations/`；不再向 `docs/` 新增设计副本。
- 功能 ID 和模块 ID 保持稳定，源码定位使用可点击相对路径，跨进程/恢复流程优先使用清晰的图表。
- 交付前执行 `node scripts/check-docs.mjs`，并运行与实际产品改动相应的工程检查。
- 文档同步是完成条件，不额外要求用户批准，也不替代用户已有授权。用户指令优先。

alpha.23 已作为GitHub预发布分发，包含I07A/B和I07C首批持续协调；真实Claude自动主角色与受控MCP执行成员证据分开记录，其他原生自动续接/独立SSH/完整停止仍未准出。[功能与验收](doc/iterations/I07/automation.md)、[源码/EXE发布记录](doc/iterations/I07/github-release.md)。

2026-10-17当前本地修复候选alpha.25：Windows未完成上下文缺少Agent身份时不得截获原请求/任务查询，包含先前不完整任务回应保护；GitHub预发布保持alpha.24，实际工程/程序与未测边界见[原请求恢复专项](doc/iterations/I06/windows-context-recovery.md)。
