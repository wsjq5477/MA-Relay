// Real Claude developer (two manually started native rounds), independent MCP
// compiler connector running actual Node --check, and MCP leader acceptance.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {AgentNetwork}=require('../electron/agent-network.cjs'),{MachineHost}=require('../electron/machine-host.cjs');
const {ClaudeHost}=require('../electron/claude-host.cjs'),{HostConnection}=require('../electron/rpc.cjs');
const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
if(process.platform!=='linux')throw Error('Linux required');
const root=path.resolve(__dirname,'../..'),profile=path.join(root,'.agentbridge-dev','i07b-native-'+(process.env.AGENTBRIDGE_I07_PROBE_ID||'first'));
const output=path.join(root,'artifacts/I07B/2026-10-16/native.json');fs.mkdirSync(profile,{recursive:true});
const network=new AgentNetwork({directory:profile,platform:'linux',distributions:async()=>[],createHost:()=>new MachineHost({directory:path.join(profile,'native'),home:os.homedir(),legacy:new ClaudeHost({directory:path.join(profile,'native','legacy')}),openCode:directory=>new HostConnection(path.join(root,'dist/desktop-host.js'),{directory,native:true,leaf:true})})});
const service=createCoordinatorService({directory:profile,network,version:require('../package.json').version});
const report={date:new Date().toISOString(),version:require('../package.json').version,environment:'WSL Linux; real installed Claude developer / controlled independent MCP compiler connector with real Node syntax check / MCP leader; native configuration inherited',status:'running',checks:[],nativeRequests:'two distinct manual rounds; existing intents queried only',automaticActivation:false,compilations:[]};
const call=async(method,params={})=>{const r=await service.call({method,params});if(!r.ok)throw Object.assign(Error(r.error.message),{code:r.error.code});return r.result;};
async function user(name,p) {const old=await call('team.operation',{operationId:p.operationId});return old.state==='confirmed'?old.data:call('team.'+name,p);}
function connection(config){
 return async(name,args={})=>{
  const descriptor=JSON.parse(fs.readFileSync(config.args[1],'utf8'));
  const send=async(name,args)=>{const response=await fetch(descriptor.url,{method:'POST',headers:{authorization:'Bearer '+descriptor.token,'content-type':'application/json'},body:JSON.stringify({name:'team_'+name,args})});const r=await response.json();if(r.error)throw Object.assign(Error(r.error.message),{code:r.error.code});return r.result;};
  if(args.operationId&&name!=='operation'){const old=await send('operation',{operationId:args.operationId});if(old.state==='confirmed')return old.data;}
  return send(name,args);
 };
}
(async()=>{
 const snapshot=await network.snapshot(),node=snapshot.nodes.find(n=>n.adapter==='claude'&&n.executionSupported&&n.healthy);assert(node,'Installed Claude unavailable');if(!node.connected)await network.call('attachNode',{nodeId:node.nodeId});
 const a=await user('registerAgent',{operationId:'a',kind:'native',nodeId:node.nodeId,name:'真实开发员',purpose:'交付版本化代码到共享文档'});
 const b=await user('registerAgent',{operationId:'b',kind:'mcp',externalKey:'independent-node-compiler',name:'独立编译连接器',purpose:'取得精确文档版本后执行Node语法检查'});
 const leader=await user('registerAgent',{operationId:'leader',kind:'mcp',externalKey:'controlled-leader',name:'验收协调员',purpose:'查看关键报告并验收当前版本'});
 const team=await user('createTeam',{operationId:'team',name:'真实返修验证队',leaderId:leader.agentId,memberIds:[leader.agentId,a.agentId,b.agentId],charter:'测试限定在共享文档；编译器只检查精确版本；不修改业务仓库、不扩大权限。'});
 const run=await user('createRun',{operationId:'run',teamId:team.teamId,name:'X失败到Y通过',goal:'两轮真实开发报告与独立实际编译',acceptance:'X失败记录保留、Y编译通过，逐项验收'});
 const d=await user('createTask',{operationId:'development',runId:run.runId,kind:'delivery',title:'交付测试代码',description:'在共享文档交付指定版本的测试代码',ownerId:a.agentId});
 const v=await user('createTask',{operationId:'verification',runId:run.runId,kind:'verification',sourceTaskId:d.workItemId,title:'编译测试代码',description:'读取准确文档版本并执行node --check',ownerId:b.agentId});
 await user('configureHandoff',{operationId:'repair-grant',runId:run.runId,workItemId:v.workItemId,toTaskId:d.workItemId,maxUses:2,enabled:true,expectedRevision:0});
 const bc=await user('connect',{operationId:'b-connect',runId:run.runId,agentId:b.agentId}),lc=await user('connect',{operationId:'l-connect',runId:run.runId,agentId:leader.agentId});
 const compiler=connection(bc.configuration),coordinator=connection(lc.configuration);
 const item=async id=>(await call('team.tasks',{runId:run.runId})).workItems.find(x=>x.workItemId===id);
 for(const version of ['X','Y']){
  const old=await call('team.operation',{operationId:'native-'+version});
  if(old.state!=='confirmed'){
   const source=version==='X'?'module.exports = (a, b => a + b;':'module.exports = (a, b) => a + b;';
   await call('team.execute',{operationId:'native-'+version,runId:run.runId,agentId:a.agentId,workItemId:d.workItemId,expectedRevision:(await item(d.workItemId)).revision,message:`这是协作通道验收夹具，不是业务代码。只使用小队MCP工具，不使用终端或本地文件工具。先读 team_context 和 team_tasks。创建共享文档，标题 source-${version}，content必须逐字为以下单行：${source}。${version==='X'?'X刻意含语法错误，请严格照写，用于验证报错返修。':'Y修复X的语法错误。'} 然后使用 team_report_task 为你当前正在进行的交付任务提交 outcome=submitted，version=${version}，reference必须为 team-document:<刚创建的documentId>:1，summary说明版本和是否仍待编译。报告expectedRevision使用任务板当前值，operationId固定为native-report-${version}。不要自行验收，不交接、不调用队友。完成后简短汇报。`});
  }
  let view;const until=Date.now()+150000;
  do{view=await call('team.refresh',{runId:run.runId});const a=view.attempts.find(x=>x.attemptId===(old.data?.attemptId||view.attempts.at(-1).attemptId));if(['succeeded','failed','cancelled','rejected'].includes(a?.state)){assert.equal(a.state,'succeeded','Original native round not successful; query only');break;}await new Promise(r=>setTimeout(r,1000));}while(Date.now()<until);
  assert(view.attempts.some(x=>x.workRound===(version==='X'?1:2)&&x.state==='succeeded'),'Original native remains nonterminal; do not reissue');
  const delivered=await item(d.workItemId),artifact=delivered.reports.find(r=>r.artifact?.version===version)?.artifact;assert(artifact,'Native member did not report the exact artifact');
  const match=/^team-document:([^:]+):(\d+)$/.exec(artifact.reference);assert(match,'Native artifact reference not versioned');
  const document=await compiler('document',{documentId:match[1]}),content=document.history.find(x=>x.revision===Number(match[2]))?.content;assert.equal(typeof content,'string');
  const file=path.join(profile,'syntax-'+version+'.cjs');fs.writeFileSync(file,content);
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8',timeout:15000});assert.equal(result.status,version==='X'?1:0);report.compilations.push({version,command:'node --check <isolated fixture>',exitCode:result.status,syntaxError:/SyntaxError/.test(result.stderr)});
  const evidence=await compiler('update_document',{operationId:'evidence-'+version,expectedRevision:0,title:'Compilation '+version,content:JSON.stringify({version,exitCode:result.status,syntaxError:/SyntaxError/.test(result.stderr),sourceVersion:match[2]})});
  await compiler('claim_task',{operationId:'claim-'+version,workItemId:v.workItemId,expectedRevision:(await item(v.workItemId)).revision});
  await compiler('report_task',{operationId:'report-'+version,workItemId:v.workItemId,expectedRevision:(await item(v.workItemId)).revision,outcome:version==='X'?'failed':'passed',summary:version==='X'?'实际Node语法检查失败，请开发员返修。':'实际Node语法检查成功。',artifactId:artifact.artifactId,accessConfirmed:true,evidenceReference:'team-document:'+evidence.documentId+':1',...(version==='X'?{handoffTaskId:d.workItemId,targetRevision:(await item(d.workItemId)).revision}:{})});
 }
 for(const id of [v.workItemId,d.workItemId])await coordinator('accept_task',{operationId:'accept-'+id,workItemId:id,expectedRevision:(await item(id)).revision,summary:'复核实际Node退出码及Y产物版本，X失败报告保留。'});
 const board=await coordinator('tasks');assert.equal(board.workItems.every(x=>x.state==='completed'),true);assert.equal(board.workItems.find(x=>x.workItemId===v.workItemId).reports.length,2);
 const context=await coordinator('context');assert(context.messages.filter(m=>m.reportId).every(m=>m.notifyIds.includes(leader.agentId)));
 report.checks.push('Real Claude used member-scoped task/document/report tools in two manually started rounds','Independent MCP compiler retrieved the exact document revision and actually checked syntax: X fails, Y passes','Authorized compiler-to-developer repair committed task round and leader notification atomically','MCP leader saw both version histories and accepted only the verified current artifact');report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code||'ASSERTION',message:e.code?'Original acceptance did not complete; private state retained.':e.message};process.exitCode=1;}).finally(()=>{service.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
