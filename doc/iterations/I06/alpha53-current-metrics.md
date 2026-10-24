# alpha.53 冻结包图帧与状态同步补验

日期：2026-10-23（Asia/Shanghai，JSON为UTC）。关联I06统一指标、AB-F02/F11、M01-F04/F09与M03-F02。公开包alpha.53，冻结5269d65；本轮只补验收脚本和文档，没有修改产品代码、协议、数据或EXE，没有切换日常后台、升级SSH或提交模型需求。完整目标继续按[准出台账](../I08/completion-audit.md)推进。

## 环境与方法

Windows10.0.22000，i5-8600/6核/约16GB，Edge155.0.4283.45 headless，1440×960浅色、reducedMotion。使用真实浏览器鼠标事件；机器来源为受控夹具，后台为包内生产Coordinator/AgentNetwork，前端从最终app.asar提取。全程20机器、60节点、59条授权边，未过滤缩小目录。每次拖动核对原节点命中、实际坐标改变及布局修订落盘；原关系不变，任务/委派/请求均0。此处不是普通EXE窗口、实际显示器扫描输出、独立LAN/SSH或真实Agent模型证据。

[包复核](../../../artifacts/i06-current-metrics/2026-10-23/alpha53-package.json)通过：54后台模块、84Core文件、1702Linux资源；Core/Windows与Linux后台/ASAR/前端/bootstrap一致。EXE仍130190405字节，SHA-256为`3f82bbc3c03ce52c348315f325fe5838de73daadfc1a6658a0170d58d8d3f4a3`，与[公开发布记录](../I08/alpha53-release.md)一致。

[原验收脚本](../../../desktop/tests/windows-i06c-current-metrics.cjs)、[PNG观察器](../../../desktop/tests/graph-frame-observer.cjs)、[规模夹具](../../../desktop/tests/i06b-ui-fixture.cjs)。脚本加载显式冻结资源，不直接改React组件state。Windows临时目录首次复制被Linux `.bin` 链接阻断；排除该CLI链接目录后复制成功，未排除产品模块或降低测试规模。

## 实际结果

| 场景 | 结果 | 原始证据 |
| --- | --- | --- |
| 自动保存画布位置 | **通过**：真实鼠标拖动后布局修订增加，持续5秒观察保存反馈及原横幅有效期，canvas.top始终476.984375px，位移**0px**，浏览器错误0 | [几何样本](../../../artifacts/i06-current-metrics/2026-10-23/alpha53-geometry/metrics.json) |
| 完整20次图拖动 | **未准出**：332帧PNG、20条原输入与像素匹配样本；PNG帧观测p95 **388.932ms**，最大572.265ms，超过原100ms门槛。双RAF上界p95 **118.2ms**，单独保留，不能替代PNG画面证据 | [完整报告](../../../artifacts/i06-current-metrics/2026-10-23/alpha53-presented/metrics.json)、[帧时间与摘要清单](../../../artifacts/i06-current-metrics/2026-10-23/alpha53-presented/frames/frames.json)、[规模截图](../../../artifacts/i06-current-metrics/2026-10-23/alpha53-presented/graph-20-machines.png) |
| 连续拖动卡顿 | PerformanceObserver longtask样本0；未观察到主线程超过500ms。画面反馈延迟与主线程长任务是不同指标，不能据此解除图反馈失败 | 同一完整报告 |
| 本地状态同步 | **本地受控门槛通过**：20次生产原子落盘并回读，经正常1500ms轮询至两帧后呈现，p95 **1504ms**；未替代独立LAN准出 | 同一完整报告 |
| 隔离与零隐式执行 | 全部20/60/59保留，关系未变，任务/委派/请求0，浏览器错误0 | 同一完整报告 |

PNG方法以7px实色主节点左边框按原方向移动至少2px为证据，排除2px选择外框；每条保留输入epoch、原矩形与颜色、基线/移动PNG、swap时间和原输入序列。时间采用CDP给出的帧swap epoch减原pointer事件epoch，不用更早DOM/RAF时刻补缺。采集/编码及帧交付可能引入开销，因此这是该观察链路下的帧反馈结果，不能宣称准确的物理显示器首帧时延。保留原失败门槛，继续定位渲染与观测开销；不通过更换计时起点、降低规模或删去慢样本获取通过。

alpha.50的117.9ms上界、17条部分样本以及原WSL9/20启动结果仍按[原日期历史报告](current-candidate-metrics.md)保留。alpha.53的0px几何结果补齐了[横幅修复](../I08/wsl-close-and-graph-stability.md)的实际包验证，但不代表图反馈或WSL稳定性通过。

## 后续定位与边界

图反馈失败后增加可选`AGENTBRIDGE_GRAPH_PROFILE=1` CPU采样，保留原20次输入、规模与门槛；采样只进入显式验收脚本，不进入产品或EXE。诊断轮保留20条DOM/输入样本和295帧，但有样本未找到符合方向的移动帧，未形成完整像素分析，不准出；[原失败报告](../../../artifacts/i06-current-metrics/2026-10-23/alpha53-profiled/metrics.json)、[原始CPU profile](../../../artifacts/i06-current-metrics/2026-10-23/alpha53-profiled/drag-cpu-profile.json)、[CPU汇总](../../../artifacts/i06-current-metrics/2026-10-23/alpha53-profiled/cpu-summary.json)。约30.16秒采样中，idle约17.89秒；getBBox约574ms，浏览器可访问性/样式查询亦有开销。累计自耗时不能直接归因为单次输入延迟，没有据此盲改产品或替换原失败结论。脚本随后补充保存原gesture矩形/颜色与缺帧样本编号，便于下一次原证据审计；未重跑或追改既有报告。I06C完整故障矩阵、独立LAN/SSH、版本切换/回滚、原生父模型与完整I07C/MCP02/CT-08仍未准出。

OpenDesk日常父模型的Windows OpenCode心算验收已获明确授权；2026-10-23只读现场没有该Windows节点，父Prompt/子任务0，没有更换目标或关系。[授权与只读证据](../I08/wsl-host-readiness.md#真实父模型验收待授权)。这是环境前置缺失，不是权限仍待用户重复确认。

## 收尾检查

新增验收脚本CJS语法与lint通过；文档检查247份Markdown、15对模块设计/报告、5503处本地链接、101个Mermaid图，错误0。用户站测试6/6，构建18用户页/19HTML，内部页面与证据导出均0。[脚本lint](../../../artifacts/i06-current-metrics/2026-10-23/alpha53-checks/script-lint.log)、[文档检查](../../../artifacts/i06-current-metrics/2026-10-23/alpha53-checks/docs-check.log)、[站点测试](../../../artifacts/i06-current-metrics/2026-10-23/alpha53-checks/docs-test.log)、[构建](../../../artifacts/i06-current-metrics/2026-10-23/alpha53-checks/docs-build.log)、[脚本指纹](../../../artifacts/i06-current-metrics/2026-10-23/alpha53-checks/scripts-sha256.json)、[分层汇总](../../../artifacts/i06-current-metrics/2026-10-23/alpha53-checks/verification-summary.json)。本轮没有产品行为变更，architecture/data-model/protocol无需新增合约；没有重跑已注明版本的844/71全量、重建EXE或发布附件。完整目标仍active。
