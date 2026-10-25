# alpha.63 图指标复验：仍未达到100ms

日期：2026-10-25（Asia/Shanghai）。在用户要求暂停继续开发之前，对本地冻结alpha.63生产前端/后端补验。仅采样/诊断，无产品修复、GPU设置变化、模型或真实关系修改；本页保存当前未完成边界，不因随后发布EXE而改为通过。

Windows Edge155、1440×960、默认硬件渲染的headless生产页面，受控20机器/60节点/59边，完整20次实际浏览器指针拖动，保留全部PNG和原始输入。**PNG p95 496.029ms**，未满足100ms；双RAF上界p95 118.4ms仅作诊断；20次本地确认落盘→界面同步p95 1499ms满足2s，非LAN/SSH；longtask最大0、授权边重复文字测量0，未替代普通EXE/物理屏幕证据。

[完整失败报告](../../../artifacts/graph-alpha63/2026-10-25/baseline/metrics.json)、[PNG帧清单](../../../artifacts/graph-alpha63/2026-10-25/baseline/frames/frames.json)、[实际驱动码](../../../artifacts/graph-alpha63/2026-10-25/baseline/driver-result.json)。前端与冻结ASAR提取文件逐项一致，后台摘要及EXE边界见[来源核对](../../../artifacts/alpha63-release/2026-10-25/graph-provenance.json)。

随后一轮tracing保留了20条拖动和原始时间线，但诊断开关组合触发验收器的measurement结果未填充断言，未进入PNG判定与状态同步步骤。该轮不能作为完整指标通过或另一个产品回归：[原始中断报告](../../../artifacts/graph-alpha63/2026-10-25/traced/metrics.json)、[原始时间线](../../../artifacts/graph-alpha63/2026-10-25/traced/drag-timeline.json)。此前GPU提交停顿仅是相关线索，尚不足以认定产品根因；没有通过关闭GPU、丢弃慢样本或改成RAF门槛收尾。

用户随后要求“先到这里，把当前改好的全部提交，exe也传到github”，迭代目标按其要求暂停；停止进一步图分析/修改，发布仅包含既有已验证alpha.63产品。图100ms、普通窗口呈现与完整准出继续未完成。
