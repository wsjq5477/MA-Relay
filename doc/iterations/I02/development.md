# I02 开发记录

日期：2026-10-08。状态：已实现并通过本机真实验收，待用户复核。范围以 [需求规格](requirements.md) 为准，实现细节见 [设计](design.md)，验收结果见 [测试记录](testing.md)。

## 模块交付

| 需求 | 实现文件与结果 |
| --- | --- |
| F01 | config.ts：OpenCode 判别配置、固定目录、密码文件、可执行文件、provider/model#variant；local.ts 与 opencode-client.ts：doctor 与原生检查 |
| F02 | opencode.ts：原生新会话和 Prompt；edge-journal.ts：写调用前持久原生关联；Hub 保留身份、串行与请求幂等 |
| F03 | observe.ts、cli.ts：run/task 的可读观察，真实工具、文本、状态与等待；JSONL 保留 |
| F04 | opencode-client.ts/opencode.ts：原生权限与表单查询；cli.ts：native 单次同意/拒绝及表单 JSON 回复；示例项目验证真实编辑/测试 |
| F05 | native-server.ts、local.ts：up 组合启动、捕获原生认证输出、只停止自身服务；CLI 历史查询沿用持久化 |
| F06 | 原生请求不自动重试；明确失败和不明执行分开；台账与原生消息绑定；断开仍保持 unknown 占位 |

初次模型检查返回空；之后检测到已有可用模型。默认 exo-free 实际调用被提供方拒绝，记录在 artifacts/I02-real-default-model.json；Bridge 正确报 failed。真实演示使用已配置的 csi-provider/DeepSeek-V4.1-Flash，通过本轮配置单独选择，不修改原生默认模型或凭据。

## 实现边界

- 按安装版本 2.0.24 的原生 API 开发，不引入不兼容的 v1 SDK。
- 轮询真实消息与等待，支持分页；没有新增 Hub SSE 或通用远程控制路由。
- 等待是 running 附加信息；本地 helper 先检查任务所有权和配置绑定。
- 普通进度有合并上限；完整回答上限 60,000 字节，截断明示。
- 固定工作目录由可信配置决定，不宣称是额外文件沙箱。
- unknown 不自动恢复、不重投、不释放占位；I03 继续实现持续使用与恢复控制。

真实演示复制 examples/opencode-project 到临时目录，保留原始练习。服务、凭据和临时项目在验收结束后清理；报告保存任务/会话、文件变化、原生工具与独立测试证据。

## 本机试用配置

已准备 .agentbridge-real 与独立 .agentbridge-example 练习目录，使用已配置的 csi-provider/DeepSeek-V4.1-Flash，并将 edit 设为单次询问。doctor 已对新启动服务验证 healthy=true。该配置可直接使用 node dist/cli.js up 启动；另一个终端提交任务时传 --config .agentbridge-real/client.json。

最后补充了模型目录冷启动的只读就绪等待，解决新服务首次 doctor 过早报告不可用的问题；工程测试同时覆盖即时空目录与稍后就绪。真实模型任务报告保留实际执行时的源码摘要，最终工程检查保留最终源码摘要。
