// Actual Windows Edge renderer, controlled SSH responses; no remote or model calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('../node_modules/@playwright/test');
const out=path.resolve(__dirname,'../../artifacts/ssh-upload/2026-10-14');
const report={date:new Date().toISOString(),version:require('../package.json').version,scope:'Windows Edge renderer with controlled SSH upload rejection/unknown; no real SSH or native models',status:'running',checks:[],nativePrompts:0};
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.addInitScript(()=>{
      const calls=[];let connected=false,fail=true,unknown=false;
      window.uploadFixture={calls,setUnknown:()=>{unknown=true;connected=false;}};
      window.agentbridge={preferences:async()=>({theme:'light',platform:'win32'}),pending:async()=>[],recoverPending:async()=>({resolved:0}),call:async(m,p={})=>{
        calls.push({m,...(m==='credential.provide'?{connectionId:p.connectionId}:p)});
        if(m==='snapshot')return {ok:true,result:{configured:true,directory:'',agents:{items:[],revision:0,connected:true},machines:[],nodes:[],tasks:[],conversations:[]}};
        if(m==='machine.createSshDraft')return {ok:true,result:{connectionId:'original-connection'}};
        if(m==='machine.testSsh')return {ok:true,result:{status:'ready',probe:{home:'/home/fixture',platform:'linux',arch:'x64',nodeVersion:'22.23.1',installPath:'/home/fixture/.local/share/agentbridge/profiles/fixture',installNeeded:true,runtimeNeeded:false}}};
        if(m==='machine.connectSsh'){
          if(unknown)return {ok:false,error:{code:'COORDINATOR_TIMEOUT',message:'后台回应尚未确认，请查询原请求。'}};
          if(fail){fail=false;return {ok:false,error:{code:'SSH_UPLOAD_FAILED',message:'安装包上传失败：服务器拒绝写入（SFTP 3）。未解包或激活后台，请重新检测后安装。'}};}
          connected=true;return {ok:true,result:{online:true}};
        }
        return {ok:true,result:{}};
      }};
    });
    await page.goto(process.argv[2]||'http://127.0.0.1:4224');
    async function add(){await page.getByRole('button',{name:'添加 Linux 机器',exact:true}).click();const dialog=page.getByRole('dialog',{name:'添加 Linux 机器'});await dialog.getByLabel('服务器地址',{exact:true}).fill('linux.example.test');await dialog.getByLabel('SSH 用户名',{exact:true}).fill('fixture');await dialog.getByLabel('SSH 登录密码',{exact:true}).fill('synthetic');await dialog.getByRole('button',{name:'测试连接',exact:true}).click();return dialog;}
    let dialog=await add();await expect(dialog.getByRole('button',{name:'安装并连接',exact:true})).toBeVisible();
    assert.equal((await page.evaluate(()=>window.uploadFixture.calls)).filter(c=>c.m==='machine.connectSsh').length,0);
    await dialog.getByRole('button',{name:'安装并连接',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('SFTP 3');await expect(dialog.getByRole('button',{name:'重新检测安装',exact:true})).toBeVisible();
    await page.screenshot({path:path.join(out,'upload-rejected.png'),fullPage:true});
    await dialog.getByLabel('SSH 登录密码',{exact:true}).fill('synthetic');await dialog.getByRole('button',{name:'重新检测安装',exact:true}).click();await expect(dialog.getByRole('button',{name:'安装并连接',exact:true})).toBeVisible();
    assert.equal((await page.evaluate(()=>window.uploadFixture.calls)).filter(c=>c.m==='machine.connectSsh').length,1,'rechecking must not install');
    await page.screenshot({path:path.join(out,'retry-preview.png'),fullPage:true});
    await dialog.getByRole('button',{name:'安装并连接',exact:true}).click();await expect(dialog).toHaveCount(0);
    const calls=await page.evaluate(()=>window.uploadFixture.calls),connects=calls.filter(c=>c.m==='machine.connectSsh');assert.equal(connects.length,2);assert.equal(connects[0].operationId,connects[1].operationId);assert.equal(connects[0].connectionId,connects[1].connectionId);assert.equal(calls.filter(c=>c.m==='machine.createSshDraft').length,1);
    report.checks.push('Upload rejection shows safe reason and recheck button; password is re-entered; new preview requires approval; same connection/operation IDs used');
    await page.evaluate(()=>window.uploadFixture.setUnknown());dialog=await add();await dialog.getByRole('button',{name:'安装并连接',exact:true}).click();await expect(dialog.getByRole('button',{name:'返回机器列表',exact:true})).toBeVisible();await expect(dialog.getByRole('button',{name:'重新检测安装',exact:true})).toHaveCount(0);await expect(dialog.getByRole('button',{name:'安装并连接',exact:true})).toHaveCount(0);
    report.checks.push('Unknown response preserves original operation without a new install/retry button');report.status='passed';
  }finally{await browser.close();}
})().catch(e=>{report.status='failed';report.error=e.stack;process.exitCode=1;}).finally(()=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'ui.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));});
