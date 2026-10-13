# M01 桌面交互测试报告

核对：2026-10-12。当前源码候选 0.6.0-alpha.6；此前 alpha.2 的 SSH 主要验收保持原范围。设置页停止与普通关闭入口已补齐，隔离 UI 6 项通过；真实 Windows SSH 两轮和后台生命周期按本页当前报告记录。旧 0.5.0 结果作为历史基线保留。



## alpha.8 当前拖动与兼容验证

T-M01-17 / M01-F04/F09：2026-10-13，原用户 profile 认证 IPC 只读确认后台 alpha.5 不支持图布局；alpha.7 真实打包 Electron/认证 IPC/受控旧接口复现全部拖动锁定。alpha.8 真实打包窗口 7 组通过：Agent、整组机器背景、画布两种平移/出界释放、本机恢复、恢复同步与主居左、原丢 ACK 保护，按 [当次报告](../../iterations/I06/graph-drag-fix.md)记录。原用户窗口的旧 debug 端口不可用，不能冒充已直接观察该窗口。

既有生产前端图交互 10 组、主角色/避让/中键 6 组通过：[回归](../../../artifacts/graph-drag-fix/2026-10-13/ui.json)、[专项](../../../artifacts/graph-drag-fix/2026-10-13/usability.json)。桌面 116/116，通过；原生需求数为零。普通 alpha.8 EXE 启动/关闭/重开 3 项通过。原 profile 未改、原生/SSH 结果保留历史范围。

## alpha.7 历史图交互验证

T-M01-16 / M01-F04/F09：2026-10-13，Windows Edge 实际输入、中央真实文件存储、受控机器。主角色/端点、同一行 WSL 向左路由、中键五种区域、重开、布局 unknown 锁定、换主与旧边锚点共 6 组通过：[专项](../../../artifacts/graph-usability/2026-10-13/usability.json)。原图鼠标/键盘、授权与布局、轮询、冲突/两类丢 ACK、主题及三个分辨率 10 组通过：[回归](../../../artifacts/graph-usability/2026-10-13/ui.json)。没有提交原生模型需求。

路由的向左、间隔障碍、负坐标、复杂通道、60 节点扇出及重叠退化 6 项通过：[路由 TAP](../../../artifacts/graph-usability/2026-10-13/routing-tests.tap)。本次桌面 116/116、60 节点/59 条边的生产前端 p95 37.9ms；普通 alpha.7 EXE 的隔离启动/关闭/重开 3 项通过，包验证详见 [当次交付](../../iterations/I06/graph-usability.md)，历史 alpha.6 原生链保留原版本。


## 1. 实际结果

| 验收编号 | 功能 | 已验证行为 | 结果 / 层级 | 证据 |
| --- | --- | --- | --- | --- |
| T-M01-01 | M01-F01/F02 | 机器优先、WSL 宿主、同机多工具、空格选择与一次接入 | 通过；2026-10-10 界面模拟 | [I05 UI 报告](../../../artifacts/I05-ui.json)、[脚本](../../../desktop/tests/windows-i05-ui.cjs) |
| T-M01-02 | M01-F03 | 首次指纹需确认、拒绝不安装、默认端口、秘密隐藏与不保存 | 通过；界面模拟 | [SSH UI 报告](../../../artifacts/I06A-ssh-ui.json)、[脚本](../../../desktop/tests/windows-i06a-ssh-ui.cjs) |
| T-M01-03 | M01-F03 | 预检后一次安装批准、连接进度、节点自动显示、原 connectionId 重连 | 通过；界面模拟；没有真实 SSH | 同上 |
| T-M01-04 | M01-F05 | 远端只传原 Linux 目录、不出现本地选择目录或模型输入 | 通过；界面模拟 | 同上 |
| T-M01-05 | M01-F04/F05 | 保存主/子与刷新保留、向主节点发需求、看父结果 | 通过；界面模拟；子回复是 fixture | [I05 UI 报告](../../../artifacts/I05-ui.json) |
| T-M01-06 | M01-F06/F07 | 看板来源、未确认操作只限制所属机器、其他节点可发需求 | 通过；界面模拟和中央台账受控测试 | [I05 UI](../../../artifacts/I05-ui.json)、[main 测试](../../../desktop/tests/main.test.cjs) |
| T-M01-07 | M01-F06 | Claude delta 合并、验证输出可读 | 历史版本模拟证据；当前源码阅读核对，未单独重跑最新视觉基准 | [I04F 报告](../../iterations/I04F/report.md)、[流式输出脚本](../../../desktop/tests/windows-streaming-output.cjs) |
| T-M01-08 | M01-F01/F05/F06 | 0.5.0 普通启动/重开有真实机器、节点和历史 | 通过；历史真实发布包 | [I05 portable](../../../artifacts/I05-portable.json) |
| T-M01-09 | M01-F03/F08 | 新候选 Windows 真实安装/两轮/关闭/停止/重开及原任务恢复 | 通过；真实窗口与普通 EXE；密码/DPAPI 另有实际协议报告 | [窗口](../../../artifacts/I06A-real/report.json)、[普通 EXE](../../../artifacts/I06A-final/portable.json) |
| T-M01-10 | M01-F08 | 设置页关闭窗口、取消停止、确认停止 | 通过；6 项隔离界面检查包含此场景；真实生命周期另见 T-M01-09 | [界面报告](../../../artifacts/I06A-ssh-ui.json) |
| T-M01-11 | M01-F09 | 实际拖拽端点、键盘替代、图布局重开、状态刷新不吞草稿 | alpha.6 已实现并验收，实际证据见 T-M01-15 | [I06 图设计](../../iterations/I06/graph-design.md) |

I06A UI 报告的“私钥与 agent 分支”证明字段切换和错误展示，不能证明真实私钥解密、ssh-agent 签名或 Windows DPAPI。

## 2. 本次工程基线

桌面 TypeScript 检查与 Vite 构建通过。全桌面 87/87 受控测试通过，但其中多数属于后台，不能称“87 个界面用例”。持久基线见 [desktop TAP](../../../artifacts/docs-baseline/2026-10-12/desktop-tests.tap) 与 [整体报告](../../testing.md)。

## 3. 复现入口

从仓库根执行不调用模型的类型/构建检查：

```bash
npm run build --prefix desktop
```

隔离界面脚本需要 Windows Node、已安装 Edge、最新 `desktop/dist` 和仅供静态资源的本地服务。先在测试终端服务静态目录，再用 Windows Node 执行：

```bash
node desktop/tests/windows-i05-ui.cjs http://127.0.0.1:4199
node desktop/tests/windows-i06a-ssh-ui.cjs http://127.0.0.1:4206
```

这些脚本使用 mock preload，不运行真实 Electron 后台、不连接服务器、不调用模型。脚本会覆盖同名 UI 报告/截图，重跑前保留需要追溯的旧证据。静态服务是测试环境依赖，不是产品要求用户开第二终端。

真实 Windows 交付验收由 [M10](../10-packaging/test-report.md) 记录，真实模型与控制由 [M06](../06-native-adapters/test-report.md)记录；不能把上述模拟脚本作为它们的通过证据。

## 4. 尚需补齐

Windows 主要流程已通过；系统 agent 服务、加密私钥到独立服务器等专项覆盖与图交互仍按候选限制/后续迭代维护。界面状态延迟 20 样本 p95 也没有本次实测数据，1500ms 轮询周期不等于端到端延迟保证。

## 当前 6A 候选验收结果

2026-10-12 / 0.6.0-alpha.2：[真实 Windows 窗口](../../../artifacts/I06A-real/report.json)与[普通便携程序](../../../artifacts/I06A-final/portable.json)均通过。两轮保持同一 Conversation/native Session，关闭窗口保留同一后台，明确停止后新 PID 保留身份/机器/历史，恢复只查询原任务；普通程序请求数不增加。专项覆盖边界见 [6A 候选验收](../../iterations/I06/acceptance.md)。

## alpha.3 发现修复展示与启动

T-M01-12 / M01-F06/F08：2026-10-12。真实 Codex worker 的 MCP progress 包含 `agentbridge/list_agents`、`agentbridge/delegate`、`agentbridge/task_result`，见 [原生报告 mcpProgress](../../../artifacts/codex-discovery/2026-10-12/native-report.json)；这是后端事件证据，未单独重跑工具过程的视觉截图。普通 alpha.3 EXE 在隔离 profile 中实际启动、正常关闭、重开，通过主窗口标题、版本和同 Coordinator 核验，未提交模型需求：[报告](../../../artifacts/codex-discovery/2026-10-12/portable.json)。未修改前端组件或轮询契约，完整 SSH/表单视觉专项没有在本次重跑。

## 新窗口设置页停止现有后台

T-M01-13 / M01-F08：alpha.4 的真实打包窗口在旧窗口关闭后进入自己的“设置 → 后台运行”，显示并点击“停止后台并退出”，按真实进程退出和 IPC 停止判断结果，再次打开检查新版本和原配置身份。[报告](../../../artifacts/new-client-stop/2026-10-12/report.json)、[后台运行截图](../../../artifacts/new-client-stop/2026-10-12/new-settings.png)。没有前端功能改动，是现有入口的使用说明校正；完整环境与初次自动化退出错误见 [说明](../../iterations/I06/client-background-operation.md)。

T-M01-13 最终通过，新窗口实际确认退出、旧 IPC 停止、再次打开加载 alpha.4 并保持原配置身份；未提交模型需求。


## 当前 alpha.5 恢复错误清理验证

T-M01-14 / M01-F01/F02：2026-10-12 / alpha.5，新增 2 项受控状态回归、全桌面 95/95，通过。旧版本报错在恢复成功后撤销并持久化，旧目录成功快照不继承错误，新的 RPC/主机密钥错误仍显示；原连接/接入节点/任务历史保持。Windows 当前前端的受控快照卡片渲染 2 项通过。原用户状态只读核验，不是新包实际远端重连或模型验收。[本次测试与范围](../../iterations/I06/ssh-error-recovery.md)、[TAP](../../../artifacts/ssh-error-clear/2026-10-12/desktop-tests.tap)、[UI](../../../artifacts/ssh-error-clear/2026-10-12/ui.json)。

## I06B alpha.6 历史验证入口

2026-10-12 / 0.6.0-alpha.6：T-M01-15 / M01-F04/F05/F09：实际 Windows Edge 鼠标/键盘端点、草稿轮询、删线、布局重开、冲突/丢 ACK 与目标选择；原始结果分别标注中央真实存储+受控机器，不能冒充 SSH 或模型。本次代码、命令、逐项结果与限制汇总于 [I06B 实施](../../iterations/I06/graph-implementation.md)。受控工程结果见 [桌面 TAP](../../../artifacts/I06B/2026-10-12/desktop-tests.tap)、[核心 TAP](../../../artifacts/I06B/2026-10-12/root-tests.tap)，界面见 [UI](../../../artifacts/I06B/2026-10-12/ui.json)、[性能](../../../artifacts/I06B/2026-10-12/performance.json)，本次核心 43/43、桌面 110/110、Windows 图 10 组通过；性能 p95 30.0ms。独立 SSH 双向原生链、普通无 debug EXE 及源/包完整性分别通过，原始证据与范围见当次报告。历史表保留原日期/版本，不计为本次重新运行。


## alpha.9 当前节点管理专项

T-M01-18 / M01-F01/F02/F04/F05/F09：2026-10-13 / 0.6.0-alpha.9。范围：单一菜单、每组添加、接入/断开/移除确认、恢复原身份、原操作重开及旧后台能力提示。逐项实际结果、环境、脚本、原始证据与未测范围见 [节点管理完整验收](../../iterations/I06/node-management.md)。工程证据为本次 [桌面 TAP](../../../artifacts/node-management/2026-10-13/desktop-tests.tap)；窗口/程序/包状态以该报告实际结果为准，历史表不充当本次重测。原生 SSH/模型链保留 alpha.6 历史结果，本次未重跑、不改用户 profile、不提交 Prompt。
