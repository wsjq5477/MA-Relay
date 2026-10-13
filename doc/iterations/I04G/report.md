# I04G：未确认操作告警与只读恢复

日期：2026-10-10。桌面版本：0.4.7。

## 用户这条告警

来源是 2026-10-09 保存的一次 WSL 续问，requestId 为 redacted-id，父会话为 redacted-id。原后台查询返回 Request not found；父会话仍只有一轮 verification=true 的失败验证。

WSL HubStore 在创建任务、记录执行意图及发送原生 Prompt 之前拒绝验证会话续问。旧桌面没有将 CONVERSATION_BINDING 等明确拒绝识别为 rejected，且没有保存原始拒绝原因，导致 unknown 长期阻止新操作。只查不到请求不能证明普通操作未执行；本次修复额外核对原机器、控制器目录和不可续问的验证父会话。

已通过同一恢复逻辑，将这条旧操作归档为 rejected。原台账在用户数据目录备份，其他记录保留，当前未确认数为 0。只查询了 request 和 conversation，没有重投续问或新增模型调用。[实际恢复证据](../../../artifacts/I04G-existing-journal-recovery.json)。

## 新版行为

- 新提交前的明确会话拒绝直接记录为 rejected，并保存错误码和原因。
- 存在未确认操作时，界面自动只读核对原请求或原控制操作；未解决时每 10 秒再次查询，查询不阻塞界面刷新。
- 找到原 task/requestId 或原 operationId 的明确收据后更新台账。普通请求查不到、机器离线、控制收据仍 unknown、身份不符均保留保护。
- 仅对 WSL Hub 已知合同，结合不存在的原请求及同一不可变验证父会话，恢复旧验证续问的明确拒绝。Windows 和未知合同不套用这一判断。
- 并发更新过的台账不会被旧查询覆盖。相同 ID 的重试被拒绝也不能消除首次尝试的不确定性；未确认 ID 不允许替换原内容。
- 设置页的 verify 操作显示“连接验证”，不再标为“原生回复”。

## 验收

| 范围 | 结果 | 证据 |
| --- | --- | --- |
| 日常旧台账恢复 | 原请求与父会话只读核对通过；unknown → rejected；剩余未确认 0 | I04G-existing-journal-recovery.json |
| 桌面后台回归 | 51 项通过，包含 14 项新增恢复、身份、并发、重试及拒绝保护用例 | npm test --prefix desktop |
| 隔离前端 Mock | 6 项通过：提示保留、自动核对、验证名称、证据确认清除、未知保护及无重投 | [界面记录](../../../artifacts/I04G-journal-ui.json) |
| 构建 | TypeScript 与 Vite 通过 | npm run build --prefix desktop |
| 最终便携版正常窗口 | 4 项通过：隔离台账中的原告警自动归档、原身份与内容保留、没有 Windows 任务提交、日常请求及模型保持 | [实际便携版恢复](../../../artifacts/I04G-portable-recovery.json) |

前端检查使用隔离 Mock，真实状态修复与界面检查分别记录；本次没有新增模型调用。便携文件和 SHA-256 见 [构建记录](../../../artifacts/I04G-build.json)。

## 使用

日常旧提示已处理，当前窗口下一次同步即可消失；若仍看到旧显示，可关闭再打开。使用 AgentBridge-0.4.7-Windows-x64.exe 可获得后续只读自动恢复。验证记录保留为诊断，实际需求通过新建任务发送。
