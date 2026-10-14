const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {localManifest}=require('../electron/ssh-install.cjs');
const root=path.resolve(__dirname,'../..'),desktop=path.join(root,'desktop'),version=require('../package.json').version;
function hash(file){return createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
async function verify(){
 const resources=path.join(desktop,'release/win-unpacked/resources'),{manifest,digest}=localManifest(path.join(resources,'linux-package'));
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
 for(const name of backend)if(createHash('sha256').update(asar.extractFile(app,'electron/'+name)).digest('hex')!==hash(path.join(desktop,'electron',name)))throw Error('窗口包模块与源码不一致：'+name);
 const packagedVersion=JSON.parse(asar.extractFile(app,'package.json').toString()).version;if(packagedVersion!==version)throw Error('窗口包版本不一致。');
 for(const name of fs.readdirSync(path.join(desktop,'dist/assets')))if(createHash('sha256').update(asar.extractFile(app,'dist/assets/'+name)).digest('hex')!==hash(path.join(desktop,'dist/assets',name)))throw Error('前端资源与构建输出不一致。');
 const exe=path.join(desktop,'release',`AgentBridge-${version}-Windows-x64.exe`);
 const report={date:new Date().toISOString(),status:'passed',version,backendModules:backend.length,coreFiles:core.length,coreBuildMatches:true,linuxBackendMatches:true,linuxFiles:manifest.files.length,linuxManifestDigest:digest,appAsarSourceMatches:true,frontendMatches:true,...(fs.existsSync(exe)&&process.argv.includes('--portable')?{portable:{file:path.relative(root,exe).replaceAll(path.sep,'/'),bytes:fs.statSync(exe).size,sha256:hash(exe)}}:{})};
 if(process.argv.includes('--portable')&&!report.portable)throw Error('Windows 便携 EXE 不存在。');
 const output=process.env.AGENTBRIDGE_PACKAGE_REPORT?path.resolve(process.env.AGENTBRIDGE_PACKAGE_REPORT):path.join(root,'artifacts/package-check',version,'package.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
verify().catch(error=>{console.error('发布资源校验失败：'+error.message);process.exitCode=1;});
