const fs=require('node:fs'),path=require('node:path');
const terminal=status=>['succeeded','failed','cancelled'].includes(status);
const fail=code=>Object.assign(Error(code),{code});
function verifyPreviousAttempts(root,attempt){
 if(!/^[1-9][0-9]{0,2}$/.test(String(attempt)))throw fail('INVALID_NATIVE_ATTEMPT');
 if(String(attempt)==='1')return;
 const current='parent-attempt'+attempt;
 const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
 for(const dir of fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&/^parent(?:-attempt[0-9]+)?$/.test(e.name)&&e.name!==current)){
  const file=path.join(root,dir.name,'codex-state.json'),tasks=fs.existsSync(file)?read(file).tasks:[];
  if(!Array.isArray(tasks)||tasks.some(t=>!terminal(t.status)))throw fail('ORIGINAL_PARENT_UNRESOLVED_QUERY_ONLY');
  const checkpoint=path.join(root,dir.name==='parent'?'checkpoint.json':'checkpoint-'+dir.name.slice(7)+'.json');
  if(fs.existsSync(checkpoint))for(const round of read(checkpoint).rounds||[]){
   const original=tasks.find(t=>t.requestId===round.requestId);
   if(round.intent&&(!original||!terminal(original.status)||round.taskId&&round.taskId!==original.taskId))throw fail('ORIGINAL_PARENT_UNRESOLVED_QUERY_ONLY');
  }
 }
 for(const name of fs.readdirSync(root).filter(n=>/^checkpoint(?:-attempt[0-9]+)?\.json$/.test(n))){
  const own=String(attempt)==='1'?'checkpoint.json':'checkpoint-attempt'+attempt+'.json';if(name===own)continue;
  const parent=name==='checkpoint.json'?'parent':'parent-'+name.slice(11,-5),file=path.join(root,parent,'codex-state.json');
  if(!fs.existsSync(file)&&(read(path.join(root,name)).rounds||[]).some(r=>r.intent))throw fail('ORIGINAL_PARENT_UNRESOLVED_QUERY_ONLY');
 }
 const network=path.join(root,'coordinator','agent-network.json');
 const currentFile=path.join(root,'checkpoint-attempt'+attempt+'.json'),currentState=fs.existsSync(currentFile)?read(currentFile):null;
 const resumeContext=currentState?.rounds?.some(r=>r.intent)?currentState.contextId:null;
 if(fs.existsSync(network)&&read(network).delegations.some(d=>!['succeeded','failed','cancelled','rejected'].includes(d.state)&&(!resumeContext||d.callerContextId!==resumeContext)))throw fail('ORIGINAL_CHILD_UNRESOLVED_QUERY_ONLY');
}
module.exports={verifyPreviousAttempts};
