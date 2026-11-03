# Browser接入源码试用说明

2026-11-01更新：已交付包含当前ChatGPT源码及19文件扩展的browser.3 Windows体验包。通过同目录非C盘启动脚本使用，包内Node 72/72及实际EXE载荷核验通过；本包尚无普通GUI/真实模型验收，旧browser.2证据保留为历史。[最新体验包与准确边界](web-agent-browser3-preview.md)。

当前仅支持ChatGPT Web，Kimi不在本轮范围。匿名新版布局需使用[本轮19文件开发ZIP与当前源码后台](web-agent-live-chatgpt.md)，此前browser.2 EXE是旧DOM版本；不要将其包内旧扩展当作当前四轮实测产物。加载未打包扩展须在该Chrome打开开发者模式，固定原路径/profile并保留配对；有unknown时不得重载/换身份绕过。

2026-10-31；当前开发源码/扩展ZIP，公开alpha.71不包含本功能。线上ChatGPT账号、可选网页权限确认、原生父模型、跨设备和完整控制验收尚未完成，不作为发布版使用承诺。[当前证据与限制](web-agent-development.md)。

## 安装扩展

使用Chrome/Edge的独立测试profile。打开浏览器扩展管理页，启用开发者模式，选择“加载已解压的扩展程序”，指向仓库的[browser-extension](../../../browser-extension/manifest.json)所在目录。该包使用原生MV3，无需额外npm构建；最低声明Chrome120，实际受控验收使用Chromium148。保持扩展目录位置稳定，搬动目录可能改变开发扩展ID，原配对不会自动转移。

也可运行`npm run browser:pack`生成开发ZIP，按[产物清单与SHA](web-agent-packaging.md)核验后解压到固定目录，再加载其中manifest所在目录。该ZIP包含MIT/OFL许可与安装说明，没有profile、账号或配对凭据；不直接把ZIP选作解压目录。不因重新解压而清空扩展存储或更换原身份，unknown继续查询原ID。

点击扩展图标打开“浏览器接入”。复制页面中的完整扩展ID。设置页只显示Bridge连接与网页访问权限；登录始终在Provider网页进行，勿向配对框填写账号、Cookie、Token或密码。

## 配对与接入

1. 构建并启动当前源码桌面程序，进入“设置 → 浏览器接入”。旧公开后台会提示能力不足；按原后台升级流程处理，不自动覆盖后台或任务。
2. 选择浏览器所在机器。浏览器必须连接该设备Node的127.0.0.1；不能在本地浏览器粘贴另一台机器的loopback地址当跨设备通道。WSL暂未提供独立网页配对宿主。
3. 填入扩展ID，生成配对包，点击“复制配对包”；在两分钟内粘贴到原扩展设置页并连接。首次认证失败且尚未保存凭据时，扩展显示原配对修正表单；只重新粘贴同一原包，不更换身份。过期pending不能延长认证，committed原凭据仍可重连。
4. 回应未确认、页面重开或配对包过期时，使用“查询原配对”。未找到不会自动另建身份。原pending配对需先按原记录撤销，不能靠重配释放旧任务占用。
5. 在扩展设置页点击“授权 ChatGPT 网页”，由浏览器确认站点权限。手动在ChatGPT网页完成登录。设置页连接成功及权限已授予均不能代替真实回复验证。
6. 返回桌面，重新扫描来源机器并接入ChatGPT Web节点。它只接收普通授权委派，不能作为MCP主节点或接受托管小队scope。

已提供本地开发ZIP及独立`0.6.0-alpha.71.browser.2`开发EXE，后者已核对载荷与原profile普通启动/退出；均未发布，也不等于真实Provider/父模型已验收。包中按原extraResources收录`resources/browser-extension`的同字节ZIP与校验文件；无扩展商店条目、EXE内导出流程或自动升级。首个browser.1缺ws不能使用；当前产物位置及全部边界见[交付记录](web-agent-packaging.md)。不要在旧公开EXE中查找该源码入口。Kimi当前没有Driver和执行注册。

## 调用与恢复

由现有Codex/OpenCode/Claude Code等已授权调用方使用经典MCP的list_agents/delegate/task_result。新消息使用稳定requestId；续聊传原delegate返回的conversationId，必须保持同一原父执行或独立MCP接入身份。换父Task不能认领旧子会话，unknown时不开放新一轮。MCP结果仍为轮询，网页正文修订进入原Task事件和结果。

任务使用扩展新建的独立网页标签页。运行时保留该页，避免输入草稿、发送额外消息、切换分支或导航。遇到登录、验证码、站点限制或网页结构不匹配时交由用户在网页处理，不调用私有API或绕过站点限制。

当前续聊还核对原完成时的可见对话摘要和页面历史版本。同消息ID的编辑、重生成、编辑后还原或旧文档变化都会拒绝自动接管；原成功结果仍保留。升级前的成功记录若缺该证明只能读取，不补造摘要续聊。canContinue只是Bridge侧资格，实际发送仍须原页即时检查；失败后保留原ID，不以换页或新消息重放旧任务。

扩展提供暂停和恢复原连接，不删除配对身份或重发旧Prompt。“撤销配对”须确认原浏览器身份，随后拒绝该配对连接；暂停、撤销、关页或Stop控件消失均不等于任务取消。当前只支持尚未授权页面提交的安全取消：原cancel_task/ipc.cancel先保存意图，匹配扩展持久封存证明才Task.cancelled；不清除人工草稿。已授权/已提交、旧缺标记或回应未知时保留原Task/operationId，网页Stop尚未适配；丢回应使用cancel_task({taskId,operationId,queryOnly:true})只读核对原取消收据，再读task_result，不发第二取消ID。新版stdio会先检查原后台cancel.query-v1；旧后台缺支持明确拒绝而不执行取消，目标旧收据无可核验任务/种类也不作证明。更新原后台和原MCP接入运行时，不换身份。用户清空草稿后还须明确新请求与原会话预检，不自动重发已取消的输入。桌面可查看历史与结果，不增加日常聊天入口。

当前源码RPC另提供原ipc.session.close：仅空闲最新轮次与原绑定版本，关闭Bridge后续写入而保留原Task结果和网页历史；没有新增桌面关闭按钮或MCP工具。关闭回应未知只查询原operationId，不重发关闭或Prompt，unknown任务本身不能靠关闭释放。

若取消发生在resume/prepare前，扩展可能没有本轮请求行；当前源码会以原已确认取消封存及既有Session恢复health/close，不创建影子请求。继承旧会话的prepared取消也需原扩展封存；全新无绑定prepared仍可本地取消。缺封存、错误原meta或已有同/更高lease新轮次时不关闭/改绑旧会话；旧本地confirmed不会被补造成扩展证据。健康只读，不代替取消核对；关闭后若有新需求须明确新请求/新Session，不自动重发旧输入。

源码另提供只读原ipc.session.health（原taskId、probeId，可选executionId）：区分通道、站点授权、原document检查、存储/任务占用及陈旧性。ready不证明账号、不放行unknown，也不是未来提交许可；经典MCP仍十工具，未新增健康或关闭按钮。更新源码时一并重新加载同一路径扩展；原未确认任务/操作继续查询原ID，不清空原记录换身份。
