# I04B 模块分析与设计

日期：2026-10-09。本轮将 I04 的“一个选中 WSL 下平铺 Agent”改为“多执行机器 → 工具连接 → 项目实例”。Windows Claude 与 WSL OpenCode 同时连接；已有后端执行与会话模型继续复用。

## 实体与归属

| 实体 | 持久身份与配置 | 动态状态 | 不承担的职责 |
| --- | --- | --- | --- |
| Machine | 稳定 machineId、显示名、kind（Windows/WSL）、发行版/执行入口、同物理宿主关联、该机器数据目录 | 宿主通道状态、最后同步时间、可读错误 | 不通过当前导航选中值决定任务实际来源 |
| AgentConnection | connectionId、machineId、工具类型、原生可执行文件、发现版本、启用配置 | 安装可用/通道可用/原生连接检查结果、能力描述 | 不绑定项目、不把模型调用当健康检查 |
| AgentInstance | instanceId、machineId、connectionId、名称、项目、角色/模型覆盖、启停、配置修订及资源键 | 在线/健康/忙碌、当前任务、实际模型 | 不是单次进程；原生 Session 不直接作为实例身份 |
| Conversation | 来源 machineId、instanceId、原 conversationId、执行配置指纹、轮次及原生 Session 关联 | 最新任务/摘要 | 不跨机器自动接续原生会话 |
| Task/Request | 来源 machineId、instanceId、原本地 ID、执行 ID、会话、输入、结果、操作收据 | 既有任务状态、待处理项、未确认标记 | ACK 不表示完成；操作收据不表示已取消 |

`desktop/electron/machine-router.cjs` 在桌面用户数据目录持久保存 `machines.json`，目录包含 `machines`、`connections`、`instances`。实际配置字段如下：

```ts
Machine = { machineId, name, kind, platform, distribution?, parentMachineId? }
ToolConnection = { connectionId, machineId, name, adapter, executable, connected }
Instance = { instanceId, backendId, machineId, connectionId, workspace, name }
```

`backendId` 是原始 agentId，公共 `instanceId` 是 `machineId::agentId`；目录可附加发现版本、启用状态等元数据。WSL 的 LinuxSettings.agent 仍是内部执行实例记录，保留 CLI 与 controller 的原实现。本轮不改写原 agent/task/conversation/native ID、本地数据库主键或配置指纹，只在桌面层保存归属及公共 ID。

工具发现状态与“可以完成真实推理”分开。只读安装/版本/通道检查通过后可展示连接，但不能据此显示账号额度或模型已验证。原生账号和供应商凭据仍留在各工具各自机器的配置中。

## 模块职责

| 模块 | 工作内容 | 主要约束 |
| --- | --- | --- |
| 桌面机器目录（machine-router.cjs） | machines.json 持久维护 Windows 本机、WSL 发行版及工具/实例归属；启动自动识别、幂等合并 | 无工具时也登记机器；机器名和数据目录不能代替机器身份 |
| Host 路由池（MachineRouter.hosts） | 每机器一个独立宿主；Windows 使用 ClaudeHost，WSL 使用 HostConnection 与指定发行版 bootstrap；每机器 snapshotJobs 去重、默认 10 秒截止及 5 秒失败冷却 | 不使用全局单 host；启动、超时和错误各自隔离；慢机器不阻塞健康机器数据；只发送结构化参数 |
| 机器内工具发现 | Windows PATH/已知安装目录找 Claude；WSL 使用已有 OpenCode 发现逻辑 | 不从 Windows 经 WSL 互操作误识别为另一机器安装；扫描不启动推理 |
| 实例配置与迁移 | 工具连接下创建项目实例；旧 OpenCode 配置导入并补归属 | 旧 agentId/原生 Session/历史数据库保持原值；原地迁移幂等且写入失败可恢复 |
| Windows Claude 宿主（claude-host.cjs） | ClaudeHost 保存实例/任务/会话/收据，独立 worker 管理原生 CLI，将 events/commands/heartbeat 落入任务目录，重开接回原事件记录 | 继承现有登录/配置；只管理本宿主启动的执行；不复制用户账号密钥 |
| 聚合与来源路由 | 合并机器快照；详情/续问/取消/回复/恢复按保存来源分发 | 失败机器保留最后同步缓存标记；另一机器正常结果不被失败覆盖 |
| 前端信息结构 | 机器入口、机器详情内工具连接及实例；任务/会话显示来源；新建实例先选连接再选项目 | 导航/筛选只是视图变化，不切断连接；输入只要求用户不能推导的内容 |
| 待确认操作日志 | 写入操作携带机器身份、原 ID、原参数和原数据目录 | 不明操作在原机器查询；当前机器改变不能补发到其他机器 |

```text
Windows Electron 主进程
├─ MachineRouter → machines.json（机器、连接与实例归属）
├─ ClaudeHost → 后台 worker → Windows Claude CLI → Windows 项目
│                    └─ runs/<原taskId>/{events,commands,heartbeat}
└─ HostConnection[Ubuntu] → desktop-host → controller/Hub/Edge
                                         → OpenCode → Linux 项目
           ↓ 分来源快照、请求与操作
   聚合总览 / 机器树 / 实例 / 会话 / 看板
```

## 来源键与路由

任一来源记录的全局键语义为 `(machineId, localId)`。桌面 agent/task/conversation 及关联字段使用 `machineId::rawId`，路由从第一个分隔符还原机器身份，余下原始 ID 原样传入宿主；生成的 machineId 不含分隔符。原始本地 ID 即使包含冒号也不能丢失。原生 Session/message、executionId 不改写，控制时另由来源机器和任务绑定校验。

新任务先解析实例归属，再固定目标机器和宿主；续问根据会话来源机器及实例配置指纹路由；详情与原操作查询同理。来源不存在/机器离线时返回该机器的明确错误，不尝试其他在线机器。快照中裸本地 ID 的关联字段必须一并加来源，否则主记录正确仍可能串到另一机器的会话或当前任务。

requestId/operationId 保留原值，在 pending.json 按 `(machineId, id)` 分别存储收据和原参数。写前先补确定来源；已有 I04 pending 日志迁移时补旧 desktop.json 的原 WSL 来源，不能补“当前选中机器”。查询确认严格匹配该来源机器。确认一个机器的操作只解除该操作的锁；另一机器可继续其已知安全操作。未确认同一来源的写操作仍受阻。

前端通过 `connectTool(machineId, executable)` 建立工具连接，再通过 `createInstance(machineId, connectionId, workspace, name)` 创建项目实例。创建实例由目标宿主校验项目；原内部 connect 接口仍可复用，但前端流程不再把工具连接与项目输入混成同一步。

模型默认从原生用户/项目配置继承，界面显示继承来源与执行确认的实际模型。`setInstanceModel` 按限定 agentId 路由，剥离机器前缀后传 `expectedRevision` 与模型值给来源宿主；`null` 表示清除覆盖、继续继承。Claude 使用实例执行参数中的模型字符串，OpenCode 使用该实例 provider/model 配置；不改各工具的全局配置，不复制/重配账号密钥。覆盖属于执行配置，沿用修订与会话指纹校验，不自动改已经运行的轮次或静默替换旧会话模型。

## 路径与占位

Windows 实例使用 Windows 原生目录选择结果，由 Windows 宿主校验绝对目录及可访问性，不映射成 `/mnt`。WSL 目录选择接受指定发行版 UNC 或 Windows 盘符映射，映射结果由目标 WSL 发行版校验；其他发行版 UNC 明确拒绝，不静默改发行版。

MachineRouter.workspaceKey 将同物理宿主的 `D:\project` 与 `/mnt/d/project` 映射为相同占位键，并处理指定 WSL UNC；启动锁防止并发提交竞态。占位同时检查重叠实例的 busy/currentTask、非终态任务及离线持久实例，不能只依赖看板 100 条任务窗口。原 request 先交回目标宿主核对幂等合同，已有任务不会被新执行占位检查错误拒绝。未知挂载、符号链接和网络共享限制必须如实列明；本轮不扩展同一项目并发写入。

## Claude 适配边界

使用原生 `claude -p` 的结构化输出，在原生 `system/init`/结果中获得 Session 与实际模型；续问传明确的原 Session，不能用“最近一个会话”作为绑定。默认不覆盖用户模型，不使用需要额外 API Key 的 bare 模式；显式登录失败由原生错误转为可读指引。

stream-json 是事件格式，不能单独证明可以交互批准。按本机 CLI 的帮助、协议和启动能力探测权限宿主/控制协议；有对应机制才展示允许/拒绝/原生表单。最小文本闭环不依赖自动扩大权限。权限拒绝与普通执行失败分开显示；没有可用授权宿主时提示当前版本/适配能力，不伪造等待卡片。

取消先记录操作并发出已实现的中断；只有控制确认与原生退出/取消事件满足状态规则才显示已取消。Windows 对进程的终止方式与 Linux 不同，不能把 kill 返回成功等同于原生轮次完成；不得按进程名终止用户自行运行的 Claude。

Claude 的后台 worker 独立于桌面观察宿主，关闭窗口只停止 ClaudeHost 观察，原执行继续写 events.jsonl；回复和取消写 commands.jsonl 交给原 worker。重开读取 heartbeat 和新增事件恢复，活动执行无法确认时保留 unknown；不调用 `--resume` 重新推理作为“核对”。WSL OpenCode 原有只读对账与独立控制器保持不变。后台保活和原生控制效果仍需对应真实验收证据。

## 迁移与兼容

1. 读取旧 I04 偏好中的 WSL 发行版、Bridge 目录及已有 OpenCode 配置；先建立该机器记录。
2. 按同机器、工具类型及规范化可执行文件合并工具连接；同一安装多个项目映射到一个连接下。
3. 每个旧 agentId 原样保留为 backendId，桌面实例 ID 使用机器限定形式，保存归属；不修改旧数据库主键、resourceKey、配置指纹或原生绑定来“适配名称”。必要新字段采用兼容读取。
4. 补旧待确认请求的原来源；已落库历史保持本地 ID，再在聚合层加来源键。
5. 写入新目录需要版本与原子保存；重复加载/迁移结果相同。迁移失败保留旧文件，展示可恢复错误，不能以空数据覆盖。

旧偏好中的发行版即使不在当前 WSL 列表，也登记原机器并标 unavailable；defaultMachine 优先匹配原偏好。因此旧 pending 仍绑定原来源，不能回退另一台在线发行版。

原 CLI 仍针对其所在机器原状态目录工作；聚合桌面增加来源层，不把历史复制到另一个机器，避免形成两份任务真相。

## 独立审查关注点

- Windows Claude 的普通 print 模式与权限交互能力必须区分；禁止为了“跑通”自动放宽原生权限。
- Windows 与 WSL 同磁盘路径可能共享文件，Machine 身份隔离不能当作文件隔离。
- 全部引用字段、待确认记录、操作收据都需要来源命名空间，不能只给卡片加 machineId。
- 迁移只补归属，不变更现有执行配置指纹导致历史会话不可续问。
- 关闭窗口、切换视图、宿主故障是不同生命周期事件；必须分别说明哪些任务继续、哪些结果未知。

参考：[Multica 机器与 Runtime](https://multica.ai/docs/daemon-runtimes)、[Claude 程序化调用](https://code.claude.com/docs/en/headless)、[Claude CLI 参考](https://code.claude.com/docs/en/cli-reference)。源码支持与本机能力以测试记录为准。
