# alpha.72：当前互联核心、ChatGPT Web 与接入界面预发布

2026-11-03。用户明确要求将当前代码及最新EXE发布GitHub。本次从保留原工作区的独立发布分支冻结源码fd450ce42c2f3155161553396037e04356eeec98，版本0.6.0-alpha.72；[GitHub预发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.72)现已公开。旧alpha.71标签、EXE与SHA不动，完整开发目标仍暂停且未完成。

## 内容与升级

收录当前Agent互联核心：独立登记、固定端点、调用方主体/上下文/凭据、原结果/事件及原delegationId恢复；TeamSpace/TeamAutomation保留兼容、暂停扩张。包含ChatGPT-only Web开发扩展及接入配置界面整理、OpenCode检查与协议并发修复。继承原生账号/模型，不新增智能Router、模型API或Worker Runtime，不扩大递归委派。

升级前在旧窗口“设置 → 后台运行 → 停止后台并退出”，再启动新EXE；原身份、配置、历史和unknown保留。兼容清单51份，新增的仅是从原公开alpha.71实际EXE提取、以原整包SHA核验的精确manifest，不自动信任未知版本。Browser扩展需手动解压到固定目录、在浏览器开发者模式加载并明确配对/授权；不自动安装、不含Kimi Driver。可选Start-NonC-Isolated.cmd使用同目录新配置，不迁移用户旧profile。

## 冻结产物与对应关系

EXE 132441715字节；SHA-256 f2c8fe49fe655e6cfa4bca19721b663377e101fe719cfbee31738cb8b2bce4c3，未签名。277项产品输入与冻结Git内容一致（按既有Git文本过滤比较），原工作区产品输入除发布版本与精确旧pin外无漂移。73后台模块、87个Core文件、1746个Linux文件、19文件扩展、ASAR/ws/前端/bootstrap均核对；实际EXE解出3516文件的集合/大小/SHA逐项匹配。后续测试夹具/发布文档提交不移动冻结标签或改变该EXE。

[源码绑定](../../../artifacts/release-alpha72/2026-11-03/source-binding.json)、[实际包核验](../../../artifacts/release-alpha72/2026-11-03/package-check.json)、[实际EXE载荷](../../../artifacts/release-alpha72/2026-11-03/payload-check.json)、[原工作区核对](../../../artifacts/release-alpha72/2026-11-03/original-source-currentness.json)、[alpha.71精确pin来源](../../../artifacts/release-alpha72/2026-11-03/alpha71-pin-proof.json)。

## 实际验证与失败保留

| 层级 | 实际结果与限制 |
| --- | --- |
| 工程构建 | Windows Node24.12.0根类型/lint/Core构建、桌面类型/Vite构建通过；有既有大chunk提示，不作性能准出 |
| Windows源码全量 | Core首轮87项74通过/2失败/11跳过；桌面首轮1276项1219通过/11失败/46跳过。包含测试清理早于所属进程退出、旧图标断言、快照缺根依赖；原结果保留。图标5/5、Claude/Codex宿主23/23复验通过，SSH夹具模块已补齐且Windows不支持场景按平台跳过。不是单次完整Windows全绿 |
| Windows I01 | 后续原时序复验与30秒受控Mock窗口分开记录；最后整项超过300秒测试预算，未完成Windows I01全验。没有把该超时记为原生Task终态或以Linux成功覆盖Windows结果 |
| 包内运行时 | 实际EXE的Electron44.7.0/Node24.21.0，实际交付模块/依赖及ZIP；八文件136例首轮134通过/2项清理失败，同一实际运行时完整Broker文件3/3复验覆盖这两项。不是单次136/136；测试驱动agent-directory.cjs来自源码、被测生产后端来自EXE，无真实模型/GUI |
| 普通portable | 原120秒观察失败后保留同一原进程，没有重启冒充成功；约276178ms后实际窗口/认证Coordinator出现。实际窗口程序与EXE载荷一致；合成SQLite登记读写、原任务不变、正常关窗、包装器及所属后台退出通过。未重跑完整portable重启或用户真实profile，不作性能准出 |
| 独立Ubuntu24.04 CI | [41646383309](https://github.com/wsjq5477/MA-Relay/actions/runs/41646383309)冻结源码fd450ce完成success：Core87/87、适配111/111、关系/SSH98/98、维护/替换105/105；各组共享用例不相加。官方Hermes0.22.5原生MCP五组通过，模型0。更早CI因维护夹具漏带Browser依赖失败，补齐夹具后通过，产品运行代码未为此改变 |

[Windows分层结果](../../../artifacts/release-alpha72/2026-11-03/windows-source-checks.json)、[包内逐文件复验](../../../artifacts/release-alpha72/2026-11-03/runtime-check.json)、[原进程普通启动/关闭](../../../artifacts/release-alpha72/2026-11-03/portable-observed.json)、[独立CI摘要](../../../artifacts/release-alpha72/2026-11-03/ci-summary.json)。原始本地TAP/失败、源码快照与私有测试状态留在D盘，公开仅选择脱敏报告，不上传用户配置/凭据或开发缓存。

源码真实Windows主/WSL Codex从的正文/原Session续聊/在途恢复及撤权证据见[互联台账第17节](interconnect-development.md#17-原生登录恢复后的真实调用与模型退役门禁)，不冒充当前EXE重新跑过真实模型。生产SSH、完整适配器/跨机/已有服务升级链、真实用户profile与性能继续未准出。既有依赖high1历史风险未在本轮重新审计。

## 公开发布

源码标签v0.6.0-alpha.72冻结fd450ce42c2f3155161553396037e04356eeec98，发布分支codex/release-alpha72，master收录后续文档与夹具修正。EXE、扩展ZIP/manifest/SHA、隔离启动脚本、说明、VERIFICATION.json及SHA256SUMS共8份附件已公开；8份均匿名完整HTTP200下载、大小及SHA与本地一致。一次说明/脚本上传网络中断后，沿同Release/同文件名核对补齐，没有改EXE或重建Release。

[匿名完整下载与标签核对](../../../artifacts/release-alpha72/2026-11-03/github-download.json)。本轮所有源码、依赖、临时目录、缓存、构建、测试数据及日志均在D/E；无产品接口/持久格式新变化，architecture/data-model/protocol仅同步发布状态。M10-F01/F03/F05、AB-F03/F07/F08/F10/F11及已有互联功能编号不变。

首次公开转换曾保留GitHub草稿临时untagged标签；随后在同一Release明确创建v0.6.0-alpha.72→冻结提交并修正标签，清理仅本次产生且指向同提交的临时tag，旧发布标签不动。附件原字节不变，最终匿名下载和正式标签再次核对通过。

## 文档检查与公开材料边界

实际执行 node scripts/check-docs.mjs：原工作树312份Markdown，2243项/2185种历史缺失引用，与发布前逐项新增0/消除0；公开源码310份Markdown，3060项/2989种，检查均退出1。公开源码较本机新增的806种缺失中，800种指向未纳入Git的本地历史artifacts，6种指向用户todo参考材料；未为通过检查上传私有状态或伪造历史证据。新发布的11份脱敏证明单独入库，不表示旧证据已公开齐全。[按环境统计](../../../artifacts/release-alpha72/2026-11-03/docs-check-summary.json)。
