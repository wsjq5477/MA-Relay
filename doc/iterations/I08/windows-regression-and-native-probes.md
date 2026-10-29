# Windows 回归、原生列表启动与 SSH 凭据清理

日期：2026-10-29（Asia/Hong_Kong）。基于 master `10fdbb3` 及已有未提交工作树继续维护；公开 `0.6.0-alpha.68` / `38cd637` 和冻结 EXE 不变。本轮没有发布、切换日常后台、部署 SSH 或调用模型。

## 需求与范围

承接上轮已完成的 Pi 目录事件/Claude 脚本启动修复，重新定位 Windows 全量失败。对应 AB-F05/F11/F13 中的凭据维护、原执行验证与独立 MCP 观测；本次实际产品变化仅涉及 M04-F03/F08 与 M06-F01/F02 的单文件清理和原生列表启动。既有 Pi 与界面预览改动保留。

本轮开始的完整 Windows 基线为 **1010 项：939 通过、70 失败、1 跳过**。这不是公开 alpha.68 的历史 926/74/1，也不能反向改写历史发布结果。基线开始后只修改已经执行完的 Claude/Codex、MCP 测试文件，产品代码在基线完整结束后才修改；[输入摘要](../../../artifacts/windows-regression/2026-10-29/source-before.json)、[完整日志](../../../artifacts/windows-regression/2026-10-29/baseline.tap)、[逐项失败](../../../artifacts/windows-regression/2026-10-29/baseline-failures.json)保留。

## 产品修复

### SSH 原密文文件清理

Windows 系统 Node **24.12.0** 实测：ASCII 工作区路径的 `rmSync` 能删除合成文件，含中文路径下返回成功但原文件仍存在；`unlinkSync` 在同一组路径均实际删除。既有机器编辑和凭据保存测试因此失败。新回归在修复前 **0/2**，覆盖保存替换/取消保存后的原密文、原引用、无效路径别名、缺失文件及目录错误。

`CredentialStore.remove()` 改为对原合法引用对应的单个 `.json` 调用 `unlinkSync`；只有 `ENOENT` 视为已经不存在，其他文件系统错误仍传播。不递归删除目录，不放宽引用格式，不更换加密方式或凭据目录。更换认证方式/移除机器仍先提交原配置与原收据，再沿原引用清理，原 Task/Session/unknown 不变。

对照本机 Electron **44.7.0 / Node24.21.0** 的同一合成探针，`rmSync`/`unlinkSync` 均能删除；所以本次确认的是系统 Node24.12.0 源码运行路径缺陷，不能据此声称冻结普通 EXE 也有同一缺陷。Electron 仅以 Node 模式运行组件，不是普通 EXE 验收。

证据：[修复前回归](../../../artifacts/windows-regression/2026-10-29/credential-before.tap)、[原生文件系统探针](../../../artifacts/windows-regression/2026-10-29/filesystem-probe.cjs)、[系统 Node](../../../artifacts/windows-regression/2026-10-29/filesystem-node.json)、[Electron 对照](../../../artifacts/windows-regression/2026-10-29/filesystem-electron.json)、[源码](../../../desktop/electron/ssh-credentials.cjs)、[回归](../../../desktop/tests/ssh-credential-cleanup.test.cjs)。只使用临时合成密文，没有读取或删除用户凭据。

### MCP 原生列表沿原安装启动

修复测试夹具的跨平台入口后，发现 `McpIntegration.nativeProbe()` 只为 Pi/Hermes 使用共享启动器。Claude/Codex/OpenCode 的已选 JS 或 npm shim 在 Windows 会产生同步 EFTYPE/EINVAL；此前 POSIX shell 夹具掩盖了这个产品缺口。[中间失败 35/38](../../../artifacts/windows-regression/2026-10-29/native-mcp-first.tap)保留。

五个原生列表入口现在统一调用 `tool-discovery.command()`：JS/CJS/MJS 经 Node，标准 npm shim 按原安装解析，Codex 继续使用同包原生二进制与原 JS 安装身份。参数保持结构化数组，继承原环境；不调用 shell、不回退另一安装、不写模型/账号配置。原生列表的命令与解析规则不变。

启动器拒绝或同步 OS 启动失败返回 `native-list / outcome:error`，只保存错误码；不抛出整个探测、不宣告加载或连接成功。此前已观察成功的列表也不能沿用为本次加载/连接证明。Bridge stdio 工具目录与授权仍独立核验，可同时为“工具可用/授权有效”及“原生连接未知”。不因此清理原任务或释放 unknown。

证据：[源码](../../../desktop/electron/mcp-integration.cjs)、[三个经典入口/不支持 shim/OS 失败回归](../../../desktop/tests/native-list-launch.test.cjs)、[MCP 集成回归](../../../desktop/tests/mcp-integration.test.cjs)、[定向 38/38](../../../artifacts/windows-regression/2026-10-29/native-mcp-after.tap)。均为受控 CLI/真实 OS 子进程，非已安装 Agent 或真实模型消费。

## 验证器修复及平台边界

| 原失败 | 最终验证方式 | 产品运行行为 |
| --- | --- | --- |
| Claude/Codex 无扩展名 POSIX 脚本不能被 Windows 执行 | 改为明确 `.cjs` 入口；Claude bootstrap 用只在 worker 退出的 Node preload；原断言保留 | 未修改两宿主的执行/会话协议 |
| Codex 固定 150ms 后取消、约 3 秒轮询窗口 | 等实际原生绑定后取消，10 秒有界等待原退出；原收据 unknown 与终态 cancelled 分开核对 | 未修改产品取消实现 |
| Windows 文件删除夹具没有真正移除旧文件 | 单文件反例用 unlink；运行时源目录用异步 rm 并断言目录确实不存在 | worker-runtime 产品源码未改 |
| 图崩溃测试只识别 POSIX SIGKILL | 在准确 rename 前/后记录注入点，Windows 核对真实强制终止的退出码1/POSIX 核对信号；原收据、修订与不重放断言保留 | 关系/布局持久化未改 |
| Linux 发现夹具在 Windows 拼出错误 PATH | 使用宿主 `path.delimiter`，保留原 PATH 权威与旧版回退断言 | 发现器产品源码未改 |
| 40 项 Linux daemon/UID/Unix socket/native helper 测试在 Windows 无法执行 | 逐项显式 Linux 门禁并写明跳过原因；协议编解码、SSH 通道与维护控制等可跨平台项继续运行 | 不模拟或放宽生产 Linux 门禁；跳过不算通过 |

第一次 Claude/Codex 修正后为 **22/23**，暴露 Codex 取消等待超时；[日志](../../../artifacts/windows-regression/2026-10-29/claude-codex-first.tap)保留。平台相关定向 **78 项：38 通过、40 明确跳过、失败0**；[日志](../../../artifacts/windows-regression/2026-10-29/platform-after.tap)。最终运行时删除/重建/缓存验证 **10/10**，含源目录实际不存在断言；[日志](../../../artifacts/windows-regression/2026-10-29/runtime-after.tap)。这些共享子集不能与全量相加。

首次未隔离原生 Home/PATH 的 WSL 运行 **42 项：39 通过、2 失败、1 超时取消**；涉及生产 daemon 发现、detached ensure 启动与 stdio 生命周期，原结果保留在[日志](../../../artifacts/windows-regression/2026-10-29/linux-daemon-baseline.tap)。后续使用独立临时 Home/PATH 验证本轮受控范围，不能把首次失败写成通过，也不把 WSL 当作独立 SSH。

后续隔离Home/PATH的首轮 **151项：149通过、1失败、1超时取消**，分别仍为detached ensure的10秒就绪窗口及stdio测试的15秒窗口；[原日志](../../../artifacts/windows-regression/2026-10-29/linux-controlled.tap)保留。独立生产进程探针实测从当前Windows挂载源码就绪需要 **18377ms**，原PID匹配、SIGTERM后退出0且合成状态已删除；[探针结果](../../../artifacts/windows-regression/2026-10-29/linux-start-probe.json)。因此仅将源码测试的ensure等待显式设置为60秒，stdio测试上限与原RPC的65秒对齐，产品daemon默认10秒与现有业务RPC预算均未改变。该检查不构成冷启动性能准出。

## 最终工程结果

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| Windows 系统 Node24.12.0 完整桌面 | **1017项：976通过、失败0、41跳过**；40项为本轮明确Linux门禁，1项为原Linux daemon门禁 | [完整TAP](../../../artifacts/windows-regression/2026-10-29/windows-final.tap) |
| WSL Ubuntu22.04 / Node22.23.1隔离受控组 | **151/151，失败/取消/跳过均0**；Windows新增40项平台跳过逐项同名核对均在本组通过，临时Home已移除；不是独立SSH | [完整TAP](../../../artifacts/windows-regression/2026-10-29/linux-final.tap)、[逐项核对摘要](../../../artifacts/windows-regression/2026-10-29/acceptance-summary.json) |
| Electron44.7.0 / Node24.21.0组件 | 新增凭据/原生列表7/7；不是普通EXE/UI验收 | [TAP](../../../artifacts/windows-regression/2026-10-29/electron-components.tap)、[进程结果](../../../artifacts/windows-regression/2026-10-29/electron-components-process.json) |
| 根TypeScript / lint / 修改产品与新增CJS规则 | 通过；CJS检查未使用/不可达 | [typecheck](../../../artifacts/windows-regression/2026-10-29/typecheck.log)、[lint](../../../artifacts/windows-regression/2026-10-29/lint.log)、[CJS](../../../artifacts/windows-regression/2026-10-29/cjs-lint.log) |
| Core与桌面生产构建 | 通过，保留原500kB大chunk提示 | [构建日志](../../../artifacts/windows-regression/2026-10-29/build.log) |
| 用户文档测试/构建 | 6/6；18页、19HTML、158份页面/搜索资源审计，内部页/证据导出0 | [测试](../../../artifacts/windows-regression/2026-10-29/docs-test.log)、[构建](../../../artifacts/windows-regression/2026-10-29/docs-build.log) |
| 完整文档检查 | 仍退出1，原2243项缺失；新增0/移除0 | [完整JSON](../../../artifacts/windows-regression/2026-10-29/docs-after.json)、[差异](../../../artifacts/windows-regression/2026-10-29/docs-delta.json) |

最终产品源码只改动mcp-integration与ssh-credentials两份文件；[本轮前后输入摘要](../../../artifacts/windows-regression/2026-10-29/source-final.json)列出全部源码哈希与18份测试/辅助文件。完整Windows运行后只调整两个Linux源码加载测试预算，并补验Windows同文件22项（3通过/19平台跳过、失败0），[日志](../../../artifacts/windows-regression/2026-10-29/windows-budget-after.tap)。25份变动CJS语法核对与CRLF感知差异检查通过：[语法](../../../artifacts/windows-regression/2026-10-29/cjs-syntax.json)、[空白检查](../../../artifacts/windows-regression/2026-10-29/diff-check.log)。

70个原失败中，30个在本轮运行通过、40个在Windows按实际平台要求跳过；另新增7个回归。因此不能把“Windows失败0”写成原1010项全部执行通过。公开alpha.68的历史全量与完整准出仍保留。

## 合约核对、复现与后续

核对 architecture/data-model/protocol：无新增进程层、RPC、持久字段/格式、授权或任务重派通道。MCP 原列表命令及 outcome 枚举保持，凭据仍为 DPAPI CurrentUser 密文与原引用；只修启动/清理实现和失败观测。整体设计、受影响 M04/M06 及三子适配器、相关测试报告、用户说明、整体测试、路线和迭代索引同步。

```powershell
node --test --test-reporter=tap --test-concurrency=1 desktop/tests/*.test.cjs
node --test desktop/tests/ssh-credential-cleanup.test.cjs desktop/tests/native-list-launch.test.cjs
npm run typecheck
npm run lint
node scripts/check-docs.mjs
```

Linux 受控启动脚本：[run-linux-controlled.cjs](../../../artifacts/windows-regression/2026-10-29/run-linux-controlled.cjs)，需在 WSL/Linux 用实际 Node 运行；它为子进程创建临时 Home/PATH，结束后移除，模型0。本轮新回归不是实际 DPAPI、真实 Agent 模型、用户 profile、普通 EXE、新 Linux 发布包或独立 SSH 验收；这些及完整 I06C/I07C/MCP02、图性能继续保持未准出。
