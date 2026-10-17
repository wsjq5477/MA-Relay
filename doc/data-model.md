# 对象、身份与持久数据

## alpha.28已预发布：SSH持久拒绝恢复

agent-network.json version=1请求可选daemonRejection：version=1、source=daemon.receiptRead、machineId/daemonId/profileId/requestId/op、target、规范参数fingerprint、code=NOT_CONFIGURED。只在可信实时读取与原意图双指纹/目标匹配后写入，并同步dispatched=false/preparationRejection；重开重核，不全量迁移，不含远端任意文案或秘密。 [设计、需求、开发、验收与边界](iterations/I06/daemon-rejection-recovery.md)。

## alpha.27：原未派发证据及内部持久化错误

沿用现有版本/字段：Codex task.reconciliation记录最近原任务核对，准备失败为failed；job.json完整、仅accepted、无native/offset且worker.log/heartbeat/events全缺失才可证明未越过worker启动边界。有启动证据或run丢失时保持unknown。中央pending.result.error.code可为NETWORK_PERSIST，message保留原OS码/原因；只有原节点/机器/请求/双指纹匹配、dispatched严格false、无任务会话绑定/在途job才能判rejected。历史EPERM另核对本profile的精确UUID tmp→agent-network.json路径，不迁移/删除原行。派发后错误不回滚dispatched。见[专项](iterations/I06/windows-start-persistence.md)。
## alpha.24停止记录

格式仍为3，旧记录缺stop/cancellation字段兼容。run.state新增stopping；run.stop记录requestedAt、目标attemptId列表、externalCount、完成后的completedAt。attempt.cancellation私有记录稳定operationId、匹配taskId、dispatched发送标记与独立控制state；公共attempt只给stop.state。取消confirmed/rejected不改写attempt真实状态。run.stop完成只关闭协作，不设置业务acceptedAt。停止前已保存的消息、任务、版本报告及unknown占用保留；恢复只查询原请求和原控制。[完整语义](iterations/I07/native-stop.md)。

## I07A/B与I07C首批当前持久数据

alpha.23 / 2026-10-16：profile下`team-space.sqlite`，state/receipts同事务提交；使用Node自带SQLite，WAL、FULL同步，不依赖用户另装数据库。[实现](../desktop/electron/team-space.cjs)、[任务交接交付](iterations/I07/task-handoff.md)。

| 记录 | 当前身份与行为 |
| --- | --- |
| agents | native引用真实nodeId且同节点不重复登记；mcp引用独立外部实例标识。职责/输入/输出/边界为用户声明，不作执行身份或能力实测证明 |
| teams / runs | 小队保存主角色/成员/公共约定；每次工作保存成员快照、目标/完成标准、active/stopping/completed/closed和paused，completed带验收人/时间/说明；撤权变更工作revision，不自动取消原任务 |
| documents | 文档级owner/editorIds，revision与完整history；更新核验expectedRevision，冲突不覆盖 |
| messages / deliveries | 群消息按工作顺序追加；每通知接收者分别保存pending/delivered/read，分页游标不代表已接手任务 |
| sessions | 私有接入身份，connection或native；公共视图不返回。原生身份绑定真实原请求/节点/来源，原终态失效；手动外部连接受实时成员/工作状态约束 |
| attempts | 手动或自动一轮执行绑定requestId/Task/conversation与原结果；可选workItemId/workRound绑定；自动尝试还关联触发事件/原尝试/续接Conversation，实际原生Session私有保存且公共投影剔除；unknown不重放，原生终态只在有效验收提议存在时可能完成总工作 |
| workItems | 任务身份/负责人/kind/依赖/修订/轮次、waiting/ready/running/blocked/review/completed，reports追加保留；当前报告引用与不可变artifactId分开 |
| reports / artifact | 交付含唯一版本/引用/生产者，复验含精确targetArtifactId/版本/实际取得声明/证据引用；标明user_report或member_report，不伪装成宿主执行事实 |
| handoffGrants | 用户授权的fromTaskId/toTaskId/action、enabled/maxUses/used/revision；撤销不删除使用历史，队员不能扩大 |
| handoffs | 每条交接的路径、来源/目标轮次、实际发送者、授权引用与时间；和任务/消息/通知同事务，重复operationId不再次耗用 |
| activationEvents | 格式3新增事件身份/业务去重key、成员/工作/类型、pending/consumed/handled/superseded及原attempt关联；就绪/报告/终态/明确协调/无进展事件按权限消费 |
| run.automation | 用户授权的自动成员、累计used/maxActivations、startedAt/maxMinutes/idleMinutes、generation及可见限制；重新启用不清零 |
| run.acceptancePending | 原生主角色的验收提议，保存原attempt、任务/工作修订和事件位置；终态时重新核验，收据不等于验收生效 |
| receipts | 按用户或工作成员及operationId保存指纹/原结果；相同内容读原收据，修改内容拒绝；撤权后不能用旧收据读回材料 |
| 私有broker文件 | 令牌及本机endpoint，和公共材料分开；重启刷新原描述文件，不创建另一项业务工作 |

状态材料容量8MiB、收据10000条及32MiB阈值，到限拒绝新写入，原unknown/未完成记录不自动删。状态格式版本1至2新增任务/交接，版本2至3原子新增activationEvents，原记录不重编号，旧记录和收据原身份保留；旧版本不支持读取新格式，不自动覆盖降级。公共文档导出不是授权源；业务状态不混入Core Task.status，自动激活关联原尝试台账，不能作为原生Task或取消终态的替代物。原机器/节点/原生身份不变。

更新：2026-10-12。这里解释整个系统的对象关系；具体读写接口见 [协议](protocol.md)，状态与恢复责任见 [M07](modules/07-task-session/design.md)。

## 当前运行缓存与原意图兼容

runtime/runtime.json 新清单为 `{version:2,executable,files:[{name,size,sha256}]}`，目录仍以 Electron 版本/架构归类，损坏副本的替代发布到独立 `.repair-<随机值>` 目录；随机值仅隔离资源，不是机器/节点/请求身份。旧无 version 清单兼容 size 检查，仅忽略 runtime.json 自引用条目。原业务 JSON 版本、请求 ID 和内容不变；符合原未派发正面证据的旧 unknown 记 rejected 并保存 reconciledAt/核对原因。证据不足不迁移或释放。[完整边界](iterations/I06/runtime-recovery.md)。

## alpha.19 Linux CLI 发现边界

Linux 扫描目录覆盖增加，不新增节点/配置字段；节点仍按原机器、适配器与规范 executable 识别。重扫保留同一安装身份；任意自定义 rc 环境仍非统一配置来源，不能靠目录或机器别名释放原 unknown。 见 [专项](iterations/I06/linux-cli-discovery.md)。

## 1. 对象关系

```mermaid
erDiagram
  COORDINATOR_PROFILE ||--o{ MACHINE : 管理
  MACHINE ||--o{ AGENT_NODE : 安装
  AGENT_NODE ||--o{ EXECUTION_CONTEXT : 执行时创建
  EXECUTION_CONTEXT ||--o{ CONVERSATION : 承载
  CONVERSATION ||--o{ TASK : 包含轮次
  TASK ||--o{ OPERATION_RECEIPT : 控制操作
  TASK ||--o{ EVENT : 执行事实
  TASK ||--o{ DELEGATION : 父任务委派
  DELEGATION ||--o| TASK : 确认后绑定子任务
```

这是产品逻辑关系，不是声称所有对象都在一张中央数据库中。中央、daemon、Hub/Edge、原生宿主各自保存所属记录。委派在 pending/rejected/unknown 初期可能还没有可确认的子 Task ID，确认后绑定对应子任务。

## 2. 需要分开的 ID

| 字段 | 含义 | 不能替代的字段 |
| --- | --- | --- |
| coordinatorId | 当前中央 profile 的持久身份 | 不是用户手输的设备凭据 |
| profileId | 远端安装/状态所属的中央 profile | 不是服务器主机密钥 |
| connectionId | 一条 SSH 连接配置，或旧工具连接记录；命名空间不同 | 不是机器硬件编号，也不是节点 |
| machineId | Windows、WSL 或已验证远端用户环境身份 | IP、显示名称和目录 |
| daemonId | 远端所属 profile 的持久 UUID | 不提供硬件级不可复制证明 |
| nodeId | 机器中一个工具安装的网络身份 | agentId、项目目录、模型 |
| contextId | 节点在某目录/协作模式下的执行上下文 | 原生 Session ID |
| agentId / instanceId | 后端执行实例；中央聚合会加机器前缀 | 用户面对的节点 |
| requestId | 一次需求的稳定幂等 ID | RPC id、taskId |
| taskId / executionId | 一轮任务与其执行归属 | Conversation ID |
| conversationId | Bridge 的多轮会话 | 原生 Session ID |
| native.sessionId / messageId | 原生会话与本轮关联；OpenCode 是原生 Message，Claude 可能没有消息 ID，Codex 当前以 Bridge requestId 关联 | 不同适配器不保证相同原生 Message 语义 |
| operationId | 权限回复或取消等控制操作的稳定 ID | 原生权限 requestId |
| delegationId | 父子委派关联记录 | 子任务 requestId |

RPC `id` 只把一条通道响应与请求配对。重连后换 RPC id 是正常通信行为；同一需求的 requestId 不能因此改变。

## 3. 身份如何生成与路由

Windows 本机目录初始化时保存随机 `local-...` machineId。WSL 按发行版名称生成稳定 ID，并记录 Windows 宿主。SSH 完成认证、daemon 检查与协议握手后使用 `ssh-<daemonId>`；不同用户/profile 各有自己 daemon 状态。

节点通常由机器 ID、adapter 和可执行位置生成。若后端报告解析后的实际 launcher 路径，保留已有权威 nodeId，避免同一工具被分成两个节点。

后端 Task、Conversation、实例 ID 聚合到中央时用 `machineId::原ID` 定位来源。下发原机器时还原原 ID。原生 Session/Message ID 不加此前缀。请求或控制响应只能解除相同来源机器的未确认记录。

显示名称可变，不能参与任务所属判断。SSH 地址别名只有在主机密钥、daemon 身份及用户归属核实后才能归并，不能只按相同 IP 合并。

## 4. 状态是不同维度

| 对象 | 当前字段 / 状态 | 阅读方式 |
| --- | --- | --- |
| 机器 | online、error；SSH 另有 connectionState | 是否能联系此执行环境 |
| 节点 | discovered、connected、offline、tool_error、unsupported；busy、unconfirmed | 是否接入、工具是否可用、是否有占位 |
| 任务 | queued、accepted、running、succeeded、failed、cancelled、unknown | 这一轮执行的事实 |
| 原生等待 | Task.waiting 的 permission/input 与原 requestIds | 任务可能仍是 running，但需要用户回复 |
| 控制收据 | pending / unknown / confirmed / rejected 等所属实现状态 | 控制请求是否获得明确回应 |
| 协作关系 | leaderId、memberIds、revision | 获准委派的新任务范围 |

`waiting_input`、`cancel_requested` 出现在早期初稿，但不是当前统一 Task.status 的值。不能把取消收据 confirmed 显示为任务 cancelled；不能把机器离线显示为已完成任务失败。

SSH 状态合并时 error/connectionError 缺失表示当前无连接错误，删除 machines.json 中旧值；文件与对外 JSON 字段结构不变。快照 RPC 的本次失败独立于 SSH 通道状态；恢复不改写 Task.error、Task.status 或 pending 台账。

## 5. 持久文件与拥有者

路径以下用 `<desktop-profile>`、`<remote-profile>` 和 `<context>` 表示，避免把某个人的电脑目录当成部署默认值。

| 所属位置 | 文件 / 数据 | 负责写入者 |
| --- | --- | --- |
| desktop profile | `desktop.json` | Coordinator 的设置入口 |
| desktop profile | `coordinator-identity.json`、`coordinator-status.json` | 所属 Coordinator；身份包含内部秘密，不能复制到共享文档 |
| desktop profile | `machines.json`、`agent-network.json` | 机器目录与网络台账 |
| desktop profile | `pending.json` | 中央未确认请求与控制记录 |
| desktop profile | `graph-layout.json`、`graph-pending.json` | 中央独立布局/收据与图写入意图 |
| desktop profile | `ssh-connections.json`、`ssh-known-hosts.json` | SSH Manager 与主机信任管理 |
| desktop profile | `ssh-credentials/*.json` | Windows DPAPI 密文；连接配置只保存引用 |
| desktop profile | `coordinator/versions/*`、`coordinator/runtime/*` | 冻结的代码/依赖/运行资源 |
| remote install | `install.json`、`current.json`、`versions/<version>/*` | 所属 SSH 安装器 |
| remote state | `machine.json`、`daemon.lock`、socket 与 PID 记录 | 所属 Linux daemon |
| remote state | `daemon-receipts.json`、`daemon-events.jsonl` | daemon；事件 cursor 持久化 |
| MachineHost state | `node-contexts.json`、`node-contexts/<contextId>` | 执行上下文宿主 |
| context / CLI instance | settings、Hub SQLite、Edge journal、operations 与 native identity | 所属 controller/Hub/Edge |
| 原生工具目录 | 账号、供应商、模型偏好与原生历史 | 原生工具；Bridge 没有全局配置写入职责 |

Claude/Codex 还保存其宿主 JSON/worker 状态，具体字段和文件见各 [原生模块](modules/06-native-adapters/design.md)。数据库格式、锁和迁移规则见 [任务模块](modules/07-task-session/design.md)。

## 6. 路径与目录占位

Windows `C:\project` 与同一宿主 WSL `/mnt/c/project` 可对应同一物理目录，共享任务占位。WSL UNC 路径必须属于所选发行版。真实目录解析后的别名也不能绕过占位。

SSH 的 `/mnt/c/project` 属于远端独立文件系统，不能与本机 Windows/WSL 混同。远端路径按远端 Linux 的 realpath 校验，不自动同步文件。

运行、等待、unknown 都可能占用节点/目录。只读查询能明确原任务终态后才解除，缺少原收据不够。具体占位与锁的持久性边界以 [M03](modules/03-machine-network/design.md) 和 [M07](modules/07-task-session/design.md) 为准，不能宣称多个独立 Bridge 中央具备全局分布式锁。

## 7. 修订、迁移与备份

关系 revision 防止两个界面覆盖授权。alpha.6 图布局 layoutRevision 与授权 revision 分开；graph-layout.json 和 graph-pending.json 的实际格式见下方。

机器目录、网络、安装清单、协议和 SQLite 各有独立版本；不能用桌面 app 版本替代它们。读取未知格式或归属不明时停止接管，保留数据。旧模型覆盖只能作为历史实例绑定，不能迁移为新节点的模型设置。

停机备份整份所属状态与安装记录，并保护凭据；活动 SQLite 不能只复制主文件而忽略 WAL。复制 daemon 状态到另一服务器不会自动授予新机器同一身份；主机密钥/身份冲突必须核对。

## 当前 6A 候选验收结果

OpenCode/Core 会话响应额外携带 canContinue/kind，均从持久原生绑定、上一轮状态、验证标志及配置/资源归属计算，不新增持久列。Conversation/native Session 的真实两轮与重开保留见 [6A 验收](iterations/I06/acceptance.md)。

## Linux 发布兼容数据

alpha.4 的离线 manifest 新增可选 `compatibleDaemons: [{version,manifestPath,manifestDigest}]`。路径仅能是清单内 `compatible-daemons/<version>.json`，其文件 SHA-256 和内容 manifestDigest 均校验，版本不能重复。旧协议 2 manifest 不要求有该字段。当前 alpha.10 明确收录 alpha.2–alpha.9；未知或未来版本不按协议相同自动接受。

SSH probe 的 `daemonVersion` 是实际选中后台版本，`clientDaemonVersion` 是客户端新安装包版本，`reuseCompatible` 是展示信息，`installNeeded=false` 表示旧安装可复用。执行分支按实际可信清单选择结果判定，不能凭缓存展示标志绕过校验。旧 current.json、daemon 身份和任务数据无需迁移。

## I06B 关系、布局与图操作

agent-network.json 增加 relationOperations，每项含 operationId、state=confirmed、内容 fingerprint 和 data（提交时的 collaboration）。现有 version=1、节点、请求、委派与 ID 不迁移或重建。图权威边仍来自 leaderId/memberIds；成员顺序不改变权限。

graph-layout.json 是 version=1 容器：layout 包含独立 layoutRevision、groups[machineId] 与 nodes[nodeId] 的 x/y、viewport 的 x/y/zoom；operations 为同类稳定收据。节点坐标相对于机器组，几何 parent 不代替 parentMachineId。损坏文件先复制为 graph-layout.json.corrupt-*，恢复默认位置不重置关系。

graph-pending.json 保存 operationId、lane=relation/layout/node/machine、完整允许的 params、内容摘要、pending/unknown/confirmed/rejected 与时间。未知原 ID 不因另一个 ID 或窗口而解除；原业务收据确认后对账。浏览器本机缓存 base/draft/layout、图两个 pending 原操作和独立的节点/机器原操作意图；机器参数含地址/认证方式但没有密码/口令，秘密不存入本机缓存。

机器 lastSyncedAt 标记成功快照时间；节点 uncertain、waiting、lastError 分别投影原任务的 unknown、等待与最近失败。原 Task 七种状态与控制收据语义不变。


AGENT_UNHEALTHY 的原执行前拒绝使用现有 daemon-receipts 的 rejected/error 与中央 pending 的 rejected/result，不新增版本或字段。旧 unknown 记录只在原查询依据其保存的确定拒绝核对，其他 unknown 原样保留；Task 状态未因此改变。

alpha.8 的布局读取可用状态是前端临时状态，不改变 GraphLayout 或收据格式。本机模式保留浏览器 State 中坐标、视口、layoutDirty 与所有原 pending ID，不创建后台确认记录。仅在图接口恢复支持且对应 lane 无 pending、修订可校验时同步。

## alpha.9 节点管理事务

AgentNode 新增可选 managed/removed，缺省兼容旧目录；显式管理后 connected 不被扫描或原生上下文报告覆盖。移除为可恢复标记，快照保留历史身份，UI 隐藏卡片，新需求受中央接入状态约束。agent-network.json 新增 nodeOperations，原子提交节点、授权和收据；版本仍为 1。GraphOperationJournal 新增 node lane，与 relation 未确认意图互锁，布局独立。旧版本不会理解显式移除语义，含此状态的配置不支持直接回退旧中央；保留数据/备份，不靠清空节点或原请求恢复。

`manageNode` 参数 `{operationId,nodeId,machineId?,action}`，action 为 attach/disconnect/remove；返回 `{operationId,state:"confirmed",fingerprint,data:{node,collaboration}}`。`nodeOperation` 以原 operationId 返回 confirmed、确定拒绝的 rejected 或 not_found；not_found 不证明未执行。断开/移除撤销相关权限，有变更才增关系修订。来源校验、离线/忙碌/原生 pending、节点/授权 pending 拦截，接入锁避免并发新任务。snapshot.nodeManagement=true 声明中央能力；新界面在旧中央禁写，原本机布局模式保留。完整语义、错误与验证见 [alpha.9 节点管理](iterations/I06/node-management.md)。

## I06C 当前数据增量

| 文件 / 字段 | 当前定义与边界 |
| --- | --- |
| ssh-connections.json / connection.revision,removed | 同原 connectionId/daemonId/machineId；编辑更新修订，removed 禁止自动连接；绑定主机公钥、UID 与原用户保持 |
| ssh-connections.json / lifecycleOperations | operationId、state=confirmed、fingerprint、data.action/machineId/connectionId/revision；与配置原子写入，查询不重做配置 |
| agent-network.json / removedMachines,machineOperations | 隐藏机器集合与原管理收据；移除撤权与收据同文件原子提交；恢复不重授权，nodes/requests/delegations 保留 |
| graph-pending.json / lane=machine,method,params | secret-free 原意图与指纹；machine/node/relation 未知互斥，layout 独立；原 SSH 收据可用于幂等补齐本地网络，缺收据保留 unknown |
| machine-history.json | 中央私有、按 machineId 的已观察 agents/tasks/conversations；后续分页合并旧任务/会话，排除原生配置/认证内容；不是未观察原生数据库的完整导出 |
| historical | 离线/移除读取历史标记；非终态保持 unknown，历史会话 canContinue=false；不能替代原请求或控制收据 |

协议仍为 2、网络/机器目录格式仍为 1，新增可选字段由当前代码解释；旧版本不识别 removed/removedMachines，直接回退旧 Coordinator 不支持，完整升级回滚迁移待后续。原身份、占位与原生 Session 不改变；详细事务和实际验证见 [6C 首批](iterations/I06/machine-management.md)。

## alpha.11 维护状态与秘密最小化

| 文件/字段 | 归属与规则 |
| --- | --- |
| ssh-connections.json.lifecycleOperations | 原操作 ID、fingerprint、remoteLaunched、私有 remoteInput/controller；公开结果去掉控制器与输入 |
| connection.maintenance / daemonVersion | 当前原维护状态及实际版本；维护暂停自动重连，不重建机器身份 |
| maintenance.json | 远端持久维护准入租约；只原操作释放，崩溃保留直至原阶段修复 |
| maintenance-operations.json | 原 ID/内容摘要、worker PID 与启动标识、阶段、状态及安全结果；元数据锁防查询覆盖完成收据 |
| maintenance-input-*.json | 本 profile 私有原维护输入，不含 SSH 凭据或原生账号配置 |
| maintenance-runtime/<digest> | 可信控制器/私有 Node/helper；不随安装卸载删除 |

## alpha.15 维护收据发送前失败边界

lifecycleOperations 维护行区分失败阶段：启动命令的 SSH 通道打开被拒可证明原输入未离开本机（错误对象内部 open 标记），此类失败换新连接重试一次后仍未发出时，收据记 **rejected**（DAEMON_NOT_STARTED、remoteLaunched=false），不产生远端无记录而查询永远 not_found 的 unknown；流中断/超时等可能已发出的失败保持原 unknown 收据，仅按原 ID 查询。凭据缺口在维护入口置 needs_credentials，不折算为 DAEMON_STAGE_REJECTED。见 [I06C 收尾 alpha.15](iterations/I06/final-delivery.md)。
| current.json / previous.json | 原子版本描述：version/digest/规范 versionPath；不迁移或删除原 Task/Session |
| pending.json | 表单 answer 值用 [redacted] 替代，原输入先计算摘要，旧记录脱敏迁移；损坏不等同空台账 |

网络目录版本仍为 1，远端协议仍为 2。Linux daemon 版本回滚只接受本地可信包；旧 Coordinator 不理解新增管理状态，直接覆盖降级仍不支持。not_found 不释放原操作占位，worker PID 存活判断还需原启动标识。历史 retained state 的清理需另行授权，维护 uninstall 只删已验证安装文件。见 [I06C 收尾](iterations/I06/final-delivery.md)。

## alpha.14 安装上传失败的明确边界

`ssh-connections.json.operations[operationId]` 的安装 status 保留 pending/confirmed/unknown，并以 rejected 标记上传器明确 `SSH_UPLOAD_FAILED`：该错误只从打开/写入/关闭归档阶段产生，尚未进入解包/激活。safe error 含类别、阶段及 ACK 字节数，不含服务器原始文字或秘密；SFTP 数值状态可保留。此错误暂停自动重连。界面补录凭据、重新 testSsh、查看摘要并批准 connectSsh，未变化摘要沿原 connectionId/operationId。其他已发送步骤失败仍是 unknown，不显示新安装入口，也不从该安装状态推定原生任务或控制结果。没有新增 RPC 或 daemon 协议版本。见 [迭代证据](iterations/I06/ssh-upload-recovery.md)。

## alpha.16 原维护未发送的持久化时机

首次通道在输入接受前被拒绝，保存 remoteLaunched=false 后才能获取新登录；新登录成功、准备发送时保存 true。原查询仅用既有 false 证明未发送，返回 rejected 并同步对应机器 maintenance.state 与 autoReconnect=false。字段/原操作标识不变；缺少证明的旧 unknown 不追溯解除。见 [增量](iterations/I06/maintenance-launch-recovery.md)。

## 未派发拒绝与阻塞投影（alpha.20 已预发布）

agent-network.json 版本仍为 1；requests 新增可选 inputFingerprint 与 preparationRejection。前者保存协作继承前的原输入指纹，后者保存原生派发前已结束的准备错误码；fingerprint 仍保存有效内容。无字段的旧意图不从当前配置状态补造证明。原始 NOT_CONFIGURED 或历史 Windows OpenCode 资源错误只在同源、内容一致、dispatched 严格为 false、无 Task/Conversation 绑定及在途 job 时恢复。

pending.json 的原格式和状态不变；本地 pending IPC 的每条记录可新增 blockedNodeIds，动态投影阻塞节点，不写回磁盘。不以当前 UI 选择修改原资源；共享目录通过持久实例及 workspaceKey 识别，真实目录就绪后再次核验。任务终态和控制 confirmed 的语义不变。[专项](iterations/I06/pending-isolation.md)。

小队attempt可选`waiting={kind:permission|input,requestCount}`保存安全的等待投影；私有`waitingFingerprint`对类别及去重排序的原requestIds摘要，仅用于重复通知抑制，公共attempt不返回该摘要或原生请求ID。unknown不抹掉上次等待；可信新快照/终态清除。格式仍为3，无迁移要求；旧记录缺字段即无已观察等待。见[I07C等待专项](iterations/I07/native-waiting.md)。

自动attempt.resumeConversationId是原续接目标约束，首条观测写入conversationId之前就须匹配它；之后按既有绑定匹配。没有新增存储字段或版本，拒绝外来Conversation不改变原request/attempt/意图身份。[专项](iterations/I07/intended-conversation.md)。
