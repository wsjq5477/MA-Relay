# 原生 Agent 与 Driver 文档入口

更新日期：2026-10-12。当前完整材料集中在模块目录，本文负责定位实现与能力，不再维护另一份互相冲突的适配器说明。

| 阅读目的 | 文档 |
| --- | --- |
| 看懂工具接入、能力差异与原生配置继承 | [M06 原生 Agent 模块设计](modules/06-native-adapters/design.md) |
| 查当前工程/真实工具测试与未通过项 | [M06 测试报告](modules/06-native-adapters/test-report.md) |
| OpenCode HTTP、轮询、会话和取消 | [设计](modules/06-native-adapters/opencode/design.md) / [测试报告](modules/06-native-adapters/opencode/test-report.md) |
| Claude stream-json、delta、许可与 worker | [设计](modules/06-native-adapters/claude/design.md) / [测试报告](modules/06-native-adapters/claude/test-report.md) |
| Codex JSON CLI、thread、MCP 与原生续聊限制 | [设计](modules/06-native-adapters/codex/design.md) / [测试报告](modules/06-native-adapters/codex/test-report.md) |

核心 TypeScript [AgentDriver](../src/drivers/driver.ts) 当前由 Mock/OpenCode 实现，在 Edge 中运行。桌面及 Linux daemon 使用 [MachineHost](../desktop/electron/machine-host.cjs) 固定路由 OpenCode/Claude/Codex；Claude/Codex 通过宿主接口接入，并未实现同一 TypeScript Driver 或动态插件加载。

Mock 是受控工程夹具：它可验证本地事件与去重规则，不能用它的计数承诺真实外部工具 exactly-once。历史旧文档归档在 [archive/legacy/adapters.md](archive/legacy/adapters.md)，仅用于查变更背景，不能作为当前能力依据。

修改适配器后，同步完整模块设计、该工具的测试报告以及对应迭代文档。当前节点流程不新增 Bridge 模型/供应商选择；已有原生 CLI 管理模型、登录与账号。
