# OpenDesk Windows桌面原实例现场调试

日期：2026-10-22（Asia/Shanghai）。用户已安装桌面版并授权继续调试。关联AB-F02/F03/F07/F08、M01/M03/M06-F05/M07/M10；执行沿用[已有接口适配设计](../../modules/06-native-adapters/opendesk/design.md)，没有新增产品功能、修改协议或更改执行/恢复边界。

## 环境与范围

Windows已运行的OpenDesk Desktop，程序ProductVersion/FileVersion均为0.3.9；用户原生设备网关、账号、模型及有效工作目录。Bridge使用同一alpha.42候选：130084772字节，SHA-256 `9b822ee11848201dda14e67e8ffc92aff32ca9f3d96c1ecb016c7c01a37fd39a`，运行模块仍与10月21日冻结源码清单一致。未重新构建、不更新版本，不把历史自动测试当作今天重跑。

只在Bridge独立临时profile创建两个原生调试会话，各两轮，共4轮真实原生输入；现有用户会话仅通过列表只读查看，不复用、取消或删除。测试Prompt要求不调用工具、不读写文件。Bridge不覆盖模型/provider、不安装MCP配置、不修改OpenDesk源码或原生配置；没有调用新模型API层，也未部署SSH后台。OpenDesk源码仓库git状态仍干净。

## 实际结果

| 层级 | 场景 | 结果与证据 |
| --- | --- | --- |
| 原实例只读3组 | 读取现有网关设置与身份；WebSocket握手并核对网关身份；原会话列表及Bridge发现 | 3组通过，未提交原生输入；`desktop-probe.json` |
| 真实Host/worker5组 | 同ID返回原任务、改输入冲突；首轮真实回复；宿主关闭重建复用原连接；第二轮记住第一轮随机测试内容；只关闭自己的连接后旧结果仍可读且旧会话不可续聊 | 5组通过，两轮均succeeded，上下文核对true；`desktop-live.json` |
| 普通EXE完整链路5组 | 无调试参数开窗；生产Coordinator/MachineHost发现并接入桌面；真实回复及同ID去重；关闭重开窗口读取原结果且复用原后台；原会话续聊保留上下文 | 5组通过，两轮均succeeded，上下文核对true；`desktop-packaged-live.json` |

证据目录：`artifacts/opendesk-desktop-live/2026-10-22/`，`manifest.json`记录冻结包、源码一致性和本轮范围。报告不记录原生身份、请求ID、模型凭据或测试内容。私有执行计划保留在独立Windows临时目录，防止人工重复运行时换ID重发原请求。

可复现入口：[Windows普通EXE原实例验收脚本](../../../desktop/tests/windows-opendesk-desktop-live.cjs)。这是手动运行的真实模型验收，正常自动测试不会执行；同一输出私有计划已存在时拒绝再次运行，恢复只能查询原ID。脚本以独立profile运行指定EXE，自动关闭自己的测试窗口；全部原生任务确认成功后才停止自己的连接持有进程和测试后台，不停止OpenDesk或用户日常Bridge。原生测试会话与结果保留。

## 当前结论与未测项

alpha.42可以在此Windows用户环境通过已安装OpenDesk桌面网关完成真实执行和原会话续聊，Bridge窗口重开不丢上下文；无需改动或重装OpenDesk。本轮没有发现需修改运行代码的问题。既有架构、数据模型和协议已核对，无新增边界；仅增加现场验收脚本、证据和状态同步。

未测试：真实运行中取消的终态、真实模型失败/长任务断网、OpenDesk进程重启、原生MCP真实调用与被委派、WSL CLI真实模型、独立SSH。不能将本轮直接执行视为MCP或小队验收；原桌面连接断开后旧会话仍不可续聊，原取消ACK仍不能推定执行已取消。历史自动/协议检查仍按[10月21日记录](opendesk-existing-interfaces.md)计数，完整I06C/I07C未准出；候选未签名、未公开。

文档收尾：2026-10-22执行check-docs通过（226份Markdown、15组设计/报告、4736本地链接、94 Mermaid、446用例，errors0），文档工具6/6、用户站18页/19HTML/158资源审计通过，无内部材料导出。手动现场脚本语法检查及两仓库状态核对通过；未为无运行代码变更重跑历史核心/桌面全套。

## 日常窗口未显示OpenDesk的现场排查

2026-10-22用户反馈机器页看不到OpenDesk。核对实际日常进程与ASAR元数据：窗口为alpha.42，复用的中央后台仍是alpha.37；日常后台尚无OpenDesk节点。前述成功验收使用独立profile，并未替换日常中央后台，因此不能把独立验收等同于已完成日常版本切换。

只读查询原任务确认WSL Claude仍为running。用户明确选择等待当前任务结束后再切换，未停止、取消或重发原任务。已在本聊天安排静默检查：只有原任务及其他当前任务确认结束、无未决执行/管理条件后，正常关闭旧中央后台，让当前窗口启动同一profile的新后台，再重新扫描Windows并核对OpenDesk显示。原ID仅保存在Windows私有计划，不写入文档或报告。随后按以下实际核对结果完成切换。


2026-10-22 09:21（Asia/Shanghai）完成日常后台切换。发送关闭前按私有计划查询原task/request，均为succeeded且身份匹配；全部当前任务已确认终态，未决执行与管理操作均为0。再次核对窗口alpha.42、后台alpha.37后，仅发送一次既有Coordinator shutdown；原窗口自动在同一profile启动alpha.42后台，无强杀、无重发Prompt、无取消和SSH升级。

切换后按原ID核对任务、原生绑定和结果摘要均保持一致；原机器与保存的协作授权保持一致。生产discover及snapshot已在原Windows机器列出健康的OpenDesk Desktop节点；`connected:false`表示该发现节点尚未点击接入，不把发现成功写成已接入或新一轮模型执行。没有通过像素截图核验窗口渲染。原始脱敏证据：上述证据目录中的`daily-pre-switch.json`与`daily-switch.json`。本轮新增Prompt/取消均为0；alpha.42 EXE及运行源码未变。
