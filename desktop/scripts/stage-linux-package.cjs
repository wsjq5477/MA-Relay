const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');

function stageLinuxPackage({repo,runtime,destination,nodeExecutable,version}) {
  const previous = path.join(destination,'runtime/node');
  const executable = nodeExecutable || process.env.AGENTBRIDGE_LINUX_NODE || (process.platform==='linux'?process.execPath:previous);
  if(!fs.existsSync(executable)) throw new Error('缺少 Linux Node 运行时，请设置 AGENTBRIDGE_LINUX_NODE 后再打包。');
  const header=Buffer.alloc(20),handle=fs.openSync(executable,'r');fs.readSync(handle,header,0,20,0);fs.closeSync(handle);
  if(!header.subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46]))||header[4]!==2||header.readUInt16LE(18)!==62)
    throw new Error('远端包要求真实 Linux x64 ELF Node 运行时。');
  const stage=destination+'.'+randomUUID()+'.tmp';fs.mkdirSync(stage,{recursive:true});
  try {
    for(const name of ['node_modules','desktop/electron']) fs.cpSync(path.join(runtime,name),path.join(stage,name),{recursive:true,dereference:true});
    fs.cpSync(path.join(repo,'dist'),path.join(stage,'dist'),{recursive:true});
    const pkg=JSON.parse(fs.readFileSync(path.join(repo,'package.json'),'utf8'));
    fs.writeFileSync(path.join(stage,'package.json'),JSON.stringify({...pkg,version,devDependencies:undefined,scripts:undefined}));
    fs.mkdirSync(path.join(stage,'runtime'));
    const helper=path.join(stage,'runtime/owned-stop');
    if(process.platform==='linux')execFileSync('cc',['-O2','-static','-o',helper,path.resolve(__dirname,'../native/owned-stop.c')]);
    else fs.copyFileSync(path.join(destination,'runtime/owned-stop'),helper);
    fs.chmodSync(helper,0o755);
    fs.copyFileSync(path.resolve(__dirname,'../native/owned-stop.c'),path.join(stage,'runtime/owned-stop.c'));
    if(process.platform==='linux')fs.copyFileSync('/usr/share/doc/libc6/copyright',path.join(stage,'runtime/LICENSE-glibc'));
    else fs.copyFileSync(path.join(destination,'runtime/LICENSE-glibc'),path.join(stage,'runtime/LICENSE-glibc'));
    fs.writeFileSync(path.join(stage,'runtime/owned-stop-build.txt'),'Rebuild/relink owned-stop with your libc: cc -O2 -static -o owned-stop owned-stop.c\nSource licensed under the AgentBridge MIT license. libc notices are in LICENSE-glibc.\nLinux pidfd syscalls are required; unsupported kernels refuse stop without a PID-only fallback.\n');fs.copyFileSync(executable,path.join(stage,'runtime/node'));fs.chmodSync(path.join(stage,'runtime/node'),0o755);
    let nodeVersion;
    if(process.platform==='linux') nodeVersion=execFileSync(executable,['--version'],{encoding:'utf8'}).trim();
    else nodeVersion=JSON.parse(fs.readFileSync(path.join(destination,'manifest.json'),'utf8')).runtime.version;
    const compatibleDaemons=[];
    const compatible=path.join(repo,'desktop/compatible-daemons');
    if(fs.existsSync(compatible)) for(const name of fs.readdirSync(compatible).sort()) {
      if(!/^[a-zA-Z0-9.-]+\.json$/.test(name)) throw new Error('兼容后台清单文件名无效。');
      const manifest=JSON.parse(fs.readFileSync(path.join(compatible,name),'utf8'));
      if(manifest.protocolVersion!==2 || name!==manifest.version+'.json' || manifest.platform!=='linux' || manifest.arch!=='x64') throw new Error('兼容后台清单版本/协议无效。');
      const manifestPath='compatible-daemons/'+name;
      fs.mkdirSync(path.join(stage,'compatible-daemons'),{recursive:true});fs.copyFileSync(path.join(compatible,name),path.join(stage,manifestPath));
      compatibleDaemons.push({version:manifest.version,manifestPath,manifestDigest:createHash('sha256').update(JSON.stringify(manifest)).digest('hex')});
    }
    const files=[];
    function visit(directory,relative='') {
      for(const row of fs.readdirSync(directory,{withFileTypes:true})) {
        const name=path.posix.join(relative,row.name),file=path.join(directory,row.name);
        if(row.isSymbolicLink()) {fs.rmSync(file);continue;}
        if(row.isDirectory()) visit(file,name);
        else if(row.isFile()) {const bytes=fs.readFileSync(file);files.push({path:name,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,...(name==='runtime/owned-stop'?{mode:0o700}:{})});}
        else throw new Error('远端包不允许特殊文件。');
      }
    }
    visit(stage);files.sort((a,b)=>a.path.localeCompare(b.path));
    fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify({version,protocolVersion:2,platform:'linux',arch:'x64',
      glibcMinimum:'2.28',compatibleDaemons,runtime:{path:'runtime/node',version:nodeVersion},files},null,2));
    fs.rmSync(destination,{recursive:true,force:true});fs.renameSync(stage,destination);
    return {version,files:files.length,size:files.reduce((sum,f)=>sum+f.size,0),nodeVersion};
  } catch(error) {fs.rmSync(stage,{recursive:true,force:true});throw error;}
}
module.exports={stageLinuxPackage};
