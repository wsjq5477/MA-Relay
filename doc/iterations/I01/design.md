# I01 实现设计

状态：2026-10-08 已获准开发。需求依据：[requirements.md](requirements.md)。

## 需求与模块对应

| 需求 | 实现模块 | 设计与开发安排 |
| --- | --- | --- |
| F01 | config、cli、storage/database | Zod 严格配置校验；路径相对配置文件；init 独占创建目录与凭据；服务前台运行；数据文件独占锁 |
| F02 | hub、edge、protocol | Edge 出站 WebSocket；Header 凭据认证；注册 Agent 绑定 Connector；健康心跳与在线状态独立；重复连接拒绝 |
| F03 | hub、storage/hub-store、core | HTTP 提交；服务端确定 owner；先权限和幂等查询，再在线/健康/占位检查；事务创建 Conversation 和 Task；唯一约束保护串行 |
| F04 | drivers、edge、core | AgentDriver 异步事件接口；Mock 可信配置指定成功/失败/延迟；调用前持久化调用计数；Hub 状态机检查执行关联和事件序号 |
| F05 | cli、hub | 原生 fetch 查询；轮询观察，不产生执行请求；分页查询完整历史；文本/JSON/JSONL；退出码按需求约定 |
| F06 | storage | node:sqlite；WAL、FULL 同步；Hub 任务与事件事务保存；Edge 执行台账与事件日志；任务和执行 ID 双重去重；禁止历史自动回放 |
| F07 | security、config、hub | 静态 user/connector 身份；定长摘要比较凭据；allowlist、owner 与诊断权限；错误不包含配置值；输出统一脱敏 |
| F08 | hub、edge、storage | Hub 启动扫描与 Connector 下线将活跃任务转 unknown；保留串行名额；Edge 旧记录不再调用；本轮无自动重连或对账解除占位 |

## 进程与数据边界

CLI 只调用 Hub HTTP。Hub 不导入 Driver。Edge 只连 Hub WebSocket，独立持有执行台账和 Driver。Core 的状态规则不依赖传输或数据库。

Hub 使用 conversations、agents、tasks、events 表。tasks 的 owner/requestId 联合唯一，targetAgent 在非 succeeded/failed 状态下唯一。unknown 因而仍占位。Task 的业务载荷与状态保存为 JSON，索引列用于约束和检索。事件和状态在同一事务提交。

Edge 使用 executions、events 表。taskId 和 executionId 均唯一；记录输入指纹。执行意图与 Mock 调用计数先落库再调用 Driver，崩溃后的旧记录不重新执行。计数证明本轮 Mock 调用意图/调用入口，不能推导真实外部系统的 exactly-once 保证。

独立锁数据库持有 SQLite 独占事务，阻止双进程共享同一业务数据库；操作系统在强制退出时释放文件锁，无需删除旧 PID 文件。配置变更须重启。SQLite 持久化失败不发送虚假 ACK 或成功响应。

## 接口与状态规则

HTTP：GET /healthz（仅存活）、GET /v1/agents、POST /v1/tasks、GET /v1/tasks、GET /v1/tasks/:id。业务接口全部鉴权。提交包含 targetAgent/message/requestId，未知字段拒绝。分页采用创建序号游标。只有任务所有者可查询；完整事件另查 diagnostics 权限。

WebSocket：/v1/connectors/ws。protocolVersion=1，messageId/type/timestamp/payload；任务消息带 taskId/executionId。消息包括 agent.register、agent.heartbeat、task.submit、task.event、message.ack、protocol.error。ACK 只证明记录保存。事件序号从 1 连续增长；重复序号同内容 ACK，异内容或非法状态拒绝。

queued→accepted→running→succeeded/failed；确定执行前失败允许 queued/accepted→failed。活跃状态在断线/启动扫描转 unknown；unknown 本轮不接受迟到事件解除。终态不可覆盖。投递前保存 attempted 标记，发送失败保守 unknown，不自动重投。

## 默认限制与故障策略

仅显式 devInsecure=true 的 127.0.0.1/localhost/[::1] 明文开发模式；I01 不提供正式 TLS 部署。消息默认 64 KiB，帧与 HTTP 正文有上限，事件条数与单事件文本限量并标记截断；终态与结果摘要预留保存空间。心跳默认 1 秒、离线窗口 4 秒，握手 5 秒。CLI 默认请求超时 5 秒，观察默认不设任务截止时间，可用 --timeout-ms 设置本地观察期限。

执行中连接断开时 Driver 不重跑，未能回传的事实保存在 Edge；Hub 仅显示 unknown。I02 再实现查证与恢复。本轮不增加取消、输入回复、真实 OpenCode 或 Web 看板。

## 开发顺序与验证

先完成配置、领域规则和存储，再接 Hub/Edge/Mock，最后 CLI 与真实跨进程验收。单元测试覆盖状态、事务、去重、锁和边界；集成验收使用独立 Node 服务进程及临时 SQLite，逐项映射全部 30 条 AC。运行 lint/typecheck/test/build 后才记录实际验收结果。
