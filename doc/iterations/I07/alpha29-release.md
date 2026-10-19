# I07 alpha.29 当前源码与 Windows 发布

日期：2026-10-19（北京时间）。用户要求将当前全部修改生成 EXE、创建新标签并发布 GitHub。版本 `0.6.0-alpha.29`，产品基于 `9e867ea`；包含 UI 重构、原生适配器扩展、当前 PATH 发现、空闲刷新/隐藏启动、原生协作准入与 CT-01 连接能力。CT-02 原生证据保留原日期和环境，不冒充本次 EXE 模型实测。

## 需求、开发与版本边界

M10-F01/F02/F03/F05/F06：新版本重新构建全部当前源码，旧 alpha.28、ui.2 与 poll.4 字节保留。桌面 package/lock 同步为 alpha.29；收录原 alpha.28 Linux manifest，规范 SHA-256 `b06a14fe3716c2df46cb665e21f137d05aab6046a611cb0275c5cadbc365d00d`，与既有冻结交付记录核对一致，不信任任意未知后台。

没有新增产品协议、存储结构或模型 API；本次版本与打包变化落在 M10。全模块设计及测试报告沿用 `9e867ea` 同步材料，新发布状态以本页为准，历史“未发布”均指各专项当时状态。完整 I06C/I07C 仍未准出，Hermes/Pi/DSH 真实模型、用户故障机及独立 SSH 升级未验。

## 构建、验收与发布

冻结产品源码 `23d256e15b3e7df5e9058fb72f58672862680692`，标签 `v0.6.0-alpha.29` 已推送，GitHub 预发布 draft=false/prerelease=true，EXE和校验附件均uploaded，大小与GitHub SHA-256 digest匹配。EXE 为129,952,156字节，SHA-256 `fdee0e069196f6314bb437b939bb358575c68c2fa429464706845240f1edf6d7`。

| 检查 | 实际结果与原始证据 |
| --- | --- |
| 核心工程 | WSL Linux / Node22.23.1，45/45，无跳过；[日志](../../../artifacts/releases/0.6.0-alpha.29/core-local.log) |
| 桌面全量 | 串行517/517，无跳过，受控子进程/socket/SQLite，不是新EXE模型验收；[日志](../../../artifacts/releases/0.6.0-alpha.29/desktop-local.log) |
| 构建与包 | 根TypeScript及桌面TypeScript/Vite构建通过，保留大于500KB单包提示；38后台CJS、78核心文件、1400Linux资源、窗口ASAR与前端一致；[完整构建/包核验](../../../artifacts/releases/0.6.0-alpha.29/build.log) |
| 普通 Windows EXE | Windows Node24.19.0，隔离profile、无debug参数，四项启动/IPC/SQLite/关闭重开/后台重启检查通过；模型0，观察到10条原生历史作为只读基线保留，原请求身份集合不增不重放；[报告](../../../artifacts/releases/0.6.0-alpha.29/windows-portable.json) |
| 原源码冻结 | 146个运行源码/配置/素材文件摘要，打包结束后再次核对一致；[清单](../../../artifacts/releases/0.6.0-alpha.29/source-files.json) |
| EXE与校验 | [EXE](../../../artifacts/releases/0.6.0-alpha.29/AgentBridge-0.6.0-alpha.29-Windows-x64.exe)、[SHA256SUMS](../../../artifacts/releases/0.6.0-alpha.29/SHA256SUMS.txt) |
| 文档 | check-docs通过，git diff --check通过；[日志](../../../artifacts/releases/0.6.0-alpha.29/docs.log) |

首轮受限沙箱核心测试仅文件级3通过/11失败，桌面仅文件级32通过/15失败（[原日志](../../../artifacts/releases/0.6.0-alpha.29/desktop.log)），保留[原日志](../../../artifacts/releases/0.6.0-alpha.29/core.log)，不把它们计为实际用例数；允许本机进程/socket后上述全量通过。Windows脚本首次因wslpath不能转换尚不存在的报告文件而缺少参数，在启动EXE前失败；改为转换已存在父目录后继续，保留[首次参数失败](../../../artifacts/releases/0.6.0-alpha.29/windows-portable-initial.log)。原始证据在 artifacts 中保存，不进入Git源码/发布附件；报告与摘要随交付文档保留。

## 下载与升级

- [GitHub alpha.29预发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.29)
- [Windows x64 EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.29/AgentBridge-0.6.0-alpha.29-Windows-x64.exe)
- [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.29/SHA256SUMS.txt)

公开匿名下载EXE与校验文件均HTTP200；完整流式下载重新计算SHA-256及字节数，与本地和GitHub附件digest一致。[公开下载原始记录](../../../artifacts/releases/0.6.0-alpha.29/public-download.json)。

升级前在旧程序“设置 → 后台运行 → 停止后台并退出”，再打开新 EXE；普通关窗会保留旧后台。SSH 如需本版后台修复，另执行“后台维护 → 升级后台 → 确认升级”，再连接扫描；本轮不自动升级用户远端。unknown 操作继续查询原 requestId/operationId，不新建 ID 重派。不要覆盖运行数据降级至旧版。

发布后的文档补录提交仅更新证据与发布状态，不改变标签绑定源码或EXE字节。Linux离线清单digest为`71ac17c760bc26122581c06bf1a2b0522234e62040312c4a6c1aeec4e6084983`。
