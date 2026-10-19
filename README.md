# AgentBridge

## Windows EXE 下载

当前预发布 **alpha.30 / 历史详情归属与错误隔离**，修复issue #6。保留alpha.29已发布UI/原生接入能力，CT-04未提交公共材料开发不在此包。

[直接下载Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.30/AgentBridge-0.6.0-alpha.30-Windows-x64.exe) · [SHA-256校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.30/SHA256SUMS.txt) · [预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.30)。先在“设置 → 后台运行 → 停止后台并退出”后打开新版；SSH机器还需空闲时“后台维护 → 升级后台 → 确认升级”至alpha.30，再重新读取原会话。仅新客户端先隔离详情错误，远端不会自动升级，忙/unknown仍受保护。

只读原记录，不重发Prompt或控制，不重绑ID/Agent/Session。实际工程、普通EXE与分发核验及未测边界见[完整交付](doc/iterations/I07/history-detail-recovery.md)。用户故障现场/生产服务器和真实模型未复测，完整I06C/I07C及正式0.6.0未准出。源码ZIP不包含EXE。

## Windows 桌面看板

以下保留 **0.5.0** 历史操作说明，新版入口和行为以[当前整体设计](doc/product-design.md)为准。首屏按“机器 → Agent 节点”显示实际安装的工具。Windows 与 WSL 分开显示，WSL 标明宿主；接入节点不绑定项目，也不选择模型或供应商。

关闭旧版窗口后，双击 `desktop/release/AgentBridge-0.5.0-Windows-x64.exe`。在机器卡片中按空格勾选节点，点击“接入所选 Agent”；在“协作关系”选择主 Agent 和允许连接的子 Agent，保存关系。之后进入“会话”发送需求。目录可选，留空创建独立会话目录。只读扫描不调用模型。

已真实验证 Windows Claude ↔ WSL OpenCode 和 Windows Claude ↔ WSL Codex 双向委派、子原生回复及主会话汇总。OpenCode 读取原生 CLI 最近模型偏好，本机实际沿用 DeepSeek-V4.1-Flash；不修改原生配置文件。旧任务、会话和验证历史保留，未确认请求只查询原收据。

Windows Codex 当前原生模型被账号拒绝；WSL Codex 原生续聊接口返回 `list_turns is not supported yet`，这两项不能算通过。独立 SSH Linux 接入和双向核心协作的当前证据见 I06B；以上 Codex 原生限制继续保留。

[桌面使用与构建说明](desktop/README.md)、[I05 提案](doc/iterations/I05/proposal.md)、[节点模块](doc/iterations/I05/node-design.md)、[协作模块](doc/iterations/I05/collaboration-design.md)、[验收报告](doc/iterations/I05/acceptance.md)。

当前开发候选 **0.6.0-alpha.16 / I06C** 已发布为 GitHub 预发布，包含机器管理、SSH 上传诊断及维护入口恢复。根测试 43/43、当前桌面测试 163/163、文档检查和 Windows 包一致性校验通过；完整 I06C 仍未准出，未通过和未测项见 [I06C 收尾](doc/iterations/I06/final-delivery.md)。历史功能与原生证据按各自版本记录，不能用 alpha.13 的 Windows 实机证据替代 alpha.15 包验收。旧后台仍运行时，打开新 EXE，在“设置 → 后台运行”选择“停止后台并退出”，再打开新 EXE 加载新版后台；不需要保留旧程序或删除机器、节点和历史。

完整项目材料统一在 [doc/README.md](doc/README.md)：[整体功能设计](doc/product-design.md)、[架构](doc/architecture.md)、[模块设计与测试报告](doc/module-plan.md)、[整体验证](doc/testing.md)、[迭代路线](doc/project-plan.md)。开发与维护按 [同步规则](doc/development-guide.md)同时更新整体设计、模块材料和当次迭代。

以下 CLI 文档是兼容保留的 OpenCode 项目执行入口；I05 的机器节点与协作关系使用 Windows 客户端配置。

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

npm test 包含离线服务合约、存储/访问/故障和真实 TTY 测试；真实模型验收另运行 acceptance:cli 和 acceptance:continuous。两者需要 Python 3（仅作 PTY 验收驱动，产品运行只需 Node），只操作 /tmp 中复制的人工计算器示例，测试首次向导、两个真实目录的随机回复、分析/修复/实际 npm test、允许/拒绝、原生文本表单、5 次重复、退出重返、故障保护和 20 次终端刷新。使用自己已配置可用的模型，不自动选替代提供方。

I03A 初始报告在 artifacts/I03A-acceptance.json；本轮真实回归在 artifacts/I03A-I03B-regression-acceptance.json 及对应 terminal.txt，原生禁止工具契约在 artifacts/I03A-native-contract.json。表单由真实原生 API 创建，只证明终端填答合约；模型自主提问单列未验证。逐项结果及剩余验证见 doc/iterations/I03A/report.md。

连续会话验收报告见 [I03B 报告](doc/iterations/I03B/report.md)：真实三轮、运行/权限等待取消、后台 SIGKILL 重返、确认死亡的服务重启、20 样本延迟；Hub 重启、丢 ACK、控制响应丢失等确定性故障另由受控服务测试覆盖。原生模型自主表单仍未核验。

## 旧前台与显式配置命令

原 init、doctor、up、hub start、connect 及 --config 路径保留给自动化和排障。up 仍是前台组合服务；日常使用以上后台菜单。已有 native --config 权限/表单命令改经 Hub/Edge 验证与台账，不再由呈现层读取原生密码，--edge-config 仅保留参数兼容。

```bash
agentbridge up --dir .agentbridge-real
agentbridge agents --config .agentbridge-real/client.json
agentbridge native TASK_ID --permission REQUEST_ID --decision once --config .agentbridge-real/client.json
```

## Mock 演示与 I01 回归

需要 Node.js 22.13+ 和 npm。本次验证版本为 Node 22.23.1 / npm 10.9.8。使用 Node 内置 node:sqlite；注册的 `agentbridge` 命令隐藏 Node 实验性 API 提示，直接 `node dist/cli.js` 或工程测试仍可看到它。JSON 结果仍只输出到 stdout。

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

run 返回 Task ID、Conversation ID、requestId 和提交状态。复制 Task ID 查询结果。也可用 npm run dev -- COMMAND 运行源码，或 npm link 后使用 agentbridge；无需全局安装也能验收。

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

该命令先运行领域/存储与写入故障检查，再运行同一跨进程验收。报告写入 artifacts/I01-acceptance.json，不包含凭据；其中 checks 记录跨进程验证的 29 条 AC，AC-F06-04 的存储故障/截断由 tests/core.test.ts 和 tests/hub-fault.test.ts 验证。逐项证据见 [I01 测试说明](doc/iterations/I01/testing.md)。

## 文档与源码

- [完整资料入口](doc/README.md)、[整体功能设计](doc/product-design.md)。
- [架构](doc/architecture.md)、[对象与数据](doc/data-model.md)、[接口协议](doc/protocol.md)。
- [10 个模块及原生子模块](doc/module-plan.md)：每个模块均有设计和测试报告。
- [整体验证与限制](doc/testing.md)、[迭代目录](doc/iterations/README.md)、[同步维护规则](doc/development-guide.md)。
- 源码：`src/` 为 CLI、Hub/Edge 和 OpenCode 核心；`desktop/electron/` 为中央、机器宿主与原生 worker；`desktop/src/` 为窗口。具体代码入口在模块设计中。

文档本地链接和材料完整性检查：`node scripts/check-docs.mjs`。原 `docs/` 仅保留迁移入口；原始 `doc.md` 与旧综合计划作为历史来源。

MIT License。Bridge 不直接推理、不保存模型 Key；真实执行使用 Claude Code 与 OpenCode 已有的模型与工具配置。

## 网页文档入口

在仓库根运行 `npm run docs:dev`，打开 `http://localhost:4188`。支持分组目录、全文搜索、章节导航、深浅主题与图表；内容直接读取 `doc/`。使用与构建见 [网页说明](doc/web-reading.md)。

## 当前 6A 候选验收结果

Windows 6A 候选程序位于 `desktop/release/AgentBridge-0.6.0-alpha.2-Windows-x64.exe`；主要 SSH/会话/后台生命周期已验收。[候选报告](doc/iterations/I06/acceptance.md)、[完整资料](doc/README.md)。节点图和整个 I06 最终准出尚待 6B/6C。

## I06C 当前候选

2026-10-14 / alpha.15：当前候选增加 SSH 维护入口通道拒绝恢复，Windows x64 包由当前源码重建并已核对摘要后上传至 GitHub。完整 I06C、独立服务器原生文件恢复和正式 0.6.0 未准出。实现/证据见 [I06C 收尾](doc/iterations/I06/final-delivery.md)，用户下载 [alpha.15 Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.16/AgentBridge-0.6.0-alpha.16-Windows-x64.exe)。

## alpha.18 Windows 修复预发布

[下载 Windows x64 EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/AgentBridge-0.6.0-alpha.18-Windows-x64.exe) · [SHA-256 校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/SHA256SUMS.txt) · [发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.18) · [源码 PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)。

修复 Windows OpenCode 提交时的共享运行缓存错误、严格核对旧未派发请求，并显示查询结果。先在旧窗口“设置 → 后台运行 → 停止后台并退出”，再打开新 EXE；节点和历史保留，旧命令不自动重发。无需为 AgentBridge 安装 Node.js 或 WSL。此为 prerelease，源码独立分支尚未合入 master，完整 I06C 仍未准出。

当前 alpha.19 已以 GitHub prerelease 分发：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.19/AgentBridge-0.6.0-alpha.19-Windows-x64.exe)、[校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.19/SHA256SUMS.txt)、[源码PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)。包含 Linux Codex 发现与 OpenCode 二次检查/Windows配置保存修复；源码标签绑定 `fce41be`，尚未合入master。远端需“后台维护→升级后台”后重扫。核心45/45、桌面181/181，包内Linux真实版本探测、Windows受控6组/普通EXE4组通过；未实测用户服务器/Windows原生推理，完整I06C未准出。
