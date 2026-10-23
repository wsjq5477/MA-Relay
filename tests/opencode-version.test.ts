import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {opencodeSchema} from '../src/config.js';
import {startNativeServer} from '../src/native-server.js';

test('saved OpenCode 3.x rejects before serve, credentials or native identity changes',async t=>{
 const root=mkdtempSync(resolve(tmpdir(),'ab-old-opencode-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const executable=resolve(root,'native.cjs'),trace=resolve(root,'serve-called'),passwordFile=resolve(root,'password');
 writeFileSync(executable,`if(process.argv.includes('--version')){console.log('opencode 3.0.0');process.exit(0);}require('node:fs').writeFileSync(${JSON.stringify(trace)},'serve');process.exit(0);`,{mode:0o700});writeFileSync(passwordFile,'original-owned-secret');
 const config=opencodeSchema.parse({agentId:'old',name:'Old',adapter:'opencode',workspace:root,executable,passwordFile,serverUrl:'http://127.0.0.1:31999'}),started=Date.now();
 await assert.rejects(startNativeServer(config),e=>(e as {code?:string}).code==='NATIVE_VERSION'&&String((e as Error).message).includes('1.x'));
 assert(Date.now()-started<3000);assert.equal(existsSync(trace),false);assert.equal(readFileSync(passwordFile,'utf8'),'original-owned-secret');
});

test('a listening OpenCode 2 launcher reports API absence and auth failure without consuming the startup budget',async t=>{
 const root=mkdtempSync(resolve(tmpdir(),'ab-api-fast-fail-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const {createServer}=await import('node:net');
 for(const [status,body,code] of [[404,'{}','OPENCODE_API_UNSUPPORTED'],[401,'{}','OPENCODE_HTTP_401'],[403,'{}','OPENCODE_HTTP_403'],[500,'{}','OPENCODE_HTTP_500'],[503,'{}','OPENCODE_HTTP_503'],[200,'bad-json','OPENCODE_API_UNSUPPORTED']] as const){
  const socket=createServer();await new Promise<void>(done=>socket.listen(0,'127.0.0.1',done));const port=(socket.address() as {port:number}).port;await new Promise<void>(done=>socket.close(()=>done()));
  const executable=resolve(root,'cli-'+status+'-'+code+'.cjs');writeFileSync(executable,`if(process.argv.includes('--version')){console.log('opencode 2.0.24');process.exit(0);}require('node:http').createServer((req,res)=>{res.statusCode=${status};res.setHeader('content-type','application/json');res.end(${JSON.stringify(body)});}).listen(+process.argv[process.argv.indexOf('--port')+1],'127.0.0.1');`,{mode:0o700});
  const config=opencodeSchema.parse({agentId:'a',name:'A',adapter:'opencode',workspace:root,executable,passwordFile:resolve(root,'password-'+port),serverUrl:'http://127.0.0.1:'+port});const start=Date.now();await assert.rejects(startNativeServer(config),{code});assert(Date.now()-start<3000,'deterministic API failure must not wait 20 seconds');
 }
});

test('production controller restores saved unsupported 3.x settings as an explicit version error without serve or changing the original Agent',async t=>{
 const root=mkdtempSync(resolve(tmpdir(),'ab-old-controller-')),directory=resolve(root,'profile'),executable=resolve(root,'old.cjs'),trace=resolve(root,'serve');
 const {SettingsStore}=await import('../src/settings.js'),{DesktopHost}=await import('../src/desktop-host.js'),{ipc}=await import('../src/controller.js');
 t.after(async()=>{try{await ipc(directory,{op:'stop'});}catch{}for(let i=0;i<100;i++){try{await ipc(directory,{op:'status'});}catch{break;}await new Promise(r=>setTimeout(r,20));}rmSync(root,{recursive:true,force:true});});
 writeFileSync(executable,`if(process.argv.includes('--version')){console.log('opencode 3.0.0');process.exit(0);}require('node:fs').writeFileSync(${JSON.stringify(trace)},'unexpected');`,{mode:0o700});
 const store=new SettingsStore(directory),base=store.initialize(),agent=store.normalize({adapter:'opencode',agentId:'original-agent',name:'Original',workspace:root,executable,serverUrl:'http://127.0.0.1:31998',passwordFile:resolve(directory,'original-password'),managed:true,enabled:true},base.deviceId);store.write({...base,agents:[agent],defaultAgent:agent.agentId,revision:base.revision+1},base.revision);const original=JSON.stringify(store.read().agents);writeFileSync(agent.passwordFile,'unchanged-original');
 const snapshot=await new DesktopHost(directory).handle({id:'read',method:'snapshot'}) as {agents:{items:{agentId:string;startupError?:{code:string;message:string}}[]}};
 assert.equal(snapshot.agents.items[0]!.agentId,'original-agent');assert.equal(snapshot.agents.items[0]!.startupError?.code,'NATIVE_VERSION');assert.equal(existsSync(trace),false);assert.equal(readFileSync(agent.passwordFile,'utf8'),'unchanged-original');assert.equal(JSON.stringify(store.read().agents),original);
});

test('issue21: managed early v1 starts despite hanging api/info; version check uses the original executable',async t=>{
 const root=mkdtempSync(resolve(tmpdir(),'ab-start-v1-hang-'));const owned:{handle?:Awaited<ReturnType<typeof startNativeServer>>}={};t.after(async()=>{await owned.handle?.close();rmSync(root,{recursive:true,force:true});});
 const {createServer}=await import('node:net');const socket=createServer();await new Promise<void>(done=>socket.listen(0,'127.0.0.1',done));const port=(socket.address() as {port:number}).port;await new Promise<void>(done=>socket.close(()=>done()));
 const executable=resolve(root,'original.cjs'),trace=resolve(root,'requests.jsonl');
 writeFileSync(executable,`const fs=require('node:fs');if(process.argv.includes('--version')){console.log('opencode 1.2.22.h0.r1');process.exit(0);}require('node:http').createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;fs.appendFileSync(${JSON.stringify(trace)},JSON.stringify({method:req.method,path:p})+'\\n');if(p==='/api/info')return;res.setHeader('content-type','application/json');res.end(JSON.stringify(p==='/global/health'?{healthy:true,version:'1.2.22.h0.r1'}:p==='/agent'?[{name:'build'}]:p==='/config'?{model:'fixture/native'}:p==='/config/providers'?{providers:[{id:'fixture',models:{native:{id:'native'}}}],default:{fixture:'native'}}:p==='/permission'||p==='/question'?[]:{}));}).listen(+process.argv[process.argv.indexOf('--port')+1],'127.0.0.1');`,{mode:0o700});
 const config=opencodeSchema.parse({adapter:'opencode',agentId:'original',name:'Original',workspace:root,executable,passwordFile:resolve(root,'password'),serverUrl:'http://127.0.0.1:'+port});
 const started=Date.now(),handle=await startNativeServer(config);owned.handle=handle;assert(Date.now()-started<5000,'v1 must start well before 20 seconds');
 const {OpenCodeClient}=await import('../src/drivers/opencode-client.js');const client=new OpenCodeClient(config);assert.equal((await client.check()).version,'1.2.22.h0.r1');assert.equal(client.protocol,'v1');
 const reads=readFileSync(trace,'utf8').trim().split('\n').map(line=>JSON.parse(line));assert(reads.length>=7);assert(reads.every(r=>r.method==='GET'&&r.path!=='/api/info'));
});
