// Production renderer, isolated IPC, Chromium. Never submits a model task.
// I08-MCP02: OpenDesk keeps independent MCP calling but no hosted-task binding.
// A full MCP audit run must also click the unified card's 重新探测原生列表
// (mcp.probe) and 撤销连接授权 (mcp.revoke + window.confirm); the legacy mcp.*
// fixture below deliberately returns status only and never exercises those two.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const output=path.resolve(process.argv[2]);fs.mkdirSync(output,{recursive:true});
const report={date:new Date().toISOString(),environment:'WSL Chromium / production renderer / controlled IPC / OpenDesk rows',modelCalls:0,status:'running',checks:[],pageErrors:[]};
let browser,server,page;
function setup(registry){
 const machines=[{machineId:'windows',name:'Windows 本机',kind:'windows',platform:'win32',online:true},{machineId:'wsl',name:'WSL Ubuntu',kind:'wsl',distribution:'Ubuntu',platform:'linux',online:true}];
 const targets=[['windows','opendesk-desktop','OpenDesk Desktop'],['wsl','opendesk','OpenDesk'],['windows','claude','Claude Code'],['windows','codex','Codex'],['windows','dsh-desktop','DSH Desktop'],['wsl','claude','Claude Code'],['wsl','opencode','OpenCode'],['wsl','dsh-web','DSH Web'],['wsl','hermes','Hermes']];
 const nodes=targets.map(([machineId,adapter,name])=>({nodeId:machineId+'-'+adapter,machineId,adapter,name,executable:'/controlled/'+machineId+'/'+adapter,version:'2.0.24',connected:!adapter.startsWith('opendesk'),online:true,healthy:true,busy:false,available:!adapter.startsWith('opendesk'),executionSupported:true,activeTasks:0,status:adapter.startsWith('opendesk')?'discovered':'connected',...registry[adapter]}));
 const connections={windows:[{adapter:'dsh-desktop',origin:'http://127.0.0.1:43120',enabled:true,executable:'/controlled/windows/dsh-desktop'},{adapter:'dsh-desktop',origin:'http://127.0.0.1:43121',enabled:true,executable:'/other/desktop'}],wsl:[{adapter:'dsh-web',origin:'http://127.0.0.1:3080',enabled:true,executable:'/controlled/wsl/dsh-web'},{adapter:'dsh-desktop',origin:'http://127.0.0.1:49000',enabled:true,executable:'/wrong/adapter'}]};
 const states=Object.fromEntries(nodes.map(node=>[node.nodeId,{enabled:false,installed:false,conflict:false,configPath:'/controlled/'+node.nodeId+'.json',state:'absent'}]));
 window.configTest={calls:[],states,connections,holdRead:'',releaseRead:null,holdWrite:false,releaseWrite:null,offline:false};
 const layout={version:1,layoutRevision:0,groups:{},nodes:{},viewport:{x:0,y:0,zoom:1}};
 window.agentbridge={preferences:async()=>({theme:'dark',directory:'configuration-ui',platform:'win32',version:'test'}),savePreferences:async value=>value,pending:async()=>[],recoverPending:async()=>({resolved:0,items:[]}),call:async(method,p={})=>{
  const state=window.configTest;state.calls.push({method,params:p});let result;
  if(method==='snapshot')result={configured:true,directory:'configuration-ui',machines:machines.map(machine=>({...machine,online:!(state.offline&&machine.machineId==='wsl')})),nodes:nodes.map(node=>({...node,online:!(state.offline&&node.machineId==='wsl')})),nodeManagement:true,machineManagement:true,daemonManagement:true,status:{connected:true,connectionState:'connected'},agents:{items:[],revision:0,connected:true},tasks:[],conversations:[],collaboration:{leaderId:null,memberIds:[],revision:0}};
  else if(method==='graphPending')result=[];
  else if(method==='graphLayout')result=layout;
  else if(method==='saveGraphLayout')result={operationId:p.operationId,state:'confirmed',data:{...p.layout,layoutRevision:1}};
  else if(method==='manageNode'&&p.action==='attach'&&['windows-opendesk-desktop','wsl-opendesk'].includes(p.nodeId)){
   const node=nodes.find(node=>node.nodeId===p.nodeId);if(node.machineId!==p.machineId)return {ok:false,error:{code:'WRONG_TARGET',message:'Wrong original machine'}};
   Object.assign(node,{connected:true,available:true,status:'connected'});result={operationId:p.operationId,state:'confirmed'};
  }
  else if(method==='mcp.status'){
   if(state.holdRead===p.nodeId)return new Promise(resolve=>{state.releaseRead=()=>resolve({ok:true,result:{...states[p.nodeId],configPath:'/late-old-target.json'}});});
   result=states[p.nodeId];
  }else if(method.startsWith('mcp.')){
   const original=states[p.nodeId];if(!original)return {ok:false,error:{code:'WRONG_TARGET',message:'Unknown target'}};
   result=states[p.nodeId]={...original,enabled:method!=='mcp.remove',installed:method==='mcp.install',state:method==='mcp.install'?'installed':method==='mcp.export'?'exported':'absent'};
  }else if(method==='dsh.status')result={items:connections[p.machineId]};
  else if(method==='dsh.configure'){
   const commit=()=>{
    const row=connections[p.machineId].find(item=>item.adapter===p.adapter&&item.origin===new URL(p.url).origin);
    if(p.enabled!==undefined)row.enabled=p.enabled;
    return {ok:true,result:{items:connections[p.machineId]}};
   };
   if(state.holdWrite)return new Promise(resolve=>{state.releaseWrite=()=>resolve(commit());});
   return commit();
  }else return {ok:false,error:{code:'FIXTURE_READ_ONLY',message:'Unimplemented test method'}};
  return {ok:true,result};
 }};
}
(async()=>{
 const dist=path.resolve(__dirname,'../dist');
 server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.join(dist,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname));if(!file.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}try{res.setHeader('content-type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 const {adapters,connectionCapabilities}=require('../electron/builtin-adapters.cjs');
 const registry=Object.fromEntries(adapters.list().map(d=>{const n={adapter:d.id,executionSupported:true,teamCollaboration:d.capabilities.teamCollaboration};return [d.id,{teamCollaboration:n.teamCollaboration,...connectionCapabilities(n)}];}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.AGENTBRIDGE_TEST_BROWSER?{executablePath:process.env.AGENTBRIDGE_TEST_BROWSER}:{})});report.browser=browser.version();page=await browser.newPage({viewport:{width:1440,height:1000}});await page.addInitScript(setup,registry);page.on('pageerror',error=>report.pageErrors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const button=(machine,name)=>page.getByRole('button',{name:'配置 '+machine+' / '+name,exact:true});
 const dialog=page.getByRole('dialog');
 await expect(button('Windows 本机','Claude Code')).toBeVisible();
 for(const name of ['OpenDesk Desktop','OpenDesk']){
  const row=page.locator('.inventory-node').filter({has:page.getByRole('heading',{name,exact:true})});
  await expect(row).toContainText('已发现，待接入');await expect(row).not.toContainText('尚未支持执行');await expect(row).not.toContainText('执行能力未知');
  await expect(row.getByRole('button',{name:'接入',exact:true})).toBeEnabled();await row.getByRole('button',{name:'接入',exact:true}).click();
  await expect(row.getByRole('button',{name:'开始会话',exact:true})).toBeEnabled();await row.getByRole('button',{name:'开始会话',exact:true}).click();
  await expect(dialog).toContainText('新建会话');await expect(dialog).toContainText(name);
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);await expect(dialog).toContainText('可调用 Bridge MCP');await expect(dialog).toContainText('托管任务绑定未适配');await expect(dialog).not.toContainText('暂不能调用 Bridge MCP');await dialog.getByRole('button',{name:'关闭新建会话',exact:true}).click();await expect(dialog).toHaveCount(0);
 }
 report.checks.push('Both OpenDesk surfaces attach on their original machine and open a direct-session composer; independent MCP calling stays available while hosted-task binding stays unadapted');
 const row=page.locator('.inventory-node').filter({has:page.getByRole('heading',{name:'Codex',exact:true})});
 const startBox=await row.getByRole('button',{name:'开始会话',exact:true}).boundingBox(),configBox=await button('Windows 本机','Codex').boundingBox();assert(configBox.x>=startBox.x+startBox.width);
 await page.screenshot({path:path.join(output,'agent-rows.png'),fullPage:true});
 await page.getByRole('button',{name:'设置',exact:true}).click();await expect(page.locator('.settings-mcp,.settings-dsh')).toHaveCount(0);await expect(page.getByRole('heading',{name:'未确认操作',exact:true})).toBeVisible();
 assert.equal(await page.evaluate(()=>window.configTest.calls.filter(call=>['mcp.status','dsh.status'].includes(call.method)).length),0);
 report.checks.push('Configuration is right of session action; global Settings contains no Agent cards or eager configuration reads');
 await page.getByRole('button',{name:'机器与 Agent',exact:true}).click();await button('Windows 本机','Claude Code').click();await expect(dialog).toContainText('Windows 本机 · Claude Code');await expect(dialog.locator('select')).toHaveCount(0);await expect(dialog.getByRole('button',{name:'添加 Bridge MCP',exact:true})).toBeEnabled();
 await dialog.getByRole('button',{name:'添加 Bridge MCP',exact:true}).click();await expect(dialog).toContainText('已添加到用户配置');await dialog.getByRole('button',{name:'生成独立 MCP 文件',exact:true}).click();await expect(dialog).toContainText('已生成独立文件');await dialog.getByRole('button',{name:'移除 Bridge MCP',exact:true}).click();await expect(dialog).toContainText('已移除 Bridge MCP');
 await page.screenshot({path:path.join(output,'mcp-dialog.png'),fullPage:true});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(button('Windows 本机','Claude Code')).toBeFocused();
 let calls=await page.evaluate(()=>window.configTest.calls.filter(call=>['mcp.install','mcp.export','mcp.remove'].includes(call.method)));assert(calls.every(call=>call.params.nodeId==='windows-claude'));
 report.checks.push('MCP install/export/remove binds Windows Claude with no selector; Escape restores row focus');
 await page.evaluate(()=>{window.configTest.holdRead='wsl-claude';});await button('WSL Ubuntu','Claude Code').click();await expect(dialog).toContainText('WSL Ubuntu · Claude Code');await expect.poll(()=>page.evaluate(()=>!!window.configTest.releaseRead)).toBe(true);await page.keyboard.press('Escape');await button('Windows 本机','Codex').click();await expect(dialog).toContainText('/controlled/windows-codex.json');await page.evaluate(()=>window.configTest.releaseRead());await expect(dialog).not.toContainText('late-old-target');
 await page.keyboard.press('Escape');report.checks.push('Same-name Agents route to their original machine/node, and late old status cannot enter another dialog');
 for (const [machine, name, id] of [['Windows 本机','OpenDesk Desktop','windows-opendesk-desktop'],['WSL Ubuntu','OpenDesk','wsl-opendesk']]) {
  await button(machine,name).click();await expect(dialog).toContainText(machine+' · '+name);if(id==='windows-opendesk-desktop')await expect(dialog).toContainText('桌面会话沿用 OpenDesk 原生工作目录');await expect(dialog.getByRole('button',{name:'添加 Bridge MCP',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'添加 Bridge MCP',exact:true}).click();await expect(dialog).toContainText('请重新打开原生程序');
  await dialog.getByRole('button',{name:'移除 Bridge MCP',exact:true}).click();await expect(dialog).toContainText('已移除 Bridge MCP');await expect(dialog.getByRole('button',{name:'关闭 Agent 配置',exact:true})).toBeEnabled();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  const own=await page.evaluate(id=>window.configTest.calls.filter(c=>['mcp.install','mcp.remove'].includes(c.method)&&c.params.nodeId===id),id);assert.equal(own.length,2);
 }
 report.checks.push('OpenDesk CLI and desktop each expose add/remove MCP on their exact original machine and node');
 await button('Windows 本机','DSH Desktop').click();await expect(dialog.getByLabel('DSH 服务地址',{exact:true})).toHaveValue('http://127.0.0.1:43120/');await expect(dialog).not.toContainText('43121');await expect(dialog.locator('select')).toHaveCount(0);await dialog.getByLabel('DSH 连接 token',{exact:true}).fill('discarded-fixture-token');await page.keyboard.press('Escape');
 await button('WSL Ubuntu','DSH Web').click();await expect(dialog.getByLabel('DSH 服务地址',{exact:true})).toHaveValue('http://127.0.0.1:3080/');await expect(dialog.getByLabel('DSH 连接 token',{exact:true})).toHaveValue('');await expect(dialog.getByLabel('DSH 连接 token',{exact:true})).toHaveAttribute('type','password');await expect(dialog).not.toContainText('49000');
 report.checks.push('DSH preloads only the exact installation and surface; closing or changing node clears the masked token');
 await dialog.getByLabel('DSH 连接 token',{exact:true}).fill('synthetic-save-token');await page.evaluate(()=>{window.configTest.holdWrite=true;});await dialog.getByRole('button',{name:'保存 DSH 连接',exact:true}).click();await expect(dialog.getByRole('button',{name:'关闭 Agent 配置',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(dialog).toBeVisible();await page.evaluate(()=>window.configTest.releaseWrite());await expect(dialog).toContainText('连接已保存');await expect(dialog.getByLabel('DSH 连接 token',{exact:true})).toHaveValue('');
 calls=await page.evaluate(()=>window.configTest.calls.filter(call=>call.method==='dsh.configure'));assert.equal(calls.length,1);assert.equal(calls[0].params.machineId,'wsl');assert.equal(calls[0].params.adapter,'dsh-web');
 await page.screenshot({path:path.join(output,'dsh-dialog.png'),fullPage:true});report.checks.push('Save binds only WSL Web, prevents dismissal in flight, and clears secret after one write');
 await page.setViewportSize({width:900,height:700});await expect(dialog.getByRole('button',{name:'关闭 Agent 配置',exact:true})).toBeInViewport();await dialog.getByRole('button',{name:'刷新连接状态',exact:true}).scrollIntoViewIfNeeded();await expect(dialog.getByRole('button',{name:'刷新连接状态',exact:true})).toBeInViewport();await page.screenshot({path:path.join(output,'narrow-dialog.png'),fullPage:true});await page.keyboard.press('Escape');
 await page.evaluate(()=>{window.configTest.offline=true;});await page.getByRole('button',{name:'刷新数据',exact:true}).click();await button('WSL Ubuntu','DSH Web').click();await expect(dialog).toContainText('配置仅供查看');await expect(dialog.getByRole('button',{name:'保存 DSH 连接',exact:true})).toBeDisabled();await page.keyboard.press('Escape');report.checks.push('Narrow dialog remains usable; offline source stays identified and cannot write');
 await button('WSL Ubuntu','Hermes').click();await expect(dialog.getByRole('heading',{name:'原生工具配置',exact:true})).toBeVisible();await expect(dialog).toContainText('该产品未确认提供 MCP 客户端');await expect(dialog.locator('input')).toHaveCount(0);await page.keyboard.press('Escape');
 await page.evaluate(()=>{window.configTest.offline=false;});await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'关系图',exact:true}).click();
 await page.getByRole('button',{name:'适配全图',exact:true}).click();const graphNode=page.locator('.react-flow__node[data-id="windows-codex"]');await graphNode.getByRole('button',{name:'配置 Windows 本机 / Codex',exact:true}).click();await expect(dialog).toContainText('Windows 本机 · Codex');await page.keyboard.press('Escape');report.checks.push('The graph configuration action opens the same node-bound dialog');
 const writes=await page.evaluate(()=>window.configTest.calls.filter(call=>['nodeRequest','manageNode'].includes(call.method)));assert.equal(writes.filter(c=>c.method==='nodeRequest').length,0);assert.equal(writes.length,2);assert(writes.every(c=>c.params.action==='attach'));assert.deepEqual(report.pageErrors,[]);report.checks.push('Unsupported adapters retain native configuration boundaries; only two simulated OpenDesk attaches and zero model tasks');report.status='passed';
})().catch(async error=>{report.status='failed';report.error=error.stack;try{await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true});}catch{}process.exitCode=1;}).finally(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length}));});
