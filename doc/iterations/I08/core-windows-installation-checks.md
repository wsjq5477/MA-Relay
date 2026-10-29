# Core Windows回归与原安装版本检查

后续本片已随[alpha.69](alpha69-release.md)公开；下文保留原实施时点、失败和证据边界，不将发布包/新复验写成旧轮实测。

关联AB-F02/F15、M09-F01/F03/F06及M06-OC-F01。2026-10-29，Windows11 Insider Preview 26220 / Node24.12.0，基于master `10fdbb3` 与原工作树的未发布维护；公开alpha.68冻结 `38cd637` 不变。本片接续[MCP临时文件清理](mcp-config-temporary-cleanup.md)，两片产品改动与计数分别记录。

## 产品缺口与实现

发现与serve已通过共享启动器运行所选安装，Core controller的check和高级连接向导却仍直接execFile已选路径。CJS/MJS可被发现和启动，却在只读检查时报安装不可用。新增内部`readOpenCodeVersion(executable)`复用`tool-discovery.command`，两个调用方共用：JS经Node、npm脚本按原安装解析、原生程序保持原路径；参数数组、shell=false、windowsHide=true及原环境继承。维持原10秒、64KiB输出与100字显示上限。失败仍为unavailable/草稿提示，不代替原生API、认证、模型或真实回复验证，不选择其他安装。

源码：[discovery.ts](../../../src/discovery.ts)、[controller.ts](../../../src/controller.ts)、[terminal.ts](../../../src/terminal.ts)。[新回归](../../../tests/native-installation-check.test.ts)使用带空格和`&`的CJS/MJS路径，核对准确`--version`、Node模式、既有HTTP元数据及模型0；删除原入口后仍不可用，不执行替代安装。修复前最终[0/2](../../../artifacts/core-windows/2026-10-29/version-before-final.tap)、后[2/2](../../../artifacts/core-windows/2026-10-29/version-after.tap)。

最初夹具误传schema不允许的字段，[准备阶段失败](../../../artifacts/core-windows/2026-10-29/version-fixture-first.tap)保留，不算产品反例；随后首次[清理顺序问题](../../../artifacts/core-windows/2026-10-29/version-before.tap)保留，修正先关闭controller再删除目录后才取得上述0/2产品反例。

## 验证器与平台边界

初始官方npm test实际**71项：53通过、18失败、取消/跳过0**，约302秒；[完整日志](../../../artifacts/core-windows/2026-10-29/core-baseline.log)保留，不改写公开版的历史结果。

| 原问题 | 本轮处理 | 保留的边界 |
| --- | --- | --- |
| Windows实际为named pipe，夹具却stat controller.sock | 使用生产socketPath核对外来服务仍监听、mutation=0；POSIX才核对inode/mode与普通文件占位 | 不改IPC、身份或接管规则 |
| Windows mode不表示POSIX独占权限 | 凭据不可覆盖/非法URL/重复身份继续跨平台；mode场景独立平台门禁 | 不冒充Windows ACL验证 |
| 中文路径rmSync未实际删除反例 | 删除入口、用户token和模型偏好用准确unlink | 原安装不可替代、缺凭据拒绝、模型继承断言保留 |
| POSIX脚本不能充当Windows PE，Linux fallback误读日常安装 | POSIX真实执行明确Linux门禁；新增跨平台npm shim准确解析组件 | 不称为真实PE执行 |
| chmod无法拒绝Windows/root写入 | 最终rename受控注入ENOSPC，前段实际写入后核对原文/修订保持；Linux非root仍实际chmod | 原子持久化产品实现未改 |
| 65537字符argv超过Windows进程命令行上限 | 仅测试时在子进程内构造准确argv，再导入真实CLI入口 | 保持原长度、退出码2与产品参数规则 |
| /proc、UID及Python POSIX pty平台要求 | 显式Linux门禁；不支持版本/坏API/未登记端口等跨平台拒绝继续执行，组合场景拆开 | 不放宽生产托管归属 |

报告输出支持本轮显式AGENTBRIDGE_TEST_REPORT，既有脚本默认报告路径不变，不用今天结果填入缺失的历史证据路径。

首轮全量推进至**78项：66通过、1失败、11平台跳过**：[原日志](../../../artifacts/core-windows/2026-10-29/windows-first.tap)。剩余I01原两秒Mock任务已在观察进程启动前完成，退出0而非130；并非取消或unknown错误。测试Mock窗口改为8秒，功能验收上限最终统一300秒，产品预算不变。Windows用受控process.emit(SIGINT)验证原观察器处理器与任务不变，Linux继续真正发送SIGINT；不把Windows注入称为真实Ctrl+C。Windows最终I01实际227576ms，首次Linux快照的独立I01结果219692ms且29项场景完成，但测试原180秒截止仍记取消，不能改写为测试通过。

## 实际验证

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| Windows版本检查 | 前0/2，后2/2 | 上述新专项日志 |
| Windows源码定向 | 39项32通过/0失败/7平台跳过 | [TAP](../../../artifacts/core-windows/2026-10-29/targeted-first.tap)，不含四个PTY与完整I01 |
| Windows完整Core | **78项67通过、失败/取消0、11平台跳过** | [最终TAP](../../../artifacts/core-windows/2026-10-29/windows-final.tap)、[实际I01摘要](../../../artifacts/core-windows/2026-10-29/windows-acceptance.json)；20成功/10失败场景、历史丢失0、重复10次仅1调用、故障重派0与29项检查。全量后只将Linux测试截止与Windows已经使用的300秒对齐，Windows行为/预算未变 |
| Core构建、根typecheck/lint | 通过；首次规则/类型失败保留 | [构建](../../../artifacts/core-windows/2026-10-29/build.log)、[类型](../../../artifacts/core-windows/2026-10-29/typecheck.log)、[lint](../../../artifacts/core-windows/2026-10-29/lint.log)、[首次类型](../../../artifacts/core-windows/2026-10-29/typecheck-first.log)、[首次lint](../../../artifacts/core-windows/2026-10-29/lint-first.log) |

Linux后续完整运行实际定位Edge事件确认超时自旋，转入[独立修复与最终矩阵](edge-outbox-reconnect.md)。本片不宣称Linux完整通过；前述Windows78项是该Edge修复前的准确源码范围，不能冒充后续修复全量。

WSL首次从Windows node_modules运行tsx，20文件全部在esbuild装载阶段失败，业务场景未启动：[原日志](../../../artifacts/core-windows/2026-10-29/linux-loader-first.tap)。只下载lock与实际库完全匹配的Linux二进制，核对SHA-512，通过ESBUILD_BINARY_PATH供隔离测试使用，未改根依赖/锁。[完整性报告](../../../artifacts/core-windows/2026-10-29/linux-esbuild.json)、[准备脚本](../../../artifacts/core-windows/2026-10-29/prepare-linux-esbuild.cjs)。

随后Windows挂载源码上的CLI帮助超过原5秒窗口，[探索日志](../../../artifacts/core-windows/2026-10-29/linux-mounted-exploration.tap)保留。验证准确原运行器/进程出生身份后停止其三个子进程，独立临时Home已删除，[停止记录](../../../artifacts/core-windows/2026-10-29/mounted-stop.json)保留，不称为完整冻结基线。

另将相同src/tests/scripts/dist/desktop-electron逐文件核对SHA-256后复制至Linux原生临时目录，并复制实际生产依赖及tsx/esbuild运行依赖；首次快照**78项65通过、12失败、1取消**：[原TAP](../../../artifacts/core-windows/2026-10-29/linux-native-first.tap)。九项MCP CLI因快照漏带desktop/package.json而拒绝；另保留v1等待超时、两个未确认占用端口拒绝与原I01测试截止。不把夹具、负载或未知监听口故障推定为产品已修复；未放宽门禁。首次源目录/Home已删除，按准确随机源路径/Home复核的进程残留0，[核对](../../../artifacts/core-windows/2026-10-29/linux-first-cleanup.json)保留。

最终快照补齐桌面版本清单，Node二进制也复制至Linux原生临时目录并逐字节摘要核对；[Node副本](../../../artifacts/core-windows/2026-10-29/linux-node-copy.json)、[原生运行器](../../../artifacts/core-windows/2026-10-29/run-linux-native.cjs)与[源文件/依赖快照](../../../artifacts/core-windows/2026-10-29/linux-snapshot.json)保留。这是隔离源码功能验收，不改生产启动预算，不作为挂载目录或冷启动性能准出。

## 同步与后续

核对architecture/data-model/protocol：无新RPC、持久字段/格式或进程层；Task/Session、原requestId/operationId、unknown、权限/取消收据保持。仅内部只读启动修复与测试平台适配，三份合约正文无需制造新接口。同步AB-F15、M09设计/报告、M06及OpenCode设计/报告、整体测试/路线/矩阵、用户OpenCode说明与迭代索引。

模型0，未接独立SSH、未改用户profile/日常后台、未打包发布新EXE。完整I06C/I07C/MCP02、真实父模型/取消/性能和普通EXE准出保持。Core `/proc` 托管归属仍为Linux边界；Windows named pipe/受控已有HTTP测试不证明Windows原生进程接管。后续可分别核查settings、运行时与归档的失败临时清理，不据本轮扩大能力或宣称性能已修复。
