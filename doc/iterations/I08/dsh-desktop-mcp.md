# DSH Desktop 原生 MCP 配置与目标绑定

日期：2026-10-22（Asia/Shanghai）。本地候选alpha.48，承接[完整推进台账](completion-audit.md)与[MCP02](mcp-open-integration.md)。公开仍alpha.46，前一本地候选alpha.47保留。只修改Bridge，不修改/构建DSH或OpenDesk，不写日常原生配置，不部署远端。

## 需求与原生依据

AB-F02/F07/F12/F13；M01-F02/F05/F15、M06-F02、M08-F02/F05、M09、M10。此前把DSH Desktop视作“应用保留Profile、无可管理路径”，未满足MCP02逐入口要求。

本轮只读核对已安装Windows DSH Desktop 2.0.18的未修改原包：

- 稳定版用户数据目录为Electron `appData/DSH Desktop`。`data-directory/state.json` version1可指定数据根；没有该记录时采用原生DSH_HOME或用户`.dsh`。Beta使用不同产品目录，不混用。
- `profile-selection/state.json` version2的`active`指定Profile；没有记录时原生默认`desktop`。Profile名称可以有中文/空格，不能沿用CLI小写名称正则误拒绝。
- 原生`prepareDesktopProfile`/`composeEntries`读取`<数据根>/profiles/<Profile>/cordis.patch.yml`用户补丁层。Profile manifest必须声明`@deepseek-ai/dsh-web-app`；不能修改安装包的`cordis.patch.yml`或原生自动生成根配置。

安装/版本与原生配置能力是不同证据。原生MCP客户端工具消费和完整原生父模型会话继续分层，不改变托管scope/小队未适配的限制。

## 实现

| 内容 | 当前实现 |
| --- | --- |
| 只读目标定位 | [dsh-desktop-config.cjs](../../../desktop/electron/dsh-desktop-config.cjs)读取有界JSON选择记录，拒绝损坏/未知版本/非法名称/符号链接/缺失或非Web Profile；已有损坏选择记录不回落到默认目录，不创建Profile |
| 原生补丁与独立授权 | [McpConfig](../../../desktop/electron/mcp-config.cjs)复用DSH用户YAML补丁的单条`agentbridge-mcp`插入、注释与其他条目保留、冲突保护。静态`nativeMcpConfig=true`仅表示Bridge适配存在，加载/连接仍独立观测 |
| 接入绑定 | [McpIntegration](../../../desktop/electron/mcp-integration.cjs)保存`nativeTarget:{home,profile}`；后台重启恢复端点不写原生配置。之后切换原生Profile或数据目录不自动改写原绑定；状态展示原路径和当前路径，旧观测失效 |
| 安装与清理 | 目标变化时安装/重新导出拒绝`MCP_NATIVE_TARGET_CHANGED`；先移除原配置再为当前目标添加。移除先撤权，只清理原绑定，即使当前选择损坏仍可清理原条目；原目录被替换为链接时拒绝沿链接清理，清理失败保留`revoked_config_pending`。新接入轮换身份，旧任务/台账不重放 |
| 并发选择 | 安装前与文件提交前复核原生目标。准备过程中切换目标导致拒绝时回滚接入登记，新身份不能得到授权，不覆盖原文件 |
| 交互与非GUI | Agent行配置同时提供MCP和已有DSH服务连接；展示绑定Profile、选择变化原因与当前配置路径。CLI同样输出核对原因；不新增模型、供应商或原生账号表单 |

持久字段只增加可选`nativeTarget`；旧导出记录首次成功安装时才补绑定，不迁移原任务或扩大关系。没有新增RPC，架构层次不变；旧远端能力仍按实际声明收窄，Windows EXE不升级远端。

## 实测与待验

证据目录：[artifacts/dsh-desktop-mcp/2026-10-22](../../../artifacts/dsh-desktop-mcp/2026-10-22/)。

| 层级 | 当前结果 |
| --- | --- |
| WSL受控契约与前端SSR | 49/49：当前/自定义数据根、中文Profile、其他Profile不变、原绑定切换/重启/清理/重新添加、准备竞态回滚、无效记录拒绝/独立导出/撤权及前端真实渲染原因；[related.tap](../../../artifacts/dsh-desktop-mcp/2026-10-22/related.tap) |
| 首轮相关回归 | 两个原断言仍要求Desktop配置能力false；根据新增实现更新能力表及CLI未命名Profile用例，未放宽真实能力断言；[related-first.tap](../../../artifacts/dsh-desktop-mcp/2026-10-22/related-first.tap) |
| 已安装Desktop原生组件 | 5组通过：真实prepareDesktopProfile/composeEntries仅组合一条Bridge补丁、原生客户端7工具及正式只读调用、生产伪造参数拒绝、外部删除/后台重启不补装、撤权/新身份/移除后的原生组合消失。最终包复验见[windows-native.json](../../../artifacts/dsh-desktop-mcp/2026-10-22/windows-native.json)，源码阶段先验见[second.json](../../../artifacts/dsh-desktop-mcp/2026-10-22/windows-native-second.json)；受控父进程、模型0 |
| Windows生产前端 | 4组通过，Edge155.0.4283.45；受控发现、真实MachineHost配置读写、生产前端交互与截图，错误0；[report.json](../../../artifacts/dsh-desktop-mcp/2026-10-22/ui/report.json) |
| 最终工程 | 桌面766/766、核心68/68；[desktop-frozen.tap](../../../artifacts/dsh-desktop-mcp/2026-10-22/desktop-frozen.tap)、[core.tap](../../../artifacts/dsh-desktop-mcp/2026-10-22/core.tap)，目标链接保护最后补入后定向20/20及冻结全量通过 |
| 类型/lint/生产构建 | 根类型/lint、根/桌面生产构建通过，修改CJS按CJS导入规则lint通过；[typecheck](../../../artifacts/dsh-desktop-mcp/2026-10-22/typecheck.log)、[lint](../../../artifacts/dsh-desktop-mcp/2026-10-22/lint.log)、[build](../../../artifacts/dsh-desktop-mcp/2026-10-22/build.log)、[CJS lint](../../../artifacts/dsh-desktop-mcp/2026-10-22/cjs-lint.log) |

首次原生验收宿主误用`@deepseek-ai/app-boot`，真实包为`@deepseek-ai/dsh-app-boot`；修正宿主后通过，未修改DSH产品。[首次失败](../../../artifacts/dsh-desktop-mcp/2026-10-22/windows-native-first.json)。第一轮全量765项中的1项旧SSR仍按Desktop不支持管理断言；改成明确模拟旧后台false，并保留其收窄保护；不是放宽新客户端测试。目录链接保护后最终全量766/766。

本片不代表完整准出。日常原生UI、原生父模型自主委派、DSH托管任务scope、独立SSH及完整MCP02/I06C/I07C继续保留未测。

## 最终本地包

Electron44.7.0、electron-builder26.15.3，WSL交叉构建，未签名。最终包核验51后台模块、84Core文件、1699Linux资源及后台/Core/ASAR/前端一致性均true；[package.json](../../../artifacts/dsh-desktop-mcp/2026-10-22/package.json)。Linux摘要`a9a5682fc6ab3df1064f28938f3798eab2ec657abd16e9543618a33c7b7d81ff`。

最终[Windows EXE](../../../desktop/release/AgentBridge-0.6.0-alpha.48-Windows-x64.exe)为130183681字节，SHA-256 `44f5d34d9ed365b2cec7c047a38045593a1ce51ac6a49949d28756c3f48740f6`；目录链接保护前首包仅作历史证据，不交付，[旧报告](../../../artifacts/dsh-desktop-mcp/2026-10-22/package-before-directory-guard.json)。公开alpha.46附件、alpha.47候选均保留。

最终普通Windows EXE隔离生命周期4组通过：启动版本正确、真实IPC/SQLite资料持久化、关闭重开复用后台、完整后台重启后原资料保持且零原请求重放，模型0；[windows-portable.json](../../../artifacts/dsh-desktop-mcp/2026-10-22/windows-portable.json)。已复制`C:\Users\jiqi\Downloads\AgentBridge-0.6.0-alpha.48-Windows-x64.exe`，完整SHA-256一致，旁边同名`.exe.sha256`；[下载副本核验](../../../artifacts/dsh-desktop-mcp/2026-10-22/download-copy.json)、[校验文件](../../../artifacts/dsh-desktop-mcp/2026-10-22/SHA256SUMS.txt)。切换时先在旧Bridge“设置→后台运行→停止后台并退出”，再打开新EXE；Windows客户端不升级SSH。DSH Desktop添加后需原生重载会话；不重放旧任务或重建已存在的原生会话。

## 收尾与后续

完整文档检查、用户站6/6及构建/发布边界审计见[docs-check.log](../../../artifacts/dsh-desktop-mcp/2026-10-22/docs-check.log)、[docs-test.log](../../../artifacts/dsh-desktop-mcp/2026-10-22/docs-test.log)、[docs-build.log](../../../artifacts/dsh-desktop-mcp/2026-10-22/docs-build.log)。修改产品源/验收脚本指纹见[sources-sha256.json](../../../artifacts/dsh-desktop-mcp/2026-10-22/sources-sha256.json)。最终包构建后无产品源修改，后续仅同步文档。

本片本地交付完成。原生父模型自主委派、日常页面人工增删/禁用、Hermes/Pi原生适配、WSL本机MCP路由、独立SSH、完整I06C/I07C/MCP02与CT-07/08等继续按[完整台账](completion-audit.md)推进，目标保持进行中。未公开推送、打标签、发布、切换日常后台或部署远端。
