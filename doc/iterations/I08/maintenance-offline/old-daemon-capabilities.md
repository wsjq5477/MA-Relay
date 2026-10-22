# 旧版本远端后台维护能力事实清单（alpha.2 / .3 / .9 / .10 / .15 / .35）

日期：2026-10-21。范围：只读 git 历史、`desktop/electron/*.cjs`、`desktop/compatible-daemons/*.json`；不改产品代码/测试。
用途：为“升级后台后远端离线、远端记录实际版本仍为 0.6.0-alpha.2”提供“旧后台到底支持哪些维护方法”的事实基础。

## 0. 证据可信度前提（已实测）

`desktop/compatible-daemons/<version>.json` 是该版本远端包（Linux x64）的逐文件 SHA-256 清单，由打包脚本收录并写 `compatibleDaemons` 索引（`desktop/scripts/stage-linux-package.cjs:31-40`）。把三个有源码的历史点与清单逐字节比对，**三点全部一致**，因此“清单条目 == 该版本实际包内文件字节”可作事实使用：

```bash
for c in 2b6f4f7 15b7c9e b5de577; do git show $c:desktop/electron/machine-daemon.cjs > /tmp/md.tmp; \
  sha256sum /tmp/md.tmp; wc -c < /tmp/md.tmp; done
# 分别得 338d5a46…/29863、687e0813…/33368、1aa60b59…/33844
# 与清单对照：alpha.9/alpha.15/alpha.35 的 machine-daemon.cjs sha256 完全相同
```

由此得到的关键推论（**同一 SHA-256 = 同一字节 = 同一能力**）：
`alpha.6/.7/.8/.9/.10` 的 daemon 与 `2b6f4f7`(alpha.9 源码) 同字节；`alpha.11/.12/.13/.14/.15` 的 daemon 与 `15b7c9e`(alpha.15 源码) 同字节；`alpha.2/.3/.4/.5` 的 daemon 互为同字节（`5734acda…/29390`），但**本仓库无任何源码**。

## 1. 逐版本能力表

| 版本 | daemon.quiesce / shutdown / releaseMaintenance | daemon.receiptRead | snapshot | bundle 内 remote-maintenance.cjs | bundle 内 runtime/owned-stop | PROTOCOL_VERSION | daemon.lock 字段 | SIGTERM 处理 | 证据 |
|---|---|---|---|---|---|---|---|---|---|
| 0.6.0-alpha.2 | **未知**（无源码；不排除支持） | 未知 | 未知 | 无 | 无 | 2（清单声明） | 未知 | 未知 | `desktop/compatible-daemons/0.6.0-alpha.2.json`（md=`5734acda…`/29390） |
| 0.6.0-alpha.3 | **未知**（与 .2 daemon 同字节） | 未知 | 未知 | 无 | 无 | 2 | 未知 | 未知 | `0.6.0-alpha.3.json`（md 与 .2 相同） |
| 0.6.0-alpha.9 | **不支持**（无这三个方法分支） | 支持 | 支持 | 无 | 无 | 2 | `lockId,pid,pidStart,daemonId,ownerCoordinatorId,profileId` | 有（SIGTERM+SIGINT） | `git show 2b6f4f7:desktop/electron/machine-daemon.cjs`：L10/20/106-107/231/235/388-389 |
| 0.6.0-alpha.10 | **不支持**（daemon 与 alpha.9 同字节） | 支持 | 支持 | 无 | 无 | 2 | 同上（同字节） | 有 | `0.6.0-alpha.10.json` md=`338d5a46…`/29863 == alpha.9 清单值 |
| 0.6.0-alpha.15 | **支持** | 支持 | 支持 | 有（19749 B） | 有（785656 B，mode 0700） | 2 | 同上 | 有（L426） | `git show 15b7c9e:desktop/electron/machine-daemon.cjs`：L10/20/106-107/240-257/265/426 |
| 0.6.0-alpha.35 | **支持** | 支持 | 支持 | 有（与 .15 同字节） | 有（与 .15 同字节） | 2 | 同上 | 有（L434） | `git show b5de577:desktop/electron/machine-daemon.cjs`：L107-108/241/252/256/266/434 |

补充（同法可复现）：alpha.11–alpha.14 的清单 daemon 摘要 == alpha.15 源码摘要，故这三个维护方法最早出现在 **alpha.11**；alpha.6–alpha.10 的 daemon 不含它们。`desktop/electron/machine-protocol.cjs` 在 alpha.2–alpha.35 清单中恒为 `d5bb2f48…/5004`，与实际 alpha.9/alpha.15 源码摘要一致 → 分帧线格式全程未变。

复现整表（清单侧）：

```bash
node -e 'const fs=require("fs");for(const v of ["0.6.0-alpha.2","0.6.0-alpha.3","0.6.0-alpha.9","0.6.0-alpha.10","0.6.0-alpha.15","0.6.0-alpha.35"]){const j=JSON.parse(fs.readFileSync(`desktop/compatible-daemons/${v}.json`));const f=p=>j.files.find(x=>x.path===p);const m=f("desktop/electron/machine-daemon.cjs"),r=f("desktop/electron/remote-maintenance.cjs"),o=f("runtime/owned-stop");console.log(v,j.protocolVersion,m.sha256.slice(0,12)+"/"+m.size,r?r.sha256.slice(0,12)+"/"+r.size:"no-rm",o?o.size:"no-owned-stop")}'
```

## 2. 旧后台收到未知方法的错误码

读 alpha.9 dispatch 源码（`git show 2b6f4f7:desktop/electron/machine-daemon.cjs`）：

- L228-235：`dispatch` 先处理 `daemon.status`、`daemon.eventRead`、`daemon.receiptRead`；随后 **L235** `if (!methods.has(method)) throw fail('DESKTOP_METHOD', …)`，而 **L20** `methods` 只含 `['snapshot','discover','context','scope','ipc','environment','connect']`。
- 因此 `daemon.quiesce` / `daemon.shutdown` / `daemon.releaseMaintenance` 在 alpha.6–alpha.10 后台上一律返回字符串错误码 **`DESKTOP_METHOD`**（不是 JSON-RPC -32601）。
- 线格式：L292 `respond` 发 `{id, error: safeError(error)}`，L29-33 `safeError` 保留符合 `^[A-Z][A-Z_]{1,60}$` 的 `code`，否则降级为 `DAEMON_REQUEST`；`DESKTOP_METHOD` 符合该正则。
- 客户端侧：`desktop/electron/remote-maintenance.cjs:37` 把 `v.error.code` 原样赋给抛出的 Error，所以 `catch(e){ if(e.code!=='DESKTOP_METHOD') … }` 的判定成立。
- alpha.15/alpha.35/HEAD 的同类兜底行分别为 L265 / L266 / L263；这三个版本在 **L240-257 / L241-256 / L238-253** 提前处理了 `daemon.quiesce`、`daemon.releaseMaintenance`、`daemon.shutdown`，不再落到该兜底。

## 3. `remote-maintenance.cjs` 的 `stop()` 分支判定

源码：`desktop/electron/remote-maintenance.cjs`（当前工作区 sha256 `bd5221e1…`，与 alpha.15、alpha.35 清单条目**逐字节相同**，即自 alpha.15 起未改）。

- `stop()` L44-49：L45-46 先读 `daemon.lock` 并核对 `daemonId/ownerCoordinatorId/profileId/pid/pidStart`；L47 `idle()` 后才试 `daemon.quiesce`（`DESKTOP_METHOD` → 本地写 `maintenance.json`）；L48 试 `daemon.shutdown`（`DESKTOP_METHOD` → 重核 lock，再 `execFileSync(helper,[pid,pidStart,uid])`）。
- `idle()` L41-42：先 `snapshot`，再循环 `daemon.receiptRead`；任一非 `DESKTOP_METHOD` 的失败都会**先于** quiesce 抛出。
- helper 来源 L69：`path.join(version(input,input.controller).versionPath,'runtime/owned-stop')`；`input.controller` 由 `desktop/electron/ssh-host.cjs:285` 传 `staged.release`，即 `stageMaintenance` 返回的**新版（当前 alpha.36）bundle**（`ssh-install.cjs:320,325`）。暂存目录 `maintenance-runtime/<digest>` 由新版 bundle 复制 `runtime/owned-stop`（`ssh-install.cjs:322-324`）。**与旧版本自己的 bundle 是否带 owned-stop 无关。**
- 维护 worker 本身也从 controller 目录运行（`ssh-install.cjs:327-330`），所以旧 bundle 里没有 `remote-maintenance.cjs` 不影响执行。
- 兜底停止由 `desktop/native/owned-stop.c` 实现：`pidfd_open` → 校验 `/proc/<pid>/stat` 的 UID 与第 22 字段(启动标识) → `pidfd_send_signal(SIGTERM)`；无 pidfd 时退出码 3（对应 `DAEMON_STOP_UNSUPPORTED`），绝不 PID-only 降级。

| 旧后台版本 | `stop()` 实际走向 | helper 取自 |
|---|---|---|
| alpha.9、alpha.10（同为 alpha.9 字节） | `idle()` 通过（`snapshot`+`daemon.receiptRead` 均支持）→ quiesce 返回 `DESKTOP_METHOD` → **写本地 `maintenance.json`**；shutdown 返回 `DESKTOP_METHOD` → **落回 controller 的 `runtime/owned-stop`** 发 SIGTERM。quiesce 正常分支不成立，旧后台不认识该占位。 | controller（新版）版本目录 |
| alpha.15、alpha.35 | quiesce 成功 → **走 quiesce 正常分支**（`maintenance.json` 由旧后台自己原子写入，L248/L246）；shutdown 成功 → 正常分支，**不使用 owned-stop** | 不触发（helper 仍按 L69 解析，但不执行） |
| alpha.2、alpha.3 | **未知**：(a) 若旧后台不支持 `daemon.receiptRead`，`idle()` 先抛错，维护以 `rejected` 结束、旧后台保持运行，不会走到 quiesce/shutdown；(b) 若与 alpha.9 行为一致，则同 alpha.9 走“本地 `maintenance.json` + controller owned-stop”。两者都无法用现有证据排除。前置条件 `version(input,input.from)`（L67）还需 alpha.2/alpha.3 的钉扎清单与远端目录逐文件匹配。 | controller（新版）版本目录 |

## 4. 未知 / 存疑（不得当作事实）

1. **alpha.2/.3/.4/.5 的 daemon 源码不在本仓库历史中**（最早提交 `2b6f4f7` 已是 alpha.9）。其 quiesce/shutdown/releaseMaintenance/receiptRead/snapshot/status/eventRead 支持、`daemon.lock` 字段（是否含 `pidStart`）、是否安装 SIGTERM 处理，全部**未知**。
2. 该旧后台对未知方法返回的错误码**未知**；`stop()` 的兜底只在 `code === 'DESKTOP_METHOD'` 时触发，其它码会直接抛出并结束维护。
3. alpha.2/.3 的 `daemon.lock` 是否含 `pidStart` 未知 → 若缺失，`remote-maintenance.cjs:46` 会以 `DAEMON_OWNERSHIP` 拒绝，压根不会调用 owned-stop。
4. 无已执行证据：`grep -rn "DESKTOP_METHOD" desktop/tests/` 无命中，`desktop/tests/daemon-maintenance.test.cjs` 的 fixture 里 from/target 用同一份新源码，**没有任何测试真实模拟“缺少 daemon.quiesce 的旧后台”**；第 3 节结论目前只来自源码阅读与清单比对。
5. 本文件不判断“远端为何仍显示 alpha.2”，也不覆盖 alpha.2 之后桌面侧 SSH 暂存/收据恢复路径；那属于其它任务。

## 5. 复现命令汇总

```bash
cd <repo>
git log --oneline --all | tail -5                      # 最早 2b6f4f7 = alpha.9
git show 2b6f4f7:desktop/package.json | grep version    # 0.6.0-alpha.9
git show 15b7c9e:desktop/package.json | grep version    # 0.6.0-alpha.15
git show b5de577:desktop/package.json | grep version    # 0.6.0-alpha.35
git show 2b6f4f7:desktop/electron/machine-daemon.cjs | grep -n "const methods = \|methods.has\|daemon.receiptRead\|daemon.lock\|SIGTERM"
git show 15b7c9e:desktop/electron/machine-daemon.cjs | grep -n "daemon.quiesce\|daemon.shutdown\|daemon.releaseMaintenance"
git show b5de577:desktop/electron/machine-daemon.cjs | grep -n "daemon.quiesce\|methods.has\|SIGTERM"
sha256sum desktop/electron/remote-maintenance.cjs      # bd5221e1… == alpha.15/alpha.35 清单条目
grep -n "controller:staged.release" desktop/electron/ssh-host.cjs
```
