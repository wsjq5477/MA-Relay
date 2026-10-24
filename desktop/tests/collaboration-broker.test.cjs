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
