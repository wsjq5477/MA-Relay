# CT-02首批：三种已安装 Agent 的真实原生生命周期

日期：2026-10-19（北京时间；原始JSON为10月18日UTC）。关联 AB-F07/F08/F10/F11、M02/M03/M06/M07。未发布工作区，公开 alpha.28、旧 ui.2/poll.4 候选不变，完整 I06C/I07C 未准出。本片开发验收工具并取得真实证据，没有改变产品运行行为。

## 1. 需求与本次范围

CT-01已完成所列能力一致化；当前按[接入矩阵](../../agent-integration-matrix.md)推进 CT-02。先核对上次任务状态：上轮已完成，没有未收尾的限流任务。常规生产发现可用 Claude/Codex/OpenCode，Hermes/Pi/DSH仍未检出；本片没有安装、登录或改原生凭据。

新增[可恢复真实验收脚本](../../../desktop/tests/linux-connection-native.cjs)走生产 Coordinator → AgentNetwork → MachineHost → 原 CLI，OpenCode走既有 Controller/HTTP 驱动。每个工具最多三个原任务：首轮记住随机标记；重开全部观察器后在原 Conversation/Session 中回忆标记；新建一个仅生成文本的任务并取消。回答是真实原生结果，未用协议夹具替代。没有重新运行真实委派/MCP调用方链，不把直接执行等同于两个协作方向都已验收。

## 2. 中断与身份保护

默认 `--plan` 和模块导入不创建后台或模型。首次 `--run <adapter>` 才初始化隔离持久状态；已有状态再次run或observe只读取原请求/原取消收据。`--continue`要求已有状态，可在已确认前阶段后推进下一阶段；已准备的原意图始终只查询，not_found、NOT_CONFIGURED、超时或丢回应都不能重发。推进进程互斥，死进程锁可回收，锁回收不删除原意图。

首发前原子保存完整参数与指纹；同ID改输入、外来/缺失Task或Conversation、不同机器及变更安装拒绝绑定。取消先保存原operationId，再发送一次；以后只查询原任务范围内的操作。控制收据confirmed与Task原生cancelled分别检查。原错误/等待/unknown保留原请求与私有目录，不自动取消、回复权限或换ID。

Core/OpenCode的控制收据为最小 `{operationId,state,data?}`；Controller按原Task路由，Hub鉴权并核对该operation属于原execution才返回。Claude/Codex返回taskId时还需匹配；不能要求所有既有收据都有顶层taskId，也不能用裸错误当派发前证明。该契约没有改动。本片没有新增RPC、协议字段、存储迁移、模型API或原生配置覆盖。

## 3. 真实运行结果

WSL Ubuntu / Node22.23.1，继承原生账号/模型。同一WSL主机，不是独立电脑或SSH；三个工具各自隔离Bridge目录。验收脚本不批准权限，不要求原生工具读写业务文件。公开报告只记录摘要、长度、状态及匿名引用，不复制原生历史、账号或内部身份。

| 工具与实际版本 | 首轮 / 原会话续聊 | 原任务取消 | 完整重开只读观察 |
| --- | --- | --- | --- |
| Claude Code 2.1.302 | succeeded / succeeded；同原生Session，回忆原标记 | 原收据confirmed，实际Task cancelled | 4组检查通过，任务数3→3 |
| Codex 0.163.0-alpha.10.2 | succeeded / succeeded；同原生Session，回忆原标记 | 原收据confirmed，实际Task cancelled | 4组检查通过，任务数3→3 |
| OpenCode 2.0.24 | succeeded / succeeded；同原生Session，回忆原标记 | 原收据confirmed，实际Task cancelled | 4组检查通过，任务数3→3 |

这是9个原生任务：6个成功回答回合、3个取消任务；重开观察不增加执行数。不能把取消前已绑定原生Session当作模型已经生成回答，也不将重复观察报告累加成更多实测。[汇总与逐次报告索引](../../../artifacts/connection-native/2026-10-19/verification-summary.json)、[当前版本发现](../../../artifacts/connection-native/2026-10-19/discovery.json)。Codex本版本的真实续聊通过；历史0.161.0续聊失败与Windows原账号失败保持原事实，不能被本机新结果改写。

## 4. 工程回归与复现

[恢复保护测试](../../../desktop/tests/connection-native-harness.test.cjs)7/7通过，模型0；覆盖持久意图先于派发、丢回应/缺原收据不重发、观察模式不启动下一阶段、参数与身份冲突、取消只查原ID、Core最小收据及外来收据拒绝。[定向TAP](../../../artifacts/connection-native/2026-10-19/harness-final.tap)。全桌面最终结果见[串行TAP](../../../artifacts/connection-native/2026-10-19/desktop-final.tap)，计入这7项，不跨模块/层次叠加。

根核心源码、前端与生产宿主相对CT-01冻结清单无变化；CT-01的45/45、类型、lint、构建结果保留原日期，本次没有冒充重测。新增两份验收/保护测试文件，`node scripts/check-docs.mjs`与差异检查在交付前执行。[本次源码观察清单](../../../artifacts/connection-native/2026-10-19/source-manifest.json)。

```bash
node desktop/tests/linux-connection-native.cjs --plan
node --test desktop/tests/connection-native-harness.test.cjs
# 真实模型：仅已安装、已配置的目标环境；首次run才创建原任务。
node desktop/tests/linux-connection-native.cjs --run codex
# 已有状态只观察，不能通过删除状态或新目录重跑未知请求。
node desktop/tests/linux-connection-native.cjs --observe codex
node scripts/check-docs.mjs
```

首次环境失败保留：受限执行不允许OpenCode写其原生日志目录，`--version`为EROFS；正常本机执行得到2.0.24，未修改发现器绕过原安装。[受限日志](../../../artifacts/connection-native/2026-10-19/opencode-version-restricted.log)、[正常版本](../../../artifacts/connection-native/2026-10-19/opencode-version.log)。随后额外收紧验收脚本时误要求Core收据含顶层taskId，OpenCode只读观察失败；按已有生产鉴权/任务归属契约修正脚本，保留失败报告并仅查原取消恢复。没有改产品验证器或重复取消。

## 5. 未测与下一步

CT-02仅首批直接生命周期完成。Hermes/Pi/DSH真实环境仍缺；当前发现仅覆盖PATH与受支持的用户安装目录，不证明全磁盘不存在。三工具本轮没有新增真实委派/MCP调用方、权限/表单或跨机器验收；旧证据保留各自日期。下一步补当前生产路由上的真实发现→委派→读结果方向，并在有可用原生安装后验证新三工具。新EXE、独立SSH以及可选ACP、公共MD、显式上下文按接入矩阵继续分开推进。
