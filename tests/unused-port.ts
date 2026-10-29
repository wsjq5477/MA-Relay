import {createServer, createConnection} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

// Some loopback environments briefly accept TCP after the reserving listener
// has closed. Do not feed an ambiguous occupied port into a managed-server test.
export async function unusedPort():Promise<number> {
  const server=createServer();
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  const port=(server.address() as {port:number}).port;
  await new Promise<void>(done=>server.close(()=>done()));
  const deadline=Date.now()+3000;
  while(Date.now()<deadline) {
    const refused=await new Promise<boolean>(done=>{
      const socket=createConnection({host:'127.0.0.1',port});
      const finish=(value:boolean)=>{clearTimeout(timer);socket.destroy();done(value);};
      const timer=setTimeout(()=>finish(false),500);
      socket.once('connect',()=>finish(false));
      socket.once('error',(error:NodeJS.ErrnoException)=>finish(error.code==='ECONNREFUSED'));
    });
    if(refused)return port;
    await delay(25);
  }
  throw Error('The original reserved test port did not become verifiably unused');
}
