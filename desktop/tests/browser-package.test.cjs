'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{createHash}=require('node:crypto');
const unzipper=require('unzipper');
const {FILES,createBundle,writeBundle,stageBrowserExtension,verifyBrowserBundle}=require('../scripts/build-browser-extension.cjs');
const {verifyDesktopWebSocket}=require('../scripts/verify-package.cjs');
const sourceRoot=path.resolve(__dirname,'../../browser-extension'),hash=b=>createHash('sha256').update(b).digest('hex');
function copyTree(from,to){fs.mkdirSync(to);for(const entry of fs.readdirSync(from,{withFileTypes:true})){const input=path.join(from,entry.name),output=path.join(to,entry.name);assert.ok(!entry.isSymbolicLink());if(entry.isDirectory())copyTree(input,output);else{assert.ok(entry.isFile());fs.copyFileSync(input,output);}}}
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-browser-package-')),source=path.join(root,'source');t.after(()=>{const absolute=fs.realpathSync(root);assert.equal(path.dirname(absolute),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(absolute).startsWith('bridge-browser-package-'));fs.rmSync(absolute,{recursive:true,force:true});});copyTree(sourceRoot,source);return {root,source};}
const changeManifest=(source,change)=>{const file=path.join(source,'manifest.json'),value=JSON.parse(fs.readFileSync(file,'utf8'));change(value);fs.writeFileSync(file,JSON.stringify(value));};

test('production ZIP is independently readable and each original file matches its delivery manifest',async()=>{
 const bundle=createBundle(),directory=await unzipper.Open.buffer(bundle.outputs[0].bytes);assert.deepEqual(directory.files.map(f=>f.path),FILES);
 for(const entry of directory.files){const bytes=await entry.buffer(),record=bundle.manifest.files.find(f=>f.path===entry.path);assert.equal(entry.compressionMethod,0);assert.equal(bytes.length,record.bytes);assert.equal(hash(bytes),record.sha256);assert.ok(bytes.equals(fs.readFileSync(path.join(sourceRoot,entry.path))));}
 assert.equal(hash(bundle.outputs[0].bytes),bundle.manifest.archive.sha256);assert.equal(bundle.manifest.channel,'development');
 assert.ok(FILES.includes('LICENSE.txt'));assert.ok(FILES.includes('src/options/fonts/OFL-IBM-Plex.txt'));assert.ok(!FILES.some(n=>n.startsWith('tests/')));
});
test('ZIP and metadata depend on production bytes rather than absolute path, timestamps or private development files',async t=>{
 const f=fixture(t),first=createBundle({source:f.source});for(const name of FILES)fs.utimesSync(path.join(f.source,name),new Date(0),new Date(1));
 fs.writeFileSync(path.join(f.source,'.env'),'PRIVATE_BUILD_FIXTURE');fs.writeFileSync(path.join(f.source,'tests','private.token'),'PRIVATE_TEST_FIXTURE');
 const second=createBundle({source:f.source});assert.equal(first.manifest.sourceDigest,second.manifest.sourceDigest);for(let i=0;i<first.outputs.length;i++)assert.ok(first.outputs[i].bytes.equals(second.outputs[i].bytes));
 const entries=await unzipper.Open.buffer(second.outputs[0].bytes);assert.ok(!entries.files.some(e=>/private|\.env|tests\//.test(e.path)));assert.ok(!second.outputs[0].bytes.includes(Buffer.from('PRIVATE_BUILD_FIXTURE')));
});
test('permissions, extension identity changes and unsafe manifests fail before writing artifacts',t=>{
 const mutations=[m=>m.permissions.push('cookies'),m=>m.optional_host_permissions.push('https://www.kimi.com/*'),m=>m.host_permissions=['<all_urls>'],m=>m.key='unreviewed-public-key',m=>m.externally_connectable={matches:['https://*/*']},m=>m.content_security_policy.extension_pages+="; script-src-elem https://example.invalid",m=>m.background.service_worker='../../outside.mjs',m=>m.version='01.0',m=>m.version='65536.0'];
 for(const mutate of mutations){const f=fixture(t);changeManifest(f.source,mutate);const output=path.join(f.root,'artifacts');assert.throws(()=>writeBundle({source:f.source,output}));assert.equal(fs.existsSync(output),false);}
});
test('missing imports, outside references, dynamic imports and external fonts are rejected',t=>{
 for(const [name,text]of [['src/background/index.mjs',"import './absent.mjs';"],['src/background/index.mjs',"import '../../secret.mjs';"],['src/background/index.mjs',"import('https://example.invalid/code.mjs');"],['src/options/options.css','@font-face{src:url(https://example.invalid/font.woff2)}']]){const f=fixture(t);fs.appendFileSync(path.join(f.source,name),'\n'+text);assert.throws(()=>createBundle({source:f.source}),{code:'BROWSER_PACKAGE_REFERENCE'});}
});
test('unexpected production files, source links and source/output overlap are refused',t=>{
 const f=fixture(t);fs.writeFileSync(path.join(f.source,'src/private.token'),'PRIVATE_FIXTURE');assert.throws(()=>createBundle({source:f.source}),{code:'BROWSER_PACKAGE_UNEXPECTED'});fs.unlinkSync(path.join(f.source,'src/private.token'));
 const link=path.join(f.root,'source-link');fs.symlinkSync(f.source,link,process.platform==='win32'?'junction':'dir');assert.throws(()=>createBundle({source:link}),{code:'BROWSER_PACKAGE_LINK'});
 assert.throws(()=>writeBundle({source:f.source,output:path.join(f.source,'src','output')}),{code:'BROWSER_PACKAGE_OUTPUT_PATH'});assert.equal(fs.existsSync(path.join(f.source,'src/output')),false);
});
test('content-addressed output is idempotent and an existing conflicting artifact is preserved',t=>{
 const f=fixture(t),output=path.join(f.root,'deliver'),first=writeBundle({source:f.source,output}),second=writeBundle({source:f.source,output});assert.equal(first.archiveName,second.archiveName);
 const archive=path.join(output,first.archiveName);fs.writeFileSync(archive,'unrelated existing bytes');assert.throws(()=>writeBundle({source:f.source,output}),{code:'BROWSER_PACKAGE_OUTPUT_CONFLICT'});assert.equal(fs.readFileSync(archive,'utf8'),'unrelated existing bytes');
});
test('stage replacement is source-exact and preserves unknown or damaged contents',t=>{
 const f=fixture(t),destination=path.join(f.root,'.browser-extension');stageBrowserExtension({source:f.source,destination});assert.equal(verifyBrowserBundle({source:f.source,directory:destination}).files,FILES.length);
 const extra=path.join(destination,'retain.txt');fs.writeFileSync(extra,'user content');assert.throws(()=>stageBrowserExtension({source:f.source,destination}),{code:'BROWSER_PACKAGE_STAGE_INVALID'});assert.equal(fs.readFileSync(extra,'utf8'),'user content');fs.unlinkSync(extra);
 const archive=fs.readdirSync(destination).find(n=>n.endsWith('.zip'));fs.appendFileSync(path.join(destination,archive),'damaged');assert.throws(()=>stageBrowserExtension({source:f.source,destination}),{code:'BROWSER_PACKAGE_STAGE_INVALID'});
});
test('failed publication rolls back the original verified stage without overwriting another path',t=>{
 const f=fixture(t),destination=path.join(f.root,'.browser-extension'),first=stageBrowserExtension({source:f.source,destination});const before=fs.readFileSync(path.join(destination,first.archiveName));
 fs.appendFileSync(path.join(f.source,'INSTALL.txt'),'\nNew documented build.\n');let moves=0;
 assert.throws(()=>stageBrowserExtension({source:f.source,destination,rename(from,to){if(++moves===2)throw Error('Controlled stage publication failure');fs.renameSync(from,to);}}),/Controlled stage publication failure/);
 assert.ok(fs.readFileSync(path.join(destination,first.archiveName)).equals(before));assert.equal(fs.readdirSync(f.root).filter(n=>n.startsWith('.browser-extension.')).length,0);
 const next=stageBrowserExtension({source:f.source,destination});assert.notEqual(next.archiveName,first.archiveName);assert.equal(fs.existsSync(path.join(destination,first.archiveName)),false);assert.equal(verifyBrowserBundle({source:f.source,directory:destination}).archive,next.archiveName);
});
test('stage paths and links cannot redirect generated replacement',t=>{
 const f=fixture(t);assert.throws(()=>stageBrowserExtension({source:f.source,destination:path.join(f.root,'other-name')}),{code:'BROWSER_PACKAGE_STAGE_PATH'});
 const outside=path.join(f.root,'retained');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'retain.txt'),'retain');const destination=path.join(f.root,'.browser-extension');fs.symlinkSync(outside,destination,process.platform==='win32'?'junction':'dir');
 assert.throws(()=>stageBrowserExtension({source:f.source,destination}),{code:'BROWSER_PACKAGE_STAGE_INVALID'});assert.equal(fs.readFileSync(path.join(outside,'retain.txt'),'utf8'),'retain');
});

for(const variant of ['complete','absent','altered','metadata'])test('actual ASAR desktop WebSocket runtime is checked: '+variant,async t=>{
 const f=fixture(t),app=path.join(f.root,'app'),archive=path.join(f.root,'app.asar'),dependencyDirectory=path.dirname(require.resolve('ws/package.json')),expectedVersion=require('../package.json').dependencies.ws,asar=await import('@electron/asar');
 fs.mkdirSync(path.join(app,'node_modules'),{recursive:true});
 if(variant!=='absent'){copyTree(dependencyDirectory,path.join(app,'node_modules/ws'));if(variant==='altered')fs.appendFileSync(path.join(app,'node_modules/ws/index.js'),'\n// controlled alteration\n');}
 if(variant==='metadata'){const file=path.join(app,'node_modules/ws/package.json'),value=JSON.parse(fs.readFileSync(file,'utf8'));value.main='incorrect-entry.js';fs.writeFileSync(file,JSON.stringify(value));}
 await asar.createPackage(app,archive);
 const verify=()=>verifyDesktopWebSocket({asar,app:archive,dependencyDirectory,expectedVersion});
 if(variant==='complete'){const result=verify();assert.equal(result.version,expectedVersion);assert.ok(result.files>5);assert.equal(result.sourceMatches,true);}else assert.throws(verify,/WebSocket/);
});
