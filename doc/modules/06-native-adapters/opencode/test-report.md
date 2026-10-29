# OpenCode 适配器测试报告

当前公开alpha.69已收录当前维护源码，冻结04ee6fe。包内源码/前端/Linux资源与实际EXE载荷匹配；普通EXE合成profile恢复和完整重启通过，真实原生与用户profile仍按各自证据边界。[本轮发布与分层验收](../../../iterations/I08/alpha69-release.md)。

T-M06-OC-215 / M06-OC-F01：2026-10-29，Windows Node24.12.0，Core生产controller加受控HTTP服务，新版本检查前0/2、后2/2。CJS/MJS只读入口与删除后不替代检查通过，模型0；Core定向32通过/7平台跳过，最终全量、Linux快照和运行限制见[专项](../../../iterations/I08/core-windows-installation-checks.md)。不是实际OpenCode安装、模型或普通EXE验收。

T-M06-OC-214 / M06-OC-F01：2026-10-29，未发布源码；V1/V2两代布局在中文profile下添加/移除的并发修改和替换失败八项计入共享专项44/44，原JSONC及无关文件保持。相关Windows117通过/1平台跳过，Electron44/44；不是实际OpenCode服务、模型或普通EXE验收。[原始失败、分平台证据及限制](../../../iterations/I08/mcp-config-temporary-cleanup.md)。

T-M06-OC-213 / M06-OC-F01：2026-10-29，Windows Node24.12.0，未发布源码。共享MCP38/38含OpenCode已选CJS列表入口、准确参数/继承环境；daemon生命周期仅Linux执行，Windows显式跳过。首次WSL42项的两失败/一取消及隔离首轮149/151保留，调整源码测试等待后最终隔离151/151、跳过0；没有真实OpenCode模型、用户profile或新EXE验收。[完整结果](../../../iterations/I08/windows-regression-and-native-probes.md)。

## 原接入失败清理与协议复验

T-M06-OC-CLEANUP / M06-OC-F01：2026-10-24，alpha.61本地候选；WSL Node22.23.1核心71/71、桌面921/921通过，共享不相加。包含1.x挂起info、2.x、明确协议/认证错误及启动/原Session/取消回归；清理只结算有完整原启动错误证明的本地attach，不修改执行unknown。Windows生产页面4组通过，模型0；真实1.2.22/原生模型/用户profile/独立SSH未测。普通EXE与最终包另列，见[完整证据](../../../iterations/I08/failed-operation-cleanup.md)。

## issue #21 有界协议协商验证

2026-10-23，alpha.53 已公开；M06-OC-F01。共享桌面844/844、核心71/71通过；最终启动专项9/9、Windows生产前端2组与普通无调试EXE6组通过；包54后台/84Core/1702Linux及各类源码一致性通过，模型0。修复前挂起/启动失败对照、最终启动专项、包与普通EXE结果分层登记，不以合成1.2.22替代现场原生。[完整证据、命令、首次失败与未测边界](../../../iterations/I08/opencode-bounded-probe.md)。 已公开EXE与SHA256SUMS，全部字节匿名下载核验一致；[发布证据](../../../iterations/I08/alpha53-release.md)。

2026-10-21 / M06-OC-F01 / alpha.40 源码：WSL Node22.23.1 定向97/97、全桌面705/705，计数共享不相加。真实阿里云 alpha.37/OpenCode2.0.26 只读确认原进程 OOM；用户批准临时Swap后原服务健康、原Task/Conversation各1→1、设置与Agent归属保留，原接入拒绝收敛，随后一次管理核验confirmed，Prompt新增0。此次为带外恢复，非新EXE/GUI/模型推理验收。[原始证据、失败与限制](../../../iterations/I08/opencode-oom-recovery.md)。

## alpha.36当前包验证

M06-OC-F01：公开alpha.36包含完整call/close工厂与公开alpha.35管理恢复；2026-10-21包内WSL stdio/daemon两入口2/2，普通EXE7组含原宿主拒绝恢复与真实MCP stdio通过。原Session/请求不迁移，用户实际模型/故障profile未验。[完整交付与文件](../../../iterations/I07/alpha36-delivery.md)。

## 普通子任务上下文输入

T-M06-OC-155 / M06-OC-F01：2026-10-21，WSL Node22.23.1，未发布源码。统一生产AgentNetwork加受控宿主覆盖该目标入口的说明+原文与无scope/MCP/TeamScope传参；本轮667/667完整桌面/121项定向、Windows36项、Core构建为共用工程证据，不跨模块相加。没有以当前实际opencode CLI/模型、Windows EXE或独立SSH消费新上下文，模型0。[实际范围与来源](../../../iterations/I07/delegation-context.md)。

## OpenCode 包内宿主复核

2026-10-21 / WSL Node22.23.1：现有本地alpha.35.config.2冻结包生产stdio/daemon入口2/2通过，完整EXE摘要及包一致性重核通过。公开alpha.35冻结b5de577仍为缺close旧工厂；本轮未重下公开EXE、重跑普通Windows EXE或验证用户profile/真实模型。[本轮证据与切换步骤](../../../iterations/I07/opencode-host-lifecycle.md)。

## DSH服务健康时的发现隔离

M06-OC-F01；2026-10-21，WSL Node22.23.1。核心验证发现通用扫描的DSH健康条目污染OpenCode专用发现；新增隔离HOME/受控HTTP回归，修复前失败，修复后及最终全工程结果见[本轮记录](../../../iterations/I07/agent-row-configuration.md)。未更改原安装选择、版本要求或Task/Session，真实模型/独立SSH未验。

## 原接入拒绝与管理入口恢复

M06-OC-F01；2026-10-20，alpha.34派生源码。原管理工厂拒绝、反例和生产前端只读核对的实际结果见[恢复专项](../../../iterations/I07/agent-management-recovery.md)。现场只读确认ADAPTER_HOST为原attach失败；未修改用户profile、未重派原请求，真实OpenCode模型/独立SSH未验。

## 后台宿主生命周期回归

M06-OC-F01：2026-10-20，WSL Node22.23.1，alpha.34 后源码。stdio/daemon 两入口旧工厂均重现 ADAPTER_HOST，修复后相关桌面 28/28、核心会话 2/2 通过；受控 HTTP 无真实模型。源码构建、类型和定向 lint 通过；未打包/发布新 EXE、未部署独立 SSH。[命令、首次失败与原始证据](../../../iterations/I07/opencode-host-lifecycle.md)。

## OpenCode 1.x / 2.x 兼容修复

T-M06-OC-150–154：V1 新任务/续聊、原绑定恢复、取消收据与终态、权限/问题及双格式 MCP 受控验证；官方 1.19.3 CLI 加本机受控模型传输完成生命周期与生产 broker 连接。最终原始日志和首次失败在专项，不把它写成真实账号/Windows/独立 SSH 验收。 [需求、实现、验证与未测边界](../../../iterations/I07/opencode-v1-compatibility.md)。

2026-10-19整合核对：核心51/51包含新旧配置版本/只读API/恢复受控检查，共用桌面570/570；Windows前端与普通EXE均无模型。本轮未重跑真实OpenCode或独立SSH，原真实2.0.24结果保留原日期。[具体日志/源码边界](../../../iterations/I07/integrated-source.md)。

## issues #8/#9受控验证

M06-OC-F01：核心51/51、桌面543/543（含版本/管理/原路由回归）、最后定向7/7及工程检查通过；Windows95项原路由/9项管理CJS、前端专项4组/既有10组及普通EXE5组通过；分发另按专项逐项记录。无真实模型/用户profile/独立服务器升级，不跨模块累加共享计数。 [需求、实现、验证与边界](../../../iterations/I07/version-management-recovery.md)。

## issue #7 协作兼容修复

M06-OC-F01：本轮仅受控HTTP/CLI、生产后台无推理、TCP SSH及Windows交付验收；用户现场/独立SSH/真实模型未测。实际执行结果、首次失败与最终工程/包证据统一引用专项，共享计数不跨模块叠加。 [完整需求、验证与交付](../../../iterations/I07/collaboration-compatibility.md)。

## 独立 MCP 接入

仅支持V2的mcp.servers.agentbridge、local command数组/environment/codemode=false；尊重OPENCODE_CONFIG_DIR/XDG目录，保留既有JSONC。独立导出agentbridge.opencode.jsonc。真实2.0.24添加、stdio连接、删除通过；原生常驻服务异步加载/删除，列表可能延后，必要时重启其后台。V1布局或双配置同名冲突拒绝。测试使用WSL隔离配置、无模型调用；Windows生产界面为受控机器，非该工具真实Windows/EXE/独立SSH验证。[完整流程、源码和证据](../../../iterations/I07/mcp-installation.md)。

## CT-02真实MCP调用方与被调用方

T-M06-OC-146 / M06-OC-F01：当前WSL原生2.0.24，本工具真实作主发现/委派另外两种工具并读取成功结果，另在两条链中作为普通子任务被实际启动。各回答/原生Session/父子归属与精确消息通过，完整重开不重放；三工具共享9Task/6方向/16次MCP调用，不跨模块重复累加。保护7/7计入全桌面517/517，均为无模型回归，与真实Task分别计数。产品运行代码未改；Windows、新三工具、独立SSH/权限/表单/执行中断点未补验。[实际脚本、原始报告及边界](../../../iterations/I07/connection-delegation.md)。

## CT-02真实直接生命周期

T-M06-OC-145 / M06-OC-F01：当前WSL、Node22.23.1、真实原生2.0.24。首轮与原Session回忆均succeeded，取消收据与原Task cancelled分别核验，完整观察重开保留同Session/回答；3个原任务，重复只读观察前后3→3。沿用原生配置，未批准权限或重发原请求。新增验收保护7/7及最终桌面510/510为共享受控计数，不是该工具模型测试数。源码无产品行为变化；本轮未验真实委派/MCP调用方、新EXE或独立SSH。[原始结果、脚本、首次环境/契约失败及边界](../../../iterations/I07/connection-native.md)。

2026-10-18 / T-M06-OC-140：桌面空闲修复源码，WSL Node22.23.1 / Windows Node24.19.0及Edge155。核心45/45、桌面424/424、定向20/20、Windows受控界面3组通过，模型0；属于共享工程计数，不跨模块相加。普通EXE与黑窗观察、冻结包、首次环境失败及用户现场未测边界按[本次完整报告](../../../iterations/I07/desktop-polling.md)记录，历史包不冒充本次修复。

## OpenCode 二次发现与 Windows 配置专项

WSL Ubuntu / Node 22.23.1：discovery 3/3（含于核心 45/45），桌面 181/181；受控回归、模型 0。[核心 TAP](../../../../artifacts/opencode-discovery/2026-10-14/root-tests.tap)、[桌面 TAP](../../../../artifacts/opencode-discovery/2026-10-14/desktop-tests.tap)。Windows 原始报告 UTC 2026-10-14T17:35:28.789Z / Electron Node 24.21.0：真实 PE 版本/解析、旧二次发现失败、修复后原路径核验、配置完整写入与旧revision拒绝、serve受控退出保留NATIVE_EXITED、删除原安装，共6组通过，[实际报告](../../../../artifacts/opencode-discovery/2026-10-14/windows.json)。这是隔离PE/进程夹具，无真实OpenCode模型或用户另一台电脑验收。原生Windows完整生命周期和断电持久性未验证。根因、失败原证据、最终包与边界见 [专项](../../../iterations/I06/opencode-discovery.md)。

## 当前专项

2026-10-14 / WSL Ubuntu / Node 22.23.1 / 源码 0.6.0-alpha.18：共享缓存自引用/旧清单/损坏旁路重建、Windows OpenCode 原意图恢复与并发保护、查询结果和脱敏原因；定向 55/55（计入桌面全量 176/176），根 43/43，lint/类型/构建通过。受控文件/宿主测试，无模型调用。原始证据：[定向](../../../../artifacts/runtime-recovery/2026-10-14/targeted.tap)、[全桌面](../../../../artifacts/runtime-recovery/2026-10-14/desktop-tests.tap)。Windows 真实 Electron 资源 4 组、Edge 受控 UI 3 组、普通无调试 EXE/合成原意图与关闭重开 4 组均通过；包校验 28 CJS / 1383 Linux 文件与当前源码匹配。详细过程及边界按 [完整专项](../../../iterations/I06/runtime-recovery.md) 的实际结果判定，不将历史原生证据提升为本次重测。

更新日期：2026-10-12。功能 **M06-OC-F01**；对应[设计](design.md)。当前源码 `0.6.0-alpha.1`，本文不把现有 Windows `0.5.0` 包当作 SSH 新功能发布证据。

## 1. 当前工程证据

以下用例全部在 [2026-10-12 核心 TAP](../../../../artifacts/docs-baseline/2026-10-12/root-tests.tap) 中通过。它们使用受控原生 HTTP 服务和 OS 进程，不能代替真实模型回复。表中名称是测试源中的实际名称，可在 TAP 检索。

| 测试 ID | 文件与实际测试名称 | 验证的行为 | 结果 / 证据类型 |
| --- | --- | --- | --- |
| T-M06-OC-01 | [opencode.test.ts](../../../../tests/opencode.test.ts)：`OpenCode v2 through Hub/Edge: ownership, waiting/reply, pagination, result, isolation, dedupe and restart` | 归属、等待/回复、分页、结果、隔离、请求去重与重启 | passed / 受控 HTTP 集成 |
| T-M06-OC-02 | 同文件：`native Driver distinguishes explicit rejection, model failure and ambiguous admission; bounds result` | 明确拒绝/Provider 失败/派发不明区分，结果长度限制 | passed / 故障夹具 |
| T-M06-OC-03 | [i03b.test.ts](../../../../tests/i03b.test.ts)：`B01: three turns use one Session, isolate answers, preserve owner/config and dedupe` | 三轮 Session 相等，Message/答案隔离，owner/配置/去重 | passed / 受控原生时间线 |
| T-M06-OC-04 | 同文件：`B02: cancel once across duplicate IDs, lost response and completion race` | 取消去重、丢回应、不同 ID 竞争、成功竞态 | passed / 故障计数 |
| T-M06-OC-05 | 同文件：`B04: Edge rebuild restores waiting and completed original executions using reads only`、`B04: missing input, foreign steering and configuration mismatch retain unknown occupancy` | 只读恢复原轮，缺证据/外部输入时保留 unknown | passed / 故障夹具 |
| T-M06-OC-06 | [native-cli-default.test.ts](../../../../tests/native-cli-default.test.ts)：`OpenCode node inherits CLI recent preference after native config, reads updates, and never writes or invents a model` | 原生配置优先、recent/variant、更新读取、不写偏好、不虚构模型 | passed / HTTP + 临时偏好文件 |
| T-M06-OC-07 | [native-identity.test.ts](../../../../tests/native-identity.test.ts)：三个 `B05:` 用例 | 正确归属重用；错误 PID/出生身份/危险文件拒绝；陌生服务/凭据不动；父进程强杀后服务不因管道退出 | passed / OS 进程 + 受控服务 |
| T-M06-OC-08 | [i03b.test.ts](../../../../tests/i03b.test.ts)：两个 `B03:` 用例 | Hub 重启后持久事件补传、ACK 丢失，同序号不重复执行 | passed / Hub/Edge 故障集成 |

T-M06-OC-05/07/08 汇总多个实际用例，不能按表行计算自动测试数量。整个核心套件是 43/43，本表仅映射该适配器的相关用例。

## 2. 历史真实验收

| 日期 / 原生版本 | 功能 | 结果 | 原始证据 |
| --- | --- | --- | --- |
| 2026-10-08 / 2.0.24 | 三轮同 Session、上下文记忆、取消后续聊和服务重启历史 | passed | [I03B-native-contract.json](../../../../artifacts/I03B-native-contract.json) |
| 2026-10-08 / 2.0.24 | CLI 三轮、运行/等待取消、Controller 强杀后复用服务、只读对账、显示延迟样本 | passed | [I03B-acceptance.json](../../../../artifacts/I03B-acceptance.json)、[验收说明](../../../iterations/I03B/report.md) |
| 2026-10-08 / 2.0.24 | edit/bash/npm test、允许/拒绝、文本表单、退出重返 | 已验证指定链路 | [真实回归](../../../../artifacts/I03A-I03B-regression-acceptance.json)；报告保留拒绝后模型完成未确认的边界 |
| 2026-10-10 / 2.0.24 | 原生 CLI 默认真实 DeepSeek 回复、续聊、与 Windows Claude 双向 MCP 协作 | 核心链 passed；汇总 partial | [I05-real.json](../../../../artifacts/I05-real.json)、[I05 验收](../../../iterations/I05/acceptance.md) |
| 2026-10-10 / 远端 2.0.26 | 独立 Linux 发现、真实新会话、按原 conversationId 第二轮、断线期间完成及重连读取 | 已有开发环境成功记录 | [e2e-report.json](../../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.json)、[I06 核对](../../../iterations/I06/progress.md) |

远端原始 JSON 的两轮仅保存终态和 summary，未保存逐轮 native Session ID；会话台账与调用路径证明按原 Bridge conversationId 续聊，尚不能用该产物独立断言两个 native Session ID 相等。本报告不延续旧说明中超出证据的表述。

## 3. 限制、待补与复现

- 当前源码普通调用接受 1.x/2.x 各自协议；限工具连接验证只核验过 2.0.24。远端 2.0.26 能回复不等于它的禁工具验证已兼容。
- 原生模型/API 配置可能变化；2026-10-10 的成功不保证未来账号授权、模型或网络可用。本次文档整理未重连服务器、未调用模型。
- 表单接口与文本填答已测试；模型自主生成复杂表单未完整验收。取消不撤销已有工具效果。
- 仍须补当前 Windows 发布包的远端会话链路和 native Session ID 比较；无系统 Node 的真实部署由机器/安装模块验收。

自动测试：`node --import tsx --test tests/opencode.test.ts tests/i03b.test.ts tests/native-cli-default.test.ts tests/native-identity.test.ts`。完整核心检查：`npm test`。真实测试要使用独立实例和目录，保留原生版本、绑定与计数证据，并同步本页及对应迭代报告。

## 当前 6A 候选验收结果

2026-10-12 / 0.6.0-alpha.2：独立 Linux OpenCode 在真实 Windows 窗口中两轮成功，native Session ID 完全一致；停止/重开与普通 EXE 无新 Prompt 回读通过。[窗口](../../../../artifacts/I06A-real/report.json)、[普通 EXE](../../../../artifacts/I06A-final/portable.json)、[候选验收](../../../iterations/I06/acceptance.md)。

## I06C alpha.13 独立实机补充

2026-10-14：原生 OpenCode 2.0.26 / Windows Claude，继承已有账号与配置。独立 SSH 双向 MCP 主子及 OpenCode 同 Session 两轮通过；Windows Claude 取消以 nativeExited 和 Task cancelled 验证。OpenCode 文件任务遇到内核 OOM，未知保持原 Task/Session 占位；未确认终态不算成功，不换请求/目录重做。详细版本、实际结果及证据见 [I06C 实机](../../../iterations/I06/final-delivery.md)。
