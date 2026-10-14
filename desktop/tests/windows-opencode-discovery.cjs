// Real Windows PE/version execution; isolated installation and backend, zero model calls.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const coreRoot=path.resolve(process.env.AGENTBRIDGE_CORE_ROOT||path.resolve(__dirname,'../..'));
const {scanTools}=require(path.join(coreRoot,'desktop/electron/tool-discovery.cjs'));
if(process.platform!=='win32')throw Error('Windows required');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ab-opencode-discovery-'));
const output=process.env.AGENTBRIDGE_OPENCODE_REPORT||path.resolve(__dirname,'../../artifacts/opencode-discovery/2026-10-14/windows.json');
const report={date:new Date().toISOString(),environment:'Windows real PE fixture / Electron Node / isolated DesktopHost',node:process.version,coreSource:process.env.AGENTBRIDGE_CORE_ROOT?'packaged bridge':'workspace core',status:'running',checks:[],nativePrompts:0};
const binary=path.join(root,'npm/node_modules/opencode-windows-x64/bin/opencode.exe'),profile=path.join(root,'profile');
fs.mkdirSync(path.dirname(binary),{recursive:true});fs.mkdirSync(profile);
const script=path.join(root,'compile.ps1');
fs.writeFileSync(script,`$source = @'\nusing System; using System.IO; using System.Reflection; public class DiscoveryFixture { public static int Main(string[] args) { File.AppendAllText(Assembly.GetExecutingAssembly().Location + ".calls", String.Join(" ", args) + Environment.NewLine); if(args.Length == 1 && args[0] == "--version") { Console.WriteLine("opencode v2.0.24"); return 0; } return 83; } }\n'@\nAdd-Type -TypeDefinition $source -OutputAssembly '${binary.replaceAll("'","''")}' -OutputType ConsoleApplication\n`);
let ipc;
(async()=>{
 execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{windowsHide:true,timeout:30000});
 const npm=path.join(root,'npm');fs.writeFileSync(path.join(npm,'opencode.cmd'),'controlled npm shim');
 const environment={...process.env,Path:npm,PATH:npm};
 const scanned=await scanTools({home:root,platform:'win32',environment,candidates:{claude:[],codex:[]}});
 assert.equal(scanned.length,1);assert.equal(scanned[0].healthy,true);assert.equal(scanned[0].executable,binary);
 report.checks.push('Real Windows npm cmd resolves to controlled PE; version check succeeds');
 const {discoverOpenCode}=await import(pathToFileURL(path.join(coreRoot,'dist/discovery.js')).href);
 const baseline=await import(pathToFileURL(path.resolve(__dirname,'../../artifacts/opencode-discovery/2026-10-14/baseline-core.mjs')).href);
 assert.deepEqual(await baseline.discoverOpenCode({home:root,path:npm}),[]);
 report.checks.push('alpha.18 secondary scanner reproduces empty Windows result for the healthy installation');
 const detected=await discoverOpenCode({home:root,path:npm,platform:'win32'});
 assert.equal(detected[0].executable,binary);assert.equal(detected[0].version,'2.0.24');
 assert.deepEqual(await discoverOpenCode({home:root,path:'',executable:binary}),detected);
 report.checks.push('Shared secondary discovery and exact selected-path check agree without PATH');
 const {SettingsStore}=await import(pathToFileURL(path.join(coreRoot,'dist/settings.js')).href);
 const store=new SettingsStore(profile),initial=store.initialize();
 assert.equal(store.read().revision,initial.revision);
 const next={...initial,revision:initial.revision+1,checks:{probe:{state:'recorded'}}};store.write(next,initial.revision);
 const saved=fs.readFileSync(store.path,'utf8');
 assert.throws(()=>store.write(next,initial.revision),{code:'REVISION_CONFLICT'});
 assert.equal(fs.readFileSync(store.path,'utf8'),saved);
 report.checks.push('Windows settings initialize/flush/rename and stale revision rejection preserve complete configuration');
 const {DesktopHost}=await import(pathToFileURL(path.join(coreRoot,'dist/desktop-host.js')).href);
 ({ipc}=await import(pathToFileURL(path.join(coreRoot,'dist/controller.js')).href));
 let result,error;try{result=await new DesktopHost(profile).call('connect',{executable:binary,workspace:root});}catch(e){error={code:e.code,message:e.message};}
 report.connectionOutcome=error?{code:error.code,message:error.message}:{healthy:result?.check?.healthy};
 assert.notEqual(error?.code,'DISCOVERY_CHANGED');
 const calls=fs.readFileSync(binary+'.calls','utf8').trim().split(/\r?\n/);
 assert(calls.some(line=>line.startsWith('serve ')),'connect must reach the original executable serve launch');
 assert(calls.every(line=>line==='--version'||line.startsWith('serve ')));
 assert.equal(error,undefined);
 assert.equal(result.check.connection,'failed');
 const snapshot=await new DesktopHost(profile).call('snapshot');
 const agent=snapshot.agents.items.find(a=>a.agentId===result.agentId);
 assert.equal(agent.startupError.code,'NATIVE_EXITED');
 report.connectionOutcome={connection:result.check.connection,startupCode:agent.startupError.code};
 report.checks.push('Real DesktopHost connect reaches native serve; controlled exit remains a startup failure, no Prompt');
 fs.renameSync(binary,binary+'.saved');
 assert.deepEqual(await discoverOpenCode({home:root,path:'',executable:binary}),[]);
 report.checks.push('Removed selected PE is rejected, no fallback or execution');
 report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code,message:e.message};process.exitCode=1;}).finally(async()=>{
 try{await ipc?.(profile,{op:'stop'});}catch{}
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 // Stop only the isolated controller above; keep its files for diagnosis.
});
