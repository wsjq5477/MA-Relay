# Windows DSH ACP 接入

2026-11-23。按用户确认先接入 DeepSeek Harness 的 ACP 路径，复用 Windows DSH NEXT 已验证的安装与原生配置。

## 实现

- 自动扫描确认同一 DSH NEXT 安装包内有 ACP 协议包和应用 Profile，单独显示「DSH ACP」。原「DSH NEXT」headless 留在其独立节点。
- Bridge 启动包内 `--profile acp`，通过 JSON-RPC stdio 协商 ACP v1。通过 `session/new` 创建会话，通过协商后的 `session/resume` 恢复原会话。续聊绑定原节点、数据目录、工作目录与 Session。
- 仅发送一次原 `session/prompt`。可显示同一 Session 的文字增量。取消通知只发送一次，Task 依据原 prompt 的明确终态结算。失去终态时保留原请求和占用，按既有接口查询。
- 模型与认证由原生 ACP Profile 管理。当前开放直接会话及普通被委派。Bridge 侧权限弹窗答复、托管 MCP 注入、回合中插话、回退与压缩尚未开放。未收到用户批准的原生权限询问返回取消。

[下游 Worker](../../../desktop/electron/acp-worker.cjs) · [Windows 安装发现](../../../desktop/electron/dsh-next-runtime.cjs) · [DSH 官方 ACP Profile](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/acp-app/README.md) · [ACP v1 Prompt](https://agentclientprotocol.com/protocol/v1/prompt-turn)

## 验收

| 验证 | 实际结果 |
| --- | --- |
| Windows 本机原生 DSH NEXT 2.0.24-next 无模型合约 | ACP v1 握手、原生创建、关闭、跨原生进程恢复成功。原生恢复回应未返回 Session ID，按请求中的原 ID 保持绑定。模型 0，记录 `dsh-acp-native-keyless.json` |
| Windows 本机真实模型，经生产 MachineHost | D 盘隔离 ACP Profile 使用已获准 DeepSeek 账号。两轮成功并收到流式文字，原 Session 相同，Bridge 后台重开可按原请求查回结果。另提交一条取消场景，原 Task 为 cancelled，原操作为 confirmed。记录 `dsh-acp-native-live.json` |
| 受控 ACP worker | 4/4。验证原 Session 与工作目录、异会话更新隔离、丢回应保持 unknown 且只有一次发送、取消终态及权限请求拒绝 |
| 范围 | 当前入口面向 Windows DSH NEXT 包内 Profile。独立 CLI 分发、其他 ACP Agent、SSH 与新打包 EXE 未验 |

证据放在 D 盘 `artifacts/current-scope-20261122`。真实原生 Agent 与源码路径分别核对。
