# I08-MCP02：恢复、状态观测与非GUI首次接入修复

日期：2026-10-22；本地候选alpha.46。承接[开放MCP开发记录](mcp-open-integration.md)，公开预发布仍为alpha.36；只修改Bridge，不修改或构建OpenDesk/DSH。工作区既有增量保留，本轮没有提交、推送、发版或升级SSH daemon。

## 需求与实现

关联AB-F02/F07/F08/F11/F12/F13及M01/M02/M06/M08/M09/M10。实现MCP02的可恢复接入与可核对状态，不将本轮通过推定为十入口全部准出。

| 问题 | 当前行为与源码 |
| --- | --- |
| OpenDesk原生条目使用Node，但导出片段还使用Electron，重启还可能改变启动器 | [MCP集成](../../../desktop/electron/mcp-integration.cjs)在渲染所有片段前选择启动器，保存`launcherPath`；后台恢复沿用原命令，不重写原生文件，显式添加/导出时才重新选择 |
| OpenCode数组形式的command未进入工具探测 | 同一模块按数组首项和剩余参数启动，实际stdio初始化及工具目录回归通过 |
| 原生配置删除、修改、profile变化或探测过期后仍显示旧连接/工具可用 | 探测绑定配置路径、配置原文与连接配置的SHA-256；配置变化立即失效，连接/工具观测60秒有效。`status.evidence.observation`返回时间、current/stale/unknown和原因；[前端](../../../desktop/src/McpSettings.tsx)与CLI展示时间和重新探测提示。补丁层“需重新加载”提示在配置未变时保留，不作为活连接证据 |
| 非GUI首次接入只能指定未连接节点，不能完成MCP导出 | [CLI](../../../src/mcp-command.ts)新增`mcp nodes`、`mcp attach`及`mcp operation`。首次接入显式传稳定`--operation-id`，复用`manageNode`/`nodeOperation`；未知/丢回应只查原操作，不重放接入。默认目录改为与桌面一致的`agentbridge-desktop`，支持同一环境覆盖；从打包manifest读取真实版本并携带离线包路径 |
| Linux本机重启只恢复状态记录，端点未恢复 | [协调器](../../../desktop/electron/coordinator-service.cjs)等待MCP端点恢复，再处理调用；恢复不补装用户删除的原生条目，失败不能当成成功 |
| JSON输出将授权事实也当作凭据隐藏 | 仅保留`authorization`的valid/revoked/unknown枚举，其余凭据类键仍脱敏；Windows首轮暴露该失败，修复后定向回归通过 |

所有权冲突继续拒绝：此前OpenDesk诊断条目未登记为Bridge所有，直接添加会报`MCP_CONFIG_CONFLICT`。已更正文档“可直接覆盖同id”的错误说明；应先由用户在原生管理页核实并移除诊断条目，再添加正式连接，不能自动认领或覆盖。

## 工程验证

环境：WSL/Linux，Node22.23.1；临时目录、受控原生程序、真实本地端口与子进程，模型0。原始文件均位于[证据目录](../../../artifacts/mcp-open-recovery/2026-10-22/)。

| 检查 | 实际结果与证据 |
| --- | --- |
| 修复前反例 | 3项新回归失败、22项既有用例通过，[before.tap](../../../artifacts/mcp-open-recovery/2026-10-22/before.tap) |
| 最终桌面全量 | 758/758通过，83.1秒，[desktop.tap](../../../artifacts/mcp-open-recovery/2026-10-22/desktop.tap)；含生成OpenDesk stdio条目→初始化→7工具→按连接身份调用→撤权后原客户端被拒绝，以及Linux本机恢复端点、原生删除不补装、配置/profile变化/过期及SSR展示 |
| 根全量 | 68/68通过，167.1秒，[core.tap](../../../artifacts/mcp-open-recovery/2026-10-22/core.tap)；JSON修复后再跑CLI相关11/11，[cli.tap](../../../artifacts/mcp-open-recovery/2026-10-22/cli.tap) |
| 类型/lint/构建 | 根typecheck、lint、根与桌面构建通过，[类型](../../../artifacts/mcp-open-recovery/2026-10-22/typecheck.log)、[lint](../../../artifacts/mcp-open-recovery/2026-10-22/lint.log)、[构建](../../../artifacts/mcp-open-recovery/2026-10-22/build.log)；最终JSON修复后重建[核心](../../../artifacts/mcp-open-recovery/2026-10-22/core-build.log) |

共享计数不跨模块相加。根全量完成后仅修改JSON脱敏及其既有用例断言，因此再次运行相关CLI与类型/lint/核心构建；桌面运行代码未再改变。

## Windows与候选交付

实际Windows运行（2026-10-22，Windows Electron44.7.0作Node、Edge155.0.4283.45）：全部使用临时profile和受控/隔离原生配置，模型0，不更换日常后台，不写OpenDesk原生配置。首次浏览器夹具漏放desktop/package.json，补齐元数据后运行通过；未改产品代码。

| 验收层级 | 实际结果 |
| --- | --- |
| 生产非GUI CLI与真实Coordinator | 5组通过：[windows-headless.json](../../../artifacts/mcp-open-recovery/2026-10-22/windows-headless.json)。无窗口冷启动真实版本后台、发现已安装Claude、显式接入/查询同一操作、安装导出→stdio初始化/7工具/真实授权list_agents、外部删除后事实失效且不补装、撤权后原客户端立即拒绝。原生配置目录隔离，不是原生模型会话或OpenDesk原生UI验收 |
| Windows生产前端 | 5组通过：[windows-ui.json](../../../artifacts/mcp-open-recovery/2026-10-22/windows-ui.json)。Edge真实渲染、受控机器和真实隔离配置；添加/导出、过期观测时间与未知状态、冲突保留/先撤权后清理、重新添加及移除。控制台错误0 |
| 最终普通EXE | 4组通过：[windows-portable.json](../../../artifacts/mcp-open-recovery/2026-10-22/windows-portable.json)。无调试参数的最终便携EXE启动；真实IPC/SQLite公共资料持久化；正常关闭重开复用后台；正常关闭后台后重开保留资料，原生请求列表未重放。观察到16项原生历史，仅只读，不算新执行 |

首轮非GUI生产链到达真实授权list_agents后，授权事实被脱敏的断言失败，原始失败见[windows-headless-before.json](../../../artifacts/mcp-open-recovery/2026-10-22/windows-headless-before.json)。修复后相关CLI11/11及最终Windows全链通过。首次打包已过核验但尚未包含JSON修复，保留[旧包证据](../../../artifacts/mcp-open-recovery/2026-10-22/package-before-json-fix.json)；交付只使用重建后的最终包。

| 最终交付 | 核验 |
| --- | --- |
| 文件 | `desktop/release/AgentBridge-0.6.0-alpha.46-Windows-x64.exe`，130180760字节 |
| SHA-256 | `57f1af73f761af72d75121284b023a001dad05eb30c0c197e18851cc9a7e8c48`；[校验文件](../../../artifacts/mcp-open-recovery/2026-10-22/SHA256SUMS.txt) |
| 包源码核验 | [package.json](../../../artifacts/mcp-open-recovery/2026-10-22/package.json)：50后台模块、84核心文件、1698Linux文件，coreBuildMatches/linuxBackendMatches/appAsarSourceMatches/frontendMatches均true；Linux摘要`4722efad31cf45a26e7e15d98f7abe58ccfa673c139c22fcca57e6553e733c8f` |
| Windows副本 | `C:\Users\jiqi\Downloads\AgentBridge-0.6.0-alpha.46-Windows-x64.exe`，复制后完整SHA-256相同 |
| 使用 | 原任务及管理操作均确认终态后，在旧Bridge的“设置→后台运行→停止后台并退出”，再打开新EXE；保留同一日常profile，不重发原任务。OpenDesk诊断条目需先在原生管理页核实并移除，才能添加正式连接 |
| 状态 | 本地候选，未签名、未公开、未打标签、未升级SSH daemon。MCP02-T16的本地普通EXE重开/后台重启证据补齐，不能代替独立SSH或逐入口真实原生客户端验收 |

文档检查通过（229份MD、15对模块设计/报告、95个Mermaid图），用户站测试6/6、构建与发布边界审计通过（18用户页、19HTML、0内部页/证据导出）；[文档检查](../../../artifacts/mcp-open-recovery/2026-10-22/docs-check.log)、[站点测试](../../../artifacts/mcp-open-recovery/2026-10-22/docs-test.log)、[站点构建](../../../artifacts/mcp-open-recovery/2026-10-22/docs-build.log)。

## 尚未准出的范围

OpenDesk Desktop0.3.9历史原生列表可见7工具使用诊断授权，不能算正式授权后的真实原生会话调用。此次生成配置的真实stdio工具调用属于Bridge端点链证据，不是原生模型委派。真实OpenDesk/DSH主Agent委派、托管scope注入、小队、原生界面人工增删/禁用与十入口逐项验收仍未完成；OpenDesk CLI0.3.8无MCP管理面仍只能导出；DSH Desktop、Hermes/Pi原生配置适配仍未完成。未知原任务保持原ID与占位，不取消、不重发。

## 后续原生组件验收

同日新增[原生组件与真实子任务验收](mcp-native-acceptance.md)：OpenDesk正式原生组件协议5组、DSH6组、两条生产协作链各1个真实Claude任务成功、两次观察器重开无重放。上节未测项属于本次交付当时记录，后续已补的是原生组件层，原生父模型自主调用及日常原生页面仍未验；产品代码和alpha.46 EXE未变。
