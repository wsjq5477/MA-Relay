# I07：DSH 本地 Windows EXE 与真实连接验证

日期：2026-10-20。I07-DSH01；AB-F02/F07/F08/F10/F11/F17；M01/M03/M05/M06/M07/M10。当前本地候选 **0.6.0-alpha.35.dsh.3**，公开预发布仍alpha.34；完整I06C/I07C未准出。

## 需求与源码边界

用户指出源码修复和受控测试不足以直接使用，要求实际验证并打包Windows EXE。交付当前DSH Desktop/Web入口与本轮发现/协议修复；继承已有原生模型配置，不设置模型/供应商，不复制原生账号凭据。用户明确授权在Windows Desktop保存服务连接并发送两轮仅回复标记、不读写文件、不调用工具的验证请求。WSL只收到启动链接，执行只读连接核对，未推定模型执行授权。

独立冻结副本起于Git HEAD `d9bf2a5`的工作区，含当前DSH增量及既有OpenCode服务生命周期修复，583项文件清单见[最终源码清单](../../../artifacts/dsh-integration/2026-10-20/exe/source-manifest-dsh3.json)。仅冻结副本的desktop/package与lock版本覆盖为候选号，主工作区未提交，未创建或移动公开标签。包核验以冻结生产文件/构建输出为准，后续文档更新不冒充已进入EXE。

## 真实验证发现与修复

| 问题 | 实际证据 | 最终行为 |
| --- | --- | --- |
| WSL系统dsh重名 | 系统Distributed Shell 0.25.10被误标DeepSeek Harness | 跳过明确外来身份；真正CLI失败保留PATH选择，Web profile显示独立安装提示 |
| 原生认证跳转 | 当前Windows Desktop未认证401，正确token返回303并签发Cookie；旧客户端只认302 | 接受带Cookie的302/303，不跟随跳转；200/301/307/308仍拒绝 |
| Session RPC命名参数 | 认证后平铺args导致真实session/list被拒；本机安装包Typert schema要求方法参数名 | payload.args的list为`{_request:{}}`，create/prompt/projections/page/cancel为`{request:请求对象}`；严格夹具拒绝平铺形状 |
| 原生模型限流 | 专用验证Session两轮均持久turn/end error，code为RATE_LIMIT | 按真实failed终态保留，不将连接/权限收据写成模型成功，不自动重试首轮 |

原生requestId/Session/轮次绑定、取消一次派发与unknown只读恢复不变；中央RPC和持久Task/Conversation结构未增加。架构/协议同步客户端编码；数据模型已核对，无新增字段。

## 本轮实际证据

| 检查 | 结果 | 原始材料与边界 |
| --- | --- | --- |
| 核心回归 | **56/56，零跳过** | [TAP](../../../artifacts/dsh-integration/2026-10-20/exe/core-tests.tap)，冻结核心未随后续DSH CJS编码变化 |
| 最终完整桌面回归 | **607/607，零跳过** | [最终TAP](../../../artifacts/dsh-integration/2026-10-20/exe/desktop-final-dsh3.tap)，受控SQLite/HTTP/worker，不等同真实模型 |
| Windows Node DSH契约 | **11/11，零跳过** | [最终日志](../../../artifacts/dsh-integration/2026-10-20/exe/windows-dsh-final.tap)，Windows24.19.0，受控HTTP/独立worker与真实文件/路径 |
| Windows Edge生产前端 | **3组，页面错误0、外部请求0** | [报告](../../../artifacts/dsh-integration/2026-10-20/exe/ui-final/report.json)、[入口截图](../../../artifacts/dsh-integration/2026-10-20/exe/ui-final/inventory.png)、[设置截图](../../../artifacts/dsh-integration/2026-10-20/exe/ui-final/settings.png)；生产构建与受控API，不是真实模型 |
| 实际Desktop认证/Session接口 | **通过** | [原生记录](../../../artifacts/dsh-integration/2026-10-20/exe/native-desktop-named-args.json)，Windows社区Desktop2.0.18；仅专用新Session，不读取既有会话正文 |
| 实际Desktop两轮/同Session/去重 | **连接与协议通过；模型两轮均RATE_LIMIT失败** | [续聊结果](../../../artifacts/dsh-integration/2026-10-20/exe/native-desktop-continuation.json)、[原轮错误代码](../../../artifacts/dsh-integration/2026-10-20/exe/native-owned-error.json)；两个原requestId、一个原生Session，重复首ID仍同Task，未重放 |
| 实际WSL Web认证/Session列表 | **通过** | [原生记录](../../../artifacts/dsh-integration/2026-10-20/exe/native-wsl-web.json)，只读接口，临时私有连接配置随检查删除；模型0、未保存用户配置 |
| Windows普通EXE | **6组通过，真实Desktop健康发现** | [普通EXE报告](../../../artifacts/dsh-integration/2026-10-20/exe/windows-portable.json)；隔离profile，无调试参数，真实Desktop只读发现与合成历史/unknown分列 |
| 最终包一致性 | **通过** | [报告](../../../artifacts/dsh-integration/2026-10-20/exe/package-dsh3.json)、[构建](../../../artifacts/dsh-integration/2026-10-20/exe/package-build-dsh3.log)；45 CJS/81核心文件/1453 Linux资源，窗口ASAR/前端/后台/离线包一致 |
| 根与桌面构建、文档检查 | **通过** | [核心构建](../../../artifacts/dsh-integration/2026-10-20/exe/frozen-core-build.log)、[桌面构建](../../../artifacts/dsh-integration/2026-10-20/exe/frozen-desktop-build-dsh3.log)、[文档检查](../../../artifacts/dsh-integration/2026-10-20/exe/docs-final.json)；保留前端chunk尺寸提示 |

计数不跨模块累加。Computer Use技能已读取，但本轮工具列表未提供node_repl入口，未执行Computer Use输入；Windows程序检查使用独立测试脚本，不冒称已完成Computer Use视觉验收。首次UNC test路径失败与PowerShell空日志不能计通过，改为Windows本机冻结快照、Start-Process等待/落盘日志后取得有效结果。

首次仅认证[303失败记录](../../../artifacts/dsh-integration/2026-10-20/exe/native-desktop-auth.json)、随后[Session列表拒绝](../../../artifacts/dsh-integration/2026-10-20/exe/native-desktop.json)均保留。`.dsh.1`和`.dsh.2`虽曾构建并验包，但分别缺303或命名参数修复，不作为最终可用候选交付。自动审批首次拒绝保存用户配置/模型请求，用户随后明确授权Windows两轮后才执行；未将WSL链接推定为模型调用授权。

## 文件与使用

- [Windows x64便携EXE](../../../desktop/release/AgentBridge-0.6.0-alpha.35.dsh.3-Windows-x64.exe)
- [SHA256SUMS](../../../artifacts/dsh-integration/2026-10-20/exe/SHA256SUMS.txt)
- 字节数：**130,014,613**；SHA-256：`4f2a423ccd2ea6c0fd3f0b63e7a59cc50d0a5728c904f2c6dbb4c21ac61e6427`。

先在旧窗口「设置 → 后台运行 → 停止后台并退出」，再打开新EXE。普通关窗口会保留旧后台，不能据此声称运行的是新协议。

Windows Desktop原生连接已按用户授权保存到Windows用户私有配置；在新版「机器与Agent」重新扫描、接入DSH Desktop即可。两轮RATE_LIMIT是原生模型当前限制，Bridge不更换账号/模型，也不会自动重发已失败原请求。

WSL Web在新版「设置 → DSH Desktop / Web接入」选择对应发行版，选择Linux/WSL Web，填该原生启动地址与token并保存，再重扫；本轮只读验证没有把token写进真实WSL用户配置。WSL旧后台需重启，新Windows EXE不会自动升级独立SSH daemon。Desktop/Web/CLI身份分离，原上下文与unknown不迁移或清除。

这是本地可运行候选，未上传GitHub，未对公开alpha.34附件做替换。未验证WSL模型执行、真实成功模型两轮/取消、独立SSH及用户原profile升级；受控取消/恢复和普通EXE合成历史验证不能扩大为这些准出。
