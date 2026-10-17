# 远端源码范围

更新：2026-10-16。目标仓库：https://github.com/wsjq5477/MA-Relay 。当前源码及GitHub预发布版本为 0.6.0-alpha.23；本次同步源码和 Windows 预发布不代表正式 0.6.0，也不改变既有验收结论。alpha.9 首次同步记录保留为历史结果。

仓库包含源码、测试、构建脚本、依赖锁文件、模块设计和迭代资料。原生配置、开发运行状态、凭据、原始验收材料、依赖目录、构建输出和 Windows EXE 保留在本地，不随源码提交。历史文档中的实际任务、请求和会话标识已脱敏。

文档中 `artifacts/` 和 `desktop/release/` 的相对链接指向本地原始材料；新克隆仓库不包含这些文件。报告保留原日期、证据级别和未测项，不能把源码同步当作重新执行历史验收。

`node scripts/check-docs.mjs` 检查完整本地资料，其中包含原始材料和发布包。仅有源码的克隆缺少这些链接目标时，应补齐经授权的本地材料后再执行完整资料检查，不能据此声称历史验证已通过。

## 本次同步检查

2026-10-13，在 WSL 项目沙箱使用 Node 22.23.1 执行：完整本地文档检查、根与桌面 TypeScript 检查、根 lint、根构建及桌面 TypeScript/Vite 构建通过。文档检查覆盖 114 个 Markdown 文件、14 对模块设计/报告及 1367 个本地链接。

本次 `npm test` 未通过，测试运行器报告 14 个测试文件中 10 个失败；`npm test --prefix desktop` 未通过，19 个测试文件中 6 个失败。这是本次沙箱执行结果，不覆盖历史真实 Agent/EXE 证据，也不将失败归因于尚未核实的环境问题。单独直接运行 CLI 入口测试，`stdout.includes('agentbridge up')` 断言失败；本次源码同步未修改该产品行为。原始检查输出保留在执行环境的临时目录，不上传公开仓库。

## EXE 单独发布

2026-10-13：alpha.9 Windows x64 EXE 已作为 GitHub 预发布附件提供，[下载程序](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.9/AgentBridge-0.6.0-alpha.9-Windows-x64.exe)、[发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.9)。用户无需自行编译或安装 WSL/Node.js 来运行 AgentBridge。稳定历史版本仍为 0.5.0；这次发布不代表完整 I06C 或正式 0.6.0 准出，也没有将本地 alpha.10 源码/程序同步到该标签。

EXE 与 [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.9/SHA256SUMS.txt) 保存在 Release 附件，不加入 Git 源码树。源码标签绑定提交 `2b6f4f71c19608be878fc33dc1be422a6fd349e9`；本次不重建程序、不改变原始验收结论。完整分层记录见 [发布记录](iterations/I06/github-release.md)。

## 2026-10-14 alpha.15 源码与 Windows EXE 发布

当前源码提交 `15b7c9ea9c3d53802797b655e0cffaf365658574` 已推送至 `master`；Windows x64 EXE 作为 [v0.6.0-alpha.15 GitHub 预发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.15)提供。附件大小 129,851,710 字节，远端 SHA-256 `d1052ed5cd7893a9842ee96b6bf87c40b2ec6a5389ac59ef28ad5eb528e0ac4f` 与本地相同。[EXE 直接下载](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.15/AgentBridge-0.6.0-alpha.15-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.15/SHA256SUMS.txt)。

本地重建在 WSL Ubuntu / Node 22.23.1 执行；发布提交根测试 43/43、桌面测试 159/159、文档检查通过，包一致性校验确认 28 个后台模块、1380 个 Linux 资源文件及 app.asar/前端与源码一致。本次没有重新执行真实 Windows 用户流程；完整 I06C 仍未准出。公开源码不包含 `artifacts/` 私有验收材料或 EXE，二进制只通过 Release 附件分发。

发布后仅新增桌面受控测试用例与本地报告路径隔离，没有改动产品源码；当前桌面回归 163/163，通过的 TAP 只保存在本地忽略目录，不上传原始验收材料。

## 2026-10-14 alpha.16 源码与 Windows EXE

当前源码与文档推送至 `master`，alpha.16 Windows x64 portable EXE 以 GitHub prerelease 分发。测试：根 43/43、桌面 163/163、SSH 恢复 TCP 集成 7/7；`verify-package.cjs --portable` 通过。EXE 129,851,194 字节，SHA-256 `d1e35450e57967767fc5031ba4bdc8dfb5f5552dc374079a4a3005fc5f3223ba`；28 个后台模块、1381 个 Linux 资源，app.asar/前端匹配源码。未执行真实 Windows 流程或独立服务器维护重验，完整 I06C 未准出。

## 2026-10-14 alpha.18 源码与 Windows EXE 分发

修复源码提交 `1f0d9efb98009053761580cc97af10a63b698863` 已推送到 `codex/windows-runtime-recovery-alpha18`，并提交 [PR #1](https://github.com/wsjq5477/MA-Relay/pull/1) 审阅；尚未合入 `master`。`v0.6.0-alpha.18` GitHub prerelease 绑定该确切源码提交，EXE/前端/后台/离线资源已核对一致。默认分支保持原提交，未强制更新。

[Windows x64 EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/AgentBridge-0.6.0-alpha.18-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.18)。EXE **129,851,140** 字节，SHA-256 `2d532ca797e49094314587fcbfa286c9fb58f41374b05f8d21dce0246ee3bc33`；两附件 state=uploaded，远端大小和 digest 与本地一致，发布 draft=false/prerelease=true。公开元数据和下载检查见 [分发证据](../artifacts/runtime-recovery/2026-10-14/github-release.json)。

桌面 176/176、核心 43/43、lint/类型/构建/文档通过；真实 Windows Electron 资源、Edge 受控响应、普通无调试 EXE/合成旧记录及关闭重开分别通过，模型 0。28 个后台模块和 1383 个 Linux 资源文件与最终源码匹配。未在用户新电脑复测，完整 I06C/正式 0.6.0 未准出，历史原生失败和 unknown 仍按原证据保留。

## 2026-10-15 alpha.19 预发布分发

[Windows x64 EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.19/AgentBridge-0.6.0-alpha.19-Windows-x64.exe) · [SHA-256 校验](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.19/SHA256SUMS.txt) · [预发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.19) · [源码 PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)。标签绑定已验证合并源码 `fce41beb0a63f96ca5e1bbd69f4c56c69a6d05d3`，独立修复分支尚未合入 master。EXE **129,853,209** 字节，SHA-256 `8841106e626152963f115d50a3c16c0b48c15a7a3aaf9f4be1c67cf7533e7e2a`；远端两附件 uploaded、大小/digest 与本地匹配，公开下载 HEAD 和校验文本核对通过。该证据仅证明分发，不替代用户服务器/原生模型验收。

升级先停止旧 Coordinator 并退出，再打开新 EXE；SSH Ubuntu 仍需在原机器“后台维护 → 升级后台 → 确认升级”后重新连接和扫描。两项发现修复的最终工程与受控/真实 CLI/普通 EXE 边界见 Linux/合并包专项；完整 I06C 尚未准出。

## 2026-10-15 alpha.20 预发布分发

[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/AgentBridge-0.6.0-alpha.20-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.20/SHA256SUMS.txt)、[预发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.20)。标签绑定已验证修复源码 `9b2d5ea792fee431abfc056a385489407c86f152`，源码更新至[PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)的独立修复分支，尚未合入master；本次未包含工作区另有的I07草案。

修复配置准备/NOT_CONFIGURED拒绝后残留占位和节点假忙碌；同机器独立节点可继续工作，同节点和共享目录保留unknown保护，原请求不重发。EXE **129,856,325**字节，SHA-256 `3219d8ae59aea83a2d208e4bb71eb7fdc080a2a812504aa6f506d2cce40e1e41`。GitHub两附件均uploaded，远端大小/digest匹配；公开下载HTTP200，完整EXE下载后SHA-256及校验文本一致。

核心45/45、桌面串行188/188、lint/类型/构建和包内源码一致性通过；Windows普通EXE/隔离合成配置拒绝恢复4组、Edge生产前端/受控API4组通过，模型0。首次并行维护用例ENOENT及后续专项8/8/串行全量复验保留。未复测用户故障机器、独立服务器或真实模型任务；完整I06C仍未准出。

升级先在旧窗口“设置 → 后台运行 → 停止后台并退出”，再打开新EXE；普通关闭窗口会保留旧后台。原机器、节点、请求和历史保留。

## 2026-10-16 alpha.23 源码与Windows EXE

源码`e8cc95a2abb474571a8d133b99c18e6df6fd61df`已推送至原独立分支及[PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)，未合入master。EXE及校验文件以GitHub prerelease提供；附件state/大小/digest及完整公开下载摘要均已核验，源码/包一致性复核通过。版本、下载、升级方式与实际验收边界见[I07发布记录](iterations/I07/github-release.md)。私有运行状态、原始材料及二进制不进入源码树。
