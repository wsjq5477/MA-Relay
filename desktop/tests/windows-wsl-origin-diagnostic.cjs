// Explicit model-free WSL launch diagnosis. No Bridge/user configuration or tasks.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{performance}=require('node:perf_hooks');
const [output,markerRoot,distribution='Ubuntu',countArg='20']=process.argv.slice(2),rounds=Number(countArg);
assert.equal(process.platform,'win32');assert(output&&/^\/tmp\/ab-wsl-origin-[A-Za-z0-9]+$/.test(markerRoot));assert(Number.isInteger(rounds)&&rounds>=5&&rounds<=30);
const unc='\\\\wsl.localhost\\'+distribution+markerRoot.replaceAll('/','\\'),modes=[['default-sh','/bin/sh',false],['root-sh','/bin/sh',true],['default-bash','/bin/bash',false],['root-bash','/bin/bash',true]];
const report={date:new Date().toISOString(),status:'running',environment:{platform:process.platform,release:os.release(),runtime:process.version,distribution},scope:'Raw one-shot WSL printf with own Linux entry markers; interleaved cwd/shell conditions; no Bridge, native model, daily files or service restart',markerRoot,rounds,modelCalls:0,samples:[]};
fs.mkdirSync(path.dirname(output),{recursive:true});const save=()=>{fs.writeFileSync(output+'.tmp',JSON.stringify(report,null,2)+'\n');fs.renameSync(output+'.tmp',output);};
const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
async function probe(mode,shell,rootCwd,round){
 const marker=mode+'-'+round+'.marker',file=markerRoot+'/'+marker;assert(!fs.existsSync(path.join(unc,marker)));
 const script='printf "WSL_ENTRY\\n" > '+quote(file)+'; printf "WSL_ORIGIN_READY\\n"',args=['--distribution',distribution,...(rootCwd?['--cd','/']:[]),'--exec',shell,'-c',script];
 const sample={mode,round,marker},started=performance.now(),child=spawn('wsl.exe',args,{windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='',timer;
 child.stdout.on('data',b=>stdout+=b.toString());child.stderr.on('data',b=>stderr=(stderr+b.toString()).slice(-4096));child.stdin.on('error',e=>sample.stdinError=e.code);
 const closed=new Promise(resolve=>{child.once('error',e=>{sample.spawnError=e.code;resolve();});child.once('close',(code,signal)=>{sample.exitCode=code;sample.signal=signal;resolve();});});
 timer=setTimeout(()=>{sample.timeout=true;child.kill();},15000);await closed;clearTimeout(timer);
 sample.elapsedMs=performance.now()-started;sample.stdoutReady=stdout==='WSL_ORIGIN_READY\n';sample.stdoutBytes=Buffer.byteLength(stdout);sample.stderrBytes=Buffer.byteLength(stderr);
 // Never publish raw stderr, which can contain machine paths or account names.
 sample.unsupportedOption=/unknown option|invalid command|无效.*选项|不支持.*参数/i.test(stderr);
 try{sample.windowsEntryObserved=fs.readFileSync(path.join(unc,marker),'utf8')==='WSL_ENTRY\n';}catch(e){sample.windowsEntryObserved=false;sample.markerReadCode=e.code;}
 sample.passed=sample.exitCode===0&&sample.stdoutReady&&sample.windowsEntryObserved;report.samples.push(sample);save();
 console.log(JSON.stringify({mode,round,exit:sample.exitCode,ready:sample.stdoutReady,entry:sample.windowsEntryObserved}));
}
(async()=>{
 fs.writeFileSync(path.join(unc,'observer-check.txt'),'WSL_OBSERVER_OK\n');assert.equal(fs.readFileSync(path.join(unc,'observer-check.txt'),'utf8'),'WSL_OBSERVER_OK\n');
 for(let round=1;round<=rounds;round++)for(const [mode,shell,rootCwd] of modes)await probe(mode,shell,rootCwd,round);
 assert.equal(fs.readFileSync(path.join(unc,'observer-check.txt'),'utf8'),'WSL_OBSERVER_OK\n');
 report.summary=Object.fromEntries(modes.map(([mode])=>{const rows=report.samples.filter(s=>s.mode===mode);return [mode,{passed:rows.filter(s=>s.passed).length,total:rows.length,blankExit1:rows.filter(s=>s.exitCode===1&&s.stdoutBytes===0&&s.stderrBytes===0).length,entryDespiteFailure:rows.filter(s=>!s.passed&&s.windowsEntryObserved).length}];}));report.status='complete';
})().catch(e=>{report.status='diagnostic_failed';report.error={code:e.code||'ASSERTION',message:'Controlled WSL diagnosis did not complete; retain original evidence'};process.exitCode=1;}).finally(()=>{save();console.log(JSON.stringify({status:report.status,summary:report.summary}));});
