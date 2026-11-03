const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process'),{createInterface}=require('node:readline');
const {CollaborationBroker}=require('../electron/collaboration-broker.cjs');
test('real stdio MCP initializes, exposes scoped operations and authenticates its loopback dispatch without leaking identity into arguments',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-mcp-')),calls=[];
 const broker=new CollaborationBroker(directory,async(scope,name,args)=>{calls.push({scope,name,args});return {items:[{nodeId:'child',name:'子节点'}]};});
 const config=await broker.configure('context',{nodeId:'leader',parentRequestId:'parent'});assert(config.args.every(a=>!a.includes(broker.scopes[0].token)));
 const child=spawn(config.command,config.args,{env:{...process.env,...config.env},stdio:['pipe','pipe','pipe']});t.after(()=>{child.kill();broker.close();fs.rmSync(directory,{recursive:true,force:true});});
 const waiting=new Map(),lines=createInterface({input:child.stdout});lines.on('line',line=>{const v=JSON.parse(line);waiting.get(v.id)?.(v);waiting.delete(v.id);});let id=0;
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(Error('MCP timeout')),5000);waiting.set(n,v=>{clearTimeout(timer);resolve(v);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method,params})+'\n');});
 assert.equal((await send('initialize',{protocolVersion:'2025-03-26'})).result.serverInfo.name,'agentbridge');assert.equal((await send('tools/list')).result.tools.length,10);
 const result=await send('tools/call',{name:'list_agents',arguments:{nodeId:'forged'}});assert.match(result.result.content[0].text,/子节点/);assert.equal(calls[0].scope.nodeId,'leader');
 const descriptor=JSON.parse(fs.readFileSync(config.args[1]));assert.equal((await fetch(descriptor.url,{method:'POST',headers:{authorization:'Bearer '+'é'.repeat(descriptor.token.length)},body:'{}'})).status,403);
 await broker.configure('context',{nodeId:'leader',parentRequestId:'next'});await send('tools/call',{name:'list_agents',arguments:{}});assert.equal(calls[1].scope.parentRequestId,'next');
});

test('a newer real stdio client never sends continuation to a backend without live support evidence',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-mcp-continuation-gate-')),calls=[];let supports=false,revoked=false;
 const broker=new CollaborationBroker(directory,async(_scope,name)=>{calls.push(name);if(revoked)throw Object.assign(Error('Revoked'),{code:'COLLABORATION_FORBIDDEN'});return name==='list_agents'?{items:[],...(supports?{supportedOperations:['delegate.continue-v1']}:{})}:{taskId:'original-task'};});
 const config=await broker.configure('context',{nodeId:'leader',parentRequestId:'parent'});
 const child=spawn(config.command,config.args,{windowsHide:true,env:{...process.env,...config.env},stdio:['pipe','pipe','pipe']});
 t.after(()=>{child.kill();broker.close();fs.rmSync(directory,{recursive:true,force:true});});
 const waiting=new Map();createInterface({input:child.stdout}).on('line',line=>{const value=JSON.parse(line);waiting.get(value.id)?.(value);waiting.delete(value.id);});let id=0;
 const send=args=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(Error('MCP timeout')),5000);waiting.set(n,v=>{clearTimeout(timer);resolve(v.result);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method:'tools/call',params:{name:'delegate',arguments:args}})+'\n');});
 const args={nodeId:'child',requestId:'original-message',message:'Continue',conversationId:'original-session'};
 const refused=await send(args);assert.equal(refused.isError,true);assert.equal(JSON.parse(refused.content[0].text).error.code,'MCP_CONTINUATION_BACKEND_UPGRADE_REQUIRED');assert.deepEqual(calls,['list_agents']);
 supports=true;assert.equal(JSON.parse((await send(args)).content[0].text).taskId,'original-task');assert.deepEqual(calls,['list_agents','list_agents','delegate']);
 revoked=true;assert.equal(JSON.parse((await send(args)).content[0].text).error.code,'COLLABORATION_FORBIDDEN');assert.equal(calls.at(-1),'list_agents');assert.equal(calls.filter(n=>n==='delegate').length,1);
});
test('real stdio cancellation lookup refuses old brokers before any cancellation dispatch',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-mcp-cancel-query-gate-')),calls=[];let supports=false;
 const broker=new CollaborationBroker(directory,async(_scope,name,args)=>{calls.push({name,args});if(name==='list_agents')return {items:[],supportedOperations:supports?['cancel.query-v1']:[]};return {operationId:args.operationId,kind:'cancel',state:'unknown'};});
 const config=await broker.configure('context',{nodeId:'leader',parentRequestId:'parent'}),child=spawn(config.command,config.args,{windowsHide:true,env:{...process.env,...config.env},stdio:['pipe','pipe','pipe']});
 t.after(()=>{child.kill();broker.close();fs.rmSync(directory,{recursive:true,force:true});});
 const waiting=new Map();createInterface({input:child.stdout}).on('line',line=>{const value=JSON.parse(line);waiting.get(value.id)?.(value);waiting.delete(value.id);});let id=0;
 const send=args=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(Error('MCP timeout')),5000);waiting.set(n,v=>{clearTimeout(timer);resolve(v.result);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method:'tools/call',params:{name:'cancel_task',arguments:args}})+'\n');});
 const args={taskId:'original-task',operationId:'original-cancel',queryOnly:true};
 assert.equal(JSON.parse((await send(args)).content[0].text).error.code,'MCP_CANCEL_QUERY_BACKEND_UPGRADE_REQUIRED');assert.deepEqual(calls.map(c=>c.name),['list_agents']);
 for(const queryOnly of ['true',null,1])assert.equal(JSON.parse((await send({...args,queryOnly})).content[0].text).error.code,'INVALID_INPUT');assert.equal(calls.length,1);
 supports=true;assert.equal(JSON.parse((await send(args)).content[0].text).state,'unknown');assert.equal(calls.at(-1).args.queryOnly,true);
 supports=false;await send({...args,queryOnly:false});assert.equal(calls.at(-1).args.queryOnly,false);assert.equal(calls.filter(c=>c.name==='list_agents').length,2);
});
