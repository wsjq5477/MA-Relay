// Serialized to the already verified private Node on the remote machine.
function prepare(source,target,release,uid,owner,stateDirectory){
 const fs=require('node:fs'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
 const fail=code=>{throw Object.assign(Error(code),{code});};
 const inspect=(file,directory=false)=>{const s=fs.lstatSync(file);if(s.isSymbolicLink()||s.uid!==uid||!(directory?s.isDirectory():s.isFile()))fail('REMOTE_DIRECTORY_UNSAFE');return s;};
 const components=file=>{let p='/';for(const part of file.split('/').filter(Boolean)){p=path.join(p,part);const s=fs.lstatSync(p);if(s.isSymbolicLink()||!s.isDirectory()||((p===source||p.startsWith(source+'/')||p===target||p.startsWith(target+'/'))&&s.uid!==uid))fail('REMOTE_DIRECTORY_UNSAFE');}};
 components(source);
 const marker=JSON.parse(fs.readFileSync(path.join(source,'.bridge-release.json')));
 if(marker.ownerCoordinatorId!==owner||marker.digest!==release.digest)fail('SSH_PACKAGE_CHECKSUM');
 const files=release.manifest.files,allowed=new Set(files.map(f=>f.path));
 function verify(root){
  for(const f of files){if(!/^[a-zA-Z0-9_@.+/-]+$/.test(f.path)||f.path.split('/').some(p=>!p||p==='.'||p==='..'))fail('SSH_PACKAGE_INVALID');components(path.dirname(path.join(root,f.path)));const s=inspect(path.join(root,f.path));if(s.size!==f.size||createHash('sha256').update(fs.readFileSync(path.join(root,f.path))).digest('hex')!==f.sha256)fail('SSH_PACKAGE_CHECKSUM');}
 }
 verify(source);
 let current='/';for(const part of target.split('/').filter(Boolean)){current=path.join(current,part);if(!fs.existsSync(current))fs.mkdirSync(current,{mode:0o700});const s=fs.lstatSync(current);if(s.isSymbolicLink()||!s.isDirectory()||(current.startsWith(stateDirectory)&&(s.uid!==uid||(s.mode&0o077))))fail('REMOTE_DIRECTORY_UNSAFE');}
 function walk(dir,rel=''){for(const name of fs.readdirSync(dir)){const r=path.posix.join(rel,name),p=path.join(dir,name),s=fs.lstatSync(p);if(s.isSymbolicLink()||s.uid!==uid)fail('REMOTE_DIRECTORY_UNSAFE');if(s.isDirectory())walk(p,r);else if(!s.isFile()||!allowed.has(r))fail('SSH_PACKAGE_CHECKSUM');}}
 walk(target);
 for(const f of files){const dst=path.join(target,f.path);fs.mkdirSync(path.dirname(dst),{recursive:true,mode:0o700});components(path.dirname(dst));if(fs.existsSync(dst)){const s=inspect(dst);if(s.size===f.size&&createHash('sha256').update(fs.readFileSync(dst)).digest('hex')===f.sha256)continue;}
  const temp=dst+'.tmp-'+randomUUID();fs.writeFileSync(temp,fs.readFileSync(path.join(source,f.path)),{flag:'wx',mode:f.path.startsWith('runtime/')?0o700:0o600});fs.renameSync(temp,dst);
 }
 verify(target);
 const check="const m=require('node:module'),resolve=m._resolveFilename,root="+JSON.stringify(target+'/')+";m._resolveFilename=function(...args){const file=resolve.apply(this,args);if(!m.isBuiltin(file)&&!file.startsWith(root))throw Object.assign(Error('external dependency'),{code:'MODULE_NOT_FOUND'});return file;};require("+JSON.stringify(path.join(target,'desktop/electron/remote-maintenance.cjs'))+");";
 const result=require('node:child_process').spawnSync(path.join(target,'runtime/node'),['--no-global-search-paths','-e',check],{cwd:target,env:{PATH:path.join(target,'runtime'),HOME:target,NODE_PATH:''},encoding:'utf8',timeout:20000,maxBuffer:65536});
 if(result.status!==0)fail(/MODULE_NOT_FOUND/.test(result.stderr||'')?'MODULE_NOT_FOUND':'DAEMON_MAINTENANCE_STAGE');
 process.stdout.write('ready');
}
function maintenanceRuntimeScript(probe,release,controller){return 'try{('+prepare.toString()+')('+[probe.versionPath,controller,release,probe.uid,probe.ownerCoordinatorId,probe.stateDirectory].map(JSON.stringify).join(',')+');}catch(e){process.stderr.write(JSON.stringify({code:e.code||"DAEMON_MAINTENANCE_STAGE"}));process.exitCode=1;}';}
module.exports={maintenanceRuntimeScript};
