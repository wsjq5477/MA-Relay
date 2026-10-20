const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {MachineRouter}=require('../electron/machine-router.cjs'),{SshManager}=require('../electron/ssh-host.cjs'),{uploadArchive}=require('../electron/ssh-install.cjs');
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-progress-persist-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return directory;}
function maintenance(t,{failProgress=false,failFinal=false,failReceipt=false}={}){
 const directory=fixture(t),router=new MachineRouter({directory,platform:'linux'}),events=[];let launches=0,staged=false;
 const release={version:'new',digest:'a'.repeat(64),manifest:{version:'new'}},installer={bundle:()=>release,release:()=>release,async stageMaintenance(_client,_probe,_id,progress){for(let i=1;i<=160;i++)progress({phase:'uploading',completedBytes:i*32768,totalBytes:160*32768});staged=true;progress({phase:'verifying',completedBytes:160*32768,totalBytes:160*32768});return {directory:'/controlled-runtime',release};},async remoteMaintenance(){launches++;}};
 const manager=new SshManager({directory,coordinatorId:'synthetic',installer,onChange(state,meta){events.push(meta);if(meta?.progressOnly){if(failProgress)throw Object.assign(Error('private path must not leak'),{code:'EPERM'});return;}if(staged&&failFinal)throw Object.assign(Error('private path'),{code:'EBUSY'});router.save();}});t.after(()=>manager.close());
 const c={connectionId:'original',machineId:'ssh-original',daemonId:'original-daemon',revision:1,authKind:'agent',stage:'online',online:true,daemonVersion:'old',autoReconnect:true};manager.connections.push(c);manager.save();
 manager.maintenanceEntry=async()=>({previewId:'preview',daemonVersion:'old',targetVersion:'new',home:'/synthetic',installPath:'/synthetic/install',stateDirectory:'/synthetic/state',uid:1000,profileId:'original-profile'});manager.authenticate=async()=>({});
 if(failReceipt){const save=manager.save.bind(manager);manager.save=()=>{if(staged)throw Object.assign(Error('private path'),{code:'EACCES'});save();};}
 const params={operationId:'original-maintenance',connectionId:c.connectionId,expectedRevision:1,config:{action:'upgrade',previewId:'preview',expectedVersion:'old',targetVersion:'new'}};
 return {manager,c,params,events,launches:()=>launches};
}
test('progress observer EPERM cannot abort an acknowledged SFTP upload',async t=>{
 const directory=fixture(t),file=path.join(directory,'archive');fs.writeFileSync(file,Buffer.alloc(32768*40));const sftp=new EventEmitter();let bytes=0,calls=0;
 sftp.open=(_p,_f,_m,cb)=>cb(null,Buffer.from('handle'));sftp.write=(_h,_b,_o,len,_pos,cb)=>{bytes+=len;setImmediate(cb);};sftp.close=(_h,cb)=>setImmediate(cb);
 const result=await uploadArchive(sftp,file,'/synthetic/current-upload',()=>{calls++;if(calls===3)throw Object.assign(Error('private path'),{code:'EPERM'});});
 assert.equal(bytes,fs.statSync(file).size);assert.equal(result.progressWarning.causeCode,'EPERM');assert(!JSON.stringify(result).includes('private path'));
});
test('machine catalog retries sharing violations atomically and removes only its own temp on failure',t=>{
 const directory=fixture(t),router=new MachineRouter({directory,platform:'win32'}),original=fs.readFileSync(router.file),rename=fs.renameSync;
 fs.writeFileSync(path.join(directory,'machines.json.historical.tmp'),'history');let attempts=0;
 fs.renameSync=(a,b)=>{if(b===router.file&&++attempts===1)throw Object.assign(Error('sharing'),{code:'EPERM'});return rename(a,b);};
 try{router.catalog.machines[0].name='updated';router.save();}finally{fs.renameSync=rename;}
 assert.equal(attempts,2);assert.equal(JSON.parse(fs.readFileSync(router.file)).machines[0].name,'updated');
 const good=fs.readFileSync(router.file);fs.renameSync=(a,b)=>{if(b===router.file)throw Object.assign(Error('sharing'),{code:'EBUSY'});return rename(a,b);};
 try{router.catalog.machines[0].name='unsaved';assert.throws(()=>router.save(),{code:'EBUSY'});}finally{fs.renameSync=rename;}
 assert.deepEqual(fs.readFileSync(router.file),good);assert.notDeepEqual(good,original);assert.deepEqual(fs.readdirSync(directory).filter(n=>n.endsWith('.tmp')),['machines.json.historical.tmp']);
});
test('high-frequency maintenance progress is memory-only, throttled and best effort, final state still saves',async t=>{
 const f=maintenance(t,{failProgress:true});const row=await f.manager.call('machine.maintainDaemon',f.params);
 assert.equal(row.state,'unknown');assert.equal(f.launches(),1);assert(f.events.filter(e=>e?.progressOnly).length<=4);assert.equal(f.c.progressWarning.causeCode,'EPERM');assert(!JSON.stringify(f.manager.publicState(f.c)).includes('private path'));
 const stored=JSON.parse(fs.readFileSync(f.manager.file));assert.equal(stored.lifecycleOperations[0].remoteLaunched,true);assert.equal(stored.connections[0].progressWarning.causeCode,'EPERM');
});
for(const kind of ['failFinal','failReceipt'])test('final '+kind+' failure never sends maintenance and retains local diagnostics',async t=>{
 const f=maintenance(t,{[kind]:true});await assert.rejects(f.manager.call('machine.maintainDaemon',f.params),e=>e.code==='DAEMON_PERSIST_FAILED'&&e.details.remoteInputSent===false&&e.details.extracted===true&&e.details.completedBytes===160*32768&&!e.message.includes('private path'));
 assert.equal(f.launches(),0);assert.equal(f.c.daemonVersion,'old');assert.notEqual(f.manager.lifecycleOperations[0]?.remoteLaunched,true);
});
test('SFTP upload errors survive the maintenance pre-send guard without generic stage replacement',async t=>{
 const f=maintenance(t);f.manager.installer.stageMaintenance=async()=>{throw Object.assign(Error('safe upload error'),{code:'SSH_UPLOAD_FAILED',details:{stage:'write',completedBytes:32768,totalBytes:65536,extracted:false,remoteInputSent:false,causeCode:'ENOSPC'}});};
 await assert.rejects(f.manager.call('machine.maintainDaemon',f.params),{code:'SSH_UPLOAD_FAILED'});assert.equal(f.launches(),0);
});

 test('a rejected original checkpoint survives journal restart with safe details and never resends',async t=>{
  const f=maintenance(t,{failFinal:true}),{GraphOperationJournal}=require('../electron/graph-operations.cjs'),journal=new GraphOperationJournal(f.manager.options.directory);
  await assert.rejects(journal.save('machine.maintainDaemon',f.params,(m,p)=>f.manager.call(m,p)),{code:'DAEMON_PERSIST_FAILED'});
  const restored=new GraphOperationJournal(f.manager.options.directory),receipt=await restored.lookup('machine.operation',{operationId:f.params.operationId},(m,p)=>f.manager.call(m,p));
  assert.equal(receipt.state,'rejected');assert.equal(receipt.error.details.remoteInputSent,false);assert.equal(receipt.error.details.causeCode,'EBUSY');assert.equal(f.launches(),0);assert.equal(restored.pending().length,0);
 });
