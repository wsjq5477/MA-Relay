# alpha.50 当前包指标与 WSL 稳定性补验

日期：2026-10-23（Asia/Shanghai，原始JSON为UTC）。关联I06 §4状态/图指标、AB-F02/F07/F11、M01-F04/F09、M03-F02与I08 WSL就绪保护。本轮只修改显式验收脚本、规模夹具和资料；产品运行代码、协议、持久模型与EXE均未改动。公开仍alpha.46，当前本地包仍alpha.50。

后续alpha.53冻结包已完成0px画布几何和完整20次PNG帧补验；PNG观测p95 388.932ms仍未准出，本地状态同步p95 1504ms通过。[新包独立证据](alpha53-current-metrics.md)。以下alpha.50原始结果不追改为通过。

## 需求与证据边界

继续按[I06原验收方案](testing.md#4-统一指标与观察窗口)核对当前包：20组机器/60工具节点，至少20个真实输入与可见反馈样本，p95≤100ms且无>500ms主线程卡顿；20次确认落盘的状态变化到界面，p95≤2s。独立物理LAN与SSH仍是原准出条件，本机受控目录结果不能替代。

alpha.49曾出现就绪前退出，不能用一次MCP流程成功替代启动稳定性。本轮新增20次Windows生产HostConnection→实际WSL启动，每轮并发三个只读environment/snapshot调用；全部使用共享的独立临时Bridge目录，不读写日常原生配置、不提交任务，模型0。每轮确认原进程退出后才开始下一项独立只读场景，不补发失败请求。 启动20轮使用Windows Node22.22.1验收运行时加载alpha.50冻结资源，并非普通EXE窗口操作；包内Node24.21.0另跑原始WSL对照，仍复现同类失败。

## 当前权威结果

| 项目 | 实际结果与准出判断 | 原始证据 |
| --- | --- | --- |
| 本地状态同步 | 20次生产AgentNetwork原子保存且回读确认；由正常1500ms前端轮询观察DOM，再保守等待下一渲染帧，p95 **1513ms**，本机受控门槛通过；独立LAN未验 | [完整样本](../../../artifacts/i06-current-metrics/2026-10-23/fourth/metrics.json) |
| 图交互 | Windows Edge155.0.4283.45，i5-8600/6核/约16GB，1440×960浅色；20组/60节点/59条边全程保留，无机器过滤缩小目录；20次真实鼠标拖动、逐轮确认布局修订落盘，授权修订不变。双requestAnimationFrame观测上界p95 **117.9ms**，未达到100ms门槛，**不准出** | [原始输入、DOM变化、两帧时间](../../../artifacts/i06-current-metrics/2026-10-23/fourth/metrics.json)、[规模截图](../../../artifacts/i06-current-metrics/2026-10-23/fourth/graph-20-machines.png) |
| 连续拖动卡顿 | 上述20次拖动期间PerformanceObserver未记录longtask，未出现>500ms样本；不以此替代反馈时延门槛 | 同一完整报告 |
| WSL实际启动 | 20次中 **9通过/11失败**；11次均就绪前退出码1、stderr0字节，待发三个调用全部返回明确未派发。成功9轮共27条请求，握手前写入0、重复原请求0；20个原进程均确认退出，隔离目录已清理。**稳定性未通过** | [20个完整样本](../../../artifacts/wsl-startup/2026-10-23/startup-first.json) |
| 原始WSL对照 | 不加载Bridge，只运行printf/read。Node22.22.1下普通pipe/ignore/overlapped/移除子进程WSL变量分别3/5、2/5、3/5、3/5通过；alpha.50自带Node24.21.0下分别3/5、2/5、2/5、3/5通过。PowerShell直接printf为14/20通过，也出现无输出退出1 | [Node22对照](../../../artifacts/wsl-startup/2026-10-23/transport-comparison.json)、[包内Node24对照](../../../artifacts/wsl-startup/2026-10-23/transport-shipped-runtime.json)、[PowerShell直接调用](../../../artifacts/wsl-startup/2026-10-23/powershell-direct.json) |
| 包未变化 | 53后台模块/84Core/1701Linux资源及前端、ASAR、bootstrap一致性全部通过；EXE仍130184924字节，SHA-256仍0468608387c0f2894cfe1df58f3a92dec24427030c1bb2a0420f689be1f7230d | [本轮包核验](../../../artifacts/wsl-startup/2026-10-23/package-unchanged.json) |

观测上界不是准确的首次呈现时间：第二帧时间保证前一帧有呈现机会，但可能多计一帧。当前20个DOM变更延时及第一、第二帧时间全部保留，不能为得到通过而改用更早时间戳；下一步采集实际帧呈现/性能轨迹，再判断是否需要优化图渲染。该上界未满足门槛，原要求仍未被证明。

原始WSL对照证明同类退出在Bridge之外也存在，不能据此宣称已定位Windows/WSL内部根因或修复。Windows10.0.22000、Linux内核5.10.16.3-microsoft-standard-WSL2；[只读环境快照](../../../artifacts/wsl-startup/2026-10-23/linux-readonly-environment.json)中的OOM累计计数没有事件时间，不能归因于本轮。未重启WSL、更新系统或服务、修改默认发行版、切换日常后台；不增加盲重试或固定延时掩盖失败。

## 验收脚本与保留失败

- [windows-wsl-startup.cjs](../../../desktop/tests/windows-wsl-startup.cjs)：真实进程的观察包装只记录spawn、stdin写入与就绪帧，不替换命令、参数、内容或调度。保存每轮退出、三条调用结果和写入ID；[首次脚本指纹](../../../artifacts/wsl-startup/2026-10-23/startup-first-script.sha256)与[最终源码指纹](../../../artifacts/i06-current-metrics/2026-10-23/source-sha256.json)区分后续无行为序列化调整。
- [windows-wsl-transport-diagnostic.cjs](../../../desktop/tests/windows-wsl-transport-diagnostic.cjs)：四种条件交错执行，保留所有成功/失败，不把预热顺序当作修复；原运行时和包内运行时分别记录。
- [windows-i06c-current-metrics.cjs](../../../desktop/tests/windows-i06c-current-metrics.cjs)：加载冻结包后台与前端，使用真实Windows鼠标与下一渲染帧；不直接改组件state。状态同步从生产原子落盘/回读时间起算；截图和计时仅属于受控目录，不冒充实际SSH或原生Agent。
- [规模夹具](../../../desktop/tests/i06b-ui-fixture.cjs)允许显式选择冻结包后台。扩展规模后对所有机器调用生产discover；仅清discovered却保留discoveryAttempted会让原三台机器少发现六节点。修正的是验收夹具，没有改产品扫描逻辑。

前轮均保留：首次只有54节点，[报告/截图](../../../artifacts/i06-current-metrics/2026-10-23/first/metrics.json)；第二轮全图适应后的主节点位于可视区域外，鼠标未命中，[报告](../../../artifacts/i06-current-metrics/2026-10-23/second/metrics.json)；第三轮4像素短拖被浏览器识别为双击并打开空白会话表单，未提交任何任务，[报告](../../../artifacts/i06-current-metrics/2026-10-23/final/metrics.json)。第四轮通过实际“定位主节点”、命中核对、明确拖动距离和每轮布局修订核对完成20+20样本；最终117.9ms上界仍未通过，不抹除或反转这个结果。

显式命令（Windows Node/Electron RunAsNode；参数均为隔离目录）：

```text
node desktop/tests/windows-wsl-startup.cjs BRIDGE_ROOT FROZEN_ALPHA50_EXE REPORT Ubuntu 20
node desktop/tests/windows-wsl-transport-diagnostic.cjs REPORT Ubuntu
node desktop/tests/windows-i06c-current-metrics.cjs BRIDGE_ROOT FROZEN_FRONTEND OUTPUT_DIRECTORY
```

CJS语法与脚本lint通过，使用现有CommonJS规则覆盖no-require-imports；[lint日志](../../../artifacts/wsl-startup/2026-10-23/script-lint.log)。未重跑原794/794、68/68全量，也不将本轮显式样本加入旧全量计数；运行代码/包未变化。本轮[汇总](../../../artifacts/i06-current-metrics/2026-10-23/acceptance-summary.json)保持partial_not_accepted，完整目标保持active。

## 后续与资料同步

继续保留原I06C/I07C/MCP02/CT-07/08全部范围。当前图指标需要准确帧呈现跟踪/优化；WSL需要继续定位外部启动失败；独立SSH/LAN、原生父模型、自主委派/真实生命周期等未测项不变。原有真实模型目标授权问题仍按[原授权记录](../I08/wsl-host-readiness.md#真实父模型验收待授权)处理，不自行改模型、关系或请求。

本轮更新整体设计/验证/路线、全迭代台账、入口及M01/M03/M05/M09/M10资料。架构、data-model、protocol已核对，没有产品边界、消息或持久格式变化，不伪造协议改动。[文档检查](../../../artifacts/i06-current-metrics/2026-10-23/docs-check-final.json)通过239份Markdown/15模块设计报告对/97图；[用户站6/6](../../../artifacts/i06-current-metrics/2026-10-23/docs-test.log)、[站点构建](../../../artifacts/i06-current-metrics/2026-10-23/docs-build.log)通过18页/19 HTML、内部页/证据导出0；不公开推送、发布或部署。
