# AgentBridge 迭代计划

2026-10-10 当前状态：I05A / I05B 已交付 Windows 0.5.0，节点、真实协作与原生工具限制见 [I05 验收](../../iterations/I05/acceptance.md)。**I06：Windows 独立中央后台 + Linux 常驻 daemon + SSH 用户名/密码或密钥接入 + 拖拽端点节点图**，需求、设计、开发/验收安排已落盘；DEV-A01–A06 产品代码已实现（版本 0.6.0-alpha.1），并于 2026-10-10 在操作者提供的真实物理 Linux（Alibaba Cloud Linux 3 x86_64 + OpenCode/DeepSeek，链路 RTT≈275ms/丢包≈20%）完成 SSH 接入核心闭环的真实验证：自动安装 128MB 离线包并启动 daemon（77.8s）、远端节点发现与接入、真实模型新会话与同 Session 续聊、断开 SSH 期间远端任务继续执行、Coordinator 重启自动重连并零重发读取原收据。修复缺陷与证据见 [I06 开发记录](../../iterations/I06/development.md) 第 9 节。**尚未完成**：Windows 侧 EXE/UI 真实验收（含密码分支）、节点图（I06B）、恢复/升级/打包（I06C）、`machine.updateSsh`/`machine.remove`。目标版本 0.6.0，现有可运行包仍是 0.5.0。

当前执行入口：[I06 总计划](../../iterations/I06/proposal.md)、[需求](../../iterations/I06/requirements.md)、[SSH / 后台设计](../../iterations/I06/ssh-design.md)、[节点图设计](../../iterations/I06/graph-design.md)、[开发安排](../../iterations/I06/development.md)、[测试与验收](../../iterations/I06/testing.md)。

| 下一迭代增量 | 交付功能 | 可验收出口 |
| --- | --- | --- |
| I06A：连接与后台 | 独立 Coordinator、SSH 认证/指纹、用户态安装/复用 daemon、稳定机器节点、远端直接任务与续聊 | 接入独立 Linux；无第二终端；关闭窗口/SSH 不杀远端任务；真实新会话和原 Session 续聊 |
| I06B：图与真实协作 | 机器分组节点画布、拖动/端点连线、修订与授权、任意机器选主、双向 MCP 回调 | 图操作保存到后台；Windows主→Linux子及Linux主→Windows子两条真实闭环；越权成功数为0 |
| I06C：恢复与交付 | 去重/故障对账、原生控制、迁移/升级/回滚、Linux包和最终Windows EXE | 10次同ID执行1次；未知Prompt重放0；历史错配/丢失0；最终包真实验收通过 |

I06 不引入机器接入码或设备 Token 配置，不绑定项目/模型/供应商，不做文件同步或公网穿透。中央默认只在 Windows 用户态独立运行，连接方向为 Windows 主动 SSH 到 Linux；后续云端中央部署和原计划 Webhook/通用外部入口作为 I06 后候选，尚未纳入本轮。

以下日期记录和 I01 细节保留为历史。若旧“项目实例作为Agent”、主Agent默认OpenCode、I06外部入口或Token/WebSocket远端接入与顶部/I06文档冲突，以最新需求为准，不追改历史验收结论。

日期：2026-10-09  
已确定：迭代 1 使用 CLI 验收；真实 OpenCode 接入完成后增加看板迭代。  
当前状态：I01 已通过 Linux/WSL 本地自动验收；I02 已实现并通过本机真实 OpenCode 验收；I03A 已实现并通过工程检查和真实 CLI 核心验收，待用户复核。交付证据见 [I01 开发记录](../../iterations/I01/development.md)、[I02 测试记录](../../iterations/I02/testing.md)、[I03A 交付报告](../../iterations/I03A/report.md)。I03A 体验修正及 I03B 的 B01–B06 已完成开发和本轮验收，完整证据见 [迭代三最终报告](../../iterations/I03B/report.md)。I04 Windows 桌面看板已实现并通过本机真实验收，见 [交付报告](../../iterations/I04/report.md)。I04B 已交付 Windows 0.4.1 便携程序，支持机器分层与 Windows Claude/WSL OpenCode 同时接入；真实两轮/历史、Claude 修改审批/取消、普通 Windows 窗口及工程/UI 合约均通过。[需求](../../iterations/I04B/requirements.md)、[设计](../../iterations/I04B/design.md)、[测试记录](../../iterations/I04B/testing.md)及[交付记录](../../iterations/I04B/report.md)已同步；14.1ms 是 20 次预热 RPC 聚合耗时，端到端界面 p95 未实测。本段记录2026-10-09时点；I05与I06当前状态以本文件顶部为准。

2026-10-08 用户已确认[迭代 2 范围](../../iterations/I02/proposal.md)并批准开发：基础 OpenCode 接入与人工可使用入口提前到 I02，深入可靠性与控制放到 I03。以下顺序已同步该选择。

2026-10-08 用户最新要求：当前继续 CLI，先不考虑浏览器。[交互与主 Agent 方案](../../interaction-plan.md)和 I03A 已收回到终端向导、Agent 列表、后台运行及同终端使用；浏览器暂缓。OpenCode 仍为首版默认执行工具及未来主 Agent 候选。I03A 的[八项需求](../../iterations/I03A/requirements.md)、[模块设计](../../iterations/I03A/design.md)、[开发计划](../../iterations/I03A/development.md)和[测试计划](../../iterations/I03A/testing.md)按此维护，用户已批准开发；CLI 功能已实现，验收与限制见 [I03A 交付报告](../../iterations/I03A/report.md)，待用户签收。

## 1. 迭代划分

主线按 I01–I06 组织，I03、I05和I06拆成可验收增量。I01–I03 使用CLI，I04起提供Windows桌面；I04B–I04G保留机器/实例与可靠性修复的历史记录。I05采用“机器 → Agent工具节点 → 会话/任务”，I06接入其他物理设备并用节点图配置授权。Windows与WSL仍标明同一宿主。I03范围见 [I03A需求](../../iterations/I03A/requirements.md)和 [I03B需求](../../iterations/I03B/requirements.md)；当前下一迭代以 [I06需求](../../iterations/I06/requirements.md)为准。

[I03B 迭代提案](../../iterations/I03B/proposal.md)按原实现基线拆成六项交付与三个开发增量。用户要求迭代三全部完成，B01–B06 已全部实施，40 项工程回归和真实 OpenCode 验收通过；需求、模块设计、开发、测试及最终交付报告见 I03B 目录。核心为连续会话、主动取消、连接重连/事件补传、原执行只读对账和后台异常后的托管身份核对；恢复不自动重发原生 Prompt。

| 迭代 | 交付目标 | 主要交付功能 | 阶段验收条件 |
| --- | --- | --- | --- |
| I01：基础任务闭环 | 用户能够通过 CLI 使用连接到 Hub 的 Mock Agent | 项目启动配置、Edge 注册、Agent 查询、指定在线 Agent 提交任务、状态/结果查询、基础身份校验、任务持久化 | 独立 Hub/Edge 进程完成真实通信；成功/失败结果准确；重启保留历史；不明任务不自动重跑 |
| I02：真实 OpenCode 可用闭环 | 用户通过 CLI 在固定项目中调用一个真实 Agent | 配置检查、真实提交、可读观察、修改与测试、原生等待处理、组合启动、历史和异常保护 | 真实分析、修改与工具测试通过；等待可处理；重复请求只执行一次；重启保存结果；不明执行不自动重跑 |
| I03A：CLI 首次配置与使用 | 同一终端完成本机配置、连接查看和真实单次任务 | 后台启动、终端向导/导入、分层检查/验证、Agent 列表与默认目标、任务观察、同终端权限/输入回复 | 空配置接入真实 OpenCode；额外必需终端 0；真实任务与等待回复；重返不重投；保留未知占位 |
| I03B：持续使用与完整恢复控制 | 会话与任务在中断和持续使用下可管理 | 原生会话续接、自动重连、完整重传/对账、故障恢复、统一控制协议、取消与中断 | 恢复场景无重复执行；会话关联正确；控制请求与实际效果分开确认 |
| I04：Windows 桌面看板 | 同一 Windows 窗口连接、执行、查看和管理 Agent | 自动发现/连接、总览、状态分栏、筛选、详情、连续会话、权限/输入、取消、深浅主题、便携程序 | 实际 Windows 窗口；真实 WSL OpenCode；UI/CLI 一致；重返不重投；20 次刷新 p95 ≤2s |
| I04B：机器分层与双工具接入 | 同一窗口同时使用 Windows Claude 与 WSL OpenCode，所有记录来源清楚 | 持久机器清单、机器内工具连接、项目实例、旧连接迁移、多机器聚合及来源路由、Windows Claude 文本/续问/取消/历史、能力差异说明 | 机器先于实例出现；发现不调用模型；双机各真实两轮；同 ID 隔离；迁移历史无丢失；单边故障另一边正常；切换视图不停止任务 |
| I05：机器节点与真实协作，已交付 | 用户指定机器上的主Agent与子工具节点，真实发现/委派/读取结果 | 节点独立于项目/模型，Windows/WSL多工具，主从allowlist、MCP与父子记录、原生Claude/OpenCode/Codex接入 | 0.5.0核心四条协作链通过；Codex账号/续聊限制单列；不含其他物理机器接入 |
| I06：SSH跨设备与节点图，计划 | 一个Windows窗口连接独立Linux，拖端点授权并真实双向协作 | 常驻中央/daemon、SSH密码密钥agent、用户态安装、来源与版本、节点图、故障去重/对账、Linux包与EXE | I06A/B/C逐增量；真实Windows↔远端Linux闭环；未知不重放；实际安装包与环境证据 |

本轮产品主线验收范围是已交付的I01–I05与下一迭代I06，含I04B–I04G历史增量；原初稿的通用外部入口、Webhook与专用示例未因此被宣称全部完成。I01只代表基础闭环，I05的Windows/WSL仍不能代替I06真实跨设备验收。

原初稿M0/M1的基础闭环和真实接入已落实到I01/I02；CLI向导和持续恢复为I03A/B，桌面为I04及修复增量，机器节点与协作为I05。按最新用户选择，I06优先SSH跨设备与节点图，外部入口移至后续候选。I04历史需求与验收仍按实际Windows桌面范围维护。

CLI 是当前用户入口，也保留自动化与排障命令。I03A 不新增 Web 服务、前端构建或浏览器会话；终端向导与列表负责配置和连接可见性，后续看板不重复计算已交付任务接口。

## 2. 迭代 1 的交付目标

**在一台 Linux/WSL 主机上，用户启动独立的 Hub 和 Edge，通过 CLI 发现 Mock Agent、提交任务、观察执行状态、查询结果；重启后可以查询已经保存的历史任务。**

八项需求的业务规则、异常行为及逐项验收条件见 [I01 需求规格](../../iterations/I01/requirements.md)。

Mock 通过真实 Driver 调用和跨进程通信产生事件。Hub 负责注册、任务记录与转交，Edge 负责执行；成功与失败都来自 Mock 的实际测试行为。

### 2.1 交付功能

| 编号 | 功能 | 用户可以做什么 |
| --- | --- | --- |
| I01-F01 | 配置与启动 | 生成本地示例配置，在不同终端启动 Hub、Edge；错误配置得到明确提示 |
| I01-F02 | Agent 注册与查询 | Edge 用受信任凭据注册 Mock；CLI 显示 Agent ID、Adapter 类型、设备、在线/健康及忙碌状态 |
| I01-F03 | 提交任务 | 指定在线且可接单的 Agent，提交文本/stdin/file 消息，取得 Task ID；不存在、离线或忙碌目标明确拒绝 |
| I01-F04 | Mock 执行 | 运行可配置的成功、失败、延迟场景，产生真实 started/progress/output/终态事件 |
| I01-F05 | 查询与观察 | 查看任务列表、任务详情、进度摘要和最终结果；支持观察模式和 JSON 输出 |
| I01-F06 | 持久化与基础去重 | Hub 保存任务/事件/结果，Edge 保存最小执行记录；同幂等键同内容返回同任务，同执行 ID 不重复调用 Driver |
| I01-F07 | 最小访问边界 | Hub API/Edge 连接验证凭据；Connector 只能注册与回写被授权的 Agent；用户调用受 allowlist 限制；私有日志按身份限制且凭据不进入日志 |
| I01-F08 | 状态不明的处理 | 断线、进程退出或重启后无法确认执行结果时，任务持久化为 unknown 并可查询；不自动重新执行 |

默认每个 Agent 串行。I01 不接受等待 Agent 上线的离线任务，也不做复杂投递恢复；投递和执行事件保留必要持久记录，完整重传、对账与恢复属于 I03。

任务使用 queued、accepted、running、succeeded、failed、unknown；传输 ACK 不是执行完成。已保存的成功/失败终态在重启后保持原值，不能一律改 unknown。

### 2.2 可演示入口

```text
agentbridge init
agentbridge hub start
agentbridge connect
agentbridge agents
agentbridge run mock-a "测试消息"
agentbridge tasks [--watch]
agentbridge task TASK_ID [--watch] [--json]
```

交付一个本地演示入口，启动 1 个 Hub、2 个 Edge 和各自的 Mock Agent，展示指定目标执行、成功/失败结果和重启后查询。验收确认真实独立进程；这不等于跨物理设备验证。

### 2.3 本轮涉及模块

| 模块 | I01 工作范围 |
| --- | --- |
| 配置与安全 | 本地配置、静态身份、allowlist、日志权限/脱敏；明文连接须显式开启且仅限回环开发 |
| Core 与协议 | 任务/Agent/Conversation 基础类型、状态规则、消息校验、基础 ACK |
| Storage | Hub SQLite、Edge 最小执行台账、幂等与执行记录唯一约束 |
| Hub | 注册/查询、接单与转交、事件落库、基础心跳下线、启动扫描不明执行 |
| Edge | 主动连接、注册、接任务、调用 Driver、事件回传、执行边界持久记录 |
| Mock Adapter | 健康与能力声明、成功/失败/延迟及有序事件；明确标记测试 Agent |
| CLI | 上述命令、stdin/file、文本/JSON、观察和可识别的错误输出 |

模块细节、接口、表结构和逐条开发任务不在本次展开；迭代范围确认后，再围绕选定需求建立相应文档。

## 3. 迭代 1 的验收指标

以下为 I01 的验收目标，现已通过同一主机的独立进程、临时数据库和确定性 Mock 场景验证。实际结果见 [测试说明](../../iterations/I01/testing.md)与[验收报告](../../../artifacts/I01-acceptance.json)，不据此宣称其他系统或真实 Agent 已通过。

| 指标 | 验收目标 | 证据 |
| --- | --- | --- |
| 正确路由与成功结果 | 两个 Edge 各提交 10 个成功任务，共 20 个；20/20 在指定 Agent 执行且结果一致 | CLI 输出、任务记录、各 Mock 的持久调用计数 |
| 失败结果真实性 | 两个 Edge 各提交 5 个失败任务，共 10 个；10/10 为 failed 且错误可查询 | 任务状态、原始 Mock 事件和错误记录 |
| 重复提交与投递 | 同幂等键同内容重复提交 10 次，返回唯一 Task ID；同一执行重复投递的调用次数为 1 | Task 行数与 Mock 调用计数；不同内容使用同键返回冲突 |
| 历史持久化 | 上述 30 个已完成任务重启 Hub 后，任务、结果/错误及事件丢失数为 0 | 重启前后数据库及 CLI 查询对比 |
| 执行不明时的安全性 | 运行中分别终止 Hub/Edge，重启后同任务的自动重跑次数为 0；unknown 可从数据库及 CLI 看到 | 故障点前后调用计数、执行记录与查询输出 |
| 权限与状态边界 | 未授权任务/注册/事件写入为 0；非法状态转换写入为 0；已确认终态被覆盖次数为 0 | 拒绝响应、数据库核对与日志 |
| 文档与工程检查 | 本地演示可从空数据目录复现；lint/typecheck/test/build 全部通过；无阻断交付功能的未关闭缺陷 | 实际运行命令、演示和检查报告 |

执行次数用持久化 Mock 调用记录核对，不能仅检查最终 status。性能延迟先记录观测值；I01 不承诺吞吐量或响应时间 SLA。

## 4. I01 明确延期的功能

- 真实 OpenCode 基础接入、可读 CLI、原生等待操作入口：I02。
- 终端首次向导、后台入口、Agent 列表、同终端提交与原生等待回复：I03A。
- 自动重连、完整重传/对账与执行恢复：I03B；离线排队按后续需求决定。
- 原生会话续接、统一控制、取消与中断：I03B。
- Windows 桌面看板：I04 已交付；I04B 补齐机器分层与 Windows Claude 原生宿主，和 WSL OpenCode 同时接入；其他 Windows 原生工具仍需专门适配。
- Windows/WSL机器工具节点、MCP受限主从委派：I05已交付；原生工具未通过项见I05报告。
- 独立Windows中央后台、Linux常驻daemon、SSH跨设备、节点图、恢复和安装包：I06计划。
- Harmes/自研Agent专用接入、通用JSONL/HTTP示例、Webhook/企业IM、云端中央部署、多用户团队：I06之后候选，另行确定范围。

跨主机传输必须加密并验证服务端身份。I06通过SSH加密与主机密钥校验实现；不另要求SSH内再配置TLS或用户机器Token。后续外部HTTP/WSS部署仍需TLS等相应认证。I01回环演示不作为远端或Windows兼容证据。

## 5. 已记录的选择与后续工作

用户已确定 I01 使用 CLI 验收，并在真实 OpenCode 接入后的阶段增加看板。本计划据此安排六个迭代；I01 的功能和验收指标保持上述范围。

用户已批准 I01 和 I02 开发。I01-F01–F08 已通过原有验收；I02 的六项需求与逐项证据在专属文档维护，不以离线合约测试代替真实模型执行。

用户已要求当前继续 CLI。I03A 八项需求及模块设计、开发/测试计划已改为 CLI 范围，已批准并实施；I03A 体验修正与 I03B 已按 [最终报告](../../iterations/I03B/report.md)验收，浏览器计划暂缓。

先前的 `module-plan.md` 与 `development-backlog.md` 保留为全量技术参考；迭代执行范围以本文件、I01 需求规格及确认后的单点设计为准。

2026-10-09 用户已要求开发前端看板并交付 Windows 程序，参考 CC Switch 最新主题。I04 按 M1 连接入口、M2 看板会话、M3 控制交付三个增量执行；验收以实际 Windows 窗口和真实 OpenCode 为准，记录见 [I04 报告](../../iterations/I04/report.md)。

2026-10-09 用户确认 I04B 目标为“同时对接这台 Windows 机器的 Claude，与 WSL 机器的 OpenCode”。本轮按 B1 机器/工具/迁移、B2 双机实例/来源路由/聚合看板、B3 原生使用/故障隔离/交付三个可验收增量实施。连接工具与创建项目实例分开，默认继承原生登录/模型；不新增 API Key 配置向导，不自动放宽 Claude 权限。权限交互等工具差异按实际协议能力呈现，不支持项单列。本轮不含远程外网机器、主 Agent 调度和会话跨工具迁移。

I04B 已完成本轮功能交付及实际 Windows 便携程序普通启动。模型保持默认继承，另支持可选每实例覆盖；用户原全局 GLM-5.1/exo-free 配置未改动，其供应商授权/模型下线问题不能因验收成功宣称已消除。真实验收仅在隔离实例选择可用模型。工程与实际范围、Mock 截图来源、未重新测量的端到端界面 p95 及 OpenCode 本轮未复跑的文件/权限场景均在 [交付记录](../../iterations/I04B/report.md)明确保留。
