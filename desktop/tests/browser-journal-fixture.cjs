// Test-only HTTP origin for native IndexedDB. No provider page or user profile.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../browser-extension');
function createFixture() {
  return http.createServer((req,res)=>{
    if(req.url==='/favicon.ico'){res.writeHead(204).end();return;}
    if(req.url==='/') {res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end('<!doctype html><title>Browser journal verification</title><script type="module">import {runJournalTests} from "/tests/journal-browser.mjs";window.result=await runJournalTests();document.body.textContent=JSON.stringify(window.result);</script>');return;}
    if(!/^\/(?:src\/(?:background|shared)|tests)\/[a-z-]+\.mjs$/.test(req.url)){res.writeHead(404).end();return;}
    const file=path.join(root,req.url.slice(1));
    if(!fs.existsSync(file)){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':'text/javascript; charset=utf-8'});fs.createReadStream(file).pipe(res);
  });
}
if(require.main===module){const server=createFixture();server.listen(0,'127.0.0.1',()=>process.stdout.write(JSON.stringify({port:server.address().port,pid:process.pid})+'\n'));}
module.exports={createFixture};
