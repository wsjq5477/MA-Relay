# ACP 工具权限审批与原操作恢复

2026-11-23，从已发布 ACP 预发布的源码基线检查首阶段调用、续聊、等待交互和原请求恢复。用户已有的授权和原生账号配置继续决定接入范围。

## 当前缺口核对

| 范围 | 核对结论 |
| --- | --- |
| 原生工具权限 | 公开版本的 DSH ACP 与自定义 ACP 会直接取消原生权限询问。此轮接入已有权限处理面 |
| 问题与表单 | OpenCode 的专用 HTTP 入口已有部分表单回复，ACP 的结构化表单和客户端文件、终端代理还缺实际适配 |
| 原任务恢复 | 同会话续聊、按原 ID 恢复和断线占位已有实现。真实丢提交回应、原目录变化和生产 SSH 仍缺对应实机证据 |
| 已运行的原生服务 | 已有 OpenCode 低层外部服务处理。MachineHost 与原登记端点的完整链和升级仍待验收 |
| 其他接入 | 25 个上游 ACP 条目已整理启动方式，其中 DSH、Windows OpenCode 和 Windows Hermes 已有相应原生证据。其余版本需在实际安装上验证 |
| 扩展 | Attach、Steer、完整插件宿主、Memory 与 Profiles 按产品约束保留为后续方向 |

## 实现

- DSH ACP 和自定义 ACP 的 worker 读取当前 prompt 的原生 `session/request_permission`，只将匹配的 Session 放入原任务等待队列。在原任务详情进入处理状态后可以拒绝或仅允许本次。任务事件保存等待标记，请求详情为本机私有临时记录。
- 仅将「允许本次」绑定到可核对的唯一 `allow_once`。拒绝优先使用唯一 `reject_once`，缺少明确拒绝选项时取消该权限请求。对重复、异会话和不完整输入按原请求约束处理。缺少可确认的标题、完整路径或命令时只允许拒绝。
- 按原 Task、executionId、交互 ID 和 operationId 记权限定向回复。相同操作和内容读取原收据，换决定或 ID 无法重发。批准只表示原生 stdio 已写入回复，Task 仍以原 prompt 结果结算。
- 保持 worker 运行时，Coordinator 重开可读取同一等待项。原生断开后按原任务记录核对，任务详情展示脱敏的异常类别或观察超时原因。用户取消任务时先撤销尚未回复的工具权限，再通知原生取消当前 prompt。

[ACP v1 Tool Calls](https://agentclientprotocol.com/protocol/v1/tool-calls#requesting-permission) · [原生传输](../../../desktop/electron/acp-worker.cjs) · [任务宿主](../../../desktop/electron/native-cli-host.cjs)

## 验收

Windows 本机，源码基线 `76b56e0`。测试、候选配置与日志在 D 盘。实际原生程序使用 E 盘已安装的 DSH NEXT。

| 场景 | 观察结果 |
| --- | --- |
| 受控 worker 和接入能力 | 38/38，覆盖异会话、永久选项、取消待审批请求顺序、断线原请求保留及终态不替代回复收据 |
| 受控 Coordinator → MachineHost → ACP 子进程 | 1/1。同一等待项跨后台重开可读；错误 executionId 拒绝，重复同一回复 ID 返回原收据，变更选择拒绝，续聊保持原 Session |
| Windows DSH NEXT 2.0.24-next，本机原生隔离 | 提交一条只读取新建夹具文件的请求。原 Session 建立并有派发意图，未观测到等待项、正文或可确认终态，任务保持 unknown。仅只读核对原 Session 日志，当前只记录 Session 创建。模型调用与工具执行均未证实，原请求未补发 |
| MCP 读控与事件回归 | 30/30，覆盖原回执、撤权后核对、原事件分页和 stdio 调用范围 |
| 类型检查与用户站 | 桌面类型检查通过，用户站 7/7，构建生成 19 个 HTML 页。整仓文档检查仍有既有归档缺链 2,219 个，其他错误 0 |
| 实际 Windows 包、已安装版本界面和生产 SSH | 尚未验收 |

原始结果文件为 `acp-permission-worker.log`、`acp-permission-routing.log`、`acp-permission-mcp.log`、`acp-permission-site.log` 和 `acp-permission-dsh-live.json`，存于 D 盘项目的 `artifacts/current-scope-20261122/`。
