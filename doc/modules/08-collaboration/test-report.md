# M08 主从协作测试报告

2026-10-29受控验证维护：图崩溃夹具在准确rename前/后记录注入点，Windows核对强制终止退出码、POSIX核对SIGKILL，原收据/修订/unknown与禁止重放断言保留；产品关系/布局实现未改。共享平台78项为38通过/40明确跳过，实际Linux结果另列，模型0。[完整日志与边界](../../iterations/I08/windows-regression-and-native-probes.md)。

当前公开alpha.70已包含#27/#28修复，标签冻结5c95b98。225项产品输入与实际EXE3405资源匹配，源码/EXE/SHA公开且匿名完整下载一致。普通EXE合成恢复/完整重启、实际包内恢复和回环SSH UI已验；真实用户profile与完整矩阵仍按各自边界。[本轮发布与分层验收](../../iterations/I08/alpha70-release.md)。


2026-10-27 / alpha.65 / Windows Node24.12.0：共享Hermes定向31/31，扩展73项72通过/1个Pi原基线失败，不能跨模块相加。已安装Hermes0.22.5、冻结Windows后台原生MCP五组通过（模型0）；真实执行/续聊两轮通过，但首轮参数拒绝、早期心跳EPERM及验收器原生配置字节比较失败均保留。普通EXE/发布状态按[专项](../../iterations/I08/alpha65-hermes-windows.md)逐项登记，不把源码结果当作EXE/父模型准出。

## alpha.64发布复验（2026-10-27）

本轮沿用已合并#25产品代码，版本/原daemon兼容pin与验收器另冻结；源码定向155/155、包内撤权14/14、关系37/37、传递14/14、收据4/4与兼容29/29，实际ASAR图12组/控制台6组通过。普通EXE前五组及同一原profile重启/退出补验两组通过，模型0；首次120秒未就绪、第三轮验收器先于后台就绪的ENOENT及同profile接续证据分别保留。EXE/附件与匿名完整下载匹配，未签名/未切换日常后台/部署SSH；本轮未测原生模型与WSL，未改写旧全量准出。[完整发布、原始证据与限制](../../iterations/I08/alpha64-release.md)。

## issue #25 关系撤权与目标作用域（2026-10-27）

M08-F02/F03/F04/F05；基于公开alpha.63/8833d01的未发布源码，Windows Node24.12.0、Edge157.0.4341.16。同主缩小集合或清主清成员无新增准入目标；新成员/新主仍按资源与能力检查。原收据、其他关系、历史与原unknown保持；旧父读控、任务取消和新执行权限不改变。

共享定向 **155/155**、生产前端与生产Coordinator受控 **12组通过**（pageErrors=0，模型0），不跨模块相加。原基线同一新增回归出现撤权失败。桌面构建、根构建/类型/lint通过；Windows全量959项872通过/86失败/1跳过，未修复基线也存在同型失败；根全量71项53通过/18失败。WSL启动因HCS服务不可用未执行，不能复用历史全量通过数。

证据、全部失败/基线、复现命令与源码见[专项记录](../../iterations/I08/relation-revocation-scope.md)，[定向原始日志](../../../artifacts/issue25/2026-10-27/targeted-delivery.tap)、[Windows页面报告](../../../artifacts/issue25/2026-10-27/ui-delivery/report.json)。未构建新EXE、未接真实原生Agent/模型/独立SSH、未改真实用户profile或日常未知；完整图/WSL/父模型与I06C/I07C/MCP02准出保持。

## alpha.63普通窗口关闭后的原生MCP（2026-10-25）

普通无调试EXE + 系统Node24.18.0 + 原版Pi1.4.0 MCP组件七组通过；三次原窗/包装进程均退出0且解包文件删除，原生客户端仍可读取原工作/原包/完整接收收据。原生重开、三个不同解包路径和完整Coordinator重启后原端点身份/配置字节不变；最终所有原进程确认退出，模型0。仅原工作MCP22工具组件，非经典独立连接/托管任务/真实父模型，其他入口/SSH/跨版本仍待；共享组不相加。[最终证据与验收器收尾修复](../../iterations/I08/native-mcp-lifecycle.md)。

## CT-05原包传递与接收声明（2026-10-25）

WSL Node22.23.1隔离受控后端13项、生产Coordinator→真实stdio双客户端1项、审计校验/React渲染2项定向通过，模型0；原ID重启去重、准确旧版、撤权/终态、容量/磁盘回滚、无调度和损坏拒绝已覆盖。后续冻结alpha.63 Windows传递14/14、原收据4/4、关系37/37、兼容26/26、新审计页面5组/控制台6组和普通EXE6组通过；原生Pi→固定源码Hermes客户端7组通过，模型0。源码全量944/944、Core71/71；各模块共享结果不相加，真实父模型/独立SSH未验。[契约、原始证据与未测项](../../iterations/I07/context-delivery.md)。

2026-10-25后续：alpha.62普通EXE五组与真实驱动码0已通过，原主窗口三次正常关闭、重开和完整后台重启均保持原SQLite/收据。旧失败来自脚本重新枚举到无标题辅助窗，原报告保留；产品未改，模型0。[原窗口绑定、负向保护及分层证据](../../iterations/I08/window-lifecycle-verifier.md)。

2026-10-25本地alpha.62配置/审计控制台：最终Core71/71、桌面928/928、原收据/审计专项78/78及Windows生产页面6组通过；pageErrors=0、新执行尝试0，模型0。覆盖原ID/完整指纹/页面重开/并发变更与损坏记录保护、默认只读/显式原任务恢复、权限变更正文保持。共享计数不相加；普通EXE与包交付状态统一见[本片分层证据](../../iterations/I07/configuration-console.md)。公开alpha.60及完整原生/图/WSL/SSH边界保持。

## alpha.60原生客户端连接策略复验

2026-10-25，公开alpha.60冻结后台56份原摘要逐项一致：真实原生Pi1.4.0在Linux/Windows、固定源码Hermes在Linux各7组通过，含十工具schema、连接/断开、范围外明确允许/拒绝、原ID/历史确认与缓存撤权；临时Home与受控发现/宿主/用户RPC，模型/原生任务/委派0。原Task/Session生命周期、真实父模型和独立SSH未补验；Hermes不是正式安装版/Windows原生。本轮仅验收/夹具和文档，无产品或新包，37/37是共享夹具相关回归，不覆盖当前alpha.61全量。[完整证据、失败与边界](../../iterations/I08/native-policy-components.md)。

2026-10-24，CT-08-A3/alpha.60：Agent连接3工具、v3预授权/用户明确确认及策略审计/原意图恢复页面已实现。源码900/900，最终相关25/25；Windows冻结包37/37与实际中央管道/重启、兼容26/26、生产页面4组、普通EXE4组与Downloads SHA均通过，真实模型0。交付结果及原始失败见[完整分层记录](../../iterations/I07/connection-policy.md)。真实原生消费/日常多主、图100ms/WSL及完整SSH仍未准出，原任务/unknown不重建。共享计数不累加。


## #19/#20 修复验证

EXE与校验文件已公开，匿名完整下载HTTP200、130190265字节及SHA-256一致；[发布核验](../../iterations/I08/alpha52-release.md)。

2026-10-23，alpha.52公开版；M08-F02/F03/F04/F05。定向生命周期、中央资源与原请求回归131/131，远端/断开身份契约9/9，Windows生产前端12组通过、pageErrors=0；实际Windows进程检测识别日常OpenDesk运行并在隔离文件拒写，模型0。共享计数不跨模块累加；桌面共享全量841/841、核心68/68，类型/lint通过；普通无调试Windows EXE8组通过；包54后台/84Core/1702Linux与冻结源码一致，模型0。原失败、命令、原始证据及未测项见[本轮记录](../../iterations/I08/opendesk-lifecycle-relation-scope.md)。

2026-10-23 / alpha.50本地候选：共享桌面794/794、核心68/68，工程与最终包核验通过；Pi原生Linux/Windows各5组、Hermes固定官方源码原生组件5组、Windows生产前端5组/普通EXE4组通过，模型0。原生阶段/受控发现、首次YAML与验收脚本/受限socket失败分别保留；真实自主父模型、Hermes正式安装版/Windows原生、独立SSH及完整矩阵未准出。共享计数不相加。 [最终实现、原始证据与范围](../../iterations/I08/hermes-mcp-config.md)。

## DSH Desktop原生MCP（2026-10-22）

T-M08-MCP02DSH / M08-F02/F05；2026-10-22，alpha.48候选。原生Desktop组件5组正式授权/伪造参数拒绝/缓存撤权与身份轮换通过，Windows前端4组和桌面766/766、核心68/68共享回归通过，模型0。Profile/目录切换不会迁移授权或原台账；准备竞态回滚、链接目录只撤权不误删已受控验证。未证明自主父模型委派或托管scope。 [开发、原始失败与分层验收](../../iterations/I08/dsh-desktop-mcp.md)。

## MCP 已登记归属默认值兼容（2026-10-22，alpha.47本地候选）

T-M08-MCP02DEFAULT / M08-F02/F05：空 `headers` 默认值不再阻断OpenDesk已登记连接的状态、重复添加及清理；未登记/其他修改仍拒绝。WSL定向44/44、桌面760/760和核心68/68；Windows未修改原生schema/worker组件7组验证正式授权、旧客户端撤权立即拒绝、原身份重启恢复和清理，模型0。未变更关系、scope、委派台账或unknown规则，组件证据不提升为自主父模型委派。[原始反例与验收](../../iterations/I08/opendesk-mcp-defaults.md)。

## 后续原生组件验收（2026-10-22，alpha.46）

已安装OpenDesk/DSH原生MCP组件协议分别5组/6组通过；两条生产协作链各完成1个真实Claude子任务，并分别只读重开原任务/Session/结果，无重放。原生父模型自主决策与日常原生页面未验；产品运行代码与EXE未变，不把新增验收与原全量计数叠加。[脚本、初次失败、准确层级和未测项](../../iterations/I08/mcp-native-acceptance.md)。

## MCP02恢复与观测（2026-10-22）

MCP连接和工具目录观测不授予主角色，不证明原生调用或委派。撤权后已连接stdio客户端立即被拒绝，外部配置删除只改变配置事实。 WSL Node22.23.1共享桌面758/758、根68/68通过，最终JSON修复后CLI11/11及类型/lint/核心构建通过；模型0，真实原生模型委派未测，Windows结果按专项登记。 [实现、原始证据与未测项](../../iterations/I08/mcp-open-recovery.md)。

## 主角色准入与托管scope分离（I08-MCP02第一片）

T-M08-MCP02A / M08-F01/F02/F05：2026-10-22，alpha.43派生工作源码，WSL Node22.23.1。本轮同机定稿全量桌面 tests **750** / pass **750** / fail 0（当日首轮 747/747，58.4s；加入 DSH profile/OpenDesk 用例后定稿），根 `npm test` 66/66，工程检查通过；计数共享不跨模块相加。与本模块相关：`connection-capabilities.test.cjs` 11/11（`test('independent callers are admitted while MCP-unknown agents stay delegation-only targets')`、`OpenDesk external MCP can own ordinary delegation while hosted scope rejects before intent`、旧关系/原收据先于新能力检查恢复）、`agent-network.test.cjs` 与 `mcp-remote-routing.test.cjs` 73/73（含新方法转发、旧daemon显式升级）。均为受控测试，**模型0、无真实原生主从调用链**。

未测：真实独立MCP主Agent发现/委派/读回原结果、真实托管scope注入、真实撤权后新委派拒绝、真实原生缓存会话。逐项状态见[本轮记录](../../iterations/I08/mcp-open-integration.md#114-逐入口完成度)。

OpenDesk相关验证统一见[专项报告](../../iterations/I08/opendesk-existing-interfaces.md)，明确受控协议、真实原生启动、模型和Windows包的独立范围；共享计数不跨模块累加，未执行项保持未测。

## alpha.36整合边界

2026-10-21 / WSL Node22.23.1：本轮全量核心57/57、桌面676/676，类型/lint/前端构建通过。各模块共享计数不相加；包核验、Windows契约144/144、界面26组与普通EXE7组通过，具体以专项为准，真实模型/用户profile/独立SSH未验。[完整交付](../../iterations/I07/alpha36-delivery.md)。

## 普通子任务最小上下文

T-M08-155 / M08-F03/F05：2026-10-21，alpha.34派生未发布源码。WSL Node22.23.1冻结桌面667/667零跳过/退出0，定向121/121含新18项为全量子集；Windows Node24.19.0同新上下文/原连接列表36/36，Core构建通过。八入口统一宿主受控验证；Hermes/Pi/DSH生产链与受控CLI子进程收到说明+原需求，原设置、去重/重开/取消保持；独立MCP真实stdio及撤权通过。旧委派原文、unknown原ID、v1摘要、超限/未知版本及严格原准备拒绝证明均覆盖。首次118/120因渲染输入指纹未同步的两项真实回归已修复，不放宽结算。共用计数不相加，模型0；不是上游原生产品/模型、新EXE或独立SSH验收。[契约、原始日志与限制](../../iterations/I07/delegation-context.md)。

## CT-07当前调用方连接视图

T-M08-154 / M08-F02/F03/F05/F06：2026-10-21，alpha.34派生未发布源码；WSL Node22.23.1冻结桌面643/643零跳过/退出0，定向103/103为其子集，新增11项含原父查询/快照等待期间4个并发子场景；Windows Node24.19.0同视图与原列表18/18。覆盖角色/授权原因、空参数、来源机器/父终态/unknown、独立MCP身份/立即撤权、原请求身份与执行次数保留；Core构建通过。共用计数不相加，模型0；原生模型/新EXE/独立SSH未验，首次错误断言与真实snapshot观察写回分开保留。[完整契约、日志与范围](../../iterations/I07/agent-connections.md)。

## CT-07只读委派列表（2026-10-20）

T-M08-153 / M08-F04/F05：WSL Node22.23.1定向110/110（含新7项列表+1项Claude允许项）与最终冻结桌面615/615零跳过/退出0；Windows Node24.19.0列表/真实stdio及独立MCP8/8。覆盖父/连接隔离、空身份/游标、unknown/非实时、撤销关系保留原读、父终态/连接撤权拒绝、观察器重开不重派，Claude/Codex允许只读项但reply_task仍需原审批。共用计数不相加，模型0；Windows原生CLI/真实模型/新EXE/独立SSH未验，首次冻结缺C资源及初次TAP覆盖如实记录。[日志、脚本、版本与范围](../../iterations/I07/delegation-list.md)。

## DSH Desktop / Web 专项

当前本地.dsh.3候选：核心56/56、完整桌面607/607、Windows DSH11/11、生产前端3组及普通EXE6组通过；真实Windows/WSL认证与接口通过，Desktop同Session两轮及去重已观察，但模型均RATE_LIMIT，WSL模型/独立SSH未测。[当前源码、包与分层证据](../../iterations/I07/dsh-exe-delivery.md)。以下保留各先前冻结范围。

M08-F01：本次WSL受控HTTP/独立worker与方向能力、Windows Node契约、Edge生产前端及失败记录统一见[本轮完整契约与证据](../../iterations/I07/dsh-desktop-web.md)，工程总数不跨模块相加。Windows当前安装2.0.18/认证屏障和WSL Web profile是环境核对；未在原实例调用模型，不作为真实原生、发布包或独立SSH验收。

## OpenCode 1.x / 2.x 兼容修复

M08-F01：OpenCode 1.x 托管 scope 使用原生 mcp.agentbridge，不写 V2 codemode；独立连接安装/导出记录其协议，删除用原布局。Bridge scope、connectionId、原请求与 token 撤销规则保持，配置格式兼容不代表真实模型协作验收。 本次共用专项的全套日志，不跨模块累加；受控测试、官方 CLI 加受控传输与未测 Windows/SSH/真实模型分列。 [需求、实现、验证与未测边界](../../iterations/I07/opencode-v1-compatibility.md)。

## CT-05桌面选材/核对导出

T-M08-152 / M08-F07/F08：WSL Node22.23.1最终桌面581/581零跳过/退出0，新5项和定向15项为全量子集；Windows Node24.19.0/Edge155生产前端、真实Coordinator/SQLite、受控机器9组通过、页面异常0。覆盖四类明确版本/本机MD与JSON实际下载、报告来源/正文/引用/摘要拒绝、目标/任务变化失效、跨工作迟到隔离及原unknown不变/原生请求0。clipboard受控，模型调用0，不等于系统剪贴板、EXE或真实Agent消费本轮导出。计数共用不相加；后端任务/权限/收据合约无变化。[日志、截图、首次构建与壳退出记录、复现和发布边界](../../iterations/I07/context-packet-ui.md)。

## CT-05明确选材只读包

T-M08-151 / M08-F07/F08：WSL Node22.23.1定向14/14（新6项）包含在全桌面576/576，Windows Node24.19.0同14项/真实命名管道与stdioMCP通过，零跳过、受控模型0。覆盖精确版本、旧消息/历史产物、任务过期/越权/撤权/终态scope、格式和UTF-8容量、完整state/receipt不变。真实Claude2.1.303一个成功Task、3次MCP读取及完整重开/重复观察仍1Task；各模块共享计数不相加。新EXE、其他工具实际消费/独立SSH及界面选材未验，源码晚于integrated.3冻结。[日志、脚本、环境首次失败与发布边界](../../iterations/I07/context-packet.md)。

## 整合源码与本地候选

T-M08-149 / M08-F02/F05/F07：核心51/51、桌面570/570零跳过（定向85/85及兼容15/15是相关子集），根类型/lint/构建与桌面构建通过。Windows前端26组/模型0，按历史/门禁/管理/材料/MCP分别记录；最终integrated.3普通Windows EXE五组通过：原历史/文档/MCP导出、窗口/后台重开、持久资源和原unknown保留，原生请求0；这是隔离合成profile，不是真实Agent模型或用户现场。包42 CJS/78核心/1446 Linux条目匹配，未部署用户SSH或跑真实模型。各模块共用计数不相加；首次夹具/原型失败与原历史证据保留。[版本、源码、所有原始结果和限制](../../iterations/I07/integrated-source.md)。

## issues #8/#9受控验证

M08-F02/F03/F04：核心51/51、桌面543/543（含版本/管理/原路由回归）、最后定向7/7及工程检查通过；Windows95项原路由/9项管理CJS、前端专项4组/既有10组及普通EXE5组通过；分发另按专项逐项记录。无真实模型/用户profile/独立服务器升级，不跨模块累加共享计数。 [需求、实现、验证与边界](../../iterations/I07/version-management-recovery.md)。

## issue #7 协作兼容修复

M08-F02/F03/F04：本轮仅受控HTTP/CLI、生产后台无推理、TCP SSH及Windows交付验收；用户现场/独立SSH/真实模型未测。实际执行结果、首次失败与最终工程/包证据统一引用专项，共享计数不跨模块叠加。 [完整需求、验证与交付](../../iterations/I07/collaboration-compatibility.md)。

## CT-04桌面只读材料通路

T-M08-148 / M08-F07：2026-10-19，本地a872275/alpha.29派生工作区（公开另分支alpha.31尚未合入）。WSL Node22.23.1桌面541/541零跳过，新版本/摘要/MD保护4/4为全量子集，桌面类型/Vite构建通过。Windows Node24.18.0/Edge155，生产前端→真实Coordinator/SQLite、受控机器八组流程通过，页面错误0、模型0；实际浏览器下载的UTF-8旧版正文与受控clipboard收到内容一致。clipboard是受控接收/拒绝，不冒充系统剪贴板实写。旧后台/缺版/摘要错误阻止传出、A迟到响应不入B、窄桌面/原unknown不变和原生请求0通过。未跑新EXE/独立SSH/真实Agent消费导出，计数跨模块共用不叠加。[完整原始日志、下载、截图与复现](../../iterations/I07/public-materials-ui.md)。

## 独立 MCP 文件与配置增删

M08-F02/F05；日期2026-10-19，alpha.29后未发布工作区。WSL Node22.23.1受控全桌面537/537、核心45/45；真实原生列表三工具增删通过，Claude/OpenCode连接、Codex仅列表；Windows Edge155生产界面4组通过但机器/原生执行受控。计数为共享结果不跨模块相加，模型调用0。新EXE、真实Windows原生Agent、独立SSH与独立接入真实模型委派未测。源码/命令、首次失败、原始日志和逐层边界见[专项验收](../../iterations/I07/mcp-installation.md)。

## CT-04公共材料首片

T-M08-147 / M08-F07：2026-10-19，alpha.29之后未发布源码，WSL Node22.23.1。定向27/27（含新8项）和最终桌面525/525通过，零跳过，无模型；覆盖只读/精确旧版/分页、跨工作/撤权/原生终态scope拒绝、状态/报告白名单、Markdown和生产Coordinator→stdioMCP→broker路由。定向是全量子集，各模块共用计数不相加。另有真实Claude2.1.303一个成功Task、两次MCP读取、三组限定检查；索引文档当前2版时准确取得第1版，完整重开仍一个原Task。本片没有新EXE/其他工具/独立SSH或桌面导出验收。[原始日志、版本、复现及限制](../../iterations/I07/public-materials.md)。

## CT-02真实MCP六方向

T-M08-146 / M08-F01/F02/F03/F04/F05：WSL Node22.23.1，真实Claude2.1.302/Codex0.163.0-alpha.10.2/OpenCode2.0.24轮流作主并各委派给另两种工具；生产Coordinator/AgentNetwork/MachineHost/stdioMCP/broker/原生CLI或HTTP，非假dispatcher。共9个成功原生Task、6个委派方向、16次实际MCP调用；原父/目标/机器/派生ID/消息与真实结果核对，重开每链Task3→3/委派2。保护7/7计入全桌面517/517（模型0），不与真实或跨模块计数叠加。生产行为无变更；新三工具、新EXE、独立SSH、权限/表单及执行中断点未测。[完整脚本、逐次报告与边界](../../iterations/I07/connection-delegation.md)。

## CT-01连接能力与原拒绝恢复

T-M08-144 / M08-F01/F02/F03/F05/F06：alpha.28后未发布工作区，WSL Node22.23.1 / Windows Edge155。能力投影、主/子方向门禁、MCP列表、新请求预派发拒绝/原请求兼容、三工具受控生产委派链及Windows原拒绝恢复通过。共享定向32/32（全桌面503/503子集）、核心45/45及工程检查通过，无跳过；跨模块不相加。首次夹具失败及修正保留，真实新三工具/当前EXE/独立SSH未验。本轮模型0，先前真实Claude结果不计本轮。[脚本、命令、失败与最终原始证据](../../iterations/I07/connection-capabilities.md)。

历史研究记录（2026-10-18，CT-01实现前）：本轮[连接矩阵](../../agent-integration-matrix.md)与[通信/公共MD/上下文研究](../../iterations/I07/connectivity-research.md)只做源码和外部资料核对，未新增模型、跨机、MCP或EXE执行证据。纠正Hermes/Pi/DSH“不能注入MCP”不等于“普通delegate不可达”的文档口径；后者仍未真实验收，当前关系准入差异列为CT-01，不把设计描述当已修复。历史测试计数/准出边界保留。

## 真实原生执行成员公共文档链

T-M08-143 / M08-F09：同WSL三个独立Bridge宿主、真实Claude2.1.302，五组限定检查通过、五次自动原生回合；开发/复核各一轮、主协调沿原会话三轮。原生终态后验收及恢复不重放通过，原生权限回复/非Bridge工具/模型覆盖0。机器路由受控，非独立SSH、真实WindowsEXE或代码编译返修；共享真实计数不跨模块叠加。[脚本、原始日志与准确边界](../../iterations/I07/native-members.md)。

## 原生接入准入与核对收据

T-M08-142 / M08-F07/09：新增工具/未知工具/显式false在新登记和旧成员的新执行前拒绝，不认领任务、不写attempt、不派发。原3工具缺字段兼容、MCP接入与原ID恢复保持；相关71/71及最终新增19/19各保留源码时点，不相加。 最终合并源码串行桌面474/474、核心45/45及工程检查通过；受控CLI/磁盘/浏览器，模型0，未升级用户后台或重建EXE，不替代真实原生或独立SSH。[需求、原始失败、最终日志与未测边界](../../iterations/I07/native-integration-guards.md)。

## 新原生接入的能力拒绝

T-M08-140：Hermes/Pi/DSH 当前 teamCollaboration=false；受控新宿主专项验证 MachineHost 配置scope与宿主带MCP提交均在派发前拒绝，没有创建协作配置或调用CLI。计入[43项共享定向TAP](../../../artifacts/native-agent-expansion/2026-10-18/native-targeted.tap)。本次没有声明三种工具主/子MCP、小队自动执行或真实模型通过，[扩展边界](../../iterations/I07/native-agent-expansion.md)。

## 当前工作区集成基线

T-M08-132：alpha.28加未发布UI/会话补丁，WSL Node22.23.1，受控进程/SQLite/SSH/HTTP/React SSR，模型0。核心45/45、串行全桌面375/375（含既有父/子测试）、lint/根类型/前端类型及构建通过，无测试跳过；保留既有chunk体积提示。共享计数不跨模块相加。[完整命令、原始日志和源码观察清单](../../iterations/I07/integration-baseline.md)。未验证新UI浏览器/Windows EXE、独立SSH或真实模型；模块行为无新改动，发布附件未更新。

## 会话异常与业务验收

T-M08-131：alpha.28之后的未发布源码，WSL Node22.23.1，真实SQLite/受控执行与业务报告，模型0。新增两项回归修复前均失败，修复后相关53/53通过；覆盖任务/直接总验收/提议后异常、历史轮次忽略和正常后续执行替代。原生succeeded事实保持，异常阻断业务验收。[完整证据及复现](../../iterations/I07/acceptance-native-binding.md)。未测试真实模型/Windows/独立SSH或重建EXE；共享计数不跨模块累加。

## 空白原生Session绑定保护

T-M08-130：alpha.28之后的未发布源码增量，WSL Node22.23.1，受控原生execute/query与真实SQLite，模型0。首次纯空白值不绑定/不自动续接，后续空值不清除已有有效绑定；两个反例修复前失败，修复后相关51/51（含父/子测试）通过，真正Session变化仍受既有反例约束。[证据与复现](../../iterations/I07/blank-native-session.md)。未实测真实CLI返回空值、Windows或独立SSH，未重建EXE；共享计数不跨模块累加。

## Windows恢复专项

T-M08-128：2026-10-17 / WSL Node22.23.1与Windows Node24.19.0 / alpha.27已预发布，模型0。Codex恢复10/10、共享原子写入10/10、网络最终50/50、Windows契约86/86；全桌面最终运行288/288、核心45/45及工程检查通过；新增alpha.26兼容文件另验10/10。共享计数不跨模块累加，Windows为受控目录/执行器，不是用户故障或真实模型。首轮限制/维护ENOENT与未测范围保留；普通EXE/包/发布结果以[当片报告](../../iterations/I06/windows-start-persistence.md)后续实际记录为准。
## 首次续接回应的原Conversation校验

T-M08-127：alpha.25之后的未发布源码增量，WSL Node22.23.1，受控execute/query和真实SQLite，模型0。错误Conversation的running/succeeded两个反例修复前均失败；修复后相关48/48（含父测试/子场景）通过，错误回应保持unknown、不绑定外来会话，原request返回正确Conversation后恢复，execute总数仍2。[TAP、复现与限制](../../iterations/I07/intended-conversation.md)。未运行真实模型/EXE或独立SSH，未重建发布包；共享计数不跨模块累加。

## 不完整原生任务回应

T-M08-125：alpha.24未发布源码补丁，WSL Node22.23.1，受控原生执行查询/真实SQLite，模型0。5种身份缺失或无效输入修复前全部失败；修复后自动化/公共空间/任务/停止/路由45/45（含父测试/子场景）通过，原不完整succeeded保持unknown、原scope和占用保留，完整原请求可恢复且execute仅1次。[TAP、复现和边界](../../iterations/I07/incomplete-receipt.md)。未重建EXE或验证真实模型/独立SSH；共享计数不跨模块累加。

## 真实原会话续接后的权限

T-M08-124：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。三项检查通过，共两次自动回合、手动启动0；阶段2的task/request不同但Conversation/实际原生Session相同，每轮真实权限等待/观察后台重启/精确Write允许后成功。累计attempt/used/Write/权限命令各2，持久事件仅user_start/attention且pending0；完成重查未重派。[证据及复现](../../iterations/I07/resume-native-permission.md)，共享计数不跨模块累加。未测后续轮拒绝、执行成员交接、Windows或独立SSH；未更新包或发布。

## 真实自动主角色首轮权限

T-M08-123：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。两次事件自动原生回合、手动原生启动0，权限等待/观察后台重启、精确Write允许成功/拒绝failed三项检查通过；每项工作attempt/used各1、只有已消费user_start且pending0，原生Write和权限命令各合计2次。首次工具断言遗漏及修正后的只读恢复核对分别保留，[证据与复现](../../iterations/I07/auto-native-permission.md)。不是执行成员交接/原会话续接轮次、Windows或独立SSH，未更新EXE。共享真实证据不跨模块累计。

## 真实原生权限补验

T-M08-122：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。两次手动小队原生调用，等待/观察后台重启、允许隔离Write并成功、拒绝后failed且文件不存在三项检查通过；完成后重复执行脚本只查原记录，每场景attempt1条、权限控制命令合计2次。真实原生证据共享引用，不跨模块重复计数。[报告、复现与限制](../../iterations/I07/native-permission.md)。未测自动权限链、Windows真实模型或独立SSH；未改产品源码/包，以下历史结果保持原日期。

## 停止协调实际验证

T-M08-121 / M08-F10：2026-10-16，WSL Node22.23.1、Windows Node24.18.0/Edge155、真实Claude2.1.299。停止契约8项、生产Coordinator/AgentNetwork受控路由1项、Windows契约38项及界面7组通过；真实Claude原生停止/观察后台重启3组通过，原取消命令1次、原任务cancelled后归档。全工程/包/普通EXE、首次失败和准确边界统一见[当片报告](../../iterations/I07/native-stop.md)，这些共享计数不跨模块相加。未证明真实权限批准/拒绝链、独立SSH或其他原生适配取消。

## I07C首批实际验证

T-M08-110 / M08-F09：2026-10-16，WSL Node22.23.1、Windows Node24.18.0/Edge155。核心45/45、最终串行桌面222/222、Windows契约29/29；这些是全工程计数，跨模块不相加。Windows前端/真实Coordinator受控目录和成员10组，真实Claude2.1.299自动主角色3轮同Conversation/原Session、新scope、后台重启后实际X失败/Y通过及终态后总验收；执行成员为受控外部MCP、Node检查实际运行。最终包/普通EXE、首次连接恢复竞态和并行维护ENOENT分别保留证据，完整结果见[I07C首批报告](../../iterations/I07/automation.md)。未证明真实多原生角色、其他接入自动续接、用户自研/独立SSH或完整停止。

## I07B 实际验证

T-M08-101 / M08-F07/M08-F08：2026-10-16，WSL Node22.23.1、Windows Node24.18.0及Edge155。核心45/45、最终桌面208/208、Windows契约18/18；这是全工程计数，不跨模块重复相加。真实Claude两轮手动开发、独立MCP编译连接器实际Node检查X失败/Y通过、MCP协调员验收；Windows生产前端/Coordinator受控目录7组通过、模型0。首次原有daemon启动失败、重查及最终包/普通EXE的实际结果均见[I07B报告](../../iterations/I07/task-handoff.md)。未验证用户自研产品、独立SSH小队链、OpenCode/Codex任务闭环或I07C自动激活。

## I07A 实际验证

2026-10-15 / WSL Node22.23.1、Windows Node24.18.0 / 源码alpha.21，GitHub预发布alpha.20。

| 用例 | 功能 | 结果与证据边界 |
| --- | --- | --- |
| T-M08-100 | M08-F07 | 双独立MCP子进程实际互通，文档冲突/权限/分页/撤权/恢复由受控检查通过；旧主从路径保持原父scope。 |

原始证据、工程总数及真实工具/界面/普通EXE分别见[I07A交付](../../iterations/I07/delivery.md)。[核心45/45](../../../artifacts/I07A/2026-10-15/root-tests.tap)、[桌面197/197](../../../artifacts/I07A/2026-10-15/desktop-tests.tap)为全工程计数，不在本模块重复相加；I07B/C能力不计为已通过。

当前基线：2026-10-14 / 0.6.0-alpha.13。工程与受控维护验证通过，独立服务器/最终程序专项按 [I06C 收尾](../../iterations/I06/final-delivery.md) 实际状态记录；旧版本段落保持原日期。
核对日期：2026-10-12。对应 [功能设计](design.md)。结论：单组单层协作及四条 Windows/WSL 真实委派链通过；alpha.6 的换主/清主原父读控反例和独立 SSH 双向核心链通过；全部权限/表单/取消和 I06C 故障矩阵仍不能标全部通过。

## 1. 证据层级

I07的[参考产品调研](../../iterations/I07/claude-projects-research.md)仍仅为官方资料阅读；AgentBridge自身I07A实现的运行证据见上节，直接交接和持续激活仍待I07B/C。

本报告保留发现修复的历史 89/89 基线；alpha.6 当次桌面 110/110 与核心 43/43 均实际重跑通过，见文末 I06B 证据。映射案例与其他模块共享，不独立叠加数量。

- [桌面 TAP](../../../artifacts/codex-discovery/2026-10-12/desktop-tests.tap)：受控节点、授权和 stdio MCP。
- [I05-real.json](../../../artifacts/I05-real.json)：真实生产工具、原生子回复及父汇总；总状态 partial，不能删去原生失败。
- [I05-codex-main.json](../../../artifacts/I05-codex-main.json)：WSL Codex 主任务真实 MCP 接入。
- [I05-ui.json](../../../artifacts/I05-ui.json)：隔离浏览器 mock 交互，只证明界面操作与调用参数。
- [I05 验收说明](../../iterations/I05/acceptance.md)：环境、产物与历史验收口径；当前权限限定以本报告和当前源码为准。

## 2. 功能与案例映射

| 案例 ID | 功能 | 真实测试文件 / 名称 | 结果与断言 |
| --- | --- | --- | --- |
| T-M08-01 | M08-F01 | `agent-network.test.cjs`：`relations persist with optimistic revisions and reject self, duplicate, unknown and source-forged identities` | 通过；修订冲突、重复、自身、未知节点和来源冲突拒绝 |
| T-M08-02 | M08-F02 / F03 / F04 | `agent-network.test.cjs`：`a main Agent actually discovers and delegates only its allowed children; results and cancellation are owned by the original parent` | 通过；受控主请求只能发现允许目标，委派、原父回查/取消 |
| T-M08-03 | M08-F03 | 同一 `agent-network.test.cjs` 案例中的重复委派断言 | 通过；重复 10 次，子 native 执行计数=1 |
| T-M08-04 | M08-F04 | 同一案例中的自我委派、跨父任务读取与伪造来源断言 | 通过；全部返回授权拒绝 |
| T-M08-05 | M08-F05 | `collaboration-broker.test.cjs`：`real stdio MCP initializes, exposes scoped operations and authenticates its loopback dispatch without leaking identity into arguments` | 通过；真实子进程 stdio 与环回 broker，业务 dispatcher 受控 |
| T-M08-06 | M08-F05 | `codex-host.test.cjs`：`MCP approval adaptation is scoped to bridge tools and does not replace native account, model or filesystem policies` | 通过；桥接审批范围不替换原生策略 |
| T-M08-07 | M08-F06 | `agent-network.test.cjs` 上述主从案例：仅撤 memberIds、保留 leaderId 后重查旧子任务 | 通过；同主、原父任务仍活跃的有限撤销场景 |
| T-M08-08 | M08-F01 | `windows-i05-ui.cjs` 与 [界面报告](../../../artifacts/I05-ui.json) | 通过；mock 关系选择与保存，不是生产授权端到端 |

测试入口：[agent-network.test.cjs](../../../desktop/tests/agent-network.test.cjs)、[collaboration-broker.test.cjs](../../../desktop/tests/collaboration-broker.test.cjs)、[codex-host.test.cjs](../../../desktop/tests/codex-host.test.cjs)。

## 3. 四条真实协作链

以下运行在同一 Windows 宿主和它的 WSL，日期为 2026-10-10。本次仅核对原始报告，未再次调用模型。

| 案例 ID | 功能 | 主 → 子 | 结果 |
| --- | --- | --- | --- |
| T-M08-09 | M08-F02 / F03 / F04 / F05 | Windows Claude → WSL OpenCode | 通过；真实 MCP、子原生回复、父汇总 |
| T-M08-10 | M08-F02 / F03 / F04 / F05 | WSL OpenCode → Windows Claude | 通过；反向原生主/子链路 |
| T-M08-11 | M08-F02 / F03 / F04 / F05 | Windows Claude → WSL Codex | 通过；子 Codex 新会话回复 |
| T-M08-12 | M08-F02 / F03 / F04 / F05 | WSL Codex → Windows Claude | 通过；原生 Codex 主任务通过 MCP 委派 |

指标：以上四条链人工转述子结果次数=0，子结果来自原生工具，父回答在原主会话产生。受控委派十次重试执行次数=1，与真实生产链的成功数是两种不同指标。

## 4. 当前不通过、部分满足与未验收

| 案例 ID / 范围 | 判定 | 原因及后续验收 |
| --- | --- | --- |
| T-M08-13：Windows Codex 相关生产链 | 未通过 / 原生配置阻塞 | 其默认模型被账号拒绝；不替换模型来制造成功 |
| T-M08-14：更换 leader 后旧主读/控原子任务 | alpha.6 已修复，受控换主/清主反例见 T-M08-20 | 新委派仍检查当前 leader；活跃原父读控按原请求/任务/会话账本检查，受控修复通过 |
| T-M08-15：清空主关系后旧主读/控原子任务 | alpha.6 已修复，受控通过 | 活跃原父查控原子，清主不授权新委派；父终态和来源伪造仍拒绝 |
| T-M08-16：父任务终态后 MCP task_result | 当前明确拒绝，不能宣称仍可读 | 人类界面的 owner 查询另路可读；是否扩大原 scope 生命周期需明确设计 |
| T-M08-17：独立 Linux 与 Windows 双向协作 | alpha.6 本次通过 | 独立 SSH Linux OpenCode ↔ Windows Claude，两方向实际 list_agents/delegate/task_result、原生父子 succeeded；[最终原请求报告](../../../artifacts/I06B/2026-10-12/real-resumed.json) |
| T-M08-18：节点图、拖拽、保存回应丢失恢复 | alpha.6 本次通过 | 真实 Windows 图交互、稳定 operationId、丢 ACK 重开原收据恢复；[报告](../../../artifacts/I06B/2026-10-12/ui.json) |
| 真实协作中的全部权限/表单/取消 | 部分证据 | 本轮真实核心样本是文本回复，复用受控控制链不能冒充所有原生控制实测 |

历史 I05 文档“撤销后既有任务可查询/取消”只能对应 T-M08-07 的同主撤子场景。必须保留这一限定，不能据历史文字扩大当前已测试权限。

## 5. 复现和下一次更新

受控回归：`npm test --prefix desktop`。真实运行脚本：[windows-i05-real.cjs](../../../desktop/tests/windows-i05-real.cjs)、[windows-i05-codex-main.cjs](../../../desktop/tests/windows-i05-codex-main.cjs)，需要隔离 profile，会实际调用模型。

I06B 已将 M08-F06 拆成新委派授权和旧任务管理授权的独立反例，验证换主、清空、撤子、父终态、伪造来源、跨父会话、未知委派不重放。原测试 ID 保留，新增断言和真实证据已更新本报告及 [整体设计](design.md)，同时更新 I06B 迭代验收。

## 当前自然语言发现验收

T-M08-19 / M08-F02/F03/F04/F05：2026-10-12 / alpha.2 加发现修复源码（随后交付 alpha.3）/ WSL / Codex 0.161.0 与 Claude Code 2.1.296。复用用户“查看你的模型，以及你连接的子agent有哪些……”原需求，真实主工具调用 Bridge `list_agents`、`delegate`、`task_result`，真实 Claude 自报模型，主回答输出连接图；双方 succeeded。允许关系与 dispatcher 为隔离受控实现，MCP/原生主子进程及回复是真实执行。模型自报未独立核实到供应商运行时字段，不把客户端名等同模型名。证据：[真实报告](../../../artifacts/codex-discovery/2026-10-12/native-report.json)、[脚本](../../../desktop/tests/linux-codex-discovery-real.cjs)。

受控 T-M06-CX-06 同时检查新会话与原 Session 续聊收到指引、普通聊天消息不变、去重和原生配置保持。真实 Codex resume、GUI 全关系、独立物理机器链未因本条验收被标通过。原故障核对：[脱敏报告](../../../artifacts/codex-discovery/2026-10-12/diagnosis.json)。

## I06B 当前验证入口

2026-10-12 / 0.6.0-alpha.6：T-M08-20 / M08-F01/F04/F06：同 ID 并发十次只增一次关系 revision、失败落盘不改内存、新主/别父/伪造源拒绝、旧父读控反例。本次代码、命令、逐项结果与限制汇总于 [I06B 实施](../../iterations/I06/graph-implementation.md)。受控工程结果见 [桌面 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)、[核心 TAP](../../../artifacts/I06B/2026-10-12/root-tests.tap)，界面见 [UI](../../../artifacts/I06B/2026-10-12/ui.json)、[性能](../../../artifacts/I06B/2026-10-12/performance.json)，本次核心 43/43、桌面 110/110、Windows 图 10 组通过；性能 p95 30.0ms。独立 SSH 双向原生链、普通无 debug EXE 及源/包完整性分别通过，原始证据与范围见当次报告。历史表保留原日期/版本，不计为本次重新运行。

最终包真实双向链核对：反向原生服务退出后，在同一上下文恢复服务，原 requestId/同内容完成父子任务；原鼠标授权保持，actual tools 与标记均确认。仅查询已完成原结果的验证通过，窗口首次失败与恢复分开保留；不宣称自动恢复服务。[最终结果](../../../artifacts/I06B/2026-10-12/real-resumed.json)。

## 当前节点管理专项

T-M08-21 / M08-F01/F06：2026-10-13 / 0.6.0-alpha.9。范围：子撤权、主清空与节点事务原子提交，恢复不重新授权，未知元数据屏障与旧任务原来源保持。逐项实际结果、环境、脚本、原始证据与未测范围见 [节点管理完整验收](../../iterations/I06/node-management.md)。工程证据为本次 [桌面 TAP](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)；窗口/程序/包状态以该报告实际结果为准，历史表不充当本次重测。原生 SSH/模型链保留 alpha.6 历史结果，本次未重跑、不改用户 profile、不提交 Prompt。

## I06C alpha.10 当前专项

T-M08-22 / M08-F01/F06：2026-10-13。范围：机器移除根据原 machineId 的全部节点撤销当前授权：主节点在该机则清主及所有当前子边，仅子节点在该机则删对应成员。removedMachines、collaboration 与 machineOperations 原收据同网络文件原子提交；SSH 配置提交与此文件间用原收据补齐，未知屏障阻止新元数据写入。历史父子任务保留，恢复不重新授予协作权限。 本次实际工程、隔离 TCP SSH、Windows 界面/包与未测项见 [6C 首批验收](../../iterations/I06/machine-management.md)；[桌面 TAP](../../../artifacts/I06C/2026-10-13/desktop-tests.tap)和当次报告是当前证据，alpha.6 双向真实 Agent 链保留原日期/版本。未改用户 profile、未升级用户 daemon、无真实模型任务，不将首批标为完整 I06C。

## 当前验证

T-M08-19 / M08-F03/F04/F05：2026-10-14，WSL Ubuntu / Node 22.23.1，桌面受控回归 **150/150** 通过（全工程总数，模块之间不重复相加）。场景：协作 scope 与旧父归属不变，维护屏障也作用于 MCP 对目标机器的新原生准入，避免仅锁界面仍可委派。所属机器 maintenance unknown 时不换地址/节点绕过；其他来源机器的已有会话仍可执行。卸载明确确认后撤销当前新委派权限，历史父子任务与结果保留，控制 confirmed 不能替代子任务终态。

证据：[完整桌面 TAP](../../../artifacts/I06C-final/2026-10-14/desktop-alpha13.tap)、[维护实际 daemon/process 7 项](../../../artifacts/I06C-final/2026-10-13/maintenance-tests.tap)、[包内容核验](../../../artifacts/I06C-final/2026-10-14/package-alpha13.json)。维护测试使用真实生产 daemon、Unix socket、独立进程和磁盘，原生 host 受控、无模型调用；不能替代独立服务器或真实原生控制。Windows 窗口、原生 Session 与双向链、使用/卸载、命令和限制统一见 [逐项验收](../../iterations/I06/final-delivery.md)，未实际执行项不得计为通过。

## 本次独立实机补充

2026-10-14：冻结 alpha.13 Windows 包与独立 Linux，真实升级、同原生 Session 两轮及两方向协作通过；真实 Windows 取消和普通无调试窗口原生标记分别通过。独立 SSH/生产 daemon 的精确响应丢失、10 同 ID 与重启为受控执行器证据，不充当真实模型。Linux 文件任务受原生 OOM 退出影响，原 ID/Session 与 unknown 占位保留，未准出、未重发；后续 alpha.14 上传专项不冒充此模型矩阵复测。逐场景原始证据、版本、实际失败、临时自有资源调度及剩余项见 [I06C 当前实机记录](../../iterations/I06/final-delivery.md)。

## 小队原生等待观察

T-M08-120：基于alpha.23的未发布源码增量，WSL Linux / Node22.23.1。受控原执行与真实SQLite重启，模型0。小队自动化/公共空间/任务专项30/30（共享总数）通过，覆盖等待投影、脱敏、通知跨重启去重、unknown保留和终态清除，通知未增加执行；前端类型与构建通过。首次失败、完整TAP、复现和证据限制见[专项](../../iterations/I07/native-waiting.md)。未运行真实原生权限批准、Windows浏览器/EXE或独立SSH，未更新发布附件。


2026-10-28 Windows 受控：关系冲突定向回归通过，涵盖 5→7→6、备份/替换失败、幂等和原历史保全；全量仍有失败，真实 profile 未恢复。[证据与未测项](../../iterations/I08/relation-conflict-diagnostic.md)。

2026-10-29 / alpha.70预发布 / Windows：定向98/98、包内关系/SSH33/33、普通portable恢复与完整重启、实际包内恢复及真实回环SSH/SFTP界面流程通过，模型0。第二轮全量1030通过/1失败/41平台跳过，DSH同一竞态基线也有失败；各原失败及验收器收尾限制保留。不代表真实profile、生产SSH或完整矩阵准出。[证据与边界](../../iterations/I08/issues27-28-current-state.md)。
