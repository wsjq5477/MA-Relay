# Windows 原请求被未完成上下文遮挡的恢复修复

日期：2026-10-17。源码/本地候选 **0.6.0-alpha.25**；GitHub 预发布保持 **alpha.24**。关联 AB-F08/F10/F11、M02-F04、M03-F04/F05、M06-F01、M07-F06/F07、M10-F01/F03/F05。完整 I07C/I06C 仍未准出，不更新用户机器或 GitHub 附件。

## 需求与复现

用户在另一台 Windows 电脑的 alpha.24 提交任务后看到一个未确认操作，查询原因 NOT_CONFIGURED；停止后台并退出、重开仍出现。本次无法直接访问用户故障 profile，因此以下隔离复现不能代替用户机器验收。

[MachineHost](../../../desktop/electron/machine-host.cjs) 创建上下文时先持久化 node-contexts.json，再连接原生后端并保存 agentId。准备失败可留下没有 agentId 的合法中间记录。原请求查询只带 requestId，不带 agentId；原代码按 r.agentId===params.agentId 查找，把两个 undefined 当成匹配，直接调用该未完成上下文。未配置的 OpenCode 上下文因而返回 NOT_CONFIGURED，遮挡后面已有的 Claude/Codex/OpenCode 原请求收据。重新打开仍读取相同记录，重启无法解决。

按 task/Conversation 反查后端的第二处比较也存在相同问题：找不到 owner 时，不能用 owner?.targetAgent 的 undefined 匹配未完成记录。

| 要求 | 修复后行为 |
| --- | --- |
| R01 有效身份才能直达 | 只有非空白字符串 agentId 才尝试按 Agent 定位上下文；两侧缺 ID 不构成归属证据 |
| R02 查询原请求 | 没有显式 Agent 的 request 查询仍按原逻辑只读搜索 legacy 和已分配 Agent 的上下文 |
| R03 原归属完整才路由控制 | 找到 task/Conversation 的非空 targetAgent 才路由到其上下文，未知归属不能被未完成行截获 |
| R04 保留未知保护 | 有原身份匹配收据才确认；缺收据依然 unknown，不删除台账、不改 ID、不重发任务或控制 |
| R05 可交付程序 | 独立 alpha.25 候选 EXE，包含先前未发布的不完整任务回应保护；保留 alpha.24 冻结包与历史证据 |

## 实现及兼容

只修改 MachineHost 的两处上下文身份选择条件；保留准备失败的上下文，之后仍可按原流程修复配置或继续完成连接。原机器、节点、任务、会话和原生身份不变化。未改变跨进程分层、数据格式、协议、查询参数或对外错误码，architecture/data-model/protocol 无需迁移。当前 NOT_CONFIGURED 仍可表示真实配置问题，不能将所有同码错误自动清除。

同次同步整体设计与 M02/M03/M06/M07/M10 的设计、测试报告和迭代入口。[新用例](../../../desktop/tests/machine-host-routing.test.cjs) 从磁盘重开未完成与有效上下文，检查原请求恢复、缺收据、未知控制归属及显式正确归属；[Windows契约入口](../../../desktop/tests/windows-context-recovery-contract.cjs) 直接运行，绕过 Node --test 的 UNC 文件发现限制；[普通EXE脚本](../../../desktop/tests/windows-context-recovery-portable.cjs) 使用独立合成 profile、真实 Coordinator/MachineHost/CodexHost，原生 CLI 不启动。

## 实际验证

WSL Ubuntu / Node22.23.1；Windows 契约 Node24.19.0；模型 Prompt 为 0。

| 范围 | 实际结果 | 原始证据 |
| --- | --- | --- |
| 修复前反例 | 4项全部失败，原收据被遮挡并出现 NOT_CONFIGURED | [修复前详细TAP](../../../artifacts/windows-context-recovery/2026-10-17/before-detail.tap) |
| 路由/就绪/原台账/节点专项 | 48/48通过，含原请求只读恢复及缺回执保持unknown | [专项TAP](../../../artifacts/windows-context-recovery/2026-10-17/targeted.tap) |
| 桌面完整回归 | 243/243通过，0失败/跳过，串行且各文件独立进程 | [完整TAP](../../../artifacts/windows-context-recovery/2026-10-17/desktop-tests-full.tap) |
| alpha.24原普通EXE对照 | 3组通过：复现有原回执仍NOT_CONFIGURED、普通关闭重开、完整后台重启均保留错误，模型0 | [原版对照](../../../artifacts/windows-context-recovery/2026-10-17/portable-baseline.json)、[日志](../../../artifacts/windows-context-recovery/2026-10-17/portable-baseline.log) |
| alpha.25候选普通EXE | 4组通过：原回执恢复/缺收据unknown、关闭重开、完整后台重启无重放、冻结MachineHost与源码一致 | [候选报告](../../../artifacts/windows-context-recovery/2026-10-17/portable-candidate.json)、[日志](../../../artifacts/windows-context-recovery/2026-10-17/portable-candidate.log) |
| Windows 契约 | 17/17通过，真实Windows Node/隔离记录/受控后端 | [Windows日志](../../../artifacts/windows-context-recovery/2026-10-17/windows-contract-final.tap) |
| 核心回归 | 45/45通过，0失败/跳过 | [核心测试](../../../artifacts/windows-context-recovery/2026-10-17/root-tests.log) |
| lint/根类型检查 | 通过 | [lint](../../../artifacts/windows-context-recovery/2026-10-17/lint.log)、[类型](../../../artifacts/windows-context-recovery/2026-10-17/typecheck.log) |
| 核心构建/前端类型与构建 | 通过；保留Vite既有体积提示 | [核心](../../../artifacts/windows-context-recovery/2026-10-17/root-build.log)、[前端](../../../artifacts/windows-context-recovery/2026-10-17/desktop-build.log) |

首轮默认沙箱执行全量时阻止受控原生夹具进程，保留[受限日志](../../../artifacts/windows-context-recovery/2026-10-17/desktop-tests.tap)，终止该轮后使用允许本地进程和socket的环境完成上述243项。首次打包在编译owned-stop时遭spawnSync cc EPERM，保留[首次日志](../../../artifacts/windows-context-recovery/2026-10-17/package-build.log)。Windows --test 直接接收UNC文件列表未能发现文件，两次失败日志保留于同证据目录；改为直接加载用例的入口后17项通过，不修改产品逻辑绕过测试。

文档结构与本地链接检查通过，见[检查结果](../../../artifacts/windows-context-recovery/2026-10-17/docs-check.json)。本次未新增图表；未将该检查计作产品验收。

## 程序与未测边界

[alpha.25 Windows x64 EXE](../../../desktop/release/AgentBridge-0.6.0-alpha.25-Windows-x64.exe)，**129,878,170 bytes**；SHA-256 `5cb6913203d1cd8b6fe1e18142cccfd344619c3261bbdb3cb013313d078e7156`，见[SHA256SUMS.txt](../../../artifacts/windows-context-recovery/2026-10-17/SHA256SUMS.txt)。仅为本地修复候选，未提交/发布GitHub。

包内33个后台CJS、78个核心文件、1390个Linux清单条目与当前源码/构建匹配；app.asar版本/后台模块/前端资源一致，[包报告](../../../artifacts/windows-context-recovery/2026-10-17/package.json)、[最终打包日志](../../../artifacts/windows-context-recovery/2026-10-17/package-build-retry.log)。原版alpha.24普通EXE对照3组、alpha.25候选普通EXE4组通过；实际Windows EXE内生产Coordinator/MachineHost/CodexHost读取合成原请求，未启动真实原生CLI。候选原请求确认，另一条缺收据请求仍unknown；普通窗口关闭/重开和完整后台重启不重放，冻结代码与源码一致。该结果证明隔离记录恢复链，不证明用户另一台电脑已恢复。

用户另一台电脑的原记录尚未获取/复验，不承诺所有NOT_CONFIGURED都由本缺陷造成；如果没有原回执或可靠未派发拒绝证明，仍保留unknown。未调用真实模型、未验证独立SSH，未将受控原记录当作用户任务已恢复。

升级时在原窗口“设置 → 后台运行 → 停止后台并退出”，再打开alpha.25候选，沿原机器/原请求点击“查询原请求”。普通关闭窗口保留原后台。无须删除缓存、节点或pending.json；此Windows修复不要求升级SSH后台。
