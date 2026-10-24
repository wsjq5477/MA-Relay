const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
function frozenCatalogueInput(){
 const directory=path.resolve(__dirname,'../compatible-daemons');
 const releases=fs.readdirSync(directory).filter(v=>v.endsWith('.json')).sort().map(name=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,name)));
  return {version:manifest.version,digest:createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),manifest};
 });
 const controller=releases.find(v=>v.version==='0.6.0-alpha.55');
 const from=releases.find(v=>v.version==='0.6.0-alpha.53');
 if(!controller||!from)throw Error('Frozen 53/55 source pins are required');
 return {action:'upgrade',operationId:'controlled-original-large-operation',ownerCoordinatorId:'controlled-owner',profileId:'controlled-profile',daemonId:'controlled-daemon',from,target:controller,controller,releases:[controller,...releases]};
}
module.exports={frozenCatalogueInput};
