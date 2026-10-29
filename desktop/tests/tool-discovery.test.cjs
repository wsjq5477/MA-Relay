const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {scanTools}=require('../electron/tool-discovery.cjs');
test('prefixed native versions are recognized and a broken earlier installation does not hide a working tool',async t=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'ab-discovery-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const broken=path.join(home,'broken.cjs'),working=path.join(home,'working.cjs');
  fs.writeFileSync(broken,'process.exit(1);',{mode:0o755});
  fs.writeFileSync(working,"process.stdout.write('opencode v2.0.24\\n');",{mode:0o755});
  const items=await scanTools({home,environment:{},candidates:{claude:[],codex:[],hermes:[],pi:[],dsh:[],opencode:[broken,working]}});
  assert.equal(items.length,1);assert.equal(items[0].healthy,true);assert.equal(items[0].version,'2.0.24');assert.equal(items[0].executable,working);
});

function managedFixture(t) {
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'ab-managed-discovery-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const environment={PATH:'/usr/bin:/bin',HOME:home};
  function install(folder,version='0.162.1',broken=false){
    fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,'codex-launcher.cjs');
    fs.writeFileSync(file,broken?'process.exit(1);':`process.stdout.write('codex-cli ${version}\\n');`,{mode:0o755});
    fs.symlinkSync(file,path.join(folder,'codex'));return file;
  }
  const scan=extra=>scanTools({home,environment,platform:'linux',candidates:{claude:[],opencode:[],hermes:[],pi:[],dsh:[]},...extra});
  return {home,environment,install,scan};
}

test('Linux daemons discover npm Codex in fnm and nvm installations with a minimal non-interactive PATH',async t=>{
  for(const suffix of ['.local/share/fnm/node-versions/v22.23.1/installation/bin','.nvm/versions/node/v22.23.1/bin']){
    const f=managedFixture(t),file=f.install(path.join(f.home,suffix));
    const items=await f.scan();assert.equal(items.length,1);assert.equal(items[0].adapter,'codex');assert.equal(items[0].version,'0.162.1');assert.equal(items[0].healthy,true);assert.equal(items[0].executable,file);
    assert.equal(f.environment.PATH,'/usr/bin:/bin');
  }
});

test('configured Linux installation roots and XDG data roots are honored without reading startup scripts',async t=>{
  const layouts=[['FNM_DIR','managed fnm','node-versions/v22.23.1/installation/bin'],['NVM_DIR','managed nvm','versions/node/v22.23.1/bin'],['XDG_DATA_HOME','xdg data','fnm/node-versions/v22.23.1/installation/bin'],['VOLTA_HOME','volta','bin'],['ASDF_DATA_DIR','asdf','shims'],['MISE_DATA_DIR','mise','shims'],['CARGO_HOME','cargo','bin'],['BUN_INSTALL','bun','bin'],['PNPM_HOME','pnpm',''],['npm_config_prefix','npm prefix','bin']];
  for(const [variable,root,suffix] of layouts){
    const f=managedFixture(t);f.environment[variable]=path.join(f.home,root);const file=f.install(path.join(f.environment[variable],suffix));
    fs.writeFileSync(path.join(f.home,'.bashrc'),'exit 99\n');fs.writeFileSync(path.join(f.home,'.profile'),'exit 99\n');
    const items=await f.scan();assert.equal(items.length,1,variable);assert.equal(items[0].healthy,true,variable);assert.equal(items[0].executable,file,variable);
  }
});

test('PATH selection stays authoritative and broken newer managed installations do not hide an older working Codex',async t=>{
  const f=managedFixture(t),base=path.join(f.home,'.nvm/versions/node');
  f.install(path.join(base,'v22.10.0/bin'),'0.163.0',true);const fallback=f.install(path.join(base,'v22.9.0/bin'));
  let items=await f.scan();assert.equal(items[0].executable,fallback);
  const preferred=f.install(path.join(f.home,'selected bin'),'0.160.0');f.environment.PATH=path.dirname(preferred)+path.delimiter+f.environment.PATH;
  items=await f.scan();assert.equal(items[0].executable,preferred);assert.equal(items[0].version,'0.160.0');
});

test('missing manager directories and foreign Windows Path do not hide Linux Codex or cause cross-platform probing',async t=>{
  const f=managedFixture(t);f.environment.Path='/a/windows/path';const file=f.install(path.join(f.home,'.cargo/bin'));
  const items=await f.scan();assert.equal(items.length,1);assert.equal(items[0].executable,file);
  const absent=managedFixture(t);assert.deepEqual(await absent.scan(),[]);
});

test('Windows scanning still resolves its npm launcher and never uses Linux manager installations',async t=>{
  const f=managedFixture(t);f.install(path.join(f.home,'.nvm/versions/node/v22.23.1/bin'));
  const folder=path.join(f.home,'AppData/Roaming/npm');fs.mkdirSync(path.join(folder,'node_modules/@openai/codex/bin'),{recursive:true});
  fs.writeFileSync(path.join(folder,'codex.cmd'),'controlled npm launcher');const file=path.join(folder,'node_modules/@openai/codex/bin/codex.js');fs.writeFileSync(file,"process.stdout.write('codex-cli 0.162.1\\n');");
  const items=await f.scan({platform:'win32',environment:{Path:folder,APPDATA:path.join(f.home,'AppData/Roaming')}});
  assert.equal(items.length,1);assert.equal(items[0].executable,file);assert.equal(items[0].healthy,true);
});

test('all six Agent installations are discovered without invoking task or account setup',async t=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'ab-six-agents-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const folder=path.join(home,'bin');fs.mkdirSync(folder);
  const names=['claude','opencode','codex','hermes','pi','dsh'];
  for(const name of names){
    const file=path.join(folder,name+'.cjs');
    fs.writeFileSync(file,"if(process.argv.slice(2).join(' ')!=='--version')process.exit(91);process.stdout.write('"+name+" 1.2.3\\n');",{mode:0o700});
    fs.symlinkSync(file,path.join(folder,name));
  }
  const items=await scanTools({home,platform:'linux',environment:{PATH:folder}});
  assert.deepEqual(items.map(item=>item.adapter),[...names].sort());
  assert(items.every(item=>item.healthy&&item.version==='1.2.3'));
  const selected=await scanTools({home,platform:'linux',environment:{PATH:folder},candidates:{claude:[],opencode:[],codex:[],hermes:[],pi:[],dsh:[]}});
  assert.deepEqual(selected,[],'explicit empty candidate lists disable probing');
});

test('Windows Pi and DSH npm launchers resolve official entrypoints including both Pi scopes',async t=>{
  for(const [adapter,entry] of [['pi','@earendil-works/pi-coding-agent/dist/bundle/cli.js'],['pi','@mariozechner/pi-coding-agent/dist/cli.js'],['dsh','@deepseek-ai/dsh/lib/bin.js']]){
    const home=fs.mkdtempSync(path.join(os.tmpdir(),'ab-new-agent-launcher-'));
    t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
    const file=path.join(home,'node_modules',entry);fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,"if(process.argv[2]!=='--version')process.exit(91);process.stdout.write('1.2.3\\n');");
    fs.writeFileSync(path.join(home,adapter+'.cmd'),'must never execute through shell');
    const items=await scanTools({home,platform:'win32',environment:{Path:home}});
    assert.equal(items.length,1);assert.equal(items[0].adapter,adapter);assert.equal(items[0].healthy,true);assert.equal(items[0].executable,file);
  }
});

test('a broken new Agent launcher stays unhealthy and is never executed as a shell command',async t=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'ab-broken-new-agent-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  fs.writeFileSync(path.join(home,'pi.cmd'),'exit 0');
  const items=await scanTools({home,platform:'win32',environment:{Path:home}});
  assert.equal(items.length,1);assert.equal(items[0].adapter,'pi');assert.equal(items[0].healthy,false);assert.match(items[0].error,/TOOL_LAUNCHER/);
});

test('Distributed Shell is never reported as DeepSeek Harness, including nonzero version probes and stderr output', async t => {
  const f=managedFixture(t),file=path.join(f.home,'dsh.cjs');
  for(const [stream,exitCode] of [['stdout',1],['stderr',0]]) {
    fs.writeFileSync(file,`process.${stream}.write("Distributed Shell / Dancer's shell version 0.25.10\\n");process.exit(${exitCode});`,{mode:0o700});
    const items=await scanTools({home:f.home,platform:'linux',environment:{PATH:''},candidates:{claude:[],codex:[],opencode:[],hermes:[],pi:[],dsh:[file]}});
    assert.deepEqual(items,[]);
  }
});

test('a foreign dsh on PATH does not hide Harness, while a broken actual Harness keeps PATH selection', async t => {
  const f=managedFixture(t),selected=path.join(f.home,'selected'),fallback=path.join(f.home,'.local/bin');
  for(const folder of [selected,fallback])fs.mkdirSync(folder,{recursive:true});
  const foreign=path.join(selected,'dsh.cjs'),harness=path.join(fallback,'dsh.cjs');
  fs.writeFileSync(foreign,'process.stderr.write("Distributed Shell version 0.25.10");process.exit(1);',{mode:0o700});
  fs.writeFileSync(harness,'process.stdout.write("dsh 0.2.1-rc.2");',{mode:0o700});
  fs.symlinkSync(foreign,path.join(selected,'dsh'));fs.symlinkSync(harness,path.join(fallback,'dsh'));
  const options={home:f.home,platform:'linux',environment:{PATH:selected},candidates:{claude:[],codex:[],opencode:[],hermes:[],pi:[]}};
  let items=await scanTools(options);assert.equal(items.length,1);assert.equal(items[0].executable,harness);assert.equal(items[0].healthy,true);
  fs.writeFileSync(foreign,'process.exit(1);');
  items=await scanTools(options);assert.equal(items.length,1);assert.equal(items[0].executable,foreign);assert.equal(items[0].healthy,false);
});

test('current PATH Claude wins over newer installed versions and a broken current command is reported',async t=>{
  const f=managedFixture(t),selected=path.join(f.home,'selected'),fallback=path.join(f.home,'.local/bin');
  for(const [folder,version] of [[selected,'2.1.302'],[fallback,'2.1.399']]){
    fs.mkdirSync(folder,{recursive:true});
    const file=path.join(folder,'claude.cjs');fs.writeFileSync(file,`process.stdout.write('${version} (Claude Code)');`,{mode:0o755});
    fs.symlinkSync(file,path.join(folder,'claude'));
  }
  const options={home:f.home,platform:'linux',environment:{PATH:selected},candidates:{codex:[],opencode:[],hermes:[],pi:[],dsh:[]}};
  let items=await scanTools(options);assert.equal(items.length,1);assert.equal(items[0].version,'2.1.302');
  fs.writeFileSync(path.join(selected,'claude.cjs'),'process.exit(1);');
  items=await scanTools(options);assert.equal(items.length,1);assert.equal(items[0].healthy,false);
  assert.equal(items[0].executable,path.join(selected,'claude.cjs'));
});

test('Windows Codex npm launches its own native binary directly and retains the selected JS identity', t => {
  const {command}=require('../electron/tool-discovery.cjs');
  for(const layout of ['optional','alias','bundled']) {
    const home=fs.mkdtempSync(path.join(os.tmpdir(),'ab-codex-hidden-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
    const root=path.join(home,'node_modules/@openai/codex'),entry=path.join(root,'bin/codex.js');
    fs.mkdirSync(path.dirname(entry),{recursive:true});fs.writeFileSync(entry,'throw new Error("Wrapper must never run");');
    fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'@openai/codex',version:'0.1.0'}));
    const platformPackage='@openai/codex-win32-'+(process.arch==='arm64'?'arm64':'x64');
    const nativeRoot=layout!=='bundled'?path.join(root,'node_modules',platformPackage):root;
    fs.mkdirSync(nativeRoot,{recursive:true});
    if(layout==='optional')fs.writeFileSync(path.join(nativeRoot,'package.json'),JSON.stringify({name:platformPackage}));
    if(layout==='alias') {
      fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'@openai/codex',optionalDependencies:{[platformPackage]:'npm:@openai/codex@0.145.0-win32-'+process.arch}}));
      fs.writeFileSync(path.join(nativeRoot,'package.json'),JSON.stringify({name:'@openai/codex',version:'0.145.0-win32-'+process.arch,os:['win32'],cpu:[process.arch]}));
    }
    const native=path.join(nativeRoot,'vendor',process.arch==='arm64'?'aarch64-pc-windows-msvc':'x86_64-pc-windows-msvc','bin/codex.exe');
    fs.mkdirSync(path.dirname(native),{recursive:true});fs.writeFileSync(native,'native fixture');
    fs.writeFileSync(path.join(home,'codex.cmd'),'wrapper must never run');
    const env={USERPROFILE:home,CODEX_MANAGED_BY_BUN:'1',ELECTRON_RUN_AS_NODE:'1'};
    for(const selected of [entry,path.join(home,'codex.cmd')]) {
      const result=command(selected,['exec','--json'],env,'win32');
      assert.equal(result.executable,native);assert.equal(result.installationExecutable,entry);
      assert.deepEqual(result.args,['exec','--json']);assert.equal(result.env.ELECTRON_RUN_AS_NODE,undefined);
      assert.equal(result.env.CODEX_MANAGED_PACKAGE_ROOT,fs.realpathSync(root));assert.equal(result.env.CODEX_MANAGED_BY_NPM,'1');
      assert.equal(result.env.CODEX_MANAGED_BY_BUN,undefined);assert.equal(result.env.USERPROFILE,home);
    }
    assert.equal(env.CODEX_MANAGED_BY_BUN,'1','caller environment remains untouched');
  }
});

test('a missing Windows Codex native binary cannot fall back to a flashing npm wrapper or another installation', t => {
  const {command}=require('../electron/tool-discovery.cjs');
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'ab-codex-missing-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const root=path.join(home,'node_modules/@openai/codex'),entry=path.join(root,'bin/codex.js');
  fs.mkdirSync(path.dirname(entry),{recursive:true});fs.writeFileSync(entry,'process.exit(0)');fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'@openai/codex'}));
  assert.throws(()=>command(entry,['--version'],{},'win32'),{code:'TOOL_LAUNCHER'});
  assert.equal(command(entry,['--version'],{},'linux').executable,process.execPath,'Linux launcher behavior remains unchanged');
});
