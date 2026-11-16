# I08 alpha.76 DSH NEXT 接入与连接面板

2026-11-16，Windows。发布基于远端 master 的维护恢复版本，仅合入本轮 DSH NEXT 支持、独立调用方结果查询、本地打包脚本及 DSH 创造模式生成的可选插件。

## 使用

打开 Bridge 的「接入配置」，点击已安装的 DSH NEXT 的「接入」。使用产品自己的原生登录。Bridge 可为尚未配置的当前 Profile 添加 MCP，已存在的条目和授权保持其原归属。DSH 调用目标需在 Bridge 中明确授权。

DSH NEXT 的「插件 → 添加插件」可安装 [AgentBridge 连接插件](../../../plugins/dsh-agentbridge-connections/README.md)。左侧面板按机器显示授权 Agent、在线和忙碌状态，可刷新。该插件随发布提供独立 ZIP。

## 发布前的本机证据

- 本地候选 `0.6.0-alpha.72.dsh.3` 和 DSH NEXT `2.0.23-next` 使用真实窗口发现并接入，第一次冷启动窗口进程约 174 秒。
- 使用已有授权，DSH NEXT 实际给 Claude Code `2.1.325` 派发一次编码任务，原 Task 成功。首次调用以节点 ID 被拒，以获准 Agent ID 派发。Claude 处理 CommonJS 模块边界后执行测试，3 通过、0 失败，独立复跑一致。DSH 通过 `task_result` 读回同一原任务。原生工具权限逐项确认。
- DSH 创造模式实际生成、安装和打开连接插件，面板刷新获取一个已获准、在线且空闲的本机 Claude 目标。Bridge 委派及请求计数不变。映射测试 9/9。

本机原生结果属于先行候选。冻结包验证和公开分发结果在实际完成后记录。
