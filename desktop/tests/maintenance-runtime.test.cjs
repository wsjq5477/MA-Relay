const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createHash}=require('node:crypto'),{spawnSync}=require('node:child_process'),{EventEmitter}=require('node:events');
const {maintenanceRuntimeScript}=require('../electron/maintenance-runtime.cjs');
const {remoteExec,SshInstaller}=require('../electron/ssh-install.cjs');
const {SshManager}=require('../electron/ssh-host.cjs');
test('old staging fails in isolation; full manifest loads and repairs the same controller without touching maintenance state',{skip:process.platform!=='linux'},t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ab-controller-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,'versions/fixture'),target=path.join(root,'state/maintenance-runtime/digest');fs.mkdirSync(path.join(source,'desktop/electron'),{recursive:true});fs.mkdirSync(path.join(source,'runtime'));
 fs.writeFileSync(path.join(source,'package.json'),'{}');fs.copyFileSync(process.execPath,path.join(source,'runtime/node'));fs.chmodSync(path.join(source,'runtime/node'),0o700);fs.writeFileSync(path.join(source,'runtime/owned-stop'),'unused');
 const names=['remote-maintenance','machine-daemon','machine-protocol','runtime-capabilities','browser-management','browser-channel','browser-pairing','browser-protocol','graph-layout'];
 for(const n of names)fs.copyFileSync(path.join(__dirname,'../electron',n+'.cjs'),path.join(source,'desktop/electron',n+'.cjs'));
 fs.cpSync(path.dirname(require.resolve('ws/package.json')),path.join(source,'node_modules/ws'),{recursive:true});
 const files=[];function walk(dir,rel=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.posix.join(rel,e.name),f=path.join(dir,e.name);if(e.isDirectory())walk(f,p);else{const b=fs.readFileSync(f);files.push({path:p,size:b.length,sha256:createHash('sha256').update(b).digest('hex')});}}}walk(source);
 const release={version:'fixture',digest:'digest',manifest:{files}};fs.writeFileSync(path.join(source,'.bridge-release.json'),JSON.stringify({digest:'digest',ownerCoordinatorId:'owner'}));
 fs.mkdirSync(path.join(target,'desktop/electron'),{recursive:true,mode:0o700});fs.mkdirSync(path.join(target,'runtime'),{mode:0o700});
 for(const f of ['package.json','runtime/node','runtime/owned-stop',...names.slice(0,4).map(n=>'desktop/electron/'+n+'.cjs')])fs.copyFileSync(path.join(source,f),path.join(target,f));
 const state=path.join(root,'state');fs.chmodSync(state,0o700);fs.chmodSync(path.dirname(target),0o700);fs.chmodSync(target,0o700);
 const load=()=>spawnSync(process.execPath,['--no-global-search-paths','-e','require('+JSON.stringify(path.join(target,'desktop/electron/remote-maintenance.cjs'))+')'],{cwd:root,env:{HOME:root,NODE_PATH:''},encoding:'utf8'});
 const before=load();assert.notEqual(before.status,0);assert.match(before.stderr,/MODULE_NOT_FOUND/);assert.match(before.stderr,/browser-management/);
 const evidence=path.join(state,'untouched');fs.writeFileSync(evidence,'old daemon / original operation');
 const script=maintenanceRuntimeScript({versionPath:source,uid:process.getuid(),ownerCoordinatorId:'owner',stateDirectory:state},release,target);
 const prepare=()=>spawnSync(process.execPath,['--no-global-search-paths','-'],{input:script,encoding:'utf8',timeout:60000});
 let result=prepare();assert.equal(result.status,0,result.stderr);assert.equal(load().status,0);
 fs.unlinkSync(path.join(target,'desktop/electron/browser-channel.cjs'));result=prepare();assert.equal(result.status,0,result.stderr);assert.equal(load().status,0);assert.equal(fs.readFileSync(evidence,'utf8'),'old daemon / original operation');
 fs.writeFileSync(path.join(source,'desktop/electron/browser-channel.cjs'),'tampered');result=prepare();assert.notEqual(result.status,0);assert.match(result.stderr,/SSH_PACKAGE_CHECKSUM/);assert.equal(load().status,0);
});
test('nonzero controller exit retains safe structured diagnostic without raw stderr',async()=>{
 const client={exec(cmd,opts,cb){const s=new EventEmitter();s.stderr=new EventEmitter();s.close=()=>{};s.end=()=>{s.stderr.emit('data',Buffer.from("Cannot find module '/private/secret/browser-management.cjs'\n code: 'MODULE_NOT_FOUND' token=do-not-expose"));s.emit('close',1);};cb(null,s);}};
 await assert.rejects(remoteExec(client,'controlled','',{maintenanceDiagnostics:true,errorCode:'DAEMON_MAINTENANCE_TRANSPORT'}),e=>{assert.equal(e.details.controllerCode,'MODULE_NOT_FOUND');assert.equal(e.details.stage,'exit');assert(!JSON.stringify(e).includes('secret'));assert(!JSON.stringify(e).includes('do-not-expose'));return true;});
});
test('original-ID recovery repairs once then only queries the unchanged input',async()=>{
 const original={operationId:'original',action:'upgrade',controller:{version:'f',digest:'d'}},row={operationId:'original',remoteInput:original,controller:'/original/controller'};let repairs=0;const calls=[];
 const context={authenticate:async()=>({}),installer:{async remoteMaintenance(client,input){calls.push(input);if(calls.length===1)throw Object.assign(Error('missing'),{details:{controllerCode:'MODULE_NOT_FOUND'}});return {operationId:'original',state:'not_found'};},async repairMaintenance(client,input,dir){repairs++;assert.equal(input,original);assert.equal(dir,row.controller);}}};
 const result=await SshManager.prototype.queryWithRecovery.call(context,{},row);assert.equal(result.state,'not_found');assert.equal(repairs,1);assert.deepEqual(calls,[{...original,action:'query'},{...original,action:'query'}]);assert.equal(original.action,'upgrade');
});
test('query startup failure is persisted on the original unknown without releasing it',async()=>{
 const c={maintenance:{operationId:'original'}},row={operationId:'original',state:'unknown',remoteLaunched:true,data:{connectionId:'c'}};let saved;
 const ctx={find:()=>c,queryWithRecovery:async()=>{throw Object.assign(Error('safe'),{code:'DAEMON_MAINTENANCE_TRANSPORT',details:{controllerCode:'MODULE_NOT_FOUND',controllerMessage:'依赖缺失'}});},state:(connection,stage)=>{saved=stage;},publicOperation:r=>r};
 const result=await SshManager.prototype.queryMaintenance.call(ctx,row);assert.equal(result.state,'unknown');assert.equal(result.error.details.controllerCode,'MODULE_NOT_FOUND');assert.equal(c.maintenance.error,result.error);assert.equal(saved,'maintaining');
});
test('repair refuses a changed target digest before any remote command',async()=>{
 const installer=Object.create(SshInstaller.prototype);installer.release=()=>({digest:'different',manifest:{version:'v'}});installer.prepareMaintenanceRuntime=()=>assert.fail('must not stage');
 await assert.rejects(installer.repairMaintenance({}, {controller:{version:'v',digest:'original'},stateDirectory:'/state'},'/state/maintenance-runtime/original'),{code:'SSH_PACKAGE_CHECKSUM'});
});
test('a missing remote receipt cannot settle or release an original unknown',async()=>{
 const row={operationId:'original',state:'unknown',remoteLaunched:true,data:{connectionId:'c'}},c={maintenance:{operationId:'original'}};let saved=0;
 const ctx={find:()=>c,queryWithRecovery:async()=>({operationId:'original',state:'not_found'}),save:()=>saved++,publicOperation:r=>r};
 const result=await SshManager.prototype.queryMaintenance.call(ctx,row);assert.equal(result.state,'unknown');assert.equal(result.error.code,'DAEMON_MAINTENANCE_NOT_FOUND');assert.equal(c.maintenance.error,result.error);assert.equal(saved,1);
});
