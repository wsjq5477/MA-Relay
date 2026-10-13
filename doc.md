> 这是原始项目初稿，作为历史来源保留。当前完整功能、模块设计、测试报告与维护规则从 [doc/README.md](doc/README.md)阅读；不以初稿的候选能力或旧状态覆盖当前实现。

# AgentBridge：轻量跨设备多 Agent 连接器开发任务

你是一名资深开源架构师、TypeScript 工程师和 AI Agent 基础设施工程师。

请在当前工作目录从零开发一个名为 **AgentBridge** 的开源项目。

这不是一项仅写架构文档的任务。你需要实际创建源码、安装依赖、实现功能、运行测试、修复错误，并交付一个真实可运行的最小产品。

## 1. 产品目标

AgentBridge 是一个轻量、插件化、可私有化部署的跨设备多 Agent 连接工具。

用户已经有自己的 Agent，不希望重新开发 Agent。

主要场景：

- Linux A：运行 OpenCode Agent，用于编码。
- Linux B：运行 Harmes Agent，用于编译。
- Windows C：运行公司自研 Agent，用于调用内部实验室系统完成验证。
- Windows 或 Linux 服务器：运行 AgentBridge Hub。
- 用户通过 CLI 或企业 IM 连接和控制 Agent。
- Agent 可以互相发送消息、委派任务并接收执行结果。
- 用户能够随时查看每个 Agent 的连接状态、当前任务、执行进度、最终结果。

特别说明：Harmes 是用户现有 Agent 的名称，不能未经验证就假设它等同于 NousResearch Hermes。必须确认实际 CLI/API 后再实现专用驱动。

## 2. 必须坚持的架构原则

参考 Pi Coding Agent 的设计理念：

1. 核心代码小，容易理解和扩展。
2. 功能通过插件实现，不在 Core 中硬编码厂商逻辑。
3. 不重复开发已有 Agent Runtime。
4. 不内置 LLM，不要求使用 Gemini/OpenAI 等特定模型。
5. 不创建通用工作流引擎。
6. 单仓库、单一 CLI、少依赖。
7. 首先保证 Linux/Windows 可运行。
8. 优先复用已有成熟库，不自行发明标准协议。

**产品边界：只连接 Agent，不管理 Agent 的工具或执行资源。**

明确禁止在中心平台增加：

- 实验室设备管理；
- 单板注册、锁定和调度；
- 编译服务器资源调度；
- 通用 SSH 执行平台；
- 中心化工具注册中心；
- 大型可视化 Workflow Builder。

编译、设备、工具、文件和运行环境由现有 Agent 自己管理。

## 3. 架构

采用三层结构：

### 3.1 Channel 层

负责用户入口：

- CLI Channel：MVP 必须实现。
- Generic Webhook Channel：MVP 实现最小可用版。
- 企业 IM、飞书、Telegram 等作为后续插件。

Channel 将聊天消息转换为 Core Task，并将 Task 状态、结果转换为用户消息。

不得将具体 IM 平台 SDK 写入 Core。

### 3.2 AgentBridge Hub

中心服务只负责：

- Agent 注册和发现；
- Connector 身份认证；
- 消息寻址和转发；
- Task 状态机；
- Session / Conversation 关联；
- 任务结果转交；
- SQLite 持久化；
- Agent 在线状态与任务查询。

采用 Node.js HTTP Server + WebSocket。

Hub 不运行任何 Agent CLI，不执行远程 Shell，也不进行模型推理。

### 3.3 Edge Connector

每台需要连接的电脑运行一个 Edge Connector。

职责：

- 主动连接 Hub；
- 注册本机可用 Agent；
- 发送心跳、断线重连；
- 接收发给本机 Agent 的任务；
- 调用对应 Agent Adapter；
- 将执行状态、事件和结果发送给 Hub；
- 根据原生 Agent 能力实现取消与会话续接。

一个 Edge Connector 可以管理多个本地 Agent Adapter。

要求 Connector 能连接部署在另一台 Linux/Windows 设备上的 Hub，不要求 Edge 电脑开放入站端口。

## 4. 技术栈

优先选择：

- TypeScript；
- Node.js 当前受支持的 LTS；
- npm；
- `ws` 实现 WebSocket；
- SQLite 存储；
- `zod` 进行消息和配置校验；
- `vitest` 或 Node.js 内置测试框架；
- 基于 Node.js HTTP 的轻量服务。

只引入必要依赖。

如果 SQLite 库在 Windows/目标 Node.js 版本有兼容问题，选择维护良好、可移植的替代实现，并说明原因。

不要引入 Kubernetes、Redis、Kafka、RabbitMQ、PostgreSQL、LangChain、ADK 或 AutoGen。

## 5. Agent Adapter 设计

必须提供独立的 TypeScript AgentDriver 接口。

接口至少表达：

- Agent 身份和能力；
- 连接与健康检查；
- 提交任务；
- 返回异步执行事件；
- 请求取消；
- 原生会话 ID 映射；
- 可选的原生会话查询能力。

定义结构化事件模型，至少包含：

- started
- progress
- output
- tool_activity
- waiting_input
- completed
- failed
- cancelled

不同 Agent 的能力不一致，不能假设全部支持取消、恢复、工具事件或会话枚举。

Adapter 必须通过 capability 字段声明真实支持情况。

### 5.1 OpenCode Adapter

优先使用官方 `@opencode-ai/sdk` 或原生 HTTP API。

官方资料：

https://opencode.ai/docs/sdk/

https://opencode.ai/docs/server/

目标能力：

- 连接已有 OpenCode Server，或根据显式配置启动本地 Server；
- 创建或继续 OpenCode Session；
- 异步提交 Prompt；
- 订阅真实执行事件；
- 查看任务状态和可获得的工具活动；
- 请求中断；
- 保留 AgentBridge Task 与 OpenCode Session 的映射；
- 如果原生接口允许，查看本服务可访问的已有会话。

注意 SDK 不同版本接口可能变化。

先读取本地安装版本与官方文档，再调用真实方法，不要凭印象编造 API。

禁止在 OpenCode Adapter 中实现自己的 Coding Agent。

### 5.2 Harmes Adapter

首先检查当前环境是否存在用户所说的 Harmes CLI 或 API。

如果未安装或接口资料不足：

- 不得把 NousResearch Hermes 的命令直接写成 Harmes 的事实；
- 实现独立的、可配置的 `command-jsonl` Adapter；
- 通过配置指定受信任的可执行程序、固定参数和输出解析方式；
- 提供 Mock 示例和明确的待适配说明。

如果确认是 NousResearch Hermes，可参考：

https://hermes-agent.nousresearch.com/docs/reference/cli-commands/

但必须先验证当前实际版本的命令与事件结构。

### 5.3 自研 Agent Adapter

目标是让第三方开发者容易接入已有 HTTP/CLI Agent。

提供：

- 通用 HTTP API Adapter 示例；
- 可配置 CLI JSONL Adapter；
- 独立的 Adapter 开发文档；
- 一个最简自定义 Adapter 示例；
- 自动化测试样例。

不允许让用户消息直接变成 Shell 命令。

自定义 CLI 程序和参数必须在管理员可信配置中声明。执行时使用安全的参数数组及标准输入，不通过 Shell 字符串拼接。

## 6. Agent 之间如何主动通信

除了人给 Agent 发任务，还要支持 Agent A 主动请求 Agent B。

MVP 提供 `agentbridge delegate` 命令。

调用示例：

```
agentbridge delegate \
  --to harmes \
  --message "请编译 commit abc123" \
  --parent-task TASK_ID
```

真实使用时支持从 stdin 或文件读取长消息，避免命令注入和 Shell 转义问题。

提供一份 OpenCode 可读取的 Skill，说明：

- 如何发现其他 Agent；
- 如何调用 delegate；
- 如何检查子任务状态；
- 如何等待或后续查询结果；
- 如何继续原始 Session。

这个通信接口只涉及 Agent 间消息，不是中心化的任意工具调用。

未来可以在同一 API 上增加 MCP Tool 或 OpenCode 原生 Tool Plugin。

第一版无需实现完整 A2A Server，但协议设计不能与未来 A2A 接入冲突。

## 7. WebSocket 内部通信协议

定义统一的 TypeScript 类型和 Zod Schema。

推荐以 Envelope 包装消息，包含：

- protocolVersion
- messageId
- type
- timestamp
- correlationId
- taskId
- source
- target
- payload

MVP 消息事件：

- agent.register
- agent.heartbeat
- task.submit
- task.accepted
- task.started
- task.progress
- task.completed
- task.failed
- task.cancel
- task.cancelled
- task.delegate

Agent 侧必须验证服务端身份，服务端必须验证 Connector 凭据。

保持 Task ID 全局唯一。

发送消息时先持久化，再发送。收到明确 ACK 后更新状态。

不能把 WebSocket 发送成功等同于任务执行完成。

必须处理：

- 消息去重；
- Connector 重连；
- 心跳超时；
- Task 超时或状态不明；
- 取消竞态；
- 子任务与父任务关联；
- 进程重启后的状态恢复。

对于已经开始执行但在断线后状态不确定的任务，应标记 unknown 并等待查询或人工处理，不得自动重复执行有副作用的任务。

## 8. Task 与 Conversation 设计

核心状态：

- queued
- accepted
- running
- waiting_input
- succeeded
- failed
- cancel_requested
- cancelled
- unknown

Task 必须包含：

- taskId
- conversationId
- parentTaskId
- sourceAgent / sourceUser
- targetAgent
- status
- message
- createdAt / updatedAt
- nativeSessionId
- 可选的 artifact references

任务和会话应分开存储。

AgentBridge Conversation ID 不等于 OpenCode 原生 Session ID。由 Adapter 管理两者的对应关系。

同一个 Agent 可接受多个不同 Conversation 的任务，但必须按照该 Agent 声明的并发能力调度；默认保守串行，避免并发污染工作目录或会话。

任务取消应明确区分“取消请求已发送”和“底层执行已实际取消”。

## 9. CLI 用户体验

最终统一通过 `agentbridge` 命令使用。

至少支持：

```
agentbridge init
agentbridge hub start
agentbridge connect
agentbridge agents
agentbridge run opencode "分析当前项目结构"
agentbridge tasks
agentbridge tasks --watch
agentbridge task TASK_ID
agentbridge cancel TASK_ID
agentbridge delegate --to harmes --message "执行编译"
```

希望输出简洁，符合开发者 CLI 使用习惯。

`agentbridge agents` 显示：

- Agent 名称；
- Adapter 类型；
- 所在设备名称；
- Connected / Disconnected 状态；
- Busy / Idle 状态；
- 正在执行的任务摘要。

`agentbridge tasks` 显示：

- 任务 ID；
- 目标 Agent；
- 当前状态；
- 执行时长；
- 父任务；
- 最近一条进度摘要。

任务列表不能只显示由 AgentBridge 自己创建的任务而声称是所有 Agent 任务。对于原生接口无法枚举的任务，应清晰区分可观测范围。

## 10. Generic Webhook Channel

为公司 IM 的后续接入实现一个轻量 Channel 接口和通用 Webhook 示例。

能力：

- 接受经过认证的用户消息；
- 将消息交给指定 Agent；
- 查询在线 Agent 和当前任务；
- 将进度与结果回传到静态配置的回调地址。

必须实现基本消息验签、防重放及敏感信息脱敏。

不可任由外部请求指定任意回调 URL，避免 SSRF。

不编造公司 IM 的私有 API，也不需要真实内部账号才能完成通用接口测试。

## 11. 安全要求

MVP 必须具备最低限度的安全边界：

1. Hub 和 Edge 之间使用可配置的访问凭据。
2. 公网或跨主机正式环境推荐 WSS/TLS；明文连接仅允许明确配置的本地开发模式。
3. Agent 调用权限采用显式 allowlist。
4. 默认不向其他用户暴露私有 Agent 的详细日志。
5. 不在日志中输出 Token、API Key 和敏感环境变量。
6. 不提供通用远程 Shell API。
7. 不把收到的消息不经授权直接转换成高权限操作。
8. 长日志必须限制大小，并区分用户摘要和详细诊断。
9. 不内置遥测上传或公网账号依赖。
10. 默认拒绝未经授权的 Connector 注册与任务委派。

## 12. 开源工程要求

单仓库，保证代码可读、模块边界清楚。

必须包含：

- README.md：五分钟上手；
- docs/architecture.md：模块架构和设计取舍；
- docs/protocol.md：内部消息协议；
- docs/adapters.md：如何扩展新的 Agent；
- examples/：本机和跨设备配置；
- tests/：单元与集成测试；
- .env.example：不包含真实凭据；
- .gitignore；
- LICENSE：优先 MIT，若复用其他开源源码需核对实际许可证；
- package.json 中的 lint、typecheck、test、build 脚本。

不要从其他开源项目复制大段代码，优先使用公开 SDK 和参考其架构思想。

## 13. 分阶段开发与验收

### M0：基础架构

实现：

- 初始化 TypeScript 项目；
- 核心消息类型和 Zod Schema；
- Hub HTTP / WebSocket 服务；
- Edge Connector；
- Agent Registry；
- SQLite 持久化；
- Mock Agent；
- CLI 查询入口。

验收：

两台独立进程之间能注册 Agent、发送任务、返回进度与结果；重启 Hub 后任务记录仍存在。

### M1：真实 OpenCode 接入

实现：

- OpenCode SDK / Server Adapter；
- Session ID 映射；
- 执行状态订阅；
- Tool Activity 归一化；
- 取消任务；
- `agents`、`run`、`tasks` 命令。

验收：

在安装 OpenCode 的真实环境中，可以创建任务、查看真实执行状态、获取结果，并按原生能力取消。

如果运行环境未安装 OpenCode，提供可执行的集成测试脚本和清晰的未验证项，不能声称真实 OpenCode 集成已测试通过。

### M2：跨设备与 Agent 委派

实现：

- Edge 重连和心跳；
- 任务恢复及去重；
- `agentbridge delegate`；
- Parent/Child Task；
- `command-jsonl` Adapter；
- Generic Webhook Channel。

验收：

Linux A OpenCode 可以向另一个设备上运行的 Mock/JSONL Agent 委派任务，并接收结果继续原会话。

若 Harmes 接口已确认且环境可用，进一步接入真实 Harmes；否则保留清晰的适配文档，不虚构实现状态。

### M3：后续版本，不阻塞 MVP

保留规划但不要提前过度开发：

- A2A Client/Server Adapter；
- 多 IM 插件；
- MCP Agent 通信工具；
- Web 任务看板；
- 多用户身份与团队权限；
- 分布式数据库或消息系统。

## 14. 自动化测试

必须覆盖：

- Agent 注册与下线；
- Task 状态机非法转换；
- 消息幂等性；
- 重复 ACK；
- Connector 断线重连；
- Agent 执行超时；
- Task 取消竞态；
- Parent/Child Task 关联；
- 不同 Agent 的 Session 隔离；
- 错误 Agent 寻址；
- 无授权调用被拒绝；
- Mock Agent 跨进程执行；
- 重启后任务状态正确恢复。

另外提供一个本地端到端演示脚本：

```
启动 Hub
启动 Edge A + Mock/OpenCode
启动 Edge B + Mock/Harmes
用户提交任务
Agent A 委派 Agent B
Agent B 返回结果
Agent A 继续处理
用户查询完整任务链
```

禁止使用假数据冒充真实执行状态。

## 15. 工作方式与输出要求

请按照以下顺序工作：

1. 检查当前仓库及系统环境，避免覆盖已有文件。
2. 核实实际可用的 Node.js 版本、OpenCode SDK 和本机 CLI。
3. 创建简短的开发计划和架构文档。
4. 立即开始创建真实代码，不要停留在规划阶段。
5. 按 M0 → M1 → M2 的顺序增量实现。
6. 每个里程碑完成后运行 typecheck、lint、test。
7. 有错误立即定位并修复。
8. 不要为了完成要求使用空函数、伪实现或硬编码成功结果。
9. 不知道的第三方接口，先查现有代码或官方文档；无法确认时记录阻塞并实现标准的替代 Mock，而不是编造。
10. 每阶段说明已经实现的功能、尚未实现的功能和真实测试结果。

优先完成一个小而真实可运行的版本，不要为了追求功能数量牺牲架构的清晰性。

最终请输出：

- 实际生成的项目结构；
- 模块设计及其职责；
- 已实现的 CLI 命令；
- 启动和连接指南；
- 测试结果；
- 当前已验证的 Agent；
- 尚未解决的问题；
- 下一阶段建议。

**现在开始检查项目目录和开发环境，然后实施 M0。不要只回复计划。**