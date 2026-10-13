# 协议与查询接口

实现 Schema 位于 src/protocol.ts；下列接口为本项目自有接口，protocolVersion=1。

## HTTP

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | /healthz | 仅返回 ready，不含身份/任务；存储故障返回 503 |
| GET | /v1/agents | allowlist 内 Agent、设备、健康、在线、占用、可接单状态 |
| POST | /v1/tasks | targetAgent、message、requestId；新建 202，幂等取回 200 |
| GET | /v1/tasks?cursor=0&limit=100 | 当前用户分页历史；items、nextCursor、scope |
| GET | /v1/tasks/:id | 所有者可见详情；具备 diagnostics 时附 events |

业务请求使用 Authorization: Bearer TOKEN；Token 不放 URL。提交未知字段拒绝，owner 根据身份生成。相同用户/requestId/目标/消息先取旧任务，再检查新请求的可用性。不存在或无权查看的私有任务返回同样的 404。?diagnostics=true 明确请求诊断，无权限返回 403。

400 表示输入无效，401/403 表示身份/权限拒绝，404 表示对象不可见，409 表示忙碌、离线、不健康、幂等冲突或非法状态，413 表示 HTTP 正文过大，503 表示服务存储失败。错误含 error.code/message，无凭据和原始解析输入。

## WebSocket

Edge 主动连接 /v1/connectors/ws，Header 包含 Authorization 和 x-connector-id。一个身份只允许一个活跃连接。最大帧 1 MiB，只接受 UTF-8 JSON 文本；无压缩、跳转和自动重连。

所有消息包含 protocolVersion、messageId、type、timestamp、payload；task.event 另外包含 taskId、executionId。

| 消息 | 方向 | payload |
| --- | --- | --- |
| agent.register | Edge → Hub | device、agents 描述/健康；绑定 Agent ID 必须授权且无重复 |
| agent.heartbeat | Edge → Hub | 本连接注册的 agents 健康摘要 |
| task.submit | Hub → Edge | taskId、executionId、conversationId、targetAgent、message |
| task.event | Edge → Hub | seq、event |
| message.ack | 双向 | ackedMessageId；只确认记录 |
| protocol.error | 双向定义；本轮 Hub 发出 | code、message、correlationId（可选） |

事件依次 accepted、started、progress、output、completed 或 failed。Mock 成功产生五条事件、失败四条；seq 从 1 递增。失败 phase 为 before_execution 或 execution，用于阻止错误状态转换。

I02 增加 opencode 描述符和 native/waiting 事件。native 携带 sessionId、messageId、serverUrl、workspace，在 running 状态保存不可变原生执行关联；waiting 携带权限/输入类型、摘要与请求 ID，null 清除等待，状态仍为 running。终态清除等待。能力中的 nativeSessions 按 adapter 声明，cancel 仍为 false。Hub/Edge 必须使用同时支持这些字段的版本。

Hub 验证 Connector → Agent → Task → executionId 归属。重复 seq 同内容只 ACK、不重复保存；不同内容冲突，缺序拒绝。记录和状态提交后才 ACK。unknown 不在 I01 自动采纳迟到事件解除占位；已确认终态不可覆盖。

事件文本与结果受 maxEventBytes 限制，UTF-8 安全截断；truncated/detailsTruncated 明示。maxEventsPerTask 为总事件上限并预留终态空间；超限非终态事件拒绝，Edge 停止连接以保留不确定性，不假造完成。

## 后续边界

完整可靠投递、对账、取消和远程统一输入回复属于 I03。本轮没有新增这些 Hub 路由，不解释 ACK 为原生 Agent 已执行；native 等待处理是持有本地 Edge 配置的操作者入口。通用第三方接入在 I05 展开。
