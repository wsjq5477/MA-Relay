# Agent 接入现状与后续目标

2026-10-20 **0.6.0-alpha.34已预发布**：当前整合源码和新Tag已推送，标签冻结`1af4dab`，EXE与SHA-256附件已上传并通过匿名完整下载核验。包含OpenCode1.x/2.x、独立MCP、CT-04/CT-05及既有alpha.30–33修复；Windows旧后台门禁、包/普通EXE与未测边界分别见[交付记录](iterations/I07/alpha34-release.md)。完整I06C/I07C仍未准出。

## 2026-10-20：OpenCode 1.x / 2.x 兼容修复

OpenCode 当前支持 1.x/2.x 各自 HTTP 协议和 MCP 配置布局；已用官方 1.19.3 CLI 加本机受控模型传输验证生命周期及生产 broker 连接。真实模型、Windows 1.x、独立 SSH 仍未测，历史 2.x 证据保留原日期。 [需求、实现、验证与未测边界](iterations/I07/opencode-v1-compatibility.md)。

2026-10-20当前：CT-05 API/MCP与桌面明确选材、核对预览、MD/JSON本机副本均已实现。桌面581/581、Windows生产前端9组/模型0；上轮真实Claude单Task保留原API范围。公开仍alpha.32/integrated.3旧冻结包不含CT-05，实际发送/收件与跨工具消费待开发。[最新交付](iterations/I07/context-packet-ui.md)。以下日期对应原历史范围。

2026-10-19当前源码已整合公开alpha.32修复及CT-04/MCP，另有integrated.3本地候选；公开包仍alpha.32，不含本地新增功能。核心51/51、桌面570/570、Windows前端26组为本轮受控/本地包证据，未新跑原生模型或独立SSH。[整合范围](iterations/I07/integrated-source.md)。

2026-10-19当前：[CT-04桌面阅读/复制/MD下载](iterations/I07/public-materials-ui.md)源码及受控前端验证完成。公开alpha.31来自独立修复分支，当前本地仍alpha.29派生；两边尚未整合，不能把新接口或MCP配置管理当作公开包能力。

## 独立外部 MCP 配置（2026-10-19）

Claude/Codex/OpenCode 2在未发布源码中支持设置页添加/移除Bridge MCP，并生成三格式独立文件；外部日常会话可读取已授权连接与发起普通委派，归属长期接入而非伪造原生父任务。配置兼容不等于Bridge控制该外部进程；Hermes/Pi/DSH及TeamSpace原边界不变。三工具真实隔离列表增删、两工具stdio连接与Windows受控界面已有证据，新EXE/独立SSH仍未测。[专项](iterations/I07/mcp-installation.md)。

2026-10-19当前补充：[CT-04首片](iterations/I07/public-materials.md)提供获准公共材料索引和精确文档旧修订读取，源码/受控与一个真实Claude Task通过；尚未打包。其余当前/历史证据逐项保留，新增三种工具已收录alpha.29包，但真实工具/模型验收仍缺，不能由包资源检查替代。

核对日期：2026-10-19。依据alpha.29冻结发布及其后CT-04工作区源码、模块设计与实际记录；CT-01受控运行见[交付](iterations/I07/connection-capabilities.md)，CT-02真实生命周期与MCP六方向见[当前验证](iterations/I07/connection-delegation.md)；本页不产生独立验收或发布证据。公开alpha.29冻结23d256e；其后CT-04未发布源码及历史ui.2/poll.4各有冻结范围，不能互相替代。

## 1. 本轮目标与统计口径

用户明确：AgentBridge 的核心是给 Agent 提供发现、调用、观察和控制其他 Agent 的通路。自动续接、多用户不作为本轮后续目标；已有相关实现和历史证据保留，不用其完整度衡量连接产品的完成度。模型、Skill、业务规划和原生内部记忆由原 Agent 管理。

“适配程度”按具体能力和证据记录，不用没有权重依据的百分比。必须区分以下方向：

| 方向 | 含义 | 当前实现 |
| --- | --- | --- |
| Bridge → Agent | 驱动原生程序执行需求、读取结果、控制原任务 | 原生 CLI 或 HTTP 适配器；目前没有 ACP，也没有通过厂家 SDK 驱动六种内置工具 |
| Agent → Bridge | Agent 调用发现、委派、结果和协作操作 | Bridge 提供 stdio MCP 服务，注入受限会话或由外部 Agent 自行配置 |
| Bridge → 目标机器 | 把执行与协作消息送到相应机器后台 | 本机 IPC、WSL JSONL、SSH relay/daemon；不要求 Agent 直接互开网络端口 |

MCP 接入不自动赋予 Bridge 启动或取消该外部 Agent 的能力；被 Bridge 驱动也不自动说明该 Agent 能调用 Bridge MCP。

## 2. 每个 Agent 的适配矩阵

“已实现”只指源码入口存在；真实工具、真实模型和 EXE 的覆盖见证据列。直接接入要求目标环境已安装、登录并配置原生工具。

| Agent | 直接执行接入 | Bridge 实际驱动方式 | 厂家 SDK / ACP | 能调用 Bridge MCP 吗 | 被其他 Agent 委派 | 当前程度、证据与版本边界 | 后续连接目标 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | 已实现 | 原 CLI，`--print`、双向 `stream-json`、原生控制消息 | 均未使用 | 已实现，可作为主节点及小队成员 | 已实现并有真实证据 | 真实直接生命周期与当前WSL双向普通委派均通过；10月18日三真实角色公共文档链及历史权限证据保留；结构化AskUserQuestion当前拒绝 | 保持原通路，核验当前版本、跨机的发现/执行/等待/取消/恢复；按实际需求补输入类型 |
| OpenCode | 已实现 | CLI 启动 `serve`，自写 HTTP 客户端驱动 `/api/*` | 均未使用；HTTP 客户端不是厂家 SDK | 已实现，可作为主节点及手动小队成员 | 已实现并有真实证据 | 真实直接生命周期与当前WSL双向普通委派通过；permission/form及独立Linux与Windows Claude双向协作保留历史证据；原生版本契约有约束 | 作为Bridge通用ACP Client的首个目标Agent，比较现有HTTP路径的事件、权限与恢复效果 |
| Codex | 已实现 | 原 CLI `exec [resume <thread>] --json` | 均未使用 | 已实现，可作为主节点及手动小队成员 | 已实现并有真实证据，具体环境见报告 | 当前WSL0.163.0-alpha.10.2直接生命周期及双向普通委派通过；旧版本续聊、Windows原账号失败保留；Bridge权限/表单未适配 | 验证当前原生版本的执行/结果/取消/恢复；有实际控制缺口时比较原生交互接口和 ACP 生态包装器 |
| Hermes Agent | 源码已实现 | 原 CLI `chat --query-file - --format stream-json`，分别解析原生事件 | 均未使用 | 未实现注入，不能作 MCP 调用方或原生小队成员 | 普通委派生产链受控通过，未真实工具验收 | 新建、原 Session、取消、去重、恢复及普通委派已有受控 CLI/磁盘/生产MCP链证据；已收录alpha.29冻结包，真实工具/模型与独立SSH仍未验；该包启动检查不是新工具模型验收 | 先完成真实直接执行与受委派验证，再补 MCP 调用方能力；不因图标/版本探测通过而报完成 |
| Pi | 源码已实现 | 原 CLI `--mode json --print`；续聊核验原 Session 文件 | 均未使用 | 同 Hermes | 同 Hermes | 同上；原 Session 文件缺失或不唯一时明确拒绝 | 同上；确需更强交互时比较原生 RPC 与 ACP 生态入口 |
| DeepSeek Harness（DSH） | 源码已实现 | 原 CLI `--profile headless --json` | 均未使用 | 同 Hermes | 同 Hermes | 同上；使用 headless 自身原生配置，不搬运 web profile 凭据 | 同上，先验原生 headless 协议与真实模型，再决定协作注入 |
| 自研原生 Agent | 需开发适配器 | 源码静态注册宿主，按统一 `call/close` 契约实现 | 取决于未来适配器；当前无通用 ACP Client | 需另外实现并验收 MCP 注入 | 完成执行适配后才可验证 | 已有注册契约、指南和零执行示例；尚无用户自研产品实测，不支持填任意命令/地址即接入 | 形成一个实际可运行的参考适配器；若目标支持 ACP，优先复用拟议通用 Client |
| 外部 Agent 自行连接 Bridge MCP | 不等于直接执行接入 | 外部进程自行启动，作为 MCP 客户端连接 Bridge | 外部自身实现决定；Bridge 不因此驱动它 | 已有本机 TeamSpace 接入，读写文档/消息/任务 | 不能据 MCP 接入推定 Bridge 可启动/取消外部执行 | 外部入口有受控stdio连接器/生产broker证据；真实Claude小队证据来自原生注入路径，不能替代外部自研产品验收 | 明确展示“可协作读写”和“可执行控制”两种能力，验证真实外部产品入口 |

Hermes/Pi/DSH 的重要区别：`teamCollaboration=false` 阻止的是作用域/MCP 注入。经典 `delegate` 在 [AgentNetwork](../desktop/electron/agent-network.cjs) 中提交 `collaboration:false` 的普通子任务，不需要给子 Agent 注入 MCP。因此不能把“不能作为 MCP 调用方”写成“不能被委派”。CT-01已统一关系保存、新协作执行、MCP委派及界面源/目标方向准入；三工具通过生产Coordinator/MCP/broker/MachineHost与受控原生子进程的普通委派、取消、恢复和去重测试，仍无真实工具委派或当前EXE证据。节点与MCP返回八项三态能力和静态来源，静态声明不是现场推理证明；原拒绝只凭匹配原operationId收据结算。[能力与恢复完整契约](iterations/I07/connection-capabilities.md)。

## 3. 控制与上下文能力

| 能力 | Claude | OpenCode | Codex | Hermes / Pi / DSH |
| --- | --- | --- | --- | --- |
| 新建真实原生任务 | 已实现，有真实证据 | 已实现，有真实证据 | 已实现，有真实/失败环境记录 | 已实现，仅受控证据 |
| 原生同会话续聊 | 已实现，当前WSL真实通过 | 已实现，当前WSL真实通过 | 当前WSL0.163.0-alpha.10.2真实通过；旧版本失败保留 | 已实现，仅受控证据 |
| 读取实际任务结果/错误 | 已实现 | 已实现 | 已实现 | 已实现 |
| Bridge 权限回复 | 已实现，具体控制类型见报告 | 已实现，受原生版本契约限制 | 未适配 | 未适配 |
| Bridge 结构化输入表单 | AskUserQuestion 当前拒绝 | 已实现受支持类型 | 未适配 | 未适配 |
| 取消与终态核对 | 已实现，有限定真实证据 | 已实现，有限定真实证据 | 进程树/进程组控制已实现，覆盖见报告 | 已实现，仅受控证据 |
| 原请求持久查询与 unknown 保护 | 已实现 | 已实现 | 已实现 | 已实现 |
| 当前内置 ACP 驱动 | 无 | 无 | 无 | 无 |

普通六工具 MCP 里的 `delegate` 发起新的子会话，没有父完整历史复制；当前也没有给已委派子会话发送后续普通消息的工具。本轮用户未将这项扩展列为优先目标，不以此否定现有任务通路。TeamSpace 的公共材料与某个原生 Agent 的私有对话是不同层，不能混为“共享了所有上下文”。

## 4. 后续目标与完成条件

以下区分实际完成的源码切片与后续目标。CT-01源码/受控验收已完成；其余目标不因写入本表变为已实现，本轮不部署或发布。

| 目标 | 关联既有功能 | 交付内容 | 完成条件 |
| --- | --- | --- | --- |
| CT-01 能力口径一致 | AB-F02/07/10/13；M01/M02/M03/M06/M07/M08 | alpha.29冻结源码已实现八项三态能力、静态来源与方向门禁，原关系拒绝可恢复 | 源码/受控验收通过：桌面503/503、核心45/45、Windows5组；真实新工具/新EXE/独立SSH未验，[完整证据](iterations/I07/connection-capabilities.md) |
| CT-02 六种原生连接实测 | AB-F07/10/11/13；M06/M07/M08 | 三工具当前WSL[直接生命周期](iterations/I07/connection-native.md)及全部六个[真实普通委派方向](iterations/I07/connection-delegation.md)通过 | 部分完成；新三工具真实环境、新EXE及独立SSH未验；不以旧包或历史权限覆盖当前所有场景 |
| CT-03 可选 ACP 试点 | AB-F07/10/11；M06/M07/M10 | OpenCode 的可选 ACP Client，保留现有驱动 | 同需求下执行/输出/权限/取消/重连不回归；原请求不重发；至少另一种 ACP 实现验证适配层复用后再扩大 |
| CT-04 公共工作材料与 MD 视图 | AB-F20/21；M01/M02/M06/M07/M08 | 源码已实现只读索引/Markdown与准确修订，桌面阅读/复制/当前页索引或单份MD下载已补；CT-05只读选材包已补，完整产物/交接视图与同步待开发 | 桌面入口541/541及Windows八组通过、模型0；较早真实Claude一个Task保留原证据。未进入公开alpha.32，MD是视图，授权、任务/收据和可达性分别核对；[完整证据](iterations/I07/public-materials.md) |
| CT-05 显式共享上下文 | AB-F08/11/20/21；M01/M02/M06/M07/M08 | 源码实现同工作目标/四类版本的只读包及桌面明确选择、核对预览、MD/JSON本机副本；实际发送/收件仍待开发 | API片真实Claude一次消费旧版保留原证据；桌面581/581、Windows生产前端9组/模型0。不授予权限、不确认已读/可达、不执行或搬原生Session，未入integrated.3/公开alpha.32。[当前桌面范围](iterations/I07/context-packet-ui.md) |

CT-01已完成所列源码/受控范围并收录alpha.29；CT-02旧三工具WSL直接生命周期与六个委派方向已实测，新三工具仍待真实环境。CT-04桌面阅读/复制/MD下载已补，继续材料交接；CT-05只读API/MCP及桌面选材/核对导出已补，明确传递/收件与跨工具实际消费仍待验，CT-03用试点证据决定是否扩大。自动续接、多用户、模型管理、云平台和全套外部产品工作流不作为此表的目标。

## 5. 核对入口与证据

- 原生注册：[builtin-adapters.cjs](../desktop/electron/builtin-adapters.cjs)、[MachineHost](../desktop/electron/machine-host.cjs)、[自研指南](custom-agent-development.md)。
- 原生协议：[ClaudeHost](../desktop/electron/claude-host.cjs)、[CodexHost](../desktop/electron/codex-host.cjs)、[OpenCode HTTP 客户端](../src/drivers/opencode-client.ts)、[服务启动](../src/native-server.ts)、[新增 CLI 协议](../desktop/electron/native-cli-protocols.cjs)。Claude 的 `sdk-ts` 环境标记不能作为采用 Claude Agent SDK 的证据。
- Agent 调用入口：[MCP 服务实现](../desktop/electron/mcp-client.cjs)、[受限 broker](../desktop/electron/collaboration-broker.cjs)、[路由与任务归属](../desktop/electron/agent-network.cjs)、[TeamSpace](../desktop/electron/team-space.cjs)。`mcp-client.cjs` 虽沿用旧文件名，对原生 Agent 这一侧实际响应 MCP server 方法。
- 实际覆盖：[M06报告](modules/06-native-adapters/test-report.md)、[Claude报告](modules/06-native-adapters/claude/test-report.md)、[OpenCode报告](modules/06-native-adapters/opencode/test-report.md)、[Codex报告](modules/06-native-adapters/codex/test-report.md)、[M08报告](modules/08-collaboration/test-report.md)、[新三种受控验证](iterations/I07/native-agent-expansion.md)、[真实三成员](iterations/I07/native-members.md)。
- ACP、Multica、公共文档和上下文方案的外部来源、取舍与未验证项统一见[本轮研究](iterations/I07/connectivity-research.md)。

## 6. 2026-10-19产品研究带来的候选细化

[Claude Projects、Dots与Grok Bot研究](iterations/I07/projects-dots-bots-research.md)建议在CT-04/05中细化公共材料短索引、产物目录、可见交接、相关版本按需读取；Agent名片和结果入口优先复用已有登记/能力/任务记录。它们是方案建议，不更改本表实际能力或验收状态。

Grok Build官方公开headless和`grok agent stdio`的ACP入口，可作为CT-03后续目标候选；当前未安装、未注册、未执行，不计入六种内置适配器。Claude Projects协调器、Dots与Grok Bot的产品间通信也不能据文档推定为Bridge已支持的开放控制接口。自动续接、多用户、云端规划仍不作为后续目标。
