import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { initOpenCode, loadConfig, opencodeSchema } from '../src/config.js';
import { OpenCodeDriver } from '../src/drivers/opencode.js';
import { OpenCodeClient } from '../src/drivers/opencode-client.js';
import { startHub } from '../src/hub.js';
import { startEdge } from '../src/edge.js';
import { request } from '../src/client.js';
import { terminal, type Task, type TaskEvent, type NativeReference } from '../src/core.js';
import type { Operation } from '../src/storage/operations.js';
import { v1Fixture } from './opencode-v1-fixture.js';

async function until<T>(read:()=>Promise<T|false>):Promise<T>{
  const end=Date.now()+10000;
  do{const result=await read();if(result!==false)return result;await delay(20);}while(Date.now()<end);
  throw Error('v1 fixture timed out');
}
async function harness(){
  const root=mkdtempSync(resolve(tmpdir(),'ab-v1-')),dir=resolve(root,'bridge'),native=await v1Fixture(root);
  initOpenCode(dir,root);
  const edgeFile=resolve(dir,'edge-a.json'),raw=JSON.parse(readFileSync(edgeFile,'utf8'));
  Object.assign(raw.agents[0],{serverUrl:native.url,managed:false,pollMs:50,inheritNativeCli:true});
  writeFileSync(edgeFile,JSON.stringify(raw));writeFileSync(resolve(dir,'native.password'),native.password);
  const hc=loadConfig(resolve(dir,'hub.json'),'hub');hc.port=0;const hub=await startHub(hc,()=>{});
  const client=loadConfig(resolve(dir,'client.json'),'client');client.hubUrl='http://127.0.0.1:'+hub.port;
  const ec=loadConfig(edgeFile,'edge');ec.hubUrl=client.hubUrl;ec.heartbeatMs=100;
  let edge=await startEdge(ec,()=>{});
  const read=(id:string)=>request<Task>(client,'/v1/tasks/'+id);
  return {root,native,client,ec,read,
    submit:(message:string,conversationId?:string,requestId=randomUUID())=>request<Task>(client,'/v1/tasks',{requestId,message,conversationId,targetAgent:'opencode'}),
    finish:(task:Task)=>until(async()=>{const t=await read(task.taskId);return terminal(t.status)?t:false;}),
    active:(task:Task)=>until(async()=>{const t=await read(task.taskId);return t.native&&t.status==='running'?t:false;}),
    async restart(){await edge.close();edge=await startEdge(ec,()=>{});},
    async close(){await edge.close();await hub.close();await native.close();rmSync(root,{recursive:true,force:true});}};
}

test('v1 production Hub/Edge runs and continues one server-generated Session; restart only reads original IDs',async()=>{
  const h=await harness();try{
    const first=await h.finish(await h.submit('first'));assert.equal(first.status,'succeeded');assert.equal(first.result?.message,'answer: first');
    assert.equal(first.native?.snapshot?.nativeProtocol,'v1');assert.equal(first.native?.sessionId,'ses_server_1');
    const second=await h.finish(await h.submit('second',first.conversationId));assert.equal(second.status,'succeeded');
    assert.equal(second.result?.message,'answer: second');assert.equal(second.native?.sessionId,first.native?.sessionId);
    await h.restart();assert.deepEqual(await h.read(first.taskId),first);assert.equal(h.native.counts.prompts,2);assert.equal(h.native.counts.creates,1);
    const config=h.ec.agents[0]!;assert(config.adapter==='opencode');
    const reader=new OpenCodeDriver(config,()=>assert.fail('read invoked'),()=>assert.fail('read rebound'));
    assert.equal((await reader.inspect(first.native!)).outcome,'succeeded');
    await assert.rejects(reader.inspect({...first.native!,snapshot:{...first.native!.snapshot!,nativeProtocol:undefined}}),{code:'NATIVE_BINDING'});
  }finally{await h.close();}
});

test('v1 cancel receipt is separate from original-turn abort evidence, dedupes and recovers without reissuing',async()=>{
  const h=await harness();try{
    h.native.delayAbort();const active=await h.active(await h.submit('wait')),operationId=randomUUID();
    const input={taskId:active.taskId,executionId:active.executionId,operationId,action:'cancel'};
    const cancel=()=>request<Operation>(h.client,'/v1/tasks/'+active.taskId+'/cancel',input);
    assert.equal((await cancel()).state,'confirmed');assert.equal(h.native.counts.aborts,1);
    await delay(100);assert.equal((await h.read(active.taskId)).status,'running');
    await h.restart();assert.equal((await cancel()).state,'confirmed');assert.equal(h.native.counts.aborts,1);
    h.native.finish(active.native!.sessionId,'interrupted');assert.equal((await h.finish(active)).status,'cancelled');
    assert.equal(h.native.counts.prompts,1);
  }finally{await h.close();}
});

test('v1 permission and question replies use native request IDs and retain single-operation receipts',async()=>{
  const h=await harness();try{
    for(const mode of ['permission','question']){
      const task=await h.submit(mode),active=await until(async()=>{const t=await h.read(task.taskId);return t.waiting?t:false;});
      const form=mode==='question';
      const input={taskId:task.taskId,executionId:task.executionId,action:form?'form':'permission',operationId:randomUUID(),requestId:active.waiting!.requestIds[0],...(form?{answer:{'0':'A'}}:{decision:'once'})};
      if(form){
        const rejected=await request<Operation>(h.client,'/v1/tasks/'+task.taskId+'/reply',{...input,operationId:randomUUID(),answer:{'0':'foreign'}});
        assert.equal(rejected.state,'rejected');assert.equal(h.native.counts.replies,1);
      }
      const reply=()=>request<Operation>(h.client,'/v1/tasks/'+task.taskId+'/reply',input);
      assert.equal((await reply()).state,'confirmed');assert.equal((await reply()).state,'confirmed');
      assert.equal((await h.finish(task)).status,'succeeded');
    }
    assert.equal(h.native.counts.replies,2);assert.equal(h.native.counts.prompts,2);
  }finally{await h.close();}
});

test('v1 lost prompt acknowledgement recovers original binding; lost session creation never sends a Prompt',async t=>{
  const root=mkdtempSync(resolve(tmpdir(),'ab-v1-lost-')),native=await v1Fixture(root);
  t.after(async()=>{await native.close();rmSync(root,{recursive:true,force:true});});
  const passwordFile=resolve(root,'secret');writeFileSync(passwordFile,native.password);
  const config=opencodeSchema.parse({adapter:'opencode',agentId:'a',name:'A',workspace:root,serverUrl:native.url,passwordFile,pollMs:50});
  const bindings:NativeReference[]=[];let invocations=0;
  const driver=new OpenCodeDriver(config,()=>{invocations++;},(_,ref)=>bindings.push(structuredClone(ref)));
  native.losePrompt();const execution={taskId:'t',executionId:'e',conversationId:'c',targetAgent:'a',message:'answer'};
  await assert.rejects(async()=>{for await(const event of driver.execute(execution)){ assert.notEqual(event.kind,'completed'); }},{code:'NATIVE_UNAVAILABLE'});
  assert.equal(bindings.length,1);assert.equal(native.counts.prompts,1);
  const reopened=new OpenCodeDriver(config,()=>assert.fail('replay'),()=>assert.fail('rebind')),events:TaskEvent[]=[];
  for await(const e of reopened.observe(execution,bindings[0]!,undefined,[],true))events.push(e);
  assert.equal(events.at(-1)?.kind,'completed');assert.equal(native.counts.prompts,1);
  native.loseCreate();await assert.rejects(async()=>{for await(const event of driver.execute({...execution,executionId:'e2'})){ assert.notEqual(event.kind,'completed'); }},{code:'NATIVE_UNAVAILABLE'});
  assert.equal(bindings.length,1);assert.equal(native.counts.prompts,1);assert.equal(native.counts.creates,2);assert.equal(invocations,2);
});

test('v1 incomplete or tool-only output and missing inputs never release the original occupancy',async()=>{
  const h=await harness();try{
    const task=await h.active(await h.submit('wait')),config=h.ec.agents[0]!;assert(config.adapter==='opencode');
    const reader=new OpenCodeDriver(config,()=>assert.fail(),()=>assert.fail()),session=h.native.sessions.get(task.native!.sessionId)!;
    // The native binding is persisted before prompt dispatch. Wait for the
    // fixture's assistant message before simulating its incomplete output.
    const assistant=await until(async()=>session.messages.find(message=>message.info.role==='assistant')||false);
    session.done=true;assistant.info.time.completed=Date.now();assistant.info.finish='tool-calls';
    assert.equal((await reader.inspect(task.native!)).outcome,undefined);
    assistant.info.finish='stop';assistant.parts.push({type:'tool',state:{status:'running'}});
    assert.equal((await reader.inspect(task.native!)).outcome,undefined);
    assistant.parts.pop();assistant.info.parentID='foreign';await assert.rejects(reader.inspect(task.native!),{code:'NATIVE_CONTRACT'});
    session.messages.shift();await assert.rejects(reader.inspect(task.native!),{code:'NATIVE_INPUT_MISSING'});
    assert.equal(h.native.counts.prompts,1);
    const client=new OpenCodeClient(config);await client.check();assert.equal(client.protocol,'v1');
  }finally{await h.close();}
});
