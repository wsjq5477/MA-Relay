# 历史发布登记：标签、EXE 与 SHA-256

逐版本发布对照与当时边界集中在本页，供追溯使用；主文档[远端源码范围](../repository-sync.md)只保留当前材料范围与边界。登记以公开预发布为主（alpha.9 起，未列入的中间版本见对应迭代专项）。每条记录的验收事实、证据级别和未测项以对应迭代专项为准，本页不改写历史结论，也不用后续结果覆盖原日期版本。

## 2026-10-24 alpha.60本地候选

未公开、无新标签。EXE130212267字节，SHA-256 `d74c711b8475e84834519c8509a12a63351c1864a5ed4c01559588dc1fdc9cf6`；Downloads完整SHA一致。源码900/900，Windows包内37/37与实际中央管道/重启、兼容26/26、生产页面/普通EXE各4组通过，模型0。56后台/84Core/1713Linux一致，41份原pin；未签名、未切换日常后台/部署SSH，真实原生多主/图100ms/WSL和完整SSH仍未准出。[完整交付与失败记录](I07/connection-policy.md)。

## 2026-10-23 alpha.53预发布

标签v0.6.0-alpha.53冻结5269d6532a007cc1a4aef10a1b9003633c5932a5；EXE130190405字节、SHA-256 `3f82bbc3c03ce52c348315f325fe5838de73daadfc1a6658a0170d58d8d3f4a3`。EXE/校验文件均uploaded，匿名完整下载HTTP200、全部字节/摘要一致。核心71/71、桌面844/844、最终启动9/9、Windows生产前端2组/后端2项/普通EXE6组，模型0；核心全量与最后专项的源码边界分别记录。未签名、未切换日常后台或部署SSH，现场真实1.2.22未复测。[发布证据与边界](I08/alpha53-release.md)。

## 2026-10-23 alpha.52预发布

标签v0.6.0-alpha.52冻结49bd12b7fabdeee9d30b5f1fae47efac3e686df2；PR #18/#22已合并。EXE130190265字节、SHA-256 `46f30764b7dc769b6af3497dd71fc32b35ecbc5f0184b4e3778641af7896f28d`，EXE/校验文件均uploaded，匿名完整下载HTTP200、全部字节与摘要一致。桌面841/841、核心68/68、Windows生产前端12组/契约40项/普通EXE8组，模型0；未签名、未切换日常后台或部署SSH。[发布与未测边界](I08/alpha52-release.md)。

## 2026-10-23 alpha.51.recovery.2预发布

标签 `v0.6.0-alpha.51.recovery.2` 冻结 `905b79249dcc662584894659623616bb9e341802`，完整源码在独立发布分支，master合并另行审查。EXE130196014字节、SHA-256 `db079cb622d4fea75607758cb7e94a6f151683fb81c8f29b88b5f382f65152cd`；EXE与SHA256SUMS均uploaded，匿名HTTP200完整下载摘要一致。集成桌面817/817、核心68/68、Windows后端55/55、生产前端10组、普通EXE5组，模型0；未签名、未切换日常后台、未部署SSH。[下载、源码边界、证据与未测项](I08/alpha51-recovery2-release.md)。

## 2026-10-22 alpha.46 预发布

源码冻结 `9766eb4e6b9d5faa7a764fa2fe998c452b128cbb` 已推送master，标签 **v0.6.0-alpha.46** 固定同一提交；包含alpha.36之后维护恢复、OpenDesk已有CLI/桌面网关、开放MCP配置管理及恢复/观测/非GUI接入全部本地产品增量。[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.46/AgentBridge-0.6.0-alpha.46-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.46/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.46)。EXE **130180760字节**，SHA-256 `57f1af73f761af72d75121284b023a001dad05eb30c0c197e18851cc9a7e8c48`；上传大小/digest一致，匿名完整下载HTTP 200、全部字节与摘要一致。当前源码包复核50后台模块、84Core文件、1698Linux文件及四类一致性通过；本轮核心68/68、桌面758/758、类型/lint、用户站6/6与构建通过。Windows普通EXE四组为同日最终未变产品既有隔离结果；日常OpenDesk父模型只读list_agents 1次成功、返回7个获准节点另证。未签名、未部署远端，原生父模型自主委派/原生页面/独立SSH及完整I06C/I07C/MCP02未准出。后续仅文档状态提交不移动标签。[完整交付、认证恢复与原始证据](I08/alpha46-release.md)。

## 2026-10-21 alpha.36 预发布

公开 alpha.35 的独立修复与当前工作区全部增量整合后，GitHub 预发布 **v0.6.0-alpha.36**，标签冻结合并提交 `1fef25ffa951e219601732e237f675058e6925d8`（含 `b5de577`→`d760584` 的 alpha.35 历史，故本版不再分叉）。本版含 OpenCode 后台宿主生命周期与 1.x/2.x 双协议、DSH Desktop/Web 服务入口、统一管理恢复与原收据校验、MCP/DSH 配置下沉到 Agent 行、CT-07 只读委派列表/连接视图/子会话最小上下文，以及只发布用户页的文档站。[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.36/AgentBridge-0.6.0-alpha.36-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.36/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.36)。EXE **130,032,973 字节**，SHA-256 `43e09dd34e1a86998a446048dd39279a91356189d132c1eae9facebec1472798`；上传返回 digest 与本地一致，匿名不带凭据完整下载全部 130032973 字节后计算摘要与本地一致，校验附件字节一致。冻结包 48 个后台 CJS、81 个 Core 文件、1458 个 Linux 资源与源码一致，ASAR/前端/Windows 与 Linux 后台一致；核心 57/57、桌面 676/676、Windows 契约 144/144、生产前端 26 组与普通 EXE 7 组通过。标签树对打包源逐文件核对 632 项中 612 项一致，差异 20 项全部为冻结后补充的文档与测试，运行/打包源差异 0；EXE 未签名（沿用 `signExecutable=false`）。真实 OpenCode/DSH 模型、用户故障 profile 与独立 SSH 未实测，完整 I06C/I07C 未准出。[交付、首次失败与未测边界](I07/alpha36-delivery.md)。

## 2026-10-20 alpha.35 预发布

issue #12 修复经 [PR #13](https://github.com/wsjq5477/MA-Relay/pull/13) 合并（合并提交 `24d81aa799ab5f221908e38de8e4a9cc44201045`）并随 issue 关闭；标签 **v0.6.0-alpha.35** 固定构建源码 `b5de577980e140150352518c19bb6e9709a2bd20`，后续仅补文档，不移动冻结标签。本版把管理写入与执行准入分开：同机独立节点不再被原管理 unknown 误锁，原操作查询按原 operationId 结算并有逐项反馈，中央新增 `scoped-management-execution-v1` 门禁（复用旧 alpha.34 中央须显式停止重开）。[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.35/AgentBridge-0.6.0-alpha.35-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.35/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.35)。EXE **130,024,572 字节**，SHA-256 `759e36efe2f4ad41cbd273ee17cfe54e6512758574f7bc424458db15f26d8aa1`；两资产 size/digest 与本地一致，匿名分段完整下载按连续字节校验与本地摘要一致，校验附件 HTTP 200 字节一致。冻结源码独立 git archive 构建并逐文件核验，冻结包 43 个后台 CJS、81 个 Core 文件、1452 个 Linux 文件与源码一致，alpha.35 Linux manifest digest 为 `e4db314070688509489ba1a8a2bf3720575d76dd481502884181031e2fae1189`；普通无调试 Windows EXE 五组通过，模型 0。用户现场故障 profile 与完整 I06C/I07C 未验，发布不替代现场验收。[交付、逐项证据与未测边界](I07/scoped-execution-recovery.md)。

## 2026-10-20 alpha.34 预发布

完整源码提交 `1af4dab415d63072be59c103a606df0952ab2ff8` 已推送并固定为标签 **v0.6.0-alpha.34**；旧标签与旧 EXE 不移动。本版整合 OpenCode 1.x/2.x 双协议、独立 MCP、CT-04 公共材料、CT-05 选材包及 alpha.30–33 既有修复。[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.34/AgentBridge-0.6.0-alpha.34-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.34/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.34)。EXE **130,025,537 字节**，SHA-256 `12252dc8627c31f0d7a010c14e8080e3e2673a22586f535e1cc7013662094180`；资产 size/digest 与本地一致，匿名完整下载核验通过。冻结提交下 570 个 tracked 文件逐一匹配独立构建副本，核心 56/56、桌面 592/592，构建/类型/lint/文档检查通过。完整 I06C/I07C 与正式 0.6.0 未准出。[交付记录](I07/alpha34-release.md)。

## 2026-10-20 alpha.33 预发布

PR #11 合并后，GitHub 预发布 **v0.6.0-alpha.33** 绑定合并源码 `ecc47d5679dcc7a1de0a5d746c018f68e169cf4e`；合并树 149 份运行源码/配置/素材与已测试候选逐项摘要一致，因此发布同一已验包字节，后续文档补录不移动标签。[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.33/AgentBridge-0.6.0-alpha.33-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.33/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.33)。EXE **129,965,530 字节**，SHA-256 `84e36905af42ea2adcb15fedbd29fa85cd10a31c91266e8031058802ede62e5e`；上传 size/digest 匹配，匿名分段完整下载与校验附件一致。核心 51/51、隔离桌面 551/551、Windows 专项 7/7、前端 3 组、普通 EXE 5 组及本机 TCP 安装/清理 3 组保持原验收范围；不把发布成功算作用户 profile 或独立生产服务器升级成功。[交付与升级边界](I07/maintenance-persistence.md)。

## 2026-10-19 alpha.32 预发布与整合边界

2026-10-19当前整合仅修改工作文件：Git HEAD仍a872275，读取独立工作树fcdad72冻结产品/9203b18最终文档完成三方整合，原未提交MCP/材料保留。没有commit/push/merge/tag；公开仍alpha.32，本地另有integrated.3候选。[源码清单和交付边界](I07/integrated-source.md)。

2026-10-19当前alpha.32已预发布，源码标签冻结`fcdad72fba454bf731cf66df54bc1caf2a06e0a2`，master包含issues #8/#9修复；EXE与SHA-256附件上传及匿名完整下载一致。EXE 129955724字节，SHA-256 `87adda262cde786ba602971c4d03c5b25a6a0da9ac00e3cdfaba1e7fc5a14440`。普通EXE与现场验收分开，原CT-04/MCP修改未包含，后续文档提交不移动标签。[交付与升级边界](I07/version-management-recovery.md)。

## 2026-10-19 alpha.31 预发布

2026-10-19较早alpha.31已预发布，源码标签冻结`002107da776687474c2d369d9a182a9f81d50e90`，master包含此次issue #7修复。EXE与SHA-256附件已上传并匿名完整下载核验；原工作区CT-04/MCP未提交修改未包含。后续文档提交不移动冻结标签。[当次交付](I07/collaboration-compatibility.md)。

## 2026-10-19 alpha.30 历史详情修复

修复提交`5667304c1133a64d3b68244b0580250ea8b1ba38`已发布为v0.6.0-alpha.30，EXE 129950572字节，SHA-256 `ab17091cb0a38e916a887a83c4c5740f72442e3534b15550e40923592a9b51c2`；[EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.30/AgentBridge-0.6.0-alpha.30-Windows-x64.exe)和[校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.30/SHA256SUMS.txt)完整匿名下载核验一致。145个运行源码/配置/素材冻结后复核，38 CJS/78 core/1401 Linux资源与前端一致。隔离修复没有纳入原工作区CT-04未提交开发；不提交私有profile/原始证据/二进制。[功能、实际验证及边界](I07/history-detail-recovery.md)。

## 2026-10-17 alpha.28 源码与 Windows EXE

修复提交`3df2534ee862afd91c6f0c21e81982099d856789`已推送master，GitHub预发布标签v0.6.0-alpha.28绑定该确切源码；[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.28/AgentBridge-0.6.0-alpha.28-Windows-x64.exe)、[校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.28/SHA256SUMS.txt)公开完整下载验证通过。EXE 129884570字节，SHA-256 `6d85f667c2e1009e26cd83f00afb09ad540b27787e71c5a2784af0e64c4602ef`。34 CJS/78 core/1395 Linux资源及前端匹配源码；普通Windows合成EXE6组通过。[功能、实际测试和未测边界](I06/daemon-rejection-recovery.md)。不提交私有profile、原始日志或二进制，不以分发替代用户现场验收。

## 2026-10-17 alpha.27 与更早发布时点

2026-10-17最新alpha.27已公开预发布，源码标签绑定master修复提交 `6eab64604f2b7e7e9b20a09c85c46444bcb040e0`；EXE/校验文件及完整公开下载均核验。文档同步提交可在产品冻结提交之后；不把源码同步计为新产品测试。[分发、升级与边界](I06/windows-start-persistence.md)。

更新：2026-10-17。当前GitHub预发布为 **alpha.26**，标签绑定冻结源码3efc3d2，分支codex/alpha26-linux-backend-release；EXE恢复对原Linux alpha.24的可信连接及后续维护。master另有I07续接增量，未包含在该EXE中；[发布、升级及实际边界](I06/ssh-alpha24-upgrade.md)。历史记录保留原时点。

## 2026-10-16 alpha.23 源码与 Windows EXE

源码`e8cc95a2abb474571a8d133b99c18e6df6fd61df`已推送至原独立分支及[PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)，未合入master。EXE及校验文件以GitHub prerelease提供；附件state/大小/digest及完整公开下载摘要均已核验，源码/包一致性复核通过。版本、下载、升级方式与实际验收边界见[I07发布记录](I07/github-release.md)。私有运行状态、原始材料及二进制不进入源码树。

## 2026-10-15 alpha.20 预发布分发

[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/AgentBridge-0.6.0-alpha.20-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.20)。标签绑定已验证修复源码 `9b2d5ea792fee431abfc056a385489407c86f152`，源码更新至[PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)的独立修复分支，尚未合入master；本次未包含工作区另有的I07草案。

修复配置准备/NOT_CONFIGURED拒绝后残留占位和节点假忙碌；同机器独立节点可继续工作，同节点和共享目录保留unknown保护，原请求不重发。EXE **129,856,325**字节，SHA-256 `3219d8ae59aea83a2d208e4bb71eb7fdc080a2a812504aa6f506d2cce40e1e41`。GitHub两附件均uploaded，远端大小/digest匹配；公开下载HTTP200，完整EXE下载后SHA-256及校验文本一致。

核心45/45、桌面串行188/188、lint/类型/构建和包内源码一致性通过；Windows普通EXE/隔离合成配置拒绝恢复4组、Edge生产前端/受控API4组通过，模型0。首次并行维护用例ENOENT及后续专项8/8/串行全量复验保留。未复测用户故障机器、独立服务器或真实模型任务；完整I06C仍未准出。

升级先在旧窗口“设置 → 后台运行 → 停止后台并退出”，再打开新EXE；普通关闭窗口会保留旧后台。原机器、节点、请求和历史保留。

## 2026-10-15 alpha.19 预发布分发

[Windows x64 EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.19/AgentBridge-0.6.0-alpha.19-Windows-x64.exe) · [SHA-256 校验](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.19/SHA256SUMS.txt) · [预发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.19) · [源码 PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)。标签绑定已验证合并源码 `fce41beb0a63f96ca5e1bbd69f4c56c69a6d05d3`，独立修复分支尚未合入 master。EXE **129,853,209** 字节，SHA-256 `8841106e626152963f115d50a3c16c0b48c15a7a3aaf9f4be1c67cf7533e7e2a`；远端两附件 uploaded、大小/digest 与本地匹配，公开下载 HEAD 和校验文本核对通过。该证据仅证明分发，不替代用户服务器/原生模型验收。

升级先停止旧 Coordinator 并退出，再打开新 EXE；SSH Ubuntu 仍需在原机器“后台维护 → 升级后台 → 确认升级”后重新连接和扫描。两项发现修复的最终工程与受控/真实 CLI/普通 EXE 边界见 Linux/合并包专项；完整 I06C 尚未准出。

## 2026-10-14 alpha.18 源码与 Windows EXE 分发

修复源码提交 `1f0d9efb98009053761580cc97af10a63b698863` 已推送到 `codex/windows-runtime-recovery-alpha18`，并提交 [PR #1](https://github.com/wsjq5477/MA-Relay/pull/1) 审阅；尚未合入 `master`。`v0.6.0-alpha.18` GitHub prerelease 绑定该确切源码提交，EXE/前端/后台/离线资源已核对一致。默认分支保持原提交，未强制更新。

[Windows x64 EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/AgentBridge-0.6.0-alpha.18-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.18)。EXE **129,851,140** 字节，SHA-256 `2d532ca797e49094314587fcbfa286c9fb58f41374b05f8d21dce0246ee3bc33`；两附件 state=uploaded，远端大小和 digest 与本地一致，发布 draft=false/prerelease=true。公开元数据和下载检查见 [分发证据](../../artifacts/runtime-recovery/2026-10-14/github-release.json)。

桌面 176/176、核心 43/43、lint/类型/构建/文档通过；真实 Windows Electron 资源、Edge 受控响应、普通无调试 EXE/合成旧记录及关闭重开分别通过，模型 0。28 个后台模块和 1383 个 Linux 资源文件与最终源码匹配。未在用户新电脑复测，完整 I06C/正式 0.6.0 未准出，历史原生失败和 unknown 仍按原证据保留。

## 2026-10-14 alpha.16 源码与 Windows EXE

当前源码与文档推送至 `master`，alpha.16 Windows x64 portable EXE 以 GitHub prerelease 分发。测试：根 43/43、桌面 163/163、SSH 恢复 TCP 集成 7/7；`verify-package.cjs --portable` 通过。EXE 129,851,194 字节，SHA-256 `d1e35450e57967767fc5031ba4bdc8dfb5f5552dc374079a4a3005fc5f3223ba`；28 个后台模块、1381 个 Linux 资源，app.asar/前端匹配源码。未执行真实 Windows 流程或独立服务器维护重验，完整 I06C 未准出。

## 2026-10-14 alpha.15 源码与 Windows EXE 发布

当前源码提交 `15b7c9ea9c3d53802797b655e0cffaf365658574` 已推送至 `master`；Windows x64 EXE 作为 [v0.6.0-alpha.15 GitHub 预发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.15)提供。附件大小 129,851,710 字节，远端 SHA-256 `d1052ed5cd7893a9842ee96b6bf87c40b2ec6a5389ac59ef28ad5eb528e0ac4f` 与本地相同。[EXE 直接下载](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.15/AgentBridge-0.6.0-alpha.15-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.15/SHA256SUMS.txt)。

本地重建在 WSL Ubuntu / Node 22.23.1 执行；发布提交根测试 43/43、桌面测试 159/159、文档检查通过，包一致性校验确认 28 个后台模块、1380 个 Linux 资源文件及 app.asar/前端与源码一致。本次没有重新执行真实 Windows 用户流程；完整 I06C 仍未准出。公开源码不包含 `artifacts/` 私有验收材料或 EXE，二进制只通过 Release 附件分发。

发布后仅新增桌面受控测试用例与本地报告路径隔离，没有改动产品源码；当前桌面回归 163/163，通过的 TAP 只保存在本地忽略目录，不上传原始验收材料。

## 2026-10-13 alpha.9 EXE 单独发布

2026-10-13：alpha.9 Windows x64 EXE 已作为 GitHub 预发布附件提供，[下载程序](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.9/AgentBridge-0.6.0-alpha.9-Windows-x64.exe)、[发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.9)。用户无需自行编译或安装 WSL/Node.js 来运行 AgentBridge。稳定历史版本仍为 0.5.0；这次发布不代表完整 I06C 或正式 0.6.0 准出，也没有将本地 alpha.10 源码/程序同步到该标签。

EXE 与 [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.9/SHA256SUMS.txt) 保存在 Release 附件，不加入 Git 源码树。源码标签绑定提交 `2b6f4f71c19608be878fc33dc1be422a6fd349e9`；本次不重建程序、不改变原始验收结论。完整分层记录见 [发布记录](I06/github-release.md)。

## 2026-10-13 源码同步检查（沙箱回归未通过）

2026-10-13，在 WSL 项目沙箱使用 Node 22.23.1 执行：完整本地文档检查、根与桌面 TypeScript 检查、根 lint、根构建及桌面 TypeScript/Vite 构建通过。文档检查覆盖 114 个 Markdown 文件、14 对模块设计/报告及 1367 个本地链接。

本次 `npm test` 未通过，测试运行器报告 14 个测试文件中 10 个失败；`npm test --prefix desktop` 未通过，19 个测试文件中 6 个失败。这是本次沙箱执行结果，不覆盖历史真实 Agent/EXE 证据，也不将失败归因于尚未核实的环境问题。单独直接运行 CLI 入口测试，`stdout.includes('agentbridge up')` 断言失败；本次源码同步未修改该产品行为。原始检查输出保留在执行环境的临时目录，不上传公开仓库。
