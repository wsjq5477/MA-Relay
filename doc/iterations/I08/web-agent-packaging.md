# Browser Agent 开发扩展交付与打包

2026-11-01更新：已交付包含当前ChatGPT源码及19文件扩展的browser.3 Windows体验包。通过同目录非C盘启动脚本使用，包内Node 72/72及实际EXE载荷核验通过；本包尚无普通GUI/真实模型验收，旧browser.2证据保留为历史。[最新体验包与准确边界](web-agent-browser3-preview.md)。

后续真实ChatGPT布局适配已生成19文件新ZIP，SHA/源码摘要及四轮实际网页证据见[本轮交付](web-agent-live-chatgpt.md)。本文browser.2仍保存此前18文件/旧DOM的实际包证据，未被覆盖或重构建；不能据其包验证宣告当前源码的新EXE验收通过。Kimi已移出当前范围。

2026-10-31；6e7ec6f之后的未发布工作树。用户已授权开发验证；本轮只构建本地开发产物，不发布、推送、部署或改变公开alpha.71。完整目标仍未准出。

**当前状态：browser.2已构建，包内ws及实际EXE载荷匹配；原配置重开/配对保留/正常窗口及包装器退出已完成复核。** Windows/Linux打包与ASAR各13/13、browser.2实际包内Node模式68/68。首轮关闭等待失败保留，后继原profile复核3组通过；真实Provider/原生父模型及完整目标仍未准出。

首个开发EXE `0.6.0-alpha.71.browser.1` 普通启动失败，不能作为可用交付。包字节/Node模式68项通过之后，真实GUI停在`MODULE_NOT_FOUND: ws`错误框；Electron主进程经CoordinatorClient导入Browser通道，桌面生产依赖却未声明ws。原包核验只比对产品源码/资源，没有覆盖ASAR主进程第三方模块。这是实际打包缺陷，不是Provider、登录或受控模型失败。[普通启动原报告](../../../artifacts/browser-agent/2026-10-31/browser-portable.json)、[所属错误框诊断](../../../artifacts/browser-agent/2026-10-31/browser-portable-startup-diagnosis.json)。失败测试所属进程已停止，独立profile保留；生产profile未写。

已在`desktop/package.json`和锁文件精确加入现有Bridge已用的`ws@8.22.0`；锁只新增根依赖与该包，不升级其他版本或采用npm重算的无关peer标记。`verify-package`新增`verifyDesktopWebSocket`，检查ASAR内原ws版本、模块入口/依赖元数据及所有运行JS字节。electron-builder会清理包内scripts/keywords等非运行元数据，因此不对整份第三方package.json做不成立的原字节承诺；运行入口与代码必须一致。源CJS/Extension/wire/Provider逻辑未因该修复修改。

Windows新增实际ASAR的完整、缺失、文件改写和入口元数据改写用例，当前13/13；[最终TAP](../../../artifacts/browser-agent/2026-10-31/browser-package-ws-runtime-final.tap)。WSL Ubuntu22.04/Node22.23.1同13/13、602源复制摘要及执行期间源未变，[Linux TAP](../../../artifacts/browser-agent/2026-10-31/linux-browser-package-ws.tap)、[执行记录](../../../artifacts/browser-agent/2026-10-31/linux-browser-package-ws-execution.json)。新检查也实际[拒绝了缺ws的browser.1原ASAR](../../../artifacts/browser-agent/2026-10-31/browser-ws-bad-package-rejected.json)。首轮新检查11/12，验证器在Windows错误使用POSIX路径定位ASAR；按现有ASAR工具原生路径规则修正并加元数据场景后通过，[初轮TAP](../../../artifacts/browser-agent/2026-10-31/browser-package-ws-runtime.tap)保留。依赖更新首轮offline因ENOTCACHED未改锁，随后精确在线取同版本元数据完成；[offline记录](../../../artifacts/browser-agent/2026-10-31/desktop-ws-lock.log)、[成功记录](../../../artifacts/browser-agent/2026-10-31/desktop-ws-lock-online.log)。

后继独立快照版本`0.6.0-alpha.71.browser.2`已构建。仅该本地验证构建通过CLI覆盖`compression=store`，不以此承诺启动性能；产品默认normal配置、公开版本和原EXE保持。下文首轮历史结果不覆盖为后继成功。

## 当前browser.2开发包

本地产物在`E:\AgentBridge-Browser-build\2026-10-31\v2\source\desktop\release\AgentBridge-0.6.0-alpha.71.browser.2-Windows-x64.exe`；588841634字节，SHA-256 `5edfa55223a9d1f9c6aab6e5fcd9efc62c9505270216e593f4f38fb445c418da`。store使本地验证包体积增大，未签名、未发布，未复制回空间不足的D盘。

| 层级 | 实际证据与结果 |
| --- | --- |
| 输入/构建 | [258项输入](../../../artifacts/browser-agent/2026-10-31/browser-package-v2-source.json)、[原字节/版本派生复核](../../../artifacts/browser-agent/2026-10-31/browser-package-v2-source-binding.json)；[Core/类型/Vite](../../../artifacts/browser-agent/2026-10-31/browser-package-v2-build.log)、[Bridge/Linux](../../../artifacts/browser-agent/2026-10-31/browser-package-v2-staging.log)、[独立桌面28生产包](../../../artifacts/browser-agent/2026-10-31/browser-package-v2-dependencies.log)、[实际构建](../../../artifacts/browser-agent/2026-10-31/browser-package-v2-builder.log)均完成；原Bridge依赖high1保留 |
| 原包核验 | [报告](../../../artifacts/browser-agent/2026-10-31/browser-desktop-package-v2.json)通过，69后台/84Core/1738Linux及ASAR/前端/bootstrap匹配；新增桌面ws8.22.0的17文件及入口元数据匹配 |
| 实际EXE | [3501载荷文件逐路径/字节数/SHA匹配](../../../artifacts/browser-agent/2026-10-31/browser-exe-payload-v2.json)，内置扩展仍为原151177字节、同SHA；[解包日志](../../../artifacts/browser-agent/2026-10-31/browser-exe-extraction-v2.log) |
| 实际包内运行时 | 原解出Electron44.7.0/Node24.21.0、Browser CJS/依赖和该EXE内ZIP client，68/68，无失败/跳过；[TAP](../../../artifacts/browser-agent/2026-10-31/packaged-browser-contract-v2.tap)、[运行环境/清理](../../../artifacts/browser-agent/2026-10-31/packaged-browser-contract-v2.json)。受控WS/状态机，不等于GUI或真实Provider |
| 普通portable首轮 | [原报告](../../../artifacts/browser-agent/2026-10-31/browser-portable-v2.json)：普通无调试启动、版本/三Browser能力、原Windows宿主管理、合成pending配对及监听三组通过；startup236992ms不作性能准出。窗口按所属进程正常关闭、后台经认证停止后，包装器未在测试15秒预算内退出，整轮仍失败；随后所属进程均已退出，不据此补填原exit code或重写通过 |
| 原配置重开/正常退出 | [后继原profile报告](../../../artifacts/browser-agent/2026-10-31/browser-portable-v2-resume.json)、[脚本](../../../artifacts/browser-agent/2026-10-31/browser-portable-v2-resume.cjs)：3组通过；版本/Browser能力匹配，原pending身份/端点及原expiresAt保持，仅queryOnly查询原配对，不续期/新建。所属窗口正常关窗、原后台认证停止、包装器退出0。restart241236ms不作性能准出；关闭后最多180秒观察，不补写前轮15秒预算的退出码 |

原重开之前已检查前轮测试所属进程均结束；沿用唯一保留的原合成profile与原pair文件，不因观察超时启动第二个并发实例。恢复检查仅证明Bridge配对元数据保持，pending早已过期，仍不能认证；没有把端点ready称为扩展已连接或真实账号可用。测试profile保留作原始证据，不包含生产profile，报告不复制其密钥或身份值。

## 扩展交付

[构建器](../../../desktop/scripts/build-browser-extension.cjs)提供`createBundle/writeBundle/stageBrowserExtension/verifyBrowserBundle`。根目录运行`npm run browser:pack`，默认产物在`artifacts/browser-extension/`；可用`npm run browser:pack -- --out <独立目录>`指定输出。扩展仍以开发者模式加载解压目录，不增加商店安装、桌面导出按钮或自动升级。

生产清单固定18个文件：manifest、MV3后台、content runtime、ChatGPT Driver、共享协议、设置页面/字体、MIT与字体OFL许可及简短安装说明。测试、开发私有文件和浏览器profile不进入ZIP；src内多出的文件直接拒绝。构建器核对固定权限、loopback CSP、入口及本地静态引用，拒绝链接文件、动态import和未收录依赖；这是产物检查，不代替Chrome完整语法/权限/兼容性验收。

ZIP采用固定顺序、固定1980时间和stored方式；实现参考[PKWARE ZIP格式规范](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)。相同生产字节生成相同ZIP及清单，不按机器路径或mtime计算；不归一化源文件字节。manifest原字节保留，不注入key、不改扩展版本或开发扩展ID。文件名含ZIP摘要前16位；外置manifest记录每文件字节数/SHA-256、sourceDigest和协议版本，`.sha256`记录ZIP与外置manifest摘要。这是本地完整性检查，没有签名或来源信任承诺。

| 当前开发产物 | 实际值 |
| --- | --- |
| 扩展版本/通道 | 0.1.0 / development |
| ZIP | [AgentBridge-BrowserAgent-0.1.0-dev-3ddf6bc5cf63daa5.zip](../../../artifacts/browser-extension/AgentBridge-BrowserAgent-0.1.0-dev-3ddf6bc5cf63daa5.zip) |
| 字节数 | 151177 |
| SHA-256 | `3ddf6bc5cf63daa56aef7be035bbf8cffc5b3c353d0fdb8c70a12e781093c657` |
| sourceDigest | `29658486888f448bea5db32751937e93c0821d0809292bf5dae51cbf0d42dec9` |
| 清单/摘要 | [逐文件manifest](../../../artifacts/browser-extension/AgentBridge-BrowserAgent-0.1.0-dev-3ddf6bc5cf63daa5.manifest.json) · [SHA文件](../../../artifacts/browser-extension/AgentBridge-BrowserAgent-0.1.0-dev-3ddf6bc5cf63daa5.sha256) |

输出文件以wx创建；已有同名同字节可复用，不同字节保留并报冲突。桌面`stage-bridge`在原Bridge/Linux资源准备后调用构建器，将ZIP/manifest/SHA和私有构建标记放入专属`.browser-extension`。替换只接受原标记和每文件摘要完全匹配的旧目录；未知文件、损坏及目录链接均保留并拒绝。临时目录写完核验再改名；受控发布失败验证原目录回滚。该机制只管理构建产物，不访问扩展IndexedDB或配对/Task状态。

`desktop/package.json`沿用electron-builder的extraResources加入`resources/browser-extension`；`verify-package`重建期望字节后逐项核对，不以目录存在代替匹配。原Core/后台/ASAR/前端/Linux资源核验继续执行。浏览器资源与Linux后台资源分开：Linux包收录Browser后台CJS，当前不内置或自动安装Chrome扩展。Browser wire、Core/Task/MCP合约及持久运行表均未因打包变更。

## 实际验证

| 日期/环境/层级 | 场景与结果 | 原始证据与限制 |
| --- | --- | --- |
| 2026-10-31 / Windows Node24.12.0 / 构建器受控 | 9/9；独立ZIP读取、逐文件字节/摘要、路径/mtime复现、排除私有开发文件、权限与引用拒绝、重复输出、未知/损坏目录保护、替换失败回滚 | [测试源码](../../../desktop/tests/browser-package.test.cjs)、[最终TAP](../../../artifacts/browser-agent/2026-10-31/browser-package-fixture-fix.tap)；不等于安装/网页验证 |
| 同日 / WSL Ubuntu22.04真实Linux Node22.23.1 / 构建器受控 | 9/9，602个源文件逐项复制摘要匹配、执行期间源未变、隔离HOME、清理成功 | [TAP](../../../artifacts/browser-agent/2026-10-31/linux-browser-package.tap)、[执行报告](../../../artifacts/browser-agent/2026-10-31/linux-browser-package-execution.json)、[源清单](../../../artifacts/browser-agent/2026-10-31/linux-browser-package-source.json)；依赖树借用，不是Linux Chrome、独立服务器或跨设备验收 |
| 同日 / Python3.14 stdlib zipfile / 独立格式读取 | 18文件CRC、SHA和固定时间全部匹配 | [报告](../../../artifacts/browser-agent/2026-10-31/browser-bundle-python.json)；未执行扩展 |
| 同日 / 本机stage | 18生产文件、151177字节、ZIP摘要与当前源码匹配 | [stage报告](../../../artifacts/browser-agent/2026-10-31/browser-bundle-stage.json)；不是EXE内资源 |
| 同日 / Chromium148.0.7778.96 / 实际ZIP解压出的MV3 | 原认证WS/IndexedDB/原stdio MCP/受控Provider DOM的21组通过，pageErrors0、上游转发0；继承prepared取消无resume/prepare/send，原取消/关闭各一命令与一原查询 | [验收入口](../../../desktop/tests/browser-package-live.cjs)、[报告](../../../artifacts/browser-agent/2026-10-31/mv3-extension-bundle.json)、[日志](../../../artifacts/browser-agent/2026-10-31/mv3-extension-bundle.log)；生产脚本无改动，测试副本预授ChatGPT站点权限及加入setup页，不验证权限同意、真实Provider或父模型 |

首轮Windows测试为1通过/8失败，原因是测试夹具`fs.cpSync`在中文临时路径EIO，业务断言尚未执行；改为显式普通文件递归复制后9/9，保留[首次失败](../../../artifacts/browser-agent/2026-10-31/browser-package-initial.tap)。独立桌面快照第一次准备因D盘空间不足WinError112，在复制Linux Node时失败，尚未打包；后续构建使用E盘专属目录，没有删除原发布包或用户状态。

桌面构建的Core/类型/Vite及原Bridge/Linux阶段已实际完成，[前端构建](../../../artifacts/browser-agent/2026-10-31/browser-package-build.log)、[后台准备](../../../artifacts/browser-agent/2026-10-31/browser-package-staging.log)分别保留。Linux离线资源1738项、Node22.23.1；Bridge生产依赖准备仍报原high1，桌面独立生产依赖安装为27包/审计28且0漏洞，不用后者覆盖前者。首轮打包沿快照依赖链接发现工作区开发依赖及缺失引用，由验收者中止；只移除快照自身的两个junction后，桌面在原锁文件上独立`npm ci --omit=dev --ignore-scripts`。下一轮因未安装开发依赖而无法解析Electron范围版本，明确传入实际安装版本44.7.0及原本机Electron分发目录后继续；产品依赖声明未修改。两轮日志[依赖链接轮](../../../artifacts/browser-agent/2026-10-31/browser-package-builder.log)、[版本解析失败轮](../../../artifacts/browser-agent/2026-10-31/browser-package-builder-isolated.log)与[最终构建轮](../../../artifacts/browser-agent/2026-10-31/browser-package-builder-final.log)均保留。

## 首轮桌面包记录与剩余边界

桌面开发包已在独立快照构建，版本`0.6.0-alpha.71.browser.1`，原工作树和公开alpha.71版本不改。输入及唯一版本派生变化见[源码清单](../../../artifacts/browser-agent/2026-10-31/browser-package-source.json)。产物位于`E:\AgentBridge-Browser-build\2026-10-31\source\desktop\release\AgentBridge-0.6.0-alpha.71.browser.1-Windows-x64.exe`；因D盘空间不足未复制回仓库。未签名、未发布、未部署。

| 本地开发EXE层级 | 实际结果 |
| --- | --- |
| 文件 | 132413676字节；SHA-256 `4d322e9bf20529cc2a61c8d879ff15f246948eabdf95272d83f3c34ced372680` |
| 原包核验 | 69后台CJS、84Core、1738Linux资源与原快照一致，ASAR/前端/bootstrap匹配；内置ZIP18文件、151177字节，摘要与原开发ZIP一致；[包报告](../../../artifacts/browser-agent/2026-10-31/browser-desktop-package.json) |
| 实际EXE解包 | 3501文件路径/字节数/SHA全部与win-unpacked一致，含原开发扩展ZIP；[实际载荷报告](../../../artifacts/browser-agent/2026-10-31/browser-exe-payload.json)、[解包日志](../../../artifacts/browser-agent/2026-10-31/browser-exe-extraction.log) |
| 实际包内运行时/后台 | 解出的原AgentBridge.exe以Electron Node模式运行原Host/通道测试68/68，Node24.21.0/Electron44.7.0；生产CJS/依赖直接引用原EXE载荷，扩展client从其内置ZIP解出并逐文件核验；[TAP](../../../artifacts/browser-agent/2026-10-31/packaged-browser-contract.tap)、[环境/执行报告](../../../artifacts/browser-agent/2026-10-31/packaged-browser-contract.json)。受控WS/存储/状态机，不是GUI、真实Provider或父模型 |
| 普通启动/关窗/重开 | browser.1缺ws实际失败，不能交付；browser.2修复和后继原profile结果见上节，不覆盖本轮历史 |

实际EXE解包首轮已成功展开3501文件，但验证脚本错误假定存在内层`app-64.7z`而失败；工具直接展开的是最终载荷。保留[首轮验证错误](../../../artifacts/browser-agent/2026-10-31/browser-exe-payload-initial.log)，脚本支持原解包继续核对后通过，没有重打或修改EXE。包核验使用原有离线TypeScript/ASAR工具（构建完成后才在快照链接），这些工具不因此进入应用生产依赖。Vite保留单chunk超500kB提示，不作为性能准出。

实际包内测试首轮68项46通过/22失败：夹具只链接了包内后台/依赖，缺少通道测试所需扩展client文件；[首轮TAP](../../../artifacts/browser-agent/2026-10-31/packaged-browser-contract-initial.tap)。补为从实际EXE内ZIP核验并解出原18文件后68/68，产品与EXE均未改；没有用工作树生产CJS替代包内模块。测试源来自当前工作树，原生Node/生产模块/扩展client来自该EXE，清理仅测试临时目录。

原公开alpha.71的实际本地文件重新核对为132300845字节、原SHA不变；[保留核验](../../../artifacts/browser-agent/2026-10-31/public-alpha71-preserved.json)。

[源码绑定复核](../../../artifacts/browser-agent/2026-10-31/browser-package-source-binding.json)检查258项输入：运行源码原字节匹配；桌面package只允许开发版本派生，格式差异不作为产品变化，JSON语义核对一致。源/快照目录与当前运行profile分离；首次D盘准备失败的[记录](../../../artifacts/browser-agent/2026-10-31/browser-package-preparation-failure.json)保留。

真实ChatGPT登录/完成选择器、生产optional权限同意、原生Codex/OpenCode/Claude父模型、Browser跨设备与Linux Chrome、复杂手动分支/账号切换/虚拟化、负载及完整故障矩阵仍未完成；Kimi尚无Driver/执行注册，已提交网页Stop不支持。最低Chrome120仅manifest声明，本轮实际Chrome148。公开alpha.71字节与标签保持；安装目录须稳定，换解压路径可能换开发扩展ID，不能靠换身份释放unknown。

## 文档与复现

本轮关联M10-F01/F02/F03、M06-F01/F05及AB-F03/F07/F08/F09/F10/F11；同步整体设计、M10/M06设计与报告、架构/数据/协议的产物边界、整体验证、路线、安装及迭代索引。没有新增运行协议或Core迁移。

最终`node scripts/check-docs.mjs`实际退出1：302份Markdown，2243条原有缺失，新增/消失错误均0；[原检查JSON](../../../artifacts/browser-agent/2026-10-31/docs-browser-package-final.json)、[原基线差异](../../../artifacts/browser-agent/2026-10-31/docs-browser-package-final-delta.json)。`git diff --check`通过。公开alpha.71仍是原版本；本地store开发包的普通窗口、受控链路与真实Provider/原生父模型分开，不能合并成“开发验证完成”。实际ASAR中另核对ws原MIT许可1183字节与安装来源一致，[许可核验](../../../artifacts/browser-agent/2026-10-31/desktop-ws-license-check.json)。

```powershell
npm run browser:pack
node --test desktop/tests/browser-package.test.cjs
# 实际ZIP/MV3测试须已安装Playwright Chromium；隔离profile与受控网页，不调用Provider服务。
$env:AGENTBRIDGE_TEST_CHROMIUM='<已安装Chromium可执行文件>'
$env:AGENTBRIDGE_BROWSER_EVIDENCE_DATE='2026-10-31'
$env:AGENTBRIDGE_BROWSER_REPORT='mv3-extension-bundle.json'
$env:AGENTBRIDGE_TEST_HEALTH='1'
$env:AGENTBRIDGE_TEST_PRECONTENT_CANCEL='1'
$env:AGENTBRIDGE_TEST_CANCELLED_SESSION_CLOSE='1'
$env:AGENTBRIDGE_TEST_CANCEL_PREPARED='1'
node desktop/tests/browser-package-live.cjs
node scripts/check-docs.mjs
```
