# 维护未决行的回收与维护进度可见（切片 A）

更新：2026-10-21。范围：0.6.0-alpha.36 工作区（含本轮未提交修复）。相关：[维护被拒后的离线恢复](maintenance-offline.md)、[用户恢复步骤](recovery.md)。

## 1. 需求

现场补充观察：维护对话框的按钮点不动、看不到任何进度。按用户确认的范围只做两件事，**不改变“未决收据不能换 ID 重做”的既有保护**：

| 编号 | 行为 |
| --- | --- |
| R-A1 | 远端维护行处于 `unknown` 且其记录的执行进程已经不存在（或从未记录）时，原 operationId 查询必须能把它收敛为终态，不能在桌面上永久卡住准入 |
| R-A2 | 维护上传/切换阶段在“后台维护”对话框可见；未决期间自动、有界地核对原操作；机器卡片也能看到上传进度 |
| R-A3 | 未决期间按钮仍按原设计禁用；自动核对只使用原 operationId，不重发、不换 ID |

## 2. 根因

1. **回收缺口**：[remote-maintenance.cjs](../../../../desktop/electron/remote-maintenance.cjs) 的 `query()` 只在“已记录 `workerPid` 且该进程已消失”时才派生恢复进程。`launch()` 先提交持久行、再记录并派生 worker，两步之间若控制器被杀，行会永远没有 `workerPid`：每次查询都原样返回 `unknown`，桌面据此一直保留维护屏障，对话框按钮永远灰着。
2. **可见性缺口**：`DaemonDialog` 没有任何进度渲染；上传进度虽由 [ssh-host.cjs](../../../../desktop/electron/ssh-host.cjs) 写入快照 `machine.installProgress`，却只有接入向导渲染，机器卡片也不渲染，模态框又把卡片挡住。
3. **实时性缺口**：打开对话框时 `NetworkApp` 保存的是机器的**快照对象**，后续刷新不会流入对话框；自动查询只有 `management-state.ts` 的 5 秒轮询。

## 3. 设计取舍

### 3.1 回收判定与宽限期

新增 `abandoned(row)`：`workerPid` 存在时沿用“进程已消失即废弃”；`workerPid` 缺失时只有 `phase!=='intent'`（说明 worker 至少写过一个阶段检查点）或 **`createdAt` 超过 60 秒**才视为废弃。宽限期专门用来避免与 `launch()` 的两次提交竞争；宽限期内查询不改行、不派生恢复。是否派生的判定与派生动作仍在同一把 `mutateRows` 文件锁内完成，失败关闭：只有拿得到输入文件 `maintenance-input-<digest(operationId)>.json` 才派生。

恢复进程本身仍然守既有证明边界：`phase==='intent'` → `rejected` + `DAEMON_NOT_STARTED`（原后台未被触碰）；`activated`/`stopped` 等阶段 → 按原收据切回原版本并重启；租约被活跃 worker 持有时 `recover()` 直接返回，不改写终态。

### 3.2 可见性与有界轮询

- 对话框按 `machine.installProgress.phase` 显示“正在上传/解包/校验 <已完成> / <总量>”，并给出 `role=progressbar` 与 `aria-valuenow`；`progressWarning` 作为 `role=status` 提示而不是失败。
- 未决时显示“已发送维护指令，等待远端切换（原操作已保留，不会重做）”；终态显示成功，或 `rejected` 时以 `role=alert` 显示远端原因。
- 对话框新增可选 `poll`：仅 `pending` 时按 1s→2s→4s→8s 封顶退避调用，同一时刻一次在途，卸载或 `pending` 变 false 立即停止；回调只查询本地保留的原 operationId。
- `NetworkApp` 改为按 machineId 从当前快照解析 `machine`，进度才可能进入对话框；卡片也用现有 `ui-status` 类显示同一进度。

取舍：不把轮询做成无限高频——既有 5 秒轮询仍在，对话框轮询只是“打开时更快”，且到 8 秒封顶；上游查询失败按原样保留 `unknown`，继续下一轮。

## 4. 代码落点

| 文件 | 改动 |
| --- | --- |
| [remote-maintenance.cjs](../../../../desktop/electron/remote-maintenance.cjs) | `abandoned(row)` + `query()` 在无活跃 worker 时派生恢复；宽限期 60 秒 |
| [DaemonDialog.tsx](../../../../desktop/src/DaemonDialog.tsx) | 阶段/进度/提示/终态渲染；`poll` 有界退避；按钮禁用语义不变 |
| [NetworkApp.tsx](../../../../desktop/src/NetworkApp.tsx) | 实时快照解析 `machine`；接上 `poll`（按 connectionId 找原意图后 `query(intent,false)`） |
| [MachineInventory.tsx](../../../../desktop/src/MachineInventory.tsx) | 卡片显示上传进度一行 |
| [daemon-maintenance.test.cjs](../../../../desktop/tests/daemon-maintenance.test.cjs) | 新增“查询回收缺失/已死 worker 行并尊重宽限期”用例 |
| [ui-maintenance-progress.cjs](../../../../desktop/tests/ui-maintenance-progress.cjs) | 新增真实 chromium UI 用例（3 项断言） |

协议版本、daemon 身份、收据/任务 ID、文件格式均未改变；没有新增状态或字段（轮询完全在客户端）。

## 5. 实测证据

2026-10-21，Linux 本机 Node v22.23.1；浏览器为工作区内 Playwright chromium headless shell `156.0.8078.4`（本机无 Edge）。

| 命令 | 结果 |
| --- | --- |
| `cd desktop && node --test tests/daemon-maintenance.test.cjs` | 13/13（新增：宽限期内不回收；超期后 `rejected`+`DAEMON_NOT_STARTED` 且原 daemon/版本/身份不变；`workerPid` 已死 + `activated` → `DAEMON_RECOVERED_ROLLBACK` 并恢复原版本） |
| 维护/SSH 专项五文件 | 39/39（daemon-maintenance 13、ssh-recovery-integration 8、daemon-rejection-ssh、ssh-security、ssh-progress-persistence） |
| `npx tsc --noEmit` / `npx vite build` | 通过 / 构建成功 |
| 新 UI 用例 `node tests/ui-maintenance-progress.cjs` | `{"status":"passed","checks":3}`；实测自动查询时刻 4ms（lane 立即查询）、1004ms、3004ms，退避符合 1s/2s；终态后 4.5 秒内调用数不再增长 |
| 反向对照 | 临时撤掉“实时快照 + poll”后同一用例失败（找不到“正在校验 …”），恢复后通过——证明用例不是空转 |
| 全量桌面 `node --test --test-concurrency=1 tests/*.test.cjs` | 构建后 **684/684 通过、0 失败**（[日志](../../../../artifacts/alpha37/regression-full-suite.log)）。构建前为 682 项 679 通过、3 失败；独立验证复现其根因是测试未隔离 `DSH_HOME`（`dsh-connection.discover()` 注入额外条目），同日由测试侧修复，只改测试文件、不进包 |

## 6. 未测边界

独立验证报告：[verify-report.md](../../../../artifacts/maintenance-offline/verify-a/verify-report.md)（自建 9 例 A1 证伪 + 5 项 UI 补充断言；结论为通过，无阻断反例）。以下限制同样如实保留：

1. **无真实用户远端、无 Windows GUI**：远端行为用真实本机 daemon + 真实维护 worker 夹具覆盖；界面用 headless chromium 渲染真实前端产物，不是打包 EXE 窗口。
2. **既有 Windows/msedge UI 套件本机未执行**：`tests/windows-*.cjs` 全部依赖 `channel:'msedge'` 或 msedge 绝对路径，本机无该浏览器。只做静态核对：本切片保留了全部按钮文案与 `aria-label`，关闭键仍只受 `working` 控制；新增轮询会在未决期间额外调用 `machine.operation`，需要在 Windows 端跑一次确认既有 fixture 的调用计数断言（新增进度行的 `.ui-status` 位于 `</header>` 之外，不在 `windows-poll-stability` 的机器头观察集内）。
3. **模态框遮挡**：只在 DOM 层断言卡片含进度文本，没有做遮挡/可点性的像素级验证。
4. **未覆盖组合**：多条机器意图并存、对话框打开期间切换目录、卸载竞态、`daemonMaintenance.state==='unknown'` 但本地无 pending 的文案、关闭对话框（unmount）后的停止路径（仅由 effect cleanup 保证）。
5. **宽限期常量**：60 秒为经验取值；验证实测 59 秒不回收、61 秒回收，边界一致。宽限期只决定“是否委托恢复”，**活跃租约才是防止重复回滚与改写终态的硬闸**（`recover()` 在租约被活跃 worker 持有时直接返回），因此慢启动的极端延迟不会改写终态。
6. **不承诺所有 unknown 都会收敛**：`phase!=='intent'` 且缺少 `workerPid` 的行会绕过宽限期直接委托恢复，若同时存在活跃租约，每次查询会多派生一个立即早退的恢复子进程（状态正确、有冗余开销）；若恢复自身持续无法证明终态（例如安装已被改动导致 `INSTALL_PREVIEW_CHANGED`），行会一直保持 `unknown`，当前没有负缓存或次数上限（每次查询仍会派生子进程）——这类情况必须按[恢复步骤](recovery.md)上机核对，不能靠界面等待。缺少 `maintenance-input-<digest>.json` 的 unknown 行永不结算且不上抛错误（正常 `launch()` 不会产生）。
7. **桌面重启后的文案**：仅凭快照 `daemonMaintenance=unknown` 打开对话框时，本切片的轮询只在本地仍有 pending 意图时启动；若本地台账已丢失，需要手动“查询原操作”，此时的等待文案是否过度承诺待产品复核。
