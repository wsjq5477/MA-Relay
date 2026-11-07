# I08 自定义 Agent 执行接入设计

当前 Pi 扩展与证据见[Pi 自定义运行时](custom-runtime-pi.md)。

2026-11-04 首片实现本机 Hermes 兼容命令；2026-11-07 未发布源码扩展为本机、WSL 和 SSH Linux 目标机器创建与图标选择，见[本轮记录](custom-runtime-remote-ui.md)。当前接入状态见[接入矩阵](../../agent-integration-matrix.md)，产品范围遵循[互联核心边界](interconnect-boundary.md)。

Multica 的 Daemon 在机器上发现和运行工具，Backend 统一执行入口，运行记录与原生会话独立。其内置 Runtime ID 可与协议族分开，自定义 Profile 只能选择已支持的 Backend，固定启动参数由该 Backend 消费。AgentBridge 借鉴身份和协议实现分离，并继续由调用方指定目标。参考 [Daemon Runtimes](https://multica.ai/docs/zh/daemon-runtimes)、[Backend](https://github.com/multica-ai/multica/blob/main/server/pkg/agent/agent.go)和[内置 Runtime](https://github.com/multica-ai/multica/blob/main/server/pkg/agent/builtin_runtimes.go)。实现由 AgentBridge 独立编写，Multica 的源码使用条件见[上游许可证](https://github.com/multica-ai/multica/blob/main/LICENSE)。

## 复用现有所有权

| 设计职责 | 当前落点 | 自定义接入的增量 |
| --- | --- | --- |
| Runtime Registry | [静态适配注册表](../../../desktop/electron/builtin-adapters.cjs)、[本机工具发现](../../../desktop/electron/tool-discovery.cjs)、[用户登记](../../../desktop/electron/agent-directory.cjs) | 试点验证一个固定协议 Backend 能承载独立 Runtime 身份。执行端点由目标机器所有者明确配置、探测和确认，再沿既有登记与授权公开。发现、健康和可委派分别判断 |
| Session Mapping | [Task/Conversation](../../modules/07-task-session/design.md) | 复用 Conversation 到原生 Session 的绑定。校验原机器、适配协议、端点、属主与工作目录。协议不支持原生恢复时显式拒绝续聊 |
| Invocation Lifecycle | [宿主契约](../../custom-agent-development.md)及[调用方契约](interconnect-caller-contract.md) | 继续使用 requestId、Task、executionId 和 operationId。先持久化意图，再派发。断线后查询原请求并读取已有事件。证据不足保留 unknown 和原资源占位，控制收据与任务终态分别核对 |

首片使用已有 MachineHost 和传输，能力受静态实现与当前端点共同约束。原生配置、凭据和浏览器登录态由目标机器持有。首片沿用节点串行准入；同一真实工作目录跨节点并发是独立验收项，节点锁无法证明目录互斥。

## 实施与验收

### 用户创建流程

入口放在目标机器的「添加 Agent」弹窗，与「重新扫描 Agent」并列。按用户提供的 Multica 截图分两步。

1. **选择基础 Agent 类型。** 列表仅显示已验证可运行自定义命令的类型，例如 Hermes 需先验证 AgentBridge 的 Hermes 启动、事件与会话契约。选择时说明命令须兼容该类型的协议。创建后协议类型固定。
2. **填写运行时。** 显示所选机器和基础类型，填写必填的「显示名称」「命令」及选填的「描述」。命令支持程序名或带引号的绝对路径，以及固定参数。底部提供「返回」「取消」「创建运行时」。命令解析、程序定位或协议探测失败时，保留表单内容并在命令字段旁给出具体原因。

保存由桌面 Coordinator 按目标 machineId 路由至目标 MachineHost 完成，远端 daemon 经认证连接开放创建并执行维护门禁。命令只以程序与 argv 的形式解析并执行，禁用 shell 展开、命令串联、管道和重定向。固定参数放在 Backend 生成的协议参数之前，Hermes 的 query、format、resume 和模型/供应商保留参数会拒绝。配置保存在目标机器私有状态目录。执行请求不能写入命令或参数，凭据留在原生配置。

创建使用稳定 UUID，重复提交相同配置返回原 ID，同 ID 改配置拒绝。保存前按已解析的程序与固定 argv 做版本探测。探测只证明程序可启动并报告版本，协议兼容性由执行确认。发现快照携带 `custom-runtime:<UUID>`、名称、版本和可用性，自定义配置与内置 Hermes 按不同安装身份分组。用户仍要执行「添加并接入」以及既有授权。首片创建后不可编辑，变更命令时创建新配置，原请求仍通过旧绑定核对。

### 开发切片

1. 首片 Hermes 复用 stream-json 宿主和原 Session。自定义运行时的 Bridge MCP 配置入口关闭，原生工具自己的 MCP 由其自行管理。其他类型逐一验收。仅作为调用方的 Agent 可使用[独立 MCP 调用契约](interconnect-caller-contract.md)。ACP 作为新增协议族的试点沿 CT-03 验证。
2. 以一个真实自定义 Agent 验证本机端到端链路。先用受控协议夹具验证重复请求、不同输入冲突、未授权零派发、丢回应后查询原请求、宿主重开和能力拒绝，再单列真实原生执行证据。只有观察到原 Session 续聊与原任务控制结果后才开放相应能力。
3. 沿既有机器连接验证 Windows 调用 Linux 的明确目标。由调用方决定编译失败后是否另行委派 Claude；编译与修改共享目录时，调用方先等待原 Task 终态。若需要多个调用方同时使用同一目录，单独设计目标机资源准入，并测试目录别名和 unknown 占位。
4. Multica 调用 AgentBridge 作为外部 Connector 试点。先选择一个 Multica 已支持的协议族，验证实际 Backend 的启动、握手、事件、权限、取消和恢复，再决定是否交付独立 shim。通过既有调用方授权绑定明确目标。反向的 Multica 任务委托留在外层集成。

Windows 上使用受控 Hermes 兼容 CLI，经过 Coordinator、真实 stdio MCP、MachineHost 和独立 worker，验证配置与内置 Hermes 共存、固定参数顺序、配置幂等和冲突、非法命令拒绝及丢回应后的原任务保留。模型请求为零。真实用户命令、Linux 运行、真实远端创建、Multica 握手和发布包尚待验收。[原生委派回归](../../../desktop/tests/native-delegation.test.cjs)

2026-11-04，Windows、Node 24.12.0。自定义 Hermes 专项 1/1，通过原 delegationId 核对原 requestId，重复委派返回原 Task，worker 只收到一次输入。[专项原始输出](../../../artifacts/custom-runtime/custom-hermes.tap)

TypeScript 与 Vite 构建通过。Chrome Headless Shell 156 使用生产构建和受控后台，在 1440、1024、640 像素宽度完成两步向导、探测失败、返回后保留输入、重新提交和候选列表更新。[交互输出](../../../artifacts/custom-runtime/browser-check.log) · [640 像素截图](../../../artifacts/custom-runtime/dialog-640.png)

联合回归 10/11，DSH 的取消与成功退出竞态首次得到 cancelled，夹具期望 succeeded。该项单独复跑 1/1，联合回归仍保留原失败。文档检查报告既有的 2243 项错误，本轮记录及新增链接无报错。
