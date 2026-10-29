# Pi目录事件一致性与Windows启动、验证器修复

日期：2026-10-29（Asia/Hong_Kong）。基线master `10fdbb3740641204a681bc123fcd3ccb172eff41`及已有工作树，公开版本仍为alpha.68。完成工作区未收尾的Pi目录事件修复，并处理验证中发现的Claude npm入口及Windows测试器问题。没有构建、替换或发布新EXE。

## 需求与验收

关联AB-F03/F08/F11/F18、M06-F01/F04、M06-CC-F01、M07-F01/F02/F06/F07、M11-F05/F06。

| 编号 | 实际缺口 | 验收行为 |
| --- | --- | --- |
| PI-EVENT-01 | Pi派发前按真实目录接受别名，事件解析却按路径字符串拒绝同一目录 | 持久会话头、worker派发与原生session事件共用同一真实目录规则；junction/symlink可指向同一目录，不能冒充另一目录或Session |
| PI-EVENT-02 | 原生session事件缺cwd时可跳过目录检查 | 缺失、相对、非目录、不可用或异目录事件不能产生成功；已发生的绑定错误不被后续正确事件清除 |
| CC-SCRIPT-01 | 共享发现将npm shim解析到cli.js，ClaudeHost仍直接执行该JS文件，Windows返回EFTYPE | 同一已选JS/CJS/MJS入口用Node执行；参数逐项保留，不经过shell，不改变原生配置、Session或授权 |
| DOC-WIN-01 | 文档测试使用rmSync后反例文件仍存在，污染下一条断言 | 单文件用unlinkSync，目录用异步rm；原拒绝断言保持，并确认移除反例后19页再次通过审计 |

## 最终实现与边界

[native-cli-protocols.cjs](../../../desktop/electron/native-cli-protocols.cjs)将原Pi派发校验抽为sameWorkspace：两个绝对路径的realpath相等且是可用目录。piSessionFile与session事件共用它；原ID绑定、终态及unknown规则保持。宿主夹具按真实Pi行为回传原文件头cwd，不以process.cwd掩盖别名。原文件/Session不重写，目录校验仍不是文件系统沙箱，没有跨进程锁，检查后外部改写的竞态仍保留。

[claude-host.cjs](../../../desktop/electron/claude-host.cjs)的cliCommand增加JS/CJS/MJS入口分支，用process.execPath和独立参数数组，复制继承环境并设置ELECTRON_RUN_AS_NODE=1；原npm shim及原生可执行文件分支保持。宿主探测、提交检查和worker共用该方法。共享发现返回的安装路径身份保持，不改持久记录，不切换安装或模型。该分支适用于源码发现选中的脚本，尚未以用户实际安装或新EXE验收。

[native-delegation.test.cjs](../../../desktop/tests/native-delegation.test.cjs)在Windows使用Claude标准npm布局和其他适配器的.cjs夹具；Unix保留原可执行shebang。原Coordinator→MCP→MachineHost→worker完整链、原ID去重/重开、取消未知到实际退出、自然成功竞争、原目录/配置及权限断言保持。临时目录改异步删除。它仍是受控CLI，不是真实Claude/Hermes/Pi/DSH模型调用。

[doc-site.test.mjs](../../../tests/doc-site.test.mjs)仅改测试清理及补充恢复后的正向审计；公开范围检查器、18页白名单和内部材料拒绝规则未改。原5/6历史结果不改写为通过。

架构、数据和协议已核对并同步现有目录校验及脚本启动说明；没有新RPC、状态字段、数据版本、MCP权限或模型API层。Pi别名不解除unknown占位，控制收据confirmed仍不代表任务成功或取消。

## 实际验证

环境：Windows、Node24.12.0，源码alpha.68之后的工作树；Pi为此前固定的1.4.0未修改npm原包。模型调用0，未访问日常profile、原生账号配置或独立SSH。原始证据位于`artifacts/pi-workspace-events/2026-10-29/`，与2026-10-28证据分开。

| 检查 | 实际结果 | 原始证据 |
| --- | --- | --- |
| Pi冻结源码反例 | 3项中1通过、2失败；别名被拒与缺cwd被接受均复现 | [baseline.tap](../../../artifacts/pi-workspace-events/2026-10-29/baseline.tap) |
| Pi/共享宿主、原核对与Hermes分离 | 60/60，失败/跳过0；含别名重启原Session续聊、原请求去重、原文件字节保持、异目录/失效与unknown保护 | [related.tap](../../../artifacts/pi-workspace-events/2026-10-29/related.tap)、[目录事件测试](../../../desktop/tests/pi-workspace-events.test.cjs) |
| 原生SessionManager组件 | 四组通过；实际getHeader保留junction路径并被Bridge接受，模块SHA-256不变；终态事件为受控输入，无Prompt | [native-session.json](../../../artifacts/pi-workspace-events/2026-10-29/native-session.json)、[驱动](../../../desktop/tests/pi-session-native.cjs) |
| 扩展检查首次 | 11项8通过/3失败；启动边界8项通过，三项委派在发现阶段失败 | [start-delegation.tap](../../../artifacts/pi-workspace-events/2026-10-29/start-delegation.tap) |
| Windows委派夹具中间结果 | 调整脚本布局后仍3/3失败，暴露实际Claude JS入口EFTYPE；未登记为通过 | [delegation-windows.tap](../../../artifacts/pi-workspace-events/2026-10-29/delegation-windows.tap) |
| Claude入口反例 | 修复前2/2失败，包含共享发现返回的同一个npm脚本 | [claude-script-baseline.tap](../../../artifacts/pi-workspace-events/2026-10-29/claude-script-baseline.tap) |
| Claude脚本与完整普通委派链 | 最终5/5，失败/跳过0；两个启动测试和Hermes/Pi/DSH三条受控委派链；显式排除其他本机CLI候选，npm wrapper不可执行以保证原脚本直启 | [claude-delegation-final.tap](../../../artifacts/pi-workspace-events/2026-10-29/claude-delegation-final.tap)、[脚本测试](../../../desktop/tests/claude-script-launch.test.cjs) |
| 原npm shim兼容 | 原有launcher测试1/1通过，独立于上述五项 | [claude-shim-compatibility.tap](../../../artifacts/pi-workspace-events/2026-10-29/claude-shim-compatibility.tap) |
| 文档站测试 | 本次先复现5/6，再修复为6/6，所有原负向边界保持 | [修复前](../../../artifacts/pi-workspace-events/2026-10-29/docs-test-before.log)、[修复后](../../../artifacts/pi-workspace-events/2026-10-29/docs-test-fixed.log) |
| Core/renderer构建 | 通过；既有大于500KB chunk提示保留 | [build.log](../../../artifacts/pi-workspace-events/2026-10-29/build.log) |

上述测试按实际集合分别列出，不与历史全量或跨模块重复相加。

| 收尾检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 根TypeScript / lint | 通过；lint在测试器修改后重新运行 | [typecheck.log](../../../artifacts/pi-workspace-events/2026-10-29/typecheck.log)、[lint-final.log](../../../artifacts/pi-workspace-events/2026-10-29/lint-final.log) |
| 修改CJS的未使用/不可达检查 | 通过 | [cjs-lint.log](../../../artifacts/pi-workspace-events/2026-10-29/cjs-lint.log) |
| 最终用户站测试/构建 | 6/6；18页、19HTML，158份页面/搜索资源审计通过，内部页/证据导出0；既有大chunk提示保留 | [docs-test-final.log](../../../artifacts/pi-workspace-events/2026-10-29/docs-test-final.log)、[docs-build-final.log](../../../artifacts/pi-workspace-events/2026-10-29/docs-build-final.log) |
| 完整文档检查 | 退出1，279份Markdown，仍为原2243项缺失；新增0/移除0，没有伪造或删去历史证据 | [docs-after.json](../../../artifacts/pi-workspace-events/2026-10-29/docs-after.json)、[docs-delta.json](../../../artifacts/pi-workspace-events/2026-10-29/docs-delta.json) |
| 差异空白检查 | 按原文件保留CRLF/LF，以cr-at-eol识别Windows行尾后通过；未修改Git配置 | [diff-check.log](../../../artifacts/pi-workspace-events/2026-10-29/diff-check.log) |

## 复现与后续

```powershell
node --test --test-reporter=tap --test-concurrency=1 desktop/tests/pi-workspace-events.test.cjs desktop/tests/native-cli-host.test.cjs desktop/tests/native-reconcile.test.cjs desktop/tests/hermes-detach.test.cjs
node --test --test-reporter=tap --test-concurrency=1 desktop/tests/claude-script-launch.test.cjs desktop/tests/native-delegation.test.cjs
node --test desktop/tests/native-start-boundary.test.cjs
node desktop/tests/pi-session-native.cjs . artifacts/pi-session/2026-10-28/native/package artifacts/pi-workspace-events/local-recheck/native-session.json
npm run typecheck
npm run lint
npm run desktop:build
npm run docs:test
npm run docs:build
node scripts/check-docs.mjs
git -c core.whitespace=cr-at-eol diff --check
```

复现时使用新证据目录，避免覆盖本次日志；Pi组件命令需要上轮固定原包，不自动安装或改写原生环境。用户Pi页同步已发布alpha.68目录前置检查与本轮未发布事件修复的区别。整体功能、M06/M06-CC/M07/M11设计及报告、架构/数据/协议、矩阵、路线、整体测试与迭代索引一并同步。

后续仍需真实Pi生命周期/父模型、Claude实际npm安装与普通EXE、Linux/独立SSH及完整原生矩阵。alpha.68冻结包、历史926通过/74失败/1跳过和2243项历史材料缺失均不因本轮定向检查自动准出；未进行全桌面重跑、依赖升级或发布。
