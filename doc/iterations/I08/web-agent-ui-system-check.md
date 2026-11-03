# Browser接入界面系统核对

2026-10-30；Windows、Chromium 148.0.7778.96；核对当前工作区实现与生产桌面渲染、真实MV3扩展设置页。沿用[界面约束](web-agent-ui-direction.md)，模式为Operate。本记录只评价现有Settings中的Browser分区和小型扩展设置页，不是完整功能、全应用或发布包准出。

## 继承的系统

依据为[桌面主题与控件](../../../desktop/src/workbench.css)、[设置布局](../../../desktop/src/workspace-pages.css)、[Browser分区](../../../desktop/src/BrowserSettings.tsx)、[局部样式](../../../desktop/src/browser-settings.css)和[节点配置入口](../../../desktop/src/AgentConfigurationDialog.tsx)。记录实际复用，不另立全局视觉系统；保留未设置PRODUCT.md、DESIGN.md和.impeccable/design.json的现状。

| 项目 | 实际实现与用途 |
| --- | --- |
| 字体 | 本地IBM Plex Sans，中文沿用Microsoft YaHei UI等既有回退；身份用IBM Plex Mono。扩展携同款字体与OFL，不增加图片或外部字体。 |
| 浅色基底 | 桌面背景`#f9fbfc`、表面`#fff`、正文`#131416`、次文`#5d5f60`、分隔线`#e8eaec`；扩展对应角色复用这些值。 |
| 深色基底 | 桌面背景`#111113`、表面`#171719`、正文`#f0f0f2`、次文`#b4b4bc`、分隔线`#303034`；扩展对应角色复用这些值。 |
| 字号 | 桌面正文14px、分区标题15px/600、字段标签13px/500、辅助说明沿用11px、身份12px；扩展正文14px、页标题24px、分区16px、说明标签与身份12px。没有新增展示字体。 |
| 布局 | 桌面复用设置页标题/内容双列`minmax(180px,1fr) minmax(0,2fr)`、32px列距、24px分区内距与细底线；800px以下沿用单列。配对列表用14px行内距、16px间隔与细线。 |
| 形态 | 设置分区无卡片外框、圆角或浮层阴影；输入沿用6px圆角及原按钮。操作间隔8px，可换行；身份允许断行。原生控件保留禁用和可见焦点。 |

扩展的[实际样式](../../../browser-extension/src/options/options.css)是同一系统的独立页面适配：最大宽980px、32px外距/内距、220px标签列与32px列距；640px以下去外框、20px横向内距、单列与16px间隔，按钮/输入至少44px高。390px浅深截图均能读完整扩展ID与原配对，操作自然换行。

扩展为独立浏览器页面，主题跟随`prefers-color-scheme`；桌面跟随原`data-theme`设置。扩展控件边线浅/深为`#b7b9bb`/`#64646b`，焦点为暖色`#a34123`/`#edb28e`；桌面仍使用原`--control-border`与蓝色焦点。扩展逆色按钮和错误色也保留局部值。这些是当前实现的页面适配，不提升为全应用新Token或主题抽象。

## 身份、状态与操作

- 桌面按来源机器展示完整扩展ID、原browserInstanceId与pending/committed/revoked；原回应未确认时只有“查询原配对”，重开不因not_found自动新建。撤销在原行具名确认，文案明确原Task保留。
- 扩展[页面结构](../../../browser-extension/src/options/index.html)和[控制逻辑](../../../browser-extension/src/options/options.mjs)分开呈现本机运输、站点权限、网页登录和实际回复；暂停/恢复原连接保留配对身份，页尾明确暂停、撤权或关页不证明任务取消。
- 配对包在桌面内存/剪贴板流转；本地意图只存operationId、extensionId及可选pairingId。扩展粘贴使用密码输入，配置后清空。截图显示的扩展ID/原配对是公开身份，不包含配对秘密；扩展受信后台凭据持久化与普通UI意图分开，不能写成“系统完全不存凭据”。
- Browser节点配置只解释网页接入、原身份和下一步；不展示原生MCP安装配置、模型或账号密码表单。该分支按静态适配器能力处理，未增加模型API层。

## 本轮证据与评审来源

[该片MV3报告](../../../artifacts/browser-agent/2026-10-30/mv3-ui-final-13.json)记录13组检查、pageErrors为0、上游转发为0。实际执行包含生产桌面配对表单、原意图重开查询、真实扩展options和暂停/恢复；Provider HTML及原生父任务仍为受控夹具。13组不与此前8/9/10组相加。

最终截图共14张：桌面浅/深各1440、980的全页与Browser分区8张，扩展浅/深各980、768、390的6张。独立finish reviewer在实际主题控件重选并重截图后复核全部14张，返回**ship（仅上述界面范围）**，无实质修复项；此次系统记录另亲自打开核对[桌面浅色1440分区](../../../artifacts/browser-agent/2026-10-30/ui/desktop-browser-light-1440.png)、[桌面深色980分区](../../../artifacts/browser-agent/2026-10-30/ui/desktop-browser-dark-980.png)、[扩展浅色390](../../../artifacts/browser-agent/2026-10-30/ui/extension-light-390.png)和[扩展深色390](../../../artifacts/browser-agent/2026-10-30/ui/extension-dark-390.png)，与当前CSS/组件互证。

评审依据为已给定的质量约束及TYPE/MATERIAL/GROUND：继承字体、平面浅深表面、设置双列拓扑，保留原身份与不确定性、秘密处理和能力配置边界；未另建QUALITY BAR卡片。Impeccable context/craft-floor已在实现流程应用；[detector结果](../../../artifacts/browser-agent/2026-10-30/impeccable-browser-ui.json)为`[]`。Taste六个扩展变体无发现；桌面探针仍命中既有隐藏ReactFlow的“主Agent/子Agent/React Flow”10px文字，不能据detector为空称全应用无问题。

[桌面构建证据](../../../artifacts/browser-agent/2026-10-30/desktop-ui-build-final.log)记录typecheck与Vite构建成功；[Browser UI定向证据](../../../artifacts/browser-agent/2026-10-30/browser-ui-final.tap)为4/4。此处引用本轮已有运行记录，文档核对未重跑这些工程检查，不将历史通过冒充新增实测。

## 未准出与未修漂移

[真实可选权限探针](../../../artifacts/browser-agent/2026-10-30/optional-permission-probe.json)使用生产optional-host清单，`before=false / after=false / pending=true`，仍待Chrome同意交互；既不记成功，也不记拒绝。最终截图中的“已获得网页访问授权”来自执行夹具预授予，不证明生产授权流程通过。

真实Provider兼容、登录与回复结束判据、原生父模型、Linux/SSH/跨设备、Kimi、完整冲突与控制接口、打包/实际EXE仍按[开发台账](web-agent-development.md)待验。截图与局部ship不关闭完整目标。

既有隐藏ReactFlow 10px探针发现留作范围外问题；未把该字号写成可继承规则，未改无关源代码。此次只增加本核对材料，不修全局文档/设计漂移。

本页写入后实际执行`node scripts/check-docs.mjs`：退出1，全库保留2243条错误，本页相关错误0；不称全库文档通过。`git diff --check -- doc/iterations/I08/web-agent-ui-system-check.md`通过。

## 原配对未确认状态补核

2026-10-31；核对当前options三文件与保存在2026-10-30标签目录的恢复状态截图，不把证据目录日期当作本次重跑日期。扩展已配对但凭据尚未确认时保留原身份，显示“原配对尚未确认”和“修正原配对包”；输入仍为密码字段，辅助文案要求同一原包，不引导另建身份。操作失败后只刷新状态，保留顶部错误说明，不被状态渲染覆盖。

亲自打开核对[浅色980](../../../artifacts/browser-agent/2026-10-30/ui/extension-unverified-light-980.png)、[深色980](../../../artifacts/browser-agent/2026-10-30/ui/extension-unverified-dark-980.png)、[浅色390](../../../artifacts/browser-agent/2026-10-30/ui/extension-unverified-light-390.png)、[深色390](../../../artifacts/browser-agent/2026-10-30/ui/extension-unverified-dark-390.png)：原扩展ID/配对可读，错误说明、修正输入和暖色焦点可见，无秘密明文；980px保持双列，390px沿原断点堆叠与44px控件。字体、浅深基底、分隔线、间距和按钮均沿原系统，没有新Token、资产或主题结构。

本补片独立finish reviewer已逐张打开上述四图，返回**ship（仅原配对修正界面）**，无实质修复项。[当前MV3报告](../../../artifacts/browser-agent/2026-10-30/mv3-auth-recovery-15.json)为15组通过，包含首次认证失败仅允许修正原绑定、拒绝换profile、不新配对或重置日志；此为已有运行证据引用，不与前序13组相加。本次只做源码/截图文档核对，未重跑MV3或detector；前述detector `[]`仅属于先前运行。

15组仍为Chromium148、受控Provider HTML/原生父任务夹具及测试专用host预授予，不证明真实登录、生产站点授权同意或完整目标完成。导航/URL守卫的后续改动不在本界面核对范围。
