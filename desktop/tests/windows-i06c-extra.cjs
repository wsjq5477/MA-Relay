// Explicitly authorized real native/file/recovery acceptance in the owned test profile.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{randomUUID,createHash}=require('node:crypto');
const {SshManager}=require('../electron/ssh-host.cjs'),{remoteExec,quote}=require('../electron/ssh-install.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms)),hash=s=>createHash('sha256').update(s).digest('hex').slice(0,16),terminal=s=>['succeeded','failed','cancelled'].includes(s);
module.exports=async function extra(x){
 const {call,member,leader,profile,connection,credentials,report,save,phase}=x;report.extra={status:'running',permissions:[],faults:[]};save();
 const directory=path.join(profile,'verification-only');fs.mkdirSync(directory,{recursive:true});fs.copyFileSync(path.join(profile,'ssh-known-hosts.json'),path.join(directory,'ssh-known-hosts.json'));
 const m=new SshManager({directory,coordinatorId:randomUUID(),packageDirectory:path.resolve(__dirname,'../.linux-package')});
 let ssh,node,root;
 async function run(code){return JSON.parse(await remoteExec(ssh,quote(node)+' -',code,{timeoutMs:60000}));}
 async function approve(task,machineId){if(!task.waiting)return;const pending=await call('ipc',{op:'pending',machineId,taskId:task.taskId});
   if(pending.forms?.length)throw Object.assign(Error('Unanticipated native form'),{code:'NATIVE_FORM_REQUIRES_INPUT'});
   for(const p of pending.permissions||[]){const operationId=randomUUID();const receipt=await call('ipc',{op:'reply',machineId,taskId:task.taskId,reply:{action:'permission',taskId:task.taskId,executionId:task.executionId,operationId,requestId:p.id,decision:'once'}});assert(['confirmed','unknown'].includes(receipt.state));report.extra.permissions.push({operationRef:hash(operationId),state:receipt.state,decision:'once'});save();}
 }
 async function wait(task,machineId){const end=Date.now()+360000;let value;while(Date.now()<end){value=await call('ipc',{op:'task',machineId,taskId:task.taskId});if(terminal(value.status)||value.status==='unknown')return value;await approve(value,machineId);await delay(700);}throw Object.assign(Error('Original task remains active'),{code:'NATIVE_PENDING'});}
 try{
  const draft=await m.call('machine.createSshDraft',{name:'6C verification SSH',host:connection.host,port:connection.port,username:connection.username,authKind:connection.authKind,keyPath:connection.keyPath});
  if(connection.authKind!=='agent')await m.call('credential.provide',{connectionId:draft.connectionId,secret:(await credentials.read(connection))||'',save:false});
  ssh=await m.authenticate(m.find(draft));
  const owned=JSON.parse(fs.readFileSync(path.join(profile,'ssh-connections.json'))),row=owned.lifecycleOperations.findLast(r=>r.remoteInput?.controller);node=path.posix.join(row.controller,'runtime/node');root='/tmp/ab-i06c-files-'+randomUUID().slice(0,8);
  await require('./windows-i06c-wire-faults.cjs')({ssh,node,row,report,save,phase});
  async function schedule(mode){const template=fs.readFileSync(path.resolve(__dirname,'../../.agentbridge-dev/i06c-resource-program.cjs'),'utf8');const versionPath=path.posix.join(row.remoteInput.installPath,'versions',row.remoteInput.target.version);const result=await run(template.replace('__STATE_ROOT__',JSON.stringify(row.remoteInput.stateDirectory)).replace('__VERSION_ROOT__',JSON.stringify(versionPath)).replace('__RESOURCE_MODE__',JSON.stringify(mode)));assert(!result.code);report.extra.resourceScheduling??=[];report.extra.resourceScheduling.push(result);save();}
  await schedule('files');
  phase('real-isolated-file-and-ssh-central-recovery');
  const baseline=await run(`const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');const root=${JSON.stringify(root)};fs.mkdirSync(root,{mode:0o700});fs.writeFileSync(path.join(root,'calc.js'),'module.exports=(a,b)=>a-b;\\n');fs.writeFileSync(path.join(root,'test.js'),"require('assert').equal(require('./calc')(2,3),5);console.log('PASS');\\n");const files=['.config/opencode/opencode.json','.config/opencode/opencode.jsonc','.claude/settings.json','.codex/config.toml'];process.stdout.write(JSON.stringify({calcHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'calc.js'))).digest('hex'),configs:files.map(f=>{const p=path.join(os.homedir(),f);return {label:f,sha:fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null};})}));`);
  const requestId=randomUUID(),accepted=await call('nodeRequest',{op:'submit',nodeId:member.nodeId,requestId,workspace:root,message:'这是获准的隔离示例目录。请先执行 sleep 12，再将 calc.js 中错误的减法改为加法，执行 node test.js 验证。只操作当前目录这两个文件，不更改任何全局配置。最后报告测试结果。'});
  const end=Date.now()+90000;let started;
  do{started=await call('ipc',{op:'task',machineId:member.machineId,taskId:accepted.taskId});await approve(started,member.machineId);if(terminal(started.status))break;if(started.events?.some(e=>JSON.stringify(e.event).includes('sleep')))break;await delay(500);}while(Date.now()<end);
  assert(!terminal(started.status),'Native file task ended before fault injection');
  const before=(await call('snapshot')).tasks.length;
  await call('machine.disconnect',{machineId:member.machineId,operationId:randomUUID()});await delay(2500);
  await x.restartCoordinator();
  const recovered=await wait(accepted,member.machineId);assert.equal(recovered.status,'succeeded');
  const original=await call('ipc',{op:'request',machineId:member.machineId,requestId});assert.equal(original.taskId,accepted.taskId);assert.equal(recovered.native?.sessionId,started.native?.sessionId);assert.equal((await call('snapshot')).tasks.length,before);
  report.extra.faults.push({ids:['F03','F06'],status:'passed',taskRef:hash(accepted.taskId),sessionRef:hash(recovered.native.sessionId),newPromptsDuringRecovery:0,observation:'Explicit SSH disconnect and real isolated Coordinator shutdown/restart; same original task and native Session'});
  const checked=await run(`const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),crypto=require('crypto');const root=${JSON.stringify(root)};const result=cp.spawnSync(${JSON.stringify(node)},['test.js'],{cwd:root,encoding:'utf8'});process.stdout.write(JSON.stringify({exit:result.status,passed:result.stdout.trim()==='PASS',fixed:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'calc.js'))).digest('hex')!==${JSON.stringify(baseline.calcHash)},configs:${JSON.stringify(baseline.configs)}.map(f=>{const p=path.join(os.homedir(),f.label);return {label:f.label,sha:fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null};})}));`);
  assert.equal(checked.exit,0);assert(checked.passed&&checked.fixed);assert.deepEqual(checked.configs,baseline.configs);report.extra.file={status:'passed',realNativeEdit:true,independentTestExit:0,configHashesUnchanged:true};save();
  phase('real-windows-native-cancel-original-receipt');
  const localWorkspace=path.join(profile,'cancel-fixture');fs.mkdirSync(localWorkspace,{recursive:true});
  const cancellable=await call('nodeRequest',{op:'submit',nodeId:leader.nodeId,workspace:localWorkspace,requestId:randomUUID(),message:'请使用 Bash 执行 sleep 30。结束后只回复 AB_CANCEL_WAIT_DONE。不要读写任何文件或执行其他命令。'});
  let active;const until=Date.now()+90000;do{active=await call('ipc',{op:'task',machineId:leader.machineId,taskId:cancellable.taskId});await approve(active,leader.machineId);assert(!terminal(active.status),'Native wait ended before cancel');if(active.events?.some(e=>/Bash|sleep/.test(JSON.stringify(e.event))))break;await delay(500);}while(Date.now()<until);
  const operationId=randomUUID();await call('ipc',{op:'cancel',machineId:leader.machineId,taskId:cancellable.taskId,operationId});
  // Discard the received ACK, then verify only the ORIGINAL native operation.
  const native=await wait(cancellable,leader.machineId),receipt=await call('ipc',{op:'operation',machineId:leader.machineId,taskId:cancellable.taskId,operationId});
  assert.equal(receipt.state,'confirmed');assert.equal(native.status,'cancelled');assert.equal(receipt.data?.nativeExited,true);
  report.extra.cancel={status:'passed',operationRef:hash(operationId),taskRef:hash(cancellable.taskId),controlSends:1,originalReceiptState:receipt.state,nativeStatus:native.status,nativeExited:true,ackDiscardLayer:'test client after receiving; daemon wire loss remains controlled-test evidence'};
  await run(`const fs=require('fs');const root=${JSON.stringify(root)};if(!root.startsWith('/tmp/ab-i06c-files-'))throw Error('scope');fs.rmSync(root,{recursive:true});process.stdout.write('{}');`);report.extra.isolatedFilesCleaned=true;
  await schedule('direct');
  await require('./windows-i06c-normal-window.cjs')({...x,closeInstrumented:x.closeInstrumented});
  report.extra.status='passed';save();
 }finally{m.close();}
};
