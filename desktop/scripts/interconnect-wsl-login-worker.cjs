// Native OAuth observer. Authorization URLs stay in private control files.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const root='/tmp/ab-interconnect-win-wsl-20261103';
const output='/mnt/d/AgentBridgePrivate/interconnect-current-windows-chat-20261103';
const stateFile=path.join(root,'native-login-result.json');
const birth=pid=>{try{return fs.readFileSync('/proc/'+pid+'/stat','utf8').split(') ')[1].split(' ')[19];}catch{return null;}};
const write=(file,data)=>{const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(data),{mode:0o600});fs.renameSync(temp,file);};
if(process.platform!=='linux'||fs.realpathSync(root)!==root||fs.statSync(root).uid!==process.getuid())throw Error('ORIGINAL_PRIVATE_ROOT_REQUIRED');
if(process.argv[2]!=='--worker'){
 const old=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)):null;
 if(old?.workerPid&&birth(old.workerPid)===old.workerBirth&&!old.finished){console.log(JSON.stringify({existingLoginAlive:true,newLoginStarted:false}));}
 else{const child=spawn(process.execPath,[__filename,'--worker'],{detached:true,stdio:'ignore',env:{...process.env,TEMP:root+'/tmp',TMP:root+'/tmp',TMPDIR:root+'/tmp'}});child.unref();console.log(JSON.stringify({detachedLoginStarted:true,authorizationDataPrinted:false}));}
}else{
 const home=os.homedir(),cli=home+'/.nvm/versions/node/v24.13.0/bin/codex';
 if(/^\/mnt\/c(?:\/|$)/i.test(fs.realpathSync(home)))throw Error('NATIVE_HOME_BOUNDARY');
 const proxy=fs.readFileSync(root+'/native-network-proxy','utf8').trim();
 const url=new URL(proxy);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1')throw Error('ORIGINAL_NETWORK_BOUNDARY');
 const started=Date.now(),state={started:true,finished:false,mode:'browser-detached',workerPid:process.pid,workerBirth:birth(process.pid),phase:'starting',authorizationDataPrinted:false};
 const save=()=>write(stateFile,state);save();
 const env={...process.env,HOME:home,CODEX_HOME:home+'/.codex',PATH:path.dirname(cli)+':/usr/local/bin:/usr/bin:/bin',TEMP:root+'/tmp',TMP:root+'/tmp',TMPDIR:root+'/tmp',XDG_CACHE_HOME:root+'/native-cache',HTTPS_PROXY:proxy,HTTP_PROXY:proxy,https_proxy:proxy,http_proxy:proxy,NO_PROXY:'127.0.0.1,localhost,::1',no_proxy:'127.0.0.1,localhost,::1',BROWSER:'/bin/true'};
 delete env.CODEX_SQLITE_HOME;delete env.CODEX_CLI_PATH;
 const child=spawn(cli,['login'],{cwd:home,env,stdio:['ignore','pipe','pipe']});state.nativePid=child.pid;save();
 let buffer='';
 const consume=chunk=>{
  buffer=(buffer+chunk.toString('utf8')).replace(/\u001b\[[0-9;]*[A-Za-z]/g,'').slice(-32768);
  const newline=buffer.lastIndexOf('\n');if(newline<0)return;
  const complete=buffer.slice(0,newline+1);buffer=buffer.slice(newline+1);
  for(const value of complete.match(/https:\/\/auth\.openai\.com\/[^\s\u001b]+/g)||[]){try{
   const authorization=new URL(value);if(authorization.origin!=='https://auth.openai.com'||!authorization.searchParams.has('state')||authorization.searchParams.get('code_challenge')?.length!==43)continue;
   write(path.join(output,'native-login-handoff.json'),{authorizationUrl:authorization.href,workerPid:process.pid});state.phase='authorization-ready';state.authorizationUrlPrepared=true;save();buffer='';break;
  }catch{}}
 };
 child.stdout.on('data',consume);child.stderr.on('data',consume);
 child.once('error',error=>{state.launchError=/^[A-Z_]+$/.test(error.code||'')?error.code:'NATIVE_LOGIN_START_FAILED';save();});
 child.once('close',code=>{
  state.finished=true;state.exitCode=code;state.phase=code===0?'native-login-exited':'native-login-failed';
  const authFile=home+'/.codex/auth.json';state.nativeAuthUpdated=code===0&&fs.existsSync(authFile)&&fs.statSync(authFile).mtimeMs>=started;save();
  const handoff=path.join(output,'native-login-handoff.json');if(fs.existsSync(handoff))fs.unlinkSync(handoff);
 });
}
