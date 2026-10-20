const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const maintenance=require('../electron/remote-maintenance.cjs'),{inspectDaemon}=require('../electron/machine-daemon.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
function makeVersion(root,name){const dir=path.join(root,'install/versions',name);fs.mkdirSync(path.join(dir,'desktop/electron'),{recursive:true,mode:0o700});fs.mkdirSync(path.join(dir,'runtime'),{mode:0o700});
 fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({version:name}),{mode:0o600});fs.writeFileSync(path.join(dir,'runtime/node'),'#!/bin/sh\nexec '+JSON.stringify(process.execPath)+' "$@"\n',{mode:0o700});execFileSync('cc',['-O2','-o',path.join(dir,'runtime/owned-stop'),path.resolve(__dirname,'../native/owned-stop.c')]);
 for(const file of ['machine-daemon.cjs','machine-protocol.cjs','runtime-capabilities.cjs','remote-maintenance.cjs'])fs.copyFileSync(path.resolve(__dirname,'../electron',file),path.join(dir,'desktop/electron',file));
 // Real daemon/process/protocol, controlled persisted native host. No model calls.
 const p=path.join(dir,'desktop/electron/machine-daemon.cjs');let source=fs.readFileSync(p,'utf8');source=source.replace('async function productionHost(directory, collaboration) {',"async function productionHost(directory, collaboration) { return {setCollaboration(){},close(){},async call(method,params){const state=JSON.parse(fs.readFileSync(path.join(directory,'synthetic-host.json'),'utf8'));if(method==='snapshot')return {agents:{items:[]},tasks:state.tasks,conversations:[]};if(method==='ipc'&&params.op==='request')return state.tasks.find(t=>t.requestId===params.requestId);throw fail('ADAPTER_UNSUPPORTED','controlled host');}};}\nasync function unused(directory, collaboration){");fs.writeFileSync(p,source);
 const files=[];function walk(d,r=''){for(const e of fs.readdirSync(d,{withFileTypes:true})){const rel=path.posix.join(r,e.name),f=path.join(d,e.name);if(e.isDirectory())walk(f,rel);else{const b=fs.readFileSync(f);files.push({path:rel,size:b.length,sha256:sha(b)});}}}walk(dir);const manifest={version:name,files},digest=sha(JSON.stringify(manifest));fs.writeFileSync(path.join(dir,'.bridge-release.json'),JSON.stringify({ownerCoordinatorId:'owner',digest}),{mode:0o600});return {version:name,digest,manifest};}
async function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'ab-c-maint-'));fs.chmodSync(root,0o700);const from=makeVersion(root,'0.6.0-test-old'),target=makeVersion(root,'0.6.0-test-new'),install=path.join(root,'install');fs.chmodSync(install,0o700);const options={stateDirectory:path.join(root,'state'),ownerCoordinatorId:'owner',profileId:'profile'};
 const {identity}=require('../electron/machine-daemon.cjs');const info=identity(options);fs.writeFileSync(path.join(options.stateDirectory,'synthetic-host.json'),JSON.stringify({tasks:[]}),{mode:0o600});fs.writeFileSync(path.join(install,'install.json'),JSON.stringify({kind:'agentbridge-install',ownerCoordinatorId:'owner',profileId:'profile'}),{mode:0o600});fs.writeFileSync(path.join(install,'current.json'),JSON.stringify({version:from.version,digest:from.digest,versionPath:path.join(install,'versions',from.version)}),{mode:0o600});
 const boot=v=>execFileSync(path.join(install,'versions',v.version,'runtime/node'),[path.join(install,'versions',v.version,'desktop/electron/machine-daemon.cjs'),'--state-directory',options.stateDirectory,'--owner','owner','--profile','profile'],{timeout:30000,stdio:'pipe'});
 boot(from);const input={action:'upgrade',operationId:'original',home:root,installPath:install,...options,daemonId:info.daemonId,uid:process.getuid(),from,target,controller:target,releases:[from,target]};
 t.after(async()=>{try{const lock=JSON.parse(fs.readFileSync(path.join(options.stateDirectory,'daemon.lock')));execFileSync(path.join(install,'versions',target.version,'runtime/owned-stop'),[String(lock.pid),String(lock.pidStart),String(process.getuid())],{stdio:'ignore'});}catch{}await new Promise(r=>setTimeout(r,200));fs.rmSync(root,{recursive:true,force:true});});
 const run=async(p=input,opts={})=>{const file=path.join(options.stateDirectory,'maintenance-operations.json');const rows=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):[];rows.push({operationId:p.operationId,state:'unknown',fingerprint:maintenance.digest(p)});fs.writeFileSync(file,JSON.stringify(rows),{mode:0o600});return maintenance.run(p,opts);};
 return {root,input,options,from,target,run,boot};}
test('real daemon version switch and rollback preserve identity/history, restart healthy, and original receipts never perform another switch',async t=>{
 const f=await fixture(t),id=(await inspectDaemon(f.options)).daemonId;const first=await f.run();assert.equal(first.state,'confirmed',JSON.stringify(first));assert.equal((await inspectDaemon(f.options)).version,f.target.version);assert.equal((await inspectDaemon(f.options)).daemonId,id);assert(fs.existsSync(path.join(f.options.stateDirectory,'synthetic-host.json')));
 const saved=maintenance.query({...f.input,action:'query'});assert.equal(saved.operationId,f.input.operationId);assert.equal(saved.state,'confirmed');
 const reverse={...f.input,from:f.target,target:f.from,action:'rollback',operationId:'reverse'};assert.equal((await f.run(reverse)).state,'confirmed');assert.equal((await inspectDaemon(f.options)).version,f.from.version);assert.equal((await inspectDaemon(f.options)).daemonId,id);
});
test('failed new health rolls back the exact old version without losing daemon identity or native history',async t=>{
 const f=await fixture(t),before=(await inspectDaemon(f.options)).daemonId;const row=await f.run(f.input,{failHealth:true});assert.equal(row.state,'rejected',JSON.stringify(row));assert(row.data.rolledBack);assert.equal((await inspectDaemon(f.options)).version,f.from.version);assert.equal((await inspectDaemon(f.options)).daemonId,before);
});
test('busy, waiting, unknown and original unresolved receipts refuse version switch before stopping; damaged files refuse execution',async t=>{
 const f=await fixture(t),before=await inspectDaemon(f.options);
 for(const status of ['running','unknown','accepted']){fs.writeFileSync(path.join(f.options.stateDirectory,'synthetic-host.json'),JSON.stringify({tasks:[{taskId:'active',status}]}),{mode:0o600});const row=await f.run({...f.input,operationId:'busy-'+status});assert.equal(row.state,'rejected',JSON.stringify(row));assert.equal((await inspectDaemon(f.options)).pid,before.pid);}
 fs.writeFileSync(path.join(f.options.stateDirectory,'synthetic-host.json'),JSON.stringify({tasks:[]}),{mode:0o600});fs.appendFileSync(path.join(f.input.installPath,'versions',f.target.version,'package.json'),'changed');const row=await f.run({...f.input,operationId:'damaged'});assert.equal(row.state,'rejected');assert.equal((await inspectDaemon(f.options)).pid,before.pid);
});
test('owned stop checks a kernel process handle and original start time; another live process is never signalled',async t=>{
 const f=await fixture(t),live=await inspectDaemon(f.options),lock=JSON.parse(fs.readFileSync(path.join(f.options.stateDirectory,'daemon.lock')));assert.throws(()=>execFileSync(path.join(f.input.installPath,'versions',f.target.version,'runtime/owned-stop'),[String(live.pid),'wrong-start',String(process.getuid())],{stdio:'ignore'}));assert.equal((await inspectDaemon(f.options)).pid,lock.pid);
});
test('stop and uninstall preserve state/history; uninstall queries still find the original receipt after installation removal',async t=>{
 const f=await fixture(t);const stopped=await f.run({...f.input,action:'stop'});assert.equal(stopped.state,'confirmed');await assert.rejects(inspectDaemon(f.options),{code:'DAEMON_OFFLINE'});f.boot(f.from);
 const uninstalled=await f.run({...f.input,action:'uninstall',operationId:'uninstall'});assert.equal(uninstalled.state,'confirmed',JSON.stringify(uninstalled));assert(!fs.existsSync(f.input.installPath));assert(fs.existsSync(path.join(f.options.stateDirectory,'machine.json')));assert.equal(maintenance.query({...f.input,action:'query',operationId:'uninstall'}).state,'confirmed');
});

test('crash after activation reconciles by original maintenance record and rolls back without native replay',async t=>{
 const f=await fixture(t);const p={...f.input,operationId:'crashed'},file=path.join(f.options.stateDirectory,'maintenance-operations.json');
 // Reproduce a durable activation with no living maintenance worker; original daemon is idle.
 fs.writeFileSync(file,JSON.stringify([{operationId:p.operationId,action:'upgrade',state:'unknown',phase:'activated'}]),{mode:0o600});fs.writeFileSync(path.join(f.options.stateDirectory,'maintenance.json'),JSON.stringify({operationId:p.operationId}),{mode:0o600});
 const row=await maintenance.recover(p);assert.equal(row.state,'rejected',JSON.stringify(row));assert(row.data.rolledBack);assert.equal((await inspectDaemon(f.options)).version,f.from.version);
});
test('ten original maintenance launches have one durable worker and receipt; repeated queries never repeat the switch',async t=>{
 const f=await fixture(t),replies=Array.from({length:10},()=>maintenance.launch(f.input));assert.equal(new Set(replies.map(r=>r.workerPid)).size,1);
 const deadline=Date.now()+30000;let row;do{await new Promise(r=>setTimeout(r,100));row=maintenance.query({...f.input,action:'query'});}while(row.state==='unknown'&&Date.now()<deadline);
 assert.equal(row.state,'confirmed',JSON.stringify(row));const live=await inspectDaemon(f.options);for(let i=0;i<10;i++)assert.equal(maintenance.query({...f.input,action:'query'}).state,'confirmed');assert.equal((await inspectDaemon(f.options)).pid,live.pid);assert.equal(JSON.parse(fs.readFileSync(path.join(f.options.stateDirectory,'maintenance-operations.json'))).length,1);
});

test('socket reset during shutdown waits for original process exit; an offline socket alone never confirms stop',async()=>{
 const original={pid:123,pidStart:'original-start'};let reads=0;
 await maintenance.waitStopped({},original,{inspect:async()=>{reads++;throw Object.assign(Error('reset'),{code:'ECONNRESET'});},processStart:()=>reads<3?'original-start':null,timeoutMs:1000});assert.equal(reads,3);
 await assert.rejects(maintenance.waitStopped({},original,{inspect:async()=>{throw Object.assign(Error('socket gone'),{code:'DAEMON_OFFLINE'});},processStart:()=>original.pidStart,timeoutMs:150}),{code:'DAEMON_STOP_TIMEOUT'});
 await assert.rejects(maintenance.waitStopped({},original,{inspect:async()=>({pid:124}),processStart:()=>null}),{code:'DAEMON_IDENTITY_CHANGED'});
});
