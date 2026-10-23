import { createServer } from 'node:http';
import assert from 'node:assert/strict';

// Official 1.19.3-shaped contract fixture, not native/model acceptance.
export async function v1Fixture(workspace: string, options: { hangInfo?: boolean } = {}) {
  type Message = { info: { id: string; sessionID: string; role: string; parentID?: string; finish?: string;
    time: { created: number; completed?: number }; error?: { name: string; data: { message: string } } };
    parts: { type: string; text?: string; tool?: string; state?: { status: string } }[] };
  const sessions = new Map<string, {id:string;directory:string;agent:string;model:unknown;messages:Message[];mode:string;done:boolean}>();
  const password = 'synthetic-v1-secret';
  const counts = {creates:0,prompts:0,aborts:0,replies:0,info:0,writes:0};
  let losePrompt = false, loseCreate = false, delayAbort = false, loseAbort = false;
  const finish = (id:string, outcome='succeeded') => {
    const s=sessions.get(id)!;s.done=true;
    const message=s.messages.at(-1)!;
    message.info.time.completed=Date.now();
    if(outcome==='succeeded')message.info.finish='stop';
    else message.info.error={name:outcome==='interrupted'?'MessageAbortedError':'APIError',data:{message:outcome}};
  };
  const server=createServer((req,res)=>{void(async()=>{
    const send=(status:number,body?:unknown)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));};
    if(req.headers.authorization!=='Basic '+Buffer.from('opencode:'+password).toString('base64'))return send(401,{});
    const url=new URL(req.url!,'http://localhost'),path=url.pathname;
    if(req.method !== 'GET')counts.writes++;
    if(path==='/api/info'){counts.info++;if(options.hangInfo)return;return send(404,{});}
    if(path==='/global/health')return send(200,{healthy:true,version:'1.19.3'});
    assert.equal(url.searchParams.get('directory'),workspace);
    let body:Record<string,unknown>={};
    if(req.method==='POST'){const chunks=[];for await(const c of req)chunks.push(c);body=JSON.parse(Buffer.concat(chunks).toString());}
    if(path==='/agent')return send(200,[{name:'build'}]);
    if(path==='/config')return send(200,{model:'fixture/model'});
    if(path==='/config/providers')return send(200,{providers:[{id:'fixture',models:{model:{id:'model'}}}],default:{fixture:'model'}});
    if(path==='/session/status')return send(200,Object.fromEntries([...sessions.values()].filter(s=>!s.done&&s.messages.length).map(s=>[s.id,{type:'busy'}])));
    if(path==='/permission')return send(200,[...sessions.values()].filter(s=>s.mode==='permission'&&!s.done).map(s=>({id:'per_'+s.id,sessionID:s.id,permission:'bash',patterns:['echo fixture']})));
    if(path==='/question')return send(200,[...sessions.values()].filter(s=>s.mode==='question'&&!s.done).map(s=>({id:'que_'+s.id,sessionID:s.id,questions:[{header:'Choice',question:'Pick one',custom:false,options:[{label:'A'},{label:'B'}]}]})));
    if(path==='/session'&&req.method==='POST'){
      counts.creates++;const id='ses_server_'+counts.creates;
      assert.equal(body.id,undefined,'v1 generates the session ID');
      sessions.set(id,{id,directory:workspace,agent:'build',model:body.model,messages:[],mode:'',done:false});
      if(loseCreate){loseCreate=false;req.socket.destroy();return;}
      return send(200,sessions.get(id));
    }
    const reply=/^\/(permission|question)\/((?:per|que)_(ses_server_\d+))\/reply$/.exec(path);
    if(reply){counts.replies++;if(reply[1]==='permission')assert.deepEqual(body,{reply:'once'});else assert.deepEqual(body,{answers:[['A']]});finish(reply[3]!);return send(200,true);}
    const match=/^\/session\/([^/]+)(.*)$/.exec(path),s=match&&sessions.get(match[1]!);
    if(!s)return send(404,{});
    const tail=match![2];
    if(tail==='/prompt_async'){
      counts.prompts++;s.mode=((body.parts as {text:string}[])[0]!.text);s.done=false;
      assert.equal(body.agent,'build');assert.deepEqual(body.model,{providerID:'fixture',modelID:'model'});
      const id=body.messageID as string;
      s.messages.push({info:{id,sessionID:s.id,role:'user',time:{created:Date.now()}},parts:body.parts as Message['parts']},
        {info:{id:'msg_assistant_'+counts.prompts,sessionID:s.id,role:'assistant',parentID:id,time:{created:Date.now()}},parts:[{type:'text',text:'answer: '+s.mode}]});
      if(!['wait','permission','question'].includes(s.mode))finish(s.id,s.mode==='failed'?'failed':'succeeded');
      if(losePrompt){losePrompt=false;req.socket.destroy();return;}
      return send(204);
    }
    if(tail==='/abort'){counts.aborts++;if(!delayAbort)finish(s.id,'interrupted');if(loseAbort){loseAbort=false;req.socket.destroy();return;}return send(200,true);}
    if(tail==='/message'){assert.equal(url.searchParams.has('limit'),false,'whole history must not silently omit early user inputs');return send(200,s.messages);}
    if(tail==='')return send(200,{id:s.id,directory:workspace,agent:s.agent,model:s.model});
    return send(404,{});
  })().catch(()=>{if(!res.headersSent)res.writeHead(500);res.end();});});
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  return {url:'http://127.0.0.1:'+(server.address() as {port:number}).port,password,sessions,counts,finish,
    losePrompt(){losePrompt=true;},loseCreate(){loseCreate=true;},delayAbort(){delayAbort=true;},loseAbort(){loseAbort=true;},
    async close(){server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));}};
}
