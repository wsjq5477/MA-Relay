# M03 机器与 Agent 网络测试报告

## alpha.19 OpenCode 二次发现与 Windows 配置专项

WSL Ubuntu / Node 22.23.1：discovery 3/3（含于核心 45/45），桌面 181/181；受控回归、模型 0。[核心 TAP](../../../artifacts/opencode-discovery/2026-10-14/root-tests.tap)、[桌面 TAP](../../../artifacts/opencode-discovery/2026-10-14/desktop-tests.tap)。Windows 原始报告 UTC 2026-10-14T17:35:28.789Z / Electron Node 24.21.0：真实 PE 版本/解析、旧二次发现失败、修复后原路径核验、配置完整写入与旧revision拒绝、serve受控退出保留NATIVE_EXITED、删除原安装，共6组通过，[实际报告](../../../artifacts/opencode-discovery/2026-10-14/windows.json)。这是隔离PE/进程夹具，无真实OpenCode模型或用户另一台电脑验收。原生Windows完整生命周期和断电持久性未验证。根因、失败原证据、最终包与边界见 [专项](../../iterations/I06/opencode-discovery.md)。

## alpha.19 Linux CLI 发现专项

2026-10-14 / WSL Ubuntu / Node 22.23.1：发现回归 6/6；精简 PATH 下真实 Codex CLI 0.162.1 经生产 daemon/relay、本机隔离 TCP SSH 发现通过，重复规范路径不变，模型 0。受控 SSH 端点与真实 CLI 版本探测分别标明，不计作用户独立服务器升级验收。[发现 TAP](../../../artifacts/linux-cli-discovery/2026-10-14/discovery.tap)、[实际 CLI/SSH 报告](../../../artifacts/linux-cli-discovery/2026-10-14/real-cli-ssh.json)。全工程/包/Windows 实际结果与未测范围见 [专项](../../iterations/I06/linux-cli-discovery.md)，原模型/权限/续聊限制保留。

## alpha.18 历史专项

2026-10-14 / WSL Ubuntu / Node 22.23.1 / 源码 0.6.0-alpha.18：共享缓存自引用/旧清单/损坏旁路重建、Windows OpenCode 原意图恢复与并发保护、查询结果和脱敏原因；定向 55/55（计入桌面全量 176/176），根 43/43，lint/类型/构建通过。受控文件/宿主测试，无模型调用。原始证据：[定向](../../../artifacts/runtime-recovery/2026-10-14/targeted.tap)、[全桌面](../../../artifacts/runtime-recovery/2026-10-14/desktop-tests.tap)。Windows 真实 Electron 资源 4 组、Edge 受控 UI 3 组、普通无调试 EXE/合成原意图与关闭重开 4 组均通过；包校验 28 CJS / 1383 Linux 文件与当前源码匹配。详细过程及边界按 [完整专项](../../iterations/I06/runtime-recovery.md) 的实际结果判定，不将历史原生证据提升为本次重测。


历史基线：2026-10-14 / 0.6.0-alpha.13。工程与受控维护验证通过，独立服务器/最终程序专项按 [I06C 收尾](../../iterations/I06/final-delivery.md) 实际状态记录；旧版本段落保持原日期。
核对日期：2026-10-12。对应 [功能设计](design.md)。结论：本机/WSL 的目录、节点、路由、占用已验证；SSH 远端目录纳入源码及开发环境真实验证，alpha.2 主要 Windows/SSH 验收保留；当前 alpha.5 的受控状态回归及包验证单列。

## 1. 本报告证据范围

早期核对读取保存的 43/87 历史日志，未新增模型调用；alpha.6 本次实际重跑核心 43/43、桌面 110/110，并有独立 SSH 原生链，均无失败或跳过；各模块会共享这些案例，不能把模块引用数量相加当成项目测试总数。

- 受控后台/存储测试：[root-tests.tap](../../../artifacts/docs-baseline/2026-10-12/root-tests.tap)、[desktop-tests.tap](../../../artifacts/docs-baseline/2026-10-12/desktop-tests.tap)。
- 真实 Windows/WSL 节点及 EXE：[I05-real.json](../../../artifacts/I05-real.json)、[I05-portable.json](../../../artifacts/I05-portable.json)。
- 隔离界面：[I05-ui.json](../../../artifacts/I05-ui.json)，该界面测试使用 mock 数据，不证明模型回复。
- 真实独立 Linux 开发链路：[I06A 证据说明](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.md)、[原始 JSON](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.json)。

“通过”只覆盖表中明确环境和断言。版本探测成功不能代替模型可用测试。

## 2. 功能与案例映射

| 案例 ID | 对应功能 | 真实测试文件 / 名称 | 结果及证据层级 |
| --- | --- | --- | --- |
| T-M03-01 | M03-F01 / F02 | `machine-router.test.cjs`：`empty machines exist before instances and connecting a tool does not ask for a project` | 通过；受控宿主，证明空机器与无目录接入 |
| T-M03-02 | M03-F02 | `tool-discovery.test.cjs`：`prefixed native versions are recognized and a broken earlier installation does not hide a working tool` | 通过；受控可执行文件 |
| T-M03-03 | M03-F03 | `agent-network.test.cjs`：`nodes are machine/tool identities without workspace or model; all adapters on the same machine survive rescan` | 通过；受控快照，节点无模型/目录属性 |
| T-M03-04 | M03-F03 / F04 | `agent-network.test.cjs`：`a native context retains its authoritative node when the backend reports a resolved launcher path` | 通过；启动路径解析后续聊仍归原节点 |
| T-M03-05 | M03-F04 | `agent-network.test.cjs`：`node submission uses an independent context, inherits native settings, preserves old model bindings, deduplicates retries` | 通过；旧模型实例保留，新节点拒绝覆盖 |
| T-M03-06 | M03-F05 / F07 | `machine-router.test.cjs`：`imports old instances and history with stable machine IDs without rewriting raw or native IDs` | 通过；受控历史导入 |
| T-M03-07 | M03-F05 | `machine-router.test.cjs`：`same raw IDs route tasks, conversations, requests, replies and operations to their source machine` | 通过；相同 raw ID 不跨机串读 |
| T-M03-08 | M03-F05 / F06 | `machine-router.test.cjs`：`keeps Windows paths native and maps only the selected WSL distribution`；`SSH filesystem paths never alias local Windows or WSL drives` | 通过；路径单元断言 |
| T-M03-09 | M03-F06 | `machine-router.test.cjs`：`shared Windows and WSL projects reject new work while either instance is busy`；`shared occupancy includes an active instance outside the first 100 displayed tasks` | 通过；全量占用及共享盘互斥 |
| T-M03-10 | M03-F06 | `machine-router.test.cjs`：`reopening with an offline shared source retains occupancy but independent projects still run` | 通过；离线占用保留、独立项目继续 |
| T-M03-11 | M03-F06 | `machine-router.test.cjs`：`a never-ending WSL snapshot times out without blocking Windows or spawning repeated jobs` | 通过；受控卡死与快照超时 |
| T-M03-12 | M03-F01 / F02 / F03 | `windows-i05-real.cjs`、`windows-i05-portable.cjs`；原始 I05 报告 | 通过；真实 2 环境 / 4 节点，普通 EXE 重开身份不变 |
| T-M03-13 | M03-F01 / F02 / F05 | `.agentbridge-dev/e2e-i06a.cjs` 与 `verify-reconnect.cjs`；原始 I06A 报告 | 部分完成；真实独立 Linux 发现 OpenCode、重连原机器，接入端是 WSL 开发机 |

测试代码入口：[机器目录测试](../../../desktop/tests/machine-router.test.cjs)、[节点测试](../../../desktop/tests/agent-network.test.cjs)、[发现测试](../../../desktop/tests/tool-discovery.test.cjs)。表中的受控测试通过状态可在桌面 TAP 中按原名称定位。

## 3. 真实环境结果

| 环境 | 观察到的结果 | 能证明什么 |
| --- | --- | --- |
| Windows | Claude Code 2.1.296、Codex 0.145.0 自动发现 | 同机多种安装可见 |
| 本机 WSL | OpenCode 2.0.24、Codex 0.161.0 自动发现 | WSL 作为单独执行环境，不是第二台物理电脑 |
| Windows 0.5.0 EXE | 普通启动、重开保留 4 个节点及已有历史 | 已发布包的本机/WSL 目录持久化 |
| 独立 Linux | OpenCode 2.0.26 被发现、接入，重连沿用 machineId | 源码开发环境 SSH 节点链路已运行 |

I05 的真实节点与推理结果来自 2026-10-10 的报告；本次未重新查询各工具是否升级，不能把报告版本当成此刻的安装版本。

## 4. 部分、未测及原生限制

| 项目 | 判定 | 后续需要的证据 |
| --- | --- | --- |
| Windows Codex 原生推理 | 未通过；账号拒绝其默认模型 | 用户在原工具中修复可用性后，以原配置重新验证 |
| WSL Codex 同会话续聊 | 未通过；原生 `list_turns` 不支持 | 原工具提供能力后验证，不能新建会话冒充续聊 |
| Windows SSH 机器接入 | alpha.2 主要接入验收及 alpha.6 独立 SSH 协作通过 | 真实包、Linux 工具与原任务恢复证据单列 |
| 安装路径任意移动/所有别名合并 | 未完整验证 | 多启动器、删除重装、路径迁移的真实回归 |
| 拖拽节点图 | alpha.6 实现与主要验收通过 | 独立布局与状态分层；见 T-M03-15 |
| 多协作组 | 未实现、不在 I06B 范围 | 当前仍为单默认组/单层 |

发现状态与模型能力分别呈现：机器在线、工具 healthy、节点 connected 仍可能产生真实任务失败；保留该失败就是正确行为。

## 5. 复现与维护要求

受控回归使用 `npm test --prefix desktop`，针对测试文件可使用 Node 的 test runner；根核心回归使用 `npm test`。需要先按仓库开发说明准备 Node 22.13+ 及依赖。

真实脚本必须使用隔离 profile，并由操作者明确选择目标环境；它们可能产生模型调用。不能复用日常未确认任务 ID 来验证重试。

新增机器类型、身份规则、路径映射或占用处理时，保留旧案例 ID，增加对应功能的反例，并同步 [整体设计](design.md) 与迭代报告。重新执行后记录日期、源码/产物版本、环境、原始日志，不能只把“预计通过”替换为“通过”。

## 当前 6A 候选验收结果

2026-10-12 / 0.6.0-alpha.2：[真实 Windows 窗口](../../../artifacts/I06A-real/report.json)与[普通便携程序](../../../artifacts/I06A-final/portable.json)均通过。两轮保持同一 Conversation/native Session，关闭窗口保留同一后台，明确停止后新 PID 保留身份/机器/历史，恢复只查询原任务；普通程序请求数不增加。专项覆盖边界见 [6A 候选验收](../../iterations/I06/acceptance.md)。

2026-10-12 / alpha.4：使用用户原 SSH 连接与 owner/profile，实际握手及 OpenCode 重新发现、原 daemon 身份和 PID 核对通过，[报告](../../../artifacts/ssh-compatibility/2026-10-12/remote-connect.json)。沿用原机器，不另建 profile 或节点，不提交模型需求。仅是原服务器样本，不扩大为所有版本迁移或跨设备协作验收。


## 当前 alpha.5 恢复错误清理验证

T-M03-14 / M03-F01/F07：2026-10-12 / alpha.5，新增 2 项受控状态回归、全桌面 95/95，通过。旧版本报错在恢复成功后撤销并持久化，旧目录成功快照不继承错误，新的 RPC/主机密钥错误仍显示；原连接/接入节点/任务历史保持。Windows 当前前端的受控快照卡片渲染 2 项通过。原用户状态只读核验，不是新包实际远端重连或模型验收。[本次测试与范围](../../iterations/I06/ssh-error-recovery.md)、[TAP](../../../artifacts/ssh-error-clear/2026-10-12/desktop-tests.tap)、[UI](../../../artifacts/ssh-error-clear/2026-10-12/ui.json)。

## I06B 当前验证入口

2026-10-12 / 0.6.0-alpha.6：T-M03-15 / M03-F01/F02：图坐标不改机器/node 身份；成功同步时刻、unknown/等待/失败分层；原 unknown 仍不可执行。本次代码、命令、逐项结果与限制汇总于 [I06B 实施](../../iterations/I06/graph-implementation.md)。受控工程结果见 [桌面 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)、[核心 TAP](../../../artifacts/I06B/2026-10-12/root-tests.tap)，界面见 [UI](../../../artifacts/I06B/2026-10-12/ui.json)、[性能](../../../artifacts/I06B/2026-10-12/performance.json)，本次核心 43/43、桌面 110/110、Windows 图 10 组通过；性能 p95 30.0ms。独立 SSH 双向原生链、普通无 debug EXE 及源/包完整性分别通过，原始证据与范围见当次报告。历史表保留原日期/版本，不计为本次重新运行。


T-M03-16 / M03-F04：2026-10-12 / alpha.6，受控 OpenCode 后台首次快照不健康、下一次健康，context 只执行 connect/snapshot/snapshot，期间原生 Prompt=0；通过。[测试](../../../desktop/tests/machine-host-readiness.test.cjs)、[本次 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)。10 秒等待上限是实现合约，完整慢启动/账号不可用真实环境覆盖见 I06B/后续 I06C。

## alpha.9 当前节点管理专项

T-M03-17 / M03-F02/F03/F05/F06/F07：2026-10-13 / 0.6.0-alpha.9。范围：显式断开/移除不被原生连接或扫描反转，身份/历史保留、全实例 busy、unknown、并发与落盘失败、原 IPC 提交二次归属检查。逐项实际结果、环境、脚本、原始证据与未测范围见 [节点管理完整验收](../../iterations/I06/node-management.md)。工程证据为本次 [桌面 TAP](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)；窗口/程序/包状态以该报告实际结果为准，历史表不充当本次重测。原生 SSH/模型链保留 alpha.6 历史结果，本次未重跑、不改用户 profile、不提交 Prompt。

## I06C alpha.10 当前专项

T-M03-18 / M03-F03/F05/F06/F07：2026-10-13。范围：机器移除是 removedMachines 中央可见性状态，不删除机器、节点、实例或布局；原节点新增准入检查机器移除/变更锁。移除同时撤销相关主/子授权，恢复原 machineId/nodeId 但不恢复授权。machine-history.json 私有保存已观察历史，合并后续分页；离线/移除/重开可读 historical 任务/会话，原任务/控制收据仍回原来源，历史非终态保持 unknown。 本次实际工程、隔离 TCP SSH、Windows 界面/包与未测项见 [6C 首批验收](../../iterations/I06/machine-management.md)；[桌面 TAP](../../../artifacts/I06C/2026-10-13/desktop-tests.tap)和当次报告是当前证据，alpha.6 双向真实 Agent 链保留原日期/版本。未改用户 profile、未升级用户 daemon、无真实模型任务，不将首批标为完整 I06C。

## alpha.13 当前验证

T-M03-19 / M03-F03/F05/F06/F07：2026-10-14，WSL Ubuntu / Node 22.23.1，桌面受控回归 **150/150** 通过（全工程总数，模块之间不重复相加）。场景：维护未知期间，所属机器的新执行和节点编辑被中央与原生准入双重阻断；其他机器原有会话可继续。卸载的原远端收据 confirmed 后按原 machineId 完成中央移除、撤销新协作权限及隐藏图节点，保留机器/节点/会话/任务历史。断开、停止、卸载不等于取消原任务，不以名字或地址别名释放未知占位。

证据：[完整桌面 TAP](../../../artifacts/I06C-final/2026-10-14/desktop-alpha13.tap)、[维护实际 daemon/process 7 项](../../../artifacts/I06C-final/2026-10-13/maintenance-tests.tap)、[包内容核验](../../../artifacts/I06C-final/2026-10-14/package-alpha13.json)。维护测试使用真实生产 daemon、Unix socket、独立进程和磁盘，原生 host 受控、无模型调用；不能替代独立服务器或真实原生控制。Windows 窗口、原生 Session 与双向链、使用/卸载、命令和限制统一见 [逐项验收](../../iterations/I06/final-delivery.md)，未实际执行项不得计为通过。

## alpha.13 本次独立实机补充

2026-10-14：冻结 alpha.13 Windows 包与独立 Linux，真实升级、同原生 Session 两轮及两方向协作通过；真实 Windows 取消和普通无调试窗口原生标记分别通过。独立 SSH/生产 daemon 的精确响应丢失、10 同 ID 与重启为受控执行器证据，不充当真实模型。Linux 文件任务受原生 OOM 退出影响，原 ID/Session 与 unknown 占位保留，未准出、未重发；后续 alpha.14 上传专项不冒充此模型矩阵复测。逐场景原始证据、版本、实际失败、临时自有资源调度及剩余项见 [I06C 当前实机记录](../../iterations/I06/final-delivery.md)。

本专项工程补验：桌面 181/181、核心基线 43/43、lint/类型/构建通过；包内私有 Linux Node 的真实 CLI 版本探测复验通过，Windows EXE 已构建并核对资源，详见上述专项“实际验证”。不计为用户服务器升级或模型任务验收。

2026-10-15 alpha.19 合并包复验：核心45/45、桌面181/181、lint/类型/构建通过；发布资源真实 Linux Codex0.162.1发现、Windows受控扫描/配置6组、普通EXE4组通过。最终包摘要和未测边界统一见 [Linux/合并包专项](../../iterations/I06/linux-cli-discovery.md)；未实测用户服务器或真实模型任务。


## 未确认操作资源范围专项（源码修复，未发布）

T-M03-20 / M03-F04/F06：2026-10-15 / WSL Ubuntu Node22.23.1 / alpha.19工作区修复。同机器独立节点可执行；同节点改 ID/目录和跨节点 Windows/WSL 共享目录被拒绝；原身份不迁移。 定向40/40计入全桌面188/188，类型与前端构建通过；Windows Edge生产前端/受控API共4组通过，模型0。原始证据和复现见[当次专项](../../iterations/I06/pending-isolation.md)。未构建新EXE、未访问用户故障profile或独立服务器，不替代真实原生任务验收。

alpha.20候选追加验证（2026-10-15）：Windows普通无调试EXE/隔离合成配置拒绝恢复及关闭重开4组通过；最终生产前端/Windows Edge受控4组通过，模型0。包内源码匹配，原始证据统一见[专项](../../iterations/I06/pending-isolation.md)。这不改变上一段源码阶段“未构建EXE”的历史边界。

alpha.20已公开预发布：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/AgentBridge-0.6.0-alpha.20-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.20)。分发元数据和完整EXE下载摘要核验通过，源码标签9b2d5ea；不将分发成功扩大为用户故障或真实模型验收。[发布及证据](../../iterations/I06/pending-isolation.md)。
