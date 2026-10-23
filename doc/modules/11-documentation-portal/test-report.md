# M11 文档网页测试报告

T-M11-201 / M11-F01/F05：2026-10-23，alpha.52用户说明同步，docs:test 6/6、静态18页/19HTML构建与边界审计通过，内部页和证据导出均0。说明以当前原生能力为准，不增加原生/模型验收；[记录](../../iterations/I08/opendesk-lifecycle-relation-scope.md)。

2026-10-23 / alpha.50本地候选：共享桌面794/794、核心68/68，工程与最终包核验通过；Pi原生Linux/Windows各5组、Hermes固定官方源码原生组件5组、Windows生产前端5组/普通EXE4组通过，模型0。原生阶段/受控发现、首次YAML与验收脚本/受限socket失败分别保留；真实自主父模型、Hermes正式安装版/Windows原生、独立SSH及完整矩阵未准出。共享计数不相加。 [最终实现、原始证据与范围](../../iterations/I08/hermes-mcp-config.md)。

2026-10-23 / WSL Node22.23.1：首轮用户站5/6，旧断言要求DSH Desktop MCP方式为未接入，发现DSH Web/CLI汇总也落后于当前配置实现；修正汇总与明确断言后复验6/6，构建18页/19 HTML、内部页与证据导出均0；结果及原始失败见专项。产品EXE未改变，不重复计算模型或前端验收。 [本轮证据](../../iterations/I08/wsl-host-readiness.md)。

## 后续原生组件验收（2026-10-22，alpha.46）

已安装OpenDesk/DSH原生MCP组件协议分别5组/6组通过；两条生产协作链各完成1个真实Claude子任务，并分别只读重开原任务/Session/结果，无重放。原生父模型自主决策与日常原生页面未验；产品运行代码与EXE未变，不把新增验收与原全量计数叠加。[脚本、初次失败、准确层级和未测项](../../iterations/I08/mcp-native-acceptance.md)。

## MCP02当前使用说明同步（2026-10-22）

补齐非GUI首次接入/原操作查询、同profile、60秒观测有效期和OpenDesk同名诊断条目冲突处理；更新当前alpha.46候选与真实验证边界。用户站测试6/6、构建/边界审计通过；内部专项与证据不发布。[本轮交付](../../iterations/I08/mcp-open-recovery.md)。

OpenDesk相关验证统一见[专项报告](../../iterations/I08/opendesk-existing-interfaces.md)，明确受控协议、真实原生启动、模型和Windows包的独立范围；共享计数不跨模块累加，未执行项保持未测。

## alpha.36整合边界

2026-10-21 / WSL Node22.23.1：本轮全量核心57/57、桌面676/676，类型/lint/前端构建通过。各模块共享计数不相加；包核验、Windows契约144/144、界面26组与普通EXE7组通过，具体以专项为准，真实模型/用户profile/独立SSH未验。[完整交付](../../iterations/I07/alpha36-delivery.md)。

## 子任务上下文用户说明

T-M11-11 / M11-F01/F05：2026-10-21，WSL Node22.23.1。用户协作页说明新子任务的角色/结果交回、不增加权限及历史输入保持、超限不截断。网页源/发布边界6/6通过，[原始日志](../../../artifacts/delegation-context/2026-10-21/docs-site-test.log)与[本轮证据](../../iterations/I07/delegation-context.md)记录范围，本片未重建静态站点或重做浏览器/EXE，不把说明同步当作原生消费验收。

## Agent 配置文案同步

M11-F01/F05；2026-10-21，WSL Node22.23.1。用户机器/MCP/DSH及各原生Agent页同步当前入口；网页边界、文档检查的实际日志统一见[专项](../../iterations/I07/agent-row-configuration.md)。没有用历史网页/EXE验收替代本轮运行。

## 当前连接视图说明同步

T-M11-10 / M11-F01/F05：2026-10-21，WSL Node22.23.1。用户协作页说明当前角色、获准连接与目标在线/空闲的区别，unknown只读及通道错误不等于空关系。网页源/发布边界6/6通过，[日志](../../../artifacts/agent-connections/2026-10-21/docs-site-test.log)；本片没有重建静态站点、重做浏览器或EXE验收。[行为、源码及产品验证范围](../../iterations/I07/agent-connections.md)。

## 管理恢复与DSH用户说明同步

M11-F01/F05；2026-10-20，WSL Node22.23.1。机器/DSH公开页同步当前操作说明；网页源与发布边界测试6/6通过，[日志](../../../artifacts/agent-recovery/2026-10-20/docs-site-test.log)。文档检查与完整产品/候选证据见[专项](../../iterations/I07/agent-management-recovery.md)。未单独重新构建静态站点，不把文档测试当成真实Agent验收。

## 只读委派列表说明同步

T-M11-09 / M11-F01/F05：2026-10-20，WSL Node22.23.1。用户关系与协作页补充按原父任务/独立连接分页查找、台账非实时和未知原请求不重发的说明。网页源与发布边界受控测试6/6通过，[原始日志](../../../artifacts/delegation-list/2026-10-20/docs-site-test.log)；没有在本片重建静态站点、重做浏览器或EXE验收。最新公开元数据为alpha.35，本片列表未发布，旧段落的alpha.34为此前网站验收时产品基线。[实现与完整范围](../../iterations/I07/delegation-list.md)。

核对日期：2026-10-20。源码：当前工作区，公开产品基线仍为0.6.0-alpha.34，本轮只改变文档网站与发布边界。环境：WSL Ubuntu、Node22.23.1、VitePress2.0.0-alpha.20；桌面浏览器使用Windows Edge。无模型、原生Agent、EXE或SSH执行。

## 当前场景与证据

| 编号 | 功能 | 场景 | 实际结果与证据 |
| --- | --- | --- | --- |
| T-M11-01 | M11-F01/F06 | 用户Markdown完整构建与独立发布审计 | 通过；17篇用户页、404页、155份HTML/JS/JSON审计；[构建日志](../../../artifacts/user-documentation/2026-10-20/docs-build.txt) |
| T-M11-02 | M11-F01/F02 | 首页方式总结、六Agent目录、DSH独立页 | 通过；见[浏览器报告](../../../artifacts/user-documentation/2026-10-20/browser-report.json) |
| T-M11-03 | M11-F04 | 系统设计真实Mermaid SVG、深色主题与章节导航 | 通过；见[浏览器报告](../../../artifacts/user-documentation/2026-10-20/browser-report.json) |
| T-M11-04 | M11-F03 | 搜索DSH有用户结果；内部功能编号无结果 | 通过；见[浏览器报告](../../../artifacts/user-documentation/2026-10-20/browser-report.json) |
| T-M11-05 | M11-F02/F05 | 内部模块、报告、迭代、矩阵与原资源路径不发布 | 构建审计通过；五个实际HTTP路径均404；见[浏览器报告](../../../artifacts/user-documentation/2026-10-20/browser-report.json) |
| T-M11-06 | M11-F01/F06 | 完整文档链接与脚本lint | 通过；见[文档检查](../../../artifacts/user-documentation/2026-10-20/docs-check.json)与[lint](../../../artifacts/user-documentation/2026-10-20/lint.txt) |
| T-M11-07 | M11-F02/F05/F06 | 公开源白名单、内部正文/链接/include、绕过形式、输出与搜索资源拒绝 | 6项Node测试通过；[原始TAP](../../../artifacts/user-documentation/2026-10-20/unit-tests.tap) |
| T-M11-08 | M11-F01/F02 | 六方式/功能表与八入口元数据同步、DSH三入口/API原因与版本限制 | Node测试与构建通过；浏览器检查通过；见[报告](../../../artifacts/user-documentation/2026-10-20/browser-report.json) |

前次报告只证明当时全仓库资料站的范围，已保留为[原报告快照](../../../artifacts/user-documentation/2026-10-20/previous-m11-report.md.txt)，不作为本轮公开边界的通过证据。

## 复现与限制

```bash
node scripts/check-docs.mjs
node scripts/prepare-doc-site.mjs
node tests/doc-site.test.mjs
npm run docs:build
```

启动本地站点后，用Windows Node执行 [浏览器脚本](../../../desktop/tests/windows-doc-site.cjs)，可用首个参数指定URL、第二个指定新的证据目录，避免覆盖旧报告。该脚本在真实构建上验证8组场景，全部通过。WSL预览端口在Windows首次不可达（[首次结果](../../../artifacts/user-documentation/2026-10-20/browser-first-attempt.json)），随后用Windows本机静态服务提供相同构建，不修改页面或模拟内容，[全部文件摘要一致](../../../artifacts/user-documentation/2026-10-20/build-snapshot.json)；构建审计独立扫描所有页面和搜索资源，不依赖只隐藏导航。

截图：[首页](../../../artifacts/user-documentation/2026-10-20/home-light.png)、[DSH](../../../artifacts/user-documentation/2026-10-20/dsh-light.png)、[系统设计深色](../../../artifacts/user-documentation/2026-10-20/architecture-dark.png)。

这些结果仅证明本地桌面网页，不证明原生Agent功能、新EXE、真实模型或独立SSH；本轮未部署公网、未做手机专项。VitePress/Mermaid保持原有锁定版本，构建仍提示既有大分块警告。
