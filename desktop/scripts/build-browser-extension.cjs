'use strict';
// A development delivery artifact, never a browser profile or pairing export.
const fs=require('node:fs'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const ts=require('typescript');
const FORMAT='agentbridge-browser-bundle-v1',STAGE='.agentbridge-browser-stage.json';
const FILES=Object.freeze([
  'INSTALL.txt','LICENSE.txt','manifest.json',
  ...['client','executor','index','indexed-state','journal','pages'].map(n=>'src/background/'+n+'.mjs'),
  'src/content/runtime.js','src/providers/chatgpt/driver.js','src/providers/chatgpt/terminal.js','src/shared/wire.mjs',
  'src/options/index.html','src/options/options.mjs','src/options/options.css',
  'src/options/fonts/OFL-IBM-Plex.txt','src/options/fonts/ibm-plex-mono-latin-400.woff2','src/options/fonts/ibm-plex-sans-latin-variable.woff2',
].sort());
const known=new Set(FILES),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const within=(root,file)=>{const relative=path.relative(root,file);return !relative||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
const fail=(code,message)=>Object.assign(Error(message),{code});
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function storedZip(entries){
  const local=[],central=[];let offset=0;
  for(const entry of entries){
    const name=Buffer.from(entry.path),bytes=entry.bytes,crc=crc32(bytes),head=Buffer.alloc(30),dir=Buffer.alloc(46);
    head.writeUInt32LE(0x04034b50);head.writeUInt16LE(20,4);head.writeUInt16LE(0x800,6);head.writeUInt16LE(0x21,12);head.writeUInt32LE(crc,14);head.writeUInt32LE(bytes.length,18);head.writeUInt32LE(bytes.length,22);head.writeUInt16LE(name.length,26);
    dir.writeUInt32LE(0x02014b50);dir.writeUInt16LE(20,4);dir.writeUInt16LE(20,6);dir.writeUInt16LE(0x800,8);dir.writeUInt16LE(0x21,14);dir.writeUInt32LE(crc,16);dir.writeUInt32LE(bytes.length,20);dir.writeUInt32LE(bytes.length,24);dir.writeUInt16LE(name.length,28);dir.writeUInt32LE(offset,42);
    local.push(head,name,bytes);central.push(dir,name);offset+=head.length+name.length+bytes.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
function reference(from,relative){
  if(typeof relative!=='string'||!relative||relative.includes('\\')||/^[a-z]+:|^[\/]|[?#]/i.test(relative))throw fail('BROWSER_PACKAGE_REFERENCE','Only local package references are allowed.');
  const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(from),relative));
  if(!known.has(resolved))throw fail('BROWSER_PACKAGE_REFERENCE','A runtime reference is absent from the production file list.');
}
function validateManifest(manifest){
  const keys=['manifest_version','name','version','minimum_chrome_version','description','permissions','optional_host_permissions','background','action','options_ui','content_security_policy'];
  if(!manifest||Object.keys(manifest).some(k=>!keys.includes(k))||manifest.manifest_version!==3||!/^\d+(?:\.\d+){0,3}$/.test(manifest.version||'')||!manifest.version.split('.').every(n=>String(Number(n))===n&&Number(n)<=65535)||!manifest.version.split('.').some(n=>Number(n)>0)||!/^\d+(?:\.\d+)*$/.test(manifest.minimum_chrome_version||'')||typeof manifest.name!=='string'||!manifest.name.trim())throw fail('BROWSER_PACKAGE_MANIFEST','Unsupported production manifest.');
  const exact=(value,allowed)=>Array.isArray(value)&&value.length===allowed.length&&new Set(value).size===value.length&&value.every(v=>allowed.includes(v));
  if(!exact(manifest.permissions,['storage','alarms','scripting'])||!exact(manifest.optional_host_permissions,['https://chatgpt.com/*'])||manifest.background?.service_worker!=='src/background/index.mjs'||manifest.background.type!=='module'||Object.keys(manifest.background).length!==2||manifest.options_ui?.page!=='src/options/index.html'||manifest.options_ui.open_in_tab!==true||Object.keys(manifest.options_ui).length!==2||Object.keys(manifest.action||{}).some(k=>k!=='default_title')||manifest.content_security_policy?.extension_pages!=="script-src 'self'; object-src 'self'; connect-src ws://127.0.0.1:*"||Object.keys(manifest.content_security_policy).length!==1)throw fail('BROWSER_PACKAGE_PERMISSIONS','Production permissions, endpoints or entry points changed; review the package policy.');
}
function snapshot(source){
  const supplied=path.resolve(source);if(fs.lstatSync(supplied).isSymbolicLink())throw fail('BROWSER_PACKAGE_LINK','Source links are not packaged.');
  const root=fs.realpathSync(supplied),rootNames=fs.readdirSync(root);
  for(const file of ['manifest.json','LICENSE.txt','INSTALL.txt','src'])if(!rootNames.includes(file))throw fail('BROWSER_PACKAGE_MISSING','Production input is absent.');
  const visit=(directory,relative)=>{for(const item of fs.readdirSync(directory,{withFileTypes:true})){const name=path.posix.join(relative,item.name);if(item.isSymbolicLink())throw fail('BROWSER_PACKAGE_LINK','Source links are not packaged.');if(item.isDirectory()){if(!FILES.some(f=>f.startsWith(name+'/')))throw fail('BROWSER_PACKAGE_UNEXPECTED','Unexpected production directory.');visit(path.join(directory,item.name),name);}else if(!item.isFile()||!known.has(name))throw fail('BROWSER_PACKAGE_UNEXPECTED','Unexpected production input.');}};
  if(fs.lstatSync(path.join(root,'src')).isSymbolicLink())throw fail('BROWSER_PACKAGE_LINK','Source links are not packaged.');visit(path.join(root,'src'),'src');
  let total=0;const entries=FILES.map(name=>{const file=path.join(root,...name.split('/')),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw fail('BROWSER_PACKAGE_LINK','Only regular production files are packaged.');if(stat.size>4*1024*1024)throw fail('BROWSER_PACKAGE_LIMIT','Production input exceeds its bounds.');const bytes=fs.readFileSync(file);if(bytes.length>4*1024*1024||(total+=bytes.length)>32*1024*1024)throw fail('BROWSER_PACKAGE_LIMIT','Production package exceeds its bounds.');return {path:name,bytes};});
  const manifest=JSON.parse(entries.find(e=>e.path==='manifest.json').bytes.toString());validateManifest(manifest);
  for(const entry of entries){
    const sourceText=entry.bytes.toString();
    if(/\.(?:js|mjs)$/.test(entry.path)){
      const tree=ts.createSourceFile(entry.path,sourceText,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);if(tree.parseDiagnostics.length)throw fail('BROWSER_PACKAGE_SYNTAX','Production JavaScript cannot be parsed.');
      const walk=node=>{if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){if(node.moduleSpecifier){if(!ts.isStringLiteral(node.moduleSpecifier)||!node.moduleSpecifier.text.startsWith('.'))throw fail('BROWSER_PACKAGE_REFERENCE','Only local modules are packaged.');reference(entry.path,node.moduleSpecifier.text);}}if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword)throw fail('BROWSER_PACKAGE_REFERENCE','Dynamic imports require explicit package review.');if(ts.isStringLiteral(node)&&node.text.startsWith('src/')&&/\.(?:js|mjs)$/.test(node.text))reference('manifest.json',node.text);ts.forEachChild(node,walk);};walk(tree);
    }
    if(entry.path.endsWith('.html'))for(const match of sourceText.matchAll(/<(?:script|link|img|source)\b[^>]*\b(?:src|href)\s*=\s*["']([^"']+)["']/gi))reference(entry.path,match[1]);
    if(entry.path.endsWith('.css')){if(/@import\b/i.test(sourceText))throw fail('BROWSER_PACKAGE_REFERENCE','Stylesheet imports require explicit review.');for(const match of sourceText.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi))reference(entry.path,match[1]);}
  }
  return {root,entries,manifest};
}
function createBundle({source=path.resolve(__dirname,'../../browser-extension')}={}){
  const input=snapshot(source),files=input.entries.map(e=>({path:e.path,bytes:e.bytes.length,sha256:sha(e.bytes)}));
  const archive=storedZip(input.entries),digest=sha(archive),base='AgentBridge-BrowserAgent-'+input.manifest.version+'-dev-'+digest.slice(0,16),archiveName=base+'.zip',manifestName=base+'.manifest.json',checksumName=base+'.sha256';
  const manifest={format:FORMAT,channel:'development',extensionVersion:input.manifest.version,protocol:'agentbridge-browser-v1',minimumChromeVersion:input.manifest.minimum_chrome_version,sourceDigest:sha(Buffer.from(JSON.stringify(files))),archive:{file:archiveName,bytes:archive.length,sha256:digest,method:'stored',timestamp:'1980-01-01T00:00:00'},files};
  const metadata=json(manifest),checksum=Buffer.from(digest+'  '+archiveName+'\n'+sha(metadata)+'  '+manifestName+'\n');
  const current=snapshot(source||path.resolve(__dirname,'../../browser-extension')).entries.map(e=>({path:e.path,bytes:e.bytes.length,sha256:sha(e.bytes)}));if(JSON.stringify(current)!==JSON.stringify(files))throw fail('BROWSER_PACKAGE_SOURCE_CHANGED','Production inputs changed during the build.');
  return {sourceRoot:input.root,manifest,archiveName,manifestName,checksumName,outputs:[{name:archiveName,bytes:archive},{name:manifestName,bytes:metadata},{name:checksumName,bytes:checksum}]};
}
function writeBundle({source,output=path.resolve(__dirname,'../../artifacts/browser-extension')}={}){
  const bundle=createBundle({source});if(within(bundle.sourceRoot,path.resolve(output))||within(path.resolve(output),bundle.sourceRoot))throw fail('BROWSER_PACKAGE_OUTPUT_PATH','Package output must be separate from production source.');fs.mkdirSync(output,{recursive:true});if(fs.lstatSync(output).isSymbolicLink())throw fail('BROWSER_PACKAGE_OUTPUT_PATH','Package output cannot be a link.');const root=fs.realpathSync(output);if(within(bundle.sourceRoot,root)||within(root,bundle.sourceRoot))throw fail('BROWSER_PACKAGE_OUTPUT_PATH','Package output must be separate from production source.');
  for(const item of bundle.outputs){const file=path.join(root,item.name);try{fs.writeFileSync(file,item.bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||!fs.readFileSync(file).equals(item.bytes))throw fail('BROWSER_PACKAGE_OUTPUT_CONFLICT','Existing artifact differs; it was preserved.');}}
  return {...bundle,directory:root};
}
function ownedStage(directory){
  if(fs.lstatSync(directory).isSymbolicLink())throw fail('BROWSER_PACKAGE_STAGE_INVALID','Generated stage cannot be a link.');
  const markerFile=path.join(directory,STAGE),markerStat=fs.lstatSync(markerFile);if(!markerStat.isFile()||markerStat.isSymbolicLink()||markerStat.size>32768)throw fail('BROWSER_PACKAGE_STAGE_INVALID','Generated stage marker cannot be verified.');const marker=JSON.parse(fs.readFileSync(markerFile,'utf8'));
  if(marker.format!=='agentbridge-browser-stage-v1'||!Array.isArray(marker.files)||marker.files.length!==3||marker.files.some(f=>!/^AgentBridge-BrowserAgent-[\d.]+-dev-[a-f0-9]{16}\.(?:zip|manifest\.json|sha256)$/.test(f.name)||!Number.isSafeInteger(f.bytes)||!/^[a-f0-9]{64}$/.test(f.sha256)))throw fail('BROWSER_PACKAGE_STAGE_INVALID','Generated stage marker cannot be verified.');
  const allowed=new Set([STAGE,...marker.files.map(f=>f.name)]);if(allowed.size!==4||fs.readdirSync(directory).some(n=>!allowed.has(n)))throw fail('BROWSER_PACKAGE_STAGE_INVALID','Unrecognized stage contents were preserved.');
  for(const file of marker.files){const target=path.join(directory,file.name),stat=fs.lstatSync(target);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==file.bytes||sha(fs.readFileSync(target))!==file.sha256)throw fail('BROWSER_PACKAGE_STAGE_INVALID','Generated stage bytes cannot be verified.');}
  return allowed;
}
function removeFlat(directory,parent,allowed){
  if(path.dirname(path.resolve(directory))!==parent||!path.basename(directory).startsWith('.browser-extension.')||fs.lstatSync(directory).isSymbolicLink())throw fail('BROWSER_PACKAGE_STAGE_PATH','Unsafe generated cleanup path.');
  for(const name of fs.readdirSync(directory)){const file=path.join(directory,name);if(!allowed.has(name)||!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())throw fail('BROWSER_PACKAGE_STAGE_INVALID','Unrecognized generated contents were preserved.');}
  for(const name of fs.readdirSync(directory))fs.unlinkSync(path.join(directory,name));fs.rmdirSync(directory);
}
function stageBrowserExtension({source,destination=path.resolve(__dirname,'../.browser-extension'),rename=fs.renameSync}={}){
  const resolved=path.resolve(destination);if(path.basename(resolved)!=='.browser-extension')throw fail('BROWSER_PACKAGE_STAGE_PATH','Only the dedicated extension stage can be replaced.');
  const bundle=createBundle({source});if(within(bundle.sourceRoot,resolved)||within(resolved,bundle.sourceRoot))throw fail('BROWSER_PACKAGE_STAGE_PATH','Stage must be separate from production source.');fs.mkdirSync(path.dirname(resolved),{recursive:true});const parent=fs.realpathSync(path.dirname(resolved)),target=path.join(parent,'.browser-extension');if(within(bundle.sourceRoot,target)||within(target,bundle.sourceRoot))throw fail('BROWSER_PACKAGE_STAGE_PATH','Stage must be separate from production source.');
  const old=fs.existsSync(target)?ownedStage(target):undefined,stage=target+'.'+randomUUID()+'.tmp',backup=target+'.'+randomUUID()+'.backup';
  const allowed=new Set([STAGE,...bundle.outputs.map(o=>o.name)]);fs.mkdirSync(stage);let moved=false,published=false;
  try{
    for(const file of bundle.outputs)fs.writeFileSync(path.join(stage,file.name),file.bytes,{flag:'wx'});
    fs.writeFileSync(path.join(stage,STAGE),json({format:'agentbridge-browser-stage-v1',files:bundle.outputs.map(f=>({name:f.name,bytes:f.bytes.length,sha256:sha(f.bytes)}))}),{flag:'wx'});ownedStage(stage);
    if(old){rename(target,backup);moved=true;}rename(stage,target);published=true;
    if(old)removeFlat(backup,parent,old);return {...bundle,directory:target};
  }catch(error){if(!published&&moved&&!fs.existsSync(target))rename(backup,target);if(fs.existsSync(stage))removeFlat(stage,parent,allowed);throw error;}
}
function verifyBrowserBundle({source,directory=path.resolve(__dirname,'../.browser-extension')}={}){
  const expected=createBundle({source});ownedStage(directory);for(const item of expected.outputs){const file=path.join(directory,item.name);if(!fs.existsSync(file)||!fs.readFileSync(file).equals(item.bytes))throw fail('BROWSER_PACKAGE_MISMATCH','Packaged extension differs from production source.');}
  return {format:FORMAT,extensionVersion:expected.manifest.extensionVersion,files:expected.manifest.files.length,bytes:expected.manifest.archive.bytes,sha256:expected.manifest.archive.sha256,sourceDigest:expected.manifest.sourceDigest,archive:expected.archiveName};
}
if(require.main===module){try{const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--out'))throw Error('Usage: node build-browser-extension.cjs [--out DIRECTORY]');const result=writeBundle(args.length?{output:path.resolve(args[1])}:{});console.log(JSON.stringify({channel:'development',files:result.manifest.files.length,archive:result.archiveName,bytes:result.manifest.archive.bytes,sha256:result.manifest.archive.sha256,sourceDigest:result.manifest.sourceDigest}));}catch(error){console.error(error.code||'BROWSER_PACKAGE_FAILED');process.exitCode=1;}}
module.exports={FILES,createBundle,writeBundle,stageBrowserExtension,verifyBrowserBundle};
