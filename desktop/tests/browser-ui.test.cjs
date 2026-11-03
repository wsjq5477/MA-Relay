'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
process.env.TSX_TSCONFIG_PATH=path.resolve(__dirname,'../tsconfig.json');
const {require:requireTsx}=require('tsx/cjs/api');
const {taskEvents,streamingAnswer}=requireTsx('../src/api.ts',__filename);
const {canReceiveDelegation,canCallBridge,canHostManagedTask,canConfigureMcp,connectionCapability}=requireTsx('../src/connection-capabilities.ts',__filename);
const {connectionCapabilities}=require('../electron/builtin-adapters.cjs');
const output=(seq,text,extra={})=>({seq,timestamp:'2026-10-30T00:00:00.000Z',event:{kind:'output',text,...extra}});

test('explicit browser revisions replace corrected or shortened text and preserve raw reconciliation events',()=>{
 const task={message:'Fixture',events:[output(1,'A mistaken answer',{mode:'replace',revision:1}),output(2,'Correct',{mode:'replace',revision:2}),output(3,'OK',{mode:'replace',revision:3})]};
 const before=structuredClone(task);
 assert.equal(streamingAnswer(task,'chatgpt-web'),'OK');const events=taskEvents(task,'chatgpt-web');assert.equal(events.length,1);assert.equal(events[0].event.revision,3);assert.deepEqual(task,before);
});
test('native deltas and snapshots retain their existing behavior and state spans stay separate',()=>{
 assert.equal(streamingAnswer({message:'Fixture',events:[output(1,'你'),output(2,'好')]},'claude'),'你好');
 assert.equal(streamingAnswer({message:'Fixture',events:[output(1,'Hello'),output(2,'Hello world')]},'opencode'),'Hello world');
 const task={message:'Fixture',events:[output(1,'First',{mode:'replace',revision:1}),{seq:2,event:{kind:'progress',text:'State'}},output(3,'Second',{mode:'replace',revision:2})]};assert.equal(taskEvents(task,'chatgpt-web').length,3);
});
test('browser UI accepts only the reviewed profile and static adapter source; passive capability cannot become a caller',()=>{
 const node={adapter:'chatgpt-web',browserInstanceId:'original-profile',executionSupported:true,...connectionCapabilities({adapter:'chatgpt-web'})};
 assert.equal(canReceiveDelegation(node),true);assert.equal(connectionCapability(node,'resume'),true);assert.equal(canCallBridge(node),false);assert.equal(canHostManagedTask(node),false);assert.equal(canConfigureMcp(node),false);assert.equal(connectionCapability(node,'cancellation'),false);
 for(const extra of [{browserInstanceId:undefined},{capabilitySource:undefined},{capabilitySource:{kind:'static-adapter',adapterId:'claude',driver:'browser-extension'}},{capabilitySource:{kind:'static-adapter',adapterId:'chatgpt-web',driver:'native-cli'}}])assert.equal(canReceiveDelegation({...node,...extra}),false);
 assert.equal(canReceiveDelegation({...node,connectionCapabilities:undefined}),false);
});

test('browser configuration exposes the original profile without native MCP management or an installation path',()=>{
 const {createRequire}=require('node:module'),desktopRequire=createRequire(path.resolve(__dirname,'../package.json')),React=desktopRequire('react'),{renderToStaticMarkup}=desktopRequire('react-dom/server');
 const Dialog=requireTsx('../src/AgentConfigurationDialog.tsx',__filename).default;
 const node={nodeId:'browser-node',machineId:'fixture-machine',adapter:'chatgpt-web',name:'ChatGPT Web',browserInstanceId:'original-profile',online:true,executionSupported:true,...connectionCapabilities({adapter:'chatgpt-web'})};
 const html=renderToStaticMarkup(React.createElement(Dialog,{node,machine:{name:'Test machine',online:true},onClose(){}}));
 assert.match(html,/网页接入/);assert.match(html,/original-profile/);assert.match(html,/设置 → 浏览器接入/);assert.doesNotMatch(html,/settings-mcp|添加 Bridge MCP|安装位置|原生工具配置/);
});
