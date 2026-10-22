const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const {scanTools}=require('../electron/tool-discovery.cjs');
const run=promisify(execFile);
function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-discovery-env-'));
 t.after(()=>fs.promises.rm(directory,{recursive:true,force:true,maxRetries:20,retryDelay:100}));
 const dsh=path.join(directory,'native-dsh'),local=path.join(directory,'native-local'),web=path.join(dsh,'profiles/web/package.json'),desktop=path.join(local,'Programs/DSH Desktop');
 fs.mkdirSync(path.dirname(web),{recursive:true});fs.writeFileSync(web,JSON.stringify({name:'dsh-profile-web',version:'1.0.0'}));
 fs.mkdirSync(path.join(desktop,'resources/app'),{recursive:true});fs.writeFileSync(path.join(desktop,'DSH Desktop.exe'),'controlled installation hint, never executed');fs.writeFileSync(path.join(desktop,'resources/app/package.json'),JSON.stringify({name:'dsh-plugin-desktop',version:'1.0.0'}));
 return {directory,environment:{DSH_HOME:dsh,LOCALAPPDATA:local}};
}
test('production discovery still honors explicit DSH profile and desktop installation environment overrides',async t=>{
 const f=fixture(t),candidates=Object.fromEntries(['claude','codex','opencode','hermes','pi','dsh'].map(id=>[id,[]]));
 for(const [platform,adapter] of [['linux','dsh-web'],['win32','dsh-desktop']]){
  const items=await scanTools({home:path.join(f.directory,'bridge-home'),environment:f.environment,platform,candidates});
  assert.deepEqual(items.map(item=>item.adapter),[adapter]);assert.equal(items[0].healthy,false);assert.equal(items[0].errorCode,'DSH_CONNECTION_REQUIRED');
 }
});
test('OpenCode readiness and version-only discovery fixtures remain isolated from inherited DSH installation roots',async t=>{
 const f=fixture(t),files=['machine-host-readiness.test.cjs','tool-discovery.test.cjs'].map(name=>path.join(__dirname,name));
 const environment={...process.env,...f.environment};delete environment.NODE_TEST_CONTEXT;
 const result=await run(process.execPath,['--test','--test-concurrency=1','--test-name-pattern=prefixed native versions|installed OpenCode',...files],{cwd:path.join(__dirname,'../..'),env:environment,windowsHide:true,timeout:30000,maxBuffer:1024*1024}).catch(error=>{throw new Error('Child discovery assertions failed:\n'+(error.stdout||'')+(error.stderr||''));});
 assert.match(result.stdout,/# tests 3\b/);assert.match(result.stdout,/# pass 3\b/);assert.match(result.stdout,/# fail 0\b/);
});
