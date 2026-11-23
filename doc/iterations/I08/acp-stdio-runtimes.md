# 通用 ACP v1 stdio Agent 接入

2026-11-23，Windows 本机开发。需求来自用户给出的 ACP Agent 清单，覆盖 DSH 之外已提供兼容 stdio 入口的 Agent。当前以源码状态记录。

## 实现

- 「接入配置 → 添加 Agent → 自定义运行时 → ACP」由目标机解析用户明确提供的可执行程序和固定参数。Windows npm 启动器通过包清单校验后直接启动声明的程序或 JS 入口。
- 注册只发送 ACP v1 `initialize`，记下版本与续聊能力。握手使用 45 秒时限以覆盖本机较慢的原生启动。独立节点标识使用已有的自定义运行时 UUID，登录、默认模型和数据目录由目标原生 Agent 管理。
- 通用入口与 DSH ACP 共用 worker。新建会话、文字增量、普通被委派和取消沿用 Bridge 原任务链路。续聊按能力调用原 Session 的 `session/resume` 或 `session/load`。同一次派发仍用原请求 ID，缺少终态时保留 unknown。
- 当前客户端声明基础能力。原生权限询问返回取消，Bridge 侧文件与终端代理、MCP 注入、插话、检查点回退和主动压缩暂未适配。

[接入命令与用户步骤](../../user/agents/index.md#连接其他-acp-agent) · [运行时注册](../../../desktop/electron/custom-runtime.cjs) · [ACP Worker](../../../desktop/electron/acp-worker.cjs) · [ACP Registry](https://agentclientprotocol.com/get-started/registry)

## 验收

| 场景 | 结果与证据 |
| --- | --- |
| Windows 原生 OpenCode 2.3.0，隔离存储 | Bridge 注册成功，并通过原生 JSON-RPC 新建会话、跨进程用 `session/resume` 恢复原 ID。模型调用 0。原始结果 `generic-acp-opencode-native.json` |
| Windows 原生 Hermes 0.22.5，隔离存储 | Bridge 注册与 ACP v1 握手通过。空配置下原生 Gateway 返回 `storage_unavailable`。配置默认模型并等隔离 Gateway 就绪后，原生会话创建及跨进程 `session/resume` 通过。模型调用 0。记录 `generic-acp-hermes-native.json`、`generic-acp-hermes-configured-native.json` |
| Windows 受控后端 | ACP/DSH 协议、运行时注册、npm 启动、路由和图标相关检查 35/35；另经实际 Coordinator、MachineHost 和 worker 完成注册、直接执行、后台重开后原 Session 续聊 1/1。记录 `generic-acp-engineering.log` 和 `generic-acp-routing.log`。另有 MachineRouter 19/19。 |
| Windows DSH NEXT 2.0.24-next | 本轮重跑共享 worker 的协议回归。真实 DeepSeek 两轮与取消见此前的 [DSH ACP 验收](dsh-acp.md) |
| 其他发布方入口 | 上游命令收录用户表。各版本仍需在目标机握手验证；真实账号、生产 SSH/WSL 及通用 ACP 完整原生能力矩阵未完成 |

类型检查和用户站测试通过，18 个用户页生成 19 个 HTML 页。整仓文档检查仍报告与改动前相同的 2,219 个旧归档链接缺失，其他文档错误为 0。

原始记录位于本机项目 `artifacts/current-scope-20261122/`。
