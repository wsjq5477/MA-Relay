# 整体测试与验收报告

#29入口收尾：SSH“后台维护”现在始终可打开查看；离线、任务和unknown只限制具体写操作，弹窗提供重新检查和查看原操作。alpha.71候选正按实际EXE交付验证，公开alpha.70暂不变。[本轮记录](iterations/I08/issue29-maintenance-entry.md)。


未发布源码已修复#29的维护入口闭锁：未登记后台仍不直接复用，但版本拒绝的离线机器可以打开维护，明确确认后替换为客户端自带的已校验后台。原身份、状态、收据与旧目录保留；不自动运行未校验旧版本回滚。[行为、实际验证与边界](iterations/I08/issue29-explicit-daemon-replacement.md)。


当前公开alpha.70：修复#27关系恢复的变更/观察判定及#28 SSH旧probe、阶段和错误投影；未登记daemon仍严格拒绝。源码/EXE/SHA公开，匿名完整下载匹配。Windows定向98/98、包内33/33；独立Ubuntu Core79/79、原生适配111/111、问题专项98/98。Windows全量1030通过/1失败/41平台跳过，DSH竞态在基线也复现，原失败保留。文档2243缺失、依赖1项high保留；未签名，真实profile、父模型/取消/性能与完整I06C/I07C/MCP02未准出。[发布与完整边界](iterations/I08/alpha70-release.md)。

构建、类型与lint通过；实际包内恢复及回环SSH/SFTP界面与普通portable生命周期分别验收。Ubuntu CI与WSL10/10分开记录，不以受控证据替代生产SSH或真实profile。原始失败与逐项要求见[本轮记录](iterations/I08/issues27-28-current-state.md)。

## 2. 资料整理时的历史持久基线

已随alpha.68发布的[Taste/Impeccable桌面视觉调整](iterations/I08/taste-impeccable-ui.md)已通过105项相关渲染回归、生产前端隔离浏览器七组检查/19张最终截图；两主题、两种桌面尺寸、字体离线加载、焦点及执行只读入口已验。Taste入口页四宽度无发现，Impeccable机械扫描空结果；模型0，不刷新下表历史基线、普通EXE或图100ms准出结论。

alpha.68已包含原生启动、Pi目录及Hermes分离保护；本次验证、历史证据和未准出项见[发布与完整边界](iterations/I08/alpha68-release.md)。

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
| AB-F07 原生执行 | [M06 报告](modules/06-native-adapters/test-report.md)及三个子报告 | Claude/OpenCode 有真实记录；Codex 账号/原生续接限制保留；Hermes Windows/Linux正式0.22.5真实执行与同Session续聊通过，Pi/DSH未完成范围按接入矩阵 |
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
| Hermes/Pi/DSH 真实工具执行 | 源码已实现；Hermes Windows/Linux正式安装版执行与续聊已有真实证据，Pi/DSH入口按接入矩阵分别记录 | 真实被委派/自主父模型与Pi/DSH未覆盖入口验收（I07C 收尾） |
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

alpha.68关系冲突恢复为分层受控验收：定向 137/137、生产构建及合成浏览器确认/取消/失败/成功反馈通过。桌面全量 926 通过、74 失败、1 跳过，未做变更前同工作区全量对比；未提升整体验收基线。[证据和未测环境](iterations/I08/relation-conflict-diagnostic.md)。

alpha.70已发布#27/#28：定向98/98、包内33/33；回环SSH与浏览器合成RPC已验。第二轮全量1030通过/1失败/41平台跳过，DSH竞态基线也有相同失败；不声明全量全绿，普通portable恢复/完整重启及实际包内恢复/SSH UI通过。[原始证据和未测项](iterations/I08/issues27-28-current-state.md)。
