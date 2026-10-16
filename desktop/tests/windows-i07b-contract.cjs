// Node's --test glob discovery does not accept UNC test paths on this runtime.
// Copy source-only test resources to a Windows-owned temporary folder first.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
if(process.platform!=='win32')throw Error('Windows required');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ab-i07b-contract-'));
try{
 fs.cpSync(path.resolve(__dirname,'../electron'),path.join(directory,'desktop/electron'),{recursive:true});
 fs.mkdirSync(path.join(directory,'desktop/tests'),{recursive:true});
 for(const file of ['team-space.test.cjs','team-work.test.cjs'])fs.copyFileSync(path.join(__dirname,file),path.join(directory,'desktop/tests',file));
 const result=spawnSync(process.execPath,['--disable-warning=ExperimentalWarning','--test',path.join(directory,'desktop/tests/team-space.test.cjs'),path.join(directory,'desktop/tests/team-work.test.cjs')],{stdio:'inherit',cwd:directory});
 process.exitCode=result.status??1;
}finally{fs.rmSync(directory,{recursive:true,force:true});}
