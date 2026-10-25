# alpha.62 冻结客户端与原 SSH 后台只读复验

日期：2026-10-25（Asia/Shanghai，原始JSON为UTC）。关联I06C、AB-F04/F05/F06、M04-F04/F06、M05-F01/F02、M10-F01/F02/F03。公开alpha.60保持，本轮使用本地alpha.62冻结Windows客户端；承接[此前alpha.56同范围复验](current-ssh-readonly.md)，不将旧现场记录当作当前事实。

## 目标与边界

用已保存的原连接、DPAPI凭据和已信任主机指纹核对实际服务器；不输出地址、账号、凭据或内部身份。实例仅覆写SshManager.save，禁止保存生产连接阶段；autoReconnect只在内存副本关闭。认证、owner/profile/daemon身份、原版本清单选择及逐文件校验使用生产实现。

probe必须同时确认reuseCompatible=true、installNeeded=false，才进入install的只读复用分支。校验失败直接结束，不能回退安装/上传。两次inspectDaemon使用原包的非接管检查，比较原daemon/PID、current.json摘要和daemon.pid内容。本地原连接配置、归属、凭据引用和维护字段前后相同；没有hello、任务、权限、取消、维护或模型派发。

## 当前实际结果

Windows包内Node24.21.0，本地alpha.62 EXE **130201291字节**，SHA-256 **`bcce8eb39eba18969e76869f844736d014e6cd811e5e44a7534041d0391c990f`**。三组真实SSH检查通过，模型0：[报告](../../../artifacts/current-ssh/2026-10-25/readonly.json)。

| 检查 | 本轮实际结果 |
| --- | --- |
| 原凭据/指纹认证、严格文件复用 | 实际daemon仍为0.6.0-alpha.37，选原冻结清单1459项；manifestDigest=`3fff4ab392c513f629299f1af01bbf038d2d4025c628f368bbb9e98eed3c7678`，生产逐文件核对通过 |
| 两次非接管原daemon检查 | 原身份和PID一致；current.json与daemon.pid不变，不改变控制会话 |
| 原本地配置与操作边界 | 配置/归属/凭据引用保持；验收副本两次状态保存均被抑制，无写回和自动重连 |

执行后重新计算暂存的ssh-host、ssh-install、ssh-credentials、ssh-known-hosts及coordinator-client摘要，全部与冻结包内一致；EXE完整SHA不变。[来源核验](../../../artifacts/current-ssh/2026-10-25/provenance.json)、[实际脚本快照](../../../artifacts/current-ssh/2026-10-25/runner-executed.cjs)、[Windows驱动](../../../artifacts/current-ssh/2026-10-25/windows-runner.ps1)。

## 剩余准出

本轮只补当前冻结客户端对原实际服务器的认证、严格复用和非接管身份/PID证据；没有故障注入、网络断开、升级、回滚、卸载、独立模型或普通EXE与SSH联合流程。原daemon未部署/升级，原Task/Session和unknown未判定或清理。完整I06C的故障/版本矩阵仍未准出；[alpha.62普通窗口后续五组](window-lifecycle-verifier.md)与本轮真实SSH通过独立记录。

产品实现/协议/持久结构无变化，本轮不生成新版本；公开alpha.60与本地alpha.61/62文件保持。同步整体状态、路线和M04/M05/M10报告，不把共享源码928/928计为本轮重新执行。

复现入口：[windows-ssh-readonly-current.cjs](../../../desktop/tests/windows-ssh-readonly-current.cjs)，参数为冻结bridge、完整Linux包和报告路径；使用原保存SSH目标及信任，不写新连接或打印秘密。未来环境变化时先重核对当前原目标，不复制本轮的身份作为新目标。
