# I07 alpha.24 GitHub预发布记录

当前最新Windows预发布为 **alpha.26**：[直接下载EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.26/AgentBridge-0.6.0-alpha.26-Windows-x64.exe)、[校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.26/SHA256SUMS.txt)，补收原Linux alpha.24/alpha.25可信清单并保留既有原请求恢复；[冻结源码与分发记录](../I06/ssh-alpha24-upgrade.md)。以下alpha.25/alpha.24/alpha.23为各次发布历史。

alpha.25历史发布说明，包含本页I07功能和后续原请求恢复/不完整收据修复；[直接下载EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.25/AgentBridge-0.6.0-alpha.25-Windows-x64.exe)、[校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.25/SHA256SUMS.txt)、[发布及升级](../I06/windows-context-recovery.md)。以下保留alpha.24/alpha.23发布时点及其冻结包证据。

日期：2026-10-17。已发布 **0.6.0-alpha.24**，draft=false、prerelease=true。

- [Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.24/AgentBridge-0.6.0-alpha.24-Windows-x64.exe)
- [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.24/SHA256SUMS.txt)
- [GitHub预发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.24)

标签绑定冻结产品源码 `34d90b5a8202743c808e183fd288ae7ab93d28ac`；EXE 129879755字节，SHA-256 `ca3ced24582114978005be6827c145fb7c89608d0fb5bf35ae5b2ecea736f795`。GitHub两附件均uploaded，大小及digest匹配本地。

包含小队停止、等待展示及原生终态核对；既有实测范围见[停止专项](native-stop.md)及各权限专项。本次发布不重复模型测试。2026-10-17[不完整收据修复](incomplete-receipt.md)在后续开发提交 `3a97262`，未包含于冻结EXE；本次专项45/45通过。分支 `codex/windows-runtime-recovery-alpha18` 已推送，PR #1未合入master。完整I07C/I06C仍未准出。

升级前在旧窗口“设置 → 后台运行 → 停止后台并退出”，再运行新EXE。SSH机器另需“后台维护 → 升级后台 → 确认升级”后重新连接扫描。不要覆盖运行数据降级至旧格式版本。

以下保留alpha.23历史发布证据。

# I07 alpha.23 GitHub预发布记录

日期：2026-10-16。发布版本 **0.6.0-alpha.23**，状态 **draft=false / prerelease=true**。稳定历史版仍为0.5.0；完整I07C/I06C与正式0.6.0未准出。

## 下载与升级

- [Windows x64便携EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.23/AgentBridge-0.6.0-alpha.23-Windows-x64.exe)
- [SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.23/SHA256SUMS.txt)
- [GitHub预发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.23)
- [源码PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)

升级前在旧窗口“设置 → 后台运行 → 停止后台并退出”，再运行新EXE；普通关闭窗口会保留旧后台。SSH机器另需“后台维护 → 升级后台 → 确认升级”后重新连接和扫描。小队SQLite自动迁移至格式3，旧alpha.22不能读取新格式，不覆盖运行数据降级。Windows桌面运行不要求用户安装WSL/Node.js；原生Agent沿用自己的安装与配置。

## 源码和二进制绑定

| 对象 | 本次实际结果 |
| --- | --- |
| 标签 | `v0.6.0-alpha.23` |
| 确切产品源码提交 | `e8cc95a2abb474571a8d133b99c18e6df6fd61df` |
| 分支 | `codex/windows-runtime-recovery-alpha18`，已推送并更新PR #1，未合入master |
| Windows附件 | `AgentBridge-0.6.0-alpha.23-Windows-x64.exe`，129,877,607字节 |
| EXE SHA-256 | `17cded899fe491eabc08c7a39ad50fb0d4ac5fadc53444bd36525fe6c260c343` |
| 附件核验 | EXE及109字节校验文件均uploaded，GitHub大小/digest匹配本地 |
| 公开下载 | 两附件HTTP200；完整下载并计算SHA-256，与本地匹配 |
| 包内源码 | 32个后台CJS、78个core文件、1389个Linux清单条目及app.asar/前端匹配 |

源码提交先记录本地候选证据；标签固定该产品提交，后续发布状态文档单独提交，不改EXE或重写标签。原始私有验收材料及EXE不进入Git源码树。

分发原始证据：[GitHub发布元数据](../../../artifacts/I07C/2026-10-16/github-release.json)、[附件上传核验](../../../artifacts/I07C/2026-10-16/github-upload.json)、[完整公开下载](../../../artifacts/I07C/2026-10-16/github-download.json)、[发布前包复核](../../../artifacts/I07C/2026-10-16/package-publish.json)。这些材料证明分发状态，不替代产品验收。

## 范围与验证

包含I07A功能智能体登记和小队公共文档/群消息、I07B任务板与精确版本返修交接，以及I07C首批重要事件激活、累计预算、Claude主角色原会话续接和原生真实终态后验收。Bridge负责连接、权限、消息、任务及结果，不实现成员业务能力。

发布前已执行核心45/45、最终串行桌面222/222、Windows契约29/29、受控界面10组、普通EXE5组，lint/类型/构建及包一致性通过。真实Claude Code2.1.299主角色3次自动激活并在后台重启后续接原会话；开发/编译员为受控外部MCP成员，Node语法检查实际运行。发布时复核文档及源码/包对应，不重复调用模型。

真实多原生角色自动链、用户自研入口、独立SSH自动小队、Windows原生自动模型链、Codex/OpenCode自动续接及完整停止仍未验收。首次失败及准确环境/证据层级保留于[I07C首批交付](automation.md)。停止自动调度不会取消在途原生任务。

本次发布文档同步后执行`node scripts/check-docs.mjs`通过：135个Markdown、14对模块设计/报告、2208个本地链接、59个图表、93个模块功能及265条用例定义（不是本次执行数量）。[实际结果](../../../artifacts/I07C/2026-10-16/docs-publish-final.json)。
