// Real Windows Electron/ICU runtime; isolated profile, no native Agent or model.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {workerRuntime}=require('../electron/worker-runtime.cjs');
if(process.platform!=='win32')throw Error('Windows required');
const version=require('../package.json').version;
const output=process.env.AGENTBRIDGE_RUNTIME_REPORT||path.resolve(__dirname,'../../artifacts/runtime-recovery/2026-10-14/windows-runtime.json');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ab-runtime-recovery-'));
const report={date:new Date().toISOString(),version,environment:'Windows real packaged Electron runtime / isolated synthetic legacy cache',status:'running',checks:[],nativePrompts:0};
const source=path.resolve(__dirname,'../release/win-unpacked/AgentBridge.exe');
const probe=executable=>{const result=spawnSync(executable,['-p','JSON.stringify({electron:process.versions.electron,node:process.versions.node,answer:21*2})'],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true,encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stderr);const value=JSON.parse(result.stdout.trim());assert.equal(value.answer,42);return value;};
try{
  const actual=probe(source);report.electron=actual.electron;report.node=actual.node;
  const coordinator=workerRuntime(path.join(root,'coordinator'),{executable:source,electron:actual.electron});
  const options={executable:coordinator,electron:actual.electron};
  const original=workerRuntime(path.join(root,'windows'),options),manifest=path.join(path.dirname(original),'runtime.json');
  assert.equal(JSON.parse(fs.readFileSync(manifest)).files.some(f=>f.name==='runtime.json'),false);
  assert.equal(workerRuntime(path.join(root,'windows'),options),original);probe(original);
  report.checks.push('Coordinator to Windows nested copy validates repeatedly and real Electron/ICU executes');
  const legacy=JSON.parse(fs.readFileSync(manifest));delete legacy.version;legacy.files=legacy.files.map(({name,size})=>({name,size}));legacy.files.push({name:'runtime.json',size:1});
  const frozen=JSON.stringify(legacy);fs.writeFileSync(manifest,frozen);
  assert.equal(workerRuntime(path.join(root,'windows'),options),original);assert.equal(fs.readFileSync(manifest,'utf8'),frozen);probe(original);
  report.checks.push('alpha.9 self-referential manifest works unchanged with actual Windows runtime');
  const resource=path.join(path.dirname(original),'icudtl.dat');fs.writeFileSync(resource,'controlled-invalid-resource');
  const repaired=workerRuntime(path.join(root,'windows'),options);assert.notEqual(repaired,original);assert.equal(fs.readFileSync(resource,'utf8'),'controlled-invalid-resource');probe(repaired);
  report.checks.push('Damaged runtime repairs to a different directory, preserves original files, and executes with real ICU');
  fs.rmSync(path.dirname(coordinator),{recursive:true});assert.equal(workerRuntime(path.join(root,'windows'),options),repaired);probe(repaired);
  report.checks.push('Repaired runtime remains reusable after source cache cleanup');
  report.status='passed';
}catch(e){report.status='failed';report.error={code:e.code,message:e.message};process.exitCode=1;}
finally{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');fs.rmSync(root,{recursive:true,force:true});console.log(JSON.stringify(report));}
