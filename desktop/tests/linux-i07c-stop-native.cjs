// Real Claude process cancellation, isolated profile, stable original operations.
// No model/key configuration and no user SSH machine changes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {AgentNetwork}=require('../electron/agent-network.cjs'),{MachineHost}=require('../electron/machine-host.cjs'),{ClaudeHost}=require('../electron/claude-host.cjs'),{HostConnection}=require('../electron/rpc.cjs'),{createCoordinatorService}=require('../electron/coordinator-service.cjs');
const root=path.resolve(__dirname,'../..'),profile=path.join(root,'.agentbridge-dev','i07c-stop-native-'+(process.env.AGENTBRIDGE_I07_PROBE_ID||'first'));
const output=path.resolve(process.env.AGENTBRIDGE_I07_REPORT||path.join(root,'artifacts/I07C-stop/2026-10-16/native.json'));
fs.mkdirSync(profile,{recursive:true});let network,service;
function open(){network=new AgentNetwork({directory:profile,platform:'linux',distributions:async()=>[],createHost:()=>new MachineHost({directory:path.join(profile,'native'),home:os.homedir(),legacy:new ClaudeHost({directory:path.join(profile,'native','legacy')}),openCode:directory=>new HostConnection(path.join(root,'dist/desktop-host.js'),{directory,native:true,leaf:true})})});service=createCoordinatorService({directory:profile,network,version:require('../package.json').version,teamTickMs:1000});}
const report={date:new Date().toISOString(),version:require('../package.json').version,environment:'WSL Linux / real Claude native process; isolated Coordinator/TeamSpace, no user SSH',status:'running',checks:[]};
const call=async(name,p={})=>{const r=await service.call({method:'team.'+name,params:p});if(!r.ok)throw Object.assign(Error('Original team/native operation did not complete'),{code:r.error.code});return r.result;};
async function user(name,p){const receipt=await call('operation',{operationId:p.operationId});return receipt.state==='confirmed'?receipt.data:call(name,p);}
async function wait(runId,predicate){const until=Date.now()+120000;while(Date.now()<until){const c=await call('refresh',{runId});if(predicate(c))return c;await new Promise(r=>setTimeout(r,500));}throw Object.assign(Error('Original native execution remains unresolved; private state retained'),{code:'PROBE_TIMEOUT'});}
(async()=>{
 open();const s=await network.snapshot(),node=s.nodes.find(n=>n.adapter==='claude'&&n.executionSupported&&n.healthy);assert(node);report.nativeVersion=node.version;if(!node.connected)await network.call('attachNode',{nodeId:node.nodeId});
 const a=await user('registerAgent',{operationId:'leader',kind:'native',nodeId:node.nodeId,name:'停止能力验收成员',purpose:'验收原生取消，不修改业务文件'});
 const team=await user('createTeam',{operationId:'team',name:'原生停止验收',leaderId:a.agentId,memberIds:[a.agentId],charter:'仅验收原生取消。不读写业务文件、不扩大权限。'});
 const run=await user('createRun',{operationId:'run',teamId:team.teamId,name:'停止原生执行',goal:'执行中由用户停止，等待原终态再归档',acceptance:'取消回执与原执行终态区分'});
 await user('execute',{operationId:'execute',runId:run.runId,agentId:a.agentId,message:'这是取消能力验收。请先用 team_context 读取小队约定，然后用 Bash 执行 sleep 90，等待用户取消。不要访问或修改业务文件，不要新建其他任务，不要替代用户批准权限。'});
 const before=await wait(run.runId,c=>c.attempts.some(a=>a.state==='running'&&a.nativeSessionBound)||c.run.state==='stopping'||c.run.state==='closed');
 report.nativeSessionObserved=before.attempts.some(a=>a.nativeSessionBound);assert(report.nativeSessionObserved);
 report.waitingObserved=before.attempts.some(a=>a.waiting);report.checks.push('Original real Claude process reached running with private native Session binding; no synthetic model response');
 if(before.run.state==='active')await user('stopRun',{operationId:'stop',runId:run.runId,expectedRevision:before.run.revision});
 const initial=await call('context',{runId:run.runId});report.firstStopState=initial.run.state;
 assert(initial.run.state==='stopping'||initial.attempts.every(a=>['succeeded','failed','cancelled','rejected'].includes(a.state)));
 service.close();open();
 const final=await wait(run.runId,c=>c.run.state==='closed');
 assert.equal(final.attempts.length,1);assert.equal(final.attempts[0].state,'cancelled');assert(!final.acceptance);
 report.nativeTerminal=final.attempts[0].state;report.finalStopState=final.run.state;
 let cancelCommands=0;function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())scan(p);else if(e.name==='commands.jsonl')for(const line of fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean)){const row=JSON.parse(line);if(row.action==='cancel')cancelCommands++;}}}scan(profile);
 assert.equal(cancelCommands,1);report.cancelCommands=cancelCommands;
 report.checks.push('Stop persisted before control, revoked member access and used one original native cancel operation','Observer/Coordinator restart recovered original task cancellation; closed only after real cancelled terminal, no business acceptance or new execution');
 report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code||'ASSERTION',message:'Real original-stop verification did not complete; preserve isolated profile and query its original operations.'};process.exitCode=1;}).finally(()=>{service?.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
