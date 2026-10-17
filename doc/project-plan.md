# 迭代路线与当前交付

## 当前修复交付

alpha.28：issue #5远端持久拒绝只读恢复；GitHub已预发布alpha.28，新包与普通EXE已验证分发，完整I06C/I07C未准出。[当次范围与证据](iterations/I06/daemon-rejection-recovery.md)。

更新：2026-10-17。完整功能与模块设计见 [资料入口](README.md)；这里维护交付顺序，不另建一套架构。

## 1. 当前基线

| 项目 | 状态 |
| --- | --- |
| 最近稳定 Windows 程序 | 0.5.0 / I05；机器节点与主从协作，原生限制保留 |
| 最新 Windows 预发布 | 0.6.0-alpha.28 / SSH持久拒绝恢复；标签绑定3df2534，[EXE与校验](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.28)，完整I06C/I07C未准出 |
| 当前自动回归 | 2026-10-17 / alpha.28：桌面317/317、核心45/45、Windows合成契约93/93；受控TCP SSH丢响应/daemon重启和普通无调试EXE6组通过，模型0。包与发布见[专项](iterations/I06/daemon-rejection-recovery.md)，用户现场未复测 |
| 当前源码 | alpha.28已预发布，冻结修复提交3df2534与EXE一致；只读核对原daemon持久拒绝后结算，裸错误/缺证据保持unknown。[实际结果与边界](iterations/I06/daemon-rejection-recovery.md) |
| 独立 Linux 验证 | 2026-10-12 实际 Windows 密钥安装/两轮同 native Session、密码/DPAPI、停止重开回读；既有断线存活证据保留 |
| alpha.24历史自动回归 | 2026-10-16 / alpha.24：核心45/45、最终串行桌面233/233、Windows契约38/38与界面7组通过，lint/类型/构建通过；真实WSL Claude原生取消及后台观察重启3组通过。最终包33 CJS/78 core/1390 Linux资源匹配，普通EXE7组通过；证据层级见[停止专项](iterations/I07/native-stop.md)，本机手动Claude权限等待/允许/拒绝已补验，见[权限专项](iterations/I07/native-permission.md)；自动主角色首轮权限已[补验](iterations/I07/auto-native-permission.md)，原会话后续轮权限亦已[补验](iterations/I07/resume-native-permission.md)；执行成员交接/独立SSH及完整I07C未准出。 |
| I06A 发布 | 候选 EXE 已生成并验收，正式 0.6.0 仍需 6B/C 准出；见 [6A 验收](iterations/I06/acceptance.md) |

alpha.19 历史 win-unpacked/普通便携 EXE 的资源与实测保持原证据；2026-10-15 alpha.20候选已重建EXE并核对资源，普通Windows无调试EXE/合成配置拒绝恢复及关闭重开4组通过；不以历史包证明新修复。

## 2. 迭代和长期模块的关系

| 阶段 | 交付目标 | 当前状态 | 主要模块 |
| --- | --- | --- | --- |
| I01 | CLI + Mock 的任务路由、认证、存储与故障基本合约 | 历史验收已记录 | M07、M09 |
| I02 | 真实 OpenCode 接入与原生事实 | 历史验收已记录 | M06、M07、M09 |
| I03A | 一个终端的自动发现、向导与后台使用 | 已实现并有真实/TTY 证据 | M03、M06、M09 |
| I03B | 原会话续聊、控制、恢复与补传 | 已实现；原生限制单列 | M06、M07、M09 |
| I04 / I04B–G | Windows 看板、双环境、原生控制与稳定性修复 | 历史发布与限制见迭代报告 | M01、M03、M06、M07、M10 |
| I05 | 工具节点与受限主从协作 | 0.5.0 已发布，四条 Windows/WSL 真实协作链 | M03、M06、M08 |
| I06A | 独立 Coordinator、SSH、Linux daemon、直接会话 | 0.6.0-alpha.2 候选已交付，Windows/SSH 主要流程通过；专项覆盖限制见验收 | M01–M07、M10 |
| I06B | 节点图、真实授权连线、跨物理设备双向协作与旧父权限修复 | alpha.6 主要范围已验收；alpha.8 拖动修复、alpha.9 合并页面与节点管理，专项见当次报告 | M01、M03、M08 |
| I06C | 完整故障与指标、版本切换/回滚、最终候选包与准出 | 用户批准开发；alpha.10 首批通过，完整范围仍在开发 | M01、M02、M03、M04、M05、M07、M08、M10 |
| I07 | 外部智能体登记、小队公共空间、授权交接与持续协调 | 用户批准开发，I07A/B已实现；I07C首批已实现，完整接入/故障/停止范围未准出，不替代I06C准出 | M01、M02、M03、M06、M07、M08 |

## 3. I06A 收尾的可验收交付

| 顺序 | 要完成的功能/验证 | 准出证据 |
| --- | --- | --- |
| 1 | 当前源码的 Windows 接入流程与秘密保护 | 真实 SSH 登录，不以 mock 代替密码/加密私钥/ssh-agent/DPAPI |
| 2 | 可从界面区分关闭窗口与停止中央 | 关闭窗口后台仍活；主动停止后台入口可操作，远端任务事实保留 |
| 3 | 远端任务、续聊与原请求查询 | 两轮 Task、同 Conversation、两轮 native Session ID 对比、断线重连不重发 |
| 4 | 新 Windows 候选 EXE | 包内最终代码与离线资源一致，普通启动/重开、来源与历史不丢；记录摘要 |
| 5 | 统一资料与当次验收报告 | 模块报告与整体状态同步，I06A 未测项清楚，不能预先标整个 I06 完成 |

SSH 编辑/移除与事件过期补偿已在 alpha.10 的 6C 首批实现并按当次报告验收；无 Node 全新独立服务器安装、注销清理及完整升级/回滚仍待后续，不能扩大首批证据。

## 4. 后续范围

节点图是协作关系的实际编辑界面，不是静态展示。B 交付需要真实鼠标连线、保存权限、刷新不吞草稿、重开布局与跨机器的真实委派闭环。

C 交付需要按 [I06 验收矩阵](iterations/I06/testing.md)复验恢复、控制与发布指标。高延迟链路 77.8 秒安装是观测值，不代表已满足 20 样本状态同步 p95 指标。

用户已批准[I07](iterations/I07/goals.md)；I07A登记、小队、公共文档/消息和手动原生执行已实现，Bridge不实现业务能力。I07B任务板/授权交接已实现，Claude持续协调/自动续接首批已实现，准确范围见[I07C首批交付](iterations/I07/automation.md)。Harmes 的具体接口、Webhook/IM、云端中央、多用户和项目同步仍为候选，未纳入本次 I06 的已交付能力。

I07细化按三个切片建议推进：[I07A接入/公共空间 → I07B任务与直接交接 → I07C通知续接及主角色持续跟进](iterations/I07/development.md)。[需求R01–R12](iterations/I07/requirements.md)、[设计](iterations/I07/design.md)和[20项验收计划](iterations/I07/testing.md)已记录，I07A采用SQLite事务与现有MCP连接，分层实测见[交付](iterations/I07/delivery.md)；I07B已完成本片任务交接验证；I07C首批Claude主协调通过；完整I07C和真实自研/独立SSH场景仍待实现或验证。

## 5. 阅读与变更入口

- [迭代目录与报告](iterations/README.md)：保留历次约定与证据。
- [模块目录](module-plan.md)：长期职责与联动范围。
- [整体测试报告](testing.md)：当前验收基线。
- [同步维护规则](development-guide.md)：修改模块时同时更新当前设计与迭代。

## 当前 6A 候选验收结果

6A 收尾清单中的主要流程现已执行，细分环境/未测项以 [候选报告](iterations/I06/acceptance.md)为准。下一阶段是 6B，不能据候选通过把 6B/C 标完成。

## 最新修复候选

0.6.0-alpha.3 包含 Codex 自然语言发现指引和 MCP 工具名展示。桌面 89/89、真实 Codex → Claude 发现/委派/结果/连接图及包资源比对通过，范围和加载新后台方式见 [修复交付](iterations/I06/codex-discovery-fix.md)。alpha.2 的历史主要 SSH 流程没有因新包构建被记为今天重新执行；独立跨设备协作仍归 I06B。

## 最新兼容复用候选

alpha.4 已收录可信 alpha.2/alpha.3 daemon 清单，新客户端可校验并复用原安装，客户端升级与远端后台版本分开。真实用户已有服务器的握手、重连和 OpenCode 发现通过，远端 PID/身份/current 保持、无模型需求；[交付](iterations/I06/ssh-compatible-reuse.md)。本次不是 daemon 自动升级或全故障准出。


alpha.5 修复机器在线后仍保留旧版本报错的缓存合并问题，新增当前错误保留的反例，保留已交付 alpha.4 的可信远端复用。源码/包与本次验证见 [交付](iterations/I06/ssh-error-recovery.md)，节点图/跨设备完整验收仍归 6B/C。

## 当前 I06B 交付候选

用户已授权 alpha.6 / DEV-B01–B05；图、授权/布局事务、原父权限实现与当次实际验证见 [实施](iterations/I06/graph-implementation.md)。后续为 I06C 的完整故障、性能/游标恢复、连接维护、升级回滚及正式准出；未测项不能因图已可交互而抹去。


6B 最终包原生正向通过，反向服务恢复后以原请求完成；桌面 110/110，图 10 组、普通 EXE、资源校验分别通过。现场失败与人工服务恢复限制保留在报告，6C 自动恢复与正式准出未算完成。

## 当前 I06C 开发顺序

2026-10-13 / alpha.10：机器 SSH 连接编辑、确认断开/移除、原身份恢复、已观察历史持久化/阅读及事件游标缺口分页补偿已实现；桌面 136/136、真实本机 TCP SSH/生产 daemon 隔离恢复和 Windows 界面分别通过。完整 I06C、升级回滚和正式 0.6.0 未准出。 详见 [I06C 首批](iterations/I06/machine-management.md)。

| 顺序 | 模块 / 交付 | 状态与验收 |
| --- | --- | --- |
| 首批 | M01/M02/M03/M04/M05/M07/M08：连接维护、历史与事件恢复 | alpha.10 首批专项通过，真实 Agent/独立服务器未本次重跑 |
| 下一批 | DEV-C01/C02：中央/daemon 重启、丢任务/控制回应、旧代次与取消竞态 | 原 ID/原生 Session 对账；重复执行为零；原生效果不能由 confirmed 推定 |
| 随后 | DEV-C03：安全升级、健康验证、失败回滚与停止/卸载边界 | 源码已实现；真实 daemon/process 七项通过；独立服务器实际结果见当前验收 |
| 最后 | DEV-C04/C05/C06：部署专项、指标、最终包/真实双向链与准出 | 全需求按证据逐项验收；正式 0.6.0 仍未完成 |

## GitHub 候选程序交付

2026-10-13：alpha.9 Windows x64 EXE 已作为 GitHub 预发布附件提供，[下载程序](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.9/AgentBridge-0.6.0-alpha.9-Windows-x64.exe)、[发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.9)。用户无需自行编译或安装 WSL/Node.js 来运行 AgentBridge。稳定历史版本仍为 0.5.0；这次发布不代表完整 I06C 或正式 0.6.0 准出，也没有将本地 alpha.10 源码/程序同步到该标签。

2026-10-14：当前源码提交 `15b7c9ea9c3d53802797b655e0cffaf365658574` 和 alpha.15 Windows x64 EXE 已推送至 [GitHub master](https://github.com/wsjq5477/MA-Relay/commit/15b7c9ea9c3d53802797b655e0cffaf365658574) 并作为 [alpha.15 预发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.15)提供。EXE 129,851,710 字节，SHA-256 `d1052ed5cd7893a9842ee96b6bf87c40b2ec6a5389ac59ef28ad5eb528e0ac4f`。根 43/43、桌面 159/159、文档检查与包一致性校验通过；本次未重跑真实 Windows 用户流程。完整 I06C 与正式 0.6.0 尚未准出。

本次完成已有 alpha.9 EXE、SHA256SUMS.txt 的公共下载，以及源码入口和分发证据同步。只交付下载通道，不改变当前迭代开发基线；升级/回滚与完整准出继续按原路线推进。见 [发布记录](iterations/I06/github-release.md)。

## 当前 alpha.13 收尾状态

alpha.13 已实现后台可信升级/回滚/停止/卸载、原维护恢复、控制收据校验与敏感表单脱敏。桌面 150/150、维护 7 项与源码/包一致性通过；独立 Linux 原生链和最终准出仍按 [I06C 收尾](iterations/I06/final-delivery.md) 的实际证据更新。 历史发布和各次原生证据保留原日期，候选包构建不等于正式发布。

## 2026-10-14：SSH 上传失败诊断与安装入口恢复

AB-F06/F17，M01/M04/M10：alpha.14 区分安全的 SFTP 失败类别、按实际 ACK 字节计进度并等待关闭确认；明确上传失败后可重新检测和批准原安装，unknown 不显示重装入口。桌面 155/155、上传专项 5/5（含本机真实 TCP SSH/SFTP）和 Windows 受控响应界面 2 组通过。用户另一台机器到原服务器未重测；本次不自动改变 GitHub alpha.9 附件或完整 I06C 准出。包与 EXE 的分层实际结果见 [alpha.14 上传诊断与恢复](iterations/I06/ssh-upload-recovery.md)。

2026-10-14 alpha.13 实机补充：真实升级、两轮及两方向通过；L2 受控执行器故障、Windows 原生取消/普通窗口分别通过。Linux 原生文件/恢复仍待原终态核对，完整 I06C 不准出；不释放原 unknown。当前上传候选 alpha.14 保持自己的证据范围，见 [收尾](iterations/I06/final-delivery.md)。

当前剩余项已收敛为原 alpha.13 Linux 文件/恢复终态：维护实机全链已在冻结 alpha.16 空闲 profile 通过，alpha.17 工程/程序通过；需为原服务提供足够内存再按原 ID 恢复，不能另建任务冒充准出。见 [本次最终记录](iterations/I06/maintenance-launch-recovery.md)。

## alpha.18 Windows 运行缓存与原提交恢复

I06-FIX-RUNTIME-01 / AB-F07/11/17：排除共享缓存清单自引用，兼容旧清单，保留损坏副本；核对原未派发意图恢复旧 unknown，不重发需求；查询显示结果和固定原因。桌面 176/176、根 43/43 及类型/构建/lint 已通过；Windows 与最终包的实际结果、命令和未测范围以 [专项交付](iterations/I06/runtime-recovery.md) 为准，完整 I06C 未准出。

当前 alpha.18 已以 GitHub prerelease 分发：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/AgentBridge-0.6.0-alpha.18-Windows-x64.exe)、[校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/SHA256SUMS.txt)、[源码 PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)。源码标签绑定 `1f0d9ef`，独立分支未合入 master；分发只证明对应附件核验，不扩大为完整 I06C 准出。详见 [发布记录](iterations/I06/github-release.md)。

## alpha.19 Linux CLI 发现修复

I06-FIX-DISCOVERY-01 / AB-F02/07/17：补充非交互 Linux daemon 的常见用户态安装目录，PATH 优先/坏候选回退及 Windows npm 发现保留。发现回归 6/6；真实 Codex 0.162.1 经生产 daemon/本机隔离 TCP SSH 版本发现通过，模型 0；用户独立 Ubuntu 未更新或实测。完整工程、当前包、使用步骤和范围见 [专项](iterations/I06/linux-cli-discovery.md)。

## alpha.19 OpenCode 二次发现与 Windows 配置写入

I06-FIX-DISCOVERY-02 / AB-F02/07/17：共享扫描核验原安装，不替换已删除/损坏路径；Windows Core 配置使用可写句柄刷新/原子替换，Linux目录刷新保留。核心45/45、桌面181/181及Windows隔离PE/进程6组通过；模型0，用户另一台电脑未实测。与LinuxCLI修复统一候选/包校验，完整I06C未准出，最终发布事实见合并交付。详见 [需求/实现/验收](iterations/I06/opencode-discovery.md)。

2026-10-15 alpha.19 合并包复验：核心45/45、桌面181/181、lint/类型/构建通过；发布资源真实 Linux Codex0.162.1发现、Windows受控扫描/配置6组、普通EXE4组通过。最终包摘要和未测边界统一见 [Linux/合并包专项](iterations/I06/linux-cli-discovery.md)；未实测用户服务器或真实模型任务。

当前 alpha.19 已以 GitHub prerelease 分发：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.19/AgentBridge-0.6.0-alpha.19-Windows-x64.exe)、[校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.19/SHA256SUMS.txt)、[源码PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)。包含 Linux Codex 发现与 OpenCode 二次检查/Windows配置保存修复；源码标签绑定 `fce41be`，尚未合入master。远端需“后台维护→升级后台”后重扫。核心45/45、桌面181/181，包内Linux真实版本探测、Windows受控6组/普通EXE4组通过；未实测用户服务器/Windows原生推理，完整I06C未准出。


未发布源码修复（2026-10-15）：未确认请求按原节点/共享目录保护，独立节点可新建/续聊；准备拒绝持久化与旧NOT_CONFIGURED严格恢复。桌面188/188、定向40/40、桌面类型/构建、Windows Edge受控4组通过。完整范围与未测项见[专项](iterations/I06/pending-isolation.md)，GitHub alpha.19发布基线不变。

alpha.20候选打包完成：核心45/45、桌面串行188/188、lint/类型/构建、包资源核对及Windows普通EXE4组/受控界面4组通过。首次并行维护测试失败与复验保留，GitHub已公开分发，附件和完整下载摘要核验通过。

当前分发以alpha.23[I07发布记录](iterations/I07/github-release.md)为准；alpha.20及更早源码/分发阶段记录保留为历史。

## I07当前推进点

I07C首批已实现授权/预算、重要事件激活、Claude原主会话自动续接和后台恢复；[I07C首批交付](iterations/I07/automation.md)记录真实三轮主协调、受控外部执行成员及包状态。下一片补真实原生执行成员链、其他接入能力、权限等待与完整停止。沿用已批准范围继续推进，不把首批声明为完整I07C或I06C准出。

## I07C当前停止切片

alpha.24本地候选实现用户停止本项工作、撤销协作访问、原取消与原任务双重核对；包含已有未发布等待可见性。核心45/45、最终串行桌面233/233、Windows契约38项和受控界面7组通过，真实WSL Claude原生停止3组通过；最终包/普通EXE以[当片验收](iterations/I07/native-stop.md)为准。下一片真实执行成员自动交接、完整原生权限等待处理及独立环境故障专项，不将本片当完整I07C或发布。

2026-10-17源码增量：[不完整任务回应保护](iterations/I07/incomplete-receipt.md)，受控专项45/45通过；原alpha.24 EXE及其包一致性证据仍对应此前冻结源码，未包含补丁。下一轮构建须重新核对源码/包，完整I07C/I06C仍未准出。

## Windows原请求恢复增量

2026-10-17：alpha.25本地候选修复MachineHost空Agent身份匹配；专项48/48、串行桌面243/243、Windows契约17/17通过。最终包与用户故障机边界见[专项](iterations/I06/windows-context-recovery.md)。不扩大完整I07C/I06C准出，GitHub保持alpha.24。

2026-10-17当前源码增加[首次续接Conversation绑定保护](iterations/I07/intended-conversation.md)，受控专项48/48通过；未重建EXE或改写GitHub alpha.25附件，下次打包须重新核对源码。真实执行成员交接及完整I07C/I06C仍待验。
