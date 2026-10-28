const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const sourceCommit='38cd6372f9130bd91eb535046e96ac51e4d4caa2';
const inputs=JSON.parse(fs.readFileSync('artifacts/issue27/2026-10-28/product-inputs.json')).files;
const blobs=new Map(cp.execFileSync('git',['ls-tree','-r','-z',sourceCommit],{encoding:'utf8'}).split('\0').filter(Boolean).map(line=>{const [meta,file]=line.split('\t');return [file,meta.split(' ')[2]];}));
const hashes=cp.execFileSync('git',['hash-object','--stdin-paths'],{input:inputs.map(row=>row.path).join('\n')+'\n',encoding:'utf8'}).trim().split('\n');
for(const [index,row] of inputs.entries()){
 const raw=crypto.createHash('sha256').update(fs.readFileSync(row.path)).digest('hex');if(raw!==row.sha256)throw Error('Raw input changed: '+row.path);
 const blob=hashes[index];if(blob!==blobs.get(row.path))throw Error('Source commit mismatch: '+row.path);
}
const report={date:new Date().toISOString(),sourceCommit,productInputs:inputs.length,rawInputsUnchanged:true,gitNormalizedBlobsMatch:true};
fs.writeFileSync('artifacts/issue27/2026-10-28/source-binding.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
