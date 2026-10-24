const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const maintenance=require('../electron/remote-maintenance.cjs'),{inspectDaemon}=require('../electron/machine-daemon.cjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
// Drop one `if (method === '...') { ... }` dispatch block by brace matching, so a
// fixture version can act as a release that predates the maintenance protocol.
function stripBlock(source,marker){const start=source.indexOf(marker);if(start<0)throw Error('marker missing: '+marker);let depth=0,index=source.indexOf('{',start);for(let cursor=index;cursor<source.length;cursor++){if(source[cursor]==='{')depth++;else if(source[cursor]==='}'&&--depth===0)return source.slice(0,start)+source.slice(cursor+1);}throw Error('unbalanced block: '+marker);}
function makeVersion(root,name,legacy=false){const dir=path.join(root,'install/versions',name);fs.mkdirSync(path.join(dir,'desktop/electron'),{recursive:true,mode:0o700});fs.mkdirSync(path.join(dir,'runtime'),{mode:0o700});
 fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({version:name}),{mode:0o600});fs.writeFileSync(path.join(dir,'runtime/node'),'#!/bin/sh\nexec '+JSON.stringify(process.execPath)+' "$@"\n',{mode:0o700});if(!legacy)execFileSync('cc',['-O2','-o',path.join(dir,'runtime/owned-stop'),path.resolve(__dirname,'../native/owned-stop.c')]);
 for(const file of ['machine-daemon.cjs','machine-protocol.cjs','runtime-capabilities.cjs','remote-maintenance.cjs'])fs.copyFileSync(path.resolve(__dirname,'../electron',file),path.join(dir,'desktop/electron',file));
 // Real daemon/process/protocol, controlled persisted native host. No model calls.
 const p=path.join(dir,'desktop/electron/machine-daemon.cjs');let source=fs.readFileSync(p,'utf8');source=source.replace('async function productionHost(directory, collaboration) {',"async function productionHost(directory, collaboration) { return {setCollaboration(){},close(){},async call(method,params){const state=JSON.parse(fs.readFileSync(path.join(directory,'synthetic-host.json'),'utf8'));if(method==='snapshot')return {agents:{items:[]},tasks:state.tasks,conversations:[]};if(method==='ipc'&&params.op==='request')return state.tasks.find(t=>t.requestId===params.requestId);throw fail('ADAPTER_UNSUPPORTED','controlled host');}};}\nasync function unused(directory, collaboration){");if(legacy)for(const marker of ["if(method==='daemon.quiesce'){","if(method==='daemon.releaseMaintenance'){","if(method==='daemon.shutdown'){","if (method === 'daemon.receiptRead') {"])source=stripBlock(source,marker);fs.writeFileSync(p,source);
 const files=[];function walk(d,r=''){for(const e of fs.readdirSync(d,{withFileTypes:true})){const rel=path.posix.join(r,e.name),f=path.join(d,e.name);if(e.isDirectory())walk(f,rel);else{const b=fs.readFileSync(f);files.push({path:rel,size:b.length,sha256:sha(b)});}}}walk(dir);const manifest={version:name,files},digest=sha(JSON.stringify(manifest));fs.writeFileSync(path.join(dir,'.bridge-release.json'),JSON.stringify({ownerCoordinatorId:'owner',digest}),{mode:0o600});return {version:name,digest,manifest};}
async function fixture(t,modes={}){const root=fs.mkdtempSync(path.join(os.tmpdir(),'ab-c-maint-'));fs.chmodSync(root,0o700);const from=makeVersion(root,'0.6.0-test-old',!!modes.legacyFrom),target=makeVersion(root,'0.6.0-test-new'),install=path.join(root,'install');fs.chmodSync(install,0o700);const options={stateDirectory:path.join(root,'state'),ownerCoordinatorId:'owner',profileId:'profile'};
 const {identity}=require('../electron/machine-daemon.cjs');const info=identity(options);fs.writeFileSync(path.join(options.stateDirectory,'synthetic-host.json'),JSON.stringify({tasks:[]}),{mode:0o600});if(modes.receipts)fs.writeFileSync(path.join(options.stateDirectory,'daemon-receipts.json'),JSON.stringify(modes.receipts),{mode:0o600});fs.writeFileSync(path.join(install,'install.json'),JSON.stringify({kind:'agentbridge-install',ownerCoordinatorId:'owner',profileId:'profile'}),{mode:0o600});fs.writeFileSync(path.join(install,'current.json'),JSON.stringify({version:from.version,digest:from.digest,versionPath:path.join(install,'versions',from.version)}),{mode:0o600});
 const boot=v=>execFileSync(path.join(install,'versions',v.version,'runtime/node'),[path.join(install,'versions',v.version,'desktop/electron/machine-daemon.cjs'),'--state-directory',options.stateDirectory,'--owner','owner','--profile','profile'],{timeout:30000,stdio:'pipe'});
 boot(from);const input={action:'upgrade',operationId:'original',home:root,installPath:install,...options,daemonId:info.daemonId,uid:process.getuid(),from,target,controller:target,releases:[from,target]};
 t.after(async()=>{try{const lock=JSON.parse(fs.readFileSync(path.join(options.stateDirectory,'daemon.lock')));execFileSync(path.join(install,'versions',target.version,'runtime/owned-stop'),[String(lock.pid),String(lock.pidStart),String(process.getuid())],{stdio:'ignore'});}catch{}await new Promise(r=>setTimeout(r,200));fs.rmSync(root,{recursive:true,force:true});});
 const run=async(p=input,opts={})=>{const file=path.join(options.stateDirectory,'maintenance-operations.json');const rows=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):[];rows.push({operationId:p.operationId,state:'unknown',fingerprint:maintenance.digest(p)});fs.writeFileSync(file,JSON.stringify(rows),{mode:0o600});return maintenance.run(p,opts);};
 return {root,input,options,from,target,run,boot};}
test('actual maintenance CLI reads the complete large catalogue and queries the original unknown without another action',async t=>{
 const f=await fixture(t),before=await inspectDaemon(f.options);
 const input={...f.input,...require('./maintenance-input-fixture.cjs').frozenCatalogueInput(),...f.options,action:'query',daemonId:before.daemonId,uid:process.getuid(),home:f.root,installPath:f.input.installPath};
 const row={operationId:input.operationId,state:'unknown',fingerprint:'original-fingerprint',phase:'waiting'};
 const file=path.join(f.options.stateDirectory,'maintenance-operations.json');fs.writeFileSync(file,JSON.stringify([row]),{mode:0o600});const saved=fs.readFileSync(file);
 const bytes=JSON.stringify(input);assert(Buffer.byteLength(bytes)>8*1048576);
 const result=require('node:child_process').spawnSync(process.execPath,[path.resolve(__dirname,'../electron/remote-maintenance.cjs')],{input:bytes,encoding:'utf8',maxBuffer:1024*1024,timeout:30000});
 assert.ifError(result.error);assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),row);
 assert(fs.readFileSync(file).equals(saved));const after=await inspectDaemon(f.options);assert.equal(after.pid,before.pid);assert.equal(after.daemonId,before.daemonId);
});
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

test('a remote daemon released before the maintenance protocol still upgrades, keeps identity/history, and the receipt reports it was stopped',async t=>{
 const f=await fixture(t,{legacyFrom:true}),id=(await inspectDaemon(f.options)).daemonId;
 // The legacy fixture has no quiesce/shutdown/releaseMaintenance and no durable
 // receipt endpoint: the local maintenance.json plus the controller's owned-stop
 // must carry the switch instead of rejecting the upgrade.
 const row=await f.run();assert.equal(row.state,'confirmed',JSON.stringify(row));assert.equal(row.data.stopped,true);assert.equal(row.data.rolledBack,false);
 const live=await inspectDaemon(f.options);assert.equal(live.version,f.target.version);assert.equal(live.daemonId,id);assert(fs.existsSync(path.join(f.options.stateDirectory,'synthetic-host.json')));
 assert.equal(maintenance.query({...f.input,action:'query'}).state,'confirmed');
});
test('a query reconciles an unknown row whose worker record is missing or dead, but honours a fresh-launch grace period',async t=>{
 const f=await fixture(t),id=(await inspectDaemon(f.options)).daemonId;
 const source=path.join(f.options.stateDirectory,'maintenance-input-'+maintenance.digest(f.input.operationId)+'.json');
 fs.writeFileSync(source,JSON.stringify(f.input),{mode:0o600});
 const ledger=path.join(f.options.stateDirectory,'maintenance-operations.json');
 const write=row=>fs.writeFileSync(ledger,JSON.stringify([row]),{mode:0o600});
 const query=()=>maintenance.query({...f.input,action:'query'});
 // A row committed moments ago may sit between launch()'s durable commit and the
 // worker spawn, so a query must not reconcile it yet.
 write({operationId:f.input.operationId,state:'unknown',phase:'intent',action:'upgrade',createdAt:new Date().toISOString(),fingerprint:maintenance.digest(f.input)});
 assert.equal(query().state,'unknown');assert.equal(query().workerPid,undefined);
 // The same row past the grace period was abandoned before it could switch any
 // version: the original daemon stays untouched and the receipt turns terminal.
 write({operationId:f.input.operationId,state:'unknown',phase:'intent',action:'upgrade',createdAt:new Date(Date.now()-120000).toISOString(),fingerprint:maintenance.digest(f.input)});
 const deadline=Date.now()+15000;let row;do{await new Promise(r=>setTimeout(r,100));row=query();}while(row.state==='unknown'&&Date.now()<deadline);
 assert.equal(row.state,'rejected',JSON.stringify(row));assert.equal(row.error.code,'DAEMON_NOT_STARTED');
 const untouched=await inspectDaemon(f.options);assert.equal(untouched.version,f.from.version);assert.equal(untouched.daemonId,id);
 // A row whose recorded worker is already dead (crashed after activation) is
 // reconciled by the same query path and rolls the original version back.
 write({operationId:f.input.operationId,state:'unknown',phase:'activated',action:'upgrade',createdAt:new Date().toISOString(),workerPid:2147483,workerStart:'dead',fingerprint:maintenance.digest(f.input)});
 const second=Date.now()+15000;do{await new Promise(r=>setTimeout(r,100));row=query();}while(row.state==='unknown'&&Date.now()<second);
 assert.equal(row.state,'rejected',JSON.stringify(row));assert.equal(row.error.code,'DAEMON_RECOVERED_ROLLBACK');assert.equal(row.data.rolledBack,true);
 const restored=await inspectDaemon(f.options);assert.equal(restored.version,f.from.version);assert.equal(restored.daemonId,id);
});
test('a barrier left by an already terminal operation never wedges a later maintenance',async t=>{
 const f=await fixture(t),id=(await inspectDaemon(f.options)).daemonId;
 // An earlier operation stopped the daemon and never got to release its barrier;
 // its receipt is terminal, so the barrier is stale and must not block this one.
 const ledger=path.join(f.options.stateDirectory,'maintenance-operations.json');
 fs.writeFileSync(ledger,JSON.stringify([{operationId:'stale-original',action:'upgrade',state:'rejected',phase:'stopped'},{operationId:f.input.operationId,state:'unknown',fingerprint:maintenance.digest(f.input)}]),{mode:0o600});
 fs.writeFileSync(path.join(f.options.stateDirectory,'maintenance.json'),JSON.stringify({operationId:'stale-original'}),{mode:0o600});
 const row=await f.run();assert.equal(row.state,'confirmed',JSON.stringify(row));assert.equal((await inspectDaemon(f.options)).daemonId,id);
 assert(!fs.existsSync(path.join(f.options.stateDirectory,'maintenance.json')));
});
test('a live daemon holding a barrier from an already terminal operation releases it for the next maintenance',async t=>{
 const f=await fixture(t);
 // Restart the fixture daemon with the stale barrier already on disk, so it holds
 // that barrier in memory too and would reject every later quiesce.
 const lock=JSON.parse(fs.readFileSync(path.join(f.options.stateDirectory,'daemon.lock')));
 execFileSync(path.join(f.input.installPath,'versions',f.from.version,'runtime/owned-stop'),[String(lock.pid),String(lock.pidStart),String(process.getuid())],{stdio:'ignore'});
 await new Promise(r=>setTimeout(r,300));
 const ledger=path.join(f.options.stateDirectory,'maintenance-operations.json');
 fs.writeFileSync(ledger,JSON.stringify([{operationId:'stale-live',action:'upgrade',state:'confirmed',phase:'healthy'},{operationId:f.input.operationId,state:'unknown',fingerprint:maintenance.digest(f.input)}]),{mode:0o600});
 fs.writeFileSync(path.join(f.options.stateDirectory,'maintenance.json'),JSON.stringify({operationId:'stale-live'}),{mode:0o600});
 f.boot(f.from);
 const row=await f.run();assert.equal(row.state,'confirmed',JSON.stringify(row));assert.equal((await inspectDaemon(f.options)).version,f.target.version);
 assert(!fs.existsSync(path.join(f.options.stateDirectory,'maintenance.json')));
});
test('an interrupted switch after the stop keeps the receipt unknown so the original-ID query restores the running daemon',async t=>{
 const f=await fixture(t),id=(await inspectDaemon(f.options)).daemonId;
 // A directory at previous.json makes the activation write fail after the old
 // daemon is already stopped, with no switch and no in-run rollback.
 fs.mkdirSync(path.join(f.input.installPath,'previous.json'),{mode:0o700});
 const row=await f.run();assert.equal(row.state,'unknown',JSON.stringify(row));assert.equal(row.error.code,'DAEMON_ROLLBACK_UNCONFIRMED');assert.equal(row.data.stopped,true);assert.equal(row.data.rolledBack,false);
 await assert.rejects(inspectDaemon(f.options),{code:'DAEMON_OFFLINE'});
 const restored=await maintenance.recover({...f.input,operationId:f.input.operationId});assert.equal(restored.state,'rejected',JSON.stringify(restored));assert.equal(restored.error.code,'DAEMON_RECOVERED_ROLLBACK');assert.equal(restored.data.rolledBack,true);
 const live=await inspectDaemon(f.options);assert.equal(live.version,f.from.version);assert.equal(live.daemonId,id);
});
test('socket reset during shutdown waits for original process exit; an offline socket alone never confirms stop',async()=>{ const original={pid:123,pidStart:'original-start'};let reads=0;
 await maintenance.waitStopped({},original,{inspect:async()=>{reads++;throw Object.assign(Error('reset'),{code:'ECONNRESET'});},processStart:()=>reads<3?'original-start':null,timeoutMs:1000});assert.equal(reads,3);
 await assert.rejects(maintenance.waitStopped({},original,{inspect:async()=>{throw Object.assign(Error('socket gone'),{code:'DAEMON_OFFLINE'});},processStart:()=>original.pidStart,timeoutMs:150}),{code:'DAEMON_STOP_TIMEOUT'});
 await assert.rejects(maintenance.waitStopped({},original,{inspect:async()=>({pid:124}),processStart:()=>null}),{code:'DAEMON_IDENTITY_CHANGED'});
});
// One durable `unknown` submit receipt with no matching native task is the field
// shape reported from the alpha.2 host: the original-ID query can never settle it,
// so the gate must name it instead of silently refusing, and only an explicit
// override may pass it while tasks/Agent work stay immovable.
const unresolvedReceipt={key:'blocked-original',method:'ipc',op:'submit',target:{},fingerprint:'controlled-intent',state:'unknown',createdAt:'2026-10-21T00:00:00.000Z',updatedAt:'2026-10-21T00:00:00.000Z'};
test('an unconfirmed receipt refuses the maintenance before anything is stopped and names the gate and receipt',async t=>{
 const f=await fixture(t,{receipts:[unresolvedReceipt]}),before=await inspectDaemon(f.options);
 const row=await f.run({...f.input,operationId:'receipt-blocked'});
 assert.equal(row.state,'rejected',JSON.stringify(row));
 assert.equal(row.error.code,'DAEMON_BUSY');
 assert.equal(row.error.message,'后台仍有未确认的原任务/控制收据。');
 assert.equal(row.error.details.gate,'receipts');
 assert.deepEqual(row.error.details.receipts,[{key:'blocked-original',op:'submit',state:'unknown',updatedAt:'2026-10-21T00:00:00.000Z'}]);
 assert.deepEqual(row.error.details.tasks,[]);
 assert.equal(row.data.stopped,false);assert.equal(row.data.overridden,undefined);
 const live=await inspectDaemon(f.options);assert.equal(live.pid,before.pid);assert.equal(live.version,f.from.version);
 const ledger=JSON.parse(fs.readFileSync(path.join(f.options.stateDirectory,'daemon-receipts.json')));assert(ledger.some(r=>r.key==='blocked-original'&&r.state==='unknown'));
});
test('an explicitly confirmed unresolved receipt upgrades while the original unknown receipt stays durable',async t=>{
 const f=await fixture(t,{receipts:[unresolvedReceipt]}),id=(await inspectDaemon(f.options)).daemonId;
 const row=await f.run({...f.input,operationId:'receipt-overridden',allowUnresolvedReceipts:true});
 assert.equal(row.state,'confirmed',JSON.stringify(row));
 assert.equal(row.data.overridden,true);assert.equal(row.data.stopped,true);assert.equal(row.data.rolledBack,false);
 assert.deepEqual(row.data.unresolved,[{key:'blocked-original',op:'submit',state:'unknown',updatedAt:'2026-10-21T00:00:00.000Z'}]);
 const live=await inspectDaemon(f.options);assert.equal(live.version,f.target.version);assert.equal(live.daemonId,id);
 const ledger=JSON.parse(fs.readFileSync(path.join(f.options.stateDirectory,'daemon-receipts.json')));assert(ledger.some(r=>r.key==='blocked-original'&&r.state==='unknown'),'the overridden receipt is never rewritten or deleted');
 assert.equal(maintenance.query({...f.input,action:'query',operationId:'receipt-overridden'}).state,'confirmed');
});
test('a non-terminal task or Agent is never overridden even when the receipt override is requested',async t=>{
 const f=await fixture(t,{receipts:[unresolvedReceipt]}),before=await inspectDaemon(f.options);
 fs.writeFileSync(path.join(f.options.stateDirectory,'synthetic-host.json'),JSON.stringify({tasks:[{taskId:'active-task',requestId:'active-request',status:'running'}]}),{mode:0o600});
 const row=await f.run({...f.input,operationId:'task-blocked',allowUnresolvedReceipts:true});
 assert.equal(row.state,'rejected',JSON.stringify(row));
 assert.equal(row.error.code,'DAEMON_BUSY');assert.equal(row.error.message,'后台仍有运行、等待或未知任务。');
 assert.equal(row.error.details.gate,'tasks');
 assert.equal(row.error.details.tasks[0].taskId,'active-task');assert.equal(row.error.details.tasks[0].requestId,'active-request');assert.equal(row.error.details.tasks[0].status,'running');
 assert.equal(row.data.stopped,false);assert.equal(row.data.overridden,undefined);
 const live=await inspectDaemon(f.options);assert.equal(live.pid,before.pid);assert.equal(live.version,f.from.version);
});


test('a maintenance record lock released between exclusive-create and owner-read is retried without replay',async t=>{
 const f=await fixture(t),lock=path.join(f.options.stateDirectory,'maintenance-operations.json.lock');
 const original=fs.writeFileSync;let collision=false;
 fs.writeFileSync=function(file,...args){
  if(file===lock&&!collision){collision=true;throw Object.assign(Error('released before owner read'),{code:'EEXIST'});}
  return original.call(fs,file,...args);
 };
 try{
  const result=maintenance.query({...f.input,action:'query'});
  assert.equal(collision,true);assert.equal(result.state,'not_found');
  assert.equal(fs.existsSync(lock),false);
 }finally{fs.writeFileSync=original;}
});
