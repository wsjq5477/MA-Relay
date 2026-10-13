# I03A 交付与验收报告

日期：2026-10-08。状态：**CLI 功能已实现，工程检查及真实 OpenCode 核心验收通过，待用户人工签收。** 本报告保留 I03A 初始验收时的证据；I03A 后续体验修正和 I03B 连续会话、取消与恢复现已完成，当前交付与最终验收见 [迭代三最终报告](../I03B/report.md)。

**用户试用后的修正：** 原向导询问过多，默认保存草稿导致选完未连接，界面暴露内部 ID/版本且不易使用。原工程通过不能代替首次使用体验。当前已按用户要求改为自动发现 OpenCode、空格勾选即连接、方向键菜单与中文状态；旧启用配置进入时自动连接，高级选项单独入口。后续修复证据见 [CLI 修复记录](cli-fix.md)；下文源码摘要和终端记录保留为修复前 I03A 历史验收。

## 1. 用户可使用的交付

直接运行 `agentbridge`。首次进入中文配置向导，之后进入连接概览和操作菜单；后台维持连接，日常额外必需常驻终端为 0。

| 需求 | 已交付功能 | 主要实现 |
| --- | --- | --- |
| F01 单入口与后台 | TTY 默认入口、后台启动复用、状态/停止、退出 CLI 后后台保留 | terminal.ts、controller.ts、native-server.ts |
| F02 首次配置 | OpenCode 路径/版本、已有项目、托管或已有服务、模型继承/覆盖、草稿、原位导入 | terminal.ts、settings.ts |
| F03 连接管理 | 多连接维护、启停、默认目标、版本冲突检测、局部生效 | settings.ts、controller.ts、hub.ts、edge.ts |
| F04 检查与验证 | 只读分项检查；显式随机标记真实回复；工具全部禁止；配置/继承模型变化提示证据过期 | drivers/opencode.ts、opencode-client.ts |
| F05 状态可见 | 配置、连接、验证和工作状态分别显示；停用/离线连接保留；快照和持续观察区分 | controller.ts、terminal.ts |
| F06 真实单次任务 | 指定或默认目标、同终端观察、真实结果、requestId 去重和查询 | cli.ts、terminal.ts、hub.ts、edge.ts |
| F07 原生等待回复 | 同终端一次允许/拒绝、文本表单、原生绑定核对、operationId 查询、重复回复保护 | drivers/forms.ts、storage/operations.ts、Hub/Edge |
| F08 退出与保护 | 重返只查询、历史保留、保存失败可修复、原生故障 unknown 占位、旧数据迁移和权限保留 | settings.ts、storage/、controller.ts |

模块分析见 [design.md](design.md)，需求与开发责任分别见 [requirements.md](requirements.md)、[development.md](development.md)。运行和旧配置导入方法见 [README](../../../README.md)。

## 2. 本轮证据与环境

- Linux/WSL；Node v22.23.1；OpenCode 2.0.24。
- 真实验收明确选择 `csi-provider/DeepSeek-V4.1-Flash`，两个原生 Session 均确认 variant 为 `default`。该模型只是本轮测试选择，产品不固定提供方或模型。
- 独立 `/tmp` 实例、两份人工计算器样例；沿用已有 OpenCode 认证，未修改生产 Bridge 配置或原生 Provider 配置。
- 产品运行只需 Node；Python 3 仅用于验收脚本驱动真实 PTY。
- `npm run typecheck`、`npm run lint`、`npm run build` 通过；`npm test` **28/28 通过，失败/跳过均为 0**。
- 最终源码摘要与当前 `src` 按验收脚本相同算法核对一致：`39f8a8bd3621d54cbff633f22f2a8622a04be61d6ac61b6aa43bd25b146c4faf`。

| 证据 | 内容 |
| --- | --- |
| [工程结果](../../../artifacts/I03A-checks.txt) | 最终工程命令、计数和摘要 |
| [真实验收 JSON](../../../artifacts/I03A-acceptance.json) | Task/Execution/Session/Request、实际模型、独立测试、计数及 20 个延迟样本 |
| [真实终端记录](../../../artifacts/I03A-terminal.txt) | 向导、菜单、观察、权限与文本填答的 PTY 操作 |
| [原生契约证据](../../../artifacts/I03A-native-contract.json) | 已安装 2.0.24 二进制摘要、禁止工具和权限/表单契约 |
| [真实验收脚本](../../../scripts/i03a-acceptance.ts) | 独立样例与同终端闭环，可指定自己的可用模型复跑 |
| [控制器回归](../../../tests/controller.test.ts) | 并发启动、局部应用、资源占位、提交/回复去重与响应丢失 |
| [配置回归](../../../tests/settings.test.ts)、[导入回归](../../../tests/owner-import.test.ts) | 原子保存失败、版本冲突、旧权限/历史/unknown 资源保留 |
| [TTY 回归](../../../tests/terminal.test.ts) | 草稿、菜单退出、Ctrl+C/EOF 与后台存活 |

首次和第二次真实执行的失败记录保留在 `artifacts/I03A-first-run.json`、`I03A-second-run.json`；最终结论仅依据最后一轮通过记录。前两次分别暴露拒绝后不能假定模型立即结束、原生等待查询失败不能阻止后续 unknown 状态确认的问题，已修正实现或验收假设。

## 3. 已测交付指标

| 指标 | 最终实测 | 结果 |
| --- | --- | --- |
| 首次向导 → 验证 → 分析/修改/测试 → 原生授权 → 重返 | 实际 PTY 和真实 OpenCode 完成 | passed |
| 日常额外必需终端 / 手改 JSON | 0 / 0 | passed |
| 两个不同项目的真实受限验证 | 各自随机标记、Session/配置指纹和实际模型；工具 0、文件改变 0 | passed |
| 只读检查是否调用模型 | 检查后 Task 数 0，modelResponse 为 not_checked；离线回归亦核对 Prompt 未增加 | passed |
| 真实分析与修改 | 分析完成；实际 edit 和 bash/npm test；独立 node --test 2/2 通过；测试文件保持原样 | passed |
| 真实拒绝 | 回复已接受、原生权限等待清除、项目哈希不变 | passed；模型终态未确认 |
| 真实文本表单 | 通过真实原生 API 创建必填文本字段，在 CLI 填答；confirmed 后等待清除 | passed（接口合约）；模型自主生成未验证 |
| 同 requestId 重复提交 5 次 | 1 Task、1 原生 User Prompt | passed |
| 同操作重复 5 次 / 不同操作争同一等待 | 受控原生服务核验最多 1 次写入；响应丢失后原操作查询仍 unknown、写入不增加 | passed（离线合约） |
| 同配置重复启动 | 5 次并发启动及退出重返复用同一控制器 PID | passed |
| unknown 资源别名绕过 / 自动重投 / 历史丢失 | 0 / 0 / 0 | passed |
| 已确认状态到持续观察显示 | 20 个时间戳样本，p95 **231 ms**，目标 ≤ 2000 ms | passed |
| 凭据明文检查 | 终端、服务摘要与验收产物命中 0；目录 0700、socket 0600 | passed（本轮范围） |

状态延迟测本机后台已确认的连接描述更新到实际 CLI 持续观察显示；不包括模型生成、原生事件发现和心跳判离线耗时，不代表所有故障分支的端到端延迟。

## 4. 测试计划逐项映射

对应 [testing.md](testing.md) 的 A01–A32。`passed` 指列出的已测行为；`partial` 明确保留同一用例中的扩展分支，不能将本表解释为 32 项所有条件均已覆盖。R=真实 PTY/OpenCode，C=controller 回归，S=settings 回归，O=owner-import 回归，T=TTY 回归；I01/I02 表示本轮完整 npm test 中保留的既有回归。

| 用例 | 状态 | 来源与实测 / 待验证 |
| --- | --- | --- |
| A01 | passed | R/T：首次向导、菜单、单终端与重返 |
| A02 | passed | C/R：并发/连续 5 次，复用 PID，无重复 Prompt |
| A03 | passed | C/T/R：非 TTY 被动帮助、菜单 Ctrl+C/EOF、退出观察不取消 |
| A04 | partial | C：无关 IPC 服务/普通文件不接管、不删；实时库锁拒绝导入。OS PID 复用未单独注入 |
| A05 | partial | C/R：status/stop、托管进程关闭、外部服务保留；更广无关系统进程场景未逐项注入 |
| A06 | passed | R/T：真实发现/路径/版本、保存草稿与连接 |
| A07 | partial | R/T：指定实际可用绝对路径；所有不存在/不可执行路径组合未逐一 PTY 演练 |
| A08 | passed | C/O：原位导入，保留身份、历史、unknown 与原有用户权限 |
| A09 | partial | S：缺凭据/损坏导入无写入，修复可重试；全部取消点/不支持版本未逐一演练 |
| A10 | passed | C/R/S：版本冲突、局部编辑、停用、历史与旧未知资源保留 |
| A11 | passed | C/R：默认目标、停用拒绝新任务、无静默切换 |
| A12 | passed | C/O：规范目录别名拒绝，缺原生绑定仍保守保留历史资源 |
| A13 | partial | R/C：分层只读元数据与无模型调用；所有真实认证/安装错误组合未穷举 |
| A14 | passed | C：配置或继承模型改变后证据过期，只读核验不增加 Prompt |
| A15 | passed | 原生契约/R：deny-all 随机标记、工具和文件改动 0 |
| A16 | partial | C/I02：明确拒绝与不确定结果保留语义；本轮未制造新的真实 Provider 故障 |
| A17 | passed | C/R：多维状态、停用/离线/忙碌/等待/unknown 显示 |
| A18 | partial | C/R：无关/失败 IPC 与原生等待查询故障处理；所有 Hub 故障与观察组合未穷举 |
| A19 | passed | R/I02：同终端真实分析、修改与测试，旧命令回归 |
| A20 | passed | C/R/I01：同键去重、请求查询、冲突拒绝；观察不重投 |
| A21 | passed | C/R/O：同资源串行，unknown 不因换 ID/停用/别名解除 |
| A22 | passed | C/R：并发 CLI、查询无写入、其他连接局部修改不打断原任务 |
| A23 | passed | R：真实 edit 一次允许与拒绝；收据与任务终态区分 |
| A24 | passed | C/I01：跨任务与越权拒绝、同/不同 operationId 并发、响应丢失无补写 |
| A25 | partial | R/C：真实必填文本填答、离线无效答案拒绝；模型自主表单和其他真实字段类型未验证 |
| A26 | partial | C/R：回复响应丢失、原生服务中断；确认前等待自然消失的全部竞态未覆盖 |
| A27 | passed | T/R：退出重返、后台存活，无额外任务/Prompt |
| A28 | partial | C/R：正常重启和原生故障后 unknown/历史保留；后台 SIGKILL 后托管子进程完整恢复属 I03B |
| A29 | partial | S/C：只读目录保存失败、旧版本完整、修复与 revision 冲突；原子 rename 瞬间强杀未注入 |
| A30 | partial | C/O/I01：目录/socket 权限、Hub/Edge 身份与 owner/allowlist；第二 OS 用户 IPC 实测未执行 |
| A31 | passed | C/R：已知凭据对日志/摘要/终端/产物扫描未命中 |
| A32 | passed | R/C：两真实目录各自受限验证；忙碌时另一连接局部修改不重启 Edge |

## 5. 实际边界与后续需求

1. 表单由真实原生 API 创建，只证明终端填答与单次回复链路。模型自主产生表单并继续完成任务未验证；其他字段类型不据离线 schema 宣称真实兼容。
2. 真实拒绝已确认且无文件改变，但 OpenCode 2.0.24 可能在工具拒绝后仍保持 running。本轮观察超时后退出观察，未取消、未补发，未伪造失败终态。
3. 无工具执行验证仅在已核验的 OpenCode 2.0.24 契约下开放；不同版本保留阻断，需重新核验。
4. 本次 I03A 初始验收中每个新需求创建新原生会话。连续会话、取消、只读对账及恢复已由 I03B 交付，详见最终报告；主 Agent 委派属 I05；浏览器/看板仍延期。
5. 资源占位限同一 Hub 的 Bridge 派发；不同 `--dir` 是独立实例，原生 CLI 自行执行也不受 Bridge 资源锁约束。固定项目目录不构成新增文件系统沙箱。

用户人工验收可从 `agentbridge` 的首次向导开始，依次检查连接、触发真实验证、提交只读任务、提交修改任务并仅允许本次、退出再进入查看记录。当前遇到 unknown 可从 I03B 会话菜单选择只读对账；只有原轮证据充分才恢复状态与释放资源。
