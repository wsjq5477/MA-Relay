const assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module'),{test}=require('node:test');
process.env.TSX_TSCONFIG_PATH=path.resolve(__dirname,'../tsconfig.json');
const {require:requireTsx}=require('tsx/cjs/api'),desktopRequire=createRequire(path.resolve(__dirname,'../package.json'));
const React=desktopRequire('react'),{renderToStaticMarkup}=desktopRequire('react-dom/server');
const Dialog=requireTsx('../src/AgentConfigurationDialog.tsx',__filename).default;
const {SettingsPage}=requireTsx('../src/WorkspacePages.tsx',__filename);
const Inventory=requireTsx('../src/MachineInventory.tsx',__filename).default;
const {connectionCapabilities:backendCapabilities}=require('../electron/builtin-adapters.cjs');
const machine={machineId:'wsl',name:'WSL 目标机器',kind:'wsl',platform:'linux',online:true};
const node=(adapter,extra={})=>({nodeId:'original-'+adapter,machineId:'wsl',adapter,name:adapter,executable:'/original/'+adapter,connected:true,online:true,healthy:true,busy:false,available:true,executionSupported:true,activeTasks:0,status:'connected',...extra});
// Use the reviewed backend projection, never a local UI product list.
const projected=(adapter,extra={})=>Object.assign(node(adapter,extra),backendCapabilities(node(adapter,extra)));
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props)),noop=()=>{};

test('global settings retains appearance/background/recovery and contains no Agent-specific configuration',()=>{
 const html=render(SettingsPage,{preferences:{theme:'system'},onTheme:noop,directory:'fixture',machines:[machine],nodes:[node('codex'),node('dsh-web')],journal:[],recoveryItems:[],machineName:()=>machine.name,busy:false,managementLocked:false,machineManagementSupported:true,onRestore:noop,onCloseWindow:noop,onStop:noop,querying:false,onQuery:noop});
 assert.match(html,/后台运行/);assert.match(html,/未确认操作/);assert.match(html,/外观/);
 assert.doesNotMatch(html,/settings-mcp|settings-dsh|添加 Bridge MCP|DSH 服务地址|DSH 连接 token/);
});
test('every agent with a manageable native config gets one unified AgentBridge MCP section bound to its own node',()=>{
 // OpenDesk CLI is excluded: 0.3.8 has no native MCP manager, so it stays
 // export-only in the same unified section (asserted below).
 for(const adapter of ['claude','codex','opencode','opendesk-desktop','dsh-web']){
  const html=render(Dialog,{node:projected(adapter),machine,onClose:noop});
  assert.match(html,/WSL 目标机器/);assert.match(html,/AgentBridge MCP 操作/);assert.match(html,/添加 Bridge MCP/);
  assert.doesNotMatch(html,/MCP 目标 Agent|<select|两种 MCP 安装模式/);
  if(!adapter.startsWith('dsh-'))assert.doesNotMatch(html,/DSH 连接 token/);
  assert.doesNotMatch(html,/原生工具配置/,adapter+' must not fall back to a second MCP install mode');
  if(adapter==='opendesk-desktop')assert.match(html,/原生工作目录.*连接断开/);
 }
 for(const adapter of ['opendesk']){
  const html=render(Dialog,{node:projected(adapter),machine,onClose:noop});
  assert.match(html,/AgentBridge MCP 操作/);
  assert.match(html,/该产品已有 MCP 客户端，但 Bridge 暂不能管理它的原生 MCP 配置/);
  assert.doesNotMatch(html,/<button[^>]*>添加 Bridge MCP/);
  assert.match(html,/<button[^>]*>生成独立 MCP 文件/);
 }
});
test('a product with an MCP client but no Bridge-managed native config keeps manual configuration honest',()=>{
 // DSH Web manages a fixed profile; DSH Desktop owns a reserved application
 // profile Bridge has no reviewed path for, so it stays export-only.
 const html=render(Dialog,{node:projected('dsh-desktop'),machine,onClose:noop});
 assert.match(html,/AgentBridge MCP 操作/);
 assert.match(html,/该产品已有 MCP 客户端，但 Bridge 暂不能管理它的原生 MCP 配置/);
 assert.doesNotMatch(html,/<button[^>]*>(添加 Bridge MCP|移除 Bridge MCP|重新探测原生列表|撤销连接授权)/);
 assert.match(html,/<button[^>]*>生成独立 MCP 文件/,'manual native configuration still gets a standard fragment');
 assert.match(html,/原生工具配置/);assert.match(html,/安装位置/);
 assert.doesNotMatch(html,/当前接入暂不支持添加 Bridge MCP|该产品未确认提供 MCP 客户端/);
});
test('DSH CLI asks for the launch profile instead of guessing one',()=>{
 const html=render(Dialog,{node:projected('dsh'),machine,onClose:noop});
 assert.match(html,/AgentBridge MCP 操作/);
 assert.match(html,/DSH 原生 profile/);
 assert.match(html,/Bridge 不会猜测目标 profile/);
 assert.match(html,/<button[^>]*>添加 Bridge MCP/,'the DSH CLI entry becomes manageable once a profile is named');
 assert.doesNotMatch(html,/该产品已有 MCP 客户端，但 Bridge 暂不能管理它的原生 MCP 配置/);
});
test('DSH service connection is configured separately from the unified MCP section',()=>{
 for(const adapter of ['dsh-desktop','dsh-web']){
  const html=render(Dialog,{node:projected(adapter),machine,onClose:noop});
  assert.match(html,/DSH 服务连接/);assert.match(html,/type="password"/);assert.match(html,/autoComplete="off"/);
  assert.match(html,/AgentBridge MCP 操作/);
  assert(html.indexOf('AgentBridge MCP 操作')<html.indexOf('DSH 服务连接'),'the MCP operation precedes the separate service connection');
  assert.doesNotMatch(html,/DSH 目标机器|DSH 版本|<select/);
 }
});
test('a backend without the capability contract shows the honest upgrade note and no install button',()=>{
 for(const adapter of ['claude','codex','opencode','opendesk','opendesk-desktop','dsh','dsh-desktop','dsh-web','hermes','pi']){
  const html=render(Dialog,{node:node(adapter),machine,onClose:noop});
  assert.match(html,/当前后台未报告此 Agent 的原生 MCP 配置能力/,adapter);
  assert.match(html,/升级后台/,adapter);
  assert.doesNotMatch(html,/添加 Bridge MCP/,adapter+' must not offer a write it cannot verify');
  assert.match(html,/原生工具配置/);assert.match(html,/安装位置/);
 }
});
test('an explicitly unsupported product keeps the native boundary and offers no MCP writes',()=>{
 for(const adapter of ['hermes','pi']){
  const html=render(Dialog,{node:projected(adapter),machine,onClose:noop});
  assert.match(html,/该产品未确认提供 MCP 客户端/);
  assert.doesNotMatch(html,/<button[^>]*>(添加 Bridge MCP|移除 Bridge MCP|撤销连接授权|重新探测原生列表)/);
  assert.match(html,/<button[^>]*>生成独立 MCP 文件/,'a manual fragment stays possible without claiming native support');
  assert.match(html,/原生工具配置/);assert.match(html,/安装位置/);
  assert.doesNotMatch(html,/<input/);
 }
});
test('configuration sits to the right of session action and stays reachable when execution is occupied',()=>{
 const target={...node('codex'),unconfirmed:1,available:false};
 const html=render(Inventory,{machines:[machine],nodes:[target],relation:{leaderId:null,memberIds:[],revision:0},filter:'all',query:'',busy:false,metadataBusy:true,managementSupported:true,machineManagementSupported:true,daemonManagementSupported:true,blocked:()=>true,start:noop,attach:noop,configure:noop,nodeAction:noop,addAgent:noop,machineAction:noop});
 const actions=html.slice(html.indexOf('inventory-node-actions'));
 assert(actions.indexOf('开始会话')<actions.indexOf('inventory-configure'));
 assert.match(actions,/<button[^>]*disabled=""[^>]*>开始会话/);
 assert.match(actions,/<button[^>]*inventory-configure[^>]*aria-label="配置 WSL 目标机器 \/ codex"[^>]*>/);
 assert.doesNotMatch(actions.match(/<button[^>]*inventory-configure[^>]*>/)[0],/disabled/);
});
test('an unavailable original source remains identified in a read-only configuration view',()=>{
 const html=render(Dialog,{node:projected('dsh-web'),machine,unavailable:true,onClose:noop});
 assert.match(html,/配置仅供查看/);assert.match(html,/WSL 目标机器/);assert.match(html,/DSH 服务地址[^>]*.*disabled=""/);
 assert.match(html,/AgentBridge MCP 操作/);
 assert.match(html,/<button\b[^>]*disabled[^>]*>添加 Bridge MCP/);
});
