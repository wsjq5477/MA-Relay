# AgentBridge 项目资料

当前连接配置与节点准入修复见[issue #15/#16 的实现、验证与交付](iterations/I08/connection-identity-node-scope.md)；保存的 DSH 地址具有明确节点选择，独立节点接入不再被同机其他安装的 unknown 误锁。该修复尚未公开，当前公开版仍 alpha.46。

最新验收：alpha.46的已安装OpenDesk/DSH原生MCP组件正式授权、撤权和恢复通过；两条生产协作链各完成1个真实Claude子任务，原观察器重开保持原Session与请求，不重放。OpenDesk 日常原生父模型只读发现已通过，实际 list_agents 返回 7 个获准节点；[原生发现证据](iterations/I08/opendesk-mcp-diagnostic-repair.md)。父模型自主委派与原生页面仍未验；[组件层级与原始证据](iterations/I08/mcp-native-acceptance.md)。

AgentBridge 把用户已安装的 Agent 工具（Claude Code、OpenCode、Codex、Hermes、Pi、DSH、OpenDesk 等）呈现为可观察的节点：在一个客户端里发需求、看进度、读结果，并让主 Agent 通过受限接口发现和委派获准的其他 Agent。模型、账号与原生配置仍由各工具自己管理。

用户阅读入口：[使用文档首页](user/index.md)、[原生Agent总览](user/agents/index.md)、[DSH](user/agents/dsh.md)、[接入方式比较](user/integration-methods.md)。本页是仓库维护资料入口，不发布到用户网页。

## 当前状态

| 项目 | 状态 |
| --- | --- |
| 稳定历史版本 | 0.5.0（I05：机器节点与主从协作） |
| 当前 GitHub 预发布 | **0.6.0-alpha.46**，标签冻结 `9766eb4`；EXE 130180760 字节，SHA-256 `57f1af73…`；源码/附件已公开并通过匿名完整下载核验；[交付与边界](iterations/I08/alpha46-release.md) |
| alpha.34 包含 | OpenCode 1.x/2.x 双协议、独立MCP配置管理、CT-04公共材料、CT-05选材包、alpha.30–33修复、I07A/B与I07C首批 |
| 公开 alpha.35 | issue #12 同机独立执行与原查询反馈，标签冻结 `b5de577`；[发布登记](iterations/release-ledger.md) |
| 当前发布包 | **alpha.46**：MCP启动器/数组探测、配置绑定与60秒观测有效期、Linux端点恢复、非GUI首次接入；未签名、未部署远端；[发布与证据](iterations/I08/alpha46-release.md) |
| 当前公开源码范围 | OpenDesk已有接口、当前维护恢复与MCP02源码均已随alpha.46公开；能力与未测项按专项保留 |
| 当前已发布实现与验收边界 | [I08-MCP02](iterations/I08/mcp-open-integration.md)与[恢复修复](iterations/I08/mcp-open-recovery.md)：三维能力、六项事实、双向增删/撤权、DSH显式profile、非GUI接入；桌面758/758、根68/68。OpenDesk CLI0.3.8无MCP管理面、DSH Desktop/Hermes/Pi原生配置及逐入口真实主调用仍为缺口 |
| 未准出 | 完整 I06C/I07C；Hermes/Pi/DSH 真实工具执行验收；DSH 原实例推理；独立SSH |

逐轮历史与发布记录统一在 [迭代目录](iterations/README.md)，主文档只维护当前状态。

## 从哪里开始

| 你要做的事 | 阅读顺序 |
| --- | --- |
| 理解产品、确认功能边界 | [整体功能设计](product-design.md) → [模块目录](module-plan.md) |
| 理解系统如何运行、如何通信 | [整体架构](architecture.md) → [对象与数据](data-model.md) → [接口与协议](protocol.md) |
| 开发或修改某个功能 | 对应模块的 `design.md` 和 `test-report.md` → [开发与文档维护](development-guide.md) |
| 判断哪些功能可验收 | [整体验证报告](testing.md) → 对应模块测试报告 → 报告引用的原始证据 |
| 接入或新增一个 Agent | [接入矩阵](agent-integration-matrix.md) → [选型指南](agent-integration-guide.md) → [开发指南](custom-agent-development.md) |
| 排下一轮工作 | [迭代路线](project-plan.md) → [迭代目录](iterations/README.md) |
| 启动、构建或排障 | [仓库说明](../README.md)、[桌面使用说明](../desktop/README.md)、[打包模块](modules/10-packaging/design.md) |

## 模块设计与测试报告

| 模块 | 设计 | 测试报告 |
| --- | --- | --- |
| M01 桌面界面与交互 | [设计](modules/01-desktop/design.md) | [报告](modules/01-desktop/test-report.md) |
| M02 中央 Coordinator | [设计](modules/02-coordinator/design.md) | [报告](modules/02-coordinator/test-report.md) |
| M03 机器与 Agent 节点 | [设计](modules/03-machine-network/design.md) | [报告](modules/03-machine-network/test-report.md) |
| M04 SSH 接入、信任与安装 | [设计](modules/04-ssh-access/design.md) | [报告](modules/04-ssh-access/test-report.md) |
| M05 Linux daemon 与 relay | [设计](modules/05-linux-daemon/design.md) | [报告](modules/05-linux-daemon/test-report.md) |
| M06 原生 Agent 适配 | [设计](modules/06-native-adapters/design.md) | [报告](modules/06-native-adapters/test-report.md) |
| └ OpenCode | [设计](modules/06-native-adapters/opencode/design.md) | [报告](modules/06-native-adapters/opencode/test-report.md) |
| └ Claude Code | [设计](modules/06-native-adapters/claude/design.md) | [报告](modules/06-native-adapters/claude/test-report.md) |
| └ Codex | [设计](modules/06-native-adapters/codex/design.md) | [报告](modules/06-native-adapters/codex/test-report.md) |
| M07 任务、会话与恢复 | [设计](modules/07-task-session/design.md) | [报告](modules/07-task-session/test-report.md) |
| M08 主从关系与协作 | [设计](modules/08-collaboration/design.md) | [报告](modules/08-collaboration/test-report.md) |
| M09 CLI 与 Hub/Edge 兼容入口 | [设计](modules/09-cli-hub-edge/design.md) | [报告](modules/09-cli-hub-edge/test-report.md) |
| M10 打包与交付 | [设计](modules/10-packaging/design.md) | [报告](modules/10-packaging/test-report.md) |
| M11 文档网页入口 | [设计](modules/11-documentation-portal/design.md) | [报告](modules/11-documentation-portal/test-report.md) |

## Agent 接入导航

[接入矩阵](agent-integration-matrix.md)按原生CLI、API、MCP、ACP、插件、SDK登记每个 Agent 的已实现路径与证据边界；[选型指南](agent-integration-guide.md)说明六种方式的优缺点、逐Agent后续建议和快速接入；[开发指南](custom-agent-development.md)给出源码适配步骤与检查命令。

## 如何读状态

- **已发布**：已包含在注明版本的程序中，不代表每个原生工具或账号都可执行。
- **源码已实现**：代码存在，测试范围见报告；尚未发布的能力不能用旧 EXE 验证。
- **已确认设计**：决定怎么做，还没有功能实现或交付证据。
- **候选**：原始设想或后续建议，还没有纳入当前开发范围。

测试报告使用“通过、部分验证、未测试、失败/环境限制”描述事实。每条都注明受控测试、界面模拟、真实 Agent 或发布包实测，计划中的用例不计入通过数。

## 文档的职责

```mermaid
flowchart TD
  Product[整体功能设计：产品现在是什么] --> Architecture[架构与对象：各部分怎么协作]
  Architecture --> Modules[模块设计：本模块怎么工作]
  Modules --> Reports[模块测试报告：哪些事实有证据]
  Change[迭代文档：本次改什么] --> Modules
  Change --> Product
  Change --> Reports
```

整体设计是持续维护的当前说明；迭代材料记录一次变更的范围、实现和验收，统一在[迭代目录](iterations/README.md)索引。历史报告保留原日期、版本与限制，不能用新结果改写旧结论。

原始 [doc.md](../doc.md) 是项目初稿，原综合计划保存在 [历史资料](archive/README.md)。当前行为以本目录的整体设计、模块设计和测试证据为准。旧 `docs/` 只保留迁移入口。

## 网页阅读与材料范围

在仓库根执行 `npm run docs:dev` 打开 `http://localhost:4188`；构建静态站点用 `npm run docs:build`。网页只发布 `doc/user/` 的当前用户说明；内部设计/报告/问题/迭代不进入导航、搜索、路由或下载。使用方法见 [网页说明](web-reading.md)。

远端源码、私有运行状态及本地验收材料的范围见 [远端源码范围](repository-sync.md)；逐版本的标签、EXE 与 SHA-256 对照见 [历史发布登记](iterations/release-ledger.md)。
