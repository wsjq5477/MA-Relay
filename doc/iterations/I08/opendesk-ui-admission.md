# OpenDesk前端执行能力门禁修复

2026-10-22（Asia/Shanghai），关联AB-F02/F03/F08，M01-F01/F02/F05、M06-F05、M10-F01/F03。用户反馈日常机器页已出现OpenDesk Desktop，却显示“尚未支持执行”，接入按钮禁用。

## 根因与改动

日常窗口与中央后台均为alpha.42；生产快照中Desktop节点healthy/online/executionSupported均为true，connectionCapabilities.execution为true，teamCollaboration为false。此前从alpha.37切换后台已完成，但只验证后台发现，没有验证机器页的实际接入门禁。前端`connection-capabilities.ts`独立维护的原生适配器清单漏掉opendesk/opendesk-desktop，将后台明确支持的执行能力降为未知，因此两个入口的接入与会话按钮均被禁用。

本轮仅补齐前端两个稳定adapter ID，不改后台、模型/provider、OpenDesk或原生配置。未知adapter、身份来源不匹配、显式false/null仍不能执行；OpenDesk托管scope/小队与Bridge权限表单继续关闭。架构、数据模型和协议已核对，无字段、持久身份、恢复或传输契约变更。

增加遍历生产静态注册表的前端回归，逐个验证发现状态可接入、接入后可开始会话，防止将来后台注册后前端漏项。生产界面夹具使用真实注册表投影的能力，实际点击两个OpenDesk入口接入、打开会话表单并核对普通会话边界；不提交Prompt。

## 验证与证据

证据目录`artifacts/opendesk-ui-admission/2026-10-22/`。修复前回归7通过/1失败，准确命中opendesk执行被前端拒绝；修复后8/8。桌面全套722/722（失败/跳过0），根与桌面构建/类型检查通过。WSL Chromium 149.0.7827.55生产界面10组通过、页面错误0、模型0。

界面首轮因默认浏览器未安装、继而现有浏览器缺共享库失败；使用本机已有浏览器与其本地共享库目录后可运行。新增断言最初误把配置弹窗的“原生”说明套到会话表单，并假定会话表单支持Escape；依据实际界面改为核对原目标、无协作勾选并使用已有关闭按钮，未因此改动产品行为。失败证据保留。

Windows Computer Use初始化因sandboxCwd本地URI错误不可用；不将它视为已完成日常窗口操作。改用隔离profile中的包内Electron窗口验收，测试明确标注Playwright调试传输；普通无调试EXE验证另行计数，均不操作用户原任务。

Windows实际包内窗口4组通过：已安装Desktop 0.3.9健康节点显示待接入；真实点击接入后同一节点connected；可用的“开始会话”打开目标表单且托管协作关闭；新模型任务0、页面错误0。截图`windows-ui-live.png`、报告`windows-ui-live.json`，ASAR摘要与最终便携包内容一致。该窗口使用调试传输，单独标明，不能冒充普通无调试启动。

普通alpha.43便携EXE另完成4组：无调试参数启动与真实目录；生产IPC/SQLite公共资料持久化；关窗重开保留原后台/原资料；完整隔离后台重启保留资料，原生执行0。报告`windows-portable.json`中EXE字节与SHA-256和最终包一致。初次窗口验收因Playwright关闭时等待后台子进程而阻塞收尾，确认该隔离profile无任务与未决操作后，仅正常关闭其后台；调整手动验收脚本先停止自身空闲后台再等待窗口退出，最终重测4组通过、进程退出0。未强杀用户程序或重发原请求。

可复现入口：[生产界面夹具](../../../desktop/tests/ui-opendesk-configuration.cjs)、[Windows实际包内窗口](../../../desktop/tests/windows-opendesk-ui-live.cjs)、[普通EXE](../../../desktop/tests/windows-ui-redesign-portable.cjs)。Windows脚本需手动运行，使用独立profile，仅实际窗口脚本接入已安装网关，均不提交模型需求。文档工具6/6通过。50个后台CJS与alpha.42冻结摘要逐项一致，未重新运行历史核心/Windows协议/模型全套。

## 本地候选与使用

Bridge本地候选alpha.43，130079620字节，SHA-256 `9321a73e77b88abc417282241c6ac07f36e1fa9f98871db1843b58a50a7e9bdd`。包核验50 CJS/81 Core/1462 Linux，后台/ASAR/前端与冻结源码一致。只构建Bridge，未签名、未公开、未部署远端；公开基线仍alpha.36。

日常后台alpha.42已有执行支持，本修复只需关闭旧窗口并打开alpha.43 EXE，无需停止后台；原任务、会话和授权继续保留。仅关闭窗口不会升级后台，但alpha.42后台符合本次前端修复的执行合约。机器页OpenDesk Desktop应显示“已发现，待接入”，点击“接入”后出现可用的“开始会话”。不会因为换窗口而自动发需求。

本轮不重新测试真实模型、取消、MCP或SSH；先前Desktop 0.3.9两会话四轮真实输入保持[原日期与alpha.42范围](opendesk-desktop-live.md)，不计为alpha.43新模型验收。


2026-10-22 09:44日常交付：最终同hash EXE已复制至Windows下载目录并完整核验SHA-256。只读确认旧窗口已关闭后，从该EXE正常启动日常alpha.43窗口；无调试参数，实际窗口ASAR与最终冻结包摘要一致。继续使用原alpha.42后台，后台shutdown请求0；按私有计划中的原ID核对任务结果、原生绑定、机器和授权保持一致。日常Desktop节点健康、执行能力true，仍为待接入，未替用户创建会话或发送需求。证据`daily-window.json`、`daily-after-open.json`。界面显示通过同ASAR的真实隔离窗口验证，日常窗口本身未通过截图或点击重复验证。

最终收尾：文档检查227份Markdown、15组设计/报告、4748本地链接、94 Mermaid、446用例，errors0；文档工具6/6与用户站18页/19HTML/158资源审计通过，无内部材料导出。两个手动脚本语法检查、diff空白检查通过；OpenDesk仓库git状态仍干净。
