# alpha.64 构建、验收与发布

## 授权与源码范围

2026-10-27（Asia/Hong_Kong），用户确认已合并 PR #26 并明确授权构建、验收和发布。合并后的 master 为 `4c232fa0f553f807ec16da2802d4bea892bd331f`。本轮版本为 `0.6.0-alpha.64`，继承公开alpha.63，交付 [issue #25 修复](relation-revocation-scope.md)。关系撤权与设主的产品代码不再增加行为；本轮修改版本位、兼容清单、包校验路径和验收器。

已公开预发布 [v0.6.0-alpha.64](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.64)，标签固定 `c7282344e729b1d7a2a363ad6638b90dfa6e988a`，树 `fd5dba4db74b4c2ed414241db0f6aa1975d0c156`；后续master仅修正验收器等待就绪及同步发布说明，不移动标签或改变产品/EXE字节。未切换日常后台、未部署SSH、模型调用0。

## 产品与资源

- 同主缩小成员集合或清主清成员可独立撤权；被移除或保留节点离线、能力失效或管理未知不再反向阻断。新增成员与新主继续检查目标范围与能力。
- 关系自身未知、台账不可信、修订/原ID冲突与草稿持久化失败保留保护。布局失败与layout未知独立，设主不自动授权全部节点。
- 继承原包传递/接收收据、配置审计控制台、原生MCP与原ID恢复。接收声明不代表业务验收、模型理解或文件可达；撤权不取消既有任务。

已公开EXE：**132227581字节**，SHA-256 `86b8aad407400754d77012c9d873a19dd52a6576c59cc6c568a3f503705446dd`。当前包为58后台模块、84Core文件、1720Linux资源，Linux manifest digest `432ab8428a7859b268892e5e45c83352e791f517eca181a42a077cdccc6537ae`。[包校验](../../../artifacts/package-check/0.6.0-alpha.64/package.json)、[实际EXE载荷核对](../../../artifacts/alpha64-release/2026-10-27/exe-payload-check.json)。

新增alpha.63原daemon兼容pin。原公开EXE经匿名完整下载核对130203473字节和SHA后，提取原manifest，1715个文件逐项字节/摘要匹配；Linux Node22.23.1、owned-stop与许可证5项原字节复用，不重新编造Linux运行结果。[原包核对](../../../artifacts/alpha64-release/2026-10-27/alpha63-download.json)、[逐文件验证](../../../artifacts/alpha64-release/2026-10-27/alpha63-manifest-check.json)、[运行时来源](../../../artifacts/alpha64-release/2026-10-27/linux-runtime-provenance.json)。新pin只用于识别/复用对应旧后台，不安装旧清单或自动部署SSH。

构建过程的产品输入摘要保存在[构建清单](../../../artifacts/alpha64-release/2026-10-27/build-source-manifest.json)。普通EXE、Windows后台、ASAR及Linux资源均包含relation-admission.cjs；ASAR前端逐文件SHA与构建输出相同，实际EXE再次解包后的ASAR、1672个Windows bridge文件和1720个Linux文件均逐项核对，没有用解包目录代替EXE本体。

## 分层验收

环境为Windows、Node24.12.0、Electron44.7.0、electron-builder26.15.3、Edge157.0.4341.16。临时profile、受控机器、生产Coordinator/SQLite及认证管道，无真实模型/日常profile写入。

| 层级 | 实际结果与证据 |
| --- | --- |
| 源码定向 | 155/155；[日志](../../../artifacts/alpha64-release/2026-10-27/targeted-source.tap) |
| 包内撤权 | 14/14，直接加载冻结Windows后台；[日志](../../../artifacts/alpha64-release/2026-10-27/frozen-revocation.tap) |
| 包内关系/策略 | 37/37及实际认证管道/重启六组；[报告](../../../artifacts/alpha64-release/2026-10-27/frozen-relations.json) |
| 包内原包传递 | 14/14及实际认证管道、原收据、SQLite重开；58个后台SHA匹配；[报告](../../../artifacts/alpha64-release/2026-10-27/frozen-context.json) |
| 包内原收据 | 4/4及实际管道/中央重启三组；[报告](../../../artifacts/alpha64-release/2026-10-27/frozen-console.json) |
| 包内兼容 | 29/29，含原daemon信任与旧中央门禁；[日志](../../../artifacts/alpha64-release/2026-10-27/compatibility-final.tap) |
| 实际ASAR前端 | 关系撤权12组、配置审计控制台6组通过，pageErrors=0；[图报告](../../../artifacts/alpha64-release/2026-10-27/ui-final/report.json)、[控制台](../../../artifacts/alpha64-release/2026-10-27/console-ui-final/ui.json) |
| 普通EXE | 前五组通过后，第三轮窗口先于后台就绪导致验收器attach报ENOENT；修正等待逻辑，同一原profile补验完整中央重启/原收据及退出两组通过，合计七组事实。没有重建原关系/未知/历史；[原五组及就绪失败](../../../artifacts/alpha64-release/2026-10-27/portable-final.json)、[同profile补验](../../../artifacts/alpha64-release/2026-10-27/portable-verified.json) |
| 工程 | 根/桌面构建、根类型/lint通过；[构建](../../../artifacts/alpha64-release/2026-10-27/build.log)、[类型](../../../artifacts/alpha64-release/2026-10-27/core-typecheck.log)、[lint](../../../artifacts/alpha64-release/2026-10-27/lint.log) |

全量基线不改写：本日修复轮Windows桌面959项872通过/86失败/1跳过，Core71项53通过/18失败，所有当前失败名称在未修复基线复现；本轮仅版本/打包/验收器变更，不用历史Linux全绿充当今天结果。[完整原始日志与逐项比较](relation-revocation-scope.md)。WSL仍返回HCS_E_SERVICE_NOT_AVAILABLE，未运行本轮Linux全量、原生模型或独立SSH。

## 真实失败与构建处理

1. 初次默认工具缓存重命名报EXDEV；改用工作区缓存，并显式选择已校验的7-Zip工具，使用`--publish never`只构建。失败日志保留于[首次构建](../../../artifacts/alpha64-release/2026-10-27/build.log)、[缓存重试](../../../artifacts/alpha64-release/2026-10-27/builder-workspace-cache.log)、[最终构建](../../../artifacts/alpha64-release/2026-10-27/builder-final.log)。
2. 包校验器在Windows以多层正斜杠路径查询ASAR时误报PNG缺失。原图实际存在且摘要匹配；改为path.join后全包校验通过，产品/EXE未重打。属于无产品行为变更的校验器修正，不跳过图片检查。
3. ASAR前端准备脚本首次使用Windows盘符做ESM URL，前端尚未提取，浏览器收到404；修正file URL后重跑。控制台服务首次收到非规范斜杠前端根路径触发自身403保护，改为实际Windows绝对路径后六组通过。原失败[图报告](../../../artifacts/alpha64-release/2026-10-27/ui/report.json)、[控制台报告](../../../artifacts/alpha64-release/2026-10-27/console-ui/ui.json)保留。
4. 第一次普通EXE未在120秒预算内就绪，随后出现真实窗口。验收器先按原窗口身份关闭并显式停止原隔离后台，改为300秒观察预算重跑，首次失败不记通过。重跑前五组通过，第三轮新窗口已出现但后台管道未就绪，验收器因ENOENT过早退出；master修正为仅对ENOENT/ECONNREFUSED等待原后台就绪，原profile和已保存记录不重写，再显式停止/重启同一原后台并补验。[首次结果](../../../artifacts/alpha64-release/2026-10-27/portable.json)、[原实例清理](../../../artifacts/alpha64-release/2026-10-27/first-portable-cleanup.log)。解包/冷启动性能未准出，不把增加观察预算解释为性能修复。
5. 7-Zip直接识别EXE内嵌7z载荷并提示尾部SFX安装器数据；提取结果的全部文件再次按源文件/清单核对。未忽略任何文件摘要、缺失或大小不符。

## 发布与同步

旧alpha.63标签/附件保留。alpha.64源码、EXE与109字节SHA256SUMS已公开，两个附件均uploaded，服务端size/digest匹配，匿名HTTP200完整下载两个附件的全部字节/SHA匹配。[源提交](../../../artifacts/alpha64-release/2026-10-27/frozen-source.json)、[服务端附件](../../../artifacts/alpha64-release/2026-10-27/github-upload.json)、[公开状态](../../../artifacts/alpha64-release/2026-10-27/github-release.json)、[匿名完整下载](../../../artifacts/alpha64-release/2026-10-27/github-download.json)。GitHub插件只提供发布资源读取，附件写入使用本机已配置GitHub凭据的REST请求；凭据仅在内存中，不入文件、文档或日志。

新EXE必须先在旧窗口执行“设置 → 后台运行 → 停止后台并退出”再打开，才能启用本次后台修复。客户端不会自动替换日常已运行后台，也不会自动升级SSH。

同步M10完整设计与测试报告、M01/M03/M06/M08的交付状态、产品/架构/数据/协议与主文档当前版本；发布通告/逐轮细节集中在本迭代及发布登记。线协议、关系字段、revision与收据格式不变。未签名，父模型、图100ms、冷启动、WSL和完整I06C/I07C/MCP02继续未准出。

204个产品/依赖输入在构建后保持原SHA；唯一构建工具输入变更为ASAR验证器路径修正，不改运行字节。[输入对照](../../../artifacts/alpha64-release/2026-10-27/source-input-check.json)。本轮用户站18页/19HTML构建与边界审计通过；完整文档检查仍有2243条原基线历史证据缺失，新增错误0，详见[最终文档检查](../../../artifacts/alpha64-release/2026-10-27/docs-check-final.log)，逐项对照保留在本轮artifacts目录。

用户站最终构建18页/19HTML及实际发布边界审计通过，内部页面/证据导出0；本轮`docs:test`仍为5/6，与未修复基线同型失败，未将完整检查标为通过。[最终构建](../../../artifacts/alpha64-release/2026-10-27/docs-build-final.log)、[最终站点测试](../../../artifacts/alpha64-release/2026-10-27/docs-test-final.log)、[文档逐项对照](../../../artifacts/alpha64-release/2026-10-27/docs-comparison-final.json)。
