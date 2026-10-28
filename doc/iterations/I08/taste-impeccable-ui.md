# I08 Taste与Impeccable工作台精修

日期：2026-10-28（Asia/Hong_Kong）。基于master `c40f45e`及工作树；验证时本地package为alpha.68，公开仍为alpha.67。本片更新桌面源码、字体资源与生产前端，未打包/发布新EXE，不修改其他正在进行的原生适配或版本准备。

## 需求与工具来源

用户要求实际使用两个开源项目继续改善界面。关联AB-F01/09/16、M01-F01/F03/F06/F09/F14、M10-F01/F03，界面验收项T-M01-202。

| 工具 | 固定来源 | 实际使用 |
| --- | --- | --- |
| Taste Skill | [12af471f627f866411b4bd785b19646d3672784c](https://github.com/Leonxlnx/taste-skill/tree/12af471f627f866411b4bd785b19646d3672784c/skills/taste-skill) | app-screens规范、devtools方向抽取、静态lint及真实浏览器inspect |
| Impeccable | [3e3a9179e01a60265000ce239c0a99803ec1e60d](https://github.com/pbakaus/impeccable/tree/3e3a9179e01a60265000ce239c0a99803ec1e60d/.agents/skills/impeccable) | skill4.8.0、校验摘要后的engine0.1.18；context、distill/polish/operate/craft-floor规范及最终机械detect |

两套技能通过skill-installer安装至本机技能目录，未加入应用运行时依赖或项目自动hooks。GitHub连接器不可达后从公开仓库读取固定版本；Impeccable context只执行一次，其默认PRODUCT.md/DESIGN.md路径未识别本仓库已有资料，因此按其“已有代码的局部精修可继续”规则，使用doc整体与M01设计作依据，不新增根目录设计副本。

## 设计与实现

首屏的主要问题是“现在有哪些机器和原生Agent可配置或检查”。Taste为devtools给出achromatic-ledger与framed-sheet两项，选择后者，seed为20261028，无重抽。理由：本产品长期使用机器范围与关系画布，适合统一框架中的工作面板。产品辨识来自已有Workflow品牌图和Windows/SSH/WSL原生工具分组、WSL宿主标识；不新增虚构图表或数字。

| 目标 | 最终实现 |
| --- | --- |
| 减少装饰与重复 | 浅灰蓝侧栏/顶栏、白色面板与中性深色主题；移除标题英文标签、彩色统计图标和静态卡片阴影；导航仅保留执行审计原数量 |
| 优先读取工具 | 四项原统计成为数字栏；搜索清除旧label边距；宽窗口安装位置折叠入口并入信息右侧，展开路径跨行；真实状态、能力和错误保留 |
| 连贯的排版 | 本地IBM Plex Sans，路径/ID/代码使用IBM Plex Mono；中文系统回退；22px标题、14px正文、13px常用标签与操作 |
| 设置与审计 | 设置按左说明/右操作逐段对齐；任务原四列、会话原选择和阅读、弹窗焦点及原权限门禁保持 |
| 布局与尺寸 | 228px侧栏、48px顶栏、面板右/底8px留边、16px面板圆角；保留原70px图标轨和桌面窗口行为，窄预览压缩统计与控制栏 |

落点：[AppShell](../../../desktop/src/AppShell.tsx)、[NetworkApp](../../../desktop/src/NetworkApp.tsx)、[WorkspacePages](../../../desktop/src/WorkspacePages.tsx)、[TeamWorkspace](../../../desktop/src/TeamWorkspace.tsx)、[共享样式](../../../desktop/src/workbench.css)、[页内样式](../../../desktop/src/workspace-pages.css)。[预览服务](../../../desktop/scripts/preview-ui.cjs)补WOFF2 MIME；[界面检查器](../../../desktop/scripts/check-workbench-design.cjs)按实际祖先背景合成计算透明统计栏的文字对比度，检查字体加载及外部请求。

架构/数据/协议已核对：NetworkApp、preload、Coordinator与原生工具归属保持；未增加RPC、状态字段、模型层或持久版本。Task/Session、原ID恢复、unknown占位、授权与图草稿不变；节点仍为280×132外部几何。没有把确认收据变成业务成功或取消。现有用户说明的页面/操作名称继续适用。

## 字体与离线资源

IBM Plex Sans拉丁可变WOFF2为45712字节，SHA-256 `e2291e842cf5af167122a22881a740c7f2dda7716f1e8cd76680264f4a859470`；Mono拉丁400为14708字节，SHA-256 `08949f728dc52d528e69b1667d15c89a5686a4ee9a296ff90983985f99c380f7`。共60420字节，置于desktop/assets/fonts，附[OFL许可](../../../desktop/assets/fonts/OFL-IBM-Plex.txt)。[下载来源清单](../../../artifacts/taste-impeccable/2026-10-28/sources/font-manifest.json)保留实际Google Fonts分发URL。

字体经CSS相对路径由Vite生成本地资源；没有运行时Google Fonts请求。两个产出逐字节摘要匹配，见[字体产出核对](../../../artifacts/taste-impeccable/2026-10-28/font-output.json)。现有verify-package遍历dist/assets全部资源，打包files含dist与assets；本片未据此声称实际新EXE/ASAR已验。

## 实际验证

Windows Node24.12.0、Edge157.0.4341.16，生产前端、一次性受控Coordinator和合成历史；真实Agent/模型调用0，日常profile与原生账号配置未参与。

| 检查 | 实际结果 | 原始证据 |
| --- | --- | --- |
| TypeScript/Vite | 通过；大于500KB chunk原提示保留 | [最终构建](../../../artifacts/taste-impeccable/2026-10-28/build-verified.log) |
| 相关渲染/配置/恢复回归 | 105/105通过，无跳过，不与浏览器组相加 | [TAP](../../../artifacts/taste-impeccable/2026-10-28/renderer-tests.tap) |
| 生产浏览器交互 | 七组、19张截图通过；pageErrors=0、外部HTTP请求0；两种字体实际加载，八项代表性文字对比度最低6.42:1 | [最终报告](../../../artifacts/taste-impeccable/2026-10-28/verified/report.json) |
| Taste浏览器 | 入口页四宽度：1440×900、980×613、768×1024、390×844，最终0 FAIL/0 WARN | [最终报告](../../../artifacts/taste-impeccable/2026-10-28/taste-final/report.json) |
| Taste对照 | 原界面3 FAIL/3 WARN；首轮调整0 FAIL/1 WARN（小字偏多），修正常用字号后归零 | [原基线](../../../artifacts/taste-impeccable/2026-10-28/taste-baseline/report.json)、[首轮](../../../artifacts/taste-impeccable/2026-10-28/taste-round1/report.json)、[对比](../../../artifacts/taste-impeccable/2026-10-28/taste-comparison.json) |
| Taste静态lint | 0 FAIL/18 WARN；保留下述可解释的语法提醒 | [最终lint](../../../artifacts/taste-impeccable/2026-10-28/taste-lint-final.log) |
| Impeccable detect | 最终仅执行一次，六个界面源文件，返回空数组 | [原始结果](../../../artifacts/taste-impeccable/2026-10-28/impeccable-detect.json) |

静态lint的18项提醒分为三类：Mono字体声明仅供真实路径/代码；shadow规则包含显式none、结果为none的旧样式覆盖及真实浮层阴影；glass规则命中backdrop-filter:none。未关闭检查或加入忽略标记，运行态Taste检测已确认入口页无相应发现。首次inspect因预览服务未启动而连接拒绝，原失败日志保留；启动隔离服务后才产生上表基线，不把连接失败计作界面通过。

浏览器七组覆盖：五页/关系图与主题/尺寸、代表性文字对比度、搜索/清空焦点、侧栏重开、配置弹窗Escape/焦点、执行只读入口、字体与外部请求。19张截图包含安装路径展开，不是19条独立业务测试。

| 同状态对照 | 原界面 | 最终界面 |
| --- | --- | --- |
| 1440×900首屏 | [原图](../../../artifacts/taste-impeccable/2026-10-28/taste-baseline/desktop-fold.jpg) | [新图](../../../artifacts/taste-impeccable/2026-10-28/taste-final/desktop-fold.jpg) |
| 390px预览 | [原图](../../../artifacts/taste-impeccable/2026-10-28/taste-baseline/mobile-fold.jpg) | [新图](../../../artifacts/taste-impeccable/2026-10-28/taste-final/mobile-fold.jpg) |
| 深色主题 | [原图](../../../artifacts/taste-impeccable/2026-10-28/before/07-machines-dark.png) | [新图](../../../artifacts/taste-impeccable/2026-10-28/verified/07-machines-dark.png) |

## 复现与范围

在仓库根执行；证据目录使用新名称以保留已有结果：

```powershell
npm run build --prefix desktop
node --test desktop/tests/ui-redesign.test.cjs desktop/tests/agent-configuration-ui.test.cjs desktop/tests/connection-ui.test.cjs desktop/tests/connection-recovery-ui.test.cjs desktop/tests/mcp-status-facts-ui.test.cjs
node desktop/scripts/check-workbench-design.cjs --output artifacts/taste-impeccable/local-recheck
node desktop/scripts/preview-ui.cjs
```

在另一个终端以本机已安装技能路径运行Taste的`inspect.mjs --app http://127.0.0.1:4197 --widths 1440,980,768,390 --out <新目录>`及`lint.mjs --app <上述六个界面源文件>`，Impeccable的`impeccable.cmd detect --json <上述六个界面源文件>`；最后运行`node scripts/check-docs.mjs`。工具不是应用依赖，其他机器需先按上方固定来源安装。

本轮未打包/发布新EXE，未进行真实模型、SSH部署、完整原生矩阵、触屏、完整无障碍审计、冷启动或图100ms验收。390/768为浏览器观察，不扩大Electron窗口或移动端准出承诺。图/其他页面不冒充Taste四宽度入口扫描；跟随系统与减少动态效果未单独重测。原docs:test 5/6和2243项历史材料缺失仍保留。

主文档只维护本轮最终状态；[前轮视觉记录](workbench-visual-refresh.md)及原截图保持历史身份。同步M01/M10设计与报告、整体功能/测试、迭代路线和索引；架构、数据与协议因合约未改变而不重复改写。

最终check-docs仍返回失败：276份Markdown、原2243项历史材料缺失，新增0、消除0；[前后差异](../../../artifacts/taste-impeccable/2026-10-28/docs-delta.json)保留原失败。五个格式化源/脚本文件Prettier通过，本片所改已跟踪源码与文档的diff检查通过；未把工作树其他版本准备纳入本片检查结论。

交付预览重新启动后HTTP200。独立后台Start-Process被自动审批拦截，工具仅返回blocked by policy；未更改审批或绕过限制，改用工具管理的前台会话。该地址不承诺跨会话存活，持久截图与上述本机启动命令同时保留。
