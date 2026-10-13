# M03 机器与 Agent 网络测试报告

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
