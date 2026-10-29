# alpha.69 维护预发布交付

日期：2026-10-29（Asia/Hong_Kong）。承接公开alpha.68，候选版本0.6.0-alpha.69；本记录随实际构建、验证与公开下载更新，不将待执行项记为通过。

## 本轮范围

- Pi派发/原生事件使用同一真实目录规则，Claude已选JS入口经Node启动；[需求、实现和原反例](pi-workspace-events-and-windows-validation.md)。
- SSH中文profile原密文清理及经典原生MCP列表沿原安装启动；[跨平台验证与边界](windows-regression-and-native-probes.md)。
- 原生MCP配置并发修改、目标切换和原子替换失败后，只删除本次准确临时文件；[原失败与运行时对照](mcp-config-temporary-cleanup.md)。
- Core连接检查/高级向导复用原安装版本启动器；[实现与原Windows回归](core-windows-installation-checks.md)。
- Edge事件ACK超时立即退役原运输，按原execution/seq补传，不重派任务；[根因与验证](edge-outbox-reconnect.md)。
- 仓库根双击界面预览入口、Windows/Linux验证器平台边界和文档测试清理；保留原生配置、原ID和unknown。预览只使用合成数据。

## 冻结、兼容与证据范围

本轮223项产品/依赖输入固定后才构建。alpha.68兼容清单来自SHA-256核对通过的实际公开EXE，1725份Linux文件逐一校验，规范manifest摘要`ac00383bcb2176c5751d7000f220164117d613c58245a49bf12d42c3cc9dd06b`；新增pin不触发远端部署。最初沿旧嵌套归档格式的导入器未找到app-64.7z，改为从此EXE实际资源布局提取后完成核对；不把导入失败记为产品测试。

本轮原始材料位于`artifacts/release-alpha69/2026-10-29/`；各修复早期失败、组件与真实原生证据仍在上述专项，不能合并为本次EXE重新实测。最终构建、工程检查、普通EXE和公开下载结果待实际完成后写入下节。

## 保留边界

当前仍为未签名预发布，不代表正式0.6.0准出。不访问或切换日常profile/后台，不部署独立SSH，不调用真实模型；真实用户profile恢复、父模型自主委派/多主、原生等待/网关取消、完整I06C/I07C/MCP02、图100ms及冷启动/WSL仍未准出。原unknown只查原ID；取消/权限收据confirmed不作为业务成功或已取消的证明。历史全量失败不改写；文档原2243项缺失及依赖审计问题按实际结果保留。
