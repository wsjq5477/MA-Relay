# M03 机器与 Agent 网络测试报告

## #19/#20 修复验证

EXE与校验文件已公开，匿名完整下载HTTP200、130190265字节及SHA-256一致；[发布核验](../../iterations/I08/alpha52-release.md)。

2026-10-23，alpha.52公开版；M03-F04/F05。定向生命周期、中央资源与原请求回归131/131，远端/断开身份契约9/9，Windows生产前端12组通过、pageErrors=0；实际Windows进程检测识别日常OpenDesk运行并在隔离文件拒写，模型0。共享计数不跨模块累加；桌面共享全量841/841、核心68/68，类型/lint通过；普通无调试Windows EXE8组通过；包54后台/84Core/1702Linux与冻结源码一致，模型0。原失败、命令、原始证据及未测项见[本轮记录](../../iterations/I08/opendesk-lifecycle-relation-scope.md)。

## 连接身份与节点管理验证

| 场景 ID | 场景与实际结果 |
| --- | --- |
| T-M03-200 | 真实临时私有配置保存A/B、重建AgentNetwork与显式扫描；旧A字节不变、token不进入公开状态/台账；错机器/adapter/回应/丢失文件及EBUSY绑定失败保持原选择。 通过；2026-10-23，WSL Node22.23.1/Windows Node+Edge，模型0。 |

隔离修复基线桌面777/777，Windows生产前端受控10组通过；当前集成及普通EXE已随0.6.0-alpha.51.recovery.2公开，分层证据见发布记录。[原始证据、环境与未测项](../../iterations/I08/connection-identity-node-scope.md)。

2026-10-23 / alpha.50未改包补验：本地20次落盘→DOM同步p95 1513ms通过；20组/60节点/59边的20次真实拖动观测上界p95 117.9ms未达到100ms门槛，未记录>500ms卡顿。WSL启动9/20通过/11次就绪前退出、失败写入0，原始WSL/PowerShell也复现；根因未定位。包与源码一致性重核通过，EXE未变；模型0，未重跑原全量，不替代独立LAN/SSH或原生模型。[本轮完整样本、失败、脚本与限制](../../iterations/I06/current-candidate-metrics.md)。
2026-10-23 / alpha.50本地候选：共享桌面794/794、核心68/68，工程与最终包核验通过；Pi原生Linux/Windows各5组、Hermes固定官方源码原生组件5组、Windows生产前端5组/普通EXE4组通过，模型0。原生阶段/受控发现、首次YAML与验收脚本/受限socket失败分别保留；真实自主父模型、Hermes正式安装版/Windows原生、独立SSH及完整矩阵未准出。共享计数不相加。 [最终实现、原始证据与范围](../../iterations/I08/hermes-mcp-config.md)。

2026-10-23 / alpha.49，WSL Node22.23.1：共享桌面770/770、核心68/68、类型/lint/生产构建和最终包/bootstrap一致性通过；普通Windows EXE4组通过，模型0。新启动受控契约4项在全量内，真实生产WSL只读三次中2次通过/1次就绪前退出；最终包真实Windows→WSL MCP组件5组通过，包含原生Codex0.162.1及Linux stdio调用/重开/撤权/轮换/清理；稳定性、原生父模型与独立SSH尚未准出，失败不抹除。共享计数不跨模块累加。 [完整需求、实现、原始证据与限制](../../iterations/I08/wsl-host-readiness.md)。

## DSH Desktop原生MCP（2026-10-22）

M03-F02；2026-10-22，alpha.48候选。静态能力含Desktop原生配置，旧后台明确false仍收窄；SSR与能力门禁用例通过，Windows前端4组使用受控机器发现，不冒充真实扫描或独立SSH。桌面766/766、核心68/68共享，模型0。 [开发、原始失败与分层验收](../../iterations/I08/dsh-desktop-mcp.md)。

## 后续原生组件验收（2026-10-22，alpha.46）

已安装OpenDesk/DSH原生MCP组件协议分别5组/6组通过；两条生产协作链各完成1个真实Claude子任务，并分别只读重开原任务/Session/结果，无重放。原生父模型自主决策与日常原生页面未验；产品运行代码与EXE未变，不把新增验收与原全量计数叠加。[脚本、初次失败、准确层级和未测项](../../iterations/I08/mcp-native-acceptance.md)。

2026-10-22 / OpenDesk Desktop 0.3.9：已安装原网关的真实执行、续聊与普通EXE窗口重开通过；日常后台等待原任务成功后由alpha.37正常切换至alpha.42，生产发现及快照列出原Windows机器的健康OpenDesk Desktop节点（尚未接入），原任务结果与机器/授权保留。无运行代码变更，不将历史自动测试计为今日重跑。分层计数与未测项见[现场专项](../../iterations/I08/opendesk-desktop-live.md)。
OpenDesk相关验证统一见[专项报告](../../iterations/I08/opendesk-existing-interfaces.md)，明确受控协议、真实原生启动、模型和Windows包的独立范围；共享计数不跨模块累加，未执行项保持未测。

2026-10-21 / M03-F02 / alpha.40 源码：WSL Node22.23.1 定向97/97、全桌面705/705，计数共享不相加。真实阿里云 alpha.37/OpenCode2.0.26 只读确认原进程 OOM；用户批准临时Swap后原服务健康、原Task/Conversation各1→1、设置与Agent归属保留，原接入拒绝收敛，随后一次管理核验confirmed，Prompt新增0。此次为带外恢复，非新EXE/GUI/模型推理验收。[原始证据、失败与限制](../../iterations/I08/opencode-oom-recovery.md)。

## alpha.36整合边界

2026-10-21 / WSL Node22.23.1：本轮全量核心57/57、桌面676/676，类型/lint/前端构建通过。各模块共享计数不相加；包核验、Windows契约144/144、界面26组与普通EXE7组通过，具体以专项为准，真实模型/用户profile/独立SSH未验。[完整交付](../../iterations/I07/alpha36-delivery.md)。

## OpenCode 包内宿主复核

2026-10-21 / WSL Node22.23.1：现有本地alpha.35.config.2冻结包生产stdio/daemon入口2/2通过，完整EXE摘要及包一致性重核通过。公开alpha.35冻结b5de577仍为缺close旧工厂；本轮未重下公开EXE、重跑普通Windows EXE或验证用户profile/真实模型。[本轮证据与切换步骤](../../iterations/I07/opencode-host-lifecycle.md)。

## Agent 行配置入口验证

M03-F02/F05；2026-10-21，alpha.34派生工作源码。生产SSR82/82（含新增6项）及Windows Edge生产界面受控IPC8组通过；覆盖目标固定、迟到响应隔离、DSH精确安装/入口、secret清空、写入在途/离线限制和窄窗口。完整桌面649/649、核心57/57通过，生产MCP临时文件4组、既有DSH前端3组保持；普通EXE与候选证据统一见[专项](../../iterations/I07/agent-row-configuration.md)，共享计数不跨模块相加。未在用户profile修改原生配置、未调用真实模型或升级独立SSH。

## CT-07当前调用方连接视图

T-M03-154 / M03-F02：2026-10-21，alpha.34派生未发布源码；WSL Node22.23.1冻结桌面643/643零跳过/退出0，定向103/103为其子集，新增11项含原父查询/快照等待期间4个并发子场景；Windows Node24.19.0同视图与原列表18/18。覆盖角色/授权原因、空参数、来源机器/父终态/unknown、独立MCP身份/立即撤权、原请求身份与执行次数保留；Core构建通过。共用计数不相加，模型0；原生模型/新EXE/独立SSH未验，首次错误断言与真实snapshot观察写回分开保留。[完整契约、日志与范围](../../iterations/I07/agent-connections.md)。

## 扫描与原管理操作恢复专项

M03-F02/F05；2026-10-20，alpha.34派生工作源码。Windows Edge生产前端受控IPC6组通过、页面错误0、模型0；覆盖扫描/查看可用、执行仍受锁、原管理来源/错误/ID可见、查询失败保留及匹配原收据后解除。当前全工程、普通EXE与包验证结果统一见[完整规则与分层验证](../../iterations/I07/agent-management-recovery.md)，计数共享不跨模块相加。当前用户profile只读诊断不是升级实测；真实模型、原profile切换与独立SSH未验。

## OpenCode 宿主生命周期回归

M03-F02：2026-10-20 / alpha.34 后工作源码 / WSL Node22.23.1。两条生产入口旧工厂回放均失败，修复后桌面相关 28/28、核心会话 2/2 通过，含等待任务关闭门面后原 Task/Session 和 Prompt 计数保持。均为受控测试，共享计数不跨模块累加；未验证用户 profile、真实模型、Windows EXE 或独立 SSH。[原始日志、命令与限制](../../iterations/I07/opencode-host-lifecycle.md)。

## DSH Desktop / Web 专项

当前本地.dsh.3候选：核心56/56、完整桌面607/607、Windows DSH11/11、生产前端3组及普通EXE6组通过；真实Windows/WSL认证与接口通过，Desktop同Session两轮及去重已观察，但模型均RATE_LIMIT，WSL模型/独立SSH未测。[当前源码、包与分层证据](../../iterations/I07/dsh-exe-delivery.md)。以下保留各先前冻结范围。

M03-F02：本轮WSL Node22.23.1发现/服务/能力34/34、全桌面606/606零跳过；真实系统dsh排除、原生Web profile提示和Windows安装文件只读核对符合预期。Windows新补验未取得有效输出，不计通过；没有原实例认证/模型/新EXE/独立SSH。[本轮日期、失败、最终日志与边界](../../iterations/I07/dsh-desktop-web.md#同名程序与服务发现修复)，下段是前片共享证据。

M03-F02/F05：本次WSL受控HTTP/独立worker与方向能力、Windows Node契约、Edge生产前端及失败记录统一见[本轮完整契约与证据](../../iterations/I07/dsh-desktop-web.md)，工程总数不跨模块相加。Windows当前安装2.0.18/认证屏障和WSL Web profile是环境核对；未在原实例调用模型，不作为真实原生、发布包或独立SSH验收。

## OpenCode 1.x / 2.x 兼容修复

M03-F01/F02/F03：原 PATH 与原安装核验不变；OpenCode 可识别 1.x/2.x 都可进入实际服务契约检查，未知主版本继续明确拒绝。只读原对象/收据和按机器占位规则不变。 本次共用专项的全套日志，不跨模块累加；受控测试、官方 CLI 加受控传输与未测 Windows/SSH/真实模型分列。 [需求、实现、验证与未测边界](../../iterations/I07/opencode-v1-compatibility.md)。

## 维护上传进度与持久化修复（issue #10）

M03-F04：本轮WSL专项7/7、相关42/42与核心51/51，Windows最终7/7及SSR66/66通过；最终全量/真实TCP/普通EXE/公开下载逐层记录。用户profile及独立服务器未验，共享计数不跨模块叠加。 [完整设计、实测与边界](../../iterations/I07/maintenance-persistence.md)。

## 整合源码与本地候选

T-M03-149 / M03-F02/F04/F05/F06：核心51/51、桌面570/570零跳过（定向85/85及兼容15/15是相关子集），根类型/lint/构建与桌面构建通过。Windows前端26组/模型0，按历史/门禁/管理/材料/MCP分别记录；最终integrated.3普通Windows EXE五组通过：原历史/文档/MCP导出、窗口/后台重开、持久资源和原unknown保留，原生请求0；这是隔离合成profile，不是真实Agent模型或用户现场。包42 CJS/78核心/1446 Linux条目匹配，未部署用户SSH或跑真实模型。各模块共用计数不相加；首次夹具/原型失败与原历史证据保留。[版本、源码、所有原始结果和限制](../../iterations/I07/integrated-source.md)。

## issues #8/#9受控验证

M03-F01/F02/F03：核心51/51、桌面543/543（含版本/管理/原路由回归）、最后定向7/7及工程检查通过；Windows95项原路由/9项管理CJS、前端专项4组/既有10组及普通EXE5组通过；分发另按专项逐项记录。无真实模型/用户profile/独立服务器升级，不跨模块累加共享计数。 [需求、实现、验证与边界](../../iterations/I07/version-management-recovery.md)。

## issue #7 协作兼容修复

M03-F01/F02/F03：本轮仅受控HTTP/CLI、生产后台无推理、TCP SSH及Windows交付验收；用户现场/独立SSH/真实模型未测。实际执行结果、首次失败与最终工程/包证据统一引用专项，共享计数不跨模块叠加。 [完整需求、验证与交付](../../iterations/I07/collaboration-compatibility.md)。

## 历史详情路由与局部错误

T-M03-150 / M03-F04/F05/F06：alpha.30隔离修复；合成路由6项、受控TCP SSH1项、Windows纯CJS91/91、Linux SSR63/63，新生产前端7组和既有10组通过，模型0。最终桌面529/529、核心45/45、lint/类型/构建通过；38 CJS/78 core/1401 Linux资源匹配145个冻结源文件。普通Windows无调试EXE合成原两轮/Session只读与关闭重开/后台重启4组通过。分发实际结果及首次失败统一见[当次专项](../../iterations/I07/history-detail-recovery.md)；共享计数不跨模块叠加，用户故障profile/独立服务器未复测。

## CT-02真实MCP六方向

T-M03-146 / M03-F04/F05：WSL Node22.23.1，真实Claude2.1.302/Codex0.163.0-alpha.10.2/OpenCode2.0.24轮流作主并各委派给另两种工具；生产Coordinator/AgentNetwork/MachineHost/stdioMCP/broker/原生CLI或HTTP，非假dispatcher。共9个成功原生Task、6个委派方向、16次实际MCP调用；原父/目标/机器/派生ID/消息与真实结果核对，重开每链Task3→3/委派2。保护7/7计入全桌面517/517（模型0），不与真实或跨模块计数叠加。生产行为无变更；新三工具、新EXE、独立SSH、权限/表单及执行中断点未测。[完整脚本、逐次报告与边界](../../iterations/I07/connection-delegation.md)。

## CT-02首批真实直接生命周期

T-M03-145 / M03-F04/F05：WSL Node22.23.1，真实Claude2.1.302、OpenCode2.0.24、Codex0.163.0-alpha.10.2沿生产Coordinator/AgentNetwork/MachineHost分别通过直接回答、原Session续聊、原任务取消及完整观察重开。共9个原任务，6成功回答/3取消；每工具观察任务3→3，无新增执行。恢复保护7/7和桌面510/510为受控共享计数，不与真实任务或跨模块相加；根45/45保留CT-01日期。本模块产品行为无变更，新三工具/真实委派方向/新EXE/独立SSH未验。[脚本、逐次原始报告、首次失败与完整限制](../../iterations/I07/connection-native.md)。

## CT-01连接能力与原拒绝恢复

T-M03-144 / M03-F02/F04/F05：alpha.28后未发布工作区，WSL Node22.23.1 / Windows Edge155。六工具投影、伪造true/未知adapter/来源不匹配、原请求与父作用域/机器归属控制通过；未验证远端现场能力。共享定向32/32（全桌面503/503子集）、核心45/45及工程检查通过，无跳过；跨模块不相加。首次夹具失败及修正保留，真实新三工具/当前EXE/独立SSH未验。本轮模型0，先前真实Claude结果不计本轮。[脚本、命令、失败与最终原始证据](../../iterations/I07/connection-capabilities.md)。

## 小队节点接入资格与原请求恢复

T-M03-142 / M03-F08/F09：alpha.28 后未发布工作区、WSL Ubuntu / Node22.23.1，受控节点、SQLite、stdio 与 React SSR，模型调用0。生产 Coordinator 现有 `snapshot.nodes` 的 `teamCollaboration` 是本地静态注册资格投影，不是新增远端能力通告；没有在 AgentNetwork 贯通远端该字段的采集或持久化。原三种工具缺字段兼容手动小队，实际远端 `context` / `scope` 能力确认继续执行。

| 检查 | 实际结果与证据 |
| --- | --- |
| 小队五文件串行回归 | **71/71通过，无跳过**；包括原请求、身份、任务交接、自动续接与停止回归。[TAP](../../../artifacts/I07C-team-capability/2026-10-18/team-targeted-unrestricted.tap) |
| 最终准入与选择器专项 | **19/19通过，无跳过**；六种适配器及未知适配器、字段缺失/false/true的前后端判断一致；Coordinator 投影不改写原节点；原三种工具和外部 MCP 保留；历史误登记的新执行不增加尝试/收据、不认领工作项；丢 ACK、能力变化及后台重启后按原 ID 读回终态而不重派。[最终TAP](../../../artifacts/I07C-team-capability/2026-10-18/admission-and-picker-final.tap)、[测试源码](../../../desktop/tests/team-native-capability.test.cjs) |
| 修复前反例 | 在独立临时目录冻结修复前源码，Hermes/Pi/DSH/未知适配器的登记和历史登记执行均未按预期拒绝；保留[登记失败TAP](../../../artifacts/I07C-team-capability/2026-10-18/registration-before.tap)、[执行失败TAP](../../../artifacts/I07C-team-capability/2026-10-18/execution-before.tap) |
| 前端类型与生产构建 | 通过，保留原有包体积提示。[最终日志](../../../artifacts/I07C-team-capability/2026-10-18/desktop-build.log) |

19项与71项包含相同用例，最终选择器严断言另作复验，数量不相加。首次受限进程内回归55通过/1失败，唯一失败是既有 stdio MCP 测试监听本机 socket 的 EPERM，见[受限日志](../../../artifacts/I07C-team-capability/2026-10-18/team-targeted.tap)；允许隔离测试的本机资源后五文件71/71通过。首次选择器 SSR 因直接导入页面 CSS 失败，改为独立生产组件后通过；首次构建发现抽出组件后残留未使用 import，清理后通过，[SSR初次日志](../../../artifacts/I07C-team-capability/2026-10-18/targeted-initial.tap)、[构建初次日志](../../../artifacts/I07C-team-capability/2026-10-18/desktop-build-initial.log)均保留。

复现：`node --test --test-concurrency=1 desktop/tests/team-native-capability.test.cjs desktop/tests/team-space.test.cjs desktop/tests/team-automation.test.cjs desktop/tests/team-work.test.cjs desktop/tests/team-stop.test.cjs`；前端执行 `npm run build --prefix desktop`。测试使用隔离临时目录；Unix socket 与 stdio 受控进程需要本机执行权限，不访问用户后台或提交模型需求。本条不声明真实模型、用户 profile、独立 SSH 或新 EXE 已验收，GitHub alpha.28 与本地 poll.4 保持原冻结字节；全片其他实际检查及未测项统一见[交付专项](../../iterations/I07/native-integration-guards.md)。

2026-10-18 / T-M03-141：桌面空闲修复源码，WSL Node22.23.1 / Windows Node24.19.0及Edge155。核心45/45、桌面424/424、定向20/20、Windows受控界面3组通过，模型0；属于共享工程计数，不跨模块相加。普通EXE与黑窗观察、冻结包、首次环境失败及用户现场未测边界按[本次完整报告](../../iterations/I07/desktop-polling.md)记录，历史包不冒充本次修复。

## 当前 Agent 版本与历史安装合流

T-M03-141 / M03-F02/F03/F04/F05/F06：alpha.28后未发布工作区、WSL Ubuntu/Node22.23.1。当前节点沿用角色/接入身份，历史unknown与在途锁汇总，新安装不绕过占用。 桌面424/424、核心45/45通过，计数为共享工程结果不跨模块相加；真实Claude版本2.1.302与受控历史节点合流明确分层。类型/lint/前端构建通过；当前EXE、用户运行中profile、真实模型和独立SSH未验证。[完整场景、原始日志与首次失败](../../iterations/I07/current-agent-discovery.md)。

## Hermes / Pi / DSH 发现与来源路由

T-M03-140 / M03-F02/F05：alpha.28 后源码、WSL Node22.23.1，受控进程/磁盘。发现专项9项通过，覆盖六种稳定 ID、仅版本探测、Windows Pi 新旧 npm 入口与 DSH 入口、损坏启动器拒绝和原 Linux 发现回归；新路由用例核对三种 Agent 的实际名称、adapter 与原来源。已纳入[全桌面结果](../../iterations/I07/native-agent-expansion.md)，不跨模块相加。代码：[发现用例](../../../desktop/tests/tool-discovery.test.cjs)、[机器路由](../../../desktop/tests/machine-router.test.cjs)。未验证真实原生安装、模型或独立 SSH，已发布 EXE/daemon 不变。

## SSH持久拒绝恢复

T-M03-128：alpha.28已预发布，WSL Node22.23.1/Windows Node24.19.0，合成台账和受控TCP SSH，模型0。最终桌面317/317、核心45/45、Windows契约93/93，lint/类型/构建通过；真实TCP SSH丢响应/daemon重启1项及普通Windows无调试EXE合成验证6组通过，34 CJS/78 core/1395 Linux资源匹配源码。发布以[当次实际记录](../../iterations/I06/daemon-rejection-recovery.md)为准，不推定用户现场恢复。历史记录不计为本次重测。

## Windows恢复专项

T-M03-128：2026-10-17 / WSL Node22.23.1与Windows Node24.19.0 / alpha.27已预发布，模型0。Codex恢复10/10、共享原子写入10/10、网络最终50/50、Windows契约86/86；全桌面最终运行288/288、核心45/45及工程检查通过；新增alpha.26兼容文件另验10/10。共享计数不跨模块累加，Windows为受控目录/执行器，不是用户故障或真实模型。首轮限制/维护ENOENT与未测范围保留；最终普通Windows EXE对合成记录恢复/重开/重启/冻结源码共5组通过，包内33 CJS/78 core/1393 Linux条目一致；发布结果以[当片报告](../../iterations/I06/windows-start-persistence.md)后续实际记录为准。
## Windows原请求上下文恢复

T-M03-126 / M03-F04/F05：alpha.25本地候选，WSL Node22.23.1/Windows Node24.19.0，受控记录，模型0。4个反例修复前全部失败，修复后专项48/48、串行桌面243/243、Windows契约17/17通过，原回执可恢复且缺回执仍unknown。共享计数不跨模块累加，包内33 CJS/78 core/1390 Linux资源一致；alpha.24普通EXE对照3组、alpha.25候选4组通过，原记录均为合成。候选包/普通EXE与失败日志见[专项](../../iterations/I06/windows-context-recovery.md)。未实测用户另一台电脑或真实原生模型，不改变GitHub alpha.24已发布冻结包。

## I07C首批实际验证

T-M03-110 / M03-F09：2026-10-16，WSL Node22.23.1、Windows Node24.18.0/Edge155。核心45/45、最终串行桌面222/222、Windows契约29/29；这些是全工程计数，跨模块不相加。Windows前端/真实Coordinator受控目录和成员10组，真实Claude2.1.299自动主角色3轮同Conversation/原Session、新scope、后台重启后实际X失败/Y通过及终态后总验收；执行成员为受控外部MCP、Node检查实际运行。最终包/普通EXE、首次连接恢复竞态和并行维护ENOENT分别保留证据，完整结果见[I07C首批报告](../../iterations/I07/automation.md)。未证明真实多原生角色、其他接入自动续接、用户自研/独立SSH或完整停止。

## I07B继承与回归

T-M03-101 / M03-F08：2026-10-16，最终桌面208/208通过，旧原请求/来源/准入范围继续受测；未改变原身份或SSH帧契约，未连接用户独立服务器。本轮真实Claude与受控编译MCP、首次原有daemon启动失败及8/8重查、包内容分别见[I07B交付](../../iterations/I07/task-handoff.md)，不以同机测试证明独立SSH链。工程数只计一次。

## I07A 实际验证

2026-10-15 / WSL Node22.23.1、Windows Node24.18.0 / 源码alpha.21，GitHub预发布alpha.20。

| 用例 | 功能 | 结果与证据边界 |
| --- | --- | --- |
| T-M03-100 | M03-F08 | 双入口/身份、资源原请求与撤权竞态由受控检查验证；未实测用户自研入口及独立SSH小队链。 |

原始证据、工程总数及真实工具/界面/普通EXE分别见[I07A交付](../../iterations/I07/delivery.md)。[核心45/45](../../../artifacts/I07A/2026-10-15/root-tests.tap)、[桌面197/197](../../../artifacts/I07A/2026-10-15/desktop-tests.tap)为全工程计数，不在本模块重复相加；I07B/C能力不计为已通过。

## OpenCode 二次发现与 Windows 配置专项

WSL Ubuntu / Node 22.23.1：discovery 3/3（含于核心 45/45），桌面 181/181；受控回归、模型 0。[核心 TAP](../../../artifacts/opencode-discovery/2026-10-14/root-tests.tap)、[桌面 TAP](../../../artifacts/opencode-discovery/2026-10-14/desktop-tests.tap)。Windows 原始报告 UTC 2026-10-14T17:35:28.789Z / Electron Node 24.21.0：真实 PE 版本/解析、旧二次发现失败、修复后原路径核验、配置完整写入与旧revision拒绝、serve受控退出保留NATIVE_EXITED、删除原安装，共6组通过，[实际报告](../../../artifacts/opencode-discovery/2026-10-14/windows.json)。这是隔离PE/进程夹具，无真实OpenCode模型或用户另一台电脑验收。原生Windows完整生命周期和断电持久性未验证。根因、失败原证据、最终包与边界见 [专项](../../iterations/I06/opencode-discovery.md)。

## Linux CLI 发现专项

2026-10-14 / WSL Ubuntu / Node 22.23.1：发现回归 6/6；精简 PATH 下真实 Codex CLI 0.162.1 经生产 daemon/relay、本机隔离 TCP SSH 发现通过，重复规范路径不变，模型 0。受控 SSH 端点与真实 CLI 版本探测分别标明，不计作用户独立服务器升级验收。[发现 TAP](../../../artifacts/linux-cli-discovery/2026-10-14/discovery.tap)、[实际 CLI/SSH 报告](../../../artifacts/linux-cli-discovery/2026-10-14/real-cli-ssh.json)。全工程/包/Windows 实际结果与未测范围见 [专项](../../iterations/I06/linux-cli-discovery.md)，原模型/权限/续聊限制保留。

## 历史专项

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

## 当前节点管理专项

T-M03-17 / M03-F02/F03/F05/F06/F07：2026-10-13 / 0.6.0-alpha.9。范围：显式断开/移除不被原生连接或扫描反转，身份/历史保留、全实例 busy、unknown、并发与落盘失败、原 IPC 提交二次归属检查。逐项实际结果、环境、脚本、原始证据与未测范围见 [节点管理完整验收](../../iterations/I06/node-management.md)。工程证据为本次 [桌面 TAP](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)；窗口/程序/包状态以该报告实际结果为准，历史表不充当本次重测。原生 SSH/模型链保留 alpha.6 历史结果，本次未重跑、不改用户 profile、不提交 Prompt。

## I06C alpha.10 当前专项

T-M03-18 / M03-F03/F05/F06/F07：2026-10-13。范围：机器移除是 removedMachines 中央可见性状态，不删除机器、节点、实例或布局；原节点新增准入检查机器移除/变更锁。移除同时撤销相关主/子授权，恢复原 machineId/nodeId 但不恢复授权。machine-history.json 私有保存已观察历史，合并后续分页；离线/移除/重开可读 historical 任务/会话，原任务/控制收据仍回原来源，历史非终态保持 unknown。 本次实际工程、隔离 TCP SSH、Windows 界面/包与未测项见 [6C 首批验收](../../iterations/I06/machine-management.md)；[桌面 TAP](../../../artifacts/I06C/2026-10-13/desktop-tests.tap)和当次报告是当前证据，alpha.6 双向真实 Agent 链保留原日期/版本。未改用户 profile、未升级用户 daemon、无真实模型任务，不将首批标为完整 I06C。

## 当前验证

T-M03-19 / M03-F03/F05/F06/F07：2026-10-14，WSL Ubuntu / Node 22.23.1，桌面受控回归 **150/150** 通过（全工程总数，模块之间不重复相加）。场景：维护未知期间，所属机器的新执行和节点编辑被中央与原生准入双重阻断；其他机器原有会话可继续。卸载的原远端收据 confirmed 后按原 machineId 完成中央移除、撤销新协作权限及隐藏图节点，保留机器/节点/会话/任务历史。断开、停止、卸载不等于取消原任务，不以名字或地址别名释放未知占位。

证据：[完整桌面 TAP](../../../artifacts/I06C-final/2026-10-14/desktop-alpha13.tap)、[维护实际 daemon/process 7 项](../../../artifacts/I06C-final/2026-10-13/maintenance-tests.tap)、[包内容核验](../../../artifacts/I06C-final/2026-10-14/package-alpha13.json)。维护测试使用真实生产 daemon、Unix socket、独立进程和磁盘，原生 host 受控、无模型调用；不能替代独立服务器或真实原生控制。Windows 窗口、原生 Session 与双向链、使用/卸载、命令和限制统一见 [逐项验收](../../iterations/I06/final-delivery.md)，未实际执行项不得计为通过。

## 本次独立实机补充

2026-10-14：冻结 alpha.13 Windows 包与独立 Linux，真实升级、同原生 Session 两轮及两方向协作通过；真实 Windows 取消和普通无调试窗口原生标记分别通过。独立 SSH/生产 daemon 的精确响应丢失、10 同 ID 与重启为受控执行器证据，不充当真实模型。Linux 文件任务受原生 OOM 退出影响，原 ID/Session 与 unknown 占位保留，未准出、未重发；后续 alpha.14 上传专项不冒充此模型矩阵复测。逐场景原始证据、版本、实际失败、临时自有资源调度及剩余项见 [I06C 当前实机记录](../../iterations/I06/final-delivery.md)。

本专项工程补验：桌面 181/181、核心基线 43/43、lint/类型/构建通过；包内私有 Linux Node 的真实 CLI 版本探测复验通过，Windows EXE 已构建并核对资源，详见上述专项“实际验证”。不计为用户服务器升级或模型任务验收。

2026-10-15 alpha.19 合并包复验：核心45/45、桌面181/181、lint/类型/构建通过；发布资源真实 Linux Codex0.162.1发现、Windows受控扫描/配置6组、普通EXE4组通过。最终包摘要和未测边界统一见 [Linux/合并包专项](../../iterations/I06/linux-cli-discovery.md)；未实测用户服务器或真实模型任务。

## 未确认操作资源范围专项（源码修复，未发布）

T-M03-20 / M03-F04/F06：2026-10-15 / WSL Ubuntu Node22.23.1 / alpha.19工作区修复。同机器独立节点可执行；同节点改 ID/目录和跨节点 Windows/WSL 共享目录被拒绝；原身份不迁移。 定向40/40计入全桌面188/188，类型与前端构建通过；Windows Edge生产前端/受控API共4组通过，模型0。原始证据和复现见[当次专项](../../iterations/I06/pending-isolation.md)。未构建新EXE、未访问用户故障profile或独立服务器，不替代真实原生任务验收。

alpha.20候选追加验证（2026-10-15）：Windows普通无调试EXE/隔离合成配置拒绝恢复及关闭重开4组通过；最终生产前端/Windows Edge受控4组通过，模型0。包内源码匹配，原始证据统一见[专项](../../iterations/I06/pending-isolation.md)。这不改变上一段源码阶段“未构建EXE”的历史边界。

alpha.20已公开预发布：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/AgentBridge-0.6.0-alpha.20-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.20)。分发元数据和完整EXE下载摘要核验通过，源码标签9b2d5ea；不将分发成功扩大为用户故障或真实模型验收。[发布及证据](../../iterations/I06/pending-isolation.md)。
