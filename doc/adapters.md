# 原生 Agent 与 Driver 文档入口

当前完整材料集中在模块目录，本文负责定位实现与能力，不再维护另一份互相冲突的适配器说明。

| 阅读目的 | 文档 |
| --- | --- |
| 按原生CLI、原生API、MCP、ACP、插件、厂家SDK查看各Agent已接入路径及验收程度 | [Agent接入矩阵](agent-integration-matrix.md) |
| 比较接入方式的优缺点、功能、逐Agent建议与快速接入 | [接入选型指南](agent-integration-guide.md) |
| 开发新的源码注册适配器，核对Host契约与实际验证命令 | [自定义Agent开发指南](custom-agent-development.md) |
| 看懂工具接入、能力差异与原生配置继承 | [M06 原生 Agent 模块设计](modules/06-native-adapters/design.md) |
| 查当前工程/真实工具测试与未通过项 | [M06 测试报告](modules/06-native-adapters/test-report.md) |
| OpenCode HTTP、轮询、会话和取消 | [设计](modules/06-native-adapters/opencode/design.md) / [测试报告](modules/06-native-adapters/opencode/test-report.md) |
| Claude stream-json、delta、许可与 worker | [设计](modules/06-native-adapters/claude/design.md) / [测试报告](modules/06-native-adapters/claude/test-report.md) |
| Codex JSON CLI、thread、MCP 与原生续聊限制 | [设计](modules/06-native-adapters/codex/design.md) / [测试报告](modules/06-native-adapters/codex/test-report.md) |
| Hermes / Pi / DSH原生CLI、生命周期与图标 | [扩展交付](iterations/I07/native-agent-expansion.md) |
| DSH Windows Desktop / Linux Web认证HTTP与设置入口 | [协议、使用、测试和未测边界](iterations/I07/dsh-desktop-web.md) |

核心 TypeScript [AgentDriver](../src/drivers/driver.ts) 当前由 Mock/OpenCode 实现，在 Edge 中运行。桌面及 Linux daemon 使用 [MachineHost](../desktop/electron/machine-host.cjs) 和[静态注册表](../desktop/electron/builtin-adapters.cjs)路由六种产品的八个入口：Claude/OpenCode/Codex/Hermes/Pi/DSH CLI/DSH Desktop/DSH Web。各宿主遵循call/close接口；没有将其都实现为同一TypeScript Driver，也不动态加载用户指定模块。DSH Desktop/Web连接已运行的HTTP服务，其他CLI入口的启动与原生配置行为各自保持。

Mock 是受控工程夹具：它可验证本地事件与去重规则，不能用它的计数承诺真实外部工具 exactly-once。历史旧文档归档在 [archive/legacy/adapters.md](archive/legacy/adapters.md)，仅用于查变更背景，不能作为当前能力依据。

修改适配器后，同步完整模块设计、该工具的测试报告以及对应迭代文档。当前节点流程不新增 Bridge 模型/供应商选择；已有原生 CLI 管理模型、登录与账号。

Bridge驱动Agent的CLI/HTTP接口，与Agent调用Bridge的MCP接口是两个方向；当前没有内置ACP或厂家SDK驱动。DSH专属设置卡是当前UI布局，不能据此把它理解为另一套模型、Agent能力或协作系统。
