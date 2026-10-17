// Windows SQLite/stdio controlled contracts. No model calls.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
if(process.platform!=='win32')throw Error('Windows required');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-i07c-stop-contract-'));
try{
 fs.cpSync(path.resolve(__dirname,'../electron'),path.join(directory,'desktop/electron'),{recursive:true});
 fs.mkdirSync(path.join(directory,'desktop/tests'),{recursive:true});
 const files=['team-space.test.cjs','team-work.test.cjs','team-automation.test.cjs','team-stop.test.cjs'];
 for(const file of files)fs.copyFileSync(path.join(__dirname,file),path.join(directory,'desktop/tests',file));
 const result=spawnSync(process.execPath,['--disable-warning=ExperimentalWarning','--test','--test-concurrency=1',...files.map(file=>path.join(directory,'desktop/tests',file))],{stdio:'inherit',cwd:directory});
 process.exitCode=result.status??1;
}finally{fs.rmSync(directory,{recursive:true,force:true});}
