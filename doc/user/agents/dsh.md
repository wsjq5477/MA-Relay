# DSH

当前alpha.64的Bridge桌面提供配置、审计和原执行恢复；本页列出的执行/续聊等是后台适配能力。日常需求从原生Agent会话提出，或由获准主Agent委派。

DeepSeek Harness（DSH）有 CLI、Windows Desktop 和 Linux / WSL Web 三个执行入口。Desktop / Web 连接已有原生服务，CLI 使用独立的 headless 程序；它们分别发现和配置。

Desktop / Web 服务入口及本页Agent行配置流程已包含在公开预发布 `0.6.0-alpha.36`。切换程序前先在旧窗口“设置 → 后台运行 → 停止后台并退出”，再打开新程序并重新检测对应机器。

## 三个入口的区别

| 入口 | Bridge 如何调用 | 配置来源 | 适用场景 |
| --- | --- | --- | --- |
| DSH CLI | headless CLI 的 JSON 输出 | headless 的原生环境与配置 | 在命令行环境运行任务 |
| DSH Windows Desktop | 已启动桌面服务的认证 HTTP Session API | Windows Desktop 自身配置 | 连接 Windows 上已有桌面实例 |
| DSH Linux / WSL Web | 已启动 Web 服务的认证 HTTP Session API | Linux / WSL Web 自身配置 | 连接该机器已有的 Web 实例 |

CLI 不自动继承 Desktop / Web 的账号或 profile。不能把服务版已配置好模型推断为 headless CLI 也已经可用。Linux 的同名 Distributed Shell 命令不是 DeepSeek Harness。

发现安装但未配置服务时，节点显示“待配置服务连接”。在实际机器的DSH节点右侧点击“配置”，保存连接后重新扫描；真正的认证、网络或启动失败仍按错误显示。

## 保存后如何核对连接

公开预发布 `alpha.51.recovery.2`修复保存后的地址选择；此修复已包含在当前公开附件中。切换候选前，通过“设置 → 后台运行 → 停止后台并退出”停止旧后台，再打开候选。

保存服务地址后，“刷新连接状态”或关闭重开配置会保留刚保存的目标。提示“当前节点尚未加载”时，回到原机器重新扫描，再为该节点接入；旧地址、历史与原请求保留。Desktop 和 Web 分别选择，不互相代替。只有从未配置才显示默认3080；目标缺失、身份不匹配或损坏时按提示核对原连接，不能把空地址当作首次接入。保存不完整时先刷新核对，不自动重试；token不回填。

## 连接 Windows Desktop

1. 启动已安装的 DSH Desktop，确认原生界面能正常使用。
2. 在“接入配置”的 Windows 机器中找到 DSH Desktop，点击右侧“配置”。
3. 弹窗已固定该机器和 Desktop 入口，填写原生服务的**根地址**及连接 token 并保存。已有地址会自动显示，token 不回填。
4. 回到对应机器重新检测，选择 DSH Desktop 节点，再选择工作目录发起任务。

连接 token 用于认证 DSH 服务，不是模型 API Key。应只填在连接设置中，不放进需求或公共材料。

连接可用与模型能否回答分别判断。原生 DSH 返回 `RATE_LIMIT` 时，本轮为模型限流失败；请在 DSH 原生界面核对当前模型状态，Bridge 不会自动重发该请求或更换账号。

## 连接 Linux / WSL Web

1. 在目标 Linux 或 WSL 环境启动 DSH Web，确认服务与原生配置可用。
2. 在“接入配置”的该 Linux / WSL 机器中找到 DSH Web，点击右侧“配置”；弹窗固定该机器和 Web 入口。
3. 填写服务根地址与连接 token，保存、验证，再重新检测该机器。
4. 选择 DSH Web 节点发起会话。

localhost 指执行连接的目标机器。WSL 中运行的 Web 应配置到对应 WSL 机器；Windows Desktop 则配置到 Windows 机器。HTTP 只允许回环地址，其他地址使用 HTTPS；当前不支持反向代理子路径。

## 为什么采用原生 API

API 让 Bridge 直接操作正在运行的 Desktop / Web 会话服务，沿用该实例的原生模型、插件与配置。用户无需为了使用已有桌面或 Web 实例再配置一套 headless 环境。

服务提供明确的会话、轮次、输出和取消接口，Bridge 可以把任务与原生会话对应起来，读取状态并查询原请求。它也减少了对界面点击和终端文本解析的依赖。

代价是需要可达的认证服务，并受其版本与接口兼容性约束。原生 API 并不自动提供 Bridge MCP 能力，也不覆盖所有原生界面交互。

## 当前功能

| 功能 | 支持范围 |
| --- | --- |
| 新建会话与任务 | 使用 Bridge 创建并关联的原生会话 |
| 同会话续聊 | 继续原会话；不导入原生界面已有的任意聊天 |
| 输出与结果 | 按原生轮次读取输出及状态 |
| 取消与恢复查询 | 操作和查询原请求，结果未知时不重发 |
| 普通被委派 | 可作为获准目标接收其他 Agent 的任务 |
| 主动调用 Bridge MCP | 已声明具备 MCP 客户端能力；**DSH Web** 的原生 MCP 配置可由 Bridge 管理并在真实启动中被读取（`$DSH_HOME/profiles/web/cordis.patch.yml` 的一行补丁）；**DSH CLI** 也可管理，但要你指定启动时使用的 profile（`$DSH_HOME/profiles/<profile>/cordis.patch.yml`）；**DSH Desktop** 在alpha.48本地候选可管理原生当前数据目录/Profile的条目（当前公开版已包含）；选择变更后先移除原绑定，再添加当前目标。三者都使用已安装的 `@deepseek-ai/dsh-mcp-client` |
| 小队成员 / 托管会话注入 | 当前未接入；这不影响独立 MCP 调用 |
| 权限与原生提问 | 在 DSH 原生界面处理，Bridge 内暂不提供回复 |

## 原生 MCP 配置（DSH Web）

在 DSH Web 节点行点击“配置”的 MCP 接入区，可以添加、移除、撤销授权或重新探测原生列表。Bridge 只写自己那一行补丁，保留你在 `cordis.patch.yml` 里的注释和其他条目；如果该文件已存在但为空或只有注释，Bridge 会报错并保留原文件，不会覆盖成空数组。`$DSH_HOME/profiles/web` 目录还不存在时，Bridge 会提示“先启动一次 DSH Web”，不会替你创建 profile。

添加后 Bridge 只显示“需要原生重新加载”，由 DSH 自己应用配置补丁（开启热更新时即时生效）；Bridge 不会替你宣称已连接或工具已可用，请在 DSH 自己的 MCP 列表核对。你在 DSH 里删除这一行后，Bridge 只刷新识别，不会自动补回。

在一次隔离 profile 的真实启动里，DSH Web 主动读取了这条配置、完成 MCP 握手并列出了 Bridge 的 7 个工具，说明这条补丁行确实会被原生加载。但如果把启动命令写成不存在的路径，启动输出里不会报错（DSH 的连接错误不打印到终端），所以“配置写错会看到明显报错”并不成立，请以 DSH 界面为准。

## 原生 MCP 配置（DSH CLI，需要指定 profile）

DSH CLI 的配置文件跟着你启动 `dsh` 时选择的 profile 走，所以 Bridge 不猜默认值，需要你告诉它：

1. 在 DSH CLI 节点行的“配置”里填写“DSH 原生 profile”（与启动 dsh 时使用的名称一致），或使用命令行 `--profile`。
2. 点击“添加 Bridge MCP”，Bridge 只写这一个 profile 的补丁层：`$DSH_HOME/profiles/<profile>/cordis.patch.yml` 的一行条目。
3. 重新启动该 profile 的 dsh，在 DSH 自己的 MCP 列表里核对。

命令行示例（不开窗口，经运行中的后台执行，不启动模型）：

```text
agentbridge mcp install --node <DSH节点ID> --profile <启动 dsh 时使用的 profile>
agentbridge mcp status  --node <DSH节点ID> --profile <同上>
```

不指定 `--profile` 时，添加与移除会被拒绝（提示需要 profile），只能生成配置片段；profile 名称只能是小写字母、数字和连字符，Bridge 会校验并拒绝带路径分隔符或 `..` 的名称。删除时只清理你登记的那个 profile，其他 profile 的配置文件不会被改动。

注意：Bridge 只能校验名称是否安全，不能确认它就是你现在启动的那个 profile。写错名称不会报错，只会写到一个不会被加载的目录。我们已经在 DSH 自带的 `acp` profile 上真实启动核对过：Bridge 写入的条目会被加载，DSH 会主动连接并列出 7 个工具；但你自己的 profile 和交互式终端使用方式没有逐个核对，添加后仍请在 DSH 界面确认。

DSH Desktop 使用应用保留配置，Bridge 没有已核对的落点，只提供 `agentbridge mcp export --node 节点ID` 生成片段。

CLI 与服务入口的连接方式不同，不能用 CLI 的可用性代替 Desktop / Web 的连接结果。更多比较见[接入方式与功能总览](index.md)和[六种方式比较](../integration-methods.md)。

## 原生 MCP 配置（DSH Desktop）

alpha.48本地候选中，在Windows机器的DSH Desktop行点击“配置”，使用同一MCP接入区添加。Bridge读取DSH Desktop当前数据目录和Profile的原生选择记录；未切换过时使用原生默认desktop Profile。原生Profile必须已存在并包含Web功能，Bridge不会替你创建Profile或修改安装包。

添加后重新加载原生会话，在DSH中核对AgentBridge和7个工具。Bridge内显示已写入或需要重新加载，只说明配置状态，实际连接与工具调用仍需核验。

若在DSH Desktop更换数据目录或Profile，Bridge会显示原接入Profile与当前路径并阻止误写。先移除原接入，再添加当前目标；移除先撤权，只清理原目标。原目标目录被替换成链接或无法确认归属时，保持“已撤销授权，原生配置待清理”，不会沿链接删除其他配置。此过程不取消或重发已有任务。
