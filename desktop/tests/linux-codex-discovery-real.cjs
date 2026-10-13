// Manual integration: real native Codex and Claude; isolated, controlled relation.
// Inherits native accounts/models. Does not modify the production network.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {CodexHost}=require('../electron/codex-host.cjs'),{ClaudeHost}=require('../electron/claude-host.cjs'),{CollaborationBroker}=require('../electron/collaboration-broker.cjs');
const terminal=new Set(['succeeded','failed','cancelled']),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-codex-discovery-real-'));
fs.chmodSync(directory,0o700);
const output=path.resolve(__dirname,'../../artifacts/codex-discovery/2026-10-12/native-report.json');
const codex=new CodexHost({directory:path.join(directory,'codex'),executable:process.env.AGENTBRIDGE_CODEX_CLI||'codex'});
const claude=new ClaudeHost({directory:path.join(directory,'claude'),candidates:[process.env.AGENTBRIDGE_CLAUDE_CLI||path.join(os.homedir(),'.local/bin/claude')]});
const calls=[],delegations=new Map();let childAgent,parent;
const report={date:new Date().toISOString(),version:require('../package.json').version,environment:{platform:process.platform,node:process.version},evidence:'real native Codex and Claude, controlled isolated allowed relation and broker dispatcher; not GUI or cross-device acceptance',status:'running',checks:{}};
function save(){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
const broker=new CollaborationBroker(path.join(directory,'broker'),async(scope,name,args)=>{
 calls.push(name);assert.equal(scope.nodeId,'test-leader');assert.equal(scope.parentRequestId,'natural-discovery');
 if(name==='list_agents')return {items:[{nodeId:'test-child',name:'Claude Code',adapter:'claude',machine:'WSL Ubuntu',status:'connected',busy:false,executionSupported:true}]};
 if(name==='delegate'){
  assert.equal(args.nodeId,'test-child');assert(args.requestId);
  const old=delegations.get(args.requestId);
  if(old){assert.equal(old.message,args.message);return old.task;}
  const task=await claude.call('ipc',{op:'submit',agentId:childAgent.agentId,requestId:args.requestId,message:args.message});
  delegations.set(args.requestId,{message:args.message,task});return task;
 }
 if(name==='task_result'){
  assert([...delegations.values()].some(d=>d.task.taskId===args.taskId));
  const end=Date.now()+Math.min(args.waitMs||0,45000);let task;
  do{task=await claude.call('ipc',{op:'task',taskId:args.taskId});if(terminal.has(task.status)||task.status==='unknown')break;await sleep(200);}while(Date.now()<end);
  return task;
 }
 throw new Error('Unexpected integration operation: '+name);
});
(async()=>{
 fs.mkdirSync(path.join(directory,'workspace'),{recursive:true});
 const executable=process.env.AGENTBRIDGE_CLAUDE_CLI||path.join(os.homedir(),'.local/bin/claude');
 childAgent=await claude.call('connect',{workspace:path.join(directory,'workspace'),executable});
 const agent=await codex.call('connect',{workspace:path.join(directory,'workspace')});
 const mcp=await broker.configure('main',{nodeId:'test-leader',parentRequestId:'natural-discovery'});
 parent=await codex.call('ipc',{op:'submit',agentId:agent.agentId,requestId:'natural-discovery',mcp,message:'查看你的模型，以及你连接的子agent有哪些，让他们分别告诉你他们的模型是什么。你汇总并输出一个连接图，标识agent与模型'});
 save();let task;const end=Date.now()+240000;
 do{task=await codex.call('ipc',{op:'task',taskId:parent.taskId});if(terminal.has(task.status)||task.status==='unknown')break;await sleep(500);}while(Date.now()<end);
 report.parent={status:task.status,answer:task.result?.message||'',error:task.error};report.tools=calls;report.mcpProgress=task.events.filter(e=>e.event.kind==='progress'&&e.event.text?.startsWith('mcp_tool_call')).map(e=>e.event.text);
 report.children=await Promise.all([...delegations.values()].map(async d=>{const child=await claude.call('ipc',{op:'task',taskId:d.task.taskId});return {status:child.status,answer:child.result?.message||'',error:child.error};}));
 report.checks.bridgeListAgents=calls.includes('list_agents');report.checks.actualDelegation=delegations.size>0;
 report.checks.actualResultRead=calls.includes('task_result');report.checks.childNativeSucceeded=report.children.length>0&&report.children.every(t=>t.status==='succeeded');
 report.checks.parentSummarized=task.status==='succeeded'&&/Claude/.test(task.result?.message||'')&&/mermaid/.test(task.result?.message||'');
 assert(Object.values(report.checks).every(Boolean));report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code,message:e.message};process.exitCode=1;}).finally(async()=>{
 // Only stop owned tasks on failure; no resubmission or replacement IDs.
 if(report.status!=='passed'){
  const parents=(await codex.call('snapshot',{})).tasks;
  for(const t of parents.filter(t=>!terminal.has(t.status)))await codex.call('ipc',{op:'cancel',taskId:t.taskId,operationId:'test-stop-main'});
  for(const d of delegations.values()){
   const t=await claude.call('ipc',{op:'task',taskId:d.task.taskId});
   if(!terminal.has(t.status))await claude.call('ipc',{op:'cancel',taskId:t.taskId,operationId:'test-stop-'+d.task.requestId});
  }
 }
 broker.close();codex.close();claude.close();save();console.log(JSON.stringify({status:report.status,checks:report.checks,error:report.error,report:output}));
});
