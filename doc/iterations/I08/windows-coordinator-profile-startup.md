# I08 · issue #33 Windows 大型 Coordinator profile 启动

## 问题与基线

2026-11-16，Windows portable 打开后 `bridge:pending` 收到 `spawnSync icacls.exe ETIMEDOUT`，后台版本一直未读，机器、Agent、任务和授权显示为零。issue 记录的只读现场检查显示，profile 根目录已经关闭继承且只授权给当前用户，目录约 9.2 GB、125,398 个文件，约有 40 个历史 Coordinator 版本。现场 ACL 传播耗时属于推断。[issue #33](https://github.com/wsjq5477/MA-Relay/issues/33)

issue 引用私有 CodeAgent `820ca42`、`0.6.0-alpha.74-codeagent.10`、patch revision 16。公开仓库及其远端没有该引用。可见前台 ASAR 记录的版本为 `0.6.0-alpha.72.dsh.3`，故障截图对应的打包版本仍待确认。本次修复基于公开 `master` `69c5a40`，桌面版本 `0.6.0-alpha.76`，其启动路径有同一缺陷，旧 `icacls` 预算为 10 秒，issue 所述私有基线为 60 秒。

公开基线受控复现将 ACL 写入注入 `ETIMEDOUT`。两次私有目录初始化均尝试写入，均抛出原始同步子进程错误。Coordinator 在读身份文件前退出，前端以初始零值呈现，且偏好和版本仅在挂载时请求一次。

## 修改与恢复

- 在 Windows PowerShell 子进程读取目标目录的安全描述符。通过条件为当前用户所有、DACL 关闭继承、仅有当前用户一条可继承的完全控制允许规则。满足条件时返回只读检查结果。其余情况尝试应用受保护的单用户 ACL，再校验结果。本地错误分类为 `PRIVATE_DIRECTORY_TIMEOUT` 或 `PRIVATE_DIRECTORY`，文案中省去路径、SID 和子进程输出。[私有目录源码](../../../desktop/electron/private-directory.cjs)
- Coordinator 客户端在单次异步连接尝试中准备原身份，等待后台期间复用该身份握手。后台入口和运行版本分别在读身份或使用运行资源前确认目录。进程内同目录初始化合并，失败后缓存 30 秒，显式重连可提前清除退避。关闭窗口会结束在途的窗口侧建连，已启动的常驻后台继续运行，明确停止沿既有关闭入口。[客户端](../../../desktop/electron/coordinator-client.cjs) · [后台入口](../../../desktop/electron/coordinator.cjs) · [运行版本目录](../../../desktop/electron/coordinator-runtime.cjs)
- Electron IPC 验证主窗口和主 frame，`bridge:reconnect` 只执行建连。前端区分待连接、私有目录故障及已经读取的真实空值，保留断开前最后读取的快照。私有目录错误后等待 30 秒才自动读取，版本与偏好读取失败后随刷新恢复。[Electron IPC](../../../desktop/electron/main.cjs) · [桌面状态](../../../desktop/src/NetworkApp.tsx)
- 保留原 Coordinator 身份、机器、Agent、关系、任务、授权、pending、unknown 和历史版本。连接恢复只读取原数据，未确认执行沿既有原 ID 查询入口。

## 验收记录

环境为 Windows `10.0.26220.0`、Node `24.12.0`。源码、构建、日志、合成 profile 和工具临时目录位于 D: 或 E:。

- 受控旧基线注入记录 `artifacts/issue33/acl-baseline.log`。基线连续两次命令失败，修复后只启动一次并向同期请求返回同一脱敏分类；刷新命中退避，显式重连后重新建连。
- 主进程 IPC 受控回归分别通过 `bridge:call`、`bridge:pending`、`bridge:preferences` 发起首轮连接。ACL 在途时 `bridge:window` 仍响应，超时后暂停业务派发，显式重连读回原快照、版本和未知操作，原身份和 pending 文件字节一致。[主进程测试](../../../desktop/tests/coordinator-startup.test.cjs)
- Windows ACL 回归覆盖合并、超时、错误脱敏和 Windows NTFS 的首次设置、兼容旧 `icacls` ACL 的只读复验、显式其他主体权限的修复。合成大型目录含 9,200,000,000 字节、125,398 个文件、40 个历史目录。公开旧基线对安全根目录的修改命令在 10,013 毫秒时实际超时，另一次历史版本目录的隔离准备写入在 60,057 毫秒时超时。原始记录为 `large-fixture.json` 与 `large-baseline-acl.json`。[Windows ACL 测试](../../../desktop/tests/private-directory.test.cjs)
- 合成历史版本先移至同卷隔离位置，修复空的 `coordinator/versions` 后移回全部 125,398 个文件。生产校验函数对合成 profile 根与已填充历史版本目录各执行一次只读描述符查询，分别耗时 1,627 和 2,173 毫秒，修改次数均为 0。原始记录为 `large-fixed-acl.json`。
- Chrome 140 上以生产前端构建重现旧界面的原始 pending 错误、四项零值、版本持续读取及偏好未处理异常。修复版通过首次超时与退避、显式重连后恢复快照与偏好、再断开保留快照与原 pending 后区分真实空数据三组检查，页面异常与模型调用均为 0。原始记录为 `renderer-before/report.json`、`renderer-after/report.json` 及同尺寸超时对照图。[界面测试](../../../desktop/tests/ui-coordinator-startup.cjs)
- 定向 Windows 回归首轮 116 通过、1 失败（直接调用 `CoordinatorClient.ensure()` 的既有关系能力检查夹具）。将连接代次捕获移入 `ensure()` 后，同范围 117 通过、0 失败、0 跳过。根类型检查、桌面类型检查、根 lint 与根构建均通过。原始记录为 `targeted.tap`、`targeted-retry.tap` 与各工程检查日志。
- `node scripts/check-docs.mjs` 在公开基线与当前改动均退出 1，3071 项既有缺失证据链接的错误清单相同。`git diff --check` 通过。原始记录为 `docs-baseline.json` 和 `docs-check.json`。

### 本地 Windows portable

使用项目本地打包脚本生成 `0.6.0-alpha.76.issue33.2`，589,471,350 字节，SHA-256 `cece18b21de3c18357d14d15e673d487974ce7bbbf6c55f99ae1b1176b62d742`。实际 portable 解包 3,522 项逐文件匹配，ASAR、Windows bridge 及 Linux 包各 76 项后台源码一致，Windows bridge 和 Linux 包各 87 项 Core 输出一致。Linux 资源清单核对 1,749 项，前端使用最终构建，ASAR 无测试入口。首次包阶段缺 Linux 运行资源，补入已发布 alpha.76 的原资源后完成本地构建。原始记录为 `build.log`、`build-final.log` 和 `final-portable-package-check.json`。

普通 EXE 在同一合成大型 profile 上完成首次启动、仅关窗、重开复用同一 Coordinator，以及设置中确认停止后台。通过认证 IPC 读回版本、1 台原机器、1 条归档任务及含原 request/operation/task ID 的 unknown 记录。原身份、pending、归档任务文件和抽查的历史载荷字节一致。退出后只读复查根目录与版本目录的 ACL，40 个历史目录与 125,398 个历史文件仍在。原始记录为 `ordinary-portable.json`、`large-post-stop.json`，实图为 `reopen-window.png` 和 `explicit-stop-dialog.png`。

首次从启动 wrapper 到看到窗口为 178.956 秒，到首个新快照为 219.228 秒。首个窗口消息探测未获回应，初次抓屏为黑屏。重开分别为 155.393 秒和 158.943 秒，窗口消息探测成功，版本、机器和待核对提示可见。从按钮选择明确停止后，EXE wrapper 和原 Coordinator 进程均退出。普通运行耗时包含 portable 解包及后台准备，ACL 的等待期间响应性以受控主进程回归为证据。

## 验收边界

用户真实 profile 只纳入 issue 的只读现场证据。冻结的私有 CodeAgent 源码和故障截图中的 EXE 版本均待确认。快速验证覆盖根目录安全描述符，子树既存的独立显式权限、重解析点、权限传播和其他安全软件介入仍属于 Windows 环境差异。真实原生 Agent、模型、生产 SSH 和完整平台矩阵沿用已有验收范围。

## 覆盖升级

2026-11-17。Windows x64 安装包在程序安装目录覆盖文件。打包 Windows 桌面启动后，以原 profile 认证握手判断是否有更低版本的本地 Coordinator。普通关窗仍保留后台，同版和已运行的更高版沿正常连接路径。仅 Windows 打包桌面启用自动切换。

在绑定业务请求前准备新版完整运行资源，核对版本及当前关系数据的写入能力。对已认证的更低版本后台发送一次现有的 `shutdown`，通过握手返回的原进程号等待 Windows 确认退出，再启动新后台并核对响应版本。等待退出期间暂停业务派发。停止响应丢失时继续核对原进程是否退出；无法确认时保留现场并提示重试。启动沿原身份、待确认操作和数据目录。 [桌面启动](../../../desktop/electron/main.cjs) · [切换代码](../../../desktop/electron/coordinator-client.cjs) · [安装构建](../../../scripts/build-local-exe.ps1)

Windows 源码定向回归 25/25，包括并发首轮读取、旧关系协议仅允许停止、旧进程退出后启动、同版与降级复用，以及新运行时准备失败。延迟旧进程清理的两项新回归单独重跑 2/2。保留原身份和 unknown 文件字节。 [源码测试](../../../desktop/tests/coordinator-upgrade.test.cjs)

Windows 实际打包应用从 `0.6.0-alpha.76.issue33.2` 后台切换到 `0.6.0-alpha.76.issue33.3`。启动新版窗口后旧进程退出，约 40.18 秒读回新版版本、原机器及待确认请求。原身份与 pending 文件逐字节一致。首轮在受限环境中未读到新版握手，第二轮完成进程切换但未取得未预置机器记录的前端快照，保留两轮超时日志。最终隔离轮次使用预置本机及 unknown 记录。原始记录为 `packaged-upgrade.log`、`packaged-upgrade-retry.log`、`packaged-upgrade-final.log` 与 `packaged-upgrade-QFIt6J/report.json`。[包内升级测试](../../../desktop/tests/windows-coordinator-upgrade.cjs)

本地 NSIS 安装包 `0.6.0-alpha.76.issue33.3` 为 141,644,483 字节，SHA-256 `1ce2d6c3f2e3a04920b13ebfef68b19ca860bd43a10355513c0ad1bcd05ee31a`。从 Setup 提取的 ASAR 与上述实测包目录字节一致，主进程及 Windows bridge、Linux 包中受改动的模块与源码一致。核验见 `setup-check.json`。实测从打包应用运行目录启动新版，Windows 安装器写入安装注册表和旧安装目录的完整过程由用户验收。

文档检查本轮与公开基线仍为同一组 3071 项历史证据链接错误，新增 0 项。
