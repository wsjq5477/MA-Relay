'use strict';
// Load delivered archive bytes in an isolated real MV3 integration fixture.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{spawn}=require('node:child_process');
const unzipper=require('unzipper');
const {FILES,writeBundle,createBundle}=require('../scripts/build-browser-extension.cjs');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function run(){
 const bundle=writeBundle(),root=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-browser-archive-')),source=path.join(root,'extension');fs.mkdirSync(source);
 try{
  const archive=fs.readFileSync(path.join(bundle.directory,bundle.archiveName));assert.equal(hash(archive),bundle.manifest.archive.sha256);
  const opened=await unzipper.Open.buffer(archive);assert.deepEqual(opened.files.map(e=>e.path),FILES);
  for(const entry of opened.files){const record=bundle.manifest.files.find(f=>f.path===entry.path),bytes=await entry.buffer();assert.equal(bytes.length,record.bytes);assert.equal(hash(bytes),record.sha256);const output=path.join(source,...entry.path.split('/'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes,{flag:'wx'});}
  assert.equal(createBundle({source}).manifest.archive.sha256,bundle.manifest.archive.sha256);
  const child=spawn(process.execPath,[path.join(__dirname,'browser-extension-live.cjs')],{windowsHide:true,stdio:'inherit',env:{...process.env,AGENTBRIDGE_TEST_EXTENSION_SOURCE:source}});
  const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>signal?reject(Error('MV3 verification process was interrupted.')):resolve(code));});assert.equal(exitCode,0);
 }finally{
  const absolute=fs.realpathSync(root);assert.equal(path.dirname(absolute),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(absolute).startsWith('bridge-browser-archive-'));fs.rmSync(absolute,{recursive:true,force:true});
 }
}
if(require.main===module)run().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={run};
