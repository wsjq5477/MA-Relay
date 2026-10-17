# I07C：自动主角色首轮的真实权限等待

日期：2026-10-16。alpha.24源码工作区，GitHub预发布仍alpha.23，本地alpha.24候选保持原包。本次在[手动权限证据](native-permission.md)上新增真实自动激活验收脚本，没有改产品源码或发布包。关联I07-R08/09/10/11/12、AB-F07/09/10/11/20/22、M02-F10、M06-F04/M06-CC-F01、M07-F10、M08-F09。

## 1. 需求和边界

由用户设置自动成员/预算后，Bridge事件激活真实Claude主角色。其原生工具权限必须仍由原任务通道处理，不能因自动协作或小队角色而绕过。等待期间观察后台重启应保持原attempt、权限等待和去重通知；允许一次或拒绝之后，只核对原生真实终态，不伪造总工作成功。

本次限定自动主角色的首次激活，不涉及执行成员、返修轮续接或多机器。测试每项工作预算为1次激活、20分钟、无进展间隔120分钟；既核对attempt/used，也直接检查持久事件列表只有已消费的user_start、pending为0，避免仅靠次数上限掩盖额外唤醒事件。

## 2. 新增开发与安全恢复

新增[linux-i07c-auto-permission-native.cjs](../../../desktop/tests/linux-i07c-auto-permission-native.cjs)。复用生产Coordinator/AgentNetwork/MachineHost/ClaudeHost与原生账号配置，两个独立工作分别允许和拒绝。脚本只调用configureAutomation启用事件调度，不调用team.execute（manualNativeStarts=0）。目标限定为私有隔离profile中的精确Write文件，不批准Bash或其他文件目标。

原权限请求始终从原机器/task/execution读取；等待时重启观察后台再查询原记录，确认action=Write且resources包含精确隔离目标才允许一次。控制操作ID稳定，同一回应读取原收据。完成场景再次运行只查原用户操作、原attempt和文件事实；不重置profile、替换ID或重复调用模型。原生工具事件只允许Write及限定公共上下文读取/普通报告/阅读回执，禁止使用其他执行工具绕过拒绝。

本次没有修改architecture/data-model/protocol合约、状态格式、自动授权或原生适配行为；已核对这些资料。更新的是可依赖证据、模块设计/报告与迭代验收边界。

## 3. 实际验证

环境：WSL Linux / Node22.23.1 / 真实Claude Code2.1.299，生产事件激活与SQLite，原生默认配置，无模型API层，非受控模型回复。未使用用户默认profile或独立SSH。

| 范围 | 实际结果 |
| --- | --- |
| 真实事件激活与等待 | 2个自动原生回合，手动原生启动0；每项工作attempt1条、automatic=true、used=1；均实际产生权限等待 |
| 观察后台重启 | 原attempt/等待保留，每轮等待通知1条；没有重派原请求 |
| 允许一次 | 精确隔离Write后原任务succeeded，文件标记一致，等待清除，工作仍active |
| 拒绝 | 原任务failed、目标不存在；工具日志没有其他执行工具或第二次Write，工作仍active |
| 事件与恢复核对 | 每项工作只有user_start已消费、pending=0；完成后重查未新增attempt，原生Write合计2次、权限控制命令合计2次 |

完整[最终报告](../../../artifacts/I07C-auto-permission/2026-10-16/native.json)与[恢复检查输出](../../../artifacts/I07C-auto-permission/2026-10-16/recovery.log)。三项检查覆盖以上场景，共两次真实模型调用，不把检查数当模型数量或全工程计数。

首次真实执行已完成两轮，但最后工具检查遗漏合法team_messages/普通报告，断言失败；保留[首次报告](../../../artifacts/I07C-auto-permission/2026-10-16/native-initial-harness-failure.json)和[原日志](../../../artifacts/I07C-auto-permission/2026-10-16/native.log)。首次恢复检查又发现遗漏合法team_acknowledge，保留[恢复失败](../../../artifacts/I07C-auto-permission/2026-10-16/recovery-harness-failure.json)。修正验收脚本的合法协作工具清单后，只查原任务和工具/命令日志，最终通过；没有换ID重跑模型，也没有为使测试通过扩大产品权限。两次失败来自验收脚本断言，不归因于环境或原生产品。

复现：`node desktop/tests/linux-i07c-auto-permission-native.cjs`。首次会启用两次真实自动原生回合，批准范围仅脚本隔离Write；完成后重复运行只核对原记录。原始profile及测试文件保留在本地忽略目录，不删库重试。`node --check`和`git diff --check`通过，文档结构检查见[输出](../../../artifacts/I07C-auto-permission/2026-10-16/docs-check.log)。无产品代码变化，本次未重复全量工程、Windows构建或发布。

## 4. 后续范围

自动主角色首轮权限链本机通过，不等于原生执行成员自动交接/续接中的权限等待、多次权限交互、表单、Windows真实模型/界面批准或独立SSH已验收。下一片继续真实执行成员及原会话后续轮次，完整I07C/I06C未准出；原预发布与本地候选文件保持不变。
