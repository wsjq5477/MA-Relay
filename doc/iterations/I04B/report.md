# I04B 开发与交付记录

日期：2026-10-09。当前状态：**I04B 已交付可用的 Windows 0.4.1 便携程序：同时连接 Windows Claude 与 WSL OpenCode，双机器真实两轮/历史、Claude 原生修改审批/取消、工程与 UI 合约及普通 Windows 窗口启动均通过。** 端到端界面可见延迟没有重新测量，已测的 20 次预热聚合刷新 p95 14.1ms 不代替该指标。

## 本轮行为

桌面先自动登记 Windows 本机与 WSL 发行版，再在机器内发现 Claude Code/OpenCode。连接工具不要求先选项目；项目实例在连接下独立创建。总览和看板聚合两机器的数据，每项任务、会话及控制请求保留来源，不因用户切换视图而关闭另一侧宿主。

原 OpenCode 的 agentId、taskId、conversationId、原生 Session 与历史数据库保留。桌面 `machines.json` 增加机器/连接/实例归属，公共 ID 使用 `machineId::rawId`，请求/操作按来源独立记录。机器离线后仍展示已登记实例；同盘 Windows/WSL 已知路径共享占位，未知执行不会自动重投。

模型默认继承原生配置，同时提供可选实例覆盖。覆盖只作用该项目实例，不改 Claude/OpenCode 全局配置，不要求新 API Key。旧默认模型被供应商拒绝或下线时，展示真实错误，用户可为该实例选择可用模型。

## 开发模块与审查修正

| 模块 | 本轮变化与原因 | 已有证据 |
| --- | --- | --- |
| MachineRouter | 持久机器/连接/实例；每机器独立宿主；限定 ID 路由；工具连接与项目创建分开 | machine-router.test.cjs 的目录、迁移、同 ID、分步连接用例 |
| 多机器观察 | 单机器 snapshot job 去重、10 秒截止与 5 秒冷却；保留另一机器结果和故障来源 | 永不返回的假 WSL 用例，在 30ms 测试截止下及时返回健康 Windows |
| 项目占位 | 幂等合同优先；共享目录检查实例 busy/currentTask、历史任务及离线持久实例 | 共盘、第 101+ 活动任务、重开无缓存与重复请求用例 |
| 旧配置/请求迁移 | 原后端 ID 不改；旧 WSL 即使已卸载也保留 unavailable 机器身份，不回退其他来源 | 原历史绑定与 Missing WSL 用例；桌面套件含主进程 pending 合约 |
| ClaudeHost/worker | 原生 Windows CLI、结构化事件、Session 续问、本地任务与命令记录、独立后台观察恢复 | 双机真实两轮；真实 Write 本次审批/文件标记、取消确认原进程退出、重开记录 |
| 实例模型配置 | setInstanceModel 精准来源、expectedRevision 与模型/清除合同；默认继续继承 | 路由用例及两工具仅实例覆盖的真实文本验收 |
| 前端机器信息结构 | 机器入口与所属连接/实例；来源标签、筛选及模型覆盖入口 | Mock 窗口 9+6+4 项交互合约；最终便携程序普通 Windows 窗口、renderer 真实快照 |

独立审查修正了幂等重试被项目占位误挡、只用 100 条看板任务判断忙碌、重开离线来源失去占位、离线已有实例误显示空配置和旧发行版来源回退问题。测试直接覆盖这些回归场景，未使用真实工具进程做故障注入。

## 已完成验证

| 验证 | 结果 | 证据与实际范围 |
| --- | --- | --- |
| 机器路由独立合约 | 13/13 通过 | node --test desktop/tests/machine-router.test.cjs；确定性双来源夹具、临时目录 |
| Windows Claude + WSL OpenCode | 已通过真实两轮 | [I04B-dual-real.json](../../../artifacts/I04B-dual-real.json) 的 7 项检查全部通过 |
| 两工具同时提交与正确回复 | 已通过 | Windows/WSL 各自返回约定标记，原生 Session 分属各工具 |
| 原会话续问与重开历史 | 已通过 | 每工具两轮复用原 Session，重开后保留 2 实例、2 会话、4 任务 |
| Claude 原生 Write 与本次审批 | 已通过 | [I04B-claude-controls-real.json](../../../artifacts/I04B-claude-controls-real.json)，真实权限请求、指定文件唯一标记 |
| Claude 取消与原进程退出 | 已通过 | 同控制报告，任务 cancelled、收据 confirmed、nativeExited:true；重开保留 |
| 前端机器及模型交互 | 9+6+4 项通过 | I04B-ui-machines/model-create/model-edit.json，全部为 Mock 双来源窗口 |
| 桌面工程测试 | 33/33 通过 | 机器路由、Claude 宿主及主进程合约 |
| 后端与最后模型 API 检查 | 42/42 基线；最后宿主 2/2、类型/lint 通过 | 完整后端套件运行在模型 API 最后修改前；最后改动采用目标检查 |
| 双源只读聚合刷新 | 20 次，p95 14.1ms | [I04B-refresh.json](../../../artifacts/I04B-refresh.json)，两真实宿主预热后 snapshot 调用耗时 |
| 最终便携程序普通 Windows 窗口 | 4 项通过 | [I04B-windows-startup.json](../../../artifacts/I04B-windows-startup.json)，win32 v0.4.1，无调试接口，renderer 确认两机器/连接/实例与 6 项真实历史 |

真实验收只在隔离实例覆盖模型：Windows Claude `DeepSeek-V4.1-Flash`、WSL OpenCode `csi-provider/DeepSeek-V4.1-Flash`。用户全局配置未改动。两执行机器位于同一物理宿主，这不是远程电脑接入验证。

当前用户默认的 GLM-5.1/exo-free 问题原样保留，并未因验收成功变成可用默认。进入“项目实例”对应实例的“模型设置”，选择该账号可用模型后新建会话；清空覆盖可恢复继承。修改设置保留旧会话历史，不把旧配置会话静默改绑。

界面证据 [I04B-machines-ui.png](../../../artifacts/I04B-machines-ui.png) 来自 **Mock 窗口**；9+6+4 检查分别覆盖机器/连接/实例、创建模型及已有实例模型入口。这些与真实双工具任务/文件证据分开；普通启动报告通过进程/窗口与 renderer 快照确认最终程序，不把 Mock 图当作本次真实截图。

## 产物与使用

| 项目 | 内容 |
| --- | --- |
| 版本 | AgentBridge 0.4.1 Windows x64 便携程序 |
| 仓库产物 | [desktop/release/AgentBridge-0.4.1-Windows-x64.exe](../../../desktop/release/AgentBridge-0.4.1-Windows-x64.exe) |
| Windows 本地副本 | C:\Users\jiqi\.codex\visualizations\2026\10\08\redacted-id\AgentBridge-0.4.1-Windows-x64.exe |
| 字节数 | 101449479 |
| SHA256 | 88baaa50c56328d8e5cd04c24967621fc8aeb439d7ae013964b50a7865be8141 |
| 普通启动证据 | Windows DESKTOP-JR5J3AA、WSL Ubuntu 均在线；2 健康连接、2 实例、6 历史任务 |
| 首次解包加启动 | 20.604 秒；独立于预热刷新指标 |

双击 Windows 本地副本；进入“机器”，在 Windows/WSL 下连接已发现工具，再为工具选择项目创建实例。既有 OpenCode 实例自动归入原 WSL，历史保留。默认模型无权限或下线时，在“项目实例”的“模型设置”指定账号可用模型后新建会话，不必修改工具全局配置。设置留空继续继承。

## 保留的失败记录

- [继承模型错误](../../../artifacts/I04B-inherited-model-errors.json)：Claude 默认 GLM-5.1 无当前账号权限，OpenCode 默认 exo-free 已下线；安装与连接通过不能代替真实模型回复。
- [后台 worker 故障](../../../artifacts/I04B-native-worker-error.json)：Windows Claude 为 unknown，WSL 回复成功。Windows heartbeat 原子替换已修复并有故障注入回归覆盖，随后真实工具审批、写入和取消验证通过；双机两轮验证另已通过，原失败证据保留。

## 已知限制与未复测项目

| 项目 | 当前状态 |
| --- | --- |
| OpenCode 本轮真实文件/权限/取消场景 | 沿用 I04 已有真实验收及工程回归；本轮未复跑同一文件场景 |
| 两机器后台状态变更至 renderer 可见 p95 | 未重新测量；20 次聚合调用 p95 14.1ms 不能替代此口径 |
| 后端最后模型 API 后完整套件 | 已做类型/lint及宿主目标 2/2；完整 42 项结果是改动前基线 |

工程交付同时通过根项目 lint、类型与构建，以及桌面类型/构建检查；具体用例范围以测试记录为准，不把目标回归等同于最后改动后的完整后端重跑。

当前目标限本机 Windows Claude 与本机 WSL OpenCode。远程外网机器、主 Agent 调度、会话跨工具移动、并行 worktree、代码签名和自动升级没有在本轮验收。未知挂载/目录别名的共享资源隔离与未支持的原生表单能力应按最终实现说明，不能自动放宽权限来掩盖适配差异。
