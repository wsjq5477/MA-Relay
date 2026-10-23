# M01 桌面交互测试报告

## 连接身份与节点管理验证

| 场景 ID | 场景与实际结果 |
| --- | --- |
| T-M01-200 | Windows生产界面10组与纯状态/SSR用例：保存后刷新/重开/扫描、Desktop/Web隔离、损坏/缺失/失败反馈、独立接入和保守禁用。 通过；2026-10-23，WSL Node22.23.1/Windows Node+Edge，模型0。 |

隔离修复基线桌面777/777，Windows生产前端受控10组通过；当前集成和普通EXE另列。[原始证据、环境与未测项](../../iterations/I08/connection-identity-node-scope.md)。

## MCP02恢复与观测（2026-10-22）

M01-F02/F05：MCP卡片展示探测时间与有效性，过期后连接/工具为未知；区分服务端目录与原生连接/委派授权。 WSL Node22.23.1共享桌面758/758、根68/68通过，最终JSON修复后CLI11/11及类型/lint/核心构建通过；模型0，真实原生模型委派未测，Windows结果按专项登记。 [实现、原始证据与未测项](../../iterations/I08/mcp-open-recovery.md)。

## MCP状态事实与主角色准入（I08-MCP02第一片）

T-M01-MCP02F / M01-F01/F02/F06：2026-10-22，alpha.43派生工作源码（同日已冻结为本地候选 **alpha.44**，仅版本位变更），WSL Node22.23.1。本轮同机定稿全量 `cd desktop && node --test tests/*.test.cjs` 为 tests **750** / pass **750** / fail 0，根 `npm test` 66/66（当日首轮 747/747（58.4s），加入 DSH profile/OpenDesk 用例后定稿 750/750），根 `typecheck`/`lint`/`build` 与桌面 `tsc --noEmit` 通过；计数为全工程共享，不跨模块相加。与本模块相关：`mcp-status-facts-ui.test.cjs` 4/4（六项事实逐项渲染、旧摘要只显示一行升级说明、`revoked_config_pending` 同时显示撤权与待清理、不可管理原因原文）、`connection-ui.test.cjs` 11/11、`agent-configuration-ui.test.cjs` 8/8、`connection-capabilities.test.cjs` 11/11（十入口能力三维与主角色准入）。同日补 DSH CLI 显式 profile 与 OpenDesk 用例后，界面组为 **24/24**，桌面全量定稿 **750/750**；DSH 行新增“DSH 原生 profile”输入框，`dsh-desktop` 仍只有导出片段。均为受控渲染/契约测试，**模型0、未打开真实窗口、未连真实原生Agent**。

未测：真实Electron窗口下的MCP卡片交互、真实后台返回的六项事实、真实原生列表刷新、Windows真机界面；逐入口真实原生可见性与主调用链见[本轮记录](../../iterations/I08/mcp-open-integration.md#114-逐入口完成度)。证据与失败修复见[I08-MCP02开发记录](../../iterations/I08/mcp-open-integration.md)。

2026-10-22 / alpha.43：OpenDesk CLI/Desktop前端执行门禁修复；生产注册表遍历回归8/8，桌面全套722/722，生产界面10组与包源码核验通过，新增Prompt0。Windows实际包内窗口4组、普通无调试便携EXE4组均通过；日常alpha.43窗口已正常打开，ASAR匹配并复用原alpha.42后台，原记录只读核对保留。首次失败和未测边界见[本轮专项](../../iterations/I08/opendesk-ui-admission.md)。

2026-10-22 / OpenDesk Desktop 0.3.9：已安装原网关的真实执行、续聊与普通EXE窗口重开通过；无运行代码变更，不将历史自动测试计为今日重跑。分层计数与未测项见[现场专项](../../iterations/I08/opendesk-desktop-live.md)。
OpenDesk相关验证统一见[专项报告](../../iterations/I08/opendesk-existing-interfaces.md)，明确受控协议、真实原生启动、模型和Windows包的独立范围；共享计数不跨模块累加，未执行项保持未测。

## alpha.38 维护前置门禁与越过未确认收据

T-M01-153 / M01-F03/F06：2026-10-21，工作区 0.6.0-alpha.38，Linux 本机 Node v22.23.1 + 工作区内 Playwright chromium headless shell 156.0.8078.4（本机无 Edge）。新增 [ui-maintenance-blockers.cjs](../../../desktop/tests/ui-maintenance-blockers.cjs) **实跑通过**（`{"status":"passed","checks":5}`，页面错误 0、模型 0）：① 任务与 Agent 工作被列出且**永不出现越过控件**、不下发维护；② 仅未确认收据被列出、按原 key 只查询一次，**只有勾选后**才以新的 maintenance operationId 下发 `allowUnresolved:true`（报告实录 `expectedRevision:1`、`allowUnresolved:true`）；③ 门禁被拒时显示远端原话与阻塞明细而不是笼统阶段失败，常规动作仍可用；④ 持久历史以中性记录（非 alert）与实时阻塞项分开标注，已是最新版本的 daemon 不提供可点击升级；⑤ 无收据端点的 daemon inline 说明，不把对话框判为整体失败。既有 [ui-maintenance-progress.cjs](../../../desktop/tests/ui-maintenance-progress.cjs) 仍 **3 checks passed**。`npx tsc --noEmit` 0 错、`npx vite build` 成功、全量桌面 **689/689（0 失败）**。**真实 Windows GUI 未测**（本机无 msedge，`windows-*.cjs` Edge 套件未跑）；越过路径未在真实远端执行，现场切换是带外作业。[契约、风险与未测边界](../../iterations/I08/alpha38-delivery.md)。

## 维护阶段可见与有界自动核对

M01-F03/F06；2026-10-21，工作区 0.6.0-alpha.36，Linux 本机 Node v22.23.1 + 工作区内 Playwright chromium headless shell 156.0.8078.4（本机无 Edge）。新增 [ui-maintenance-progress.cjs](../../../desktop/tests/ui-maintenance-progress.cjs) **实跑通过**（`{"status":"passed","checks":3}`，页面错误 0、模型 0）：上传阶段在卡片与对话框同时显示“正在上传 512 KiB / 2.0 MiB”且 `progressbar` 有 `aria-valuenow`、`progressWarning` 为提示（alert 数 0）；快照切到 verifying 后对话框显示“正在校验 2.0 MiB / 2.0 MiB”（反向对照：撤掉实时快照解析后该断言失败）；确认升级后未决文案出现、按钮禁用、自动查询在原 operationId 上按 1s/2s 退避（实测 1004ms/3004ms）且终态后停止；`rejected` 以 `role=alert` 显示远端原因。`npx tsc --noEmit`、`npx vite build` 通过；全量桌面构建后 684/684（构建前 682 项 679 通过中的 3 项失败经独立验证定位为测试未隔离 `DSH_HOME`，同日由测试侧修复，见 [alpha.37 交付记录](../../iterations/I08/alpha37-delivery.md)）。**既有 `windows-*.cjs` Edge 界面套件本机未执行**（硬编码 msedge，本机无该浏览器），仅静态核对按钮文案/aria 保留，需在 Windows 端补跑确认轮询不破坏调用计数断言；模态框遮挡、多意图并存未做 UI 断言。[切片说明与未测边界](../../iterations/I08/maintenance-offline/maintenance-visibility.md)。

## alpha.36整合边界

2026-10-21 / WSL Node22.23.1：本轮全量核心57/57、桌面676/676，类型/lint/前端构建通过。各模块共享计数不相加；包核验、Windows契约144/144、界面26组与普通EXE7组通过，具体以专项为准，真实模型/用户profile/独立SSH未验。[完整交付](../../iterations/I07/alpha36-delivery.md)。

## Agent 行配置入口验证

M01-F01/F02/F06/F14；2026-10-21，alpha.34派生工作源码。生产SSR82/82（含新增6项）及Windows Edge生产界面受控IPC8组通过；覆盖目标固定、迟到响应隔离、DSH精确安装/入口、secret清空、写入在途/离线限制和窄窗口。完整桌面649/649、核心57/57通过，生产MCP临时文件4组、既有DSH前端3组保持；普通EXE与候选证据统一见[专项](../../iterations/I07/agent-row-configuration.md)，共享计数不跨模块相加。未在用户profile修改原生配置、未调用真实模型或升级独立SSH。

## 扫描与原管理操作恢复专项

M01-F01/F04/F06/F07；2026-10-20，alpha.34派生工作源码。Windows Edge生产前端受控IPC6组通过、页面错误0、模型0；覆盖扫描/查看可用、执行仍受锁、原管理来源/错误/ID可见、查询失败保留及匹配原收据后解除。当前全工程、普通EXE与包验证结果统一见[完整规则与分层验证](../../iterations/I07/agent-management-recovery.md)，计数共享不跨模块相加。当前用户profile只读诊断不是升级实测；真实模型、原profile切换与独立SSH未验。

## DSH Desktop / Web 专项

当前本地.dsh.3候选：核心56/56、完整桌面607/607、Windows DSH11/11、生产前端3组及普通EXE6组通过；真实Windows/WSL认证与接口通过，Desktop同Session两轮及去重已观察，但模型均RATE_LIMIT，WSL模型/独立SSH未测。[当前源码、包与分层证据](../../iterations/I07/dsh-exe-delivery.md)。以下保留各先前冻结范围。

M01-F01/F06/F15：本次WSL受控HTTP/独立worker与方向能力、Windows Node契约、Edge生产前端及失败记录统一见[本轮完整契约与证据](../../iterations/I07/dsh-desktop-web.md)，工程总数不跨模块相加。Windows当前安装2.0.18/认证屏障和WSL Web profile是环境核对；未在原实例调用模型，不作为真实原生、发布包或独立SSH验收。

2026-10-20 alpha.34发布门禁：中央hello增加`opencode-dual-api-v1`与`team-context-mcp-v1`语义能力，新前台遇到仍运行的alpha.33后台时要求显式停止并重开，设置/停止入口保留。避免新EXE复用旧2.x独占后台后仍拒绝1.x或缺MCP/材料方法；原任务、收据和unknown不改。

## 维护上传进度与持久化修复（issue #10）

M01-F03：本轮WSL专项7/7、相关42/42与核心51/51，Windows最终7/7及SSR66/66通过；最终全量/真实TCP/普通EXE/公开下载逐层记录。用户profile及独立服务器未验，共享计数不跨模块叠加。 [完整设计、实测与边界](../../iterations/I07/maintenance-persistence.md)。

## CT-05桌面选材/核对导出

T-M01-152 / M01-F10：WSL Node22.23.1最终桌面581/581零跳过/退出0，新5项和定向15项为全量子集；Windows Node24.19.0/Edge155生产前端、真实Coordinator/SQLite、受控机器9组通过、页面异常0。覆盖四类明确版本/本机MD与JSON实际下载、报告来源/正文/引用/摘要拒绝、目标/任务变化失效、跨工作迟到隔离及原unknown不变/原生请求0。clipboard受控，模型调用0，不等于系统剪贴板、EXE或真实Agent消费本轮导出。计数共用不相加；后端任务/权限/收据合约无变化。[日志、截图、首次构建与壳退出记录、复现和发布边界](../../iterations/I07/context-packet-ui.md)。

## 整合源码与本地候选

T-M01-149 / M01-F04/F06/F10/F14：核心51/51、桌面570/570零跳过（定向85/85及兼容15/15是相关子集），根类型/lint/构建与桌面构建通过。Windows前端26组/模型0，按历史/门禁/管理/材料/MCP分别记录；最终integrated.3普通Windows EXE五组通过：原历史/文档/MCP导出、窗口/后台重开、持久资源和原unknown保留，原生请求0；这是隔离合成profile，不是真实Agent模型或用户现场。包42 CJS/78核心/1446 Linux条目匹配，未部署用户SSH或跑真实模型。各模块共用计数不相加；首次夹具/原型失败与原历史证据保留。[版本、源码、所有原始结果和限制](../../iterations/I07/integrated-source.md)。

## issues #8/#9受控验证

M01-F04/F05/F07：核心51/51、桌面543/543（含版本/管理/原路由回归）、最后定向7/7及工程检查通过；Windows95项原路由/9项管理CJS、前端专项4组/既有10组及普通EXE5组通过；分发另按专项逐项记录。无真实模型/用户profile/独立服务器升级，不跨模块累加共享计数。 [需求、实现、验证与边界](../../iterations/I07/version-management-recovery.md)。

## issue #7 协作兼容修复

M01-F04/F05/F07：本轮仅受控HTTP/CLI、生产后台无推理、TCP SSH及Windows交付验收；用户现场/独立SSH/真实模型未测。实际执行结果、首次失败与最终工程/包证据统一引用专项，共享计数不跨模块叠加。 [完整需求、验证与交付](../../iterations/I07/collaboration-compatibility.md)。

## 历史详情路由与局部错误

T-M01-150 / M01-F04/F05/F07：alpha.30隔离修复；合成路由6项、受控TCP SSH1项、Windows纯CJS91/91、Linux SSR63/63，新生产前端7组和既有10组通过，模型0。最终桌面529/529、核心45/45、lint/类型/构建通过；38 CJS/78 core/1401 Linux资源匹配145个冻结源文件。普通Windows无调试EXE合成原两轮/Session只读与关闭重开/后台重启4组通过。分发实际结果及首次失败统一见[当次专项](../../iterations/I07/history-detail-recovery.md)；共享计数不跨模块叠加，用户故障profile/独立服务器未复测。

## CT-04桌面阅读与MD下载

T-M01-148 / M01-F10：2026-10-19，本地a872275/alpha.29派生工作区（公开另分支alpha.31尚未合入）。WSL Node22.23.1桌面541/541零跳过，新版本/摘要/MD保护4/4为全量子集，桌面类型/Vite构建通过。Windows Node24.18.0/Edge155，生产前端→真实Coordinator/SQLite、受控机器八组流程通过，页面错误0、模型0；实际浏览器下载的UTF-8旧版正文与受控clipboard收到内容一致。clipboard是受控接收/拒绝，不冒充系统剪贴板实写。旧后台/缺版/摘要错误阻止传出、A迟到响应不入B、窄桌面/原unknown不变和原生请求0通过。未跑新EXE/独立SSH/真实Agent消费导出，计数跨模块共用不叠加。[完整原始日志、下载、截图与复现](../../iterations/I07/public-materials-ui.md)。

## 独立 MCP 文件与配置增删

M01-F01/F06；日期2026-10-19，alpha.29后未发布工作区。WSL Node22.23.1受控全桌面537/537、核心45/45；真实原生列表三工具增删通过，Claude/OpenCode连接、Codex仅列表；Windows Edge155生产界面4组通过但机器/原生执行受控。计数为共享结果不跨模块相加，模型调用0。新EXE、真实Windows原生Agent、独立SSH与独立接入真实模型委派未测。源码/命令、首次失败、原始日志和逐层边界见[专项验收](../../iterations/I07/mcp-installation.md)。

## CT-01连接能力与原拒绝恢复

T-M01-144 / M01-F04/F05/F07/F09：alpha.28后未发布工作区，WSL Node22.23.1 / Windows Edge155。Windows生产前端5组/5图与SSR验证方向选择、历史直接会话、模拟丢回应/刷新/原ID拒绝恢复；模型及真实后台0。共享定向32/32（全桌面503/503子集）、核心45/45及工程检查通过，无跳过；跨模块不相加。首次夹具失败及修正保留，真实新三工具/当前EXE/独立SSH未验。本轮模型0，先前真实Claude结果不计本轮。[脚本、命令、失败与最终原始证据](../../iterations/I07/connection-capabilities.md)。

## 原生接入准入与核对收据

T-M01-142 / M01-F10：登记及独立手动执行选择器只列支持小队的节点，旧误登记卡片/原尝试保留，Hermes/Pi/DSH直接会话入口仍可用。Windows生产前端6组/6图通过、0页面错误/0写入；首次布局夹具失败及修正保留。 最终合并源码串行桌面474/474、核心45/45及工程检查通过；受控CLI/磁盘/浏览器，模型0，未升级用户后台或重建EXE，不替代真实原生或独立SSH。[需求、原始失败、最终日志与未测边界](../../iterations/I07/native-integration-guards.md)。

2026-10-18 / T-M01-141：桌面空闲修复源码，WSL Node22.23.1 / Windows Node24.19.0及Edge155。核心45/45、桌面424/424、定向20/20、Windows受控界面3组通过，模型0；属于共享工程计数，不跨模块相加。普通EXE与黑窗观察、冻结包、首次环境失败及用户现场未测边界按[本次完整报告](../../iterations/I07/desktop-polling.md)记录，历史包不冒充本次修复。

## 当前 Agent 版本与历史安装合流

T-M01-141 / M01-F01/F02/F06：alpha.28后未发布工作区、WSL Ubuntu/Node22.23.1。概览/图/添加列表隐藏 supersededBy 旧安装，历史阅读保留原节点来源。 桌面424/424、核心45/45通过，计数为共享工程结果不跨模块相加；真实Claude版本2.1.302与受控历史节点合流明确分层。类型/lint/前端构建通过；当前EXE、用户运行中profile、真实模型和独立SSH未验证。[完整场景、原始日志与首次失败](../../iterations/I07/current-agent-discovery.md)。

## 六种 Agent 品牌图标

T-M01-140 / M01-F15：alpha.28 后未发布源码；WSL Node22.23.1 前端 SSR **63/63**（图标4项与既有SSR59项，共享计数）通过。真实 Windows Node24.18.0 / Edge155.0.4283.45 / 冻结生产前端，六个受控节点的浅色、深色与关系图 **13项、3图**通过；检查实际图片加载与角色标记分离，外部资源请求0、模型0，无页面错误。 [浏览器报告](../../../artifacts/agent-support/2026-10-18/icons/report.json)、[浅色](../../../artifacts/agent-support/2026-10-18/icons/inventory-light.png)、[深色](../../../artifacts/agent-support/2026-10-18/icons/inventory-dark.png)、[图](../../../artifacts/agent-support/2026-10-18/icons/graph-dark.png)。复现：`node --test desktop/tests/agent-icons.test.cjs desktop/tests/ui-redesign.test.cjs`；Windows浏览器脚本[入口](../../../desktop/tests/windows-agent-icons.cjs)。不证明新 Agent 模型、Windows EXE 或独立 SSH。[完整边界](../../iterations/I07/native-agent-expansion.md)。

## Windows视觉与交互检查（未发布工作区）

T-M01-133 / M01-F01/02/05/06/07/08/09/10/14：Windows Node24.19.0、Edge155.0.4283.45，生产React前端、临时隔离Coordinator及合成历史，模型0。完整主脚本5组通过、12张截图已逐张查看；1440×960标准与980×660最小桌面窗口、深浅主题均有记录，全部截图document/content横向overflow=false，页面异常0。搜索/侧栏重开、关系草稿跨视图与页面、丢授权ACK后原收据恢复不重放、任务详情及系统主题/停止确认取消均通过。[逐步截图、健康、观察与限制](../../iterations/I07/ui-visual-acceptance.md)、[最终报告](../../../artifacts/ui-redesign/2026-10-18/verified/ui.json)、[脚本](../../../desktop/tests/windows-ui-redesign.cjs)。这5组不与旧375工程基线、53项SSR或其他模块相加。

初次脚本在主题精确label等待处超时，已修控件可访问名称并完整重跑；初版续问区出视口和机器页说明留白过多也已修复，initial截图与失败报告保留。本次源码还修复菜单Escape/外点/单开及动作后关闭、清空搜索焦点、长名换行、详情固定原ID/丢弃迟到回应、续聊执行锁/节点在线门槛、范围排除当前选择时隐藏阅读区，以及小队continuationError提示且保留原生终态。最终状态矩阵10组/8图、小队3组/3图、原图交互10组与稳定截图均通过；`0.6.0-alpha.28.ui.2`普通EXE4项和包资源/摘要核验通过。未访问用户profile、独立SSH或真实模型，GitHub alpha.28附件未改变。

## 当前工作区集成基线

T-M01-132：alpha.28加未发布UI/会话补丁，WSL Node22.23.1，受控进程/SQLite/SSH/HTTP/React SSR，模型0。核心45/45、串行全桌面375/375（含既有父/子测试）、lint/根类型/前端类型及构建通过，无测试跳过；保留既有chunk体积提示。共享计数不跨模块相加。[完整命令、原始日志和源码观察清单](../../iterations/I07/integration-baseline.md)。未验证新UI浏览器/Windows EXE、独立SSH或真实模型；模块行为无新改动，发布附件未更新。


## 桌面体验重构（未发布源码）

T-M01-129 / M01-F01/05/06/07/09/14：WSL Node22.23.1、React19.3.0；新生产组件受控SSR门槛53/53通过，包含原节点unknown与独立节点、关系/断连共享执行锁、历史/验证/终态/canContinue续问、原恢复原因与生命周期入口。原图/管理受控回归24/24通过，模型0。最终桌面全量373/373、TypeScript/Vite与文档检查通过；预览和视觉/EXE未测边界见[当次专项](../../iterations/I07/ui-redesign.md)，[SSR原始TAP](../../../artifacts/ui-redesign/2026-10-17/render-tests.tap)。不把SSR当真实浏览器或普通EXE验收；旧版本界面证据仍只属于原版本。


## SSH持久拒绝恢复

T-M01-128：alpha.28已预发布，WSL Node22.23.1/Windows Node24.19.0，合成台账和受控TCP SSH，模型0。最终桌面317/317、核心45/45、Windows契约93/93，lint/类型/构建通过；真实TCP SSH丢响应/daemon重启1项及普通Windows无调试EXE合成验证6组通过，34 CJS/78 core/1395 Linux资源匹配源码。发布以[当次实际记录](../../iterations/I06/daemon-rejection-recovery.md)为准，不推定用户现场恢复。历史记录不计为本次重测。

## 停止协调实际验证

T-M01-121 / M01-F13：2026-10-16，WSL Node22.23.1、Windows Node24.18.0/Edge155、真实Claude2.1.299。停止契约8项、生产Coordinator/AgentNetwork受控路由1项、Windows契约38项及界面7组通过；真实Claude原生停止/观察后台重启3组通过，原取消命令1次、原任务cancelled后归档。全工程/包/普通EXE、首次失败和准确边界统一见[当片报告](../../iterations/I07/native-stop.md)，这些共享计数不跨模块相加。未证明真实权限批准/拒绝链、独立SSH或其他原生适配取消。

## I07C首批实际验证

T-M01-110 / M01-F12：2026-10-16，WSL Node22.23.1、Windows Node24.18.0/Edge155。核心45/45、最终串行桌面222/222、Windows契约29/29；这些是全工程计数，跨模块不相加。Windows前端/真实Coordinator受控目录和成员10组，真实Claude2.1.299自动主角色3轮同Conversation/原Session、新scope、后台重启后实际X失败/Y通过及终态后总验收；执行成员为受控外部MCP、Node检查实际运行。最终包/普通EXE、首次连接恢复竞态和并行维护ENOENT分别保留证据，完整结果见[I07C首批报告](../../iterations/I07/automation.md)。未证明真实多原生角色、其他接入自动续接、用户自研/独立SSH或完整停止。

## I07B 实际验证

T-M01-101 / M01-F10/M01-F11：2026-10-16，WSL Node22.23.1、Windows Node24.18.0及Edge155。核心45/45、最终桌面208/208、Windows契约18/18；这是全工程计数，不跨模块重复相加。真实Claude两轮手动开发、独立MCP编译连接器实际Node检查X失败/Y通过、MCP协调员验收；Windows生产前端/Coordinator受控目录7组通过、模型0。首次原有daemon启动失败、重查及最终包/普通EXE的实际结果均见[I07B报告](../../iterations/I07/task-handoff.md)。未验证用户自研产品、独立SSH小队链、OpenCode/Codex任务闭环或I07C自动激活。


## I07A 实际验证

2026-10-15 / WSL Node22.23.1、Windows Node24.18.0 / 源码alpha.21，GitHub预发布alpha.20。

| 用例 | 功能 | 结果与证据边界 |
| --- | --- | --- |
| T-M01-100 | M01-F10 | Windows界面完整流程及普通EXE结果以本次交付实际记录为准；不把受控API界面当作真实模型。 |

原始证据、工程总数及真实工具/界面/普通EXE分别见[I07A交付](../../iterations/I07/delivery.md)。[核心45/45](../../../artifacts/I07A/2026-10-15/root-tests.tap)、[桌面197/197](../../../artifacts/I07A/2026-10-15/desktop-tests.tap)为全工程计数，不在本模块重复相加；I07B/C能力不计为已通过。


## 当前专项

2026-10-14 / WSL Ubuntu / Node 22.23.1 / 源码 0.6.0-alpha.18：共享缓存自引用/旧清单/损坏旁路重建、Windows OpenCode 原意图恢复与并发保护、查询结果和脱敏原因；定向 55/55（计入桌面全量 176/176），根 43/43，lint/类型/构建通过。受控文件/宿主测试，无模型调用。原始证据：[定向](../../../artifacts/runtime-recovery/2026-10-14/targeted.tap)、[全桌面](../../../artifacts/runtime-recovery/2026-10-14/desktop-tests.tap)。Windows 真实 Electron 资源 4 组、Edge 受控 UI 3 组、普通无调试 EXE/合成原意图与关闭重开 4 组均通过；包校验 28 CJS / 1383 Linux 文件与当前源码匹配。详细过程及边界按 [完整专项](../../iterations/I06/runtime-recovery.md) 的实际结果判定，不将历史原生证据提升为本次重测。


历史基线：2026-10-14 / 0.6.0-alpha.13。工程与受控维护验证通过，独立服务器/最终程序专项按 [I06C 收尾](../../iterations/I06/final-delivery.md) 实际状态记录；旧版本段落保持原日期。
核对：2026-10-12。当前源码候选 0.6.0-alpha.6；此前 alpha.2 的 SSH 主要验收保持原范围。设置页停止与普通关闭入口已补齐，隔离 UI 6 项通过；真实 Windows SSH 两轮和后台生命周期按本页当前报告记录。旧 0.5.0 结果作为历史基线保留。



## 当前拖动与兼容验证

T-M01-17 / M01-F04/F09：2026-10-13，原用户 profile 认证 IPC 只读确认后台 alpha.5 不支持图布局；alpha.7 真实打包 Electron/认证 IPC/受控旧接口复现全部拖动锁定。alpha.8 真实打包窗口 7 组通过：Agent、整组机器背景、画布两种平移/出界释放、本机恢复、恢复同步与主居左、原丢 ACK 保护，按 [当次报告](../../iterations/I06/graph-drag-fix.md)记录。原用户窗口的旧 debug 端口不可用，不能冒充已直接观察该窗口。

既有生产前端图交互 10 组、主角色/避让/中键 6 组通过：[回归](../../../artifacts/graph-drag-fix/2026-10-13/ui.json)、[专项](../../../artifacts/graph-drag-fix/2026-10-13/usability.json)。桌面 116/116，通过；原生需求数为零。普通 alpha.8 EXE 启动/关闭/重开 3 项通过。原 profile 未改、原生/SSH 结果保留历史范围。

## 历史图交互验证

T-M01-16 / M01-F04/F09：2026-10-13，Windows Edge 实际输入、中央真实文件存储、受控机器。主角色/端点、同一行 WSL 向左路由、中键五种区域、重开、布局 unknown 锁定、换主与旧边锚点共 6 组通过：[专项](../../../artifacts/graph-usability/2026-10-13/usability.json)。原图鼠标/键盘、授权与布局、轮询、冲突/两类丢 ACK、主题及三个分辨率 10 组通过：[回归](../../../artifacts/graph-usability/2026-10-13/ui.json)。没有提交原生模型需求。

路由的向左、间隔障碍、负坐标、复杂通道、60 节点扇出及重叠退化 6 项通过：[路由 TAP](../../../artifacts/graph-usability/2026-10-13/routing-tests.tap)。本次桌面 116/116、60 节点/59 条边的生产前端 p95 37.9ms；普通 alpha.7 EXE 的隔离启动/关闭/重开 3 项通过，包验证详见 [当次交付](../../iterations/I06/graph-usability.md)，历史 alpha.6 原生链保留原版本。


## 1. 实际结果

| 验收编号 | 功能 | 已验证行为 | 结果 / 层级 | 证据 |
| --- | --- | --- | --- | --- |
| T-M01-01 | M01-F01/F02 | 机器优先、WSL 宿主、同机多工具、空格选择与一次接入 | 通过；2026-10-10 界面模拟 | [I05 UI 报告](../../../artifacts/I05-ui.json)、[脚本](../../../desktop/tests/windows-i05-ui.cjs) |
| T-M01-02 | M01-F03 | 首次指纹需确认、拒绝不安装、默认端口、秘密隐藏与不保存 | 通过；界面模拟 | [SSH UI 报告](../../../artifacts/I06A-ssh-ui.json)、[脚本](../../../desktop/tests/windows-i06a-ssh-ui.cjs) |
| T-M01-03 | M01-F03 | 预检后一次安装批准、连接进度、节点自动显示、原 connectionId 重连 | 通过；界面模拟；没有真实 SSH | 同上 |
| T-M01-04 | M01-F05 | 远端只传原 Linux 目录、不出现本地选择目录或模型输入 | 通过；界面模拟 | 同上 |
| T-M01-05 | M01-F04/F05 | 保存主/子与刷新保留、向主节点发需求、看父结果 | 通过；界面模拟；子回复是 fixture | [I05 UI 报告](../../../artifacts/I05-ui.json) |
| T-M01-06 | M01-F06/F07 | 看板来源、未确认操作只限制所属机器、其他节点可发需求 | 通过；界面模拟和中央台账受控测试 | [I05 UI](../../../artifacts/I05-ui.json)、[main 测试](../../../desktop/tests/main.test.cjs) |
| T-M01-07 | M01-F06 | Claude delta 合并、验证输出可读 | 历史版本模拟证据；当前源码阅读核对，未单独重跑最新视觉基准 | [I04F 报告](../../iterations/I04F/report.md)、[流式输出脚本](../../../desktop/tests/windows-streaming-output.cjs) |
| T-M01-08 | M01-F01/F05/F06 | 0.5.0 普通启动/重开有真实机器、节点和历史 | 通过；历史真实发布包 | [I05 portable](../../../artifacts/I05-portable.json) |
| T-M01-09 | M01-F03/F08 | 新候选 Windows 真实安装/两轮/关闭/停止/重开及原任务恢复 | 通过；真实窗口与普通 EXE；密码/DPAPI 另有实际协议报告 | [窗口](../../../artifacts/I06A-real/report.json)、[普通 EXE](../../../artifacts/I06A-final/portable.json) |
| T-M01-10 | M01-F08 | 设置页关闭窗口、取消停止、确认停止 | 通过；6 项隔离界面检查包含此场景；真实生命周期另见 T-M01-09 | [界面报告](../../../artifacts/I06A-ssh-ui.json) |
| T-M01-11 | M01-F09 | 实际拖拽端点、键盘替代、图布局重开、状态刷新不吞草稿 | alpha.6 已实现并验收，实际证据见 T-M01-15 | [I06 图设计](../../iterations/I06/graph-design.md) |

I06A UI 报告的“私钥与 agent 分支”证明字段切换和错误展示，不能证明真实私钥解密、ssh-agent 签名或 Windows DPAPI。

## 2. 本次工程基线

桌面 TypeScript 检查与 Vite 构建通过。全桌面 87/87 受控测试通过，但其中多数属于后台，不能称“87 个界面用例”。持久基线见 [desktop TAP](../../../artifacts/docs-baseline/2026-10-12/desktop-tests.tap) 与 [整体报告](../../testing.md)。

## 3. 复现入口

从仓库根执行不调用模型的类型/构建检查：

```bash
npm run build --prefix desktop
```

隔离界面脚本需要 Windows Node、已安装 Edge、最新 `desktop/dist` 和仅供静态资源的本地服务。先在测试终端服务静态目录，再用 Windows Node 执行：

```bash
node desktop/tests/windows-i05-ui.cjs http://127.0.0.1:4199
node desktop/tests/windows-i06a-ssh-ui.cjs http://127.0.0.1:4206
```

这些脚本使用 mock preload，不运行真实 Electron 后台、不连接服务器、不调用模型。脚本会覆盖同名 UI 报告/截图，重跑前保留需要追溯的旧证据。静态服务是测试环境依赖，不是产品要求用户开第二终端。

真实 Windows 交付验收由 [M10](../10-packaging/test-report.md) 记录，真实模型与控制由 [M06](../06-native-adapters/test-report.md)记录；不能把上述模拟脚本作为它们的通过证据。

## 4. 尚需补齐

Windows 主要流程已通过；系统 agent 服务、加密私钥到独立服务器等专项覆盖与图交互仍按候选限制/后续迭代维护。界面状态延迟 20 样本 p95 也没有本次实测数据，1500ms 轮询周期不等于端到端延迟保证。

## 当前 6A 候选验收结果

2026-10-12 / 0.6.0-alpha.2：[真实 Windows 窗口](../../../artifacts/I06A-real/report.json)与[普通便携程序](../../../artifacts/I06A-final/portable.json)均通过。两轮保持同一 Conversation/native Session，关闭窗口保留同一后台，明确停止后新 PID 保留身份/机器/历史，恢复只查询原任务；普通程序请求数不增加。专项覆盖边界见 [6A 候选验收](../../iterations/I06/acceptance.md)。

## 发现修复展示与启动

T-M01-12 / M01-F06/F08：2026-10-12。真实 Codex worker 的 MCP progress 包含 `agentbridge/list_agents`、`agentbridge/delegate`、`agentbridge/task_result`，见 [原生报告 mcpProgress](../../../artifacts/codex-discovery/2026-10-12/native-report.json)；这是后端事件证据，未单独重跑工具过程的视觉截图。普通 alpha.3 EXE 在隔离 profile 中实际启动、正常关闭、重开，通过主窗口标题、版本和同 Coordinator 核验，未提交模型需求：[报告](../../../artifacts/codex-discovery/2026-10-12/portable.json)。未修改前端组件或轮询契约，完整 SSH/表单视觉专项没有在本次重跑。

## 新窗口设置页停止现有后台

T-M01-13 / M01-F08：alpha.4 的真实打包窗口在旧窗口关闭后进入自己的“设置 → 后台运行”，显示并点击“停止后台并退出”，按真实进程退出和 IPC 停止判断结果，再次打开检查新版本和原配置身份。[报告](../../../artifacts/new-client-stop/2026-10-12/report.json)、[后台运行截图](../../../artifacts/new-client-stop/2026-10-12/new-settings.png)。没有前端功能改动，是现有入口的使用说明校正；完整环境与初次自动化退出错误见 [说明](../../iterations/I06/client-background-operation.md)。

T-M01-13 最终通过，新窗口实际确认退出、旧 IPC 停止、再次打开加载 alpha.4 并保持原配置身份；未提交模型需求。


## 当前 alpha.5 恢复错误清理验证

T-M01-14 / M01-F01/F02：2026-10-12 / alpha.5，新增 2 项受控状态回归、全桌面 95/95，通过。旧版本报错在恢复成功后撤销并持久化，旧目录成功快照不继承错误，新的 RPC/主机密钥错误仍显示；原连接/接入节点/任务历史保持。Windows 当前前端的受控快照卡片渲染 2 项通过。原用户状态只读核验，不是新包实际远端重连或模型验收。[本次测试与范围](../../iterations/I06/ssh-error-recovery.md)、[TAP](../../../artifacts/ssh-error-clear/2026-10-12/desktop-tests.tap)、[UI](../../../artifacts/ssh-error-clear/2026-10-12/ui.json)。

## I06B alpha.6 历史验证入口

2026-10-12 / 0.6.0-alpha.6：T-M01-15 / M01-F04/F05/F09：实际 Windows Edge 鼠标/键盘端点、草稿轮询、删线、布局重开、冲突/丢 ACK 与目标选择；原始结果分别标注中央真实存储+受控机器，不能冒充 SSH 或模型。本次代码、命令、逐项结果与限制汇总于 [I06B 实施](../../iterations/I06/graph-implementation.md)。受控工程结果见 [桌面 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)、[核心 TAP](../../../artifacts/I06B/2026-10-12/root-tests.tap)，界面见 [UI](../../../artifacts/I06B/2026-10-12/ui.json)、[性能](../../../artifacts/I06B/2026-10-12/performance.json)，本次核心 43/43、桌面 110/110、Windows 图 10 组通过；性能 p95 30.0ms。独立 SSH 双向原生链、普通无 debug EXE 及源/包完整性分别通过，原始证据与范围见当次报告。历史表保留原日期/版本，不计为本次重新运行。


## 当前节点管理专项

T-M01-18 / M01-F01/F02/F04/F05/F09：2026-10-13 / 0.6.0-alpha.9。范围：单一菜单、每组添加、接入/断开/移除确认、恢复原身份、原操作重开及旧后台能力提示。逐项实际结果、环境、脚本、原始证据与未测范围见 [节点管理完整验收](../../iterations/I06/node-management.md)。工程证据为本次 [桌面 TAP](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)；窗口/程序/包状态以该报告实际结果为准，历史表不充当本次重测。原生 SSH/模型链保留 alpha.6 历史结果，本次未重跑、不改用户 profile、不提交 Prompt。

## I06C alpha.10 当前专项

T-M01-19 / M01-F01/F03/F04/F06/F09：2026-10-13。范围：机器组操作提供编辑 SSH、确认断开/移除和重新连接；设置页保留已移除机器与显式恢复。机器图/目标隐藏 removed 机器，但历史引用全量机器/节点名称；历史快照标识清楚且禁止继续/控制。已接入用户不能在编辑中换执行域；关闭已有机器详情无写入。原机器意图存本机，未知只查原 ID 并锁元数据，旧后台能力缺失禁用编辑/移除。 本次实际工程、隔离 TCP SSH、Windows 界面/包与未测项见 [6C 首批验收](../../iterations/I06/machine-management.md)；[桌面 TAP](../../../artifacts/I06C/2026-10-13/desktop-tests.tap)和当次报告是当前证据，alpha.6 双向真实 Agent 链保留原日期/版本。未改用户 profile、未升级用户 daemon、无真实模型任务，不将首批标为完整 I06C。

## 当前验证

T-M01-20 / M01-F07/F09：2026-10-14，WSL Ubuntu / Node 22.23.1，桌面受控回归 **150/150** 通过（全工程总数，模块之间不重复相加）。场景：机器组的“后台维护”打开独立确认框，显示实际运行、目标与可回退版本，支持升级、回滚、停止及卸载。原维护未确认时仅查询原操作，机器/节点/授权元数据暂停；布局独立，其他机器仍可发需求。同一来源任务不能绕过维护屏障；连接详情仍可安全补录凭据。旧中央没有 daemonManagement 时不提供维护写入。表单秘密字段使用遮罩，表单答案不进入中央恢复台账。

证据：[完整桌面 TAP](../../../artifacts/I06C-final/2026-10-14/desktop-alpha13.tap)、[维护实际 daemon/process 7 项](../../../artifacts/I06C-final/2026-10-13/maintenance-tests.tap)、[包内容核验](../../../artifacts/I06C-final/2026-10-14/package-alpha13.json)。维护测试使用真实生产 daemon、Unix socket、独立进程和磁盘，原生 host 受控、无模型调用；不能替代独立服务器或真实原生控制。Windows 窗口、原生 Session 与双向链、使用/卸载、命令和限制统一见 [逐项验收](../../iterations/I06/final-delivery.md)，未实际执行项不得计为通过。

## 上传修复验证

T-M01-21 / M01-F03：2026-10-14 / alpha.14。桌面受控 155/155，上传专项 5/5（含真实本机 TCP SSH/SFTP，使用隔离服务器和数据），Windows Edge 受控响应界面 2 组通过；原生提交 0，未连接用户 Linux。打开/写入/关闭失败、权限/空间/通道关闭/超时、分片/乱序 ACK、原 ID 重新检测和批准、unknown 不提供重装分别有证据。当前包、普通 EXE、原始材料与限制见 [完整增量验收](../../iterations/I06/ssh-upload-recovery.md)。155 包含 5，不重复相加。

## 本次独立实机补充

2026-10-14：冻结 alpha.13 Windows 包与独立 Linux，真实升级、同原生 Session 两轮及两方向协作通过；真实 Windows 取消和普通无调试窗口原生标记分别通过。独立 SSH/生产 daemon 的精确响应丢失、10 同 ID 与重启为受控执行器证据，不充当真实模型。Linux 文件任务受原生 OOM 退出影响，原 ID/Session 与 unknown 占位保留，未准出、未重发；后续 alpha.14 上传专项不冒充此模型矩阵复测。逐场景原始证据、版本、实际失败、临时自有资源调度及剩余项见 [I06C 当前实机记录](../../iterations/I06/final-delivery.md)。


## 未确认操作资源范围专项（源码修复，未发布）

T-M01-22 / M01-F07：2026-10-15 / WSL Ubuntu Node22.23.1 / alpha.19工作区修复。Windows Edge 的 4 组受控界面用例证明同机器独立续聊/新建可用、原节点仍禁用、旧后台回退及配置原因可见。 定向40/40计入全桌面188/188，类型与前端构建通过；Windows Edge生产前端/受控API共4组通过，模型0。原始证据和复现见[当次专项](../../iterations/I06/pending-isolation.md)。未构建新EXE、未访问用户故障profile或独立服务器，不替代真实原生任务验收。

alpha.20候选追加验证（2026-10-15）：Windows普通无调试EXE/隔离合成配置拒绝恢复及关闭重开4组通过；最终生产前端/Windows Edge受控4组通过，模型0。包内源码匹配，原始证据统一见[专项](../../iterations/I06/pending-isolation.md)。这不改变上一段源码阶段“未构建EXE”的历史边界。

alpha.20已公开预发布：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/AgentBridge-0.6.0-alpha.20-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.20)。分发元数据和完整EXE下载摘要核验通过，源码标签9b2d5ea；不将分发成功扩大为用户故障或真实模型验收。[发布及证据](../../iterations/I06/pending-isolation.md)。

## 小队原生等待观察

T-M01-120：基于alpha.23的未发布源码增量，WSL Linux / Node22.23.1。受控原执行与真实SQLite重启，模型0。小队自动化/公共空间/任务专项30/30（共享总数）通过，覆盖等待投影、脱敏、通知跨重启去重、unknown保留和终态清除，通知未增加执行；前端类型与构建通过。首次失败、完整TAP、复现和证据限制见[专项](../../iterations/I07/native-waiting.md)。未运行真实原生权限批准、Windows浏览器/EXE或独立SSH，未更新发布附件。

2026-10-18最终补验：UI冻结源码全桌面381/381，原图真实鼠标/键盘10组、UI状态10组（无跳过、业务/模型0）通过；后两者与页面5组分别记录，不计为桌面单测数量。[最终桌面](../../../artifacts/ui-redesign/2026-10-18/desktop-tests-final.tap)、[状态](../../../artifacts/ui-redesign/2026-10-18/state/2026-10-18T00-48-05-809Z/ui.json)、[图](../../../artifacts/ui-redesign/2026-10-18/graph/ui.json)。原生EXE仍以[交付](../../iterations/I07/ui-redesign.md)实际字节为准。

本轮候选冻结于2026-10-18 08:50前后。11:18以后共享工作区另有原生适配器/图标增量，不在这份候选或381项结果中；不能把当前目录后续变化当作已验证包。[最终普通EXE及源码边界](../../iterations/I07/ui-redesign.md)。
