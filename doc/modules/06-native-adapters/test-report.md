# M06 原生 Agent 适配器测试报告

## #19/#20 修复验证

EXE与校验文件已公开，匿名完整下载HTTP200、130190265字节及SHA-256一致；[发布核验](../../iterations/I08/alpha52-release.md)。

2026-10-23，alpha.52公开版；M06-F05。定向生命周期、中央资源与原请求回归131/131，远端/断开身份契约9/9，Windows生产前端12组通过、pageErrors=0；实际Windows进程检测识别日常OpenDesk运行并在隔离文件拒写，模型0。共享计数不跨模块累加；桌面共享全量841/841、核心68/68，类型/lint通过；普通无调试Windows EXE8组通过；包54后台/84Core/1702Linux与冻结源码一致，模型0。原失败、命令、原始证据及未测项见[本轮记录](../../iterations/I08/opendesk-lifecycle-relation-scope.md)。

## 连接身份与节点管理验证

| 场景 ID | 场景与实际结果 |
| --- | --- |
| T-M06-200 | DSH真实文件模块与生产中央在隔离临时HOME下验证稳定连接ID和旧文件保留；无真实DSH认证、OpenDesk网关、模型或用户profile写入。 通过；2026-10-23，WSL Node22.23.1/Windows Node+Edge，模型0。 |

隔离修复基线桌面777/777，Windows生产前端受控10组通过；当前集成及普通EXE已随0.6.0-alpha.51.recovery.2公开，分层证据见发布记录。[原始证据、环境与未测项](../../iterations/I08/connection-identity-node-scope.md)。

2026-10-23 / alpha.50本地候选：共享桌面794/794、核心68/68，工程与最终包核验通过；Pi原生Linux/Windows各5组、Hermes固定官方源码原生组件5组、Windows生产前端5组/普通EXE4组通过，模型0。原生阶段/受控发现、首次YAML与验收脚本/受限socket失败分别保留；真实自主父模型、Hermes正式安装版/Windows原生、独立SSH及完整矩阵未准出。共享计数不相加。 [最终实现、原始证据与范围](../../iterations/I08/hermes-mcp-config.md)。

2026-10-23 / alpha.49，WSL Node22.23.1：共享桌面770/770、核心68/68、类型/lint/生产构建和最终包/bootstrap一致性通过；普通Windows EXE4组通过，模型0。新启动受控契约4项在全量内，真实生产WSL只读三次中2次通过/1次就绪前退出；最终包真实Windows→WSL MCP组件5组通过，包含原生Codex0.162.1及Linux stdio调用/重开/撤权/轮换/清理；稳定性、原生父模型与独立SSH尚未准出，失败不抹除。共享计数不跨模块累加。 [完整需求、实现、原始证据与限制](../../iterations/I08/wsl-host-readiness.md)。

## DSH Desktop原生MCP（2026-10-22）

T-M06-MCP02DSH / M06-F02；2026-10-22，alpha.48候选。已安装未修改Desktop2.0.18的prepareDesktopProfile/composeEntries实际读取Bridge条目，原生MCP客户端发现7工具、正式授权只读调用、伪造参数拒绝、外部删除/重启不补装、撤权/身份轮换/原生组合移除，共5组通过，模型0。受控父进程，不是日常UI或原生父模型。桌面766/766、核心68/68；最终目标/链接保护及界面已覆盖。 [开发、原始失败与分层验收](../../iterations/I08/dsh-desktop-mcp.md)。

## OpenDesk MCP 默认字段兼容（2026-10-22，alpha.47本地候选）

T-M06-MCP02DEFAULT / M06-F02：WSL Node22.23.1，MCP定向44/44、桌面全量760/760、核心68/68、类型/lint/构建通过。空 `headers` 与缺省双向兼容、后台重启/同身份重复添加/撤权清理、12类外部修改保留及探测失效均覆盖；其他适配器保持严格比较。Windows已安装未修改OpenDesk0.3.9 schema/worker组件7组通过，模型0：原生补默认值后归属正确、7工具及正式只读调用、恢复不补装、撤权和清理。组件由受控父进程加载，不代表原生UI或父模型自主委派。[反例、脚本、最终包与证据](../../iterations/I08/opendesk-mcp-defaults.md)。

2026-10-22 日常 OpenDesk 原生父模型只读发现已补验：离线修复诊断条目后，真实父模型调用 list_agents 1 次成功，返回 7 个获准节点；Prompt 1、子任务 0。自主委派与日常原生页面仍未验，不并入历史回归计数。[现场证据](../../iterations/I08/opendesk-mcp-diagnostic-repair.md)。

## 后续原生组件验收（2026-10-22，alpha.46）

已安装OpenDesk/DSH原生MCP组件协议分别5组/6组通过；两条生产协作链各完成1个真实Claude子任务，并分别只读重开原任务/Session/结果，无重放。原生父模型自主决策与日常原生页面未验；产品运行代码与EXE未变，不把新增验收与原全量计数叠加。[脚本、初次失败、准确层级和未测项](../../iterations/I08/mcp-native-acceptance.md)。

## MCP02恢复与观测（2026-10-22）

OpenDesk选择Node后再渲染所有导出格式，恢复保存的launcherPath；OpenCode数组command正确拆成程序/参数。配置绑定和60秒有效期限制观测复用。 WSL Node22.23.1共享桌面758/758、根68/68通过，最终JSON修复后CLI11/11及类型/lint/核心构建通过；模型0，真实原生模型委派未测，Windows结果按专项登记。 [实现、原始证据与未测项](../../iterations/I08/mcp-open-recovery.md)。

2026-10-22 / OpenDesk Desktop 0.3.9：已安装原网关的真实执行、续聊与普通EXE窗口重开通过；无运行代码变更，不将历史自动测试计为今日重跑。分层计数与未测项见[现场专项](../../iterations/I08/opendesk-desktop-live.md)。
OpenDesk相关验证统一见[专项报告](../../iterations/I08/opendesk-existing-interfaces.md)，明确受控协议、真实原生启动、模型和Windows包的独立范围；共享计数不跨模块累加，未执行项保持未测。

## OpenDesk 原生可见性修复（2026-10-22，alpha.45）

T-M06-MCP02OD / M06-F02：在**用户真实 OpenDesk Desktop 0.3.9** 上定位并修复“原生 MCP 列表看不到 AgentBridge”。两个根因：

1. **stdio 服务未响应 `server/discover`**（Bridge 侧真 bug）：OpenDesk 使用 2026-07-28 协议修订，会在 `initialize` 前探测 `server/discover`；Bridge 原先返回 JSON-RPC 错误，严格客户端因此判定连接失败。修复为返回 `supportedVersions`+`capabilities:{tools:{}}`（[mcp-client.cjs](../../../desktop/electron/mcp-client.cjs#L11)）；受控 `desktop/tests/mcp-client-protocol.test.cjs` **2 例**（discover 不回错误并声明版本、discover 之后 `initialize`/`tools/list` 仍可用）。
2. **OpenDesk 无法启动 Bridge 的 Electron 运行时**：`%APPDATA%\agentbridge-desktop\windows\runtime\electron-44.7.0-x64\AgentBridge.exe` → `命令未找到`；整目录复制到 D 盘 → `MCP error -32000: Connection closed`；系统 `node.exe` 启动同一 `mcp-client.cjs` → 正常。修复为 OpenDesk 两个入口**优先使用 PATH 中真实 Node 启动器**（`nodeLauncher()`），状态新增 `launcher:'node'|'electron'`，Electron 回退时界面提示先安装 Node；受控 `mcp-integration.test.cjs` 新增“OpenDesk native entries prefer a real Node launcher over the Electron runtime”。

真实原生结果（模型0，用户真实配置）：写入稳定条目并**完全重启 OpenDesk** 后，原生日志 `[mcpmgr] Initialized with 1 server configs` → `Connecting to "AgentBridge" (stdio)...` → `Connected to "AgentBridge", discovered 7 tools`；用户可在 OpenDesk “MCP 管理 → 已安装 MCP”看到 AgentBridge/STDIO/已连接/7 工具。对照实验（最小自写 MCP 服务）可连接并 `discovered 1 tools`，证明配置位置与格式正确。证据：`artifacts/mcp-open-integration/evidence/opendesk-native-mcp-verified.txt`（含失败与成功两阶段原始日志）。

**边界（不得写成调用已通过）**：该条目是用于原生可见性验证的**诊断条目**，descriptor token 不是真实授权，因此不能据此声称工具调用通过；真实授权需用 alpha.45 在 Bridge 对 OpenDesk Desktop 点“添加 Bridge MCP”（覆盖同一 `id=agentbridge`）后再重启验证调用；工具实际调用、授权与结果归属未验。回归：桌面 **753/753**（新增 3 例含本项 launcher 与 protocol 用例）；根测试直接运行 **66/66**（`npm test` 外壳曾超时，改直接运行并按此记录）；根 typecheck/eslint src/build 与桌面 tsc 通过。alpha.45 候选 EXE 130177443 字节、SHA-256 `35674f6c…`、`verify-package --portable` passed（digest `195081305a…`），未签名、未公开、未在真实 Windows 启动（T16 待执行）。[§14](../../iterations/I08/mcp-open-integration.md#14-opendesk-原生-mcp-可见性修复2026-10-22alpha45)

## DSH CLI 显式 profile 适配（2026-10-22 晚补）

同日补齐 DSH CLI 的原生配置管理：`mcp.status|export|install|remove|revoke|probe` 接受可选 `profile`（仅 `dsh`；DSH Web 固定 `web` 且不暴露该参数），原生目标为 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`，写入仍是单一 `insert:` 行 + `@deepseek-ai/dsh-mcp-client`。名称按单段目录校验 `^[a-z0-9][a-z0-9-]{0,63}$`，`../escape`/`a/b`/空串/大写/前导 `-` 拒绝且不产生逃逸文件；未指定时 `mcp.status` 返回 `nativeSupport:false`+`MCP_DSH_PROFILE_REQUIRED`+`profile:null`，`mcp.install`/`mcp.remove` 同码拒绝，`mcp.export` 仍出片段；连接行落 `profile`，`status` 回显、省略参数用登记值，`mcp.remove` 只清理登记的那个 profile（其他 profile 逐字节不变）；安装后 `facts.nativeLoad:'reload_required'`，不宣布已连接。`dsh` 的 `nativeMcpConfig` 由 false 改为 **true**（产品级适配存在但需显式 profile），`dsh-desktop` 仍 false；桌面 `dsh` 行新增 profile 输入框，CLI 新增 `--profile NAME`（`MCP_DSH_PROFILE_REQUIRED` → 退出码2）。

测试（Lead 实跑，定稿全量基线）：桌面全量 **tests 750 / pass 750 / fail 0**；根 `npm test` **66/66**；`mcp-integration.test.cjs` **22/22**（新增五项 DSH profile 用例：无 profile 拒绝、写入仅落在指定 profile、`status` 回显登记 profile、`remove` 只清理该 profile、非法 profile 拒绝且不产生逃逸文件）；`connection-capabilities` 11/11、`mcp-local-machine` 2/2、界面组（connection-ui + mcp-status-facts-ui + agent-configuration-ui）**24/24**、`tests/mcp-cli.test.ts` 9/9；根 `typecheck`/`eslint`/`build` 与桌面 `tsc --noEmit` 通过。计数为全工程共享，不跨模块相加。

真实原生（模型0，受控 scratch `DSH_HOME`）：用产品代码 `localMcpHost().call('mcp.install',{adapter:'dsh',profile:'acp'})` 写入 `$DSH_HOME/profiles/acp/cordis.patch.yml` 后，真实 `dsh --profile acp` 启动中捕获到 `server/discover`→`-32603` 回退→`initialize`→`notifications/initialized`→`tools/list`→**7 个工具**，即显式 profile 下 CLI 家族确实加载该条目并完成握手（`dsh-acp-handshake.txt`；`dsh-acp-boot.txt` 为空输出）。限制：未观测 TUI 启动、用户自建 profile 与真实用户 profile；名称合法但写错 profile 仍会静默写入不被加载的目录；原生 UI 人工可见/删除/禁用/编辑待执行；无真实 ACP 客户端会话，只验证到协议握手与工具目录，不含模型委派；采集用的透传 wrapper 不是产品路径；安装后 Bridge 仍只报 `nativeLoad:'reload_required'`（不代用户宣称已连接）；原生 UI 人工可见/删除/禁用/编辑与真实用户 profile 未验；profile 名称由用户提供，Bridge 只能校验其为安全单段目录名，不能证明它就是当前启动所用的 profile（写错不会报错，只会写到不被加载的目录）。契约见[本轮§12.5](../../iterations/I08/mcp-open-integration.md#125-dsh-cli-显式-profile-原生配置2026-10-22-晚补)。

## 真实原生探测补充（2026-10-22 晚）

同日补充两组真实原生探测，模型0、隔离 profile、不改用户真实配置、输出脱敏；不改动上一节的计数。

- **DSH Web 真实握手通过（受控 profile）**：在 scratch `DSH_HOME`（`profiles/web` 复制自真实 profile，`node_modules` 软链真实 `~/.dsh/profiles/node_modules`）用产品代码 `localMcpHost().call('mcp.install')` 写入真实 `cordis.patch.yml`，再启动真实 `dsh --profile web --host 127.0.0.1 --port 0 --no-open`。记录的 JSON-RPC：原生先探 `server/discover`（服务返回`-32603`未知方法后回退）→ `initialize` → `notifications/initialized` → `tools/list`，Bridge 返回 **7 个工具**。由此 DSH Web 四项真实原生事实成立：配置存在、原生已加载、连接握手、工具目录可用（`ownership:bridge`、`authorization:valid` 由登记决定）。证据：`artifacts/mcp-open-integration/evidence/dsh-live-mcp-handshake.txt`、`dsh-live-boot.txt`。**未验证**：把 `command` 改成 `/nonexistent` 的对照在 launcher 输出里看不到错误（DSH 插件日志不进 stdout），所以“失败会显式暴露”不得写成已验证；原生 UI 人工可见/删除/禁用/编辑与真实用户 profile 未验。
- **OpenDesk CLI 0.3.8 负面证据（第一优先级缺口，结论已升级为“无 MCP 管理面”）**：`opendesk plugins list` 的 11 个 builtin 插件无 MCP 管理插件、`opendesk plugins tools` 无插件工具；`OPENDESK_CONFIG_DIRECTORY=<临时目录> opendesk tools list` 只有 `filemgr`/`search`/`terminal`/`todomgr`/`devicemgr`/`memory`/`planning`，**没有** `mcpmgr`/MCP 分区，也没有原生 MCP 列表命令；按 Bridge 当前写法写入 `applications.mcpmgr.servers` 后启动 OpenDesk，启动完成时 `applications` 被重写为 `{}`，连 `applications.devicemgr` 与未知 app 段一并丢弃；真实 `~/.opendesk` 没有 `setting.json`，只有 `~/.opendesk/apps/<app>/...`。结论：**OpenDesk CLI 0.3.8 不存在可供 Bridge 写入并被原生读取的 MCP 管理面**。代码已收敛：CLI `nativeMcpConfig=false`，`mcp.install` 以 `MCP_NATIVE_CONFIG_UNSUPPORTED` 拒绝、`mcp.export` 仍出片段；Desktop 的原生读取随后在 alpha.45 修复并验证（见上节）。受控 `mcp-integration` 现为 **22/22**（新增 CLI 不支持/导出可用与 Desktop 写入候选条目）；定稿全量桌面 **750/750**、根 `npm test` **66/66**，根 typecheck/eslint/build 与桌面 tsc 通过。本模块`T-M06-OD-03` 的 MCP 数组保留/冲突受控结论仅说明“Bridge 侧写入行为”，不代表原生读取。证据：`artifacts/mcp-open-integration/evidence/opendesk-tools-list.txt`。仍需在**安装 `mcpmgr` 的真实 profile**上复核；本轮未改代码，[静态注册表](../../../desktop/electron/builtin-adapters.cjs#L19) 仍声明 OpenDesk `mcpClient:true`，与上述未知状态的差异已登记在[本轮§12](../../iterations/I08/mcp-open-integration.md#12-真实原生探测补充2026-10-22-晚)。

## 开放MCP接入第一片（M06-F02/F04）

2026-10-22 / alpha.43派生工作源码 / WSL Node22.23.1：本轮同机定稿全量 `cd desktop && node --test tests/*.test.cjs` 为 tests **750** / pass **750** / fail 0（当日首轮 747/747（58.4s），加入 DSH profile 与 OpenDesk 用例后定稿 750/750，见下两节），根 `npm test` 66/66，根 `typecheck`/`lint`/`build` 与桌面 `tsc --noEmit` 通过；这些是全工程共享计数，不跨模块相加。MCP专项受控结果：`mcp-integration.test.cjs` 19/19（新增“宿主不传调用方候选时经发现/PATH解析原生可执行文件”的生产形状用例；含DSH Web单`insert:`行与注释保留、原生列表与Bridge stdio工具目录分列、撤权保留条目、外部删除后重启不补回、重装轮换身份）、`connection-capabilities.test.cjs` 11/11（十入口能力三维、独立调用方准入、托管scope单独拒绝）、`mcp-local-machine.test.cjs` 2/2（Linux本机仅路由`mcp.*`、重启不重写用户删除的条目）。

真实原生但受控profile、模型0：Claude `mcp.install`后`mcp.probe`六项事实全部已知，`claude mcp list` 报 `✔ Connected`，Bridge工具目录7项；Codex `codex mcp list` 列出 agentbridge（`Status enabled`），`connection`保持“未知”（codex list 不做健康检查）；DSH Web 写入后 `--profile web --dump-config` 组合输出含该行。原始文件见[本轮证据](../../iterations/I08/mcp-open-integration.md#115-证据位置)；这些是“写入→原生列表→工具目录”的证据，**不是**真实删除、真实禁用/编辑、获准只读调用或真实主调用链验收。

限制：未运行模型、未写用户真实原生配置；同日稍后已构建并核验本地候选 alpha.44（包一致性 passed），但**未在真实 Windows 启动该 EXE**；OpenDesk两个入口的原生MCP列表仍未核对到；Hermes/Pi的MCP客户端能力保持未确认；DSH Desktop无Bridge可管理的原生配置路径（DSH CLI 已补显式 profile，见下节）；WSL本机机器的`mcp.*`路由仍为缺口（Linux本机与Windows本机已实现）。逐入口完成度与MCP02-T01..T18状态见[本轮记录](../../iterations/I08/mcp-open-integration.md#114-逐入口完成度)。

2026-10-21 / M06-F01 / alpha.40 源码：WSL Node22.23.1 定向97/97、全桌面705/705，计数共享不相加。真实阿里云 alpha.37/OpenCode2.0.26 只读确认原进程 OOM；用户批准临时Swap后原服务健康、原Task/Conversation各1→1、设置与Agent归属保留，原接入拒绝收敛，随后一次管理核验confirmed，Prompt新增0。此次为带外恢复，非新EXE/GUI/模型推理验收。[原始证据、失败与限制](../../iterations/I08/opencode-oom-recovery.md)。

## alpha.36整合边界

2026-10-21 / WSL Node22.23.1：本轮全量核心57/57、桌面676/676，类型/lint/前端构建通过。各模块共享计数不相加；包核验、Windows契约144/144、界面26组与普通EXE7组通过，具体以专项为准，真实模型/用户profile/独立SSH未验。[完整交付](../../iterations/I07/alpha36-delivery.md)。

## 普通子任务最小上下文

T-M06-155 / M06-F01/F02：2026-10-21，alpha.34派生未发布源码。WSL Node22.23.1冻结桌面667/667零跳过/退出0，定向121/121含新18项为全量子集；Windows Node24.19.0同新上下文/原连接列表36/36，Core构建通过。八入口统一宿主受控验证；Hermes/Pi/DSH生产链与受控CLI子进程收到说明+原需求，原设置、去重/重开/取消保持；独立MCP真实stdio及撤权通过。旧委派原文、unknown原ID、v1摘要、超限/未知版本及严格原准备拒绝证明均覆盖。首次118/120因渲染输入指纹未同步的两项真实回归已修复，不放宽结算。共用计数不相加，模型0；不是上游原生产品/模型、新EXE或独立SSH验收。[契约、原始日志与限制](../../iterations/I07/delegation-context.md)。

## OpenCode 包内宿主复核

2026-10-21 / WSL Node22.23.1：现有本地alpha.35.config.2冻结包生产stdio/daemon入口2/2通过，完整EXE摘要及包一致性重核通过。公开alpha.35冻结b5de577仍为缺close旧工厂；本轮未重下公开EXE、重跑普通Windows EXE或验证用户profile/真实模型。[本轮证据与切换步骤](../../iterations/I07/opencode-host-lifecycle.md)。

## Agent 行配置入口验证

M06-F01/F02；2026-10-21，alpha.34派生工作源码。生产SSR82/82（含新增6项）及Windows Edge生产界面受控IPC8组通过；覆盖目标固定、迟到响应隔离、DSH精确安装/入口、secret清空、写入在途/离线限制和窄窗口。完整桌面649/649、核心57/57通过，生产MCP临时文件4组、既有DSH前端3组保持；普通EXE与候选证据统一见[专项](../../iterations/I07/agent-row-configuration.md)，共享计数不跨模块相加。未在用户profile修改原生配置、未调用真实模型或升级独立SSH。

## CT-07当前调用方连接视图

T-M06-154 / M06-F02：2026-10-21，alpha.34派生未发布源码；WSL Node22.23.1冻结桌面643/643零跳过/退出0，定向103/103为其子集，新增11项含原父查询/快照等待期间4个并发子场景；Windows Node24.19.0同视图与原列表18/18。覆盖角色/授权原因、空参数、来源机器/父终态/unknown、独立MCP身份/立即撤权、原请求身份与执行次数保留；Core构建通过。共用计数不相加，模型0；原生模型/新EXE/独立SSH未验，首次错误断言与真实snapshot观察写回分开保留。[完整契约、日志与范围](../../iterations/I07/agent-connections.md)。

## 扫描与原管理操作恢复专项

M06-F01/F02；2026-10-20，alpha.34派生工作源码。Windows Edge生产前端受控IPC6组通过、页面错误0、模型0；覆盖扫描/查看可用、执行仍受锁、原管理来源/错误/ID可见、查询失败保留及匹配原收据后解除。当前全工程、普通EXE与包验证结果统一见[完整规则与分层验证](../../iterations/I07/agent-management-recovery.md)，计数共享不跨模块相加。当前用户profile只读诊断不是升级实测；真实模型、原profile切换与独立SSH未验。

## CT-07只读委派列表（2026-10-20）

T-M06-153 / M06-F02：WSL Node22.23.1定向110/110（含新7项列表+1项Claude允许项）与最终冻结桌面615/615零跳过/退出0；Windows Node24.19.0列表/真实stdio及独立MCP8/8。覆盖父/连接隔离、空身份/游标、unknown/非实时、撤销关系保留原读、父终态/连接撤权拒绝、观察器重开不重派，Claude/Codex允许只读项但reply_task仍需原审批。共用计数不相加，模型0；Windows原生CLI/真实模型/新EXE/独立SSH未验，首次冻结缺C资源及初次TAP覆盖如实记录。[日志、脚本、版本与范围](../../iterations/I07/delegation-list.md)。

## OpenCode 宿主生命周期回归

M06-F01：2026-10-20 / alpha.34 后工作源码 / WSL Node22.23.1。两条生产入口旧工厂回放均失败，修复后桌面相关 28/28、核心会话 2/2 通过，含等待任务关闭门面后原 Task/Session 和 Prompt 计数保持。均为受控测试，共享计数不跨模块累加；未验证用户 profile、真实模型、Windows EXE 或独立 SSH。[原始日志、命令与限制](../../iterations/I07/opencode-host-lifecycle.md)。

## Agent 侧自主操作规划核对

M06-F01/F05：按用户目标规划CT-06通用MCP调用方、CT-07 Agent侧连接操作面与CT-08多主关系连接管理；MCP优先，插件仅作无原生MCP客户端时的薄传输缺口填补。本轮仅规划文档、文档检查与站点构建，没有运行模型、安装包装器或修改运行功能；命令和结果见[本轮记录](../../iterations/I07/agent-centric-operations.md)。

## 接入选型与快速指南核对

M06-F01/F05：对照静态注册表、Host/发现/协议实现、开发骨架及实际工程脚本完善[方式比较与推荐](../../agent-integration-guide.md)和[快速开发路径](../../custom-agent-development.md)。MCP/ACP协议事实只读核对官方固定版本/明确v1资料；没有运行模型、安装包装器或修改运行功能。本轮仅执行文档与diff检查，不将既有测试计数当作今天的新模型/EXE证据，具体命令和结果见[本轮记录](../../iterations/I07/agent-integration-guidance.md)。

## DSH Desktop / Web 专项

当前本地.dsh.3候选：核心56/56、完整桌面607/607、Windows DSH11/11、生产前端3组及普通EXE6组通过；真实Windows/WSL认证与接口通过，Desktop同Session两轮及去重已观察，但模型均RATE_LIMIT，WSL模型/独立SSH未测。[当前源码、包与分层证据](../../iterations/I07/dsh-exe-delivery.md)。以下保留各先前冻结范围。

M06-F01/F05：本轮WSL Node22.23.1发现/服务/能力34/34、全桌面606/606零跳过；同名Distributed Shell不再计DSH，真正CLI失败保留PATH选择，Windows安装和Linux Web profile/停用提示回归通过。Windows新补验未取得有效输出，不计通过；无原实例认证/模型/新EXE/独立SSH。[日期、原始日志与限制](../../iterations/I07/dsh-desktop-web.md#同名程序与服务发现修复)，下段为前片共享证据。

M06-F01/F05：本次WSL受控HTTP/独立worker与方向能力、Windows Node契约、Edge生产前端及失败记录统一见[本轮完整契约与证据](../../iterations/I07/dsh-desktop-web.md)，工程总数不跨模块相加。Windows当前安装2.0.18/认证屏障和WSL Web profile是环境核对；未在原实例调用模型，不作为真实原生、发布包或独立SSH验收。

## OpenCode 1.x / 2.x 兼容修复

M06-F01/F02/F04：OpenCode 新增独立 V1 原生生命周期和 MCP 配置，保留 V2；CLI 版本可识别与实际契约有效分别检查。不改变其他 Agent 的账号/模型、原生 Session 或台账归属。 本次共用专项的全套日志，不跨模块累加；受控测试、官方 CLI 加受控传输与未测 Windows/SSH/真实模型分列。 [需求、实现、验证与未测边界](../../iterations/I07/opencode-v1-compatibility.md)。

## CT-05明确选材只读包

T-M06-151 / M06-F02：WSL Node22.23.1定向14/14（新6项）包含在全桌面576/576，Windows Node24.19.0同14项/真实命名管道与stdioMCP通过，零跳过、受控模型0。覆盖精确版本、旧消息/历史产物、任务过期/越权/撤权/终态scope、格式和UTF-8容量、完整state/receipt不变。真实Claude2.1.303一个成功Task、3次MCP读取及完整重开/重复观察仍1Task；各模块共享计数不相加。新EXE、其他工具实际消费/独立SSH及界面选材未验，源码晚于integrated.3冻结。[日志、脚本、环境首次失败与发布边界](../../iterations/I07/context-packet.md)。

## 整合源码与本地候选

T-M06-149 / M06-F01/F02：核心51/51、桌面570/570零跳过（定向85/85及兼容15/15是相关子集），根类型/lint/构建与桌面构建通过。Windows前端26组/模型0，按历史/门禁/管理/材料/MCP分别记录；最终integrated.3普通Windows EXE五组通过：原历史/文档/MCP导出、窗口/后台重开、持久资源和原unknown保留，原生请求0；这是隔离合成profile，不是真实Agent模型或用户现场。包42 CJS/78核心/1446 Linux条目匹配，未部署用户SSH或跑真实模型。各模块共用计数不相加；首次夹具/原型失败与原历史证据保留。[版本、源码、所有原始结果和限制](../../iterations/I07/integrated-source.md)。

## issues #8/#9受控验证

M06-F01：核心51/51、桌面543/543（含版本/管理/原路由回归）、最后定向7/7及工程检查通过；Windows95项原路由/9项管理CJS、前端专项4组/既有10组及普通EXE5组通过；分发另按专项逐项记录。无真实模型/用户profile/独立服务器升级，不跨模块累加共享计数。 [需求、实现、验证与边界](../../iterations/I07/version-management-recovery.md)。

## issue #7 协作兼容修复

M06-F01：本轮仅受控HTTP/CLI、生产后台无推理、TCP SSH及Windows交付验收；用户现场/独立SSH/真实模型未测。实际执行结果、首次失败与最终工程/包证据统一引用专项，共享计数不跨模块叠加。 [完整需求、验证与交付](../../iterations/I07/collaboration-compatibility.md)。

## 历史详情路由与局部错误

T-M06-150 / M06-F01/F02：alpha.30隔离修复；合成路由6项、受控TCP SSH1项、Windows纯CJS91/91、Linux SSR63/63，新生产前端7组和既有10组通过，模型0。最终桌面529/529、核心45/45、lint/类型/构建通过；38 CJS/78 core/1401 Linux资源匹配145个冻结源文件。普通Windows无调试EXE合成原两轮/Session只读与关闭重开/后台重启4组通过。分发实际结果及首次失败统一见[当次专项](../../iterations/I07/history-detail-recovery.md)；共享计数不跨模块叠加，用户故障profile/独立服务器未复测。

## 独立 MCP 文件与配置增删

M06-F01/F04；日期2026-10-19，alpha.29后未发布工作区。WSL Node22.23.1受控全桌面537/537、核心45/45；真实原生列表三工具增删通过，Claude/OpenCode连接、Codex仅列表；Windows Edge155生产界面4组通过但机器/原生执行受控。计数为共享结果不跨模块相加，模型调用0。新EXE、真实Windows原生Agent、独立SSH与独立接入真实模型委派未测。源码/命令、首次失败、原始日志和逐层边界见[专项验收](../../iterations/I07/mcp-installation.md)。

## CT-04公共材料首片

T-M06-147 / M06-F02：2026-10-19，alpha.29之后未发布源码，WSL Node22.23.1。定向27/27（含新8项）和最终桌面525/525通过，零跳过，无模型；覆盖只读/精确旧版/分页、跨工作/撤权/原生终态scope拒绝、状态/报告白名单、Markdown和生产Coordinator→stdioMCP→broker路由。定向是全量子集，各模块共用计数不相加。另有真实Claude2.1.303一个成功Task、两次MCP读取、三组限定检查；索引文档当前2版时准确取得第1版，完整重开仍一个原Task。本片没有新EXE/其他工具/独立SSH或桌面导出验收。[原始日志、版本、复现及限制](../../iterations/I07/public-materials.md)。

## CT-02真实MCP六方向

T-M06-146 / M06-F01：WSL Node22.23.1，真实Claude2.1.302/Codex0.163.0-alpha.10.2/OpenCode2.0.24轮流作主并各委派给另两种工具；生产Coordinator/AgentNetwork/MachineHost/stdioMCP/broker/原生CLI或HTTP，非假dispatcher。共9个成功原生Task、6个委派方向、16次实际MCP调用；原父/目标/机器/派生ID/消息与真实结果核对，重开每链Task3→3/委派2。保护7/7计入全桌面517/517（模型0），不与真实或跨模块计数叠加。生产行为无变更；新三工具、新EXE、独立SSH、权限/表单及执行中断点未测。[完整脚本、逐次报告与边界](../../iterations/I07/connection-delegation.md)。

## CT-02首批真实直接生命周期

T-M06-145 / M06-F01：WSL Node22.23.1，真实Claude2.1.302、OpenCode2.0.24、Codex0.163.0-alpha.10.2沿生产Coordinator/AgentNetwork/MachineHost分别通过直接回答、原Session续聊、原任务取消及完整观察重开。共9个原任务，6成功回答/3取消；每工具观察任务3→3，无新增执行。恢复保护7/7和桌面510/510为受控共享计数，不与真实任务或跨模块相加；根45/45保留CT-01日期。本模块产品行为无变更，新三工具/真实委派方向/新EXE/独立SSH未验。[脚本、逐次原始报告、首次失败与完整限制](../../iterations/I07/connection-native.md)。

## CT-01连接能力与原拒绝恢复

T-M06-144 / M06-F01/F05：alpha.28后未发布工作区，WSL Node22.23.1 / Windows Edge155。Hermes/Pi/DSH分别经完整生产Coordinator/MCP/broker/MachineHost/NativeCliHost链执行受控协议子进程，普通委派、取消竞争与原请求重开不重放通过；不是已安装真实工具/账号模型证据。共享定向32/32（全桌面503/503子集）、核心45/45及工程检查通过，无跳过；跨模块不相加。首次夹具失败及修正保留，真实新三工具/当前EXE/独立SSH未验。本轮模型0，先前真实Claude结果不计本轮。[脚本、命令、失败与最终原始证据](../../iterations/I07/connection-capabilities.md)。

2026-10-18本轮[接入矩阵](../../agent-integration-matrix.md)与[ACP/通信研究](../../iterations/I07/connectivity-research.md)仅核对源码、既有证据和外部一手资料，没有新增原生/工程用例或EXE。CLI/SDK/ACP与MCP方向分别记录；新三种“普通被调用路径存在”是静态结论，不能算真实委派通过。下列原计数/版本保持，不累加文档检查。

## 真实原生执行成员公共文档链

T-M06-143 / M06-F04：同WSL三个独立Bridge宿主、真实Claude2.1.302，五组限定检查通过、五次自动原生回合；开发/复核各一轮、主协调沿原会话三轮。原生终态后验收及恢复不重放通过，原生权限回复/非Bridge工具/模型覆盖0。机器路由受控，非独立SSH、真实WindowsEXE或代码编译返修；共享真实计数不跨模块叠加。[脚本、原始日志与准确边界](../../iterations/I07/native-members.md)。

## 原生接入准入与核对收据

T-M06-142 / M06-F05：Hermes/Pi/DSH直接会话与小队边界分开；Codex/新宿主核对收据持久、原ID/类型/任务冲突及重启恢复，旧取消兼容。收据定向57/57，包含新契约23项，未知仍占用。 最终合并源码串行桌面474/474、核心45/45及工程检查通过；受控CLI/磁盘/浏览器，模型0，未升级用户后台或重建EXE，不替代真实原生或独立SSH。[需求、原始失败、最终日志与未测边界](../../iterations/I07/native-integration-guards.md)。

2026-10-18 / T-M06-141：桌面空闲修复源码，WSL Node22.23.1 / Windows Node24.19.0及Edge155。核心45/45、桌面424/424、定向20/20、Windows受控界面3组通过，模型0；属于共享工程计数，不跨模块相加。普通EXE与黑窗观察、冻结包、首次环境失败及用户现场未测边界按[本次完整报告](../../iterations/I07/desktop-polling.md)记录，历史包不冒充本次修复。

## 当前 Agent 版本与历史安装合流

T-M06-141 / M06-F01：alpha.28后未发布工作区、WSL Ubuntu/Node22.23.1。当前PATH安装为权威，新安装新上下文，旧会话/请求仍路由原后端；精确安装二次核验不替换原路径。 桌面424/424、核心45/45通过，计数为共享工程结果不跨模块相加；真实Claude版本2.1.302与受控历史节点合流明确分层。类型/lint/前端构建通过；当前EXE、用户运行中profile、真实模型和独立SSH未验证。[完整场景、原始日志与首次失败](../../iterations/I07/current-agent-discovery.md)。

## 三种原生适配与自定义接口

T-M06-140 / M06-F01/F05：alpha.28 后未发布源码，WSL Node22.23.1，官方协议形状的受控独立进程/真实磁盘，模型0。最终定向 **43/43** 通过，其中新宿主19项、注册契约5项、发现9项、既有Codex5项、MachineHost readiness1项/routing4项；此为共享总数，模块之间不重复相加。[TAP](../../../artifacts/native-agent-expansion/2026-10-18/native-targeted.tap)、[官方源码固定引用与协议](../../../artifacts/native-agent-expansion/2026-10-18/upstream-contracts.json)。

覆盖新会话/原 Session 续聊、只读原请求去重与冲突、失败帧不被成功覆盖、观察重开、unknown占位、Session变化禁续聊、Pi原文件缺失/重复禁续聊、在途旧会话禁用、取消原操作ID/自然成功竞争、忽略SIGTERM与超4MiB帧升级终止、未知adapter拒绝、原生配置覆盖与不支持的MCP拒绝。契约与[骨架检查](../../../examples/custom-agent/check.cjs)明确无真实执行。原生CLI本身未安装验收，三种真实模型、Windows EXE、独立SSH与新增三种MCP/许可/表单未验收。首次sandbox子进程I/O异常及Codex依赖缺失的失败与修正记录见[专项](../../iterations/I07/native-agent-expansion.md)。

## 当前工作区集成基线

T-M06-132：alpha.28加未发布UI/会话补丁，WSL Node22.23.1，受控进程/SQLite/SSH/HTTP/React SSR，模型0。核心45/45、串行全桌面375/375（含既有父/子测试）、lint/根类型/前端类型及构建通过，无测试跳过；保留既有chunk体积提示。共享计数不跨模块相加。[完整命令、原始日志和源码观察清单](../../iterations/I07/integration-baseline.md)。未验证新UI浏览器/Windows EXE、独立SSH或真实模型；模块行为无新改动，发布附件未更新。

## 空白原生Session绑定保护

T-M06-130：alpha.28之后的未发布源码增量，WSL Node22.23.1，受控原生execute/query与真实SQLite，模型0。首次纯空白值不绑定/不自动续接，后续空值不清除已有有效绑定；两个反例修复前失败，修复后相关51/51（含父/子测试）通过，真正Session变化仍受既有反例约束。[证据与复现](../../iterations/I07/blank-native-session.md)。未实测真实CLI返回空值、Windows或独立SSH，未重建EXE；共享计数不跨模块累加。

## Windows恢复专项

T-M06-128：2026-10-17 / WSL Node22.23.1与Windows Node24.19.0 / alpha.27已预发布，模型0。Codex恢复10/10、共享原子写入10/10、网络最终50/50、Windows契约86/86；全桌面最终运行288/288、核心45/45及工程检查通过；新增alpha.26兼容文件另验10/10。共享计数不跨模块累加，Windows为受控目录/执行器，不是用户故障或真实模型。首轮限制/维护ENOENT与未测范围保留；最终普通Windows EXE对合成记录恢复/重开/重启/冻结源码共5组通过，包内33 CJS/78 core/1393 Linux条目一致；发布结果以[当片报告](../../iterations/I06/windows-start-persistence.md)后续实际记录为准。
## Windows原请求上下文恢复

T-M06-126 / M06-F01：alpha.25本地候选，WSL Node22.23.1/Windows Node24.19.0，受控记录，模型0。4个反例修复前全部失败，修复后专项48/48、串行桌面243/243、Windows契约17/17通过，原回执可恢复且缺回执仍unknown。共享计数不跨模块累加，包内33 CJS/78 core/1390 Linux资源一致；alpha.24普通EXE对照3组、alpha.25候选4组通过，原记录均为合成。候选包/普通EXE与失败日志见[专项](../../iterations/I06/windows-context-recovery.md)。未实测用户另一台电脑或真实原生模型，不改变GitHub alpha.24已发布冻结包。

## 真实原会话续接后的权限

T-M06-124：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。三项检查通过，共两次自动回合、手动启动0；阶段2的task/request不同但Conversation/实际原生Session相同，每轮真实权限等待/观察后台重启/精确Write允许后成功。累计attempt/used/Write/权限命令各2，持久事件仅user_start/attention且pending0；完成重查未重派。[证据及复现](../../iterations/I07/resume-native-permission.md)，共享计数不跨模块累加。未测后续轮拒绝、执行成员交接、Windows或独立SSH；未更新包或发布。

## 真实自动主角色首轮权限

T-M06-123：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。两次事件自动原生回合、手动原生启动0，权限等待/观察后台重启、精确Write允许成功/拒绝failed三项检查通过；每项工作attempt/used各1、只有已消费user_start且pending0，原生Write和权限命令各合计2次。首次工具断言遗漏及修正后的只读恢复核对分别保留，[证据与复现](../../iterations/I07/auto-native-permission.md)。不是执行成员交接/原会话续接轮次、Windows或独立SSH，未更新EXE。共享真实证据不跨模块累计。

## 真实原生权限补验

T-M06-122：alpha.24源码工作区，WSL Node22.23.1 / 真实Claude2.1.299。两次手动小队原生调用，等待/观察后台重启、允许隔离Write并成功、拒绝后failed且文件不存在三项检查通过；完成后重复执行脚本只查原记录，每场景attempt1条、权限控制命令合计2次。真实原生证据共享引用，不跨模块重复计数。[报告、复现与限制](../../iterations/I07/native-permission.md)。未测自动权限链、Windows真实模型或独立SSH；未改产品源码/包，以下历史结果保持原日期。

## I07C首批实际验证

T-M06-110 / M06-F04：2026-10-16，WSL Node22.23.1、Windows Node24.18.0/Edge155。核心45/45、最终串行桌面222/222、Windows契约29/29；这些是全工程计数，跨模块不相加。Windows前端/真实Coordinator受控目录和成员10组，真实Claude2.1.299自动主角色3轮同Conversation/原Session、新scope、后台重启后实际X失败/Y通过及终态后总验收；执行成员为受控外部MCP、Node检查实际运行。最终包/普通EXE、首次连接恢复竞态和并行维护ENOENT分别保留证据，完整结果见[I07C首批报告](../../iterations/I07/automation.md)。未证明真实多原生角色、其他接入自动续接、用户自研/独立SSH或完整停止。

## I07B 实际验证

T-M06-101 / M06-F02/M06-F03：2026-10-16，WSL Node22.23.1、Windows Node24.18.0及Edge155。核心45/45、最终桌面208/208、Windows契约18/18；这是全工程计数，不跨模块重复相加。真实Claude两轮手动开发、独立MCP编译连接器实际Node检查X失败/Y通过、MCP协调员验收；Windows生产前端/Coordinator受控目录7组通过、模型0。首次原有daemon启动失败、重查及最终包/普通EXE的实际结果均见[I07B报告](../../iterations/I07/task-handoff.md)。未验证用户自研产品、独立SSH小队链、OpenCode/Codex任务闭环或I07C自动激活。

## I07A 实际验证

2026-10-15 / WSL Node22.23.1、Windows Node24.18.0 / 源码alpha.21，GitHub预发布alpha.20。

| 用例 | 功能 | 结果与证据边界 |
| --- | --- | --- |
| T-M06-100 | M06-F02 | 真实Linux Claude读上下文/发群消息/写文档4项通过；Windows stdio契约7/7通过。其他原生工具仅受影响回归，不升级为真实小队推理验收。 |

原始证据、工程总数及真实工具/界面/普通EXE分别见[I07A交付](../../iterations/I07/delivery.md)。[核心45/45](../../../artifacts/I07A/2026-10-15/root-tests.tap)、[桌面197/197](../../../artifacts/I07A/2026-10-15/desktop-tests.tap)为全工程计数，不在本模块重复相加；I07B/C能力不计为已通过。

## OpenCode 二次发现与 Windows 配置专项

WSL Ubuntu / Node 22.23.1：discovery 3/3（含于核心 45/45），桌面 181/181；受控回归、模型 0。[核心 TAP](../../../artifacts/opencode-discovery/2026-10-14/root-tests.tap)、[桌面 TAP](../../../artifacts/opencode-discovery/2026-10-14/desktop-tests.tap)。Windows 原始报告 UTC 2026-10-14T17:35:28.789Z / Electron Node 24.21.0：真实 PE 版本/解析、旧二次发现失败、修复后原路径核验、配置完整写入与旧revision拒绝、serve受控退出保留NATIVE_EXITED、删除原安装，共6组通过，[实际报告](../../../artifacts/opencode-discovery/2026-10-14/windows.json)。这是隔离PE/进程夹具，无真实OpenCode模型或用户另一台电脑验收。原生Windows完整生命周期和断电持久性未验证。根因、失败原证据、最终包与边界见 [专项](../../iterations/I06/opencode-discovery.md)。

## Linux CLI 发现专项

2026-10-14 / WSL Ubuntu / Node 22.23.1：发现回归 6/6；精简 PATH 下真实 Codex CLI 0.162.1 经生产 daemon/relay、本机隔离 TCP SSH 发现通过，重复规范路径不变，模型 0。受控 SSH 端点与真实 CLI 版本探测分别标明，不计作用户独立服务器升级验收。[发现 TAP](../../../artifacts/linux-cli-discovery/2026-10-14/discovery.tap)、[实际 CLI/SSH 报告](../../../artifacts/linux-cli-discovery/2026-10-14/real-cli-ssh.json)。全工程/包/Windows 实际结果与未测范围见 [专项](../../iterations/I06/linux-cli-discovery.md)，原模型/权限/续聊限制保留。

## 历史专项

2026-10-14 / WSL Ubuntu / Node 22.23.1 / 源码 0.6.0-alpha.18：共享缓存自引用/旧清单/损坏旁路重建、Windows OpenCode 原意图恢复与并发保护、查询结果和脱敏原因；定向 55/55（计入桌面全量 176/176），根 43/43，lint/类型/构建通过。受控文件/宿主测试，无模型调用。原始证据：[定向](../../../artifacts/runtime-recovery/2026-10-14/targeted.tap)、[全桌面](../../../artifacts/runtime-recovery/2026-10-14/desktop-tests.tap)。Windows 真实 Electron 资源 4 组、Edge 受控 UI 3 组、普通无调试 EXE/合成原意图与关闭重开 4 组均通过；包校验 28 CJS / 1383 Linux 文件与当前源码匹配。详细过程及边界按 [完整专项](../../iterations/I06/runtime-recovery.md) 的实际结果判定，不将历史原生证据提升为本次重测。

更新日期：2026-10-12。对应[模块设计](design.md)。本报告区分当前源码的受控回归、历史真实工具实验和未完成的产品发布验证。

## 1. 基线与结论

当前源码版本 `0.6.0-alpha.4`；稳定历史 EXE `0.5.0`、先前候选 `0.6.0-alpha.2`。2026-10-12 发现修复的桌面回归 **89/89**，失败和跳过均为 0；核心 **43/43**为先前未改动部分基线，未在本次重跑。本次实际调用原生 Codex/Claude 验证自然语言发现，详见子报告。全部工程测试通过不能证明每个原生版本、账号或 Windows 新发布包可用。

- [核心 TAP](../../../artifacts/docs-baseline/2026-10-12/root-tests.tap)
- [桌面 TAP](../../../artifacts/codex-discovery/2026-10-12/desktop-tests.tap)

## 2. 分模块结果

| 测试 ID | 对应功能 | 验证与证据级别 | 结果 | 限制 |
| --- | --- | --- | --- | --- |
| T-M06-01 | M06-F01 原生配置继承 | `tests/native-cli-default.test.ts` 受控原生 HTTP；Claude/Codex 专用测试检查启动参数；MachineHost 拒绝覆盖实现审查 | 当前回归通过 | 旧实例 API 保留兼容覆盖，不能按该路径推断当前节点行为 |
| T-M06-OC-01–08 | M06-OC-F01 | [OpenCode 报告](opencode/test-report.md)：HTTP 契约、原生/OS 故障、历史真实 OpenCode | 受控回归通过；已有真实回复、续聊、权限/取消证据 | 远端 2.0.26 两轮未保存 native Session ID 比较；限工具验证仅允许 2.0.24 |
| T-M06-CC-01–08 | M06-CC-F01 | [Claude 报告](claude/test-report.md)：原生 JSONL 夹具 + 真实 Windows CLI | 16 项宿主回归通过；历史真实回复/权限/取消通过 | 表单不支持；当前源码和新 Windows 包尚未做全量真实复验 |
| T-M06-CX-01–07 | M06-CX-F01 | [Codex 报告](codex/test-report.md)：原生 JSONL 夹具 + 真实 Windows/WSL CLI | 4 项宿主回归通过；WSL 自然语言发现、真实委派和连接图通过 | WSL 原生续聊失败；Windows 原配置模型被账号拒绝 |
| T-M06-02 | M06-F01 原始事件与可读输出 | [I04F streaming UI](../../../artifacts/I04F-streaming-ui.json) 与 [conversation UI](../../../artifacts/I04F-conversation-ui.json)，隔离前端 Mock | 历史 UI 检查通过；当前聚合实现存在 | Mock 不证明真实模型产出和刷新延迟；当前基线不重跑该 UI 脚本 |
| T-M06-03 | M06-F01 主 Agent 真实工具调用 | [I05-real.json](../../../artifacts/I05-real.json)、[I05-codex-main.json](../../../artifacts/I05-codex-main.json)，真实 CLI/MCP | 4 条核心双向链通过 | I05 总报告保留 partial；不是当前跨物理机器双向协作验收 |

功能 ID 是稳定追踪入口，表内范围不是一次测试执行的计数。核心 43 与桌面 89 是整个工程数字，不能相加后称为本模块专用测试数。

## 3. 真实证据的适用范围

| 证据日期 | 环境 | 实际已验证 | 应保留的边界 |
| --- | --- | --- | --- |
| 2026-10-08 | Linux/WSL OpenCode 2.0.24 | 三轮同 Session、取消、原生服务重用、只读恢复、CLI 权限与文本表单链路 | 模型自主生成表单未核验；是该日期的真实结果 |
| 2026-10-09 | Windows Claude + 同宿主 WSL OpenCode | 双工具两轮、原 Session、Claude Write 审批和取消 | 测试隔离实例曾覆盖模型；不是当前所有继承行为的证据 |
| 2026-10-10 | Windows Claude 2.1.296、WSL OpenCode 2.0.24/Codex 0.161.0 | 原生默认回复、Claude/OpenCode 续聊、4 条主子协作链 | Windows Codex 原模型被拒绝；WSL Codex `list_turns` 续聊未通过 |
| 2026-10-10 | 开发机连接独立 Linux OpenCode 2.0.26 | 远端发现、新会话、按原 conversationId 续聊、断线期间完成和重连读取 | 未记录两轮 native Session ID 比较；未完成新 Windows 发布包验证 |

详细历史范围见 [I03B 验收](../../iterations/I03B/report.md)、[I04B 验收](../../iterations/I04B/report.md)、[I05 验收](../../iterations/I05/acceptance.md)和 [I06 当前核对](../../iterations/I06/progress.md)。它们解释变更过程，本报告负责给出模块当前可依赖的事实。

## 4. 待补验收与完成标准

| 项目 | 当前状态 | 完成标准 |
| --- | --- | --- |
| alpha.3 Windows 修复包 | 资源比对、普通启动/关闭/重开通过 | [普通 EXE](../../../artifacts/codex-discovery/2026-10-12/portable.json)未提交模型需求；alpha.2 的 SSH 历史适用范围保留，未重跑完整原生专项 |
| 远端原生续聊身份 | 缺直接比较证据 | 两轮分别保存 native Session ID，断言相等，并证明第二轮使用第一轮上下文 |
| Codex 原生续聊 | WSL 已知失败 | 合适原生版本真实 `exec resume` 成功且 thread ID 不变；失败仍原样显示 |
| Codex 许可/表单 | 未适配 | 单独设计协议、审批策略和失败边界；不得用自动批准替代 |
| Claude 结构化问题 | 未适配 | 独立实现 AskUserQuestion 回应和收据测试；之前保持明确拒绝 |
| 升级原生版本 | 按具体版本补核验 | 至少真实新会话、同会话、取消/等待、配置继承和异常恢复；版本更高不自动等于兼容 |

## 5. 复现与维护

工程回归使用 `npm test`、`npm test --prefix desktop`。专用测试可按子模块报告运行。真实脚本会调用用户已有的模型并可能执行受控文件操作，必须在隔离目录下按相应验收场景运行；不能把 fixture 回复登记为真实工具验收。

修改代码时同时更新设计中的能力边界和本报告：写明测试命令、日期、原生版本、证据类型、通过/失败/未测、产物链接以及剩余问题；对应迭代也保存需求和交付状态。

I06B alpha.6：共享 MachineHost 的原生就绪等待受控通过，connect/两次 snapshot、Prompt=0；案例共享 T-M03-16，不新增 Driver 真模型通过声明。[测试](../../../desktop/tests/machine-host-readiness.test.cjs)、[本次全桌面 110/110](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)。

## 当前验证

T-M06-13 / M06-F01：2026-10-14，WSL Ubuntu / Node 22.23.1，桌面受控回归 **150/150** 通过（全工程总数，模块之间不重复相加）。场景：原生 Driver 与账号/模型继承方式不变。daemon/Coordinator 只接受原控制操作和原 execution/task 的可核对收据；原生 unknown、外来 operationId、缺收据不会变成成功。表单秘密答案在 UI 遮罩、中央台账脱敏；适配器自身原生能力仍以各子模块报告为准，未支持交互不假成功。

证据：[完整桌面 TAP](../../../artifacts/I06C-final/2026-10-14/desktop-alpha13.tap)、[维护实际 daemon/process 7 项](../../../artifacts/I06C-final/2026-10-13/maintenance-tests.tap)、[包内容核验](../../../artifacts/I06C-final/2026-10-14/package-alpha13.json)。维护测试使用真实生产 daemon、Unix socket、独立进程和磁盘，原生 host 受控、无模型调用；不能替代独立服务器或真实原生控制。Windows 窗口、原生 Session 与双向链、使用/卸载、命令和限制统一见 [逐项验收](../../iterations/I06/final-delivery.md)，未实际执行项不得计为通过。

## 本次独立实机补充

2026-10-14：冻结 alpha.13 Windows 包与独立 Linux，真实升级、同原生 Session 两轮及两方向协作通过；真实 Windows 取消和普通无调试窗口原生标记分别通过。独立 SSH/生产 daemon 的精确响应丢失、10 同 ID 与重启为受控执行器证据，不充当真实模型。Linux 文件任务受原生 OOM 退出影响，原 ID/Session 与 unknown 占位保留，未准出、未重发；后续 alpha.14 上传专项不冒充此模型矩阵复测。逐场景原始证据、版本、实际失败、临时自有资源调度及剩余项见 [I06C 当前实机记录](../../iterations/I06/final-delivery.md)。

本专项工程补验：桌面 181/181、核心基线 43/43、lint/类型/构建通过；包内私有 Linux Node 的真实 CLI 版本探测复验通过，Windows EXE 已构建并核对资源，详见上述专项“实际验证”。不计为用户服务器升级或模型任务验收。

2026-10-15 alpha.19 合并包复验：核心45/45、桌面181/181、lint/类型/构建通过；发布资源真实 Linux Codex0.162.1发现、Windows受控扫描/配置6组、普通EXE4组通过。最终包摘要和未测边界统一见 [Linux/合并包专项](../../iterations/I06/linux-cli-discovery.md)；未实测用户服务器或真实模型任务。

## Codex明确错误终态

T-M06-CX-08 / M06-CX-F01：alpha.22源码工作区，WSL Linux / Node22.23.1，受控CLI/worker及磁盘、模型0。错误前后混合完成事件且退出0均保持failed；重开原请求仍失败，同ID不重复调用。修复前失败证据、修复后Codex/小队专项23/23（工程共享总数）和未测边界见[专项](../../iterations/I07/codex-terminal.md)。未重建EXE、未验证真实原生续接或I07C激活。
