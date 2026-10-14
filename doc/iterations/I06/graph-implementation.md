# I06B 节点图与双向协作交付

实施：2026-10-12；最终核对：2026-10-13。**I06B DEV-B01–B05 主要范围完成，开发候选为 0.6.0-alpha.6。** 正式历史 Windows 版本仍为 0.5.0；I06C 与正式 0.6.0 准出未完成。以下区分受控存储、实际输入、真实原生任务和普通 EXE 的证据。

## 实现与范围

| 工作项 | 实现与验收结果 |
| --- | --- |
| DEV-B01 / UI-01/03 | Windows/WSL/SSH 机器组与工具节点；节点/组拖动、平移、缩放、适配/整理；独立布局保存及重开，通过 |
| DEV-B02 / UI-02/04 | 设主、鼠标/键盘端点、删除授权草稿、显式保存；独立修订与稳定收据；冲突保留草稿，unknown 只查原操作，通过 |
| DEV-B03 / UI-01/05 | 机器标签、节点会话目标替换三个关键下拉入口；接入动作、离线/忙/等待/未知/最近失败及同步时刻，通过 |
| DEV-B04 / NET-03 | 当前主新委派与活跃原父旧任务读控分离；换主/清主/新父/伪造/父终态反例，通过 |
| DEV-B05 / NET-03 | Windows Claude ↔ 独立 SSH Linux OpenCode：两方向实际 list_agents/delegate/task_result、子回复与父汇总，通过；最终反向链在原服务恢复后用原请求完成 |

一个默认组、单层委派。节点与关系不绑定模型、供应商或项目；账号/模型/原生权限继承不变，无新模型 API 层。协议仍为 2，图方法在中央运行。I05 的机器/节点/关系/历史 ID 不重建；旧内部保存的裸关系返回兼容，新图始终使用稳定 operationId。

布局与授权分别修订和持久化。中央图意图先落盘，再调用业务；同 lane unknown 不能靠新 ID、另一窗口或目录别名解除。关系及其收据同次原子替换；布局及自己的收据另存。confirmed 只代表元数据保存，不代表任务完成或取消。

## 实际验证

工程与普通包运行于 2026-10-12；最终原请求恢复/核对运行于 2026-10-13。JSON date 为 UTC。跨模块共用案例不重复计数。

| 检查 | 实际结果、环境与边界 | 原始证据 |
| --- | --- | --- |
| 核心工程 | 43/43，通过；根 Node 22.23.1 | [TAP](../../../artifacts/I06B/2026-10-12/root-tests.tap) |
| 桌面工程 | 110/110，通过；含图事务、原父权限、节点状态、就绪等待及确定拒绝恢复；无跳过 | [TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap) |
| 授权/布局故障 | 生产模块、真实文件存储、隔离子进程提交前/后 SIGKILL；原收据对账不重写，通过 | [进程故障](../../../desktop/tests/graph-crash.test.cjs)、[台账](../../../desktop/tests/graph-operations.test.cjs)、[布局](../../../desktop/tests/graph-layout.test.cjs) |
| Windows 图交互 | Edge 154，1440×960/1366×768/1280×720，10 组通过：实际鼠标/键盘、生产中央存储、受控机器；无 SSH/模型调用 | [UI](../../../artifacts/I06B/2026-10-12/ui.json)、[脚本](../../../desktop/tests/windows-i06b-graph.cjs) |
| 图性能 | i5-8600，Windows Edge，20 组/60 节点、20 次 pointer→节点反馈；p95 30.0ms，观察期无 >500ms long task，通过 | [样本](../../../artifacts/I06B/2026-10-12/performance.json)、[脚本](../../../desktop/tests/windows-i06b-performance.cjs) |
| 最终包真实原生链 | 原 profile、原鼠标授权、原请求/上下文，两方向父子 succeeded；人工转抄子结果=0。最终反向恢复是 IPC 核对，不冒充新一轮窗口自动化 | [最终原请求结果](../../../artifacts/I06B/2026-10-12/real-resumed.json)、[原窗口运行及失败](../../../artifacts/I06B/2026-10-12/real.json)、[脚本](../../../desktop/tests/windows-i06b-real.cjs) |
| 普通 Windows EXE | 无 debug 参数，隔离 Windows/WSL 状态；启动、关闭保留同后台、重开布局 3 项通过；native prompts=0 | [普通程序](../../../artifacts/I06B/2026-10-12/portable.json)、[脚本](../../../desktop/tests/windows-i06b-portable.cjs) |
| 最终包完整性 | 27 个后台 CJS、1366 个 Linux 文件；app.asar/前端/版本与源码一致，通过 | [包报告](../../../artifacts/I06B/2026-10-12/package.json)、[构建](../../../artifacts/I06B/2026-10-12/package-build.log) |
| 静态/构建/文档 | 根 lint/typecheck、前端 TypeScript + Vite、完整文档/链接检查，通过 | [lint](../../../artifacts/I06B/2026-10-12/lint.log)、[类型](../../../artifacts/I06B/2026-10-12/typecheck.log)、[前端](../../../artifacts/I06B/2026-10-12/desktop-build.log)、[文档](../../../artifacts/I06B/2026-10-12/docs-check.log) |

真实原生环境：Windows x64 10.0.22000、原窗口 Electron 44.7.0、验收 Node 24.18.0、Windows Claude Code 2.1.296 与独立 SSH Linux OpenCode 2.0.26。恢复核对使用原冻结后台代码和 Node 24.18.0 认证 IPC。原生账号/配置继承；只读诊断与服务恢复不发送模型需求。

10 组界面检查包含真实节点/机器组拖动、键盘组移动和连线、Esc 即时取消、离线边保留、轮询草稿、低修订快照拒绝回退、两种保存丢 ACK 重开原收据恢复、冲突重校验和节点目标。受控机器不能证明真实 SSH；两条原生链另外检查实际 MCP、父子任务、原生 Session 引用及结果标记。

## 实测发现与修复

- 端点拦截 Esc 导致临时线未即时取消；现由图 store 取消连接，实际 preview 已消失后才松鼠标。
- 已确认关系被旧轮询快照回退、撤销边复活；现只采纳更高修订，草稿与确认收据分开。
- 原布局收据恢复后视口未应用，以及首次 parent 尺寸未确定导致子节点夹到组原点/误拖组；现重应用视口并明确组/节点尺寸。[修复前图记录](../../../artifacts/I06B/2026-10-12/ui-before-dimensions-fix.json)。
- OpenCode 启动时监听早于原生元数据/健康心跳；新上下文在 10 秒观察预算内只读轮询，仍未健康在发送需求前拒绝。daemon 原先把执行前 AGENT_UNHEALTHY 误记 unknown；现保存为 rejected，并在原查询中依据旧记录里的这一确定拒绝核对。中央按原 machineId/requestId 接受原拒绝；缺收据/传输未知仍保持占位。新增 4 项回归，观察期间 Prompt=0。[专项](../../../artifacts/I06B/2026-10-12/native-readiness-tests.tap)、[全桌面](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)。

初期驱动 attach IPC 过早出现 ENOENT，未提交模型任务；等待就绪后再 attach。[初次](../../../artifacts/I06B/2026-10-12/real-initial.json)、[就绪竞争](../../../artifacts/I06B/2026-10-12/real-startup-race.json)。布局未知重开时本应锁定自动整理，专项驱动曾错误要求按钮可用，已修正断言；最终 10 组通过。[原驱动失败](../../../artifacts/I06B/2026-10-12/ui-layout-driver.json)。

## 原生服务退出、原请求恢复与清理

最终包正向原生链通过，反向在健康阶段被拒绝，原请求 dispatched=false，未产生反向原生任务。[失败保留](../../../artifacts/I06B/2026-10-12/real.json)。同一 profile 只读检查确认直接与协作原生服务进程均已退出，startupError=NATIVE_UNAVAILABLE；原生服务恢复后健康且沿用同一配置，旧任务数不变。[元数据](../../../artifacts/I06B/2026-10-12/native-metadata.json)、[原上下文恢复](../../../artifacts/I06B/2026-10-12/native-restart.json)。服务器约 1.83 GiB 内存，恢复后可用约 238 MiB；退出原因未核实为 OOM，不猜测。

核对没有在途或 unknown 原生任务后，恢复原上下文服务，再使用原 requestId/同内容完成反向委派；没有创建替代节点、目录或请求。原父子均 succeeded，实际调用三个工具，原允许关系保持。验证驱动曾把执行前尚未写入的 contextId 当作已有绑定断言，实际任务已经成功；后续仅查原结果与摘要完成核验，不再次提交。[原驱动断言](../../../artifacts/I06B/2026-10-12/real-resumed-driver.json)、[最终结果](../../../artifacts/I06B/2026-10-12/real-resumed.json)。自动恢复异常退出原生服务的全矩阵留在 I06C，本轮不能标为自动恢复已验收。

修复前另一个异常样本的原本机父任务后来终态；身份核对远端原生任务为零、剩余错误仅为执行前 AGENT_UNHEALTHY 后停止隔离 daemon，原 unknown 收据保留在原 profile，不清空占位。[原失败及清理](../../../artifacts/I06B/2026-10-12/real-before-readiness-fix.json)。本次成功样本清理也先核对所有原父子任务终态，再停止所属测试后台/空闲原生控制器；残留隔离测试窗口曾再次拉起后台，最终先停止路径完全匹配的测试副本进程，再停止所属后台；原中央、远端 daemon 与两个原生控制器均已只读确认离线。实际结果见最终报告 cleanup，不停止用户原 profile 或非所属进程。

## 交付与后续

[AgentBridge-0.6.0-alpha.6-Windows-x64.exe](../../../desktop/release/AgentBridge-0.6.0-alpha.6-Windows-x64.exe)，129,579,616 字节，SHA-256 `02edf4a820d95e1223e067a01c383ce1a2833f7d1c70d6c13a2fc671b0357dcd`；Linux manifestDigest `56283b8348e8cf698773a1ffeb4a6b1c76e3db466d2956d4a84f5d0ce19d5bdd`。

保留可信 alpha.2–alpha.5 manifest，不自动升级用户原远端。旧中央后台仍运行时，直接打开新 EXE，从“设置 → 后台运行 → 停止后台并退出”停止旧中央，再打开新 EXE；不需要旧程序，不删除机器、节点和历史。

下一阶段 I06C：完整恢复/游标与故障指标、连接编辑/移除、版本切换/回滚及正式准出。真实文本协作不替代全部权限/表单/取消、文件任务和网络故障矩阵。历史 Windows Codex 账号与 WSL Codex list_turns 续聊限制继续保留；系统 OpenSSH agent 服务、无 Node 独立服务器整条安装和全部发行版仍按 I06A 专项限制保留。

复现：npm test；npm test --prefix desktop；npm run desktop:build；node scripts/check-docs.mjs。图依赖锁定 @xyflow/react 12.12.0，参考官方 [组件](https://reactflow.dev/api-reference/react-flow)、[端点](https://reactflow.dev/learn/customization/handles)、[机器组](https://reactflow.dev/learn/layouting/sub-flows)。

## 后续 alpha.7 图交互优化

2026-10-13，当前候选增加主角色强调、方向端点简化、卡片避让与全图中键平移。alpha.6 上表证据保留原版本；最新专项与当前包见 [alpha.7 交付](graph-usability.md)。

## 2026-10-13 节点管理增量

I06-UI/机器节点增量：合并重复的机器/协作页，按机器添加已安装 Agent、明确断开/移除及原身份恢复。节点状态与撤权原子提交，忙碌/未知/离线拦截，回应未知只读查询原 ID；原生安装与历史保留。需求、开发、逐项实际验收和未测范围见 [alpha.9 记录](node-management.md)。不将节点移除扩大为 I06C 的机器移除/卸载。

## 2026-10-13：I06C 首批机器管理

2026-10-13 / alpha.10：机器 SSH 连接编辑、确认断开/移除、原身份恢复、已观察历史持久化/阅读及事件游标缺口分页补偿已实现；桌面 136/136、真实本机 TCP SSH/生产 daemon 隔离恢复和 Windows 界面分别通过。完整 I06C、升级回滚和正式 0.6.0 未准出。 用户已批准进入 6C；需求、实现、分层实测、失败记录与下一批范围见 [当前报告](machine-management.md)。本次未重跑 alpha.6 独立双向原生链，旧报告保留原日期/版本。
