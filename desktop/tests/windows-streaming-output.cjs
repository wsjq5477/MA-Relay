// Isolated frontend Mock: delta chunks, snapshot text, and diagnostic history.
const path=require('node:path'),fs=require('node:fs');
const {chromium,expect}=require(path.resolve(__dirname,'../node_modules/@playwright/test'));
const report={date:new Date().toISOString(),status:'running',scope:'isolated frontend Mock; no model calls',checks:[],errors:[]};
function mock(){
 const calls=[],stamp=()=>new Date().toISOString();
 const machines=[{machineId:'win',name:'Windows',kind:'windows',platform:'win32',online:true},{machineId:'wsl',name:'Ubuntu',kind:'wsl',platform:'linux',online:true}];
 const agents=['claude','opencode'].map((adapter,i)=>({agentId:(i?'wsl':'win')+'::agent',machineId:i?'wsl':'win',name:adapter,adapter,workspace:i?'/mock':'D:/mock',enabled:true,available:true,online:true,healthy:true,busy:false,default:!i}));
 const e=(seq,kind,text)=>({seq,timestamp:stamp(),event:{kind,text}});
 const marker='AB_VERIFY_e314f6a5055a46b183fd9461';
 function task(id,title,machineId,status,events,result){return {taskId:machineId+'::'+id,conversationId:machineId+'::c-'+id,targetAgent:machineId+'::agent',machineId,executionId:id,requestId:id,message:title,status,createdAt:stamp(),updatedAt:stamp(),lastSeq:events.length,events,result,native:{sessionId:id}}}
 const normal=task('normal','测试流式回复','win','running',[e(1,'accepted'),e(2,'started'),e(3,'output','你'),e(4,'native'),e(5,'output','好')]);
 const snapshots=task('snapshots','测试 OpenCode 快照','wsl','running',[e(1,'accepted'),e(2,'output','Hello'),e(3,'output','Hello world')]);
 const verify=task('verify','只回复标记 '+marker+'，不要执行其他动作。','win','succeeded',[e(1,'accepted'),e(2,'started'),...marker.split('').map((s,i)=>e(i+3,'output',s)),e(marker.length+3,'completed',marker)],{message:marker});verify.verification=true;
 const tasks=[normal,snapshots,verify];
 const conversations=tasks.map(t=>({conversationId:t.conversationId,targetAgent:t.targetAgent,machineId:t.machineId,title:t.message,kind:t.verification?'verification':'task',turns:1,canContinue:true,updatedAt:stamp(),items:[t]}));
 window.agentbridge={call:async(method,p={})=>{calls.push({method,params:p});let result;
  if(method==='snapshot')result={configured:true,agents:{items:agents,revision:1,connected:true},instances:agents,machines,connections:[],tasks,conversations:conversations.map(c=>({...c,items:undefined})),status:{connected:true},directory:'/mock'};
  else if(method==='environment')result={home:'/mock',cwd:'/mock',node:'mock'};
  else if(method==='ipc'&&p.op==='conversation')result=conversations.find(c=>c.conversationId===p.conversationId);
  else if(method==='ipc'&&p.op==='task')result=tasks.find(t=>t.taskId===p.taskId);
  else if(method==='ipc'&&p.op==='pending')result={permissions:[],forms:[]};
  else throw Error('Unexpected operation '+method+'/'+p.op);
  return {ok:true,result};},preferences:async()=>({theme:'light',platform:'win32',version:'0.4.6'}),runtimes:async()=>({platform:'win32',distributions:['Ubuntu']}),pending:async()=>[],window:async()=>{}};
 window.streamTest={tasks,calls,marker,e};
}
(async()=>{
 const browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1360,height:940}});page.on('pageerror',e=>report.errors.push(e.message));await page.addInitScript(mock);await page.goto(process.argv[2]||'http://127.0.0.1:4199');
 await page.getByRole('button',{name:'会话',exact:true}).click();
 await page.locator('.conversation-choice').filter({hasText:'测试流式回复'}).click();
 await expect(page.locator('.assistant-answer > p')).toHaveText('你好');
 await page.getByRole('button',{name:'查看过程',exact:true}).click();
 await expect(page.locator('.answer-content > p')).toHaveText('你好');report.checks.push('Claude 增量在同一回答中实时拼接，完成前也可阅读');
 await page.getByRole('button',{name:/^执行过程/}).click();
 await expect(page.locator('.event')).toHaveCount(3);await expect(page.locator('.event pre').last()).toHaveText('你好');await expect(page.getByRole('button',{name:/^执行过程/})).toContainText('3');report.checks.push('相邻文本片段合并，忽略隐藏原生事件，计数为可见步骤');
 await page.evaluate(()=>window.streamTest.tasks[0].events.push(window.streamTest.e(6,'output','，世界')));
 await expect(page.locator('.event pre').last()).toHaveText('你好，世界');await expect(page.locator('.event')).toHaveCount(3);report.checks.push('后续片段更新原输出行，不增加逐字事件');
 await page.evaluate(()=>{const t=window.streamTest.tasks[0];t.events.push(window.streamTest.e(7,'progress','正在使用工具'),window.streamTest.e(8,'output','任务完成'));});
 await expect(page.locator('.event')).toHaveCount(5);await expect(page.locator('.event pre').nth(3)).toHaveText('正在使用工具');await expect(page.locator('.event pre').last()).toHaveText('任务完成');report.checks.push('工具活动与前后回答按原顺序保留，不跨工具合并');
 await page.evaluate(()=>{const t=window.streamTest.tasks[0];t.status='succeeded';t.result={message:'最终回答'};t.events.push(window.streamTest.e(9,'completed','最终回答'));});
 await page.getByRole('button',{name:'本轮回答',exact:true}).click();await expect(page.locator('.answer-content > p')).toHaveText('最终回答');report.checks.push('终态使用完整权威回答，不重复追加片段');
 await page.getByRole('button',{name:'关闭任务详情',exact:true}).click();await page.locator('.conversation-choice').filter({hasText:'测试 OpenCode 快照'}).click();await page.getByRole('button',{name:'查看过程',exact:true}).click();await expect(page.locator('.answer-content > p')).toHaveText('Hello world');await page.getByRole('button',{name:/^执行过程/}).click();await expect(page.locator('.event')).toHaveCount(2);await expect(page.locator('.event pre').last()).toHaveText('Hello world');report.checks.push('OpenCode 快照替换旧快照，不按 Claude 增量重复拼接');
 await page.getByRole('button',{name:'关闭任务详情',exact:true}).click();await page.getByRole('checkbox',{name:'显示连接验证记录'}).check();await page.locator('.conversation-choice').filter({hasText:'连接验证'}).click();await expect(page.locator('.assistant-answer > p')).toHaveText('模型真实回复验证通过。');await page.getByRole('button',{name:'查看过程',exact:true}).click();await expect(page.locator('.task-title h2')).toHaveText('连接验证');await expect(page.locator('.answer-content > p')).toHaveText('模型真实回复验证通过。');await page.getByRole('button',{name:/^执行过程/}).click();await expect(page.locator('.event')).toHaveCount(3);await expect(page.locator('.event-list')).not.toContainText('AB_VERIFY_');await page.locator('.technical-details summary').click();await expect(page.locator('.technical-details')).toContainText('AB_VERIFY_e314f6a5055a46b183fd9461');report.checks.push('验证突出人类可读结果，过程没有逐字标记，诊断可查看原请求和回复');
 const raw=await page.evaluate(()=>({events:window.streamTest.tasks[2].events.length,original:window.streamTest.tasks[2].events[2].event.text,normal:window.streamTest.tasks[0].events[2].event.text,calls:window.streamTest.calls.filter(c=>['submit','verify','continue'].includes(c.params.op))}));
 if(raw.events<=3||raw.original!=='A'||raw.normal!=='你'||raw.calls.length)throw Error('Raw history changed or prompt replayed');report.checks.push('仅改展示，原始事件保留且没有新增模型调用');
 if(report.errors.length)throw Error(report.errors.join(';'));report.status='passed';
 await page.screenshot({path:path.resolve(__dirname,'../../artifacts/I04F-streaming-mock.png')});
 }finally{await browser.close();}
})().catch(e=>{report.status='failed';report.errors.push(e.stack);process.exitCode=1}).finally(()=>{fs.writeFileSync(path.resolve(__dirname,'../../artifacts/I04F-streaming-ui.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));});
