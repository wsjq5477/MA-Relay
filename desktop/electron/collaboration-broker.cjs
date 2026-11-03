const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {randomBytes,randomUUID,timingSafeEqual}=require('node:crypto');
const fail=(code,message)=>Object.assign(new Error(message),{code});
class CollaborationBroker {
  constructor(directory,dispatch){this.directory=directory;this.dispatch=dispatch;this.file=path.join(directory,'bridge-scopes.json');this.scopes=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):[];this.ready=null;this.closed=false;}
  async start(){
    if(this.closed)throw fail('COLLABORATION_CLOSED','原协作入口已关闭。');
    if(this.ready)return this.ready;
    this.ready=new Promise((resolve,reject)=>{
      this.rejectReady=reject;
      this.server=http.createServer(async(req,res)=>{
        if(req.method!=='POST'||req.url!=='/tools'){res.writeHead(404).end();return;}
        const bearer=Buffer.from((req.headers.authorization||'').startsWith('Bearer ')?req.headers.authorization.slice(7):'');
        const scope=this.scopes.find(s=>Buffer.byteLength(s.token)===bearer.length&&timingSafeEqual(Buffer.from(s.token),bearer));
        if(!scope){res.writeHead(403).end();return;}
        req.setTimeout(65000);res.setTimeout(65000);
        try{let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>131072){res.writeHead(413).end();return;}chunks.push(chunk);}const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));const value=await this.dispatch({...scope.scope},input.name,input.args||{},input.callId);res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({result:value}));}
        catch(error){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({error:{code:error.code||'COLLABORATION_ERROR',message:error.message}}));}
      });this.server.once('error',reject);this.server.listen(0,'127.0.0.1',()=>{if(this.closed){this.server.close();reject(fail('COLLABORATION_CLOSED','原协作入口已关闭。'));return;}this.rejectReady=null;resolve(this.server.address().port);});this.server.unref();
    });return this.ready;
  }
  async configure(contextId,scope,options={}){
    const caller=!!scope?.callerContextId;
    if(caller?(!scope.principalId||!scope.credentialId||scope.nodeId||scope.parentRequestId):(!scope?.nodeId||!scope?.parentRequestId))throw fail('INVALID_INPUT','协作执行身份缺失或混用。');
    const scopeKey=caller?contextId+':'+scope.credentialId:scope.teamSessionId?contextId+':'+scope.teamSessionId:contextId;
    const port=await this.start();if(this.closed)throw fail('COLLABORATION_CLOSED','原协作入口已关闭。');options.assertCurrent?.();
    let entry=this.scopes.find(s=>(s.scopeKey||s.contextId)===scopeKey);if(!entry){entry={contextId,scopeKey,token:randomBytes(32).toString('base64url')};this.scopes.push(entry);}entry.scope={...scope};
    fs.mkdirSync(this.directory,{recursive:true});const tmp=this.file+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.scopes),{mode:0o600});fs.renameSync(tmp,this.file);
    const context=path.join(this.directory,'node-contexts',contextId);fs.mkdirSync(context,{recursive:true});const descriptor=path.join(context,scope.teamSessionId?'bridge-endpoint-'+scope.teamSessionId+'.json':'bridge-endpoint.json');
    require('./graph-layout.cjs').atomicWrite(descriptor,{url:'http://127.0.0.1:'+port+'/tools',token:entry.token,...(scope.teamSessionId?{mode:'team'}:caller?{mode:'caller'}:{})});
    const runtime=path.join(this.directory,'runtime');fs.mkdirSync(runtime,{recursive:true});for(const file of ['mcp-client.cjs','team-tools.cjs'])fs.copyFileSync(path.join(__dirname,file),path.join(runtime,file));
    const executable=require('./worker-runtime.cjs').workerRuntime(this.directory);
    return {command:executable,args:[path.join(runtime,'mcp-client.cjs'),descriptor],env:{ELECTRON_RUN_AS_NODE:'1'},...(scope.teamSessionId?{mode:'team',instructions:require('./team-tools.cjs').instructions,toolNames:require('./team-tools.cjs').teamTools.map(t=>t.name)}:{})};
  }
  close(){this.closed=true;this.rejectReady?.(fail('COLLABORATION_CLOSED','原协作入口已关闭。'));this.rejectReady=null;this.server?.close();}
}
module.exports={CollaborationBroker};
