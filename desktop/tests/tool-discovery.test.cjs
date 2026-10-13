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
