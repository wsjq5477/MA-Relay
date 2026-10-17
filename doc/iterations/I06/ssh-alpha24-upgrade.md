# alpha.24 Linux 后台连接与升级恢复

日期：2026-10-17。关联 AB-F05/F06/F17、M04-F04/F05/F08、M10-F02/F03/F04/F06，以及 I06 SSH/DMN/REL 的可信接入与升级范围。已发布 **0.6.0-alpha.26** GitHub预发布，冻结标签绑定源码 `3efc3d2`。完整 I06C/I07C 未准出。

## 需求与原因

用户报告最新 Windows 程序拒绝连接原 Linux **alpha.24** 后台。alpha.25 的 Linux 资源索引只含 alpha.2–alpha.19 的可信旧清单，漏收 alpha.24；`SshInstaller.release()` 因而返回 `SSH_DAEMON_UPGRADE_REQUIRED`。界面“后台维护”要求机器在线，维护预览也要经过同一版本校验，所以原客户端不能通过该入口升级这台机器。

验收目标：新客户端严格验证并连接原 alpha.24，保持原 daemon/机器身份与已安装版本；用户确认维护后可使用新离线资源升级。正常重连不自动替换后台，不重发任务。未知版本、摘要变化、目录别名和未确认执行仍按原规则阻断。

## 设计与实现

从历史 alpha.24 Windows EXE 提取原 Linux 清单，与当时包报告的 manifest digest 核对；同时收录 alpha.25 冻结清单，防止新候选拒绝上一版后台。没有修改协议、运行时路由、任务台账、数据格式或权限边界，architecture/data-model/protocol 无须迁移。没有放宽未知版本信任，也没有改成允许所有低版本。

| 可信旧版本 | 清单 SHA-256（JSON 解析后重新序列化，与安装摘要一致） | 来源 |
| --- | --- | --- |
| alpha.24 | `e631db77604099d70c96bf7c7d85657bb957a3dd251a2ae91ad89fc33c7b9955` | [清单](../../../desktop/compatible-daemons/0.6.0-alpha.24.json)、[历史包报告](../../../artifacts/I07C-stop/2026-10-16/package.json) |
| alpha.25 | `54ada2b6d01fd9537de00e93b277f2cae50de5d969ebefc08544b49647654146` | [清单](../../../desktop/compatible-daemons/0.6.0-alpha.25.json)、[历史包复核](../../../artifacts/windows-context-recovery/2026-10-17/package-publish.json) |

源码修改限于两份清单、桌面版本/锁文件及 [SSH 回归](../../../desktop/tests/ssh-compatibility.test.cjs)。候选从冻结 HEAD 加上述产品文件构建，未包含工作区另有的 I07 首次续接 Conversation 增量；核心和 CJS 运行时沿用原发布源码。生产依赖复用原发布暂存闭包，未改变锁文件依赖；首次离线 npm ci 缺缓存失败保留日志，之后使用已存在依赖闭包构建。

## 实际验证与边界

WSL Ubuntu / Node22.23.1；模型 Prompt 数为 0。结果以本页后续实际记录和原始报告为准。

| 范围 | 结果 | 证据 |
| --- | --- | --- |
| 原 alpha.25 与新包对照 | 原包选择 alpha.24 返回 `SSH_DAEMON_UPGRADE_REQUIRED`；候选精确匹配 alpha.24/alpha.25 原摘要 | [对照报告](../../../artifacts/ssh-alpha24-recovery/2026-10-17/baseline-and-fix.json) |
| SSH 兼容/安全/恢复/维护回归 | 36/36 通过；包含可信复用、摘要与目录拒绝、真实后台升级/回滚、原维护去重及本机 TCP SSH 连接恢复 | [TAP](../../../artifacts/ssh-alpha24-recovery/2026-10-17/ssh-regression.tap) |
| 核心/前端构建 | 类型及构建通过，保留既有 Vite 体积提示 | [构建日志](../../../artifacts/ssh-alpha24-recovery/2026-10-17/build.log) |
| 候选资源 | 窗口、冻结后台、Linux 资源与隔离冻结源码一致 | [包报告](../../../artifacts/ssh-alpha24-recovery/2026-10-17/package.json) |
| 原冻结包真实 SSH 升级 | 4组通过：1390文件核验、生产 SSH 重连保留原 PID/身份、真实 SFTP 维护升级到 alpha.26、查询原操作不重复切换 | [报告](../../../artifacts/ssh-alpha24-recovery/2026-10-17/real-package-upgrade.json)、[脚本](../../../artifacts/ssh-alpha24-recovery/2026-10-17/real-package-upgrade.cjs) |
| Windows 普通 EXE | 5组通过：实际冻结清单、原请求恢复/unknown保留、窗口关闭重开、完整后台重启无重放、冻结代码一致；Node24.19.0，模型0 | [报告](../../../artifacts/ssh-alpha24-recovery/2026-10-17/windows-portable.json)、[脚本](../../../artifacts/ssh-alpha24-recovery/2026-10-17/windows-portable.cjs) |
| Linux 独立离线资源归档 | 1392个manifest文件及manifest JSON与冻结包一致，逐文件大小/SHA-256核验 | [报告](../../../artifacts/ssh-alpha24-recovery/2026-10-17/linux-archive.json) |

最初受限的 Node --test 和 cc spawn 失败保留；授权本地进程/socket环境下的最终回归及构建单独记录。新增用例的前两次夹具缺文件/缺 previous.json 失败日志保留，修正夹具后 9/9 通过；未改产品校验来绕过用例。真实 SSH 端到端脚本的首次状态目录/后续原解包布局准备失败亦保留，不能计为产品通过。原解包副本不等于生产安装布局：夹具改为仅复制manifest条目并按生产方式设置私有目录/文件权限，产品逻辑没有改动；最终真实TCP SSH链通过。

本次不把本机受控 TCP SSH 当成用户独立服务器，不把保留合成文件当真实原生任务迁移。未测试用户故障服务器或真实模型任务。alpha.20–alpha.23 未在本片补收，其他未列入清单版本仍拒绝；未实现任意不兼容版本的离线维护入口。

## 用户升级

1. 在旧 Windows 窗口“设置 → 后台运行 → 停止后台并退出”，再启动 alpha.26 EXE；普通关闭窗口会保留旧中央后台。
2. 在原机器点击重新连接，必要时提供原 SSH 凭据。连接先复用并校验原 alpha.24 后台，机器和任务沿用原身份。
3. 需要同步 Linux 后台时，使用原机器“后台维护 → 升级后台 → 确认升级”，完成后重新连接和扫描。忙、等待、unknown 或未确认控制会阻止维护，先查询原操作。

Linux 后台及私有 Node 随 Windows EXE 的 `linux-package` 内置资源交付，客户端通过 SSH 用户态部署，无须 sudo/npm install。现有发布只有 Windows 桌面程序附件，没有 Linux 桌面版或独立一键升级程序。不能直接解压覆盖正在运行的原安装，也不需要删除原 profile 或改 operationId。

## 程序与摘要

EXE、Linux资源包和校验文件已复制到Windows下载目录，目标文件摘要逐一匹配，见[本机交付核验](../../../artifacts/ssh-alpha24-recovery/2026-10-17/windows-delivery.json)。

本地候选 [Windows x64 EXE](../../../desktop/release/AgentBridge-0.6.0-alpha.26-Windows-x64.exe)，**129,881,117 bytes**，SHA-256 `2a796481261d9caf2788aa87f5d40114ed372a85cc0300fc71c1cc5106845ce2`。包内33个后台CJS、78个核心文件、1392个Linux清单条目与冻结构建匹配。源码边界见[冻结输入](../../../artifacts/ssh-alpha24-recovery/2026-10-17/frozen-source.json)，基线提交 `6bf680a`；以上为构建验收时的候选；现已按下节发布为GitHub预发布，EXE字节与摘要保持一致。

另提供 [Linux x64 daemon 离线资源包](../../../desktop/release/AgentBridge-0.6.0-alpha.26-Linux-x64-daemon.tar.gz)及[两包校验文件](../../../artifacts/ssh-alpha24-recovery/2026-10-17/SHA256SUMS.txt)。归档根为 `linux-package/`，包含同一份私有Node、后台、依赖和manifest，不是Linux桌面版或独立一键升级器；原机器仍由客户端可信维护升级，不能把整个归档直接覆盖原版本目录。归档的独立分发不改变机器安装/owner/profile/原请求规则。

## GitHub EXE 预发布分发

2026-10-17已发布，draft=false、prerelease=true：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.26/AgentBridge-0.6.0-alpha.26-Windows-x64.exe)、[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.26/SHA256SUMS.txt)、[发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.26)。标签 `v0.6.0-alpha.26` 绑定冻结源码 `3efc3d282ebb11f284d275621012faed1455333a`，分支 `codex/alpha26-linux-backend-release`。

master已另有I07首次续接Conversation源码增量，现有候选未包含该增量，因此没有把标签指向master的组合提交fb004fa。本次从6bf680a基线及已验证的5项产品输入建立独立冻结提交；60个运行时路径和全部冻结输入逐项匹配，见[标签源码核验](../../../artifacts/ssh-alpha24-recovery/2026-10-17/tag-source-verification.json)。EXE沿用原候选，没有重新打包或扩大其验收范围。

本次仅发布用户要求的Windows EXE及对应单文件校验文本，Linux daemon仍内置EXE；另行生成的Linux tar.gz保留本地。GitHub两附件上传状态、大小和digest匹配，见[上传报告](../../../artifacts/ssh-alpha24-recovery/2026-10-17/github-upload.json)；公开下载HTTP/完整文件摘要结果见[下载核验](../../../artifacts/ssh-alpha24-recovery/2026-10-17/github-download.json)，发布与源标签见[发布记录](../../../artifacts/ssh-alpha24-recovery/2026-10-17/github-release.json)。源码测试/受控SSH/普通Windows EXE保留上一节实际验收，不把本次分发当作用户服务器或真实原生任务恢复。
