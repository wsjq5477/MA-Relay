// Shared Web Crypto implementation; contains no provider or account access.
export const PROTOCOL='agentbridge-browser-v1';
export function canonical(value) {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
const bytes=value=>new TextEncoder().encode(JSON.stringify(canonical(value)));
const hex=buffer=>Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,'0')).join('');
const unhex=value=>{if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw Error('Invalid channel key.');return Uint8Array.from(value.match(/../g),v=>parseInt(v,16));};
export async function sign(key,value) {
  const imported=await crypto.subtle.importKey('raw',unhex(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',imported,bytes(value)));
}
export async function verify(key,value,signature) {
  const imported=await crypto.subtle.importKey('raw',unhex(key),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  return crypto.subtle.verify('HMAC',imported,unhex(signature),bytes(value));
}
export async function derive(key,info) {
  const imported=await crypto.subtle.importKey('raw',unhex(key),'HKDF',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:new Uint8Array(0),info:bytes(info)},imported,256));
}
export async function digest(value){return hex(await crypto.subtle.digest('SHA-256',bytes(value)));}
export function nonce(){return hex(crypto.getRandomValues(new Uint8Array(32)));}
