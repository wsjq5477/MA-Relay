# Windows Hermes ACP 验收

2026-11-24 · Windows x64 · Hermes **0.22.5** · 通用 ACP v1 stdio · AgentBridge 开发版

Hermes 是 DSH 之后第二个 Windows ACP 实测目标。测试客户端使用登记后的原生 MCP 端点。它经过真实 Coordinator、MachineHost 与 ACP worker，将任务交给本机 Hermes Gateway。模型配置来自隔离的 Hermes Profile，本机 Ollama 0.31.1 负责推理。测试在 D/E 盘进行，使用本机已有模型权重。

## 修复原任务失败状态

Hermes Gateway 确认可归属的原轮次失败后，以 `-32603` 和 `error.data.details = admitted_turn_failed` 回复原 prompt。此前 Bridge 把这种结果显示为「结果待核对」。新版只在握手标识为 `hermes-agent` 且原 prompt 返回该固定标记时写入 `failed` 和 `HERMES_ACP_TURN_FAILED`。断线、其他错误和第三方 Agent 返回的同名标记继续受原有恢复规则约束。旧任务仍沿原请求读取。[ACP worker](../../../desktop/electron/acp-worker.cjs) · [协议](../../protocol.md)

| 场景 | 结果 |
| --- | --- |
| 修复前，Qwen3 本机模型上下文不足 | 原生 Gateway 记录失败，Bridge 原任务为 `unknown`。保留原记录，原 prompt 没有再次发送。 |
| 修复后，低上下文的独立场景 | 通过真实 Hermes ACP 和授权 MCP，原任务与调用方均返回 `failed` 和 `HERMES_ACP_TURN_FAILED`。按原客户端请求 ID 查询得到同一个 Task，耗时约 50 秒。 |
| 修复后，Gateway 准备阶段连接中断 | 一次独立验证在 prompt 派发前收到 `ACP_REJECTED`，按既有准备失败处理。 |
| 受控回归 | ACP worker 12/12，合并自定义运行时及 MachineHost 路由共 22/22。覆盖明确失败、含糊回执、非 Hermes 入口与原请求仅发送一次。 |

隔离本地模型的首次尝试返回了可读取的流式正文，但小模型没有给出要求的标记。另一次 Qwen3 测试使用的运行上下文小于 Hermes 的 64K 门槛，准确报告为原生失败。调整本地测试环境的配置后另开独立场景。原生默认模型和有效窗口须在用户的 Hermes 与 Ollama 中配置。[Hermes ACP](https://hermes-agent.nousresearch.com/docs/user-guide/features/acp) · [本地模型配置](https://hermes-agent.nousresearch.com/docs/guides/local-ollama-setup)

## 真实任务和控制

| 场景 | 实际结果 |
| --- | --- |
| 从授权 MCP 提交首轮 | 调用客户端列出获准的 Hermes 目标。Ollama 本机 Qwen3 8B 产生 4 个正文增量。源文件记录的首次观察约 325 秒，包含冷启动，按原任务读到预期标记。 |
| Coordinator 重开与原会话续聊 | 重开后按原客户端请求 ID 读回原任务及其正文。测试脚本注入的路由初次缺少登记能力，MCP 在预检拒绝派发。预检明确未派发，原观察记录也没有生成对应 Task。补齐脚本初始化后继续使用同一续聊意图。第二轮约 50 秒，输出符合预期，Bridge Conversation 和 Hermes Session 均与首轮相同。 |
| 原任务取消 | 单独派发另一条任务，看到原生执行开始后发送一次取消。收据首次为 `unknown`，以原操作 ID 查到 `confirmed`。原 Task 单独返回 `cancelled`，该场景约 38 秒。 |
| 执行数 | 本组共 3 个成功登记的原任务，关闭/重开的查询没有产生新执行。 |

使用隔离 Hermes Profile 固定本地 Ollama 的窗口配置。Ollama 日志显示这轮短任务实际使用 40,960 token 窗口，Hermes 测试 Profile 显式配置 `model.ollama_num_ctx=65536`。本轮结果限于短任务与原生会话控制。日常使用请保持 Hermes 配置与实际运行窗口一致。

本轮没有验证 Hermes ACP 工具权限、结构化输入、跨机或热升级。证据保存在 D 盘隔离验收目录，原请求 ID 和原生账号资料留在本机。生产前端截图另见[接入配置与执行审计](desktop-workbench-20261124.md)。
