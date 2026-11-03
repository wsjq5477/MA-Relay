const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
// Terminal events are written before a detached observer has necessarily exited.
// Only wait on identities recorded inside the caller's disposable fixture; never kill.
async function fixtureWorkerExit(directory,pids=[]){
 const root=fs.realpathSync(directory);assert.ok(!/^c:/i.test(root));
 const owned=new Set(pids.filter(pid=>Number.isInteger(pid)&&pid>0&&pid!==process.pid));
 for(const runRoot of [path.join(root,'runs'),path.join(root,'state','runs')]){
  if(!fs.existsSync(runRoot))continue;
  for(const e of fs.readdirSync(runRoot,{withFileTypes:true})){if(!e.isDirectory())continue;try{const beat=JSON.parse(fs.readFileSync(path.join(runRoot,e.name,'heartbeat.json'))),pid=beat.pid;if(Number.isInteger(pid)&&pid>0&&pid!==process.pid)owned.add(pid);}catch{/* An unstarted worker has no heartbeat. */}}
 }
 const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
 const deadline=Date.now()+15000;while([...owned].some(alive)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,25));
 assert.equal([...owned].some(alive),false,'Owned fixture workers must exit before temporary files are removed');
}
module.exports={fixtureWorkerExit};
