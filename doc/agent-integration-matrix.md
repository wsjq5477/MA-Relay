# Agent 接入现状与后续目标

当前公开alpha.68：关系冲突只读诊断、连续原收据提案与明确确认后的备份/原子恢复，v3旧后台启动/复用门禁；原生启动、Hermes分离和Pi会话目录保护、离线字体与界面改进已收录。源码/EXE/SHA公开并匿名完整下载一致；定向137/137、冻结后台16/16、Ubuntu Core71/71与适配110/110、普通EXE隔离恢复与完整重启通过。桌面全量926通过/74失败/1跳过，文档2243缺失及Zod 1项high保留；未签名，真实profile、父模型/取消/性能和完整矩阵未准出。[发布与完整边界](iterations/I08/alpha68-release.md)。

Windows原生执行证据保持原日期；本轮Linux正式安装版已完成两轮实际执行、原ID去重与同Session续聊，验收采用临时网络通道，原配置保持。没有部署独立SSH；各入口实际方式与证据边界以下表为准。

## 当前源码接入总览

Hermes/Pi/DSH CLI未发布源码补齐[启动前失败边界](iterations/I08/native-start-boundary.md)：实际启动器解析拒绝或spawn前error才可结算failed/NATIVE_START，原控制收据nativeExited=false；已启动失联和历史unknown不因当前安装缺失释放。此判断不扩大原生取消、MCP或托管scope能力。

Hermes未发布源码补齐[等待输入的分离保护](iterations/I08/hermes-detached-input.md)：有限查看器退出3/130保持原unknown，Windows受控和未修改0.22.5查看器/输出组件已验；真实审批等待/网关恢复与取消仍未适配/未准出，当前公开alpha.67不含此修复。

阅读顺序：本页登记“每个Agent已接了哪些方式”；[接入方式、选型与快速接入](agent-integration-guide.md)说明六种方式的优缺点、功能条件和逐Agent后续推荐；[开发指南](custom-agent-development.md)提供当前可执行的适配步骤与验证命令。

本表已核对当前静态注册表：七种产品、十个执行入口。Claude/Codex/Hermes/Pi与DSH CLI使用各自原生CLI；OpenCode由CLI启动服务后走HTTP；DSH Desktop/Web连接用户已运行且认证的HTTP服务。OpenDesk CLI由原生serve提供HTTP控制，Windows Desktop沿用当前实例WebSocket网关；独立MCP配置与托管scope分开。当前没有内置ACP驱动，也没有用厂家SDK驱动这些入口。Agent调用Bridge则走另一方向的stdio MCP；不能把两种方向统称为“MCP接入”。

DSH新增的Desktop/Web已随alpha.46公开，Desktop原生MCP配置适配属于alpha.48候选，支持直接执行和普通被委派，MCP调用能力与原生配置、托管scope分开判定；不声明已完成真实主调用或小队成员验收。当前在原Agent行的配置弹窗提供独立的服务连接卡，MCP管理与其他Agent共用同一配置入口。模型、供应商、原生权限不由此配置卡管理。[完整协议、当前设置流程与证据](iterations/I07/dsh-desktop-web.md)。

发现时排除Linux同名Distributed Shell，原`/usr/bin/dsh`错误不代表DSH Web连接失败。当前源码可按已安装Desktop或Linux Web profile显示未配置服务提示；须在对应机器配置根地址/token后验证连接，旧alpha.34 EXE没有Desktop/Web入口。[现场核对与修复](iterations/I07/dsh-desktop-web.md#同名程序与服务发现修复)。

后续规划见[Agent侧自主操作与通用调用方规划](iterations/I07/agent-centric-operations.md)：CT-06逐工具核对Hermes/Pi/DSH（含DSH服务入口）原生MCP客户端与插件扩展点后接入通用调用方、CT-07补Agent侧连接操作面、CT-08将单主关系泛化为按身份多关系并加受确认流保护的连接管理；均登记在本页§4后续目标，CT-07已补只读委派列表和[当前调用方连接视图](iterations/I07/agent-connections.md)及[子任务最小上下文](iterations/I07/delegation-context.md)（本地源码10工具、受控验证），CT-06首片已落地（能力三维拆分、`mcp.revoke`/`mcp.probe`、DSH Web原生适配、非GUI`agentbridge mcp`），逐入口真实原生验收仍未完成；CT-08已补[A3连接策略](iterations/I07/connection-policy.md)，含Agent连接工具、预授权/用户确认与各主策略/审计界面，旧图仍selected；真实原生多主未验。插件仅作无MCP客户端时的薄传输缺口填补。

## 1. 目标与统计口径

用户明确：AgentBridge 的核心是给 Agent 提供发现、调用、观察和控制其他 Agent 的通路。自动续接、多用户不作为后续目标；已有相关实现和历史证据保留，不用其完整度衡量连接产品的完成度。模型、Skill、业务规划和原生内部记忆由原 Agent 管理。

“适配程度”按具体能力和证据记录，不用没有权重依据的百分比。必须区分以下方向：

| 方向 | 含义 | 当前实现 |
| --- | --- | --- |
| Bridge → Agent | 驱动原生程序执行需求、读取结果、控制原任务 | 原生 CLI 或 HTTP 适配器；七种产品共十个入口，目前没有内置 ACP 或厂家 SDK 驱动 |
| Agent → Bridge | Agent 调用发现、委派、结果和协作操作 | Bridge 提供 stdio MCP 服务，注入受限会话或由外部 Agent 自行配置 |
| Bridge → 目标机器 | 把执行与协作消息送到相应机器后台 | 本机 IPC、WSL JSONL、SSH relay/daemon；不要求 Agent 直接互开网络端口 |

MCP 接入不自动赋予 Bridge 启动或取消该外部 Agent 的能力；被 Bridge 驱动也不自动说明该 Agent 能调用 Bridge MCP。

## 2. 每个 Agent 已接入的方式

下表按接入方式分列，只登记AgentBridge当前实际实现的路径，不推断原生Agent本身支持什么。“已接入”指源码存在，不等于真实工具/模型或发布包验收；DSH Desktop/Web仍未进入公开alpha.34。

| Agent / 入口 | 原生 CLI | 原生 API | MCP | ACP | 插件 | 厂家 SDK |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Code | 已接入：stream-json | 未接入 | 已接入 | 未接入 | 未接入 | 未接入 |
| OpenCode | 已接入：启动serve | 已接入：HTTP执行/控制 | 已接入 | 未接入 | 未接入 | 未接入 |
| Codex | 已接入：exec/resume JSON | 未接入 | 已接入 | 未接入 | 未接入 | 未接入 |
| Hermes Agent | 已接入：stream-json | 未接入 | 已接入：原生Profile YAML（当前公开alpha.67） | 未接入 | 未接入 | 未接入 |
| Pi | 已接入：JSON/print | 未接入 | 已接入：用户mcp.json（当前公开alpha.67） | 未接入 | 未接入 | 未接入 |
| DSH CLI | 已接入：headless JSON | 未接入 | 已接入：原生显式profile补丁 | 未接入 | 未接入 | 未接入 |
| DSH Windows Desktop | 未接入该入口的CLI | 已接入：认证HTTP Session API | 已接入：原生Profile补丁（alpha.48候选） | 未接入 | 未接入 | 未接入 |
| DSH Linux / WSL Web | 未接入该入口的CLI | 已接入：认证HTTP Session API | 已接入：原生web Profile补丁 | 未接入 | 未接入 | 未接入 |
| OpenDesk CLI | 已接入：启动serve | 已接入（源码）：已有HTTP会话接口 | 已接入：仅片段导出，无原生配置管理/托管scope | 未接入 | 未接入 | 未接入 |
| OpenDesk Windows Desktop | 未接入该入口的CLI | 已接入（源码）：已有WebSocket设备网关 | 已接入：独立原生配置，未注入托管scope | 未接入 | 未接入 | 未接入 |

各列含义：

- **原生CLI / 原生API / ACP / 厂家SDK**：Bridge调用Agent的具体路径。OpenCode两列同时已接入，因为CLI负责启动，HTTP API负责执行与控制。
- **MCP**：Agent作为MCP客户端调用Bridge的通路，包含托管任务scope注入和已适配的原生配置管理；不是Bridge通过MCP控制该Agent。其他Agent仍可通过Bridge的MCP委派DSH，末段由DSH的CLI或HTTP驱动执行。本表的MCP列表示“Bridge已实现该方向的适配”，不等于该入口的原生客户端已实际读取配置：OpenDesk Desktop已有原生读取、授权只读查询和组件委派证据，但自主父模型委派仍未验，以能力表行为准（见[本轮§12](iterations/I08/mcp-open-integration.md#12-真实原生探测补充2026-10-22-晚)）。
- **插件**：在原生Agent内部安装Bridge专用插件作为连接实现。当前没有这种接入；Bridge内部静态adapter注册、DSH原生已安装的业务插件、MCP配置条目均不计作此列的插件。
- **未接入**：当前Bridge没有实现这条路径，不代表厂商不支持、也不代表该Agent整体不可用。各入口的真实覆盖与限制另见下表。

### 能力、证据与后续目标

| Agent / 入口 | 当前执行与协作能力 | 实际证据与版本边界 | 后续连接目标 |
| --- | --- | --- | --- |
| Claude Code | 直接执行：已实现；MCP调用方：已实现，可作为主节点及小队成员；原生MCP配置：Bridge可管理（写`mcpServers.agentbridge`）；托管scope注入：已实现；被委派：已实现并有真实证据 | 真实直接生命周期与当前WSL双向普通委派均通过；三真实角色公共文档链及历史权限证据保留；结构化AskUserQuestion当前拒绝；2026-10-22受控profile下真实`claude`：Bridge写入后`claude mcp list`报Connected、工具目录7项（零模型，非用户profile） | 保持原通路，核验当前版本、跨机的发现/执行/等待/取消/恢复；按实际需求补输入类型 |
| OpenCode | 直接执行：已实现；MCP调用方：已实现，可作为主节点及手动小队成员；原生MCP配置：Bridge可管理（v1/v2两代布局）；托管scope注入：已实现；被委派：已实现并有真实证据 | 真实直接生命周期与当前WSL双向普通委派通过；permission/form及独立Linux与Windows Claude双向协作保留历史证据；原生版本契约有约束 | 作为Bridge通用ACP Client的首个目标Agent，比较现有HTTP路径的事件、权限与恢复效果 |
| Codex | 直接执行：已实现；MCP调用方：已实现，可作为主节点及手动小队成员；原生MCP配置：Bridge可管理（`mcp_servers.agentbridge`标记块）；托管scope注入：已实现；被委派：已实现并有真实证据，具体环境见报告 | 当前WSL0.163.0-alpha.10.2直接生命周期及双向普通委派通过；旧版本续聊、Windows原账号失败保留；Bridge权限/表单未适配 | 验证当前原生版本的执行/结果/取消/恢复；有实际控制缺口时比较原生交互接口和 ACP 生态包装器 |
| Hermes Agent | 直接执行、原Session续聊与普通被委派已实现；Windows/Linux原安装发现及独立MCP/Profile YAML已包含；托管scope/小队与网关取消未适配 | Linux正式0.22.5本轮两轮实际成功、原ID去重及通道重开/同Session续聊，原配置字节保持；独立Ubuntu原生MCP五组/十工具通过，组件模型0；普通EXE七组模型0 | 自主父模型/跨Agent委派、原生网关取消、完整生命周期与SSH未准出；[本轮证据](iterations/I08/alpha67-hermes-linux-live.md) |
| Pi | 直接执行与普通被委派：源码已实现；独立MCP/用户配置：当前公开alpha.67已包含；托管scope：未适配；未发布源码新增续聊前核对原Session文件cwd与原上下文 | 官方Pi1.4.0原包Linux/Windows在公开60冻结后台上各7组通过，实际消费10工具和连接/确认/撤权，模型0；[MCP原生组件](iterations/I08/native-policy-components.md)。当前源码Windows宿主/核对56/56及原包SessionManager目录绑定三组通过，模型0；[本轮证据](iterations/I08/pi-session-workspace.md) | 原Session文件与目录必须共同保持；真实父模型/生命周期/SSH待验 |
| DeepSeek Harness（DSH） | 直接执行：源码已实现；MCP调用方：已声明有MCP客户端（可独立配置）；原生MCP配置：**有，但需显式指定启动 profile**（`$DSH_HOME/profiles/<profile>/cordis.patch.yml` 单行`insert:`）；托管scope注入：未适配；被委派：同 Hermes | 使用 headless 自身原生配置，不搬运 web profile 凭据；profile 名称由用户提供并按单段目录校验（`MCP_DSH_PROFILE_REQUIRED` 拒绝非法/缺失值），未指定时只可导出；受控测试覆盖写入仅目标profile、status回显、remove只清理该profile；**真实 `dsh --profile acp` 启动观测到原生加载+`initialize`握手+`tools/list`（7工具，模型0，受控scratch profile）**；TUI/用户自建profile与真实用户profile未观测 | 在真实 `dsh` CLI 启动中核对指定 profile 是否加载该条目并列出工具；先验原生 headless 协议与真实模型 |
| DSH Windows Desktop（dsh-desktop） | 直接执行：已随公开alpha.46实现；MCP调用方：已声明有MCP客户端；原生MCP配置：alpha.48候选按Desktop原生数据目录/Profile选择记录管理，保存原目标绑定，切换后先移除再添加（当前公开版已包含）；托管scope注入：未适配；被委派：可接收普通委派；方向能力为受控证据 | Windows社区Desktop2.0.18历史真实认证/Session接口及同Session两轮去重已观察，模型RATE_LIMIT；本轮已安装未修改Desktop原生配置组合器与MCP客户端5组/生产前端4组通过（模型0），[完整证据](iterations/I08/dsh-desktop-mcp.md) | 待原生限流解除后补成功回答/真实取消；[DSH原生证据](iterations/I07/dsh-exe-delivery.md) |
| DSH Linux / WSL Web（dsh-web） | 直接执行：源码已实现，未进入公开发布包；MCP调用方：已声明（可独立配置）；原生MCP配置：**Bridge可管理且原生会加载**（`$DSH_HOME/profiles/web/cordis.patch.yml` 单行`insert:`，插件`@deepseek-ai/dsh-mcp-client`）；托管scope注入：未适配；被委派：同Desktop入口 | WSL真实Web认证/Session列表通过；生命周期/恢复为受控服务，模型0，独立SSH未验；2026-10-22受控profile下真实DSH `--profile web --dump-config` 组合出Bridge写入行，且真实启动后原生客户端完成 `initialize`/`tools/list` 握手、Bridge返回7个工具（模型0）；原生UI人工可见/删除与真实用户profile未验 | 保存对应机器连接后补模型/续聊/取消验证；[DSH原生证据与边界](iterations/I07/dsh-exe-delivery.md) |
| OpenDesk CLI（opendesk） | 直接执行、普通被委派、原连接可用时续聊、发送取消请求已实现；MCP调用方：**未确认**（无原生读取/MCP客户端真实证据），暂不按主 Agent 的 MCP 调用能力交付；托管scope注入：未适配并单独拒绝；**原生MCP配置：无可用入口**——0.3.8 的 `opendesk plugins list` 11 个 builtin 插件无 MCP 管理插件、`opendesk plugins tools` 无插件工具、`opendesk tools list` 无MCP分区，且启动会重写 `setting.json` 丢弃未识别 `applications` 段，因此 Bridge 只能导出片段；小队、Bridge权限/表单未开放 |
| OpenDesk Windows Desktop（opendesk-desktop） | 同上执行/委派/续聊/取消；托管scope注入：未适配并单独拒绝；**原生MCP配置：可用，但需要 Node 启动器，写入前须从托盘完全退出 OpenDesk、写入后再打开**——写 `%APPDATA%\opendesk\setting.json` 的 `applications.mcpmgr.servers`，条目优先用 PATH 中真实 Node（`launcher:'node'`），Electron 回退时 OpenDesk 无法启动（`launcher:'electron'` 并在界面提示先装 Node）；MCP调用方：**原生已加载+已连接+7工具可见**（用户真实 Desktop 0.3.9，模型0，日志 `discovered 7 tools`），同日已安装原生组件正式授权调用及独立主角色→真实Claude子任务已验（各自生产身份/原结果，受控父进程），日常原生父模型实际 `list_agents` 1 次成功、返回7个获准节点，[现场恢复与发现](iterations/I08/opendesk-mcp-diagnostic-repair.md)；**原生父模型自主委派与日常原生页面未验**；小队、Bridge权限/表单未开放 | 使用未修改的原HTTP/桌面网关；去重和原回应由Bridge保存，断线/取消无证明时unknown；Desktop 0.3.9原实例真实回复/续聊及普通EXE窗口重开通过，[现场证据](iterations/I08/opendesk-desktop-live.md)；真实取消/MCP、CLI模型与SSH未验；包边界见[专项](iterations/I08/opendesk-existing-interfaces.md) | 桌面原连接断开后不可续聊，任务沿用原生目录；独立MCP与托管scope分开 |
| 自研原生 Agent | 直接执行：需开发适配器；MCP调用方：需另外实现并验收 MCP 注入；被委派：完成执行适配后才可验证 | 已有注册契约、指南和零执行示例；OpenDesk专用实现及边界见上一行；其他产品尚无实测，不支持填任意命令/地址即接入 | 形成一个实际可运行的参考适配器；若目标支持 ACP，优先复用拟议通用 Client |
| 外部 Agent 自行连接 Bridge MCP | 直接执行：不等于直接执行接入；MCP调用方：已有本机 TeamSpace 接入，读写文档/消息/任务；被委派：不能据 MCP 接入推定 Bridge 可启动/取消外部执行 | 外部入口有受控stdio连接器/生产broker证据；真实Claude小队证据来自原生注入路径，不能替代外部自研产品验收 | 明确展示“可协作读写”和“可执行控制”两种能力，验证真实外部产品入口 |

自研Agent需要另行实现并验收适配器；外部Agent已可自行配置Bridge MCP，但不能据此推定它具有本表其他执行路径。[DSH API选型原因与功能边界](iterations/I07/dsh-desktop-web.md#为什么选择原生-api)。

Hermes/Pi/DSH 的重要区别：`hostManagedTask=false` 阻止的是作用域/MCP 注入（旧投影名`teamCollaboration`），与“是否有MCP客户端”“能否作主”“能否被委派”是三件不同的事。经典 `delegate` 在 [AgentNetwork](../desktop/electron/agent-network.cjs) 中提交 `collaboration:false` 的普通子任务，不需要给子 Agent 注入 MCP。因此不能把“不能注入托管scope”写成“不能作为 MCP 调用方”或“不能被委派”。CT-01已统一关系保存、新协作执行、MCP委派及界面源/目标方向准入；三工具通过生产Coordinator/MCP/broker/MachineHost与受控原生子进程的普通委派、取消、恢复和去重测试，仍无真实工具委派或当前EXE证据。节点与MCP返回八项三态能力和静态来源，静态声明不是现场推理证明；原拒绝只凭匹配原operationId收据结算。[能力与恢复完整契约](iterations/I07/connection-capabilities.md)。

## 3. 控制与上下文能力

| 能力 | Claude | OpenCode | Codex | Hermes / Pi / DSH（CLI及Desktop/Web） |
| --- | --- | --- | --- | --- |
| 新建真实原生任务 | 已实现，有真实证据 | 已实现，有真实证据 | 已实现，有真实/失败环境记录 | 已实现，仅受控证据 |
| 原生同会话续聊 | 已实现，当前WSL真实通过 | 已实现，当前WSL真实通过 | 当前WSL0.163.0-alpha.10.2真实通过；旧版本失败保留 | 已实现，仅受控证据 |
| 读取实际任务结果/错误 | 已实现 | 已实现 | 已实现 | 已实现 |
| Bridge 权限回复 | 已实现，具体控制类型见报告 | 已实现，受原生版本契约限制 | 未适配 | 未适配 |
| Bridge 结构化输入表单 | AskUserQuestion 当前拒绝 | 已实现受支持类型 | 未适配 | 未适配 |
| 取消与终态核对 | 已实现，有限定真实证据 | 已实现，有限定真实证据 | 进程树/进程组控制已实现，覆盖见报告 | Hermes网关取消未适配，false；Pi/DSH原实现与证据保留 |
| 原请求持久查询与 unknown 保护 | 已实现 | 已实现 | 已实现 | 已实现 |
| 当前内置 ACP 驱动 | 无 | 无 | 无 | 无 |

经典MCP（本地60源码10项、公开53为7项）里的 `delegate` 发起新的子会话，没有父完整历史复制；当前也没有给已委派子会话发送后续普通消息的工具。用户未将这项扩展列为优先目标，不以此否定现有任务通路。TeamSpace 的公共材料与某个原生 Agent 的私有对话是不同层，不能混为“共享了所有上下文”。

## 4. 后续目标与完成条件

以下区分实际完成的源码切片与后续目标。CT-01源码/受控验收已完成；其余目标不因写入本表变为已实现，也未部署或发布。

| 目标 | 关联既有功能 | 交付内容 | 完成条件 |
| --- | --- | --- | --- |
| CT-01 能力口径一致 | AB-F02/07/10/13；M01/M02/M03/M06/M07/M08 | 源码已实现八项三态能力、静态来源与方向门禁，原关系拒绝可恢复 | 源码/受控验收通过：桌面503/503、核心45/45、Windows5组；真实新工具/新EXE/独立SSH未验，[完整证据](iterations/I07/connection-capabilities.md) |
| CT-02 六种原生连接实测 | AB-F07/10/11/13；M06/M07/M08 | 三工具当前WSL[直接生命周期](iterations/I07/connection-native.md)及全部六个[真实普通委派方向](iterations/I07/connection-delegation.md)通过 | 部分完成；新三工具真实环境、新EXE及独立SSH未验；不以旧包或历史权限覆盖当前所有场景 |
| CT-03 可选 ACP 试点 | AB-F07/10/11；M06/M07/M10 | OpenCode 的可选 ACP Client，保留现有驱动 | 同需求下执行/输出/权限/取消/重连不回归；原请求不重发；至少另一种 ACP 实现验证适配层复用后再扩大 |
| CT-04 公共工作材料与 MD 视图 | AB-F20/21；M01/M02/M06/M07/M08 | 源码已实现只读索引/Markdown与准确修订，桌面阅读/复制/当前页索引或单份MD下载已补；CT-05只读选材包已补，完整产物/交接视图与同步待开发 | 桌面入口541/541及Windows八组通过、模型0；较早真实Claude一个Task保留原证据。MD是视图，授权、任务/收据和可达性分别核对；[完整证据](iterations/I07/public-materials.md) |
| CT-05 显式共享上下文 | AB-F08/11/20/21；M01/M02/M06/M07/M08 | 公开alpha.63实现同工作原包持久传递、目标接入收据和桌面只读审计；原选材/预览/本机副本保留 | 当前源码944/944，冻结63原生Pi→固定源码Hermes组件7组已通过，模型0；接入收据不代表模型理解、业务验收或文件可达，Windows包内14项/新审计页面5组/普通EXE6组通过，完整CT-05继续核对。[当前传递与证据](iterations/I07/context-delivery.md) |
| CT-06 通用MCP调用方 | AB-F02/07/08/11/12/13；M01/M02/M03/M06/M07/M08 | 按[I08-MCP02开发记录](iterations/I08/mcp-open-integration.md)推进同一MCP的Bridge/原生双向管理、原生列表可见和实际调用；优先OpenDesk/DSH，覆盖当前十入口；配置、独立调用与托管任务能力拆分 | **源码第一片已完成**（能力三维、六项状态事实、`mcp.revoke`/`mcp.probe`、DSH Web原生适配、非GUI CLI、Linux本机路由）；逐入口真实原生增删/列表/工具/主调用归属仍待执行，外部删除不补回与撤权已受控验证。不因实现或静态声明当通过，不强制等待完整I07C；旧[规划](iterations/I07/agent-centric-operations.md)保留历史 |
| CT-07 Agent侧连接操作面 | AB-F02/07/08/10/11/13；M01/M03/M07/M08 | list_agents按原身份返回当前获准连接；list_delegations只读查原委派；普通子会话附最小说明 | 三项已源码/受控覆盖，最新冻结667/667、定向121/121及Windows36/36，模型0。身份、撤权、原请求和无新增工具授权保持；[最新上下文与首次失败](iterations/I07/delegation-context.md)。整合包/真实消费及完整I06C/I07C未准出；[完整目标](iterations/I07/agent-centric-operations.md) |
| CT-08 多主关系与连接管理 | AB-F02/07/08/10/11/12/13；M01/M03/M07/M08 | 单主collaboration关系泛化为按身份relations[]并迁移；新增list_connectable/connect_agent/disconnect_agent与envelope预授权及确认流；Bridge界面收缩为接入配置、策略与审计 | 关系重构与行为变更分片验收，旧数据迁移可核对；Agent不能自批envelope外关系，撤权即时生效；data-model/protocol同轮同步。A3已随60公开；alpha.62收敛配置/审计与原执行恢复，Pi双平台/Hermes原生组件已验；真实父模型与日常多主待验；[本片证据](iterations/I07/connection-policy.md)，[完整定义](iterations/I07/agent-centric-operations.md) |

CT-01已完成所列源码/受控范围；CT-02旧三工具WSL直接生命周期与六个委派方向已实测，新三工具仍待真实环境。CT-04桌面阅读/复制/MD下载已补，继续材料交接；CT-05只读API/MCP及桌面选材/核对导出已补，明确持久传递/目标接入收件已补，真实父模型消费及完整CT-05仍待验，CT-03用试点证据决定是否扩大。CT-06/CT-07/CT-08按分片推进（[Agent侧自主操作](iterations/I07/agent-centric-operations.md)），CT-07只读委派列表及当前调用方连接视图已源码实现，[子会话上下文](iterations/I07/delegation-context.md)也已源码实现，CT-08-A3连接工具/预授权/用户确认及策略审计已本地实现；CT-06完整原生消费、CT-08低频操作面已在[本地alpha.62](iterations/I07/configuration-console.md)收敛为配置/审计与显式原执行恢复；真实原生父模型/日常多主仍待完成；I07C六工具真实覆盖与DSH原实例验证仍是CT-06的前置。自动续接、多用户、模型管理、云平台和全套外部产品工作流不作为此表的目标。

## 5. 核对入口与证据

- 原生注册：[builtin-adapters.cjs](../desktop/electron/builtin-adapters.cjs)、[MachineHost](../desktop/electron/machine-host.cjs)、[自研指南](custom-agent-development.md)。
- DSH服务协议：[认证、连接与发现](../desktop/electron/dsh-connection.cjs)、[原请求轮次观察](../desktop/electron/dsh-worker.cjs)、[当前交付与使用](iterations/I07/dsh-desktop-web.md)。Desktop/Web共用HTTP协议，原headless CLI独立保留。
- 原生协议：[ClaudeHost](../desktop/electron/claude-host.cjs)、[CodexHost](../desktop/electron/codex-host.cjs)、[OpenCode HTTP 客户端](../src/drivers/opencode-client.ts)、[服务启动](../src/native-server.ts)、[新增 CLI 协议](../desktop/electron/native-cli-protocols.cjs)。Claude 的 `sdk-ts` 环境标记不能作为采用 Claude Agent SDK 的证据。
- Agent 调用入口：[MCP 服务实现](../desktop/electron/mcp-client.cjs)、[受限 broker](../desktop/electron/collaboration-broker.cjs)、[路由与任务归属](../desktop/electron/agent-network.cjs)、[TeamSpace](../desktop/electron/team-space.cjs)。`mcp-client.cjs` 虽沿用旧文件名，对原生 Agent 这一侧实际响应 MCP server 方法。
- 实际覆盖：[M06报告](modules/06-native-adapters/test-report.md)、[Claude报告](modules/06-native-adapters/claude/test-report.md)、[OpenCode报告](modules/06-native-adapters/opencode/test-report.md)、[Codex报告](modules/06-native-adapters/codex/test-report.md)、[M08报告](modules/08-collaboration/test-report.md)、[新三种受控验证](iterations/I07/native-agent-expansion.md)、[真实三成员](iterations/I07/native-members.md)。
- ACP、Multica、公共文档和上下文方案的外部来源、取舍与未验证项统一见[连接研究](iterations/I07/connectivity-research.md)。

## 6. 产品研究带来的候选细化

[Claude Projects、Dots与Grok Bot研究](iterations/I07/projects-dots-bots-research.md)建议在CT-04/05中细化公共材料短索引、产物目录、可见交接、相关版本按需读取；Agent名片和结果入口优先复用已有登记/能力/任务记录。它们是方案建议，不更改本表实际能力或验收状态。

Grok Build官方公开headless和`grok agent stdio`的ACP入口，可作为CT-03后续目标候选；当前未安装、未注册、未执行，不计入六种内置适配器。Claude Projects协调器、Dots与Grok Bot的产品间通信也不能据文档推定为Bridge已支持的开放控制接口。自动续接、多用户、云端规划仍不作为后续目标。

## 7. 方式选择与快速接入

原生CLI、原生API、MCP、ACP、插件、SDK的优点/代价、可实现功能与前提统一维护在[接入选型指南](agent-integration-guide.md#2-六种方式的优缺点与适用场景)，不将后续推荐混进本页已接入状态。指南结合本表说明[逐Agent建议](agent-integration-guide.md#4-结合当前矩阵的后续推荐)及[已有入口与新Agent的快速路径](agent-integration-guide.md#5-如何快速接入)。当前没有通用ACP、原生Bridge插件或SDK驱动；新增这些能力后应按真实代码和验收逐行更新本表。
