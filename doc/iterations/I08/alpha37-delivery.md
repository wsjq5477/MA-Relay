# alpha.37 本地候选交付（维护离线恢复 + 切片 A）

日期：2026-10-21。用户要求“正式包，用于我验证”。本轮在 `0.6.0-alpha.36` 基础上 bump 到 **0.6.0-alpha.37** 并构建 Windows x64 便携 EXE，产物留在本地，**未创建/推送提交、标签或 GitHub 发布**，未改动用户运行中的 profile/原生配置，也未覆盖已公开的 alpha.36 EXE。

## 交付范围

公开 alpha.36（标签冻结 `1fef25f`）之后的两批修复，均由本轮整合进同一份工作源码：

1. **维护被拒后的离线恢复与旧后台维护兼容**：升级/回滚被拒但原后台仍在运行或已恢复（含早于持久收据端点的旧后台）时不再把机器留置为已断开；维护收据新增 `stopped/phase`；停机未确认的恢复保持 `unknown`，由原 operationId 查询恢复；遗留维护屏障在下一次维护前自愈。见[维护离线恢复专项](maintenance-offline/maintenance-offline.md)、[用户恢复步骤](maintenance-offline/recovery.md)、[旧后台能力清单](maintenance-offline/old-daemon-capabilities.md)。
2. **切片 A：维护未决行回收与维护进度可见**：未决维护行在其记录的执行进程已消失或从未记录（超过 60 秒宽限期）时，原 operationId 查询会派生恢复并收敛为终态；“后台维护”对话框显示上传/解包/校验进度与未决/终态文案，未决期间按 1s/2s/4s/8s 有界自动核对原操作，机器卡片同步显示进度。见[维护未决行回收与进度可见](maintenance-offline/maintenance-visibility.md)。

两批修复都不改变协议版本、daemon 身份、收据/Task/Session ID 与文件格式；轮询完全在客户端。切片 A 明确保留“未决收据不能换 ID 重做”的既有保护。

版本元数据只改 `desktop/package.json` 与 `desktop/package-lock.json`（`0.6.0-alpha.36` → `0.6.0-alpha.37`）；根 `package.json` 保持 `0.1.0` 不动。

## 新增 alpha.36 兼容 pin

当前仍有机器运行 alpha.36 后台。alpha.37 客户端若缺少对应 pin，会以 `SSH_DAEMON_UPGRADE_REQUIRED` 拒绝该后台，因此本轮新增 `desktop/compatible-daemons/0.6.0-alpha.36.json`：

- **来源**：从[已公开发布的 alpha.36 EXE](../../../desktop/release/AgentBridge-0.6.0-alpha.36-Windows-x64.exe)（130032973 字节、SHA-256 `43e09dd34e1a86998a446048dd39279a91356189d132c1eae9facebec1472798`）内提取的 `linux-package/manifest.json` **原样拷贝**，不由当前工作区推断。
- **逐文件校验**：已对该清单内的 **1458 个文件**逐项核对 sha256，全部匹配。
- **摘要**：pin 的 `manifestDigest` = **`4f14b5f5b1dc72ca95557ac352bfc669474e4276c98887b286cb2fa5029d8a1e`**，等于已公开 alpha.36 包报告的 `linuxManifestDigest`（见 [alpha.36 包报告](../../../artifacts/alpha36/2026-10-21/package.json)）。
- **口径说明**：该摘要是 `sha256(JSON.stringify(manifest))`（[ssh-install.cjs](../../../desktop/electron/ssh-install.cjs) 的清单摘要算法），不是 pin 文件的字节 sha256。pin 文件本身的字节 sha256 为 `280420793c37064eb0df59aeac17387822fbbe88f9ae2a130a1e7dfcb156731b`，两者不可混用。
- **落包核对**：alpha.37 包内 `linux-package/manifest.json`（版本 `0.6.0-alpha.37`、1459 个文件、摘要 `3fff4ab392c513f629299f1af01bbf038d2d4025c628f368bbb9e98eed3c7678`）的 `compatibleDaemons` 索引共 **31 条**，含新条目 `{"version":"0.6.0-alpha.36","manifestPath":"compatible-daemons/0.6.0-alpha.36.json","manifestDigest":"4f14b5f5…"}`；包内该 pin 文件解析后版本 `0.6.0-alpha.36`、1458 个文件，摘要与声明一致。

收录 pin 只让客户端识别并复用已安装的 alpha.36 后台，不安装旧清单，也不自动升级远端 daemon；远端升级仍须用户单独发起。

## 打包与校验命令

```bash
npm run build
cd desktop && npm run build && npm run dist:win   # stage-bridge → electron-builder portable → verify-package --portable
```

包校验报告：[artifacts/package-check/0.6.0-alpha.37/package.json](../../../artifacts/package-check/0.6.0-alpha.37/package.json)（`status: passed`）；本次两个 EXE 的大小与 SHA-256 并列于 [hashes.txt](../../../artifacts/alpha37/verify/hashes.txt)。

## 产物指纹

| 产物 | 字节 | SHA-256 |
| --- | --- | --- |
| [AgentBridge-0.6.0-alpha.37-Windows-x64.exe](../../../desktop/release/AgentBridge-0.6.0-alpha.37-Windows-x64.exe)（本轮本地候选） | **130034719** | **`76e30b1ee89f90a36c1e254d5981a0d543ab1c0ffebe622b7e1d0c11e104286c`** |
| [AgentBridge-0.6.0-alpha.36-Windows-x64.exe](../../../desktop/release/AgentBridge-0.6.0-alpha.36-Windows-x64.exe)（已公开，未改动） | 130032973 | `43e09dd34e1a86998a446048dd39279a91356189d132c1eae9facebec1472798` |

指纹取自上述包校验报告，并已用 `sha256sum` 独立复核一致。包结构：48 个后台 CJS、81 个核心文件、1459 个 Linux 资源；核心 dist、窗口 ASAR 与生产前端、Linux 后台均与源码一致（`coreBuildMatches`、`appAsarSourceMatches`、`frontendMatches`、`linuxBackendMatches` 全为 true）。该 EXE **未签名**（沿用 `signExecutable=false`）。

## 测试证据

2026-10-21，WSL Linux / Node v22.23.1；受控测试不调用真实模型、不切换用户 profile。以下为 alpha.37 候选对应的实测记录：

| 检查 | 实际结果 | 原始证据 |
| --- | --- | --- |
| 维护/SSH 专项五文件 | 39/39（daemon-maintenance 13、ssh-recovery-integration 8、daemon-rejection-ssh、ssh-security、ssh-progress-persistence） | [切片 A 记录](maintenance-offline/maintenance-visibility.md)、[独立验证报告](../../../artifacts/maintenance-offline/verify-a/verify-report.md) |
| 切片 A 界面用例（真实 chromium） | 3/3 通过，`status: passed`、页面错误 0、模型调用 0；实测自动查询时刻 4ms / 1004ms / 3004ms，退避符合 1s/2s | [界面报告](../../../artifacts/ui-maintenance-progress/2026-10-21/report.json) |
| 全量桌面 `node --test --test-concurrency=1 tests/*.test.cjs` | **684/684 通过、0 失败**（alpha.37 构建后重跑，测试文件指纹随日志一同记录）。构建前同一命令为 682 项 679 通过、3 失败；独立验证复现其根因是**测试未隔离 `DSH_HOME`**（`dsh-connection.discover()` 在进程环境带 `DSH_HOME` 时注入额外条目），同日由测试侧修复——只改测试文件、不进包，与包内改动无关 | [回归日志](../../../artifacts/alpha37/regression-full-suite.log)（sha256 `199c2f7a…`）、[测试文件指纹](../../../artifacts/alpha37/regression-test-fingerprints.txt) |
| 包构建与分层校验 | `status: passed`；48 CJS / 81 core / 1459 Linux 资源，核心、ASAR、前端与 Linux 后台全部匹配 | [包报告](../../../artifacts/package-check/0.6.0-alpha.37/package.json) |
| 文档检查 `node scripts/check-docs.mjs` | errors 0 | 见下方“交付时检查” |
| 文档站测试 `npm run docs:test` | 6/6 | 见下方“交付时检查” |

### 交付时检查

- `node scripts/check-docs.mjs`：errors **0**（217 篇 Markdown、14 组设计/报告、4595 条本地链接、90 张图、436 项用例）。
- `npm run docs:test`：**6/6** 通过（`tests 6 / pass 6 / fail 0`）。

浏览器为工作区内 Playwright chromium headless shell `156.0.8078.4`（本机无 Edge），渲染的是真实 Vite 生产前端产物与合成 IPC，不是打包 EXE 窗口。

## 未测边界

1. **没有在 Windows 真机运行该 EXE**：本轮只做本机打包与包内校验，没有在 Windows 上启动 alpha.37 窗口或普通 EXE 流程。
2. **未签名**：沿现有 `signExecutable=false` 构建，无代码签名。
3. **无真实用户远端**：远端行为由真实本机 daemon + 真实维护 worker 夹具覆盖，没有对用户独立服务器做维护升级。
4. **windows-\*.cjs Edge 套件本机未跑**：`tests/windows-*.cjs` 依赖 `channel:'msedge'`，本机无该浏览器；新增轮询会在未决期间额外调用 `machine.operation`，需要在 Windows 端确认既有 fixture 的调用计数断言。
5. **未公开 GitHub**：本轮未创建/推送提交或标签，未发布 Release；公开基线仍是 alpha.36（标签 `1fef25f`）。
6. **I06C/I07C 整体准出不变**：完整 I06C/I07C 仍未准出；未调用真实模型、未验证用户故障 profile 与独立 SSH。
7. 切片 A 自身保留的未测项（模态框遮挡像素级验证、多意图并存/切换目录/卸载竞态、无负缓存时 unknown 可能不收敛、桌面重启后本地台账丢失时的文案）详见[切片 A 记录的未测边界](maintenance-offline/maintenance-visibility.md)。

## 与既有记录的关系

- 公开 alpha.36 的交付事实（标签 `1fef25f`、EXE 130032973 字节 / `43e09dd3…`、附件公开与匿名下载核验）见 [alpha.36 交付记录](../I07/alpha36-delivery.md)，本轮**未改动**该 EXE、标签或附件，也未改写其记录。
- 本轮只新增本地候选；在完成 Windows 真机验证与公开分发前，不应把 alpha.37 表述为已发布版本。
