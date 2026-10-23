# OpenDesk MCP 默认字段兼容与 alpha.47 本地候选

日期：2026-10-22（Asia/Shanghai）。承接 [MCP02](mcp-open-integration.md) 和 [日常原生查询现场](opendesk-mcp-diagnostic-repair.md)。当前公开版本保持 **alpha.46**（标签 `9766eb4`）；本轮只修改 Bridge，构建本地 **alpha.47**，未推送、打标签、公开发布、替换日常后台或部署 SSH。

## 需求与根因

AB-F07/F12/F13；M06-F02、M08-F02/F05、M10-F01/F02/F03/F06。OpenDesk Desktop 0.3.9 的原生 MCP 配置解析器会给 STDIO 条目补入 `headers:{}`。原 alpha.46 使用整条严格比较，将正常原生保存误报为外部修改；重复添加被拒，移除虽然先撤权，但清理误报冲突。现场原生工具调用成功不能消除这个管理缺陷。

## 实现与边界

- [McpConfig](../../../desktop/electron/mcp-config.cjs) 提供适配器范围内的归属比较：仅 OpenDesk STDIO 的空对象 `headers` 与字段缺省等价，双向兼容旧登记，不修改旧快照或猜测归属。
- [McpIntegration](../../../desktop/electron/mcp-integration.cjs) 的状态和安装复用此比较，配置更新/清理采用相同规则。已有效接入重复添加保留连接身份与原生文件字节；撤销后重新添加仍轮换身份。
- 非空或错误类型的 `headers`、命令/参数/环境/启用状态/传输/工作目录/名称及未知字段变化仍保留冲突；未登记条目不能借此被认领。其他适配器保持严格比较。
- 探测仍绑定配置原文与原连接；默认字段变化也会使旧观测失效，不能因归属兼容就显示连接/工具已验证。移除仍先撤权，清理失败不恢复授权；原请求、Session、unknown 占位与委派台账不变。

没有新增 RPC、权限、持久字段、数据库迁移或架构路径。已核对 architecture；data-model/protocol 同步归属规则，M06/OpenDesk/M08/M10、整体功能与用户说明同步。

## 实际验证

环境：WSL/Linux Node 22.23.1，Windows 验收使用已安装 OpenDesk Desktop 0.3.9 的未修改原包、临时配置目录、Bridge 最终候选资源。全部模型 0；不操作日常原生配置。证据统一位于 [本轮目录](../../../artifacts/opendesk-mcp-defaults/2026-10-22/)。

| 检查 | 结果与证据 |
| --- | --- |
| 修复前复现 | 新增两项回归，1失败/1通过：空默认值误报冲突；[before.tap](../../../artifacts/opendesk-mcp-defaults/2026-10-22/before.tap)。首次受限环境未正常运行测试，调整为允许本机子进程/端口的执行环境后才取得该产品反例 |
| Windows旧包反例 | 同一原生schema检查对冻结alpha.46后台资源复现归属断言失败，非模型错误；[windows-native-before.json](../../../artifacts/opendesk-mcp-defaults/2026-10-22/windows-native-before.json) |
| MCP 定向 | 44/44，含默认值双向兼容、重启、同身份重复添加、撤权/清理、12类外部修改保留、其他适配器严格比较及观测失效；[targeted.tap](../../../artifacts/opendesk-mcp-defaults/2026-10-22/targeted.tap)；最终两项回归同时包含在全量中 |
| 桌面全量 | 760/760，失败/跳过0；[desktop.tap](../../../artifacts/opendesk-mcp-defaults/2026-10-22/desktop.tap) |
| 核心全量 | 68/68，失败/跳过0；[core.tap](../../../artifacts/opendesk-mcp-defaults/2026-10-22/core.tap) |
| 类型/lint/构建 | 根类型与 lint、根/桌面生产构建通过；[typecheck.log](../../../artifacts/opendesk-mcp-defaults/2026-10-22/typecheck.log)、[lint.log](../../../artifacts/opendesk-mcp-defaults/2026-10-22/lint.log)、[build.log](../../../artifacts/opendesk-mcp-defaults/2026-10-22/build.log)。保留前端大于500KB既有提示 |
| Windows 原生组件 | **7组通过**：真实原生 schema 补默认值、重复添加保留身份及原生字节、原 MCP worker 连接/7工具/正式只读调用、后台恢复不补装、撤权/重装及移除后旧客户端拒绝与工具清空；[windows-native.json](../../../artifacts/opendesk-mcp-defaults/2026-10-22/windows-native.json)。受控父进程，不是原生 UI 或自主父模型验收 |
| 普通 Windows EXE | **4组通过**：最终无调试参数EXE启动并核对版本，真实IPC/SQLite资料持久化，关闭重开复用原后台，完整后台重启后原资料保持且无请求重放；[windows-portable.json](../../../artifacts/opendesk-mcp-defaults/2026-10-22/windows-portable.json)；隔离profile、模型0 |

计数跨模块不累加。原生组件由受控父进程加载，不能当作日常原生页面或原生父模型自主委派成功。复现脚本：[原生组件](../../../desktop/tests/windows-opendesk-native-mcp.cjs)（第五参数可指定候选版本）、[普通 EXE](../../../desktop/tests/windows-portable-mcp-defaults.cjs)（EXE 路径、版本、报告路径，`AGENTBRIDGE_VERIFY_BRIDGE` 指向最终资源的 `bridge`）。

Windows宿主准备首次 `Copy-Item` 无法复制Linux `.bin` 符号链接；改为排除命令链接的资源复制。随后继承的跨WSL `PATH/PATHEXT` 不适用Windows可执行文件，恢复子进程自身的Windows环境后执行；没有更改系统环境变量或产品代码。[复制失败](../../../artifacts/opendesk-mcp-defaults/2026-10-22/windows-stage-before.log)、[PATH失败](../../../artifacts/opendesk-mcp-defaults/2026-10-22/windows-path-before.log)、[可执行后缀失败](../../../artifacts/opendesk-mcp-defaults/2026-10-22/windows-executable-before.log)。额外尝试根TS ESLint配置直接检查CJS时命中既有require/历史测试规则；正式根lint通过，修改的生产CJS与新增便携脚本按CJS导入规则检查通过，验收脚本语法检查通过；[CJS检查](../../../artifacts/opendesk-mcp-defaults/2026-10-22/desktop-lint.log)。

## 本地交付

`desktop/package.json` 与 lock 版本同步 alpha.47，根版本仍 0.1.0。WSL 交叉构建，Electron 44.7.0、electron-builder 26.15.3，未签名。

| 项目 | 结果 |
| --- | --- |
| Windows EXE | [AgentBridge-0.6.0-alpha.47-Windows-x64.exe](../../../desktop/release/AgentBridge-0.6.0-alpha.47-Windows-x64.exe)，130179147字节 |
| SHA-256 | `281cfc14d4ea48c95408b32f0177037f6a79130ac6eac585651159b2730bff45` |
| Windows副本 | `C:\Users\jiqi\Downloads\AgentBridge-0.6.0-alpha.47-Windows-x64.exe`，复制后完整SHA-256一致；旁边同名`.exe.sha256`，另存[校验文件](../../../artifacts/opendesk-mcp-defaults/2026-10-22/SHA256SUMS.txt) |
| 包源码核验 | 50后台模块、84核心文件、1698Linux文件，Windows/Linux后台、Core、ASAR/前端一致性均true；[package.json](../../../artifacts/opendesk-mcp-defaults/2026-10-22/package.json) |
| Linux 清单摘要 | `d40659e1db0c6f74e34f7858efc0681c837496fd7eeab12ea9dc8b8f0d1e7489` |
| 状态 | 本地候选；未签名、未公开、未部署远端。旧 EXE、alpha.46 标签与公开附件保持 |

切换前在旧 Bridge“设置 → 后台运行 → 停止后台并退出”，再打开新 EXE；OpenDesk 写入/移除前仍从托盘完全退出，防止旧内存配置写回。无需为该默认值差异重建正式 MCP 授权，也不重发旧任务。Windows EXE 不自动升级 SSH daemon。

## 后续优先项

1. 原生父模型自主委派与日常原生页面的增删/禁用/重开；已有原生只读发现和组件真实子任务证据分别保留，不提升层级。
2. DSH Desktop、Hermes/Pi 原生 MCP 配置适配，以及 Hermes/Pi/DSH 真实直接执行/被委派的未覆盖场景。
3. 独立 SSH、完整故障/停止矩阵与 I06C/I07C/MCP02 准出；CT-08 多主关系仍为后续设计范围。

本片仅关闭 OpenDesk 默认字段管理兼容缺口，不改变完整准出结论。

## 文档收尾

用户站测试6/6、构建及发布边界审计通过：18用户页、19HTML、0内部页/证据导出；[测试](../../../artifacts/opendesk-mcp-defaults/2026-10-22/docs-test.log)、[构建](../../../artifacts/opendesk-mcp-defaults/2026-10-22/docs-build.log)。完整文档检查及修改文件指纹见[docs-check.log](../../../artifacts/opendesk-mcp-defaults/2026-10-22/docs-check.log)与[sources-sha256.json](../../../artifacts/opendesk-mcp-defaults/2026-10-22/sources-sha256.json)。最终产品源在构建与Windows验收后未再修改，后续仅同步文档。
