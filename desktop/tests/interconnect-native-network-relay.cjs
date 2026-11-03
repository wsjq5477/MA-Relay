// Acceptance-only CONNECT transport through the existing Windows network.
// TLS stays end-to-end; this process never parses OAuth or model traffic.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),net=require('node:net');
const {randomBytes,timingSafeEqual}=require('node:crypto');
const {ensurePrivateDirectory}=require('../electron/private-directory.cjs');
const root=process.env.AGENTBRIDGE_CURRENT_CHAT_ROOT;
if(process.platform!=='win32'||!root||!path.isAbsolute(root)||/^c:/i.test(root))throw Error('NON_C_WINDOWS_ROOT_REQUIRED');
ensurePrivateDirectory(root);if(/^c:/i.test(fs.realpathSync(root)))throw Error('NON_C_WINDOWS_ROOT_REQUIRED');
const allowed=new Set(['auth.openai.com','chatgpt.com','api.openai.com']);
const binding=path.join(root,'native-network-relay.json');
let token=randomBytes(24).toString('hex'),port=0;
if(fs.existsSync(binding)){
 const original=new URL(JSON.parse(fs.readFileSync(binding)).proxy);
 if(original.protocol!=='http:'||original.hostname!=='127.0.0.1'||original.username!=='bridge'||!/^[a-f0-9]{48}$/.test(original.password)||!original.port)throw Error('NATIVE_NETWORK_RELAY_BINDING_INVALID');
 token=original.password;port=Number(original.port);
}
const expected=Buffer.from('Basic '+Buffer.from('bridge:'+token).toString('base64'));
const sockets=new Set(),counts={accepted:0,connected:0,rejected:0,upstreamErrors:0};
const server=http.createServer((request,response)=>{response.writeHead(405);response.end();});
server.on('connect',(request,client,head)=>{
 const authorization=Buffer.from(request.headers['proxy-authorization']||'');
 if(authorization.length!==expected.length||!timingSafeEqual(authorization,expected)){counts.rejected++;client.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="native-network"\r\n\r\n');return;}
 const match=/^([a-z0-9.-]+):443$/i.exec(request.url||'');
 if(!match||!allowed.has(match[1].toLowerCase())){counts.rejected++;client.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
 counts.accepted++;sockets.add(client);client.on('error',()=>{});client.once('close',()=>sockets.delete(client));
 const upstream=net.connect({host:match[1],port:443});sockets.add(upstream);
 const timeout=setTimeout(()=>upstream.destroy(),15000);
 upstream.once('connect',()=>{clearTimeout(timeout);counts.connected++;client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);client.pipe(upstream);upstream.pipe(client);});
 upstream.on('error',()=>{counts.upstreamErrors++;client.destroy();});
 upstream.once('close',()=>{clearTimeout(timeout);sockets.delete(upstream);client.destroy();});
 client.once('close',()=>upstream.destroy());
});
server.listen(port,'127.0.0.1',()=>{
 const port=server.address().port;
 fs.writeFileSync(path.join(root,'native-network-relay.json'),JSON.stringify({pid:process.pid,proxy:'http://bridge:'+token+'@127.0.0.1:'+port,allowedHosts:[...allowed]}),{mode:0o600});
 console.log(JSON.stringify({ready:true,loopbackOnly:true,allowedHosts:[...allowed],endToEndTls:true,plaintextCredentialsOrBodiesLogged:false}));
});
const timer=setInterval(()=>fs.writeFileSync(path.join(root,'native-network-relay-status.json'),JSON.stringify({date:new Date().toISOString(),...counts,openSockets:sockets.size}),{mode:0o600}),1000);
server.once('error',error=>{clearInterval(timer);console.log(JSON.stringify({error:error.code==='EADDRINUSE'?'ORIGINAL_NETWORK_RELAY_STILL_BOUND':'NATIVE_NETWORK_RELAY_UNAVAILABLE'}));process.exitCode=1;});
function close(){clearInterval(timer);for(const socket of sockets)socket.destroy();server.close();}
process.once('SIGINT',close);process.once('SIGTERM',close);
