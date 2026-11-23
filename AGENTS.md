# AgentBridge 开发与文档协作

当前公开预发布 **0.6.0-alpha.76.local.20261123.acp**，冻结源码为 8b69f71。此版本提供 DSH ACP 与通用 ACP v1 stdio 接入。[交付记录](doc/iterations/I08/acp-stdio-runtimes.md#公开预发布)。

项目的完整资料入口是 [doc/README.md](doc/README.md)，同步规则见 [doc/development-guide.md](doc/development-guide.md)。人类和 Agent 按同一套规则开发。

当前产品定位与范围以[产品约束](doc/product-constraints.md)为准。首阶段覆盖获准的新建会话、原绑定续聊、交互和原请求恢复；[当前范围核对](doc/iterations/I08/current-scope-audit.md)记录源码、受控和真实证据。决策依据见[互联核心决议](doc/iterations/I08/interconnect-boundary.md)，既有实测见[互联开发台账](doc/iterations/I08/interconnect-development.md)。小队、业务工作流、Workspace 和 Memory 为可选。保留原任务和授权。

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

## 本地 EXE 与公开发布

- 本地 Windows EXE 使用 `powershell -File scripts/build-local-exe.ps1`，安装包加 `-Installer`。默认只编译及打包，实际使用由用户验收。
- 用户确认本地包并明确要求发布后，才执行 GitHub 发布。
