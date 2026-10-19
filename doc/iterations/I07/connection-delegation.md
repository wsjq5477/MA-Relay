# CT-02：真实 MCP 发现、委派与结果读取

日期：2026-10-19（北京时间；JSON 时间为10月18日 UTC）。关联 AB-F07/F09/F11/F12/F13、M02/M03/M06/M07/M08。本片新增真实验收脚本和恢复保护用例，未修改产品运行代码；当前工作区未发布，公开 alpha.28、旧 ui.2/poll.4 候选不变，完整 I06C/I07C 未准出。

## 1. 需求与开发范围

上一片[真实直接生命周期](connection-native.md)完整收尾。此次中断发生在准备阶段，尚未创建新委派状态或派发原生任务；续跑先核对此事实，随后按[接入矩阵](../../agent-integration-matrix.md)推进 CT-02 的调用方/被调用方方向。

新增[真实委派脚本](../../../desktop/tests/linux-connection-delegation.cjs)：三种已安装工具轮流作为主节点，发现另外两种、各委派一个普通子任务、读取真实成功结果，再汇总。经过实际 Coordinator、AgentNetwork、MachineHost、原 CLI/HTTP、stdio MCP 和生产 broker；没有替换为返回固定结果的 dispatcher。测试仅在派发原方法之后记录匿名 MCP 观察，不伪造返回值。

每条链使用隔离持久 Bridge 目录和当前工具原生配置，同一 WSL 主机；不覆盖 Windows EXE、WSL JSONL 主机启动器或独立 SSH 运输路径。子 Agent 执行简单文本计算，不能把主 Agent 自己算出答案当子任务结果。

## 2. 实际完成与证据

环境：WSL Ubuntu / Node22.23.1；Claude Code2.1.302、Codex0.163.0-alpha.10.2、OpenCode2.0.24。各工具均实际承担主节点与被委派方，继承原生账号/模型；未添加模型 API、安装工具、更改原生凭据或批准权限。

| 原生主节点 | 实际子节点 | MCP list_agents / delegate / task_result | 首次结果 | 再次完整重开观察 |
| --- | --- | --- | --- | --- |
| Claude | Codex、OpenCode | 1 / 2 / 2 | 三原生Task均succeeded，主回答包含两个实际子回答 | Task数3→3，委派数仍2 |
| Codex | Claude、OpenCode | 1 / 2 / 2 | 同上 | Task数3→3，委派数仍2 |
| OpenCode | Claude、Codex | 1 / 2 / 3 | 同上；一次只读结果仍running，后续读取成功 | Task数3→3，委派数仍2 |

共 **9个成功原生任务、9个不同原生Session、6个委派方向、16次真实MCP调用**。这是三条完整链，不是9个独立主任务；重复观察不增加执行数，不与前片9个直接生命周期任务混算。[汇总与逐次报告索引](../../../artifacts/connection-delegation/2026-10-19/verification-summary.json)。

验收逐项检查：

- `list_agents`只返回当前两个获准子节点，并带实际八项能力投影和静态来源。
- 每项子请求的派生 requestId、消息、主节点、父 request/Task/Conversation 和目标节点精确匹配；子请求的 `collaboration:false` 已落盘，没有递归扩大权限。
- 子 Task 通过原机器查询，实例归属仍为目标节点；非空原生 Session、真实 succeeded 和回答内容均匹配测试需求。
- MCP观察证明主节点实际调用delegate、task_result并读到各子任务succeeded；主最终回答包含两项真实结果，不能只凭父任务成功判子执行通过。
- 关闭全部观察器、重新打开后，只查原父请求和历史证据；原Task/答案/Session保留，Task/委派数不增加。原父终态后不再次调用其失效MCP scope。

报告仅保存状态、版本、答案摘要/长度和匿名引用；私有检查点留在原目录，不向文档复制内部身份、endpoint、认证或原生历史。

## 3. 中断恢复及工程保护

默认 `--plan` 或导入模块不创建后台/模型。首次 `--run <leader>` 保存检查点后才推进；已有状态再次run与observe只观察。`--continue`要求已有状态，仅可推进尚未准备的后续步骤，不能重发已经准备的意图。单进程推进锁避免并发新派发；回收死锁不删除原意图。

节点接入、关系保存和父任务均先持久化完整输入/指纹，再调用生产入口一次。已准备的接入/关系只查原nodeOperation/collaborationOperation，父请求只查原requestId；not_found、丢回应、缺配置、超时、外来收据及改输入均不能变成再次提交。错误或等待/unknown保留原状态，不自动取消或批准权限。真实子请求仍由生产委派台账去重，验收脚本不代替主 Agent 发delegate。

[保护测试](../../../desktop/tests/connection-delegation-harness.test.cjs) **7/7通过，模型0**：默认零执行、设置意图先于派发、丢回应/缺收据不重放、观察与输入冲突/外来收据拒绝、精确父子/派生ID/消息归属、真实工具指引、匿名观察边界。[定向TAP](../../../artifacts/connection-delegation/2026-10-19/harness.tap)。全桌面最终串行结果见[完整TAP](../../../artifacts/connection-delegation/2026-10-19/desktop.tap)，定向属于全量子集，不能相加。

[源码观察清单](../../../artifacts/connection-delegation/2026-10-19/source-manifest.json)记录304份源码/测试/素材/工程配置；前片302份文件逐一摘要核对无变化，仅新增两份验收/测试文件。本片没有核心、前端或生产宿主改动，核心45/45与类型/lint/构建保留前片日期，不冒充本次重测。`architecture.md`、`data-model.md`、`protocol.md`已核对：无协议、存储、路由、权限或归属契约变化。资料与差异检查在交付前执行，结果纳入汇总。

```bash
node desktop/tests/linux-connection-delegation.cjs --plan
node --test desktop/tests/connection-delegation-harness.test.cjs
# 真实模型；首次run才派发，已有状态只观察。
node desktop/tests/linux-connection-delegation.cjs --run claude
node desktop/tests/linux-connection-delegation.cjs --observe claude
node scripts/check-docs.mjs
```

真实运行本次三条首次链及再次观察均通过，没有掩盖失败或用新ID补跑。需要正常本机执行权限以启动CLI、HTTP与本地socket；没有降低产品检查来适配受限环境。

## 4. 发布与下一步

[本轮GitHub元数据](../../../artifacts/connection-delegation/2026-10-19/release-state.json)仍为预发布 alpha.28，目标冻结源码3df2534，EXE129884570字节；仅核对API元数据，没有重新下载或发布新包。当前新增验收文件及此前未发布增量不能用旧 EXE 验收。

CT-02已补齐当前WSL三工具的直接生命周期及全部六个普通委派方向。Hermes/Pi/DSH仍缺真实环境；本片没有新增权限/表单、原生账号隔离、执行中网络断点注入、独立SSH或真实新EXE证据。下一步按实际可用环境补新三工具实测，并冻结当前源码的新本地Windows候选、验证包内资源及真实IPC；ACP/公共MD/显式上下文仍分别按矩阵推进，不以本片替代完整准出。
