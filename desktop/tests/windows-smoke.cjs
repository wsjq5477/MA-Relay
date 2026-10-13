const { _electron, expect } = require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const exe=process.argv[2]; const output=path.resolve(__dirname,'../../artifacts');
const report={date:new Date().toISOString(),platform:process.platform,node:process.version,status:'running',errors:[],checks:{}};
(async()=>{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 if(process.argv[3])env.AGENTBRIDGE_DESKTOP_PROFILE=process.argv[3];
 const app=await _electron.launch({executablePath:exe,env,timeout:60000});
 let page;try{
  page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));
  await expect(page.getByRole('heading',{name:'一眼掌握，正在发生的事'})).toBeVisible();
  await expect(page.locator('.connection-dot.online')).toBeVisible({timeout:60000});
  await expect(page.getByText('后台暂时不可用',{exact:true})).toHaveCount(0);
  await page.screenshot({path:path.join(output,'I04-windows-overview.png')});
  await page.getByRole('button',{name:'Agent 连接',exact:true}).click();
  await expect(page.locator('.agent-card')).toHaveCount(1);
  await expect(page.locator('.agent-card').getByText('已连接',{exact:true})).toBeVisible();
  await page.screenshot({path:path.join(output,'I04-windows-agents.png')});
  report.checks.nativeWindowsWindow=true;report.checks.realWSLConnection=true;
  report.checks.rendererIsolated=await page.evaluate(()=>typeof window.require==='undefined'&&typeof window.process==='undefined');
  report.checks.unknownMethodRejected=await page.evaluate(async()=>!(await window.agentbridge.call('shell',{command:'irrelevant'})).ok);
  await page.getByRole('button',{name:'任务看板',exact:true}).click();
  await expect(page.locator('.kanban-column')).toHaveCount(4);
  await page.screenshot({path:path.join(output,'I04-windows-board.png')});
  await page.getByRole('button',{name:'会话',exact:true}).click();
  await expect(page.getByRole('heading',{name:'会话',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByRole('button',{name:'深色',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.waitForTimeout(1500);
  await page.screenshot({path:path.join(output,'I04-windows-dark.png')});
  await page.getByRole('button',{name:'浅色',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  report.checks.fivePages=true;report.checks.theme=true;
  report.window=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {title:w.getTitle(),size:w.getSize(),platform:process.platform,node:process.versions.node,electron:process.versions.electron,userData:require("electron").app.getPath("userData")};});
  report.status='passed';
 }catch(error){if(page){report.body=await page.locator("body").innerText();await page.screenshot({path:path.join(output,"I04-windows-failed.png")});}throw error;}finally{await app.close();}
})().catch(e=>{report.status='failed';report.error=e.stack;process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(output,'I04-windows-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));});
