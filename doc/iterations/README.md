# 迭代资料目录

## 2026-10-23：OpenDesk 生命周期与关系作用域

[issue #19/#20](I08/opendesk-lifecycle-relation-scope.md)：运行中/状态未知/退出写回拒绝原生写入，退出后断开原节点可配置，原生列表核验明确unsupported；独立设主与旧新关系资源并集准入、原 unknown 保留。alpha.52 候选，公开仍alpha.51.recovery.2。

## 2026-10-23：alpha.51.recovery.2公开预发布

[发布、对应源码与完整下载验证](I08/alpha51-recovery2-release.md)：冻结 `905b792`，EXE130196014字节；#15/#16与此前alpha.50/51集成增量，包一致性/817桌面/68核心/Windows5组及全部公开字节SHA核验通过；未签名、未部署SSH，完整指标准出边界保留。

## 2026-10-23：连接身份与节点管理作用域

[issue #15/#16](I08/connection-identity-node-scope.md)：保存 DSH 连接的精确持久选择、加载前反馈与扫描绑定；前后端统一节点资源冲突、原 unknown 保留和旧后台能力门禁。隔离基线 777/777、Windows 生产前端受控 10 组通过；当前集成候选与未测边界在专项单列，尚未公开。

[alpha.51关闭竞态与画布稳定性](I08/wsl-close-and-graph-stability.md)：迟到WSL枚举不spawn/不派发，原调用绑定原通道；自动布局保存状态不再引起60.4px画布跳动。桌面798/798、核心68/68通过，包核验通过、Windows验收进行中，模型0。

[alpha.50当前包指标与WSL稳定性补验](I06/current-candidate-metrics.md)：20次本地落盘→界面同步p95 1513ms通过；60节点图20次拖动反馈观测上界p95 117.9ms未准出；WSL启动9/20通过/11次就绪前退出，失败写入0。原始WSL/PowerShell同类失败、根因未定位；产品/EXE未变、模型0，全部原始失败保留。
[Hermes/Pi原生MCP与alpha.50本地交付](I08/hermes-mcp-config.md)：补齐两种原生配置与目标绑定/禁用保护；桌面794/794、核心68/68，Pi原生Linux/Windows各5组、Hermes原生组件5组、Windows前端5组/普通EXE4组和最终包/下载副本核验通过，模型0。公开仍alpha.46；原生自主父模型/独立SSH/完整矩阵未准出。Pi首轮与审批限制保留在[原专项](I08/pi-mcp-config.md)。

[WSL宿主就绪握手与alpha.49候选](I08/wsl-host-readiness.md)：桌面770/770、核心68/68、包及bootstrap一致性、普通Windows EXE4组通过，模型0；就绪前明确未派发，就绪后未知不重发。真实WSL MCP组件5组通过，仍有就绪前启动失败，稳定性及原生父模型待验；公开仍alpha.46。

[全迭代开发与验收推进台账](I08/completion-audit.md)：保持完整目标、各范围准出依据与未完成项；已完成[DSH Desktop原生MCP本地交付](I08/dsh-desktop-mcp.md)：alpha.48、桌面766/766、核心68/68及Windows组件5组/前端4组/普通EXE4组，模型0；不以单个候选替代整体完成。

[OpenDesk MCP 默认字段兼容与 alpha.47 本地候选](I08/opendesk-mcp-defaults.md)：修复原生自动补空 `headers` 导致状态、重复添加和清理误报冲突，其他修改仍拒绝；桌面760/760、根68/68及包源码一致性通过；Windows分层验收见专项。公开仍alpha.46，未部署远端。

[alpha.46 源码与 Windows EXE 发布](I08/alpha46-release.md)：源码9766eb4与标签已推送，EXE/校验附件已公开，匿名完整下载130180760字节与SHA-256一致；本轮核心68/68、桌面758/758通过，未签名、未部署远端，完整准出边界见专项。

[OpenDesk 日常 MCP 诊断条目恢复](I08/opendesk-mcp-diagnostic-repair.md)：2026-10-22 日常后台已为 alpha.46；用户确认后备份并替换指向本机端口 1 的旧诊断条目。首次改盘被退出写回覆盖；改为进程 0 时离线替换并启动，日常原生父模型实际 list_agents 调用 1 次成功、返回 7 个获准节点，Prompt 1、子任务 0；自主委派与原生页面未验，无产品代码或 EXE 变化。

[I08-MCP02原生组件与真实子任务验收](I08/mcp-native-acceptance.md)：已安装OpenDesk0.3.9和DSH原生MCP组件的正式授权、撤权与重开；两条生产协作链各完成1个真实Claude子任务，原生父模型自主委派和原生页面仍未验。

[I08-MCP02 alpha.46恢复与观测修复](I08/mcp-open-recovery.md)：统一OpenDesk导出启动器、修复OpenCode数组探测、观测配置绑定/60秒有效期、Linux端点恢复与非GUI首次接入；真实委派仍未准出。

## 2026-10-22：alpha.45 本地候选（OpenDesk 原生 MCP 可见性修复）

[I08-MCP02 §14](I08/mcp-open-integration.md#14-opendesk-原生-mcp-可见性修复2026-10-22alpha45)：在**用户真实 OpenDesk Desktop 0.3.9** 上定位到两个根因并修复——(1) Bridge 的 stdio MCP 服务未响应 2026-07-28 协议的 `server/discover`，严格客户端在 `tools/list` 阶段判定失败；现返回 `supportedVersions`+`capabilities`。(2) OpenDesk 的 mcpmgr 无法启动 Bridge 的 Electron 运行时（`命令未找到`／`Connection closed`）；现为 OpenDesk 条目**优先使用真实 Node 启动器**，状态新增 `launcher` 并在回退 Electron 时明确提示，桌面文案改为必须完全退出并重开。真实原生（模型0）：重启后原生日志 `[mcpmgr] Connected to "AgentBridge", discovered 7 tools`，MCP 管理→已安装 MCP 可见 AgentBridge/STDIO/已连接/7 工具。**该条目是可见性诊断条目（token 非真实授权）**，真实授权调用需用 alpha.45 在 Bridge 点“添加 Bridge MCP”后再验。候选 EXE 130177443 字节、SHA-256 `35674f6c…`，`verify-package --portable` passed（50/84/1698、四类一致性 true、digest `195081305a…`），未签名、未公开、未在真实 Windows 启动（T16 待执行）。回归：桌面 753/753（新增 3 例），根测试直接运行 66/66（`npm test` 外壳曾超时）。

## 2026-10-22：alpha.44 本地候选（I08-MCP02 打包）

[I08-MCP02打包与候选交付](I08/mcp-open-integration.md#13-打包与候选交付记录2026-10-22)：`desktop` 版本位由 alpha.43 → **alpha.44**（源码/依赖未变），在 **WSL/Linux** 上完成冻结与交叉构建（node v22.23.1、electron-builder 26.15.3、Electron 44.7.0，构建缓存置于工作区并 gitignore）。Windows x64 便携EXE **130186782 字节**、SHA-256 `b78a2bcf7d45d67f95044186747e557881d461911077a01bda47addb549d6c63`，`verify-package --portable` 通过（后台50模块、核心84文件、Linux离线包1698文件、ASAR/前端/后台源码一致性均 true，linuxManifestDigest `8e47ae3b…`）；按 `win.signExecutable:false` 跳过签名。版本变更后桌面全量仍 750/750。**未签名、未公开、未部署**，且**未在真实 Windows 启动该 EXE**（会与日常 alpha.43 后台共用 `%APPDATA%/AgentBridge`），故 MCP02-T16 仍待执行，日常后台仍为 alpha.42/alpha.43。

## 2026-10-22：开放MCP接入与双向配置（源码实现第一片）

[I08-MCP02开发与验收记录](I08/mcp-open-integration.md)：一个AgentBridge MCP，Bridge与原生Agent均可添加/移除；能力拆为原生配置管理/MCP调用/托管任务注入三维，状态拆为配置/原生加载/连接/工具/授权/归属六项事实；新增`mcp.revoke`（只撤权）与`mcp.probe`（只读），`mcp.remove`在清理失败时返回`revoked_config_pending`；新增DSH Web原生`insert:`行适配（保留用户注释、空层拒绝）；Linux本机在协调器进程内路由`mcp.*`。受控测试（当日首次运行，其后加入新用例的最终数字见本条目末）：mcp-integration 18/18、connection-capabilities 11/11、mcp-local-machine 2/2、路由73/73；真实原生（受控profile、零模型）：Claude写入后`claude mcp list`报Connected且七项工具目录可见、Codex `codex mcp list`列出条目、DSH `--dump-config`含Bridge写入行。未运行模型、未写用户真实原生配置、未公开（当时未构建EXE；同日稍后已打包本地候选 alpha.44，见上条）。逐入口真实原生增删/工具调用/主调用链/托管归属（MCP02-T01..T18）仍待执行；WSL本机路由、DSH Desktop原生配置路径为明确缺口。当日晚补充两组真实原生探测（[§12](I08/mcp-open-integration.md#12-真实原生探测补充2026-10-22-晚)，不改§11数字）：DSH Web 在隔离 profile 上真实启动后完成原生握手并取到7个工具（模型0）；**OpenDesk 0.3.8 为负面证据**——`opendesk tools list` 无 MCP 分区、原生启动会把 `setting.json` 的 `applications` 重写为空并丢弃未识别 app 段，因此 Bridge 写入的条目没有原生读取证据，其原生加载/连接/工具一律 unknown，`mcp.install` 只能视为“已写入候选配置”，登记为本轮第一优先级缺口。同日晚补 **DSH CLI 显式 `profile` 原生配置**：六个MCP方法接受可选 `profile`（仅dsh使用，名称按单段目录校验、不拼接逃逸路径），写入 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`；未指定时status报`MCP_DSH_PROFILE_REQUIRED`、install/remove拒绝、export只出片段；`dsh` 的 `nativeMCPConfig` 改为true，桌面新增“DSH 原生 profile”输入框，CLI新增`--profile NAME`。定稿桌面全量750/750、根66/66、mcp-integration 22/22。随后又在 shipped `acp` profile 上用真实 `dsh --profile acp` 启动观测到原生加载、`initialize` 握手与 `tools/list`（7工具，模型0），与DSH Web一致；仍未观测TUI/用户自建profile、真实用户profile与原生UI人工增删，也未做真实ACP客户端会话或模型委派。**OpenDesk 结论升级**：`opendesk plugins list` 11个builtin插件无MCP管理插件、`plugins tools` 无插件工具，结合§12.2的启动重写丢弃，判定 **OpenDesk CLI 0.3.8 不存在可供Bridge写入并被原生读取的MCP管理面**；代码收敛为 CLI `nativeMcpConfig=false`、`mcp.install` 以 `MCP_NATIVE_CONFIG_UNSUPPORTED` 拒绝、只可导出片段（Desktop 的原生读取随后在 alpha.45 修复并验证，见上条）。

## 2026-10-22：OpenDesk前端执行门禁修复

[alpha.43本地候选](I08/opendesk-ui-admission.md)：补齐CLI/Desktop前端能力识别，注册表遍历回归、桌面722/722、生产界面10组与包核验通过；本轮不发送模型需求。

## 2026-10-22：OpenDesk Windows桌面原实例调试

[alpha.42普通EXE与原生Desktop 0.3.9](I08/opendesk-desktop-live.md)：原实例只读3组、真实Host/worker5组、普通EXE完整链路5组通过；两条独立原生会话共4轮真实输入，宿主/窗口重开后上下文均保留。日常后台已等待原任务成功后由alpha.37正常切换到alpha.42，原Windows机器已发现健康桌面节点；原任务结果与授权保留，新增Prompt0。无运行代码或原生改动，未覆盖真实取消、MCP及SSH。

## 2026-10-21：OpenDesk仅适配已有接口

[CLI HTTP与桌面设备网关](I08/opendesk-existing-interfaces.md)：只修改Bridge；Bridge侧去重、派发围栏和原回应保存，桌面持有原连接，断线不可伪续聊；取消ACK与执行终态分开。alpha.42本地EXE已生成并通过包校验，核心57/57、桌面721/721、Windows协议13/13、普通EXE隔离5组、生产界面9组；原生CLI 0.3.8零Prompt探测5组，真实原生桌面与模型未验，普通EXE运行结果见专项。

## 2026-10-21：OpenDesk双入口接入（已撤回方案）

[OpenDesk CLI、Windows Desktop与独立MCP](I08/opendesk-integration.md)：共享原生持久收据与原实例绑定；Bridge静态注册、传输、发现、原请求恢复和配置增删；alpha.41本地EXE与原生CLI tgz已生成，核心57/57、桌面715/715、生产前端9组、Windows普通EXE隔离5组与包核验通过，模型/原生Desktop/SSH范围按专项登记。

## 2026-10-21：OpenCode OOM 后原上下文恢复

[需求、开发、现场恢复与验收](I08/opencode-oom-recovery.md)：原生服务 OOM 根因、用户批准的临时Swap与原服务恢复、attach拒绝持久收据、原ID核对和只读不启动保护；alpha.40 本地候选已构建并通过包校验，未公开。

## 2026-10-21：I08 维护被拒后的离线恢复

[维护被拒后的离线恢复与旧后台维护兼容](I08/maintenance-offline/maintenance-offline.md)：升级/回滚被拒但原后台仍在运行或已恢复（含早于持久收据端点的旧后台）时不再把机器留置为已断开；维护收据新增`stopped/phase`，停机未确认恢复保持`unknown`由原ID查询恢复；遗留维护屏障在下一次维护前自愈；拒绝原因经机器卡片与未确认操作可见。受控实测20/20、相关SSH专项38/38，独立验证见[verify-report.md](../../artifacts/maintenance-offline/verify/verify-report.md)；本机全量桌面当时679项676通过、3项失败（后经独立验证定位为测试未隔离`DSH_HOME`，同日修复，构建后684/684）；无真实用户远端与真实EXE/GUI验证，本轮未打包发布。恢复步骤见[用户恢复说明](I08/maintenance-offline/recovery.md)，旧版本能力事实见[旧后台能力清单](I08/maintenance-offline/old-daemon-capabilities.md)。

[维护未决行回收与维护进度可见](I08/maintenance-offline/maintenance-visibility.md)：未决维护行在记录的执行进程已消失或从未记录（超过60秒宽限期）时，原operationId查询会派生恢复并收敛为终态，不再永久卡住准入；“后台维护”对话框显示上传/解包/校验进度与未决/终态文案，未决期间按1s/2s/4s/8s有界自动核对原操作，机器卡片同步显示进度。维护/SSH专项39/39、新增真实chromium界面用例3/3通过（实测退避1004ms/3004ms）；全量桌面当时682项679通过、3项失败，后经独立验证定位为测试未隔离`DSH_HOME`并同日由测试侧修复（构建后684/684，详见alpha.37交付记录）；既有Windows Edge界面套件本机未执行（无msedge）。[未测边界](I08/maintenance-offline/maintenance-visibility.md)。

[alpha.37 本地候选交付（维护离线恢复 + 切片 A）](I08/alpha37-delivery.md)：把上述两批修复整合进 `0.6.0-alpha.37` 并构建本轮 Windows x64 便携 EXE，130034719 字节、SHA-256 `76e30b1e…`；新增从已公开 alpha.36 EXE 原样提取的兼容 pin（1458 文件逐项校验，manifestDigest `4f14b5f5…`），使运行 alpha.36 后台的机器可被识别。维护/SSH专项39/39、切片A真实chromium界面3/3、构建后全量桌面684/684、包校验 passed、check-docs errors 0、docs:test 6/6；未在Windows真机运行、未签名、无真实用户远端、windows-*.cjs Edge套件未跑、未公开GitHub，完整I06C/I07C准出不变，公开基线仍为 alpha.36。

[alpha.38 本地候选交付：显式确认后越过未确认收据（契约变更）](I08/alpha38-delivery.md)：把用户已批准的契约变更（`idle()` 固定门禁顺序——任务/Agent 门禁永远先执行且永不可越过，收据门禁仅在显式 `allowUnresolvedReceipts:true` 时跳过并记录 `overridden/unresolved`）、两个只读门禁 RPC（`machine.maintenanceBlockers`/`machine.queryBlockedOperation`）与维护对话框三区块整合进 `0.6.0-alpha.38`，EXE 130038728 字节、SHA-256 `296260f2…`，新增 alpha.36/alpha.37 兼容 pin（包内共 32 条）；真实阿里云现场从 alpha.2 带外切到 alpha.37（**非产品 UI 完成**）已如实记录。测试：契约/SSH 26/26、新界面 5 checks、既有进度界面 3 checks、全量桌面 689/689（0 失败）、check-docs errors 0、docs:test 6/6；未在 Windows 真机运行、未签名、无真实用户远端、windows-*.cjs Edge 套件未跑、未公开 GitHub，完整 I06C/I07C 准出不变，公开基线仍为 alpha.36。**后续修正见 alpha.39：独立验证发现该契约在协调层不可达。**

[alpha.39 本地候选交付：契约可达性修复、门禁结果中性显示、兼容 pin 调整](I08/alpha39-delivery.md)：修正 alpha.38 的阻断性反例——[coordinator-service.cjs](../../desktop/electron/coordinator-service.cjs) 的 `sshMethods` 加入两个只读门禁 RPC、`maintainDaemon` 的 config 白名单加入 `allowUnresolved`，使已批准的越过能力在打包产物中真正可达，并新增走真实协调层的回归 `maintenance-access.test.cjs`；维护对话框把门禁类结果（`DAEMON_BUSY`，判定发生在停机之前）按“上一次维护留下的结果”中性显示，只有真正停过机/校验失败的切换错误才保持红色告警；为容纳 alpha.38 pin（32 条硬上限）移除 alpha.3 pin（原件留档），仍在 alpha.3 的后台将以 `SSH_DAEMON_UPGRADE_REQUIRED` 明确拒绝而不是静默降级。EXE 130042811 字节、SHA-256 `bde7bc78…`；EXE 载荷与 win-unpacked 逐字节相同、1460 文件 `sha256sum -c` 全通过、32 条 pin 摘要重算全一致、真实协调层可达性 6 项断言通过、`tsc` 0 错、全量桌面 693/693（0 失败）、界面 6 checks + 3 checks；未在 Windows 真机运行、未签名、无真实远端端到端、windows-*.cjs 未跑、原计划的两名独立验证者均在产出前失败故本轮无第二方独立报告（证据全部由 Lead 亲跑，原始输出见 artifacts/alpha39/lead-verify/）。

## 2026-10-21：alpha.36全部修复整合（已公开发布）

[全部修复整合与公开发布](I07/alpha36-delivery.md)：公开alpha.35独立修复与当前全部增量整合，核心57/57、桌面676/676；标签`1fef25f`，EXE 130032973字节、SHA-256 `43e09dd3…`，EXE与校验附件已公开并通过匿名完整下载核验。

## 2026-10-21：CT-07子任务最小上下文

[持久版本、历史原请求与严格准备拒绝证明](I07/delegation-context.md)：冻结桌面667/667、定向121/121、Windows受控36/36及Core构建通过，模型0；真实生产链加受控三种CLI子进程观察到完整输入，历史原文、原ID/unknown和无新授权保持。首轮118/120及修复记录保留，未打新包；CT-07三项源码/受控已覆盖，整合包和真实工具消费仍待验。

## 2026-10-21：Agent 行配置入口

[配置移至所属机器与Agent](I07/agent-row-configuration.md)：开始会话右侧增加编辑图标/配置按钮，固定原节点打开MCP或DSH服务弹窗，全局设置移除接入卡片；修复健康DSH被误作OpenCode安装。桌面649/649、核心57/57、Windows前端8组/MCP文件4组/DSH前端3组与普通EXE6组通过；本地config.2文件与校验见专项（该增量已随alpha.36公开），不扩张原生模型/独立SSH准出。

## 2026-10-21：CT-07当前调用方连接视图

[原身份、当前角色和查询期间撤权](I07/agent-connections.md)：冻结桌面643/643、定向103/103、Windows受控18/18及Core构建通过，模型0；空参数、当前角色/授权原因、原父/独立连接隔离和原unknown保留。未打新包；CT-07子会话最小上下文仍待开发。

## 2026-10-20：扫描、原管理操作与DSH状态修复

[四项问题与严格恢复](I07/agent-management-recovery.md)：设置展示原管理台账；扫描与查看入口可用，实际写入/执行继续保护；原ADAPTER_HOST接入拒绝严格结算；DSH缺服务连接不再显示工具异常。桌面632/632、核心56/56、Windows前端6组/契约29项与普通EXE6组通过；本地recovery.1文件与校验见专项，当前公开alpha.35独立边界保留。

## 2026-10-20：CT-07只读委派列表首片

[原委派分页列表与原生工具允许项](I07/delegation-list.md)：定向110/110、冻结桌面615/615、Windows8/8通过，模型0；严格原父/连接隔离，台账不是实时状态，unknown不重发。公开元数据已alpha.35但该独立修复未整合至本工作区，本片未打包；首次冻结资源遗漏和未测边界如实保留。

迭代说明"这次改了什么"。模块如何工作看对应[模块设计](../module-plan.md)；历史报告只证明原日期、原版本和原环境。当前范围与优先级见 [迭代路线](../project-plan.md)，项目入口见 [资料入口](../README.md)。

历史发布与逐轮交付统一在本页索引维护；主文档只保留当前状态，不堆叠带日期条目。

## 迭代总览

| 迭代 | 需求与设计 | 结果 / 当前状态 |
| --- | --- | --- |
| I01 | [需求](I01/requirements.md)、[设计](I01/design.md)、[开发](I01/development.md) | [测试与验收](I01/testing.md) |
| I02 | [需求](I02/requirements.md)、[设计](I02/design.md)、[开发](I02/development.md) | [测试](I02/testing.md) |
| I03A | [需求](I03A/requirements.md)、[设计](I03A/design.md)、[开发](I03A/development.md) | [报告](I03A/report.md)、[体验修正](I03A/cli-fix.md) |
| I03B | [需求](I03B/requirements.md)、[设计](I03B/design.md)、[开发](I03B/development.md) | [报告](I03B/report.md) |
| I04 | [需求](I04/requirements.md)、[设计](I04/design.md)、[开发](I04/development.md) | [报告](I04/report.md) |
| I04B | [需求](I04B/requirements.md)、[设计](I04B/design.md) | [双环境交付](I04B/report.md) |
| I04C–G | 各版本稳定性修正 | [C](I04C/report.md)、[D](I04D/report.md)、[E](I04E/report.md)、[F](I04F/report.md)、[G](I04G/report.md) |
| I05 | [提案](I05/proposal.md)、[节点](I05/node-design.md)、[协作](I05/collaboration-design.md) | [0.5.0 验收](I05/acceptance.md) |
| I06 | [提案](I06/proposal.md)、[需求](I06/requirements.md)、[设计基线](I06/ssh-design.md)/[图设计](I06/graph-design.md)、[开发](I06/development.md)、[进度](I06/progress.md)、[验收计划](I06/testing.md) | 6A/6B 主要范围已验收；I06C 完整范围未准出，专项索引见下 |
| I07 | [目标](I07/goals.md)、[需求](I07/requirements.md)、[设计](I07/design.md)、[开发切片](I07/development.md) | [验收计划](I07/testing.md)；I07A/B 与 I07C 首批已实现，完整 I07C 未准出，专项索引见下 |
| I08 | [需求、根因与实现](I08/maintenance-offline/maintenance-offline.md)、[旧后台能力清单](I08/maintenance-offline/old-daemon-capabilities.md) | [用户恢复步骤](I08/maintenance-offline/recovery.md)、[切片 A 未决回收与进度可见](I08/maintenance-offline/maintenance-visibility.md)；受控验证通过，[alpha.37 本地候选](I08/alpha37-delivery.md)与[alpha.38 越过未确认收据契约](I08/alpha38-delivery.md)已打包，未公开发布 |

## I07 专项索引：外部智能体、小队与协作

### 规划与研究

| 专项 | 说明 |
| --- | --- |
| [Agent侧自主操作与通用调用方规划](I07/agent-centric-operations.md) | CT-06/CT-07/CT-08规划、插件薄传输决策与实施顺序（纯文档） |
| [接入选型与快速指南核对](I07/agent-integration-guidance.md) | 六方式比较、逐Agent建议与快速接入（纯文档） |
| [用户文档发布边界与原生Agent阅读](I07/user-documentation.md) | 当前用户页与内部资料分离，补DSH/全部Agent章节、六方式与功能摘要；网页范围验证 |
| [文档目录重组](I07/docs-reorganization.md) | 主文档只留当前状态，历史索引集中到本目录（纯文档） |
| [连接通路目标与ACP/Multica研究](I07/connectivity-research.md) | 核心目标校准，CT-01至CT-05与ACP候选来源 |
| [Claude Projects与小队公共空间调研](I07/claude-projects-research.md) | Claude Projects一手资料与公共协作空间映射 |
| [Claude Projects / Dots / Grok Bot研究](I07/projects-dots-bots-research.md) | 共享记忆/选定上下文/可见交接对比，细化CT-04/05；Grok Build为CT-03候选 |
| [CC Switch深度调研](I07/cc-switch-ui-research.md) | 桌面UI重构的设计依据 |

### 发布记录

| 版本 | 交付与边界 |
| --- | --- |
| **0.6.0-alpha.36** | 公开发布：[全部修复整合与本地EXE](I07/alpha36-delivery.md)；含公开alpha.35修复与当前增量，标签冻结`1fef25f`，EXE与SHA-256公开核验 |
| **0.6.0-alpha.35** | issue #12：[同机独立执行与完整管理恢复](I07/scoped-execution-recovery.md)；PR #13合并，标签冻结`b5de577`，EXE与SHA-256公开核验 |
| **0.6.0-alpha.34** | [交付记录](I07/alpha34-release.md)：OpenCode 1.x/2.x、独立MCP、CT-04/CT-05及alpha.30–33整合；标签冻结`1af4dab`，EXE与SHA-256公开核验 |
| **0.6.0-alpha.29** | [alpha.29交付](I07/alpha29-release.md)：UI重构/原生接入/连接能力整合发布 |
| **0.6.0-alpha.23** | [发布记录](I07/github-release.md)：I07A/B及I07C首批持续协调分发 |
| alpha.30–alpha.33 | 见下方"协作兼容与按机器管理"和"维护修复"各专项；alpha.31/32/33为独立修复分支补丁，alpha.30为issue #6独立工作树 |
| 全部版本对照 | [历史发布登记](release-ledger.md)：按版本的标签/冻结提交、EXE 字节、SHA-256 与当时发布边界，含早期源码同步检查记录；未列入的中间版本见上方各专项 |

### 连接能力与委派（CT-01/CT-02）

| 专项 | 说明 |
| --- | --- |
| [CT-01连接能力与原关系拒绝恢复](I07/connection-capabilities.md) | 八项三态能力、方向门禁与原关系拒绝恢复；受控验收 |
| [CT-02首批真实原生生命周期](I07/connection-native.md) | WSL三工具真实直接回答/原Session续聊/取消/重开不重放 |
| [CT-02真实MCP六方向](I07/connection-delegation.md) | Claude/Codex/OpenCode全部六个普通委派方向真实通过 |
| [原生接入准入与核对收据](I07/native-integration-guards.md) | 仅直接会话工具的小队准入与原operationId核对收据 |

### 公共材料与共享上下文（CT-04/CT-05）

| 专项 | 说明 |
| --- | --- |
| [CT-04公共材料首片](I07/public-materials.md) | 只读工作索引/Markdown与指定不可变修订；真实Claude单Task消费 |
| [CT-04桌面材料入口](I07/public-materials-ui.md) | 桌面按需阅读/精确版本核对/复制与MD下载 |
| [CT-05选定上下文首片](I07/context-packet.md) | 明确选择材料版本的只读JSON/Markdown包；不派发/授权/搬Session |
| [CT-05桌面选材与导出](I07/context-packet-ui.md) | 桌面明确选材、核对预览与MD/JSON本机副本 |

### 独立MCP与原生Agent扩展

| 专项 | 说明 |
| --- | --- |
| [独立MCP文件与原生配置管理](I07/mcp-installation.md) | 三格式配置增删、长期接入撤权与外部委派归属 |
| [Hermes/Pi/DSH与自定义适配接口](I07/native-agent-expansion.md) | 三种新工具直接会话、六种图标与源码注册接口 |
| [DSH Desktop/Web接入](I07/dsh-desktop-web.md) | alpha.34之后源码：两个认证HTTP服务入口、原轮次恢复、同名Distributed Shell排除与Web安装提示 |
| [DSH本地EXE与真实连接验证](I07/dsh-exe-delivery.md) | .dsh.3候选；真实303/命名参数修复、两服务认证与Desktop模型限流分列 |
| [OpenCode宿主生命周期修复](I07/opencode-host-lifecycle.md) | 公开alpha.35冻结源码仍缺close；本地config.2已含修复，包内两入口复核通过，已随alpha.36公开 |
| [OpenCode 1.x/2.x兼容修复](I07/opencode-v1-compatibility.md) | 官方1.x独立HTTP路径与MCP双布局，保留2.x |
| [当前Agent版本发现修复](I07/current-agent-discovery.md) | 多版本节点按当前命令入口报告，旧安装保留历史 |

### 小队与自动化（I07A/B/C）

| 专项 | 说明 |
| --- | --- |
| [I07A交付](I07/delivery.md) | 登记、小队、公共文档/消息与手动原生执行 |
| [I07B任务交接交付](I07/task-handoff.md) | 任务板、精确产物版本、授权交接与返修/重试 |
| [I07C首批持续协调](I07/automation.md) | 授权事件激活、Claude原主会话自动续接 |
| [小队停止与原生终态核对](I07/native-stop.md) | 用户停止工作、撤销访问与取消/任务双重核对（alpha.24候选） |
| [小队原生等待可见性](I07/native-waiting.md) | 权限/输入等待类别与数量展示 |
| [真实三原生成员验收](I07/native-members.md) | 同WSL三独立Claude宿主公共文档链，五次自动回合 |
| [本机手动权限等待补验](I07/native-permission.md) | 真实Claude权限等待/允许/拒绝实测 |
| [自动主角色首轮权限补验](I07/auto-native-permission.md) | 事件自动启动后的真实权限等待 |
| [原会话后续轮权限补验](I07/resume-native-permission.md) | 自动主角色续接轮的独立权限控制 |
| [不完整任务回应保护](I07/incomplete-receipt.md) | 缺失身份的succeeded不能假成功或解除占用 |
| [续接意图绑定保护](I07/intended-conversation.md) | 首条续接回应前核对原Conversation |
| [空白原生Session边界](I07/blank-native-session.md) | 空白Session不开放自动续接 |
| [Codex错误终态保护](I07/codex-terminal.md) | 原生错误不被同轮完成事件覆盖 |
| [Linux后台启动权限窗口](I07/daemon-bind.md) | Unix socket创建即限0600 |
| [会话异常的业务验收保护](I07/acceptance-native-binding.md) | 会话异常时succeeded不得进入业务验收 |
| [整合源码与本地候选](I07/integrated-source.md) | alpha.30–32修复与CT-04/MCP同工作源码整合（integrated.3） |
| [当前工作区整体验证](I07/integration-baseline.md) | 未发布工作区核心/桌面全量受控回归 |

### 协作兼容与按机器管理（已发布修复）

| 专项 | 说明 |
| --- | --- |
| [OpenCode 2.x与按机器管理](I07/version-management-recovery.md) | issues #8/#9，alpha.32：严格2.x准入与unknown按机器隔离 |
| [协作兼容修复](I07/collaboration-compatibility.md) | issue #7，alpha.31：API兼容判定、原对象控制路由与能力激活 |
| [历史详情读取恢复](I07/history-detail-recovery.md) | issue #6，alpha.30：按实际backend定位原对象与局部错误隔离 |

### 维护修复

| 专项 | 说明 |
| --- | --- |
| [维护上传进度与持久化修复](I07/maintenance-persistence.md) | issue #10，alpha.33：进度不中断SFTP，最终台账保存失败不发送 |

### 界面与体验

| 专项 | 说明 |
| --- | --- |
| [桌面界面整体重构](I07/ui-redesign.md) | 统一壳层/机器概览/图切换，本地候选alpha.28.ui.2 |
| [Windows视觉与交互验收](I07/ui-visual-acceptance.md) | 主界面/状态/小队/关系图分层验收 |
| [桌面空闲黑窗与刷新优化](I07/desktop-polling.md) | 轮询与安装扫描分离，poll.4本地候选 |

## I06 专项索引：机器网络、SSH与后台

### 迭代主记录与阶段验收

| 专项 | 说明 |
| --- | --- |
| [6A候选验收](I06/acceptance.md) | 独立Coordinator/SSH/Linux daemon主要流程，alpha.2候选 |
| [I06B图编辑实施与验收](I06/graph-implementation.md) | alpha.6图/授权事务/原父权限与独立双向链 |
| [I06C收尾](I06/final-delivery.md) | alpha.13/15/16可信后台维护、控制恢复与未发送边界 |
| [GitHub EXE发布记录](I06/github-release.md) | alpha.9起Windows EXE与校验分发 |
| [新程序管理旧后台](I06/client-background-operation.md) | 新EXE设置页停止同profile旧Coordinator的说明与验证 |

### 修复专项（按alpha版本）

| 专项 | 说明 |
| --- | --- |
| [alpha.3 Codex发现修复](I06/codex-discovery-fix.md) | 自然语言发现指引与MCP工具名展示 |
| [alpha.4 兼容复用](I06/ssh-compatible-reuse.md) | 可信旧daemon清单校验与复用 |
| [alpha.5 SSH恢复错误清理](I06/ssh-error-recovery.md) | 恢复后清除旧错误并保留新失败 |
| [alpha.7 图可用性优化](I06/graph-usability.md) | 主节点强调、连线避让与中键平移 |
| [alpha.8 拖动修复](I06/graph-drag-fix.md) | 旧后台本机布局与整组背景拖动 |
| [alpha.9 节点管理](I06/node-management.md) | 合并页面与节点接入/断开/移除生命周期 |
| [alpha.10 机器管理](I06/machine-management.md) | SSH连接编辑、历史持久化与事件游标补偿 |
| [alpha.14 上传诊断与恢复](I06/ssh-upload-recovery.md) | SFTP失败分类、ACK进度与重检入口 |
| [alpha.16维护发送边界](I06/maintenance-launch-recovery.md) | 未发送证明持久化与rejected/unknown边界 |
| [alpha.18运行缓存与原提交恢复](I06/runtime-recovery.md) | 缓存清单自引用排除与原未派发意图恢复 |
| [alpha.19 Linux CLI发现](I06/linux-cli-discovery.md) | 非交互用户态安装目录扫描 |
| [alpha.19 OpenCode二次发现](I06/opencode-discovery.md) | 共享扫描核验原安装与Windows配置写入 |
| [alpha.20 未确认请求隔离](I06/pending-isolation.md) | 准备拒绝恢复与独立节点不阻塞 |
| [alpha.25 Windows原请求恢复](I06/windows-context-recovery.md) | 未完成上下文不得截获原请求查询 |
| [alpha.26 旧Linux后台升级](I06/ssh-alpha24-upgrade.md) | 补收可信清单，恢复alpha.24连接后可维护升级 |
| [alpha.27 Windows未派发恢复](I06/windows-start-persistence.md) | issues #3/#4：严格未派发核对与台账锁重试 |
| [alpha.28 SSH持久拒绝恢复](I06/daemon-rejection-recovery.md) | issue #5：只读原daemon持久拒绝结算 |

## 后续迭代必须写清

下一迭代目标与优先级见 [迭代路线](../project-plan.md)。

1. 需求编号、对应整体功能与模块、可验收行为。
2. 本次设计取舍与被更新的整体/模块文件。
3. 实际完成项、代码落点与未完成项。
4. 测试运行范围、真实证据、失败/未测和发布包状态。

不能只把新方案追加在迭代目录而让整体设计继续描述旧实现。同步规则见 [开发维护指南](../development-guide.md)。主文档（资料入口、整体设计、架构、数据、协议、测试、路线）只保留当前状态；逐轮历史写入本目录并在本页登记。
