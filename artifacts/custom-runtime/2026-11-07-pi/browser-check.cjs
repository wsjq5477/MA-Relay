const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium, expect } = require('../../../desktop/node_modules/@playwright/test');
const { graphFixture } = require('../../../desktop/tests/i06b-ui-fixture.cjs');
(async () => {
  const fixture = await graphFixture();
  const root = path.resolve(__dirname, '../../../desktop/dist');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', {'.js':'text/javascript','.css':'text/css','.html':'text/html'}[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({headless:true});
    for (const kind of ['hermes', 'pi']) for (const width of [1440, 1024, 390]) {
      const label = kind === 'pi' ? 'Pi' : 'Hermes';
      const context = await browser.newContext({viewport:{width,height:900}});
      let configured, attempts = 0;
      await context.exposeFunction('abCall', async (method, params) => {
        if (method === 'customRuntime.create') {
          if (++attempts === 1) return {ok:false,error:{message:'受控探测失败'}};
          configured = params;
          return {ok:true,result:{executable:'custom-runtime:fixture'}};
        }
        const reply = await fixture.call(method,params);
        if (configured && method === 'snapshot' && reply.ok) {
          reply.result.nodes.push({...reply.result.nodes[0],machineId:configured.machineId,nodeId:'custom-fixture',adapter:'hermes',name:configured.name,executable:'custom-runtime:fixture',connected:false});
        }
        return reply;
      });
      await context.addInitScript(() => { window.agentbridge = {
        call:(method,params={})=>window.abCall(method,params),
        preferences:async()=>({theme:'light',platform:'win32'}),
        pending:async()=>[],window:async()=>{},savePreferences:async value=>value,
      }; });
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:' + server.address().port);
      const add = page.getByRole('button',{name:'添加 Agent · Linux 测试服务器',exact:true});
      await add.click();
      await page.getByRole('button',{name:'新建自定义运行时',exact:true}).click();
      const dialog=page.getByRole('dialog',{name:'新建自定义运行时'});
      await expect(dialog.locator('select')).toHaveCount(0);
      await expect(dialog.getByRole('button',{name:'Hermes',exact:true})).toBeFocused();
      await dialog.screenshot({path:path.join(__dirname,kind+'-types-'+width+'.png')});
      await dialog.getByRole('button',{name:label,exact:true}).press('Enter');
      await dialog.getByLabel('显示名称').fill(label + ' 构建');
      await dialog.getByLabel('命令',{exact:true}).fill(kind + '-wrapper start');
      await dialog.getByLabel('描述（可选）').fill('本机测试');
      await dialog.getByRole('button',{name:'创建运行时'}).click();
      await expect(dialog.getByRole('alert')).toHaveText('受控探测失败');
      await dialog.getByRole('button',{name:'返回'}).click();
      await dialog.getByRole('button',{name:label,exact:true}).click();
      await expect(dialog.getByLabel('命令',{exact:true})).toHaveValue(kind + '-wrapper start');
      await dialog.screenshot({path:path.join(__dirname,kind+'-dialog-'+width+'.png')});
      await dialog.getByRole('button',{name:'创建运行时'}).click();
      await expect(page.getByRole('dialog',{name:'添加 Agent'}).getByText(label + ' 构建',{exact:false})).toBeVisible();
      assert.equal(configured.machineId,'ssh-fixture');
      assert.equal(configured.adapter,kind);
      assert.equal(configured.description,'本机测试');
      assert.equal(attempts,2);
      await context.close();
      console.log(kind + ' ' + width + ': wizard, failure, preserved input and creation passed');
    }
  } finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); await fixture.close(); }
})().catch(error=>{ console.error(error); process.exitCode=1; });
