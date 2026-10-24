# alpha.56 图反馈与渲染管线诊断

日期：2026-10-24（Asia/Shanghai）；版本 0.6.0-alpha.56 本地冻结候选，公开仍 alpha.53。关联 I06C 图指标、AB-F11、M01-F04/F09 和 M10 包内前端证据。本轮没有产品修复或新 EXE；模型 0，不切换日常后台、部署 SSH 或修改原生配置/关系。受控目录中的 20 台机器、60 个节点、59 条授权边不是真实用户关系。

## 需求与执行

[alpha.54 既有 PNG 20 样本](../I08/graph-measured-dimensions.md)仍未达到原 p95 ≤100ms；边文字重复测量已消除，不能继续将剩余延迟直接归因于该缺陷。本轮在冻结 alpha.56 的生产前端/后端上执行一次默认渲染完整采样，并针对观测到的 GPU 提交停顿做一次明确的软件渲染诊断对照。两轮均保留全部 20 次鼠标拖动、原始 PNG、输入、时间线、100ms 门槛和 20 次本地状态同步，不删除慢样本或以 DOM/RAF 代替画面。

环境：Windows、Edge 155、1440×960、headless 生产页面、PNG screencast 与浏览器 tracing。硬件/版本和原始目录规模见各 metrics.json；默认使用 Intel UHD 630、D3D11 驱动 31.0.101.2115。软件对照仅在验收启动器设置 `AGENTBRIDGE_GRAPH_DISABLE_GPU=1`，向该隔离浏览器传 `--disable-gpu`；实际 trace 标记为 SwiftShader。它不是默认产品运行模式，不改变 Electron 参数或用户设置。

## 结果

| 指标 | 默认渲染 + tracing | 软件渲染诊断 + tracing | 结论 |
| --- | --- | --- | --- |
| 完整 PNG 20 样本 p95 | **363.722ms** | **112.902ms** | 两轮均超过 100ms，原报告均 failed |
| 双 RAF 上界 p95 | 114.700ms | 76.700ms | 诊断数据，不替代 PNG 门槛 |
| 20 次本地持久化→页面同步 p95 | **1556ms** | **1514ms** | 两轮均满足本地 2s；无独立 LAN/SSH |
| 授权边文字重复测量 | 0 | 0 | 先前尺寸保留修复仍有效 |
| 主线程单次 BeginMainFrame 最大耗时 | 11.308ms | 11.813ms | 不能把输入到画面的总延迟都算作应用单帧计算 |
| GPU ScheduleOverlays 单次最大耗时 | 232.615ms | 此事件不存在，记 null | 缺失事件不等于零耗时或物理屏幕已呈现 |

默认第 3/20 条 PNG 观测分别为 363.722/426.047ms，相同原拖动 trace 窗口中有 216.390/232.615ms 的 GPU 提交跨度。这里只证明重叠相关，不能从单轮 trace 确认唯一根因或推广为设备驱动结论。第 7 条 PNG 243.227ms 时没有超过 100ms 的同类 GPU 跨度，因此该现象也不能解释全部慢样本。软件对照仍失败，证据不支持将“关闭 GPU”作为产品修复。两种模式各执行一次，不是严格配对重复试验，不能将数字差值当作产品优化收益。

[默认完整报告](../../../artifacts/graph-pipeline/2026-10-24/traced/metrics.json)、[默认原始时间线](../../../artifacts/graph-pipeline/2026-10-24/traced/drag-timeline.json)、[默认 PNG 清单](../../../artifacts/graph-pipeline/2026-10-24/traced/frames/frames.json)、[默认离线分析](../../../artifacts/graph-pipeline/2026-10-24/traced/pipeline-analysis.json)；[软件对照完整报告](../../../artifacts/graph-pipeline/2026-10-24/software-diagnostic/metrics.json)、[对照原始时间线](../../../artifacts/graph-pipeline/2026-10-24/software-diagnostic/drag-timeline.json)、[对照 PNG 清单](../../../artifacts/graph-pipeline/2026-10-24/software-diagnostic/frames/frames.json)、[对照离线分析](../../../artifacts/graph-pipeline/2026-10-24/software-diagnostic/pipeline-analysis.json)。原关系保持，任务/委派/执行请求均 0；trace/PNG 采集可能影响运行，不宣称物理显示器首帧时延。

## 验收器与来源核对

[windows-i06c-current-metrics.cjs](../../../desktop/tests/windows-i06c-current-metrics.cjs)只增加显式诊断开关和 rendererMode；默认启动行为不变。[graph-pipeline-analysis.cjs](../../../desktop/tests/graph-pipeline-analysis.cjs)为离线只读分析：按原渲染进程与顺序配对 20 组 pointerdown/up，各组必须包含原 8 个 pointermove；将 GPU/主帧跨度与同一 trace 时钟下的整个拖动窗口关联。DOM/RAF/PNG 使用原报告数值，不把不同来源的时钟直接相减，不改通过判定。对原证据副本的四项检查通过：完整 20 条保留原失败；缺失鼠标事件拒绝；缺失样本拒绝；缺失 GPU 事件记 null 且 PNG 结果不变。[离线核对](../../../artifacts/graph-pipeline/2026-10-24/offline-validation.json)。

alpha.56 EXE 完整 SHA 再核对为 `9c87e70332d9f11b219467793a41b0aed1f16eaa10a8a252232b187890e1f5cd`，130191853 字节。全部 Windows 暂存前端文件与冻结 app.asar 解包文件 SHA 一致；未重新构建或覆盖 EXE。[来源与脚本摘要](../../../artifacts/graph-pipeline/2026-10-24/provenance.json)、[默认包装器](../../../artifacts/graph-pipeline/2026-10-24/default-runner.ps1)、[软件对照包装器](../../../artifacts/graph-pipeline/2026-10-24/software-runner.ps1)。默认轮在添加诊断开关前完成；软件轮明确记录开关。脚本语法与 CommonJS 对应 lint 通过，[lint](../../../artifacts/graph-pipeline/2026-10-24/lint.log)。未重跑无关 863 项或模型测试。

## 后续范围

图 100ms 继续未准出。下一步需核对默认普通 EXE 的实际呈现与采集链路，区分输入排队、合成/呈现和采帧观测，再据证据修改产品；不通过降低像素条件、放宽门槛、删除慢样本或统一关闭 GPU 收尾。alpha.54 的无 trace 241.069ms 保留原版本/原条件，不被本轮覆盖。WSL 稳定性、真实父模型、完整 I06C/I07C/MCP02 与 CT-08 仍按原台账推进。

本轮仅验收器/证据变化，M01/M10 行为、架构、数据与协议无改动；同步模块报告、整体状态与迭代目录，文档检查和用户站测试另存本轮目录。
