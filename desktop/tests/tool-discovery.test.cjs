const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {scanTools}=require('../electron/tool-discovery.cjs');
test('prefixed native versions are recognized and a broken earlier installation does not hide a working tool',async t=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'ab-discovery-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
  const broken=path.join(home,'broken.cjs'),working=path.join(home,'working.cjs');
  fs.writeFileSync(broken,'process.exit(1);',{mode:0o755});
  fs.writeFileSync(working,"process.stdout.write('opencode v2.0.24\\n');",{mode:0o755});
  const items=await scanTools({home,candidates:{claude:[],codex:[],opencode:[broken,working]}});
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
  const scan=extra=>scanTools({home,environment,platform:'linux',candidates:{claude:[],opencode:[]},...extra});
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
  const preferred=f.install(path.join(f.home,'selected bin'),'0.160.0');f.environment.PATH=path.dirname(preferred)+':'+f.environment.PATH;
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
