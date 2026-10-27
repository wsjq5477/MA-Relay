# M02 中央协调后台测试报告

2026-10-27 / alpha.67候选：WSL握手与Hermes发现受控22/22，实际alpha.66冻结入口47188ms后就绪；原30秒就绪失败两次，均未发模型请求，原报告保留。候选实际模型、包及发布结果待本轮验收；不复用历史通过数。[本轮环境与原始证据](../../iterations/I08/alpha67-hermes-linux-live.md)。

## alpha.63普通窗口关闭后的原生MCP（2026-10-25）

普通无调试EXE + 系统Node24.18.0 + 原版Pi1.4.0 MCP组件七组通过；三次原窗/包装进程均退出0且解包文件删除，原生客户端仍可读取原工作/原包/完整接收收据。原生重开、三个不同解包路径和完整Coordinator重启后原端点身份/配置字节不变；最终所有原进程确认退出，模型0。仅原工作MCP22工具组件，非经典独立连接/托管任务/真实父模型，其他入口/SSH/跨版本仍待；共享组不相加。[最终证据与验收器收尾修复](../../iterations/I08/native-mcp-lifecycle.md)。

## CT-05原包传递与接收声明（2026-10-25）

WSL Node22.23.1隔离受控后端13项、生产Coordinator→真实stdio双客户端1项、审计校验/React渲染2项定向通过，模型0；原ID重启去重、准确旧版、撤权/终态、容量/磁盘回滚、无调度和损坏拒绝已覆盖。后续冻结alpha.63 Windows传递14/14、原收据4/4、关系37/37、兼容26/26、新审计页面5组/控制台6组和普通EXE6组通过；原生Pi→固定源码Hermes客户端7组通过，模型0。源码全量944/944、Core71/71；各模块共享结果不相加，真实父模型/独立SSH未验。[契约、原始证据与未测项](../../iterations/I07/context-delivery.md)。

2026-10-25本地alpha.62普通无调试EXE五组通过：窗口重开复用同一中央、完整中央重启读取原SQLite、原操作ID/完整指纹/结果精确保持，模型0。原产品实现无变化，[当前真实窗口与后台证据](../../iterations/I08/window-lifecycle-verifier.md)。

## #19/#20 修复验证

EXE与校验文件已公开，匿名完整下载HTTP200、130190265字节及SHA-256一致；[发布核验](../../iterations/I08/alpha52-release.md)。

2026-10-23，alpha.52公开版；M02-F03/F04。定向生命周期、中央资源与原请求回归131/131，远端/断开身份契约9/9，Windows生产前端12组通过、pageErrors=0；实际Windows进程检测识别日常OpenDesk运行并在隔离文件拒写，模型0。共享计数不跨模块累加；桌面共享全量841/841、核心68/68，类型/lint通过；普通无调试Windows EXE8组通过；包54后台/84Core/1702Linux与冻结源码一致，模型0。原失败、命令、原始证据及未测项见[本轮记录](../../iterations/I08/opendesk-lifecycle-relation-scope.md)。

## 连接身份与节点管理验证

| 场景 ID | 场景与实际结果 |
| --- | --- |
| T-M02-200 | 生产Coordinator路由：B仅一次manageNode且原A不被查询/重派；同节点、同adapter、同executable、共享目录、跨Windows/WSL目录、机器/关系和缺身份9组保守拒绝。 通过；2026-10-23，WSL Node22.23.1/Windows Node+Edge，模型0。 |

隔离修复基线桌面777/777，Windows生产前端受控10组通过；当前集成及普通EXE已随0.6.0-alpha.51.recovery.2公开，分层证据见发布记录。[原始证据、环境与未测项](../../iterations/I08/connection-identity-node-scope.md)。

## 后续原生组件验收（2026-10-22，alpha.46）

已安装OpenDesk/DSH原生MCP组件协议分别5组/6组通过；两条生产协作链各完成1个真实Claude子任务，并分别只读重开原任务/Session/结果，无重放。原生父模型自主决策与日常原生页面未验；产品运行代码与EXE未变，不把新增验收与原全量计数叠加。[脚本、初次失败、准确层级和未测项](../../iterations/I08/mcp-native-acceptance.md)。

## MCP02恢复与观测（2026-10-22）

Linux本机MCP主机在处理方法前等待私有端点恢复；remove在恢复失败时仍可撤权。不写原生配置、不借用执行主机处理MCP。 WSL Node22.23.1共享桌面758/758、根68/68通过，最终JSON修复后CLI11/11及类型/lint/核心构建通过；模型0，真实原生模型委派未测，Windows结果按专项登记。 [实现、原始证据与未测项](../../iterations/I08/mcp-open-recovery.md)。

2026-10-21 / M02 / alpha.40 源码：WSL Node22.23.1 定向97/97、全桌面705/705，计数共享不相加。真实阿里云 alpha.37/OpenCode2.0.26 只读确认原进程 OOM；用户批准临时Swap后原服务健康、原Task/Conversation各1→1、设置与Agent归属保留，原接入拒绝收敛，随后一次管理核验confirmed，Prompt新增0。此次为带外恢复，非新EXE/GUI/模型推理验收。[原始证据、失败与限制](../../iterations/I08/opencode-oom-recovery.md)。

## alpha.36整合边界

2026-10-21 / WSL Node22.23.1：本轮全量核心57/57、桌面676/676，类型/lint/前端构建通过。各模块共享计数不相加；包核验、Windows契约144/144、界面26组与普通EXE7组通过，具体以专项为准，真实模型/用户profile/独立SSH未验。[完整交付](../../iterations/I07/alpha36-delivery.md)。

## 扫描与原管理操作恢复专项

M02-F04；2026-10-20，alpha.34派生工作源码。Windows Edge生产前端受控IPC6组通过、页面错误0、模型0；覆盖扫描/查看可用、执行仍受锁、原管理来源/错误/ID可见、查询失败保留及匹配原收据后解除。当前全工程、普通EXE与包验证结果统一见[完整规则与分层验证](../../iterations/I07/agent-management-recovery.md)，计数共享不跨模块相加。当前用户profile只读诊断不是升级实测；真实模型、原profile切换与独立SSH未验。

2026-10-20 alpha.34发布门禁：中央hello增加`opencode-dual-api-v1`与`team-context-mcp-v1`语义能力，新前台遇到仍运行的alpha.33后台时要求显式停止并重开，设置/停止入口保留。避免新EXE复用旧2.x独占后台后仍拒绝1.x或缺MCP/材料方法；原任务、收据和unknown不改。

## 维护上传进度与持久化修复（issue #10）

M02-F04：本轮WSL专项7/7、相关42/42与核心51/51，Windows最终7/7及SSR66/66通过；最终全量/真实TCP/普通EXE/公开下载逐层记录。用户profile及独立服务器未验，共享计数不跨模块叠加。 [完整设计、实测与边界](../../iterations/I07/maintenance-persistence.md)。

## CT-05明确选材只读包

T-M02-151 / M02-F08：WSL Node22.23.1定向14/14（新6项）包含在全桌面576/576，Windows Node24.19.0同14项/真实命名管道与stdioMCP通过，零跳过、受控模型0。覆盖精确版本、旧消息/历史产物、任务过期/越权/撤权/终态scope、格式和UTF-8容量、完整state/receipt不变。真实Claude2.1.303一个成功Task、3次MCP读取及完整重开/重复观察仍1Task；各模块共享计数不相加。新EXE、其他工具实际消费/独立SSH及界面选材未验，源码晚于integrated.3冻结。[日志、脚本、环境首次失败与发布边界](../../iterations/I07/context-packet.md)。

## 整合源码与本地候选

T-M02-149 / M02-F01/F03/F04/F05/F08：核心51/51、桌面570/570零跳过（定向85/85及兼容15/15是相关子集），根类型/lint/构建与桌面构建通过。Windows前端26组/模型0，按历史/门禁/管理/材料/MCP分别记录；最终integrated.3普通Windows EXE五组通过：原历史/文档/MCP导出、窗口/后台重开、持久资源和原unknown保留，原生请求0；这是隔离合成profile，不是真实Agent模型或用户现场。包42 CJS/78核心/1446 Linux条目匹配，未部署用户SSH或跑真实模型。各模块共用计数不相加；首次夹具/原型失败与原历史证据保留。[版本、源码、所有原始结果和限制](../../iterations/I07/integrated-source.md)。

## issues #8/#9受控验证

M02-F04：核心51/51、桌面543/543（含版本/管理/原路由回归）、最后定向7/7及工程检查通过；Windows95项原路由/9项管理CJS、前端专项4组/既有10组及普通EXE5组通过；分发另按专项逐项记录。无真实模型/用户profile/独立服务器升级，不跨模块累加共享计数。 [需求、实现、验证与边界](../../iterations/I07/version-management-recovery.md)。

## issue #7 协作兼容修复

M02-F04：本轮仅受控HTTP/CLI、生产后台无推理、TCP SSH及Windows交付验收；用户现场/独立SSH/真实模型未测。实际执行结果、首次失败与最终工程/包证据统一引用专项，共享计数不跨模块叠加。 [完整需求、验证与交付](../../iterations/I07/collaboration-compatibility.md)。

## 独立 MCP 文件与配置增删

M02-F03/F05；日期2026-10-19，alpha.29后未发布工作区。WSL Node22.23.1受控全桌面537/537、核心45/45；真实原生列表三工具增删通过，Claude/OpenCode连接、Codex仅列表；Windows Edge155生产界面4组通过但机器/原生执行受控。计数为共享结果不跨模块相加，模型调用0。新EXE、真实Windows原生Agent、独立SSH与独立接入真实模型委派未测。源码/命令、首次失败、原始日志和逐层边界见[专项验收](../../iterations/I07/mcp-installation.md)。

## CT-04公共材料首片

T-M02-147 / M02-F08：2026-10-19，alpha.29之后未发布源码，WSL Node22.23.1。定向27/27（含新8项）和最终桌面525/525通过，零跳过，无模型；覆盖只读/精确旧版/分页、跨工作/撤权/原生终态scope拒绝、状态/报告白名单、Markdown和生产Coordinator→stdioMCP→broker路由。定向是全量子集，各模块共用计数不相加。另有真实Claude2.1.303一个成功Task、两次MCP读取、三组限定检查；索引文档当前2版时准确取得第1版，完整重开仍一个原Task。本片没有新EXE/其他工具/独立SSH或桌面导出验收。[原始日志、版本、复现及限制](../../iterations/I07/public-materials.md)。

## CT-02真实MCP六方向

T-M02-146 / M02-F04：WSL Node22.23.1，真实Claude2.1.302/Codex0.163.0-alpha.10.2/OpenCode2.0.24轮流作主并各委派给另两种工具；生产Coordinator/AgentNetwork/MachineHost/stdioMCP/broker/原生CLI或HTTP，非假dispatcher。共9个成功原生Task、6个委派方向、16次实际MCP调用；原父/目标/机器/派生ID/消息与真实结果核对，重开每链Task3→3/委派2。保护7/7计入全桌面517/517（模型0），不与真实或跨模块计数叠加。生产行为无变更；新三工具、新EXE、独立SSH、权限/表单及执行中断点未测。[完整脚本、逐次报告与边界](../../iterations/I07/connection-delegation.md)。

## CT-02首批真实直接生命周期

T-M02-145 / M02-F04：WSL Node22.23.1，真实Claude2.1.302、OpenCode2.0.24、Codex0.163.0-alpha.10.2沿生产Coordinator/AgentNetwork/MachineHost分别通过直接回答、原Session续聊、原任务取消及完整观察重开。共9个原任务，6成功回答/3取消；每工具观察任务3→3，无新增执行。恢复保护7/7和桌面510/510为受控共享计数，不与真实任务或跨模块相加；根45/45保留CT-01日期。本模块产品行为无变更，新三工具/真实委派方向/新EXE/独立SSH未验。[脚本、逐次原始报告、首次失败与完整限制](../../iterations/I07/connection-native.md)。

## CT-01连接能力与原拒绝恢复

T-M02-144 / M02-F04：alpha.28后未发布工作区，WSL Node22.23.1 / Windows Edge155。本机关系拒绝持久/重开、裸远端同码与其他lane保守unknown、外来confirmed/rejected不结算反例通过。共享定向32/32（全桌面503/503子集）、核心45/45及工程检查通过，无跳过；跨模块不相加。首次夹具失败及修正保留，真实新三工具/当前EXE/独立SSH未验。本轮模型0，先前真实Claude结果不计本轮。[脚本、命令、失败与最终原始证据](../../iterations/I07/connection-capabilities.md)。

## 真实原生执行成员公共文档链

T-M02-143 / M02-F10：同WSL三个独立Bridge宿主、真实Claude2.1.302，五组限定检查通过、五次自动原生回合；开发/复核各一轮、主协调沿原会话三轮。原生终态后验收及恢复不重放通过，原生权限回复/非Bridge工具/模型覆盖0。机器路由受控，非独立SSH、真实WindowsEXE或代码编译返修；共享真实计数不跨模块叠加。[脚本、原始日志与准确边界](../../iterations/I07/native-members.md)。

## 原生接入准入与核对收据

T-M02-142 / M02-F08：静态注册能力在新登记/新执行意图前检查，旧原ID恢复不被新门槛截获；snapshot可选投影不改变原节点身份。 最终合并源码串行桌面474/474、核心45/45及工程检查通过；受控CLI/磁盘/浏览器，模型0，未升级用户后台或重建EXE，不替代真实原生或独立SSH。[需求、原始失败、最终日志与未测边界](../../iterations/I07/native-integration-guards.md)。

## 当前工作区集成基线

T-M02-132：alpha.28加未发布UI/会话补丁，WSL Node22.23.1，受控进程/SQLite/SSH/HTTP/React SSR，模型0。核心45/45、串行全桌面375/375（含既有父/子测试）、lint/根类型/前端类型及构建通过，无测试跳过；保留既有chunk体积提示。共享计数不跨模块相加。[完整命令、原始日志和源码观察清单](../../iterations/I07/integration-baseline.md)。未验证新UI浏览器/Windows EXE、独立SSH或真实模型；模块行为无新改动，发布附件未更新。


## 会话异常与业务验收

T-M02-131：alpha.28之后的未发布源码，WSL Node22.23.1，真实SQLite/受控执行与业务报告，模型0。新增两项回归修复前均失败，修复后相关53/53通过；覆盖任务/直接总验收/提议后异常、历史轮次忽略和正常后续执行替代。原生succeeded事实保持，异常阻断业务验收。[完整证据及复现](../../iterations/I07/acceptance-native-binding.md)。未测试真实模型/Windows/独立SSH或重建EXE；共享计数不跨模块累加。


## 空白原生Session绑定保护

T-M02-130：alpha.28之后的未发布源码增量，WSL Node22.23.1，受控原生execute/query与真实SQLite，模型0。首次纯空白值不绑定/不自动续接，后续空值不清除已有有效绑定；两个反例修复前失败，修复后相关51/51（含父/子测试）通过，真正Session变化仍受既有反例约束。[证据与复现](../../iterations/I07/blank-native-session.md)。未实测真实CLI返回空值、Windows或独立SSH，未重建EXE；共享计数不跨模块累加。


## SSH持久拒绝恢复

T-M02-128：alpha.28已预发布，WSL Node22.23.1/Windows Node24.19.0，合成台账和受控TCP SSH，模型0。最终桌面317/317、核心45/45、Windows契约93/93，lint/类型/构建通过；真实TCP SSH丢响应/daemon重启1项及普通Windows无调试EXE合成验证6组通过，34 CJS/78 core/1395 Linux资源匹配源码。发布以[当次实际记录](../../iterations/I06/daemon-rejection-recovery.md)为准，不推定用户现场恢复。历史记录不计为本次重测。

## Windows恢复专项

T-M02-128：2026-10-17 / WSL Node22.23.1与Windows Node24.19.0 / alpha.27已预发布，模型0。Codex恢复10/10、共享原子写入10/10、网络最终50/50、Windows契约86/86；全桌面最终运行288/288、核心45/45及工程检查通过；新增alpha.26兼容文件另验10/10。共享计数不跨模块累加，Windows为受控目录/执行器，不是用户故障或真实模型。首轮限制/维护ENOENT与未测范围保留；最终普通Windows EXE对合成记录恢复/重开/重启/冻结源码共5组通过，包内33 CJS/78 core/1393 Linux条目一致；发布结果以[当片报告](../../iterations/I06/windows-start-persistence.md)后续实际记录为准。
## 首次续接回应的原Conversation校验

T-M02-127：alpha.25之后的未发布源码增量，WSL Node22.23.1，受控execute/query和真实SQLite，模型0。错误Conversation的running/succeeded两个反例修复前均失败；修复后相关48/48（含父测试/子场景）通过，错误回应保持unknown、不绑定外来会话，原request返回正确Conversation后恢复，execute总数仍2。[TAP、复现与限制](../../iterations/I07/intended-conversation.md)。未运行真实模型/EXE或独立SSH，未重建发布包；共享计数不跨模块累加。


## Windows原请求上下文恢复

T-M02-126 / M02-F04：alpha.25本地候选，WSL Node22.23.1/Windows Node24.19.0，受控记录，模型0。4个反例修复前全部失败，修复后专项48/48、串行桌面243/243、Windows契约17/17通过，原回执可恢复且缺回执仍unknown。共享计数不跨模块累加，包内33 CJS/78 core/1390 Linux资源一致；alpha.24普通EXE对照3组、alpha.25候选4组通过，原记录均为合成。候选包/普通EXE与失败日志见[专项](../../iterations/I06/windows-context-recovery.md)。未实测用户另一台电脑或真实原生模型，不改变GitHub alpha.24已发布冻结包。

## 不完整原生任务回应

T-M02-125：alpha.24未发布源码补丁，WSL Node22.23.1，受控原生执行查询/真实SQLite，模型0。5种身份缺失或无效输入修复前全部失败；修复后自动化/公共空间/任务/停止/路由45/45（含父测试/子场景）通过，原不完整succeeded保持unknown、原scope和占用保留，完整原请求可恢复且execute仅1次。[TAP、复现和边界](../../iterations/I07/incomplete-receipt.md)。未重建EXE或验证真实模型/独立SSH；共享计数不跨模块累加。


## 真实原会话续接后的权限

T-M02-124：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。三项检查通过，共两次自动回合、手动启动0；阶段2的task/request不同但Conversation/实际原生Session相同，每轮真实权限等待/观察后台重启/精确Write允许后成功。累计attempt/used/Write/权限命令各2，持久事件仅user_start/attention且pending0；完成重查未重派。[证据及复现](../../iterations/I07/resume-native-permission.md)，共享计数不跨模块累加。未测后续轮拒绝、执行成员交接、Windows或独立SSH；未更新包或发布。


## 真实自动主角色首轮权限

T-M02-123：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。两次事件自动原生回合、手动原生启动0，权限等待/观察后台重启、精确Write允许成功/拒绝failed三项检查通过；每项工作attempt/used各1、只有已消费user_start且pending0，原生Write和权限命令各合计2次。首次工具断言遗漏及修正后的只读恢复核对分别保留，[证据与复现](../../iterations/I07/auto-native-permission.md)。不是执行成员交接/原会话续接轮次、Windows或独立SSH，未更新EXE。共享真实证据不跨模块累计。


## 停止协调实际验证

T-M02-121 / M02-F11：2026-10-16，WSL Node22.23.1、Windows Node24.18.0/Edge155、真实Claude2.1.299。停止契约8项、生产Coordinator/AgentNetwork受控路由1项、Windows契约38项及界面7组通过；真实Claude原生停止/观察后台重启3组通过，原取消命令1次、原任务cancelled后归档。全工程/包/普通EXE、首次失败和准确边界统一见[当片报告](../../iterations/I07/native-stop.md)，这些共享计数不跨模块相加。未证明真实权限批准/拒绝链、独立SSH或其他原生适配取消。

## I07C首批实际验证

T-M02-110 / M02-F10：2026-10-16，WSL Node22.23.1、Windows Node24.18.0/Edge155。核心45/45、最终串行桌面222/222、Windows契约29/29；这些是全工程计数，跨模块不相加。Windows前端/真实Coordinator受控目录和成员10组，真实Claude2.1.299自动主角色3轮同Conversation/原Session、新scope、后台重启后实际X失败/Y通过及终态后总验收；执行成员为受控外部MCP、Node检查实际运行。最终包/普通EXE、首次连接恢复竞态和并行维护ENOENT分别保留证据，完整结果见[I07C首批报告](../../iterations/I07/automation.md)。未证明真实多原生角色、其他接入自动续接、用户自研/独立SSH或完整停止。

## I07B 实际验证

T-M02-101 / M02-F08/M02-F09：2026-10-16，WSL Node22.23.1、Windows Node24.18.0及Edge155。核心45/45、最终桌面208/208、Windows契约18/18；这是全工程计数，不跨模块重复相加。真实Claude两轮手动开发、独立MCP编译连接器实际Node检查X失败/Y通过、MCP协调员验收；Windows生产前端/Coordinator受控目录7组通过、模型0。首次原有daemon启动失败、重查及最终包/普通EXE的实际结果均见[I07B报告](../../iterations/I07/task-handoff.md)。未验证用户自研产品、独立SSH小队链、OpenCode/Codex任务闭环或I07C自动激活。


## I07A 实际验证

2026-10-15 / WSL Node22.23.1、Windows Node24.18.0 / 源码alpha.21，GitHub预发布alpha.20。

| 用例 | 功能 | 结果与证据边界 |
| --- | --- | --- |
| T-M02-100 | M02-F08 | 受控事务/重启/重复处理与原生准入回归通过；Windows普通EXE持久化以交付报告为准。 |

原始证据、工程总数及真实工具/界面/普通EXE分别见[I07A交付](../../iterations/I07/delivery.md)。[核心45/45](../../../artifacts/I07A/2026-10-15/root-tests.tap)、[桌面197/197](../../../artifacts/I07A/2026-10-15/desktop-tests.tap)为全工程计数，不在本模块重复相加；I07B/C能力不计为已通过。


## 当前专项

2026-10-14 / WSL Ubuntu / Node 22.23.1 / 源码 0.6.0-alpha.18：共享缓存自引用/旧清单/损坏旁路重建、Windows OpenCode 原意图恢复与并发保护、查询结果和脱敏原因；定向 55/55（计入桌面全量 176/176），根 43/43，lint/类型/构建通过。受控文件/宿主测试，无模型调用。原始证据：[定向](../../../artifacts/runtime-recovery/2026-10-14/targeted.tap)、[全桌面](../../../artifacts/runtime-recovery/2026-10-14/desktop-tests.tap)。Windows 真实 Electron 资源 4 组、Edge 受控 UI 3 组、普通无调试 EXE/合成原意图与关闭重开 4 组均通过；包校验 28 CJS / 1383 Linux 文件与当前源码匹配。详细过程及边界按 [完整专项](../../iterations/I06/runtime-recovery.md) 的实际结果判定，不将历史原生证据提升为本次重测。


历史基线：2026-10-14 / 0.6.0-alpha.13。工程与受控维护验证通过，独立服务器/最终程序专项按 [I06C 收尾](../../iterations/I06/final-delivery.md) 实际状态记录；旧版本段落保持原日期。
更新：2026-10-12。当前源码候选版本 0.6.0-alpha.6；本次全桌面 106 项通过，图/包/真实验收见 I06B。原 alpha.2 的 Coordinator 专属 3 项受控测试、全桌面 88 项是历史基线；设置页已提供普通关闭与明确停止。真实 Windows 生命周期结果单列，不把 IPC 客户端测试称为真实窗口。

## 1. 基线与证据

| 证据 | 日期/结果 | 可证明的范围 |
| --- | --- | --- |
| [桌面 TAP](../../../artifacts/docs-baseline/2026-10-12/desktop-tests.tap) | 2026-10-12，87/87 通过，0 失败、0 跳过 | 桌面全部自动化回归；Coordinator 专属用例 2 个，其余相关用例共享归属 |
| [核心 TAP](../../../artifacts/docs-baseline/2026-10-12/root-tests.tap) | 2026-10-12，43/43 通过 | 根执行与持久化回归，不证明 Windows 命名管道/DPAPI |
| [已有真实服务器记录](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.md) / [原始报告](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.json) | 2026-10-10，开发端到真实 Linux 已跑通 | 开发端后台重启、原机器重连、原请求读取；不是本次新执行 |

证据级别：**受控**表示真实模块 + 隔离服务/输入；**集成**表示真实 Bridge 进程和持久化；**真实**表示实际服务器/原生 Agent；**静态**表示源码或资源检查；**未测**表示没有对应运行证据。数字是整套基线计数，不按模块重复累加。

## 2. 功能与已执行用例

| 用例 ID | 功能 ID | 实际用例名/来源 | 结果与证据级别 |
| --- | --- | --- | --- |
| T-M02-01 | M02-F01/F02/F05 | `two windows share one coordinator; closing clients retains requests, wrong local credentials are rejected`，[coordinator.test.cjs](../../../desktop/tests/coordinator.test.cjs) | 通过，受控：同 PID、客户端关闭不关闭服务、错误身份拒绝、第二服务被占用锁拒绝。测试中的 two windows 是两个 IPC 客户端，没有启动 Electron 窗口 |
| T-M02-02 | M02-F01/F05 | `coordinator source identity survives restart and local UTF8 frames remain complete`，同上 | 通过，受控：重启 ID 不变、中文/emoji 完整 |
| T-M02-03 | M02-F03 | `one failed source keeps healthy results and marks only cached active tasks uncertain`；`changing the selected machine preserves other hosts and their running work`，[machine-router.test.cjs](../../../desktop/tests/machine-router.test.cjs) | 通过，受控路由回归；共享 M03 证据 |
| T-M02-04 | M02-F04 | `automatic receipt recovery preserves the original entry and records the reconciliation`；`recovery does not overwrite a concurrently updated journal entry`，[main.test.cjs](../../../desktop/tests/main.test.cjs) | 通过，受控台账；测试复用 `coordinator-service.cjs`，不是真窗口操作 |
| T-M02-05 | M02-F04 | `transport uncertainty blocks a new ID and instance switch, permits readonly query, and keeps original journal`，同上 | 通过，受控：不确定状态阻止新写入，允许只读核对 |
| T-M02-06 | M02-F04 | `accepted original request is confirmed by its receipt without sending a prompt`，[pending-journal.test.cjs](../../../desktop/tests/pending-journal.test.cjs) | 通过，受控；恢复过程没有二次发送 |
| T-M02-07 | M02-F02/F03/F04 | 真实记录第 9/10 项及 `verify-reconnect.cjs` | 通过，真实/既有：开发端后台重启，重连原 Linux machineId，读取原任务与会话；未复测 Windows |
| T-M02-08 | M02-F06 | `detached runtime survives portable extraction cleanup and retains license`；`missing ICU or V8 resources reject startup before admitting a native task`，[worker-runtime.test.cjs](../../../desktop/tests/worker-runtime.test.cjs) | 通过，受控：模拟 Electron 文件资源，不是新 EXE 的真实清理过程 |

## 3. 验收缺口与限制

| 用例 ID | 功能 ID | 未完成项 | 当前结论 |
| --- | --- | --- | --- |
| T-M02-09 | M02-F01/F02/F06 | 0.6.0-alpha.2 窗口关闭/重开、便携 wrapper 退出后同 PID/原任务回读 | 通过；[真实窗口](../../../artifacts/I06A-real/report.json)、[普通 EXE](../../../artifacts/I06A-final/portable.json)；不能扩大为所有系统 ACL 用户边界 |
| T-M02-10 | M02-F05 | 实际 Windows 身份目录 ACL、命名管道错误用户隔离、DPAPI 用户边界 | 未测；当前自动化为 Linux 身份文件权限与错误令牌测试 |
| T-M02-11 | M02-F07 | 设置页明确停止，验证后台 PID 退出；新窗口启动新 PID、保留身份并恢复原机器/任务 | 通过；[真实窗口](../../../artifacts/I06A-real/report.json)，恢复阶段新 Prompt=0 |
| T-M02-12 | M02-F01/F06 | 运行旧后台时打开新版客户端、冻结依赖/离线包更新一致性 | 未单独验收；附着只校验协议与身份，资源摘要未覆盖全部依赖内容 |

`main.test.cjs` 的测试名称沿用旧主进程台账命名，但测试入口已加载 `coordinator-service.cjs`。维护者应按测试实际加载对象判断覆盖范围。

## 4. 可复制复查命令

在仓库根目录，使用 Node ≥22.13：

```bash
node --test desktop/tests/coordinator.test.cjs desktop/tests/main.test.cjs desktop/tests/pending-journal.test.cjs desktop/tests/worker-runtime.test.cjs
npm test --prefix desktop
```

若运行生产后台的集成测试，先 `npm run build` 生成根 `dist`。上述自动化使用临时测试目录，不连接用户服务器、不发送真实模型需求，也不修改原生模型/账号配置。真实 `verify-reconnect.cjs` 使用开发 SSH 配置，可能启动后台和远端 daemon，不应作为日常无副作用单元测试自动执行。

下次改动生命周期、IPC 或台账后，更新本报告的日期、测试名、原始证据和未测项，同时更新 [设计](design.md)与当期迭代记录。旧结论保留在对应迭代历史中，不能把未运行的新环境改成通过。

## 6A 收尾

新增受控用例 `explicit shutdown closes coordination while ordinary client close leaves it running` 已通过。Coordinator 专属回归现在为 3 项，全桌面为 88 项：[最新 TAP](../../../artifacts/I06A-final/desktop-tests.tap)。界面停止/取消/普通关闭通过隔离验证：[SSH UI](../../../artifacts/I06A-ssh-ui.json)。真实 Windows 包生命周期见 [窗口报告](../../../artifacts/I06A-real/report.json)，只按该报告实际 status 判定。

## 当前 6A 候选验收结果

2026-10-12 / 0.6.0-alpha.2：[真实 Windows 窗口](../../../artifacts/I06A-real/report.json)与[普通便携程序](../../../artifacts/I06A-final/portable.json)均通过。两轮保持同一 Conversation/native Session，关闭窗口保留同一后台，明确停止后新 PID 保留身份/机器/历史，恢复只查询原任务；普通程序请求数不增加。专项覆盖边界见 [6A 候选验收](../../iterations/I06/acceptance.md)。

## 新窗口管理旧后台

2026-10-12 / alpha.4 新窗口、实际 alpha.2 Coordinator / 隔离 Windows/WSL profile。验证新窗口自己的设置页可连接并停止同 profile 的已认证旧后台，旧窗口已关闭，之后重开新窗口核对版本与配置身份。产品代码未修改，最终结果见 [真实报告](../../../artifacts/new-client-stop/2026-10-12/report.json)、[脚本](../../../desktop/tests/windows-new-client-stop-old.cjs)、[范围说明](../../iterations/I06/client-background-operation.md)；未停止用户生产后台，未提交原生模型需求。

该场景最终通过：旧后台 IPC 停止，新窗口重开得到 alpha.4 后台，新 PID 与原配置身份核对正确。此结果来自上述实际隔离窗口，不代表用户生产配置已被自动切换。


## 当前 alpha.5 恢复错误清理验证

T-M02-13 / M02-F03：2026-10-12 / alpha.5，新增 2 项受控状态回归、全桌面 95/95，通过。旧版本报错在恢复成功后撤销并持久化，旧目录成功快照不继承错误，新的 RPC/主机密钥错误仍显示；原连接/接入节点/任务历史保持。Windows 当前前端的受控快照卡片渲染 2 项通过。原用户状态只读核验，不是新包实际远端重连或模型验收。[本次测试与范围](../../iterations/I06/ssh-error-recovery.md)、[TAP](../../../artifacts/ssh-error-clear/2026-10-12/desktop-tests.tap)、[UI](../../../artifacts/ssh-error-clear/2026-10-12/ui.json)。

## I06B 当前验证入口

2026-10-12 / 0.6.0-alpha.6：T-M02-14 / M02-F04：独立图意图台账、稳定收据与提交前后实际隔离进程 SIGKILL；恢复只查询，未确认不能换 ID；模型调用数为零。本次代码、命令、逐项结果与限制汇总于 [I06B 实施](../../iterations/I06/graph-implementation.md)。受控工程结果见 [桌面 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)、[核心 TAP](../../../artifacts/I06B/2026-10-12/root-tests.tap)，界面见 [UI](../../../artifacts/I06B/2026-10-12/ui.json)、[性能](../../../artifacts/I06B/2026-10-12/performance.json)，本次核心 43/43、桌面 110/110、Windows 图 10 组通过；性能 p95 30.0ms。独立 SSH 双向原生链、普通无 debug EXE 及源/包完整性分别通过，原始证据与范围见当次报告。历史表保留原日期/版本，不计为本次重新运行。


T-M02-15 / M02-F04：2026-10-12 / alpha.6，原请求只读返回确定执行前 AGENT_UNHEALTHY 才 settle rejected；NOT_FOUND、DESKTOP_UNCONFIRMED、传输失败继续原占位。查询保持原 machineId/requestId，提交调用数=0；通过。[共享恢复测试](../../../desktop/tests/pending-journal.test.cjs)、[全桌面 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)。

## 当前节点管理专项

T-M02-16 / M02-F04：2026-10-13 / 0.6.0-alpha.9。范围：node/relation 意图互锁，原生 pending 拦截，来源机器规范化，确定拒绝原收据查询和未知不重放。逐项实际结果、环境、脚本、原始证据与未测范围见 [节点管理完整验收](../../iterations/I06/node-management.md)。工程证据为本次 [桌面 TAP](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)；窗口/程序/包状态以该报告实际结果为准，历史表不充当本次重测。原生 SSH/模型链保留 alpha.6 历史结果，本次未重跑、不改用户 profile、不提交 Prompt。

## I06C alpha.10 当前专项

T-M02-17 / M02-F03/F04：2026-10-13。范围：中央服务为 SSH 管理加入稳定原 ID、修订、来源准入锁和秘密字段白名单。危险动作核对来源全部非终态任务、实例/节点/上下文/目录锁及原 native pending；重连仅恢复观察，不因任务 unknown 禁用。machine、node、relation 未知共享屏障，layout 独立；查询原 SSH 收据可按原 ID 补齐网络本地撤权，跨文件中断不重发远端任务。 本次实际工程、隔离 TCP SSH、Windows 界面/包与未测项见 [6C 首批验收](../../iterations/I06/machine-management.md)；[桌面 TAP](../../../artifacts/I06C/2026-10-13/desktop-tests.tap)和当次报告是当前证据，alpha.6 双向真实 Agent 链保留原日期/版本。未改用户 profile、未升级用户 daemon、无真实模型任务，不将首批标为完整 I06C。

## 当前验证

T-M02-18 / M02-F03/F04：2026-10-14，WSL Ubuntu / Node 22.23.1，桌面受控回归 **150/150** 通过（全工程总数，模块之间不重复相加）。场景：machine.maintainDaemon 经过稳定操作意图、来源机器准入和配置白名单，再交给 SSH 管理执行；machine.operation 只核对原维护。机器/node/relation 的 unknown 共用元数据屏障，layout 独立；直接 MCP 原生准入也检查该来源机器。pending.json 损坏或无法持久化时拒绝执行，不能当作空表。表单答案仅保留摘要与 [redacted]，恢复依赖原目标/ID，不持久化敏感答案或任意原生返回正文。

证据：[完整桌面 TAP](../../../artifacts/I06C-final/2026-10-14/desktop-alpha13.tap)、[维护实际 daemon/process 7 项](../../../artifacts/I06C-final/2026-10-13/maintenance-tests.tap)、[包内容核验](../../../artifacts/I06C-final/2026-10-14/package-alpha13.json)。维护测试使用真实生产 daemon、Unix socket、独立进程和磁盘，原生 host 受控、无模型调用；不能替代独立服务器或真实原生控制。Windows 窗口、原生 Session 与双向链、使用/卸载、命令和限制统一见 [逐项验收](../../iterations/I06/final-delivery.md)，未实际执行项不得计为通过。

## 本次独立实机补充

2026-10-14：冻结 alpha.13 Windows 包与独立 Linux，真实升级、同原生 Session 两轮及两方向协作通过；真实 Windows 取消和普通无调试窗口原生标记分别通过。独立 SSH/生产 daemon 的精确响应丢失、10 同 ID 与重启为受控执行器证据，不充当真实模型。Linux 文件任务受原生 OOM 退出影响，原 ID/Session 与 unknown 占位保留，未准出、未重发；后续 alpha.14 上传专项不冒充此模型矩阵复测。逐场景原始证据、版本、实际失败、临时自有资源调度及剩余项见 [I06C 当前实机记录](../../iterations/I06/final-delivery.md)。


## 未确认操作资源范围专项（源码修复，未发布）

T-M02-19 / M02-F04/F06：2026-10-15 / WSL Ubuntu Node22.23.1 / alpha.19工作区修复。原台账只按同节点/共享目录限制新执行，真实目录就绪后复查；准备拒绝与原意图匹配后恢复，原未知记录不删除。 定向40/40计入全桌面188/188，类型与前端构建通过；Windows Edge生产前端/受控API共4组通过，模型0。原始证据和复现见[当次专项](../../iterations/I06/pending-isolation.md)。未构建新EXE、未访问用户故障profile或独立服务器，不替代真实原生任务验收。

alpha.20候选追加验证（2026-10-15）：Windows普通无调试EXE/隔离合成配置拒绝恢复及关闭重开4组通过；最终生产前端/Windows Edge受控4组通过，模型0。包内源码匹配，原始证据统一见[专项](../../iterations/I06/pending-isolation.md)。这不改变上一段源码阶段“未构建EXE”的历史边界。

alpha.20已公开预发布：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/AgentBridge-0.6.0-alpha.20-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.20)。分发元数据和完整EXE下载摘要核验通过，源码标签9b2d5ea；不将分发成功扩大为用户故障或真实模型验收。[发布及证据](../../iterations/I06/pending-isolation.md)。

## 小队原生等待观察

T-M02-120：基于alpha.23的未发布源码增量，WSL Linux / Node22.23.1。受控原执行与真实SQLite重启，模型0。小队自动化/公共空间/任务专项30/30（共享总数）通过，覆盖等待投影、脱敏、通知跨重启去重、unknown保留和终态清除，通知未增加执行；前端类型与构建通过。首次失败、完整TAP、复现和证据限制见[专项](../../iterations/I07/native-waiting.md)。未运行真实原生权限批准、Windows浏览器/EXE或独立SSH，未更新发布附件。
