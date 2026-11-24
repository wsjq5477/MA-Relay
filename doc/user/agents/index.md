# 原生 Agent 适配

Bridge 当前适配 8 种产品的 13 个专用入口，也可以[连接其他 ACP Agent](#连接其他-acp-agent)。OpenDesk 提供 CLI 和 Windows 桌面入口。DSH 提供 DSH NEXT、ACP、CLI、Windows Desktop 和 Linux / WSL Web 入口。各入口沿用各自的原生配置。

## 接入方式总览

✓ 表示 Bridge 已适配该方式，— 表示尚未适配。OpenDesk CLI 只能导出 MCP 配置片段，主动调用能力尚未确认。MCP 列表示 Agent 主动调用 Bridge。DSH NEXT 的插件显示已获准的连接与状态，任务使用原生 CLI 执行。

<!--@include: ../_generated/connection-table.md-->

OpenCode 的 CLI 用于启动服务，HTTP API 用于执行任务。DSH Desktop / Web 直接连接已运行的原生服务，不经 headless CLI。

ChatGPT Web 使用浏览器扩展。将[扩展附件](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.72)解压到固定目录，在 Chrome 或 Edge 的扩展管理页启用开发者模式并加载。打开 AgentBridge 的「设置 → 浏览器接入」为该扩展生成配对包，再到扩展设置页连接并授予 ChatGPT 网页访问权限。已绑定会话可续聊，网页提交后的停止在网页处理。

## 启动与会话控制

下表列出 Bridge 实际调用的关键参数或服务入口。Bridge 会按原生入口补充工作目录、认证、会话和权限参数。✓ 表示 Bridge 支持，— 表示 Bridge 暂无此操作入口。

### 原生 CLI（6）

| Agent | Bridge 使用的命令或入口 | 同会话续聊 | 回合中插话 | 回退检查点 | Bridge 主动压缩 |
| --- | --- | --- | --- | --- | --- |
| Claude Code | `claude --print --input-format stream-json --output-format stream-json` | ✓ `--resume` | — | — | — |
| Codex | `codex exec --json` | ✓ `codex exec resume` | — | — | — |
| Hermes | `hermes chat --query-file - --format stream-json` | ✓ `--resume` | — | — | — |
| Pi | `pi --mode json --print --session-dir <目录>` | ✓ `--session` | — | — | — |
| DSH CLI | `dsh --profile headless --json -` | ✓ `--session-id` | — | — | — |
| DSH NEXT | Windows 安装包内 CLI，带 `--profile headless --json -` | ✓ `--session-id` | — | — | — |

### 原生 HTTP / WebSocket（5）

| Agent | Bridge 使用的命令或入口 | 同会话续聊 | 回合中插话 | 回退检查点 | Bridge 主动压缩 |
| --- | --- | --- | --- | --- | --- |
| OpenCode | `opencode serve` 启动服务，HTTP 执行任务 | ✓ 原 Session | — | — | — |
| OpenDesk CLI | `opendesk serve --mode opencode` 启动服务，HTTP 执行任务 | ✓ 原 Session | — | — | — |
| DSH Desktop | 连接已启动的 Windows 桌面服务，使用认证 HTTP Session API | ✓ 原 Session | — | — | — |
| DSH Web | 连接已启动的 `dsh --profile web` 服务，使用认证 HTTP Session API | ✓ 原 Session | — | — | — |
| OpenDesk Desktop | 连接已启动桌面实例的 WebSocket 设备网关 | ✓ 原网关连接与会话 | — | — | — |

### ACP

| Agent | Bridge 使用的命令或入口 | 同会话续聊 | 回合中插话 | 回退检查点 | Bridge 主动压缩 |
| --- | --- | --- | --- | --- | --- |
| DSH ACP | Windows DSH NEXT 包内 CLI，带 `--profile acp` | ✓ 同一原生 Session | — | — | — |
| 自定义 ACP | 用户配置的 ACP v1 stdio 命令 | 视握手 | — | — | — |

### 浏览器扩展（1）

| Agent | Bridge 使用的命令或入口 | 同会话续聊 | 回合中插话 | 回退检查点 | Bridge 主动压缩 |
| --- | --- | --- | --- | --- | --- |
| ChatGPT Web | Chrome / Edge 扩展与 Bridge 配对，操作获准的网页会话 | ✓ 原可验证可见对话 | — | — | — |

**同会话续聊**在上一轮结束后沿用原会话与目标。**回合中插话**指任务仍运行时发送一条新需求。等待权限或表单时的原生答复见下方功能对照。

**回退检查点**指由 Bridge 将会话或工作区恢复到指定检查点。**Bridge 主动压缩**指由 Bridge 触发上下文压缩。原生工具自己的历史与上下文管理仍由该工具负责。

Claude Code 和 Codex 的专用入口使用原生 CLI，也可另装 ACP 适配器。MCP 用于 Agent 主动调用 Bridge。

## 功能对照

<!--@include: ../_generated/capability-table.md-->

“被委派”指接收普通子任务。“调用 Bridge MCP”指主动发现目标、委派和查询。表中“仅开发版”表示功能已进入源码。当前公开便携版 `0.6.0-alpha.76.local.20261123.acp` 收到 ACP 工具权限询问时会取消该询问。Claude Code 的结构化提问尚不支持 Bridge 内表单回复。

## 连接其他 ACP Agent

1. 在目标机器安装 Agent 或其 ACP 适配器，按原生工具的说明完成登录与模型配置。WSL 和 SSH 目标需要运行含自定义 ACP 的新版 Bridge 后台。
2. 在 Bridge 打开「接入配置 → 添加 Agent → 自定义运行时」，选择 **ACP**，填写显示名称和下表中的命令。Windows 支持标准 npm 启动器声明的可执行文件或 JS 入口。其他包装脚本可换成原生可执行文件，或用 `node "D:/路径/入口.js" 参数`。
3. 创建运行时时 Bridge 会探测 ACP v1 stdio 握手。探测通过后，在同一机器的候选列表添加并接入该 Agent，为主 Agent 授权。回到主 Agent 的原生会话，指定由这个目标处理任务。[首条委派示例](../quickstart.md#发出第一条只读任务)

| Agent | ACP 启动命令 | 发布方说明 | Bridge 验证 |
| --- | --- | --- | --- |
| DSH / DeepSeek Harness | `dsh --profile acp` | [DSH ACP](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/acp-app/README.md) · Windows DSH NEXT 也有独立入口 | Windows 新建、续聊和真实任务 |
| OpenCode | `opencode acp` | [OpenCode ACP](https://opencode.ai/docs/cli/acp/) | Windows 注册、新建、续聊 |
| Hermes Agent | `hermes acp`，或发行版提供的 `hermes-acp` | [Hermes ACP](https://hermes-agent.nousresearch.com/docs/user-guide/features/acp) · 新版本会话由原生 Gateway 持有，运行前需配置默认模型 | Windows 0.22.5 实测任务、同 Session 续聊、原请求查询、取消 |
| Grok Build | `grok agent stdio` | [xAI Agent Mode](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/15-agent-mode.md) | 待实机验证 |
| Qwen Code | `qwen --acp` | [Qwen Code](https://github.com/QwenLM/qwen-code) | 待实机验证 |
| Devin | `devin acp` | [ACP Registry](https://agentclientprotocol.com/get-started/registry) | 待实机验证 |
| fx | `fx acp` | [fx ACP](https://fx.sh/docs/using-fx/acp) | 待实机验证 |
| Gemini CLI | `gemini --acp` | [Gemini ACP mode](https://geminicli.com/docs/cli/acp-mode/) | 待实机验证 |
| Cline | `cline --acp` | [Cline ACP](https://github.com/cline/cline/blob/main/docs/usage/acp.mdx) | 待实机验证 |
| Kiro CLI | `kiro-cli acp` | [Kiro ACP](https://kiro.dev/docs/cli/acp/) | 待实机验证 |
| Auggie | `auggie --acp` | [Auggie 发行说明](https://www.augmentcode.com/changelog/auggie-cli-0-7-0-release-notes) | 待实机验证 |
| OpenClaw | `openclaw acp` | [OpenClaw ACP](https://docs.openclaw.ai/cli/acp) · 需要已运行的原生 Gateway | 待实机验证 |
| OpenDesk CLI | `opendesk serve --mode acp` | [OpenDesk ACP](https://opendesk.bitclub.ai/docs/quickstart/vscode/) | 待实机验证 |
| GitHub Copilot CLI | `copilot --acp --stdio` | [Copilot ACP](https://docs.github.com/en/copilot/reference/copilot-cli-reference/acp-server) | 待实机验证 |
| Cursor CLI | `agent acp` | [Cursor ACP](https://cursor.com/docs/cli/acp) | 待实机验证 |
| Factory Droid | `droid exec --output-format acp` | [Droid Exec](https://docs.factory.com/droid-exec/overview) | 待实机验证 |
| Qoder CLI | `qoder --acp` | [Qoder ACP](https://docs.qoder.com/cli/acp) | 待实机验证 |
| Muse Code | `muse acp` | [Muse ACP](https://meta-models.github.io/muse-code-sdk/1.4/guides/editors-acp/) · 上游标记为实验功能 | 待实机验证 |
| ZCode | `zcode-acp-server` | [ZCode 社区适配器](https://github.com/william0wang/zcode-acp) · 另装适配器 | 待实机验证 |
| Oh My Pi | `omp acp` | [omp CLI](https://github.com/can1357/oh-my-pi/blob/main/docs/cli-reference.md) | 待实机验证 |
| Google Antigravity | 按平台使用 Registry 清单的命令和参数 | [ACP Registry](https://agentclientprotocol.com/get-started/registry) | 待实机验证 |
| Amp | `amp-acp` | [Amp ACP](https://github.com/tao12345666333/amp-acp) · 另装社区适配器 | 待实机验证 |
| Claude Code | `claude-agent-acp` | [Claude ACP 适配器](https://github.com/agentclientprotocol/claude-agent-acp) · 另装适配器 | 待实机验证 |
| Codex | `codex-acp` | [Codex ACP 适配器](https://github.com/agentclientprotocol/codex-acp) · 另装适配器 | 待实机验证 |
| Pi | `pi-acp` | [ACP Registry](https://agentclientprotocol.com/get-started/registry) · 另装适配器 | 待实机验证 |

[ACP Registry](https://agentclientprotocol.com/get-started/registry) 中的其他 Agent 也可使用这条接入路径，前提是相应发行版能以 ACP v1 stdio 运行。上表汇总上游入口，具体版本能否续聊以 Bridge 握手为准。支持文字流、普通委派和取消。Agent 声明 `session/resume` 或 `session/load` 时可续聊原 Session。公开 ACP 便携版收到工具权限请求时会取消该询问。开发版可在原任务详情选择「拒绝」，原生选项允许时也可选择「仅允许本次」。依赖 ACP 客户端代理文件或终端的功能尚未适配。

## 按 Agent 阅读

| Agent | 入口与主要说明 |
| --- | --- |
| [Claude Code](claude.md) | stream-json CLI、续聊、权限与 MCP |
| [Codex](codex.md) | exec / resume CLI、取消与 MCP |
| [OpenCode](opencode.md) | CLI 启动原生服务，HTTP 执行与交互 |
| [Hermes](hermes.md) | CLI 直接会话与普通被委派 |
| [Pi](pi.md) | CLI 会话文件、续聊与普通被委派 |
| [DSH](dsh.md) | DSH NEXT、ACP、CLI、Windows Desktop、Linux / WSL Web |
| [OpenDesk](opendesk.md) | CLI原生HTTP、Windows桌面WebSocket与独立MCP |

比较[六种接入方式](../integration-methods.md)，或按[快速开始](../quickstart.md)配置现有入口。

Hermes的原生网关任务不能通过关闭CLI确认取消，Bridge的取消能力为不支持；请在Hermes原生会话停止。缺终态时保留原请求，不重发。
