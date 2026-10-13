# I03A 模块分析与设计

日期：2026-10-08。状态：CLI 实现设计；已批准并实施，测试/真实验收见 report.md。
本文件按模块说明现状、设计和验收责任。范围以 [需求规格](requirements.md) 为准；下文“现状”是 I02 基线；本轮实现路径及结果见下表。


| 模块 | 已实现路径 | 核心职责 |
| --- | --- | --- |
| 终端呈现 | src/terminal.ts、src/cli.ts | TTY 向导/菜单、观察、输入/回复、非 TTY 与旧参数兼容 |
| 本机控制 | src/controller.ts | Unix socket 0600、DTO 限制、后台凭据、配置与提交串行 |
| ConfigStore | src/settings.ts | settings.json 单一权威、revision/原子写、原位导入、默认/验证记录 |
| 进程生命周期 | src/controller.ts、src/native-server.ts、storage/database.ts | SQLite 生命周期锁、后台启动握手、只管理所持进程句柄 |
| Hub | src/hub.ts、protocol.ts | 用户/owner/allowlist、资源占位、requestId 查询、控制路由 |
| Edge/Driver | src/edge.ts、drivers/opencode.ts、opencode-client.ts、forms.ts | 局部应用、原生绑定/检查、deny-all 验证、表单约束 |
| 存储 | storage/hub-store.ts、edge-journal.ts、operations.ts | 快照/资源/历史、原生写前记账、请求级唯一、unknown 保留 |

## 1. 架构选择与数据流

复用 TypeScript、Node、现有 Hub/Edge、SQLite 和 OpenCode Driver。新增基于 @clack/prompts 的终端交互入口与本机后台控制器，使用普通提示、列表和菜单，不实现全屏 TUI，不在 Hub 内加入模型推理或另建 Agent Runtime。

- 配置/启动：交互 CLI → 本机 IPC → 后台控制器 → ConfigStore/对应 Hub、Edge 配置应用。
- 提交/查询：交互 CLI → 本机控制器 → 现有 Hub 用户 API → Edge → OpenCode Driver。
- 等待回复：交互 CLI → 本机控制器 → Hub 授权控制消息 → Edge 台账核对 → 原生 pending 查询/单次写入。
- 推理/工具：始终由原生 OpenCode 执行。交互层只提交受限操作和呈现脱敏结果。

后台控制器维护 Hub、Edge 与明确托管的原生进程，并持有长期凭据。交互呈现层不接收原生密码、Connector token 或 Hub 长期 token。Hub 自身不启动原生 CLI，不执行任意 Shell；进程创建使用固定程序和参数、禁用 shell。

| 入口 | 本轮设计 | 状态 |
| --- | --- | --- |
| `agentbridge` | TTY 下进入交互菜单；缺配置时进入首次向导，已有启用配置时先自动连接再展示操作入口 | 已实现默认行为 |
| `agentbridge setup [--dir PATH] [--import PATH] [--advanced]` | 显式进入终端配置向导，可预览并确认导入 I02 目录 | 已实现 |
| 现有 `agents/run/task/native` | 保留自动化 CLI；交互菜单调用相应能力，避免人工查找内部 ID | 已有命令，按需求扩展 |
| `agentbridge service status --dir PATH` 或 `agentbridge service stop --dir PATH` | 查询或明确停止该实例后台服务 | 已实现 |

无参数且非 TTY 时显示帮助，不启动向导或后台，避免改变脚本执行语义。目录参数均归一到同一规范状态目录；交互入口、配置与后台操作不得产生另一套隐式状态。

## 2. 模块一：终端交互与状态呈现（F02–F08）

I02 基线：已有命令参数、observe.ts 文本格式化与任务观察；没有终端首次向导或统一交互菜单。

设计：

- 首页展示实例状态、Agent 列表和默认目标；菜单提供配置、检查/验证、提交任务、查看当前/最近任务、回复等待与退出。
- 首次自动发现 OpenCode（PATH 和原生安装目录），空格勾选、回车后自动保存并连接，自动做只读检查；默认当前项目、继承模型和后台托管。高级模式才手动编辑目录/服务/模型，草稿保存为停用。
- 勾选前展示安装、当前目录和继承模型来源，普通流程不追加保存/启动确认；连接后显示实际检查和可操作失败原因。已有配置可维护，未启用或离线连接仍显示。
- 列表分开展示配置、连接、验证和工作状态，附最后更新时间与具体错误；读取失败不能显示成空配置，旧快照标记过期。
- 单次 `agents` 是查询快照；交互观察和 `agents --watch` 使用200–250 ms可取消轮询。离开观察停止客户端轮询，重新观察立即查询，不承诺快照自动刷新。
- 新任务先确认目标和工作目录；默认切换只影响新任务。提交前固定 requestId，结果不明只按原 ID 查询，不能自动再发。
- 单次观察显示文本、工具活动、等待和最终结果；退出保留 Task ID，重返只查询。每次新任务仍新建原生会话，不把菜单当连续原生对话。
- permission 提示显示动作/资源及单次允许、拒绝；form 按经核验字段逐项提示并展示待提交答案。未知结构禁止提交，回复前固定 operationId。
- Clack 提示组件 输入与观察输出统一协调；等待提示串行呈现，输出可暂停并补显，避免日志覆盖答案输入。普通操作由选择列表取得任务/请求 ID，高级 CLI 保留显式 ID。
- 原生文本按终端安全文本呈现，过滤可能改变终端行为的控制序列，保留截断标记；内部绑定与日志作为详情。
- 退出交互客户端或关闭终端不停止后台，也不表示任务取消；停止服务需明确操作并显示执行影响。

验收：一个终端完成配置、任务观察和等待回复；状态可区分；退出/重返无新提交；F05/F06/F07 终端刷新与交互场景通过。

## 3. 模块二：本机控制接口与访问校验（F01–F03、F05–F08）

I02 基线：现有 CLI 直接使用 Hub 用户 API；没有用于交互配置和后台生命周期管理的本机控制接口。

设计：

- Linux/WSL 使用状态目录内 Unix socket，目录 0700、socket 0600。IPC 管理权限来自 OS 文件权限，不对网络开放配置管理入口。
- 请求使用有界结构化消息、request ID 和受限操作名；只返回允许的摘要与收据。拒绝未知操作、任意原生 HTTP 路径、任意 Shell 和密码文件读取。
- 本机配置管理与 Hub 任务用户分别处理：控制器可管理本实例，任务提交/查询/回复仍使用明确的既有 Hub 用户身份和 allowlist。
- 导入保持对应用户权限，不增加冒用旧任务 owner 的能力；其他用户私有任务仍由 Hub 拒绝。
- 空配置时控制器和 IPC 独立可用；Hub/Edge 仅在配置有效后启动，不能将空配置塞入现有要求非空的 schema。
- Hub/Edge 故障时保留配置操作和服务状态；分项返回错误与最后更新时间，一个 Agent 故障不关闭整个入口。
- 原有自动化 CLI 保持兼容；菜单经控制器复用 Hub 所有权和 Edge 执行校验，不能绕过权限或去重。

| 操作组 | 能力 | 关键规则 |
| --- | --- | --- |
| setup/discovery/import | 草稿、发现、预览/确认导入 | 确认前不改旧文件，不返回 Provider 密钥 |
| agents/config | 摘要、创建/编辑、启停、默认目标 | expectedRevision、资源锁、执行中限制 |
| agents/checks | 基础检查、显式真实验证、查询记录 | 验证生成正常可追踪任务 |
| tasks | 创建、查询当前/最近任务、按 requestId 查询结果 | Hub owner/allowlist 生效，不自动重发 |
| tasks/interactions | 查询 pending、单次回复、查询收据 | 任务与原生请求绑定，无任意目标代理 |
| service | 实例状态、明确停止 | 只操作本实例进程，停止不等于任务已取消 |

确切 IPC DTO 在开发时集中校验。验收：其他 OS 用户不能连接受保护 socket；摘要无长期凭据；Hub 故障仍能维护配置；Hub/Edge 既有访问规则继续生效。

## 4. 模块三：ConfigStore、导入和验证记录（F02–F05、F08）

I02 基线：config.ts 生成固定 I02 目录；配置启动时读取，没有版本、默认目标、草稿、验证记录和动态应用状态。

设计：

- 默认根目录使用 Linux/WSL 用户状态目录；显式 `--dir` 使用规范化真实路径指定实例。开发/测试用项目或临时目录，不隐式迁移用户数据。
- 单份版本化权威 manifest 包含实例/本机身份、Hub/Edge 配置引用、Agent 定义、默认、revision、草稿与导入来源；旧 JSON/凭据路径可作兼容引用。
- 凭据单独受保护保存，manifest 仅存引用，控制器只返回摘要。目录 0700、敏感文件 0600。
- 单写锁和 expectedRevision 控制并发；临时文件完整写入后原子替换，失败保留旧版，不假设多个 JSON 可同时原子更新。
- 先校验并取得资源维护锁，再保存 desiredRevision；局部应用成功才更新 appliedRevision。失败显示待应用/失败和仍生效版本。
- 名称/默认等设置不替换 Driver；执行指纹包含真实目录、服务、原生 Agent、模型来源/有效模型、权限等条件。
- 验证记录关联指纹、实际模型、Task/Session、时间与结果；模型继承来源或执行配置变化后标记过期。
- I02 原位导入保留 Agent/Connector/owner ID、token 引用和数据位置，不复制 SQLite，不接管仍由旧 `up` 使用的数据。
- 新连接维护受信任绑定与 allowlist，保持 imported 用户权限；停用拒绝新任务，旧等待仍可回复。无删除操作。
- 任务持有执行 revision/快照和原生绑定，改配置不回写旧任务。启动读取记录，核对占位后才处理待应用配置，不重建任务或释放 unknown。

验收：原子保存、版本冲突、导入成功/失败/占用、多连接维护及验证过期；名称编辑保持 ID，历史零丢失。

## 5. 模块四：后台生命周期与进程所有权（F01、F03、F08）

I02 基线：localConfig/up 强制单 OpenCode，先启动原生再启动 Hub/Edge；任一服务结束导致整组关闭，up 在前台等待。

设计：

- 分开交互客户端和后台控制器；同一规范目录只允许一个控制器。锁以 nonce/IPC 握手和所有权核验，不能只判断文件存在或 PID 存活。
- 入口连接现有实例；无实例时启动脱离交互终端的控制器，ready 后继续菜单。并发启动连接同一实例，不能产生两组 Hub/Edge。
- 后台输出写入受保护且脱敏日志，不持有终端输入输出。退出菜单、Ctrl+C 退出观察或关闭终端只关闭客户端。
- 空配置先提供控制接口和向导；Hub/Edge 按有效配置维护。多 OpenCode 连接共享本机 Edge，不同目录各有 Driver。
- 已有原生服务只探测/连接，不纳入 kill 清单。新增/变更只维护目标资源，不能重启整个 Edge 使其他任务变成 unknown。
- 明确停止先显示影响，再关闭自身 Hub/Edge 和拥有的原生子进程；停止不视为已确认取消。
- 崩溃后核验遗留进程；无法证明归属或状态时提示冲突，不盲目 kill/reuse。复用原生服务需核对地址/认证，不自动提交旧 Prompt。
- socket/端口冲突区分自身、原生服务和无关程序。无自动重连/对账；明确检查或重启仍保留 unknown 占位。

验收：并发启动复用、终端关闭后台仍运行、重返查询、外部服务不被停止、Agent 故障隔离、PID 复用、旧 up 冲突及停止影响。

## 6. 模块五：Hub 配置状态、资源占位与控制路由（F03、F05–F08）

I02 基线：Hub 注册/查询和权限可复用；在线/busy 按 agentId，心跳只更新 healthy。缺 enabled、配置版本、真实资源占位和等待控制消息。

设计：

- 保持 owner/allowlist 和 ACK 不等于完成。增加 enabled/appliedRevision、受信任描述局部更新和能力声明，限定对应 Connector 授权 Agent 集合。
- 描述更新不改当前任务绑定；实例/维护锁阻止更新与新提交竞态。
- 资源键为稳定本机身份 + realpath 目录，不含可编辑名称、Agent ID、模型或端口。活动、unknown、维护均持该键占位。
- Hub 接单和 Edge 执行均核对占位；同一真实目录最多一个启用连接，不能用新 ID、符号链接或端口绕过。
- 配置和 Hub 同时拒绝停用目标的新任务；原 requestId 查询返回旧记录且按 owner 隔离，结果不明只查询。
- 新增受限 interaction query/reply/result。Hub 校验 owner、Connector、executionId、快照、原生绑定及可回复状态，再转发正确 Edge。
- 回复只含请求 ID、单次决策/答案和 operationId，不接受交互端指定 serverUrl、密码或任意原生 session。
- 收据和任务状态分开，超时为结果不明，不自动重发原生写。新能力与旧 CLI/Mock 兼容，不支持的新消息不得静默启用。

验收：交互与自动化 CLI 的权限/停用/占位一致；改一连接不干扰另一任务；越权拒绝；重复提交/回复无额外执行。

## 7. 模块六：Edge、OpenCode 与真实验证（F03、F04、F06–F08）

I02 基线：Driver/job 按 Agent 管理，binding 在 Prompt 前持久化；check 验证版本、目录和模型目录；原生 helper 直接持密码，尚无完整 Hub→Edge 回复控制链。

设计：

- 资源锁下核对 Hub active 和 Edge journal，仅空闲目标可局部替换 Driver/托管服务，不断开整个 Connector。
- 更新来自本机可信控制器；Edge 上报生效 revision/能力，失败不显示已生效。
- 控制消息核对 execution、快照、native session/目录，再读 pending；仅匹配请求可写。
- 同一等待串行处理，operationId/内容指纹持久化；原生请求最多一个未确认/已确认回复，不同 ID 并发也不重复写。
- 原生写前记 attempted；确认接收记 confirmed，明确拒绝记 rejected，无法确认记 unknown。不明操作不再发，也不自动判为任务完成。
- permission/form 只解析真实核验字段，未知结构明确不支持，不把任意 JSON 作为可回复问题。
- 基础检查分项返回，modelConfigured 不等于 modelVerified；真实验证使用正常任务路径和独立受限会话。
- 开发先核验 OpenCode 2 禁止工具、实际 Agent/模型与回复接口；已有 edit ask 证据不能证明 deny-all。
- 原生约束确认有效后才开放验证，核对随机标记、消息、终态及工具数；提示“不要调用工具”不能充当禁止工具保证。
- 错误分类脱敏，超时/断连保留不明，不自动改模型或重发 Prompt。每新任务仍新会话，沿用截断/binding 保护。

验收：真实合约、回复/权限/表单、禁止工具、资源锁和不明操作；表单合约与模型自主提问分别报告。

## 8. 模块七：Storage 与迁移（F03、F04、F06–F08）

I02 基线：Hub 持久 Task/事件，Edge 持久 claim、invocations、native_bindings；缺交互台账、资源键、快照及验证记录。

| 持久对象 | 关键内容 | 不变量 |
| --- | --- | --- |
| manifest | revision、配置/引用、默认、desired/applied | 原子保存，旧版本不覆盖新配置 |
| 执行快照 | Agent、资源键、revision、目录/服务/模型、认证引用 | 接单后不变，不直接保存敏感值 |
| 资源占位 | resourceKey、task/execution、状态/维护锁 | busy/unknown 不因换 ID 或停用释放 |
| 验证记录 | 指纹、实际模型、Task/Session、时间、结果 | 当前配置有真实证据才标通过 |
| 交互台账 | operationId、nativeRequestId、绑定、指纹、attempted/result | 写前记账，重复不重发，不明不等于完成 |
| 实例记录 | SQLite 实例锁、IPC 地址、进程句柄、状态 | 不只靠 PID/地址接管或终止 |

迁移添加版本/必要字段，保留旧数据和 ID。旧占位优先由 native.workspace 回填，无 binding 时核对原描述/Edge 配置；仍不明的 unknown 保守锁定。旧 CLI 查询兼容，不改变已确认终态。失败停止相关新写入并显示原因，不以重建空库继续。

验收：原位导入、缺 binding 的 unknown、写盘故障、并发保存、台账去重、历史零丢失。

## 9. 契约门槛与范围控制

批准开发后先核验已安装 OpenCode 2 的受限验证会话、实际 Agent/模型和 permission/form，记录版本与脱敏结果，不以 fixture 冒充真实能力。

状态性能只测后台已确认事件到交互观察或 `agents --watch` 的终端呈现：20 个样本 p95 ≤ 2 秒；检查、原生心跳和模型耗时分别记录。单次 `agents` 只验收快照正确性。

本轮不加入主 Agent 推理/委派、连续原生会话、取消、自动恢复、跨设备安装或完整看板。连续会话与控制/恢复属于 I03B；设计逐项追踪 requirements.md 和 testing.md。
