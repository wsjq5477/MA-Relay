# 整体测试与验收报告

alpha.67候选将WSL就绪预算改为120秒；Windows→WSL→正式Hermes0.22.5已完成真实两轮、原请求去重和通道重开后的精确Session续聊，原生配置字节保持。独立Ubuntu适配109/109、Core71/71与原生MCP五组通过，Windows受控22/22；原未派发启动失败与首轮Core启动失败保留。新包验收与发布收尾中，当前公开仍alpha.66。[本轮实测与完整边界](iterations/I08/alpha67-hermes-linux-live.md)。

当前公开预发布alpha.66：Linux Hermes安装发现支持独立HERMES_INSTALL_DIR、原生数据Home/Profile根、后缀与路径展开，专用运行时目录不再提供其他Agent。Windows原生发现、stream-json、精确Session续聊、模型/账号配置和unknown恢复契约保持。Windows受控39/39，独立Ubuntu适配100/100及Core71/71，本机WSL和独立Ubuntu正式Hermes0.22.5原生MCP五组/十工具分别通过，模型0。普通EXE七组通过。网关取消、真实Linux模型/自主父模型、完整矩阵、图100ms与冷启动继续未准出；未切换日常后台或部署SSH。[本轮交付与分层证据](iterations/I08/alpha66-hermes-linux.md)。

本轮原始失败、CLI安装与CI错误、修复依据和发布物校验写入[alpha.66记录](iterations/I08/alpha66-hermes-linux.md)；不将Windows受控、WSL、独立Ubuntu或真实模型证据混算。上轮Windows全量扩展/Core与docs:test失败按原日期保留，当前仅指定Linux集/Core及本轮定向集通过，完整工程矩阵未宣称全通过。文档原2243项历史材料缺失基线不隐去，本轮检查只接受无新增错误。

## 2. 资料整理时的历史持久基线

下表保留早期资料整理的 87/43 基线与原路径，作为文档检查的持久对照；各轮实际计数见对应迭代专项，不能将旧表冒充当前源码重新运行。

| 检查 | 结果 | 持久记录 |
| --- | --- | --- |
| 核心 `npm test` | 43 tests / 43 pass / 0 fail | [root TAP](../artifacts/docs-baseline/2026-10-12/root-tests.tap) |
| 桌面 `npm test --prefix desktop` | 87 tests / 87 pass / 0 fail | [desktop TAP](../artifacts/docs-baseline/2026-10-12/desktop-tests.tap) |
| 根 typecheck | 通过 | [基线摘要](../artifacts/docs-baseline/2026-10-12/summary.json) |
| 根 lint | 通过 | 同上 |
| 桌面 TypeScript + Vite build | 通过 | 同上 |
| 文档完整性与本地链接 | 整理完成后执行检查，以实际结果记录 | 同上 |

130 是这两个受控集的总数。一个跨模块用例可在多份报告引用，不能把各模块行数或复用数量相加成更多测试。

## 3. 各类证据分别证明什么

| 证据层级 | 可以证明 | 不能证明 |
| --- | --- | --- |
| 受控测试 | 数据/权限/去重/状态/错误分支的合约与受控进程行为 | 某个真实账号和厂商当前模型可用 |
| 生产后端无推理 | 真正 DesktopHost/MachineHost/daemon 能加载、发现工具与创建上下文 | 实际需求已有模型回复 |
| 隔离界面模拟 | 用户交互、参数、可见状态、秘密字段与错误展示 | 真实 SSH 密码、DPAPI、原生回复、EXE 寿命 |
| 真实 Agent | 指定时间/工具/账号/环境的一条执行链 | 所有原生版本能力、全部账号与系统 |
| 真实发布包 | 该 EXE 的启动、资源与具体流程 | 另一份未打包源码具有同样的发布状态 |

一条真实回复需要读取实际结果内容及所属任务。Codex 当前成功状态没有强制非空文本，因此仅检查 status=succeeded 不能作为用户回复验收。

## 4. 整体功能到模块验收的映射

| 整体功能 | 验收归属 | 当前结论 |
| --- | --- | --- |
| AB-F01/02 机器与发现 | [M03 报告](modules/03-machine-network/test-report.md) | 本机/WSL 已发布；远端 Linux 有真实记录；不覆盖全部第三方工具 |
| AB-F03 节点接入 | [M01 报告](modules/01-desktop/test-report.md)、M03 | 0.5.0 空格多选保留历史；节点动作接入与目标选择实测通过 |
| AB-F04/05 SSH 与凭据 | [M04 报告](modules/04-ssh-access/test-report.md) | 密钥真实路径有记录；Windows 密码/DPAPI 与实际加密密钥/隔离 agent 通过；系统服务全兼容未测 |
| AB-F06 安装与后台 | [M04](modules/04-ssh-access/test-report.md)、[M05](modules/05-linux-daemon/test-report.md) | 有系统 Node 的真实 Linux 安装通过；无 Node 实环境待测 |
| AB-F07 原生执行 | [M06 报告](modules/06-native-adapters/test-report.md)及三个子报告 | Claude/OpenCode 有真实记录；Codex 账号/原生续接限制保留；Hermes/Pi/DSH 受控 |
| AB-F08 会话 | [M07 报告](modules/07-task-session/test-report.md)与 M06 | 同会话续聊有证据；Windows SSH 两轮已有原生 Session ID 对比 |
| AB-F09 过程与回答 | [M01](modules/01-desktop/test-report.md)、M06 | 输出来源与聚合有实现/模拟证据；不是统一 token push |
| AB-F10 原生控制 | M06、M07 | 受控控制通过；各工具表单/许可能力不同 |
| AB-F11 原请求与恢复 | [M07](modules/07-task-session/test-report.md)、[M02](modules/02-coordinator/test-report.md)、M05 | 去重/unknown 保护有回归；游标过期补偿已实现 |
| AB-F12/13 关系与协作 | [M08 报告](modules/08-collaboration/test-report.md) | 四条 Windows/WSL 真实链；原父权限反例与独立 SSH 双向核心链通过 |
| AB-F14 常驻中央 | [M02 报告](modules/02-coordinator/test-report.md) | 受控与 Linux 开发环境重启证据；普通 Windows EXE 生命周期实测通过 |
| AB-F15 CLI | [M09 报告](modules/09-cli-hub-edge/test-report.md) | 本机 OpenCode CLI/Hub/Edge 合约及历史原生验收存在 |
| AB-F16 节点图 | M01、M08 | 实现与 10 组实际鼠标/键盘/持久布局通过 |
| AB-F17 发布 | [M10 报告](modules/10-packaging/test-report.md) | 0.5.0 历史包通过；开发候选已生成并验收，正式 0.6.0 未准出 |

具体 `T-Mxx-xx` 场景、真实测试名称与结果在每个模块报告，整体页不复制所有细节。

## 5. 真实证据基线

| 记录 | 时间/范围 | 结果与限制 |
| --- | --- | --- |
| [I05 验收](iterations/I05/acceptance.md)、[原始真实记录](../artifacts/I05-real.json) | 2026-10-10，Windows + 同宿主 WSL，0.5.0 | 四条 Claude↔OpenCode/WSL Codex 协作链通过；整体 raw status=partial 保留原生失败 |
| [I05 发布包](../artifacts/I05-portable.json) | 0.5.0 普通启动与重开 | 机器、节点、历史保留，无新 Prompt；不是 I06A 新包证据 |
| [I05 UI](../artifacts/I05-ui.json) | 6 项隔离界面检查 | 通过，子回复来自 fixture |
| [I06A SSH UI](../artifacts/I06A-ssh-ui.json) | 5 组隔离界面检查 | 通过，没有真实 SSH/模型调用 |
| [Linux 真实说明](../artifacts/docs-baseline/2026-10-12/i06a-remote-history.md)、[原始报告](../artifacts/docs-baseline/2026-10-12/i06a-remote-history.json) | 2026-10-10，开发机到独立 Linux，密钥认证、OpenCode 2.0.26 | 首次安装连接 77.8s，两轮 succeeded、同 Conversation；断线期间完成和中央重启回读有既有记录 |

Linux JSON 两轮终态只保存 status/summary，脚本用原 conversationId 续聊；本地台账也确认同会话与节点。不能据此独立证明两轮 native Session ID 一致，应在后续验收保留实际对比。

## 6. 未通过 / 未测试不合并

| 场景 | 状态 | 下一证据 |
| --- | --- | --- |
| Windows Codex 原模型账号拒绝 | 历史原生环境限制 | 用户原生账号/配置可用后再验证；Bridge 不替换模型 |
| WSL Codex 原生续聊 list_turns | 历史原生接口失败 | 支持的版本实测同 thread；不能新开伪装续聊 |
| Windows I06A 密码/加密密钥/agent/DPAPI | 未测试全部真实分支 | Windows 程序 + 真实登录/保护/恢复，不仅 mock |
| 无系统 Node 的独立 Linux | 未真实验收 | 私有 Node 安装、运行与原生 CLI 路径 |
| 注销清理 / systemd 用户服务 | 未完整实现/验收 | 对实际服务器策略验证，不能承诺所有 logout 后存活 |
| 20 样本状态延迟 p95 / 全退避时序 | 未完成本次测量 | 按 I06 定义保存样本、链路条件与计算 |
| 忙时升级与失败回滚 | 源码及真实 daemon/process 受控验证通过 | 独立服务器与原生验收见 I06C 收尾 |
| Hermes/Pi/DSH 真实工具执行 | 源码已实现，仅受控证据 | 真实安装环境执行与被委派验收（I07C 收尾） |
| DSH Desktop/Web 原实例 | 受控服务验证 | 连接用户原服务后的真实推理/续聊/取消验证 |

## 7. 可复现检查

不调用真实模型的工程检查：

```bash
npm run lint
npm run typecheck
npm test
npm test --prefix desktop
npm run build --prefix desktop
node scripts/check-docs.mjs
```

Node ≥22.13；测试可能启动隔离后台/worker 并调用原生安装 `--version`，不等于纯静态检查。模块报告给出更窄的适当测试入口。

真实模型、SSH 部署与发布包脚本单列在所属模块；使用明确授权的目标与隔离状态，不在文档保存秘密。运行前保存需要保留的历史报告，因为一些旧脚本会覆盖同名 artifact。

## 8. 维护方法

修改模块后更新其完整设计与报告、这里的功能结论、当次迭代和发布状态。新增的测试计划只登记待测，实际执行后保存证据再变更结论。规则见 [开发维护指南](development-guide.md)。

## 网页资料入口验收

桌面资料站仅发布 `doc/user/` 用户Markdown；内部报告/历史/过程不参与路由、搜索和资源导出。网页构建、发布边界、搜索、目录、DSH章节、接入摘要、主题与Mermaid的实际结果在 [M11 报告](modules/11-documentation-portal/test-report.md)维护；不纳入核心测试计数，也不改变 Windows EXE 交付结论。按用户要求不做手机专项验收。
