/* eslint-disable @typescript-eslint/no-require-imports -- Windows Node runs this CommonJS verification script directly. */
const fs=require('node:fs'),path=require('node:path');
const {chromium,expect}=require('../node_modules/@playwright/test');
const out=path.resolve(__dirname,'../../artifacts/doc-site');fs.mkdirSync(out,{recursive:true});
const report={date:new Date().toISOString(),scope:'local documentation portal browser verification, no agents or model requests',checks:[],errors:[]};
(async()=>{
 const browser=await chromium.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  let mermaidModule;page.on('request',request=>{if(/mermaid\.js/.test(request.url()))mermaidModule=request.url();});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:4188/',{waitUntil:'networkidle'});
  report.initialPage={url:page.url(),title:await page.title(),headings:await page.locator('h1').allTextContents()};
  await page.screenshot({path:path.join(out,'initial.png')});
  await expect(page.locator('h1')).toContainText('AgentBridge 项目资料');
  await expect(page.locator('.VPSidebar')).toBeVisible();await expect.poll(()=>page.locator('.VPNavBarTitle .logo').evaluate(el=>el.naturalWidth)).toBeGreaterThan(0);report.checks.push('首页读取实际doc/README.md，三栏目录和品牌图标可见');
  await page.locator('.VPNavBar').getByRole('link',{name:'整体设计',exact:true}).click();
  await expect(page.locator('h1')).toContainText('AgentBridge 整体功能设计');report.checks.push('顶部导航实际路由切换并读取整体设计');
  await page.goto('http://127.0.0.1:4188/architecture');
  await expect(page.locator('.mermaid-diagram svg').first()).toBeVisible({timeout:60000});
  await expect(page.locator('.mermaid-diagram [role="alert"]')).toHaveCount(0);report.checks.push('架构Markdown Mermaid渲染成SVG图表');
  await expect(page.locator('.VPDocAside')).toBeVisible();
  report.diagramCount=await page.locator('.mermaid-diagram svg').count();
  const diagrams=[];
  function collect(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){if(entry.name.startsWith('.')||entry.name==='public')continue;const file=path.join(folder,entry.name);if(entry.isDirectory())collect(file);else if(file.endsWith('.md'))for(const match of fs.readFileSync(file,'utf8').matchAll(/```mermaid\r?\n([\s\S]*?)```/g))diagrams.push({file:path.relative(path.resolve(__dirname,'../../doc'),file),code:match[1]});}}
  collect(path.resolve(__dirname,'../../doc'));
  if(!mermaidModule)throw Error('Mermaid module request was not observed');
  const parseResult=await page.evaluate(async({url,items})=>{const {default:mermaid}=await import(url);const errors=[];for(const item of items){try{await mermaid.parse(item.code);}catch(e){errors.push(item.file+': '+e.message);}}return {count:items.length,errors};},{url:mermaidModule,items:diagrams});
  if(parseResult.errors.length)throw Error(parseResult.errors.join(';'));
  report.parsedMermaidDiagrams=parseResult.count;report.checks.push('全部Markdown Mermaid图表由浏览器真实解析器校验通过');

  await page.screenshot({path:path.join(out,'desktop-light.png'),fullPage:false});
  await page.getByRole('switch').first().click();await expect(page.locator('html')).toHaveClass(/dark/);
  await page.screenshot({path:path.join(out,'desktop-dark.png'),fullPage:false});report.checks.push('主题切换和本页章节导航可用');
  await page.getByRole('button',{name:'搜索文档',exact:true}).click();
  const search=page.locator('#localsearch-input');await search.fill('SSH');
  await expect(page.locator('.VPLocalSearchBox .result').first()).toBeVisible({timeout:15000});
  await page.keyboard.press('Escape');report.checks.push('全文搜索SSH返回真实文档结果');
  await page.goto('http://127.0.0.1:4188/modules/04-ssh-access/test-report');
  await expect(page.locator('h1')).toContainText('M04 SSH 接入测试报告');
  const source=page.locator('main a[href^="/references/"]').first();const href=await source.getAttribute('href');const response=await page.request.get(new URL(href,page.url()).href);if(response.status()!==200)throw Error('Reference export failed: '+href);
  report.checks.push('模块测试报告可直接访问，源码和证据链接正常响应');
  if(report.errors.length)throw Error(report.errors.join(';'));
  report.status='passed';
 }finally{await browser.close();}
})().catch(e=>{report.status='failed';report.errors.push(e.stack);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));});
