# I01 测试与验收说明

需求：[requirements.md](requirements.md)。测试代码在 tests/；跨进程夹具在 tests/harness.ts。测试对象是本地 Linux/WSL 的真实 Hub/Edge/CLI 进程与 Mock Driver，不代表真实 OpenCode、Windows 原生或物理跨设备通过。

## 命令与证据

执行 npm run lint、npm run typecheck、npm test、npm run build。npm test 先构建，随后 Node test runner 执行 15 个用例：11 个领域/配置/存储测试、2 个实际服务写入故障测试、1 个请求中断回归测试、1 个跨进程验收。跨进程用例内部逐项断言 29 条 AC；余下 AC-F06-04 由存储截断和写入故障测试覆盖。

npm run acceptance 会构建、运行领域/存储及故障测试，再执行同一跨进程夹具并生成 artifacts/I01-acceptance.json。报告中的 checks 只记录跨进程验证的 29 条，避免把未在那个进程夹具里验证的检查伪装成同类证据。

报告包含实测 OS/Node、三个不同 PID、完整 src 与 package/lock/tsconfig 的 SHA-256 摘要、批次指标、AC 编号、耗时。没有 Git 历史的当前仓库用源码摘要定位版本；package 版本为 0.1.0。Node 内置 SQLite 的实验性提示在 stderr。

## 逐项验收映射

| AC | 场景与实际断言 | 证据来源 |
| --- | --- | --- |
| F01-01 | init 后独立 Hub/Edge A/Edge B PID；CLI 发现两个 Agent | 跨进程 |
| F01-02 | 再次 init 非零，配置逐字节保持原内容 | 跨进程、配置单元 |
| F01-03 | 非法字段、缺失凭据、数据路径不可用、数据锁、端口占用无虚假就绪且非零 | 跨进程、配置/锁单元 |
| F02-01 | agentId 唯一，所属设备正确，在线/健康/可用独立显示 | 跨进程 |
| F02-02 | 同 Connector 第二连接 409；其他绑定冒用 agentId 被拒且归属不变 | 跨进程 |
| F02-03 | 停止 Edge B 和无心跳测试连接后离线，Edge A 保持在线 | 跨进程 |
| F02-04 | 延迟任务显示对应 Task ID 与占用；unknown 重注册仍不可接单 | 跨进程 |
| F03-01 | 参数/stdin/file 路由到目标，结果含原消息和真实 agentId | 跨进程 CLI |
| F03-02 | 不存在/离线/忙碌/不健康/空白/超限/错误 UTF-8 拒绝，未创建额外任务 | 跨进程 CLI/HTTP |
| F03-03 | 同身份同载荷 10 个并发 CLI，Task 数 1、持久 invocation 1；离线仍取回原任务 | 跨进程 |
| F03-04 | 同键改目标/内容冲突；6 个新请求竞争仅 1 成功；拒绝键可以重新提交 | 跨进程 |
| F04-01 | 两个 Edge 各 10 次真实成功，20 次均核对目标/消息/事件/终态，逐项 CLI 查询 | 跨进程 |
| F04-02 | 两个 Edge 各 5 次配置失败，10 次均有 MOCK_FAILURE，无错误成功结果 | 跨进程 |
| F04-03 | 延迟期间 running 与进度可见；换行/中文/引号/Shell 字符只是数据，无文件副作用 | 跨进程 |
| F04-04 | 重复终态只 ACK，不增事件；非法转换和冲突不改变已保存结果 | 跨进程、状态/事件单元 |
| F05-01 | CLI 完成发现/提交/观察/查询，成功、失败、unknown 可区分 | 跨进程 |
| F05-02 | 文本字段齐全，JSON/JSONL 可解析，无诊断混入；列表和游标查询可查历史 | 跨进程 |
| F05-03 | 观察本地超时/Ctrl+C 后仍运行，最后正常结束，持久 invocation 仍为 1 | 跨进程 |
| F05-04 | 提交/查询/观察与拒绝退出码正确；普通查询 failed 返回 0 | 跨进程 |
| F06-01 | 同一批 20/10 共 30 个任务正常重启后完整快照相同，事件/结果/错误零丢失 | 跨进程、存储单元 |
| F06-02 | 原数据重启后同键返回原 Task，invocation 不增加 | 跨进程、存储单元 |
| F06-03 | 测试 Hub 向重启 Edge 重复投递旧执行两次，只返回收据，invocation 不增加 | 跨进程、台账单元 |
| F06-04 | SQLite query_only 故障下 Hub 返回 503，无新增任务/调用；Edge 写失败无假 ACK；UTF-8 截断带标记、终态保留 | tests/core.test.ts、tests/hub-fault.test.ts |
| F07-01 | 缺失/错误凭据、allowlist 外调用、越权注册/事件写入拒绝；记录未变 | 跨进程 |
| F07-02 | 他人 Task 不可见；来源伪造拒绝；requestId 按用户隔离；诊断需权限 | 跨进程 |
| F07-03 | 对全部收集的 CLI/HTTP 输出及服务日志扫描本轮四个凭据，明文命中 0 | 跨进程、脱敏单元 |
| F08-01 | started 后分别 SIGKILL Hub/Edge，原数据重启后 Task unknown、原因可查 | 跨进程 |
| F08-02 | 两个故障任务前后持久 invocation 各 1，自动重跑 0 | 跨进程 |
| F08-03 | unknown 的目标重新注册后新提交仍拒绝；旧键返回原 Task | 跨进程 |
| F08-04 | 30 个已保存终态不变；只故障 A 时 B 能继续执行 | 跨进程 |

表格前缀 Fxx-yy 对应完整 AC-Fxx-yy。

## 数据与故障方法

基准固定为每个 Edge 10 成功、5 失败，总 30，历史保留使用同一批数据。输入、幂等、竞争、权限、故障夹具另外创建任务，不计入基准分母。调用次数直接读取 Edge SQLite，而不是只检查 Hub status。

存储故障通过 PRAGMA query_only=ON 使实际 SQLite 写入失败，验证无虚假确认；不是已测试所有磁盘损坏/硬件故障。SIGKILL 使用实际子进程信号验证 WAL 与执行台账。测试结束清理所有服务和临时目录，报告不含凭据或私有消息。

Mock 的 invocation 是真实 Driver 入口的持久记录，不能据此宣称外部 Agent 具有 exactly-once 执行保证。响应不明与执行不明都采用保守处理；恢复/解除占位在 I02。
