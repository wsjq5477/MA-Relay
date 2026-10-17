# I06C alpha.16–alpha.17：维护原收据恢复与等待优化

日期：2026-10-14；功能 AB-F17、M04-F08，需求 I06-DMN-05 / DEV-C03、DEV-C06。基于用户新增的 alpha.15 维护入口恢复继续开发，不改原生模型/账号配置。

## 需求与实现

真实本机 TCP SSH 回归复现：首次维护通道在接受输入前被拒绝，新连接又缺少一次性凭据时，alpha.15 返回 unknown，查询远端却永远没有原维护记录。[修复前实际失败](../../../artifacts/I06C-final/2026-10-14/launch-auth-before-fix.tap)。

alpha.16 在首次通道拒绝后立即原子保存 remoteLaunched=false，登录成功且准备调用维护启动前才重新标记 true。重新登录失败或第二次通道打开被拒，原收据为 rejected / DAEMON_NOT_STARTED；凭据不足另外显示 needs_credentials。输入可能已发送时，流中断和超时仍保留 unknown，仅查询原 operationId，禁止换 ID 重新维护。

中央在保存未发送证明后退出，重开查询原收据时，同时将对应机器维护占位更新为 rejected、保持自动重连关闭；保留主机信任阻断与凭据错误。只更新匹配原 operationId 的机器维护状态。忙碌、版本/修订/操作冲突等语义错误原样返回，不能被改写成“暂存失败”。代码：[ssh-host.cjs](../../../desktop/electron/ssh-host.cjs)。

协议号、公开 RPC 参数、数据字段与远端目录结构不变；改变的是既有 remoteLaunched 的持久化时机与原查询恢复语义。旧 unknown 若缺少未发送证明仍保持 unknown，不追溯推断、重发或释放。

## 实际验证

| 环境 / 版本 | 场景与结果 | 证据级别与来源 |
| --- | --- | --- |
| WSL Ubuntu / Node 22.23.1 / alpha.16 | 桌面全量 163/163，无失败/跳过 | 受控：[桌面 TAP](../../../artifacts/I06C-final/2026-10-14/desktop-alpha16.tap) |
| 同环境 / alpha.16 | SSH 恢复 7/7，包括未发送后缺凭据、实际原子磁盘快照重开、第二次打开拒绝、发送后流中断与超时；原收据重复调用不新增启动，unknown 阻止新 ID | 真实本机 TCP SSH，服务器/维护执行受控、合成凭据、模型 0：[专项 TAP](../../../artifacts/I06C-final/2026-10-14/launch-boundaries.tap)、[测试](../../../desktop/tests/ssh-recovery-integration.test.cjs)；7 项已包含于 163，不重复计数 |
| Windows / 原保存凭据 | 实际握手、主机信任与认证通过，约 2 秒；无模型 | 独立服务器只读：[阶段报告](../../../artifacts/I06C-final/2026-10-14/ssh-auth-stages.json) |

此前实机维护登录失败为 SSH_LOGIN_TIMEOUT，未进入维护步骤、未产生维护意图：[alpha.15 本次实机记录](../../../artifacts/I06C-final/2026-10-14/lifecycle-alpha15.json)。被动 TCP banner 等待不能证明 SSH 不可用；用户确认标准 SSH 可登录后，主动协议标识与完整 ssh2 认证分别通过。没有将该瞬时登录超时归因于 OOM 或 sshd 会话配置。

alpha.13 原文件任务和会话保留，恢复仅沿原 ID，未重发输入。完整 I06C 的准出仍以 [总验收](final-delivery.md) 的逐项实机证据为准。

## 最终 Windows 包与普通程序

所有并行构建完成后重新比对：[最终包报告](../../../artifacts/I06C-final/2026-10-14/package-alpha16-final.json)。alpha.16 包含 28 个后台 CJS、1381 个 Linux 文件，窗口/冻结后台/前端/清单均与实际源码一致。EXE 为 129,851,194 字节，SHA-256 `d1e35450e57967767fc5031ba4bdc8dfb5f5552dc374079a4a3005fc5f3223ba`。

[普通 EXE 报告](../../../artifacts/I06C-final/2026-10-14/portable-alpha16.json)：Windows 无调试参数真实窗口启动、关闭保留同一中央、重开复用同一中央 3 项通过，独立 Windows/WSL profile，原生需求/委派 0。该检查不证明真实 Linux 文件任务成功。并发构建时早期报告读到尚在生成的 EXE；早期大小/哈希只作过程记录，最终分发以本节独立重新核验和实际启动结果为准。

## alpha.17 同次维护可信输入的等待优化

日期：2026-10-14，AB-F17、M04-F08 / M10，DEV-C03/C06。alpha.16 真实维护等待时测得 Windows Node 读取 WSL UNC 包完整校验 1381 文件需 11,409ms：[原路径测量](../../../artifacts/I06C-final/2026-10-14/package-unc-timing.json)。原构造 from/target/兼容版本列表时每个 release() 都默认再校验当前整包，14 个兼容版本导致多次同步文件读取。该问题是本地路径开销，不作为 SSH/内核 OOM 根因结论。

alpha.17 将当前包的完整校验结果限于**同一次原维护输入构造**复用，仍对每份兼容清单读文件、校验格式和固定摘要；没有跨操作缓存，不跳过暂存/远端完整校验。接口、远端输入内容、磁盘结构不变，是无协议变化的实现优化。代码入口仍为 [ssh-host.cjs](../../../desktop/electron/ssh-host.cjs)。

实际测量同一冻结资源：完整校验 11,821ms，随后验证全部 14 份兼容清单 289ms，[报告](../../../artifacts/I06C-final/2026-10-14/trust-input-timing.json)。这是本地资源步骤测量，不冒充整个真实升级/回滚耗时。

WSL Ubuntu / Node 22.23.1，alpha.17 全桌面 **164/164**：[TAP](../../../artifacts/I06C-final/2026-10-14/desktop-alpha17.tap)。新增校验后兼容清单被篡改的测试，仍明确 SSH_PACKAGE_CHECKSUM 拒绝，无远端写入；其余发送边界/重开/unknown 阻断检查保留。模型 0。

独立 alpha.16 实机流程保持原资源快照；alpha.17 在独立临时源码快照构建，避免正在验证的版本被替换。alpha.16 的服务器结果与 alpha.17 工程/包分别记录，不能把冻结 alpha.16 的服务器链标为 alpha.17 重测。

### alpha.17 最终包与普通窗口

独立构建后再次与主工作区源文件比对通过：[最终报告](../../../artifacts/I06C-final/2026-10-14/package-alpha17-final.json)，28 后台 CJS / 1382 Linux 文件。Windows x64 EXE 129,849,380 字节，SHA-256 `aa97a2b2adbd3bff8837fee10d16433b929225d384dc5e5b1966d315873905d5`。

[普通窗口实测](../../../artifacts/I06C-final/2026-10-14/portable-alpha17.json)：无 debug/inspect 的真实窗口启动、关闭保持原中央、重开复用中央 3 项通过；独立 Windows/WSL profile，需求/委派 0。没有用本次无模型检查替代原 alpha.13 模型/文件任务，完整 I06C 仍按总验收未准出项判定。

## 冻结 alpha.16 独立服务器维护最终结果

2026-10-14，Windows Node 到独立 Linux，原 alpha.10 空闲隔离 profile，生产 SSH/daemon/维护 worker，原生需求 0。[最终实机报告](../../../artifacts/I06C-final/2026-10-14/lifecycle-alpha16.json)：alpha.10→alpha.16 升级、alpha.16→alpha.10 回滚、再次升级、停止、明确连接恢复、卸载全链通过；五份维护收据均 confirmed，实际版本分别核对，daemon 身份跨版本保持，用户原 ssh-connections.json 前后摘要一致。卸载保留状态目录与维护收据，历史保留标记核对；该空闲 profile 没有原生任务，不能由此声称非空原生会话跨版本验收。

本次不再将“完整真实回滚/卸载尚未验证”列为待办；原 alpha.13 文件任务处于另一 profile，不迁移、不释放，不被本专项代替。

## 原文件任务最终观察与准出边界

[原任务最终观察](../../../artifacts/I06C-final/2026-10-14/original-file-final-observation.json)：原 Task/Session 保持同一绑定，状态 unknown，新 Prompt=0。通过 pidfd 校验自有观察进程后暂时暂停观察，仅停止两个已确认空闲的自有 Controller；此时 MemAvailable 478,204 KiB、SwapFree=0。结合此前该原生 PID 的内核 OOM 实证，本次诊断未在同样压力下再次启动原生服务，返回 NATIVE_MEMORY_LIMIT；该保护仅是本次诊断的保守资源判断，不新增公开 API 或通用产品最低内存要求。finally 已恢复观察并删除临时 helper，没有停用其他用户服务、修改数据库终态、改变服务器 swap 或全局配置。

**完整 I06C 仍未准出**：原 Linux 文件/原生恢复终态尚无可靠证据。下一步需提供足以启动原服务的内存后，沿原任务、原会话和原控制收据恢复；不能改 ID/节点/目录重做。这与已通过的零模型后台维护及 alpha.17 工程/包检查分别记录。
