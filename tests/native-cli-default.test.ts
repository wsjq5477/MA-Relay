import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {opencodeSchema} from '../src/config.js';
import {OpenCodeClient} from '../src/drivers/opencode-client.js';

test('OpenCode node inherits CLI recent preference after native config, reads updates, and never writes or invents a model',async()=>{
 const directory=mkdtempSync(resolve(tmpdir(),'ab-cli-model-')),previous=process.env.XDG_STATE_HOME;
 process.env.XDG_STATE_HOME=directory;mkdirSync(resolve(directory,'opencode'));
 const file=resolve(directory,'opencode/model.json'),state={recent:[{providerID:'missing',modelID:'unavailable'},{providerID:'native',modelID:'DeepSeek'}],variant:{'native/DeepSeek':'medium'}};
 writeFileSync(file,JSON.stringify(state));
 let configured=false;
 class Client extends OpenCodeClient{
  override async call<T>(route:string):Promise<T>{
   const path=route.split('?')[0]!;
   const responses:Record<string,unknown>={'/api/agent':{data:[{id:'build'}]},'/api/info':{version:'2.0.24'},'/api/model/default':{data:{providerID:'native',id:'server-default'}},'/api/model':{data:[{providerID:'native',id:'server-default'},{providerID:'native',id:'DeepSeek'}]},'/api/config':[{info:configured?{model:'native/server-default'}:{}}]};
   assert(Object.hasOwn(responses,path));return responses[path] as T;
  }
 }
 const config=opencodeSchema.parse({agentId:'native',name:'Native',adapter:'opencode',workspace:directory,passwordFile:resolve(directory,'secret'),serverUrl:'http://127.0.0.1:1234',inheritNativeCli:true});
 try{
  const client=new Client(config),before=readFileSync(file,'utf8');assert.deepEqual((await client.check()).model,{providerID:'native',id:'DeepSeek',variant:'medium'});assert.equal(readFileSync(file,'utf8'),before);
  configured=true;assert.equal((await client.check()).model?.id,'server-default');configured=false;
  writeFileSync(file,JSON.stringify({recent:[{providerID:'native',modelID:'server-default'}]}));assert.equal((await client.check()).model?.id,'server-default');
  writeFileSync(file,'invalid');await assert.rejects(client.check(),{code:'NATIVE_CLI_STATE'});
  rmSync(file);assert.equal((await client.check()).model?.id,'server-default');
  writeFileSync(file,JSON.stringify(state));assert.equal((await new Client({...config,inheritNativeCli:undefined}).check()).model?.id,'server-default');
 }finally{if(previous===undefined)delete process.env.XDG_STATE_HOME;else process.env.XDG_STATE_HOME=previous;rmSync(directory,{recursive:true,force:true});}
});
