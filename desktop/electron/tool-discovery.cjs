const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFile} = require('node:child_process');
const {createRequire} = require('node:module');
const {adapters} = require('./builtin-adapters.cjs');
const descriptors = adapters.list();
const versionRejections=new WeakSet();
function openCodeCompatibility(version){
 const supported=typeof version==='string'&&/^[12]\.\d+\.\d+(?:[.+-][\w.-]+)?$/.test(version);
 return {supported,supportedMajors:[1,2],...(!supported?{code:'NATIVE_VERSION',message:'当前适配器支持 OpenCode 1.x 和 2.x，检测到的版本无法识别；请核对原安装后重新扫描。实际接口仍需兼容检查，旧节点、会话和历史保留。'}:{})};
}
function openCodeVersionError(version){const c=openCodeCompatibility(version),error=Object.assign(Error(c.message),{code:'NATIVE_VERSION'});versionRejections.add(error);return error;}
const isOpenCodeVersionRejection=error=>!!error&&versionRejections.has(error);
const tools = Object.fromEntries(descriptors.map(item=>[item.id,item.name]));
function windowsCodex(executable,args,environment,platform) {
  if(platform!=='win32'||path.basename(executable)!=='codex.js'||path.basename(path.dirname(executable))!=='bin')return null;
  const root=path.dirname(path.dirname(executable));
  let pkg;try{pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));}catch{return null;}
  if(pkg.name!=='@openai/codex')return null;
  const arch=process.arch==='arm64'?'arm64':'x64',platformPackage='@openai/codex-win32-'+arch;
  let vendor=path.join(root,'vendor');
  try {
    const manifest=createRequire(path.resolve(executable)).resolve(platformPackage+'/package.json');
    const installed=JSON.parse(fs.readFileSync(manifest,'utf8'));
    const alias=installed.name==='@openai/codex'&&pkg.optionalDependencies?.[platformPackage]==='npm:@openai/codex@'+installed.version&&installed.os?.includes('win32')&&installed.cpu?.includes(arch);
    if(installed.name!==platformPackage&&!alias)throw new Error('Unexpected Codex platform package');
    vendor=path.join(path.dirname(manifest),'vendor');
  } catch(error) { if(error.code!=='MODULE_NOT_FOUND')throw error; }
  const native=path.join(vendor,arch==='arm64'?'aarch64-pc-windows-msvc':'x86_64-pc-windows-msvc','bin','codex.exe');
  if(!fs.existsSync(native)||!fs.statSync(native).isFile())throw Object.assign(new Error('原Codex npm安装缺少Windows原生程序，请修复原安装后重新扫描。'),{code:'TOOL_LAUNCHER'});
  // The npm JS wrapper spawns this binary without windowsHide. Launch the same
  // package's binary directly so the caller's hidden-window option reaches it.
  // Keep the original JS installation identity for existing nodes/contexts.
  const env={...environment,ELECTRON_RUN_AS_NODE:undefined,CODEX_MANAGED_PACKAGE_ROOT:fs.realpathSync(root)};
  delete env.CODEX_MANAGED_BY_NPM;delete env.CODEX_MANAGED_BY_PNPM;delete env.CODEX_MANAGED_BY_BUN;
  let manager=/\bbun\//.test(environment.npm_config_user_agent||'')||/[\\/]\.bun[\\/]install[\\/]global/.test(root)?'BUN':'NPM';
  for(let folder=path.resolve(root);folder!==path.dirname(folder);folder=path.dirname(folder)) {
    const modules=path.join(folder,'node_modules');
    try{if(fs.existsSync(path.join(modules,'.modules.yaml'))&&fs.realpathSync(path.join(modules,'@openai/codex'))===fs.realpathSync(root)){manager='PNPM';break;}}catch{/* Not the owning package-manager directory. */}
  }
  env['CODEX_MANAGED_BY_'+manager]='1';
  return {executable:native,args,env,installationExecutable:executable};
}
function command(executable, args, environment=process.env, platform=process.platform) {
  const native=windowsCodex(executable,args,environment,platform);if(native)return native;
  if (/\.[cm]?js$/i.test(executable)) return {executable:process.execPath,args:[executable,...args],env:{...environment,ELECTRON_RUN_AS_NODE:'1'}};
  if (!/\.(cmd|bat)$/i.test(executable)) return {executable,args,env:{...environment,ELECTRON_RUN_AS_NODE:undefined}};
  const folder=path.dirname(executable);
  const commandName=path.basename(executable).replace(/\.(cmd|bat)$/i,'').toLowerCase();
  const candidates=descriptors.filter(item=>item.commands.includes(commandName))
    .flatMap(item=>item.npmEntrypoints.map(name=>[name,/\.[cm]?js$/i.test(name)]));
  for(const [name,js] of candidates){const file=path.join(folder,'node_modules',name);if(fs.existsSync(file))return windowsCodex(file,args,environment,platform)||(js?{executable:fs.existsSync(path.join(folder,'node.exe'))?path.join(folder,'node.exe'):process.execPath,args:[file,...args],env:{...environment,ELECTRON_RUN_AS_NODE:'1'}}:{executable:file,args,env:{...environment,ELECTRON_RUN_AS_NODE:undefined}});}
  throw Object.assign(new Error('无法解析工具命令脚本，请使用原生安装后重新扫描。'),{code:'TOOL_LAUNCHER'});
}
// Detached Linux daemons do not load interactive shell startup files. Probe
// known per-user installation layouts without sourcing rc files or changing PATH.
function managedLinuxFolders(home, env) {
  const data=env.XDG_DATA_HOME||path.join(home,'.local/share');
  const fnm=env.FNM_DIR||path.join(data,'fnm'),nvm=env.NVM_DIR||path.join(home,'.nvm');
  const asdf=env.ASDF_DATA_DIR||path.join(home,'.asdf'),mise=env.MISE_DATA_DIR||path.join(data,'mise');
  const folders=[path.join(env.VOLTA_HOME||path.join(home,'.volta'),'bin'),path.join(asdf,'shims'),
    path.join(mise,'shims'),path.join(env.CARGO_HOME||path.join(home,'.cargo'),'bin'),
    path.join(env.BUN_INSTALL||path.join(home,'.bun'),'bin'),env.PNPM_HOME||path.join(data,'pnpm')];
  const prefix=env.npm_config_prefix||env.NPM_CONFIG_PREFIX;
  if(prefix)folders.push(path.join(prefix,'bin'));
  for(const [root,suffix] of [[path.join(fnm,'node-versions'),'installation/bin'],[path.join(nvm,'versions/node'),'bin'],
    [path.join(asdf,'installs/nodejs'),'bin'],[path.join(mise,'installs/node'),'bin']]){
    let versions;try{versions=fs.readdirSync(root,{withFileTypes:true});}catch{continue;}
    for(const version of versions.filter(item=>item.isDirectory()||item.isSymbolicLink()).sort((a,b)=>b.name.localeCompare(a.name,'en',{numeric:true})))
      folders.push(path.join(root,version.name,suffix));
  }
  return folders.filter(Boolean);
}
async function scanTools(options={}) {
  const home=options.home||os.homedir(), env=options.environment||process.env;
  const platform=options.platform||process.platform,windows=platform==='win32';
  const pathFolders=((windows?env.Path||env.PATH:env.PATH)||'').split(windows?';':path.delimiter).filter(Boolean);
  const folders=[...pathFolders,path.join(home,'.local/bin'),path.join(home,'.opencode/bin'),path.join(home,'.npm-global/bin'),path.join(home,'.claude/local')];
  if(windows)folders.push(path.join(env.APPDATA||path.join(home,'AppData/Roaming'),'npm'),path.join(home,'scoop/shims'));
  else if(platform==='linux')folders.push(...managedLinuxFolders(home,env),path.join(env.HERMES_HOME||path.join(home,'.hermes'),'hermes-agent/.hermes/bin'),path.join(env.HERMES_HOME||path.join(home,'.hermes'),'hermes-agent/venv/bin'),path.join(env.HERMES_HOME||path.join(home,'.hermes'),'venv/bin'));
  const result=[];
  await Promise.all(descriptors.map(async({id:adapter,name,commands})=>{
    const candidates=options.candidates?.[adapter]||[...new Set(folders)].flatMap(dir=>commands.flatMap(commandName=>(windows?[commandName+'.exe',commandName+'.cmd']:[commandName]).map(file=>path.resolve(dir,file))));
    const seen=new Set();
    let broken;
    for(const candidate of candidates){
      let executable;try {if(!fs.statSync(candidate).isFile())continue;executable=fs.realpathSync(candidate);if(!windows)fs.accessSync(executable,fs.constants.X_OK);}catch{continue;}
      const key=windows?executable.toLowerCase():executable;if(seen.has(key))continue;seen.add(key);
      try{
        const launch=command(executable,['--version'],env,platform);
        const output=await new Promise((resolve,reject)=>execFile(launch.executable,launch.args,{env:launch.env,cwd:home,windowsHide:true,timeout:5000,maxBuffer:65536},(error,stdout)=>error?reject(error):resolve(stdout)));
        const version=String(output).match(/\bv?(\d+\.\d+\.\d+(?:[.+-][\w.-]+)?)/)?.[1];
        if(!version)throw new Error('版本信息不可识别');
        executable=launch.installationExecutable||(/\.(cmd|bat)$/i.test(executable)?(launch.args[0]&&/\.[cm]?js$/i.test(launch.args[0])?launch.args[0]:launch.executable):executable);
        result.push({adapter,name,executable,version,healthy:true,...(adapter==='opencode'?{compatibility:openCodeCompatibility(version)}:{})});broken=undefined;break;
      }catch(error){
        broken||={adapter,name,executable,healthy:false,error:'工具启动检查失败：'+(error.code||error.message)};
        // The first installed command on PATH is the user's selection. A
        // failed version probe must not silently select a different install.
        if(!options.candidates?.[adapter]&&pathFolders.some(dir=>path.resolve(dir)===path.dirname(candidate)))break;
      }
    }
    if(broken)result.push(broken);
  }));
  return result.sort((a,b)=>a.adapter.localeCompare(b.adapter));
}
module.exports={scanTools,command,tools,openCodeCompatibility,openCodeVersionError,isOpenCodeVersionRejection};
