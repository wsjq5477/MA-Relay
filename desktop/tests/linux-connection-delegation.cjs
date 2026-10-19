// Opt-in real-native MCP acceptance. Import/default --plan starts nothing.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const {original,taskReceipt,transient}=require('./linux-connection-native.cjs');
const root=path.resolve(__dirname,'../..'),adapters=['claude','codex','opencode'];
const hash=x=>createHash('sha256').update(x).digest('hex');
const ref=x=>hash(x).slice(0,16);
const fault=code=>Object.assign(new Error('Original real delegation acceptance requires review.'),{code});
const terminal=t=>['succeeded','failed','cancelled'].includes(t?.status);
const plan={status:'plan',realModelStarted:false,leaders:adapters,
  topology:'Production Coordinator, AgentNetwork, MachineHost, native CLI/HTTP, stdio MCP and production broker on one WSL host; no fake dispatcher.',
  scenario:'One real main Agent discovers the other two installed native tools, delegates one ordinary task to each, reads actual results and summarizes.',
  limits:'Three original native tasks per leader; no permission approval, model override, automatic retry or cancellation.',
  recovery:'Prepared parent/setup intents only query original receipts. Existing --run observes; --continue may complete unprepared setup only. No replacement IDs.',
  untested:['Windows EXE','Independent SSH','Hermes/Pi/DSH native tools','Permissions/forms','Mid-flight network fault injection']};
function write(file,data){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.'+randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(data,null,2)+'\n',{mode:0o600});fs.renameSync(temp,file);}
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function lock(file){
  try{const pid=read(file).pid;try{process.kill(pid,0);throw fault('PROBE_ALREADY_RUNNING');}catch(e){if(e.code!=='ESRCH')throw e;}fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}
  fs.writeFileSync(file,JSON.stringify({pid:process.pid}),{flag:'wx',mode:0o600});
  return ()=>{if(read(file).pid===process.pid)fs.unlinkSync(file);};
}
async function setupOnce(cp,key,method,params,save,call,allowNew){
  const prior=cp.setup[key],fingerprint=hash(JSON.stringify({method,params}));
  if(prior&&prior.fingerprint!==fingerprint)throw fault('PROBE_SETUP_CHANGED');
  let receipt;
  if(prior)receipt=await call(method==='saveCollaboration'?'collaborationOperation':'nodeOperation',{operationId:params.operationId});
  else{if(!allowNew)throw fault('PROBE_OBSERVATION_ONLY');cp.setup[key]={method,params,fingerprint};save();receipt=await call(method,params);}
  if(receipt?.operationId!==params.operationId)throw fault('PROBE_SETUP_RECEIPT');
  if(receipt.state!=='confirmed')throw fault('PROBE_ORIGINAL_PENDING');
  return receipt.data;
}
function expected(cp,adapter){return cp.token+' '+adapter+' '+String(cp.inputs[0]*cp.inputs[1]);}
function childPrompt(cp,adapter){return '这是普通委派连接验收。不要使用任何工具，不读写文件，不调用其他Agent。计算 '+cp.inputs[0]+' 乘 '+cp.inputs[1]+'，只输出一行：'+cp.token+' '+adapter+' 后接计算结果，三项用单个空格分隔。';}
function parentPrompt(cp){
  return '这是AgentBridge真实通路验收。仅使用agentbridge MCP的list_agents、delegate、task_result，不用任何原生终端/文件/浏览器/内部子Agent工具，不批准权限。先list_agents取得允许子节点，以adapter字段识别目标。对以下每个目标各调用一次delegate，严格转交给出的message和requestId；不传workspace。然后task_result等待并读取每个真实succeeded结果，最终回答原样列出两行子结果。若出错/unknown不得换ID或重发需求，报告原状态。\n'+cp.children.map(adapter=>JSON.stringify({adapter,requestId:'ct02-live-'+adapter,message:childPrompt(cp,adapter)})).join('\n');
}
function publicTask(task){return {status:task.status,taskRef:ref(task.taskId),requestRef:ref(task.requestId),sessionRef:task.native?.sessionId?ref(task.native.sessionId):null,answerSha256:hash(task.result?.message||''),answerLength:(task.result?.message||'').length,errorCode:task.error?.code};}
function auditedResult(name,args,value,network){
  const target=args.nodeId&&network.network.nodes.find(n=>n.nodeId===args.nodeId);
  return {name,...(target?{adapter:target.adapter}:{}),...(args.taskId?{taskRef:ref(args.taskId)}:{}),
    ...(value?.taskId?{resultTaskRef:ref(value.taskId)}:{}),...(value?.status?{status:value.status}:{}),
    ...(name==='list_agents'?{adapters:value.items.map(x=>x.adapter).sort(),capabilitiesPresent:value.items.every(x=>x.connectionCapabilities&&x.capabilitySource?.kind==='static-adapter')}: {})};
}
function open(directory){
  const {AgentNetwork}=require('../electron/agent-network.cjs'),{MachineHost}=require('../electron/machine-host.cjs');
  const {ClaudeHost}=require('../electron/claude-host.cjs'),{HostConnection}=require('../electron/rpc.cjs');
  const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
  const network=new AgentNetwork({directory,platform:'linux',distributions:async()=>[],createHost:()=>new MachineHost({directory:path.join(directory,'machine'),home:os.homedir(),legacy:new ClaudeHost({directory:path.join(directory,'legacy'),home:os.homedir()}),openCode:context=>new HostConnection(path.join(root,'dist/desktop-host.js'),{directory:context,native:true,leaf:true})})});
  const dispatch=network.collaborationTool.bind(network),file=path.join(directory,'mcp-observations.jsonl');
  network.collaborationTool=async(scope,name,args,callId,source)=>{
    try{const result=await dispatch(scope,name,args,callId,source);fs.appendFileSync(file,JSON.stringify(auditedResult(name,args,result,network))+'\n',{mode:0o600});return result;}
    catch(error){fs.appendFileSync(file,JSON.stringify({name,errorCode:error.code||'MCP_ERROR'})+'\n',{mode:0o600});throw error;}
  };
  const service=createCoordinatorService({directory,network,version:require('../package.json').version});
  return {network,call:async(method,params={})=>{const r=await service.call({method,params});if(!r.ok)throw fault(r.error.code);return r.result;},close(){service.close();}};
}
function audit(directory){const file=path.join(directory,'mcp-observations.jsonl');return fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(JSON.parse):[];}
function validateDelegations(cp,parent,delegations){
  const own=delegations.filter(d=>d.parentRequestId===parent.requestId);
  if(own.length!==cp.children.length||new Set(own.map(d=>d.memberId)).size!==cp.children.length)throw fault('PROBE_DELEGATION_COUNT');
  for(const adapter of cp.children){
    const row=own.find(d=>d.memberId===cp.nodes[adapter].nodeId);
    const requestId='delegation-'+hash(cp.nodes[cp.leader].nodeId+':'+parent.conversationId+':ct02-live-'+adapter).slice(0,40);
    if(!row||row.requestId!==requestId||row.message!==childPrompt(cp,adapter)||row.parentTaskId!==parent.taskId||row.parentConversationId!==parent.conversationId||row.leaderId!==cp.nodes[cp.leader].nodeId)throw fault('PROBE_DELEGATION_IDENTITY');
  }
  return own;
}
async function inspect(current,cp,parent,directory,report){
  const {network,call}=current,rows=validateDelegations(cp,parent,network.network.delegations),events=audit(directory);
  const listed=events.filter(x=>x.name==='list_agents'&&!x.errorCode);assert(listed.length>0);
  assert(listed.every(x=>x.capabilitiesPresent&&JSON.stringify(x.adapters)===JSON.stringify([...cp.children].sort())));
  report.tools=Object.fromEntries(['list_agents','delegate','task_result'].map(name=>[name,events.filter(x=>x.name===name).length]));
  report.children=[];
  for(const adapter of cp.children){
    const d=rows.find(x=>x.memberId===cp.nodes[adapter].nodeId),node=cp.nodes[adapter];
    const task=taskReceipt(await call('ipc',{op:'request',machineId:node.machineId,requestId:d.requestId}),{requestId:d.requestId,machineId:node.machineId},d);
    if(!terminal(task)||task.status==='unknown')throw fault('PROBE_ORIGINAL_PENDING');
    assert.equal(task.status,'succeeded');assert(task.native?.sessionId);assert(task.result?.message?.includes(expected(cp,adapter)));
    const owner=network.catalog.instances.find(i=>i.instanceId===task.targetAgent);assert.equal(owner?.nodeId,node.nodeId);
    const request=network.network.requests.find(r=>r.requestId===d.requestId);assert.equal(request.collaboration,false);assert.equal(request.dispatched,true);
    assert(events.some(x=>x.name==='task_result'&&x.taskRef===ref(task.taskId)&&x.status==='succeeded'));
    assert(events.some(x=>x.name==='delegate'&&x.adapter===adapter&&x.resultTaskRef===ref(task.taskId)));
    assert(parent.result?.message?.includes(expected(cp,adapter)));
    report.children.push({adapter,...publicTask(task)});
  }
  assert(events.every(x=>['list_agents','delegate','task_result'].includes(x.name)&&!x.errorCode));
  assert.equal(new Set([ref(parent.native.sessionId),...report.children.map(x=>x.sessionRef)]).size,3);
  report.checks.push('Real main Agent discovered only its two authorized child adapters and their capability projection through production MCP.',
    'Each ordinary delegated task retained exact parent/child/machine/request ownership and collaboration:false.',
    'Both real native children answered successfully; the real main Agent read their successful results through task_result and summarized actual replies.');
}
async function run(mode,leader){
  if(process.platform!=='linux'||!adapters.includes(leader)||!['--run','--observe','--continue'].includes(mode))throw fault('PROBE_ARGUMENTS');
  const directory=path.join(root,'.agentbridge-dev/connection-delegation-ct02',leader),file=path.join(directory,'checkpoint.json');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});const existed=fs.existsSync(file);
  if(mode==='--continue'&&!existed)throw fault('PROBE_NO_ORIGINAL');
  const allowNew=mode==='--continue'||mode==='--run'&&!existed,unlock=allowNew?lock(path.join(directory,'advance.lock')):()=>{};
  const output=path.join(root,'artifacts/connection-delegation/2026-10-19',new Date().toISOString().replaceAll(':','-')+'-'+leader+'.json');
  const report={date:new Date().toISOString(),leader,status:'running',observeOnly:!allowNew,topology:plan.topology,checks:[],untested:plan.untested,privateStateRetained:true};let current;
  try{
    if(!existed&&!allowNew)throw fault('PROBE_NO_ORIGINAL');
    const cp=existed?read(file):{schema:1,leader,children:adapters.filter(x=>x!==leader),token:'CT02_'+randomUUID().replaceAll('-',''),inputs:[13,17],nodes:{},setup:{},intents:{}};
    assert.equal(cp.schema,1);assert.equal(cp.leader,leader);const save=()=>write(file,cp);
    current=open(directory);const {call,network}=current,snapshot=await call('snapshot');report.tasksBefore=snapshot.tasks.length;
    if(!cp.intents.parent){
      for(const adapter of adapters){const node=snapshot.nodes.find(x=>x.adapter===adapter&&!x.supersededBy&&x.healthy&&x.executionSupported);if(!node)throw fault('PROBE_NATIVE_UNAVAILABLE');
        if(cp.nodes[adapter]&&(cp.nodes[adapter].nodeId!==node.nodeId||cp.nodes[adapter].executable!==node.executable))throw fault('PROBE_INSTALLATION_CHANGED');
        if(!cp.nodes[adapter]){if(!allowNew)throw fault('PROBE_OBSERVATION_ONLY');cp.nodes[adapter]=node;save();}
        const params=cp.setup['attach-'+adapter]?.params||{operationId:randomUUID(),nodeId:node.nodeId,action:'attach'};
        await setupOnce(cp,'attach-'+adapter,'manageNode',params,save,call,allowNew);
      }
      const params=cp.setup.relation?.params||{operationId:randomUUID(),leaderId:cp.nodes[leader].nodeId,memberIds:cp.children.map(x=>cp.nodes[x].nodeId),expectedRevision:snapshot.collaboration.revision};
      await setupOnce(cp,'relation','saveCollaboration',params,save,call,allowNew);
    }
    report.versions=Object.fromEntries(adapters.map(x=>[x,cp.nodes[x].version]));
    const node=cp.nodes[leader],params=cp.intents.parent?.params||{op:'submit',nodeId:node.nodeId,machineId:node.machineId,requestId:randomUUID(),collaboration:true,message:parentPrompt(cp)};
    let parent=await original(cp,'parent',params,save,p=>call('ipc',{op:'request',machineId:node.machineId,requestId:p.requestId}),p=>call('nodeRequest',p),allowNew);
    const deadline=Date.now()+300000;
    while(!terminal(parent)&&Date.now()<deadline){if(parent.status==='unknown'||parent.waiting)throw fault('PROBE_ORIGINAL_PENDING');await new Promise(r=>setTimeout(r,700));parent=taskReceipt(await call('ipc',{op:'request',machineId:node.machineId,requestId:params.requestId}),params,cp.intents.parent);}
    report.parent=publicTask(parent);if(!terminal(parent))throw fault('PROBE_ORIGINAL_PENDING');assert.equal(parent.status,'succeeded');assert(parent.native?.sessionId);
    await inspect(current,cp,parent,directory,report);
    current.close();current=open(directory);
    const recovered=taskReceipt(await current.call('ipc',{op:'request',machineId:node.machineId,requestId:params.requestId}),params,cp.intents.parent);
    assert.equal(recovered.native?.sessionId,parent.native.sessionId);assert.equal(recovered.result?.message,parent.result.message);
    report.tasksAfter=(await current.call('snapshot')).tasks.length;assert.equal(report.tasksAfter,3);if(!allowNew)assert.equal(report.tasksBefore,report.tasksAfter);
    assert.equal(current.network.network.delegations.length,2);report.checks.push('Complete observer reopen read original parent/result and retained exactly three Tasks/two delegations, with no replay.');
    cp.completed=true;save();report.status='passed';
  }catch(error){report.status=transient(error.code)||['PROBE_ORIGINAL_PENDING','PROBE_OBSERVATION_ONLY'].includes(error.code)?'pending':'failed';report.error={code:/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'PROBE_ASSERTION'};if(report.status==='failed')process.exitCode=1;}
  finally{current?.close();unlock();write(output,report);console.log(JSON.stringify({status:report.status,leader,checks:report.checks.length,error:report.error,output}));}
  return report;
}
module.exports={plan,setupOnce,childPrompt,parentPrompt,expected,validateDelegations,auditedResult,run};
if(require.main===module){const [mode='--plan',leader]=process.argv.slice(2);if(mode==='--plan')console.log(JSON.stringify(plan,null,2));else run(mode,leader).catch(e=>{console.error(e.code||'PROBE_FAILURE');process.exitCode=1;});}
