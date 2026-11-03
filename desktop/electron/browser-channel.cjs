'use strict';

const http=require('node:http');
const {randomUUID,randomBytes}=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');
const {BrowserPairing,sign,equal,derive,secret}=require('./browser-pairing.cjs');
const {PROTOCOL,fail,identity}=require('./browser-protocol.cjs');
const methods=new Set(['session.create','session.resume','session.close','message.prepare','message.send','request.get','operation.get','output.subscribe','task.cancel','health.check']);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
class BrowserChannel {
  constructor(options) {
    this.pairing=new BrowserPairing(options.directory,options.storage);
    this.options=options;this.clients=new Map();this.observers=new Map();this.sockets=new Set();
    this.server=http.createServer((_req,res)=>res.writeHead(404).end());
    this.wss=new WebSocketServer({noServer:true,maxPayload:1048576,perMessageDeflate:false});
    this.server.on('upgrade',(req,socket,head)=>{
      if(this.closed||this.sockets.size>=16||req.url!=='/browser/v1'||req.socket.remoteAddress!=='127.0.0.1'||!this.pairing.list().some(p=>p.origin===req.headers.origin&&p.state!=='revoked')) {socket.destroy();return;}
      this.wss.handleUpgrade(req,socket,head,ws=>this.accept(ws,req.headers.origin));
    });
  }
  async start() {
    if(this.closed)throw fail('ADAPTER_CLOSED','Browser channel is closed.');
    if(!this.starting)this.starting=new Promise((resolve,reject)=>{
      const onError=()=>reject(fail('BROWSER_ENDPOINT_UNAVAILABLE','Original browser endpoint cannot listen; no replacement address was selected.'));
      this.server.once('error',onError);
      let port;
      try {port=this.options.port??(this.options.durableEndpoint?require('./browser-endpoint.cjs').endpointPort(this.options.directory,this.pairing.state.nodeId):0);}
      catch(error){this.server.removeListener('error',onError);reject(error);return;}
      this.server.listen(port,'127.0.0.1',()=>{this.server.removeListener('error',onError);resolve(this.server.address().port);});
    });
    const port=await this.starting;return {url:'ws://127.0.0.1:'+port+'/browser/v1',nodeId:this.pairing.state.nodeId};
  }
  async createPair(extensionId,operationId) { const address=await this.start();return {...this.pairing.create(extensionId,operationId),...address}; }
  revoke(pairingId) {const result=this.pairing.revoke(pairingId);for(const session of this.clients.values())if(session.pair.pairingId===pairingId)session.ws.terminate();return result;}
  forInstance(browserInstanceId) {
    if(!identity(browserInstanceId))throw fail('INVALID_INPUT','Invalid browser instance.');
    const self=this;
    return {
      get online(){return self.clients.get(browserInstanceId)?.committed===true;},
      knownProfiles:()=>self.pairing.list().filter(p=>p.state==='committed').map(p=>p.browserInstanceId),
      request:(method,params)=>self.request(browserInstanceId,method,params),
      subscribe:(executionId,handler,onDisconnect)=>{
        const key=browserInstanceId+':'+executionId;
        if(!identity(executionId)||typeof handler!=='function'||self.observers.has(key))throw fail('BROWSER_OBSERVER_CONFLICT','Execution already has a browser observer.');
        const row={browserInstanceId,handler,onDisconnect};self.observers.set(key,row);
        return ()=>{if(self.observers.get(key)===row)self.observers.delete(key);};
      }
    };
  }
  send(session,body) {
    if(session.ws.readyState!==WebSocket.OPEN||session.ws.bufferedAmount>4*1024*1024)throw fail('BROWSER_OFFLINE','Browser transport is unavailable.');
    const envelope={protocol:PROTOCOL,connectionEpoch:session.epoch,frameSeq:++session.outSeq,body};
    session.ws.send(JSON.stringify({...envelope,mac:sign(session.key,{direction:'node',...envelope})}));
  }
  request(instance,method,params) {
    const session=this.clients.get(instance);
    if(!session?.committed) return Promise.reject(fail('BROWSER_OFFLINE','Authenticated browser is offline.'));
    if(!methods.has(method)||!object(params)||params.browserInstanceId!==instance)return Promise.reject(fail('INVALID_INPUT','Browser request target or method is invalid.'));
    if(session.pending.size>=32)return Promise.reject(fail('BROWSER_BUSY','Browser transport request limit reached.'));
    const id=randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{session.pending.delete(id);reject(fail('BROWSER_REQUEST_UNKNOWN','Browser response timed out; query the original request.'));},this.options.requestTimeoutMs??20000);
      session.pending.set(id,{resolve,reject,timer});
      try {this.send(session,{kind:'command',id,method,params});}
      catch(error){clearTimeout(timer);session.pending.delete(id);reject(error);}
    });
  }
  accept(ws,origin) {
    this.sockets.add(ws);
    const s={ws,origin,pending:new Map(),inSeq:0,outSeq:0,queue:Promise.resolve(),queued:0,lastSeen:Date.now(),committed:false};
    const deadline=setTimeout(()=>ws.terminate(),this.options.authTimeoutMs??5000);
    const heartbeat=setInterval(()=>{if(Date.now()-s.lastSeen>(this.options.idleTimeoutMs??65000))ws.terminate();},20000);heartbeat.unref();
    ws.on('error',()=>{});
    ws.on('close',()=>{
      this.sockets.delete(ws);clearTimeout(deadline);clearInterval(heartbeat);
      for(const job of s.pending.values()){clearTimeout(job.timer);job.reject(fail('BROWSER_REQUEST_UNKNOWN','Browser disconnected; query the original request.'));}s.pending.clear();
      if(s.pair&&this.clients.get(s.pair.browserInstanceId)===s){this.clients.delete(s.pair.browserInstanceId);for(const row of this.observers.values())if(row.browserInstanceId===s.pair.browserInstanceId)Promise.resolve().then(()=>row.onDisconnect?.()).catch(()=>{});}
    });
    ws.on('message',(raw,binary)=>{
      if(binary||++s.queued>64){ws.terminate();return;}
      s.queue=s.queue.then(async()=>{
        if(ws.readyState!==WebSocket.OPEN)return;
        const frame=JSON.parse(raw.toString());
        if(!s.pair) {
          if(!object(frame)||Object.keys(frame).some(k=>!['kind','protocol','pairingId','clientNonce','mode'].includes(k))||frame.kind!=='hello'||frame.protocol!==PROTOCOL||!secret(frame.clientNonce))throw Error('Invalid hello.');
          s.pair=this.pairing.authenticate(frame.pairingId,origin,frame.mode);s.mode=frame.mode;
          s.transcript={protocol:PROTOCOL,nodeId:this.pairing.state.nodeId,pairingId:s.pair.pairingId,browserInstanceId:s.pair.browserInstanceId,origin,mode:s.mode,clientNonce:frame.clientNonce,serverNonce:randomBytes(32).toString('hex'),connectionEpoch:randomUUID()};
          ws.send(JSON.stringify({kind:'challenge',...s.transcript,proof:sign(s.pair.authKey,{role:'node',...s.transcript})}));return;
        }
        if(!s.key) {
          if(!object(frame)||Object.keys(frame).some(k=>!['kind','proof'].includes(k))||frame.kind!=='authenticate'||!equal(frame.proof,sign(s.pair.authKey,{role:'extension',...s.transcript})))throw Error('Invalid proof.');
          // Recheck revocation after the challenge was issued.
          s.pair=this.pairing.authenticate(s.pair.pairingId,origin,s.mode);
          s.key=derive(s.pair.authKey,{purpose:'connection',...s.transcript});s.epoch=s.transcript.connectionEpoch;
          clearTimeout(deadline);
          s.committed=s.mode==='resume'&&s.pair.state==='committed';
          if(s.committed)this.activate(s);
          this.send(s,{kind:'ready',pairingId:s.pair.pairingId,browserInstanceId:s.pair.browserInstanceId,committed:s.committed});return;
        }
        if(!object(frame)||Object.keys(frame).some(k=>!['protocol','connectionEpoch','frameSeq','body','mac'].includes(k))||frame.protocol!==PROTOCOL||frame.connectionEpoch!==s.epoch||frame.frameSeq!==s.inSeq+1||!object(frame.body))throw Error('Invalid frame.');
        const {mac,...envelope}=frame;
        if(!equal(mac,sign(s.key,{direction:'extension',...envelope})))throw Error('Invalid MAC.');
        s.inSeq=frame.frameSeq;s.lastSeen=Date.now();
        if(s.committed&&this.clients.get(s.pair.browserInstanceId)!==s)throw Error('Retired connection.');
        this.pairing.authenticate(s.pair.pairingId,origin,'resume');
        const b=frame.body;
        if(b.kind==='pair.commit') {
          if(!identity(b.id))throw Error('Invalid pair operation.');
          const result=this.pairing.confirm(s.pair.pairingId);
          s.committed=true;this.activate(s);this.send(s,{kind:'result',id:b.id,result});return;
        }
        if(!s.committed)throw Error('Pairing is not committed.');
        if(b.kind==='ping'){this.send(s,{kind:'pong'});return;}
        if(b.kind==='result') {
          const job=s.pending.get(b.id);if(!job)return;
          s.pending.delete(b.id);clearTimeout(job.timer);
          if(b.error)job.reject(fail(/^BROWSER_[A-Z_]{1,80}$/.test(b.error.code)?b.error.code:'BROWSER_REMOTE_ERROR','Browser command failed; inspect the original request.'));else job.resolve(b.result);
          return;
        }
        if(b.kind==='event') {
          if(!object(b.event)||b.event.browserInstanceId!==s.pair.browserInstanceId)throw Error('Invalid event target.');
          const observer=this.observers.get(s.pair.browserInstanceId+':'+b.event.executionId);
          if(!observer){this.send(s,{kind:'event.error',executionId:b.event.executionId,code:'BROWSER_OBSERVER_MISSING'});return;}
          try {const ack=await observer.handler(b.event);this.send(s,{kind:'event.ack',executionId:b.event.executionId,...ack});}
          catch(error){this.send(s,{kind:'event.error',executionId:b.event.executionId,code:['EVENT_GAP','EVENT_CONFLICT','BROWSER_STORAGE_ERROR','BROWSER_SESSION_MISMATCH'].includes(error.code)?error.code:'BROWSER_EVENT_REJECTED'});}
          return;
        }
        throw Error('Unsupported browser frame.');
      }).catch(()=>ws.terminate()).finally(()=>{s.queued--;});
    });
  }
  activate(s) {
    const old=this.clients.get(s.pair.browserInstanceId);
    this.clients.set(s.pair.browserInstanceId,s);
    if(old&&old!==s){
      old.ws.terminate();
      for(const row of this.observers.values())if(row.browserInstanceId===s.pair.browserInstanceId)Promise.resolve().then(()=>row.onDisconnect?.()).catch(()=>{});
    }
  }
  async close() {
    this.closed=true;
    for(const socket of this.sockets)socket.terminate();
    await new Promise(resolve=>this.wss.close(resolve));
    if(this.server.listening)await new Promise(resolve=>this.server.close(resolve));
  }
}
module.exports={BrowserChannel};
