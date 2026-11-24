# Agent 接入现状与后续目标

## 当前源码接入总览

AgentBridge 当前适配 **8 种产品、13 个专用入口**，包含 12 个原生入口和 ChatGPT Web。其他 ACP Agent 可[按命令注册](user/agents/index.md#连接其他-acp-agent)。查看[逐入口接入表](#2-每个-agent-已接入的方式)可比较 CLI、API、MCP、ACP、插件和 SDK。用户站的接入表从本页生成，并与源码注册表核对。实际启动命令、续聊、回合中插话、检查点回退和上下文压缩见[启动与会话控制](user/agents/index.md#启动与会话控制)。

执行路径使用原生 CLI、HTTP、WebSocket、ACP v1 stdio 或浏览器扩展。支持主动协作的 Agent 通过 stdio MCP 向 Bridge 查询、委派和读取获准结果。厂家 SDK 暂无执行驱动。

本机 DSH NEXT 2.0.24-next 已完成真实两轮、原会话续聊、在途恢复及取消，独立 DSH Web 已验证显式结果交接。ChatGPT Web 通过 Chrome 或 Edge 扩展接入，支持在获准的原可见会话中执行与续聊；网页提交后的停止需在网页处理。[DSH 本机验收](iterations/I08/current-scope-audit.md#本机-dsh-next-实测) · [ChatGPT Web 证据与限制](iterations/I08/web-agent-development.md)

公开 ACP 预发布（`8b69f71`）可执行任务和按握手续聊，收到工具权限询问时返回取消。本地候选 `dsh.2` 已验 Windows DSH 原生单次允许、拒绝与取消。[公开版本](iterations/I08/acp-stdio-runtimes.md#公开预发布) · [权限验收](iterations/I08/windows-dsh-first-use-acceptance.md) · [接入指南](agent-integration-guide.md) · [适配开发](custom-agent-development.md)

## 1. 目标与统计口径

用户明确：AgentBridge 的核心是给 Agent 提供发现、调用、观察和控制其他 Agent 的通路。自动续接、多用户不作为后续目标；已有相关实现和历史证据保留，不用其完整度衡量连接产品的完成度。模型、Skill、业务规划和原生内部记忆由原 Agent 管理。

已确认的范围：身份、授权、明确目标调用、交互控制及可靠恢复为核心；AB-F19 小队容器与 AB-F20/21/22 公共空间、业务任务/验收、自动协调定位为可选上层，保留兼容并暂停扩张。优先补 Agent 身份、调用方/上下文归属与接入生命周期，再补共享策略、结果/事件和真实 Super-agent 闭环；当前独立登记/固定端点/按登记ID委派源码第一片已实现：新增中央agents.*、端点扩展字段和定向能力，不迁移旧登记或原任务；74项受控回归不代表真实原生Super-agent完成；独立调用方/上下文/凭据和原事件查询现已源码实现，完整契约见[调用方与事件](iterations/I08/interconnect-caller-contract.md)。[当前实现与证据](iterations/I08/interconnect-development.md)。MCP 可先完成闭环，订阅/A2A/DSH Provider/递归委派不作为必需项。[完整边界与完成条件](iterations/I08/interconnect-boundary.md)。

“适配程度”按具体能力和证据记录，不用没有权重依据的百分比。必须区分以下方向：

| 方向 | 含义 | 当前实现 |
| --- | --- | --- |
| Bridge → Agent | 驱动原生程序执行需求、读取结果、控制原任务 | 原生 CLI、HTTP、WebSocket、ACP、浏览器扩展，13 个专用入口及自定义 ACP |
| Agent → Bridge | Agent 调用发现、委派、结果和协作操作 | Bridge 提供 stdio MCP 服务，注入受限会话或由外部 Agent 自行配置 |
| Bridge → 目标机器 | 把执行与协作消息送到相应机器后台 | 本机 IPC、WSL JSONL、SSH relay/daemon；不要求 Agent 直接互开网络端口 |

MCP 接入不自动赋予 Bridge 启动或取消该外部 Agent 的能力；被 Bridge 驱动也不自动说明该 Agent 能调用 Bridge MCP。

## 2. 每个 Agent 已接入的方式

每行描述一个已登记的运行时入口。OpenCode 和 Hermes 的专用入口分别使用 HTTP 和 CLI。两者也可使用「自定义 ACP」。Windows Hermes 0.22.5 已验证真实任务、原 Session 续聊、原请求恢复与取消。OpenCode ACP 实测覆盖注册、新建和原会话恢复。[Hermes ACP 验收](iterations/I08/windows-second-acp-acceptance.md) · [逐产品 ACP 表](user/agents/index.md#连接其他-acp-agent)

| Agent / 入口 | 原生 CLI | 原生 API | MCP | ACP | 插件 | 厂家 SDK |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Code | 已接入：stream-json | 未接入 | 已接入 | 未接入 | 未接入 | 未接入 |
| OpenCode | 已接入：启动serve | 已接入：HTTP执行/控制 | 已接入 | 未接入 | 未接入 | 未接入 |
| Codex | 已接入：exec/resume JSON | 未接入 | 已接入 | 未接入 | 未接入 | 未接入 |
| Hermes Agent | 已接入：stream-json | 未接入 | 已接入：原生 Profile YAML | 未接入 | 未接入 | 未接入 |
| Pi | 已接入：JSON/print | 未接入 | 已接入：用户 mcp.json | 未接入 | 未接入 | 未接入 |
| DSH CLI | 已接入：headless JSON | 未接入 | 已接入：原生显式profile补丁 | 未接入 | 未接入 | 未接入 |
| DSH Windows Desktop | 未接入该入口的CLI | 已接入：认证HTTP Session API | 已接入：原生 Profile 补丁 | 未接入 | 未接入 | 未接入 |
| DSH Linux / WSL Web | 未接入该入口的CLI | 已接入：认证HTTP Session API | 已接入：原生web Profile补丁 | 未接入 | 未接入 | 未接入 |
| DSH NEXT | 已接入：Windows 包内 headless JSONL | 未接入 | 已接入：当前原生 Profile 管理 | 未接入 | 已接入：可选连接面板 | 未接入 |
| DSH ACP | 未接入独立 CLI 执行 | 未接入 | 未接入 | 已接入：DSH NEXT 包内 ACP v1 stdio | 未接入 | 未接入 |
| 自定义 ACP | 未接入独立 CLI 执行 | 未接入 | 未接入 | 已接入：为目标机器注册 ACP v1 stdio 可执行命令 | 未接入 | 未接入 |
| OpenDesk CLI | 已接入：启动serve | 已接入：已有 HTTP 会话接口 | 已接入：仅片段导出，无原生配置管理/托管scope | 未接入 | 未接入 | 未接入 |
| OpenDesk Windows Desktop | 未接入该入口的CLI | 已接入：已有 WebSocket 设备网关 | 已接入：独立原生配置，未注入托管 scope | 未接入 | 未接入 | 未接入 |
| ChatGPT Web | 未接入 | 未接入 | 未接入 | 未接入 | 已接入：Chrome / Edge 浏览器扩展 | 未接入 |

各列含义：

- **原生CLI / 原生API / ACP / 厂家SDK**：Bridge调用Agent的具体路径。OpenCode两列同时已接入，因为CLI负责启动，HTTP API负责执行与控制。
- **MCP**：Agent作为MCP客户端调用Bridge的通路，包含托管任务scope注入和已适配的原生配置管理；不是Bridge通过MCP控制该Agent。其他Agent仍可通过Bridge的MCP委派DSH，末段由DSH的CLI或HTTP驱动执行。本表的MCP列表示“Bridge已实现该方向的适配”，不等于该入口的原生客户端已实际读取配置：OpenDesk Desktop已有原生读取、授权只读查询和组件委派证据，但自主父模型委派仍未验，以能力表行为准（见[本轮§12](iterations/I08/mcp-open-integration.md#12-真实原生探测补充2026-10-22-晚)）。
- **插件**：DSH NEXT 的可选连接面板读取当前 Profile 获准目标及其状态。任务执行走包内 CLI，主动调用走原生 MCP。ChatGPT Web 由浏览器扩展执行网页操作。
- **未接入** 指该行专用入口未采用此方式。自定义 ACP 行单独表示通用驱动。表中源码适配、握手、原生模型执行和公开 EXE 各有独立的验收范围。

### 能力、证据与后续目标

| Agent / 入口 | 当前执行与协作能力 | 实际证据与版本边界 | 后续连接目标 |
| --- | --- | --- | --- |
| Claude Code | 直接执行：已实现；MCP调用方：已实现，可作为主节点及小队成员；原生MCP配置：Bridge可管理（写`mcpServers.agentbridge`）；托管scope注入：已实现；被委派：已实现并有真实证据 | 真实直接生命周期与当前WSL双向普通委派均通过；三真实角色公共文档链及历史权限证据保留；结构化AskUserQuestion当前拒绝；2026-10-22受控profile下真实`claude`：Bridge写入后`claude mcp list`报Connected、工具目录7项（零模型，非用户profile） | 保持原通路，核验当前版本、跨机的发现/执行/等待/取消/恢复；按实际需求补输入类型 |
| OpenCode | 直接执行：已实现；MCP调用方：已实现，可作为主节点及手动小队成员；原生MCP配置：Bridge可管理（v1/v2两代布局）；托管scope注入：已实现；被委派：已实现并有真实证据 | 真实直接生命周期与当前WSL双向普通委派通过；permission/form及独立Linux与Windows Claude双向协作保留历史证据；原生版本契约有约束 | 自定义 ACP 可另行注册。Windows 已验证 ACP 握手、新建和跨进程恢复 |
| Codex | 直接执行：已实现；MCP调用方：已实现，可作为主节点及手动小队成员；原生MCP配置：Bridge可管理（`mcp_servers.agentbridge`标记块）；托管scope注入：已实现；被委派：已实现并有真实证据，具体环境见报告 | 当前WSL0.163.0-alpha.10.2直接生命周期及双向普通委派通过；旧版本续聊、Windows原账号失败保留；Bridge权限/表单未适配 | 验证当前原生版本的执行/结果/取消/恢复；有实际控制缺口时比较原生交互接口和 ACP 生态包装器 |
| Hermes Agent | 直接执行、原Session续聊与普通被委派已实现；Windows/Linux原安装发现及独立MCP/Profile YAML已包含；托管scope/小队与网关取消未适配 | Linux正式0.22.5本轮两轮实际成功、原ID去重及通道重开/同Session续聊，原配置字节保持；独立Ubuntu原生MCP五组/十工具通过，组件模型0；普通EXE七组模型0 | 自主父模型/跨Agent委派、原生网关取消、完整生命周期与SSH未准出；[本轮证据](iterations/I08/alpha67-hermes-linux-live.md) |
| Pi | 直接执行与普通被委派：源码已实现；独立MCP/用户配置及续聊前目录核对：公开alpha.68已包含；托管scope：未适配；alpha.69源码统一原生事件与派发的真实目录规则 | 官方Pi1.4.0原包Linux/Windows在公开60冻结后台上各7组通过，实际消费10工具和连接/确认/撤权，模型0；[MCP原生组件](iterations/I08/native-policy-components.md)。本轮Windows共享60/60、原包SessionManager四组及三条受控普通委派通过，模型0；[当前证据](iterations/I08/pi-workspace-events-and-windows-validation.md) | 原Session文件与目录必须共同保持，等价目录别名不解除unknown；真实父模型/生命周期/SSH待验 |
| DeepSeek Harness（DSH） | 直接执行：源码已实现；MCP调用方：已声明有MCP客户端（可独立配置）；原生MCP配置：**有，但需显式指定启动 profile**（`$DSH_HOME/profiles/<profile>/cordis.patch.yml` 单行`insert:`）；托管scope注入：未适配；被委派：同 Hermes | 使用 headless 自身原生配置，不搬运 web profile 凭据；profile 名称由用户提供并按单段目录校验（`MCP_DSH_PROFILE_REQUIRED` 拒绝非法/缺失值），未指定时只可导出；受控测试覆盖写入仅目标profile、status回显、remove只清理该profile；**真实 `dsh --profile acp` 启动观测到原生加载+`initialize`握手+`tools/list`（7工具，模型0，受控scratch profile）**；TUI/用户自建profile与真实用户profile未观测 | 在真实 `dsh` CLI 启动中核对指定 profile 是否加载该条目并列出工具；先验原生 headless 协议与真实模型 |
| DSH Windows Desktop（dsh-desktop） | 直接执行：已随公开alpha.46实现；MCP调用方：已声明有MCP客户端；原生MCP配置：alpha.48候选按Desktop原生数据目录/Profile选择记录管理，保存原目标绑定，切换后先移除再添加（当前公开版已包含）；托管scope注入：未适配；被委派：可接收普通委派；方向能力为受控证据 | Windows社区Desktop2.0.18历史真实认证/Session接口及同Session两轮去重已观察，模型RATE_LIMIT；本轮已安装未修改Desktop原生配置组合器与MCP客户端5组/生产前端4组通过（模型0），[完整证据](iterations/I08/dsh-desktop-mcp.md) | 待原生限流解除后补成功回答/真实取消；[DSH原生证据](iterations/I07/dsh-exe-delivery.md) |
| DSH Linux / WSL Web（dsh-web） | 使用原生 Web Profile 的认证 HTTP 服务，可接收普通委派。独立 MCP 可配置，托管 scope 未适配 | WSL 已验原生认证、Session 列表和隔离 Profile 的真实 MCP 握手。Windows 同机回环 Web 服务另有一次显式交接与正确正文的实测 | 各平台分别核对原 Session 续聊、取消及生产 SSH。[WSL 服务证据](iterations/I07/dsh-exe-delivery.md) · [本机交接](iterations/I08/current-scope-audit.md#显式交接到独立-dsh-web-会话) |
| DSH NEXT | Windows 包内 headless CLI 执行，原生 MCP Profile 可管理，可选插件展示获准目标 | Windows DSH NEXT 2.0.24-next 已实测两轮真实回复、相同原 Session、观察器重开与原任务取消 | [本机证据与认证条件](iterations/I08/current-scope-audit.md#本机-dsh-next-实测) |
| DSH ACP | Windows 包内 ACP Profile 创建会话、输出正文、接受普通委派和取消 | Windows DSH NEXT 2.0.24-next 已实测 DeepSeek 两轮与取消。本地 EXE `dsh.2` 经 Windows DSH NEXT 原生会话实测只读委派、原 Session 续聊，以及完整命令后的单次允许、拒绝和取消 | [Windows ACP 实测](iterations/I08/dsh-acp.md) · [候选包验收](iterations/I08/windows-dsh-first-use-acceptance.md) |
| OpenDesk CLI（opendesk） | HTTP 执行，接受普通委派，可在原连接可用时续聊或请求取消。Bridge 可导出独立 MCP 片段 | 0.3.8 未观察到原生 MCP 管理或读取入口。仅导出片段无法证明原生工具可见或调用成功 | 核对原生 CLI 的模型与 MCP 调用。小队、托管 scope、权限与表单回复未开放。[当前入口](user/agents/opendesk.md) |
| OpenDesk Windows Desktop（opendesk-desktop） | 同上执行/委派/续聊/取消；托管scope注入：未适配并单独拒绝；**原生MCP配置：可用，但需要 Node 启动器，写入前须从托盘完全退出 OpenDesk、写入后再打开**——写 `%APPDATA%\opendesk\setting.json` 的 `applications.mcpmgr.servers`，条目优先用 PATH 中真实 Node（`launcher:'node'`），Electron 回退时 OpenDesk 无法启动（`launcher:'electron'` 并在界面提示先装 Node）；MCP调用方：**原生已加载+已连接+7工具可见**（用户真实 Desktop 0.3.9，模型0，日志 `discovered 7 tools`），同日已安装原生组件正式授权调用及独立主角色→真实Claude子任务已验（各自生产身份/原结果，受控父进程），日常原生父模型实际 `list_agents` 1 次成功、返回7个获准节点，[现场恢复与发现](iterations/I08/opendesk-mcp-diagnostic-repair.md)；**原生父模型自主委派与日常原生页面未验**；小队、Bridge权限/表单未开放 | 使用未修改的原HTTP/桌面网关；去重和原回应由Bridge保存，断线/取消无证明时unknown；Desktop 0.3.9原实例真实回复/续聊及普通EXE窗口重开通过，[现场证据](iterations/I08/opendesk-desktop-live.md)；真实取消/MCP、CLI模型与SSH未验；包边界见[专项](iterations/I08/opendesk-existing-interfaces.md) | 桌面原连接断开后不可续聊，任务沿用原生目录；独立MCP与托管scope分开 |
| 自定义 ACP（含自研 Agent） | 注册目标机器上的 ACP v1 stdio 命令，支持新建、正文、普通被委派、取消，续聊由握手决定 | Windows OpenCode 2.3.0、Hermes 0.22.5 验证了注册、原生新建和跨进程恢复原 Session，两项模型调用均为 0 | 其他上游分发按具体版本验证。工具权限回复见本页版本说明。[实测与命令](iterations/I08/acp-stdio-runtimes.md) |
| 外部 Agent 自行连接 Bridge MCP | 直接执行：不等于直接执行接入；MCP调用方：已有本机 TeamSpace 接入，读写文档/消息/任务；被委派：不能据 MCP 接入推定 Bridge 可启动/取消外部执行 | 外部入口有受控stdio连接器/生产broker证据；真实Claude小队证据来自原生注入路径，不能替代外部自研产品验收 | 明确展示“可协作读写”和“可执行控制”两种能力，验证真实外部产品入口 |

自研 Agent 若只需发起委派，可接入 Bridge MCP 并获得相应授权；若要接收委派，可实现 ACP v1 stdio，或开发与其原生接口匹配的适配器。[调用方契约](iterations/I08/interconnect-caller-contract.md) · [自定义 ACP](user/agents/index.md#连接其他-acp-agent)

Hermes/Pi/DSH 的重要区别：`hostManagedTask=false` 阻止的是作用域/MCP 注入（旧投影名`teamCollaboration`），与“是否有MCP客户端”“能否作主”“能否被委派”是三件不同的事。经典 `delegate` 在 [AgentNetwork](../desktop/electron/agent-network.cjs) 中提交 `collaboration:false` 的普通子任务，不需要给子 Agent 注入 MCP。因此不能把“不能注入托管scope”写成“不能作为 MCP 调用方”或“不能被委派”。CT-01已统一关系保存、新协作执行、MCP委派及界面源/目标方向准入；三工具通过生产Coordinator/MCP/broker/MachineHost与受控原生子进程的普通委派、取消、恢复和去重测试，仍无真实工具委派或当前EXE证据。节点与MCP返回八项三态能力和静态来源，静态声明不是现场推理证明；原拒绝只凭匹配原operationId收据结算。[能力与恢复完整契约](iterations/I07/connection-capabilities.md)。

## 3. 控制与上下文能力

| 能力 | Claude | OpenCode | Codex | Hermes / Pi / DSH（含 NEXT 与服务入口） |
| --- | --- | --- | --- | --- |
| 新建真实原生任务 | 已实现，有真实证据 | 已实现，有真实证据 | 已实现，有真实/失败环境记录 | 已实现；Hermes Linux、DSH NEXT 与 DSH Web 有真实执行证据，Pi 按受控证据登记 |
| 原生同会话续聊 | 已实现，当前WSL真实通过 | 已实现，当前WSL真实通过 | 已有 WSL 实机证据 | Hermes Linux 与 DSH NEXT 已实测，Pi 与 DSH 其他入口按各自验证范围 |
| 读取实际任务结果/错误 | 已实现 | 已实现 | 已实现 | 已实现 |
| Bridge 权限回复 | 已实现，具体控制类型见报告 | 专用 HTTP 入口已实现，受原生版本契约限制 | 专用入口未适配 | 专用 CLI、DSH Desktop/Web 未适配；DSH ACP 与自定义 ACP 在本地 `ac393cf` 可拒绝或单次允许，公开 ACP 包返回取消 |
| Bridge 结构化输入表单 | AskUserQuestion 当前拒绝 | 已实现受支持类型 | 未适配 | 未适配 |
| 取消与终态核对 | 已实现，有限定真实证据 | 已实现，有限定真实证据 | 进程树/进程组控制已实现，覆盖见报告 | Hermes网关取消未适配，false；Pi/DSH原实现与证据保留 |
| 原请求持久查询与 unknown 保护 | 已实现 | 已实现 | 已实现 | 已实现 |
| ACP 接入路径 | 自定义 ACP，需另装适配器，待实机验证 | 自定义 `opencode acp`，Windows 已验原会话新建与恢复 | 自定义 ACP，需另装适配器，待实机验证 | DSH ACP 有专用入口；Hermes 自定义 ACP 0.22.5 已在 Windows 验证真实任务、原 Session 续聊、取消和原请求读取；Pi 自定义 ACP 需另装适配器，待实机验证 |

当前经典 MCP 提供十个工具：`delegate` 默认新建子会话，可传原 `conversationId` 继续同一调用身份拥有的原会话；须目标当前授权、上一轮明确终态及原宿主可续聊，不接受目录变更。新托管父执行不能接管旧父委派；独立接入仍按原 connectionId 归属。已有续聊不等于运行中任意消息注入或任务订阅，也没有父完整历史复制。[当前实现与证据边界](iterations/I08/web-agent-development.md)。TeamSpace 的公共材料与原生 Agent 私有对话仍分开；既有原生父模型证据见相应入口的验收记录。

## 4. 后续目标与完成条件

后续先细化 Agent 身份、调用方/上下文归属和接入生命周期三项契约，再推进共享资源、结果/事件与一个真实 Super-agent 闭环。它们复用CT-06/07/08和M02/M03/M06/M07/M08落点，不改已有编号；登记/端点/命名调用第一片已有新RPC/字段及受控证据，独立调用方/上下文/凭据和原事件查询也已实现，真实原生和完整矩阵仍待；完整状态见[开发台账](iterations/I08/interconnect-development.md)。下表保留各 CT 的实际实现状态；可选小队/自动协调的完整度不作为连接核心完成条件，已知故障与未测证据仍保留。[当前优先级与验收定义](iterations/I08/interconnect-boundary.md)。

各目标的当前源码、受控验证、原生实测和发布范围按行登记。列出的后续工作按其完成条件单独验收。

| 目标 | 关联既有功能 | 交付内容 | 完成条件 |
| --- | --- | --- | --- |
| CT-01 能力口径一致 | AB-F02/07/10/13；M01/M02/M03/M06/M07/M08 | 源码已实现八项三态能力、静态来源与方向门禁，原关系拒绝可恢复 | 源码/受控验收通过：桌面503/503、核心45/45、Windows5组；真实新工具/新EXE/独立SSH未验，[完整证据](iterations/I07/connection-capabilities.md) |
| CT-02 六种原生连接实测 | AB-F07/10/11/13；M06/M07/M08 | 原三工具 WSL [直接生命周期](iterations/I07/connection-native.md)及六个[真实委派方向](iterations/I07/connection-delegation.md)通过。Hermes、Pi、DSH 的后续实测按上表登记 | 各 Agent 的真实母子调用、当前包、故障恢复和生产 SSH 尚待补全 |
| CT-03 ACP 接入 | AB-F07/10/11；M06/M07/M10 | DSH ACP 独立入口及自定义 ACP v1 stdio 已实现，当前源码支持原任务工具权限回复 | 各发布方命令与实测见用户接入表，原操作回复见[本轮记录](iterations/I08/acp-permission-reply.md) |
| CT-04 公共工作材料与 MD 视图 | AB-F20/21；M01/M02/M06/M07/M08 | 源码已实现只读索引/Markdown与准确修订，桌面阅读/复制/当前页索引或单份MD下载已补；CT-05只读选材包已补，完整产物/交接视图与同步待开发 | 桌面入口541/541及Windows八组通过、模型0；较早真实Claude一个Task保留原证据。MD是视图，授权、任务/收据和可达性分别核对；[完整证据](iterations/I07/public-materials.md) |
| CT-05 显式共享上下文 | AB-F08/11/20/21；M01/M02/M06/M07/M08 | 公开alpha.63实现同工作原包持久传递、目标接入收据和桌面只读审计；原选材/预览/本机副本保留 | 当前源码944/944，冻结63原生Pi→固定源码Hermes组件7组已通过，模型0；接入收据不代表模型理解、业务验收或文件可达，Windows包内14项/新审计页面5组/普通EXE6组通过，完整CT-05继续核对。[当前传递与证据](iterations/I07/context-delivery.md) |
| CT-06 通用 MCP 调用方 | AB-F02/07/08/11/12/13；M01/M02/M03/M06/M07/M08 | Bridge 可管理独立调用方、上下文及凭据，按具体入口管理或导出原生配置。支持在核对原归属后读结果和事件 | 逐入口验证原生配置的实际加载、工具可见、调用及撤权。托管会话注入单独核对。[MCP 接入记录](iterations/I08/mcp-open-integration.md) · [独立调用方](iterations/I08/interconnect-caller-contract.md) |
| CT-07 Agent侧连接操作面 | AB-F02/07/08/10/11/13；M01/M03/M07/M08 | list_agents按原身份返回当前获准连接；list_delegations只读查原委派；普通子会话附最小说明 | 三项已源码/受控覆盖，最新冻结667/667、定向121/121及Windows36/36，模型0。身份、撤权、原请求和无新增工具授权保持；[最新上下文与首次失败](iterations/I07/delegation-context.md)。整合包/真实消费及完整I06C/I07C未准出；[完整目标](iterations/I07/agent-centric-operations.md) |
| CT-08 多主关系与连接管理 | AB-F02/07/08/10/11/12/13；M01/M03/M07/M08 | 单主collaboration关系泛化为按身份relations[]并迁移；新增list_connectable/connect_agent/disconnect_agent与envelope预授权及确认流；Bridge界面收缩为接入配置、策略与审计 | 关系重构与行为变更分片验收，旧数据迁移可核对；Agent不能自批envelope外关系，撤权即时生效；data-model/protocol同轮同步。A3已随60公开；alpha.62收敛配置/审计与原执行恢复，Pi双平台/Hermes原生组件已验；真实父模型与日常多主待验；[本片证据](iterations/I07/connection-policy.md)，[完整定义](iterations/I07/agent-centric-operations.md) |

下一步聚焦各入口的真实交互、跨机和原请求恢复。原三工具的 WSL 委派、Hermes 执行、DSH NEXT 与 DSH ACP 的 Windows 实测各自保留版本和环境。材料传递、可选小队和多主管理的范围见上表。[当前调用验收](iterations/I08/current-scope-audit.md) · [ACP 入口与限制](iterations/I08/acp-stdio-runtimes.md)

## 5. 核对入口与证据

- 原生注册：[builtin-adapters.cjs](../desktop/electron/builtin-adapters.cjs)、[MachineHost](../desktop/electron/machine-host.cjs)、[自研指南](custom-agent-development.md)。
- DSH服务协议：[认证、连接与发现](../desktop/electron/dsh-connection.cjs)、[原请求轮次观察](../desktop/electron/dsh-worker.cjs)、[当前交付与使用](iterations/I07/dsh-desktop-web.md)。Desktop/Web共用HTTP协议，原headless CLI独立保留。
- 原生协议：[ClaudeHost](../desktop/electron/claude-host.cjs)、[CodexHost](../desktop/electron/codex-host.cjs)、[OpenCode HTTP 客户端](../src/drivers/opencode-client.ts)、[服务启动](../src/native-server.ts)、[新增 CLI 协议](../desktop/electron/native-cli-protocols.cjs)。Claude 的 `sdk-ts` 环境标记不能作为采用 Claude Agent SDK 的证据。
- Agent 调用入口：[MCP 服务实现](../desktop/electron/mcp-client.cjs)、[受限 broker](../desktop/electron/collaboration-broker.cjs)、[路由与任务归属](../desktop/electron/agent-network.cjs)、[TeamSpace](../desktop/electron/team-space.cjs)。`mcp-client.cjs` 虽沿用旧文件名，对原生 Agent 这一侧实际响应 MCP server 方法。
- 实际覆盖：[M06报告](modules/06-native-adapters/test-report.md)、[Claude报告](modules/06-native-adapters/claude/test-report.md)、[OpenCode报告](modules/06-native-adapters/opencode/test-report.md)、[Codex报告](modules/06-native-adapters/codex/test-report.md)、[M08报告](modules/08-collaboration/test-report.md)、[新三种受控验证](iterations/I07/native-agent-expansion.md)、[真实三成员](iterations/I07/native-members.md)。
- ACP、Multica、公共文档和上下文方案的外部来源、取舍与未验证项统一见[连接研究](iterations/I07/connectivity-research.md)。

## 6. 产品研究带来的候选细化

[Claude Projects、Dots与Grok Bot研究](iterations/I07/projects-dots-bots-research.md)建议在CT-04/05中细化公共材料短索引、产物目录、可见交接、相关版本按需读取；Agent名片和结果入口优先复用已有登记/能力/任务记录。它们是方案建议，不更改本表实际能力或验收状态。

Grok Build 的 `grok agent stdio` 已列入自定义 ACP 命令表，当前未做本机运行验证。Claude Projects协调器、Dots与Grok Bot的产品间通信也不能据文档推定为Bridge已支持的开放控制接口。自动续接、多用户、云端规划仍不作为后续目标。

## 7. 方式选择与快速接入

原生CLI、原生API、MCP、ACP、插件、SDK的优点/代价、可实现功能与前提统一维护在[接入选型指南](agent-integration-guide.md#2-六种方式的优缺点与适用场景)，不将后续推荐混进本页已接入状态。指南结合本表说明[逐Agent建议](agent-integration-guide.md#4-结合当前矩阵的后续推荐)及[已有入口与新Agent的快速路径](agent-integration-guide.md#5-如何快速接入)。其他 ACP Agent 的发布方命令与注册步骤见[用户接入表](user/agents/index.md#连接其他-acp-agent)。
