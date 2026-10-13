# I01 开发与交付记录

批准：2026-10-08 用户批准进入 I01 开发。范围：[需求规格](requirements.md)。分析与实现设计：[design.md](design.md)；测试安排和逐项证据：[testing.md](testing.md)。

## 已交付模块

| 需求 | 开发结果 | 主要文件 |
| --- | --- | --- |
| F01 | 配置初始化、角色校验、路径锚定、保护凭据、前台启动、独占数据目录 | src/config.ts、src/cli.ts、src/storage/database.ts |
| F02 | 认证出站 WS、Agent 注册/归属、心跳下线、在线/健康/占用查询 | src/hub.ts、src/edge.ts |
| F03 | 文本/stdin/file、持久 Task/Conversation、身份范围幂等、立即保留串行名额 | src/client.ts、src/cli.ts、src/storage/hub-store.ts |
| F04 | 真实 Mock 成功/失败/延迟、持久调用入口、领域状态规则与事件冲突保护 | src/core.ts、src/drivers/* |
| F05 | 列表/详情/观察、分页历史、JSON/JSONL、明确退出码、观察独立于执行 | src/cli.ts、src/hub.ts |
| F06 | Hub/Edge 独立 SQLite、事务、双重执行去重、记录保留、截断与写入故障拒绝 | src/storage/* |
| F07 | 静态身份、allowlist、owner/diagnostics 授权、已知凭据脱敏 | src/security.ts、src/config.ts、src/hub.ts |
| F08 | 断线与启动扫描 unknown、占位保留、Edge 旧执行无重跑 | src/hub.ts、src/edge.ts、src/storage/* |

## 工程验证

实际执行过 lint/typecheck/test/build，15 个 Node 用例通过。[跨进程报告](../../../artifacts/I01-acceptance.json)记录实测时间、PID、源码摘要和指标；[工程检查输出](../../../artifacts/I01-checks.txt)保留最终命令的实际输出。

基准结果：20/20 成功正确，10/10 失败正确，同批 30 个任务重启零丢失；同键 10 次提交唯一任务/调用各 1；Hub/Edge SIGKILL 后自动重跑 0，unknown 占位保留；收集材料凭据命中 0。

依赖：运行时 ws/zod，开发工具 TypeScript/tsx/ESLint；SQLite 使用 Node 内置模块，无外部服务或模型依赖。package-lock.json 固定实际安装版本。没有初始化 Git、创建提交或发布软件。

## 当前边界

仅 Linux/WSL 回环开发模式、Mock 与 CLI。Node 22 内置 SQLite 有实验性警告，尚无 Windows 原生兼容性证据。I02 处理恢复/控制，I03 对接真实 OpenCode，I04 增加看板；I01 不释放 unknown、不自动重连、不提供取消/回复。
