// Manual real-native read acceptance. Default/import starts no host or model.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const {once}=require('./linux-i07c-native-members.cjs');
const {setupOnce}=require('./linux-connection-delegation.cjs');
const root=path.resolve(__dirname,'../..'),directory=path.join(root,'.agentbridge-dev/ct04-materials-native');
const file=path.join(directory,'checkpoint.json');
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=code=>Object.assign(new Error('Retain original public-material acceptance state.'),{code});
const plan={status:'plan',realModelStarted:false,scope:'One actual Claude through production Coordinator/MachineHost and TeamSpace MCP. Read the new short index, then exact revision 1 of a document currently at revision 2.',recovery:'Existing --run observes; --continue requires original checkpoint. Prepared operations only query original receipts; unknown never replays.',untested:['Windows EXE','Independent SSH','Other native tools','File export/synchronization']};
function write(f,x){fs.mkdirSync(path.dirname(f),{recursive:true,mode:0o700});const tmp=f+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(x,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,f);}
function lock(){
  const f=path.join(directory,'advance.lock');
  try{const pid=JSON.parse(fs.readFileSync(f,'utf8')).pid;try{process.kill(pid,0);throw fail('PROBE_ALREADY_RUNNING');}catch(e){if(e.code!=='ESRCH')throw e;}fs.unlinkSync(f);}catch(e){if(e.code!=='ENOENT')throw e;}
  fs.writeFileSync(f,JSON.stringify({pid:process.pid}),{flag:'wx',mode:0o600});return ()=>fs.unlinkSync(f);
}
function open(){
  const {AgentNetwork}=require('../electron/agent-network.cjs'),{MachineHost}=require('../electron/machine-host.cjs'),{ClaudeHost}=require('../electron/claude-host.cjs');
  const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
  const network=new AgentNetwork({directory,platform:'linux',distributions:async()=>[],createHost:()=>new MachineHost({directory:path.join(directory,'machine'),home:os.homedir(),legacy:new ClaudeHost({directory:path.join(directory,'legacy'),home:os.homedir()})})});
  const dispatch=network.collaborationTool.bind(network);
  network.collaborationTool=async(...args)=>{const result=await dispatch(...args),name=args[1],p=args[2];fs.appendFileSync(path.join(directory,'read-observations.jsonl'),JSON.stringify({name,...(name==='team_materials'?{documentRevisions:result.documents.items.map(x=>x.revision)}:{}),...(name==='team_document'?{requestedRevision:p.revision,returnedRevision:result.revision,contentSha256:sha(result.content)}:{})})+'\n',{mode:0o600});return result;};
  const service=createCoordinatorService({directory,network,version:require('../package.json').version});
  return {call:async(method,params={})=>{const r=await service.call({method,params});if(!r.ok)throw fail(r.error.code);return r.result;},close(){service.close();}};
}
async function run(mode){
  if(process.platform!=='linux'||!['--run','--observe','--continue'].includes(mode))throw fail('PROBE_MODE');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});const existed=fs.existsSync(file),advance=mode==='--continue'||mode==='--run'&&!existed;
  if(mode==='--continue'&&!existed)throw fail('PROBE_NO_ORIGINAL');
  const unlock=advance?lock():()=>{},output=path.join(root,'artifacts/public-materials/2026-10-19',new Date().toISOString().replaceAll(':','-')+'-native.json');
  const report={date:new Date().toISOString(),status:'running',scope:plan.scope,observeOnly:!advance,checks:[],untested:plan.untested};let current;
  try{
    if(!existed&&!advance)throw fail('PROBE_NO_ORIGINAL');
    const cp=existed?JSON.parse(fs.readFileSync(file,'utf8')):{schema:1,operations:{},oldContent:'CT04_'+randomUUID().replaceAll('-','')};assert.equal(cp.schema,1);
    const save=()=>write(file,cp);current=open();let {call}=current;
    const original=async(method,params)=>{if(!advance&&!cp.operations[params.operationId])throw fail('PROBE_OBSERVATION_ONLY');return once(cp,save,call,method,params);};
    if(!cp.nodeId){const s=await call('snapshot'),n=s.nodes.find(n=>n.adapter==='claude'&&n.healthy&&!n.supersededBy);assert(n);cp.nodeId=n.nodeId;cp.version=n.version;save();}
    report.nativeVersion=cp.version;
    cp.setup=cp.setup||{};
    if(!cp.attached){const params=cp.setup.attach?.params||{operationId:randomUUID(),nodeId:cp.nodeId,action:'attach'};await setupOnce(cp,'attach','manageNode',params,save,call,advance);cp.attached=true;save();}
    const agent=await original('registerAgent',{operationId:'agent',kind:'native',nodeId:cp.nodeId,name:'材料阅读验证员',purpose:'只读公共索引与指定文档修订'});
    const team=await original('createTeam',{operationId:'team',name:'只读材料验证',leaderId:agent.agentId,memberIds:[agent.agentId],charter:'只读材料，不修改文档、任务或权限，不用终端/文件工具。'});
    const run=await original('createRun',{operationId:'run',teamId:team.teamId,name:'索引与固定修订',goal:'读取正确的旧修订而非当前正文',acceptance:'实际MCP读索引和revision 1；原生回答匹配旧正文'});
    const doc=await original('writeDocument',{operationId:'doc-one',runId:run.runId,title:'修订验证文档',content:cp.oldContent,expectedRevision:0});
    await original('writeDocument',{operationId:'doc-two',runId:run.runId,documentId:doc.documentId,title:'修订验证文档',content:'CURRENT_REVISION_TWO',expectedRevision:1});
    await original('execute',{operationId:'original-native-read',runId:run.runId,agentId:agent.agentId,message:'只读验收。请先调用 team_materials 阅读公共材料索引，找到“修订验证文档”（当前第2版）；再调用 team_document，使用对应documentId并明确revision为1。最后只原样输出第1版正文，不加解释。不要使用终端/文件/浏览器，不修改材料、消息、任务或权限。'});
    const deadline=Date.now()+150000;let context;
    do{context=await call('team.refresh',{runId:run.runId});if(['succeeded','failed','cancelled','rejected'].includes(context.attempts[0]?.state))break;if(context.attempts[0]?.state==='unknown'||context.attempts[0]?.waiting)throw fail('PROBE_ORIGINAL_PENDING');await new Promise(r=>setTimeout(r,700));}while(Date.now()<deadline);
    assert.equal(context.attempts.length,1);if(!['succeeded','failed','cancelled','rejected'].includes(context.attempts[0]?.state))throw fail('PROBE_ORIGINAL_PENDING');
    assert.equal(context.attempts[0].state,'succeeded');assert(context.attempts[0].result?.includes(cp.oldContent));
    const observations=fs.readFileSync(path.join(directory,'read-observations.jsonl'),'utf8').split('\n').filter(Boolean).map(JSON.parse);
    assert(observations.some(x=>x.name==='team_materials'&&x.documentRevisions.includes(2)));
    assert(observations.some(x=>x.name==='team_document'&&x.requestedRevision===1&&x.returnedRevision===1&&x.contentSha256===sha(cp.oldContent)));
    assert(observations.every(x=>['team_context','team_materials','team_document','team_tasks','team_messages'].includes(x.name)));
    current.close();current=open();call=current.call;
    const recovered=await call('team.refresh',{runId:run.runId});assert.equal(recovered.attempts.length,1);assert.equal(recovered.attempts[0].result,context.attempts[0].result);
    report.nativeTasks=1;report.state=recovered.attempts[0].state;report.calls=observations.map(x=>x.name);report.answerSha256=sha(cp.oldContent);report.currentDocumentRevision=recovered.documents[0].revision;
    report.checks=['Actual native Agent read the new bounded material index through production MCP.','Actual native Agent requested and received exact revision 1 while current revision remained 2.','Original native answer matched the old body; complete observer reopen retained one Task without replay.'];
    report.status='passed';cp.completed=true;save();
  }catch(e){report.status=/PENDING|OBSERVATION|UNRESOLVED/.test(e.code||'')?'pending':'failed';report.error={code:e.code||'PROBE_ASSERTION'};if(report.status==='failed')process.exitCode=1;}
  finally{current?.close();unlock();write(output,report);console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error,output}));}
}
module.exports={plan,run};
if(require.main===module){const mode=process.argv[2]||'--plan';if(mode==='--plan')console.log(JSON.stringify(plan,null,2));else run(mode).catch(e=>{console.error(e.code||'PROBE_FAILURE');process.exitCode=1;});}
