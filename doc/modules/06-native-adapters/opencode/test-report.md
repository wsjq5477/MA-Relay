# OpenCode 适配器测试报告

更新日期：2026-10-12。功能 **M06-OC-F01**；对应[设计](design.md)。当前源码 `0.6.0-alpha.1`，本文不把现有 Windows `0.5.0` 包当作 SSH 新功能发布证据。

## 1. 当前工程证据

以下用例全部在 [2026-10-12 核心 TAP](../../../../artifacts/docs-baseline/2026-10-12/root-tests.tap) 中通过。它们使用受控原生 HTTP 服务和 OS 进程，不能代替真实模型回复。表中名称是测试源中的实际名称，可在 TAP 检索。

| 测试 ID | 文件与实际测试名称 | 验证的行为 | 结果 / 证据类型 |
| --- | --- | --- | --- |
| T-M06-OC-01 | [opencode.test.ts](../../../../tests/opencode.test.ts)：`OpenCode v2 through Hub/Edge: ownership, waiting/reply, pagination, result, isolation, dedupe and restart` | 归属、等待/回复、分页、结果、隔离、请求去重与重启 | passed / 受控 HTTP 集成 |
| T-M06-OC-02 | 同文件：`native Driver distinguishes explicit rejection, model failure and ambiguous admission; bounds result` | 明确拒绝/Provider 失败/派发不明区分，结果长度限制 | passed / 故障夹具 |
| T-M06-OC-03 | [i03b.test.ts](../../../../tests/i03b.test.ts)：`B01: three turns use one Session, isolate answers, preserve owner/config and dedupe` | 三轮 Session 相等，Message/答案隔离，owner/配置/去重 | passed / 受控原生时间线 |
| T-M06-OC-04 | 同文件：`B02: cancel once across duplicate IDs, lost response and completion race` | 取消去重、丢回应、不同 ID 竞争、成功竞态 | passed / 故障计数 |
| T-M06-OC-05 | 同文件：`B04: Edge rebuild restores waiting and completed original executions using reads only`、`B04: missing input, foreign steering and configuration mismatch retain unknown occupancy` | 只读恢复原轮，缺证据/外部输入时保留 unknown | passed / 故障夹具 |
| T-M06-OC-06 | [native-cli-default.test.ts](../../../../tests/native-cli-default.test.ts)：`OpenCode node inherits CLI recent preference after native config, reads updates, and never writes or invents a model` | 原生配置优先、recent/variant、更新读取、不写偏好、不虚构模型 | passed / HTTP + 临时偏好文件 |
| T-M06-OC-07 | [native-identity.test.ts](../../../../tests/native-identity.test.ts)：三个 `B05:` 用例 | 正确归属重用；错误 PID/出生身份/危险文件拒绝；陌生服务/凭据不动；父进程强杀后服务不因管道退出 | passed / OS 进程 + 受控服务 |
| T-M06-OC-08 | [i03b.test.ts](../../../../tests/i03b.test.ts)：两个 `B03:` 用例 | Hub 重启后持久事件补传、ACK 丢失，同序号不重复执行 | passed / Hub/Edge 故障集成 |

T-M06-OC-05/07/08 汇总多个实际用例，不能按表行计算自动测试数量。整个核心套件是 43/43，本表仅映射该适配器的相关用例。

## 2. 历史真实验收

| 日期 / 原生版本 | 功能 | 结果 | 原始证据 |
| --- | --- | --- | --- |
| 2026-10-08 / 2.0.24 | 三轮同 Session、上下文记忆、取消后续聊和服务重启历史 | passed | [I03B-native-contract.json](../../../../artifacts/I03B-native-contract.json) |
| 2026-10-08 / 2.0.24 | CLI 三轮、运行/等待取消、Controller 强杀后复用服务、只读对账、显示延迟样本 | passed | [I03B-acceptance.json](../../../../artifacts/I03B-acceptance.json)、[验收说明](../../../iterations/I03B/report.md) |
| 2026-10-08 / 2.0.24 | edit/bash/npm test、允许/拒绝、文本表单、退出重返 | 已验证指定链路 | [真实回归](../../../../artifacts/I03A-I03B-regression-acceptance.json)；报告保留拒绝后模型完成未确认的边界 |
| 2026-10-10 / 2.0.24 | 原生 CLI 默认真实 DeepSeek 回复、续聊、与 Windows Claude 双向 MCP 协作 | 核心链 passed；汇总 partial | [I05-real.json](../../../../artifacts/I05-real.json)、[I05 验收](../../../iterations/I05/acceptance.md) |
| 2026-10-10 / 远端 2.0.26 | 独立 Linux 发现、真实新会话、按原 conversationId 第二轮、断线期间完成及重连读取 | 已有开发环境成功记录 | [e2e-report.json](../../../../artifacts/docs-baseline/2026-10-12/i06a-remote-history.json)、[I06 核对](../../../iterations/I06/progress.md) |

远端原始 JSON 的两轮仅保存终态和 summary，未保存逐轮 native Session ID；会话台账与调用路径证明按原 Bridge conversationId 续聊，尚不能用该产物独立断言两个 native Session ID 相等。本报告不延续旧说明中超出证据的表述。

## 3. 限制、待补与复现

- OpenCode 普通调用接受 2.x 协议；限工具连接验证只核验过 2.0.24。远端 2.0.26 能回复不等于它的禁工具验证已兼容。
- 原生模型/API 配置可能变化；2026-10-10 的成功不保证未来账号授权、模型或网络可用。本次文档整理未重连服务器、未调用模型。
- 表单接口与文本填答已测试；模型自主生成复杂表单未完整验收。取消不撤销已有工具效果。
- 仍须补当前 Windows 发布包的远端会话链路和 native Session ID 比较；无系统 Node 的真实部署由机器/安装模块验收。

自动测试：`node --import tsx --test tests/opencode.test.ts tests/i03b.test.ts tests/native-cli-default.test.ts tests/native-identity.test.ts`。完整核心检查：`npm test`。真实测试要使用独立实例和目录，保留原生版本、绑定与计数证据，并同步本页及对应迭代报告。

## 当前 6A 候选验收结果

2026-10-12 / 0.6.0-alpha.2：独立 Linux OpenCode 在真实 Windows 窗口中两轮成功，native Session ID 完全一致；停止/重开与普通 EXE 无新 Prompt 回读通过。[窗口](../../../../artifacts/I06A-real/report.json)、[普通 EXE](../../../../artifacts/I06A-final/portable.json)、[候选验收](../../../iterations/I06/acceptance.md)。
