// Isolated mocked renderer acceptance; no native prompts and no debug-enabled desktop app.
const fs=require('node:fs'),path=require('node:path');
const {chromium,expect}=require(path.resolve(__dirname,'../node_modules/@playwright/test'));
const output=path.resolve(__dirname,'../../artifacts'),report={date:new Date().toISOString(),status:'running',scope:'isolated renderer mock',checks:[],errors:[]};
function mock(){
 const now=new Date().toISOString(),machines=[{machineId:'win',name:'Windows 主机',kind:'windows',platform:'win32',online:true},{machineId:'wsl',name:'WSL · Ubuntu',kind:'wsl',platform:'linux',distribution:'Ubuntu',parentMachineId:'win',online:true}];
 const nodes=[{nodeId:'claude',machineId:'win',name:'Claude Code',adapter:'claude',executable:'C:/tools/claude.exe',version:'2.1.296'},{nodeId:'codex',machineId:'win',name:'Codex',adapter:'codex',executable:'C:/tools/codex.exe',version:'0.145.0'},{nodeId:'opencode',machineId:'wsl',name:'OpenCode',adapter:'opencode',executable:'/opt/opencode',version:'2.0.24'}].map(n=>({...n,healthy:true,online:true,executionSupported:true,connected:false,status:'discovered',busy:false,available:false}));
 let relation={leaderId:null,memberIds:[],revision:0};const calls=[],tasks=[],conversations=[];let pending=[];
 window.agentbridge={call:async(method,p={})=>{calls.push({method,p});let result={};
 if(method==='snapshot')result={configured:nodes.some(n=>n.connected),directory:'isolated mock',machines,nodes,collaboration:relation,agents:{items:[],revision:0,connected:true},tasks,conversations};
 if(method==='attachNode'){const n=nodes.find(n=>n.nodeId===p.nodeId);Object.assign(n,{connected:true,status:'connected',available:true});result=n;}
 if(method==='saveCollaboration'){if(p.expectedRevision!==relation.revision)throw Error('revision');relation={leaderId:p.leaderId,memberIds:p.memberIds,revision:relation.revision+1};result=relation;}
 if(method==='nodeRequest'){const n=nodes.find(n=>n.nodeId===p.nodeId),t={taskId:'task',conversationId:'conversation',targetAgent:'hidden-context',nodeId:n.nodeId,machineId:n.machineId,message:p.message,status:'succeeded',createdAt:now,updatedAt:now,result:{message:'子 Agent 返回的实际结果'},native:{sessionId:'native-session'}};tasks.push(t);conversations.push({conversationId:t.conversationId,targetAgent:t.targetAgent,nodeId:n.nodeId,machineId:n.machineId,title:t.message,turns:1,updatedAt:now,canContinue:true,items:[t]});result=t;}
 if(method==='ipc'&&p.op==='conversation')result=conversations.find(c=>c.conversationId===p.conversationId);
 if(method==='ipc'&&p.op==='task')result=tasks.find(t=>t.taskId===p.taskId);
 return {ok:true,result};},preferences:async()=>({theme:'light',platform:'win32',version:'0.5.0'}),pending:async()=>pending,recoverPending:async()=>({resolved:0}),window:async()=>{},savePreferences:async p=>p};
 window.networkTest={calls,blockWindows:()=>{pending=[{id:'lost',machineId:'win',op:'submit',state:'unknown',time:now,params:{machineId:'win'}}];}};
}
(async()=>{
 const browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:960}});page.on('pageerror',e=>report.errors.push(e.message));await page.addInitScript(mock);await page.goto(process.argv[2]||'http://127.0.0.1:4199');
 await expect(page.getByRole('heading',{name:'机器与 Agent',exact:true})).toBeVisible();await expect(page.locator('.machine-card')).toHaveCount(2);await expect(page.locator('.machine-tool')).toHaveCount(3);
 await expect(page.getByText('宿主 Windows 主机',{exact:false})).toBeVisible();report.checks.push('机器优先、WSL 标注宿主、显示同机器全部工具节点');
 for(const name of ['选择接入 Windows 主机 / Claude Code','选择接入 Windows 主机 / Codex','选择接入 WSL · Ubuntu / OpenCode']){const check=page.getByRole('checkbox',{name,exact:true});await check.focus();await page.keyboard.press('Space');await expect(check).toBeChecked();}
 await page.getByRole('button',{name:'接入所选 Agent'}).click();await expect(page.getByRole('button',{name:'开始会话'})).toHaveCount(3);report.checks.push('空格多选，一次接入，不要求目录、模型、供应商');
 await page.screenshot({path:path.join(output,'I05-machines-ui.png'),fullPage:true});
 await page.getByRole('button',{name:'协作关系',exact:true}).click();await page.getByLabel('主 Agent',{exact:true}).selectOption('claude');await page.getByRole('checkbox',{name:'子 Agent WSL · Ubuntu / OpenCode',exact:true}).check();await page.getByRole('button',{name:'保存关系'}).click();await expect(page.locator('.network-child')).toContainText('OpenCode');
 await page.getByRole('button',{name:'刷新数据',exact:true}).click();await expect(page.getByLabel('主 Agent',{exact:true})).toHaveValue('claude');report.checks.push('用户设置主 Agent 和允许连接的子节点，刷新保留关系');
 await page.screenshot({path:path.join(output,'I05-relations-ui.png'),fullPage:true});
 await page.getByRole('button',{name:'会话',exact:true}).click();await page.getByRole('button',{name:'新建会话',exact:true}).click();const dialog=page.getByRole('dialog',{name:'新建会话'});await expect(dialog.getByLabel('执行 Agent 节点')).toHaveValue('claude');await expect(dialog.getByRole('checkbox')).toBeChecked();await dialog.getByLabel('需求',{exact:true}).fill('请主 Agent 委派并汇总结果');await dialog.getByRole('button',{name:'发送需求'}).click();await expect(page.locator('.network-answer')).toContainText('子 Agent 返回的实际结果');
 const calls=await page.evaluate(()=>window.networkTest.calls);const submission=calls.find(c=>c.method==='nodeRequest');if(submission.p.workspace||submission.p.model||submission.p.providerID||submission.p.collaboration!==true)throw Error('Unexpected configuration or missing collaboration');if(calls.some(c=>['connect','createInstance','setInstanceModel'].includes(c.method)))throw Error('Legacy setup requested');report.checks.push('仅向主节点发送需求，目录可省略，保留结果阅读');
 await page.getByRole('button',{name:'任务看板',exact:true}).click();await expect(page.locator('.network-task')).toHaveCount(1);report.checks.push('任务按状态展示来源机器及节点');
 await page.evaluate(()=>window.networkTest.blockWindows());await expect(page.locator('.notice-banner')).toContainText('1 个操作');await page.getByRole('button',{name:'会话',exact:true}).click();await page.getByRole('button',{name:'新建会话',exact:true}).click();const pendingDialog=page.getByRole('dialog',{name:'新建会话'});await pendingDialog.getByLabel('需求',{exact:true}).fill('新需求');await expect(pendingDialog.getByRole('button',{name:'发送需求'})).toBeDisabled();await pendingDialog.getByLabel('执行 Agent 节点').selectOption('opencode');await expect(pendingDialog.getByRole('button',{name:'发送需求'})).toBeEnabled();await pendingDialog.getByLabel('关闭新建会话').click();report.checks.push('未确认请求保护来源机器，其他机器仍可提交');
 if(report.errors.length)throw Error(report.errors.join(';'));report.status='passed';
 }finally{await browser.close();}
})().catch(e=>{report.status='failed';report.errors.push(e.stack);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(output,'I05-ui.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));});
