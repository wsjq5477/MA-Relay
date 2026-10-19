# I07C：真实原生执行成员的自动交付与复核

日期：2026-10-18。alpha.28 后未发布源码工作区；首次真实运行北京时间22:24开始，完成后只读恢复重查。继承当前原生 Claude 账号和模型，不新增模型 API、不覆盖模型、不升级用户后台。本片补齐[首批持续协调](automation.md)缺少的真实执行成员证据之一，完整 I07C/I06C 仍未准出。

## 1. 验收目标与开发

原首批证据只有主协调为真实 Claude，开发员/编译员为受控 MCP。本次使用三个可独立寻址的 MachineHost 和 Bridge 私有目录，分别由实际发现的 Claude Code2.1.302 承担主协调、开发员、复核员。它们运行在同一 WSL、共享既有原生账号配置，机器路由为受控注入；不冒充独立 SSH、物理机器或三个独立账号，也不把同一节点改名绕过占用。

新增[真实验收脚本](../../../desktop/tests/linux-i07c-native-members.cjs)和[安全/恢复契约](../../../desktop/tests/native-members-harness.test.cjs)。使用生产 Coordinator、TeamSpace、AgentNetwork、MachineHost、ClaudeHost、真实 CLI/worker 和小队 MCP。开发员计算一份小型 JSON 产物并通过公共文档交付；复核员实际读取其精确文档修订、独立复算并提交复核文档。主协调只负责协调/验收，不接管执行任务。此场景验证原生协作与版本/终态边界，不包含代码编译或返修。

仅启用8次/12分钟累计预算，定时空闲事件120分钟，本次没有手动 team.execute。三个工作目录分别设置原生内建文件/Bash/网络/子代理等工具 deny；只使用本轮受限 Bridge MCP，不批准任何原生权限。最终审计 worker job 未带模型覆盖、没有非 Bridge 工具调用或权限回复。公共结果由实际模型产生，脚本没有固定回复或受控执行成员。

固定私有 checkpoint 在写控制前保存原参数与 operationId；准备后未确认不补发。原请求短暂无收据或 unknown 时继续有界查询同 ID，不替换请求或节点。默认不带参数只打印计划；首次显式 `--run` 才执行，已有 checkpoint 的重复 `--run` 自动转只读。`--continue` 仅在校验原启用收据、原策略代次/预算/成员和已有工作后恢复事件引擎，不重放 setup 或旧原生任务。8项受控安全契约已包含全桌面474项。

## 2. 实际结果

环境：WSL Linux / Node22.23.1 / 真实 Claude Code2.1.302；同宿主受控机器路由，真实原生模型与 MCP，非合成回复。实际五组检查全部通过：

| 检查 | 实际结果 |
| --- | --- |
| 独立接入与原生身份 | 三个独立 Bridge 宿主/目录均通过生产发现选中原 Claude；三个不同原生 Session，公开报告不复制身份 |
| 真实开发与复核成员 | 开发员一次真实自动回合创建公共 JSON 交付，复核员一次真实自动回合读取精确修订并独立复算；各一份报告、两份公共文档 |
| 原会话持续协调 | 主协调三次真实自动激活沿同一 Conversation/原生 Session；总计五次，手动启动0；各角色实际原生历史均观察到模型，job模型覆盖0 |
| 成员终态与业务验收 | 开发员/复核员实际 succeeded 后，主协调才验收复核、再验收交付；公共报告不直接完成工作 |
| 总验收与恢复 | 总验收 MCP 收据为 awaiting_leader_terminal/accepted=false；主协调本轮实际 succeeded 后工作才 completed。重开观察只查原记录，仍五次激活，没有新轮次/权限命令/非Bridge工具 |

主协调实际调用小队工具22次、开发员7次、复核员6次。共观察到4次短暂无收据 NOT_FOUND，脚本只查询原 requestId，未重放，最终全部恢复。五次原生回合与五组验收检查分别统计，不相加为工程用例或更多模型调用。

[脱敏验证汇总](../../../artifacts/I07C-native-members/2026-10-18/verification-summary.json)链接首次[真实运行报告](../../../artifacts/I07C-native-members/2026-10-18/native-members-2026-10-18T14-24-57-883Z.json)及只读恢复报告；原始命令输出分别为[真实运行](../../../artifacts/native-integration/2026-10-18/native-members-run.log)、[观察重查](../../../artifacts/native-integration/2026-10-18/native-members-observe.log)。原生 Session、内部身份、MCP令牌、模型配置与完整原生记录只留在忽略提交的私有验收目录，公开材料不复制。

工程基线、源摘要与前置[准入/核对修复](native-integration-guards.md)共用：核心45/45、最终全桌面474/474、类型/lint/前端构建及文档检查。本片真实模型证据单列，不把受控夹具或 Windows 浏览器6组当成真实模型；也不重新构建或替换 alpha.28/poll.4 EXE。

## 3. 复现与未测边界

`node desktop/tests/linux-i07c-native-members.cjs` 默认仅计划；首次显式加 `--run` 会调用真实模型。完成后使用 `--observe` 只读恢复核对；已有未确认操作应保留原私有状态，不删除目录或换 ID 再做。

已验证的是同 WSL 三个真实原生角色的公共文档交付、独立复核、原会话协调及终态后验收。代码构建/编译/返修、独立 SSH 与产物可达性、真实 Windows 原生 EXE、其他适配器自动续接、复杂权限/故障与长时矩阵仍待验证。下一片沿已有 I07 范围补真实代码/编译交接及独立环境；本片不能放行完整 I07C/I06C。
