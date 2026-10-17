# I07A 接入与公共空间：实现和验收记录

日期：2026-10-15。源码/本地候选：0.6.0-alpha.21；GitHub当前已发布预发布仍为alpha.20，本次没有发布新Release。用户已批准开发I07，当前交付第一片I07A，不代表I07B/C或I06C准出。

## 1. 交付范围

| 需求 | 已实现行为 | 未包含范围 |
| --- | --- | --- |
| R01/02 | 从已接入原生节点登记智能体，或登记外部MCP实例；填写职责/输入/输出/不负责什么；创建小队、指定主角色、创建独立工作 | 不创建智能体业务能力，不配置Skill/模型/目录；同一原生工具节点只登记一次，功能不同应提供独立外部入口 |
| R03 | 用户手动对原生成员执行一轮；绑定本次工作的小队MCP、独立上下文和原请求；原回应未知只查询 | 尚无自动派发、任务板依赖、返修交接或自动续接 |
| R04 | 共享文档、文档级编辑授权、完整修订、expectedRevision冲突拒绝 | 尚无章节级授权、自动摘要或外部文件同步 |
| R05 | 公共群消息、回复、按成员通知、分页、pending/delivered/read独立回执 | @不启动队友，已读不等于接手或业务成功 |
| R10/11 | 接入身份由后台绑定，实时成员/文档权限；撤权后旧接入失效；SQLite事务/收据去重、关闭重开与原操作查询 | 单用户、小队公共材料；外部MCP配置先支持中央所在电脑，未验证独立用户服务器上的新小队链 |

界面入口为“小队协作”，内含“智能体 / 小队设置 / 工作空间”。旧机器图、默认主从协作与已存在任务不迁移。工作可暂停新执行、撤销成员访问或在原执行全有终态后归档。原生本轮完成不自动完成总工作。

## 2. 实现与数据

- [team-space.cjs](../../../desktop/electron/team-space.cjs)：公共记录和业务操作。新增`team-space.sqlite`，WAL/FULL同步；单条state记录与原操作receipt在同一事务提交，持久化失败回滚，不用多个JSON文件假设原子性。
- [TeamWorkspace](../../../desktop/src/TeamWorkspace.tsx)：登记、小队、工作、群消息、文档与手动执行；写前在本机保存稳定操作，回应不明只查`team.operation`。
- [team-tools.cjs](../../../desktop/electron/team-tools.cjs)、[broker](../../../desktop/electron/collaboration-broker.cjs)、[MCP客户端](../../../desktop/electron/mcp-client.cjs)：六个成员工具；每次接入私有描述文件独立，公共视图不返回令牌或接入身份。
- [Coordinator](../../../desktop/electron/coordinator-service.cjs)及[AgentNetwork](../../../desktop/electron/agent-network.cjs)：原执行继续经过alpha.20原请求/资源准入；小队scope仅后台内部派生，真实来源和原Task终态可核验，派发前再次检查暂停/撤权。
- [MachineHost](../../../desktop/electron/machine-host.cjs)及Claude/Codex宿主：`teamCollaboration`能力标志和小队MCP配置；旧后台无标志时在本轮需求派发前拒绝。原配置继承不变。

公共记录有8MiB状态容量、10000条收据及32MiB收据容量阈值，达到后拒绝新写入，不删未知/未完成记录释放占用。内部文件位于原profile私有目录；SQLite、令牌和原生状态不进入公共材料。

## 3. 实际验证

| 验证 | 环境/证据级别 | 实际结果与证据 |
| --- | --- | --- |
| 小队事务、身份、消息、文档冲突、撤权、持久化、去重、真实stdioMCP双客户端 | WSL / Node22.23.1；受控执行端+真实生产broker/磁盘/子进程，模型0 | [小队测试](../../../desktop/tests/team-space.test.cjs)、[定向TAP](../../../artifacts/I07A/2026-10-15/targeted.tap)；最终回归结果以下方日志为准 |
| 原生执行绑定、伪造入口拒绝、原终态scope失效、准备期间撤权竞态 | 生产Coordinator/AgentNetwork，原生宿主受控，模型0 | [网络回归](../../../desktop/tests/agent-network.test.cjs)，最终桌面TAP记录实际通过数 |
| Windows独立stdioMCP、SQLite持久化和撤权契约 | Windows / Node24.18.0，受控执行端，模型0 | **7/7通过**，[Windows TAP](../../../artifacts/I07A/2026-10-15/windows-contract.tap) |
| 真实Claude读取小队上下文、发通知队友的群消息、创建共享文档、原生回合完成而总工作保持进行中 | WSL / Claude Code 2.1.299，真实原生CLI和账号配置、生产调用与MCP；一条原请求 | **4项通过**，[真实报告](../../../artifacts/I07A/2026-10-15/native.json)、[脚本](../../../desktop/tests/linux-i07a-native.cjs) |

工程已通过核心45/45、桌面197/197、lint、根/桌面类型及构建；Windows界面5组通过，包核验78个core文件、30个CJS和1387个Linux资源条目通过。Windows普通无调试EXE四项通过：生产IPC/SQLite/MCP、冻结资源匹配、关窗保留后台及完整后台重启恢复原接入配置。[普通EXE原报告](../../../artifacts/I07A/2026-10-15/portable.json)、[汇总](../../../artifacts/I07A/2026-10-15/verification-summary.json)。证据入口：[根TAP](../../../artifacts/I07A/2026-10-15/root-tests.tap)、[桌面TAP](../../../artifacts/I07A/2026-10-15/desktop-tests.tap)、[构建](../../../artifacts/I07A/2026-10-15/desktop-build.log)、[Windows界面](../../../artifacts/I07A/2026-10-15/windows-ui.json)、[包](../../../artifacts/I07A/2026-10-15/package.json)。

## 4. 保留的失败与修复

首次真实原生验证在独立worker导入新协作模块时失败，原生CLI尚未启动；原任务明确为failed，不重放。修复为由宿主把小队指引和工具名写入原worker任务配置，独立worker无需加载未复制模块。之后以新的明确验证轮次完成真实链，前一次失败保留在[原报告](../../../artifacts/I07A/2026-10-15/native-initial-worker-failure.json)。

Windows界面首次未找到嵌套选择框的精确可访问名称，补显式名称后发现外部标识的帮助文字同样影响名称，均修正控件标注。[首次原失败](../../../artifacts/I07A/2026-10-15/windows-ui-initial-label-failure.json)保留；只以最终完整流程结果验收。

## 5. 使用方法与后续

打开候选程序 → 小队协作 → 智能体：登记原生节点或外部实例及介绍 → 小队设置：选择成员、主角色和约定 → 工作空间：新建目标和完成标准。原生成员可手动执行一轮；外部支持MCP的智能体，在同一台电脑添加所生成的接入配置后，通过自己的原入口开始工作。撤销本次访问使旧配置失效。

当前只有公共空间/手动闭环，不宣称已经实现用户最终要求的自动A/B返修。后续I07B实现任务板和授权交接，I07C实现通知激活/原会话续接及主角色持续协调；按[开发分解](development.md)继续，无需为已批准范围重复审批。

## 6. 本地候选包与准出结论

I07A主要范围在上述证据层级通过；真实用户自研Agent、独立SSH新小队链未验收，I07B/C未实现。候选EXE已生成并复制到用户Downloads，未发布GitHub：`AgentBridge-0.6.0-alpha.21-Windows-x64.exe`，129865919字节，SHA-256 `8aeebb388d7a4bfeb1961be2aff70241e411b55c93e9211ca783b210ce31645c`。原包位于仓库desktop/release目录；[校验文件](../../../artifacts/I07A/2026-10-15/SHA256SUMS.txt)、[包报告](../../../artifacts/I07A/2026-10-15/package.json)。

首轮普通EXE验证已通过前三项，在完整后台重启时测试脚本早于IPC端点就绪而连接失败；改为只读等待同一后台端点后，最终四项全部通过。[首次时序失败](../../../artifacts/I07A/2026-10-15/portable-initial-startup-race.json)保留；没有重复创建原工作或发送原生需求。真实原生报告中的one original表示一条Bridge原请求，不是模型供应商API调用次数统计。
