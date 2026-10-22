# AgentBridge 开发与文档协作

当前公开预发布**0.6.0-alpha.36**，标签冻结`1fef25f`，Windows EXE 130032973字节、SHA-256 `43e09dd34e1a86998a446048dd39279a91356189d132c1eae9facebec1472798`，附件已公开并通过匿名完整下载核验；稳定历史Windows版本0.5.0。完整I06C/I07C未准出，历史见doc/iterations/README.md。

当前本地候选**0.6.0-alpha.46**（未签名、未公开、未部署远端）：承接I08-MCP02，修复OpenDesk导出启动器、OpenCode数组命令探测、配置变化/过期观测、Linux本机MCP端点恢复，并补齐非GUI首次接入和原操作查询。EXE130180760字节、SHA-256 `57f1af73f761af72d75121284b023a001dad05eb30c0c197e18851cc9a7e8c48`；核心68/68、桌面758/758，最终JSON修复后CLI11/11、类型/lint/构建通过。Windows真实隔离非GUI5组、生产前端5组、普通EXE4组通过（模型0），包源码一致性通过；详情见doc/iterations/I08/mcp-open-recovery.md。只修改Bridge，不修改或构建OpenDesk；OpenDesk Desktop已有真实执行/续聊与诊断MCP列表证据，但正式原生主Agent委派仍未验。OpenDesk CLI0.3.8只能导出MCP片段，DSH Desktop/Hermes/Pi原生配置仍未适配；完整MCP02未准出。同日后续原生组件验收：OpenDesk协议5组、DSH6组，两条生产协作链各1个真实Claude子任务succeeded，原观察器重开无重放；未修改产品代码/EXE。OpenDesk日常原生父模型只读list_agents已验，实际返回7个获准节点；退出前先改盘会被旧内存配置写回，须完全退出后再写。现场见doc/iterations/I08/opendesk-mcp-diagnostic-repair.md；原生父模型自主委派及日常原生页面仍未验，见doc/iterations/I08/mcp-native-acceptance.md。历史候选与真实验证见doc/iterations/I08/。

项目的完整资料入口是 [doc/README.md](doc/README.md)，同步规则见 [doc/development-guide.md](doc/development-guide.md)。人类和 Agent 按同一套规则开发。

## 开发前

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
