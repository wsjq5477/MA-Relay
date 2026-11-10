const test=require('node:test'),assert=require('node:assert/strict');
const {SshManager}=require('../electron/ssh-host.cjs');
const {SshInstaller}=require('../electron/ssh-install.cjs');
const {Readable}=require('node:stream');
function fixture(){
 const input={action:'upgrade',operationId:'original',from:{version:'v1',digest:'digest'},installPath:'/install',stateDirectory:'/state',profileId:'profile',uid:123};
 const row={operationId:'original',state:'unknown',remoteLaunched:true,remoteInput:input,controller:'/controller',data:{action:'maintainDaemon',connectionId:'connection',machineId:'machine'}};
 const c={connectionId:'connection',machineId:'machine',maintenance:{operationId:'original',state:'unknown'},autoReconnect:false};
 const calls=[];const preview={daemonVersion:'v1',manifestDigest:'digest',installPath:'/install',stateDirectory:'/state',profileId:'profile',uid:123,installNeeded:false};
 const ctx={connections:[c],lifecycleOperations:[row],jobs:new Map(),find:()=>c,authenticate:async()=>({}),installer:{readMaintenanceReceipt:async(_client,request)=>{calls.push({...request,action:'query'});return {operationId:'original',state:'not_found'};},maintenancePreview:async()=>preview},serial:(_c,_kind,fn)=>fn(),save(){},options:{},publicState:x=>x,publicOperation:x=>structuredClone(x),scheduleReconnect(){calls.push('reconnect');}};
 return {ctx,c,row,preview,calls,params:{operationId:'original',connectionId:'connection',machineId:'machine',confirmNotRun:true}};
}
test('explicit confirmation queries original and settles only local receipt',async()=>{const f=fixture();const result=await SshManager.prototype.confirmMaintenanceNotRun.call(f.ctx,f.params);assert.equal(result.state,'rejected');assert.equal(result.error.code,'DAEMON_NOT_RUN_CONFIRMED');assert.equal(f.c.maintenance.state,'rejected');assert.equal(f.c.autoReconnect,true);assert.deepEqual(f.calls.map(x=>typeof x==='string'?x:x.action),['query','reconnect']);assert.equal(f.calls[0].operationId,'original');});
test('manager dispatch reaches confirmation while the machine is offline',async()=>{const f=fixture();f.ctx.confirmMaintenanceNotRun=SshManager.prototype.confirmMaintenanceNotRun;const result=await SshManager.prototype.call.call(f.ctx,'machine.confirmMaintenanceNotRun',f.params);assert.equal(result.state,'rejected');});
test('missing confirmation, changed identity or non-not-found keep unknown',async()=>{for(const change of [f=>f.params.confirmNotRun=false,f=>f.preview.daemonVersion='v2',f=>f.preview.installPath='/other',f=>f.preview.stateDirectory='/other',f=>f.preview.replacementRequired=true,f=>f.preview.manifestDigest='other',f=>f.ctx.installer.readMaintenanceReceipt=async()=>({operationId:'original',state:'confirmed'}),f=>f.params.machineId='other']){const f=fixture();change(f);await assert.rejects(SshManager.prototype.confirmMaintenanceNotRun.call(f.ctx,f.params));assert.equal(f.row.state,'unknown');assert.equal(f.c.maintenance.state,'unknown');assert.equal(f.c.autoReconnect,false);}});
test('local persistence failure restores unknown',async()=>{const f=fixture();f.ctx.save=()=>{throw Error('disk');};await assert.rejects(SshManager.prototype.confirmMaintenanceNotRun.call(f.ctx,f.params));assert.equal(f.row.state,'unknown');assert.equal(f.c.maintenance.state,'unknown');assert.equal(f.c.autoReconnect,false);});
test('a late not_found query cannot overwrite a settled local receipt',async()=>{const f=fixture();let finish;f.ctx.queryWithRecovery=()=>new Promise(resolve=>{finish=resolve;});const pending=SshManager.prototype.queryMaintenance.call(f.ctx,f.row);await Promise.resolve();await SshManager.prototype.confirmMaintenanceNotRun.call(f.ctx,f.params);finish({operationId:'original',state:'not_found'});const result=await pending;assert.equal(result.error.code,'DAEMON_NOT_RUN_CONFIRMED');assert.equal(f.c.maintenance.error.code,'DAEMON_NOT_RUN_CONFIRMED');});
test('remote receipt inspection only reads the original owned ledger and refuses a lock',async()=>{
 const input={home:'/home/u',stateDirectory:'/home/u/state',uid:123,daemonId:'daemon',ownerCoordinatorId:'owner',profileId:'profile',operationId:'original'};
 const identity={kind:'agentbridge-machine',stateVersion:1,daemonId:'daemon',ownerCoordinatorId:'owner',profileId:'profile',uid:123,stateDirectory:input.stateDirectory};
 const files={'/home/u/state/machine.json':JSON.stringify(identity),'/home/u/state/maintenance-operations.json':'[]'};let locked=false;
 const sftp={lstat(p,cb){if(p.endsWith('.lock')&&locked)return cb(null,{uid:123});if(p==='/home/u'||p==='/home/u/state')return cb(null,{uid:123,isDirectory:()=>true,isSymbolicLink:()=>false});if(p in files)return cb(null,{uid:123,size:files[p].length,isFile:()=>true,isSymbolicLink:()=>false});cb({code:2});},createReadStream:p=>Readable.from([Buffer.from(files[p])]),end(){}};
 const client={sftp:cb=>cb(null,sftp)},installer=Object.create(SshInstaller.prototype);
 assert.equal((await installer.readMaintenanceReceipt(client,input)).state,'not_found');
 locked=true;await assert.rejects(installer.readMaintenanceReceipt(client,input),{code:'DAEMON_RECOVERY_UNSAFE'});
});
