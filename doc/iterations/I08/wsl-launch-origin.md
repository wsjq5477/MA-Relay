# alpha.60 WSL 启动复验与入口阶段定位

日期：2026-10-25（Asia/Shanghai）。关联I06C/I08-MCP02、AB-F02/F07/F11/F13、M01/M03/M05/M06/M07/M10。承接[原WSL握手](wsl-host-readiness.md)与[alpha.50原始失败](../I06/current-candidate-metrics.md)。本轮只新增诊断/验收器与文档，无产品、协议、持久结构或EXE改动；公开alpha.60、独立alpha.61工作树增量与日常后台分开。模型0，不改关系、原生配置或系统服务，不重启WSL。

## 目标与普通窗口前置

原I06图反馈p95≤100ms继续未准出，后续要求核对普通EXE实际呈现。今天node_repl工具已出现，但两次初始化/观察均返回`-32602`，sandbox-state-meta拒绝当前WSL工作目录；中间kernel reset成功，重试仍同错误。未获得任何应用/窗口对象，输入调用0，不以它声称看到了窗口或测到反馈。遵循computer-use规定的JS入口与重观察流程，没有构造窗口句柄或另建桌面驱动绕开。[工具原始错误及次数](../../../artifacts/wsl-origin/2026-10-25/computer-use-blocker.json)。

源码核对也确认低频操作面尚未收尾：现有TeamWorkspace的registerAgent/createTeam/createRun仍建立小队身份与工作作用域，不能只删除日常页面而使这些前置消失。后续界面收敛需一起处理配置引导、只读审计和原unknown核对，本轮没有将UI改成另一种已完成形态。

因此继续可独立推进的WSL启动问题。旧证据仅有Windows侧退出1、stdout/stderr0字节，不足以判定Linux入口是否执行；本轮给原始探针加首条文件写入，再由Linux本地直接复核，区分入口阶段与纯输出丢失。

## 原始WSL 80样本

[探针](../../../desktop/tests/windows-wsl-origin-diagnostic.cjs)只运行一段固定printf：第一步在自己的Linux临时目录写`WSL_ENTRY`标记，再输出`WSL_ORIGIN_READY`。没有Bridge、Agent、用户文件读取或模型。Windows Node24.18.0，stdin/stdout/stderr为普通pipe，四个条件逐轮交错20次，shell与启动工作目录各只有两个水平；不做失败重试或丢弃样本。

| 条件 | 入口及输出均成功 | 空输出退出1 | Linux直接复核 |
| --- | --- | --- | --- |
| 默认cwd + /bin/sh | **19/20** | **1**（第4轮） | 对应失败没有首条入口标记 |
| 显式--cd / + /bin/sh | **20/20** | 0 | 20份标记 |
| 默认cwd + /bin/bash | **20/20** | 0 | 20份标记 |
| 显式--cd / + /bin/bash | **20/20** | 0 | 20份标记 |

[完整80样本](../../../artifacts/wsl-origin/2026-10-25/origin.json)、[Linux直接复核80/80一致](../../../artifacts/wsl-origin/2026-10-25/linux-entry-audit.json)、[归档79份实际入口标记](../../../artifacts/wsl-origin/2026-10-25/linux-entry-markers/)。失败原样保留，报告status=complete只代表诊断完整，不代表稳定性通过。

该次故障发生在首条Linux入口标记完成前，可以排除“脚本正常执行完，只有Windows侧丢了stdout”这一解释。仍不能区分Windows启动器、WSL服务或Linux exec前后极早退出，也不能由一条失败认定cwd是唯一根因、证明历史11次同因或把加--cd当作产品修复。四条件各20次不是修复前后实验。

## 冻结生产宿主20次

[当前验收器](../../../desktop/tests/windows-wsl-current-startup.cjs)从公开alpha.60 EXE核对完整SHA-256 `d74c711b8475e84834519c8509a12a63351c1864a5ed4c01559588dc1fdc9cf6`，只使用其独立提取/暂存资源；Linux清单version60及rpc、Core desktop-host、bootstrap摘要逐项相符，不拿当前alpha.61解包目录或源码冒充60。两种包布局中bootstrap分别是bridge/bootstrap.sh与linux-package/desktop/electron/bootstrap.sh。

生产20轮在原始80次探针后执行；发行版本就在当前WSL开发环境运行，可能存在预热，不代表发行版冷启动、系统重启或随机配对的修复收益。

Windows系统Node24.18.0 → 原生产HostConnection → Ubuntu内Node22.23.1/MachineHost；20次独立启动，每次并发三个只读environment/snapshot调用。原参数、命令、调度、就绪判断与关闭行为均未替换，仅观察真实流与stdin写入；报告只保留请求ID摘要作唯一性核对，不记录真实用户/原生身份。

| 本轮项目 | 实际结果 |
| --- | --- |
| 独立生产HostConnection启动 | **20/20通过**，失败0，不重试失败业务请求 |
| 并发启动与就绪 | 每轮1个宿主，60条请求全部在原bridgeReady后写入，非法帧0 |
| 原请求 | 60个请求摘要各不相同、无重放；任务/模型提交0，临时目录始终未配置任务 |
| 就绪帧时间 | p50 7604.341ms / p95 8592.175ms / 最大11154.368ms；包含原WSL启动/bootstrap与Core加载，未替代UI状态同步2s指标 |
| 关闭 | 20个原Windows wsl启动进程退出0并逐轮确认；结束后只读扫描与本次冻结路径/临时目录匹配的Linux宿主残留0 |

[完整生产结果](../../../artifacts/wsl-origin/2026-10-25/startup-current.json)、[退出与残留核对](../../../artifacts/wsl-origin/2026-10-25/cleanup-audit.json)。原8项握手/关闭代次/未派发与已派发未知边界回归**8/8**：[TAP](../../../artifacts/wsl-origin/2026-10-25/ready-contract.tap)。原产品请求保护不变，不通过盲重试、固定延时、换ID或清空历史取得通过。

首轮验收器在启动宿主前错误地用bootstrap.sh查询Linux清单路径，资源guard拒绝；当时没有运行宿主。按实际双包布局修正路径后才完成上述20轮，没有放松SHA/清单检查。[首轮guard失败](../../../artifacts/wsl-origin/2026-10-25/startup-driver-initial.log)。

这轮20/20证明指定版本/环境/观察窗口的独立启动通过，不把旧alpha.50的9/20、原始WSL失败或其他平台改成通过。因为原始探针仍出现入口前故障，没有产品改动解释差异，完整WSL稳定性与持续原生连接/故障恢复仍未准出。

## 只读系统线索

当前wsl.exe文件版本10.0.22000.1281，Linux内核5.10.16.3-microsoft-standard-WSL2；当前用户未枚举到MicrosoftCorporationII.WindowsSubsystemForLinux包。按Lxss名称检索未取得可关联的已启用事件通道/事件；未启用日志或读取/发布原始事件消息、账号、命令行。缺少匹配通道不等于系统无错误，不能据此判定唯一系统根因或承诺升级/重启可修复。[只读环境](../../../artifacts/wsl-origin/2026-10-25/windows-environment.json)。

## 验证、交付与未完成

新增CJS脚本lint通过：[lint](../../../artifacts/wsl-origin/2026-10-25/lint.log)。本轮没有产品修改，不新建版本、重打EXE、重跑无关全量或使用真实模型；已有公开包字节与源冻结边界保留。

下一步仍须定位入口前间歇故障的系统错误证据，核对持续连接/故障恢复，以及窗口运行时支持当前WSL工作目录后补普通EXE图样本。不能通过丢弃原始失败、缩小图目录、换成RAF时间或放宽100ms门槛收尾。低频操作面、真实父模型/日常多主、完整原生生命周期、独立LAN/SSH及完整I06C/I07C/MCP02继续未准出。


本轮未改变M01/M03/M05/M06/M07/M10运行设计、架构、数据或协议；只同步当前验收状态与相关模块报告。[分层汇总](../../../artifacts/wsl-origin/2026-10-25/verification-summary.json)、[最终验收器摘要](../../../artifacts/wsl-origin/2026-10-25/scripts-sha256.json)。


最终文档检查0错误、用户站测试6/6及构建通过：18用户页/19HTML，内部页与证据导出0。[文档检查](../../../artifacts/wsl-origin/2026-10-25/docs-check.log)、[测试](../../../artifacts/wsl-origin/2026-10-25/docs-test.log)、[构建](../../../artifacts/wsl-origin/2026-10-25/docs-build.log)。
