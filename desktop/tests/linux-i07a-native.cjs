// Production coordinator -> MachineHost -> real installed Claude CLI -> team MCP.
// Isolated durable profile; rerunning queries the same original request.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {AgentNetwork}=require('../electron/agent-network.cjs');
const {MachineHost}=require('../electron/machine-host.cjs');
const {ClaudeHost}=require('../electron/claude-host.cjs');
const {HostConnection}=require('../electron/rpc.cjs');
const {createCoordinatorService}=require('../electron/coordinator-service.cjs');
if(process.platform!=='linux')throw Error('Linux required');
const root=path.resolve(__dirname,'../..'),profile=path.join(root,'.agentbridge-dev','i07a-native-'+(process.env.AGENTBRIDGE_I07_PROBE_ID||'first'));
const output=path.join(root,'artifacts/I07A/2026-10-15/native.json');
fs.mkdirSync(profile,{recursive:true});
const network=new AgentNetwork({directory:profile,platform:'linux',distributions:async()=>[],createHost:()=>new MachineHost({directory:path.join(profile,'native'),home:os.homedir(),legacy:new ClaudeHost({directory:path.join(profile,'native','legacy')}),openCode:directory=>new HostConnection(path.join(root,'dist/desktop-host.js'),{directory,native:true,leaf:true})})});
const service=createCoordinatorService({directory:profile,network,version:require('../package.json').version});
const report={date:new Date().toISOString(),version:require('../package.json').version,environment:'WSL Linux / production coordinator and MachineHost / real Claude native configuration',status:'running',checks:[],modelCalls:'one original request; repeats only query',privateStateRetained:true};
const call=async(method,params)=>{const r=await service.call({method,params});if(!r.ok)throw Object.assign(Error(r.error.message),{code:r.error.code});return r.result;};
(async()=>{
 const snapshot=await network.snapshot(),node=snapshot.nodes.find(n=>n.adapter==='claude'&&n.executionSupported&&n.healthy);
 assert(node,'Installed Claude not available');
 if(!node.connected)await network.call('attachNode',{nodeId:node.nodeId});
 const agent=await call('team.registerAgent',{operationId:'native-agent',kind:'native',nodeId:node.nodeId,name:'接入验证员',purpose:'验证公共上下文、群消息和文档工具'});
 const peer=await call('team.registerAgent',{operationId:'external-observer',kind:'mcp',externalKey:'controlled-observer',name:'报告接收员',purpose:'接收公开验证报告'});
 const team=await call('team.createTeam',{operationId:'native-team',name:'原生接入验证',leaderId:agent.agentId,memberIds:[agent.agentId,peer.agentId],charter:'仅验证协作工具；不使用终端，不改业务文件，不扩大权限。'});
 const run=await call('team.createRun',{operationId:'native-run',teamId:team.teamId,name:'原生公共空间验证',goal:'使用真实原生Agent读上下文、发群消息和写公共文档',acceptance:'公共群存在I07A_NATIVE_OK；存在Native report文档，原生本轮成功'});
 await call('team.execute',{operationId:'native-original',runId:run.runId,agentId:agent.agentId,message:'请先调用 team_context，核对你在小队中的身份和其他成员。然后用 team_post_message 把 I07A_NATIVE_OK 发送到公共群，notifyIds 指向其他成员。再用 team_update_document 创建标题为 Native report、内容为 I07A_NATIVE_OK 的共享文档，expectedRevision 为0。只使用这些小队工具，不使用终端和文件工具，不调用其他智能体。完成后简短汇报。'});
 let view;
 const until=Date.now()+120000;
 do{view=await call('team.refresh',{runId:run.runId});if(['succeeded','failed','cancelled','rejected'].includes(view.attempts[0]?.state))break;await new Promise(r=>setTimeout(r,1000));}while(Date.now()<until);
 report.nativeState=view.attempts[0]?.state;
 assert.equal(report.nativeState,'succeeded','Native original not successful; preserve and query its original request');
 assert(view.messages.some(m=>m.senderId===agent.agentId&&m.content.includes('I07A_NATIVE_OK')&&m.notifyIds.includes(peer.agentId)));
 assert(view.documents.some(d=>d.ownerId===agent.agentId&&d.title==='Native report'&&d.content.includes('I07A_NATIVE_OK')));
 assert.equal(view.run.state,'active');
 report.checks.push('Real native Agent read the member-scoped work and identified its peer','Real native Agent posted a group report and notified its peer','Real native Agent created a shared document through team MCP','Native round ended but total work remained active');report.status='passed';
})().catch(e=>{report.status='failed';report.error={code:e.code||'ASSERTION',message:e.code?'Original native acceptance did not complete; private state retained.':e.message};process.exitCode=1;}).finally(()=>{service.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
