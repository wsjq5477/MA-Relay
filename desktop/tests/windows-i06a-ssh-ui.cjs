// Isolated renderer acceptance. This fixture never connects SSH or invokes native agents.
const fs = require('node:fs'), path = require('node:path');
const {chromium, expect} = require(path.resolve(__dirname, '../node_modules/@playwright/test'));
const output = path.resolve(__dirname, '../../artifacts');
const report = {date:new Date().toISOString(), scope:'isolated SSH renderer fixture; no real remote machine', status:'running', checks:[], errors:[]};
function mock() {
  const now = new Date().toISOString(), calls = [], drafts = new Map();
  let changedHost = false, needCredentials = false, draftCounter = 0;
  const machines = [{machineId:'win', name:'Windows 主机', kind:'windows', platform:'win32', online:true}];
  const nodes = [{nodeId:'claude', machineId:'win', name:'Claude Code', adapter:'claude', executable:'C:/tools/claude.exe', version:'2.1', healthy:true, online:true, executionSupported:true, connected:true, status:'connected', busy:false, available:true}];
  const tasks = [], conversations = [];
  const snapshot = () => ({configured:true, directory:'isolated fixture', machines, nodes, agents:{items:[],revision:0,connected:true}, collaboration:{leaderId:null,memberIds:[],revision:0}, tasks, conversations});
  window.agentbridge = {
    call:async(method, p={}) => {
      calls.push({method, params:method==='credential.provide' ? {connectionId:p.connectionId,save:p.save,hasSecret:!!p.secret} : p});
      let result = {};
      if (method==='snapshot') result = snapshot();
      if (method==='machine.createSshDraft') {
        const id='connection-'+(++draftCounter), row={machineId:'ssh-'+id,connectionId:id,name:p.name||p.host,kind:'ssh',platform:'linux',online:false,connectionState:'draft',credentialSaveSupported:true,...p};
        drafts.set(id,{row,trusted:false,credential:false}); machines.push(row); result={connectionId:id,status:'draft'};
      }
      if (method==='credential.provide') {drafts.get(p.connectionId).credential=!!p.secret; result={available:true};}
      if (method==='machine.testSsh') {
        const draft=drafts.get(p.connectionId);
        if (changedHost) return {ok:false,error:{code:'SSH_HOST_KEY_CHANGED',message:'服务器主机密钥已变化，请核实后再连接。'}};
        if (!draft.trusted) result={status:'awaiting_host_trust',trustChallenge:{challengeId:'challenge-'+p.connectionId,fingerprint:'SHA256:fixtureHostFingerprintForExplicitTrust',host:draft.row.host,port:draft.row.port,keyType:'ssh-ed25519'}};
        else if (!draft.credential && draft.row.authKind!=='agent') result={status:'needs_credentials'};
        else {draft.row.connectionState='inspecting';result={status:'inspecting',probe:{home:'/home/test-user',platform:'linux',arch:'x64',nodeVersion:'v22.23.1',runtimeNeeded:false,installNeeded:!draft.row.daemonVersion,installPath:'/home/test-user/.local/share/agentbridge/profiles/fixture',diskAvailable:1024*1024*1024}};}
      }
      if (method==='machine.trustHost') {drafts.get(p.connectionId).trusted=true;result={trusted:true};}
      if (method==='machine.connectSsh') {
        const draft=drafts.get(p.connectionId);draft.row.connectionState='installing';
        await new Promise(resolve=>setTimeout(resolve,400));
        Object.assign(draft.row,{online:true,connectionState:'online',daemonVersion:'0.6.0-alpha.2'});draft.credential=false;
        if (!nodes.some(n=>n.machineId===draft.row.machineId)) nodes.push({nodeId:'remote-'+p.connectionId,machineId:draft.row.machineId,name:'OpenCode',adapter:'opencode',executable:'/home/test-user/.local/bin/opencode',version:'2.0.24',healthy:true,online:true,executionSupported:true,connected:false,status:'discovered',busy:false,available:false});
        result={machineId:draft.row.machineId,status:'online',online:true};
      }
      if (method==='machine.disconnect') {const row=machines.find(m=>p.connectionId?m.connectionId===p.connectionId:m.machineId===p.machineId);Object.assign(row,{online:false,connectionState:'disconnected_manual'});nodes.filter(n=>n.machineId===p.machineId).forEach(n=>{n.online=false;n.status='offline';n.available=false;});}
      if (method==='machine.reconnect') {const row=machines.find(m=>m.machineId===p.machineId);row.connectionState=needCredentials?'needs_credentials':'online';row.online=!needCredentials;result={status:row.connectionState};}
      if (method==='attachNode') {const node=nodes.find(n=>n.nodeId===p.nodeId);Object.assign(node,{connected:true,status:'connected',available:true});result=node;}
      if (method==='nodeRequest') {
        const node=nodes.find(n=>n.nodeId===p.nodeId), task={taskId:'fixture-task',conversationId:'fixture-conversation',targetAgent:'fixture-context',nodeId:node.nodeId,machineId:node.machineId,workspace:p.workspace,message:p.message,status:'succeeded',createdAt:now,updatedAt:now,result:{message:'隔离夹具回复'},native:{sessionId:'fixture-native'}};
        tasks.push(task);conversations.push({conversationId:task.conversationId,targetAgent:task.targetAgent,nodeId:node.nodeId,machineId:node.machineId,workspace:p.workspace,title:p.message,turns:1,updatedAt:now,canContinue:true,items:[task]});result=task;
      }
      if (method==='ipc' && p.op==='conversation') result=conversations.find(c=>c.conversationId===p.conversationId);
      if (method==='ipc' && p.op==='task') result=tasks.find(t=>t.taskId===p.taskId);
      return {ok:true,result};
    }, preferences:async()=>({theme:'light',platform:'win32',version:'0.6.0-alpha.2'}),pending:async()=>[],recoverPending:async()=>({resolved:0}),window:async action=>{calls.push({method:'window',params:{action}});},savePreferences:async p=>p,
    pickFolder:async()=>{throw Error('Remote workspace must not invoke the local folder picker');},
  };
  window.sshUiFixture={calls,setChangedHost:()=>{changedHost=true;},needsCredentials:()=>{needCredentials=true;}};
}
async function fillPassword(dialog, name='测试 Linux 服务器') {
  await dialog.getByLabel('机器显示名称').fill(name);
  await dialog.getByLabel('服务器地址',{exact:true}).fill('linux.example.test');
  await dialog.getByLabel('SSH 用户名',{exact:true}).fill('test-user');
  await dialog.getByLabel('SSH 登录密码',{exact:true}).fill('fixture-password-never-in-report');
}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1024}});
    page.on('pageerror',error=>report.errors.push(error.message));
    await page.addInitScript(mock);await page.goto(process.argv[2]||'http://127.0.0.1:4206');
    await page.getByRole('button',{name:'添加 Linux 机器',exact:true}).click();
    let dialog=page.getByRole('dialog',{name:'添加 Linux 机器',exact:true});
    await expect(dialog.getByLabel('SSH 端口')).toHaveValue('22');
    await expect(dialog.getByLabel('SSH 登录密码')).toHaveAttribute('type','password');
    await expect(dialog.getByRole('checkbox')).not.toBeChecked();
    await expect(dialog.locator('select')).toHaveCount(0);
    await fillPassword(dialog,'已取消的服务器');await dialog.getByRole('button',{name:'测试连接',exact:true}).click();
    await expect(dialog.getByRole('heading',{name:'确认服务器身份'})).toBeVisible();
    await expect(dialog.locator('.ssh-fingerprint')).toHaveText('SHA256:fixtureHostFingerprintForExplicitTrust');
    let calls=await page.evaluate(()=>window.sshUiFixture.calls);
    if (calls.some(c=>c.method==='machine.connectSsh'||c.method==='machine.trustHost')) throw Error('Install or trust occurred before explicit approval');
    await page.screenshot({path:path.join(output,'I06A-ssh-host-trust-ui.png'),fullPage:true});
    await dialog.getByRole('button',{name:'取消连接'}).click();await expect(dialog).toHaveCount(0);
    report.checks.push('默认端口、密码隐藏、默认不保存；首次指纹有明确确认，拒绝不安装');

    await page.getByRole('button',{name:'添加 Linux 机器',exact:true}).click();dialog=page.getByRole('dialog',{name:'添加 Linux 机器',exact:true});
    await fillPassword(dialog);await dialog.getByRole('button',{name:'测试连接',exact:true}).click();
    await dialog.getByRole('button',{name:'信任此主机并继续'}).click();
    await expect(dialog.getByRole('heading',{name:'SSH 登录成功'})).toBeVisible();
    await expect(dialog.getByText('/home/test-user/.local/share/agentbridge/profiles/fixture',{exact:true})).toBeVisible();
    await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
    calls=await page.evaluate(()=>window.sshUiFixture.calls);
    if(calls.some(c=>c.method==='machine.connectSsh')) throw Error('Installation started before preview approval');
    await page.screenshot({path:path.join(output,'I06A-ssh-install-preview-ui.png'),fullPage:true});
    await dialog.getByRole('button',{name:'安装并连接'}).click();await expect(dialog).toHaveCount(0);
    const remote=page.getByRole('region',{name:'测试 Linux 服务器',exact:true});
    await expect(remote).toContainText('test-user@linux.example.test:22');await expect(remote).toContainText('OpenCode');await expect(remote).toContainText('在线');
    calls=await page.evaluate(()=>window.sshUiFixture.calls);
    const connects=calls.filter(c=>c.method==='machine.connectSsh');
    if(connects.length!==1||!connects[0].params.operationId) throw Error('Connection approval must have exactly one stable operation ID');
    if(calls.filter(c=>c.method==='credential.provide').some(c=>c.params.save)) throw Error('Credentials unexpectedly saved');
    report.checks.push('检查环境后一次批准安装并连接，自动发现远端 Agent；秘密清空，登录信息可读');

    const check=remote.getByRole('checkbox');await check.focus();await page.keyboard.press('Space');await expect(check).toBeChecked();
    await page.getByRole('button',{name:'接入所选 Agent'}).click();await remote.getByRole('button',{name:'开始会话'}).click();
    const compose=page.getByRole('dialog',{name:'新建会话',exact:true});
    await compose.locator('.network-directory summary').click();await expect(compose.getByRole('button',{name:'选择目录',exact:true})).toHaveCount(0);
    await compose.getByLabel('会话执行目录').fill('/srv/project');await compose.getByLabel('需求',{exact:true}).fill('隔离夹具任务');
    await compose.getByRole('button',{name:'发送需求',exact:true}).click();await expect(page.locator('.network-answer')).toContainText('隔离夹具回复');
    calls=await page.evaluate(()=>window.sshUiFixture.calls);
    const request=calls.find(c=>c.method==='nodeRequest');
    if(request.params.workspace!=='/srv/project'||request.params.model||request.params.providerID) throw Error('Remote workspace transformed or model configuration added');
    report.checks.push('远端节点空格接入，任务目录只手输 Linux 路径，无本地目录选择或模型设置');

    await page.getByRole('button',{name:'机器与 Agent',exact:true}).click();await remote.getByRole('button',{name:'断开',exact:true}).click();
    await expect(remote).toContainText('已断开');await page.evaluate(()=>window.sshUiFixture.needsCredentials());
    await remote.getByRole('button',{name:'重新连接',exact:true}).click();
    const reconnect=page.getByRole('dialog',{name:'重新连接 Linux 机器',exact:true});await expect(reconnect).toBeVisible();
    await expect(reconnect.getByLabel('服务器地址',{exact:true})).toBeDisabled();
    await reconnect.getByLabel('SSH 登录密码',{exact:true}).fill('fixture-reconnect-password');await reconnect.getByRole('button',{name:'测试连接',exact:true}).click();
    await expect(reconnect.getByRole('button',{name:'连接机器',exact:true})).toBeVisible();await reconnect.getByRole('button',{name:'连接机器',exact:true}).click();
    await expect(reconnect).toHaveCount(0);await expect(remote).toContainText('在线');
    report.checks.push('断开保留任务；缺凭据重连使用原 connectionId，已信任主机无需重复确认');

    await page.getByRole('button',{name:'添加 Linux 机器',exact:true}).click();dialog=page.getByRole('dialog',{name:'添加 Linux 机器',exact:true});
    await dialog.getByRole('radio',{name:'私钥文件',exact:true}).check();await expect(dialog.getByLabel('本机私钥路径')).toBeVisible();await expect(dialog.getByLabel('私钥解密口令')).toHaveAttribute('type','password');
    await dialog.getByRole('radio',{name:'ssh-agent',exact:true}).check();await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
    await dialog.getByLabel('服务器地址',{exact:true}).fill('changed.example.test');await dialog.getByLabel('SSH 用户名',{exact:true}).fill('test-user');
    await page.evaluate(()=>window.sshUiFixture.setChangedHost());await dialog.getByRole('button',{name:'测试连接',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('服务器主机密钥已变化');
    await expect(dialog.getByRole('button',{name:'信任此主机并继续'})).toHaveCount(0);
    await dialog.getByRole('button',{name:'关闭机器接入'}).click();
    await page.screenshot({path:path.join(output,'I06A-ssh-machines-ui.png'),fullPage:true});
    report.checks.push('私钥和 ssh-agent 分支清晰；密钥变化显示阻断错误，没有忽略入口');
    await page.getByRole('button',{name:'设置',exact:true}).click();
    await expect(page.getByText('关闭窗口后，后台继续管理连接。重新打开程序可查看原任务和历史。')).toBeVisible();
    await page.getByRole('button',{name:'停止后台并退出',exact:true}).click();
    let stop=page.getByRole('dialog',{name:'停止后台',exact:true});
    await expect(stop).toContainText('已接收的远端任务不会被取消');
    await stop.getByRole('button',{name:'继续使用',exact:true}).click();
    if((await page.evaluate(()=>window.sshUiFixture.calls)).some(c=>c.method==='window'))throw Error('Cancellation stopped the backend');
    await page.getByRole('button',{name:'仅关闭窗口',exact:true}).click();
    await page.getByRole('button',{name:'停止后台并退出',exact:true}).click();
    stop=page.getByRole('dialog',{name:'停止后台',exact:true});
    await stop.getByRole('button',{name:'确认停止并退出',exact:true}).click();
    calls=await page.evaluate(()=>window.sshUiFixture.calls);
    const actions=calls.filter(c=>c.method==='window').map(c=>c.params.action);
    if(JSON.stringify(actions)!==JSON.stringify(['close','quit-background']))throw Error('Incorrect background lifecycle actions');
    report.checks.push('关闭窗口与停止后台入口分开；停止说明与取消确认有效，确认只调用一次停止');
    if(report.errors.length) throw Error(report.errors.join(';'));
    report.status='passed';
  } finally {await browser.close();}
})().catch(error=>{report.status='failed';report.errors.push(error.stack);process.exitCode=1;}).finally(()=>{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'I06A-ssh-ui.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));});
