# I06A 已安装 SSH 后台兼容复用

日期：2026-10-12。修复候选：**0.6.0-alpha.4**。关联 I06-FIX-SSH-01、I06-NET-02、AB-F05/06/11/17、M04-F04/F05/F06、M05-F01/F02、M10-F03/F06。alpha.3 的 Codex 发现修复继续包含；稳定历史版仍为 0.5.0，I06B/C 未完成。

## 原因与范围

alpha.3 的客户端携带新的 Linux 包。此前探测在读取 `current.json` 后要求已安装版本与客户端版本完全相同，导致原已部署 alpha.2 的服务器报 `SSH_DAEMON_UPGRADE_REQUIRED`，无法继续连接。后台并未丢失任务，问题发生在连接预检，不能用删除远端状态或另建 profile 规避。

本次允许复用客户端明确收录并校验过的 alpha.2/alpha.3 Linux x64 发布。协议同为 2 只是必要条件，未知版本仍拒绝。不会安装新代码、替换运行中进程或迁移数据；旧 daemon 保持其原生适配代码，不因为复用就获得新客户端的远端 Codex worker 修复。自动升级、回滚、忙时切换和卸载仍属于后续 I06C。

## 实现与安全边界

- `desktop/compatible-daemons/` 保存先前实际冻结发布的可信 manifest；[打包脚本](../../../desktop/scripts/stage-linux-package.cjs)将它们纳入新 Linux 包的文件 SHA-256 清单，并写 `compatibleDaemons` 索引（version、manifestPath、manifestDigest）。来源是既有 alpha.2/alpha.3 冻结资源，未读取原生敏感配置。
- [ssh-install.cjs](../../../desktop/electron/ssh-install.cjs)选择当前版本或本地可信兼容清单。旧版本的 `current.json` 版本、摘要和 canonical versionPath 必须匹配；未知版本、路径别名、同版本不同内容保留现场并拒绝。
- 兼容复用安装分支实际执行只读验证：检查 HOME 内所有路径组件、UID、符号链接、install/release 归属及 current 未变化；必要时先核对私有 Node SHA-256，再按可信旧清单逐文件核验。没有上传、mkdir、chmod、rename、写 current、停机或新版本启动。
- 连接后握手继续核对实际选中的旧 daemon 版本、原 daemonId、UID、owner/profile、协议和 nonce/session。机器与节点沿用原身份；原任务和 unknown 账本不变化，不提交模型需求。
- probe 增加 `clientDaemonVersion` 与 `reuseCompatible`，`daemonVersion` 表示实际选中后台；复用时 `installNeeded=false`，摘要说明保留任务/历史。新连接仍使用当前 alpha.4 离线包并要求安装确认。

完整设计、M04/M05/M10 的报告、整体架构/数据/协议和路线已同步。旧 alpha.2/alpha.3 验收报告保留原版本，不覆盖为此次重跑。

## 实际验证

| 场景 | 结果与证据级别 | 原始证据 |
| --- | --- | --- |
| 兼容策略专项 | 4/4：旧发布无写入复用；未知版本/摘要/别名拒绝；探测后变化/外来归属/符号父目录拒绝；本地清单篡改和远端核验失败拒绝。受控 SSH/SFTP 替身 | [测试](../../../desktop/tests/ssh-compatibility.test.cjs) |
| 桌面回归 | 93/93，失败和跳过均为 0；包含原 daemon/身份/收据和 Codex 回归 | [TAP](../../../artifacts/ssh-compatibility/2026-10-12/desktop-tests.tap) |
| 原服务器只读实测 | Windows 已有加密凭据认证成功；alpha.4 选择并逐文件核验原 alpha.2；核对原 daemonId/PID 与版本入口不变；无模型需求、无部署写入 | [报告](../../../artifacts/ssh-compatibility/2026-10-12/remote-readonly.json)、[脚本](../../../desktop/tests/windows-ssh-compatible-real.cjs) |
| 新候选构建与资源 | 根 TS/桌面类型/Vite、Windows portable 生成与完整资源比对通过；25 后台模块、1362 个 Linux 文件（增加两份兼容 manifest） | [构建](../../../artifacts/ssh-compatibility/2026-10-12/package-build.log)、[包校验](../../../artifacts/ssh-compatibility/2026-10-12/package.json) |

核心 TS 未修改，先前 43/43 为历史基线，本次未重复执行。旧发布 alpha.3 的真实远端服务器连接未单独实测，alpha.2 为当前已有服务器样本；未知或未来发布不自动接受。完整升级、跨物理设备协作、原生 Codex resume、权限/取消和故障指标没有因本次复用被标为通过。

## 程序与使用

[AgentBridge-0.6.0-alpha.4-Windows-x64.exe](../../../desktop/release/AgentBridge-0.6.0-alpha.4-Windows-x64.exe)。大小 129,300,804 字节，SHA-256 `29c6db81ff7a6f796a69d2fbc94bd4105f3d673be3f4d2322b9732f1eedb0cda`。

打开 alpha.4，从新窗口的“设置 → 后台运行 → 停止后台并退出”停止旧客户端后台，再次打开 alpha.4，重新连接原 SSH 机器；不需要旧程序或旧窗口。复用同一 profile、原机器与已保存凭据；无需重新安装、删除远端数据或重新添加机器。客户端停止不取消远端原任务。若凭据未保存则按原认证方式输入，仍核对主机密钥。

## 原连接与普通 EXE 实测

真实 Windows alpha.4 客户端对用户原 SSH 连接完成 handshake/事件回读、`discover` 重新发现 OpenCode、读取快照；原 daemonId/PID/current 保持，无模型需求，通过：[连接报告](../../../artifacts/ssh-compatibility/2026-10-12/remote-connect.json)。测试使用原 profile/owner，关闭临时观察通道后保留原后台；不宣称用户旧进程已热切换新代码。

初次连接脚本错误地在执行实例列表中断言工具安装，产生断言失败；[初次报告](../../../artifacts/ssh-compatibility/2026-10-12/remote-connect-initial.json)保留。改用真实 discover 验证安装后通过；没有修改产品代码掩盖该断言。

普通 alpha.4 portable EXE 在隔离 Windows/WSL profile 中实际启动、关闭和重开，复用同一 Coordinator，未提交模型需求：[报告](../../../artifacts/ssh-compatibility/2026-10-12/portable.json)、[脚本](../../../desktop/tests/windows-codex-discovery-portable.cjs)。最终包与源码摘要以包校验报告为准。

交付前根 lint、修改的 CJS 语法检查与文档检查通过：[lint](../../../artifacts/ssh-compatibility/2026-10-12/lint.log)、[文档检查](../../../artifacts/ssh-compatibility/2026-10-12/docs-check.log)。最终重新生成的 alpha.4 普通 EXE 已再次完成启动/关闭/重开，包摘要与本页一致。
