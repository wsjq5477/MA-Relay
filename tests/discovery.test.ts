import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const { scanTools } = createRequire(import.meta.url)('../desktop/electron/tool-discovery.cjs');
import { tmpdir } from 'node:os';
import { discoverOpenCode } from '../src/discovery.js';
import { createServer } from 'node:http';

test('OpenCode discovery cannot select a healthy DSH service even when both are installed', async t => {
  const home=mkdtempSync(resolve(tmpdir(),'ab-discovery-dsh-coexist-'));
  const server=createServer(async (request,response)=>{
    if(request.method==='GET') {response.writeHead(303,{'set-cookie':'fixture=allowed; HttpOnly',location:'/'});response.end();return;}
    let body='';for await(const part of request)body+=part;
    const input=JSON.parse(body) as {rpcId:string};
    response.setHeader('content-type','application/json');response.end(JSON.stringify({type:'server-response',rpcId:input.rpcId,result:{ok:true,value:{items:[]}}}));
  });
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  t.after(async()=>{server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));rmSync(home,{recursive:true,force:true});});
  const {configure}=createRequire(import.meta.url)('../desktop/electron/dsh-connection.cjs');
  configure({home},{adapter:'dsh-web',url:'http://127.0.0.1:'+(server.address() as {port:number}).port+'/',token:'synthetic-token'});
  const selected=resolve(home,'opencode.cjs');writeFileSync(selected,"process.stdout.write('opencode v2.0.24\\n');",{mode:0o700});
  const options={home,path:'',executable:selected};
  const scanned=await scanTools({home,platform:'linux',environment:{PATH:''},candidates:{claude:[],codex:[],hermes:[],pi:[],dsh:[],opencode:[selected]}});
  assert(scanned.some((item:{adapter:string;healthy:boolean})=>item.adapter==='dsh-web'&&item.healthy),'the coexisting service must actually be healthy');
  assert.deepEqual(await discoverOpenCode(options),[{name:'OpenCode',executable:selected,version:'2.0.24'}]);
  rmSync(selected);assert.deepEqual(await discoverOpenCode(options),[],'DSH must not substitute a missing original OpenCode installation');
});

test('discovery honors the current PATH command, reports its failure, and uses native fallback only when absent', async () => {
  const home = mkdtempSync(resolve(tmpdir(), 'ab-discover-'));
  const bad = resolve(home, 'bad'), path = resolve(home, 'bin'), native = resolve(home, '.opencode/bin');
  for (const dir of [bad, path, native]) mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(bad, 'opencode'), '#!/bin/sh\nexit 1\n', { mode: 0o700 });
  writeFileSync(resolve(native, 'opencode'), '#!/bin/sh\n[ "$1" = "--version" ] || exit 9\necho "opencode v2.0.24"\n', { mode: 0o700 });
  symlinkSync(resolve(native, 'opencode'), resolve(path, 'opencode'));
  try {
    assert.deepEqual(await discoverOpenCode({ path: bad + ':' + path, home }), []);
    assert.equal((await discoverOpenCode({ path, home }))[0]!.executable, resolve(native, 'opencode'));
    assert.equal((await discoverOpenCode({ path: '', home }))[0]!.version, '2.0.24');
    writeFileSync(resolve(native, 'opencode'), '#!/bin/sh\necho "opencode v1.0.0"\n', { mode: 0o700 });
    assert.equal((await discoverOpenCode({ path: '', home }))[0]?.version, '1.0.0');
  } finally { rmSync(home, { recursive: true, force: true }); }
});


test('OpenCode revalidation uses the selected launcher outside PATH and never substitutes another installation', async t => {
  const home = mkdtempSync(resolve(tmpdir(), 'ab-discovery-selected-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const selected = resolve(home, 'selected.cjs'), other = resolve(home, '.opencode/bin/opencode');
  mkdirSync(resolve(home, '.opencode/bin'), { recursive: true });
  writeFileSync(selected, "process.stdout.write('opencode v2.0.24\\n');", { mode: 0o700 });
  writeFileSync(other, '#!/bin/sh\n[ "$1" = "--version" ] || exit 9\necho "opencode v2.0.26"\n', { mode: 0o700 });
  const scanned = await scanTools({ home, platform: 'win32', environment: { Path: home },
    candidates: { claude: [], codex: [], hermes: [], pi: [], dsh: [], opencode: [selected] } });
  assert.equal(scanned[0].healthy, true);
  const options = { home, path: '', executable: scanned[0].executable };
  assert.deepEqual(await discoverOpenCode(options), [{ name: 'OpenCode', executable: selected, version: '2.0.24' }]);
  writeFileSync(selected, 'process.exit(1);');
  assert.deepEqual(await discoverOpenCode(options), [], 'a healthy alternative must not replace a broken selected node');
  rmSync(selected);
  assert.deepEqual(await discoverOpenCode(options), [], 'a deleted installation must remain rejected');
  writeFileSync(selected, "process.stdout.write('opencode v1.0.0\\n');", {mode:0o700});
  assert.equal((await discoverOpenCode(options))[0]?.version, '1.0.0', 'connection must probe API rather than reject CLI display version');
});

test('OpenCode secondary discovery honors Windows npm launcher resolution', async t => {
  const home = mkdtempSync(resolve(tmpdir(), 'ab-discovery-windows-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const launcher = resolve(home, 'opencode.cmd'), binary = resolve(home, 'node_modules/opencode-windows-x64/bin/opencode.exe');
  mkdirSync(resolve(home, 'node_modules/opencode-windows-x64/bin'), { recursive: true });
  // The Windows launcher resolves before validation. This controlled POSIX executable
  // exercises that layout here; the Windows harness checks a real PE separately.
  writeFileSync(launcher, 'controlled launcher');
  writeFileSync(binary, '#!/bin/sh\n[ "$1" = "--version" ] || exit 9\necho "opencode v2.0.24"\n', { mode: 0o700 });
  const detected = await discoverOpenCode({ home, path: home, platform: 'win32' });
  assert.equal(detected[0]?.executable, binary);
  assert.deepEqual(await discoverOpenCode({ home, path: '', executable: binary }), detected);
});

test('enterprise 1.x selected installation reaches API validation instead of a contradictory second discovery',async t=>{
 const home=mkdtempSync(resolve(tmpdir(),'ab-enterprise-'));t.after(()=>rmSync(home,{recursive:true,force:true}));
 const executable=resolve(home,'opencode.cjs');
 for(const version of ['1.2.22.h0.r1','1.19.0']){
  writeFileSync(executable,`process.stdout.write('opencode v${version}\\n');`,{mode:0o700});
  const scanned=await scanTools({home,platform:'linux',environment:{PATH:''},candidates:{claude:[],codex:[],hermes:[],pi:[],dsh:[],opencode:[executable]}});
  assert.equal(scanned[0].healthy,true);
  assert.equal((await discoverOpenCode({home,path:'',executable}))[0]?.executable,executable);
 }
});
