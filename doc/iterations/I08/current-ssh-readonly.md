# 当前冻结客户端与原 SSH 后台只读复验

日期：2026-10-23（Asia/Shanghai）。关联 I06C、AB-F04/F05/F06、M04-F04/F06、M05-F01/F02 与 M10 打包兼容。公开仍为 alpha.53，本次使用已交付本地 alpha.56 的冻结 Windows 后端和 Linux 清单。没有修改产品代码、配置、协议、数据格式或发布版本；模型调用 0，未部署、升级或切换日常后台。

## 目标与执行方式

此前 alpha.55/56 的真实冻结文件和大输入验证属于受控文件系统/传输；仍缺少当前客户端对实际原服务器的认证、严格文件核验与原进程证明。本次在 Windows 上使用已保存的原连接、DPAPI 凭据和已信任主机指纹，不输出凭据、服务器地址、账号或内部身份。

[验收脚本](../../../desktop/tests/windows-ssh-readonly-current.cjs)从冻结包加载生产 SshManager 与 SshInstaller。生产 authenticate 会保存连接阶段，为避免观察器覆盖日常连接状态，仅在验收实例中覆写 save，将状态保留在内存；原生认证、主机指纹、owner/profile/daemon、清单、路径和逐文件校验均使用生产逻辑。autoReconnect 只在该内存副本关闭。没有调用已存在连接的 hello，不接管控制通道。

严格 probe 必须同时返回 reuseCompatible=true、installNeeded=false 才继续 install 的只读复用分支；否则直接失败，不能回退为安装或上传。随后两次调用原安装包的非接管 inspectDaemon，核对原 daemonId、实际版本和 PID；比较远端 current.json 摘要及 daemon.pid 内容，并比较本地连接配置、凭据引用与归属字段。日常后台可能自然更新的连接阶段/时间戳不作为配置不变断言；没有读取或判定原 Task/Session 的执行结果。

## 实际结果

[原始报告](../../../artifacts/current-ssh/2026-10-23/readonly.json)为 passed，三组检查通过：

| 检查 | 实际结果 | 证据边界 |
| --- | --- | --- |
| 原保存凭据与主机指纹认证、严格复用校验 | 真实 SSH 认证成功；远端实际版本 **0.6.0-alpha.37**，选择原可信清单并完成生产逐文件校验；清单 1459 项，manifestDigest `3fff4ab392c513f629299f1af01bbf038d2d4025c628f368bbb9e98eed3c7678` | 真实网络/用户原服务器，非受控 SSH 夹具；不证明原生 Agent 健康或模型可用 |
| 两次非接管原后台检查 | 原 daemonId 与 PID 一致，current.json 摘要、daemon.pid 内容不变 | 未做停机、重启、升级、回滚、断线或 unknown 结算 |
| 本地配置与操作边界 | 原连接配置/归属保持，验收实例两次状态保存被抑制；没有 hello、任务、权限、取消或维护派发 | 不替代普通 EXE 窗口与独立服务器的完整联合流程 |

客户端来自 alpha.56：EXE 130191853 字节，SHA-256 `9c87e70332d9f11b219467793a41b0aed1f16eaa10a8a252232b187890e1f5cd`。复验后重新核对 EXE 完整 SHA，以及 Windows 运行暂存目录与冻结包的 SSH 模块字节一致。[包与执行来源](../../../artifacts/current-ssh/2026-10-23/provenance.json)、[实际执行脚本快照](../../../artifacts/current-ssh/2026-10-23/runner-executed.cjs)、[Windows 包装器](../../../artifacts/current-ssh/2026-10-23/windows-runner.ps1)。执行后仅删除脚本未用 import 并格式化，未第二次连接服务器；维护版语法检查与 CommonJS 对应 lint 通过，[lint](../../../artifacts/current-ssh/2026-10-23/lint.log)。未重跑无关全量测试，不将 alpha.56 既有 863/863 记为本轮新执行。

## 收尾与剩余范围

本次补齐“当前冻结客户端 → 实际原 SSH 后台”的认证、严格文件复用与非接管进程核验；不能将之前报告的“未执行独立 SSH”泛化为本轮也未连接。完整 I06C 的故障/版本切换矩阵、真实模型、普通 EXE 联合流程仍未准出，图 100ms 与 WSL 稳定性边界不变。Windows OpenCode 最多一个心算子任务已有明确许可；指定正式目标仍缺失，本次未消耗该授权，也不替换目标或关系。

同步迭代台账、整体测试/路线/功能状态和 M04/M05/M10 报告。产品设计、模块行为、architecture/data-model/protocol 没有契约变化，不制造新功能需求或新 EXE。另修正路线表遗留的最新公开版本：alpha.53（5269d65），上一公开版本 alpha.52（49bd12b），以既有发布记录为据。
