# I02 实现设计

依据 [需求](requirements.md)。本机探测版本为 OpenCode 2.0.24，接口依据其 /openapi.json 与随安装提供的原生客户端。该版本不是公开 v1 SDK 的合约，本轮使用 v2 HTTP API，不引入不兼容 SDK。

## 模块职责

| 模块 | 设计 |
| --- | --- |
| Config | Mock/OpenCode 配置判别联合；服务器仅回环 HTTP；项目、密码文件、可执行文件路径相对配置解析；真实 init 保留用户旧目录 |
| Native Server | 使用无 shell 的子进程启动 serve；捕获启动密码，600 权限保存；原生 stdout/stderr 均不转发；只管理本次启动的进程 |
| Native Client | Basic opencode 认证；禁重定向；每请求 15 秒；JSON 体上限 16 MiB；location[directory] 编码；会话消息分页读取 |
| OpenCode Driver | 真实健康检查、创建会话、提交 Prompt、轮询实际消息/工具/等待/终态；事件合并与数量限制；无写请求重试 |
| Edge Journal | 辅助 native_bindings 表保存 execution → session/message/server/workspace；保留 claim/invocations 去重规则 |
| Hub/Core | 允许 opencode 描述符与原生会话能力；native/waiting 事件仍受 Connector、execution、连续序号、状态机验证 |
| CLI | init、doctor、up；run/task 可读观察；native 本地等待查询、单次权限回复与表单回复；JSON 与既有错误退出码兼容 |

## 执行与确认

Edge claim → accepted → 持久 Driver invocation → started → 保存原生 session/message 标识 → native 事件取得 Hub ACK → 创建原生会话 → 提交固定 message ID → 轮询。

会话 location 必须对应可信配置目录；消息页必须包含本次 user message，发现其他 user Prompt 时停止确认并进入 unknown。新会话初始空闲不算完成。只有对应会话 outcome 和时间线 idle outcome 一致、且本次用户消息存在，才能确认原生终态。成功还需要可读回答；明确原生失败保存错误。请求超时、返回冲突、原生 interrupted 或证据不一致，断开 Edge，由 Hub 保守记 unknown。

session/message 标识在任何原生写调用前持久化，绑定通过不可改写的 native 事件进入 Hub。原生创建/提交请求均不自动重试。查证失败不能重新提交同一次执行。

## 观察与等待

轮询间隔默认 500ms，真实响应依据原生时间线。保留消息分页，工具状态变化与文本更新合并；普通进度最多 80 条，等待变化最多 100 次，另保留绑定和终态容量。达到交互保护上限进入 unknown，并明确指出需检查原生会话。

waiting 保留权限/表单类型、摘要与请求 ID。native 入口先验证 Hub 用户拥有任务，再核对本地 Agent/server/workspace 与绑定，查询原生会话和当前请求。单次回复只允许 once/reject；表单使用 JSON 文件传递 answer。回复接收不修改任务终态，由 Driver 继续确认。

## 启动、停止与故障

up 启动本次托管 OpenCode，再启动 Hub/Edge；任何一步失败清理本次服务。外部服务配置 managed=false，仅连接，不停止它。doctor 优先复用已运行服务，仅在未启动/没有认证文件且 managed=true 时启动临时检查服务，并关闭自己启动的实例。

OpenCode 2 首次加载位置时可能暂时返回空模型目录。doctor/up 对只读模型元数据允许最多 3 秒就绪等待，避免冷启动误判；真正未配置的模型仍报告不可用。该等待不会重试原生创建或 Prompt 写调用。

SIGINT/SIGTERM 停止组合服务；终端观察 SIGINT 仅结束观察。Edge 断线终止观察，不自动取消或重投原生任务；原生执行可能继续，因此任务保持 unknown 占位。这一限制留待 I03 完整恢复设计。
