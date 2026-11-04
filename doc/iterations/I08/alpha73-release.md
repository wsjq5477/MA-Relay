# I08 alpha.73 发布记录

2026-11-04。桌面本机 Hermes 自定义运行时进入公开预发布。选择基础类型后填写显示名、命令和可选描述，通过版本探测后沿现有流程接入和授权。[实现与受控验收](custom-runtime-design.md)

- 源码标签 `v0.6.0-alpha.73`，冻结提交 `042c546f3d7d389de1ce4fc1628d7022978a6831`。
- Windows x64 便携 EXE 132443109 字节，SHA-256 `73000602e0c2f267acf81cb4778e05974ed87331f22a0cdd36f43b824605ba65`。文件未签名。[下载](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.73/AgentBridge-0.6.0-alpha.73-Windows-x64.exe) · [校验文件](https://github.com/wsjq5477/MA-Relay/releases/download/v0.6.0-alpha.73/SHA256SUMS.txt)
- Core 类型检查与编译、桌面 TypeScript 与 Vite 构建、定向 Windows 回归 7/7 通过。首轮 Browser 扩展目录换名出现 EPERM，重试 staging 通过。
- EXE 内 3518 个文件的路径、字节数和 SHA-256 与未压缩包一致。EXE 与校验文件均由 GitHub 匿名下载并逐字节核对。
- 文档检查报告 3062 项历史资料链接错误，自定义运行时条目无报错。真实用户 Hermes 命令、Linux、远端创建、完整运行矩阵和便携包 GUI 启动未验收。

[GitHub 发布页](https://github.com/wsjq5477/MA-Relay/releases/tag/v0.6.0-alpha.73)
