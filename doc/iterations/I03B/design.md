# I03B 模块设计

## 原生契约

安装版本 OpenCode 2.0.24；真实证据 [I03B-native-contract.json](../../../artifacts/I03B-native-contract.json)。同 Session POST prompt 追加 user；每轮按 user Message 之后、下一条 user 之前的消息切片，idle.outcome 是该轮完成证据。POST `/api/session/:id/interrupt?resume=false` 返回顶层 `{interrupted:boolean}`，不是 data 包装；false 是空闲无操作，true 仍须读取 idle=interrupted。取消后可续问；服务重启保留会话及消息。

## Core / 协议

增加 Conversation 的 owner、title、target、resource、指纹、原生绑定及时间。Task 增加轮次、续问原绑定、对账诊断。cancelled 是终态。增加 reconciled 事件：原绑定身份一致后恢复 running；completed/failed/cancelled 均保留原 Execution。传输丢失产生的 unknown 允许按连续持久事件恢复先前状态；原生 unknown 必须经过只读对账事件。Interaction 增加 cancel/reconcile，取消占位键固定为 execution:cancel。

## Storage

原 conversations 表增 data，按历史 Task 回填，不换 ID。Task 创建与会话校验、轮次分配处于同一事务。会话快照固定且上一轮必须终态。活动索引把 cancelled 排除。Edge executions 增 payload 和 ack_seq，旧数据缺 payload 时只补传已有事件，不能重建执行。事件 outbox 不因传输失败删除；ACK 递增有界且不可跳过。保存原生绑定前不调用任何原生写接口。

## Hub / Edge

Hub 会话查询严格按 owner；续问沿既有接单 allowlist；取消/对账和回复沿同一 Connector 关联响应链路。Hub 原生绑定事件同时更新 Conversation。Edge 观察与传输分离，emit 先落盘再唤醒补传。补传按每执行 seq 顺序，每条 ACK 后推进游标。断链保留 jobs，重连登记后补传；后台重建仅 observe 原绑定，prepared 未调用的轮失败，invoked 缺绑定保持未知。运行 observer 去重按 executionId，取消与观察读取原轮证据。

## Native 生命周期

身份文件位于凭据旁，0600 原子写入，记录内核 start ticks + boot ID 排除 PID 复用；校验 executable/cmdline/cwd 和认证响应绑定本机服务。有身份文件但进程已死亡允许重新启动；存活的陌生进程拒绝处理。托管启动通过已核验的 OPENCODE_PASSWORD 私有环境变量设置凭据，标准输出/错误独立于控制器，不将密码写入日志，也不让父进程管道死亡终止服务。就绪后刷新脚本启动的最终可执行映像；自身子进程关闭以出生身份排除 PID 复用。复用句柄轮询身份存活，关闭前复查；确认旧进程已死时，端口关闭最多等待 2 秒，持续占用仍拒绝处理；OpenCode 自身 SQLite 是原生记录持久性来源，Bridge 不编辑原生库。

## CLI

保留自动发现、空格勾选、无需填写内部配置的首次流程。新任务默认形成会话；“连续会话”列表用标题、项目和轮次展示。会话内可以续问、看上一轮、取消、对账。观察中 Ctrl+C 返回菜单；动作确认只用于确有影响的取消与原生授权。自动化和菜单共享持久 requestId/operationId 与 IPC，不另建直接原生写入通道。
