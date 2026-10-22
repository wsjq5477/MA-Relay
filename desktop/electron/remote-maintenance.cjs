const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn,execFileSync}=require('node:child_process'),{createHash,randomUUID}=require('node:crypto');
const {identity,inspectDaemon,inspectFile,privateDirectory,socketPathFor}=require('./machine-daemon.cjs');
const {FramedStream}=require('./machine-protocol.cjs');
const fail=(code,message)=>Object.assign(Error(message),{code}),terminal=new Set(['succeeded','failed','cancelled']);
const safeCode=error=>typeof error?.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)?error.code:'DAEMON_MAINTENANCE_FAILED';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
function atomic(file,value){const temp=file+'.'+randomUUID()+'.tmp';const fd=fs.openSync(temp,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temp,file);}
function mutateRows(file,change){
 const lock=file+'.lock',deadline=Date.now()+2000;let acquired=false;
 while(!acquired){try{fs.writeFileSync(lock,JSON.stringify({pid:process.pid,pidStart:processStart(process.pid)}),{flag:'wx',mode:0o600});acquired=true;}catch(e){if(e.code!=='EEXIST')throw e;let owner;try{owner=read(lock);}catch(error){if(error.code==='ENOENT')continue;throw error;}if(owner.pidStart&&processStart(owner.pid)!==owner.pidStart){fs.unlinkSync(lock);continue;}if(Date.now()>=deadline)throw fail('DAEMON_MAINTENANCE','原维护记录正在提交，请查询原操作。');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);}}
 try{const rows=fs.existsSync(file)?read(file):[],result=change(rows);atomic(file,rows);return result;}finally{if(read(lock).pid===process.pid)fs.unlinkSync(lock);}
}
function commitRow(file,row){return mutateRows(file,rows=>{const current=rows.find(r=>r.operationId===row.operationId);if(!current)throw fail('OPERATION_NOT_FOUND','原维护记录缺失。');for(const key of ['state','phase','updatedAt','data','error','quarantine'])if(row[key]!==undefined)current[key]=row[key];return current;});}
function read(file){inspectFile(file,'file');return JSON.parse(fs.readFileSync(file,'utf8'));}
function opts(input){
 if(!['upgrade','rollback','stop','uninstall','query'].includes(input.action)||typeof input.operationId!=='string'||!/^[a-zA-Z0-9_.:-]{1,128}$/.test(input.operationId))throw fail('INVALID_INPUT','维护需要合法动作与原操作 ID。');
 const value={stateDirectory:input.stateDirectory,ownerCoordinatorId:input.ownerCoordinatorId,profileId:input.profileId};const info=identity(value,false);
 if(info.daemonId!==input.daemonId||info.uid!==input.uid)throw fail('DAEMON_IDENTITY_CHANGED','维护来源身份不匹配。');
 if(input.action==='query'&&!fs.existsSync(input.installPath))return {info,value,file:path.join(info.stateDirectory,'maintenance-operations.json'),lease:path.join(info.stateDirectory,'remote-maintenance.lock')};
 const install=fs.realpathSync(input.installPath);if(install!==input.installPath||!install.startsWith(fs.realpathSync(input.home)+'/'))throw fail('REMOTE_DIRECTORY_UNSAFE','安装目录必须位于原用户 HOME。');inspectFile(install,'directory');
 const marker=read(path.join(install,'install.json'));if(marker.kind!=='agentbridge-install'||marker.ownerCoordinatorId!==input.ownerCoordinatorId||marker.profileId!==input.profileId)throw fail('DAEMON_OWNER_CONFLICT','安装不属于原中央与 profile。');
 return {info,value,file:path.join(info.stateDirectory,'maintenance-operations.json'),lease:path.join(info.stateDirectory,'remote-maintenance.lock')};
}
function version(input,release){
 if(!release||!/^[a-zA-Z0-9.-]+$/.test(release.version))throw fail('SSH_PACKAGE_INVALID','版本描述无效。');
 const directory=path.join(input.installPath,'versions',release.version);if(fs.realpathSync(directory)!==directory)throw fail('REMOTE_DIRECTORY_UNSAFE','版本路径不规范。');inspectFile(directory,'directory');
 const marker=read(path.join(directory,'.bridge-release.json'));if(marker.ownerCoordinatorId!==input.ownerCoordinatorId||marker.digest!==release.digest)throw fail('SSH_PACKAGE_CHECKSUM','版本标记不符合可信清单。');
 const allowed=new Set(['.bridge-release.json']);for(const file of release.manifest.files){if(typeof file.path!=='string'||file.path.startsWith('/')||file.path.split('/').some(c=>!c||c==='.'||c==='..')||!/^[a-f0-9]{64}$/.test(file.sha256))throw fail('SSH_PACKAGE_INVALID','版本清单路径无效。');allowed.add(file.path);}
 function walk(root,relative=''){for(const name of fs.readdirSync(root)){const rel=path.posix.join(relative,name),file=path.join(root,name),st=fs.lstatSync(file);if(st.isSymbolicLink()||st.uid!==input.uid)throw fail('REMOTE_DIRECTORY_UNSAFE','版本包含无法核对的路径。');if(st.isDirectory())walk(file,rel);else if(!st.isFile()||!allowed.has(rel))throw fail('SSH_PACKAGE_CHECKSUM','版本含清单外文件，不删除或执行。');}}
 walk(directory);
 for(const f of release.manifest.files){const target=path.join(directory,f.path),st=fs.lstatSync(target);if(!st.isFile()||st.isSymbolicLink()||st.uid!==input.uid||st.size!==f.size||createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==f.sha256)throw fail('SSH_PACKAGE_CHECKSUM','发布文件摘要不匹配。');}
 return {version:release.version,digest:release.digest,versionPath:directory};
}
async function peer(input){const info=await inspectDaemon({stateDirectory:input.stateDirectory,ownerCoordinatorId:input.ownerCoordinatorId,profileId:input.profileId});if(info.daemonId!==input.daemonId||info.uid!==input.uid)throw fail('DAEMON_IDENTITY_CHANGED','运行中后台不是原来源。');
 const socket=net.connect(socketPathFor(input.stateDirectory)),channel=new FramedStream(socket),pending=new Map();channel.on('error',()=>{});channel.on('close',()=>{for(const r of pending.values()){clearTimeout(r.timer);r.reject(fail('DAEMON_OFFLINE','维护通道关闭。'));}pending.clear();});
 channel.on('frame',v=>{const r=pending.get(v.id);if(!r)return;pending.delete(v.id);clearTimeout(r.timer);v.error?r.reject(Object.assign(Error(v.error.message),{code:v.error.code})):r.resolve(v.result);});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(fail('DESKTOP_TIMEOUT','维护观察超时。'));},15000);pending.set(id,{resolve,reject,timer});channel.send({id,method,params});});
 await new Promise((r,j)=>{socket.once('connect',r);socket.once('error',j);});await call('hello',{protocolVersion:2,nonce:randomUUID(),sessionId:randomUUID(),coordinatorId:input.ownerCoordinatorId,profileId:input.profileId,expectedDaemonId:input.daemonId});return {info,call,close:()=>channel.close()};
}
const describeTask=t=>({...(typeof t.taskId==='string'?{taskId:t.taskId}:{}),...(typeof t.requestId==='string'?{requestId:t.requestId}:{}),...(typeof t.executionId==='string'?{executionId:t.executionId}:{}),...(typeof t.conversationId==='string'?{conversationId:t.conversationId}:{}),status:t.status,...(typeof t.adapter==='string'?{adapter:t.adapter}:{})});
const describeAgent=a=>({...(typeof a.agentId==='string'?{agentId:a.agentId}:{}),...(typeof a.nodeId==='string'?{nodeId:a.nodeId}:{}),...(typeof a.adapter==='string'?{adapter:a.adapter}:{}),busy:!!a.busy,...(a.currentTask?{currentTask:describeTask(a.currentTask)}:{})});
const blocksReceipt=r=>!['confirmed','rejected'].includes(r.state)||['reply','cancel'].includes(r.op)&&r.result?.state==='unknown';
const describeReceipt=r=>({key:typeof r.key==='string'?r.key:'',op:typeof r.op==='string'?r.op:'',state:typeof r.state!=='string'?'unknown':blocksReceipt(r)&&['confirmed','rejected'].includes(r.state)?'unknown':r.state,...(typeof r.updatedAt==='string'?{updatedAt:r.updatedAt}:{})});
/** Pre-maintenance gate. Tasks and Agent work are never overridable. An unconfirmed
 * receipt is overridable only when the caller explicitly confirmed it
 * (`options.allowUnresolvedReceipts===true`); the skipped receipts are returned so
 * the terminal receipt can record exactly what was overridden. */
async function idle(p,options={}){
 const s=await p.call('snapshot');
 const tasks=(s.tasks||[]).filter(t=>!terminal.has(t.status)).map(describeTask);
 const agents=(s.agents?.items||[]).filter(a=>a.busy||a.currentTask&&!terminal.has(a.currentTask.status)).map(describeAgent);
 if(tasks.length||agents.length)throw Object.assign(fail('DAEMON_BUSY','后台仍有运行、等待或未知任务。'),{details:{gate:'tasks',tasks,agents,receipts:[]}});
 let after=0;const receipts=[];
 try{do{const page=await p.call('daemon.receiptRead',{afterCursor:after,limit:128});for(const r of page.items||[])if(blocksReceipt(r))receipts.push(describeReceipt(r));after=page.nextCursor;if(!page.hasMore)break;}while(true);}
 catch(error){
  // A daemon released before durable receipts exposes no receipt ledger at all,
  // so there is nothing that version could report; the idle snapshot above stays
  // the only barrier it can express. Every other read failure still stops the
  // maintenance and leaves the original daemon running.
  if(error.code!=='DESKTOP_METHOD')throw error;
 }
 const overridden=receipts.length>0;
 if(overridden&&options.allowUnresolvedReceipts!==true)throw Object.assign(fail('DAEMON_BUSY','后台仍有未确认的原任务/控制收据。'),{details:{gate:'receipts',tasks:[],agents:[],receipts}});
 return {tasks:[],agents:[],receipts,overridden};
}
/** A maintenance barrier left behind by an operation that already has a terminal
 * receipt must not wedge a later, unrelated operation: the daemon would reject
 * every quiesce/shutdown attempt and even the original-ID query could never
 * reach the switch phase. Only a durable terminal receipt for the barrier's own
 * operation clears it; an unknown or missing row keeps the barrier. */
async function clearStaleBarrier(input,p){
 const file=path.join(input.stateDirectory,'maintenance.json');if(!fs.existsSync(file))return false;
 const barrier=read(file);if(!barrier||barrier.operationId===input.operationId)return false;
 const ledger=path.join(input.stateDirectory,'maintenance-operations.json');
 const stale=(fs.existsSync(ledger)?read(ledger):[]).find(r=>r.operationId===barrier.operationId);
 if(!stale||!['confirmed','rejected'].includes(stale.state))return false;
 let released=false;
 try{await p.call('daemon.releaseMaintenance',{operationId:barrier.operationId});released=true;}
 catch(error){
  if(error.code==='DESKTOP_METHOD')released=true;
  // A live daemon that does not hold this barrier keeps it out of memory; the
  // following quiesce then owns the file. Never delete an unproven barrier.
  else if(!['DAEMON_MAINTENANCE','DAEMON_OFFLINE','ENOENT'].includes(error.code))throw error;
 }
 if(released&&fs.existsSync(file))fs.unlinkSync(file);
 return released;
}
async function stop(input,p,helper,options={}){
 const original=read(path.join(input.stateDirectory,'daemon.lock'));
 if(original.daemonId!==input.daemonId||original.ownerCoordinatorId!==input.ownerCoordinatorId||original.profileId!==input.profileId||original.pid!==p.info.pid||!original.pidStart)throw fail('DAEMON_OWNERSHIP','后台锁与已核对进程不匹配。');
 const gate=await idle(p,options);await clearStaleBarrier(input,p);
 const barrier=()=>atomic(path.join(input.stateDirectory,'maintenance.json'),{operationId:input.operationId});
 let quiesced=false;
 try{await p.call('daemon.quiesce',{operationId:input.operationId});quiesced=true;}
 catch(e){
  if(e.code==='DESKTOP_METHOD')barrier();
  // The user explicitly confirmed the skipped receipts will never run, but the live
  // daemon enforces its own ledger check and refuses to quiesce. The verified
  // controller-owned stop then carries the switch, and the local barrier is written
  // so the next daemon adopts and later releases it.
  else if(gate.overridden&&options.allowUnresolvedReceipts===true&&e.code==='DAEMON_BUSY')barrier();
  else throw e;
 }
 const overrodeQuiesce=!quiesced&&gate.overridden;
 try{await p.call('daemon.shutdown',{operationId:input.operationId});}catch(e){if(e.code!=='DESKTOP_METHOD'&&!(overrodeQuiesce&&['DAEMON_BUSY','DAEMON_MAINTENANCE'].includes(e.code)))throw e;const lock=read(path.join(input.stateDirectory,'daemon.lock'));if(lock.daemonId!==input.daemonId||lock.ownerCoordinatorId!==input.ownerCoordinatorId||lock.profileId!==input.profileId||lock.pid!==p.info.pid)throw fail('DAEMON_OWNERSHIP','后台锁与已核对进程不匹配。');try{execFileSync(helper,[String(lock.pid),String(lock.pidStart),String(input.uid)],{timeout:5000,stdio:'ignore'});}catch(error){throw error.status===3?fail('DAEMON_STOP_UNSUPPORTED','系统不支持安全 pidfd 停止，原后台保留。'):fail('DAEMON_STOP_FAILED','安全停机资源或进程核验失败，原后台保留。');}}
 p.close();await waitStopped(input,original);
 return gate;
}
async function waitStopped(input,original,options={}){
 const inspect=options.inspect||inspectDaemon,start=options.processStart||processStart,deadline=Date.now()+(options.timeoutMs||15000);
 while(Date.now()<deadline){let offline=false;
  try{const live=await inspect({stateDirectory:input.stateDirectory,ownerCoordinatorId:input.ownerCoordinatorId,profileId:input.profileId},500);if(live.pid!==original.pid)throw fail('DAEMON_IDENTITY_CHANGED','停机期间出现其他后台，保留原维护。');}
  catch(e){if(['DAEMON_OFFLINE','ECONNREFUSED','ENOENT','ECONNRESET','EPIPE'].includes(e.code))offline=true;else throw e;}
  if(offline&&start(original.pid)!==original.pidStart)return;
  await new Promise(r=>setTimeout(r,100));
 }throw fail('DAEMON_STOP_TIMEOUT','原后台尚未结束，未切换版本。');
}
async function start(input,release){const node=path.join(release.versionPath,'runtime/node'),entry=path.join(release.versionPath,'desktop/electron/machine-daemon.cjs');execFileSync(node,[entry,'--state-directory',input.stateDirectory,'--owner',input.ownerCoordinatorId,'--profile',input.profileId],{timeout:30000,stdio:['ignore','pipe','ignore']});const p=await peer(input);try{if(p.info.version!==release.version)throw fail('DAEMON_VERSION_CONFLICT','启动后的实际版本不匹配。');const ping=await p.call('ping',{nonce:'health'});if(ping.nonce!=='health')throw fail('DAEMON_PROTOCOL','健康检查不匹配。');await p.call('snapshot');}finally{p.close();}}
async function release(input){const file=path.join(input.stateDirectory,'maintenance.json');if(!fs.existsSync(file))return;if(read(file).operationId!==input.operationId)throw fail('DAEMON_MAINTENANCE','不能解除另一条维护占位。');try{const p=await peer(input);try{await p.call('daemon.releaseMaintenance',{operationId:input.operationId});}finally{p.close();}}catch(e){if(!['DESKTOP_METHOD','DAEMON_OFFLINE','ECONNREFUSED','ENOENT'].includes(e.code))throw e;if(fs.existsSync(file))fs.unlinkSync(file);}}
async function run(input,options={}){
 const o=opts(input),rows=fs.existsSync(o.file)?read(o.file):[],row=rows.find(r=>r.operationId===input.operationId);if(!row)throw fail('OPERATION_NOT_FOUND','没有原维护意图。');if(row.state!=='unknown')return row;
 const write=()=>commitRow(o.file,row),checkpoint=phase=>{row.phase=phase;row.updatedAt=new Date().toISOString();write();};let switched=false,stopped=false,from,acquired=false;
 // Only the strict boolean from the original input (or a controlled test option)
 // enables the receipt override; anything else keeps the gate.
 const allowUnresolvedReceipts=input.allowUnresolvedReceipts===true||options.allowUnresolvedReceipts===true,overridden=()=>gate.overridden?{overridden:true,unresolved:gate.receipts}:{};
 let gate={tasks:[],agents:[],receipts:[],overridden:false};
 try{
  if(fs.existsSync(o.lease))throw fail('DAEMON_MAINTENANCE','另一条维护尚在运行，原意图保留。');fs.writeFileSync(o.lease,JSON.stringify({operationId:input.operationId,pid:process.pid,pidStart:processStart(process.pid)}),{flag:'wx',mode:0o600});acquired=true;
  from=version(input,input.from);const current=read(path.join(input.installPath,'current.json'));if(digest(current)!==digest(from))throw fail('INSTALL_PREVIEW_CHANGED','原版本在批准后发生变化。');
  const target=['upgrade','rollback'].includes(input.action)?version(input,input.target):null;
  const helper=path.join(version(input,input.controller).versionPath,'runtime/owned-stop');
  // All installed directories must be trusted before removing any installation.
  if(input.action==='uninstall'){for(const name of fs.readdirSync(input.installPath))if(!['install.json','current.json','previous.json','versions'].includes(name))throw fail('REMOTE_DIRECTORY_UNSAFE','安装含未核对文件，保留目录。');for(const v of fs.readdirSync(path.join(input.installPath,'versions'))){const descriptor=input.releases.find(r=>r.version===v);if(!descriptor)throw fail('SSH_PACKAGE_CHECKSUM','安装含未知版本，保留目录。');version(input,descriptor);}}
  checkpoint('validated');const p=await peer(input);try{gate=await stop(input,p,helper,{allowUnresolvedReceipts});}finally{p.close();}stopped=true;checkpoint('stopped');
  if(input.action==='uninstall'){row.quarantine=path.join(path.dirname(input.installPath),'.uninstalled-'+digest(input.operationId));if(fs.existsSync(row.quarantine))throw fail('REMOTE_DIRECTORY_UNSAFE','隔离回收路径已存在。');checkpoint('uninstalling');fs.renameSync(input.installPath,row.quarantine);checkpoint('uninstalled');}
  if(target){atomic(path.join(input.installPath,'previous.json'),from);atomic(path.join(input.installPath,'current.json'),target);switched=true;checkpoint('activated');if(options.failHealth)throw fail('TEST_HEALTH','受控健康失败。');await start(input,target);await release(input);checkpoint('healthy');}
  else await release(input);
  row.state='confirmed';row.data={action:input.action,version:target?.version||from.version,stopped,rolledBack:false,phase:row.phase,historyPreserved:true,...overridden()};write();if(row.quarantine)try{fs.rmSync(row.quarantine,{recursive:true});}catch{/* Inert verified quarantine can be reclaimed by the original receipt query. */}
 }catch(error){
  if(!acquired&&error.code==='DAEMON_MAINTENANCE')return read(o.file).find(r=>r.operationId===input.operationId);
  let rolledBack=false;
  if(switched&&from){try{try{const p=await peer(input);try{await stop(input,p,path.join(input.installPath,'versions',input.controller.version,'runtime/owned-stop'));}finally{p.close();}}catch(e){if(!['DAEMON_OFFLINE','ECONNREFUSED','ENOENT'].includes(e.code))throw e;}atomic(path.join(input.installPath,'current.json'),from);await start(input,from);await release(input);rolledBack=true;}catch{row.state='unknown';row.error={code:'DAEMON_ROLLBACK_UNCONFIRMED',message:'原维护及回滚尚未确认，请查询原操作。'};row.data={action:input.action,rolledBack:false,stopped:true,phase:row.phase,version:from.version,historyPreserved:true};write();return row;}}
  else if(!stopped&&acquired){try{await release(input);}catch{}}
  // A terminal rejection may only be written when the original daemon is still
  // running or was restored. Once it was stopped without a confirmed switch or
  // rollback the receipt stays unknown, so the original-ID query can restore it
  // instead of the desktop treating the machine as finished and leaving it down.
  const restorePending=stopped&&!rolledBack&&['upgrade','rollback'].includes(input.action);
  row.state=restorePending||['DAEMON_MAINTENANCE','DAEMON_STOP_TIMEOUT'].includes(error.code)?'unknown':'rejected';
  // A named gate keeps its own wording and blocker detail; the generic wrapper only
  // replaces failures that carry no user-facing explanation of their own.
  const details=error?.details&&['tasks','receipts'].includes(error.details.gate)?error.details:undefined;
  row.error=restorePending?{code:'DAEMON_ROLLBACK_UNCONFIRMED',message:'后台已停止但原版本未确认恢复（'+safeCode(error)+'）；请查询原操作。'}:{code:error.code||'DAEMON_MAINTENANCE_FAILED',message:details&&error.message?error.message:error.code?'后台维护未执行或未完成（'+safeCode(error)+'）；原版本与历史保留。':'后台维护失败，请查询原操作。',...(details?{details}:{})};
  row.data={action:input.action,rolledBack,stopped,phase:row.phase,version:from?.version,historyPreserved:true,...overridden()};write();
 }finally{if(acquired&&fs.existsSync(o.lease)&&read(o.lease).operationId===input.operationId)fs.unlinkSync(o.lease);}
 return row;
}
function processStart(pid){try{return fs.readFileSync('/proc/'+pid+'/stat','utf8').replace(/^.*\) /,'').split(' ')[19];}catch{return null;}}
async function recover(input){
 const o=opts({...input,action:'query'}),rows=read(o.file),row=rows.find(r=>r.operationId===input.operationId);if(!row||row.state!=='unknown')return row;
 const lease=fs.existsSync(o.lease)?read(o.lease):null;
 if(lease&&processStart(lease.pid)===lease.pidStart)return row;
 if(lease)fs.unlinkSync(o.lease);
 try{fs.writeFileSync(o.lease,JSON.stringify({operationId:input.operationId,pid:process.pid,pidStart:processStart(process.pid)}),{flag:'wx',mode:0o600});}catch{return row;}
 try{
  const exists=fs.existsSync(input.installPath);
  if(['uninstalled','uninstalling'].includes(row.phase)&&!exists){row.state='confirmed';row.data={action:'uninstall',stopped:true,historyPreserved:true};}
  else if(row.action==='stop'&&row.phase==='stopped'){await release(input);row.state='confirmed';row.data={action:'stop',version:input.from.version,stopped:true,historyPreserved:true};}
  else if(row.phase==='healthy'){
   const current=read(path.join(input.installPath,'current.json')),live=await inspectDaemon(o.value);if(live.version!==input.target.version||current.version!==input.target.version)throw fail('DAEMON_VERSION_CONFLICT','实际版本未确认。');row.state='confirmed';row.data={action:row.action,version:live.version,stopped:true,rolledBack:false,historyPreserved:true};
  }else if(row.phase==='intent'){row.state='rejected';row.error={code:'DAEMON_NOT_STARTED',message:'原维护未到版本或进程变更阶段。'};}
  else{
   const from=version(input,input.from),current=read(path.join(input.installPath,'current.json'));
   if(![input.from.version,input.target?.version].includes(current.version))throw fail('INSTALL_PREVIEW_CHANGED','版本来源已变化，保留原维护。');
   try{const p=await peer(input);try{await stop(input,p,path.join(input.installPath,'versions',input.controller.version,'runtime/owned-stop'));}finally{p.close();}}catch(e){if(!['DAEMON_OFFLINE','ECONNREFUSED','ENOENT'].includes(e.code))throw e;}
   atomic(path.join(input.installPath,'current.json'),from);await start(input,from);await release(input);row.state='rejected';row.error={code:'DAEMON_RECOVERED_ROLLBACK',message:'原维护中断，已按原收据恢复原版本。'};row.data={action:row.action,rolledBack:true,stopped:true,version:from.version,historyPreserved:true};
  }
  commitRow(o.file,row);
 }catch{/* Incomplete proof preserves unknown and the original task barrier. */}finally{if(fs.existsSync(o.lease)&&read(o.lease).pid===process.pid)fs.unlinkSync(o.lease);}
 return row;
}
/** The recorded maintenance worker is gone, so the durable row can be reconciled
 * by the detached recovery worker. A row that never recorded a worker is only
 * treated as abandoned after a grace period: launch() commits the durable row
 * before spawning the worker, and a query may arrive between the two commits.
 * Without this, a row whose workerPid was never written (controller killed
 * between the commits) could never reconcile and the desktop would keep the
 * maintenance barrier forever. */
function abandoned(row){
 if(!row)return false;
 if(row.workerPid)return !(row.workerStart&&processStart(row.workerPid)===row.workerStart);
 if(row.phase&&row.phase!=='intent')return true;
 const stamp=Date.parse(row.createdAt||row.updatedAt||'');
 return Number.isFinite(stamp)&&Date.now()-stamp>60000;
}
function query(input){const o=opts(input);return mutateRows(o.file,rows=>{const row=rows.find(r=>r.operationId===input.operationId);if(row?.state==='unknown'&&abandoned(row)){
 const source=path.join(o.info.stateDirectory,'maintenance-input-'+digest(input.operationId)+'.json');
 if(fs.existsSync(source)){const child=spawn(process.execPath,[__filename,'--recover',source],{detached:true,stdio:'ignore'});child.unref();row.workerPid=child.pid;row.workerStart=processStart(child.pid);}
 }return row||{operationId:input.operationId,state:'not_found'};});}
function launch(input){const o=opts(input),fingerprint=digest(input),source=path.join(o.info.stateDirectory,'maintenance-input-'+digest(input.operationId)+'.json');
 const row=mutateRows(o.file,rows=>{const prior=rows.find(r=>r.operationId===input.operationId);if(prior){if(prior.fingerprint!==fingerprint)throw fail('OPERATION_CONFLICT','原维护 ID 已用于另一内容。');return prior;}atomic(source,input);const row={operationId:input.operationId,fingerprint,state:'unknown',phase:'intent',action:input.action,createdAt:new Date().toISOString()};rows.push(row);return row;});
 if(row.state!=='unknown'||row.workerPid)return row;
 return mutateRows(o.file,rows=>{const current=rows.find(r=>r.operationId===input.operationId);if(current.workerPid||current.state!=='unknown')return current;const child=spawn(process.execPath,[__filename,'--worker',source],{detached:true,stdio:'ignore',env:{...process.env,PATH:path.dirname(process.execPath)+path.delimiter+(process.env.PATH||'')}});child.unref();current.workerPid=child.pid;current.workerStart=processStart(child.pid);return current;});
}
if(require.main===module){(async()=>{if(process.argv[2]==='--recover'){await recover(read(process.argv[3]));}else if(process.argv[2]==='--worker'){const file=process.argv[3];await run(read(file));}else{let text='';for await(const chunk of process.stdin){text+=chunk;if(Buffer.byteLength(text)>8*1048576)throw fail('INVALID_INPUT','维护输入过大。');}const input=JSON.parse(text);process.stdout.write(JSON.stringify(input.action==='query'?query(input):launch(input)));}})().catch(e=>{process.stderr.write(JSON.stringify({code:e.code||'MAINTENANCE_ERROR',message:'维护未完成，查询原操作。'}));process.exitCode=1;});}
module.exports={launch,run,recover,query,version,digest,opts,waitStopped};
