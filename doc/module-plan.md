# 模块目录与修改影响

更新：2026-10-12。模块按长期职责划分，编号不随迭代重新编号。一次迭代可以修改多个模块，同一个模块的设计和报告持续维护。

| 模块 | 主要代码 | 设计与报告 | 修改时通常需要联动 |
| --- | --- | --- | --- |
| M01 桌面 | `desktop/src/NetworkApp.tsx`、[AgentGraph](../desktop/src/AgentGraph.tsx)、[graph-state](../desktop/src/graph-state.ts)、`AddMachineDialog.tsx`、`App.tsx`、`api.ts`、`types.ts` | [设计](modules/01-desktop/design.md) / [报告](modules/01-desktop/test-report.md) | M02 请求接口、M06 消息语义、M08 关系 |
| M02 Coordinator | `coordinator*.cjs`、[graph-operations](../desktop/electron/graph-operations.cjs)、[graph-layout](../desktop/electron/graph-layout.cjs)、`main.cjs`、`preload.cjs`、`private-directory.cjs` | [设计](modules/02-coordinator/design.md) / [报告](modules/02-coordinator/test-report.md) | M03 路由、M04 状态、M07 台账、M10 持久资源 |
| M03 机器网络 | `machine-router.cjs`、`agent-network.cjs`、`machine-host.cjs`、`tool-discovery.cjs` | [设计](modules/03-machine-network/design.md) / [报告](modules/03-machine-network/test-report.md) | M01 状态、M04 身份、M07 占位、M08 来源 |
| M04 SSH 接入 | `ssh-host.cjs`、`ssh-known-hosts.cjs`、`ssh-credentials.cjs`、`ssh-install.cjs` | [设计](modules/04-ssh-access/design.md) / [报告](modules/04-ssh-access/test-report.md) | M01 接入表单、M05 协议、M10 包格式 |
| M05 Linux daemon | `machine-daemon.cjs`、`machine-relay.cjs`、`machine-protocol.cjs` | [设计](modules/05-linux-daemon/design.md) / [报告](modules/05-linux-daemon/test-report.md) | M04 握手、M06 host、M07 收据、M08 回调 |
| M06 原生适配 | `src/drivers/*`、`native-server.ts`、`native-identity.ts`、`claude-host.cjs`、`codex-host.cjs` | [设计](modules/06-native-adapters/design.md) / [报告](modules/06-native-adapters/test-report.md) | M01 回答/权限、M07 会话/取消、M08 原生 MCP |
| M07 任务与恢复 | `core.ts`、`controller.ts`、`storage/*`、`pending-journal.cjs`、宿主任务记录 | [设计](modules/07-task-session/design.md) / [报告](modules/07-task-session/test-report.md) | M02 中央操作、M03 占位、M05 去重、M06 原生查证 |
| M08 协作 | `agent-network.cjs`、`collaboration-broker.cjs`、`mcp-client.cjs` | [设计](modules/08-collaboration/design.md) / [报告](modules/08-collaboration/test-report.md) | M01 图与关系、M03 source、M07 父子任务、M06 原生工具 |
| M09 CLI/Hub/Edge | `cli.ts`、`terminal.ts`、`client.ts`、`hub.ts`、`edge.ts`、`settings.ts` | [设计](modules/09-cli-hub-edge/design.md) / [报告](modules/09-cli-hub-edge/test-report.md) | M06 Driver、M07 状态/存储、协议 |
| M10 打包 | `desktop/scripts/*`、`desktop/package.json`、`worker-runtime.cjs`、`coordinator-runtime.cjs` | [设计](modules/10-packaging/design.md) / [报告](modules/10-packaging/test-report.md) | M02 运行资源、M04 Linux 清单、所有模块的版本验收 |

| M11 文档网页 | `doc/.vitepress/*`、`prepare-doc-site.mjs` | [设计](modules/11-documentation-portal/design.md) / [报告](modules/11-documentation-portal/test-report.md) | 同源资料、引用资源与文档检查；独立于 Agent 控制 |

`agent-network.cjs` 同时承载节点与协作，不代表它是两个独立实现；M03 解释身份/路由，M08 解释授权/委派。`coordinator-runtime.cjs` 的生命周期归 M02，发布资源完整性归 M10。跨模块测试可以被多份报告引用，总测试数不能重复相加。

原生适配细分为 [OpenCode](modules/06-native-adapters/opencode/design.md)、[Claude Code](modules/06-native-adapters/claude/design.md)、[Codex](modules/06-native-adapters/codex/design.md)，每个都有独立报告。

修改任何模块必须同步 [整体功能目录](product-design.md)、该模块设计/报告和当次 [迭代记录](iterations/README.md)。具体开发顺序与完成条件见 [维护规则](development-guide.md)。
