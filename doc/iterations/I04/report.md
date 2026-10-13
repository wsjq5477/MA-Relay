# I04 Windows 桌面交付报告

日期：2026-10-09。状态：Windows 桌面看板首版已实现；本机 Windows/WSL 的功能与程序启动验收通过，待用户实际使用复核。

## 可直接使用的产物

- Windows 便携版：AgentBridge-0.4.0-Windows-x64.exe，108.0 MiB。已复制到本机 C:\Users\jiqi\.codex\visualizations\2026\10\08\redacted-id 目录。
- 仓库构建产物：[EXE](../../../desktop/release/AgentBridge-0.4.0-Windows-x64.exe)；[使用说明](../../../desktop/README.md)。解压版在 desktop/release/win-unpacked，须保留完整目录。
- SHA256：`198e3fe130541cf69cdc9ee387fe21b4645aca7d2545d2d184d66520e15cca91`。代码/产物摘要见 [I04-build.json](../../../artifacts/I04-build.json)。

双击 EXE 即可打开，不需要 Windows Node 或常驻终端。程序加载当前 WSL 用户的 Bridge 默认实例；首次空配置扫描 OpenCode，空格勾选工具并选择项目后连接。模型与认证沿用原生配置，真实回复验证由用户明确触发。

## 交付与证据

| 增量/功能 | 本轮实际验证 |
| --- | --- |
| M1：桌面与连接 | Windows win32 进程、1280×860 窗口；五页导航；浅色/深色；真实 WSL 连接；空配置发现/空格连接，模型任务数 0 |
| M2：任务与会话 | 看板分栏、详情、结果、两轮真实 OpenCode，同一 Session 保持上下文且第二轮回答独立；关闭重开无新增 Prompt；UI/CLI 状态与回答一致 |
| M3：权限与控制 | 实际 edit 授权后修复示例乘法，示例测试通过；权限等待取消后未写入请求的注释；取消弹窗 Escape 不关闭父抽屉；无 renderer 错误 |
| 不明操作保护 | 主进程测试：未知阻止新 ID 和实例切换、查询原请求后恢复、明确校验拒绝不误锁、保留未确认记录、诊断不含凭据/任务内容；3/3 通过 |
| 刷新指标 | 20 次后台确认至窗口可见，p95 1444 ms，最大 1481 ms，目标 ≤2000 ms 通过 |
| 工程 | 根 typecheck/lint/build、桌面 typecheck/Vite/build 通过；后端 42/42 测试；桌面主进程 3/3；桌面及后台运行依赖漏洞数 0 |
| 最终便携包 | 正常启动，无调试参数；实际 Windows 窗口标题 AgentBridge，renderer 收到真实连接快照；本次启动观测 14.5s，含便携解包与 WSL 冷启动，不属于 2s 刷新指标 |

[真实任务与刷新报告](../../../artifacts/I04-acceptance.json)、[真实窗口交互报告](../../../artifacts/I04-windows-real.json)、[最终便携版正常启动报告](../../../artifacts/I04-windows-startup.json)、[初始五页/主题报告](../../../artifacts/I04-windows-smoke.json)。

实际验收截图：[任务看板](../../../artifacts/I04-windows-real-board.png)、[连续会话](../../../artifacts/I04-windows-real-conversation.png)、[权限卡片](../../../artifacts/I04-windows-real-permission.png)、[深色主题](../../../artifacts/I04-windows-dark.png)。截图来自实际 Windows 窗口中的独立验收实例，未向日常实例塞入演示任务。

真实任务验收使用 OpenCode 2.0.24、csi-provider/DeepSeek-V4.1-Flash，仅覆盖临时示例配置。日常实例仍为原 controller/native 进程，当前模型 opencode/exo-free、空闲、任务数 0；没有替用户切换模型或发起日常项目任务。

## 支持范围与测试限制

当前是 **Windows x64 桌面 + WSL 后台**，WSL 需要 Node 22.13+ 与 OpenCode 2。Windows 原生后台、ARM64、跨设备、托盘、自动升级、代码签名、智能主 Agent 委派及全量历史分页不属于本轮交付。看板展示最近 100 项任务。复杂原生表单的最终约束由既有后台验证；本轮真实 Windows 自动操作重点覆盖权限授权与等待取消。

真实任务自动交互验收针对解压版；最后新增的不明操作保护通过隔离主进程测试，最终便携包通过无调试接口的正常启动/健康快照检查，没有在最终包重新发真实模型任务。

便携版 CDP 调试附加请求被自动审批拒绝，原因是会暴露已认证的 WSL/Agent 会话；已停止失败测试的调试进程，使用正常启动方式完成最终检查。WSL 互操作通道曾返回 UtilAcceptVsock 错误，使用仍可用的现有通道完成检查，没有重启 WSL 或停止日常服务。
