const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const {taskEventView}=require('../electron/task-event-view.cjs');
const {CollaborationBroker}=require('../electron/collaboration-broker.cjs');
const {fixture}=require('./interconnect-fixture.cjs');
const row=(seq,event)=>({seq,timestamp:'2026-11-03T00:00:00.000Z',event});

test('event pages retain original sequence while excluding bindings, credentials and arbitrary tool payloads',()=>{
  const task={taskId:'original-task',lastSeq:6,events:[
    row(1,{kind:'accepted'}),
    row(2,{kind:'native',native:{sessionId:'private-binding',snapshot:{passwordFile:'private-config'}}}),
    row(3,{kind:'output',text:'Public answer',token:'private-token-field'}),
    row(4,{kind:'tool',arguments:{credential:'private-tool-field'},name:'private-tool-name'}),
    row(5,{kind:'completed',result:{message:'Done',internalConfig:'private-result-field'}}),
    row(6,{kind:'progress',text:'command_execution · read private-tool-argument'}),
  ]};
  const original=JSON.stringify(task),first=taskEventView(task,{afterSeq:0,limit:3});
  assert.deepEqual(first.items.map(item=>item.seq),[1,2,3]);assert.equal(first.cursor,3);assert.equal(first.hasMore,true);
  assert.equal(first.items[1].event.kind,'binding-observed');
  assert.equal(JSON.stringify(first).includes('private-'),false);
  assert.deepEqual(taskEventView(task,{afterSeq:0,limit:3}),first);
  const last=taskEventView(task,{afterSeq:first.cursor,limit:3});
  assert.equal(last.cursor,6);assert.equal(last.hasMore,false);assert.equal(JSON.stringify(last).includes('private-'),false);
  assert.deepEqual(last.items.at(-1).event,{kind:'progress',detailsOmitted:true});
  assert.equal(JSON.stringify(task),original);
});

test('missing retained history is reported as a cursor gap without fabricated events',()=>{
  const task={taskId:'retained-task',lastSeq:8,detailsTruncated:true,events:[row(4,{kind:'progress',text:'Retained'}),row(8,{kind:'completed',result:{message:'Done'}})]};
  const view=taskEventView(task,{afterSeq:0});assert.deepEqual(view.items.map(item=>item.seq),[4,8]);
  assert.equal(view.cursorGap,true);assert.equal(view.detailsTruncated,true);assert.equal(view.cursor,8);
  assert.equal(taskEventView({taskId:'unsupported'},{afterSeq:4}).supported,false);
  assert.deepEqual(taskEventView({taskId:'unsupported'},{afterSeq:4}).items,[]);
  assert.throws(()=>taskEventView(task,{afterSeq:9}),{code:'TASK_EVENT_CURSOR'});
});

test('UTF8 output is bounded and pagination limits event bytes independently of native execution',()=>{
  const task={taskId:'large-task',lastSeq:8,events:Array.from({length:8},(_,i)=>row(i+1,{kind:'output',text:'中文🌏'.repeat(10000)}))};
  const view=taskEventView(task,{afterSeq:0,limit:100});
  assert.ok(view.items.length>0&&view.items.length<8);assert.equal(view.hasMore,true);assert.equal(view.detailsTruncated,true);
  for(const item of view.items){assert.ok(Buffer.byteLength(item.event.text)<=32768);assert.equal(item.event.text.includes('\ufffd'),false);}
  assert.ok(Buffer.byteLength(JSON.stringify(view.items))<132000);
});

test('invalid cursors and corrupt source sequences fail without replacing the original task',()=>{
  const task={taskId:'original',lastSeq:1,events:[row(1,{kind:'accepted'})]};
  for(const args of [{},{afterSeq:-1},{afterSeq:1.5},{afterSeq:0,limit:0},{afterSeq:0,limit:101},{limit:1}])assert.throws(()=>taskEventView(task,args),{code:'TASK_EVENT_CURSOR'});
  for(const bad of [{...task,lastSeq:0},{...task,lastSeq:1.5},{...task,events:[row(1,{kind:'accepted'}),row(1,{kind:'started'})]}])assert.throws(()=>taskEventView(bad,{afterSeq:0}),{code:'TASK_EVENT_STATE'});
  assert.equal(task.events.length,1);assert.equal(task.taskId,'original');
});

test('authorized task_result reads live events and replays a cursor without another execution',async t=>{
  const f=await fixture(t),task=await f.tool('delegate',{nodeId:f.child.nodeId,requestId:'original',message:'Compile'});
  const original=f.state.tasks[0];original.lastSeq=2;original.events=[row(1,{kind:'accepted'}),row(2,{kind:'output',text:'Still running'})];
  const first=await f.tool('task_result',{taskId:task.taskId,afterSeq:0,limit:1,waitMs:45000});
  assert.equal(first.status,'running');assert.equal(first.outcome.terminal,false);assert.equal(first.outcome.businessAcceptance,'not-evaluated');assert.equal(first.events.cursor,1);
  assert.deepEqual((await f.tool('task_result',{taskId:task.taskId,afterSeq:0,limit:1})).events,first.events);
  const next=await f.tool('task_result',{taskId:task.taskId,afterSeq:1});
  assert.equal(next.events.items[0].event.text,'Still running');assert.equal(next.invocation.taskId,task.taskId);
  f.finish(task);const done=await f.tool('task_result',{taskId:task.taskId,afterSeq:2});
  assert.equal(done.outcome.terminal,true);assert.equal(done.outcome.status,'succeeded');assert.equal(f.state.executions,1);
});

test('real stdio proves event and original-request query support before reading any task',async()=>{
  if(/^c:[\\/]/i.test(os.tmpdir()))throw Error('Non-C temporary directory required.');
  for(const scenario of [
    {support:[],args:{taskId:'original',afterSeq:0},code:'MCP_TASK_EVENTS_BACKEND_UPGRADE_REQUIRED'},
    {support:['task.events-v1'],args:{delegationId:'original',afterSeq:0},code:'MCP_ORIGINAL_REQUEST_BACKEND_UPGRADE_REQUIRED'},
    {support:['task.original-request-v1'],args:{delegationId:'original',afterSeq:0},code:'MCP_TASK_EVENTS_BACKEND_UPGRADE_REQUIRED'},
  ]){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-event-gate-'));let reads=0;
  const broker=new CollaborationBroker(directory,(_scope,name)=>{if(name==='list_agents')return {supportedOperations:scenario.support};reads++;return {};});
  let child;
  try{
    const config=await broker.configure('event-reader',{nodeId:'caller',parentRequestId:'original'});
    child=spawn(config.command,config.args,{windowsHide:true,env:{...process.env,...config.env},stdio:['pipe','pipe','pipe']});
    let output='';child.stdout.on('data',data=>{output+=data;});const ended=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
    child.stdin.end(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'task_result',arguments:scenario.args}})+'\n');
    assert.equal(await ended,0);
    assert.equal(JSON.parse(JSON.parse(output.trim()).result.content[0].text).error.code,scenario.code);assert.equal(reads,0);
  }finally{child?.kill();broker.close();fs.rmSync(directory,{recursive:true,force:true});}
  }
});
