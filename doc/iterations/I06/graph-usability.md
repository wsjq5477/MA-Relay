# I06B alpha.7：主节点标识、连线避让与中键平移

日期：2026-10-13。**0.6.0-alpha.7 已完成本页图优化与候选包专项验收。** 范围为 I06-UI-01/02/03，AB-F16、M01-F04/F09 与 M10-F01/F02/F03/F06；兼容资源基线同步涉及 M04/M05。稳定历史版仍为 0.5.0；I06C 与正式 0.6.0 准出尚未完成。alpha.6 的独立双向原生链证据保留原日期，本次不重新调用模型。

## 需求与验收目标

| 用户问题 | 最终行为 | 验收 |
| --- | --- | --- |
| WSL 主 Agent 向左连线似乎从左侧发出 | 主只显示右侧输出，普通/子只显示左侧输入；折线绕过卡片，箭头进入子左侧 | 同一行 WSL 主位于 Windows 子右侧，真实端点拖拽并检查所有可见线段不穿卡片 |
| 主 Agent 与子 Agent 太相似 | 皇冠、强调色徽标、粗边框与渐变背景；角色随草稿改变 | 设置/切换/放弃主角色、隐藏端点的焦点与可访问性、待移除旧边仍有锚点 |
| 无法便捷拖动全图 | 按住中键平移，覆盖空白、节点、按钮、端点和机器组 | 实际中键输入只修改视口；节点/组、缩放与授权不变；重开恢复、unknown 锁定 |

## 开发与完整行为

[图组件](../../../desktop/src/AgentGraph.tsx)增加主角色外观、隐藏无用端点、正交边与中键捕获。隐藏端点保留 DOM 几何位置，以显示切主后尚未保存移除的旧边；不接收连线和键盘焦点。主/子尺寸保持 280×132，切主不会重排已有坐标。

[路由](../../../desktop/src/graph-routing.ts)用带间距的工具卡片矩形作为障碍，先检查两侧通道与最近水平通道，再在不规则布局下使用正交网格搜索。机器背景可穿越；连线显示在背景上方。卡片重叠或端点间距过小使通道受阻时使用折线回退，不承诺重叠卡片仍完全避让。位置变化后重新计算路线，权限不变。

中键由画布捕获，阻止浏览器自动滚动及节点/端点误操作；每帧更新视口，松开、指针取消、失焦时结束，保存原布局 lane 的视口。布局 unknown/离线时保持锁定。原左键拖动、端点授权、键盘和显式保存保留。

拖动坐标时保持其他节点的数据与回调引用稳定，避免全部机器/卡片反复渲染；回调通过当前编辑器状态执行，不保留过期授权或锁定状态。

已核对 [架构](../../architecture.md)、[数据](../../data-model.md)和[协议](../../protocol.md)：本次无后台接口、数据格式、授权或原操作规则变化，仍是 protocol 2 / layout version 1。没有更改原生适配、模型、账号或远端目录。alpha.6 manifest 先与原包报告摘要核对，再收入兼容资源；新包不自动升级远端。

## 验证与原始记录

本次工程与图交互实际运行于 2026-10-13；JSON date 为 UTC。前端生产包为本次 desktop/dist，Windows Edge 154、1440×960/1366×768/1280×720；性能 CPU 为 i5-8600。根代码未改变，43/43 是 alpha.6 历史基线。

| 验证 | 实际结果与级别 | 原始证据 |
| --- | --- | --- |
| 桌面完整回归 | 116/116，通过；Node 22.23.1，受控工程/进程/socket；含 6 项路由，不重复相加 | [TAP](../../../artifacts/graph-usability/2026-10-13/desktop-tests.tap) |
| 路由几何专项 | 6/6，通过；向左、中间障碍、负坐标、复杂通道、60 节点扇出与重叠退化 | [专项 TAP](../../../artifacts/graph-usability/2026-10-13/routing-tests.tap)、[脚本](../../../desktop/tests/graph-routing.test.cjs) |
| 原图交互 | 10 组，通过；Windows 真实输入、生产中央存储、受控机器；最终生产 bundle | [UI](../../../artifacts/graph-usability/2026-10-13/ui.json)、[脚本](../../../desktop/tests/windows-i06b-graph.cjs) |
| 新图交互 | 6 组，通过；主角色/端点、WSL 同行向左、中键五区域、重开、unknown/原收据、换主锚点；最终生产 bundle | [专项](../../../artifacts/graph-usability/2026-10-13/usability.json)、[脚本](../../../desktop/tests/windows-graph-usability.cjs)、[亮色](../../../artifacts/graph-usability/2026-10-13/usability-light.png)、[暗色](../../../artifacts/graph-usability/2026-10-13/usability-dark.png) |
| 密集图性能 | 20 组/60 节点/59 条保存授权边；20 次真实 pointer→节点变换反馈 p95 37.9ms，观察期无 long task；生产 bundle，通过 | [样本与资源 SHA](../../../artifacts/graph-usability/2026-10-13/performance.json)、[脚本](../../../desktop/tests/windows-i06b-performance.cjs) |
| 类型与生产构建 | 根 TypeScript、前端 TypeScript/Vite，通过；根 lint 源码未改动，本次不重跑 | [构建](../../../artifacts/graph-usability/2026-10-13/build.log) |
| 普通 Windows EXE | 无 debug 参数；隔离 Windows/WSL profile；启动/冻结模块、正常关闭保留同后台、重开同布局 3 项通过；native prompts=0 | [报告](../../../artifacts/graph-usability/2026-10-13/portable.json)、[脚本](../../../desktop/tests/windows-i06b-portable.cjs) |
| 包资源一致性 | 27 CJS、1367 Linux 文件、窗口/前端/版本与源码一致，通过 | [报告](../../../artifacts/graph-usability/2026-10-13/package.json)、[构建](../../../artifacts/graph-usability/2026-10-13/package-build.log) |
| 文档一致性 | 整体、M01/M04/M05/M10 与迭代同步，最终结果见日志 | [检查](../../../artifacts/graph-usability/2026-10-13/docs-check.log) |

单独路由 6 项已包含在桌面 116 项内。Windows 浏览器与普通 EXE 是不同证据层；全部本轮交互未提交原生需求，不能证明 SSH 或模型回复。

## 实测修正与边界

首次界面驱动假定 WSL 默认排在右侧，实际受控目录先列 SSH；已按用户截图排列受控目录，保留 [初次记录](../../../artifacts/graph-usability/2026-10-13/usability-initial-driver.json)。补齐受控界面的主题保存接口，明确断言暗色主题后保存截图；产品主题接口保持原实现。后续修正 SVG 文字应点击背景、空白点位于屏幕外、CSS 视口小数序列化及等待布局提示稳定的驱动断言；没有降低交互要求，失败记录保留在测试目录。连线最初被机器背景遮住，增加明确图层后用真实屏幕线段验证。

密集 59 边图开发模式首轮 p95 196ms，未达到 100ms 目标；[原始样本](../../../artifacts/graph-usability/2026-10-13/performance-before-routing-fastpath.json)。通道快速检查单独未消除开发模式长尾；CPU 样本定位到全量卡片/JSX 开销，稳定数据后开发模式 p95 115.8ms，仍未达到 100ms。最终同源生产 bundle p95 37.9ms，通过；[开发模式样本](../../../artifacts/graph-usability/2026-10-13/performance-card-memo-development.json)。开发模式与生产性能分开，不把更换测量环境伪装为同环境数值提升。CPU 样本仅为受控图性能定位，不包含原生任务。

本次无新 SSH 登录/安装、原生模型需求、权限表单或取消专项；alpha.6 的真实原生证据不能当作 alpha.7 重跑。完整恢复、连接编辑/移除、升级/回滚与正式发布继续归 I06C。

## 当前发布物

[AgentBridge-0.6.0-alpha.7-Windows-x64.exe](../../../desktop/release/AgentBridge-0.6.0-alpha.7-Windows-x64.exe)，129,577,514 字节，SHA-256 `d4c550aa1bf0e3baf39b37da4aa054f6e60b3c46567997d1c8209fb2a76092f2`。27 个后台 CJS、1367 个 Linux 文件、app.asar/前端/版本一致，包完整性通过：[报告](../../../artifacts/graph-usability/2026-10-13/package.json)、[构建](../../../artifacts/graph-usability/2026-10-13/package-build.log)。Linux manifestDigest `12160b83b493356f54633b972e0d2f3e73cc4b012a73b72229a3b76261322ca4`。

当前兼容清单为 alpha.2–alpha.6，新包不自动升级原远端。打开新 EXE 使用新前端；若旧中央仍运行，从新窗口“设置 → 后台运行 → 停止后台并退出”，再打开新 EXE 以启动当前后台版本。保留已有机器、节点、授权与历史。

## 复现与测试清理

Linux 工程入口：`npm test --prefix desktop`、`npm run desktop:build`、`node scripts/check-docs.mjs`。生产前端在 desktop 目录用 `npm exec -- vite preview --host 127.0.0.1 --port 4218` 启动。Windows Node 分别执行上述三个 Windows 图脚本并传入该 URL；用 `AGENTBRIDGE_GRAPH_REPORT_DIR` 指定独立报告目录，缺省按当前版本隔离。普通 EXE 脚本用 `AGENTBRIDGE_PORTABLE_REPORT` 指定报告；缺省同样按版本隔离，避免覆盖 alpha.6 历史。

受控浏览器和 fixture 已关闭；普通 EXE 驱动正常关闭所属测试窗口并 shutdown 所属隔离中央，不停止用户原后台。测试用前端服务在验收后停止。

## 后续 alpha.8 旧后台兼容

用户原 profile 仍运行 alpha.5，缺少图布局接口；本页 alpha.7 的新后台浏览器交互和普通 EXE 生命周期未覆盖该混用。已在真实 alpha.7 Electron 复现，并由 alpha.8 修复，最新证据见 [拖动专项](graph-drag-fix.md)。本页历史结果保持原范围。
