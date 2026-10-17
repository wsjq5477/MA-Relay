# I07C：自动主角色原会话续接后的权限等待

日期：2026-10-17（原始JSON时间为UTC 2026-10-16）。alpha.24源码工作区，GitHub预发布仍alpha.23、本地alpha.24候选保持原包。本次新增真实原生续接验收脚本，不修改产品协议或发布物。关联I07-R08/09/10/11/12、AB-F07/08/09/10/11/20/22、M02-F10、M06-F04/M06-CC-F01、M07-F10、M08-F09。

## 1. 验收目标与开发

[上次首轮权限验证](auto-native-permission.md)分别在两项工作验证自动首轮允许/拒绝，没有覆盖同一原生Session的后续轮次。本次在同一工作内分两阶段：用户群消息给出阶段1精确Write目标/标记，启用自动主角色；阶段1真实成功后，用户保存不同阶段2目标/标记并发出明确协调事件。Bridge应在原Conversation/原生Session继续，不能重做阶段1；阶段2必须再次等待其自己的原生权限。

新增[linux-i07c-resume-permission-native.cjs](../../../desktop/tests/linux-i07c-resume-permission-native.cjs)。采用生产Coordinator/AgentNetwork/MachineHost/ClaudeHost及真实Claude CLI。自动预算2次/20分钟、无进展检查120分钟，脚本没有手动team.execute调用。每阶段都先观察实际权限等待，重启观察后台，再用原task/execution/permission及稳定operationId回应。只批准脚本自身隔离文件的精确Write；不批准Bash/其他文件工具或修改原生配置。

阶段2分别核对taskId/requestId不同、Conversation及实际native Session相同；原生身份仅私有比较，不公开到报告。完成场景重跑脚本只读原操作/执行/文件及命令日志，不换ID，不重新创建工作或激活。最后核对仅user_start和attention两个持久事件、pending=0，累计used/attempt/Write/权限命令各2。普通群消息不触发下一轮，阶段2只由明确attention推进。

无产品架构、持久格式、协议或权限行为变更；已核对architecture/data-model/protocol，未新增合约。同步模块能力证据与迭代验收状态，不扩大原候选包或发布基线。

## 2. 实际结果

环境：WSL Linux / Node22.23.1 / Claude Code2.1.299，真实模型与原生账号配置，非模拟回复；用户默认profile及独立SSH未使用。

| 场景 | 实际结果 |
| --- | --- |
| 阶段1事件启动 | 自动激活、真实permission等待，目标写入前不存在；观察后台重启后原等待/attempt保留，通知1条；允许后succeeded且标记匹配 |
| 阶段2原会话继续 | 明确协调事件后生成新的原task/request，Conversation与实际原生Session保持相同，未改模型或另开Session |
| 后续轮次权限 | 阶段2再次真实等待Write权限，目标写入前不存在；重启观察后仍按原等待回应；允许后succeeded且第二文件标记匹配 |
| 去重和业务边界 | 手动原生启动0；每阶段等待通知1条；总激活/attempt/Write/权限命令各2，事件仅user_start/attention且pending0；两个阶段结束后总工作仍active |
| 完成后恢复核对 | 再次执行脚本只查原记录，两份隔离文件及同原生Session事实保持，未增加模型或控制调用 |

完整[最终JSON](../../../artifacts/I07C-resume-permission/2026-10-17/native.json)、[恢复核对输出](../../../artifacts/I07C-resume-permission/2026-10-17/recovery.log)。本次三项检查通过，只有两次真实自动原生回合；不跨模块重复计数，也不是全工程测试数。首次原始运行日志保留于本地artifacts同目录；最终JSON的sameSessionAsPrevious首阶段null表示没有前一轮，第二阶段true为实际比较结果。

复现：`node desktop/tests/linux-i07c-resume-permission-native.cjs`。首次调用真实模型并写自己的隔离测试文件；已完成场景只查原收据/任务。未知或失败保持原profile，不删库换ID重做。`node --check`、`git diff --check`通过；`node scripts/check-docs.mjs`结果见[检查输出](../../../artifacts/I07C-resume-permission/2026-10-17/docs-check.log)。本次无产品代码改动，未重复全工程、Windows构建或发布。

## 3. 剩余边界

本机真实自动主角色从首轮到原会话续接的两次权限等待/允许已验证；拒绝后的failed证据仍引用上次首轮专项，本次第二阶段没有测试拒绝。真实执行成员自动交接、Windows真实模型/界面审批、独立SSH、多个并发权限/表单和长时故障矩阵仍未验收。完整I07C/I06C未准出；下一片继续执行成员与真实多角色链。
