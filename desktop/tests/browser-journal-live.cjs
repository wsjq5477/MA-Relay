'use strict';
// Standalone native IndexedDB verifier. Page/Chrome actions remain controlled.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.join(__dirname,'../package.json'))('playwright');
const {createFixture}=require('./browser-journal-fixture.cjs');
const day=process.env.AGENTBRIDGE_BROWSER_EVIDENCE_DATE||'2026-10-30';
const filename=process.env.AGENTBRIDGE_BROWSER_REPORT||'indexeddb-health.json';
if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^[a-z0-9-]+\.json$/.test(filename))throw Error('Invalid evidence path.');
async function run(){
  const server=createFixture();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;const errors=[],report={executedAtUtc:new Date().toISOString(),scope:'actual Chromium IndexedDB/Web Crypto; controlled Chrome/page APIs; no MV3, Provider or native parent model'};
  try{
    browser=await chromium.launch({headless:true,...(process.env.AGENTBRIDGE_TEST_CHROMIUM?{executablePath:process.env.AGENTBRIDGE_TEST_CHROMIUM}:{})});report.browser=browser.version();
    const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
    const origin='http://127.0.0.1:'+server.address().port;
    await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
    await page.goto(origin);await page.waitForFunction(()=>window.result);const result=await page.evaluate(()=>window.result);Object.assign(report,result);report.userAgent=result.browser;report.browser=browser.version();
    assert.equal(report.failed,0);assert.deepEqual(errors,[]);report.ok=true;
  }catch{report.ok=false;report.error='BROWSER_JOURNAL_VERIFICATION_FAILED';process.exitCode=1;}
  finally{
    report.pageErrors=errors;await browser?.close();await new Promise(resolve=>server.close(resolve));
    const output=path.resolve(__dirname,'../../artifacts/browser-agent',day,filename);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  }
  console.log(JSON.stringify({ok:report.ok,passed:report.passed,failed:report.failed,browser:report.browser}));
}
run().catch(()=>{console.error('BROWSER_JOURNAL_VERIFICATION_FAILED');process.exitCode=1;});
