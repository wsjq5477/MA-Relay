# ChatGPT Web最新Windows体验包browser.3

2026-11-01（Asia/Hong_Kong）。用户要求生成最新EXE供体验。本次仅构建和交付本地开发包，不发布、推送或替换公开alpha.71；真实父模型验收和原Codex unknown仍未解决。本次没有增加原生/Provider模型API、修改Codex恢复代码或运行新的模型调用。

## 产物与启动

- 版本：0.6.0-alpha.71.browser.3，Windows x64便携EXE，未签名。
- [启动体验版.cmd](../../../artifacts/exe-preview-20261101/delivery/启动体验版.cmd)；[EXE](../../../artifacts/exe-preview-20261101/delivery/AgentBridge-0.6.0-alpha.71.browser.3-Windows-x64.exe)；[使用说明](../../../artifacts/exe-preview-20261101/delivery/使用说明.txt)。
- EXE 132399060字节；SHA-256 252ec440d776b77c072dbd793ef5386e00fd1a62b6cd5569e1ccd93a93b3fbc3；[校验文件](../../../artifacts/exe-preview-20261101/delivery/AgentBridge-0.6.0-alpha.71.browser.3-Windows-x64.exe.sha256)。
- 同目录附ChatGPT-only的19文件扩展ZIP/逐文件清单/SHA；包内resources/browser-extension包含相同字节。扩展需要解压到固定非C盘目录并在浏览器加载、配对和授权，不会因启动EXE而自动安装。

必须通过同目录启动脚本运行，且整个目录位于非C盘。脚本在创建任何体验目录前拒绝C盘，设置TEMP/TMP、APPDATA/LOCALAPPDATA、USERPROFILE、XDG目录和原有AGENTBRIDGE_DESKTOP_PROFILE到同目录ExperienceData，清除ELECTRON_RUN_AS_NODE。便携包装器因此使用非C盘TEMP解压；直接双击EXE仍可能使用Windows默认C盘TEMP。体验配置与旧桌面配置分开，不接管旧后台，不迁移原unknown；保留整个体验目录。

## 构建输入和实际验证

| 层级 | 实际结果与证据 |
| --- | --- |
| 源码冻结 | 615项输入与当前工作树逐字节SHA匹配；仅快照desktop/package.json派生开发版本，原公开版本保持；[输入清单](../../../artifacts/exe-preview-20261101/source.json) |
| 工程构建 | 根typecheck/build及桌面typecheck+Vite build通过；有原前端chunk大于500kB提示，不称性能准出；[根类型](../../../artifacts/exe-preview-20261101/root-typecheck.log)、[根构建](../../../artifacts/exe-preview-20261101/root-build.log)、[桌面构建](../../../artifacts/exe-preview-20261101/desktop-build.log) |
| 实际包资源 | 70个后台CJS、84个Core文件、1719个Linux文件；ASAR、前端、bootstrap、ws运行文件及扩展一致；[包核验](../../../artifacts/exe-preview-20261101/package-check.json) |
| EXE实际载荷 | 实际解包后3463个文件的集合/大小/SHA全部与win-unpacked一致；[解包核验](../../../artifacts/exe-preview-20261101/payload-check.json) |
| 包内Electron Node | Electron44.7.0/Nodev24.21.0，实际EXE解出的运行时及后台/依赖运行Host/通道契约72/72通过；受控后端测试，无GUI/Provider/父模型调用；[报告](../../../artifacts/exe-preview-20261101/runtime-check.json)、[TAP](../../../artifacts/exe-preview-20261101/runtime-check.tap) |
| ChatGPT版本 | 扩展SHA f41be4b385772fc24c1c648bde4f7d44d9553b737a4e9c1edea9b869fe77062d；包含新版/经典DOM、异步ARIA就绪、持续会话/输出与原结束失败观察。与[此前真实四轮](web-agent-live-chatgpt.md)扩展摘要一致；不是本包新跑的真实网页验收 |

构建器、依赖、源码快照、缓存、临时目录、配置、日志、解包和包内测试均在D盘，复用的NSIS/7zip缓存从已有E盘缓存复制到D盘；没有读取C盘构建缓存。相关环境入口见[environment.ps1](../../../artifacts/exe-preview-20261101/environment.ps1)。未运行普通GUI/便携启动、登录账号、当前包内真实Web链路、真实原生父模型或跨设备矩阵，不能用Node模式检查替代这些场景。

## 保留的失败及修正

初次快照准备的目录junction因EPERM失败，改为复制桌面依赖，根工具从非C盘现有依赖解析。首轮封装发现当前桌面安装树缺已声明ws8.22.0（工作树依赖由根目录提升可解析），快照明确复制本地相同版本到独立桌面安装树，并继续ASAR逐运行文件核验。

前两次封装分别在依赖.github/workflows和Linux依赖子目录mkdir被EPERM中断：[首轮日志](../../../artifacts/exe-preview-20261101/builder-first-failure.log)、[第二轮日志](../../../artifacts/exe-preview-20261101/builder-second-failure.log)。先移除快照生产依赖中无运行用途的五处.github CI元数据，保留实现与许可，并重建Linux清单；再次受限后，仅封装进程经自动审批在受限沙箱外运行，仍沿用全部D盘路径与同一源码快照。最终通过，失败不覆盖为通过；[修正记录](../../../artifacts/exe-preview-20261101/stage-repair.log)、[最终封装](../../../artifacts/exe-preview-20261101/builder.log)。未修改原项目node_modules或使用C盘缓存。

## 范围与文档

包内契约初次运行的测试夹具未展开实际交付扩展ZIP，50通过/22缺模块失败；补齐实际ZIP逐文件SHA校验和展开后，受限网络环境为56通过/16回环连接失败。随后同一实际EXE与相同测试在沙箱外、相同D盘数据路径下72/72通过，未修改产品代码。三份结果分别保留：[夹具缺失](../../../artifacts/exe-preview-20261101/runtime-check-first-fixture-failure.tap)、[受限连接](../../../artifacts/exe-preview-20261101/runtime-check-sandbox-connection-failure.tap)、[最终通过](../../../artifacts/exe-preview-20261101/runtime-check.tap)。这些均是受控本机后端契约，不是真实网页或原生父模型验收。

源码快照、构建依赖/缓存、实际解包载荷和日志保留在本次artifacts目录用于复验；用户体验只需delivery目录。Node测试自身创建的临时fixture已按测试清理，没有启动生产profile或新模型任务。

关联M10-F01/F03/F05及AB-F03/F07/F08/F10/F11。没有运行时产品代码变化；仅新开发产物、独立启动说明及证据。architecture/data-model/protocol已核对，无新增接口、Schema、Broker或路由变化；既有AGENTBRIDGE_DESKTOP_PROFILE用于体验隔离。整体设计/测试/项目计划、M10完整设计与测试报告、安装/开发台账及迭代索引同步当前包状态。

Kimi不开发、不验收。已提交网页Stop仍不支持；新的原结束失败策略尚未完成当前包内完整线上验收。原生Codex已启动但没有网页委派，原Task仍unknown；11月1日只读原生记录interrupted不是已经写入Bridge终态，恢复补丁未落地。完整开发目标没有因此被标为完成。
