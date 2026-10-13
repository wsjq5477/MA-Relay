# I06B alpha.9：合并机器页面与节点管理

日期：2026-10-13。范围：AB-F01/F03/F11/F12/F16，M01-F01/F02/F03/F04/F09、M02-F04、M03-F01/F02/F03/F05/F06/F07、M07-F01/F02/F06/F07、M08-F01/F06、M10-F01/F02/F03/F06。稳定 Windows 仍为 0.5.0；I06C、机器连接编辑/移除、正式 0.6.0 准出没有因节点管理完成而完成。

## 需求

用户反馈“机器与 Agent”和“协作关系”两个页面重复，同时缺少每台机器的增加、删除、断开 Agent 功能。保留“机器与 Agent”一个入口，将图、授权草稿、向主 Agent 发需求和最近委派放在同页；任务看板、会话、设置继续独立。

增加 Agent 表示接入目标机器上已安装、扫描发现的受支持原生工具。沿用原生账号与配置，既不创建虚构节点，也不要求项目、模型或供应商。

## 行为与实现

| 用户操作 | 结果和边界 |
| --- | --- |
| 机器组的“添加 Agent” | 列出这台机器的名称、版本、安装位置与接入状态，可重新扫描、添加并接入；已接入项显示“已接入”；已移除项显示“重新添加” |
| 节点“断开” | 明确确认后禁止通过 Bridge 接收新需求，保留卡片和原生上下文。相关子授权撤销；若为主节点，同时清除主节点和子授权 |
| 节点“移除” | 明确确认后隐藏图卡片，保留稳定身份、安装、原生配置、上下文、请求、任务、会话、委派与布局坐标；按原身份恢复，不自动恢复协作授权 |
| 重扫、重开 | 明确管理过的节点以中央 managed/connected/removed 状态为准。原生上下文报告 connected 或重扫发现安装不能把已断开/移除项自动接回 |
| 忙碌或未知 | 全实例 busy/currentTask、节点非终态任务、未确认派发、启动中的执行与目录锁共同拦截。来源机器离线时需先恢复以核对执行；不能换节点/目录别名释放占用 |
| 原生 pending 与授权 pending | 中央检查来源机器原生操作台账。节点与授权共享安全屏障，任一未确认写入阻止新的节点/授权写入；独立布局仍可编辑 |
| 节点回应丢失 | 提交前保存原 operationId，中央另存 node lane 意图。重开/另窗口按原收据查询，不重发；not_found 不释放未知。界面明确显示核对并暂停节点/授权编辑 |
| 旧后台 | snapshot 缺少 nodeManagement 能力时禁用节点写入，添加对话框显示从设置停止旧后台并重开新版的说明；现有图的本机布局模式保留 |

中央 `manageNode` 是本地接入权限元数据事务。它不取消原生任务、不停整台机器的通道、不删除原生安装/配置。断开/移除必须在节点空闲并可核对时执行；旧任务查询与原父读控仍回原机器。原始 IPC submit/continue/verify 同样检查节点接入状态，不能绕过卡片控制执行。

AgentNetwork 将节点状态、必要的授权 revision 递增和原节点收据写入同一个 agent-network.json 原子提交；落盘失败不提交内存。GraphOperationJournal 记录 node 意图、查询 nodeOperation；只有确认或确定拒绝才完成意图。节点变更期间加接入锁，防止与新需求并发。没有新模型 API、供应商绑定或原生配置写入。

代码：[页面](../../../desktop/src/NetworkApp.tsx)、[节点输入](../../../desktop/src/AgentGraph.tsx)、[前端原意图](../../../desktop/src/node-management.ts)、[节点事务](../../../desktop/electron/agent-network.cjs)、[中央入口](../../../desktop/electron/coordinator-service.cjs)、[意图屏障](../../../desktop/electron/graph-operations.cjs)。

## 验证与交付

本次以隔离机器和原生宿主替身检验生命周期，不修改用户原 profile，不调用模型、不实测用户机器上的断开/移除。工程测试包括有历史的节点恢复、原 IPC 绕过拒绝、分页不可见占用、未知派发、离线、并发提交、落盘失败、跨机器伪造、中央原生/授权 unknown 和原收据拒绝查询。Windows 测试使用生产界面、生产文件存储；浏览器、认证 IPC 的实际打包 Electron 与普通无 debug EXE 分别记录。

本页专项功能与候选包验收完成；验证结果、最终包摘要与覆盖限制来自本次实际执行；不能将历史 alpha.6 的真实 SSH/原生协作链算成本次新验证。

## 已完成的工程与界面验证

本次 Node 22.23.1 / Windows Node 24.18.0，Edge 154、Electron 44.7.0；生产前端和受控宿主。桌面 125/125 [工程回归](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)通过；根源码未改，43/43 保留 alpha.6 历史基线。新增 9 项生命周期/意图反例，不伪造原生执行成功。

最终生产界面 [节点 7 组](../../../artifacts/node-management/2026-10-13/ui-nodes.json)、[图 10 组](../../../artifacts/node-management/2026-10-13/ui.json)、[角色/平移 6 组](../../../artifacts/node-management/2026-10-13/usability.json)分别记录实际通过结果；覆盖节点确认取消、断开撤权/扫描不接回、移除后恢复、主撤权、原 ACK 丢失重开、无本机缓存时接收中央原意图与旧后台能力拦截。脚本：[节点检查](../../../desktop/tests/windows-node-management.cjs)、[原图](../../../desktop/tests/windows-i06b-graph.cjs)、[角色与平移](../../../desktop/tests/windows-graph-usability.cjs)。[界面初始图](../../../artifacts/node-management/2026-10-13/nodes-initial.png)。

原节点界面驱动在新增“外窗口原意图”场景断开 WSL 后仍寻找“断开”按钮，断言失败；修正为检查此卡片仍存在的“移除”按钮已禁用。[保留原驱动失败](../../../artifacts/node-management/2026-10-13/ui-nodes-driver-before.json)。图角色回归初轮待移除边未出现，保留 [失败](../../../artifacts/node-management/2026-10-13/usability-before.json) 和截图；角色切换后增加显式端点测量，最终隐藏端点/待移除边与放弃草稿回归通过，未由单个样本断言所有图几何故障的根因。

打包阶段两次资源检查准确拒绝了构建期间继续改变的源码；后台/前端修改结束后才重新冻结最终资源，不把旧打包物当作当前代码。保留 [初次构建](../../../artifacts/node-management/2026-10-13/package-build-before-final.log)、[冻结前构建](../../../artifacts/node-management/2026-10-13/package-build-before-source-freeze.log)。类型/生产构建见 [日志](../../../artifacts/node-management/2026-10-13/build.log)。

## 实际打包窗口

[Electron 7 组](../../../artifacts/node-management/2026-10-13/electron.json)通过：从本次 Windows win-unpacked 的隔离本地完整资源副本启动真实 Electron 44.7.0，窗口版本 alpha.9，认证生产 IPC 与中央存储真实运行，宿主受控；原操作丢回应、重开、外来原意图及旧接口能力缺失均实际操作。无模型任务。这是带 Playwright 调试连接的打包窗口证据，不冒充普通 portable EXE。脚本为同一节点检查的 electron 分支，[初始窗口](../../../artifacts/node-management/2026-10-13/electron-nodes-initial.png)。

## 包与性能

最终 [包资源](../../../artifacts/node-management/2026-10-13/package.json)通过：27 个 CJS 模块、1369 个 Linux 文件，app.asar/前端/版本与源码一致；[构建](../../../artifacts/node-management/2026-10-13/package-build.log)、[解包核对](../../../artifacts/node-management/2026-10-13/unpacked.json)。程序为 [AgentBridge-0.6.0-alpha.9-Windows-x64.exe](../../../desktop/release/AgentBridge-0.6.0-alpha.9-Windows-x64.exe)，129,583,670 字节，SHA-256 `80c8a39036ba93466de96955e707280f436b6da258d5e047c7590822e2c0d688`；Linux manifestDigest `344a725b8ce2b14a8ae583fe3ca354e16565bd85a7ceb339e465ba0d3157ecea`。可信 alpha.2–alpha.8 保留，alpha.8 先与历史交付摘要核对，不自动更新用户 daemon。

[密集图性能](../../../artifacts/node-management/2026-10-13/performance.json)通过：Windows Edge 154 / i5-8600、20 机器/60 节点/59 边，实际鼠标反馈 20 样本 p95 40.8ms，观察期间 long task 为零。构建/其他窗口回归结束后单独测量；不是模型任务或网络故障性能验收。

## 普通 EXE 与最终验收

[普通 portable EXE](../../../artifacts/node-management/2026-10-13/portable.json)三项通过：最终 EXE 无 debug 参数启动，隔离 Windows/WSL 状态，冻结模块与当前源码一致；正常关窗口/便携 wrapper 后保留同一 Coordinator；重开同后台/布局。native prompts=0、委派=0，未调用原生模型。[脚本](../../../desktop/tests/windows-i06b-portable.cjs)、[日志](../../../artifacts/node-management/2026-10-13/portable-run.log)。所属测试窗口和后台清理，用户原 profile 未变更。

[文档检查](../../../artifacts/node-management/2026-10-13/docs-check.log)通过，覆盖迭代、整体设计/计划、M01/M02/M03/M07/M08/M10 及 M04/M05 资源版本、架构/数据/协议。最终结果汇总见 [证据摘要](../../../artifacts/node-management/2026-10-13/summary.json)。范围内准出，不扩大成正式发布或完整 I06C。

使用：先正常关闭旧窗口，打开 alpha.9 EXE；若仍连旧后台，界面节点管理能力提示会指向“设置 → 后台运行 → 停止后台并退出”，之后再次打开新版程序。不要删除机器/节点/历史或换原请求 ID 来更新。添加接入的是现有原生安装，不代替安装/登录；移除后需从原机器重新添加并显式重配授权。
