# Driver 合约

src/drivers/driver.ts 定义 AgentDriver：descriptor、capabilities、health() 和 execute(execution, signal?)。execute 返回异步事件流；Driver 在 Edge 中运行，Hub 不加载 Driver。

## Mock

src/drivers/mock.ts 使用可信配置 mode=success/failure、delayMs、healthy。默认串行，支持进度，不支持用户取消或原生会话。成功结果包含实际 agentId 与原消息；失败产生结构化 MOCK_FAILURE。用户消息不会用来选择可执行程序、工作目录或 Shell。

执行入口同步记录 invocation，随后发 started、progress 等真实事件。Edge 持久化每条事件后发送，等待 Hub 的持久确认。连接中断触发内部 AbortSignal 停止 Mock 等待；这只是测试运行的内部清理，不是已经实现原生取消，也不能把 Hub 的 unknown 改成 cancelled/failed。

## 扩展约束

以后接入 Driver 时保持健康、真实能力和执行事件的区分；终态只在确实结束时发出。执行 ID/输入去重由 Edge 台账保护，Driver 的外部提交仍须按实际接口设计调用边界和原生查证能力，不能据 Mock 计数声称真实系统 exactly-once。

当前配置支持 mock 与 opencode；没有热加载或任意模块路径。通用 JSONL/HTTP 与自定义 Driver 示例在 I05。

## OpenCode 2

src/drivers/opencode-client.ts 按本机 2.0.24 原生 /openapi.json 合约请求 /api/info、/api/model、/api/session、原生 Prompt、分页消息、权限和表单。location 参数使用 location[directory]。认证只从密码文件读取；禁重定向，错误不打印原生认证或原始 HTTP 正文。

src/drivers/opencode.ts 在写调用前绑定 session/message 标识；每任务新会话，轮询实际工具、文本和等待，依据对应用户消息、session outcome 与时间线 idle 确认终态。原生写请求不自动重试。网络不明、会话被额外 Prompt 干扰、目录改变、interrupted 或缺少可信结果均进入 unknown。

OpenCode 具备 nativeSessions 能力；本轮仍不暴露 cancel 能力。health 表示原生版本与模型配置检查结果，不保证提供方额度和调用授权，提供方实际拒绝会在任务执行中报告 failed。原生 ask/deny 规则可通过可信配置增加限制，不设默认自动批准。
