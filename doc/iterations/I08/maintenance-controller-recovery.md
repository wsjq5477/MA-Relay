# I08 issue #31：维护控制器完整暂存与原 ID 查询

2026-11-07。基线为公开 alpha.74 后的 `51a3901`，本次未发布源码。需求来自 [issue #31](https://github.com/wsjq5477/MA-Relay/issues/31)，影响 M02 原操作恢复、M04 SSH 维护和 M05 daemon。未取得 CodeAgent 私有分支或现场数据，不以该分支版本的验证替代上游实测。

## 实现

原暂存清单只有七个文件，daemon 顶层却已依赖 browser-management/channel/pairing/protocol、graph-layout 和 ws。只复制原清单的隔离目录稳定在读取维护输入前报 MODULE_NOT_FOUND。

新增 [maintenance-runtime.cjs](../../../desktop/electron/maintenance-runtime.cjs)，由 [ssh-install.cjs](../../../desktop/electron/ssh-install.cjs) 在已验证目标的私有 Node 上运行。按完整可信 manifest 复制，先检查源 owner、发布标记、逐文件路径/摘要，再检查暂存树，不允许符号链接、外来拥有者或清单外文件。已有匹配文件复用，缺失或损坏的清单内文件原子补齐，不删除旧后台、状态、收据或输入。目标摘要不变，完整副本会增加暂存空间需求。

发送维护前，私有 Node 用空 NODE_PATH、关闭全局搜索并限制模块解析结果必须为内置模块或暂存树文件来加载控制器；不能从仓库、用户 HOME 或祖先目录借依赖。全部本地/第三方依赖均来自已验证清单。

远端非零退出保留有界且安全的阶段、退出码、controllerCode 和固定中文消息；不保存 stderr 原文、远端路径或其中凭据。原 operationId 的 unknown 行及机器维护状态均持久保存诊断。明确通道打开拒绝的既有未发送证明保持。

[ssh-host.cjs](../../../desktop/electron/ssh-host.cjs) 的原 ID 查询若发现 MODULE_NOT_FOUND，可按本机仍可信的原版本和原摘要修复同一控制器目录，再发送 query。不得安装/升级目标、换 ID 或重新发送原维护 action。摘要变化或缺少可信原版本拒绝修复。已有原收据继续按原语义恢复；远端 not_found 不足以证明终态，只显示具体原因并保留 unknown，不伪报成功或拒绝。

未改变维护协议版本、机器身份、Task/Conversation、原生配置或收据状态枚举。错误仍使用既有 error/details 结构，无数据迁移。

## 实际验证

Windows x64 Node 24.12.0；WSL Ubuntu 22.04 / Node 24.13.0。Windows 开发、依赖、缓存、构建和日志在 D 盘；WSL 发行版存储已核对为 E 盘，Linux 合成状态在该发行版临时目录。模型 0，生产 SSH 写入 0。

| 检查 | 结果与证据 |
| --- | --- |
| 旧清单反例与完整隔离加载 | 同一测试先验证原七文件缺 browser-management，再验证完整清单及 ws 可隔离加载；删除暂存模块后可按原摘要修复；篡改源拒绝并保留已验证控制器。见 [最终专项](../../../artifacts/issue31/2026-11-07/focused-rerun.txt) |
| Linux daemon 维护与新增专项 | 首轮 30/30；含真实 daemon/process/socket、受控旧协议升级、回滚、原 ID 恢复、历史/身份保护及大输入。此轮在最终加载检查加固前执行，见 [完整回归](../../../artifacts/issue31/2026-11-07/linux-final.txt) |
| 最终代码专项 | 7/7；完整暂存旧 daemon 升级并按原 ID 查回唯一收据、隔离加载/修复、脱敏诊断、原 ID 查询不重发、unknown 保留、摘要变化拒绝和 not_found 保护。上述场景与全量有重叠，不累加。见 [最终专项](../../../artifacts/issue31/2026-11-07/focused-rerun.txt) |
| Windows SSH 恢复与新增专项 | 17 通过、0 失败、2 平台跳过；见 [Windows 回归](../../../artifacts/issue31/2026-11-07/windows-final.txt) |
| 首轮最终专项失败 | 5 通过、1 失败：集成夹具在 worker 正修改维护锁时立即 CLI query，收到既有 MAINTENANCE_ERROR。保留 [失败原件](../../../artifacts/issue31/2026-11-07/focused-final.txt)；夹具改为等待原 worker 终态后查原收据，未更改维护锁机制 |
| 工程检查 | 根类型检查、lint、根构建、桌面类型/Vite 构建通过；[类型](../../../artifacts/issue31/2026-11-07/typecheck.txt)、[lint](../../../artifacts/issue31/2026-11-07/lint.txt)、[根构建](../../../artifacts/issue31/2026-11-07/build.txt)、[桌面构建](../../../artifacts/issue31/2026-11-07/desktop-build.txt) |
| 开发离线包 | 重新暂存 Linux 包并用 localManifest 校验全部 1748 文件，包含 maintenance-runtime 与 ws；未制作或发布 EXE。见 [包检查](../../../artifacts/issue31/2026-11-07/package.json) |
| 文档检查 | 基线与当前均为 3065 项历史缺链，错误集合新增/移除均为 0，未把整体检查计为通过。见 [差异](../../../artifacts/issue31/2026-11-07/docs-delta.json) |

测试入口为 [维护暂存专项](../../../desktop/tests/maintenance-runtime.test.cjs)、[daemon 维护](../../../desktop/tests/daemon-maintenance.test.cjs)、[SSH 恢复集成](../../../desktop/tests/ssh-recovery-integration.test.cjs)。Linux 初次命令因非交互 PATH 无 node 未运行；明确选择已有安装后完成实测，不计该次为通过。

## 未测与剩余边界

未直接执行现场升级、回滚或清理，不改变仍在运行的用户旧后台。未重建 Windows EXE、验证真实生产 SSH、CodeAgent 私有包或真实模型。已存在的 unknown 只有合法原终态收据才能解除；若原控制器未生成远端收据，修好控制器后查询可能仍为 not_found，继续保留 unknown。既有维护锁并发查询的瞬时异常仍可能发生，仍只能查询原操作，不能以新 ID 重做升级。
