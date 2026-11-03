import {PROTOCOL,sign,verify,derive,nonce} from '../shared/wire.mjs';
const identity=value=>typeof value==='string'&&/^[A-Za-z0-9_.:-]{1,128}$/.test(value);
const credential=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function validConfiguration(config,origin){
  if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(k=>!['protocol','nodeId','pairingId','browserInstanceId','origin','url','secret','key','expiresAt','state','machineId'].includes(k)))return false;
  if(config.protocol!==PROTOCOL||!['nodeId','pairingId','browserInstanceId'].every(k=>identity(config[k]))||!/^chrome-extension:\/\/[a-p]{32}$/.test(origin)||config.origin!==origin)return false;
  const port=typeof config.url==='string'&&config.url.match(/^ws:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/browser\/v1$/);
  if(!port||Number(port[1])>65535||!Number.isSafeInteger(config.expiresAt)||config.expiresAt<1||config.state!==undefined&&!['pending','committed'].includes(config.state)||config.machineId!==undefined&&!identity(config.machineId))return false;
  if(config.key!==undefined)return credential(config.key)&&config.secret===undefined;
  return credential(config.secret)&&config.expiresAt>Date.now();
}

// Connection lifetime only. The durable task journal, not this socket, decides
// whether a browser mutation may run. Reconnect never resends a command.
export class BrowserClient {
  constructor(config,options={}) {
    if(!validConfiguration(config,options.origin))throw Error('Invalid local pairing configuration.');
    this.config={...config};this.options=options;this.outSeq=0;this.inSeq=0;
    this.receiveChain=Promise.resolve();this.sendChain=Promise.resolve();
  }
  open() {
    if(this.socket)throw Error('Connection already started.');
    const Socket=this.options.WebSocket||globalThis.WebSocket;
    this.opened=new Promise((resolve,reject)=>{this.resolveOpen=resolve;this.rejectOpen=reject;});
    const socket=this.socket=new Socket(this.config.url);
    this.clientNonce=nonce();this.mode=this.config.key?'resume':'pair';
    socket.addEventListener('open',()=>socket.send(JSON.stringify({kind:'hello',protocol:PROTOCOL,pairingId:this.config.pairingId,clientNonce:this.clientNonce,mode:this.mode})));
    socket.addEventListener('message',message=>{
      this.receiveChain=this.receiveChain.then(()=>this.receive(JSON.parse(String(message.data)))).catch(()=>{this.rejectOpen(Error('Browser channel authentication or frame validation failed.'));this.close();});
    });
    socket.addEventListener('error',()=>{this.rejectOpen(Error('Local browser channel could not connect.'));});
    socket.addEventListener('close',()=>{
      this.online=false;clearInterval(this.heartbeat);clearTimeout(this.deadline);
      this.rejectOpen(Error('Local browser channel closed; retain original task IDs.'));
      Promise.resolve().then(()=>this.options.onDisconnect?.()).catch(()=>{});
    });
    this.deadline=setTimeout(()=>{this.rejectOpen(Error('Browser channel handshake timed out.'));this.close();},10000);
    return this.opened;
  }
  async receive(frame) {
    if(!this.key) {
      const {proof,kind,...transcript}=frame;
      if(kind!=='challenge'||transcript.protocol!==PROTOCOL||transcript.nodeId!==this.config.nodeId||transcript.pairingId!==this.config.pairingId||transcript.browserInstanceId!==this.config.browserInstanceId||transcript.origin!==this.options.origin||transcript.clientNonce!==this.clientNonce||transcript.mode!==this.mode)throw Error('Challenge belongs to a different pairing.');
      const authKey=this.mode==='pair'?this.config.secret:this.config.key;
      if(!await verify(authKey,{role:'node',...transcript},proof))throw Error('Node authentication failed.');
      this.key=await derive(authKey,{purpose:'connection',...transcript});this.epoch=transcript.connectionEpoch;
      if(this.mode==='pair') {
        const info={protocol:PROTOCOL,nodeId:this.config.nodeId,pairingId:this.config.pairingId,browserInstanceId:this.config.browserInstanceId,origin:this.config.origin};
        const next={...this.config,key:await derive(this.config.secret,{purpose:'pair-key',...info})};delete next.secret;
        if(typeof this.options.persist!=='function')throw Error('Durable pairing storage is required.');
        await this.options.persist(next);this.config=next;
      }
      this.socket.send(JSON.stringify({kind:'authenticate',proof:await sign(authKey,{role:'extension',...transcript})}));return;
    }
    const {mac,...envelope}=frame;
    if(frame.protocol!==PROTOCOL||frame.connectionEpoch!==this.epoch||frame.frameSeq!==this.inSeq+1||!await verify(this.key,{direction:'node',...envelope},mac))throw Error('Invalid authenticated Node frame.');
    this.inSeq=frame.frameSeq;
    const b=frame.body;
    if(b.kind==='ready') {
      if(b.pairingId!==this.config.pairingId||b.browserInstanceId!==this.config.browserInstanceId)throw Error('Mismatched pairing receipt.');
      if(!b.committed) {this.commitId=crypto.randomUUID();await this.send({kind:'pair.commit',id:this.commitId});}
      else this.ready();
      return;
    }
    if(b.kind==='result'&&b.id===this.commitId) {
      if(b.result?.state!=='committed'||b.result?.browserInstanceId!==this.config.browserInstanceId||b.result?.pairingId!==this.config.pairingId)throw Error('Invalid pairing commit.');
      this.ready();return;
    }
    if(!this.online)throw Error('Business frame arrived before pairing commit.');
    if(b.kind==='command') {
      let result;
      try {result=await this.options.onCommand?.(b.method,b.params);if(result===undefined)throw Error('Unsupported command.');}
      catch(error) {await this.send({kind:'result',id:b.id,error:{code:/^BROWSER_[A-Z_]{1,80}$/.test(error.message)?error.message:'BROWSER_COMMAND_FAILED'}});return;}
      await this.send({kind:'result',id:b.id,result});return;
    }
    if(b.kind==='event.ack'||b.kind==='event.error')await this.options.onEventReceipt?.(b);
    else if(b.kind!=='pong')throw Error('Unsupported Node frame.');
  }
  ready() {
    if(this.online)return;
    clearTimeout(this.deadline);this.online=true;
    this.heartbeat=setInterval(()=>{this.send({kind:'ping'}).catch(()=>this.close());},20000);
    this.resolveOpen({browserInstanceId:this.config.browserInstanceId});
  }
  send(body) {
    const work=this.sendChain.then(async()=>{
      if(this.socket?.readyState!==1||!this.key)throw Error('Browser connection is not ready.');
      const envelope={protocol:PROTOCOL,connectionEpoch:this.epoch,frameSeq:++this.outSeq,body};
      const mac=await sign(this.key,{direction:'extension',...envelope});
      this.socket.send(JSON.stringify({...envelope,mac}));
    });
    // A failed send retires this connection; never reuse its sequence counter.
    this.sendChain=work.catch(()=>this.close());return work;
  }
  sendEvent(event) {if(!this.online)return Promise.reject(Error('Browser is offline.'));return this.send({kind:'event',event});}
  close() {this.online=false;clearInterval(this.heartbeat);clearTimeout(this.deadline);this.socket?.close();}
}
