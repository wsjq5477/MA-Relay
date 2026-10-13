const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {startCoordinator,endpoint}=require('../electron/coordinator.cjs');
const {CoordinatorClient}=require('../electron/coordinator-client.cjs');
test('two windows share one coordinator; closing clients retains requests, wrong local credentials are rejected',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-i06-coordinator-'));
  let closed=false,nativeCalls=0;const receipts=new Map();
  const service={dispatch(method,input){
    if(method==='preferences') return {version:'fixture'};
    if(method==='call'&&input.method==='submit') {
      if(!receipts.has(input.params.requestId)) {nativeCalls++;receipts.set(input.params.requestId,{taskId:'original',message:input.params.message});}
      return receipts.get(input.params.requestId);
    }
    if(method==='call'&&input.method==='request') return receipts.get(input.params.requestId);
  },close(){closed=true;}};
  const server=await startCoordinator({directory,service,version:'fixture'});
  const options={directory},one=new CoordinatorClient(options),two=new CoordinatorClient(options);
  try {
    const outcomes=await Promise.all([one,two].map(client=>client.request('call',{method:'submit',params:{requestId:'same',message:'你好世界🌏'}})));
    assert.deepEqual(outcomes[0],outcomes[1]);assert.equal(nativeCalls,1);assert.equal(one.info.pid,two.info.pid);
    one.close();two.close();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(closed,false);
    const reopened=new CoordinatorClient(options);assert.deepEqual(await reopened.request('call',{method:'request',params:{requestId:'same'}}),outcomes[0]);reopened.close();
    const intruder=net.connect(endpoint(directory));
    await new Promise(resolve=>intruder.once('connect',resolve));
    const disconnected=new Promise(resolve=>intruder.once('close',resolve));intruder.write(JSON.stringify({protocol:2,coordinatorId:server.owner.coordinatorId,auth:'wrong'})+'\n');
    await disconnected;
    await assert.rejects(startCoordinator({directory,service:{dispatch(){},close(){}},version:'fixture'}),{code:'EADDRINUSE'});
    if(process.platform!=='win32') assert.equal(fs.statSync(path.join(directory,'coordinator-identity.json')).mode&0o777,0o600);
  } finally {one.close();two.close();await server.close();fs.rmSync(directory,{recursive:true,force:true});}
});
test('coordinator source identity survives restart and local UTF8 frames remain complete',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-i06-identity-'));
  const service={dispatch:(method,params)=>params,close(){}};
  let server=await startCoordinator({directory,service,version:'fixture'});
  const owner=server.owner.coordinatorId;
  try {
    const client=new CoordinatorClient({directory});assert.equal(await client.request('echo','中文🌏'), '中文🌏');client.close();
    await server.close();server=await startCoordinator({directory,service,version:'fixture'});assert.equal(server.owner.coordinatorId,owner);
  } finally {await server.close();fs.rmSync(directory,{recursive:true,force:true});}
});

test('explicit shutdown closes coordination while ordinary client close leaves it running',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-i06-shutdown-'));
  let closed=false;
  const server=await startCoordinator({directory,version:'fixture',service:{dispatch(){return {alive:true};},close(){closed=true;}}});
  const client=new CoordinatorClient({directory});
  try{
    assert.deepEqual(await client.request('ping'),{alive:true});
    client.close();
    assert.equal(closed,false);
    assert.deepEqual(await client.request('shutdown'),{stopping:true});
    const deadline=Date.now()+3000;
    while((!closed||client.socket)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
    assert.equal(closed,true);assert.equal(server.server.listening,false);
    assert.equal(client.socket,null);
  }finally{client.close();if(server.server.listening)await server.close();fs.rmSync(directory,{recursive:true,force:true});}
});
