import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, promises as fs} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {spawn, type ChildProcess} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {WebSocketServer} from 'ws';
import {initDemo, loadConfig} from '../src/config.js';
import {envelope, type WireMessage} from '../src/protocol.js';

test('an event ACK timeout yields to reconnect, preserves the original outbox and invokes its task only once', {timeout:30000}, async t => {
  const root = mkdtempSync(resolve(tmpdir(),'ab-edge-ack-timeout-')), directory = resolve(root,'demo');
  initDemo(directory);
  const server = new WebSocketServer({port:0,host:'127.0.0.1'});
  await new Promise<void>(done => server.once('listening',done));
  const config = loadConfig(resolve(directory,'edge-a.json'),'edge');
  config.hubUrl = 'http://127.0.0.1:' + (server.address() as {port:number}).port;
  config.heartbeatMs = 100;
  config.agents = config.agents.map(agent => ({...agent,delayMs:20}));
  const file = resolve(root,'controlled-edge.json');
  writeFileSync(file,JSON.stringify(config),{mode:0o600,flag:'wx'});
  const execution = {taskId:randomUUID(),executionId:randomUUID(),conversationId:randomUUID(),targetAgent:'mock-a',message:'invoke once across an event ACK timeout'};
  const submission = {...envelope(),type:'task.submit',payload:execution};
  const deliveries: {generation:number;seq:number}[] = [];
  let registrations = 0, child: ChildProcess | undefined, stderr = '';
  const snapshots = new Map<string,(value:{outbox:number})=>void>();
  let exited: Promise<void> = Promise.resolve();
  server.on('connection',socket => {
    const generation = registrations + 1;
    socket.on('message',raw => {
      const message = JSON.parse(raw.toString()) as WireMessage;
      if (message.type === 'agent.register') {
        registrations++;
        socket.send(JSON.stringify({...envelope(),type:'message.ack',payload:{ackedMessageId:message.messageId}}));
        // Submit the exact same original envelope again after reconnect. Its
        // durable execution must not be invoked a second time.
        socket.send(JSON.stringify(submission));
      }
      if (message.type === 'task.event') {
        deliveries.push({generation,seq:message.payload.seq});
        // Keep the first transport open and deliberately lose its event ACK.
        if (generation > 1) socket.send(JSON.stringify({...envelope(),type:'message.ack',payload:{ackedMessageId:message.messageId}}));
      }
    });
    socket.on('error',() => {});
  });
  const until = async (probe:()=>boolean|Promise<boolean>, label:string, timeout=12000) => {
    const deadline = Date.now()+timeout;
    while(Date.now()<deadline) {if(await probe()) return; await delay(20);}
    assert.fail(label + '; registrations=' + registrations + '; ' + stderr);
  };
  try {
    child = spawn(process.execPath,['--import','tsx',resolve('tests/edge-timeout-child.ts'),file],{windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});
    child.stderr!.on('data',part => {stderr += part.toString();});
    child.on('message',(message:{id?:string;outbox:number}) => {if(message.id) snapshots.get(message.id)?.(message);});
    exited = new Promise<void>((done,reject) => {child!.once('error',reject);child!.once('close',() => done());});
    await until(() => deliveries.length>0,'original event was not sent');
    await until(() => registrations>=2,'ACK timeout starved the close/reconnect callbacks');
    await until(async () => {
      const id=randomUUID();
      const response = new Promise<{outbox:number}>(done => snapshots.set(id,done));
      child!.send({op:'snapshot',id});
      const result=await Promise.race([response,delay(1000).then(()=>undefined)]);
      snapshots.delete(id); return result?.outbox===0;
    },'original outbox was not acknowledged');
    assert.equal(registrations,2);
    assert.equal(deliveries.filter(item => item.seq===1).length,2);
    const replay = deliveries.filter(item => item.generation===2).map(item => item.seq);
    assert.deepEqual(replay,Array.from({length:replay.length},(_,index)=>index+1));
    child.send({op:'stop'}); await Promise.race([exited,delay(2000)]);
    assert.equal(child.exitCode,0,stderr);
    const db = new DatabaseSync(resolve(config.dataDir,'edge.sqlite'),{readOnly:true});
    try {
      const rows=db.prepare('SELECT task_id,execution_id,invocations,phase,seq,ack_seq FROM executions').all();
      assert.equal(rows.length,1);
      assert.equal(rows[0]!.task_id,execution.taskId);assert.equal(rows[0]!.execution_id,execution.executionId);
      assert.equal(rows[0]!.invocations,1);assert.equal(rows[0]!.phase,'terminal');
      assert.equal(rows[0]!.ack_seq,rows[0]!.seq);
      t.diagnostic('Original execution invoked once; contiguous event replay acknowledged after two transports.');
    } finally {db.close();}
  } finally {
    if(child && child.exitCode===null && child.signalCode===null) {child.kill('SIGKILL');await exited;}
    for(const client of server.clients) client.terminate();
    await new Promise<void>(done => server.close(() => done()));
    await fs.rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:100});
  }
});
