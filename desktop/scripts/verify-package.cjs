const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {localManifest}=require('../electron/ssh-install.cjs');
const root=path.resolve(__dirname,'../..'),desktop=path.join(root,'desktop'),version=require('../package.json').version;
function hash(file){return createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function verifyDesktopWebSocket({asar,app,dependencyDirectory=path.join(desktop,'node_modules/ws'),expectedVersion=require('../package.json').dependencies.ws}){
 let actual;try{actual=JSON.parse(asar.extractFile(app,path.join('node_modules','ws','package.json')).toString());}catch{throw Error('桌面主进程缺少 WebSocket 运行依赖 ws。');}
 const expected=JSON.parse(fs.readFileSync(path.join(dependencyDirectory,'package.json'),'utf8'));
 if(typeof expectedVersion!=='string'||actual.version!==expectedVersion||expected.version!==expectedVersion)throw Error('桌面 WebSocket 运行依赖版本不一致。');
 for(const field of ['name','main','type','exports','browser','dependencies','optionalDependencies','peerDependencies','peerDependenciesMeta'])if(JSON.stringify(actual[field])!==JSON.stringify(expected[field]))throw Error('桌面 WebSocket 运行依赖入口或依赖元数据不一致。');
 const files=['index.js','browser.js','wrapper.mjs',...fs.readdirSync(path.join(dependencyDirectory,'lib')).filter(n=>n.endsWith('.js')).map(n=>'lib/'+n)];
 for(const name of files){let bytes;try{bytes=asar.extractFile(app,path.join('node_modules','ws',...name.split('/')));}catch{throw Error('桌面 WebSocket 运行依赖文件缺失。');}if(createHash('sha256').update(bytes).digest('hex')!==hash(path.join(dependencyDirectory,name)))throw Error('桌面 WebSocket 运行依赖与安装清单不一致。');}
 return {name:'ws',version:actual.version,files:files.length+1,sourceMatches:true,packageMetadataMatches:true};
}
async function verify(){
 const resources=path.join(desktop,'release/win-unpacked/resources'),{manifest,digest}=localManifest(path.join(resources,'linux-package'));
 const browserBundle=require('./build-browser-extension.cjs').verifyBrowserBundle({directory:path.join(resources,'browser-extension')});
 if(manifest.version!==version)throw Error('Linux 离线包与桌面版本不一致。');
 const backend=fs.readdirSync(path.join(desktop,'electron')).filter(f=>f.endsWith('.cjs'));
 for(const name of backend)if(hash(path.join(desktop,'electron',name))!==hash(path.join(resources,'bridge/desktop/electron',name)))throw Error('后台模块与源码不一致：'+name);
 const core=[];
 function checkCore(directory,relative=''){
  for(const item of fs.readdirSync(directory,{withFileTypes:true})){
   const name=path.join(relative,item.name),source=path.join(directory,item.name);
   if(item.isDirectory())checkCore(source,name);
   else if(item.isFile()){
    for(const target of ['bridge','linux-package'])if(hash(source)!==hash(path.join(resources,target,'dist',name)))throw Error('核心构建与发布包不一致：'+target+'/dist/'+name);
    core.push(name);
   }
  }
 }
 checkCore(path.join(root,'dist'));
 for(const name of backend)if(hash(path.join(desktop,'electron',name))!==hash(path.join(resources,'linux-package/desktop/electron',name)))throw Error('Linux 后台模块与源码不一致：'+name);
 const asar=await import('@electron/asar');
 const app=path.join(resources,'app.asar');
 const desktopWebSocketRuntime=verifyDesktopWebSocket({asar,app});
 const bootstrap=path.join(desktop,'electron/bootstrap.sh');
 for(const target of ['bridge/bootstrap.sh','linux-package/desktop/electron/bootstrap.sh'])if(hash(bootstrap)!==hash(path.join(resources,target)))throw Error('WSL 启动脚本与源码不一致：'+target);
 for(const name of backend)if(createHash('sha256').update(asar.extractFile(app,path.join('electron',name))).digest('hex')!==hash(path.join(desktop,'electron',name)))throw Error('窗口包模块与源码不一致：'+name);
 const packagedVersion=JSON.parse(asar.extractFile(app,'package.json').toString()).version;if(packagedVersion!==version)throw Error('窗口包版本不一致。');
 for(const name of fs.readdirSync(path.join(desktop,'dist/assets')))if(createHash('sha256').update(asar.extractFile(app,path.join('dist','assets',name))).digest('hex')!==hash(path.join(desktop,'dist/assets',name)))throw Error('前端资源与构建输出不一致。');
 const exe=path.join(desktop,'release',`AgentBridge-${version}-Windows-x64.exe`);
 const report={date:new Date().toISOString(),status:'passed',version,browserBundle,desktopWebSocketRuntime,backendModules:backend.length,coreFiles:core.length,coreBuildMatches:true,linuxBackendMatches:true,linuxFiles:manifest.files.length,linuxManifestDigest:digest,appAsarSourceMatches:true,frontendMatches:true,bootstrapMatches:true,...(fs.existsSync(exe)&&process.argv.includes('--portable')?{portable:{file:path.relative(root,exe).replaceAll(path.sep,'/'),bytes:fs.statSync(exe).size,sha256:hash(exe)}}:{})};
 if(process.argv.includes('--portable')&&!report.portable)throw Error('Windows 便携 EXE 不存在。');
 const output=process.env.AGENTBRIDGE_PACKAGE_REPORT?path.resolve(process.env.AGENTBRIDGE_PACKAGE_REPORT):path.join(root,'artifacts/package-check',version,'package.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
if(require.main===module)verify().catch(error=>{console.error('发布资源校验失败：'+error.message);process.exitCode=1;});
module.exports={verifyDesktopWebSocket};
