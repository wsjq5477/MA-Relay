# alpha.68 预发布交付

日期：2026-10-28（Asia/Hong_Kong）。承接公开 alpha.67，版本 0.6.0-alpha.68。源码、EXE与SHA文件已公开，最终验收与下载证据见下方。

## 本轮范围

- issue #27：关系视图冲突的只读脱敏检查、连续唯一原收据提案、明确确认后的逐字节备份及原子恢复，旧后台的 v3 写入能力前置门禁。[设计、流程与限制](relation-conflict-diagnostic.md)。
- 工作区已有的[原生启动失败边界](native-start-boundary.md)、[Hermes 分离输入保护](hermes-detached-input.md)、[Pi 原会话目录核对](pi-session-workspace.md)，均进入本次源码与包。
- 现有[桌面界面及离线字体精修](taste-impeccable-ui.md)，继承原生配置与原任务，不添加模型 API 层。
- alpha.67 原 Linux manifest 精确保留为兼容 pin。新版不自动升级日常后台或 SSH；v3 缺关系索引同步能力的旧后台须用户停止后打开新版。任意手动启动旧 EXE 的直接写入仍不能由新客户端隔离。

## 本轮实际验证

Windows Node24.12.0；界面构建与 Core 构建、类型检查、lint 通过。关系定向受控137/137、包内冻结关系后台16/16、Windows恢复路由25/25、原生生命周期受控40通过/1跳过。生产 renderer 合成 RPC 确认、取消、失败与成功反馈已验，不当作真实原生执行。

冻结前工作区桌面全量原1001项（后续变更由定向/冻结检查覆盖，未再次运行完整全量）：926通过、74失败、1跳过，未做同工作区变更前全量比较，不能全部认定历史失败。文档检查2243项缺失，与提供基线数量一致；没有删除历史引用。npm生产依赖审计仍有Zod 1项high（GHSA-mrhx-c7xc-m3w5，锁定4.6.5），本轮未升级依赖。两次打包失败为共享缓存EXDEV和重试相对目录ENOENT，改用隔离缓存与绝对预打包目录；失败原日志保留本地，不把失败写成通过。

当前未签名；真实用户 profile 恢复、真实模型/父模型完整协作、网关取消、完整原生矩阵、独立SSH、图100ms及冷启动性能仍未准出。模型调用为0，不切换日常后台。

## 分层证据

[定向回归](../../../artifacts/issue27/2026-10-28/targeted.txt)、[冻结Windows后台](../../../artifacts/issue27/2026-10-28/frozen-windows.txt)、[Windows恢复路由](../../../artifacts/issue27/2026-10-28/windows-recovery-contract.txt)、[Windows原生生命周期](../../../artifacts/issue27/2026-10-28/windows-native-contract.txt)、[依赖审计](../../../artifacts/issue27/2026-10-28/dependency-audit.json)、[产品输入冻结摘要](../../../artifacts/issue27/2026-10-28/product-inputs.json)。最终包字节、普通EXE与公开下载结果见下方。

## 最终发布与包验证

公开标签 `v0.6.0-alpha.68` 冻结 `38cd6372f9130bd91eb535046e96ac51e4d4caa2`；EXE **132290374 字节**，SHA-256 `ef2361f30f5e3ffce5c7e37a1506144077e30f89e00904e5c0e0a1d11cf71534`。59后台/84Core/1725Linux文件及ASAR/前端/bootstrap一致；实际EXE解出的3401资源逐一匹配。221产品与依赖输入的原字节未漂移，按Git过滤规则与冻结提交blob一致。alpha.67兼容pin规范摘要保持a93d1137565b0652a7878b1ea2051d8f4b19144b1d5188904570b96754b90326。

普通无调试EXE两次启动212496/190373ms，不能当作冷启动性能准出。独立合成profile中：启动冲突不改原文件、明确确认恢复、原备份逐字节一致、原ID幂等、窗口关闭及整个中央重启后的关系/unknown/原收据保持通过。原窗口与两个原后台正常关闭，不切换日常profile；模型0。验收器首次因自身仓库相对路径错误在启动EXE前失败，纠正后才进行本轮普通EXE验收，不算产品失败或通过。

冻结提交的[独立Ubuntu CI](https://github.com/wsjq5477/MA-Relay/actions/runs/40666142260)成功：Core71/71、原生适配110/110、固定正式Hermes0.22.5原生MCP五组通过，模型0；这是本轮组件验证，不冒充真实模型或Windows→WSL两轮复验。

源码标签与附件已公开：[发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.68)。EXE和SHA256SUMS附件服务端摘要匹配；最终版本URL匿名HTTP200完整下载、大小和摘要匹配。首次草稿转公开仍带GitHub临时untagged标签，随后显式绑定既有v0.6.0-alpha.68并重做匿名完整下载；本轮产生的临时标签已删除，版本标签不变。

证据：[包核验](../../../artifacts/issue27/2026-10-28/package-check.json)、[实际EXE资源](../../../artifacts/issue27/2026-10-28/exe-payload-check.json)、[冻结源码绑定](../../../artifacts/issue27/2026-10-28/source-binding.json)、[普通EXE报告](../../../artifacts/issue27/2026-10-28/portable.json)、[验收脚本](../../../artifacts/issue27/2026-10-28/portable-recovery.cjs)、[CI结果](../../../artifacts/issue27/2026-10-28/ci-status.json)、[CI Core](../../../artifacts/issue27/2026-10-28/ci-results/core.tap)、[CI适配](../../../artifacts/issue27/2026-10-28/ci-results/targeted.tap)、[正式Hermes组件](../../../artifacts/issue27/2026-10-28/ci-results/installed.json)、[公开下载](../../../artifacts/issue27/2026-10-28/github-download.json)。仅筛选的合成测试及脱敏摘要进入源码，不公开原始用户profile/备份。

最终文档检查仍退出1：2243项缺失材料，新增本轮发布/证据链接错误0；不以公开下载通过替代全量与文档准出。主文档与模块已同步当前公开alpha.68，逐轮历史保持原版本。
