// Opt-in native acceptance helper. Existing installation/account/config are
// read-only inputs; every copy and all newly created runtime state stay off C:.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {parse,stringify}=require('smol-toml');
const {ensurePrivateDirectory}=require('../electron/private-directory.cjs');
const fail=code=>Object.assign(Error(code),{code});
const excluded=['desktop','hooks','marketplaces','plugins','memories','projects','mcp_servers'];
const modelPart=config=>Object.fromEntries(Object.entries(config).filter(([key])=>key==='model'||key.startsWith('model_')||key==='openai_base_url'||key==='chatgpt_base_url'));
const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function fileDigest(file){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
function nonC(file){if(!path.isAbsolute(file)||/^c:[\\/]/i.test(path.resolve(file)))throw fail('NON_C_PROFILE_REQUIRED');}
function modelCPaths(value){
 if(typeof value==='string')return /^(?:c:[\\/]|\/mnt\/c\/)/i.test(value);
 if(Array.isArray(value))return value.some(modelCPaths);
 return value&&typeof value==='object'?Object.values(value).some(modelCPaths):false;
}
function localModelEndpoint(value){
 if(typeof value==='string'){try{const url=new URL(value);return /^https?:$/.test(url.protocol)&&['localhost','127.0.0.1','0.0.0.0','[::1]'].includes(url.hostname);}catch{return false;}}
 if(Array.isArray(value))return value.some(localModelEndpoint);
 return value&&typeof value==='object'?Object.values(value).some(localModelEndpoint):false;
}
async function prepareWindowsProfile({root,executable,sourceProfile,nodeExecutable=process.execPath,sourceProfileBasis='user-native-config'}){
 nonC(root);ensurePrivateDirectory(root);nonC(fs.realpathSync(root));
 const manifestFile=path.join(root,'native-profile-manifest.json');
 if(fs.existsSync(manifestFile)){
  const m=JSON.parse(fs.readFileSync(manifestFile));if(m.version!==1)throw fail('NATIVE_PROFILE_VERSION');
  for(const file of [m.codex,m.node,m.profile,m.home]){nonC(file);nonC(fs.realpathSync(file));if(!path.relative(root,file)||path.relative(root,file).startsWith('..'))throw fail('NATIVE_PROFILE_BINDING');}
  const c=parse(fs.readFileSync(path.join(m.profile,'config.toml'),'utf8'));
  if(localModelEndpoint(modelPart(c)))throw fail('NATIVE_LOCAL_PROXY_STORAGE_UNVERIFIED');
  if(await fileDigest(m.codex)!==m.codexSha256||fingerprint(modelPart(c))!==m.modelFingerprint)throw fail('NATIVE_PROFILE_CHANGED');
  return {...m,reused:true};
 }
 if(!fs.statSync(executable).isFile()||!fs.statSync(nodeExecutable).isFile())throw fail('NATIVE_INSTALLATION_REQUIRED');
 const sourceConfig=parse(fs.readFileSync(path.join(sourceProfile,'config.toml'),'utf8'));
 if(localModelEndpoint(modelPart(sourceConfig)))throw fail('NATIVE_LOCAL_PROXY_STORAGE_UNVERIFIED');
 const config=structuredClone(sourceConfig);for(const key of excluded)delete config[key];
 if(modelCPaths(config))throw fail('NATIVE_CONFIG_C_PATH_REQUIRES_REVIEW');
 const profile=path.join(root,'native-parent-profile'),home=path.join(root,'windows-home'),bin=path.join(root,'native-bin');
 for(const dir of [profile,home,bin])ensurePrivateDirectory(dir);
 config.cli_auth_credentials_store='file';
 const auth=path.join(sourceProfile,'auth.json');if(!fs.statSync(auth).isFile())throw fail('NATIVE_AUTH_FILE_REQUIRED');
 // Secrets never enter stdout, repository paths, artifacts or public manifests.
 fs.copyFileSync(auth,path.join(profile,'auth.json'),fs.constants.COPYFILE_EXCL);
 fs.writeFileSync(path.join(profile,'config.toml'),stringify(config),{flag:'wx',mode:0o600});
 const codex=path.join(bin,'codex.exe'),node=path.join(bin,'node.exe');
 fs.copyFileSync(executable,codex,fs.constants.COPYFILE_EXCL);fs.copyFileSync(nodeExecutable,node,fs.constants.COPYFILE_EXCL);
 const companion=path.join(path.dirname(executable),'codex-code-mode-host.exe');
 if(fs.existsSync(companion))fs.copyFileSync(companion,path.join(bin,'codex-code-mode-host.exe'),fs.constants.COPYFILE_EXCL);
 const copied=parse(fs.readFileSync(path.join(profile,'config.toml'),'utf8'));
 if(fingerprint(modelPart(sourceConfig))!==fingerprint(modelPart(copied)))throw fail('NATIVE_MODEL_CONFIG_CHANGED');
 const m={version:1,codex,node,profile,home,codexSha256:await fileDigest(codex),modelFingerprint:fingerprint(modelPart(copied)),modelConfigUnchanged:true,sourceProfileUntouched:true,sourceProfileBasis,excludedSections:excluded};
 fs.writeFileSync(manifestFile,JSON.stringify(m,null,2),{flag:'wx',mode:0o600});return {...m,reused:false};
}
function windowsNativeEnvironment(m){
 const temp=path.join(m.home,'tmp'),cache=path.join(m.home,'cache');fs.mkdirSync(temp,{recursive:true});fs.mkdirSync(cache,{recursive:true});
 return {...process.env,USERPROFILE:m.home,HOME:m.home,APPDATA:path.join(m.home,'AppData','Roaming'),LOCALAPPDATA:path.join(m.home,'AppData','Local'),
  TEMP:temp,TMP:temp,CODEX_HOME:m.profile,CODEX_SQLITE_HOME:path.join(m.profile,'sqlite'),CODEX_CLI_PATH:m.codex,
  XDG_CACHE_HOME:cache,XDG_CONFIG_HOME:path.join(m.home,'config'),XDG_DATA_HOME:path.join(m.home,'data'),npm_config_cache:path.join(cache,'npm'),
  PATH:path.dirname(m.node)+path.delimiter+process.env.PATH};
}
module.exports={prepareWindowsProfile,windowsNativeEnvironment};
if(require.main===module){
 if(process.platform!=='win32'||process.env.AGENTBRIDGE_REAL_NATIVE!=='1')throw fail('EXPLICIT_WINDOWS_NATIVE_OPT_IN_REQUIRED');
 prepareWindowsProfile({root:process.env.AGENTBRIDGE_LIVE_ROOT,executable:process.env.AGENTBRIDGE_WINDOWS_CODEX,sourceProfile:process.env.AGENTBRIDGE_WINDOWS_PROFILE,sourceProfileBasis:process.env.AGENTBRIDGE_WINDOWS_PROFILE_BASIS}).then(m=>{
  const {execFile}=require('node:child_process'),env=windowsNativeEnvironment(m);
  execFile(m.codex,['--version'],{env,windowsHide:true,timeout:15000},(error,stdout)=>{if(error){console.log(JSON.stringify({error:'WINDOWS_NATIVE_VERSION_FAILED'}));process.exitCode=1;return;}console.log(JSON.stringify({ready:true,version:stdout.trim(),binarySha256:m.codexSha256,modelConfigUnchanged:m.modelConfigUnchanged,sourceProfileUntouched:true,nonCState:true,isolatedProfile:true,excludedSections:m.excludedSections}));});
 }).catch(error=>{console.log(JSON.stringify({error:error.code||'WINDOWS_NATIVE_PROFILE_FAILED'}));process.exitCode=1;});
}
