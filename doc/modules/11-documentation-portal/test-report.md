# M11 文档网页测试报告

核对：2026-10-12。范围为本地桌面文档站，不运行 Agent、SSH 或模型任务。网页数据直接来自仓库 Markdown。

## 场景与证据

| 编号 | 功能 | 实际检查 | 结果 |
| --- | --- | --- | --- |
| T-M11-01 | M11-F01/F06 | `npm run docs:build` 生成静态页面和全文索引 | 通过；[构建日志](../../../artifacts/doc-site/build.log) |
| T-M11-02 | M11-F01/F02 | Windows Edge 打开首页、品牌图标、左侧目录和顶部整体设计导航 | 通过；[浏览器报告](../../../artifacts/doc-site/browser-report.json) |
| T-M11-03 | M11-F04 | 架构页 Mermaid 实际 SVG、无图表错误，深浅主题切换 | 通过；架构页实际渲染 3 张 SVG，全部 45 张图表通过解析 |
| T-M11-04 | M11-F03 | 搜索 SSH 返回真实文档结果 | 通过；见浏览器报告 |
| T-M11-05 | M11-F02/F05 | 模块测试报告直接访问、引用资源 HTTP 200 | 通过；见浏览器报告 |
| T-M11-06 | M11-F06 | 文档完整性、本地链接和工具脚本 lint | 通过；[网页检查摘要](../../../artifacts/doc-site/checks.json) |

浏览器脚本为 [windows-doc-site.cjs](../../../desktop/tests/windows-doc-site.cjs)，使用隔离 headless Edge；检查当前实际站点，不注入模拟文章。截图保存为 [浅色](../../../artifacts/doc-site/desktop-light.png)与[深色](../../../artifacts/doc-site/desktop-dark.png)。这些结果证明网页阅读功能，不作为 Agent 任务执行或新桌面 EXE 的证据。

## 复现

先在仓库根启动 `npm run docs:dev`，再在 Windows Node 执行：

```bash
node desktop/tests/windows-doc-site.cjs
```

脚本覆盖本模块浏览器报告和截图，重跑前保留需要追溯的旧版本。本轮未做手机验收，未部署公网。资料链接完整性不能代替真实浏览器渲染，因此构建和浏览器结果分别保存。
