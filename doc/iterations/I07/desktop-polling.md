# 桌面空闲黑窗与机器列表刷新优化

日期：2026-10-18。范围：AB-F01/F02/F07/F17，M01-F01/F09、M03-F02、M06-OC-F01/M06-CC-F01/M06-CX-F01、M09/M10。公开包仍是原 alpha.28；本次最终修复候选使用独立版本 `0.6.0-alpha.28.poll.4`，不覆盖 alpha.28/ui.2。

## 需求与原因

用户报告普通 Windows EXE 定期出现短暂黑窗，机器与 Agent 有明显的周期刷新感。源码确认两类外部探测挂在实时快照链：每约15秒执行 WSL 枚举，每约30秒调用工具版本探测。后者占用机器快照10秒观察预算，探测慢会把正常机器投影为暂时离线。最初据此怀疑外部探测，随后本机Win32进程链实际确认Codex npm二次启动黑窗（见下文）；不把本机结果扩大为所有设备/程序的黑窗归因。

Windows首轮普通EXE观察随后实际捕获旧alpha.28的codex.exe约31秒周期黑窗，以及首版候选启动探测的同类窗口。进程链证明npm的codex.js二次spawn原生codex.exe，外层windowsHide没有传入内部spawn；原生脚本源码亦确认这一点。见[首轮系统采样](../../../artifacts/desktop-polling/2026-10-18/portable-system-observation-initial.json)与[含进程归属的复现](../../../artifacts/desktop-polling/2026-10-18/portable-owned.json)。不关闭用户旧后台来掩盖复现。

原界面每1500ms接收全新JSON对象，未变化节点也被替换；关系图每轮改写最近同步的秒数。另确认Core Controller启动、显式版本检查和OpenCode serve启动没有设置windowsHide，属于需要补齐的后台窗口边界。

## 最终行为与代码

- 机器环境在后台启动后首次使用时枚举；并发首次读取共用一个枚举任务。用户明确点击机器“扫描”时重新枚举WSL并扫描该机器工具。安装/卸载/更新工具或新增WSL后使用扫描；普通“刷新数据”仅刷新实时状态。
- 每台机器首次成功读取快照后尝试一次安装扫描，失败也记录已尝试；后续状态轮询不自动重试外部探测，手动扫描可重试。既有snapshotJobs和超时退避保留。实际执行前原路径核验继续存在，不把缓存安装检查当作真实模型可用性。
- 任务、连接、busy、等待、unknown及恢复收据继续实时读取，1500ms周期保留。深比较共享未变化JSON分支，所有时间戳、错误、字段删除和原请求字段仍准确更新，不按展示效果抹去真实状态。
- 关系图去掉持续跳秒的同步文字；诊断时间仍在机器菜单可查。稳定卡片DOM、已展开安装位置、菜单、原图位置和草稿在轮询期间保留。
- Claude宿主也不再每30秒执行版本/认证CLI探测；已有check作为上次安装/登录观察保留，首次缺check、显式check与实际提交前仍检查，原任务与worker事件继续实时同步。
- Windows官方Codex npm安装从原包的optional platform package或bundled vendor目录直接启动同一codex.exe，使调用方windowsHide作用到原生进程；节点仍记录原codex.js安装身份，managed-package提示及原生账号/模型环境保留。原包缺二进制明确拒绝，不执行旧wrapper或寻找另一安装。Linux规则不变。
- Core Controller、显式版本检查与OpenCode服务子进程补充`windowsHide:true`。原生身份、配置、取消和请求结算规则不变。

代码：[机器路由](../../../desktop/electron/machine-router.cjs)、[轮询对象共享](../../../desktop/src/poll-state.ts)、[桌面状态](../../../desktop/src/NetworkApp.tsx)、[关系图](../../../desktop/src/AgentGraph.tsx)、[Controller](../../../src/controller.ts)、[OpenCode服务](../../../src/native-server.ts)、[Codex原包启动](../../../desktop/electron/tool-discovery.cjs)、[Claude宿主](../../../desktop/electron/claude-host.cjs)。

## 实际验证

环境：WSL Ubuntu / Node22.23.1；Windows Node24.19.0 / Edge155.0.4283.45；模型调用0。

| 检查 | 实际结果与证据 |
| --- | --- |
| 定向路由与对象共享 | 20/20，通过；跨15秒/30秒/5分钟推进仍不重复探测、手动扫描新增WSL/重试失败探测、并发首次枚举合并及busy状态准确更新。[TAP](../../../artifacts/desktop-polling/2026-10-18/targeted-inprocess.tap) |
| 桌面全量 | 424/424，通过、无跳过；包含专项，不重复相加。[TAP](../../../artifacts/desktop-polling/2026-10-18/desktop-tests-final4.tap) |
| 核心全量 | 45/45，通过。[TAP](../../../artifacts/desktop-polling/2026-10-18/root-tests-final4.tap) |
| Windows生产前端/受控Coordinator | 3组通过，13轮快照；列表与图各5轮，心跳时间变化时无卡片正文/子节点替换、图位置不变；菜单与安装位置保持展开，离线/恢复及时更新。[报告](../../../artifacts/desktop-polling/2026-10-18/windows-ui.json)、[截图](../../../artifacts/desktop-polling/2026-10-18/stable-graph.png) |
| 普通Windows EXE | poll.4隔离profile，4组通过；空闲70,165ms，44次真实界面心跳；Win32每20ms采样90,027ms，候选可见控制台0、归属不明0。同时捕获旧alpha.28的Codex黑窗3次，均由进程链确认；正常关窗后同Coordinator仍可连接。[报告](../../../artifacts/desktop-polling/2026-10-18/portable-final.json) |
| Windows真实Codex安装 | Codex0.145.0仅版本探测通过；从原npm alias包直接启动原生EXE，原JS身份保持，模型0。[报告](../../../artifacts/desktop-polling/2026-10-18/windows-codex-launch.json) |
| lint/类型/构建 | 通过；[lint](../../../artifacts/desktop-polling/2026-10-18/lint.log)、[类型](../../../artifacts/desktop-polling/2026-10-18/typecheck.log)、[构建](../../../artifacts/desktop-polling/2026-10-18/build.log)。Vite保留体积提示 |

初版修复桌面全量421/421；补Claude后422/422；加入Codex二次启动和alias布局回归后最终424/424。首次沙箱内桌面全量341通过/80失败，主要是子进程与socket/编译夹具EPERM；该失败[原日志](../../../artifacts/desktop-polling/2026-10-18/desktop-tests.tap)保留。隔离文件模式首次只报文件级通过，不作为用例数；随后进程内专项及允许本机资源的串行全量分别实际运行通过。Windows首次自动审批因额度失败而未执行，用户要求继续后重试成功，不把未执行算通过。额外Windows Node --test从UNC定位源文件失败，保留[启动日志](../../../artifacts/desktop-polling/2026-10-18/windows-codex-contract.tap)；未将其计为通过，Windows实际版本探测与普通EXE另行执行。

## 本地候选与未测边界

本地[修复候选EXE](../../../artifacts/desktop-polling/2026-10-18/AgentBridge-0.6.0-alpha.28.poll.4-Windows-x64.exe)大小129,933,135字节，SHA-256 `8493adfc6379e1a8e0bf142265efa4a68eb468408ded7affda19b267ee802fbc`；[校验文件](../../../artifacts/desktop-polling/2026-10-18/SHA256SUMS.txt)。[包核验](../../../artifacts/desktop-polling/2026-10-18/package-final.json)通过：38 CJS、78 Core文件、1399 Linux资源条目与冻结源码一致，前端匹配。此为本地候选，没有创建GitHub标签或发布附件；根工作区package/lock仍为alpha.28。

首次打包从仓库根读取配置而失败，未生成EXE；切换冻结快照的desktop配置后成功。[首次日志](../../../artifacts/desktop-polling/2026-10-18/package-build.log)、[成功日志](../../../artifacts/desktop-polling/2026-10-18/package-build-desktop.log)。最终poll.4按[最终构建日志](../../../artifacts/desktop-polling/2026-10-18/package-build-final4.log)生成，普通EXE空闲观察通过，实际采样范围见上表。

首版poll.1的普通EXE观察确实失败（旧版3次、候选启动1次），未将其计为通过。poll.2补Claude空闲检查；poll.3新增直接原生启动但真实Windows安装使用npm alias平台包，首次严格名称判断拒绝，该[失败证据](../../../artifacts/desktop-polling/2026-10-18/windows-codex-alias-initial.json)保留。poll.4支持同原包声明的alias/os/cpu，并已通过本机Codex0.145.0只读版本探测：[实际报告](../../../artifacts/desktop-polling/2026-10-18/windows-codex-launch.json)。最终poll.4普通EXE复验通过，首次失败不被覆盖。20ms采样不能保证捕获短于采样间隔的窗口，也不表示系统其他程序无控制台；本轮确实区分旧alpha.28与新候选的所属进程。

候选冻结源码清单：[文件摘要](../../../artifacts/desktop-polling/2026-10-18/frozen-source-files.json)。包含此前工作区UI、原生适配与当前安装发现修复，不能把本轮刷新测试当作新增Agent真实模型验收。

本机实际捕获正在运行的旧alpha.28周期黑窗，但未读取或修改用户运行profile、未替换其程序/停止其后台，未连接独立SSH服务器或调用真实原生模型。完整I06C/I07C准出不因此扩大。修改实时刷新无需重派任何原请求；更新客户端应先在旧程序“设置 → 后台运行 → 停止后台并退出”，再打开候选，普通关闭窗口会保留旧后台。未授权升级用户远端daemon，本次不自动操作远端。

协议与数据核对：未增加RPC、schema、状态枚举或身份字段；discover仍是只读安装发现，snapshot仍报告实时运行事实，lastSyncedAt原始值保留；改变的是安装发现触发时机与前端对象复用。架构/协议同步说明缓存生命周期，data-model无需变更。

## 复现

```bash
node --test --experimental-test-isolation=none --test-concurrency=1 desktop/tests/machine-router.test.cjs desktop/tests/poll-state.test.cjs
node --test --test-concurrency=1 desktop/tests/*.test.cjs
npm test
node scripts/check-docs.mjs
```

Windows Node运行[界面脚本](../../../desktop/tests/windows-poll-stability.cjs)，参数为报告目录；运行[普通EXE脚本](../../../desktop/tests/windows-poll-portable.cjs)，参数为候选EXE、确切版本和报告路径，调用[Win32观察器](../../../desktop/tests/windows-console-observer.ps1)。使用隔离profile，观察器不记录窗口标题或原生命令行。
