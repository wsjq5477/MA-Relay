# AgentBridge 连接

只读查看当前 DSH 获准访问哪些 Agent。页面从左侧栏的 **AgentBridge 连接** 图标进入，也可以由 `openOnLoad` 配置在插件启用后自动打开一次。

## 显示什么

- 按机器（`machine`）分组，每组列出该机器上的连接项。
- 每个 Agent 显示名称、在线/离线状态和忙碌/空闲状态；适配器名作为次要标签显示。
- 顶部显示上次读取时间、Agent/机器数量和数据来源（MCP `agentbridge` 的 `list_agents`）。
- **刷新**按钮重新调用一次 MCP 工具。
- 空结果与查询失败分别有独立提示；失败时保留上一次成功的数据，并显示错误代码和原因。

## 数据从哪来

Host 半通过 `ctx.tools.get('mcp__agentbridge__list_agents')` 找到现有的 AgentBridge MCP 工具并调用它，读取真实返回的 `items`，只投影出页面需要的字段（名称、机器、状态、忙碌、适配器），再按机器分组。

- 不硬编码 Agent 或机器列表。
- 不发送任务、不续接委派、不修改授权、不重登账号。
- 不读取或展示凭据；`caller`、`credentialId`、`bindingDigest` 等字段在投影时被丢弃。
- 不改动 Bridge 源码；插件只消费 DSH 已经注册的 MCP 工具。

## 状态与限制

- 需要 profile 中已存在 `@deepseek-ai/dsh-mcp-client` 的 `agentbridge` 服务器行；工具未注册时页面显示 `agentbridge/tool-unavailable`。
- 查询受 `timeoutMs` 限制，超时显示 `agentbridge/timeout`。
- 浏览端通过 Connection 认证的 `/api` 上的精确 Fetch 路由 `/api/agentbridge-connections` 读取。精确路由只允许 owner Peer，因此与 `/api` 使用同一套浏览器 Cookie 认证，不额外暴露匿名 HTTP 路由。
- 本版 DSH 的 `ctx.connection.rpc.handle` 不可用：它通过 Connection 服务自身的 context 注册前缀路由，而该 context 没有注入 `webServer`，任何调用都会抛 `cannot get property "webServer" without inject`；另外 `/api` 的共享 interceptor 只允许 API Gateway 一个所有者，插件无法再注册。
- 页面不缓存结果；每次进入或刷新都重新读取。
- 无桌面端/命令行入口，也不提供任何写操作。

## 配置（`cordis.patch.yml` 的插件行）

| 字段 | 默认值 | 说明 |
|---|---|---|
| `serverName` | `agentbridge` | MCP 服务器命名空间。 |
| `toolName` | `list_agents` | MCP 工具原始名。 |
| `timeoutMs` | `20000` | 单次查询超时（毫秒）。 |
| `openOnLoad` | `false`（本预览包为 `true`） | 激活后自动选中该主面板一次。 |

## 隐私与凭据

页面只显示 Agent 的展示名、机器名、在线/忙碌状态和适配器标签。所有身份、绑定摘要、端点记录和调用方信息都在 Host 投影阶段被丢弃，不会发送到浏览器。
