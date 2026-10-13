# I06B alpha.8：旧后台拖动锁定与主节点居左

日期：2026-10-13。**alpha.8 本页功能与候选包专项验收完成。** 范围：I06-UI-01/03/04、AB-F16、M01-F04/F09、M10-F01/F02/F03/F06；同步 M04/M05 兼容资源版本。稳定历史版仍为 0.5.0，I06C 与正式 0.6.0 准出未完成。

## 原因与需求

用户反馈 alpha.7 仍不能平移画布，也不能移动 Agent 或机器组，并要求主 Agent 放在最左侧。

认证 IPC 只读核对原 Windows profile：中央实际运行 alpha.5，3 台机器/6 个节点，主节点在 WSL；graphLayout 与 graphPending 均返回 DESKTOP_ERROR /“桌面请求不合法”。18 条任务是 14 succeeded、4 failed；没有重启、变更授权或提交需求。[实际诊断](../../../artifacts/graph-drag-fix/2026-10-13/user-readonly.json)。旧调试端口失效，当前 WSL 的 Computer Use 初始化失败；原用户窗口未能直接观察，不将日志或受控窗口称为对原窗口的视觉实测。

alpha.7 图把 `loaded=false` 当作所有拖动的共同锁。旧后台拒绝读取布局后，loaded 一直为 false，所以 Agent/组 draggable、中键及空白平移均被禁用；顶部却显示“布局已保存”。用真正 alpha.7 打包 Electron、认证 IPC 与匹配原拒绝的受控旧接口复现两项，通过复现判断：[报告](../../../artifacts/graph-drag-fix/2026-10-13/before.json)。此前 alpha.7 浏览器鼠标与普通 EXE 生命周期没有覆盖这一版本混用场景。

## 最终行为

| 需求 | 实现与边界 |
| --- | --- |
| 布局读取失败仍能查看/移动 | 进入本机布局模式；Agent 可在所属机器内移动，机器整组移动，空白左键和中键平移；浏览器缓存保存本机坐标与视口，重开可恢复。明确提示未与后台同步，不写后台、不伪造 confirmed |
| 明确旧后台限制 | 展示错误与恢复指引、“重新读取后台布局”；禁用需要图事务的新授权编辑，不影响原会话入口。支持接口恢复后保留本机布局，以正常 operationId/修订保存；修订真实冲突需显式重校验 |
| 未确认写入仍安全锁定 | 原 layoutPending/operationId 始终保留，读取失败不能作为解除 unknown 的证据；该 lane 继续锁定布局拖动，仅查询原收据，不新写或换 ID |
| 容易拖动机器 | 机器标题和背景区域均可左键拖动；Agent 卡片与端点保留各自交互，组移动不改工具相对坐标或来源身份 |
| 中键释放可靠 | 使用 pointer capture，移出画布松开也结束手势；移动只改变视口 |
| 主 Agent 最左侧 | 初始缺省布局及“自动整理”先排主节点所属机器，主节点在组内优先。已保存/手动坐标保持，轮询和切主不强行重排；整理是明确用户动作 |

代码：[图与输入](../../../desktop/src/AgentGraph.tsx)、[编辑与保存状态](../../../desktop/src/graph-state.ts)、[样式](../../../desktop/src/graph.css)。布局、授权、任务与原生配置仍分离，不增加模型 API 或新的执行层。

## 验证

工程与真实打包窗口分别记证据；受控旧接口不是对原用户 profile 的写入，也不证明新 SSH/模型回复。本次运行于 2026-10-13，JSON date 为 UTC；Node 22.23.1，Windows Edge 154 / Electron 44.7.0，前端是生产 bundle。根源码未改动，43/43 是 alpha.6 历史基线。

| 检查 | 实际结果与证据层级 | 原始记录 |
| --- | --- | --- |
| 原 profile 诊断 | 认证 IPC 只读，实际中央 alpha.5、图方法拒绝；机器 3 /节点 6 /任务终态 18 | [诊断](../../../artifacts/graph-drag-fix/2026-10-13/user-readonly.json) |
| alpha.7 实际窗口复现 | 真实打包 Electron + 认证 IPC、受控旧接口，2 项复现拖动锁定；无模型任务 | [复现](../../../artifacts/graph-drag-fix/2026-10-13/before.json) |
| alpha.8 实际窗口 | 7 组通过，Agent/机器背景/两种平移与捕获释放、本机重载、支持恢复及主居左、真实丢 ACK 与原收据；受控机器、真实中央文件存储 | [窗口](../../../artifacts/graph-drag-fix/2026-10-13/electron.json)、[脚本](../../../desktop/tests/windows-graph-drag.cjs)、[截图](../../../artifacts/graph-drag-fix/2026-10-13/electron-drag-light.png) |
| 生产前端回归 | Windows Edge 实际输入，原图 10 组、新主角色/避让/中键 6 组通过；受控机器 | [10 组](../../../artifacts/graph-drag-fix/2026-10-13/ui.json)、[6 组](../../../artifacts/graph-drag-fix/2026-10-13/usability.json) |
| 工程回归 | 桌面 116/116，通过；故障进程与 socket 属于受控工程，非原生模型验收 | [TAP](../../../artifacts/graph-drag-fix/2026-10-13/desktop-tests.tap) |
| 密集图性能 | i5-8600、Windows Edge 生产前端、20 组/60 节点/59 边，20 次 pointer→变换反馈 p95 40.0ms，观察期无 long task，通过 | [样本](../../../artifacts/graph-drag-fix/2026-10-13/performance.json) |
| 类型/前端构建 | 根 TypeScript、前端 TypeScript/Vite，通过 | [构建](../../../artifacts/graph-drag-fix/2026-10-13/build.log) |
| 普通 portable EXE | 无 debug 参数，隔离 Windows/WSL profile；启动/冻结模块、正常关闭保留同中央、重开布局 3 项通过，native prompts=0 | [普通程序](../../../artifacts/graph-drag-fix/2026-10-13/portable.json)、[脚本](../../../desktop/tests/windows-i06b-portable.cjs) |
| 解包资源 | 27 CJS、1368 Linux 文件、版本/窗口模块/前端与源码一致，通过 | [资源](../../../artifacts/graph-drag-fix/2026-10-13/unpacked.json) |

真实窗口用隔离 Windows 本地资源副本启动，带 Playwright 调试连接；它不是普通无 debug EXE 证据。普通 EXE 和最终 portable 资源另记，不把浏览器或解包目录运行冒充 portable。

[Electron 脚本](../../../desktop/tests/windows-graph-drag.cjs)检查旧后台下 Agent、机器背景、两种平移与出界释放、本机恢复、支持接口恢复同步、主节点居左和原丢 ACK 保护。首次从 UNC 运行 Electron 退出，改用隔离 Windows 本地完整资源副本；首次原收据驱动把先前已完成操作的合法查询算入当前 unknown，已按场景时间段核对。保留失败，不更换当前原操作。

## 合约与资料

IPC/protocol 2、layout version 1 与服务端收据格式不变。本机编辑能力和后台可用状态分开；缓存结构仍保留原 State 与所有 pending ID，不能充当授权或原生成功证据。旧后台的 graph 方法拒绝只证明这次只读方法不支持/失败，不能推广为别的在途需求未执行。M01、整体功能、架构/缓存说明/协议和迭代基线同步。

alpha.7 manifest 先与原交付 digest 核对，再加入 alpha.8 可信资源，继续精确复用 alpha.2–alpha.7；不自动升级原远端。M04/M05/M10 同步当前资源，真实 SSH/原生模型矩阵保留原版本。

## 后续与原窗口

旧程序仍运行时，先正常关闭旧窗口，再打开新 EXE；关闭窗口不停止后台。图的本机移动在旧后台下也可用，后台图保存与授权编辑需支持图事务的后台。用新窗口“设置 → 后台运行 → 停止后台并退出”，再打开新 EXE 可以加载当前后台；已有机器、授权及历史保留。不要在有任务执行/回应未知时将停止旧后台当作释放原操作的方法。

本次对原 profile 的检查是只读；程序验收使用隔离 profile，没有停止用户原后台或升级远端。I06C 的完整恢复/指标、连接编辑/移除及正式升级回滚准出仍未完成。

## 当前交付物

[AgentBridge-0.6.0-alpha.8-Windows-x64.exe](../../../desktop/release/AgentBridge-0.6.0-alpha.8-Windows-x64.exe)，129,589,156 字节，SHA-256 `9ebfbb03210340bb009f601f4bcf0df27b1510bd27bbe8fd9bb919a4662d29c2`。Linux manifestDigest `9c41b44fbd83ae0d397ffa5cadfae6265d257d7689799b4bd6381f13e6a8cd2f`。最终 portable/解包资源、app.asar、全部 27 CJS、1368 个 Linux 文件及前端/版本与源码一致，通过：[包报告](../../../artifacts/graph-drag-fix/2026-10-13/package.json)、[构建日志](../../../artifacts/graph-drag-fix/2026-10-13/package-build.log)。

复现：`npm test --prefix desktop`、`npm run desktop:build`、`node scripts/check-docs.mjs`；Windows Node 运行 `desktop/tests/windows-graph-drag.cjs after`（当前 win-unpacked 的独立本地副本与受控旧接口）。原 alpha.7 复现报告已固定，当前解包目录不可冒充旧包再次复现。浏览器测试指定生产前端 URL 和独立 `AGENTBRIDGE_GRAPH_REPORT_DIR`，普通 EXE 用 `AGENTBRIDGE_PORTABLE_REPORT` 定向本次记录，避免覆盖历史。

受控 Electron 窗口/浏览器及 fixture 已关闭，普通 EXE 测试正常关闭所属窗口并 shutdown 所属隔离中央；未停止用户原后台。生产前端测试服务在交付检查后停止。文档完整性/链接检查见 [日志](../../../artifacts/graph-drag-fix/2026-10-13/docs-check.log)。
