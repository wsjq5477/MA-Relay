'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {randomBytes,randomUUID,createHmac,hkdfSync,timingSafeEqual} = require('node:crypto');
const {atomicWrite} = require('./graph-layout.cjs');
const {fail,identity,PROTOCOL} = require('./browser-protocol.cjs');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
const encode = value => JSON.stringify(canonical(value));
const sign = (key,value) => createHmac('sha256',Buffer.from(key,'hex')).update(encode(value)).digest('hex');
const secret = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function equal(a,b) { return secret(a) && secret(b) && timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex')); }
function derive(key,info) { return Buffer.from(hkdfSync('sha256',Buffer.from(key,'hex'),Buffer.alloc(0),Buffer.from(encode(info)),32)).toString('hex'); }
class BrowserPairing {
  constructor(directory, options={}) {
    this.file=path.join(directory,'browser-pairings.json'); this.write=options.write||atomicWrite;
    fs.mkdirSync(directory,{recursive:true,mode:0o700});
    try { this.state=JSON.parse(fs.readFileSync(this.file,'utf8')); }
    catch(error) {
      if(error.code!=='ENOENT') throw fail('BROWSER_PAIRING_STATE','Pairing state is unreadable; preserve the original file.');
      this.state={version:1,nodeId:randomUUID(),pairs:[]};this.commit(this.state);
    }
    const s=this.state;
    if(s.version!==1||!identity(s.nodeId)||!Array.isArray(s.pairs)||s.pairs.length>128||new Set(s.pairs.map(p=>p.pairingId)).size!==s.pairs.length||new Set(s.pairs.map(p=>p.browserInstanceId)).size!==s.pairs.length||s.pairs.some(p=>!identity(p.pairingId)||!identity(p.browserInstanceId)||p.protocol!==PROTOCOL||p.nodeId!==s.nodeId||!/^chrome-extension:\/\/[a-p]{32}$/.test(p.origin)||!['pending','committed','revoked'].includes(p.state)||!secret(p.key)||!secret(p.bootstrap)||!Number.isSafeInteger(p.expiresAt)||p.expiresAt<0)) throw fail('BROWSER_PAIRING_STATE','Pairing state is invalid; no credentials were reset.');
    const operationIds=s.pairs.map(p=>p.operationId).filter(v=>v!==undefined);
    if(operationIds.some(v=>!identity(v))||new Set(operationIds).size!==operationIds.length)throw fail('BROWSER_PAIRING_STATE','Pairing operation identities are invalid.');
    for(const pair of s.pairs) {
      const info={protocol:PROTOCOL,nodeId:s.nodeId,pairingId:pair.pairingId,browserInstanceId:pair.browserInstanceId,origin:pair.origin};
      if(!equal(pair.key,derive(pair.bootstrap,{purpose:'pair-key',...info})))throw fail('BROWSER_PAIRING_STATE','Pairing credential binding cannot be verified.');
    }
  }
  commit(next) {
    if(this.poisoned) throw fail('BROWSER_STORAGE_ERROR','Pairing storage requires reopening.');
    try { this.write(this.file,next); }
    catch {this.poisoned=true;throw fail('BROWSER_STORAGE_ERROR','Pairing commit failed.');}
    this.state=structuredClone(next);
  }
  create(extensionId,operationId) {
    if(typeof extensionId!=='string'||!(/^[a-p]{32}$/).test(extensionId))throw fail('INVALID_INPUT','An exact extension ID is required.');
    if(operationId!==undefined&&!identity(operationId))throw fail('INVALID_INPUT','A valid original pairing operation ID is required.');
    if(operationId!==undefined) {
      const old=this.state.pairs.find(p=>p.operationId===operationId);
      if(old){if(old.origin!=='chrome-extension://'+extensionId)throw fail('REQUEST_CONFLICT','Original pairing operation belongs to a different extension.');return this.bundle(old);}
    }
    if(this.state.pairs.length>=128)throw fail('BROWSER_PAIRING_FULL','Pairing history is full; retained identities were not removed.');
    const pairingId=randomUUID(),browserInstanceId=randomUUID(),bootstrap=randomBytes(32).toString('hex');
    const info={protocol:PROTOCOL,nodeId:this.state.nodeId,pairingId,browserInstanceId,origin:'chrome-extension://'+extensionId};
    const pair={...info,...(operationId!==undefined?{operationId}:{}),bootstrap,key:derive(bootstrap,{purpose:'pair-key',...info}),state:'pending',expiresAt:Date.now()+120000};
    const next=structuredClone(this.state);next.pairs.push(pair);this.commit(next);
    return this.bundle(pair);
  }
  bundle(pair) {return {protocol:PROTOCOL,nodeId:pair.nodeId,pairingId:pair.pairingId,browserInstanceId:pair.browserInstanceId,origin:pair.origin,secret:pair.bootstrap,expiresAt:pair.expiresAt,state:pair.state};}
  lookup(extensionId,operationId) {
    const pair=this.state.pairs.find(p=>p.operationId===operationId);
    if(!pair)throw fail('NOT_FOUND','Original pairing operation has no retained receipt; no pairing was created.');
    if(pair.origin!=='chrome-extension://'+extensionId)throw fail('REQUEST_CONFLICT','Original pairing operation belongs to a different extension.');
    return this.bundle(pair);
  }
  authenticate(pairingId,origin,mode) {
    if(this.poisoned)throw fail('BROWSER_STORAGE_ERROR','Pairing storage requires reopening.');
    const pair=this.state.pairs.find(p=>p.pairingId===pairingId);
    if(!pair||pair.origin!==origin||pair.state==='revoked'||!['pair','resume'].includes(mode)||(mode==='pair'||pair.state!=='committed')&&pair.expiresAt<=Date.now())throw fail('BROWSER_AUTH_FAILED','Browser pairing is unavailable.');
    return {...pair,authKey:mode==='pair'?pair.bootstrap:pair.key};
  }
  confirm(pairingId) {
    const next=structuredClone(this.state),pair=next.pairs.find(p=>p.pairingId===pairingId);
    if(!pair||pair.state==='revoked')throw fail('BROWSER_AUTH_FAILED','Browser pairing was revoked.');
    if(pair.state!=='committed'&&pair.expiresAt<=Date.now())throw fail('BROWSER_AUTH_FAILED','Original pairing expired before commit.');
    if(pair.state!=='committed') {pair.state='committed';this.commit(next);}
    return {pairingId:pair.pairingId,browserInstanceId:pair.browserInstanceId,state:'committed'};
  }
  revoke(pairingId) {
    const next=structuredClone(this.state),pair=next.pairs.find(p=>p.pairingId===pairingId);
    if(!pair)throw fail('NOT_FOUND','Original pairing not found.');
    pair.state='revoked';this.commit(next);return {pairingId,state:'revoked'};
  }
  list() {return this.state.pairs.map(({pairingId,browserInstanceId,origin,state})=>({pairingId,browserInstanceId,origin,state}));}
}
module.exports={BrowserPairing,encode,sign,equal,derive,secret};
