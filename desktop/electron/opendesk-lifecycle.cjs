const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{execFile}=require('node:child_process');
const fail=(code,message)=>Object.assign(Error(message),{code});
async function observe(options={}){
 let state='unknown';
 try{
  if(typeof options.observeOpenDesk==='function'){const result=await options.observeOpenDesk();state=['running','stopped'].includes(result?.state)?result.state:'unknown';}
  else if(process.platform==='win32'){
   const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','tasklist.exe');
   const result=await new Promise(resolve=>execFile(executable,['/FO','CSV','/NH'],{windowsHide:true,timeout:5000,maxBuffer:2*1024*1024},(error,stdout)=>resolve({error,text:String(stdout||'')})));
   const lines=result.text.split(/\r?\n/).filter(line=>line.trim()),names=lines.map(line=>line.match(/^"((?:""|[^"])*)","(\d+)"/));
   if(!result.error&&names.length&&names.every(Boolean))state=names.some(match=>/^opendesk(?:[- ]desktop)?\.exe$/i.test(match[1].replaceAll('""','"')))?'running':'stopped';
  }
 }catch{/* Absence of a process snapshot is never proof of exit. */}
 return {state,checkedAt:new Date().toISOString()};
}
function assertObservation(value){
 if(value.state==='running')throw fail('MCP_NATIVE_RUNNING','请先从托盘完全退出 OpenDesk，等待退出完成后刷新配置状态再添加；Bridge 不会结束或重启原生程序。');
 if(value.state!=='stopped')throw fail('MCP_NATIVE_STATE_UNKNOWN','无法确认 OpenDesk 已完全退出，原生配置未写入；请核对进程状态后刷新。');
}
function fingerprint(file){try{return createHash('sha256').update(fs.readFileSync(file)).digest('hex');}catch(error){if(error.code==='ENOENT')return 'absent';throw fail('MCP_NATIVE_STATE_UNKNOWN','无法核对原生配置是否稳定，原文件未改动。');}}
async function assertStopped(options,file){
 const first=await observe(options);assertObservation(first);const before=fingerprint(file);
 await new Promise(resolve=>setTimeout(resolve,options.openDeskQuietMs??250));
 const last=await observe(options);assertObservation(last);
 if(before!==fingerprint(file))throw fail('MCP_NATIVE_EXIT_PENDING','OpenDesk 退出期间配置仍在变化，原文件未改动；请等待退出完成后刷新核对。');
 return last;
}
function lifecycle(observation,config){
 const state=observation?.state||'unknown',present=config==='present';
 const phase=state==='running'?(present?'running_unverified':'exit_required'):state!=='stopped'?'process_unknown':present?'reopen_required':'ready_to_write';
 const message=state==='running'?(present?'OpenDesk 正在运行，配置文件存在，但原生加载、连接和工具无法由 Bridge 核验；请在 OpenDesk 的 MCP 管理中人工核对。再次写入前需先完全退出。':'请从托盘完全退出 OpenDesk，再刷新核对后添加；Bridge 不会退出或重启它。'):state!=='stopped'?'无法确认 OpenDesk 已完全退出，写入保持禁用；请核对进程后刷新。':present?'配置文件存在。请手动打开 OpenDesk，在 MCP 管理 → 已安装 MCP 核对 AgentBridge；原生加载、连接和工具无法由 Bridge 核验。':'已核对 OpenDesk 完全退出；配置无冲突时可以添加，写入后需手动打开 OpenDesk 并人工核对原生列表。';
 return {phase,processState:state,safeToWrite:state==='stopped',message,...(observation?.checkedAt?{checkedAt:observation.checkedAt}:{})};
}
module.exports={observe,assertStopped,lifecycle};
