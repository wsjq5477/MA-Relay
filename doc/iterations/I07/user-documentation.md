# I07：用户网页只展示当前设计与使用说明

日期：2026-10-20。范围：M11 / AB-F18，当前工作区文档站；不改变公开alpha.34、Agent执行协议、业务数据或适配器能力。

## 用户需求

1. 用户可见网页不出现M06-F01等内部编号、问题、历史与开发过程，只展示当前设计。
2. 原生Agent目录补DSH独立章节，覆盖Windows Desktop与Linux/WSL Web。
3. 增加按原生CLI、API、MCP、ACP、插件、SDK分列的总结与选型说明。

## 原因与实现

原站点以整个doc目录为源，自动扫描模块与迭代，内部设计和报告均能导航、直链或搜索；准备脚本还复制显式引用的源码与证据。单独清理首页或删除编号无法解决发布范围。

现改为 `doc/user/` 独立用户Markdown源与明确页面清单。17篇用户页覆盖产品/系统设计、机器、任务会话、关系协作、公共材料、MCP与全部六种Agent。内部设计/报告/问题/迭代保留原位置，均不发布。

首页、原生Agent总览和选型页显示六方式总结；总览增加能力表。方式表从当前内部矩阵提取，功能表从静态注册能力生成，登记八个入口；不搬入矩阵中的验收和规划段落。

DSH单页说明CLI、Windows Desktop、Linux/WSL Web各自配置与接入，根地址/token/目标机器、API的收益与代价、新建/续聊/取消/查询/普通受委派、原生权限处理及MCP限制；如实说明服务入口尚不在公开alpha.34中。

选型页提供六种方式优缺点、可实现功能的前提、逐场景推荐和快速接入；网页不再链接开发材料。

发布准备仅复制许可品牌图，不再输出源码、日志和验收材料。构建前验证正文、链接/include与登记页面；构建后独立审计实际HTML、搜索资源和文件白名单，阻断只隐藏导航而继续公开内部正文的情况。

## 同步范围

- [M11完整设计](../../modules/11-documentation-portal/design.md)与[报告](../../modules/11-documentation-portal/test-report.md)。
- [整体功能](../../product-design.md)、[架构发布边界](../../architecture.md)、[整体验证口径](../../testing.md)、[仓库入口](../../README.md)。
- [网页维护](../../web-reading.md)、[共同开发规则](../../development-guide.md)。
- [公开首页](../../user/index.md)、[Agent总览](../../user/agents/index.md)、[DSH](../../user/agents/dsh.md)、[方式比较](../../user/integration-methods.md)。

内部M06协议和能力未变，因此不重写其验收结论。业务data-model/protocol无变更；只在architecture说明文档发布层，保留原生状态/权限语义。

## 实际验证

| 检查 | 结果 | 原始证据 |
| --- | --- | --- |
| 发布边界与元数据 | 6项Node检查通过 | [TAP](../../../artifacts/user-documentation/2026-10-20/unit-tests.tap) |
| 完整构建与输出审计 | 通过；17篇用户页＋404，155份页面/搜索资源检查，内部页/证据导出0 | [构建日志](../../../artifacts/user-documentation/2026-10-20/docs-build.txt) |
| 脚本lint | 退出0 | [lint](../../../artifacts/user-documentation/2026-10-20/lint.txt) |
| 文档结构与链接 | 通过；以所链报告为准 | [文档检查](../../../artifacts/user-documentation/2026-10-20/docs-check.json) |
| Windows Edge实际桌面网页 | 8组通过，0页面错误；包括总结表、DSH、搜索、主题/图表与5个内部路由404 | [浏览器报告](../../../artifacts/user-documentation/2026-10-20/browser-report.json) |

浏览器原始报告与截图保存在同一证据目录。前次M11报告另存[快照](../../../artifacts/user-documentation/2026-10-20/previous-m11-report.md.txt)。未调用模型、未生成新EXE、未连接SSH、未部署公网，不扩张原生接入验收范围。

Windows首次无法访问WSL预览端口，失败报告单独保留；随后将相同构建放在Windows本机静态服务，全部文件[SHA-256一致](../../../artifacts/user-documentation/2026-10-20/build-snapshot.json)，浏览器检查成功。未修改或模拟网页内容。
