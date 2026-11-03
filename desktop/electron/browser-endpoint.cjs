'use strict';
const fs=require('node:fs'),path=require('node:path');
const {randomInt}=require('node:crypto');
const {fail}=require('./browser-protocol.cjs');

// One durable loopback address per existing Node state directory. Never choose
// another address after a bind failure: that would split a retained identity.
function endpointPort(directory,nodeId) {
  const file=path.join(directory,'browser-endpoint.json');
  try {
    fs.writeFileSync(file,JSON.stringify({version:1,nodeId,host:'127.0.0.1',port:randomInt(49152,65536)})+'\n',{flag:'wx',mode:0o600});
  } catch(error) {if(error.code!=='EEXIST')throw fail('BROWSER_ENDPOINT_STATE','Browser endpoint could not be saved.');}
  let saved;
  try {saved=JSON.parse(fs.readFileSync(file,'utf8'));}
  catch {throw fail('BROWSER_ENDPOINT_STATE','Browser endpoint is unreadable; preserve the original file.');}
  if(!saved||saved.version!==1||saved.nodeId!==nodeId||saved.host!=='127.0.0.1'||!Number.isInteger(saved.port)||saved.port<49152||saved.port>65535||Object.keys(saved).some(k=>!['version','nodeId','host','port'].includes(k)))throw fail('BROWSER_ENDPOINT_STATE','Browser endpoint binding is invalid; no address was replaced.');
  return saved.port;
}
module.exports={endpointPort};
