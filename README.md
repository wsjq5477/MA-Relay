# AgentBridge

当前公开alpha.69：原生入口/目录、MCP配置与列表、SSH原密文及Core事件补传维护；源码/EXE/SHA公开，匿名完整下载匹配。Windows桌面1020通过/41平台跳过/失败0；Core首轮67通过/1失败/11平台跳过，I01单独复验1通过/0失败，原失败保留。文档2243缺失、依赖1项high保留；未签名，真实profile、父模型/取消/性能与完整I06C/I07C/MCP02未准出。[发布与完整边界](doc/iterations/I08/alpha69-release.md)。

AgentBridge 把用户已安装的 Agent 工具（Claude Code、OpenCode、Codex、Hermes、Pi、DSH、OpenDesk 等）呈现为可观察的节点：从原生Agent发起协作，在客户端配置连接、看进度、读结果，并让主 Agent 通过受限接口发现和委派获准的其他 Agent。模型、账号与原生配置由各工具自己管理，Bridge 不添加模型 API 层。

## 当前状态与下载

| 项目 | 状态 |
| --- | --- |
| 稳定历史版本 | 0.5.0 |
| 当前公开预发布 | **0.6.0-alpha.69**，冻结 `04ee6fe`；EXE132300169字节，匿名完整下载一致；[发布记录](doc/iterations/I08/alpha69-release.md) |
| 本次内容与边界 | 原生入口/目录、MCP配置/列表与Core事件补传维护；[分层验证与边界](doc/iterations/I08/alpha69-release.md) |
| 当前发布包 | [Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.69/AgentBridge-0.6.0-alpha.69-Windows-x64.exe) · [SHA-256](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.69/SHA256SUMS.txt)；未签名；[发布记录](doc/iterations/I08/alpha68-release.md) |
| 上一公开预发布 | alpha.68，关系冲突恢复与原生会话保护；[历史发布](doc/iterations/I08/alpha68-release.md) |
| 当前公开源码范围 | 标签 `v0.6.0-alpha.69`（04ee6fe），master含后续发布说明 |
| 未准出 | 完整I06C/I07C/MCP02；Hermes网关取消/父模型自主MCP及完整生命周期、Pi/DSH未完成入口、真实多主、图100ms、冷启动/WSL与独立SSH |

[下载 Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.69/AgentBridge-0.6.0-alpha.69-Windows-x64.exe) · [SHA-256 校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.69/SHA256SUMS.txt) · [发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.69)。用户无需自行编译或安装 WSL/Node.js。

升级：先在旧窗口“设置 → 后台运行 → 停止后台并退出”，再打开新 EXE；SSH 原机器需在空闲时“后台维护 → 升级后台 → 确认升级”后重新扫描。原机器、节点、请求和历史保留；旧 unknown 只查原 ID，不重发。

历史版本下载与标签/EXE/SHA 对照见 [GitHub Releases](https://github.com/wsjq5477/MA-Relay/releases) 和 [发布登记](doc/iterations/release-ledger.md)；逐轮交付记录见 [迭代目录](doc/iterations/README.md)。

## Windows 桌面

桌面程序按“机器 → Agent 节点”显示实际安装的工具（Windows 与 WSL 分开，SSH 接入 Linux）；接入节点不绑定项目，也不选择模型或供应商。会话中发送需求、看进度与结果；在协作关系中选择主 Agent 与获准子 Agent 后，主 Agent 通过 MCP 发现、委派并读取真实子结果。

使用与构建见 [桌面说明](desktop/README.md)，完整功能边界见 [整体功能设计](doc/product-design.md)。真实协作证据（Claude↔OpenCode/Codex 双向委派等）按迭代记录；Windows Codex 原生模型被账号拒绝、WSL Codex 原生续聊接口不支持为已知环境限制，Bridge 不替换模型。

以下 CLI 文档是兼容保留的 OpenCode 项目执行入口。

## 一个终端开始使用

在项目目录构建并注册命令：

```bash
npm run build
npm link
agentbridge
```

先在要使用的项目目录运行 `agentbridge`。首次启动自动扫描 PATH、`~/.opencode/bin` 等安装位置，显示发现的 OpenCode。**按空格勾选，再按回车，自动保存并连接。** 默认使用当前项目目录、OpenCode 已有模型配置、原生 build Agent 和后台管理，不再逐项询问名称、路径、连接方式、模型、启用或是否启动。Provider 认证沿用 OpenCode，不在 Bridge 填写或保存模型 Key。

连接时显示进度并自动做只读元数据检查，成功后显示“已连接”和实际模型；失败显示原因及修复方向。已有启用连接在进入菜单时自动连接，旧版“已保存却未启动”的配置也会连接，不需重新填写。扫描、连接和检查不会调用模型；需要核实模型能否实际回复时，主动选择“验证真实回复”。

菜单用 ↑↓ 选择、回车执行。只有一个连接时直接使用它；多个连接按名称和项目选择，无需手输 Agent ID。历史任务也通过列表选择。路径、项目、已有服务或模型覆盖等手动选项放在“高级设置”，也可显式运行：

```bash
agentbridge setup --advanced
```

高级模式的草稿保存为停用，普通进入不会启动它；启用或保存并连接才运行。模型覆盖格式为 PROVIDER/MODEL 或 PROVIDER/MODEL#VARIANT。执行任务时的文件修改授权仍保留一次允许/拒绝。

默认状态目录为 $XDG_STATE_HOME/agentbridge 或 ~/.local/state/agentbridge；AGENTBRIDGE_HOME 或每条命令的 --dir PATH 可指定隔离实例。Node 版本切换后，npm link 可能需要重新执行。非 TTY 无参数只输出帮助，不隐式创建配置或启动后台。

## 日常操作

运行 agentbridge 进入连接概览与菜单：发现并连接 Agent、高级设置/启停、选择新任务的默认目标、连接检查、真实验证、提交任务、最近任务/重返、持续状态观察。列表按名称显示“已连接、未连接、连接失败、已停用、正在工作、执行结果待核对”等状态。“提交任务”创建新会话；“连续会话 / 任务控制”按需求标题进入原会话，上一轮结束后选择“继续追问”，保留上下文。每轮有独立任务记录，只显示本轮回答。运行中可选择取消、继续观察或只读对账。同一 Hub 内，本机真实目录按资源串行；运行、等待和 unknown 都保留占位，换名称、ID、端口、模型或目录别名不能解除。

同一终端可看实际工具活动和回答。权限等待显示动作和资源，可选择仅允许本次、拒绝或暂不回复；文本表单逐字段填写，必填/选择项在发送前校验。回复收据 confirmed 只表示原生接口已接收，任务终态另行观察。unknown 回复只查询原操作，不能补发。敏感字段不回显，终端控制序列被过滤。

退出菜单、Ctrl+C 结束观察或关闭终端，后台继续运行。再次进入只查询现有任务。拒绝授权后，OpenCode 可能记录工具错误却暂不返回会话终态，此时继续显示实际 running；不会伪造失败或重跑。

也可使用自动化命令，默认实例无需写 --config：

```bash
agentbridge agents
agentbridge agents --watch
agentbridge run "只读分析这个项目，不修改文件" --watch
agentbridge run AGENT_ID "修复问题并执行测试" --watch
agentbridge task TASK_ID --watch
agentbridge conversations
agentbridge conversation CONVERSATION_ID
agentbridge continue CONVERSATION_ID "继续修改，并报告测试结果" --watch
agentbridge cancel TASK_ID
agentbridge reconcile TASK_ID
agentbridge tasks --json
agentbridge request REQUEST_ID
agentbridge operation TASK_ID OPERATION_ID
agentbridge service status
agentbridge service stop
```

run 支持 --stdin、--file FILE、--request-id ID；查询 --json 输出 JSON，--watch --json 输出 JSONL。消息最大 64 KiB UTF-8。CLI 在提交前保存 requestId，回复前保存 operationId；网络结果不明后查询原 ID，不自动再执行。停用阻止新任务，不杀当前任务；更改默认仅影响新提交。

取消是明确操作，与 Ctrl+C 退出观察分别处理。取消收据只表示请求已接收；原生确认本轮中断后显示“已取消”，已有修改不会自动撤销。取消响应未知时查询原操作，不能换 ID 补发。cancel 支持 --operation-id ID、--json；continue 支持 --request-id ID、--watch、--json。这些命令使用默认本机后台实例（可加 --dir），不使用旧 --config 入口。

Edge 断线会自动重连、登记并补传已落盘事件。后台异常退出后重新进入，核验并复用自己托管的原生进程；只有确认旧进程死亡才重启。对账只读取原 Session/Message，恢复观察或补回真实终态，不重新提交 Prompt。缺记录、配置改变或归属不明时显示原因并保留占位。配置改变后旧会话不能静默换模型续问，请新建会话。

停止后台会停止本实例 Hub/Edge 和核验归属的托管原生进程，未确认的任务保守记 unknown；外部服务不会被停止。I04 桌面看板复用同一实例与台账，CLI 命令继续可用。

## 导入旧 I02 配置

先退出旧前台 up。将 PATH 替换成旧 Bridge 配置目录，在原目录导入，保留 ID、凭据引用、SQLite 和历史：

```bash
agentbridge setup --dir PATH --import PATH
agentbridge --dir PATH
```

向导先预览并确认，不复制 SQLite，不覆盖原生 Provider 配置；旧数据仍被服务锁住时拒绝接管。导入后，管理以该目录的 settings.json 为准；旧 JSON 和未知字段保留作为来源记录，旧已确认结果不会改写。其他实例的 --dir 不会自动选中这个导入目录。

## 工程与真实验收

```bash
npm run lint
npm run typecheck
npm test
npm run acceptance:cli -- --model PROVIDER/MODEL
npm run acceptance:continuous -- --model PROVIDER/MODEL
```

npm test 包含离线服务合约、存储/访问/故障和真实 TTY 测试；真实模型验收另运行 acceptance:cli 和 acceptance:continuous。两者需要 Python 3（仅作 PTY 验收驱动，产品运行只需 Node），只操作 /tmp 中复制的人工计算器示例，测试首次向导、两个真实目录的随机回复、分析/修复/实际 npm test、允许/拒绝、原生文本表单、5 次重复、退出重返、故障保护和 20 次终端刷新。使用自己已配置可用的模型，不自动选替代提供方。逐项结果及剩余验证见 [I03A 报告](doc/iterations/I03A/report.md)与 [I03B 报告](doc/iterations/I03B/report.md)。

## 旧前台与显式配置命令

原 init、doctor、up、hub start、connect 及 --config 路径保留给自动化和排障。up 仍是前台组合服务；日常使用以上后台菜单。已有 native --config 权限/表单命令改经 Hub/Edge 验证与台账，不再由呈现层读取原生密码，--edge-config 仅保留参数兼容。

```bash
agentbridge up --dir .agentbridge-real
agentbridge agents --config .agentbridge-real/client.json
agentbridge native TASK_ID --permission REQUEST_ID --decision once --config .agentbridge-real/client.json
```

## Mock 演示与 I01 回归

需要 Node.js 22.13+ 和 npm。使用 Node 内置 node:sqlite；注册的 `agentbridge` 命令隐藏 Node 实验性 API 提示，直接 `node dist/cli.js` 或工程测试仍可看到它。JSON 结果仍只输出到 stdout。

```bash
npm ci
npm run build
node dist/cli.js init
```

初始化在 .agentbridge 创建示例配置和随机凭据，目录权限 0700，凭据文件权限 0600；已有目录不会覆盖。按下面三行分别启动三个终端：

```bash
node dist/cli.js hub start --config .agentbridge/hub.json
node dist/cli.js connect --config .agentbridge/edge-a.json
node dist/cli.js connect --config .agentbridge/edge-b.json
```

在第四个终端操作：

```bash
node dist/cli.js agents
node dist/cli.js run mock-a "你好，AgentBridge" --json
node dist/cli.js task TASK_ID --watch --json
node dist/cli.js tasks
```

run 返回 Task ID、Conversation ID、requestId 和提交状态。复制 Task ID 查询结果。也可使用 npm run dev -- COMMAND 运行源码，或 npm link 后使用 agentbridge；无需全局安装也能验收。

长消息与显式幂等请求：

```bash
printf '第一行\n第二行\n' | node dist/cli.js run mock-a --stdin --request-id sample-001 --json
node dist/cli.js run mock-b --file ./message.txt --json
node dist/cli.js tasks --watch --json --timeout-ms 5000
```

消息来源只选参数、stdin、文件之一。默认最大 64 KiB UTF-8 文本。网络响应不明确时，错误输出会保留 requestId；使用相同 ID、目标和内容重试会返回原任务。同 ID 改内容会冲突。

## 成功、失败和中断

修改 edge-a.json 或 edge-b.json 中对应 Agent 的 mode 为 success/failure，delayMs 设置延迟，healthy 设置健康状态，然后重启该 Edge。配置只能由可信操作者修改，用户消息只作为数据，不执行 Shell。

任务状态为 queued、accepted、running、succeeded、failed、cancelled、unknown。每个 Agent 串行，忙碌、离线、不健康目标拒绝新任务；两个 Agent 可以分别执行。退出观察不取消执行。

Hub/Edge 的 Ctrl+C、断线或强制退出使未确认结果的任务保守地进入 unknown。重新启动时使用原配置、原数据目录；历史终态保持原值，unknown 的 Agent 仍占位。当前会自动重连及只读核对有完整快照的原执行；原轮次证据确认完成/失败/中断后释放占位。证据不足继续 unknown，可用 reconcile 查看原因。不自动重跑或清空占位。

CLI 退出码：0 命令/查询成功，1 观察到任务失败，2 参数/配置/授权错误，3 unknown/本地观察超时，4 忙碌等业务拒绝，5 服务/网络/对象不可见，130 观察被 Ctrl+C 中断。查询 failed 任务仍返回 0。普通 --json 为单个 JSON，--watch --json 为 JSONL；诊断输出写 stderr。

仅支持显式 devInsecure=true 的本机回环明文开发模式，身份验证始终开启。不要将 I01 演示配置用于跨主机正式部署，不要共享 *.token 和数据库。列表只包含 AgentBridge 创建的任务。

## 检查与验收

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

npm test 会先构建，再运行单元、故障注入及真实跨进程验收。跨进程验收实际启动一个 Hub、两个 Edge 和独立 CLI，验证 20 成功/10 失败、10 次重复提交一次调用、历史保留和 Hub/Edge SIGKILL；临时数据与子进程结束后清理。

```bash
npm run acceptance
```

该命令先运行领域/存储与写入故障检查，再运行同一跨进程验收。报告写入 artifacts/I01-acceptance.json，不包含凭据；逐项证据见 [I01 测试说明](doc/iterations/I01/testing.md)。

## 文档与源码

- [完整资料入口](doc/README.md)、[整体功能设计](doc/product-design.md)。
- [架构](doc/architecture.md)、[对象与数据](doc/data-model.md)、[接口协议](doc/protocol.md)。
- [10 个模块及原生子模块](doc/module-plan.md)：每个模块均有设计和测试报告。
- [整体验证与限制](doc/testing.md)、[迭代目录](doc/iterations/README.md)、[同步维护规则](doc/development-guide.md)。
- 源码：`src/` 为 CLI、Hub/Edge 和 OpenCode 核心；`desktop/electron/` 为中央、机器宿主与原生 worker；`desktop/src/` 为窗口。具体代码入口在模块设计中。

文档本地链接和材料完整性检查：`node scripts/check-docs.mjs`。原 `docs/` 仅保留迁移入口；原始 `doc.md` 与旧综合计划作为历史来源。

MIT License。Bridge 不直接推理、不保存模型 Key；真实执行使用各原生 Agent 已有的模型与工具配置。

## 网页文档入口

在仓库根运行 `npm run docs:dev`，打开 `http://localhost:4188`。支持分组目录、全文搜索、章节导航、深浅主题与图表；只发布 `doc/user/` 的当前功能、系统设计与使用说明；原生Agent目录含DSH三入口，首页提供六方式总结，内部报告与过程材料不公开。构建静态站点用 `npm run docs:build`。使用与构建见 [网页说明](doc/web-reading.md)。
