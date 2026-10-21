const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {CodexHost}=require('../electron/codex-host.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-codex-')),executable=path.join(directory,'codex');
  fs.writeFileSync(executable,`#!${process.execPath}
const fs=require('node:fs');const args=process.argv.slice(2);if(args.includes('--version')){console.log('codex-cli 0.161.0');process.exit(0);}const session=args.includes('resume')?args[args.indexOf('resume')+1]:'native-session';let prompt='';process.stdin.on('data',c=>prompt+=c);process.stdin.on('end',()=>{fs.appendFileSync(${JSON.stringify(path.join(directory,'calls.jsonl'))},JSON.stringify({args,prompt})+'\\n');console.log(JSON.stringify({type:'thread.started',thread_id:session}));if(prompt==='wait'){setInterval(()=>{},1000);return;}if(prompt==='fail'){console.log(JSON.stringify({type:'turn.failed',error:{message:'native failure'}}));process.exit(1);}if(prompt==='error-before-completed')console.log(JSON.stringify({type:'error',message:'explicit native error'}));if(prompt==='failed-before-completed')console.log(JSON.stringify({type:'turn.failed',error:{message:'explicit turn failure'}}));console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:prompt+' reply'}}));console.log(JSON.stringify({type:'turn.completed'}));if(prompt==='error-after-completed')console.log(JSON.stringify({type:'error',message:'explicit late error'}));});
`,{mode:0o700});const host=new CodexHost({directory,executable});t.after(()=>{host.close();fs.rmSync(directory,{recursive:true,force:true});});return {host,directory,executable};}
async function done(host,taskId){for(let i=0;i<100;i++){const task=await host.call('ipc',{op:'task',taskId});if(['succeeded','failed','cancelled'].includes(task.status))return task;await delay(30);}throw Error('native fixture timeout');}
test('Codex executes native JSON events, inherits configuration, deduplicates and resumes the exact session after observer restart',async t=>{const f=fixture(t),a=await f.host.call('connect',{workspace:f.directory,executable:f.executable});const params={op:'submit',agentId:a.agentId,requestId:'one',message:'hello'};const first=await f.host.call('ipc',params);const result=await done(f.host,first.taskId);assert.equal(result.result.message,'hello reply');assert.equal(result.native.sessionId,'native-session');const replay=await f.host.call('ipc',params);assert.equal(replay.taskId,first.taskId);await assert.rejects(f.host.call('ipc',{...params,message:'changed'}),{code:'REQUEST_CONFLICT'});f.host.close();const reopened=new CodexHost({directory:f.directory,executable:f.executable});t.after(()=>reopened.close());const next=await reopened.call('ipc',{op:'continue',conversationId:first.conversationId,requestId:'two',message:'next'});const answer=await done(reopened,next.taskId);assert.equal(answer.native.sessionId,result.native.sessionId);const calls=fs.readFileSync(path.join(f.directory,'calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert.equal(calls.length,2);assert(!calls.some(c=>c.args.some(a=>a==='--model'||a==='--oss'||a.startsWith('model='))));assert(calls[1].args.includes('native-session'));});
test('Codex provider failure stays failed and cancellation is confirmed only when its owned native process exits',async t=>{const f=fixture(t),a=await f.host.call('connect',{workspace:f.directory,executable:f.executable});const first=await f.host.call('ipc',{op:'submit',agentId:a.agentId,requestId:'fail',message:'fail'});const failed=await done(f.host,first.taskId);assert.equal(failed.status,'failed');assert.match(failed.error.message,/native failure/);const waiting=await f.host.call('ipc',{op:'submit',agentId:a.agentId,requestId:'wait',message:'wait'});await delay(150);const receipt=await f.host.call('ipc',{op:'cancel',taskId:waiting.taskId,operationId:'cancel'});assert.equal(receipt.state,'unknown');assert.equal((await done(f.host,waiting.taskId)).status,'cancelled');assert.equal((await f.host.call('ipc',{op:'operation',operationId:'cancel'})).state,'confirmed');});
test('MCP approval adaptation is scoped to bridge tools and does not replace native account, model or filesystem policies',async t=>{
 const f=fixture(t),a=await f.host.call('connect',{workspace:f.directory});
 const task=await f.host.call('ipc',{op:'submit',agentId:a.agentId,requestId:'mcp',message:'hello',mcp:{command:process.execPath,args:['private-client.cjs'],env:{ELECTRON_RUN_AS_NODE:'1'}}});
 assert.equal((await done(f.host,task.taskId)).status,'succeeded');
 const {args}=JSON.parse(fs.readFileSync(path.join(f.directory,'calls.jsonl'),'utf8').trim());
 for(const name of ['list_delegations','list_agents','delegate','task_result','cancel_task','task_pending'])assert(args.includes('mcp_servers.agentbridge.tools.'+name+'.approval_mode="auto"'));
 assert(!args.some(a=>a.includes('reply_task.approval_mode')));assert(!args.some(a=>/^(model|model_provider|approval_policy|sandbox_mode)=/.test(a)));
 assert(!args.some(a=>a.includes('bypass')||a==='--full-auto'||a==='--model'));
});

test('Codex Bridge turns distinguish connected nodes from native agents on new and resumed sessions without altering direct prompts or receipts',async t=>{
 const f=fixture(t),a=await f.host.call('connect',{workspace:f.directory});
 const message='查看你连接的子agent，让他们分别报告模型',mcp={command:process.execPath,args:['private-client.cjs']};
 const params={op:'submit',agentId:a.agentId,requestId:'discover',message,mcp};
 const first=await f.host.call('ipc',params);await done(f.host,first.taskId);
 assert.equal((await f.host.call('ipc',params)).taskId,first.taskId);
 assert.equal((await f.host.call('ipc',{op:'request',requestId:'discover'})).message,message);
 const second=await f.host.call('ipc',{op:'continue',conversationId:first.conversationId,requestId:'discover-next',message,mcp});
 assert.equal((await done(f.host,second.taskId)).native.sessionId,'native-session');
 const direct=await f.host.call('ipc',{op:'submit',agentId:a.agentId,requestId:'direct',message});await done(f.host,direct.taskId);
 const calls=fs.readFileSync(path.join(f.directory,'calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 assert.equal(calls.length,3);
 for(const call of calls.slice(0,2)){
  assert.match(call.prompt,/mcp__agentbridge__list_agents/);assert.match(call.prompt,/Codex 原生 collaboration\.list_agents/);
  assert.match(call.prompt,/只有 \/root 不能证明/);assert.match(call.prompt,/工具缺失或调用失败/);
  assert.match(call.prompt,/稳定 requestId/);assert.match(call.prompt,/实际委派询问/);assert(call.prompt.endsWith(message));
  assert(!call.args.some(arg=>/^(model|model_provider|approval_policy|sandbox_mode|developer_instructions)=/.test(arg)));
 }
 assert.equal(calls[2].prompt,message);assert(!calls[2].args.some(arg=>arg.startsWith('mcp_servers.agentbridge.')));
});

 test('Codex explicit errors cannot be overwritten by completion and zero exit, including after observer restart',async t=>{
 const f=fixture(t),a=await f.host.call('connect',{workspace:f.directory});
 for(const message of ['error-before-completed','failed-before-completed','error-after-completed']){
  const params={op:'submit',agentId:a.agentId,requestId:message,message};
  const original=await f.host.call('ipc',params),result=await done(f.host,original.taskId);
  assert.equal(result.status,'failed',message);assert.match(result.error.message,/explicit/);assert.equal(result.result,undefined);
  assert.equal((await f.host.call('ipc',params)).taskId,original.taskId);
 }
 f.host.close();const reopened=new CodexHost({directory:f.directory,executable:f.executable});t.after(()=>reopened.close());
 for(const requestId of ['error-before-completed','failed-before-completed','error-after-completed'])assert.equal((await reopened.call('ipc',{op:'request',requestId})).status,'failed');
 assert.equal(fs.readFileSync(path.join(f.directory,'calls.jsonl'),'utf8').trim().split('\n').length,3);
});
