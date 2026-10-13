# I02 测试与验收记录

日期：2026-10-08。环境：Linux/WSL、Node 22.23.1、OpenCode 2.0.24。真实模型：已配置的 csi-provider/DeepSeek-V4.1-Flash。本轮范围为本机 CLI，不据此声明 Windows 原生、跨设备、完整恢复或看板已完成。

## 真实验收

命令：

```bash
npm run acceptance:opencode -- --model csi-provider/DeepSeek-V4.1-Flash --timeout-ms 300000
```

结果：**passed**。详细证据在 [真实验收报告](../../../artifacts/I02-real-acceptance.json)。每次运行复制独立示例、启动实际 OpenCode/Hub/Edge，经独立 CLI 提交任务；结束后清理服务、凭据和项目。

| 指标 | 实测结果 | 证据 |
| --- | --- | --- |
| 组合启动 | up 成功启动真实服务与 Bridge | checks.combinedStartup |
| 真实只读分析 | 正确指出 multiply 中加法错误，分析后源文件未改 | analysis、checks.readOnlyAnalysis |
| 真实修改 | multiply 改成 a*b，add 和测试文件保持原值 | fileChange、checks.realFileModification |
| 原生实际测试 | OpenCode shell 工具运行 npm test，两个测试通过 | nativeMessages、checks.nativeToolTestExecution |
| 独立复核 | 另用 node --test 验证修复后测试通过 | independentTest |
| 原生权限等待 | edit 的 ask 规则产生真实等待；native CLI 单次回复后继续执行 | approvals、checks.realPermissionHandling |
| 会话隔离 | 分析与修改 Task 对应不同原生 Session | checks.sessionIsolation、任务 native 字段 |
| 重复请求 | 同键同内容提交 5 次，1 Task、1 原生用户 Prompt | checks.idempotency |
| 重启保存 | 分析与修改任务重启后与原记录一致，丢失 0 | checks.restartHistoryLost |
| 真实中断保护 | 第三个真实任务等待 edit 时停止组合服务；重启后 unknown 保留占位；原生 Prompt 和 Driver invocation 均为 1，自动重跑 0 | fault、checks.realDisconnectProtection |
| 凭据检查 | 本次输出中已知 Bridge/原生凭据命中 0 | checks.credentialLeaks |

默认 exo-free 模型曾被提供方拒绝，Bridge 正确报告 failed，独立失败记录见 artifacts/I02-real-default-model.json。另一次分析/修改已通过但未触发等待的运行记为 partial，记录在 artifacts/I02-real-no-wait.json；不能把该轮当整轮验收成功。

## 工程与离线合约回归

- tests/core.test.ts、hub-fault.test.ts、integration.test.ts：保持 I01 领域、权限、持久化和独立进程故障场景。
- tests/opencode.test.ts：按本机 v2 合约提供离线服务，覆盖原生认证、模型检查、会话绑定、工具观察、权限回复、消息分页、结果、请求去重、任务隔离、所有权、重启、断线 unknown、明确拒绝、原生失败、不明提交与长回答截断。
- 离线 fixture 不调用模型，不计入上述真实验收。
- 工程命令：npm run lint、npm run typecheck、npm test（含 build）；17 个测试通过。最终检查记录见 artifacts/I02-checks.txt。
- 本机新启动 doctor 已确认 healthy=true；离线测试覆盖原生模型目录冷启动延迟，不重试任何 Prompt 写调用。
- 额外原生表单合约探测：在无模型调用的探测会话中创建表单、查询真实等待、提交 answer 后等待清除，记录在 artifacts/I02-native-form-contract.json；不计作真实模型表单场景。

## 仍属于后续迭代的能力

I03：会话续接、完整重传对账、unknown 自动恢复和释放、取消中断、统一远程交互。I04：Web 看板。本轮表单回复已实现，真实模型表单交互尚未作为额外验收场景；整轮等待指标通过原生权限场景验证。
