/** Real official 1.x binary + controlled local model transport. No real account/model claims. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createSocket } from 'node:net';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { opencodeSchema } from '../src/config.js';
import { startNativeServer } from '../src/native-server.js';
import { OpenCodeDriver } from '../src/drivers/opencode.js';
import { OpenCodeClient } from '../src/drivers/opencode-client.js';
import type { NativeReference, TaskEvent } from '../src/core.js';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';

const [executable, runDirectory] = process.argv.slice(2);
if (!executable || !runDirectory) throw Error('Usage: node --import tsx scripts/opencode-v1-acceptance.ts EXECUTABLE NEW_RUN_DIRECTORY');
const directory = resolve(runDirectory), reportFile = resolve(directory, 'report.json');
mkdirSync(directory, {recursive:true});
// A rerun never invents new IDs or replays a previously intended model request.
if (existsSync(reportFile)) throw Error('This acceptance run already exists. Preserve its report and query its original binding; do not replay.');
const report: {date:string;kind:string;status:string;version?:string;checks:string[];requests:number;invocations:number;bindings:NativeReference[];error?:string} = {
  date:new Date().toISOString(),kind:'official-opencode-v1-controlled-model',status:'running',checks:[],requests:0,invocations:0,bindings:[],
};
const save = () => writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n',{mode:0o600});
save();
// Fully isolated native config/state; credentials and native logs never enter the report.
process.env.HOME=directory;
for (const [key,name] of Object.entries({XDG_CONFIG_HOME:'config',XDG_DATA_HOME:'data',XDG_STATE_HOME:'state',XDG_CACHE_HOME:'cache'})) {
  process.env[key]=resolve(directory,name);mkdirSync(process.env[key]!,{recursive:true});
}
delete process.env.OPENCODE_CONFIG; delete process.env.OPENCODE_CONFIG_CONTENT; delete process.env.OPENCODE_CONFIG_DIR;
process.env.OPENCODE_DISABLE_AUTOUPDATE='1';process.env.OPENCODE_DISABLE_MODELS_FETCH='1';
const workspace=resolve(directory,'workspace');mkdirSync(workspace,{recursive:true});
let held=false;
const model=createServer((req,res)=>{void(async()=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const input=JSON.parse(Buffer.concat(chunks).toString());
  report.requests++;save();
  const hold=JSON.stringify(input.messages.at(-1)).includes('hold this turn');
  res.writeHead(200,{'content-type':'text/event-stream'});
  const event=(delta:unknown,reason:string|null)=>res.write('data: '+JSON.stringify({id:'fixture',object:'chat.completion.chunk',created:Math.floor(Date.now()/1000),model:'fixture',choices:[{index:0,delta,finish_reason:reason}]})+'\n\n');
  event({role:'assistant',content:'native controlled reply '+report.requests},null);
  if(hold){held=true;return;}
  event({},'stop');res.end('data: [DONE]\n\n');
})().catch(()=>{res.destroy();});});
await new Promise<void>(done=>model.listen(0,'127.0.0.1',done));
const modelPort=(model.address() as {port:number}).port;
const nativeConfig={model:'fixture/fixture',provider:{fixture:{npm:'@ai-sdk/openai-compatible',name:'Controlled local transport',options:{baseURL:'http://127.0.0.1:'+modelPort+'/v1',apiKey:'synthetic-local-only'},models:{fixture:{name:'Fixture',limit:{context:32768,output:1024}}}}},permission:{'*':'deny'}};
mkdirSync(resolve(directory,'config/opencode'),{recursive:true});writeFileSync(resolve(directory,'config/opencode/opencode.json'),JSON.stringify(nativeConfig));
const socket=createSocket();await new Promise<void>(done=>socket.listen(0,'127.0.0.1',done));const port=(socket.address() as {port:number}).port;await new Promise<void>(done=>socket.close(()=>done()));
const config=opencodeSchema.parse({adapter:'opencode',agentId:'native-v1',name:'Native V1',executable:resolve(executable),workspace,
  serverUrl:'http://127.0.0.1:'+port,passwordFile:resolve(directory,'native.password'),inheritNativeCli:true,pollMs:50,taskTimeoutMs:20000});
const {CollaborationBroker}=createRequire(import.meta.url)('../desktop/electron/collaboration-broker.cjs');
const broker=new CollaborationBroker(resolve(directory,'broker'),async()=>({items:[]}));
const mcp=await broker.configure('native-v1',{nodeId:'native-v1',parentRequestId:'controlled-v1'});
writeFileSync(resolve(directory,'bridge-mcp.json'),JSON.stringify({mcp:{servers:{agentbridge:{type:'local',command:[mcp.command,...mcp.args],environment:mcp.env,codemode:false}}}}),{mode:0o600});
let server:Awaited<ReturnType<typeof startNativeServer>>|undefined;
try{
  server=await startNativeServer(config);
  const client=new OpenCodeClient(config),check=await client.check();report.version=check.version;
  assert.equal(check.healthy,true);assert.equal(client.protocol,'v1');assert.equal(check.model?.id,'fixture');
  report.checks.push('official binary startup, authenticated v1 probe and inherited native model');save();
  const deadline=Date.now()+10000;let mcpConnected=false;
  do{
    const status=await client.call<Record<string,{status:string}>>('/mcp?directory='+encodeURIComponent(workspace));
    mcpConnected=status.agentbridge?.status==='connected';if(!mcpConnected)await delay(100);
  }while(!mcpConnected&&Date.now()<deadline);
  assert(mcpConnected,'native v1 did not connect to the production Bridge MCP broker');
  report.checks.push('v1 MCP config injection connects the production Bridge broker');save();
  const driver=new OpenCodeDriver(config,()=>{report.invocations++;save();},(_,reference)=>{report.bindings.push(structuredClone(reference));save();});
  const execution=(i:number,message:string,resumeNative?:NativeReference)=>({executionId:'execution-'+i,taskId:'task-'+i,conversationId:'conversation-v1',targetAgent:'native-v1',message,resumeNative});
  async function turn(i:number,message:string,previous?:NativeReference){
    // Save intent before the first native mutation, not after the final result.
    writeFileSync(resolve(directory,'intent-'+i+'.json'),JSON.stringify(execution(i,message,previous)),{flag:'wx',mode:0o600});
    const events:TaskEvent[]=[];
    for await(const event of driver.execute(execution(i,message,previous)))events.push(event);
    assert.equal(events.at(-1)?.kind,'completed');
    return report.bindings.at(-1)!;
  }
  const first=await turn(1,'first controlled turn'),second=await turn(2,'second controlled turn',first);
  assert.equal(first.sessionId,second.sessionId);assert.notEqual(first.messageId,second.messageId);
  report.checks.push('two successful turns share the original server-generated session');save();
  const reused=await startNativeServer(config);assert.equal(reused.reused,true);assert.equal(reused.pid,server.pid);
  const reader=new OpenCodeDriver(config,()=>assert.fail('unexpected replay'),()=>assert.fail('unexpected rebind'));
  assert.equal((await reader.inspect(first)).outcome,'succeeded');assert.equal((await reader.inspect(second)).outcome,'succeeded');
  const before=report.requests;
  for(let i=0;i<3;i++)await reader.inspect(second);
  assert.equal(report.requests,before);report.checks.push('owned server reuse and fresh observer read only original IDs without replay');save();
  writeFileSync(resolve(directory,'intent-3.json'),JSON.stringify(execution(3,'hold this turn',second)),{flag:'wx',mode:0o600});
  let interrupted=false;
  const cancellation=(async()=>{
    const deadline=Date.now()+15000;
    while(!held&&Date.now()<deadline)await delay(25);
    assert(held,'controlled stream did not begin');
    writeFileSync(resolve(directory,'cancel-intent.json'),JSON.stringify(report.bindings.at(-1)),{flag:'wx',mode:0o600});
    const receipt=await driver.client.interrupt(report.bindings.at(-1)!.sessionId);assert.equal(receipt.interrupted,true);interrupted=true;
  })().then(()=>undefined,error=>error);
  for await(const event of driver.execute(execution(3,'hold this turn',second))){
    if(event.kind==='cancelled'){report.checks.push('abort receipt followed by original native MessageAbortedError');break;}
  }
  const cancelError=await cancellation;if(cancelError)throw cancelError;
  assert(interrupted);assert.equal((await reader.inspect(report.bindings.at(-1)!)).outcome,'interrupted');
  assert.equal(report.requests,3);assert.equal(report.invocations,3);
  assert.equal(JSON.parse(readFileSync(resolve(directory,'config/opencode/opencode.json'),'utf8')).model,'fixture/fixture');
  report.status='passed';save();
}catch(error){report.status='failed';report.error=error instanceof Error?error.message:'acceptance failed';save();throw error;}
finally{await server?.close();broker.close();model.closeAllConnections();await new Promise<void>(done=>model.close(()=>done()));}
console.log(JSON.stringify({status:report.status,version:report.version,checks:report.checks,modelRequests:report.requests}));
