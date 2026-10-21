const assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module'),{test}=require('node:test');
process.env.TSX_TSCONFIG_PATH=path.resolve(__dirname,'../tsconfig.json');
const {require:requireTsx}=require('tsx/cjs/api'),desktopRequire=createRequire(path.resolve(__dirname,'../package.json'));
const React=desktopRequire('react'),{renderToStaticMarkup}=desktopRequire('react-dom/server');
const Dialog=requireTsx('../src/AgentConfigurationDialog.tsx',__filename).default;
const {SettingsPage}=requireTsx('../src/WorkspacePages.tsx',__filename);
const Inventory=requireTsx('../src/MachineInventory.tsx',__filename).default;
const machine={machineId:'wsl',name:'WSL 目标机器',kind:'wsl',platform:'linux',online:true};
const node=adapter=>({nodeId:'original-'+adapter,machineId:'wsl',adapter,name:adapter,executable:'/original/'+adapter,connected:true,online:true,healthy:true,busy:false,available:true,executionSupported:true,activeTasks:0,status:'connected'});
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props)),noop=()=>{};

test('global settings retains appearance/background/recovery and contains no Agent-specific configuration',()=>{
 const html=render(SettingsPage,{preferences:{theme:'system'},onTheme:noop,directory:'fixture',machines:[machine],nodes:[node('codex'),node('dsh-web')],journal:[],recoveryItems:[],machineName:()=>machine.name,busy:false,managementLocked:false,machineManagementSupported:true,onRestore:noop,onCloseWindow:noop,onStop:noop,querying:false,onQuery:noop});
 assert.match(html,/后台运行/);assert.match(html,/未确认操作/);assert.match(html,/外观/);
 assert.doesNotMatch(html,/settings-mcp|settings-dsh|添加 Bridge MCP|DSH 服务地址|DSH 连接 token/);
});
test('MCP configuration is bound to one original node and source without a target selector',()=>{
 for(const adapter of ['claude','codex','opencode']){
  const html=render(Dialog,{node:node(adapter),machine,onClose:noop});
  assert.match(html,/WSL 目标机器/);assert.match(html,/Agent MCP 接入/);assert.match(html,/添加 Bridge MCP/);
  assert.doesNotMatch(html,/MCP 目标 Agent|<select|DSH 连接 token/);
 }
});
test('DSH configuration fixes the selected Desktop or Web surface and never offers MCP or another target',()=>{
 for(const adapter of ['dsh-desktop','dsh-web']){
  const html=render(Dialog,{node:node(adapter),machine,onClose:noop});
  assert.match(html,/DSH 服务连接/);assert.match(html,/type="password"/);assert.match(html,/autoComplete="off"/);
  assert.doesNotMatch(html,/DSH 目标机器|DSH 版本|<select|添加 Bridge MCP/);
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
 const html=render(Dialog,{node:node('dsh-web'),machine,unavailable:true,onClose:noop});
 assert.match(html,/配置仅供查看/);assert.match(html,/WSL 目标机器/);assert.match(html,/DSH 服务地址[^>]*.*disabled=""/);
});
test('adapters without Bridge configuration keep their native boundary and do not receive fabricated connection forms',()=>{
 for(const adapter of ['hermes','pi','dsh']){
  const html=render(Dialog,{node:node(adapter),machine,onClose:noop});
  assert.match(html,/原生工具配置/);assert.match(html,/安装位置/);assert.doesNotMatch(html,/<button[^>]*>添加 Bridge MCP|DSH 服务地址|<input/);
 }
});
