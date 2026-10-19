import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {opencodeSchema} from '../src/config.js';
import {DesktopHost} from '../src/desktop-host.js';
import {ipc} from '../src/controller.js';
import {OpenCodeClient} from '../src/drivers/opencode-client.js';

test('enterprise CLI display versions are accepted only with the actual read-only API contract',async t=>{
 const root=mkdtempSync(resolve(tmpdir(),'ab-api-contract-'));let version='1.2.22.h0.r1',variant='compatible',writes=0;
 const server=createServer((req,res)=>{
  if(req.method!=='GET')writes++;
  res.setHeader('content-type','application/json');
  const route=new URL(req.url!,'http://localhost').pathname;
  if(variant==='wrong-api'){res.statusCode=404;res.end('{}');return;}
  const data=route==='/api/info'?{version}:route==='/api/model'?{data:variant==='malformed'?{}:[{id:'native',providerID:'inherited'}]}:route==='/api/model/default'?{data:{id:'native',providerID:'inherited'}}:route==='/api/agent'?{data:[{id:'build'}]}:[];
  res.end(JSON.stringify(data));
 });
 await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
 t.after(async()=>{server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));rmSync(root,{recursive:true,force:true});});
 const passwordFile=resolve(root,'password');writeFileSync(passwordFile,'synthetic');
 const client=new OpenCodeClient(opencodeSchema.parse({adapter:'opencode',agentId:'a',name:'A',workspace:root,serverUrl:'http://127.0.0.1:'+(server.address() as {port:number}).port,passwordFile,inheritNativeCli:true}));
 for(version of ['1.2.22.h0.r1','1.19.0','2.0.24'])assert.equal((await client.check()).healthy,true);
 for(variant of ['wrong-api','malformed'])await assert.rejects(client.check(),{code:'OPENCODE_API_UNSUPPORTED'});
 assert.equal(writes,0,'contract checks must not create sessions or send prompts');
});

test('DesktopHost connects the exact enterprise CLI through serve and rejects an incompatible API before any prompt',async t=>{
 const root=mkdtempSync(resolve(tmpdir(),'ab-enterprise-connect-'));const dirs:string[]=[];
 t.after(async()=>{for(const dir of dirs){try{await ipc(dir,{op:'stop'});}catch{} } await new Promise(r=>setTimeout(r,300));rmSync(root,{recursive:true,force:true});});
 for(const [version,compatible] of [['1.2.22.h0.r1',true],['1.19.0',true],['1.2.22.h0.r1',false]] as const){
  const dir=resolve(root,'context-'+dirs.length);dirs.push(dir);const executable=resolve(root,'cli-'+dirs.length+'.cjs');
  writeFileSync(executable,`const fs=require('node:fs');if(process.argv.includes('--version')){console.log('opencode ${version}');process.exit(0);}const port=+process.argv[process.argv.indexOf('--port')+1];require('node:http').createServer((req,res)=>{if(req.method!=='GET')fs.appendFileSync(${JSON.stringify(resolve(root,'mutations'))},req.url);res.setHeader('content-type','application/json');if(!${compatible}){res.statusCode=404;res.end('{}');return;}const route=new URL(req.url,'http://localhost').pathname;res.end(JSON.stringify(route==='/api/info'?{version:'${version}'}:route==='/api/agent'?{data:[{id:'build'}]}:route==='/api/model'?{data:[{id:'native',providerID:'inherited'}]}:route==='/api/model/default'?{data:{id:'native',providerID:'inherited'}}:route==='/api/config'?[{info:{model:'inherited/native'}}]:{}));}).listen(port,'127.0.0.1');`,{mode:0o700});
  const host=new DesktopHost(dir),connect=()=>host.handle({id:'connect',method:'connect',params:{executable,workspace:root,inheritNativeCli:true}});
  if(compatible){const result=await connect() as {agentId:string;check:{connection:string;nativeVersion:string}};assert(result.agentId);assert.equal(result.check.connection,'connected');assert.equal(result.check.nativeVersion,version);}
  else await assert.rejects(connect(),{code:'OPENCODE_API_UNSUPPORTED'});
 }
 const {existsSync}=await import('node:fs');assert.equal(existsSync(resolve(root,'mutations')),false);
});
