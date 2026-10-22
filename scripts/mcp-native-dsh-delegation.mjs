// Explicit live acceptance: installed DSH MCP client -> production graph/broker -> one real Claude task.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
if(process.argv[2]!=='--run'){console.log('Use --run for one new real Claude delegation, or read the existing private plan; never replay prepared intents.');process.exit(0);}
const {AgentNetwork}=require('../desktop/electron/agent-network.cjs');
const {MachineHost}=require('../desktop/electron/machine-host.cjs');
const {ClaudeHost}=require('../desktop/electron/claude-host.cjs');
const {createCoordinatorService}=require('../desktop/electron/coordinator-service.cjs');
const {setupOnce}=require('../desktop/tests/linux-connection-delegation.cjs');
const YAML=require('yaml');
const privateFile=path.join(os.tmpdir(),'agentbridge-native-dsh-delegation-20261022.private-plan.json');
const existed=fs.existsSync(privateFile),cp=existed?JSON.parse(fs.readFileSync(privateFile)): {directory:fs.mkdtempSync(path.join(os.tmpdir(),'ab-dsh-delegation-')),setup:{},requestId:randomUUID(),phase:'new'};
const save=()=>fs.writeFileSync(privateFile,JSON.stringify(cp,null,2),{mode:0o600});save();
const report={date:new Date().toISOString(),version:'0.6.0-alpha.46',environment:'installed DSH native MCP component / production Coordinator, AgentNetwork, MachineHost, broker / real Claude child / one WSL host',nativeParentModel:false,modelTasksStarted:0,status:'running',checks:[]};
const output=path.resolve(process.env.AGENTBRIDGE_MCP_EVIDENCE||'artifacts/mcp-native-acceptance/2026-10-22/dsh-delegation.json');
const record=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
const mcpHome=path.join(cp.directory,'native'),profile=path.join(mcpHome,'profiles/web');fs.mkdirSync(profile,{recursive:true});
const patch=path.join(profile,'cordis.patch.yml');if(!fs.existsSync(patch))fs.writeFileSync(patch,'[]\n');
const environment={...process.env,DSH_HOME:mcpHome};
const network=new AgentNetwork({directory:cp.directory,platform:'linux',distributions:async()=>[],createHost:()=>new MachineHost({directory:path.join(cp.directory,'machine'),home:os.homedir(),environment,
  candidates:{codex:[],opencode:[],hermes:[],pi:[],opendesk:[]},legacy:new ClaudeHost({directory:path.join(cp.directory,'legacy'),home:os.homedir(),environment})})});
const service=createCoordinatorService({directory:cp.directory,network,version:report.version});
const call=async(method,params={})=>{const r=await service.call({method,params});if(!r.ok)throw Object.assign(Error(r.error.code),{code:r.error.code});return r.result;};
let ctx,terminal=false;
try{
  if(existed&&cp.phase==='complete'){const task=await call('ipc',{op:'request',machineId:cp.child.machineId,requestId:cp.derivedRequestId});assert.equal(task.taskId,cp.taskId);assert.equal(task.requestId,cp.derivedRequestId);assert(task.native?.sessionId);report.nativeSessionBound=true;assert.equal(task.status,'succeeded');assert.match(task.result.message,/AB_MCP_DSH_NATIVE_221/);assert.equal(network.network.requests.length,1);terminal=true;report.childStatus=task.status;report.status='passed';report.checks.push('Fresh observer reopens the original native task and result, retains exactly one request and starts zero new tasks');record();console.log(JSON.stringify(report));await ctx?.fiber.dispose();service.close();process.exit(0);}
  const snapshot=await call('snapshot');
  if(!cp.leader){assert(!existed,'existing plan cannot select replacement nodes');cp.leader=snapshot.nodes.find(n=>n.adapter==='dsh-web'&&n.healthy&&!n.supersededBy);cp.child=snapshot.nodes.find(n=>n.adapter==='claude'&&n.healthy&&!n.supersededBy);assert(cp.leader&&cp.child,'live native DSH Web and Claude required');save();}
  for(const [name,node]of [['leader',cp.leader],['child',cp.child]]){
    const params=cp.setup[name]?.params||{nodeId:node.nodeId,action:'attach',operationId:randomUUID()};await setupOnce(cp,name,'manageNode',params,save,call,!existed);
  }
  const relation=cp.setup.relation?.params||{operationId:randomUUID(),leaderId:cp.leader.nodeId,memberIds:[cp.child.nodeId],expectedRevision:snapshot.collaboration.revision};
  await setupOnce(cp,'relation','saveCollaboration',relation,save,call,!existed);
  if(!cp.connectionId){assert(!existed);const installed=await call('mcp.install',{nodeId:cp.leader.nodeId});cp.connectionId=installed.connectionId;save();}
  const nativeRequire=createRequire(path.join(os.homedir(),'.dsh/profiles/node_modules/@deepseek-ai/dsh-mcp-client/package.json'));
  const load=name=>import(pathToFileURL(nativeRequire.resolve('@deepseek-ai/'+name)).href);
  const [{Context},{default:Prompt},{default:Tools},Mcp]=await Promise.all(['cordis','dsh-system-prompt','dsh-tools','dsh-mcp-client'].map(load));
  ctx=new Context();await ctx.plugin(Prompt);await ctx.plugin(Tools);
  const entry=YAML.parse(fs.readFileSync(patch,'utf8')).flatMap(r=>r.insert||[]).find(r=>r.id==='agentbridge-mcp');
  await Mcp.apply(ctx,{...entry.config,cwd:cp.directory,toolCallTimeoutMs:60000,failOnStartupError:true});
  let seq=0;const tool=async(name,args={})=>{const r=await ctx.tools.execute({signal:new AbortController().signal,callId:'accept-'+(++seq),name:'mcp__agentbridge__'+name,arguments:args});const text=r.content.map(b=>b.text||'').join('\n');if(r.isError)throw Object.assign(Error('Native tool error'),{code:/COLLABORATION_FORBIDDEN/.test(text)?'COLLABORATION_FORBIDDEN':'NATIVE_TOOL_ERROR'});return JSON.parse(text);};
  const list=await tool('list_agents');assert.equal(list.caller.role,'leader');assert.equal(list.caller.delegationAuthorized,true);assert.deepEqual(list.items.map(n=>n.nodeId),[cp.child.nodeId]);
  report.versions={dshClient:'0.1.3-alpha.1',child:cp.child.version};report.checks.push('Real native MCP caller is admitted as leader and sees only the authorized Claude child');
  await assert.rejects(tool('delegate',{nodeId:cp.leader.nodeId,requestId:'forbidden-probe',message:'must not execute'}),{code:'COLLABORATION_FORBIDDEN'});assert.equal(network.network.requests.length,existed?1:0);
  if(cp.phase==='new'){
    cp.phase='prepared';cp.derivedRequestId='delegation-'+createHash('sha256').update(cp.leader.nodeId+':mcp:'+cp.connectionId+':'+cp.requestId).digest('hex').slice(0,40);save();
    report.modelTasksStarted=1;record();
    const task=await tool('delegate',{nodeId:cp.child.nodeId,requestId:cp.requestId,message:'这是AgentBridge原生MCP验收。不要使用任何工具，不读取或修改文件，不调用其他Agent。计算13乘17，只回复：AB_MCP_DSH_NATIVE_221',workspace:cp.directory});
    cp.taskId=task.taskId;cp.phase='dispatched';save();
  }else if(!cp.taskId){const task=await call('ipc',{op:'request',machineId:cp.child.machineId,requestId:cp.derivedRequestId});assert.equal(task.requestId,cp.derivedRequestId);cp.taskId=task.taskId;save();}
  let task;const until=Date.now()+240000;
  do{task=await tool('task_result',{taskId:cp.taskId,waitMs:1000});if(['succeeded','failed','cancelled'].includes(task.status))break;if(task.status==='unknown'||task.waiting)throw Object.assign(Error('Original task requires review'),{code:'ORIGINAL_PENDING'});}while(Date.now()<until);
  report.childStatus=task.status;terminal=['succeeded','failed','cancelled'].includes(task.status);record();
  if(!terminal)throw Object.assign(Error('Original task pending'),{code:'ORIGINAL_PENDING'});
  assert.equal(task.status,'succeeded');assert.match(task.result.message,/AB_MCP_DSH_NATIVE_221/);
  const d=network.network.delegations.find(d=>d.taskId===cp.taskId);assert.equal(d.externalConnectionId,cp.connectionId);assert.equal(d.parentTaskId,null);assert.equal(d.parentConversationId,'mcp:'+cp.connectionId);assert.equal(network.network.requests.length,1);
  report.checks.push('One real Claude task succeeded; native DSH client reads its actual result with the original external-connection ownership');
  const revoked={operationId:randomUUID(),leaderId:cp.leader.nodeId,memberIds:[],expectedRevision:network.network.collaboration.revision};await call('saveCollaboration',revoked);
  assert.equal((await tool('list_agents')).items.length,0);
  await assert.rejects(tool('delegate',{nodeId:cp.child.nodeId,requestId:'revoked-probe',message:'must not execute'}),{code:'COLLABORATION_FORBIDDEN'});assert.equal(network.network.requests.length,1);
  assert.equal((await tool('task_result',{taskId:cp.taskId,waitMs:0})).status,'succeeded');
  report.checks.push('Revoking the child grant blocks new delegation while preserving the original readable result and exactly one request');cp.phase='complete';save();report.status='passed';
}catch(error){report.status=terminal?'failed':cp.phase==='new'?'failed':'pending';report.error={code:error.code||'ASSERTION',message:error.message};process.exitCode=report.status==='failed'?1:0;}
finally{record();console.log(JSON.stringify(report));if(terminal||cp.phase==='new'){await ctx?.fiber.dispose();service.close();}else{console.log('Original context retained; no replay or cancellation.');setInterval(()=>{},60000);}}
