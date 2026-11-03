'use strict';
const {BrowserChannel}=require('./browser-channel.cjs');
const {fail,identity}=require('./browser-protocol.cjs');
const methods=new Set(['browser.status','browser.pair','browser.revoke']);
class BrowserManagement {
  constructor(options) {
    try {
      this.channel=new BrowserChannel({...options,durableEndpoint:true});
      // Restore this Node's listener before an extension attempts reconnection.
      // A native-only Node does not open a new listening port.
      if(this.channel.pairing.list().some(p=>p.state!=='revoked'))this.ready=this.start();
    }catch(error){this.error=error;}
  }
  start() {
    if(!this.ready){this.ready=this.channel.start().then(address=>(this.address=address));this.ready.catch(error=>{this.error=error;});}
    return this.ready;
  }
  async call(method,p={}) {
    if(!methods.has(method))throw fail('INVALID_INPUT','Unsupported browser management method.');
    if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['machineId',...(method==='browser.pair'?['operationId','extensionId','queryOnly']:method==='browser.revoke'?['pairingId']:[])].includes(k)))throw fail('INVALID_INPUT','Browser management fields are invalid.');
    if(method==='browser.status') {
      if(this.ready)await this.ready.catch(()=>{});
      return {schema:1,enabled:true,ready:!!this.address,...(this.error?{error:{code:this.error.code||'BROWSER_STORAGE_ERROR',message:'Browser state or original endpoint is unavailable; preserve the existing files.'}}:{}),...(this.address?{endpoint:this.address}:{}),pairs:(this.channel?.pairing.list()||[]).map(p=>({...p,online:this.channel.forInstance(p.browserInstanceId).online}))};
    }
    if(this.error)throw this.error;
    if(method==='browser.pair') {
      if(!identity(p.operationId))throw fail('INVALID_INPUT','Pairing needs an original operation ID.');
      if(typeof p.extensionId!=='string'||!(/^[a-p]{32}$/).test(p.extensionId))throw fail('INVALID_INPUT','An exact extension ID is required.');
      if(p.queryOnly!==undefined&&typeof p.queryOnly!=='boolean')throw fail('INVALID_INPUT','Pairing queryOnly must be boolean.');
      if(p.queryOnly){const original=this.channel.pairing.lookup(p.extensionId,p.operationId);this.address=await this.start();return {...original,...this.address};}
      this.address=await this.start();return this.channel.createPair(p.extensionId,p.operationId);
    }
    if(!identity(p.pairingId))throw fail('INVALID_INPUT','Revocation needs the original pairing ID.');
    return this.channel.revoke(p.pairingId);
  }
  async restore(){if(this.ready)this.address=await this.ready;return this.channel;}
  close(){return this.channel?.close();}
}
module.exports={BrowserManagement,methods};
