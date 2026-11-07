# I08 alpha.74 发布记录

2026-11-07。公开预发布 0.6.0-alpha.74，冻结 `07f46dd5a55df6f1eddb3a72d367cb8b88a28f0d`，标签 `v0.6.0-alpha.74`；包含目标机器创建 Hermes/Pi 自定义运行时、图标两步向导和此前 master 的 Windows worker 发布修复。 [GitHub 发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.74)

Windows x64 便携 EXE **132436666 字节**，SHA-256 `21eeb101d70beecdc2d24e8e5bc5f0ae0193a9c1e0d748546c39dc4d0b9da51f`；未签名。[下载](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.74/AgentBridge-0.6.0-alpha.74-Windows-x64.exe) · [SHA-256](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.74/SHA256SUMS.txt)

## 内容与边界

本机、WSL 和 SSH Linux 目标由自己的 MachineHost 解析程序、版本探测并私有保存配置；认证 daemon 的创建方法纳入维护门禁，旧后台提示维护升级，不自动替换或回退本机。第一步点击 Hermes/Pi 图标，第二步填写名称、命令和可选描述。Pi 固定 argv、JSON-print 与原会话文件/目录校验复用既有宿主；旧 Hermes 配置不迁移，同一配置 ID 不允许换协议，仍须既有接入与授权。

Windows worker 对瞬时目录锁定在原预算内重试，核验并发或损坏发布目录，清理不覆盖原始错误，原 Task 不重发。

[Pi 开发证据](custom-runtime-pi.md) · [远端创建与界面](custom-runtime-remote-ui.md) · [worker 修复](codex-runtime-publish-recovery.md)

## 实际验证

发布源码与构建独立位于 E 盘。277 产品输入与冻结提交逐字节摘要一致。Core 类型检查/编译、桌面 TypeScript/Vite 构建及 Linux 离线 staging 通过，模型调用为零。

| 证据层 | 实际结果 |
| --- | --- |
| Windows 冻结源联合定向 | 65 项：45通过、1失败、19项 Linux 平台跳过。失败为既有 WSL 快照时限断言；单独复验1/1通过，首轮失败保留 |
| Windows Electron44.7.0/ICU | 隔离 worker 发布/复用/损坏修复三组通过，不调用模型 |
| 独立 Ubuntu24.04 CI | Core87/87、原生适配113/113、自定义配置与认证daemon25/25、机器/SSH99/99、维护105/105；原生Hermes0.22.5 MCP五组通过，模型0。各组不累计为全矩阵 |
| 实际包内容 | 后台/Core/ASAR/前端/bootstrap/Linux离线资源与冻结源匹配；实际EXE解包 3518 文件，路径、大小、SHA-256与未压缩输出一致 |
| 实际 EXE 运行时 | 提取出的 Electron 执行包内生产模块，自定义 Hermes/Pi、配置兼容、原 Task 恢复、Pi原 Session 续聊共7/7；测试脚本独立复制，修正CJS夹具启动、延长测试预算并在清理阶段先关闭所属MCP子进程；生产模块与依赖仅来自实际EXE，原首轮夹具探测失败和清理超时单列保留 |
| 普通 EXE | 首轮普通启动/材料读取通过，旧关闭辅助器在30秒内未等到包装器退出，原轮失败保留；改用核对窗口句柄的辅助器和180秒退出观察，在同一原profile只读重开/完整后台重启/两次正常关闭三组通过，模型0。测试观察预算360秒，不作为启动性能准出 |
| 开发界面 | Hermes/Pi各1440/1024/390三宽度，共六组通过；目标SSH Linux为受控后台数据，不能当生产SSH闭环 |
| 公开下载 | EXE 与 SHA 文件均匿名 HTTP200 完整下载，并与本地原件逐字节相等 |
| 文档 | 候选及发布后均3065项历史证据链接错误，本轮新增记录与链接无报错，不宣称完整文档全绿 |

独立CI：[运行42337270233](https://github.com/wsjq5477/MA-Relay/actions/runs/42337270233)。真实用户自定义命令/模型、生产SSH与完整原生/跨机/性能矩阵仍未验收。源码受控CLI、Linux实际daemon、原生Hermes无模型MCP和实际EXE各层证据分别成立，不互相代替。

## 原始证据

包内测试初轮不是有效准出：PowerShell GUI子系统直调没有测试输出；随后执行的原始夹具把Electron当普通Node而版本探测失败，MCP测试子进程占用待删除的临时Electron文件导致清理超时。只调整测试脚本（CJS命令、240秒用例/60秒轮询预算、清理阶段关闭所属测试MCP客户端），未改生产模块或EXE。原始失败、最终7/7和普通GUI首轮/原profile复验均分别保留。

[包内初轮](../../../artifacts/release-alpha74/2026-11-07/package-runtime-first-partial.tap) · [包内验证边界](../../../artifacts/release-alpha74/2026-11-07/runtime-check.json) · [原profile退出复验](../../../artifacts/release-alpha74/2026-11-07/portable-gui-revalidation.json)

[冻结源](../../../artifacts/release-alpha74/2026-11-07/source-binding.json) · [输入清单](../../../artifacts/release-alpha74/2026-11-07/source-inputs.json) · [实际包](../../../artifacts/release-alpha74/2026-11-07/package-check.json) · [EXE载荷](../../../artifacts/release-alpha74/2026-11-07/payload-check.json) · [包内测试](../../../artifacts/release-alpha74/2026-11-07/package-runtime.tap) · [普通portable](../../../artifacts/release-alpha74/2026-11-07/portable-gui.json)

[Windows首轮](../../../artifacts/release-alpha74/2026-11-07/windows-targeted.tap) · [WSL时限复验](../../../artifacts/release-alpha74/2026-11-07/wsl-timeout-rerun.tap) · [CI摘要](../../../artifacts/release-alpha74/2026-11-07/ci-summary.json) · [Linux新专项](../../../artifacts/release-alpha74/2026-11-07/linux-custom-runtime.tap) · [匿名下载](../../../artifacts/release-alpha74/2026-11-07/published.json) · [非C目录](../../../artifacts/release-alpha74/2026-11-07/environment-check.json)

[发布后文档检查](../../../artifacts/release-alpha74/2026-11-07/docs-after-publication.json)
