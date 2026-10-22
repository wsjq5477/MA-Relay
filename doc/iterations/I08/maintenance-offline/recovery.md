# 后台维护失败后，机器显示“已断开”的恢复步骤

适用：在机器页执行“后台维护 → 升级后台/回滚后台”之后，机器卡片显示“已断开”，或 Agent 行仍提示“来源后台需要升级”。本页面向用户与排障人员；原理、代码与证据见[本轮说明](maintenance-offline.md)。

> 边界：以下步骤来自源码路径与受控夹具验证，**没有在真实用户远端或打包后的 EXE 上做过端到端复现**。“已断开”只表示桌面与远端之间的通道关闭，不代表远端后台进程停了，也不代表已接收的任务被取消。

## 1. 先在界面恢复

1. 看机器卡片上的维护提示。修复后的版本会在“已断开”卡片上显示维护被拒绝的远端原因（例如包摘要校验、后台忙），并提示可重新连接。
2. 点机器右侧的 `⋯ → 重新连接`。重连只恢复观察和读取原结果，**不会重发任务，也不会重做维护**。
   - 密码认证且没有保存凭据的机器，重连会要求重新输入密码。
   - 重开桌面不会自动恢复：维护开始时已把该机器的自动重连关闭并落盘，必须显式重连一次。
3. 如果横幅显示“原机器管理操作待核对”，先点“查询原机器操作”（或该卡片上的“查看”进入原操作），**不要另起一次升级**。查询只核对原 operationId 的收据；尚无确定收据时继续保留占位。

## 2. 仍无法连接时，在远端主机只读排查

用该机器原有的 SSH 账号登录（Bridge 不改服务器登录方式），按顺序看这些文件。路径占位：`<install>` 为安装目录，`<state>` 为状态目录，`<profileId>` 为当前 profile。

| 位置 | 文件 | 看什么 |
| --- | --- | --- |
| `<install>` | `current.json` | 当前生效版本的 version/digest/versionPath |
| `<install>` | `previous.json` | 升级前的原版本；存在说明发生过一次激活并保留回退点 |
| `<state>` | `maintenance-operations.json` | 原维护行：`operationId`、`state`（confirmed/rejected/unknown）、`phase`、`error.code/message`、`data.stopped/rolledBack/version` |
| `<state>` | `maintenance.json` | 维护准入租约；只有原操作能释放，崩溃时会保留 |
| `<state>` | `daemon.lock` | 后台身份锁：daemonId/owner/profile/pid/pidStart |
| `<state>` | `logs/daemon.log` | 后台启动与维护阶段日志（保留原文件，不要清空） |
| `<state>` | `daemon-receipts.json`、`daemon-events.jsonl` | 操作收据与事件游标；不要手工改写 |

判读要点：

- `data.stopped=false`、`state=rejected`：拒绝发生在停后台之前，原后台通常仍在运行，重新连接即可恢复观察。
- `state=unknown` 且 `error.code=DAEMON_ROLLBACK_UNCONFIRMED`：后台已停但切换/回滚未确认。**不要手工删状态目录或 kill 进程**；用“查询原操作”走原 ID 恢复，由恢复流程停掉残留进程、切回原版本并重新启动。
- `state=rejected` 且 `error.code=DAEMON_RECOVERED_ROLLBACK`：已按原收据恢复原版本，重新连接后核对版本即可。
- `phase=intent`：维护输入未到版本/进程变更阶段，原后台未被切换。
- `maintenance.json` 的 `operationId` 与本次维护不同、而该 operationId 的收据已是终态：这是修复前构建遗留的屏障。重新连接后机器可能仍拒绝新任务（daemon 认为自己在维护中）；此时再做一次“后台维护 → 升级后台”即可，修复后的版本会在停机前清理该遗留屏障（见[本轮说明 3.5](maintenance-offline.md)）。不要在运行中的 daemon 上手工删除该文件。

## 3. 必要时手动启动后台（最后手段）

只在确认没有运行中的维护、且 `daemon.lock` 指向的进程已不存在时，用该版本自带的运行时手动启动，避免污染原状态目录：

```bash
<install>/versions/<version>/runtime/node \
  <install>/versions/<version>/desktop/electron/machine-daemon.cjs \
  --state-directory <state> --owner <ownerCoordinatorId> --profile <profileId>
```

启动后在桌面点“重新连接”核对 `current.json` 版本与握手版本一致，不要在远端另建 profile 或复制状态目录来“修复”身份。Bridge 当前不支持服务器重启后的自动启动（未安装 systemd 服务），重启主机后需要重新连接。

## 4. 恢复之后

- 确认机器在线、Agent 列表可用，再查看原任务结果；原任务由远端后台保留，不需要重发。
- 若 Agent 行仍提示“来源后台需要升级”，说明那次升级从未生效（远端仍是旧版本）。确认没有运行/等待/未确认任务后，再做一次“后台维护 → 升级后台”；后台忙或仍有未确认收据时远端会以 `DAEMON_BUSY` 拒绝，这是保护而不是故障。
- 维护再次被拒绝时，卡片/未确认列表会显示具体安全原因；按第 2 节只读排查即可，不要用新的 operationId 重试同一次维护。
