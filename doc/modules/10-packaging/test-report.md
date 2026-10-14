# M10 构建与发布测试报告

## alpha.19 OpenCode 二次发现与 Windows 配置专项

WSL Ubuntu / Node 22.23.1：discovery 3/3（含于核心 45/45），桌面 181/181；受控回归、模型 0。[核心 TAP](../../../artifacts/opencode-discovery/2026-10-14/root-tests.tap)、[桌面 TAP](../../../artifacts/opencode-discovery/2026-10-14/desktop-tests.tap)。Windows 原始报告 UTC 2026-10-14T17:35:28.789Z / Electron Node 24.21.0：真实 PE 版本/解析、旧二次发现失败、修复后原路径核验、配置完整写入与旧revision拒绝、serve受控退出保留NATIVE_EXITED、删除原安装，共6组通过，[实际报告](../../../artifacts/opencode-discovery/2026-10-14/windows.json)。这是隔离PE/进程夹具，无真实OpenCode模型或用户另一台电脑验收。原生Windows完整生命周期和断电持久性未验证。根因、失败原证据、最终包与边界见 [专项](../../iterations/I06/opencode-discovery.md)。

## alpha.19 Linux CLI 发现专项

2026-10-14 / WSL Ubuntu / Node 22.23.1：发现回归 6/6；精简 PATH 下真实 Codex CLI 0.162.1 经生产 daemon/relay、本机隔离 TCP SSH 发现通过，重复规范路径不变，模型 0。受控 SSH 端点与真实 CLI 版本探测分别标明，不计作用户独立服务器升级验收。[发现 TAP](../../../artifacts/linux-cli-discovery/2026-10-14/discovery.tap)、[实际 CLI/SSH 报告](../../../artifacts/linux-cli-discovery/2026-10-14/real-cli-ssh.json)。全工程/包/Windows 实际结果与未测范围见 [专项](../../iterations/I06/linux-cli-discovery.md)，原模型/权限/续聊限制保留。

## alpha.18 当前专项

2026-10-14 / WSL Ubuntu / Node 22.23.1 / 源码 0.6.0-alpha.18：共享缓存自引用/旧清单/损坏旁路重建、Windows OpenCode 原意图恢复与并发保护、查询结果和脱敏原因；定向 55/55（计入桌面全量 176/176），根 43/43，lint/类型/构建通过。受控文件/宿主测试，无模型调用。原始证据：[定向](../../../artifacts/runtime-recovery/2026-10-14/targeted.tap)、[全桌面](../../../artifacts/runtime-recovery/2026-10-14/desktop-tests.tap)。Windows 真实 Electron 资源 4 组、Edge 受控 UI 3 组、普通无调试 EXE/合成原意图与关闭重开 4 组均通过；包校验 28 CJS / 1383 Linux 文件与当前源码匹配。详细过程及边界按 [完整专项](../../iterations/I06/runtime-recovery.md) 的实际结果判定，不将历史原生证据提升为本次重测。


当前基线：2026-10-14 / 0.6.0-alpha.15。工程和包一致性验证通过；独立服务器/最终程序专项按 [I06C 收尾](../../iterations/I06/final-delivery.md) 实际状态记录；旧版本段落保持原日期。
更新：2026-10-13。当前 0.6.0-alpha.8 拖动修复候选，最新包与普通窗口验证见当前专项；alpha.2/alpha.3 证据保留原版本。真实窗口/普通便携流程分别记录；0.5.0 保留为历史稳定发布，不把新包生成等同于整个 I06 准出。



## alpha.8 当前包验证

T-M10-22 / M10-F01/F02/F03/F06：2026-10-13，桌面 116/116，根及前端 TypeScript/Vite 构建，27 CJS 与 1368 个 Linux 文件版本/摘要/前端比对。旧 alpha.7 manifest 先按历史 digest 核对再收入可信兼容；普通 EXE 与实际 Electron 拖动按 [当次交付](../../iterations/I06/graph-drag-fix.md)分别记录。不重启用户原后台，不自动升级旧远端，不把本机布局缓存称为后台保存成功。最终 alpha.8 portable 包完整性与普通 EXE 启动/关闭/重开 3 项通过，原始报告见当次交付。

## alpha.7 历史包验证

T-M10-21 / M10-F01/F02/F03/F06：2026-10-13，当前桌面 116/116、前端构建与全部后台/版本/离线资源比对通过；普通 Windows EXE 启动/关闭/重开 3 项通过。版本、摘要及原始报告按 [专项交付](../../iterations/I06/graph-usability.md) 记录。可信兼容增加原已交付 alpha.6 manifest，先按历史 digest 核对；当前候选 27 个后台 CJS、1367 个 Linux 文件。SSH/原生账号不重跑，用户 profile 和远端 daemon 不变。


## 1. 历史材料快照核对

| 对象 | 此前资料整理快照（最新结果见本页候选验收） |
| --- | --- |
| 桌面源码版本 | 当时 0.6.0-alpha.2；先前资料快照为 0.6.0-alpha.1 |
| 根 CLI 版本 | `package.json` = `0.1.0` |
| Linux 离线 manifest | `0.6.0-alpha.1` / protocol 2 / linux x64 / Node `v22.23.1`；当时 1,360 个清单文件，134,646,484 字节解包总量 |
| 最新 portable EXE | [AgentBridge-0.5.0-Windows-x64.exe](../../../desktop/release/AgentBridge-0.5.0-Windows-x64.exe)，101,464,168 字节 |
| EXE SHA-256 | `fd11bbaaa3d5d4fb5c52171ff8c4900a79e7235a374578b494e438725b13dc7a`，当次重新计算 |
| `desktop/release/win-unpacked` | 旧构建；最新进度核对发现缺 ssh-host 且多个后台文件不一致，不能用于当前源码验收 |

本节 Linux 清单数量是当时资源快照；当前 alpha.8 见文末专项。2026-10-10 真实安装记录中的压缩包 46.9 MB / 约 78 秒是当时构建，不把它说成今日新包的性能复测。清单读取与 EXE 哈希只读，不安装/更新后台。

## 2. 功能/已执行测试矩阵

| 用例 ID | 功能 ID | 实际测试或证据 | 结果与级别 |
| --- | --- | --- | --- |
| T-M10-01 | M10-F01 | [根 TAP](../../../artifacts/docs-baseline/2026-10-12/root-tests.tap)，43/43；[桌面 TAP](../../../artifacts/docs-baseline/2026-10-12/desktop-tests.tap)，87/87 | 通过，自动化/共享全工程基线；不是模块独立 130 个新用例 |
| T-M10-02 | M10-F01 | [2026-10-12 进度核对](../../iterations/I06/progress.md)：根 lint/typecheck、桌面类型检查/Vite build | 核对记录通过；未保留本模块单独的新 EXE 构建日志，不能证明 portable 构建完成 |
| T-M10-03 | M10-F05 | `detached runtime survives portable extraction cleanup and retains license`，[worker-runtime.test.cjs](../../../desktop/tests/worker-runtime.test.cjs) | 通过，受控：合成 executable/ICU/V8 资源，删除合成解包目录后复用，许可证保留 |
| T-M10-04 | M10-F05 | `missing ICU or V8 resources reject startup before admitting a native task`，同上 | 通过，受控：实际断言删 ICU 后报缺资源，未启动原生任务 |
| T-M10-05 | M10-F05 | `ordinary Node keeps using its existing executable`，同上 | 通过，受控：普通 Node 不复制 Electron 资源 |
| T-M10-06 | M10-F04 | `release manifest path traversal and checksum changes stop before upload`，[ssh-security.test.cjs](../../../desktop/tests/ssh-security.test.cjs) | 通过但限定为具体 `../` 路径与 Node 版本断言；用例没有独立构造合法路径文件摘要损坏 |
| T-M10-07 | M10-F03/F04 | [既有真实 Linux 说明](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.md) / [原始 JSON](../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.json)，首次安装 `connectSsh` 77.8 秒 | 通过，真实/既有：单归档上传、运行时/逐文件校验、原子发布、daemon 握手；实际使用系统 Node，非缺 Node 分支 |
| T-M10-08 | M10-F02/F05/F06 | [I05 便携报告](../../../artifacts/I05-portable.json) | 通过，真实旧版：普通窗口读机器/节点、私有后台资源打包、重开节点/关系/历史保留、启动无新 Prompt、无 debug 接口；适用 `0.5.0` |
| T-M10-09 | M10-F03/F06 | 本次版本/清单读取、最新 EXE 大小/SHA-256 核对 | 先前静态核对通过；本次重建候选包结果见 T-M10-10/15 |

worker-runtime 专属测试为 3 项，计入桌面 87 项；发布脚本本身没有独立 `stage-linux-package.test.cjs`。共有受控测试、真实旧包和真实 Linux 正常安装支撑不同层级，不按文档数量重复计数。

## 3. 新版本发布缺口

| 用例 ID | 功能 ID | 场景 | 当前结论 |
| --- | --- | --- | --- |
| T-M10-10 | M10-F02/F06 | 0.6.0-alpha.2 EXE、窗口/后台/前端/离线 manifest 完整性 | 通过；[包校验](../../../artifacts/I06A-final/package.json)；25 个后台模块、1360 个 Linux 文件、app.asar 和前端与源码/构建输出一致 |
| T-M10-11 | M10-F05 | 普通候选 EXE 的便携 wrapper 退出后后台存活、重开同 PID/身份、原任务 Session 不变 | 通过；[普通 EXE](../../../artifacts/I06A-final/portable.json)；不含每个 worker 故障点 |
| T-M10-12 | M10-F02/F03 | 私有 Linux ELF/版本一致性、实际无可发现 Node 的 Linux 隔离 HOME | 通过实际私有运行验证；无 Node 独立服务器整体 SSH 安装未专项实测 |
| T-M10-13 | M10-F04 | 坏 archive、manifest 文件摘要篡改、远端 UID 不同/空间变化/解压失败、原子发布失败 | 部分安全函数覆盖，完整安装故障矩阵未测 |
| T-M10-14 | M10-F07 | 已有活动任务时升级、失败回滚、卸载仅删所属 Bridge 资源 | 未实现产品流程 |
| T-M10-15 | M10-F06 | 候选验收报告、EXE 摘要、真实 Windows 使用及普通便携程序 | 候选通过；[6A 验收](../../iterations/I06/acceptance.md)，不代表整个 I06 最终准出 |

## 4. 可复制检查与副作用

仓库根目录、Node ≥22.13：

```bash
node --test desktop/tests/worker-runtime.test.cjs desktop/tests/ssh-security.test.cjs
npm run desktop:build
```

第一条只创建测试临时文件，不连接服务器/调用模型。第二条改写编译物、检查前端，不生成 EXE。完整包构建使用：

```bash
npm run desktop:dist
```

它会重写 staging/release，安装根生产依赖时可能下载依赖，需要预备 Linux Node 和 Windows 构建环境。普通 EXE 的真实验收脚本可能连接已配置机器；模型任务是否调用必须根据各脚本具体范围记录。不要在未核实 profile 时把旧用户配置当测试目录清理。

变更发布材料后更新 [设计](design.md)、本报告、整体发布状态和当期迭代报告。新版本应留存构建日志、清单、包摘要和包内实际资源比对；失败/跳过/未测项必须原样报告，不通过改版本号或仅重跑源码测试消除缺口。

## 2026-10-12：6A 收尾

本次真实 Windows 预检发现依赖漏打包，已增加独立资源规则；先前版本常量与新清单不一致也已修复。最终 package 校验包含 25 个后台模块、1360 个 Linux 文件、窗口 app.asar、前端与 EXE 摘要：[报告](../../../artifacts/I06A-final/package.json)。

私有 Linux Node 实际启动通过：[报告](../../../artifacts/I06A-final/private-runtime.json)。它使用真实 Linux 隔离 HOME，不是远端无 Node 整体 SSH 部署。候选程序的真实窗口/普通便携启动报告单列，尚未运行的流程保持未测。

## 当前 6A 候选验收结果

2026-10-12 / 0.6.0-alpha.2：[真实 Windows 窗口](../../../artifacts/I06A-real/report.json)与[普通便携程序](../../../artifacts/I06A-final/portable.json)均通过。两轮保持同一 Conversation/native Session，关闭窗口保留同一后台，明确停止后新 PID 保留身份/机器/历史，恢复只查询原任务；普通程序请求数不增加。专项覆盖边界见 [6A 候选验收](../../iterations/I06/acceptance.md)。

## alpha.3 修复候选

T-M10-16 / M10-F02/F06：2026-10-12 / 0.6.0-alpha.3，Windows x64 portable 构建及完整资源比对通过；25 个后台 CJS、1360 个 Linux manifest 文件、app.asar、前端及版本一致。EXE 大小 129,293,929 字节，SHA-256 `e89a5a6c0e931d8da1f2e9b8a7fb6258ea43203a8c2cf32007244f65c0fbd130`。证据：[构建日志](../../../artifacts/codex-discovery/2026-10-12/package-build.log)、[包校验](../../../artifacts/codex-discovery/2026-10-12/package.json)、[交付及限制](../../iterations/I06/codex-discovery-fix.md)。alpha.2 的完整 SSH/权限流程没有因本条构建被记为新版本重跑。

T-M10-17 / M10-F02/F05/F06：2026-10-12 / alpha.3 普通 Windows portable EXE，隔离 Windows/WSL 状态，未开启 inspector/debug，未提交模型需求。真实窗口与 alpha.3 Coordinator 启动、冻结 Codex 后台与修复源码摘要一致、普通关闭保留后台、重开复用同一 Coordinator 且 requests/delegations=0；通过。[报告](../../../artifacts/codex-discovery/2026-10-12/portable.json)、[脚本](../../../desktop/tests/windows-codex-discovery-portable.cjs)。未切换用户生产后台，生产 profile 升级和全部 SSH 专项未重新验证。

## alpha.4 兼容复用候选

T-M10-18 / M10-F03/F06：2026-10-12 / alpha.4，Windows portable 构建、25 个后台模块、1362 个 Linux 文件（含两份可信旧清单）、app.asar、前端和版本一致；通过。[构建日志](../../../artifacts/ssh-compatibility/2026-10-12/package-build.log)、[包校验](../../../artifacts/ssh-compatibility/2026-10-12/package.json)。新包大小/SHA-256 与实际兼容范围见 [交付](../../iterations/I06/ssh-compatible-reuse.md)。不是远端 daemon 升级验收；先前 alpha.3/alpha.2 包报告保留。

alpha.4 普通 EXE 在隔离 Windows/WSL profile 中实际启动、关闭、重开，后台版本正确、冻结 Codex 代码与源码一致、复用同一 Coordinator、请求数保持 0；通过，[报告](../../../artifacts/ssh-compatibility/2026-10-12/portable.json)。最终源文件如再改动，需要重建及核对新包；此前普通启动记录的行为适用范围保留。


T-M10-19 / M10-F01/F02/F03/F06：2026-10-12 / alpha.5，桌面 95/95，类型/前端构建/lint、25 个后台模块、1363 个 Linux 文件及 EXE 完整性通过。第三份可信 manifest 为已交付 alpha.4，复制前按历史包摘要核对。Windows 受控前端快照检查单列，真实 SSH 原生流程未重跑。[包报告](../../../artifacts/ssh-error-clear/2026-10-12/package.json)、[本次交付](../../iterations/I06/ssh-error-recovery.md)。


当前 alpha.5 普通便携 EXE 在 Windows 隔离 profile 实际运行：无 debug 参数启动、普通关闭保留后台、重开同后台 3 项通过，native prompts/delegations=0。[报告](../../../artifacts/ssh-error-clear/2026-10-12/portable.json)。不扩大为真实原服务器 SSH 回归。

## I06B alpha.6 历史验证入口

2026-10-12 / 0.6.0-alpha.6：T-M10-20 / M10-F01/F02/F06：alpha.6 新锁定图依赖与所有后台模块离线打包；校验报告默认按版本隔离，避免覆盖 alpha.2 历史。本次代码、命令、逐项结果与限制汇总于 [I06B 实施](../../iterations/I06/graph-implementation.md)。受控工程结果见 [桌面 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)、[核心 TAP](../../../artifacts/I06B/2026-10-12/root-tests.tap)，界面见 [UI](../../../artifacts/I06B/2026-10-12/ui.json)、[性能](../../../artifacts/I06B/2026-10-12/performance.json)，本次核心 43/43、桌面 110/110、Windows 图 10 组通过；性能 p95 30.0ms。独立 SSH 双向原生链、普通无 debug EXE 及源/包完整性分别通过，原始证据与范围见当次报告。历史表保留原日期/版本，不计为本次重新运行。


## alpha.9 当前节点管理专项

T-M10-23 / M10-F01/F02/F03/F06：2026-10-13 / 0.6.0-alpha.9。范围：alpha.9 最终前端、中央与 Linux 包一致性，可信 alpha.8 清单，实际窗口和普通 EXE 分开验证。逐项实际结果、环境、脚本、原始证据与未测范围见 [节点管理完整验收](../../iterations/I06/node-management.md)。工程证据为本次 [桌面 TAP](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)；窗口/程序/包状态以该报告实际结果为准，历史表不充当本次重测。原生 SSH/模型链保留 alpha.6 历史结果，本次未重跑、不改用户 profile、不提交 Prompt。

## I06C alpha.10 当前专项

T-M10-24 / M10-F01/F02/F03/F06：2026-10-13。范围：alpha.10 包含机器管理、私有历史和事件补偿当前源码/前端；收录 alpha.9 历史 manifest 前与实际已交付 digest 核对。现有可信 daemon 只复用、不升级。窗口 app.asar、冻结后台、Linux 离线资源和 portable 均逐项校验。新数据含管理状态，直接旧后台回退不支持；完整升级/回滚/卸载仍待 6C 后续。 本次实际工程、隔离 TCP SSH、Windows 界面/包与未测项见 [6C 首批验收](../../iterations/I06/machine-management.md)；[桌面 TAP](../../../artifacts/I06C/2026-10-13/desktop-tests.tap)和当次报告是当前证据，alpha.6 双向真实 Agent 链保留原日期/版本。未改用户 profile、未升级用户 daemon、无真实模型任务，不将首批标为完整 I06C。

## GitHub alpha.9 预发布附件核验

T-M10-25 / M10-F06：2026-10-13 / alpha.9，真实 GitHub API 上传与公开发布查询通过。EXE 为 129,583,670 字节，服务器 state=uploaded，digest=`sha256:80c8a39036ba93466de96955e707280f436b6da258d5e047c7590822e2c0d688`，与本地已有包一致；SHA256SUMS.txt 108 字节，两附件核验后 draft=false/prerelease=true。这是分发核验，没有重新执行 EXE/模型/SSH 验收。已有本地包验收保留原日期与版本；本次源码同步的沙箱回归失败仍保留。原始脱敏元数据与分层结果见 [发布记录](../../iterations/I06/github-release.md)。

## alpha.13 当前验证

T-M10-25 / M10-F01/F03/F04/F07：2026-10-14，WSL Ubuntu / Node 22.23.1，桌面受控回归 **150/150** 通过（全工程总数，模块之间不重复相加）。场景：alpha.11 包含 28 个后台 CJS 和 1376 个 Linux 文件，收录已交付 alpha.10 可信清单。Linux 增加静态 owned-stop、glibc 许可与重链接说明；从 C 源码编译并纳入逐文件摘要。旧 daemon 的安全停机需要支持 pidfd 的 Linux 内核（5.3+）；不支持时明确拒绝，不退回仅 PID 停机。新 daemon 使用认证停机 RPC。verify-package 逐项比对窗口、冻结后台、前端及离线资源；新候选生成并不自动发布或修改原用户后台。

证据：[完整桌面 TAP](../../../artifacts/I06C-final/2026-10-14/desktop-alpha13.tap)、[维护实际 daemon/process 7 项](../../../artifacts/I06C-final/2026-10-13/maintenance-tests.tap)、[包内容核验](../../../artifacts/I06C-final/2026-10-14/package-alpha13.json)。维护测试使用真实生产 daemon、Unix socket、独立进程和磁盘，原生 host 受控、无模型调用；不能替代独立服务器或真实原生控制。Windows 窗口、原生 Session 与双向链、使用/卸载、命令和限制统一见 [逐项验收](../../iterations/I06/final-delivery.md)，未实际执行项不得计为通过。

## alpha.14 上传修复验证

T-M10-26 / M10-F02/F03：2026-10-14 / alpha.14。桌面受控 155/155，上传专项 5/5（含真实本机 TCP SSH/SFTP，使用隔离服务器和数据），Windows Edge 受控响应界面 2 组通过；原生提交 0，未连接用户 Linux。打开/写入/关闭失败、权限/空间/通道关闭/超时、分片/乱序 ACK、原 ID 重新检测和批准、unknown 不提供重装分别有证据。当前包、普通 EXE、原始材料与限制见 [完整增量验收](../../iterations/I06/ssh-upload-recovery.md)。155 包含 5，不重复相加。

alpha.14 包内容比对通过：28 CJS / 1379 Linux 文件，[包报告](../../../artifacts/ssh-upload/2026-10-14/package.json)含版本、大小与 SHA-256；普通 portable Windows 隔离启动/关闭/重开 3 项通过，原生提交和委派为 0，[报告](../../../artifacts/ssh-upload/2026-10-14/portable.json)。未上传新 GitHub Release，未连接用户服务器。

## alpha.13 本次独立实机补充

2026-10-14：冻结 alpha.13 Windows 包与独立 Linux，真实升级、同原生 Session 两轮及两方向协作通过；真实 Windows 取消和普通无调试窗口原生标记分别通过。独立 SSH/生产 daemon 的精确响应丢失、10 同 ID 与重启为受控执行器证据，不充当真实模型。Linux 文件任务受原生 OOM 退出影响，原 ID/Session 与 unknown 占位保留，未准出、未重发；后续 alpha.14 上传专项不冒充此模型矩阵复测。逐场景原始证据、版本、实际失败、临时自有资源调度及剩余项见 [I06C 当前实机记录](../../iterations/I06/final-delivery.md)。

## alpha.15 当前源码包重建

2026-10-14 / WSL Ubuntu / Node 22.23.1：从当前 `0.6.0-alpha.15` 源码执行 `npm run dist:win`，Windows x64 portable EXE 构建与 `verify-package.cjs --portable` 均通过。后端 28 个模块、Linux 离线资源 1380 个文件；`app.asar` 源码和前端与当前源码一致。EXE 为 129,851,710 字节，SHA-256 `d1052ed5cd7893a9842ee96b6bf87c40b2ec6a5389ac59ef28ad5eb528e0ac4f`。本次构建没有重新执行真实 Windows 用户流程；alpha.13 普通 EXE 的实机证据与 alpha.15 包构建分开记录，完整 I06C 仍未准出。

alpha.15 发布复核：源码提交 `15b7c9ea9c3d53802797b655e0cffaf365658574` 已位于 GitHub `master`，`v0.6.0-alpha.15` 为 prerelease。EXE 远端 state=`uploaded`、129,851,710 字节、digest 与本地一致；`SHA256SUMS.txt` state=`uploaded`，109 字节。真实 Windows 用户流程未在这次构建后重跑；稳定历史版本仍为 0.5.0，完整 I06C 未准出。详见 [发布记录](../../iterations/I06/github-release.md)。

发布后测试补充：新增四项仅测试代码的维护传输边界回归，桌面全量当前 163/163。新增测试不改变 alpha.15 EXE 中的产品源码；具体边界见 [M04 SSH 测试报告](../04-ssh-access/test-report.md)。

## alpha.16 当前源码包重建

2026-10-14 / WSL Ubuntu / Node 22.23.1：`npm run dist:win` 首次因 electron-builder 临时打包错误退出，28 MB 临时文件未使用；清理临时 EXE 后重跑成功，`verify-package.cjs --portable` 通过。最终包版本 `0.6.0-alpha.16`，28 个后台模块、1381 个 Linux 文件，app.asar/前端匹配源码；EXE 129,851,194 字节，SHA-256 `d1e35450e57967767fc5031ba4bdc8dfb5f5552dc374079a4a3005fc5f3223ba`。根 43/43、桌面 163/163、SSH 定向集成 7/7 通过。真实 Windows 用户流程未重跑；完整 I06C 未准出。

## alpha.16 最终候选验证

2026-10-14：Windows x64 EXE 129,851,194 字节，SHA-256 `d1e35450e57967767fc5031ba4bdc8dfb5f5552dc374079a4a3005fc5f3223ba`；28 后台模块/1381 Linux 文件与源码一致：[最终包报告](../../../artifacts/I06C-final/2026-10-14/package-alpha16-final.json)。普通无调试 EXE 真实启动/关闭/重开 3 项通过，独立 profile、原生需求 0：[报告](../../../artifacts/I06C-final/2026-10-14/portable-alpha16.json)。实际 Linux 维护、原文件任务与完整准出限制见 [当前交付](../../iterations/I06/maintenance-launch-recovery.md)。历史 alpha.15 分发摘要不被本版本覆盖。

## alpha.17 独立最终候选检查

2026-10-14：源码快照独立构建后与主工作区逐项校验通过，28 CJS / 1382 Linux 文件；EXE 129,849,380 字节，SHA-256 `aa97a2b2adbd3bff8837fee10d16433b929225d384dc5e5b1966d315873905d5`。[包报告](../../../artifacts/I06C-final/2026-10-14/package-alpha17-final.json)。普通 Windows EXE 启动/关闭/重开 3 项通过，无调试参数，独立 profile，原生需求 0：[窗口报告](../../../artifacts/I06C-final/2026-10-14/portable-alpha17.json)。冻结 alpha.16 服务器维护结果分别计，alpha.17 未冒充原生模型重测。

当前 alpha.18 已以 GitHub prerelease 分发：[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/AgentBridge-0.6.0-alpha.18-Windows-x64.exe)、[校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.18/SHA256SUMS.txt)、[源码 PR #1](https://github.com/wsjq5477/MA-Relay/pull/1)。源码标签绑定 `1f0d9ef`，独立分支未合入 master；分发只证明对应附件核验，不扩大为完整 I06C 准出。详见 [发布记录](../../iterations/I06/github-release.md)。

本专项工程补验：桌面 181/181、核心基线 43/43、lint/类型/构建通过；包内私有 Linux Node 的真实 CLI 版本探测复验通过，Windows EXE 已构建并核对资源，详见上述专项“实际验证”。不计为用户服务器升级或模型任务验收。

2026-10-15 alpha.19 合并包复验：核心45/45、桌面181/181、lint/类型/构建通过；发布资源真实 Linux Codex0.162.1发现、Windows受控扫描/配置6组、普通EXE4组通过。最终包摘要和未测边界统一见 [Linux/合并包专项](../../iterations/I06/linux-cli-discovery.md)；未实测用户服务器或真实模型任务。
