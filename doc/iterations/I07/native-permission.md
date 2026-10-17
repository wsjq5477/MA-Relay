# I07C：真实Claude权限等待、允许与拒绝

日期：2026-10-16。源码工作区alpha.24，本地候选alpha.24/GitHub预发布alpha.23保持原文件。本次新增可恢复的真实原生验收脚本和验证证据，没有修改产品执行协议或构建新EXE。关联I07-R08/10/11/12、AB-F07/09/10/11/20/22、M06-CC-F01、M07-F08/F10及M08-F09。

## 1. 验收需求

补齐[等待可见性](native-waiting.md)的本机真实原生证据：Claude实际请求Write权限时，小队应显示等待，观察后台重启不丢原请求或重复通知；允许一次仅作用于指定隔离文件，拒绝后不得写文件或改用其他工具绕过。权限收据confirmed与原执行真实终态、总工作业务验收必须分开。

使用已有原生账号/模型配置，未新增模型API、修改全局权限或将其他配置覆盖为自动批准。仅按已授权验收范围允许脚本自己的隔离文件Write，不批准Bash或其他目标。每个场景为手动启动的原生一轮，不把它描述为自动激活链。

## 2. 开发与恢复

新增[linux-i07c-permission-native.cjs](../../../desktop/tests/linux-i07c-permission-native.cjs)，经过生产Coordinator/AgentNetwork/MachineHost/ClaudeHost/真实Claude CLI。持久隔离profile固定保存于本地忽略目录，用户操作先查稳定原operationId；不重置profile、另换ID或复制原生会话。

脚本分允许和拒绝两个工作，均在等待时重启观察后台，再查询原task/execution/permission回应。只有action为Write且resources明确包含脚本自己的精确目标时，才发送本次允许。回应使用稳定控制operationId；重复读取相同回应得到原收据。输出报告只保留类别/数量/结果/版本，不公开原生Session、权限ID、认证或工具参数。

已完成场景再次执行脚本只查原操作、原任务与隔离文件事实。尚未完成或回应未知的场景保留原记录；不能通过删除报告/profile或更换请求重新验证。若原生未实际产生等待，脚本失败而不伪造通过。私有状态及隔离测试文件保留以便核对。

产品架构、状态格式、协议、模型层均未改变，已核对architecture/data-model/protocol，本次无需新增合约。同步受影响模块的能力证据、整体测试及迭代路线，历史记录保留原日期。

## 3. 实际结果

环境：WSL Linux / Node22.23.1 / Claude Code2.1.299，原生配置继承，生产后台及真实模型，非模拟回复；用户默认profile和独立SSH未使用。

| 场景 | 实际结果 | 证据 |
| --- | --- | --- |
| 真实等待与观察后台恢复 | 两个场景都产生permission等待，写入前目标文件不存在；重启后原attempt和等待仍在，每轮通知1条 | [首次报告](../../../artifacts/I07C-permission/2026-10-16/native-first.json) |
| 允许一次 | 精确隔离Write获批，原生真实succeeded，文件内容等于预期标记；等待清除，总工作仍active | 同上 |
| 拒绝 | 原生真实failed，目标文件不存在，没有替代轮次；等待清除，总工作仍active | 同上 |
| 完成后重复运行 | 两个场景均只查询原记录，attempt各1条，两个权限控制命令累计仍为2，原生工具记录合计2次且均为Write，未调用其他工具或新增模型轮次 | [恢复核对报告](../../../artifacts/I07C-permission/2026-10-16/native.json)、[运行输出](../../../artifacts/I07C-permission/2026-10-16/recovery.log) |

首次真实执行的三项检查通过，共两次真实原生调用；恢复核对没有新原生调用。不是3个模型Agent，也不是全工程测试总数。首次原始输出见[日志](../../../artifacts/I07C-permission/2026-10-16/native.log)。

复现：在仓库根通过已安装Node执行`node desktop/tests/linux-i07c-permission-native.cjs`。首次会调用真实模型、只对自己的隔离测试文件执行指定Write；原始profile存在时沿原操作查询。`node --check desktop/tests/linux-i07c-permission-native.cjs`、`git diff --check`通过，文档检查见[结果](../../../artifacts/I07C-permission/2026-10-16/docs-check.log)。本次无产品源码修改，不重复全工程或Windows打包；既有alpha.24工程/包证据仍引用[停止专项](native-stop.md)，不冒充本轮重跑。

## 4. 仍未覆盖

本机手动原生回合的真实权限链已验证；自动原生成员在持续调度中的权限等待、Windows真实模型/界面审批联动、独立SSH、输入表单和多成员真实自动交接仍未测。拒绝不是取消，未把本次failed当作停止工作。完整I07C/I06C继续未准出，alpha.23附件和本地alpha.24 EXE均未替换。
