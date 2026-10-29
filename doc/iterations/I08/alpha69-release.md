# alpha.69 维护预发布交付

日期：2026-10-29（Asia/Hong_Kong）。承接公开alpha.68，当前公开预发布0.6.0-alpha.69；源码、EXE与校验文件已分发并验证匿名完整下载。

## 本轮范围

- Pi派发/原生事件使用同一真实目录规则，Claude已选JS入口经Node启动；[需求、实现和原反例](pi-workspace-events-and-windows-validation.md)。
- SSH中文profile原密文清理及经典原生MCP列表沿原安装启动；[跨平台验证与边界](windows-regression-and-native-probes.md)。
- 原生MCP配置并发修改、目标切换和原子替换失败后，只删除本次准确临时文件；[原失败与运行时对照](mcp-config-temporary-cleanup.md)。
- Core连接检查/高级向导复用原安装版本启动器；[实现与原Windows回归](core-windows-installation-checks.md)。
- Edge事件ACK超时立即退役原运输，按原execution/seq补传，不重派任务；[根因与验证](edge-outbox-reconnect.md)。
- 仓库根双击界面预览入口、Windows/Linux验证器平台边界和文档测试清理；保留原生配置、原ID和unknown。预览只使用合成数据。

## 冻结、兼容与证据范围

本轮223项产品/依赖输入固定后才构建。alpha.68兼容清单来自SHA-256核对通过的实际公开EXE，1725份Linux文件逐一校验，规范manifest摘要`ac00383bcb2176c5751d7000f220164117d613c58245a49bf12d42c3cc9dd06b`；新增pin不触发远端部署。最初沿旧嵌套归档格式的导入器未找到app-64.7z，改为从此EXE实际资源布局提取后完成核对；不把导入失败记为产品测试。

本轮原始材料位于`artifacts/release-alpha69/2026-10-29/`；各修复早期失败、组件与真实原生证据仍在上述专项，不能合并为本次EXE重新实测。最终结果见下节；首轮工程失败与单独复验分开记录。

## 保留边界

当前仍为未签名预发布，不代表正式0.6.0准出。不访问或切换日常profile/后台，不部署独立SSH，不调用真实模型；真实用户profile恢复、父模型自主委派/多主、原生等待/网关取消、完整I06C/I07C/MCP02、图100ms及冷启动/WSL仍未准出。原unknown只查原ID；取消/权限收据confirmed不作为业务成功或已取消的证明。历史全量失败不改写；文档原2243项缺失及依赖审计问题按实际结果保留。

## 最终发布与分层验收

标签`v0.6.0-alpha.69`冻结`04ee6febc827c5e4c96c1e2fa925bf332b984de6`。EXE **132300169字节**，SHA-256 `534642b1026057a40b99f56357b88625ce45bfe28e257ad397f597e0bff0d240`；223产品/依赖输入与冻结提交及构建原字节一致，59后台/84Core/1726Linux文件和ASAR/前端/bootstrap匹配，实际EXE解出3402资源逐一匹配。[发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.69)。

| 检查 | 实际结果 |
| --- | --- |
| Windows Node24.12.0完整桌面 | 1061项：1020通过、0失败、41平台跳过 |
| Windows完整Core首轮 | 79项：67通过、1失败、11平台跳过；I01在忙节点检查时实际退出0而非预期4，模拟任务已过执行窗口，首轮失败保留 |
| I01同源码单独复验 | 1通过、0失败；不替换首轮全量结果，不据单次复验宣称消除时序问题 |
| 实际EXE冻结后台/Electron组件 | 56通过、0失败、0跳过；使用合成配置和受控CLI，非真实模型 |
| 根typecheck/lint、Core/前端生产构建 | 通过，保留大chunk提示 |
| 用户站测试/构建 | 6/6；18页/19HTML/158资源，内部页与证据导出0 |
| 普通无调试EXE | 合成profile启动不改冲突文件、明确确认备份/恢复、原ID幂等、关闭窗口及完整后台重启保持原关系/unknown/收据；原窗口与后台正常退出，模型0 |
| 完整文档检查 | 退出1，2243项原缺失，本轮新增0；不删除引用或生成假证据 |
| 生产依赖审计 | Zod 1项high保留，未升级依赖 |
| 独立Ubuntu CI | completed/success，仅按[当前运行](https://github.com/wsjq5477/MA-Relay/actions/runs/40803697468)实际结果记载，不借用alpha.68通过数 |
| GitHub分发 | 两附件uploaded，服务端大小/digest匹配；版本URL匿名HTTP200完整下载，字节与SHA-256均匹配 |

证据：[分层汇总](../../../artifacts/release-alpha69/2026-10-29/public-summary.json)、[源码绑定](../../../artifacts/release-alpha69/2026-10-29/source-binding.json)、[包检查](../../../artifacts/release-alpha69/2026-10-29/package-check.json)、[实际EXE载荷](../../../artifacts/release-alpha69/2026-10-29/exe-payload-check.json)、[普通EXE](../../../artifacts/release-alpha69/2026-10-29/portable.json)、[公开下载](../../../artifacts/release-alpha69/2026-10-29/github-download.json)。仅脱敏摘要随源码公开，原日志保留本地，不发布用户profile、备份或原生配置。
