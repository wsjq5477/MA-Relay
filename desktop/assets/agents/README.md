# 原生 Agent 标识来源

本目录标识从以下官方产品页面、官方仓库或官方发布者取得原图。这里的标识用于识别用户机器上的原生 Agent；不表示厂商对 AgentBridge 的合作、授权或背书，也不表示任何模型/供应商选择。

| 文件 | 对应 Agent | 原始资源 | 官方入口 | 权利/通知 |
| --- | --- | --- | --- | --- |
| `codex.png` | Codex | [原图](https://openai.gallerycdn.vsassets.io/extensions/openai/chatgpt/26.51007.21434/1791508178385/Microsoft.VisualStudio.Services.Icons.Default) | [产品/来源](https://marketplace.visualstudio.com/items?itemName=OpenAI.chatgpt) | OpenAI brand asset; no open-source license asserted |
| `claude.png` | Claude Code | [原图](https://anthropic.gallerycdn.vsassets.io/extensions/anthropic/claude-code/2.1.301/1792092236961/Microsoft.VisualStudio.Services.Icons.Default) | [产品/来源](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) | Anthropic brand asset; no open-source license asserted |
| `hermes.png` | Hermes Agent | [原图](https://raw.githubusercontent.com/NousResearch/hermes-agent/ccc695635094d7615373db267b77f894d978b1a0/apps/desktop/assets/appx/Square44x44Logo.targetsize-256.png) | [产品/来源](https://github.com/NousResearch/hermes-agent/tree/ccc695635094d7615373db267b77f894d978b1a0) | MIT; see hermes.LICENSE.txt |
| `pi.svg` | Pi | [原图](https://pi.dev/favicon.svg) | [产品/来源](https://pi.dev/press-kit) | Official compact badge; project MIT notice in pi.LICENSE.txt |
| `opencode.svg` | OpenCode | [原图](https://raw.githubusercontent.com/anomalyco/opencode/c38d83c0c4f92466ff9c8e12b8a741698e811012/packages/console/app/src/asset/brand/opencode-logo-light-square.svg) | [产品/来源](https://opencode.ai/brand) | MIT; see opencode.LICENSE.txt |
| `dsh.svg` | DeepSeek Harness | [原图](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/687f282e8625c6b8d11ff58211a90524be2e4317/apps/web/public/favicon.svg) | [产品/来源](https://github.com/deepseek-ai/deepseek-harness/tree/687f282e8625c6b8d11ff58211a90524be2e4317) | MIT; see dsh.LICENSE.txt and dsh.BRAND_GUIDELINES.md |

图像字节保持下载时的原样，完整 SHA-256 和来源记录见 [sources.json](sources.json)。Pi 使用官网 Press Kit 专门提供的 compact badge；其 SVG 自带颜色方案，渲染容器固定 light color-scheme 来保留浅色底上的对比度。DSH 使用 DeepSeek Harness 自己的官方 Web 图标；没有根据当前模型推断图标。

Codex 与 Claude Code 标识是各权利人的品牌素材，不因本仓库的 MIT 许可证而重新许可。本目录保留其官方发布页面和版本来源；另外四个上游项目的 MIT 原文也随本目录保存。DeepSeek Harness 的品牌使用规范同时保留，展示仅用于准确识别集成工具。

前端通过 `new URL(..., import.meta.url)` 在构建时打包，运行时不从官网加载图像。现有桌面打包规则 `assets/**/*` 同时携带本目录的原图、来源与许可通知。新增 Agent 时，更新 `desktop/src/agent-tools.ts` 和类型，将审阅过的本地图片及来源/许可加入此目录；未知自定义类型显示通用 Agent 图标，不借用其他产品标识。

`dsh-desktop` / `dsh-web` 服务入口共用已有 `dsh.svg` 与来源/许可，不新增下载或改变图标字节；图标不证明服务已认证或模型可用。当前 Windows 检测到的社区 DSH Desktop 2.0.18 与官方 DSH 项目身份/实测层级区分见[接入专项](../../../doc/iterations/I07/dsh-desktop-web.md)。

OpenDesk CLI/Desktop 共用本机 OpenDesk 源码 `resources/package/installer/opendesk-icon.png`，随包提供；品牌识别图沿用 OpenDesk 项目的 Mulan PSL v2 许可，许可证见本目录 `opendesk-LICENSE`。图标不表示接口已认证或任务成功。
