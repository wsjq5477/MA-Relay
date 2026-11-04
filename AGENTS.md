# AgentBridge 开发与文档协作

当前公开预发布 **0.6.0-alpha.73**，源码冻结 042c546。新增桌面本机 Hermes 自定义运行时。Windows 便携 EXE 已发布并完成匿名下载校验。 EXE 132443109 字节，SHA-256 73000602e0c2f267acf81cb4778e05974ed87331f22a0cdd36f43b824605ba65。

发布验证范围见[交付记录](doc/iterations/I08/alpha73-release.md)。

项目的完整资料入口是 [doc/README.md](doc/README.md)，同步规则见 [doc/development-guide.md](doc/development-guide.md)。人类和 Agent 按同一套规则开发。

当前产品边界以[互联核心决议](doc/iterations/I08/interconnect-boundary.md)为准，实现与未完成项见[互联开发台账](doc/iterations/I08/interconnect-development.md)。互联核心保留身份/获准发现/授权/明确目标调用/状态结果/交互控制及原ID恢复；小队业务工作流和自动协调为可选上层、暂停扩张。不得把登记或受控测试当作真实原生闭环，不自动迁移旧任务/授权，不添加智能选目标或新模型层。

## 开发前

- 用户要求：任何开发与测试不得使用 C 盘；源码副本、临时目录、缓存、依赖、构建产物、日志、测试配置和数据均放在 D 盘或其他非 C 盘位置。运行工具前检查并重定向 `TEMP`、`TMP` 及相关工具的缓存和数据目录；无法确认不会使用 C 盘时，先解决或停止该操作。
- 阅读整体功能设计、相关模块的 `design.md`、`test-report.md` 和当前迭代。
- 核对实际源码、发布包和测试证据，区分已发布、源码已实现、已确认设计与候选功能。
- 当前连接目标与各 Agent 实际接入方式以 [接入矩阵](doc/agent-integration-matrix.md) 为准；选型与快速接入见 [选型指南](doc/agent-integration-guide.md)。

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
- 主文档（README、product-design、architecture、data-model、protocol、testing、project-plan、接入矩阵）只保留当前状态；逐轮历史、发布通告与交付记录写入迭代文档并在 `doc/iterations/README.md` 登记，不在主文档重复堆叠。
- 功能 ID 和模块 ID 保持稳定，源码定位使用可点击相对路径，跨进程/恢复流程优先使用清晰的图表。
- 交付前执行 `node scripts/check-docs.mjs`，并运行与实际产品改动相应的工程检查。
- 文档同步是完成条件，不额外要求用户批准，也不替代用户已有授权。用户指令优先。
