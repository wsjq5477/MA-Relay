# alpha.71：维护只读入口与明确确认替换

日期：2026-10-29（Asia/Hong_Kong）。源码冻结1b2e3717151873fdb006d2b476e6b14e1fda8bbb；[GitHub预发布](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.71)已公开，EXE与SHA附件匿名完整下载匹配。alpha.70标签和EXE保留。

## 行为与升级

机器清单、关系图中的SSH“后台维护”为只读入口；离线、认证失败、任务忙、unknown或维护能力不足时仍可打开查看原因。实际写入继续受门禁限制。弹窗提供重新检查、查看后台/待核对操作；只有原maintainDaemon未确认才显示原维护查询，不把节点/执行unknown称为维护已发送。

包含#29明确确认替换：未登记后台不自动信任，用户可在空闲且无未确认任务/收据时勾选确认换成客户端配套的可信后台；原身份、历史、旧目录和原操作保持，失败不自动执行未校验旧代码。详细需求与原失败见[入口收尾](issue29-maintenance-entry.md)和[替换状态机](issue29-explicit-daemon-replacement.md)。

升级前在旧窗口“设置 → 后台运行 → 停止后台并退出”，再打开新EXE；新窗口遇旧中央缺新能力会给出具体提示。无需删除连接、凭据、known_hosts、任务或unknown。

## 冻结包

EXE132300845字节，SHA-256 94a928b5a1bf894870b1c2e8ed9d18cecbe81588899bf99ea757c7da928c4e85；未签名。226项产品输入与冻结源码匹配，60后台/84Core/1729Linux及实际EXE3406资源逐项一致。50份兼容pin，仅新增已公开alpha.70的精确原manifest；从其原EXE完整摘要和1728文件验证后提取，未知后缀自动信任增加0。

[包核验](../../../artifacts/issue29-entry/2026-10-29/package-check.json)、[实际EXE](../../../artifacts/issue29-entry/2026-10-29/exe-resources.json)、[源码绑定](../../../artifacts/issue29-entry/2026-10-29/source-binding.json)、[上一公开版本pin来源](../../../artifacts/issue29-entry/2026-10-29/alpha70-pin-proof.json)。

## 实际验证

| 层级 | 结果与限制 |
| --- | --- |
| Windows源码 | 定向112/112，扩展148项147通过/1平台跳过；根类型、lint、前端/Core构建和用户文档6/6通过。不是完整桌面重跑 |
| 包内兼容 | [26/26](../../../artifacts/issue29-entry/2026-10-29/windows-contract.json)，50份pin一致、原安装摘要/路径/身份拒绝与完整维护大输入检查通过；首次相对路径调用验收器未通过，改为完整路径后通过，产品未改 |
| 实际包内UI | [报告](../../../artifacts/issue29-entry/2026-10-29/packaged-ssh-ui.json)：真实包内EXE/ASAR/中央和回环TCP SSH/SFTP，当前probe/版本拒绝、保留原unknown时维护窗口可开、写操作窗内受限、设置原操作入口可达。4次probe，远端写入及非probe命令0，pageErrors0；[截图](../../../artifacts/issue29-entry/2026-10-29/packaged-unknown-entry.png)只含合成内容 |
| 普通无调试portable | [启动](../../../artifacts/issue29-entry/2026-10-29/portable.json)确认版本71及维护能力；200037ms不作性能准出。首次验收器只停后台、未正常关窗，包装进程由验收器结束；另按所属合成profile、已认证后台及父进程严格绑定窗口，[正常关窗及后台停止](../../../artifacts/issue29-entry/2026-10-29/portable-close.json)通过，不冒充首轮包装器正常退出 |
| 独立Ubuntu24.04 CI | [运行40888503242](https://github.com/wsjq5477/MA-Relay/actions/runs/40888503242)完成成功；Core79/79、原生适配111/111、关系/SSH98/98、替换/入口105/105；官方Hermes0.22.5原生MCP五组通过，模型0。各组共享用例不相加 |
| 文档 | 原2243项历史缺失，最终错误集合增删0；不声明完整文档全通过 |

实际包内UI首轮夹具本来含原unknown，验收器错误尝试点击被正确禁用的替换按钮；改为验证窗口可开且写入保持禁止后通过。首轮包被构建工具缓存EXDEV拒绝，改用本轮独立缓存及已下载工具后完成，未修改产品源码绕过错误。早期失败保留在本轮原始材料。

## 交付边界

本轮真实用户profile写入0、生产远端替换0、模型0。受控真实SSH协议与独立CI不等于用户原机器已替换；完整I06C/I07C/MCP02、真实父模型/取消、完整故障矩阵与性能仍未准出。历史Windows全量1个DSH竞态失败/41平台跳过、依赖high1、文档2243缺失及未签名保留。

## 公开分发

[Windows EXE](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.71/AgentBridge-0.6.0-alpha.71-Windows-x64.exe)与[SHA256SUMS.txt](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.71/SHA256SUMS.txt)均已公开；[匿名完整下载报告](../../../artifacts/issue29-entry/2026-10-29/github-download.json)两项HTTP200，与本地字节及摘要一致。源码标签冻结1b2e371，master含后续文档，不移动冻结标签。
