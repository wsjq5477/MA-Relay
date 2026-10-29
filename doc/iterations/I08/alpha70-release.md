# alpha.70：#27/#28 修复预发布交付

日期：2026-10-29（Asia/Hong_Kong）。[GitHub预发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.70)已公开；标签冻结[5c95b98](https://github.com/wsjq5477/MA-Relay/commit/5c95b98ed8865c6f601922f029a22708f374492c)，master含修复和后续发布说明，标签不随文档推进。

## 行为与升级

#27恢复器区分原关系变更与节点观察，只在唯一原收据链、完整指纹及原身份核对后提供提案。丢回应只查询准确原持久确认，不清理unknown。用户明确确认才逐字节备份并原子恢复，原任务、请求、其他关系与收据保留。#28重连撤销旧probe，机器/节点按当前阶段及错误展示；未登记daemon保持严格拒绝并停止自动重试。详细要求、旧源码反例、原始失败与分层证据见[#27/#28修复记录](issues27-28-current-state.md)。

升级前在旧窗口“设置 → 后台运行 → 停止后台并退出”，再打开新版。新窗口遇旧中央能力不足会明确提示停止旧后台并重开，不自动结束日常后台。原任务unknown只查原ID、不重发；版本拒绝不自动安装、上传或替换远端。

## 源码、EXE与摘要

- [Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.70/AgentBridge-0.6.0-alpha.70-Windows-x64.exe)：132301726字节，未签名。
- SHA-256：b284d076732c0189814818b588439171be6496e08c2218356ef859d0e1d1070d；[校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.70/SHA256SUMS.txt)。
- 225项产品/依赖输入绑定冻结源码；60后台CJS、84Core、1728Linux文件与ASAR/前端匹配，实际EXE解包3405资源逐项一致。
- 2026-10-29匿名完整下载EXE及校验文件均HTTP200，与本地字节及摘要一致；[下载核验](../../../artifacts/issue27-28/2026-10-29/github-download.json)、[源码绑定](../../../artifacts/issue27-28/2026-10-29/source-binding.json)、[包核验](../../../artifacts/issue27-28/2026-10-29/package-check.json)、[实际EXE资源](../../../artifacts/issue27-28/2026-10-29/exe-payload-check.json)。

alpha.69公开EXE按原SHA核验后提取精确manifest，1726文件匹配，只转存该已受信公开版本为上一版本pin，未知版本增加0；[原清单证据](../../../artifacts/issue27-28/2026-10-29/alpha69-pin-proof.json)。

## 实际验证

| 环境/层级 | 实际结果与证据 |
| --- | --- |
| Windows冻结专项 | 98/98；包内关系/SSH33/33；构建、类型与lint通过。旧基线新反例关系5失败、SSH3失败，原日志保留 |
| 普通无调试portable | 隔离合成关系5→7→6、原字节/备份/确认/原ID幂等及完整中央重启通过；[报告](../../../artifacts/issue27-28/2026-10-29/portable.json) |
| 实际包内恢复UI | 取消不写、未确认禁用、明确确认后13→15/6成员、备份及原数据保全通过；[报告](../../../artifacts/issue27-28/2026-10-29/packaged-ui.json) |
| 实际包内SSH UI | 真实回环SSH/SFTP与受控远端文件系统，先可信ready后切至未登记版本；inspecting无旧probe/离线错误、三次快照稳定拒绝；远端写入/非probe命令0；[报告](../../../artifacts/issue27-28/2026-10-29/packaged-ssh-ui.json) |
| 独立Ubuntu CI | [运行40839439603](https://github.com/wsjq5477/MA-Relay/actions/runs/40839439603)完成成功；[Core79/79](../../../artifacts/issue27-28/2026-10-29/ci-results/core.tap)、[原生适配111/111](../../../artifacts/issue27-28/2026-10-29/ci-results/targeted.tap)、[#27/#28专项98/98](../../../artifacts/issue27-28/2026-10-29/ci-results/issues27-28.tap)；[官方Hermes0.22.5原生MCP五组](../../../artifacts/issue27-28/2026-10-29/ci-results/installed.json)通过，模型0 |
| WSL Ubuntu22.04 | 实际Linux Node22.23.1受控SSH恢复10/10；[原日志](../../../artifacts/issue27-28/2026-10-29/wsl-ssh-recovery.txt)，与独立Ubuntu分开计 |
| Windows完整桌面 | 第二轮1030通过/1失败/41平台跳过；DSH取消/自然完成竞态在基线也有同失败，原失败保留，不能声明全量全绿 |
| 文档与依赖 | check-docs原2243项缺失，错误集合无新增；依赖原Zod high1保留 |

各组共享用例不跨模块或平台相加。旧写入代码验证是原alpha.46 AgentNetwork在受控宿主下运行，不是原安装EXE或真实用户profile。包内UI使用调试传输，普通生命周期另由无调试portable证明；首次SDK收尾、观察器和一次性密码失败保留在修复记录，不冒充通过。

## 未准出边界

真实用户profile恢复、生产SSH、真实父模型/取消、完整I06C/I07C/MCP02及性能仍未准出。本次只用隔离合成profile和回环服务，模型0，不切换日常后台、不部署真实远端。普通两次启动193226/156474ms不作性能准出。不能把外部issue另一候选声称的真实profile结果作为本轮证据；原机器/策略收据不足以证明唯一顺序时仍人工核对。
