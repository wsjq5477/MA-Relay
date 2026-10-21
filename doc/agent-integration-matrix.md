# Agent 接入现状与后续目标

当前本地修复候选 `0.6.0-alpha.35.recovery.1` 包含当前接入源码与扫描/管理恢复，普通EXE与最终包一致性已验；真实DSH证据仍按原.dsh.3冻结范围记录。仅缺服务连接时显示“待配置服务连接”，不当作工具故障。[当前候选与边界](iterations/I07/agent-management-recovery.md)。

## 当前源码接入总览

阅读顺序：本页登记“每个Agent已接了哪些方式”；[接入方式、选型与快速接入](agent-integration-guide.md)说明六种方式的优缺点、功能条件和逐Agent后续推荐；[开发指南](custom-agent-development.md)提供当前可执行的适配步骤与验证命令。

本表已核对当前静态注册表：六种产品、八个执行入口。Claude/Codex/Hermes/Pi与DSH CLI使用各自原生CLI；OpenCode由CLI启动服务后走HTTP；DSH Desktop/Web连接用户已运行且认证的HTTP服务。当前没有内置ACP驱动，也没有用厂家SDK驱动这些入口。Agent调用Bridge则走另一方向的stdio MCP；不能把两种方向统称为“MCP接入”。

DSH新增的Desktop/Web仍为alpha.34之后未发布源码，支持直接执行和普通被委派，不声明Bridge MCP调用方或小队成员。当前在设置页有专属服务配置卡，这是现有界面布局，并非HTTP协议要求；它与其他Agent的接入入口尚未统一。模型、供应商、原生权限不由此配置卡管理。[完整协议、当前设置流程与证据](iterations/I07/dsh-desktop-web.md)。

发现时排除Linux同名Distributed Shell，原`/usr/bin/dsh`错误不代表DSH Web连接失败。当前源码可按已安装Desktop或Linux Web profile显示未配置服务提示；须在对应机器配置根地址/token后验证连接，旧alpha.34 EXE没有Desktop/Web入口。[现场核对与修复](iterations/I07/dsh-desktop-web.md#同名程序与服务发现修复)。

后续规划见[Agent侧自主操作与通用调用方规划](iterations/I07/agent-centric-operations.md)：CT-06逐工具核对Hermes/Pi/DSH（含DSH服务入口）原生MCP客户端与插件扩展点后接入通用调用方、CT-07补Agent侧连接操作面、CT-08将单主关系泛化为按身份多关系并加受确认流保护的连接管理；均登记在本页§4后续目标，CT-07已补只读委派列表和[当前调用方连接视图](iterations/I07/agent-connections.md)及[子任务最小上下文](iterations/I07/delegation-context.md)（源码7工具、受控验证），CT-06/08规划尚无实现；静态bridgeMcp维持false至逐工具验收，插件仅作无MCP客户端时的薄传输缺口填补。

当前发布：公开预发布 **0.6.0-alpha.35**（元数据指向 `b5de577`，本轮未重下EXE；独立修复已按内容整合至本地alpha.36，[核对边界](iterations/I07/delegation-list.md#5-源码公开版本和后续)）。alpha.34包含OpenCode 1.x/2.x双协议与MCP双布局（官方1.19.3 CLI受控验证；真实模型、Windows 1.x、独立SSH未测，[专项](iterations/I07/opencode-v1-compatibility.md)）。独立MCP配置管理与CT-04/CT-05当前状态见本页§2/§4；逐轮记录统一见[迭代目录](iterations/README.md)。

## 1. 目标与统计口径

用户明确：AgentBridge 的核心是给 Agent 提供发现、调用、观察和控制其他 Agent 的通路。自动续接、多用户不作为后续目标；已有相关实现和历史证据保留，不用其完整度衡量连接产品的完成度。模型、Skill、业务规划和原生内部记忆由原 Agent 管理。

“适配程度”按具体能力和证据记录，不用没有权重依据的百分比。必须区分以下方向：

| 方向 | 含义 | 当前实现 |
| --- | --- | --- |
| Bridge → Agent | 驱动原生程序执行需求、读取结果、控制原任务 | 原生 CLI 或 HTTP 适配器；六种产品共八个入口，目前没有内置 ACP 或厂家 SDK 驱动 |
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
| Hermes Agent | 已接入：stream-json | 未接入 | 未接入 | 未接入 | 未接入 | 未接入 |
| Pi | 已接入：JSON/print | 未接入 | 未接入 | 未接入 | 未接入 | 未接入 |
| DSH CLI | 已接入：headless JSON | 未接入 | 未接入 | 未接入 | 未接入 | 未接入 |
| DSH Windows Desktop | 未接入该入口的CLI | 已接入：认证HTTP Session API | 未接入 | 未接入 | 未接入 | 未接入 |
| DSH Linux / WSL Web | 未接入该入口的CLI | 已接入：认证HTTP Session API | 未接入 | 未接入 | 未接入 | 未接入 |

各列含义：

- **原生CLI / 原生API / ACP / 厂家SDK**：Bridge调用Agent的具体路径。OpenCode两列同时已接入，因为CLI负责启动，HTTP API负责执行与控制。
- **MCP**：Agent作为MCP客户端调用Bridge的通路，包含托管任务scope注入和已适配的原生配置管理；不是Bridge通过MCP控制该Agent。其他Agent仍可通过Bridge的MCP委派DSH，末段由DSH的CLI或HTTP驱动执行。
- **插件**：在原生Agent内部安装Bridge专用插件作为连接实现。当前没有这种接入；Bridge内部静态adapter注册、DSH原生已安装的业务插件、MCP配置条目均不计作此列的插件。
- **未接入**：当前Bridge没有实现这条路径，不代表厂商不支持、也不代表该Agent整体不可用。各入口的真实覆盖与限制另见下表。

### 能力、证据与后续目标

| Agent / 入口 | 当前执行与协作能力 | 实际证据与版本边界 | 后续连接目标 |
| --- | --- | --- | --- |
| Claude Code | 直接执行：已实现；MCP调用方：已实现，可作为主节点及小队成员；被委派：已实现并有真实证据 | 真实直接生命周期与当前WSL双向普通委派均通过；三真实角色公共文档链及历史权限证据保留；结构化AskUserQuestion当前拒绝 | 保持原通路，核验当前版本、跨机的发现/执行/等待/取消/恢复；按实际需求补输入类型 |
| OpenCode | 直接执行：已实现；MCP调用方：已实现，可作为主节点及手动小队成员；被委派：已实现并有真实证据 | 真实直接生命周期与当前WSL双向普通委派通过；permission/form及独立Linux与Windows Claude双向协作保留历史证据；原生版本契约有约束 | 作为Bridge通用ACP Client的首个目标Agent，比较现有HTTP路径的事件、权限与恢复效果 |
| Codex | 直接执行：已实现；MCP调用方：已实现，可作为主节点及手动小队成员；被委派：已实现并有真实证据，具体环境见报告 | 当前WSL0.163.0-alpha.10.2直接生命周期及双向普通委派通过；旧版本续聊、Windows原账号失败保留；Bridge权限/表单未适配 | 验证当前原生版本的执行/结果/取消/恢复；有实际控制缺口时比较原生交互接口和 ACP 生态包装器 |
| Hermes Agent | 直接执行：源码已实现；MCP调用方：未实现注入，不能作 MCP 调用方或原生小队成员；被委派：普通委派生产链受控通过，未真实工具验收 | 新建、原 Session、取消、去重、恢复及普通委派已有受控 CLI/磁盘/生产MCP链证据；已收录alpha.29冻结包，真实工具/模型与独立SSH仍未验；该包启动检查不是新工具模型验收 | 先完成真实直接执行与受委派验证，再补 MCP 调用方能力；不因图标/版本探测通过而报完成 |
| Pi | 直接执行：源码已实现；MCP调用方：同 Hermes；被委派：同 Hermes | 同上；原 Session 文件缺失或不唯一时明确拒绝 | 同上；确需更强交互时比较原生 RPC 与 ACP 生态入口 |
| DeepSeek Harness（DSH） | 直接执行：源码已实现；MCP调用方：同 Hermes；被委派：同 Hermes | 同上；使用 headless 自身原生配置，不搬运 web profile 凭据 | 同上，先验原生 headless 协议与真实模型，再决定协作注入 |
| DSH Windows Desktop（dsh-desktop） | 直接执行：源码已实现，未进入公开发布包；MCP调用方：未适配，不能作Bridge MCP调用方或小队成员；被委派：可接收普通委派；方向能力为受控证据 | Windows社区Desktop2.0.18真实认证/Session接口及同Session两轮去重已观察；两轮模型均RATE_LIMIT；本地.dsh.3 EXE六组通过 | 待原生限流解除后补成功回答/真实取消；[DSH原生证据](iterations/I07/dsh-exe-delivery.md) |
| DSH Linux / WSL Web（dsh-web） | 直接执行：源码已实现，未进入公开发布包；MCP调用方：同Desktop入口；被委派：同Desktop入口 | WSL真实Web认证/Session列表通过；生命周期/恢复为受控服务，模型0，独立SSH未验 | 保存对应机器连接后补模型/续聊/取消验证；[DSH原生证据与边界](iterations/I07/dsh-exe-delivery.md) |
| 自研原生 Agent | 直接执行：需开发适配器；MCP调用方：需另外实现并验收 MCP 注入；被委派：完成执行适配后才可验证 | 已有注册契约、指南和零执行示例；尚无用户自研产品实测，不支持填任意命令/地址即接入 | 形成一个实际可运行的参考适配器；若目标支持 ACP，优先复用拟议通用 Client |
| 外部 Agent 自行连接 Bridge MCP | 直接执行：不等于直接执行接入；MCP调用方：已有本机 TeamSpace 接入，读写文档/消息/任务；被委派：不能据 MCP 接入推定 Bridge 可启动/取消外部执行 | 外部入口有受控stdio连接器/生产broker证据；真实Claude小队证据来自原生注入路径，不能替代外部自研产品验收 | 明确展示“可协作读写”和“可执行控制”两种能力，验证真实外部产品入口 |

自研Agent需要另行实现并验收适配器；外部Agent已可自行配置Bridge MCP，但不能据此推定它具有本表其他执行路径。[DSH API选型原因与功能边界](iterations/I07/dsh-desktop-web.md#为什么选择原生-api)。

Hermes/Pi/DSH 的重要区别：`teamCollaboration=false` 阻止的是作用域/MCP 注入。经典 `delegate` 在 [AgentNetwork](../desktop/electron/agent-network.cjs) 中提交 `collaboration:false` 的普通子任务，不需要给子 Agent 注入 MCP。因此不能把“不能作为 MCP 调用方”写成“不能被委派”。CT-01已统一关系保存、新协作执行、MCP委派及界面源/目标方向准入；三工具通过生产Coordinator/MCP/broker/MachineHost与受控原生子进程的普通委派、取消、恢复和去重测试，仍无真实工具委派或当前EXE证据。节点与MCP返回八项三态能力和静态来源，静态声明不是现场推理证明；原拒绝只凭匹配原operationId收据结算。[能力与恢复完整契约](iterations/I07/connection-capabilities.md)。

## 3. 控制与上下文能力

| 能力 | Claude | OpenCode | Codex | Hermes / Pi / DSH（CLI及Desktop/Web） |
| --- | --- | --- | --- | --- |
| 新建真实原生任务 | 已实现，有真实证据 | 已实现，有真实证据 | 已实现，有真实/失败环境记录 | 已实现，仅受控证据 |
| 原生同会话续聊 | 已实现，当前WSL真实通过 | 已实现，当前WSL真实通过 | 当前WSL0.163.0-alpha.10.2真实通过；旧版本失败保留 | 已实现，仅受控证据 |
| 读取实际任务结果/错误 | 已实现 | 已实现 | 已实现 | 已实现 |
| Bridge 权限回复 | 已实现，具体控制类型见报告 | 已实现，受原生版本契约限制 | 未适配 | 未适配 |
| Bridge 结构化输入表单 | AskUserQuestion 当前拒绝 | 已实现受支持类型 | 未适配 | 未适配 |
| 取消与终态核对 | 已实现，有限定真实证据 | 已实现，有限定真实证据 | 进程树/进程组控制已实现，覆盖见报告 | 已实现，仅受控证据 |
| 原请求持久查询与 unknown 保护 | 已实现 | 已实现 | 已实现 | 已实现 |
| 当前内置 ACP 驱动 | 无 | 无 | 无 | 无 |

经典MCP（源码7项、已发布6项）里的 `delegate` 发起新的子会话，没有父完整历史复制；当前也没有给已委派子会话发送后续普通消息的工具。用户未将这项扩展列为优先目标，不以此否定现有任务通路。TeamSpace 的公共材料与某个原生 Agent 的私有对话是不同层，不能混为“共享了所有上下文”。

## 4. 后续目标与完成条件

以下区分实际完成的源码切片与后续目标。CT-01源码/受控验收已完成；其余目标不因写入本表变为已实现，也未部署或发布。

| 目标 | 关联既有功能 | 交付内容 | 完成条件 |
| --- | --- | --- | --- |
| CT-01 能力口径一致 | AB-F02/07/10/13；M01/M02/M03/M06/M07/M08 | 源码已实现八项三态能力、静态来源与方向门禁，原关系拒绝可恢复 | 源码/受控验收通过：桌面503/503、核心45/45、Windows5组；真实新工具/新EXE/独立SSH未验，[完整证据](iterations/I07/connection-capabilities.md) |
| CT-02 六种原生连接实测 | AB-F07/10/11/13；M06/M07/M08 | 三工具当前WSL[直接生命周期](iterations/I07/connection-native.md)及全部六个[真实普通委派方向](iterations/I07/connection-delegation.md)通过 | 部分完成；新三工具真实环境、新EXE及独立SSH未验；不以旧包或历史权限覆盖当前所有场景 |
| CT-03 可选 ACP 试点 | AB-F07/10/11；M06/M07/M10 | OpenCode 的可选 ACP Client，保留现有驱动 | 同需求下执行/输出/权限/取消/重连不回归；原请求不重发；至少另一种 ACP 实现验证适配层复用后再扩大 |
| CT-04 公共工作材料与 MD 视图 | AB-F20/21；M01/M02/M06/M07/M08 | 源码已实现只读索引/Markdown与准确修订，桌面阅读/复制/当前页索引或单份MD下载已补；CT-05只读选材包已补，完整产物/交接视图与同步待开发 | 桌面入口541/541及Windows八组通过、模型0；较早真实Claude一个Task保留原证据。MD是视图，授权、任务/收据和可达性分别核对；[完整证据](iterations/I07/public-materials.md) |
| CT-05 显式共享上下文 | AB-F08/11/20/21；M01/M02/M06/M07/M08 | 源码实现同工作目标/四类版本的只读包及桌面明确选择、核对预览、MD/JSON本机副本；实际发送/收件仍待开发 | API片真实Claude一次消费旧版保留原证据；桌面581/581、Windows生产前端9组/模型0。不授予权限、不确认已读/可达、不执行或搬原生Session。[当前桌面范围](iterations/I07/context-packet-ui.md) |
| CT-06 通用MCP调用方 | AB-F02/07/10/11/12/13；M03/M06/M07/M08 | 先只读核对Hermes/Pi/DSH及DSH服务入口的原生MCP客户端与插件扩展点；可走MCP的工具按[独立MCP](iterations/I07/mcp-installation.md)模式接入配置安装、冲突/撤权与独立connectionId身份 | 每工具按真实版本出四选一结论（走MCP/走插件/仅被驱动/待定），不以图标或版本探测推定；原生实际调用获准工具、拒绝越权/撤权、身份归属；配置导出成功不算工具调用成功；静态bridgeMcp仅验收后翻真。规划未实现，[完整定义](iterations/I07/agent-centric-operations.md) |
| CT-07 Agent侧连接操作面 | AB-F02/07/08/10/11/13；M01/M03/M07/M08 | list_agents按原身份返回当前获准连接；list_delegations只读查原委派；普通子会话附最小说明 | 三项已源码/受控覆盖，最新冻结667/667、定向121/121及Windows36/36，模型0。身份、撤权、原请求和无新增工具授权保持；[最新上下文与首次失败](iterations/I07/delegation-context.md)。整合包/真实消费及完整I06C/I07C未准出；[完整目标](iterations/I07/agent-centric-operations.md) |
| CT-08 多主关系与连接管理 | AB-F02/07/08/10/11/12/13；M01/M03/M07/M08 | 单主collaboration关系泛化为按身份relations[]并迁移；新增list_connectable/connect_agent/disconnect_agent与envelope预授权及确认流；Bridge界面收缩为接入配置、策略与审计 | 关系重构与行为变更分片验收，旧数据迁移可核对；Agent不能自批envelope外关系，撤权即时生效；data-model/protocol同轮同步。规划未实现，[完整定义](iterations/I07/agent-centric-operations.md) |

CT-01已完成所列源码/受控范围；CT-02旧三工具WSL直接生命周期与六个委派方向已实测，新三工具仍待真实环境。CT-04桌面阅读/复制/MD下载已补，继续材料交接；CT-05只读API/MCP及桌面选材/核对导出已补，明确传递/收件与跨工具实际消费仍待验，CT-03用试点证据决定是否扩大。CT-06/CT-07/CT-08为后续规划（[Agent侧自主操作](iterations/I07/agent-centric-operations.md)），CT-07只读委派列表及当前调用方连接视图已源码实现，[子会话上下文](iterations/I07/delegation-context.md)也已源码实现，CT-06/08规划及真实消费仍待完成；I07C六工具真实覆盖与DSH原实例验证仍是CT-06的前置。自动续接、多用户、模型管理、云平台和全套外部产品工作流不作为此表的目标。

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
