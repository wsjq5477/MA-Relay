// Explicit frozen Windows backend acceptance; no GUI, native tasks or user profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{spawnSync}=require('node:child_process');
const [bridge,output]=process.argv.slice(2);
if(process.platform!=='win32'||!output)throw Error('Windows frozen bridge and report path required');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={date:new Date().toISOString(),version:require('../package.json').version,status:'running',nodeVersion:process.version,
  scope:'Frozen packaged Windows backend / controlled hosts and disposable profile / authenticated actual Coordinator pipe; no GUI, SSH, native prompts or user configuration',modelCalls:0,checks:[]};
let fixture,server,client;
(async()=>{
  report.modules=Object.fromEntries(['agent-network.cjs','relation-state.cjs','connection-policy.cjs','agent-connections.cjs','graph-operations.cjs','coordinator-client.cjs','coordinator.cjs','runtime-capabilities.cjs'].map(name=>{
    const digest=hash(path.join(bridge,'desktop/electron',name));assert.equal(digest,hash(path.join(__dirname,'../electron',name)));return [name,digest];
  }));
  // Windows Node's --test file discovery rejects the valid UNC checkout path.
  // A local entry imports the exact original test modules (their relative
  // resolution remains unchanged); TAP must still report all 37 actual cases.
  const loader=path.join(path.dirname(bridge),'relations-frozen-runner.cjs');
  fs.writeFileSync(loader,['relation-state.test.cjs','multi-parent-relations.test.cjs','connection-policy.test.cjs'].map(name=>'require('+JSON.stringify(path.join(__dirname,name))+');').join('\n')+'\n');
  const tested=spawnSync(process.execPath,['--test','--test-reporter=tap',loader],{encoding:'utf8',maxBuffer:1024*1024,env:{...process.env,AGENTBRIDGE_VERIFY_RELATION_RUNTIME:bridge}});
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(path.join(path.dirname(output),'windows-relations.tap'),tested.stdout||'');
  fs.writeFileSync(path.join(path.dirname(output),'windows-relations.stderr'),tested.stderr||'');
  assert.ifError(tested.error);assert.equal(tested.status,0);assert.match(tested.stdout,/# tests 37\s/);assert.match(tested.stdout,/# pass 37\s/);assert.match(tested.stdout,/# fail 0\s/);
  report.checks.push('All 37 migration/runtime/connection-policy/identity/unknown/atomic failure cases execute against frozen packaged modules on Windows');
  fixture=await require('./i06b-ui-fixture.cjs').graphFixture({runtimeRoot:bridge});
  const runtime=name=>require(path.join(bridge,'desktop/electron',name));
  server=await runtime('coordinator.cjs').startCoordinator({directory:fixture.directory,version:report.version,network:fixture.router,platform:'win32'});
  client=new (runtime('coordinator-client.cjs').CoordinatorClient)({directory:fixture.directory,version:report.version});
  const rpc=async(method,params={})=>{const reply=await client.request('call',{method,params});assert.equal(reply.ok,true);return reply.result;};
  const snapshot=await rpc('snapshot'),leader=snapshot.nodes.find(n=>n.adapter==='claude'),child=snapshot.nodes.find(n=>n.adapter==='opencode');
  const relation=await rpc('collaboration');
  const input={operationId:'frozen-windows-original-relation',expectedRevision:relation.revision,leaderId:leader.nodeId,memberIds:[child.nodeId]};
  const first=await rpc('saveCollaboration',input);assert.equal(first.state,'confirmed');assert.deepEqual(await rpc('saveCollaboration',input),first);
  const current=await rpc('collaboration');assert.deepEqual(Object.keys(current).sort(),['leaderId','memberIds','revision']);
  assert.deepEqual(current,first.data);
  const stored=JSON.parse(fs.readFileSync(path.join(fixture.directory,'agent-network.json')));
  assert.deepEqual(stored.relations.find(row=>row.relationId===stored.activeRelationId),{relationId:stored.activeRelationId,enabled:true,...current,envelope:{version:1,revision:1,allowedNodeIds:current.memberIds}});
  assert.equal(stored.relationOperations.length,1);assert.equal(stored.requests.length,0);assert.equal(stored.delegations.length,0);
  report.checks.push('Authenticated actual Coordinator pipe commits selected relation and original-ID receipt together, preserving the existing three-field RPC response');
  report.checks.push('Disposable controlled profile has zero task/request/delegation records; no GUI or daily/native/SSH configuration is used');
  assert(client.info.capabilities.includes('multi-parent-relations-v1'));
  const second=await rpc('saveCollaboration',{operationId:'frozen-windows-second-relation',relationId:'frozen-second-relation',expectedRevision:0,leaderId:child.nodeId,memberIds:[leader.nodeId]});
  assert.equal(second.state,'confirmed');assert.equal((await rpc('relations')).items.length,2);
  assert.deepEqual(await rpc('collaboration'),current);
  const own=await fixture.router.collaborationTool({nodeId:child.nodeId,externalConnectionId:'controlled-windowless-connection'},'list_agents',{},'controlled-list',child.machineId);
  assert.equal(own.caller.role,'leader');assert.deepEqual(own.items.map(n=>n.nodeId),[leader.nodeId]);
  report.checks.push('Central capability and explicit relation API work through the authenticated pipe; the second caller uses its own outgoing grant while the legacy selected view stays original');
  assert(client.info.capabilities.includes('agent-connection-policy-v1'));
  const outside=snapshot.nodes.find(n=>n.nodeId!==leader.nodeId&&n.nodeId!==child.nodeId);
  const connection=await fixture.router.collaborationTool({nodeId:leader.nodeId,externalConnectionId:'controlled-windows-policy'},'connect_agent',{operationId:'windows-policy-outside',nodeId:outside.nodeId},'windows-policy-parent',leader.machineId);
  assert.equal(connection.state,'pending_approval');
  const policies=await rpc('connectionPolicies'),approval=policies.pending.find(p=>p.operationId==='windows-policy-outside'),policyRow=policies.relations.find(r=>r.leaderId===leader.nodeId);
  const decision=await rpc('decideConnection',{operationId:'windows-policy-allow',approvalId:approval.approvalId,decision:'allow',expectedPolicyRevision:policyRow.envelope.revision});
  assert.equal(decision.state,'confirmed');assert((await rpc('collaboration')).memberIds.includes(outside.nodeId));
  assert.equal(fixture.router.network.requests.length,0);
  report.checks.push('Authenticated user-only policy pipe confirms original outside-envelope request with an atomic grant and original receipt; no tasks are submitted');
  client.close();await server.close();server=null;
  const restored=new (runtime('agent-network.cjs').AgentNetwork)({directory:fixture.directory,platform:'win32',distributions:async()=>['Ubuntu'],createHost:machine=>fixture.hosts.get(machine.machineId)});
  server=await runtime('coordinator.cjs').startCoordinator({directory:fixture.directory,version:report.version,network:restored,platform:'win32'});
  client=new (runtime('coordinator-client.cjs').CoordinatorClient)({directory:fixture.directory,version:report.version});
  const retained=await client.request('call',{method:'collaborationOperation',params:{operationId:'frozen-windows-second-relation'}});
  assert.equal(retained.ok,true);assert.deepEqual(retained.result,second);
  assert.deepEqual((await client.request('call',{method:'connectionPolicyOperation',params:{operationId:'windows-policy-allow'}})).result,decision);
  const restoredRows=await client.request('call',{method:'relations',params:{}});assert.equal(restoredRows.result.items.length,2);
  report.checks.push('Actual Coordinator pipe restart restores both original relations and the exact explicit-operation receipt without resubmission');

  report.status='passed';
})().catch(error=>{report.status='failed';report.error={code:error.code||'VERIFY_FAILED',message:error.message};process.exitCode=1;})
  .finally(async()=>{client?.close();await server?.close();fixture?.close();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
