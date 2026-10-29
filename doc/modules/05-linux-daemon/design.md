# M05 Linux 机器后台设计

## 不受支持后台的明确确认替换

M05-F01/F02：当前可信维护控制器新增replace，旧目录仅作为需保留的来源标记，不执行其中Node或代码。目标/controller仍严格逐文件校验，原daemonId、owner/profile、锁和进程起始时间核对后按任务/收据门禁停机并切换。失败后不运行未校验源代码回滚，保持unknown；原ID恢复只在原进程死亡证明或目标已健康时完成同一配套目标。[完整状态机与范围](../../iterations/I08/issue29-explicit-daemon-replacement.md)。


当前公开alpha.70已包含#27/#28修复，标签冻结5c95b98。225项产品输入与实际EXE3405资源匹配，源码/EXE/SHA公开且匿名完整下载一致。普通EXE合成恢复/完整重启、实际包内恢复和回环SSH UI已验；真实用户profile与完整矩阵仍按各自边界。[本轮发布与分层验收](../../iterations/I08/alpha70-release.md)。

M05-F01/F02：WSL原启动脚本、Node选择与就绪帧不改；Windows等待读取器就绪120秒，Linux/SSH协议与daemon原输入不变。 [本轮设计与证据](../../iterations/I08/alpha67-hermes-linux-live.md)。

M05-F01/F02：Linux daemon/WSL/SSH宿主在自身环境发现Hermes，支持与HERMES_HOME分离的源码根及原生发布启动器；不依赖.bashrc/.profile、不继承Windows安装路径。离线包包含同一实现，升级和远端部署仍需原有操作，本轮不自动部署SSH。 [本轮实现、验证与限制](../../iterations/I08/alpha66-hermes-linux.md)。

M05-F01/F02：离线alpha.65资源包含相同原生CLI宿主、保守Hermes终态和Windows替换重试实现；Linux运行时沿用原包，不自动部署SSH。Windows实测不能代替Linux正式Hermes/SSH准出。 [本轮构建、分层验证与限制](../../iterations/I08/alpha65-hermes-windows.md)。

本地候选alpha.56的完整维护控制面输入采用有界64MiB字节流读取，保留全部版本描述和原fingerprint；Daemon RPC帧仍1MiB。原ID查询在线端副本省去不消费的releases，持久remoteInput及身份/操作ID不改，维护命令仍发送完整目录。新控制器由原已核验包暂存，旧控制器可继续接收小查询；不部署或改写既有运行实例。[实际缺陷、完整CLI与恢复验证](../../iterations/I08/maintenance-input-capacity.md)。

本地候选alpha.56的可信旧daemon索引按原冻结EXE补齐46、51.recovery.2、52、53与本地54/55，原32份保持，现38项；解析/打包统一上限128，超过上限拒绝，逐文件SHA、原owner/profile/路径及未知版本拒绝规则保持。文件核验失败只发固定CHECKSUM诊断，沿原错误码返回，不回显大清单、不结算原unknown。协议2与持久格式不变；未部署远端。[实现与实际分层证据](../../iterations/I08/daemon-compatibility-refresh.md)。

M05-F02：hello随共享runtimeCapabilities广播新能力；opendesk-lifecycle模块随alpha.52离线资源进入包。非Windows进程核验保守unknown，不能以Linux daemon上线证明Windows OpenDesk退出。无新增daemon方法或帧版本，Windows客户端不自动部署或重启远端。 [合约与边界](../../iterations/I08/opendesk-lifecycle-relation-scope.md)。

M05-F02：共享MachineHost带Pi/Hermes配置适配，在目标机器解释原生目录与环境。新模块随alpha.50离线包收录；SSH协议不变、不自动升级远端，本机Linux原生MCP组件成功不替代独立SSH。 [最终实现、原始证据与范围](../../iterations/I08/hermes-mcp-config.md)。

M05-F02：WSL bootstrap设置AGENTBRIDGE_HOST_READY，Core安装stdin读取器后返回就绪帧。此帧属于Windows→WSL stdio启动，不是daemon SSH帧协议变更；共享离线资源同时收录bootstrap，旧SSH不自动升级。 [完整需求、实现、原始证据与限制](../../iterations/I08/wsl-host-readiness.md)。

M05-F02：共享MCP配置模块新增DSH Desktop原生选择解析与绑定清理；随离线资源交付，不新增daemon方法或自动部署。当前真实验收在Windows隔离目录，不能充作独立SSH证据。 [实现与分层验收](../../iterations/I08/dsh-desktop-mcp.md)。

OpenDesk已有接口连接与worker随Linux离线包收录。目标后台启动正常安装的CLI serve，经随机Basic认证连接现有HTTP接口；去重和恢复记录保存在Bridge，恢复不启动原生替代服务。旧daemon须单独升级，不要求安装定制OpenDesk。 [实现与证据边界](../../iterations/I08/opendesk-existing-interfaces.md)。

M05-F02：OpenCode 显式接入遇原服务已退出时，仅启动原 context 内的原生服务，再核验原 Agent；本次新增恢复不放在快照或原请求读取分支。接入准备失败原子记录本地 attach 拒绝收据，原图意图只按匹配证据收敛；不改变原任务、Session 或 unknown 门禁。恢复不改协议或原生模型配置。详见[恢复契约与边界](../../iterations/I08/opencode-oom-recovery.md)。

## alpha.38 显式确认后越过未确认收据

M05-F04/F09：用户已批准的契约变更。[remote-maintenance.cjs](../../../desktop/electron/remote-maintenance.cjs) 的 `idle(p,options)` 固定门禁顺序：**任务/Agent 门禁永远先执行且永不可越过**；收据门禁仅在 `options.allowUnresolvedReceipts===true` 时跳过，并收集被跳过的 `{key,op,state,updatedAt}`，`run()` 终态 `data` 记 `overridden:true` 与 `unresolved:[...]`，门禁错误保留远端原话并落盘 `error.details={gate,tasks,agents,receipts}`。越过路径下若 `daemon.quiesce` 因**同一份收据台账**抛 `DAEMON_BUSY`，允许以本地 `maintenance.json` 占位 + 控制器 `runtime/owned-stop`（`pid`+`pidStart` 内核校验）停机；新 daemon 启动后接管占位并在 release 阶段解除。**非越过路径行为不变**（只有 `DESKTOP_METHOD` 回退）。风险必须写清：越过会跳过 daemon 自己的 `admissions||jobs.size`（在途 job）检查，此时只由 worker 的 snapshot 门禁保护，**任务是唯一的硬线**。[契约、现场与未测边界](../../iterations/I08/alpha38-delivery.md)。

## alpha.36整合边界

M05-F02：alpha.36整合基线含公开alpha.35执行资源级保护/原查询反馈与所有工作区增量；OpenCode宿主和原管理拒绝恢复并存，原身份/Session/unknown不迁移。精确收录alpha.34/35 daemon清单，客户端升级不自动替换远端。[完整交付](../../iterations/I07/alpha36-delivery.md)。

## OpenCode 宿主生命周期

M05-F02：生产 daemon 直接以 DesktopHost 作为 OpenCode 后台门面，提供 call/close；关闭门面不停止独立 Controller 或原生任务。源码与本地 config.2 已包含，公开 alpha.35 的冻结源码未包含；[实现与验证](../../iterations/I07/opencode-host-lifecycle.md)。

## DSH Desktop / Web 当前行为

M05-F01/F02：Linux/WSL/SSH MachineHost可配置dsh-web连接本机运行的Web服务，使用同样受认证HTTP生命周期；不从Windows迁移凭据或把Windows端口解释为远端端口。daemon新增dsh.status/configure白名单，维护期间拒绝配置写入；旧daemon必须另行升级。 [完整契约与证据](../../iterations/I07/dsh-desktop-web.md)。公开alpha.34不包含该能力；本地.dsh.3候选已构建并验证真实连接，Desktop模型两轮均RATE_LIMIT，独立SSH未验，见[本地交付](../../iterations/I07/dsh-exe-delivery.md)。

中央hello公布`opencode-dual-api-v1`与`team-context-mcp-v1`语义能力；新前台遇到仍在运行的alpha.33后台时要求显式停止并重开，设置/停止入口保留。避免新EXE复用旧2.x独占后台后仍拒绝1.x或缺MCP/材料方法；原任务、收据和unknown不改。

## OpenCode 1.x / 2.x 兼容修复

M05-F02/F04：源码内的 MachineHost/Core 共用新的 V1/V2 适配与 MCP 格式，主协议和认证不变。该验证在 WSL 直接执行，不冒充独立 SSH；旧已安装 daemon 需获取含本修复的新包后在原机器维护升级。 [需求、实现、验证与未测边界](../../iterations/I07/opencode-v1-compatibility.md)。

## 当前维护进度与持久化边界

M05-F04/F06：该实现不改变daemon原请求或维护协议；完整上传/解包/逐文件校验后仍待中央最终保存，再发送原维护输入，安全失败保留旧版本/身份。 [完整设计、实测与边界](../../iterations/I07/maintenance-persistence.md)。

## 维护收据字段与旧后台空闲兼容

M05-F04/F09：维护收据 `maintenance-operations.json` 的 `data` 增加可选 `stopped` 与 `phase`，成功路径同样写 `rolledBack`（此前只在失败分支写）。`stopped=true` 表示本次确实停过后台；`rolledBack=true` 只在已切换过版本且回滚三步全部成功（原版本已重启）时成立；`phase` 记录最后阶段（validated/stopped/activated/healthy/uninstalling/uninstalled）。升级/回滚若已停止后台但切换或回滚未确认，收据保持 `state='unknown'` + `DAEMON_ROLLBACK_UNCONFIRMED`，由原 operationId 查询/[recover](../../../desktop/electron/remote-maintenance.cjs)恢复，不写终态 rejected；`recover()` 的收据同样补 `stopped/rolledBack`。

`idle()` 对早于持久收据端点的旧后台（`daemon.receiptRead` 返回 `DESKTOP_METHOD`，即该版本没有台账可查）降级为“无可查台账”，保留前面的 `snapshot` 空闲门禁继续维护；其它读失败仍阻断维护，不把任意错误当成无台账。旧后台不支持 `daemon.quiesce/shutdown` 时停机继续走本地 `maintenance.json` + 控制器 `runtime/owned-stop`。协议版本（仍为 2）、daemon 身份、任务/收据 ID 与线格式不变，没有格式迁移。[本轮需求、证据与未测边界](../../iterations/I08/maintenance-offline/maintenance-offline.md)。

## 遗留维护屏障自愈

M05-F04：独立验证的证伪用例发现，修复前构建可能留下“收据已终态、远端 `maintenance.json` 仍属原 operationId”的状态；此后任何新 operationId 的 `quiesce` 都会被 daemon 以 `DAEMON_MAINTENANCE` 拒绝，新维护与它自己的 `recover()` 都会停在 `unknown`。[remote-maintenance.cjs](../../../desktop/electron/remote-maintenance.cjs) 的 `stop()` 在 `idle()` 之后、`quiesce` 之前调用 `clearStaleBarrier()`：仅当屏障属于另一个 operationId 且 `maintenance-operations.json` 中该 operationId 的收据已是 `confirmed`/`rejected` 终态时，才尝试 `daemon.releaseMaintenance`；只有 release 成功或返回 `DESKTOP_METHOD`（该版本无此方法）才删除文件，`DAEMON_MAINTENANCE`/`DAEMON_OFFLINE`/`ENOENT` 一律不删（不删除未经证明的屏障），其它错误照旧抛出。unknown 或缺失的收据、以及属于本次 operationId 的屏障都不处理，因此不会绕过真正的未决维护。受控夹具见 [daemon-maintenance.test.cjs](../../../desktop/tests/daemon-maintenance.test.cjs) 12/12。

## 未决维护行的原 ID 回收

M05-F04：原 operationId 查询是未知维护唯一的收敛路径，过去只在“已记录 `workerPid` 且该进程已消失”时才派生恢复进程。[remote-maintenance.cjs](../../../desktop/electron/remote-maintenance.cjs) 的 `abandoned(row)` 补上“从未记录 worker”的情形：`workerPid` 缺失时，`phase!=='intent'`（worker 至少写过一个检查点）或行创建超过 60 秒才视为废弃；宽限期避免与 `launch()` 的“先提交持久行、再记录并派生 worker”两步竞争。判定与派生仍在同一把 `mutateRows` 文件锁内，且只有输入文件存在时才派生。恢复本身的证明边界不变：`phase==='intent'` → `rejected`+`DAEMON_NOT_STARTED`（原后台未被触碰）；已激活/已停止阶段按原收据切回并重启；活跃 worker 持有租约时 `recover()` 直接返回。[切片说明与实测](../../iterations/I08/maintenance-offline/maintenance-visibility.md)。

## 当前版本准入与管理作用域

M05-F02/F04：Linux包包含MachineHost/Core的原OpenCode版本复验与快速API/认证拒绝，hello声明新增能力。旧daemon需在原机器空闲时显式升级；原对象/收据身份和协议2不变。 [完整规则与证据](../../iterations/I07/version-management-recovery.md)。

读取归属已失配的旧会话只允许查看，即使宿主保有原生Session也不宣告可继续；不改其Agent、ID或Session，正常绑定和真正legacy能力保留。

## 当前历史详情读取与错误作用域

M05-F04/F06：生产MachineHost的task/conversation按实际backend快照路由；根legacy只有自身含原对象才接收详情读，多来源冲突或ID不符拒绝，未知来源明确未找到，真实探测/配置失败保留。协议2、原请求去重及控制语义不变。 [设计、兼容与实际证据](../../iterations/I07/history-detail-recovery.md)。

## 独立 MCP 配置与运行契约

M05-F04：认证主连接新增四个mcp.*方法，沿原MachineHost处理目标Linux用户的配置。install/export/remove参与维护admissions计数，quiesce后拒绝配置写入，status仍只读。旧包无此方法，客户端不得当作已安装；需要升级原远端后台。独立stdio服务只连同机回环broker，再经原主连接回中央验关系。[配置/数据/失败流程与源码](../../iterations/I07/mcp-installation.md)。

daemon 的 MachineHost 静态注册包含 Hermes/Pi/DSH，仍在目标用户环境执行；任务属于同机宿主与持久 worker，relay 断开或观察器 close 不取消原任务。协议版本和认证不变；旧已安装 daemon 不因客户端更新自动获得新适配器，需要发布含新增模块的后台再在原机器升级。[扩展范围与证据](../../iterations/I07/native-agent-expansion.md)。

## SSH持久拒绝恢复

M05-F05/F06：daemon业务/协议不变，既有daemon.receiptRead返回原持久method/op/key/target/fingerprint/state/error。新客户端读取匹配rejected/NOT_CONFIGURED作为恢复证据；confirmed仍返回原任务，unknown缺证明仍保守。无需为本修复升级支持该endpoint的可信旧daemon。 [完整需求、状态与验证](../../iterations/I06/daemon-rejection-recovery.md)。

## 小队工具兼容边界

小队工具及teamContinuation身份续接能力随alpha.23离线资源更新；任务业务由中央负责，daemon帧协议和身份未改变。共享MachineHost提供teamCollaboration能力标志和小队scope回调。旧后台仍可用于旧模式；新小队原生需求要求能力标志，不支持时明确在派发前拒绝，不自动换节点。现有SSH帧协议2、daemon认证/原请求收据不变。新的源码与离线资源包含小队工具；中央自动主协调在WSL真实Claude已实测；用户独立SSH自动小队链尚未实测，不能用本机Linux实测替代。[实际交付](../../iterations/I07/delivery.md)。

新安装 daemon 版本由当前发布包决定；可信清单内已收录的旧版本可继续复用（当前覆盖 alpha.2–alpha.33，见 [M04 可信清单](../04-ssh-access/design.md)），实际运行版本由握手确认、远端协议 `2`。独立进程、私有 socket、收据去重、relay 分离已实现；已有独立服务器断线期间任务继续记录。事件过期补偿已实现；完整故障矩阵尚未完成，详见 [测试报告](test-report.md)。

## 1. 用途与功能

M05-F02/F04/F05/F08：owned-object-controls-v1随daemon hello公布；对象读控回原MachineHost，独立mcp.*仍经认证原主连接与机器归属，旧daemon不能按同协议号冒充新方法。客户端scoped-management/opencode-v2能力不变成所有旧SSH方法的额外通用门槛。Windows与Linux包同源，未实际部署独立服务器。 [实现与实际证据](../../iterations/I07/integrated-source.md)。

Linux daemon 是目标 Linux 上由 AgentBridge 安装的机器管理进程。它发现本用户可用的原生 Agent、建立执行上下文、接收需求并保存操作收据。SSH 会话内的 relay 只负责数据转发，远端已接收任务的生命周期由 daemon/原生 worker 负责，SSH 断开不等于取消任务。

| 功能 ID | 可验收行为 | 当前状态 |
| --- | --- | --- |
| M05-F01 | 每用户、每 Bridge profile 一个后台；重连复用原身份和进程 | 源码已实现；本模块有真实 detached 集成覆盖，独立服务器已复用 |
| M05-F02 | 只有正确中央/profile/daemon/协议握手后才能访问业务 | 源码已实现；受控测试通过；SSH 层还另行验证主机与用户 |
| M05-F03 | 中文/emoji 消息完整，畸形/过大/拥塞请求明确拒绝 | 源码已实现；分帧、UTF-8、限制与背压测试通过 |
| M05-F04 | 发现 Agent、独立上下文、执行需求、读取任务/会话 | 源码已实现；生产 host 集成与真实远端 OpenCode 新会话通过 |
| M05-F05 | 同 ID 重试不重复原生执行，参数变化拒绝；未知结果只查询原记录 | 源码已实现；10 次并发 = 1 次受控原生调用；重启/取消恢复测试通过 |
| M05-F06 | relay/SSH 消失任务保留，重连读取原结果和续聊 | 源码已实现；受控及真实服务器记录通过；真实两轮 native Session ID 比较通过，完整恢复矩阵仍有限（部分验证） |
| M05-F07 | 状态事件有持久递增游标，可回读；新通道替代旧通道 | 源码已实现；代次/事件受控通过；生产 SSH/daemon 隔离补偿已验证，独立服务器专项待验（部分验证） |
| M05-F08 | 原生 Agent 协作工具经当前通道回调中央 | 源码已实现；通道归属/旧回调 fencing 受控通过；双向核心链已有真实通过，最终包复验与完整故障边界见本模块报告 |
| M05-F09 | 安全升级、停机、卸载以及服务器重启后的自启动 | 源码已实现；升级/回滚/停止/卸载；服务器重启自启动不在当前支持范围 |

## 2. 对象与相邻模块

```mermaid
flowchart LR
  C[中央 Coordinator] <-->|SSH exec 四字节长度帧| R[relay 临时进程]
  R <-->|私有 Unix socket| D[daemon 常驻进程]
  D --> H[MachineHost]
  H --> O[OpenCode DesktopHost / Controller]
  H --> A[ClaudeHost / CodexHost]
  D --> J[收据与事件]
  H --> W[原生会话与 worker 数据]
```

daemon 不开放 TCP 监听，也不接受用户密码、私钥或模型设置。认证与安装由 [M04](../04-ssh-access/design.md)负责，任务/会话语义由 [M07](../07-task-session/design.md)负责，工具原生能力由 [M06](../06-native-adapters/design.md)负责，主从允许关系由 [M08](../08-collaboration/design.md)负责。

`productionHost()` 加载根编译产物 `dist/desktop-host.js` 的 `DesktopHost` 和共享 CJS `MachineHost`。OpenCode 使用已有 Controller/driver；Claude 与 Codex 使用各自原生 host。无需另建远端模型 API 层，也不重写原生全局认证/供应商/默认模型。

发现通过共享 tool-discovery 选择本 Linux 用户 PATH 中首个已安装命令，以其 --version 为当前版本；探测失败报告当前入口异常。仅 PATH 无入口时才检查默认目录和常见版本管理器安装目录；不会执行交互 rc 脚本，不依赖 Windows 的安装或客户端 PATH。已验证可复用旧 daemon 继续使用其旧代码；新扫描功能须经原机器受控升级后生效。新增扫描不改变私有 socket/协议、用户/profile 归属或原任务收据。[alpha.19](../../iterations/I06/linux-cli-discovery.md)。

## 3. 身份、目录与单写者

| 字段 | 含义 |
| --- | --- |
| `daemonId` | 首次写入的持久 UUID；`machineId` 在中央映射为 `ssh-<daemonId>` |
| `ownerCoordinatorId` | 归属哪份中央身份，不接受其他中央接管 |
| `profileId` | 中央身份和本地配置目录派生的隔离标识 |
| `uid,stateDirectory` | 原 Linux 用户和绝对状态目录，两者必须匹配 |
| `generation` | 每次业务 hello 持久递增的连接代次 |
| `sessionId,nonce` | 当前 SSH 观察通道身份和一次握手挑战 |
| `pid,pidStart,lockId` | 进程诊断/锁身份；PID 回收不能造成误杀或接管 |

安装与运行数据分开：

```text
~/.local/share/agentbridge/profiles/<profileId>/
  install.json                    # 本安装归属标记
  versions/<version>/             # 已校验后台、依赖、runtime/node
  current.json                    # 原子发布的版本入口
~/.local/state/agentbridge/profiles/<profileId>/
  machine.json                    # daemonId、owner、UID、generation
  daemon.lock                     # 当前进程身份锁
  daemon.pid                      # 诊断信息
  daemon.sock                     # 路径较短时使用
  daemon-receipts.json             # 收据，不随 relay 消失
  daemon-events.jsonl              # 事件游标日志
  logs/daemon.log
  node-contexts/                   # 每节点/目录上下文和原生记录
```

状态目录须当前用户拥有、最终目录权限 `0700`；身份/锁/收据文件和 socket 为 `0600`。Unix socket 在同步 bind 期间临时采用 `0177` umask，创建瞬间即为 `0600`，在让出事件循环前恢复调用者 umask；监听完成后仍显式核定权限。避免并发 inspect 观察到默认 `0755` 而拒绝归属。目录路径不能穿过符号链接；已有非 Bridge 文件、普通文件占用 socket、锁归属不符均保留现场并拒绝。

若 socket 路径超过 100 字节，使用 `/tmp/agentbridge-<uid>/<state-hash>/daemon.sock`，短目录仍验证当前用户与私有权限。深层 OpenCode controller socket 另有 `/tmp/agentbridge-<uid>/controllers/<hash>.sock` 回退，二者不是同一个端点。

锁以排他文件创建。检测已有 PID 时比较 `/proc/<pid>/stat` 的启动标识，而不是看到同号 PID 就清理。后台复用还要通过私有 socket 的 `inspect` 身份检查；有效服务不能覆盖或删除。

## 4. 启动、检查与 relay

```mermaid
sequenceDiagram
  participant S as SSH 安装/连接命令
  participant E as ensureDaemon
  participant D as daemon
  participant R as relay
  participant C as 中央
  S->>E: 版本入口 + 状态目录 + owner/profile
  E->>D: inspect 私有 socket
  alt 原后台有效
    D-->>E: 原 UUID/PID/版本
  else 原后台不存在
    E->>D: spawn detached，stdio 指向私有日志
    E->>D: 10 秒内等待并核对 inspect
  end
  E-->>S: 身份 JSON
  S->>R: exec relay（无 PTY）
  R->>D: inspect，然后连接私有 socket
  C->>D: hello 经 relay 透传
  D-->>C: nonce/session/新 generation/能力
  C->>D: 正常业务调用
  Note over R,D: relay EOF 只关闭 socket，不调用 host.close/controller.stop
```

`inspect` 只检查，不改变代次，也不挤掉当前 Coordinator。真正 `hello` 成功时，新通道成为唯一 active 通道，旧通道关闭并拒绝其未完成协作回调。新连接不能误用旧回调结果。

alpha.4 客户端可通过本地可信发布清单复用 alpha.2/alpha.3 daemon；握手核验实际选中的版本及原身份，不要求后台版本等于桌面版本。复用不更新旧 daemon 的原生适配代码，不启动替代进程或迁移状态。未知发布仍拒绝，详见 [M04](../04-ssh-access/design.md)。

`ensureDaemon` 分离进程、重定向日志并 `unref()`；它不是 systemd 服务。当前没有探测 `KillUserProcesses` 或启用 linger，不能保证所有服务器退出登录后都保留进程。断 SSH 保活已在当前服务器验证；其他服务器策略和系统重启须单列验收。重新 SSH 可按原身份启动后台，但不能承诺无人登录自动启动。

## 5. 协议与实际方法

远端帧：**4 字节大端正文长度 + UTF-8 JSON 对象**。接收器先验证长度再分配正文，完整帧后严格解码 UTF-8/JSON，支持任意字节边界和多个帧粘连。最大正文 1 MiB、排队输出最多 8 MiB、每通道最多 64 项业务在途请求；单次需求文本最多 64 KiB UTF-8。

```json
{"id":"wire-1","method":"hello","params":{"protocolVersion":2,"coordinatorId":"central-example","profileId":"profile-example","expectedDaemonId":"daemon-example","nonce":"nonce-example","sessionId":"transport-example"}}
```

| 方法 | 参数/行为 |
| --- | --- |
| `inspect` / `hello` | 绑定中央/profile/预期后台/协议；hello 还核对 nonce/session |
| `ping` | `{nonce}`，返回 nonce、generation、时间 |
| `daemon.status` | 返回身份/PID、最新事件游标和 activeSessionId |
| `daemon.eventRead` | `{afterCursor?,limit?}`；limit 1–200；返回 `items,nextCursor,hasMore`，过旧返回 `cursorGap,earliestCursor` |
| `daemon.receiptRead` | 按 requestId/operationId 查记录，或按游标分页；这是 daemon 自己的操作状态 |
| `snapshot,discover,environment` | 转给 MachineHost，只读观测/发现 |
| `context,scope,connect` | 按 MachineHost 契约建立上下文、协作 scope 或连接 Agent |
| `ipc` | `{op,...}`；submit/continue/verify/reply/cancel 经持久收据包裹，task/conversation/request/operation 等用于原记录读取 |

协作回调反向发送 `{bridgeTool:true,id,scope,name,args,callId,generation}`；中央以 `{bridgeReply:id,result}` 或 error 返回。回调最多 64 项，默认等待 60 秒，并绑定当前 active 通道。daemon 不自行判断中央主从授权，中央须按来源与 scope 验证。

## 6. 执行、收据与未知结果

```mermaid
flowchart TD
  I[收到稳定 requestId / operationId] --> P{原 ID 是否存在?}
  P -->|存在且摘要不同| E[拒绝 REQUEST_CONFLICT]
  P -->|存在| Q[返回原结果或查询原生原收据]
  P -->|不存在| A[持久 intent]
  A --> B[持久 dispatched + accepted 事件]
  B --> N[调用原生 host 一次]
  N -->|收到接收收据| C[持久 confirmed + confirmed 事件]
  N -->|确认业务拒绝| R[持久 rejected]
  N -->|通道/其他不确定失败| U[持久 unknown]
  U --> Q
  Q -->|原生收据仍缺失| U
  Q -->|原记录明确执行前拒绝| R
```

记录包含 ID、method/op、原 task/agent/conversation/execution 目标、规范化参数 SHA-256、状态和结果。JSON 写入先写临时文件、fsync、原子改名。已有内存 job 被相同 ID 调用时共享 Promise；进程重启后仍根据持久 `dispatched/unknown` 记录查询原生收据，不自动再次执行。

`confirmed` 只表示操作接收收据已核对，任务可能仍是 running；任务成功须读取原生终态。取消/权限回复用原 `operationId` 和原目标核对，不能用另一个任务的收据清除警告。原生返回 NOT_FOUND 也不证明操作没有发生，daemon 保留 unknown 并报 `DESKTOP_UNCONFIRMED`。

普通业务读取与上下文创建不全都经过 daemon 执行台账：当前持久去重包裹的是 `ipc` 的五种执行/控制操作。不要假设所有 RPC 都有等价 exactly-once 保证。

执行前 Hub 的 AGENT_UNHEALTHY 在创建任务前拒绝，daemon 保存为 rejected。相同 ID 和原 request 查询返回原拒绝，不重新执行。旧版本将该确切错误持久化为 unknown 时，只在原 request 查询中依据原记录的 AGENT_UNHEALTHY 和 submit/continue/verify 类型改为 rejected；不把缺少原生收据或当前 healthy=false 当作拒绝证据。网络/其他未知失败继续只查询并保留占位。该分类不代表已有任务失败或取消。

## 7. 事件、恢复和当前限制

daemon 每秒观测任务快照，任务状态/序号/摘要变化时写 `task.changed`；操作接收/确认/未知也写事件。事件文件保持严格递增 cursor，内存只保留最新 2,000 条，回读有分页和单帧大小预算。事件用于状态观察，不是全部原生回答 token 的流；具体执行输出仍来自原任务事件/快照。

目前磁盘事件日志没有轮转，启动时读取并解析整个文件；坏 JSON 或非递增游标会拒绝启动并保留现场。大历史和日志截断恢复未完成压力验收。

alpha.10 SSH 客户端已兼容 cursorGap/cursorExpired，以本模块 items/nextCursor/hasMore 分页读完保留事件；游标缺口先完整 snapshot 补偿。生产 daemon 与真实本机 TCP SSH 的隔离验证见 6C 首批，独立物理服务器完整故障恢复仍待后续。

alpha.11 已实现空闲安全升级、健康失败回滚和产品停止/卸载入口；忙或 unknown 明确拒绝，不隐式排队切换。用户态 systemd、服务器重启自启动仍不支持。跨 SSH 主从双向核心链已有 I06B 独立原生记录；控制故障矩阵继续待验，不由文本协作推定通过。

## 8. 代码与维护

实现：[machine-daemon.cjs](../../../desktop/electron/machine-daemon.cjs)、[machine-relay.cjs](../../../desktop/electron/machine-relay.cjs)、[machine-protocol.cjs](../../../desktop/electron/machine-protocol.cjs)；共享原生后台：[machine-host.cjs](../../../desktop/electron/machine-host.cjs)、[desktop-host.ts](../../../src/desktop-host.ts)；测试：[machine-daemon.test.cjs](../../../desktop/tests/machine-daemon.test.cjs)。

修改协议/身份/收据/事件时同步本设计、[测试报告](test-report.md)、M04/M07/M08 的对应契约和迭代记录。变更来源：[I06 SSH/daemon 初始方案](../../iterations/I06/ssh-design.md)、[开发项 A03–A06/C01–C03](../../iterations/I06/development.md)、[进度](../../iterations/I06/progress.md)。

## 收尾行为

daemon 握手版本读取其所在发布包的 package.json；源码开发时读取 desktop/package.json。不能在代码中写死旧版本，否则新包的 SSH 握手会拒绝。

实际 Linux 无可发现系统/用户 Node 的隔离 HOME 已验证：生产探测返回空 Node 路径，发布包私有 ELF Node 启动真实 daemon，第二次启动复用同一 PID 和 daemonId。这个验证没有 SSH 安装或模型调用，独立服务器正常安装另有 Windows 实测证据。

alpha.9 收录的 alpha.8 Linux manifest 与原 alpha.8 包报告 manifestDigest 逐字节规范 JSON 摘要核对后保存；允许可信旧 daemon 复用，不自动升级远端。当前候选资源和实际验证见 [节点管理交付](../../iterations/I06/node-management.md)，SSH/原生任务沿用原版本证据，未重跑独立服务器。

## 当前机器管理与观察恢复

daemon.eventRead 的 cursorGap/earliestCursor、items/nextCursor/hasMore 由当前 SSH 客户端完整处理：缺事件先补 snapshot，再读完保留页；客户端不猜 latestCursor，事件处理失败不提前推进。连接代次与原 daemon 身份不变，无 Prompt 补发。新候选仍可信复用旧协议 2 发布；alpha.11 维护流程见下节。 完整接口、事务、实际证据与未完成范围见 [6C 首批](../../iterations/I06/machine-management.md)。

## 当前维护与原操作恢复

daemon.quiesce 先建立内存准入门再读取任务与收据；非终态、忙节点、在途创建或未确认原控制均拒绝切换。维护租约持久化到 maintenance.json，daemon.shutdown 仅接受同一操作且无在途任务。独立维护 worker 校验 owner/profile/UID、版本及每文件摘要后切换 current.json，目标健康核对失败回到原版本。旧 daemon 不支持停机 RPC 时使用已经校验的 owned-stop：先取得 pidfd，再核对 UID 与原启动标识，只经内核句柄发送 SIGTERM，拒绝 PID-only 降级。未知 native 控制收据不能被包装为 confirmed；只确认原 operationId 与原目标的有效状态，取消接收与实际终态分开。

实现入口：[remote-maintenance.cjs](../../../desktop/electron/remote-maintenance.cjs)。需求、分层证据及未测范围见 [I06C 收尾](../../iterations/I06/final-delivery.md)。

## 当前源码：#27/#28 的观察与恢复边界

M05：本次不修改 daemon 业务协议或远端持久记录。客户端的[SshInstaller.release/probe](../../../desktop/electron/ssh-install.cjs)继续严格按公开可信manifest准入，未登记版本在握手/安装前拒绝；本次只修正中央/SSH客户端的观察生命周期与错误优先级。alpha.70预发布保留公开alpha.69的原可信manifest，不允许未知版本；新中央状态能力不要求升级已受信兼容daemon，也不触发上传、激活、停止或任务回放。

完整流程、受控反例与未测边界见[本轮记录](../../iterations/I08/issues27-28-current-state.md)。
