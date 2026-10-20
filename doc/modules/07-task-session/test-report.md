# M07 任务、会话与恢复测试报告

## 同机独立执行与完整恢复（2026-10-20）

T-M07-190 / M07-F01/F03/F05：alpha.34 d9bf2a5 派生隔离源码、alpha.35 候选。受控定向71/71，Windows生产前端15组/0页面错误，Windows后台纯CJS83/83，Core56/56通过。最终源码桌面601/601通过，Windows83/83已在冻结源码副本复验；包/普通EXE/分发状态以专项实际登记为准。模型0，不改用户profile/原操作，不升级独立SSH。计数为跨模块共享，不能相加；用户现场及完整I06C/I07C未验。

复现：`node --test --test-concurrency=1 desktop/tests/agent-network.test.cjs desktop/tests/graph-operations.test.cjs desktop/tests/management-recovery.test.cjs`；Windows运行`desktop/tests/windows-scoped-execution-recovery.cjs`、`windows-scoped-execution-contract.cjs`。原始失败、日志、截图及最终结果见[专项](../../iterations/I07/scoped-execution-recovery.md)。

2026-10-20 **0.6.0-alpha.34已预发布**：当前整合源码和新Tag已推送，标签冻结`1af4dab`，EXE与SHA-256附件已上传并通过匿名完整下载核验。包含OpenCode1.x/2.x、独立MCP、CT-04/CT-05及既有alpha.30–33修复；Windows旧后台门禁、包/普通EXE与未测边界分别见[交付记录](../../iterations/I07/alpha34-release.md)。完整I06C/I07C仍未准出。

## 2026-10-20：OpenCode 1.x / 2.x 兼容修复

M07-F01/F02：V1 Session 由服务端生成，invocation 在创建前持久，Session/Message 绑定在 Prompt 前持久。快照保存可选 nativeProtocol；旧缺省 v2，协议变化禁止续接。当前轮只按原输入及助手完成/中断证据结算，丢响应不重放。 本次共用专项的全套日志，不跨模块累加；受控测试、官方 CLI 加受控传输与未测 Windows/SSH/真实模型分列。 [需求、实现、验证与未测边界](../../iterations/I07/opencode-v1-compatibility.md)。

## 2026-10-20：维护上传进度与持久化修复（issue #10）

M07-F03/F04：本轮WSL专项7/7、相关42/42与核心51/51，Windows最终7/7及SSR66/66通过；最终全量/真实TCP/普通EXE/公开下载逐层记录。用户profile及独立服务器未验，共享计数不跨模块叠加。 [完整设计、实测与边界](../../iterations/I07/maintenance-persistence.md)。

## 2026-10-20：CT-05桌面选材/核对导出

T-M07-152 / M07-F08/F09：WSL Node22.23.1最终桌面581/581零跳过/退出0，新5项和定向15项为全量子集；Windows Node24.19.0/Edge155生产前端、真实Coordinator/SQLite、受控机器9组通过、页面异常0。覆盖四类明确版本/本机MD与JSON实际下载、报告来源/正文/引用/摘要拒绝、目标/任务变化失效、跨工作迟到隔离及原unknown不变/原生请求0。clipboard受控，模型调用0，不等于系统剪贴板、EXE或真实Agent消费本轮导出。计数共用不相加；后端任务/权限/收据合约无变化。[日志、截图、首次构建与壳退出记录、复现和发布边界](../../iterations/I07/context-packet-ui.md)。

## 2026-10-20：CT-05明确选材只读包

T-M07-151 / M07-F08/F09：WSL Node22.23.1定向14/14（新6项）包含在全桌面576/576，Windows Node24.19.0同14项/真实命名管道与stdioMCP通过，零跳过、受控模型0。覆盖精确版本、旧消息/历史产物、任务过期/越权/撤权/终态scope、格式和UTF-8容量、完整state/receipt不变。真实Claude2.1.303一个成功Task、3次MCP读取及完整重开/重复观察仍1Task；各模块共享计数不相加。新EXE、其他工具实际消费/独立SSH及界面选材未验，源码晚于integrated.3冻结。[日志、脚本、环境首次失败与发布边界](../../iterations/I07/context-packet.md)。

## 2026-10-19：整合源码与本地候选

T-M07-149 / M07-F02/F06/F07/F08：核心51/51、桌面570/570零跳过（定向85/85及兼容15/15是相关子集），根类型/lint/构建与桌面构建通过。Windows前端26组/模型0，按历史/门禁/管理/材料/MCP分别记录；最终integrated.3普通Windows EXE五组通过：原历史/文档/MCP导出、窗口/后台重开、持久资源和原unknown保留，原生请求0；这是隔离合成profile，不是真实Agent模型或用户现场。包42 CJS/78核心/1446 Linux条目匹配，未部署用户SSH或跑真实模型。各模块共用计数不相加；首次夹具/原型失败与原历史证据保留。[版本、源码、所有原始结果和限制](../../iterations/I07/integrated-source.md)。

## 2026-10-19：issues #8/#9受控验证

M07-F03/F04：核心51/51、桌面543/543（含版本/管理/原路由回归）、最后定向7/7及工程检查通过；Windows95项原路由/9项管理CJS、前端专项4组/既有10组及普通EXE5组通过；分发另按专项逐项记录。无真实模型/用户profile/独立服务器升级，不跨模块累加共享计数。 [需求、实现、验证与边界](../../iterations/I07/version-management-recovery.md)。

## 2026-10-19：issue #7 协作兼容修复

M07-F03/F04：本轮仅受控HTTP/CLI、生产后台无推理、TCP SSH及Windows交付验收；用户现场/独立SSH/真实模型未测。实际执行结果、首次失败与最终工程/包证据统一引用专项，共享计数不跨模块叠加。 [完整需求、验证与交付](../../iterations/I07/collaboration-compatibility.md)。

## 2026-10-19：历史详情路由与局部错误

T-M07-150 / M07-F02/F06/F07：alpha.30隔离修复；合成路由6项、受控TCP SSH1项、Windows纯CJS91/91、Linux SSR63/63，新生产前端7组和既有10组通过，模型0。最终桌面529/529、核心45/45、lint/类型/构建通过；38 CJS/78 core/1401 Linux资源匹配145个冻结源文件。普通Windows无调试EXE合成原两轮/Session只读与关闭重开/后台重启4组通过。分发实际结果及首次失败统一见[当次专项](../../iterations/I07/history-detail-recovery.md)；共享计数不跨模块叠加，用户故障profile/独立服务器未复测。

## 独立 MCP 文件与配置增删（2026-10-19）

M07-F06/F07；日期2026-10-19，alpha.29后未发布工作区。WSL Node22.23.1受控全桌面537/537、核心45/45；真实原生列表三工具增删通过，Claude/OpenCode连接、Codex仅列表；Windows Edge155生产界面4组通过但机器/原生执行受控。计数为共享结果不跨模块相加，模型调用0。新EXE、真实Windows原生Agent、独立SSH与独立接入真实模型委派未测。源码/命令、首次失败、原始日志和逐层边界见[专项验收](../../iterations/I07/mcp-installation.md)。

## 2026-10-19：CT-04公共材料首片

T-M07-147 / M07-F08/F09：2026-10-19，alpha.29之后未发布源码，WSL Node22.23.1。定向27/27（含新8项）和最终桌面525/525通过，零跳过，无模型；覆盖只读/精确旧版/分页、跨工作/撤权/原生终态scope拒绝、状态/报告白名单、Markdown和生产Coordinator→stdioMCP→broker路由。定向是全量子集，各模块共用计数不相加。另有真实Claude2.1.303一个成功Task、两次MCP读取、三组限定检查；索引文档当前2版时准确取得第1版，完整重开仍一个原Task。本片没有新EXE/其他工具/独立SSH或桌面导出验收。[原始日志、版本、复现及限制](../../iterations/I07/public-materials.md)。

## 2026-10-19：CT-02真实MCP六方向

T-M07-146 / M07-F06/F07：WSL Node22.23.1，真实Claude2.1.302/Codex0.163.0-alpha.10.2/OpenCode2.0.24轮流作主并各委派给另两种工具；生产Coordinator/AgentNetwork/MachineHost/stdioMCP/broker/原生CLI或HTTP，非假dispatcher。共9个成功原生Task、6个委派方向、16次实际MCP调用；原父/目标/机器/派生ID/消息与真实结果核对，重开每链Task3→3/委派2。保护7/7计入全桌面517/517（模型0），不与真实或跨模块计数叠加。生产行为无变更；新三工具、新EXE、独立SSH、权限/表单及执行中断点未测。[完整脚本、逐次报告与边界](../../iterations/I07/connection-delegation.md)。

## 2026-10-19：CT-02首批真实直接生命周期

T-M07-145 / M07-F01/F02/F06/F07：WSL Node22.23.1，真实Claude2.1.302、OpenCode2.0.24、Codex0.163.0-alpha.10.2沿生产Coordinator/AgentNetwork/MachineHost分别通过直接回答、原Session续聊、原任务取消及完整观察重开。共9个原任务，6成功回答/3取消；每工具观察任务3→3，无新增执行。恢复保护7/7和桌面510/510为受控共享计数，不与真实任务或跨模块相加；根45/45保留CT-01日期。本模块产品行为无变更，新三工具/真实委派方向/新EXE/独立SSH未验。[脚本、逐次原始报告、首次失败与完整限制](../../iterations/I07/connection-native.md)。

## 2026-10-19：CT-01连接能力与原拒绝恢复

T-M07-144 / M07-F06/F07：alpha.28后未发布工作区，WSL Node22.23.1 / Windows Edge155。三工具普通委派去重/改输入冲突、丢ACK、持久unknown、全观察器重开、取消与自然完成竞争及不重放通过。共享定向32/32（全桌面503/503子集）、核心45/45及工程检查通过，无跳过；跨模块不相加。首次夹具失败及修正保留，真实新三工具/当前EXE/独立SSH未验。本轮模型0，先前真实Claude结果不计本轮。[脚本、命令、失败与最终原始证据](../../iterations/I07/connection-capabilities.md)。

## 2026-10-18：真实原生执行成员公共文档链

T-M07-143 / M07-F10：同WSL三个独立Bridge宿主、真实Claude2.1.302，五组限定检查通过、五次自动原生回合；开发/复核各一轮、主协调沿原会话三轮。原生终态后验收及恢复不重放通过，原生权限回复/非Bridge工具/模型覆盖0。机器路由受控，非独立SSH、真实WindowsEXE或代码编译返修；共享真实计数不跨模块叠加。[脚本、原始日志与准确边界](../../iterations/I07/native-members.md)。

## 2026-10-18：原生接入准入与核对收据

T-M07-142 / M07-F06/07：原核对收据可重查及重启恢复；unknown核对不阻首次取消、unknown取消不换ID重发；观察原终态再推进收据。Codex同批迟到帧不覆盖已确认终态或原结果。 最终合并源码串行桌面474/474、核心45/45及工程检查通过；受控CLI/磁盘/浏览器，模型0，未升级用户后台或重建EXE，不替代真实原生或独立SSH。[需求、原始失败、最终日志与未测边界](../../iterations/I07/native-integration-guards.md)。

## 2026-10-18：当前 Agent 版本与历史安装合流

T-M07-141 / M07-F06/F07：alpha.28后未发布工作区、WSL Ubuntu/Node22.23.1。原Task/Conversation/Session与请求指纹不迁移，旧上下文仍可查询，unknown占用覆盖当前工具。 桌面421/421、核心45/45通过，计数为共享工程结果不跨模块相加；真实Claude版本2.1.302与受控历史节点合流明确分层。类型/lint/前端构建通过；当前EXE、用户运行中profile、真实模型和独立SSH未验证。[完整场景、原始日志与首次失败](../../iterations/I07/current-agent-discovery.md)。

## 2026-10-18：新增原生宿主生命周期

T-M07-140 / M07-F01/F02/F05/F06/F07：alpha.28 后源码、WSL Node22.23.1、受控独立CLI/磁盘。新宿主19项纳入[43项共享定向结果](../../../artifacts/native-agent-expansion/2026-10-18/native-targeted.tap)，覆盖原ID去重、原Session、观察重开不重发、未知占位、取消收据与原生终态分开、取消竞争、缺失/重复Pi原文件和跨会话在途门槛。模型0，不代表真实模型、Windows EXE或独立SSH。复现与完整边界见[专项](../../iterations/I07/native-agent-expansion.md)。

## 2026-10-18：当前工作区集成基线

T-M07-132：alpha.28加未发布UI/会话补丁，WSL Node22.23.1，受控进程/SQLite/SSH/HTTP/React SSR，模型0。核心45/45、串行全桌面375/375（含既有父/子测试）、lint/根类型/前端类型及构建通过，无测试跳过；保留既有chunk体积提示。共享计数不跨模块相加。[完整命令、原始日志和源码观察清单](../../iterations/I07/integration-baseline.md)。未验证新UI浏览器/Windows EXE、独立SSH或真实模型；模块行为无新改动，发布附件未更新。


## 2026-10-18：会话异常与业务验收

T-M07-131：alpha.28之后的未发布源码，WSL Node22.23.1，真实SQLite/受控执行与业务报告，模型0。新增两项回归修复前均失败，修复后相关53/53通过；覆盖任务/直接总验收/提议后异常、历史轮次忽略和正常后续执行替代。原生succeeded事实保持，异常阻断业务验收。[完整证据及复现](../../iterations/I07/acceptance-native-binding.md)。未测试真实模型/Windows/独立SSH或重建EXE；共享计数不跨模块累加。


## 2026-10-17：空白原生Session绑定保护

T-M07-130：alpha.28之后的未发布源码增量，WSL Node22.23.1，受控原生execute/query与真实SQLite，模型0。首次纯空白值不绑定/不自动续接，后续空值不清除已有有效绑定；两个反例修复前失败，修复后相关51/51（含父/子测试）通过，真正Session变化仍受既有反例约束。[证据与复现](../../iterations/I07/blank-native-session.md)。未实测真实CLI返回空值、Windows或独立SSH，未重建EXE；共享计数不跨模块累加。


## 2026-10-17：SSH持久拒绝恢复

T-M07-128：alpha.28已预发布，WSL Node22.23.1/Windows Node24.19.0，合成台账和受控TCP SSH，模型0。最终桌面317/317、核心45/45、Windows契约93/93，lint/类型/构建通过；真实TCP SSH丢响应/daemon重启1项及普通Windows无调试EXE合成验证6组通过，34 CJS/78 core/1395 Linux资源匹配源码。发布以[当次实际记录](../../iterations/I06/daemon-rejection-recovery.md)为准，不推定用户现场恢复。历史记录不计为本次重测。

## 2026-10-17：Windows恢复专项

T-M07-128：2026-10-17 / WSL Node22.23.1与Windows Node24.19.0 / alpha.27已预发布，模型0。Codex恢复10/10、共享原子写入10/10、网络最终50/50、Windows契约86/86；全桌面最终运行288/288、核心45/45及工程检查通过；新增alpha.26兼容文件另验10/10。共享计数不跨模块累加，Windows为受控目录/执行器，不是用户故障或真实模型。首轮限制/维护ENOENT与未测范围保留；最终普通Windows EXE对合成记录恢复/重开/重启/冻结源码共5组通过，包内33 CJS/78 core/1393 Linux条目一致；发布结果以[当片报告](../../iterations/I06/windows-start-persistence.md)后续实际记录为准。
## 2026-10-17：首次续接回应的原Conversation校验

T-M07-127：alpha.25之后的未发布源码增量，WSL Node22.23.1，受控execute/query和真实SQLite，模型0。错误Conversation的running/succeeded两个反例修复前均失败；修复后相关48/48（含父测试/子场景）通过，错误回应保持unknown、不绑定外来会话，原request返回正确Conversation后恢复，execute总数仍2。[TAP、复现与限制](../../iterations/I07/intended-conversation.md)。未运行真实模型/EXE或独立SSH，未重建发布包；共享计数不跨模块累加。


## 2026-10-17：Windows原请求上下文恢复

T-M07-126 / M07-F06/F07：alpha.25本地候选，WSL Node22.23.1/Windows Node24.19.0，受控记录，模型0。4个反例修复前全部失败，修复后专项48/48、串行桌面243/243、Windows契约17/17通过，原回执可恢复且缺回执仍unknown。共享计数不跨模块累加，包内33 CJS/78 core/1390 Linux资源一致；alpha.24普通EXE对照3组、alpha.25候选4组通过，原记录均为合成。候选包/普通EXE与失败日志见[专项](../../iterations/I06/windows-context-recovery.md)。未实测用户另一台电脑或真实原生模型，不改变GitHub alpha.24已发布冻结包。

## 2026-10-17：不完整原生任务回应

T-M07-125：alpha.24未发布源码补丁，WSL Node22.23.1，受控原生执行查询/真实SQLite，模型0。5种身份缺失或无效输入修复前全部失败；修复后自动化/公共空间/任务/停止/路由45/45（含父测试/子场景）通过，原不完整succeeded保持unknown、原scope和占用保留，完整原请求可恢复且execute仅1次。[TAP、复现和边界](../../iterations/I07/incomplete-receipt.md)。未重建EXE或验证真实模型/独立SSH；共享计数不跨模块累加。


## 2026-10-17：真实原会话续接后的权限

T-M07-124：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。三项检查通过，共两次自动回合、手动启动0；阶段2的task/request不同但Conversation/实际原生Session相同，每轮真实权限等待/观察后台重启/精确Write允许后成功。累计attempt/used/Write/权限命令各2，持久事件仅user_start/attention且pending0；完成重查未重派。[证据及复现](../../iterations/I07/resume-native-permission.md)，共享计数不跨模块累加。未测后续轮拒绝、执行成员交接、Windows或独立SSH；未更新包或发布。


## 2026-10-16：真实自动主角色首轮权限

T-M07-123：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。两次事件自动原生回合、手动原生启动0，权限等待/观察后台重启、精确Write允许成功/拒绝failed三项检查通过；每项工作attempt/used各1、只有已消费user_start且pending0，原生Write和权限命令各合计2次。首次工具断言遗漏及修正后的只读恢复核对分别保留，[证据与复现](../../iterations/I07/auto-native-permission.md)。不是执行成员交接/原会话续接轮次、Windows或独立SSH，未更新EXE。共享真实证据不跨模块累计。


## 2026-10-16：真实原生权限补验

T-M07-122：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。两次手动小队原生调用，等待/观察后台重启、允许隔离Write并成功、拒绝后failed且文件不存在三项检查通过；完成后重复执行脚本只查原记录，每场景attempt1条、权限控制命令合计2次。真实原生证据共享引用，不跨模块重复计数。[报告、复现与限制](../../iterations/I07/native-permission.md)。未测自动权限链、Windows真实模型或独立SSH；未改产品源码/包，以下历史结果保持原日期。


## alpha.24停止协调实际验证

T-M07-121 / M07-F11：2026-10-16，WSL Node22.23.1、Windows Node24.18.0/Edge155、真实Claude2.1.299。停止契约8项、生产Coordinator/AgentNetwork受控路由1项、Windows契约38项及界面7组通过；真实Claude原生停止/观察后台重启3组通过，原取消命令1次、原任务cancelled后归档。全工程/包/普通EXE、首次失败和准确边界统一见[当片报告](../../iterations/I07/native-stop.md)，这些共享计数不跨模块相加。未证明真实权限批准/拒绝链、独立SSH或其他原生适配取消。

## alpha.23 / I07C首批实际验证

T-M07-110 / M07-F10：2026-10-16，WSL Node22.23.1、Windows Node24.18.0/Edge155。核心45/45、最终串行桌面222/222、Windows契约29/29；这些是全工程计数，跨模块不相加。Windows前端/真实Coordinator受控目录和成员10组，真实Claude2.1.299自动主角色3轮同Conversation/原Session、新scope、后台重启后实际X失败/Y通过及终态后总验收；执行成员为受控外部MCP、Node检查实际运行。最终包/普通EXE、首次连接恢复竞态和并行维护ENOENT分别保留证据，完整结果见[I07C首批报告](../../iterations/I07/automation.md)。未证明真实多原生角色、其他接入自动续接、用户自研/独立SSH或完整停止。

## alpha.22 / I07B 实际验证

T-M07-101 / M07-F08/M07-F09：2026-10-16，WSL Node22.23.1、Windows Node24.18.0及Edge155。核心45/45、最终桌面208/208、Windows契约18/18；这是全工程计数，不跨模块重复相加。真实Claude两轮手动开发、独立MCP编译连接器实际Node检查X失败/Y通过、MCP协调员验收；Windows生产前端/Coordinator受控目录7组通过、模型0。首次原有daemon启动失败、重查及最终包/普通EXE的实际结果均见[I07B报告](../../iterations/I07/task-handoff.md)。未验证用户自研产品、独立SSH小队链、OpenCode/Codex任务闭环或I07C自动激活。


## alpha.21 / I07A 实际验证

2026-10-15 / WSL Node22.23.1、Windows Node24.18.0 / 源码alpha.21，GitHub预发布alpha.20。

| 用例 | 功能 | 结果与证据边界 |
| --- | --- | --- |
| T-M07-100 | M07-F08 | 原请求重启/丢ACK/终态scope与准备期间撤权反例通过；真实原生回合结束后总工作仍active。 |

原始证据、工程总数及真实工具/界面/普通EXE分别见[I07A交付](../../iterations/I07/delivery.md)。[核心45/45](../../../artifacts/I07A/2026-10-15/root-tests.tap)、[桌面197/197](../../../artifacts/I07A/2026-10-15/desktop-tests.tap)为全工程计数，不在本模块重复相加；I07B/C能力不计为已通过。


## alpha.18 当前专项

2026-10-14 / WSL Ubuntu / Node 22.23.1 / 源码 0.6.0-alpha.18：共享缓存自引用/旧清单/损坏旁路重建、Windows OpenCode 原意图恢复与并发保护、查询结果和脱敏原因；定向 55/55（计入桌面全量 176/176），根 43/43，lint/类型/构建通过。受控文件/宿主测试，无模型调用。原始证据：[定向](../../../artifacts/runtime-recovery/2026-10-14/targeted.tap)、[全桌面](../../../artifacts/runtime-recovery/2026-10-14/desktop-tests.tap)。Windows 真实 Electron 资源 4 组、Edge 受控 UI 3 组、普通无调试 EXE/合成原意图与关闭重开 4 组均通过；包校验 28 CJS / 1383 Linux 文件与当前源码匹配。详细过程及边界按 [完整专项](../../iterations/I06/runtime-recovery.md) 的实际结果判定，不将历史原生证据提升为本次重测。


历史基线：2026-10-14 / 0.6.0-alpha.13。工程与受控维护验证通过，独立服务器/最终程序专项按 [I06C 收尾](../../iterations/I06/final-delivery.md) 实际状态记录；旧版本段落保持原日期。
核对日期：2026-10-12。对应 [功能设计](design.md)。结论：请求去重、状态持久化、原执行恢复和受控交互通过；真实能力按适配器区分，Windows Codex 账号拒绝和 WSL Codex 续聊限制未解决。

## 1. 证据与统计口径

本节保留早期资料核对的核心 43/43、桌面 87/87 历史基线；alpha.6 本次核心 43/43、桌面 110/110 见文末，无失败、跳过：[核心 TAP](../../../artifacts/docs-baseline/2026-10-12/root-tests.tap)、[桌面 TAP](../../../artifacts/docs-baseline/2026-10-12/desktop-tests.tap)。以下案例是总基线的映射，共用案例不会被重复计为新的测试数量。

Core OpenCode 测试使用受控原生协议 fixture，是真实 Hub/Edge/存储集成，不是生产模型回复。真实生产工具证据另见 [I05-real.json](../../../artifacts/I05-real.json) 与 [I06A 原始报告](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.json)。

## 2. 功能与案例映射

| 案例 ID | 对应功能 | 真实测试文件 / 名称 | 判定与主要断言 |
| --- | --- | --- | --- |
| T-M07-01 | M07-F01 / F03 | `core.test.ts`：`state machine rejects impossible events, unknown recovery and terminal overwrite` | 通过；拒绝非法跃迁及终态覆写 |
| T-M07-02 | M07-F01 / F06 | `core.test.ts`：`Hub transactions, serial reservation and restart history are durable`；`Edge journal rejects input conflicts, duplicate invocation and replay after restart` | 通过；持久预约、输入冲突与 invocation 去重 |
| T-M07-03 | M07-F02 / F06 | `i03b.test.ts`：`B01: three turns use one Session, isolate answers, preserve owner/config and dedupe` | 通过；受控原生三轮同 Session，每轮结果隔离 |
| T-M07-04 | M07-F03 | `core.test.ts`：`duplicate events, payload conflicts, illegal transitions and result target checks preserve facts`；`UTF-8 clipping never splits code points` | 通过；seq 去重、来源/内容校验、裁剪标记 |
| T-M07-05 | M07-F04 / F06 | `opencode.test.ts`：`OpenCode v2 through Hub/Edge: ownership, waiting/reply, pagination, result, isolation, dedupe and restart` | 通过；受控权限/表单、原身份与恢复 |
| T-M07-06 | M07-F05 | `i03b.test.ts`：`B02: cancel once across duplicate IDs, lost response and completion race` | 通过；取消只调用一次，自然完成竞态保留真实终态 |
| T-M07-07 | M07-F07 | `i03b.test.ts`：`B03: Hub restart preserves observation and replays durable events without a new Prompt`；`B03: an ACK lost after Hub persistence replays the same seq once without invoking again` | 通过；仅补传事件，不补发 Prompt |
| T-M07-08 | M07-F07 | `i03b.test.ts`：`B04: Edge rebuild restores waiting and completed original executions using reads only`；`B04: missing input, foreign steering and configuration mismatch retain unknown occupancy` | 通过；原绑定恢复，证据不足保留 unknown |
| T-M07-09 | M07-F06 / F07 | `agent-network.test.cjs`：`transport uncertainty remains durable and retry queries the original receipt without a second native execution` | 通过；同 ID 查询，缺失回执继续占用 |
| T-M07-10 | M07-F06 / F07 | `pending-journal.test.cjs`：`request receipt from another identity or source cannot clear the warning`；`missing ordinary submission stays unknown`；`control receipts settle only confirmed or rejected original operation IDs` | 通过；恢复只核对原身份及有效收据 |
| T-M07-11 | M07-F06 / F07 | `main.test.cjs`：`a rejection on retry cannot erase uncertainty from the original attempt`；`changing an unresolved request payload cannot replace its original journal` | 通过；原始不确定性不能被新重试掩盖 |
| T-M07-12 | M07-F06 / F07 | `machine-daemon.test.cjs`：`ten same-ID requests invoke native submit once and changed content cannot reuse an ID`；`restart keeps daemon ID and receipts; missing backend receipt remains unknown without replay` | 通过；受控远端执行与回执持久化 |
| T-M07-13 | M07-F02 / F07 | `machine-daemon.test.cjs`：`closing a relay preserves running tasks and reconnect continuation uses the original native session` | 通过；受控 Session 一致及 relay 断开生存 |

代码：[核心单元测试](../../../tests/core.test.ts)、[会话/故障集成测试](../../../tests/i03b.test.ts)、[原生协议集成](../../../tests/opencode.test.ts)、[台账恢复测试](../../../desktop/tests/pending-journal.test.cjs)、[桌面入口测试](../../../desktop/tests/main.test.cjs)、[daemon 测试](../../../desktop/tests/machine-daemon.test.cjs)。

## 3. 真实工具与发布证据

| 案例 ID | 功能 | 环境与证据 | 结果 |
| --- | --- | --- | --- |
| T-M07-14 | M07-F01 / F02 | I05 Windows Claude、WSL OpenCode；[真实报告](../../../artifacts/I05-real.json) | 新会话和续聊通过；原生默认配置继承 |
| T-M07-15 | M07-F01 / F02 | I05 WSL Codex | 新会话通过；续聊失败，原生 `list_turns` 不支持 |
| T-M07-16 | M07-F01 | I05 Windows Codex | 未通过；默认模型被账号拒绝，未替换模型 |
| T-M07-17 | M07-F01 / F02 / F07 | I06A WSL 开发机 → 独立 Linux OpenCode；[说明](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.md) | 两轮回复、原会话查询、断线期间执行及重连读取通过 |
| T-M07-18 | M07-F07 | I05 0.5.0 普通 EXE 重开；[发布观察](../../../artifacts/I05-portable.json) | 历史保留，无新增 Prompt；不代表 I06A Windows 发布验收 |

T-M07-17 的脚本使用原 conversationId 续聊，原始报告没有保存两轮 native Session ID 对比。报告据此标记“同桥接会话续聊通过”，原生 Session ID 相等的真实验收证据仍待补齐。

## 4. 指标、限制及待补验收

| 项目 | 已有结果 | 尚未证明 |
| --- | --- | --- |
| 重复请求 10 次 | 节点/daemon 受控测试 native 调用次数=1 | 任意第三方原生故障下的全局恰好一次事务 |
| 输入与输出边界 | UTF-8 裁剪、截断标记、分页与输出上限受控通过 | 所有原生工具/版本的无限长输出体验 |
| 权限/表单控制 | OpenCode 协议 fixture 与既有原生控制证据 | 所有适配器、全部表单类型；Codex 表单代答未完整实现 |
| SSH 断线恢复 | 独立 Linux 开发链路读取原任务通过 | 新 Windows EXE 同链路验收、完整恢复延迟指标 |
| 流式表现 | 原生增量 → 后台记录 → UI 快照链路存在 | token 级实时延迟指标；界面不能以碎片日志数量冒充完整答案数量 |

本模块的 unknown 是预期保护行为。没有原生绑定或可靠未执行证明时，测试应断言继续占用、查询不重放，而不是断言自动变为失败并释放。

## 5. 复现与后续维护

运行核心 `npm test`、桌面 `npm test --prefix desktop`。真实脚本见 [windows-i05-real.cjs](../../../desktop/tests/windows-i05-real.cjs)；Linux 开发验收脚本在 `.agentbridge-dev`，需要隔离 profile 与明确的目标机器。

修改任务协议、状态、waiting、operation 或 Session 恢复时，先补反例，随后更新 [设计](design.md)、本报告和对应迭代验收。报告须保留原失败与环境限制，不能把新建 Session 的回复记为原会话恢复通过。

## 2026-10-12：6A 收尾

| 用例 ID | 功能 | 场景 | 结果 |
| --- | --- | --- | --- |
| T-M07-19 | M07-F02 | DesktopHost 会话列表/详情对已完成 OpenCode 返回 canContinue=true；权限等待时返回 false | 通过；扩展 [desktop-host.test.ts](../../../tests/desktop-host.test.ts)，真实受控 Hub/Edge 集成。完整核心基线见 [TAP](../../../artifacts/I06A-final/root-tests.tap) |

真实两轮原生 Session 比较、关闭窗口、停止后台与重连回查按 [Windows 报告](../../../artifacts/I06A-real/report.json) 实际结果记录；不能用此受控用例替代真实模型验证。

## 当前 6A 候选验收结果

2026-10-12 / 0.6.0-alpha.2：[真实 Windows 窗口](../../../artifacts/I06A-real/report.json)与[普通便携程序](../../../artifacts/I06A-final/portable.json)均通过。两轮保持同一 Conversation/native Session，关闭窗口保留同一后台，明确停止后新 PID 保留身份/机器/历史，恢复只查询原任务；普通程序请求数不增加。专项覆盖边界见 [6A 候选验收](../../iterations/I06/acceptance.md)。

## I06B 当前验证入口

2026-10-12 / 0.6.0-alpha.6：T-M07-20 / M07-F06/F07：旧父活跃时换主/清主读控原子；父终态拒绝；图元数据恢复不提交新 Prompt。本次代码、命令、逐项结果与限制汇总于 [I06B 实施](../../iterations/I06/graph-implementation.md)。受控工程结果见 [桌面 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)、[核心 TAP](../../../artifacts/I06B/2026-10-12/root-tests.tap)，界面见 [UI](../../../artifacts/I06B/2026-10-12/ui.json)、[性能](../../../artifacts/I06B/2026-10-12/performance.json)，本次核心 43/43、桌面 110/110、Windows 图 10 组通过；性能 p95 30.0ms。独立 SSH 双向原生链、普通无 debug EXE 及源/包完整性分别通过，原始证据与范围见当次报告。历史表保留原日期/版本，不计为本次重新运行。


T-M07-21 / M07-F06：2026-10-12 / alpha.6，执行前拒绝的原请求只读核对及传输/缺收据反例通过；与 T-M02-15 为同一共享回归，不增加项目测试数。[测试](../../../desktop/tests/pending-journal.test.cjs)。已有任务终态和控制效果没有因该元数据拒绝而变化。

## alpha.9 节点管理下的来源与历史

T-M07-22 / M07-F01/F02/F06/F07：2026-10-13 / alpha.9。[AgentNetwork 回归](../../../desktop/tests/agent-network.test.cjs)验证保留 task/conversation/nodeId，断开/移除后的新需求与旧 IPC 续聊拒绝，原任务可读、恢复沿用原身份，忙碌/unknown 不释放；工程通过，共用本次 [125/125 桌面结果](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)。未重跑真实模型续聊、原生故障或有历史的全部视觉矩阵。[完整证据与限制](../../iterations/I06/node-management.md)。

## I06C alpha.10 当前专项

T-M07-23 / M07-F02/F03/F06/F07：2026-10-13。范围：机器编辑/移除不能释放任务、等待、unknown 或原 pending 占位；重连允许原意图未知且只读对账。中央私有已观察历史跨窗口/后台重开保留，后续分页不删除旧项；离线/移除下 task/conversation 可回 historical 快照，非终态 unknown，canContinue=false 且控制暂停。request/operation 收据不使用历史快照确认，恢复沿用原生 Session。 本次实际工程、隔离 TCP SSH、Windows 界面/包与未测项见 [6C 首批验收](../../iterations/I06/machine-management.md)；[桌面 TAP](../../../artifacts/I06C/2026-10-13/desktop-tests.tap)和当次报告是当前证据，alpha.6 双向真实 Agent 链保留原日期/版本。未改用户 profile、未升级用户 daemon、无真实模型任务，不将首批标为完整 I06C。

## alpha.13 当前验证

T-M07-16 / M07-F04/F05/F06：2026-10-14，WSL Ubuntu / Node 22.23.1，桌面受控回归 **150/150** 通过（全工程总数，模块之间不重复相加）。场景：原生 request/operation 的确认必须匹配原 ID、来源机器、Task/execution 绑定及明确状态。旧 confirmed 外壳内包含 native unknown 时恢复为 unknown；原 native rejected 收据可读且不重放。缺收据或缺原生终态继续占位。维护拒绝正在运行、等待或未知任务，停止/卸载保留原记录；台账损坏拒绝新写入，表单秘密值不落中央恢复台账。

证据：[完整桌面 TAP](../../../artifacts/I06C-final/2026-10-14/desktop-alpha13.tap)、[维护实际 daemon/process 7 项](../../../artifacts/I06C-final/2026-10-13/maintenance-tests.tap)、[包内容核验](../../../artifacts/I06C-final/2026-10-14/package-alpha13.json)。维护测试使用真实生产 daemon、Unix socket、独立进程和磁盘，原生 host 受控、无模型调用；不能替代独立服务器或真实原生控制。Windows 窗口、原生 Session 与双向链、使用/卸载、命令和限制统一见 [逐项验收](../../iterations/I06/final-delivery.md)，未实际执行项不得计为通过。

## alpha.13 本次独立实机补充

2026-10-14：冻结 alpha.13 Windows 包与独立 Linux，真实升级、同原生 Session 两轮及两方向协作通过；真实 Windows 取消和普通无调试窗口原生标记分别通过。独立 SSH/生产 daemon 的精确响应丢失、10 同 ID 与重启为受控执行器证据，不充当真实模型。Linux 文件任务受原生 OOM 退出影响，原 ID/Session 与 unknown 占位保留，未准出、未重发；后续 alpha.14 上传专项不冒充此模型矩阵复测。逐场景原始证据、版本、实际失败、临时自有资源调度及剩余项见 [I06C 当前实机记录](../../iterations/I06/final-delivery.md)。

2026-10-14：原 alpha.13 文件任务再次沿原 Task/Session 核对仍 unknown，新 Prompt=0。停止已空闲自有 Controller 后可用内存 478,204 KiB、无空闲 swap；基于已有原生 OOM 证据，本次不重复启动，finally 恢复自有观察。未推定成功/取消，不更新数据库终态；完整准出仍缺该原终态。[当前证据](../../iterations/I06/maintenance-launch-recovery.md)。


## 未确认操作资源范围专项（源码修复，未发布）

T-M07-24 / M07-F06/F07：2026-10-15 / WSL Ubuntu Node22.23.1 / alpha.19工作区修复。配置/准备错误保存未派发拒绝，重启对账和同 ID 不重放通过；协作续聊继承前后指纹均核对，当前查询配置错误不能解除未知任务。 定向40/40计入全桌面188/188，类型与前端构建通过；Windows Edge生产前端/受控API共4组通过，模型0。原始证据和复现见[当次专项](../../iterations/I06/pending-isolation.md)。未构建新EXE、未访问用户故障profile或独立服务器，不替代真实原生任务验收。

alpha.20候选追加验证（2026-10-15）：Windows普通无调试EXE/隔离合成配置拒绝恢复及关闭重开4组通过；最终生产前端/Windows Edge受控4组通过，模型0。包内源码匹配，原始证据统一见[专项](../../iterations/I06/pending-isolation.md)。这不改变上一段源码阶段“未构建EXE”的历史边界。

alpha.20已公开预发布：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/AgentBridge-0.6.0-alpha.20-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.20)。分发元数据和完整EXE下载摘要核验通过，源码标签9b2d5ea；不将分发成功扩大为用户故障或真实模型验收。[发布及证据](../../iterations/I06/pending-isolation.md)。

## 2026-10-16：小队原生等待观察

T-M07-120：基于alpha.23的未发布源码增量，WSL Linux / Node22.23.1。受控原执行与真实SQLite重启，模型0。小队自动化/公共空间/任务专项30/30（共享总数）通过，覆盖等待投影、脱敏、通知跨重启去重、unknown保留和终态清除，通知未增加执行；前端类型与构建通过。首次失败、完整TAP、复现和证据限制见[专项](../../iterations/I07/native-waiting.md)。未运行真实原生权限批准、Windows浏览器/EXE或独立SSH，未更新发布附件。
