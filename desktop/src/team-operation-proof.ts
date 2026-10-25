// Team receipts bind the original method and complete parameters. Operation IDs
// remain separate receipt keys; this matches the existing persistent fingerprint.
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,v])=>[key,canonical(v)])):value;
export async function teamOperationFingerprint(method:string,params:Record<string,unknown>){
  const bytes=new TextEncoder().encode(JSON.stringify(canonical({...params,method,operationId:undefined})));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(value=>value.toString(16).padStart(2,'0')).join('');
}
