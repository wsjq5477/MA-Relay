const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFile} = require('node:child_process');
const tools = {claude:'Claude Code', opencode:'OpenCode', codex:'Codex'};
function command(executable, args, environment=process.env) {
  if (/\.c?js$/i.test(executable)) return {executable:process.execPath,args:[executable,...args],env:{...environment,ELECTRON_RUN_AS_NODE:'1'}};
  if (!/\.(cmd|bat)$/i.test(executable)) return {executable,args,env:{...environment,ELECTRON_RUN_AS_NODE:undefined}};
  const folder=path.dirname(executable);
  const candidates=[
    ['@anthropic-ai/claude-code/bin/claude.exe',false],['@anthropic-ai/claude-code/cli.js',true],
    ['opencode-windows-x64/bin/opencode.exe',false],['opencode-ai/node_modules/opencode-windows-x64/bin/opencode.exe',false],
    ['@openai/codex/bin/codex.js',true],
  ].filter(([name])=>name.includes(path.basename(executable).split('.')[0]));
  for(const [name,js] of candidates){const file=path.join(folder,'node_modules',name);if(fs.existsSync(file))return js?{executable:fs.existsSync(path.join(folder,'node.exe'))?path.join(folder,'node.exe'):process.execPath,args:[file,...args],env:{...environment,ELECTRON_RUN_AS_NODE:'1'}}:{executable:file,args,env:{...environment,ELECTRON_RUN_AS_NODE:undefined}};}
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
  const folders=[...((windows?env.Path||env.PATH:env.PATH)||'').split(windows?';':path.delimiter).filter(Boolean),path.join(home,'.local/bin'),path.join(home,'.opencode/bin'),path.join(home,'.npm-global/bin'),path.join(home,'.claude/local')];
  if(windows)folders.push(path.join(env.APPDATA||path.join(home,'AppData/Roaming'),'npm'),path.join(home,'scoop/shims'));
  else if(platform==='linux')folders.push(...managedLinuxFolders(home,env));
  const result=[];
  await Promise.all(Object.entries(tools).map(async([adapter,name])=>{
    const candidates=options.candidates?.[adapter]||[...new Set(folders)].flatMap(dir=>(windows?[adapter+'.exe',adapter+'.cmd']:[adapter]).map(file=>path.resolve(dir,file)));
    const seen=new Set();
    let broken;
    for(const candidate of candidates){
      let executable;try {if(!fs.statSync(candidate).isFile())continue;executable=fs.realpathSync(candidate);if(!windows)fs.accessSync(executable,fs.constants.X_OK);}catch{continue;}
      const key=windows?executable.toLowerCase():executable;if(seen.has(key))continue;seen.add(key);
      try{
        const launch=command(executable,['--version'],env);
        const output=await new Promise((resolve,reject)=>execFile(launch.executable,launch.args,{env:launch.env,cwd:home,windowsHide:true,timeout:5000,maxBuffer:65536},(error,stdout)=>error?reject(error):resolve(stdout)));
        const version=String(output).match(/\bv?(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)/)?.[1];
        if(!version)throw new Error('版本信息不可识别');
        executable=/\.(cmd|bat)$/i.test(executable)?(launch.args[0]&&/\.c?js$/i.test(launch.args[0])?launch.args[0]:launch.executable):executable;
        result.push({adapter,name,executable,version,healthy:true});broken=undefined;break;
      }catch(error){broken||={adapter,name,executable,healthy:false,error:'工具启动检查失败：'+(error.code||error.message)};}
    }
    if(broken)result.push(broken);
  }));
  return result.sort((a,b)=>a.adapter.localeCompare(b.adapter));
}
module.exports={scanTools,command,tools};
