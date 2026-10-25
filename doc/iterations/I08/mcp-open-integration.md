# I08-MCP02：开放MCP接入、双向配置与原生可见性

当前MCP02-T16子范围已补：[alpha.63普通EXE/原版Pi工作MCP生命周期](native-mcp-lifecycle.md)七组通过，三个实际解包目录删除后原生仍可读取，完整后台重启/原生重开后原身份和接收收据保持，WSL十五分钟180/180与重开/撤权六组也已完成，模型0。仅这些组件/环境通过，其他十入口/经典独立连接/跨版本/托管父模型与整体T01–T18仍未准出；下文的“待执行”保留对应历史版本时点。

后续当前证据：[2026-10-25公开alpha.60原生十工具组件](native-policy-components.md)已完成Pi/Linux、Pi/Windows及固定源码Hermes/Linux各7组，涵盖T01/T04/T05/T07/T13/T15的协议/身份子项，模型0；逐入口真实父模型、托管归属和完整T01–T18仍未准出。下文保留原设计/交付时点。

日期：2026-10-22（Asia/Shanghai）。当前本地候选为 **alpha.46**，本轮恢复修复、非GUI首次接入、工程验证与Windows交付见[后续开发记录](mcp-open-recovery.md)。§11–§14保留各次原始证据和版本边界；逐入口真实原生增删、真实主调用与托管归属仍未全部验收，完整MCP02未准出。公开版本仍为alpha.36。

关联既有功能：AB-F02/F07/F08/F11/F12/F13；M01-F01/F02/F04/F05、M06-F02/F04/F05、M08-F01/F02/F03/F05/F06，并涉及M02/M03/M04/M05/M07/M10/M11。承接[独立MCP配置](../I07/mcp-installation.md)、[CT-06通用调用方规划](../I07/agent-centric-operations.md)与[OpenDesk前端门禁修复](opendesk-ui-admission.md)，不重编号既有功能，不取代完整I06C/I07C准出。

## 1. 交接目标与用户要求

本迭代统一用户看到的MCP接入：**一个AgentBridge MCP，既能从Bridge添加/移除，也能从Agent自己的MCP界面或配置添加/移除；配置后必须能在原生Agent的MCP列表看到，实际工具可以按授权使用。**

用户已明确以下要求，接手Agent不应再次讨论是否需要支持：

1. 不把“原生配置MCP”和“创建会话注入MCP”作为两种需要用户选择、分别安装的产品入口。会话身份和权限处理留在内部。
2. 所有已接入Agent按同一标准补齐MCP配置与移除。当前优先修复OpenDesk、补齐DSH，并核对Claude/Codex/OpenCode/Hermes/Pi；不能因未适配就断言原生产品不支持MCP。
3. Bridge不是唯一配置入口。用户可以在Agent里手动添加、禁用、编辑或删除AgentBridge MCP；Bridge必须识别实际状态，不能自动补回已删除条目。
4. 添加后在Agent自己的MCP列表可见，能核验连接与工具；写文件、生成配置、显示图标都不能单独算作接入完成。
5. 主Agent资格按实际MCP调用能力和授权判断，不能再因“托管会话注入未适配”就一概禁止独立MCP调用方成为主Agent。具体执行仍需保留正确的任务归属。

“移除/取消MCP”在本文指移除配置或撤销连接授权，不是取消模型任务。移除MCP不自动停止或重发已经派发的原任务。

## 2. 开发基线与已知缺口

公开预发布仍为alpha.36，本地候选alpha.43；日常窗口alpha.43复用alpha.42后台的现场记录见[上一轮交付](opendesk-ui-admission.md)。接手后重新只读核对实际源码、包和运行后台，不能按版本标签推断新功能已部署。工作区已有大量未提交增量，应在现有状态上做定向修改，不清空、回滚或覆盖他人改动。

以下为本次源码核对结果，不是本迭代新功能验收：

| 入口 | 当前配置适配 | 当前调用方与会话边界 | 本迭代工作 |
| --- | --- | --- | --- |
| Claude Code | 有原生MCP添加/移除/导出 | 有托管协作路径，历史真实证据另列 | 回归双向管理、原生可见、状态与授权隔离 |
| Codex | 有原生MCP添加/移除/导出 | 有托管协作路径 | 同上，不将历史列表验证推定为当前连接/模型成功 |
| OpenCode 1.x/2.x | 有原生MCP配置，协议布局不同 | 常驻服务可能需要重新加载配置 | 两代布局、重载与实际工具目录分别验证 |
| OpenDesk CLI | 有原生配置适配 | 静态bridgeMcp=true，teamCollaboration=false；前端仅允许旧三种调用方 | 拆开能力语义，验证原生列表和独立实际调用、主角色授权 |
| OpenDesk Windows Desktop | 有原生配置适配 | 同CLI；桌面执行还依赖原网关连接 | 同上，单独核对Windows实例与原生重载行为 |
| DSH CLI | 无Bridge MCP配置适配 | bridgeMcp=false，teamCollaboration=false | 核对headless入口真实客户端能力，再补配置/连接/调用 |
| DSH Windows Desktop | 配置弹窗目前只管理服务连接 | 同上；原生HTTP执行不等于MCP调用 | 单独核对该桌面入口并补齐 |
| DSH Linux / WSL Web | 配置弹窗目前只管理服务连接 | 同上 | 单独核对该Web入口并补齐 |
| Hermes、Pi | 无Bridge MCP配置适配 | 当前为直接执行/普通被委派目标 | 纳入同一兼容盘点与逐入口适配，不能遗漏 |

关键缺口：

- [前端能力判断](../../../desktop/src/connection-capabilities.ts)的调用方白名单只允许Claude/Codex/OpenCode，且将teamCollaboration=false折算为不能调用MCP。
- [后台注册与能力投影](../../../desktop/electron/builtin-adapters.cjs)也存在将托管协作能力收窄到bridgeMcp的处理。原始节点、快照、前端与实际执行应逐层检查，不能只删除前端限制。
- [MCP配置状态](../../../desktop/electron/mcp-integration.cjs)当前installed主要依据登记有效及配置条目匹配，没有形成所有入口统一的“原生已加载、连接成功、工具可用”证明。
- [原生配置](../../../desktop/electron/mcp-config.cjs)有格式和所有权保护，但外部编辑/删除、别名条目、重新加载和授权撤销的状态还需形成完整规则。
- [托管scope](../../../desktop/electron/machine-host.cjs)对teamCollaboration=false的入口拒绝配置；[协作路由](../../../desktop/electron/agent-network.cjs)分别处理原父任务和独立connectionId。不能用长期连接身份代替一次托管任务的身份。
- 现有标准stdio服务与broker可复用，不需要另建协作协议、模型API或业务台账。[服务端](../../../desktop/electron/mcp-client.cjs)、[broker](../../../desktop/electron/collaboration-broker.cjs)。

## 3. 范围与边界

产品目标覆盖当前七种产品、十个执行入口。OpenDesk与DSH是首批必须交付的重点，其他入口按相同规则回归或补齐；每个入口单独记录完成度。某入口确无可用原生MCP客户端时，必须给出原生源码/本地帮助/实际接口和版本证据，标为明确缺口，不将整迭代宣告完成。

只在Bridge侧开发，优先使用已安装Agent的既有配置、CLI、API或原生扩展能力。不修改或构建OpenDesk，不fork DSH，不要求用户安装Bridge定制原生包。若发现必须改变原生产品才能满足的缺口，先完成其他可交付部分并记录具体证据，不能静默扩大范围。

开放接入以标准MCP客户端和既有授权身份为基础，不要求调用方通过Bridge窗口添加配置；不要求新开公开网络端口或增加新的远程传输。首选现有stdio、受保护的本机描述文件和已认证机器路由。通用配置可被兼容客户端手动使用，但不因此获得任意执行适配器、自动主角色或全局访问权限。

本迭代不建设第三方MCP市场或通用MCP服务器管理器，只管理/识别AgentBridge自身连接，并保留其他MCP。CT-08多主关系迁移、ACP、模型/账号管理和小队扩展不作为前置。当前用户明确要求的本专项可先推进，无需等待旧规划中完整I07C全部完成；各执行入口的真实能力与未测边界仍须如实记录。

## 4. 用户流程与需求编号

| 需求 | 行为与成功标准 |
| --- | --- |
| I08-MCP02-R01 统一入口 | 每个Agent节点的“配置”使用一致的AgentBridge MCP操作与状态；DSH服务连接单列，不能替代MCP配置；不展示两种MCP安装模式 |
| I08-MCP02-R02 Bridge添加 | 在目标机器、原生用户/profile中写入或引用原生支持的配置，保留其他设置；重载后原生MCP列表出现AgentBridge，并能核验工具 |
| I08-MCP02-R03 Agent自行添加 | 用户可在原生Agent导入标准配置；取得有效连接配置与授权不强制打开Bridge窗口；Bridge只读识别已接入事实，不重复写入或重复创建身份 |
| I08-MCP02-R04 Bridge移除 | 先持久撤销该连接授权，再删除归属明确的原生条目；删除失败显示“已撤权，配置待清理”，不能恢复授权或假称条目已消失 |
| I08-MCP02-R05 Agent自行删除 | Agent侧删除后，Bridge刷新显示原生配置已移除，不自动补回；正在运行的客户端是否仍缓存连接须另行显示，不能假称全局撤权 |
| I08-MCP02-R06 外部修改/禁用 | 保留手动修改；识别启停与配置冲突；不按名称猜归属、不静默覆盖或重新启用 |
| I08-MCP02-R07 原生可见与可用 | 分别证明配置存在、原生已加载、连接握手、工具目录与获准只读调用；无原生图形列表的CLI用其自身的MCP list/等价入口验证，不能用Bridge界面代替 |
| I08-MCP02-R08 调用与主角色 | 配置、实际MCP调用、托管任务能力分别判断；已验证的独立调用方可选择主角色并保存子节点授权，再在原生Agent发现/委派/读回原结果 |
| I08-MCP02-R09 任务归属 | Bridge托管任务保留原parentRequest/Task/Conversation作用域；独立会话归属connectionId，不伪造父Task，不降级到无任务绑定的全局身份 |
| I08-MCP02-R10 机器与生命周期 | Windows、WSL、SSH各自在正确环境管理配置；关闭Bridge窗口后后台存在时原生MCP仍可用；重开/升级不因临时解包路径失效或恢复已撤销连接 |
| I08-MCP02-R11 恢复与兼容 | 原requestId/operationId、历史授权和unknown占用保留；配置操作丢回应先核对原状态，不换ID重做；旧客户端/后台缺新能力时明确未知或需升级 |

### 4.1 Bridge侧添加

用户进入原机器的Agent配置，查看当前原生配置与连接状态；选择添加后Bridge完成身份登记和精确写入。原生支持热加载时核对实际加载；否则显示“配置已保存，需要在原生Agent重新加载/重开”，不得提前显示连接成功。完成后原生列表只有一条对应连接，可通过获准工具验证。

### 4.2 Agent侧自行添加

必须提供无需Bridge窗口的连接登记/配置取得与撤销入口，复用已有身份、认证、授权服务；优先补入现有CLI或目标机器管理入口。当前[src/cli.ts](../../../src/cli.ts)尚无本专项MCP管理命令，**不可把待开发命令当作现成用法**。首片需冻结实际命令、参数、原profile定位、只读状态与错误返回，并同步帮助和协议。

非GUI入口至少提供：为明确目标机器/节点登记受限连接、生成原生格式与通用格式的标准配置、查询同一连接状态、显式撤销原连接。导出本身只准备配置与身份，不伪造原生已安装；用户在Agent中完成添加后，Bridge刷新识别同一登记，不再创建第二条连接。取得/使用授权可以有既有校验，不能强制回到Bridge界面操作。

如仍需节点接入授权，必须能通过同一已认证的非GUI入口完成；不得要求先在Bridge界面点“接入”、启动一次模型或创建托管执行会话才能配置MCP。用户明确断开/撤权后的新调用仍受授权限制，不能因开放配置而绕过。

配置格式是各原生客户端实际接受的格式，不强制它们读取同一个文件。若需配置片段或独立文件，必须写入/引用原生实际读取的入口；不能只把JSON放到Bridge目录就算配置完成。输出不展示明文Token，继续引用受保护的运行时描述文件。不同机器不能直接复用同一份含本机路径的配置。

### 4.3 Agent侧删除与授权撤销

Agent侧删除一条配置，只证明该配置来源不再加载该条目，不能自动证明已缓存的会话或其他副本失效。Bridge须显示“配置已移除”及单独的授权状态；本迭代默认不因单份配置消失就撤销所有副本的连接授权，需提供明确的“撤销连接授权”操作，且非GUI入口同样可用。

Bridge侧“移除AgentBridge MCP”继续执行撤权再删除的完整语义；同一授权的旧配置副本随后调用必须被拒绝。无论从哪侧删除，配置监听、后台restore、开窗、重扫或升级都不能自动安装回来。恢复动态端点与自动重写原生配置是两件事，恢复逻辑必须分开。

## 5. 内部设计约束

### 5.1 同一个MCP，内部区分连接身份与任务身份

```mermaid
flowchart LR
  U[用户通过Bridge配置] --> C[Agent原生MCP配置]
  N[用户通过Agent配置] --> C
  C --> L[原生MCP列表加载AgentBridge]
  L --> S[同一标准MCP服务]
  S --> A[连接认证与当前授权校验]
  A --> E[独立连接归属]
  A --> T[可证明的原托管任务归属]
  E --> R[统一工具路由与持久台账]
  T --> R
```

保留内部scope用于约束调用属于哪次原任务、何时停止新委派；不要求用户重复安装，不允许向同一个原生列表堆叠两个含义相同的Bridge条目。适配器可使用原生支持的会话参数、环境或配置覆盖传递受保护的上下文引用；调用者不能仅靠工具参数自报machineId/nodeId/parentTask获得权限。

如果某原生入口不能证明单个托管会话身份，应保留独立MCP调用能力，并明确该托管执行路径未完成；不能为开启协作而把所有会话归到一个长期全权Token，也不能因此禁用独立配置/主角色。首次原生主调用链与Bridge发起的托管主调用链分开验收，前者通过不代表后者通过。普通被委派子任务仍不得扩大连接关系或自行变为主Agent。

### 5.2 能力拆分与主Agent准入

下表为**待实现的语义契约，不是现有字段或已发布接口**；开发时选择可兼容的字段名，并在协议/类型中冻结：

| 维度 | 回答的问题 | 禁止的推断 |
| --- | --- | --- |
| 原生配置适配 | Bridge能否正确管理该原生入口的MCP条目 | 有配置格式不等于连接已成功；无自动写入适配不代表标准MCP不兼容 |
| MCP调用支持与实际就绪 | 该入口是否实现MCP客户端，当前连接是否已验证、授权是否有效 | 不用teamCollaboration或三种产品白名单代替判断 |
| 托管任务绑定 | Bridge发起的本次任务能否绑定其真实scope | 未适配只限制该执行场景，不否定独立原生调用 |
| 原生执行/普通被委派 | Bridge是否能驱动该节点，是否能接收普通任务 | 与MCP调用方向独立，不因MCP故障隐藏已有直接执行或旧结果 |

“设为主Agent”的候选判断与“已经获准向哪些节点委派”分开，避免要求先成为主才能检测MCP、又要求先检测MCP才能设主的循环。新委派仍核对当前主角色、已保存子节点、调用身份和目标能力；不允许通过安装配置自动给自己扩大关系。默认单主关系保持，CT-08多主化不在本次迁移范围。

删除/禁用MCP后主角色历史可保留，但新的委派应被阻止并说明真实原因；不能自动清空原关系、旧任务或unknown占位。前端、中央、MachineHost、WSL/SSH daemon、标准MCP调用必须使用同一套语义，不能只修改按钮或静态能力位。

### 5.3 状态事实、外部配置与所有权

建议实现以下独立观测字段，均为本迭代提案，旧字段须兼容迁移；具体枚举在开发第一片冻结：

| 状态事实 | 建议表达 | 证据来源 |
| --- | --- | --- |
| 配置 | 不存在/存在/已禁用/冲突/未知，配置来源与准确profile | 实际原生配置文件或原生配置API |
| 原生加载 | 已加载/未加载/需重载/无法探测/未知 | 原生MCP列表或等价原生接口 |
| 连接 | 已连接/未连接/已撤权/未知 | 原生连接状态与MCP握手，Bridge后台状态仅为其中一环 |
| 工具 | 可用/未授权/不可用/未知 | tools/list及获准只读调用，不靠模型文本自报 |
| 授权 | 有效/已撤销/未知 | 目标Bridge的持久授权记录 |
| 归属 | Bridge管理/原生外部管理/未确认 | 条目与已登记connectionId、配置摘要和机器/profile匹配 |

不能把配置不存在误报为连接已全局撤权，也不能把tools/list成功误报为有权委派任何Agent。探测失败返回未知/具体失败；只读刷新不自动写配置、恢复启用、重新注册或启动模型。没有原生列表探测能力时保留“无法核验”，该入口不能通过完整可见性验收。

同名agentbridge或AgentBridge只是显示名称，不能作为管理所有权依据。识别已登记连接时核对受保护引用、启动配置及目标环境；外部别名条目可显示实际归属，不能重复添加。未知来源、条目被修改或并发变化时保留原配置；要写入或接管必须有明确用户操作并重新核对，不能静默认领。

### 5.4 删除、重启和升级

Bridge自己的添加/移除需原子写入、冲突检查和稳定管理操作标识；旧配置缺少新元数据时按未知或外部管理处理，不能自动安装。撤权成功但配置清理失败应保留可恢复状态，恢复只核对原操作，不撤销已完成的撤权。

Windows/WSL/SSH在目标环境执行原生配置读写；同名节点不混写、多个profile不相互覆盖。稳定stdio启动器与私有描述文件不能依赖便携EXE的临时解包目录；GUI关闭而后台仍运行时可用。旧后台缺少新增状态/配置能力时明确需升级，不以默认true绕过；真实SSH需独立验收，不因Windows EXE升级而宣称远端已更新。

## 6. 模块与源码落点

| 模块 | 主要开发责任与入口 | 同轮同步 |
| --- | --- | --- |
| M01 桌面 | [Agent配置](../../../desktop/src/AgentConfigurationDialog.tsx)、[MCP状态与动作](../../../desktop/src/McpSettings.tsx)、[能力判断](../../../desktop/src/connection-capabilities.ts)、[主角色按钮](../../../desktop/src/CollaborationChoice.tsx)、[图关系校验](../../../desktop/src/graph-state.ts)、机器页/关系图共用 | 完整设计/报告；不把内部scope做成新的用户安装模式 |
| M02/M03 中央与网络 | [Coordinator](../../../desktop/electron/coordinator-service.cjs)、[AgentNetwork](../../../desktop/electron/agent-network.cjs)、CLI非GUI配置入口；统一调用身份、能力、状态和原操作恢复 | 设计/报告、architecture/data-model/protocol |
| M04/M05 远端 | [SSH路由](../../../desktop/electron/ssh-host.cjs)、[daemon](../../../desktop/electron/machine-daemon.cjs)、维护准入与真实目标配置；新增方法不得漏转发/白名单 | SSH/Linux设计与报告、兼容能力与升级条件 |
| M06 原生适配 | [McpConfig](../../../desktop/electron/mcp-config.cjs)、[McpIntegration](../../../desktop/electron/mcp-integration.cjs)、[注册表](../../../desktop/electron/builtin-adapters.cjs)、[MachineHost](../../../desktop/electron/machine-host.cjs)、各原生Host；逐入口配置和原生加载验证 | 总模块与受影响子模块设计/报告、接入矩阵、选型指南 |
| M07/M08 会话与协作 | [broker](../../../desktop/electron/collaboration-broker.cjs)、[MCP服务](../../../desktop/electron/mcp-client.cjs)、[连接视图](../../../desktop/electron/agent-connections.cjs)、原父/独立连接所有权及主角色授权 | 设计/报告、身份/迁移/协议与旧任务保护 |
| M10/M11 包与文档 | 稳定运行时、Windows便携包、Linux离线资源和用户页；规划不冒充当前功能 | 打包设计/报告、testing/project-plan、doc/user与网站检查 |

## 7. 开发顺序与每片交付

| 顺序 | 交付内容 | 进入下一片的条件 |
| --- | --- | --- |
| A 兼容核对与契约冻结 | 先只读核对十入口的原生MCP客户端、有效profile、格式、加载/删除接口；记录版本与证据；冻结能力、状态、非GUI入口、迁移与删除语义 | OpenDesk/DSH各入口给出真实结论；不可用项有具体缺口，不能以猜测填路径 |
| B 公共配置与双向同步 | 独立身份登记/非GUI配置取得、原生外部编辑识别、精确写入与撤权、状态观测和重启恢复 | 受控测试证明外部删除不补回、冲突保留、只读无副作用、撤权不复活 |
| C OpenDesk与DSH逐入口 | 首先打通两个OpenDesk入口，再逐个DSH CLI/Desktop/Web；同步回归旧三种及Hermes/Pi | 每完成一个入口先通过真实原生列表、增删与协议工具调用，不批量改能力位冒充完成 |
| D 主角色与任务归属 | 拆开独立调用方/托管能力、移除旧三工具白名单、统一前后台准入；原生主调用链与托管主调用链分别验证 | 独立主能只发现获准子节点、委派并读原结果；托管路径不丢父归属、不扩大子权限 |
| E 界面与交付 | 统一配置/状态、外部操作反馈、旧后台提示；冻结源码打包并验证最终普通EXE | 满足验收表，更新全部受影响设计/报告；未完成项明确保留，不以全套单测替代原生实测 |

每片在本页追加需求完成度、源码/测试指纹、失败与修复、实际环境和未测项。公共契约先落地，避免每个Agent各做一套状态和授权。遇到原生能力缺口可继续推进不依赖它的其他入口；不能把“仅被委派”当成本专项已经完成的替代结果。

## 8. 验收用例与证据层级

以下全部为**待执行验收**，不是本轮通过记录。

| 用例 | 场景与通过标准 | 证据层级 |
| --- | --- | --- |
| MCP02-T01 | Bridge添加后原生MCP列表出现唯一对应连接，tools/list及获准只读调用成功 | 每个入口真实原生，模型0即可验证协议 |
| MCP02-T02 | 不打开Bridge窗口，通过非GUI入口取得配置，再由原生Agent手动添加；识别同一连接，无重复条目/身份 | 真实原生＋生产后台 |
| MCP02-T03 | 原生自行删除后Bridge显示配置移除；重扫/重开窗口/后台重启/升级均不补回 | 受控回归＋真实原生 |
| MCP02-T04 | 原生自行禁用/编辑、别名引用、重复配置、并发修改均保留；无法判定归属时不覆盖 | 受控回归＋代表性原生配置 |
| MCP02-T05 | Bridge移除先撤权再删配置，原生重载后列表消失；旧凭据与复制的配置调用均被拒绝 | 实际MCP协议＋原生列表 |
| MCP02-T06 | 撤权成功但配置删除失败；准确显示两个状态，后台重启不能复活旧授权；恢复endpoint失败仍可撤权 | 故障注入＋生产后台 |
| MCP02-T07 | 单份原生配置删除不冒充全局撤权；缓存会话与其他副本状态分别核对，显式撤权后全部拒绝 | 实际协议，无需模型 |
| MCP02-T08 | 写配置成功但原生未加载/握手失败/tools不可用；不得显示已连接或完整可用 | 受控反例＋真实重载 |
| MCP02-T09 | Windows、WSL、SSH及多profile同名入口仅影响原目标；另一环境配置逐字节保持 | 受控回归；宣称SSH通过需独立SSH证据 |
| MCP02-T10 | OpenDesk/DSH已验证调用方可设主并保存授权；未完成托管注入不使独立调用失效 | 生产界面＋真实独立MCP |
| MCP02-T11 | 主Agent只发现获准目标，原生会话真实委派并读取原任务结果；未授权/撤销关系后新委派拒绝 | 真实原生主子模型链，按当轮授权执行 |
| MCP02-T12 | 托管协作委派匹配原父；结束/切换/并发会话不串身份，不能降级到长期独立连接绕过 | 受控完整链＋已支持入口真实消费 |
| MCP02-T13 | 普通子节点不因安装MCP自动获得扩大关系或继续委派权限；不能通过工具参数伪造身份 | 原生协议/生产broker反例 |
| MCP02-T14 | 移除/改配置不取消或重发原任务；原requestId/operationId/Task/Conversation/unknown占用保留 | 受控持久台账＋原ID核对 |
| MCP02-T15 | 移除后重新添加使用新授权身份，旧配置失效；历史结果在合法查询入口仍保留 | 生产后台＋协议调用 |
| MCP02-T16 | GUI关闭时后台仍可服务原生MCP；普通EXE重开/后台重启/临时解包目录变化后稳定路径仍有效 | 最终Windows普通EXE，无调试参数 |
| MCP02-T17 | 原生不支持/无法检测与旧daemon缺能力分别显示，不批量放开；受支持的旧三种入口不回归 | 受控界面＋真实原生 |
| MCP02-T18 | 不相关MCP、模型/账号/Skills、原生配置注释和原文件修改均保留；无明文凭据写入日志/公共文档 | 临时配置字节对照与证据审计 |

所有十入口至少填写：原生产品/入口/版本、OS/profile、Bridge源码/包/后台版本、添加方、删除方、原生列表结果、握手/工具结果、只读调用、主调用链、托管任务绑定、失败、原始证据和未测项。同一组共享测试不跨模块叠加；模型0的配置验证不算真实模型委派，HTTP/WS执行成功不算MCP成功。

新增工程测试应围绕以上实际行为，特别覆盖前端、Coordinator、MachineHost、MCP服务和远端入口，不只测试helper或复制实现逻辑。复用[现有MCP测试](../../../desktop/tests/mcp-integration.test.cjs)、[能力测试](../../../desktop/tests/connection-capabilities.test.cjs)、[原生列表脚本](../../../desktop/tests/linux-mcp-list-native.cjs)、[Windows界面脚本](../../../desktop/tests/windows-mcp-settings-ui.cjs)，先核对旧脚本是否真正覆盖本次新增入口和双向编辑。

工程收尾至少运行：根类型/lint/构建、受影响核心与桌面测试、生产前端交互、`node scripts/check-docs.mjs`、文档工具与用户站审计；运行代码交付需要新Windows EXE、包源码一致性、完整SHA-256、普通EXE及原生列表/协议验证。冻结后再打包，不用历史alpha.43的722/722或旧EXE冒充本迭代验收。不要为纯规划文档虚构模型或产品测试结果。

## 9. 完成标准、材料和禁止事项

每个入口的完成度必须能从“已核对原生能力 → 配置可管理 → 原生可见 → 连接/工具可用 → 主角色/真实委派 → 托管任务归属”逐项追溯。产品要求统一，实际完成度逐入口如实登记；重点入口存在未解决缺口时不可宣称本迭代全量完成。

交付前同步：[整体设计](../../product-design.md)、[接入矩阵](../../agent-integration-matrix.md)、[选型指南](../../agent-integration-guide.md)、[整体测试](../../testing.md)、[路线](../../project-plan.md)，每个受影响模块的完整design/test-report，以及发生变化的[架构](../../architecture.md)、[数据模型](../../data-model.md)、[协议](../../protocol.md)。用户行为落地后更新[用户MCP说明](../../user/connections.md)与各Agent页面，不提前把规划写成当前已支持。

必须留下：本页开发/验收记录、逐入口兼容表、受控与真实证据、首次失败与最终日志、冻结源码指纹、Windows EXE/摘要、未测项、后台和原生重载要求。不得仅修改一处能力白名单或弹窗文案就结束；不得改OpenDesk/DSH原生产品、回放原Prompt、清理unknown占位，或自动恢复用户删除的MCP。

本轮仅请求开发文档，不派发其他Agent、不修改真实配置或运行状态、不构建新包、不公开推送。接手Agent实施时按用户交接授权推进；公开源码/标签/发布及用户远端部署仍需其对应授权，本文件不代替该授权。

## 10. 交接轮文档交付记录（2026-10-22，规划轮）

本节记录交接/规划那一轮的文档核对结果，当时的状态是“全部需求待开发、全部MCP02验收待执行”。同日的实施与证据见[§11](#11-本轮开发记录2026-10-22)，两节不互相覆盖；alpha.43与公开alpha.36基线仍然不变。

已完成本轮文档核对：228份Markdown、15组模块设计/报告、4800本地链接、95 Mermaid、446既有用例，errors0；文档工具6/6通过，用户站18页/19HTML/158资源审计通过，内部页面/证据导出0，diff空白检查通过。15个相关运行与版本文件的修改前后SHA-256全部一致。证据位于`artifacts/mcp-open-plan/2026-10-22/`，包含`source-baseline.json`、`source-unchanged.json`、`docs-check.json`、`doc-tests.log`、`doc-build.log`。未运行产品测试或模型，未修改真实配置、运行后台或EXE，不将上述文档检查计入待开发功能验收。

## 11. 本轮开发记录（2026-10-22）

本轮按§7的 A（契约冻结）→B（公共配置与双向同步）→C（OpenDesk/DSH逐入口）→D（主角色与任务归属）→E（界面与交付，部分）推进。只修改Bridge源码、测试与文档；未运行模型、未写用户真实原生配置、未构建EXE、未公开推送、未改OpenDesk/DSH原生产品。以下所有“通过”仅指登记的受控测试或明确标注的真实原生证据；MCP02-T01..T18 的通过层级仍以§8为准，未通过项在§11.4与§11.8逐项保留。

### 11.1 本轮完成 / 未完成

| 状态 | 内容 |
| --- | --- |
| 已完成 | §5.2能力拆分落地并冻结；§5.3状态事实、所有权与撤权语义实现；新增 `mcp.revoke`/`mcp.probe`（含生产接线：候选→发现→PATH 解析原生可执行文件）；DSH Web原生适配（`insert:`行、注释保留、空层拒绝）；非GUI `agentbridge mcp` 入口；`mcp-open-access-v1` 能力标记与旧后台显式升级错误；桌面状态事实展示与主角色准入拆分；**Linux本机**机器的 `mcp.*` 本进程路由 |
| 未完成 | 十入口真实原生添加/删除/主调用与托管归属验收（T01–T18全部仍为“待执行”）；Windows/WSL/SSH现场；普通EXE/包核验；**WSL本机**机器的 `mcp.*` 路由（其文件系统不在本进程）；OpenDesk Desktop 原生读取核对（CLI 已在当日晚判定无MCP管理面，见[§12.7](#127-opendesk-cli-038-无-mcp-管理面结论升级与代码收敛2026-10-22-晚补)）；DSH Desktop原生配置路径（DSH CLI 已在当日晚补齐显式 profile，见[§12.5](#125-dsh-cli-显式-profile-原生配置2026-10-22-晚补)） |
| 明确不作结论 | 界面上“已添加”不等于原生已加载，`tools/list` 成功不等于已获准委派；本轮不以受控注入代替真实原生客户端 |

### 11.2 逐模块改动与源码落点

| 模块 | 本轮改动 | 源码 |
| --- | --- | --- |
| M06 原生适配 | 静态注册表改四维独立能力并保留旧投影名；契约校验器接受新能力名；`McpConfig` 增加DSH补丁层读写与注释保真；`McpIntegration` 增加状态事实、所有权比较、`revoke`/`probe`、撤权与清理分离；原生列表探测在生产路径可解析可执行文件（调用方候选→`scanTools`发现→PATH），并沿用目标环境的`CODEX_HOME`/`CLAUDE_CONFIG_DIR`/`OPENCODE_CONFIG_DIR` | [builtin-adapters.cjs](../../../desktop/electron/builtin-adapters.cjs#L71)、[agent-adapter-contract.cjs](../../../desktop/electron/agent-adapter-contract.cjs#L45)、[mcp-config.cjs](../../../desktop/electron/mcp-config.cjs#L109)、[mcp-integration.cjs](../../../desktop/electron/mcp-integration.cjs#L206) |
| M01 桌面 | MCP卡片改用逐项状态事实与逐项说明，DSH服务连接单列；能力门禁改 `nativeMcpConfig`，MCP调用能力 `mcpClient` 单独展示；主角色按钮区分“独立MCP可用但托管绑定未适配” | [McpSettings.tsx](../../../desktop/src/McpSettings.tsx#L19)、[connection-capabilities.ts](../../../desktop/src/connection-capabilities.ts#L1)、[CollaborationChoice.tsx](../../../desktop/src/CollaborationChoice.tsx#L4) |
| M02/M03 中央与网络 | `mcp.revoke`/`mcp.probe` 进入Coordinator白名单与AgentNetwork准备/路由；撤权与探测要求节点已接入且未移除，`status` 保持原契约；**Linux本机**机器在本进程内用 `localMcpHost()` 处理六个 `mcp.*` 方法，执行仍走原核心宿主；WSL机器继续走远端路径 | [coordinator-service.cjs](../../../desktop/electron/coordinator-service.cjs#L34)、[agent-network.cjs](../../../desktop/electron/agent-network.cjs#L110)、[coordinator-client.cjs](../../../desktop/electron/coordinator-client.cjs#L62) |
| M04/M05 远端 | daemon 方法集合加入新方法；撤权计入“配置变更”（维护期间拒绝），只读探测不计入 | [machine-daemon.cjs](../../../desktop/electron/machine-daemon.cjs#L21) |
| M07/M08 会话与协作 | 托管scope准入改为只看 `hostManagedTask`；独立MCP调用方可以作主，但托管注入被拒时给出独立原因；父任务/独立连接归属规则不变 | [machine-host.cjs](../../../desktop/electron/machine-host.cjs#L117)、[builtin-adapters.cjs](../../../desktop/electron/builtin-adapters.cjs#L119) |
| M09 CLI | 新增 `agentbridge mcp` 子命令，经运行中的桌面协调器私有socket访问，不打开窗口、不启动模型 | [cli.ts](../../../src/cli.ts#L50)、[mcp-command.ts](../../../src/mcp-command.ts#L1) |
| M11 文档 | 本页开发/验收记录、模块设计/报告、架构/数据/协议、矩阵/指南、测试/路线与用户页同步 | 本页与§11.5所列文件 |

### 11.3 冻结契约

#### 11.3.1 能力契约（落地§5.2）

每个入口分别回答四件事，禁止互相推断。`null`（缺省）表示**未确认**，`false` 表示**已核对为不可用**，两者不可互换。

| 入口 | `mcpClient` 可加载AgentBridge MCP | `nativeMcpConfig` Bridge可管理其原生MCP条目 | `hostManagedTask` 可注入单次托管任务scope | 结论 |
| --- | --- | --- | --- | --- |
| claude / codex / opencode | true | true | true | 独立调用、原生配置、托管注入三条都可用 |
| opendesk / opendesk-desktop | true | true | false | 可独立调用并作主；托管scope注入未适配 |
| dsh-web | true | true | false | 新增原生配置适配；托管注入未适配 |
| dsh-desktop | true | false | false | 有MCP客户端；原生配置路径未核对 |
| dsh | true | false | false | CLI profile由启动参数选择，Bridge不猜 |
| hermes / pi | 缺省→null | false | false | MCP客户端能力未确认，不是“不支持” |

冻结要点：

- 旧投影名 `bridgeMcp` 为 `mcpClient` 的别名，`teamCollaboration` 为 `hostManagedTask` 的别名，保留给旧节点/旧planner/旧界面；旧载荷只能**收窄**，不能启用。
- 删除“旧三产品白名单”和“`teamCollaboration=false` 折算为不能调用MCP”的折叠。
- 托管scope准入 `supportsTeamCollaboration` 只依赖 `hostManagedTask`（并要求 execution 与 mcpClient 已确认为真）；独立MCP准入 `supportsIndependentMcp` 只依赖 execution+mcpClient。两者互不替代。
- 契约校验器（`agent-adapter-contract.cjs`）把三个新名字加入允许集合；拼写错误仍被拒绝，远端元数据仍不能扩权。

#### 11.3.2 状态事实与状态枚举

`mcp.status` 返回单一 `state` 加六项**相互独立**的事实与证据；界面与CLI逐项显示，不合并成“已连接”。

| `state` | 含义 |
| --- | --- |
| `absent` | 无Bridge登记且无原生条目 |
| `exported` | 已登记/已生成配置，但原生条目不存在或未写入 |
| `installed` | 已登记且原生条目就是Bridge写入的那份 |
| `conflict` | 同名条目被外部修改、配置无法解析或不合法（原文件保留） |
| `revoked_config_pending` | 授权已撤销，但原生条目仍在（清理失败或尚未清理） |
| `unsupported` | 该入口没有Bridge可管理的原生配置路径 |

| 事实 | 取值 | 证据来源 |
| --- | --- | --- |
| `config` | absent/present/disabled/conflict/unsupported/unknown | 实际原生配置文件 |
| `nativeLoad` | loaded/not_loaded/reload_required/unsupported/unknown | 原生列表命令或产品自身补丁层语义 |
| `connection` | connected/disconnected/revoked/unknown | 原生连接握手；撤权时强制 `revoked` |
| `tools` | available/unauthorized/unavailable/unknown | Bridge stdio `tools/list`；撤权时强制 `unauthorized` |
| `authorization` | valid/revoked/unknown | Bridge持久登记 |
| `ownership` | bridge/external/unconfirmed | 原生条目与Bridge写入内容逐字段比较，**不按显示名** |

`evidence` 分列 `configPath`、`nativeProbe`（所在产品自身的MCP列表命令及结果）、`toolsProbe`（Bridge stdio 工具目录，含工具数，不含工具名之外的敏感内容）、`configError`。`nativeSupport/nativeSupportCode/nativeSupportReason` 给出该入口不可管理的原因原文。

所有权与授权分开：已撤销但仍为Bridge写入的条目读作“配置存在 + 授权已撤销”，不是冲突；外部手写同名条目读作 `config:conflict` + `ownership:external`，Bridge保留原条目、不静默接管。

#### 11.3.3 MCP方法

| 方法 | 语义 | 是否改原生配置 |
| --- | --- | --- |
| `mcp.status` | 只读返回状态事实与证据 | 否 |
| `mcp.export` | 登记身份并生成标准片段（JSON/TOML/JSONC/OpenDesk JSON/DSH补丁YAML五份独立文件），不写原生配置 | 否 |
| `mcp.install` | 写入Bridge自己拥有的原生条目；已存在外部条目则 `MCP_CONFIG_CONFLICT` 并保留 | 是 |
| `mcp.revoke` | **只**持久撤销授权，绝不触碰原生条目；原生条目保留 | 否 |
| `mcp.probe` | 只读探测：原生列表命令（若该入口有）+ Bridge stdio工具目录；不写配置、不重装、不启动模型 | 否 |
| `mcp.remove` | 先撤权再删归属明确的条码；清理失败返回 `state:'revoked_config_pending'` + `cleanupError`，绝不恢复授权 | 是 |

错误码保持类型：`MCP_UNSUPPORTED`、`MCP_NATIVE_CONFIG_UNSUPPORTED`、`MCP_CONFIG_INVALID`、`MCP_CONFIG_CONFLICT`、`MCP_PROFILE_MISSING`（DSH Web profile目录不存在，安装前拒绝；CLI侧归入输入/配置类，退出码2）、`MCP_REVOKED`、`MCP_NOT_CONFIGURED`、`DISCOVERY_CHANGED`；远端缺能力时 `MCP_BACKEND_UPGRADE_REQUIRED`，不静默降级为默认值。

`mcp.probe` 的原生列表侧只对 `claude`/`codex`/`opencode` 生效（各自有 `mcp list` 入口；Claude 的 list 会做健康检查，Codex 只列配置）。可执行文件按“调用方候选 → 该机器发现结果 → 产品命令名在 `PATH` 中查找”解析，不下载二进制、不启动产品UI；探测子进程使用目标环境变量，因此 profile 目录隔离仍然有效。OpenDesk/DSH/Hermes/Pi 无原生列表入口时 `nativeProbe.kind` 为 `none`，界面与CLI显示“无法核验”，不因此否定其MCP能力。

#### 11.3.4 持久字段

`mcp-connections/connections.json` 每一行新增/明确以下字段，旧行缺字段按“未知/外部管理”处理，不自动接管：

| 字段 | 说明 |
| --- | --- |
| `nodeId` / `adapter` | 原节点与入口 |
| `connectionId` | 接入身份，重新添加即轮换，旧授权不复用 |
| `enabled` | 持久授权开关；`revoke` 只改它 |
| `nativeProtocol` | OpenCode v1/v2 布局，缺省按 v2 |
| `configuration` | Bridge自己写入的原生条目原样快照，用于所有权比较与“只删自己的条目” |
| `probe` | 最近一次只读探测结果（kind/outcome/command/nativeLoad/connection/tools/toolCount/at），不参与授权 |

#### 11.3.5 后端能力标记与升级

中央hello与daemon hello新增 `mcp-open-access-v1`（`runtime-capabilities.cjs` 的 `runtimeCapabilities` 展开，`supportsMcpOpenAccess` 单独判断），不并入 `coordinatorCapabilities` 的通用要求，避免变成“全部方法都要升级”的粗暴门禁。旧后台：

- 协调器侧 `mcp.status/mcp.revoke/mcp.probe` → `MCP_BACKEND_UPGRADE_REQUIRED`；
- 旧远端daemon → 显式升级错误，不按默认能力放行；
- `mcp.install/export/remove` 在旧“当前版本”后台仍可用，因为它们在更早版本已存在。

#### 11.3.6 非GUI入口

```text
agentbridge mcp status|export|install|remove|revoke|probe --node NODE_ID
          [--adapter ADAPTER] [--json] [--profile-dir DIR]
```

- 命令实现于[mcp-command.ts](../../../src/mcp-command.ts#L1)，经[coordinator-client.cjs](../../../desktop/electron/coordinator-client.cjs#L1)的私有socket访问运行中的协调器，解开`{ok,result}`信封；不打开窗口、不启动模型、不改配置外的运行状态。
- `--adapter` 缺省时从协调器`snapshot`的`nodes`解析；0个或多个匹配分别以退出码2报`NODE_NOT_FOUND`/`NODE_AMBIGUOUS`，不猜。
- `--json` 输出经脱敏：`token/secret/bearer/authorization/password/privatekey/apikey/credential/configuration`类键与疑似令牌字符串替换为`[redacted]`，不做明文回显。
- 退出码：0成功；2输入/配置/认证（含`MCP_CONFIG_INVALID`、`MCP_PROFILE_MISSING`、`MCP_STATE`、`NODE_NOT_FOUND`/`NODE_AMBIGUOUS`）；3 `COORDINATOR_TIMEOUT`（原操作未知，不重做）；4业务拒绝（`MCP_CONFIG_CONFLICT`、`MCP_REVOKED`、`MCP_UNSUPPORTED`、`MCP_NATIVE_CONFIG_UNSUPPORTED`、`MCP_BACKEND_UPGRADE_REQUIRED`、`COORDINATOR_UPGRADE_REQUIRED`、`REVISION_CONFLICT`/`OPERATION_CONFLICT`、`DAEMON_MAINTENANCE`）；5传输/启动/其余（含`NODE_DISCONNECTED`、`DISCOVERY_CHANGED`）。
- `revoke`/`probe` 在能力标记缺失时要求升级后台；`status/export/install/remove` 不额外门禁。

### 11.4 逐入口完成度

| 入口 | 原生配置管理 | 独立MCP调用 | 托管任务注入 | 本轮证据 | 结论 |
| --- | --- | --- | --- | --- | --- |
| Claude Code | 已实现（沿用+I08增强） | 已声明true | 已声明true | 受控：所有权/撤权/重启不补回/重装轮换/探测接线；**真实原生**（受控`CLAUDE_CONFIG_DIR`，真实`claude`二进制）：`mcp.install`后`mcp.probe`六项事实全部已知——`config:present`、`nativeLoad:loaded`、`connection:connected`、`tools:available`、`authorization:valid`、`ownership:bridge`，`claude mcp list` 报 `✔ Connected`，Bridge stdio工具目录7项 | 实现+受控测试+真实原生列表/握手/工具目录（零模型）；仍未做真实主调用链与委派 |
| Codex | 已实现 | true | true | 受控：TOML标记块、注释保真、冲突保留、移除不误删其他键；**真实原生**（受控`CODEX_HOME`，真实`codex`二进制）：`codex mcp list` 列出 agentbridge行（`Status enabled`），`tools:available`，`connection:unknown`（codex list 不做健康检查，Bridge不补造连接结论） | 实现+受控测试+真实原生配置列表（零模型）；连接/工具实际调用待验 |
| OpenCode 1.x/2.x | 已实现（双布局） | true | true | 受控：v1/v2布局、跨代冲突拒绝、双文件歧义拒绝 | 实现+受控；本轮无原生运行 |
| OpenDesk CLI | 已实现（沿用；当日晚收敛为“无可用原生入口”，只可导出，见§12.7） | true | false（本轮解除托管前提） | 受控：外部MCP可作普通被委派主；托管scope在意图前拒绝；能力测试覆盖 | 实现+受控；**原生MCP列表仍未probe到**（CLI无list命令，见§11.7） |
| OpenDesk Windows Desktop | 已实现（沿用；当日晚明确为“候选写入、原生读取未核对”，见§12.7） | true | false | 同上，独立入口单独声明 | 同上；Windows实例原生重载未验 |
| DSH Web | **新增** | true | false | 真实原生组合：`--profile web --dump-config` 输出含Bridge写入的 `insert:` 行；Bridge往返读写一致；受控：保留用户注释/其他行、外部删除后重启不补回、profile目录缺失时拒绝安装、空/仅注释补丁层报错并保留原文件、本机Linux路由安装写入 | 实现+真实原生组合证据；原生是否加载该行、连接握手仍待验（Bridge只报 `reload_required`，不宣称已连接） |
| DSH Desktop | **gap**：无Bridge可管理路径 | true | false | 受控：`export`生成标准片段、`install` 返回 `MCP_NATIVE_CONFIG_UNSUPPORTED` | 明确缺口，原因：应用保留profile未核对 |
| DSH CLI | **gap**：同上 | true | false | 同上 | 明确缺口，原因：profile由用户启动参数选择 |
| Hermes | **gap**：无核对到的格式 | null（未确认） | false | 受控：`status`→`unsupported`、只可`export`、不可`install` | 明确缺口；不写“不支持MCP” |
| Pi | **gap**：同上 | null（未确认） | false | 同上 | 同上 |

机器类型口径（与入口正交，需分别记录）：

| 机器类型 | `mcp.*` 路由 | 结论 |
| --- | --- | --- |
| Windows 本机 | `MachineHost` + `McpIntegration` | 实现+受控；真实Windows原生入口未验 |
| Linux 本机 | 协调器进程内 `localMcpHost()`：仅六个 `mcp.*` 走本地 `McpIntegration`，执行继续走原核心宿主；其他方法返回 `DESKTOP_METHOD` | 实现+受控（`mcp-local-machine.test.cjs` 2/2）；真实Linux原生入口未验 |
| WSL 本机 | 仍经远端 `HostConnection` → `dist/desktop-host.js`，其方法白名单无 `mcp.*` | **缺口**：WSL文件系统不属于本进程，需WSL侧daemon/升级路径，本轮未做 |
| SSH 机器 | 新daemon的 `machine-daemon.cjs` 方法集合含六个 `mcp.*` | 实现+受控（路由73/73含此项）；真实SSH现场未验 |

### 11.5 证据位置

| 证据 | 位置 | 层级 |
| --- | --- | --- |
| DSH组合配置含Bridge写入行 | `artifacts/mcp-open-integration/evidence/dsh-composed-config.txt`（DSH 0.2.1-rc.2 / `@deepseek-ai/dsh-mcp-client` 0.2.1-rc.2，scratch `DSH_HOME`） | 真实原生组合，受控目录，零模型 |
| DSH写入往返 | `artifacts/mcp-open-integration/evidence/dsh-native-config.json` | 真实原生配置格式，受控 |
| Claude受管添加+探测（生产形状） | `artifacts/mcp-open-integration/evidence/claude-managed-probe.json`（真实`claude`二进制、受控`CLAUDE_CONFIG_DIR`；六项事实全部已知；`nativeProbe=claude mcp list / connected`；`toolsProbe=bridge-stdio / available / 7项`） | 真实原生列表+握手+工具目录，零模型 |
| Codex受管添加+探测（生产形状） | `artifacts/mcp-open-integration/evidence/codex-managed-probe.json`（真实`codex`二进制、受控`CODEX_HOME`；`nativeLoad:loaded`、`connection:unknown`、`tools:available`） | 真实原生列表+工具目录，零模型；不补造连接结论 |
| 原生列表健康检查原始输出 | `artifacts/mcp-open-integration/evidence/claude-native-list.txt`（`agentbridge: … ✔ Connected`） | 真实原生客户端握手，受控fixture |
| Bridge stdio工具目录 | `artifacts/mcp-open-integration/evidence/bridge-mcp-tools-list.txt` | 真实MCP协议，零模型 |
| 手写条目上的probe输出 | `artifacts/mcp-open-integration/evidence/claude-native-probe.json` | 受控；结果为 `state:conflict`/`ownership:external`（所有权诚实），**不作为受管探测通过** |
| 本轮文档轮测试日志 | `artifacts/mcp-open-docs/2026-10-22/desktop-mcp-tests.log`、`cli-mcp-tests.log` | 受控测试 |

本轮实际执行的测试（同一组共享结果，不跨模块相加重算）：

| 命令 | 结果 |
| --- | --- |
| `cd desktop && node --test tests/mcp-integration.test.cjs` | tests 19 / pass 19 / fail 0（含“无调用方候选时经PATH解析原生可执行文件”的生产形状用例，以及DSH profile缺失/空补丁层两个新用例） |
| `cd desktop && node --test tests/connection-capabilities.test.cjs` | tests 11 / pass 11 / fail 0 |
| `cd desktop && node --test tests/mcp-local-machine.test.cjs`（[用例](../../../desktop/tests/mcp-local-machine.test.cjs#L19)） | tests 2 / pass 2 / fail 0 |
| `cd desktop && node --test tests/mcp-remote-routing.test.cjs tests/coordinator.test.cjs tests/agent-network.test.cjs` | pass 73 / fail 0 |
| `cd desktop && node --test tests/*.test.cjs`（最终全量） | tests 747 / suites 0 / pass 747 / fail 0 / duration 58.4s |
| `npm test`（根，含TS/CLI） | tests 66 / pass 66 / fail 0 / duration 125.3s |
| `node --import tsx --test tests/mcp-cli.test.ts`、`tests/cli-entry.test.ts` | 9/9、1/1，均通过 |
| `cd desktop && node --test tests/connection-ui.test.cjs tests/mcp-status-facts-ui.test.cjs tests/agent-configuration-ui.test.cjs` | 11/11 + 4/4 + 8/8（共23/23） |
| 工程检查 | 根 `npm run typecheck`、`npx eslint src tests/mcp-cli.test.ts`、`npm run build`、`cd desktop && npx tsc --noEmit` 全部通过（lint 0 findings） |

### 11.6 首次失败与修复（本轮实际观察）

1. **DSH补丁层的“无profile”“空文件”“无层”三种情况必须分开**：最初只有真实观察——`$DSH_HOME/profiles/web` 不存在时若自动建目录并写补丁层，等于替DSH臆造profile；`cordis.patch.yml` 存在但为空/仅注释是无效DSH配置，覆盖成 `[]` 会破坏用户文件。修复为三条独立路径：`MCP_PROFILE_MISSING` 拒绝安装且不创建文件、`MCP_CONFIG_INVALID` 保留原文件逐字节不变、文件不存在按“无该层”处理。已补两个受控用例（`mcp-integration.test.cjs` 19/19），仍属受控证据，未在真实DSH上重跑。
2. **手写原生条目的probe结果曾被误读为失败**：`claude-native-probe.json` 显示 `state:conflict`、`ownership:external` 且 `nativeProbe.kind:'none'`。核对后这是**正确**结果（条目非Bridge写入、fixture未提供可执行候选），不是探测缺陷；已按“所有权诚实”记录，不写成受管探测通过。
3. **开发中自查发现的死分支**：`mcp-integration.cjs` 的 `!support.supported` 分支内曾残留一个 `if (false)` 的旧导出分支，行为不变，已在本轮删除；无测试影响。
4. **全量桌面套件一次瞬时失败**：并行编辑期间一次运行出现739/740，下一次运行恢复全通过；未作为产品回归，也未据此改写历史计数。
5. **CLI测试先失败后通过**：`tests/mcp-cli.test.ts` 在写本文档期间从“8通过/1失败”变为“6失败（退出码5）”，属cli成员修改中的中间态；cli完成后同一命令为9/9通过，最终全量747/747与根66/66同轮通过。中间失败保留记录，不当作产品回归。
6. **原生列表探测一度在生产路径不可达（已修复）**：首版实现只从 `this.options.candidates?.[adapter]` 取可执行文件，而 `coordinator-service.cjs`/`machine-daemon.cjs` 创建宿主时都不传 `candidates`（仅测试传入），导致实际桌面/daemon路径下 `evidence.nativeProbe` 恒为 `{kind:'none'}`，R07要求的“用产品自身MCP列表核对”无法生效。修复为：调用方候选 → `scanTools(this.options)` 发现的安装 → 按产品命令名在 `PATH` 中查找（不下载、不启动产品UI），并让探测子进程使用目标环境的变量（`CODEX_HOME`/`CLAUDE_CONFIG_DIR`/`OPENCODE_CONFIG_DIR`）。新增生产形状受控用例（宿主**不传** `candidates`，经PATH找到真实二进制）与真实原生证据见§11.5。
7. **Linux本机 `mcp.*` 路由一度缺失（已修复）**：原实现只对 `kind==='windows'` 创建带MCP的宿主，Linux本机仍走核心 `dist/desktop-host.js`（无 `mcp.*`）。修复为协调器进程内 `localMcpHost()`，仅六个 `mcp.*` 走本地 `McpIntegration`、其余方法仍走原执行宿主，且MCP失败不回落到执行路径；WSL因文件系统不在本进程而保持远端路径，仍为缺口。
8. **用户能力表因能力改名一度全变“—”**（本轮自查修复）：文档站生成脚本 `capabilityTable()` 原本按静态注册表的 `bridgeMcp` 键生成“调用 Bridge MCP”列；能力改名后注册表只声明 `mcpClient`，重新生成后十个入口全部显示“—”，与接入矩阵和用户页正文矛盾。修复为读取 `mcpClient`（保留 `bridgeMcp` 回退），并同步更新文档站测试的期望；重新生成后 `npm run docs:test` 为 6/6 通过，表格为 Claude/OpenCode/Codex/DSH CLI/Desktop/Web/OpenDesk CLI/Desktop 显示“✓”、Hermes/Pi 仍为“—”（未确认，不等于不支持）。
9. **新拒绝码未分类导致CLI退出码偏大**（本轮自查修复）：`MCP_PROFILE_MISSING` 与 `MCP_STATE` 最初不在 `src/mcp-command.ts` 的输入/配置类集合内，会被通用映射成服务类退出码5。已加入输入/配置类，现为退出码2，消息仍原样显示；`eslint` 无告警。

### 11.7 未变项与剩余工作（保持原语义，未改写为完成）

未变（本轮不动）：requestId/operationId与原请求核对规则、unknown占位、daemon帧协议2、JSON/SQLite版本、经典主从MCP与小队工具集合、broker身份与工具参数不可自报身份、OpenDesk/DSH原生产品与原生模型账号、公开基线alpha.36与本地候选alpha.43、无新增公开端口/远程传输。

剩余工作：

1. **逐入口真实原生验收**：按§8每入口如实填写原生产品/版本/OS/profile、添加方、删除方、原生列表、握手/工具、只读调用、主调用链、托管归属；目前T01–T18全部未到“通过”层级——现有真实原生证据只覆盖Claude/Codex的“写入→原生列表→工具目录”，没有真实删除、真实禁用/编辑、真实获准只读调用、真实主调用链或真实托管委派。
2. **探测结果的持久化边界**：`mcp.probe` 只在该节点已有Bridge登记行时保存 `row.probe`；用户手写的同名条目读作 `ownership:'external'` 且其余事实为“未知”，直到显式登记/安装或用户采纳该条目。本轮保留该语义（不静默认领），其真实原生编辑/删除场景仍属T03/T04/T07的受控夹具证据。
3. **WSL本机 `mcp.*` 路由**：WSL文件系统不属于协调器进程，需WSL侧daemon/升级路径；本轮只登记，未实现。Linux本机与Windows本机已实现。
4. **OpenDesk原生MCP列表**：当日晚已判定 CLI 0.3.8 没有 MCP 管理面（插件清单/工具列表均无入口，启动重写 `setting.json` 丢弃未识别段），代码收敛为不可管理、只可导出；剩余项改为 **OpenDesk Desktop 的原生读取核对**。见[§12.7](#127-opendesk-cli-038-无-mcp-管理面结论升级与代码收敛2026-10-22-晚补)。
5. **DSH Desktop原生配置路径**：需核对应用保留profile的实际落点，不能猜。DSH CLI 已在同日补齐显式 `profile`（[§12.5](#125-dsh-cli-显式-profile-原生配置2026-10-22-晚补)），但仍未在真实 `dsh` 启动中观测该 profile 被加载。
6. **打包与EXE**：本迭代未构建；`npm run desktop:dist`、包内源码一致性、SHA-256、普通EXE下的窗口/后台重开与原生列表验证全部待执行。
7. **CLI仍未验证的路径**：打包后EXE内的 `agentbridge mcp` 调用、冷启动自动拉起协调器、真实Electron默认profile目录、75s超时分支；本机测试用受控协调器与`--profile-dir`临时目录。
8. **真实Windows/WSL/SSH现场**：上述受控证据不等于Windows真机、WSL实例或真实SSH远端；两轮启动/重开与原生列表在这些环境需单独记录。

### 11.8 验收用例本轮状态（保持§8原表不变）

| 用例 | 本轮已有证据 | 状态 |
| --- | --- | --- |
| MCP02-T01 | 真实原生（受控profile）：Claude/Codex的写入→原生列表→Bridge工具目录7项；受控：安装/探测/所有权 | 待执行（缺“获准只读调用”与其余入口） |
| MCP02-T02 | 非GUI `mcp export` 设计与受控实现 | 待执行（真实原生＋生产后台） |
| MCP02-T03 | 受控：外部删除后status为exported、重启不补回（Claude/DSH Web） | 待执行（真实原生自我删除） |
| MCP02-T04 | 受控：冲突保留、别名/双文件/损坏配置不覆盖；真实原生手写条目读作 `ownership:external` | 待执行（真实原生禁用/编辑/别名） |
| MCP02-T05 | 受控：先撤权、旧凭据被拒、重装轮换 | 待执行（实际MCP协议＋原生列表消失） |
| MCP02-T06 | 受控：`revoked_config_pending`＋`cleanupError`；端点恢复失败仍可撤权 | 待执行（故障注入＋生产后台） |
| MCP02-T07 | 受控：撤权后 `authorization:revoked`/`connection:revoked` | 待执行（实际协议＋缓存会话） |
| MCP02-T08 | 受控反例：写入成功但原生未加载只报 `reload_required`/`unknown`；真实原生：Claude安装后列表即Connected，Codex仅列出不做健康检查 | 待执行（真实重载反例） |
| MCP02-T09 | 受控：按目标环境路径读写；Linux本机走进程内路由；WSL本机为缺口 | 待执行（真实多环境） |
| MCP02-T10 | 受控：独立调用方可作主、托管绑定单独显示 | 待执行（生产界面＋真实独立MCP） |
| MCP02-T11 | 无 | 待执行 |
| MCP02-T12 | 无 | 待执行 |
| MCP02-T13 | 受控：工具参数不能自报身份、子节点不扩权 | 待执行（原生协议反例） |
| MCP02-T14 | 未变（原台账/原ID规则回归通过） | 待执行（受控持久台账） |
| MCP02-T15 | 受控：重装生成新connectionId、旧配置失效 | 待执行（生产后台＋协议调用） |
| MCP02-T16 | 无（本轮未打包） | 待执行（最终Windows普通EXE） |
| MCP02-T17 | 受控：不支持的入口逐项显示原因；旧后台显式要求升级 | 待执行（真实原生＋受控界面） |
| MCP02-T18 | 受控：注释/其他MCP/无关配置保留；输出脱敏 | 待执行（字节对照与证据审计） |

本轮不宣称任何用例通过；上表只说明本轮把哪一部分证据补到了哪一层。

## 12. 真实原生探测补充（2026-10-22 晚）

本节追加在§11之后，**不修改§11已登记的数字与结论**。两组探测都是真实原生程序、真实协议、模型0、隔离 profile；不改用户真实原生配置，输出已脱敏。措辞按证据分层：受控隔离 profile 上真实发生的行为记为“真实原生（受控 profile）”，不等于真实用户 profile 或原生 UI 的验收。

### 12.1 DSH Web 真实原生握手成功

做法：在 scratch `DSH_HOME`（`profiles/web` 复制自真实 profile，`node_modules` 软链到真实 `~/.dsh/profiles/node_modules`）里，用产品代码 `localMcpHost().call('mcp.install')` 写入真实 `cordis.patch.yml`，再启动真实 `dsh --profile web --host 127.0.0.1 --port 0 --no-open`。为观测协议，只在采集证据时把该条目的 `command` 包了一层透传 wrapper（不改变协议行为）。记录的 JSON-RPC 序列：

| 方向 | 消息 | 结果 |
| --- | --- | --- |
| 原生→服务 | `server/discover` | 服务返回 `-32603`（原生客户端探了一个未知新方法，随后正常回退） |
| 原生→服务 | `initialize` | 服务正常回应 |
| 原生→服务 | `notifications/initialized` | — |
| 原生→服务 | `tools/list` | Bridge 返回 **7 个工具** |

结论：DSH Web 从“配置已写入、组合配置可见”升级为**配置可管理 + 原生已加载 + 连接握手 + 工具目录可用**，是十入口中唯一具备这四项真实原生（受控 profile）证据的入口，仍为模型0。相应状态事实可读作 `config:present`、`nativeLoad:loaded`、`connection:connected`、`tools:available`（`ownership:bridge`、`authorization:valid` 由登记决定）。

证据：`artifacts/mcp-open-integration/evidence/dsh-live-mcp-handshake.txt`（协议序列）、`artifacts/mcp-open-integration/evidence/dsh-live-boot.txt`（该次真实启动的 launcher 输出，token 已脱敏）。

限制（不得写成已验证）：

1. **“失败会显式暴露”未验证**。对照实验把 `command` 改成 `/nonexistent` 后启动，launcher 输出里**没有**出现错误——DSH 的插件加载/连接错误不进 stdout，只可能出现在原生界面。因此不能据本实验声称“配置错误一定会在启动输出里报出来”。
2. 原生 UI 中**人工可见、删除、禁用、编辑**该条目未验证；真实用户 profile 未验证。
3. 采集时使用的透传 wrapper 不是产品路径；产品路径写入的 `command` 直接是 Bridge 的 node + `mcp-client.cjs`。

对验收表的净影响：MCP02-T01/T07/T08 对 **DSH Web** 可写“真实原生（受控 profile）证据已有，真实 UI 与真实 profile 仍待执行”；其余入口不变，T01–T18 整体仍不宣布通过。

### 12.2 OpenDesk CLI 0.3.8 负面证据（本轮第一优先级缺口）

核对与受控实验都指向同一结论：OpenDesk 0.3.8 **没有读取** Bridge 当前写法写入的 MCP 条目。

| 观察 | 实际结果 |
| --- | --- |
| `OPENDESK_CONFIG_DIRECTORY=<临时目录> opendesk tools list` | 只列出 `filemgr`/`search`/`terminal`/`todomgr`/`devicemgr`/`memory`/`planning` 分区，**没有** `mcpmgr` 或任何 MCP 工具 |
| 原生 MCP 列表命令 | 没有；`opendesk tools` 只有 list/info/call/help |
| 按 Bridge 当前写法把条目写入 `setting.json` 的 `applications.mcpmgr.servers` 后启动 OpenDesk | 启动完成后 `applications` 被重写为 `{}`：连 `applications.devicemgr` 与未知 app 段一并被丢弃（该临时 profile 未安装对应 app） |
| 真实 `~/.opendesk` 目录 | **没有** `setting.json`，只有 `~/.opendesk/apps/<app>/...` |

按证据得出的结论：

- Bridge 写入 `applications.mcpmgr.servers` 的条目在 OpenDesk 0.3.8 上**没有原生读取证据**；原生启动会重写 `setting.json` 并丢弃未识别的 app 段。
- 因此 OpenDesk 两个入口的 `nativeLoad`/`connection`/`tools` 一律按 **unknown** 处理；`mcp.install` 只能表述为“**已写入候选配置**”，并注明**存在被原生丢弃的风险**。
- 措辞收敛：此前文档写的“OpenDesk 独立MCP配置已实现”改为“**已实现写入适配，原生是否读取未得到证据**”；接入矩阵与用户页把 OpenDesk 的 MCP 调用方状态改为“**未确认（待装 mcpmgr 的真实 profile 复核）**”。
- 代码与本节的差异如实登记：[静态注册表](../../../desktop/electron/builtin-adapters.cjs#L19) 仍声明 OpenDesk `mcpClient:true`（本轮未改代码）。Bridge 侧没有证据否定“OpenDesk 具备 MCP 客户端”，缺的是原生读取/列表现场证据；若装好 `mcpmgr` 的真实 profile 复核后仍无读取证据，应把该静态声明收敛为 `null`（待决，不在本轮）。
- 仍需真实环境复核的前置条件：在**安装了 `mcpmgr` app** 的真实 profile 上重做写入与启动，并检查启动后 `setting.json` 是否保留该条目、原生是否有对应工具/列表入口。

> 后续补充：当日晚进一步核对插件面后，本条结论已升级为“OpenDesk CLI 0.3.8 不存在可供 Bridge 写入并被原生读取的 MCP 管理面”，代码随之收敛为 CLI `nativeMcpConfig=false`、只可导出；见[§12.7](#127-opendesk-cli-038-无-mcp-管理面结论升级与代码收敛2026-10-22-晚补)。

证据：`artifacts/mcp-open-integration/evidence/opendesk-tools-list.txt`。

### 12.3 对§11结论的净影响（数字不变）

| 项 | §11 记录 | §12 补充 | 现在状态 |
| --- | --- | --- | --- |
| DSH Web 原生可见性 | 组合配置含写入行；Bridge 只报 `reload_required`，不宣称已连接 | 真实原生启动后完成握手并取到 7 个工具（受控 profile） | 原生受控证据已有；真实 UI/profile 待执行 |
| OpenDesk 原生配置 | 实现+受控；原生列表未 probe 到 | 原生工具列表无 MCP 分区；启动重写 `setting.json` 丢弃该段 | 写入适配仍在，**原生读取无证据**＝第一优先级缺口 |
| 其余八项能力/状态契约 | §11 冻结 | 无变化 | 不变 |

### 12.4 本节未验证与仍在进行

1. 真实用户 profile 的原生可见性/人工增删/禁用/编辑（所有入口）。
2. 真实原生主调用链、托管scope注入与真实模型委派。
3. Windows 真机、WSL 实例、真实 SSH 远端；打包与普通 EXE。
4. WSL 本机 `mcp.*` 路由（Linux 本机已实现）。
5. DSH CLI 通过显式 `profile` 管理 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`：**已实现并通过受控测试**，见[§12.5](#125-dsh-cli-显式-profile-原生配置2026-10-22-晚补)；已在 shipped `acp` profile 的真实 `dsh --profile acp` 启动中观测到原生加载与握手（见[§12.6](#126-dsh-cli-真实-profile-原生加载与握手acp2026-10-22-晚补)），TUI/用户自建 profile 与真实用户 profile 仍未观测。
6. OpenDesk：安装 `mcpmgr` 的真实 profile 复核（见§12.2 前置条件）。

### 12.5 DSH CLI 显式 profile 原生配置（2026-10-22 晚补）

DSH CLI 的原生 MCP 配置跟随**启动时选择的 profile**，Bridge 不猜默认值，改为由用户显式指定；这是十入口中唯一需要额外定位参数的原生适配。

| 项 | 冻结行为 |
| --- | --- |
| 方法参数 | `mcp.status|export|install|remove|revoke|probe` 均接受可选 `profile`；仅 `dsh` 适配器使用，其余适配器忽略该参数。DSH Web 固定使用 `web`，不对外暴露该参数 |
| 原生目标 | `$DSH_HOME/profiles/<profile>/cordis.patch.yml`（`DSH_HOME` 缺省 `~/.dsh`），写入方式仍是单一 `insert:` 行 + `@deepseek-ai/dsh-mcp-client`（与 DSH Web 同一形状） |
| 名称校验 | 必须匹配 `^[a-z0-9][a-z0-9-]{0,63}$`；`../escape`、`a/b`、空串、大写、前导 `-` 全部拒绝，按单段目录名校验后再拼接，**不产生逃逸路径** |
| 未指定 profile | `mcp.status` 返回 `nativeSupport:false`、`nativeSupportCode:'MCP_DSH_PROFILE_REQUIRED'`、`profile:null` 与原因；`mcp.install`/`mcp.remove` 以同码拒绝；`mcp.export` 仍生成标准片段（不写原生） |
| DSH Desktop | 仍为 `MCP_NATIVE_CONFIG_UNSUPPORTED`（应用保留 profile，无已核对路径），只可导出片段 |
| 持久化 | 连接行新增 `profile`（仅 DSH CLI）；`mcp.status` 回显 `profile`，省略参数时使用登记的 profile；`mcp.remove` 只清理登记的那个 profile，**其他 profile 的原生文件逐字节不变** |
| 安装后事实 | `facts.nativeLoad:'reload_required'`（DSH 自己加载补丁层），不宣布已连接 |
| 能力位 | `dsh` 的 `nativeMcpConfig` 改为 **true**（产品级适配存在，但需显式 profile）；`dsh-desktop` 仍为 false |
| 桌面 UI | `dsh` 行新增“DSH 原生 profile”输入框，说明“Bridge 不会猜测目标 profile”，切换 profile 会重读该 profile 的条目；`dsh-desktop` 仍只有导出片段 |
| 非GUI入口 | 六个子命令新增 `--profile NAME`（帮助行已更新），`MCP_DSH_PROFILE_REQUIRED` 映射退出码 2（输入/配置） |

代码落点：[profile 名称校验与原生路径](../../../desktop/electron/mcp-config.cjs#L50)、[`nativeSupport`/`MCP_DSH_PROFILE_REQUIRED`](../../../desktop/electron/mcp-integration.cjs#L120)、[status 回显与行字段](../../../desktop/electron/mcp-integration.cjs#L133)、[能力位](../../../desktop/electron/builtin-adapters.cjs#L63)、[桌面输入框](../../../desktop/src/McpSettings.tsx#L143)、[CLI 参数与校验](../../../src/mcp-command.ts#L452)。

本轮受控测试（同一组测试；此处记录该片当时的新增用例运行结果，定稿全量见§12.7）：桌面全量 `node --test tests/*.test.cjs` **749 / 749 通过**；根 `npm test` **66 / 66**；`mcp-integration.test.cjs` **21 / 21**（新增：无 profile 拒绝、写入仅落在指定 profile、`status` 回显登记 profile、`remove` 只清理该 profile、非法 profile 拒绝且不产生逃逸文件）；`connection-capabilities` 11/11、`mcp-local-machine` 2/2、界面组（connection-ui + mcp-status-facts-ui + agent-configuration-ui）**24 / 24**、`tests/mcp-cli.test.ts` 9/9；根 `typecheck`/`eslint`/`build` 与桌面 `tsc --noEmit` 通过。

限制（不得写成已验证）：

1. ~~没有在真实 `dsh` CLI 启动中观测该 profile 的补丁层被原生加载~~——**该限制已在§12.6解除**：真实 `dsh --profile acp` 启动中观测到原生加载、`initialize` 握手与 `tools/list`（7 工具）。仍未观测 TUI 与用户自建 profile、以及真实用户 profile；且安装后 Bridge 仍只报 `nativeLoad:'reload_required'`，不代用户宣称已连接。
2. 原生 UI 中人工可见/删除/禁用/编辑该条目未验；真实用户 profile 未写。
3. profile 名称由用户提供，Bridge 只能校验它是安全的**单段目录名**，不能证明它确实是用户启动 `dsh` 时用的那个 profile（写错 profile 不会报错，只会写到一个不被加载的目录）。

### 12.6 DSH CLI 真实 profile 原生加载与握手（`acp`，2026-10-22 晚补）

§12.1 已在 DSH Web 上观测到真实加载与握手；本节把同一观测补到 **DSH CLI 家族**，并把 §12.5 的“没有任何真实 CLI 启动观测”放宽。

做法：在受控 scratch `DSH_HOME` 中用产品代码 `localMcpHost().call('mcp.install', {nodeId, adapter:'dsh', profile:'acp'})` 写入 `$DSH_HOME/profiles/acp/cordis.patch.yml`，随后真实启动 `dsh --profile acp`（`acp` 是 DSH 随包提供的 shipped profile；本次 stdin 关闭、无客户端连接、无模型回合）。为观测协议，仅在采集证据时对该条目的 `command` 包一层只记录、不改行为的透传 wrapper。

| 方向 | 消息 | 结果 |
| --- | --- | --- |
| 原生→服务 | `server/discover` | 服务返回 `-32603`（未知新方法，随后正常回退，与 DSH Web 一致） |
| 原生→服务 | `initialize` | 服务正常回应 |
| 原生→服务 | `notifications/initialized` | — |
| 原生→服务 | `tools/list` | Bridge 返回 **7 个工具** |

结论：**在显式 `profile` 下，DSH CLI 确实会加载 Bridge 写入的 `insert:` 行并完成 MCP 握手与工具目录**，行为与 DSH Web 一致。因此 DSH CLI 的 `nativeLoad`/`connection`/`tools` 在受控 profile 上可以读到 `loaded`/`connected`/`available`（`ownership`、`authorization` 由登记决定），模型0。

证据：`artifacts/mcp-open-integration/evidence/dsh-acp-handshake.txt`（协议序列）、`artifacts/mcp-open-integration/evidence/dsh-acp-boot.txt`（该次启动的 launcher 输出；文件为空——launcher 没有打印内容，这不等于 DSH 内部无日志，见下方限制1）。

限制（保留，不得写成已验证）：

1. **未观测 TUI 启动**：本次用 shipped `acp` profile 非交互启动；用户在终端里以 TUI 方式使用其它自建 profile 时的加载未验证，也未观测真实用户 profile（本次是 scratch `DSH_HOME`）。
2. **名称合法但写错 profile 仍会静默写入**：Bridge 只校验名称是安全的单段目录名，写到一个永不加载的 profile 时不会报错（§12.5 第 3 条仍成立）。
3. **原生 UI 人工可见/删除/禁用/编辑**仍待执行（删除/编辑的“不补回、不覆盖”目前仍是受控夹具证据）。
4. **没有真实 ACP 客户端会话**：只验证到协议握手与工具目录，不包含通过 ACP 客户端的模型委派或任务执行；`tools/list` 成功也不等于已获准委派任何 Agent。
5. 采集用的透传 wrapper 不是产品路径；产品路径写入的 `command` 直接是 Bridge 的 node + `mcp-client.cjs`。

对验收表的净影响：MCP02-T01/T07/T08 对 **DSH CLI** 可写“真实原生（受控 scratch profile、`acp`）证据已有，真实用户 profile 与原生 UI 人工操作仍待执行”；DSH CLI 但仍未证明真实模型/委派（T10–T12 不变）。§11 与§12.1–§12.5 已登记的数字不变。

### 12.7 OpenDesk CLI 0.3.8 无 MCP 管理面（结论升级与代码收敛，2026-10-22 晚补）

§12.2 的证据（`opendesk tools list` 无 MCP 分区、启动重写 `setting.json` 丢弃未识别 `applications` 段）当时只能得出“未确认是否读取”。本节补充插件面核对后，结论升级为：**OpenDesk CLI 0.3.8 不存在可供 Bridge 写入并被原生读取的 MCP 服务管理面**（Desktop 未核对，见限制）。

| 核对 | 实际结果 |
| --- | --- |
| `opendesk plugins list` | 11 个 builtin 插件：`browserboost`/`clawhub`/`feishu`/`matrix`/`modelscope`/`opencodego`/`opendesk-account`/`skill0`/`skillhub`/`skillsmp`/`weixin`，**没有任何 MCP 管理插件**（`matrix`/`modelscope` 只是内容注册表 source） |
| `opendesk plugins tools` | `No plugin tools are available.` |
| 插件运行时清单 | 同样没有 MCP 管理入口 |
| `opendesk tools list`（§12.2） | 只有 `filemgr`/`search`/`terminal`/`todomgr`/`devicemgr`/`memory`/`planning`，无 `mcpmgr`/MCP 分区 |
| 写入后启动（§12.2） | `applications` 被重写为 `{}`，连 `applications.devicemgr` 与未知 app 段一并丢弃 |

#### 代码收敛（本轮）

| 项 | 收敛后行为 |
| --- | --- |
| 注册表能力位 | `opendesk`（CLI）`nativeMcpConfig` 由 true 改为 **false**；`opendesk-desktop` 保持 **true**（GUI 候选写入路径，原生读取仍未核对）；两者 `mcpClient` 仍为 true，即独立 MCP 调用方能力声明不变 |
| `nativeSupport('opendesk')` | `{supported:false, code:'MCP_NATIVE_CONFIG_UNSUPPORTED', reason:…}`，原因写明“0.3.8 插件清单无 MCP 管理入口、启动会重写 `setting.json`、请生成独立配置在 OpenDesk Desktop 中手动添加” |
| `mcp.status` | 该入口 `state:'unsupported'`，`facts.config/nativeLoad` 为 `unsupported` |
| `mcp.install` | 拒绝（同码），不写原生配置 |
| `mcp.export` | 仍生成标准片段（`files.opendesk` 含 `applications.mcpmgr.servers` 形状），供用户拿到 Desktop 或未来版本手动添加 |
| 桌面 UI | OpenDesk CLI 显示“已有 MCP 客户端但 Bridge 暂不能管理原生配置”+ 生成独立配置，**不显示“添加 Bridge MCP”**；OpenDesk Desktop 仍可写入 |
| 非GUI | `agentbridge mcp install --node …` 对 OpenDesk CLI 返回拒绝；`export` 正常出片段 |
| 测试 | `mcp-integration` **22/22**（新增：OpenDesk CLI 不支持管理但可导出、OpenDesk Desktop 写入候选条目）；`connection-capabilities` 11/11；`mcp-local-machine` 2/2；opendesk+mcp-local 26/26；`tests/mcp-cli.test.ts` 9/9。桌面全量 `node --test tests/*.test.cjs` **tests 750 / pass 750 / fail 0**，根 `npm test` **tests 66 / pass 66 / fail 0**；根 `typecheck`/`eslint src`/`build` 与桌面 `tsc --noEmit` 通过 |

清理记录（本轮，行为不变）：[mcp-integration.cjs](../../../desktop/electron/mcp-integration.cjs#L14) 的 `configurable` 集合已删除死项 `'opendesk'`，现为 `claude`/`codex`/`opencode`/`opendesk-desktop`/`dsh-web`，并在注释里说明 OpenDesk CLI 由 `nativeSupport()` 前置拒绝、DSH CLI 因需要显式 profile 也单独处理。清理后 `mcp-integration` 仍 22/22、OpenDesk 专项套件通过，行为不变。

#### 对验收与文档口径的净影响

| 项 | 现在状态 |
| --- | --- |
| OpenDesk CLI 原生配置管理 | **无可用入口**：不存在可被原生读取的管理面，不是“Bridge 未适配” |
| OpenDesk Desktop 原生配置管理 | 仍可写入候选条目；**原生读取未核对**（Windows 原实例启动是否同样重写 `setting.json` 未知） |
| OpenDesk MCP 调用方（两个入口） | 维持**未确认**：原生读取与 MCP 客户端行为都没有真实证据；不得写成“支持 MCP 配置”。代码里 `mcpClient:true` 是静态声明，不代表现场已验证 |
| 用户可获得的结果 | CLI 只能导出片段；Desktop 可让 Bridge 写入候选条目，但必须到原生界面核对，不能宣称已连接 |

限制（不得写成已验证）：

1. 只核对了 CLI 0.3.8；Desktop 0.3.9 的原生读取路径未核对，Windows 原实例是否也重写 `setting.json` 未验。
2. 没有真实 OpenDesk MCP 客户端会话证据（无连接握手、无工具目录、无调用），因此 `mcpClient` 现场状态仍是未知。
3. 导出片段能否被 Desktop 或后续 CLI 读取亦未验；片段只是“按当前 Bridge 已知形状生成的标准内容”。
4. 本节不改变 OpenDesk 的直接执行、普通被委派、续聊与取消结论。

## 13. 打包与候选交付记录（2026-10-22）

用户要求给出最新 EXE，本轮在 WSL/Linux 上完成冻结、交叉构建与包源码一致性核验。本节只登记打包与候选边界，不改 §11/§12 已登记的测试与原生结论。

### 13.1 版本与冻结范围

| 项 | 结果 |
| --- | --- |
| 版本变更 | [desktop/package.json](../../../desktop/package.json) 与 [desktop/package-lock.json](../../../desktop/package-lock.json) 由 `0.6.0-alpha.43` → `0.6.0-alpha.44`（**仅版本位**，源码与依赖未变）；根 `package.json` 仍为 `0.1.0` |
| 冻结范围 | I08-MCP02 第一片（能力三维/六项事实/`mcp.revoke`/`mcp.probe`/DSH Web 与 DSH CLI 原生适配/OpenDesk 收敛/非GUI CLI/Linux本机路由）+ §12 真实原生探测后的代码收敛 |
| 未包含 | 本轮之后的新改动；WSL本机 `mcp.*` 路由修复；OpenDesk Desktop 原生读取核对；DSH Desktop 原生配置路径 |

### 13.2 构建方式与环境

| 项 | 结果 |
| --- | --- |
| 命令 | `npm run desktop:dist`（根 `tsc` 构建 `dist` → `desktop` `tsc --noEmit` + `vite build` → `stage-bridge.cjs`（`npm ci` 到 `.bridge-runtime`、`stage-linux-package`）→ `electron-builder --win portable --x64` → `verify-package.cjs --portable`） |
| 环境 | **WSL/Linux**（非 Windows 原生构建），node v22.23.1，electron-builder 26.15.3，Electron 44.7.0 |
| 构建缓存 | 放在工作区内（`.cache-electron*`、`.npm-cache-build`），已加入 `.gitignore`，不入库 |
| 签名 | 沿用 `win.signExecutable:false`，构建日志为 “file signing skipped via signExecutable configuration”；**产物未签名** |

### 13.3 产物与指纹

| 项 | 结果 |
| --- | --- |
| 产物 | `desktop/release/AgentBridge-0.6.0-alpha.44-Windows-x64.exe` |
| 大小 | **130186782 字节** |
| SHA-256 | **`b78a2bcf7d45d67f95044186747e557881d461911077a01bda47addb549d6c63`** |
| 文件类型 | `file` 识别为 PE32 GUI / NSIS 自解压便携包 |
| 分发副本 | 已复制到 Windows `C:\Users\jiqi\Downloads\AgentBridge-0.6.0-alpha.44-Windows-x64.exe`，复制后哈希一致 |
| 入库状态 | `desktop/release/` 在 `.gitignore` 中，EXE 不入库 |

### 13.4 包源码一致性核验

`node desktop/scripts/verify-package.cjs --portable` → `status: passed`：

| 字段 | 值 |
| --- | --- |
| version | `0.6.0-alpha.44` |
| backendModules / coreFiles | 50 / 84 |
| coreBuildMatches / appAsarSourceMatches / frontendMatches / linuxBackendMatches | 均 `true` |
| linuxFiles | 1698 |
| linuxManifestDigest | `8e47ae3b3ae245fc8338ff6bebcdc5dcc0d575bf7b8efe7f93427959096018c7` |

证据：`artifacts/mcp-open-integration/evidence/package-verify.json`（完整包核验报告）、`artifacts/mcp-open-integration/evidence/portable-sha256.txt`（EXE 摘要）。

### 13.5 发布与分发边界

- **未签名**（按既有 `signExecutable:false` 配置跳过）、**未公开**（无 GitHub 发布、无标签、无附件）、**未部署远端**（无 SSH/云端分发）。
- 公开预发布仍为 alpha.36；本地此前候选为 alpha.43；本次 alpha.44 是**本地候选**，不改变公开基线。
- 产物只在本机与用户的 Windows `Downloads` 目录，未做匿名下载核验（没有可下载的公开地址）。

### 13.6 版本变更后的回归

版本位变更后桌面全量仍为 **750/750**（0 失败）。根套件在版本变更后随本轮文档一并复跑，其结果记入[整体测试](../../testing.md)的当前状态；本节不预先填写未取得的数字。

### 13.7 真实 EXE 未执行（MCP02-T16 仍待执行）

**没有在真实 Windows 上启动这个 EXE**：启动它会与日常 alpha.43 后台共用同一个 `%APPDATA%/AgentBridge` 配置目录，可能影响用户正在使用的后台与窗口，需用户决定后再受控运行。因此：

- MCP02-T16（普通 EXE 重开/后台重启/临时解包目录变化后稳定路径仍有效）**仍为待执行**，不能用本次包核验代替。
- 日常后台与窗口仍为 alpha.42/alpha.43，**未切换**到 alpha.44。
- 未验证：真实 Windows 启动与窗口、Windows 原生 MCP 列表、签名与公开下载核验、真实 SSH/远端部署。

### 13.8 对验收的净影响

打包不改变 §11/§12 的任何能力或原生结论：它只证明“源码可冻结、可交叉构建、包内容与源码一致”。逐入口真实原生验收（T01–T15/T17/T18）与真实 EXE 用例（T16）状态不变，其中 T16 因未启动 EXE 仍为待执行。

## 14. OpenDesk 原生 MCP 可见性修复（2026-10-22，alpha.45）

用户反馈“OpenDesk 的 MCP 列表看不到我们的”。在**用户真实 OpenDesk Desktop 0.3.9** 上定位出两个独立根因并修复：一个是 Bridge 侧的协议缺陷，一个是启动器限制。本节记录真实原生定位过程、修复与边界；§11–§13 已登记的数字与结论不变。

### 14.1 先确认原生读取位置与格式（诊断）

| 项 | 实际结果 |
| --- | --- |
| 配置文件 | `%APPDATA%\opendesk\setting.json` 的 `applications.mcpmgr.servers` |
| 原生解析 | 原生代码 `parseServersFromConfig(){return this.config?.servers||[]}`；条目字段为 `id`/`name`/`transport`/`enabled`/`command`/`args`/`cwd`/`env`/`url`/`headers` —— 与 Bridge 写入的形状一致 |
| 原生行为 | 启动时自动连接 `enabled` 项，日志记 `[mcpmgr] Connected ... discovered N tools`；**只在启动时读取** |

对照实验：写一个最小自写 MCP server（node）后可正常连接并 `discovered 1 tools`，说明**位置与格式正确**，问题在 Bridge 侧。

### 14.2 首次实测与失败现象

`[mcpmgr] Initialized with 1 server configs` → `Connecting to "AgentBridge" (stdio)...` → `Connected to "AgentBridge", listing tools...` → **`Connection to "AgentBridge" failed: 命令未找到`**。即：位置能被读到、也能连接到“要启动的命令”这一步，但在 `tools/list` 前后失败。

### 14.3 根因一：Bridge 未响应 `server/discover`（产品真 bug，已修复）

OpenDesk 使用的是 **2026-07-28 协议修订**：客户端在旧式 `initialize` 之前先发 `server/discover` 探测服务端支持的版本。Bridge 的 [mcp-client.cjs](../../../desktop/electron/mcp-client.cjs#L11) 原先对该方法返回 JSON-RPC 错误（`-32603`），严格客户端据此判定连接失败。

修复：按 SDK schema 返回 `{supportedVersions:['2024-11-05','2025-03-26','2025-06-18','2025-11-25'], capabilities:{tools:{}}}`，明确声明本服务仍讲旧修订；`initialize`/`tools/list`/`tools/call` 行为不变。受控用例：`desktop/tests/mcp-client-protocol.test.cjs` **2 例**（discover 不回错误并声明版本；discover 之后 initialize 与 tools/list 目录仍可用）。

> 说明：DSH Web/CLI 之前观测到 `server/discover` 返回 `-32603` 仍能继续（宽松客户端会回退），所以该缺陷只在严格客户端（OpenDesk）上暴露；这也解释了为什么 §12.1/§12.6 的 DSH 观测是“通过”。

### 14.4 根因二：OpenDesk 无法启动 Bridge 的 Electron 运行时（已改为优先 Node）

写原生条目时 Bridge 默认用自身 Electron 运行时做 stdio 启动器：

- `%APPDATA%\agentbridge-desktop\windows\runtime\electron-44.7.0-x64\AgentBridge.exe` → `命令未找到`；
- 把整个运行时目录复制到 D 盘后 → `MCP error -32000: Connection closed`；
- 用系统 `node.exe` 启动同一个 `mcp-client.cjs` → 正常。

修复：[McpIntegration](../../../desktop/electron/mcp-integration.cjs#L221) 为 OpenDesk 两个入口**优先使用真实 Node 启动器**（`nodeLauncher()` 在 `PATH` 中查找 `node.exe`/`node`，不下载、不猜测安装目录）；状态里新增 `launcher:'node'|'electron'` 字段：

- `launcher:'node'` → 原生可以启动该命令；
- `launcher:'electron'` → 桌面 UI 明确提示“OpenDesk 0.3.9 无法启动 Bridge 的 Electron 运行时作为 MCP 命令。请先安装 Node.js（或让它出现在 PATH 中）后重新添加；否则请在 OpenDesk 原生界面手动添加 AgentBridge。”

同时桌面文案改为“**OpenDesk 必须完全退出并重新打开**后才读取该配置”（原生只在启动时读），并提示到 “MCP 管理 → 已安装 MCP” 核对。受控用例：`mcp-integration.test.cjs` 新增“OpenDesk native entries prefer a real Node launcher over the Electron runtime”（验证 Node 优先与 Electron 回退时的 `launcher` 值）。

### 14.5 最终真实原生结果（模型0）

用系统 node + Bridge 运行时 `mcp-client.cjs` 写入稳定条目并**重启 OpenDesk** 后，原生日志：

```text
[mcpmgr] Initializing with 1 server configs
[mcpmgr] Connecting to "AgentBridge" (stdio)...
[mcpmgr] Connected to "AgentBridge", listing tools...
[mcpmgr] Connected to "AgentBridge", discovered 7 tools
```

用户可在 OpenDesk “MCP 管理 → 已安装 MCP”看到 **AgentBridge / STDIO / 已连接 / 7 工具**。这是 OpenDesk 一侧“配置被原生读取 + 连接 + 工具目录可见”的真实证据（模型0，用户真实配置），也是十入口中第二个完成该层可见性的入口（第一个是 DSH Web，见 §12.1）。

证据：`artifacts/mcp-open-integration/evidence/opendesk-native-mcp-verified.txt`（原生日志原始片段，含失败与成功两个阶段）。

### 14.6 必须保留的边界（不得写成“调用已通过”）

1. 该条目是**用于原生可见性验证的诊断条目**：其 descriptor 里的 token 不是真实授权，因此**不能据此声称“Bridge 工具调用已通过”**。更正：未登记的同名诊断条目会触发 `MCP_CONFIG_CONFLICT`，不会被Bridge覆盖。应先在原生管理页核实并移除诊断条目，再从Bridge添加正式连接并完全重开OpenDesk验证调用。
2. 只验证了“原生可见/连接/工具目录（7 项）”；**工具实际调用、授权、结果归属未验**。
3. OpenDesk **CLI** 不受本修复影响：0.3.8 仍然没有 MCP 管理面（§12.7），只能导出片段。
4. 原生端只在启动时读取配置；不做“完全退出并重开”时不会生效，Bridge 也不会替你宣称已加载。
5. 未在真实 Windows 启动 alpha.45 的 EXE（与日常后台共用 `%APPDATA%`），MCP02-T16 仍待执行。

### 14.7 alpha.45 候选（已打包）

| 项 | 结果 |
| --- | --- |
| 版本位 | `desktop/package.json` 与 `desktop/package-lock.json` `0.6.0-alpha.44` → **`0.6.0-alpha.45`**（源码修复随之冻结；根 `package.json` 仍 0.1.0） |
| 构建 | 同 §13 的 WSL/Linux 交叉构建（`npm run desktop:dist`，node v22.23.1、electron-builder 26.15.3、Electron 44.7.0），`win.signExecutable:false` → **未签名** |
| 产物 | `desktop/release/AgentBridge-0.6.0-alpha.45-Windows-x64.exe`，**130177443 字节**，SHA-256 **`35674f6c29187524e5e51dbbe983447478508d21d68971b6ec956fd14371b3a6`**；已复制到 Windows `C:\Users\jiqi\Downloads\` |
| 包核验 | `verify-package --portable` → `status: passed`，version `0.6.0-alpha.45`，backendModules 50、coreFiles 84、`coreBuildMatches`/`appAsarSourceMatches`/`frontendMatches`/`linuxBackendMatches` 均 true，linuxFiles 1698，linuxManifestDigest `195081305a67fd70a505989241ae82bccceb9df5d7a6515b2f0de4230fed1a9b` |
| 证据 | `artifacts/mcp-open-integration/evidence/package-verify-alpha45.json`、`portable-sha256-alpha45.txt` |
| 边界 | 未签名、未公开、未打标签、未部署远端；**未在真实 Windows 启动该 EXE**，T16 仍待执行；日常后台/窗口仍为 alpha.42/alpha.43 |

### 14.8 回归（版本变更后）

- 桌面全量 `node --test tests/*.test.cjs` → **753 / 753 通过**（新增 `mcp-client-protocol` 2 例 + OpenDesk launcher 偏好 1 例）。
- 根测试：直接运行 `node --import tsx --test --test-concurrency=1 tests/*.test.ts` → **66 / 66 通过**（约 140s）；此前的 `npm test` 外壳曾超时，改用直接运行取得结果，按此记录并保留该差异。
- 根 `typecheck` / `eslint src` / `build`、桌面 `tsc --noEmit` 全部通过。

### 14.9 对验收表的净影响

| 用例 | 现在状态 |
| --- | --- |
| MCP02-T01（原生列表可见 + 工具）对 OpenDesk Desktop | 原生可见/连接/7 工具目录已有真实证据（模型0）；**获准只读调用未验**，仍不能整体通过 |
| MCP02-T07/T08 对 OpenDesk Desktop | 原生读取与连接证据已有；删除/禁用/编辑仍待执行 |
| MCP02-T16 | 仍待执行（未在真实 Windows 启动 alpha.45） |
| 其余用例 | 不变 |

§13 的 alpha.44 记录保持为历史（该候选的 EXE 与包摘要仍是当时值，不追改）；本节只登记 alpha.45 的修复与候选。

## 15. alpha.46后续开发

[恢复、观测与非GUI接入修复](mcp-open-recovery.md)记录本轮实际实现、证据和未测边界；历史候选与计数不追改。

## 16. 原生组件与真实子任务验收

[后续原生验收](mcp-native-acceptance.md)补齐OpenDesk/DSH已安装原生组件正式授权、缓存/撤权/重开与独立主角色到真实Claude子任务的链路（各1任务成功）。原生父模型自主决策与原生页面仍未测，完整MCP02不准出；不追改§11–§15原始时点结论。
