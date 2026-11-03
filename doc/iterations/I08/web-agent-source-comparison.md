# 三个开源项目的源码级对比与取舍

日期：2026-10-30。三个仓库均实际浅克隆到系统临时目录、固定 HEAD 后逐文件阅读；未安装依赖、构建、加载扩展、启动服务或发送真实消息。下表是源码事实和工程推导，**不是上游功能的运行验收**。逐文件路径、关键函数、行号、调用链和固定提交链接见三份附件。

| 项目 | 固定提交 | 详细研究 |
| --- | --- | --- |
| OpenBrowser | `2f090f0954435efb07ee35f95e04576b7c6d65fa` | [源码与边界](web-agent-openbrowser-research.md) |
| web-llm-bridge | `171a57115cd09f834c064c83f6e7959a81f33102` | [源码与边界](web-agent-web-llm-bridge-research.md) |
| kimi-pp | `6edf5494532845102e174d5f22669548309f5d18` | [源码与边界](web-agent-kimi-pp-research.md) |

## 1. 对比结论

优先参考 web-llm-bridge 的 ChatGPT **文字 DOM** 分层与测试思路，独立实现在 AgentBridge Adapter 内。OpenBrowser 的 ChatGPT 主读取路径和 kimi-pp 的 Kimi 主链都依赖网站内部接口；不能因为输入经过 DOM 就称整条链为无私有 API。三个项目均不能直接提供符合本项目要求的持久原请求恢复、本机配对和多主体授权。

不部署第三方 Broker，不导入其 Session/Registry，不移植网页网络 hook 或凭据读取，不直接复制 AGPL 实现。可参考的模式通过 AgentBridge 的原 Host、请求账本和测试体系重新实现；所有选择器仍需当前真实页面验证。

## 2. 八项重点逐项比较

| 维度 | OpenBrowser | web-llm-bridge | kimi-pp |
| --- | --- | --- | --- |
| manifest / background / content | 提交 MV3 manifest；background 拉 SSE、派发；content 执行；ChatGPT 等另在 MAIN/document_start hook fetch | MV3；service_worker + core/rpc/tabs；ISOLATED 页面运行时与 provider 文件；最低 Chrome120 | WXT 动态生成 manifest，本次未构建；MAIN hook + ISOLATED 工具/UI + background；权限包含 nativeMessaging 等广泛能力 |
| 本地通信 | Fastify，Node CLI→HTTP；扩展接 SSE 并 POST claim/chunk/response；browser接口免 BRIDGE_TOKEN | Python Broker：127.0.0.1 WS8765 + NDJSON8766；只有任意扩展 Origin 格式检查，无配对凭据 | 扩展向本地 Native Messaging MCP/HTTP/SSE 工具服务调用；不是外部 Agent→Kimi 的被动任务通道 |
| Prompt 发送 | textarea/contenteditable 多策略；可能覆盖草稿；多次click/Enter重试，提交模糊可能重发 | DOM 全文写入校验；主要在发送前重试，点击后等待；提交确认条件仍偏宽，缺原消息指纹 | Kimi DOM按钮发送，但编辑器写入用 `__lexicalEditor`；实际prompt增强在内部Connect请求改写 |
| 流、结束与提取 | ChatGPT fetch tee解析私有SSE；其他Provider DOM全文快照；partial/异常可能上报complete | MutationObserver+轮询+Markdown serializer；只发阶段progress，正文最终才返回；稳定/Stop消失未强制完成marker | Kimi内部Connect五字节帧解析/重编码，ToolStreamAdapter提取；flush也发complete；DOM response observer未发现生产调用 |
| 多tab / session | active AI tab优先，未过滤目标Provider；server的conversationId未用于页面导航核验；内存Map | 持久化tab/url/metadata，按URL恢复；全会话共用asyncio.Lock；不是请求结果或流事件持久化 | Kimi requestId/页内续跑隔离；没有外部持久session-tab租约；侧边栏模块级session且实际调用DeepSeek |
| 超时 / 重试 / 恢复 | SSE重连、有限派发重试；job/去重多为内存；client120s/page180s不一致；没有可靠unknown | 断线重连但不重放；chat出错可标unknown；没有原请求查询/持久提交围栏/unknown持续占用；没有总时限 | native RPC超时拒pending；增强失败放行网站原请求；续跑失败会清理去重；scheduler重试属于DeepSeek且可能底层继续 |
| 人工操作冲突 | 页内running/FIFO只挡本扩展任务；无草稿/手动轮次/导航所有权保护 | 发送前检测已生成；无草稿非空拒绝、可信输入检测、绑定围栏；轮询最后assistant可能混入人工轮 | expectedCurrentText、占位符/sourceRequest隔离较细；检查与click仍有竞态；没有跨tab持久互斥 |
| 许可证 / 依赖 | MIT；Fastify/Zod/Commander等Node树；扩展原生JS；无本次依赖审计 | AGPL-3.0-only；Python websockets>=14、扩展原生JS；不直接复制进当前MIT产品 | Apache-2.0；WXT/React/Dexie/Pyodide等；不需要导入完整工具、沙箱、记忆和UI依赖 |

每格依据可从对应[OpenBrowser](web-agent-openbrowser-research.md)、[web-llm-bridge](web-agent-web-llm-bridge-research.md)、[kimi-pp](web-agent-kimi-pp-research.md)的固定源码链接追溯。许可只是仓库声明；选定文件的第三方版权、依赖许可和分发条件需在实际引入时另核对，本次没有复制产品代码。

## 3. 最值得读的真实调用链

### OpenBrowser

`src/server/index.ts` 的 `/session/prompt` → `session-store.createSession` → `sse-hub.broadcastBrowserJob` → `background.connectBridgeStream/dispatchJob` → `content-script.handleIncomingJob/runJob/claimJob/processJob` → `injectPrompt/clickSendWhenReady` → ChatGPT `waitForApiCapturedResponse` → `chatgpt-api.js` 的 fetch hook / SSE parser → `/browser/chunk`、`/browser/response`。

入口：[server/index.ts](https://github.com/1129Aliasgar/OpenBrowser/blob/2f090f0954435efb07ee35f95e04576b7c6d65fa/src/server/index.ts#L116)、[content-script.js](https://github.com/1129Aliasgar/OpenBrowser/blob/2f090f0954435efb07ee35f95e04576b7c6d65fa/browser-extension/src/content-script.js#L285)、[chatgpt-api.js](https://github.com/1129Aliasgar/OpenBrowser/blob/2f090f0954435efb07ee35f95e04576b7c6d65fa/browser-extension/src/chatgpt-api.js#L161)。不要把其他 Provider 的 DOM fallback 描述成 ChatGPT 当前主链。

### web-llm-bridge

Python SessionManager → ExtensionTransport.request → extension `core/rpc.createRpcClient` → `service_worker.routeRequest/handleRequest` → `core/tabs.request` → `content_runtime.chat/sendText/waitForSubmitted/waitForComplete` → ChatGPT adapter/profile/serializer → 最终response。中途 chat_progress 只含阶段与耗时，不含回答正文。

入口：[service_worker.js](https://github.com/Tzufucius/web-llm-bridge/blob/171a57115cd09f834c064c83f6e7959a81f33102/extension/service_worker.js#L27)、[content_runtime.js](https://github.com/Tzufucius/web-llm-bridge/blob/171a57115cd09f834c064c83f6e7959a81f33102/extension/core/content_runtime.js#L43)、[session/manager.py](https://github.com/Tzufucius/web-llm-bridge/blob/171a57115cd09f834c064c83f6e7959a81f33102/web_llm_bridge/session/manager.py#L368)。图片Artifact分支还会fetch DOM中的图片地址；文字MVP不采用。

### kimi-pp

`main-world.content.ts` → `kimi.initFetchInterceptor` → `decodeKimiRequestForAugmentation` → content `handleAugmentRequestBody` → 改写内部Connect请求 → `interceptResponseStream` → `KimiToolStreamAdapter` → content工具执行屏障/续跑。`startKimiResponseObserver` / `startKimiPromptInterceptor` 是存在但未发现生产调用的另一组文件，不能拼成虚构的现成 DOM Agent。

入口：[main-world.content.ts](https://github.com/springrain1/kimi-pp/blob/6edf5494532845102e174d5f22669548309f5d18/entrypoints/main-world.content.ts#L55)、[fetch-interceptor.ts](https://github.com/springrain1/kimi-pp/blob/6edf5494532845102e174d5f22669548309f5d18/core/kimi/fetch-interceptor.ts#L45)、[lexical-editor-adapter.ts](https://github.com/springrain1/kimi-pp/blob/6edf5494532845102e174d5f22669548309f5d18/core/kimi/lexical-editor-adapter.ts#L44)。其 DeepSeek 登录token读取路径与 Kimi hook 分开，既不能迁入新 Driver，也不能错误声称当前 Kimi hook已读到Kimi Token。

## 4. 可复用范围与具体落点

| 借鉴对象 | 采用方式 | AgentBridge 落点 |
| --- | --- | --- |
| Provider profile / adapter / serializer 分离 | 研究行为后独立实现；Provider差异不穿透Core | 扩展 `providers/chatgpt/`、后续 `providers/kimi/` |
| 发送前与可能发送后分界 | 在现有requestId规则上增加两端围栏；不采用宽松“composer空了即提交” | BrowserAdapterHost + 扩展journal/content |
| baseline排除旧回答、DOM序列化、稳定候选复核 | 增加原轮锚点、完成证据、revision/replace与真实网页验收 | Driver + Task输出通用合并 |
| request隔离、expectedCurrentText、工具屏障思想 | 只取身份/冲突检测模式；不引入主动工具或自动续跑 | Session绑定、人工操作检测 |
| 连接退避、pending RPC、Native Messaging收发格式 | 参考运输分层；MVP用已配对loopback WS | 单一BrowserChannel，已有跨机Transport |
| 上游受控测试场景 | 独立编写符合本系统不变量的fixtures；不把上游未运行测试计为通过 | 自动化/人工分层方案 |

不采用：三个项目的独立Broker/Registry/SessionStore；OpenBrowser网页重复发送与partial完成；web-llm-bridge的全局锁和未认证通道；kimi-pp私有Connect/Lexical状态、token缓存、自动任务重跑及Shell工具。

## 5. 尚未证明的事实

本次没有证明任何项目当前在线 ChatGPT/Kimi 可工作，没有运行其测试、审查完整传递依赖许可或做漏洞扫描。特别没有证明网页账号/验证码、真实Stop、长思考/后台节流、浏览器重启、跨profile、人工并发、极端断电以及跨设备完整调用。

后续先验证[技术设计](web-agent-design.md)的 DOM-only 可行性，再执行[计划中的自动化和人工矩阵](web-agent-implementation-plan.md)。源码存在、README声明、受控测试、真实网页和实际EXE结果必须继续分开。
